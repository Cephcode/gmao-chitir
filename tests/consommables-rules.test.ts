// 13. Consommables : règles pures de lib/consommables-rules.ts (libellés, validation,
// résumé par restaurant, filtres, tri). Les règles en base : supabase/tests/13_consommables.sql.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  FAMILLES,
  FAMILLE_LABELS,
  OPERATIONS,
  OPERATION_LABELS,
  QUANTITE_LABELS,
  UNITES,
  appliquerFiltres,
  ecartInventaire,
  estSousSeuil,
  filtresQuery,
  lireFiltres,
  normaliserCode,
  resumeArticle,
  trierArticles,
  uniteLabel,
  verifierArticle,
  verifierOperation,
} from "@/lib/consommables-rules";

const R1 = "r1";
const R2 = "r2";

describe("libellés", () => {
  test("chaque famille, opération et unité a son libellé", () => {
    for (const f of FAMILLES) assert.ok(FAMILLE_LABELS[f]);
    for (const o of OPERATIONS) {
      assert.ok(OPERATION_LABELS[o]);
      assert.ok(QUANTITE_LABELS[o]);
    }
    for (const u of UNITES) assert.ok(uniteLabel(u, 2));
  });
  test("unité au singulier jusqu'à 1, au pluriel au-delà", () => {
    assert.equal(uniteLabel("carton", 0), "carton");
    assert.equal(uniteLabel("carton", 1), "carton");
    assert.equal(uniteLabel("carton", 2), "cartons");
    assert.equal(uniteLabel("rouleau", 3), "rouleaux");
    assert.equal(uniteLabel("kg", 5), "kg");
  });
  test("unité inconnue : affichée telle quelle", () => {
    assert.equal(uniteLabel("tonne", 2), "tonne");
  });
});

describe("code d'article", () => {
  test("majuscules, sans accent, espaces en tirets", () => {
    assert.equal(normaliserCode("  gob 50 "), "GOB-50");
    assert.equal(normaliserCode("thé-glacé"), "THE-GLACE");
  });
});

describe("vérification d'un article", () => {
  const ok = { name: "Gobelet 50 cl", code: "gob-50", famille: "jetable", unit: "carton", defaultThreshold: 5, notes: "" };
  test("article correct accepté", () => {
    assert.equal(verifierArticle(ok), null);
  });
  test("désignation vide ou trop longue refusée", () => {
    assert.equal(verifierArticle({ ...ok, name: "  " })?.field, "name");
    assert.equal(verifierArticle({ ...ok, name: "x".repeat(121) })?.field, "name");
  });
  test("code vide ou invalide refusé", () => {
    assert.equal(verifierArticle({ ...ok, code: "" })?.field, "code");
    assert.equal(verifierArticle({ ...ok, code: "-GOB" })?.field, "code");
    assert.equal(verifierArticle({ ...ok, code: "GOB/50" })?.field, "code");
    assert.equal(verifierArticle({ ...ok, code: "A".repeat(31) })?.field, "code");
  });
  test("famille et unité hors liste refusées", () => {
    assert.equal(verifierArticle({ ...ok, famille: "viande" })?.field, "famille");
    assert.equal(verifierArticle({ ...ok, unit: "tonne" })?.field, "unit");
  });
  test("seuil négatif ou décimal refusé, 0 accepté", () => {
    assert.equal(verifierArticle({ ...ok, defaultThreshold: -1 })?.field, "threshold");
    assert.equal(verifierArticle({ ...ok, defaultThreshold: 1.5 })?.field, "threshold");
    assert.equal(verifierArticle({ ...ok, defaultThreshold: NaN })?.field, "threshold");
    assert.equal(verifierArticle({ ...ok, defaultThreshold: 0 }), null);
  });
});

