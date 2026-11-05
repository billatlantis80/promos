/**
 * Mesure de la règle E4 — « fille / garçon / enfant / catégorie d'âge » → Jeux & jouets.
 *
 * Usage : node outils/mesure-enfant.mjs
 *
 * Ce que l'outil MESURE sur les offres publiées (data/offres.json) :
 *   - combien d'offres portent, dans leur titre, un mot d'enfant des 9 langues ;
 *   - combien sont rangées en « Jeux & jouets » et combien restent ailleurs ;
 *   - la liste NOMMÉE de celles qui restent ailleurs, avec leur rubrique, pour
 *     que les cas discutables (appareil nommé plus précis, faux positif) soient
 *     visibles et non cachés.
 *
 * La table des mots est recopiée ici VOLONTAIREMENT : l'outil doit rester un
 * CONTRÔLE indépendant du classement. La source de vérité de la règle est
 * collecteur.mjs (MOTS_FORTS.jouets), garantie par tests/enfant-jouets.test.mjs.
 */
import fs from 'node:fs';
import { famille, sansAccents, retirerTrompeurs } from '../collecteur.mjs';

const MOTS = {
  fr: ['fille', 'fillettes', 'garcon', 'garcons', 'enfant', 'enfants'],
  en: ['girl', 'girls', 'boy', 'boys', 'child', 'children', 'kid', 'kids'],
  de: ['madchen', 'junge', 'jungen', 'kinder', 'kindern'],
  nl: ['meisje', 'meisjes', 'jongen', 'jongens', 'kinderen'],
  es: ['nina', 'ninas', 'nino', 'ninos', 'chica', 'chico', 'chicos'],
  it: ['bambina', 'bambine', 'bambino', 'bambini', 'ragazza', 'ragazze', 'ragazzo', 'ragazzi'],
  pt: ['menina', 'meninas', 'menino', 'meninos', 'crianca', 'criancas'],
  pl: ['dziewczynka', 'dziewczynki', 'chlopiec', 'chlopcy', 'dziecko', 'dzieci'],
  sv: ['flicka', 'flickor', 'pojke', 'pojkar', 'barn', 'barnen'],
};
// Mots lus entre deux frontières (sinon « Chicago » contient « chica », etc.).
const FRONTIERE = new Set(['kind', 'barn', 'nina', 'nino', 'junge', 'kids', 'child', 'chica']);
const TOUS = [...new Set(Object.values(MOTS).flat())];
const exige = (m) => m.length <= 3 || FRONTIERE.has(m);
const front = (m) => new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i');
const present = (m, t) => (exige(m) ? front(m).test(t) : t.includes(m));

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres || d;

let total = 0, enJouets = 0;
const ailleurs = {};
const exemples = [];
for (const o of offres) {
  const t = retirerTrompeurs(sansAccents(String(o.titre || '')).toLowerCase());
  const mots = TOUS.filter((m) => present(m, t));
  if (!mots.length) continue;
  total++;
  const cat = famille(String(o.titre || ''), o.categorieSource || '');
  if (cat === 'jouets') { enJouets++; continue; }
  ailleurs[cat] = (ailleurs[cat] || 0) + 1;
  exemples.push(`[${o.pays}] ${cat.padEnd(14)} « ${String(o.titre).slice(0, 74)} »  (mots : ${mots.join(', ')})`);
}
console.log('offres portant un mot d’ENFANT (9 langues) :', total);
console.log('  → rangées en « Jeux & jouets » :', enJouets);
console.log('  → restées ailleurs :', total - enJouets, ailleurs);
console.log('\n— cas restés ailleurs (nommés) —');
exemples.forEach((e) => console.log('  ', e));
