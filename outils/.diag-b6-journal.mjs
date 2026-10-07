import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(new URL('../data/offres.json', import.meta.url), 'utf8'));
const j = d.journal || [];
console.log('genereLe', d.genereLe, '| sources', j.length, '| offres', (d.offres || []).length);
for (const x of j) {
  console.log(`${x.ok ? 'OK ' : 'KO '} ${String(x.source).padEnd(24)} ${x.pays || ''}  ${x.offres ?? x.n ?? x.nombre ?? ''}`);
}
