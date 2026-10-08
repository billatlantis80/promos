/**
 * LE FILET N°4 — « la feuille de style n'est pas arrivée ».
 *
 * Panne réelle, signalée par B le 08/10/2026 : « le k est énorme, et il n'y a
 * pas d'image et pas d'encadrement. » Ces trois symptômes n'en font qu'UN —
 * `app.css` n'est pas arrivé jusqu'au navigateur :
 *
 *   • le logo est un <svg> sans dimensions : l'ancienne page le laissait
 *     prendre toute la largeur (le K géant) ;
 *   • chaque visuel est un <div class="visuel"> dont l'adresse est posée en
 *     style EN LIGNE par app.js, mais dont la HAUTEUR vient d'app.css : sans
 *     elle la boîte mesure 0 px — l'image est chargée, et invisible ;
 *   • les cartes tiennent leur cadre de `.offre`.
 *
 * Le fichier est SAIN (vérifié en ligne : 200, text/css, 203/203 accolades,
 * 54/54 commentaires). C'est son achat qui échoue.
 *
 * Ces tests protègent les deux moitiés du correctif : les dimensions du logo
 * (la page reste juste même sans feuille) et le filet qui RETENTE puis DIT.
 *
 * Lancement : node --test tests/habillage-secours.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const html = fs.readFileSync(path.join(RACINE, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(RACINE, 'public', 'app.css'), 'utf8');

/** Le bloc du filet n°4, isolé du reste de la page. */
function filet() {
  const marque = html.indexOf('FILET N°4');
  assert.ok(marque > 0, 'le filet n°4 (feuille de style) doit exister dans index.html');
  const debut = html.indexOf('<script>', marque);
  const fin = html.indexOf('</script>', debut);
  assert.ok(debut > marque && fin > debut, 'le filet n°4 doit contenir un <script> complet');
  return html.slice(debut, fin);
}

// --------------------------------------------------------------------------
// 1. Le logo ne dépend plus de la feuille de style
// --------------------------------------------------------------------------

test('le logo SVG porte des dimensions explicites (plus de K géant)', () => {
  assert.match(
    html,
    /<svg class="logo" viewBox="0 0 222 265" width="26" height="26"/,
    'sans width/height, un <svg> prend toute la largeur disponible dès que la '
    + 'feuille de style manque : c’est le « k énorme » signalé',
  );
});

test('les dimensions en attribut sont celles que app.css applique', () => {
  // Deux sources pour une même valeur : si l'une change sans l'autre, l'écart
  // sera visible (logo petit en secours, logo normal en marche courante).
  const regle = css.match(/\.logo\s*\{([^}]*)\}/);
  assert.ok(regle, 'app.css doit définir .logo');
  const largeur = regle[1].match(/width:\s*(\d+)px/);
  const hauteur = regle[1].match(/height:\s*(\d+)px/);
  assert.ok(largeur && hauteur, '.logo doit fixer width et height en px');
  assert.match(html, new RegExp(`<svg class="logo"[^>]*width="${largeur[1]}" height="${hauteur[1]}"`),
    `l’attribut du SVG (26×26) doit suivre app.css (.logo = ${largeur[1]}×${hauteur[1]} px)`);
});

// --------------------------------------------------------------------------
// 2. La détection : une variable que seul app.css définit
// --------------------------------------------------------------------------

