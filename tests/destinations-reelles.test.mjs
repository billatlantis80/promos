/**
 * LES DESTINATIONS RÉELLES — application n°2, 11/10/2026.
 *
 * Ce que ces épreuves protègent, et pourquoi elles existent : le 11/10/2026,
 * l'audit des liens sortants a mesuré que **69,7 % du catalogue** (13 070
 * offres) envoyait le visiteur chez un site de bons plans CONCURRENT au lieu du
 * marchand — dont 5 069 offres qui nommaient pourtant « Amazon ». Un lien qui ne
 * mène pas au marchand ne rapportera jamais rien, quel que soit le nombre de
 * programmes d'affiliation rejoints.
 *
 * Le correctif tient en deux pièces : un résolveur (outils/resoudre-destinations.mjs)
 * qui interroge le point de sortie public des plateformes UNE fois par offre, et
 * une règle de stock (appliquerDestinations) qui repose l'adresse à chaque
 * collecte — sans quoi la fusion `{...avant, ...offre}` l'écraserait cinq
 * minutes plus tard.
 *
 * CE QUE CES ÉPREUVES REFUSENT DE LAISSER PASSER — c'est leur vrai sujet :
 *   1. une adresse INVENTÉE là où la résolution a échoué ;
 *   2. un lien CASSÉ là où le cache est vide ;
 *   3. une destination qui n'est pas un marchand (moteur, réseau social, la
 *      plateforme elle-même) présentée comme une destination ;
 *   4. la clé d'identité de l'offre (lienPage) écrasée : l'offre doit continuer
 *      de dire D'OÙ elle vient.
 *
 * Lancement : node --test tests/destinations-reelles.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  adresseDeSortie,
  destinationAcceptable,
  destinationDeRedirection,
  hôteDe,
  numéroDeFil,
  hôteRésoluble,
} from '../outils/resoudre-destinations.mjs';
import { lireDestinations, appliquerDestinations } from '../collecteur.mjs';

/* ------------------------------------------------------------------ *
 *  1. L'ADRESSE DE SORTIE — trouvée, ou pas
 * ------------------------------------------------------------------ */

test('une adresse de bon plan connue donne son point de sortie', () => {
  assert.equal(
    adresseDeSortie('https://www.chollometro.com/ofertas/quelque-chose-2028106'),
    'https://www.chollometro.com/visit/threadmain/2028106',
  );
  assert.equal(
    adresseDeSortie('https://www.dealabs.com/bons-plans/un-truc-3430135'),
    'https://www.dealabs.com/visit/threadmain/3430135',
  );
  assert.equal(
    adresseDeSortie('https://nl.pepper.com/aanbiedingen/iets-1234567'),
    'https://www.nl.pepper.com/visit/threadmain/1234567',
  );
});

test('une adresse de marchand n’a PAS de point de sortie — et on ne lui en invente pas', () => {
  // Le piège : prendre un lien Amazon pour une plateforme de bons plans
  // enverrait une requête inutile et écrirait une destination fausse au cache.
  assert.equal(adresseDeSortie('https://www.amazon.fr/dp/B003ZG966A'), '');
  assert.equal(adresseDeSortie('https://partner.bol.com/click/click?p=1&t=url&url=x'), '');
  assert.equal(adresseDeSortie(''), '');
  assert.equal(adresseDeSortie('pas une adresse'), '');
});

test('un numéro de fil absent ne fabrique pas d’adresse de sortie', () => {
  assert.equal(numéroDeFil('https://www.dealabs.com/bons-plans/accueil'), '');
  assert.equal(adresseDeSortie('https://www.dealabs.com/bons-plans/accueil'), '');
});

test('l’hôte d’une plateforme non résoluble est reconnu comme tel', () => {
  assert.equal(hôteRésoluble('https://www.mydealz.de/deals/x-1'), 'mydealz.de');
  assert.equal(hôteRésoluble('https://news.google.com/rss/articles/xyz'), '');
  assert.equal(hôteRésoluble('https://www.lesnumeriques.com/x'), '');
  assert.equal(hôteDe('https://WWW.Dealabs.com/x'), 'dealabs.com');
});

