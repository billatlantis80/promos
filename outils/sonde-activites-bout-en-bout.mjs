/**
 * Sonde d'ACTIVITÉS, bout en bout — on ne compte pas des chaînes dans le HTML,
 * on fait tourner le VRAI lecteur (`offresGroupon`) sur chaque page candidate.
 *
 * C'est la seule mesure qui compte : une page peut contenir « StandardDealCard »
 * sans que le lecteur en tire une seule offre exploitable (deux prix réels).
 * Compter les occurrences d'un mot-clé aurait annoncé un succès que l'app
 * n'aurait pas eu.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresGroupon } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const PAUSE = 3;
const CANDIDATS = [
  // pays, domaine, chemin, langue
  ['BE', 'www.groupon.be', '/fr/landing/sale', 'fr'],   // référence (déjà branchée)
  ['FR', 'www.groupon.fr', '/bon-plan', 'fr'],
  ['DE', 'www.groupon.de', '/gutscheine', 'de'],
  ['NL', 'www.groupon.nl', '/', 'nl'],
  ['IT', 'www.groupon.it', '/offerte', 'it'],
  ['ES', 'www.groupon.es', '/ofertas', 'es'],
  ['PL', 'www.groupon.pl', '/oferta', 'pl'],
  ['GB', 'www.groupon.co.uk', '/vouchers', 'en'],
  ['IE', 'www.groupon.ie', '/vouchers', 'en'],
];

function page(domaine, chemin) {
  try {
    return execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA,
      '-H', 'Accept-Language: fr,en;q=0.8', `https://${domaine}${chemin}`],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return ''; }
}

const source = (pays, nom, chemin, langue) => ({
  id: `probe-${pays}`, nom, type: 'groupon', pays, langue,
  categorieImposee: 'activite', url: `https://${nom}${chemin}`,
});

console.log('pays  source                        offres  remise médiane  exemple');
for (const [pays, domaine, chemin, langue] of CANDIDATS) {
  const html = page(domaine, chemin);
  const offres = html ? offresGroupon(html, source(pays, domaine, chemin, langue)) : [];
  await dormir(3000);
  const remises = offres.map((o) => o.remise).filter(Number.isFinite).sort((a, b) => a - b);
  const med = remises.length ? remises[Math.floor(remises.length / 2)] : 0;
  const ex = offres[0] ? offres[0].titre.slice(0, 42) : '—';
  console.log(
    `${pays.padEnd(5)} ${(domaine + chemin).padEnd(30)} ${String(offres.length).padStart(5)}   `
    + `${String(med).padStart(3)} %           ${ex}`,
  );
}
