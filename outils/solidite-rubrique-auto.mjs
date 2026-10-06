/**
 * Solidité de la rubrique « Auto & moto » — sur les données PUBLIÉES.
 *
 * Question posée, et c'est la seule qui compte après le correctif : les offres
 * rangées en auto le sont-elles à cause d'un VRAI mot auto du titre, ou
 * seulement parce que la source les a publiées dans une rubrique « voitures » ?
 * La seconde catégorie n'est pas un défaut — c'est la règle « la catégorie du
 * marchand tranche » —, mais elle doit être COMPTÉE et NOMMÉE, pas supposée.
 */
import fs from 'node:fs';
import { FAMILLES, MOTS_FORTS, sansAccents } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const mots = [...FAMILLES.auto, ...(MOTS_FORTS.auto || [])].map((m) => sansAccents(m).toLowerCase());
const nettoie = (t) => sansAccents(String(t || '').replace(/<[^>]+>/g, ' ')).toLowerCase();

const auto = d.offres.filter((x) => (x.categorie || 'autre') === 'auto');
let parTitre = 0;
const parSource = new Map();
for (const o of auto) {
  const t = nettoie(o.titre);
  const touche = mots.some((m) => (m.length <= 3
    ? new RegExp('(^|[^a-z0-9])' + m + '([^a-z0-9]|$)').test(t)
    : t.includes(m)));
  if (touche) { parTitre++; continue; }
  const cle = `${o.categorieSource || '(sans rubrique)'}  —  ${o.enseigne || o.marchand || '?'}`;
  parSource.set(cle, (parSource.get(cle) || 0) + 1);
}

console.log(`auto, total publié            : ${auto.length}`);
console.log(`  justifiées par le TITRE     : ${parTitre}`);
console.log(`  justifiées par la SOURCE    : ${auto.length - parTitre}`);
console.log('  détail de ces dernières :');
for (const [k, v] of [...parSource].sort((a, b) => b[1] - a[1])) {
  console.log(`     ${String(v).padStart(3)}×  ${k}`);
}
