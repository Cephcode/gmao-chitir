// Catégories : propriétaire et éditeur (garde du layout, revérifiée ici et dans les actions).
import { notFound, redirect } from "next/navigation";
import { loadAdmin } from "@/lib/admin";
import { listCategoriesAdmin } from "@/lib/categories";
import { AdminHeader } from "@/components/app/admin/admin-views";
import { CategoryList } from "@/components/app/admin/category-views";

export default async function CategoriesPage() {
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  if (actor.role !== "proprietaire" && actor.role !== "editeur") redirect("/");
  const categories = await listCategoriesAdmin();
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-5">
      <AdminHeader actor={actor} tab="categories" userCount={users.length} restaurantCount={restaurants.length} categoryCount={categories.length} />
      <CategoryList categories={categories} />
    </div>
  );
}
