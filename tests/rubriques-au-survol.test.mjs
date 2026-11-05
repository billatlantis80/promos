/**
 * LA BARRE DES RUBRIQUES SE MONTRE AU SURVOL, ET RIEN D'AUTRE NE LA REFERME.
 *
 * Demandes de B, 11/10/2026, mot pour mot :
 *   « Concernant la barre où il y a les catégories, tout, high-tech,
 *     électroménager, meuble, maison, etc… Peux-tu faire une animation pour
 *     qu'elle apparaisse quand la souris va dessus et qu'elle disparaisse quand
 *     la souris part de cette zone ; la ligne chercher un produit avec le choix
 *     du pays et des promos et des affichages doit rester apparente tout le
 *     temps. C'est juste la ligne des catégories qui doit avoir ce mouvement
 *     d'apparition et de disparition. »
 *   puis, la première version ayant refermé la barre après un choix :
 *   « Après un clic sur une catégorie elle se referme, je ne souhaite pas ça je
 *     souhaite qu'elle disparaisse uniquement quand on quitte la zone. Car un
 *     utilisateur peut cliquer dans plusieurs catégories, lors de la même
 *     manipulation. »
 *
 * Ce test défend cinq choses, et chacune a un défaut réel derrière elle :
 *
 *   1. LES AUTRES LIGNES NE BOUGENT PAS. Toute règle de ce bloc vise `.tete` et
 *      rien d'autre : la marque, la recherche, le pays, la portée, les
 *      affichages, Éco/Thème, les favoris et les réglages restent là en
 *      permanence.
 *
 *   2. LE TÉLÉPHONE GARDE SA BARRE. La condition est celle de la SOURIS
 *      (`hover: hover` et `pointer: fine`), jamais la seule largeur : une
 *      tablette tactile de 1 024 px n'a pas de survol, et une barre cachée sous
 *      cette seule condition serait INATTEIGNABLE pour elle.
 *
 *   3. LE CLAVIER GARDE SON CHEMIN. La barre cachée reste dans l'ordre de
 *      tabulation (`opacity: 0`, jamais `visibility: hidden` ni
 *      `display: none`) et `:focus-within` la rallume : les 17 rubriques
 *      restent atteignables sans souris. Une barre transparente ne doit pas non
 *      plus attraper les clics destinés aux offres qu'elle recouvre
 *      (`pointer-events: none` au repos).
 *
 *   4. UN CLIC NE REFERME RIEN — on doit pouvoir enchaîner plusieurs rubriques.
 *      Aucune classe de la feuille ne peut éteindre la barre : elle ne disparaît
 *      que si la souris quitte la zone. Défaut payé : la première version la
 *      refermait au clic, et B a dû le redemander.
 *
 *   5. LE FOCUS EST LE SEUL PIÈGE, ET IL EST TRAITÉ. Une puce cliquée garde le
 *      focus ; `:focus-within` (qui sert au clavier) retiendrait alors la barre
 *      ouverte APRÈS le départ de la souris — l'inverse de la demande. On
 *      EXÉCUTE donc la vraie fonction, avec un clavier et une souris simulés :
 *      c'est le seul moyen de dire ce qui se passe, pas seulement ce que le
 *      code écrit.
 *
 * Lancement : node --test tests/rubriques-au-survol.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', 'public', f), 'utf8');
// Les commentaires sont retirés AVANT toute lecture : ce fichier de feuille est
// plein d'explications qui parlent de `display: none` et de `visibility:
// hidden` pour dire qu'on ne s'en sert pas — un test qui lit le texte brut
// accuserait ses propres notes.
const CSS = lire('app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const JS = lire('app.js');

/** Le `@media` qui porte une règle donnée, et son corps. */
function palierDe(motif) {
  const i = CSS.indexOf(motif);
  assert.ok(i > 0, `la règle « ${motif} » doit exister dans app.css`);
  const debut = CSS.lastIndexOf('@media', i);
  assert.ok(debut >= 0, `la règle « ${motif} » doit vivre dans un @media`);
  const finBraces = (depuis) => {
    let niveau = 0;
    for (let j = depuis; j < CSS.length; j++) {
      if (CSS[j] === '{') niveau++;
      else if (CSS[j] === '}' && --niveau === 0) return j;
    }
    throw new Error('accolades non équilibrées');
  };
  const ouvert = CSS.indexOf('{', debut);
  return { tete: CSS.slice(debut, ouvert).trim(), corps: CSS.slice(ouvert + 1, finBraces(ouvert)) };
}

