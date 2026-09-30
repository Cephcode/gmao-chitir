"use server";

// Déclaration de panne : appelle la fonction SQL declarer_panne, qui vérifie l'accès au
// restaurant (tous les rôles peuvent déclarer) puis, en une transaction : ouvre
// l'intervention, met la machine en panne, écrit la fiche de vie, notifie l'équipe.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/session";
import { canSetStatus, isOpenStatus, type OpenStatus } from "@/lib/intervention-status";

export type PanneInput = {
  equipmentId: string | null; // null = machine non trouvée dans la liste
  restaurantId: string; // utilisé seulement sans équipement
  freeText: string; // description de la machine non trouvée
  symptoms: string[];
  description: string;
  type: "urgence" | "normal" | null;
  // État de départ, choisi par propriétaire, éditeur et commentateur (obligatoire pour eux).
  // Un lecteur ne choisit pas : la base force « À planifier ».
  status: OpenStatus | null;
};

export type PanneState = { error: string; field?: "machine" | "type" | "status" } | null;

export async function declarerPanne(input: PanneInput): Promise<PanneState> {
  if (!input.equipmentId && !input.freeText.trim()) {
    return { error: "Choisissez la machine, ou décrivez-la si elle n'est pas dans la liste.", field: "machine" };
  }
  if (!input.type) return { error: "Indiquez si c'est urgent.", field: "type" };

  const profile = await getProfile();
  if (!profile) return { error: "Connexion requise." };
  const chooses = canSetStatus(profile.role);
  if (chooses && !isOpenStatus(input.status)) {
    return { error: "Choisissez l'état de l'intervention.", field: "status" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("declarer_panne", {
    p_equipment_id: input.equipmentId,
    p_type: input.type,
    p_symptoms: input.symptoms,
    p_description: input.description.trim() || null,
    p_restaurant_id: input.equipmentId ? null : input.restaurantId,
    p_equipment_free_text: input.equipmentId ? null : input.freeText.trim(),
    p_status: chooses && input.status ? input.status : "a_planifier",
  });
  if (error) {
    // 42501 (accès), 22004 et 22023 (saisie) : message SQL déjà en français.
    const known = ["42501", "22004", "22023", "P0002"].includes(error.code ?? "");
    return { error: known ? error.message : "La déclaration n'a pas pu être envoyée. Réessayez." };
  }

  revalidatePath("/", "layout");
  redirect(`/panne/envoyee/${data as string}`);
}