test('la détection s’appuie sur --accent, défini par app.css seul', () => {
  assert.match(css, /--accent:\s*#/, 'app.css doit définir --accent sur :root');
  const f = filet();
  assert.match(f, /getPropertyValue\('--accent'\)/,
    'la détection doit lire --accent : elle est vide si et seulement si la '
    + 'feuille de style n’est pas appliquée');
});

test('la détection tolère les espaces et ne se trompe pas sur une valeur vide', () => {
  // getComputedStyle renvoie parfois la valeur brute avec des espaces. Une
  // chaîne d'espaces ne doit PAS passer pour « feuille appliquée ».
  const f = filet();
  assert.match(f, /\.replace\(\/\\s\/g,\s*''\)/,
    'les espaces doivent être retirés avant de juger la valeur');
  assert.match(f, /return\s+!!\(v\s*&&/, 'une valeur vide ou blanche doit donner faux');
});

// --------------------------------------------------------------------------
// 3. Le filet retente, puis parle — et se tait quand tout va bien
// --------------------------------------------------------------------------

test('le filet retente le chargement avec une adresse neuve', () => {
  const f = filet();
  assert.match(f, /app\.css\?v='\s*\+\s*Date\.now\(\)/,
    'l’adresse doit être neuve (?v=…) : c’est ce qui contourne un cache ayant '
    + 'gardé une réponse d’erreur — la cause la plus probable côté navigateur');
});

test('le filet se TAIT quand la feuille est appliquée', () => {
  const f = filet();
  // Le premier geste de reparer() doit être de sortir si tout va bien : un
  // filet qui parle à tort est pire que pas de filet.
  const corps = f.slice(f.indexOf('function reparer()'));
  assert.match(corps.slice(0, 400), /if\s*\(appliquee\(\)\)\s*\{\s*return;\s*\}/,
    'reparer() doit sortir immédiatement si --accent est là');
  assert.ok(f.includes('function signaler() {\n    if (appliquee()) { return; }')
    || /signaler\(\)\s*\{\s*\n\s*if \(appliquee\(\)\) \{ return; \}/.test(f),
    'signaler() doit lui aussi vérifier avant d’agir : pas de faux positif');
});

test('le filet s’arme au chargement ET à une borne de temps', () => {
  const f = filet();
  assert.match(f, /addEventListener\('load',\s*reparer\)/,
    'il faut vérifier après le chargement complet (c’est là que les feuilles '
    + 'sont sues appliquées ou perdues)');
  assert.match(f, /setTimeout\(reparer,\s*\d+\)/,
    '`load` n’arrive jamais si une ressource reste bloquée sans répondre : il '
    + 'faut aussi une borne de temps');
});

test('la retentative échouée déclenche le secours, sans boucle', () => {
  const f = filet();
  assert.match(f, /l\.onerror\s*=\s*signaler/, 'un échec réseau doit mener au secours');
  assert.match(f, /l\.onload\s*=\s*function \(\) \{ if \(!appliquee\(\)\) \{ signaler\(\); \} \}/,
    'un « chargement réussi » d’un fichier inutilisable doit aussi mener au secours');
  assert.match(f, /if \(fait\) \{ return; \}/,
    'un verrou : le filet ne doit pas se déclencher deux fois');
});

// --------------------------------------------------------------------------
// 4. L'habillage de secours rend la page lisible
// --------------------------------------------------------------------------

test('l’habillage de secours redonne hauteur aux visuels et cadre aux cartes', () => {
  const f = filet();
  assert.match(f, /\.offre \.visuel\{height:\d+px/,
    'sans hauteur, les visuels font 0 px : c’est le « il n’y a pas d’image »');
  assert.match(f, /\.offre\{[^}]*border:1px solid/,
    'sans bordure, les cartes n’ont pas d’encadrement');
  assert.match(f, /\.offre \.visuel\{[^}]*background-size:contain/,
    'l’image doit être entière et centrée, comme la vraie feuille de style');
});

test('l’habillage de secours suit les valeurs de app.css', () => {
  const vrai = css.match(/^\.offre \.visuel\s*\{([^}]*)\}/m);
  assert.ok(vrai, 'app.css doit définir .offre .visuel');
  const h = vrai[1].match(/height:\s*(\d+)px/);
  assert.ok(h, '.offre .visuel doit fixer une hauteur en px');
  const f = filet();
  assert.ok(f.includes(`height:${h[1]}px`),
    `le secours doit reprendre la hauteur réelle (${h[1]} px), sinon le saut de `
    + 'mise en page se verrait dès que la feuille revient');
});

test('l’habillage de secours n’emploie aucune variable CSS', () => {
  const f = filet();
  const bloc = f.slice(f.indexOf('var HABILLAGE'), f.indexOf('function signaler'));
  assert.doesNotMatch(bloc, /var\(--/,
    'à ce moment-là, plus une seule variable CSS n’existe : tout doit être littéral');
  assert.match(bloc, /#fff/, 'les couleurs doivent être écrites en dur');
});

// --------------------------------------------------------------------------
// 5. Le filet DIT ce qui manque (règle de la maison)
// --------------------------------------------------------------------------

test('le filet nomme la panne au lieu d’échouer en silence', () => {
  const f = filet();
  assert.match(f, /habillage du site n’est pas arrivé/,
    'le bandeau doit dire ce qui manque');
  assert.match(f, /feuille de style/, 'et le nommer en clair');
  // Le message doit relier la cause aux trois symptômes que l'utilisateur voit.
  assert.match(f, /logo est énorme/);
  assert.match(f, /images ne s’affichent pas/);
  assert.match(f, /encadrement/);
});

test('le filet donne les deux gestes utiles et n’accuse pas le site', () => {
  const f = filet();
  assert.match(f, /Ctrl \+ F5/, 'le rechargement forcé vide le cache');
  assert.match(f, /navigation privée/,
    'la fenêtre privée distingue « cache ou extension » de « vraiment le site »');
  assert.match(f, /Ni le site ni le fichier ne sont en cause/,
    'le fichier est sain : le taire ferait chercher au mauvais endroit');
});

test('le bandeau de secours existant est réutilisé, pas dupliqué', () => {
  const f = filet();
  assert.match(f, /getElementById\('secours'\)/, 'on réutilise #secours');
  assert.match(f, /secoursTitre/, 'et son titre');
  assert.match(f, /secoursTexte/, 'et son texte');
  // Un seul bloc #secours dans toute la page.
  const blocs = html.match(/id="secours"/g) || [];
  assert.equal(blocs.length, 1, 'il ne doit y avoir qu’un seul bloc #secours');
});

// --------------------------------------------------------------------------
// 6. Le filet doit pouvoir tourner quand plus rien d'autre ne tourne : ES5
// --------------------------------------------------------------------------

test('le filet est écrit en ES5 (il doit tourner quand tout le reste a échoué)', () => {
  const f = filet();
  assert.doesNotMatch(f, /=>/, 'pas de fonction fléchée');
  assert.doesNotMatch(f, /\b(const|let)\s/, 'pas de const/let : var seulement');
  assert.doesNotMatch(f, /`/, 'pas de gabarit de chaîne');
  assert.doesNotMatch(f, /\?\./, 'pas d’opérateur de chaînage optionnel');
  assert.doesNotMatch(f, /\.\.\./, 'pas de décomposition');
});

test('le filet est posé après app.js et après la sentinelle', () => {
  const app = html.indexOf('src="app.js"');
  const sentinelle = html.indexOf('FILET N°3');
  const quatrieme = html.indexOf('FILET N°4');
  assert.ok(app > 0 && sentinelle > app && quatrieme > sentinelle,
    'l’ordre des filets suit la gravité : module, vieux navigateur, sentinelle, '
    + 'puis feuille de style');
});
