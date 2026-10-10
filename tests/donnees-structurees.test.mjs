/**
 * LES DONNÉES STRUCTURÉES SCHEMA.ORG — application n°2 « Promos ».
 * =============================================================================
 *
 * CE QUE CES ÉPREUVES PROTÈGENT, ET POURQUOI ELLES SONT ÉCRITES AINSI
 *
 * Un balisage n'est pas un ornement : c'est une **affirmation faite aux moteurs
 * de recherche au nom de B**. Une affirmation fausse ne se voit pas à l'écran —
 * elle ne se voit que le jour où Google l'ignore, ou pire, l'affiche.
 *
 * Trois familles d'épreuves, dans l'ordre d'importance :
 *
 *   1. RIEN N'EST INVENTÉ. Le projet s'interdit d'écrire un chiffre qu'il ne
 *      peut pas prouver (règle posée depuis mentions-legales.html). Le balisage
 *      ne fait pas exception : ni `availability`, ni `aggregateRating`, ni
 *      `brand`, ni taxe TTC/HT — le site ne les affiche nulle part, donc il ne
 *      peut pas les déclarer. Ces épreuves ÉCHOUENT si l'un d'eux réapparaît.
 *
 *   2. CE QUI EST DÉCLARÉ EST VRAI, ET VÉRIFIABLE. Le prix déclaré est celui du
 *      catalogue publié ; la monnaie est celle du PAYS de la place de marché
 *      (lue dans public/app.js, comparée à celle du module — deux tables qui
 *      divergent afficheraient « 108,82 zł » pendant que le balisage annonce des
 *      euros) ; l'adresse déclarée est une page qui EXISTE sur le disque.
 *
 *   3. LA DÉCISION OUVERTE EST RESPECTÉE. Les 17 045 pages d'offres sont
 *      `noindex` — mesuré. Écrire un balisage dessus ne servirait à rien. Un
 *      test exerce donc LES DEUX BRANCHES de la décision : aujourd'hui les pages
 *      restent `noindex` et sans balisage, et le jour où B dit « indexe », la
 *      même fonction produit l'inverse, exactement.
 *
 * Lancement : node --test tests/donnees-structurees.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  INDEXER_PAGES_OFFRES, baliseOffre, baliseListe, baliseFilAriane,
  scriptJSONLD, codeDevise, absolue, urlPageOffre, echapper, tableDevisesDuSite,
  DEVISE_PAR_PAYS, ORIGINE, remiseMontrable, REMISE_ANNONCEE_MAX,
} from '../outils/donnees-structurees.mjs';
import { pageDeLOffre, chargesDevises } from '../outils/pages-partage.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');

const catalogue = JSON.parse(lire('docs/offres.json'));
const OFFRES = Array.isArray(catalogue) ? catalogue : catalogue.offres || [];
/** Un échantillon large mais borné : le catalogue entier n'apporte rien de plus
 *  et rendrait la suite lente. 300 offres couvrent les douze marchés. */
const ECHANTILLON = OFFRES.slice(0, 300);
const avecPrix = OFFRES.filter((o) => typeof o.prix === 'number' && isFinite(o.prix));
const avecDeuxPrix = avecPrix.filter((o) => typeof o.prixAvant === 'number' && o.prixAvant > o.prix);

/** Le JSON d'un bloc <script type="application/ld+json">, reparsé. */
function blocsJSONLD(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]));
}

/* ============================================ 1. le module ne fabrique rien */

test('sans titre, ou sans prix, il n’y a RIEN à déclarer — et rien n’est déclaré', () => {
  assert.equal(baliseOffre(null), null, 'une offre absente ne produit pas de balisage');
  assert.equal(baliseOffre({ prix: 10 }), null, 'sans titre, pas de balisage');
  assert.equal(baliseOffre({ titre: 'X' }), null, 'sans prix, pas de balisage');
  assert.equal(baliseOffre({ titre: 'X', prix: 'bientôt' }), null, 'un prix non numérique ne compte pas');
  // Un prix à zéro est un prix : on ne le confond pas avec un prix absent.
  assert.ok(baliseOffre({ titre: 'X', prix: 0 }), 'un prix de 0 reste un prix déclarable');
});

