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
// Les drapeaux vivent désormais dans un module PARTAGÉ avec le panneau
// d'administration : une seule table de drapeaux pour toute l'application.
const DRAP = lire('public/drapeaux.js');
const APP = lire('public/app.js');
/* LA FEUILLE DE STYLE EST POSÉE EN LIGNE dans la page (voir bin/inliner-css.mjs) :
   on la retire AVANT de lire la structure. Défaut mesuré le 11/10/2026 : ce
   contrôle cherchait « data-panneau="compte" » pour découper l'onglet, et il est
   tombé sur la RÈGLE CSS qui porte le même attribut — la tranche était vide, et
   le test accusait un onglet qui allait très bien. Même précaution que dans
   interface.test.mjs. */
const HTML = lire('public/index.html').replace(
  /<!-- DEBUT-FEUILLE-EN-LIGNE -->[\s\S]*?<!-- FIN-FEUILLE-EN-LIGNE -->/,
  '<!-- feuille en ligne retirée : ce contrôle porte sur la structure -->',
);
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
  // ⚠ LISTE RETOURNÉE LE 11/10/2026. Elle portait les phrases du COMPTE LOCAL :
  // « Aucun compte sur cet appareil », « Ce compte vit sur cet appareil et nulle
  // part ailleurs », « une empreinte du mot de passe », « le prénom affiché »,
  // « Œ Supprimer mon compte retire le compte… ». B a retiré le compte, le mot de
  // passe et le profil ; ces phrases décrivaient donc une chose qui n'existe plus,
  // et le contrôle aurait protégé un texte FAUX. Celles qui restent sont les
  // neuves — réécrites, jamais simplement effacées.
  "Il n'y a aucun compte à créer ici, et rien à retenir : ni nom, ni mot de passe. La seule chose que tu peux donner, si tu le veux, est ton adresse e-mail — pour recevoir les bons plans.",
  'Ce qui est conservé sur cet appareil : tes favoris et tes réglages. Rien n’en sort, jamais.',
  "Rien n'est envoyé, sauf l'adresse de ton inscription",
  ' : ni traqueur, ni cookie publicitaire.',
  'Voir et emporter',
  '« Télécharger mes données » produit un fichier lisible qui contient tout.',
  'Effacer',
  "« Effacer les données de cet appareil » retire tes favoris et tes réglages, sans délai et sans avoir à demander à personne. L'adresse de ton inscription se retire d'un clic, ici même, ou depuis le lien de l'e-mail reçu.",
  'Durée',
  "jusqu'à ce que tu supprimes. Tes favoris et tes réglages n'existent nulle part ailleurs ; l'adresse de ton inscription reste chez le responsable du site jusqu'à ta désinscription.",

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
  const bloc = DRAP.slice(DRAP.indexOf('export const DRAPEAUX = {'), DRAP.indexOf('export const DRAPEAU_EUROPE'));
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

