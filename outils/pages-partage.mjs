#!/usr/bin/env node
/**
 * LES PAGES DE PARTAGE — une page par offre, pour que chaque partage porte Kazendra.
 * =================================================================================
 *
 * DEMANDE DE B (09/10/2026) : « Quand on fait un partage, actuellement ça affiche
 * directement le lien Amazon par exemple, mais il n'y a pas de trace de Kazendra.
 * Donc pas de publicité pour nous gratuite... Quelle solution peux-tu trouver ? »
 * — puis : « Oui tu peux partir sur la version par offre avec repli générique
 * quand l'offre n'a pas d'image. »
 *
 * LE PROBLÈME, MESURÉ. Le bouton de partage (sous l'étoile des favoris) envoyait
 * le lien du MARCHAND. La commission n'était pas perdue — le lien porte notre
 * identifiant — mais la marque l'était : dans WhatsApp, l'ami voyait une carte
 * Amazon, jamais Kazendra.
 *
 * LA SOLUTION. On partage une adresse à nous : https://kazendra.com/o/<id>.html
 * Chaque page porte, dans son HTML, les balises Open Graph que le robot de
 * prévisualisation lit — titre de l'offre, prix, marchand, et l'image du produit.
 * Résultat : une carte KAZENDRA dans la conversation, avec le bon plan dedans.
 * Le visiteur arrive chez nous d'abord, puis part chez le marchand par un bouton
 * qui mène au MÊME lien affilié qu'avant : rien n'est perdu.
 *
 * POURQUOI DES FICHIERS STATIQUES, ET PAS UNE PAGE QUI LIT ?id=. Les robots de
 * WhatsApp, Messenger, Signal, Telegram et LinkedIn NE FONT PAS tourner de
 * JavaScript : ils lisent le HTML brut. Une page qui remplirait ses balises en
 * JS afficherait une carte vide. Les balises doivent donc être ÉCRITES.
 *
 * POURQUOI PAS DE REDIRECTION AUTOMATIQUE. Un `<meta refresh>` serait suivi par
 * certains robots, qui afficheraient alors la carte DU MARCHAND : on perdrait
 * exactement ce qu'on vient chercher. On montre la page, avec un vrai bouton.
 *
 * POURQUOI UNE PAGE PAR OFFRE EST TENABLE. Le catalogue porte ~16 000 offres.
 * Chaque page pèse ~1,5 Ko, et on n'écrit QUE ce qui change : une offre qui ne
 * bouge pas garde son fichier, donc git ne stocke aucun octet de plus (git range
 * par contenu). Seules les offres nouvelles ou modifiées créent des objets.
 * Les pages orphelines (offre disparue du catalogue) sont SUPPRIMÉES : le dossier
 * ne grandit pas indéfiniment.
 *
 * CE QUE CE FICHIER EMPRUNTE, ET IL N'EN RECOPIE AUCUNE RÈGLE :
 *   - `lienAffilie()` vient de public/affiliation.js — le lien du bouton est
 *     EXACTEMENT celui de l'application ;
 *   - `deviseDe()` et `montant()` sont EXTRAITS de public/app.js (le code livré,
 *     par la même découpe que tests/devise-affichage.test.mjs) : un prix suédois
 *     s'écrit en couronnes ici comme dans l'application, sans deuxième règle ;
 *   - les libellés viennent de public/langues.js, dans la langue DU MARCHÉ.
 *
 * LANCEMENT (à la main) : node outils/pages-partage.mjs
 * APPEL NORMAL : depuis collecteur.mjs --publier, où le catalogue est déjà écrit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lienAffilie } from '../public/affiliation.js';
import { LANGUES } from '../public/langues.js';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOSSIER_PUBLIE = path.join(RACINE, 'docs');
const SORTIE = path.join(DOSSIER_PUBLIE, 'o');

/** L'adresse PUBLIQUE du site. C'est elle qu'on met dans un partage : un lien
 *  partagé doit marcher chez celui qui le reçoit, donc pointer sur le site
 *  public, jamais sur l'adresse locale du hub. */
export const SITE = 'https://kazendra.com';

/** La carte générique — sert pour l'accueil, et pour les offres SANS visuel.
 *  Un repli générique vaut mieux qu'une carte vide : une carte sans image
 *  s'affiche comme un simple lien, c'est-à-dire sans marque. */
export const IMAGE_GENERIQUE = `${SITE}/carte-kazendra.png`;

/** LA LANGUE DE LA PAGE SUIT LE MARCHÉ DE L'OFFRE. Les libellés viennent du
 *  dictionnaire de l'application (aucune traduction nouvelle) : l'AMI qui reçoit
 *  le lien lit « Bei AMSO ansehen » sur une offre allemande, « View at Loaded »
 *  sur une offre britannique. La Belgique est en français : c'est la langue de
 *  référence du projet. */
const LANGUE_DU_MARCHE = {
  BE: 'fr', FR: 'fr', DE: 'de', AT: 'de', GB: 'en',
  NL: 'nl', ES: 'es', IT: 'it', PT: 'pt', PL: 'pl', SE: 'sv',
};

