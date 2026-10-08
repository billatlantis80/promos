/**
 * LA FICHE D'UN ACTEUR, MODIFIABLE À LA MAIN.
 *
 * B (08/10/2026) : « rajouter un petit bouton de modification du champ pour que je
 * puisse l'adapter, compléter moi-même si nécessaire. »
 *
 * CE QUE CE FICHIER PROTÈGE.
 *   1. LA CORRECTION ARRIVE VRAIMENT À L'ÉCRAN. Une colonne modifiable qui
 *      n'enregistre rien est PIRE qu'une colonne en lecture seule : elle fait
 *      croire que c'est fait. On éprouve donc `avecFiche()` — extraite du fichier
 *      LIVRÉ, jamais recopiée — et on vérifie qu'elle est appliquée aux acteurs
 *      avant l'affichage.
 *   2. L'ÉCOUTEUR SURVIT AU REDESSIN. La liste se redessine à chaque lettre
 *      tapée dans la recherche. Un écouteur posé sur le crayon mourrait avec lui,
 *      le crayon resterait cliquable et n'ouvrirait plus rien, sans que RIEN ne
 *      le dise. L'écouteur doit être sur le CONTENEUR.
 *   3. UN CHAMP VIDÉ EST RETIRÉ. Garder une clé vide ferait croire à une
 *      correction existante, et l'export la porterait.
 *   4. LA FRONTIÈRE DE B TIENT TOUJOURS. Les champs de siège se complètent mais
 *      ne DÉCIDENT rien : le module de liaison ne doit jamais lire cette réserve.
 *
 * Lancement : node --test tests/admin-fiche-editable.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');
const acteursJs = fs.readFileSync(path.join(RACINE, 'public', 'acteurs.js'), 'utf8');

function extraire(nom) {
  const m = admin.match(new RegExp(`function ${nom}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `la fonction ${nom} doit exister dans le panneau (elle a peut-être été renommée)`);
  return m[0];
}

// Les DEUX déclarations dont dépend avecFiche : on reconstruit l'ensemble depuis
// le fichier livré, sinon l'épreuve éprouverait une copie qui divergera.
const DECL_CHAMPS = (() => {
  const m = admin.match(/const CHAMPS_FICHE = \[[\s\S]*?\n\];/);
  assert.ok(m, 'la liste des champs modifiables doit exister');
  return m[0];
})();
const avecFiche = new Function(`${DECL_CHAMPS}; ${extraire('avecFiche')}; return avecFiche;`)();

/** Le panneau, avec un faux stockage : on éprouve l'enregistrement pour de vrai,
 *  sans navigateur. Un test qui ne relirait que le texte ne prouverait pas que
 *  le champ vidé DISPARAÎT de la réserve. */
function panneau(stockage = new Map()) {
  const faux = {
    getItem: (k) => (stockage.has(k) ? stockage.get(k) : null),
    setItem: (k, v) => stockage.set(k, String(v)),
  };
  const f = new Function('localStorage',
    `${DECL_CHAMPS}; ${admin.match(/const CLE_FICHES = '[^']+';/)[0]}
     ${extraire('lireFiches')} ${extraire('ecrireFiche')}
     return { lireFiches, ecrireFiche };`)(faux);
  return { ...f, stockage };
}

/* ------------------------------------------- 1. Le crayon et sa fiche */

