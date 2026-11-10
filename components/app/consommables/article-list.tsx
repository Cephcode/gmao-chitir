// Liste des consommables : cartes sur mobile, tableau sur ordinateur (même gabarit que le
// stock de pièces). Quantités du restaurant choisi, ou total des restaurants visibles.
// Articles sous le seuil en premier, avec un bandeau pour n'afficher qu'eux.
import Link from "next/link";
import { Suspense } from "react";
import { type ArticleLigne, type Restaurant } from "@/lib/consommables";
import { FAMILLES, FAMILLE_LABELS, type Filtres, type Famille, filtresQuery, uniteLabel } from "@/lib/consommables-rules";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { UrlFilters } from "@/components/app/url-filters";
import { StockSwitch } from "@/components/app/stock/stock-switch";

// « Sous le seuil : CTR1, CTR3 » (vue tous restaurants), sinon le seuil du restaurant.
function detail(a: ArticleLigne, codeOf: Map<string, string>) {
  const r = a.resume;
  if (r.statut === "nonSuivi") return "Pas encore en stock";
  if (r.seuil !== null) return `seuil ${r.seuil}`;
  if (r.sousSeuil.length) return `sous le seuil : ${r.sousSeuil.map((id) => codeOf.get(id)).join(", ")}`;
  return `${r.suivis} restaurant${r.suivis > 1 ? "s" : ""}`;
}

