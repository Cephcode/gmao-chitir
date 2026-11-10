"use client";

// Interrupteur « Supprimer les notifications lues après 7 jours » (administrateur).
// Active ou désactive la tâche hebdomadaire pg_cron ; revient en arrière si l'enregistrement échoue.
import { useState, useTransition } from "react";
import { reglerPurgeNotifications } from "@/app/(app)/admin/actions";

export function PurgeToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(false);
    startTransition(async () => {
      const res = await reglerPurgeNotifications(next);
      if (!res.ok) {
        setOn(!next);
        setError(true);
      }
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div id="purge-notifications" className="font-semibold text-[15px]">
            Supprimer les notifications lues après 7 jours
          </div>
          <div className="text-text-muted text-[13px]">
            Chaque lundi à 3 h, les notifications lues depuis plus de 7 jours sont effacées pour tous les comptes.
            Les non lues sont gardées.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="purge-notifications"
          disabled={pending}
          onClick={toggle}
          className="flex items-center justify-center min-h-11 min-w-11 p-0 bg-transparent border-0 cursor-pointer shrink-0 disabled:cursor-wait"
        >
          <span
            aria-hidden="true"
            className={`relative block w-[52px] h-8 rounded-full transition-colors ${
              on ? "bg-filter-active" : "bg-border shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]"
            }`}
          >
            <span className={`absolute top-1 size-6 rounded-full bg-surface shadow transition-all ${on ? "left-[24px]" : "left-1"}`} />
          </span>
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 pt-3 text-danger text-[14px] font-semibold">
          Le réglage n&apos;a pas pu être enregistré. Réessayez.
        </p>
      )}
    </div>
  );
}
