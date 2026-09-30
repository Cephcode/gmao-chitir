// Liste des catégories (Administration > Catégories) : cartes sur mobile, tableau sur
// ordinateur. Chaque ligne ouvre le panneau de modification.
import Link from "next/link";
import { categoryIcon } from "@/lib/equipment-icon";
import type { CategoryAdmin } from "@/lib/categories";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";

const machinesLabel = (n: number) => (n === 0 ? "Aucune machine" : `${n} machine${n > 1 ? "s" : ""}`);

function CategoryIcon({ c }: { c: CategoryAdmin }) {
  return (
    <span className="size-10 rounded bg-surface-2 text-[#4E2F21] flex items-center justify-center shrink-0" aria-hidden>
      <Icon name={categoryIcon(c)} />
    </span>
  );
}

export function CategoryList({ categories, selectedId }: { categories: CategoryAdmin[]; selectedId?: string }) {
  if (!categories.length) {
    return <p className="text-text-muted text-[15px]">Aucune catégorie pour le moment.</p>;
  }
  return (
    <>
      <div className="lg:hidden flex flex-col gap-2.5">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/admin/categories/${c.id}`}
            className="flex items-center gap-3 p-4 rounded-lg bg-surface text-text shadow-[0_0_0_1px_var(--color-border)]"
          >
            <CategoryIcon c={c} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] truncate">{c.name}</div>
              <div className="text-text-muted text-[13px]">
                {c.code} · {machinesLabel(c.machines)}
              </div>
            </div>
            <Icon name="chevronRight" className="text-text-muted" />
          </Link>
        ))}
      </div>

      <Card padded={false} className="hidden lg:block overflow-hidden">
        <table className="w-full text-[14px] border-collapse">
          <thead>
            <tr className="bg-background text-text-muted text-[12px] uppercase tracking-wide text-left">
              <th className="font-semibold px-4 py-3">Catégorie</th>
              <th className="font-semibold px-4 py-3">Code</th>
              <th className="font-semibold px-4 py-3">Machines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-2">
            {categories.map((c) => (
              <tr key={c.id} className={`relative ${c.id === selectedId ? "bg-orange-soft" : "hover:bg-background"}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <CategoryIcon c={c} />
                    <Link href={`/admin/categories/${c.id}`} className="font-semibold text-text after:absolute after:inset-0">
                      {c.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-semibold">{c.code}</td>
                <td className="px-4 py-2.5">{machinesLabel(c.machines)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
