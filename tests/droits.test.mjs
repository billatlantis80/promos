/**
 * Contrôle des textes de l'onglet INFORMATIONS et du drapeau allemand.
 * =============================================================================
 *
 * CE QUE CE FICHIER EMPÊCHE
 *
 * 1. LE DÉFAUT LE PLUS SILENCIEUX DU LOT : une phrase écrite EN CLAIR dans un
 *    gabarit JavaScript. Elle ne plante pas, elle ne manque dans aucun
 *    dictionnaire — elle s'affiche simplement en français au milieu d'une
 *    interface allemande ou suédoise, et personne ne s'en aperçoit avant de
 *    regarder l'écran dans cette langue. C'est exactement ce qui est arrivé au
 *    bloc « Tes données, tes droits » : les neuf traductions existaient, elles
 *    n'étaient pas BRANCHÉES. Un inventaire de clés ne pouvait pas le voir : les
 *    clés étaient là, c'est le code qui ne les appelait pas.
 *
 * 2. un drapeau faux. Le drapeau allemand affichait noir / BLANC / or — la
 *    bande du milieu restait le fond. Trois rectangles semblaient pourtant
 *    présents à la relecture.
 *
 * Lancement : node --test tests/droits.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const APP = lire('public/app.js');
const HTML = lire('public/index.html');
const LANGUES_SRC = lire('public/langues.js');

const LANGUES = ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv'];

/** Le corps de la fonction `blocDroits` — délimité par ses accolades. */
function corpsBlocDroits() {
  const debut = APP.indexOf('function blocDroits()');
  assert.ok(debut > -1, 'blocDroits() est introuvable dans public/app.js');
  let i = APP.indexOf('{', debut);
  let profondeur = 0;
  for (let j = i; j < APP.length; j += 1) {
    if (APP[j] === '{') profondeur += 1;
    else if (APP[j] === '}') {
      profondeur -= 1;
      if (profondeur === 0) return APP.slice(i, j + 1);
    }
  }
  throw new Error('accolade fermante de blocDroits() introuvable');
}

/* Toutes les phrases visibles de ce bloc, telles qu'elles doivent apparaître
   dans les dictionnaires. Une phrase ABSENTE de cette liste ne serait pas
   contrôlée — la liste est donc le cœur du test, pas un détail. */
const PHRASES = [
  'Aucun compte sur cet appareil',
  "Ce compte ne crée rien en ligne : il n'y a pas de serveur. Il protège l'accès à l'application (favoris, réglages) sur ce téléphone, et donne un nom au porteur des données.",
  "Ce qu'il ne fera jamais, pour que tu ne l'attendes pas : retrouver tes favoris sur un autre appareil, ni te rendre un mot de passe oublié. Le mot de passe n'est pas enregistré — seulement une empreinte calculée à partir de lui.",
  "Ce qui est conservé sur cet appareil : le nom d'utilisateur, une empreinte du mot de passe (jamais le mot de passe), le prénom affiché, tes favoris et tes réglages.",
  "Rien n'est envoyé",
  " : il n'y a ni serveur, ni traqueur, ni cookie publicitaire.",
  'Voir et emporter',
  '« Télécharger mes données » produit un fichier lisible qui contient tout.',
  'Effacer',
  '« Supprimer mon compte » retire le compte et les données de cet appareil, sans délai et sans avoir à demander à personne.',
  'Durée',
  "jusqu'à ce que tu supprimes. Aucune copie n'existe ailleurs.",
];

test('chaque phrase du bloc des droits passe par le moteur de traduction', () => {
  const corps = corpsBlocDroits();
  const oubliees = [];
  for (const phrase of PHRASES) {
    // La phrase doit apparaître DANS un appel t(...) — guillemets simples ou
    // doubles. On cherche la phrase telle qu'elle est écrite dans le dict.
    const dansT = corps.includes(`t('${phrase}')`) || corps.includes(`t("${phrase}")`);
    if (!dansT) oubliees.push(phrase);
  }
  assert.deepEqual(oubliees, [],
    `Phrase(s) écrite(s) en clair, donc affichée(s) en français quelle que soit la langue :\n  - ` +
    oubliees.map((p) => p.slice(0, 70)).join('\n  - '));
});

