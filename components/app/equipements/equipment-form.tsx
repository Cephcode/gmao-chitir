"use client";

// Formulaire d'équipement (M-04d Nouvel équipement / O-05 Modifier l'équipement).
// Plein écran sur mobile (cache la barre du bas), panneau latéral sur ordinateur.
// Code proposé automatiquement à la création (restaurant + catégorie + numéro suivant),
// tant qu'on ne l'a pas modifié à la main. Catégorie et marque se créent à la volée.
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  enregistrerEquipement,
  suggererCode,
  supprimerEquipement,
  type EquipmentInput,
  type SaveState,
} from "@/app/(app)/equipements/actions";
import type { EquipmentState, Frequency } from "@/lib/equipements";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboValue } from "@/components/ui/combobox";
import { Field, TextInput, focusHalo } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Options = {
  restaurants: { id: string; short_code: string; name: string }[];
  categories: { id: string; name: string; count: number }[];
  brands: { id: string; name: string; count: number }[];
};

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "mensuel", label: "Mois" },
  { value: "trimestriel", label: "3 mois" },
  { value: "semestriel", label: "6 mois" },
  { value: "annuel", label: "An" },
];

const STATES: { value: EquipmentState; label: string }[] = [
  { value: "operationnel", label: "Opérationnel" },
  { value: "en_panne", label: "En panne" },
  { value: "en_maintenance", label: "En maintenance" },
  { value: "hors_service", label: "Hors service" },
];

function SectionTitle({ n, children }: { n: number; children: string }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold m-0">
      <span className="size-6 rounded-full bg-filter-active text-background text-[13px] flex items-center justify-center">
        {n}
      </span>
      {children}
    </h2>
  );
}

