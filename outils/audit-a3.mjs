/**
 * AUDIT A3 — VÉRIFIER « JEUX & JOUETS ».
 *
 * Unité A3 du PLAN-NUIT.md : « Vérifier jouets : toutes les offres de la
 * rubrique, citer celles qui n'y ont pas leur place et l'inverse ».
 *
 * Ce n'est PAS un correctif (comme A1/A2) : on MESURE et on CITE, on ne touche
 * à rien. L'outil lit le site PUBLIÉ (docs/offres.json), pas l'intermédiaire.
 *
 * Il répond à trois questions, dans cet ordre :
 *
 *   1. DE QUOI la rubrique est faite — combien d'offres jouets, et par quel
 *      MOTIF chacune y est (nom de jouet, mot d'enfant / plage d'âge, marque,
 *      rubrique de la source, mot faible). Un motif unique qui porterait toute
 *      la rubrique serait un signal d'alarme ; on le voit ici.
 *
 *   2. FAUX POSITIFS — des offres rangées en jouets qui n'y ont PAS leur place.
 *      Deux familles de cas, citées nommément :
 *        • un PRODUIT d'une autre famille est nommé plus précisément que le mot
 *          de jouet (« vélo enfant », « montre enfant », « siège auto enfant ») ;
 *        • l'offre n'est portée QUE par un mot d'enfant / une plage d'âge, sans
 *          aucun nom de jouet — c'est la « casse » mesurée en E4.
 *
 *   3. FAUX NÉGATIFS — des offres qui devraient être en jouets et n'y sont pas :
 *      titres contenant un nom de jouet ou un mot d'enfant, rangés ailleurs.
 *
 * La règle de lecture est EXACTEMENT celle du collecteur : mêmes tables
 * (importées, jamais recopiées pour les mots de jouet) et mêmes frontières
 * (MOTS_A_FRONTIERE / exigeFrontiere). Un contrôle plus laxiste fabriquerait
 * de faux défauts.
 *
 * Usage :
 *   node outils/audit-a3.mjs [--fichier docs/offres.json] [--detail]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classerOffre, FAMILLES, MARQUES, MOTS_FORTS, categorieDeSource,
  sansAccents, sansNegations, compterMots, retirerTrompeurs, ageEnfant,
  estJeuNumerique, MOTS_A_FRONTIERE, exigeFrontiere,
} from '../collecteur.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(__dirname, '..');

const arg = (nom, defaut) => {
  const i = process.argv.indexOf('--' + nom);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
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

const norm = (t) => retirerTrompeurs(sansNegations(sansAccents(String(t || '')).toLowerCase()));
const court = (s, n = 78) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

// Tables normalisées, EXACTEMENT celles du classement.
const FORTS = Object.fromEntries(Object.entries(MOTS_FORTS).map(([f, mots]) =>
  [f, mots.map((m) => sansAccents(m).toLowerCase())]));
const FAIBLES = Object.fromEntries(Object.entries(FAMILLES).map(([f, mots]) =>
  [f, mots.map((m) => sansAccents(m).toLowerCase())]));
const MARQ = Object.fromEntries(Object.entries(MARQUES).map(([f, mots]) =>
  [f, mots.map((m) => sansAccents(m).toLowerCase())]));

const present = (m, t) => (exigeFrontiere(m)
  ? new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i').test(t)
  : t.includes(m));
const motsTrouves = (liste, t) => liste.filter((m) => present(m, t));

// Le produit NOMMÉ qui gagne, comme familleParMotFort (longueur totale + âge).
function motFortGagnant(t) {
  let choisie = null, score = 0;
  for (const [fam, mots] of Object.entries(FORTS)) {
    const trouves = motsTrouves(mots, t);
    const poids = trouves.reduce((a, m) => a + Math.max(3, m.length), 0)
      + (fam === 'jouets' && ageEnfant(t) ? 6 : 0);
    if (poids > score) { score = poids; choisie = fam; }
  }
  return choisie;
}

const MOTS_ENFANT = [...new Set([
  'fille', 'fillettes', 'garcon', 'garcons', 'enfant', 'enfants',
  'girl', 'girls', 'boy', 'boys', 'child', 'children', 'kid', 'kids',
  'madchen', 'junge', 'jungen', 'kinder', 'kindern',
  'meisje', 'meisjes', 'jongen', 'jongens', 'kinderen',
  'nina', 'ninas', 'nino', 'ninos', 'chica', 'chico', 'chicos',
  'bambina', 'bambine', 'bambino', 'bambini', 'ragazza', 'ragazze', 'ragazzo', 'ragazzi',
  'menina', 'meninas', 'menino', 'meninos', 'crianca', 'criancas',
  'dziewczynka', 'dziewczynki', 'chlopiec', 'chlopcy', 'dziecko', 'dzieci',
  'flicka', 'flickor', 'pojke', 'pojkar', 'barn', 'barnen',
])].map((m) => sansAccents(m).toLowerCase());
const NOMS_JOUET = FORTS.jouets.filter((m) => !MOTS_ENFANT.includes(m));

// ----- Parcours -----------------------------------------------------------
let incoherentes = 0;
const jouets = [];
const fnCandidats = [];   // hors jouets, portant un nom de jouet ou d'enfant
const parMotif = new Map();
const fpAppareil = [];    // jouets mais un produit d'une autre famille est nommé
const fpEnfantSeul = [];  // jouets portés SEULEMENT par un mot d'enfant / âge

for (const o of offres) {
  const c = o.categorie || 'autre';
  if (classerOffre(o) !== c) incoherentes++;
  const t = norm(o.titre);
  const forts = Object.fromEntries(Object.entries(FORTS).map(([f, mots]) => [f, motsTrouves(mots, t)]));
  const nomJouet = forts.jouets.filter((m) => !MOTS_ENFANT.includes(m));
  const motEnfant = forts.jouets.some((m) => MOTS_ENFANT.includes(m)) || ageEnfant(t);
  const marque = motsTrouves(MARQ.jouets || [], t);
  const gagnant = motFortGagnant(t);

  if (c === 'jouets') {
    // Motif d'appartenance, par ordre de force.
    let motif;
    if (gagnant === 'jouets' && nomJouet.length) motif = 'nom de jouet';
    else if (gagnant === 'jouets' && motEnfant) motif = 'mot d’enfant / âge';
    else if (marque.length) motif = 'marque de jouet';
    else if (categorieDeSource(o.categorieSource) === 'jouets') motif = 'rubrique de la source';
    else if (compterMots(FAIBLES.jouets || [], t)) motif = 'mot faible';
    else motif = 'sans motif lisible';
    parMotif.set(motif, (parMotif.get(motif) || 0) + 1);
    jouets.push({ o, t, motif, nomJouet, motEnfant, marque, forts, gagnant });

    // FAUX POSITIF 1 : un produit NOMMÉ d'une autre famille, plus long, cohabite.
    const concurrents = Object.entries(forts)
      .filter(([f, mots]) => f !== 'jouets' && mots.length)
      .map(([f, mots]) => [f, mots.reduce((a, m) => a + Math.max(3, m.length), 0)]);
    if (concurrents.length) fpAppareil.push({ o, t, motif, nomJouet, concurrents });
    // FAUX POSITIF 2 : aucun nom de jouet, seule une marque/l'âge/une source.
    if (!nomJouet.length && !marque.length) {
      // Ce qui PORTE réellement l'offre, en clair : le mot faible de jouets
      // trouvé, et la meilleure famille concurrente avec ses mots faibles.
      const faiblesJ = motsTrouves(FAIBLES.jouets || [], t);
      const concurrentsFaibles = Object.entries(FAIBLES)
        .filter(([f]) => f !== 'jouets')
        .map(([f, mots]) => [f, motsTrouves(mots, t)])
        .filter(([, mots]) => mots.length)
        .sort((a, b) => b[1].length - a[1].length);
      fpEnfantSeul.push({ o, t, motif, motEnfant, faiblesJ, concurrentsFaibles });
    }
  } else {
    if (nomJouet.length || forts.jouets.length || ageEnfant(t)) {
      fnCandidats.push({ o, t, c, mots: forts.jouets });
    }
  }
}

/* ------------------------------------------------------------------ */
if (DETAIL) {
  console.log('# TOUTES les offres de la rubrique JOUETS');
  for (const j of jouets) {
    console.log(`[${j.o.pays}] ${j.motif.padEnd(22)} t="${j.t.slice(0, 30)}" ${j.motif} | ${j.nomJouet.join(',') || j.forts.jouets.join(',')} | ${court(j.o.titre, 80)}`);
  }
  console.log(`# TOTAL jouets : ${jouets.length}`);
  process.exit(0);
}

