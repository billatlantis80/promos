/**
 * « MARCHÉ EURO » — le choix du pays, le récapitulatif, et la colonne des
 * adresses de promotions.
 *
 * B (08/10/2026) : « Comme on va rajouter les autres pays par la suite, tu vas
 * adapter l'onglet "Marché Euro" uniquement. Et dedans j'aurais le choix du pays
 * que je veux consulter. Quand je rentre dans le pays consulté j'ai un tableau
 * récapitulatif et en dessous, j'ai la liste des acteurs qui sont actifs ou pas.
 * Par catégorie. »
 *
 * Puis, sur la colonne à ajouter : « une colonne avec l'adresse internet où tu
 * vas prendre les informations à partager sur l'application. Cette colonne peut
 * être adaptée manuellement car je peux venir coller un lien. » — UNE seule
 * colonne, celle où l'on LIT.
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI.
 *   1. La SOMME. Chaque acteur doit tomber dans un pays et un seul, et dans un
 *      état et un seul. Un acteur compté deux fois, ou oublié, produirait un
 *      chiffre faux — et un chiffre faux ne fait aucun bruit : il a l'air d'une
 *      information.
 *   2. Le pays SANS BASE. Il doit s'annoncer « à constituer », pas s'ouvrir sur
 *      une page vide qui aurait l'air cassée. L'Irlande est réellement dans ce
 *      cas : 382 articles lus, aucun acteur recensé.
 *   3. La SAISIE. Une colonne modifiable qui n'enregistre rien est pire qu'une
 *      colonne en lecture seule : elle fait croire que c'est fait.
 *   4. Le CONTRAT DE B. L'adresse de promotions est un champ de TRAVAIL — elle
 *      ne doit jamais devenir une information de siège, ni servir à relier un
 *      acteur à une source. La liaison reste sur le nom et le site web.
 *
 * Lancement : node --test tests/marche-euro.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { paysDuMarche, marcheDuPays, liaisonActeurs, estMoteur }
  from '../public/acteurs.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

function lireCatalogue() {
  const c = [path.join(RACINE, 'data', 'offres.json'), path.join(RACINE, 'docs', 'offres.json')]
    .find((p) => fs.existsSync(p));
  assert.ok(c, 'ni data/offres.json ni docs/offres.json');
  return JSON.parse(fs.readFileSync(c, 'utf8'));
}

const catalogue = lireCatalogue();
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'acteurs.json'), 'utf8'));
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');
// Le croisement et les listes de champs vivent dans le MODULE, pas dans le
// panneau : c'est ce qui les rend exécutables hors navigateur. Les épreuves
// ci-dessous les lisent donc là où ils sont — les chercher dans le panneau
// revenait à vérifier une règle sur un fichier qui ne la contient pas.
const module_ = fs.readFileSync(path.join(RACINE, 'public', 'acteurs.js'), 'utf8');
const r = liaisonActeurs(catalogue, base);
const pays = paysDuMarche(catalogue, base);

/* ------------------------------------------------------- 1. Le choix des pays */

test('les pays consultables viennent de l’application ET de la base', () => {
  const lus = Object.keys(catalogue.parPays || {});
  const recenses = new Set(base.acteurs.map((a) => a.pays));
  for (const p of lus) {
    assert.ok(pays.some((x) => x.pays === p), `${p} est servi par l'application mais absent du choix`);
  }
  for (const p of recenses) {
    assert.ok(pays.some((x) => x.pays === p), `${p} a des acteurs mais est absent du choix`);
  }
  assert.ok(pays.length >= lus.length, 'des pays ont disparu du choix');
});

test('le choix est ordonné, et jamais vide de sens', () => {
  assert.ok(pays.length > 0);
  for (const x of pays) {
    assert.match(x.pays, /^[A-Z]{2}$/, `« ${x.pays} » n'est pas un code de pays`);
    assert.equal(x.flux + x.veille + x.aucun, x.acteurs,
      `${x.pays} : les trois états ne totalisent pas les acteurs`);
    assert.ok(['constituée', 'à constituer'].includes(x.base));
    assert.equal(x.base === 'à constituer', x.acteurs === 0,
      `${x.pays} : « ${x.base} » ne correspond pas à ${x.acteurs} acteur(s)`);
  }
  // Le tri : les pays les plus fournis d'abord — c'est l'ordre de lecture.
  const suite = pays.every((x, i) => i === 0 || pays[i - 1].acteurs >= x.acteurs);
  assert.ok(suite, 'les pays ne sont pas triés par nombre d’acteurs');
});

test('chaque acteur tombe dans UN pays, et un seul', () => {
  const total = pays.reduce((n, x) => n + x.acteurs, 0);
  assert.equal(total, base.acteurs.length,
    `${total} acteurs comptés dans les pays pour une base de ${base.acteurs.length}`);
});

