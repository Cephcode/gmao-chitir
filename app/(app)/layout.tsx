// Layout des pages protégées : garde de session, changement de mot de passe
// obligatoire, puis coquille de navigation (menu latéral / barre du bas).
import { redirect } from "next/navigation";
import { getNavCounts, getProfile, ROLE_LABELS } from "@/lib/session";
import { Sidebar, BottomNav, FabPanne } from "@/components/app/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/connexion");
  if (profile.must_change_password) redirect("/changer-mot-de-passe");

  const { urgences, unread } = await getNavCounts();

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar
        firstName={profile.first_name ?? ""}
        roleLabel={ROLE_LABELS[profile.role]}
        isOwner={profile.role === "proprietaire"}
        urgences={urgences}
        unread={unread}
      />
      {/* Marge basse sur mobile : barre du bas (80px) + bouton flottant */}
      <main className="flex-1 min-w-0 pb-44 lg:pb-0">{children}</main>
      <BottomNav />
      <FabPanne />
    </div>
  );
}
