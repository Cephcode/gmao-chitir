// Fiche équipement (M-04b / M-04c / panneau O-04).
// Même contenu sur les deux formats : page entière sur mobile (sections empilées),
// panneau à droite de la liste sur ordinateur (onglets Infos / Historique via ?onglet=).
// Le rôle ne décide que des actions : le lecteur voit tout mais n'agit pas.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/session";
import { categoryIcon } from "@/lib/equipment-icon";
import { aujourdhui, dateCourte, depuis } from "@/lib/format";
import {
  type EquipmentRow,
  FREQUENCY_LABELS,
  canEditEquipments,
  STATE_BADGE,
  maintenanceOf,
} from "@/lib/equipements";
import { Icon, type IconName } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { MaintenanceDoneButton } from "@/components/app/equipements/maintenance-done-button";

type OpenIntervention = {
  id: string;
  type: "normal" | "urgence" | "alerte";
  description: string | null;
  symptoms: string[];
  reported_at: string;
  assignee: { first_name: string | null } | null;
};

type EventType = "panne_declaree" | "entretien" | "reparation" | "modification";
type LifeEvent = {
  id: string;
  type: EventType;
  summary: string;
  created_at: string;
  users: { first_name: string | null } | null;
};

const EVENT_STYLE: Record<EventType, { label: string; icon: IconName; tone: string }> = {
  panne_declaree: { label: "Panne déclarée", icon: "bolt", tone: "bg-danger-bg text-danger" },
  entretien: { label: "Entretien", icon: "check", tone: "bg-success-bg text-success" },
  reparation: { label: "Réparation", icon: "wrench", tone: "bg-info-bg text-info" },
  modification: { label: "Modification", icon: "edit", tone: "bg-neutral-bg text-neutral" },
};

const INTERVENTION_TITLE: Record<OpenIntervention["type"], string> = {
  urgence: "Urgence en cours",
  normal: "Panne en cours",
  alerte: "Alerte en cours",
};

const HISTORY_PREVIEW = 4; // événements visibles sur mobile avant « Voir les N événements »
const TZ = "Africa/Ouagadougou";

// « Auj. 08:40 » pour aujourd'hui, sinon « 22 août ».
function eventDate(iso: string) {
  if (iso.slice(0, 10) !== aujourdhui()) return dateCourte(iso);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
  return `Auj. ${heure}`;
}

// « 22 août 2026 »
function dateLongue(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(date + "T00:00:00Z"),
  );
}

