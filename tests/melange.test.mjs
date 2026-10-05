/**
 * Règles de sélection et MÉLANGE 60 / 40 — application n°2 « Promos ».
 *
 * Ce fichier existe à cause d'un défaut mesuré, pas d'une intention : sur
 * 317 promos à deux prix réels, 311 étaient chez Amazon. L'application
 * s'ouvrait donc sur 98 % d'Amazon — l'inverse du catalogue demandé (60 %
 * d'annonces Amazon en lien direct, 40 % vers les autres grandes enseignes du
 * pays). La règle qui corrige ça est testée ici, parce qu'elle décide de ce que
 * l'utilisateur voit à l'écran, et qu'une régression silencieuse y est
 * indétectable à l'œil.
 *
 * On n'extrait que les règles PURES (aucun accès au DOM) : de « const
 * REMISE_MIN » à la fonction de compte par pays. Les tester isolément évite
 * d'avoir à simuler la page entière.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');

const debut = js.indexOf('const REMISE_MIN');
const fin = js.indexOf('/** Combien de bonnes promotions par pays');
assert.ok(debut > 0 && fin > debut, 'les règles de sélection doivent rester extractibles du fichier');
const code = js.slice(debut, fin);

const ctx = vm.createContext({});
const R = vm.runInContext(`${code}
  ;({ REMISE_MIN, CHALEUR_MIN, PART_AMAZON, MELANGE_MIN, estAmazon, estPromoVerifiee, estOffreEnseigne, estBonPlanPresse, estBonnePromo, dedoublonner, melanger })`, ctx);

/** Fabrique d'offre minimale. */
const offre = (marchand, extra = {}) => ({ marchand, prix: null, prixAvant: null, remise: null, temperature: null, ...extra });

/* ---------------------------------------------------------------- étage 1 */

test('étage 1 : deux prix réels et 15 % suffisent', () => {
  assert.equal(R.estPromoVerifiee(offre('Amazon', { prix: 29.99, prixAvant: 89.99, remise: 67 })), true);
});

test('étage 1 : un pourcentage sans prix de référence ne prouve rien', () => {
  // Le défaut d'origine : « -99 % » qui était « 99 % sRGB » dans un titre.
  assert.equal(R.estPromoVerifiee(offre('Amazon', { prix: 199, remise: 99 })), false);
});

test('étage 1 : sous 15 %, ce n’est pas une promo, c’est un prix', () => {
  assert.equal(R.estPromoVerifiee(offre('Amazon', { prix: 100, prixAvant: 112, remise: 12 })), false);
});

/* ---------------------------------------------------------------- étage 2 */

test('étage 2 : une enseigne avec un prix réel et un score élevé passe', () => {
  assert.equal(R.estOffreEnseigne(offre('MediaMarkt', { prix: 49.5, temperature: 302 })), true);
});

test('étage 2 : une remise annoncée ≥ 15 % passe', () => {
  assert.equal(R.estOffreEnseigne(offre('Cdiscount', { prix: 279.79, remise: 25 })), true);
});

test('étage 2 : un faux pourcentage de 99 % ne qualifie PAS une offre', () => {
  // Cas réel : « Dell P2422H 24" Monitor — 99% sRGB … refurbished ». Le
  // pourcentage vient du titre (« 99 % sRGB »), pas d'un prix barré, et l'offre
  // est entrée dans les « bonnes promos » par cette porte.
  assert.equal(R.estOffreEnseigne(offre('AMSO', { prix: 63.99, remise: 99 })), false);
});

test('étage 3 : la presse est soumise au même plafond de crédibilité', () => {
  assert.equal(R.estBonPlanPresse(offre('Le Parisien', { prix: 30, remise: 95 })), false);
});

test('étage 2 : une offre publiée sur la PAGE D’OFFRES de l’enseigne passe', () => {
  // Cas Coolblue Belgique : prix réel, aucune remise chiffrée, aucun score
  // communautaire. Sans cette règle, la Belgique ne rendait que 8 lignes — le
  // pays de l'utilisateur, sur 12 pays couverts.
  assert.equal(R.estOffreEnseigne(offre('Coolblue', { prix: 367, categorieSource: 'enseigne' })), true);
});

