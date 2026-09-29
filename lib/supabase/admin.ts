// Client Supabase avec la clé secrète (service role). Contourne les RLS.
// À N'UTILISER QUE côté serveur, pour l'administration (créer un compte, tâches cron).
// Ne jamais importer ce fichier dans un composant client.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
