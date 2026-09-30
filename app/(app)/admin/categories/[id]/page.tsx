// Modifier une catégorie : nom, code, icône ; suppression si aucune machine.
import { notFound, redirect } from "next/navigation";
import { loadAdmin } from "@/lib/admin";
import { listCategoriesAdmin } from "@/lib/categories";
import { AdminHeader } from "@/components/app/admin/admin-views";
import { CategoryForm } from "@/components/app/admin/category-form";
import { CategoryList } from "@/components/app/admin/category-views";

export default async function CategoriePage(props: PageProps<"/admin/categories/[id]">) {
  const { id } = await props.params;
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  if (actor.role !== "proprietaire" && actor.role !== "editeur") redirect("/");
  const categories = await listCategoriesAdmin();
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();
  return (
    <>
      <div className="hidden lg:flex max-w-6xl mx-auto px-8 pt-10 flex-col gap-5" aria-hidden>
        <AdminHeader actor={actor} tab="categories" userCount={users.length} restaurantCount={restaurants.length} categoryCount={categories.length} />
        <CategoryList categories={categories} selectedId={category.id} />
      </div>
      <CategoryForm
        key={category.id}
        category={category}
        takenCodes={categories.filter((c) => c.id !== category.id).map((c) => c.code)}
        cancelHref="/admin/categories"
      />
    </>
  );
}
