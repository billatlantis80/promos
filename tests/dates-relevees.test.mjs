/**
 * LES DATES DE RELEVÉ — application n°2 « Promos ».
 *
 * Défaut signalé par B (10/10/2026), mot pour mot : « tantôt j'ai observé une
 * erreur d'affichage, pas du site mais des articles et de la mise à jour ».
 * Toutes les cartes d'un marchand affichaient « il y a 1 min », exactement le
 * chiffre de la ligne « mis à jour il y a 1 min » de l'en-tête : l'âge d'une
 * offre et l'heure de la collecte étaient devenus le MÊME nombre.
 *
 * Cause mesurée, et non supposée : sept lecteurs fabriquent la date au moment du
 * passage (`date: new Date().toISOString()`) parce que ces pages ne publient
 * aucune date, et la fusion réécrivait ce champ à chaque collecte. 202 offres
 * étaient dans cet état, dont une en base depuis 92,2 h qui annonçait 0,02 h.
 *
 * Ces épreuves tiennent les trois maillons : la déclaration dans les lecteurs,
 * le refus d'écraser dans la fusion, et la réparation rétroactive du stock.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateEstUnReleve, typeDeSource } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const COLLECTEUR = fs.readFileSync(path.join(ICI, '..', 'collecteur.mjs'), 'utf8');

/* ------------------------------------------------------------------ *
 *  1. Aucune date fabriquée sans être DÉCLARÉE comme un relevé.
 *     C'est le contrôle qui empêche le défaut de revenir par un nouveau
 *     lecteur : celui qui écrirait « date: new Date().toISOString() » sans
 *     le marqueur serait refusé ici, avant que la carte ne mente à l'écran.
 * ------------------------------------------------------------------ */
test('chaque date fabriquée par un lecteur est déclarée comme une date de relevé', () => {
  const lignes = COLLECTEUR.split('\n');
  const fabriquees = [];
  lignes.forEach((l, i) => {
    if (!/date: new Date\(\)\.toISOString\(\),/.test(l)) return;
    fabriquees.push({ ligne: i + 1, declaree: /dateRelevee: true/.test(lignes.slice(i + 1, i + 5).join('\n')) });
  });
  assert.ok(
    fabriquees.length >= 7,
    `les sept lecteurs de pages doivent être trouvés (${fabriquees.length} date(s) fabriquée(s) repérée(s))`,
  );
  const nues = fabriquees.filter((f) => !f.declaree).map((f) => f.ligne);
  assert.deepEqual(
    nues, [],
    `date fabriquée sans marqueur « dateRelevee: true » : elle serait réécrite à chaque passage, lignes ${nues.join(', ')}`,
  );
});

/* ------------------------------------------------------------------ *
 *  2. La fusion refuse d'écraser une date de relevé.
 * ------------------------------------------------------------------ */
test('la fusion garde la date de la première rencontre et n’écrase pas un relevé', () => {
  const bloc = COLLECTEUR
    .split('if (!avant) {')[1]
    .split('if (!offre.image && avant.image)')[0];
  assert.ok(bloc.length > 300, `le bloc de fusion doit être identifiable (${bloc.length} caractères)`);
  assert.match(bloc, /offre\.dateRelevee && avant\.date/,
    'la fusion doit reconnaître une date de relevé');
  assert.match(bloc, /fusion\.date = avant\.date/,
    'la date de relevé ne doit PAS être recopiée : l’offre garde sa première rencontre');
  assert.match(bloc, /premiereVue: vu/,
    'premiereVue doit exister dès l’entrée en base — c’est le repère de la réparation');
});

/* ------------------------------------------------------------------ *
 *  3. La réparation est RÉTROACTIVE, comme le reclassement et la remise.
 *     Une offre engrangée avant la correction ne sort jamais d'elle-même :
 *     sans cette réparation, les 202 cartes fautives le resteraient des mois.
 * ------------------------------------------------------------------ */