test('étage 2 : un prix réel sans aucun signe de qualité est jeté', () => {
  assert.equal(R.estOffreEnseigne(offre('Quelqu’un', { prix: 12.5, temperature: 40 })), false);
});

test('étage 2 : une RÉDACTION n’est pas une enseigne', () => {
  // « Le Parisien » vend du papier, pas des écouteurs. Sans ce crible, les
  // rédactions remplissaient les 40 % et l'étiquette « enseigne » mentait.
  for (const redac of ['Le Parisien', 'Forbes', 'Les Numériques', 'HDblog.it', 'dslweb', 'Mac4Ever', 'EchantillonsClub.com']) {
    assert.equal(R.estOffreEnseigne(offre(redac, { prix: 30, temperature: 500 })), false, redac);
  }
});

test('étage 2 : le nom de la source n’est pas un marchand', () => {
  for (const faux of ['dealabs', 'pepper', 'presse', 'nl', 'Fr', 'ABC']) {
    assert.equal(R.estOffreEnseigne(offre(faux, { prix: 30, temperature: 900 })), false, faux);
  }
});

test('étage 2 : Amazon n’est jamais compté comme une autre enseigne', () => {
  assert.equal(R.estAmazon(offre('Amazon')), true);
  assert.equal(R.estOffreEnseigne(offre('Amazon', { prix: 10, temperature: 900 })), false);
});

/* ---------------------------------------------------------------- étage 3 */

test('étage 3 : un article de presse avec un vrai prix et une remise est admis', () => {
  // « Les écouteurs Nothing Ear (3) chutent à 96 € au lieu de 179 € » : c'est un
  // vrai bon plan, l'utilisateur a demandé qu'il apparaisse.
  assert.equal(R.estBonPlanPresse(offre('WatchGeneration', { prix: 96, remise: 46 })), true);
});

test('étage 3 : un article de presse SANS prix est refusé', () => {
  assert.equal(R.estBonPlanPresse(offre('Le Parisien', { remise: 40 })), false);
});

test('étage 3 : le nom de la source n’est pas une signature de presse', () => {
  // « dealabs » ne dit pas qui a relevé l'offre : ce n'est pas un article.
  assert.equal(R.estBonPlanPresse(offre('dealabs', { prix: 10, remise: 60 })), false);
});

test('étage 3 : la presse n’est jamais étiquetée « enseigne »', () => {
  const a = offre('WatchGeneration', { prix: 96, remise: 46 });
  assert.equal(R.estBonnePromo(a), true, 'elle doit être admise');
  assert.equal(R.estOffreEnseigne(a), false, 'mais jamais comme une boutique');
});

/* ------------------------------------------------------------ doublons */

test('le même produit au même prix chez deux pays ne compte qu’une fois', () => {
  // Allemagne et Autriche partagent amazon.de : le même Fire TV Stick
  // apparaissait deux fois de suite dans la liste.
  const a = offre('Amazon', { prix: 22.99, titre: 'Fire TV Stick HD (neueste Generation)' });
  const b = { ...a };
  const l = R.dedoublonner([a, b]);
  assert.equal(l.length, 1);
});

test('deux produits différents au même prix restent deux offres', () => {
  const a = offre('Amazon', { prix: 22.99, titre: 'Fire TV Stick HD' });
  const b = offre('Amazon', { prix: 22.99, titre: 'Echo Dot bleu océan' });
  assert.equal(R.dedoublonner([a, b]).length, 2);
});

/* --------------------------------------------------------------- mélange */

test('le mélange tient la proportion 60 / 40', () => {
  const amazon = Array.from({ length: 300 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 120 }, (_, i) => offre('MediaMarkt', { prix: i + 1, temperature: 200 }));
  const l = R.melanger([...amazon, ...autres]);
  const nAmz = l.filter(R.estAmazon).length;
  const part = nAmz / l.length;
  assert.ok(part >= 0.55 && part <= 0.65, `part Amazon ${(part * 100).toFixed(1)} % — attendu ≈ 60 %`);
  assert.equal(l.filter((o) => !R.estAmazon(o)).length, l.length - nAmz, 'aucune ligne Amazon ne doit être déguisée');
});

