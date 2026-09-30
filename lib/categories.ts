// Catégories (Administration > Catégories) : chargement côté serveur.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CategoryAdmin = {
  id: string;
  name: string;
  code: string;
  icon: string | null;
  machines: number; // machines de TOUTE la chaîne qui l'utilisent
};

// Nombre de machines par catégorie, tous restaurants confondus. Lecture avec la clé
// secrète, car un éditeur ne voit que les machines de ses restaurants : sans cela, il
// croirait libre une catégorie utilisée ailleurs. À n'appeler qu'après avoir vérifié le
// rôle de l'acteur (propriétaire ou éditeur). Seuls des nombres sortent d'ici.
// Limite : 1000 lignes par requête (réglage PostgREST), large pour la chaîne.
export async function machinesParCategorie(): Promise<Map<string, number>> {
  const { data } = await createAdminClient()
    .from("equipments")
    .select("category_id")
    .not("category_id", "is", null);
  const n = new Map<string, number>();
  for (const e of (data ?? []) as { category_id: string }[]) n.set(e.category_id, (n.get(e.category_id) ?? 0) + 1);
  return n;
}

// Liste triée par nom. select("*") : la colonne icon peut manquer tant que la migration
// de la phase 5 n'est pas poussée (elle vaut alors null).
export async function listCategoriesAdmin(): Promise<CategoryAdmin[]> {
  const supabase = await createClient();
  const [{ data }, counts] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    machinesParCategorie(),
  ]);
  return ((data ?? []) as { id: string; name: string; code: string; icon?: string | null }[]).map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    icon: c.icon ?? null,
    machines: counts.get(c.id) ?? 0,
  }));
}
