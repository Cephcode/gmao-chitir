// Page ouverte depuis une notification : l'adresse porte ?notif=<id>, et la page liée affiche
// un bandeau pour supprimer cette notification (NotificationBanner). Module sans dépendance
// serveur : importé à la fois par les actions et par le bandeau (composant client).

export const NOTIF_PARAM = "notif";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lien interne + ?notif=<id>, en gardant les paramètres et l'ancre déjà présents.
export function lienAvecNotification(link: string, id: string) {
  const url = new URL(link, "http://interne");
  url.searchParams.set(NOTIF_PARAM, id);
  return url.pathname + url.search + url.hash;
}
