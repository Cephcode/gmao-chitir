// Chargement de la page Stock (voir components/app/loading-state.tsx).
import { LoadingState } from "@/components/app/loading-state";

export default function Loading() {
  return <LoadingState title="Stock" label="Chargement du stock…" />;
}
