"use server";

// Actions de la rubrique Équipements.
// noterEntretienFait appelle la fonction SQL noter_entretien_fait, qui vérifie elle-même
// le rôle (propriétaire, éditeur, commentateur) et l'accès au restaurant, puis, en une
// transaction : recale dernier et prochain entretien, écrit le journal et la fiche de vie.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export async function noterEntretienFait(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const equipmentId = String(formData.get("equipmentId") ?? "");
  if (!equipmentId) return { ok: false, error: "Équipement manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("noter_entretien_fait", { p_equipment_id: equipmentId });
  if (error) {
    // 42501 : rôle ou restaurant refusé ; le message SQL est déjà en français.
    return {
      ok: false,
      error: error.code === "42501" ? error.message : "L'entretien n'a pas pu être noté. Réessayez.",
    };
  }

  // Fiche, liste et tableau de bord affichent la nouvelle échéance.
  revalidatePath("/", "layout");
  return { ok: true, message: "Entretien noté. Prochaine échéance recalculée." };
}
