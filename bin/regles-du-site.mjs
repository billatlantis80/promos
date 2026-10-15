#!/usr/bin/env node
/* =============================================================================
   LES RÈGLES DU SITE — catalogue publié pour le panneau d'administration.

   Demande de B, 15/10/2026 : « peux-tu rajouter un onglet "règle" [...] toutes les
   règles qui gèrent le site [...] classées par catégorie, par thème et
   numérotées. »

   CE QUE CE SCRIPT FAIT, ET POURQUOI IL FAIT PLUS QUE RECOPIER.
   Le catalogue écrit (`donnees/regles-du-site.json`) porte l'ÉNONCÉ, la
   catégorie, l'état et la source. Il ne porte AUCUNE valeur : chaque valeur est
   relue ici, dans le fichier qui la fait vivre — `collecteur.mjs`,
   `public/regles-affichage.js`, `public/app.js`. Autrement dit l'onglet ne peut
   pas mentir : s'il affiche « cinq jours », c'est que le code dit cinq jours
   aujourd'hui, à l'instant où la page a été publiée.

   Et parce qu'un tuyau qui fuit ne se voit pas tout seul : si une constante
   citée n'existe plus, ou si une épreuve citée a disparu, le script REFUSE de
   publier (code de sortie non nul). Le panneau n'affichera jamais une règle
   dont la source s'est tue.

   Sortie : `public/regles.json` (copié dans `docs/` par la publication, comme
   le reste de `public/`).
   ============================================================================= */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGUE = path.join(RACINE, 'donnees', 'regles-du-site.json');
const SORTIE = path.join(RACINE, 'public', 'regles.json');

/* ---- Les fichiers dont la valeur est LUE -----------------------------------
 * Deux façons, et il faut les deux :
 *   - les modules `collecteur.mjs` et `regles-affichage.js` sont IMPORTÉS :
 *     c'est la valeur réelle, et pas une valeur devinée dans du texte ;
 *   - `public/app.js` n'est PAS importable (il touche au document dès la
 *     première ligne) : ses constantes sont LISES dans la source, par motif,
 *     et le script échoue si le motif ne rend rien.
 * Un fichier peut être cité sans être « lu » (une page légale, une épreuve) :
 * sa seule existence est alors vérifiée.
 */
const MODULES = {
  'collecteur.mjs': 'collecteur.mjs',
  'public/regles-affichage.js': 'public/regles-affichage.js',
};

/** Ce que le catalogue cite comme valeurs : le nom, et le fichier où il vit. */
function normaliserFichier(f) {
  return String(f || '').replace(/^\.\//, '');
}

/* ---- L'évaluation d'un littéral, quand le module n'est pas importable ------- */
function lireLitteral(texte) {
  const t = texte.trim().replace(/;$/, '');
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^'.*'$/.test(t) || /^".*"$/.test(t)) return t.slice(1, -1);
  return null;                                    // objet, tableau, expression
}

function lireDansSource(chemin, nom) {
  const src = fs.readFileSync(path.join(RACINE, chemin), 'utf8');
  const motifs = [
    new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${nom}\\s*=\\s*([^\\n;]+)`, 'm'),
    new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${nom}\\s*=\\s*`, 'm'),
  ];
  const m = src.match(motifs[0]);
  if (!m) return { trouve: src.includes(nom), valeur: null, luDe: 'source' };
  return { trouve: true, valeur: lireLitteral(m[1]), luDe: 'source' };
}

/* ---- L'import, une fois par fichier ---------------------------------------- */
const espaces = new Map();
async function espace(chemin) {
  if (!espaces.has(chemin)) {
    const mod = await import(pathToFileURL(path.join(RACINE, chemin)).href);
    espaces.set(chemin, mod);
  }
  return espaces.get(chemin);
}

/** La valeur d'une constante : d'abord l'import, ensuite la source. */
async function valeurLue(nom, chemin) {
  const f = normaliserFichier(chemin);
  const abs = path.join(RACINE, f);
  if (!fs.existsSync(abs)) {
    return { nom, fichier: f, trouve: false, valeur: null, luDe: 'absent', erreur: `fichier introuvable : ${f}` };
  }
  if (MODULES[f]) {
    const mod = await espace(MODULES[f]);
    if (Object.prototype.hasOwnProperty.call(mod, nom)) {
      const v = mod[nom];
      return { nom, fichier: f, trouve: true, valeur: v instanceof RegExp ? null : v, luDe: 'import' };
    }
  }
  const r = lireDansSource(f, nom);
  return { nom, fichier: f, trouve: r.trouve, valeur: r.valeur, luDe: r.luDe,
           erreur: r.trouve ? undefined : `constante introuvable dans ${f} : ${nom}` };
}

