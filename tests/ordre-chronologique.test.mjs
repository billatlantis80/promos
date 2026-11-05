/**
 * ORDRE D'AFFICHAGE DES « BONNES PROMOS » — application n°2 « Promos ».
 *
 * Demande de B (08/10/2026) : « les annonces doivent apparaître dans l'ordre.
 * Les plus récentes d'abord, tout en haut et de manière chronologique. Il ne
 * faut rien adapter au niveau design, c'est juste dans la programmation. »
 *
 * Ce que ces épreuves protègent :
 *   1. la portée « Bonnes promos » (le DÉFAUT de l'application) rend les offres
 *      de la plus récente à la plus ancienne — l'ordre est PUREMENT
 *      chronologique, la remise ne décide plus ;
 *   2. les autres portées ne bougent PAS d'un iota (non-régression) ;
 *   3. le sélecteur n'a pas changé (design intact, comme demandé).
 *
 * Demande de B (13/10/2026) : « adapter la catégorie prix croissant par
 * pourcentage décroissant avec écrit % décroissant ». Le QUATRIÈME choix classe
 * donc désormais par REMISE décroissante (voir « % décroissant » plus bas) ; sa
 * place, sa forme et les trois autres choix sont inchangés.
 *
 * On n'extrait que les règles PURES (aucun accès au DOM) : de « const
 * REMISE_MIN » jusqu'à « function triees » exclue. `etat` est fourni par le bac
 * à sable, puisque la fonction le lit pour décider de la portée et du tri.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { LANGUES } from '../public/langues.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// ⚠ LES RÈGLES VIVENT DANS LEUR MODULE depuis le 15/10/2026 (app.js les importe,
// le panneau d'admin aussi). Ce qui reste dans app.js APRÈS elles et dont ce
// fichier a besoin — `retenue`, `parRecence`, `comparateur` — est lu ici, à sa
// place. L'union des deux EST l'ancienne tranche, mais la partie qui décide
// qu'une offre entre dans la vue n'est plus recopiée : elle est partagée, donc
// deux lecteurs ne peuvent plus diverger (et une tranche textuelle ne peut plus
// amputer un prédicat — c'est le défaut mesuré du 15/10, 875 cartes d'écart).
const moduleRegles = fs.readFileSync(path.join(ICI, '..', 'public', 'regles-affichage.js'), 'utf8')
  .replace(/^export /gm, '');
const appJs = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(ICI, '..', 'public', 'index.html'), 'utf8');

const debutApp = appJs.indexOf('/** Une offre passe-t-elle les filtres courants ? */');
const fin = appJs.indexOf('function triees');
assert.ok(debutApp > 0 && fin > debutApp, 'les filtres et le comparateur doivent rester extractibles de app.js');
const REGLES = moduleRegles.slice(moduleRegles.indexOf('const REMISE_MIN')) + '\n' + appJs.slice(debutApp, fin);

/** Monte un bac à sable avec l'`etat` demandé et rend le comparateur courant. */
function monde(portee = 'promos', tri = 'remise') {
  const ctx = vm.createContext({ etat: { portee, tri } });
  return vm.runInContext(`${REGLES}\n  ;({ comparateur, parRecence })`, ctx);
}

const offre = (id, date, extra = {}) => ({ id, date, titre: id, ...extra });

/* ------------------------------------------------------ la demande de B */

test('portée « Bonnes promos » : la plus récente est en TÊTE, la plus ancienne en queue', () => {
  const { comparateur } = monde('promos', 'remise');
  const l = [
    offre('vieille', '2026-10-01T10:00:00Z'),
    offre('neuve', '2026-10-08T10:00:00Z'),
    offre('milieu', '2026-10-04T10:00:00Z'),
  ];
  assert.deepEqual([...l].sort(comparateur()).map((o) => o.id), ['neuve', 'milieu', 'vieille']);
});

test('portée « Bonnes promos » : l’ordre est PUREMENT chronologique', () => {
  // Le défaut corrigé : une offre à GROSSE remise mais ancienne passait devant
  // une offre récente. Elle ne doit plus le faire.
  const { comparateur } = monde('promos', 'remise');
  const l = [
    offre('grosse-remise-ancienne', '2026-09-20T10:00:00Z',
      { remise: 80, prix: 10, prixAvant: 50, marchand: 'Amazon', temperature: 900 }),
    offre('petite-remise-recente', '2026-10-07T10:00:00Z',
      { remise: 16, prix: 84, prixAvant: 100, marchand: 'Amazon' }),
  ];
  assert.deepEqual([...l].sort(comparateur()).map((o) => o.id),
    ['petite-remise-recente', 'grosse-remise-ancienne']);
});

test('portée « Bonnes promos » : la remise ne décide plus de l’ordre', () => {
  const { comparateur } = monde('promos', 'remise');
  const l = [
    offre('remise-30', '2026-10-06T10:00:00Z', { remise: 30 }),
    offre('remise-20', '2026-10-07T10:00:00Z', { remise: 20 }),
  ];
  // Par remise, 30 passerait devant ; chronologiquement, c'est le 07 qui gagne.
  assert.deepEqual([...l].sort(comparateur()).map((o) => o.id), ['remise-20', 'remise-30']);
});

/* ------------------------------------------ non-régression des autres portées */

