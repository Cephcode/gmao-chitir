"use server";

// Déconnexion : ferme la session Supabase et renvoie vers la connexion.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deconnexion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
