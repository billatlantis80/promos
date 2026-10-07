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

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', 'public', f), 'utf8');

const css = lire('app.css');
const js = lire('app.js');
const html = lire('index.html');

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
  assert.ok(
    js.indexOf('class="col-icones"') < js.indexOf('class="col-envoi"'),
    'la colonne d’icônes doit précéder le bouton de redirection',
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
  // Le menu de partage était ancré à DROITE ; la colonne étant au bord gauche de
  // la carte, il en sortait. Il s'ouvre maintenant vers la droite.
  const menu = css.match(/^\.menu-partage \{([\s\S]*?)^\}/m);
  assert.ok(menu, 'la règle .menu-partage doit exister');
  assert.match(menu[1], /left:\s*0/, 'le menu doit s’ouvrir vers la droite');
  assert.doesNotMatch(menu[1], /right:\s*0/, 'ancré à droite, il sortirait de la carte');
  // Le montant est groupé : sans ce groupe, le prix « avant » partirait à l'autre bout.
  assert.match(js, /class="montant"/, 'le montant doit être groupé dans un seul élément');
});

test('chaque élément lu par le script existe dans la page', () => {
  const idsPage = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  // Certains éléments sont CRÉÉS par le script (le bouton « afficher plus ») :
  // on les accepte aussi, sinon le contrôle crie au loup sur du code correct.
  const idsFabriques = new Set([...js.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const idsScript = [...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
  const manquants = [...new Set(idsScript)].filter((id) => !idsPage.has(id) && !idsFabriques.has(id));
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
  // Les deux chemins de changement de pays (question d'ouverture / réglages via
  // choisirPays, et le sélecteur de la barre du haut) doivent redessiner les
  // onglets : un seul chemin corrigé laisserait l'autre mentir.
  const choisir = js.slice(js.indexOf('function choisirPays('), js.indexOf('function demanderPays('));
  assert.match(choisir, /dessinerPuces\(\)/, 'choisirPays() doit redessiner les onglets');
  const brancher = js.slice(js.indexOf("$('tri').addEventListener"), js.lastIndexOf("document.querySelectorAll('.vue')"));
  assert.match(brancher, /\$\('pays'\)\.addEventListener[\s\S]*?dessinerPuces\(\)/, 'le sélecteur de pays de la barre doit redessiner les onglets');
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
  const question = js.slice(js.indexOf('function demanderPays('), js.indexOf('function enregistrerPays('));
  const iTout = question.indexOf('data-pays="tout"');
  const iBoucle = question.indexOf('for (const c of codes)');
  assert.ok(iTout >= 0, 'la question d’ouverture doit proposer « tous les pays »');
  assert.ok(iBoucle > iTout, `« Tous les pays d’Europe » doit précéder la liste des pays (positions ${iTout} / ${iBoucle})`);
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

test('le logo est le logotype fourni : carré arrondi, K détouré, dégradé', () => {
  // B a fourni le logotype définitif le 07/10/2026 : « Peux-tu remplacer par ce
  // logo très exactement. » On vérifie que l'icône de l'en-tête et favicon.svg
  // portent le MÊME dessin — deux tracés divergents donneraient une icône
  // d'onglet différente du logo de l'en-tête — et que les couleurs employées
  // sont celles RELEVÉES sur l'image, pas des approximations.
  const traces = (t) => (t.match(/<path d="([^"]+)"/g) || []).sort();
  const dansPage = traces(html);
  const dansOnglet = traces(lire('favicon.svg'));
  assert.ok(dansPage.length >= 3,
    `l’icône se dessine en plusieurs calques (carré, K blanc, remplissage, pistes), or ${dansPage.length} tracé(s)`);
  assert.deepEqual(dansPage, dansOnglet,
    'l’en-tête et l’icône d’onglet doivent dessiner exactement le même logo');
  for (const [nom, contenu] of [['index.html', html], ['favicon.svg', lire('favicon.svg')]]) {
    assert.ok(contenu.includes('#1B3C69'), `${nom} : le bleu nuit du carré, relevé sur la source`);
    assert.ok(contenu.includes('#2682AD'), `${nom} : le bleu clair du carré`);
    assert.ok(contenu.includes('<defs>'), `${nom} : les dégradés doivent être définis`);
    // Le K finit sur un VERT franc : c'est la signature du logotype. Sur une
    // icône de 26 px, un dégradé remplacé par un aplat bleu ne se verrait pas —
    // ici, si.
    const gradK = contenu.match(/<linearGradient id="gK"[\s\S]*?<\/linearGradient>/);
    assert.ok(gradK, `${nom} : le dégradé du K doit exister`);
    const teintes = [...gradK[0].matchAll(/stop-color="#([0-9A-F]{6})"/g)].map((m) => m[1]);
    assert.ok(teintes.length >= 3,
      `${nom} : le dégradé du K doit être gradué, or ${teintes.length} arrêt(s)`);
    const fin = teintes[teintes.length - 1];
    const vert = [0, 2, 4].map((i) => parseInt(fin.slice(i, i + 2), 16));
    assert.ok(vert[1] > vert[2] && vert[1] > 120,
      `${nom} : le K doit finir sur un vert franc, or #${fin}`);
    assert.ok(!contenu.includes('M11 8h5.5v24H11z'),
      `${nom} : l’ancien K simplifié (rectangles) doit avoir disparu`);
    assert.ok(!/étiquette|etiquette/i.test(contenu.replace(/<!--[\s\S]*?-->/g, '')),
      `${nom} : aucune étiquette de prix dans le dessin`);
  }
  // TOUT le mot KAZENDRA porte le dégradé, de GAUCHE à DROITE — demande de B :
  // « de gauche vers la droite pour le dégradé. Le dégradé est pour le mot
  // Kazendra. » Un dégradé diagonal, ou limité à la seule lettre K, serait un
  // retour en arrière.
  assert.match(html, /<b class="marque-nom">KAZENDRA<\/b>/,
    'le mot entier doit porter le dégradé, pas une seule lettre');
  const mot = css.match(/^\.marque-nom \{([\s\S]*?)^\}/m);
  assert.ok(mot, 'la règle .marque-nom doit exister');
  assert.match(mot[1], /background-clip:\s*text/,
    'le mot doit être rempli par le dégradé');
  assert.match(mot[1], /linear-gradient\(\s*90deg/,
    'le dégradé doit aller de gauche à droite');
  assert.doesNotMatch(mot[1], /linear-gradient\(\s*(?:45|1[0-9]{2})deg/,
    'un dégradé diagonal n’est pas ce qui a été demandé');
  assert.match(css, /--mot-deg-1:\s*#5a9ac8/, 'déclinaison prévue pour en-tête sombre');
  assert.match(css, /--mot-deg-1:\s*#223a5f/, 'déclinaison exacte pour en-tête clair');
  // Le dégradé doit être LISIBLE sur l'en-tête sombre : le bleu nuit du thème
  // est #0d3b5b, la teinte de départ doit s'en détacher.
  const sombre = css.match(/\.marque \{ --mot-deg-1:\s*#([0-9a-f]{6})/i);
  assert.ok(sombre, 'la déclinaison sombre doit définir une teinte de départ');
  const c = [0, 2, 4].map((i) => parseInt(sombre[1].slice(i, i + 2), 16));
  const lum = (v) => { const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lMot = 0.2126 * lum(c[0]) + 0.7152 * lum(c[1]) + 0.0722 * lum(c[2]);
  const lTete = 0.2126 * lum(13) + 0.7152 * lum(59) + 0.0722 * lum(91); // #0d3b5b
  const contraste = (lMot + 0.05) / (lTete + 0.05);
  assert.ok(contraste >= 3,
    `le début du mot doit rester lisible sur l’en-tête (#0d3b5b) : ${contraste.toFixed(2)}:1`);
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

