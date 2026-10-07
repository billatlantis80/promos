/**
 * Contrôle de l'inscription et de l'envoi vers le tableau de B.
 * =============================================================================
 *
 * CE QUE CE FICHIER EMPÊCHE
 *
 * 1. UNE ADRESSE FAUTIVE PARTIE SANS BRUIT. Une faute de frappe dans une adresse
 *    est un contact perdu que PERSONNE ne remarquera : la page dira « envoyée »,
 *    la feuille contiendra une ligne inutilisable, et l'inscrit ne recevra
 *    jamais rien. Le contrôle de forme est donc vérifié ici, sur des cas réels —
 *    y compris ceux qui ont l'AIR valides.
 *
 * 2. UN ENVOI VERS RIEN. Tant que l'adresse du tableau n'est pas renseignée, il
 *    n'y a personne pour recevoir : la fonction doit le DIRE (code
 *    « non-configure »), pas renvoyer un succès. Un succès faux ferait croire à
 *    une inscription qui n'a pas eu lieu.
 *
 * 3. LE RETOUR À L'ANCIEN FORMULAIRE. Il demandait un NOM D'UTILISATEUR, pas une
 *    adresse : sans adresse, aucune newsletter n'est possible. Le champ doit
 *    rester un champ e-mail.
 *
 * Lancement : node --test tests/inscription.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  adresseValide, tableauConfigure, envoyerInscription, URL_TABLEAU,
} from '../public/inscription.js';
import { verifierNom } from '../public/compte.js';

const lire = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const APP = lire('public/app.js');
const HTML = lire('public/index.html');
const LANGUES_SRC = lire('public/langues.js');

test('les adresses manifestement fausses sont refusées', () => {
  const mauvaises = [
    '', '   ', 'marie', 'marie@', '@exemple.be', 'marie@exemple',
    'marie@@exemple.be', 'marie exemple@mail.be', 'marie@exemple .be',
    'marie@exemple.b', 'a@b.c',
  ];
  for (const m of mauvaises) {
    assert.equal(adresseValide(m), false, `« ${m} » aurait dû être refusée`);
  }
});

test('les adresses réelles sont acceptées, y compris celles des 9 langues', () => {
  const bonnes = [
    'marie@exemple.be', 'jean.dupont@mail.fr', 'a+bonsplans@gmail.com',
    'prenom.nom@sous.domaine.org', 'anna@telia.se', 'ján@pošta.sk',
    'MARIE@EXEMPLE.BE', "o'brien@exemple.ie", 'nom-avec-tiret@mon-domaine.be',
  ];
  for (const b of bonnes) {
    assert.equal(adresseValide(b), true, `« ${b} » aurait dû être acceptée`);
  }
});

test('sans adresse de tableau, l’envoi le DIT au lieu de réussir', async () => {
  assert.equal(URL_TABLEAU, '', 'ce test suppose un tableau non branché');
  assert.equal(tableauConfigure(), false);
  const r = await envoyerInscription({ email: 'marie@exemple.be' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'non-configure');
});

test('le formulaire demande une ADRESSE, plus un nom d’utilisateur', () => {
  assert.ok(/id="cMail"[^>]*type="email"/.test(APP),
    'le champ d’inscription doit être un champ e-mail (id="cMail" type="email")');
  assert.ok(APP.includes('id="cConsent"'), 'la case de consentement a disparu');
  // Le prénom FACULTATIF a été retiré le 08/10/2026 : un champ qui peut rester
  // vide ne servait ni à inscrire, ni à écrire. Ce test exigeait l'INVERSE
  // avant — il verrouillait donc le champ que B a fait disparaître.
  assert.ok(!APP.includes('cPrenom'),
    'le champ prénom facultatif est revenu dans le formulaire d’inscription');
  // Le nom d'utilisateur n'a plus de raison d'être : c'est l'adresse qui
  // identifie l'inscrit, et c'est elle qu'on envoie.
  assert.ok(!APP.includes('id="cNom"'),
    'l’ancien champ « nom d’utilisateur » est revenu : aucune adresse ne serait collectée');
});

test('aucune inscription n’est envoyée sans consentement explicite', () => {
  // On vérifie l'ORDRE des contrôles dans le gestionnaire : l'adresse, puis le
  // consentement, AVANT tout envoi. Un envoi sans consentement est à la fois une
  // faute vis-à-vis de l'inscrit et un problème légal.
  const corps = APP.slice(APP.indexOf("closest('#creerCompte')"));
  const iAdresse = corps.indexOf('adresseValide(mail)');
  const iConsent = corps.indexOf('consentement');
  const iEnvoi = corps.indexOf('envoyerInscription(');
  assert.ok(iAdresse > -1 && iConsent > -1 && iEnvoi > -1, 'contrôles introuvables');
  assert.ok(iAdresse < iEnvoi, 'l’adresse doit être vérifiée AVANT l’envoi');
  assert.ok(iConsent < iEnvoi, 'le consentement doit être vérifié AVANT l’envoi');
});

test('l’annonce parle de l’e-mail de confirmation, jamais d’un compte activé', () => {
  // Le tableau Google ne laisse pas la page lire sa réponse, et la confirmation
  // se fait par e-mail : l'application ne peut donc RIEN affirmer sur
  // l'activation. La première version de ce test exigeait le mot « envoyée » ;
  // depuis que la confirmation existe, le message doit annoncer l'E-MAIL, et
  // toujours pas l'activation.
  assert.ok(/Un e-mail de confirmation part vers/.test(APP),
    'l’annonce doit parler de l’e-mail de confirmation');
  const interdits = [
    /t\('Ton compte est activé/,
    /t\("Ton compte est activé/,
    /t\('Tu es inscrit/,
    /t\("Tu es inscrit/,
    /t\('Inscription confirmée/,
  ];
  for (const motif of interdits) {
    assert.ok(!motif.test(APP), `l’annonce prétend à tort que le compte est activé (${motif})`);
  }
});

test('les nouvelles phrases de l’inscription existent dans les 9 langues', () => {
  const SRC = LANGUES_SRC.replace(/\\"/g, '"');
  const phrases = [
    "Cette adresse e-mail n'est pas valide.",
    "Coche la case pour recevoir les bons plans : sans ton accord, on ne t'inscrit pas.",
    "Ton compte est créé sur cet appareil. Le tableau n'est pas encore branché : ton adresse n'a pas été envoyée.",
    "Un e-mail de confirmation part vers {n}. Ouvre-le et clique le lien pour activer ton compte.",
    "L'envoi n'a pas pu partir. Vérifie ta connexion, puis réessaie.",
  ];
  for (const p of phrases) {
    const n = SRC.split('\n').filter((l) => l.includes(`'${p}':`) || l.includes(`"${p}":`)).length;
    assert.equal(n, 9, `${p.slice(0, 50)}… : présente ${n} fois, attendu 9`);
  }
});

test('une ADRESSE E-MAIL est un identifiant de compte valable', () => {
  // ⚠ C'est LE défaut trouvé en exerçant le formulaire : la règle d'origine
  // n'admettait pas le caractère « @ », donc la création du compte échouait
  // TOUJOURS avec une adresse — et rien n'était jamais envoyé au tableau.
  // Le formulaire aurait dit « envoyée », le compte n'aurait pas existé.
  const bonnes = ['marie@exemple.be', 'jean.dupont@mail.fr', 'a+bonsplans@gmail.com', 'anna@telia.se'];
  for (const m of bonnes) {
    const r = verifierNom(m);
    assert.equal(r.ok, true, `« ${m} » doit être acceptée comme identifiant (${r.message || ''})`);
  }
  // Une adresse est rangée en minuscules : deux casses = deux inscriptions =
  // deux newsletters pour la même personne.
  assert.equal(verifierNom('Marie@Exemple.BE').valeur, 'marie@exemple.be');
  // Une adresse mal formée est refusée, avec le message déjà traduit.
  //  Attention à ne PAS mettre « marie » ici : sans « @ », c'est un NOM, et un
  //  nom valable — la première version de ce test se trompait là-dessus.
  for (const m of ['marie@', '@exemple.be', 'marie@exemple', 'marie @exemple.be']) {
    assert.equal(verifierNom(m).ok, false, `« ${m} » ne doit pas passer`);
  }
  // Les anciens comptes à NOM continuent de fonctionner à l'identique.
  assert.equal(verifierNom('marie').ok, true);
  assert.equal(verifierNom('marie dupont').ok, false);
});

test('le récepteur envoie un e-mail de confirmation et active le compte', () => {
  const gs = lire('outils/tableau-inscription.gs');
  // L'e-mail de confirmation est la demande explicite de B : « il faudra envoyer
  // un mail de confirmation pour activer le compte ».
  assert.ok(/MailApp\.sendEmail/.test(gs), 'le récepteur doit envoyer l’e-mail de confirmation');
  // doGet = le clic sur le lien de l'e-mail. Sans lui, le lien ne ferait rien.
  assert.ok(/function doGet/.test(gs), 'le lien de confirmation doit avoir un traitement (doGet)');
  assert.ok(/confirmé/.test(gs), 'le clic doit faire passer la ligne en « confirmé »');
  assert.ok(/Jeton/.test(gs), 'la ligne doit porter un jeton : c’est le seul secret du lien');
  // Un jeton devinable permettrait de confirmer l'inscription de quelqu'un d'autre.
  assert.ok(/getUuid\(\)/.test(gs), 'le jeton doit être tiré au hasard, pas devinable');
  // Le renvoi : sans lui, un e-mail perdu bloque l'inscrit pour toujours.
  assert.ok(/renvoye/.test(gs), 'le récepteur doit savoir RENVOYER l’e-mail');
  // Les 9 langues pour le message envoyé.
  for (const l of ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']) {
    assert.ok(new RegExp('\\n  ' + l + ': \\{').test(gs), `message d’e-mail manquant en « ${l} »`);
  }
});

test('l’application annonce la confirmation et propose de renvoyer', () => {
  assert.ok(/Un e-mail de confirmation part vers \{n\}/.test(APP),
    'après l’inscription, l’application doit annoncer l’e-mail de confirmation');
  assert.ok(APP.includes('id="renvoyerConfirmation"'),
    'la fiche du compte doit offrir un renvoi de l’e-mail');
  assert.ok(/renvoyerConfirmation/.test(APP.slice(APP.indexOf("addEventListener('click'"))),
    'le bouton de renvoi doit être branché, pas seulement dessiné');
  assert.ok(/en attente de confirmation/.test(APP),
    'le statut affiché doit dire « en attente » : la page ne peut pas savoir si le lien a été cliqué');
});

test('le statut local d’une inscription est « en attente », jamais « confirmé »', () => {
  // La page ne peut pas lire la réponse du tableau Google : prétendre savoir que
  // le compte est activé serait un mensonge. Seule la feuille fait foi.
  const src = lire('public/inscription.js');
  assert.ok(/statut: 'en-attente'/.test(src),
    'l’inscription locale doit être rangée « en-attente »');
  assert.ok(!/statut: 'confirm/.test(src),
    'la page ne doit jamais se déclarer « confirmé » elle-même');
});

test('le récepteur Google refuse les doublons et vérifie l’adresse', () => {
  const gs = lire('outils/tableau-inscription.gs');
  assert.ok(/ligneDe\(/.test(gs), 'le récepteur doit savoir retrouver une adresse déjà présente (refus des doublons)');
  assert.ok(/LockService/.test(gs),
    'le récepteur doit verrouiller l’écriture : sans cela, deux envois simultanés en perdent un');
  assert.ok(/\^\[\^\\s@\]\+@/.test(gs), 'le récepteur doit vérifier la forme de l’adresse');
  assert.ok(/d\.email/.test(gs), 'le récepteur doit lire le champ « email »');
});

test('le désistement se fait en un clic, comme la case le promet', () => {
  // La case cochée sur le site annonce, dans les neuf langues : « Désinscription
  // en un clic. » Or l'e-mail de confirmation ne portait AUCUN lien de
  // désinscription : on promettait un geste qui n'existait pas. Ce test tient
  // les trois morceaux ensemble — sans le lien, la promesse est un mensonge ;
  // sans le traitement, le lien ne fait rien ; sans le statut, l'inscrit reste
  // dans la liste et reçoit quand même.
  const gs = lire('outils/tableau-inscription.gs');

  // 1. Le lien est dans le corps de l'e-mail, donc dans CHAQUE message reçu.
  assert.ok(/lienStop/.test(gs),
    'l’e-mail de confirmation doit porter un lien de désinscription');
  assert.ok(/desinscrire=' \+ encodeURIComponent/.test(gs),
    'le lien de désinscription doit porter le jeton, sinon il désinscrirait n’importe qui');
  assert.ok(/t\.desinscrire/.test(gs),
    'le libellé du lien doit venir des textes traduits, pas d’une chaîne en clair');

  // 2. Le clic est traité : sans cela, le lien mène à la page d'activation.
  assert.ok(/desinscrire\) \|\| ''/.test(gs) || /\.desinscrire \|\| ''/.test(gs),
    'doGet doit lire le paramètre « desinscrire »');
  assert.ok(/'désinscrit'/.test(gs),
    'le clic doit ranger la ligne en « désinscrit »');

  // 3. La ligne n'est pas supprimée : elle est la trace de l'accord ET de son
  //    retrait. Supprimée, un nouvel envoi recréerait la ligne et réinscrirait
  //    quelqu'un qui n'a rien redemandé.
  assert.ok(!/deleteRow|deleteRows/.test(gs),
    'la désinscription ne doit pas supprimer la ligne, seulement changer son statut');

  // 4. Les trois phrases existent dans les neuf langues.
  for (const cle of ['desinscrire:', 'pageStopTitre:', 'pageStop:']) {
    const n = (gs.match(new RegExp(cle, 'g')) || []).length;
    assert.equal(n, 9, `« ${cle} » doit être traduit dans les 9 langues, or ${n}`);
  }
});

test('le site charge le module d’inscription', () => {
  assert.ok(/from '\.\/inscription\.js'/.test(APP),
    'app.js doit importer inscription.js');
  const html = HTML;
  assert.ok(!/KAZENDRA_TABLEAU_URL\s*=/.test(html),
    'l’adresse du tableau se règle dans inscription.js, pas dans index.html');
});

test('le prénom facultatif a disparu PARTOUT — pas seulement à l’écran', () => {
  // Retirer un champ de l'écran ne suffit pas : s'il reste une colonne dans le
  // tableau, une valeur dans le message envoyé, ou une traduction dans les neuf
  // langues, la chose continue d'exister quelque part — et quelqu'un la
  // rebranchera un jour en croyant qu'elle sert.
  const INS = lire('public/inscription.js');
  const GS = lire('outils/tableau-inscription.gs');

  // 1. Rien dans ce que la page envoie.
  assert.ok(!/prenom/i.test(INS),
    'inscription.js ne doit plus transporter de prénom (champ de formulaire, envoi ou mémoire locale)');

  // 2. Rien dans le tableau : ni colonne, ni case dans la ligne écrite.
  assert.ok(!/Prénom/.test(GS.split('/* PAS DE COLONNE')[0]),
    'les titres de colonnes du tableau ne doivent plus contenir « Prénom »');
  assert.ok(!/d\.prenom/.test(GS),
    'le récepteur ne doit plus lire un champ « prenom » que personne n’envoie');
  assert.ok(!/COL\.PRENOM/.test(GS),
    'plus aucune colonne PRENOM : les rangs des colonnes suivantes ont changé, un reste les décalerait');

  // 3. Rien dans les dictionnaires : une clé que plus personne n'appelle est une
  //    traduction figée que quelqu'un finira par « corriger » sans comprendre.
  const n = (LANGUES_SRC.match(/'Prénom \(facultatif\)':/g) || []).length;
  assert.equal(n, 0,
    `« Prénom (facultatif) » doit être retiré des 9 dictionnaires, or il en reste ${n}`);

  // 4. La colonne retirée ne doit pas laisser un trou : la ligne écrite compte
  //    autant de cases que le tableau a de colonnes. Le découpage respecte les
  //    parenthèses : « slice(0, 5) » contient une virgule qui n'est PAS une
  //    séparation de cases — compter naïvement donnait un faux décalage.
  const cases = (txt) => {
    // La VIRGULE FINALE de JavaScript (« jeton, '', ») n'est pas une case de
    // plus : ce test comptait 9 cases pour 8 colonnes à cause d'elle. On
    // l'enlève avant de compter.
    txt = txt.replace(/,\s*$/, '');
    let n = 0, prof = 0, q = null, dedans = false;
    for (const c of txt) {
      if (q) { if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; dedans = true; continue; }
      if (c === '(' || c === '[') prof++;
      else if (c === ')' || c === ']') prof--;
      else if (c === ',' && prof === 0) n++;
      else if (!/\s/.test(c)) dedans = true;
    }
    return dedans ? n + 1 : 0;
  };
  const titres = cases(GS.match(/var TITRES = \[([^\]]+)\]/)[1]);
  const ligne = cases(GS.match(/feuille\.appendRow\(\[([\s\S]*?)\]\);/)[1]);
  assert.equal(ligne, titres,
    `la ligne écrite a ${ligne} cases pour ${titres} colonnes : le tableau serait décalé`);
});
