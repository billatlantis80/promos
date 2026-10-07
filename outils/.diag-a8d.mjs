import fs from 'node:fs';
import { sansAccents } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const bas = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
const FORTS = ['chaussette', 'chaussettes', 'socks', 'socken', 'sokken', 'calcetin', 'calcetines', 'calzino', 'calzini', 'meia', 'meias', 'skarpet', 'skarpetki', 'strumpa', 'strumpor'];
const FAIBLES = ['calecon', 'calecons', 'boxer', 'boxers', 'boxershorts', 'trunks', 'unterhose', 'unterwasche', 'underwear', 'onderbroek', 'mutande', 'cueca', 'cuecas', 'majtki', 'bokserski', 'underklader',
  'jupe', 'short', 'shorts', 'maillot', 'pyjama', 'pyjamas', 't-shirt', 'tee-shirt', 'sweat', 'sweatshirt', 'blouson', 'veste', 'sandale', 'sandales', 'claquette', 'claquettes', 'kimono', 'skirt', 'swimsuit', 'slipper', 'falda', 'sweter', 'gonna', 'saia', 'spodnica', 'kjol', 'hoodie'];
function scan(list, nom) {
  console.log('--- ' + nom + ' ---');
  for (const m of list) {
    const all = offres.filter((o) => bas(o).includes(m));
    const hors = all.filter((o) => (o.categorie || 'autre') !== 'mode');
    console.log(`${m.padEnd(12)} sub=${String(all.length).padStart(4)} hors=${String(hors.length).padStart(4)}`);
    for (const o of hors.slice(0, 4)) console.log(`      [${o.categorie || 'autre'}] ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 72)}`);
  }
}
scan(FORTS, 'FORTS socks');
scan(FAIBLES, 'FAIBLES');
