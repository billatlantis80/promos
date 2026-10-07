import fs from 'node:fs';
import { sansAccents } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const bas = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
const L = ['scarf', 'sjaal', 'muts', 'rok', 'bufanda', 'cachecol', 'gorro', 'gonna', 'maglia', 'beanie', 'mitten', 'mittens', 'halsduk', 'mossa', 'vantar', 'kjol', 'spodnica', 'szalik', 'cappello', 'sciarpa', 'guanti', 'luva', 'luvas', 'touca', 'gorra', 'guante', 'guantes', 'handschuh', 'handschuhe', 'handschoen', 'handschoenen', 'echarpe', 'casquette', 'bonnet', 'veste', 'blouson'];
for (const m of L) {
  const all = offres.filter((o) => bas(o).includes(m));
  const hors = all.filter((o) => (o.categorie || 'autre') !== 'mode');
  console.log(`${m.padEnd(13)} sub=${String(all.length).padStart(3)} hors=${String(hors.length).padStart(3)}` + (hors.length ? '  :: ' + hors.slice(0, 3).map((o) => `[${o.categorie || 'autre'}] ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 46)}`).join(' | ') : ''));
}
