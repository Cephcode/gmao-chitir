"use client";

// « Notifications sur cet appareil » : active ou coupe les push pour ce navigateur.
// Le jeton de l'appareil est gardé localement pour connaître l'état au retour sur la page ;
// il est enregistré côté serveur (push_tokens) pour que l'Edge Function y envoie les alertes.
// Les réglages par type (« Mes alertes ») s'appliquent aussi aux push.
import { useEffect, useState, useTransition } from "react";
import { enregistrerAppareil, oublierAppareil } from "@/app/(app)/notifications/actions";
import { obtenirJetonPush, pushSupported, supprimerJetonPush } from "@/lib/firebase-client";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "gmao-push-token";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

// Message lisible selon l'erreur Firebase ou du navigateur ; le détail technique est
// ajouté pour pouvoir diagnostiquer (il ne contient aucune donnée personnelle).
function explain(err: unknown): string {
  const e = err as { code?: string; message?: string; name?: string };
  const detail = [e?.code ?? e?.name, e?.message].filter(Boolean).join(" · ");
  let hint = "Activation impossible.";
  if (/push service error|AbortError/i.test(detail)) {
    hint =
      "Ce navigateur n'a pas accès au service de notifications push (fréquent avec Chromium ou Brave sous Linux). Essayez Google Chrome ou Firefox.";
  } else if (/service-worker|serviceworker/i.test(detail)) {
    hint = "Le service de notifications n'a pas pu s'installer. Rechargez la page et réessayez.";
  } else if (/token-subscribe-failed|PERMISSION_DENIED|API has not been used|disabled/i.test(detail)) {
    hint = "Firebase a refusé l'inscription de cet appareil (configuration du projet Firebase).";
  } else if (/serveur/i.test(detail)) {
    hint = "L'appareil n'a pas pu être enregistré. Réessayez.";
  }
  return detail ? `${hint} Détail : ${detail}` : hint;
}

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : l'état sera recalculé à la prochaine visite.
  }
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    pushSupported().then((ok) => {
      if (!ok) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      setState(Notification.permission === "granted" && readToken() ? "on" : "off");
    });
  }, []);

  const activer = () =>
    startTransition(async () => {
      setError(null);
      try {
        const token = await obtenirJetonPush();
        if (!token) {
          setState(Notification.permission === "denied" ? "denied" : "off");
          return;
        }
        const res = await enregistrerAppareil(token, navigator.userAgent);
        if (!res.ok) throw new Error("enregistrement refusé par le serveur");
        writeToken(token);
        setState("on");
      } catch (err) {
        console.error("Activation des notifications push", err);
        setError(explain(err));
      }
    });

  const couper = () =>
    startTransition(async () => {
      setError(null);
      const token = readToken();
      try {
        await supprimerJetonPush();
      } catch {
        // Jeton déjà invalide : on l'oublie quand même côté serveur.
      }
      if (token) await oublierAppareil(token);
      writeToken(null);
      setState("off");
    });

  if (state === "loading") return null;

  return (
    <div className="flex flex-col gap-2 p-4 rounded bg-background">
      <div className="flex items-center gap-3">
        <Icon name="bell" className={state === "on" ? "text-success" : "text-text-muted"} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px]">Notifications sur cet appareil</div>
          <div className="text-text-muted text-[13px]">
            {state === "on" && "Activées : les alertes s'affichent même application fermée."}
            {state === "off" && "Recevez les urgences même quand l'application est fermée."}
            {state === "denied" &&
              "Bloquées par le navigateur : autorisez les notifications pour ce site dans ses réglages."}
            {state === "unsupported" &&
              "Pas disponibles sur ce navigateur. Sur iPhone, ajoutez d'abord l'application à l'écran d'accueil."}
          </div>
        </div>
      </div>
      {state === "off" && (
        <Button size="sm" onClick={activer} disabled={pending}>
          {pending ? "Activation…" : "Activer"}
        </Button>
      )}
      {state === "on" && (
        <Button size="sm" variant="secondary" onClick={couper} disabled={pending}>
          Couper sur cet appareil
        </Button>
      )}
      {error && (
        <p role="alert" className="m-0 text-danger text-[13px] font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
