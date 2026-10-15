/* =============================================================================
   LE SUIVI DES CARTES — CE QU'ON MONTRE, ET CE QU'ON NE LAISSE PAS LA RÈGLE LIRE.

   Demande de B, 14/10/2026 : « un onglet où je vois les cartes effacées et les
   cartes bloquées pour une raison ou une autre. L'objectif est de vérifier la
   véracité des cartes effacées. »

   DEUX CHOSES À TENIR, ET LA SECONDE EST LA PLUS IMPORTANTE :

   1. LA PARTITION. Une carte affichée est dans ses cinq jours, bloquée (avec une
      raison écrite), ou sans date lisible — jamais deux à la fois, jamais aucune.
      C'est le critère d'acceptation du panneau : `dansLesCinqJours + bloquees +
      sansDate === cartes`. Sans lui, une liste peut sembler juste en ayant oublié
      la moitié du catalogue.

   2. LA RÈGLE NE LIT PAS SON PROPRE JOURNAL (R.7). Le registre a été ajouté pour
      que B puisse vérifier les effacements — pas pour que la décision change.
      L'épreuve relit donc le CORPS de `verdictDeCalendrier`, commentaires
      retirés, et refuse qu'il mentionne le registre, les effacements ou les
      retours. C'est la seule façon de garantir que « aucune liste d'exclusion »
      reste vrai alors qu'une liste existe : elle est écrite, et jamais relue par
      celui qui condamne.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  VIE_AFFICHEE_JOURS, etatDesCartes, raisonDeBlocage, carteEffacee,
  ajouterEffacements, marquerRetours, elaguerSuivi, extraitSuivi, relireSuivi,
  neufSuivi, ecrireSuivi, lireSuivi, SUIVI_PUBLIE_MAX, SUIVI_JOURS_CONSERVES,
} from '../collecteur.mjs';

const RACINE = new URL('..', import.meta.url);
const JOUR = 86400000;
const MAINTENANT = Date.parse('2026-10-14T22:00:00Z');
const ilYA = (jours) => new Date(MAINTENANT - jours * JOUR).toISOString();

/** Une carte, avec la source qui l'a servie au tour 10.
 *  ⚠ CHAQUE CARTE PORTE SA PROPRE ADRESSE : l'identité d'une offre est dérivée
 *  de son adresse (`cleDe`), pas de son `id`. Trois cartes qui partagent la même
 *  adresse sont UNE SEULE entrée au registre — la première version de ces
 *  fixtures s'y est laissé prendre, et trois épreuves comptaient 1 au lieu de 12. */
const carte = (o = {}) => {
  const id = o.id || 'x';
  return {
    id, type: 'offre', pays: 'BE', sourceId: 'dealabs-tendance', titre: 'Un truc à -50 %',
    lienPage: `https://exemple.be/${id}`, prix: 12.5,
    serviceAuTour: 10, premiereVue: ilYA(1), vuLe: ilYA(1),
    ...o,
    lienPage: o.lienPage || `https://exemple.be/${id}`,
  };
};
/** La source a reparlé depuis le dernier service : l'offre aurait dû être effacée. */
const RELUE = { 'dealabs-tendance': 12 };
/** La source n'a pas reparlé : son compteur n'a pas bougé. */
const MUETTE = { 'dealabs-tendance': 10 };

/* ------------------------------------------------------------------ *
 *  1. LA PARTITION — le critère d'acceptation du panneau.
 * ------------------------------------------------------------------ */

test('la liste publiée sert d’abord ce qui se VÉRIFIE (violation, puis source muette)', () => {
  // POURQUOI CETTE ÉPREUVE EXISTE, ET POURQUOI ELLE EST SUR FIXTURES. Vécu le
  // 15/10/2026 : la liste publiée est bornée à 200 entrées et elle était triée par
  // âge décroissant — donc remplie par les « source-sans-compteur » (les ventes
  // flash recopiées), au point que **les 28 violations n'y figuraient aucune**.
  // Or c'est ce que B ouvre pour vérifier les effacements. Une épreuve sur le
  // catalogue réel ne peut pas le prouver : il n'y a des violations qu'un passage
  // sur cinq environ (le transit d'un passage les emporte au suivant). Sur
  // fixtures, la preuve est là à chaque exécution — et elle DISCRIMINE : la plus
  // ancienne des trois cartes est justement celle qui doit passer en dernier.
  const offres = [
    carte({ id: 'flash', sourceId: 'flash-at', serviceAuTour: 1, premiereVue: ilYA(7) }),      // la plus vieille
    carte({ id: 'muette', sourceId: 'pepper-pl', serviceAuTour: 10, premiereVue: ilYA(6.5) }), // source muette
    carte({ id: 'fautive', sourceId: 'dealabs-tendance', serviceAuTour: 1, premiereVue: ilYA(5.5) }),
  ];
  const tours = { 'dealabs-tendance': 12, 'pepper-pl': 10 };
  const etat = etatDesCartes(offres, { maintenant: MAINTENANT, tours });
  assert.equal(etat.bloquees, 3, 'les trois cartes sont bloquées, chacune pour sa raison');
  assert.deepEqual(etat.liste.map((x) => [x.raison, x.ageJours]), [
    ['violation', 5.5], ['source-muette', 6.5], ['source-sans-compteur', 7],
  ], 'la liste doit servir ce qui se vérifie AVANT la plus ancienne des cartes sans compteur');
  // ET LE CHIFFRE DU PANNEAU SUIT LA PLUS ANCIENNE OÙ QU'ELLE SOIT — c'était lu
  // dans `liste[0]`, ce qui aurait annoncé « 5,5 jours » en montrant 7 jours.
  assert.equal(etat.plusAncienneJours, 7,
    'la plus ancienne annoncée est le plus grand âge réel, pas la première de la liste');
});

