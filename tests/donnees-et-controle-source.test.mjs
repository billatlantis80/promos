/* =============================================================================
   LE PLAFOND DE SEPT JOURS (DEVENU MESURE), LE BILAN DE DONNÉES, ET LE CONTRÔLE
   DES SOURCES — les épreuves.

   ⚠️ CE FICHIER S'APPELAIT `donnees-plafond-7-jours.test.mjs`, ET SON RENOMMAGE
   EST LE PLUS IMPORTANT DE SON HISTOIRE. Le 14/10/2026, la règle du catalogue a
   changé : ce n'est plus « sept jours sans service, comptés sur `vuLe` » mais
   **« une carte vit cinq jours, puis on demande au flux si sa source la sert
   encore »** (voir `VIE_AFFICHEE_JOURS` et `verdictDeCalendrier`, et leurs
   épreuves dans `vie-de-la-carte-cinq-jours.test.mjs`).

   Ce qui est resté ici, et pourquoi ce n'est pas un tas de restes :

     • LE PLAFOND SURVIT COMME MESURE. `plafondDeDonnees` et `donneesPerimees`
       existent toujours, ne retirent rien, et servent à `bin/mesurer-peremption-source.mjs`
       ainsi qu'aux tranches d'âge du bilan de données. Ses épreuves restent donc
       utiles — mais elles ne défendent plus la règle, elles défendent un
       INSTRUMENT. C'est dit dans chaque titre concerné.

     • LE CONTRÔLE DES SOURCES SURVIT COMME OUTIL DORMANT. `lireVerdictSource`,
       `verdictDans`, `candidatsVerdict` existent, sont éprouvés, et ne sont plus
       appelés par le passage : le budget de lectures est à ZÉRO (`CONTROLES_*_PAR_PASSAGE`),
       parce que la nouvelle règle ne décide plus rien sur une preuve de page.
       Le code reste, éteint, avec ses épreuves : si la question « la page
       répond-elle encore ? » revenait, l'outil serait là et vérifié.

   CE QUI A ÉTÉ RETIRÉ, ET IL FAUT LE DIRE PLUTÔT QUE LE LAISSER DEVINER : les
   épreuves du drapeau `perimee` (il n'existe plus : une carte est affichée ou
   effacée, sans troisième état), celles qui exigeaient que les sorties sur verdict
   soient ALLUMÉES (elles sont éteintes), et celles du mode « mesure » du plafond
   (il n'y a plus de mode : la règle n'a pas d'interrupteur, elle a une échéance).
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { pourcentAffiche } from '../collecteur.mjs';
import http from 'node:http';
import {
  PLAFOND_DONNEES_JOURS, VEILLE_SEPT_JOURS_ACTIVE,
  OFFRES_SORTENT_SUR_VERDICT_ACTIF, PROMOTION_DECIDE_LA_CARTE_ACTIF, VERDICT_SOURCE_PAR_PASSAGE,
  VERDICT_SOURCE_MAX_AGE_JOURS, VIE_AFFICHEE_JOURS,
  CONTROLES_COMMUNAUTE_PAR_PASSAGE, CONTROLES_ENSEIGNE_PAR_PASSAGE,
  plafondDeDonnees, joursDeServiceRestants, verdictDans, verdictPerime, candidatsVerdict,
  lireVerdictSource, donneesPerimees, poidsDuVisuel, bilanDonnees, ageJours,
} from '../collecteur.mjs';

const JOUR = 86400000;
const MAINTENANT = Date.parse('2026-10-12T12:00:00Z');
const ilYA = (jours) => new Date(MAINTENANT - jours * JOUR).toISOString();

const offre = (o = {}) => ({
  id: 'x', type: 'offre', pays: 'BE', image: '', vuLe: ilYA(1), ...o,
});

/* =============================================================================
   LE PLAFOND — INSTRUMENT DE MESURE, PLUS RÈGLE DU CATALOGUE.
   Ces épreuves décrivent exactement le comportement de `plafondDeDonnees`, qui
   n'est plus appelé pour décider. Elles restent justes, et elles restent utiles :
   l'outil d'observation d'octets et les tranches d'âge s'appuient dessus.
   ============================================================================= */

