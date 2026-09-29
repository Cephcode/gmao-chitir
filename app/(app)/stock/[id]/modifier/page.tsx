// Modifier une pièce. Propriétaire et éditeur ; seul le propriétaire voit « Supprimer ».
import { notFound, redirect } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditStock, filtersQuery, getPart, listMachinesForPicker, loadStockList, readFilters } from "@/lib/stock";
import { StockList } from "@/components/app/stock/stock-list";
import { PartForm } from "@/components/app/stock/part-form";

export default async function ModifierPiecePage(props: PageProps<"/stock/[id]/modifier">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const filters = readFilters(searchParams);
  const query = filtersQuery(filters);
  const [part, profile, list, machines, { unread }] = await Promise.all([
    getPart(id),
    getProfile(),
    loadStockList(filters),
    listMachinesForPicker(),
    getNavCounts(),
  ]);
  if (!part) notFound();
  if (!canEditStock(profile?.role)) redirect(`/stock/${id}${query}`);

  return (
    <>
      <div className="hidden lg:block max-w-6xl mx-auto" aria-hidden>
        <StockList {...list} filters={filters} selectedId={part.id} unread={unread} canCreate />
      </div>
      <PartForm
        initial={{
          id: part.id,
          name: part.name,
          code: part.code,
          unit: part.unit,
          minThreshold: part.min_threshold,
          initialQuantity: part.quantity,
          notes: part.notes ?? "",
          plannedIds: part.planned.map((m) => m.id),
        }}
        machines={machines}
        canDelete={profile?.role === "proprietaire"}
        cancelHref={`/stock/${part.id}${query}`}
      />
    </>
  );
}
