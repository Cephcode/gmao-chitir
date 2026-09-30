// 5. Délégation des comptes : règles pures de lib/admin-rules.ts.
// Les règles « pas de changement de son propre rôle » et « toujours un propriétaire » sont dans
// app/(app)/admin/actions.ts (besoin de la base) : non couvertes ici, voir le rapport.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  assignableRoles,
  assignableRestaurants,
  canAccessAdmin,
  canManage,
  checkAssignment,
  normaliserAcces,
  type Actor,
  type AdminUser,
} from "@/lib/admin-rules";

const R1 = "r1", R2 = "r2", R3 = "r3";
const TOUS = [R1, R2, R3];
const proprio: Actor = { id: "p", role: "proprietaire", allRestaurants: true, restaurantIds: [] };
const proprioLimite: Actor = { id: "pl", role: "proprietaire", allRestaurants: false, restaurantIds: [R1] };
const editeur: Actor = { id: "e", role: "editeur", allRestaurants: false, restaurantIds: [R1, R2] };
const commentateur: Actor = { id: "c", role: "commentateur", allRestaurants: false, restaurantIds: [R1] };
const lecteur: Actor = { id: "l", role: "lecteur", allRestaurants: false, restaurantIds: [R1] };

const compte = (o: Partial<AdminUser>): AdminUser => ({
  id: "x", first_name: "X", email: "x@test.local", phone: null, role: "lecteur", all_restaurants: false,
  must_change_password: false, last_seen_at: null, restaurantIds: [R1], ...o,
});

describe("accès à l'administration", () => {
  test("propriétaire et éditeur seulement", () => {
    assert.equal(canAccessAdmin("proprietaire"), true);
    assert.equal(canAccessAdmin("editeur"), true);
    assert.equal(canAccessAdmin("commentateur"), false);
    assert.equal(canAccessAdmin("lecteur"), false);
    assert.equal(canAccessAdmin(undefined), false);
  });
});

describe("rôles attribuables", () => {
  test("propriétaire : les quatre rôles", () => {
    assert.deepEqual(assignableRoles(proprio), ["proprietaire", "editeur", "commentateur", "lecteur"]);
  });
  test("éditeur : jamais propriétaire", () => {
    assert.deepEqual(assignableRoles(editeur), ["editeur", "commentateur", "lecteur"]);
  });
});

describe("restaurants attribuables", () => {
  test("propriétaire (même limité) : tous", () => {
    assert.deepEqual(assignableRestaurants(proprio, TOUS), TOUS);
    assert.deepEqual(assignableRestaurants(proprioLimite, TOUS), TOUS);
  });
  test("éditeur : seulement les siens", () => {
    assert.deepEqual(assignableRestaurants(editeur, TOUS), [R1, R2]);
  });
});

