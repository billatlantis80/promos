/**
 * RÉPARTITION PAR RUBRIQUE — le contrôle de l'unité E5.
 *
 * Demande de B (plan point 1) : « vérifier toute la programmation ». Après les
 * unités E1 à E4 (nouvel onglet Électroménager, soins → Beauté, mots d'enfant →
 * Jouets), il faut pouvoir MONTRER, pas affirmer, ce que contient chaque
 * rubrique — et en particulier que chaque compteur NOUVEAU est justifié.
 *
 * Méthode : on lit le site PUBLIÉ (docs/offres.json, ce que voit le lecteur),
 * on compte par rubrique et par pays, on cite un EXEMPLE par rubrique, et on
 * nomme les rubriques VIDES pour un pays au lieu de les passer sous silence.
 *
 * Règle du projet : aucun chiffre n'est annoncé sans être mesuré ici.
 */
import fs from 'node:fs';

const CATS = ['tech', 'electromenager', 'meubles', 'maison', 'mode', 'auto', 'jouets', 'sport',
  'bricolage', 'beaute', 'nourriture', 'animaux', 'voyages', 'activite', 'autre'];
const NOMS = {
  tech: 'High-tech', electromenager: 'Électroménager', meubles: 'Meubles', maison: 'Maison',
  mode: 'Mode', auto: 'Auto & moto', jouets: 'Jeux & jouets', sport: 'Sport',
  bricolage: 'Bricolage', beaute: 'Beauté', nourriture: 'Nourriture', animaux: 'Animaux',
  voyages: 'Voyages', activite: 'Activité', autre: 'Autres',
};

const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;
const cat = (o) => o.categorie || 'autre';
const court = (s, n = 54) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

console.log(`site publié généré le : ${brut.genereLe || '?'}`);
console.log(`offres publiées       : ${offres.length}`);
console.log(`sans rubrique         : ${offres.filter((o) => !o.categorie).length}`);
console.log('');

// 1. Global, dans l'ORDRE des onglets (jamais trié par nombre).
const global = new Map(CATS.map((c) => [c, 0]));
for (const o of offres) global.set(cat(o), (global.get(cat(o)) || 0) + 1);
const exemple = new Map();
for (const o of offres) if (!exemple.has(cat(o))) exemple.set(cat(o), court(o.titre));

console.log('— RÉPARTITION GLOBALE (ordre des onglets) —');
for (const c of CATS) {
  const n = global.get(c) || 0;
  const pct = (n / offres.length * 100).toFixed(1);
  const ex = exemple.get(c);
  console.log(`  ${String(n).padStart(5)}  ${pct.padStart(5)} %  ${NOMS[c].padEnd(14)} ${ex ? '« ' + ex + ' »' : ''}`);
}
console.log('');

// 2. Par pays.
const pays = [...new Set(offres.map((o) => o.pays || 'FR'))].sort();
console.log('— RÉPARTITION PAR PAYS —');
const vide = [];
for (const p of pays) {
  const du = offres.filter((o) => (o.pays || 'FR') === p);
  const c = new Map(CATS.map((k) => [k, 0]));
  for (const o of du) c.set(cat(o), (c.get(cat(o)) || 0) + 1);
  const vides = CATS.filter((k) => !c.get(k));
  if (vides.length) vide.push(`${p} : ${vides.map((k) => NOMS[k]).join(', ')}`);
  console.log(`\n  ${p} — ${du.length} offres`);
  console.log('    ' + CATS.filter((k) => c.get(k)).map((k) => `${NOMS[k]} ${c.get(k)}`).join(' · '));
}
console.log('');

// 3. Rubriques VIDES, nommées (une rubrique d'onglet à zéro est un fait, pas un détail).
console.log('— RUBRIQUES À ZÉRO, PAR PAYS (nommées, jamais tues) —');
if (!vide.length) console.log('  aucune');
for (const v of vide) console.log('  ' + v);
console.log('');

// 4. Preuve d'un compteur : exemples nommés d'une rubrique donnée.
const rubriques = process.argv.slice(2);
for (const r of rubriques) {
  const du = offres.filter((o) => cat(o) === r);
  console.log(`— PREUVE « ${NOMS[r] || r} » : ${du.length} offres, 5 exemples —`);
  for (const o of du.slice(0, 5)) {
    console.log(`   [${o.pays || '?'}] ${court(o.titre, 62)}  (source: ${o.marchand || o.categorieSource || '?'})`);
  }
  console.log('');
}
