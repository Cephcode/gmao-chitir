// Fiche article : stock par restaurant (quantité, seuil, statut), bloc « Mettre à jour le
// stock » (propriétaire, éditeur) et historique des mouvements des restaurants visibles.
import Link from "next/link";
import { dateCourte, nomPersonne } from "@/lib/format";
import { type Article, type Restaurant, canEditConsommables, listMouvementsArticle } from "@/lib/consommables";
import { FAMILLE_LABELS, RAISON_LABELS, type Famille, estSousSeuil, resumeArticle, uniteLabel } from "@/lib/consommables-rules";
import type { Role } from "@/lib/session";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SheetTitle } from "@/components/app/sheet-title";
import { ArticleOperation } from "@/components/app/consommables/article-operation";

export async function ArticleSheet({
  article: a,
  restaurants,
  selectedRestaurant,
  role,
  query,
}: {
  article: Article;
  restaurants: Restaurant[]; // accessibles
  selectedRestaurant: Restaurant | null; // filtre de la liste
  role: Role;
  query: string;
}) {
  const mouvements = await listMouvementsArticle(a.id);
  const canEdit = canEditConsommables(role);
  const closeHref = `/consommables${query}`;
  const editHref = `/consommables/${a.id}/modifier${query}`;
  const stockOf = new Map(a.stocks.map((s) => [s.restaurant_id, s]));
  const codeOf = new Map(restaurants.map((r) => [r.id, r.short_code]));
  const resume = resumeArticle(a.stocks, selectedRestaurant?.id);
  // Restaurant proposé : celui du filtre, sinon le premier sous le seuil, sinon le premier.
  const defaultRestaurantId =
    selectedRestaurant?.id ?? a.stocks.find(estSousSeuil)?.restaurant_id ?? restaurants[0]?.id ?? "";

  return (
    <article className="flex flex-col gap-5 px-4 pt-3 pb-6 lg:px-6 lg:pt-5">
      <div className="flex items-center gap-2">
        <Link href={closeHref} className="lg:hidden -ml-2 inline-flex items-center gap-1 h-touch px-2 font-semibold text-text">
          <Icon name="chevronRight" className="rotate-180" /> Consommables
        </Link>
        <span className="lg:hidden flex-1" />
        <span className="hidden lg:block flex-1 text-text-muted text-[13px] font-semibold">Fiche article</span>
        {canEdit && (
          <Link
            href={editHref}
            aria-label="Modifier l'article"
            className="inline-flex items-center gap-2 h-touch px-2.5 lg:px-3.5 rounded font-semibold text-text lg:shadow-[inset_0_0_0_1.5px_var(--color-ring)] hover:bg-surface-2"
          >
            <Icon name="edit" size={18} />
            <span className="hidden lg:inline">Modifier</span>
          </Link>
        )}
        <Link href={closeHref} aria-label="Fermer la fiche" className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2">
          <Icon name="x" />
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <SheetTitle>{a.name}</SheetTitle>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={resume.statut} />
          <span className="text-text-muted text-[14px]">
            {a.code} · {FAMILLE_LABELS[a.famille as Famille] ?? a.famille}
          </span>
        </div>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="par-restaurant">
        <h3 id="par-restaurant" className="font-display text-[18px] font-semibold m-0">
          Par restaurant
        </h3>
        {restaurants.length === 0 ? (
          <p className="m-0 text-text-muted text-[14px]">Aucun restaurant accessible.</p>
        ) : (
          <Card padded={false} className="divide-y divide-surface-2 overflow-hidden">
            {restaurants.map((r) => {
              const s = stockOf.get(r.id);
              const low = s ? estSousSeuil(s) : false;
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-4 py-3 ${r.id === selectedRestaurant?.id ? "bg-orange-soft" : ""}`}
                >
                  <span className="w-14 shrink-0 font-display font-semibold">{r.short_code}</span>
                  <span className="flex-1 min-w-0">
                    {s ? (
                      <>
                        <strong className={`tabular-nums ${low ? "text-warning" : ""}`}>{s.quantity}</strong>{" "}
                        {uniteLabel(a.unit, s.quantity)}
                        <span className="block text-text-muted text-[13px]">seuil {s.min_threshold}</span>
                      </>
                    ) : (
                      <span className="text-text-muted text-[14px]">Pas encore en stock</span>
                    )}
                  </span>
                  <StatusBadge status={!s ? "nonSuivi" : low ? "sousLeSeuil" : "suffisant"} />
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {canEdit && restaurants.length > 0 && (
        <ArticleOperation
          // Remonté seulement si le filtre change (pas après une opération : le message reste).
          key={selectedRestaurant?.id ?? "tous"}
          articleId={a.id}
          unit={a.unit}
          restaurants={restaurants.map(({ id, short_code, name }) => ({ id, short_code, name }))}
          stocks={Object.fromEntries(a.stocks.map((s) => [s.restaurant_id, { quantity: s.quantity, min_threshold: s.min_threshold }]))}
          defaultRestaurantId={defaultRestaurantId}
        />
      )}

      <Card padded={false} className="px-5 divide-y divide-surface-2 lg:px-0 lg:shadow-none">
        <div className="flex justify-between gap-3 py-3">
          <span className="text-text-muted text-[15px]">Unité</span>
          <span className="font-semibold text-[15px]">{uniteLabel(a.unit, 1)}</span>
        </div>
        <div className="flex justify-between gap-3 py-3">
          <span className="text-text-muted text-[15px]">Seuil d&apos;alerte par défaut</span>
          <span className="font-semibold text-[15px]">{a.default_threshold}</span>
        </div>
        {a.notes && (
          <div className="flex flex-col gap-1 py-3">
            <span className="text-text-muted text-[15px]">Remarque</span>
            <span className="text-[15px]">{a.notes}</span>
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-[18px] font-semibold m-0">Mouvements</h3>
        {mouvements.length === 0 ? (
          <p className="m-0 text-text-muted text-[14px]">Aucun mouvement pour le moment.</p>
        ) : (
          <Card padded={false} className="divide-y divide-surface-2 overflow-hidden">
            {mouvements.map((m) => {
              const autre = m.autre_restaurant_id ? codeOf.get(m.autre_restaurant_id) ?? "autre restaurant" : null;
              const libelle =
                m.raison === "transfert" && autre
                  ? `${m.delta > 0 ? "Reçu de" : "Envoyé à"} ${autre}`
                  : RAISON_LABELS[m.raison];
              const qui = m.users ? nomPersonne(m.users) : null;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-12 shrink-0 font-bold tabular-nums ${m.delta > 0 ? "text-success" : ""}`}>
                    {m.delta > 0 ? `+${m.delta}` : `−${-m.delta}`}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] truncate">
                      <span className="font-semibold">{codeOf.get(m.restaurant_id) ?? ""}</span> · {libelle}
                    </span>
                    {(qui || m.note) && (
                      <span className="block text-text-muted text-[13px] truncate">
                        {[qui, m.note].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="text-text-muted text-[13px] shrink-0">{dateCourte(m.created_at)}</span>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </article>
  );
}