test('aucun champ NON PROUVABLE n’est déclaré — la règle du projet, rendue exécutable', () => {
  // Le site n'affiche NI disponibilité, NI avis, NI marque, NI référence
  // produit, NI mention TTC/HT. Les déclarer serait une affirmation gratuite.
  const interdits = ['availability', 'aggregateRating', 'review', 'brand', 'sku',
    'gtin', 'gtin13', 'valueAddedTaxIncluded', 'priceValidUntil', 'ratingValue'];
  const texte = scriptJSONLD(baliseOffre({
    titre: 'Aspirateur Rowenta', prix: 99.99, prixAvant: 199.99,
    marchand: 'Darty', image: 'img/x.jpg', id: 'abc', pays: 'FR',
  }));
  for (const cle of interdits) {
    assert.ok(!texte.includes(`"${cle}"`),
      `« ${cle} » ne doit pas être déclaré : le site ne l'affiche nulle part`);
  }
});

test('la monnaie est celle du PAYS, jamais une conversion', () => {
  assert.equal(codeDevise({ pays: 'GB' }), 'GBP');
  assert.equal(codeDevise({ pays: 'SE' }), 'SEK');
  assert.equal(codeDevise({ pays: 'PL' }), 'PLN');
  for (const pays of ['BE', 'FR', 'DE', 'IT', 'ES', 'NL', 'AT', 'PT', 'IE']) {
    assert.equal(codeDevise({ pays }), 'EUR', `${pays} est dans la zone euro`);
  }
  assert.equal(codeDevise({ pays: 'ZZ' }), 'EUR', 'un pays inconnu retombe sur l’euro, comme le site');
});

test('la table des monnaies du module est IDENTIQUE à celle du site', () => {
  // Deux tables qui divergent, c'est le site qui affiche « 108,82 zł » pendant
  // que le balisage annonce des euros. On lit celle d'app.js et on compare.
  const site = tableDevisesDuSite();
  const module = Object.fromEntries(Object.entries(DEVISE_PAR_PAYS).map(([p, d]) => [p, { code: d.code }]));
  assert.deepEqual(module, site,
    'DEVISE_PAR_PAYS a changé dans public/app.js sans être reportée dans outils/donnees-structurees.mjs');
  assert.deepEqual(Object.keys(site).sort(), ['GB', 'PL', 'SE'],
    'seuls les trois marchés hors zone euro déclarent une monnaie : le reste est en euros');
});

/* ============================================ 2. ce qui est déclaré est vrai */

