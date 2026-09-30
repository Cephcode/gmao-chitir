// Photos d'intervention : réglages et règles pures (sans navigateur ni base), testées par
// node --test (tests/photos-rules.test.ts). Utilisables côté client comme côté serveur.
//
// LIMITE DU NOMBRE DE PHOTOS (pour en permettre plus avec un plan payant) :
// - ici : PHOTOS_MAX_PAR_TYPE ;
// - en base : la fonction SQL photos_max_par_type() (migration
//   20260930230300_photos_interventions.sql), à redéfinir dans une nouvelle migration.
// Les deux valeurs doivent rester égales : la base refuse au-delà de la sienne.

export const PHOTOS_MAX_PAR_TYPE = 3; // par intervention, pour « avant » et pour « après »

export const PHOTO_BUCKET = "photos"; // bucket Supabase Storage privé
export const PHOTO_MAX_DIMENSION = 1600; // px, sur le grand côté
export const PHOTO_JPEG_QUALITIES = [0.8, 0.7, 0.6, 0.5]; // essayées dans l'ordre
export const PHOTO_MAX_BYTES = 1_000_000; // après compression (le bucket accepte 2 Mo)
export const PHOTO_URL_SECONDS = 3600; // durée de validité d'une URL signée (1 h)

export type PhotoKind = "avant" | "apres";
export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = { avant: "Avant", apres: "Après" };
export const isPhotoKind = (v: unknown): v is PhotoKind => v === "avant" || v === "apres";

// Dimensions après réduction : le grand côté ramené à `max`, proportions gardées,
// jamais agrandie. Entiers d'au moins 1 px.
export function resizeDimensions(width: number, height: number, max = PHOTO_MAX_DIMENSION) {
  if (!(width > 0) || !(height > 0)) throw new Error("Dimensions d'image invalides");
  const ratio = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

// Un fichier choisi est-il une image ? (type MIME donné par le navigateur)
export const isImageType = (type: string | null | undefined) => typeof type === "string" && type.startsWith("image/");

// Places restantes et tri des fichiers choisis : on garde les premiers dans la limite.
export const slotsLeft = (count: number, max = PHOTOS_MAX_PAR_TYPE) => Math.max(0, max - count);

export function takeWithinLimit<T>(count: number, files: T[], max = PHOTOS_MAX_PAR_TYPE) {
  const left = slotsLeft(count, max);
  return { accepted: files.slice(0, left), refused: Math.max(0, files.length - left) };
}

export const counterLabel = (count: number, max = PHOTOS_MAX_PAR_TYPE) => `${Math.min(count, max)}/${max}`;

export function limitMessage(refused: number, max = PHOTOS_MAX_PAR_TYPE) {
  if (refused <= 0) return null;
  return `${max} photos au plus : ${refused === 1 ? "1 photo n'a pas été ajoutée" : `${refused} photos n'ont pas été ajoutées`}.`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_RE = new RegExp(`^(${UUID})/(${UUID})/${UUID}\\.jpg$`);

// Chemin d'un fichier dans le bucket : {restaurant}/{intervention}/{uuid}.jpg
// (même format que celui vérifié par les politiques Storage).
export const photoPath = (restaurantId: string, interventionId: string, fileId: string) =>
  `${restaurantId}/${interventionId}/${fileId}.jpg`.toLowerCase();

export function isPhotoPathOf(path: unknown, restaurantId: string, interventionId: string) {
  if (typeof path !== "string") return false;
  const m = PATH_RE.exec(path);
  return Boolean(m && m[1] === restaurantId.toLowerCase() && m[2] === interventionId.toLowerCase());
}

// Message quand des photos n'ont pas pu être envoyées alors que l'action principale a réussi.
export function failedPhotosMessage(failed: number, context: "declaration" | "cloture" | "fiche") {
  if (failed <= 0) return null;
  const n = failed === 1 ? "1 photo n'a pas pu être envoyée" : `${failed} photos n'ont pas pu être envoyées`;
  if (context === "declaration") return `La panne est déclarée, mais ${n}. Ajoutez-les depuis la fiche.`;
  if (context === "cloture") return `L'intervention est clôturée, mais ${n}. Ajoutez-les ci-dessous.`;
  return `${n.charAt(0).toUpperCase()}${n.slice(1)}. Réessayez.`;
}

// Nombre lu dans l'URL (?photos_echec=2) : entier de 1 à 2 x la limite, sinon 0.
export function readFailedCount(v: unknown) {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 2 * PHOTOS_MAX_PAR_TYPE ? n : 0;
}