describe("checkAssignment (création / modification)", () => {
  test("éditeur : crée un commentateur sur ses restaurants", () => {
    assert.equal(checkAssignment(editeur, { role: "commentateur", allRestaurants: false, restaurantIds: [R1] }, TOUS), null);
    assert.equal(checkAssignment(editeur, { role: "editeur", allRestaurants: false, restaurantIds: [R1, R2] }, TOUS), null);
  });
  test("éditeur : pas de propriétaire", () => {
    assert.match(checkAssignment(editeur, { role: "proprietaire", allRestaurants: false, restaurantIds: [R1] }, TOUS) ?? "", /rôle/);
  });
  test("éditeur : pas d'accès « tous les restaurants »", () => {
    assert.match(checkAssignment(editeur, { role: "lecteur", allRestaurants: true, restaurantIds: [] }, TOUS) ?? "", /tous les restaurants/);
  });
  test("éditeur : pas de restaurant hors des siens", () => {
    assert.match(checkAssignment(editeur, { role: "lecteur", allRestaurants: false, restaurantIds: [R1, R3] }, TOUS) ?? "", /vos restaurants/);
  });
  test("éditeur : restaurant inexistant refusé", () => {
    assert.notEqual(checkAssignment(editeur, { role: "lecteur", allRestaurants: false, restaurantIds: ["inconnu"] }, TOUS), null);
  });
  test("au moins un restaurant", () => {
    assert.match(checkAssignment(editeur, { role: "lecteur", allRestaurants: false, restaurantIds: [] }, TOUS) ?? "", /au moins un/);
    assert.match(checkAssignment(proprio, { role: "lecteur", allRestaurants: false, restaurantIds: [] }, TOUS) ?? "", /au moins un/);
  });
  test("propriétaire : tout rôle, tous les restaurants", () => {
    assert.equal(checkAssignment(proprio, { role: "proprietaire", allRestaurants: true, restaurantIds: [] }, TOUS), null);
    assert.equal(checkAssignment(proprio, { role: "editeur", allRestaurants: false, restaurantIds: [R3] }, TOUS), null);
  });
  test("propriétaire limité à certains restaurants refusé (recette S-M2)", () => {
    assert.match(checkAssignment(proprio, { role: "proprietaire", allRestaurants: false, restaurantIds: [R1] }, TOUS) ?? "", /tous les restaurants/);
  });
  test("rôle propriétaire : accès forcé à tous les restaurants", () => {
    assert.deepEqual(normaliserAcces({ role: "proprietaire", allRestaurants: false, restaurantIds: [R1] }),
      { role: "proprietaire", allRestaurants: true, restaurantIds: [] });
    const lect = { role: "lecteur" as const, allRestaurants: false, restaurantIds: [R1] };
    assert.deepEqual(normaliserAcces(lect), lect);
  });
  test("commentateur et lecteur ne peuvent rien attribuer d'élevé", () => {
    for (const a of [commentateur, lecteur]) {
      assert.notEqual(checkAssignment(a, { role: "proprietaire", allRestaurants: false, restaurantIds: [R1] }, TOUS), null);
      assert.notEqual(checkAssignment(a, { role: "lecteur", allRestaurants: true, restaurantIds: [] }, TOUS), null);
    }
  });
});

describe("canManage (modifier, réinitialiser, supprimer)", () => {
  test("propriétaire : gère tout le monde", () => {
    assert.equal(canManage(proprio, compte({ role: "proprietaire", all_restaurants: true })), true);
  });
  test("éditeur : gère un lecteur / commentateur / éditeur de ses restaurants", () => {
    assert.equal(canManage(editeur, compte({ role: "lecteur", restaurantIds: [R1] })), true);
    assert.equal(canManage(editeur, compte({ role: "commentateur", restaurantIds: [R1, R2] })), true);
    assert.equal(canManage(editeur, compte({ role: "editeur", restaurantIds: [R2] })), true);
  });
  test("éditeur : jamais un propriétaire", () => {
    assert.equal(canManage(editeur, compte({ role: "proprietaire", restaurantIds: [R1] })), false);
  });
  test("éditeur : jamais un compte « tous les restaurants »", () => {
    assert.equal(canManage(editeur, compte({ role: "lecteur", all_restaurants: true, restaurantIds: [] })), false);
  });
  test("éditeur : pas un compte qui a aussi un restaurant hors des siens", () => {
    assert.equal(canManage(editeur, compte({ role: "lecteur", restaurantIds: [R1, R3] })), false);
    assert.equal(canManage(editeur, compte({ role: "lecteur", restaurantIds: [R3] })), false);
  });
  test("éditeur : pas un compte sans restaurant (recette S-B7)", () => {
    assert.equal(canManage(editeur, compte({ role: "lecteur", restaurantIds: [] })), false);
    assert.equal(canManage(proprio, compte({ role: "lecteur", restaurantIds: [] })), true);
  });
  test("commentateur et lecteur : ne gèrent personne", () => {
    assert.equal(canManage(commentateur, compte({ role: "lecteur", restaurantIds: [R1] })), false);
    assert.equal(canManage(lecteur, compte({ role: "lecteur", restaurantIds: [R1] })), false);
  });
});
