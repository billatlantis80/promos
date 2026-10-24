/**
 * AUDIT A6 — CORRIGER LES FAUX POSITIFS DÉMONTRÉS, PUIS RE-MESURER.
 *
 * Unité A6 du PLAN-NUIT.md : « Corriger uniquement les faux positifs démontrés
 * (mot à frontière, mot trompeur, produit nommé) ; re-mesurer. »
 *
 * DEUX MESURES, deux modes :
 *
 *  1) MODE COHÉRENCE (défaut) — rejoue `classerOffre()` (le collecteur ACTUEL)
 *     sur toutes les offres publiées et le compare à la rubrique ENREGISTRÉE
 *     dans `docs/offres.json`. Après la correction, l'écart doit être 0 : la
 *     rubrique publiée est exactement ce que la règle produit. C'est ce qui
 *     montre que la correction est bien embarquée dans les données publiées.
 *
 *  2) MODE CONTRFACTUEL (`--avant <fichier.mjs>`) — rejoue DEUX versions du
 *     classement sur le MÊME jeu d'offres : la version d'avant (le fichier
 *     passé, p. ex. `git show HEAD:collecteur.mjs`) et la version actuelle. La
 *     différence est l'EFFET MESURÉ des corrections : combien d'offres quittent
 *     une rubrique où elles n'avaient pas leur place, et pour aller où.
 *     Repro : `git show HEAD:collecteur.mjs > /tmp/avant.mjs`
 *             `node outils/audit-a6.mjs --avant /tmp/avant.mjs --detail`
 *
 * Usage : node outils/audit-a6.mjs [--fichier docs/offres.json] [--avant f.mjs] [--detail]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classerOffre } from '../collecteur.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const DETAIL = process.argv.includes('--detail');

let fichier = arg('fichier', '');
if (!fichier) {
  const publie = path.join(RACINE, 'docs', 'offres.json');
  const local = path.join(RACINE, 'data', 'offres.json');
  fichier = fs.existsSync(publie) ? publie : local;
}
const donnees = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const offres = Array.isArray(donnees) ? donnees : (donnees.offres || []);

const NOMS = {
  tech: 'High-tech', electromenager: 'Électroménager', meubles: 'Meubles',
  maison: 'Maison', mode: 'Mode', auto: 'Auto & moto', jouets: 'Jeux & jouets',
  sport: 'Sport', bricolage: 'Bricolage', beaute: 'Beauté', nourriture: 'Nourriture',
  animaux: 'Animaux', voyages: 'Voyages', activite: 'Activité', autre: 'Autres',
};
const court = (s, n = 90) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

console.log('AUDIT A6 — RE-MESURE APRÈS CORRECTIONS');
console.log(`  fichier : ${path.relative(RACINE, fichier)}`);
console.log(`  offres  : ${offres.length}`);

// --- MODE CONTRFACTUEL (si --avant) -----------------------------------------
const cheminAvant = arg('avant', '');
if (cheminAvant) {
  const url = pathToFileURL(path.resolve(cheminAvant)).href;
  const ancien = (await import(url)).classerOffre;
  const changements = [];
  for (const o of offres) {
    const a = ancien(o);
    const b = classerOffre(o);
    if (a !== b) changements.push({ a, b, titre: o.titre, src: o.categorieSource || '-', pays: o.pays || '-' });
  }
  const incoherents = offres.filter((o) => ancien(o) !== o.categorie).length;
  console.log(`  version d'avant : ${path.relative(RACINE, cheminAvant)}`);
  console.log(`  AVANT (fichier) vs rubrique enregistrée : ${incoherents} écart(s)`);
  console.log(`\n  EFFET MESURÉ : ${changements.length} offre(s) changée(s) par la correction\n`);
  const aff = {};
  for (const c of changements) { const k = `${c.a}->${c.b}`; aff[k] = (aff[k] || 0) + 1; }
  console.log('  Matrice (avant -> après) :');
  for (const [k, n] of Object.entries(aff).sort((x, y) => y[1] - x[1])) {
    const [a, b] = k.split('->');
    console.log(`    ${String(n).padStart(4)}  ${(NOMS[a] || a).padEnd(16)} -> ${NOMS[b] || b}`);
  }
  if (DETAIL) {
    console.log('\n  Détail :');
    for (const c of changements.sort((x, y) => (x.a + x.b).localeCompare(y.a + y.b))) {
      console.log(`    [${c.pays}] ${c.a}->${c.b}  src=${c.src} | ${court(c.titre)}`);
    }
  }
  process.exit(0);
}

// --- MODE COHÉRENCE (défaut) ------------------------------------------------
const changements = [];
for (const o of offres) {
  const avant = o.categorie;
  const apres = classerOffre(o);
  if (avant !== apres) changements.push({ avant, apres, titre: o.titre, src: o.categorieSource || '-', pays: o.pays || '-' });
}

console.log(`  écart enregistré/recalculé : ${changements.length}`);

if (changements.length) {
  const matrice = {};
  for (const c of changements) {
    const k = `${c.avant} -> ${c.apres}`;
    matrice[k] = (matrice[k] || 0) + 1;
  }
  console.log('\nMatrice des changements (rubrique enregistrée -> recalculée) :');
  for (const [k, n] of Object.entries(matrice).sort((a, b) => b[1] - a[1])) {
    const [a, b] = k.split(' -> ');
    console.log(`  ${String(n).padStart(4)}  ${(NOMS[a] || a).padEnd(16)} -> ${NOMS[b] || b}`);
  }
  if (DETAIL) {
    console.log('\nDétail des offres changées :');
    for (const c of changements) console.log(`  [${c.pays}] ${c.avant} -> ${c.apres} | src=${c.src} | ${court(c.titre)}`);
  }
} else {
  console.log('\nAucun changement : la rubrique enregistrée est exactement celle du classement.');
}
