// Chargement de la page Équipements (voir components/app/loading-state.tsx).
import { LoadingState } from "@/components/app/loading-state";

export default function Loading() {
  return <LoadingState title="Équipements" label="Chargement des équipements…" />;
}
