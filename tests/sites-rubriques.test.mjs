/**
 * LES SITES RANGÉS PAR PAYS ET PAR RUBRIQUE — application n°2 « Kazendra ».
 *
 * Demande de B (08/10/2026) : « j'ai besoin que tu les classes par pays, et par
 * rubrique : supermarché, presse, e-commerce… ce qui me permettra de trouver des
 * nouveaux sites à activer. »
 *
 * CE QUI EST PROTÉGÉ ICI, ET POURQUOI. Deux choses, et la seconde compte plus que
 * la première :
 *
 *   1. Le CLASSEMENT. Chaque site suivi doit tomber dans une rubrique et un pays,
 *      et les annonces ne doivent être ni comptées deux fois ni perdues : le
 *      total doit retomber EXACTEMENT sur le catalogue. Un classement faux ne
 *      casse rien, ne fait aucun bruit — et envoie chercher des sites à activer
 *      là où le problème est ailleurs.
 *
 *   2. La VOIE. « flux » = le site publie ses offres, on les lit chez lui.
 *      « veille » = on ne l'atteint qu'à travers un moteur, faute de flux
 *      lisible. C'est cette distinction qui rend la liste UTILE : sans elle,
 *      Delhaize et Amazon se ressemblent, alors que l'un est branché et l'autre
 *      seulement surveillé. Le test refuse un catalogue où la voie manque.
 *
 * La règle vit dans `sitesParPaysEtRubrique()`, une fonction PURE du panneau. Le
 * test EXTRAIT son texte du vrai fichier et l'exécute : il éprouve le code
 * livré, pas une copie qui pourrait diverger.
 *
 * Lancement : node --test tests/sites-rubriques.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TOUTES_SOURCES, rubriqueDeSite, voieDeSite, secteurMarchand } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const CHEMIN_ADMIN = path.join(ICI, '..', 'public', 'admin', 'index.html');
const admin = fs.readFileSync(CHEMIN_ADMIN, 'utf8');

function extraire(nom) {
  const m = admin.match(new RegExp(`function ${nom}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `la fonction ${nom} doit exister dans le panneau (elle a peut-être été renommée)`);
  return m[0];
}
// La fonction dépend de `classementSites` : on reconstruit les deux ensemble.
const sitesParPaysEtRubrique = new Function(
  `${extraire('classementSites')}; ${extraire('sitesParPaysEtRubrique')}; return sitesParPaysEtRubrique;`)();

/* ------------------------------------------------------------------ fixtures */

const CATALOGUE = {
  genereLe: '2026-10-08T09:00:00.000Z',
  sources: [
    { id: 'dealabs', nom: 'Dealabs', type: 'dealabs', pays: 'FR', rubrique: 'communauté de bons plans', voie: 'flux' },
    { id: 'amazon-be', nom: 'Amazon', type: 'amazon', pays: 'BE', rubrique: 'e-commerce', voie: 'flux' },
    { id: 'amazon-de', nom: 'Amazon', type: 'amazon', pays: 'DE', rubrique: 'e-commerce', voie: 'flux' },
    { id: 'delhaize', nom: 'Delhaize (BE)', type: 'presse', pays: 'BE', rubrique: 'supermarché', voie: 'veille' },
    { id: 'gnews-be', nom: 'Presse BE (fr) 1', type: 'presse', pays: 'BE', rubrique: 'moteur de veille', voie: 'veille' },
    { id: 'coolblue', nom: 'Coolblue', type: 'enseigne', pays: 'BE', rubrique: 'électro & high-tech', voie: 'flux' },
    // Un site à sources MIXTES : la rubrique majoritaire doit l'emporter, sans
    // dépendre de l'ordre du fichier.
    { id: 'groupon-a', nom: 'Groupon', type: 'groupon', pays: 'BE', rubrique: 'activités & sorties', voie: 'flux' },
    { id: 'groupon-b', nom: 'Groupon', type: 'socialdeal', pays: 'BE', rubrique: 'activités & sorties', voie: 'flux' },
    { id: 'groupon-c', nom: 'Groupon', type: 'enseigne', pays: 'BE', rubrique: 'e-commerce', voie: 'flux' },
  ],
  journal: [
    { source: 'dealabs', ok: true, items: 40, retenues: 12 },
    { source: 'amazon-be', ok: true, items: 60, retenues: 30 },
    { source: 'delhaize', ok: true, items: 12, retenues: 0 },
  ],
  offres: [
    { source: 'Dealabs', pays: 'FR' },
    { source: 'Amazon', pays: 'BE' },
    { source: 'Amazon', pays: 'DE' },
    { source: 'Amazon', pays: 'DE' },
    { source: 'Coolblue', pays: 'BE' },
    { source: 'Presse BE (fr) 1', pays: 'BE' },
  ],
};
const classer = (c = CATALOGUE) => sitesParPaysEtRubrique(structuredClone(c));

