"use client";

// Bloc « En stock » de la fiche pièce (M-07b / panneau O-08).
// − / + : correction d'une unité (ajustement d'inventaire). « Enregistrer une livraison » :
// quantité reçue. Réservé au propriétaire et à l'éditeur ; les autres voient la quantité.
import { useState, useTransition } from "react";
import { mouvementStock, type StockResult } from "@/app/(app)/stock/actions";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";

export function StockControls({
  partId,
  quantity,
  threshold,
  unitOne,
  unitMany,
  canEdit,
}: {
  partId: string;
  quantity: number;
  threshold: number;
  unitOne: string; // « pièce »
  unitMany: string; // « pièces »
  canEdit: boolean;
}) {
  const [delivery, setDelivery] = useState<string | null>(null); // saisie en cours, null = fermé
  const [result, setResult] = useState<StockResult>(null);
  const [pending, startTransition] = useTransition();
  const missing = threshold - quantity;
  const unit = (n: number) => (Math.abs(n) > 1 ? unitMany : unitOne);

  const move = (delta: number, reason: "livraison" | "ajustement") =>
    startTransition(async () => {
      const res = await mouvementStock({ partId, delta, reason });
      setResult(res);
      if (res?.ok) setDelivery(null);
    });

  const stepBtn =
    "size-12 rounded bg-surface border-0 shadow-[inset_0_0_0_1.5px_var(--color-ring)] flex items-center justify-center text-text cursor-pointer hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col gap-3 p-5 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)] lg:bg-background lg:shadow-none">
      <div className="text-center text-text-muted text-[14px] lg:hidden">En stock</div>
      <div className="flex items-center justify-center gap-5">
        {canEdit && (
          <button
            type="button"
            className={stepBtn}
            aria-label="Retirer une unité (correction)"
            disabled={pending || quantity === 0}
            onClick={() => move(-1, "ajustement")}
          >
            <Icon name="minus" />
          </button>
        )}
        <div className="text-center min-w-24">
          <div className="font-display text-[40px] font-semibold leading-none tabular-nums" aria-live="polite">
            {quantity}
          </div>
          <div className="text-text-muted text-[14px] mt-1">
            {unit(quantity)}
            <span className="hidden lg:inline"> en stock{missing > 0 ? ` · il en manque ${missing}` : ""}</span>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            className={stepBtn}
            aria-label="Ajouter une unité (correction)"
            disabled={pending}
            onClick={() => move(1, "ajustement")}
          >
            <Icon name="plus" />
          </button>
        )}
      </div>

      {missing > 0 && (
        <div className="flex items-start gap-1.5 rounded-sm bg-warning-bg text-warning px-3 py-2.5 text-[14px] font-semibold lg:hidden">
          <Icon name="down" size={18} className="mt-px shrink-0" />
          Il en manque {missing} pour atteindre le seuil de {threshold}.
        </div>
      )}

      {canEdit &&
        (delivery === null ? (
          <Button icon="plus" onClick={() => setDelivery("")} disabled={pending} className="w-full">
            Enregistrer une livraison
          </Button>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              move(Number(delivery), "livraison");
            }}
          >
            <label htmlFor="delivery-qty" className="text-[14px] font-semibold">
              Quantité reçue ({unitMany})
            </label>
            <div className="flex gap-2">
              <TextInput
                id="delivery-qty"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                autoFocus
                className="flex-1"
              />
              <Button type="submit" disabled={pending || !(Number(delivery) > 0)}>
                Valider
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setDelivery(null)}
              className="self-start bg-transparent border-0 p-0 py-2 text-orange-text font-semibold text-[14px] cursor-pointer"
            >
              Annuler
            </button>
          </form>
        ))}

      <p role="status" className="m-0 text-[14px] font-semibold empty:hidden">
        {result?.ok === true && <span className="text-success">{result.message}</span>}
        {result?.ok === false && <span className="text-danger">{result.error}</span>}
      </p>
    </div>
  );
}
