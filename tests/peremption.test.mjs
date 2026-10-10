/**
 * LA PÉREMPTION DES OFFRES — application n°2 « Promos ».
 *
 * Question de B (10/10/2026) : « quand cette mise à jour a lieu est-ce qu'on
 * enlève les promotions qui ne sont plus d'actualité ? » La réponse était non.
 * Ce fichier fixe les trois verrous qui remplacent ce « non », et surtout les
 * deux bords de chacun — parce qu'une règle de retrait a deux façons de nuire :
 *
 *   • ne pas retirer assez  → l'utilisateur clique sur une promo terminée (le
 *     défaut d'origine : un bon de Noël Auchan daté de novembre 2018, entré en
 *     base la semaine du 10/10/2026) ;
 *
 *   • retirer trop          → on perd de la couverture, et le défaut est
 *     SILENCIEUX : rien à l'écran, juste des offres qui manquent. C'est le sens
 *     des gardes « tour partiel », « source muette », « date illisible » et
 *     « offre d'avant le mécanisme » ci-dessous.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ageJours, motifDeSortie, avancerTours, aManqueDesTours, estampillerOffresDavant, typeDeSource,
  LIMITE_PRESSE_JOURS, LIMITE_SOURCE_DISPARUE_JOURS, TOURS_SANS_SERVICE,
} from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const COLLECTEUR = fs.readFileSync(path.join(ICI, '..', 'collecteur.mjs'), 'utf8');

// Une horloge figée : la règle ne doit pas dépendre de l'heure qu'il est.
const MAINTENANT = Date.parse('2026-10-10T12:00:00.000Z');
const ilYA = (jours) => new Date(MAINTENANT - jours * 86400000).toISOString();

/* ------------------------------------------------------------------ *
 *  L'ÂGE — et son refus de juger sur une date qu'on ne sait pas lire.
 * ------------------------------------------------------------------ */
test('l’âge d’une date ISO se compte en jours', () => {
  assert.equal(ageJours(ilYA(0), MAINTENANT), 0);
  assert.equal(ageJours(ilYA(7), MAINTENANT), 7);
  assert.ok(Math.abs(ageJours(ilYA(0.5), MAINTENANT) - 0.5) < 1e-6);
});

test('une date illisible ne donne PAS un âge', () => {
  // Le point décisif : null, et pas 0 ni NaN. Un âge de 0 garderait tout ; un
  // NaN ferait échouer toutes les comparaisons en silence. null dit « je ne sais
  // pas », et les règles savent ne rien décider sur ce qu'elles ignorent.
  for (const mauvais of ['', null, undefined, 'hier soir', 'pas une date', 0, '2026-13-45']) {
    assert.equal(ageJours(mauvais, MAINTENANT), null, `âge refusé attendu pour : ${String(mauvais)}`);
  }
});

/* ------------------------------------------------------------------ *
 *  VERROU 1 — LA PRESSE, JUGÉE SUR SA DATE.
 * ------------------------------------------------------------------ */
test('une offre de presse de plus de 7 jours est écartée', () => {
  const o = { date: ilYA(8), type: 'offre', titre: 'Bon de réduction Auchan Jouets Noël' };
  assert.equal(motifDeSortie(o, { maintenant: MAINTENANT, typeSource: 'presse' }), 'presse-hors-delai');
});

test('une offre de presse de la semaine est GARDÉE', () => {
  // Le bord exact : à 7 jours pile, l'offre reste. Un bon plan de presse peut
  // avoir une semaine ; c'est l'archive qu'on refuse, pas l'actualité.
  for (const j of [0, 0.5, 1, 3, 6.99, 7]) {
    const o = { date: ilYA(j), type: 'offre' };
    assert.equal(motifDeSortie(o, { maintenant: MAINTENANT, typeSource: 'presse' }), '',
      `${j} jour(s) : l’offre doit rester`);
  }
});

test('l’article de 2018 qui a motivé la règle est bien écarté', () => {
  const o = { date: '2018-11-06T00:00:00.000Z', type: 'offre', sourceId: 'gnews-jouets',
    titre: 'Bon de réduction Auchan Jouets Noël : 10€ de remise dès 50€' };
  assert.equal(motifDeSortie(o, { maintenant: MAINTENANT, typeSource: 'presse' }), 'presse-hors-delai');
});

/* ------------------------------------------------------------------ *
 *  LES MARCHANDS — JAMAIS JUGÉS SUR L'ÂGE.
 * ------------------------------------------------------------------ */
