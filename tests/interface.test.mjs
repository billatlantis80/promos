/**
 * Contrôles de l'interface — application n°2 « Promos ».
 *
 * Ces vérifications portent sur le TEXTE des fichiers, sans navigateur. Elles
 * existent à cause de deux défauts réels :
 *
 *   1. un commentaire CSS laissé ouvert (« /* … » sans « *​/ ») a avalé tout le
 *      bloc de la carte : fond, bordure, display:flex et le bouton favori sont
 *      devenus du commentaire. Aucune erreur nulle part — juste une app cassée.
 *   2. une fonction peut appeler un identifiant qui n'existe pas dans la page.
 *      Silencieux au chargement, fatal à l'exécution.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

/* Les libellés de l'interface passent par t() depuis l'interface multilingue du
 * 7/10. Le bac à sable ci-dessous doit donc fournir la VRAIE fonction : sans
 * elle, dessinerPuces lève « t is not defined » — exactement le défaut que ce
 * fichier existe pour attraper. On importe celle de public/langues.js plutôt
 * qu'une doublure, pour que les onglets soient dessinés avec les vrais
 * dictionnaires. */
import { t } from '../public/langues.js';
// Les noms de pays viennent du module partagé avec le panneau d'administration :
// le bac à sable des contrôles sur le pays doit employer LES VRAIS, sinon il
// vérifierait sa propre copie.
import { NOMS_PAYS } from '../public/drapeaux.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// Les drapeaux sont dans un module partagé avec le panneau d'administration :
// c'est là qu'on vérifie qu'aucun pays n'a un trou à la place de son drapeau.
const DRAP = fs.readFileSync(path.join(ICI, '..', 'public', 'drapeaux.js'), 'utf8');
const lire = (f) => fs.readFileSync(path.join(ICI, '..', 'public', f), 'utf8');

const css = lire('app.css');
// ⚠ LES RÈGLES D'AFFICHAGE VIVENT DANS LEUR MODULE depuis le 15/10/2026 (app.js
// les importe, et le panneau d'admin aussi). Ce fichier lit donc L'UNION — le
// module, `export` retirés, puis app.js — pour que les recherches de déclarations
// (`PAYS_BOUTIQUE`, `remiseCredible`, …) continuent de les trouver, et pour que
// les tranches propres à app.js (`choisirPays`, `lancer`, …) restent intactes.
// L'union EST le texte que cette épreuve lisait avant le déplacement : ce qui a
// changé, c'est qu'il n'existe plus deux copies des règles, capables de diverger.
const js = lire('regles-affichage.js').replace(/^export /gm, '') + '\n' + lire('app.js');
// La feuille de style est posée EN LIGNE dans index.html (voir bin/inliner-css.mjs,
// conséquence du défaut du 08/10/2026 : les .css externes étaient coupés sur le
// PC de B). On la retire AVANT de lire la structure : ses sélecteurs
// (`body[data-vue="grille"]`, `.logo`) et ses commentaires (le mot « étiquette »)
// ressemblent sinon aux éléments que ces contrôles cherchent, et le test
// accuserait du code juste. Le <style> du filet de secours, lui, reste en place.
const html = lire('index.html').replace(
  /<!-- DEBUT-FEUILLE-EN-LIGNE -->[\s\S]*?<!-- FIN-FEUILLE-EN-LIGNE -->/,
  '<!-- feuille en ligne retirée : ces contrôles portent sur la structure -->',
);

