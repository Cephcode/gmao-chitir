"use client";
// Écran d'erreur des pages connectées (maquettes M-Etat-erreur et D-Etats).
// Remplace la page par défaut de Next (en anglais, sans menu) : le menu et le bouton
// « Déclarer une panne » du layout restent visibles, et « Réessayer » relance la page.
// Le détail de l'erreur n'est jamais montré (en production, Next ne transmet qu'une
// référence, `digest`, qui permet de retrouver l'erreur dans les journaux Vercel).
import Link from "next/link";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto px-4 lg:px-8 pt-5 lg:pt-16">
      <div
        role="alert"
        className="bg-surface rounded-lg shadow-[0_0_0_1px_var(--color-border)] px-5 py-6 flex flex-col items-center text-center gap-3"
      >
        <div className="size-16 rounded-full bg-danger-bg text-danger flex items-center justify-center">
          <Icon name="alertCircle" size={32} />
        </div>
        <h1 className="font-display text-[18px] font-semibold m-0">Impossible d&apos;afficher cette page</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Le réseau ne répond peut-être pas. Vérifiez le Wi-Fi ou les données mobiles, puis réessayez.
        </p>
        <button type="button" onClick={() => retry()} className={`${buttonClass({ variant: "secondary" })} w-full`}>
          <Icon name="refresh" />
          Réessayer
        </button>
        <Link href="/" className={`${buttonClass({ variant: "ghost" })} w-full`}>
          Retour à l&apos;accueil
        </Link>
        {error.digest && <p className="m-0 text-[12px] text-text-muted">Référence : {error.digest}</p>}
      </div>
    </div>
  );
}
