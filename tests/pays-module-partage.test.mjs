/**
 * LE MODULE DE CHOIX DU PAYS EST UN SEUL — pour les deux écrans qui l'affichent.
 *
 * Demande de B (08/10/2026) : « lors de l'introduction de l'application tu
 * demandes le pays où l'utilisateur cherche ses promotions, il faut proposer le
 * même module qui est dans les paramètres d'utilisateur avec les drapeaux, sur
 * deux colonnes. »
 *
 * Avant cette date, les deux listes étaient écrites séparément : celle
 * d'ouverture n'avait pas de drapeau, tenait sur une colonne et écrivait
 * « 1 664 offres » là où les Réglages affichaient « 1 664 ». Deux dessins du même
 * choix divergent toujours — c'est pourquoi ce test ne vérifie pas « la modale a
 * des drapeaux », mais « il n'existe qu'UNE fabrique de bouton de pays ».
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const JS = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ICI, '..', 'public', 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ICI, '..', 'public', 'app.css'), 'utf8');

test('une seule fabrique de bouton de pays dans tout le code', () => {
  const fabriques = JS.match(/data-pays="\$\{esc\(code\)\}"/g) || [];
  assert.equal(fabriques.length, 1,
    `le bouton de pays est fabriqué ${fabriques.length} fois dans app.js. Deux `
    + `fabriques = deux dessins qui vont diverger (drapeaux sur l'un, pas sur `
    + `l'autre ; deux colonnes d'un côté, une de l'autre). Il doit y en avoir `
    + `une : htmlListePays().`);
});

test('les deux écrans passent par le module partagé', () => {
  assert.match(JS, /htmlListePays\(\{ actif:/,
    'l’onglet Réglages ne passe plus par htmlListePays() : il redessine sa propre liste');
  assert.match(JS, /htmlListePays\(\{ conseille:/,
    'la question d’ouverture ne passe plus par htmlListePays() : elle redessine sa propre liste');
  const appels = JS.match(/htmlListePays\(/g) || [];
  // 1 définition + 2 appels
  assert.equal(appels.length, 3,
    `htmlListePays est cité ${appels.length} fois (attendu 3 : la définition et les deux appels)`);
});

test('le module partagé porte les drapeaux et les deux colonnes', () => {
  const debut = JS.indexOf('function htmlListePays(');
  assert.ok(debut > 0, 'htmlListePays() introuvable dans app.js');
  const bloc = JS.slice(debut, JS.indexOf('function dessinerPays()', debut));
  assert.ok(bloc.length > 200, `découpage du module invalide (${bloc.length} caractères)`);
  assert.match(bloc, /class="drap"/,
    'le module n’affiche plus de drapeau : la demande de B portait justement dessus');
  assert.match(bloc, /pays-liste pays-2col/,
    'le module n’est plus sur deux colonnes');
  assert.match(bloc, /DRAPEAUX_PAYS\[/, 'le drapeau n’est plus dessiné (table absente)');
  // Les noms de pays et le drapeau de l'Europe sont traduits / présents.
  assert.match(bloc, /t\(NOMS_PAYS\[c\]\)/, 'les noms de pays ne sont plus traduits');
  assert.match(bloc, /item\('tout', t\("Tous les pays d'Europe"\)/,
    '« Tous les pays d’Europe » doit venir en premier, dessiné comme les pays');
});

test('la modale ne NICHE pas deux listes de pays', () => {
  // #paysListe reçoit le module, qui contient déjà son <div class="pays-liste ...">.
  // Si le conteneur gardait lui aussi la classe, on empilerait une liste dans une
  // liste : la grille à deux colonnes se retrouverait écrasée par le flex parent.
  const m = HTML.match(/<div([^>]*)\sid="paysListe"/);
  assert.ok(m, 'le conteneur #paysListe est introuvable dans index.html');
  assert.ok(!/class="[^"]*pays-liste/.test(m[1]),
    `le conteneur #paysListe ne doit pas porter la classe « pays-liste » : le module `
    + `l’apporte déjà (trouvé :${m[1]})`);
});

test('les deux colonnes sont bien définies dans la feuille de style', () => {
  const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.pays-liste\.pays-2col\s*\{[^}]*grid-template-columns:\s*repeat\(2/,
    'la grille à deux colonnes a disparu de app.css');
});
