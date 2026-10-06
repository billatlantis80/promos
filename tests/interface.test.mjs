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

test('l’étoile des favoris est dans l’encadré, jamais sur la photo', () => {
  // Elle a d'abord flotté en haut à gauche du visuel (position:absolute), où elle
  // recouvrait la photo — et le titre en économie de données. Elle est maintenant
  // posée sur la ligne du prix, dans l'encadré, entre le prix et le bouton.
  const favori = css.match(/^\.favori \{([\s\S]*?)^\}/m);
  assert.ok(favori, 'la règle .favori doit exister');
  assert.doesNotMatch(
    favori[1], /position:\s*absolute/,
    'l’étoile ne doit plus flotter au-dessus de la photo',
  );
  assert.match(
    favori[1], /flex:\s*0 0 auto/,
    'l’étoile ne doit pas se laisser comprimer par le bouton',
  );
  // L'étoile vit dans un bandeau dédié, dans l'encadré, entre le prix et le bouton :
  // c'est l'espace vide de la carte. Elle ne doit donc ni être dans la photo, ni
  // collée au prix, ni comprimer le bouton.
  const espace = css.match(/^\.espace-fav \{([\s\S]*?)^\}/m);
  assert.ok(espace, 'la règle .espace-fav doit exister');
  assert.match(espace[1], /flex:\s*1 1 auto/, 'le bandeau doit absorber l’espace libre de la carte');
  assert.match(espace[1], /min-height:\s*30px/, 'le bandeau ne doit jamais être plus court que l’étoile');
  // Le bouton ne colle plus au bas par une marge automatique : c'est le bandeau
  // qui prend le mou, sinon il n'aurait jamais d'espace à occuper.
  assert.doesNotMatch(
    css, /\.offre \.bas \{[^}]*margin-top:\s*auto/,
    'la marge automatique du bas empêcherait le bandeau de récupérer l’espace libre',
  );
  // Le montant est groupé : sans ce groupe, le prix « avant » partirait à l'autre bout.
  assert.match(js, /class="montant"/, 'le montant doit être groupé dans un seul élément');
  assert.match(
    js,
    /<div class="espace-fav">\$\{etoile\}<\/div>\s*\n\s*<div class="bas">/,
    'l’étoile doit être dans un bandeau placé entre le prix et le bouton',
  );
  assert.doesNotMatch(
    js, /class="prix">[\s\S]{0,120}\$\{etoile\}/,
    'l’étoile ne doit plus être collée à la ligne du prix',
  );
  assert.doesNotMatch(
    js, /class="favori[^"]*enligne/,
    'la variante « enligne » n’a plus lieu d’être : l’étoile n’est plus dans la photo',
  );
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

test('les nombres des onglets comptent le pays choisi, pas le catalogue entier', () => {
  const { ctx, lire } = bacAPuces();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'tout', categorie: 'tout' };

  ctx.dessinerPuces();
  assert.deepEqual(
    nombres(lire()),
    { tout: 6, tech: 3, bricolage: 2, autre: 1 },
    'tous pays : les nombres doivent couvrir les 6 offres',
  );

  ctx.etat.pays = 'BE';               // le geste exact de l'utilisateur
  ctx.dessinerPuces();
  assert.deepEqual(
    nombres(lire()),
    { tout: 2, tech: 1, bricolage: 1 },
    'Belgique : « Tout » doit annoncer 2, pas 6 — et « Autres » (0 offre en BE) disparaît',
  );

  ctx.etat.pays = 'FR';
  ctx.dessinerPuces();
  assert.deepEqual(
    nombres(lire()),
    { tout: 4, tech: 2, bricolage: 1, autre: 1 },
    'France : les nombres doivent revenir aux offres françaises',
  );
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

  // L'ordre de référence, écrit À LA MAIN : c'est celui que la France affichait,
  // et il ne doit plus dépendre des données.
  const fr = onglets('FR');
  assert.deepEqual(fr, ['tech', 'maison', 'mode', 'autre'], `France : ${fr.join(' > ')}`);
  // En Belgique, « Maison » écrase « High-tech » par le nombre — et pourtant
  // Maison passe APRÈS. C'est exactement ce que l'utilisateur demandait.
  const be = onglets('BE');
  assert.deepEqual(be, ['tech', 'maison', 'autre'], `Belgique : ${be.join(' > ')}`);

  assert.ok(fr.indexOf('tech') < fr.indexOf('maison'), 'High-tech avant Maison, en France');
  assert.ok(be.indexOf('tech') < be.indexOf('maison'), 'High-tech avant Maison, en Belgique AUSSI');
  // Et sur les onglets communs aux deux pays, l'ordre relatif est identique.
  assert.deepEqual(
    fr.filter((c) => be.includes(c)), be.filter((c) => fr.includes(c)),
    'les onglets communs doivent garder le même ordre d’un pays à l’autre',
  );
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

test('une catégorie absente du nouveau pays retombe sur « Tout »', () => {
  // Sans ce repli, l'onglet choisi disparaîtrait de la liste en gardant le
  // filtre actif : écran vide, et aucune commande pour en sortir visiblement.
  const { ctx } = bacAPuces();
  ctx.etat = { offres: OFFRES_ESSAI, pays: 'BE', categorie: 'autre' };
  ctx.dessinerPuces();
  assert.equal(ctx.etat.categorie, 'tout', 'un filtre devenu impossible doit retomber sur « Tout »');
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
