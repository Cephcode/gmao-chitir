// Liste du stock (M-07a / O-08) : cartes sur mobile, tableau sur ordinateur.
// Pièces sous le seuil en premier, avec un bandeau pour n'afficher qu'elles.
import Link from "next/link";
import { Suspense } from "react";
import { type Filters, type PartRow, filtersQuery, isLow, plannedSummary, unitLabel } from "@/lib/stock";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { UrlFilters } from "@/components/app/url-filters";
import { StockSwitch } from "@/components/app/stock/stock-switch";

export function StockList({
  rows,
  total,
  lowCount,
  filters,
  categories,
  selectedId,
  unread,
  canCreate,
}: {
  rows: PartRow[]; // déjà filtrées, statut compris
  total: number;
  lowCount: number; // sous le seuil, avec les autres filtres
  filters: Filters;
  categories: string[];
  selectedId?: string;
  unread: number;
  canCreate: boolean;
}) {
  const query = filtersQuery(filters);
  const onlyLow = filters.statut === "sous_seuil";

  return (
    <div className="px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">
          Stock <span className="text-text-muted font-normal lg:text-[24px]">{total} pièces</span>
        </h1>
        {canCreate && (
          <>
            <Link href={`/stock/nouvelle${query}`} aria-label="Nouvelle pièce" className="lg:hidden size-touch rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-ring)] flex items-center justify-center text-text">
              <Icon name="plus" />
            </Link>
            <Link href={`/stock/nouvelle${query}`} className={`max-lg:hidden ${buttonClass({ variant: "secondary" })}`}>
              <Icon name="plus" /> Nouvelle pièce
            </Link>
          </>
        )}
        <Link
          href="/notifications"
          aria-label={`Notifications, ${unread} non lues`}
          className="lg:hidden relative size-touch rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-ring)] flex items-center justify-center text-text"
        >
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center shadow-[0_0_0_2px_var(--color-background)] tabular-nums">
              {unread}
            </span>
          )}
        </Link>
      </header>

      <StockSwitch current="pieces" />

      {/* Mobile : onglets Toutes / Sous le seuil */}
      <nav aria-label="Filtre du stock" className="lg:hidden grid grid-cols-2 p-1 rounded bg-surface-2">
        {[
          { statut: "", label: `Toutes (${total})` },
          { statut: "sous_seuil", label: `Sous le seuil (${lowCount})` },
        ].map((t) => {
          const active = filters.statut === t.statut;
          return (
            <Link
              key={t.label}
              href={`/stock${filtersQuery(filters, { statut: t.statut })}`}
              aria-current={active ? "page" : undefined}
              className={`text-center py-2.5 rounded-sm text-[15px] font-semibold ${active ? "bg-surface text-text shadow-[0_1px_2px_rgba(43,26,16,.1)]" : "text-text-muted"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Ordinateur : bandeau des pièces sous le seuil */}
      {lowCount > 0 && (
        <div className="hidden lg:flex items-center gap-3 px-4 py-3 rounded bg-warning-bg shadow-[inset_0_0_0_1px_#F2D68A] text-[14px]">
          <Icon name="down" className="text-warning" />
          <span className="flex-1">
            <strong>{lowCount} pièce{lowCount > 1 ? "s" : ""} sous le seuil.</strong>{" "}
            {onlyLow ? "Seules ces pièces sont affichées." : "Elles sont affichées en premier."}
          </span>
          <Link
            href={`/stock${filtersQuery(filters, { statut: onlyLow ? "" : "sous_seuil" })}`}
            className="h-9 px-3.5 inline-flex items-center rounded-sm bg-surface text-warning font-semibold shadow-[inset_0_0_0_1.5px_#F2D68A] hover:bg-background"
          >
            {onlyLow ? "Tout afficher" : "N'afficher qu'elles"}
          </Link>
        </div>
      )}

      <Suspense>
        <UrlFilters
          basePath="/stock"
          searchLabel="Rechercher une pièce"
          searchPlaceholder="Désignation ou code"
          chips={[
            {
              name: "categorie",
              label: "Va avec",
              options: [
                { value: "toutes", label: "Toutes machines" },
                ...categories.map((c) => ({ value: c, label: c })),
              ],
            },
          ]}
        />
      </Suspense>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-start gap-2">
          <div className="font-semibold">{total === 0 ? "Aucune pièce en stock" : "Aucune pièce ne correspond"}</div>
          <div className="text-text-muted text-[14px]">
            {total === 0
              ? canCreate
                ? "Ajoutez les pièces de rechange avec « Nouvelle pièce »."
                : "Les pièces seront ajoutées par un éditeur."
              : "Changez la recherche ou retirez un filtre."}
          </div>
        </Card>
      ) : (
        <>
          <div className="lg:hidden flex flex-col gap-2.5">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/stock/${p.id}${query}`}
                className="flex flex-col gap-1 p-4 rounded-lg bg-surface text-text shadow-[0_0_0_1px_var(--color-border)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[16px]">{p.name}</span>
                  <StatusBadge status={isLow(p) ? "sousLeSeuil" : "suffisant"} />
                </div>
                <div className="text-text-muted text-[13px]">
                  {p.code} · {plannedSummary(p)}
                </div>
                <div className="text-[14px]">
                  <strong className={isLow(p) ? "text-warning" : ""}>
                    {p.quantity} {unitLabel(p.unit, p.quantity)}
                  </strong>{" "}
                  <span className="text-text-muted">· seuil {p.min_threshold}</span>
                </div>
              </Link>
            ))}
          </div>

          <Card padded={false} className="hidden lg:block overflow-hidden">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="bg-background text-text-muted text-[12px] uppercase tracking-wide text-left">
                  <th className="font-semibold px-4 py-3">Désignation</th>
                  <th className="font-semibold px-4 py-3">Va avec</th>
                  <th className="font-semibold px-4 py-3 text-right">Quantité</th>
                  <th className="font-semibold px-4 py-3 text-right">Seuil</th>
                  <th className="font-semibold px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {rows.map((p) => {
                  const selected = p.id === selectedId;
                  return (
                    <tr key={p.id} className={`relative ${selected ? "bg-orange-soft" : "hover:bg-background"}`}>
                      <td className="px-4 py-2.5">
                        <Link href={`/stock/${p.id}${query}`} aria-current={selected ? "true" : undefined} className="font-semibold text-text after:absolute after:inset-0">
                          {p.name}
                        </Link>
                        <div className="text-text-muted text-[12.5px]">{p.code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{plannedSummary(p)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <strong className={isLow(p) ? "text-warning" : ""}>{p.quantity}</strong> {unitLabel(p.unit, p.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{p.min_threshold}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={isLow(p) ? "sousLeSeuil" : "suffisant"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
