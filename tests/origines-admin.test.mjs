/**
 * LE CLASSEMENT DES SITES : ACTIFS / NON ACTIFS (panneau d'administration).
 *
 * Ce qui est protégé ici, et pourquoi. Le 08/10/2026, B a signalé :
 * « j'ai vu qu'il y avait tous les sites dormant, inactif ». C'était FAUX, et de
 * la pire façon : le panneau lisait `x.n` dans le journal du collecteur, alors que
 * celui-ci écrit `retenues` (annonces gardées) et `items` (annonces lues). `n`
 * n'existe pas ⇒ zéro partout ⇒ tous les sites rangés dans « ne donnent rien ».
 * Un décompte faux ne casse rien et ne fait aucun bruit : il a l'air d'une
 * mauvaise nouvelle, et on cherche la panne chez les sites au lieu du panneau.
 *
 * La règle vit dans `classementSites()`, une fonction PURE du panneau. Le test
 * EXTRAIT son texte du vrai fichier et l'exécute : il éprouve le code livré, pas
 * une copie qui pourrait diverger.
 *
 * Lancement : node --test tests/origines-admin.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const CHEMIN_ADMIN = path.join(ICI, '..', 'public', 'admin', 'index.html');
const admin = fs.readFileSync(CHEMIN_ADMIN, 'utf8');

function extraire(nom) {
  const m = admin.match(new RegExp(`function ${nom}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `la fonction ${nom} doit exister dans le panneau (elle a peut-être été renommée)`);
  return m[0];
}

/* OÙ EST LE CATALOGUE, ET POURQUOI CE N'EST PAS ÉCRIT EN DUR.
 *
 * `data/offres.json` n'est PAS versionné (voir .gitignore) : il n'existe que là
 * où la collecte tourne — sur la machine du propriétaire. La copie du dépôt que
 * GitHub récupère n'en a aucune trace ; elle n'a que `docs/offres.json`, publié
 * avec le site et de MÊME FORME (mêmes `sources`, même `journal`, mêmes offres).
 *
 * Lire `data/` en dur faisait donc échouer ce test TOUTES LES HEURES côté
 * GitHub, en silence, et le workflow s'arrêtait avant de publier quoi que ce
 * soit. Vécu le 08/10/2026 : deux échecs horaires. On lit le premier qui existe. */
function lireCatalogue() {
  const c = [path.join(ICI, '..', 'data', 'offres.json'), path.join(ICI, '..', 'docs', 'offres.json')]
    .find((p) => fs.existsSync(p));
  assert.ok(c, 'ni data/offres.json (local) ni docs/offres.json (dépôt) : rien à vérifier');
  return fs.readFileSync(c, 'utf8');
}
// Le panneau tourne dans un navigateur : la fonction est déclarée au niveau du
// script. On la reconstruit ici, seule, sans DOM.
const classementSites = new Function(`${extraire('classementSites')}; return classementSites;`)();

/* ------------------------------------------------------------------ fixtures */

const CATALOGUE = {
  genereLe: '2026-10-08T07:25:20.000Z',
  sources: [
    { id: 'dealabs-tendance', nom: 'Dealabs', type: 'dealabs', pays: 'FR' },
    { id: 'presse-x', nom: 'Presse X', type: 'presse', pays: 'BE' },
    { id: 'site-muet', nom: 'Site Muet', type: 'presse', pays: 'DE' },
    { id: 'coolblue-be-1', nom: 'Coolblue', type: 'enseigne', pays: 'BE' },
    { id: 'jamais-appele', nom: 'Nouveau Site', type: 'enseigne', pays: 'NL' },
  ],
  journal: [
    { source: 'dealabs-tendance', ok: true, items: 40, retenues: 15 },
    { source: 'presse-x', ok: true, items: 30, retenues: 0 },
    { source: 'site-muet', ok: false, erreur: 'HTTP 403' },
    { source: 'repos', ok: true, saute: true, sources: ['coolblue-be-1'], raison: 'délai de repos non écoulé' },
  ],
  sourcesVides: { 'presse-x': 2 },
  offres: [
    { source: 'Dealabs', pays: 'BE' },
    { source: 'Dealabs', pays: 'FR' },
    { source: 'Coolblue', pays: 'BE' },   // une source au repos GARDE ses offres
  ],
};
const classement = (c = CATALOGUE) => classementSites(structuredClone(c));

/* --------------------------------------------------------------------- tests */

test('les sites qui ont des annonces sont ACTIFS, du plus prolifique au plus discret', () => {
  const cl = classement();
  assert.deepEqual(cl.actifs.map((a) => a.site), ['Dealabs', 'Coolblue']);
  assert.equal(cl.actifs[0].total, 2);
  assert.equal(cl.actifs[0].lues, 40, 'les annonces LUES du journal doivent remonter');
  assert.equal(cl.actifs[0].pays.BE, 1);
  assert.equal(cl.totalAnnonces, 3);
});

test('une source AU REPOS qui a déjà des annonces reste active (ce n’est pas une panne)', () => {
  const cl = classement();
  assert.ok(cl.actifs.some((a) => a.site === 'Coolblue'));
  assert.ok(!cl.nonActifs.some((x) => x.site === 'Coolblue'),
    'une source au repos ne doit JAMAIS être classée « non active » si ses annonces sont en ligne');
});