test('le mélange plafonne les enseignes quand elles sont trop nombreuses', () => {
  // Cas belge mesuré : 44 promos Amazon pour 157 offres d'enseignes. Sans
  // plafond, l'application afficherait 22 % d'Amazon — l'inverse de la cible.
  const amazon = Array.from({ length: 44 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 157 }, (_, i) => offre('Coolblue', { prix: i + 1, temperature: 300 }));
  const l = R.melanger([...amazon, ...autres]);
  const nAmz = l.filter(R.estAmazon).length;
  assert.ok(Math.abs(nAmz / l.length - 0.6) < 0.05, `part Amazon ${(nAmz / l.length * 100).toFixed(1)} %`);
  assert.ok(l.length <= 44 + 31, `total ${l.length} — les enseignes doivent être plafonnées, pas empilées`);
});

test('le mélange est VISIBLE sur la première ligne', () => {
  const amazon = Array.from({ length: 60 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 40 }, (_, i) => offre('Lidl', { prix: i + 1, temperature: 300 }));
  const l = R.melanger([...amazon, ...autres]);
  assert.equal(R.estAmazon(l[0]), true, 'le premier résultat reste une annonce Amazon (c’est le revenu)');
  assert.ok(l.slice(0, 10).some((o) => !R.estAmazon(o)), 'une enseigne doit apparaître dans les 10 premiers résultats');
});

test('sans autre enseigne disponible, rien n’est perdu', () => {
  // Pays sans source d'enseigne lisible (NL, PL, SE, IE, GB, PT mesurés) : le
  // plafond ne doit pas vider l'écran.
  const amazon = Array.from({ length: 29 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const l = R.melanger(amazon);
  assert.equal(l.length, 29);
});

test('dans les 40 %, les boutiques passent avant la presse', () => {
  // Les articles de presse portent souvent deux prix réels, donc un meilleur
  // rang au tri : sans départage explicite, la première page d'un Belge était
  // une suite de « lire le bon plan » au lieu de renvoyer vers les enseignes.
  //
  // Le camp des 40 % est ensuite écrêté d'une ligne (plafond), et c'est la
  // presse — classée en dernier — qui saute : l'article est donc soit ABSENT,
  // soit APRÈS la première boutique, jamais avant. Les deux issues sont
  // conformes ; ce qui serait un défaut, c'est de le voir en tête.
  const amazon = Array.from({ length: 30 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const boutiques = Array.from({ length: 17 }, (_, i) => offre('Coolblue', { prix: i + 1, categorieSource: 'enseigne' }));
  const presse = [offre('Le Parisien', { prix: 50, prixAvant: 100, remise: 50 })];
  const l = R.melanger([...amazon, ...boutiques, ...presse]);
  const iP = l.findIndex((o) => o.marchand === 'Le Parisien');
  const iB = l.findIndex((o) => o.marchand === 'Coolblue');
  assert.ok(iB >= 0, 'une boutique doit être présente');
  assert.ok(iP >= 0, 'la presse doit malgré tout apparaître — c’est le quota de 10 %');
  assert.ok(iP > iB, 'la presse ne doit jamais passer devant la première boutique');
});

test('un pays qui manque d’un côté n’est pas puni deux fois', () => {
  // Cas polonais mesuré : 16 promos Amazon pour 1 seule offre d'enseigne. Tenir
  // la proportion ne laissait que 2 lignes à l'écran — une app qui paraît
  // cassée. Sous MELANGE_MIN, on montre tout, et l'en-tête dit la vraie part.
  const amazon = Array.from({ length: 16 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = [offre('BIKER-BOARDER', { prix: 89, temperature: 140 })];
  const l = R.melanger([...amazon, ...autres]);
  assert.equal(l.length, 17, 'aucune offre réelle ne doit être sacrifiée à la proportion');
});

test('le mélange ne fabrique ni ne supprime aucune offre', () => {
  const amazon = Array.from({ length: 20 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 20 }, (_, i) => offre('Carrefour', { prix: i + 1, temperature: 300 }));
  const l = R.melanger([...amazon, ...autres]);
  const ids = new Set([...amazon, ...autres]);
  for (const o of l) assert.ok(ids.has(o), 'une offre du mélange doit venir de l’entrée');
  assert.equal(new Set(l).size, l.length, 'aucun doublon');
});
