/**
 * LE SEUIL D'ARTICLES PAR ENSEIGNE (décision de B, 10/10/2026).
 *
 *   « Donc une enseigne qui n'apporte pas au moins 10 articles dans le
 *     catalogue grâce au lien documenté, elle ne doit pas être interrogée,
 *     jusqu'à quand on trouve une autre solution manuellement. »
 *
 * Ce que la règle règle, et qui a été mesuré avant de l'écrire : des enseignes
 * chargées sans résultat — une visite toutes les trois heures, un échec à chaque
 * visite, et l'alerte « plus de la moitié des sources sont en échec » qui partait
 * toutes les cinq minutes. Une alarme qui sonne toujours ne signale plus rien.
 *
 * Les deux pièges que ces tests verrouillent :
 *   - le compte se fait PAR ENSEIGNE, pas par source (Coolblue a dix adresses
 *     qui apportent 81 articles ensemble : aucune n'en apporte dix à elle seule) ;
 *   - une source JAMAIS interrogée garde sa chance — on ne condamne pas une
 *     adresse qu'on n'a pas essayée.
 *
 * Lancement : node --test tests/seuil-enseigne.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { enseignesSousLeSeuil, sourceEnseigne, TOUTES_SOURCES } from '../collecteur.mjs';

const vuLe = (ids) => Object.fromEntries(ids.map((i) => [i, '2026-10-10T07:00:00.000Z']));

test('le compte se fait par ENSEIGNE, jamais par source', () => {
  // Dix adresses Coolblue qui apportent trois articles chacune : 30 au total.
  const sources = Array.from({ length: 10 }, (_, i) => ({ id: `coolblue-be-${i + 1}`, nom: 'Coolblue', type: 'enseigne' }));
  const par = new Map(sources.map((s) => [s.id, 3]));
  const sous = enseignesSousLeSeuil(sources, par, vuLe(sources.map((s) => s.id)));
  assert.equal(sous.size, 0,
    'aucune adresse n’apporte dix articles seule, mais l’enseigne en apporte trente : elle doit rester interrogée');
});

test('une enseigne sous le seuil, déjà interrogée, n’est plus visitée', () => {
  const sources = [{ id: 'adr-zooplus-be-3', nom: 'Zooplus.be', type: 'enseigne' }];
  const sous = enseignesSousLeSeuil(sources, new Map([['adr-zooplus-be-3', 5]]), vuLe(['adr-zooplus-be-3']));
  assert.equal(sous.size, 1);
  assert.equal(sous.get('adr-zooplus-be-3'), 'Zooplus.be', 'la raison doit dire QUELLE enseigne est en cause');
});

test('une source JAMAIS interrogée garde sa chance', () => {
  const sources = [{ id: 'adr-nouvelle-1', nom: 'Nouvelle Enseigne', type: 'enseigne' }];
  const sous = enseignesSousLeSeuil(sources, new Map(), {});
  assert.equal(sous.size, 0, 'on ne condamne pas une adresse qu’on n’a pas essayée');
});

test('le seuil est bien de 10 articles : 9 arrête, 10 garde', () => {
  const s = [{ id: 'x', nom: 'Enseigne', type: 'enseigne' }];
  assert.equal(enseignesSousLeSeuil(s, new Map([['x', 9]]), vuLe(['x'])).size, 1);
  assert.equal(enseignesSousLeSeuil(s, new Map([['x', 10]]), vuLe(['x'])).size, 0);
});

test('la règle ne vise QUE les enseignes nommées', () => {
  // Un flux de presse, une communauté, une vente flash ne visent pas un
  // marchand : ils ratissent large et n'ont pas à passer ce seuil.
  assert.equal(sourceEnseigne({ id: 'gnews-mode', nom: 'Veille presse', type: 'presse' }), false);
  assert.equal(sourceEnseigne({ id: 'dealabs-tendance', nom: 'Dealabs', type: 'dealabs' }), false);
  assert.equal(sourceEnseigne({ id: 'flash-be', nom: 'Amazon', type: 'flash' }), false);
  assert.equal(sourceEnseigne({ id: 'coolblue-be-1', nom: 'Coolblue', type: 'enseigne' }), true);
  assert.equal(sourceEnseigne({ id: 'bol-be-fr', nom: 'bol.com', type: 'bol' }), true);
  assert.equal(sourceEnseigne({ id: 'enseigne-be-fr-delhaize-delhaizepromotion', nom: 'Delhaize', type: 'presse' }), true,
    'une veille CIBLÉE sur un marchand est bien une source d’enseigne');
});

test('les sources du dépôt qui travaillent ne sont jamais arrêtées', () => {
  // Garde-fou sur les VRAIS identifiants : si un jour le grain du compte change
  // (par source au lieu de par enseigne, par exemple), Coolblue tomberait — et
  // ce test dirait pourquoi.
  const par = new Map();
  const coolblue = TOUTES_SOURCES.filter((s) => s.nom === 'Coolblue');
  for (const s of coolblue) par.set(s.id, Math.floor(81 / coolblue.length) || 1);
  const sous = enseignesSousLeSeuil(TOUTES_SOURCES, par, vuLe(TOUTES_SOURCES.map((s) => s.id)));
  assert.ok(coolblue.length >= 2, 'le dépôt doit encore câbler plusieurs adresses Coolblue');
  assert.ok(!coolblue.some((s) => sous.has(s.id)), 'Coolblue apporte 81 articles : elle ne doit pas être arrêtée');
});
