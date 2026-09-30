"use client";

// Recherche et puces de filtre d'une liste, entièrement dans l'URL (?q=&restaurant=…) :
// la page serveur relit les filtres ; un lien partagé ou un retour arrière retrouve la liste.
// Chaque puce est une liste native (sélecteur du téléphone) habillée en puce ;
// une puce active passe en brun plein et affiche sa valeur.
// Utilisé par Équipements, Interventions et Stock.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { focusHaloInset } from "@/components/ui/field";

export type FilterChipConfig = {
  name: string; // paramètre d'URL
  label: string;
  options: { value: string; label: string }[];
};

function FilterChip({
  config: { name, label, options },
  value,
  onChange,
}: {
  config: FilterChipConfig;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  const active = options.find((o) => o.value === value);
  return (
    <label
      className={`relative shrink-0 flex items-center h-10 rounded-full pl-3.5 pr-9 text-[14px] font-semibold cursor-pointer ${
        active
          ? "bg-filter-active text-background"
          : "bg-surface text-text shadow-[inset_0_0_0_1.5px_var(--color-ring)] hover:bg-surface-2"
      } ${focusHaloInset}`}
    >
      <span>
        {active ? (
          <>
            <span className="sr-only">{label} : </span>
            {active.label}
          </>
        ) : (
          label
        )}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="">{label} : tous</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name={active ? "xc" : "chevronDown"}
        size={16}
        className="absolute right-3 pointer-events-none"
      />
    </label>
  );
}

export function UrlFilters({
  basePath,
  searchLabel,
  searchPlaceholder,
  chips,
}: {
  basePath: string; // les filtres s'appliquent à la liste : on y revient (ferme la fiche ouverte)
  searchLabel: string;
  searchPlaceholder: string;
  chips: FilterChipConfig[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const setFilter = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    const s = params.toString();
    router.replace(`${basePath}${s ? `?${s}` : ""}`, { scroll: false });
  };

  // Recherche : mise à jour de l'URL 300 ms après la dernière frappe.
  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return;
    const t = setTimeout(() => setFilter("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <label className={`relative flex items-center h-field rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-border-strong)] ${focusHaloInset} lg:max-w-sm`}>
        <span className="sr-only">{searchLabel}</span>
        <Icon name="search" className="absolute left-3.5 text-text-muted pointer-events-none" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-full bg-transparent pl-11 pr-4 text-[16px] outline-none placeholder:text-text-muted"
        />
      </label>
      {/* Puces : défilement horizontal sur mobile, retour à la ligne sur ordinateur */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible">
        {chips.map((c) => (
          <FilterChip
            key={c.name}
            config={c}
            value={searchParams.get(c.name) ?? ""}
            onChange={setFilter}
          />
        ))}
      </div>
    </div>
  );
}
