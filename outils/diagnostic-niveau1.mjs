#!/usr/bin/env node
/* =============================================================================
   DIAGNOSTIC DES 216 PAGES « NIVEAU 1 » — 11/10/2026

   Demande de B (11/10/2026) : « Tu peux régulariser le problème du travail de
   lecteur, le premier point que tu as proposé. »

   De quoi il s'agit. La vérification d'adresses du 09/10/2026 a classé les 573
   acteurs du marché :
     niveau 2  → la page rend des offres à DEUX PRIX (4 acteurs, seuls visités) ;
     niveau 1  → page de promotions reconnue mais ILLISIBLE (216 acteurs) ;
     niveau 0  → rien trouvé (353 acteurs).
   collecteur.mjs ne visite plus que le niveau 2 (décision de B du 10/10 :
   « ces sites-là ne doivent pas être mis à jour »). Les 216 attendent un
   « jour de meilleur lecteur », comme l'écrit l'en-tête du collecteur.

   CE QUE FAIT CE SCRIPT — il ne corrige rien, il MESURE, pour que le travail
   de lecteur se fasse là où il y a quelque chose à lire. Pour chacune des 216
   pages, une seule requête, et il répond à trois questions :

     1. La page répond-elle, et avec quel code ?
     2. Y a-t-il des PRIX dans le HTML SERVI (pas dans le navigateur) ?
        On compte les formes monétaires européennes (12,34 €) et on regarde
        s'il existe deux prix proches — la matière d'une promotion.
     3. Sinon, pourquoi : page construite en JavaScript (rien dans le HTML),
        données structurées (JSON-LD / microdonnées) sans prix, ou page
        franchement vide (accueil, mur d'âge, cookie wall, blocage) ?

   RÈGLE DU PROJET, tenue ici : un prix ne se DÉDUIT pas. Le script n'invente
   aucun pourcentage et ne retient aucune offre — il n'écrit que des comptes.
   Le HTML n'est conservé que pour les pages qui portent au moins un prix, et
   seulement pour permettre d'écrire le lecteur sans refaire les requêtes.

   Lancer :  node outils/diagnostic-niveau1.mjs
   Sortie  :  donnees/diagnostic-niveau1.json      (le détail)
              donnees/diagnostic-niveau1.txt       (le résumé lisible)
   ============================================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LISTE = join(RACINE, 'donnees', 'niveau1-a-retravailler.json');
const DOSSIER_HTML = join(RACINE, 'donnees', 'niveau1-html');
const SORTIE_JSON = join(RACINE, 'donnees', 'diagnostic-niveau1.json');
const SORTIE_TXT = join(RACINE, 'donnees', 'diagnostic-niveau1.txt');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const DELAI_MS = 900;          // entre deux requêtes : on ne martèle pas
const TIMEOUT_MS = 20000;
const TAILLE_MAX_HTML = 500 * 1024;

/** Les formes monétaires européennes, sans invention : 12,34 € · €12.34 · 12,34€. */
const FORME_PRIX = /(?:\d{1,3}(?:[.\u00a0 ]\d{3})*,\d{2}|\d+\.\d{2})\s*(?:€|EUR)|(?:€|EUR)\s*(?:\d{1,3}(?:[.\u00a0 ]\d{3})*,\d{2}|\d+\.\d{2})/g;
const PRIX_SANS_CENTIMES = /(?:^|[^\d,.])(\d{1,4})\s*(?:€|EUR)/g;

/** Un prix BARRÉ est la marque d'une promotion : <s>, <del>, <strike>, ou un
 *  style qui le raye. On ne le déduit pas du texte : on le lit dans le HTML. */
const BALISE_BARREE = /<(?:s|del|strike)[^>]*>\s*(?:[^<]{0,40}?)(?:\d+[.,]\d{2})\s*(?:€|EUR)?\s*<\/(?:s|del|strike)>/gi;
const STYLE_BARRE = /text-decoration\s*:\s*line-through/i;

function compter(texte, motif) {
  const m = texte.match(motif);
  return m ? m.length : 0;
}

/** Deux prix proches : la matière d'un rabais, à moins de 200 caractères. */
function deuxPrixProches(texte) {
  const positions = [];
  let m;
  const re = new RegExp(FORME_PRIX.source, 'g');
  while ((m = re.exec(texte)) !== null) positions.push(m.index);
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i] - positions[i - 1] <= 200) return true;
  }
  return false;
}

/** Les prix portés par des DONNÉES STRUCTURÉES — JSON-LD et microdonnées.
 *  C'est la piste la plus prometteuse : un marchand qui construit sa page en
 *  JavaScript publie presque toujours ses prix dans un JSON lisible. */
