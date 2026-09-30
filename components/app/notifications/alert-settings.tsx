"use client";

// « Mes alertes » : un interrupteur par type de notification.
// L'interrupteur bascule tout de suite ; il revient en arrière si l'enregistrement échoue.
import { useState, useTransition } from "react";
import { reglerAlerte } from "@/app/(app)/notifications/actions";
import type { NotificationType } from "@/lib/notifications";

export function AlertSettings({
  settings,
  initial,
}: {
  settings: { type: NotificationType; label: string; hint: string }[];
  initial: Record<NotificationType, boolean>;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = (type: NotificationType) => {
    const next = !values[type];
    setValues((v) => ({ ...v, [type]: next }));
    setError(false);
    startTransition(async () => {
      const res = await reglerAlerte(type, next);
      if (!res.ok) {
        setValues((v) => ({ ...v, [type]: !next }));
        setError(true);
      }
    });
  };

  return (
    <div className="flex flex-col divide-y divide-surface-2">
      {settings.map((s) => {
        const on = values[s.type];
        return (
          <div key={s.type} className="flex items-center gap-3 py-3">
            <div className="flex-1 min-w-0">
              <div id={`alert-${s.type}`} className="font-semibold text-[15px]">
                {s.label}
              </div>
              <div className="text-text-muted text-[13px]">{s.hint}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby={`alert-${s.type}`}
              onClick={() => toggle(s.type)}
              className={`relative w-[52px] h-8 rounded-full border-0 cursor-pointer transition-colors shrink-0 ${
                on ? "bg-filter-active" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-surface shadow transition-all ${on ? "left-[24px]" : "left-1"}`}
              />
            </button>
          </div>
        );
      })}
      {error && (
        <p role="alert" className="m-0 pt-3 text-danger text-[14px] font-semibold">
          Le réglage n&apos;a pas pu être enregistré. Réessayez.
        </p>
      )}
    </div>
  );
}
