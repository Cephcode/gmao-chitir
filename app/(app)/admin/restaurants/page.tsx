// Restaurants (O-11) : propriétaire seulement. Synthèse par restaurant.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadAdmin, restaurantStats } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminHeader } from "@/components/app/admin/admin-views";

export default async function RestaurantsPage() {
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  if (actor.role !== "proprietaire") redirect("/admin/utilisateurs");
  const stats = await restaurantStats(users);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-5">
      <AdminHeader actor={actor} tab="restaurants" userCount={users.length} restaurantCount={restaurants.length} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {restaurants.map((r) => {
          const s = stats.get(r.id);
          return (
            <Card key={r.id} className="flex flex-col gap-2 p-5">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[20px] font-semibold">{r.short_code}</span>
                <span className="text-text-muted text-[14px] truncate">{r.name}</span>
              </div>
              {r.address && <div className="text-text-muted text-[13px]">{r.address}</div>}
              <div className="text-[14px]">
                {s.equipments} équipement{s.equipments > 1 ? "s" : ""} · {stats.countUsers(r.id)} utilisateur
                {stats.countUsers(r.id) > 1 ? "s" : ""}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.pannes > 0 && <StatusBadge status="enPanne" label={`${s.pannes} en panne`} />}
                {s.retards > 0 && <StatusBadge status="enRetard" label={`${s.retards} en retard`} />}
                {s.pannes === 0 && s.retards === 0 && <StatusBadge status="operationnel" label="Tout fonctionne" />}
              </div>
              <Link href={`/equipements?restaurant=${r.short_code}`} className="self-start py-2 text-orange-text font-bold text-[14px]">
                Voir les équipements
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
