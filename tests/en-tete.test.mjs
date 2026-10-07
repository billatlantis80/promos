/**
 * L'EN-TÊTE : ce que l'utilisateur voit en haut à droite.
 *
 * Demande de B : la répartition « ≈ 60 % Amazon · 40 % enseignes & presse » ne
 * doit PAS être visible — c'est un réglage de programmation, pas une information
 * pour l'utilisateur. Il doit rester DEUX lignes : le nombre de bonnes promos,
 * et la date de mise à jour.
 *
 * Le mélange 60/40, lui, continue d'exister et reste testé (tests/melange.test.mjs).
 *
 * Lancement : node --test tests/en-tete.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');

test('la répartition Amazon / enseignes n’est JAMAIS affichée', () => {
  const interdits = ['% Amazon', 'enseignes & presse', 'pcAmz', 'nAmz'];
  const restes = interdits.filter((m) => js.includes(m));
  assert.deepEqual(restes, [],
    `la proportion interne est visible à l'écran : ${restes.join(', ')}`);
});

test('l’en-tête garde exactement deux lignes : le compte et la mise à jour', () => {
  // On isole l'affectation de l'en-tête dans la portée « bonnes promos ».
  const i = js.indexOf("$('comptes').innerHTML");
  assert.ok(i > 0, "l'en-tête doit être alimenté");
  const ligne = js.slice(i, js.indexOf(';', i));
  assert.match(ligne, /t\('bonnes promos'\)/, 'le nombre de bonnes promos doit rester');
  assert.match(ligne, /t\('mis à jour \{n\}'/, 'la date de mise à jour doit rester');
  const sauts = (ligne.match(/<br>/g) || []).length;
  assert.equal(sauts, 1, `deux lignes = un seul <br>, trouvé ${sauts}`);
});

test('le mélange 60/40 n’a pas été supprimé du programme', () => {
  // Ce qui disparaît, c'est l'AFFICHAGE — pas la règle. Le mélange reste.
  assert.match(js, /melanger\(dedoublonner\(etat\.offres\.filter\(estBonnePromo\)\)\)/,
    'le mélange doit continuer de décider ce qui est affiché');
});