/** La forme affichable d'une valeur, et celle qui se lit par une machine. */
function formater(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return { texte: v ? 'allumé' : 'éteint', brut: v, genre: 'booleen' };
  if (typeof v === 'number') return { texte: String(v), brut: v, genre: 'nombre' };
  if (typeof v === 'string') return { texte: v, brut: v, genre: 'chaine' };
  return { texte: JSON.stringify(v), brut: v, genre: 'autre' };
}

function texteAvecUnite(v, unite) {
  if (!v) return null;
  if (!unite) return v.texte;
  if (unite === '%' || unite === '°' || unite === '×') return `${v.texte} ${unite}`;
  return `${v.texte} ${unite}`;
}

/* ---- Le contrôle, puis l'écriture ------------------------------------------ */
const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
const manquants = [];
let totalRegles = 0;
const parEtat = {};

const categories = [];
for (const cat of catalogue.categories) {
  const themes = [];
  for (const th of cat.themes) {
    const regles = [];
    for (const r of th.regles) {
      totalRegles += 1;
      parEtat[r.etat] = (parEtat[r.etat] || 0) + 1;

      const valeurs = [];
      for (const v of (r.valeurs || [])) {
        const lu = await valeurLue(v.nom, v.fichier);
        if (!lu.trouve) manquants.push(`${r.num} : ${lu.erreur}`);
        const f = formater(lu.valeur);
        valeurs.push({
          nom: v.nom,
          fichier: lu.fichier,
          luDe: lu.luDe,
          unite: v.unite || null,
          texte: texteAvecUnite(f, v.unite),
          brut: f ? f.brut : null,
        });
      }
      const cites = [];
      for (const nom of (r.cite || [])) {
        const lu = await valeurLue(nom, r.source);
        if (!lu.trouve) manquants.push(`${r.num} : nom cité introuvable dans ${r.source} — ${nom}`);
        cites.push(nom);
      }

      // La source et l'épreuve existent-elles ? Une règle sans preuve lisible ne
      // vaut pas mieux qu'une règle sans énoncé.
      const fichiers = [r.source, r.preuve].filter(Boolean);
      for (const f of fichiers) {
        const p = path.join(RACINE, f);
        if (!fs.existsSync(p)) manquants.push(`${r.num} : fichier cité introuvable — ${f}`);
      }

      regles.push({
        num: r.num,
        titre: r.titre,
        enonce: r.enonce,
        etat: r.etat,
        depuis: r.depuis || null,
        valeurs,
        cite: cites,
        source: r.source,
        preuve: r.preuve || null,
      });
    }
    themes.push({ code: th.code, titre: th.titre, resume: th.resume || null, regles });
  }
  categories.push({ code: cat.code, titre: cat.titre, resume: cat.resume || null, themes });
}

if (manquants.length) {
  console.error('⚠ RÈGLES DU SITE : publication REFUSÉE, la source s\'est tue.');
  for (const m of manquants) console.error('   · ' + m);
  process.exit(1);
}

// L'empreinte des fichiers dont la valeur est lue : elle permet à l'écran de
// dire sur QUOI les chiffres ont été lus, et au dépôt de repérer un changement
// de code qui n'aurait pas été suivi d'une republication.
const empreintes = {};
for (const f of ['collecteur.mjs', 'public/regles-affichage.js', 'public/app.js']) {
  const src = fs.readFileSync(path.join(RACINE, f));
  empreintes[f] = crypto.createHash('sha1').update(src).digest('hex').slice(0, 12);
}

const sortie = {
  genereLe: new Date().toISOString(),
  titre: catalogue.titre,
  chapeau: catalogue.chapeau,
  total: totalRegles,
  parEtat,
  empreintes,
  categories,
};

fs.writeFileSync(SORTIE, JSON.stringify(sortie), 'utf8');
console.log(`Règles du site : ${totalRegles} règle(s) publiée(s) dans public/regles.json`
  + ` — ${Object.entries(parEtat).map(([e, n]) => `${e} ${n}`).join(', ')}`
  + ` · valeurs lues dans ${Object.keys(empreintes).length} fichier(s) de code`);
