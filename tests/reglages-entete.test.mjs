/**
 * LE HAUT DES RÉGLAGES NE DOIT PAS SE RECOUVRER LUI-MÊME.
 * =============================================================================
 *
 * CE QUE CE FICHIER EMPÊCHE
 *
 * UN DÉFAUT QUE B A VU AVANT TOUT TEST : « dans réglage il y a un défaut, la
 * partie anglais superpose la partie bleue de réglage […] le blanc ne passe pas
 * sur le bleu ».
 *
 * Ce n'était PAS un problème de langue, ni de couleur. Le bandeau du titre et la
 * barre d'onglets étaient DEUX éléments `position: sticky; top: 0` dans le même
 * compartiment. Au défilement, les deux se collaient au même endroit, et la
 * barre des onglets — blanche, `z-index: 2` — passait par-dessus le bandeau bleu
 * (`z-index: 1`). Le titre « Réglages » disparaissait sous les onglets.
 *
 * La langue n'y était pour rien, mais elle rendait le défaut visible : « Thème
 * et affichage » est plus long que « Theme and display », la barre d'onglets
 * n'occupait pas la même hauteur, et le recouvrement se voyait.
 *
 * POURQUOI UN TEST DE STRUCTURE, ET PAS SEULEMENT DE COULEUR. Rejouer sur les
 * `z-index` aurait reculé le défaut d'un cran : le prochain élément collant
 * ajouté dans ce compartiment l'aurait ramené. La seule garantie solide est
 * qu'il n'y ait QU'UN SEUL élément collant en haut de la feuille, et qu'il
 * contienne les deux autres. C'est ce que ce fichier exige.
 *
 * Lancement : node --test tests/reglages-entete.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const CSS = lire('public/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const HTML = lire('public/index.html');

/** Le corps d'une règle CSS, sans commentaires. */
function regle(selecteur) {
  const m = CSS.match(new RegExp(`(?:^|[}\n])\\s*${selecteur.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

/** Combien d'éléments collants en haut dans le haut des réglages ? */
function collants() {
  return ['.feuille-haut', '.feuille-tete', '.onglets'].filter((s) => {
    const c = regle(s);
    return c && /position:\s*sticky/.test(c) && /top:\s*0/.test(c);
  });
}

test('un seul élément collant en haut des Réglages — pas deux qui se recouvrent', () => {
  const c = collants();
  assert.deepEqual(c, ['.feuille-haut'],
    `exactement UN élément collant attendu (.feuille-haut), trouvé ${c.length} : ${c.join(', ')}.\n`
    + 'Deux éléments collants à `top: 0` dans le même compartiment se recouvrent : '
    + 'le dernier arrivé passe par-dessus le premier.');
});

test('le bloc collant porte le fond du bandeau et contient ses deux parties', () => {
  const haut = regle('.feuille-haut');
  assert.ok(haut, 'la règle .feuille-haut a disparu');
  assert.match(haut, /background:\s*var\(--tete\)/,
    'c’est le bloc collant qui doit porter le fond du bandeau : sinon le texte '
    + 'défile visiblement sous lui');
  // Le bandeau comme les onglets sont des enfants de .feuille-haut : ils collent
  // et défilent ensemble, leur hauteur n’a pas à être connue en pixels.
  const debut = HTML.indexOf('<div class="feuille-haut">');
  assert.ok(debut > -1, 'le bloc .feuille-haut est absent de index.html');
  const fin = HTML.indexOf('<div class="panneau"', debut);
  const interieur = HTML.slice(debut, fin);
  assert.ok(interieur.includes('class="feuille-tete"'),
    'le bandeau du titre doit être DANS le bloc collant');
  assert.ok(interieur.includes('class="onglets"'),
    'la barre d’onglets doit être DANS le bloc collant');
});

test('ni le bandeau ni les onglets ne collent de leur côté', () => {
  // Le contrôle qui manquait : c'est la présence de `sticky` sur un des deux
  // enfants qui créait le recouvrement.
  for (const s of ['.feuille-tete', '.onglets']) {
    const c = regle(s);
    assert.ok(c, `la règle ${s} a disparu`);
    assert.ok(!/position:\s*sticky/.test(c),
      `${s} ne doit plus être collant : il l’est déjà par son parent, et deux `
      + 'éléments collants au même endroit se recouvrent');
  }
});

test('les onglets ne repeignent plus leur propre bande', () => {
  // La barre d'onglets peignait une bande OPAQUE de la couleur du fond de page
  // (`--fond`, blanche dans le thème de marque) pour masquer le contenu qui
  // défile dessous. C'est cette bande blanche qui « ne passait pas sur le bleu ».
  const c = regle('.onglets');
  assert.ok(!/background:\s*var\(--fond\)/.test(c),
    'la barre d’onglets ne doit plus porter de bande opaque : elle est posée '
    + 'sur le bandeau bleu, comme les pastilles de la page principale');
  assert.match(c, /background:\s*transparent/,
    'l’arrière-plan des onglets doit être transparent');
});

test('le titre garde sa couleur propre sur le bandeau', () => {
  // Rappel du défaut précédent, qui n’est pas celui-ci mais qui vivait au même
  // endroit : le titre prenait `--texte`, la couleur du texte de la PAGE, sur un
  // fond pris dans `--tete`. Un jeton dédié, mesuré sur les onze thèmes, évite
  // que les deux se ressemblent.
  assert.match(regle('.feuille-tete h2') || '', /color:\s*var\(--sur-tete\)/,
    'le titre du bandeau doit prendre --sur-tete');
});
