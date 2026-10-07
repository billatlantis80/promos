import fs from 'node:fs';
import { sansAccents, sansNegations, retirerTrompeurs } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('docs/offres.json', 'utf8'));
const offres = Array.isArray(d) ? d : d.offres;
const norm = (t) => retirerTrompeurs(sansNegations(sansAccents(String(t || '')).toLowerCase()));

console.log('--- farg ---');
for (const o of offres.filter((o) => norm(o.titre).includes('farg'))) console.log(`[${o.categorie}] ${o.titre}`);
console.log('\n--- figur hors figurine/figura/figura de ---');
const re = /figur(?!ine|as?\b|es?\b|a de accion|a de acci)/;
for (const o of offres.filter((o) => re.test(norm(o.titre))).slice(0, 25)) console.log(`[${o.categorie}] ${String(o.titre).slice(0, 95)}`);
console.log('\n--- baby ---');
for (const o of offres.filter((o) => norm(o.titre).includes('baby'))) console.log(`[${o.categorie}] ${String(o.titre).slice(0, 95)}`);
