/** Contrôle après collecte : Coolblue (règle des deux prix), brosses à dents
 *  (point 24) et rubriques. Lecture seule. */
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('data/offres.json', 'utf8'));
const o = d.offres || d;
console.log(`généré      : ${d.genereLe}`);
console.log(`total       : ${o.length}`);
const cb = o.filter((x) => x.marchand === 'Coolblue');
console.log(`Coolblue    : ${cb.length} | avec 2e prix ${cb.filter((x) => x.prixAvant).length} | sans ${cb.filter((x) => !x.prixAvant).length}`);
const sansPrixPays = cb.filter((x) => !x.prixAvant).reduce((a, x) => { a[x.pays] = (a[x.pays] || 0) + 1; return a; }, {});
console.log(`  Coolblue sans 2e prix par pays : ${JSON.stringify(sansPrixPays)}`);
const tb = o.filter((x) => /toothbrush|brosse à dents|brosse a dents|zahnb|spazzolino|tandenborstel|cepillo de dientes|szczoteczka|tandborste|escova de dentes/i.test(x.titre || ''));
console.log(`brosses dents: ${tb.length} ${JSON.stringify(tb.reduce((a, x) => { a[x.categorie] = (a[x.categorie] || 0) + 1; return a; }, {}))}`);
console.log(`  restées hors électroménager :`);
for (const x of tb.filter((x) => x.categorie !== 'electromenager')) console.log(`    [${x.categorie}] ${(x.titre || '').slice(0, 80)}`);
console.log(`rubriques   : ${JSON.stringify(o.reduce((a, x) => { a[x.categorie] = (a[x.categorie] || 0) + 1; return a; }, {}))}`);
const ko = (d.journal || []).filter((x) => !x.ok).map((x) => x.source || x.id);
console.log(`sources en échec : ${ko.join(', ') || 'aucune'}`);
