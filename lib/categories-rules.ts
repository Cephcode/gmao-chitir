// Règles pures des catégories (écran Administration > Catégories), testées par node --test.
// Pas d'accès à la base ici : les actions serveur (app/(app)/admin/categories/actions.ts)
// s'en servent avant d'écrire, et la base garde l'unicité et le format en dernier recours.

// Icônes proposées pour une catégorie (noms de components/icons.tsx).
export const CATEGORY_ICONS = [
  { name: "fridge", label: "Réfrigérateur" },
  { name: "snow", label: "Froid" },
  { name: "flame", label: "Cuisson" },
  { name: "wind", label: "Climatisation" },
  { name: "hood", label: "Hotte" },
  { name: "bolt", label: "Électrique" },
  { name: "box", label: "Rangement" },
  { name: "store", label: "Salle, comptoir" },
  { name: "wrench", label: "Autre" },
] as const;

export type CategoryIconName = (typeof CATEGORY_ICONS)[number]["name"];

export function isCategoryIcon(v: unknown): v is CategoryIconName {
  return typeof v === "string" && CATEGORY_ICONS.some((i) => i.name === v);
}

// Lettres A à Z seulement : majuscules, accents retirés (« Réfrigération » → REFRIGERATION).
function lettres(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

// Saisie du code : 3 lettres majuscules sans accent au plus.
export function normaliserCode(saisie: string): string {
  return lettres(saisie).slice(0, 3);
}

// Code proposé depuis le nom : les 3 premières lettres (comme code_categorie_libre en SQL).
// Si ce code est pris, on garde la première lettre et on essaie d'autres lettres du nom,
// dans l'ordre (« Friteuses » : FRI pris → FRT, FRE...). Nom trop court : complété par X.
export function codeDepuisNom(nom: string, pris: Iterable<string> = []): string {
  const l = lettres(nom);
  const base = (l.slice(0, 3) + "XXX").slice(0, 3);
  const occupes = new Set(pris);
  if (!occupes.has(base) || l.length < 3) return base;
  for (let j = 1; j < l.length; j++) {
    for (let k = j + 1; k < l.length; k++) {
      const code = l[0] + l[j] + l[k];
      if (!occupes.has(code)) return code;
    }
  }
  return base;
}

export type CategorySaisie = { name: string; code: string; icon: string | null };

// Contrôle d'une saisie : renvoie le message d'erreur et le champ, ou null si tout va bien.
export function checkCategory(
  s: CategorySaisie,
): { error: string; field: "name" | "code" | "icon" } | null {
  if (!s.name.trim()) return { error: "Saisissez un nom.", field: "name" };
  if (s.name.trim().length > 60) return { error: "Nom trop long (60 caractères au plus).", field: "name" };
  if (!/^[A-Z]{3}$/.test(s.code)) return { error: "Le code fait 3 lettres majuscules, sans accent.", field: "code" };
  if (s.icon !== null && !isCategoryIcon(s.icon)) return { error: "Choisissez une icône de la liste.", field: "icon" };
  return null;
}
