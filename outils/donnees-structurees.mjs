#!/usr/bin/env node
/**
 * DONNÉES STRUCTURÉES SCHEMA.ORG — application n°2 « Promos ».
 * =============================================================================
 *
 * CE QUE CE FICHIER PRODUIT, ET RIEN DE PLUS : des objets JSON-LD conformes à
 * schema.org, sérialisés en `<script type="application/ld+json">`. Il n'écrit
 * aucun fichier : ce sont les appelants (pages de rubrique, pages de partage)
 * qui décident où le bloc atterrit.
 *
 * ---------------------------------------------------------------------------
 * CE QUI A ÉTÉ MESURÉ LE 10/10/2026, AVANT D'ÉCRIRE UNE LIGNE
 * ---------------------------------------------------------------------------
 *
 *   `docs/o/*.html` .................. 17 045 pages, TOUTES `noindex, follow`
 *   `docs/index.html` ................ aucun bloc application/ld+json
 *   `public/sitemap.xml` ............. 13 adresses (accueil + 12 pages légales)
 *   Recherche par paramètre d'URL .... AUCUNE (ni URLSearchParams, ni
 *                                       location.search dans public/app.js)
 *
 * Conséquence, et c'est le cœur du sujet : **poser un `Product` sur une page
 * `noindex` ne sert à rien.** Le chantier avait été arrêté le 09/10 pour cette
 * raison exacte, plutôt que d'écrire 17 045 fichiers pour rien.
 *
 * ---------------------------------------------------------------------------
 * LA RÈGLE DU PROJET, APPLIQUÉE AU BALISAGE
 * ---------------------------------------------------------------------------
 *
 * On ne déclare que ce qui est VRAI **ET** VISIBLE SUR LA PAGE. Un balisage qui
 * décrit autre chose que la page est un mensonge poli, et Google le sanctionne
 * en ignorant le bloc — au mieux.
 *
 *   ✅ `name`            — le titre, tel qu'affiché
 *   ✅ `image`           — le visuel, quand il y en a un
 *   ✅ `offers.price`    — le prix réel, dans SA monnaie (jamais converti)
 *   ✅ `offers.priceSpecification` (ListPrice) — le prix de référence, **seulement
 *      quand il existe**. Il n'est pas inventé : c'est `prixAvant`, et la règle
 *      des DEUX PRIX du projet interdit déjà d'afficher un « économise » sans lui.
 *   ✅ `offers.seller`   — le marchand, nommé
 *
 *   ❌ `availability`    — RETIRÉ VOLONTAIREMENT. Le site n'affiche nulle part
 *      « en stock » ni « épuisé » : rien ne permet de l'affirmer. Google demande
 *      `availability` OU `priceValidUntil` pour un résultat enrichi produit ;
 *      sans l'un des deux le bloc reste VALIDE mais moins souvent affiché.
 *      C'est assumé : un `InStock` deviné serait une affirmation non prouvée, et
 *      c'est exactement ce que ce projet s'interdit depuis le début.
 *   ❌ `aggregateRating`, `review` — aucun avis n'existe. On ne les fabrique pas.
 *   ❌ `brand`, `sku`, `gtin`      — non fournis par les marchands. On ne devine
 *      pas une marque à partir d'un titre : « Dell P2422H » n'est pas la marque
 *      de « Support écran Dell-compatible ».
 *
 * ---------------------------------------------------------------------------
 * LA DEVISE
 * ---------------------------------------------------------------------------
 *
 * Reprise À L'IDENTIQUE de `DEVISE_PAR_PAYS` (public/app.js) : la devise est une
 * propriété du PAYS de la place de marché, relevée en lisant ce que la place
 * annonce elle-même, jamais déduite. `tests/donnees-structurees.test.mjs` relit
 * la table dans app.js et échoue si les deux divergent — sinon le site
 * afficherait « 108,82 zł » pendant que le balisage annoncerait des euros.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
export const RACINE_PROJET = join(ICI, '..');
export const ORIGINE = 'https://kazendra.com';

/**
 * LA DÉCISION OUVERTE, EN UNE LIGNE.
 *
 * `false` = les 17 045 pages d'offres restent `noindex` et ne reçoivent AUCUN
 * balisage : écrire 17 045 blocs que personne ne lira est un gaspillage, et
 * c'est ce qui avait fait arrêter le chantier le 09/10/2026.
 *
 * `outils/pages-partage.mjs` IMPORTE cette constante — il n'en existe qu'une
 * seule, ici, pour qu'aucune dérive ne soit possible entre « la page est
 * indexable » et « la page porte un balisage ». Les deux vont ensemble ou pas
 * du tout : un balisage sans indexation ne sert à rien, une indexation sans
 * balisage laisse passer le seul bénéfice réel.
 */
