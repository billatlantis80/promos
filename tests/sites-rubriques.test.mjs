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
  // On lit le PREMIER qui existe : `data/` chez nous, `docs/` dans la copie du
  // dépôt (voir le garde-fou en fin de fichier).
  const chemin = [path.join(ICI, '..', 'data', 'offres.json'), path.join(ICI, '..', 'docs', 'offres.json')]
    .find((p) => fs.existsSync(p));
  assert.ok(chemin, 'ni data/offres.json (local) ni docs/offres.json (dépôt) : rien à vérifier');
  const o = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  assert.ok(Array.isArray(o.sources) && o.sources.length > 0);
  const sansRubrique = o.sources.filter((s) => !s.rubrique || !s.voie);
  assert.deepEqual(sansRubrique.map((s) => s.id), [],
    'toute source publiée doit porter rubrique et voie (relancer le collecteur après ce changement)');
  const rubriques = new Set(o.sources.map((s) => s.rubrique));
  assert.ok(rubriques.size >= 5, 'le catalogue doit couvrir plusieurs rubriques distinctes');
});

/* ---------------------------------------------------------------------------
 * LE GARDE-FOU : un test ne doit JAMAIS dépendre d'un fichier non versionné.
 *
 * CE QU'IL PROTÈGE, ET C'EST MESURÉ. `data/` est exclu du dépôt (voir
 * .gitignore) : le catalogue n'existe que là où la collecte tourne. Un test qui
 * le lisait EN DUR échouait donc sur GitHub, toutes les heures — et le workflow
 * s'arrêtait AVANT de publier, en silence : le propriétaire recevait un courriel
 * d'échec par heure (constaté le 08/10/2026, à 09:10 puis 10:10), la sauvegarde
 * ne servait plus à rien, et rien dans le site ne le laissait voir.
 *
 * Le motif cherché est précis, pour ne pas crier au loup : une lecture DIRECTE
 * dont le chemin `data/…/offres.json` est écrit en clair dans l'appel. Lire via
 * une variable relue par `existsSync` (le motif déjà employé par
 * `categories.test.mjs` et `nettoyage.test.mjs`) reste parfaitement sûr et n'est
 * donc pas signalé.
 */
test('aucun test ne lit data/offres.json EN DUR (fichier non versionné)', () => {
  const dossier = path.join(ICI, '..', 'tests');
  const fautifs = [];
  for (const f of fs.readdirSync(dossier).filter((x) => x.endsWith('.mjs'))) {
    const t = fs.readFileSync(path.join(dossier, f), 'utf8');
    const enDur = /readFileSync\([^)]*['"]data['"][^)]*['"]offres\.json['"]/.test(t)
      || /readFileSync\([^)]*data[\\/]+offres\.json/.test(t);
    if (enDur && !/existsSync/.test(t)) fautifs.push(f);
  }
  assert.deepEqual(fautifs, [],
    `ces tests lisent data/offres.json en dur, sans repli : ils échouent sur GitHub `
    + `et bloquent la sauvegarde horaire → ${fautifs.join(', ')}`);
});

test('le repli vers docs/offres.json existe bien, et le fichier est exploitable', () => {
  // Contre-épreuve du garde-fou : il ne suffit pas d'éviter `data/`, il faut que
  // le repli donne un catalogue UTILISABLE — sinon on remplace un échec bruyant
  // par un test qui ne vérifie plus rien.
  const publie = path.join(ICI, '..', 'docs', 'offres.json');
  assert.ok(fs.existsSync(publie), 'docs/offres.json doit être versionné avec le site');
  const o = JSON.parse(fs.readFileSync(publie, 'utf8'));
  assert.ok(Array.isArray(o.sources) && o.sources.length > 0, 'le catalogue publié doit porter ses sources');
  assert.ok(Array.isArray(o.journal) && o.journal.length > 0, 'le catalogue publié doit porter son journal');
});
