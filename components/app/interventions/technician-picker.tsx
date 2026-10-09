"use client";

// Choix du technicien : liste avec recherche, comme les autres listes (machine, catégorie).
// On tape un prénom ou un e-mail, ou on fait défiler la liste. Champ vidé = pas encore attribuée.
import { Combobox, type ComboOption } from "@/components/ui/combobox";

export function TechnicianPicker({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: ComboOption[]; // technicianOptions (lib/interventions.ts)
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <Combobox
      id={id}
      options={options}
      value={value ? { id: value } : null}
      onChange={(v) => onChange(v && "id" in v ? v.id : null)}
      placeholder="Pas encore attribuée"
    />
  );
}