test('la feuille de style n’a aucun commentaire laissé ouvert', () => {
  const ouverts = (css.match(/\/\*/g) || []).length;
  const fermes = (css.match(/\*\//g) || []).length;
  assert.equal(
    ouverts, fermes,
    `${ouverts} commentaire(s) ouvert(s) pour ${fermes} fermé(s) : tout ce qui suit un « /* » sans « */ » est avalé`,
  );
});

test('la feuille de style ne perd aucun bloc de carte', () => {
  // Ancre prudente : « .offre { » apparaît AUSSI dans « body[data-vue=x] .offre { ».
  // On ne retient que la règle de base, seule en début de ligne — sinon la
  // tranche est vide et le test accuse du code juste (piège déjà payé ailleurs).
  const base = css.match(/^\.offre \{([\s\S]*?)^\}/m);
  assert.ok(base, 'la règle de base .offre doit exister');
  assert.match(base[1], /display:\s*flex/, 'la carte .offre doit rester un conteneur flex');
  assert.match(css, /^\.favori \{/m, 'le style du bouton favori doit être présent');
});

test('les deux icônes sont empilées et alignées sur le bouton de redirection', () => {
  // Demande de B (07/10/2026) : « il faut aligner l'icône favoris et en dessous
  // l'icône partager, les deux icônes doivent être alignées l'une au-dessus de
  // l'autre, et aligné avec le rectangle qui redirige vers le site où il y a la
  // promotion. L'affichage de la mise à jour doit être en dessous de ce cadran. »
  // L'étoile a d'abord flotté en haut à gauche du visuel (position:absolute), où
  // elle recouvrait la photo : ça ne doit jamais revenir.
  const favori = css.match(/^\.favori \{([\s\S]*?)^\}/m);
  assert.ok(favori, 'la règle .favori doit exister');
  assert.doesNotMatch(
    favori[1], /position:\s*absolute/,
    'l’étoile ne doit plus flotter au-dessus de la photo',
  );
  assert.match(
    favori[1], /flex:\s*0 0 auto/,
    'l’étoile ne doit pas se laisser comprimer',
  );

  // La colonne d'icônes : une VRAIE colonne, largeur fixe, icônes centrées sur
  // le même axe — c'est ce qui les met exactement l'une au-dessus de l'autre.
  const col = css.match(/^\.col-icones \{([\s\S]*?)^\}/m);
  assert.ok(col, 'la règle .col-icones doit exister');
  assert.match(col[1], /flex-direction:\s*column/, 'les deux icônes doivent être empilées');
  assert.match(col[1], /align-items:\s*center/, 'les deux icônes doivent partager le même axe');
  assert.match(col[1], /width:\s*34px/, 'la colonne garde une largeur fixe');

  // Le bas de carte aligne les deux colonnes par le HAUT. Sans align-items:
  // flex-start, la colonne d'icônes — plus haute que le bouton — se centrerait
  // et les icônes glisseraient par rapport au rectangle de redirection.
  assert.match(
    css, /\.offre \.bas \{[^}]*align-items:\s*flex-start/,
    'les icônes doivent être alignées sur le haut du rectangle de redirection',
  );
  assert.match(
    css, /\.offre \.bas \{[^}]*margin-top:\s*auto/,
    'le bas doit rester collé au pied d’une carte plus haute',
  );

  // Le contenu d'un <div class="…"> jusqu'à sa balise fermante APPARIÉE.
  // Un simple indexOf('</div>') s'arrêterait au premier div imbriqué — et un
  // simple « A avant B » dans le fichier ne dit rien de l'APPARTENANCE : la
  // contre-épreuve du 07/10/2026 a justement laissé passer une mise à jour
  // déplacée HORS du bloc. On compte donc les balises.
  const contenuDiv = (src, marqueur) => {
    const i = src.indexOf(marqueur);
    if (i < 0) return null;
    const debut = src.indexOf('>', i) + 1;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = debut;
    let prof = 1;
    let m;
    while ((m = re.exec(src))) {
      prof += m[0] === '</div>' ? -1 : 1;
      if (prof === 0) return src.slice(debut, m.index);
    }
    return null;
  };
  const dansIcones = contenuDiv(js, 'class="col-icones"');
  const dansEnvoi = contenuDiv(js, 'class="col-envoi"');
  assert.ok(dansIcones !== null, 'le bloc .col-icones doit se refermer');
  assert.ok(dansEnvoi !== null, 'le bloc .col-envoi doit se refermer');
  // Les icônes sont À DROITE du bouton — demande de B : « l'icône partage et
  // favoris doit être à droite ». Une inversion de l'ordre des colonnes remet
  // les icônes à gauche : c'est exactement ce qu'on ne veut plus.
  assert.ok(
    js.indexOf('class="col-envoi"') < js.indexOf('class="col-icones"'),
    'les deux icônes doivent être À DROITE du bouton de redirection',
  );
  assert.match(
    dansIcones, /\$\{etoile\}[\s\S]*class="partager"/,
    'l’étoile doit venir AVANT le partage dans la colonne d’icônes',
  );
  assert.ok(dansIcones.includes('${etoile}'),
    'l’étoile doit être DANS la colonne d’icônes, pas ailleurs');
  assert.match(
    dansIcones, /class="ligne-partage"/,
    'le partage doit rester dans un .ligne-partage : le menu s’y accroche',
  );
  assert.match(
    dansEnvoi, /class="btn"[\s\S]*class="quand"/,
    'la mise à jour doit être SOUS le rectangle de redirection',
  );
  assert.ok(dansEnvoi.includes('class="quand"'),
    'la mise à jour doit être DANS le bloc de redirection, sous le bouton');
  assert.ok(!dansIcones.includes('class="quand"'),
    'la mise à jour n’a rien à faire dans la colonne d’icônes');
  assert.doesNotMatch(
    js, /class="espace-fav"/,
    'l’ancien bandeau entre le prix et le bouton ne doit plus exister',
  );
  assert.doesNotMatch(
    js, /class="prix">[\s\S]{0,120}\$\{etoile\}/,
    'l’étoile ne doit plus être collée à la ligne du prix',
  );
  assert.doesNotMatch(
    js, /class="favori[^"]*enligne/,
    'la variante « enligne » n’a plus lieu d’être : l’étoile n’est plus dans la photo',
  );
  // La colonne d'icônes est au bord DROIT de la carte : le menu doit s'y ancrer
  // à droite pour s'ouvrir vers l'INTÉRIEUR. Ancré à gauche, il sortirait.
  const menu = css.match(/^\.menu-partage \{([\s\S]*?)^\}/m);
  assert.ok(menu, 'la règle .menu-partage doit exister');
  assert.match(menu[1], /right:\s*0/, 'le menu doit s’ouvrir vers la gauche, dans la carte');
  assert.doesNotMatch(menu[1], /left:\s*0/, 'ancré à gauche, il sortirait de la carte');
  // Le montant est groupé : sans ce groupe, le prix « avant » partirait à l'autre bout.
  assert.match(js, /class="montant"/, 'le montant doit être groupé dans un seul élément');
});

test('chaque élément lu par le script existe dans la page', () => {
  const idsPage = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  // Certains éléments sont CRÉÉS par le script (le bouton « afficher plus ») :
  // on les accepte aussi, sinon le contrôle crie au loup sur du code correct.
  const idsFabriques = new Set([...js.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  // ET DEPUIS LE 08/10/2026, CERTAINS IDENTIFIANTS SONT PASSÉS EN ARGUMENT. Les
  // quatre champs de mot de passe viennent désormais d'un seul gabarit
  // (`champMotDePasse('cMdp', …)`) qui écrit `id="${…}"` : l'identifiant
  // n'apparaît plus en clair dans la page fabriquée, et ce contrôle les
  // déclarait « absents ». On collecte donc, de façon GÉNÉRALE, le premier
  // argument de toute fonction qui fabrique un identifiant — pas seulement ce
  // gabarit-là : un contrôle qui ne connaît qu'un cas ne vaut que pour un cas.
  const idsPasses = new Set();
  for (const f of js.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g)) {
    if (!f[2].includes('id="${')) continue;
    for (const a of js.matchAll(new RegExp(`\\b${f[1]}\\('([A-Za-z0-9_-]+)'`, 'g'))) {
      idsPasses.add(a[1]);
    }
  }
  const idsScript = [...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
  const manquants = [...new Set(idsScript)]
    .filter((id) => !idsPage.has(id) && !idsFabriques.has(id) && !idsPasses.has(id));
  assert.deepEqual(manquants, [], `identifiants absents de index.html : ${manquants.join(', ')}`);
});

test('les modes d’affichage de la page correspondent à ceux du script', () => {
  const dansPage = [...html.matchAll(/data-vue="([^"]+)"/g)].map((m) => m[1]).sort();
  const dansScript = [...(js.match(/const VUES = \[([^\]]+)\]/) || [])[1]
    .matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(dansPage, dansScript, 'un bouton sans mode (ou un mode sans bouton) resterait sans effet');
});

test('la catégorie choisie reste allumée', () => {
  // Défaut vu à l'écran : les puces n'étaient construites qu'au démarrage. Cliquer
  // « Maison » filtrait bien la liste, mais « Tout » restait allumé — l'écran ne
  // disait plus ce qui était sélectionné. On verrouille le replacement du surlignage.
  assert.match(js, /function marquerPuce\(\)/, 'la fonction de surlignage doit exister');
  const debut = js.indexOf('function dessiner()');
  const fin = js.indexOf('function majOutils');
  assert.ok(debut >= 0 && fin > debut, 'les fonctions dessiner() et majOutils() doivent exister');
  assert.match(
    js.slice(debut, fin), /marquerPuce\(\)/,
    'dessiner() doit replacer le surlignage à chaque rendu',
  );
  // Le surlignage doit se fonder sur la catégorie courante, pas sur un état figé.
  assert.match(js, /el\.dataset\.cat === etat\.categorie/, 'la puce allumée doit être celle de la catégorie courante');
});

test('les visuels publiés sont aussi servis par le service local', () => {
  // Les visuels rapatriés vivent dans docs/img/ et les offres publiées les
  // référencent en chemin relatif. Le service local sert public/ : sans route
  // dédiée, chaque visuel répondait 404 et toutes les cartes restaient grises
  // en local — pendant que le site publié, lui, les affichait. Panne invisible
  // (aucune erreur), donc verrouillée ici.
  const srv = fs.readFileSync(path.join(ICI, '..', 'server.js'), 'utf8');
  assert.match(
    srv, /rel\.startsWith\('img\/'\)[\s\S]{0,120}DOCS/,
    'la route « img/ » doit servir les visuels depuis docs/, pas depuis public/',
  );
});

test('les visuels ne sont jamais demandés en économie de données', () => {
  // La règle qui compte : ce n'est pas le CSS qui doit cacher l'image, c'est le
  // script qui ne doit pas en émettre l'adresse — sinon elle est téléchargée.
  assert.match(js, /const source = \(!etat\.eco && o\.image\)/, 'la garde « !etat.eco » doit entourer l’adresse du visuel');
});

/* ---------------------------------------------------------------------------
 * Les compteurs d'onglets — mesurés sur le code RÉEL, pas sur sa forme.
 *
 * Défaut rapporté par l'utilisateur : en changeant de pays, les nombres des
 * onglets (« Tout », « Autres », « High-tech »…) ne bougeaient pas. Ils étaient
 * comptés sur la totalité des offres, tous pays confondus : « Tout » annonçait
 * 590 à quelqu'un qui n'en voyait que 32. La liste, elle, était bien filtrée —
 * seuls les nombres mentaient, ce qui est le pire des deux.
 *
 * On ne se contente donc pas de chercher une chaîne dans le fichier : on isole
 * les deux fonctions réelles et on les EXÉCUTE dans un bac à sable avec un faux
 * DOM, puis on lit les nombres produits. Un test qui ne regarde pas les nombres
 * ne prouverait rien.
 * ------------------------------------------------------------------------- */

/** Extrait une fonction du script, accolades équilibrées. */
function extraire(nom) {
  const debut = js.indexOf(`function ${nom}(`);
  assert.ok(debut >= 0, `la fonction ${nom}() doit exister dans app.js`);
  let profondeur = 0;
  for (let i = js.indexOf('{', debut); i < js.length; i++) {
    if (js[i] === '{') profondeur++;
    else if (js[i] === '}' && --profondeur === 0) return js.slice(debut, i + 1);
  }
  throw new Error(`accolades non équilibrées dans ${nom}()`);
}

/** Extrait une déclaration `const NOM = …;` du script (objet ou tableau). */
function blocConstant(nom) {
  const debut = js.indexOf(`const ${nom} = `);
  assert.ok(debut >= 0, `${nom} doit être déclaré dans app.js`);
  const debutObjet = js.indexOf('{', debut);
  const pointVirgule = js.indexOf(';', debut);
  if (debutObjet === -1 || debutObjet > pointVirgule) return js.slice(debut, pointVirgule + 1);
  let profondeur = 0;
  for (let i = debutObjet; i < js.length; i++) {
    if (js[i] === '{') profondeur++;
    else if (js[i] === '}' && --profondeur === 0) return js.slice(debut, js.indexOf(';', i) + 1);
  }
  throw new Error(`fin de la déclaration ${nom} introuvable`);
}

/** Monte un bac à sable contenant les vraies fonctions + un faux DOM.
 *  Les tables de l'application (NOMS_CATEGORIES, ORDRE_CATEGORIES) sont
 *  reprises DU FICHIER : un test qui redéfinirait sa propre liste à côté
 *  vérifierait sa copie, pas l'application. */
function bacAPuces() {
  const noeud = { innerHTML: '', querySelectorAll: () => [] };
  const ctx = vm.createContext({
    PAR_PAGE: 24,
    esc: (s) => String(s == null ? '' : s),
    $: () => noeud,
    marquerPuce() {},
    dessiner() {},
    t,
  });
  vm.runInContext([
    blocConstant('NOMS_CATEGORIES'),
    blocConstant('ORDRE_CATEGORIES'),
    // Le compte par pays passe par paysDe : sans cette table, le bac à sable
    // levait « paysDe is not defined » et quatre contrôles tombaient.
    blocConstant('PAYS_BOUTIQUE'),
    extraire('paysDe'),
    extraire('rangCategorie'),
    extraire('offresDuPays'),
    extraire('dessinerPuces'),
  ].join('\n'), ctx);
  return { ctx, lire: () => noeud.innerHTML };
}

/** Les nombres portés par chaque onglet, sous la forme { catégorie: nombre }. */
function nombres(htmlPuces) {
  const out = {};
  for (const m of htmlPuces.matchAll(/data-cat="([^"]+)"[^>]*>[^<]*<span class="n">(\d+)</g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

const OFFRES_ESSAI = [
  { categorie: 'tech', pays: 'FR' }, { categorie: 'tech', pays: 'FR' },
  { categorie: 'autre', pays: 'FR' }, { categorie: 'bricolage', pays: 'FR' },
  { categorie: 'tech', pays: 'BE' }, { categorie: 'bricolage', pays: 'BE' },
];

/** Les rubriques, dans l'ordre de l'application — relues DU FICHIER. */
const CATS = [...blocConstant('ORDRE_CATEGORIES').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

/** Complète un attendu avec les rubriques à 0.
 *  Depuis la demande de B, la barre affiche TOUTES les rubriques dans TOUS les
 *  pays : un attendu partiel ne décrit plus ce que l'écran montre. */
function complet(partiel) {
  return Object.fromEntries(['tout', ...CATS].map((c) => [c, partiel[c] || 0]));
}

test('les nombres des onglets comptent le pays choisi, pas le catalogue entier', () => {
  const { ctx, lire } = bacAPuces();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'tout', categorie: 'tout' };

  ctx.dessinerPuces();
  assert.deepEqual(
    nombres(lire()),
    complet({ tout: 6, tech: 3, bricolage: 2, autre: 1 }),
    'tous pays : les nombres doivent couvrir les 6 offres',
  );

  ctx.etat.pays = 'BE';               // le geste exact de l'utilisateur
  ctx.dessinerPuces();
  assert.deepEqual(
    nombres(lire()),
    complet({ tout: 2, tech: 1, bricolage: 1 }),
    'Belgique : « Tout » doit annoncer 2, pas 6',
  );

  ctx.etat.pays = 'FR';
  ctx.dessinerPuces();
  assert.deepEqual(
    nombres(lire()),
    complet({ tout: 4, tech: 2, bricolage: 1, autre: 1 }),
    'France : les nombres doivent revenir aux offres françaises',
  );
});

test('TOUTES les rubriques gardent leur onglet, même à 0 dans le pays', () => {
  // Demande de B : l'onglet alimentaire existait en « Tous les pays » (69 offres)
  // mais DISPARAISSAIT en Belgique, où aucune offre du rayon ne passe le seuil de
  // « bonne promo ». Il l'a cherché à côté de « Mode » et « Maison » et ne l'a pas
  // trouvé — sans aucun message, puisque l'onglet n'était pas dessiné.
  const { ctx, lire } = bacAPuces();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'BE', categorie: 'tout' };
  ctx.dessinerPuces();
  const n = nombres(lire());
  for (const c of CATS) {
    assert.ok(c in n, `« ${c} » doit avoir son onglet, même sans offre en Belgique`);
  }
  assert.equal(n.nourriture, 0, 'et son compteur doit dire la vérité : 0');
  assert.equal(n.tech, 1, 'les rubriques fournies gardent leur vrai compte');
});

test('l’onglet « Autres » ferme toujours la marche', () => {
  const { ctx, lire } = bacAPuces();
  // « Autres » est ici la catégorie la PLUS fournie : sans la règle, le tri par
  // nombre décroissant la mettrait en tête. Des données où elle tombe déjà
  // dernière ne prouveraient rien — c'était le cas du premier jet de ce test.
  ctx.etat = {
    offres: [
      { categorie: 'autre', pays: 'FR' }, { categorie: 'autre', pays: 'FR' },
      { categorie: 'autre', pays: 'FR' }, { categorie: 'autre', pays: 'FR' },
      { categorie: 'tech', pays: 'FR' }, { categorie: 'bricolage', pays: 'FR' },
    ],
    pays: 'tout', categorie: 'tout',
  };
  ctx.dessinerPuces();
  const ordre = [...lire().matchAll(/data-cat="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ordre[0], 'tout', '« Tout » ouvre la liste');
  assert.equal(
    ordre[ordre.length - 1], 'autre',
    `« Autres » doit rester le dernier onglet même quand c’est le plus gros, or l’ordre est ${ordre.join(' > ')}`,
  );
});

test('l’ordre des onglets est le MÊME dans tous les pays', () => {
  // Défaut rapporté : « les onglets high-tech, maison changent de place en
  // fonction de certains pays ». L'ordre était calculé par nombre d'offres
  // décroissant — il suivait donc les données de chaque pays. Ici la Belgique a
  // BEAUCOUP plus d'offres « Maison » que « High-tech » : avec l'ancien tri,
  // Maison passait devant. Elle doit maintenant en être incapable.
  const offres = [
    ...Array.from({ length: 6 }, () => ({ categorie: 'tech', pays: 'FR' })),
    ...Array.from({ length: 2 }, () => ({ categorie: 'maison', pays: 'FR' })),
    ...Array.from({ length: 1 }, () => ({ categorie: 'mode', pays: 'FR' })),
    ...Array.from({ length: 1 }, () => ({ categorie: 'autre', pays: 'FR' })),
    ...Array.from({ length: 9 }, () => ({ categorie: 'maison', pays: 'BE' })),
    ...Array.from({ length: 3 }, () => ({ categorie: 'tech', pays: 'BE' })),
    ...Array.from({ length: 5 }, () => ({ categorie: 'autre', pays: 'BE' })),
  ];
  const { ctx, lire } = bacAPuces();
  const onglets = (pays) => {
    ctx.etat = { offres, pays, categorie: 'tout' };
    ctx.dessinerPuces();
    return [...lire().matchAll(/data-cat="([^"]+)"/g)].map((m) => m[1]).filter((c) => c !== 'tout');
  };

  // L'ordre de référence, écrit À LA MAIN dans l'application.
  const fr = onglets('FR');
  const be = onglets('BE');
  // Depuis la demande de B, la barre liste TOUTES les rubriques dans TOUS les
  // pays : les deux listes doivent donc être identiques, et égales à l'ordre
  // déclaré — plus aucune rubrique ne s'évapore en changeant de pays.
  assert.deepEqual(fr, CATS, `France : ${fr.join(' > ')}`);
  assert.deepEqual(be, CATS, `Belgique : ${be.join(' > ')}`);
  assert.deepEqual(be, fr, 'la barre doit être identique d’un pays à l’autre');
  assert.ok(fr.indexOf('tech') < fr.indexOf('maison'), 'High-tech avant Maison');
  assert.equal(be.indexOf('tech'), fr.indexOf('tech'),
    'la position de High-tech ne doit pas bouger d’un pays à l’autre');
  assert.equal(CATS[CATS.length - 1], 'autre', '« Autres » ferme la marche');
});

test('une catégorie non prévue se range juste avant « Autres », jamais après', () => {
  // Le collecteur peut produire une catégorie que l'interface ne connaît pas
  // encore. Elle ne doit pas venir en tête (invisible et surprenante) ni APRÈS
  // « Autres » — sinon « Autres » ne serait plus le dernier onglet, ce qui a
  // déjà été demandé et tranché.
  const { ctx } = bacAPuces();
  const rangs = {
    tech: ctx.rangCategorie('tech'),
    beaute: ctx.rangCategorie('beaute'),
    autre: ctx.rangCategorie('autre'),
    inconnue: ctx.rangCategorie('categorie-jamais-vue'),
  };
  assert.ok(rangs.tech < rangs.beaute, 'l’ordre de référence doit être respecté');
  assert.ok(rangs.beaute < rangs.inconnue, 'une inconnue ne se glisse pas avant les connues');
  assert.ok(rangs.inconnue < rangs.autre, 'une inconnue reste AVANT « Autres », jamais après');
});

test('changer de pays replace aussi le surlignage et les onglets', () => {
  // Un SEUL chemin de changement de pays reste : choisirPays(), appelé par la
  // question d'ouverture, par les réglages ET par le panneau de la barre du haut.
  // Il doit redessiner les onglets : un chemin qui les oublierait laisserait
  // l'écran mentir (le 11/10/2026, le menu déroulant de la barre en était un
  // second — il a disparu au profit du panneau partagé).
  const choisir = js.slice(js.indexOf('function choisirPays('), js.indexOf('function dessinerChoixPays('));
  assert.match(choisir, /dessinerPuces\(\)/, 'choisirPays() doit redessiner les onglets');
  assert.match(js, /\$\('pays'\)\.addEventListener\('click', ouvrirChoixPays\)/,
    'le bouton de pays de la barre doit ouvrir le panneau partagé');
  const panneau = js.slice(js.indexOf('function dessinerChoixPays('), js.indexOf('function ouvrirChoixPays('));
  assert.match(panneau, /choisirPays\(b\.dataset\.pays\)/,
    'un pays touché dans le panneau doit passer par le chemin unique');
});

/** Monte un bac à sable contenant les vraies fonctions du pays + un faux DOM.
 *  `htmlListePays` est remplacée : le sujet de ces contrôles est la RÉPARATION
 *  d'un pays inconnu, pas le dessin de la liste (qui a ses propres épreuves). */
function bacAPays() {
  // Le bouton de la barre n'a plus de `value` : il porte un DESSIN (drapeau) et
  // un nom en HTML. Le faux nœud n'expose donc que ce qui est vraiment lu.
  const noeud = { innerHTML: '', dataset: {}, querySelectorAll: () => [] };
  const ecrits = [];
  const ctx = vm.createContext({
    PAR_PAGE: 24,
    esc: (s) => String(s == null ? '' : s),
    NOMS_PAYS,
    DRAPEAUX_PAYS: {},
    locale: () => 'fr-FR',
    t,
    $: () => noeud,
    htmlListePays: () => '',
    enregistrerPays: () => ecrits.push(true),
  });
  vm.runInContext([
    blocConstant('PAYS_BOUTIQUE'),
    // La flèche de choix du bouton de pays : c'est un DESSIN partagé, déclaré
    // dans une constante à part (B, 12/10/2026 : « il faut rajouter une petite
    // flèche de choix comme bonne promotion à droite »). Sans elle, libellePays()
    // lève « FLECHE_CHOIX is not defined » dans le bac à sable.
    blocConstant('FLECHE_CHOIX'),
    extraire('paysDe'),
    extraire('compteParPays'),
    extraire('codesPays'),
    extraire('libellePays'),
    extraire('dessinerPays'),
  ].join('\n'), ctx);
  return { ctx, noeud, ecrits };
}

test('un pays mémorisé que le catalogue ne connaît plus est réparé ET écrit', () => {
  // Défaut mesuré le 10/10/2026 : un code mémorisé absent du catalogue (un
  // ancien code, un pays retiré) laissait le filtre sur une valeur inconnue
  // pendant que le sélecteur affichait « Tous les pays » — l'écran montrait donc
  // « Tous les pays » avec des compteurs de rubriques à ZÉRO, à chaque
  // ouverture, indéfiniment. La réparation existait, mais elle n'était jamais
  // ÉCRITE : la valeur fautive survivait au chargement suivant.
  const { ctx, noeud, ecrits } = bacAPays();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'be' };   // code inconnu du catalogue
  ctx.dessinerPays();
  assert.equal(ctx.etat.pays, 'tout', 'un pays inconnu doit retomber sur « tous les pays »');
  assert.equal(ecrits.length, 1, 'la réparation doit être ENREGISTRÉE, sinon elle se répète à chaque ouverture');
});

test('le bouton de pays montre le pays appliqué, son drapeau et son nombre', () => {
  // Le menu déroulant de la barre a été remplacé par un bouton (demande de B,
  // 11/10/2026 : « il faut introduire les drapeaux des pays »). Ce que le bouton
  // doit dire, et rien d'autre : quel pays est appliqué (avec son drapeau), et
  // COMBIEN d'offres ce pays apporte — le même chiffre que la liste des pays.
  // Le bac à sable partage un seul faux nœud pour tous les identifiants : on
  // appelle donc la fabrique de libellé directement, plutôt que de lire un
  // `innerHTML` que le dernier dessin a écrasé (défaut payé à la première
  // exécution de ce contrôle).
  const { ctx } = bacAPays();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'BE' };
  const tout = ctx.libellePays('tout');
  assert.match(tout, /Tous les pays/, '« tous les pays » doit être nommé');
  assert.match(tout, /class="drap"/, 'et porter un drapeau dessiné');
  assert.match(tout, /<span class="n">6</, 'et le nombre d’offres de tous les pays (6 dans le jeu d’essai)');
  const belgique = ctx.libellePays('BE');
  assert.match(belgique, /Belgique/, 'le pays appliqué doit être nommé');
  assert.match(belgique, /<span class="n">2</, 'avec SON nombre d’offres (2 dans le jeu d’essai)');
  // ET LA FLÈCHE DE CHOIX, À DROITE : le repère qui dit qu'on peut en changer.
  // B, 12/10/2026 : « il faut rajouter une petite flèche de choix comme bonne
  // promotion à droite. La petite flèche, l'équivalent d'un curseur qui informe
  // qu'il y a un choix multiple possible. »
  assert.match(tout, /class="fleche-choix"[\s\S]*<\/span>$/, 'le bouton doit porter la flèche de choix, et en DERNIER');
  assert.match(belgique, /class="fleche-choix"/, 'elle doit être là pour un pays aussi');
});

test('un pays mémorisé VALIDE n’est ni changé ni réécrit', () => {
  const { ctx, ecrits } = bacAPays();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'BE' };
  ctx.dessinerPays();
  assert.equal(ctx.etat.pays, 'BE', 'un pays valide doit être conservé');
  assert.equal(ecrits.length, 0, 'on n’écrit rien quand il n’y a rien à réparer');
});

test('le pays est réparé AVANT que les compteurs ne soient dessinés', () => {
  // L'ordre des appels est le fond du défaut : `dessinerPays` répare au passage
  // la valeur inconnue, et les compteurs étaient dessinés juste avant — donc
  // calculés sur la valeur fautive, affichés à zéro. Ici on lit l'ordre dans
  // lancer(), le seul endroit qui les enchaîne.
  // ⚠ BORNE RE-POINTÉE ET PROTÉGÉE LE 11/10/2026 : `demarrer()` n'existe plus
  // (elle s'appelait ainsi quand un écran de verrouillage pouvait retenir
  // l'ouverture ; elle s'appelle `lancerAuDemarrage()` depuis que le compte local
  // est parti). `indexOf` rendait -1, et `slice(debut, -1)` avalait la fin du
  // fichier — la tranche n'était plus « lancer() » mais presque tout app.js, et
  // le contrôle ne voulait plus rien dire sans échouer.
  const lancer = js.slice(js.indexOf('async function lancer()'), js.indexOf('function lancerAuDemarrage()'));
  assert.ok(lancer.length > 100 && lancer.length < 20000,
    `découpage de lancer() invalide (${lancer.length} caractères) — la borne a bougé`);
  assert.ok(lancer.length > 500, `découpage de lancer() invalide (${lancer.length} caractères)`);
  const iPays = lancer.indexOf('dessinerPays()');
  const iPuces = lancer.indexOf('dessinerPuces()');
  assert.ok(iPays >= 0 && iPuces >= 0, 'lancer() doit dessiner le pays et les compteurs');
  assert.ok(iPays < iPuces, `les compteurs doivent être comptés APRÈS la réparation du pays (positions ${iPays} / ${iPuces})`);
});

test('une catégorie que l’interface ne connaît pas retombe sur « Tout »', () => {
  // Ce repli ne sert plus aux rubriques connues : depuis la demande de B, elles
  // ont TOUTES un onglet dans tous les pays, même à 0. Il protège de la seule
  // catégorie qui n'aurait pas de puce — une rubrique produite par le collecteur
  // sans avoir été déclarée dans NOMS_CATEGORIES. Sélectionnée, elle laisserait
  // l'écran filtré sur un onglet invisible : vide, et sans raison affichée.
  const { ctx } = bacAPuces();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'BE', categorie: 'rayon-jamais-vu' };
  ctx.dessinerPuces();
  assert.equal(ctx.etat.categorie, 'tout', 'un filtre sans onglet doit retomber sur « Tout »');
});

test('la question d’ouverture propose « tous les pays » EN PREMIER', () => {
  // Le dessin des deux listes est PARTAGÉ (htmlListePays) depuis le 08/10/2026 :
  // la question d'ouverture ne fabrique plus sa liste. L'ordre se vérifie donc
  // dans le module commun — et le fait qu'elle l'affiche bien, sans le refaire.
  const debut = js.indexOf('function htmlListePays(');
  assert.ok(debut > 0, 'htmlListePays() introuvable : les deux écrans doivent passer par lui');
  const module = js.slice(debut, js.indexOf('function dessinerPays()', debut));
  assert.ok(module.length > 200, `découpage du module invalide (${module.length} caractères)`);
  const iTout = module.indexOf("item('tout'");
  const iBoucle = module.indexOf('codesPays().map(');
  assert.ok(iTout >= 0, 'la liste doit proposer « tous les pays »');
  assert.ok(iBoucle > iTout, `« Tous les pays » doit précéder la liste des pays (positions ${iTout} / ${iBoucle})`);
  const question = js.slice(js.indexOf('function demanderPays('), js.indexOf('function enregistrerPays('));
  // CE QUI A CHANGÉ LE 11/10/2026 (demande de B : « Quand un utilisateur arrive
  // sur le site internet via chrome ou edge, il doit arriver sur le pays de son
  // origine. Pas dans tous les pays. ») : la question n'est plus posée d'office,
  // et elle ne marque donc plus de pays « conseille ». Le pays deviné EST le pays
  // affiché (voir appliquerPaysDOrigine, et tests/pays-origine.test.mjs pour la
  // détection elle-même). Ce que ce contrôle-ci protège : quand la question est
  // posée, elle passe bien par le module PARTAGÉ, sans redessiner sa liste.
  assert.match(question, /htmlListePays\(\{/,
    'la question d’ouverture doit appeler le module partagé, pas redessiner sa liste');
  // L'ancien lien, relégué sous la liste, ne doit pas survivre en double.
  assert.doesNotMatch(html, /paysPasser/, 'l’ancien lien du bas de liste doit avoir disparu de la page');
  assert.doesNotMatch(js, /paysPasser/, 'son écouteur doit avoir disparu du script');
});

test('l’onglet « Activité » existe, au même niveau que les autres rubriques', () => {
  // Demande explicite : « Tu peux créer une catégorie spa, centre de beauté,
  // restaurant, zoo, montgolfière, tu peux l'appeler activité, à mettre à la
  // même hauteur que les onglets high-tech, mode et autres. » Un onglet à part
  // entière, donc — pas un sous-filtre, pas un repli dans « Autres ».
  const noms = blocConstant('NOMS_CATEGORIES');
  const ordre = blocConstant('ORDRE_CATEGORIES');
  assert.match(noms, /activite:\s*'Activité'/, 'l’onglet doit s’appeler « Activité »');
  const iAct = ordre.indexOf("'activite'");
  const iAutre = ordre.indexOf("'autre'");
  assert.ok(iAct > 0, '« Activité » doit figurer dans l’ordre des onglets, et pas en tête');
  assert.ok(iAct < iAutre, `« Activité » précède « Autres » (positions ${iAct} / ${iAutre})`);
  // Une rubrique de PREMIER niveau : son rang doit être un VRAI rang, et non
  // celui du repli « juste avant Autres » servi aux catégories inconnues de
  // l'interface. C'est la différence entre un onglet et une catégorie subie.
  const { ctx } = bacAPuces();
  const rang = ctx.rangCategorie('activite');
  const rangInconnue = ctx.rangCategorie('categorie-jamais-vue');
  assert.ok(rang >= 0, `« Activité » doit être connue de l’interface (rang ${rang})`);
  assert.ok(rang < rangInconnue, `« Activité » (rang ${rang}) doit passer avant une catégorie inconnue (rang ${rangInconnue})`);
});

test('le logo est SON image, en pixels — en-tête, onglet et pages de partage', () => {
  // ⚠ TEST RETOURNÉ LE 11/10/2026. B : « La qualité de la lettre k, ne
  // correspond pas à l'image que je t'ai donné. » Le tracé du 07/10
  // (outils/logo-vectorise.py) ne représentait pas son dessin : rubans minces,
  // bords ondulés, fausse découpe blanche entre l'orange et le bleu. Rendu côte
  // à côte à la même taille, l'écart est visible à l'œil — ce n'était donc pas
  // une question de goût. Le site porte désormais SES PIXELS, embarqués dans
  // favicon.svg : le même fichier pour l'en-tête, l'onglet et les pages de
  // partage, donc aucune divergence possible entre les trois.
  // Ce que ce test protège maintenant :
  //   1. l'en-tête montre une IMAGE, plus un tracé ;
  //   2. les octets SERVIS sont exactement ceux livrés dans identite/ — la seule
  //      façon de garantir qu'aucun outil n'a « amélioré » son dessin ;
  //   3. le rapport de sa pastille est conservé (plus haute que large) et la
  //      boîte carrée de l'en-tête ne l'écrase pas (object-fit: contain).
  const bloc = html.match(/<img class="logo"[^>]*>/);
  assert.ok(bloc, "l'icône de l'en-tête doit être une image (img.logo)");
  assert.match(bloc[0], /src="favicon\.svg"/, "l'en-tête doit montrer favicon.svg");
  assert.match(bloc[0], /width="\d+" height="\d+"/,
    "l'image doit porter ses dimensions en attribut (sinon, sans feuille de style, "
    + "elle prend toute la largeur : le « K géant » du 08/10/2026)");
  assert.ok(!html.includes('<svg class="logo"'),
    'le tracé du 07/10 ne doit plus être dans la page');

  const svg = lire('favicon.svg');
  const dedans = svg.match(/href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(dedans, 'favicon.svg doit EMBARQUER le dessin (image/png;base64)');
  const servis = Buffer.from(dedans[1], 'base64');
  // 256 px : couvre l'en-tête (42 px affichés x 3 sur un écran dense = 126)
  // avec de la marge, sans alourdir le fichier que toutes les pages téléchargent.
  const livres = fs.readFileSync(path.join(ICI, '..', 'identite', 'kazendra-icone-256.png'));
  assert.ok(servis.equals(livres),
    'les octets servis par le site doivent être EXACTEMENT ceux livrés dans identite/');
  assert.equal(servis.subarray(0, 8).toString('hex'), '89504e470d0a1a0a',
    'l’image embarquée doit être un PNG');
  const largeur = servis.readUInt32BE(16);
  const hauteur = servis.readUInt32BE(20);
  assert.ok(largeur < hauteur,
    `sa pastille est plus HAUTE que large (${largeur} x ${hauteur}) : le rapport de son dessin est conservé, `
    + 'là où le tracé la faisait plus étroite qu’elle n’est');

  // Les pages de partage et de rubrique affichent le même fichier : sans cela,
  // une offre partagée porterait un autre logo que le site.
  for (const outil of ['outils/pages-partage.mjs', 'outils/pages-rubriques.mjs']) {
    const s = fs.readFileSync(path.join(ICI, '..', outil), 'utf8');
    assert.match(s, /<img src="\/favicon\.svg"/, `${outil} doit afficher favicon.svg`);
  }
  // Et la boîte de l'en-tête ne doit pas déformer son dessin.
  const logo = css.match(/\.logo\s*\{([^}]*)\}/);
  assert.ok(logo, 'app.css doit définir .logo');
  assert.match(logo[1], /object-fit:\s*contain/,
    'sans object-fit: contain, son image est ÉTIRÉE dans la boîte carrée de l’en-tête');
});

test('la phrase d’accroche est sur la page, dans les 9 langues', () => {
  // B l'avait fait retirer le 7/10 (« ne doit pas être écrite sur la page »),
  // puis l'a fait REMETTRE le même jour : « tu peux laisser la phrase d'accroche
  // sur le site internet, les meilleures promotions ». Elle est donc affichée,
  // sous le nom — exactement comme sur le logotype qu'il a fourni.
  assert.match(
    html,
    /<span class="accroche" data-i18n="Les meilleures promotions">Les meilleures promotions<\/span>/,
    'l’accroche doit être affichée et portée par le mécanisme de traduction',
  );
  assert.match(css, /\.accroche\s*\{/, 'son style doit exister');
  const langues = lire('langues.js');
  const cles = langues.match(/'Les meilleures promotions':/g) || [];
  assert.equal(cles.length, 9,
    `la phrase doit être traduite dans les 9 dictionnaires, or ${cles.length} la portent`);
  for (const mot of ['Les meilleures promotions', 'De beste aanbiedingen',
                     'Die besten Angebote', 'The best deals',
                     'Las mejores ofertas', 'Le migliori offerte',
                     'As melhores promoções', 'Najlepsze okazje',
                     'De bästa erbjudandena']) {
    assert.ok(langues.includes(`'${mot}'`), `traduction manquante : ${mot}`);
  }
  // L'ancienne phrase, plus longue, reste disponible pour la campagne : la
  // jeter obligerait à la retrouver dans les 9 langues le jour de la publicité.
  const pub = langues.match(/'Découvrez les meilleures promotions':/g) || [];
  assert.equal(pub.length, 9,
    `la phrase de publicité doit rester traduite, or ${pub.length} la portent`);
});

test('les réglages tiennent en TROIS onglets : langue fusionnée dans le compte', () => {
  // B a d'abord demandé de regrouper thèmes et affichage, puis a rectifié
  // (08/10/2026) : « On va plutôt appeler l'onglet thème et affichage, on va
  // mettre les thèmes en premier, le choix de l'encadrement en deuxième […]
  // Cette dernière partie doit se trouver à la fin ». Trois choses peuvent
  // casser séparément : le NOMBRE d'onglets, leur ORDRE, et l'ordre INTERNE.
  //
  // PUIS, LE 11/10/2026 : « Dans les paramètres, il faut fusionner l'onglet
  // profil et langue. […] Langue en dessous. » Quatre onglets deviennent trois :
  // la langue est la dernière rubrique de l'onglet Compte. Ce test gardait la
  // décision précédente — il garde la nouvelle.
  const onglets = [...html.matchAll(/data-onglet="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(onglets, ['compte', 'affichage', 'infos'],
    `onglets attendus dans cet ordre, trouvé « ${onglets.join(', ')} »`);
  const panneaux = [...html.matchAll(/data-panneau="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(panneaux, onglets,
    'chaque onglet doit avoir son panneau, dans le même ordre');
  assert.ok(!html.includes('data-panneau="themes"'),
    'le panneau « themes » doit avoir disparu : il est fusionné');
  assert.ok(!html.includes('data-panneau="langue"'),
    'le panneau « langue » doit avoir disparu : la langue est une rubrique de Compte');
  // L'ordre INTERNE, dans l'ordre demandé : les thèmes d'abord, le pays EN DERNIER.
  const debut = html.indexOf('data-panneau="affichage"');
  const bloc = html.slice(debut, html.indexOf('data-panneau="infos"', debut));
  const iPays = bloc.indexOf('id="regPays"');
  const iThem = bloc.indexOf('id="themes"');
  assert.ok(iThem > 0, 'le bloc des thèmes doit être dans le compartiment fusionné');
  assert.ok(iPays > iThem, 'le pays doit venir EN DERNIER, après les thèmes');
  // LA RUBRIQUE « AFFICHAGE » A DISPARU (B, 12/10/2026 : « la rubrique affichage,
  // les mêmes réglages que la barre du haut réunit ici, peut disparaître
  // définitivement, car ça n'a pas d'utilité »). Elle recopiait les trois modes
  // d'affichage et le bouton Éco, qui vivent dans la barre du haut : un seul
  // endroit par réglage. Ce test refuse son retour.
  assert.ok(!bloc.includes('id="regAffichage"'),
    'plus de point de rendu #regAffichage dans les Réglages');
  assert.ok(!bloc.includes('data-eco-miroir'),
    'plus de bouton Éco en double dans les Réglages');
  // Le libellé de l'onglet, exactement celui demandé.
  // Le NOM DE L'ONGLET a été accordé par B le 12/10/2026 : « oui tu peux renommer
  // thème et pays ». Il ne contenait plus que les thèmes et le pays.
  assert.match(html, /data-i18n="Thème et pays">Thème et pays</,
    'l’onglet doit s’appeler « Thème et pays »');
  assert.ok(!html.includes('data-i18n="Thème et affichage"'),
    'l’ancien nom d’onglet ne doit plus traîner nulle part');
  assert.ok(!html.includes('Affichage et thèmes'),
    'l’ancien libellé ne doit plus traîner nulle part');
});

test('les neuf langues s’affichent en liste, avec leur drapeau', () => {
  // Demande de B : « tu peux utiliser plus de place dans l'onglet en mettant les
  // drapeaux des pays avec la langue à côté » et « Pas besoin de menu déroulant.
  // Il y a suffisamment de place. »
  const langues = lire('langues.js');
  const codes = [...langues.matchAll(/\{ code: '([a-z]{2})', nom:/g)].map((m) => m[1]);
  assert.equal(codes.length, 9, `neuf langues attendues, trouvé ${codes.length}`);
  for (const c of codes) {
    // Chaque drapeau est un DESSIN. Un drapeau manquant laisserait un trou dans
    // la liste — visible à l'œil, invisible dans les tests s'ils ne le disent pas.
    assert.match(DRAP, new RegExp(`^  ${c}: '<rect`, 'm'),
      `le drapeau « ${c} » doit être dessiné dans drapeaux.js`);
  }
  assert.doesNotMatch(js, /langueReglages/,
    'plus de menu déroulant pour la langue : les neuf doivent être visibles');
  assert.match(js, /class="langues" role="radiogroup"/,
    'la liste des langues doit exister');
  // Le libellé du nouveau compartiment fusionné doit être traduit partout.
  const cles = langues.match(/'Thème et pays':/g) || [];
  assert.equal(cles.length, 9,
    `« Thème et pays » doit être traduit dans les 9 langues, or ${cles.length}`);
  assert.ok(!langues.includes("'Affichage et thèmes':"),
    'l’ancien libellé ne doit pas rester dans les dictionnaires : deux clés pour '
    + 'le même onglet, et plus personne ne sait laquelle fait foi');
  // Les clés du parcours d'inscription RÉELLEMENT affiché. La liste contenait
  // « Se connecter », « Créer un compte », « Ton adresse e-mail », « Déjà
  // inscrit ? Connecte-toi » et « Nouveau ici ? Inscris-toi » : cinq clés que
  // l'interface n'appelait plus depuis la refonte de l'encadré d'inscription
  // (un seul encadré, « Créer mon compte », pas de bascule inscription/
  // connexion). Le test vérifiait la présence au dictionnaire, jamais l'usage —
  // il protégeait donc du vide. Remplacées le 08/10/2026 par les libellés que
  // l'écran porte vraiment.
  for (const mot of ['Adresse e-mail', "S'inscrire", 'Se désinscrire',
                     'Inscription aux bons plans', 'Choisis la langue de l’interface']) {
    // LES DEUX DÉLIMITEURS SONT ACCEPTÉS. Le dictionnaire écrit une clé entre
    // apostrophes, et entre GUILLEMETS dès qu'elle contient une apostrophe
    // (« S'inscrire ») — chercher la seule forme entre apostrophes annonçait 0
    // langue sur une clé parfaitement présente. C'est le faux négatif relevé
    // dans le piège du ménage des traductions.
    const motif = new RegExp(`^\\s*(['"])${mot.replace(/[.?']/g, '\\$&')}\\1:`, 'gm');
    const n = (langues.match(motif) || []).length;
    assert.equal(n, 9, `« ${mot} » doit être traduit dans les 9 langues, or ${n}`);
  }
  // « Créer mon compte » et « Répète le mot de passe » ne sont plus dans les
  // dictionnaires : ce sont les deux libellés que B a fait disparaître le
  // 11/10/2026 (« Le bouton créer mon compte doit s'adapter en disant
  // s'inscrire », et il n'y a plus de mot de passe du tout).
  for (const parti of ['Créer mon compte', 'Répète le mot de passe']) {
    const motif = new RegExp(`^\\s*(['"])${parti}\\1:`, 'gm');
    assert.equal((langues.match(motif) || []).length, 0,
      `« ${parti} » doit avoir quitté les neuf dictionnaires`);
  }});

test('le pays se choisit dans une liste, pas dans un menu déroulant', () => {
  assert.doesNotMatch(js, /paysReglages/,
    'plus de menu déroulant pour le pays dans les réglages');
  assert.match(js, /class="pays-liste pays-2col"/, 'les pays doivent être une liste');
  // Le bouton porte ses classes par un tableau (« pays-item », plus « on » ou
  // « conseille » selon l'écran) : c'est ce qui permet au MÊME module de servir
  // la question d'ouverture et les réglages. On cherche donc la classe dans sa
  // fabrique, pas une chaîne figée dans le gabarit.
  assert.match(js, /\['pays-item'\]/, 'chaque pays doit être un bouton de liste');
  // La liste doit DIRE lequel est actif : un menu déroulant le montrait, une
  // liste ne le montre que si on l'écrit.
  assert.match(css, /\.pays-item\.on\s*\{/, 'le pays actif doit être mis en évidence');
  assert.match(css, /\.langue\.on\s*\{/, 'la langue active doit être mise en évidence');
});

test('les pays portent leur drapeau et se partagent sur deux colonnes', () => {
  // Demandes de B : « il faut que le pays soit aussi avec le drapeau. Et partager
  // sur deux colonnes pour gagner de la place » — puis, le 08/10/2026 : « il faut
  // proposer le même module qui est dans les paramètres d'utilisateur avec les
  // drapeaux, sur deux colonnes ». Les deux écrans passent donc par htmlListePays.
  const debut = js.indexOf('function htmlListePays(');
  assert.ok(debut > 0, 'le module de choix du pays doit exister');
  const bloc = js.slice(debut, js.indexOf('function dessinerPays()', debut));
  assert.ok(bloc.length > 200, `découpage du module invalide (${bloc.length} caractères)`);
  assert.match(bloc, /DRAPEAUX_PAYS\[String\(code\)\.toLowerCase\(\)\]/,
    'chaque pays doit porter son drapeau — et la recherche doit être '
    + 'insensible à la casse : les codes du catalogue sont en MAJUSCULES (DE, GB, '
    + 'BE…) alors que la table est en minuscules. Sans le toLowerCase, douze pays '
    + 'sur treize s’affichaient SANS drapeau, et rien ne le disait.');
  assert.match(bloc, /class="pays-liste pays-2col"/, 'la liste des pays doit être sur deux colonnes');
  assert.match(css, /\.pays-liste\.pays-2col\s*\{[^}]*grid-template-columns:\s*repeat\(2/,
    'les deux colonnes doivent être écrites dans la feuille de style');
  // Et les DEUX écrans s'en servent : les réglages marquent le pays retenu, la
  // question d'ouverture passe par le même module.
  assert.match(js, /htmlListePays\(\{ actif: etat\.pays \}\)/,
    'l’onglet Réglages doit passer par le module partagé');
  // La question n'est posée QUE si l'appareil ne dit rien (demande de B,
  // 11/10/2026 : le visiteur doit ARRIVER sur son pays) — le pays deviné n'est
  // donc plus « conseillé », il est APPLIQUÉ. Voir tests/pays-origine.test.mjs.
  assert.match(js, /htmlListePays\(\{ actif: etat\.pays \}\)/,
    'la question d’ouverture doit passer par le module partagé');
  // Chaque pays du CATALOGUE doit avoir un drapeau. Sans cette vérification, un
  // pays ajouté demain apparaîtrait avec un trou à la place du drapeau — et
  // personne ne le verrait avant de regarder l'écran.
  // Plusieurs drapeaux tiennent sur une même ligne : on ne peut donc pas
  // ancrer la recherche au début de ligne, sinon on n'en compterait qu'un par
  // ligne — trois au lieu de neuf, et le test crierait au loup.
  const pays = [...DRAP.matchAll(/([a-z]{2}): DRAPEAUX\./g)].map((m) => m[1]);
  assert.ok(pays.length >= 9, `table de drapeaux trop maigre : ${pays.join(', ')}`);
  for (const c of ['at', 'be', 'ie', 'gb', 'se']) {
    assert.match(DRAP, new RegExp(`\\b${c}: (DRAPEAUX\\.|'<rect)`),
      `le drapeau du pays « ${c} » manque : l’Autriche, la Belgique et l’Irlande `
      + `n’ont pas de langue propre, le Royaume-Uni et la Suède portent un autre code`);
  }
  // L'Europe entière a droit à son drapeau comme les autres pays.
  assert.match(DRAP, /tout: DRAPEAU_EUROPE/, '« Tous les pays » doit avoir un drapeau');
  assert.match(DRAP, /i < 12;/, 'le drapeau européen doit porter DOUZE étoiles');
});

test('le bloc « Prix et disponibilité » est dans Informations, plus en bas de page', () => {
  // Demande de B (08/10/2026) : « Toutes ces parties-là se trouve en bas du
  // site, elle ne doit pas y apparaître car elle doit apparaître dans
  // informations dans les paramètres. »
  const pied = html.slice(html.indexOf('<footer class="pied">'), html.indexOf('</footer>'));
  assert.ok(pied.length > 0, 'le pied de page doit exister');
  for (const reste of ['Prix et disponibilité', 'mentions-prix', 'prixReleves',
                       'Frais de port', 'flux publics']) {
    assert.ok(!pied.includes(reste),
      `« ${reste} » ne doit plus être dans le pied de page`);
  }
  // Le compartiment Informations va du panneau jusqu'au VERROU du compte, qui
  // le suit dans le fichier. On borne là : sans borne, la recherche attraperait
  // aussi le pied de page — et le test dirait « c'est bien dans Informations »
  // en lisant exactement l'endroit d'où l'on vient de le retirer.
  const debut = html.indexOf('data-panneau="infos"');
  assert.ok(debut > 0, 'le compartiment Informations doit exister');
  const panneau = html.slice(debut, html.indexOf('class="verrou"', debut));
  for (const attendu of ['Prix et disponibilité', 'id="prixReleves"', 'Frais de port']) {
    assert.ok(panneau.includes(attendu),
      `« ${attendu} » doit se trouver dans l’onglet Informations`);
  }
  // #prixReleves est écrit par app.js : sans l'élément, l'horodatage du relevé
  // disparaîtrait de l'application. On vérifie les DEUX côtés.
  assert.match(js, /\$\('prixReleves'\)/, 'app.js doit continuer d’écrire l’horodatage');
});

test('le panneau d’administration impose [hidden]', () => {
  // Défaut mesuré (08/10/2026) : l'écran de connexion du panneau restait
  // AFFICHÉ AU-DESSUS du panneau ouvert. Cause : la règle `#verrou{display:flex}`
  // écrase l'attribut `hidden`, qui ne vaut que `display:none` sans « !important ».
  // On pouvait lire les deux écrans à la fois, et rien dans le code ne le disait.
  const admin = lire('admin/index.html');
  assert.match(admin, /\[hidden\]\s*\{\s*display:\s*none\s*!important/,
    'la feuille du panneau doit forcer [hidden] { display:none !important }');
  // Et le panneau doit être une application à part, pas un onglet du site.
  assert.match(admin, /data-vue="origines"/,
    'l’onglet Origines doit exister dans le panneau');
  for (const id of ['mOriginePays', 'mActifs', 'mNonActifs', 'mCandidats']) {
    assert.ok(admin.includes(`id="${id}"`), `le bloc « ${id} » doit exister`);
  }
  assert.match(admin, /noindex/, 'le panneau ne doit pas être indexé');
});

test('les trois modes d’affichage ne sont plus dans un grand cadre', () => {
  // Demande de B : « il faut minimiser le grand rectangle qui entoure les trois
  // possibilités. Il faut que ce soit plus propre. » Le cadre, c'était la règle
  // .vues elle-même : fond, bordure et marge intérieure autour des trois boutons.
  const regle = css.match(/\.vues\s*\{([^}]*)\}/);
  assert.ok(regle, 'la règle .vues doit exister');
  assert.doesNotMatch(regle[1], /background/,
    'le cadre autour des trois modes doit avoir disparu (fond)');
  assert.doesNotMatch(regle[1], /border/,
    'le cadre autour des trois modes doit avoir disparu (bordure)');
  assert.doesNotMatch(regle[1], /padding/,
    'le cadre autour des trois modes doit avoir disparu (marge intérieure)');
  // Mais chaque mode doit rester un bouton visible et cliquable.
  assert.match(css, /\.vue\.on\s*\{/, 'le mode actif doit rester mis en évidence');
});

