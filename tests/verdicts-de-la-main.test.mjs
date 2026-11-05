/**
 * LES DEUX GESTES DE LA MAIN — ce que le bouton promet, et ce qui le tient.
 *
 * Demande de B, 15/10/2026 : une colonne « Décision » avant « Source », avec deux
 * boutons — VÉRIFIER (la ligne quitte la liste ; « Mon objectif de la supprimer de
 * la liste, c'est pour confirmer qu'elle a été checker ») et RÉACTIVER une carte
 * pour 1 à 5 jours.
 *
 * CE QUE CETTE ÉPREUVE VÉRIFIE, ET POURQUOI ELLE EST ÉCRITE AINSI.
 * Un bouton de panneau qui n'écrit que dans le navigateur ne décide rien : c'est
 * la « promesse fausse » déjà payée sur ce projet. L'épreuve ne relit donc pas
 * seulement le panneau — elle vérifie la chaîne complète (le panneau écrit au
 * serveur, le serveur écrit le fichier publié, la collecte lit ce fichier), et
 * elle éprouve le serveur POUR DE VRAI : on le démarre, on lui envoie une
 * décision, on relit le fichier.
 *
 * ⚠ ET ELLE VÉRIFIE AUSSI CE QUI DOIT SURVIVRE. Le premier geste a failli être une
 * suppression ; B l'a corrigé : c'est une VÉRIFICATION. Une épreuve qui se
 * contenterait de « la ligne a disparu » laisserait passer le retour en arrière —
 * donc on exige que la fiche ET le compte des retours restent dans le registre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verdictsNeufs, normaliserVerdicts, enregistrerDecision, verdictDeLaMain, carteDepuisFiche,
  purgerRegistre, clesRetireesDuRegistre, marquerVerifiees, JOURS_REACTIVATION_MAX,
  VERDICTS_FICHIER, ACTIONS,
} from '../verdicts-de-la-main.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JOUR = 86400000;
const T = Date.parse('2026-10-15T21:30:00Z');
const lire = (f) => readFileSync(path.join(RACINE, f), 'utf8');
const PANNEAU = lire('public/admin/index.html');
const COLLECTEUR = lire('collecteur.mjs');
const SERVEUR = lire('server.js');
const FICHIER_VERDICTS = path.join(RACINE, VERDICTS_FICHIER);

const FICHE = { titre: 'Casque à 12,50 €', lien: 'https://exemple.be/casque', image: 'https://exemple.be/i.jpg', prix: 12.5, remise: 40, source: 'Dealabs', sourceId: 'dealabs-tendance', pays: 'BE', cle: 'BE|exemple.be/casque' };

/** Les durées que le PANNEAU propose, lues dans SA déclaration (pas recopiées) :
 *  c'est cette liste qui doit dire la même chose que le plafond du module. */
const DUREES_DU_PANNEAU = (() => {
  const m = PANNEAU.match(/const DUREES_JOURS = \[([^\]]*)\];/);
  assert.ok(m, 'le panneau doit déclarer DUREES_JOURS');
  return m[1].split(',').map((n) => Number(n.trim()));
})();

/** Extraire une fonction du PANNEAU livré (pas une copie) et l'exécuter avec les
 *  utilitaires d'affichage du panneau, remplacés par des versions neutres. */
