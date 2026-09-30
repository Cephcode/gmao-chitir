// Notifications (M-08 / O-09) : les siennes, groupées par jour.
// Ordinateur : catégories à gauche, liste au centre, « Mes alertes » à droite.
// Mobile : onglets Toutes / Non lues, lien vers « Mes alertes ».
// « Voir » marque la notification comme lue puis ouvre la page liée.
import Link from "next/link";
import { ouvrirNotification, toutMarquerLu } from "@/app/(app)/notifications/actions";
import {
  CATEGORIES,
  SETTINGS,
  TYPE_STYLE,
  type NotificationRow,
  dayGroup,
  getSettings,
  listNotifications,
  whenLabel,
} from "@/lib/notifications";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertSettings } from "@/components/app/notifications/alert-settings";
import { PushToggle } from "@/components/app/notifications/push-toggle";

function Item({ n }: { n: NotificationRow }) {
  const style = TYPE_STYLE[n.type];
  const unread = !n.read_at;
  return (
    <li>
      <form action={ouvrirNotification}>
        <input type="hidden" name="id" value={n.id} />
        <button
          type="submit"
          className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-0 cursor-pointer text-text ${
            unread ? "bg-orange-soft/60 hover:bg-orange-soft" : "bg-transparent hover:bg-background"
          }`}
        >
          <span className={`size-10 rounded flex items-center justify-center shrink-0 ${style.tone}`}>
            <Icon name={style.icon} size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block text-[15px] ${unread ? "font-bold" : "font-semibold"}`}>
              {unread && <span className="sr-only">Non lue : </span>}
              {n.title}
            </span>
            {n.body && <span className="block text-text-muted text-[13.5px] line-clamp-2">{n.body}</span>}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-text-muted text-[13px]">{whenLabel(n.created_at)}</span>
            {unread && <span className="size-2 rounded-full bg-orange" aria-hidden />}
            <span className="hidden lg:inline-flex h-9 px-3.5 items-center rounded-sm bg-surface font-semibold text-[14px] shadow-[inset_0_0_0_1.5px_var(--color-ring)]">
              Voir
            </span>
          </span>
        </button>
      </form>
    </li>
  );
}

export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const sp = await props.searchParams;
  const categorie = typeof sp.categorie === "string" ? sp.categorie : "";
  const nonLues = sp.lu === "non";
  const [all, settings] = await Promise.all([listNotifications(), getSettings()]);

  const cat = CATEGORIES.find((c) => c.value === categorie);
  const rows = all.filter((n) => (!cat || cat.types.includes(n.type)) && (!nonLues || !n.read_at));
  const unreadCount = all.filter((n) => !n.read_at).length;
  const groups = ["Aujourd'hui", "Hier", "Cette semaine", "Plus ancien"]
    .map((label) => ({ label, rows: rows.filter((n) => dayGroup(n.created_at) === label) }))
    .filter((g) => g.rows.length > 0);

  const href = (params: { categorie?: string; lu?: string }) => {
    const p = new URLSearchParams();
    if (params.categorie) p.set("categorie", params.categorie);
    if (params.lu) p.set("lu", params.lu);
    const s = p.toString();
    return `/notifications${s ? `?${s}` : ""}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">
          Notifications
        </h1>
        {unreadCount > 0 && (
          <form action={toutMarquerLu}>
            <Button type="submit" variant="secondary" size="sm" icon="check">
              Tout marquer comme lu
            </Button>
          </form>
        )}
      </header>

      {/* Mobile : onglets Toutes / Non lues */}
      <nav aria-label="Filtre des notifications" className="lg:hidden grid grid-cols-2 p-1 rounded bg-surface-2">
        {[
          { lu: "", label: "Toutes" },
          { lu: "non", label: `Non lues (${unreadCount})` },
        ].map((t) => {
          const active = (t.lu === "non") === nonLues;
          return (
            <Link
              key={t.label}
              href={href({ categorie, lu: t.lu })}
              aria-current={active ? "page" : undefined}
              className={`text-center py-2.5 rounded-sm text-[15px] font-semibold ${
                active ? "bg-surface text-text shadow-[0_1px_2px_rgba(43,26,16,.1)]" : "text-text-muted"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* 3 colonnes seulement sur grand écran (xl) : entre 1024 et 1280 px, avec le menu
          latéral, la liste serait écrasée ; « Mes alertes » passe alors dessous. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_300px] items-start">
        {/* Ordinateur : catégories */}
        <nav aria-label="Catégories" className="hidden lg:flex flex-col gap-1">
          {[{ value: "", label: "Toutes", icon: null, types: [] as string[] }, ...CATEGORIES].map((c) => {
            const active = c.value === categorie;
            const count = c.value ? all.filter((n) => c.types.includes(n.type)).length : all.length;
            return (
              <Link
                key={c.value || "toutes"}
                href={href({ categorie: c.value, lu: nonLues ? "non" : "" })}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 h-11 px-3 rounded text-[15px] font-semibold ${
                  active ? "bg-filter-active text-background" : "text-text hover:bg-surface-2"
                }`}
              >
                {c.icon && <Icon name={c.icon} size={18} />}
                <span className="flex-1">{c.label}</span>
                <span className={`text-[13px] ${active ? "" : "text-text-muted"}`}>{count}</span>
              </Link>
            );
          })}
        </nav>

        <section className="flex flex-col gap-4 min-w-0">
          {groups.length === 0 ? (
            <Card className="flex items-center gap-3">
              <span className="size-11 rounded bg-success-bg text-success flex items-center justify-center shrink-0">
                <Icon name="check" />
              </span>
              <div>
                <div className="font-semibold">{nonLues ? "Tout est lu" : "Aucune notification"}</div>
                <div className="text-text-muted text-[14px]">
                  Les pannes, urgences, réparations et alertes de stock s&apos;afficheront ici.
                </div>
              </div>
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden">
              {groups.map((g) => (
                <div key={g.label}>
                  <h2 className="m-0 px-4 pt-3.5 pb-2 text-text-muted text-[12px] font-bold uppercase tracking-wide bg-background">
                    {g.label}
                  </h2>
                  <ul className="list-none m-0 p-0 divide-y divide-surface-2">
                    {g.rows.map((n) => (
                      <Item key={n.id} n={n} />
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          )}
          <Link
            href="/notifications/alertes"
            className="lg:hidden self-center inline-flex items-center gap-2 py-3 text-orange-text font-bold text-[15px]"
          >
            <Icon name="bell" size={18} /> Choisir les alertes que je reçois
          </Link>
        </section>

        {/* Ordinateur : Mes alertes */}
        <Card className="hidden lg:flex lg:col-span-2 xl:col-span-1 flex-col gap-1 p-5">
          <h2 className="font-display text-[18px] font-semibold m-0">Mes alertes</h2>
          <p className="m-0 text-text-muted text-[14px] mb-2">Choisissez ce qui vous est envoyé.</p>
          <PushToggle />
          <AlertSettings settings={SETTINGS} initial={settings} />
        </Card>
      </div>
    </div>
  );
}
