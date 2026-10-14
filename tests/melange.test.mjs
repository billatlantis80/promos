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
import { TOUTES_SOURCES } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');

const debut = js.indexOf('const REMISE_MIN');
// La tranche testée va jusqu'à `retenue` : elle doit contenir les règles de
// sélection ET le rattachement au pays de la boutique (paysDe), qui vit après
// le compte par pays. S'arrêter au commentaire de promosParPays laissait paysDe
// hors tranche, et le fichier de tests entier échouait.
const fin = js.indexOf('/** Une offre passe-t-elle les filtres courants ? */');
assert.ok(debut > 0 && fin > debut, 'les règles de sélection doivent rester extractibles du fichier');
const code = js.slice(debut, fin);

const ctx = vm.createContext({});

/* DEUX MONDES, ET POURQUOI IL EN FAUT DEUX.
 *
 * Le mélange 60/40 est EN PAUSE (B, 08/10/2026). Mais la règle est toujours
 * écrite, et elle doit rester VRAIE : le jour où on la rallume, personne ne
 * veut découvrir qu'elle a dérivé pendant sa dormance — une règle qu'on
 * réécrit de mémoire est une règle qu'on réintroduit avec ses anciens défauts.
 *
 * Les épreuves du 60/40 sont donc rejouées dans un contexte où l'interrupteur
 * est forcé sur « actif » (M). Celles qui suivent, sur R, vérifient ce que B
 * voit AUJOURD'HUI : aucune préférence, et rien de sacrifié.
 */
const MELANGE_ACTIF = /const MELANGE_ACTIF = (true|false)/.exec(code)?.[1] === 'true';
const codeActif = code.replace(/const MELANGE_ACTIF = (true|false);/, 'const MELANGE_ACTIF = true;');
const EXPOSER = '({ REMISE_MIN, CHALEUR_MIN, CHALEUR_AFFAIRE, REMISE_ANNONCEE_MAX, PART_AMAZON, MELANGE_MIN, MELANGE_ACTIF, estAmazon, estPromoVerifiee, estOffreEnseigne, estBonPlanPresse, estBonneAffaire, estBonnePromo, SOURCE_COMMUNAUTE, paysDe, PAYS_BOUTIQUE, dedoublonner, melanger, entrelacer })';

const R = vm.runInContext(`${code}\n  ;${EXPOSER}`, ctx);                              // en pause
const M = vm.runInContext(`${codeActif}\n  ;${EXPOSER}`, vm.createContext({}));         // rallumé

/* ------------------------------------------------- le pays de la boutique */

test('le pays de la BOUTIQUE l’emporte sur celui de la source', () => {
  // Décision du propriétaire du produit : un bon plan relayé par une source
  // étrangère doit aller sous le pays de la boutique, sinon il disparaît du
  // filtre de l'utilisateur de ce pays.
  assert.equal(R.paysDe({ marchand: 'Tesco', pays: 'NL' }), 'GB');
  assert.equal(R.paysDe({ marchand: 'Allegro', pays: 'GB' }), 'PL');
  assert.equal(R.paysDe({ marchand: 'Colruyt', pays: 'NL' }), 'BE');
});

test('une enseigne présente dans PLUSIEURS pays n’est jamais rattachée', () => {
  // Amazon, Media Markt, Coolblue, Lidl, Carrefour… : leur attribuer un pays
  // serait une devinette, donc on garde celui de la source.
  for (const m of ['Amazon', 'MediaMarkt', 'Coolblue', 'Lidl', 'Carrefour', 'Zalando', 'Ikea', 'Steam', 'Kaufland', 'eBay']) {
    assert.equal(R.paysDe({ marchand: m, pays: 'AT' }), 'AT', m);
    assert.equal(R.PAYS_BOUTIQUE.has(m.toLowerCase()), false, `${m} ne doit pas figurer dans la table`);
  }
});

