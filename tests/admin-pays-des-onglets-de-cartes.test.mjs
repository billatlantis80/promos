/* =============================================================================
   LE PAYS CONSULTÉ DANS « VIE DES CARTES » ET « AJOUTS & REFUS ».

   Demande de B, 15/10/2026 : « j'ai besoin qu'au niveau de l'affichage ce soit
   comme marché euro et affiliation, avec le panneau qui trie par pays. Comme ça
   je peux regarder les cartes pays par pays. »

   CE QUE CETTE ÉPREUVE TIENT, ET POURQUOI ELLE EST ÉCRITE AINSI.

   1. UN SEUL CHOIX POUR LES DEUX ONGLETS. Deux réglages auraient divergé à la
      première consultation — l'un sur la Belgique, l'autre sur le Portugal, et
      personne pour dire lequel est « le » pays consulté. L'épreuve refuse donc
      une seconde variable de pays : il n'y a qu'une `paysChoisiCartes`, et les
      deux barres la lisent.

   2. LE MÊME CONTRÔLE QUE LE MARCHÉ EURO. Tuiles à drapeaux, jamais un menu
      déroulant (B, 08/10/2026 : « un menu déroulant en cachait onze sur douze
      derrière un clic »), jamais un emoji de drapeau (sous Windows il s'affiche
      « FR » dans un carré). La tuile « Tous les pays » existe pour qu'on puisse
      REVENIR à la vue complète : une lecture qui s'ajoute ne doit pas retirer
      celle d'avant.

   3. CE QUI N'EST PAS DÉCOUPABLE LE DIT. Les compteurs de la règle des cinq
      jours et les mécanismes d'un passage décrivent TOUT le catalogue : l'extrait
      publié du journal ne les sépare pas par pays. Filtrer les tableaux voisins
      sans le dire ferait lire ces chiffres-là comme ceux du pays. Les quatre
      blocs concernés portent donc `avisTousPays`, et l'épreuve refuse leur
      disparition — c'est la seule chose qui empêche l'écran de mentir par
      omission.

   4. LA BARRE FAIT DES COMPTES QUI EXISTENT. Le nombre d'une tuile vient des
      fiches qui portent un pays, et d'elles seules : une fiche sans pays reste
      dans « Tous les pays » au lieu d'être rattachée à un pays qu'on inventerait.

   Lancement : node --test tests/admin-pays-des-onglets-de-cartes.test.mjs
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const HTML = lire('public/admin/index.html');
const DEBUT = HTML.indexOf('<script type="module">') + '<script type="module">'.length;
const JS = HTML.slice(DEBUT, HTML.indexOf('</script>', DEBUT));

/** Un morceau du fichier, entre deux repères — il refuse de rendre un vide. */
function entre(debut, fin) {
  const d = JS.indexOf(debut);
  const f = JS.indexOf(fin, d);
  assert.ok(d >= 0, `le panneau doit contenir « ${debut} »`);
  assert.ok(f > d, `« ${fin} » doit venir APRÈS « ${debut} »`);
  return JS.slice(d, f);
}

/** Le bac à sable : les vraies fonctions de la barre, le vrai `esc`. Le nom d'un
 *  pays est rendu par un témoin (« nom du pays ») : ce n'est pas lui qu'on
 *  vérifie ici, c'est le filtre et le compte. */
function bac() {
  const ctx = vm.createContext({ console });
  const esc = JS.slice(JS.indexOf('const esc = (s) =>'), JS.indexOf('}[c]));') + '}[c]));'.length);
  vm.runInContext([esc,
    "let paysChoisiCartes = '';",
    "const nomDuPays = (c) => (c ? 'nom du pays' : '—');",
    entre('const dansPaysChoisi', 'function barreDePays'),
    entre('function paysDesFiches', 'function dessinerBarreCartes'),
  ].join('\n'), ctx);
  return ctx;
}

const catalogue = () => JSON.parse(lire('docs/offres.json'));
const journal = () => JSON.parse(lire('docs/suivi-cartes.json'));

/* -------------------------------------------------------------------------- *
 *  1. LE CONTRÔLE EXISTE, DANS LES DEUX ONGLETS, ET C'EST CELUI DU MARCHÉ EURO.
 * -------------------------------------------------------------------------- */