test('la partition tient : chaque carte est dans un seau, et un seul', () => {
  const offres = [
    carte({ id: 'jeune', premiereVue: ilYA(2) }),                       // dans ses cinq jours
    carte({ id: 'pile', premiereVue: ilYA(VIE_AFFICHEE_JOURS) }),       // cinq jours pile
    carte({ id: 'muette', premiereVue: ilYA(7), serviceAuTour: 10 }),   // bloquée : source muette
    carte({ id: 'sans-tour', sourceId: 'flash-at', serviceAuTour: 1, premiereVue: ilYA(7) }), // bloquée : aucun compteur
    carte({ id: 'sans-date', premiereVue: null, vuLe: null }),          // aucun verdict sur rien
    carte({ id: 'article', type: 'article', premiereVue: ilYA(40) }),   // la veille a sa règle
  ];
  const etat = etatDesCartes(offres, { maintenant: MAINTENANT, tours: MUETTE });
  assert.equal(etat.cartes, 5, 'les articles ne sont pas des cartes');
  assert.equal(etat.dansLesCinqJours + etat.bloquees + etat.sansDate, etat.cartes,
    'la somme des trois seaux doit égaler le nombre de cartes — sinon une liste ment');
  assert.equal(etat.dansLesCinqJours, 2);
  assert.equal(etat.bloquees, 2);
  assert.equal(etat.sansDate, 1);
  const raisons = etat.liste.map((x) => x.raison).sort();
  assert.deepEqual(raisons, ['source-muette', 'source-sans-compteur']);
});

/* ------------------------------------------------------------------ *
 *  2. LES RAISONS — parlantes, distinctes, et jamais un code nu.
 * ------------------------------------------------------------------ */

test('une carte dans ses cinq jours n’est pas « bloquée »', () => {
  assert.equal(raisonDeBlocage(carte({ premiereVue: ilYA(4.9) }), { maintenant: MAINTENANT, tours: MUETTE }), null);
  assert.equal(raisonDeBlocage(carte({ premiereVue: ilYA(5) }), { maintenant: MAINTENANT, tours: MUETTE }), null,
    'cinq jours pile reste DANS la garantie (R.1)');
});

test('« source muette » dit que la source n’a pas reparlé, chiffres à l’appui', () => {
  const r = raisonDeBlocage(carte({ premiereVue: ilYA(7) }), { maintenant: MAINTENANT, tours: MUETTE });
  assert.equal(r.raison, 'source-muette');
  assert.match(r.detail, /tour 10/, 'le détail doit porter le tour du dernier service');
});

test('« source sans compteur » distingue la source inconnue de la source sous le seuil', () => {
  const inconnue = raisonDeBlocage(carte({ sourceId: 'flash-at', premiereVue: ilYA(7), serviceAuTour: 1 }),
    { maintenant: MAINTENANT, tours: MUETTE });
  assert.equal(inconnue.raison, 'source-sans-compteur');
  assert.match(inconnue.detail, /déclarée nulle part/);
  const declaree = raisonDeBlocage(carte({ sourceId: 'adr-zooplus-be-3', premiereVue: ilYA(6), serviceAuTour: null }),
    { maintenant: MAINTENANT, tours: MUETTE });
  assert.equal(declaree.raison, 'source-sans-compteur');
  assert.match(declaree.detail, /sous le seuil/);
});

