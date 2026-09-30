// Déclarer une panne (M-05 / O-06). Tous les rôles, sur leurs restaurants (RLS).
// ?equipement=ID : machine déjà choisie (depuis sa fiche), on arrive à l'étape 2 sur mobile.
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/session";
import { canSetStatus } from "@/lib/intervention-status";
import { DeclareForm, type Machine, type OpenPanne } from "@/components/app/panne/declare-form";

type Row = {
  id: string;
  name: string;
  code: string;
  restaurant_id: string;
  categories: { name: string; code: string } | null;
};

export default async function PannePage(props: PageProps<"/panne">) {
  const searchParams = await props.searchParams;
  const equipementParam = typeof searchParams.equipement === "string" ? searchParams.equipement : null;

  const supabase = await createClient();
  const [profile, restaurantsRes, equipmentsRes, openRes] = await Promise.all([
    getProfile(),
    supabase.from("restaurants").select("id, short_code, name").order("short_code"),
    supabase.from("equipments").select("id, name, code, restaurant_id, categories(name, code)"),
    supabase
      .from("interventions")
      .select("id, equipment_id, reported_at, type")
      .neq("status", "terminee")
      .not("equipment_id", "is", null)
      .order("reported_at", { ascending: false }),
  ]);

  const machines: Machine[] = ((equipmentsRes.data ?? []) as unknown as Row[]).map((e) => ({
    id: e.id,
    name: e.name,
    code: e.code,
    restaurantId: e.restaurant_id,
    categoryName: e.categories?.name ?? null,
    categoryCode: e.categories?.code ?? null,
  }));

  // Dernière panne ouverte par machine (pour prévenir d'un doublon).
  const openByEquipment: Record<string, OpenPanne> = {};
  for (const i of (openRes.data ?? []) as {
    id: string;
    equipment_id: string;
    reported_at: string;
    type: string;
  }[]) {
    openByEquipment[i.equipment_id] ??= { id: i.id, reportedAt: i.reported_at, type: i.type };
  }

  const initial = machines.find((m) => m.id === equipementParam) ?? null;

  return (
    <DeclareForm
      restaurants={(restaurantsRes.data ?? []) as { id: string; short_code: string; name: string }[]}
      machines={machines}
      openByEquipment={openByEquipment}
      initialEquipmentId={initial?.id ?? null}
      closeHref={initial ? `/equipements/${initial.id}` : "/"}
      canChooseStatus={canSetStatus(profile?.role)}
    />
  );
}