export function EquipmentForm({
  initial,
  options,
  canDelete,
  cancelHref,
}: {
  initial: EquipmentInput;
  options: Options;
  canDelete: boolean;
  cancelHref: string;
}) {
  const creating = initial.id === null;
  const [v, setV] = useState<EquipmentInput>(initial);
  const [codeTouched, setCodeTouched] = useState(!creating);
  const [result, setResult] = useState<SaveState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof EquipmentInput>(key: K, value: EquipmentInput[K]) =>
    setV((cur) => ({ ...cur, [key]: value }));

  // Code proposé : recalculé quand le restaurant ou la catégorie change, tant qu'on ne l'a
  // pas saisi à la main (création seulement). Catégorie nouvelle : généré à l'enregistrement.
  const newCategory = v.category !== null && "newName" in v.category;
  const refreshCode = (restaurantId: string, category: ComboValue) => {
    if (codeTouched || !restaurantId) return;
    if (category && "newName" in category) {
      set("code", "");
      return;
    }
    suggererCode(restaurantId, category ? category.id : null).then((code) =>
      setV((cur) => ({ ...cur, code: code ?? "" })),
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      // En cas de succès, l'action redirige vers la fiche : on ne revient ici qu'en cas d'erreur.
      setResult(await enregistrerEquipement(v));
    });
  };

  const remove = () => {
    if (!v.id) return;
    startTransition(async () => {
      setResult(await supprimerEquipement(v.id!));
      setConfirmDelete(false);
    });
  };

  const restaurant = options.restaurants.find((r) => r.id === v.restaurantId);
  const fieldError = (f: NonNullable<SaveState>["field"]) =>
    result && result.field === f ? result.error : undefined;

  return (
    <>
      {/* Fond assombri derrière le panneau (ordinateur) : un clic ferme sans enregistrer */}
      <Link
        href={cancelHref}
        aria-label="Fermer sans enregistrer"
        className="hidden lg:block fixed inset-0 z-40 bg-[rgba(34,23,15,.35)]"
      />
      <form
        onSubmit={submit}
        noValidate
        className="fixed inset-0 z-50 flex flex-col bg-background lg:left-auto lg:w-[480px] lg:bg-surface lg:shadow-[-12px_0_32px_rgba(43,26,16,.18)]"
      >
        <header className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-surface">
          <Link
            href={cancelHref}
            aria-label="Fermer sans enregistrer"
            className="lg:hidden size-touch -ml-2 flex items-center justify-center rounded text-text"
          >
            <Icon name="x" />
          </Link>
          <div className="flex-1 min-w-0">
            {!creating && <div className="text-text-muted text-[13px]">{initial.code}</div>}
            <h1 className="font-display text-[18px] lg:text-[20px] font-semibold m-0">
              {creating ? "Nouvel équipement" : "Modifier l'équipement"}
            </h1>
          </div>
          <Link
            href={cancelHref}
            aria-label="Fermer sans enregistrer"
            className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2"
          >
            <Icon name="x" />
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-6">
          {result && !result.field && <Alert variant="danger">{result.error}</Alert>}

          <section className="flex flex-col gap-4">
            <SectionTitle n={1}>Identification</SectionTitle>
            <Field label="Nom de l'équipement" htmlFor="eq-name" error={fieldError("name")}>
              <TextInput
                id="eq-name"
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex. Congélateur 6"
                invalid={Boolean(fieldError("name"))}
                autoFocus={creating}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Restaurant" htmlFor="eq-restaurant" error={fieldError("restaurant")}>
                {options.restaurants.length > 1 ? (
                  <div className={`relative flex items-center h-field rounded border-[1.5px] border-border-strong bg-surface ${focusHalo}`}>
                    <Icon name="store" className="absolute left-3.5 text-orange-text pointer-events-none" />
                    <select
                      id="eq-restaurant"
                      value={v.restaurantId}
                      onChange={(e) => {
                        set("restaurantId", e.target.value);
                        refreshCode(e.target.value, v.category);
                      }}
                      className="appearance-none w-full h-full bg-transparent pl-11 pr-10 text-[16px] text-text outline-none cursor-pointer"
                    >
                      <option value="" disabled>
                        Choisir
                      </option>
                      {options.restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.short_code} · {r.name}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevronDown" className="absolute right-3.5 pointer-events-none" />
                  </div>
                ) : (
                  <TextInput id="eq-restaurant" value={restaurant?.short_code ?? ""} readOnly leadingIcon="store" />
                )}
              </Field>

              <Field label="Catégorie" htmlFor="eq-category">
                <Combobox
                  id="eq-category"
                  options={options.categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                    hint: String(c.count),
                  }))}
                  value={v.category}
                  onChange={(val: ComboValue) => {
                    set("category", val);
                    refreshCode(v.restaurantId, val);
                  }}
                  placeholder="Chercher une catégorie"
                  createLabel={(q) => `Ajouter « ${q} » comme catégorie`}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marque" htmlFor="eq-brand" optional>
                <Combobox
                  id="eq-brand"
                  options={options.brands.map((b) => ({
                    value: b.id,
                    label: b.name,
                    hint: `${b.count} équipement${b.count > 1 ? "s" : ""}`,
                  }))}
                  value={v.brand}
                  onChange={(val: ComboValue) => set("brand", val)}
                  placeholder="Chercher ou ajouter"
                  createLabel={(q) => `Ajouter « ${q} » comme nouvelle marque`}
                />
              </Field>
              <Field label="Modèle" htmlFor="eq-model" optional>
                <TextInput id="eq-model" value={v.model} onChange={(e) => set("model", e.target.value)} />
              </Field>
            </div>

            <Field
              label="Code"
              htmlFor="eq-code"
              error={fieldError("code")}
              hint={
                creating
                  ? newCategory
                    ? "Créé à l'enregistrement avec la nouvelle catégorie. Vous pouvez en saisir un."
                    : "Créé automatiquement. Vous pouvez le changer."
                  : undefined
              }
            >
              <TextInput
                id="eq-code"
                value={v.code}
                onChange={(e) => {
                  setCodeTouched(true);
                  set("code", e.target.value.toUpperCase());
                }}
                invalid={Boolean(fieldError("code"))}
                autoCapitalize="characters"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="N° de série" htmlFor="eq-serial" optional>
                <TextInput
                  id="eq-serial"
                  value={v.serialNumber}
                  onChange={(e) => set("serialNumber", e.target.value)}
                />
              </Field>
              <Field label="Installé le" htmlFor="eq-installed" optional>
                <TextInput
                  id="eq-installed"
                  type="date"
                  value={v.installedAt}
                  onChange={(e) => set("installedAt", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle n={2}>Entretien</SectionTitle>
            <div>
              <div className="text-[14px] font-semibold mb-1.5">À faire tous les…</div>
              <SegmentedControl<Frequency | "">
                ariaLabel="Fréquence d'entretien"
                options={FREQUENCIES}
                value={v.frequency ?? ""}
                onChange={(f) => set("frequency", f || null)}
              />
              {!v.frequency && (
                <div className="text-text-muted text-[13px] mt-1.5">
                  Sans fréquence, aucun entretien n&apos;est planifié.
                </div>
              )}
            </div>
            {v.frequency && (
              <Field label="Ce qu'il faut faire" htmlFor="eq-task" optional>
                <TextInput
                  id="eq-task"
                  value={v.task}
                  onChange={(e) => set("task", e.target.value)}
                  placeholder="Ex. vidange, nettoyage des bacs"
                />
              </Field>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle n={3}>État actuel</SectionTitle>
            <SegmentedControl<EquipmentState>
              ariaLabel="État actuel"
              options={STATES}
              value={v.state}
              onChange={(s) => set("state", s)}
            />
          </section>

          {confirmDelete && (
            <Alert
              variant="danger"
              title="Supprimer définitivement ?"
              action={
                <div className="flex flex-col gap-2">
                  <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
                    Oui, supprimer
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                    Annuler
                  </Button>
                </div>
              }
            >
              Ses interventions, entretiens et sa fiche de vie seront aussi supprimés.
            </Alert>
          )}
        </div>

        <footer className="flex items-center gap-3 px-4 lg:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface">
          {canDelete && !creating && (
            <Button
              variant="ghost"
              icon="trash"
              className="!text-danger hover:!bg-danger-bg"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Link
            href={cancelHref}
            className="hidden lg:inline-flex items-center h-field px-5 rounded font-semibold text-text shadow-[inset_0_0_0_1.5px_#D6CBBB] hover:bg-surface-2"
          >
            Annuler
          </Link>
          <Button type="submit" disabled={pending} className="max-lg:flex-1">
            {pending ? "Enregistrement…" : creating ? "Enregistrer l'équipement" : "Enregistrer"}
          </Button>
        </footer>
      </form>
    </>
  );
}
