#!/usr/bin/env node
/**
 * LES PAGES ÉDITORIALES PAR RUBRIQUE — application n°2 « Promos ».
 * =============================================================================
 *
 * POURQUOI CES PAGES EXISTENT, ET PAS DU BALISAGE SUR LES PAGES D'OFFRES
 *
 * Mesuré le 09/10/2026, reconfirmé le 10/10 : les **17 045** pages
 * `docs/o/<id>.html` portent toutes `<meta name="robots" content="noindex,
 * follow">`. Elles republient les titres, les photos et les prix **des
 * marchands** ; les indexer en masse serait publier 17 000 pages de contenu
 * recopié, dont le contenu principal change tous les jours. Le `noindex` est un
 * choix, et il tient.
 *
 * Or Google n'accepte un résultat enrichi « produit » que sur une page
 * consacrée à UN SEUL produit, et rappelle que ce n'est **pas** un facteur de
 * classement. Conclusion mesurée : le levier réel n'est pas le balisage, c'est
 * du **contenu propre indexable**. C'est exactement ce que fabrique ce fichier.
 *
 * CE QU'UNE PAGE DE RUBRIQUE CONTIENT
 *
 *   - un titre et une phrase d'introduction **rédigés** par rubrique et par
 *     langue (pas générés mot à mot) ;
 *   - des **chiffres réels** tirés du catalogue publié : nombre d'offres
 *     suivies, nombre de boutiques, meilleure remise du moment ;
 *   - les 24 meilleures remises du moment, avec leur prix réel, leur prix de
 *     référence quand il existe, la boutique, et un lien vers la page Kazendra
 *     de l'offre ;
 *   - un balisage `ItemList` + `Product` + `BreadcrumbList` (outils/
 *     donnees-structurees.mjs — aucune règle de balisage n'est recopiée ici) ;
 *   - `hreflang` entre les trois langues, comme les pages légales : sans lui,
 *     les trois versions se disputeraient la même place et se dilueraient.
 *
 * CE QU'ELLE NE CONTIENT PAS, VOLONTAIREMENT
 *
 *   - **Pas de page « Autres ».** C'est le fourre-tout de ce que rien ne nomme :
 *     une page « promotions autres » n'apprend rien à un lecteur et rien à un
 *     moteur. L'exclure est une décision, elle est écrite ici pour qu'on ne la
 *     prenne pas un jour pour un oubli.
 *   - **Pas de page par pays.** Douze pays × quinze rubriques = 180 pages dont
 *     beaucoup seraient vides, et c'est précisément ce que la page d'accueil
 *     fait déjà (le pays est une préférence, pas une adresse). Chaque ligne de
 *     la liste indique donc le pays et la monnaie de SON marché.
 *   - **Aucun chiffre inventé** : les remises viennent du catalogue, les prix
 *     aussi, et une ligne sans prix n'est pas listée.
 *
 * OÙ C'EST ÉCRIT. Dans `docs/rubriques/` — le dossier PUBLIÉ, comme les pages de
 * partage, et jamais dans `public/` : ces pages dépendent du catalogue, elles
 * sont donc refaites à chaque collecte par `publier()` (collecteur.mjs).
 *
 * Lancement à la main : node outils/pages-rubriques.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANGUES } from '../public/langues.js';
import { baliseListe, baliseFilAriane, scriptJSONLD, echapper, remiseMontrable } from './donnees-structurees.mjs';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOSSIER_PUBLIE = path.join(RACINE, 'docs');
const SORTIE = path.join(DOSSIER_PUBLIE, 'rubriques');
const SITE = 'https://kazendra.com';

/** Le nombre d'offres listées sur une page. Au-delà, la page devient un
 *  annuaire : elle se charge lentement et n'apporte rien de plus au lecteur. */
export const MAX_OFFRES = 24;

/** Sous ce nombre d'offres, la page n'est pas créée. Une page de rubrique
 *  presque vide donne une mauvaise image ET un mauvais signal au moteur. */
