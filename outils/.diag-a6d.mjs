import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('docs/offres.json', 'utf8'));
const offres = Array.isArray(d) ? d : d.offres;

const NEEDLES = [
  'Rasierer', 'OneBlade', 'Shaver 5000', 'Multigroom', 'Cortabarbas',
  'Washing Machine', 'Zamrażarka', 'Vacuum Cleaner', 'Fusselrasierer',
  'Hot Wheels', 'Fire TV Stick', 'Diplomático', 'Woodford', 'Biscoff',
  'kinder Schokolade', 'Segafredo', 'Pommes de Terre',
];
for (const n of NEEDLES) {
  const hits = offres.filter((o) => String(o.titre).includes(n));
  console.log(`\n### ${n} (${hits.length})`);
  for (const o of hits.slice(0, 4)) console.log(`  [${o.categorie}] src="${o.categorieSource || '-'}" pays=${o.pays || '-'} | ${String(o.titre).slice(0, 92)}`);
}
