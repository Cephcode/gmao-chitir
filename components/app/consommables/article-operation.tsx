"use client";

// Bloc « Mettre à jour le stock » de la fiche article : restaurant, opération (livraison,
// consommation, perte, inventaire, transfert, seuil), quantité, remarque.
// Réservé au propriétaire et à l'éditeur ; la base vérifie aussi le restaurant.
import { useState, useTransition } from "react";
import { arreterSuivi, operationArticle, type ConsoResult } from "@/app/(app)/consommables/actions";
import {
  OPERATIONS,
  OPERATION_LABELS,
  QUANTITE_LABELS,
  type Operation,
  ecartInventaire,
  uniteLabel,
} from "@/lib/consommables-rules";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, TextInput, focusHalo } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Restaurant = { id: string; short_code: string; name: string };
type Stock = { quantity: number; min_threshold: number };

// Liste native (sélecteur du téléphone), habillée comme un champ.
function Select({ id, value, onChange, children, invalid }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  invalid?: boolean;
}) {
  return (
    <div className={`relative flex items-center h-field rounded border-[1.5px] bg-surface ${invalid ? "border-danger" : `border-border-strong ${focusHalo}`}`}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none w-full h-full bg-transparent pl-3.5 pr-10 text-[16px] text-text outline-none cursor-pointer">
        {children}
      </select>
      <Icon name="chevronDown" className="absolute right-3.5 pointer-events-none" />
    </div>
  );
}

export function ArticleOperation({
  articleId,
  unit,
  restaurants,
  stocks,
  defaultRestaurantId,
}: {
  articleId: string;
  unit: string;
  restaurants: Restaurant[]; // restaurants accessibles
  stocks: Record<string, Stock>; // par restaurant suivi
  defaultRestaurantId: string;
}) {
  const [restaurantId, setRestaurantId] = useState(defaultRestaurantId);
  const [operation, setOperation] = useState<Operation>("livraison");
  const [quantite, setQuantite] = useState("");
  const [versId, setVersId] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ConsoResult>(null);
  const [pending, startTransition] = useTransition();

  const stock = stocks[restaurantId];
  const enStock = stock?.quantity ?? 0;
  const autres = restaurants.filter((r) => r.id !== restaurantId);
  const n = Number(quantite);
  const saisie = quantite.trim() !== "" && Number.isInteger(n);
  const fieldError = (f: string) => (result && !result.ok && result.field === f ? result.error : undefined);

  const choisirOperation = (op: Operation) => {
    setOperation(op);
    setResult(null);
    // Seuil : on part du seuil actuel.
    setQuantite(op === "seuil" && stock ? String(stock.min_threshold) : "");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await operationArticle({
        articleId,
        operation,
        restaurantId,
        quantite: quantite.trim() === "" ? NaN : n,
        versId: operation === "transfert" ? versId || null : null,
        note: operation === "seuil" ? "" : note,
      });
      setResult(res);
      if (res?.ok) {
        setQuantite("");
        setNote("");
      }
    });
  };

  const stopSuivi = () =>
    startTransition(async () => {
      setResult(await arreterSuivi(articleId, restaurantId));
    });

  // Aide sous la quantité : stock actuel, écart d'inventaire, reste après sortie.
  let hint = stock ? `En stock : ${enStock} ${uniteLabel(unit, enStock)}.` : "Pas encore suivi dans ce restaurant.";
  if (saisie && operation === "inventaire") {
    const ecart = ecartInventaire(enStock, n);
    hint = ecart === 0 ? `${hint} Aucun écart.` : `${hint} Écart : ${ecart > 0 ? "+" : "−"}${Math.abs(ecart)}.`;
  } else if (saisie && n > 0 && (operation === "consommation" || operation === "perte" || operation === "transfert")) {
    hint = n > enStock ? `${hint} Stock insuffisant.` : `${hint} Restera ${enStock - n}.`;
  } else if (operation === "seuil") {
    hint = "Une alerte part quand le stock passe sous ce nombre.";
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)] lg:bg-background lg:shadow-none">
      <h3 className="font-display text-[18px] font-semibold m-0">Mettre à jour le stock</h3>

      <Field label="Restaurant" htmlFor="op-restaurant" error={fieldError("restaurant")}>
        <Select id="op-restaurant" value={restaurantId} onChange={(v) => { setRestaurantId(v); setResult(null); }}>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.short_code} · {r.name}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <div className="text-[14px] font-semibold mb-1.5">Opération</div>
        <SegmentedControl
          ariaLabel="Opération"
          options={OPERATIONS.filter((o) => o !== "transfert" || autres.length > 0).map((o) => ({ value: o, label: OPERATION_LABELS[o] }))}
          value={operation}
          onChange={choisirOperation}
        />
      </div>

      {operation === "transfert" && (
        <Field label="Vers le restaurant" htmlFor="op-vers" error={fieldError("vers")}>
          <Select id="op-vers" value={versId} onChange={setVersId} invalid={Boolean(fieldError("vers"))}>
            <option value="">Choisir…</option>
            {autres.map((r) => (
              <option key={r.id} value={r.id}>
                {r.short_code} · {r.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        label={`${QUANTITE_LABELS[operation]} (${uniteLabel(unit, 2)})`}
        htmlFor="op-quantite"
        error={fieldError("quantite")}
        hint={hint}
      >
        <TextInput
          id="op-quantite"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          invalid={Boolean(fieldError("quantite"))}
        />
      </Field>

      {operation !== "seuil" && (
        <Field label="Remarque" htmlFor="op-note" optional error={fieldError("note")}>
          <TextInput
            id="op-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={operation === "livraison" ? "Ex. fournisseur, n° de bon" : "Ex. service du soir"}
          />
        </Field>
      )}

      <Button type="submit" disabled={pending || quantite.trim() === ""} className="w-full">
        {pending ? "Enregistrement…" : `Enregistrer : ${OPERATION_LABELS[operation].toLowerCase()}`}
      </Button>

      <p role="status" className="m-0 text-[14px] font-semibold empty:hidden">
        {result?.ok === true && <span className="text-success">{result.message}</span>}
        {result?.ok === false && !result.field && <span className="text-danger">{result.error}</span>}
      </p>

      {stock && stock.quantity === 0 && (
        <button
          type="button"
          onClick={stopSuivi}
          disabled={pending}
          className="self-start bg-transparent border-0 p-0 py-2 text-orange-text font-semibold text-[14px] cursor-pointer disabled:opacity-50"
        >
          Ne plus suivre cet article dans ce restaurant
        </button>
      )}
    </form>
  );
}