/** Les deux clés du dictionnaire qu'on réutilise — elles existent DÉJÀ dans
 *  l'application : le bouton du marchand dit exactement la même chose. */
const CLE_BOUTON = 'Voir chez {n}';
const CLE_TOUT = 'Voir toutes les offres';

let devises = null;
/**
 * `deviseDe` et `montant` : LE CODE LIVRÉ, jamais une recopie.
 *
 * On découpe littéralement le bloc du formateur dans public/app.js et on
 * l'évalue. C'est la découpe qu'utilise déjà tests/devise-affichage.test.mjs —
 * deux programmes qui se partagent la règle des devises, et une seule écriture.
 * Recopier la règle ici ferait diverger les prix du site et ceux des cartes
 * partagées, et personne ne comparerait jamais les deux.
 */
export async function chargesDevises() {
  if (devises) return devises;
  const app = fs.readFileSync(path.join(RACINE, 'public', 'app.js'), 'utf8');
  const debut = app.indexOf('const DEVISE_PAR_PAYS = {');
  const fin = app.indexOf('function ilYA(');
  if (debut < 0 || fin <= debut) {
    throw new Error('formateur de devise introuvable dans public/app.js — le fichier a changé de forme');
  }
  const source = app.slice(debut, fin) + '\nexport { DEVISE_PAR_PAYS, DEVISE_EURO, deviseDe, montant };';
  devises = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  return devises;
}

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Une valeur qui va dans un ATTRIBUT : les retours à la ligne d'un titre de
 *  marchand y casseraient la balise. */
const attr = (v) => esc(String(v == null ? '' : v).replace(/\s+/g, ' ').trim());

const libelle = (langue, cle, remplacements = {}) => {
  const table = (LANGUES[langue] && LANGUES[langue].textes) || {};
  const brut = table[cle] || LANGUES.fr.textes[cle] || cle;
  return Object.entries(remplacements).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), brut);
};

/** L'adresse ABSOLUE du visuel d'une offre, ou la carte générique.
 *  `o.image` est écrite par le collecteur sous deux formes : « img/<empreinte>.jpg »
 *  une fois le fichier rapatrié chez nous, ou l'adresse d'origine du marchand si
 *  le rapatriement n'a pas eu lieu. Un partage doit marcher dans les deux cas. */
