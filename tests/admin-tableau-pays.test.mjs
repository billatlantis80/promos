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
 *   4. L'ORDRE DES COLONNES. Les informations de siège viennent APRÈS l'adresse
 *      des promotions, chacune dans sa colonne, sur la même ligne. Les remettre
 *      en vertical défairait exactement ce qui a été demandé.
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

/* ------------------------------------ 4. Les informations à l'horizontale */

test('les informations de siège sont ÉTALÉES, pas empilées', () => {
  const m = admin.match(/function cellulesInfo\(a\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'cellulesInfo() doit exister');
  assert.match(m[0], /<td/, 'chaque information doit être une CELLULE, sur la même ligne');
  assert.ok(!/fiche-info/.test(m[0]), 'plus de bloc vertical : c’est ce qui a été corrigé');
  // La fonction garde son nom d'origine : elle rend des paires (libellé, valeur).
  const f = admin.match(/function ficheInfo\(a\) \{[\s\S]*?\n\}/);
  assert.ok(f, 'ficheInfo() doit exister');
  for (const champ of ['a.adresse', 'a.telephone', 'a.email', 'a.ca']) {
    assert.ok(admin.includes(champ), `le panneau doit encore afficher ${champ}`);
  }
});

test('les informations viennent APRÈS l’adresse des promotions, note en dernier', () => {
  // L'en-tête est ENGENDRÉ à partir de la liste des colonnes informatives : on
  // ne peut donc pas y chercher les libellés en clair. On lit la DÉCLARATION,
  // puis l'ordre d'assemblage — c'est là que la demande de B se joue.
  const decl = admin.match(/const ORDRE_INFORMATIF = \[([\s\S]*?)\];/);
  assert.ok(decl, 'la liste des colonnes informatives doit exister');
  const infos = [...decl[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const L of ['Adresse', 'Téléphone', 'E-mail', 'CA indicatif', 'Actionnariat',
    'Positionnement', 'Segment', 'Distribution', 'Remarques']) {
    assert.ok(infos.includes(L), `la colonne « ${L} » manque`);
  }
  const entete = admin.match(/<tr><th>Acteur<\/th>[\s\S]*?<\/tr>/);
  assert.ok(entete, 'l’en-tête des acteurs doit exister');
  const e = entete[0];
  const iPromo = e.indexOf('Adresse des promotions');
  const iInfos = e.indexOf('ORDRE_INFORMATIF.map');
  const iNote = e.indexOf('<th>Note</th>');
  assert.ok(iPromo > -1 && iInfos > -1 && iNote > -1,
    `l’en-tête doit porter la promo, les informations et la note (${e.slice(0, 120)}…)`);
  assert.ok(iInfos > iPromo,
    'les informations de siège doivent venir APRÈS l’adresse des promotions (demande de B)');
  assert.ok(iNote > iInfos, 'la note doit rester la DERNIÈRE colonne');
  // Et les cellules suivent le même ordre, au même endroit dans la ligne.
  const ligne = admin.match(/<td>\$\{blocAdresse\(a\)\}<\/td>[\s\S]{0,200}?<\/tr>/);
  assert.ok(ligne, 'la ligne doit poser la promo PUIS les informations');
  assert.match(ligne[0], /\$\{cellulesInfo\(a\)\}/, 'les informations doivent suivre la promo, cellule par cellule');
});

test('la frontière « ce qui informe » est visible dans le tableau', () => {
  // Règle de B : ces informations sont documentaires et ne servent JAMAIS au
  // programme. Un liseré sépare visiblement le travail de la documentation.
  assert.match(admin, /ORDRE_INFORMATIF/, 'l’ordre des colonnes doit être déclaré une fois');
  const m = admin.match(/function cellulesInfo\(a\) \{[\s\S]*?\n\}/);
  assert.match(m[0], /i === 0 \? ' sep'/, 'la première colonne informative doit porter le liseré');
  assert.match(css, /td\.info\.sep|td\.info,th\.info\.sep/, 'le liseré doit être écrit dans la feuille de style');
});

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
  assert.match(admin, /celluleTronquee\(parLibelle\.get\(libelle\)\)/,
    'les informations de siège doivent passer par la coupure');
  assert.match(admin, /\$\{celluleTronquee\(a\.type\)\}/, 'la colonne Type aussi');
});
