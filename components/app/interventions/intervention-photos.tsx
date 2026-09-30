"use client";

// Photos « avant » ou « après » dans la fiche intervention : vignettes (toucher = ouvrir en
// grand dans un nouvel onglet, URL signée d'une heure), ajout immédiat et retrait.
// Les droits sont revérifiés par l'action serveur et par la base ; ici on n'affiche que
// les boutons utiles.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supprimerPhoto } from "@/app/(app)/interventions/photos-actions";
import { PhotoGrid, PhotoTile, preparePhotos } from "@/components/app/photos/photos";
import { sendPhotos } from "@/lib/photos-browser";
import { failedPhotosMessage, type PhotoKind } from "@/lib/photos";
import type { Photo } from "@/lib/photos-server";

export function InterventionPhotos({
  interventionId,
  restaurantId,
  kind,
  title,
  photos,
  canAdd,
  userId,
  canDeleteAny,
}: {
  interventionId: string;
  restaurantId: string;
  kind: PhotoKind;
  title: string;
  photos: Photo[];
  canAdd: boolean;
  userId: string;
  canDeleteAny: boolean; // propriétaire, éditeur ; sinon seulement ses propres photos
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = async (files: File[]) => {
    setBusy(true);
    setError(null);
    const { ready, error: prepError } = await preparePhotos(files, photos.length);
    let sendError: string | null = null;
    if (ready.length > 0) {
      const res = await sendPhotos(restaurantId, interventionId, kind, ready.map((p) => p.blob));
      ready.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      if (res.failed > 0) sendError = res.error ?? failedPhotosMessage(res.failed, "fiche");
      router.refresh();
    }
    setBusy(false);
    setError([prepError, sendError].filter(Boolean).join(" ") || null);
  };

  const remove = (photo: Photo, n: number) => {
    if (!window.confirm(`Retirer la photo ${n} ?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await supprimerPhoto({ photoId: photo.id });
      if (!res.ok) setError(res.error ?? "La photo n'a pas pu être retirée.");
    });
  };

  return (
    <PhotoGrid title={title} count={photos.length} canAdd={canAdd} busy={busy || pending} onFiles={add} error={error}>
      {photos.map((p, i) => (
        <PhotoTile
          key={p.id}
          src={p.url}
          href={p.url}
          alt={`${title}, photo ${i + 1}`}
          onRemove={canDeleteAny || p.createdBy === userId ? () => remove(p, i + 1) : undefined}
          removeLabel={`Retirer la photo ${i + 1}`}
          disabled={busy || pending}
        />
      ))}
    </PhotoGrid>
  );
}