export const SEUIL = 20;

/** Les rubriques qui n'ont pas de page, et la raison — écrite, pas devinée. */
const SANS_PAGE = { autre: 'fourre-tout : ni un sujet de recherche, ni une rubrique présentable' };

export const LANGUES_PAGES = ['fr', 'nl', 'en'];

/** Le texte de la page, RÉDIGÉ par langue. Le français sert de référence ;
 *  nl et en suivent le même plan, section par section. */
const TEXTES = {
  fr: {
    titre: (r) => `${r} — les meilleures promotions du moment`,
    h1: (r) => `Les meilleures promotions ${r}`,
    intro: (r, s) => `Kazendra rassemble les promotions de ${s.boutiques} boutiques en Europe dans la rubrique ${r}. `
      + `Aujourd'hui, ${s.total} offres y sont suivies, et la plus forte remise atteint ${s.remiseMax} %. `
      + `Les offres ci-dessous sont classées par remise décroissante. Chacune affiche son prix réel, dans la monnaie de son pays : `
      + `nous ne convertissons pas les prix, et nous n'affichons pas une remise que le marchand ne donne pas.`,
    stats: (s) => `${s.total} offres suivies · ${s.boutiques} boutiques · meilleure remise : ${s.remiseMax} %`,
    chez: (m) => `chez ${m}`,
    suite: 'Voir toutes les promos sur Kazendra',
    nonVendeur: 'Kazendra n’est pas un vendeur : chaque lien mène à la boutique, qui seule vend l’article.',
    majle: (d) => `Rubrique mise à jour le ${d}.`,
    accueil: 'Accueil',
  },
  nl: {
    titre: (r) => `${r} — de beste promoties van dit moment`,
    h1: (r) => `De beste promoties ${r}`,
    intro: (r, s) => `Kazendra verzamelt de promoties van ${s.boutiques} winkels in Europa in de rubriek ${r}. `
      + `Vandaag worden er ${s.total} aanbiedingen gevolgd, en de hoogste korting is ${s.remiseMax} %. `
      + `De aanbiedingen hieronder staan op korting, hoog naar laag. Elk toont zijn echte prijs, in de munt van zijn land: `
      + `wij rekenen prijzen niet om, en tonen geen korting die de winkel niet geeft.`,
    stats: (s) => `${s.total} aanbiedingen · ${s.boutiques} winkels · hoogste korting: ${s.remiseMax} %`,
    chez: (m) => `bij ${m}`,
    suite: 'Alle promoties bekijken op Kazendra',
    nonVendeur: 'Kazendra is geen verkoper: elke link gaat naar de winkel, die als enige het artikel verkoopt.',
    majle: (d) => `Rubriek bijgewerkt op ${d}.`,
    accueil: 'Start',
  },
  en: {
    titre: (r) => `${r} — the best deals right now`,
    h1: (r) => `The best ${r} deals`,
    intro: (r, s) => `Kazendra gathers deals from ${s.boutiques} shops across Europe in the ${r} category. `
      + `Today ${s.total} offers are being tracked there, and the biggest discount is ${s.remiseMax}%. `
      + `The offers below are sorted by discount, highest first. Each shows its real price, in its own country's currency: `
      + `we do not convert prices, and we do not show a discount the shop does not state.`,
    stats: (s) => `${s.total} offers tracked · ${s.boutiques} shops · biggest discount: ${s.remiseMax}%`,
    chez: (m) => `at ${m}`,
    suite: 'See all deals on Kazendra',
    nonVendeur: 'Kazendra is not the seller: every link leads to the shop, which alone sells the item.',
    majle: (d) => `Category updated on ${d}.`,
    accueil: 'Home',
  },
};

/** Le CSS de la page — écrit ici, en ligne, comme sur les pages d'offres : une
 *  feuille externe a déjà été coupée en chemin par un antivirus (08/10/2026). */
