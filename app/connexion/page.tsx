"use client";

// Connexion en une seule étape (e-mail + mot de passe), sans choix de rôle.
import { useActionState, useState } from "react";
import Image from "next/image";
import { seConnecter, type ConnexionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/icons";

export default function ConnexionPage() {
  const [state, formAction, pending] = useActionState<ConnexionState, FormData>(
    seConnecter,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-full flex flex-col">
      <div className="h-1 bg-brand-red" />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src="/logo-chitir.png"
              alt="Chitir Chicken"
              width={72}
              height={72}
              className="rounded-2xl"
              priority
            />
            <div>
              <h1 className="font-display text-2xl font-semibold m-0">Connectez-vous</h1>
              <p className="text-text-muted text-sm mt-1">
                Suivi de la maintenance des restaurants
              </p>
            </div>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            {state?.error && <Alert variant="danger">{state.error}</Alert>}

            <Field label="E-mail" htmlFor="identifiant">
              <TextInput
                id="identifiant"
                name="identifiant"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </Field>

            <Field label="Mot de passe" htmlFor="motDePasse">
              <TextInput
                id="motDePasse"
                name="motDePasse"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
              />
            </Field>

            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="self-start inline-flex items-center gap-2 min-h-11 pr-2 -mt-4 -mb-3 text-orange-text text-sm font-semibold"
            >
              <Icon name="eye" size={16} />
              {showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            </button>

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
