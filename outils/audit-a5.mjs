/**
 * AUDIT A5 — VÉRIFIER les autres rubriques (tech, maison, mode, beauté, sport,
 * auto) : CONTRADICTIONS SOURCE/TITRE.
 *
 * Unité A5 du PLAN-NUIT.md : « Vérifier les autres rubriques (tech, maison,
 * mode, beauté, sport, auto) : contradictions source/titre ». Même esprit que
 * A3/A4 : c'est un CONSTAT (la correction est A6), on MESURE et on CITE.
 *
 * Deux questions :
 *  1. COHÉRENCE : la rubrique enregistrée est-elle exactement celle que
 *     `classerOffre` produirait aujourd'hui ? (0 écart = données à jour.)
 *  2. CONTRADICTION source/titre : la rubrique de la SOURCE (un rayon nommé)
 *     désigne une famille A, mais le TITRE désigne une famille B ≠ A. On lit
 *     les mots comme le classement (tables importées, frontières respectées) :
 *     le « produit nommé » (MOTS_FORTS) tranche, sinon le meilleur mot faible.
 *
 * Usage : node outils/audit-a5.mjs [--fichier docs/offres.json] [--detail]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classerOffre, FAMILLES, MARQUES, MOTS_FORTS, categorieDeSource,
  sansAccents, sansNegations, compterMots, retirerTrompeurs, ageEnfant, exigeFrontiere,
} from '../collecteur.mjs';

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
const CIBLES = ['tech', 'maison', 'mode', 'beaute', 'sport', 'auto'];

const norm = (t) => retirerTrompeurs(sansNegations(sansAccents(String(t || '')).toLowerCase()));
const court = (s, n = 76) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

const FORTS = Object.fromEntries(Object.entries(MOTS_FORTS).map(([f, mots]) =>
  [f, mots.map((m) => sansAccents(m).toLowerCase())]));
const FAIBLES = Object.fromEntries(Object.entries(FAMILLES).map(([f, mots]) =>
  [f, mots.map((m) => sansAccents(m).toLowerCase())]));

const present = (m, t) => (exigeFrontiere(m)
  ? new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i').test(t)
  : t.includes(m));
const motsTrouves = (liste, t) => liste.filter((m) => present(m, t));
const poidsFort = (fam, trouves, t) => trouves.reduce((a, m) => a + Math.max(3, m.length), 0)
  + (fam === 'jouets' && ageEnfant(t) ? 6 : 0);
function motFortGagnant(t) {
  let choisie = null, score = 0;
  for (const [fam, mots] of Object.entries(FORTS)) {
    const poids = poidsFort(fam, motsTrouves(mots, t), t);
    if (poids > score) { score = poids; choisie = fam; }
  }
  return choisie;
}
function meilleurFaible(t) {
  let choisie = null, score = 0;
  for (const [fam, mots] of Object.entries(FAIBLES)) {
    const n = compterMots(mots, t);
    if (n > score) { score = n; choisie = fam; }
  }
  return choisie;
}

let incoherentes = 0;
const parRubrique = new Map();   // rec -> {n, coherence, contradictions:[...], parType}
const contradictions = [];

for (const o of offres) {
  const rec = o.categorie || 'autre';
  if (classerOffre(o) !== rec) incoherentes++;
  if (!CIBLES.includes(rec)) continue;
  const t = norm(o.titre);
  const srcFam = categorieDeSource(o.categorieSource);
  const fort = motFortGagnant(t);
  const faible = meilleurFaible(t);
  const titreFam = fort || (faible && faible !== 'autre' ? faible : null);
  const st = parRubrique.get(rec) || { n: 0, contradictionForte: 0, contradictionFaible: 0, ex: [] };
  st.n++;
  // Contradiction = la source est une VRAIE rubrique nommée, et le titre dit
  // une AUTRE famille. On distingue le produit nommé (fort) du simple mot faible.
  if (srcFam && srcFam !== 'autre' && titreFam && titreFam !== srcFam) {
    const type = fort ? 'forte' : 'faible';
    if (type === 'forte') st.contradictionForte++; else st.contradictionFaible++;
    const rec2 = { o, rec, srcFam, titreFam, fort, faible, type };
    contradictions.push(rec2);
    if (st.ex.length < 30) st.ex.push(rec2);
  }
  parRubrique.set(rec, st);
}

if (DETAIL) {
  for (const c of contradictions)
    console.log(`[${c.o.pays}] ${NOMS[c.rec]} <= src=${NOMS[c.srcFam]} | titre=${NOMS[c.titreFam]} (${c.type}) | ${court(c.o.titre, 84)}`);
  console.log(`# TOTAL contradictions : ${contradictions.length}`);
  process.exit(0);
}

console.log('AUDIT A5 — AUTRES RUBRIQUES (tech, maison, mode, beauté, sport, auto)');
console.log(`  fichier   : ${path.relative(RACINE, fichier)}`);
console.log(`  genereLe  : ${donnees.genereLe || '?'}`);
console.log(`  offres    : ${offres.length}`);
console.log(`  cohérence enregistrée/calculée : ${incoherentes} écart(s)`);
console.log('');

let totalC = 0, totalCF = 0, totalCf = 0;
for (const c of CIBLES) {
  const st = parRubrique.get(c) || { n: 0, contradictionForte: 0, contradictionFaible: 0 };
  totalC += st.contradictionForte + st.contradictionFaible;
  totalCF += st.contradictionForte; totalCf += st.contradictionFaible;
  console.log(`  ${NOMS[c].padEnd(14)} ${String(st.n).padStart(5)} offres · contradictions source/titre : ${st.contradictionForte} (produit nommé) + ${st.contradictionFaible} (mot faible)`);
}
console.log(`  TOTAL contradictions : ${totalC}  (dont ${totalCF} produit nommé / ${totalCf} mot faible)`);
console.log('');

for (const c of CIBLES) {
  const st = parRubrique.get(c);
  if (!st || !st.ex.length) continue;
  console.log(`— ${NOMS[c]} : contradictions source/titre (extraits) —`);
  for (const { o, srcFam, titreFam, fort, faible, type } of st.ex)
    console.log(`  [${o.pays}] src=${NOMS[srcFam]} titre=${NOMS[titreFam]} (${type}${fort ? ':' + NOMS[fort] : ':faible=' + NOMS[faible]}) « ${court(o.titre, 64)} »`);
  console.log('');
}
