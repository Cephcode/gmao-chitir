"use client";

// Sélecteur du statut d'une intervention ouverte (propriétaire, éditeur, commentateur).
// « Terminée » n'y figure pas : on termine avec le bouton « Clôturer ».
// Le changement part tout de suite ; la page est rafraîchie par l'action serveur.
import { useState, useTransition } from "react";
import { changerStatutIntervention, type InterventionResult } from "@/app/(app)/interventions/actions";
import { OPEN_STATUSES, STATUS_LABELS, type OpenStatus } from "@/lib/intervention-status";
import { SegmentedControl } from "@/components/ui/segmented-control";

export function StatusSelector({ interventionId, status }: { interventionId: string; status: OpenStatus }) {
  const [value, setValue] = useState<OpenStatus>(status);
  const [result, setResult] = useState<InterventionResult>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: OpenStatus) => {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);
    setResult(null);
    startTransition(async () => {
      const res = await changerStatutIntervention({ id: interventionId, statut: next });
      if (res && !res.ok) setValue(previous);
      setResult(res);
    });
  };

  return (
    <section className="flex flex-col gap-2" aria-busy={pending}>
      <h2 className="m-0 font-display text-[17px] font-semibold">Statut</h2>
      <SegmentedControl
        ariaLabel="Statut de l'intervention"
        options={OPEN_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        value={value}
        onChange={change}
      />
      <p role="status" className="m-0 min-h-5 text-[14px]">
        {pending ? (
          <span className="text-text-muted">Enregistrement…</span>
        ) : result && !result.ok ? (
          <span className="text-danger font-semibold">{result.error}</span>
        ) : result?.ok ? (
          <span className="text-success font-semibold">{result.message}</span>
        ) : (
          <span className="text-text-muted">Pour terminer l&apos;intervention, utilisez « Clôturer ».</span>
        )}
      </p>
    </section>
  );
}
