#!/usr/bin/env node
/* =============================================================================
   L'APERÇU DE L'ONGLET DES RÈGLES — une page autonome, ouvrable dans un
   navigateur, SANS le mot de passe du panneau et SANS le réseau.

   Pourquoi il existe : un onglet derrière un verrou ne se vérifie pas à l'œil
   avant d'être livré, et « ça devrait s'afficher » n'est pas une vérification.
   Ici, la VRAIE fonction de dessin du panneau (extraite du fichier publié, jamais
   réécrite) tourne sur le VRAI catalogue publié, et le résultat est enveloppé
   dans la VRAIE feuille de style du panneau.

   Usage : node bin/apercu-regles.mjs [chemin-de-sortie]
   Par défaut : data/apercu-regles.html (hors dépôt publié, cf. .gitignore).
   ============================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PANNEAU = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');
const SORTIE = process.argv[2] || path.join(RACINE, 'data', 'apercu-regles.html');

/** Le document de remplacement — il RETIENT ce qu'on lui écrit. Un stub qui
 *  oublie rendrait un aperçu VIDE, et l'aperçu vide se lirait comme un défaut
 *  de l'onglet alors que c'est un défaut de l'outil. */
function fauxDocument() {
  const ecrits = new Map();
  const element = (id) => {
    const e = { id, value: '', dataset: {}, style: {}, classList: { toggle() {} } };
    Object.defineProperty(e, 'innerHTML', { get: () => ecrits.get(id) || '', set: (v) => ecrits.set(id, String(v)) });
    Object.defineProperty(e, 'textContent', { get: () => ecrits.get(`${id}.texte`) || '', set: (v) => ecrits.set(`${id}.texte`, String(v)) });
    return e;
  };
  return { ecrits, getElementById: (id) => element(id), querySelectorAll: () => [], createElement: () => element('?') };
}

const coupe = (debut, fin) => {
  const i = PANNEAU.indexOf(debut);
  if (i < 0) throw new Error(`marqueur introuvable : ${debut}`);
  const j = PANNEAU.indexOf(fin, i);
  if (j < 0) throw new Error(`marqueur de fin introuvable après ${debut}`);
  return PANNEAU.slice(i, j);
};

const source = [
  'let regles = null; let erreurRegles = ""; let filtreRegles = ""; let etatRegles = "tous"; let catRegles = "";',
  PANNEAU.match(/const nf = new Intl\.NumberFormat\([^)]*\);/)[0],
  coupe('const esc = (s) =>', '\nconst ilYA'),
  coupe('/* ---------- LES RÈGLES DU SITE ----------', '/* ---------- Branchements ----------'),
].join('\n');

const document = fauxDocument();
const ctx = vm.createContext({
  document, console, Intl, Date, JSON, Math, Number, String, Object, Array, Set, Map, RegExp, isNaN, parseFloat,
  setTimeout, clearTimeout,
});
ctx.window = ctx;
vm.runInContext(source, ctx);

const catalogue = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'regles.json'), 'utf8'));
ctx.__regles = catalogue;
vm.runInContext('regles = __regles; dessinerRegles();', ctx);

const style = PANNEAU.slice(PANNEAU.indexOf('<style>') + 7, PANNEAU.indexOf('</style>'));
const bloc = (id) => document.ecrits.get(id) || '';
const texte = (id) => document.ecrits.get(`${id}.texte`) || '';

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aperçu — les règles du site (Kazendra)</title>
<style>${style}</style>
<style>
/* Le bandeau d'aperçu : il dit ce que cette page EST, pour qu'on ne la prenne
   jamais pour le panneau lui-même (qui, lui, est derrière un mot de passe). */
#apercu{position:sticky;top:0;z-index:9;background:#eb912d;color:#0d2536;
  font:600 12.5px/1.4 system-ui,sans-serif;padding:8px 16px}
#apercu code{font-weight:800}
</style>
</head><body>
<div id="apercu">APERÇU de l'onglet « Règles » — page autonome, <b>sans mot de passe</b>,
  dessinée par la fonction même du panneau sur <code>public/regles.json</code>.
  Aperçu du ${new Date().toLocaleString('fr-BE')}.</div>
<div class="boite" style="padding-top:18px">
  <div class="rub">
    <h2>Les règles du site</h2>
    <p class="aide">${texte('reglesChapeau')}</p>
    ${bloc('reglesComptes')}
    ${bloc('reglesFiltres')}
    ${bloc('reglesListe')}
  </div>
</div>
</body></html>`;

fs.writeFileSync(SORTIE, html, 'utf8');
const texteEntier = bloc('reglesListe');
console.log(`Aperçu écrit : ${SORTIE} (${(html.length / 1024).toFixed(0)} Ko)`);
console.log(`  ${catalogue.total} règle(s) dessinée(s) · ${(texteEntier.match(/class="regle/g) || []).length} fiche(s) `
  + `· catégories : ${(texteEntier.match(/class="rcat"/g) || []).length} · thèmes : ${(texteEntier.match(/class="rtheme"/g) || []).length}`);
for (const trou of ['undefined', 'NaN', '[object Object]']) {
  if (texteEntier.includes(trou)) { console.error(`  ⚠ « ${trou} » apparaît dans l'aperçu`); process.exit(1); }
}
