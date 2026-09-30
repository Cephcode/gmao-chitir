// Stock (M-07a / O-08). Global à la chaîne. ?statut=sous_seuil depuis le tableau de bord.
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditStock, loadStockList, readFilters } from "@/lib/stock";
import { StockList } from "@/components/app/stock/stock-list";

export default async function StockPage(props: PageProps<"/stock">) {
  const filters = readFilters(await props.searchParams);
  const [list, profile, { unread }] = await Promise.all([loadStockList(filters), getProfile(), getNavCounts()]);
  return (
    <div className="max-w-6xl mx-auto">
      <StockList {...list} filters={filters} unread={unread} canCreate={canEditStock(profile?.role)} />
    </div>
  );
}