test('une offre MARCHANDE ancienne n’est jamais écartée sur sa date', () => {
  // C'est le cœur du calcul : chez un marchand, la date est une date de
  // publication que la source rafraîchit, pas une preuve de validité. Un marchand
  // qui republie une offre de trente jours la garde VIVANTE. C'est la disparition
  // qui la condamne (verrou 2), jamais l'âge.
  for (const type of ['dealabs', 'amazon', 'flash', 'enseigne', 'bol', 'groupon',
    'socialdeal', 'krefel']) {
    const o = { date: ilYA(30), type: 'offre' };
    assert.equal(motifDeSortie(o, { maintenant: MAINTENANT, typeSource: type }), '',
      `${type} : l’âge ne doit rien décider`);
  }
});

/* ------------------------------------------------------------------ *
 *  VERROU 3 — LA SOURCE DISPARUE.
 * ------------------------------------------------------------------ */
test('une offre de source disparue suit la limite de la presse', () => {
  // 678 offres étaient dans ce cas : leur source a été retirée du catalogue, donc
  // personne ne parlera plus jamais d'elles. Sans cette règle, elles seraient
  // immortelles — c'est exactement ce qu'on répare.
  const o = { date: ilYA(30), type: 'offre' };
  assert.equal(motifDeSortie(o, { maintenant: MAINTENANT, typeSource: '' }), 'source-disparue');
  assert.equal(motifDeSortie({ date: ilYA(3), type: 'offre' }, { maintenant: MAINTENANT, typeSource: '' }), '');
});

test('une date illisible ou future ne fait JAMAIS écarter une offre', () => {
  // Une horloge de source mal réglée n'est pas une preuve de péremption. Écarter
  // une offre sur une date dans le futur serait un retrait arbitraire.
  for (const typeSource of ['presse', '']) {
    assert.equal(motifDeSortie({ date: 'hier soir' }, { maintenant: MAINTENANT, typeSource }), '');
    assert.equal(motifDeSortie({}, { maintenant: MAINTENANT, typeSource }), '');
    assert.equal(motifDeSortie({ date: ilYA(-3) }, { maintenant: MAINTENANT, typeSource }), '');
  }
  assert.equal(motifDeSortie(null, { maintenant: MAINTENANT, typeSource: 'presse' }), '');
});

/* ------------------------------------------------------------------ *
 *  LES ARTICLES DE VEILLE — LEUR PROPRE RÈGLE, ET ON N'Y TOUCHE PAS.
 * ------------------------------------------------------------------ */
test('un ARTICLE de veille garde ses 30 jours — la nouvelle règle ne le rabote pas', () => {
  // Défaut attrapé avant livraison : les articles de veille (aucun prix affiché)
  // ont leur propre limite, trente jours, déjà en place et validée. Sans le garde
  // ci-dessus, les 142 articles de plus de sept jours auraient été supprimés par
  // une règle destinée aux OFFRES — un changement que personne n'avait demandé,
  // sur un autre produit, et invisible à l'écran.
  for (const typeSource of ['presse', '']) {
    assert.equal(motifDeSortie({ type: 'article', date: ilYA(20) }, { maintenant: MAINTENANT, typeSource }), '',
      'un article de vingt jours doit rester (limite de veille : 30 jours)');
  }
  // Et le garde ne doit pas non plus retenir une OFFRE : c'est tout l'objet de
  // la correction.
  assert.equal(motifDeSortie({ type: 'offre', date: ilYA(20) }, { maintenant: MAINTENANT, typeSource: 'presse' }),
    'presse-hors-delai');
});

/* ------------------------------------------------------------------ *
 *  VERROU 2 — LA DISPARITION : LA COMPTABILITÉ DES TOURS.
 * ------------------------------------------------------------------ */
test('un tour ne compte que si la source a VRAIMENT parlé', () => {
  const { tours } = avancerTours({ rendus: { amazon: 50, muette: 0 } });
  assert.equal(tours.amazon, 1, 'la source qui a rendu compte son tour');
  assert.equal(tours.muette, undefined, 'une source muette ne dit pas que l’offre a disparu');
});

