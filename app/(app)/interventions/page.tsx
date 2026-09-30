// Liste des interventions (M-06a / O-07). Filtres et onglet dans l'URL.
// Le tableau de bord y mène filtré (?type=urgence, ?restaurant=CTR1).
import { getNavCounts } from "@/lib/session";
import { loadInterventionList, readFilters } from "@/lib/interventions";
import { InterventionList } from "@/components/app/interventions/intervention-list";

export default async function InterventionsPage(props: PageProps<"/interventions">) {
  const filters = readFilters(await props.searchParams);
  const [list, { unread }] = await Promise.all([loadInterventionList(filters), getNavCounts()]);

  return (
    <div className="max-w-6xl mx-auto">
      <InterventionList {...list} filters={filters} unread={unread} />
    </div>
  );
}
