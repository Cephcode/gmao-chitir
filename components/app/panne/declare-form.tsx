"use client";

// Déclarer une panne (M-05a / M-05b / O-06).
// Mobile : plein écran en 2 étapes (1. la machine, 2. le problème et l'urgence).
// Ordinateur : fenêtre au-dessus de l'écran assombri, les 3 blocs sur une seule page.
// L'urgence n'a pas de valeur par défaut : on oblige à répondre.
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { declarerPanne, type PanneInput, type PanneState } from "@/app/(app)/panne/actions";
import { categoryIcon } from "@/lib/equipment-icon";
import { depuis } from "@/lib/format";
import { Icon, type IconName } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, TextInput } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";

export type Machine = {
  id: string;
  name: string;
  code: string;
  restaurantId: string;
  categoryName: string | null;
  categoryCode: string | null;
};
export type OpenPanne = { id: string; reportedAt: string; type: string };

const SYMPTOMS = [
  "Ne démarre pas",
  "Ne chauffe pas",
  "Ne refroidit pas",
  "Fuite",
  "Bruit anormal",
  "Odeur de brûlé",
];

const URGENCY: {
  value: "urgence" | "normal";
  icon: IconName;
  title: string;
  text: string;
  selected: string;
}[] = [
  {
    value: "urgence",
    icon: "bolt",
    title: "Oui, c'est urgent",
    text: "La machine est arrêtée et bloque le service. Le technicien est appelé tout de suite.",
    selected: "bg-danger-bg shadow-[inset_0_0_0_2px_var(--color-danger)]",
  },
  {
    value: "normal",
    icon: "clock",
    title: "Non, ça peut attendre",
    text: "On peut continuer à travailler en attendant la réparation.",
    selected: "bg-surface-2 shadow-[inset_0_0_0_2px_var(--color-filter-active)]",
  },
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function SectionTitle({ n, children }: { n: number; children: string }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold m-0">
      <span className="hidden lg:flex size-6 rounded-full bg-filter-active text-background text-[13px] items-center justify-center">
        {n}
      </span>
      {children}
    </h2>
  );
}

