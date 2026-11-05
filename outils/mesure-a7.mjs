/**
 * MESURE DE L'UNITÉ A7 — AUDIT DE « AUTRES ».
 *
 * Deux classifieurs, un seul jeu d'offres : « avant » est le collecteur de
 * l'unité A6, extrait du dépôt (`git show HEAD:collecteur.mjs`), « après » est
 * le collecteur de travail (A7). L'écart est donc exactement l'apport de A7,
 * offerte par offre — les deux lisent le MÊME fichier publié.
 *
 * ⚠ AVANT de committer A7, HEAD désigne encore A6 : la commande reproduit donc
 *   l'écart mesuré. APRÈS le commit, HEAD vaut A7 et l'écart tombe à 0 — c'est
 *   correct (plus rien en attente) ; les chiffres de la session sont figés dans
 *   AUDIT-A7.md.
 *
 * Contrôle de base : la rubrique STOCKÉE (o.categorie) doit coïncider avec le
 * rejeu « après » (le collecteur de travail a produit la publication courante).
 * S'il y a un écart, c'est que la publication ne vient pas du code mesuré.
 *
 *   node outils/mesure-a7.mjs              # tableau avant/après + transitions
 *   node outils/mesure-a7.mjs --cas        # cite nommément les offres sorties
 *   node outils/mesure-a7.mjs --avant f.mjs# impose le fichier « avant »
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classerOffre as apres } from '../collecteur.mjs';

const AVEC_CAS = process.argv.includes('--cas');
const iAvant = process.argv.indexOf('--avant');
let fichierAvant = iAvant >= 0 ? process.argv[iAvant + 1] : null;
if (!fichierAvant) {
  const src = execFileSync('git', ['show', 'HEAD:collecteur.mjs'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  fichierAvant = path.join(os.tmpdir(), `promos-avant-${process.pid}.mjs`);
  fs.writeFileSync(fichierAvant, src);
}
const { classerOffre: avant } = await import(pathToFileURL(path.resolve(fichierAvant)).href);

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;

const compteAvant = new Map();
const compteApres = new Map();
const transitions = new Map();
const sorties = [];
const entrees = [];
let stockeDiverge = 0;

for (const o of offres) {
  const a = avant(o);
  const b = apres(o);
  const stocke = o.categorie || 'autre';
  if (stocke !== b) stockeDiverge++;
  compteAvant.set(a, (compteAvant.get(a) || 0) + 1);
  compteApres.set(b, (compteApres.get(b) || 0) + 1);
  if (a !== b) {
    const cle = `${a} → ${b}`;
    transitions.set(cle, (transitions.get(cle) || 0) + 1);
    if (a === 'autre') sorties.push({ b, t: String(o.titre).slice(0, 96), pays: o.pays, src: o.categorieSource });
    else if (b === 'autre') entrees.push({ a, t: String(o.titre).slice(0, 96), pays: o.pays, src: o.categorieSource });
  }
}

const total = offres.length;
const pc = (n) => `${((n / total) * 100).toFixed(1)} %`;
console.log(`offres publiées : ${total}   (genereLe ${d.genereLe || '?'})`);
console.log(`« avant » : ${fichierAvant}`);
console.log(`rubrique stockée != rejeu « après » : ${stockeDiverge}  (doit être 0)`);

console.log('\n— « Autres » —');
console.log(`  AVANT (A6) : ${compteAvant.get('autre') || 0}  (${pc(compteAvant.get('autre') || 0)})`);
console.log(`  APRÈS (A7) : ${compteApres.get('autre') || 0}  (${pc(compteApres.get('autre') || 0)})`);
console.log(`  écart      : ${(compteApres.get('autre') || 0) - (compteAvant.get('autre') || 0)}`);

console.log('\n— répartition APRÈS (rejouée) —');
for (const [f, n] of [...compteApres.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${f}`);

console.log('\n— transitions (avant → après) —');
if (!transitions.size) console.log('  (aucune)');
for (const [k, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);

if (AVEC_CAS) {
  console.log(`\n— SORTIES d'« Autres » (${sorties.length}) —`);
  for (const s of sorties) console.log(`  [${s.pays}/${s.src}] → ${s.b}  « ${s.t} »`);
  console.log(`\n— ENTRÉES dans « Autres » (${entrees.length}) — régression à surveiller`);
  for (const s of entrees) console.log(`  [${s.pays}/${s.src}] ${s.a} →  « ${s.t} »`);
}
