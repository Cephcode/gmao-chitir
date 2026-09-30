"use server";

// Déconnexion : ferme la session Supabase et renvoie vers la connexion.
// Le jeton push de ce navigateur est oublié juste avant, côté client (lib/push-appareil.ts).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deconnexion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
