/**
 * SONDE B3 — Social Deal (plateforme d'ACTIVITÉS hors Groupon).
 *
 * Découverte B3 : socialdeal.be / .nl / .fr servent leurs bons plans en HTML
 * rendu côté serveur, chacun avec DEUX PRIX RÉELS :
 *   <div class="original-price"><span class="price">€26,90</span></div>
 *   <span class="current-price">€16,90</span>
 * et un ruban de pourcentage. La remise se CALCULE entre les deux prix.
 *
 * Cette sonde mesure, par pays : (1) deux relevés espacés → stabilité ;
 * (2) un contrôle NÉGATIF (chemin inexistant) qui doit rendre 0 ;
 * (3) les offres retenues par le garde-fou de vraisemblance (ratio < 5×,
 *     remise 15–90 %), comme le reste du collecteur.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const SITES = [
  ['BE', 'https://www.socialdeal.be/', 'https://www.socialdeal.be/chemin-inexistant-b3-xyzzy'],
  ['NL', 'https://www.socialdeal.nl/', 'https://www.socialdeal.nl/chemin-inexistant-b3-xyzzy'],
  ['FR', 'https://www.socialdeal.fr/', 'https://www.socialdeal.fr/chemin-inexistant-b3-xyzzy'],
];

function page(url, langue = 'nl,fr,en;q=0.8') {
  try {
    return execFileSync('curl', ['-sL', '--max-time', '20', '-A', UA,
      '-H', `Accept-Language: ${langue}`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}

const nb = (s) => Number(String(s).replace(',', '.'));
const dec = (entier, cents) => (cents == null ? Number(entier) : Number(`${entier}.${cents}`));

/** Extrait les cartes : titre + deux prix réels + lien.
 *  ⚠ Le symbole € change de place selon la locale : « €26,90 » (NL) mais
 *  « 38,35€ » (BE/FR) ; et certains prix sont ronds (« 165€ », sans décimales).
 */
function extraire(html) {
  const out = [];
  const prixRe = '(?:€\\s?)?(\\d+)(?:<sub[^>]*>,(\\d{2})<\\/sub>)?(?:\\s?€)?';
  const re = new RegExp(
    '<div class="original-price">[\\s\\S]*?<span class="price">' + prixRe + '<\\/span>'
    + '[\\s\\S]*?<span class="current-price">' + prixRe + '<\\/span>', 'g');
  for (const m of html.matchAll(re)) {
    const avant = dec(m[1], m[2]);
    const prix = dec(m[3], m[4]);
    const avantMatch = html.slice(0, m.index);
    const titre = ([...avantMatch.matchAll(/<h4>([\s\S]{3,200}?)<\/h4>/g)].pop() || [])[1] || '';
    const lien = ([...avantMatch.matchAll(/<a href="(https:\/\/[^"]*\/deals\/[^"]+)"/g)].pop() || [])[1] || '';
    if (!titre || !lien) continue;
    const remise = avant > prix ? Math.round(((avant - prix) / avant) * 100) : null;
    const credible = avant < prix * 5 && remise != null && remise >= 15 && remise <= 90;
    out.push({ titre: titre.replace(/&amp;/g, '&').slice(0, 160), prix, avant, remise, lien, credible });
  }
  return out;
}

for (const [pays, url, negatif] of SITES) {
  const langue = pays === 'NL' ? 'nl,en;q=0.8' : 'fr,nl,en;q=0.8';
  const r1 = extraire(page(url, langue));
  await dormir(3000);
  const r2 = extraire(page(url, langue));
  await dormir(1000);
  const neg = extraire(page(negatif, langue));
  const cred = (r) => r.filter((o) => o.credible);
  const cles = (r) => r.map((o) => o.titre + '|' + o.prix).sort().join(' ; ');
  console.log(`\n=== ${pays}  ${url}`);
  console.log(`  relevé 1 : ${r1.length} cartes, ${cred(r1).length} retenues (15–90 %)`);
  console.log(`  relevé 2 : ${r2.length} cartes, ${cred(r2).length} retenues`);
  console.log(`  contrôle NÉGATIF (chemin inexistant) : ${neg.length} cartes  ${neg.length === 0 ? '✔ propre' : '✘ BRUIT'}`);
  console.log(`  deux relevés IDENTIQUES : ${cles(r1) === cles(r2) ? 'oui ✔' : 'NON'}`);
  for (const o of cred(r1).slice(0, 3)) console.log(`    - ${o.remise}%  ${o.prix}€ au lieu de ${o.avant}€  — ${o.titre.slice(0, 60)}`);
}
