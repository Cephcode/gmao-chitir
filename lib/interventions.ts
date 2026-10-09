// Interventions : lecture, filtres, techniciens possibles et pièces du stock.
// Toutes les lectures passent par les RLS (chacun ne voit que ses restaurants).
// Filtres appliqués en mémoire côté serveur (volume faible).
import { createClient } from "@/lib/supabase/server";
import { nomPersonne } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/session";
import type { ComboOption } from "@/components/ui/combobox";
import type { StatusKey } from "@/components/ui/status-badge";
import type { EquipmentState } from "@/lib/equipements";
import { isOpen, isOpenStatus, type InterventionStatus, type OpenStatus } from "@/lib/intervention-status";

export type InterventionType = "normal" | "urgence" | "alerte";
// Type d'intervention (colonne kind) : réparation d'une panne, entretien, contrôle, amélioration.
export type InterventionKind = "correctif" | "preventif" | "controle" | "amelioration";

export const KIND_LABELS: Record<InterventionKind, string> = {
  correctif: "Réparation",
  preventif: "Entretien préventif",
  controle: "Contrôle",
  amelioration: "Installation ou amélioration",
};
export const KINDS = Object.keys(KIND_LABELS) as InterventionKind[];
export const isKind = (v: unknown): v is InterventionKind =>
  typeof v === "string" && (KINDS as string[]).includes(v);

export type InterventionRow = {
  id: string;
  type: InterventionType;
  kind: InterventionKind | null; // null : anciennes pannes, traitées comme réparation
  status: InterventionStatus;
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
  reporter: { first_name: string | null; email: string | null } | null;
  assignee: { id: string; first_name: string | null; email: string | null } | null;
  closer: { first_name: string | null; email: string | null } | null;
};

export const TYPE_BADGE: Record<InterventionType, StatusKey> = {
  urgence: "urgence",
  normal: "normal",
  alerte: "alerte",
};

// Groupes de la liste « Ouvertes », dans l'ordre d'affichage.
export const TYPE_GROUPS: { type: InterventionType; label: string }[] = [
  { type: "urgence", label: "Urgences" },
  { type: "normal", label: "Normales" },
  { type: "alerte", label: "Alertes" },
];

export const machineName = (i: InterventionRow) =>
  i.equipment?.name ?? i.equipment_free_text ?? "Machine non identifiée";

export const kindOf = (i: Pick<InterventionRow, "kind">): InterventionKind => i.kind ?? "correctif";

// Résumé du problème : description, sinon symptômes, sinon le type.
export const problem = (i: InterventionRow) =>
  i.description ||
  i.symptoms.join(", ") ||
  (kindOf(i) === "correctif" ? "Panne déclarée" : KIND_LABELS[kindOf(i)]);

// Onglet « statut » : ouvertes (tout sauf terminée, par défaut), terminées ou toutes.
// Puce « etat » : un statut ouvert précis (À planifier, En cours, En attente de pièce).
export type Filters = {
  statut: "ouvertes" | "terminee" | "toutes";
  etat: OpenStatus | "";
  type: string; // priorité : urgence, normal, alerte
  nature: InterventionKind | "";
  restaurant: string; // short_code
  technicien: string; // id utilisateur ou « aucun »
  q: string;
};

export function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const statut = get("statut");
  return {
    // Anciens liens ?statut=en_cours : onglet « Ouvertes ».
    statut: statut === "terminee" || statut === "toutes" ? statut : "ouvertes",
    // La puce « etat » ne concerne que les interventions ouvertes.
    etat: statut !== "terminee" && isOpenStatus(get("etat")) ? (get("etat") as OpenStatus) : "",
    type: get("type"),
    nature: isKind(get("nature")) ? (get("nature") as InterventionKind) : "",
    restaurant: get("restaurant"),
    technicien: get("technicien"),
    q: get("q").trim(),
  };
}

