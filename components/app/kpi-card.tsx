// Indicateur cliquable du tableau de bord.
// Règle du système de design : fond teinté seulement quand il y a quelque chose
// à faire ; à zéro, la carte redevient blanche.
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

type Tone = "danger" | "warning";

const toneClasses: Record<Tone, { bg: string; text: string }> = {
  danger: { bg: "bg-danger-bg", text: "text-danger" },
  warning: { bg: "bg-warning-bg", text: "text-warning" },
};

export function KpiCard({
  href,
  label,
  value,
  icon,
  tone,
  total,
}: {
  href: string;
  label: string;
  value: number;
  icon: IconName;
  tone: Tone;
  total?: number; // affiché « 4 / 49 » quand fourni
}) {
  const active = value > 0;
  const t = toneClasses[tone];
  return (
    <Link
      href={href}
      className={`flex flex-col gap-2.5 p-3.5 rounded-lg min-h-[104px] text-text transition-shadow hover:shadow-[0_0_0_2px_var(--color-ring)] ${
        active ? t.bg : "bg-surface shadow-[0_0_0_1px_var(--color-border)]"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 font-bold text-[14px] ${active ? t.text : "text-text-muted"}`}
      >
        <Icon name={icon} size={16} />
        {label}
      </div>
      <div className="font-display text-[32px] font-semibold leading-none tabular-nums">
        {value}
        {total !== undefined && (
          <span className="text-text-muted text-[18px] font-medium"> / {total}</span>
        )}
      </div>
    </Link>
  );
}
