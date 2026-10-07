import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(new URL('../data/offres.json', import.meta.url), 'utf8'));
const o = (Array.isArray(d) ? d : d.offres);
const src = (x) => x.marchand || x.categorieSource || '?';
const cnt = (arr) => { const m = new Map(); for (const x of arr) m.set(src(x), (m.get(src(x)) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
for (const cat of ['animaux', 'voyages', 'activite']) {
  const du = o.filter((x) => (x.categorie || 'autre') === cat);
  console.log(`\n== ${cat} : ${du.length} offres — par source ==`);
  console.log(cnt(du).map(([k, v]) => `${k} ${v}`).join(' · '));
}
// sources B5 (Coolblue NL/DE, Zooplus, Social Deal) : combien d'offres publiées
console.log('\n== offres des sources B5 ==');
for (const [lab, re] of [['Coolblue', /coolblue/i], ['Zooplus', /zooplus/i], ['Social Deal', /social deal|socialdeal/i]]) {
  const du = o.filter((x) => re.test(String(x.marchand || '')) || re.test(String(x.categorieSource || '')));
  console.log(`${lab}: ${du.length} — rubriques: ${[...new Set(du.map((x) => x.categorie))].join(', ')}`);
}