test('un tour PARTIEL ne compte pas — c’est la garde qui protège le catalogue', () => {
  // Défaut redouté, et mesuré ailleurs dans ce projet : Amazon rend une page
  // tronquée un passage sur deux (mur anti-robot). Sans cette garde, deux
  // passages tronqués condamneraient tout son catalogue d'un coup — et le défaut
  // serait INVISIBLE : aucune erreur, juste des offres qui manquent.
  const p1 = avancerTours({ rendus: { amazon: 100 } });
  assert.equal(p1.tours.amazon, 1);
  const p2 = avancerTours({ tours: p1.tours, rendus: { amazon: 20 }, precedents: p1.rendus });
  assert.equal(p2.tours.amazon, 1, '20 sur 100 : le tour ne compte pas');
  const p3 = avancerTours({ tours: p2.tours, rendus: { amazon: 80 }, precedents: p2.rendus });
  assert.equal(p3.tours.amazon, 2, '80 sur 100 : la source a parlé, le tour compte');
});

test('une source dont le tour n’a pas compté ne fait tomber AUCUNE offre', () => {
  const tours = { dealabs: 5 };
  // Le tour partiel n'a pas incrémenté : l'offre servie au tour 4 a donc un écart
  // d'UN seul tour, pas deux.
  assert.equal(aManqueDesTours({ sourceId: 'dealabs', serviceAuTour: 4 }, tours, { typeSource: 'dealabs' }), false);
  assert.equal(aManqueDesTours({ sourceId: 'dealabs', serviceAuTour: 3 }, tours, { typeSource: 'dealabs' }), true);
});

test('une offre sort après deux tours réussis sans republication, pas avant', () => {
  assert.equal(TOURS_SANS_SERVICE, 2);
  const tours = { dealabs: 10 };
  // Servie au tour 9 : un seul tour manqué → elle reste.
  assert.equal(aManqueDesTours({ sourceId: 'dealabs', serviceAuTour: 9 }, tours, { typeSource: 'dealabs' }), false);
  // Servie au tour 8 : deux tours manqués → elle sort.
  assert.equal(aManqueDesTours({ sourceId: 'dealabs', serviceAuTour: 8 }, tours, { typeSource: 'dealabs' }), true);
});

test('une offre d’AVANT le mécanisme reçoit ses deux tours de grâce', () => {
  // Sans ce bord, la première exécution après déploiement condamnerait la base
  // entière d'un coup : 17 000 offres effacées en une fois, faute de numéro de
  // tour. On leur accorde le tour courant — le retrait ne vient que d'une
  // disparition CONSTATÉE après la mise en service.
  assert.equal(aManqueDesTours({ sourceId: 'dealabs' }, { dealabs: 42 }, { typeSource: 'dealabs' }), false);
});

test('une source jamais surveillée ne condamne rien', () => {
  // Source absente du compteur : on n'a pas réussi à la lire, on ne juge pas.
  assert.equal(aManqueDesTours({ sourceId: 'krefel', serviceAuTour: 1 }, {}, { typeSource: 'krefel' }), false);
  assert.equal(aManqueDesTours({ sourceId: 'krefel', serviceAuTour: 1 }, { krefel: 0 }, { typeSource: 'krefel' }), false);
});

test('une offre d’AVANT reçoit un numéro de tour — sinon elle serait immortelle', () => {
  const offres = [
    { sourceId: 'dealabs-tendance' },                        // d'avant, source surveillée
    { sourceId: 'flash-at' },                                 // source sans compteur
    { sourceId: 'dealabs-tendance', serviceAuTour: 7 },       // déjà numérotée
  ];
  const n = estampillerOffresDavant(offres, { 'dealabs-tendance': 12 });
  assert.equal(n, 1, 'une seule offre à estampiller');
  assert.equal(offres[0].serviceAuTour, 12);
  assert.equal(offres[1].serviceAuTour, undefined, 'sans compteur, on n’invente pas de numéro');
  assert.equal(offres[2].serviceAuTour, 7, 'on n’écrase pas un numéro existant');
});

test('SANS la migration, le verrou ne toucherait jamais les offres d’avant', () => {
  // La démonstration du défaut, et pourquoi la migration est indispensable : sur
  // une offre sans numéro, l’écart se recalcule sur le tour COURANT et reste nul
  // à jamais. Défaut relevé sur la première exécution réelle : seize mille offres
  // dans ce cas, donc seize mille offres que le verrou n'aurait jamais vues.
  const jamaisServie = { sourceId: 'dealabs-tendance' };
  for (const tour of [1, 2, 99]) {
    assert.equal(aManqueDesTours(jamaisServie, { 'dealabs-tendance': tour }), false,
      `sans numéro, l’offre survit même à ${tour} tours`);
  }
  // Avec la migration, la grâce est RÉELLE et bornée : deux tours, pas l'éternité.
  estampillerOffresDavant([jamaisServie], { 'dealabs-tendance': 1 });
  assert.equal(aManqueDesTours(jamaisServie, { 'dealabs-tendance': 2 }), false, 'un tour sans republication : elle reste');
  assert.equal(aManqueDesTours(jamaisServie, { 'dealabs-tendance': 3 }), true, 'deux tours : elle sort');
});

