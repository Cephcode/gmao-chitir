// Jeu d'icones du systeme de design (trait, 24x24, coins arrondis).
// Un seul composant Icon pour garder un rendu identique partout (largeur de trait, join).
// Chaque icone est un chemin SVG releve dans les maquettes.

import type { SVGProps } from "react";

// Chemins des icones. La cle sert de nom (ex. <Icon name="fridge" />).
export const iconPaths = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  fridge: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 10h16M8 6v1M8 13v3",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  alert: "M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  x: "M18 6L6 18M6 6l12 12",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  minus: "M5 12h14",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  check: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12.5l2.8 2.8L16 10",
  xc: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15 9l-6 6M9 9l6 6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2",
  ban: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM5.6 5.6l12.8 12.8",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  down: "M12 5v14M6 13l6 6 6-6",
  search: "M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  camera: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 9a4 4 0 1 0 0 8a4 4 0 1 0 0-8z",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  msg: "M4 5h16v11H9l-5 4z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 11v5M12 8h.01",
  alertCircle: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 8v5M12 16h.01",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0",
  store: "M4 9l1.5-5h13L20 9M4 9h16M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 11v9h14v-9M10 20v-5h4v5",
  chevronRight: "M9 6l6 6-6 6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  // Gobelet avec couvercle et paille : consommables (stock des restaurants).
  cup: "M5 7h14M6 7l1.5 14h9L18 7M7 7l.5-3h9l.5 3M13 4l2-2",
  // Deux flèches opposées : transfert entre restaurants.
  swap: "M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  // Icônes d'équipement (par catégorie)
  flame: "M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3 0-3-1-5 0-8z",
  snow: "M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M9 4l3 2 3-2M9 20l3-2 3 2",
  wind: "M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8",
  hood: "M4 20h16M6 20v-6h12v6M9 14l1-10h4l1 10",
} as const;

export type IconName = keyof typeof iconPaths;

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  // Taille en pixels (largeur = hauteur). Defaut 20, comme les icones de texte.
  size?: number;
};

// Rendu commun a toutes les icones: trait de 2, extremites et jointures arrondies.
// La couleur suit currentColor, donc l'icone prend la couleur du texte parent.
export function Icon({ name, size = 20, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
