// Réinitialisation de mot de passe (à implémenter : envoi d'un lien par e-mail via Supabase).
// Pour l'instant, on invite à contacter le propriétaire.
import Link from "next/link";

export default function MotDePasseOubliePage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-4 text-center">
        <h1 className="font-display text-2xl font-semibold m-0">Mot de passe oublié</h1>
        <p className="text-text-muted text-sm">
          La réinitialisation par e-mail sera bientôt disponible. En attendant,
          demandez au propriétaire de vous renvoyer un mot de passe temporaire.
        </p>
        <Link href="/connexion" className="text-orange-text font-semibold text-sm">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
