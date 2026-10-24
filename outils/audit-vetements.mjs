/**
 * AUDIT VÊTEMENTS — « les chaussettes et tout autre vêtement → Mode ».
 *
 * Question posée : nos tables connaissent-elles les VÊTEMENTS courants dans
 * les 9 langues, et où vont aujourd'hui les offres qui en portent un ?
 * On mesure avant d'ajouter quoi que ce soit : un mot ajouté sans mesure peut
 * déplacer des offres dans la mauvaise rubrique.
 */
import fs from 'node:fs';
import { famille, sansAccents } from '../collecteur.mjs';

// Vêtements et accessoires, 9 langues. Aucun n'est censé sortir de « Mode ».
const MOTS = {
  chaussette: ['chaussette', 'chaussettes', 'sock', 'socks', 'socken', 'sokken', 'calcetin', 'calcetines',
    'calzino', 'calzini', 'meia', 'meias', 'skarpet', 'skarpetki', 'strumpa', 'strumpor'],
  sousvetement: ['calecon', 'calecons', 'slip', 'boxer', 'boxers', 'trunks', 'collant', 'collants',
    'unterhose', 'unterwasche', 'underwear', 'onderbroek', 'panty', 'mutande', 'cueca', 'cuecas',
    'majtki', 'bokserski', 'underklader'],
  accessoire: ['echarpe', 'casquette', 'bonnet', 'gant', 'gants', 'ceinture', 'scarf', 'glove', 'gloves',
    'handschuh', 'muetze', 'handschuhe', 'sjaal', 'want', 'guante', 'guantes', 'gorro', 'gorra',
    'sciarpa', 'cappello', 'guanti', 'luva', 'luvas', 'touca', 'szalik', 'czapka', 'rekawiczki',
    'halsduk', 'mossa', 'vantar'],
  vetement: ['jupe', 'short', 'short', 'maillot', 'pyjama', 't-shirt', 'tee-shirt', 'sweat', 'blouson',
    'veste', 'sandale', 'sandales', 'claquette', 'kimono', 'skirt', 'shorts', 'swimsuit', 'pyjamas',
    'hoodie', 'sweatshirt', 'vest', 'slipper', 'jupe', 'falda', 'gorra', 'sweter', 'bluza', 'kurtka'],
};

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const bas = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
const contient = (t, m) => new RegExp('(^|[^a-z0-9])' + m + '([^a-z0-9]|$)').test(t);

console.log('offres publiées :', offres.length, '\n');
for (const [groupe, mots] of Object.entries(MOTS)) {
  const touchees = offres.filter((o) => { const t = bas(o); return mots.some((m) => contient(t, m)); });
  const parCat = {};
  for (const o of touchees) parCat[o.categorie || 'autre'] = (parCat[o.categorie || 'autre'] || 0) + 1;
  const bonnes = parCat.mode || 0;
  console.log(`${groupe.padEnd(14)} ${String(touchees.length).padStart(5)} offres  |  en Mode : ${bonnes}  |  ailleurs : ${touchees.length - bonnes}`);
  const pires = Object.entries(parCat).filter(([c]) => c !== 'mode').sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (pires.length) console.log('   ' + pires.map(([c, n]) => `${c}:${n}`).join('  '));
  for (const o of touchees.filter((x) => (x.categorie || 'autre') === 'autre').slice(0, 3)) {
    console.log(`   ex. autre → « ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 58)} »`);
  }
}
