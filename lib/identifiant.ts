// Identifiant de connexion : l'e-mail (décision du 2026-09-30, pas de connexion par
// téléphone : un fournisseur SMS serait payant au-delà des crédits gratuits).
// Même normalisation à la création du compte et à la connexion.

// E-mail en minuscules sans espaces autour, ou null s'il n'est pas valide.
export function normaliserEmail(saisie: string): string | null {
  const email = saisie.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
