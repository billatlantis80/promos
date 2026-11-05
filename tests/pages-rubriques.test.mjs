/**
 * LES PAGES DE RUBRIQUE — le contenu PROPRE et INDEXABLE de Kazendra.
 * =============================================================================
 *
 * POURQUOI CES PAGES EXISTENT (mesuré, pas supposé)
 *
 *   docs/o/*.html ............ 17 045 pages, TOUTES `noindex` — et elles le
 *                              restent : ce sont les titres, photos et prix des
 *                              marchands, republiés.
 *   docs/index.html .......... indexable, mais ne liste que des offres : Google
 *                              n'y accepte pas de résultat enrichi produit.
 *
 * Sans ces pages-ci, le site n'avait donc AUCUNE porte d'entrée indexable hormis
 * son accueil. Le levier SEO d'un agrégateur, c'est du contenu propre : une page
 * par rubrique, avec des chiffres réels, une phrase rédigée, et le balisage.
 *
 * CE QUE CES ÉPREUVES INTERDISENT
 *
 *   1. Une page de rubrique qui serait `noindex` : elle n'aurait plus aucune
 *      raison d'exister, et personne ne s'en apercevrait.
 *   2. Un chiffre ANNONCÉ qui ne serait pas celui du catalogue. La page affiche
 *      « 338 offres suivies · 41 boutiques · 80 % » : ces trois nombres sont
 *      RECOMPTÉS ici, depuis le catalogue publié.
 *   3. Un prix dans la mauvaise monnaie : une offre britannique doit s'afficher
 *      en livres, une suédoise en couronnes — la devise vient du pays.
 *   4. Un lien vers une page qui n'existe pas. Chaque /o/<id>.html listé est
 *      vérifié sur le disque.
 *   5. Une page « Autres » : le fourre-tout n'est pas une rubrique.
 *
 * Lancement : node --test tests/pages-rubriques.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  pageDeRubrique, offresDeLaRubrique, chiffresDeLaRubrique,
  categoriesDuSite, nomRubrique, ecrireSitemapPublie, LANGUES_PAGES, SEUIL, MAX_OFFRES,
} from '../outils/pages-rubriques.mjs';
import { remiseMontrable, REMISE_ANNONCEE_MAX } from '../outils/donnees-structurees.mjs';
import { chargesDevises } from '../outils/pages-partage.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');
const existe = (p) => existsSync(join(RACINE, p));

const catalogue = JSON.parse(lire('docs/offres.json'));
const OFFRES = Array.isArray(catalogue) ? catalogue : catalogue.offres || [];
const { noms, ordre } = categoriesDuSite();

/** Un échantillon d'offres RÉELLES du catalogue, pour les essais unitaires. */
const EXEMPLE = OFFRES.find((o) => o.categorie === 'tech' && typeof o.prix === 'number');

const blocsJSONLD = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1]));

/* ====================================================== 1. la décision d'indexer */

test('les pages de rubrique sont INDEXABLES — sinon elles ne servent à rien', async () => {
  const outils = await chargesDevises();
  const liste = offresDeLaRubrique(OFFRES, 'tech');
  const html = pageDeRubrique('tech', 'fr', {
    noms, offres: liste, chiffres: chiffresDeLaRubrique(OFFRES, 'tech'), outils, dateMaj: '10 octobre 2026',
  });
  assert.match(html, /<meta name="robots" content="index, follow">/,
    'une page de rubrique noindex serait un travail pour rien — c’est exactement le piège de ce chantier');
  assert.doesNotMatch(html, /noindex/);
  // Et l'inverse est vrai aussi : les pages d'offres, elles, restent noindex.
  assert.ok(existe('docs/o'), 'les pages d’offres doivent toujours être publiées');
});

test('les trois langues se déclarent entre elles (hreflang), sinon elles se diluent', async () => {
  const outils = await chargesDevises();
  const html = pageDeRubrique('tech', 'nl', {
    noms, offres: offresDeLaRubrique(OFFRES, 'tech'), chiffres: chiffresDeLaRubrique(OFFRES, 'tech'),
    outils, dateMaj: '10 octobre 2026',
  });
  assert.match(html, /<html lang="nl">/);
  for (const l of LANGUES_PAGES) {
    assert.ok(html.includes(`hreflang="${l}"`), `hreflang="${l}" attendu`);
    assert.ok(html.includes(`rel="alternate"`));
  }
  assert.ok(html.includes('hreflang="x-default"'), 'x-default attendu, comme sur les pages légales');
});

