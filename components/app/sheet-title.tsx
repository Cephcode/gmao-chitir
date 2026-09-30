// Titre d'une fiche (équipement, intervention, pièce).
// Mobile : la fiche est seule à l'écran, son titre est le titre de la page (h1).
// Ordinateur : la liste à gauche porte déjà le h1, la fiche garde un h2.
// Un seul des deux est affiché (l'autre est en display: none), donc un seul est lu
// par les lecteurs d'écran.
export function SheetTitle({ children }: { children: React.ReactNode }) {
  const className = "font-display text-[22px] font-semibold m-0 leading-tight";
  return (
    <>
      <h1 className={`lg:hidden ${className}`}>{children}</h1>
      <h2 className={`hidden lg:block ${className}`}>{children}</h2>
    </>
  );
}
