// Consommables (stock des restaurants) : règles pures, sans base ni navigateur, testées par
// node --test (tests/consommables-rules.test.ts). Utilisables côté client comme côté serveur.
// Les mêmes règles sont appliquées en base (migration 20261009090000_consommables.sql) :
// ici, elles servent à répondre vite et clairement avant l'appel.

// Familles : identiques à l'enum article_famille.
export const FAMILLES = ["jetable", "boisson", "materiel"] as const;
export type Famille = (typeof FAMILLES)[number];
export const FAMILLE_LABELS: Record<Famille, string> = {
  jetable: "Emballages et jetables",
  boisson: "Boissons",
  materiel: "Matériel et fournitures en gros",
};
export const isFamille = (v: unknown): v is Famille => (FAMILLES as readonly unknown[]).includes(v);

// Unités : identiques à la contrainte articles_unit_check.
export const UNITES = ["piece", "paquet", "carton", "bouteille", "casier", "sac", "rouleau", "litre", "kg"] as const;
export type Unite = (typeof UNITES)[number];
const UNITE_LABELS: Record<Unite, [string, string]> = {
  piece: ["pièce", "pièces"],
  paquet: ["paquet", "paquets"],
  carton: ["carton", "cartons"],
  bouteille: ["bouteille", "bouteilles"],
  casier: ["casier", "casiers"],
  sac: ["sac", "sacs"],
  rouleau: ["rouleau", "rouleaux"],
  litre: ["litre", "litres"],
  kg: ["kg", "kg"],
};
export const isUnite = (v: unknown): v is Unite => (UNITES as readonly unknown[]).includes(v);

// « carton » / « cartons » selon la quantité (0 carton, 1 carton, 2 cartons).
export function uniteLabel(unit: string, n = 1) {
  const [one, many] = UNITE_LABELS[unit as Unite] ?? [unit, unit];
  return Math.abs(n) > 1 ? many : one;
}

// Opérations proposées sur la fiche. « seuil » règle l'alerte, sans mouvement.
export const OPERATIONS = ["livraison", "consommation", "perte", "inventaire", "transfert", "seuil"] as const;
export type Operation = (typeof OPERATIONS)[number];
export const OPERATION_LABELS: Record<Operation, string> = {
  livraison: "Livraison",
  consommation: "Consommation",
  perte: "Perte ou casse",
  inventaire: "Inventaire",
  transfert: "Transfert",
  seuil: "Seuil d'alerte",
};
// Libellé du champ quantité selon l'opération.
export const QUANTITE_LABELS: Record<Operation, string> = {
  livraison: "Quantité reçue",
  consommation: "Quantité utilisée",
  perte: "Quantité perdue ou cassée",
  inventaire: "Quantité comptée",
  transfert: "Quantité envoyée",
  seuil: "Alerter en dessous de",
};
export const isOperation = (v: unknown): v is Operation => (OPERATIONS as readonly unknown[]).includes(v);

// Raisons des mouvements (historique), identiques à l'enum article_mouvement_raison.
export type Raison = "livraison" | "consommation" | "perte" | "inventaire" | "transfert";
export const RAISON_LABELS: Record<Raison, string> = {
  livraison: "Livraison",
  consommation: "Consommation",
  perte: "Perte ou casse",
  inventaire: "Inventaire",
  transfert: "Transfert",
};

export const estSousSeuil = (s: { quantity: number; min_threshold: number }) => s.quantity < s.min_threshold;

// Code : majuscules, sans espaces ni accents (« gob 50 » → « GOB-50 »).
export function normaliserCode(code: string) {
  return code
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "-");
}
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,29}$/;

const estEntier = (n: number, min: number) => Number.isInteger(n) && n >= min;

export type Erreur = { error: string; field?: string } | null;

// Fiche article (création ou modification).
export function verifierArticle(a: {
  name: string;
  code: string;
  famille: string;
  unit: string;
  defaultThreshold: number;
  notes: string;
}): Erreur {
  const name = a.name.trim();
  if (!name) return { error: "Donnez une désignation à l'article.", field: "name" };
  if (name.length > 120) return { error: "Désignation trop longue (120 caractères au plus).", field: "name" };
  const code = normaliserCode(a.code);
  if (!code) return { error: "Donnez un code à l'article (ex. GOB-50).", field: "code" };
  if (!CODE_RE.test(code)) {
    return { error: "Code : lettres sans accent, chiffres et tirets, 30 caractères au plus.", field: "code" };
  }
  if (!isFamille(a.famille)) return { error: "Choisissez une famille.", field: "famille" };
  if (!isUnite(a.unit)) return { error: "Unité inconnue.", field: "unit" };
  if (!estEntier(a.defaultThreshold, 0)) {
    return { error: "Le seuil doit être un nombre entier, 0 ou plus.", field: "threshold" };
  }
  if (a.notes.trim().length > 500) return { error: "Remarque trop longue (500 caractères au plus).", field: "notes" };
  return null;
}