export function ArticleList({
  rows,
  total,
  lowCount,
  filters,
  restaurants,
  restaurant,
  selectedId,
  unread,
  canCreate,
}: {
  rows: ArticleLigne[]; // déjà filtrées, statut compris
  total: number;
  lowCount: number; // sous le seuil, avec les autres filtres
  filters: Filtres;
  restaurants: Restaurant[];
  restaurant: Restaurant | null; // restaurant choisi, null = tous
  selectedId?: string;
  unread: number;
  canCreate: boolean;
}) {
  const query = filtresQuery(filters);
  const onlyLow = filters.statut === "sous_seuil";
  const codeOf = new Map(restaurants.map((r) => [r.id, r.short_code]));
  const scope = restaurant ? restaurant.short_code : "tous restaurants";

  return (
    <div className="px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 min-w-0 font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">
          Consommables{" "}
          <span className="text-text-muted font-normal lg:text-[24px]">
            {total} article{total > 1 ? "s" : ""}
          </span>
        </h1>
        {canCreate && (
          <>
            <Link href={`/consommables/nouveau${query}`} aria-label="Nouvel article" className="lg:hidden size-touch rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-ring)] flex items-center justify-center text-text">
              <Icon name="plus" />
            </Link>
            <Link href={`/consommables/nouveau${query}`} className={`max-lg:hidden ${buttonClass({ variant: "secondary" })}`}>
              <Icon name="plus" /> Nouvel article
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

      <StockSwitch current="consommables" />

      {/* Mobile : onglets Tous / Sous le seuil */}
      <nav aria-label="Filtre des consommables" className="lg:hidden grid grid-cols-2 p-1 rounded bg-surface-2">
        {[
          { statut: "", label: `Tous (${total})` },
          { statut: "sous_seuil", label: `Sous le seuil (${lowCount})` },
        ].map((t) => {
          const active = filters.statut === t.statut;
          return (
            <Link
              key={t.label}
              href={`/consommables${filtresQuery(filters, { statut: t.statut })}`}
              aria-current={active ? "page" : undefined}
              className={`text-center py-2.5 rounded-sm text-[15px] font-semibold ${active ? "bg-surface text-text shadow-[0_1px_2px_rgba(43,26,16,.1)]" : "text-text-muted"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Ordinateur : bandeau des articles sous le seuil */}
      {lowCount > 0 && (
        <div className="hidden lg:flex items-center gap-3 px-4 py-3 rounded bg-warning-bg shadow-[inset_0_0_0_1px_#F2D68A] text-[14px]">
          <Icon name="down" className="text-warning" />
          <span className="flex-1">
            <strong>
              {lowCount} article{lowCount > 1 ? "s" : ""} sous le seuil ({scope}).
            </strong>{" "}
            {onlyLow
              ? lowCount > 1 ? "Seuls ces articles sont affichés." : "Seul cet article est affiché."
              : lowCount > 1 ? "Ils sont affichés en premier." : "Il est affiché en premier."}
          </span>
          <Link
            href={`/consommables${filtresQuery(filters, { statut: onlyLow ? "" : "sous_seuil" })}`}
            className="h-9 px-3.5 inline-flex items-center rounded-sm bg-surface text-warning font-semibold shadow-[inset_0_0_0_1.5px_#F2D68A] hover:bg-background"
          >
            {onlyLow ? "Tout afficher" : "N'afficher qu'eux"}
          </Link>
        </div>
      )}

      <Suspense>
        <UrlFilters
          basePath="/consommables"
          searchLabel="Rechercher un article"
          searchPlaceholder="Désignation ou code"
          chips={[
            {
              name: "restaurant",
              label: "Restaurant",
              options: restaurants.map((r) => ({ value: r.short_code, label: `${r.short_code} · ${r.name}` })),
            },
            {
              name: "famille",
              label: "Famille",
              options: FAMILLES.map((f) => ({ value: f, label: FAMILLE_LABELS[f] })),
            },
          ]}
        />
      </Suspense>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-start gap-2">
          <div className="font-semibold">{total === 0 ? "Aucun article au catalogue" : "Aucun article ne correspond"}</div>
          <div className="text-text-muted text-[14px]">
            {total === 0
              ? canCreate
                ? "Ajoutez les emballages, boissons et fournitures avec « Nouvel article »."
                : "Les articles seront ajoutés par un éditeur."
              : "Changez la recherche ou retirez un filtre."}
          </div>
        </Card>
      ) : (
        <>
          <div className="lg:hidden flex flex-col gap-2.5">
            {rows.map((a) => (
              <Link
                key={a.id}
                href={`/consommables/${a.id}${query}`}
                className="flex flex-col gap-1 p-4 rounded-lg bg-surface text-text shadow-[0_0_0_1px_var(--color-border)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[16px] min-w-0">{a.name}</span>
                  <StatusBadge status={a.resume.statut} />
                </div>
                <div className="text-text-muted text-[13px]">
                  {a.code} · {FAMILLE_LABELS[a.famille as Famille] ?? a.famille}
                </div>
                <div className="text-[14px]">
                  <strong className={a.resume.statut === "sousLeSeuil" ? "text-warning" : ""}>
                    {a.resume.quantite} {uniteLabel(a.unit, a.resume.quantite)}
                  </strong>{" "}
                  <span className="text-text-muted">· {detail(a, codeOf)}</span>
                </div>
              </Link>
            ))}
          </div>

          <Card padded={false} className="hidden lg:block overflow-hidden">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="bg-background text-text-muted text-[12px] uppercase tracking-wide text-left">
                  <th className="font-semibold px-4 py-3">Désignation</th>
                  <th className="font-semibold px-4 py-3">Famille</th>
                  <th className="font-semibold px-4 py-3 text-right">Quantité ({scope})</th>
                  <th className="font-semibold px-4 py-3">Détail</th>
                  <th className="font-semibold px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {rows.map((a) => {
                  const selected = a.id === selectedId;
                  return (
                    <tr key={a.id} className={`relative ${selected ? "bg-orange-soft" : "hover:bg-background"}`}>
                      <td className="px-4 py-2.5">
                        <Link href={`/consommables/${a.id}${query}`} aria-current={selected ? "true" : undefined} className="font-semibold text-text after:absolute after:inset-0">
                          {a.name}
                        </Link>
                        <div className="text-text-muted text-[12.5px]">{a.code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{FAMILLE_LABELS[a.famille as Famille] ?? a.famille}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <strong className={a.resume.statut === "sousLeSeuil" ? "text-warning" : ""}>{a.resume.quantite}</strong>{" "}
                        {uniteLabel(a.unit, a.resume.quantite)}
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{detail(a, codeOf)}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={a.resume.statut} />
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
