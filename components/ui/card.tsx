// Carte: surface blanche, coins de 16px, fin liseré. Base des listes, panneaux et indicateurs.

import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  // padding false quand la carte gere ses marges elle-meme (tableau, liste).
  padded?: boolean;
};

export function Card({ padded = true, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`bg-surface rounded-lg shadow-[0_0_0_1px_var(--color-border)] ${padded ? "p-6" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