test('le plafond de sept jours porte encore la valeur de la demande de B (12/10/2026)', () => {
  // ⚠ CETTE ÉPREUVE NE DÉFEND PLUS LA RÈGLE : ELLE DÉFEND L'INSTRUMENT. Le 14/10/2026,
  //  la règle est devenue « cinq jours, puis la question du service ». Si cette
  //  constante venait à être utilisée pour décider, la valeur changée serait un
  //  signal — et la règle qui décide, elle, a ses propres épreuves.
  assert.equal(PLAFOND_DONNEES_JOURS, 7, 'la mesure reste à sept jours');
  assert.equal(VIE_AFFICHEE_JOURS, 5, 'et ce n’est PAS la règle : la règle est à cinq jours');
  assert.notEqual(PLAFOND_DONNEES_JOURS, VIE_AFFICHEE_JOURS,
    'si les deux valeurs se rejoignaient, le doute sur « laquelle décide » reviendrait');
});

test('une offre reservie récemment n’est PAS comptée', () => {
  const v = plafondDeDonnees([
    offre({ vuLe: ilYA(0.2) }),
    offre({ vuLe: ilYA(6.9) }),
  ], { maintenant: MAINTENANT });
  assert.equal(v.offres, 0, 'sous le plafond, rien n’est compté');
});

test('une offre à 7 jours pile n’est PAS comptée, à 7,01 jours elle l’est', () => {
  const pile = plafondDeDonnees([offre({ vuLe: ilYA(7) })], { maintenant: MAINTENANT });
  const apres = plafondDeDonnees([offre({ vuLe: ilYA(7.01) })], { maintenant: MAINTENANT });
  assert.equal(pile.offres, 0, 'le bord exact est inclus dans la grâce');
  assert.equal(apres.offres, 1);
});

test('le signal est `vuLe`, jamais `date` — une date fraîche ne sauve pas une offre muette', () => {
  const v = plafondDeDonnees([
    offre({ vuLe: ilYA(9), date: ilYA(0.01) }),     // date réécrite par la source
  ], { maintenant: MAINTENANT });
  assert.equal(v.offres, 1, 'la date réécrite ne doit pas blanchir une offre que personne ne reserve');
});

test('les ARTICLES de veille ne sont pas comptés : ils ont leur règle, 30 jours', () => {
  const v = plafondDeDonnees([
    offre({ type: 'article', vuLe: ilYA(20) }),
    offre({ type: 'offre', vuLe: ilYA(8) }),
  ], { maintenant: MAINTENANT });
  assert.equal(v.offres, 1, 'seule l’offre compte : la veille garde ses 30 jours');
});

test('une offre sans date lisible n’est jamais comptée (on ne juge pas sur rien)', () => {
  const v = plafondDeDonnees([offre({ vuLe: '' }), offre({ vuLe: 'pas une date' })], { maintenant: MAINTENANT });
  assert.equal(v.offres, 0);
});

test('la répartition par pays est tenue', () => {
  const v = plafondDeDonnees([
    offre({ pays: 'BE', vuLe: ilYA(8) }),
    offre({ pays: 'BE', vuLe: ilYA(9) }),
    offre({ pays: 'FR', vuLe: ilYA(10) }),
  ], { maintenant: MAINTENANT });
  assert.deepEqual(v.parPays, { BE: 2, FR: 1 });
});

test('LE POINT QUI COMPTE : la mesure ne retire AUCUNE offre de la liste qu’on lui donne', () => {
  const liste = [offre({ vuLe: ilYA(30) }), offre({ vuLe: ilYA(0.1) })];
  const avant = liste.length;
  plafondDeDonnees(liste, { maintenant: MAINTENANT });
  assert.equal(liste.length, avant, 'une mesure ne doit rien écarter');
  assert.ok(liste.every((o) => o.vuLe), 'les offres restent intactes');
});

test('le plafond ne se souvient de RIEN : deux appels identiques rendent le même verdict', () => {
  // C’est la garantie du retour, et elle tient à la forme du code : une règle
  // qui garderait une trace des offres écartées pourrait condamner pour
  // toujours ; celle-ci est pure, donc elle ne le peut pas.
  const liste = [offre({ id: 'a', vuLe: ilYA(30) }), offre({ id: 'b', vuLe: ilYA(1) })];
  const un = plafondDeDonnees(liste, { maintenant: MAINTENANT });
  const deux = plafondDeDonnees(liste, { maintenant: MAINTENANT });
  assert.deepEqual(un, deux, 'aucun état caché entre deux appels');
  assert.equal(liste.length, 2, 'la liste n’est jamais modifiée');
});

