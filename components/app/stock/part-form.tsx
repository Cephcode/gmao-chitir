"use client";

// Nouvelle pièce / Modifier la pièce. Plein écran sur mobile, panneau latéral sur ordinateur.
// La quantité ne se saisit qu'à la création (entrée comme une livraison) ; ensuite elle
// ne bouge que par livraisons, corrections et interventions.
// « Va avec » = machines prévues pour cette pièce ; l'utilisation réelle est déduite des interventions.
import Link from "next/link";
import { useState, useTransition } from "react";
import { enregistrerPiece, supprimerPiece, type PartInput, type StockResult } from "@/app/(app)/stock/actions";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextInput, focusHalo } from "@/components/ui/field";

type Machine = { id: string; code: string; name: string; restaurant: string };

const UNIT_OPTIONS = [
  { value: "piece", label: "Pièce" },
  { value: "bouteille", label: "Bouteille" },
  { value: "metre", label: "Mètre" },
  { value: "litre", label: "Litre" },
  { value: "kg", label: "Kilogramme" },
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Choix multiple des machines : puces des machines choisies, recherche, cases à cocher par restaurant.
function MachinePicker({
  machines,
  value,
  onChange,
}: {
  machines: Machine[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const selected = machines.filter((m) => value.includes(m.id));
  const shown = q ? machines.filter((m) => normalize(`${m.code} ${m.name}`).includes(normalize(q))) : machines;
  const restaurants = [...new Set(shown.map((m) => m.restaurant))];
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-x-1.5 lg:gap-y-1.5">
          {selected.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              aria-label={`Retirer ${m.code}`}
              // Bouton de 44 px de haut sur mobile (cible tactile) ; la puce visible garde 32 px.
              className="group inline-flex items-center min-h-11 lg:min-h-0 p-0 bg-transparent border-0 cursor-pointer"
            >
              <span className="inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-full bg-surface-2 text-[13px] font-semibold text-text group-hover:bg-border">
                {m.code} <Icon name="x" size={14} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 text-text-muted text-[13px]">Aucune : la pièce est considérée comme valable pour toutes les machines.</p>
      )}
      <TextInput
        type="search"
        leadingIcon="search"
        aria-label="Chercher une machine"
        placeholder="Chercher : friteuse, CTR1-FRT…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-56 overflow-y-auto rounded bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] p-1">
        {restaurants.map((r) => (
          <fieldset key={r} className="border-0 m-0 p-0">
            <legend className="px-2.5 pt-2 pb-1 text-text-muted text-[12px] font-bold uppercase tracking-wide">{r}</legend>
            {shown
              .filter((m) => m.restaurant === r)
              .map((m) => (
                <label key={m.id} className="flex items-center gap-2.5 min-h-11 px-2.5 rounded-sm cursor-pointer hover:bg-background">
                  <input
                    type="checkbox"
                    checked={value.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    className="size-5 accent-[var(--color-filter-active)]"
                  />
                  <span className="text-[14px]">
                    <span className="font-semibold">{m.name}</span>{" "}
                    <span className="text-text-muted">{m.code}</span>
                  </span>
                </label>
              ))}
          </fieldset>
        ))}
        {shown.length === 0 && <p className="m-0 p-2.5 text-text-muted text-[14px]">Aucune machine ne correspond.</p>}
      </div>
    </div>
  );
}

export function PartForm({
  initial,
  machines,
  canDelete,
  cancelHref,
}: {
  initial: PartInput;
  machines: Machine[];
  canDelete: boolean;
  cancelHref: string;
}) {
  const creating = initial.id === null;
  const [v, setV] = useState(initial);
  const [threshold, setThreshold] = useState(String(initial.minThreshold));
  const [qty, setQty] = useState(String(initial.initialQuantity));
  const [result, setResult] = useState<StockResult>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof PartInput>(k: K, val: PartInput[K]) => setV((cur) => ({ ...cur, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setResult(await enregistrerPiece({ ...v, minThreshold: Number(threshold), initialQuantity: Number(qty) }));
    });
  };
  const remove = () =>
    startTransition(async () => {
      setResult(await supprimerPiece(v.id!));
      setConfirmDelete(false);
    });

  const fieldError = (f: string) => (result && !result.ok && result.field === f ? result.error : undefined);

  return (
    <>
      <Link href={cancelHref} aria-label="Fermer sans enregistrer" className="hidden lg:block fixed inset-0 z-40 bg-[rgba(34,23,15,.35)]" />
      <form
        onSubmit={submit}
        noValidate
        className="fixed inset-0 z-50 flex flex-col bg-background lg:left-auto lg:w-[480px] lg:bg-surface lg:shadow-[-12px_0_32px_rgba(43,26,16,.18)]"
      >
        <header className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-surface">
          <Link href={cancelHref} aria-label="Fermer sans enregistrer" className="lg:hidden size-touch -ml-2 flex items-center justify-center rounded text-text">
            <Icon name="x" />
          </Link>
          <div className="flex-1 min-w-0">
            {!creating && <div className="text-text-muted text-[13px]">{initial.code}</div>}
            <h1 className="font-display text-[18px] lg:text-[20px] font-semibold m-0">
              {creating ? "Nouvelle pièce" : "Modifier la pièce"}
            </h1>
          </div>
          <Link href={cancelHref} aria-label="Fermer sans enregistrer" className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2">
            <Icon name="x" />
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-5">
          {result && !result.ok && !result.field && <Alert variant="danger">{result.error}</Alert>}

          <Field label="Désignation" htmlFor="part-name" error={fieldError("name")}>
            <TextInput id="part-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. Filtre à huile friteuse" invalid={Boolean(fieldError("name"))} autoFocus={creating} />
          </Field>
          <Field label="Code" htmlFor="part-code" error={fieldError("code")} hint="Ex. FIL-FRT-01 : type de pièce, machine, numéro.">
            <TextInput id="part-code" value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase())} autoCapitalize="characters" invalid={Boolean(fieldError("code"))} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Unité" htmlFor="part-unit">
              <div className={`relative flex items-center h-field rounded border-[1.5px] border-border-strong bg-surface ${focusHalo}`}>
                <select id="part-unit" value={v.unit} onChange={(e) => set("unit", e.target.value)} className="appearance-none w-full h-full bg-transparent pl-3.5 pr-10 text-[16px] text-text outline-none cursor-pointer">
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                <Icon name="chevronDown" className="absolute right-3.5 pointer-events-none" />
              </div>
            </Field>
            <Field label="Seuil d'alerte" htmlFor="part-threshold" error={fieldError("threshold")}>
              <TextInput id="part-threshold" type="number" inputMode="numeric" min={0} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} invalid={Boolean(fieldError("threshold"))} />
            </Field>
          </div>

          {creating && (
            <Field label="Quantité en stock aujourd'hui" htmlFor="part-qty" error={fieldError("quantity")} hint="Enregistrée comme une première livraison.">
              <TextInput id="part-qty" type="number" inputMode="numeric" min={0} step={1} value={qty} onChange={(e) => setQty(e.target.value)} invalid={Boolean(fieldError("quantity"))} />
            </Field>
          )}

          <div>
            <div className="text-[14px] font-semibold mb-1.5">Va avec (machines prévues)</div>
            <MachinePicker machines={machines} value={v.plannedIds} onChange={(ids) => set("plannedIds", ids)} />
          </div>

          <Field label="Remarque" htmlFor="part-notes" optional>
            <TextInput id="part-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex. fournisseur, référence constructeur" />
          </Field>

          {confirmDelete && (
            <Alert
              variant="danger"
              title="Supprimer définitivement ?"
              action={
                <div className="flex flex-col gap-2">
                  <Button variant="danger" size="sm" onClick={remove} disabled={pending}>Oui, supprimer</Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Annuler</Button>
                </div>
              }
            >
              Ses mouvements de stock seront aussi supprimés. Impossible si elle a servi dans une intervention.
            </Alert>
          )}
        </div>

        <footer className="flex items-center gap-3 px-4 lg:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface">
          {canDelete && !creating && (
            <Button variant="ghost" icon="trash" className="!text-danger hover:!bg-danger-bg" onClick={() => setConfirmDelete(true)} disabled={pending}>
              Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Link href={cancelHref} className="hidden lg:inline-flex items-center h-field px-5 rounded font-semibold text-text shadow-[inset_0_0_0_1.5px_#D6CBBB] hover:bg-surface-2">
            Annuler
          </Link>
          <Button type="submit" disabled={pending} className="max-lg:flex-1">
            {pending ? "Enregistrement…" : creating ? "Enregistrer la pièce" : "Enregistrer"}
          </Button>
        </footer>
      </form>
    </>
  );
}
