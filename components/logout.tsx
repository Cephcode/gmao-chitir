"use client";

import { useTransition } from "react";
import { Icon } from "@/components/icons";
import { deconnexion } from "@/lib/auth-actions";
import { oublierCetAppareil } from "@/lib/push-appareil";
import { Button } from "@/components/ui/button";

export function Logout() {
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await oublierCetAppareil();
      await deconnexion();
    });
  }

  return (
    <div className="lg:hidden flex items-center gap-3 p-4 rounded-lg shadow-[0_0_0_1px_var(--color-border)] text-text">
      <Button
        type="button"
        variant="danger"
        disabled={pending}
        onClick={handleLogout}
        className="flex-1 items-center justify-center gap-2"
      >
        <span className="font-semibold">Se déconnecter</span>
        <Icon name="logout" />
      </Button>
    </div>
  );
}