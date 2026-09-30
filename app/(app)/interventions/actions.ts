"use server";

// Actions sur une intervention ouverte.
// - enregistrerIntervention : travail en cours et technicien, écriture directe (RLS :
//   propriétaire, éditeur, commentateur, sur leur restaurant, intervention encore ouverte).
// - cloturerIntervention : fonction SQL cloturer_intervention, une seule transaction
//   (clôture, pièces et stock, état de la machine, fiche de vie, notifications).
// - changerStatutIntervention : fonction SQL changer_statut_intervention (statut ouvert
//   seulement, fiche de vie, notification du déclarant). « Terminée » = clôture.
// Le technicien choisi est revérifié ici : il doit avoir accès au restaurant.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getIntervention, listTechnicians } from "@/lib/interventions";
import { getProfile } from "@/lib/session";
import { STATUS_LABELS, canSetStatus, isOpen, isOpenStatus, type OpenStatus } from "@/lib/intervention-status";
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
  if (!intervention || !isOpen(intervention.status)) {
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
  // Photos « après » envoyées juste après par le formulaire : il rafraîchit lui-même la
  // fiche à la fin, pour pouvoir signaler un échec d'envoi.
  photosToFollow?: boolean;
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

  if (!input.photosToFollow) revalidatePath("/", "layout");
  return { ok: true, message: "Intervention clôturée." };
}

export async function changerStatutIntervention(input: { id: string; statut: OpenStatus }): Promise<InterventionResult> {
  if (!isOpenStatus(input.statut)) {
    return { ok: false, error: "Choisissez À planifier, En cours ou En attente de pièce. Pour terminer, clôturez." };
  }
  // Vérifications côté serveur, en plus de la fonction SQL : rôle, puis intervention
  // lue avec les droits de l'utilisateur (restaurant accessible), encore ouverte.
  const profile = await getProfile();
  if (!canSetStatus(profile?.role)) {
    return { ok: false, error: "Votre rôle ne permet pas de changer le statut." };
  }
  const intervention = await getIntervention(input.id);
  if (!intervention) return { ok: false, error: "Intervention introuvable." };
  if (!isOpen(intervention.status)) return { ok: false, error: "Cette intervention est déjà clôturée." };
  if (intervention.status === input.statut) return { ok: true, message: "Statut inchangé." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("changer_statut_intervention", {
    p_intervention: input.id,
    p_statut: input.statut,
  });
  if (error) {
    // 42501 (droits), P0002 (introuvable), 22023 et 22004 (statut) : messages SQL en français.
    const known = ["42501", "P0002", "22023", "22004"].includes(error.code ?? "");
    return { ok: false, error: known ? error.message : "Le changement de statut a échoué. Réessayez." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: `Statut : ${STATUS_LABELS[input.statut]}.` };
}