test('« Toutes les promos » garde son tri par remise', () => {
  const { comparateur } = monde('tout', 'remise');
  const l = [
    offre('recent-16', '2026-10-07T10:00:00Z',
      { prix: 84, prixAvant: 100, remise: 16, marchand: 'Coolblue' }),
    offre('ancien-60', '2026-09-01T10:00:00Z',
      { prix: 40, prixAvant: 100, remise: 60, marchand: 'Coolblue' }),
  ];
  // Ici la remise décide : 60 % (même ancienne) passe devant 16 %.
  assert.deepEqual([...l].sort(comparateur()).map((o) => o.id), ['ancien-60', 'recent-16']);
});

test('« Plus récentes » : la plus récente en tête', () => {
  const r = monde('tout', 'recent');
  const l = [offre('a', '2026-10-01T10:00:00Z'), offre('b', '2026-10-09T10:00:00Z')];
  assert.deepEqual([...l].sort(r.comparateur()).map((o) => o.id), ['b', 'a']);
});

/* ---------------------------------- « % décroissant » (ex-« Prix croissant ») */

test('« % décroissant » : la REMISE la plus forte en tête, jamais le montant', () => {
  // B, 13/10/2026 : « adapter la catégorie prix croissant par pourcentage
  // décroissant avec écrit % décroissant. »
  const p = monde('tout', 'pourcent');
  const l = [
    offre('remise-20', '2026-10-05T10:00:00Z', { prix: 80, prixAvant: 100, remise: 20 }),
    offre('remise-60-ancienne', '2026-10-01T10:00:00Z', { prix: 40, prixAvant: 100, remise: 60 }),
    offre('sans-remise-la-moins-chere', '2026-10-09T10:00:00Z', { prix: 3 }),
  ];
  // L'ordre suit la REMISE, ni le montant ni la date : 60, 20, puis l'offre sans
  // remise montrable — même si c'est la moins chère et la plus récente.
  assert.deepEqual([...l].sort(p.comparateur()).map((o) => o.id),
    ['remise-60-ancienne', 'remise-20', 'sans-remise-la-moins-chere']);
});

test('« % décroissant » : un pourcentage NON montrable ne classe pas', () => {
  const p = monde('tout', 'pourcent');
  const l = [
    // « 99 % sRGB » dans le titre d'un écran : remise annoncée invraisemblable,
    // jamais écrite sur la carte — elle ne doit donc pas passer devant.
    offre('faux-99', '2026-10-08T10:00:00Z', { remise: 99, prix: 10, prixAvant: 1000 }),
    offre('vraie-30', '2026-10-01T10:00:00Z', { prix: 70, prixAvant: 100, remise: 30 }),
  ];
  assert.deepEqual([...l].sort(p.comparateur()).map((o) => o.id), ['vraie-30', 'faux-99']);
});

test('« % décroissant » : à remise égale, le prix croissant décide', () => {
  const p = monde('tout', 'pourcent');
  const l = [
    offre('cher', '2026-10-09T10:00:00Z', { prix: 80, prixAvant: 100, remise: 20 }),
    offre('bon-marche', '2026-10-01T10:00:00Z', { prix: 40, prixAvant: 50, remise: 20 }),
  ];
  assert.deepEqual([...l].sort(p.comparateur()).map((o) => o.id), ['bon-marche', 'cher']);
});

test('la règle chronologique a UNE seule écriture : « Bonnes promos » et « Plus récentes » ne divergent pas', () => {
  const a = monde('promos', 'remise');
  const b = monde('tout', 'recent');
  const l = [offre('x', '2026-10-02T10:00:00Z'), offre('y', '2026-10-05T10:00:00Z')];
  assert.equal(
    [...l].sort(a.comparateur()).map((o) => o.id).join(','),
    [...l].sort(b.comparateur()).map((o) => o.id).join(','),
    'les deux portées doivent rendre le même ordre');

  // Et la règle n'est écrite qu'UNE fois : les deux chemins renvoient la même
  // fonction, définie une seule fois. Deux copies finiraient par diverger.
  const src = appJs.slice(appJs.indexOf('function comparateur'), appJs.indexOf('function triees'));
  assert.match(src, /if \(etat\.tri === 'recent'\) return parRecence;/, '« Plus récentes » doit passer par parRecence');
  assert.match(src, /if \(etat\.portee === 'promos'\) return parRecence;/, '« Bonnes promos » doit passer par parRecence');
  assert.equal([...appJs.matchAll(/const parRecence\s*=/g)].length, 1,
    'parRecence ne doit être défini qu’une seule fois');
});

/* ------------------------------------------------------ design intact */

test('le sélecteur de portée n’a pas bougé d’un iota — sauf le mot demandé', () => {
  // La demande était explicite : « il ne faut rien adapter au niveau design ».
  const select = (html.match(/<select id="tri"[\s\S]*?<\/select>/) || [''])[0];
  assert.ok(select, 'le sélecteur de portée doit exister');
  for (const v of ['promos', 'tout', 'recent', 'pourcent']) {
    assert.ok(new RegExp(`value="${v}"`).test(select), `l’option « ${v} » doit rester`);
  }
  assert.match(select, /<option value="promos"[^>]*>Bonnes promos<\/option>/,
    'la première option reste « Bonnes promos »');
  // Le quatrième choix : même place, même forme — seul le libellé change.
  assert.match(select, /<option value="pourcent" data-i18n="% décroissant">% décroissant<\/option>/,
    'le quatrième choix s’écrit « % décroissant »');
  assert.ok(!/value="prix"/.test(select), 'l’ancien choix « Prix croissant » ne doit plus exister');
  // Et il est TRADUIT : la clé est le texte français, présente dans les neuf langues.
  for (const code of ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']) {
    assert.ok(LANGUES[code].textes['% décroissant'],
      `la traduction de « % décroissant » manque en ${code}`);
  }
});
