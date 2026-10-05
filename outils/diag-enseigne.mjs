import fs from 'node:fs';
const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;
const c = {};
for (const o of offres) {
  const k = `${o.source} · categorieSource=${o.categorieSource}`;
  c[k] = (c[k] || 0) + 1;
}
console.log('Sources dont categorieSource vaut exactement « enseigne » :');
let n = 0;
for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) {
  if (/categorieSource=enseigne$/.test(k)) { console.log(`   ${String(v).padStart(4)} ${k}`); n += v; }
}
console.log(`   TOTAL ${n} offres collectées sur la page d’offres d’une enseigne`);
console.log('');
console.log('Marchand + pays de ces offres :');
const d = {};
for (const o of offres) {
  if (o.categorieSource !== 'enseigne') continue;
  const k = `${o.marchand} (${o.pays}) prix=${o.prix != null ? 'oui' : 'NON'} remise=${o.remise ?? '—'} temp=${o.temperature ?? '—'}`;
  d[k] = (d[k] || 0) + 1;
}
for (const [k, v] of Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${String(v).padStart(4)} ${k}`);
