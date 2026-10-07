/**
 * HISTORIQUE DES PRIX ET VERDICTS — application n°2.
 *
 * Ce qui est réellement protégé ici n'est pas « le code tourne », mais les deux
 * règles qui font la valeur de la fonctionnalité — et qui, cassées, la
 * transformeraient en machine à raconter n'importe quoi :
 *
 *   1. on ne parle QUE si l'on a assez de recul (sinon « plus bas depuis
 *      30 jours » sur deux jours d'observation = un mensonge) ;
 *   2. on n'affiche que des valeurs RÉELLEMENT relevées — un extremum ou une
 *      médiane, jamais une estimation.
 *
 * Lancement : node --test tests/prix-historique.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  noterPrix, elaguerHistorique, analyseArticle, verdictPour, appliquerAnalyse,
  MIN_JOURS_POUR_PARLER, FENETRE_JOURS,
} from '../prix-historique.mjs';

const hist = (jours) => ({ version: 1, jours });
const offre = (o = {}) => ({ id: 'A1', prix: 10, ...o });

/** Construit un historique de N jours consécutifs pour un article. */
function surNJours(id, valeurs) {
  const j = {};
  valeurs.forEach((v, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
    j[d] = { [id]: [v, v] };
  });
  return hist(j);
}

test('noterPrix garde la FOURCHETTE du jour : le min baisse, le max monte', () => {
  const h = hist({});
  noterPrix(h, [{ id: 'A1', prix: 20 }], '2026-10-07T08:00:00Z');
  assert.deepEqual(h.jours['2026-10-07'].A1, [20, 20]);
  noterPrix(h, [{ id: 'A1', prix: 15 }], '2026-10-07T09:00:00Z');
  assert.deepEqual(h.jours['2026-10-07'].A1, [15, 20], 'le minimum doit descendre');
  noterPrix(h, [{ id: 'A1', prix: 25 }], '2026-10-07T10:00:00Z');
  assert.deepEqual(h.jours['2026-10-07'].A1, [15, 25], 'le maximum doit monter');
});

test('un prix absent, nul ou négatif n’est JAMAIS noté', () => {
  const h = hist({});
  noterPrix(h, [
    { id: 'A1' }, { id: 'A2', prix: 0 }, { id: 'A3', prix: -3 },
    { id: 'A4', prix: 'pas un nombre' }, { prix: 12 },
  ], '2026-10-07T08:00:00Z');
  assert.deepEqual(h.jours['2026-10-07'], {}, 'aucune valeur inventée');
});

test('analyseArticle se TAIT quand l’article n’a jamais été vu', () => {
  assert.equal(analyseArticle(hist({}), 'INCONNU', 10), null);
  assert.equal(analyseArticle(null, 'A1', 10), null);
});

test('sous le seuil de recul, le verdict ne parle pas', () => {
  // 3 jours seulement : bien en dessous de MIN_JOURS_POUR_PARLER.
  const h = surNJours('A1', [30, 30, 30]);
  const a = analyseArticle(h, 'A1', 12);
  assert.equal(a.jours, 3);
  assert.ok(a.jours < MIN_JOURS_POUR_PARLER);
  const v = verdictPour({ id: 'A1', prix: 12, prixAvant: 30, remise: 60 }, a);
  assert.equal(v.code, 'inconnu', 'pas de « bon plan » sans recul suffisant');
});

test('assez de recul + au plus bas + remise réelle = bon plan rare', () => {
  const h = surNJours('A1', [30, 29, 28, 27, 26]);   // 5 jours
  const a = analyseArticle(h, 'A1', 20);
  assert.equal(a.jours, MIN_JOURS_POUR_PARLER);
  assert.equal(a.estPlusBas, true);
  assert.equal(verdictPour({ id: 'A1', prix: 20, prixAvant: 30, remise: 33 }, a).code, 'bonPlanRare');
});

