import fs from 'node:fs';
import { sansAccents } from '../collecteur.mjs';

const MOTS = ['boxer', 'trunks', 'meia', 'meias', 'underwear', 'panty', 'cueca', 'cuecas', 'mutande', 'onderbroek', 'unterhose', 'unterwasche', 'majtki', 'bokserski',
  'short', 'shorts', 'sweat', 'sweatshirt', 'hoodie', 'bonnet', 'jupe', 'maillot', 'pyjama', 't-shirt', 'tee-shirt', 'blouson', 'veste', 'sandale', 'claquette', 'kimono', 'echarpe', 'casquette', 'gant', 'handschuh', 'glove', 'gorro', 'gorra', 'cappello', 'guanti', 'luva', 'szalik', 'czapka', 'rekawiczki', 'halsduk', 'mossa', 'vantar', 'touca', 'sciarpa', 'swimsuit', 'slipper', 'falda', 'sweter', 'gonna', 'saia', 'spodnica', 'kjol', 'skirt'];
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const bas = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
for (const m of MOTS) {
  const all = offres.filter((o) => bas(o).includes(m));
  const hors = all.filter((o) => (o.categorie || 'autre') !== 'mode');
  if (!all.length) continue;
  console.log(`${m.padEnd(12)} sub=${String(all.length).padStart(4)} hors=${String(hors.length).padStart(4)}`);
  for (const o of hors.slice(0, 5)) console.log(`      [${o.categorie || 'autre'}] ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 74)}`);
}
