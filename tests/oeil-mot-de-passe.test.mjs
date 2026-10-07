/**
 * LES CHAMPS DE MOT DE PASSE DOIVENT POUVOIR SE RELIRE.
 * =============================================================================
 *
 * DEMANDE DE B : « il faut mettre la petite oeil a droite pour cacher ou pour
 * faire apparaitre le mot de passe. Car une fois tape on ne voit que des
 * etoiles et pas les lettres, on ne sait pas verifier si les mots de passe sont
 * identiques. »
 *
 * CE QUE CE FICHIER EMPÊCHE
 *
 * 1. UN CHAMP OUBLIÉ. Six champs de mot de passe vivent dans l'application
 *    (inscription ×2, changement ×2, verrouillage ×1, plus celui du gabarit).
 *    En équiper cinq et oublier le sixième laisse exactement la même gêne deux
 *    pas plus loin. On vérifie donc que TOUT `type="password"` porte son œil.
 *
 * 2. UN ŒIL QUI NE FAIT RIEN. Un bouton dessiné mais jamais branché reste
 *    cliquable et ne répond pas — le défaut déjà rencontré sur ce projet. Un
 *    seul écouteur pour toute la page, délégué : c'est ce qui garantit que les
 *    yeux redessinés par le JavaScript restent branchés.
 *
 * 3. UN LIBELLÉ FIGÉ. « Montrer le mot de passe » est une phrase traduite : elle
 *    doit exister dans les neuf langues, et se rafraîchir quand on change de
 *    langue — sinon l'œil parle français dans une interface anglaise.
 *
 * 4. UN BOUTON QUI VALIDE LE FORMULAIRE. Un `<button>` sans `type` dans un
 *    formulaire vaut « submit » : l'œil enverrait l'inscription au lieu de
 *    montrer le mot de passe.
 *
 * Lancement : node --test tests/oeil-mot-de-passe.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const APP = lire('public/app.js');
const HTML = lire('public/index.html');
const CSS = lire('public/app.css');
const LANGUES = lire('public/langues.js');

test('chaque champ de mot de passe passe par le gabarit qui porte l’œil', () => {
  // Les quatre champs construits par le JavaScript.
  for (const id of ['cMdp', 'cMdp2', 'cAncien', 'cNouveau']) {
    assert.match(APP, new RegExp(`champMotDePasse\\('${id}'`),
      `le champ #${id} ne passe pas par champMotDePasse() : il n’aurait pas d’œil`);
  }
  // Et le contrôle qui compte : plus AUCUN champ mot de passe écrit à la main.
  const aLaMain = APP.match(/<input[^>]*type="password"/g) || [];
  assert.equal(aLaMain.length, 1,
    `un champ mot de passe est encore écrit à la main (${aLaMain.length} occurrence(s)) : `
    + 'le seul acceptable est celui du gabarit champMotDePasse()');
});

test('le champ de l’écran de verrouillage a son œil', () => {
  const bloc = HTML.match(/<input id="verrouMdp"[^>]*>[\s\S]{0,400}?<\/div>/);
  assert.ok(bloc, 'le champ verrouMdp est introuvable dans index.html');
  assert.match(bloc[0], /class="oeil"[^>]*data-oeil="verrouMdp"/,
    'le champ de l’écran de verrouillage doit porter son œil, sinon on tape à '
    + 'l’aveugle au moment le plus critique : on ne peut plus entrer du tout');
  assert.match(HTML, /<div class="avec-oeil">[\s\S]{0,120}verrouMdp/,
    'le champ verrouMdp doit être dans un conteneur .avec-oeil, sinon l’œil '
    + 'se pose à côté du champ au lieu d’être dedans');
});

test('l’œil est branché, et une seule fois pour toute la page', () => {
  assert.match(APP, /document\.addEventListener\('click',[\s\S]{0,200}closest\('\.oeil'\)/,
    'un écouteur délégué doit capter tous les yeux, y compris ceux redessinés');
  assert.match(APP, /function basculerOeil\(/,
    'la bascule du mot de passe est introuvable');
  assert.match(APP, /champ\.type = caché \? 'text' : 'password'/,
    'la bascule doit changer le type du champ — c’est tout le mécanisme');
});

test('l’œil ne valide jamais le formulaire', () => {
  // Un <button> sans type dans un formulaire vaut « submit ».
  const yeux = APP.match(/<button[^>]*class="oeil"[^>]*>/g) || [];
  const dansHtml = HTML.match(/<button[^>]*class="oeil"[^>]*>/g) || [];
  assert.ok(yeux.length + dansHtml.length >= 2,
    'les boutons « œil » sont introuvables');
  for (const b of [...yeux, ...dansHtml]) {
    assert.match(b, /type="button"/,
      `un bouton « œil » n’a pas type="button" : il validerait l’envoi au lieu `
      + `de montrer le mot de passe → ${b}`);
  }
  assert.match(APP, /e\.preventDefault\(\);[\s\S]{0,80}basculerOeil/,
    'le clic sur l’œil doit être neutralisé avant la bascule');
});

test('les deux phrases de l’œil existent dans les neuf langues', () => {
  for (const phrase of ['Montrer le mot de passe', 'Cacher le mot de passe']) {
    const n = (LANGUES.match(new RegExp(`'${phrase}':`, 'g')) || []).length;
    assert.equal(n, 9, `« ${phrase} » : ${n} langue(s), 9 attendues`);
  }
});

test('les libellés des yeux suivent la langue', () => {
  // Sans ce rafraîchissement, l'œil resterait dans la langue d'avant le
  // changement — le défaut des textes non branchés, en plus discret.
  assert.match(APP, /function preparerOeils\(\)/,
    'preparerOeils() est introuvable');
  const appels = (APP.match(/preparerOeils\(\)/g) || []).length;
  assert.ok(appels >= 3,
    `preparerOeils() n’est appelé que ${appels - 1} fois : il faut le démarrage `
    + 'ET le changement de langue');
  assert.match(APP, /changerLangue[\s\S]{0,600}preparerOeils\(\)/,
    'preparerOeils() doit être appelé au changement de langue');
});

test('le bouton est posé DANS le champ, à droite', () => {
  assert.match(CSS, /\.avec-oeil\s*\{[^}]*position:\s*relative/,
    'le conteneur du champ doit être en position relative pour porter l’œil');
  assert.match(CSS, /\.oeil\s*\{[^}]*position:\s*absolute[^}]*right:/,
    'l’œil doit être posé en absolu à droite, dans le champ');
  assert.match(CSS, /\.avec-oeil input\s*\{[^}]*padding-right:/,
    'le champ doit réserver la largeur de l’œil, sinon un mot de passe long '
    + 'passe dessous');
});
