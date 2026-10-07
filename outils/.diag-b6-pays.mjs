import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(new URL('../data/offres.json', import.meta.url), 'utf8'));
const o = (Array.isArray(d) ? d : d.offres);
const m = new Map();
for (const x of o) {
  if (!/coolblue/i.test(String(x.marchand || ''))) continue;
  const k = x.pays || '?';
  m.set(k, (m.get(k) || 0) + 1);
}
console.log('Coolblue par pays:', [...m.entries()].map(([k, v]) => `${k} ${v}`).join(' · '));
const m2 = new Map();
for (const x of o) {
  if (!/zooplus/i.test(String(x.marchand || ''))) continue;
  m2.set(x.pays || '?', (m2.get(x.pays || '?') || 0) + 1);
}
console.log('Zooplus par pays:', [...m2.entries()].map(([k, v]) => `${k} ${v}`).join(' · '));
const m3 = new Map();
for (const x of o) {
  if (!/social deal/i.test(String(x.marchand || ''))) continue;
  m3.set(x.pays || '?', (m3.get(x.pays || '?') || 0) + 1);
}
console.log('Social Deal par pays:', [...m3.entries()].map(([k, v]) => `${k} ${v}`).join(' · '));
