"use client";

// Clôturer une intervention (M-06b / panneau O-07).
// « Enregistrer » garde le travail en cours et le technicien sans clôturer ;
// « Clôturer » termine l'intervention, décompte les pièces du stock et remet la machine
// dans l'état choisi (fonction SQL cloturer_intervention, une seule transaction).
// Chaque pièce affiche ce qu'il restera en stock et prévient sous le seuil.
// Photos « après » (facultatives) : envoyées une fois la clôture faite ; en cas d'échec,
// la clôture reste faite et la fiche le signale (?photos_echec=N).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cloturerIntervention,
  enregistrerIntervention,
  type InterventionResult,
} from "@/app/(app)/interventions/actions";
import type { EquipmentState } from "@/lib/equipements";
import type { StockPart } from "@/lib/interventions";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { TechnicianPicker } from "@/components/app/interventions/technician-picker";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PhotoPicker, type PendingPhoto } from "@/components/app/photos/photos";
import { sendPhotos } from "@/lib/photos-browser";

const STATES_AFTER: { value: EquipmentState; label: string }[] = [
  { value: "operationnel", label: "Opérationnel" },
  { value: "en_panne", label: "En panne" },
  { value: "hors_service", label: "Hors service" },
];

function PartLine({
  part,
  quantity,
  onChange,
}: {
  part: StockPart;
  quantity: number;
  onChange: (q: number) => void; // 0 = retirer la pièce
}) {
  const after = part.quantity - quantity;
  return (
    <div className="flex flex-col gap-2 p-3.5 rounded bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px] truncate">{part.name}</div>
          <div className="text-text-muted text-[13px]">
            {part.code} · en stock : {part.quantity}
          </div>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label={`Quantité de ${part.name}`}>
          <button
            type="button"
            onClick={() => onChange(quantity - 1)}
            aria-label={quantity === 1 ? `Retirer ${part.name}` : "Une de moins"}
            className="size-touch rounded bg-surface-2 border-0 flex items-center justify-center text-text cursor-pointer hover:bg-border"
          >
            <Icon name={quantity === 1 ? "trash" : "minus"} size={18} />
          </button>
          <span className="w-8 text-center font-bold text-[16px] tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => onChange(quantity + 1)}
            disabled={quantity >= part.quantity}
            aria-label="Une de plus"
            className="size-touch rounded bg-surface-2 border-0 flex items-center justify-center text-text cursor-pointer hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
      {after < 0 ? (
        <div className="flex items-center gap-1.5 text-danger text-[13px] font-semibold">
          <Icon name="xc" size={16} /> Stock insuffisant : il en reste {part.quantity}.
        </div>
      ) : (
        after < part.min_threshold && (
          <div className="flex items-start gap-1.5 rounded-sm bg-warning-bg text-warning px-2.5 py-2 text-[13px] font-semibold">
            <Icon name="down" size={16} className="mt-px shrink-0" />
            Il en restera {after}, sous le seuil de {part.min_threshold}. Pensez à commander.
          </div>
        )
      )}
    </div>
  );
}

