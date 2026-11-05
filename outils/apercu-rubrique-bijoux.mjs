/**
 * Ce que la rubrique BIJOUX attrape RÉELLEMENT, sur le catalogue publié.
 *
 * Rejoue `famille()` — la fonction qui décide au moment de la collecte — sur
 * chaque offre existante, avec le titre et la rubrique d'origine. Ce n'est pas
 * une estimation : c'est la fonction de production, appelée sur les vraies
 * données. Affiche les offres qui ARRIVENT en bijoux, celles qui en PARTENT, et
 * vérifie qu'aucun autre déplacement n'a été provoqué au passage.
 *
 * Usage : node outils/apercu-rubrique-bijoux.mjs [--tout]
 */
import { readFileSync } from 'node:fs';
import { classerOffre } from '../collecteur.mjs';

const TOUT = process.argv.includes('--tout');
const brut = JSON.parse(readFileSync(new URL('../data/offres.json', import.meta.url), 'utf8'));
const liste = Array.isArray(brut) ? brut : (brut.offres || []);
console.log(`Catalogue : ${liste.length} offres.\n`);

/* On rejoue `classerOffre`, PAS `famille` : c'est la fonction qui décide
 * réellement au moment de la collecte, et elle seule respecte les rubriques
 * IMPOSÉES par la source (Groupon → activité, Zooplus → animaux). Rejouer
 * `famille` directement faisait apparaître 123 faux « déplacements » qui
 * n'étaient que des rubriques imposées non appliquées — un chiffre faux, donc. */
let versBijoux = 0; let horsBijoux = 0; let inchanges = 0; let autres = 0;
const arrives = []; const partis = []; const derives = [];

for (const o of liste) {
  const avant = o.categorie || 'autre';
  const source = o.categorieSource || '';
  const apres = classerOffre(o);
  if (avant === 'bijoux' && apres === 'bijoux') { inchanges += 1; continue; }
  if (apres === 'bijoux') { versBijoux += 1; arrives.push([avant, o.titre, source]); continue; }
  if (avant === 'bijoux') { horsBijoux += 1; partis.push([apres, o.titre, source]); continue; }
  if (avant === apres) { inchanges += 1; continue; }
  autres += 1;
  derives.push([avant, apres, o.titre, source]);
}

console.log(`Offres qui PASSENT en Bijoux : ${versBijoux}`);
const parProvenance = {};
for (const [avant] of arrives) parProvenance[avant] = (parProvenance[avant] || 0) + 1;
for (const [c, n] of Object.entries(parProvenance).sort((a, b) => b[1] - a[1])) {
  console.log(`   depuis ${c.padEnd(14)} ${n}`);
}
console.log(`\nDétail :`);
for (const [avant, t, s] of arrives) {
  console.log(`   [${avant} -> bijoux] ${String(t).replace(/\s+/g, ' ').slice(0, 104)}`);
}
console.log(`\nOffres qui QUITTENT Bijoux : ${horsBijoux}`);
for (const [apres, t, s] of partis) {
  console.log(`   [bijoux -> ${apres}] ${String(t).replace(/\s+/g, ' ').slice(0, 104)}`);
}

console.log(`\nAUTRES déplacements provoqués par ce changement : ${autres}`);
if (autres) {
  const paires = {};
  for (const [a, b] of derives) paires[`${a} -> ${b}`] = (paires[`${a} -> ${b}`] || 0) + 1;
  for (const [p, n] of Object.entries(paires).sort((x, y) => y[1] - x[1])) {
    console.log(`   ${p.padEnd(30)} ${n}`);
  }
  if (TOUT) for (const [a, b, t] of derives) {
    console.log(`      [${a} -> ${b}] ${String(t).replace(/\s+/g, ' ').slice(0, 96)}`);
  } else console.log('   (relancer avec --tout pour la liste)');
}

/* Total de la rubrique après rejeu — le chiffre qui compte pour l'en-tête. */
const total = liste.filter((o) => classerOffre(o) === 'bijoux').length;
console.log(`\nTOTAL rubrique Bijoux après rejeu : ${total} offre(s).`);
console.log(`Offres inchangées : ${inchanges} / ${liste.length}.`);