test('une carte que la règle DEVAIT effacer est signalée comme une violation', () => {
  const r = raisonDeBlocage(carte({ premiereVue: ilYA(9) }), { maintenant: MAINTENANT, tours: RELUE });
  assert.equal(r.raison, 'violation');
  assert.match(r.detail, /tour 12/);
  assert.match(r.detail, /tour 10/);
});

test('une raison de silence du passage est reprise telle quelle', () => {
  const r = raisonDeBlocage(carte({ premiereVue: ilYA(7) }), { maintenant: MAINTENANT, tours: MUETTE,
    silences: { 'dealabs-tendance': 'sa source était au repos à ce passage' } });
  assert.equal(r.detail, 'sa source était au repos à ce passage');
});

/* ------------------------------------------------------------------ *
 *  3. LE REGISTRE — borné, sans jugement, et il se souvient du PREMIER
 *     effacement (c'est cette date que B regardera).
 * ------------------------------------------------------------------ */

test('le registre n’écrase pas la date du premier effacement', () => {
  const f = carteEffacee(carte({ premiereVue: ilYA(9) }), { maintenant: MAINTENANT, tours: RELUE });
  let s = neufSuivi();
  s = ajouterEffacements(s, [f], { maintenant: MAINTENANT });
  assert.equal(s.compte.effacees, 1);
  // Le même effacement, revu trois heures plus tard (un autre passage) :
  const plusTard = ajouterEffacements(s, [{ ...f, effaceeLe: new Date(MAINTENANT + 3 * 3600000).toISOString() }],
    { maintenant: MAINTENANT + 3 * 3600000 });
  assert.equal(plusTard.compte.effacees, 1, 'un effacement déjà connu ne se compte pas deux fois');
  assert.equal(Object.values(plusTard.effacees)[0].effaceeLe, f.effaceeLe, 'la première date est la bonne');
});

test('un retour est compté UNE fois, et se voit sur la fiche', () => {
  const f = carteEffacee(carte({ premiereVue: ilYA(9) }), { maintenant: MAINTENANT, tours: RELUE });
  let s = ajouterEffacements(neufSuivi(), [f], { maintenant: MAINTENANT });
  const r1 = marquerRetours(s, [f.cle], { maintenant: MAINTENANT + 1000 });
  assert.equal(r1.revenues.length, 1);
  assert.equal(r1.suivi.compte.revenues, 1);
  assert.ok(r1.suivi.effacees[f.cle].revenueLe, 'la fiche doit porter la date du retour');
  // Un second retour de la même carte ne recompte pas : c'est la MÊME carte qui
  // est revenue, et le chiffre doit dire combien de condamnations ont été démenties.
  const r2 = marquerRetours(r1.suivi, [f.cle], { maintenant: MAINTENANT + 2000 });
  assert.equal(r2.revenues.length, 0);
  assert.equal(r2.suivi.compte.revenues, 1);
});

test('un retour ne sort pas la carte du registre : on ne « dé-condamne » rien', () => {
  const f = carteEffacee(carte(), { maintenant: MAINTENANT, tours: RELUE });
  const s = marquerRetours(ajouterEffacements(neufSuivi(), [f], { maintenant: MAINTENANT }), [f.cle], { maintenant: MAINTENANT });
  assert.ok(s.suivi.effacees[f.cle], 'la fiche reste : la règle ne relit rien, elle ne décide donc rien');
  assert.equal(s.suivi.effacees[f.cle].revenueLe !== null, true);
});

test('le ménage oublie par le délai, jamais parce que la carte a quitté le catalogue', () => {
  const vieille = carteEffacee(carte({ id: 'vieille' }), { maintenant: MAINTENANT - 31 * JOUR, tours: RELUE });
  const recente = carteEffacee(carte({ id: 'recente' }), { maintenant: MAINTENANT, tours: RELUE });
  const s = ajouterEffacements(neufSuivi(), [vieille, recente], { maintenant: MAINTENANT });
  const { suivi, oubliees } = elaguerSuivi(s, { maintenant: MAINTENANT });
  assert.equal(oubliees, 1, `au-delà de ${SUIVI_JOURS_CONSERVES} jours, une fiche n’apprend plus rien`);
  assert.equal(Object.keys(suivi.effacees).length, 1);
});

test('le ménage tient aussi la borne de taille (un contrôle ne doit pas peser plus que la règle)', () => {
  let s = neufSuivi();
  const fiches = Array.from({ length: 12 }, (_, i) => carteEffacee(carte({ id: 'c' + i }),
    { maintenant: MAINTENANT - i * 1000, tours: RELUE }));
  s = ajouterEffacements(s, fiches, { maintenant: MAINTENANT });
  const { suivi } = elaguerSuivi(s, { maintenant: MAINTENANT, max: 5 });
  assert.equal(Object.keys(suivi.effacees).length, 5);
  assert.ok(suivi.compte.oubliees >= 7);
});

