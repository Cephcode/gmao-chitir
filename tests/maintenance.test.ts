// 3. Statut d'entretien calculé (lib/equipements.ts, maintenanceOf) : à jour, en retard, à définir.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { maintenanceOf, type Plan } from "@/lib/equipements";

const plan = (o: Partial<Plan>): Plan => ({ task: null, frequency: "mensuel", last_done_at: null, next_due_at: null, ...o });

// Instant fixe : 30 septembre 2026 à midi UTC
const MAINTENANT = Date.parse("2026-09-30T12:00:00Z");

describe("maintenanceOf", () => {
  test("sans plan : à définir", () => {
    assert.deepEqual(maintenanceOf(null, MAINTENANT), { status: "a_definir" });
  });

  test("plan sans échéance : à définir", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: null }), MAINTENANT), { status: "a_definir" });
  });

  test("échéance invalide : à définir", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: "pas une date" }), MAINTENANT), { status: "a_definir" });
  });

  test("échéance dans quelques heures : à jour", () => {
    const due = "2026-09-30T18:00:00Z";
    assert.deepEqual(maintenanceOf(plan({ next_due_at: due }), MAINTENANT), { status: "a_jour", next: due });
  });

  test("échéance future : à jour", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: "2026-10-03T00:00:00Z" }), MAINTENANT), {
      status: "a_jour",
      next: "2026-10-03T00:00:00Z",
    });
  });

  test("échéance passée de quelques heures : en retard de 0 jour", () => {
    const due = "2026-09-30T08:00:00Z";
    assert.deepEqual(maintenanceOf(plan({ next_due_at: due }), MAINTENANT), {
      status: "en_retard",
      next: due,
      days: 0,
    });
  });

  test("échéance d'hier à la même heure : en retard de 1 jour", () => {
    const due = "2026-09-29T12:00:00Z";
    assert.deepEqual(maintenanceOf(plan({ next_due_at: due }), MAINTENANT), {
      status: "en_retard",
      next: due,
      days: 1,
    });
  });

  test("date simple (sans heure) : lue à minuit UTC", () => {
    // 2026-09-29 00:00 UTC → 1 jour et 12 h avant MAINTENANT → 1 jour entier
    assert.deepEqual(maintenanceOf(plan({ next_due_at: "2026-09-29" }), MAINTENANT), {
      status: "en_retard",
      next: "2026-09-29",
      days: 1,
    });
  });

  test("retard sur plusieurs mois (changement d'heure, année)", () => {
    // 2025-09-30 00:00 UTC → 365 jours et 12 h avant MAINTENANT
    assert.equal((maintenanceOf(plan({ next_due_at: "2025-09-30T00:00:00Z" }), MAINTENANT) as { days: number }).days, 365);
    // 2026-03-01 00:00 UTC → 213 jours et 12 h avant MAINTENANT
    assert.equal((maintenanceOf(plan({ next_due_at: "2026-03-01T00:00:00Z" }), MAINTENANT) as { days: number }).days, 213);
  });

  test("sans dernier entretien : le statut suit l'échéance", () => {
    assert.equal(maintenanceOf(plan({ last_done_at: null, next_due_at: "2026-10-30T00:00:00Z" }), MAINTENANT).status, "a_jour");
    assert.equal(maintenanceOf(plan({ last_done_at: null, next_due_at: "2026-09-01T00:00:00Z" }), MAINTENANT).status, "en_retard");
  });

  test("par défaut, maintenant (Date.now())", () => {
    const hier = new Date(Date.now() - 86400000).toISOString();
    const demain = new Date(Date.now() + 86400000).toISOString();
    assert.equal(maintenanceOf(plan({ next_due_at: hier })).status, "en_retard");
    assert.equal(maintenanceOf(plan({ next_due_at: demain })).status, "a_jour");
  });
});