/**
 * Gisement « bonne affaire » — les offres SANS prix vérifiable, qui sont
 * aujourd'hui jetées et que l'utilisateur veut voir affichées sans prix.
 *
 *   node outils/gisement-bonne-affaire.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';

const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;

const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Combien de bonnes promotions par pays');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estAmazon, estBonnePromo, estPromoVerifiee, estOffreEnseigne, estBonPlanPresse })`, ctx);

const GENERIQUE = /^(dealabs|hotukdeals|mydealz|chollometro|pepper(\s+(nl|pl))?|preisjaeger|presse|nl|pl|fr|de|es|it|pt|se|ie|gb|uk|at|be|marchand|abc|deal|deals)$/i;
const PRESSE = /(parisien|figaro|[ée]quipe|forbes|independent|mashable|estad|express|ginjfo|phototrend|labomaison|iphoneaddict|mac4ever|watchgeneration|num[ée]rique|phonandroid|dslweb|hdblog|tuttotech|tomshw|tuttoandroid|presse|dealabs|hotukdeals|mydealz|chollometro|preisjaeger|journal|magazine|bloomberg|wired|verge|01net|frandroid|clubic|journaldugeek|numerama|presse-citron|tomshardware|\.fr\b|\.com\b|\.it\b|\.net\b|\.be\b|\.de\b|\.es\b|\.pt\b|\.pl\b|\.se\b|\.ie\b|\.uk\b|\.nl\b)/i;

const estBoutique = (o) => {
  const m = String(o.marchand || '').trim();
  if (!m || GENERIQUE.test(m) || PRESSE.test(m)) return false;
  return true;
};

const deja = new Set(offres.filter(R.estBonnePromo));
const candidats = offres.filter((o) => !deja.has(o) && estBoutique(o) && o.titre);

const sansPrix = candidats.filter((o) => o.prix == null);
const avecPrix = candidats.filter((o) => o.prix != null);

console.log(`Catalogue : ${offres.length} offres`);
console.log(`Déjà retenues (2 prix / enseigne / presse) : ${deja.size}`);
console.log(`Candidats « boutique nommée, hors sélection » : ${candidats.length}`);
console.log(`   dont SANS prix (le gisement visé)  : ${sansPrix.length}`);
console.log(`   dont avec un prix mais pas retenues : ${avecPrix.length}`);
console.log('');

const avecImage = sansPrix.filter((o) => o.image).length;
const avecLien = sansPrix.filter((o) => o.lienMarchand || o.lienPage).length;
console.log(`Parmi les ${sansPrix.length} sans prix : ${avecImage} ont un visuel, ${avecLien} ont un lien`);
const chaud = sansPrix.filter((o) => o.temperature != null && o.temperature >= 100).length;
console.log(`   dont score communautaire >= 100 : ${chaud}`);
console.log('');

const parPays = {};
for (const o of sansPrix) parPays[o.pays || '?'] = (parPays[o.pays || '?'] || 0) + 1;
console.log('par pays :', Object.entries(parPays).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('');
const parSource = {};
for (const o of sansPrix) parSource[o.source || '?'] = (parSource[o.source || '?'] || 0) + 1;
console.log('par source :', Object.entries(parSource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('');
const parMarchand = {};
for (const o of sansPrix) parMarchand[o.marchand] = (parMarchand[o.marchand] || 0) + 1;
console.log('par marchand (top 25) :');
for (const [k, v] of Object.entries(parMarchand).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`   ${String(v).padStart(4)} ${k}`);
console.log('');
console.log('exemples :');
for (const o of sansPrix.slice(0, 8)) {
  console.log(`   [${o.pays}] ${o.marchand} | ${String(o.titre).slice(0, 70)} | visuel:${o.image ? 'oui' : 'non'} | temp:${o.temperature ?? '—'} | lien:${String(o.lienPage).slice(0, 40)}`);
}