// « Mars 2024 »
function moisAnnee(date: string) {
  const s = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(date + "T00:00:00Z"),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Valeur absente : « Ajouter » (lien vers le formulaire) si on peut modifier, sinon « Non renseigné ».
function InfoRow({
  label,
  value,
  addHref,
}: {
  label: string;
  value: string | null;
  addHref?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <span className="text-text-muted text-[15px]">{label}</span>
      {value ? (
        <span className="text-right text-[15px] font-semibold">{value}</span>
      ) : addHref ? (
        <Link href={addHref} className="text-orange-text font-bold text-[15px] underline underline-offset-2">
          Ajouter
        </Link>
      ) : (
        <span className="text-right text-[15px] text-text-muted">Non renseigné</span>
      )}
    </div>
  );
}

export async function EquipmentSheet({
  equipment: e,
  role,
  tab,
  showAllHistory,
  query,
}: {
  equipment: EquipmentRow;
  role: Role;
  tab: "infos" | "historique";
  showAllHistory: boolean;
  query: string; // filtres de la liste (« ?restaurant=CTR1 » ou « »), gardés dans les liens
}) {
  const supabase = await createClient();
  const [interventionRes, eventsRes] = await Promise.all([
    supabase
      .from("interventions")
      .select(
        "id, type, description, symptoms, reported_at, assignee:users!interventions_assigned_to_fkey(first_name)",
      )
      .eq("equipment_id", e.id)
      .eq("status", "en_cours")
      .order("reported_at", { ascending: false }),
    supabase
      .from("equipment_events")
      .select("id, type, summary, created_at, users(first_name)")
      .eq("equipment_id", e.id)
      .order("created_at", { ascending: false }),
  ]);

  // Une urgence passe avant une panne normale.
  const open = ((interventionRes.data ?? []) as unknown as OpenIntervention[]).sort(
    (a, b) => Number(b.type === "urgence") - Number(a.type === "urgence"),
  )[0];
  const events = (eventsRes.data ?? []) as unknown as LifeEvent[];
  const lastRepair = events.find((ev) => ev.type === "reparation");

  const m = maintenanceOf(e.plan);
  const canNoteMaintenance = role !== "lecteur";
  const canEdit = canEditEquipments(role);
  const subtitle = [e.code, e.restaurant.short_code, e.category?.name].filter(Boolean).join(" · ");
  const brandModel = [e.brand?.name, e.model].filter(Boolean).join(" ") || null;

  const closeHref = `/equipements${query}`;
  const sheetLink = (extra: Record<string, string>) => {
    const params = new URLSearchParams(query.slice(1));
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return `/equipements/${e.id}?${params}`;
  };
  const editHref = canEdit ? `/equipements/${e.id}/modifier${query}` : undefined;
  // Sur ordinateur, seul l'onglet actif est visible ; sur mobile, tout est empilé.
  const onlyOnTab = (t: "infos" | "historique") => (tab === t ? "" : "lg:hidden");

  return (
    <article className="flex flex-col gap-5 px-4 pt-3 pb-6 lg:px-6 lg:pt-5">
      {/* Barre du haut : retour (mobile), titre du panneau et fermeture (ordinateur) */}
      <div className="flex items-center gap-2">
        <Link
          href={closeHref}
          className="lg:hidden -ml-2 inline-flex items-center gap-1 h-touch px-2 font-semibold text-text"
        >
          <Icon name="chevronRight" className="rotate-180" /> Équipements
        </Link>
        <span className="lg:hidden flex-1" />
        <span className="hidden lg:block flex-1 text-text-muted text-[13px] font-semibold">
          Fiche équipement
        </span>
        {editHref && (
          <Link
            href={editHref}
            aria-label="Modifier l'équipement"
            className="inline-flex items-center gap-2 h-touch px-2.5 lg:px-3.5 rounded font-semibold text-text lg:shadow-[inset_0_0_0_1.5px_var(--color-ring)] hover:bg-surface-2"
          >
            <Icon name="edit" size={18} />
            <span className="hidden lg:inline">Modifier</span>
          </Link>
        )}
        <Link
          href={closeHref}
          aria-label="Fermer la fiche"
          className="hidden lg:flex size-touch items-center justify-center rounded text-text hover:bg-surface-2"
        >
          <Icon name="x" />
        </Link>
      </div>

      {role === "lecteur" && (
        <Alert variant="info" icon="eye">
          Vous êtes en lecture seule.
        </Alert>
      )}

      <header className="flex items-start gap-3">
        <div className="size-14 rounded bg-surface-2 flex items-center justify-center text-[#4E2F21] shrink-0 lg:hidden">
          <Icon name={categoryIcon(e.category?.code)} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h2 className="font-display text-[22px] font-semibold m-0 leading-tight">{e.name}</h2>
          <div className="text-text-muted text-[14px]">{subtitle}</div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={STATE_BADGE[e.state]} />
            {m.status === "en_retard" && (
              <StatusBadge status="enRetard" label="Entretien en retard" />
            )}
          </div>
        </div>
      </header>

      {/* Onglets (ordinateur) */}
      <nav aria-label="Sections de la fiche" className="hidden lg:flex gap-6 border-b border-border">
        {(["infos", "historique"] as const).map((t) => (
          <Link
            key={t}
            href={sheetLink({ onglet: t })}
            aria-current={tab === t ? "page" : undefined}
            className={`py-2.5 -mb-px text-[14px] font-semibold border-b-2 ${
              tab === t ? "border-orange text-text" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t === "infos" ? "Infos" : `Historique (${events.length})`}
          </Link>
        ))}
      </nav>

      <div className={`flex flex-col gap-5 ${onlyOnTab("infos")}`}>
        {/* Intervention en cours */}
        {open && (
          <Link
            href={`/interventions/${open.id}`}
            className={`flex items-center gap-3 p-4 rounded text-text ${
              open.type === "alerte"
                ? "bg-neutral-bg shadow-[inset_0_0_0_1px_var(--color-ring)]"
                : "bg-danger-bg shadow-[inset_0_0_0_1px_#F4B8B0]"
            }`}
          >
            <Icon
              name={open.type === "alerte" ? "alert" : "bolt"}
              className={open.type === "alerte" ? "text-neutral" : "text-danger"}
            />
            <div className="flex-1 min-w-0 text-[14px]">
              <div>
                <strong>{INTERVENTION_TITLE[open.type]}</strong> depuis {depuis(open.reported_at)}
                {open.assignee?.first_name && ` · ${open.assignee.first_name} s'en occupe`}
              </div>
              {(open.description || open.symptoms.length > 0) && (
                <div className="text-text-muted truncate">
                  « {open.description || open.symptoms.join(", ")} »
                </div>
              )}
            </div>
            <Icon name="chevronRight" />
          </Link>
        )}

        {/* Entretien */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-[18px] font-semibold m-0">Entretien</h3>
            {m.status === "en_retard" && <StatusBadge status="enRetard" />}
            {m.status === "a_jour" && <StatusBadge status="aJour" />}
          </div>
          {e.plan ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded bg-background p-3.5">
                  <div className="text-text-muted text-[13px]">Dernier</div>
                  <div className="font-bold text-[16px]">
                    {e.plan.last_done_at ? dateLongue(e.plan.last_done_at) : "Jamais noté"}
                  </div>
                </div>
                <div
                  className={`rounded p-3.5 ${m.status === "en_retard" ? "bg-warning-bg text-warning" : "bg-background"}`}
                >
                  <div className={`text-[13px] ${m.status === "en_retard" ? "" : "text-text-muted"}`}>
                    Prochain
                  </div>
                  <div className="font-bold text-[16px] text-text">
                    {m.status === "a_definir" ? "À définir" : dateLongue(m.next)}
                  </div>
                  {m.status === "en_retard" && (
                    <div className="text-[13px] font-semibold">
                      {m.days} jour{m.days > 1 ? "s" : ""} de retard
                    </div>
                  )}
                </div>
              </div>
              <div className="text-text-muted text-[14px]">
                {[FREQUENCY_LABELS[e.plan.frequency], e.plan.task].filter(Boolean).join(" · ")}
              </div>
              {canNoteMaintenance && <MaintenanceDoneButton equipmentId={e.id} />}
            </>
          ) : (
            <>
              <p className="text-text-muted text-[14px] m-0">
                Aucun plan d&apos;entretien : fréquence à définir.{" "}
                {editHref && (
                  <Link href={editHref} className="text-orange-text font-bold underline underline-offset-2">
                    Définir
                  </Link>
                )}
              </p>
              {/* Sans plan, l'entretien est quand même inscrit dans la fiche de vie */}
              {canNoteMaintenance && <MaintenanceDoneButton equipmentId={e.id} />}
            </>
          )}
        </Card>

        {/* Informations */}
        <Card padded={false} className="px-5 divide-y divide-surface-2">
          <InfoRow label="Marque / modèle" value={brandModel} addHref={editHref} />
          <InfoRow label="N° de série" value={e.serial_number} addHref={editHref} />
          <InfoRow
            label="Installé le"
            value={e.installed_at ? moisAnnee(e.installed_at) : null}
            addHref={editHref}
          />
          <InfoRow
            label="Dernière réparation"
            value={lastRepair ? `${dateCourte(lastRepair.created_at)} · ${lastRepair.summary}` : null}
          />
        </Card>

        {/* Tous les rôles peuvent déclarer une panne, lecteur compris */}
        <Link
          href={`/panne?equipement=${e.id}`}
          className={`${buttonClass({ variant: "secondary" })} w-full`}
        >
          <Icon name="alert" /> Déclarer une panne sur cette machine
        </Link>
      </div>

      {/* Historique (fiche de vie) */}
      <section className={`flex flex-col gap-3 ${onlyOnTab("historique")}`}>
        <h3 className="font-display text-[18px] font-semibold m-0 lg:sr-only">
          Historique (fiche de vie)
        </h3>
        {events.length === 0 ? (
          <p className="text-text-muted text-[14px] m-0">Aucun événement pour le moment.</p>
        ) : (
          <ol className="list-none m-0 p-0 flex flex-col">
            {events.map((ev, i) => {
              const s = EVENT_STYLE[ev.type];
              const hiddenOnMobile = !showAllHistory && i >= HISTORY_PREVIEW ? "max-lg:hidden" : "";
              return (
                <li key={ev.id} className={`relative flex gap-3 pb-5 ${hiddenOnMobile}`}>
                  {/* Trait vertical de la frise, sauf après le dernier événement */}
                  {i < events.length - 1 && (
                    <span className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border" aria-hidden />
                  )}
                  <span
                    className={`relative size-8 rounded-full flex items-center justify-center shrink-0 ${s.tone}`}
                  >
                    <Icon name={s.icon} size={16} />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold text-[15px]">{s.label}</span>
                      <span className="text-text-muted text-[13px] shrink-0">
                        {eventDate(ev.created_at)}
                      </span>
                    </div>
                    <div className="text-[14px]">{ev.summary}</div>
                    {ev.users?.first_name && (
                      <div className="text-text-muted text-[13px]">{ev.users.first_name}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {!showAllHistory && events.length > HISTORY_PREVIEW && (
          <Link
            href={sheetLink({ historique: "tout" })}
            className="lg:hidden text-orange-text font-bold text-[14px] py-3"
          >
            Voir les {events.length} événements
          </Link>
        )}
      </section>
    </article>
  );
}
