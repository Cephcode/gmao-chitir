// Bouton du systeme de design.
// Regle metier: une seule action principale (orange) par ecran. Les autres actions
// utilisent secondary, ghost ou danger pour ne pas concurrencer l'action principale.

import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSoft";
type Size = "md" | "sm" | "cta";

// Classes par variante. Sur l'orange, le texte est toujours brun (on-orange), jamais blanc.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-orange text-on-orange hover:bg-orange-hover active:bg-orange-active disabled:bg-surface-2 disabled:text-border-strong",
  secondary:
    "bg-surface text-text shadow-[inset_0_0_0_1.5px_#D6CBBB] hover:bg-surface-2 disabled:text-border-strong",
  ghost: "bg-transparent text-orange-text hover:bg-orange-soft disabled:text-border-strong",
  danger: "bg-danger text-white hover:bg-[#9A1D13]",
  // Action destructive secondaire (ex. « Supprimer » dans une carte) : discrète tant
  // qu'elle n'est pas confirmée. Le rouge plein (danger) est réservé à la confirmation.
  // Même gabarit que secondary (fond surface + bordure intérieure 1,5 px) pour s'aligner à côté.
  dangerSoft:
    "bg-surface text-danger shadow-[inset_0_0_0_1.5px_#F1B8B2] hover:bg-danger-bg disabled:text-border-strong",
};

// Hauteur et rayon par taille. md = 48px (defaut), sm = 36px compact, cta = 56px (action terrain).
const sizeClasses: Record<Size, string> = {
  md: "h-field rounded px-5 text-[16px]",
  sm: "h-9 rounded-sm px-3.5 text-[14px]",
  cta: "h-cta rounded-lg px-5 text-[16px] shadow-[0_6px_16px_rgba(43,26,16,.22)]",
};

// Classes d'un bouton, réutilisables sur un lien (<Link className={buttonClass(...)}>)
// pour qu'une navigation ait exactement l'apparence d'un bouton.
export function buttonClass({
  variant = "primary",
  size = "md",
  iconOnly = false,
}: { variant?: Variant; size?: Size; iconOnly?: boolean } = {}) {
  const shape = iconOnly ? "size-touch rounded p-0" : sizeClasses[size];
  return `inline-flex items-center justify-center gap-2 border-0 font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${shape}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  // Icone optionnelle placee avant le texte.
  icon?: IconName;
  // Bouton carre sans texte (44x44). Fournir aria-label pour l'accessibilite.
  iconOnly?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconOnly = false,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClass({ variant, size, iconOnly })} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={iconOnly || size === "sm" ? 16 : 20} />}
      {!iconOnly && children}
    </button>
  );
}