test('l’extrait publié est borné, et les effacements ne chassent pas les blocages', () => {
  let s = neufSuivi();
  const fiches = Array.from({ length: SUIVI_PUBLIE_MAX + 40 }, (_, i) => carteEffacee(carte({ id: 'c' + i }),
    { maintenant: MAINTENANT - i * 1000, tours: RELUE }));
  s = ajouterEffacements(s, fiches, { maintenant: MAINTENANT });
  const e = extraitSuivi(s, { max: SUIVI_PUBLIE_MAX, maintenant: MAINTENANT });
  assert.equal(e.effacees.length, SUIVI_PUBLIE_MAX);
  assert.equal(e.effaceesRetenues, SUIVI_PUBLIE_MAX + 40, 'le compte total doit rester lisible');
});

test('un registre illisible ne fait pas tomber la collecte', () => {
  assert.deepEqual(relireSuivi('{{{'), neufSuivi());
  assert.deepEqual(relireSuivi(''), neufSuivi());
  const dossier = mkdtempSync(path.join(os.tmpdir(), 'kazendra-suivi-'));
  try {
    assert.deepEqual(lireSuivi(path.join(dossier, 'absent.json')), neufSuivi());
    writeFileSync(path.join(dossier, 'casse.json'), 'pas du json', 'utf8');
    assert.deepEqual(lireSuivi(path.join(dossier, 'casse.json')), neufSuivi());
    // L'ÉCHEC D'ÉCRITURE SE PROUVE SUR UN CHEMIN IMPOSSIBLE **ORDINAIRE** : un
    // dossier dont le parent est un FICHIER (`ENOTDIR`, immédiat).
    //
    //  ⚠ ET PAS SUR `/proc`, QUI A COÛTÉ UNE HEURE LE 14/10/2026. La première
    //  version éprouvait l'échec d'écriture sous `/proc/interdit/…` — comme le
    //  fait déjà une épreuve voisine. Sauf que celle-ci créait le dossier au
    //  besoin : `mkdirSync('/proc/interdit', { recursive: true })` **ne renvoie
    //  JAMAIS**. Relevé : ni exception, ni code de sortie, `timeout` seul en
    //  sort, et l'épreuve restait pendue sans un mot. Le dossier a donc été
    //  retiré d'`ecrireSuivi()`, et l'épreuve se fait désormais sur un vrai
    //  refus, qui répond tout de suite. La leçon vaut pour tout contrôle : un
    //  contrôle qui pend est pire qu'un contrôle rouge — il n'y a rien à lire.
    const fichier = path.join(dossier, 'un-fichier');
    writeFileSync(fichier, 'x', 'utf8');
    assert.equal(ecrireSuivi(path.join(fichier, 'suivi.json'), neufSuivi()), false,
      'un échec d’écriture n’est pas fatal — et il doit RÉPONDRE');
  } finally { rmSync(dossier, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------ *
 *  4. LE VERROU DE FOND — LA RÈGLE NE LIT PAS SON JOURNAL (R.7).
 * ------------------------------------------------------------------ */

test('le corps de la règle ne mentionne ni le registre, ni les effacements, ni les retours', () => {
  const src = readFileSync(new URL('collecteur.mjs', RACINE), 'utf8');
  const m = src.match(/export function verdictDeCalendrier\([\s\S]*?\n\}/);
  assert.ok(m, 'la règle doit rester une fonction identifiable');
  const corps = m[0]
    .replace(/\/\*[\s\S]*?\*\//g, '')      // commentaires de bloc retirés
    .replace(/\/\/[^\n]*/g, '');           // commentaires de ligne retirés
  for (const interdit of ['suivi', 'registre', 'marquerRetours', 'ajouterEffacements', 'elaguerSuivi', 'extraitSuivi', 'lireSuivi', 'ecrireSuivi', 'revenueLe']) {
    assert.ok(!new RegExp(`\\b${interdit}\\b`, 'i').test(corps),
      `« ${interdit} » dans le corps de la règle : la décision se mettrait à dépendre de son propre journal`);
  }
});

test('le registre est écrit APRÈS la décision, jamais avant', () => {
  const src = readFileSync(new URL('collecteur.mjs', RACINE), 'utf8');
  // ⚠ L'APPEL PORTE EXPRÈS L'INSTANT DE LA PASSE (`INSTANT_DU_PASSAGE`) depuis le
  // 15/10/2026 : c'est lui qui a supprimé le transit des cinq jours. Le motif de
  // cette épreuve suit donc le code — mais il exige la forme PRÉCISE, pour qu'un
  // retour à `Date.now()` ici fasse rougir au lieu de passer.
  const boucleEffacement = src.indexOf("verdictDeCalendrier(o, { maintenant: INSTANT_DU_PASSAGE, tours: toursParSource })");
  const ecritureRegistre = src.indexOf("ecrireSuivi(path.join(DATA, 'effacements.json'), suivi)");
  assert.ok(boucleEffacement > 0 && ecritureRegistre > 0, 'les deux moments doivent exister');
  assert.ok(ecritureRegistre > boucleEffacement,
    'le registre doit être écrit après l’effacement — un registre écrit avant pourrait être lu par la suite du passage');
  // ET L'ESTAMPILLE DU FICHIER EST LE MÊME INSTANT QUE LE VERDICT. C'est la
  // fermeture du transit : deux instants différents publiaient 20 à 28 cartes
  // DÉJÀ CONDAMNÉES à chaque passe, toutes à 5,00 j.
  assert.match(src, /genereLe: new Date\(INSTANT_DU_PASSAGE\)\.toISOString\(\)/,
    'l’estampille du catalogue doit être le MÊME instant que le verdict d’effacement');
});

/* ------------------------------------------------------------------ *
 *  5. LE CONTRAT AVEC LE PANNEAU — chaque champ lu existe vraiment.
 *     C'est la faute payée une fois (le panneau lisait `x.n`, le journal
 *     écrivait `items` : zéro partout, et personne ne le voyait).
 * ------------------------------------------------------------------ */

const lire = (p) => readFileSync(new URL(p, RACINE), 'utf8');

test('les champs que l’onglet lit sont bien produits par le collecteur', () => {
  const onglet = lire('public/admin/index.html');
  const fiche = carteEffacee(carte({ premiereVue: ilYA(9) }), { maintenant: MAINTENANT, tours: RELUE });
  const blocage = { ...fiche, ...raisonDeBlocage(carte({ premiereVue: ilYA(9) }), { maintenant: MAINTENANT, tours: MUETTE }) };
  for (const champ of ['effaceeLe', 'ageJours', 'titre', 'source', 'pays', 'servieAuTour', 'tourSource', 'revenueLe', 'lien', 'prix']) {
    assert.ok(onglet.includes(`x.${champ}`), `l’onglet doit lire ${champ}`);
    assert.ok(champ in fiche, `le collecteur doit produire ${champ}`);
  }
  for (const champ of ['raison', 'detail']) {
    assert.ok(onglet.includes(`x.${champ}`), `l’onglet doit lire ${champ} sur une carte bloquée`);
    assert.ok(champ in blocage, `le collecteur doit produire ${champ}`);
  }
});

test('l’onglet existe, il est branché, et il dit ce qu’il ne peut pas dire', () => {
  const onglet = lire('public/admin/index.html');
  assert.ok(onglet.includes('data-vue="cartes"'), 'l’onglet « Vie des cartes » doit exister');
  assert.equal((onglet.match(/data-vue="cartes"/g) || []).length, 2,
    'un bouton ET une section : un onglet sans section ne montrerait rien');
  assert.ok(onglet.includes("fetch('../suivi-cartes.json'"), 'et il doit lire le journal du collecteur');
  for (const bloc of ['avisCartes', 'mCartesCompteurs', 'mCartesRetraits', 'mCartesEffacees', 'mCartesBloquees']) {
    assert.ok(onglet.includes(`id="${bloc}"`), `le conteneur ${bloc} doit exister`);
    assert.ok(onglet.includes(`'${bloc}'`) || onglet.includes(`'${bloc}'`), `et être rempli par le dessin`);
  }
  assert.ok(/ouvrez le lien/i.test(onglet), 'l’onglet doit dire que la vérification qui tranche est humaine');
  assert.ok(/relu par aucune d[ée]cision|n’est relu par personne/i.test(onglet.replace(/\s+/g, ' ')),
    'l’onglet doit dire que le journal ne décide rien (R.7)');
  assert.ok(onglet.includes('dessinerCartes()'), 'et il doit être appelé au chargement');
});

/* ------------------------------------------------------------------ *
 *  6. LE FICHIER RÉEL — la partition, sur ce que le site sert vraiment.
 * ------------------------------------------------------------------ */

test('le journal publié est cohérent, et aucune carte n’est en violation', () => {
  let publie = null;
  try { publie = JSON.parse(lire('docs/suivi-cartes.json')); } catch { publie = null; }
  if (!publie) {
    // Le premier passage après la mise en service du journal n'a pas encore
    // tourné : ce n'est pas un échec, c'est un état — et il se dit.
    assert.ok(true, 'aucun journal publié : rien à vérifier');
    return;
  }
  const c = publie.cartes || {};
  assert.equal((c.dansLesCinqJours || 0) + (c.bloquees || 0) + (c.sansDate || 0), c.affichees,
    'la partition publiée doit être exacte — c’est le chiffre que B lira');
  assert.ok(Array.isArray(c.liste) && c.liste.length <= SUIVI_PUBLIE_MAX, 'la liste publiée est bornée');
  for (const x of c.liste) {
    assert.ok(x.raison && x.detail, `chaque carte bloquée porte sa raison ET son détail : ${x.titre}`);
    assert.ok('lien' in x && 'ageJours' in x, 'et de quoi vérifier');
  }
  // ⚠ LE TRANSIT D'UN PASSAGE (voir l'épreuve jumelle de `vie-de-la-carte`) :
  // l'effacement décide en début de passe, le fichier est estampillé en fin de
  // passe — une carte qui franchit les cinq jours entre les deux est publiée déjà
  // condamnée. Ces cartes sont TOUTES à 5,00 j (mesuré le 15/10/2026) et partent au
  // passage suivant. On refuse donc seulement celles qui survivent AU-DELÀ du
  // transit : là, l'effacement a réellement échoué, et c'est ce qu'on veut savoir.
  // ⚠ LE TRANSIT D'UN PASSAGE N'EXISTE PLUS (voir `INSTANT_DU_PASSAGE`, 15/10/2026) :
  // verdict, panneau et estampille partagent le même instant, donc le catalogue
  // publié ne doit plus porter aucune carte condamnée. L'epsilon d'une minute ne
  // couvre qu'un décalage d'horloge.
  const TRANSIT_PASSAGE_JOURS = 1 / 1440;
  const enViolation = (c.liste || []).filter((x) => x.raison === 'violation');
  const durables = enViolation.filter((x) => !(Number(x.ageJours) <= VIE_AFFICHEE_JOURS + TRANSIT_PASSAGE_JOURS));
  assert.equal(durables.length, 0,
    `des cartes que la règle devait effacer survivent au-delà du transit : ${durables.slice(0, 5).map((x) => x.titre).join(' | ')}`);
  // LE COMPTE EST LE SEUL CHIFFRE QUI PARLE ICI, et c'est une leçon de mesure.
  // Mesuré le 15/10/2026 : la liste publiée est bornée (SUIVI_PUBLIE_MAX) et elle
  // était remplie par **199 « source-sans-compteur »** — les ventes flash des pays
  // recopiés — au point de ne contenir **AUCUNE des 28 violations**. Exiger
  // `liste ∩ violation === liste` ou comparer les deux longueurs échouerait donc
  // pour une raison qui n'a rien à voir avec l'effacement. On borne le COMPTE, avec
  // le même esprit que le plafond de taux de l'autre épreuve : un transit de
  // passage en laisse une vingtaine ; une panne d'effacement en laisse des milliers
  // (13 123 cartes mesurées le 14/10/2026, avant réparation).
  const compteViolations = Number((c.parRaison || {}).violation || 0);
  assert.ok(compteViolations <= 100,
    `le passage a laissé ${compteViolations} carte(s) condamnée(s) : au-delà du transit d’un passage, l’effacement a échoué`);
  // ⚠ LES VIOLATIONS DOIVENT ÊTRE DANS LA LISTE — corrigé le 15/10/2026, après
  // avoir constaté l'inverse. La liste publiée est bornée à `SUIVI_PUBLIE_MAX` et
  // elle était triée par âge décroissant : sur 229 cartes bloquées, elle partait
  // avec les « source-sans-compteur » (ventes flash recopiées) et **les 28
  // violations n'y figuraient AUCUNE** — la liste cachait exactement ce que B
  // l'ouvre pour vérifier. `etatDesCartes` sert donc désormais d'abord ce qui se
  // vérifie (violation, puis source-muette, puis le reste).
  // Ce qui est exigé ici : TOUTES les violations, tant que le compte tient sous le
  // plafond. Si un jour elles dépassent 200, la borne reprend ses droits — c'est
  // `Math.min` qui le dit, et non un silence.
  assert.equal(enViolation.length, Math.min(compteViolations, SUIVI_PUBLIE_MAX),
    `les ${compteViolations} carte(s) condamnée(s) doivent figurer dans la liste publiée (plafond ${SUIVI_PUBLIE_MAX}, ${enViolation.length} présente(s))`);
  // ET ELLES L'OUVRENT : aucune violation ne doit apparaître APRÈS une carte d'une
  // autre raison. Une liste qui les cacherait en fin de course serait aussi
  // inutilisable qu'une liste qui les omet.
  const raisonsPubliees = (c.liste || []).map((x) => x.raison);
  const premierAutre = raisonsPubliees.findIndex((r) => r !== 'violation');
  if (premierAutre > 0) {
    assert.ok(!raisonsPubliees.slice(premierAutre).includes('violation'),
      'les violations ouvrent la liste : aucune ne doit venir après une autre raison');
  }
  // ET LA DERNIÈRE LIGNE DU PANNEAU RESTE VRAIE : « la plus ancienne a N jours ».
  // Ce chiffre se lisait dans `liste[0]` — juste tant que la liste était triée par
  // âge, faux dès qu'elle est triée par raison (il aurait annoncé « 5 jours » en
  // montrant des cartes de 8,5). Il est donc calculé, et l'épreuve refuse qu'il
  // annonce MOINS que ce que la liste publiée montre : c'est exactement le défaut
  // qu'aurait produit l'ancienne lecture.
  if ((c.liste || []).length) {
    const plusGrand = Math.max(...c.liste.map((x) => Number(x.ageJours) || 0));
    assert.ok(Number(c.plusAncienneJours) >= plusGrand - 0.01,
      `le plus grand âge annoncé (${c.plusAncienneJours}) ne peut pas être plus jeune que ce que la liste montre (${plusGrand})`);
  }
  assert.ok((publie.effacees || {}).liste, 'le journal doit porter la liste des effacements');
  const poids = readFileSync(new URL('docs/suivi-cartes.json', RACINE)).length;
  assert.ok(poids < 500_000, `le fichier de contrôle pèse ${poids} octets : il doit rester borné`);
});

/* ------------------------------------------------------------------ *
 *  L'ONGLET DES OFFRES REFUSÉES (demande de B, 15/10/2026) — et le verrou
 *  qui compte : il doit juger avec LES RÈGLES DE L'ÉCRAN, pas avec une copie.
 * ------------------------------------------------------------------ */

test('l’onglet des offres refusées juge avec les règles PARTAGÉES, jamais avec une copie', () => {
  const onglet = lire('public/admin/index.html');
  // 1. Il importe le module — le même fichier que celui importé par app.js.
  assert.match(onglet, /import \* as REGLES from '\.\.\/regles-affichage\.js'/,
    'le panneau doit importer les règles partagées (regles-affichage.js)');
  assert.match(onglet, /window\.REGLES_AFFICHAGE = REGLES/,
    'et les exposer à l’onglet, qui est écrit en script clair');
  // 2. Et il ne REDÉFINIT ni les prédicats ni les filtres de noms. C'est le défaut
  //    que cette épreuve interdit : un panneau qui valide ses propres copies
  //    annonce « refusée » là où l'écran affiche, et B corrige un filtre sain.
  for (const interdit of ['const estBonnePromo', 'function estOffreEnseigne', 'function estBonneAffaire',
    'const REDACTIONS =', 'const REMISE_MIN =', 'const MARCHANDS_NON_BOUTIQUE =']) {
    assert.ok(!onglet.includes(interdit),
      `« ${interdit} » redéfini dans le panneau : les règles doivent avoir UNE seule définition`);
  }
  // 3. L'onglet existe vraiment : bouton, section, et un rendu branché dessus.
  assert.match(onglet, /class="onglet" data-vue="refusees"/, 'le bouton de l’onglet doit exister');
  assert.match(onglet, /<section data-vue="refusees">/, 'la section de l’onglet doit exister');
  assert.match(onglet, /refusees: \(\) => \{ dessinerAjouts\(\); \}/, 'l’ouverture doit relire le catalogue');
  // 4. LE TRAJET COMPLET (demande de B : « les produits qui ont été rajoutés … et
  //    les produits qui n'ont pas été rajoutés avec la raison »). Les trois blocs
  //    doivent exister, et chacun doit se lire là où la vérité est écrite :
  //    les ENTRÉES sur `premiereVue` (jamais rafraîchie, donc pas de carte qui
  //    « rajeunit »), les RETRAITS dans le journal du collecteur, et les SOURCES
  //    dans le journal du passage — pas dans un recalcul du panneau, qui ferait un
  //    second collecteur.
  for (const id of ['mAjoutsEntrees', 'mAjoutsRetraits', 'mAjoutsSources']) {
    assert.ok(onglet.includes(`id="${id}"`), `le bloc ${id} doit exister dans l’onglet`);
  }
  assert.match(onglet, /o\.premiereVue \|\| ''/, 'les entrées se lisent sur la première vue');
  assert.match(onglet, /suivi\.retraits/, 'les retraits viennent du journal écrit par le collecteur');
  assert.match(onglet, /d\.sourcesVuLe/, 'la dernière lecture d’une source vient du catalogue publié');
  // 5. ET IL LIT LE CATALOGUE PUBLIÉ, pas un fichier local : `docs/` est ce que
  //    l'hébergeur sert, et c'est là que les filtres ont agi.
  assert.match(onglet, /fetch\('\.\.\/offres\.json', \{ cache: 'no-store' \}\)/,
    'l’onglet doit lire le catalogue publié');
});

/* ------------------------------------------------------------------ *
 *  LA SYNTAXE DU PANNEAU — l'épreuve qui manquait, et qui a coûté une panne.
 *
 *  Vécu le 15/10/2026 : une parenthèse fermante oubliée dans une fonction ajoutée
 *  ce jour-là a rendu TOUT le script du panneau illisible. Conséquence exacte :
 *  aucune fonction n'est définie, la page s'ouvre et reste muette — pas d'erreur
 *  visible pour qui la regarde, et les épreuves déjà écrites ne voyaient rien,
 *  parce qu'elles vérifient du TEXTE (« la chaîne est-elle présente ? ») et non
 *  la lisibilité du fichier. Trouvé seulement en exerçant l'onglet dans un
 *  navigateur, qui a levé une exception à la première ligne exécutée.
 *
 *  Un `node --check` dit exactement la chose utile : ce fichier peut-il être lu
 *  par JavaScript ? C'est le contrôle le moins cher qui existe, et c'est celui
 *  qui manquait.
 * ------------------------------------------------------------------ */

/** Les scripts EN LIGNE d'une page, commentaires HTML retirés d'abord.
 *  ⚠ SANS CE RETRAIT, L'ÉPREUVE MENT : index.html CITE l'expression
 *  `<script type="module">` dans un commentaire (pour expliquer la sentinelle de
 *  démarrage), et un extracteur naïf prend cette citation pour une balise — il
 *  contrôle alors du texte de commentaire avec `node --check`, qui échoue, et
 *  l'épreuve annonce un défaut qui n'existe pas. Mesuré le 15/10/2026 : c'est
 *  exactement ce qu'elle a fait à sa première exécution. */
const scriptsEnLigne = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '')
  .matchAll(/<script(?![^>]*\bsrc=)(?!\s*type\s*=\s*["']application\/ld\+json["'])([^>]*)>([\s\S]*?)<\/script>/g)];

test('les scripts en ligne du panneau se lisent (sinon le panneau est muet)', () => {
  const html = lire('public/admin/index.html');
  const blocs = scriptsEnLigne(html);
  assert.ok(blocs.length > 0, 'le panneau doit avoir au moins un script en ligne');
  const fautifs = [];
  blocs.forEach(([, attrs, code], i) => {
    if (!code.trim()) return;
    const fichier = path.join(os.tmpdir(), `panneau-script-${i}${/type\s*=\s*["']module["']/.test(attrs) ? '.mjs' : '.js'}`);
    writeFileSync(fichier, code);
    try {
      execFileSync('node', ['--check', fichier], { stdio: 'pipe' });
    } catch (e) {
      fautifs.push(`script n°${i} (${code.length} octets) : ${String(e.stderr || e.message).split('\n')[1] || 'illisible'}`);
    } finally {
      try { unlinkSync(fichier); } catch { /* le fichier temporaire n'existe pas : rien à faire */ }
    }
  });
  assert.deepEqual(fautifs, [],
    `un script illisible rend le panneau ENTIER muet (aucune fonction définie) :\n${fautifs.join('\n')}`);
});

test('les scripts en ligne du site se lisent aussi (index.html)', () => {
  // Même contrôle sur la page publique : elle porte la marque de support et les
  // données structurées. Un script illisible y casserait la sentinelle de
  // démarrage, donc le diagnostic d'une panne réelle.
  const html = lire('public/index.html');
  const blocs = scriptsEnLigne(html);
  const fautifs = [];
  blocs.forEach(([, attrs, code], i) => {
    if (!code.trim()) return;
    const fichier = path.join(os.tmpdir(), `site-script-${i}${/type\s*=\s*["']module["']/.test(attrs) ? '.mjs' : '.js'}`);
    writeFileSync(fichier, code);
    try {
      execFileSync('node', ['--check', fichier], { stdio: 'pipe' });
    } catch (e) {
      fautifs.push(`script n°${i} : ${String(e.stderr || e.message).split('\n')[1] || 'illisible'}`);
    } finally {
      try { unlinkSync(fichier); } catch { /* rien */ }
    }
  });
  assert.deepEqual(fautifs, [], `scripts illisibles dans index.html :\n${fautifs.join('\n')}`);
});
