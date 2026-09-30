// Fiche d'une intervention (M-06b / panneau O-07).
// Ouverte : résumé de la panne, statut puis formulaire de clôture (sauf lecteur).
// Terminée : ce qui a été fait, pièces utilisées, état après, qui a clôturé.
// Photos « avant » (ajout par tous tant qu'elle est ouverte) et « après » (ajout par
// propriétaire, éditeur, commentateur une fois terminée, ou dans le formulaire de clôture).
import Link from "next/link";
import type { Role } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/session";
import { aujourdhui, dateCourte } from "@/lib/format";
import { STATE_BADGE } from "@/lib/equipements";
import {
  type InterventionRow,
  TYPE_BADGE,
  listPartsFor,
  listTechnicians,
  listUsedParts,
  machineName,
} from "@/lib/interventions";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClosingForm } from "@/components/app/interventions/closing-form";
import { SheetTitle } from "@/components/app/sheet-title";
import { StatusSelector } from "@/components/app/interventions/status-selector";
import { STATUS_BADGE, canSetStatus, isOpen } from "@/lib/intervention-status";
import { InterventionPhotos } from "@/components/app/interventions/intervention-photos";
import { listPhotos } from "@/lib/photos-server";
import { failedPhotosMessage } from "@/lib/photos";

const TZ = "Africa/Ouagadougou";

// « à 08:40 » aujourd'hui, sinon « le 28 sept. à 08:40 ».
function quand(iso: string) {
  const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(iso),
  );
  return iso.slice(0, 10) === aujourdhui() ? `à ${heure}` : `le ${dateCourte(iso)} à ${heure}`;
}

export async function InterventionSheet({
  intervention: i,
  role,
  userId,
  closeHref,
  photosFailed = 0,
}: {
  intervention: InterventionRow;
  role: Role;
  userId: string;
  closeHref: string;
  photosFailed?: number; // photos « après » non envoyées à la clôture (?photos_echec=N)
}) {
  const open = isOpen(i.status);
  const canAct = open && canSetStatus(role);
  const [technicians, parts, usedParts, photos] = await Promise.all([
    canAct ? listTechnicians(i.restaurant.id) : Promise.resolve([]),
    canAct ? listPartsFor(i.equipment_id) : Promise.resolve([]),
    open ? Promise.resolve([]) : listUsedParts(i.id),
    listPhotos(i.id),
  ]);
  const photosAvant = photos.filter((p) => p.kind === "avant");
  const photosApres = photos.filter((p) => p.kind === "apres");
  const photoProps = {
    interventionId: i.id,
    restaurantId: i.restaurant.id,
    userId,
    canDeleteAny: role === "proprietaire" || role === "editeur",
  };
  // Avant : tout rôle (même le lecteur, qui peut déclarer une panne), tant qu'elle est ouverte.
  const showAvant = open || photosAvant.length > 0;
  // Après : une fois terminée, pour propriétaire, éditeur, commentateur.
  const canAddApres = !open && canSetStatus(role);
  const showApres = !open && (canAddApres || photosApres.length > 0);

  const meta = [
    i.restaurant.short_code,
    `déclarée${i.reporter?.first_name ? ` par ${i.reporter.first_name}` : ""} ${quand(i.reported_at)}`,
    i.assignee?.first_name ?? (open ? "pas encore attribuée" : null),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex flex-col gap-5 px-4 pt-3 pb-6 lg:px-6 lg:pt-5">
      <div className="flex items-center gap-2">
        <Link
          href={closeHref}
          className="lg:hidden -ml-2 inline-flex items-center gap-1 h-touch px-2 font-semibold text-text"
        >
          <Icon name="chevronRight" className="rotate-180" /> Interventions
        </Link>
        <span className="hidden lg:block flex-1 text-text-muted text-[13px] font-semibold">Intervention</span>
        <Link
          href={closeHref}
          aria-label="Fermer l'intervention"
          className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2"
        >
          <Icon name="x" />
        </Link>
      </div>

      <Card className="flex flex-col gap-3 p-5 lg:p-0 lg:shadow-none">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={TYPE_BADGE[i.type]} />
          <StatusBadge status={STATUS_BADGE[i.status]} />
        </div>
        <SheetTitle>
          {i.equipment ? (
            <Link href={`/equipements/${i.equipment.id}`} className="text-text hover:underline">
              {machineName(i)}
            </Link>
          ) : (
            machineName(i)
          )}
        </SheetTitle>
        <div className="text-text-muted text-[14px]">{meta}</div>
        {i.description && (
          <p className="m-0 rounded bg-background px-3.5 py-3 text-[15px]">« {i.description} »</p>
        )}
        {i.symptoms.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {i.symptoms.map((s) => (
              <span key={s} className="h-7 px-3 rounded-full bg-surface-2 text-[13px] font-semibold flex items-center">
                {s}
              </span>
            ))}
          </div>
        )}
      </Card>

      {showAvant && (
        <InterventionPhotos {...photoProps} kind="avant" title="Photos avant" photos={photosAvant} canAdd={open} />
      )}

      {open && role === "lecteur" && (
        <Alert variant="info" icon="eye">
          Vous êtes en lecture seule : la clôture est faite par le technicien ou un éditeur.
        </Alert>
      )}

      {canAct && i.status !== "terminee" && <StatusSelector key={i.id} interventionId={i.id} status={i.status} />}

      {canAct && (
        <div className="lg:border-t lg:border-border lg:pt-5">
          <ClosingForm
            interventionId={i.id}
            restaurantId={i.restaurant.id}
            hasEquipment={Boolean(i.equipment_id)}
            initialWorkDone={i.work_done ?? ""}
            initialAssignee={i.assignee?.id ?? null}
            technicians={technicians.map((t) => ({
              id: t.id,
              label: `${t.first_name ?? "Sans prénom"} · ${ROLE_LABELS[t.role]}`,
            }))}
            parts={parts}
          />
        </div>
      )}

      {!open && (
        <Card padded={false} className="px-5 divide-y divide-surface-2">
          <div className="py-3">
            <div className="text-text-muted text-[13px]">Ce qui a été fait</div>
            <div className="text-[15px]">{i.work_done || "Non renseigné"}</div>
          </div>
          <div className="py-3">
            <div className="text-text-muted text-[13px]">Pièces utilisées</div>
            {usedParts.length === 0 ? (
              <div className="text-[15px]">Aucune</div>
            ) : (
              <ul className="list-none m-0 p-0">
                {usedParts.map((u, n) => (
                  <li key={n} className="text-[15px]">
                    {u.parts?.name ?? "Pièce"} × {u.quantity}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {i.state_after && (
            <div className="flex items-center justify-between py-3">
              <span className="text-text-muted text-[15px]">État après</span>
              <StatusBadge status={STATE_BADGE[i.state_after]} />
            </div>
          )}
          {i.closed_at && (
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-text-muted text-[15px]">Clôturée</span>
              <span className="text-[15px] font-semibold text-right">
                {quand(i.closed_at)}
                {i.closer?.first_name ? ` par ${i.closer.first_name}` : ""}
              </span>
            </div>
          )}
        </Card>
      )}

      {!open && photosFailed > 0 && canAddApres && (
        <Alert variant="warning" icon="camera">
          {failedPhotosMessage(photosFailed, "cloture")}
        </Alert>
      )}

      {showApres && (
        <InterventionPhotos {...photoProps} kind="apres" title="Photos après" photos={photosApres} canAdd={canAddApres} />
      )}
    </article>
  );
}