export function ClosingForm({
  interventionId,
  restaurantId,
  hasEquipment,
  initialWorkDone,
  initialAssignee,
  technicians,
  parts,
}: {
  interventionId: string;
  restaurantId: string;
  hasEquipment: boolean; // machine hors liste : pas d'état à remettre
  initialWorkDone: string;
  initialAssignee: string | null;
  technicians: ComboOption[]; // technicianOptions (lib/interventions.ts)
  parts: StockPart[];
}) {
  const [workDone, setWorkDone] = useState(initialWorkDone);
  const [assignedTo, setAssignedTo] = useState(initialAssignee ?? "");
  const [stateAfter, setStateAfter] = useState<EquipmentState>("operationnel");
  const [used, setUsed] = useState<{ partId: string; quantity: number }[]>([]);
  const [pickerKey, setPickerKey] = useState(0); // remet à zéro la recherche de pièce
  const [result, setResult] = useState<InterventionResult>(null);
  const [pending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [sendingPhotos, setSendingPhotos] = useState(false);
  const router = useRouter();

  const partById = new Map(parts.map((p) => [p.id, p]));
  // Pièces encore proposables : en stock et pas déjà ajoutées.
  const available = parts.filter((p) => p.quantity > 0 && !used.some((u) => u.partId === p.id));

  const setQuantity = (partId: string, q: number) =>
    setUsed((cur) =>
      q <= 0 ? cur.filter((u) => u.partId !== partId) : cur.map((u) => (u.partId === partId ? { ...u, quantity: q } : u)),
    );

  const save = () =>
    startTransition(async () => {
      setResult(
        await enregistrerIntervention({ id: interventionId, workDone, assignedTo: assignedTo || null }),
      );
    });

  const close = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const blobs = photos.map((p) => p.blob);
      const res = await cloturerIntervention({
        id: interventionId,
        workDone,
        stateAfter,
        assignedTo: assignedTo || null,
        parts: used,
        photosToFollow: blobs.length > 0,
      });
      setResult(res);
      if (!res?.ok || blobs.length === 0) return;
      setSendingPhotos(true);
      const { failed } = await sendPhotos(restaurantId, interventionId, "apres", blobs);
      if (failed > 0) {
        const url = new URL(window.location.href);
        url.searchParams.set("photos_echec", String(failed));
        router.replace(`${url.pathname}${url.search}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={close} noValidate className="flex flex-col gap-5">
      <h3 className="font-display text-[20px] font-semibold m-0">Clôturer l&apos;intervention</h3>

      <Field label="Ce qui a été fait" htmlFor="work-done">
        <textarea
          id="work-done"
          rows={3}
          value={workDone}
          onChange={(e) => setWorkDone(e.target.value)}
          placeholder="Ex. résistance remplacée, test de chauffe correct"
          className="w-full rounded border-[1.5px] border-border-strong bg-surface px-3.5 py-3 text-[16px] text-text outline-0 resize-y placeholder:text-text-muted focus:border-orange focus:shadow-[0_0_0_3px_var(--color-orange-selected)]"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="text-[14px] font-semibold">Pièces utilisées</div>
        {used.map((u) => {
          const part = partById.get(u.partId);
          return part ? (
            <PartLine key={u.partId} part={part} quantity={u.quantity} onChange={(q) => setQuantity(u.partId, q)} />
          ) : null;
        })}
        {available.length > 0 ? (
          <Combobox
            key={pickerKey}
            options={available.map((p) => ({
              value: p.id,
              label: p.name,
              hint: `${p.planned ? "prévue · " : ""}en stock : ${p.quantity}`,
            }))}
            value={null}
            onChange={(val) => {
              if (val && "id" in val) {
                const part = partById.get(val.id);
                if (part) setUsed((cur) => [...cur, { partId: val.id, quantity: 1 }]);
                setPickerKey((k) => k + 1);
              }
            }}
            placeholder="Ajouter une pièce du stock…"
          />
        ) : (
          used.length === 0 && (
            <p className="text-text-muted text-[14px] m-0">Aucune pièce en stock pour le moment.</p>
          )
        )}
      </div>

      {hasEquipment && (
        <div>
          <div className="text-[14px] font-semibold mb-1.5">État de la machine après</div>
          <SegmentedControl
            ariaLabel="État de la machine après"
            options={STATES_AFTER}
            value={stateAfter}
            onChange={setStateAfter}
          />
        </div>
      )}

      <PhotoPicker
        title="Photos après (facultatif)"
        photos={photos}
        setPhotos={setPhotos}
        disabled={pending}
        hint="Envoyées au moment de la clôture."
      />

      <Field label="Technicien" htmlFor="technician" hint="Tapez un prénom ou un e-mail. Il est prévenu dès l'enregistrement.">
        <TechnicianPicker
          id="technician"
          options={technicians}
          value={assignedTo || null}
          onChange={(id) => setAssignedTo(id ?? "")}
        />
      </Field>

      {result?.ok === false && <Alert variant="danger">{result.error}</Alert>}
      {result?.ok === true && <Alert variant="success">{result.message}</Alert>}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={save} disabled={pending} className="flex-1">
          Enregistrer
        </Button>
        <Button type="submit" icon="check" disabled={pending} className="flex-[2]">
          {sendingPhotos ? "Envoi des photos…" : pending ? "Envoi…" : "Clôturer l'intervention"}
        </Button>
      </div>
    </form>
  );
}
