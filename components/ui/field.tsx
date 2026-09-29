// Champs de formulaire: libelle, saisie, aide ou message d'erreur.
// Etats visuels: focus (liseré orange + halo), erreur (liseré rouge + message avec icone).

import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// Enveloppe d'un champ: libelle au-dessus, aide ou erreur en dessous.
// error a la priorite sur hint (on ne montre jamais les deux en meme temps).
export function Field({
  label,
  htmlFor,
  optional = false,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[14px] font-semibold mb-1.5 text-text">
        {label}
        {optional && <span className="text-text-muted font-normal"> (facultatif)</span>}
      </label>
      {children}
      {error ? (
        <div className="flex items-center gap-1.5 text-danger text-[13px] font-semibold mt-1.5">
          <Icon name="xc" size={16} />
          {error}
        </div>
      ) : (
        hint && <div className="text-text-muted text-[13px] mt-1.5">{hint}</div>
      )}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  // Icone au debut (ex. loupe) et a la fin (ex. chevron) du champ.
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  // Passe l'enveloppe en rouge quand le champ est invalide.
  invalid?: boolean;
};

export function TextInput({
  leadingIcon,
  trailingIcon,
  invalid = false,
  className = "",
  ...props
}: TextInputProps) {
  // Liseré: gris fonce au repos, orange au focus (halo), rouge si invalide.
  const border = invalid
    ? "border-danger"
    : "border-border-strong focus-within:border-orange focus-within:shadow-[0_0_0_3px_var(--color-orange-selected)]";
  return (
    <div
      className={`flex items-center gap-2.5 h-field rounded border-[1.5px] bg-surface px-3.5 text-[16px] text-text transition-shadow ${border} ${className}`}
    >
      {leadingIcon && <Icon name={leadingIcon} className="text-text-muted" />}
      <input
        className="flex-1 min-w-0 border-0 outline-0 bg-transparent text-inherit placeholder:text-text-muted"
        {...props}
      />
      {trailingIcon && <Icon name={trailingIcon} />}
    </div>
  );
}