/** Les têtes de règles de PREMIER niveau d'un morceau de CSS. */
function reglesDe(corps) {
  const tetes = [];
  let niveau = 0;
  let debut = 0;
  for (let i = 0; i < corps.length; i++) {
    const c = corps[i];
    if (c === ';' && niveau === 0) debut = i + 1;
    else if (c === '{') { if (niveau === 0) tetes.push(corps.slice(debut, i).trim()); niveau++; debut = i + 1; }
    else if (c === '}') { niveau--; debut = i + 1; }
  }
  return tetes;
}

const PALIER = palierDe('.tete:hover .puces');

test('la barre obéit à la SOURIS, jamais à la seule largeur', () => {
  assert.match(PALIER.tete, /^@media \(min-width: 1024px\) and \(hover: hover\) and \(pointer: fine\)$/,
    'la condition doit être celle de la souris : une tablette tactile de 1 024 px n’a pas de survol');
  const largeur = Number(/min-width:\s*(\d+)px/.exec(PALIER.tete)[1]);
  assert.ok(largeur >= 1024, `palier à ${largeur} px : un téléphone en paysage y entrerait`);
});

test('la même condition est écrite DANS LES DEUX LANGUES, et elles concordent', () => {
  // Une règle écrite deux fois (CSS + JS) se vérifie deux fois : si les deux
  // chaînes divergent, le comportement du clic ne parle plus du même appareil,
  // et le défaut n'apparaît que sur le support oublié.
  const js = /const SOURIS_PC = '([^']+)'/.exec(JS);
  assert.ok(js, 'app.js doit nommer la condition de la souris (SOURIS_PC)');
  assert.equal(PALIER.tete.replace(/^@media\s+/, ''), js[1],
    'la condition du CSS et celle du JS doivent être identiques au caractère près');
});

test('les lignes qui doivent rester apparentes ne sont pas touchées', () => {
  const tetes = reglesDe(PALIER.corps);
  assert.ok(tetes.length >= 2, 'le bloc doit porter la règle de repos ET celle du survol');
  for (const t of tetes) {
    assert.match(t, /^\.tete\b/,
      `règle « ${t} » : elle doit viser l’en-tête (et la barre qu’il contient), rien d’autre — `
      + 'la recherche, le pays, la portée, les affichages et les réglages restent là en permanence');
  }
  for (const interdit of ['.barre', '.outils', '.tete-in', '.marque']) {
    assert.ok(!new RegExp(`(^|[\\s,])${interdit.replace('.', '\\.')}[\\s,:{]`).test(PALIER.corps),
      `${interdit} ne doit pas être touché par la règle du survol`);
  }
});

test('le clavier garde son chemin, la souris ne peut pas piéger les clics', () => {
  assert.match(PALIER.corps, /opacity: 0/, 'au repos la barre est transparente');
  assert.doesNotMatch(PALIER.corps, /visibility:\s*hidden/,
    '`visibility: hidden` retirerait les 17 rubriques du parcours au clavier, en silence');
  assert.doesNotMatch(PALIER.corps, /display:\s*none/,
    '`display: none` les retirerait aussi — la barre cachée doit rester tabulable');
  assert.match(PALIER.corps, /pointer-events: none/,
    'au repos, la barre transparente ne doit pas attraper les clics des offres qu’elle recouvre');
  assert.match(PALIER.corps, /\.tete:focus-within \.puces/,
    '`:focus-within` doit rallumer la barre dès qu’un onglet entre dedans');
});

