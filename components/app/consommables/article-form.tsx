"use client";

// Nouvel article / Modifier l'article. Plein écran sur mobile, panneau latéral sur ordinateur.
// Fiche du catalogue commun (désignation, code, famille, unité, seuil par défaut) :
// les quantités se gèrent ensuite par restaurant, sur la fiche (livraison, inventaire…).
import Link from "next/link";
import { useState, useTransition } from "react";
import { enregistrerArticle, supprimerArticle, type ArticleInput, type ConsoResult } from "@/app/(app)/consommables/actions";
import { FAMILLES, FAMILLE_LABELS, UNITES, normaliserCode, uniteLabel } from "@/lib/consommables-rules";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextInput, focusHalo } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ArticleForm({
  initial,
  canDelete,
  cancelHref,
}: {
  initial: ArticleInput;
  canDelete: boolean;
  cancelHref: string;
}) {
  const creating = initial.id === null;
  const [v, setV] = useState(initial);
  const [threshold, setThreshold] = useState(String(initial.defaultThreshold));
  const [result, setResult] = useState<ConsoResult>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ArticleInput>(k: K, val: ArticleInput[K]) => setV((cur) => ({ ...cur, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setResult(await enregistrerArticle({ ...v, defaultThreshold: threshold.trim() === "" ? NaN : Number(threshold) }));
    });
  };
  const remove = () =>
    startTransition(async () => {
      setResult(await supprimerArticle(v.id!));
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
              {creating ? "Nouvel article" : "Modifier l'article"}
            </h1>
          </div>
          <Link href={cancelHref} aria-label="Fermer sans enregistrer" className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2">
            <Icon name="x" />
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-5">
          {result && !result.ok && !result.field && <Alert variant="danger">{result.error}</Alert>}

          <Field label="Désignation" htmlFor="article-name" error={fieldError("name")}>
            <TextInput id="article-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. Gobelet 50 cl" maxLength={120} invalid={Boolean(fieldError("name"))} autoFocus={creating} />
          </Field>
          <Field label="Code" htmlFor="article-code" error={fieldError("code")} hint="Ex. GOB-50 : lettres, chiffres et tirets.">
            <TextInput id="article-code" value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase())} onBlur={() => set("code", normaliserCode(v.code))} autoCapitalize="characters" maxLength={30} invalid={Boolean(fieldError("code"))} />
          </Field>

          <div>
            <div className="text-[14px] font-semibold mb-1.5">Famille</div>
            <SegmentedControl
              ariaLabel="Famille"
              options={FAMILLES.map((f) => ({ value: f, label: FAMILLE_LABELS[f] }))}
              value={v.famille || null}
              onChange={(f) => set("famille", f)}
            />
            {fieldError("famille") && (
              <div className="flex items-center gap-1.5 text-danger text-[13px] font-semibold mt-1.5">
                <Icon name="xc" size={16} />
                {fieldError("famille")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Unité" htmlFor="article-unit" error={fieldError("unit")}>
              <div className={`relative flex items-center h-field rounded border-[1.5px] border-border-strong bg-surface ${focusHalo}`}>
                <select id="article-unit" value={v.unit} onChange={(e) => set("unit", e.target.value)} className="appearance-none w-full h-full bg-transparent pl-3.5 pr-10 text-[16px] text-text outline-none cursor-pointer">
                  {UNITES.map((u) => (
                    <option key={u} value={u}>{capitale(uniteLabel(u, 1))}</option>
                  ))}
                </select>
                <Icon name="chevronDown" className="absolute right-3.5 pointer-events-none" />
              </div>
            </Field>
            <Field label="Seuil par défaut" htmlFor="article-threshold" error={fieldError("threshold")}>
              <TextInput id="article-threshold" type="number" inputMode="numeric" min={0} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} invalid={Boolean(fieldError("threshold"))} />
            </Field>
          </div>
          <p className="m-0 -mt-3 text-text-muted text-[13px]">
            Seuil donné à chaque restaurant qui commence à suivre l&apos;article. Il se règle ensuite restaurant par restaurant, sur la fiche.
          </p>

          <Field label="Remarque" htmlFor="article-notes" optional error={fieldError("notes")}>
            <TextInput id="article-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} placeholder="Ex. fournisseur, conditionnement (carton de 50)" />
          </Field>

          {creating && (
            <Alert variant="info" title="Et les quantités ?">
              Après l&apos;enregistrement, sur la fiche : une livraison ou un inventaire par restaurant.
            </Alert>
          )}

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
              Impossible si l&apos;article a déjà eu des mouvements de stock : on garde son historique.
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
            {pending ? "Enregistrement…" : creating ? "Enregistrer l'article" : "Enregistrer"}
          </Button>
        </footer>
      </form>
    </>
  );
}
