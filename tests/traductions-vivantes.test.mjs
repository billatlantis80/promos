/**
 * GARDE-FOU : aucune clé morte dans le dictionnaire.
 *
 * Défaut constaté le 08/10/2026 : vingt et une traductions étaient portées par
 * les 9 dictionnaires sans que l'interface les demande jamais. Elles ne
 * cassaient rien — elles restaient, invisibles, et donnaient l'illusion d'un
 * inventaire à jour. Le nettoyage a été fait ; ce test empêche la rechute.
 *
 * Règle du projet : LA CLÉ EST LE TEXTE FRANÇAIS. Une clé qui n'existe nulle
 * part comme littéral dans le code ne peut donc pas être atteinte par
 * l'interface, sauf à recomposer la phrase par morceaux — ce que le projet
 * s'interdit (on ne concatène jamais une phrase, on passe par {n}).
 *
 * Ce test ne remplace pas la sonde d'exécution (outils/sonde-traductions.py) :
 * il vérifie la forme, pas l'usage. Les deux ensemble disent la vérité.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUES } from '../public/langues.js';
import { MENTION_AFFILIATION_ACTIVE, MENTION_AFFILIATION_INACTIVE } from '../public/affiliation.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ICI, '..', 'public');

/** Tous les fichiers de code applicatif, dictionnaire exclu. */
function fichiers() {
  const out = [];
  const parcourir = (rep) => {
    for (const e of fs.readdirSync(rep, { withFileTypes: true })) {
      const p = path.join(rep, e.name);
      if (e.isDirectory()) {
        if (e.name === 'fonts' || e.name === 'node_modules') continue;
        parcourir(p);
      } else if (/\.(js|mjs|html|css)$/.test(e.name) && e.name !== 'langues.js') {
        out.push(p);
      }
    }
  };
  parcourir(PUBLIC);
  out.push(path.join(ICI, '..', 'server.js'));
  return out;
}

const SOURCES = fichiers().map((f) => ({
  nom: path.relative(path.join(ICI, '..'), f),
  texte: fs.readFileSync(f, 'utf8'),
}));

/**
 * EXCEPTION NOMMÉE, une seule. « Découvrez les meilleures promotions » n'est
 * affichée nulle part : c'est l'ancienne phrase d'accroche, gardée traduite
 * exprès pour la campagne publicitaire à venir (le lancer obligerait à la
 * retrouver dans les 9 langues le jour dit). Un autre test la protège
 * (tests/interface.test.mjs). Toute autre clé non citée est une clé morte.
 */
const EXCEPTIONS = new Set(['Découvrez les meilleures promotions']);

/** Le code peut écrire l'apostrophe droite ou courbe : on essaie les deux. */
const variantes = (s) => [s, s.replace(/'/g, '\u2019'), s.replace(/\u2019/g, "'")];

/** La clé apparaît-elle comme littéral À PART ENTIÈRE (donc encadrée) ? */
function citee(cle) {
  for (const v of variantes(cle)) {
    for (const g of ["'", '"', '`']) {
      const motif = g + v + g;
      for (const s of SOURCES) if (s.texte.includes(motif)) return `${s.nom} (${g}…${g})`;
    }
    // ou comme valeur d'attribut data-i18n de index.html
    const attr = new RegExp(`data-i18n[a-z-]*\\s*=\\s*['"]${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
    for (const s of SOURCES) if (attr.test(s.texte)) return `${s.nom} (data-i18n)`;
  }
  return null;
}

test('aucune clé du dictionnaire n’est morte', () => {
  const cles = Object.keys(LANGUES.fr.textes);
  assert.ok(cles.length > 150, `inventaire trop maigre : ${cles.length}`);

  const mortes = cles.filter((c) => !EXCEPTIONS.has(c) && !citee(c));
  assert.deepEqual(mortes, [],
    `ces clés ne sont appelées nulle part et n'existent nulle part dans le code :\n`
    + mortes.map((m) => `  « ${m} »`).join('\n')
    + '\n\nSoit l\'interface a cessé de s\'en servir (les retirer), soit le code '
    + 'écrit le texte en clair au lieu de passer par t() (le câbler). '
    + 'Vérifier avec : python3 outils/sonde-traductions.py');
  console.log(`  ${cles.length} clés, toutes citées par le code`);
});

test('les 9 langues portent exactement le même jeu de clés', () => {
  const ref = Object.keys(LANGUES.fr.textes).sort();
  for (const code of Object.keys(LANGUES)) {
    assert.deepEqual(Object.keys(LANGUES[code].textes).sort(), ref,
      `${code} ne porte pas le même jeu de clés que le français`);
  }
});

/**
 * Le pendant du test précédent : une phrase AFFICHÉE mais ABSENTE du dictionnaire
 * ne se voit nulle part — elle s'écrit simplement en français dans les 9 langues.
 * C'est ainsi que la mention d'affiliation du pied de page et le mot « tours » de
 * la carte du compte sont restés français jusqu'au 08/10/2026. On vérifie donc
 * que ces phrases-là sont bien des clés, dans chaque langue.
 */
test('les phrases affichées par le code sont des clés du dictionnaire', () => {
  const affichees = {
    'mention d’affiliation (programmes ouverts)': MENTION_AFFILIATION_ACTIVE,
    'mention d’affiliation (aucun identifiant)': MENTION_AFFILIATION_INACTIVE,
    'nombre de tours de dérivation': '({n} tours)',
  };
  const manquantes = [];
  for (const [quoi, cle] of Object.entries(affichees)) {
    for (const code of Object.keys(LANGUES)) {
      const v = LANGUES[code].textes[cle];
      if (typeof v !== 'string' || !v.trim()) manquantes.push(`${quoi} — ${code}`);
    }
  }
  assert.deepEqual(manquantes, [],
    `ces phrases sont affichées mais ne sont pas traduites : elles apparaîtront `
    + `en français dans toutes les langues.\n  ${manquantes.join('\n  ')}`);
});
