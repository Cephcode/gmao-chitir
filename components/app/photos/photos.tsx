"use client";

// Briques d'affichage et d'ajout de photos (mobile d'abord, 3 vignettes par ligne à 390 px).
// - PhotoGrid : titre, compteur « 2/3 », vignettes, case d'ajout ou message de limite.
// - PhotoPicker : choix de photos dans un formulaire (déclaration, clôture). Les photos
//   sont compressées dès le choix (lib/photos-browser.ts) et envoyées après l'action.
// Le champ n'a pas d'attribut capture : sur téléphone, on choisit appareil photo OU galerie.
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Icon } from "@/components/icons";
import { compressPhoto, PhotoError } from "@/lib/photos-browser";
import { PHOTOS_MAX_PAR_TYPE, counterLabel, isImageType, limitMessage, takeWithinLimit } from "@/lib/photos";

export type PendingPhoto = { id: string; blob: Blob; previewUrl: string };

// Compresse les fichiers choisis, dans la limite des places restantes.
// Renvoie les photos prêtes et un message d'erreur éventuel (non image, limite, lecture).
export async function preparePhotos(files: File[], count: number, max = PHOTOS_MAX_PAR_TYPE) {
  const images = files.filter((f) => isImageType(f.type));
  const notImages = files.length - images.length;
  const { accepted, refused } = takeWithinLimit(count, images, max);
  const ready: PendingPhoto[] = [];
  const errors: string[] = [];
  if (notImages > 0) errors.push(notImages === 1 ? "Ce fichier n'est pas une image." : `${notImages} fichiers ne sont pas des images.`);
  for (const file of accepted) {
    try {
      const blob = await compressPhoto(file);
      ready.push({ id: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) });
    } catch (e) {
      errors.push(e instanceof PhotoError ? e.message : "Une photo n'a pas pu être préparée.");
    }
  }
  const limit = limitMessage(refused, max);
  if (limit) errors.push(limit);
  return { ready, error: errors.length > 0 ? errors.join(" ") : null };
}

const tile = "relative aspect-square rounded overflow-hidden bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-border)]";

export function PhotoTile({
  src,
  href,
  alt,
  onRemove,
  removeLabel,
  disabled,
}: {
  src: string | null;
  href?: string | null; // ouvre la photo en grand dans un nouvel onglet
  alt: string;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- URL signée ou blob local : next/image ne s'y prête pas.
  const img = src ? <img src={src} alt={alt} className="size-full object-cover" /> : null;
  return (
    <li className={tile}>
      {!src ? (
        <span className="size-full flex flex-col items-center justify-center gap-1 text-text-muted text-[12px] text-center px-1">
          <Icon name="camera" size={20} />
          Photo indisponible
        </span>
      ) : href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${alt} (ouvrir en grand)`} className="block size-full">
          {img}
        </a>
      ) : (
        img
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel ?? "Retirer la photo"}
          className="absolute top-0 right-0 size-11 flex items-center justify-center bg-transparent border-0 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
        >
          <span className="size-7 rounded-full bg-[rgba(34,23,15,.72)] text-white flex items-center justify-center">
            <Icon name="x" size={16} />
          </span>
        </button>
      )}
    </li>
  );
}

function AddTile({ onFiles, disabled, busy }: { onFiles: (files: File[]) => void; disabled?: boolean; busy?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <li className={`${tile} focus-within:shadow-[0_0_0_3px_var(--color-orange-selected)]`}>
      <label
        className={`size-full flex flex-col items-center justify-center gap-1 text-orange-text font-semibold text-[13px] ${
          disabled ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-border"
        }`}
      >
        <Icon name={busy ? "clock" : "camera"} size={22} />
        {busy ? "Préparation…" : "Ajouter"}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (input.current) input.current.value = ""; // pouvoir rechoisir la même photo
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
    </li>
  );
}

export function PhotoGrid({
  title,
  count,
  max = PHOTOS_MAX_PAR_TYPE,
  canAdd,
  busy,
  onFiles,
  error,
  hint,
  children,
}: {
  title: string;
  count: number;
  max?: number;
  canAdd: boolean;
  busy?: boolean;
  onFiles: (files: File[]) => void;
  error?: string | null;
  hint?: string;
  children: ReactNode; // vignettes (PhotoTile)
}) {
  const full = count >= max;
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="text-text-muted text-[13px] tabular-nums" aria-label={`${count} photo(s) sur ${max}`}>
          {counterLabel(count, max)}
        </span>
      </div>
      <ul className="list-none m-0 p-0 grid grid-cols-3 gap-2 lg:grid-cols-4">
        {children}
        {canAdd && !full && <AddTile onFiles={onFiles} disabled={busy} busy={busy} />}
      </ul>
      {canAdd && full && (
        <p className="m-0 text-text-muted text-[13px]">
          Limite atteinte : {max} photos au plus. Retirez-en une pour en ajouter une autre.
        </p>
      )}
      {hint && !error && <p className="m-0 text-text-muted text-[13px]">{hint}</p>}
      {error && (
        <p role="alert" className="m-0 flex items-start gap-1.5 text-danger text-[13px] font-semibold">
          <Icon name="xc" size={16} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// Choix de photos dans un formulaire : rien n'est envoyé ici, le parent envoie après l'action.
export function PhotoPicker({
  title,
  photos,
  setPhotos,
  disabled,
  hint,
}: {
  title: string;
  photos: PendingPhoto[];
  setPhotos: Dispatch<SetStateAction<PendingPhoto[]>>;
  disabled?: boolean;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  // Libère les aperçus au démontage du formulaire.
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const add = async (files: File[]) => {
    setBusy(true);
    setError(null);
    const { ready, error: e } = await preparePhotos(files, photos.length);
    setBusy(false);
    setError(e);
    if (ready.length > 0) setPhotos((cur) => [...cur, ...ready].slice(0, PHOTOS_MAX_PAR_TYPE));
  };
  const remove = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.previewUrl);
    setError(null);
    setPhotos((cur) => cur.filter((x) => x.id !== id));
  };

  return (
    <PhotoGrid
      title={title}
      count={photos.length}
      canAdd={!disabled}
      busy={busy}
      onFiles={add}
      error={error}
      hint={hint}
    >
      {photos.map((p, n) => (
        <PhotoTile
          key={p.id}
          src={p.previewUrl}
          alt={`${title}, photo ${n + 1}`}
          onRemove={disabled ? undefined : () => remove(p.id)}
          removeLabel={`Retirer la photo ${n + 1}`}
        />
      ))}
    </PhotoGrid>
  );
}
