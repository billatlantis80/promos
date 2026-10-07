/**
 * MESURE DE L'UNITÉ A8 — VÊTEMENTS → MODE (chaussettes, sous-vêtements,
 * accessoires, et autres vêtements), en 9 langues.
 *
 * Deux classifieurs, un seul jeu d'offres : « avant » est le collecteur de
 * l'unité A7 (extrait du dépôt, `git show HEAD:collecteur.mjs`), « après » est
 * le collecteur de travail (A8). L'écart est donc exactement l'apport de A8.
 *
 * ⚠ AVANT de committer A8, HEAD désigne encore A7 : la commande reproduit
 *   l'écart mesuré. APRÈS le commit, HEAD vaut A8 et l'écart tombe à 0 — les
 *   chiffres de la session sont figés dans AUDIT-A8.md.
 *
 * Contrôle obligatoire du plan : les colonnes « ailleurs » des CHAUSSETTES et
 * des SOUS-VÊTEMENTS doivent tomber à ~0.
 *
 *   node outils/mesure-a8.mjs            # tableau avant/après + contrôle
 *   node outils/mesure-a8.mjs --cas      # cite nommément chaque offre déplacée
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classerOffre as apres, sansAccents } from '../collecteur.mjs';

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
const bas = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
const contient = (t, m) => new RegExp('(^|[^a-z0-9])' + m + '([^a-z0-9]|$)').test(t);

// Groupes du contrôle (mêmes mots que outils/audit-vetements.mjs).
const GROUPES = {
  chaussette: ['chaussette', 'chaussettes', 'sock', 'socks', 'socken', 'sokken', 'calcetin', 'calcetines', 'calzino', 'calzini', 'meia', 'meias', 'skarpet', 'skarpetki', 'strumpa', 'strumpor'],
  sousvetement: ['calecon', 'calecons', 'slip', 'boxer', 'boxers', 'trunks', 'collant', 'collants', 'unterhose', 'unterwasche', 'underwear', 'onderbroek', 'panty', 'mutande', 'cueca', 'cuecas', 'majtki', 'bokserski', 'underklader'],
  accessoire: ['echarpe', 'casquette', 'bonnet', 'gant', 'gants', 'ceinture', 'scarf', 'glove', 'gloves', 'handschuh', 'muetze', 'handschuhe', 'sjaal', 'want', 'guante', 'guantes', 'gorro', 'gorra', 'sciarpa', 'cappello', 'guanti', 'luva', 'luvas', 'touca', 'szalik', 'czapka', 'rekawiczki', 'halsduk', 'mossa', 'vantar'],
  vetement: ['jupe', 'short', 'maillot', 'pyjama', 't-shirt', 'tee-shirt', 'sweat', 'blouson', 'veste', 'sandale', 'sandales', 'claquette', 'kimono', 'skirt', 'shorts', 'swimsuit', 'pyjamas', 'hoodie', 'sweatshirt', 'vest', 'slipper', 'falda', 'gorra', 'sweter', 'bluza', 'kurtka'],
};

const compteAvant = new Map();
const compteApres = new Map();
const transitions = new Map();
const versMode = [];
const horsMode = [];
let stockeDiverge = 0;

for (const o of offres) {
  const a = avant(o);
  const b = apres(o);
  if ((o.categorie || 'autre') !== b) stockeDiverge++;
  compteAvant.set(a, (compteAvant.get(a) || 0) + 1);
  compteApres.set(b, (compteApres.get(b) || 0) + 1);
  if (a !== b) {
    transitions.set(`${a} → ${b}`, (transitions.get(`${a} → ${b}`) || 0) + 1);
    const ligne = { a, b, t: String(o.titre).replace(/<[^>]+>/g, '').slice(0, 94), pays: o.pays, src: o.categorieSource };
    if (b === 'mode') versMode.push(ligne);
    if (a === 'mode') horsMode.push(ligne);
  }
}

const total = offres.length;
console.log(`offres publiées : ${total}   (genereLe ${d.genereLe || '?'})`);
console.log(`« avant » : ${fichierAvant}`);
console.log(`rubrique stockée != rejeu « après » : ${stockeDiverge}  (doit être 0)`);

console.log('\n— CONTRÔLE OBLIGATOIRE : « ailleurs qu\'en Mode » —');
const t = (o) => bas(o);
for (const [groupe, mots] of Object.entries(GROUPES)) {
  const touchees = offres.filter((o) => mots.some((m) => contient(t(o), m)));
  const av = touchees.filter((o) => avant(o) !== 'mode').length;
  const ap = touchees.filter((o) => apres(o) !== 'mode').length;
  console.log(`  ${groupe.padEnd(13)} touchées ${String(touchees.length).padStart(4)}   ailleurs AVANT ${String(av).padStart(3)} → APRÈS ${String(ap).padStart(3)}`);
  if (AVEC_CAS && ap) {
    for (const o of touchees.filter((x) => apres(x) !== 'mode')) console.log(`      restent [${apres(o)}] (${o.src}) « ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 80)} »`);
  }
}

console.log('\n— répartition APRÈS (rejouée) —');
for (const [f, n] of [...compteApres.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${f}`);

console.log('\n— transitions (avant → après) —');
if (!transitions.size) console.log('  (aucune)');
for (const [k, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);

if (AVEC_CAS) {
  console.log(`\n— ENTRÉES en Mode (${versMode.length}) —`);
  for (const s of versMode) console.log(`  [${s.pays}/${s.src}] ${s.a} → Mode  « ${s.t} »`);
  console.log(`\n— SORTIES de Mode (${horsMode.length}) — régression à surveiller`);
  for (const s of horsMode) console.log(`  [${s.pays}/${s.src}] Mode → ${s.b}  « ${s.t} »`);
}
