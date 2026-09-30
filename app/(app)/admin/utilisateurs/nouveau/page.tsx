// Créer un compte. Rôles et restaurants proposés limités selon l'acteur (délégation).
import { notFound } from "next/navigation";
import { ROLE_LABELS } from "@/lib/session";
import { ROLE_HELP, assignableRestaurants, assignableRoles, loadAdmin } from "@/lib/admin";
import { AdminHeader, UserList } from "@/components/app/admin/admin-views";
import { UserForm } from "@/components/app/admin/user-form";

export default async function NouveauComptePage() {
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  const allowed = assignableRestaurants(actor, restaurants.map((r) => r.id));
  const roles = assignableRoles(actor);
  return (
    <>
      <div className="hidden lg:flex max-w-6xl mx-auto px-8 pt-10 flex-col gap-5" aria-hidden>
        <AdminHeader actor={actor} tab="utilisateurs" userCount={users.length} restaurantCount={restaurants.length} />
        <UserList actor={actor} users={users} restaurants={restaurants} />
      </div>
      <UserForm
        initial={{
          id: null,
          identifiant: "",
          firstName: "",
          role: roles.includes("lecteur") ? "lecteur" : roles[0],
          allRestaurants: false,
          restaurantIds: allowed.length === 1 ? allowed : [],
        }}
        roles={roles.map((r) => ({ value: r, label: ROLE_LABELS[r], help: ROLE_HELP[r] }))}
        restaurants={restaurants.filter((r) => allowed.includes(r.id))}
        canGrantAll={actor.role === "proprietaire"}
        isSelf={false}
        canDelete={false}
        cancelHref="/admin/utilisateurs"
      />
    </>
  );
}
