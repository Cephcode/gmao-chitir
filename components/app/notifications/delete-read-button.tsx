"use client";

// « Supprimer les lues » : efface toutes ses notifications déjà lues, après confirmation.
import { useTransition } from "react";
import { supprimerNotificationsLues } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";

export function DeleteReadButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      icon="trash"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Supprimer ${count} notification${count > 1 ? "s" : ""} déjà lue${count > 1 ? "s" : ""} ?`)) return;
        startTransition(() => supprimerNotificationsLues());
      }}
    >
      {pending ? "Suppression..." : "Supprimer les lues"}
    </Button>
  );
}
