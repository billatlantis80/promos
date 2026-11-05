#!/usr/bin/env node
/**
 * RÉSOLVEUR DE DESTINATIONS — retrouver le VRAI marchand derrière un bon plan.
 *
 * ── LE PROBLÈME, MESURÉ ────────────────────────────────────────────────────
 * Le 11/10/2026, l'audit des liens sortants du catalogue donne :
 *
 *     vers un AGREGATEUR            : 13 070  (69,7 %)  -> AUCUNE commission possible
 *     vers un MARCHAND (lien direct):    883  ( 4,7 %)
 *     dont Amazon                    :  4 792  (25,6 %)
 *
 * Autrement dit : **plus des deux tiers du catalogue envoie le visiteur chez
 * un site de bons plans concurrent** (mydealz, Dealabs, HotUKDeals,
 * Chollometro, Pepper…), pas chez le marchand. Et de ces 13 070 offres,
 * **5 069 nomment « Amazon » comme marchand** : le nom est connu, l'adresse ne
 * l'était pas. S'inscrire à quinze réseaux d'affiliation ne monétisera pas un
 * lien qui ne mène pas au marchand.
 *
 * ── CE QUE CE SCRIPT FAIT, ET COMMENT IL LE SAIT ───────────────────────────
 * Ces plateformes de bons plans (groupe Pepper) exposent la destination
 * derrière un point de redirection public :
 *
 *     GET https://<hôte>/visit/threadmain/<n° du fil>
 *     302 Location: https://path.<hôte>/pepper-xx/redirect?url=<ADRESSE MARCHAND ENCODÉE>&...
 *
 * Une seule requête rend donc l'adresse réelle. Vérifié le 11/10/2026 sur une
 * offre réelle du catalogue :
 *
 *     https://www.chollometro.com/visit/threadmain/2028106
 *       -> url = https://www.amazon.es/dp/B003ZG966A?smid=A1AT7YVPFBWXBL
 *
 * L'ASIN est dans l'adresse : elle est donc TAGUABLE telle quelle.
 *
 * ── POURQUOI UN CACHE, ET PAS UNE RÉÉCRITURE DU CATALOGUE ──────────────────
 * data/offres.json est RÉÉCRIT par la collecte toutes les 5 minutes, et la
 * fusion fait `{...avant, ...offre}` : tout `lienMarchand` écrit à la main
 * serait écrasé au passage suivant. On n'écrit donc RIEN dans le catalogue
 * ici : on tient un cache, et c'est la COLLECTE qui l'applique (voir
 * appliquerDestinations() dans collecteur.mjs). Le cache est cumulatif et
 * reprenable : un arrêt ne fait rien reperdre.
 *
 * ── CE QUE CE SCRIPT NE FAIT PAS ───────────────────────────────────────────
 * Il ne DEVINE rien. Une résolution qui échoue, qui renvoie une adresse non
 * lisible, ou qui renvoie vers un site de bons plans / un moteur / un réseau
 * social est ÉCARTÉE et notée comme telle — jamais remplacée par une adresse
 * plausible. Une offre sans destination résolue garde son lien d'origine : le
 * lien reste vrai, il ne rapporte simplement rien.
 *
 * Usage :
 *   node outils/resoudre-destinations.mjs --limite 20            (essai)
 *   node outils/resoudre-destinations.mjs --marchand amazon      (Amazon d'abord)
 *   node outils/resoudre-destinations.mjs --hote dealabs.com     (un seul hôte)
 *   node outils/resoudre-destinations.mjs --tout                 (le gisement)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER = path.resolve(ICI, '..');
const FICHIER_CATALOGUE = path.join(DOSSIER, 'data', 'offres.json');
const FICHIER_CACHE = path.join(DOSSIER, 'donnees', 'destinations-reelles.json');

/* ------------------------------------------------------------------ *
 *  LES PLATEFORMES DONT LA DESTINATION SE RÉSOUT
 *
 *  Toutes du groupe Pepper, toutes avec le même chemin de sortie. La liste est
 *  ÉCRITE À LA MAIN et non devinée : un hôte qu'on croit du groupe mais qui ne
 *  l'est pas rendrait un 404, et un 404 pris pour une absence de destination
 *  ferait perdre l'offre pour rien.
 * ------------------------------------------------------------------ */
export const HÔTES_RÉSOLUBLES = new Set([
  'mydealz.de',
  'dealabs.com',
  'hotukdeals.com',
  'chollometro.com',
  'pepper.pl',
  'nl.pepper.com',
  'preisjaeger.at',
]);

/** Le chemin de sortie, relevé et non supposé. */
export const cheminDeSortie = (numeroDeFil) => `/visit/threadmain/${numeroDeFil}`;

