"use client";

// Créer un compte / Modifier un compte (M-09b / panneau O-10).
// Plein écran sur mobile, panneau latéral sur ordinateur.
// Après création ou réinitialisation, le mot de passe temporaire est affiché une seule fois,
// à transmettre à la personne ; elle devra le changer à sa première connexion.
// Les choix proposés (rôles, restaurants) sont déjà limités par le serveur selon l'acteur,
// et l'action serveur revérifie tout.
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  creerCompte,
  modifierCompte,
  reinitialiserMotDePasse,
  supprimerCompte,
  type AccountResult,
} from "@/app/(app)/admin/actions";
import type { Role } from "@/lib/session";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

type RoleOption = { value: Role; label: string; help: string };

// Copie dans le presse-papiers. navigator.clipboard n'existe qu'en https : sinon (adresse
// du réseau local en développement, vieux navigateur), repli sur l'ancienne commande copy.
// Renvoie false si rien n'a marché : l'utilisateur copie alors à la main (texte sélectionnable).
async function copier(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {}
  try {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    return ok;
  } catch {
    return false;
  }
}

function TempPassword({ identifiant, password }: { identifiant: string; password: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-success-bg shadow-[inset_0_0_0_1px_#A8DCC0]">
      <div className="flex items-center gap-2 font-bold text-success">
        <Icon name="check" /> Mot de passe temporaire
      </div>
      <p className="m-0 text-[14px]">
        À transmettre à la personne ({identifiant}). Il ne sera plus affiché ensuite ; elle le changera à sa première
        connexion.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3.5 py-3 rounded bg-surface font-mono text-[18px] tracking-wider select-all">{password}</code>
        <Button
          variant="secondary"
          onClick={async () => {
            setCopied(await copier(password));
          }}
        >
          {copied === true ? "Copié" : copied === false ? "Copiez à la main" : "Copier"}
        </Button>
      </div>
    </div>
  );
}

export function UserForm({
  initial,
  roles,
  restaurants,
  canGrantAll,
  isSelf,
  canDelete,
  cancelHref,
}: {
  initial: {
    id: string | null; // null = création
    identifiant: string;
    firstName: string;
    role: Role;
    allRestaurants: boolean;
    restaurantIds: string[];
  };
  roles: RoleOption[];
  restaurants: { id: string; short_code: string }[];
  canGrantAll: boolean;
  isSelf: boolean;
  canDelete: boolean;
  cancelHref: string;
}) {
  const creating = initial.id === null;
  const [v, setV] = useState(initial);
  const [result, setResult] = useState<AccountResult>(null);
  const [resetResult, setResetResult] = useState<AccountResult>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((cur) => ({ ...cur, [k]: val }));
  // Un propriétaire a toujours accès à tous les restaurants (règle vérifiée aussi côté serveur et en base).
  const choisirRole = (role: Role) => setV((cur) => ({ ...cur, role, allRestaurants: role === "proprietaire" ? true : cur.allRestaurants }));
  const toggleRestaurant = (id: string) =>
    set("restaurantIds", v.restaurantIds.includes(id) ? v.restaurantIds.filter((r) => r !== id) : [...v.restaurantIds, id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = { firstName: v.firstName, role: v.role, allRestaurants: v.allRestaurants, restaurantIds: v.restaurantIds };
      setResult(creating ? await creerCompte({ ...payload, identifiant: v.identifiant }) : await modifierCompte({ ...payload, id: v.id! }));
    });
  };

  const fieldError = (f: string) => (result && !result.ok && result.field === f ? result.error : undefined);
  const created = creating && result?.ok && result.tempPassword;

  return (
    <>
      <Link href={cancelHref} aria-label="Fermer" className="hidden lg:block fixed inset-0 z-40 bg-[rgba(34,23,15,.35)]" />
      <form
        onSubmit={submit}
        noValidate
        className="fixed inset-0 z-50 flex flex-col bg-background lg:left-auto lg:w-[500px] lg:bg-surface lg:shadow-[-12px_0_32px_rgba(43,26,16,.18)]"
      >
        <header className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-surface">
          <Link href={cancelHref} aria-label="Fermer" className="size-touch -ml-2 lg:ml-0 lg:order-last flex items-center justify-center rounded text-text hover:bg-surface-2">
            <Icon name="x" />
          </Link>
          <div className="flex-1 min-w-0">
            {!creating && <div className="text-text-muted text-[13px] truncate">{initial.identifiant}</div>}
            <h1 className="font-display text-[18px] lg:text-[20px] font-semibold m-0">
              {creating ? "Créer un compte" : isSelf ? "Mon compte" : "Modifier le compte"}
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-5">
          {created ? (
            <>
              <TempPassword identifiant={result.identifiant ?? ""} password={result.tempPassword!} />
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setV(initial);
                    setResult(null);
                  }}
                >
                  Créer un autre compte
                </Button>
                <Link href="/admin/utilisateurs" className="text-center py-3 text-orange-text font-bold">
                  Retour à la liste
                </Link>
              </div>
            </>
          ) : (
            <>
              {result && !result.ok && !result.field && <Alert variant="danger">{result.error}</Alert>}
              {result?.ok && result.message && <Alert variant="success">{result.message}</Alert>}

              {creating ? (
                <Field
                  label="E-mail"
                  htmlFor="acc-id"
                  error={fieldError("identifiant")}
                  hint="Sert à se connecter. Un mot de passe temporaire sera généré."
                >
                  <TextInput
                    id="acc-id"
                    value={v.identifiant}
                    onChange={(e) => set("identifiant", e.target.value)}
                    type="email"
                    inputMode="email"
                    placeholder="nom@exemple.com"
                    autoComplete="off"
                    invalid={Boolean(fieldError("identifiant"))}
                    autoFocus
                  />
                </Field>
              ) : null}

              <Field label="Prénom" htmlFor="acc-first" optional>
                <TextInput id="acc-first" value={v.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </Field>

              <fieldset className="border-0 m-0 p-0 flex flex-col gap-2">
                <legend className="text-[14px] font-semibold mb-1.5">Rôle</legend>
                {isSelf && <p className="m-0 text-text-muted text-[13px]">Vous ne pouvez pas changer votre propre rôle.</p>}
                <div role="radiogroup" aria-label="Rôle" className="flex flex-col gap-2">
                  {roles.map((r) => {
                    const on = v.role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={isSelf}
                        onClick={() => choisirRole(r.value)}
                        className={`flex items-start gap-3 p-3.5 rounded text-left border-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                          on ? "bg-orange-soft shadow-[inset_0_0_0_2px_var(--color-orange)]" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-border)] hover:bg-background"
                        }`}
                      >
                        <span className={`mt-0.5 size-5 rounded-full shrink-0 ${on ? "bg-filter-active shadow-[inset_0_0_0_4px_var(--color-orange-soft)]" : "shadow-[inset_0_0_0_2px_var(--color-border-strong)]"}`} />
                        <span>
                          <span className="block font-bold text-[15px]">{r.label}</span>
                          <span className="block text-text-muted text-[13.5px]">{r.help}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {fieldError("role") && <p className="m-0 text-danger text-[13px] font-semibold">{fieldError("role")}</p>}
              </fieldset>

              <fieldset className="border-0 m-0 p-0 flex flex-col gap-2">
                <legend className="text-[14px] font-semibold mb-1.5">Restaurants accessibles</legend>
                {!v.allRestaurants && (
                  <div className="flex flex-wrap gap-2">
                    {restaurants.map((r) => {
                      const on = v.restaurantIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          aria-pressed={on}
                          disabled={isSelf}
                          onClick={() => toggleRestaurant(r.id)}
                          className={`inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-[15px] font-semibold border-0 cursor-pointer disabled:cursor-not-allowed ${
                            on ? "bg-filter-active text-background" : "bg-surface text-text shadow-[inset_0_0_0_1.5px_var(--color-ring)]"
                          }`}
                        >
                          {on && <Icon name="check" size={16} />}
                          {r.short_code}
                        </button>
                      );
                    })}
                  </div>
                )}
                {canGrantAll && (
                  <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={v.allRestaurants}
                      disabled={isSelf || v.role === "proprietaire"}
                      onChange={(e) => set("allRestaurants", e.target.checked)}
                      className="size-5 accent-[var(--color-filter-active)]"
                    />
                    <span className="text-[15px]">Tous, y compris les futurs restaurants</span>
                  </label>
                )}
                {v.role === "proprietaire" && (
                  <p className="m-0 text-text-muted text-[13px]">Un propriétaire a toujours accès à tous les restaurants.</p>
                )}
                {fieldError("restaurants") && <p className="m-0 text-danger text-[13px] font-semibold">{fieldError("restaurants")}</p>}
              </fieldset>

              {!creating && !isSelf && (
                <section className="flex flex-col gap-3 pt-4 border-t border-border">
                  <h2 className="font-display text-[16px] font-semibold m-0">Mot de passe</h2>
                  {resetResult?.ok && resetResult.tempPassword ? (
                    <TempPassword identifiant={resetResult.identifiant ?? ""} password={resetResult.tempPassword} />
                  ) : (
                    <>
                      <p className="m-0 text-text-muted text-[14px]">
                        Mot de passe oublié ? Générez-en un nouveau, temporaire, à transmettre à la personne.
                      </p>
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => startTransition(async () => setResetResult(await reinitialiserMotDePasse(v.id!)))}
                      >
                        Générer un mot de passe temporaire
                      </Button>
                      {resetResult && !resetResult.ok && <Alert variant="danger">{resetResult.error}</Alert>}
                    </>
                  )}
                </section>
              )}

              {confirmDelete && (
                <Alert
                  variant="danger"
                  title="Supprimer ce compte ?"
                  action={
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={pending}
                        onClick={() => startTransition(async () => setResult(await supprimerCompte(v.id!)))}
                      >
                        Oui, supprimer
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                        Annuler
                      </Button>
                    </div>
                  }
                >
                  La personne ne pourra plus se connecter. Son nom disparaît de l&apos;historique des interventions.
                </Alert>
              )}
            </>
          )}
        </div>

        {!created && (
          <footer className="flex items-center gap-3 px-4 lg:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-surface">
            {canDelete && !creating && !isSelf && (
              <Button variant="ghost" icon="trash" className="!text-danger hover:!bg-danger-bg" onClick={() => setConfirmDelete(true)} disabled={pending}>
                Supprimer
              </Button>
            )}
            <div className="flex-1" />
            <Button type="submit" disabled={pending} className="max-lg:flex-1">
              {pending ? "Enregistrement…" : creating ? "Créer le compte" : "Enregistrer"}
            </Button>
          </footer>
        )}
      </form>
    </>
  );
}