test('`joursDeServiceRestants` : le compte à rebours de la MESURE, et ses bords', () => {
  assert.equal(joursDeServiceRestants(offre({ vuLe: ilYA(0) }), { maintenant: MAINTENANT }), PLAFOND_DONNEES_JOURS);
  assert.ok(joursDeServiceRestants(offre({ vuLe: ilYA(8) }), { maintenant: MAINTENANT }) < 0, 'à huit jours, le délai est dépassé');
  assert.equal(joursDeServiceRestants(offre({ vuLe: '' }), { maintenant: MAINTENANT }), null, 'une date illisible n’autorise aucun verdict');
});

test('`donneesPerimees` dit exactement où passe la limite — et jamais pour un article', () => {
  assert.equal(donneesPerimees(offre({ vuLe: ilYA(6.99) }), { maintenant: MAINTENANT }), false);
  assert.equal(donneesPerimees(offre({ vuLe: ilYA(7) }), { maintenant: MAINTENANT }), false, 'sept jours pile : encore dans la grâce');
  assert.equal(donneesPerimees(offre({ vuLe: ilYA(7.01) }), { maintenant: MAINTENANT }), true);
  assert.equal(donneesPerimees(offre({ type: 'article', vuLe: ilYA(90) }), { maintenant: MAINTENANT }), false, 'un article ne se juge pas au service : son verrou est sa date de publication');
  assert.equal(donneesPerimees(offre({ vuLe: '' }), { maintenant: MAINTENANT }), false, 'sans date lisible, aucun verdict');
  assert.equal(donneesPerimees(null, { maintenant: MAINTENANT }), false);
});

test('la MESURE et son compte désignent le MÊME ensemble, sur le catalogue réel', () => {
  // ⚠ LE TITRE A CHANGÉ LE 14/10/2026. Il disait « le COMPTE et le RETRAIT » : il
  //  n'y a plus de retrait par cette fonction — c'est la règle de la vie d'une
  //  carte qui efface. Ce qui reste à garantir est l'invariant qui a toujours
  //  compté : la fonction qui MESURE est la même que celle que l'outil emploie,
  //  donc deux chiffres ne peuvent pas désigner deux ensembles.
  //  ⚠ ET L'HORLOGE A CHANGÉ AUSSI, pour une raison qui mérite d'être dite : ce
  //  relevé se faisait sur une date FIGÉE (le 12/10), ce qui allait tant que le
  //  catalogue était antérieur. Un catalogue vieilli de deux jours passait alors
  //  en âge négatif, et l'épreuve annonçait « 0 offre au-delà du délai » — verte
  //  pour la pire des raisons. Un relevé sur le catalogue réel se fait à l'heure
  //  réelle, sinon il mesure une époque qui n'existe plus.
  const d = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
  const maintenant = Date.now();
  const compte = plafondDeDonnees(d.offres, { maintenant });
  const designees = d.offres.filter((o) => donneesPerimees(o, { maintenant }));
  assert.equal(compte.offres, designees.length, 'le chiffre publié et les offres désignées doivent être le même ensemble');
  assert.equal(designees.filter((o) => o.type === 'article').length, 0, 'aucun article par cette fonction');
  // ⚠ CETTE ASSERTION EXIGEAIT « au moins une offre » ET ELLE A ÉTÉ RETIRÉE LE
  //  14/10/2026 — parce qu'elle est devenue FAUSSE À RAISON. Après le premier
  //  passage de la règle, le catalogue ne contient plus AUCUNE offre dont la
  //  source se tait depuis plus de sept jours (relevé : âge de service maximal
  //  6,98 j). Exiger un chiffre non nul reviendrait à exiger que le catalogue
  //  soit sale pour que l'épreuve passe — exactement le renversement qu'on
  //  s'interdit. On rapporte le chiffre, on ne l'impose pas.
  console.log(`   mesure à sept jours : ${compte.offres} offre(s) sans service depuis plus de ${PLAFOND_DONNEES_JOURS} jours (0 est une bonne nouvelle, pas un défaut)`);
});

