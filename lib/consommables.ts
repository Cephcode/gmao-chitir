// Consommables (stock des restaurants) : lectures côté serveur, avec les droits de
// l'utilisateur. Les RLS limitent quantités et historique aux restaurants accessibles ;
// le catalogue (articles) est commun à la chaîne. Règles pures : lib/consommables-rules.ts.
import { createClient } from "@/lib/supabase/server";
import {
  type Filtres,
  type Raison,
  type StockLigne,
  appliquerFiltres,
  resumeArticle,
  trierArticles,
} from "@/lib/consommables-rules";

export type Restaurant = { id: string; name: string; short_code: string };

export type Article = {
  id: string;
  code: string;
  name: string;
  famille: string;
  unit: string;
  default_threshold: number;
  notes: string | null;
  stocks: StockLigne[]; // restaurants visibles qui suivent l'article
};

export type ArticleLigne = Article & { resume: ReturnType<typeof resumeArticle> };

const SELECT = "id, code, name, famille, unit, default_threshold, notes, stocks:article_stocks(restaurant_id, quantity, min_threshold)";

export const canEditConsommables = (role: string | undefined) => role === "proprietaire" || role === "editeur";

export async function listRestaurantsAccessibles(): Promise<Restaurant[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").select("id, name, short_code").order("short_code");
  return (data ?? []) as Restaurant[];
}

export async function listArticles(): Promise<Article[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("articles").select(SELECT);
  return (data ?? []) as unknown as Article[];
}

export async function getArticle(id: string): Promise<Article | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("articles").select(SELECT).eq("id", id).maybeSingle();
  return (data as unknown as Article | null) ?? null;
}

export type MouvementArticle = {
  id: string;
  delta: number;
  raison: Raison;
  note: string | null;
  created_at: string;
  restaurant_id: string;
  autre_restaurant_id: string | null;
  users: { first_name: string | null; email: string | null } | null;
};

// Derniers mouvements d'un article dans les restaurants visibles.
export async function listMouvementsArticle(articleId: string, limit = 40): Promise<MouvementArticle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("article_mouvements")
    .select("id, delta, raison, note, created_at, restaurant_id, autre_restaurant_id, users(first_name, email)")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as MouvementArticle[];
}

// Données de la liste : lignes filtrées (onglet compris), total, nombre sous le seuil
// (avec les autres filtres), restaurants proposés et restaurant choisi.
export async function chargerListe(f: Filtres) {
  const [articles, restaurants] = await Promise.all([listArticles(), listRestaurantsAccessibles()]);
  const restaurant = restaurants.find((r) => r.short_code === f.restaurant) ?? null;
  const lignes: ArticleLigne[] = trierArticles(
    appliquerFiltres(articles, f).map((a) => ({ ...a, resume: resumeArticle(a.stocks, restaurant?.id) })),
  );
  const sousSeuil = lignes.filter((a) => a.resume.statut === "sousLeSeuil");
  return {
    rows: f.statut === "sous_seuil" ? sousSeuil : lignes,
    total: articles.length,
    lowCount: sousSeuil.length,
    restaurants,
    restaurant,
  };
}
