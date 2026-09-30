"use client";

// Sélecteur « Tous les restaurants / CTR1 / CTR2 ». Filtre la page via ?restaurant=CODE.
// Liste native (sélecteur du téléphone), habillée comme un bouton secondaire.
// Ne propose que les restaurants accessibles (la liste vient du serveur, filtrée par les RLS).
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { focusHaloInset } from "@/components/ui/field";

export function RestaurantSelect({
  restaurants,
  value,
}: {
  restaurants: { short_code: string; name: string }[];
  value: string; // short_code sélectionné, "" = tous
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className={`relative flex items-center h-field rounded bg-surface shadow-[inset_0_0_0_1.5px_var(--color-ring)] hover:bg-surface-2 ${focusHaloInset}`}>
      <span className="sr-only">Restaurant</span>
      <Icon name="store" className="absolute left-3.5 text-orange-text pointer-events-none" />
      <select
        value={value}
        onChange={(e) =>
          router.push(e.target.value ? `${pathname}?restaurant=${e.target.value}` : pathname)
        }
        className="appearance-none w-full h-full bg-transparent pl-11 pr-10 font-semibold text-[16px] text-text cursor-pointer outline-none"
      >
        <option value="">Tous les restaurants ({restaurants.length})</option>
        {restaurants.map((r) => (
          <option key={r.short_code} value={r.short_code}>
            {r.short_code} · {r.name}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" className="absolute right-3.5 pointer-events-none" />
    </label>
  );
}
