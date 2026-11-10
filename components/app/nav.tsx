"use client";

// Coquille de navigation.
// Mobile : barre du bas (4 onglets) + bouton flottant « Déclarer une panne ».
// Ordinateur : menu latéral fixe, « Déclarer une panne » en tête, utilisateur en bas ;
// repliable en barre d'icônes (components/app/nav-shell.tsx).
// « Déclarer une panne » est visible pour tous les rôles (règle métier).
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { deconnexion } from "@/lib/auth-actions";
import { oublierCetAppareil } from "@/lib/push-appareil";
import { useNavReplie } from "@/components/app/nav-shell";

// also : autres adresses où l'onglet reste actif (l'onglet mobile Stock couvre aussi les consommables).
type NavItem = { href: string; label: string; short: string; icon: IconName; also?: string[] };

const MAIN_ITEMS: NavItem[] = [
  { href: "/", label: "Tableau de bord", short: "Accueil", icon: "home" },
  { href: "/equipements", label: "Équipements", short: "Équipements", icon: "fridge" },
  { href: "/interventions", label: "Interventions", short: "Interventions", icon: "wrench" },
  { href: "/stock", label: "Stock", short: "Stock", icon: "box", also: ["/consommables"] },
];

// Menu latéral seulement : la barre du bas garde 4 onglets.
const CONSOMMABLES_ITEM: NavItem = { href: "/consommables", label: "Consommables", short: "Consommables", icon: "cup" };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Pastille de compteur (urgences, notifications non lues). Masquée à zéro.
// compact : menu replié, la pastille passe sur le coin de l'icône.
function CountBadge({ value, label, compact = false }: { value: number; label: string; compact?: boolean }) {
  if (value <= 0) return null;
  return (
    <span
      aria-label={label}
      className={`min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center tabular-nums ${
        compact ? "absolute top-0 right-0 ring-2 ring-sidebar" : "ml-auto"
      }`}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function Sidebar({
  firstName,
  roleLabel,
  canAdmin,
  urgences,
  unread,
}: {
  firstName: string;
  roleLabel: string;
  canAdmin: boolean; // propriétaire ou éditeur (délégation des comptes)
  urgences: number;
  unread: number;
}) {
  const pathname = usePathname();
  const { replie, basculer } = useNavReplie();
  const items: (NavItem & { badge?: number; badgeLabel?: string })[] = [
    ...MAIN_ITEMS.map((i) =>
      i.href === "/interventions"
        ? { ...i, badge: urgences, badgeLabel: `${urgences} urgences en cours` }
        : i,
    ),
    CONSOMMABLES_ITEM,
    { href: "/notifications", label: "Notifications", short: "Notifications", icon: "bell", badge: unread, badgeLabel: `${unread} non lues` },
    ...(canAdmin
      ? [{ href: "/admin/utilisateurs", label: "Administration", short: "Admin", icon: "shield" as IconName }]
      : []),
  ];
  const initials = firstName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    // Fixé à gauche (et non sticky) pour ne pas bouger au défilement de la page. Si la
    // fenêtre est basse (barre de favoris, petit écran), le menu défile de lui-même au lieu
    // de tasser ses éléments ; overscroll-contain garde ce défilement dans le menu.
    // Replié : barre d'icônes de 72 px ; les libellés restent lus par les lecteurs d'écran
    // (sr-only) et s'affichent au survol (title).
    <aside
      id="menu-lateral"
      className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 overflow-y-auto overflow-x-hidden overscroll-contain bg-sidebar text-sidebar-text p-3 gap-4 [&>*]:shrink-0 transition-[width] duration-200 motion-reduce:transition-none ${
        replie ? "w-[72px]" : "w-64"
      }`}
    >
      <div className={`flex items-center gap-3 pt-2 ${replie ? "flex-col px-0" : "px-2"}`}>
        <Image src="/logo-chitir.png" alt="" width={40} height={40} className="rounded-sm" />
        {!replie && <div className="flex-1 font-display font-semibold leading-tight">GMAO Chitir</div>}
        <button
          type="button"
          onClick={basculer}
          aria-expanded={!replie}
          aria-controls="menu-lateral"
          aria-label={replie ? "Déplier le menu" : "Replier le menu"}
          title={replie ? "Déplier le menu" : "Replier le menu"}
          className="size-9 rounded-sm flex items-center justify-center text-[#A89886] hover:bg-[#3A281C] hover:text-white cursor-pointer"
        >
          <Icon name="chevronRight" size={18} className={replie ? "" : "rotate-180"} />
        </button>
      </div>

      <Link
        href="/panne"
        aria-label={replie ? "Déclarer une panne" : undefined}
        title={replie ? "Déclarer une panne" : undefined}
        className={replie ? `${buttonClass({ iconOnly: true })} w-full` : `${buttonClass()} w-full`}
      >
        <Icon name="alert" />
        {!replie && "Déclarer une panne"}
      </Link>

      <nav aria-label="Navigation principale" className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={replie ? item.label : undefined}
              className={`relative flex items-center gap-3 h-11 rounded-sm font-semibold text-[15px] transition-colors ${
                replie ? "justify-center px-0" : "px-3"
              } ${active ? "bg-sidebar-text text-filter-active" : "text-[#E9DCC8] hover:bg-[#3A281C] hover:text-white"}`}
            >
              <Icon name={item.icon} />
              <span className={replie ? "sr-only" : ""}>{item.label}</span>
              {item.badge !== undefined && (
                <CountBadge value={item.badge} label={item.badgeLabel ?? ""} compact={replie} />
              )}
            </Link>
          );
        })}
      </nav>

      <div
        className={`mt-auto flex items-center gap-3 border-t border-[#3A281C] pt-4 ${
          replie ? "flex-col px-0 pb-2" : "p-2"
        }`}
      >
        <div
          title={replie ? `${firstName} · ${roleLabel}` : undefined}
          className="size-10 rounded-full bg-orange text-on-orange font-bold flex items-center justify-center shrink-0"
        >
          {initials || "?"}
        </div>
        <div className={replie ? "sr-only" : "flex-1 min-w-0"}>
          <div className="font-semibold truncate">{firstName}</div>
          <div className="text-[13px] text-[#A89886]">{roleLabel}</div>
        </div>
        {/* Avant de fermer la session : ce navigateur ne reçoit plus les push de ce compte. */}
        <form
          action={async () => {
            await oublierCetAppareil();
            await deconnexion();
          }}
        >
          <button
            type="submit"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            className="size-10 rounded-sm flex items-center justify-center text-[#E9DCC8] hover:bg-[#3A281C] hover:text-white cursor-pointer"
          >
            <Icon name="logout" />
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      data-hide-on-keyboard
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-border grid grid-cols-4 px-2 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]"
    >
      {MAIN_ITEMS.map((item) => {
        const active = [item.href, ...(item.also ?? [])].some((href) => isActive(pathname, href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-14 text-[12px] font-semibold ${
              active ? "text-filter-active" : "text-text-muted hover:text-filter-active"
            }`}
          >
            <span
              className={`flex items-center justify-center w-14 h-[30px] rounded-full ${
                active ? "bg-orange-selected" : ""
              }`}
            >
              <Icon name={item.icon} />
            </span>
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}

// Bouton flottant mobile, au-dessus de la barre du bas. Masqué sur l'écran de déclaration lui-même.
export function FabPanne() {
  const pathname = usePathname();
  if (pathname.startsWith("/panne")) return null;
  return (
    <Link
      href="/panne"
      data-hide-on-keyboard
      className={`${buttonClass({ size: "cta" })} lg:hidden fixed right-4 bottom-[96px] z-30`}
    >
      <Icon name="alert" />
      Déclarer une panne
    </Link>
  );
}
