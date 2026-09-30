// Chargement de la page (toutes les pages sans chargement propre) (voir components/app/loading-state.tsx).
import { LoadingState } from "@/components/app/loading-state";

export default function Loading() {
  return <LoadingState label="Chargement…" />;
}
