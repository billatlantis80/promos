/** Quelles offres réelles portent « brosse à dents » / équivalents 9 langues, et
 *  où sont-elles rangées ? (outil jetable, lecture seule) */
import { readFileSync } from 'node:fs';
const offres = JSON.parse(readFileSync('docs/offres.json', 'utf8'));
const liste = Array.isArray(offres) ? offres : (offres.offres || offres.items || []);
const MOTS = /(brosse a dents|brosse à dents|zahnb|tandenborstel|cepillo de dientes|spazzolino|szczoteczka|eltandborste|toothbrush|sonicare|oral-?b|waterpik)/i;
const EF = /(kids?|bambini|bambina|bambino|enfants?|ni[nñ]os?|kinder|crian|child|dzieci|barn|fille|garcon)/i;
const trouvees = liste.filter((o) => MOTS.test(o.titre || o.title || ''));
console.log(`Offres totales : ${liste.length}`);
console.log(`Portant un mot « brosse à dents » : ${trouvees.length}\n`);
for (const o of trouvees) {
  const t = o.titre || o.title;
  console.log(`[${(o.categorie || o.rubrique || '?').padEnd(15)}] ${EF.test(t) ? 'ENFANT ' : '       '} ${t.slice(0, 95)}`);
}
