"use server";

// Action de connexion : e-mail + mot de passe.
// Le rôle vient du serveur (pas de choix à la connexion). En cas de succès,
// on note last_seen_at puis on redirige vers l'accueil.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliserEmail } from "@/lib/identifiant";

export type ConnexionState = { error: string } | null;

export async function seConnecter(
  _prev: ConnexionState,
  formData: FormData,
): Promise<ConnexionState> {
  const identifiant = String(formData.get("identifiant") ?? "").trim();
  const motDePasse = String(formData.get("motDePasse") ?? "");

  if (!identifiant || !motDePasse) {
    return { error: "Renseignez votre e-mail et votre mot de passe." };
  }

  const supabase = await createClient();

  // E-mail normalisé comme à la création du compte.
  const email = normaliserEmail(identifiant);
  if (!email) return { error: "E-mail ou mot de passe incorrect." };
  const credentials = { email, password: motDePasse };

  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: "E-mail ou mot de passe incorrect." };
  }

  // Trace de la dernière visite (sert au badge « Invitation envoyée » côté admin).
  // Client admin car la table users n'a pas de politique d'écriture (RLS).
  if (data.user) {
    await createAdminClient()
      .from("users")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  redirect("/");
}