test('un pays servi sans aucun acteur s’annonce « à constituer »', () => {
  // L'Irlande est dans ce cas pour de vrai : des articles lus, aucune fiche.
  // L'annonce « à constituer » est une INFORMATION, pas un aveu d'échec.
  const vide = pays.filter((x) => x.acteurs === 0);
  for (const x of vide) {
    assert.equal(x.base, 'à constituer');
    assert.ok(x.articlesLus > 0 || x.articlesLus === 0);
  }
  assert.match(admin, /base à constituer/, 'le panneau doit l’écrire noir sur blanc');
  assert.match(admin, /pas une panne/, 'et dire que ce n’est pas une panne');
});

/* --------------------------------------------------- 2. Le récapitulatif du pays */

test('la vue d’un pays retombe exactement sur son récapitulatif', () => {
  for (const x of pays) {
    const v = marcheDuPays(catalogue, base, x.pays);
    assert.equal(v.compteurs.acteurs, x.acteurs, `${x.pays} : le total ne retombe pas`);
    const parCat = v.categories.reduce((n, k) => n + k.acteurs, 0);
    assert.equal(parCat, v.compteurs.acteurs, `${x.pays} : les catégories ne totalisent pas les acteurs`);
    for (const k of v.categories) {
      assert.equal(k.flux + k.veille + k.aucun, k.acteurs, `${x.pays}/${k.categorie} : états incohérents`);
      assert.equal(k.annonces, k.liste.reduce((n, a) => n + a.annonces, 0),
        `${x.pays}/${k.categorie} : les articles des acteurs ne totalisent pas`);
    }
    assert.equal(v.categories.reduce((n, k) => n + k.annonces, 0), v.compteurs.annonces,
      `${x.pays} : les articles par catégorie ne retombent pas sur le total`);
  }
});

test('les acteurs d’une catégorie sont classés par ce qu’ils apportent', () => {
  const v = marcheDuPays(catalogue, base, 'BE');
  for (const k of v.categories) {
    const suite = k.liste.every((a, i) => i === 0 || k.liste[i - 1].annonces >= a.annonces);
    assert.ok(suite, `${k.categorie} : les acteurs ne sont pas classés par articles`);
  }
});

test('la Belgique est le pays de départ, et il est complet', () => {
  const be = marcheDuPays(catalogue, base, 'BE');
  assert.equal(be.compteurs.acteurs, base.acteurs.filter((a) => a.pays === 'BE').length);
  assert.ok(be.categories.length > 10, 'la Belgique doit couvrir la plupart des catégories');
});

test('un pays inconnu ne fait pas tomber la vue', () => {
  for (const p of ['ZZ', '', null, undefined]) {
    const v = marcheDuPays(catalogue, base, p);
    assert.equal(v.compteurs.acteurs, 0);
    assert.deepEqual(v.categories, []);
  }
});

/* ------------------------------------------- 3. La colonne des adresses, éditable */

