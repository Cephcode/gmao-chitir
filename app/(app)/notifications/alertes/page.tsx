// Mes alertes (mobile) : choisir les notifications reçues. Sur ordinateur, le même
// réglage est dans la colonne de droite de /notifications.
import Link from "next/link";
import { SETTINGS, getSettings } from "@/lib/notifications";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { AlertSettings } from "@/components/app/notifications/alert-settings";
import { PushToggle } from "@/components/app/notifications/push-toggle";

export default async function AlertesPage() {
  const settings = await getSettings();
  return (
    <div className="max-w-xl mx-auto px-4 pt-3 lg:pt-10 flex flex-col gap-4">
      <Link href="/notifications" className="-ml-2 inline-flex items-center gap-1 h-touch px-2 font-semibold text-text self-start">
        <Icon name="chevronRight" className="rotate-180" /> Notifications
      </Link>
      <h1 className="font-display text-[22px] font-semibold m-0">Mes alertes</h1>
      <p className="m-0 text-text-muted text-[15px]">Choisissez ce qui vous est envoyé.</p>
      <PushToggle />
      <Card className="py-2 px-5">
        <AlertSettings settings={SETTINGS} initial={settings} />
      </Card>
    </div>
  );
}
