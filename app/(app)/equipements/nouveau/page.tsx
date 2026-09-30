// Nouvel équipement (M-04d). Propriétaire et éditeur seulement.
// Sur ordinateur, le formulaire s'ouvre en panneau au-dessus de la liste.
import { redirect } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import {
  applyFilters,
  canEditEquipments,
  filtersQuery,
  listEquipments,
  listFilterOptions,
  listFormOptions,
  readFilters,
} from "@/lib/equipements";
import { EquipmentList } from "@/components/app/equipements/equipment-list";
import { EquipmentForm } from "@/components/app/equipements/equipment-form";

export default async function NouvelEquipementPage(props: PageProps<"/equipements/nouveau">) {
  const filters = readFilters(await props.searchParams);
  const [profile, all, filterOptions, { unread }] = await Promise.all([
    getProfile(),
    listEquipments(),
    listFilterOptions(),
    getNavCounts(),
  ]);
  if (!canEditEquipments(profile?.role)) redirect("/equipements");

  const formOptions = await listFormOptions(all);
  // Restaurant pré-choisi : celui du filtre en cours, ou le seul accessible.
  const preselected =
    formOptions.restaurants.find((r) => r.short_code === filters.restaurant) ??
    (formOptions.restaurants.length === 1 ? formOptions.restaurants[0] : undefined);

  return (
    <>
      <div className="hidden lg:block max-w-6xl mx-auto" aria-hidden>
        <EquipmentList
          rows={applyFilters(all, filters)}
          total={all.length}
          filters={filters}
          options={filterOptions}
          unread={unread}
          canCreate
        />
      </div>
      <EquipmentForm
        initial={{
          id: null,
          restaurantId: preselected?.id ?? "",
          name: "",
          code: "",
          state: "operationnel",
          category: null,
          brand: null,
          model: "",
          serialNumber: "",
          installedAt: "",
          frequency: null,
          task: "",
        }}
        options={formOptions}
        canDelete={false}
        cancelHref={`/equipements${filtersQuery(filters)}`}
      />
    </>
  );
}
