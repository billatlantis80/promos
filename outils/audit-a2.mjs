/**
 * AUDIT A2 — RÉPARTITION PAR FAMILLE ET PAR PAYS + OFF RES SANS PREUVE.
 *
 * Unité A2 du PLAN-NUIT.md : « Répartition par famille ET par pays sur les
 * données publiées ; lister les offres sans preuve (ni source ni titre). »
 *
 * Ce n'est PAS un correctif (comme A1) : on MESURE et on LISTE, on ne touche
 * à rien. L'outil lit le site PUBLIÉ (docs/offres.json, ce que voit le
 * lecteur), pas l'intermédiaire de collecte.
 *
 * Ce qu'il fait, en quatre temps :
 *
 *   1. COHÉRENCE — il rejoue `classerOffre()` (importée du collecteur, jamais
 *      recopiée) sur chaque offre publiée et compte celles dont la rubrique
 *      enregistrée ne correspond plus au calcul (offres « périmées »).
 *
 *   2. RÉPARTITION PAR FAMILLE — dans l'ORDRE DES ONGLETS, jamais trié par
 *      nombre (un tri par nombre masquerait une rubrique à zéro).
 *
 *   3. MATRICE FAMILLE × PAYS — le croisement qui manquait : pour chaque pays,
 *      ce que contient chaque famille, et les cases VIDES NOMMÉES.
 *
 *   4. OFFRES SANS PREUVE (ni source ni titre) — la liste demandée :
 *      • une offre rangée dans une VRAIE famille (hors « autre ») que ni son
 *        titre ni sa source ne justifient est une erreur de classement ;
 *      • une offre en « autre » que ni son titre ni sa source ne justifient est
 *        un « autre PAR ÉCHEC » (le gisement de A7).
 *      La règle de preuve est EXACTEMENT celle du vérificateur
 *      (outils/verificateur-categories.mjs) : mêmes tables, mêmes fonctions,
 *      mêmes exceptions (jeu numérique, soin, plage d'âge, repas dehors,
 *      voyage géographique, rubrique imposée). Un contrôle plus laxiste ou plus
 *      strict que le classement fabriquerait de faux défauts.
 *
 * Usage :
 *   node outils/audit-a2.mjs [--fichier docs/offres.json] [--exemples N]
 *   node outils/audit-a2.mjs --detail > AUDIT-A2-sans-preuve.txt   (liste brute)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classerOffre, famille, FAMILLES, MARQUES, MOTS_FORTS, categorieDeSource,
  sansAccents, sansNegations, compterMots, estJeuNumerique, estSoin, ageEnfant,
  retirerTrompeurs, estRepasDehors, preuveEpicerie, destinationEtrangere,
  estForfaitVoyage,
} from '../collecteur.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(__dirname, '..');

const arg = (nom, defaut) => {
  const i = process.argv.indexOf('--' + nom);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const DETAIL = process.argv.includes('--detail');
const EXEMPLES = Number(arg('exemples', 6));

let fichier = arg('fichier', '');
if (!fichier) {
  const publie = path.join(RACINE, 'docs', 'offres.json');
  const local = path.join(RACINE, 'data', 'offres.json');
  fichier = fs.existsSync(publie) ? publie : local;
}
const donnees = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const offres = Array.isArray(donnees) ? donnees : (donnees.offres || []);

// Ordre des onglets (E2). « autre » en dernier, comme dans l'interface.
const FAMILLES_ONGLETS = ['tech', 'electromenager', 'meubles', 'maison', 'mode', 'auto',
  'jouets', 'sport', 'bricolage', 'beaute', 'nourriture', 'animaux', 'voyages',
  'activite', 'autre'];
const NOMS = {
  tech: 'High-tech', electromenager: 'Électroménager', meubles: 'Meubles',
  maison: 'Maison', mode: 'Mode', auto: 'Auto & moto', jouets: 'Jeux & jouets',
  sport: 'Sport', bricolage: 'Bricolage', beaute: 'Beauté', nourriture: 'Nourriture',
  animaux: 'Animaux', voyages: 'Voyages', activite: 'Activité', autre: 'Autres',
};

// Toutes les preuves utilisables : EXACTEMENT les tables du classement.
const MOTS_TOUS = Object.fromEntries(
  Object.entries(FAMILLES).map(([f, mots]) => [
    f,
    [...mots, ...(MARQUES[f] || []), ...(MOTS_FORTS[f] || [])].map((m) => sansAccents(m).toLowerCase()),
  ]),
);

const cat = (o) => o.categorie || 'autre';
const court = (s, n = 60) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
const norm = (t) => retirerTrompeurs(sansNegations(sansAccents(String(t || '')).toLowerCase()));

/** Une offre a-t-elle une preuve de sa rubrique ? Même règle que le vérificateur. */
function preuve(o) {
  const c = cat(o);
  if (c === 'autre') return false; // pour « autre », la preuve se lit à part
  if (o.categorieImposee) return 'imposée';
  const t = norm(o.titre);
  const scores = Object.entries(MOTS_TOUS).map(([f, mots]) => [f, compterMots(mots, t)]);
  if (scores.some(([f, n]) => f === c && n > 0)) return 'titre';
  if (categorieDeSource(o.categorieSource) === c) return 'source';
  if (c === 'tech' && estJeuNumerique(t)) return 'numérique';
  if (c === 'beaute' && estSoin(o.titre)) return 'soin';
  if (c === 'jouets' && ageEnfant(t)) return 'âge';
  if (c === 'activite' && estRepasDehors(t) && !preuveEpicerie(t)) return 'repas dehors';
  if (c === 'voyages' && (estForfaitVoyage(t) || Boolean(destinationEtrangere(t, o.pays)))) return 'voyage';
  return null;
}

