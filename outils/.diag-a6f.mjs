import fs from 'node:fs';
import { classerOffre as apres } from '../collecteur.mjs';
import { classerOffre as avant } from '../.avant-collecteur.mjs';

const d = JSON.parse(fs.readFileSync('docs/offres.json', 'utf8'));
const offres = Array.isArray(d) ? d : d.offres;

const NOMS = {
  tech: 'High-tech', electromenager: 'Électroménager', meubles: 'Meubles',
  maison: 'Maison', mode: 'Mode', auto: 'Auto & moto', jouets: 'Jeux & jouets',
  sport: 'Sport', bricolage: 'Bricolage', beaute: 'Beauté', nourriture: 'Nourriture',
  animaux: 'Animaux', voyages: 'Voyages', activite: 'Activité', autre: 'Autres',
};
const court = (s, n = 96) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

const ch = [];
for (const o of offres) {
  const a = avant(o);
  const b = apres(o);
  if (a !== b) ch.push({ a, b, titre: o.titre, src: o.categorieSource || '-', pays: o.pays || '-', enr: o.categorie });
}
// fausses corrections : le recalculé d'AVANT doit correspondre à la rubrique
// enregistrée dans le fichier publié (preuve que la base de comparaison est bonne)
const incoherents = offres.filter((o) => avant(o) !== o.categorie);

console.log(`offres : ${offres.length}`);
console.log(`AVANT (HEAD collecteur) vs rubrique enregistrée : ${incoherents.length} écart(s)`);
console.log(`AVANT -> APRÈS (working tree) : ${ch.length} offre(s) changée(s)\n`);

const aff = {};
for (const c of ch) { const k = `${c.a}->${c.b}`; aff[k] = (aff[k] || 0) + 1; }
console.log('Matrice (avant -> après) :');
for (const [k, n] of Object.entries(aff).sort((x, y) => y[1] - x[1])) {
  const [a, b] = k.split('->');
  console.log(`  ${String(n).padStart(4)}  ${(NOMS[a] || a).padEnd(16)} -> ${NOMS[b] || b}`);
}
console.log('\nDétail :');
for (const c of ch.sort((x, y) => (x.a + x.b).localeCompare(y.a + y.b))) {
  console.log(`  [${c.pays}] ${c.a}->${c.b}  src=${c.src} | ${court(c.titre)}`);
}
