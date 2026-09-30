// Identifiant de connexion : e-mail ou numéro de téléphone.
// Même normalisation à la création du compte et à la connexion, pour que
// « 70 12 34 56 », « 0022670123456 » et « +226 70 12 34 56 » désignent le même compte.

const PAYS_PAR_DEFAUT = "226"; // Burkina Faso : numéros locaux à 8 chiffres

export type Identifiant = { email: string } | { phone: string };

// Renvoie l'e-mail (en minuscules) ou le téléphone au format international (+226…),
// ou null si la saisie n'est ni l'un ni l'autre.
export function normaliserIdentifiant(saisie: string): Identifiant | null {
  const s = saisie.trim();
  if (s.includes("@")) {
    const email = s.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : null;
  }
  let chiffres = s.replace(/[\s.\-()]/g, "");
  if (chiffres.startsWith("00")) chiffres = "+" + chiffres.slice(2);
  if (/^\d{8}$/.test(chiffres)) chiffres = `+${PAYS_PAR_DEFAUT}${chiffres}`;
  return /^\+\d{8,15}$/.test(chiffres) ? { phone: chiffres } : null;
}
