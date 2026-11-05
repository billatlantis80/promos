/**
 * LA FRAÎCHEUR DES DONNÉES — quand l'application doit recharger.
 *
 * Ces contrôles portent sur la règle SEULE (public/maj.js), sans navigateur, sans
 * réseau et sans horloge : chaque cas est fabriqué. C'est voulu — le défaut
 * d'origine (09/10/2026) ne se voyait qu'à l'usage, une application restée
 * ouverte annonçant « mis à jour il y a 3 h » alors que le site était frais. Une
 * règle qu'on ne peut éprouver qu'en laissant un onglet ouvert trois heures n'est
 * pas vérifiable ; celle-ci l'est.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  FICHIER_TEMOIN, DELAI_CONTROLE_MS, dateDuTemoin, peutControler, doitRafraichir,
} from '../public/maj.js';

test('l’application branche VRAIMENT le contrôle — la règle ne sert à rien seule', () => {
  // Leçon du 09/10/2026 : le code peut être juste et jamais appelé. On vérifie
  // donc le CÂBLAGE, pas seulement la règle.
  const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /import \{[^}]*doitRafraichir[^}]*\} from '\.\/maj\.js'/,
    'app.js doit importer la règle de fraîcheur');
  assert.match(app, /addEventListener\('visibilitychange'/,
    'app.js doit écouter le retour au premier plan');
  assert.match(app, /if \(document\.visibilityState === 'visible'\) rafraichirSiBesoin\(\)/,
    'le contrôle ne doit se déclencher qu’au retour visible');
  assert.match(app, /fetch\(BASE \+ FICHIER_TEMOIN, \{ cache: 'no-store' \}\)/,
    'le témoin doit être lu sans cache — sinon il annonce l’ancienne date');
});

test('le témoin est bien un petit fichier, pas le catalogue', () => {
  assert.equal(FICHIER_TEMOIN, 'etat-collecte.json');
  // Le nom ne doit pas confondre le témoin avec ce qu'il annonce.
  assert.notEqual(FICHIER_TEMOIN, 'offres.json');
});

test('une date de témoin valide est lue', () => {
  const t = dateDuTemoin(JSON.stringify({ genereLe: '2026-10-09T22:30:57.134Z', total: 16928 }));
  assert.equal(t, '2026-10-09T22:30:57.134Z');
});

test('un témoin absent, tronqué ou illisible ne fait JAMAIS lever', () => {
  // Le point important : un témoin abîmé ne doit pas casser l'application. Au
  // pire on ne rafraîchit pas — c'est l'état d'avant, jamais pire.
  for (const mauvais of [
    '', '{', 'pas du json', 'null', '[]',
    JSON.stringify({ total: 12 }),                         // pas de date
    JSON.stringify({ genereLe: '' }),                      // date vide
    JSON.stringify({ genereLe: 1750000000000 }),           // date numérique, pas une chaîne
    JSON.stringify({ genereLe: 'hier soir' }),             // date non interprétable
  ]) {
    assert.equal(dateDuTemoin(mauvais), '', `témoin refusé attendu pour : ${String(mauvais).slice(0, 40)}`);
  }
});

test('le mode économie de données interdit tout contrôle', () => {
  // Choix explicite de l'utilisateur : même trois cents octets ne le contournent
  // pas. C'est la règle du projet, et elle se vérifie ici.
  assert.equal(peutControler({ eco: true, depuisMs: Infinity }), false);
  assert.equal(peutControler({ eco: true, depuisMs: 99999999 }), false);
});

test('on ne contrôle pas deux fois coup sur coup', () => {
  assert.equal(peutControler({ eco: false, depuisMs: 0 }), false);
  assert.equal(peutControler({ eco: false, depuisMs: DELAI_CONTROLE_MS - 1 }), false);
  assert.equal(peutControler({ eco: false, depuisMs: DELAI_CONTROLE_MS }), true);
});

test('sans contrôle précédent, on contrôle — c’est le rattrapage', () => {
  // Cas réel : l'application était ouverte AVANT que le témoin n'existe, ou
  // pendant une panne. Le premier retour au premier plan doit rattraper.
  assert.equal(peutControler({ eco: false, depuisMs: Infinity }), true);
});

test('on ne recharge PAS si le témoin n’a pas bougé', () => {
  const date = '2026-10-09T22:30:57.134Z';
  assert.equal(doitRafraichir({ dateLocale: date, dateTemoin: date }), false);
});

test('on recharge dès que le témoin porte une date nouvelle', () => {
  assert.equal(doitRafraichir({
    dateLocale: '2026-10-09T22:25:28.279Z',
    dateTemoin: '2026-10-09T22:30:57.134Z',
  }), true);
});

test('un témoin muet ne déclenche RIEN', () => {
  // Le cas qui compte : témoin manquant (non encore publié, ou serveur qui ne le
  // sert pas). Sans cette garde, `'' !== '2026-…'` vaudrait vrai et l'application
  // retéléchargerait 13 Mo à chaque retour d'onglet, pour rien.
  assert.equal(doitRafraichir({ dateLocale: '2026-10-09T22:30:57.134Z', dateTemoin: '' }), false);
  assert.equal(doitRafraichir({ dateLocale: '', dateTemoin: '' }), false);
});

test('le délai par défaut laisse respirer la collecte', () => {
  // La collecte tourne toutes les cinq minutes : contrôler plus souvent ne
  // pourrait rien apprendre de neuf.
  assert.equal(DELAI_CONTROLE_MS, 5 * 60 * 1000);
});