/* ------------------------------------------------------------------ *
 *  CE QU'UNE DESTINATION NE DOIT PAS ÊTRE
 *
 *  Les motifs qui ont réellement été observés, ou qui seraient le signe qu'on
 *  n'a pas quitté la plateforme : le groupe Pepper et ses points de suivi,
 *  les moteurs, les réseaux sociaux, les raccourcisseurs. Une destination qui
 *  tombe ici est ÉCARTÉE — sans elle, la carte promettrait un marchand et
 *  enverrait ailleurs.
 * ------------------------------------------------------------------ */
const DESTINATION_REFUSÉE = [
  /(^|\.)pepper\.[a-z.]+$/i,
  /(^|\.)mydealz\./i,
  /(^|\.)dealabs\./i,
  /(^|\.)hotukdeals\./i,
  /(^|\.)chollometro\./i,
  /(^|\.)preisjaeger\./i,
  /(^|\.)google\./i,
  /(^|\.)googleusercontent\./i,
  /(^|\.)msn\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)t\.co$/i,
  /(^|\.)bit\.ly$/i,
  /(^|\.)amzn\.to$/i,
];

/** Vrai si l'adresse est une destination acceptable pour une carte d'offre. */
export function destinationAcceptable(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const hôte = u.hostname.toLowerCase();
  if (!hôte || !hôte.includes('.')) return false;
  for (const motif of DESTINATION_REFUSÉE) if (motif.test(hôte)) return false;
  return true;
}

/** L'hôte d'une adresse, sans « www. », en minuscules. '' si illisible. */
export function hôteDe(url) {
  try { return new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

/** Le numéro du fil d'une adresse de bon plan : le dernier nombre du chemin. */
export function numéroDeFil(url) {
  const propre = String(url || '').split('?')[0].replace(/\/$/, '');
  const m = propre.match(/-(\d{3,})$/);
  return m ? m[1] : '';
}

/** L'hôte de sortie à interroger pour une adresse de page de bon plan. */
export function hôteRésoluble(url) {
  const h = hôteDe(url);
  return HÔTES_RÉSOLUBLES.has(h) ? h : '';
}

/**
 * L'adresse de redirection à interroger, ou '' si l'adresse n'est pas
 * résoluble. Isolée des entrées-sorties : c'est elle que les tests exercent.
 */
export function adresseDeSortie(url) {
  const hôte = hôteRésoluble(url);
  const numero = numéroDeFil(url);
  if (!hôte || !numero) return '';
  return `https://www.${hôte}/visit/threadmain/${numero}`;
}

/**
 * Extrait l'adresse marchande d'une adresse de redirection Pepper.
 *
 *   https://path.chollometro.com/pepper-es/redirect?url=https%3A%2F%2F…&tag=eugc
 *     -> https://www.amazon.es/dp/B003ZG966A?smid=…
 *
 * Rend '' si le paramètre manque, s'il est illisible, ou si la destination est
 * refusée (voir destinationAcceptable). Ne devine jamais : une adresse absente
 * n'est pas remplacée.
 */
export function destinationDeRedirection(location) {
  if (!location) return '';
  let paramètre;
  try { paramètre = new URL(String(location)).searchParams.get('url'); } catch { return ''; }
  if (!paramètre) return '';
  let décodée;
  try { décodée = decodeURIComponent(paramètre); } catch { décodée = paramètre; }
  return destinationAcceptable(décodée) ? décodée : '';
}

/* ------------------------------------------------------------------ *
 *  LA MARCHE DU SCRIPT
 * ------------------------------------------------------------------ */

function lireArguments(argv) {
  const a = { limite: 0, hôte: '', marchand: '', pause: 900, tout: false, verbeux: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--tout') a.tout = true;
    else if (v === '--verbeux') a.verbeux = true;
    else if (v === '--limite') a.limite = Number(argv[++i]) || 0;
    else if (v === '--hote') a.hôte = String(argv[++i] || '').trim();
    else if (v === '--marchand') a.marchand = String(argv[++i] || '').trim().toLowerCase();
    else if (v === '--pause') a.pause = Math.max(0, Number(argv[++i]) || 0);
  }
  return a;
}

function lireCatalogue() {
  const d = JSON.parse(fs.readFileSync(FICHIER_CATALOGUE, 'utf8'));
  return d && Array.isArray(d.offres) ? d.offres : (Array.isArray(d) ? d : []);
}

function lireCache() {
  try {
    const d = JSON.parse(fs.readFileSync(FICHIER_CACHE, 'utf8'));
    return d && typeof d.destinations === 'object' ? d : { destinations: {} };
  } catch { return { destinations: {} }; }
}

function écrireCache(cache) {
  fs.mkdirSync(path.dirname(FICHIER_CACHE), { recursive: true });
  const provisoire = `${FICHIER_CACHE}.tmp`;
  cache.genereLe = new Date().toISOString();
  fs.writeFileSync(provisoire, JSON.stringify(cache, null, 1));
  fs.renameSync(provisoire, FICHIER_CACHE);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Une requête, sans suivre la redirection : c'est la redirection qui est le résultat. */
async function interrogerSortie(url) {
  const r = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20_000),
  });
  const location = r.headers.get('location') || '';
  return { code: r.status, location };
}

