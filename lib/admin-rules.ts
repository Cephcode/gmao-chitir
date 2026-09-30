// Règles de délégation de l'administration, sans accès à la base : testables seules
// (voir docs/journal-decisions.md). Vérifiées côté serveur avant toute écriture.
// - propriétaire : gère tout le monde, tous les rôles, tous les restaurants ; il a
//   toujours accès à tous les restaurants (contrainte en base, recette S-M2) ;
// - éditeur : gère seulement les éditeurs, commentateurs et lecteurs de SES restaurants,
//   ne crée jamais de propriétaire ni d'accès « tous les restaurants » ;
// - personne ne change son propre rôle ni ne supprime son propre compte (actions) ;
// - il reste toujours au moins un propriétaire (actions).
import type { Role } from "@/lib/session";

export type Actor = { id: string; role: Role; allRestaurants: boolean; restaurantIds: string[] };

export type AdminUser = {
  id: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  all_restaurants: boolean;
  must_change_password: boolean;
  last_seen_at: string | null;
  restaurantIds: string[];
};

export const ROLE_HELP: Record<Role, string> = {
  proprietaire: "Accès total, gère utilisateurs et restaurants.",
  editeur: "Crée et modifie équipements, interventions, stock.",
  commentateur: "Technicien : intervient, clôture, note les entretiens.",
  lecteur: "Consulte et déclare les pannes. Idéal pour le personnel.",
};

export const canAccessAdmin = (role: Role | undefined) => role === "proprietaire" || role === "editeur";

// Rôles qu'un acteur peut attribuer.
export function assignableRoles(actor: Actor): Role[] {
  return actor.role === "proprietaire"
    ? ["proprietaire", "editeur", "commentateur", "lecteur"]
    : ["editeur", "commentateur", "lecteur"];
}

// Restaurants qu'un acteur peut attribuer (ids), parmi ceux qui existent.
export function assignableRestaurants(actor: Actor, allIds: string[]): string[] {
  return actor.role === "proprietaire" || actor.allRestaurants
    ? allIds
    : allIds.filter((id) => actor.restaurantIds.includes(id));
}

// Un propriétaire a toujours accès à tous les restaurants : on force le choix avant de
// vérifier et d'écrire (la base refuse de toute façon un propriétaire limité).
export function normaliserAcces<T extends { role: Role; allRestaurants: boolean; restaurantIds: string[] }>(input: T): T {
  return input.role === "proprietaire" ? { ...input, allRestaurants: true, restaurantIds: [] } : input;
}

// L'acteur peut-il gérer ce compte (modifier, réinitialiser, supprimer) ?
export function canManage(actor: Actor, target: AdminUser): boolean {
  if (actor.role === "proprietaire") return true;
  if (actor.role !== "editeur") return false;
  if (target.role === "proprietaire" || target.all_restaurants) return false;
  // Un compte sans restaurant (dormant, restaurant supprimé) reste au propriétaire (recette S-B7).
  if (target.restaurantIds.length === 0) return false;
  // Tous les restaurants du compte doivent être parmi ceux de l'éditeur.
  return actor.allRestaurants || target.restaurantIds.every((id) => actor.restaurantIds.includes(id));
}

// Validation d'une attribution rôle + restaurants. Renvoie un message d'erreur ou null.
export function checkAssignment(
  actor: Actor,
  input: { role: Role; allRestaurants: boolean; restaurantIds: string[] },
  allIds: string[],
): string | null {
  if (!assignableRoles(actor).includes(input.role)) return "Vous ne pouvez pas attribuer ce rôle.";
  if (input.role === "proprietaire" && !input.allRestaurants) return "Un propriétaire a accès à tous les restaurants.";
  if (input.allRestaurants) {
    return actor.role === "proprietaire" ? null : "Seul un propriétaire donne l'accès à tous les restaurants.";
  }
  if (input.restaurantIds.length === 0) return "Choisissez au moins un restaurant.";
  const allowed = assignableRestaurants(actor, allIds);
  if (input.restaurantIds.some((id) => !allowed.includes(id))) {
    return "Vous ne pouvez donner accès qu'à vos restaurants.";
  }
  return null;
}