// Opération sur le stock d'un restaurant.
export function verifierOperation(o: {
  operation: string;
  restaurantId: string;
  quantite: number;
  versId?: string | null;
  note?: string;
}): Erreur {
  if (!isOperation(o.operation)) return { error: "Opération inconnue." };
  if (!o.restaurantId) return { error: "Choisissez le restaurant.", field: "restaurant" };
  // Inventaire (quantité comptée) et seuil acceptent 0 ; les mouvements, non.
  const min = o.operation === "inventaire" || o.operation === "seuil" ? 0 : 1;
  if (!estEntier(o.quantite, min)) {
    return {
      error: min === 0 ? "Indiquez un nombre entier, 0 ou plus." : "Indiquez une quantité entière, 1 ou plus.",
      field: "quantite",
    };
  }
  if (o.operation === "transfert") {
    if (!o.versId) return { error: "Choisissez le restaurant qui reçoit.", field: "vers" };
    if (o.versId === o.restaurantId) return { error: "Choisissez deux restaurants différents.", field: "vers" };
  }
  if ((o.note ?? "").trim().length > 300) return { error: "Remarque trop longue (300 caractères au plus).", field: "note" };
  return null;
}

// Écart d'un inventaire, comme la base : quantité comptée − quantité en stock.
export const ecartInventaire = (enStock: number, comptee: number) => comptee - enStock;

// ------------------------------------------------------------
// Liste : résumé d'un article selon le restaurant choisi.
// ------------------------------------------------------------
export type StockLigne = { restaurant_id: string; quantity: number; min_threshold: number };
export type Statut = "sousLeSeuil" | "suffisant" | "nonSuivi";

// restaurantId vide = tous les restaurants visibles.
// - quantité : total des lignes concernées ;
// - sousSeuil : restaurants sous le seuil ;
// - statut : non suivi (aucune ligne), sous le seuil (au moins un restaurant), suffisant.
export function resumeArticle(stocks: StockLigne[], restaurantId = "") {
  const lignes = restaurantId ? stocks.filter((s) => s.restaurant_id === restaurantId) : stocks;
  const sousSeuil = lignes.filter(estSousSeuil).map((s) => s.restaurant_id);
  const statut: Statut = lignes.length === 0 ? "nonSuivi" : sousSeuil.length ? "sousLeSeuil" : "suffisant";
  return {
    quantite: lignes.reduce((t, s) => t + s.quantity, 0),
    // Seuil affiché seulement pour un restaurant (un total de seuils n'a pas de sens).
    seuil: restaurantId && lignes[0] ? lignes[0].min_threshold : null,
    suivis: lignes.length,
    sousSeuil,
    statut,
  };
}

// ------------------------------------------------------------
// Filtres de la liste, dans l'adresse : ?q=&restaurant=CODE&famille=&statut=sous_seuil
// ------------------------------------------------------------
export type Filtres = { q: string; restaurant: string; famille: string; statut: string };

export function lireFiltres(sp: Record<string, string | string[] | undefined>): Filtres {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return {
    q: get("q").trim(),
    restaurant: get("restaurant"),
    famille: isFamille(get("famille")) ? get("famille") : "",
    statut: get("statut") === "sous_seuil" ? "sous_seuil" : "",
  };
}

export function filtresQuery(f: Filtres, override: Partial<Filtres> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...override })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

const normaliser = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Recherche et famille (le statut sert aux onglets, dont on affiche les compteurs).
export function appliquerFiltres<T extends { name: string; code: string; famille: string }>(rows: T[], f: Filtres) {
  const q = normaliser(f.q);
  return rows.filter((a) => {
    if (f.famille && a.famille !== f.famille) return false;
    if (q && !normaliser(`${a.name} ${a.code}`).includes(q)) return false;
    return true;
  });
}

// Ordre de la liste : sous le seuil d'abord, puis suivis, puis non suivis ; puis par nom.
const RANG: Record<Statut, number> = { sousLeSeuil: 0, suffisant: 1, nonSuivi: 2 };
export function trierArticles<T extends { name: string; resume: { statut: Statut } }>(rows: T[]) {
  return [...rows].sort((a, b) => RANG[a.resume.statut] - RANG[b.resume.statut] || a.name.localeCompare(b.name, "fr"));
}
