import fs from 'node:fs';
import { famille, sansAccents } from '../collecteur.mjs';

const MOTS = {
  chaussette: ['chaussette', 'chaussettes', 'sock', 'socks', 'socken', 'sokken', 'calcetin', 'calcetines', 'calzino', 'calzini', 'meia', 'meias', 'skarpet', 'skarpetki', 'strumpa', 'strumpor'],
  sousvetement: ['calecon', 'calecons', 'slip', 'boxer', 'boxers', 'trunks', 'collant', 'collants', 'unterhose', 'unterwasche', 'underwear', 'onderbroek', 'panty', 'mutande', 'cueca', 'cuecas', 'majtki', 'bokserski', 'underklader'],
  accessoire: ['echarpe', 'casquette', 'bonnet', 'gant', 'gants', 'ceinture', 'scarf', 'glove', 'gloves', 'handschuh', 'muetze', 'handschuhe', 'sjaal', 'want', 'guante', 'guantes', 'gorro', 'gorra', 'sciarpa', 'cappello', 'guanti', 'luva', 'luvas', 'touca', 'szalik', 'czapka', 'rekawiczki', 'halsduk', 'mossa', 'vantar'],
};
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const bas = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
const contient = (t, m) => new RegExp('(^|[^a-z0-9])' + m + '([^a-z0-9]|$)').test(t);

for (const [groupe, mots] of Object.entries(MOTS)) {
  console.log('=== ' + groupe + ' ===');
  const touchees = offres.filter((o) => { const t = bas(o); return mots.some((m) => contient(t, m)); });
  for (const o of touchees.filter((o) => (o.categorie || 'autre') !== 'mode')) {
    console.log(`  [${o.categorie || 'autre'}] src=${o.categorieSource || '-'} (${o.source}) :: ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 80)}`);
  }
}