test('un prix barré JAMAIS constaté et nettement supérieur est signalé', () => {
  // Relevés entre 20 et 22 €, mais un prix barré à 90 € : jamais vu chez nous.
  const h = surNJours('A1', [22, 21, 21, 20, 22]);
  const a = analyseArticle(h, 'A1', 20);
  const v = verdictPour({ id: 'A1', prix: 20, prixAvant: 90, remise: 78 }, a);
  assert.equal(v.code, 'referenceDouteuse');
  assert.ok(v.pct >= 300, `écart attendu énorme, obtenu ${v.pct}`);
});

test('un prix barré COHÉRENT avec nos relevés n’est pas signalé', () => {
  // On a réellement vu 40 € : le prix barré est plausible.
  const h = surNJours('A1', [40, 40, 40, 40, 40]);
  const a = analyseArticle(h, 'A1', 30);
  const v = verdictPour({ id: 'A1', prix: 30, prixAvant: 40, remise: 25 }, a);
  assert.notEqual(v.code, 'referenceDouteuse');
});

test('prix demandé supérieur au prix barré = incohérence', () => {
  const a = analyseArticle(surNJours('A1', [10, 10, 10, 10, 10]), 'A1', 12);
  assert.equal(verdictPour({ id: 'A1', prix: 12, prixAvant: 10 }, a).code, 'incoherent');
});

test('nettement sous son prix habituel, sans être au plus bas', () => {
  const h = surNJours('A1', [10, 20, 20, 20, 20]);   // habituel = 20
  const a = analyseArticle(h, 'A1', 16);
  assert.equal(a.prixHabituel, 20);
  assert.equal(a.estPlusBas, false);
  assert.equal(a.sousPrixHabituel, 20);
  assert.equal(verdictPour({ id: 'A1', prix: 16 }, a).code, 'sousPrixHabituel');
});

test('le prix habituel est une MÉDIANE des minima, pas une moyenne', () => {
  // Un jour à 1 € ne doit pas tirer le « prix habituel » vers le bas.
  const h = surNJours('A1', [1, 20, 20, 20, 20]);
  const a = analyseArticle(h, 'A1', 18);
  assert.equal(a.prixHabituel, 20);
  assert.equal(a.prixBas, 1);
});

test('l’élagage supprime les jours trop vieux, et garde la fenêtre', () => {
  const h = hist({
    '2026-08-07': { A1: [9, 9] },   // 61 jours avant le 2026-10-07 -> dehors
    '2026-08-08': { A1: [9, 9] },   // exactement à la limite -> dedans
    '2026-10-07': { A1: [5, 5] },
  });
  elaguerHistorique(h, '2026-10-07T12:00:00Z');
  assert.ok(!h.jours['2026-08-07'], 'un jour hors fenêtre doit disparaître');
  assert.ok(h.jours['2026-08-08'], 'la limite exacte doit être conservée');
  assert.ok(h.jours['2026-10-07']);
  assert.equal(FENETRE_JOURS, 60);
});

test('appliquerAnalyse n’ajoute RIEN à une offre sans historique', () => {
  // Le fichier publié ne doit pas gonfler de champs vides pour 10 000 offres
  // vues pour la première fois.
  const o = [offre({ id: 'JAMAIS-VU' })];
  const bilan = appliquerAnalyse(hist({}), o);
  assert.equal(bilan.avec, 0);
  assert.equal('analyse' in o[0], false);
  assert.equal('verdict' in o[0], false);
});

test('appliquerAnalyse pose l’analyse ET le verdict quand l’historique existe', () => {
  const h = surNJours('A1', [30, 29, 28, 27, 26]);
  const o = [offre({ id: 'A1', prix: 20, prixAvant: 30, remise: 33 })];
  const bilan = appliquerAnalyse(h, o);
  assert.equal(bilan.avec, 1);
  assert.equal(bilan.verdicts, 1);
  assert.equal(o[0].analyse.jours, 5);
  assert.equal(o[0].analyse.prixBas, 26);
  assert.equal(o[0].verdict.code, 'bonPlanRare');
});
