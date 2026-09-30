"use client";

// Choix rapide segmente: une valeur parmi quelques-unes (ex. frequence d'entretien).
// La puce active passe en brun plein avec une coche ; les autres restent a contour.

import { Icon } from "@/components/icons";

type Option<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-2 flex-wrap">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 h-11 lg:h-10 px-3.5 rounded-full text-[14px] font-semibold whitespace-nowrap cursor-pointer border-0 ${
              active
                ? "bg-filter-active text-background"
                : "bg-surface text-text shadow-[inset_0_0_0_1.5px_var(--color-ring)]"
            }`}
          >
            {active && <Icon name="check" size={16} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
