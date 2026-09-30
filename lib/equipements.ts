// Équipements : lecture, filtres et statut d'entretien, partagés par la liste et la fiche.
// Toutes les lectures passent par les RLS (chacun ne voit que ses restaurants).
// Les filtres sont appliqués côté serveur en mémoire : 49 équipements, volume faible.
import { createClient } from "@/lib/supabase/server";
import { aujourdhui } from "@/lib/format";
import type { StatusKey } from "@/components/ui/status-badge";

export type EquipmentState = "operationnel" | "en_panne" | "en_maintenance" | "hors_service";
export type Frequency = "mensuel" | "trimestriel" | "semestriel" | "annuel";

export type Plan = {
  task: string | null;
  frequency: Frequency;
  last_done_at: string | null;
  next_due_at: string | null;
};

export type EquipmentRow = {
  id: string;
  code: string;
  name: string;
  state: EquipmentState;
  model: string | null;
  serial_number: string | null;
  installed_at: string | null;
  restaurant: { id: string; short_code: string; name: string };
  category: { id: string; name: string; code: string; icon?: string | null } | null;
  brand: { id: string; name: string } | null;
  plan: Plan | null;
};

export const STATE_BADGE: Record<EquipmentState, StatusKey> = {
  operationnel: "operationnel",
  en_panne: "enPanne",
  en_maintenance: "enMaintenance",
  hors_service: "horsService",
};

export const STATE_LABELS: Record<EquipmentState, string> = {
  operationnel: "Opérationnel",
  en_panne: "En panne",
  en_maintenance: "En maintenance",
  hors_service: "Hors service",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  mensuel: "Tous les mois",
  trimestriel: "Tous les 3 mois",
  semestriel: "Tous les 6 mois",
  annuel: "Tous les ans",
};

// Ordre « Pannes d'abord » : ce qui demande une action remonte en tête.
const STATE_ORDER: Record<EquipmentState, number> = {
  en_panne: 0,
  en_maintenance: 1,
  hors_service: 2,
  operationnel: 3,
};

// Statut d'entretien calculé (jamais stocké) : sans plan ni échéance, « à définir ».
export type Maintenance =
  | { status: "a_definir" }
  | { status: "a_jour"; next: string }
  | { status: "en_retard"; next: string; days: number };

export function maintenanceOf(plan: Plan | null, today = aujourdhui()): Maintenance {
  if (!plan?.next_due_at) return { status: "a_definir" };
  if (plan.next_due_at >= today) return { status: "a_jour", next: plan.next_due_at };
  const days = Math.round(
    (Date.parse(today + "T00:00:00Z") - Date.parse(plan.next_due_at + "T00:00:00Z")) / 86400000,
  );
  return { status: "en_retard", next: plan.next_due_at, days };
}

// Filtres lus dans l'URL. etat accepte aussi « pas_operationnel » (panne, maintenance, hors service).
export type Filters = {
  restaurant: string; // short_code, "" = tous
  categorie: string; // code catégorie
  etat: string;
  entretien: string; // en_retard, a_jour, a_definir
  q: string;
};

export function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return {
    restaurant: get("restaurant"),
    categorie: get("categorie"),
    etat: get("etat"),
    entretien: get("entretien"),
    q: get("q").trim(),
  };
}

// Chaîne de requête des filtres actifs, pour garder les filtres d'une page à l'autre.
export function filtersQuery(f: Filters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

// Recherche insensible aux accents et à la casse (« frigo » trouve « Grand Frigo »).
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function applyFilters(rows: EquipmentRow[], f: Filters): EquipmentRow[] {
  const q = normalize(f.q);
  return rows.filter((e) => {
    if (f.restaurant && e.restaurant.short_code !== f.restaurant) return false;
    if (f.categorie && e.category?.code !== f.categorie) return false;
    if (f.etat === "pas_operationnel" ? e.state === "operationnel" : f.etat && e.state !== f.etat)
      return false;
    if (f.entretien && maintenanceOf(e.plan).status !== f.entretien) return false;
    if (q && !normalize(`${e.name} ${e.code}`).includes(q)) return false;
    return true;
  });
}

// PostgREST renvoie un objet pour une relation 1-1 et un tableau sinon : on accepte les deux.
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

// categories(*) plutôt que categories(id, name, code, icon) : la colonne icon arrive par
// migration (phase 5) et une colonne nommée absente ferait échouer toute la requête.
const EQUIPMENT_SELECT =
  "id, code, name, state, model, serial_number, installed_at, " +
  "restaurants(id, short_code, name), categories(*), brands(id, name), " +
  "maintenance_plans(task, frequency, last_done_at, next_due_at)";

type RawEquipment = Omit<EquipmentRow, "restaurant" | "category" | "brand" | "plan"> & {
  restaurants: EquipmentRow["restaurant"] | EquipmentRow["restaurant"][];
  categories: EquipmentRow["category"] | EquipmentRow["category"][];
  brands: EquipmentRow["brand"] | EquipmentRow["brand"][];
  maintenance_plans: Plan | Plan[] | null;
};

function toRow(raw: RawEquipment): EquipmentRow {
  const { restaurants, categories, brands, maintenance_plans, ...rest } = raw;
  return {
    ...rest,
    restaurant: one(restaurants)!,
    category: one(categories),
    brand: one(brands),
    plan: one(maintenance_plans),
  };
}

// Tous les équipements visibles, triés « pannes d'abord » puis par nom.
export async function listEquipments(): Promise<EquipmentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("equipments").select(EQUIPMENT_SELECT);
  return ((data ?? []) as unknown as RawEquipment[])
    .map(toRow)
    .sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name, "fr"),
    );
}

export async function getEquipment(id: string): Promise<EquipmentRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipments")
    .select(EQUIPMENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? toRow(data as unknown as RawEquipment) : null;
}

// Seuls le propriétaire et l'éditeur créent et modifient (vérifié aussi en base).
export const canEditEquipments = (role: string | undefined) =>
  role === "proprietaire" || role === "editeur";

// Listes du formulaire : restaurants accessibles (avec id), catégories et marques
// avec leur nombre d'équipements visibles (repère dans les listes déroulantes).
export async function listFormOptions(equipments: EquipmentRow[]) {
  const supabase = await createClient();
  const [r, c, b] = await Promise.all([
    supabase.from("restaurants").select("id, short_code, name").order("short_code"),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("brands").select("id, name").order("name"),
  ]);
  const count = (pick: (e: EquipmentRow) => string | undefined, id: string) =>
    equipments.filter((e) => pick(e) === id).length;
  return {
    restaurants: (r.data ?? []) as { id: string; short_code: string; name: string }[],
    categories: ((c.data ?? []) as { id: string; name: string }[]).map((x) => ({
      ...x,
      count: count((e) => e.category?.id, x.id),
    })),
    brands: ((b.data ?? []) as { id: string; name: string }[]).map((x) => ({
      ...x,
      count: count((e) => e.brand?.id, x.id),
    })),
  };
}

// Listes des filtres : restaurants accessibles et catégories.
export async function listFilterOptions() {
  const supabase = await createClient();
  const [r, c] = await Promise.all([
    supabase.from("restaurants").select("short_code, name").order("short_code"),
    supabase.from("categories").select("code, name").order("name"),
  ]);
  return {
    restaurants: (r.data ?? []) as { short_code: string; name: string }[],
    categories: (c.data ?? []) as { code: string; name: string }[],
  };
}
