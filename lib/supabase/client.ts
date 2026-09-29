// Client Supabase pour le navigateur (composants clients).
// Utilise la clé publiable (sans danger côté navigateur), les RLS protègent les données.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