test('la règle des 90 % du site est reprise à l’identique, et appliquée', () => {
  // Deux tables qui divergent, c'est une page qui annonce « −99 % » pour un
  // écran « 99 % sRGB » — une remise que l'application refuse d'afficher.
  const app = readFileSync(join(RACINE, 'public', 'app.js'), 'utf8');
  const m = app.match(/const REMISE_ANNONCEE_MAX = (\d+);/);
  assert.ok(m, 'REMISE_ANNONCEE_MAX doit exister dans public/app.js');
  assert.equal(REMISE_ANNONCEE_MAX, Number(m[1]),
    'la borne du module et celle du site ont divergé');
  assert.match(app, /function remiseMontrable\(o\)\s*\{[\s\S]*?remiseCalculee \|\| o\.remise <= REMISE_ANNONCEE_MAX/,
    'la forme de la règle a changé dans app.js — la reprise ici doit suivre');

  // Et le comportement, sur les deux cas qui comptent.
  assert.equal(remiseMontrable({ remise: 30 }), 30);
  assert.equal(remiseMontrable({ remise: 30, remiseCalculee: true }), 30);
  assert.equal(remiseMontrable({ remise: 99 }), null, '99 % annoncé n’est pas une remise : refusé');
  assert.equal(remiseMontrable({ remise: 99, remiseCalculee: true }), 99, 'mais une remise CALCULÉE passe');
  assert.equal(remiseMontrable({ remise: null }), null);
  assert.equal(remiseMontrable({}), null);
  assert.equal(remiseMontrable(null), null);
});

test('sur les offres RÉELLES du catalogue publié, le prix et la monnaie sont exacts', () => {
  assert.ok(avecPrix.length > 1000, `garde-fou : le catalogue doit être chargé, trouvé ${avecPrix.length}`);
  let vus = 0;
  for (const o of ECHANTILLON) {
    const bloc = baliseOffre(o);
    if (!bloc) continue;
    vus++;
    assert.equal(bloc['@type'], 'Product');
    assert.equal(bloc['@context'], 'https://schema.org');
    assert.equal(bloc.offers.price, Math.round(o.prix * 100) / 100, `prix déclaré ≠ prix du catalogue pour ${o.id}`);
    assert.equal(bloc.offers.priceCurrency, codeDevise(o), `monnaie déclarée ≠ monnaie du pays pour ${o.id}`);
    assert.equal(bloc.name, String(o.titre).slice(0, 300));
    // Le bloc doit être du JSON valide : c'est ce que le robot lit.
    JSON.parse(JSON.stringify(bloc));
  }
  assert.ok(vus > 250, `l’échantillon doit produire du balisage, ${vus} bloc(s) seulement`);
});

test('le prix de référence n’est déclaré QUE s’il existe, et seulement s’il est plus haut', () => {
  const sans = baliseOffre({ titre: 'A', prix: 10, marchand: 'X' });
  assert.ok(!sans.offers.priceSpecification, 'pas de prix de référence → pas de bloc : on n’invente pas un « avant »');

  const avec = baliseOffre({ titre: 'A', prix: 10, prixAvant: 30, marchand: 'X' });
  assert.equal(avec.offers.priceSpecification['@type'], 'UnitPriceSpecification');
  assert.equal(avec.offers.priceSpecification.price, 30);
  assert.equal(avec.offers.priceSpecification.priceType, 'https://schema.org/ListPrice');

  // Un « avant » PLUS BAS que le prix n'est pas une promotion : il est ignoré,
  // exactement comme le badge « économise » du site.
  const absurde = baliseOffre({ titre: 'A', prix: 10, prixAvant: 5 });
  assert.ok(!absurde.offers.priceSpecification, 'un prix « avant » inférieur au prix ne se déclare pas');

  assert.ok(avecDeuxPrix.length > 100, `garde-fou : ${avecDeuxPrix.length} offre(s) à deux prix`);
});

test('l’adresse déclarée est une page qui EXISTE — on ne balise pas vers du 404', () => {
  let verifiees = 0;
  for (const o of ECHANTILLON.slice(0, 60)) {
    const bloc = baliseOffre(o);
    if (!bloc || !bloc.url) continue;
    assert.equal(bloc.url, `${ORIGINE}/o/${o.id}.html`);
    assert.equal(bloc.offers.url, bloc.url, 'le prix doit renvoyer à la MÊME page que le produit');
    const fichier = join(RACINE, 'docs', 'o', `${o.id}.html`);
    assert.ok(existsSync(fichier), `le balisage pointe ${bloc.url} mais docs/o/${o.id}.html n’existe pas`);
    verifiees++;
  }
  assert.ok(verifiees >= 50, `trop peu d’adresses vérifiées (${verifiees})`);
});

test('l’image déclarée est une adresse ABSOLUE du site', () => {
  const relatif = baliseOffre({ titre: 'A', prix: 1, image: 'img/abc.jpg' });
  assert.deepEqual(relatif.image, [`${ORIGINE}/img/abc.jpg`]);
  const distant = baliseOffre({ titre: 'A', prix: 1, image: 'https://cdn.exemple.tld/p.jpg' });
  assert.deepEqual(distant.image, ['https://cdn.exemple.tld/p.jpg'], 'une image non rapatriée garde son adresse');
  const sans = baliseOffre({ titre: 'A', prix: 1 });
  assert.ok(!sans.image, 'sans visuel, on n’en déclare aucun — pas de vignette inventée');
  assert.equal(absolue(null), null);
});

test('un titre HTML ne casse pas la page : il est échappé', () => {
  assert.equal(echapper('a<b>&"c'), 'a&lt;b&gt;&amp;&quot;c');
});

/* ============================ 3. la décision ouverte est respectée, des deux côtés */

test('AUJOURD’HUI : les pages d’offres restent noindex et NE PORTENT PAS de balisage', async () => {
  assert.equal(INDEXER_PAGES_OFFRES, false,
    'la décision d’indexer les pages d’offres n’a pas été prise — voir PLAN-DONNEES-STRUCTUREES-ET-TABLEURS.md § 5');
  const outils = await chargesDevises();
  const html = pageDeLOffre({ id: 'zz1', titre: 'Test', prix: 10, pays: 'BE', marchand: 'X' }, outils);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.equal(blocsJSONLD(html).length, 0,
    'écrire un balisage sur une page noindex ne sert à rien : c’est ce qui avait arrêté le chantier le 09/10/2026');
});

test('LE JOUR OÙ B DIT OUI : la même fonction indexe ET balise, sans autre changement', async () => {
  const outils = await chargesDevises();
  const offre = avecDeuxPrix[0];
  const html = pageDeLOffre(offre, outils, { indexer: true });
  assert.match(html, /<meta name="robots" content="index, follow">/, 'la page devient indexable');
  const blocs = blocsJSONLD(html);
  assert.equal(blocs.length, 1);
  const p = blocs[0];
  assert.equal(p['@type'], 'Product');
  assert.equal(p.offers.price, Math.round(offre.prix * 100) / 100, 'le prix déclaré est celui AFFICHÉ sur la page');
  assert.equal(p.offers.priceCurrency, codeDevise(offre));
  assert.equal(p.url, urlPageOffre(offre));
  // Et le prix barré visible dans la page est bien celui déclaré.
  assert.ok(html.includes('priceSpecification'), 'un prix de référence affiché doit être déclaré');
});

/* ============================================ 4. les listes et le fil d'Ariane */

test('une liste ne déclare jamais plus d’éléments qu’elle n’en a, ni de position fausse', () => {
  const bloc = baliseListe(avecPrix.slice(0, 40), { titre: 'Bonnes promos', url: `${ORIGINE}/rubriques/tech.html`, max: 10 });
  assert.equal(bloc['@type'], 'ItemList');
  assert.equal(bloc.numberOfItems, 10);
  assert.equal(bloc.itemListElement.length, 10);
  bloc.itemListElement.forEach((el, i) => {
    assert.equal(el['@type'], 'ListItem');
    assert.equal(el.position, i + 1, 'les positions doivent être 1, 2, 3… sans trou');
    assert.equal(el.item['@type'], 'Product');
  });
  assert.equal(baliseListe([], { titre: 'vide' }), null, 'une liste vide ne se déclare pas');
  // Les offres sans prix sont écartées, pas déclarées à zéro.
  const mixte = baliseListe([{ titre: 'sans prix' }, ...avecPrix.slice(0, 3)], { titre: 't', max: 10 });
  assert.equal(mixte.itemListElement.length, 3);
});

test('le fil d’Ariane mène de l’accueil à la rubrique', () => {
  const bloc = baliseFilAriane({ rubrique: 'High-tech', urlRubrique: `${ORIGINE}/rubriques/tech.html` });
  assert.equal(bloc['@type'], 'BreadcrumbList');
  assert.equal(bloc.itemListElement.length, 2);
  assert.equal(bloc.itemListElement[0].item, `${ORIGINE}/`);
  assert.equal(bloc.itemListElement[1].name, 'High-tech');
  assert.deepEqual(bloc.itemListElement.map((e) => e.position), [1, 2]);
});

test('le bloc écrit dans une page est du JSON VALIDE, relu par un parseur', () => {
  const texte = scriptJSONLD(baliseOffre(avecPrix[0]));
  assert.match(texte, /^<script type="application\/ld\+json">/);
  assert.match(texte, /<\/script>$/);
  const dedans = texte.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  const lu = JSON.parse(dedans);
  assert.equal(lu['@context'], 'https://schema.org');
  assert.equal(scriptJSONLD(null), '', 'rien à déclarer → rien d’écrit');
  assert.equal(scriptJSONLD([]), '');

  // Deux blocs sont réunis sous UN SEUL graph, et le @context n'y est pas répété.
  const double = scriptJSONLD([baliseOffre(avecPrix[0]), baliseFilAriane({ rubrique: 'Tech', urlRubrique: `${ORIGINE}/rubriques/tech.html` })]);
  const lu2 = JSON.parse(double.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
  assert.equal(lu2['@context'], 'https://schema.org');
  assert.equal(lu2['@graph'].length, 2);
  for (const noeud of lu2['@graph']) assert.ok(!noeud['@context'], 'le @context appartient au graph');
  assert.deepEqual(lu2['@graph'].map((n) => n['@type']), ['Product', 'BreadcrumbList']);
});

/* ==================================== 5. l'accueil : l'identité, et rien de plus */

test('l’accueil déclare QUI publie le site et QUEL site c’est', () => {
  const html = lire('public/index.html');
  const blocs = blocsJSONLD(html);
  assert.equal(blocs.length, 1, 'un seul bloc sur l’accueil, pour ne pas se contredire');
  const types = blocs[0]['@graph'].map((n) => n['@type']);
  assert.deepEqual(types, ['Organization', 'WebSite']);
  const [org, site] = blocs[0]['@graph'];
  assert.equal(org.name, 'Kazendra');
  assert.equal(org.url, `${ORIGINE}/`);
  assert.equal(site.publisher['@id'], org['@id'], 'le site doit nommer son éditeur, pas un autre');
  assert.ok(org.logo.url.startsWith(`${ORIGINE}/`), 'le logo doit être servi par le site, pas par un tiers');
  assert.ok(existsSync(join(RACINE, 'public', 'favicon.svg')), 'le logo déclaré doit exister');
});

test('l’accueil ne déclare NI adresse, NI numéro d’entreprise, NI recherche', () => {
  // Ces trois-là sont exactement les pièges : une adresse inventée ici serait
  // recopiée par les moteurs, et une SearchAction sans adresse de recherche
  // enverrait les robots vers une page morte (mesuré : le site n'a pas de ?q=).
  const html = lire('public/index.html');
  const texte = JSON.stringify(blocsJSONLD(html));
  for (const cle of ['address', 'vatNumber', 'taxID', 'telephone', 'email', 'SearchAction', 'potentialAction']) {
    assert.ok(!texte.includes(`"${cle}"`), `« ${cle} » ne doit pas figurer sur l’accueil : rien ne le prouve`);
  }
  assert.ok(!/potentialAction/.test(html));
});

test('aucun domaine tiers n’est déclaré à la place du site', () => {
  const html = lire('public/index.html');
  for (const bloc of blocsJSONLD(html)) {
    const urls = JSON.stringify(bloc).match(/https?:\/\/[^"\\]+/g) || [];
    for (const u of urls) {
      assert.ok(u === 'https://schema.org' || u.startsWith('https://schema.org/') || u.startsWith(ORIGINE),
        `adresse non vérifiée déclarée dans le balisage : ${u}`);
    }
  }
});
