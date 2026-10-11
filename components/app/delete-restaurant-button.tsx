"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteRestaurantById } from "@/lib/restaurants";

export function DeleteRestaurantButton({
  restaurantId,
  name,
}: {
  restaurantId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Supprimer « ${name} » et tous ses équipements ?`)) return;
    startTransition(async () => {
      const res = await deleteRestaurantById(restaurantId);
      if (!res.success) alert(res.error);
    });
  }

  return (
    <Button variant="danger" icon="trash" onClick={onDelete} disabled={pending}>
      {pending ? "Suppression..." : "Supprimer"}
    </Button>
  );
}