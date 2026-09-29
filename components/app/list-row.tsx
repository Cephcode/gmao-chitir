// Ligne de liste tactile (min. 72px) : icône, nom, sous-titre, badge de statut.
// Réutilisée par le tableau de bord et, plus tard, les listes d'équipements.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export function ListRow({
  href,
  icon,
  name,
  sub,
  badge,
}: {
  href: string;
  icon: IconName;
  name: string;
  sub: string;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 py-3 min-h-[72px] text-text hover:bg-background transition-colors"
    >
      <div className="size-11 rounded bg-surface-2 flex items-center justify-center text-[#4E2F21] shrink-0">
        <Icon name={icon} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="font-semibold text-[15px] truncate">{name}</div>
        <div className="text-text-muted text-[13px] truncate">{sub}</div>
      </div>
      {badge}
    </Link>
  );
}
