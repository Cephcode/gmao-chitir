"use client";

// Nouvelle intervention : le client crée lui-même une intervention et choisit son type
// (réparation, entretien préventif, contrôle, installation ou amélioration), sans passer
// par « Déclarer une panne ». Propriétaire, éditeur, commentateur.
// Plein écran sur mobile, panneau latéral sur ordinateur (comme le formulaire d'équipement).
// Le type n'a pas de valeur par défaut : on oblige à le choisir.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  creerIntervention,
  type NewInterventionInput,
  type NewInterventionState,
} from "@/app/(app)/interventions/actions";
import type { InterventionKind } from "@/lib/interventions";
import { OPEN_STATUSES, STATUS_LABELS, type OpenStatus } from "@/lib/intervention-status";
import { Icon, type IconName } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Field, TextInput, focusHalo } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { Machine } from "@/components/app/panne/declare-form";
import { TechnicianPicker } from "@/components/app/interventions/technician-picker";

const KIND_CHOICES: { value: InterventionKind; icon: IconName; title: string; text: string }[] = [
  {
    value: "correctif",
    icon: "wrench",
    title: "Réparation",
    text: "La machine est en panne ou fonctionne mal. Elle passe « En panne ».",
  },
  {
    value: "preventif",
    icon: "refresh",
    title: "Entretien préventif",
    text: "Nettoyage, vidange, révision : pour éviter les pannes.",
  },
  {
    value: "controle",
    icon: "eye",
    title: "Contrôle",
    text: "Vérification, mesure ou contrôle obligatoire.",
  },
  {
    value: "amelioration",
    icon: "plus",
    title: "Installation ou amélioration",
    text: "Pose, modification ou remplacement prévu d'une machine.",
  },
];

