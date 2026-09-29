// Utilisateur connecté et son profil, lus une seule fois par requête
// (cache React partagé entre le layout et la page).
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "proprietaire" | "editeur" | "commentateur" | "lecteur";

export type Profile = {
  id: string;
  first_name: string | null;
  role: Role;
  must_change_password: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
  proprietaire: "Propriétaire",
  editeur: "Éditeur",
  commentateur: "Commentateur",
  lecteur: "Lecteur",
};

// Urgences en cours (restaurants accessibles, via RLS) et notifications non lues
// (les siennes, via RLS). Utilisés par le menu latéral et la cloche mobile.
export const getNavCounts = cache(async () => {
  const supabase = await createClient();
  const [{ count: urgences }, { count: unread }] = await Promise.all([
    supabase
      .from("interventions")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_cours")
      .eq("type", "urgence"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);
  return { urgences: urgences ?? 0, unread: unread ?? 0 };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, first_name, role, must_change_password")
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
});
