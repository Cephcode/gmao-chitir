// 3. Statut d'entretien calculé (lib/equipements.ts, maintenanceOf) : à jour, en retard, à définir.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { maintenanceOf, type Plan } from "@/lib/equipements";

const plan = (o: Partial<Plan>): Plan => ({ task: null, frequency: "mensuel", last_done_at: null, next_due_at: null, ...o });
const AUJ = "2026-09-30";

describe("maintenanceOf", () => {
  test("sans plan : à définir", () => {
    assert.deepEqual(maintenanceOf(null, AUJ), { status: "a_definir" });
  });
  test("plan sans échéance : à définir", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: null }), AUJ), { status: "a_definir" });
  });
  test("échéance le jour même : à jour", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: AUJ }), AUJ), { status: "a_jour", next: AUJ });
  });
  test("échéance future : à jour", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: "2026-10-03" }), AUJ), { status: "a_jour", next: "2026-10-03" });
  });
  test("échéance d'hier : en retard de 1 jour", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: "2026-09-29" }), AUJ), { status: "en_retard", next: "2026-09-29", days: 1 });
  });
  test("retard sur plusieurs mois (changement d'heure, année)", () => {
    assert.deepEqual(maintenanceOf(plan({ next_due_at: "2025-09-30" }), AUJ), { status: "en_retard", next: "2025-09-30", days: 365 });
    assert.equal((maintenanceOf(plan({ next_due_at: "2026-03-01" }), AUJ) as { days: number }).days, 213);
  });
  test("sans dernier entretien : le statut suit l'échéance", () => {
    assert.equal(maintenanceOf(plan({ last_done_at: null, next_due_at: "2026-10-30" }), AUJ).status, "a_jour");
    assert.equal(maintenanceOf(plan({ last_done_at: null, next_due_at: "2026-09-01" }), AUJ).status, "en_retard");
  });
  test("par défaut, aujourd'hui (UTC, = heure de Ouagadougou)", () => {
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    assert.equal(maintenanceOf(plan({ next_due_at: hier })).status, "en_retard");
  });
});