/* ------------------------------------------------------------------ *
 *  2. LA DESTINATION — lue dans la redirection, jamais devinée
 * ------------------------------------------------------------------ */

test('l’adresse marchande est extraite de la redirection réelle (relevée le 11/10/2026)', () => {
  // Relevé tel quel sur une offre réelle du catalogue.
  const location = 'https://path.chollometro.com/pepper-es/redirect'
    + '?url=https%3A%2F%2Fwww.amazon.es%2Fdp%2FB003ZG966A%3Fsmid%3DA1AT7YVPFBWXBL'
    + '&product=ppr-es-1028474693&tag=eugc&referer=https%3A%2F%2Fwww.chollometro.com';
  assert.equal(
    destinationDeRedirection(location),
    'https://www.amazon.es/dp/B003ZG966A?smid=A1AT7YVPFBWXBL',
  );
});

test('une redirection qui renvoie vers la plateforme elle-même est ÉCARTÉE', () => {
  const versNous = 'https://path.dealabs.com/pepper-fr/redirect'
    + '?url=https%3A%2F%2Fwww.dealabs.com%2Fbons-plans%2Fautre-1&tag=eugc';
  assert.equal(destinationDeRedirection(versNous), '');
});

test('une redirection vers un moteur ou un réseau social est ÉCARTÉE', () => {
  const versGoogle = 'https://path.mydealz.de/pepper-de/redirect'
    + '?url=https%3A%2F%2Fnews.google.com%2Farticles%2Fabc&tag=eugc';
  assert.equal(destinationDeRedirection(versGoogle), '');
  const versFacebook = 'https://path.mydealz.de/pepper-de/redirect'
    + '?url=https%3A%2F%2Fwww.facebook.com%2Fpage&tag=eugc';
  assert.equal(destinationDeRedirection(versFacebook), '');
});

test('sans redirection, ou sans paramètre, il n’y a PAS de destination — et rien n’est inventé', () => {
  assert.equal(destinationDeRedirection(''), '');
  assert.equal(destinationDeRedirection(null), '');
  assert.equal(destinationDeRedirection('https://path.dealabs.com/pepper-fr/redirect?tag=eugc'), '');
  assert.equal(destinationDeRedirection('https://path.dealabs.com/pepper-fr/redirect?url='), '');
  assert.equal(destinationDeRedirection('pas une adresse'), '');
});

test('destinationAcceptable : un marchand oui, un hôte nu non', () => {
  assert.ok(destinationAcceptable('https://www.amazon.fr/dp/B003ZG966A'));
  assert.ok(destinationAcceptable('https://www.carrefour.fr/p/quelque-chose'));
  assert.ok(destinationDeRedirection('https://p.x/redirect?url=https%3A%2F%2Fwww.carrefour.fr%2Fp%2Fx'));
  assert.ok(!destinationAcceptable('https://localhost'));
  assert.ok(!destinationAcceptable('javascript:alert(1)'));
  assert.ok(!destinationAcceptable('mailto:a@b.fr'));
  assert.ok(!destinationAcceptable(''));
});

/* ------------------------------------------------------------------ *
 *  3. LA RÈGLE DE STOCK — appliquée à chaque collecte, sans casser l'identité
 * ------------------------------------------------------------------ */

const offre = (surcharge = {}) => ({
  id: 'x1',
  type: 'offre',
  titre: 'Un produit',
  lienMarchand: 'https://www.dealabs.com/bons-plans/un-produit-3430135',
  lienPage: 'https://www.dealabs.com/bons-plans/un-produit-3430135',
  marchand: 'Amazon',
  prix: 19.99,
  sourceId: 'dealabs-tendance',
  pays: 'FR',
  ...surcharge,
});

