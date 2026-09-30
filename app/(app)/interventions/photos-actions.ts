"use server";

// Photos d'une intervention.
// - enregistrerPhotos : après le dépôt des fichiers dans Storage (depuis le navigateur),
//   enregistre chaque photo par la fonction SQL ajouter_photo_intervention (rôle, restaurant,
//   statut, limite par type, verrou). Les fichiers refusés sont retirés du bucket.
// - supprimerPhoto : retire la ligne (RLS : auteur, propriétaire, éditeur) puis le fichier.
// Vérifications côté serveur en plus de la base : profil, intervention lue avec les droits
// de l'utilisateur (donc restaurant accessible), rôle et statut, chemins dans le bon dossier.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getIntervention } from "@/lib/interventions";
import { getProfile } from "@/lib/session";
import { canSetStatus, isOpen } from "@/lib/intervention-status";
import { PHOTOS_MAX_PAR_TYPE, PHOTO_BUCKET, isPhotoKind, isPhotoPathOf, type PhotoKind } from "@/lib/photos";

export async function enregistrerPhotos(input: {
  interventionId: string;
  kind: PhotoKind;
  paths: string[];
}): Promise<{ saved: number; error?: string }> {
  const supabase = await createClient();
  const paths = Array.isArray(input.paths) ? input.paths.slice(0, PHOTOS_MAX_PAR_TYPE) : [];
  // Retire du bucket les fichiers déposés mais non enregistrés (politique Storage : leur
  // auteur, propriétaire, éditeur). Un chemin déjà enregistré n'est jamais retiré ici.
  const removeUnregistered = async (candidates: string[]) => {
    const valid = candidates.filter((p) => typeof p === "string");
    if (valid.length === 0) return;
    const { data: known, error } = await supabase
      .from("intervention_photos")
      .select("storage_path")
      .in("storage_path", valid);
    if (error) return;
    const registered = new Set((known ?? []).map((k) => k.storage_path as string));
    const orphans = valid.filter((p) => !registered.has(p));
    if (orphans.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(orphans);
  };
  const refuse = async (error: string) => {
    await removeUnregistered(paths);
    return { saved: 0, error };
  };

  const profile = await getProfile();
  if (!profile) return refuse("Connexion requise.");
  if (!isPhotoKind(input.kind)) return refuse("Type de photo inconnu.");
  const intervention = await getIntervention(input.interventionId);
  if (!intervention) return refuse("Intervention introuvable.");
  if (input.kind === "avant" && !isOpen(intervention.status)) {
    return refuse("Intervention clôturée : ajoutez plutôt une photo « après ».");
  }
  if (input.kind === "apres") {
    if (!canSetStatus(profile.role)) return refuse("Votre rôle ne permet pas d'ajouter une photo « après ».");
    if (isOpen(intervention.status)) return refuse("Les photos « après » s'ajoutent une fois l'intervention clôturée.");
  }
  if (!paths.every((p) => isPhotoPathOf(p, intervention.restaurant.id, intervention.id))) {
    return refuse("Chemin de photo invalide.");
  }

  let saved = 0;
  let error: string | undefined;
  const failed: string[] = [];
  for (const path of paths) {
    const { error: e } = await supabase.rpc("ajouter_photo_intervention", {
      p_intervention: intervention.id,
      p_kind: input.kind,
      p_path: path,
    });
    if (e) {
      failed.push(path);
      // 23514 (limite), 42501 (droits), 22023 (statut, chemin) : messages SQL en français.
      error ??= ["23514", "42501", "22023"].includes(e.code ?? "") ? e.message : undefined;
    } else {
      saved++;
    }
  }
  await removeUnregistered(failed);

  revalidatePath("/", "layout");
  return { saved, error };
}

export async function supprimerPhoto(input: { photoId: string }): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Connexion requise." };

  const supabase = await createClient();
  // Lecture avec les droits de l'utilisateur : photo d'un restaurant accessible seulement.
  const { data: photo } = await supabase
    .from("intervention_photos")
    .select("id, storage_path, created_by, intervention_id")
    .eq("id", input.photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo introuvable." };
  const allowed = photo.created_by === profile.id || profile.role === "proprietaire" || profile.role === "editeur";
  if (!allowed) return { ok: false, error: "Seul l'auteur de la photo, un éditeur ou le propriétaire peut la retirer." };

  const { data, error } = await supabase.from("intervention_photos").delete().eq("id", photo.id).select("id");
  if (error || !data || data.length === 0) return { ok: false, error: "La photo n'a pas pu être retirée. Réessayez." };
  // Le fichier suit (politique Storage : son auteur, propriétaire, éditeur). En cas d'échec,
  // il reste dans le bucket sans être affiché.
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path as string]);

  revalidatePath("/", "layout");
  return { ok: true };
}
