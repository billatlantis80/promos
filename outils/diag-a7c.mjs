import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const ex = d.offres.filter((o) => (o.categorie || 'autre') === 'autre' && o.categorieSource === 'enseigne');
const m = new Map();
for (const o of ex) { const k = o.sourceId + ' | ' + o.marchand; m.set(k, (m.get(k) || 0) + 1); }
for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
console.log('\n-- Bosch en autre, par sourceId --');
const mb = new Map();
for (const o of d.offres.filter((o) => (o.categorie||'autre')==='autre' && /bosch/i.test(o.titre||''))) { const k=o.sourceId+' | '+o.marchand+' | '+o.categorieSource; mb.set(k,(mb.get(k)||0)+1); }
for (const [k, v] of [...mb.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