async function principal() {
  const a = lireArguments(process.argv.slice(2));
  const offres = lireCatalogue();
  const cache = lireCache();

  // Ce qu'il reste à faire : les offres dont le lien de sortie est résoluble et
  // dont la destination n'est PAS déjà au cache.
  const àFaire = [];
  const vus = new Set();
  for (const o of offres) {
    const url = o.lienMarchand || o.lienPage || '';
    const adresse = adresseDeSortie(url);
    if (!adresse) continue;
    if (a.hôte && hôteDe(url) !== a.hôte) continue;
    if (a.marchand) {
      const nom = String(o.marchand || '').toLowerCase();
      if (!nom.includes(a.marchand)) continue;
    }
    const clé = adresse;
    if (cache.destinations[clé] || vus.has(clé)) continue;
    vus.add(clé);
    àFaire.push({ clé, adresse, offre: o, hôte: hôteDe(url) });
  }

  const limité = (!a.tout && a.limite > 0) ? àFaire.slice(0, a.limite) : (a.tout ? àFaire : àFaire.slice(0, 40));

  console.log(`RÉSOLVEUR DE DESTINATIONS — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  console.log(`  catalogue         : ${offres.length} offres`);
  console.log(`  déjà au cache     : ${Object.keys(cache.destinations).length}`);
  console.log(`  à interroger ici  : ${limité.length}${(!a.tout && !a.limite) ? ' (défaut 40 — « --tout » pour le gisement)' : ''}`);
  console.log(`  pause             : ${a.pause} ms\n`);

  let ok = 0, refus = 0, échecs = 0, sansLocation = 0;
  const parHôte = {};

  for (const [i, item] of limité.entries()) {
    let location = '';
    try {
      const r = await interrogerSortie(item.adresse);
      location = r.location;
      if (!location) sansLocation++;
    } catch (e) {
      échecs++;
      if (a.verbeux) console.log(`  ! ${item.adresse} — ${e.name || e.message}`);
      await dormir(a.pause);
      continue;
    }
    const dest = destinationDeRedirection(location);
    if (dest) {
      const hôteDest = hôteDe(dest);
      cache.destinations[item.clé] = { url: dest, hote: hôteDest, le: new Date().toISOString() };
      ok++;
      parHôte[hôteDest] = (parHôte[hôteDest] || 0) + 1;
      if (a.verbeux || i < 5) console.log(`  ✓ ${item.hôte} #${numéroDeFil(item.offre.lienPage)} -> ${hôteDest}`);
    } else {
      refus++;
      cache.destinations[item.clé] = { url: '', hote: '', refus: location ? 'destination-refusee' : 'aucune-redirection', le: new Date().toISOString() };
      if (a.verbeux) console.log(`  ✗ ${item.adresse} — ${location ? 'destination refusée' : 'aucune redirection'}`);
    }
    if ((i + 1) % 25 === 0) {
      écrireCache(cache);
      console.log(`  … ${i + 1}/${limité.length} (cache écrit : ${ok} trouvées)`);
    }
    await dormir(a.pause);
  }

  écrireCache(cache);

  console.log(`\nBILAN`);
  console.log(`  destinations trouvées : ${ok}`);
  console.log(`  écartées (refus)      : ${refus}   (aucune redirection : ${sansLocation})`);
  console.log(`  échecs réseau         : ${échecs}`);
  console.log(`  cache total           : ${Object.keys(cache.destinations).length}`);
  if (ok) {
    console.log(`\n  par marchand de destination :`);
    for (const [h, n] of Object.entries(parHôte).sort((x, y) => y[1] - x[1]).slice(0, 15)) {
      console.log(`    ${String(n).padStart(5)}  ${h}`);
    }
  }
  console.log(`\n  cache : ${path.relative(DOSSIER, FICHIER_CACHE)}`);
  // Code 0 si au moins une résolution, 1 si tout a échoué (le script n'a alors
  // rien apporté, et un appelant doit le savoir).
  process.exit(ok > 0 || limité.length === 0 ? 0 : 1);
}

// Exécuté directement (et non importé par un test) : on marche.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  principal();
}
