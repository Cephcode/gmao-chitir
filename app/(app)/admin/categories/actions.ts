"use server";

// Actions de l'écran Catégories (propriétaire et éditeur).
// On relit l'acteur en base, puis on écrit avec la session de la personne connectée : les
// RLS de categories (ajout, modification, suppression réservés au propriétaire et à
// l'éditeur) s'appliquent donc aussi. La base garde l'unicité du nom et du code, et
// refuse de supprimer une catégorie encore utilisée (clé étrangère « restrict »).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActor } from "@/lib/admin";
import { machinesParCategorie } from "@/lib/categories";
import { type CategorySaisie, checkCategory, normaliserCode } from "@/lib/categories-rules";

export type CategoryResult = { ok: false; error: string; field?: "name" | "code" | "icon" } | null;

const machinesTexte = (n: number) => `Utilisée par ${n} machine${n > 1 ? "s" : ""} : impossible de la supprimer.`;

async function acteurAutorise() {
  const actor = await getActor();
  return actor && (actor.role === "proprietaire" || actor.role === "editeur") ? actor : null;
}

export async function enregistrerCategorie(saisie: CategorySaisie & { id?: string }): Promise<CategoryResult> {
  if (!(await acteurAutorise())) return { ok: false, error: "Votre rôle ne permet pas de gérer les catégories." };
  const v = { name: saisie.name.trim(), code: normaliserCode(saisie.code), icon: saisie.icon || null };
  const invalide = checkCategory(v);
  if (invalide) return { ok: false, ...invalide };

  const supabase = await createClient();
  const { data, error } = saisie.id
    ? await supabase.from("categories").update(v).eq("id", saisie.id).select("id")
    : await supabase.from("categories").insert(v).select("id");
  if (error) {
    if (error.code === "23505") {
      return error.message.includes("categories_name_unique")
        ? { ok: false, error: "Une catégorie porte déjà ce nom.", field: "name" }
        : { ok: false, error: `Le code ${v.code} est déjà pris par une autre catégorie.`, field: "code" };
    }
    if (error.code === "23514") return { ok: false, error: "Le code fait 3 lettres majuscules, sans accent.", field: "code" };
    return { ok: false, error: "L'enregistrement a échoué. Réessayez." };
  }
  if (!data?.length) return { ok: false, error: "Catégorie introuvable ou modification refusée." };
  revalidatePath("/", "layout");
  redirect("/admin/categories");
}

export async function supprimerCategorie(id: string): Promise<CategoryResult> {
  if (!(await acteurAutorise())) return { ok: false, error: "Votre rôle ne permet pas de gérer les catégories." };
  const n = (await machinesParCategorie()).get(id) ?? 0;
  if (n > 0) return { ok: false, error: machinesTexte(n) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id");
  if (error) {
    // 23503 : une machine l'a prise entre-temps (clé étrangère « restrict »).
    return { ok: false, error: error.code === "23503" ? "Des machines l'utilisent : impossible de la supprimer." : "La suppression a échoué." };
  }
  if (!data?.length) return { ok: false, error: "Catégorie introuvable ou suppression refusée." };
  revalidatePath("/", "layout");
  redirect("/admin/categories");
}
