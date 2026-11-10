"use client";

// Bandeau en haut de la page ouverte depuis une notification (adresse ?notif=<id>) :
// rappelle la notification et propose de la supprimer, sans revenir à la liste.
// Masqué si la notification n'existe plus ou n'est pas la sienne. Fermer ou supprimer
// retire ?notif de l'adresse (le reste de l'adresse est conservé).
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { lireTitreNotification, supprimerNotificationParId } from "@/app/(app)/notifications/actions";
import { NOTIF_PARAM, UUID_RE } from "@/lib/notification-lien";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function NotificationBanner() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.get(NOTIF_PARAM) ?? "";
  const valide = UUID_RE.test(id);
  // Titre lu pour CET id : un titre d'une autre notification n'est jamais affiché.
  const [lu, setLu] = useState<{ id: string; titre: string | null } | null>(null);
  const [erreur, setErreur] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!valide) return;
    let actif = true;
    lireTitreNotification(id).then((titre) => actif && setLu({ id, titre }));
    return () => {
      actif = false;
    };
  }, [id, valide]);

  const titre = lu?.id === id ? lu.titre : null;
  if (!valide || !titre) return null;

  // Retire ?notif de l'adresse sans recharger la page ni ajouter d'entrée d'historique.
  const fermer = () => {
    const p = new URLSearchParams(params.toString());
    p.delete(NOTIF_PARAM);
    const s = p.toString();
    router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-4">
      <Alert
        variant="info"
        icon="bell"
        title="Ouvert depuis une notification"
        action={
          // -mt / -mr : la croix (44 px, cible tactile) reste alignée sur le titre.
          <Button
            variant="ghost"
            icon="x"
            iconOnly
            aria-label="Fermer le bandeau"
            className="-mt-2.5 -mr-2"
            disabled={pending}
            onClick={fermer}
          />
        }
      >
        <span className="block line-clamp-2">{titre}</span>
        {erreur && (
          <span role="alert" className="block mt-1 text-danger font-semibold text-[13px]">
            La notification n&apos;a pas pu être supprimée. Réessayez.
          </span>
        )}
        <Button
          variant="dangerSoft"
          size="sm"
          icon="trash"
          className="mt-2.5"
          disabled={pending}
          onClick={() => {
            setErreur(false);
            startTransition(async () => {
              const res = await supprimerNotificationParId(id);
              if (res.ok) fermer();
              else setErreur(true);
            });
          }}
        >
          {pending ? "Suppression..." : "Supprimer la notification"}
        </Button>
      </Alert>
    </div>
  );
}
