// Nouvelle pièce. Propriétaire et éditeur. Panneau au-dessus de la liste sur ordinateur.
import { redirect } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditStock, filtersQuery, listMachinesForPicker, loadStockList, readFilters } from "@/lib/stock";
import { StockList } from "@/components/app/stock/stock-list";
import { PartForm } from "@/components/app/stock/part-form";

export default async function NouvellePiecePage(props: PageProps<"/stock/nouvelle">) {
  const filters = readFilters(await props.searchParams);
  const [profile, list, machines, { unread }] = await Promise.all([
    getProfile(),
    loadStockList(filters),
    listMachinesForPicker(),
    getNavCounts(),
  ]);
  if (!canEditStock(profile?.role)) redirect("/stock");

  return (
    <>
      <div className="hidden lg:block max-w-6xl mx-auto" aria-hidden>
        <StockList {...list} filters={filters} unread={unread} canCreate />
      </div>
      <PartForm
        initial={{ id: null, name: "", code: "", unit: "piece", minThreshold: 0, initialQuantity: 0, notes: "", plannedIds: [] }}
        machines={machines}
        canDelete={false}
        cancelHref={`/stock${filtersQuery(filters)}`}
      />
    </>
  );
}
