// Interventions : lecture, filtres, techniciens possibles et pièces du stock.
// Toutes les lectures passent par les RLS (chacun ne voit que ses restaurants).
// Filtres appliqués en mémoire côté serveur (volume faible).
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/session";
import type { StatusKey } from "@/components/ui/status-badge";
import type { EquipmentState } from "@/lib/equipements";

export type InterventionType = "normal" | "urgence" | "alerte";

export type InterventionRow = {
  id: string;
  type: InterventionType;
  status: "en_cours" | "terminee";
  symptoms: string[];
  description: string | null;
  reported_at: string;
  closed_at: string | null;
  work_done: string | null;
  state_after: EquipmentState | null;
  equipment_id: string | null;
  equipment_free_text: string | null;
  restaurant: { id: string; short_code: string };
  equipment: { id: string; name: string; code: string; categories: { code: string } | null } | null;
  reporter: { first_name: string | null } | null;
  assignee: { id: string; first_name: string | null } | null;
  closer: { first_name: string | null } | null;
};

export const TYPE_BADGE: Record<InterventionType, StatusKey> = {
  urgence: "urgence",
  normal: "normal",
  alerte: "alerte",
};

// Groupes de la liste « En cours », dans l'ordre d'affichage.
export const TYPE_GROUPS: { type: InterventionType; label: string }[] = [
  { type: "urgence", label: "Urgences" },
  { type: "normal", label: "Normales" },
  { type: "alerte", label: "Alertes" },
];

export const machineName = (i: InterventionRow) =>
  i.equipment?.name ?? i.equipment_free_text ?? "Machine non identifiée";

// Résumé du problème : description, sinon symptômes.
export const problem = (i: InterventionRow) =>
  i.description || i.symptoms.join(", ") || "Panne déclarée";

export type Filters = {
  statut: "en_cours" | "terminee" | "toutes";
  type: string;
  restaurant: string; // short_code
  technicien: string; // id utilisateur ou « aucun »
  q: string;
};

export function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const statut = get("statut");
  return {
    statut: statut === "terminee" || statut === "toutes" ? statut : "en_cours",
    type: get("type"),
    restaurant: get("restaurant"),
    technicien: get("technicien"),
    q: get("q").trim(),
  };
}

// Requête des filtres, sans le statut par défaut (en_cours).
export function filtersQuery(f: Filters, override: Partial<Filters> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...override })) {
    if (v && !(k === "statut" && v === "en_cours")) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Filtres hors statut (le statut sert aux onglets, dont on affiche les compteurs).
export function applyFilters(rows: InterventionRow[], f: Filters): InterventionRow[] {
  const q = normalize(f.q);
  return rows.filter((i) => {
    if (f.type && i.type !== f.type) return false;
    if (f.restaurant && i.restaurant.short_code !== f.restaurant) return false;
    if (f.technicien === "aucun" ? i.assignee : f.technicien && i.assignee?.id !== f.technicien)
      return false;
    if (q && !normalize(`${machineName(i)} ${i.equipment?.code ?? ""} ${problem(i)}`).includes(q))
      return false;
    return true;
  });
}

const TYPE_ORDER: Record<InterventionType, number> = { urgence: 0, normal: 1, alerte: 2 };

const SELECT =
  "id, type, status, symptoms, description, reported_at, closed_at, work_done, state_after, " +
  "equipment_id, equipment_free_text, restaurant:restaurants(id, short_code), " +
  "equipment:equipments(id, name, code, categories(code)), " +
  "reporter:users!interventions_reported_by_fkey(first_name), " +
  "assignee:users!interventions_assigned_to_fkey(id, first_name), " +
  "closer:users!interventions_closed_by_fkey(first_name)";

// En cours : urgences d'abord, puis plus récentes. Terminées : dernières clôturées d'abord.
export async function listInterventions(): Promise<InterventionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("interventions").select(SELECT);
  return ((data ?? []) as unknown as InterventionRow[]).sort((a, b) => {
    if (a.status !== b.status) return a.status === "en_cours" ? -1 : 1;
    if (a.status === "en_cours")
      return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.reported_at.localeCompare(a.reported_at);
    return (b.closed_at ?? "").localeCompare(a.closed_at ?? "");
  });
}

export async function getIntervention(id: string): Promise<InterventionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("interventions").select(SELECT).eq("id", id).maybeSingle();
  return (data as unknown as InterventionRow | null) ?? null;
}

export type Technician = { id: string; first_name: string | null; role: Role };

// Personnes pouvant intervenir sur un restaurant : propriétaire, éditeur, commentateur
// (technicien) ayant accès à ce restaurant. Sans restaurant : toutes celles visibles.
export async function listTechnicians(restaurantId?: string): Promise<Technician[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, first_name, role, all_restaurants, user_restaurants(restaurant_id)")
    .in("role", ["proprietaire", "editeur", "commentateur"]);
  type Raw = Technician & { all_restaurants: boolean; user_restaurants: { restaurant_id: string }[] };
  const order: Record<string, number> = { commentateur: 0, editeur: 1, proprietaire: 2 };
  return ((data ?? []) as Raw[])
    .filter(
      (u) =>
        !restaurantId ||
        u.all_restaurants ||
        u.user_restaurants.some((ur) => ur.restaurant_id === restaurantId),
    )
    .map(({ id, first_name, role }) => ({ id, first_name, role }))
    .sort(
      (a, b) =>
        order[a.role] - order[b.role] || (a.first_name ?? "").localeCompare(b.first_name ?? "", "fr"),
    );
}

export type StockPart = {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  min_threshold: number;
  planned: boolean; // pièce prévue pour cette machine (« va avec »)
};

// Pièces du stock (global), celles prévues pour la machine en tête.
export async function listPartsFor(equipmentId: string | null): Promise<StockPart[]> {
  const supabase = await createClient();
  const [partsRes, compatRes] = await Promise.all([
    supabase.from("parts").select("id, code, name, unit, quantity, min_threshold").order("name"),
    equipmentId
      ? supabase.from("part_compatibilities").select("part_id").eq("equipment_id", equipmentId)
      : Promise.resolve({ data: [] as { part_id: string }[] }),
  ]);
  const planned = new Set(((compatRes.data ?? []) as { part_id: string }[]).map((c) => c.part_id));
  return ((partsRes.data ?? []) as Omit<StockPart, "planned">[])
    .map((p) => ({ ...p, planned: planned.has(p.id) }))
    .sort((a, b) => Number(b.planned) - Number(a.planned));
}

// Pièces consommées par une intervention clôturée.
export async function listUsedParts(interventionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("intervention_parts")
    .select("quantity, parts(name, code)")
    .eq("intervention_id", interventionId);
  return (data ?? []) as unknown as { quantity: number; parts: { name: string; code: string } | null }[];
}

// Données de la liste : lignes filtrées (onglet compris), compteurs des onglets
// (calculés avec les autres filtres), restaurants et techniciens pour les puces.
export async function loadInterventionList(f: Filters) {
  const supabase = await createClient();
  const [all, restaurantsRes, technicians] = await Promise.all([
    listInterventions(),
    supabase.from("restaurants").select("short_code").order("short_code"),
    listTechnicians(),
  ]);
  const filtered = applyFilters(all, f);
  return {
    rows: f.statut === "toutes" ? filtered : filtered.filter((i) => i.status === f.statut),
    counts: {
      en_cours: filtered.filter((i) => i.status === "en_cours").length,
      terminee: filtered.filter((i) => i.status === "terminee").length,
      toutes: filtered.length,
    },
    restaurants: (restaurantsRes.data ?? []) as { short_code: string }[],
    technicians,
  };
}
