// Statuts d'une intervention (enum intervention_status). Module sans code serveur :
// utilisable par les formulaires (client) comme par les pages.
// « Ouverte » = tout statut sauf « terminee ». « Terminée » ne s'obtient que par la
// clôture (cloturer_intervention), jamais par le sélecteur de statut.
import type { StatusKey } from "@/components/ui/status-badge";
import type { Role } from "@/lib/session";

export type InterventionStatus = "a_planifier" | "en_cours" | "en_attente_piece" | "terminee";
export type OpenStatus = Exclude<InterventionStatus, "terminee">;

export const OPEN_STATUSES: OpenStatus[] = ["a_planifier", "en_cours", "en_attente_piece"];

export const STATUS_LABELS: Record<InterventionStatus, string> = {
  a_planifier: "À planifier",
  en_cours: "En cours",
  en_attente_piece: "En attente de pièce",
  terminee: "Terminée",
};

export const STATUS_BADGE: Record<InterventionStatus, StatusKey> = {
  a_planifier: "aPlanifier",
  en_cours: "enCours",
  en_attente_piece: "enAttentePiece",
  terminee: "termine",
};

export const isOpen = (s: InterventionStatus) => s !== "terminee";

export const isOpenStatus = (v: unknown): v is OpenStatus =>
  typeof v === "string" && (OPEN_STATUSES as string[]).includes(v);

// Rôles qui choisissent le statut (déclaration) et le changent (fiche). Même règle en base.
export const canSetStatus = (role: Role | null | undefined) =>
  role === "proprietaire" || role === "editeur" || role === "commentateur";