test('la page française est la référence, et s’appelle sans suffixe', async () => {
  const outils = await chargesDevises();
  for (const l of LANGUES_PAGES) {
    const html = pageDeRubrique('tech', l, {
      noms, offres: offresDeLaRubrique(OFFRES, 'tech'), chiffres: chiffresDeLaRubrique(OFFRES, 'tech'),
      outils, dateMaj: '10 octobre 2026',
    });
    const attendu = l === 'fr' ? 'https://kazendra.com/rubriques/tech.html'
      : `https://kazendra.com/rubriques/tech.${l}.html`;
    assert.ok(html.includes(`<link rel="canonical" href="${attendu}">`), `canonique attendue pour ${l}`);
  }
});

/* ============================================ 2. les chiffres annoncés sont vrais */

test('les chiffres en tête de page sont RECOMPTÉS depuis le catalogue', () => {
  const cle = 'tech';
  const c = chiffresDeLaRubrique(OFFRES, cle);
  const attendues = OFFRES.filter((o) => o.categorie === cle && typeof o.prix === 'number' && isFinite(o.prix) && o.prix > 0);
  assert.equal(c.total, attendues.length, 'le nombre d’offres annoncé doit être le nombre réel');
  assert.equal(c.boutiques, new Set(attendues.map((o) => o.marchand).filter(Boolean)).size);
  // La remise annoncée est le maximum des remises MONTRABLES — pas des remises
  // brutes : les pages affichaient « 99 % » pour un écran « 99 % sRGB », que
  // l'application refuse pourtant d'afficher.
  const montrables = attendues.map((o) => remiseMontrable(o)).filter((r) => r != null);
  assert.equal(c.remiseMax, montrables.length ? Math.max(...montrables) : 0);
  assert.ok(c.total > 1000, `garde-fou : le catalogue doit être chargé (tech = ${c.total})`);
  assert.ok(c.remiseMax > 0, 'une rubrique fournie doit annoncer au moins une remise');
  assert.ok(c.remiseMax <= REMISE_ANNONCEE_MAX,
    `une remise de ${c.remiseMax} % dépasse la borne du projet (${REMISE_ANNONCEE_MAX})`);
});

test('aucune remise NON MONTRABLE n’est écrite sur la page', async () => {
  const outils = await chargesDevises();
  // Deux offres qui piègent : « 99 % » annoncé (non calculé, donc REFUSÉ par
  // l'application) et « 60 % » calculé (accepté).
  const piegee = { id: 'p99', titre: 'Ecran 99 % sRGB', prix: 10, remise: 99, remiseCalculee: false, categorie: 'tech', marchand: 'X' };
  const bonne = { id: 'p60', titre: 'Vraie promo', prix: 40, prixAvant: 100, remise: 60, remiseCalculee: true, categorie: 'tech', marchand: 'Y' };
  const triees = offresDeLaRubrique([piegee, bonne], 'tech');
  const html = pageDeRubrique('tech', 'fr', {
    noms, offres: triees, chiffres: chiffresDeLaRubrique([piegee, bonne], 'tech'),
    outils, dateMaj: '10 octobre 2026',
  });
  const corps = html.slice(html.indexOf('<ul>'));
  /** La carte d'une offre, du lien jusqu'à la fin de son <li>. */
  const carte = (id) => {
    const i = corps.indexOf(`/o/${id}.html`);
    if (i < 0) return '';
    const fin = corps.indexOf('</li>', i);
    return corps.slice(i, fin < 0 ? i + 900 : fin);
  };
  // Le titre « Ecran 99 % sRGB » a le DROIT d'être affiché : c'est le nom du
  // produit. Ce qui ne doit apparaître nulle part, c'est la REMISE −99 %.
  assert.ok(!carte('p99').includes('class="remise"'),
    'la carte fautive ne doit porter AUCUN badge de remise');
  assert.ok(!html.includes('−99 %'), 'la remise refusée par l’application ne doit pas être écrite');
  assert.doesNotMatch(html, /meilleure remise\s*:\s*99/, 'la phrase de tête ne doit pas annoncer 99 %');
  assert.match(carte('p60'), /−60 %/, 'la remise calculée, elle, s’affiche');
  // Et elle ne passe pas devant : le tri se fait sur la remise montrable.
  assert.ok(corps.indexOf('/o/p60.html') < corps.indexOf('/o/p99.html'),
    'la vraie promo passe avant celle dont la remise est refusée');
});

