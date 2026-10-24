/**
 * AUDIT DE LA CATÉGORIE « AUTRES ».
 *
 * Demande de B : « il faut bien vérifier les éléments qui sont mis dans cette
 * catégorie afin de vérifier s'ils ne peuvent pas être classés dans d'autres
 * qui leur correspondent ».
 *
 * Méthode : on ne relit pas 1 857 titres à l'œil. On cherche les MOTS qui
 * reviennent et qui n'appartiennent à AUCUNE table de classement — ce sont eux
 * qui signalent une rubrique manquante. Un mot fréquent et inconnu, c'est une
 * catégorie qu'on n'a pas encore nommée.
 */
import fs from 'node:fs';
import { FAMILLES, MARQUES, MOTS_FORTS, sansAccents } from '../collecteur.mjs';

const STOP = new Set(('le la les un une des du de au aux et ou pour avec sans sur dans par en d l à a the of and for with '
  + 'new neuf promo promos promotion offre offres deal deals prix price lot set pack piece pieces pcs stk '
  + 'plus grand grande petit petite max mini xl xxl taille color couleur noir blanc bleu rouge vert rose gris '
  + 'cm mm kg ml litre litres gr g watts w volt v piece modele model serie type edition version original '
  + 'gratuit gratuitement livraison inclus incluse offert amazon prime').split(/\s+/));

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const autre = offres.filter((o) => (o.categorie || 'autre') === 'autre');

// Tous les mots déjà connus du classement, toutes tables confondues.
const connus = new Set();
for (const t of [FAMILLES, MARQUES, MOTS_FORTS]) {
  for (const mots of Object.values(t)) for (const m of mots) connus.add(sansAccents(m).toLowerCase());
}

const compte = new Map();
const exemple = new Map();
for (const o of autre) {
  const t = sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
  const vus = new Set();
  for (const mot of t.split(/[^a-z0-9]+/)) {
    if (mot.length < 4 || STOP.has(mot) || vus.has(mot)) continue;
    if (/^\d+$/.test(mot)) continue;
    vus.add(mot);
    compte.set(mot, (compte.get(mot) || 0) + 1);
    if (!exemple.has(mot)) exemple.set(mot, String(o.titre || '').slice(0, 58));
  }
}

const total = () => process.stdout.write('');
console.log(`offres publiées        : ${offres.length}`);
console.log(`rangées en « Autres »  : ${autre.length}  (${(autre.length / offres.length * 100).toFixed(1)} %)`);
const avecSource = autre.filter((o) => o.categorieSource && o.categorieSource !== 'autre').length;
console.log(`dont la source a parlé : ${avecSource}  (les autres n'ont NI source NI mot connu)`);
total();

const fréquents = [...compte.entries()].filter(([m]) => !connus.has(m)).sort((a, b) => b[1] - a[1]).slice(0, 45);
console.log('\n— 45 mots fréquents ABSENTS de toutes nos tables (candidats à une rubrique) —');
for (const [mot, n] of fréquents) {
  console.log(`  ${String(n).padStart(4)}×  ${mot.padEnd(20)} « ${exemple.get(mot)} »`);
}

const dansTables = [...compte.entries()].filter(([m]) => connus.has(m)).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('\n— mots DÉJÀ connus mais laissés en « Autres » (règle trop faible : à regarder) —');
for (const [mot, n] of dansTables) {
  console.log(`  ${String(n).padStart(4)}×  ${mot.padEnd(20)} « ${exemple.get(mot)} »`);
}
