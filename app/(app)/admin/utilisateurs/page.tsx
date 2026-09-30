// Comptes (M-09a / O-10). Propriétaire : tous ; éditeur : ceux de ses restaurants.
import { notFound } from "next/navigation";
import { loadAdmin } from "@/lib/admin";
import { AdminHeader, UserList } from "@/components/app/admin/admin-views";

export default async function UtilisateursPage() {
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-5">
      <AdminHeader actor={actor} tab="utilisateurs" userCount={users.length} restaurantCount={restaurants.length} />
      <UserList actor={actor} users={users} restaurants={restaurants} />
    </div>
  );
}
