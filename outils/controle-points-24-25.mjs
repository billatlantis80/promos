/** Contrôle après collecte : règle des deux prix (Coolblue), point 24 (brosses à
 *  dents), point 25 (rasoir, capsules, vidéoprojecteur, répéteur), et contenu de
 *  l'onglet NOURRITURE par pays. Lecture seule. */
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('data/offres.json', 'utf8'));
const o = d.offres || d;
console.log(`généré ${d.genereLe} — ${o.length} offres`);

const cb = o.filter((x) => x.marchand === 'Coolblue');
console.log(`\nCOOLBLUE : ${cb.length} | avec 2e prix ${cb.filter((x) => x.prixAvant).length} | SANS ${cb.filter((x) => !x.prixAvant).length}`);
const jour = (d.journal || []).find((x) => x.source === 'regle-deux-prix');
console.log(`  journal « règle des deux prix » : ${jour ? JSON.stringify(jour.parMarchand) : 'AUCUNE PURGE JOURNALISÉE'}`);

const tests = {
  'brosses à dents': /(toothbrush|brosse[s]? à dents|brosse a dents|zahnb|spazzolino|tandenborstel|cepillo de dientes|szczoteczka|tandborste|escova de dentes)/i,
  'lame/rasoir': /(lame[s]? de rasoir|lame rasoir|razor blade|rasierklinge|lama di rasoio|cuchilla de afeitar|lamette|ostrze do golenia|rakblad)/i,
  'capsule lave-vaisselle': /(capsule[s]? .{0,12}lave-vaisselle|tablette[s]? lave-vaisselle|pastille[s]? lave-vaisselle|dishwasher tablet|geschirrspultab|spultab|vaatwastablet|pastillas lavavajillas|pastiglie lavastoviglie|tabletki do zmywarki|diskmaskinstablett)/i,
  'videoprojecteur': /(videoprojecteur|video-projecteur|projecteur video|beamer|videoproiettore|videoprojektor|proyector|proiettor[ei]|projetor|projektor)/i,
  'repeteur wifi': /(repeteur|repetidor|ripetitore|range extender|wifi repeater|versterker|verstarker|wzmacniacz wifi|forstarkare)/i,
};
console.log('\nPOINTS 24 ET 25 — répartition réelle :');
for (const [nom, re] of Object.entries(tests)) {
  const t = o.filter((x) => re.test(x.titre || ''));
  const parCat = t.reduce((a, x) => { a[x.categorie] = (a[x.categorie] || 0) + 1; return a; }, {});
  console.log(`  ${nom.padEnd(24)} ${String(t.length).padStart(4)} ${JSON.stringify(parCat)}`);
}

console.log('\nONGLET NOURRITURE :');
const nour = o.filter((x) => x.categorie === 'nourriture');
const parPays = nour.reduce((a, x) => { a[x.pays || '?'] = (a[x.pays || '?'] || 0) + 1; return a; }, {});
console.log(`  total ${nour.length} — par pays ${JSON.stringify(parPays)}`);
const parM = nour.reduce((a, x) => { a[x.marchand] = (a[x.marchand] || 0) + 1; return a; }, {});
const top = Object.entries(parM).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(`  marchands : ${top.map(([m, n]) => `${m} (${n})`).join(', ')}`);
console.log('  exemples :');
for (const x of nour.slice(0, 6)) console.log(`    [${x.pays}] ${(x.titre || '').slice(0, 70)}`);

console.log('\nBEAUTÉ / MODE — où sont-ils ?');
for (const cat of ['beaute', 'mode']) {
  const l = o.filter((x) => x.categorie === cat);
  const parM = l.reduce((a, x) => { a[x.marchand] = (a[x.marchand] || 0) + 1; return a; }, {});
  const top = Object.entries(parM).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`  ${cat.padEnd(8)} ${String(l.length).padStart(5)} — ${top.map(([m, n]) => `${m} (${n})`).join(', ')}`);
}
