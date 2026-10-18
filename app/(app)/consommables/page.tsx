// Consommables : stock des restaurants (emballages et jetables, boissons, matériel en gros).
// ?restaurant=CODE&famille=&statut=sous_seuil&q= ; plan : docs/plan-module-consommables.md.
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditConsommables, chargerListe } from "@/lib/consommables";
import { lireFiltres } from "@/lib/consommables-rules";
import { ArticleList } from "@/components/app/consommables/article-list";

export default async function ConsommablesPage(props: PageProps<"/consommables">) {
  const filters = lireFiltres(await props.searchParams);
  const [list, profile, { unread }] = await Promise.all([chargerListe(filters), getProfile(), getNavCounts()]);
  return (
    <div className="max-w-6xl mx-auto">
      <ArticleList {...list} filters={filters} unread={unread} canCreate={canEditConsommables(profile?.role)} />
    </div>
  );
}
