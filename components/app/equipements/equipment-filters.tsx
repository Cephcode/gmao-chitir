"use client";

// Recherche et filtres de la liste d'équipements. Tout passe par l'URL
// (?q=&restaurant=&categorie=&etat=&entretien=) : la page serveur relit les filtres,
// un lien partagé ou un retour arrière retrouve la même liste.
// Chaque filtre est une liste native (sélecteur du téléphone) habillée en puce ;
// une puce active passe en brun plein et affiche sa valeur.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";

type Option = { value: string; label: string };

function FilterChip({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: Option[];
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
      } focus-within:outline-2 focus-within:outline-orange`}
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

export function EquipmentFilters({
  restaurants,
  categories,
}: {
  restaurants: { short_code: string; name: string }[];
  categories: { code: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Les filtres s'appliquent à la liste : on revient sur /equipements (ferme la fiche ouverte).
  const push = (params: URLSearchParams) => {
    const s = params.toString();
    router.replace(`/equipements${s ? `?${s}` : ""}`, { scroll: false });
  };

  const setFilter = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    push(params);
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
      <label className="relative flex items-center h-field rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-border-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--color-orange)] lg:max-w-sm">
        <span className="sr-only">Rechercher un équipement</span>
        <Icon name="search" className="absolute left-3.5 text-text-muted pointer-events-none" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom ou code : frigo, CTR1-FRG…"
          className="w-full h-full bg-transparent pl-11 pr-4 text-[16px] outline-none placeholder:text-text-muted"
        />
      </label>
      {/* Puces : défilement horizontal sur mobile, retour à la ligne sur ordinateur */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible">
        {restaurants.length > 1 && (
          <FilterChip
            name="restaurant"
            label="Restaurant"
            value={searchParams.get("restaurant") ?? ""}
            onChange={setFilter}
            options={restaurants.map((r) => ({ value: r.short_code, label: r.short_code }))}
          />
        )}
        <FilterChip
          name="categorie"
          label="Catégorie"
          value={searchParams.get("categorie") ?? ""}
          onChange={setFilter}
          options={categories.map((c) => ({ value: c.code, label: c.name }))}
        />
        <FilterChip
          name="etat"
          label="État"
          value={searchParams.get("etat") ?? ""}
          onChange={setFilter}
          options={[
            { value: "pas_operationnel", label: "Pas opérationnel" },
            { value: "en_panne", label: "En panne" },
            { value: "en_maintenance", label: "En maintenance" },
            { value: "hors_service", label: "Hors service" },
            { value: "operationnel", label: "Opérationnel" },
          ]}
        />
        <FilterChip
          name="entretien"
          label="Entretien"
          value={searchParams.get("entretien") ?? ""}
          onChange={setFilter}
          options={[
            { value: "en_retard", label: "En retard" },
            { value: "a_jour", label: "À jour" },
            { value: "a_definir", label: "À définir" },
          ]}
        />
      </div>
    </div>
  );
}
