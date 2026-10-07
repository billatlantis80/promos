import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(new URL('../data/offres.json', import.meta.url), 'utf8'));
const o = Array.isArray(d) ? d : d.offres;
const needles = ['Green SM', 'ACCIONA IKEA', 'Beler Kit de broderie', 'Pampers Sensitive billendoekjes', 'DANISH ENDURANCE', 'Movie Park Germany', 'taxi-app'];
for (const n of needles) {
  const h = o.filter((x) => String(x.titre).toLowerCase().includes(n.toLowerCase()));
  for (const x of h) console.log(`[${x.pays}] ${x.categorie} | ${String(x.titre).slice(0, 95)} | src: ${x.marchand || x.categorieSource || '?'}`);
}
