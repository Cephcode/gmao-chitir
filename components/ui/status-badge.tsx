// Badge de statut: toujours couleur + icone + texte ensemble.
// Regle d'accessibilite: chaque statut a sa propre icone, pour se distinguer
// sans lire la couleur (daltonisme, ecran en plein soleil).

import { Icon, type IconName } from "@/components/icons";

// Familles de couleur. neutralOutline (contour) sert au type "Normal", volontairement
// discret pour que "Urgence" ressorte.
type Family = "success" | "danger" | "info" | "warning" | "neutral" | "neutralOutline";

const familyClasses: Record<Family, string> = {
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  neutral: "bg-neutral-bg text-neutral",
  neutralOutline: "bg-surface text-neutral shadow-[inset_0_0_0_1px_var(--color-ring)]",
};

// Registre des statuts de l'application (equipement, entretien, intervention, stock).
// La cle est le statut metier ; on centralise ici l'icone et la couleur de chacun.
export const statuses = {
  // Equipement
  operationnel: { label: "Opérationnel", icon: "check", family: "success" },
  enPanne: { label: "En panne", icon: "xc", family: "danger" },
  enMaintenance: { label: "En maintenance", icon: "wrench", family: "info" },
  horsService: { label: "Hors service", icon: "ban", family: "neutral" },
  // Entretien
  aJour: { label: "À jour", icon: "check", family: "success" },
  enRetard: { label: "En retard", icon: "clock", family: "warning" },
  // Intervention
  enCours: { label: "En cours", icon: "refresh", family: "info" },
  termine: { label: "Terminé", icon: "check", family: "success" },
  urgence: { label: "Urgence", icon: "bolt", family: "danger" },
  normal: { label: "Normal", icon: "wrench", family: "neutralOutline" },
  // Type alerte : badge neutre (décision : pas de couleur de danger pour une alerte)
  alerte: { label: "Alerte", icon: "alert", family: "neutral" },
  // Stock
  suffisant: { label: "Suffisant", icon: "check", family: "success" },
  sousLeSeuil: { label: "Sous le seuil", icon: "down", family: "warning" },
} satisfies Record<string, { label: string; icon: IconName; family: Family }>;

export type StatusKey = keyof typeof statuses;

// label remplace le texte par défaut en gardant couleur et icône (ex. « 2 en panne »).
export function StatusBadge({ status, label: customLabel }: { status: StatusKey; label?: string }) {
  const { label: defaultLabel, icon, family } = statuses[status];
  const label = customLabel ?? defaultLabel;
  return (
    <span
      className={`inline-flex items-center gap-1 h-6 pl-[7px] pr-[9px] rounded-full text-[12.5px] font-semibold leading-none whitespace-nowrap ${familyClasses[family]}`}
    >
      <Icon name={icon} size={14} strokeWidth={2.4} />
      {label}
    </span>
  );
}
