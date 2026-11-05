/**
 * Mesure des mots de BIJOUX sur le catalogue RÉEL.
 *
 * Principe du projet : on n'ajoute pas un mot-clé « par prudence », on l'ajoute
 * sur PREUVE. Ce script ne décide rien : il montre, pour chaque mot candidat,
 * combien d'offres il touche et QUOI il touche. C'est ce qu'on lit pour trier
 * les mots justes des mots piégeux.
 *
 * Le mot est cherché comme le fera le classement : sans accents, en minuscules,
 * avec frontière de mot pour les mots de 3 caractères ou moins.
 *
 * Usage : node outils/mesure-mots-bijoux.mjs [--exemples 6]
 */
import { readFileSync } from 'node:fs';
import { sansAccents, retirerTrompeurs } from '../collecteur.mjs';

const EX = Number((process.argv.find((a) => a.startsWith('--exemples')) || '').split('=')[1] || 6);

const offres = JSON.parse(readFileSync(new URL('../data/offres.json', import.meta.url), 'utf8'));
const liste = Array.isArray(offres) ? offres : (offres.offres || []);
console.log(`Catalogue : ${liste.length} offres.\n`);

/* Mots candidats, groupés par langue. On les écrit SANS ACCENT et en minuscules,
   comme la table du classement. */
const CANDIDATS = {
  fr: ['bijou', 'bijoux', 'collier', 'bracelet', 'bague', 'boucle d oreille',
    'pendentif', 'broche', 'alliance', 'parure', 'medaille', 'gourmette', 'jonc'],
  en: ['jewellery', 'jewelry', 'necklace', 'bracelet', 'earring', 'earrings',
    'pendant', 'brooch', 'bangle', 'locket'],
  de: ['schmuck', 'halskette', 'ohrring', 'ohrringe', 'armband', 'anhanger',
    'brosche', 'kette', 'reif'],
  nl: ['sieraad', 'sieraden', 'ketting', 'oorbel', 'oorbellen', 'armband',
    'halssnoer', 'hanger'],
  es: ['joya', 'joyas', 'joyeria', 'pulsera', 'pendiente', 'pendientes',
    'colgante', 'collar', 'anillo', 'gargantilla'],
  it: ['gioiello', 'gioielli', 'gioielleria', 'collana', 'bracciale',
    'orecchino', 'orecchini', 'ciondolo', 'anello', 'spilla'],
  pt: ['joia', 'joias', 'joalharia', 'pulseira', 'brinco', 'brincos',
    'pingente', 'anel', 'colar'],
  pl: ['bizuteria', 'naszyjnik', 'bransoletka', 'kolczyk', 'kolczyki',
    'pierscionek', 'wisiorek', 'broszka'],
  sv: ['smycke', 'smycken', 'halsband', 'armband', 'orhange', 'orhangen',
    'berlock', 'brosch', 'ring'],
};

/** Même règle de frontière que le classement (voir compterMots). */
const COURT = (m) => m.length <= 3;
const touche = (mot, bas) => (COURT(mot)
  ? new RegExp('(^|[^a-z0-9à-ÿ])' + mot + '([^a-z0-9à-ÿ]|$)', 'i').test(bas)
  : bas.includes(mot));

const texte = liste.map((o) => retirerTrompeurs(sansAccents(String(o.titre || '')).toLowerCase()));
const deja = liste.map((o) => o.categorie || '');

const compte = {};
for (const [, mots] of Object.entries(CANDIDATS)) {
  for (const mot of mots) compte[mot] = 0;
}
for (const bas of texte) {
  for (const [, mots] of Object.entries(CANDIDATS)) {
    for (const mot of mots) if (touche(mot, bas)) compte[mot] += 1;
  }
}

for (const [langue, mots] of Object.entries(CANDIDATS)) {
  console.log(`--- ${langue} ---`);
  for (const mot of mots) {
    const idx = [];
    for (let i = 0; i < texte.length; i += 1) {
      if (touche(mot, texte[i])) { idx.push(i); if (idx.length >= EX) break; }
    }
    console.log(`\n« ${mot} » — ${compte[mot]} offre(s)`);
    for (const i of idx) {
      const t = String(liste[i].titre || '').replace(/\s+/g, ' ').slice(0, 96);
      console.log(`    [${deja[i] || '?'}] ${t}`);
    }
  }
  console.log('');
}

/* Combien d'offres portent DÉJÀ la catégorie « mode » ou « autre » et seraient
   candidates au déplacement — c'est l'enjeu du changement, mesuré. */
console.log('--- état actuel ---');
const parCat = {};
for (const c of deja) parCat[c] = (parCat[c] || 0) + 1;
for (const [c, n] of Object.entries(parCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(16)} ${n}`);
}