test('chaque site non actif porte sa RAISON, la plus parlante d’abord', () => {
  const cl = classement();
  const parSite = Object.fromEntries(cl.nonActifs.map((x) => [x.site, x]));
  assert.equal(parSite['Site Muet'].etat, 'en échec');
  assert.match(parSite['Site Muet'].raison, /403/);
  assert.equal(parSite['Presse X'].etat, 'écarté par les filtres');
  assert.match(parSite['Presse X'].raison, /2 passage/);
  assert.equal(parSite['Nouveau Site'].etat, 'pas encore interrogée');
  // L'ordre : les pannes d'abord — c'est ce qu'on peut réparer.
  assert.equal(cl.nonActifs[0].site, 'Site Muet');
  assert.ok(cl.nonActifs.findLastIndex
    ? cl.nonActifs.at(-1).rang >= cl.nonActifs[0].rang : true);
});

test('le total des sites SUIVIS comprend ceux que le journal ne mentionne pas', () => {
  // Défaut de la même famille que le `n` : sans le catalogue des sources, une
  // source jamais appelée ou en repos était invisible, donc on ne pouvait pas
  // dire « 12 sites actifs sur 51 suivis ».
  const cl = classement();
  assert.equal(cl.suivis, 5, 'les 5 sites du catalogue doivent être comptés');
  assert.equal(cl.actifs.length + cl.nonActifs.length, 5,
    'chaque site suivi doit être classé, actif ou non actif');
});

test('le journal ancien (`n`) n’est PAS relu à la place de `retenues`', () => {
  // Contre-épreuve : si quelqu’un remet la lecture de `n`, ce test ne suffit pas
  // — mais il documente le contrat. Le vrai garde-fou est le suivant.
  const faux = { ...structuredClone(CATALOGUE),
    journal: [{ source: 'presse-x', ok: true, items: 30, n: 30 }] };
  const cl = classementSites(faux);
  assert.ok(!cl.nonActifs.some((x) => x.site === 'Presse X' && x.etat === 'écarté par les filtres'),
    'un journal qui porte `n` (champ hérité) doit être lu, pas ignoré');
});

test('LE GARDE-FOU : le panneau ne lit plus `x.n` comme nombre d’annonces', () => {
  assert.ok(!/nf\.format\(x\.n \|\| 0\)/.test(admin),
    'la colonne « Offres » lisait x.n || 0 — c’est le défaut qui affichait 0 pour tous les sites');
  assert.match(admin, /x\.retenues/,
    'le panneau doit lire `retenues`, le champ réellement écrit par le collecteur');
  assert.match(admin, /classementSites\(/,
    'le classement actifs / non actifs doit passer par la fonction vérifiée');
  for (const id of ['mActifs', 'mNonActifs']) {
    assert.ok(admin.includes(`id="${id}"`), `le bloc ${id} doit exister dans le panneau`);
    assert.ok(admin.includes(`getElementById('${id}')`), `le bloc ${id} doit être rempli`);
  }
});

test('le collecteur publie bien le catalogue des sources suivies', () => {
  const collecteur = fs.readFileSync(path.join(ICI, '..', 'collecteur.mjs'), 'utf8');
  assert.match(collecteur, /sources: TOUTES_SOURCES\.map/,
    'sans ce champ, le panneau ne peut pas dire combien de sites sont suivis');
  const etat = JSON.parse(lireCatalogue());
  const j = (etat.journal || []).filter((x) => !x.saute);
  assert.ok(j.length > 0, 'le journal doit porter des passages de sources');
  // Les étapes INTERNES du collecteur (images, identifiants, règles appliquées au
  // stock) ne sont PAS des sources : elles n'écrivent ni `items` ni `retenues`.
  // La liste est lue DANS LE PANNEAU — une étape ajoutée au collecteur sans être
  // déclarée là-bas fait donc échouer ce test. C'est exactement ce qui s'est
  // produit le 10/10/2026 avec « regle-pourcentage », nouvelle règle du stock qui
  // se présentait comme un site et faussait les totaux lus/gardés.
  const declarees = admin.match(/const internes = new Set\(\[([^\]]*)\]\)/);
  assert.ok(declarees, 'classementSites doit déclarer ses étapes internes');
  const INTERNES = new Set([...declarees[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const ok = j.filter((x) => x.ok && !INTERNES.has(x.source));
  assert.ok(ok.length > 0, 'au moins une source doit avoir répondu');
  assert.ok(ok.every((x) => 'items' in x && 'retenues' in x),
    'une source qui répond écrit TOUJOURS `items` et `retenues` — c’est le contrat que le panneau lit');
  // Une source EN ÉCHEC n'écrit ni l'un ni l'autre : elle écrit `erreur`. Le
  // panneau doit donc tester `ok` AVANT de compter, sinon il afficherait 0
  // annonce là où la vérité est « on n'a pas pu lire ».
  assert.ok(j.filter((x) => !x.ok).every((x) => 'erreur' in x),
    'une source en échec doit porter `erreur`');
  // Et « visuels » n'est PAS un site : c'est l'étape de rapatriement des images
  // (`essais`, `trouves`). Elle doit rester hors de la liste des sites.
  const visuels = j.find((x) => x.source === 'visuels');
  if (visuels) assert.ok('essais' in visuels && 'trouves' in visuels,
    'l’étape « visuels » se reconnaît à `essais` et `trouves`');
});

test('une étape INTERNE du journal n’est pas comptée comme un site', () => {
  // Sans ce filtre, « visuels » apparaissait dans la liste des sites à activer,
  // avec l'état « flux vide » : un faux site, à côté des vrais.
  const cl = classementSites({ ...structuredClone(CATALOGUE), journal: [
    ...structuredClone(CATALOGUE.journal),
    { source: 'visuels', ok: true, essais: 27, trouves: 15, raison: 'og:image' },
  ] });
  assert.ok(!cl.nonActifs.some((x) => x.site === 'visuels'), '« visuels » ne doit pas être un site non actif');
  assert.ok(!cl.actifs.some((x) => x.site === 'visuels'));
  assert.equal(cl.nonActifs.length + cl.actifs.length, 5);
});