test('le panneau porte la barre de choix du pays, et il la remplit', () => {
  assert.match(admin, /id="paysMarche"/, 'le sélecteur de pays a disparu');
  assert.match(admin, /function dessinerBarrePays\s*\(/, 'la fonction de remplissage a disparu');
  const ligne = admin.split('\n').find((l) => /dessinerBord\(\);/.test(l) && /dessinerBarrePays\(\)/.test(l));
  assert.ok(ligne, 'dessinerBarrePays() n’est appelée nulle part : le sélecteur resterait vide');
});

test('chaque acteur porte une adresse de promotions MODIFIABLE', () => {
  assert.match(admin, /data-acteur="\$\{esc\(a\.nom\)\}"/,
    'le champ d’adresse doit être rattaché à son acteur');
  assert.match(admin, /adresseActeur\(/, 'l’adresse affichée doit venir d’une fonction, pas d’un vide');
  assert.match(admin, /colle ici l’adresse des promotions/, 'le champ doit dire quoi y mettre');
});

test('la saisie est réellement enregistrée, et l’écouteur survit au redessin', () => {
  // DÉFAUT ÉVITÉ : la liste est redessinée à chaque lettre tapée dans la
  // recherche. Des écouteurs posés sur les champs eux-mêmes disparaîtraient
  // avec eux — le champ resterait éditable à l'écran, la frappe ne serait
  // enregistrée nulle part, et rien ne le dirait. L'écouteur est donc posé sur
  // le CONTENEUR (délégation).
  const m = admin.match(/zoneMarche\.addEventListener\('change'[\s\S]*?\n    \}\);/);
  assert.ok(m, 'aucun écouteur délégué sur la liste des acteurs');
  assert.match(admin, /const zoneMarche = document\.getElementById\('mMarche'\)/);
  assert.match(admin, /ecrireAdresse\(nom,/, 'la saisie doit être enregistrée');
});

test('une adresse vidée est RETIRÉE, pas conservée vide', () => {
  // Garder une clé vide ferait croire à un réglage existant, et l'export la
  // porterait : une ligne « renseignée » qui ne dit rien.
  const m = admin.match(/function ecrireAdresse\(nom, url\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'ecrireAdresse() doit exister');
  assert.match(m[0], /delete d\[nom\]/, 'une adresse vidée doit être supprimée de la réserve');
});

test('remettre l’adresse de la source rend la main à la source', () => {
  // Sinon on ne saurait plus si une ligne est un CHOIX de B ou un héritage.
  const m = admin.match(/function adresseActeur\(a, adresses, urls\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'adresseActeur() doit exister');
  assert.match(m[0], /origine: 'saisie'/);
  assert.match(m[0], /origine: 'source'/);
  assert.match(admin, /val === derive \? '' : val/, 'la saisie identique à la source doit s’effacer');
});

test('une adresse de MOTEUR ne peut pas être pré-remplie comme adresse d’enseigne', () => {
  // Coller « bing.com/news?q=Delhaize » dans la colonne d'une enseigne ferait
  // passer une adresse de moteur pour la sienne. On ne pré-remplit donc QUE
  // depuis la voie « flux ».
  const m = admin.match(/function urlsDesSources\(catalogue\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'urlsDesSources() doit exister');
  assert.match(m[0], /s\.voie && s\.voie !== 'flux'/, 'seules les sources en flux doivent pré-remplir');
  assert.ok(estMoteur('https://news.google.com/rss/search?q=x'));
});

test('l’adresse est conservée sur l’appareil, et le panneau le dit', () => {
  // Le panneau publié est une page statique : il n'écrit rien côté serveur.
  // Le dire évite de croire à un enregistrement invisible.
  assert.match(admin, /kazendra\.adressesPromo/, 'la réserve d’adresses a disparu');
  assert.match(admin, /sur cet appareil/, 'le panneau doit dire OÙ l’adresse est conservée');
});

/* --------------------------------------------------- 4. Les exports */

test('l’export CSV porte l’adresse, AVANT le bloc informatif', () => {
  const iAdr = admin.indexOf("'Adresse des promotions'");
  const iInf = admin.indexOf("'--- INFORMATIF ---'");
  assert.ok(iAdr > -1, 'la colonne a disparu de l’export CSV');
  assert.ok(iInf > -1);
  assert.ok(iAdr < iInf,
    'l’adresse de promotions sert au TRAVAIL : elle doit précéder la frontière des informations');
});

test('l’export des adresses est branché, et ne porte que des adresses SAISIES', () => {
  assert.match(admin, /function jsonAdresses\s*\(/, 'la fonction d’export a disparu');
  assert.match(admin, /marcheAdrJson/, 'le bouton d’export des adresses a disparu');
  const m = admin.match(/function jsonAdresses\(\) \{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /adresses\[a\.nom\]/,
    'l’export ne doit porter que les adresses réellement saisies — pas les héritées de la source');
});

/* --------------------------------------------------- 5. Le contrat de B */

test('RÈGLE : l’adresse de promotions ne sert jamais à RELIER un acteur', () => {
  // La liaison reste sur le nom et le site web (règle du 08/10/2026). L'adresse
  // de promotions dit OÙ LIRE, pas QUI EST QUI : s'en servir pour rapprocher
  // deux acteurs ferait entrer un choix de saisie dans la logique du programme.
  const m = module_.match(/export function liaisonActeurs\([\s\S]*?\n\}/);
  assert.ok(m, 'liaisonActeurs doit rester dans public/acteurs.js');
  for (const mot of ['adresse', 'adressesPromo', 'promoAdresse']) {
    assert.ok(!new RegExp(`\\b${mot}\\b`).test(m[0]),
      `« ${mot} » ne doit pas entrer dans la liaison`);
  }
});

test('RÈGLE : la colonne est un champ de travail, pas une information de siège', () => {
  // Elle est modifiable, exportée avec le travail, et ne doit pas rejoindre la
  // liste des champs documentaires — sinon la frontière posée par B se brouille.
  const m = module_.match(/export const CHAMPS_INFORMATIFS = \[([\s\S]*?)\];/);
  assert.ok(m, 'CHAMPS_INFORMATIFS doit rester déclaré');
  assert.ok(!/adresse des promotions|adressesPromo/.test(m[1]),
    'l’adresse de promotions ne doit pas être rangée parmi les informations de siège');
  assert.match(m[1], /'adresse'/,
    'l’adresse du siège, elle, reste une information — les deux ne doivent pas se confondre');
});

test('le récapitulatif et la liste des acteurs sont les deux sections demandées', () => {
  assert.match(admin, /id="mPaysRecap"/, 'le tableau récapitulatif du pays a disparu');
  assert.match(admin, /id="mMarche"/, 'la liste des acteurs par catégorie a disparu');
  assert.match(admin, /Par catégorie|par catégorie/, 'le classement par catégorie doit rester annoncé');
  assert.match(admin, /Marché Euro/, 'l’onglet doit s’appeler « Marché Euro »');
  assert.ok(!/Marché belge/.test(admin), 'l’ancien nom ne doit plus subsister');
});