/* =============================================================================
   LES INTERRUPTEURS — CE QUI EST ÉTEINT DEPUIS LE 14/10/2026, ET POURQUOI.
   ============================================================================= */

test('le contrôle de page est éteint : budget nul, sorties éteintes, correction éteinte', () => {
  // ⚠ CETTE ÉPREUVE A CHANGÉ DE SENS LE 14/10/2026, ET LE DIRE EST LE PLUS IMPORTANT.
  //  Elle exigeait `true` partout : B avait décidé « la page décide de la carte »
  //  le 13/10, et l'allumage était un acte visible dans le diff. Le 14/10, la règle
  //  de la vie d'une carte a supprimé la question — le retrait ne se décide plus sur
  //  une preuve, donc il n'y a plus de preuve à lire. Les trois constantes
  //  retombent à `false`/`0`, et c'est l'allumage INVERSE qui devient l'acte visible.
  assert.equal(OFFRES_SORTENT_SUR_VERDICT_ACTIF, false, 'une page ne décide plus d’une sortie');
  assert.equal(PROMOTION_DECIDE_LA_CARTE_ACTIF, false, 'ni d’une correction de prix');
  assert.equal(CONTROLES_COMMUNAUTE_PAR_PASSAGE, 0, 'plus une seule page n’est ouverte');
  assert.equal(CONTROLES_ENSEIGNE_PAR_PASSAGE, 0);
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  // L'ancien interrupteur unique du plafond ne doit pas revenir : la règle n'a plus
  // d'interrupteur, elle a une échéance. On le vérifie sur les LIGNES DE CODE et non
  // sur le texte entier : la constante est encore NOMMÉE dans un commentaire
  // d'histoire, et c'est très bien ainsi (même méthode que l'épreuve de la veille).
  const lignesDeCode = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.ok(!lignesDeCode.some((l) => l.includes('PLAFOND_OFFRES_ACTIF')),
    'l’interrupteur du plafond ne doit plus exister dans le code : il a été remplacé par une échéance');
});

test('le volet de la VEILLE est allumé par un acte explicite, et n’est pas entraîné par les offres', () => {
  // ⚠ LES DEUX ASSERTIONS SUR LES OFFRES ONT CHANGÉ LE 14/10/2026 : elles exigeaient
  //  `true` (la règle de B du 13/10). Elles exigent `false` aujourd'hui, parce que
  //  la règle a changé — pas par prudence revenue, mais par remplacement.
  //  L'INTENTION DE L'ÉPREUVE, ELLE, N'A PAS BOUGÉ, et c'est elle qui compte :
  //  chaque moitié du catalogue suit SON interrupteur, jamais celui de l'autre.
  assert.equal(VEILLE_SEPT_JOURS_ACTIVE, true, 'allumée sur le mot de B : la veille passe de 30 à 7 jours');
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /export const PLAFOND_ACTIF/, 'l’interrupteur unique qui commandait les deux moitiés ne doit pas revenir');
  assert.match(src, /const JOURS_VEILLE = VEILLE_SEPT_JOURS_ACTIVE \? 7 : 30/,
    'la veille suit SON interrupteur : 30 jours tant qu’il est éteint');
  const ligneVeille = src.split('\n').find((l) => l.includes('JOURS_VEILLE =')) || '';
  assert.doesNotMatch(ligneVeille, /OFFRES/, 'la veille ne doit RIEN devoir aux offres');
  // La règle d'effacement, elle, n'a aucun interrupteur : elle s'arrête sur une date.
  const ligneRegle = src.split('\n').find((l) => l.includes('verdictDeCalendrier(o, { tours')) || '';
  assert.doesNotMatch(ligneRegle, /ACTIF|SWITCH|INTERRUPTEUR/, 'aucun interrupteur dans la règle : une date ne se lève pas');
});

/* =============================================================================
   LE BILAN DE DONNÉES — ET SON CONTRAT AVEC LE PANNEAU.
   ============================================================================= */

