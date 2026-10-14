/* =============================================================================
   LA FEUILLE DE STYLE DOIT RESTER DANS LA PAGE.

   Constat B, 08/10/2026 : sur son PC, le site s'affichait sans habillage
   (logo géant, images invisibles, cartes sans cadre) parce que les fichiers
   .css externes n'arrivaient pas jusqu'au navigateur — alors que /admin/, qui
   écrit son style dans sa page, s'affichait parfaitement. La feuille a donc
   été posée EN LIGNE dans index.html (voir bin/inliner-css.mjs).

   Ces tests protègent ce choix. Le plus important est celui de l'égalité au
   caractère près : il échoue si quelqu'un modifie app.css sans relancer
   l'outil — c'est-à-dire si la page et le fichier se mettent à diverger.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (chemin) => readFileSync(new URL('../public/' + chemin, import.meta.url), 'utf8');

const DEBUT = 'DEBUT-FEUILLE-EN-LIGNE';
const FIN = 'FIN-FEUILLE-EN-LIGNE';

test('index.html ne demande plus aucune feuille de style externe', () => {
  const html = lire('index.html');
  const liens = html.match(/<link[^>]+rel="stylesheet"/gi) || [];
  assert.deepEqual(liens, [],
    'aucun <link rel="stylesheet"> ne doit subsister : c\'est exactement ce que le filtre du PC coupait');
  assert.ok(!/href="app\.css"/.test(html), 'app.css ne doit plus être appelé en fichier externe');
  assert.ok(!/href="fonts\.css"/.test(html), 'fonts.css ne doit plus être appelé en fichier externe');
});

test('le contenu de app.css est repris dans la page AU CARACTÈRE PRÈS', () => {
  const html = lire('index.html');
  const css = lire('app.css').trimEnd();
  assert.ok(css.length > 30000, 'garde-fou : app.css doit être lu en entier');
  assert.ok(html.includes(css),
    'app.css a changé sans que l\'outil soit relancé : écrire « node bin/inliner-css.mjs »');
});

test('le contenu de fonts.css est repris dans la page AU CARACTÈRE PRÈS', () => {
  const html = lire('index.html');
  const css = lire('fonts.css').trimEnd();
  assert.ok(css.length > 1500, 'garde-fou : fonts.css doit être lu en entier');
  assert.ok(html.includes(css),
    'fonts.css a changé sans que l\'outil soit relancé : écrire « node bin/inliner-css.mjs »');
});

test('le style posé en ligne tient bien entre ses deux bornes', () => {
  const html = lire('index.html');
  const d = html.indexOf(DEBUT);
  const f = html.indexOf(FIN);
  assert.ok(d > -1 && f > d, 'les bornes DEBUT/FIN doivent exister, dans cet ordre');
  const bloc = html.slice(d, f);
  assert.ok(bloc.includes('<style>'), 'le bloc doit contenir la balise <style>');
  assert.equal((bloc.match(/<style>/g) || []).length, 1, 'un seul <style> dans le bloc');
});

test('le filet de secours CSS est toujours là (la page doit dire ce qui manque)', () => {
  const html = lire('index.html');
  assert.ok(html.includes('habillage-de-secours'), 'le filet n°4 doit rester en place');
  assert.ok(html.includes('--accent'), 'le filet s\'appuie sur --accent pour savoir si la feuille est appliquée');
});

test('docs/index.html est identique à public/index.html (la copie publiée)', () => {
  const pub = lire('index.html');
  const doc = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.equal(doc, pub,
    'docs/ est la copie publiée : elle doit être recopiée après toute édition de public/');
});
