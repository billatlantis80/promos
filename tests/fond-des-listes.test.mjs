/**
 * LE MÊME FOND POUR TOUTES LES LISTES DE CHOIX DES RÉGLAGES.
 * =============================================================================
 *
 * Demande de B, 11/10/2026 : « Le fond légèrement grisé qui a été rajouté, dans
 * l'encadrement du pays, pour tous les pays. C'est très bien mais ça doit être
 * aussi fait pour thèmes et couleurs. »
 *
 * Le constat, mesuré : la liste des pays et celle des langues portaient
 * `--carte-2` (le ton légèrement grisé), les vignettes de thème portaient
 * `--carte`. Elles se distinguaient donc des deux autres listes sans qu'aucune
 * raison ne le dise — et c'est l'utilisateur qui l'a vu, pas les tests.
 *
 * Ce fichier tient la règle, et il la tient pour les TROIS listes à la fois :
 * une correction faite sur une seule d'entre elles repartirait en divergence au
 * prochain thème ajouté.
 *
 * Lancement : node --test tests/fond-des-listes.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');   // la feuille est lue SANS ses commentaires :
                                       // le commentaire qui raconte la décision cite
                                       // les jetons, et un contrôle naïf le lirait
                                       // comme une règle.

/** Le corps de la règle `selecteur`, accolades comprises. */
function corps(selecteur) {
  const i = CSS.indexOf('\n' + selecteur + ' {');
  assert.ok(i > -1, `règle introuvable : ${selecteur}`);
  const debut = CSS.indexOf('{', i);
  const fin = CSS.indexOf('}', debut);
  assert.ok(fin > debut, `règle non refermée : ${selecteur}`);
  return CSS.slice(debut, fin);
}

const LIGNES = {
  'la liste des pays': '.pays-item',
  'la liste des langues': '.langue',
  'les vignettes de thème': '.theme',
};

test('les trois listes de choix portent le MÊME fond', () => {
  const fonds = {};
  for (const [quoi, sel] of Object.entries(LIGNES)) {
    const m = corps(sel).match(/background:\s*([^;]+);/);
    assert.ok(m, `${quoi} (${sel}) : aucun fond déclaré`);
    fonds[quoi] = m[1].trim();
  }
  const valeurs = new Set(Object.values(fonds));
  assert.equal(valeurs.size, 1,
    'les listes de choix ne portent pas le même fond — B l’a vu à l’œil avant les '
    + 'tests :\n' + Object.entries(fonds).map(([q, v]) => `  - ${q} : ${v}`).join('\n'));
});

test('ce fond est le ton légèrement grisé, et il vient d’un JETON de thème', () => {
  // `--carte-2` est le ton « légèrement grisé » : un cran plus soutenu que le
  // fond des cartes, dans les DIX thèmes. Le figer en couleur écrite (#eef2f6)
  // casserait neuf thèmes sur dix — et ça ne se verrait qu'en les regardant.
  for (const [quoi, sel] of Object.entries(LIGNES)) {
    const fond = corps(sel).match(/background:\s*([^;]+);/)[1].trim();
    assert.equal(fond, 'var(--carte-2)',
      `${quoi} : le fond doit être var(--carte-2), or il vaut « ${fond} »`);
    assert.doesNotMatch(fond, /#[0-9a-f]{3,8}/i,
      `${quoi} : le fond ne doit pas être une couleur écrite en dur`);
  }
});
