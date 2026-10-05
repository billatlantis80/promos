/** Debug ciblé du mélange — cas du test « boutiques avant presse ». */
import fs from 'node:fs';
import vm from 'node:vm';

const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Combien de bonnes promotions par pays');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estAmazon, estBonPlanPresse, estOffreEnseigne, melanger, PART_AMAZON, MELANGE_MIN })`, ctx);

const mk = (m, e = {}) => ({ marchand: m, prix: null, prixAvant: null, remise: null, temperature: null, ...e });
const amazon = Array.from({ length: 30 }, (_, i) => mk('Amazon', { prix: i + 1, remise: 50, prixAvant: (i + 1) * 2 }));
const boutiques = Array.from({ length: 17 }, (_, i) => mk('Coolblue', { prix: i + 1, categorieSource: 'enseigne' }));
const presse = [mk('Le Parisien', { prix: 50, prixAvant: 100, remise: 50 })];
const liste = [...amazon, ...boutiques, ...presse];

const A = liste.filter(R.estAmazon);
const B = liste.filter((o) => !R.estAmazon(o));
const nA = Math.min(A.length, Math.floor((B.length * R.PART_AMAZON) / (1 - R.PART_AMAZON)));
const nB = Math.min(B.length, Math.round((nA * (1 - R.PART_AMAZON)) / R.PART_AMAZON));
console.log(`A=${A.length} B=${B.length} → nAmazon=${nA} nAutres=${nB} total=${nA + nB} (MELANGE_MIN=${R.MELANGE_MIN})`);
console.log('presse reconnue ?', R.estBonPlanPresse(presse[0]), '| boutiques reconnues ?', R.estOffreEnseigne(boutiques[0]), R.estBonPlanPresse(boutiques[0]));
const Btriees = [...B].sort((a, b) => (R.estBonPlanPresse(a) ? 1 : 0) - (R.estBonPlanPresse(b) ? 1 : 0));
console.log('3 derniers du camp des 40 % après tri :', Btriees.slice(-3).map((o) => o.marchand).join(' · '));
const l = R.melanger(liste);
console.log(`rendu : ${l.length} lignes (attendu ${nA + nB})`);
console.log('Parisien index', l.findIndex((o) => o.marchand === 'Le Parisien'), '| 1re Coolblue index', l.findIndex((o) => o.marchand === 'Coolblue'));
console.log('5 derniers :', l.slice(-5).map((o) => o.marchand).join(' · '));
