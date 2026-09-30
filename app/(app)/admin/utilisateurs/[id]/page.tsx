// Modifier un compte : rôle, restaurants, mot de passe temporaire, suppression.
// Un compte hors de portée de l'acteur (délégation) renvoie à la liste.
import { notFound, redirect } from "next/navigation";
import { ROLE_LABELS } from "@/lib/session";
import { ROLE_HELP, assignableRestaurants, assignableRoles, canManage, loadAdmin } from "@/lib/admin";
import { AdminHeader, UserList } from "@/components/app/admin/admin-views";
import { UserForm } from "@/components/app/admin/user-form";

export default async function ComptePage(props: PageProps<"/admin/utilisateurs/[id]">) {
  const { id } = await props.params;
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  const target = users.find((u) => u.id === id);
  if (!target) notFound();
  if (!canManage(actor, target)) redirect("/admin/utilisateurs");

  const isSelf = target.id === actor.id;
  const allowed = assignableRestaurants(actor, restaurants.map((r) => r.id));
  // Son propre rôle reste affiché même s'il n'est pas attribuable (ex. propriétaire).
  const roles = isSelf ? [target.role] : assignableRoles(actor);

  return (
    <>
      <div className="hidden lg:flex max-w-6xl mx-auto px-8 pt-10 flex-col gap-5" aria-hidden>
        <AdminHeader actor={actor} tab="utilisateurs" userCount={users.length} restaurantCount={restaurants.length} />
        <UserList actor={actor} users={users} restaurants={restaurants} selectedId={target.id} />
      </div>
      <UserForm
        initial={{
          id: target.id,
          identifiant: target.email ?? target.phone ?? "",
          firstName: target.first_name ?? "",
          role: target.role,
          allRestaurants: target.all_restaurants,
          restaurantIds: target.restaurantIds,
        }}
        roles={roles.map((r) => ({ value: r, label: ROLE_LABELS[r], help: ROLE_HELP[r] }))}
        restaurants={restaurants.filter((r) => allowed.includes(r.id))}
        canGrantAll={actor.role === "proprietaire"}
        isSelf={isSelf}
        canDelete
        cancelHref="/admin/utilisateurs"
      />
    </>
  );
}
