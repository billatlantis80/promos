import fs from 'node:fs';
import { classerOffre, MOTS_FORTS } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('docs/offres.json','utf8'));
const offres = Array.isArray(d)?d:d.offres;
const o = offres.find(o => /MegaThread/.test(String(o.titre)));
console.log('TITRE:', o.titre);
console.log('categorie:', o.categorie);
const M = Object.fromEntries(Object.entries(MOTS_FORTS).map(([f,m])=>[f,m]));
// find which strong words match
const norm = String(o.titre).toLowerCase();
for (const [f, mots] of Object.entries(M)) {
  const hits = mots.filter(m => norm.includes(m.toLowerCase()));
  if (hits.length) console.log('  FORT', f, JSON.stringify(hits));
}
console.log('--- rasoirs MANUELS en Électroménager ---');
for (const x of offres.filter(o=>o.categorie==='electromenager' && /rasoir|gillette|lame|manche|cuchilla|klinge|lâmina/i.test(String(o.titre))))
  console.log('  *', String(x.titre).slice(0,120));