test('le bilan publie ce que la règle A FAIT, sous le nom de la règle', () => {
  // ⚠ LE BLOC S'APPELAIT `plafond7j`. Il annonçait un plafond de sept jours qui
  //  n'existe plus — un panneau qui lit ce nom finit par écrire « 7 » là où le
  //  catalogue applique « 5 ». Il s'appelle `carte`, et il porte ce que le passage
  //  vient de faire : des effacements RÉELS, et des reprises.
  const b = bilanDonnees({
    connues: new Map(),
    offres: [],
    journal: [{ source: 'vie-de-la-carte', ok: true, mode: 'actif', effacees: 1215, octets: 36e6, parPays: { BE: 12 }, revenus: 41, articlesHorsDelai: 230, joursVeille: 7, modeVeille: 'actif' }],
    maintenant: MAINTENANT,
  });
  assert.equal(b.carte.jours, VIE_AFFICHEE_JOURS, 'le panneau doit annoncer CINQ jours, pas sept');
  assert.equal(b.carte.mode, 'actif');
  assert.equal(b.carte.effacees, 1215, 'et le nombre de cartes réellement effacées');
  assert.equal(b.carte.octets, 36e6);
  assert.deepEqual(b.carte.parPays, { BE: 12 });
  assert.equal(b.carte.reprises, 41, 'l’onglet doit dire COMBIEN de cartes une source a reprises');
  assert.equal(b.carte.veille.mode, 'actif');
  assert.equal(b.carte.veille.jours, 7);
  assert.equal(b.carte.veille.horsDelaiEnStock, 230);
  // Le contrôle de page : réduit à une TRACE, et lisible. Le panneau doit pouvoir
  // constater qu'il est éteint au lieu de le croire.
  assert.equal(b.carte.controleDePage.mode, 'eteint');
  assert.equal(b.carte.controleDePage.budgetParPassage, 0);
  assert.equal(b.carte.controleDePage.sortiesSurVerdict, false);
});

test('sans journal de règle, le bilan ne prétend pas que quelque chose a été effacé', () => {
  const b = bilanDonnees({ connues: new Map(), offres: [], journal: [], maintenant: MAINTENANT });
  assert.equal(b.carte.effacees, 0, 'aucun chiffre inventé');
  assert.equal(b.carte.jours, VIE_AFFICHEE_JOURS);
  // La règle n'a pas d'interrupteur : on ne peut pas la décrire « en mesure ».
  assert.equal(b.carte.mode, 'actif', 'la règle est active dès qu’elle est écrite : dire « mesure » serait faux');
  assert.equal(b.carte.veille.mode, 'mesure', 'la veille, elle, garde son interrupteur : sans verdict écrit, on annonce une MESURE');
  assert.equal(b.carte.veille.jours, 30);
});

test('le bilan compte la veille sur le PUBLIÉ, séparément du stock', () => {
  // Le passage compte le STOCK (`horsDelaiEnStock`) ; l’écran n’en montre qu’un
  // sous-ensemble, écrêté par un quota par pays. Les deux chiffres diffèrent, et
  // les confondre ferait lire le premier comme une exagération : on donne les deux.
  const b = bilanDonnees({
    connues: new Map(),
    offres: [
      { type: 'article', pays: 'BE', date: ilYA(20), image: '' },   // publié, hors délai
      { type: 'article', pays: 'BE', date: ilYA(1), image: '' },    // publié, dans le délai
      { type: 'offre', pays: 'BE', vuLe: ilYA(20), date: ilYA(20), image: '' },
    ],
    journal: [{ source: 'vie-de-la-carte', ok: true, mode: 'actif', articlesHorsDelai: 548, joursVeille: 30, modeVeille: 'mesure' }],
    maintenant: MAINTENANT,
  });
  assert.equal(b.carte.veille.articles.publies, 2, 'la veille publiée est comptée à part des offres');
  assert.equal(b.carte.veille.articles.hors7j, 1, 'un seul article publié dépasse sept jours');
  assert.equal(b.carte.veille.horsDelaiEnStock, 548, 'le stock garde son chiffre, et il n’est pas présenté comme le publié');
});

test('le poids d’un visuel est lu sur le fichier, et 0 quand il n’y en a pas', () => {
  assert.equal(poidsDuVisuel(''), 0);
  assert.equal(poidsDuVisuel('img/inexistant-xyz.jpg'), 0);
  const dossier = new URL('../docs/img/', import.meta.url);
  const un = readdirSync(dossier).find((f) => /\.(jpe?g|png|webp)$/i.test(f));
  assert.ok(un, 'une image publiée doit exister pour que la mesure ait un sens');
  const poids = poidsDuVisuel('img/' + un);
  assert.ok(poids > 1000, `un visuel publié doit peser plus d’un kilo-octet : ${poids}`);
});