/** « Autre » PAR ÉCHEC : ni la source ni un mot-clé ne disent quoi que ce soit. */
function autreParEchec(o) {
  if (cat(o) !== 'autre') return false;
  if (categorieDeSource(o.categorieSource)) return false;
  const t = norm(o.titre);
  for (const mots of Object.values(MOTS_TOUS)) if (compterMots(mots, t)) return false;
  return true;
}

const lignes = [];
const sansPreuveVraie = [];   // rangées dans une vraie famille, aucune preuve
const autreEchec = [];        // en « autre », aucune preuve
let incoherentes = 0;

for (const o of offres) {
  const c = cat(o);
  const attendu = classerOffre(o);
  if (attendu !== c) incoherentes++;
  if (c !== 'autre') {
    if (!preuve(o)) sansPreuveVraie.push(o);
  } else if (autreParEchec(o)) {
    autreEchec.push(o);
  }
}

if (DETAIL) {
  // Liste brute, exhaustive — pour un fichier de travail, pas pour l'écran.
  console.log('# Offres rangées dans une vraie famille SANS aucune preuve (ni source ni titre)');
  for (const o of sansPreuveVraie) {
    console.log(`[${o.pays}] ${cat(o).padEnd(14)} ${court(o.titre, 90)}\t${o.marchand || o.source || ''}\t${o.lienMarchand || o.lienPage || ''}`);
  }
  console.log(`\n# TOTAL : ${sansPreuveVraie.length}`);
  console.log('\n# Offres en « Autres » PAR ÉCHEC (ni source ni titre)');
  for (const o of autreEchec) {
    console.log(`[${o.pays}] ${court(o.titre, 90)}\t${o.categorieSource || ''}\t${o.marchand || o.source || ''}`);
  }
  console.log(`\n# TOTAL : ${autreEchec.length}`);
  process.exit(0);
}

/* ------------------------------------------------------------------ */
console.log(`AUDIT A2 — ${offres.length} offres publiées`);
console.log(`  fichier    : ${path.relative(RACINE, fichier)}`);
console.log(`  genereLe   : ${donnees.genereLe || '?'}`);
console.log(`  cohérence  : ${incoherentes} offre(s) dont la rubrique enregistrée ne correspond plus au calcul`);
console.log('');

// 2. RÉPARTITION PAR FAMILLE (ordre des onglets).
const global = new Map(FAMILLES_ONGLETS.map((f) => [f, 0]));
const ex = new Map();
for (const o of offres) {
  global.set(cat(o), (global.get(cat(o)) || 0) + 1);
  if (!ex.has(cat(o))) ex.set(cat(o), court(o.titre, 52));
}
console.log('— RÉPARTITION PAR FAMILLE (ordre des onglets) —');
for (const f of FAMILLES_ONGLETS) {
  const n = global.get(f) || 0;
  const pct = (n / offres.length * 100).toFixed(1);
  console.log(`  ${String(n).padStart(5)}  ${pct.padStart(5)} %  ${NOMS[f].padEnd(14)} ${ex.get(f) ? '« ' + ex.get(f) + ' »' : ''}`);
}
console.log('');

