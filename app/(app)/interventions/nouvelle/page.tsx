// Nouvelle intervention (tout type). Propriétaire, éditeur, commentateur ; le lecteur est
// renvoyé vers « Déclarer une panne ». Sur ordinateur, le formulaire s'ouvre en panneau
// au-dessus de la liste. ?equipement=ID : machine déjà choisie (depuis sa fiche).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNavCounts, getProfile } from "@/lib/session";
import { categoryIcon } from "@/lib/equipment-icon";
import { canSetStatus } from "@/lib/intervention-status";
import {
  filtersQuery,
  listTechniciansByRestaurant,
  loadInterventionList,
  readFilters,
  technicianOptions,
} from "@/lib/interventions";
import { InterventionList } from "@/components/app/interventions/intervention-list";
import { NewInterventionForm } from "@/components/app/interventions/new-intervention-form";
import type { Machine } from "@/components/app/panne/declare-form";

type Row = {
  id: string;
  name: string;
  code: string;
  restaurant_id: string;
  categories: { name: string; code: string; icon?: string | null } | null;
};

export default async function NouvelleInterventionPage(props: PageProps<"/interventions/nouvelle">) {
  const searchParams = await props.searchParams;
  const filters = readFilters(searchParams);
  const equipementParam = typeof searchParams.equipement === "string" ? searchParams.equipement : null;

  const profile = await getProfile();
  if (!canSetStatus(profile?.role)) redirect("/panne");

  const supabase = await createClient();
  const [restaurantsRes, equipmentsRes, list, { unread }] = await Promise.all([
    supabase.from("restaurants").select("id, short_code, name").order("short_code"),
    supabase.from("equipments").select("id, name, code, restaurant_id, categories(*)"),
    loadInterventionList(filters),
    getNavCounts(),
  ]);
  const restaurants = (restaurantsRes.data ?? []) as { id: string; short_code: string; name: string }[];
  const byRestaurant = await listTechniciansByRestaurant(restaurants.map((r) => r.id));
  const technicians = Object.fromEntries(
    Object.entries(byRestaurant).map(([rid, techs]) => [
      rid,
      technicianOptions(techs),
    ]),
  );

  const machines: Machine[] = ((equipmentsRes.data ?? []) as unknown as Row[]).map((e) => ({
    id: e.id,
    name: e.name,
    code: e.code,
    restaurantId: e.restaurant_id,
    categoryName: e.categories?.name ?? null,
    icon: categoryIcon(e.categories),
  }));
  const initial = machines.find((m) => m.id === equipementParam) ?? null;

  return (
    <>
      <div className="hidden lg:block max-w-6xl mx-auto" aria-hidden>
        <InterventionList {...list} filters={filters} unread={unread} canCreate />
      </div>
      <NewInterventionForm
        restaurants={restaurants}
        machines={machines}
        technicians={technicians}
        initialEquipmentId={initial?.id ?? null}
        cancelHref={initial ? `/equipements/${initial.id}` : `/interventions${filtersQuery(filters)}`}
      />
    </>
  );
}
