import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Développement seulement : autorise le téléphone à charger les scripts du serveur
  // `next dev` via l'adresse réseau du PC. Next compare le nom exact ou un joker « * »
  // (pas de notation réseau /24, sinon les scripts sont bloqués et la page reste inerte).
  allowedDevOrigins: ["192.168.11.*"],
};

export default nextConfig;
