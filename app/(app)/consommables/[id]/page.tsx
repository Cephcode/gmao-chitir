// Fiche article. Ordinateur : liste à gauche, fiche en panneau à droite (comme le stock).
// Mobile : la fiche seule en page entière.
import { notFound } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditConsommables, chargerListe, getArticle } from "@/lib/consommables";
import { filtresQuery, lireFiltres } from "@/lib/consommables-rules";
import { ArticleList } from "@/components/app/consommables/article-list";
import { ArticleSheet } from "@/components/app/consommables/article-sheet";

export default async function ArticlePage(props: PageProps<"/consommables/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const filters = lireFiltres(searchParams);
  const [article, profile, list, { unread }] = await Promise.all([
    getArticle(id),
    getProfile(),
    chargerListe(filters),
    getNavCounts(),
  ]);
  if (!article || !profile) notFound();

  return (
    <div className="lg:flex lg:items-start">
      <div className="hidden lg:block flex-1 min-w-0 pb-10">
        <ArticleList {...list} filters={filters} selectedId={article.id} unread={unread} canCreate={canEditConsommables(profile.role)} />
      </div>
      <aside
        aria-label="Fiche article"
        className="lg:sticky lg:top-0 lg:h-dvh lg:w-[440px] lg:shrink-0 lg:overflow-y-auto lg:bg-surface lg:border-l lg:border-border"
      >
        <ArticleSheet
          article={article}
          restaurants={list.restaurants}
          selectedRestaurant={list.restaurant}
          role={profile.role}
          query={filtresQuery(filters)}
        />
      </aside>
    </div>
  );
}
