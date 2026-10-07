import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const cible = d.offres.filter((o) => (o.categorie || 'autre') === 'autre'
  && ['vente flash', 'amazon'].includes(o.categorieSource));
// unique par titre
const vus = new Set(); const uniq = [];
for (const o of cible) { const t = String(o.titre).slice(0, 110); if (vus.has(t)) continue; vus.add(t); uniq.push(`[${o.pays}] ${t}`); }
uniq.sort();
console.log('titres uniques:', uniq.length);
console.log(uniq.join('\n'));
