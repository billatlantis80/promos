#!/usr/bin/env node
// Contrôle des textes affichés par les portes du hub Kazendra.
// Objectif : une phrase interdite ne peut PAS entrer dans un écran.
//   node tests/verifie-textes.mjs                 → contrôle tous les textes du dossier
//   node tests/verifie-textes.mjs --fichier X     → contrôle un fichier donné (démonstration)
//
// Porté depuis `app3/tests/verifie-textes.mjs` le 25/10/2026, avec trois différences assumées :
//   1. les motifs sont ceux du hub (`textes/interdits.json`), pas ceux du projet n°3 ;
//   2. la correspondance exacte de casse n'existe plus : tout passe par `norm()` — le projet n°3
//      avait deux types (`exact`, `insensible`) dont un seul était utilisé, et deux types pour un
//      seul comportement, c'est une occasion de se tromper ;
//   3. le rapport parle du hub et nomme la porte concernée.
//
// Quatre règles, et la troisième est celle qui attrape les vraies fautes :
//   a) langues — pour chaque porte, le fichier -fr.json est LA référence ;
//   b) structure — un texte sans emplacement n'existe pas : une phrase sans écran où vivre n'entre pas ;
//   c) motifs interdits — exact, insensible (accents et casse neutralisés), contexte (le motif est
//      autorisé si le texte contient aussi l'un des mots exigés), regex ; et `deni_ok` : un motif est
//      toléré quand il est NIÉ dans le même texte (« nous ne délivrons aucune attestation ») ;
//   d) longueur — un texte d'écran au-delà de 600 caractères n'est plus un texte, c'est un paragraphe.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const DOSSIER = join(ICI, '..', 'textes');
const INTERDITS = join(DOSSIER, 'interdits.json');
const IGNORES = new Set(['interdits.json']);
const LONGUEUR_MAX = 600;

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u2019\u2018]/g, "'").replace(/\s+/g, ' ');

const CLES_TECHNIQUES = ['regle', 'regle_de_lecture', 'reference', 'emplacements', 'principe_du_carnet',
  'sources_verifiees', 'langue', 'acteur', 'version'];

function valeurs(noeud, chemin = '', sortie = []) {
  if (typeof noeud === 'string') { sortie.push([chemin, noeud]); return sortie; }
  if (Array.isArray(noeud)) { noeud.forEach((v, i) => valeurs(v, `${chemin}[${i}]`, sortie)); return sortie; }
  if (noeud && typeof noeud === 'object') {
    for (const [k, v] of Object.entries(noeud)) {
      if (CLES_TECHNIQUES.includes(k)) continue;
      valeurs(v, chemin ? `${chemin}.${k}` : k, sortie);
    }
  }
  return sortie;
}

const regles = JSON.parse(readFileSync(INTERDITS, 'utf8')).interdits;

const argFichier = process.argv.indexOf('--fichier');
let fichiers;
if (argFichier > -1) {
  fichiers = [process.argv[argFichier + 1]];
} else {
  fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.json') && !IGNORES.has(f))
    .map((f) => join(DOSSIER, f));
}

let fautes = 0, textesControles = 0;
const rapport = [];

// ── (a) règle des langues : pour chaque porte, le -fr est la référence ─────
if (argFichier === -1) {
  const parPorte = {};
  for (const f of fichiers) {
    const m = basename(f).match(/^(.+)-(fr|nl|de|en)\.json$/);
    if (m) (parPorte[m[1]] ||= {})[m[2]] = f;
  }
  for (const [porte, langues] of Object.entries(parPorte)) {
    if (!langues.fr) continue;
    const ref = new Set(Object.keys(JSON.parse(readFileSync(langues.fr, 'utf8')).textes || {}));
    for (const [lg, f] of Object.entries(langues)) {
      if (lg === 'fr') continue;
      const cles = new Set(Object.keys(JSON.parse(readFileSync(f, 'utf8')).textes || {}));
      const manquantes = [...ref].filter((c) => !cles.has(c));
      if (manquantes.length) {
        fautes++;
        rapport.push(`  ✗ ${basename(f)} : ${manquantes.length} clé(s) manquante(s) par rapport à ` +
          `${basename(langues.fr)} → ${manquantes.slice(0, 5).join(', ')}${manquantes.length > 5 ? '…' : ''}`);
      }
    }
  }
}

// ── (b) règle de structure : un texte sans emplacement n'existe pas ───────
for (const f of fichiers) {
  if (!existsSync(f)) continue;
  const c = JSON.parse(readFileSync(f, 'utf8'));
  if (!c.textes) continue;
  const sans = Object.keys(c.textes).filter((k) => !(c.emplacements || {})[k]);
  if (sans.length) {
    fautes++;
    rapport.push(`  ✗ ${basename(f)} : ${sans.length} texte(s) sans emplacement → ${sans.join(', ')}\n` +
      `      une phrase sans écran où vivre ne doit pas entrer dans le fichier`);
  }
}

// ── (c) motifs interdits, et (d) longueur ─────────────────────────────────
for (const f of fichiers) {
  if (!existsSync(f)) { rapport.push(`  ✗ fichier introuvable : ${f}`); fautes++; continue; }
  const contenu = JSON.parse(readFileSync(f, 'utf8'));
  for (const [chemin, valeur] of valeurs(contenu)) {
    textesControles++;
    const n = norm(valeur);
    if (valeur.length > LONGUEUR_MAX) {
      fautes++;
      rapport.push(`  ✗ ${basename(f)} → ${chemin}\n      texte de ${valeur.length} caractères ` +
        `(maximum ${LONGUEUR_MAX}) : ce n'est plus un texte d'écran, c'est un paragraphe`);
    }
    for (const r of regles) {
      let touche = false;
      if (r.type === 'regex') touche = new RegExp(r.motif, 'iu').test(n);
      else touche = n.includes(norm(r.motif));
      if (!touche) continue;
      if (r.type === 'contexte') {
        const ok = (r.exige || []).some((mot) => n.includes(norm(mot)));
        if (ok) continue;
      }
      // « deni_ok » : le motif est autorisé QUAND IL EST NIÉ dans le même texte.
      // Un garde-fou qui empêche d'écrire la vérité (« nous ne délivrons aucune attestation »)
      // est un mauvais garde-fou.
      if (r.deni_ok && /(^|\s)(pas|jamais|aucun|aucune|ni|rien|sans)(\s|$)/.test(n)) continue;
      fautes++;
      rapport.push(`  ✗ ${basename(f)} → ${chemin}\n` +
        `      motif ${r.type === 'contexte' ? 'hors contexte' : 'interdit'} : « ${r.motif} »` +
        (r.type === 'contexte' ? `\n      contexte exigé (aucun trouvé) : ${(r.exige || []).join(' · ')}` : '') +
        `\n      décision : ${r.decision} — ${r.raison}\n      texte : ${valeur}`);
    }
  }
}

// ── sortie ────────────────────────────────────────────────────────────────
console.log('CONTRÔLE DES TEXTES — hub Kazendra');
const portes = new Set(fichiers.map((f) => basename(f).split('-')[0]));
console.log(`  fichiers : ${fichiers.length} (portes : ${[...portes].join(', ')}) · ` +
  `textes : ${textesControles} · motifs : ${regles.length}`);
if (fautes) {
  console.log(`\n  ${fautes} FAUTE(S) :\n`);
  console.log(rapport.join('\n'));
  console.log("\n  → à corriger avant d'afficher quoi que ce soit.");
  process.exit(1);
}
console.log('\n  ✓ aucun texte interdit. Les phrases figées respectent les décisions du plan du hub.');
