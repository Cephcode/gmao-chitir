// Ajouter un restaurant : propriétaire seulement (revérifié par la fonction SQL).
import { redirect } from "next/navigation";
import { loadAdmin, restaurantStats } from "@/lib/admin";
import { RestaurantForm } from "@/components/app/admin/restaurant-form";

export default async function NouveauRestaurantPage() {
  const { actor, users, restaurants } = await loadAdmin();
  if (actor?.role !== "proprietaire") redirect("/admin/utilisateurs");
  const stats = await restaurantStats(users);
  return (
    <RestaurantForm
      sources={restaurants.map((r) => ({ id: r.id, short_code: r.short_code, count: stats.get(r.id).equipments }))}
      cancelHref="/admin/restaurants"
    />
  );
}
