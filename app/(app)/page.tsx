// Tableau de bord global (M-02 / O-02).
// 4 indicateurs, « À traiter en priorité » (urgences, pannes, retards, stock bas),
// synthèse par restaurant. Sur ordinateur en plus : entretiens des 7 jours, stock bas.
// Toutes les lectures passent par les RLS : chacun ne voit que ses restaurants.
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getNavCounts, getProfile, ROLE_LABELS } from "@/lib/session";
import { aujourdhui, dateCourte, depuis, plusJours } from "@/lib/format";
import { categoryIcon } from "@/lib/equipment-icon";
import { canAccessAdmin } from "@/lib/admin";
import { Icon, type IconName } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { StatusBadge, type StatusKey } from "@/components/ui/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { ListRow } from "@/components/app/list-row";
import { RestaurantSelect } from "@/components/app/restaurant-select";

type Restaurant = { id: string; name: string; short_code: string };
type Equipment = {
  id: string;
  state: string;
  restaurant_id: string;
};
type OpenIntervention = {
  id: string;
  type: "normal" | "urgence" | "alerte";
  description: string | null;
  symptoms: string[];
  reported_at: string;
  restaurant_id: string;
  equipment_free_text: string | null;
  equipments: { name: string; categories: { code: string } | null } | null;
};
type Plan = {
  id: string;
  next_due_at: string;
  equipment_id: string;
  equipments: { name: string; restaurant_id: string; categories: { code: string } | null } | null;
};
type Part = { id: string; name: string; quantity: number; min_threshold: number };

type PriorityItem = {
  key: string;
  href: string;
  icon: IconName;
  name: string;
  sub: string;
  status: StatusKey;
};

const INTERVENTION_BADGE: Record<OpenIntervention["type"], StatusKey> = {
  urgence: "urgence",
  normal: "enPanne",
  alerte: "alerte",
};

