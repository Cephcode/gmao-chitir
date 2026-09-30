"use server";

// Actions des notifications. Les RLS limitent chaque écriture aux notifications
// et réglages de l'utilisateur connecté (user_id = auth.uid()).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SETTINGS, safeLink, type NotificationType } from "@/lib/notifications";

// « Voir » : marque comme lue puis ouvre la page liée (lien interne seulement).
export async function ouvrirNotification(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null)
    .select("link");
  // Déjà lue : on relit simplement le lien.
  let link = (data?.[0] as { link: string | null } | undefined)?.link ?? null;
  if (!data?.length) {
    const { data: row } = await supabase.from("notifications").select("link").eq("id", id).maybeSingle();
    link = (row as { link: string | null } | null)?.link ?? null;
  }
  revalidatePath("/", "layout");
  redirect(safeLink(link));
}

export async function toutMarquerLu() {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}

// Interrupteur « Mes alertes » : crée ou met à jour la ligne de réglage.
export async function reglerAlerte(type: NotificationType, enabled: boolean) {
  if (!SETTINGS.some((s) => s.type === type)) return { ok: false as const };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, type, enabled }, { onConflict: "user_id,type" });
  revalidatePath("/notifications", "layout");
  return { ok: !error };
}
