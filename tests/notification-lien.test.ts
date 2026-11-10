// Notifications : lien de la page ouverte depuis une notification (lib/notification-lien.ts).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { UUID_RE, lienAvecNotification } from "@/lib/notification-lien";

const ID = "28d7fcf1-4b53-42b1-abb4-abdf4b5afbb4";

describe("lien avec ?notif", () => {
  test("ajoute le paramètre à un lien simple", () => {
    assert.equal(lienAvecNotification("/interventions/abc", ID), `/interventions/abc?notif=${ID}`);
  });
  test("garde les paramètres et l'ancre existants", () => {
    assert.equal(
      lienAvecNotification("/equipements?restaurant=CTR1#plan", ID),
      `/equipements?restaurant=CTR1&notif=${ID}#plan`,
    );
  });
  test("remplace un ?notif déjà présent", () => {
    assert.equal(lienAvecNotification(`/stock?notif=ancien`, ID), `/stock?notif=${ID}`);
  });
  test("reste un lien interne", () => {
    assert.ok(lienAvecNotification("/stock", ID).startsWith("/stock"));
  });
});

describe("identifiant de notification", () => {
  test("uuid accepté, le reste refusé", () => {
    assert.ok(UUID_RE.test(ID));
    for (const v of ["", "abc", `${ID}x`, "'; drop table notifications; --"]) assert.equal(UUID_RE.test(v), false);
  });
});
