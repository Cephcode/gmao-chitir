// Intervention. Ordinateur : liste à gauche, intervention en panneau à droite (O-07).
// Mobile : l'intervention seule en page entière (M-06b), la liste est masquée.
import { notFound } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import { filtersQuery, getIntervention, loadInterventionList, readFilters } from "@/lib/interventions";
import { InterventionList } from "@/components/app/interventions/intervention-list";
import { InterventionSheet } from "@/components/app/interventions/intervention-sheet";

export default async function InterventionPage(props: PageProps<"/interventions/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const filters = readFilters(searchParams);

  // Identifiant invalide ou intervention hors de ses restaurants (RLS) : null.
  const [intervention, profile, list, { unread }] = await Promise.all([
    getIntervention(id),
    getProfile(),
    loadInterventionList(filters),
    getNavCounts(),
  ]);
  if (!intervention || !profile) notFound();

  return (
    <div className="lg:flex lg:items-start">
      <div className="hidden lg:block flex-1 min-w-0 pb-10">
        <InterventionList {...list} filters={filters} selectedId={intervention.id} unread={unread} />
      </div>
      <aside
        aria-label="Intervention"
        className="lg:sticky lg:top-0 lg:h-dvh lg:w-[440px] lg:shrink-0 lg:overflow-y-auto lg:bg-surface lg:border-l lg:border-border"
      >
        <InterventionSheet
          intervention={intervention}
          role={profile.role}
          closeHref={`/interventions${filtersQuery(filters)}`}
        />
      </aside>
    </div>
  );
}
