import type { Metadata } from "next";
import { Figtree, Poppins } from "next/font/google";
import "./globals.css";

// Figtree (texte): lisible en petite taille, chiffres tabulaires pour quantites et dates.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Poppins (titres et chiffres): reprend la police ronde des visuels de l'enseigne.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GMAO Chitir Chicken",
  description: "Gestion de la maintenance des restaurants Chitir Chicken",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${figtree.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