function fonctionDuPanneau(nom, dependances = []) {
  const source = [nom, ...dependances].map((n) => {
    const m = PANNEAU.match(new RegExp(`function ${n}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(m, `le panneau doit déclarer ${n}() en colonne 0`);
    return m[0];
  }).join('\n');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nb = (n) => new Intl.NumberFormat('fr-BE').format(n);
  const ilYA = () => 'il y a un instant';
  const LIEN_OFFRE = (o, t) => `<a href="${esc(o.lien || '')}">${esc(t)}</a>`;
  return new Function('esc', 'nb', 'ilYA', 'LIEN_OFFRE', 'verdictsMain', 'avisDecision', 'fichesCartes', 'Date', 'DUREES_JOURS',
    `${source}; return ${nom};`)(esc, nb, ilYA, LIEN_OFFRE, {}, '', new Map(), Date, DUREES_DU_PANNEAU);
}

test('la colonne « Décision » offre DEUX boutons, et un MENU DÉROULANT pour les jours', () => {
  const blocDecision = fonctionDuPanneau('blocDecision', ['sursisEnCours']);
  const html = blocDecision({ cle: 'BE|a.be/x', prix: 12.5, titre: 'T' });
  assert.equal((html.match(/data-decision="verifier"/g) || []).length, 1, 'un bouton pour vérifier');
  assert.equal((html.match(/data-decision="reactiver"/g) || []).length, 1,
    'un bouton pour réactiver — et deux boutons en tout, pas six');
  assert.match(html, />Vérifier</, 'le premier bouton porte le mot de B');
  // ⚠ LE MENU DÉROULANT, DEMANDÉ PAR B le 15/10/2026 : « Pour le bouton avec la
  //  relance, j'ai besoin d'un menu déroulant pour le choix des jours. »
  assert.equal((html.match(/<select/g) || []).length, 1, 'un seul menu déroulant par ligne');
  assert.match(html, /class="choix-jours"/);
  const options = [...html.matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)];
  assert.equal(options.length, 5, 'cinq choix : 1 à 5 jours');
  assert.deepEqual(options.map((o) => Number(o[1])), [1, 2, 3, 4, 5]);
  assert.deepEqual(options.map((o) => o[2]), ['1 jour', '2 jours', '3 jours', '4 jours', '5 jours']);
  // LE PANNEAU ET LE SERVEUR DOIVENT DIRE LA MÊME CHOSE. Le panneau ne peut pas
  // importer le module (page statique) : sa liste est donc comparée au plafond du
  // code, sinon le menu proposerait un jour que le serveur refuserait.
  assert.equal(DUREES_DU_PANNEAU.length, JOURS_REACTIVATION_MAX,
    'le panneau doit proposer exactement le plafond du module');
  assert.equal(Math.max(...DUREES_DU_PANNEAU), JOURS_REACTIVATION_MAX);
  // Une fiche sans prix le DIT : le site peut continuer de refuser une carte sans prix.
  assert.match(blocDecision({ cle: 'X', prix: null }), /sans prix/);
  assert.doesNotMatch(blocDecision({ cle: 'X', prix: 3.5 }), /sans prix/);
});

/* ---- 1. Vérifier : la ligne s'en va, la preuve reste ---------------------- */

test('vérifier retire la ligne SANS RIEN PERDRE : la fiche et le compte des retours survivent', () => {
  const v = enregistrerDecision(verdictsNeufs(), { action: 'verifier', cle: 'C', fiche: FICHE }, T);
  assert.equal(verdictDeLaMain('C', v, T), 'verifiee');
  // Un an plus tard, la marque tient : c'est une vérification, pas un délai.
  assert.equal(verdictDeLaMain('C', v, T + 365 * JOUR), 'verifiee');
  assert.equal(v.verifiees.C.verifieeLe, new Date(T).toISOString());

  // ⚠ LE CŒUR DU GESTE : la fiche RESTE dans le registre, marquée. Une version
  //  antérieure la purgeait ; c'est exactement ce que B a corrigé le 15/10/2026.
  const registre = { C: { cle: 'C', effaceeLe: '2026-10-14T00:00:00.000Z', servieAuTour: 40, tourSource: 47 } };
  assert.equal(clesRetireesDuRegistre(v).has('C'), false,
    'une carte vérifiée ne doit PAS être retirée du registre');
  const marque = marquerVerifiees(registre, v);
  assert.equal(marque.marquees, 1);
  assert.equal(marque.effacees.C.verifieeLe, new Date(T).toISOString());
  assert.equal(marque.effacees.C.servieAuTour, 40, 'la preuve de l’effacement reste lisible');
  assert.equal(marque.effacees.C.tourSource, 47);
  // Une fiche déjà marquée garde sa PREMIÈRE date : c'est celle de la vérification.
  const encore = marquerVerifiees(marque.effacees, v);
  assert.equal(encore.marquees, 0);
  assert.equal(encore.effacees.C.verifieeLe, new Date(T).toISOString());
});

test('réactiver accorde exactement les jours demandés, pas un de plus', () => {
  for (const jours of [1, 2, 3, 4, 5]) {
    const v = enregistrerDecision(verdictsNeufs(), { action: 'reactiver', cle: 'C', jours, fiche: FICHE }, T);
    assert.equal(verdictDeLaMain('C', v, T), 'reactivee', `${jours} j doit remettre la carte en ligne`);
    assert.equal(verdictDeLaMain('C', v, T + jours * JOUR - 1000), 'reactivee');
    assert.equal(verdictDeLaMain('C', v, T + jours * JOUR + 1000), 'sursis-fini');
    assert.equal(Date.parse(v.reactivees.C.jusquau), T + jours * JOUR);
  }
});

test('une carte remise en ligne est retirée du registre, elle — sa fiche n’a plus rien à y faire', () => {
  const v = enregistrerDecision(verdictsNeufs(), { action: 'reactiver', cle: 'C', jours: 2, fiche: FICHE }, T);
  assert.equal(clesRetireesDuRegistre(v).has('C'), true);
  const p = purgerRegistre({ C: { cle: 'C' }, D: { cle: 'D' } }, clesRetireesDuRegistre(v));
  assert.deepEqual(Object.keys(p.effacees), ['D']);
  assert.equal(p.retires, 1);
});

test('les trois gestes s’excluent : le dernier gagne, dans les deux sens', () => {
  const reactif = enregistrerDecision(verdictsNeufs(), { action: 'reactiver', cle: 'C', jours: 5, fiche: FICHE }, T);
  const verifie = enregistrerDecision(reactif, { action: 'verifier', cle: 'C', fiche: FICHE }, T);
  assert.equal(verdictDeLaMain('C', verifie, T), 'verifiee');
  assert.equal(Object.keys(verifie.reactivees).length, 0, 'vérifier annule le sursis');
  const retour = enregistrerDecision(verifie, { action: 'reactiver', cle: 'C', jours: 1, fiche: FICHE }, T);
  assert.equal(verdictDeLaMain('C', retour, T), 'reactivee');
  assert.equal(Object.keys(retour.verifiees).length, 0, 'réactiver lève la vérification');
});

test('les bornes sont tenues : 1 à 5 jours entiers, et aucune autre action n’est acceptée', () => {
  assert.equal(JOURS_REACTIVATION_MAX, 5, 'le plus long sursis est de cinq jours');
  for (const jours of [0, 6, -1, 2.5, 'trois', null]) {
    assert.throws(() => enregistrerDecision(verdictsNeufs(), { action: 'reactiver', cle: 'C', jours, fiche: FICHE }, T),
      `une durée de ${jours} doit être refusée`);
  }
  assert.throws(() => enregistrerDecision(verdictsNeufs(), { action: 'supprimer', cle: 'C' }, T), 'action inconnue');
  assert.throws(() => enregistrerDecision(verdictsNeufs(), { action: 'verifier' }, T), 'clé manquante');
  assert.throws(() => enregistrerDecision(verdictsNeufs(), { action: 'annuler', cle: 'C' }, T),
    'retirer un sursis qui n’existe pas');
});

test('la carte reconstruite ne porte que ce que sa fiche contient — jamais un prix inventé', () => {
  const complet = carteDepuisFiche(FICHE, { maintenant: T });
  assert.equal(complet.prix, 12.5);
  assert.equal(complet.lienPage, FICHE.lien);
  assert.equal(complet.pays, 'BE');
  assert.equal(complet.reactiveeALaMain, true);
  const sansPrix = carteDepuisFiche({ titre: 'Sans prix', lien: 'https://exemple.be/x', pays: 'BE' }, { maintenant: T });
  assert.ok(!('prix' in sansPrix), 'une fiche sans prix ne doit pas produire un prix : 0 € serait un mensonge');
  assert.ok(!('remise' in sansPrix));
});

test('un fichier abîmé ou absent ne fait pas tomber la collecte', () => {
  assert.deepEqual(normaliserVerdicts(null), verdictsNeufs());
  assert.deepEqual(normaliserVerdicts('n’importe quoi').verifiees, {});
  assert.deepEqual(normaliserVerdicts({ verifiees: [] }).verifiees, {}, 'un tableau n’est pas une table de décisions');
  assert.equal(verdictDeLaMain('C', null, T), null, 'sans fichier, la règle des cinq jours décide seule');
});

/* ---- 2. Le tuyau : le panneau écrit, le serveur écrit, la collecte lit ----- */

test('le fichier des décisions est PUBLIÉ avec le site — sans lui, la collecte du secours ne verrait rien', () => {
  assert.ok(existsSync(FICHIER_VERDICTS), `${VERDICTS_FICHIER} doit exister`);
  const f = JSON.parse(lire(VERDICTS_FICHIER));
  assert.ok(f.quoi && /collecteur/.test(f.quoi), 'le fichier doit dire qui l’écrit et qui le lit');
  assert.equal(typeof f.verifiees, 'object');
  assert.equal(typeof f.reactivees, 'object');
});

test('le panneau envoie la décision au serveur, et n’en garde aucune dans le navigateur', () => {
  assert.match(PANNEAU, /fetch\('\.\.\/api\/verdict-carte'/, 'le panneau doit poster au serveur du projet');
  assert.match(PANNEAU, /'X-Panneau':\s*'1'/, 'sans cet en-tête, une page tierce pourrait écrire');
  assert.match(PANNEAU, /data-decision="verifier"/);
  assert.match(PANNEAU, /class="choix-jours"/, 'la durée se choisit dans un menu déroulant, comme demandé');
  assert.match(PANNEAU, /verdicts-a-la-main\.json/, 'le panneau doit relire les décisions publiées');
  assert.doesNotMatch(PANNEAU, /localStorage\.setItem\([^)]*verdict/i,
    'une décision gardée dans le navigateur ne décide rien : c’est la promesse fausse à ne pas refaire');
  assert.match(PANNEAU, /n’a pas répondu/);
  assert.match(PANNEAU, /Rien n’a été décidé|Décision NON prise/);
});

/* ---- 3. Le serveur, éprouvé pour de vrai : on lui envoie une décision ------ */

test('le serveur enregistre une vraie décision, garde le fichier trié, et la relit', async () => {
  const sauvegarde = lire(VERDICTS_FICHIER);
  const PORT = 4298;
  const srv = spawn(process.execPath, ['server.js'], { cwd: RACINE, env: { ...process.env, PORT: String(PORT) } });
  try {
    let pret = false;
    for (let i = 0; i < 60 && !pret; i += 1) {
      try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`); pret = r.ok; } catch { await new Promise((res) => setTimeout(res, 100)); }
    }
    assert.ok(pret, 'le serveur doit répondre sur /healthz');

    // (a) SANS l'en-tête, l'écriture est refusée : voilà le garde-fou contre une page tierce.
    const sansEntete = await fetch(`http://127.0.0.1:${PORT}/api/verdict-carte`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'verifier', cle: 'X' }),
    });
    assert.equal(sansEntete.status, 403);

    // (b) AVEC l'en-tête : la décision s'écrit dans le fichier publié.
    const avantEcriture = JSON.parse(lire(VERDICTS_FICHIER));
    const rep = await fetch(`http://127.0.0.1:${PORT}/api/verdict-carte`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Panneau': '1' },
      body: JSON.stringify({ action: 'reactiver', cle: FICHE.cle, jours: 3, fiche: FICHE }),
    });
    assert.equal(rep.status, 200);
    const corps = await rep.json();
    assert.equal(corps.ok, true);
    assert.equal(corps.fichier, VERDICTS_FICHIER);
    assert.equal(corps.jusquau, new Date(Date.parse(corps.jusquau)).toISOString());
    // ⚠ LA FORME DU CORPS, ET PAS SEULEMENT SON CODE. Le 15/10/2026, un renommage
    //  du geste (« effacer » → « vérifier ») a laissé `Object.keys(apres.supprimees)`
    //  dans la réponse : l'exception levait APRÈS l'envoi des en-têtes, le serveur
    //  mourait en pleine réponse, et la requête SUIVANTE échouait en « fetch
    //  failed ». L'épreuve ne regardait que le code HTTP : elle a laissé passer un
    //  serveur qui mourait. Elle lit maintenant les deux comptes qu'il promet.
    assert.equal(corps.verifiees, Object.keys(avantEcriture.verifiees).length,
      'le compte des vérifiées doit être un NOMBRE conforme au fichier, jamais `undefined`');
    assert.equal(corps.reactivees, Object.keys(avantEcriture.reactivees).length + 1,
      'et celui des cartes remises en ligne doit avoir augmenté d’une');
    assert.equal(Number.isFinite(corps.verifiees) && Number.isFinite(corps.reactivees), true,
      'deux nombres, jamais des `undefined` : c’est ce qui faisait mourir le serveur');

    const ecrit = JSON.parse(lire(VERDICTS_FICHIER));
    assert.ok(ecrit.reactivees[FICHE.cle], 'la décision doit être DANS le fichier publié');
    assert.equal(ecrit.reactivees[FICHE.cle].jours, 3);
    assert.equal(ecrit.reactivees[FICHE.cle].fiche.titre, FICHE.titre,
      'la fiche voyage avec la décision : sans elle, une carte élaguée ne pourrait pas être reconstruite');
    assert.equal(verdictDeLaMain(FICHE.cle, ecrit, Date.now()), 'reactivee');

    // (c) VÉRIFIER, par le même chemin : la marque entre dans le fichier, et le
    //     sursis de la même carte est levé (les deux gestes s'excluent).
    const verif = await fetch(`http://127.0.0.1:${PORT}/api/verdict-carte`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Panneau': '1' },
      body: JSON.stringify({ action: 'verifier', cle: FICHE.cle, fiche: FICHE }),
    });
    assert.equal(verif.status, 200);
    const apres = JSON.parse(lire(VERDICTS_FICHIER));
    assert.ok(apres.verifiees[FICHE.cle], 'la vérification doit être écrite');
    assert.equal(apres.reactivees[FICHE.cle], undefined, 'vérifier lève le sursis');

    // (d) Une durée hors bornes est refusée, et rien n'est écrit.
    const horsBornes = await fetch(`http://127.0.0.1:${PORT}/api/verdict-carte`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Panneau': '1' },
      body: JSON.stringify({ action: 'reactiver', cle: 'ZZZ', jours: 9 }),
    });
    assert.equal(horsBornes.status, 400);
    assert.doesNotMatch(lire(VERDICTS_FICHIER), /"ZZZ"/);
  } finally {
    srv.kill();
    writeFileSync(FICHIER_VERDICTS, sauvegarde, 'utf8');   // le dépôt est rendu tel qu'il était
  }
});

