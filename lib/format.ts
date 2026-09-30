// Formats d'affichage en français (durées relatives, dates courtes).

// Ancienneté courte : « à l'instant », « 25 min », « 3 h », « hier », « 4 j ».
export function depuis(dateIso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(dateIso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return "hier";
  return `${jours} j`;
}

// Date courte : « 16 sept. ».
export function dateCourte(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    new Date(date),
  );
}

// Date du jour au format AAAA-MM-JJ (UTC, le Burkina Faso est en UTC+0).
export function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

// Ajoute n jours à une date AAAA-MM-JJ.
export function plusJours(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