test('les offres d’avant sont rendues à leur première vue, rétroactivement', () => {
  const bloc = COLLECTEUR
    .split('LA DATE DE RELEVÉ, RÉPARÉE RÉTROACTIVEMENT')[1]
    .split('return c;')[0];
  assert.ok(bloc.length > 300, `le bloc de réparation doit être identifiable (${bloc.length} caractères)`);
  assert.match(bloc, /dateEstUnReleve\(typeDeSource\(c\.sourceId\)\)/,
    'la réparation doit viser les sources dont le lecteur fabrique la date');
  assert.match(bloc, /c\.date = c\.premiereVue/,
    'la date fautive doit être remplacée par la première vue — le seul repère honnête gardé');
  const journal = COLLECTEUR.split("source: 'dates-relevees'")[1] || '';
  assert.ok(journal.length > 50, 'la réparation doit être annoncée dans le journal du passage');
});

/* ------------------------------------------------------------------ *
 *  4. Les types visés sont ceux des lecteurs de PAGES, et personne d'autre.
 *     Se tromper de liste ici serait grave dans les deux sens : marquer un
 *     flux (presse, Dealabs) ferait geler une date RÉELLE.
 * ------------------------------------------------------------------ */
test('seuls les lecteurs de pages sont visés, jamais un flux daté', () => {
  for (const type of ['enseigne', 'amazon', 'bol', 'krefel', 'groupon', 'socialdeal', 'flash']) {
    assert.ok(dateEstUnReleve(type), `« ${type} » fabrique sa date : il doit être visé`);
  }
  for (const type of ['presse', 'dealabs', '']) {
    assert.ok(!dateEstUnReleve(type), `« ${type} » donne une date réelle : il ne doit PAS être visé`);
  }
  // Et les types employés par le catalogue publié doivent tous être connus :
  // un type oublié passerait pour « non fabriqué », donc sa date serait
  // réécrite en boucle sans que rien ne le dise.
  const fichier = path.join(ICI, '..', 'data', 'offres.json');
  if (!fs.existsSync(fichier)) return;
  const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const inconnus = new Set();
  for (const o of d.offres || []) {
    const t = typeDeSource(o.sourceId);
    if (t && !['presse', 'dealabs', 'enseigne', 'amazon', 'bol', 'krefel', 'groupon', 'socialdeal', 'flash'].includes(t)) {
      inconnus.add(`${o.sourceId} (${t})`);
    }
  }
  assert.deepEqual([...inconnus], [], 'tout type de source publié doit être classé : flux daté ou date de relevé');
});

/* ------------------------------------------------------------------ *
 *  5. Garde-fou sur les DONNÉES RÉELLEMENT PUBLIÉES.
 *     C'est ce contrôle qui aurait attrapé le défaut en production : il
 *     compare la date d'une offre à son entrée en base et refuse qu'une date
 *     de relevé soit plus RÉCENTE que la première rencontre.
 * ------------------------------------------------------------------ */
test('sur les données publiées, aucune date de relevé ne dépasse la première vue', () => {
  const fichier = path.join(ICI, '..', 'data', 'offres.json');
  if (!fs.existsSync(fichier)) return;   // pas encore de collecte : rien à vérifier
  const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const fautives = [];
  let marquees = 0;
  for (const o of d.offres || []) {
    if (!o.dateRelevee) continue;
    marquees++;
    const date = new Date(o.date).getTime();
    const vue = o.premiereVue ? new Date(o.premiereVue).getTime() : null;
    // Une minute de tolérance : les deux champs sont écrits au même passage mais
    // pas à la même milliseconde.
    if (vue && date > vue + 60000) {
      fautives.push(`${String(o.titre || '').slice(0, 50)} — date ${o.date} contre première vue ${o.premiereVue}`);
    }
  }
  if (marquees === 0) return;             // état d'avant la correction : la collecte n'est pas encore passée
  assert.equal(
    fautives.length, 0,
    `dates de relevé plus récentes que l’entrée en base (la carte annoncerait « il y a 1 min » à vie) :\n  ${fautives.slice(0, 8).join('\n  ')}`,
  );
});
