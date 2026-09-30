"use client";
// Bandeau « Installer l'application » (mobile surtout). Sans installation :
// - sur iPhone, les notifications push sont impossibles (iOS ne les permet qu'aux
//   applications ajoutées à l'écran d'accueil) ;
// - sur Android, on les reçoit, mais seulement après les avoir activées dans Mes alertes.
// Android/Chrome : bouton natif (événement beforeinstallprompt). iPhone : consigne manuelle.
// Masqué une fois l'application installée ou le bandeau fermé (mémorisé sur l'appareil).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "gmao-install-ferme";

export function InstallBanner() {
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let ferme = false;
    try {
      ferme = localStorage.getItem(KEY) === "1";
    } catch {}
    if (standalone || ferme) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // Mise à jour d'état après lecture du navigateur (inconnu au rendu serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ios) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault(); // on garde l'invite pour notre bouton
      setEvent(e as InstallEvent);
      setMode("android");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const fermer = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setMode("hidden");
  };
  const installer = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
    setMode("hidden");
  };

  return (
    <div
      role="region"
      aria-label="Installer l'application"
      className="mx-4 lg:mx-8 mt-4 flex items-start gap-3 p-3.5 rounded-lg bg-orange-soft shadow-[inset_0_0_0_1px_var(--color-orange-selected)]"
    >
      <Icon name="bell" className="text-orange-text mt-0.5" />
      <div className="flex-1 min-w-0 text-[14px] flex flex-col gap-2">
        <div>
          <strong>Installez l&apos;application pour recevoir les urgences.</strong>{" "}
          {mode === "ios" ? (
            <>
              Touchez <strong>Partager</strong> puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>, ouvrez
              l&apos;application depuis son icône, puis activez les notifications dans{" "}
              <Link href="/notifications/alertes" className="text-orange-text font-semibold">Mes alertes</Link>.
            </>
          ) : (
            <>
              Ensuite, activez les notifications dans{" "}
              <Link href="/notifications/alertes" className="text-orange-text font-semibold">Mes alertes</Link> :
              sans cela, aucune alerte n&apos;arrive sur le téléphone.
            </>
          )}
        </div>
        {mode === "android" && (
          <div>
            <Button size="sm" onClick={installer}>Installer</Button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={fermer}
        aria-label="Fermer"
        className="size-touch -m-2 flex items-center justify-center rounded text-text-muted bg-transparent border-0 cursor-pointer"
      >
        <Icon name="x" />
      </button>
    </div>
  );
}
