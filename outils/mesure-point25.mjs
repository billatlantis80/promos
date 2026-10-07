/** Point 25 — contrôle des quatre demandes de B, avec contrôles négatifs.
 *  Et mesure de l'effet réel sur les offres en stock. Lecture seule. */
import { readFileSync } from 'node:fs';
import { famille } from '../collecteur.mjs';

const cas = [
  ['Gillette lame de rasoir de sûreté, 10 pièces', '', 'beaute'],
  ['Recharge rasoir Gillette Fusion 5, 8 cartouches', '', 'beaute'],
  ['Rasoir électrique Braun Series 7', '', 'electromenager'],
  ['Capsules pour lave-vaisselle x60, tout-en-un', '', 'maison'],
  ['Tablettes lave-vaisselle 100 lavages', '', 'maison'],
  ['Lave-vaisselle Bosch SMV6ZC00E, 13 couverts', '', 'electromenager'],
  ['Vidéoprojecteur Full HD 1080p, 8000 lumens', '', 'tech'],
  ['Répéteur WiFi Mesh AC1200, 2 antennes', '', 'tech'],
  ['Beamer Epson EB-FH52, Full HD', '', 'tech'],
  // Contrôles négatifs : ce qui ne doit PAS bouger
  ['Projecteur de chantier LED 500 W', '', 'tech'],       // ⚠ attendu ≠ tech
  ['Lame de cutter 10 pièces', '', 'beaute'],             // ⚠ attendu ≠ beaute
  ['Boîte de sel de cuisine 1 kg', '', 'maison'],         // ⚠ attendu ≠ maison
];
console.log('— Contrôle des règles (attendu entre crochets) —');
let ok = 0;
for (const [t, c, attendu] of cas) {
  const f = famille(t, c);
  const bon = f === attendu || (attendu === 'tech' && f !== 'tech') === false;
  const marque = f === attendu ? 'OK ' : '≠  ';
  if (f === attendu) ok++;
  console.log(`  ${marque} ${f.padEnd(15)} | ${t}`);
}
console.log(`  ${ok}/${cas.length} aux valeurs attendues\n`);

const d = JSON.parse(readFileSync('data/offres.json', 'utf8'));
const o = d.offres || d;
const MOTS = {
  'lame/rasoir': /(lame[s]? de rasoir|razor blade|rasierklinge|lame di rasoio|cuchilla de afeitar|lamette|ostrze do golenia|rakblad)/i,
  'capsule lave-vaisselle': /(capsule[s]? (pour )?lave-vaisselle|tablette[s]? lave-vaisselle|pastille[s]? lave-vaisselle|dishwasher tablet|geschirrspultab|spultab|vaatwastablet|pastillas lavavajillas|pastiglie lavastoviglie|tabletki do zmywarki|diskmaskinstablett)/i,
  'videoprojecteur': /(videoprojecteur|video-projecteur|projecteur video|beamer|proyector|proiettore|projetor|videoprojektor|projektor)/i,
  'repeteur wifi': /(repeteur|range extender|wifi repeater|versterker|verstarker|wzmacniacz|repetidor|ripetitore|forstarkare)/i,
};
console.log(`— Effet sur les ${o.length} offres en stock —`);
for (const [nom, re] of Object.entries(MOTS)) {
  const touchees = o.filter((x) => re.test(x.titre || ''));
  const parCat = touchees.reduce((a, x) => { a[x.categorie] = (a[x.categorie] || 0) + 1; return a; }, {});
  console.log(`  ${nom.padEnd(24)} ${String(touchees.length).padStart(4)} offre(s) ${JSON.stringify(parCat)}`);
  for (const x of touchees.slice(0, 4)) console.log(`      [${x.categorie}] ${(x.titre || '').slice(0, 72)}`);
}