test('le bilan de données compte les images servies et les orphelines', () => {
  // On référence une image QUI EXISTE (mes défauts de test viennent toujours du
  // même endroit : un nom fabriqué qui ne correspond à rien, donc un compte qui
  // tombe juste par accident ou faux sans qu’on sache pourquoi).
  const un = readdirSync(new URL('../docs/img/', import.meta.url)).find((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const b = bilanDonnees({
    connues: new Map(),
    offres: [{ type: 'offre', pays: 'BE', image: 'img/' + un, vuLe: ilYA(1) }],
    journal: [],
    maintenant: MAINTENANT,
  });
  assert.ok(b.images.fichiers > 1000, `images publiées attendues : ${b.images.fichiers}`);
  assert.equal(b.images.servies + b.images.orphelines, b.images.fichiers);
  assert.equal(b.images.servies, 1, 'une seule image est référencée ici');
  assert.equal(b.images.orphelines, b.images.fichiers - 1);
  assert.ok(b.images.mo > 100, `poids attendu en centaines de Mo : ${b.images.mo}`);
  assert.equal(b.images.moyenneKo > 0, true);
});

test('le bilan de données dit où va chaque donnée, et n’oublie pas ce qui ne sort jamais', () => {
  const b = bilanDonnees({ connues: new Map(), offres: [], journal: [], maintenant: MAINTENANT });
  assert.ok(Array.isArray(b.destinations) && b.destinations.length >= 4);
  const texte = JSON.stringify(b.destinations);
  assert.match(texte, /GitHub Pages/, 'la publication doit y figurer');
  assert.match(texte, /nulle part ailleurs/i, 'les adresses restent chez B : ça doit être écrit');
  assert.match(texte, /jamais/i, 'ce qui ne sort jamais doit être écrit noir sur blanc');
});

test('le bilan de données voyage avec l’état publié (le panneau le lit d’un seul appel)', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /donnees: sortie\.donnees/, 'l’état publié doit porter le bilan');
  assert.match(src, /donnees: bilanDonnees\(/, 'le catalogue doit le calculer');
  assert.match(src, /carte: sortie\.donnees\.carte/, 'et l’exploitation doit lire le bloc sous son nom actuel');
});

test('ageJours rend null sur une date illisible, et un âge sinon', () => {
  assert.equal(ageJours('', MAINTENANT), null);
  assert.equal(ageJours('n’importe quoi', MAINTENANT), null);
  assert.equal(Math.round(ageJours(ilYA(3), MAINTENANT)), 3);
});

/* =============================================================================
   LE COMPTE DES REPRISES — le chiffre des soldes, mesuré et non promis.
   ============================================================================= */

test('le passage COMPTE les reprises (le chiffre des soldes est mesuré, pas promis)', () => {
  // ⚠ CETTE ÉPREUVE A CHANGÉ DE SENS LE 14/10/2026 : elle exigeait que le compte
  //  se fasse sur `vuLe > PLAFOND_DONNEES_JOURS` (la règle des sept jours). Le
  //  compte se fait maintenant sur le COMPTEUR D'AFFICHAGE, à cinq jours — et la
  //  remise à zéro qui l'accompagne est la garantie qu'une carte servie au-delà
  //  des cinq jours ne sera pas emportée au passage suivant.
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /const reprise = ageJours\(avant\.premiereVue \|\| avant\.vuLe\) > VIE_AFFICHEE_JOURS/,
    'la reprise se compte sur le compteur d’affichage');
  assert.match(src, /if \(reprise\) \{\s*\n\s*retours\+\+;/,
    'et elle se compte au moment de la fusion');
  // ⚠ LE COMPTE DU PAYS SE FAIT DANS LE MÊME BLOC QUE LE TOTAL — ajouté le
  //  15/10/2026 avec la publication des compteurs par pays. C'est l'invariant qui
  //  rend la tuile du panneau honnête : si le découpage vivait dans une seconde
  //  boucle, la somme des pays pourrait ne plus valoir le total, et le panneau
  //  afficherait sous un pays un chiffre qui ne lui appartient pas.
  assert.match(src, /if \(reprise\) \{\s*\n\s*retours\+\+;\s*\n\s*const p = offre\.pays \|\| avant\.pays \|\| '\?';\s*\n\s*reprisesParPays\[p\] = \(reprisesParPays\[p\] \|\| 0\) \+ 1;/,
    'la part du pays doit s’incrémenter dans le MÊME bloc que le total, jamais dans une autre boucle');
  assert.match(src, /parPaysReprises: reprisesParPays/, 'et la répartition doit être publiée avec le total');
  assert.match(src, /revenus: retours/, 'puis elle est publiée dans le journal du passage');
  assert.match(src, /aucune liste d'exclusion/i, 'la raison écrite doit dire que le retour est possible');
});

/* =============================================================================
   LE CONTRÔLE DES SOURCES — OUTIL DORMANT, MAIS ÉPROUVÉ.
   Plus une page n'est ouverte par le passage (budget nul, voir plus haut). Ces
   épreuves tiennent l'outil : celui qui servirait si la question revenait.
   ============================================================================= */

test('verdictDans lit le verdict de la page, et ne confond rien', () => {
  assert.equal(verdictDans('{"isExpired":true,"status":"Activated"}'), 'expiree');
  assert.equal(verdictDans('{"isExpired": false }'), 'vivante', 'les espaces ne doivent pas changer le verdict');
  assert.equal(verdictDans('<html>rien de tel</html>'), '', 'une page muette ne rend AUCUN verdict');
  assert.equal(verdictDans(''), '');
  assert.equal(verdictDans(null), '');
});

test('un verdict se revérifie après sept jours, pas avant', () => {
  assert.equal(verdictPerime(undefined, MAINTENANT), true, 'jamais contrôlé : à contrôler');
  assert.equal(verdictPerime({ vuLe: ilYA(1) }, MAINTENANT), false);
  assert.equal(verdictPerime({ vuLe: ilYA(VERDICT_SOURCE_MAX_AGE_JOURS) }, MAINTENANT), false, 'sept jours pile : encore frais');
  assert.equal(verdictPerime({ vuLe: ilYA(VERDICT_SOURCE_MAX_AGE_JOURS + 0.1) }, MAINTENANT), true);
  assert.equal(verdictPerime({ vuLe: 'pas une date' }, MAINTENANT), true, 'une date illisible = à revérifier, jamais un verdict');
});

test('les candidats au contrôle : au-delà du délai, joignables, un seul par source', () => {
  const liste = [
    offre({ id: 'a', sourceId: 's1', vuLe: ilYA(8), lienPage: 'https://exemple.be/a' }),
    offre({ id: 'b', sourceId: 's1', vuLe: ilYA(9), lienPage: 'https://exemple.be/b' }),
    offre({ id: 'c', sourceId: 's2', vuLe: ilYA(8), lienPage: 'https://exemple.be/c' }),
    offre({ id: 'd', sourceId: 's3', vuLe: ilYA(1), lienPage: 'https://exemple.be/d' }),
    offre({ id: 'e', sourceId: 's4', vuLe: ilYA(8), lienPage: '' }),
    offre({ id: 'f', type: 'article', sourceId: 's5', date: ilYA(30), lienPage: 'https://journal.be/f' }),
    offre({ id: 'g', sourceId: 's6', vuLe: ilYA(8), lienPage: 'https://news.google.com/rss/articles/xyz' }),
  ];
  const choisis = candidatsVerdict(liste, { limite: 3, maintenant: MAINTENANT });
  assert.deepEqual(choisis.map((o) => o.id).sort(), ['a', 'b', 'c'],
    'la limite est respectée, et le budget n’est pas gaspillé tant qu’il reste des offres à voir');
  assert.equal(new Set(choisis.slice(0, 2).map((o) => o.sourceId)).size, 2,
    'les deux premiers viennent de sources DIFFÉRENTES : c’est la politesse (pas trois lectures au même hôte)');
  const deux = candidatsVerdict(liste, { limite: 2, maintenant: MAINTENANT });
  assert.equal(new Set(deux.map((o) => o.sourceId)).size, 2);
  assert.ok(!choisis.some((o) => ['d', 'e', 'f', 'g'].includes(o.id)),
    'ni dans le délai, ni sans page, ni un article de veille, ni un redirecteur Google News');
});

test('un verdict frais n’est pas redemandé : on ne repaie pas une page déjà lue', () => {
  const verdicts = { a: { statut: 'vivante', vuLe: ilYA(0.5) } };
  const liste = [
    offre({ id: 'a', sourceId: 's1', vuLe: ilYA(9), lienPage: 'https://exemple.be/a' }),
    offre({ id: 'b', sourceId: 's2', vuLe: ilYA(9), lienPage: 'https://exemple.be/b' }),
  ];
  assert.deepEqual(candidatsVerdict(liste, { verdicts, limite: 5, maintenant: MAINTENANT }).map((o) => o.id), ['b']);
});

test('la lecture s’arrête dès qu’elle a le verdict — et elle le lit vraiment', async () => {
  // Un serveur local publie le verdict, puis DÉVERSE 400 Ko de remplissage : si
  // la lecture ne coupait pas, on paierait tout. C'est la promesse de discrétion,
  // et elle se mesure au lieu de se promettre — même si plus personne ne l'appelle
  // aujourd'hui : un outil dormant qui lit mal redeviendrait un outil dangereux.
  const serveur = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.write('<html><script>window.__DATA__ = {"isExpired":true,"status":"Activated"};</script>');
    res.end('x'.repeat(400 * 1024));
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  try {
    const v = await lireVerdictSource(`http://127.0.0.1:${serveur.address().port}/offre`);
    assert.equal(v.etat, 'expiree');
    assert.ok(v.octets < 200 * 1024, `la lecture doit s’arrêter tôt : ${v.octets} octets lus`);
  } finally { serveur.close(); }
});

test('une page muette n’est PAS un verdict — jamais « vivante » par défaut', async () => {
  const serveur = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body>page sans verdict</body></html>');
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  try {
    const v = await lireVerdictSource(`http://127.0.0.1:${serveur.address().port}/offre`);
    assert.equal(v.etat, 'sans-signal', 'ni morte ni vivante : « je ne sais pas » est une réponse à part entière');
  } finally { serveur.close(); }
});

test('la file de contrôle classe comme la vue classe — deux programmes, une règle', () => {
  // MESURÉ EN SONDANT MA PROPRE FILE, le 13/10/2026 : ses deux premières lectures
  // visaient des remises de 99 % et 91 %, que la carte REFUSE d'afficher. L'ordre
  // de la file doit donc se lire sur le même pourcentage que la vue — sinon on
  // paie des requêtes chez les partenaires pour des fiches que personne ne voit.
  // La règle appartient à l'APPLICATION : on l'extrait du fichier livré et on
  // évalue ce même bloc, plutôt que d'en écrire une seconde version qui
  // finirait par diverger sans que personne ne compare jamais les deux.
  // ⚠ Les règles vivent dans leur MODULE depuis le 15/10/2026 (app.js les
  // importe, le panneau d'admin aussi) : on les lit là, sans découper de tranche
  // dans app.js — la tranche textuelle est ce qui a produit un prédicat amputé ce
  // jour-là (deux lignes de déclaration, une seule prise, 875 cartes d'écart).
  const app = readFileSync(new URL('../public/regles-affichage.js', import.meta.url), 'utf8')
    .replace(/^export /gm, '');      // le module est exporté : on le relit « à plat » pour l'évaluer
  const bloc = app.slice(app.indexOf('const REMISE_MIN'));
  assert.ok(bloc.length > 0, 'le bloc des règles de remise doit rester lisible dans regles-affichage.js');
  const { remiseMontrable } = vm.runInContext(bloc + '\n;({ remiseMontrable })', vm.createContext({}));
  const of = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8')).offres;
  const ecarts = [];
  for (const o of of) {
    const vue = remiseMontrable(o) || 0;
    const file = pourcentAffiche(o);
    if (vue !== file && ecarts.length < 5) ecarts.push(`${o.id} : vue ${vue} / file ${file}`);
  }
  assert.equal(ecarts.length, 0, `la file doit classer sur ce que la carte montre : ${ecarts.join(' | ')}`);
});
