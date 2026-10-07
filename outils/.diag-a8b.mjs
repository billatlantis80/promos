import fs from 'node:fs';
import { sansAccents } from '../collecteur.mjs';

const MOTS = [
  'chaussette', 'chaussettes', 'sock', 'socks', 'socken', 'sokken', 'calcetin', 'calcetines', 'calzino', 'calzini', 'meia', 'meias', 'skarpet', 'skarpetki', 'strumpa', 'strumpor',
  'calecon', 'calecons', 'slip', 'boxer', 'boxers', 'trunks', 'collant', 'collants', 'unterhose', 'unterwasche', 'underwear', 'onderbroek', 'panty', 'mutande', 'cueca', 'cuecas', 'majtki', 'bokserski', 'underklader',
  'echarpe', 'casquette', 'bonnet', 'gant', 'gants', 'scarf', 'glove', 'gloves', 'handschuh', 'handschuhe', 'sjaal', 'want', 'guante', 'guantes', 'gorro', 'gorra', 'sciarpa', 'cappello', 'guanti', 'luva', 'luvas', 'touca', 'szalik', 'czapka', 'rekawiczki', 'halsduk', 'mossa', 'vantar', 'ceinture', 'cinturon',
  'jupe', 'short', 'shorts', 'maillot', 'pyjama', 'pyjamas', 't-shirt', 'tee-shirt', 'sweat', 'sweatshirt', 'hoodie', 'blouson', 'veste', 'sandale', 'sandales', 'claquette', 'claquettes', 'kimono', 'skirt', 'swimsuit', 'slipper', 'falda', 'gorra', 'sweter', 'gonna', 'saia', 'spodnica', 'kjol',
];
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const bas = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
const regexFront = (m) => new RegExp('(^|[^a-z0-9])' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
for (const m of MOTS) {
  const sub = offres.filter((o) => bas(o).includes(m));
  const fr = offres.filter((o) => regexFront(m).test(bas(o)));
  const hors = fr.filter((o) => (o.categorie || 'autre') !== 'mode');
  if (!fr.length) continue;
  console.log(`${m.padEnd(12)} front=${String(fr.length).padStart(4)} (hors mode ${String(hors.length).padStart(4)})  sub=${String(sub.length).padStart(4)}`);
  for (const o of hors.slice(0, 4)) console.log(`      [${o.categorie || 'autre'}] ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 72)}`);
}
