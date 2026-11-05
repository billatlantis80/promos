/**
 * LE TITRE DU BANDEAU DES RÉGLAGES DOIT SE LIRE SUR SON PROPRE FOND.
 * =============================================================================
 *
 * CE QUE CE FICHIER EMPÊCHE
 *
 * 1. UN TITRE INVISIBLE. B l'a vu avant tout test : « le nom de la rubrique
 *    réglage doit être écrit en blanc car actuellement elle est en bleu foncé
 *    sur du bleu ». Mesuré au navigateur, dans le thème de marque : titre
 *    rgb(22,50,74) sur bandeau rgb(13,59,91) — 1,05:1, c'est-à-dire rien.
 *
 *    La cause n'est pas une couleur mal choisie, c'est un JETON MAL EMPLOYÉ :
 *    le bandeau prend son fond dans --tete, mais le titre prenait sa couleur
 *    dans --texte, qui est la couleur du texte SUR LE FOND DE LA PAGE. Dans les
 *    thèmes sombres, les deux se ressemblent et personne ne voit rien ; dans le
 *    thème clair à bandeau bleu nuit, les deux sont bleu foncé.
 *
 * 2. LA RÉCIDIVE DANS UN THÈME QU'ON AJOUTERA. Un thème neuf peut parfaitement
 *    oublier --sur-tete : la déclaration absente retombe alors sur celle de
 *    :root, et le titre redevient illisible sans que rien ne le signale. On
 *    exige donc que CHAQUE thème déclare le sien, et on mesure les onze.
 *
 * 3. LA COULEUR JUSTE QUE PERSONNE N'UTILISE. C'est le défaut déjà rencontré sur
 *    ce projet : une traduction qui existe dans les neuf dictionnaires mais
 *    qu'aucun code n'appelle. Un jeton correct dans les onze thèmes ne sert à
 *    rien si la règle CSS continue de lire --texte. Le dernier contrôle vérifie
 *    donc que la règle LIT le jeton.
 *
 * Lancement : node --test tests/contraste-bandeau.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// LES COMMENTAIRES SONT RETIRÉS AVANT LA MESURE. Leurs lignes ont exactement la
// forme d'une déclaration : « --tete : fond de l'en-tête collant (…) ». Le
// premier extracteur les lisait donc comme des valeurs, et la couleur de :root
// devenait une phrase française. Le défaut ne se voyait nulle part : il
// produisait un message d'échec incompréhensible au lieu d'un résultat faux.
const CSS = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Découpe la feuille en blocs `:root { … }` et `html[data-theme="x"] { … }`. */
function blocs() {
  const trouves = [];
  const re = /(:root|html\[data-theme="([a-z]+)"\])\s*\{([^}]*)\}/g;
  for (const m of CSS.matchAll(re)) trouves.push({ nom: m[2] || ':root', corps: m[3] });
  return trouves;
}

/** Les déclarations d'un bloc, en tableau (la dernière gagne, comme en CSS). */
function jetons(corps) {
  const t = {};
  for (const m of corps.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) t[m[1]] = m[2].trim();
  return t;
}

/** « #0d3b5b », « #abc », « rgba(12, 13, 16, .94) » → [r, g, b, a]. */
function couleur(txt) {
  const s = String(txt).trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat([1]);
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat([1]);
  m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  throw new Error(`couleur illisible : « ${s} »`);
}

/** Pose une couleur (éventuellement translucide) sur un fond opaque. */
function poser([r, g, b, a], [fr, fg, fb]) {
  return [r * a + fr * (1 - a), g * a + fg * (1 - a), b * a + fb * (1 - a), 1];
}

const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * canal(r / 255) + 0.7152 * canal(g / 255) + 0.0722 * canal(b / 255);
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const TOUS = blocs();
const RACINE = jetons(TOUS.find((b) => b.nom === ':root').corps);

test('chaque thème déclare sa couleur de texte du bandeau', () => {
  // Neuf thèmes + « kazendra ». Une déclaration manquante retomberait en
  // silence sur celle de :root, et le titre pourrait redevenir illisible.
  assert.ok(TOUS.length >= 11, `onze blocs attendus, trouvé ${TOUS.length}`);
  for (const b of TOUS) {
    if (b.nom === ':root') continue;
    const t = jetons(b.corps);
    assert.ok(t['--sur-tete'],
      `le thème « ${b.nom} » n'a pas de --sur-tete : le titre du bandeau `
      + 'retomberait sur une couleur prévue pour le fond de la page');
  }
});

test('le titre du bandeau se lit sur son fond, dans les onze thèmes', () => {
  const mesures = [];
  for (const b of TOUS) {
    const t = { ...RACINE, ...jetons(b.corps) };
    const fondPage = couleur(t['--fond']);
    const bandeau = poser(couleur(t['--tete']), fondPage);
    const titre = poser(couleur(t['--sur-tete']), bandeau);
    const c = contraste(titre, bandeau);
    mesures.push(`${b.nom} ${c.toFixed(2)}:1`);
    assert.ok(c >= 4.5,
      `thème « ${b.nom} » : le titre du bandeau donne ${c.toFixed(2)}:1 `
      + `(${t['--sur-tete']} sur ${t['--tete']}) — seuil AA 4,5:1`);
  }
  console.log('      ' + mesures.join(' · '));
});

test('le défaut d’origine est bien décrit : kazendra était illisible', () => {
  // Contre-épreuve à l'envers, faite ici pour que le motif du correctif ne
  // s'efface pas : avec --texte (la couleur du texte de la page) au lieu de
  // --sur-tete, le thème de marque tombait sous le seuil. Si un jour ce calcul
  // change et ne montre plus le défaut, c'est la mesure qui est fausse, pas le
  // défaut qui a disparu.
  const k = { ...RACINE, ...jetons(TOUS.find((b) => b.nom === 'kazendra').corps) };
  const bandeau = poser(couleur(k['--tete']), couleur(k['--fond']));
  const ancien = contraste(poser(couleur(k['--texte']), bandeau), bandeau);
  const neuf = contraste(poser(couleur(k['--sur-tete']), bandeau), bandeau);
  assert.ok(ancien < 4.5, `--texte donnait ${ancien.toFixed(2)}:1, on attendait un échec`);
  assert.ok(neuf >= 4.5, `--sur-tete donne ${neuf.toFixed(2)}:1, on attendait un succès`);
});

test('la règle CSS lit vraiment le jeton', () => {
  // Le jeton juste que personne n'utilise : le défaut déjà rencontré sur ce
  // projet avec une traduction présente mais jamais branchée.
  const regle = CSS.match(/\.feuille-tete h2\s*\{([^}]*)\}/);
  assert.ok(regle, 'la règle .feuille-tete h2 a disparu');
  assert.match(regle[1], /color:\s*var\(--sur-tete\)/,
    'le titre du bandeau doit prendre --sur-tete : sinon le jeton est décoratif');
});
