// Fiche pièce. Ordinateur : liste à gauche, fiche en panneau à droite (O-08).
// Mobile : la fiche seule en page entière (M-07b).
import { notFound } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditStock, filtersQuery, getPart, loadStockList, readFilters } from "@/lib/stock";
import { StockList } from "@/components/app/stock/stock-list";
import { PartSheet } from "@/components/app/stock/part-sheet";

export default async function PiecePage(props: PageProps<"/stock/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const filters = readFilters(searchParams);
  const [part, profile, list, { unread }] = await Promise.all([
    getPart(id),
    getProfile(),
    loadStockList(filters),
    getNavCounts(),
  ]);
  if (!part || !profile) notFound();

  return (
    <div className="lg:flex lg:items-start">
      <div className="hidden lg:block flex-1 min-w-0 pb-10">
        <StockList {...list} filters={filters} selectedId={part.id} unread={unread} canCreate={canEditStock(profile.role)} />
      </div>
      <aside
        aria-label="Fiche pièce"
        className="lg:sticky lg:top-0 lg:h-dvh lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:bg-surface lg:border-l lg:border-border"
      >
        <PartSheet part={part} role={profile.role} query={filtersQuery(filters)} />
      </aside>
    </div>
  );
}
