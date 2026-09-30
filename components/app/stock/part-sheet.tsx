// Fiche pièce (M-07b / panneau O-08) : quantité et livraison, seuil, unité,
// machines « va avec » (prévues) et « utilisée sur » (déduit des interventions), mouvements.
import Link from "next/link";
import { dateCourte } from "@/lib/format";
import { type PartRow, canEditStock, isLow, listMovements, listUsedOn, unitLabel } from "@/lib/stock";
import type { Role } from "@/lib/session";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StockControls } from "@/components/app/stock/stock-controls";

const REASON_LABEL = { livraison: "Livraison", ajustement: "Correction d'inventaire" } as const;

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    // Lien de 44 px de haut sur mobile (cible tactile) ; la puce visible garde 32 px.
    <Link href={href} className="group inline-flex items-center min-h-11 lg:min-h-0">
      <span className="h-8 px-3 inline-flex items-center rounded-sm bg-surface-2 text-[13px] font-semibold text-text group-hover:bg-border">
        {children}
      </span>
    </Link>
  );
}

export async function PartSheet({ part: p, role, query }: { part: PartRow; role: Role; query: string }) {
  const [movements, usedOn] = await Promise.all([listMovements(p.id), listUsedOn(p.id)]);
  const canEdit = canEditStock(role);
  const closeHref = `/stock${query}`;
  const editHref = `/stock/${p.id}/modifier${query}`;

  return (
    <article className="flex flex-col gap-5 px-4 pt-3 pb-6 lg:px-6 lg:pt-5">
      <div className="flex items-center gap-2">
        <Link href={closeHref} className="lg:hidden -ml-2 inline-flex items-center gap-1 h-touch px-2 font-semibold text-text">
          <Icon name="chevronRight" className="rotate-180" /> Stock
        </Link>
        <span className="lg:hidden flex-1" />
        <span className="hidden lg:block flex-1 text-text-muted text-[13px] font-semibold">Fiche pièce</span>
        {canEdit && (
          <Link
            href={editHref}
            aria-label="Modifier la pièce"
            className="inline-flex items-center gap-2 h-touch px-2.5 lg:px-3.5 rounded font-semibold text-text lg:shadow-[inset_0_0_0_1.5px_var(--color-ring)] hover:bg-surface-2"
          >
            <Icon name="edit" size={18} />
            <span className="hidden lg:inline">Modifier</span>
          </Link>
        )}
        <Link href={closeHref} aria-label="Fermer la fiche" className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2">
          <Icon name="x" />
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h2 className="font-display text-[22px] font-semibold m-0 leading-tight">{p.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={isLow(p) ? "sousLeSeuil" : "suffisant"} />
          <span className="text-text-muted text-[14px]">{p.code}</span>
        </div>
      </header>

      <StockControls
        partId={p.id}
        quantity={p.quantity}
        threshold={p.min_threshold}
        unitOne={unitLabel(p.unit, 1)}
        unitMany={unitLabel(p.unit, 2)}
        canEdit={canEdit}
      />

      <Card padded={false} className="px-5 divide-y divide-surface-2 lg:px-0 lg:shadow-none">
        <div className="flex justify-between py-3">
          <span className="text-text-muted text-[15px]">Seuil d&apos;alerte</span>
          <span className="font-semibold text-[15px]">
            {p.min_threshold} {unitLabel(p.unit, p.min_threshold)}
          </span>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-text-muted text-[15px]">Unité</span>
          <span className="font-semibold text-[15px]">{unitLabel(p.unit, 1)}</span>
        </div>
        <div className="flex flex-col gap-2 py-3">
          <span className="text-text-muted text-[15px]">Va avec (prévu)</span>
          {p.planned.length ? (
            <div className="flex flex-wrap gap-x-1.5 lg:gap-y-1.5">
              {p.planned.map((m) => (
                <Chip key={m.id} href={`/equipements/${m.id}`}>{m.code}</Chip>
              ))}
            </div>
          ) : (
            <span className="text-[15px]">Toutes machines</span>
          )}
        </div>
        <div className="flex flex-col gap-2 py-3">
          <span className="text-text-muted text-[15px]">Utilisée sur (interventions)</span>
          {usedOn.length ? (
            <div className="flex flex-wrap gap-x-1.5 lg:gap-y-1.5">
              {usedOn.map((m) => (
                <Chip key={m.id} href={`/equipements/${m.id}`}>
                  {m.code} × {m.quantity}
                </Chip>
              ))}
            </div>
          ) : (
            <span className="text-[15px] text-text-muted">Pas encore utilisée</span>
          )}
        </div>
        {p.notes && (
          <div className="flex flex-col gap-1 py-3">
            <span className="text-text-muted text-[15px]">Remarque</span>
            <span className="text-[15px]">{p.notes}</span>
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-[18px] font-semibold m-0">Mouvements</h3>
        {movements.length === 0 ? (
          <p className="m-0 text-text-muted text-[14px]">Aucun mouvement pour le moment.</p>
        ) : (
          <Card padded={false} className="divide-y divide-surface-2 overflow-hidden">
            {movements.map((m) => {
              const i = m.interventions;
              const label =
                m.reason === "intervention"
                  ? [i?.equipments?.name ?? "Intervention", i?.restaurants?.short_code].filter(Boolean).join(" ")
                  : REASON_LABEL[m.reason];
              const content = (
                <>
                  <span className={`w-10 font-bold tabular-nums ${m.delta > 0 ? "text-success" : ""}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] truncate">{label}</span>
                    {m.users?.first_name && <span className="block text-text-muted text-[13px]">{m.users.first_name}</span>}
                  </span>
                  <span className="text-text-muted text-[13px] shrink-0">{dateCourte(m.created_at)}</span>
                </>
              );
              return i ? (
                <Link key={m.id} href={`/interventions/${i.id}`} className="flex items-center gap-3 px-4 py-3 text-text hover:bg-background">
                  {content}
                </Link>
              ) : (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  {content}
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </article>
  );
}
