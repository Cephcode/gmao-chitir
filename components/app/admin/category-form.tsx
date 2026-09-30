"use client";

// Ajouter ou modifier une catégorie : nom, code de 3 lettres (proposé depuis le nom tant
// qu'on ne l'a pas touché), icône. Suppression seulement si aucune machine ne l'utilise.
import Link from "next/link";
import { useState, useTransition } from "react";
import { enregistrerCategorie, supprimerCategorie, type CategoryResult } from "@/app/(app)/admin/categories/actions";
import { CATEGORY_ICONS, codeDepuisNom, normaliserCode } from "@/lib/categories-rules";
import { categoryIcon } from "@/lib/equipment-icon";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextInput, focusHaloInset } from "@/components/ui/field";

export function CategoryForm({
  category,
  takenCodes,
  cancelHref,
}: {
  // Absent : création.
  category?: { id: string; name: string; code: string; icon: string | null; machines: number };
  // Codes des AUTRES catégories (pour proposer un code libre).
  takenCodes: string[];
  cancelHref: string;
}) {
  const creating = !category;
  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  // En création, le code suit le nom jusqu'à ce qu'on le modifie à la main.
  const [codeTouched, setCodeTouched] = useState(!creating);
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [result, setResult] = useState<CategoryResult>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const fieldError = (f: "name" | "code" | "icon") => (result && result.field === f ? result.error : undefined);
  const used = category?.machines ?? 0;

  const onName = (value: string) => {
    setName(value);
    if (!codeTouched) setCode(value.trim() ? codeDepuisNom(value, takenCodes) : "");
  };

  const submit = () =>
    startTransition(async () => setResult(await enregistrerCategorie({ id: category?.id, name, code, icon })));
  const remove = () => startTransition(async () => setResult(await supprimerCategorie(category!.id)));

  return (
    <>
      <Link href={cancelHref} aria-label="Fermer" className="hidden lg:block fixed inset-0 z-40 bg-[rgba(34,23,15,.35)]" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
        className="fixed inset-0 z-50 flex flex-col bg-background lg:left-auto lg:w-[500px] lg:bg-surface lg:shadow-[-12px_0_32px_rgba(43,26,16,.18)]"
      >
        <header className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-surface">
          <h1 className="flex-1 font-display text-[18px] lg:text-[20px] font-semibold m-0">
            {creating ? "Ajouter une catégorie" : "Modifier la catégorie"}
          </h1>
          <Link href={cancelHref} aria-label="Fermer" className="size-touch flex items-center justify-center rounded text-text hover:bg-surface-2">
            <Icon name="x" />
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-5">
          {result && !result.field && <Alert variant="danger">{result.error}</Alert>}
          <Field label="Nom" htmlFor="cat-name" error={fieldError("name")}>
            <TextInput
              id="cat-name"
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Ex. Friteuses"
              maxLength={60}
              invalid={Boolean(fieldError("name"))}
              autoFocus={creating}
            />
          </Field>
          <Field
            label="Code"
            htmlFor="cat-code"
            error={fieldError("code")}
            hint={`3 lettres, proposé depuis le nom. Sert à nommer les futures machines (CTR2-${code || "ABC"}-01). Le changer ne renomme pas les machines existantes.`}
          >
            <TextInput
              id="cat-code"
              value={code}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(normaliserCode(e.target.value));
              }}
              placeholder="ABC"
              maxLength={3}
              autoCapitalize="characters"
              autoComplete="off"
              invalid={Boolean(fieldError("code"))}
            />
          </Field>

          <fieldset className="border-0 m-0 p-0">
            <legend className="text-[14px] font-semibold mb-1.5">Icône</legend>
            <div role="radiogroup" aria-label="Icône" className="grid grid-cols-5 sm:grid-cols-9 gap-2">
              {CATEGORY_ICONS.map((i) => {
                const on = icon === i.name;
                return (
                  <button
                    key={i.name}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={i.label}
                    title={i.label}
                    onClick={() => setIcon(i.name)}
                    className={`h-12 rounded flex items-center justify-center border-0 cursor-pointer outline-none ${focusHaloInset} ${
                      on
                        ? "bg-orange-soft text-text shadow-[inset_0_0_0_2px_var(--color-orange)]"
                        : "bg-surface text-[#4E2F21] shadow-[inset_0_0_0_1.5px_var(--color-border)] hover:bg-background"
                    }`}
                  >
                    <Icon name={i.name} />
                  </button>
                );
              })}
            </div>
            {fieldError("icon") ? (
              <div className="text-danger text-[13px] font-semibold mt-1.5">{fieldError("icon")}</div>
            ) : (
              <div className="text-text-muted text-[13px] mt-1.5 flex items-center gap-1.5">
                {icon ? (
                  <>Icône choisie : {CATEGORY_ICONS.find((i) => i.name === icon)?.label}.</>
                ) : (
                  <>
                    Aucune icône choisie : l&apos;application affiche
                    <Icon name={categoryIcon({ code })} size={16} className="text-text" aria-hidden />
                  </>
                )}
              </div>
            )}
          </fieldset>

          {!creating && used > 0 && (
            <p id="cat-delete-help" className="m-0 text-text-muted text-[13.5px]">
              Utilisée par {used} machine{used > 1 ? "s" : ""} : suppression impossible tant qu&apos;une machine l&apos;utilise.
            </p>
          )}

          {confirmDelete && (
            <Alert
              variant="danger"
              title="Supprimer cette catégorie ?"
              action={
                <div className="flex flex-col gap-2">
                  <Button variant="danger" size="sm" onClick={remove} disabled={pending}>Oui, supprimer</Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Annuler</Button>
                </div>
              }
            >
              Aucune machine ne l&apos;utilise. Elle disparaîtra des listes de choix.
            </Alert>
          )}
        </div>

        <footer className="flex items-center gap-3 px-4 lg:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface">
          {!creating && (
            <Button
              variant="ghost"
              icon="trash"
              className="!text-danger hover:!bg-danger-bg disabled:!text-border-strong disabled:hover:!bg-transparent"
              onClick={() => setConfirmDelete(true)}
              disabled={pending || used > 0}
              aria-describedby={used > 0 ? "cat-delete-help" : undefined}
            >
              Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Link href={cancelHref} className="hidden lg:inline-flex items-center h-field px-5 rounded font-semibold text-text shadow-[inset_0_0_0_1.5px_#D6CBBB] hover:bg-surface-2">
            Annuler
          </Link>
          <Button type="submit" disabled={pending} className="max-lg:flex-1">
            {pending ? "Enregistrement…" : creating ? "Ajouter la catégorie" : "Enregistrer"}
          </Button>
        </footer>
      </form>
    </>
  );
}
