/**
 * LA DEVISE AFFICHÉE — un prix s'affiche dans SA monnaie.
 *
 * DÉFAUT MESURÉ, rapporté par B le 08/10/2026 : « il faut que l'annonce affiche
 * le prix original dans l'annonce et l'adapter si ce n'est pas de l'euro.
 * l'Angleterre est aussi concerné ».
 *
 * Avant correctif, TOUT finissait par « € » — un seul formateur pour toutes les
 * places de marché. Sur le site en ligne : un home trainer Wahoo d'environ 600 €
 * s'affichait « 6 089 € » avec le badge « économise 24 163 € ». Le pourcentage
 * restait juste (un rapport ne dépend pas de la monnaie), et c'est exactement ce
 * qui rendait le montant faux crédible.
 *
 * LA DEVISE DE CHAQUE PLACE DE MARCHÉ A ÉTÉ RELEVÉE, PAS SUPPOSÉE. En lisant
 * la charge des pages Amazon (goldbox) le 08/10/2026 :
 *
 *     amazon.co.uk →  "currencyCode":"GBP"
 *     amazon.pl    →  "currencyCode":"PLN"
 *     amazon.se    →  "currencyIsoCode":"SEK"
 *     amazon.de    →  "currencyCode":"EUR"
 *
 * Un premier test par comparaison de prix avait conclu FAUX : le rapport entre
 * le même produit en Grande-Bretagne et en zone euro valait 0,994, ce qui
 * semblait prouver que les prix britanniques étaient déjà en euros. C'était une
 * erreur de méthode — beaucoup de marques affichent le MÊME NOMBRE dans chaque
 * pays (199 € / £199). La comparaison de prix ne peut pas distinguer « même
 * monnaie » de « parité de prix » ; la devise déclarée par la source, si.
 *
 * CE QUE CE FICHIER PROTÈGE :
 *   1. le bon symbole, au bon endroit, pour chaque monnaie ;
 *   2. l'interdiction absolue d'étiqueter « € » un montant qui n'est pas en
 *      euros — c'est le défaut d'origine ;
 *   3. l'absence de variable qui masque le formateur. Défaut commis en écrivant
 *      ce correctif : la carte portait déjà une variable locale nommée
 *      `montant`, et le nouveau formateur portait le même nom. Le lint ne dit
 *      rien, le fichier reste syntaxiquement valide — mais à l'exécution, le
 *      prix de CHAQUE carte disparaît (« Cannot access 'montant' before
 *      initialization »). Un test de syntaxe ne l'aurait jamais vu.
 *
 * Lancement : node --test tests/devise-affichage.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

/* On extrait le VRAI code du formateur, jamais une recopie. */
const debut = app.indexOf('const DEVISE_PAR_PAYS = {');
const fin = app.indexOf('function ilYA(');
assert.ok(debut > 0 && fin > debut, 'formateur de devise introuvable dans app.js — le fichier a changé de forme');
const extrait = app.slice(debut, fin);

const { DEVISE_PAR_PAYS, DEVISE_EURO, deviseDe, montant } = await import(
  'data:text/javascript;base64,' + Buffer.from(extrait + '\nexport { DEVISE_PAR_PAYS, DEVISE_EURO, deviseDe, montant };').toString('base64')
);

/* ------------------------------------------------------------------ le format -- */

/* Le formatage français sépare les milliers par une ESPACE FINE INSÉCABLE
   (U+202F), pas par une espace ordinaire. Comparer les chaînes telles quelles
   ferait échouer le test sur une différence invisible à l'œil — et l'œil, ici,
   ne peut pas trancher. On normalise donc les espaces avant de comparer. */
const espaces = (s) => String(s).replace(/[\u202f\u00a0\u2009]/g, ' ');

test('un prix en euros garde le symbole € après le nombre', () => {
  assert.equal(espaces(montant(1234.56, DEVISE_EURO)), '1 234,56 €');
  assert.equal(espaces(montant(25, DEVISE_EURO)), '25 €');
});

test('un prix suédois s’affiche en couronnes, pas en euros', () => {
  assert.equal(espaces(montant(6089, DEVISE_PAR_PAYS.SE)), '6 089 kr');
  assert.equal(espaces(montant(2529.89, DEVISE_PAR_PAYS.SE)), '2 529,89 kr');
});

test('un prix polonais s’affiche en złoty, pas en euros', () => {
  assert.equal(espaces(montant(285, DEVISE_PAR_PAYS.PL)), '285 zł');
  assert.equal(espaces(montant(8300, DEVISE_PAR_PAYS.PL)), '8 300 zł');
});

test('un prix britannique s’affiche en livres, symbole AVANT (usage britannique)', () => {
  assert.equal(espaces(montant(153.39, DEVISE_PAR_PAYS.GB)), '£153,39');
  assert.equal(espaces(montant(58.99, DEVISE_PAR_PAYS.GB)), '£58,99');
});

