import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres || [];
for (const src of ['Coolblue', 'Zooplus', 'Social Deal']) {
  const o = offres.filter((x) => x.source === src);
  const sansRef = o.filter((x) => x.prixAvant == null).length;
  const sansRem = o.filter((x) => x.remise == null).length;
  const parPays = {};
  for (const x of o) parPays[x.pays] = (parPays[x.pays] || 0) + 1;
  console.log(src, 'total', o.length, 'sans prixAvant', sansRef, 'sans remise', sansRem, parPays);
}
