// Icône d'un équipement selon sa catégorie (repère visuel dans les listes).
// Ordre : icône choisie pour la catégorie (Administration > Catégories), sinon repère par
// code pour les catégories d'origine, sinon clé à molette.
import type { IconName } from "@/components/icons";
import { isCategoryIcon } from "@/lib/categories-rules";

const BY_CATEGORY: Record<string, IconName> = {
  REF: "fridge", // Réfrigération
  CUI: "flame", // Cuisson
  CLI: "wind", // Climatisation
  VEN: "hood", // Ventilation
  VIT: "fridge", // Vitrine
  BOI: "snow", // Boissons
};

// `icon` est absent tant que la colonne categories.icon n'existe pas (base pas encore migrée).
export type CategoryRef = { code?: string | null; icon?: string | null } | null | undefined;

export function categoryIcon(category: CategoryRef): IconName {
  if (isCategoryIcon(category?.icon)) return category.icon;
  return (category?.code && BY_CATEGORY[category.code]) || "wrench";
}