test('la phrase annoncée à l’écran porte EXACTEMENT les chiffres recalculés', async () => {
  const outils = await chargesDevises();
  const c = chiffresDeLaRubrique(OFFRES, 'tech');
  const html = pageDeRubrique('tech', 'fr', {
    noms, offres: offresDeLaRubrique(OFFRES, 'tech'), chiffres: c, outils, dateMaj: '10 octobre 2026',
  });
  assert.ok(html.includes(`${c.total} offres y sont suivies`), 'le total annoncé est celui du catalogue');
  assert.ok(html.includes(`de ${c.boutiques} boutiques`), 'le nombre de boutiques annoncé est celui du catalogue');
  assert.ok(html.includes(`atteint ${c.remiseMax} %`), 'la remise annoncée est celle du catalogue');
});

test('les prix sont dans la monnaie de LEUR pays, jamais convertis', async () => {
  const outils = await chargesDevises();
  // Trois offres réelles, une par marché hors zone euro. Si la page écrivait
  // des euros partout, on lirait « 153,39 € » sur une offre britannique — et le
  // visiteur croirait à un prix en euros.
  const parPays = {};
  for (const o of OFFRES) {
    if (['GB', 'PL', 'SE'].includes(o.pays) && typeof o.prix === 'number' && !parPays[o.pays]) parPays[o.pays] = o;
  }
  for (const p of ['GB', 'PL', 'SE']) {
    assert.ok(parPays[p], `garde-fou : le catalogue doit contenir une offre ${p}`);
  }
  const liste = [parPays.GB, parPays.PL, parPays.SE];
  const html = pageDeRubrique('tech', 'fr', {
    noms, offres: liste, chiffres: { total: 3, boutiques: 3, remiseMax: 10 }, outils, dateMaj: '10 octobre 2026',
  });
  // On cherche DANS LA LISTE, pas dans le <head> : le balisage contient aussi
  // les adresses /o/…, et s'y tromper ferait passer l'épreuve pour de mauvaises
  // raisons (constaté à la première écriture de ce test).
  const corps = html.slice(html.indexOf('<ul>'));
  assert.ok(corps.length > 100, 'la liste des offres doit être présente dans <body>');
  const prixAffiche = (o) => {
    const i = corps.indexOf(`/o/${o.id}.html`);
    assert.ok(i > 0, `l’offre ${o.id} doit figurer dans la liste`);
    const bloc = corps.slice(i, i + 900);
    return (bloc.match(/<b>([^<]+)<\/b>/) || [])[1] || '';
  };
  assert.match(prixAffiche(parPays.GB), /£/, 'une offre britannique s’affiche en livres');
  assert.doesNotMatch(prixAffiche(parPays.GB), /€/, 'jamais en euros');
  assert.match(prixAffiche(parPays.PL), /zł/, 'une offre polonaise s’affiche en zlotys');
  assert.match(prixAffiche(parPays.SE), /kr/, 'une offre suédoise s’affiche en couronnes');
});

/* ============================================================ 3. forme du balisage */

test('le balisage de la page est un JSON valide, avec la liste ET le fil d’Ariane', async () => {
  const outils = await chargesDevises();
  const liste = offresDeLaRubrique(OFFRES, 'tech');
  const html = pageDeRubrique('tech', 'fr', {
    noms, offres: liste, chiffres: chiffresDeLaRubrique(OFFRES, 'tech'), outils, dateMaj: '10 octobre 2026',
  });
  const blocs = blocsJSONLD(html);
  assert.equal(blocs.length, 1, 'un seul bloc JSON-LD par page');
  assert.equal(blocs[0]['@context'], 'https://schema.org');
  const types = blocs[0]['@graph'].map((n) => n['@type']);
  assert.deepEqual(types, ['ItemList', 'BreadcrumbList']);
  // Le @context ne se répète pas dans chaque nœud : il est porté par le graph.
  for (const noeud of blocs[0]['@graph']) {
    assert.ok(!noeud['@context'], 'le @context appartient au graph, pas à chaque nœud');
  }
  const itemList = blocs[0]['@graph'][0];
  assert.equal(itemList.numberOfItems, liste.length);
  assert.equal(itemList.inLanguage, 'fr');
  assert.equal(itemList.itemListOrder, 'https://schema.org/DescendingOrder');
  itemList.itemListElement.forEach((el, i) => {
    assert.equal(el.position, i + 1);
    assert.equal(el.item['@type'], 'Product');
    assert.ok(el.item.offers.price > 0, 'aucune offre sans prix ne doit être listée');
    assert.match(el.item.url, /^https:\/\/kazendra\.com\/o\/.+\.html$/);
  });
});

