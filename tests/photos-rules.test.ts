// 10. Photos : règles pures de lib/photos.ts (dimensions, validation, compteur, chemins).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  PHOTOS_MAX_PAR_TYPE,
  counterLabel,
  failedPhotosMessage,
  isImageType,
  isPhotoKind,
  isPhotoPathOf,
  limitMessage,
  photoPath,
  readFailedCount,
  resizeDimensions,
  slotsLeft,
  takeWithinLimit,
} from "@/lib/photos";

const R = "11111111-1111-4111-8111-111111111111";
const I = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";

describe("redimensionnement", () => {
  test("paysage : grand côté ramené à 1600, proportions gardées", () => {
    assert.deepEqual(resizeDimensions(4000, 3000), { width: 1600, height: 1200 });
  });
  test("portrait : c'est la hauteur qui est ramenée à 1600", () => {
    assert.deepEqual(resizeDimensions(3024, 4032), { width: 1200, height: 1600 });
  });
  test("petite image : jamais agrandie", () => {
    assert.deepEqual(resizeDimensions(800, 600), { width: 800, height: 600 });
    assert.deepEqual(resizeDimensions(1600, 1600), { width: 1600, height: 1600 });
  });
  test("image très allongée : au moins 1 px", () => {
    assert.deepEqual(resizeDimensions(10000, 2), { width: 1600, height: 1 });
  });
  test("dimensions invalides refusées", () => {
    assert.throws(() => resizeDimensions(0, 100));
    assert.throws(() => resizeDimensions(NaN, 100));
  });
});

describe("validation des fichiers", () => {
  test("images acceptées, le reste refusé", () => {
    for (const t of ["image/jpeg", "image/png", "image/heic", "image/webp"]) assert.equal(isImageType(t), true, t);
    for (const t of ["application/pdf", "video/mp4", "", null, undefined]) assert.equal(isImageType(t), false, String(t));
  });
  test("type de photo", () => {
    assert.equal(isPhotoKind("avant"), true);
    assert.equal(isPhotoKind("apres"), true);
    assert.equal(isPhotoKind("après"), false);
  });
});

describe("limite et compteur", () => {
  test("la limite vaut 3 (égale à photos_max_par_type() en base)", () => {
    assert.equal(PHOTOS_MAX_PAR_TYPE, 3);
  });
  test("places restantes", () => {
    assert.equal(slotsLeft(0), 3);
    assert.equal(slotsLeft(2), 1);
    assert.equal(slotsLeft(3), 0);
    assert.equal(slotsLeft(5), 0);
  });
  test("on garde les premières photos dans la limite", () => {
    assert.deepEqual(takeWithinLimit(1, ["a", "b", "c", "d"]), { accepted: ["a", "b"], refused: 2 });
    assert.deepEqual(takeWithinLimit(3, ["a"]), { accepted: [], refused: 1 });
    assert.deepEqual(takeWithinLimit(0, ["a", "b"]), { accepted: ["a", "b"], refused: 0 });
  });
  test("compteur « 2/3 », borné à la limite", () => {
    assert.equal(counterLabel(2), "2/3");
    assert.equal(counterLabel(0), "0/3");
    assert.equal(counterLabel(4), "3/3");
    assert.equal(counterLabel(1, 5), "1/5");
  });
  test("message de limite", () => {
    assert.equal(limitMessage(0), null);
    assert.equal(limitMessage(1), "3 photos au plus : 1 photo n'a pas été ajoutée.");
    assert.equal(limitMessage(2), "3 photos au plus : 2 photos n'ont pas été ajoutées.");
  });
});

describe("chemins dans le bucket", () => {
  test("format {restaurant}/{intervention}/{uuid}.jpg", () => {
    assert.equal(photoPath(R, I, F), `${R}/${I}/${F}.jpg`);
  });
  test("chemin reconnu seulement dans le dossier de l'intervention", () => {
    assert.equal(isPhotoPathOf(photoPath(R, I, F), R, I), true);
    assert.equal(isPhotoPathOf(photoPath(R, I, F), I, R), false);
    assert.equal(isPhotoPathOf(`${R}/${I}/${F}.png`, R, I), false);
    assert.equal(isPhotoPathOf(`${R}/${I}/x/${F}.jpg`, R, I), false);
    assert.equal(isPhotoPathOf(`../${R}/${I}/${F}.jpg`, R, I), false);
    assert.equal(isPhotoPathOf(null, R, I), false);
  });
});

describe("messages d'échec d'envoi", () => {
  test("la déclaration reste faite", () => {
    assert.equal(
      failedPhotosMessage(2, "declaration"),
      "La panne est déclarée, mais 2 photos n'ont pas pu être envoyées. Ajoutez-les depuis la fiche.",
    );
    assert.equal(
      failedPhotosMessage(1, "cloture"),
      "L'intervention est clôturée, mais 1 photo n'a pas pu être envoyée. Ajoutez-les ci-dessous.",
    );
    assert.equal(failedPhotosMessage(0, "fiche"), null);
  });
  test("nombre lu dans l'URL borné", () => {
    assert.equal(readFailedCount("2"), 2);
    assert.equal(readFailedCount("0"), 0);
    assert.equal(readFailedCount("99"), 0);
    assert.equal(readFailedCount("abc"), 0);
    assert.equal(readFailedCount(["1"]), 0);
    assert.equal(readFailedCount(undefined), 0);
  });
});