const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f6f8fa;color:#16232e;font:16px/1.55 "Open Sans",system-ui,-apple-system,sans-serif}
header{padding:14px 18px;background:#0d3b5b}
header a{display:flex;align-items:center;gap:10px;text-decoration:none}
header img{width:26px;height:31px}
header b{font:800 17px Montserrat,system-ui,sans-serif;color:#fff;letter-spacing:.6px}
main{max-width:900px;margin:0 auto;padding:24px 18px 40px}
.fil{font-size:14px;color:#5a6b7a;margin-bottom:14px}
.fil a{color:#0d3b5b;text-decoration:none}
h1{font:800 27px/1.25 Montserrat,system-ui,sans-serif;color:#0d3b5b;margin-bottom:12px}
.intro{max-width:64ch;color:#2c3b48;margin-bottom:10px}
.stats{display:inline-block;background:#fff;border:1px solid #e3e9ee;border-radius:999px;
padding:7px 16px;font-size:14px;color:#0d3b5b;font-weight:600;margin-bottom:22px}
ul{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
li{background:#fff;border:1px solid #e3e9ee;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
li a{text-decoration:none;color:inherit;display:flex;flex-direction:column;height:100%}
.vignette{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1;background:#fff;padding:8px}
/* L'image du visuel ne décide pas de la hauteur de la carte : une offre sans
   photo doit donner une carte de MÊME hauteur que les autres, sinon la grille
   se décale — défaut constaté le 10/10/2026 sur la première page produite. */
.vignette img{max-width:100%;max-height:100%;object-fit:contain}
.corps{padding:10px 12px 14px;display:flex;flex-direction:column;gap:6px;flex:1}
.titre{font-size:14px;line-height:1.35;color:#16232e;display:-webkit-box;-webkit-line-clamp:3;
-webkit-box-orient:vertical;overflow:hidden}
.prix{display:flex;align-items:baseline;gap:8px;margin-top:auto}
.prix b{font:800 18px Montserrat,system-ui,sans-serif;color:#0d3b5b}
.prix s{color:#7b8a99;font-size:13px}
.remise{align-self:flex-start;background:#EB912D;color:#2b1a05;font-weight:800;font-size:12px;
padding:2px 8px;border-radius:999px}
.chez{font-size:12px;color:#5a6b7a}
footer{border-top:1px solid #e3e9ee;background:#fff;padding:20px 18px;text-align:center;font-size:13px;color:#5a6b7a}
footer a{color:#0d3b5b;font-weight:600}
.nonvendeur{max-width:64ch;margin:18px auto 0;font-size:13px;color:#5a6b7a}
`;

/* ----------------------------------------------------------------- lecture */

/** Les catégories et leur ordre, lus dans public/app.js — PAS recopiés : deux
 *  listes qui divergent afficheraient un onglet que les pages ne connaissent pas.
 */
export function categoriesDuSite() {
  const src = fs.readFileSync(path.join(RACINE, 'public', 'app.js'), 'utf8');
  const blocNoms = (src.match(/const NOMS_CATEGORIES = \{([\s\S]*?)\};/) || [])[1];
  const blocOrdre = (src.match(/const ORDRE_CATEGORIES = \[([^\]]*)\];/) || [])[1];
  if (!blocNoms || !blocOrdre) throw new Error('NOMS_CATEGORIES ou ORDRE_CATEGORIES introuvable dans public/app.js');
  const noms = {};
  for (const m of blocNoms.matchAll(/([a-z]+):\s*'([^']+)'/g)) noms[m[1]] = m[2];
  const ordre = blocOrdre.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  return { noms, ordre };
}

/** Le libellé d'une rubrique dans une langue, lu dans le dictionnaire du site. */
export function nomRubrique(cle, langue, noms) {
  const fr = noms[cle] || cle;
  const table = (LANGUES[langue] && LANGUES[langue].textes) || {};
  return table[fr] || fr;
}

/* ------------------------------------------------------------------ rendu */

/** Le nombre d'offres d'un MÊME marchand tolérées dans une page.
 *
 *  Défaut constaté le 10/10/2026, en regardant la première page produite : la
 *  rubrique High-tech n'affichait QUE six caméras Blink, six fois le même
 *  produit vendu sur six marchés différents. Un tri par remise pure produit
 *  toujours cet effet, parce que le même article est mis en avant partout au
 *  même moment. Une page dont les six premières lignes sont le même objet
 *  n'apprend rien au lecteur — et n'a rien à indexer d'utile.
 *
 *  On borne donc par marchand, sans jamais inventer ni écarter une offre : les
 *  autres restent disponibles, simplement plus bas si la page est longue. */
export const MAX_PAR_MARCHAND = 2;

/** Les offres d'une rubrique, prêtes à lister. Deux prix d'abord (ce sont les
 *  vrais bons plans), puis la remise décroissante, puis la diversité. */
export function offresDeLaRubrique(offres, cle, max = MAX_OFFRES) {
  const triees = (offres || [])
    .filter((o) => o && o.categorie === cle && typeof o.prix === 'number' && isFinite(o.prix) && o.prix > 0)
    .sort((a, b) => {
      const da = typeof a.prixAvant === 'number' && a.prixAvant > a.prix ? 1 : 0;
      const db = typeof b.prixAvant === 'number' && b.prixAvant > b.prix ? 1 : 0;
      if (da !== db) return db - da;
      // On trie sur la remise MONTRABLE, jamais sur la brute : une offre portant
      // « −99 % » dans son titre passerait sinon en tête d'une page dont c'est
      // précisément le sujet.
      const ra = remiseMontrable(a) || 0, rb = remiseMontrable(b) || 0;
      if (ra !== rb) return rb - ra;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

  // Premier passage : on borne par marchand. Second passage : si la page n'est
  // pas remplie, on reprend les offres écartées — la diversité ne doit jamais
  // appauvrir la page, seulement l'ordonner.
  const comptes = new Map();
  const premier = [], reste = [];
  for (const o of triees) {
    const m = String(o.marchand || '').trim() || '—';
    const n = comptes.get(m) || 0;
    comptes.set(m, n + 1);
    (n < MAX_PAR_MARCHAND ? premier : reste).push(o);
  }
  return premier.concat(reste).slice(0, max);
}

/** Les chiffres annoncés en tête de page — TOUS comptés, aucun estimé. */
export function chiffresDeLaRubrique(offres, cle) {
  const toutes = (offres || []).filter((o) => o && o.categorie === cle
    && typeof o.prix === 'number' && isFinite(o.prix) && o.prix > 0);
  const boutiques = new Set(toutes.map((o) => o.marchand).filter(Boolean));
  // `remiseMontrable` et non `Number(o.remise)` : la page n'annonce que les
  // remises que l'application accepte elle-même d'afficher.
  const remises = toutes.map((o) => remiseMontrable(o)).filter((r) => r != null);
  return {
    total: toutes.length,
    boutiques: boutiques.size,
    remiseMax: remises.length ? Math.max(...remises) : 0,
  };
}

/** Une ligne de la liste. La monnaie est déjà dans le texte du prix. */
function ligneCarte(o, { deviseDe, montant }, langue, textes) {
  const url = `${SITE}/o/${encodeURIComponent(o.id)}.html`;
  const prix = montant(o.prix, deviseDe(o));
  const avant = o.prixAvant != null && o.prixAvant > o.prix ? montant(o.prixAvant, deviseDe(o)) : '';
  const remiseBrute = remiseMontrable(o);
  const remise = remiseBrute ? `−${Math.round(remiseBrute)} %` : '';
  const chez = String(o.marchand || '').trim();
  const img = o.image
    ? `<img src="${echapper(o.image.startsWith('http') ? o.image : '/' + o.image)}" alt="${echapper(o.titre)}" loading="lazy" width="220" height="220">`
    : '';
  // Le cadre du visuel existe MÊME sans photo : toutes les cartes gardent la
  // même hauteur, et la grille reste alignée.
  return `<li><a href="${echapper(url)}">
<span class="vignette">${img}</span>
<span class="corps">
${remise ? `<span class="remise">${echapper(remise)}</span>` : ''}
<span class="titre">${echapper(o.titre)}</span>
<span class="prix"><b>${echapper(prix)}</b>${avant ? `<s>${echapper(avant)}</s>` : ''}</span>
${chez ? `<span class="chez">${echapper(textes.chez(chez))}</span>` : ''}
</span></a></li>`;
}

/** LA PAGE ENTIÈRE. `offres` = celles de la rubrique, déjà triées et bornées. */
export function pageDeRubrique(cle, langue, { noms, offres, chiffres, outils, dateMaj }) {
  const t = TEXTES[langue] || TEXTES.fr;
  const nom = nomRubrique(cle, langue, noms);
  const urlFr = `${SITE}/rubriques/${cle}.html`;
  const urlIci = langue === 'fr' ? urlFr : `${SITE}/rubriques/${cle}.${langue}.html`;
  const alternates = LANGUES_PAGES.map((l) => {
    const u = l === 'fr' ? urlFr : `${SITE}/rubriques/${cle}.${l}.html`;
    return `<link rel="alternate" hreflang="${l}" href="${u}">`;
  }).join('\n');

  const titre = t.titre(nom);
  const intro = t.intro(nom, chiffres);
  const etiquettes = { titre: nom, accueil: t.accueil };

  // Le balisage ne contient QUE ce qui est visible sur la page : la liste
  // affichée, et le fil d'Ariane affiché.
  const balisage = [
    baliseListe(offres, { titre: t.h1(nom), url: urlIci, langue, max: MAX_OFFRES }),
    baliseFilAriane({ rubrique: nom, urlRubrique: urlIci, langue, nomAccueil: 'Kazendra' }),
  ];

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)} — Kazendra</title>
<meta name="description" content="${echapper(intro).slice(0, 300)}">
<link rel="canonical" href="${urlIci}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${urlFr}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kazendra">
<meta property="og:locale" content="${langue}">
<meta property="og:title" content="${echapper(titre)}">
<meta property="og:description" content="${echapper(intro).slice(0, 200)}">
<meta property="og:url" content="${urlIci}">
<meta property="og:image" content="${SITE}/carte-kazendra.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${scriptJSONLD(balisage)}
<style>${STYLE}</style>
</head>
<body>
<header><a href="/"><img src="/favicon.svg" alt="" width="26" height="31"><b>KAZENDRA</b></a></header>
<main>
<p class="fil"><a href="/">${echapper(etiquettes.accueil)}</a> › ${echapper(nom)}</p>
<h1>${echapper(t.h1(nom))}</h1>
<p class="intro">${echapper(intro)}</p>
<p class="stats">${echapper(t.stats(chiffres))}</p>
<ul>
${offres.map((o) => ligneCarte(o, outils, langue, t)).join('\n')}
</ul>
<p class="nonvendeur">${echapper(t.nonVendeur)}</p>
</main>
<footer>
<p><a href="/">${echapper(t.suite)}</a></p>
<p>${echapper(t.majle(dateMaj))}</p>
</footer>
</body>
</html>
`;
}

/* -------------------------------------------------------------- écriture */

/** Écrit le plan de site PUBLIÉ : celui de public/ (accueil + 12 pages
 *  légales) augmenté des pages de rubrique. Le plan publié est celui que lisent
 *  les moteurs ; celui de public/ reste la référence du dépôt, et c'est lui que
 *  vérifie tests/legal.test.mjs.
 *  On part TOUJOURS du fichier de public/ : réécrire le plan de zéro ferait
 *  perdre l'accueil et les pages légales. */
export function ecrireSitemapPublie(urls, { date, vers = null }) {
  const base = fs.readFileSync(path.join(RACINE, 'public', 'sitemap.xml'), 'utf8');
  const connues = new Set([...base.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const ajouts = (urls || []).filter((u) => !connues.has(u));
  const bloc = ajouts.map((u) => `  <url>\n    <loc>${u}</loc>\n`
    + `    <lastmod>${date}</lastmod><changefreq>daily</changefreq><priority>0.6</priority>\n  </url>`).join('\n');
  const sortie = bloc ? base.replace(/<\/urlset>/, `${bloc}\n</urlset>`) : base;
  // `vers` sert aux épreuves : elles vérifient la fonction sans écrire dans le
  // dossier publié, qui est en train d'être servi (le cron de collecte y écrit
  // toutes les cinq minutes).
  const cible = vers || path.join(DOSSIER_PUBLIE, 'sitemap.xml');
  fs.writeFileSync(cible, sortie, 'utf8');
  return { total: connues.size + ajouts.length, ajouts: ajouts.length };
}

export async function ecrirePagesRubriques(offres, { silencieux = false } = {}) {
  const { deviseDe, montant } = await import('./pages-partage.mjs').then((m) => m.chargesDevises());
  const outils = { deviseDe, montant };
  const { noms, ordre } = categoriesDuSite();
  const date = new Date().toISOString().slice(0, 10);
  const dateMaj = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });

  fs.mkdirSync(SORTIE, { recursive: true });
  const attendus = new Set();
  const urls = [];
  let ecrites = 0, ignorees = 0;

  for (const cle of ordre) {
    if (SANS_PAGE[cle]) { ignorees++; continue; }
    const chiffres = chiffresDeLaRubrique(offres, cle);
    if (chiffres.total < SEUIL) { ignorees++; continue; }
    const liste = offresDeLaRubrique(offres, cle);
    if (!liste.length) { ignorees++; continue; }
    for (const langue of LANGUES_PAGES) {
      const nom = langue === 'fr' ? `${cle}.html` : `${cle}.${langue}.html`;
      attendus.add(nom);
      const html = pageDeRubrique(cle, langue, { noms, offres: liste, chiffres, outils, dateMaj });
      const dest = path.join(SORTIE, nom);
      const avant = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
      if (avant !== html) { fs.writeFileSync(dest, html, 'utf8'); ecrites++; }
      urls.push(`${SITE}/rubriques/${nom}`);
    }
  }

  // Ménage : une rubrique disparue ne doit pas laisser sa page derrière elle.
  let retirees = 0;
  for (const f of fs.existsSync(SORTIE) ? fs.readdirSync(SORTIE) : []) {
    if (!attendus.has(f)) { fs.unlinkSync(path.join(SORTIE, f)); retirees++; }
  }

  const sitemap = ecrireSitemapPublie(urls, { date });
  if (!silencieux) {
    console.log(`  → rubriques : ${ecrites} page(s) écrite(s), ${urls.length} au total, `
      + `${ignorees} rubrique(s) sans page, ${retirees} retirée(s) — plan de site publié : ${sitemap.total} adresses`);
  }
  return { ecrites, ecrites_total: urls.length, ignorees, retirees, sitemap };
}

/* ------------------------------------------------------------------ à la main */

async function main() {
  const fichier = path.join(DOSSIER_PUBLIE, 'offres.json');
  const source = fs.existsSync(fichier) ? fichier : path.join(RACINE, 'data', 'offres.json');
  const d = JSON.parse(fs.readFileSync(source, 'utf8'));
  const offres = Array.isArray(d) ? d : d.offres || [];
  const r = await ecrirePagesRubriques(offres, { silencieux: false });
  console.log(`  catalogue : ${offres.length} offres — ${r.ecrites_total} page(s) de rubrique publiée(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error('❌ pages de rubrique :', e.message); process.exit(1); });
}