test('le balisage ne déclare JAMAIS plus d’offres que la page n’en affiche', async () => {
  const outils = await chargesDevises();
  const liste = offresDeLaRubrique(OFFRES, 'tech');
  const html = pageDeRubrique('tech', 'fr', {
    noms, offres: liste, chiffres: chiffresDeLaRubrique(OFFRES, 'tech'), outils, dateMaj: '10 octobre 2026',
  });
  const cartes = (html.match(/<li><a href="/g) || []).length;
  const declarees = blocsJSONLD(html)[0]['@graph'][0].numberOfItems;
  assert.equal(cartes, declarees, 'autant de cartes affichées que d’éléments déclarés');
  assert.ok(cartes <= MAX_OFFRES, `la page ne liste pas plus de ${MAX_OFFRES} offres (${cartes})`);
});

/* ================================================ 4. contenu propre, pas de coquille vide */

test('chaque page porte du texte PROPRE, pas seulement des prix', () => {
  const texteNu = (html) => html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  for (const l of LANGUES_PAGES) {
    const outils = { deviseDe: (o) => ({ code: 'EUR', symbole: '€' }), montant: (v) => `${v} €` };
    const html = pageDeRubrique('tech', l, {
      noms, offres: offresDeLaRubrique(OFFRES, 'tech'), chiffres: chiffresDeLaRubrique(OFFRES, 'tech'),
      outils, dateMaj: '10 octobre 2026',
    });
    const texte = texteNu(html);
    assert.ok(texte.length > 600, `la version « ${l} » doit porter un vrai texte (${texte.length} caractères)`);
    assert.ok(/Kazendra/.test(texte), `la version « ${l} » doit nommer le site`);
  }
});

test('la page dit que Kazendra n’est PAS le vendeur — dans les trois langues', () => {
  const outils = { deviseDe: () => ({ code: 'EUR' }), montant: (v) => `${v} €` };
  const attendus = { fr: /n’est pas un vendeur|n'est pas un vendeur/, nl: /geen verkoper/, en: /not the seller/ };
  for (const l of LANGUES_PAGES) {
    const html = pageDeRubrique('tech', l, {
      noms, offres: offresDeLaRubrique(OFFRES, 'tech'), chiffres: chiffresDeLaRubrique(OFFRES, 'tech'),
      outils, dateMaj: '10 octobre 2026',
    });
    assert.match(html.replace(/<[^>]+>/g, ' '), attendus[l], `version ${l} : le rôle de Kazendra doit être dit`);
  }
});

test('un titre d’offre qui contient du HTML est ÉCHAPPÉ, jamais interprété', async () => {
  const outils = await chargesDevises();
  const piege = { id: 'zz', titre: '<script>alert(1)</script> "guillemets" & <b>gras</b>', prix: 10, pays: 'FR', categorie: 'tech', marchand: 'X' };
  const html = pageDeRubrique('tech', 'fr', {
    noms, offres: [piege], chiffres: { total: 1, boutiques: 1, remiseMax: 0 }, outils, dateMaj: '10 octobre 2026',
  });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'un titre ne doit jamais s’exécuter');
  assert.ok(html.includes('&lt;script&gt;'), 'le titre doit apparaître échappé');
});

/* ==================================================== 5. ce qui est publié sur disque */

test('les pages sont réellement écrites sur le disque, dans les trois langues', () => {
  assert.ok(existe('docs/rubriques'), 'docs/rubriques/ doit exister — lancer « node outils/pages-rubriques.mjs »');
  const fichiers = readdirSync(join(RACINE, 'docs', 'rubriques'));
  const rubriques = ordre.filter((c) => c !== 'autre' && chiffresDeLaRubrique(OFFRES, c).total >= SEUIL);
  assert.ok(rubriques.length >= 10, `garde-fou : ${rubriques.length} rubrique(s) éligible(s)`);
  for (const cle of rubriques) {
    for (const l of LANGUES_PAGES) {
      const f = l === 'fr' ? `${cle}.html` : `${cle}.${l}.html`;
      assert.ok(fichiers.includes(f), `docs/rubriques/${f} doit exister`);
    }
  }
  // Aucune page « Autres » : ce n'est pas une rubrique présentable.
  assert.ok(!fichiers.some((f) => f.startsWith('autre.')),
    '« Autres » est un fourre-tout : il n’a pas de page, et c’est une décision');
});

test('chaque lien /o/<id>.html listé existe VRAIMENT', () => {
  const fichiers = readdirSync(join(RACINE, 'docs', 'rubriques'));
  let verifies = 0;
  for (const f of fichiers) {
    const html = lire(join('docs', 'rubriques', f));
    for (const m of html.matchAll(/href="https:\/\/kazendra\.com\/o\/([^"]+)\.html"/g)) {
      const cible = join(RACINE, 'docs', 'o', `${m[1]}.html`);
      assert.ok(existsSync(cible), `docs/rubriques/${f} pointe vers une page absente : ${m[1]}`);
      verifies++;
    }
  }
  assert.ok(verifies > 200, `trop peu de liens vérifiés (${verifies}) — l’épreuve ne prouverait rien`);
});

test('le plan de site PUBLIÉ liste les rubriques, et rien qui n’existe', () => {
  assert.ok(existe('docs/sitemap.xml'), 'le plan publié doit exister');
  const xml = lire('docs/sitemap.xml');
  const adresses = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  // Les 13 adresses du dépôt (accueil + 12 pages légales) restent là.
  const depot = [...lire('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const u of depot) {
    assert.ok(adresses.includes(u), `le plan publié a PERDU ${u} — il doit partir du plan du dépôt`);
  }
  const rubriques = adresses.filter((u) => u.includes('/rubriques/'));
  assert.ok(rubriques.length >= 30, `le plan publié doit lister les rubriques (${rubriques.length} trouvées)`);

  for (const u of adresses) {
    assert.ok(u.startsWith('https://kazendra.com/'), `adresse hors du site : ${u}`);
    const chemin = u.replace('https://kazendra.com/', '') || 'index.html';
    const f = chemin.endsWith('/') ? chemin + 'index.html' : chemin;
    assert.ok(existe(join('docs', f)), `le plan publié annonce ${u}, mais docs/${f} n’existe pas`);
  }
});

test('le plan de site ne PERD jamais les adresses du dépôt quand on le régénère', () => {
  // On écrit dans un dossier temporaire : le dossier publié est servi en
  // permanence, et le cron de collecte y écrit toutes les cinq minutes.
  const tmp = mkdtempSync(join(tmpdir(), 'sitemap-'));
  const provisoire = join(tmp, 'sitemap.xml');
  const { total, ajouts } = ecrireSitemapPublie([], { date: '2026-10-10', vers: provisoire });
  assert.equal(ajouts, 0);
  assert.equal(total, 13, 'le plan du dépôt porte l’accueil et les 12 pages légales');
  assert.equal(readFileSync(provisoire, 'utf8'), lire('public/sitemap.xml'),
    'sans rubrique à ajouter, le plan publié EST celui du dépôt');

  // Et avec des rubriques : elles s'ajoutent SANS rien retirer.
  const urls = ['https://kazendra.com/rubriques/tech.html', 'https://kazendra.com/rubriques/tech.nl.html'];
  ecrireSitemapPublie(urls, { date: '2026-10-10', vers: provisoire });
  const xml = readFileSync(provisoire, 'utf8');
  const adresses = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(adresses.length, 15);
  for (const u of [...lire('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) {
    assert.ok(adresses.includes(u), `${u} a été perdue`);
  }
  assert.ok(adresses.includes(urls[0]) && adresses.includes(urls[1]));
  assert.match(xml, /<\/urlset>\s*$/, 'le document doit rester bien formé');
  // Ajouter deux fois la même adresse ne la duplique pas.
  ecrireSitemapPublie(urls, { date: '2026-10-10', vers: provisoire });
  assert.equal([...readFileSync(provisoire, 'utf8').matchAll(/<loc>/g)].length, 15);
  rmSync(tmp, { recursive: true, force: true });
});

/* ==================================================== 6. les libellés viennent du site */

test('les noms de rubrique sont ceux de l’application, traduits par son dictionnaire', () => {
  assert.equal(nomRubrique('tech', 'fr', noms), 'High-tech');
  assert.equal(nomRubrique('tech', 'nl', noms), 'Hightech');
  assert.equal(nomRubrique('tech', 'en', noms), 'Tech');
  // Une rubrique inconnue ne casse pas : elle s'affiche sous sa clé.
  assert.equal(nomRubrique('zzz', 'fr', noms), 'zzz');
});

test('aucune offre sans prix n’entre dans une liste', () => {
  const melange = [
    { id: 'a', titre: 'A', prix: 10, categorie: 'tech', marchand: 'X' },
    { id: 'b', titre: 'B', prix: null, categorie: 'tech', marchand: 'X' },
    { id: 'c', titre: 'C', categorie: 'tech', marchand: 'X' },
    { id: 'd', titre: 'D', prix: 0, categorie: 'tech', marchand: 'X' },
    { id: 'e', titre: 'E', prix: 5, categorie: 'maison', marchand: 'X' },
  ];
  const gardees = offresDeLaRubrique(melange, 'tech').map((o) => o.id);
  assert.deepEqual(gardees, ['a'], 'ni un prix nul, ni un prix absent, ni une autre rubrique');
});

test('les offres à DEUX PRIX passent devant les prix nus', () => {
  const melange = [
    { id: 'nu', titre: 'Nu', prix: 10, remise: 90, categorie: 'tech', marchand: 'X' },
    { id: 'deux', titre: 'Deux', prix: 10, prixAvant: 100, remise: 10, categorie: 'tech', marchand: 'X' },
  ];
  assert.deepEqual(offresDeLaRubrique(melange, 'tech').map((o) => o.id), ['deux', 'nu'],
    'un vrai bon plan (deux prix) passe avant un prix nu à forte remise annoncée');
});

test('la page ne montre pas six fois le même marchand d’affilée', () => {
  // Défaut constaté en regardant la première page produite : six caméras Blink,
  // six fois le même produit sur six marchés. Une page dont les premières lignes
  // sont le même objet n'apprend rien.
  const liste = [];
  for (let i = 0; i < 10; i++) {
    liste.push({ id: `a${i}`, titre: `Article ${i}`, prix: 10, prixAvant: 100, remise: 90 - i, categorie: 'tech', marchand: 'Amazon' });
  }
  for (let i = 0; i < 5; i++) {
    liste.push({ id: `b${i}`, titre: `Autre ${i}`, prix: 10, prixAvant: 100, remise: 50 - i, categorie: 'tech', marchand: 'Coolblue' });
  }
  const ordonnees = offresDeLaRubrique(liste, 'tech', 15);
  const deuxPremiers = ordonnees.slice(0, 2);
  assert.deepEqual(deuxPremiers.map((o) => o.marchand), ['Amazon', 'Amazon'], 'au plus deux par marchand');
  const premiersAmazon = ordonnees.findIndex((o) => o.marchand !== 'Amazon');
  assert.ok(premiersAmazon <= 2, `le troisième Amazon arrive en position ${premiersAmazon + 1} — trop tôt`);
  // Mais rien n'est PERDU : les dix Amazon restent, simplement plus bas.
  assert.equal(ordonnees.filter((o) => o.marchand === 'Amazon').length, 10,
    'la diversité réordonne, elle n’écarte pas');
  assert.equal(ordonnees.length, 15);
});

test('la diversité n’appauvrit jamais la page : elle se remplit jusqu’au bout', () => {
  const liste = [];
  for (let i = 0; i < 30; i++) {
    liste.push({ id: `a${i}`, titre: `Article ${i}`, prix: 10, prixAvant: 100, remise: 80, categorie: 'tech', marchand: 'Amazon' });
  }
  const ordonnees = offresDeLaRubrique(liste, 'tech', 24);
  assert.equal(ordonnees.length, 24, 'la page doit rester pleine même si un seul marchand alimente la rubrique');
});
