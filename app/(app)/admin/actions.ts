"use server";

// Actions d'administration. Les tables users et user_restaurants n'ont pas de politique
// d'écriture (voulu) : on écrit avec le client admin (service role), UNIQUEMENT après avoir
// relu l'acteur en base et vérifié les règles de délégation (lib/admin.ts).
// Le mot de passe temporaire n'est renvoyé qu'une fois, à l'écran de la personne qui agit ;
// il n'est ni stocké ni journalisé.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliserEmail } from "@/lib/identifiant";
import type { Role } from "@/lib/session";
import {
  type AdminUser,
  canManage,
  checkAssignment,
  getActor,
  listRestaurants,
  motDePasseTemporaire,
} from "@/lib/admin";

export type AccountResult =
  | { ok: true; tempPassword?: string; identifiant?: string; message?: string }
  | { ok: false; error: string; field?: "identifiant" | "role" | "restaurants" }
  | null;

type Assignment = { role: Role; allRestaurants: boolean; restaurantIds: string[] };

// Compte cible relu avec le client admin (état réel, indépendant des RLS).
async function loadTarget(id: string): Promise<AdminUser | null> {
  const { data } = await createAdminClient()
    .from("users")
    .select("id, first_name, email, phone, role, all_restaurants, must_change_password, last_seen_at, user_restaurants(restaurant_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { user_restaurants, ...u } = data as Omit<AdminUser, "restaurantIds"> & { user_restaurants: { restaurant_id: string }[] };
  return { ...u, restaurantIds: user_restaurants.map((r) => r.restaurant_id) };
}

async function ownerCount() {
  const { count } = await createAdminClient()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "proprietaire");
  return count ?? 0;
}

async function setRestaurants(userId: string, a: Assignment) {
  const admin = createAdminClient();
  await admin.from("user_restaurants").delete().eq("user_id", userId);
  if (!a.allRestaurants && a.restaurantIds.length) {
    const { error } = await admin
      .from("user_restaurants")
      .insert(a.restaurantIds.map((restaurant_id) => ({ user_id: userId, restaurant_id })));
    if (error) throw error;
  }
}

export async function creerCompte(input: Assignment & { identifiant: string; firstName: string }): Promise<AccountResult> {
  const actor = await getActor();
  if (!actor || (actor.role !== "proprietaire" && actor.role !== "editeur")) {
    return { ok: false, error: "Votre rôle ne permet pas de créer des comptes." };
  }
  const email = normaliserEmail(input.identifiant);
  if (!email) return { ok: false, error: "Saisissez un e-mail valide.", field: "identifiant" };
  const allIds = (await listRestaurants()).map((r) => r.id);
  const refus = checkAssignment(actor, input, allIds);
  if (refus) return { ok: false, error: refus, field: refus.includes("rôle") ? "role" : "restaurants" };

  const admin = createAdminClient();
  const tempPassword = motDePasseTemporaire();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (authError || !created.user) {
    const exists = /already|registered|exists/i.test(authError?.message ?? "");
    return {
      ok: false,
      error: exists ? "Un compte existe déjà avec cet e-mail." : "Le compte n'a pas pu être créé. Réessayez.",
      field: exists ? "identifiant" : undefined,
    };
  }

  const userId = created.user.id;
  const { error: profileError } = await admin.from("users").insert({
    id: userId,
    first_name: input.firstName.trim() || null,
    email,
    role: input.role,
    all_restaurants: input.allRestaurants,
    must_change_password: true,
    created_by: actor.id,
  });
  try {
    if (profileError) throw profileError;
    await setRestaurants(userId, input);
  } catch {
    // Pas de compte à moitié créé : on annule l'authentification (le profil suit en cascade).
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Le compte n'a pas pu être créé. Réessayez." };
  }

  revalidatePath("/admin", "layout");
  return { ok: true, tempPassword, identifiant: email };
}

