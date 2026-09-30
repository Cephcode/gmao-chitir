// Remplaçant du client Supabase serveur pour les tests des règles pures : jamais appelé.
export async function createClient() {
  throw new Error("Pas d'accès base dans les tests de règles pures");
}
