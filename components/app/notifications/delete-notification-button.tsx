"use client";

// Bouton « Supprimer la notification » en bas du panneau de détail (équipement,
// intervention, pièce, consommable) ouvert depuis une notification (adresse ?notif=<id>). Masqué si la notification n'existe plus ou n'est pas la sienne.
// Après suppression, ?notif est retiré de l'adresse (le reste est conservé).
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { lireTitreNotification, supprimerNotificationParId } from "@/app/(app)/notifications/actions";
import { NOTIF_PARAM, UUID_RE } from "@/lib/notification-lien";
import { Button } from "@/components/ui/button";

export function DeleteNotificationButton() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.get(NOTIF_PARAM) ?? "";
  const valide = UUID_RE.test(id);
  // Existence vérifiée pour CET id (la sienne et pas encore supprimée).
  const [lu, setLu] = useState<{ id: string; existe: boolean } | null>(null);
  const [erreur, setErreur] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!valide) return;
    let actif = true;
    lireTitreNotification(id).then((titre) => actif && setLu({ id, existe: titre !== null }));
    return () => {
      actif = false;
    };
  }, [id, valide]);

  if (!valide || lu?.id !== id || !lu.existe) return null;

  return (
    // Bas du panneau de détail (même marge latérale que les fiches) : fin de la lecture,
    // séparé du contenu, loin de l'action principale de la fiche placée en haut.
    <div className="flex flex-col gap-1 px-4 pb-6 lg:px-6">
      <Button
        variant="dangerSoft"
        icon="trash"
        className="w-full"
        disabled={pending}
        onClick={() => {
          setErreur(false);
          startTransition(async () => {
            const res = await supprimerNotificationParId(id);
            if (!res.ok) return setErreur(true);
            const p = new URLSearchParams(params.toString());
            p.delete(NOTIF_PARAM);
            const s = p.toString();
            router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
          });
        }}
      >
        {pending ? "Suppression..." : "Supprimer la notification"}
      </Button>
      {erreur && (
        <p role="alert" className="m-0 text-danger font-semibold text-[13px]">
          La notification n&apos;a pas pu être supprimée. Réessayez.
        </p>
      )}
    </div>
  );
}
