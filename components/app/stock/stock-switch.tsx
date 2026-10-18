// Mobile : choix « Pièces détachées | Consommables » en tête des deux listes de stock.
// La barre du bas garde 4 onglets ; l'onglet Stock mène aux deux modules.
// Sur ordinateur, le menu latéral a une entrée par module : ce choix est masqué.
import Link from "next/link";

export function StockSwitch({ current }: { current: "pieces" | "consommables" }) {
  return (
    <nav aria-label="Type de stock" className="lg:hidden grid grid-cols-2 gap-1 p-1 rounded bg-surface-2">
      {[
        { key: "pieces", href: "/stock", label: "Pièces détachées" },
        { key: "consommables", href: "/consommables", label: "Consommables" },
      ].map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-center min-h-11 rounded-sm text-[15px] font-semibold ${
              active ? "bg-filter-active text-background" : "text-text-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
