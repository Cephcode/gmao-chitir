// Chargement de la page Interventions (voir components/app/loading-state.tsx).
import { LoadingState } from "@/components/app/loading-state";

export default function Loading() {
  return <LoadingState title="Interventions" label="Chargement des interventions…" />;
}
