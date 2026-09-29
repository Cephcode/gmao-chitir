"use client";

// Liste déroulante avec recherche, et création à la volée (« Ajouter « frig » comme catégorie »).
// Clavier : flèches pour parcourir, Entrée pour choisir, Échap pour fermer.
// La valeur est soit une option existante ({ id }), soit un nouveau nom ({ newName }).
import { useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";

export type ComboOption = { value: string; label: string; hint?: string };
export type ComboValue = { id: string } | { newName: string } | null;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Met en gras la partie qui correspond à la recherche (« Réfrigération »).
function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? normalize(text).indexOf(normalize(query)) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong>{text.slice(i, i + query.length)}</strong>
      {text.slice(i + query.length)}
    </>
  );
}

export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  createLabel,
  invalid = false,
}: {
  id?: string;
  options: ComboOption[];
  value: ComboValue;
  onChange: (value: ComboValue) => void;
  placeholder: string;
  // Texte de l'option de création, ex. (q) => `Ajouter « ${q} » comme catégorie`. Absent : pas de création.
  createLabel?: (query: string) => string;
  invalid?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedLabel =
    value && "id" in value
      ? (options.find((o) => o.value === value.id)?.label ?? "")
      : (value?.newName ?? "");
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = query.trim();
  const matches = useMemo(
    () => (q ? options.filter((o) => normalize(o.label).includes(normalize(q))) : options),
    [options, q],
  );
  const exact = options.some((o) => normalize(o.label) === normalize(q));
  const canCreate = Boolean(createLabel && q && !exact);
  const items = [
    ...matches.map((o) => ({ kind: "option" as const, o })),
    ...(canCreate ? [{ kind: "create" as const }] : []),
  ];

  const choose = (index: number) => {
    const item = items[index];
    if (!item) return;
    if (item.kind === "option") {
      onChange({ id: item.o.value });
      setQuery(item.o.label);
    } else {
      onChange({ newName: q });
      setQuery(q);
    }
    setOpen(false);
  };

  const border = invalid
    ? "border-danger"
    : open
      ? "border-orange shadow-[0_0_0_3px_var(--color-orange-selected)]"
      : "border-border-strong";

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2.5 h-field rounded border-[1.5px] bg-surface px-3.5 text-[16px] ${border}`}
      >
        <Icon name="search" className="text-text-muted" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Laisse passer le clic sur une option ; champ vidé = aucun choix,
            // texte tapé sans choisir = retour au choix courant.
            setTimeout(() => {
              setOpen(false);
              if (inputRef.current?.value.trim() === "") {
                setQuery("");
                onChange(null);
              } else {
                setQuery(selectedLabel);
              }
            }, 150);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              choose(active);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="flex-1 min-w-0 border-0 outline-0 bg-transparent placeholder:text-text-muted"
        />
        <Icon name={open ? "chevronUp" : "chevronDown"} />
      </div>
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1.5 max-h-72 overflow-y-auto list-none m-0 p-1.5 rounded bg-surface shadow-[0_0_0_1px_var(--color-border),0_12px_28px_rgba(43,26,16,.16)]"
        >
          {items.map((item, i) => (
            <li
              key={item.kind === "option" ? item.o.value : "__create"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center justify-between gap-3 min-h-11 px-3 rounded-sm cursor-pointer text-[15px] ${
                i === active ? "bg-orange-soft" : ""
              } ${item.kind === "create" ? "text-orange-text font-semibold" : ""}`}
            >
              {item.kind === "option" ? (
                <>
                  <span>
                    <Highlight text={item.o.label} query={q} />
                  </span>
                  {item.o.hint && <span className="text-text-muted text-[13px]">{item.o.hint}</span>}
                </>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Icon name="plus" size={18} /> {createLabel!(q)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
