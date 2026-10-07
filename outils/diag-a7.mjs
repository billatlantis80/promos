import fs from 'node:fs';
import { FAMILLES, MARQUES, MOTS_FORTS, sansAccents } from '../collecteur.mjs';

const STOP = new Set(('le la les un une des du de au aux et ou pour avec sans sur dans par en d l à a the of and for with '
  + 'new neuf promo promos promotion offre offres deal deals prix price lot set pack piece pieces pcs stk '
  + 'plus grand grande petit petite max mini xl xxl taille color couleur noir blanc bleu rouge vert rose gris '
  + 'cm mm kg ml litre litres gr g watts w volt v piece modele model serie type edition version original '
  + 'gratuit gratuitement livraison inclus incluse offert amazon prime').split(/\s+/));

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const cible = offres.filter((o) => (o.categorie || 'autre') === 'autre'
  && ['vente flash', 'amazon', 'enseigne', 'veille', 'maison', 'mode', 'jouets'].includes(o.categorieSource));

const connus = new Set();
for (const t of [FAMILLES, MARQUES, MOTS_FORTS]) {
  for (const mots of Object.values(t)) for (const m of mots) connus.add(sansAccents(m).toLowerCase());
}

console.log('offres ciblees (produits sans source classable) :', cible.length);
const compte = new Map(); const exemple = new Map();
for (const o of cible) {
  const t = sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
  const vus = new Set();
  for (const mot of t.split(/[^a-z0-9]+/)) {
    if (mot.length < 4 || STOP.has(mot) || vus.has(mot)) continue;
    if (/^\d+$/.test(mot)) continue;
    vus.add(mot);
    compte.set(mot, (compte.get(mot) || 0) + 1);
    if (!exemple.has(mot)) exemple.set(mot, String(o.titre || '').slice(0, 70));
  }
}
const f = [...compte.entries()].filter(([m]) => !connus.has(m)).sort((a, b) => b[1] - a[1]).slice(0, 70);
console.log('\n— mots ABSENTS des tables (produits) —');
for (const [mot, n] of f) console.log(`  ${String(n).padStart(4)}×  ${mot.padEnd(18)} « ${exemple.get(mot)} »`);