test('un montant absent ne produit rien du tout — ni « null », ni « € »', () => {
  assert.equal(montant(null, DEVISE_EURO), '');
  assert.equal(montant(undefined, DEVISE_PAR_PAYS.SE), '');
});

/* ------------------------------------------------------- la monnaie d'une offre -- */

test('la monnaie se déduit du pays de l’offre', () => {
  assert.equal(deviseDe({ pays: 'SE' }).code, 'SEK');
  assert.equal(deviseDe({ pays: 'PL' }).code, 'PLN');
  assert.equal(deviseDe({ pays: 'GB' }).code, 'GBP');
  for (const p of ['BE', 'FR', 'DE', 'ES', 'IT', 'NL', 'AT', 'IE', 'PT']) {
    assert.equal(deviseDe({ pays: p }).code, 'EUR', `${p} doit être en euros`);
  }
});

test('une offre sans pays, ou nulle, retombe sur l’euro — jamais sur rien', () => {
  assert.equal(deviseDe({}).code, 'EUR');
  assert.equal(deviseDe(null).code, 'EUR');
  assert.equal(deviseDe(undefined).code, 'EUR');
});

/* ------------------------------------------------------ l'interdiction de fond -- */

test('AUCUN pays hors zone euro ne peut afficher « € » — le défaut d’origine', () => {
  const horsEuro = ['SE', 'PL', 'GB'];
  for (const pays of horsEuro) {
    const d = deviseDe({ pays });
    for (const valeur of [0.99, 25, 153.39, 6089, 30252, 99999.99]) {
      const texte = montant(valeur, d);
      assert.ok(!texte.includes('€'),
        `${pays} affiche « ${texte} » : un montant qui n'est pas en euros ne doit JAMAIS porter le symbole €`);
      assert.ok(texte.includes(d.symbole),
        `${pays} affiche « ${texte} » : il devrait porter « ${d.symbole} »`);
    }
  }
});

test('les monnaies déclarées sont bien celles que les sources annoncent', () => {
  // Codes relevés dans la charge des pages Amazon le 08/10/2026.
  const releves = { GB: 'GBP', SE: 'SEK', PL: 'PLN' };
  for (const [pays, code] of Object.entries(releves)) {
    assert.equal(DEVISE_PAR_PAYS[pays].code, code,
      `${pays} : le code déclaré devrait être ${code}, relevé dans la source elle-même`);
  }
});

/* ------------------------------------------------- le masquage du formateur -- */

test('aucune variable locale ne masque le formateur « montant »', () => {
  /* Le formateur lui-même se DÉCLARE : c'est une occurrence légitime, et c'est
     la seule. Défaut commis en écrivant ce correctif : la carte portait déjà
     `const montant = o.prix != null ? …` — une variable locale du même nom que
     le formateur, qui le masquait dans sa propre portée. Le lint ne dit rien,
     le fichier reste valide, et le prix de CHAQUE carte disparaît à
     l'exécution. On exige donc UNE SEULE déclaration, et que ce soit la bonne. */
  const declarations = [...app.matchAll(/\b(?:const|let|var)\s+montant\s*=/g)];
  assert.equal(declarations.length, 1,
    `${declarations.length} déclarations de « montant » : une seule est légitime (le formateur) — toute autre masque le formateur et fait disparaître le prix des cartes`);
  const i = declarations[0].index;
  assert.match(app.slice(i, i + 60), /const\s+montant\s*=\s*\(v,\s*devise\)\s*=>/,
    'la seule déclaration de « montant » doit être le formateur (v, devise)');
  // Et le nom ne doit plus servir de variable ailleurs.
  assert.doesNotMatch(app, /const\s+montant\s*=\s*o\.prix/,
    'une variable locale « montant » est revenue : elle masque le formateur');
});

test('les trois affichages passent bien par le formateur, jamais par un « € » écrit en dur', () => {
  // Aucune concaténation directe d'un euro ne doit subsister.
  const enDur = [...app.matchAll(/' €'|" €"|€`/g)];
  assert.equal(enDur.length, 0, 'un « € » écrit en dur subsiste : il s’appliquerait à toutes les monnaies');
  // Les trois endroits qui montraient un montant doivent appeler montant(…).
  const appels = [...app.matchAll(/montant\(o\.prix/g)];
  assert.ok(appels.length >= 3, `attendu au moins 3 affichages de prix passant par le formateur, trouvé ${appels.length}`);
  // Et ils doivent tous connaître la devise de l'offre.
  const sansDevise = [...app.matchAll(/montant\(o\.[A-Za-z]+(?: - o\.[A-Za-z]+)?\)/g)];
  assert.equal(sansDevise.length, 0, 'un montant affiché sans sa devise retomberait en euros');
});
