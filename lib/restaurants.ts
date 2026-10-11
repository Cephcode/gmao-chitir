"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DeleteResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteRestaurantById(restaurantId: string): Promise<DeleteResult> {
  if (!restaurantId) return { success: false, error: "Identifiant manquant." };

  try {
    const supabase = await createClient();

    // .select() renvoie les lignes supprimées : on détecte ainsi le cas
    // où la RLS bloque silencieusement (0 ligne supprimée, pas d'erreur).
    const { data, error } = await supabase
      .from("restaurants")
      .delete()
      .eq("id", restaurantId)
      .select("id");

    if (error) {
      console.error("Erreur suppression restaurant :", error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Restaurant introuvable ou suppression non autorisée.",
      };
    }

    revalidatePath("/restaurants");
    revalidatePath("/equipements");
    return { success: true };
  } catch (e) {
    console.error("Erreur inattendue :", e);
    return { success: false, error: "Erreur inattendue." };
  }
}