/**
 * AUDIT A4 — VÉRIFIER « BRICOLAGE ».
 *
 * Unité A4 du PLAN-NUIT.md : « Vérifier bricolage : idem [que A3] ».
 *
 * Ce n'est PAS un correctif (la correction des faux positifs démontrés est
 * l'unité A6) : on MESURE et on CITE, on ne touche à rien. L'outil lit le site
 * PUBLIÉ (docs/offres.json), ce que voit le lecteur.
 *
 * Trois questions, comme A3 :
 *
 *   1. DE QUOI la rubrique est faite — combien d'offres bricolage, et par quel
 *      MOTIF chacune y est (produit nommé, rubrique de la source, mot faible de
 *      jardin/outillage…). Un motif unique portant toute la rubrique serait un
 *      signal d'alarme : on le voit ici.
 *
 *   2. FAUX POSITIFS — des offres rangées en bricolage qui n'y ont PAS leur place.
 *      Deux familles citées nommément :
 *        • un PRODUIT d'une autre famille est nommé (appareil électroménager —
 *          tondeuse à CHEVEUX, rasoir, etc. — ou meuble, tech…) ;
 *        • l'offre n'est portée QUE par un mot FAIBLE (« jardin », « peinture »,
 *          « scie »…) sans aucun produit de bricolage nommé ni rayon de source.
 *
 *   3. FAUX NÉGATIFS — des offres qui devraient être en bricolage et n'y sont
 *      pas : titre portant un PRODUIT de bricolage nommé (tondeuse à gazon,
 *      perceuse, lawnmower…), rangé ailleurs.
 *
 * ⚠ Contrôles E1 rappelés (point 12/13) : une « tondeuse à gazon » doit être en
 * bricolage, une « tondeuse à cheveux » en Électroménager. On les compte ici.
 *
 * La règle de lecture est EXACTEMENT celle du collecteur : mêmes tables
 * (importées, jamais recopiées) et mêmes frontières (MOTS_A_FRONTIERE /
 * exigeFrontiere). Un contrôle plus laxiste fabriquerait de faux défauts.
 *
 * Usage :
 *   node outils/audit-a4.mjs [--fichier docs/offres.json] [--detail]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classerOffre, FAMILLES, MARQUES, MOTS_FORTS, categorieDeSource,
  sansAccents, sansNegations, compterMots, retirerTrompeurs, ageEnfant,
  estJeuNumerique, exigeFrontiere,
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
/** Vrai si `m` est un MOT ENTIER dans `t` (entre deux frontières), faux si c'est
 *  seulement une SOUS-CHAÎNE d'un autre mot — « brico » dans « inalámbricos »,
 *  « pila » dans « depilación », « scie » dans « ściemniana ». */
const motEntier = (m, t) => new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i').test(t);
/** Le contexte (mot réel) qui contient la sous-chaîne `m`, pour citer le cas. */
function motPorteur(m, t) {
  const i = t.indexOf(m);
  if (i < 0) return null;
  let d = i, f = i + m.length;
  while (d > 0 && /[a-z0-9à-ÿ]/.test(t[d - 1])) d--;
  while (f < t.length && /[a-z0-9à-ÿ]/.test(t[f])) f++;
  return t.slice(d, f);
}

// Le produit NOMMÉ qui gagne : longueur totale des mots, comme familleParMotFort.
function poidsFort(fam, trouves, t) {
  return trouves.reduce((a, m) => a + Math.max(3, m.length), 0)
    + (fam === 'jouets' && ageEnfant(t) ? 6 : 0);
}
function motFortGagnant(t) {
  let choisie = null, score = 0;
  for (const [fam, mots] of Object.entries(FORTS)) {
    const trouves = motsTrouves(mots, t);
    const poids = poidsFort(fam, trouves, t);
    if (poids > score) { score = poids; choisie = fam; }
  }
  return choisie;
}

// ----- Parcours -----------------------------------------------------------
let incoherentes = 0;
const bricolages = [];
const fnForts = [];       // hors bricolage, portant un PRODUIT bricolage nommé
const fnFaibles = [];     // hors bricolage, portant un mot faible bricolage
const parMotif = new Map();
const fpAppareil = [];    // en bricolage mais un produit d'une autre famille nommé
const fpFaibleSeul = [];  // en bricolage sans produit fort ni source forte