export function DeclareForm({
  restaurants,
  machines,
  openByEquipment,
  initialEquipmentId,
  closeHref,
}: {
  restaurants: { id: string; short_code: string; name: string }[];
  machines: Machine[];
  openByEquipment: Record<string, OpenPanne>;
  initialEquipmentId: string | null;
  closeHref: string;
}) {
  const initialMachine = machines.find((m) => m.id === initialEquipmentId) ?? null;
  const [v, setV] = useState<PanneInput>({
    equipmentId: initialMachine?.id ?? null,
    restaurantId: initialMachine?.restaurantId ?? restaurants[0]?.id ?? "",
    freeText: "",
    symptoms: [],
    description: "",
    type: null,
  });
  const [notListed, setNotListed] = useState(false); // « Je ne trouve pas la machine »
  const [step, setStep] = useState<1 | 2>(initialMachine ? 2 : 1); // mobile seulement
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<PanneState>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof PanneInput>(key: K, value: PanneInput[K]) =>
    setV((cur) => ({ ...cur, [key]: value }));

  const restaurant = restaurants.find((r) => r.id === v.restaurantId);
  const inRestaurant = useMemo(
    () =>
      machines
        .filter((m) => m.restaurantId === v.restaurantId)
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [machines, v.restaurantId],
  );
  const visible = search
    ? inRestaurant.filter((m) => normalize(`${m.name} ${m.code}`).includes(normalize(search)))
    : inRestaurant;
  const machine = machines.find((m) => m.id === v.equipmentId) ?? null;
  const open = v.equipmentId ? openByEquipment[v.equipmentId] : undefined;

  const chooseRestaurant = (id: string) => {
    setV((cur) => ({
      ...cur,
      restaurantId: id,
      // La machine choisie doit appartenir au restaurant.
      equipmentId: machines.find((m) => m.id === cur.equipmentId)?.restaurantId === id ? cur.equipmentId : null,
    }));
  };
  const chooseMachine = (id: string | null) => {
    setNotListed(false);
    set("equipmentId", id);
    if (id) setStep(2);
  };
  const toggleSymptom = (s: string) =>
    set("symptoms", v.symptoms.includes(s) ? v.symptoms.filter((x) => x !== s) : [...v.symptoms, s]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await declarerPanne(v);
      // En cas de succès, l'action redirige vers la confirmation.
      setResult(res);
      if (res?.field === "machine") setStep(1);
    });
  };

  const error = (f: "machine" | "type") => (result && result.field === f ? result.error : undefined);
  const machineLabel = machine
    ? [restaurant?.short_code, machine.categoryName].filter(Boolean).join(" · ")
    : `${restaurant?.short_code ?? ""} · machine hors liste`;

  return (
    <>
      <Link
        href={closeHref}
        aria-label="Fermer sans envoyer"
        className="hidden lg:block fixed inset-0 z-40 bg-[rgba(34,23,15,.4)]"
      />
      <form
        onSubmit={submit}
        noValidate
        aria-labelledby="panne-title"
        className="fixed inset-0 z-50 flex flex-col bg-background lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[min(720px,calc(100vw-64px))] lg:max-h-[calc(100dvh-64px)] lg:rounded-lg lg:bg-surface lg:shadow-[0_24px_64px_rgba(43,26,16,.28)] lg:overflow-hidden"
      >
        {/* En-tête : mobile avec étape et progression, ordinateur avec icône et fermeture */}
        <header className="bg-surface border-b border-border">
          <div className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                aria-label="Revenir au choix de la machine"
                className="lg:hidden size-touch -ml-2 flex items-center justify-center rounded text-text"
              >
                <Icon name="chevronRight" className="rotate-180" />
              </button>
            ) : (
              <Link
                href={closeHref}
                aria-label="Fermer sans envoyer"
                className="lg:hidden size-touch -ml-2 flex items-center justify-center rounded text-text"
              >
                <Icon name="x" />
              </Link>
            )}
            <span className="hidden lg:flex size-9 rounded bg-orange-soft text-orange-text items-center justify-center">
              <Icon name="alert" size={20} />
            </span>
            <h1 id="panne-title" className="flex-1 font-display text-[17px] lg:text-[20px] font-semibold m-0">
              Déclarer une panne
            </h1>
            <span className="lg:hidden text-text-muted text-[13px]">Étape {step} sur 2</span>
            <Link
              href={closeHref}
              aria-label="Fermer sans envoyer"
              className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2"
            >
              <Icon name="x" />
            </Link>
          </div>
          <div className="lg:hidden h-1 bg-surface-2" aria-hidden>
            <div className={`h-full bg-orange transition-all ${step === 1 ? "w-1/2" : "w-full"}`} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-6">
          {result && !result.field && <Alert variant="danger">{result.error}</Alert>}

          {/* ---------- 1. La machine ---------- */}
          {/* Mobile, étape 1 : restaurant, recherche, liste des machines */}
          {step === 1 && (
            <section className="lg:hidden flex flex-col gap-4">
              <h2 className="font-display text-[24px] leading-tight font-semibold m-0">
                Quelle machine ne marche pas ?
              </h2>
              {restaurants.length > 1 && (
                <SegmentedControl
                  ariaLabel="Restaurant"
                  options={restaurants.map((r) => ({ value: r.id, label: r.short_code }))}
                  value={v.restaurantId}
                  onChange={chooseRestaurant}
                />
              )}
              <TextInput
                type="search"
                leadingIcon="search"
                aria-label="Chercher une machine"
                placeholder="Chercher : frigo, friteuse, clim…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {error("machine") && (
                <p className="text-danger text-[14px] font-semibold m-0">{error("machine")}</p>
              )}
              <div className="text-text-muted text-[12.5px] font-semibold uppercase tracking-wide">
                Machines de {restaurant?.short_code}
              </div>
              {visible.length === 0 ? (
                <p className="text-text-muted text-[14px] m-0">Aucune machine ne correspond.</p>
              ) : (
                <ul className="list-none m-0 p-0 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)] divide-y divide-surface-2 overflow-hidden">
                  {visible.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => chooseMachine(m.id)}
                        className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[64px] text-left bg-transparent border-0 cursor-pointer hover:bg-background"
                      >
                        <span className="size-10 rounded bg-surface-2 flex items-center justify-center text-[#4E2F21] shrink-0">
                          <Icon name={categoryIcon(m.categoryCode)} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-[15px] truncate">{m.name}</span>
                          <span className="block text-text-muted text-[13px]">
                            {m.categoryName ?? m.code}
                          </span>
                        </span>
                        {openByEquipment[m.id] && <span className="text-danger text-[12px] font-semibold">Panne en cours</span>}
                        <Icon name="chevronRight" className="text-text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {notListed ? (
                <Field label="Décrivez la machine" htmlFor="panne-free-m">
                  <TextInput
                    id="panne-free-m"
                    value={v.freeText}
                    onChange={(e) => set("freeText", e.target.value)}
                    placeholder="Ex. petit frigo sous le comptoir"
                    autoFocus
                  />
                </Field>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNotListed(true);
                    set("equipmentId", null);
                  }}
                  className="self-center py-3 bg-transparent border-0 text-orange-text font-bold text-[15px] underline underline-offset-2 cursor-pointer"
                >
                  Je ne trouve pas la machine
                </button>
              )}
            </section>
          )}

          {/* Mobile, étape 2 : rappel de la machine choisie */}
          {step === 2 && (
            <div className="lg:hidden flex items-center gap-3 p-3.5 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)]">
              <span className="size-10 rounded bg-surface-2 flex items-center justify-center text-[#4E2F21] shrink-0">
                <Icon name={categoryIcon(machine?.categoryCode)} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] truncate">{machine?.name ?? v.freeText}</div>
                <div className="text-text-muted text-[13px]">{machineLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2 bg-transparent border-0 text-orange-text font-bold text-[15px] underline underline-offset-2 cursor-pointer"
              >
                Changer
              </button>
            </div>
          )}

          {/* Ordinateur : restaurant et machine côte à côte */}
          <section className="hidden lg:flex flex-col gap-3">
            <SectionTitle n={1}>Quelle machine ?</SectionTitle>
            <div className="grid grid-cols-[200px_1fr] gap-3">
              <Field label="Restaurant" htmlFor="panne-restaurant">
                <div className="relative flex items-center h-field rounded border-[1.5px] border-border-strong bg-surface focus-within:border-orange">
                  <select
                    id="panne-restaurant"
                    value={v.restaurantId}
                    onChange={(e) => chooseRestaurant(e.target.value)}
                    className="appearance-none w-full h-full bg-transparent pl-3.5 pr-10 text-[16px] text-text outline-none cursor-pointer"
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
              <Field label="Machine" htmlFor="panne-machine" error={notListed ? undefined : error("machine")}>
                {notListed ? (
                  <TextInput
                    id="panne-machine"
                    value={v.freeText}
                    onChange={(e) => set("freeText", e.target.value)}
                    placeholder="Décrivez la machine (ex. petit frigo sous le comptoir)"
                    invalid={Boolean(error("machine"))}
                  />
                ) : (
                  // key : la liste se réinitialise quand on change de restaurant
                  <Combobox
                    key={v.restaurantId}
                    id="panne-machine"
                    options={inRestaurant.map((m) => ({ value: m.id, label: m.name, hint: m.code }))}
                    value={v.equipmentId ? { id: v.equipmentId } : null}
                    onChange={(val) => chooseMachine(val && "id" in val ? val.id : null)}
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

          {/* Panne déjà ouverte sur cette machine : on prévient, on laisse envoyer */}
          {open && (
            <div className={step === 1 ? "max-lg:hidden" : ""}>
              <Alert
                variant="warning"
                title="Une panne est déjà en cours sur cette machine"
                action={
                  <Link href={`/interventions/${open.id}`} className="text-orange-text font-bold text-[14px]">
                    Voir
                  </Link>
                }
              >
                Déclarée il y a {depuis(open.reportedAt)}
                {open.type === "urgence" ? " (urgence)" : ""}. Vous pouvez quand même envoyer une
                nouvelle déclaration.
              </Alert>
            </div>
          )}

          {/* ---------- 2. Le problème ---------- */}
          <section className={`flex flex-col gap-3 ${step === 1 ? "max-lg:hidden" : ""}`}>
            <SectionTitle n={2}>Que se passe-t-il ?</SectionTitle>
            <div role="group" aria-label="Symptômes" className="flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => {
                const on = v.symptoms.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSymptom(s)}
                    className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-[15px] font-semibold border-0 cursor-pointer ${
                      on
                        ? "bg-filter-active text-background"
                        : "bg-surface text-text shadow-[inset_0_0_0_1.5px_var(--color-ring)] hover:bg-surface-2"
                    }`}
                  >
                    {on && <Icon name="check" size={16} />}
                    {s}
                  </button>
                );
              })}
            </div>
            <Field label="Un détail à ajouter ?" htmlFor="panne-detail" optional>
              <textarea
                id="panne-detail"
                rows={3}
                value={v.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Ex. le voyant est éteint depuis ce matin"
                className="w-full rounded border-[1.5px] border-border-strong bg-surface px-3.5 py-3 text-[16px] text-text outline-0 resize-y placeholder:text-text-muted focus:border-orange focus:shadow-[0_0_0_3px_var(--color-orange-selected)]"
              />
            </Field>
          </section>

          {/* ---------- 3. L'urgence ---------- */}
          <section className={`flex flex-col gap-3 ${step === 1 ? "max-lg:hidden" : ""}`}>
            <SectionTitle n={3}>Est-ce urgent ?</SectionTitle>
            <div role="radiogroup" aria-label="Est-ce urgent ?" className="grid gap-3 lg:grid-cols-2">
              {URGENCY.map((u) => {
                const on = v.type === u.value;
                return (
                  <button
                    key={u.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("type", u.value)}
                    className={`flex items-start gap-3 p-4 rounded-lg text-left border-0 cursor-pointer ${
                      on ? u.selected : "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-border)] hover:bg-background"
                    }`}
                  >
                    <span
                      className={`size-9 rounded flex items-center justify-center shrink-0 bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] ${
                        u.value === "urgence" ? "text-danger" : "text-text"
                      }`}
                    >
                      <Icon name={u.icon} size={20} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold text-[16px]">{u.title}</span>
                      <span className="block text-text-muted text-[14px]">{u.text}</span>
                    </span>
                    {on && <Icon name="check" className={u.value === "urgence" ? "text-danger" : "text-text"} />}
                  </button>
                );
              })}
            </div>
            {error("type") && <p className="text-danger text-[14px] font-semibold m-0">{error("type")}</p>}
          </section>
        </div>

        {/* Pied : mobile étape 1 = « Continuer » seulement pour une machine hors liste */}
        <footer
          className={`flex items-center gap-3 px-4 lg:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface lg:justify-end ${
            step === 1 && !notListed ? "max-lg:hidden" : ""
          }`}
        >
          <Link
            href={closeHref}
            className="hidden lg:inline-flex items-center h-field px-5 rounded font-semibold text-text shadow-[inset_0_0_0_1.5px_#D6CBBB] hover:bg-surface-2"
          >
            Annuler
          </Link>
          {step === 1 && notListed && (
            <Button
              className="lg:hidden flex-1"
              disabled={!v.freeText.trim()}
              onClick={() => setStep(2)}
            >
              Continuer
            </Button>
          )}
          <Button
            type="submit"
            icon="send"
            disabled={pending}
            size="md"
            className={`max-lg:flex-1 max-lg:h-cta ${step === 1 ? "max-lg:hidden" : ""}`}
          >
            {pending ? "Envoi…" : "Envoyer la déclaration"}
          </Button>
        </footer>
      </form>
    </>
  );
}