// Requête des filtres, sans l'onglet par défaut (ouvertes).
export function filtersQuery(f: Filters, override: Partial<Filters> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...override })) {
    if (v && !(k === "statut" && v === "ouvertes")) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Filtres hors onglet (l'onglet sert aux compteurs affichés) ; la puce « etat » en fait partie.
export function applyFilters(rows: InterventionRow[], f: Filters): InterventionRow[] {
  const q = normalize(f.q);
  return rows.filter((i) => {
    if (f.etat && i.status !== f.etat) return false;
    if (f.type && i.type !== f.type) return false;
    if (f.nature && kindOf(i) !== f.nature) return false;
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
  "id, type, kind, status, symptoms, description, reported_at, closed_at, work_done, state_after, " +
  "equipment_id, equipment_free_text, restaurant:restaurants(id, short_code), " +
  "equipment:equipments(id, name, code, categories(code)), " +
  "reporter:users!interventions_reported_by_fkey(first_name, email), " +
  "assignee:users!interventions_assigned_to_fkey(id, first_name, email), " +
  "closer:users!interventions_closed_by_fkey(first_name, email)";

// Ouvertes : urgences d'abord, puis plus récentes. Terminées : dernières clôturées d'abord.
export async function listInterventions(): Promise<InterventionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("interventions").select(SELECT);
  return ((data ?? []) as unknown as InterventionRow[]).sort((a, b) => {
    if (isOpen(a.status) !== isOpen(b.status)) return isOpen(a.status) ? -1 : 1;
    if (isOpen(a.status))
      return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.reported_at.localeCompare(a.reported_at);
    return (b.closed_at ?? "").localeCompare(a.closed_at ?? "");
  });
}

export async function getIntervention(id: string): Promise<InterventionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("interventions").select(SELECT).eq("id", id).maybeSingle();
  return (data as unknown as InterventionRow | null) ?? null;
}

export type Technician = { id: string; first_name: string | null; email: string | null; role: Role };

type RawTechnician = Technician & { all_restaurants: boolean; user_restaurants: { restaurant_id: string }[] };

// Propriétaires, éditeurs et commentateurs visibles, techniciens d'abord puis par prénom.
async function fetchTechnicians(): Promise<RawTechnician[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, first_name, email, role, all_restaurants, user_restaurants(restaurant_id)")
    .in("role", ["proprietaire", "editeur", "commentateur"]);
  const order: Record<string, number> = { commentateur: 0, editeur: 1, proprietaire: 2 };
  return ((data ?? []) as RawTechnician[]).sort(
    (a, b) => order[a.role] - order[b.role] || nomPersonne(a).localeCompare(nomPersonne(b), "fr"),
  );
}

const worksOn = (u: RawTechnician, restaurantId: string) =>
  u.all_restaurants || u.user_restaurants.some((ur) => ur.restaurant_id === restaurantId);
const toTechnician = ({ id, first_name, email, role }: RawTechnician): Technician => ({ id, first_name, email, role });

// Personnes pouvant intervenir sur un restaurant : propriétaire, éditeur, commentateur
// (technicien) ayant accès à ce restaurant. Sans restaurant : toutes celles visibles.
export async function listTechnicians(restaurantId?: string): Promise<Technician[]> {
  return (await fetchTechnicians())
    .filter((u) => !restaurantId || worksOn(u, restaurantId))
    .map(toTechnician);
}

// Options du choix du technicien : prénom (sinon e-mail), rôle à droite, e-mail en
// seconde ligne (cherchable) s'il n'est pas déjà le libellé.
export const technicianOptions = (technicians: Technician[]): ComboOption[] =>
  technicians.map((t) => ({
    value: t.id,
    label: nomPersonne(t),
    hint: ROLE_LABELS[t.role],
    sub: t.email && t.email !== nomPersonne(t) ? t.email : undefined,
  }));

// Même liste pour plusieurs restaurants, en une requête (formulaire de création).
export async function listTechniciansByRestaurant(restaurantIds: string[]) {
  const all = await fetchTechnicians();
  return Object.fromEntries(
    restaurantIds.map((rid) => [rid, all.filter((u) => worksOn(u, rid)).map(toTechnician)]),
  ) as Record<string, Technician[]>;
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
    rows:
      f.statut === "toutes"
        ? filtered
        : filtered.filter((i) => (f.statut === "ouvertes" ? isOpen(i.status) : i.status === "terminee")),
    counts: {
      ouvertes: filtered.filter((i) => isOpen(i.status)).length,
      // Sans la puce « etat » (statut ouvert), qui ne concerne pas les terminées.
      terminee: applyFilters(all, { ...f, etat: "" }).filter((i) => i.status === "terminee").length,
      toutes: filtered.length,
    },
    restaurants: (restaurantsRes.data ?? []) as { short_code: string }[],
    technicians,
  };
}
