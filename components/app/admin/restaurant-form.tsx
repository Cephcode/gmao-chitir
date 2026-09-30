"use client";

// Ajouter un restaurant (O-11) : nom, code court, adresse, et équipements de départ
// (partir de zéro ou copier la liste d'un restaurant existant, sans historique).
import Link from "next/link";
import { useState, useTransition } from "react";
import { ajouterRestaurant, type RestaurantResult } from "@/app/(app)/admin/actions";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

export function RestaurantForm({
  sources,
  cancelHref,
}: {
  sources: { id: string; short_code: string; count: number }[];
  cancelHref: string;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [result, setResult] = useState<RestaurantResult>(null);
  const [pending, startTransition] = useTransition();
  const fieldError = (f: "name" | "code") => (result && result.field === f ? result.error : undefined);

  const choices = [
    { id: null, title: "Partir de zéro", text: "Ajouter les machines une à une." },
    ...sources.map((s) => ({
      id: s.id as string | null,
      title: `Copier la liste de ${s.short_code}`,
      text: `${s.count} machine${s.count > 1 ? "s" : ""}, sans historique. À ajuster ensuite.`,
    })),
  ];

  return (
    <>
      <Link href={cancelHref} aria-label="Fermer" className="hidden lg:block fixed inset-0 z-40 bg-[rgba(34,23,15,.35)]" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await ajouterRestaurant({ name, shortCode: code, address, copyFrom })));
        }}
        noValidate
        className="fixed inset-0 z-50 flex flex-col bg-background lg:left-auto lg:w-[500px] lg:bg-surface lg:shadow-[-12px_0_32px_rgba(43,26,16,.18)]"
      >
        <header className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-surface">
          <h1 className="flex-1 font-display text-[18px] lg:text-[20px] font-semibold m-0">Ajouter un restaurant</h1>
          <Link href={cancelHref} aria-label="Fermer" className="size-touch flex items-center justify-center rounded text-text hover:bg-surface-2">
            <Icon name="x" />
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-5">
          {result && !result.field && <Alert variant="danger">{result.error}</Alert>}
          <Field label="Nom du restaurant" htmlFor="resto-name" error={fieldError("name")}>
            <TextInput id="resto-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Chitir Chicken Tampouy" invalid={Boolean(fieldError("name"))} autoFocus />
          </Field>
          <Field
            label="Code court"
            htmlFor="resto-code"
            error={fieldError("code")}
            hint={`Sert à nommer les machines : ${code || "CTR3"}-REF-01, ${code || "CTR3"}-CUI-01…`}
          >
            <TextInput
              id="resto-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="CTR3"
              maxLength={6}
              autoCapitalize="characters"
              invalid={Boolean(fieldError("code"))}
            />
          </Field>
          <Field label="Adresse ou repère" htmlFor="resto-address" optional>
            <TextInput id="resto-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <fieldset className="border-0 m-0 p-0 flex flex-col gap-2">
            <legend className="text-[14px] font-semibold mb-1.5">Équipements de départ</legend>
            <div role="radiogroup" aria-label="Équipements de départ" className="flex flex-col gap-2">
              {choices.map((c) => {
                const on = copyFrom === c.id;
                return (
                  <button
                    key={c.id ?? "zero"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCopyFrom(c.id)}
                    className={`flex items-start gap-3 p-3.5 rounded text-left border-0 cursor-pointer ${
                      on ? "bg-orange-soft shadow-[inset_0_0_0_2px_var(--color-orange)]" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-border)] hover:bg-background"
                    }`}
                  >
                    <span className={`mt-0.5 size-5 rounded-full shrink-0 ${on ? "bg-filter-active shadow-[inset_0_0_0_4px_var(--color-orange-soft)]" : "shadow-[inset_0_0_0_2px_var(--color-border-strong)]"}`} />
                    <span>
                      <span className="block font-bold text-[15px]">{c.title}</span>
                      <span className="block text-text-muted text-[13.5px]">{c.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <footer className="flex items-center gap-3 px-4 lg:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface">
          <div className="flex-1" />
          <Link href={cancelHref} className="hidden lg:inline-flex items-center h-field px-5 rounded font-semibold text-text shadow-[inset_0_0_0_1.5px_#D6CBBB] hover:bg-surface-2">
            Annuler
          </Link>
          <Button type="submit" disabled={pending} className="max-lg:flex-1">
            {pending ? "Ajout…" : "Ajouter le restaurant"}
          </Button>
        </footer>
      </form>
    </>
  );
}
