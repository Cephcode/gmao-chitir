// Administration : chargement des comptes et restaurants, mot de passe temporaire.
// Les règles de délégation sont dans lib/admin-rules.ts (réexportées ici).
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/session";

export {
  type Actor,
  type AdminUser,
  ROLE_HELP,
  assignableRestaurants,
  assignableRoles,
  canAccessAdmin,
  canManage,
  checkAssignment,
  normaliserAcces,
} from "@/lib/admin-rules";
import type { Actor, AdminUser } from "@/lib/admin-rules";

// L'acteur connecté, relu en base à chaque action (jamais depuis le navigateur).
export async function getActor(): Promise<Actor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("id, role, all_restaurants, user_restaurants(restaurant_id)")
    .eq("id", user.id)
    .single();
  if (!data) return null;
  const row = data as { id: string; role: Role; all_restaurants: boolean; user_restaurants: { restaurant_id: string }[] };
  return {
    id: row.id,
    role: row.role,
    allRestaurants: row.all_restaurants,
    restaurantIds: row.user_restaurants.map((r) => r.restaurant_id),
  };
}

// Comptes visibles (RLS : ceux qui partagent un restaurant avec l'acteur).
export async function listUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select(
      "id, first_name, email, phone, role, all_restaurants, must_change_password, last_seen_at, user_restaurants(restaurant_id)",
    );
  const order: Record<Role, number> = { proprietaire: 0, editeur: 1, commentateur: 2, lecteur: 3 };
  return ((data ?? []) as (Omit<AdminUser, "restaurantIds"> & { user_restaurants: { restaurant_id: string }[] })[])
    .map(({ user_restaurants, ...u }) => ({ ...u, restaurantIds: user_restaurants.map((r) => r.restaurant_id) }))
    .sort((a, b) => order[a.role] - order[b.role] || (a.first_name ?? a.email ?? "").localeCompare(b.first_name ?? b.email ?? "", "fr"));
}

export async function listRestaurants() {
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").select("id, short_code, name, address").order("short_code");
  return (data ?? []) as { id: string; short_code: string; name: string; address: string | null }[];
}

// Mot de passe temporaire : 12 caractères sans ambiguïté (pas de 0/O, 1/l/I).
export function motDePasseTemporaire(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Nom affiché : prénom, sinon e-mail ou téléphone.
export const displayName = (u: Pick<AdminUser, "first_name" | "email" | "phone">) =>
  u.first_name || u.email || u.phone || "Sans nom";

export const initials = (u: Pick<AdminUser, "first_name" | "email" | "phone">) =>
  displayName(u)
    .replace(/[^A-Za-zÀ-ÿ ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

// Données communes des pages d'administration.
export async function loadAdmin() {
  const [actor, users, restaurants] = await Promise.all([getActor(), listUsers(), listRestaurants()]);
  return { actor, users, restaurants };
}

// Synthèse par restaurant : équipements, pannes, entretiens en retard, comptes.
export async function restaurantStats(users: AdminUser[]) {
  const supabase = await createClient();
  const { data } = await supabase.from("equipments").select("restaurant_id, state, maintenance_plans(next_due_at)");
  const today = new Date().toISOString().slice(0, 10);
  type Row = { restaurant_id: string; state: string; maintenance_plans: { next_due_at: string | null } | { next_due_at: string | null }[] | null };
  const stats = new Map<string, { equipments: number; pannes: number; retards: number; users: number }>();
  const get = (id: string) => stats.get(id) ?? stats.set(id, { equipments: 0, pannes: 0, retards: 0, users: 0 }).get(id)!;
  for (const e of (data ?? []) as Row[]) {
    const s = get(e.restaurant_id);
    s.equipments++;
    if (e.state === "en_panne") s.pannes++;
    const plan = Array.isArray(e.maintenance_plans) ? e.maintenance_plans[0] : e.maintenance_plans;
    if (plan?.next_due_at && plan.next_due_at < today) s.retards++;
  }
  return { get, countUsers: (id: string) => users.filter((u) => u.all_restaurants || u.restaurantIds.includes(id)).length };
}
