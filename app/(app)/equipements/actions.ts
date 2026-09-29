"use server";

// Actions de la rubrique Équipements. Les droits sont vérifiés en base :
// - noter_entretien_fait et enregistrer_equipement (SECURITY DEFINER) contrôlent rôle et restaurant ;
// - la suppression passe par les RLS (propriétaire seulement).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: true; message: string } | { ok: false; error: string } | null;

// Messages lisibles pour les erreurs Postgres attendues. 42501 et 22023 portent déjà
// un message en français écrit dans la fonction SQL.
function messageErreur(error: { code?: string; message: string }, defaut: string) {
  if (error.code === "42501" || error.code === "22023" || error.code === "P0002") return error.message;
  if (error.code === "23505") return "Ce code est déjà utilisé par un autre équipement.";
  return defaut;
}

export async function noterEntretienFait(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const equipmentId = String(formData.get("equipmentId") ?? "");
  if (!equipmentId) return { ok: false, error: "Équipement manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("noter_entretien_fait", { p_equipment_id: equipmentId });
  if (error) {
    return { ok: false, error: messageErreur(error, "L'entretien n'a pas pu être noté. Réessayez.") };
  }

  // Fiche, liste et tableau de bord affichent la nouvelle échéance.
  revalidatePath("/", "layout");
  return { ok: true, message: "Entretien noté. Prochaine échéance recalculée." };
}

// Code proposé dans le formulaire (CTR2-REF-05). Null si pas d'accès au restaurant.
export async function suggererCode(restaurantId: string, categoryId: string | null) {
  if (!restaurantId) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("prochain_code_equipement", {
    p_restaurant_id: restaurantId,
    p_category_id: categoryId,
  });
  return (data as string | null) ?? null;
}

export type EquipmentInput = {
  id: string | null; // null = création
  restaurantId: string;
  name: string;
  code: string;
  state: "operationnel" | "en_panne" | "en_maintenance" | "hors_service";
  category: { id: string } | { newName: string } | null;
  brand: { id: string } | { newName: string } | null;
  model: string;
  serialNumber: string;
  installedAt: string; // AAAA-MM-JJ ou ""
  frequency: "mensuel" | "trimestriel" | "semestriel" | "annuel" | null;
  task: string;
};

export type SaveState = { error: string; field?: "name" | "code" | "restaurant" } | null;

export async function enregistrerEquipement(input: EquipmentInput): Promise<SaveState> {
  if (!input.name.trim()) return { error: "Donnez un nom à l'équipement.", field: "name" };
  if (!input.restaurantId) return { error: "Choisissez le restaurant.", field: "restaurant" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enregistrer_equipement", {
    p_id: input.id,
    p_restaurant_id: input.restaurantId,
    p_name: input.name,
    p_code: input.code,
    p_state: input.state,
    p_category_id: input.category && "id" in input.category ? input.category.id : null,
    p_new_category: input.category && "newName" in input.category ? input.category.newName : null,
    p_brand_id: input.brand && "id" in input.brand ? input.brand.id : null,
    p_new_brand: input.brand && "newName" in input.brand ? input.brand.newName : null,
    p_model: input.model,
    p_serial_number: input.serialNumber,
    p_installed_at: input.installedAt || null,
    p_frequency: input.frequency,
    p_task: input.task,
  });
  if (error) {
    return {
      error: messageErreur(error, "L'équipement n'a pas pu être enregistré. Réessayez."),
      field: error.code === "23505" ? "code" : undefined,
    };
  }

  revalidatePath("/", "layout");
  redirect(`/equipements/${data as string}`);
}

// Suppression définitive (interventions, entretiens et fiche de vie partent avec, en cascade).
export async function supprimerEquipement(id: string): Promise<SaveState> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("equipments").delete().eq("id", id).select("id");
  if (error) return { error: "La suppression a échoué. Réessayez." };
  // Aucune ligne supprimée : les RLS ont refusé (seul le propriétaire supprime).
  if (!data || data.length === 0) {
    return { error: "Seul un propriétaire peut supprimer un équipement." };
  }
  revalidatePath("/", "layout");
  redirect("/equipements");
}
