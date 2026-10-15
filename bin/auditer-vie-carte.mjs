// AUDITER LA VIE D'UNE CARTE — LA RÈGLE DES CINQ JOURS, VUE DE L'EXTÉRIEUR.
//
//   node bin/auditer-vie-carte.mjs [fichier]
//
//  À quoi ça sert. La règle s'éprouve toute seule (tests/vie-de-la-carte-cinq-jours),
//  mais une épreuve dit ce que le code fait sur des cas fabriqués ; elle ne dit pas
//  ce que le CATALOGUE PUBLIÉ contient. Cet outil relit le fichier servi par le site
//  et **rejoue la règle depuis sa définition écrite**, sans réutiliser une seule
//  ligne du collecteur : c'est un contrôle indépendant, pas une redite.
//
//  La règle, en une phrase : au-delà de cinq jours, une carte ne survit que si le
//  tour de sa source n'a pas avancé depuis qu'elle lui a été servie.
//  (`tour <= serviceAuTour` — voir verdictDeCalendrier, collecteur.mjs.)
//
//  Quatre seaux, et un seul est une faute :
//    A. âge ≤ 5 j                     → la promesse, tenue ;
//    B. > 5 j, servie au dernier tour → la garde protège : la source n'a pas reparlé ;
//    C. > 5 j, source sans compteur   → la garde protège par accident (source absente) ;
//    D. > 5 j, la source a reparlé sans la resservir → **VIOLATION**.
//
//  Le seau D doit rester à zéro sur tout catalogue publié. C'est la seule chose que
//  cet outil refuse.
import fs from 'node:fs';

const chemin = process.argv[2] || 'docs/offres.json';
const d = JSON.parse(fs.readFileSync(chemin, 'utf8'));
const t0 = new Date(d.genereLe).getTime();
const tours = d.toursParSource || {}, rendus = d.rendusParSource || {};
const age = (o) => {
  // `premiereVue` d'abord, `vuLe` en repli : exactement le repli du collecteur.
  const t = new Date(o.premiereVue || o.vuLe || '').getTime();
  return Number.isFinite(t) && t !== 0 ? (t0 - t) / 86400000 : null;
};

const seaux = { A: [], B: [], C: [], D: [] };
const parSource = { B: {}, C: {} };
for (const o of d.offres) {
  if (o.type === 'article') continue;               // la veille a sa propre règle (R.8)
  const a = age(o);
  if (a === null || a <= 5) { seaux.A.push(o); continue; }
  const servi = Number.isFinite(o.serviceAuTour) ? o.serviceAuTour : null;
  const tour = Number.isFinite(tours[o.sourceId]) ? tours[o.sourceId] : null;
  const cle = (tour === null || servi === null) ? 'C' : (tour > servi ? 'D' : 'B');
  seaux[cle].push(o);
  if (parSource[cle]) parSource[cle][o.sourceId] = (parSource[cle][o.sourceId] || 0) + 1;
}

const j = (n) => +n.toFixed(2);
const plusAncienne = (s) => (s.length ? j(Math.max(...s.map(age))) : null);
const cartes = d.offres.filter((o) => o.type !== 'article').length;

console.log(`fichier      : ${chemin}  (genereLe ${d.genereLe})`);
console.log(`cartes       : ${cartes} affichées · ${d.totalVeille} articles`);
console.log('');
console.log(`A. âge ≤ 5 j                       : ${seaux.A.length}  (la plus ancienne : ${plusAncienne(seaux.A)} j)`);
console.log(`B. > 5 j, servie au dernier tour   : ${seaux.B.length}  (la plus ancienne : ${plusAncienne(seaux.B)} j)`);
console.log(`C. > 5 j, source sans compteur     : ${seaux.C.length}  (la plus ancienne : ${plusAncienne(seaux.C)} j)`);
console.log(`D. > 5 j, servie puis abandonnée   : ${seaux.D.length}  ${seaux.D.length ? '← VIOLATION' : '(aucune : la règle tient)'}`);
if (seaux.C.length) console.log(`\nrépartition de C : ${JSON.stringify(parSource.C)}`);
if (seaux.B.length) console.log(`répartition de B : ${JSON.stringify(parSource.B)}`);
if (seaux.D.length) {
  console.log('\nVIOLATIONS (la source a reparlé sans les resservir) :');
  for (const o of seaux.D.slice(0, 10)) {
    console.log(`  ${j(age(o))} j  ${o.sourceId}  servi=${o.serviceAuTour} tour=${tours[o.sourceId]}  ${String(o.titre).slice(0, 50)}`);
  }
}
console.log(`\njournal du passage : ${JSON.stringify(d.donnees?.carte ?? 'carte absente')}`);

// Code de sortie : non nul seulement s'il y a une violation. Un outil de contrôle
// qui parle tout le temps ne se lit plus — même discipline que la collecte.
process.exit(seaux.D.length ? 1 : 0);
