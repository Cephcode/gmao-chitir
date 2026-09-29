// Stock : global et partagé par toute la chaîne (pas de restaurant sur les pièces).
// Statut calculé (sous le seuil si quantité < seuil), jamais stocké.
// Les quantités ne bougent que par des mouvements (livraison, ajustement, intervention).
import { createClient } from "@/lib/supabase/server";

export const UNITS = ["piece", "bouteille", "metre", "litre", "kg"] as const;
export type Unit = (typeof UNITS)[number];

const UNIT_LABELS: Record<string, [string, string]> = {
  piece: ["pièce", "pièces"],
  bouteille: ["bouteille", "bouteilles"],
  metre: ["mètre", "mètres"],
  litre: ["litre", "litres"],
  kg: ["kg", "kg"],
};

// « pièce » / « pièces » selon la quantité (1 pièce, 0 pièce, 2 pièces).
export function unitLabel(unit: string, n = 1) {
  const [one, many] = UNIT_LABELS[unit] ?? [unit, unit];
  return Math.abs(n) > 1 ? many : one;
}

export type PartRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  min_threshold: number;
  notes: string | null;
  // Machines prévues (« va avec »), saisies à la main.
  planned: { id: string; code: string; name: string; category: string | null }[];
};

export const isLow = (p: { quantity: number; min_threshold: number }) => p.quantity < p.min_threshold;

// Résumé « va avec » pour la liste : catégories des machines prévues, « Toutes machines » sinon.
export function plannedSummary(p: PartRow) {
  const cats = [...new Set(p.planned.map((m) => m.category).filter(Boolean))];
  return cats.length ? cats.join(", ") : "Toutes machines";
}

export type Filters = { statut: string; categorie: string; q: string };

export function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return { statut: get("statut"), categorie: get("categorie"), q: get("q").trim() };
}

export function filtersQuery(f: Filters, override: Partial<Filters> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...override })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Filtres hors statut (le statut sert aux onglets, dont on affiche les compteurs).
// categorie = nom de catégorie d'une machine prévue, ou « toutes » (pièces génériques).
export function applyFilters(rows: PartRow[], f: Filters) {
  const q = normalize(f.q);
  return rows.filter((p) => {
    if (f.categorie === "toutes" ? p.planned.length > 0 : f.categorie && !p.planned.some((m) => m.category === f.categorie))
      return false;
    if (q && !normalize(`${p.name} ${p.code}`).includes(q)) return false;
    return true;
  });
}

type RawPart = Omit<PartRow, "planned"> & {
  part_compatibilities: {
    equipments: { id: string; code: string; name: string; categories: { name: string } | null } | null;
  }[];
};

const SELECT =
  "id, code, name, unit, quantity, min_threshold, notes, " +
  "part_compatibilities(equipments(id, code, name, categories(name)))";

function toRow({ part_compatibilities, ...p }: RawPart): PartRow {
  return {
    ...p,
    planned: part_compatibilities
      .map((c) => c.equipments)
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((e) => ({ id: e.id, code: e.code, name: e.name, category: e.categories?.name ?? null }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

// Sous le seuil d'abord, puis par nom.
export async function listParts(): Promise<PartRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("parts").select(SELECT);
  return ((data ?? []) as unknown as RawPart[])
    .map(toRow)
    .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name, "fr"));
}

export async function getPart(id: string): Promise<PartRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("parts").select(SELECT).eq("id", id).maybeSingle();
  return data ? toRow(data as unknown as RawPart) : null;
}

export type Movement = {
  id: string;
  delta: number;
  reason: "livraison" | "intervention" | "ajustement";
  created_at: string;
  users: { first_name: string | null } | null;
  interventions: {
    id: string;
    equipments: { id: string; code: string; name: string } | null;
    restaurants: { short_code: string } | null;
  } | null;
};

// Derniers mouvements d'une pièce, avec l'intervention et la machine concernées.
export async function listMovements(partId: string, limit = 30): Promise<Movement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_movements")
    .select(
      "id, delta, reason, created_at, users(first_name), " +
        "interventions(id, equipments(id, code, name), restaurants(short_code))",
    )
    .eq("part_id", partId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as Movement[];
}

// Machines sur lesquelles la pièce a réellement été utilisée (déduit des interventions).
export async function listUsedOn(partId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("intervention_parts")
    .select("quantity, interventions(equipments(id, code, name))")
    .eq("part_id", partId);
  const byId = new Map<string, { id: string; code: string; name: string; quantity: number }>();
  for (const row of (data ?? []) as unknown as {
    quantity: number;
    interventions: { equipments: { id: string; code: string; name: string } | null } | null;
  }[]) {
    const e = row.interventions?.equipments;
    if (!e) continue;
    const cur = byId.get(e.id);
    byId.set(e.id, { ...e, quantity: (cur?.quantity ?? 0) + row.quantity });
  }
  return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
}

// Machines proposées dans le formulaire (« va avec ») : celles des restaurants visibles.
export async function listMachinesForPicker() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipments")
    .select("id, code, name, restaurants(short_code)")
    .order("code");
  return ((data ?? []) as unknown as {
    id: string;
    code: string;
    name: string;
    restaurants: { short_code: string } | null;
  }[]).map((e) => ({ id: e.id, code: e.code, name: e.name, restaurant: e.restaurants?.short_code ?? "" }));
}

export const canEditStock = (role: string | undefined) => role === "proprietaire" || role === "editeur";

// Données de la liste : lignes filtrées (onglet compris), total, nombre sous le seuil
// (avec les autres filtres) et catégories proposées dans la puce « Va avec ».
export async function loadStockList(f: Filters) {
  const all = await listParts();
  const filtered = applyFilters(all, f);
  const categories = [...new Set(all.flatMap((p) => p.planned.map((m) => m.category)).filter(Boolean))] as string[];
  return {
    rows: f.statut === "sous_seuil" ? filtered.filter(isLow) : filtered,
    total: all.length,
    lowCount: filtered.filter(isLow).length,
    categories: categories.sort((a, b) => a.localeCompare(b, "fr")),
  };
}
