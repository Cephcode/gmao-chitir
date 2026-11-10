"use server";

// Actions des notifications. Les RLS limitent chaque écriture aux notifications
// et réglages de l'utilisateur connecté (user_id = auth.uid()).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SETTINGS, safeLink, type NotificationType } from "@/lib/notifications";
import { UUID_RE, lienAvecNotification } from "@/lib/notification-lien";

// « Voir » : marque comme lue puis ouvre la page liée (lien interne seulement).
export async function ouvrirNotification(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null)
    .select("link");
  // Déjà lue : on relit simplement le lien.
  let link = (data?.[0] as { link: string | null } | undefined)?.link ?? null;
  if (!data?.length) {
    const { data: row } = await supabase.from("notifications").select("link").eq("id", id).maybeSingle();
    link = (row as { link: string | null } | null)?.link ?? null;
  }
  revalidatePath("/", "layout");
  // La page liée reçoit ?notif=<id> (bouton « Supprimer la notification »). Sans lien
  // (ou notification introuvable) : retour à la liste, où chaque ligne a déjà sa corbeille.
  const cible = safeLink(link);
  redirect(cible === "/notifications" ? cible : lienAvecNotification(cible, id));
}

// Bouton de la page ouverte depuis une notification : titre de la notification, ou null
// si elle n'existe plus ou n'est pas la sienne (RLS notifications_select).
export async function lireTitreNotification(id: string): Promise<string | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("title").eq("id", id).maybeSingle();
  return (data as { title: string } | null)?.title ?? null;
}

// Suppression depuis la page ouverte (même règle que supprimerNotification), avec un retour.
export async function supprimerNotificationParId(id: string): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(id)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").delete().eq("id", id).select("id");
  revalidatePath("/", "layout");
  return { ok: !error && !!data?.length };
}

export async function toutMarquerLu() {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}

// Suppression d'une notification (la sienne : RLS notifications_delete).
export async function supprimerNotification(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// Supprime toutes ses notifications déjà lues.
export async function supprimerNotificationsLues() {
  const supabase = await createClient();
  await supabase.from("notifications").delete().not("read_at", "is", null);
  revalidatePath("/", "layout");
}

// Interrupteur « Mes alertes » : crée ou met à jour la ligne de réglage.
export async function reglerAlerte(type: NotificationType, enabled: boolean) {
  if (!SETTINGS.some((s) => s.type === type)) return { ok: false as const };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, type, enabled }, { onConflict: "user_id,type" });
  revalidatePath("/notifications", "layout");
  return { ok: !error };
}

// Appareil qui reçoit les push : enregistré pour l'utilisateur connecté (RLS : ses propres
// appareils). Un jeton déjà connu (autre compte sur le même navigateur) change de propriétaire.
export async function enregistrerAppareil(token: string, userAgent: string) {
  if (!token || token.length > 4096) return { ok: false as const };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  // Le jeton peut appartenir à un autre compte (même navigateur) : on le retire d'abord.
  // Un jeton FCM n'est connu que de l'appareil qui l'a obtenu.
  await createAdminClient().from("push_tokens").delete().eq("token", token).neq("user_id", user.id);
  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { token, user_id: user.id, user_agent: userAgent.slice(0, 300), last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  // Code d'erreur seulement : un message Postgres peut recopier la valeur fautive (le jeton).
  if (error) console.error("Enregistrement de l'appareil (push_tokens), code", error.code);
  return { ok: !error };
}

// Retire ce jeton des appareils du compte connecté (« Couper » et déconnexion, recette S-B3).
// Client de l'utilisateur, pas le client admin : la RLS (push_tokens_delete) limite la
// suppression à ses propres jetons, un jeton d'un autre compte n'est pas touché.
// Toujours ok : la déconnexion ne doit pas être bloquée par un échec ici.
export async function oublierAppareil(token: string) {
  const supabase = await createClient();
  await supabase.from("push_tokens").delete().eq("token", token);
  return { ok: true as const };
}
