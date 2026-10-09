// Modifier un article. Propriétaire et éditeur ; seul le propriétaire voit « Supprimer ».
import { notFound, redirect } from "next/navigation";
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditConsommables, chargerListe, getArticle } from "@/lib/consommables";
import { filtresQuery, lireFiltres } from "@/lib/consommables-rules";
import { ArticleList } from "@/components/app/consommables/article-list";
import { ArticleForm } from "@/components/app/consommables/article-form";

export default async function ModifierArticlePage(props: PageProps<"/consommables/[id]/modifier">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const filters = lireFiltres(searchParams);
  const query = filtresQuery(filters);
  const [article, profile, list, { unread }] = await Promise.all([
    getArticle(id),
    getProfile(),
    chargerListe(filters),
    getNavCounts(),
  ]);
  if (!article) notFound();
  if (!canEditConsommables(profile?.role)) redirect(`/consommables/${id}${query}`);

  return (
    <>
      <div className="hidden lg:block max-w-6xl mx-auto" aria-hidden>
        <ArticleList {...list} filters={filters} selectedId={article.id} unread={unread} canCreate />
      </div>
      <ArticleForm
        initial={{
          id: article.id,
          name: article.name,
          code: article.code,
          famille: article.famille,
          unit: article.unit,
          defaultThreshold: article.default_threshold,
          notes: article.notes ?? "",
        }}
        canDelete={profile?.role === "proprietaire"}
        cancelHref={`/consommables/${article.id}${query}`}
      />
    </>
  );
}