test('RIEN ne referme la barre : elle ne part qu’en quittant la zone', () => {
  // Une classe d’état sur l’en-tête (`:not(.…:hover)`) suffisait à refermer la
  // barre au clic : c’est le défaut que B a signalé (« je ne souhaite pas ça »).
  // On refuse donc toute classe dans le sélecteur du survol, et toute fonction
  // de fermeture dans le script.
  assert.doesNotMatch(PALIER.corps, /:not\(/,
    'le survol ne doit dépendre d’AUCUNE classe : sinon un clic peut refermer la barre '
    + 'et l’utilisateur ne peut plus enchaîner plusieurs rubriques');
  assert.doesNotMatch(CSS, /rubriques-rangees/,
    'la feuille ne doit plus connaître de classe de fermeture de la barre');
  assert.doesNotMatch(JS, /fermerRubriques|RUBRIQUES_VERROU/,
    'le script ne doit plus refermer la barre après un choix');
  assert.match(JS, /apresClicPuce\(ev\)/, 'le clic sur une puce passe par apresClicPuce()');
});

test('la barre sort du flux : le catalogue ne bouge pas quand elle s’ouvre', () => {
  assert.match(PALIER.corps, /position: absolute/,
    'la barre doit se POSER sur le catalogue, pas le pousser : sinon la page saute sous le curseur');
  assert.match(PALIER.corps, /grid-area: auto/,
    'sur un enfant en position absolue d’une grille, un emplacement nommé ferait de la CASE '
    + 'l’élément de référence — la barre se dessinerait à la largeur du contenu, décollée des bords');
});

test('le fond du panneau est OPAQUE — les visuels des offres ne se lisent pas au travers', () => {
  assert.match(PALIER.corps, /background-color: var\(--fond\)/,
    'le fond de page, opaque, doit être posé sous la teinte de l’en-tête');
  assert.match(PALIER.corps, /background-image: linear-gradient\(var\(--tete\), var\(--tete\)\)/,
    'la teinte de l’en-tête se pose PAR-DESSUS ce fond opaque');
  assert.doesNotMatch(PALIER.corps, /background:\s*var\(--tete\)/,
    '`--tete` est translucide (.94) : seul, il laisse voir les images des cartes '
    + '— défaut constaté sur les thèmes clairs, où il ne peut pas être rattrapé par un flou');
  assert.doesNotMatch(PALIER.corps, /backdrop-filter/,
    'un `backdrop-filter` ici ne brouillerait pas les offres : l’en-tête, qui en porte un, '
    + 'crée une racine de fond pour ses descendants — le flou n’aurait rien à brouiller');
});

/** Le source de `apresClicPuce`, avec la condition qu’elle emploie. */
function sourceApresClic() {
  const debut = JS.indexOf('const SOURIS_PC');
  assert.ok(debut > 0, 'la condition SOURIS_PC doit exister dans app.js');
  const marque = JS.indexOf('function apresClicPuce(');
  assert.ok(marque > 0, 'apresClicPuce() doit exister dans app.js');
  let niveau = 0;
  for (let i = JS.indexOf('{', marque); i < JS.length; i++) {
    if (JS[i] === '{') niveau++;
    else if (JS[i] === '}' && --niveau === 0) return JS.slice(debut, i + 1);
  }
  throw new Error('accolades non équilibrées dans apresClicPuce()');
}

/** Joue `apresClicPuce` avec une souris ou un clavier simulés. */
function jouer({ souris = true, detail = 1, focusDansLaBarre = true, appareilASouris = true } = {}) {
  const etat = { oublie: false, classes: new Set() };
  const contexte = {
    window: { matchMedia: () => ({ matches: appareilASouris && souris }) },
    document: {
      querySelector: () => ({
        contains: () => focusDansLaBarre,
        classList: { add: (c) => etat.classes.add(c), remove: (c) => etat.classes.delete(c) },
      }),
      activeElement: { blur: () => { etat.oublie = true; } },
    },
  };
  vm.createContext(contexte);
  vm.runInContext(sourceApresClic(), contexte);
  etat.rendu = contexte.apresClicPuce({ detail });
  return etat;
}

test('UN CLIC ne referme RIEN, et rend seulement le focus — exécuté, pas relu', () => {
  const clic = jouer({ detail: 1 });
  assert.equal(clic.rendu, true, 'un clic de souris doit rendre le focus à la page');
  assert.ok(clic.oublie, 'sinon `:focus-within` retiendrait la barre ouverte après le départ de la souris');
  assert.equal(clic.classes.size, 0,
    'et AUCUNE classe ne doit être posée : la barre ne se referme pas, on peut enchaîner les rubriques');
});

test('au CLAVIER (Entrée, Espace), la barre n’est pas touchée du tout', () => {
  // `ev.detail` vaut 0 pour une activation au clavier : c’est le focus qui tient
  // la barre ouverte pendant qu’on avance à la tabulation. Le retirer éteindrait
  // la barre sous les doigts de qui navigue au clavier.
  const clavier = jouer({ detail: 0 });
  assert.equal(clavier.rendu, false, 'aucune action ne doit être prise au clavier');
  assert.ok(!clavier.oublie, 'le focus doit RESTER : c’est lui qui garde la barre ouverte');
  assert.equal(clavier.classes.size, 0, 'aucune classe non plus');
});

test('hors souris (téléphone, tablette), le clic sur une puce ne fait rien', () => {
  const tactile = jouer({ appareilASouris: false, detail: 1 });
  assert.equal(tactile.rendu, false, 'sans survol, il n’y a rien à rendre : la barre est toujours là');
  assert.ok(!tactile.oublie, 'et le focus d’un doigt qui tape une puce doit rester où il est');
});