test('chaque acteur porte un bouton de modification, rattaché à son nom', () => {
  assert.match(admin, /data-editer="\$\{esc\(a\.nom\)\}"/,
    'le bouton doit être rattaché à l’acteur, sinon on ne sait pas quelle fiche on ouvre');
  assert.match(admin, /function boutonEditer\s*\(/, 'le bouton doit venir d’une fonction, pas d’un texte figé');
  assert.match(admin, /function ligneEdition\s*\(/, 'la fiche dépliée doit exister');
  const appels = (admin.match(/\$\{ligneEdition\(a\)\}/g) || []).length;
  assert.equal(appels, 1, 'la fiche doit être fabriquée UNE fois, sous la ligne de l’acteur');
});

test('le crayon est un TRACÉ, jamais une lettre de police', () => {
  // Même règle que les drapeaux. Un caractère « ✎ » dépend de la police du
  // visiteur : sur un poste qui ne le porte pas, on obtient un carré vide à côté
  // de chaque nom — sur cent quarante-neuf lignes, et rien ne le signale.
  const m = admin.match(/const SVG_CRAYON = [\s\S]*?;\n/);
  assert.ok(m, 'le tracé du crayon doit être déclaré');
  assert.match(m[0], /<svg viewBox=/, 'le crayon doit être un SVG');
  assert.match(m[0], /<path d=/, 'et porter son dessin');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(m[0]),
    'aucun caractère exotique : le dessin doit venir du tracé, pas d’une police');
  assert.match(admin, /\$\{SVG_CRAYON\}/, 'le bouton doit réellement utiliser le tracé');
});

test('les colonnes ne sont pas écrasées par la largeur du cadre', () => {
  // DÉFAUT MESURÉ : `table{width:100%}` écrasait dix-sept colonnes dans la largeur
  // du cadre. La colonne du nom tombait à quatre-vingt-dix pixels et « Amazon
  // Belgique (.com.be) » s'étalait sur TROIS lignes — exactement le contraire de
  // la ligne unique demandée.
  const css = (admin.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const regle = css.match(/\.defile table\{([^}]*)\}/);
  assert.ok(regle, 'la règle du tableau dans un conteneur qui défile doit être écrite');
  assert.match(regle[1], /width:\s*auto/, 'le tableau doit garder sa largeur naturelle');
  assert.match(regle[1], /min-width:\s*100%/, 'et remplir le cadre quand il est plus étroit');
});

test('la fiche s’étale sur TOUTE la ligne, et la largeur se calcule', () => {
  // Une largeur écrite en dur deviendrait fausse à la première colonne ajoutée,
  // et la fiche sortirait du tableau sans prévenir.
  assert.match(admin, /colspan="\$\{8 \+ ORDRE_INFORMATIF\.length\}"/,
    'la largeur de la fiche doit être calculée, pas écrite en dur');
});

test('la fiche est cachée au départ, et le crayon la montre', () => {
  const m = extractLigneEdition();
  assert.match(m, /hidden/, 'la fiche doit être repliée par défaut : elle ne doit pas allonger la liste');
  assert.match(m, /data-enregistrer=/, 'la fiche doit porter son bouton d’enregistrement');
  assert.match(m, /data-annuler/, 'et un moyen de renoncer');
});

function extractLigneEdition() {
  const m = admin.match(/function ligneEdition\(a\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'ligneEdition() doit exister');
  return m[0];
}

/* ------------------------------------------- 2. Ce qu'on peut compléter */

test('les champs complétables couvrent le site, le type et le siège', () => {
  for (const champ of ['type', 'domaines', 'adresse', 'telephone', 'email', 'ca',
    'actionnariat', 'positionnement', 'segment', 'distribution', 'remarques']) {
    assert.ok(DECL_CHAMPS.includes(`'${champ}'`), `le champ « ${champ} » doit être complétable`);
  }
});

test('le panneau DIT où la fiche est conservée', () => {
  // Le panneau publié est une page statique : il n'écrit rien côté serveur.
  assert.match(extractLigneEdition(), /sur cet appareil/,
    'la fiche doit dire qu’elle est conservée sur cet appareil, pas dans un serveur invisible');
});

test('le site accepte PLUSIEURS adresses : son champ est à plusieurs lignes', () => {
  // DÉFAUT MESURÉ : un `<input>` d'une seule ligne SUPPRIME les retours à la
  // ligne, en silence. Le libellé promettait « une adresse par ligne » ; deux
  // adresses saisies comme annoncé arrivaient collées bout à bout, et le tableau
  // affichait un lien unique et faux vers « x.be y.be ». Le champ disait une
  // chose et en faisait une autre.
  const m = admin.match(/function blocChampFiche\(cle, libelle, valeur\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'blocChampFiche() doit exister');
  assert.match(m[0], /textarea data-champ=/, 'le champ du site doit être un textarea');
  // Et l'enregistrement doit lire TOUS les champs : ne lire que les `input`
  // ferait disparaître le site de toute fiche enregistrée.
  assert.match(admin, /querySelectorAll\('\[data-champ\]'\)/,
    'l’enregistrement doit lire l’input ET le textarea');
});

/* ------------------------------------------- 3. La correction s'applique */

test('sans fiche, l’acteur est rendu TEL QUEL (aucune invention)', () => {
  const a = { nom: 'Delhaize', type: 'enseigne', domaines: ['delhaize.be'], adresse: 'Rue X' };
  assert.equal(avecFiche(a, {}), a, 'un acteur sans fiche ne doit pas être recopié ni modifié');
  assert.equal(avecFiche(a, { Autre: { type: 'x' } }), a);
});

test('une fiche remplace le champ visé, et seulement celui-là', () => {
  const a = { nom: 'Delhaize', type: 'enseigne', domaines: ['delhaize.be'], adresse: 'Rue X', ca: '3 Md€' };
  const out = avecFiche(a, { Delhaize: { type: 'supermarché' } });
  assert.equal(out.type, 'supermarché');
  assert.deepEqual(out.domaines, a.domaines, 'les champs non touchés gardent la valeur de la base');
  assert.equal(out.ca, '3 Md€');
  assert.equal(a.type, 'enseigne', 'la base ne doit pas être modifiée en place');
});

test('le site saisi se normalise : protocole, barre finale, et plusieurs adresses', () => {
  // Une adresse collée depuis un navigateur arrive avec « https:// » et parfois
  // une barre finale. Les garder ferait un doublon visuel du même site, et le
  // lien affiché dans le tableau se construirait sur « https://https://… ».
  const out = avecFiche({ nom: 'X', domaines: [] },
    { X: { domaines: 'https://www.x.be/\nhttp://y.be, z.be;' } });
  assert.deepEqual(out.domaines, ['www.x.be', 'y.be', 'z.be']);
});

/* ------------------------------------------- 4. L'enregistrement */

test('l’écouteur est sur le CONTENEUR, pas sur le crayon', () => {
  // Quatrième fois que ce projet paie ce piège : la liste est redessinée à
  // chaque lettre tapée dans la recherche.
  assert.match(admin, /zoneMarche\.addEventListener\('click'/,
    'l’écouteur du crayon doit être délégué sur le conteneur de la liste');
  assert.match(admin, /closest\('button\[data-editer\]'\)/, 'le clic doit viser le crayon, pas son glyphe');
  assert.match(admin, /ecrireFiche\(ligne\.dataset\.edition, champs\)/,
    'la saisie doit réellement être enregistrée');
  assert.match(admin, /dessinerMarche\(\);/, 'l’écran doit se redessiner après enregistrement');
});

test('une fiche enregistrée se relit, et une fiche vidée DISPARAÎT', () => {
  const { ecrireFiche, lireFiches } = panneau();
  ecrireFiche('Delhaize', { type: 'supermarché', adresse: 'Rue X', email: '' });
  assert.deepEqual(lireFiches().Delhaize, { type: 'supermarché', adresse: 'Rue X' },
    'un champ vide ne doit pas être conservé');

  // Vider TOUS les champs retire la fiche : garder une fiche vide ferait croire
  // à une correction, et l'export la porterait.
  ecrireFiche('Delhaize', { type: '', adresse: '  ' });
  assert.ok(!('Delhaize' in lireFiches()), 'une fiche entièrement vidée doit disparaître');

  // Les autres fiches ne doivent pas être emportées au passage.
  ecrireFiche('Colruyt', { type: 'supermarché' });
  ecrireFiche('Lidl', { type: 'supermarché' });
  ecrireFiche('Lidl', { type: '' });
  assert.deepEqual(Object.keys(lireFiches()), ['Colruyt']);
});

test('une réserve abîmée ne casse pas le panneau', () => {
  const stockage = new Map([['kazendra.fiches', '{ceci n’est pas du JSON']]);
  const { lireFiches } = panneau(stockage);
  assert.deepEqual(lireFiches(), {}, 'une réserve illisible doit rendre une réserve vide, pas lever');
});

test('UNE SEULE réserve pour le panneau entier', () => {
  // Deux clés de stockage finiraient par se contredire : on ne saurait plus
  // laquelle fait foi.
  const cles = admin.match(/kazendra\.fiches/g) || [];
  assert.equal(new Set(cles).size, 1);
});

/* ------------------------------------------- 5. La frontière de B tient */

test('ce qui se complète s’AFFICHE, mais ne RELIE jamais un acteur', () => {
  // Règle de B (08/10/2026) : les informations de siège doivent exister dans la
  // base et ne jamais servir à la programmation. La liaison vit dans le module
  // partagé ; s'il lisait cette réserve, la règle serait cassée en silence.
  assert.ok(!acteursJs.includes('kazendra.fiches'),
    'le module de liaison ne doit pas connaître cette réserve : la liaison reste sur le nom et le site web');
  assert.match(admin, /avecFiche\(a, fiches\)/,
    'la fiche doit être appliquée à l’affichage, en amont');
});

test('la correction est appliquée à l’écran, à la recherche ET aux plans', () => {
  const appels = (admin.match(/avecFiche\(a, fiches\)/g) || []).length;
  assert.ok(appels >= 3,
    `la fiche doit s'appliquer à la liste, au plan de régularisation et à l'export (trouvé ${appels})`);
});

/* ------------------------------------------- 6. L'export */

test('l’export des fiches existe, est branché, et dit ce que chaque champ change', () => {
  assert.match(admin, /function jsonFiches\s*\(/, 'la fonction d’export a disparu');
  assert.match(admin, /marcheFichesJson/, 'le bouton d’export des fiches a disparu');
  const m = admin.match(/function jsonFiches\(\) \{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /le programme ne s’en sert jamais/,
    'le fichier exporté doit redire que les champs de siège ne décident rien');
  // Et il est SÉPARÉ de celui des adresses : l’adresse de promotions pilote la
  // collecte, les champs de la fiche documentent. Les mélanger ferait croire que
  // tout pilote.
  const iAdr = admin.indexOf('function jsonAdresses');
  const iFic = admin.indexOf('function jsonFiches');
  assert.ok(iAdr > -1 && iFic > -1 && iAdr !== iFic);
});
