// Liste des équipements (M-04a / O-04). Filtres dans l'URL, lus côté serveur.
import { getNavCounts } from "@/lib/session";
import { applyFilters, listEquipments, listFilterOptions, readFilters } from "@/lib/equipements";
import { EquipmentList } from "@/components/app/equipements/equipment-list";

export default async function EquipementsPage(props: PageProps<"/equipements">) {
  const filters = readFilters(await props.searchParams);
  const [all, options, { unread }] = await Promise.all([
    listEquipments(),
    listFilterOptions(),
    getNavCounts(),
  ]);

  return (
    <div className="max-w-6xl mx-auto">
      <EquipmentList
        rows={applyFilters(all, filters)}
        total={all.length}
        filters={filters}
        options={options}
        unread={unread}
      />
    </div>
  );
}
