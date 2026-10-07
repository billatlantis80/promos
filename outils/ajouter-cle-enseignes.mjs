/** Ajoute la clé « enseignes & presse » aux NEUF dictionnaires de langues.js,
 *  juste après la ligne « bonnes promos » de chacun (une par langue, dans
 *  l'ordre du fichier : fr, nl, de, en, es, it, pt, pl, sv).
 *  Idempotent : si la clé est déjà là, le script ne fait rien. */
import { readFileSync, writeFileSync } from 'node:fs';

const CHEMIN = '/opt/data/webdev/projects/promos/public/langues.js';
const TRAD = ['enseignes & presse', 'winkels & pers', 'Händler & Presse', 'shops & press',
  'tiendas y prensa', 'negozi e stampa', 'lojas e imprensa', 'sklepy i prasa', 'butiker & press'];

let src = readFileSync(CHEMIN, 'utf8');
if (src.includes("'enseignes & presse'")) {
  console.log('clé déjà présente — rien à faire');
  process.exit(0);
}
const lignes = src.split('\n');
const cibles = [];
lignes.forEach((l, i) => { if (/^  'bonnes promos': '.*',$/.test(l)) cibles.push(i); });
if (cibles.length !== 9) {
  console.log(`ATTENDU 9 dictionnaires, trouvé ${cibles.length} — rien écrit (sécurité)`);
  process.exit(1);
}
for (let k = cibles.length - 1; k >= 0; k--) {
  lignes.splice(cibles[k] + 1, 0, `  'enseignes & presse': '${TRAD[k]}',`);
}
src = lignes.join('\n');
writeFileSync(CHEMIN, src);
console.log(`clé ajoutée dans ${cibles.length} dictionnaires : ${TRAD.join(' / ')}`);
