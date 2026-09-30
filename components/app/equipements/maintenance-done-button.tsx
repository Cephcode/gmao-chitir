"use client";

// Bouton « Noter l'entretien comme fait » : envoie l'action serveur, bloque le double
// appui pendant l'envoi, puis affiche le résultat sous le bouton.
import { useActionState } from "react";
import { noterEntretienFait, type ActionState } from "@/app/(app)/equipements/actions";
import { Button } from "@/components/ui/button";

export function MaintenanceDoneButton({
  equipmentId,
  label = "Noter l'entretien comme fait",
  className = "",
}: {
  equipmentId: string;
  label?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(noterEntretienFait, null);

  return (
    <form action={action} className={`flex flex-col gap-2 ${className}`}>
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <Button type="submit" variant="secondary" icon="check" disabled={pending} className="w-full">
        {pending ? "Enregistrement…" : label}
      </Button>
      <p role="status" className="text-[14px] m-0 empty:hidden">
        {state?.ok === true && <span className="text-success font-semibold">{state.message}</span>}
        {state?.ok === false && <span className="text-danger font-semibold">{state.error}</span>}
      </p>
    </form>
  );
}
