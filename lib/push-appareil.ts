// Jeton push de CE navigateur, côté client : gardé localement pour connaître l'état
// au retour sur la page, et oublié quand on coupe les push ou qu'on se déconnecte
// (recette S-B3 : sur un appareil partagé, les alertes du compte précédent ne
// doivent plus arriver). Les jetons des autres appareils ne sont pas touchés.
import { oublierAppareil } from "@/app/(app)/notifications/actions";
import { supprimerJetonPush } from "@/lib/firebase-client";

const STORAGE_KEY = "gmao-push-token";

export function lireJetonLocal() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ecrireJetonLocal(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : l'état sera recalculé à la prochaine visite.
  }
}

// Retire ce navigateur des appareils du compte connecté, puis invalide son jeton Firebase.
// Sans jeton local (push jamais activés ici), rien à faire : Firebase n'est pas chargé.
// Ne lève jamais d'erreur : la déconnexion doit toujours aboutir.
export async function oublierCetAppareil() {
  const token = lireJetonLocal();
  if (!token) return;
  try {
    await oublierAppareil(token);
  } catch {
    // Serveur injoignable : le jeton Firebase est invalidé ci-dessous quand même.
  }
  try {
    await supprimerJetonPush();
  } catch {
    // Jeton déjà invalide.
  }
  ecrireJetonLocal(null);
}
