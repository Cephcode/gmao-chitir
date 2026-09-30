// Fiche équipement. Ordinateur : liste à gauche, fiche en panneau à droite (O-04).
// Mobile : la fiche seule en page entière (M-04b / M-04c), la liste est masquée.
import { notFound } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import {
  applyFilters,
  canEditEquipments,
  filtersQuery,
  getEquipment,
  listEquipments,
  listFilterOptions,
  readFilters,
} from "@/lib/equipements";
import { EquipmentList } from "@/components/app/equipements/equipment-list";
import { EquipmentSheet } from "@/components/app/equipements/equipment-sheet";

export default async function FicheEquipementPage(props: PageProps<"/equipements/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const filters = readFilters(searchParams);

  // Un identifiant invalide ou un équipement hors de ses restaurants (RLS) donne null.
  const [equipment, profile, all, options, { unread }] = await Promise.all([
    getEquipment(id),
    getProfile(),
    listEquipments(),
    listFilterOptions(),
    getNavCounts(),
  ]);
  if (!equipment || !profile) notFound();

  return (
    <div className="lg:flex lg:items-start">
      <div className="hidden lg:block flex-1 min-w-0 pb-10">
        <EquipmentList
          rows={applyFilters(all, filters)}
          total={all.length}
          filters={filters}
          options={options}
          selectedId={equipment.id}
          unread={unread}
          canCreate={canEditEquipments(profile.role)}
        />
      </div>
      <aside
        aria-label="Fiche équipement"
        className="lg:sticky lg:top-0 lg:h-dvh lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:bg-surface lg:border-l lg:border-border"
      >
        <EquipmentSheet
          equipment={equipment}
          role={profile.role}
          tab={searchParams.onglet === "historique" ? "historique" : "infos"}
          showAllHistory={searchParams.historique === "tout"}
          query={filtersQuery(filters)}
        />
      </aside>
    </div>
  );
}