for (const o of offres) {
  const c = o.categorie || 'autre';
  if (classerOffre(o) !== c) incoherentes++;
  const t = norm(o.titre);
  const forts = Object.fromEntries(Object.entries(FORTS).map(([f, mots]) => [f, motsTrouves(mots, t)]));
  const faibles = Object.fromEntries(Object.entries(FAIBLES).map(([f, mots]) => [f, motsTrouves(mots, t)]));
  const produitBricolage = forts.bricolage || [];
  const marque = motsTrouves(MARQ.bricolage || [], t);
  const gagnant = motFortGagnant(t);
  const sourceFam = categorieDeSource(o.categorieSource);

  if (c === 'bricolage') {
    let motif;
    if (gagnant === 'bricolage' && produitBricolage.length) motif = 'produit de bricolage nommé';
    else if (marque.length) motif = 'marque de bricolage';
    else if (sourceFam === 'bricolage') motif = 'rubrique de la source';
    else if (compterMots(FAIBLES.bricolage || [], t)) motif = 'mot faible';
    else motif = 'sans motif lisible';
    parMotif.set(motif, (parMotif.get(motif) || 0) + 1);
    bricolages.push({ o, t, motif, produitBricolage, forts, gagnant, sourceFam, marque });

    // FAUX POSITIF 1 : un PRODUIT NOMMÉ d'une autre famille, gagnant, cohabite.
    const concurrents = Object.entries(forts)
      .filter(([f, mots]) => f !== 'bricolage' && mots.length)
      .map(([f, mots]) => [f, poidsFort(f, mots, t)]);
    const autreGagnant = gagnant && gagnant !== 'bricolage';
    if (autreGagnant || concurrents.length) fpAppareil.push({ o, t, motif, produitBricolage, concurrents, gagnant });
    // FAUX POSITIF 2 : ni produit fort de bricolage, ni marque, ni rayon de source.
    if (!produitBricolage.length && !marque.length && sourceFam !== 'bricolage') {
      const concurrentsForts = Object.entries(forts)
        .filter(([f, mots]) => f !== 'bricolage' && mots.length)
        .map(([f, mots]) => [f, mots]);
      fpFaibleSeul.push({ o, t, motif, faiblesB: faibles.bricolage || [], concurrentsForts });
    }
  } else {
    if (produitBricolage.length) fnForts.push({ o, t, c, mots: produitBricolage });
    else if ((faibles.bricolage || []).length) fnFaibles.push({ o, t, c, mots: faibles.bricolage });
  }
}

/* ------------------------------------------------------------------ */
if (DETAIL) {
  console.log('# TOUTES les offres de la rubrique BRICOLAGE');
  for (const b of bricolages) {
    console.log(`[${b.o.pays}] ${b.motif.padEnd(26)} | ${b.produitBricolage.join(',') || b.forts.bricolage.join(',')} | ${court(b.o.titre, 80)}`);
  }
  console.log(`# TOTAL bricolage : ${bricolages.length}`);
  process.exit(0);
}

console.log(`AUDIT A4 — BRICOLAGE`);
console.log(`  fichier   : ${path.relative(RACINE, fichier)}`);
console.log(`  genereLe  : ${donnees.genereLe || '?'}`);
console.log(`  offres    : ${offres.length}`);
console.log(`  bricolage : ${bricolages.length}   (cohérence enregistrée/calculée : ${incoherentes} écart(s))`);
console.log('');

console.log('— DE QUOI LA RUBRIQUE EST FAITE (motif d’appartenance) —');
for (const [m, n] of [...parMotif].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${m}`);
console.log('');

console.log('— FAUX POSITIFS, famille 1 : un PRODUIT (ou un gagnant) d’une autre famille —');
console.log(`  total : ${fpAppareil.length}`);
for (const { o, motif, produitBricolage, concurrents, gagnant } of fpAppareil.slice(0, 120)) {
  const c = concurrents.map(([f, p]) => `${NOMS[f]}:${p}`).join(' ');
  console.log(`  [${o.pays}] ${court(o.titre, 74)}`);
  console.log(`        motif=${motif}  gagnant=${NOMS[gagnant] || '—'}  bricolage=[${produitBricolage.join(',') || '—'}]  concurrents=[${c}]`);
}
console.log('');

console.log('— FAUX POSITIFS, famille 2 : AUCUN produit de bricolage, ni rayon de source —');
console.log(`  total : ${fpFaibleSeul.length}`);
const parPorteur = new Map();
for (const f of fpFaibleSeul) {
  const p = f.motif === 'mot faible' ? `faible:${f.faiblesB.join('+') || '—'}` : f.motif;
  parPorteur.set(p, (parPorteur.get(p) || 0) + 1);
}
for (const [p, n] of [...parPorteur].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${p}`);
console.log('');
for (const { o, motif, faiblesB, concurrentsForts } of fpFaibleSeul.slice(0, 80)) {
  const autre = concurrentsForts.length ? concurrentsForts[0] : null;
  const anc = faiblesB.map((m) => (motEntier(m, o.t) ? m : `${m}⊂${motPorteur(m, norm(o.titre))}`)).join(',');
  console.log(`  [${o.pays}] ${motif.padEnd(22)} ${court(o.titre, 70)}`);
  console.log(`        faibles bricolage=[${anc || '—'}]` +
    (autre ? `  autre fort=${NOMS[autre[0]]}[${autre[1].join(',')}]` : ''));
}
console.log('');

