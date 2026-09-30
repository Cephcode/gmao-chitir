// Garde de l'administration : propriétaire et éditeur seulement (l'éditeur ne gère que
// les comptes de ses restaurants). Les actions serveur revérifient chaque droit.
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { canAccessAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!canAccessAdmin(profile?.role)) redirect("/");
  return <>{children}</>;
}
