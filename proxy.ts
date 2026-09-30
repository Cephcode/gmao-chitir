// Proxy (ex-middleware, renommé en Next 16). Rafraîchit la session Supabase et
// protège les routes à chaque requête. Runtime Node par défaut.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Ignore les fichiers statiques, images et assets pour ne pas bloquer leur chargement,
  // et le service worker des push (doit rester accessible même session expirée).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|firebase-messaging-sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
