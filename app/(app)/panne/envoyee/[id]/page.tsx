// Confirmation « Panne envoyée » (M-05c). Récapitulatif de l'intervention créée.
// L'équipe du restaurant a été notifiée dans l'application par declarer_panne.
// ?photos_echec=N : N photos n'ont pas pu être envoyées (la panne, elle, est déclarée).
import { STATUS_BADGE, type InterventionStatus } from "@/lib/intervention-status";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { failedPhotosMessage, readFailedCount } from "@/lib/photos";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

type Intervention = {
  id: string;
  type: "normal" | "urgence" | "alerte";
  status: InterventionStatus;
  equipment_id: string | null;
  equipment_free_text: string | null;
  equipments: { name: string } | null;
  restaurants: { short_code: string } | null;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-text-muted text-[15px]">{label}</span>
      <span className="font-semibold text-[15px] text-right">{children}</span>
    </div>
  );
}

export default async function PanneEnvoyeePage(props: PageProps<"/panne/envoyee/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const photosMessage = failedPhotosMessage(readFailedCount(searchParams.photos_echec), "declaration");
  const supabase = await createClient();
  const { data } = await supabase
    .from("interventions")
    .select("id, type, status, equipment_id, equipment_free_text, equipments(name), restaurants(short_code)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const i = data as unknown as Intervention;

  return (
    <div className="max-w-md mx-auto px-4 pt-10 lg:pt-20 flex flex-col items-center gap-6 text-center">
      <span className="size-20 rounded-full bg-success-bg text-success flex items-center justify-center">
        <Icon name="check" size={40} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] font-semibold m-0">Panne envoyée</h1>
        <p className="text-text-muted text-[16px] m-0">
          L&apos;équipe du restaurant est prévenue. Vous recevrez une notification quand la
          machine sera réparée.
        </p>
      </div>
      {photosMessage && (
        <div className="w-full text-left">
          <Alert
            variant="warning"
            icon="camera"
            action={
              <Link href={`/interventions/${i.id}`} className="text-orange-text font-bold text-[14px]">
                Ouvrir la fiche
              </Link>
            }
          >
            {photosMessage}
          </Alert>
        </div>
      )}
      <Card padded={false} className="w-full px-5 divide-y divide-surface-2 text-left">
        <Row label="Machine">{i.equipments?.name ?? i.equipment_free_text ?? "Non identifiée"}</Row>
        <Row label="Restaurant">{i.restaurants?.short_code ?? ""}</Row>
        <Row label="Type">
          <StatusBadge status={i.type === "urgence" ? "urgence" : "normal"} />
        </Row>
        <Row label="Suivi">
          <StatusBadge status={STATUS_BADGE[i.status]} />
        </Row>
      </Card>
      <div className="w-full flex flex-col gap-3">
        <Link href="/" className={`${buttonClass()} w-full`}>
          Retour à l&apos;accueil
        </Link>
        {i.equipment_id && (
          <Link href={`/equipements/${i.equipment_id}`} className={`${buttonClass({ variant: "secondary" })} w-full`}>
            Voir la fiche de la machine
          </Link>
        )}
      </div>
    </div>
  );
}
