import { classerOffre, MOTS_FORTS, FAMILLES } from '../collecteur.mjs';
console.log('MOTS_FORTS.jouets contient hot wheels :', MOTS_FORTS.jouets.includes('hot wheels'));
console.log('FAMILLES.jouets contient hot wheels :', FAMILLES.jouets.includes('hot wheels'));
const cas = [
  { titre: 'Upto 50% off Character Clothing Incl. Bluey, Disney, Paw Patrol, Hot Wheels, K-Pop + Extra 10% off', categorieSource: 'Fashion & Accessories', pays: 'GB' },
  { titre: 'Brosse Nettoyage Radiateur 117cm I Plumeau Radiateur Longue Fine', categorieSource: 'amazon', pays: 'BE' },
  { titre: 'WAGNER Airless system natryskowy Control Pro 250 M do farb ściennych, lakierów i lazurów', categorieSource: 'vente flash', pays: 'PL' },
  { titre: 'Bosch Professional: narzędzie wielofunkcyjne Multi-Cutter GOP 40-30', categorieSource: 'vente flash', pays: 'PL' },
];
for (const c of cas) console.log(`${classerOffre(c).padEnd(15)} | src=${c.categorieSource} | ${c.titre.slice(0, 70)}`);
