import { famille, classerOffre, categorieDeSource } from '../collecteur.mjs';

const fam = (t) => console.log(`famille(${JSON.stringify(t)}) = ${famille(t, '')}`);
const cl = (o) => console.log(`classerOffre(${JSON.stringify(o.titre)}, ${o.pays}, imp=${o.categorieImposee}) = ${classerOffre(o)}`);

console.log('--- ANIMAUX ---');
[
  'Croquettes pour chat stérilisé 2 kg',
  'Arbre à chat XXL avec griffoir',
  'Hundefutter Trockenfutter 15 kg',
  'Katzenstreu klumpend 10 L',
  'Ração para cães adultos 3 kg',
  'Pienso para gatos esterilizados',
  'Cibo per cani adulti',
  'karma dla psa 15kg',
  'Hundmat torrfoder 12 kg',
  'PETKIT Pura Max 2 Automatisk Kattlåda',
  'Litière pour chat agglomérante',
].forEach(fam);

console.log('\n--- VOYAGES (titre seul) ---');
[
  'Billet d avion Paris Lisbonne',
  'Croisière 7 nuits en Méditerranée',
  'Vol sec aller-retour Bruxelles Barcelone',
  'Location de voiture à Malaga',
  'Séjour tout compris 5 nuits en Égypte',
  'Coussin pour canapé 45x45',
  'Tondeuse à gazon électrique',
].forEach(fam);

console.log('\n--- VOYAGES vs ACTIVITÉ (page imposée) ---');
[
  { titre: 'Découvrez plus de 300 animaux au zoo de Maubeuge', pays: 'BE', categorieImposee: 'activite' },
  { titre: 'Visite du zoo de Pairi Daiza pour 2 personnes', pays: 'BE', categorieImposee: 'activite' },
  { titre: 'Séjour 2 nuits à Rome pour deux', pays: 'BE', categorieImposee: 'activite' },
  { titre: 'Dîner grec pour deux au restaurant', pays: 'BE', categorieImposee: 'activite' },
  { titre: 'Croisière fluviale sur le Danube', pays: 'DE', categorieImposee: 'activite' },
  { titre: 'Concert de jazz à Bruxelles', pays: 'BE', categorieImposee: 'activite' },
  { titre: 'Soin du visage au choix en institut', pays: 'BE', categorieImposee: 'activite' },
  { titre: 'Plongée sous-marine aux Maldives', pays: 'BE', categorieImposee: 'activite' },
].forEach(cl);

console.log('\n--- CASSE CORRIGÉE ---');
[
  'DANISH ENDURANCE Bokserki Bambusowe, Oddychająca Bielizna, 6 lub 10-Pak | Bokserki bambusowe, dla podróży',
  'Union Kino Ludwigsburg feiert 75. Geburtstag - Digger mit Tom Cruise',
  'Momcozy Chauffe-Biberon Portable 500 ml, Idéal Voyage',
].forEach(fam);

console.log('\n--- SOURCES ---');
['Viajes', 'Urlaub & Reisen', 'Podróże', 'Travel', 'Reizen', 'Voyages'].forEach((s) => console.log(`categorieDeSource(${JSON.stringify(s)}) = ${categorieDeSource(s)}`));
