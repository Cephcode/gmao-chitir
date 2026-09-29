// Écran d'attente pour une rubrique pas encore construite (garde la navigation testable).
import { Icon, type IconName } from "@/components/icons";
import { Card } from "@/components/ui/card";

export function ComingSoon({ title, icon, text }: { title: string; icon: IconName; text: string }) {
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-6">
      <h1 className="font-display text-[22px] lg:text-[32px] font-semibold m-0">{title}</h1>
      <Card className="flex items-center gap-3">
        <span className="size-11 rounded bg-surface-2 text-[#4E2F21] flex items-center justify-center shrink-0">
          <Icon name={icon} />
        </span>
        <div className="text-text-muted text-[15px]">{text}</div>
      </Card>
    </div>
  );
}
