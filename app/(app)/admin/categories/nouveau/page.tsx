// Ajouter une catégorie : panneau au-dessus de la liste (sur ordinateur).
import { notFound, redirect } from "next/navigation";
import { loadAdmin } from "@/lib/admin";
import { listCategoriesAdmin } from "@/lib/categories";
import { AdminHeader } from "@/components/app/admin/admin-views";
import { CategoryForm } from "@/components/app/admin/category-form";
import { CategoryList } from "@/components/app/admin/category-views";

export default async function NouvelleCategoriePage() {
  const { actor, users, restaurants } = await loadAdmin();
  if (!actor) notFound();
  if (actor.role !== "proprietaire" && actor.role !== "editeur") redirect("/");
  const categories = await listCategoriesAdmin();
  return (
    <>
      <div className="hidden lg:flex max-w-6xl mx-auto px-8 pt-10 flex-col gap-5" aria-hidden>
        <AdminHeader actor={actor} tab="categories" userCount={users.length} restaurantCount={restaurants.length} categoryCount={categories.length} />
        <CategoryList categories={categories} />
      </div>
      <CategoryForm takenCodes={categories.map((c) => c.code)} cancelHref="/admin/categories" />
    </>
  );
}