export const INDEXER_PAGES_OFFRES = false;

/** La monnaie d'une offre d'après son pays. Défaut : l'euro.
 *  Copie VOLONTAIRE de `DEVISE_PAR_PAYS` (public/app.js) — vérifiée par test. */
export const DEVISE_PAR_PAYS = {
  GB: { code: 'GBP', symbole: '£' },
  SE: { code: 'SEK', symbole: 'kr' },
  PL: { code: 'PLN', symbole: 'zł' },
};
export const DEVISE_EURO = { code: 'EUR', symbole: '€' };

/**
 * LA REMISE MONTRABLE — copie VOLONTAIRE de la règle du site (public/app.js).
 *
 * Pourquoi elle est ici, et pas seulement là-bas : les pages de rubrique
 * affichent, elles aussi, des remises et des pourcentages. Sans cette règle,
 * elles annonçaient « −99 % » là où l'application refuse d'afficher le
 * pourcentage — un faux chiffre, sur une page dont c'est justement le sujet.
 *
 * La règle, dans les mots du projet (app.js) : au-delà de 90 %, ce n'est plus
 * une remise, c'est une qualité qu'on annonce (« 99 % sRGB » a déjà produit une
 * fausse remise de 99 %). Une remise CALCULÉE par nos soins échappe à la borne :
 * elle ne vient pas d'une phrase du marchand. Un test relit app.js et échoue si
 * les deux règles divergent.
 */
export const REMISE_ANNONCEE_MAX = 90;

/** La remise qu'on peut MONTRER, ou `null`. Même règle que `remiseMontrable`
 *  d'app.js : le pourcentage n'est montré que s'il est calculé, ou ≤ 90 %. */
export function remiseMontrable(o) {
  const r = Number(o && o.remise);
  if (!isFinite(r) || r <= 0) return null;
  return (o.remiseCalculee || r <= REMISE_ANNONCEE_MAX) ? r : null;
}

/** Le code ISO 4217 d'une offre. Jamais converti : on rend SA monnaie. */
export function codeDevise(offre) {
  return (offre && DEVISE_PAR_PAYS[offre.pays] ? DEVISE_PAR_PAYS[offre.pays].code : DEVISE_EURO.code);
}

/** Une adresse absolue à partir d'un chemin du site (« img/x.jpg » → URL). */
export function absolue(chemin) {
  if (!chemin) return null;
  if (/^https?:\/\//i.test(chemin)) return chemin;
  return ORIGINE + '/' + String(chemin).replace(/^\/+/, '');
}

/** La page Kazendra qui décrit cette offre — celle que le balisage référence.
 *  C'est une VRAIE page, écrite par outils/pages-partage.mjs, pas une adresse
 *  inventée : un balisage qui pointe vers du 404 est pire que pas de balisage. */
export function urlPageOffre(offre) {
  return offre && offre.id ? `${ORIGINE}/o/${offre.id}.html` : null;
}

/* ------------------------------------------------------------------ Product */

/**
 * Le balisage d'UNE offre. Rend `null` quand il n'y a rien d'honnête à dire —
 * c'est-à-dire sans titre ou sans prix. Un prix absent n'est pas « 0 ».
 */
export function baliseOffre(offre, { description = null } = {}) {
  if (!offre || !offre.titre) return null;
  const prix = typeof offre.prix === 'number' && isFinite(offre.prix) ? offre.prix : null;
  if (prix === null) return null;

  const devise = codeDevise(offre);
  const url = urlPageOffre(offre);
  const img = absolue(offre.image);

  const bloc = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: String(offre.titre).slice(0, 300),
    offers: {
      '@type': 'Offer',
      price: arrondi(prix),
      priceCurrency: devise,
      // `seller` n'est posé que si le marchand est NOMMÉ : un vendeur vide
      // ferait échouer la validation, un vendeur inventé serait un mensonge.
      ...(offre.marchand ? { seller: { '@type': 'Organization', name: String(offre.marchand) } } : {}),
    },
  };
  if (url) bloc.offers.url = url;
  if (url) bloc.url = url;
  if (img) bloc.image = [img];
  if (description) bloc.description = String(description).slice(0, 500);

  // Le prix de référence — SEULEMENT s'il existe. C'est lui qui distingue un
  // vrai bon plan d'un prix nu, et c'est la règle des DEUX PRIX du projet.
  const avant = typeof offre.prixAvant === 'number' && isFinite(offre.prixAvant) && offre.prixAvant > prix
    ? offre.prixAvant : null;
  if (avant !== null) {
    // `ListPrice` est le type attendu par schema.org pour « prix de référence ».
    // On l'exprime par `priceType`, qui est la forme que Google documente.
    //
    // PAS de `valueAddedTaxIncluded` : le site n'affiche nulle part si son prix
    // est TTC ou HT. Choix de forme retiré, comme `availability`.
    bloc.offers.priceSpecification = {
      '@type': 'UnitPriceSpecification',
      price: arrondi(avant),
      priceCurrency: devise,
      priceType: 'https://schema.org/ListPrice',
    };
  }
  return bloc;
}

