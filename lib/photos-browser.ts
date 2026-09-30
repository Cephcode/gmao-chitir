// Photos d'intervention, côté navigateur seulement : compression puis envoi.
// - compressPhoto : redimensionne à PHOTO_MAX_DIMENSION px sur le grand côté et réencode en
//   JPEG (qualité 0,8, puis moins si le fichier dépasse PHOTO_MAX_BYTES). L'orientation
//   EXIF des téléphones est appliquée (imageOrientation: "from-image").
// - sendPhotos : dépose les fichiers directement dans Supabase Storage (client navigateur,
//   politiques du bucket « photos »), sans passer par une action serveur (pas de limite de
//   taille des actions), puis les enregistre par l'action serveur enregistrerPhotos, qui
//   revérifie le rôle et le restaurant.
import { createClient } from "@/lib/supabase/client";
import { enregistrerPhotos } from "@/app/(app)/interventions/photos-actions";
import {
  PHOTO_BUCKET,
  PHOTO_JPEG_QUALITIES,
  PHOTO_MAX_BYTES,
  isImageType,
  photoPath,
  randomId,
  resizeDimensions,
  type PhotoKind,
} from "@/lib/photos";

export class PhotoError extends Error {}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Navigateur ancien ou option non prise en charge : on passe par une balise image.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function compressPhoto(file: File): Promise<Blob> {
  if (!isImageType(file.type)) throw new PhotoError("Ce fichier n'est pas une image.");
  let image;
  try {
    image = await decode(file);
  } catch {
    throw new PhotoError("Cette image ne peut pas être lue. Essayez une photo JPEG ou PNG.");
  }
  try {
    const { width, height } = resizeDimensions(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoError("La photo n'a pas pu être préparée.");
    ctx.fillStyle = "#fff"; // fond blanc pour les images transparentes (PNG)
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image.source, 0, 0, width, height);
    for (const q of PHOTO_JPEG_QUALITIES) {
      const blob = await toJpeg(canvas, q);
      if (blob && blob.size <= PHOTO_MAX_BYTES) return blob;
    }
    throw new PhotoError("Photo trop lourde, même compressée. Choisissez-en une autre.");
  } finally {
    image.close();
  }
}

// Envoie les photos d'une intervention. Renvoie le nombre de photos non enregistrées.
export async function sendPhotos(
  restaurantId: string,
  interventionId: string,
  kind: PhotoKind,
  blobs: Blob[],
): Promise<{ failed: number; error?: string }> {
  if (blobs.length === 0) return { failed: 0 };
  const storage = createClient().storage.from(PHOTO_BUCKET);
  const uploaded: string[] = [];
  for (const blob of blobs) {
    const path = photoPath(restaurantId, interventionId, randomId());
    const { error } = await storage.upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (!error) uploaded.push(path);
  }
  if (uploaded.length === 0) return { failed: blobs.length };
  try {
    const res = await enregistrerPhotos({ interventionId, kind, paths: uploaded });
    return { failed: blobs.length - res.saved, error: res.error };
  } catch {
    // Action injoignable (réseau) : on retire les fichiers déposés pour ne pas les laisser orphelins.
    await storage.remove(uploaded).catch(() => {});
    return { failed: blobs.length };
  }
}
