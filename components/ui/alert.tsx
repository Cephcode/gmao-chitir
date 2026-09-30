// Messages en bandeau: fond leger teinté, liseré assorti, icone + texte.
// Le titre (optionnel) est en gras ; l'action optionnelle (lien ou bouton) est a droite.

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

type Variant = "success" | "danger" | "warning" | "info";

// Par variante: fond, couleur d'icone, liseré (teinte plus soutenue du fond) et icone par defaut.
const variants: Record<Variant, { box: string; icon: string; defaultIcon: IconName }> = {
  success: { box: "bg-success-bg shadow-[inset_0_0_0_1px_#A8DCC0]", icon: "text-success", defaultIcon: "check" },
  danger: { box: "bg-danger-bg shadow-[inset_0_0_0_1px_#F4B8B0]", icon: "text-danger", defaultIcon: "xc" },
  warning: { box: "bg-warning-bg shadow-[inset_0_0_0_1px_#F2D68A]", icon: "text-warning", defaultIcon: "clock" },
  info: { box: "bg-info-bg shadow-[inset_0_0_0_1px_#B9D0EE]", icon: "text-info", defaultIcon: "eye" },
};

export function Alert({
  variant,
  title,
  icon,
  action,
  children,
}: {
  variant: Variant;
  title?: string;
  icon?: IconName;
  action?: ReactNode;
  children: ReactNode;
}) {
  const v = variants[variant];
  return (
    <div className={`flex items-start gap-3 py-3.5 px-4 rounded text-text ${v.box}`}>
      <Icon name={icon ?? v.defaultIcon} className={`${v.icon} mt-px shrink-0`} />
      <div className="flex-1 text-[14px]">
        {title && <div className="font-bold text-[15px]">{title}</div>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Confirmation d'action (style sombre, ex. panne envoyee), avec annulation possible.
export function Toast({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3.5 px-4 rounded bg-[#1B3A2A] text-white">
      <Icon name="check" className="text-[#7FD1A5] shrink-0" />
      <div className="flex-1 font-semibold">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
