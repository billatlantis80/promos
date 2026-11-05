/**
 * LES DATES IMPOSSIBLES — application n°2 « Promos ».
 *
 * Défaut signalé par B (13/10/2026), mot pour mot :
 *   « Pourquoi cet article est sorti il y a une minute, or qu'il a été publié le
 *     05/10/26 à 12h00. Nous sommes le 13 octobre, donc 8 jours plus tard. Cet
 *     article de presse ne devrait pas réapparaître. Maximum 7 jours de durée de
 *     vie pour tout article de presse. »
 *
 * Vérifié, et la cause est nommée : l'article des Numériques publié le
 * 05/10/2026 12:00 (sa propre page porte `datePublished: 2026-10-05T12:00:00+02:00`)
 * était arrivé chez nous daté du **05/10/2027** — même heure, un an plus tard.
 * La date de la source était recopiée telle quelle, et TROIS règles se
 * retournaient alors contre nous :
 *   1. la carte annonçait « il y a 1 min » à perpétuité (l'écart négatif est
 *      ramené à une minute par `ilYA` — voir docs/app.js) ;
 *   2. elle tenait la TÊTE du tri « plus récentes » — donc la tête du site, ce
 *      que B a vu ;
 *   3. la fenêtre de veille s'écrit « date > maintenant − 7 jours » : vraie à
 *      jamais pour une date future, donc la limite de 7 jours de B ne pouvait
 *      pas mordre, et l'article ne périmait pas.
 *
 * Ces épreuves tiennent les trois maillons : la réparation dans la passe
 * d'assainissement, son annonce au journal, et le garde-fou sur les DONNÉES
 * RÉELLEMENT PUBLIÉES — celui qui aurait attrapé le défaut en production.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARGE_HORLOGE_MS } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const COLLECTEUR = fs.readFileSync(path.join(ICI, '..', 'collecteur.mjs'), 'utf8');

/* ------------------------------------------------------------------ *
 *  1. La marge est une vraie marge : au moins un fuseau horaire, au
 *     plus du raisonnable. Trop courte, elle réécrirait des dates justes
 *     (une source qui écrit son heure locale paraît en avance de 13 h) ;
 *     trop large, elle laisserait passer un an d'écart.
 * ------------------------------------------------------------------ */
test('la marge d’horloge tolère un fuseau, pas une horloge fausse', () => {
  assert.ok(MARGE_HORLOGE_MS >= 13 * 3600 * 1000,
    'une source qui écrit son heure locale sans son fuseau peut paraître en avance de 13 h');
  assert.ok(MARGE_HORLOGE_MS <= 7 * 24 * 3600 * 1000,
    'au-delà d’une semaine, une date fausse d’un an passerait encore pour valable');
});

/* ------------------------------------------------------------------ *
 *  2. La réparation existe, dans la passe d'assainissement — donc elle
 *     est RÉTROACTIVE, comme le reclassement et la remise : une offre
 *     engrangée avant la correction ne se répare jamais toute seule.
 * ------------------------------------------------------------------ */
test('une date dans le futur est rendue à la première vue du stock', () => {
  const bloc = COLLECTEUR
    .split("UNE DATE DANS LE FUTUR N'EST PAS UNE DATE DE PUBLICATION")[1]
    .split('return c;')[0];
  assert.ok(bloc.length > 400, `le bloc de réparation doit être identifiable (${bloc.length} caractères)`);
  assert.match(bloc, /quandDate > departPassage \+ MARGE_HORLOGE_MS/,
    'la réparation doit comparer la date à l’heure du passage, marge comprise');
  assert.match(bloc, /c\.date = c\.premiereVue \|\| c\.vuLe/,
    'la date impossible doit être remplacée par le premier repère honnête gardé');
  assert.match(bloc, /c\.dateFuture = true/,
    'l’offre réparée doit porter la marque — c’est elle qui rend le défaut mesurable');
});

/* ------------------------------------------------------------------ *
 *  3. La réparation est ANNONCÉE. Un silence ferait passer la correction
 *     pour une disparition d'offres.
 * ------------------------------------------------------------------ */
test('la réparation est écrite au journal du passage', () => {
  const journal = COLLECTEUR.split("source: 'dates-futures'")[1] || '';
  assert.ok(journal.length > 80, 'le journal du passage doit compter les dates impossibles réparées');
  assert.match(journal, /horloge fausse|date future/i, 'la raison doit nommer la cause : une horloge de source');
});

/* ------------------------------------------------------------------ *
 *  4. GARDE-FOU SUR LES DONNÉES RÉELLEMENT PUBLIÉES.
 *     C'est ce contrôle qui aurait attrapé le défaut avant que B ne le
 *     voie : aucune offre publiée ne peut porter une date de publication
 *     postérieure à maintenant. Une seule offre était dans ce cas le
 *     13/10/2026 — celle que B a signalée.
 * ------------------------------------------------------------------ */
test('sur les données publiées, aucune offre n’est datée dans le futur', () => {
  const fichier = path.join(ICI, '..', 'data', 'offres.json');
  if (!fs.existsSync(fichier)) return;      // pas encore de collecte : rien à vérifier
  const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const maintenant = Date.now();
  const fautives = [];
  for (const o of d.offres || []) {
    const t = Date.parse(o.date || '');
    if (!Number.isFinite(t)) continue;
    if (t > maintenant + MARGE_HORLOGE_MS) {
      fautives.push(`${String(o.titre || '').slice(0, 50)} — date ${o.date} (source ${o.sourceId || '?'})`);
    }
  }
  assert.deepEqual(fautives, [],
    `offres datées dans le futur : la carte annonce « il y a 1 min » à perpétuité, tient la tête des plus récentes et ne périme jamais :\n  ${fautives.slice(0, 8).join('\n  ')}`);
});
