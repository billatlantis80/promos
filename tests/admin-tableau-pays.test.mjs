/**
 * LE TABLEAU DE PAYS À DRAPEAUX, ET LES INFORMATIONS À L'HORIZONTALE.
 *
 * B (08/10/2026) : « Pour les pays je ne souhaite pas un menu déroulant, je
 * souhaite un tableau comme il y a dans les paramètres de l'appli, avec les
 * drapeaux. Pour l'onglet marché et affiliation. »
 *
 * Et : « Au niveau de l'affichage des adresses administratives des entreprises,
 * tu les as mis en vertical, j'ai besoin qu'elle s'affiche en horizontal, après
 * la colonne des adresses Internet des promotions qui est adaptable. Toutes les
 * informations de la même entreprise, sur une seule ligne horizontal. »
 *
 * CE QUE CE FICHIER PROTÈGE.
 *   1. PLUS DE MENU DÉROULANT. Un `<select>` cachait onze pays sur douze
 *      derrière un clic. Le retour du menu serait une régression silencieuse :
 *      tout continuerait de marcher, en moins bien.
 *   2. UNE SEULE TABLE DE DRAPEAUX. Elle vit dans `drapeaux.js`, partagée avec
 *      l'application. Deux tables recopiées finiraient par donner deux drapeaux
 *      différents pour le même pays selon l'écran.
 *   3. LE MÊME TABLEAU DES DEUX CÔTÉS. Le Marché Euro et l'Affiliation doivent
 *      annoncer le MÊME nombre de pays — sinon l'un en cache un et personne ne
 *      s'en aperçoit, puisqu'on ne les compare jamais côte à côte.
 *   4. LE NOMBRE DE COLONNES, ET LA NOTE EN DERNIER (RETOURNÉ DEUX FOIS).
 *      Ce point exigeait que les NEUF colonnes d'informations de siège suivent
 *      l'adresse des promotions, chacune dans sa colonne. B les a fait retirer :
 *      « tu peux définitivement enlever les colonnes suivantes car elles ne
 *      servent à rien à cet endroit-là : adresse, téléphone, email, CA indicatif,
 *      actionnariat, positionnement, segment, distribution, remarques. Tu peux
 *      laisser les notes. » Puis, le 12/10/2026 : « Tu peux aussi enlever les deux
 *      colonnes suivantes, toujours dans la même catégorie. Type et Lu par. »
 *      Il exige donc maintenant l'INVERSE — SIX colonnes (Acteur, État, Articles,
 *      Site, Adresse des promotions, Note), la note en dernier — et il compte la
 *      ligne écrite comme l'en-tête : c'est le retrait qui DÉCALE tout qui est
 *      désormais surveillé ici.
 *
 *   5. LE DERNIER MOT SUR CES INFORMATIONS (ajouté le 11/10/2026). « Retirées de
 *      l'écran » ne doit pas se lire « retirées de partout » : elles vivent
 *      toujours dans la base et dans l'export CSV, qui est le lien avec les
 *      fichiers Excel. Une épreuve le vérifie, colonne par colonne.
 *
 * Lancement : node --test tests/admin-tableau-pays.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DRAPEAUX_PAYS, NOMS_PAYS, drapeauDe, svgDrapeau } from '../public/drapeaux.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(RACINE, 'public', 'app.js'), 'utf8');
const drapeaux = fs.readFileSync(path.join(RACINE, 'public', 'drapeaux.js'), 'utf8');
const css = (admin.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';

/* --------------------------------------------- 1. Plus de menu déroulant */

test('le choix du pays n’est PLUS un menu déroulant', () => {
  assert.ok(!/<select[^>]*id="paysMarche"/.test(admin), 'le menu déroulant est revenu (Marché Euro)');
  assert.ok(!/<select[^>]*id="paysAffiliation"/.test(admin), 'le menu déroulant est revenu (Affiliation)');
  assert.match(admin, /<div class="pays-liste pays-2col" id="paysMarche"/, 'le tableau de pays doit exister');
  assert.match(admin, /<div class="pays-liste pays-2col" id="paysAffiliation"/, 'et le même pour l’affiliation');
});

