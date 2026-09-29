// Liste des interventions (M-06a / O-07) : cartes sur mobile, tableau sur ordinateur.
// Onglets En cours / Terminées (/ Toutes sur ordinateur) avec compteurs ; en cours,
// regroupement Urgences, Normales, Alertes. Chaque ligne ouvre l'intervention.
import Link from "next/link";
import { Suspense } from "react";
import { dateCourte, depuis } from "@/lib/format";
import {
  type Filters,
  type InterventionRow,
  type Technician,
  TYPE_BADGE,
  TYPE_GROUPS,
  filtersQuery,
  machineName,
  problem,
} from "@/lib/interventions";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { UrlFilters } from "@/components/app/url-filters";

// « CTR1 · Salif · depuis 25 min » (en cours) ou « CTR1 · Salif · clôturée le 16 sept. ».
function subline(i: InterventionRow) {
  const who = i.assignee?.first_name ?? (i.status === "en_cours" ? "Pas encore attribuée" : null);
  const when =
    i.status === "en_cours"
      ? `depuis ${depuis(i.reported_at)}`
      : i.closed_at
        ? `clôturée le ${dateCourte(i.closed_at)}`
        : null;
  return [i.restaurant.short_code, who, when].filter(Boolean).join(" · ");
}

export function InterventionList({
  rows,
  filters,
  counts,
  restaurants,
  technicians,
  selectedId,
  unread,
}: {
  rows: InterventionRow[]; // déjà filtrées, statut compris
  filters: Filters;
  counts: { en_cours: number; terminee: number; toutes: number };
  restaurants: { short_code: string }[];
  technicians: Technician[];
  selectedId?: string;
  unread: number;
}) {
  const query = filtersQuery(filters);
  const grouped = filters.statut === "en_cours";
  const groups = grouped
    ? TYPE_GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.type === g.type) })).filter(
        (g) => g.rows.length > 0,
      )
    : [{ type: null, label: "", rows }];

  const tabs = [
    { statut: "en_cours" as const, label: `En cours (${counts.en_cours})`, desktopOnly: false },
    { statut: "terminee" as const, label: `Terminées (${counts.terminee})`, desktopOnly: false },
    { statut: "toutes" as const, label: "Toutes", desktopOnly: true },
  ];

  return (
    <div className="px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">
          Interventions
        </h1>
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

      {/* Onglets : segment plein sur mobile, soulignés sur ordinateur */}
      <nav
        aria-label="Statut des interventions"
        className="grid grid-cols-2 p-1 rounded bg-surface-2 lg:flex lg:gap-6 lg:p-0 lg:rounded-none lg:bg-transparent lg:border-b lg:border-border"
      >
        {tabs.map((t) => {
          const active = filters.statut === t.statut;
          return (
            <Link
              key={t.statut}
              href={`/interventions${filtersQuery(filters, { statut: t.statut })}`}
              aria-current={active ? "page" : undefined}
              className={`${t.desktopOnly ? "hidden lg:block" : ""} text-center py-2.5 rounded-sm text-[15px] font-semibold lg:rounded-none lg:px-1 lg:-mb-px lg:border-b-2 ${
                active
                  ? "bg-surface text-text shadow-[0_1px_2px_rgba(43,26,16,.1)] lg:bg-transparent lg:shadow-none lg:border-orange"
                  : "text-text-muted lg:border-transparent hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Suspense>
        <UrlFilters
          basePath="/interventions"
          searchLabel="Rechercher une intervention"
          searchPlaceholder="Machine ou description"
          chips={[
            ...(restaurants.length > 1
              ? [
                  {
                    name: "restaurant",
                    label: "Restaurant",
                    options: restaurants.map((r) => ({ value: r.short_code, label: r.short_code })),
                  },
                ]
              : []),
            {
              name: "type",
              label: "Type",
              options: [
                { value: "urgence", label: "Urgence" },
                { value: "normal", label: "Normal" },
                { value: "alerte", label: "Alerte" },
              ],
            },
            {
              name: "technicien",
              label: "Technicien",
              options: [
                { value: "aucun", label: "Pas encore attribuée" },
                ...technicians.map((t) => ({ value: t.id, label: t.first_name ?? "Sans prénom" })),
              ],
            },
          ]}
        />
      </Suspense>

      {rows.length === 0 ? (
        <Card className="flex items-center gap-3">
          <span className="size-11 rounded bg-success-bg text-success flex items-center justify-center shrink-0">
            <Icon name="check" />
          </span>
          <div>
            <div className="font-semibold">
              {filters.statut === "en_cours" ? "Aucune intervention en cours" : "Aucune intervention"}
            </div>
            <div className="text-text-muted text-[14px]">
              {filters.statut === "en_cours"
                ? "Si une machine tombe en panne, appuyez sur « Déclarer une panne »."
                : "Changez la recherche ou retirez un filtre."}
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Mobile : cartes groupées */}
          <div className="lg:hidden flex flex-col gap-5">
            {groups.map((g) => (
              <section key={g.type ?? "all"} className="flex flex-col gap-2.5">
                {g.type && (
                  <h2
                    className={`flex items-center gap-1.5 m-0 text-[13px] font-bold uppercase tracking-wide ${
                      g.type === "urgence" ? "text-danger" : "text-text-muted"
                    }`}
                  >
                    <Icon name={g.type === "urgence" ? "bolt" : g.type === "alerte" ? "alert" : "wrench"} size={16} />
                    {g.label} · {g.rows.length}
                  </h2>
                )}
                {g.rows.map((i) => (
                  <Link
                    key={i.id}
                    href={`/interventions/${i.id}${query}`}
                    className={`flex flex-col gap-2 p-4 rounded-lg bg-surface text-text ${
                      i.type === "urgence" && i.status === "en_cours"
                        ? "shadow-[0_0_0_1.5px_#F4B8B0]"
                        : "shadow-[0_0_0_1px_var(--color-border)]"
                    }`}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge status={TYPE_BADGE[i.type]} />
                      <StatusBadge status={i.status === "en_cours" ? "enCours" : "termine"} />
                    </div>
                    <div className="font-display font-semibold text-[17px]">{machineName(i)}</div>
                    <div className="text-text-muted text-[13px]">{subline(i)}</div>
                  </Link>
                ))}
              </section>
            ))}
          </div>

          {/* Ordinateur : tableau */}
          <Card padded={false} className="hidden lg:block overflow-hidden">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="bg-background text-text-muted text-[12px] uppercase tracking-wide text-left">
                  <th className="font-semibold px-4 py-3">Type</th>
                  <th className="font-semibold px-4 py-3">Équipement</th>
                  <th className="font-semibold px-4 py-3">Resto</th>
                  <th className="font-semibold px-4 py-3">Technicien</th>
                  <th className="font-semibold px-4 py-3">{filters.statut === "terminee" ? "Clôturée" : "Depuis"}</th>
                  <th className="font-semibold px-4 py-3">Statut</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.type ?? "all"} className="divide-y divide-surface-2">
                  {g.type && (
                    <tr className="bg-background">
                      <th
                        colSpan={6}
                        scope="colgroup"
                        className={`px-4 py-2 text-left text-[12px] font-bold uppercase tracking-wide ${
                          g.type === "urgence" ? "text-danger" : "text-text-muted"
                        }`}
                      >
                        {g.label} · {g.rows.length}
                      </th>
                    </tr>
                  )}
                  {g.rows.map((i) => {
                    const selected = i.id === selectedId;
                    return (
                      <tr key={i.id} className={`relative ${selected ? "bg-orange-soft" : "hover:bg-background"}`}>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={TYPE_BADGE[i.type]} />
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/interventions/${i.id}${query}`}
                            aria-current={selected ? "true" : undefined}
                            className="font-semibold text-text after:absolute after:inset-0"
                          >
                            {machineName(i)}
                          </Link>
                          <div className="text-text-muted text-[12.5px] truncate max-w-[260px]">{problem(i)}</div>
                        </td>
                        <td className="px-4 py-2.5">{i.restaurant.short_code}</td>
                        <td className="px-4 py-2.5">
                          {i.assignee?.first_name ?? <span className="text-text-muted">À attribuer</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {i.status === "en_cours"
                            ? depuis(i.reported_at)
                            : i.closed_at
                              ? dateCourte(i.closed_at)
                              : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={i.status === "en_cours" ? "enCours" : "termine"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