test('la presse n’a QUE le verrou de la date', () => {
  // Un article de presse n'est jamais republié : le compter comme un marchand le
  // ferait disparaître au bout de dix minutes. Son seul juge est sa date.
  assert.equal(aManqueDesTours({ sourceId: 'gnews-auto', serviceAuTour: 1 },
    { 'gnews-auto': 99 }, { typeSource: 'presse' }), false);
});

/* ------------------------------------------------------------------ *
 *  LE TYPE DE SOURCE — sur quoi repose la répartition entre les verrous.
 * ------------------------------------------------------------------ */
test('les recherches Google News ne passent PAS pour des sources disparues', () => {
  // Elles sont ACTIVES mais n'apparaissent dans aucun catalogue publié : elles
  // sont construites à la volée. Les juger orphelines écarterait, à tort, leurs
  // meilleures offres au bout de sept jours.
  for (const id of ['gnews-jouets', 'gnews-auto', 'gnews-tech', 'gnews-maison',
    'gnews-sport', 'gnews-mode', 'gnews-bricolage']) {
    assert.equal(typeDeSource(id), 'presse', `${id} doit être reconnue comme une source de presse`);
  }
});

test('le type est lu au catalogue, et le vide signale l’orpheline', () => {
  assert.equal(typeDeSource('dealabs-tendance'), 'dealabs');
  assert.equal(typeDeSource('flash-at'), '', 'source retirée du catalogue : orpheline');
  assert.equal(typeDeSource('source-qui-nexiste-pas'), '', 'identifiant inconnu : orpheline');
  assert.equal(typeDeSource(null), '', 'identifiant absent : orpheline');
});

/* ------------------------------------------------------------------ *
 *  LE CÂBLAGE — une règle juste que personne n'appelle ne corrige rien.
 *  Leçon du 09/10/2026 (voir tests/maj.test.mjs) : on contrôle l'appel,
 *  pas seulement la règle.
 * ------------------------------------------------------------------ */
