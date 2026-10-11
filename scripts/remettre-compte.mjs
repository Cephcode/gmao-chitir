// Remet un compte existant à une autre personne : nouvel e-mail de connexion et nouveau mot de
// passe temporaire, à changer à la première connexion. Le compte garde son rôle, ses restaurants
// et son historique (pannes déclarées, interventions, entretiens).
// Sert à la remise au client : le compte propriétaire passe de l'e-mail du développeur à celui
// du client (docs/remise-client.md). Avec le même e-mail en ancien et en nouveau, il génère
// seulement un nouveau mot de passe temporaire (propriétaire seul qui a perdu le sien).
//
// Usage (depuis gmao-chitir) :
//   node --env-file=.env.development.local scripts/remettre-compte.mjs ancien@email nouveau@email ["Prénom"]
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY : le fichier .env choisit donc la base visée.
//
// L'e-mail est changé aux deux endroits qui le portent : le compte de connexion (auth.users,
// via l'API d'administration) et le profil de l'application (users.email, utilisé pour les mails).
import { createClient } from "@supabase/supabase-js";

const [ancien, nouveau, prenom] = process.argv.slice(2).map((v) => v?.trim());
if (!ancien || !nouveau) {
  console.error('Usage : node --env-file=… scripts/remettre-compte.mjs ancien@email nouveau@email ["Prénom"]');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY sont requis (option --env-file).");
  process.exit(1);
}

const emailAncien = ancien.toLowerCase();
const emailNouveau = nouveau.toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNouveau)) {
  console.error(`E-mail invalide : ${nouveau}`);
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Même alphabet que les mots de passe temporaires de l'application (lib/admin.ts).
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const motDePasse = Array.from(crypto.getRandomValues(new Uint32Array(12)), (b) => alphabet[b % alphabet.length]).join("");

const { data: profil, error: lecture } = await admin
  .from("users")
  .select("id, first_name, role")
  .eq("email", emailAncien)
  .maybeSingle();
if (lecture) throw lecture;
if (!profil) {
  console.error(`Aucun compte avec l'e-mail ${emailAncien} sur ${url}.`);
  process.exit(1);
}

const { data: existant } = await admin.from("users").select("id").eq("email", emailNouveau).maybeSingle();
if (existant && existant.id !== profil.id) {
  console.error(`Un compte utilise déjà ${emailNouveau}. Supprimez-le ou choisissez un autre e-mail.`);
  process.exit(1);
}

const { error: auth } = await admin.auth.admin.updateUserById(profil.id, {
  email: emailNouveau,
  email_confirm: true,
  password: motDePasse,
});
if (auth) throw auth;

const { error: maj } = await admin
  .from("users")
  .update({
    email: emailNouveau,
    must_change_password: true,
    ...(prenom ? { first_name: prenom } : {}),
  })
  .eq("id", profil.id);
if (maj) {
  console.error("Connexion changée, mais pas le profil : relancez le script tel quel.");
  throw maj;
}

console.log(`Base : ${url}`);
console.log(`Compte ${prenom || profil.first_name || ""} (${profil.role}) : ${emailAncien} → ${emailNouveau}`);
console.log(`Mot de passe temporaire : ${motDePasse}`);
console.log("À transmettre à la personne ; elle le changera à sa première connexion.");
