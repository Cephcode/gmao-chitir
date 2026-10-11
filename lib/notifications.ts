// Notifications : les siennes uniquement (RLS). Elles sont créées par les fonctions SQL
// (panne, urgence, changement de statut, clôture, stock bas) et, plus tard, par la tâche quotidienne (entretiens).
import { createClient } from "@/lib/supabase/server";
import { aujourdhui, dateCourte, plusJours } from "@/lib/format";
import type { IconName } from "@/components/icons";

export type NotificationType =
  | "urgence"
  | "panne"
  | "entretien_prevu"
  | "entretien_retard"
  | "stock_bas"
  | "reparation"
  | "statut_intervention"
  | "attribution";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const TYPE_STYLE: Record<NotificationType, { icon: IconName; tone: string }> = {
  urgence: { icon: "bolt", tone: "bg-danger-bg text-danger" },
  panne: { icon: "xc", tone: "bg-danger-bg text-danger" },
  entretien_prevu: { icon: "clock", tone: "bg-warning-bg text-warning" },
  entretien_retard: { icon: "clock", tone: "bg-warning-bg text-warning" },
  stock_bas: { icon: "down", tone: "bg-warning-bg text-warning" },
  reparation: { icon: "check", tone: "bg-success-bg text-success" },
  statut_intervention: { icon: "refresh", tone: "bg-info-bg text-info" },
  attribution: { icon: "user", tone: "bg-info-bg text-info" },
};

// Catégories du filtre (colonne de gauche sur ordinateur).
export const CATEGORIES: { value: string; label: string; icon: IconName; types: NotificationType[] }[] = [
  { value: "urgences", label: "Urgences", icon: "bolt", types: ["urgence"] },
  { value: "pannes", label: "Pannes", icon: "xc", types: ["panne"] },
  { value: "entretiens", label: "Entretiens", icon: "clock", types: ["entretien_prevu", "entretien_retard"] },
  { value: "stock", label: "Stock", icon: "down", types: ["stock_bas"] },
  { value: "reparations", label: "Réparations", icon: "check", types: ["reparation"] },
  { value: "suivi", label: "Suivi", icon: "refresh", types: ["statut_intervention"] },
  { value: "attributions", label: "Attribuées", icon: "user", types: ["attribution"] },
];

// Réglages « Mes alertes » : un interrupteur par type (activé par défaut).
export const SETTINGS: { type: NotificationType; label: string; hint: string }[] = [
  { type: "urgence", label: "Urgences", hint: "Tout de suite, même la nuit" },
  { type: "panne", label: "Pannes normales", hint: "Dès la déclaration" },
  { type: "entretien_prevu", label: "Entretien à prévoir", hint: "3 jours avant la date" },
  { type: "entretien_retard", label: "Entretien en retard", hint: "Chaque matin à 7 h" },
  { type: "stock_bas", label: "Stock sous le seuil", hint: "Une fois par pièce" },
  { type: "reparation", label: "Réparations", hint: "Quand une machine que j'ai signalée est réparée" },
  { type: "statut_intervention", label: "Suivi de mes pannes", hint: "Quand le statut d'une panne que j'ai signalée change" },
  { type: "attribution", label: "Interventions qui me sont attribuées", hint: "Dès qu'on me choisit comme technicien, aussi par e-mail" },
];

export async function listNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as NotificationRow[];
}

// Réglages de l'utilisateur ; un type absent de la table est activé.
export async function getSettings(): Promise<Record<NotificationType, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_settings").select("type, enabled");
  const map = Object.fromEntries(SETTINGS.map((s) => [s.type, true])) as Record<NotificationType, boolean>;
  for (const row of (data ?? []) as { type: NotificationType; enabled: boolean }[]) map[row.type] = row.enabled;
  return map;
}

const TZ = "Africa/Ouagadougou";

// Groupe d'affichage : Aujourd'hui, Hier, Cette semaine, Plus ancien.
export function dayGroup(iso: string, today = aujourdhui()) {
  const day = iso.slice(0, 10);
  if (day === today) return "Aujourd'hui";
  if (day === plusJours(today, -1)) return "Hier";
  if (day > plusJours(today, -7)) return "Cette semaine";
  return "Plus ancien";
}

// Heure (aujourd'hui), « Hier », jour de la semaine (« Sam. ») ou date courte.
export function whenLabel(iso: string, today = aujourdhui()) {
  const group = dayGroup(iso, today);
  const d = new Date(iso);
  if (group === "Aujourd'hui")
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
  if (group === "Hier") return "Hier";
  if (group === "Cette semaine") {
    const s = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: TZ }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return dateCourte(iso);
}

// Seuls les liens internes sont suivis (pas de redirection vers un autre site).
export function safeLink(link: string | null) {
  return link && link.startsWith("/") && !link.startsWith("//") ? link : "/notifications";
}
