// Chargement de la page Consommables (voir components/app/loading-state.tsx).
import { LoadingState } from "@/components/app/loading-state";

export default function Loading() {
  return <LoadingState title="Consommables" label="Chargement des consommables…" />;
}