test('la collecte APPLIQUE les trois verrous, et retient ses compteurs', () => {
  assert.match(COLLECTEUR, /const motif = motifDeSortie\(o, \{ typeSource: typeDeSource\(o\.sourceId\) \}\)/,
    'le verrou de la date doit être appelé sur le stock');
  assert.match(COLLECTEUR, /aManqueDesTours\(o, toursParSource, \{ typeSource: typeDeSource\(o\.sourceId\) \}\)/,
    'le verrou de la disparition doit être appelé sur le stock');
  assert.match(COLLECTEUR, /avancerTours\(\{/,
    'la comptabilité des tours doit être tenue à chaque passage');
  assert.match(COLLECTEUR, /const estampillees = estampillerOffresDavant\(connues\.values\(\), toursParSource\)/,
    'les offres d’avant doivent recevoir leur numéro de tour, sinon le verrou les ignore à jamais');
  assert.match(COLLECTEUR, /toursParSource: Object\.fromEntries/,
    'les compteurs doivent être PUBLIÉS dans l’état, sinon ils repartent de zéro à chaque passage');
  assert.match(COLLECTEUR, /rendusParSource: Object\.fromEntries/,
    'le dernier rendu doit être publié : c’est lui qui détecte un tour partiel');
});

/* ------------------------------------------------------------------ *
 *  LE GARDE-FOU SUR LES DONNÉES RÉELLES — c'est lui qui aurait attrapé le
 *  défaut en production. Il ne remplace pas les épreuves ci-dessus : il les
 *  confronte à ce qui est VRAIMENT publié.
 * ------------------------------------------------------------------ */
test('aucune offre périmée ne subsiste dans les données publiées', () => {
  const fichier = path.join(ICI, '..', 'data', 'offres.json');
  if (!fs.existsSync(fichier)) return;   // pas encore de collecte : rien à vérifier
  const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const maintenant = Date.now();
  const fautives = [];
  for (const o of d.offres || []) {
    const motif = motifDeSortie(o, { maintenant, typeSource: typeDeSource(o.sourceId) });
    if (motif) fautives.push(`${motif} — ${String(o.titre || '').slice(0, 50)} (${String(o.date || '').slice(0, 10)})`);
  }
  assert.equal(fautives.length, 0,
    `offres périmées toujours publiées :\n  ${fautives.slice(0, 10).join('\n  ')}`);
});

test('le verrou de la disparition MESURE sans retirer — la mesure l’a démenti', () => {
  // Le raisonnement d'origine — « la source ne la republie plus, donc elle est
  // morte » — supposait que le flux d'une source soit une LISTE. C'est une
  // FENÊTRE : le flux « tendance » de Dealabs sert 30 offres par passage quand la
  // base en porte 1 407. Et sortir de la fenêtre ne veut pas dire être expiré :
  // sur trois offres Dealabs absentes du flux, vérifiées à la main le 10/10/2026,
  // DEUX portent `isExpired: false` / `status: Activated` / `isHot: true`.
  // Appliquer cette règle aurait effacé près de dix mille offres VIVANTES.
  const bloc = COLLECTEUR
    .split('VERROU 2 : LA DISPARITION CHEZ LES MARCHANDS — EN MESURE SEULEMENT')[1]
    .split('Les offres reprises du stock gardent')[0];
  assert.ok(bloc.length > 300, `le bloc du verrou 2 doit être identifiable (${bloc.length} caractères)`);
  assert.ok(!bloc.includes('connues.delete'),
    'ce verrou ne doit RIEN retirer : sa justification a été démentie par la mesure');
  assert.match(bloc, /ecartees: 0,/,
    'le journal doit dire franchement qu’il ne retire rien, pour ne pas faire croire à une purge');
  assert.match(bloc, /auraitEcartees/,
    'la mesure doit être publiée dans l’état — sinon on n’apprend rien en trente jours');
});

test('les compteurs de tours sont présents et cohérents dans l’état publié', () => {
  const fichier = path.join(ICI, '..', 'data', 'offres.json');
  if (!fs.existsSync(fichier)) return;
  const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  if (d.toursParSource === undefined) return;   // état d'avant le mécanisme
  const ids = Object.keys(d.toursParSource);
  assert.ok(ids.length > 0, 'au moins une source doit avoir un tour compté');
  for (const id of ids) {
    assert.notEqual(typeDeSource(id), '', `un compteur ne doit exister que pour une source vivante : ${id}`);
    assert.ok(Number.isFinite(d.toursParSource[id]) && d.toursParSource[id] > 0,
      `compteur invraisemblable pour ${id}`);
  }
  for (const o of d.offres || []) {
    if (o.serviceAuTour === undefined) continue;
    const tour = d.toursParSource[o.sourceId];
    // Une offre ORPHELINE — sa source a quitté le catalogue (`flash-at`,
    // `flash-pt`, `dealabs-new`, `dealabs-hot`) — garde le numéro de tour qu'elle
    // portait, alors que son compteur, lui, a été élagué : il n'y a plus rien à
    // comparer. Ce n'est pas une incohérence, c'est la trace d'un passé révolu ;
    // on ne peut donc exiger la comparaison que pour une source ENCORE suivie.
    if (tour === undefined) {
      assert.equal(typeDeSource(o.sourceId), '',
        `un compteur manquant n’est légitime que pour une source disparue (${o.sourceId})`);
      continue;
    }
    assert.ok(tour >= o.serviceAuTour,
      `une offre ne peut pas avoir été servie à un tour futur (${o.sourceId})`);
  }
  // Et la mesure doit être LISIBLE dans le journal : c'est elle qu'on viendra
  // relire dans trente jours pour choisir la règle définitive.
  const mesure = (d.journal || []).find((x) => x.source === 'peremption-tours');
  if (mesure) {
    assert.equal(mesure.ecartees, 0, 'la mesure ne retire rien');
    assert.ok(Number.isFinite(mesure.auraitEcartees), 'elle doit dire COMBIEN d’offres elle aurait écartées');
  }
});

/* ------------------------------------------------------------------ *
 *  Le bord temporel de la presse est bien celui annoncé à B.
 * ------------------------------------------------------------------ */
test('les limites sont celles qui ont été annoncées', () => {
  assert.equal(LIMITE_PRESSE_JOURS, 7);
  assert.equal(LIMITE_SOURCE_DISPARUE_JOURS, 7);
});
