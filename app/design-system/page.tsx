"use client";

// Page de demonstration du systeme de design (etape 2: composants).
// Sert de reference visuelle et de verification. Non liee au menu de l'application.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusKey } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Alert, Toast } from "@/components/ui/alert";
import { Icon } from "@/components/icons";

const frequences = [
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "semestriel", label: "Semestriel" },
  { value: "annuel", label: "Annuel" },
] as const;

// Statuts regroupes par famille, pour la galerie de badges.
const badgeGroups: { name: string; keys: StatusKey[] }[] = [
  { name: "Équipement", keys: ["operationnel", "enPanne", "enMaintenance", "horsService"] },
  { name: "Entretien", keys: ["aJour", "enRetard"] },
  { name: "Intervention", keys: ["aPlanifier", "enCours", "enAttentePiece", "termine", "urgence", "normal"] },
  { name: "Stock", keys: ["suffisant", "sousLeSeuil"] },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[22px] font-semibold m-0">{children}</h2>;
}

export default function DesignSystemPage() {
  const [freq, setFreq] = useState<(typeof frequences)[number]["value"]>("trimestriel");

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col gap-10">
      <div>
        <div className="text-[12px] font-bold tracking-wider uppercase text-text-muted">
          GMAO Chitir Chicken · Système de design
        </div>
        <h1 className="font-display text-[40px] font-semibold m-0">Composants</h1>
      </div>

      {/* Boutons */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Boutons</SectionTitle>
        <Card className="flex flex-col gap-4">
          <div className="flex gap-3 items-center flex-wrap">
            <Button>Enregistrer</Button>
            <Button variant="secondary">Annuler</Button>
            <Button variant="ghost">Voir tout</Button>
            <Button variant="danger" icon="trash">Supprimer</Button>
            <Button variant="secondary" iconOnly icon="edit" aria-label="Modifier" />
            <Button variant="secondary" size="sm" icon="plus">Compact 36 px</Button>
            <Button disabled>Désactivé</Button>
          </div>
          <Button size="cta" icon="alert" className="self-start">Déclarer une panne</Button>
        </Card>
      </section>

      {/* Badges */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Badges de statut</SectionTitle>
        <Card className="flex flex-col gap-3">
          {badgeGroups.map((g) => (
            <div key={g.name} className="flex items-center gap-4 border-b border-surface-2 pb-3 last:border-0">
              <div className="w-28 font-bold text-[14px] shrink-0">{g.name}</div>
              <div className="flex gap-2 flex-wrap">
                {g.keys.map((k) => (
                  <StatusBadge key={k} status={k} />
                ))}
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Cartes */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Cartes</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="flex items-center gap-3 min-h-16">
            <div className="size-11 rounded bg-surface-2 flex items-center justify-center text-[#4E2F21]">
              <Icon name="fridge" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[16px]">Grande friteuse 2 portes</div>
              <div className="text-text-muted text-[13px]">CTR1 · Cuisson</div>
            </div>
            <StatusBadge status="enPanne" />
          </Card>
          <Card>
            <div className="flex flex-col gap-2 p-4 rounded bg-danger-bg">
              <div className="flex items-center gap-2 text-danger font-bold text-[14px]">
                <Icon name="bolt" /> Urgences en cours
              </div>
              <div className="font-display text-[32px] font-semibold leading-none tabular-nums">2</div>
            </div>
          </Card>
        </div>
      </section>

      {/* Formulaires */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Formulaires</SectionTitle>
        <Card className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom de l'équipement" htmlFor="f1">
              <TextInput id="f1" defaultValue="Grand frigo 1" />
            </Field>
            <Field label="Quantité" htmlFor="f3" error="La quantité ne peut pas être négative.">
              <TextInput id="f3" defaultValue="-2" invalid />
            </Field>
            <Field label="N° de série" htmlFor="f4" optional hint="Souvent sur une étiquette à l'arrière.">
              <TextInput id="f4" placeholder="Ex. FR-2291-A" />
            </Field>
            <Field label="Recherche" htmlFor="f5">
              <TextInput id="f5" leadingIcon="search" placeholder="Filtrer…" />
            </Field>
          </div>
          <div>
            <div className="text-[14px] font-semibold mb-1.5">Fréquence d'entretien</div>
            <SegmentedControl
              options={frequences}
              value={freq}
              onChange={setFreq}
              ariaLabel="Fréquence d'entretien"
            />
          </div>
        </Card>
      </section>

      {/* Messages */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Messages</SectionTitle>
        <div className="flex flex-col gap-3">
          <Toast action={<Button size="sm" variant="ghost" className="text-orange-selected">Annuler</Button>}>
            Panne envoyée. Le technicien est prévenu.
          </Toast>
          <Alert variant="danger" title="L'enregistrement n'a pas abouti">
            Pas de connexion internet. Vos informations sont gardées, réessayez dans un instant.
          </Alert>
          <Alert variant="warning" action={<a href="#" className="font-bold text-[14px]">Voir</a>}>
            <strong>5 entretiens en retard.</strong> Le plus ancien : Hotte, CTR1, il y a 12 jours.
          </Alert>
          <Alert variant="info">
            Vous êtes en <strong>lecture seule</strong>. Demandez à un propriétaire si vous devez modifier.
          </Alert>
        </div>
      </section>
    </div>
  );
}