test('chaque pays est une TUILE cliquable, qui porte son drapeau', () => {
  const m = admin.match(/function dessinerBarrePays\(\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'dessinerBarrePays() doit exister');
  assert.match(m[0], /class="pays-item/, 'les pays doivent être des tuiles');
  assert.match(m[0], /data-pays=/, 'une tuile doit porter son code de pays (pour le clic)');
  assert.match(m[0], /svgDrapeau\(/, 'chaque tuile doit dessiner son drapeau');
  assert.match(m[0], /role="radio"/, 'un choix unique se dit « radio », pas « bouton »');
  const m2 = admin.match(/function dessinerBarreAffiliation\(\) \{[\s\S]*?\n\}/);
  assert.ok(m2, 'dessinerBarreAffiliation() doit exister');
  assert.match(m2[0], /class="pays-item/, 'l’affiliation doit porter le MÊME tableau');
  assert.match(m2[0], /svgDrapeau\(/, 'et les drapeaux aussi');
});

test('le clic sur une tuile change bien de pays', () => {
  // Les tuiles sont redessinées à chaque fois (elles portent les compteurs).
  // Un écouteur posé sur chaque tuile disparaîtrait avec elle : le pays ne
  // changerait plus, et RIEN ne le dirait. L'écouteur est donc sur le conteneur.
  // Deux tableaux, donc DEUX délégations : une par onglet. On les compte.
  const delegations = (admin.match(/addEventListener\('click', \(e\) => \{\s*\n\s*const tuile = e\.target\.closest/g) || []).length;
  assert.equal(delegations, 2, `une délégation attendue par onglet, trouvé ${delegations}`);
  assert.match(admin, /closest\('button\[data-pays\]'\)/, 'le clic doit viser la tuile, pas son contenu');
  assert.match(admin, /paysChoisi = tuile\.dataset\.pays/, 'le clic doit fixer le pays du Marché Euro');
  assert.match(admin, /paysChoisiAff = tuile\.dataset\.pays/, 'le clic doit fixer le pays de l’Affiliation');
});

test('la mise en forme des tuiles est écrite, pas supposée', () => {
  assert.match(css, /\.pays-liste\s*\{[^}]*grid/, 'la grille des pays doit être écrite');
  assert.match(css, /\.pays-item\.on/, 'le pays ACTIF doit se voir — sinon on ne sait pas où on est');
  assert.match(css, /\.drap svg\{[^}]*width:27px/, 'la taille du drapeau doit être fixée');
});

/* ------------------------------------ 2. Une seule table de drapeaux */

test('les drapeaux vivent dans UN module partagé', () => {
  assert.match(app, /from '\.\/drapeaux\.js'/, 'l’application doit importer les drapeaux partagés');
  assert.match(admin, /from '\.\.\/drapeaux\.js'/, 'le panneau aussi');
  // Et plus personne ne les redéfinit à côté : deux tables divergeraient.
  for (const [nom, source] of [['app.js', app], ['le panneau', admin]]) {
    assert.ok(!/const DRAPEAUX\s*=\s*\{/.test(source),
      `${nom} redéfinit DRAPEAUX : la table partagée doit rester l’unique source`);
    assert.ok(!/const NOMS_PAYS\s*=\s*\{/.test(source),
      `${nom} redéfinit NOMS_PAYS : la table partagée doit rester l’unique source`);
  }
});

test('aucun pays du catalogue ne peut avoir un trou à la place du drapeau', () => {
  const codes = admin.match(/([a-z]{2}): DRAPEAUX\.|'<rect/g) ? null : null;
  void codes;
  const attendus = ['fr', 'nl', 'de', 'es', 'it', 'pt', 'pl', 'gb', 'se', 'at', 'be', 'ie'];
  for (const c of attendus) {
    assert.ok(drapeauDe(c).length > 20, `le drapeau « ${c} » manque dans la table partagée`);
  }
  assert.ok(drapeauDe('tout').includes('#003399'), '« tout » doit porter le drapeau européen');
  assert.ok(drapeauDe('ZZ').length === 0, 'un pays inconnu ne doit pas inventer de drapeau');
  // Les douze pays du catalogue ont un NOM lisible, pas seulement un drapeau.
  for (const c of attendus) {
    assert.ok(NOMS_PAYS[c.toUpperCase()], `« ${c} » n’a pas de nom dans la table partagée`);
  }
});

test('le drapeau est un DESSIN, jamais un emoji', () => {
  // Sous Windows, un emoji drapeau s'affiche « FR » dans un petit carré. Sur une
  // application qui vise toute l'Europe, ce n'est pas acceptable.
  const svg = svgDrapeau('BE');
  assert.match(svg, /<svg viewBox="0 0 24 16">/, 'le drapeau doit être un SVG');
  assert.match(svg, /<rect/, 'et porter des formes');
  assert.ok(!/[\u{1F1E6}-\u{1F1FF}]/u.test(svg), 'aucun emoji drapeau ne doit être utilisé');
  assert.ok(!/<img/.test(svg), 'aucune image : la règle d’économie de données interdit un fichier par drapeau');
});

/* ------------------------------------ 3. Le même tableau des deux côtés */

test('les deux onglets annoncent le MÊME nombre de pays', () => {
  // L'Irlande est servie par l'application mais n'a aucun acteur recensé :
  // l'Affiliation la laissait tomber, et les deux onglets ne disaient pas la
  // même chose — un écart qu'on ne voit qu'en les comparant, donc jamais.
  const m = admin.match(/function dessinerBarreAffiliation\(\) \{[\s\S]*?\n\}/);
  assert.match(m[0], /paysAffiliation\(marche, affMesures, catalogue\)/,
    'la liste des pays d’affiliation doit inclure les pays du catalogue');
});

/* ------------- 4. Les informations de siège ONT ÉTÉ RETIRÉES (11/10/2026)
 *
 * RETOURNEMENT, PAS SUPPRESSION. Les trois épreuves qui suivaient exigeaient
 * l'INVERSE : elles verrouillaient les neuf colonnes d'informations de siège et
 * leur ordre après l'adresse des promotions (règle de B du 08/10/2026). B a
 * demandé leur retrait le 11/10/2026. Les exiger à nouveau serait protéger une
 * décision annulée, donc elles sont RETOURNÉES — et datées, pour que le prochain
 * lecteur ne prenne pas ce retournement pour une négligence.
 *
 * DEUX PRÉCAUTIONS, TOUTES LES DEUX PAYÉES AILLEURS SUR CE PROJET :
 *   - le contrôle d'ABSENCE porte sur les NOMS DU CODE (la table d'ordre, la
 *     fabrique des cellules), jamais sur le mot français : le fichier explique
 *     ce qu'il a retiré, et il a le droit de le NOMMER ;
 *   - c'est pourquoi on lit le fichier COMMENTAIRES RETIRÉS avant de chercher
 *     une absence. Un `doesNotMatch` sur le texte brut mord dans l'explication.
 */

/** Le panneau, commentaires retirés — pour les contrôles d'ABSENCE seulement. */
function sansCommentaires(txt) {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, '')      // /* … */ du JavaScript et du CSS
    .replace(/<!--[\s\S]*?-->/g, '')       // <!-- … --> du HTML
    .replace(/^[ \t]*\/\/.*$/gm, '');      // // … en tête de ligne
}
const CODE = sansCommentaires(admin);

/** Le panneau du Marché Euro SEUL — de `dessinerMarche()` à l'export qui suit.
 *  Nécessaire : trois autres tableaux de la page portent un en-tête qui commence
 *  par « Acteur », et une borne disparue (`indexOf` à -1) ferait avaler la fin du
 *  fichier en silence. On la protège. */
const MARCHE_DEBUT = admin.indexOf('function dessinerMarche()');
const MARCHE_FIN = admin.indexOf('function csvMarche()');
assert.ok(MARCHE_DEBUT > 0 && MARCHE_FIN > MARCHE_DEBUT,
  'les bornes du Marché Euro ont bougé : impossible de lire le bon tableau');
const MARCHE = admin.slice(MARCHE_DEBUT, MARCHE_FIN);
assert.ok(MARCHE.length > 4000 && MARCHE.length < 40000,
  `découpage invalide (${MARCHE.length} caractères) — une borne a bougé`);

test('les informations de siège, le TYPE et « LU PAR » ne sont PLUS des colonnes', () => {
  for (const nom of ['ORDRE_INFORMATIF', 'cellulesInfo', 'ficheInfo']) {
    assert.ok(!CODE.includes(nom),
      `« ${nom} » est revenu : les colonnes de siège sont rebranchées`);
  }
  for (const nom of ['type-acteur', 'lu-par']) {
    assert.ok(!CODE.includes(nom),
      `« ${nom} » est revenu : la colonne « ${nom === 'lu-par' ? 'Lu par' : 'Type'} » est rebranchée`);
  }
  assert.ok(!/const lu = /.test(CODE),
    'la variable `lu` est revenue : elle n’était construite que pour la colonne « Lu par »');
  assert.ok(!/class="info/.test(CODE), 'une cellule informative est revenue dans le tableau');
  assert.ok(!/td\.info|th\.info/.test(CODE), 'une règle de style informative est restée orpheline');
});

test('la note est la DERNIÈRE colonne, et il n’y a plus rien avant elle', () => {
  const entete = MARCHE.match(/<tr><th>Acteur<\/th>[\s\S]*?<\/tr>/);
  assert.ok(entete, 'l’en-tête des acteurs doit exister dans le Marché Euro');
  const libelles = [...entete[0].matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(libelles, ['Acteur', 'État', 'Articles', 'Site',
    'Adresse des promotions', 'Note'],
    `l’en-tête doit être EXACTEMENT ces six colonnes, dans cet ordre — trouvé : ${libelles.join(' | ')}`);
  assert.ok(!/class="info/.test(entete[0]), 'une colonne informative est revenue avant la note');
});

test('LA LIGNE ÉCRITE COMPTE AUTANT DE CASES QUE LE TABLEAU A DE COLONNES', () => {
  // Le défaut de tout retrait de colonne : la ligne garde une case d'avance ou
  // de retard, le tableau reste PARFAITEMENT LISIBLE — et faux. Ce contrôle
  // compare la ligne fabriquée à l'en-tête, les deux lus dans le fichier livré.
  const entete = MARCHE.match(/<tr><th>Acteur<\/th>[\s\S]*?<\/tr>/)[0];
  const nbColonnes = (entete.match(/<th[ >]/g) || []).length;
  const i = MARCHE.indexOf('return `<tr>');
  const j = MARCHE.indexOf('${ligneEdition(a)}');
  assert.ok(i > -1 && j > i && j - i < 3000,
    `découpage de la ligne invalide (${i} → ${j}) — la borne a bougé`);
  const ligne = MARCHE.slice(i, j);
  const nbCases = (ligne.match(/<td[ >]/g) || []).length;
  assert.equal(nbCases, nbColonnes,
    `la ligne écrit ${nbCases} case(s) pour ${nbColonnes} colonne(s) : tout ce qui suit l'écart est décalé`);
  assert.equal(nbColonnes, 6, 'le tableau doit avoir six colonnes');
});

test('le liseré, le style et les sélecteurs des colonnes retirées sont partis ensemble', () => {
  // Les règles GROUPÉES ont été SÉPARÉES à chaque retrait :
  // `td.type-acteur,td.lu-par,td.info,td.site,…` est devenue `td.site,td.raison`.
  // Un sélecteur orphelin dans une règle groupée est un piège à relecture : il
  // laisse croire que la colonne existe encore.
  assert.match(css, /td\.site,td\.raison\{white-space:nowrap\}/,
    'la règle groupée doit avoir été séparée, pas amputée en silence');
  for (const selecteur of [/\.info\b/, /lu-par/, /type-acteur/]) {
    assert.ok(!selecteur.test(css),
      `« ${selecteur} » traîne encore dans la feuille de style : un style sans sélecteur`);
  }
  assert.ok(!/fiche-info/.test(admin),
    'le style du bloc VERTICAL est encore là — il était déjà mort avant ce retrait');
});

test('les informations de siège restent dans la BASE et dans l’EXPORT CSV', () => {
  // Le dernier mot, et le plus important : « retirées de l'écran » ne veut pas
  // dire « retirées de partout ». L'export CSV est le lien avec les fichiers
  // Excel de B — s'il perdait ces colonnes, le retrait aurait emporté la donnée.
  const csv = admin.slice(MARCHE_FIN, admin.indexOf('function csvAffiliation'));
  assert.ok(csv.length > 800 && csv.length < 6000,
    `découpage de l’export invalide (${csv.length} caractères)`);
  const bloc = csv.match(/const entetes = \[([\s\S]*?)\];/);
  assert.ok(bloc, 'la liste des libellés de l’export doit exister');
  const libelles = [...bloc[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  assert.deepEqual(libelles, ['Acteur', 'Categorie', 'Type', 'Etat',
    'Sources flux', 'Sources veille', 'Articles en ligne', 'Clics', 'Partages',
    'Site', 'Domaines', 'Adresse des promotions', 'Note',
    '--- INFORMATIF ---', 'Adresse', 'Telephone', 'Email', 'CA indicatif',
    'Actionnariat', 'Positionnement', 'Segment', 'Distribution', 'Remarques'],
    `l’export CSV doit garder les neuf informations — trouvé : ${libelles.join(' | ')}`);
});

test('l’export CSV écrit AUTANT de valeurs que son en-tête a de libellés', () => {
  // Le piège réparé le 11/10/2026 : « Positionnement » manquait des DEUX listes,
  // donc les deux comptaient pareil et aucun contrôle de comptage ne pouvait le
  // voir — c'est la liste des libellés ATTENDUS ci-dessus qui le voit. Ce
  // contrôle-ci garde l'alignement pour la suite : une valeur ajoutée d'un côté
  // sans l'autre décale tout ce qui suit, et le tableau reste lisible.
  const csv = admin.slice(MARCHE_FIN, admin.indexOf('function csvAffiliation'));
  const bloc = csv.match(/const entetes = \[([\s\S]*?)\];/);
  const libelles = [...bloc[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const ligne = csv.match(/return \[([\s\S]*?)\]\.map\(cell\)/);
  assert.ok(ligne, 'la ligne de valeurs de l’export doit exister');
  assert.ok(ligne[1].length > 200 && ligne[1].length < 2000,
    `découpage de la ligne invalide (${ligne[1].length} caractères)`);
  assert.equal(cases(ligne[1]), libelles.length,
    `l’export écrit ${cases(ligne[1])} valeur(s) pour ${libelles.length} libellé(s) : tout ce qui suit est décalé`);
});

/** Le nombre de CASES d'un littéral de tableau JavaScript.
 *
 *  Le compte naïf des virgules se trompe DEUX fois, et les deux sont écrites
 *  noir sur blanc dans l'historique de ce projet : la virgule FINALE ne fait pas
 *  une case, et une virgule à l'intérieur d'une chaîne (« ' · ' ») ou d'un appel
 *  n'en fait pas une non plus. */
function cases(txt) {
  txt = txt.replace(/,\s*$/, '');
  let n = 0, prof = 0, q = null, dedans = false;
  for (const c of txt) {
    if (q) { if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; dedans = true; continue; }
    if (c === '(' || c === '[' || c === '{') prof++;
    else if (c === ')' || c === ']' || c === '}') prof--;
    else if (c === ',' && prof === 0) n++;
    else if (!/\s/.test(c)) dedans = true;
  }
  return dedans ? n + 1 : 0;
}

/* ------------------- 5. Le texte s'adapte à la place prévue */

test('un texte trop long se coupe, et se lit EN ENTIER au survol', () => {
  // B (08/10/2026) : « Si le texte est trop long, exemple dans la description, on
  // doit garder la même distance dans l'encadrement, c'est le texte qui doit
  // s'adapter. […] le reste du texte apparaîtra quand la souris est dessus. »
  //
  // CE QUI SE JOUE ICI, ET QUI EST FACILE À RATER : tronquer à l'écran est
  // acceptable SEULEMENT si le texte entier reste accessible. Une coupure qui
  // perd l'information n'est pas une mise en forme, c'est une perte de données —
  // et elle est silencieuse, puisqu'on ne voit que ce qui reste.
  assert.match(css, /\.tronque\{[^}]*text-overflow:\s*ellipsis/,
    'la coupure doit se voir (points de suspension), pas se deviner');
  assert.match(css, /\.tronque\{[^}]*white-space:\s*nowrap/,
    'c’est le TEXTE qui s’adapte : il ne doit pas faire grandir la cellule');
  const m = admin.match(/function celluleTronquee\(txt\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'la fabrique de valeur tronquée doit exister');
  assert.match(m[0], /title="\$\{esc\(t\)\}"/,
    'le texte ENTIER doit partir dans l’infobulle — sinon la coupure perd l’information');
  // Et elle est réellement utilisée là où le texte est long, pas seulement écrite.
  // Les neuf colonnes de siège (11/10/2026), puis « Type » et « Lu par »
  // (12/10/2026) sont partis : leurs usages partent avec eux. Ce qui RESTE doit
  // continuer à passer par la coupure.
  for (const usage of ['celluleTronquee(a.categorie)',
    'celluleTronquee(a.affiliation.reseaux.join', 'celluleTronquee(x.raison)']) {
    assert.ok(admin.includes(usage), `« ${usage} » : une valeur longue doit passer par la coupure`);
  }
  assert.ok(!/\$\{celluleTronquee\(a\.type\)\}/.test(admin),
    'la coupure de la colonne « Type » est restée orpheline : la colonne a été retirée le 12/10/2026');
});
