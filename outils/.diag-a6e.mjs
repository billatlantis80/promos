import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('docs/offres.json', 'utf8'));
const offres = Array.isArray(d) ? d : d.offres;
for (const o of offres.filter((o) => /coches|Hot Wheels/i.test(String(o.titre)))) {
  console.log(`[${o.categorie}] src="${o.categorieSource || '-'}" pays=${o.pays} | ${String(o.titre).slice(0, 95)}`);
}
