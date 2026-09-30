// Chargement de la page Notifications (voir components/app/loading-state.tsx).
import { LoadingState } from "@/components/app/loading-state";

export default function Loading() {
  return <LoadingState title="Notifications" label="Chargement des notifications…" />;
}
