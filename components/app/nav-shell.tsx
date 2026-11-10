"use client";

// Menu latéral repliable (ordinateur) : déplié (256 px, icônes + libellés) ou replié en
// barre d'icônes (72 px). Le choix est gardé dans un cookie lu par le layout : le serveur
// rend directement la bonne largeur, sans saut au chargement.
import { createContext, useContext, useState, type ReactNode } from "react";

export const NAV_COOKIE = "gmao-nav-replie";

const NavContext = createContext<{ replie: boolean; basculer: () => void }>({
  replie: false,
  basculer: () => {},
});

export function useNavReplie() {
  return useContext(NavContext);
}

export function NavShell({ initialReplie, children }: { initialReplie: boolean; children: ReactNode }) {
  const [replie, setReplie] = useState(initialReplie);
  const basculer = () => {
    const suivant = !replie;
    setReplie(suivant);
    // Un an, tout le site ; pas d'information sensible (simple préférence d'affichage).
    document.cookie = `${NAV_COOKIE}=${suivant ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };
  return <NavContext.Provider value={{ replie, basculer }}>{children}</NavContext.Provider>;
}

// Zone de contenu : marge gauche = largeur du menu (ordinateur), suit le repli.
export function NavMain({ children }: { children: ReactNode }) {
  const { replie } = useNavReplie();
  return (
    <main
      className={`flex-1 min-w-0 pb-44 lg:pb-0 transition-[padding] duration-200 motion-reduce:transition-none ${
        replie ? "lg:pl-[72px]" : "lg:pl-64"
      }`}
    >
      {children}
    </main>
  );
}
