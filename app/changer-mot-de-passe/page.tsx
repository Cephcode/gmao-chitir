"use client";

// Écran de changement de mot de passe obligatoire à la première connexion.
import { useActionState } from "react";
import { changerMotDePasse, type ChangeState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export default function ChangerMotDePassePage() {
  const [state, formAction, pending] = useActionState<ChangeState, FormData>(
    changerMotDePasse,
    null,
  );

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold m-0">
            Choisissez un mot de passe
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Pour votre première connexion, remplacez le mot de passe temporaire.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && <Alert variant="danger">{state.error}</Alert>}

          <Field
            label="Nouveau mot de passe"
            htmlFor="nouveau"
            hint="Au moins 8 caractères."
          >
            <TextInput
              id="nouveau"
              name="nouveau"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field label="Confirmez le mot de passe" htmlFor="confirmation">
            <TextInput
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </div>
    </div>
  );
}