/** Deux décimales, sans zéro inutile : 63.99 → 63.99, 94 → 94. */
function arrondi(v) {
  return Math.round(v * 100) / 100;
}

/* ----------------------------------------------------------------- ItemList */

/**
 * Le balisage d'une LISTE d'offres — ce que porte une page de rubrique.
 * `ItemList` + `Product` imbriqués : c'est la forme attendue pour une page de
 * catégorie, et elle ne prétend PAS être une page produit (elle n'en est pas une).
 */
export function baliseListe(offres, { titre, url, langue = 'fr', max = 30 } = {}) {
  const gardees = (offres || []).slice(0, max);
  const elements = [];
  gardees.forEach((o) => {
    const p = baliseOffre(o);
    if (!p) return;
    // Le `@context` est porté UNE fois, par le graph qui englobe tout : le
    // répéter dans chaque produit n'apporte rien et fait douter de la validité
    // du document. On le retire donc de l'élément imbriqué.
    const { '@context': _c, ...corps } = p;
    elements.push({ '@type': 'ListItem', position: elements.length + 1, item: corps });
  });
  if (!elements.length) return null;
  const bloc = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: titre,
    numberOfItems: elements.length,
    itemListOrder: 'https://schema.org/DescendingOrder',
    inLanguage: langue,
    itemListElement: elements,
  };
  if (url) bloc.url = url;
  return bloc;
}

/* -------------------------------------------------------------- Fil d'Ariane */

/** Accueil → rubrique. Deux niveaux, parce qu'il n'y en a que deux. */
export function baliseFilAriane({ rubrique, urlRubrique, langue = 'fr', nomAccueil = 'Kazendra' }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: nomAccueil, item: ORIGINE + '/' },
      { '@type': 'ListItem', position: 2, name: rubrique, item: urlRubrique },
    ],
  };
}

/* ---------------------------------------------------------------- Sérialisation */

/** Le texte EXACT à insérer dans une page. Indenté pour rester lisible à l'œil.
 *
 *  Plusieurs blocs sont réunis sous un seul `@graph` et leur `@context` propre
 *  est retiré : le répéter dans chaque nœud est valide mais inutile, et un
 *  `@context` deux fois dans la même page est exactement le genre de détail
 *  qu'un lecteur pressé prend pour une erreur. */
export function scriptJSONLD(blocs) {
  const liste = (Array.isArray(blocs) ? blocs : [blocs]).filter(Boolean);
  if (!liste.length) return '';
  const objet = liste.length === 1
    ? liste[0]
    : { '@context': 'https://schema.org', '@graph': liste.map(({ '@context': _c, ...reste }) => reste) };
  // `JSON.stringify` n'échappe NI `<` NI `>` : un titre d'offre contenant
  // « </script> » refermerait la balise et le reste du titre deviendrait du
  // HTML interprété par le navigateur. Défaut trouvé par une épreuve le
  // 10/10/2026, pas en le relisant. On écrit donc les trois caractères en
  // séquences d'échappement JSON — le document reste du JSON parfaitement
  // valide, et plus rien ne peut sortir de la balise.
  const texte = JSON.stringify(objet, null, 2)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return '<script type="application/ld+json">\n' + texte + '\n</script>';
}

/** Échappe ce qui doit l'être dans du texte HTML (titres d'offres compris). */
export function echapper(texte) {
  return String(texte == null ? '' : texte)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lit la table des devises TELLE QU'ELLE EST dans public/app.js.
 *  Utilisé par les tests pour prouver qu'il n'y a pas deux tables qui divergent. */
export function tableDevisesDuSite() {
  const src = readFileSync(join(RACINE_PROJET, 'public', 'app.js'), 'utf8');
  const bloc = (src.match(/const DEVISE_PAR_PAYS = \{([\s\S]*?)\};/) || [])[1];
  if (!bloc) throw new Error('DEVISE_PAR_PAYS introuvable dans public/app.js');
  const table = {};
  for (const m of bloc.matchAll(/([A-Z]{2}):\s*\{\s*code:\s*'([A-Z]{3})'/g)) {
    table[m[1]] = { code: m[2] };
  }
  return table;
}
