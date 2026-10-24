/**
 * LE LOGO : PLUS GRAND, ET PAS COPIABLE D'UN GESTE.
 *
 * Demandes de B, 11/10/2026, mot pour mot :
 *   « Concernant le logo, deux choses. L'image ne peut pas être récupéré par un
 *     utilisateur, du site internet... Car actuellement si je la déplace elle se
 *     copie sur mon pc. Et ensuite il y a la taille affiché du logo, je trouve
 *     qu'il est trop petit, il doit être au moins 20 % plus grand, uniquement le
 *     logo, pas l'écriture »
 *
 * Ce que ce test défend :
 *   1. LA TAILLE, avec le minimum DEMANDÉ (20 %) et pas une valeur choisie à
 *      l'œil : 32 → 39 px sur téléphone (+21,9 %), 42 → 51 px sur PC (+21,4 %).
 *      Un « à peu près » qui redescendrait sous le seuil doit échouer ici.
 *   2. L'ÉCRITURE NE SUIT PAS : le mot et l'accroche gardent leur taille. C'est
 *      la deuxième moitié de la demande, et elle est facile à perdre en
 *      agrandissant le bloc entier.
 *   3. LA COPIE AU GLISSER est désamorcée sur les TROIS chemins : l'attribut
 *      `draggable="false"` (il agit même sans feuille de style), le CSS
 *      (`-webkit-user-drag`), et l'événement (le clic droit et le glisser
 *      refusés par app.js).
 *   4. Et l'honnêteté du commentaire : le fichier reste PUBLIC et doit le rester
 *      (onglet du navigateur, logo des pages de partage). Ce test ne prétend
 *      donc PAS que le logo est introuvable — il vérifie qu'on ne le copie plus
 *      PAR INADVERTANCE, ce qui est la demande réelle.
 *
 * Lancement : node --test tests/logo-taille-et-copie.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', f), 'utf8');
const CSS_BRUT = lire('public/app.css');
const CSS = CSS_BRUT.replace(/\/\*[\s\S]*?\*\//g, '');
const HTML = lire('public/index.html').replace(
  /<!-- DEBUT-FEUILLE-EN-LIGNE -->[\s\S]*?<!-- FIN-FEUILLE-EN-LIGNE -->/,
  '<!-- feuille retirée -->',
);
const JS = lire('public/app.js');

// Les tailles d'AVANT la demande, et le seuil qu'elle fixe.
const AVANT = { telephone: 32, pc: 42 };
const MINIMUM = 1.2;

const tailleDe = (bloc) => {
  const l = /width:\s*(\d+)px/.exec(bloc);
  const h = /height:\s*(\d+)px/.exec(bloc);
  assert.ok(l && h, 'la règle .logo doit fixer width et height en px');
  assert.equal(l[1], h[1], 'la boîte du logo reste carrée : son dessin est rogné par object-fit');
  return Number(l[1]);
};

test('le logo du téléphone grandit d’AU MOINS 20 %, et le mot ne bouge pas', () => {
  const base = /\.logo\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(base, 'app.css doit définir .logo');
  const taille = tailleDe(base[1]);
  assert.ok(taille >= AVANT.telephone * MINIMUM,
    `le logo fait ${taille} px : il faut au moins ${AVANT.telephone * MINIMUM} px `
    + `(${AVANT.telephone} px + 20 %)`);
  // L'ÉCRITURE NE SUIT PAS — c'est la moitié « uniquement le logo » de la demande.
  assert.match(CSS, /\.marque \{[^}]*font-size: 19px/,
    'le mot KAZENDRA garde ses 19 px sur téléphone : seule l’image grandit');
});

test('le logo du PC grandit d’AU MOINS 20 %, l’écriture non plus', () => {
  const blocs = CSS.match(/\.logo\s*\{[^}]*\}/g) || [];
  assert.ok(blocs.length >= 2, 'il doit y avoir le logo du téléphone ET celui du PC');
  const tailles = blocs.map((b) => tailleDe(b)).sort((a, b) => a - b);
  const pc = tailles[tailles.length - 1];
  assert.ok(pc >= AVANT.pc * MINIMUM,
    `le logo du PC fait ${pc} px : il faut au moins ${AVANT.pc * MINIMUM} px `
    + `(${AVANT.pc} px + 20 %)`);
  assert.match(CSS, /\.marque \{ font-size: 25px; gap: 13px; \}/,
    'le mot garde ses 25 px sur PC : l’agrandissement ne concerne que l’image');
  assert.match(CSS, /\.accroche \{ font-size: 12px/,
    'et l’accroche garde la sienne');
});

test('le logo ne s’enregistre pas quand on le déplace', () => {
  const img = /<img class="logo"[^>]*>/.exec(HTML);
  assert.ok(img, "l'en-tête doit porter img.logo");
  assert.match(img[0], /draggable="false"/,
    'sans `draggable="false"`, déplacer le logo l’enregistre sur le poste : c’est le geste que B a constaté');
  // Le refus du glisser vit dans la règle de BASE : elle vaut aux deux tailles.
  // Le palier PC ne redit QUE la taille — on vérifie donc que la base refuse, et
  // que rien, ailleurs dans la feuille, ne REND le glisser possible (une règle
  // qui remettrait `auto` l'emporterait, et le défaut reviendrait en silence).
  const base = /\.logo\s*\{([^}]*)\}/.exec(CSS)[1];
  assert.match(base, /-webkit-user-drag:\s*none/,
    'la règle de base doit refuser le glisser : l’attribut peut manquer sur du contenu injecté, la feuille non');
  assert.match(base, /user-select:\s*none/,
    'la sélection est coupée : un glisser-sélectionner-copier emporterait l’image par un autre chemin');
  for (const bloc of CSS.match(/\.logo\s*\{[^}]*\}/g) || []) {
    assert.doesNotMatch(bloc, /user-drag:\s*auto/,
      'aucune règle .logo ne doit rendre le glisser possible');
    assert.doesNotMatch(bloc, /user-select:\s*(auto|text)/,
      'aucune règle .logo ne doit rendre la sélection possible');
  }
});

test('le clic droit est refusé sur le logo — exécuté, pas relu', () => {
  const debut = JS.indexOf('function protegerLogo(');
  assert.ok(debut > 0, 'protegerLogo() doit exister dans app.js');
  let niveau = 0;
  let source = '';
  for (let i = JS.indexOf('{', debut); i < JS.length; i++) {
    if (JS[i] === '{') niveau++;
    else if (JS[i] === '}' && --niveau === 0) { source = JS.slice(debut, i + 1); break; }
  }
  assert.ok(source, 'accolades non équilibrées dans protegerLogo()');

  const poses = [];
  const img = { addEventListener: (type, fn) => poses.push({ type, fn }) };
  const contexte = {};
  vm.createContext(contexte);
  vm.runInContext(source, contexte);
  contexte.protegerLogo(img);

  const types = poses.map((p) => p.type).sort();
  assert.deepEqual(types, ['contextmenu', 'dragstart'],
    'le clic droit ET le glisser doivent être écoutés : le menu du clic droit porte '
    + '« Enregistrer l’image sous… », et un navigateur peut ignorer draggable="false"');

  for (const { type, fn } of poses) {
    let refuse = false;
    fn({ preventDefault: () => { refuse = true; } });
    assert.ok(refuse, `l’événement « ${type} » doit être refusé`);
  }
  assert.match(JS, /document\.querySelectorAll\('img\.logo'\)\.forEach\(protegerLogo\)/,
    'et la protection doit être POSÉE sur le logo de l’en-tête, sinon elle ne sert à rien');
});

test('les pages de partage portent le même refus et la même taille', () => {
  for (const gabarit of ['outils/pages-partage.mjs', 'outils/pages-rubriques.mjs']) {
    const s = lire(gabarit);
    const img = /<img src="\/favicon\.svg"[^>]*>/.exec(s);
    assert.ok(img, `${gabarit} doit afficher le logo`);
    assert.match(img[0], /draggable="false"/, `${gabarit} : le logo des pages partagées se copie au glisser`);
    const regle = /header img\{([^}]*)\}/.exec(s);
    assert.ok(regle, `${gabarit} : la règle header img doit exister`);
    const t = Number(/width:(\d+)px/.exec(regle[1])[1]);
    assert.ok(t >= 26 * MINIMUM,
      `${gabarit} : le logo des pages partagées fait ${t} px, il faut au moins ${26 * MINIMUM} px (26 + 20 %)`);
    assert.match(regle[1], /-webkit-user-drag:none/, `${gabarit} : glisser non refusé par la feuille`);
  }
});