test('les deux onglets de cartes portent le même choix de pays que le Marché Euro', () => {
  for (const [id, onglet] of [['paysCartesVie', 'cartes'], ['paysCartesAjouts', 'refusees']]) {
    const motif = new RegExp(`<section data-vue="${onglet}">[\\s\\S]*?id="${id}"`);
    assert.match(HTML, motif, `l’onglet « ${onglet} » doit porter sa barre de pays`);
  }
  // LE MÊME BALISAGE, recopié du Marché Euro : grille de tuiles sur trois colonnes
  // et groupe de radios. Un `<select>` ici serait exactement ce que B a fait
  // retirer ailleurs — et l'épreuve le refuse.
  const barres = [...HTML.matchAll(/class="pays-liste pays-2col" id="(paysCartes[A-Za-z]+)" role="radiogroup"/g)]
    .map((m) => m[1]);
  assert.deepEqual(barres.sort(), ['paysCartesAjouts', 'paysCartesVie'],
    'les deux barres doivent employer la grille de tuiles du Marché Euro, en groupe de radios');
  assert.ok(!/id="paysCartes[A-Za-z]+"[^>]*<option/.test(HTML), 'jamais un menu déroulant');
});

test('un seul pays retenu, une seule variable, et il s’en souvient', () => {
  // UNE variable, et elle seule : deux variables auraient divergé.
  assert.equal((JS.match(/let paysChoisiCartes/g) || []).length, 1,
    'il ne doit y avoir qu’UNE variable de pays pour les deux onglets');
  assert.equal((JS.match(/localStorage\.setItem\('kazendra\.paysCartes'/g) || []).length, 1,
    'et une seule écriture en mémoire, comme les deux autres barres');
  assert.match(JS, /localStorage\.getItem\('kazendra\.paysCartes'\)/,
    'la mémoire doit être relue à l’ouverture, sinon le pays est oublié à chaque visite');
  // LES DEUX BARRES SONT DESSINÉES PAR LA MÊME FONCTION : une seule façon de
  // peindre un pays dans cet onglet, donc pas de divergence possible.
  assert.match(JS, /function dessinerBarreCartes\(\)/);
  const corps = entre('function dessinerBarreCartes()', '/* ---------- VIE DES CARTES ----------');
  for (const id of ['paysCartesAjouts', 'paysCartesVie']) {
    assert.ok(corps.includes(`'${id}'`), `les deux barres doivent être dessinées ensemble (${id})`);
  }
});

test('la tuile « Tous les pays » existe, et son dessin n’est pas un emoji', () => {
  const globe = entre('const GLOBE =', 'function barreDePays');
  assert.match(globe, /<svg/, 'la tuile de la vue complète porte un dessin');
  // ⚠ AUCUN EMOJI. Règle du projet (voir le CSS de `.drap`) : sous Windows, un
  // emoji drapeau s'affiche « FR » dans un carré. Le globe est dessiné, comme les
  // drapeaux le sont par le module partagé.
  assert.ok(!/[\u{1F000}-\u{1FAFF}]/u.test(globe), 'aucun emoji dans la barre, pas même pour le globe');
  assert.match(JS, /data-pays="" role="radio"/,
    'la tuile de la vue complète doit porter un pays VIDE : c’est ainsi que le filtre se désarme');
  assert.match(JS, /const dansPaysChoisi = \(x\) => !paysChoisiCartes \|\| \(x && x\.pays === paysChoisiCartes\)/,
    'et le filtre doit tenir en une ligne : vide = tous les pays');
});

/* -------------------------------------------------------------------------- *
 *  2. LE FILTRE EST BRANCHÉ SUR LES TABLEAUX — la « règle du tuyau ».
 *      Un filtre écrit mais non branché est un filtre qui n'existe pas.
 * -------------------------------------------------------------------------- */

test('le pays choisi entre dans la lecture des deux onglets', () => {
  // LES DEUX TABLEAUX DU CATALOGUE : entrées et refus. Une seule écriture pour
  // les deux, et l'épreuve compte : deux lectures, deux filtres.
  assert.equal((JS.match(/\(o\.lienPage \|\| o\.lienMarchand\) && dansPaysChoisi\(o\)/g) || []).length, 2,
    'les entrées ET les refus doivent lire le pays consulté');
  // LES DEUX TABLEAUX DU JOURNAL : effacées et bloquées, filtrés depuis les
  // listes complètes — les compteurs, eux, gardent les listes entières.
  assert.match(JS, /const bloquees = bloqueesToutes\.filter\(dansPaysChoisi\);/);
  assert.match(JS, /const effacees = effaceesToutes\.filter\(dansPaysChoisi\);/);
  assert.match(JS, /const revenues = \(e\.revenuesListe \|\| \[\]\)\.filter\(dansPaysChoisi\);/);
});

test('les compteurs qui décrivent tout le catalogue le DISENT', () => {
  // Les quatre blocs non découpables : les compteurs de la règle, les mécanismes
  // du passage, et les deux blocs de l'onglet des ajouts qui décrivent le passage.
  for (const appel of ["txt('mCartesCompteurs', avisTousPays() +",
    "txt('mCartesRetraits', avisTousPays() +",
    "txt('mAjoutsRetraits', avisTousPays() +",
    "txt('mAjoutsSources', avisTousPays() +"]) {
    assert.ok(JS.includes(appel), `le bloc doit dire qu’il décrit tout le catalogue : ${appel}`);
  }
  // Et les deux avis qui CHAPITENT un onglet filtré nomment le pays consulté,
  // sinon les chiffres filtrés se liraient comme des chiffres généraux.
  assert.ok(JS.includes("txt('avisCartes', avisPays() +"), 'l’avis de la vie des cartes doit nommer le pays');
  assert.ok(JS.includes("txt('avisRefusees', avisPays() +"), 'et celui des refus aussi');
  // LE RAPPEL LUI-MÊME SE TAIT QUAND AUCUN PAYS N'EST CHOISI : pas de bandeau
  // inutile sur la vue complète.
  const ctx = bac();
  assert.equal(vm.runInContext('avisPays() + avisTousPays()', ctx), '',
    'sans pays choisi, aucun rappel ne doit s’afficher');
  vm.runInContext("paysChoisiCartes = 'PT'", ctx);
  assert.match(vm.runInContext('avisPays()', ctx), /nom du pays/, 'avec un pays, il le nomme');
  assert.match(vm.runInContext('avisTousPays()', ctx), /Tous les pays/);
});

/* -------------------------------------------------------------------------- *
 *  3. LES COMPTES DE LA BARRE, SUR LE CATALOGUE ET LE JOURNAL RÉELS.
 * -------------------------------------------------------------------------- */

test('chaque tuile compte des fiches qui existent, et la somme est exacte', () => {
  const ctx = bac();
  const offres = catalogue().offres;

  const pays = vm.runInContext('paysDesFiches(__f)', Object.assign(ctx, { __f: offres }));
  const somme = pays.reduce((n, x) => n + x.n, 0);
  const avecPays = offres.filter((o) => o.pays).length;
  assert.equal(somme, avecPays,
    'la somme des tuiles doit être le nombre d’offres qui PORTENT un pays : une fiche sans pays '
    + 'n’est rattachée à aucun, et l’y compter serait l’inventer');
  // Le tri : du plus fourni au moins fourni. C'est ce qui met le pays le plus
  // vivant en tête — B n'a pas à le chercher.
  for (let i = 1; i < pays.length; i++) {
    assert.ok(pays[i - 1].n >= pays[i].n, 'les tuiles doivent aller du plus fourni au moins fourni');
    assert.ok(pays[i].pays, 'aucune tuile ne peut porter un pays vide');
  }

  // LE JOURNAL : ses tuiles comptent ce que le journal NOMME pour le pays
  // (bloquées + effacées publiées) — et pas autre chose.
  const s = journal();
  const nommees = [...(s.cartes.liste || []), ...((s.effacees || {}).liste || [])];
  const pj = vm.runInContext('paysDesFiches(__f)', Object.assign(ctx, { __f: nommees }));
  assert.equal(pj.reduce((n, x) => n + x.n, 0), nommees.filter((x) => x.pays).length,
    'les tuiles du journal somment ce qu’il nomme par pays');
  assert.ok(pj.every((x) => x.n <= nommees.length), 'aucune tuile ne peut dépasser le total');
});

test('un pays du catalogue sans carte au journal n’a pas de tuile dans SA barre', () => {
  const ctx = bac();
  const s = journal();
  const nommees = [...(s.cartes.liste || []), ...((s.effacees || {}).liste || [])];
  const avecCarte = new Set(nommees.map((x) => x.pays).filter(Boolean));
  const sansCarte = [...new Set(catalogue().offres.map((o) => o.pays))]
    .filter((p) => p && !avecCarte.has(p));
  const tuiles = vm.runInContext('paysDesFiches(__f)', Object.assign(ctx, { __f: nommees }))
    .map((x) => x.pays);
  for (const p of sansCarte) {
    assert.ok(!tuiles.includes(p),
      `${p} a des offres publiées mais aucune carte au journal : il ne peut pas porter de tuile `
      + 'dans la barre du journal (aucun compte à y mettre)');
  }
  // ET LE TABLEAU LE DIT, au lieu de laisser un vide qui se lirait comme une
  // absence de problème : les deux messages existent, et ils nomment le total.
  assert.match(JS, /Aucune carte effacée pour <b>\$\{esc\(nomDuPays\(paysChoisiCartes\)\)\}<\/b> dans le/,
    'un tableau d’effacements vide pour le pays doit le dire');
  assert.match(JS, /Aucune carte de <b>\$\{esc\(nomDuPays\(paysChoisiCartes\)\)\}<\/b> au-delà de cinq/,
    'et un tableau de blocages vide aussi');
  assert.match(JS, /Les <b>\$\{nb\(bloqueesToutes\.length\)\}<\/b> cartes bloquées, tous\s*\n?\s*pays, se lisent en choisissant/,
    'avec le total, pour que « rien pour ce pays » ne se confonde pas avec « rien du tout »');
});

test('les compteurs de la règle gardent les listes ENTIÈRES', () => {
  // Ce qui empêche le chiffre d'à côté d'être faux : les compteurs lisent les
  // listes complètes, pas les listes filtrées.
  assert.match(JS, /\[nb\(e\.retenues == null \? effaceesToutes\.length : e\.retenues\), 'effacements au registre \(30 j, tous pays\)'\],/,
    'le compte du registre porte sur tout le catalogue, et son libellé le dit');
  assert.match(JS, /e\.retenues > effaceesToutes\.length/,
    'l’extrait borné se compare au registre entier, jamais au pays filtré');
  assert.match(JS, /La plus ancienne a <b>[^<]*<\/b>\$\{paysChoisiCartes \? ' \(tous pays\)' : ''\}/,
    'et la carte la plus ancienne est celle de tout le catalogue : le dire, sinon elle a l’air d’être celle du pays');
});

/* -------------------------------------------------------------------------- *
 *  4. LE CLIC — et ce qu'il redessine.
 * -------------------------------------------------------------------------- */

test('cliquer une tuile redessine les deux barres et relit le journal', () => {
  const branche = entre('const surPaysCartes = (e) => {', 'const choixAff =');
  // La DÉLÉGATION : les tuiles sont redessinées à chaque clic (elles portent leur
  // compte), donc un écouteur posé sur une tuile disparaîtrait avec elle.
  assert.match(branche, /e\.target\.closest\('button\[data-pays\]'\)/,
    'l’écouteur doit être délégué : les tuiles n’existent pas encore quand on le pose');
  assert.match(branche, /paysChoisiCartes = tuile\.dataset\.pays \|\| '';/,
    'et un pays vide (« Tous les pays ») doit bien désarmer le filtre');
  for (const appel of ['localStorage.setItem', 'dessinerBarreCartes();', 'dessinerAjouts();', 'relireSuiviCartes();']) {
    assert.ok(branche.includes(appel), `le clic doit appeler ${appel}`);
  }
  // LES DEUX LISTES SONT BRANCHÉES : cliquer dans un onglet doit allumer la tuile
  // de l'autre.
  assert.match(branche, /for \(const id of \['paysCartesAjouts', 'paysCartesVie'\]\)/,
    'les DEUX barres doivent recevoir l’écouteur — sinon un onglet reste sourd');
  // ET LE JOURNAL EST RELU : ses tuiles comptent ce qu'il nomme, donc une barre
  // dessinée avant sa lecture annoncerait les pays du passage précédent.
  assert.match(JS, /dessinerBarreCartes\(\);\s*\n\s*dessinerCartes\(\);/,
    'la barre du journal se redessine APRÈS sa relecture');
  assert.match(JS, /cartes: \(\) => \{ dessinerBarreCartes\(\); relireSuiviCartes\(\); \}/,
    'et l’onglet se redessine en s’ouvrant, comme les autres onglets à choix de pays');
});
