/**
 * Récapitulatif des sources — extrait DU CODE, croisé avec les données réelles.
 *
 * Rien n'est écrit de mémoire : la liste des sites vient de `TOUTES_SOURCES`
 * (collecteur.mjs, importable sans lancer la collecte grâce à sa garde
 * `estProgramme`), et les volumes viennent de docs/offres.json — le fichier
 * réellement publié.
 *
 *   node outils/recapitulatif-sources.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { TOUTES_SOURCES } from '../collecteur.mjs';

const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;

// Les fonctions de sélection de app.js, pour compter ce qui est AFFICHÉ.
const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Combien de bonnes promotions par pays');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estAmazon, estPromoVerifiee, estBonnePromo, dedoublonner, melanger })`, ctx);

const mix = R.melanger(R.dedoublonner(offres.filter(R.estBonnePromo)));
const parSource = (liste) => {
  const c = {};
  for (const o of liste) c[o.source || o.sourceId || '?'] = (c[o.source || o.sourceId || '?'] || 0) + 1;
  return c;
};
const collectees = parSource(offres);
const affichees = parSource(mix);

// Regroupement par TYPE déclaré dans le code.
const parType = {};
for (const s of TOUTES_SOURCES) (parType[s.type] = parType[s.type] || []).push(s);

const TYPE_NOM = {
  dealabs: 'COMMUNAUTÉS DE BONS PLANS (RSS public)',
  enseigne: 'ENSEIGNES — page d’offres officielle',
  amazon: 'AMAZON — page de recherche (rendue côté serveur)',
  flash: 'AMAZON — ventes flash du jour (/gp/goldbox)',
  presse: 'PRESSE / GOOGLE NEWS',
  veille: 'VEILLE MARCHANDE (titres, pas de prix)',
};
const ordre = ['flash', 'amazon', 'enseigne', 'dealabs', 'presse', 'veille'];

console.log(`TOTAL : ${TOUTES_SOURCES.length} flux déclarés · ${offres.length} offres collectées · ${mix.length} affichées`);
for (const t of ordre) {
  const lot = parType[t];
  if (!lot) continue;
  console.log('');
  console.log(`=== ${TYPE_NOM[t] || t} — ${lot.length} flux ===`);
  const pays = {};
  for (const s of lot) pays[s.pays || '?'] = (pays[s.pays || '?'] || 0) + 1;
  console.log(`   pays : ${Object.entries(pays).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  const ex = lot.slice(0, 3);
  for (const s of ex) console.log(`   ex. [${s.pays}] ${s.nom} — ${s.url}`);
  if (lot.length > 3) console.log(`   … et ${lot.length - 3} autres`);
  // volume réel par nom de source
  const noms = {};
  for (const s of lot) noms[s.nom] = (collectees[s.nom] || 0) + (noms[s.nom] || 0);
  const aff = {};
  for (const s of lot) if (affichees[s.nom]) aff[s.nom] = aff[s.nom] || 0;
  console.log(`   volumes collectés : ${Object.entries(noms).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);
}

console.log('');
console.log('=== CE QUI ARRIVE À L’ÉCRAN, PAR SOURCE (mélange 60/40, tous pays) ===');
for (const [k, v] of Object.entries(affichees).sort((a, b) => b[1] - a[1])) {
  const total = collectees[k] || 0;
  console.log(`   ${String(v).padStart(4)} affichées / ${String(total).padStart(5)} collectées  ${k}`);
}
