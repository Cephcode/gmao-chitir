// 9. Catégories : règles pures de lib/categories-rules.ts et choix de l'icône (lib/equipment-icon.ts).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkCategory, codeDepuisNom, isCategoryIcon, normaliserCode } from "@/lib/categories-rules";
import { categoryIcon } from "@/lib/equipment-icon";

describe("code proposé depuis le nom", () => {
  test("3 premières lettres, majuscules, sans accent", () => {
    assert.equal(codeDepuisNom("Réfrigération"), "REF");
    assert.equal(codeDepuisNom("  élec-trique "), "ELE");
    assert.equal(codeDepuisNom("Çà et là"), "CAE");
  });
  test("nom trop court : complété par X", () => {
    assert.equal(codeDepuisNom("Wi"), "WIX");
  });
  test("code pris : autre combinaison de lettres du nom, première lettre gardée", () => {
    assert.equal(codeDepuisNom("Friteuses", ["FRI"]), "FRT");
    assert.equal(codeDepuisNom("Friteuses", ["FRI", "FRT", "FRE"]), "FRU");
  });
  test("toutes les combinaisons prises : on rend le code de base (à modifier à la main)", () => {
    assert.equal(codeDepuisNom("Abc", ["ABC"]), "ABC");
  });
});

describe("saisie du code", () => {
  test("normalisée : lettres seules, majuscules, 3 au plus", () => {
    assert.equal(normaliserCode("fr1i-t"), "FRI");
    assert.equal(normaliserCode("éa"), "EA");
  });
});

describe("contrôle d'une catégorie", () => {
  test("valide", () => {
    assert.equal(checkCategory({ name: "Friteuses", code: "FRI", icon: "flame" }), null);
    assert.equal(checkCategory({ name: "Friteuses", code: "FRI", icon: null }), null);
  });
  test("nom vide, code mal formé, icône inconnue", () => {
    assert.equal(checkCategory({ name: "  ", code: "FRI", icon: null })?.field, "name");
    assert.equal(checkCategory({ name: "X", code: "FR", icon: null })?.field, "code");
    assert.equal(checkCategory({ name: "X", code: "FRI2", icon: null })?.field, "code");
    assert.equal(checkCategory({ name: "X", code: "FRI", icon: "logout" })?.field, "icon");
  });
});

describe("icône d'une catégorie", () => {
  test("icône choisie d'abord", () => {
    assert.equal(categoryIcon({ code: "REF", icon: "bolt" }), "bolt");
  });
  test("sans icône : repère par code, sinon clé à molette", () => {
    assert.equal(categoryIcon({ code: "CUI", icon: null }), "flame");
    assert.equal(categoryIcon({ code: "FRI" }), "wrench");
    assert.equal(categoryIcon(null), "wrench");
  });
  test("icône inconnue (saisie hors écran) : ignorée", () => {
    assert.equal(categoryIcon({ code: "CUI", icon: "n-importe-quoi" }), "flame");
    assert.equal(isCategoryIcon("store"), true);
  });
});