// 3. MATRICE FAMILLE × PAYS.
const pays = [...new Set(offres.map((o) => o.pays || '?'))].sort();
const parPays = new Map(pays.map((p) => [p, new Map(FAMILLES_ONGLETS.map((f) => [f, 0]))]));
for (const o of offres) parPays.get(o.pays || '?').set(cat(o), (parPays.get(o.pays || '?').get(cat(o)) || 0) + 1);
console.log('— MATRICE FAMILLE × PAYS (effectifs) —');
const entete = ['pays/total', ...FAMILLES_ONGLETS.map((f) => NOMS[f].slice(0, 5))];
console.log('  ' + entete.map((s, i) => (i === 0 ? s.padEnd(10) : s.padStart(7))).join(''));
console.log('  ' + '-'.repeat(10 + 7 * FAMILLES_ONGLETS.length));
const vides = [];
for (const p of pays) {
  const m = parPays.get(p);
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  console.log('  ' + [String(total).padStart(4) + ' ' + p.padEnd(5),
    ...FAMILLES_ONGLETS.map((f) => (m.get(f) ? String(m.get(f)).padStart(7) : '      .'))].join(''));
  const v = FAMILLES_ONGLETS.filter((f) => !m.get(f));
  if (v.length) vides.push(`${p} : ${v.map((f) => NOMS[f]).join(', ')}`);
}
console.log('  (« . » = famille VIDE pour ce pays — nommée ci-dessous, jamais tue)');
console.log('');

// 4. OFFRES SANS PREUVE.
console.log('— OFFRES SANS PREUVE (ni source ni titre) —');
console.log(`  A. rangées dans une VRAIE famille sans aucune preuve : ${sansPreuveVraie.length}`);
for (const o of sansPreuveVraie.slice(0, EXEMPLES)) {
  console.log(`     [${o.pays}] ${cat(o).padEnd(12)} : ${court(o.titre, 68)}   (source : ${o.categorieSource || '—'})`);
}
const parFamilleSansPreuve = new Map();
for (const o of sansPreuveVraie) parFamilleSansPreuve.set(cat(o), (parFamilleSansPreuve.get(cat(o)) || 0) + 1);
if (parFamilleSansPreuve.size) {
  console.log('     par famille : ' + [...parFamilleSansPreuve].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${NOMS[f]} ${n}`).join(' · '));
}
console.log(`  B. en « Autres » PAR ÉCHEC (ni source ni titre) : ${autreEchec.length}`);
const parPaysEchec = new Map();
for (const o of autreEchec) parPaysEchec.set(o.pays || '?', (parPaysEchec.get(o.pays || '?') || 0) + 1);
console.log('     par pays : ' + [...parPaysEchec].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(' · '));
for (const o of autreEchec.slice(0, EXEMPLES)) {
  console.log(`     [${o.pays}] « ${court(o.titre, 66)} »   (source : ${o.categorieSource || '—'}, ${o.marchand || o.source || '—'})`);
}
const parEtiquette = new Map();
for (const o of autreEchec) parEtiquette.set(o.categorieSource || '(sans étiquette)', (parEtiquette.get(o.categorieSource || '(sans étiquette)') || 0) + 1);
console.log('     étiquettes de source portées par ces offres : ' +
  [...parEtiquette].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([e, n]) => `« ${e} » ${n}`).join(' · '));
console.log(`  TOTAL sans preuve : ${sansPreuveVraie.length + autreEchec.length}` +
  `  (dont ${sansPreuveVraie.length} mal rangées, ${autreEchec.length} en « Autres » par échec)`);
console.log('');

// 5. Taux d'échec par pays, classé (le gisement de A7).
const parPaysTotal = new Map();
for (const o of offres) parPaysTotal.set(o.pays || '?', (parPaysTotal.get(o.pays || '?') || 0) + 1);
console.log('— TAUX D\'ÉCHEC PAR PAYS (autre-par-échec / total du pays) —');
for (const [p, n] of [...parPaysEchec].sort((a, b) => (b[1] / parPaysTotal.get(b[0])) - (a[1] / parPaysTotal.get(a[0])))) {
  console.log(`  ${p.padEnd(4)} ${String(n).padStart(4)} / ${String(parPaysTotal.get(p)).padStart(4)}   ${(n / parPaysTotal.get(p) * 100).toFixed(0).padStart(3)} %`);
}
console.log('');

// 6. Cases vides nommées.
console.log('— FAMILLES VIDES, PAR PAYS (nommées, jamais tues) —');
if (!vides.length) console.log('  aucune');
for (const v of vides) console.log('  ' + v);
