// Manifeste de l'application : la rend installable (écran d'accueil Android et iPhone).
// Sur iPhone, les notifications push n'existent que pour une application installée.
// Icônes générées depuis public/logo-chitir.png (180 px) : à refaire depuis un logo HD.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GMAO Chitir Chicken",
    short_name: "GMAO Chitir",
    description: "Maintenance des restaurants Chitir Chicken",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf8f3",
    theme_color: "#2a1b12",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