test('la destination réelle remplace la destination du clic — PAS la page d’origine', () => {
  const connues = new Map([['FR|dealabs.com/bons-plans/un-produit-3430135', offre()]]);
  const cache = new Map([[
    'https://www.dealabs.com/visit/threadmain/3430135',
    { url: 'https://www.amazon.fr/dp/B0XXXXXXXX', hote: 'amazon.fr' },
  ]]);
  const { remplacees, parHote } = appliquerDestinations(connues, cache);
  const o = connues.get('FR|dealabs.com/bons-plans/un-produit-3430135');
  assert.equal(remplacees, 1);
  assert.deepEqual(parHote, { 'amazon.fr': 1 });
  assert.equal(o.lienMarchand, 'https://www.amazon.fr/dp/B0XXXXXXXX', 'le clic doit mener au marchand');
  assert.equal(
    o.lienPage,
    'https://www.dealabs.com/bons-plans/un-produit-3430135',
    'l’identité de l’offre ne doit PAS bouger : elle dit d’où vient le bon plan',
  );
});

test('un cache ABSENT ou VIDE ne casse rien : le lien d’origine reste', () => {
  const connues = new Map([['k', offre()]]);
  for (const cache of [new Map(), null, undefined]) {
    const r = appliquerDestinations(connues, cache);
    assert.equal(r.remplacees, 0);
    assert.equal(connues.get('k').lienMarchand, 'https://www.dealabs.com/bons-plans/un-produit-3430135');
  }
});

test('une offre portant une destination VIDE au cache n’est pas remplacée non plus', () => {
  const connues = new Map([['k', offre()]]);
  const cache = new Map([['https://www.dealabs.com/visit/threadmain/3430135', { url: '', hote: '', refus: 'aucune-redirection' }]]);
  assert.equal(appliquerDestinations(connues, cache).remplacees, 0);
  assert.equal(connues.get('k').lienMarchand, 'https://www.dealabs.com/bons-plans/un-produit-3430135');
});

test('deux passages ne comptent pas deux fois — la règle est idempotente', () => {
  const connues = new Map([['k', offre()]]);
  const cache = new Map([['https://www.dealabs.com/visit/threadmain/3430135', { url: 'https://www.amazon.fr/dp/B0X', hote: 'amazon.fr' }]]);
  assert.equal(appliquerDestinations(connues, cache).remplacees, 1);
  assert.equal(appliquerDestinations(connues, cache).remplacees, 0, 'la seconde collecte ne doit rien remettre en jeu');
  assert.equal(connues.get('k').lienMarchand, 'https://www.amazon.fr/dp/B0X');
});

test('une offre dont le lien mène déjà à un marchand n’est pas touchée', () => {
  const connues = new Map([['k', offre({ lienMarchand: 'https://www.amazon.fr/dp/B003ZG966A' })]]);
  const cache = new Map([['https://www.dealabs.com/visit/threadmain/3430135', { url: 'https://amzn.eu/d/abc', hote: 'amzn.eu' }]]);
  assert.equal(appliquerDestinations(connues, cache).remplacees, 0);
  assert.equal(connues.get('k').lienMarchand, 'https://www.amazon.fr/dp/B003ZG966A');
});

/* ------------------------------------------------------------------ *
 *  4. LA LECTURE DU CACHE — un fichier absent ne fait pas tomber la collecte
 * ------------------------------------------------------------------ */

test('le cache se lit, et son absence rend une table vide (jamais une erreur)', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'dest-'));
  const absent = path.join(dossier, 'n-existe-pas.json');
  assert.equal(lireDestinations(absent).size, 0, 'cache absent : table vide, pas d’exception');

  const valide = path.join(dossier, 'cache.json');
  fs.writeFileSync(valide, JSON.stringify({
    destinations: {
      'https://www.dealabs.com/visit/threadmain/1': { url: 'https://www.amazon.fr/dp/A', hote: 'amazon.fr' },
      'https://www.dealabs.com/visit/threadmain/2': { url: '', hote: '', refus: 'aucune-redirection' },
      'https://www.dealabs.com/visit/threadmain/3': null,
    },
  }));
  const t = lireDestinations(valide);
  assert.equal(t.size, 1, 'seules les destinations RÉELLES entrent au cache');
  assert.equal(t.get('https://www.dealabs.com/visit/threadmain/1').url, 'https://www.amazon.fr/dp/A');

  const casse = path.join(dossier, 'casse.json');
  fs.writeFileSync(casse, '{ceci n’est pas du JSON');
  assert.equal(lireDestinations(casse).size, 0, 'cache illisible : table vide, pas d’exception');
});
