/**
 * MESURE DE LA LIAISON marché belge ↔ sources — on ne suppose pas, on compte.
 *
 * Ce que ce contrôle regarde, dans l'ordre :
 *   1. les compteurs de liaison (flux / veille / aucun) sur les 139 acteurs ;
 *   2. le détail par catégorie ;
 *   3. des CAS NOMMÉS, vérifiés un par un (Delhaize, Coolblue, Mediamarkt…) :
 *      c'est là qu'une liaison fausse se voit tout de suite ;
 *   4. les FAUX POSITIFS possibles : un acteur relié à une source dont le nom
 *      n'a visiblement rien à voir. Un rapprochement approximatif ferait croire
 *      qu'un acteur est couvert alors qu'il ne l'est pas.
 *
 * Lancement : node outils/mesure-liaison-acteurs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { liaisonActeurs } from '../public/acteurs.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

const catalogue = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'offres.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'acteurs.json'), 'utf8'));

const r = liaisonActeurs(catalogue, base);
const c = r.compteurs;

console.log(`SOURCES du catalogue : ${catalogue.sources.length} · offres : ${catalogue.offres.length}`);
console.log(`ACTEURS de la base   : ${base.acteurs.length} · domaines : ${base.acteurs.reduce((n, a) => n + a.domaines.length, 0)}`);
console.log();
console.log('LIAISON :');
console.log(`   flux   (branché, on lit chez lui)  : ${c.flux}`);
console.log(`   veille (vu via un moteur seulement): ${c.veille}`);
console.log(`   aucun  (pas suivi du tout)         : ${c.aucun}`);
console.log(`   annonces reliées au marché belge   : ${c.annonces} sur ${catalogue.offres.length}`);
console.log();

console.log('PAR CATÉGORIE (acteurs · flux · veille · aucun · annonces) :');
for (const x of r.categories) {
  console.log(`   ${String(x.acteurs).padStart(3)} act · ${String(x.flux).padStart(2)} flux · ${String(x.veille).padStart(2)} veille · ${String(x.aucun).padStart(2)} aucun · ${String(x.annonces).padStart(6)} ann · ${x.categorie}`);
}
console.log();

const parNom = new Map(r.acteurs.map((a) => [a.nom, a]));
const CAS = [
  'Delhaize', 'Colruyt Group', 'Carrefour Belgique', 'ALDI', 'Lidl', 'Intermarché', 'Albert Heijn',
  'MediaMarkt', 'Coolblue', 'Vanden Borre', 'Krëfel',
  'Action', 'Kruidvat', 'Hema', 'DreamLand', 'Fun', 'Maxi Toys', 'Zooplus',
  'Amazon', 'Frandroid / 01net', 'Social Deal & Outspot', 'Groupon', 'FlixBus & BlaBlaCar',
  'Proximus', 'Telenet', 'Booking.com & Expedia', 'Veepee / Zalando Lounge',
];
console.log('CAS NOMMÉS :');
for (const nom of CAS) {
  const a = parNom.get(nom);
  if (!a) { console.log(`   ?  ${nom} — ABSENT de la base`); continue; }
  const src = [...a.liaison.flux.map((s) => s.nom + ' (flux)'), ...a.liaison.veille.map((s) => s.nom + ' (veille)')];
  console.log(`   ${a.etat.padEnd(6)} ${nom.padEnd(28)} ${String(a.annonces).padStart(5)} ann  ${src.length ? src.join(', ') : '— rien'}`);
}
console.log();

console.log('À RÉGULARISER — les acteurs en VEILLE (donc pas réellement branchés) :');
const veille = r.acteurs.filter((a) => a.etat === 'veille').sort((x, y) => x.nom.localeCompare(y.nom));
console.log(`   ${veille.length} acteur(s) : ` + veille.map((a) => a.nom).join(' · '));
console.log();

console.log('PAS SUIVIS DU TOUT — les acteurs en « aucun » :');
const aucun = r.acteurs.filter((a) => a.etat === 'aucun').sort((x, y) => x.nom.localeCompare(y.nom));
console.log(`   ${aucun.length} acteur(s) : ` + aucun.map((a) => a.nom).join(' · '));
console.log();

/* --- CONTRÔLE DES FAUX POSITIFS ------------------------------------------
 * Une liaison par NOM est une commodité, et une commodité peut se tromper. On
 * liste donc les liaisons obtenues par le nom SEUL (aucun domaine en commun),
 * pour qu'un humain puisse les relire. Si l'une d'elles est absurde, la règle
 * est trop large — et il faut la resserrer, pas l'excuser.
 */
console.log('LIAISONS PAR LE NOM SEUL (à relire — c\'est là qu\'une erreur se cacherait) :');
const parDomaine = new Map();
for (const s of catalogue.sources) {
  if (/news\.google\.com|bing\.com\/news/.test(s.url)) continue;
  try { parDomaine.set(new URL(s.url).hostname.replace(/^www\./, '').toLowerCase(), s); } catch { /* ignore */ }
}
let n = 0;
for (const a of r.acteurs) {
  const domaines = a.domaines || [];
  const parNomSeul = [...a.liaison.flux, ...a.liaison.veille]
    .filter((s) => !s.nom || ![...parDomaine.keys()].some((d) => domaines.some((x) => d === x || d.endsWith('.' + x) || x.endsWith('.' + d))));
  if (parNomSeul.length) { n += 1; console.log(`   ${a.nom}  ⟵  ${parNomSeul.map((s) => s.nom).join(', ')}`); }
}
if (!n) console.log('   (aucune)');
