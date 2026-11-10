// Réglages de la chaîne : administrateur (propriétaire) seulement.
// Nettoyage hebdomadaire des notifications lues (tâche pg_cron).
import { notFound, redirect } from "next/navigation";
import { loadAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AdminHeader } from "@/components/app/admin/admin-views";
import { PurgeToggle } from "@/components/app/admin/purge-toggle";

export default async function ReglagesPage() {
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  if (actor.role !== "proprietaire") redirect("/admin/utilisateurs");
  const supabase = await createClient();
  const { data: purgeActive } = await supabase.rpc("purge_notifications_active");

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-5">
      <AdminHeader actor={actor} tab="reglages" userCount={users.length} restaurantCount={restaurants.length} />
      <Card className="flex flex-col gap-2 p-5 max-w-2xl">
        <h2 className="font-display text-[18px] font-semibold m-0">Notifications</h2>
        <PurgeToggle initial={purgeActive === true} />
      </Card>
    </div>
  );
}