/* ---- 4. La collecte applique : coupée du fichier, la chaîne est morte ------ */

test('la collecte LIT le fichier des décisions, et au bon moment du passage', () => {
  assert.match(COLLECTEUR, /lireVerdicts\(path\.join\(__dirname, VERDICTS_FICHIER\)\)/,
    'sans cette lecture, les boutons n’ont aucun effet : c’est le tuyau lui-même');
  // Les décisions de la main passent APRÈS la fusion et AVANT la règle des cinq
  // jours : la main gagne, mais elle ne se glisse pas dans la règle.
  const stage = COLLECTEUR.indexOf('const verdictsMain = lireVerdicts');
  const boucleRegle = COLLECTEUR.indexOf('verdictDeCalendrier(o, { maintenant: INSTANT_DU_PASSAGE');
  assert.ok(stage > 0 && boucleRegle > 0);
  assert.ok(stage < boucleRegle, 'la main décide avant que la règle juge');
  assert.ok(stage > COLLECTEUR.indexOf('const servisCePassage = new Set()'),
    'la main s’applique après la fusion : elle doit savoir ce que le passage a vu servir');
  // Une carte remise en ligne n'est pas jugée par la règle tant que son sursis court.
  assert.match(COLLECTEUR, /if \(reactiveesEnCours\.has\(cle\)\) continue;/);
  // La règle elle-même reste ignorante des décisions manuelles (verrou de R.7/C6.1).
  const corps = COLLECTEUR.slice(COLLECTEUR.indexOf('export function verdictDeCalendrier'),
    COLLECTEUR.indexOf('export function verdictDeCalendrier') + 4000).split('\n}\n')[0];
  assert.doesNotMatch(corps, /verdictsMain|reactiveesEnCours/,
    'le corps de la règle ne doit connaître aucune décision manuelle');
  // ⚠ ET LE POINT QUE B A DEMANDÉ : vérifier MARQUE, ne purge pas.
  assert.match(COLLECTEUR, /marquerVerifiees\(suivi\.effacees, verdictsMain\)/,
    'la fiche vérifiée doit être marquée, jamais oubliée');
  assert.doesNotMatch(COLLECTEUR, /purgerRegistre\(suivi\.effacees, clesDecidees/,
    'l’ancienne purge par décision a disparu : elle vidait la preuve et le compte des retours');
  assert.match(COLLECTEUR, /purgerRegistre\(suivi\.effacees, clesRetireesDuRegistre\(verdictsMain\)\)/,
    'seules les cartes remises en ligne quittent le registre');
  // Une carte remise en ligne sans vignette doit servir le repli générique.
  assert.match(COLLECTEUR, /if \(carte && carte\.image && poidsDuVisuel\(carte\.image\) === 0\) delete carte\.image;/,
    'une image cassée est le seul cas qui abîme l’affichage');
});

test('le bouton « retirer » du rappel parle la même langue que le serveur', () => {
  // ⚠ LE DÉFAUT QUE CETTE ÉPREUVE VERROUILLE A ÉTÉ TROUVÉ EN EXERÇANT LE BOUTON,
  //  pas en le relisant (15/10/2026) : le panneau envoyait « retirer », le module ne
  //  connaît que « annuler », le serveur répondait 400 — et le clic ne faisait rien.
  //  Le geste avait donc l'air d'exister, et n'existait pas.
  assert.match(PANNEAU, /const actionServeur = action === 'retirer' \? 'annuler' : action;/,
    'le panneau doit traduire « retirer » en « annuler » avant d’appeler le serveur');
  assert.deepEqual(ACTIONS, ['verifier', 'reactiver', 'annuler']);
  for (const mot of ['verifier', 'reactiver', 'retirer']) {
    assert.match(PANNEAU, new RegExp(`data-decision="${mot}"`), `le bouton ${mot} doit exister`);
  }
});

test('le serveur refuse tout ce qui n’est pas une décision du panneau', () => {
  assert.match(SERVEUR, /url\.pathname === '\/api\/verdict-carte'/);
  assert.match(SERVEUR, /req\.headers\['x-panneau'\] !== '1'/);
  assert.match(SERVEUR, /req\.method !== 'POST'/);
  assert.match(SERVEUR, /corps\.length > 16384/, 'un corps sans borne est une porte ouverte');
});
