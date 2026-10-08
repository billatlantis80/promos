/**
 * SYNTAXE DES FICHIERS DU NAVIGATEUR — application n°2.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Défaut réel, mesuré : un correctif a laissé dans app.js un commentaire
 * ouvert (`/**`) sans sa fermeture (`*​/`). Conséquence : `Invalid or unexpected
 * token`, l'application ne rendait PLUS RIEN — aucun thème, aucune offre.
 *
 * Et AUCUN test ne l'a vu : la suite Node n'importait que `collecteur.mjs` et
 * `langues.js`. `app.js` n'était lu par aucun test, seulement par le navigateur.
 * Les 216 tests étaient au vert pendant que la page était morte.
 *
 * Ces tests ferment ce trou : tout fichier que le navigateur charge est
 * réellement ANALYSÉ, et on vérifie aussi que les commentaires CSS sont
 * équilibrés — même classe de défaut, mêmes conséquences silencieuses.
 *
 * Lancement : node --test tests/syntaxe-navigateur.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DOSSIER = mkdtempSync(join(tmpdir(), 'syntaxe-'));
const lire = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');

for (const f of ['app.js', 'langues.js', 'affiliation.js']) {
  test(`le navigateur peut charger ${f} — syntaxe valide`, () => {
    const copie = join(DOSSIER, f.replace(/\.js$/, '.mjs'));
    writeFileSync(copie, lire(f));
    // `node --check` échoue sur TOUTE erreur de syntaxe, y compris un
    // commentaire non fermé — exactement le défaut qui a tué la page.
    execFileSync(process.execPath, ['--check', copie], { stdio: 'pipe' });
  });
}

test('les commentaires CSS sont équilibrés dans app.css', () => {
  const css = lire('app.css');
  const ouverts = (css.match(/\/\*/g) || []).length;
  const fermes = (css.match(/\*\//g) || []).length;
  assert.equal(ouverts, fermes,
    `commentaires CSS déséquilibrés : ${ouverts} ouverts, ${fermes} fermés — tout ce qui suit serait ignoré`);
});

test('index.html ne référence que des fichiers qui existent', () => {
  const html = lire('index.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css))"/g)].map((m) => m[1]);
  // Depuis le 08/10/2026 la feuille de style est EN LIGNE : le seul fichier
  // .js/.css encore appelé est le programme. Le contrôle garde son sens :
  // tout ce qui est appelé doit exister.
  assert.ok(refs.includes('app.js'), `index.html doit charger app.js (trouvé : ${refs})`);
  for (const r of refs) {
    assert.doesNotThrow(() => lire(r.replace(/^\.\//, '')), `ressource manquante : ${r}`);
  }
});
