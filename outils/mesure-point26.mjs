/** POINT 26 — partage ÉLECTRIQUE / MANUEL, mesuré sur des titres réels.
 *  Ce que B a demandé, mot pour mot :
 *    « les brosses à dents électriques doivent être dans électroménager,
 *      les brosses à dents manuelles doivent être dans beauté.
 *      Même chose pour les rasoirs électriques doivent être dans électroménager.
 *      Les rasoirs manuels et les lames doivent être dans beauté. » */
import { readFileSync } from 'node:fs';
import { famille } from '../collecteur.mjs';

const cas = [
  // Brosses à dents — ÉLECTRIQUE → électroménager
  ['Brosse à dents électrique Oral-B iO Series 9', 'electromenager'],
  ['Oral-B iO3 Duo Electric Toothbrushes, 2 Handles', 'electromenager'],
  ['Philips Sonicare DiamondClean 9000 elektrische Zahnbürste', 'electromenager'],
  ['Oral-B iO 3 Spazzolino Elettrico, 1 Testina', 'electromenager'],
  // Brosses à dents — MANUELLE → beauté
  ['Brosse à dents manuelle bambou, lot de 4', 'beaute'],
  ['Colgate Brosse à Dents Extra Clean, Lot de 4', 'beaute'],
  ['Zahnbürste 4er Pack, weich', 'beaute'],
  ['Scheermesjes Gillette Fusion 5, 8 stuks', 'beaute'],
  ['Brosse à dents enfant souple 2-6 ans', 'beaute'],
  // Rasoirs — ÉLECTRIQUE → électroménager
  ['Rasoir électrique Braun Series 7', 'electromenager'],
  ['Elektrorasierer Philips 5000 Series', 'electromenager'],
  ['Scheerapparaat Philips Series 3000', 'electromenager'],
  // Rasoirs MANUELS et lames → beauté
  ['Rasoir mécanique Gillette Mach3, 1 manche', 'beaute'],
  ['Gillette Lames de Rasoir Homme Fusion 5, Pack de 16', 'beaute'],
  ['Recharge rasoir Gillette Fusion 5, 8 cartouches', 'beaute'],
  ['Philips OneBlade Original 360-rakblad', 'beaute'],
  ['Rasierhobel Rasiermesser für Herren', 'beaute'],
  // Contrôles négatifs : ne doivent PAS bouger
  ['Tondeuse à cheveux enfant Wahl', 'electromenager'],
  ['Capsules pour lave-vaisselle x60', 'maison'],
  ['Vidéoprojecteur Full HD 1080p', 'tech'],
];
console.log('— Partage électrique / manuel —');
let ok = 0;
for (const [t, attendu] of cas) {
  const f = famille(t, '');
  if (f === attendu) ok++;
  console.log(`  ${f === attendu ? 'OK ' : '≠  '} ${f.padEnd(15)} (attendu ${attendu.padEnd(14)}) ${t}`);
}
console.log(`  ${ok}/${cas.length} aux valeurs demandées\n`);

const d = JSON.parse(readFileSync('data/offres.json', 'utf8'));
const o = d.offres || d;
const GROUPE = {
  'brosses à dents': /(toothbrush|toothbrushes|brosse[s]? [aà] dents|zahnb|spazzolino|tandenborstel|cepillo de dientes|szczoteczka|tandborste|escova de dentes)/i,
  'rasoirs / lames': /(rasoir|razor|rasier|scheermes|maquinilla|rasoio|barbear|golarka|rakblad|rakhyvel)/i,
};
console.log(`— Répartition réelle sur ${o.length} offres —`);
for (const [nom, re] of Object.entries(GROUPE)) {
  const l = o.filter((x) => re.test(x.titre || ''));
  const parCat = l.reduce((a, x) => { a[x.categorie] = (a[x.categorie] || 0) + 1; return a; }, {});
  console.log(`  ${nom.padEnd(18)} ${String(l.length).padStart(4)} ${JSON.stringify(parCat)}`);
  const ELECT = /(electrique|electrique|electric|elektro|elektr|sonic|rechargeable|rakapparat|scheerapparaat)/i;
  const el = l.filter((x) => ELECT.test(x.titre || ''));
  console.log(`     dont « électrique » dans le titre : ${el.length} — ${JSON.stringify(el.reduce((a, x) => { a[x.categorie] = (a[x.categorie] || 0) + 1; return a; }, {}))}`);
}