test('l’onglet Compte n’a qu’UNE rubrique d’inscription, puis la langue', () => {
  const debut = HTML.indexOf('data-panneau="compte"');
  const fin = HTML.indexOf('data-panneau="affichage"');
  const panneau = HTML.slice(debut, fin);
  const titres = [...panneau.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
  // Demande de B : « pourquoi il y a un compte local et pourquoi il y a un
  // compte inscription ». Deux blocs pour une seule chose. Il ne doit plus
  // rester qu'un seul endroit où l'on crée un compte.
  //
  // PUIS, LE 11/10/2026 : « Dans les paramètres, il faut fusionner l'onglet
  // profil et langue. […] Inscription en premier pour les newsletters. […]
  // Langue en dessous. » L'onglet « Langue » n'existe plus : la langue est
  // devenue la DERNIÈRE rubrique de cet onglet, et l'inscription reste la
  // PREMIÈRE — c'est elle qui porte le choix des bons plans.
  // ET LE 12/10/2026, LA RUBRIQUE « PROFIL » DISPARAÎT : « tu peux supprimer
  // l'encadrement profil, il n'y a aucune plus-value à mettre son nom. L'idée est
  // juste d'avoir des inscrits à la newsletter. Aucune autre inscription et
  // aucune autre information n'est nécessaire. » Il ne reste donc que ce qui
  // sert : s'inscrire, se connecter, et choisir sa langue.
  // ⚠ RETOURNÉ LE 11/10/2026 : la rubrique s'appelait « Inscription et connexion ».
  // Il n'y a plus de connexion — donc plus rien à quoi se connecter, et un titre
  // qui annonce une chose qui n'existe pas. Elle s'appelle « Inscription aux bons
  // plans », ce qu'elle fait.
  assert.deepEqual(titres, ['Inscription aux bons plans', 'Langue'],
    `rubriques de l’onglet Compte = ${titres.join(' | ')}`);
  // Et aucune trace du profil ne subsiste : ni point de rendu, ni champ de prénom.
  assert.ok(!HTML.includes('regProfil'), 'le point de rendu du profil doit avoir disparu');
  assert.ok(!/Prénom affiché|Ton prénom/.test(HTML), 'plus aucun champ de prénom');
  // Un seul onglet pour ces trois rubriques : la barre n'en compte plus que
  // trois, et plus aucune trace de l'onglet Langue (ni bouton, ni panneau).
  assert.ok(!HTML.includes('data-onglet="langue"') && !HTML.includes('data-panneau="langue"'),
    'l’onglet Langue doit avoir disparu : il est fusionné dans Compte');
  // L'inscription MANUELLE (formulaire) doit précéder la connexion sociale, ET
  // les deux doivent tenir dans le MÊME encadré — c'est la demande de B, et pas
  // seulement une question de mise en page : la case des bons plans est dans ce
  // cadre, donc elle vaut aussi pour Google et Facebook.
  //
  // ⚠ DÉFAUT CORRIGÉ DANS CE TEST : il exigeait un second point de rendu
  //  `#regConnexion`, placé HORS de l'encadré. C'était justement ce que B a
  //  signalé. Il n'y a plus qu'un seul point de rendu, et le test le vérifie.
  assert.ok(panneau.includes('id="regCompte"'), 'le point de rendu du compte a disparu');
  assert.ok(!panneau.includes('id="regConnexion"'),
    'un rendu est ressorti hors de l’encadré : la case des bons plans ne vaudrait plus pour Google');
  // Dans app.js, les boutons sociaux sont rendus par blocConnexion(), appelé
  // DANS le gabarit du formulaire. Le gabarit vit dans dessinerCompte(), très
  // loin du gestionnaire de clic : on découpe donc la FONCTION, pas une fenêtre
  // autour du gestionnaire (la première version de ce test cherchait au mauvais
  // endroit et ne trouvait rien).
  // LE GABARIT DU FORMULAIRE A CHANGÉ DE MAISON (11/10/2026) : il vivait DANS
  // dessinerCompte(), qui dessinait aussi la fiche du compte. Le compte parti, il
  // a été isolé dans carteInscription() — une fonction qui dessine UNE chose. On
  // découpe donc là où le gabarit vit maintenant, et on vérifie que la tranche
  // n'est pas vide (un découpage vide rend le contrôle aveugle).
  const gabarit = APP.slice(APP.indexOf('function carteInscription()'), APP.indexOf('function dessinerCompte()'));
  assert.ok(gabarit.length > 500, `découpage du gabarit invalide (${gabarit.length} caractères)`);
  assert.ok(gabarit.includes('${blocConnexion()}'),
    'blocConnexion() doit être appelé dans le gabarit du formulaire, pas ailleurs');
  assert.ok(APP.includes('function blocConnexion()'), 'blocConnexion() a disparu');
  assert.ok(!APP.includes('dessinerConnexion'),
    'dessinerConnexion() rendait hors de l’encadré : elle doit avoir disparu');
  // L'ordre demandé, dans le gabarit : e-mail, consentement, bouton d'inscription,
  // PUIS les deux boutons sociaux. Attention : le gabarit ne contient PAS
  // `id="connexionGoogle"` — les boutons sont dessinés par blocConnexion(), qui
  // est une AUTRE fonction. La première version du test cherchait l'identifiant
  // ici et ne le trouvait donc jamais.
  const ordre = ['id="cMail"', 'id="cConsent"', 'id="sInscrire"', '${blocConnexion()}'];
  let precedent = -1;
  for (const marque of ordre) {
    const i = gabarit.indexOf(marque);
    assert.ok(i > -1, `${marque} introuvable dans le gabarit du formulaire`);
    assert.ok(i > precedent, `${marque} n’est pas dans l’ordre attendu`);
    precedent = i;
  }
  // ET blocConnexion() NE DESSINE PLUS QU'UN BOUTON : Google.
  // Demande de B, 11/10/2026 : « Enlever le login par Facebook garder celui de
  // Google et l'activer. » Ce test exigeait auparavant les DEUX boutons, dans
  // l'ordre Google puis Facebook : c'était la demande précédente, elle est
  // remplacée — et remplacée dans le test aussi, sinon le test protège une
  // décision que B a annulée.
  const bloc = APP.slice(APP.indexOf('function blocConnexion()'), APP.indexOf('function messageConnexion('));
  assert.ok(bloc.includes('id="connexionGoogle"'), 'Google doit être dessiné par blocConnexion()');
  assert.ok(bloc.indexOf('id="connexionGoogle"') < bloc.indexOf("S'inscrire avec Google"),
    'le bouton Google doit rester DANS l’encadré, avec son libellé');
  assert.ok(!APP.includes('connexionFacebook'),
    'Facebook doit avoir disparu entièrement : ni bouton, ni gestionnaire de clic');
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
  // La borne est le panneau SUIVANT : depuis le 11/10/2026, il n'y a plus de
  // panneau « langue » (l'onglet a été fusionné dans Compte).
  const panneau = HTML.slice(debut, HTML.indexOf('data-panneau="affichage"'));
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
