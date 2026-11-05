/**
 * L'ORDRE DES BOUTONS DE LA BARRE D'OUTILS, SUR PC.
 *
 * Demande de B, 11/10/2026 : « Sur l'affichage PC toujours, il faut inverser le
 * bouton favoris et thème, le thème doit être juste avant les paramètres. »
 *
 * Ce que ce test défend : le glissement est PUREMENT visuel. Dans la page, les
 * deux boutons gardent leur place (favoris, puis thème) — c'est l'ordre du
 * document, et il ne bouge pas, sans quoi le TÉLÉPHONE changerait d'ordre sans
 * qu'on lui ait rien demandé (il n'affiche même pas le thème). L'échange se fait
 * par l'ORDRE FLEXIBLE, dans le palier « souris », et nulle part ailleurs :
 *   - `#fav` reçoit le rang 1, `#themesBouton` le 2, `#reglages` le 3 ;
 *   - la portée et les affichages restent au rang 0, donc devant ;
 *   - aucun autre `order` n'existe dans la feuille, sinon un support
 *     quelconque hériterait du rang sans qu'on s'en aperçoive.
 *
 * Lancement : node --test tests/ordre-outils-pc.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', 'public', f), 'utf8');
const CSS = lire('app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const HTML = lire('index.html').replace(
  /<!-- DEBUT-FEUILLE-EN-LIGNE -->[\s\S]*?<!-- FIN-FEUILLE-EN-LIGNE -->/,
  '<!-- feuille retirée -->',
);

const CONDITION = '@media (min-width: 1024px) and (hover: hover) and (pointer: fine)';

/** Le corps du palier « souris » qui contient les rangs. */
function palierSouris() {
  const debut = CSS.indexOf(CONDITION);
  assert.ok(debut > 0, 'le palier « souris » doit exister');
  // Celui qui porte les rangs : le premier `#fav { order:` de la feuille.
  const rang = CSS.indexOf('#fav { order:', debut);
  assert.ok(rang > 0, 'le rang de #fav doit vivre dans un palier souris');
  const debutBloc = CSS.lastIndexOf(CONDITION, rang);
  const ouvert = CSS.indexOf('{', debutBloc);
  let niveau = 0;
  for (let i = ouvert; i < CSS.length; i++) {
    if (CSS[i] === '{') niveau++;
    else if (CSS[i] === '}' && --niveau === 0) return CSS.slice(ouvert + 1, i);
  }
  throw new Error('accolades non équilibrées dans le palier souris');
}

const PALIER = palierSouris();

const rang = (id) => {
  const m = new RegExp(`#${id} \\{ order: (\\d+); \\}`).exec(PALIER);
  assert.ok(m, `#${id} doit recevoir un rang dans le palier souris`);
  return Number(m[1]);
};

test('le thème passe JUSTE AVANT les réglages, et après les favoris', () => {
  const favoris = rang('fav');
  const theme = rang('themesBouton');
  const reglages = rang('reglages');
  assert.ok(favoris < theme, 'les favoris doivent passer AVANT le thème');
  assert.ok(theme < reglages, 'et le thème juste AVANT les réglages');
  assert.ok(favoris > 0,
    'les trois rangs doivent être supérieurs à 0 : la portée et les affichages gardent le rang 0, '
    + 'donc la tête de la ligne ne bouge pas');
});

test('aucun autre `order` dans la feuille : les autres supports ne sont pas touchés', () => {
  // ⚠ `\b` EST INDISPENSABLE : sans lui, la recherche attrape « border: 1px » —
  // « b|order: 1 » contient bien « order: 1 ». Première version de ce test : elle
  // annonçait 40 rangs dans la feuille et accusait des bordures.
  const tous = CSS.match(/\border:\s*\d+/g) || [];
  assert.equal(tous.length, 3,
    `la feuille ne doit porter que les trois rangs des boutons ({${tous.join(', ')}} trouvés) : `
    + 'un `order` de plus déplacerait un bouton sur un support qui n’a rien demandé');
});

test('l’ordre du DOCUMENT ne change pas : le téléphone garde le sien', () => {
  // La barre d'outils se termine juste avant la barre des rubriques : couper au
  // premier `</div>` s'arrêtait à la fin du groupe des affichages, et les trois
  // boutons cherchés n'étaient même pas dans le morceau.
  const debut = HTML.indexOf('class="outils"');
  const outils = HTML.slice(debut, HTML.indexOf('<nav class="puces"', debut));
  const iFav = outils.indexOf('id="fav"');
  const iTheme = outils.indexOf('id="themesBouton"');
  const iReglages = outils.indexOf('id="reglages"');
  assert.ok(iFav > 0 && iTheme > 0 && iReglages > 0, 'les trois boutons doivent être dans la barre d’outils');
  assert.ok(iTheme < iFav && iFav < iReglages,
    'l’échange est VISUEL : dans la page, le thème reste AVANT les favoris (c’est l’ordre d’origine) '
    + 'et c’est la feuille qui les échange. Si le HTML était réordonné, le téléphone — qui n’affiche '
    + 'même pas le thème — changerait d’ordre sans qu’on le lui demande');
});
