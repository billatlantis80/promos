/**
 * SONDE B4 — autres SOURCES D'ANNONCES par pays (enseignes, comparateurs,
 * flux publics). Unité de RECHERCHE : on sonde et on mesure, on ne câble pas
 * (le câblage est B5).
 *
 * Règle de méthode du plan : on ne compte pas des mots dans le HTML, on fait
 * tourner le VRAI lecteur d'enseigne (`offresEnseigne`) et on ne retient que
 * les offres à DEUX PRIX RÉELS (remise calculée 15–90 %). Contrôle POSITIF
 * (une page connue qui marche) et contrôle NÉGATIF (URL inventée → 0).
 *
 * Deux modes :
 *   node outils/probe-b4.mjs          → passe 1 sur tous les candidats
 *   node outils/probe-b4.mjs --stable → passe 2 + comparaison des deux relevés
 *
 * Politesse : ≥ 1 s entre deux requêtes vers un domaine.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// [pays, nom, url, langue]
export const CANDIDATS = [
  // --- CONTRÔLES ---
  ['--', 'NEG-domaine-inexistant', 'https://www.inexistant-b4-xyzzy.example/promos', 'fr'],
  ['BE', 'POS-groupon-be-goods', 'https://www.groupon.be/goods', 'fr'],
  ['BE', 'POS-coolblue-be', 'https://www.coolblue.be/fr/offres', 'fr'],

  // --- ANIMAUX (animaleries) ---
  ['BE', 'zooplus.be', 'https://www.zooplus.be/', 'fr'],
  ['NL', 'zooplus.nl', 'https://www.zooplus.nl/', 'nl'],
  ['DE', 'zooplus.de', 'https://www.zooplus.de/', 'de'],
  ['FR', 'zooplus.fr', 'https://www.zooplus.fr/', 'fr'],
  ['ES', 'zooplus.es', 'https://www.zooplus.es/', 'es'],
  ['IT', 'zooplus.it', 'https://www.zooplus.it/', 'it'],
  ['PL', 'zooplus.pl', 'https://www.zooplus.pl/', 'pl'],
  ['SE', 'zooplus.se', 'https://www.zooplus.se/', 'sv'],
  ['DE', 'fressnapf.de', 'https://www.fressnapf.de/', 'de'],
  ['BE', 'maxizoo.be', 'https://www.maxizoo.be/', 'fr'],

  // --- MEUBLES (enseignes locales d'ameublement) ---
  ['BE', 'jysk.be', 'https://jysk.be/', 'fr'],
  ['NL', 'jysk.nl', 'https://jysk.nl/', 'nl'],
  ['DE', 'jysk.de', 'https://jysk.de/', 'de'],
  ['FR', 'jysk.fr', 'https://jysk.fr/', 'fr'],
  ['PL', 'jysk.pl', 'https://jysk.pl/', 'pl'],
  ['SE', 'jysk.se', 'https://jysk.se/', 'sv'],
  ['NL', 'leenbakker.nl', 'https://www.leenbakker.nl/', 'nl'],
  ['NL', 'kwantum.nl', 'https://www.kwantum.nl/', 'nl'],

  // --- HIGH-TECH / ÉLECTROMÉNAGER (enseignes) ---
  ['NL', 'alternate.nl', 'https://www.alternate.nl/outlet', 'nl'],
  ['DE', 'alternate.de', 'https://www.alternate.de/outlet', 'de'],
  ['BE', 'alternate.be', 'https://www.alternate.be/outlet', 'nl'],
  ['FR', 'ldlc.com', 'https://www.ldlc.com/bons-plans/', 'fr'],
  ['DE', 'notebooksbilliger.de', 'https://www.notebooksbilliger.de/', 'de'],
  ['PL', 'x-kom.pl', 'https://www.x-kom.pl/', 'pl'],
  ['PL', 'morele.net', 'https://www.morele.net/', 'pl'],
  ['IT', 'mediaworld.it', 'https://www.mediaworld.it/', 'it'],
  ['PT', 'worten.pt', 'https://www.worten.pt/', 'pt'],
  ['SE', 'webhallen.com', 'https://www.webhallen.com/se/', 'sv'],
  ['GB', 'ao.com', 'https://ao.com/', 'en'],
  ['IE', 'harveynorman.ie', 'https://www.harveynorman.ie/', 'en'],

  // --- COMPARATEURS (pistes « flux publics ») ---
  ['AT', 'geizhals.at', 'https://geizhals.at/', 'de'],
  ['DE', 'geizhals.de', 'https://geizhals.de/', 'de'],
  ['GB', 'skinflint.co.uk', 'https://skinflint.co.uk/', 'en'],
  ['SE', 'pricerunner.se', 'https://www.pricerunner.se/', 'sv'],

  // --- VOYAGES ---
  ['BE', 'weekendesk.be', 'https://www.weekendesk.be/', 'fr'],
  ['NL', 'weekendesk.nl', 'https://www.weekendesk.nl/', 'nl'],
];

function page(url, langue) {
  try {
    return execFileSync('curl', ['-fsS', '-L', '--compressed', '--max-time', '18', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}

const source = (pays, nom, url, langue) => ({ id: `probe-b4-${pays}-${nom}`, nom, type: 'enseigne', pays, langue, url });

const jsonLd = (html) => (html.match(/application\/ld\+json/gi) || []).length;
const prixDevise = (html) => (html.match(/\d{1,4}(?:[.,]\d{2})?\s?(?:€|EUR|zł|kr|£)/g) || []).length;

function mesurer(pays, nom, url, langue) {
  const html = page(url, langue);
  if (!html) return { html, offres: [], propres: [], ex: '—' };
  const offres = offresEnseigne(html, source(pays, nom, url, langue));
  const propres = offres.filter((o) => o.remise != null && o.remise >= 15 && o.remise <= 90);
  const ex = propres[0] ? `${propres[0].remise}% ${propres[0].pays} ${propres[0].titre.slice(0, 40)}`
    : (offres[0] ? `(sans 2e prix) ${offres[0].titre.slice(0, 36)}` : '—');
  return { html, offres, propres, ex };
}

if (process.argv.includes('--stable')) {
  // Passe 2 : re-mesure UNIQUEMENT les candidats qui avaient rendu des offres
  // à deux prix à la passe 1 (relus depuis le fichier de résultats).
  const precedents = JSON.parse(execFileSync('cat', [new URL('./.b4-passe1.json', import.meta.url)]));
  console.log('pays  candidat                  p1   p2   identiques  exemples');
  for (const { pays, nom, url, langue, n1 } of precedents.filter((c) => c.n1 > 0)) {
    const r = mesurer(pays, nom, url, langue);
    await dormir(1200);
    const n2 = r.propres.length;
    const ok = n1 === n2 ? 'oui ✔' : 'NON';
    console.log(`${pays.padEnd(5)} ${nom.padEnd(24)} ${String(n1).padStart(4)} ${String(n2).padStart(4)}   ${ok.padEnd(10)} ${r.ex}`);
  }
} else {
  console.log('pays  candidat                  octets     ld   lues  2prix  exemples');
  const resultats = [];
  for (const [pays, nom, url, langue] of CANDIDATS) {
    const r = mesurer(pays, nom, url, langue);
    await dormir(1200);
    resultats.push({ pays, nom, url, langue, n1: r.propres.length, lues: r.offres.length });
    console.log(
      `${pays.padEnd(5)} ${nom.padEnd(24)} ${String(r.html.length).padStart(7)} ${String(jsonLd(r.html)).padStart(4)} ` +
      `${String(r.offres.length).padStart(6)} ${String(r.propres.length).padStart(5)}  ${r.ex}`,
    );
  }
  process.stdout.write('\nJSON:' + JSON.stringify(resultats) + '\n');
}