function prixStructures(html) {
  const bloc = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  let offres = 0;
  let couples = 0;
  for (const [, corps] of bloc) {
    const prix = [...corps.matchAll(/"price"\s*:\s*"?[\d.,]+"?/gi)];
    const listes = [...corps.matchAll(/"(?:listPrice|highPrice|priceBeforeDiscount|originalPrice|strikethroughPrice)"\s*:\s*"?[\d.,]+"?/gi)];
    offres += prix.length;
    couples += Math.min(prix.length, listes.length);
  }
  const micro = compter(html, /itemprop\s*=\s*["']price["']/gi);
  return { blocs: bloc.length, offres, couples, micro };
}

function classer(html, code) {
  const prixCentimes = compter(html, FORME_PRIX);
  const prixNus = compter(html, PRIX_SANS_CENTIMES);
  const barres = compter(html, BALISE_BARREE);
  const raye = STYLE_BARRE.test(html);
  const proches = deuxPrixProches(html);
  const structures = prixStructures(html);
  const js = /__NEXT_DATA__|__NUXT__|window\.__(?:INITIAL|PRELOADED|APOLLO)_|id=["'](?:root|app|__next)["']|<div id="app"><\/div>/i.test(html);
  // Un MUR, au sens fort : le site refuse de servir la page. Un simple bandeau
  // « accepter les cookies » n'en est pas un — presque toutes les pages en ont
  // un —, il est relevé à part et ne décide pas du verdict.
  const mur = /(?:just a moment|access denied|attention required|verifying you are human|captcha|cf-browser-verification|checking your browser|enable javascript and cookies to continue)/i.test(html);
  const bandeau = /(?:accept all cookies|accepter tous les cookies|alle cookies accepteren|cookie wall|consentement)/i.test(html);
  const vide = compter(html, /<a\b/gi) + compter(html, /<article\b|<li\b/gi) < 20;

  let verdict;
  if (prixCentimes >= 2 && (barres >= 1 || raye || proches)) verdict = 'PROMO_LISIBLE';   // matière exploitable
  else if (structures.offres >= 2) verdict = 'STRUCTURE_PRETE';                            // prix dans le JSON, lecteur à écrire
  else if (prixCentimes >= 2) verdict = 'PRIX_SANS_PROMO';                                 // des prix, mais aucun couple
  else if (prixCentimes === 1 || prixNus >= 1) verdict = 'UN_SEUL_PRIX';
  else if (mur) verdict = 'MUR_OU_BLOCAGE';
  else if (vide) verdict = 'PAGE_VIDE';
  else if (js) verdict = 'JAVASCRIPT_ONLY';
  else verdict = 'AUCUN_PRIX';

  return { code, octets: html.length, verdict, prixCentimes, prixNus, barres, raye, proches, structures, js, mur, bandeau, vide };
}

async function interroger(url) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
    const html = (await r.text()).slice(0, TAILLE_MAX_HTML);
    return { code: r.status, html };
  } catch (e) {
    return { code: 0, html: '', erreur: String(e && e.message ? e.message : e) };
  } finally {
    clearTimeout(minuteur);
  }
}

const liste = JSON.parse(readFileSync(LISTE, 'utf8'));
// Un argument facultatif limite le nombre de pages : « node outils/diagnostic-niveau1.mjs 5 »
// sert à éprouver le script sans lancer les 216 requêtes.
const LIMITE = Number(process.argv[2]) || 0;
const aFaire = LIMITE ? liste.slice(0, LIMITE) : liste;
if (!existsSync(DOSSIER_HTML)) mkdirSync(DOSSIER_HTML, { recursive: true });

const resultats = [];
let i = 0;
for (const entree of aFaire) {
  i += 1;
  const url = entree.retenue || entree.base;
  const { code, html, erreur } = await interroger(url);
  const r = html ? classer(html, code) : { code, octets: 0, verdict: 'INJOIGNABLE', erreur };
  r.nom = entree.nom;
  r.pays = entree.pays;
  r.url = url;
  if (erreur) r.erreur = erreur;
  if (r.verdict === 'PROMO_LISIBLE' || r.verdict === 'STRUCTURE_PRETE') {
    const propre = entree.nom.replace(/[^a-z0-9.-]/gi, '_').slice(0, 60);
    writeFileSync(join(DOSSIER_HTML, `${propre}.html`), html);
    r.html = `${propre}.html`;
  }
  resultats.push(r);
  process.stdout.write(`\r${i}/${liste.length}  ${r.verdict.padEnd(16)} ${entree.nom.slice(0, 34).padEnd(34)}`);
  await new Promise((s) => setTimeout(s, DELAI_MS));
}
process.stdout.write('\n');

const parVerdict = {};
for (const r of resultats) parVerdict[r.verdict] = (parVerdict[r.verdict] || 0) + 1;
const parPays = {};
for (const r of resultats) {
  parPays[r.pays] = parPays[r.pays] || {};
  parPays[r.pays][r.verdict] = (parPays[r.pays][r.verdict] || 0) + 1;
}

writeFileSync(SORTIE_JSON, JSON.stringify({
  genereLe: new Date().toISOString().slice(0, 10),
  pages: resultats.length,
  parVerdict,
  parPays,
  resultats,
}, null, 1));

const lignes = [];
lignes.push(`DIAGNOSTIC DES ${resultats.length} PAGES « NIVEAU 1 » — ${new Date().toISOString().slice(0, 10)}`);
lignes.push('');
lignes.push('VERDICTS');
for (const [v, n] of Object.entries(parVerdict).sort((a, b) => b[1] - a[1])) {
  lignes.push(`  ${String(n).padStart(4)}  ${v}`);
}
lignes.push('');
lignes.push('PAR PAYS');
for (const [p, v] of Object.entries(parPays).sort()) {
  lignes.push(`  ${p} : ${Object.entries(v).map(([a, b]) => `${a} ${b}`).join(' · ')}`);
}
lignes.push('');
lignes.push('PAGES EXPLOITABLES (à écrire dans le lecteur)');
for (const r of resultats.filter((x) => x.verdict === 'PROMO_LISIBLE' || x.verdict === 'STRUCTURE_PRETE')) {
  lignes.push(`  ${r.verdict.padEnd(16)} ${r.nom} (${r.pays}) — ${r.prixCentimes} forme(s) de prix · ${r.structures.offres} prix structuré(s) · ${r.url}`);
}
writeFileSync(SORTIE_TXT, lignes.join('\n'));
console.log(lignes.join('\n'));
