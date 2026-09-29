"use server";

// Actions sur une intervention ouverte.
// - enregistrerIntervention : travail en cours et technicien, écriture directe (RLS :
//   propriétaire, éditeur, commentateur, sur leur restaurant, intervention encore ouverte).
// - cloturerIntervention : fonction SQL cloturer_intervention, une seule transaction
//   (clôture, pièces et stock, état de la machine, fiche de vie, notifications).
// Le technicien choisi est revérifié ici : il doit avoir accès au restaurant.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getIntervention, listTechnicians } from "@/lib/interventions";
import type { EquipmentState } from "@/lib/equipements";

export type InterventionResult = { ok: true; message: string } | { ok: false; error: string } | null;

async function checkAssignee(restaurantId: string, assignedTo: string | null) {
  if (!assignedTo) return true;
  const techs = await listTechnicians(restaurantId);
  return techs.some((t) => t.id === assignedTo);
}

export async function enregistrerIntervention(input: {
  id: string;
  workDone: string;
  assignedTo: string | null;
}): Promise<InterventionResult> {
  const intervention = await getIntervention(input.id);
  if (!intervention || intervention.status !== "en_cours") {
    return { ok: false, error: "Intervention introuvable ou déjà clôturée." };
  }
  if (!(await checkAssignee(intervention.restaurant.id, input.assignedTo))) {
    return { ok: false, error: "Ce technicien n'a pas accès à ce restaurant." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interventions")
    .update({ work_done: input.workDone.trim() || null, assigned_to: input.assignedTo })
    .eq("id", input.id)
    .select("id");
  if (error) return { ok: false, error: "L'enregistrement a échoué. Réessayez." };
  // Aucune ligne modifiée : les RLS ont refusé (lecteur).
  if (!data || data.length === 0) {
    return { ok: false, error: "Votre rôle ne permet pas de modifier cette intervention." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Enregistré." };
}

export async function cloturerIntervention(input: {
  id: string;
  workDone: string;
  stateAfter: EquipmentState;
  assignedTo: string | null;
  parts: { partId: string; quantity: number }[];
}): Promise<InterventionResult> {
  if (!input.workDone.trim()) {
    return { ok: false, error: "Décrivez ce qui a été fait : cela alimente la fiche de vie." };
  }
  if (input.parts.some((p) => !Number.isInteger(p.quantity) || p.quantity <= 0)) {
    return { ok: false, error: "Chaque pièce utilisée doit avoir une quantité d'au moins 1." };
  }
  const intervention = await getIntervention(input.id);
  if (!intervention) return { ok: false, error: "Intervention introuvable." };
  if (!(await checkAssignee(intervention.restaurant.id, input.assignedTo))) {
    return { ok: false, error: "Ce technicien n'a pas accès à ce restaurant." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cloturer_intervention", {
    p_intervention_id: input.id,
    p_work_done: input.workDone.trim(),
    p_state_after: input.stateAfter,
    p_assigned_to: input.assignedTo,
    p_parts: input.parts.map((p) => ({ part_id: p.partId, quantity: p.quantity })),
  });
  if (error) {
    // 42501 (droits), P0002 (déjà clôturée), 23514 (stock insuffisant), 22023 (quantité) :
    // messages SQL déjà en français.
    const known = ["42501", "P0002", "23514", "22023"].includes(error.code ?? "");
    return { ok: false, error: known ? error.message : "La clôture a échoué. Réessayez." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Intervention clôturée." };
}