describe("vérification d'une opération", () => {
  const base = { operation: "livraison", restaurantId: R1, quantite: 3 };
  test("livraison, consommation, perte : quantité entière de 1 ou plus", () => {
    for (const operation of ["livraison", "consommation", "perte"]) {
      assert.equal(verifierOperation({ ...base, operation }), null);
      assert.equal(verifierOperation({ ...base, operation, quantite: 0 })?.field, "quantite");
      assert.equal(verifierOperation({ ...base, operation, quantite: -2 })?.field, "quantite");
      assert.equal(verifierOperation({ ...base, operation, quantite: 2.5 })?.field, "quantite");
    }
  });
  test("inventaire et seuil acceptent 0, pas moins", () => {
    for (const operation of ["inventaire", "seuil"]) {
      assert.equal(verifierOperation({ ...base, operation, quantite: 0 }), null);
      assert.equal(verifierOperation({ ...base, operation, quantite: -1 })?.field, "quantite");
    }
  });
  test("restaurant obligatoire, opération connue", () => {
    assert.equal(verifierOperation({ ...base, restaurantId: "" })?.field, "restaurant");
    assert.ok(verifierOperation({ ...base, operation: "vol" }));
  });
  test("transfert : restaurant d'arrivée obligatoire et différent", () => {
    assert.equal(verifierOperation({ ...base, operation: "transfert" })?.field, "vers");
    assert.equal(verifierOperation({ ...base, operation: "transfert", versId: R1 })?.field, "vers");
    assert.equal(verifierOperation({ ...base, operation: "transfert", versId: R2 }), null);
  });
  test("remarque de 300 caractères au plus", () => {
    assert.equal(verifierOperation({ ...base, note: "x".repeat(300) }), null);
    assert.equal(verifierOperation({ ...base, note: "x".repeat(301) })?.field, "note");
  });
  test("écart d'inventaire = compté − en stock", () => {
    assert.equal(ecartInventaire(12, 15), 3);
    assert.equal(ecartInventaire(15, 10), -5);
    assert.equal(ecartInventaire(4, 4), 0);
  });
});

describe("résumé d'un article", () => {
  const stocks = [
    { restaurant_id: R1, quantity: 3, min_threshold: 5 },
    { restaurant_id: R2, quantity: 10, min_threshold: 5 },
  ];
  test("sous le seuil : strictement inférieur", () => {
    assert.equal(estSousSeuil({ quantity: 4, min_threshold: 5 }), true);
    assert.equal(estSousSeuil({ quantity: 5, min_threshold: 5 }), false);
  });
  test("tous les restaurants : total, restaurants sous le seuil, pas de seuil affiché", () => {
    assert.deepEqual(resumeArticle(stocks), { quantite: 13, seuil: null, suivis: 2, sousSeuil: [R1], statut: "sousLeSeuil" });
  });
  test("un restaurant : sa quantité et son seuil", () => {
    assert.deepEqual(resumeArticle(stocks, R2), { quantite: 10, seuil: 5, suivis: 1, sousSeuil: [], statut: "suffisant" });
  });
  test("aucune ligne : non suivi", () => {
    assert.equal(resumeArticle([]).statut, "nonSuivi");
    assert.equal(resumeArticle(stocks, "r3").statut, "nonSuivi");
    assert.equal(resumeArticle(stocks, "r3").quantite, 0);
  });
});

describe("filtres et tri", () => {
  test("lecture : famille et statut inconnus ignorés", () => {
    assert.deepEqual(lireFiltres({ q: " gob ", restaurant: "CTR1", famille: "viande", statut: "x" }), {
      q: "gob",
      restaurant: "CTR1",
      famille: "",
      statut: "",
    });
    assert.equal(lireFiltres({ famille: "boisson", statut: "sous_seuil" }).statut, "sous_seuil");
    assert.equal(lireFiltres({ q: ["a", "b"] }).q, "");
  });
  test("adresse : seulement les filtres remplis", () => {
    const f = { q: "", restaurant: "CTR1", famille: "", statut: "" };
    assert.equal(filtresQuery(f), "?restaurant=CTR1");
    assert.equal(filtresQuery(f, { statut: "sous_seuil" }), "?restaurant=CTR1&statut=sous_seuil");
    assert.equal(filtresQuery({ ...f, restaurant: "" }), "");
  });
  test("recherche sans accents ni casse, sur désignation et code ; famille", () => {
    const rows = [
      { name: "Thé glacé", code: "THE-01", famille: "boisson" },
      { name: "Gobelet", code: "GOB-50", famille: "jetable" },
    ];
    const f = { q: "", restaurant: "", famille: "", statut: "" };
    assert.equal(appliquerFiltres(rows, { ...f, q: "THE GLACE" }).length, 1);
    assert.equal(appliquerFiltres(rows, { ...f, q: "café" }).length, 0);
    assert.equal(appliquerFiltres(rows, { ...f, q: "gob-5" })[0].code, "GOB-50");
    assert.equal(appliquerFiltres(rows, { ...f, famille: "jetable" })[0].code, "GOB-50");
  });
  test("tri : sous le seuil, puis suivis, puis non suivis, puis par nom", () => {
    const r = (name: string, statut: "sousLeSeuil" | "suffisant" | "nonSuivi") => ({ name, resume: { statut } });
    const tries = trierArticles([r("Zèbre", "suffisant"), r("Banane", "nonSuivi"), r("Abricot", "suffisant"), r("Melon", "sousLeSeuil")]);
    assert.deepEqual(tries.map((x) => x.name), ["Melon", "Abricot", "Zèbre", "Banane"]);
  });
});
