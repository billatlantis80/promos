import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const ex = d.offres.filter((o) => o.categorieSource === 'enseigne' && (o.categorie || 'autre') === 'autre');
console.log('enseigne en autre:', ex.length);
console.log(JSON.stringify(ex[0], null, 1));
console.log('----');
console.log(JSON.stringify(ex[1], null, 1));
// toutes les clés présentes sur les offres
const cles = new Set(); for (const o of d.offres) for (const k of Object.keys(o)) cles.add(k);
console.log('clés:', [...cles].join(', '));
