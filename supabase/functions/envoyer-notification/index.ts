// Edge Function envoyer-notification (étape 7b).
// Appelée par le trigger trg_notifications_envoi (pg_net) avec { id } à chaque nouvelle
// notification, quelle que soit sa source (panne, clôture, stock, tâche du matin).
// 1. Réserve la notification (delivered_at) en une instruction : une seule remise, et un id
//    inconnu ou déjà envoyé ne fait rien (l'appel n'a donc pas besoin de secret).
// 2. Push Firebase (API HTTP v1) vers tous les appareils du destinataire ; jetons expirés supprimés.
// 3. Mail Resend pour les urgences, les pannes et les attributions au technicien. Mode test tant que le domaine n'est pas
//    vérifié : si RESEND_TEST_RECIPIENT est défini, tous les mails partent vers cette adresse,
//    avec le vrai destinataire indiqué dans le mail.
// Expéditeur : RESEND_FROM_PRODUCTION (domaine du client) s'il est défini, sinon
// RESEND_FROM_PRESENTATION (domaine du développeur, version de présentation), sinon
// l'adresse de test de Resend. À la remise au client, il suffit de définir RESEND_FROM_PRODUCTION.
// Secrets (supabase secrets set) : RESEND_API_KEY, RESEND_TEST_RECIPIENT (facultatif),
// RESEND_FROM_PRESENTATION, RESEND_FROM_PRODUCTION (facultatifs),
// FIREBASE_SERVICE_ACCOUNT_KEY (JSON du compte de service), APP_URL.
// Aucune donnée personnelle n'est écrite dans les journaux.
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "npm:jose@5";

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const EMAIL_TYPES = new Set(["urgence", "panne", "attribution"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Méthode non autorisée", { status: 405 });
  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return new Response("JSON invalide", { status: 400 });
  }
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("id invalide", { status: 400 });

  // Réservation atomique : seule la première remise passe.
  const { data: claimed, error } = await supabase
    .from("notifications")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", id)
    .is("delivered_at", null)
    .select("id, user_id, type, title, body, link");
  if (error) return new Response("Erreur de lecture", { status: 500 });
  const n = (claimed?.[0] ?? null) as Notification | null;
  if (!n) return new Response("Rien à envoyer", { status: 200 });

  const url = APP_URL + (n.link?.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications");
  const [push, mail] = await Promise.allSettled([
    envoyerPush(n, url),
    EMAIL_TYPES.has(n.type) ? envoyerMail(n, url) : Promise.resolve("pas de mail pour ce type"),
  ]);
  const etat = (r: PromiseSettledResult<string>) => (r.status === "fulfilled" ? r.value : `échec : ${r.reason}`);
  console.log(JSON.stringify({ notification: n.id, type: n.type, push: etat(push), mail: etat(mail) }));
  return Response.json({ push: etat(push), mail: etat(mail) });
});

// ---------- Push (Firebase Cloud Messaging, API HTTP v1) ----------

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

// Le secret peut être le JSON brut ou encodé en base64.
function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (!raw) return null;
  const json = raw.trim().startsWith("{") ? raw : atob(raw.trim());
  return JSON.parse(json) as ServiceAccount;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

// Jeton d'accès Google (OAuth 2, assertion JWT signée avec la clé du compte de service).
async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(sa.private_key, "RS256"));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`OAuth Google ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function envoyerPush(n: Notification, url: string): Promise<string> {
  const sa = serviceAccount();
  if (!sa) return "push non configuré";
  const { data: tokens } = await supabase.from("push_tokens").select("token").eq("user_id", n.user_id);
  if (!tokens?.length) return "aucun appareil";

  const access = await googleAccessToken(sa);
  let sent = 0;
  for (const { token } of tokens as { token: string }[]) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: n.title, body: n.body ?? "" },
          data: { link: url },
          webpush: { fcm_options: { link: url }, notification: { icon: `${APP_URL}/logo-chitir.png` } },
        },
      }),
    });
    if (res.ok) {
      sent++;
    } else if (res.status === 404 || res.status === 400) {
      // Appareil désinscrit ou jeton invalide : on l'oublie.
      const detail = await res.text();
      if (/UNREGISTERED|INVALID_ARGUMENT|registration token/i.test(detail)) {
        await supabase.from("push_tokens").delete().eq("token", token);
      }
    }
  }
  return `push ${sent}/${tokens.length}`;
}

// ---------- Mail (Resend) ----------

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Adresse d'expédition : production (client) > présentation (développeur) > test Resend.
// Une valeur vide compte comme absente, pour pouvoir « vider » un secret sans le supprimer.
function expediteur(): string {
  const production = Deno.env.get("RESEND_FROM_PRODUCTION")?.trim();
  const presentation = Deno.env.get("RESEND_FROM_PRESENTATION")?.trim();
  return production || presentation || "GMAO Chitir <onboarding@resend.dev>";
}

async function envoyerMail(n: Notification, url: string): Promise<string> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return "mail non configuré";
  const { data: user } = await supabase.from("users").select("email, first_name").eq("id", n.user_id).single();
  const email = (user as { email: string | null } | null)?.email;
  if (!email) return "destinataire sans e-mail";

  const testRecipient = Deno.env.get("RESEND_TEST_RECIPIENT");
  const note = testRecipient
    ? `<p style="color:#7A4A00;background:#FFF4D6;padding:8px 12px;border-radius:8px">Mode test : ce mail était destiné à ${escapeHtml(email)}.</p>`
    : "";
  const html = `<div style="font-family:Arial,sans-serif;color:#22170F;max-width:520px">
    ${note}
    <h2 style="margin:0 0 8px">${escapeHtml(n.title)}</h2>
    ${n.body ? `<p style="margin:0 0 16px;color:#6E6053">${escapeHtml(n.body)}</p>` : ""}
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#F88F1F;color:#2B1A10;font-weight:bold;padding:12px 20px;border-radius:12px;text-decoration:none">Ouvrir dans la GMAO</a>
    <p style="margin:24px 0 0;color:#6E6053;font-size:13px">GMAO Chitir Chicken · réglez vos alertes dans Notifications, Mes alertes.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: expediteur(),
      to: [testRecipient || email],
      subject: n.title,
      html,
      text: `${n.title}\n${n.body ?? ""}\n${url}`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
  return testRecipient ? "mail envoyé (mode test)" : "mail envoyé";
}