/* --------------------------------------------------------------------- tests */

test('les sites sont rangés par pays, puis par rubrique', () => {
  const pr = classer();
  const be = pr.pays.find((p) => p.pays === 'BE');
  assert.ok(be, 'la Belgique doit apparaître');
  const rub = Object.fromEntries(be.rubriques.map((r) => [r.rubrique, r]));
  assert.ok(rub['e-commerce'], 'Amazon doit ranger la Belgique en e-commerce');
  assert.ok(rub['électro & high-tech'], 'Coolblue doit ranger la Belgique en électro');
  assert.ok(rub['supermarché'], 'Delhaize doit ranger la Belgique en supermarché');
  assert.ok(rub['moteur de veille'], 'la veille pays doit avoir sa propre rubrique');
});

test('LE TOTAL RETOMBE EXACTEMENT SUR LE CATALOGUE (rien de perdu, rien de compté deux fois)', () => {
  const pr = classer();
  const parRubrique = pr.rubriques.reduce((s, r) => s + r.annonces, 0);
  const parPays = pr.pays.reduce((s, p) => s + p.total, 0);
  assert.equal(pr.totalAnnonces, CATALOGUE.offres.length);
  assert.equal(parRubrique, CATALOGUE.offres.length,
    'la somme des annonces par rubrique doit égaler le catalogue');
  assert.equal(parPays, CATALOGUE.offres.length,
    'la somme des annonces par pays doit égaler le catalogue');
});

test('un site présent dans DEUX pays y figure une fois dans chacun, sans doublon', () => {
  const pr = classer();
  for (const p of ['BE', 'DE']) {
    const pays = pr.pays.find((x) => x.pays === p);
    const occurrences = pays.rubriques.flatMap((r) => r.sites.filter((s) => s.site === 'Amazon'));
    assert.equal(occurrences.length, 1, `Amazon doit figurer une seule fois dans ${p}`);
  }
  assert.equal(pr.pays.find((p) => p.pays === 'DE').total, 2, 'les 2 annonces allemandes d’Amazon');
});

test('un site à sources MIXTES prend sa rubrique MAJORITAIRE, jamais au hasard', () => {
  const pr = classer();
  const be = pr.pays.find((p) => p.pays === 'BE');
  const porteurs = be.rubriques.filter((r) => r.sites.some((s) => s.site === 'Groupon'));
  assert.equal(porteurs.length, 1, 'Groupon ne doit apparaître que dans une seule rubrique');
  assert.equal(porteurs[0].rubrique, 'activités & sorties', '2 sources sur 3 disent activités');
});

test('LA VOIE est portée par chaque site : brancher un site ne se devine pas', () => {
  const pr = classer();
  const be = pr.pays.find((p) => p.pays === 'BE');
  const tous = be.rubriques.flatMap((r) => r.sites);
  assert.ok(tous.every((s) => s.voie === 'flux' || s.voie === 'veille'),
    'chaque site doit porter une voie lisible');
  const parNom = Object.fromEntries(tous.map((s) => [s.site, s.voie]));
  assert.equal(parNom['Amazon'], 'flux', 'Amazon publie ses promos : on les lit chez lui');
  assert.equal(parNom['Delhaize (BE)'], 'veille', 'Delhaize n’est vu qu’à travers un moteur');
  // La rubrique « supermarché » ne tient QUE sur de la veille : c'est exactement
  // ce que B doit pouvoir lire pour savoir quel site aller activer.
  const sup = be.rubriques.find((r) => r.rubrique === 'supermarché');
  assert.equal(sup.sites.filter((s) => s.voie === 'flux').length, 0);
});

