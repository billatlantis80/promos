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

test('l’en-tête garde trois lignes : promos, total, mise à jour', () => {
  // Demande de B (07/10/2026) : « Entre les deux, sur la deuxième ligne, on va
  // écrire le nombre total de promotion, “11494 promotions”. » Le total
  // s'insère DONC entre le nombre de bonnes promos et la date de mise à jour —
  // trois lignes, et dans cet ordre. Sans le total, « 2 415 » ne situe rien.
  const i = js.indexOf("$('comptes').innerHTML");
  assert.ok(i > 0, "l'en-tête doit être alimenté");
  const ligne = js.slice(i, js.indexOf(';', i));
  assert.match(ligne, /t\('bonnes promos'\)/, 'le nombre de bonnes promos doit rester');
  assert.match(ligne, /t\('\{n\} promotions'/, 'le total des promotions doit être affiché');
  assert.match(ligne, /t\('mis à jour \{n\}'/, 'la date de mise à jour doit rester');
  const sauts = (ligne.match(/<br>/g) || []).length;
  assert.equal(sauts, 2, `trois lignes = deux <br>, trouvé ${sauts}`);
  // L'ORDRE est le cœur de la demande : le total est la DEUXIÈME ligne.
  const posTotal = ligne.indexOf("'{n} promotions'");
  const posMaj = ligne.indexOf("'mis à jour {n}'");
  assert.ok(posTotal > 0 && posMaj > posTotal,
    'le total doit venir APRÈS les bonnes promos et AVANT la mise à jour');
});

test('le mélange 60/40 n’a pas été supprimé du programme', () => {
  // Ce qui disparaît, c'est l'AFFICHAGE — pas la règle. Le mélange reste.
  assert.match(js, /melanger\(dedoublonner\(etat\.offres\.filter\(estBonnePromo\)\)\)/,
    'le mélange doit continuer de décider ce qui est affiché');
});
