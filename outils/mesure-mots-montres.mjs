/**
 * Mesure des mots de MONTRES à ajouter à la rubrique (demande de B :
 * « on est parti pour montre et bijoux »).
 *
 * La rubrique s'appelle désormais « Montres & bijoux » : les montres et les
 * bracelets de montre doivent y entrer au lieu d'être ÉCARTÉS comme faux
 * positifs. Ce script mesure, mot par mot, ce qui entrerait — et surtout QUOI,
 * pour distinguer trois choses qu'il ne faut pas confondre :
 *
 *   1. une vraie montre ou un bracelet de bijouterie  -> à ajouter ;
 *   2. une MONTRE CONNECTÉE (Apple Watch, montre connectée, smartwatch), qui
 *      est un objet d'électronique autant qu'une montre -> choix à assumer ;
 *   3. un faux positif de lecture (« démontre », « smartwatch », « horloge »
 *      murale, « Bracelet Sport » d'une montre connectée) -> à neutraliser.
 *
 * Règle du projet : on n'ajoute pas un mot sur une intuition, on l'ajoute sur
 * mesure. Usage : node outils/mesure-mots-montres.mjs [--exemples=8]
 */
import { readFileSync } from 'node:fs';
import { sansAccents, retirerTrompeurs, MOTS_A_FRONTIERE, exigeFrontiere, classerOffre } from '../collecteur.mjs';

const EX = Number((process.argv.find((a) => a.startsWith('--exemples')) || '').split('=')[1] || 5);

const brut = JSON.parse(readFileSync(new URL('../data/offres.json', import.meta.url), 'utf8'));
const liste = Array.isArray(brut) ? brut : (brut.offres || []);
console.log(`Catalogue : ${liste.length} offres.\n`);

/** Exactement la préparation du classement (voir famille()). */
const prepare = (t) => retirerTrompeurs(sansAccents(String(t || '')).toLowerCase());
const texte = liste.map((o) => prepare(o.titre));
const lu = (mot, bas) => (exigeFrontiere(mot)
  ? new RegExp('(^|[^a-zà-ÿ])' + mot + '([^a-zà-ÿ]|$)', 'i').test(bas)
  : bas.includes(mot));

const CANDIDATS = {
  fr: ['montre', 'bracelet', 'montre connectee', 'montre homme', 'montre femme', 'chronographe'],
  en: ['watch', 'watches', 'bracelet', 'smartwatch', 'wristwatch'],
  de: ['uhr', 'uhren', 'armband', 'armbanduhr', 'smartwatch'],
  nl: ['horloge', 'polshorloge', 'armband', 'smartwatch'],
  es: ['reloj', 'relojes', 'pulsera', 'smartwatch'],
  it: ['orologio', 'orologi', 'bracciale', 'smartwatch'],
  pt: ['relogio', 'relogios', 'pulseira', 'smartwatch'],
  pl: ['zegarek', 'zegarki', 'bransoletka', 'smartwatch'],
  sv: ['klocka', 'klockor', 'armband', 'smartwatch'],
};

/* Mots dont le sens est un mot ENTIER mais qui se cachent dans un mot courant
   lu en sous-chaîne. On le signale au lieu de le découvrir plus tard. */
const SIGNALER = ['montre', 'watch', 'uhr', 'reloj', 'horloge', 'orologio', 'relogio', 'zegarek', 'klocka'];

/* Ce qui trahit une montre CONNECTÉE : ces offres resteraient en High-tech si
   on ne les inclut pas, et changeraient de rubrique si on les inclut. */
const CONNECTEE = /(connect|smartwatch|smart watch|gps|bluetooth|amoled|apple watch|fitbit|garmin|samsung galaxy watch|band|fitness|cardiogramme|spo2|notifications?)/i;

const compte = {};
for (const [, mots] of Object.entries(CANDIDATS)) for (const m of mots) compte[m] = 0;
for (const bas of texte) {
  for (const [, mots] of Object.entries(CANDIDATS)) {
    for (const m of mots) if (lu(m, bas)) compte[m] += 1;
  }
}

/* Combien ces mots feraient ENTRER dans la rubrique, et depuis où. On rejoue
   le classement réel, pas une approximation. */
const CAT = 'bijoux';
const entrees = [];
for (let i = 0; i < liste.length; i += 1) {
  const t = texte[i];
  const toucheMontre = Object.values(CANDIDATS).flat().some((m) => lu(m, t));
  if (!toucheMontre) continue;
  const avant = liste[i].categorie || 'autre';
  if (avant === CAT) continue;
  entrees.push({ avant, connectee: CONNECTEE.test(String(liste[i].titre || '')), titre: String(liste[i].titre || '') });
}

for (const [langue, mots] of Object.entries(CANDIDATS)) {
  console.log(`--- ${langue} ---`);
  for (const mot of mots) {
    const idx = [];
    for (let i = 0; i < texte.length; i += 1) { if (lu(mot, texte[i])) { idx.push(i); if (idx.length >= EX) break; } }
    const risque = SIGNALER.includes(mot) ? (exigeFrontiere(mot) ? ' [frontière]' : ' ⚠ LU EN SOUS-CHAÎNE') : '';
    console.log(`\n« ${mot} » — ${compte[mot]} offre(s)${risque}`);
    for (const i of idx) {
      const c = liste[i].categorie || '?';
      console.log(`    [${c.padEnd(10)}] ${String(liste[i].titre || '').replace(/\s+/g, ' ').slice(0, 92)}`);
    }
  }
  console.log('');
}

console.log('=== SI ON AJOUTE TOUS CES MOTS ===');
const parProvenance = {};
for (const e of entrees) {
  const cle = e.avant + (e.connectee ? ' (connectée)' : '');
  parProvenance[cle] = (parProvenance[cle] || 0) + 1;
}
console.log(`Offres qui ENTRERAIENT dans la rubrique : ${entrees.length}`);
for (const [c, n] of Object.entries(parProvenance).sort((a, b) => b[1] - a[1])) {
  console.log(`   depuis ${c.padEnd(24)} ${n}`);
}
console.log('\nExemples de montres CONNECTÉES qui changeraient de rubrique :');
for (const e of entrees.filter((x) => x.connectee).slice(0, 8)) {
  console.log(`   [${e.avant} -> ${CAT}] ${e.titre.replace(/\s+/g, ' ').slice(0, 88)}`);
}