export function imageDeLOffre(o) {
  const img = String((o && o.image) || '').trim();
  if (!img) return IMAGE_GENERIQUE;
  if (/^https?:\/\//i.test(img)) return img;
  return `${SITE}/${img.replace(/^\.?\//, '')}`;
}

/** Ce que le robot affiche sous le titre : le prix, la boutique, la remise.
 *  Volontairement SANS phrase française : ces trois informations se lisent dans
 *  toutes les langues, et le titre de l'offre est déjà dans celle du marchand. */
export function descriptionDeLOffre(o, prix) {
  const morceaux = [];
  if (prix) morceaux.push(prix);
  if (o.marchand) morceaux.push(String(o.marchand).trim());
  if (o.remise != null && o.remise !== '' && Number(o.remise) > 0) morceaux.push(`−${o.remise} %`);
  morceaux.push('Kazendra');
  return morceaux.join(' · ');
}

/** La page d'UNE offre. Tout ce qui peut être cliqué mène soit au marchand
 *  (le MÊME lien affilié que l'application), soit au site. */
export function pageDeLOffre(o, outils) {
  const { deviseDe, montant } = outils;
  const langue = LANGUE_DU_MARCHE[o.pays] || 'fr';
  const titre = String(o.titre || '').trim() || 'Bon plan';
  const url = `${SITE}/o/${encodeURIComponent(o.id)}.html`;
  const lien = lienAffilie(o.lienMarchand || o.lienPage, o.marchand || '', langue);
  const image = imageDeLOffre(o);
  const imageVue = /^https?:\/\//i.test(image) && image.startsWith(SITE)
    ? image.slice(SITE.length)
    : image;
  const prix = o.prix != null && o.prix !== '' ? montant(o.prix, deviseDe(o)) : '';
  const avant = o.prixAvant != null && o.prixAvant !== '' ? montant(o.prixAvant, deviseDe(o)) : '';
  const description = descriptionDeLOffre(o, prix);
  const boutique = String(o.marchand || '').trim();

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)} — Kazendra</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(url)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Kazendra">
<meta property="og:locale" content="${attr(langue)}">
<meta property="og:title" content="${attr(titre)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:image" content="${attr(image)}">
${image === IMAGE_GENERIQUE ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' : ''}<meta name="twitter:card" content="summary_large_image">
<style>
@font-face{font-family:Montserrat;font-weight:800;src:url(/fonts/montserrat-latin.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Open Sans";font-weight:400;src:url(/fonts/opensans-latin.woff2) format("woff2");font-display:swap}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f6f8fa;color:#16232e;font:16px/1.5 "Open Sans",system-ui,-apple-system,sans-serif;
min-height:100vh;display:flex;flex-direction:column}
header{padding:14px 18px;background:#0d3b5b}
header a{display:flex;align-items:center;gap:10px;text-decoration:none}
header img{width:26px;height:31px}
header b{font:800 17px Montserrat,system-ui,sans-serif;color:#fff;letter-spacing:.6px}
main{flex:1;width:100%;max-width:660px;margin:0 auto;padding:22px 18px 40px}
.v{width:100%;display:block;border-radius:12px;background:#fff;margin-bottom:18px}
h1{font:800 21px/1.3 Montserrat,system-ui,sans-serif;margin-bottom:12px}
.prix{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
.prix b{font:800 27px Montserrat,system-ui,sans-serif;color:#0d3b5b}
.prix s{color:#7b8a99;font-size:17px}
.chez{color:#5a6b7a;margin-bottom:22px}
.btn{display:block;text-align:center;background:#EB912D;color:#2b1a05;text-decoration:none;
font:800 18px Montserrat,system-ui,sans-serif;padding:16px;border-radius:12px}
.btn:hover{filter:brightness(1.06)}
footer{padding:18px;text-align:center;border-top:1px solid #e3e9ee;background:#fff}
footer a{color:#0d3b5b;font-weight:600}
</style>
</head>
<body>
<header><a href="/"><img src="/favicon.svg" alt="" width="26" height="31"><b>KAZENDRA</b></a></header>
<main>
<img class="v" src="${attr(imageVue)}" alt="${attr(titre)}" width="660" height="330" loading="eager">
<h1>${esc(titre)}</h1>
<div class="prix">${prix ? `<b>${esc(prix)}</b>` : ''}${avant ? `<s>${esc(avant)}</s>` : ''}</div>
${boutique ? `<p class="chez">${esc(boutique)}</p>` : ''}
<a class="btn" href="${attr(lien)}" rel="nofollow sponsored noopener">${esc(libelle(langue, CLE_BOUTON, { n: boutique || 'la boutique' }))}</a>
</main>
<footer><a href="/">${esc(libelle(langue, CLE_TOUT))}</a></footer>
</body>
</html>
`;
}

/**
 * Écrit les pages du catalogue donné. Rend un compte rendu honnête :
 * combien d'écrites, combien d'inchangées (donc zéro octet ajouté), combien
 * de retirées.
 *
 * `offres` : la liste publiée — on lui passe `sortie.offres` depuis le
 * collecteur, pour que les pages décrivent EXACTEMENT le catalogue publié.
 */
export async function ecrirePagesPartage(offres, { silencieux = false } = {}) {
  const outils = await chargesDevises();
  fs.mkdirSync(SORTIE, { recursive: true });

  let ecrites = 0, inchangees = 0, sansLien = 0, sansImage = 0;
  const connus = new Set();
  for (const o of offres || []) {
    if (!o || !o.id) continue;
    if (!(o.lienMarchand || o.lienPage)) { sansLien += 1; continue; }
    if (!o.image) sansImage += 1;
    const nom = `${o.id}.html`;
    connus.add(nom);
    const html = pageDeLOffre(o, outils);
    const dest = path.join(SORTIE, nom);
    let ancien = null;
    try { ancien = fs.readFileSync(dest, 'utf8'); } catch { /* page neuve */ }
    if (ancien === html) { inchangees += 1; continue; }
    fs.writeFileSync(dest, html);
    ecrites += 1;
  }

  // LES ORPHELINES SE RETIRENT. Une offre qui sort du catalogue laisserait une
  // page qui parle d'un bon plan qui n'existe plus, et qui n'est plus reliée à
  // rien : sans ménage, le dossier grandirait indéfiniment.
  let retirees = 0;
  for (const f of fs.readdirSync(SORTIE)) {
    if (!f.endsWith('.html') || connus.has(f)) continue;
    fs.unlinkSync(path.join(SORTIE, f));
    retirees += 1;
  }

  if (!silencieux) {
    console.log(`Pages de partage : ${ecrites} écrite(s), ${inchangees} inchangée(s), `
      + `${retirees} retirée(s) — ${connus.size} au total dans docs/o/`);
    if (sansLien) console.log(`  ${sansLien} offre(s) sans lien sortant : aucune page (un partage doit mener quelque part)`);
    if (sansImage) console.log(`  ${sansImage} offre(s) sans visuel : elles reçoivent la carte générique`);
  }
  return { ecrites, inchangees, retirees, total: connus.size };
}

/** Le lancement à la main lit le catalogue PUBLIÉ — celui que le site sert. */
async function main() {
  const fichier = path.join(DOSSIER_PUBLIE, 'offres.json');
  const source = fs.existsSync(fichier) ? fichier : path.join(RACINE, 'data', 'offres.json');
  const d = JSON.parse(fs.readFileSync(source, 'utf8'));
  const offres = Array.isArray(d) ? d : d.offres || [];
  console.log(`Catalogue lu : ${path.relative(RACINE, source)} (${offres.length} offres)`);
  await ecrirePagesPartage(offres);
}

if (process.argv[1] && process.argv[1].endsWith('pages-partage.mjs')) {
  main().catch((e) => { console.error('✗ pages-partage :', e.message); process.exit(1); });
}
