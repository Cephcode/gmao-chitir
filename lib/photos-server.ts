// Photos d'intervention, côté serveur : lecture avec URL signées (bucket privé).
// Les lectures passent par les RLS (table intervention_photos et storage.objects).
// Si la table n'existe pas encore (migration pas encore poussée) ou si la lecture échoue,
// on renvoie une liste vide : la fiche s'affiche simplement sans photos.
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET, PHOTO_URL_SECONDS, type PhotoKind } from "@/lib/photos";

export type Photo = {
  id: string;
  kind: PhotoKind;
  path: string;
  createdBy: string | null;
  url: string | null; // null : fichier introuvable dans le bucket
};

export async function listPhotos(interventionId: string): Promise<Photo[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("intervention_photos")
      .select("id, kind, storage_path, created_by")
      .eq("intervention_id", interventionId)
      .order("created_at");
    if (error || !data || data.length === 0) return [];

    const rows = data as { id: string; kind: PhotoKind; storage_path: string; created_by: string | null }[];
    const { data: signed } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(
        rows.map((r) => r.storage_path),
        PHOTO_URL_SECONDS,
      );
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.error ? null : s.signedUrl]));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      path: r.storage_path,
      createdBy: r.created_by,
      url: urlByPath.get(r.storage_path) ?? null,
    }));
  } catch {
    return [];
  }
}
