// Nouvel article. Propriétaire et éditeur. Panneau au-dessus de la liste sur ordinateur.
import { redirect } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditConsommables, chargerListe } from "@/lib/consommables";
import { filtresQuery, lireFiltres } from "@/lib/consommables-rules";
import { ArticleList } from "@/components/app/consommables/article-list";
import { ArticleForm } from "@/components/app/consommables/article-form";

export default async function NouvelArticlePage(props: PageProps<"/consommables/nouveau">) {
  const filters = lireFiltres(await props.searchParams);
  const [profile, list, { unread }] = await Promise.all([getProfile(), chargerListe(filters), getNavCounts()]);
  if (!canEditConsommables(profile?.role)) redirect("/consommables");

  return (
    <>
      <div className="hidden lg:block max-w-6xl mx-auto" aria-hidden>
        <ArticleList {...list} filters={filters} unread={unread} canCreate />
      </div>
      <ArticleForm
        initial={{ id: null, name: "", code: "", famille: filters.famille, unit: "piece", defaultThreshold: 0, notes: "" }}
        canDelete={false}
        cancelHref={`/consommables${filtresQuery(filters)}`}
      />
    </>
  );
}