test('aucune phrase du bloc des droits n’est restée en clair hors d’un t()', () => {
  // Contre-épreuve du test précédent : on retire tous les appels t(...) du corps
  // et on vérifie qu'il ne reste AUCUN texte français. Sans cela, une phrase
  // ajoutée plus tard échapperait à la liste PHRASES sans être vue.
  const corps = corpsBlocDroits();
  const sansT = corps.replace(/t\((?:'[^']*'|"[^"]*")\)/g, ' ');
  // On ne garde que le TEXTE des gabarits : on écarte les lignes de code (elles
  // contiennent une interpolation, un accent grave ou une déclaration). La
  // première version de ce filtre accusait la ligne
  // « const titre = f ? '' : `<h4>${esc( )}</h4>`; » — du code, pas du texte.
  const phrasesEnClair = sansT
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .filter((l) => !l.includes('${') && !l.includes('`'))
    .filter((l) => !/^(const|let|var|return|function|\})\b/.test(l))
    .filter((l) => /[a-zà-ÿ]{3,}\s+[a-zà-ÿ]{3,}/i.test(l))
    .filter((l) => /[àâçéèêëîïôûùüÿœ]/.test(l));
  assert.deepEqual(phrasesEnClair, [],
    'Texte français resté en clair dans blocDroits() :\n  ' + phrasesEnClair.join('\n  '));
});

/* Le fichier source écrit les apostrophes ÉCHAPPÉES (« n\'y a ») à l'intérieur
   des chaînes à guillemets simples. Chercher la phrase telle qu'elle s'affiche
   ne la trouvait donc jamais — le test accusait une clé pourtant présente.
   On lit sur une version où l'échappement est résolu. */
const SRC = LANGUES_SRC.replace(/\\'/g, "'");
const lignesDeLaCle = (phrase) => SRC
  .split('\n')
  .filter((l) => l.includes(`'${phrase}':`) || l.includes(`"${phrase}":`));

test('les phrases du bloc des droits sont réellement traduites, dans les 9 langues', () => {
  for (const phrase of PHRASES) {
    // Une clé déclarée dans les NEUF dictionnaires. Une phrase présente une
    // seule fois serait une clé oubliée dans huit langues — le moteur
    // retomberait alors silencieusement sur le français.
    const n = lignesDeLaCle(phrase).length;
    assert.equal(n, LANGUES.length,
      `${phrase.slice(0, 55)}… : déclarée ${n} fois, attendu ${LANGUES.length}`);
  }
});

test('chaque phrase du bloc des droits est écrite DIFFÉREMMENT en anglais', () => {
  // Contre-épreuve : une clé qui vaudrait le texte français dans TOUTES les
  // langues passerait le test de présence. On exige au moins une langue dont la
  // valeur DIFFÈRE du français.
  for (const phrase of PHRASES) {
    const valeurs = lignesDeLaCle(phrase)
      .map((l) => l.slice(l.indexOf(':', l.indexOf(`'${phrase}'`) + phrase.length)) || '')
      .map((v) => v.replace(/^:/, '').trim().replace(/,$/, '').trim())
      .map((v) => v.replace(/^['"]|['"]$/g, ''));
    assert.ok(valeurs.length, `clé absente des dictionnaires : ${phrase.slice(0, 55)}`);
    assert.ok(valeurs.some((v) => v !== phrase),
      `aucune traduction : la clé vaut le français partout — ${phrase.slice(0, 55)}`);
  }
});

test('le drapeau allemand porte bien ses TROIS bandes : noir, rouge, or', () => {
  const bloc = APP.slice(APP.indexOf('const DRAPEAUX = {'), APP.indexOf('const DRAPEAU_EUROPE'));
  const de = bloc.slice(bloc.indexOf('\n  de:'), bloc.indexOf('\n  en:'));
  assert.ok(de.length > 20, 'entrée « de » introuvable dans DRAPEAUX');
  // Le défaut historique, mot pour mot : la bande du MILIEU restait le fond
  // BLANC, et le rouge était absent. Le contrôle le plus direct est donc
  // celui-ci — le drapeau allemand ne contient AUCUN blanc.
  assert.ok(!/#ffffff/i.test(de),
    'le drapeau allemand contient du blanc : la bande du milieu est encore le fond');
  assert.match(de, /#DD0000/i, 'la bande ROUGE du drapeau allemand est absente');
  assert.match(de, /#000000/i, 'la bande NOIRE du drapeau allemand est absente');
  assert.match(de, /#FFCE00/i, 'la bande OR du drapeau allemand est absente');
  // Trois rectangles, pas deux ni quatre : une bande oubliée ou dupliquée.
  assert.equal((de.match(/<rect/g) || []).length, 3,
    `le drapeau allemand compte ${(de.match(/<rect/g) || []).length} rectangles, attendu 3`);
});

test('l’onglet Compte n’a qu’UNE rubrique de compte : inscription puis connexion', () => {
  const debut = HTML.indexOf('data-panneau="compte"');
  const fin = HTML.indexOf('data-panneau="langue"');
  const panneau = HTML.slice(debut, fin);
  const titres = [...panneau.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
  // Demande de B : « pourquoi il y a un compte local et pourquoi il y a un
  // compte inscription ». Deux blocs pour une seule chose. Il ne doit plus
  // rester qu'un seul endroit où l'on crée un compte.
  assert.deepEqual(titres, ['Inscription et connexion', 'Profil'],
    `rubriques de l’onglet Compte = ${titres.join(' | ')}`);
  // L'inscription MANUELLE (formulaire) doit précéder la connexion sociale.
  const positionChamp = panneau.indexOf('id="regCompte"');
  const positionSocial = panneau.indexOf('id="regConnexion"');
  assert.ok(positionChamp > -1 && positionSocial > -1,
    'les deux points d’entrée (#regCompte, #regConnexion) doivent être présents');
  assert.ok(positionChamp < positionSocial,
    'le formulaire d’inscription doit venir AVANT les boutons Google/Facebook');
});

test('l’onglet Informations commence par le point de contact', () => {
  const debut = HTML.indexOf('data-panneau="infos"');
  const panneau = HTML.slice(debut, HTML.indexOf('</section>\n</section>', debut));
  const titres = [...panneau.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.ok(titres.length >= 4, `trop peu de sections dans Informations : ${titres.join(' | ')}`);
  assert.equal(titres[0], 'Point de contact', `première section = « ${titres[0]} »`);
  assert.ok(titres.includes('Tes données, tes droits'),
    'le bloc des droits doit être dans Informations');
});

test('les textes déplacés ne sont plus dans l’onglet Compte', () => {
  const debut = HTML.indexOf('data-panneau="compte"');
  const panneau = HTML.slice(debut, HTML.indexOf('data-panneau="langue"'));
  assert.ok(!panneau.includes('Tes données, tes droits'),
    '« Tes données, tes droits » est encore dans l’onglet Compte');
  // Le bloc est construit en JS : on vérifie aussi qu'il n'est plus appelé là.
  //
  // ⚠ DÉFAUT CORRIGÉ DANS CE TEST. Il découpait le corps par
  //   slice(indexOf('function dessinerCompte()'), indexOf('function dessinerDroits()'))
  //  — or dessinerDroits() est défini AVANT dessinerCompte() dans le fichier.
  //  La fin du découpage tombait donc avant le début : la tranche était VIDE, et
  //  l'assertion ne pouvait rien voir. Le test passait quoi qu'il arrive.
  //  C'est la contre-épreuve qui l'a révélé : en remettant blocDroits() dans
  //  dessinerCompte(), le test ne bronchait pas. On découpe maintenant jusqu'à la
  //  fonction SUIVANTE, et on vérifie que la tranche n'est pas vide.
  const dCompte = APP.slice(APP.indexOf('function dessinerCompte()'), APP.indexOf('function exporterDonnees()'));
  assert.ok(dCompte.length > 200 && dCompte.includes('regCompte'),
    `découpage de dessinerCompte() invalide (${dCompte.length} caractères) — le contrôle serait aveugle`);
  assert.ok(!dCompte.includes('blocDroits()'),
    'dessinerCompte() appelle encore blocDroits() : les textes reviendraient dans l’onglet Compte');
});

test('la phrase sur les liens affiliés n’existe plus qu’à UN seul endroit', () => {
  const dansHtml = (HTML.match(/data-i18n="Les liens vers les marchands peuvent être affiliés/g) || []).length;
  assert.equal(dansHtml, 1, `la phrase affiliée apparaît ${dansHtml} fois dans index.html`);
  const dDroits = corpsBlocDroits();
  assert.ok(!dDroits.includes('affiliés'),
    'la phrase sur l’affiliation est revenue dans le bloc des droits : elle serait en double');
});
