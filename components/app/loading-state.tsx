// État de chargement des pages (maquettes M-Etat-chargement et D-Etats, colonne 2).
// Affiché par les fichiers loading.tsx pendant que le serveur lit la base : titre de la
// page, message lu par les lecteurs d'écran, puis lignes fantômes à la place des données.
import { Icon } from "@/components/icons";

// Largeurs variées pour que les lignes fantômes ressemblent à une vraie liste.
const WIDTHS = ["70%", "55%", "80%", "60%", "72%", "50%"];

export function LoadingState({ title, label }: { title?: string; label: string }) {
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-4" aria-busy="true">
      {title && (
        <h1 className="font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">{title}</h1>
      )}

      <div role="status" className="flex items-center gap-2 text-[14px] text-text-muted">
        <Icon name="refresh" size={16} />
        {label}
      </div>

      {/* Mobile : cartes */}
      <div className="flex flex-col gap-3.5 lg:hidden" aria-hidden="true">
        {WIDTHS.map((w, i) => (
          <div
            key={i}
            className="bg-surface rounded-lg shadow-[0_0_0_1px_var(--color-border)] flex items-center gap-3 p-3.5 min-h-[72px]"
          >
            <div className="skeleton size-11 shrink-0 rounded-[12px]" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="skeleton h-3.5" style={{ width: w }} />
              <div className="skeleton h-3 w-2/5" />
            </div>
            <div className="skeleton w-[88px] h-6 rounded-full" />
          </div>
        ))}
      </div>

      {/* Ordinateur : tableau dans une carte */}
      <div
        className="hidden lg:block bg-surface rounded-lg shadow-[0_0_0_1px_var(--color-border)] overflow-hidden"
        aria-hidden="true"
      >
        {[...WIDTHS, "65%", "58%"].map((w, i) => (
          <div key={i} className="flex items-center gap-4 h-[58px] px-4 border-b border-surface-2 last:border-b-0">
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="skeleton h-3" style={{ width: w }} />
              <div className="skeleton h-2.5 w-2/5" />
            </div>
            <div className="skeleton h-3 w-[70px]" />
            <div className="skeleton h-[22px] w-[90px] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
