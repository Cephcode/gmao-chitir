"use server";

// Actions des consommables (stock des restaurants). Droits vérifiés en base :
// - fiche article : RLS (propriétaire, éditeur ; suppression propriétaire) ;
// - quantités et seuils : uniquement via les fonctions SQL mouvement_article,
//   inventaire_article, transferer_article, regler_seuil_article, ne_plus_suivre_article
//   (rôle et restaurant vérifiés, jamais négatif, trace, alerte au franchissement du seuil).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normaliserCode, verifierArticle, verifierOperation, type Operation } from "@/lib/consommables-rules";

export type ConsoResult = { ok: true; message: string } | { ok: false; error: string; field?: string } | null;

function sqlMessage(error: { code?: string; message: string }, defaut: string) {
  if (["42501", "22004", "22023", "23514", "P0002"].includes(error.code ?? "")) return error.message;
  return defaut;
}

// 23505 : code ou désignation déjà pris (index articles_nom_unique).
function doublon(error: { code?: string; message: string }): ConsoResult {
  return error.message.includes("articles_nom_unique")
    ? { ok: false, error: "Un article porte déjà cette désignation.", field: "name" }
    : { ok: false, error: "Ce code est déjà utilisé par un autre article.", field: "code" };
}

export type ArticleInput = {
  id: string | null; // null = création
  name: string;
  code: string;
  famille: string;
  unit: string;
  defaultThreshold: number;
  notes: string;
};

export async function enregistrerArticle(input: ArticleInput): Promise<ConsoResult> {
  const invalide = verifierArticle(input);
  if (invalide) return { ok: false, ...invalide };

  const supabase = await createClient();
  const fields = {
    name: input.name.trim(),
    code: normaliserCode(input.code),
    famille: input.famille,
    unit: input.unit,
    default_threshold: input.defaultThreshold,
    notes: input.notes.trim() || null,
  };

  let id = input.id;
  if (id) {
    const { data, error } = await supabase.from("articles").update(fields).eq("id", id).select("id");
    if (error) return error.code === "23505" ? doublon(error) : { ok: false, error: sqlMessage(error, "L'enregistrement a échoué.") };
    if (!data?.length) return { ok: false, error: "Votre rôle ne permet pas de modifier le catalogue." };
  } else {
    const { data, error } = await supabase.from("articles").insert(fields).select("id").single();
    if (error) {
      if (error.code === "23505") return doublon(error);
      if (error.code === "42501") return { ok: false, error: "Votre rôle ne permet pas d'ajouter un article." };
      return { ok: false, error: sqlMessage(error, "La création a échoué.") };
    }
    id = data.id as string;
  }

  revalidatePath("/", "layout");
  redirect(`/consommables/${id}`);
}

export async function supprimerArticle(id: string): Promise<ConsoResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("articles").delete().eq("id", id).select("id");
  if (error) {
    // 23503 : l'article a des mouvements (clé étrangère restrict).
    return {
      ok: false,
      error:
        error.code === "23503"
          ? "Cet article a un historique de stock : on le garde. Ramenez plutôt ses quantités à 0."
          : "La suppression a échoué.",
    };
  }
  if (!data?.length) return { ok: false, error: "Seul un propriétaire peut supprimer un article." };
  revalidatePath("/", "layout");
  redirect("/consommables");
}

export type OperationInput = {
  articleId: string;
  operation: Operation;
  restaurantId: string;
  quantite: number;
  versId: string | null; // transfert
  note: string;
};

// Livraison, consommation, perte, inventaire, transfert ou réglage du seuil.
export async function operationArticle(input: OperationInput): Promise<ConsoResult> {
  const invalide = verifierOperation(input);
  if (invalide) return { ok: false, ...invalide };

  const supabase = await createClient();
  const note = input.note.trim() || null;
  const q = input.quantite;
  let message: string;
  let error: { code?: string; message: string } | null = null;

  switch (input.operation) {
    case "livraison":
    case "consommation":
    case "perte": {
      const res = await supabase.rpc("mouvement_article", {
        p_article: input.articleId,
        p_restaurant: input.restaurantId,
        p_raison: input.operation,
        p_quantite: q,
        p_note: note,
      });
      error = res.error;
      message =
        input.operation === "livraison"
          ? `Livraison enregistrée (+${q}).`
          : input.operation === "consommation"
            ? `Consommation enregistrée (−${q}).`
            : `Perte enregistrée (−${q}).`;
      break;
    }
    case "inventaire": {
      const res = await supabase.rpc("inventaire_article", {
        p_article: input.articleId,
        p_restaurant: input.restaurantId,
        p_quantite: q,
        p_note: note,
      });
      error = res.error;
      const ecart = (res.data as number | null) ?? 0;
      message = ecart === 0 ? "Inventaire enregistré : le stock était juste." : `Inventaire enregistré (écart ${ecart > 0 ? "+" : "−"}${Math.abs(ecart)}).`;
      break;
    }
    case "transfert": {
      const res = await supabase.rpc("transferer_article", {
        p_article: input.articleId,
        p_de: input.restaurantId,
        p_vers: input.versId,
        p_quantite: q,
        p_note: note,
      });
      error = res.error;
      message = `Transfert enregistré (${q}).`;
      break;
    }
    case "seuil": {
      const res = await supabase.rpc("regler_seuil_article", {
        p_article: input.articleId,
        p_restaurant: input.restaurantId,
        p_seuil: q,
      });
      error = res.error;
      message = `Seuil d'alerte réglé à ${q}.`;
      break;
    }
  }

  if (error) return { ok: false, error: sqlMessage(error, "L'opération n'a pas pu être enregistrée.") };
  revalidatePath("/", "layout");
  return { ok: true, message };
}

// Ne plus suivre l'article dans un restaurant (quantité à 0 seulement).
export async function arreterSuivi(articleId: string, restaurantId: string): Promise<ConsoResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ne_plus_suivre_article", { p_article: articleId, p_restaurant: restaurantId });
  if (error) return { ok: false, error: sqlMessage(error, "L'opération n'a pas pu être enregistrée.") };
  revalidatePath("/", "layout");
  return { ok: true, message: "L'article n'est plus suivi dans ce restaurant." };
}
