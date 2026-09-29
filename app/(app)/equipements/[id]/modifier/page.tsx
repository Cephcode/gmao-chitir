// Modifier un équipement (O-05). Propriétaire et éditeur ; seul le propriétaire voit « Supprimer ».
// Sur ordinateur, le formulaire s'ouvre en panneau au-dessus de la liste.
import { notFound, redirect } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import {
  applyFilters,
  canEditEquipments,
  filtersQuery,
  getEquipment,
  listEquipments,
  listFilterOptions,
  listFormOptions,
  readFilters,
} from "@/lib/equipements";
import { EquipmentList } from "@/components/app/equipements/equipment-list";
import { EquipmentForm } from "@/components/app/equipements/equipment-form";

export default async function ModifierEquipementPage(
  props: PageProps<"/equipements/[id]/modifier">,
) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const filters = readFilters(searchParams);
  const query = filtersQuery(filters);

  const [equipment, profile, all, filterOptions, { unread }] = await Promise.all([
    getEquipment(id),
    getProfile(),
    listEquipments(),
    listFilterOptions(),
    getNavCounts(),
  ]);
  if (!equipment) notFound();
  if (!canEditEquipments(profile?.role)) redirect(`/equipements/${id}${query}`);

  const formOptions = await listFormOptions(all);

  return (
    <>
      <div className="hidden lg:block max-w-6xl mx-auto" aria-hidden>
        <EquipmentList
          rows={applyFilters(all, filters)}
          total={all.length}
          filters={filters}
          options={filterOptions}
          selectedId={equipment.id}
          unread={unread}
          canCreate
        />
      </div>
      <EquipmentForm
        initial={{
          id: equipment.id,
          restaurantId: equipment.restaurant.id,
          name: equipment.name,
          code: equipment.code,
          state: equipment.state,
          category: equipment.category ? { id: equipment.category.id } : null,
          brand: equipment.brand ? { id: equipment.brand.id } : null,
          model: equipment.model ?? "",
          serialNumber: equipment.serial_number ?? "",
          installedAt: equipment.installed_at ?? "",
          frequency: equipment.plan?.frequency ?? null,
          task: equipment.plan?.task ?? "",
        }}
        options={formOptions}
        canDelete={profile?.role === "proprietaire"}
        cancelHref={`/equipements/${equipment.id}${query}`}
      />
    </>
  );
}
