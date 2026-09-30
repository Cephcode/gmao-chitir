"use server";

// Changement de mot de passe (obligatoire à la première connexion).
// Met à jour le mot de passe Supabase puis retire le drapeau must_change_password.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChangeState = { error: string } | null;

export async function changerMotDePasse(
  _prev: ChangeState,
  formData: FormData,
): Promise<ChangeState> {
  const nouveau = String(formData.get("nouveau") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (nouveau.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (nouveau !== confirmation) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { error } = await supabase.auth.updateUser({ password: nouveau });
  if (error) {
    return { error: "Le mot de passe n'a pas pu être changé. Réessayez." };
  }

  // La table users n'a pas de politique d'écriture (RLS) : on passe par le client admin,
  // limité à la ligne de l'utilisateur dont l'identité vient d'être vérifiée.
  const { error: flagError } = await createAdminClient()
    .from("users")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (flagError) {
    return { error: "Mot de passe changé, mais l'enregistrement a échoué. Réessayez." };
  }

  redirect("/");
}
