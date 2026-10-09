// Crée le premier compte propriétaire d'un projet Supabase neuf (à lancer une seule fois).
// Usage : node --env-file=<fichier .env du projet> scripts/creer-proprietaire.mjs email "Prénom"
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY. Affiche un mot de passe temporaire,
// à changer à la première connexion (comme les comptes créés dans Administration).
import { createClient } from "@supabase/supabase-js";

const [email, prenom] = process.argv.slice(2);
if (!email) throw new Error('Usage : node --env-file=… scripts/creer-proprietaire.mjs email "Prénom"');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const motDePasse = Array.from(crypto.getRandomValues(new Uint32Array(12)), (b) => alphabet[b % alphabet.length]).join("");

const { data, error } = await admin.auth.admin.createUser({
  email: email.trim().toLowerCase(),
  password: motDePasse,
  email_confirm: true,
});
if (error) throw error;
const { error: profil } = await admin.from("users").insert({
  id: data.user.id,
  email: email.trim().toLowerCase(),
  first_name: prenom || null,
  role: "proprietaire",
  all_restaurants: true,
  must_change_password: true,
});
if (profil) {
  await admin.auth.admin.deleteUser(data.user.id);
  throw profil;
}
console.log(`Compte créé pour ${email}. Mot de passe temporaire : ${motDePasse}`);