test('une boutique inconnue garde le pays de sa source', () => {
  assert.equal(R.paysDe({ marchand: 'Bazar du coin', pays: 'SE' }), 'SE');
  assert.equal(R.paysDe({ marchand: '', pays: 'IT' }), 'IT');
  assert.equal(R.paysDe({ marchand: 'X' }), 'FR', 'sans pays du tout, la lecture juste reste FR');
});

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

test('étage 2 : une page « offres » sans réduction ne suffit PAS', () => {
  // Coolblue : sa page d'offres est un catalogue à prix nu — 22 produits, 5
  // avec un prix de référence, un seul ≥ 15 %. L'accepter remplissait
  // l'application d'annonces sans réduction et sans intérêt.
  assert.equal(R.estOffreEnseigne(offre('Coolblue', { prix: 367, categorieSource: 'enseigne' })), false);
});

test('étage 2 : une enseigne AVEC une vraie réduction passe toujours', () => {
  // Le même Coolblue, quand un prix de référence réel existe (−15 %).
  assert.equal(R.estOffreEnseigne(offre('Coolblue', {
    prix: 69, prixAvant: 81, remise: 15, remiseCalculee: true, categorieSource: 'enseigne',
  })), true);
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
  assert.equal(M.estAmazon(offre('Amazon')), true);
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

/* ---------------------------------------------------------------- étage 4 */

test('étage 4 : une boutique sans prix relayée par une communauté passe', () => {
  // Bol, Tesco, Argos, Media Expert… : leurs prix ne sont pas lisibles. On
  // affiche la bonne affaire sans prix plutôt que de perdre l'enseigne.
  const a = { ...offre('Tesco', { temperature: 200 }), sourceId: 'hotukdeals', titre: 'Xbox Series S', lienPage: 'https://exemple' };
  assert.equal(R.estBonneAffaire(a), true);
});

test('étage 4 : hors communauté, une offre sans prix n’est pas une bonne affaire', () => {
  // Un journal signe son article de son propre nom : ce n'est pas une boutique.
  const a = { ...offre('Boulanger', { temperature: 400 }), sourceId: 'presse-be-fr-1', titre: 'Un PC', lienPage: 'https://exemple' };
  assert.equal(R.estBonneAffaire(a), false);
});

test('étage 4 : sans popularité, on ne relaie pas', () => {
  const a = { ...offre('Bol', { temperature: 40 }), sourceId: 'pepper-nl', titre: 'Un truc', lienPage: 'https://exemple' };
  assert.equal(R.estBonneAffaire(a), false);
});

test('étage 4 : une offre AVEC prix n’est pas une bonne affaire', () => {
  const a = { ...offre('Bol', { prix: 19.99, temperature: 400 }), sourceId: 'pepper-nl', titre: 'Un truc', lienPage: 'https://exemple' };
  assert.equal(R.estBonneAffaire(a), false, 'elle relève des étages 1 ou 2');
});

test('étage 4 : Amazon est exclu — ses offres se prouvent par leurs prix', () => {
  const a = { ...offre('Amazon', { temperature: 900 }), sourceId: 'hotukdeals', titre: 'Echo Dot', lienPage: 'https://exemple' };
  assert.equal(R.estBonneAffaire(a), false);
});

test('étage 4 : il faut un titre et un lien, sinon il n’y a rien à montrer', () => {
  const sansTitre = { ...offre('Tesco', { temperature: 200 }), sourceId: 'hotukdeals', lienPage: 'https://exemple' };
  assert.equal(R.estBonneAffaire(sansTitre), false);
  const sansLien = { ...offre('Tesco', { temperature: 200 }), sourceId: 'hotukdeals', titre: 'Xbox' };
  assert.equal(R.estBonneAffaire(sansLien), false);
});

test('le crible « communauté » couvre EXACTEMENT les sources de communauté', () => {
  // Sinon la règle dérive en silence : une source de communauté ajoutée plus
  // tard ne serait jamais relayée, ou une source de presse le serait à tort.
  const sources = TOUTES_SOURCES.map((s) => ({ id: s.id, type: s.type }));
  const communautes = sources.filter((s) => s.type === 'dealabs');
  const autres = sources.filter((s) => s.type !== 'dealabs');
  assert.ok(communautes.length >= 7, 'les 7 communautés doivent être déclarées');
  for (const s of communautes) assert.ok(R.SOURCE_COMMUNAUTE.test(s.id), `${s.id} doit être reconnue comme communauté`);
  for (const s of autres) assert.ok(!R.SOURCE_COMMUNAUTE.test(s.id), `${s.id} ne doit PAS passer pour une communauté`);
});

test('les bonnes affaires sont réparties, jamais entassées à la fin', () => {
  // Entassées, il fallait dérouler plus de 1 600 cartes pour en croiser une.
  const boutiques = Array.from({ length: 20 }, (_, i) => ({ m: `B${i}` }));
  const affaires = Array.from({ length: 6 }, (_, i) => ({ m: `A${i}` }));
  const l = R.entrelacer(boutiques, affaires, boutiques.length / (boutiques.length + affaires.length));
  assert.equal(l.length, 26, 'aucune ligne ne doit être perdue');
  const premiere = l.findIndex((o) => o.m.startsWith('A'));
  assert.ok(premiere >= 0, 'au moins une bonne affaire doit sortir');
  assert.ok(premiere <= Math.ceil(l.length / 3), `première bonne affaire au rang ${premiere} sur ${l.length} — trop loin`);
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

test('rallumé : le mélange tient la proportion 60 / 40', () => {
  const amazon = Array.from({ length: 300 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 120 }, (_, i) => offre('MediaMarkt', { prix: i + 1, temperature: 200 }));
  const l = M.melanger([...amazon, ...autres]);
  const nAmz = l.filter(M.estAmazon).length;
  const part = nAmz / l.length;
  assert.ok(part >= 0.55 && part <= 0.65, `part Amazon ${(part * 100).toFixed(1)} % — attendu ≈ 60 %`);
  assert.equal(l.filter((o) => !M.estAmazon(o)).length, l.length - nAmz, 'aucune ligne Amazon ne doit être déguisée');
});

test('rallumé : le mélange plafonne les enseignes quand elles sont trop nombreuses', () => {
  // Cas belge mesuré : 44 promos Amazon pour 157 offres d'enseignes. Sans
  // plafond, l'application afficherait 22 % d'Amazon — l'inverse de la cible.
  const amazon = Array.from({ length: 44 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 157 }, (_, i) => offre('Coolblue', { prix: i + 1, temperature: 300 }));
  const l = M.melanger([...amazon, ...autres]);
  const nAmz = l.filter(M.estAmazon).length;
  assert.ok(Math.abs(nAmz / l.length - 0.6) < 0.05, `part Amazon ${(nAmz / l.length * 100).toFixed(1)} %`);
  assert.ok(l.length <= 44 + 31, `total ${l.length} — les enseignes doivent être plafonnées, pas empilées`);
});

test('rallumé : le mélange est VISIBLE sur la première ligne', () => {
  const amazon = Array.from({ length: 60 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 40 }, (_, i) => offre('Lidl', { prix: i + 1, temperature: 300 }));
  const l = M.melanger([...amazon, ...autres]);
  assert.equal(M.estAmazon(l[0]), true, 'le premier résultat reste une annonce Amazon (c’est le revenu)');
  assert.ok(l.slice(0, 10).some((o) => !M.estAmazon(o)), 'une enseigne doit apparaître dans les 10 premiers résultats');
});

test('rallumé : sans autre enseigne disponible, rien n’est perdu', () => {
  // Pays sans source d'enseigne lisible (NL, PL, SE, IE, GB, PT mesurés) : le
  // plafond ne doit pas vider l'écran.
  const amazon = Array.from({ length: 29 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const l = M.melanger(amazon);
  assert.equal(l.length, 29);
});

test('rallumé : dans les 40 %, les boutiques passent avant la presse', () => {
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
  const l = M.melanger([...amazon, ...boutiques, ...presse]);
  const iP = l.findIndex((o) => o.marchand === 'Le Parisien');
  const iB = l.findIndex((o) => o.marchand === 'Coolblue');
  assert.ok(iB >= 0, 'une boutique doit être présente');
  assert.ok(iP >= 0, 'la presse doit malgré tout apparaître — c’est le quota de 10 %');
  assert.ok(iP > iB, 'la presse ne doit jamais passer devant la première boutique');
});

test('rallumé : un pays qui manque d’un côté n’est pas puni deux fois', () => {
  // Cas polonais mesuré : 16 promos Amazon pour 1 seule offre d'enseigne. Tenir
  // la proportion ne laissait que 2 lignes à l'écran — une app qui paraît
  // cassée. Sous MELANGE_MIN, on montre tout, et l'en-tête dit la vraie part.
  const amazon = Array.from({ length: 16 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = [offre('BIKER-BOARDER', { prix: 89, temperature: 140 })];
  const l = M.melanger([...amazon, ...autres]);
  assert.equal(l.length, 17, 'aucune offre réelle ne doit être sacrifiée à la proportion');
});

test('rallumé : le mélange ne fabrique ni ne supprime aucune offre', () => {
  const amazon = Array.from({ length: 20 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 20 }, (_, i) => offre('Carrefour', { prix: i + 1, temperature: 300 }));
  const l = M.melanger([...amazon, ...autres]);
  const ids = new Set([...amazon, ...autres]);
  for (const o of l) assert.ok(ids.has(o), 'une offre du mélange doit venir de l’entrée');
  assert.equal(new Set(l).size, l.length, 'aucun doublon');
});

/* ============================================================ LE 60/40 EN PAUSE
 *
 * B (08/10/2026) : « mettre en pause le 60/40 en faveur d'Amazon, tous les
 * acteurs affichent en fonction de ce qu'il publie, sans préférence. »
 *
 * Ce que ces épreuves protègent : que la pause SOIT une pause — c'est-à-dire
 * qu'aucun camp ne soit servi, qu'aucune offre réelle ne soit sacrifiée à un
 * pourcentage, et que l'interrupteur soit le SEUL endroit qui décide. Une pause
 * qu'on pourrait contourner ailleurs ne serait pas une pause, et c'est
 * exactement le genre d'écart qu'on ne voit pas à l'œil sur une page qui marche.
 */

test('la pause est réelle dans le fichier publié', () => {
  assert.equal(MELANGE_ACTIF, false, 'le mélange doit être en pause');
  assert.equal(R.MELANGE_ACTIF, false, 'le monde des épreuves doit refléter le fichier');
  assert.equal(M.MELANGE_ACTIF, true, 'et l’épreuve doit pouvoir le rallumer');
});

test('EN PAUSE : l’ordre suit ce que chaque acteur publie, sans préférence', () => {
  // Amazon publie moins bien (intérêt 100), MediaMarkt publie mieux (300).
  // En pause, c'est MediaMarkt qui vient en tête : aucun camp n'est servi —
  // c'est précisément ce que « sans préférence » veut dire.
  const amazon = Array.from({ length: 30 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2, temperature: 100 }));
  const autres = Array.from({ length: 30 }, (_, i) => offre('MediaMarkt', { prix: i + 1, temperature: 300 }));
  const parInteret = (a, b) => (b.temperature || 0) - (a.temperature || 0);
  const l = R.melanger([...amazon, ...autres], parInteret);
  assert.equal(l.length, 60);
  assert.equal(l[0].marchand, 'MediaMarkt', 'le mieux classé doit passer devant, quel que soit l’acteur');
  assert.equal(l[l.length - 1].marchand, 'Amazon');
  // Et le résultat est EXACTEMENT l'entrée triée : rien d'autre n'est décidé.
  // On compare une PROJECTION mise en TEXTE (marchand + prix), pas des
  // tableaux : les valeurs rendues par les règles viennent d'un autre
  // « royaume » JavaScript (vm.createContext), donc leurs tableaux n'ont pas
  // le prototype du nôtre. Mesuré : une comparaison stricte de tableaux
  // échouait avec « same structure but are not reference-equal » alors que le
  // contenu était identique ligne pour ligne — un faux échec, exactement le
  // genre qui fait perdre une heure et qu'on finit par « réparer » en
  // affaiblissant l'épreuve.
  const signature = (o) => `${o.marchand}#${o.prix}`;
  assert.equal(l.map(signature).join(' | '),
    [...amazon, ...autres].sort(parInteret).map(signature).join(' | '));
});

test('EN PAUSE : aucune offre réelle n’est sacrifiée à une proportion', () => {
  // Le cas belge mesuré : 44 promos Amazon pour 157 offres d'enseignes.
  // Rallumé, le plafond ramenait la liste à ~75 lignes — plus de 120 offres
  // réelles disparaissaient de l'écran, et rien ne le disait.
  const amazon = Array.from({ length: 44 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 157 }, (_, i) => offre('Coolblue', { prix: i + 1, temperature: 300 }));
  const enPause = R.melanger([...amazon, ...autres]);
  const rallume = M.melanger([...amazon, ...autres]);
  assert.equal(enPause.length, 201, 'en pause, TOUTES les offres doivent être rendues');
  assert.ok(rallume.length < enPause.length,
    'preuve que le plafond, lui, retire bien des offres : c’est ce qui justifie la pause');
});

test('EN PAUSE : rien d’inventé, rien de dupliqué', () => {
  const amazon = Array.from({ length: 20 }, (_, i) => offre('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
  const autres = Array.from({ length: 20 }, (_, i) => offre('Carrefour', { prix: i + 1, temperature: 300 }));
  const entree = [...amazon, ...autres];
  const l = R.melanger(entree, (a, b) => (b.remise || 0) - (a.remise || 0));
  assert.equal(l.length, entree.length, 'aucune offre ne doit être perdue ni ajoutée');
  for (const o of l) assert.ok(entree.includes(o), 'une offre rendue doit venir de l’entrée');
  assert.equal(new Set(l).size, l.length, 'aucun doublon');
});

test('EN PAUSE : la pause ne change QUE l’ordre, jamais la sélection', () => {
  // Le 60/40 ne filtrait pas les offres : il décidait de leur ordre, et le
  // plafond retirait la queue. En pause, on reçoit donc exactement ce que la
  // sélection a laissé passer — ni plus (aucune offre « autorisée » en plus),
  // ni moins. Sans cette épreuve, une pause mal placée pourrait faire entrer
  // dans la liste des offres que les filtres avaient écartées.
  const liste = Array.from({ length: 50 }, (_, i) => offre(i % 2 ? 'Amazon' : 'Lidl', { prix: i + 1, remise: 40, prixAvant: (i + 1) * 2 }));
  const l = R.melanger(liste, (a, b) => b.remise - a.remise);
  assert.deepEqual(new Set(l.map((o) => o.prix)).size, new Set(liste.map((o) => o.prix)).size);
  assert.equal(l.length, liste.length);
});

test('l’interrupteur est le SEUL endroit qui décide', () => {
  const corps = js.match(/function melanger\(liste, cmp\) \{[\s\S]*?\n\}/);
  assert.ok(corps, 'melanger() doit exister dans app.js');
  assert.match(corps[0], /if \(!MELANGE_ACTIF\) return \[\.\.\.liste\]\.sort\(tri\);/,
    'la sortie de pause doit être la première décision de melanger()');
  // Et la règle est toujours là, intacte, derrière la pause : le jour où on la
  // rallume, on ne la réécrit pas de mémoire.
  assert.match(corps[0], /PART_AMAZON/, 'la règle 60/40 doit rester écrite, pas effacée');
  assert.match(corps[0], /QUOTA_PRESSE|nPresse/, 'ses quotas doivent rester en place');
});

test('la pause est annoncée dans le code, avec sa raison et sa date', () => {
  // Une règle désactivée sans motif écrit se rallume par erreur six mois plus
  // tard, ou se fait supprimer par quelqu'un qui la croit morte.
  assert.match(js, /MÉLANGE 60 % \/ 40 % — EN PAUSE/);
  assert.match(js, /sans préférence/, 'la décision de B doit être citée');
  assert.match(js, /EN PAUSE, PAS SUPPRESSION/);
});
