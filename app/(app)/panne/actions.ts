"use server";

// Déclaration de panne : appelle la fonction SQL declarer_panne, qui vérifie l'accès au
// restaurant (tous les rôles peuvent déclarer) puis, en une transaction : ouvre
// l'intervention, met la machine en panne, écrit la fiche de vie, notifie l'équipe.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PanneInput = {
  equipmentId: string | null; // null = machine non trouvée dans la liste
  restaurantId: string; // utilisé seulement sans équipement
  freeText: string; // description de la machine non trouvée
  symptoms: string[];
  description: string;
  type: "urgence" | "normal" | null;
};

export type PanneState = { error: string; field?: "machine" | "type" } | null;

export async function declarerPanne(input: PanneInput): Promise<PanneState> {
  if (!input.equipmentId && !input.freeText.trim()) {
    return { error: "Choisissez la machine, ou décrivez-la si elle n'est pas dans la liste.", field: "machine" };
  }
  if (!input.type) return { error: "Indiquez si c'est urgent.", field: "type" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("declarer_panne", {
    p_equipment_id: input.equipmentId,
    p_type: input.type,
    p_symptoms: input.symptoms,
    p_description: input.description.trim() || null,
    p_restaurant_id: input.equipmentId ? null : input.restaurantId,
    p_equipment_free_text: input.equipmentId ? null : input.freeText.trim(),
  });
  if (error) {
    // 42501 (accès), 22004 et 22023 (saisie) : message SQL déjà en français.
    const known = ["42501", "22004", "22023", "P0002"].includes(error.code ?? "");
    return { error: known ? error.message : "La déclaration n'a pas pu être envoyée. Réessayez." };
  }

  revalidatePath("/", "layout");
  redirect(`/panne/envoyee/${data as string}`);
}