const PRIORITIES: { value: "normal" | "urgence"; label: string }[] = [
  { value: "normal", label: "Normale" },
  { value: "urgence", label: "Urgente" },
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

const selectClass =
  "appearance-none w-full h-full bg-transparent pl-3.5 pr-10 text-[16px] text-text outline-none cursor-pointer";

export function NewInterventionForm({
  restaurants,
  machines,
  technicians,
  initialEquipmentId,
  cancelHref,
}: {
  restaurants: { id: string; short_code: string; name: string }[];
  machines: Machine[];
  technicians: Record<string, ComboOption[]>; // par restaurant (voir technicianOptions)
  initialEquipmentId: string | null;
  cancelHref: string;
}) {
  const initialMachine = machines.find((m) => m.id === initialEquipmentId) ?? null;
  const [v, setV] = useState<NewInterventionInput>({
    kind: null,
    equipmentId: initialMachine?.id ?? null,
    restaurantId: initialMachine?.restaurantId ?? restaurants[0]?.id ?? "",
    freeText: "",
    description: "",
    urgent: false,
    status: "a_planifier",
    assignedTo: null,
  });
  const [notListed, setNotListed] = useState(false); // « Je ne trouve pas la machine »
  const [result, setResult] = useState<NewInterventionState>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const set = <K extends keyof NewInterventionInput>(key: K, value: NewInterventionInput[K]) =>
    setV((cur) => ({ ...cur, [key]: value }));

  const inRestaurant = useMemo(
    () =>
      machines
        .filter((m) => m.restaurantId === v.restaurantId)
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [machines, v.restaurantId],
  );
  const techs = technicians[v.restaurantId] ?? [];

  // Changer de restaurant vide la machine et le technicien s'ils n'y ont pas accès.
  const chooseRestaurant = (id: string) =>
    setV((cur) => ({
      ...cur,
      restaurantId: id,
      equipmentId: machines.find((m) => m.id === cur.equipmentId)?.restaurantId === id ? cur.equipmentId : null,
      assignedTo: (technicians[id] ?? []).some((t) => t.value === cur.assignedTo) ? cur.assignedTo : null,
    }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await creerIntervention(v);
      if (res && "id" in res) {
        router.push(`/interventions/${res.id}`);
        return;
      }
      setResult(res);
    });
  };

  const error = (f: NonNullable<NewInterventionState>["field"]) =>
    result && result.field === f ? result.error : undefined;

  return (
    <>
      <Link
        href={cancelHref}
        aria-label="Fermer sans enregistrer"
        className="hidden lg:block fixed inset-0 z-40 bg-[rgba(34,23,15,.35)]"
      />
      <form
        onSubmit={submit}
        noValidate
        aria-labelledby="new-intervention-title"
        className="fixed inset-0 z-50 flex flex-col bg-background lg:left-auto lg:w-[520px] lg:bg-surface lg:shadow-[-12px_0_32px_rgba(43,26,16,.18)]"
      >
        <header className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-surface">
          <Link
            href={cancelHref}
            aria-label="Fermer sans enregistrer"
            className="lg:hidden size-touch -ml-2 flex items-center justify-center rounded text-text"
          >
            <Icon name="x" />
          </Link>
          <h1 id="new-intervention-title" className="flex-1 font-display text-[18px] lg:text-[20px] font-semibold m-0">
            Nouvelle intervention
          </h1>
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

          {/* ---------- 1. Le type ---------- */}
          <section className="flex flex-col gap-3">
            <SectionTitle n={1}>Type d&apos;intervention</SectionTitle>
            <div role="radiogroup" aria-label="Type d'intervention" className="grid gap-2.5 sm:grid-cols-2">
              {KIND_CHOICES.map((k) => {
                const on = v.kind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("kind", k.value)}
                    className={`flex items-start gap-3 p-3.5 rounded-lg text-left border-0 cursor-pointer ${
                      on
                        ? "bg-surface-2 shadow-[inset_0_0_0_2px_var(--color-filter-active)]"
                        : "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-border)] hover:bg-background"
                    }`}
                  >
                    <span className="size-9 rounded flex items-center justify-center shrink-0 bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] text-text">
                      <Icon name={k.icon} size={20} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold text-[15px]">{k.title}</span>
                      <span className="block text-text-muted text-[13px]">{k.text}</span>
                    </span>
                    {on && <Icon name="check" />}
                  </button>
                );
              })}
            </div>
            {error("kind") && <p className="text-danger text-[14px] font-semibold m-0">{error("kind")}</p>}
          </section>

          {/* ---------- 2. La machine ---------- */}
          <section className="flex flex-col gap-3">
            <SectionTitle n={2}>Quelle machine ?</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
              <Field label="Restaurant" htmlFor="ni-restaurant">
                <div className={`relative flex items-center h-field rounded border-[1.5px] border-border-strong bg-surface ${focusHalo}`}>
                  <select
                    id="ni-restaurant"
                    value={v.restaurantId}
                    onChange={(e) => chooseRestaurant(e.target.value)}
                    className={selectClass}
                  >
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.short_code}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" className="absolute right-3.5 pointer-events-none" />
                </div>
              </Field>
              <Field label="Machine" htmlFor="ni-machine" error={error("machine")}>
                {notListed ? (
                  <TextInput
                    id="ni-machine"
                    value={v.freeText}
                    onChange={(e) => set("freeText", e.target.value)}
                    placeholder="Décrivez la machine"
                    invalid={Boolean(error("machine"))}
                  />
                ) : (
                  // key : la liste se réinitialise quand on change de restaurant
                  <Combobox
                    key={v.restaurantId}
                    id="ni-machine"
                    options={inRestaurant.map((m) => ({ value: m.id, label: m.name, hint: m.code }))}
                    value={v.equipmentId ? { id: v.equipmentId } : null}
                    onChange={(val) => set("equipmentId", val && "id" in val ? val.id : null)}
                    placeholder="Chercher une machine"
                    invalid={Boolean(error("machine"))}
                  />
                )}
              </Field>
            </div>
            <button
              type="button"
              onClick={() => {
                setNotListed(!notListed);
                set("equipmentId", null);
              }}
              className="self-end bg-transparent border-0 p-0 text-orange-text font-semibold text-[14px] underline underline-offset-2 cursor-pointer"
            >
              {notListed ? "Choisir dans la liste" : "Je ne trouve pas la machine"}
            </button>
          </section>

          {/* ---------- 3. Le travail ---------- */}
          <section className="flex flex-col gap-3">
            <SectionTitle n={3}>Ce qu&apos;il faut faire</SectionTitle>
            <Field label="Description" htmlFor="ni-description" error={error("description")}>
              <textarea
                id="ni-description"
                rows={3}
                value={v.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Ex. nettoyer les filtres et vérifier le gaz"
                aria-invalid={Boolean(error("description")) || undefined}
                className={`w-full rounded border-[1.5px] bg-surface px-3.5 py-3 text-[16px] text-text outline-0 resize-y placeholder:text-text-muted focus:border-orange focus:shadow-[0_0_0_3px_var(--color-orange-selected)] ${
                  error("description") ? "border-danger" : "border-border-strong"
                }`}
              />
            </Field>
          </section>

          {/* ---------- 4. Organisation ---------- */}
          <section className="flex flex-col gap-4">
            <SectionTitle n={4}>Organisation</SectionTitle>
            <div>
              <div className="text-[14px] font-semibold mb-1.5">Priorité</div>
              <SegmentedControl
                ariaLabel="Priorité"
                options={PRIORITIES}
                value={v.urgent ? "urgence" : "normal"}
                onChange={(p) => set("urgent", p === "urgence")}
              />
            </div>
            <div>
              <div className="text-[14px] font-semibold mb-1.5">Statut de départ</div>
              <SegmentedControl<OpenStatus>
                ariaLabel="Statut de départ"
                options={OPEN_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                value={v.status}
                onChange={(s) => set("status", s)}
              />
            </div>
            <Field
              label="Technicien"
              htmlFor="ni-technicien"
              optional
              hint="Tapez un prénom ou un e-mail. Il est prévenu par notification et par e-mail."
            >
              {/* key : la recherche se réinitialise quand on change de restaurant */}
              <TechnicianPicker
                key={v.restaurantId}
                id="ni-technicien"
                options={techs}
                value={v.assignedTo}
                onChange={(id) => set("assignedTo", id)}
              />
            </Field>
          </section>
        </div>

        <footer className="flex items-center gap-3 px-4 lg:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface">
          <div className="flex-1 max-lg:hidden" />
          <Link
            href={cancelHref}
            className="hidden lg:inline-flex items-center h-field px-5 rounded font-semibold text-text shadow-[inset_0_0_0_1.5px_#D6CBBB] hover:bg-surface-2"
          >
            Annuler
          </Link>
          <Button type="submit" icon="check" disabled={pending} className="max-lg:flex-1">
            {pending ? "Création…" : "Créer l'intervention"}
          </Button>
        </footer>
      </form>
    </>
  );
}
