// Recherche et filtres de la liste d'équipements (?q=&restaurant=&categorie=&etat=&entretien=).
import { UrlFilters } from "@/components/app/url-filters";

export function EquipmentFilters({
  restaurants,
  categories,
}: {
  restaurants: { short_code: string; name: string }[];
  categories: { code: string; name: string }[];
}) {
  return (
    <UrlFilters
      basePath="/equipements"
      searchLabel="Rechercher un équipement"
      searchPlaceholder="Nom ou code : frigo, CTR1-FRG…"
      chips={[
        // Le filtre restaurant n'a de sens que si on en voit plusieurs.
        ...(restaurants.length > 1
          ? [
              {
                name: "restaurant",
                label: "Restaurant",
                options: restaurants.map((r) => ({ value: r.short_code, label: r.short_code })),
              },
            ]
          : []),
        {
          name: "categorie",
          label: "Catégorie",
          options: categories.map((c) => ({ value: c.code, label: c.name })),
        },
        {
          name: "etat",
          label: "État",
          options: [
            { value: "pas_operationnel", label: "Pas opérationnel" },
            { value: "en_panne", label: "En panne" },
            { value: "en_maintenance", label: "En maintenance" },
            { value: "hors_service", label: "Hors service" },
            { value: "operationnel", label: "Opérationnel" },
          ],
        },
        {
          name: "entretien",
          label: "Entretien",
          options: [
            { value: "en_retard", label: "En retard" },
            { value: "a_jour", label: "À jour" },
            { value: "a_definir", label: "À définir" },
          ],
        },
      ]}
    />
  );
}