// Sous-chaînes pures : le mot faible n'est PAS un mot entier — « brico » dans
// « inalámbricos », « pila » dans « depilación/empilables », « scie » dans
// « ściemniana/ścienny ». C'est le défaut mesuré récurrent.
const sousChaines = [];
const collecteSous = (liste, sens) => {
  for (const e of liste) {
    const mots = e.faiblesB || e.mots || [];
    const purs = mots.filter((m) => !motEntier(m, e.t));
    if (purs.length && purs.length === mots.length) sousChaines.push({ sens, o: e.o, mots: purs, contexte: purs.map((m) => motPorteur(m, e.t)).join(',') });
  }
};
collecteSous(fpFaibleSeul, 'fp');
collecteSous(fnFaibles, 'fn');
const sousFP = sousChaines.filter((s) => s.sens === 'fp');
const sousFN = sousChaines.filter((s) => s.sens === 'fn');
console.log('— SOUS-CHAÎNES PURES (mot faible lu DANS un autre mot) —');
console.log(`  total : ${sousChaines.length}  (dont EN bricolage : ${sousFP.length} — défauts ; HORS bricolage : ${sousFN.length} — bruit, l’offre est bien classée) `);
console.log('  — défauts (offre EN bricolage sur une sous-chaîne) —');
for (const { o, mots, contexte } of sousFP)
  console.log(`  [${o.pays}] ${mots.join(',')} ⊂ « ${contexte} »  —  ${court(o.titre, 62)}`);
console.log('  — bruit (offre HORS bricolage, correctement classée) —');
for (const { o, mots, contexte } of sousFN.slice(0, 30))
  console.log(`  [${o.pays}] ${mots.join(',')} ⊂ « ${contexte} »  —  ${court(o.titre, 62)}`);
console.log('');

console.log('— FAUX NÉGATIFS, famille 1 : hors bricolage, PRODUIT de bricolage nommé —');
console.log(`  total : ${fnForts.length}`);
const parCat1 = new Map();
for (const f of fnForts) parCat1.set(f.c, (parCat1.get(f.c) || 0) + 1);
console.log('  par rubrique : ' + [...parCat1].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${NOMS[f]} ${n}`).join(' · '));
for (const { o, c, mots } of fnForts.slice(0, 120))
  console.log(`  [${o.pays}] ${NOMS[c].padEnd(14)} « ${court(o.titre, 66)} »  (mots : ${mots.join(', ')})`);
console.log('');

console.log('— FAUX NÉGATIFS, famille 2 : hors bricolage, mot FAIBLE de bricolage seul —');
console.log(`  total : ${fnFaibles.length}`);
const parCat2 = new Map();
for (const f of fnFaibles) parCat2.set(f.c, (parCat2.get(f.c) || 0) + 1);
console.log('  par rubrique : ' + [...parCat2].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${NOMS[f]} ${n}`).join(' · '));
const parMot2 = new Map();
for (const f of fnFaibles) for (const m of f.mots) parMot2.set(m, (parMot2.get(m) || 0) + 1);
console.log('  par mot : ' + [...parMot2].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([m, n]) => `${m} ${n}`).join(' · '));
for (const { o, c, mots } of fnFaibles.slice(0, 60))
  console.log(`  [${o.pays}] ${NOMS[c].padEnd(14)} « ${court(o.titre, 66)} »  (mots : ${mots.join(', ')})`);
console.log('');

// Contrôles E1 : tondeuse à gazon → bricolage ; tondeuse à cheveux → électroménager.
console.log('— CONTRÔLES E1 (partage tondeuse) —');
const test = (titre) => {
  const fam = classerOffre({ titre, pays: 'BE' });
  return `${NOMS[fam] || fam}`;
};
const gazon = [
  'Tondeuse à gazon sans fil 36V', 'Robomow Robot tondeuse', 'Makita Rasenmäher 1500W',
  'Bosch Grasmachine 1200W', 'Einhell Cortacésped 1400W', 'Tondeuse thermique tractée',
];
const cheveux = [
  'Tondeuse à cheveux sans fil', 'Philips Haarschneider Series 5000', 'Tondeuse à barbe rechargeable',
  'Babyliss Tondeuse à poils', 'Rasoir électrique Braun Series 7',
  'Tondeuse cheveux Babyliss 10-en-1', 'Rasoir manuel 5 lames Gillette', 'Tondeuse',
];
for (const titre of gazon) console.log(`  gazon    « ${court(titre, 50)} » → ${test(titre)}`);
for (const titre of cheveux) console.log(`  cheveux  « ${court(titre, 50)} » → ${test(titre)}`);
console.log('');