test('un site non actif est quand même classé, avec son état', () => {
  const pr = classer();
  const be = pr.pays.find((p) => p.pays === 'BE');
  const delhaize = be.rubriques.flatMap((r) => r.sites).find((s) => s.site === 'Delhaize (BE)');
  assert.equal(delhaize.actif, false);
  assert.equal(delhaize.etat, 'écarté par les filtres');
  assert.equal(delhaize.annonces, 0);
});

test('le panneau affiche le classement, et sait lire la rubrique et la voie', () => {
  const collecteur = fs.readFileSync(path.join(ICI, '..', 'collecteur.mjs'), 'utf8');
  assert.match(collecteur, /rubrique: rubriqueDeSite\(s\), voie: voieDeSite\(s\)/,
    'le collecteur doit publier la rubrique ET la voie avec chaque source');
  assert.ok(admin.includes('id="mRubriquesSites"'), 'le bloc doit exister dans le panneau');
  assert.ok(admin.includes("getElementById('mRubriquesSites')"), 'le bloc doit être rempli');
  assert.match(admin, /sitesParPaysEtRubrique\(o\)/, 'le panneau doit passer par la fonction vérifiée');
});

/* --- Le classement des VRAIES sources, tel que le collecteur le produit ----- */

test('chaque source suivie reçoit une rubrique et une voie', () => {
  for (const s of TOUTES_SOURCES) {
    const r = rubriqueDeSite(s), v = voieDeSite(s);
    assert.ok(r && r !== 'autre', `${s.id} (« ${s.nom} ») n'a pas de rubrique`);
    assert.ok(v === 'flux' || v === 'veille', `${s.id} n'a pas de voie`);
  }
});

test('un marchand est rangé dans SON secteur, même écrit avec son pays', () => {
  assert.equal(secteurMarchand('Colruyt promotie (BE)'), 'supermarché');
  assert.equal(secteurMarchand('Delhaize (BE)'), 'supermarché');
  assert.equal(secteurMarchand('Krëfel (BE)'), 'électro & high-tech');
  assert.equal(secteurMarchand('Maxi Toys (BE)'), 'jouets & enfants');
  assert.equal(secteurMarchand('Supermarchés (BE)'), 'supermarché');
  assert.equal(secteurMarchand('Presse BE (fr) 1'), null, 'un moteur n’est pas un marchand');
});

test('nettoyer un site lisible ne dépend pas du hasard : la veille est un MOTEUR', () => {
  const moteur = TOUTES_SOURCES.filter((s) => voieDeSite(s) === 'veille');
  assert.ok(moteur.length > 0);
  assert.ok(moteur.every((s) => /news\.google\.com|bing\.com\/news/.test(s.url)),
    'seuls les moteurs sont en veille — un vrai flux est toujours branché');
  // Et l’inverse : aucun flux direct n’est rangé en veille par erreur.
  const flux = TOUTES_SOURCES.filter((s) => voieDeSite(s) === 'flux');
  assert.ok(flux.every((s) => !/news\.google\.com|bing\.com\/news/.test(s.url)));
});

test('le catalogue PUBLIÉ porte la rubrique et la voie sur chaque source', () => {
  const brut = fs.readFileSync(path.join(ICI, '..', 'data', 'offres.json'), 'utf8');
  const o = JSON.parse(brut);
  assert.ok(Array.isArray(o.sources) && o.sources.length > 0);
  const sansRubrique = o.sources.filter((s) => !s.rubrique || !s.voie);
  assert.deepEqual(sansRubrique.map((s) => s.id), [],
    'toute source publiée doit porter rubrique et voie (relancer le collecteur après ce changement)');
  const rubriques = new Set(o.sources.map((s) => s.rubrique));
  assert.ok(rubriques.size >= 5, 'le catalogue doit couvrir plusieurs rubriques distinctes');
});
