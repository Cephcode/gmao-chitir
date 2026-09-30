"use server";

// Actions du stock. Droits vérifiés en base :
// - fiches pièces et « va avec » : RLS (propriétaire, éditeur ; suppression propriétaire) ;
// - quantités : uniquement via la fonction SQL mouvement_stock (jamais négatif, trace
//   dans stock_movements, alerte au franchissement du seuil).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UNITS } from "@/lib/stock";

export type StockResult = { ok: true; message: string } | { ok: false; error: string; field?: string } | null;

function sqlMessage(error: { code?: string; message: string }, defaut: string) {
  if (["42501", "22023", "23514", "P0002"].includes(error.code ?? "")) return error.message;
  if (error.code === "23505") return "Ce code est déjà utilisé par une autre pièce.";
  return defaut;
}

export type PartInput = {
  id: string | null; // null = création
  name: string;
  code: string;
  unit: string;
  minThreshold: number;
  initialQuantity: number; // création seulement
  notes: string;
  plannedIds: string[]; // machines « va avec »
};

export async function enregistrerPiece(input: PartInput): Promise<StockResult> {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name) return { ok: false, error: "Donnez un nom à la pièce.", field: "name" };
  if (!code) return { ok: false, error: "Donnez un code à la pièce (ex. FIL-FRT-01).", field: "code" };
  if (!(UNITS as readonly string[]).includes(input.unit)) return { ok: false, error: "Unité inconnue." };
  if (!Number.isInteger(input.minThreshold) || input.minThreshold < 0) {
    return { ok: false, error: "Le seuil doit être un nombre entier, 0 ou plus.", field: "threshold" };
  }
  if (!input.id && (!Number.isInteger(input.initialQuantity) || input.initialQuantity < 0)) {
    return { ok: false, error: "La quantité doit être un nombre entier, 0 ou plus.", field: "quantity" };
  }

  const supabase = await createClient();
  const fields = { name, code, unit: input.unit, min_threshold: input.minThreshold, notes: input.notes.trim() || null };

  let id = input.id;
  if (id) {
    const { data, error } = await supabase.from("parts").update(fields).eq("id", id).select("id");
    if (error) return { ok: false, error: sqlMessage(error, "L'enregistrement a échoué."), field: error.code === "23505" ? "code" : undefined };
    if (!data?.length) return { ok: false, error: "Votre rôle ne permet pas de modifier le stock." };
  } else {
    // Créée à 0, puis le stock initial entre comme une livraison : la quantité reste
    // égale à la somme des mouvements.
    const { data, error } = await supabase.from("parts").insert({ ...fields, quantity: 0 }).select("id").single();
    if (error) return { ok: false, error: sqlMessage(error, "La création a échoué."), field: error.code === "23505" ? "code" : undefined };
    id = data.id as string;
    if (input.initialQuantity > 0) {
      const mv = await supabase.rpc("mouvement_stock", { p_part_id: id, p_delta: input.initialQuantity, p_reason: "livraison" });
      if (mv.error) {
        revalidatePath("/stock", "layout");
        return { ok: false, error: "Pièce créée, mais le stock initial n'a pas été enregistré : ajoutez-le par une livraison." };
      }
    }
  }

  // « Va avec » : on ne touche qu'aux machines visibles (les RLS limitent aux restaurants de l'utilisateur).
  const { data: current } = await supabase
    .from("part_compatibilities")
    .select("equipment_id, equipments!inner(id)")
    .eq("part_id", id);
  const before = new Set(((current ?? []) as { equipment_id: string }[]).map((c) => c.equipment_id));
  const after = new Set(input.plannedIds);
  const toAdd = [...after].filter((e) => !before.has(e));
  const toRemove = [...before].filter((e) => !after.has(e));
  if (toAdd.length) {
    const { error } = await supabase
      .from("part_compatibilities")
      .insert(toAdd.map((equipment_id) => ({ part_id: id, equipment_id })));
    if (error) return { ok: false, error: "Pièce enregistrée, mais les machines « va avec » n'ont pas toutes été ajoutées." };
  }
  if (toRemove.length) {
    await supabase.from("part_compatibilities").delete().eq("part_id", id).in("equipment_id", toRemove);
  }

  revalidatePath("/", "layout");
  redirect(`/stock/${id}`);
}

export async function supprimerPiece(id: string): Promise<StockResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("parts").delete().eq("id", id).select("id");
  if (error) {
    // 23503 : pièce utilisée dans une intervention (clé étrangère restrict).
    return {
      ok: false,
      error:
        error.code === "23503"
          ? "Cette pièce a déjà servi dans une intervention : on la garde pour l'historique."
          : "La suppression a échoué.",
    };
  }
  if (!data?.length) return { ok: false, error: "Seul un propriétaire peut supprimer une pièce." };
  revalidatePath("/", "layout");
  redirect("/stock");
}

// Livraison (+quantité reçue) ou ajustement (±, correction d'inventaire).
export async function mouvementStock(input: {
  partId: string;
  delta: number;
  reason: "livraison" | "ajustement";
}): Promise<StockResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    return { ok: false, error: "Indiquez une quantité entière différente de 0." };
  }
  if (input.reason === "livraison" && input.delta < 0) {
    return { ok: false, error: "Une livraison ajoute des pièces : quantité positive." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("mouvement_stock", {
    p_part_id: input.partId,
    p_delta: input.delta,
    p_reason: input.reason,
  });
  if (error) return { ok: false, error: sqlMessage(error, "Le mouvement n'a pas pu être enregistré.") };
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: input.reason === "livraison" ? `Livraison enregistrée (+${input.delta}).` : "Stock corrigé.",
  };
}
