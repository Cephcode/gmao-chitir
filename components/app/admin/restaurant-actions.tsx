"use client";

// Actions d'une carte restaurant (propriétaire) : renommer sur place, ou supprimer après
// une confirmation affichée dans la carte (pas de boîte du navigateur). Une seule action
// ouverte à la fois. Le code court ne change pas (préfixe des codes équipement).
import { useState, useTransition } from "react";
import { renommerRestaurant, supprimerRestaurant } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";

type Mode = "repos" | "renommer" | "supprimer";

export function RestaurantActions({
  id,
  name,
  shortCode,
  equipments,
}: {
  id: string;
  name: string;
  shortCode: string;
  equipments: number;
}) {
  const [mode, setMode] = useState<Mode>("repos");
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fermer() {
    setValue(name);
    setError(null);
    setMode("repos");
  }

  const erreur = error && (
    <p role="alert" className="m-0 text-danger text-[13px] font-semibold">
      {error}
    </p>
  );

  if (mode === "renommer") {
    const inputId = `nom-${id}`;
    return (
      <form
        className="flex flex-col gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await renommerRestaurant(id, value);
            if (res.ok) setMode("repos");
            else setError(res.error);
          });
        }}
      >
        <label htmlFor={inputId} className="text-[14px] font-semibold">
          Nom du restaurant {shortCode}
        </label>
        <TextInput
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={120}
          required
          autoFocus
          invalid={!!error}
        />
        <p className="m-0 text-text-muted text-[13px]">Le code {shortCode} ne change pas.</p>
        {erreur}
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" size="sm" icon="check" disabled={pending || !value.trim() || value.trim() === name}>
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={fermer}>
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "supprimer") {
    return (
      <div role="group" aria-labelledby={`suppr-${id}`} className="flex flex-col gap-2 rounded-sm bg-danger-bg p-3">
        <p id={`suppr-${id}`} className="m-0 text-[14px] font-semibold text-danger">
          Supprimer {shortCode} · {name} ?
        </p>
        <p className="m-0 text-[13px]">
          {equipments > 0
            ? `Ses ${equipments} équipement${equipments > 1 ? "s" : ""} et leur historique seront supprimés. `
            : ""}
          Cette action est définitive.
        </p>
        {erreur}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await supprimerRestaurant(id);
                if (!res.ok) setError(res.error);
              });
            }}
          >
            {pending ? "Suppression..." : "Supprimer définitivement"}
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={fermer} autoFocus>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    // mt-auto : la barre reste en bas de la carte, alignée d'une carte à l'autre quelle que
    // soit la hauteur du contenu (adresse, badges). Deux colonnes égales : boutons de même largeur.
    <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3">
      <Button variant="secondary" size="sm" icon="edit" className="w-full" onClick={() => setMode("renommer")}>
        Renommer
      </Button>
      <Button variant="dangerSoft" size="sm" icon="trash" className="w-full" onClick={() => setMode("supprimer")}>
        Supprimer
      </Button>
    </div>
  );
}