console.log(`AUDIT A3 — JEUX & JOUETS`);
console.log(`  fichier   : ${path.relative(RACINE, fichier)}`);
console.log(`  genereLe  : ${donnees.genereLe || '?'}`);
console.log(`  offres    : ${offres.length}`);
console.log(`  jouets    : ${jouets.length}   (cohérence enregistrée/calculée : ${incoherentes} écart(s))`);
console.log('');

console.log('— DE QUOI LA RUBRIQUE EST FAITE (motif d’appartenance) —');
for (const [m, n] of [...parMotif].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${m}`);
console.log('');

console.log('— FAUX POSITIFS, famille 1 : un PRODUIT d’une autre famille est NOMMÉ —');
console.log(`  total : ${fpAppareil.length}`);
for (const { o, motif, nomJouet, concurrents } of fpAppareil.slice(0, 80)) {
  const c = concurrents.map(([f, p]) => `${NOMS[f]}:${p}`).join(' ');
  console.log(`  [${o.pays}] ${court(o.titre, 74)}`);
  console.log(`        motif=${motif}  jouet=[${nomJouet.join(',') || '—'}]  concurrents=[${c}]`);
}
console.log('');

console.log('— FAUX POSITIFS, famille 2 : AUCUN nom de jouet (âge/enfant/marque seule) —');
console.log(`  total : ${fpEnfantSeul.length}`);
// Ce qui les porte : répartir par « porteur » (mot faible jouets + source).
const parPorteur = new Map();
for (const f of fpEnfantSeul) {
  const p = f.motif === 'mot faible' ? `faible:${f.faiblesJ.join('+') || '—'}`
    : f.motif === 'rubrique de la source' ? 'source (rubrique jouets)'
    : f.motif;
  parPorteur.set(p, (parPorteur.get(p) || 0) + 1);
}
for (const [p, n] of [...parPorteur].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${p}`);
console.log('');
for (const { o, motif, motEnfant, faiblesJ, concurrentsFaibles } of fpEnfantSeul.slice(0, 60)) {
  const autres = concurrentsFaibles.length ? concurrentsFaibles[0] : null;
  console.log(`  [${o.pays}] ${motif.padEnd(20)} ${court(o.titre, 70)}`);
  console.log(`        porteurs jouets=[${faiblesJ.join(',') || '—'}]  enfant=${motEnfant}` +
    (autres ? `  autre=${NOMS[autres[0]]}[${autres[1].join(',')}]` : ''));
}
console.log('');

console.log('— FAUX NÉGATIFS : hors jouets, portant un nom de jouet ou un mot d’enfant —');
console.log(`  total : ${fnCandidats.length}`);
const parCat = new Map();
for (const f of fnCandidats) parCat.set(f.c, (parCat.get(f.c) || 0) + 1);
console.log('  par rubrique : ' + [...parCat].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${NOMS[f]} ${n}`).join(' · '));
for (const { o, c, mots } of fnCandidats.slice(0, 80))
  console.log(`  [${o.pays}] ${NOMS[c].padEnd(14)} « ${court(o.titre, 66)} »  (mots : ${mots.join(', ')})`);
console.log('');
