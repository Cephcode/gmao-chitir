// Liste des équipements (M-04a / O-04) : lignes tactiles sur mobile, tableau sur ordinateur.
// Reçoit la liste déjà filtrée. Chaque ligne ouvre la fiche en gardant les filtres dans l'URL.
import Link from "next/link";
import { Suspense } from "react";
import { categoryIcon } from "@/lib/equipment-icon";
import { dateCourte } from "@/lib/format";
import {
  type EquipmentRow,
  type Filters,
  STATE_BADGE,
  filtersQuery,
  maintenanceOf,
} from "@/lib/equipements";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListRow } from "@/components/app/list-row";
import { EquipmentFilters } from "@/components/app/equipements/equipment-filters";

// Colonne « Prochain entretien » : retard en gras, sinon la date, « — » sans plan.
function NextMaintenance({ row }: { row: EquipmentRow }) {
  const m = maintenanceOf(row.plan);
  if (m.status === "en_retard")
    return <span className="font-bold text-warning">Retard {m.days} j</span>;
  if (m.status === "a_jour") return <>{dateCourte(m.next)}</>;
  return <span className="text-text-muted">—</span>;
}

export function EquipmentList({
  rows,
  total,
  filters,
  options,
  selectedId,
  unread,
  canCreate = false,
}: {
  rows: EquipmentRow[];
  total: number;
  filters: Filters;
  options: {
    restaurants: { short_code: string; name: string }[];
    categories: { code: string; name: string }[];
  };
  selectedId?: string;
  unread: number;
  canCreate?: boolean; // propriétaire ou éditeur
}) {
  const query = filtersQuery(filters);
  const hasFilters = query !== "";

  return (
    <div className="px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">
          Équipements <span className="text-text-muted font-normal lg:text-[24px]">{total}</span>
        </h1>
        {canCreate && (
          <>
            <Link
              href={`/equipements/nouveau${query}`}
              aria-label="Ajouter un équipement"
              className="lg:hidden size-touch rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-ring)] flex items-center justify-center text-text"
            >
              <Icon name="plus" />
            </Link>
            <Link
              href={`/equipements/nouveau${query}`}
              className={`hidden lg:inline-flex ${buttonClass()}`}
            >
              <Icon name="plus" /> Ajouter un équipement
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

      {/* useSearchParams exige une frontière Suspense */}
      <Suspense>
        <EquipmentFilters {...options} />
      </Suspense>

      <div className="flex items-center justify-between text-[14px] text-text-muted">
        <span>
          <strong className="text-text">{rows.length}</strong>
          {hasFilters
            ? ` sur ${total} correspondent aux filtres`
            : ` équipement${rows.length > 1 ? "s" : ""}`}
        </span>
        {/* Tri fixe, affiché pour qu'on comprenne l'ordre de la liste */}
        <span className="inline-flex items-center gap-1 font-semibold">
          <Icon name="down" size={16} /> Pannes d&apos;abord
        </span>
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-start gap-2">
          <div className="font-semibold">Aucun équipement ne correspond</div>
          <div className="text-text-muted text-[14px]">
            Changez la recherche ou retirez un filtre.
          </div>
          <Link href="/equipements" className="text-orange-text font-bold text-[14px] py-2">
            Retirer tous les filtres
          </Link>
        </Card>
      ) : (
        <>
          {/* Mobile : lignes tactiles */}
          <div className="lg:hidden flex flex-col gap-2.5">
            {rows.map((e) => (
              <Card key={e.id} padded={false} className="overflow-hidden">
                <ListRow
                  href={`/equipements/${e.id}${query}`}
                  icon={categoryIcon(e.category?.code)}
                  name={e.name}
                  sub={[e.restaurant.short_code, e.category?.name].filter(Boolean).join(" · ")}
                  badge={<StatusBadge status={STATE_BADGE[e.state]} />}
                />
              </Card>
            ))}
          </div>

          {/* Ordinateur : tableau */}
          <Card padded={false} className="hidden lg:block overflow-hidden">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="bg-background text-text-muted text-[12px] uppercase tracking-wide text-left">
                  <th className="font-semibold px-4 py-3">Équipement</th>
                  <th className="font-semibold px-4 py-3">Resto</th>
                  <th className="font-semibold px-4 py-3">Prochain entretien</th>
                  <th className="font-semibold px-4 py-3">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {rows.map((e) => {
                  const selected = e.id === selectedId;
                  return (
                    <tr
                      key={e.id}
                      className={`relative ${selected ? "bg-orange-soft" : "hover:bg-background"}`}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/equipements/${e.id}${query}`}
                          aria-current={selected ? "true" : undefined}
                          className="font-semibold text-text after:absolute after:inset-0"
                        >
                          {e.name}
                        </Link>
                        <div className="text-text-muted text-[12.5px]">
                          {[e.code, e.category?.name].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{e.restaurant.short_code}</td>
                      <td className="px-4 py-2.5">
                        <NextMaintenance row={e} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={STATE_BADGE[e.state]} />
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
