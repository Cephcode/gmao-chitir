// Icône d'un équipement selon le code de sa catégorie (repère visuel dans les listes).
import type { IconName } from "@/components/icons";

const BY_CATEGORY: Record<string, IconName> = {
  REF: "fridge", // Réfrigération
  CUI: "flame", // Cuisson
  CLI: "wind", // Climatisation
  VEN: "hood", // Ventilation
  VIT: "fridge", // Vitrine
  BOI: "snow", // Boissons
};

export function categoryIcon(code: string | null | undefined): IconName {
  return (code && BY_CATEGORY[code]) || "wrench";
}