export default async function TableauDeBord(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const selectedCode = typeof searchParams.restaurant === "string" ? searchParams.restaurant : "";

  const [profile, { unread }] = await Promise.all([getProfile(), getNavCounts()]);
  const supabase = await createClient();
  const today = aujourdhui();
  const in7days = plusJours(today, 7);

  const [restaurantsRes, equipmentsRes, interventionsRes, plansRes, partsRes] = await Promise.all([
    supabase.from("restaurants").select("id, name, short_code").order("short_code"),
    supabase.from("equipments").select("id, state, restaurant_id"),
    supabase
      .from("interventions")
      .select(
        "id, type, description, symptoms, reported_at, restaurant_id, equipment_free_text, equipments(name, categories(code))",
      )
      .eq("status", "en_cours")
      .order("reported_at", { ascending: true }),
    supabase
      .from("maintenance_plans")
      .select("id, next_due_at, equipment_id, equipments(name, restaurant_id, categories(code))")
      .not("next_due_at", "is", null)
      .lte("next_due_at", in7days)
      .order("next_due_at"),
    supabase.from("parts").select("id, name, quantity, min_threshold"),
  ]);

  const restaurants = (restaurantsRes.data ?? []) as Restaurant[];
  const selected = restaurants.find((r) => r.short_code === selectedCode);
  const codeOf = new Map(restaurants.map((r) => [r.id, r.short_code]));
  const inScope = (restaurantId: string | undefined) =>
    !selected || restaurantId === selected.id;

  // Filtre restaurant appliqué côté page (volumes faibles). Le stock est global.
  const equipments = ((equipmentsRes.data ?? []) as Equipment[]).filter((e) =>
    inScope(e.restaurant_id),
  );
  const interventions = ((interventionsRes.data ?? []) as unknown as OpenIntervention[]).filter(
    (i) => inScope(i.restaurant_id),
  );
  const plans = ((plansRes.data ?? []) as unknown as Plan[]).filter((p) =>
    inScope(p.equipments?.restaurant_id),
  );
  const overdue = plans.filter((p) => p.next_due_at < today);
  const upcoming = plans.filter((p) => p.next_due_at >= today);
  const lowParts = ((partsRes.data ?? []) as Part[]).filter((p) => p.quantity < p.min_threshold);

  const urgences = interventions.filter((i) => i.type === "urgence");
  const pannes = equipments.filter((e) => e.state === "en_panne");

  // « À traiter en priorité » : urgences, puis autres interventions ouvertes,
  // puis entretiens en retard, puis stock bas.
  const interventionItem = (i: OpenIntervention): PriorityItem => ({
    key: `i-${i.id}`,
    href: `/interventions/${i.id}`,
    icon: categoryIcon(i.equipments?.categories?.code),
    name: i.equipments?.name ?? i.equipment_free_text ?? "Machine non identifiée",
    sub: [
      codeOf.get(i.restaurant_id),
      i.description || i.symptoms.join(", ") || "Panne déclarée",
      depuis(i.reported_at),
    ]
      .filter(Boolean)
      .join(" · "),
    status: INTERVENTION_BADGE[i.type],
  });
  const priority: PriorityItem[] = [
    ...urgences.map(interventionItem),
    ...interventions.filter((i) => i.type !== "urgence").map(interventionItem),
    ...overdue.map((p) => ({
      key: `p-${p.id}`,
      href: `/equipements/${p.equipment_id}`,
      icon: categoryIcon(p.equipments?.categories?.code),
      name: p.equipments?.name ?? "Équipement",
      sub: `${codeOf.get(p.equipments?.restaurant_id ?? "") ?? ""} · Entretien prévu le ${dateCourte(p.next_due_at)}`,
      status: "enRetard" as StatusKey,
    })),
    ...lowParts.map((p) => ({
      key: `s-${p.id}`,
      href: `/stock/${p.id}`,
      icon: "box" as IconName,
      name: p.name,
      sub: `${p.quantity} restant${p.quantity > 1 ? "s" : ""} · seuil ${p.min_threshold}`,
      status: "sousLeSeuil" as StatusKey,
    })),
  ];
  const PRIORITY_MAX = 6;

  const byRestaurant = restaurants.map((r) => {
    const eq = equipments.filter((e) => e.restaurant_id === r.id);
    return {
      ...r,
      total: eq.length,
      pannes: eq.filter((e) => e.state === "en_panne").length,
      retards: overdue.filter((p) => p.equipments?.restaurant_id === r.id).length,
    };
  });

  const filterQuery = selected ? `&restaurant=${selected.short_code}` : "";

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-6">
      {/* En-tête */}
      <header className="flex items-center gap-3">
        <Image
          src="/logo-chitir.png"
          alt="Chitir Chicken"
          width={40}
          height={40}
          className="rounded-sm lg:hidden"
        />
        <div className="flex-1 min-w-0">
          <div className="text-text-muted text-[13px]">
            Bonjour {profile?.first_name ?? ""} · {profile ? ROLE_LABELS[profile.role] : ""}
          </div>
          <h1 className="font-display text-[22px] lg:text-[32px] font-semibold m-0 leading-tight">
            {selected ? `Tableau de bord · ${selected.short_code}` : "Tableau de bord"}
          </h1>
        </div>
        <Link
          href="/notifications"
          aria-label={`Notifications, ${unread} non lues`}
          className="lg:hidden relative size-touch rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-ring)] flex items-center justify-center text-text"
        >
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center shadow-[0_0_0_2px_var(--color-background)] tabular-nums">
              {unread}
            </span>
          )}
        </Link>
      </header>

      <div className="lg:max-w-sm">
        <RestaurantSelect
          restaurants={restaurants.map(({ short_code, name }) => ({ short_code, name }))}
          value={selected?.short_code ?? ""}
        />
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          href={`/interventions?statut=en_cours&type=urgence${filterQuery}`}
          label="Urgences en cours"
          value={urgences.length}
          icon="bolt"
          tone="danger"
        />
        <KpiCard
          href={`/equipements?etat=en_panne${filterQuery}`}
          label="Machines en panne"
          value={pannes.length}
          total={equipments.length}
          icon="xc"
          tone="danger"
        />
        <KpiCard
          href={`/equipements?entretien=en_retard${filterQuery}`}
          label="Entretiens en retard"
          value={overdue.length}
          icon="clock"
          tone="warning"
        />
        <KpiCard
          href="/stock?statut=sous_seuil"
          label="Pièces sous le seuil"
          value={lowParts.length}
          icon="down"
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        {/* À traiter en priorité */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[18px] font-semibold m-0">À traiter en priorité</h2>
            {priority.length > PRIORITY_MAX && (
              <Link href="/notifications" className="text-orange-text font-bold text-[14px] py-3">
                Tout voir ({priority.length})
              </Link>
            )}
          </div>
          {priority.length === 0 ? (
            <Card className="flex items-center gap-3">
              <span className="size-11 rounded bg-success-bg text-success flex items-center justify-center shrink-0">
                <Icon name="check" />
              </span>
              <div>
                <div className="font-semibold">Rien à traiter en priorité</div>
                <div className="text-text-muted text-[14px]">
                  Aucune panne en cours, aucun retard, stock suffisant.
                </div>
              </div>
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden divide-y divide-surface-2">
              {priority.slice(0, PRIORITY_MAX).map((item) => (
                <ListRow
                  key={item.key}
                  href={item.href}
                  icon={item.icon}
                  name={item.name}
                  sub={item.sub}
                  badge={<StatusBadge status={item.status} />}
                />
              ))}
            </Card>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* Par restaurant (vue globale seulement) */}
          {!selected && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-[18px] font-semibold m-0">Par restaurant</h2>
              {byRestaurant.map((r) => (
                <Link
                  key={r.id}
                  href={`/?restaurant=${r.short_code}`}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)] text-text hover:shadow-[0_0_0_2px_var(--color-ring)] transition-shadow"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display text-[17px] font-semibold">{r.short_code}</span>
                      <span className="text-text-muted text-[13px] truncate">
                        {r.name} · {r.total} équipements
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {r.pannes > 0 && <StatusBadge status="enPanne" label={`${r.pannes} en panne`} />}
                      {r.retards > 0 && (
                        <StatusBadge status="enRetard" label={`${r.retards} en retard`} />
                      )}
                      {r.pannes === 0 && r.retards === 0 && (
                        <StatusBadge status="operationnel" label="Tout fonctionne" />
                      )}
                    </div>
                  </div>
                  <Icon name="chevronRight" className="text-text-muted" />
                </Link>
              ))}
            </section>
          )}

          {/* Mobile : accès à l'administration (absente de la barre du bas) */}
          {profile && canAccessAdmin(profile.role) && (
            <Link
              href="/admin/utilisateurs"
              className="lg:hidden flex items-center gap-3 p-4 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)] text-text"
            >
              <Icon name="shield" />
              <span className="flex-1 font-semibold">Administration</span>
              <Icon name="chevronRight" className="text-text-muted" />
            </Link>
          )}

          {/* Ordinateur : entretiens des 7 jours */}
          <section className="hidden lg:flex flex-col gap-3">
            <h2 className="font-display text-[18px] font-semibold m-0">Entretiens des 7 jours</h2>
            {upcoming.length === 0 ? (
              <Card className="text-text-muted text-[14px]">
                Aucun entretien prévu dans les 7 jours.
              </Card>
            ) : (
              <Card padded={false} className="overflow-hidden divide-y divide-surface-2">
                {upcoming.map((p) => (
                  <ListRow
                    key={p.id}
                    href={`/equipements/${p.equipment_id}`}
                    icon={categoryIcon(p.equipments?.categories?.code)}
                    name={p.equipments?.name ?? "Équipement"}
                    sub={`${codeOf.get(p.equipments?.restaurant_id ?? "") ?? ""} · ${dateCourte(p.next_due_at)}`}
                  />
                ))}
              </Card>
            )}
          </section>

          {/* Ordinateur : stock sous le seuil */}
          <section className="hidden lg:flex flex-col gap-3">
            <h2 className="font-display text-[18px] font-semibold m-0">Stock sous le seuil</h2>
            {lowParts.length === 0 ? (
              <Card className="text-text-muted text-[14px]">Aucune pièce sous le seuil.</Card>
            ) : (
              <Card padded={false} className="overflow-hidden divide-y divide-surface-2">
                {lowParts.map((p) => (
                  <ListRow
                    key={p.id}
                    href={`/stock/${p.id}`}
                    icon="box"
                    name={p.name}
                    sub={`${p.quantity} restant${p.quantity > 1 ? "s" : ""} · seuil ${p.min_threshold}`}
                    badge={<StatusBadge status="sousLeSeuil" />}
                  />
                ))}
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
