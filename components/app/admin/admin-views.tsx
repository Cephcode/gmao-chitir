// Vues de l'administration (M-09 / O-10 / O-11) : en-tête à onglets, comptes, restaurants.
import Link from "next/link";
import { depuis } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/session";
import { type Actor, type AdminUser, canManage, displayName, initials } from "@/lib/admin";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export function AdminHeader({
  actor,
  tab,
  userCount,
  restaurantCount,
}: {
  actor: Actor;
  tab: "utilisateurs" | "restaurants";
  userCount: number;
  restaurantCount: number;
}) {
  const isOwner = actor.role === "proprietaire";
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">Administration</h1>
          <p className="m-0 text-text-muted text-[14px]">
            {isOwner ? "Comptes et restaurants de la chaîne." : "Comptes de vos restaurants."}
          </p>
        </div>
        {tab === "utilisateurs" ? (
          <Link href="/admin/utilisateurs/nouveau" className={buttonClass({ variant: "secondary" })}>
            <Icon name="plus" /> <span className="hidden sm:inline">Créer un compte</span>
          </Link>
        ) : (
          isOwner && (
            <Link href="/admin/restaurants/nouveau" className={buttonClass({ variant: "secondary" })}>
              <Icon name="plus" /> <span className="hidden sm:inline">Ajouter un restaurant</span>
            </Link>
          )
        )}
      </header>
      {isOwner && (
        <nav aria-label="Sections" className="flex gap-6 border-b border-border">
          {[
            { key: "utilisateurs", label: `Utilisateurs (${userCount})` },
            { key: "restaurants", label: `Restaurants (${restaurantCount})` },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/admin/${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`py-2.5 -mb-px text-[15px] font-semibold border-b-2 ${
                tab === t.key ? "border-orange text-text" : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function Avatar({ u }: { u: AdminUser }) {
  return (
    <span className="size-10 rounded-full bg-surface-2 text-[#4E2F21] font-bold text-[14px] flex items-center justify-center shrink-0">
      {initials(u)}
    </span>
  );
}

function lastVisit(u: AdminUser) {
  if (!u.last_seen_at) return null;
  const d = depuis(u.last_seen_at);
  return d === "à l'instant" ? "Maintenant" : d === "hier" ? "Hier" : `Il y a ${d}`;
}

export function UserList({
  actor,
  users,
  restaurants,
  selectedId,
}: {
  actor: Actor;
  users: AdminUser[];
  restaurants: { id: string; short_code: string }[];
  selectedId?: string;
}) {
  const codes = new Map(restaurants.map((r) => [r.id, r.short_code]));
  const access = (u: AdminUser) =>
    u.all_restaurants ? "Tous" : u.restaurantIds.map((id) => codes.get(id)).filter(Boolean).join(", ") || "Aucun";
  const status = (u: AdminUser) =>
    u.must_change_password ? <StatusBadge status="enRetard" label="Mot de passe à changer" /> : null;

  return (
    <>
      <div className="lg:hidden flex flex-col gap-2.5">
        {users.map((u) => {
          const content = (
            <>
              <Avatar u={u} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] truncate">
                  {displayName(u)}
                  {u.id === actor.id && <span className="text-text-muted font-normal"> (vous)</span>}
                </div>
                <div className="text-text-muted text-[13px]">
                  {ROLE_LABELS[u.role]} · {access(u)}
                </div>
                {status(u)}
              </div>
            </>
          );
          return canManage(actor, u) ? (
            <Link key={u.id} href={`/admin/utilisateurs/${u.id}`} className="flex items-start gap-3 p-4 rounded-lg bg-surface text-text shadow-[0_0_0_1px_var(--color-border)]">
              {content}
              <Icon name="chevronRight" className="text-text-muted self-center" />
            </Link>
          ) : (
            <div key={u.id} className="flex items-start gap-3 p-4 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)]">
              {content}
            </div>
          );
        })}
      </div>

      <Card padded={false} className="hidden lg:block overflow-hidden">
        <table className="w-full text-[14px] border-collapse">
          <thead>
            <tr className="bg-background text-text-muted text-[12px] uppercase tracking-wide text-left">
              <th className="font-semibold px-4 py-3">Utilisateur</th>
              <th className="font-semibold px-4 py-3">Rôle</th>
              <th className="font-semibold px-4 py-3">Restaurants</th>
              <th className="font-semibold px-4 py-3">Dernière visite</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-2">
            {users.map((u) => {
              const manage = canManage(actor, u);
              return (
                <tr key={u.id} className={`relative ${u.id === selectedId ? "bg-orange-soft" : manage ? "hover:bg-background" : ""}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar u={u} />
                      <div className="min-w-0">
                        {manage ? (
                          <Link href={`/admin/utilisateurs/${u.id}`} className="font-semibold text-text after:absolute after:inset-0">
                            {displayName(u)}
                          </Link>
                        ) : (
                          <span className="font-semibold">{displayName(u)}</span>
                        )}
                        {u.id === actor.id && <span className="text-text-muted"> (vous)</span>}
                        <div className="text-text-muted text-[12.5px] truncate">{u.email ?? u.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-2.5">{access(u)}</td>
                  <td className="px-4 py-2.5">{status(u) ?? lastVisit(u) ?? <span className="text-text-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