export async function modifierCompte(input: Assignment & { id: string; firstName: string }): Promise<AccountResult> {
  const actor = await getActor();
  const target = await loadTarget(input.id);
  if (!actor || !target || !canManage(actor, target)) {
    return { ok: false, error: "Vous ne pouvez pas modifier ce compte." };
  }
  const sameRestaurants =
    input.restaurantIds.length === target.restaurantIds.length &&
    input.restaurantIds.every((id) => target.restaurantIds.includes(id));
  if (
    target.id === actor.id &&
    (input.role !== target.role || input.allRestaurants !== target.all_restaurants || (!input.allRestaurants && !sameRestaurants))
  ) {
    return { ok: false, error: "Vous ne pouvez pas changer votre propre rôle ni votre accès." };
  }
  if (target.role === "proprietaire" && input.role !== "proprietaire" && (await ownerCount()) <= 1) {
    return { ok: false, error: "Il doit rester au moins un propriétaire.", field: "role" };
  }
  const allIds = (await listRestaurants()).map((r) => r.id);
  const refus = checkAssignment(actor, input, allIds);
  if (refus) return { ok: false, error: refus, field: refus.includes("rôle") ? "role" : "restaurants" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ first_name: input.firstName.trim() || null, role: input.role, all_restaurants: input.allRestaurants })
    .eq("id", target.id);
  if (error) return { ok: false, error: "La modification a échoué. Réessayez." };
  try {
    await setRestaurants(target.id, input);
  } catch {
    return { ok: false, error: "Le rôle est enregistré, mais pas les restaurants. Réessayez." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Compte mis à jour." };
}

export async function reinitialiserMotDePasse(id: string): Promise<AccountResult> {
  const actor = await getActor();
  const target = await loadTarget(id);
  if (!actor || !target || !canManage(actor, target) || target.id === actor.id) {
    return { ok: false, error: "Vous ne pouvez pas réinitialiser ce mot de passe." };
  }
  const admin = createAdminClient();
  const tempPassword = motDePasseTemporaire();
  const { error } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
  if (error) return { ok: false, error: "La réinitialisation a échoué. Réessayez." };
  await admin.from("users").update({ must_change_password: true }).eq("id", id);
  revalidatePath("/admin", "layout");
  return { ok: true, tempPassword, identifiant: target.email ?? target.phone ?? "" };
}

export async function supprimerCompte(id: string): Promise<AccountResult> {
  const actor = await getActor();
  const target = await loadTarget(id);
  if (!actor || !target || !canManage(actor, target) || target.id === actor.id) {
    return { ok: false, error: "Vous ne pouvez pas supprimer ce compte." };
  }
  if (target.role === "proprietaire" && (await ownerCount()) <= 1) {
    return { ok: false, error: "Il doit rester au moins un propriétaire." };
  }
  const admin = createAdminClient();
  // La trace « créé par » des comptes qu'il a créés est effacée (sinon la suppression est bloquée).
  await admin.from("users").update({ created_by: null }).eq("created_by", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: "La suppression a échoué. Réessayez." };
  revalidatePath("/", "layout");
  redirect("/admin/utilisateurs");
}

export type RestaurantResult = { ok: false; error: string; field?: "name" | "code" } | null;

// Ajout d'un restaurant : fonction SQL ajouter_restaurant (propriétaire, une transaction,
// copie facultative de la liste d'équipements d'un autre restaurant).
export async function ajouterRestaurant(input: {
  name: string;
  shortCode: string;
  address: string;
  copyFrom: string | null;
}): Promise<RestaurantResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajouter_restaurant", {
    p_name: input.name,
    p_short_code: input.shortCode,
    p_address: input.address,
    p_copy_from: input.copyFrom,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ce code court est déjà utilisé.", field: "code" };
    if (["42501", "22023", "P0002"].includes(error.code ?? "")) {
      return { ok: false, error: error.message, field: error.message.includes("Code court") ? "code" : error.message.includes("nom") ? "name" : undefined };
    }
    return { ok: false, error: "Le restaurant n'a pas pu être ajouté. Réessayez." };
  }
  revalidatePath("/", "layout");
  redirect("/admin/restaurants");
}
