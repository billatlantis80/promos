/**
 * LE RELAIS DE KAZENDRA — le récepteur, à coller dans Google Apps Script.
 * =============================================================================
 *
 * Ce code vit dans VOTRE compte Google. Il reçoit trois choses venues du site,
 * les écrit dans une feuille de calcul, et rend un RAPPORT chiffré au panneau
 * d'administration. Aucun tiers, aucune clé d'API, aucun coût.
 *
 * La marche à suivre est dans INSCRIPTION.md.
 *
 * ---------------------------------------------------------------------------
 * CE QUI A CHANGÉ LE 12/10/2026 — et pourquoi (demande de B : « connecte les
 * tuyaux afin que je puisse voir d'où viennent les utilisateurs », et « au
 * niveau des affiliations, il faut que je voie combien j'ai pu gagner grâce aux
 * redirections »)
 *
 * Avant, ce script ne connaissait QUE les inscriptions. Les visites, elles,
 * partaient bien du site… vers une adresse que personne n'avait jamais
 * renseignée, et les clics vers les marchands ne partaient pas du tout. Trois
 * tuyaux annoncés, un seul branché.
 *
 * Maintenant il reçoit TROIS familles de relevés, par le même tuyau :
 *
 *   type=visite    une ouverture du site (une par session, pas une par
 *                  rafraîchissement) : pays consulté, langue, porte d'entrée,
 *                  provenance, appareil, fuseau du visiteur.
 *   type=clic      une sortie vers un marchand — la REDIRECTION. C'est elle
 *                  qui porte l'affiliation : sans son compte, « combien j'ai
 *                  gagné » n'a aucune source.
 *   type=partage   un partage d'une offre.
 *   (aucun type)   une inscription à la newsletter — le comportement d'avant,
 *                  inchangé.
 *
 * Et il RÉPOND, sur demande et avec la clé, un rapport agrégé : jour par jour,
 * par provenance, par appareil, par fuseau, et les redirections par marchand.
 * C'est ce rapport que lit le panneau d'administration (onglet Trafic et
 * onglet Affiliation).
 *
 * ---------------------------------------------------------------------------
 * DEUX RÈGLES QUI NE SE NÉGOCIENT PAS
 *
 * 1. LE JOURNAL NE CONTIENT AUCUNE DONNÉE PERSONNELLE. Pas d'adresse IP, pas
 *    d'identifiant d'appareil, pas de témoin. Un pays, une langue, un fuseau,
 *    une porte, un marchand, une heure. Le fuseau est ce qui remplace l'adresse
 *    IP pour dire « d'où » : il désigne une région, jamais quelqu'un.
 *
 * 2. LA LECTURE EST FERMÉE PAR UNE CLÉ. Le service est ouvert « à tout le
 *    monde » — il le faut, un visiteur doit pouvoir DÉPOSER son relevé. Mais
 *    lire le rapport, c'est voir le trafic de B : sans la clé, le rapport est
 *    refusé. L'adresse du service, elle, est publique (elle est dans le code du
 *    site) ; la clé, non. La clé se lit en exécutant la fonction `test()` dans
 *    l'éditeur, puis se colle dans le panneau (onglet Réglages).
 *
 * ---------------------------------------------------------------------------
 * CE QU'IL FAIT, DANS L'ORDRE
 *   1. Crée les feuilles si elles n'existent pas, avec leurs titres.
 *   2. Inscriptions : refuse une adresse qui n'a pas la forme d'une adresse ;
 *      nouvelle -> ligne + e-mail de confirmation ; en attente -> renvoi
 *      (un message se perd souvent, et sans ce renvoi l'inscrit serait bloqué
 *      pour toujours) ; confirmée -> ne fait rien et le dit.
 *   3. Visites et clics : une ligne par relevé, rien de plus. Le rapport est
 *      calculé À LA DEMANDE, à partir de ces lignes.
 *   4. Sur clic du lien de confirmation -> passe la ligne en « confirmé ».
 *      Sur clic du lien de désinscription -> passe la ligne en « désinscrit ».
 *      Chaque e-mail porte ce lien : la promesse « désinscription en un clic »
 *      doit se réaliser.
 *   5. `?rapport=panneau&cle=…` -> le rapport en JSON. Sans la bonne clé, rien.
 *
 * LE VERROU (LockService) N'EST PAS DÉCORATIF. Deux visiteurs peuvent envoyer
 * au même instant ; sans verrou, les deux lisent « dernière ligne = 5 » et
 * écrivent tous les deux en ligne 6 — un relevé est perdu, et il ne se
 * rattrape pas : personne ne relit un journal pour y chercher un trou.
 */

var NOM_FEUILLE = 'Inscriptions';
var TITRES = ['Date', 'E-mail', 'Langue', 'Pays', 'Source', 'Jeton', 'Statut', 'Confirmé le'];

/* PAS DE COLONNE « Prénom ». Le formulaire ne le demande plus (retiré le
   08/10/2026) : une colonne que rien ne remplit jamais est une colonne qu'on
   finit par croire remplie. Ce qui identifie un inscrit, ce qui sert à lui
   écrire et ce qui prouve son accord, c'est son adresse — elle seule. */
var COL = { DATE: 1, MAIL: 2, LANGUE: 3, PAYS: 4, SOURCE: 5, JETON: 6, STATUT: 7, CONFIRME: 8 };

/* ---------------------------------------------------------------------------
 * LES DEUX JOURNAUX DE TRAFIC
 *
 * POURQUOI DEUX FEUILLES ET NON UNE. Une visite et un clic n'ont pas les mêmes
 * colonnes : une visite a une provenance et un fuseau, un clic a un marchand et
 * un hôte. Les mettre dans une seule feuille laisserait, à chaque ligne, la
 * moitié des colonnes vides — et une colonne vide finit par être lue comme un
 * zéro. Deux journaux, chacun homogène, chacun lisible seul.
 *
 * LE JOUR EST CELUI DU PROPRIÉTAIRE (Europe/Brussels par défaut), pas celui du
 * visiteur : c'est la seule façon d'avoir UNE journée comparable d'un visiteur à
 * l'autre. Le fuseau du visiteur est conservé à part — il dit d'où il vient,
 * il ne décide pas du calendrier.
 * --------------------------------------------------------------------------- */
var NOM_VISITES = 'Trafic visites';
var TITRES_VISITES = ['Date', 'Jour', 'Heure', 'Pays', 'Langue', 'Entrée', 'Appareil', 'Fuseau', 'Page', 'Vues'];

var NOM_CLICS = 'Trafic clics';
var TITRES_CLICS = ['Date', 'Jour', 'Heure', 'Type', 'Pays', 'Marchand', 'Source', 'Hôte'];

var COL_V = { DATE: 1, JOUR: 2, HEURE: 3, PAYS: 4, LANGUE: 5, ENTREE: 6, APPAREIL: 7, FUSEAU: 8, PAGE: 9, VUES: 10 };
var COL_C = { DATE: 1, JOUR: 2, HEURE: 3, TYPE: 4, PAYS: 5, MARCHAND: 6, SOURCE: 7, HOTE: 8 };

/* Nombre de jours que le rapport détaille jour par jour. 90 jours = un
   trimestre, de quoi voir une tendance sans rendre la page interminable.
   L'HISTORIQUE COMPLET, lui, reste dans la feuille — le rapport ne fait que
   le résumer, il ne le remplace pas. */
var JOURS_RAPPORT = 90;

/* Durée de mise en cache du rapport, en secondes. Le rapport se recalcule à
   partir de toutes les lignes à chaque ouverture du panneau ; à quelques
   milliers de lignes c'est déjà ~1 s. Cinq minutes de cache suffisent à ce
   qu'une consultation ne se paie qu'une fois, et c'est assez court pour qu'un
   chiffre ne soit jamais vieux de plus d'un café. */
var CACHE_SECONDES = 300;

/* Les messages envoyés et affichés, dans les neuf langues du site. Le vocabulaire
   est celui du quotidien, pas celui d'un service informatique. */
var TEXTES = {
  fr: { sujet: 'Confirme ton inscription — Kazendra', intro: 'Tu as demandé à recevoir les bons plans de Kazendra.',
    bouton: 'Pour activer ton compte, clique simplement sur ce lien :',
    oubli: "Si tu n'es pas à l'origine de cette demande, ignore ce message : sans clic, rien ne sera activé.",
    sign: 'À bientôt, Kazendra', pageTitre: 'Compte activé',
    pageTexte: 'Ton inscription est confirmée. Tu recevras les bons plans.', pageInconnu: "Ce lien n'est pas valable.", desinscrire: 'Se désinscrire', pageStopTitre: 'Désinscription faite', pageStop: 'Tu ne recevras plus les bons plans. Ton adresse a été retirée de la liste.' },
  nl: { sujet: 'Bevestig je inschrijving — Kazendra', intro: 'Je hebt gevraagd om de koopjes van Kazendra te ontvangen.',
    bouton: 'Klik gewoon op deze link om je account te activeren:',
    oubli: 'Als je dit niet hebt aangevraagd, negeer dit bericht: zonder klik wordt er niets geactiveerd.',
    sign: 'Tot binnenkort, Kazendra', pageTitre: 'Account geactiveerd',
    pageTexte: 'Je inschrijving is bevestigd. Je ontvangt de koopjes.', pageInconnu: 'Deze link is niet geldig.', desinscrire: 'Uitschrijven', pageStopTitre: 'Uitgeschreven', pageStop: 'Je ontvangt geen koopjes meer. Je adres is van de lijst gehaald.' },
  de: { sujet: 'Bestätige deine Anmeldung — Kazendra', intro: 'Du hast darum gebeten, die Angebote von Kazendra zu erhalten.',
    bouton: 'Klicke einfach auf diesen Link, um dein Konto zu aktivieren:',
    oubli: 'Wenn du das nicht angefragt hast, ignoriere diese Nachricht: ohne Klick wird nichts aktiviert.',
    sign: 'Bis bald, Kazendra', pageTitre: 'Konto aktiviert',
    pageTexte: 'Deine Anmeldung ist bestätigt. Du erhältst die Angebote.', pageInconnu: 'Dieser Link ist nicht gültig.', desinscrire: 'Abmelden', pageStopTitre: 'Abmeldung erledigt', pageStop: 'Du erhältst keine Angebote mehr. Deine Adresse wurde aus der Liste entfernt.' },
  en: { sujet: 'Confirm your sign-up — Kazendra', intro: 'You asked to receive the Kazendra deals.',
    bouton: 'To activate your account, simply click this link:',
    oubli: 'If you did not ask for this, ignore this message: without a click, nothing is activated.',
    sign: 'See you soon, Kazendra', pageTitre: 'Account activated',
    pageTexte: 'Your sign-up is confirmed. You will receive the deals.', pageInconnu: 'This link is not valid.', desinscrire: 'Unsubscribe', pageStopTitre: 'Unsubscribed', pageStop: 'You will no longer receive the deals. Your address has been removed from the list.' },
  es: { sujet: 'Confirma tu inscripción — Kazendra', intro: 'Has pedido recibir las ofertas de Kazendra.',
    bouton: 'Para activar tu cuenta, haz clic en este enlace:',
    oubli: 'Si no has solicitado esto, ignora este mensaje: sin clic, no se activa nada.',
    sign: 'Hasta pronto, Kazendra', pageTitre: 'Cuenta activada',
    pageTexte: 'Tu inscripción está confirmada. Recibirás las ofertas.', pageInconnu: 'Este enlace no es válido.', desinscrire: 'Darse de baja', pageStopTitre: 'Baja realizada', pageStop: 'Ya no recibirás las ofertas. Tu dirección se ha quitado de la lista.' },
  it: { sujet: 'Conferma la tua iscrizione — Kazendra', intro: 'Hai chiesto di ricevere le offerte di Kazendra.',
    bouton: 'Per attivare il tuo account, clicca semplicemente su questo link:',
    oubli: 'Se non hai richiesto tu questo, ignora il messaggio: senza clic non si attiva nulla.',
    sign: 'A presto, Kazendra', pageTitre: 'Account attivato',
    pageTexte: 'La tua iscrizione è confermata. Riceverai le offerte.', pageInconnu: 'Questo link non è valido.', desinscrire: 'Disiscriviti', pageStopTitre: 'Disiscrizione fatta', pageStop: 'Non riceverai più le offerte. Il tuo indirizzo è stato tolto dalla lista.' },
  pt: { sujet: 'Confirma a tua inscrição — Kazendra', intro: 'Pediste para receber as promoções da Kazendra.',
    bouton: 'Para ativar a tua conta, clica simplesmente nesta ligação:',
    oubli: 'Se não foste tu a pedir, ignora esta mensagem: sem clique nada é ativado.',
    sign: 'Até breve, Kazendra', pageTitre: 'Conta ativada',
    pageTexte: 'A tua inscrição está confirmada. Vais receber as promoções.', pageInconnu: 'Esta ligação não é válida.', desinscrire: 'Desinscrever', pageStopTitre: 'Desinscrição feita', pageStop: 'Já não vais receber as promoções. O teu endereço foi retirado da lista.' },
  pl: { sujet: 'Potwierdź zapis — Kazendra', intro: 'Poprosiłeś o otrzymywanie okazji Kazendra.',
    bouton: 'Aby aktywować konto, kliknij po prostu ten link:',
    oubli: 'Jeśli to nie ty, zignoruj tę wiadomość: bez kliknięcia nic nie zostanie aktywowane.',
    sign: 'Do zobaczenia, Kazendra', pageTitre: 'Konto aktywowane',
    pageTexte: 'Twój zapis jest potwierdzony. Będziesz otrzymywać okazje.', pageInconnu: 'Ten link jest nieprawidłowy.', desinscrire: 'Wypisz się', pageStopTitre: 'Wypisano', pageStop: 'Nie będziesz już otrzymywać okazji. Twój adres został usunięty z listy.' },
  sv: { sujet: 'Bekräfta din anmälan — Kazendra', intro: 'Du bad om att få Kazendras erbjudanden.',
    bouton: 'Klicka bara på den här länken för att aktivera ditt konto:',
    oubli: 'Om du inte begärde detta, ignorera meddelandet: utan ett klick aktiveras inget.',
    sign: 'Vi ses snart, Kazendra', pageTitre: 'Konto aktiverat',
    pageTexte: 'Din anmälan är bekräftad. Du kommer att få erbjudandena.', pageInconnu: 'Den här länken är inte giltig.', desinscrire: 'Avregistrera', pageStopTitre: 'Avregistrerad', pageStop: 'Du kommer inte längre att få erbjudandena. Din adress har tagits bort från listan.' },
};

function textes(langue) {
  return TEXTES[String(langue || '').toLowerCase()] || TEXTES.en;
}

/** Le fuseau qui décide des journées du rapport. Celui de la feuille de calcul
 *  s'il est réglé (Bruxelles, en principe) ; sinon celui du script. On ne le
 *  devine pas en dur : un rapport dont les journées ne tombent pas juste est un
 *  rapport auquel on ne peut pas se fier. */
function fuseauProprietaire() {
  try {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    if (tz) return tz;
  } catch (err) { /* pas de classeur lié : on prend celui du script */ }
  return Session.getScriptTimeZone();
}

/** Une feuille nommée, créée avec ses titres si elle n'existe pas.
 *  getLastRow() vaut 0 sur une feuille vierge : c'est le seul cas où l'on pose
 *  les titres. On ne les réécrit jamais, sinon le premier relevé les
 *  remplacerait. */
function feuilleDe(nom, titres) {
  var classeur = SpreadsheetApp.getActiveSpreadsheet();
  var feuille = classeur.getSheetByName(nom);
  if (!feuille) feuille = classeur.insertSheet(nom);
  if (feuille.getLastRow() === 0) {
    feuille.appendRow(titres);
    feuille.getRange(1, 1, 1, titres.length).setFontWeight('bold');
    feuille.setFrozenRows(1);
  }
  return feuille;
}

function feuilleInscriptions() {
  return feuilleDe(NOM_FEUILLE, TITRES);
}

/* =========================================================================
 * LES INSCRIPTIONS — inchangées depuis le 08/10/2026.
 * ========================================================================= */

/** Numéro de ligne (1-based) de l'adresse, ou 0 si absente. */
function ligneDe(feuille, adresse) {
  var derniere = feuille.getLastRow();
  if (derniere < 2) return 0;
  var colonne = feuille.getRange(2, COL.MAIL, derniere - 1, 1).getValues();
  for (var i = 0; i < colonne.length; i++) {
    if (String(colonne[i][0]).trim().toLowerCase() === adresse) return i + 2;
  }
  return 0;
}

/** Numéro de ligne portant ce jeton, ou 0. Le jeton est le seul secret du lien. */
function ligneDuJeton(feuille, jeton) {
  var derniere = feuille.getLastRow();
  if (derniere < 2 || !jeton) return 0;
  var colonne = feuille.getRange(2, COL.JETON, derniere - 1, 1).getValues();
  for (var i = 0; i < colonne.length; i++) {
    if (String(colonne[i][0]).trim() === jeton) return i + 2;
  }
  return 0;
}

function nouveauJeton() {
  // 32 caractères tirés au hasard : impossible à deviner, donc personne ne peut
  // confirmer l'inscription de quelqu'un d'autre.
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function adresseValide(a) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a);
}

function repondre(texte) {
  return ContentService.createTextOutput(texte).setMimeType(ContentService.MimeType.TEXT);
}

/** Échappe ce qui pourrait casser le HTML d'un message. Les textes sont les
 *  nôtres, mais une traduction peut contenir un « & » ou un chevron : un lien
 *  de confirmation doit rester cliquable dans les NEUF langues. */
function echapper(texte) {
  return String(texte == null ? '' : texte)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** L'ADRESSE PAR LAQUELLE LA REQUÊTE EST ENTRÉE — la seule qui soit SÛRE.
 *
 *  Apps Script donne le chemin emprunté par la requête (`contextPath`) :
 *  « /macros/s/XXX/exec » quand le site nous écrit sur l'adresse PUBLIQUE.
 *  C'est donc, par construction, l'adresse qui MARCHE — pas une supposition,
 *  pas un réglage, pas une propriété à deviner.
 *
 *  C'EST LA CORRECTION DU 13/10/2026. Le lien de confirmation était construit
 *  avec `ScriptApp.getService().getUrl()`, qui rend l'adresse du DERNIER
 *  déploiement — celle du mode test (`/dev`) selon l'état du projet, et celle-là
 *  n'ouvre que pour le propriétaire connecté. L'inscrit tombait donc sur une
 *  page Google « Impossible d'ouvrir le fichier pour le moment », et sa ligne
 *  restait « en attente » : le clic n'atteignait jamais le script.
 *
 *  On ne devine rien, et on ne fait confiance à personne : le chemin vient de la
 *  requête elle-même. */
function adresseDeLaRequete(e) {
  var chemin = String((e && e.contextPath) || '');
  if (!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(chemin)) return '';
  return 'https://script.google.com' + chemin;
}

/** Cette adresse est-elle de la MÊME famille de déploiement que la nôtre ? */
function memeDeploiement(url) {
  var mienne = String(ScriptApp.getService().getUrl() || '');
  var id = (mienne.match(/\/macros\/s\/([A-Za-z0-9_-]+)\//) || [])[1] || '';
  return !!id && String(url).indexOf('/macros/s/' + id + '/exec') !== -1;
}

/** L'ADRESSE PUBLIQUE que porteront les liens du message.
 *
 *  Trois sources, dans l'ordre de confiance :
 *    1. LE CHEMIN DE LA REQUÊTE (`contextPath`) — il vient de fonctionner ;
 *    2. L'ADRESSE DONNÉE PAR LE SITE (`relais`), acceptée seulement si elle est
 *       de la même famille que la nôtre — un inconnu ne peut donc pas nous faire
 *       envoyer à vos inscrits un lien vers le service de quelqu'un d'autre ;
 *    3. CELLE QU'ON A DÉJÀ ÉPROUVÉE, gardée dans les propriétés du script.
 *
 *  À défaut, on retombe sur l'adresse de Google — la panne du 13/10, mais jamais
 *  pire. On ne préfère jamais une adresse inventée à une adresse incertaine. */
function adressePublique(e, suggeree) {
  var entree = adresseDeLaRequete(e);
  var proposee = String(suggeree || '').trim();
  var valable = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(proposee);
  try {
    var p = PropertiesService.getScriptProperties();
    var choisie = entree || (valable && memeDeploiement(proposee) ? proposee : '');
    if (choisie) {
      if (p.getProperty('ADRESSE_PUBLIQUE') !== choisie) p.setProperty('ADRESSE_PUBLIQUE', choisie);
      return choisie;
    }
    var gardee = String(p.getProperty('ADRESSE_PUBLIQUE') || '');
    if (/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(gardee)) return gardee;
  } catch (err) { /* propriétés indisponibles : on retombe sur celle de Google */ }
  return String(ScriptApp.getService().getUrl() || '');
}

/* -------------------------------------------------------------------------
 * LE MESSAGE DE CONFIRMATION — sa mise en page, et son logo.
 *
 * Demande de B, 13/10/2026 : « un mail de confirmation plus agréable au visuel
 * avec le logo intégré ».
 *
 * DEUX LIBELLÉS COURTS, DANS LES NEUF LANGUES. Ils ne servent qu'à la mise en
 * page (le titre du bandeau et le mot du bouton) ; les garder à part évite de
 * toucher neuf blocs de textes déjà relus, et évite qu'un texte long se retrouve
 * dans un bouton.
 * ------------------------------------------------------------------------- */

var COURTS = {
  fr: { titre: 'Confirme ton inscription', cta: 'Confirmer mon inscription' },
  nl: { titre: 'Bevestig je inschrijving', cta: 'Mijn inschrijving bevestigen' },
  de: { titre: 'Bestätige deine Anmeldung', cta: 'Meine Anmeldung bestätigen' },
  en: { titre: 'Confirm your sign-up', cta: 'Confirm my sign-up' },
  es: { titre: 'Confirma tu inscripción', cta: 'Confirmar mi inscripción' },
  it: { titre: 'Conferma la tua iscrizione', cta: 'Conferma la mia iscrizione' },
  pt: { titre: 'Confirma a tua inscrição', cta: 'Confirmar a minha inscrição' },
  pl: { titre: 'Potwierdź swój zapis', cta: 'Potwierdź mój zapis' },
  sv: { titre: 'Bekräfta din anmälan', cta: 'Bekräfta min anmälan' },
};

/** Les libellés courts d'une langue, ou ceux d'anglais à défaut — comme les
 *  autres textes du script (voir `textes`). */
function courts(langue) {
  return COURTS[String(langue || '').toLowerCase()] || COURTS.en;
}

/* LE LOGO, DANS LE MESSAGE MÊME.
 *
 * Il voyage en pièce jointe « en ligne » (inlineImages) : le message ne fait
 * donc AUCUN appel à l'extérieur pour l'afficher. C'est la règle du projet —
 * pas de tiers — et c'est aussi ce qui fait que le logo apparaît même quand le
 * lecteur de courrier bloque les images distantes... à une réserve près, dite à
 * l'écran : la plupart des clients bloquent AUSSI les images jointes tant qu'on
 * n'a pas cliqué « afficher les images ». Le message reste donc lisible sans
 * elles : le titre, le bouton et le lien entier sont du texte.
 *
 * ⚠ LA VALEUR EST GÉNÉRÉE, PAS ÉCRITE À LA MAIN : elle vient de vos pixels
 * (`identite/mail-logo.png`, 176 px, 192 couleurs, 4,8 Ko) par
 * `outils/logo-mail-encoder.py`. Ne pas la retoucher ici : relancer l'outil.
 */
var LOGO_MAIL_B64 = 'iVBORw0KGgoAAAANSUhEUgAAALAAAACwCAMAAACYaRRsAAACQFBMVEXw+Pzd8fnc7fkMd5MAAAAKaIn6lysOhZsOl6j4dxUJWoL2iSwOi6HuayTxdSTh7vcJV3n9/v7p+/3Qi0ovd4fv1rSyiVMISGkwhpD36M/ljUNPd3badjWr19zllUf5hRxsfG/Wk06s2uMqZXgOZXuLhGSSyM7r+vxNhY/QeEf14LlOpqy25Ojq+vzq+fyWhVuxeUtvprLn+vxyhXIvbIS0///uyajxax02cnzv2McpWnHr+/wRkpxHeovYmWlPmqRtZlbXajHouY3XiDvjqW/79NpVhnxOkZuPd1KQk3PrxJSslGvR6PX8kh2KucSV1NfapW3O6PFMWFqLa1Tb9vvb9PoA//90kneHq7jZ+vzc8vnmtHEtS1nT2djV6+/c9fotWV00lqJ1dFptmKiHfGWJs7uybU2iydLd8vjloVQNoa9iiZJytr1vucN////P2eLirIgnkZtMaGh0XVO23fHe9vzgmG0AAP88hHxFWGhdZldXjqJxaGt5wsi2kl2/v7/a2vXuz8Ho7PoBOFQZSFwaUlwAqqoA/wAjS2E4Y15cs71tkYNxqsZ/v/9/1NSIXkiekV6JlICBn66fv9+f39+d2uOlj2Cop6Oqqv+2ttq/v/+/z++y5eW2/9rddB7WjmDflz3Gn4/foErFpIXasojattrP39/d7/biXynjbkPkckD/f3/nvaPw0Jnh6vIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOBaTqAAAAwHRSTlP+/v7/AP/////////////+/wOw///////////////////////////P//////9vkP///zT//wP//////1L/////////////////////Dv////8s//8sVAH//xZu////Uq7//////////9T//////wL//////xKR/wH/////////BAr/Fv///wMB/////wkEBv////8ICP///wMHBBAKB/////////8HENz///8C//89AAAAAAAAAAAAAAAAAAAAAAAppEWrAAAQDUlEQVR42tWdh2PbNhbGQVKyTFODWpbkyFZsK5ac2oot7xE3cezEK23c7KRp2qZpmyYd1z3uum7vvffe9zceAIIkwAlKlC2/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';

/** Le logo prêt à être joint, ou null s'il est illisible — auquel cas le
 *  message part SANS logo plutôt que de partir avec une image cassée. */
function logoMail() {
  if (!LOGO_MAIL_B64 || LOGO_MAIL_B64.indexOf('__LOGO') === 0) return null;
  try {
    return Utilities.newBlob(Utilities.base64Decode(LOGO_MAIL_B64), 'image/png', 'kazendra.png');
  } catch (err) {
    console.error('Logo illisible : ' + err);
    return null;
  }
}

/** Le message en HTML : bandeau bleu, logo, bouton orange, pied sombre.
 *
 *  POURQUOI DES STYLES EN LIGNE ET PAS UNE FEUILLE DE STYLE : les lecteurs de
 *  courrier suppriment les feuilles de style. Chaque bloc porte donc la sienne.
 *  POURQUOI PAS DE TABLEAU IMBRIQUÉ : la mise en page tient en un seul bloc
 *  centré, ce qui reste correct dans les clients anciens sans imposer un
 *  maillage que personne ne relira. */
function corpsHtmlConfirmation(t, c, lien, lienStop, avecLogo) {
  var bleu = '#0d3b5b', sombre = '#062f3b', orange = '#eb912d';
  var police = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  var logo = avecLogo
    ? '<img src="cid:logo" width="72" height="72" alt="Kazendra" '
      + 'style="display:block;margin:0 auto 12px;border:0;border-radius:18px">'
    : '';
  return '<div style="margin:0;padding:18px;background:#eef2f6">'
    + '<div style="max-width:560px;margin:0 auto">'
    + '<div style="background:' + bleu + ';border-radius:16px 16px 0 0;padding:26px;text-align:center">'
    + logo
    + '<div style="font:700 25px/1.2 ' + police + ';color:#ffffff;letter-spacing:.5px">Kazendra</div>'
    + '<div style="font:400 15px/1.4 ' + police + ';color:#a9c6d8;margin-top:6px">'
    + echapper(c.titre) + '</div></div>'
    + '<div style="background:#ffffff;padding:26px">'
    + '<p style="margin:0 0 16px;font:16px/1.6 ' + police + ';color:#1c2b36">'
    + echapper(t.intro) + '</p>'
    + '<p style="margin:0 0 18px;font:15px/1.6 ' + police + ';color:#1c2b36">'
    + echapper(t.bouton) + '</p>'
    + '<p style="margin:0 0 20px;text-align:center">'
    + '<a href="' + lien + '" style="display:inline-block;background:' + orange + ';color:' + sombre
    + ';font:700 16px/1 ' + police + ';text-decoration:none;padding:16px 28px;border-radius:12px">'
    + echapper(c.cta) + '</a></p>'
    + '<p style="margin:0 0 20px;word-break:break-all;font:12px/1.5 ' + police + ';color:#5c6b76">'
    + '<a href="' + lien + '" style="color:' + bleu + '">' + echapper(lien) + '</a></p>'
    + '<p style="margin:0;font:13px/1.6 ' + police + ';color:#5c6b76">' + echapper(t.oubli) + '</p>'
    + '</div>'
    + '<div style="background:' + sombre + ';border-radius:0 0 16px 16px;padding:18px 26px;text-align:center">'
    + '<p style="margin:0 0 8px;font:13px/1.5 ' + police + ';color:#dbe7ee">'
    + echapper(t.sign) + '</p>'
    + '<p style="margin:0;font:12px/1.5 ' + police + '">'
    + '<a href="' + lienStop + '" style="color:#f0b878">' + echapper(t.desinscrire) + '</a></p>'
    + '</div></div></div>';
}

/** Envoie l'e-mail de confirmation. Renvoie true si l'envoi a été accepté.
 *
 *  `e` = la requête reçue : elle porte le chemin par lequel elle est entrée, donc
 *  l'adresse qui fonctionne (voir `adressePublique`).
 *  `suggeree` = l'adresse donnée par le site, en second recours. */
function envoyerConfirmation(adresse, langue, jeton, e, suggeree) {
  var t = textes(langue);
  var c = courts(langue);
  var base = adressePublique(e, suggeree);
  var lien = base + '?jeton=' + encodeURIComponent(jeton);
  // LE LIEN DE DESINSCRIPTION EST DANS LE PREMIER MESSAGE. La case cochee sur le
  // site promet « Desinscription en un clic » : la promesse doit se realiser
  // dans le message qu'on recoit, pas dans un rappel que personne n'ouvre.
  var lienStop = base + '?desinscrire=' + encodeURIComponent(jeton);
  var corps = [
    'Bonjour,',
    '',
    t.intro,
    '',
    t.bouton,
    lien,
    '',
    t.oubli,
    '',
    t.desinscrire + ' : ' + lienStop,
    '',
    t.sign,
  ].join('\n');
  // LE MESSAGE PORTE AUSSI UNE VERSION HTML, ET C'EST LE LIEN QUI LE JUSTIFIE.
  // En texte seul, une adresse de cent cinquante caractères se coupe à l'écran ;
  // le doigt tombe alors sur un MORCEAU d'adresse, et Google répond « page
  // introuvable ». Dans la version HTML, l'adresse entière est UN seul lien :
  // la coupure à l'écran ne peut plus casser le clic. Le texte seul reste
  // envoyé : un lecteur qui refuse le HTML a encore tout le message.
  var logo = logoMail();
  var html = corpsHtmlConfirmation(t, c, lien, lienStop, !!logo);
  try {
    var envoi = { to: adresse, subject: t.sujet, body: corps, htmlBody: html, name: 'Kazendra' };
    // LE LOGO VOYAGE AVEC LE MESSAGE : aucune image n'est cherchée à l'extérieur,
    // donc aucun appel à un tiers — la règle du projet.
    if (logo) envoi.inlineImages = { logo: logo };
    MailApp.sendEmail(envoi);
    return true;
  } catch (err) {
    // On ne perd JAMAIS l'adresse parce que l'envoi a échoué : la ligne est
    // écrite, le jeton existe, et le prochain clic sur « Créer mon compte »
    // renverra l'e-mail. On le signale dans le statut.
    console.error('Envoi impossible vers ' + adresse + ' : ' + err);
    return false;
  }
}

/* =========================================================================
 * LA CLÉ DU RAPPORT — le seul secret de ce script.
 * ========================================================================= */

/** La clé de lecture du rapport, créée au premier besoin et conservée dans les
 *  propriétés du script (donc : dans VOTRE compte, et nulle part ailleurs).
 *
 *  POURQUOI ELLE EXISTE. Le service doit être ouvert à tout le monde : un
 *  visiteur dépose son relevé sans compte. Mais le rapport, lui, dit le trafic,
 *  la provenance des visiteurs et les clics vers les marchands. L'adresse du
 *  service est écrite en clair dans le code publié du site : sans clé, il
 *  suffirait de la lire pour voir vos chiffres. */
function cleDuRapport() {
  var p = PropertiesService.getScriptProperties();
  var cle = p.getProperty('CLE_RAPPORT');
  if (!cle) {
    cle = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    p.setProperty('CLE_RAPPORT', cle);
  }
  return cle;
}

/** Compare deux clés à durée constante — et ce n'est pas de la coquetterie.
 *  Une comparaison qui s'arrête au premier caractère différent laisse mesurer
 *  combien de caractères sont justes. Sur une clé de 40 caractères, ça ne
 *  suffit pas à la retrouver, mais ça n'apporte rien non plus de laisser la
 *  porte entrouverte. */
function memeCle(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* =========================================================================
 * LES RELEVÉS DE TRAFIC
 * ========================================================================= */

/** Un horodatage écrit dans le journal, vu depuis le fuseau du propriétaire. */
function quandDe(brut, tz) {
  var d = brut ? new Date(String(brut)) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  return {
    date: d,
    jour: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
    heure: Utilities.formatDate(d, tz, 'HH:mm'),
  };
}

/** Note une ouverture du site. Renvoie 'visite' — l'appelant s'en sert comme
 *  accusé, même si la page, elle, ne peut pas lire la réponse. */
function enregistrerVisite(d, tz) {
  var q = quandDe(d.quand, tz);
  var vues = parseInt(d.vues, 10);
  feuilleDe(NOM_VISITES, TITRES_VISITES).appendRow([
    q.date, q.jour, q.heure,
    String(d.pays || '?').slice(0, 8),
    String(d.langue || '?').slice(0, 8),
    String(d.entree || 'direct').slice(0, 60),
    String(d.appareil || '?').slice(0, 20),
    String(d.fuseau || '?').slice(0, 40),
    String(d.page || '/').slice(0, 80),
    (isNaN(vues) || vues < 1) ? 1 : Math.min(vues, 200),
  ]);
  return 'visite';
}

/** Note une sortie vers un marchand (clic) ou un partage. */
function enregistrerAction(d, tz) {
  var q = quandDe(d.quand, tz);
  var type = String(d.type || 'clic');
  if (type !== 'clic' && type !== 'partage') type = 'clic';
  feuilleDe(NOM_CLICS, TITRES_CLICS).appendRow([
    q.date, q.jour, q.heure, type,
    String(d.pays || '?').slice(0, 8),
    String(d.marchand || '?').slice(0, 60),
    String(d.source || '?').slice(0, 60),
    String(d.hote || '').slice(0, 60),
  ]);
  return type;
}

/** LE JOUR, RAMENÉ À UNE SEULE FORME : « 2026-10-12 ».
 *
 *  POURQUOI CE N'EST PAS DE LA COQUETTERIE. Google Sheets TRANSFORME en VRAIE
 *  date toute chaîne qui ressemble à une date (c'est le format automatique de
 *  la cellule). La cellule rend alors un objet Date, et `String(...)` donne
 *  « Mon Oct 12 2026 00:00:00 GMT+0200 (heure d'été d'Europe centrale) » — qui
 *  ne se classe PAS entre « 2026-07-15 » et « 2026-10-12 ».
 *
 *  MESURÉ le 12/10/2026 : le rapport lisait bien ses 3 relevés, mais n'en
 *  rangeait AUCUN dans sa fenêtre — tous les compteurs à zéro, « fenêtre lue :
 *  du — au — », et les gains d'affiliation à zéro eux aussi. Un zéro qui a
 *  l'air d'une mesure est le pire des affichages : on croit le site désert.
 *
 *  On ramène donc TOUT à « yyyy-MM-dd » : une vraie date (reformatée dans le
 *  fuseau du propriétaire), un texte déjà propre, ou une date écrite en clair
 *  qu'on sait relire. Ce qui reste illisible rend '' — et une ligne sans jour
 *  lisible est ÉCARTÉE, jamais comptée au hasard. */
function jourNormalise(valeur, tz) {
  if (valeur instanceof Date) return Utilities.formatDate(valeur, tz, 'yyyy-MM-dd');
  var s = String(valeur === null || valeur === undefined ? '' : valeur).trim();
  if (!s) return '';
  // Déjà « 2026-10-12 », éventuellement suivi d'une heure : on garde la date.
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  // « 12/10/2026 » : chez nous, le JOUR d'abord — et il faut le dire soi-même.
  // Mesuré : laissée à elle-même, la machine lit « mois/jour » et rend le
  // 10 décembre au lieu du 12 octobre. Un jour faux est pire qu'un jour absent.
  var fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (fr) return fr[3] + '-' + ('0' + fr[2]).slice(-2) + '-' + ('0' + fr[1]).slice(-2);
  // « Mon Oct 12 2026 00:00:00 GMT+0200 (…) » : la machine sait la relire.
  var d = new Date(s);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

/** Lit une feuille en bloc et rend ses lignes, sans les titres.
 *  UNE SEULE LECTURE PAR FEUILLE. Lire cellule par cellule sur un journal de
 *  plusieurs milliers de lignes, c'est une requête par cellule : le rapport
 *  mettrait une minute au lieu d'une seconde.
 *
 *  `colonneJour` (1 à n) : la colonne remise en « yyyy-MM-dd » à l'entrée. On
 *  le fait ICI, une seule fois, plutôt que chez les onze endroits qui lisent un
 *  jour : un point unique à corriger, et aucune ligne n'entre sans être
 *  normalisée. */
function lignesDe(nom, titres, colonnesUtiles, colonneJour) {
  var feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  if (!feuille) return [];
  var derniere = feuille.getLastRow();
  if (derniere < 2) return [];
  var valeurs = feuille.getRange(2, 1, derniere - 1, titres.length).getValues();
  // Le fuseau se demande UNE fois, et seulement s'il y a un jour à ramener :
  // c'est un appel au classeur, pas la lecture d'une variable.
  var tz = colonneJour ? fuseauProprietaire() : null;
  var out = [];
  for (var i = 0; i < valeurs.length; i++) {
    var ligne = valeurs[i];
    // Une ligne entièrement vide est possible (feuille nettoyée à la main) :
    // on la saute, elle n'est pas un relevé.
    var vide = true;
    for (var j = 0; j < ligne.length; j++) if (ligne[j] !== '' && ligne[j] !== null) { vide = false; break; }
    if (vide) continue;
    var rang = ligne.slice(0, colonnesUtiles);
    if (colonneJour) rang[colonneJour - 1] = jourNormalise(rang[colonneJour - 1], tz);
    out.push(rang);
  }
  return out;
}

/* =========================================================================
 * LE RAPPORT — FONCTION PURE.
 *
 * Elle ne touche NI à la feuille, NI à l'horloge, NI au cache : tout lui est
 * donné. C'est ce qui la rend VÉRIFIABLE — une épreuve peut fabriquer trois
 * jours de journal, y compris les cas tordus (un jour sans visite, une heure
 * d'été, une ligne sans provenance) et vérifier les chiffres, au lieu
 * d'attendre que la production les produise. C'est la même discipline que le
 * bilan d'exploitation du collecteur.
 *
 * CE QU'ELLE NE FAIT PAS : deviner. Pas de provenance -> « direct », jamais une
 * catégorie inventée. Un jour sans visite donne un zéro EXPLICITE (il a été
 * cherché et compté) — un vrai zéro, pas un trou.
 * ========================================================================= */

/** Le tableau de comptage trié décroissant : [{cle, n}]. */
function compter(valeurs, defaut) {
  var m = {};
  for (var i = 0; i < valeurs.length; i++) {
    var v = String(valeurs[i] === '' || valeurs[i] === null || valeurs[i] === undefined ? (defaut || '?') : valeurs[i]);
    m[v] = (m[v] || 0) + 1;
  }
  var out = [];
  for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) out.push({ cle: k, n: m[k] });
  // Tri décroissant par nombre, puis alphabétique : deux exécutions rendent
  // donc le MÊME ordre, sinon le panneau changerait de tête de liste tout seul.
  out.sort(function (a, b) { return b.n - a.n || (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0); });
  return out;
}

/** La médiane d'une liste de nombres. On la publie À CÔTÉ de la moyenne : une
 *  seule journée exceptionnelle déplace une moyenne et laisse croire à une
 *  fréquentation qui n'existe pas. La médiane, non. */
function mediane(nombres) {
  if (!nombres.length) return 0;
  var t = nombres.slice().sort(function (a, b) { return a - b; });
  var milieu = Math.floor(t.length / 2);
  return t.length % 2 ? t[milieu] : (t[milieu - 1] + t[milieu]) / 2;
}

/** Les jours entre deux dates incluses, en texte « yyyy-MM-dd ». */
function joursEntre(debut, fin) {
  var out = [];
  var d = new Date(debut + 'T00:00:00Z');
  var f = new Date(fin + 'T00:00:00Z');
  // Garde-fou : au-delà d'un an, on s'arrête. Une date corrompue dans la
  // feuille ne doit pas fabriquer un rapport de 400 000 lignes.
  var garde = 0;
  while (d <= f && garde < 400) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
    garde++;
  }
  return out;
}

/** LE BLOC « INSCRIPTIONS » DU RAPPORT — ce que la newsletter a reçu.
 *
 *  DEMANDE DE B (12/10/2026) : « Peut-on faire la même chose avec un fichier
 *  inscription [...] Je parle des inscriptions à la newsletter. » Et sa décision
 *  sur le rangement : « un fichier avec trois onglets » — le relais écrit les
 *  inscriptions ET le trafic dans le même tableur, on ne déplace rien.
 *
 *  CE QUI SORT, ET CE QUI NE SORT PAS. Des COMPTES : combien, quand, en quelle
 *  langue, dans quel état. JAMAIS les adresses. Le rapport voyage comme un
 *  fichier sur le réseau ; les e-mails, eux, restent dans le tableur — chez
 *  vous — et c'est là qu'on écrit à ses inscrits. Un comptage suffit à savoir
 *  si la newsletter prend ; une liste d'adresses qui circule, non.
 *
 *  FONCTION PURE : ni feuille, ni horloge, ni cache. Tout lui est donné, donc
 *  une épreuve peut fabriquer des inscrits — confirmés, en attente, désinscrits,
 *  sans langue, sans date — et vérifier les comptes, au lieu de l'espérer.
 *
 *  @param {Array}  lignes     lignes de la feuille « Inscriptions »
 *                             [date, e-mail, langue, pays, source, jeton, statut, confirmé le]
 *  @param {Array}  listeJours les jours de la fenêtre du rapport, dans l'ordre
 */
function blocInscriptions(lignes, listeJours) {
  var dansFenetre = {};
  for (var d = 0; d < listeJours.length; d++) dansFenetre[listeJours[d]] = true;

  var parJourCompte = {};
  var langues = [], pays = [], sources = [];
  var confirmes = 0, enAttente = 0, desinscrits = 0;
  var premier = null, dernier = null, dansLaFenetre = 0;

  for (var i = 0; i < lignes.length; i++) {
    var l = lignes[i];
    // Le jour est déjà ramené à « yyyy-MM-dd » en entrant (voir jourNormalise) :
    // ici on ne fait que compter, sans se demander quelle forme il avait.
    var jour = String(l[COL.DATE - 1] || '');
    if (jour) {
      if (premier === null || jour < premier) premier = jour;
      if (dernier === null || jour > dernier) dernier = jour;
      if (dansFenetre[jour]) { parJourCompte[jour] = (parJourCompte[jour] || 0) + 1; dansLaFenetre++; }
    }
    langues.push(l[COL.LANGUE - 1]);
    pays.push(l[COL.PAYS - 1]);
    sources.push(l[COL.SOURCE - 1]);

    // L'ÉTAT, ET CE QU'IL VEUT DIRE. « Confirmé » = le lien reçu par e-mail a
    // été cliqué. Toute autre valeur — y compris vide — est « en attente » :
    // une adresse donnée sans confirmation n'est PAS un accord, et la compter
    // comme un inscrit ferait mentir le chiffre le plus important de l'écran.
    var st = String(l[COL.STATUT - 1] || '').trim().toLowerCase();
    if (st.indexOf('confirm') === 0) confirmes++;
    else if (st.indexOf('sinscrit') !== -1) desinscrits++;
    else enAttente++;
  }

  var parJour = [];
  for (var j = 0; j < listeJours.length; j++) {
    parJour.push({ jour: listeJours[j], n: parJourCompte[listeJours[j]] || 0 });
  }
  var nomme = function (t, cle) {
    return t.map(function (x) { var o2 = {}; o2[cle] = x.cle; o2.n = x.n; return o2; });
  };

  return {
    total: lignes.length,
    confirmes: confirmes,
    enAttente: enAttente,
    desinscrits: desinscrits,
    premier: premier,
    dernier: dernier,
    dansFenetre: dansLaFenetre,
    parJour: parJour,
    parLangue: nomme(compter(langues, '?'), 'langue'),
    parPays: nomme(compter(pays, '?'), 'pays'),
    parSource: nomme(compter(sources, '?'), 'source'),
  };
}

/**
 * Le rapport complet.
 *
 * @param {Array} visites  lignes du journal des visites   [date, jour, heure, pays, langue, entree, appareil, fuseau, page, vues]
 * @param {Array} clics    lignes du journal des sorties   [date, jour, heure, type, pays, marchand, source, hote]
 * @param {Object} o       { maintenant: Date, jours: 90, fuseau: 'Europe/Brussels' }
 * @param {Array} inscriptions lignes de la feuille « Inscriptions » (facultatif)
 */
function construireRapport(visites, clics, o, inscriptions) {
  o = o || {};
  var tz = o.fuseau || 'Europe/Brussels';
  var maintenant = o.maintenant || new Date();
  var jours = Math.max(1, Math.min(400, parseInt(o.jours, 10) || JOURS_RAPPORT));

  // Le jour « aujourd'hui » tel que le voit le propriétaire.
  var jourAujourdhui = Utilities.formatDate(maintenant, tz, 'yyyy-MM-dd');

  // --- Fenêtre du rapport : les N derniers jours, aujourd'hui compris --------
  var debutFenetre = new Date(new Date(jourAujourdhui + 'T00:00:00Z').getTime() - (jours - 1) * 86400000)
    .toISOString().slice(0, 10);
  var dansFenetre = function (jour) { return String(jour) >= debutFenetre && String(jour) <= jourAujourdhui; };

  var visitesFenetre = [];
  var vusParJour = {};
  var pagesVuesParJour = {};
  var appParJour = {};
  var navParJour = {};
  for (var i = 0; i < visites.length; i++) {
    var v = visites[i];
    var jour = String(v[COL_V.JOUR - 1] || '');
    if (!dansFenetre(jour)) continue;
    visitesFenetre.push(v);
    vusParJour[jour] = (vusParJour[jour] || 0) + 1;
    var nv = parseInt(v[COL_V.VUES - 1], 10);
    pagesVuesParJour[jour] = (pagesVuesParJour[jour] || 0) + (isNaN(nv) || nv < 1 ? 1 : nv);
    var ap = String(v[COL_V.APPAREIL - 1] || '?');
    if (ap === 'application') appParJour[jour] = (appParJour[jour] || 0) + 1;
    else navParJour[jour] = (navParJour[jour] || 0) + 1;
  }

  // --- Le jour par jour : TOUS les jours de la fenêtre, creux compris --------
  // Un jour sans visite n'est pas un trou dans la page : c'est un zéro, et il
  // compte. C'est même l'information la plus utile d'un historique — la
  // fréquentation d'un site se lit dans ses creux autant que dans ses pics.
  var listeJours = joursEntre(debutFenetre, jourAujourdhui);
  var parJour = [];
  var nombresVisites = [];
  var meilleur = null;
  for (var j = 0; j < listeJours.length; j++) {
    var jj = listeJours[j];
    var n = vusParJour[jj] || 0;
    parJour.push({
      jour: jj,
      visites: n,
      pagesVues: pagesVuesParJour[jj] || 0,
      application: appParJour[jj] || 0,
      navigateur: navParJour[jj] || 0,
    });
    nombresVisites.push(n);
    if (n > 0 && (!meilleur || n > meilleur.visites)) meilleur = { jour: jj, visites: n };
  }

  // --- Les moyennes : sur les jours ACTIFS, et sur la fenêtre entière --------
  // Deux moyennes, et elles ne disent pas la même chose : « les jours où il y a
  // du monde, combien » et « en moyenne, chaque jour, combien ». Publier la
  // seule première ferait croire à une fréquentation continue ; publier la
  // seule seconde ferait passer un site à deux jours de trafic par semaine pour
  // un site à trafic divisé par trois.
  var joursActifs = 0;
  var totalVisites = 0;
  var totalPages = 0;
  for (var k = 0; k < parJour.length; k++) {
    totalVisites += parJour[k].visites;
    totalPages += parJour[k].pagesVues;
    if (parJour[k].visites > 0) joursActifs++;
  }
  var moyenneJoursActifs = joursActifs ? totalVisites / joursActifs : 0;
  var moyenneFenetre = parJour.length ? totalVisites / parJour.length : 0;

  // --- La tendance : sept derniers jours contre sept précédents -------------
  // Elle n'est publiée QUE si elle a un sens : avec moins de quinze jours
  // d'historique, il n'y a rien à comparer, et un pourcentage calculé sur trois
  // jours ferait prendre une fluctuation pour une tendance.
  var tendance = null;
  if (parJour.length >= 14) {
    var fin = parJour.slice(-7), debut = parJour.slice(-14, -7);
    var somme = function (t) { var s = 0; for (var i2 = 0; i2 < t.length; i2++) s += t[i2].visites; return s; };
    var a = somme(fin), b = somme(debut);
    tendance = { septDerniers: a, septPrecedents: b, ecartPct: b ? Math.round(((a - b) / b) * 1000) / 10 : null };
  }

  // --- Les provenances, les appareils, les fuseaux, les portes --------------
  var prend = function (colonne) {
    var vals = [];
    for (var i3 = 0; i3 < visitesFenetre.length; i3++) vals.push(visitesFenetre[i3][colonne - 1]);
    return compter(vals, '?');
  };
  var nomme = function (t, cle) {
    return t.map(function (x) { var o2 = {}; o2[cle] = x.cle; o2.v = x.n; return o2; });
  };

  // --- L'affiliation : les redirections, par marchand et par jour -----------
  var clicsFenetre = [];
  var clicsParJour = {}, partagesParJour = {};
  var parHote = {}, parMarchand = {};
  for (var c = 0; c < clics.length; c++) {
    var cl = clics[c];
    var jc = String(cl[COL_C.JOUR - 1] || '');
    if (!dansFenetre(jc)) continue;
    clicsFenetre.push(cl);
    var typeC = String(cl[COL_C.TYPE - 1] || 'clic');
    if (typeC === 'partage') partagesParJour[jc] = (partagesParJour[jc] || 0) + 1;
    else clicsParJour[jc] = (clicsParJour[jc] || 0) + 1;
    var hote = String(cl[COL_C.HOTE - 1] || '').replace(/^www\./, '').toLowerCase();
    if (hote) {
      if (!parHote[hote]) parHote[hote] = { hote: hote, clics: 0, partages: 0 };
      if (typeC === 'partage') parHote[hote].partages++;
      else parHote[hote].clics++;
    }
    var marchand = String(cl[COL_C.MARCHAND - 1] || '?');
    if (!parMarchand[marchand]) parMarchand[marchand] = { marchand: marchand, clics: 0, partages: 0 };
    if (typeC === 'partage') parMarchand[marchand].partages++;
    else parMarchand[marchand].clics++;
  }
  var listeHotes = Object.keys(parHote).map(function (h2) { return parHote[h2]; })
    .sort(function (x, y) { return (y.clics + y.partages) - (x.clics + x.partages) || (x.hote < y.hote ? -1 : 1); });
  var listeMarchands = Object.keys(parMarchand).map(function (m2) { return parMarchand[m2]; })
    .sort(function (x, y) { return (y.clics + y.partages) - (x.clics + x.partages) || (x.marchand < y.marchand ? -1 : 1); });

  // LES CLICS PAR PAYS CONSULTÉ. Il ne dit PAS d'où vient le visiteur (ça, c'est
  // le fuseau) : il dit quel catalogue il regardait au moment de sortir. Un pays
  // qui sort beaucoup sans rien ouvrir est un pays à travailler.
  var parPaysClic = {};
  for (var pc = 0; pc < clicsFenetre.length; pc++) {
    var pg = String(clicsFenetre[pc][COL_C.PAYS - 1] || '?');
    if (!parPaysClic[pg]) parPaysClic[pg] = { pays: pg, clics: 0, partages: 0 };
    if (String(clicsFenetre[pc][COL_C.TYPE - 1] || '') === 'partage') parPaysClic[pg].partages++;
    else parPaysClic[pg].clics++;
  }
  var listePaysClic = Object.keys(parPaysClic).map(function (p2) { return parPaysClic[p2]; })
    .sort(function (x, y) { return y.clics - x.clics || (x.pays < y.pays ? -1 : 1); });

  var parJourClics = [];
  for (var jc2 = 0; jc2 < listeJours.length; jc2++) {
    var jj2 = listeJours[jc2];
    parJourClics.push({ jour: jj2, clics: clicsParJour[jj2] || 0, partages: partagesParJour[jj2] || 0 });
  }
  var totalClics = 0, totalPartages = 0;
  for (var h3 = 0; h3 < listeHotes.length; h3++) { totalClics += listeHotes[h3].clics; totalPartages += listeHotes[h3].partages; }

  // --- La couverture : ce qu'on peut jurer, et sur quoi --------------------
  var joursAvecVisite = [];
  for (var i4 = 0; i4 < visitesFenetre.length; i4++) joursAvecVisite.push(String(visitesFenetre[i4][COL_V.JOUR - 1]));
  joursAvecVisite.sort();
  var premiereVisite = joursAvecVisite.length ? joursAvecVisite[0] : null;
  var derniereVisite = joursAvecVisite.length ? joursAvecVisite[joursAvecVisite.length - 1] : null;

  var listeEntrees = prend(COL_V.ENTREE);
  var totalEntrees = 0;
  for (var e = 0; e < listeEntrees.length; e++) totalEntrees += listeEntrees[e].n;

  return {
    genereLe: maintenant.toISOString(),
    fuseau: tz,
    couverture: {
      fenetreJours: parJour.length,
      // « premierReleve » : la première visite JAMAIS enregistrée, même
      // antérieure à la fenêtre. Sans elle, un site vieux de six mois aurait
      // l'air d'avoir commencé il y a 90 jours.
      premierReleve: premiereLigne(visites, COL_V.JOUR),
      dernierReleve: derniereLigne(visites, COL_V.JOUR),
      premierDansFenetre: premiereVisite,
      dernierDansFenetre: derniereVisite,
      joursAvecVisite: joursActifs,
      lignesVisites: visites.length,
      lignesClics: clics.length,
      // CE QU'ON NE MESURE PAS, dit au lieu d'être passé sous silence.
      nonMesure: [
        'Le pays d\'où vient le visiteur n\'est PAS enregistré (ce serait une adresse IP). '
          + 'La provenance se lit au fuseau, à la langue et à la porte d\'entrée.',
        'Un passage n\'est compté qu\'une fois par session : dix rafraîchissements ne font pas dix visites.',
        'Les visites d\'un appareil qui refuse le stockage (navigation privée) ne peuvent pas être comptées.',
        'Les personnes qui bloquent les scripts ne sont comptées nulle part — le chiffre réel est donc un peu plus haut.',
      ],
    },
    trafic: {
      total: {
        visites: totalVisites,
        pagesVues: totalPages,
        joursActifs: joursActifs,
        joursFenetre: parJour.length,
        moyenneJoursActifs: Math.round(moyenneJoursActifs * 10) / 10,
        moyenneFenetre: Math.round(moyenneFenetre * 10) / 10,
        medianeFenetre: mediane(nombresVisites),
        meilleurJour: meilleur,
        application: compterTotal(visitesFenetre, COL_V.APPAREIL, 'application'),
        navigateur: compterTotal(visitesFenetre, COL_V.APPAREIL, 'navigateur'),
      },
      parJour: parJour,
      parProvenance: nomme(listeEntrees, 'provenance'),
      parFuseau: nomme(prend(COL_V.FUSEAU), 'fuseau'),
      parLangue: nomme(prend(COL_V.LANGUE), 'langue'),
      parPaysConsulte: nomme(prend(COL_V.PAYS), 'pays'),
      parAppareil: nomme(prend(COL_V.APPAREIL), 'appareil'),
      parPorte: nomme(prend(COL_V.PAGE), 'page'),
      tendance: tendance,
    },
    affiliation: {
      total: { clics: totalClics, partages: totalPartages, hotes: listeHotes.length },
      parHote: listeHotes,
      parMarchand: listeMarchands,
      parPays: listePaysClic,
      parJour: parJourClics,
    },
    // LES INSCRIPTIONS — ce que la newsletter a reçu, tous appareils confondus.
    // Elles vivent dans le MÊME tableur que le trafic (décision de B, 12/10/2026 :
    // « un fichier avec trois onglets »). C'est ce bloc qui les fait remonter au
    // panneau, au lieu de les laisser lisibles sur un seul appareil.
    inscriptions: blocInscriptions(inscriptions || [], listeJours),
  };
}

/** Le nombre de lignes dont la colonne vaut exactement `valeur`. */
function compterTotal(lignes, colonne, valeur) {
  var n = 0;
  for (var i = 0; i < lignes.length; i++) if (String(lignes[i][colonne - 1] || '') === valeur) n++;
  return n;
}

/** La première valeur non vide d'une colonne, ou null. Sert à dire quand le
 *  relevé a COMMENCÉ — pas quand la fenêtre commence. */
function premiereLigne(lignes, colonne) {
  var mini = null;
  for (var i = 0; i < lignes.length; i++) {
    var v = String(lignes[i][colonne - 1] || '');
    if (v && (mini === null || v < mini)) mini = v;
  }
  return mini;
}

function derniereLigne(lignes, colonne) {
  var maxi = null;
  for (var i = 0; i < lignes.length; i++) {
    var v = String(lignes[i][colonne - 1] || '');
    if (v && (maxi === null || v > maxi)) maxi = v;
  }
  return maxi;
}

/** Assemble le rapport depuis les feuilles, avec un cache de cinq minutes.
 *  Le cache est un CONFORT, pas une source : s'il tombe (quota, panne), on
 *  recalcule — le rapport ne doit jamais manquer à cause d'un cache. */
function rapportComplet(options) {
  options = options || {};
  var tz = fuseauProprietaire();
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (err) { cache = null; }
  if (cache && !options.force) {
    try {
      var garde = cache.get('rapport');
      if (garde) return JSON.parse(garde);
    } catch (err) { /* cache illisible : on recalcule */ }
  }
  var visites = lignesDe(NOM_VISITES, TITRES_VISITES, TITRES_VISITES.length, COL_V.JOUR);
  var clics = lignesDe(NOM_CLICS, TITRES_CLICS, TITRES_CLICS.length, COL_C.JOUR);
  // La feuille des inscriptions se lit AVEC sa colonne « Date » ramenée en jour :
  // elle contient une vraie date, exactement comme les journaux de trafic — et
  // c'est le même piège, donc la même précaution.
  var inscrits = lignesDe(NOM_FEUILLE, TITRES, TITRES.length, COL.DATE);
  var r = construireRapport(visites, clics, { maintenant: new Date(), jours: JOURS_RAPPORT, fuseau: tz }, inscrits);
  if (cache) {
    try { cache.put('rapport', JSON.stringify(r), CACHE_SECONDES); } catch (err) { /* trop gros : tant pis */ }
  }
  return r;
}

/* =========================================================================
 * LES PORTES D'ENTRÉE DU SERVICE
 * ========================================================================= */

function doPost(e) {
  var verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000);
  } catch (err) {
    return repondre('occupe');
  }
  try {
    var d = (e && e.parameter) || {};

    // --- 1. LES RELEVÉS DE TRAFIC, reconnus à leur premier champ ------------
    // Le tri se fait ICI, avant tout le reste : un relevé de visite ne porte
    // pas d'adresse e-mail, et la partie « inscriptions » le refuserait comme
    // « adresse invalide » — c'est exactement ce qui se serait passé si l'on
    // avait laissé le routeur faire, et le journal serait resté vide sans que
    // rien ne le signale.
    if (d.type === 'visite') return repondre(enregistrerVisite(d, fuseauProprietaire()));
    if (d.type === 'clic' || d.type === 'partage') return repondre(enregistrerAction(d, fuseauProprietaire()));

    // --- 2. LES INSCRIPTIONS -----------------------------------------------
    var adresse = String(d.email || '').trim().toLowerCase();
    var langue = String(d.langue || '').toLowerCase().slice(0, 5);
    // Le contrôle est refait ICI, pas seulement dans la page : la page peut être
    // contournée, le tableau ne doit jamais contenir une ligne inutilisable.
    if (!adresseValide(adresse)) return repondre('adresse invalide');

    // DESINSCRIPTION DEPUIS L'APPLICATION — le bouton « Se désinscrire ».
    //
    // Même effet que le lien de l'e-mail (doGet) : la ligne passe en
    // « desinscrit », elle n'est PAS supprimée. C'est la trace de l'accord ET de
    // son retrait — et sans elle, un envoi ulterieur recreerait la ligne, donc
    // re-inscrirait quelqu'un qui n'a rien redemande.
    //
    // Le jeton est efface au passage : l'ancien lien de desinscription de
    // l'e-mail ne doit plus rien valider pour cette personne.
    //
    // Demande de B, 11/10/2026 : « Si une adresse mail est documentée alors le
    // bouton se transforme en désinscription. pour supprimer la newsletter. »
    if (String(d.demande || '') === 'desinscription') {
      var feuilleStop = feuilleInscriptions();
      var ligneStop = ligneDe(feuilleStop, adresse);
      if (ligneStop === 0) return repondre('inconnue');
      feuilleStop.getRange(ligneStop, COL.STATUT).setValue('désinscrit');
      feuilleStop.getRange(ligneStop, COL.JETON).setValue('');
      return repondre('desinscrit');
    }

    var feuille = feuilleInscriptions();
    var ligne = ligneDe(feuille, adresse);

    if (ligne === 0) {
      var jeton = nouveauJeton();
      feuille.appendRow([
        new Date(), adresse, langue,
        String(d.pays || '').slice(0, 5), String(d.source || '').slice(0, 40),
        jeton, 'en attente', '',
      ]);
      var parti = envoyerConfirmation(adresse, langue, jeton, e, String(d.relais || ''));
      return repondre(parti ? 'en attente, e-mail envoye' : 'en attente, e-mail NON envoye');
    }

    // Adresse déjà connue.
    var statut = String(feuille.getRange(ligne, COL.STATUT).getValue() || '');
    if (statut === 'confirmé') return repondre('deja confirme');

    // « en attente » : le message s'est perdu, ou la personne a changé d'appareil.
    // On RENVOIE. Sans ce renvoi, un inscrit dont l'e-mail s'est perdu serait
    // bloqué définitivement — et il n'aurait aucun moyen de le signaler.
    var jeton2 = String(feuille.getRange(ligne, COL.JETON).getValue() || '') || nouveauJeton();
    feuille.getRange(ligne, COL.JETON).setValue(jeton2);
    var reparti = envoyerConfirmation(adresse, langue, jeton2, e, String(d.relais || ''));
    return repondre(reparti ? 'renvoye' : 'renvoi NON envoye');
  } catch (err) {
    return repondre('erreur: ' + err);
  } finally {
    verrou.releaseLock();
  }
}

/** Clic sur le lien de l'e-mail : active la ligne et affiche une page lisible.
 *  Et — nouveauté du 12/10/2026 — `?rapport=panneau&cle=…` rend le rapport
 *  chiffré, en JSON, pour le panneau d'administration. */
function doGet(e) {
  var p = (e && e.parameter) || {};

  // --- LE RAPPORT DU PANNEAU ------------------------------------------------
  if (p.rapport) {
    // SANS LA BONNE CLÉ, RIEN. On répond une erreur courte et fermée : ni un
    // chiffre, ni un indice sur ce qu'il y aurait à voir.
    if (!memeCle(p.cle, cleDuRapport())) {
      return json({ erreur: 'cle', message: 'Clé de lecture absente ou invalide.' }, p.jsonp);
    }
    try {
      return json(rapportComplet({ force: p.force === '1' }), p.jsonp);
    } catch (err) {
      return json({ erreur: 'calcul', message: String(err) }, p.jsonp);
    }
  }

  var jeton = p.jeton || '';
  var texte, titre;
  try {
    // DESINSCRIPTION — un clic, depuis le lien present dans chaque e-mail.
    // La ligne n'est PAS supprimee : elle passe en « desinscrit ». C'est la
    // trace de l'accord ET de son retrait — et sans elle, un nouvel envoi
    // recreerait la ligne, donc re-inscrirait quelqu'un qui n'a rien redemande.
    var stop = p.desinscrire || '';
    if (stop) {
      var feuilleStop = feuilleInscriptions();
      var ligneStop = ligneDuJeton(feuilleStop, stop);
      if (ligneStop === 0) {
        return pageHtml('Lien non valable',
                        "Ce lien de desinscription n'est pas valable.", false);
      }
      var ts = textes(String(feuilleStop.getRange(ligneStop, COL.LANGUE).getValue() || 'en'));
      feuilleStop.getRange(ligneStop, COL.STATUT).setValue('désinscrit');
      return pageHtml(ts.pageStopTitre, ts.pageStop, true);
    }
    var feuille = feuilleInscriptions();
    var ligne = ligneDuJeton(feuille, jeton);
    if (ligne === 0) {
      // LE TITRE DISAIT « Compte activé » SUR UNE PAGE QUI DIT LE CONTRAIRE.
      // Une page de refus qui s'annonce comme une réussite fait douter de tout
      // le reste — et c'est le genre de détail qu'on ne voit qu'en ouvrant la
      // page pour de bon. Corrigé le 12/10/2026.
      titre = 'Lien non valable';
      texte = textes('fr').pageInconnu;
      // On parle la langue de la feuille quand on la connaît ; sinon, on ne peut
      // pas la deviner, et un message en français reste compréhensible.
      return pageHtml(titre, texte, false);
    }
    var langue = String(feuille.getRange(ligne, COL.LANGUE).getValue() || 'en');
    var t = textes(langue);
    var statut = String(feuille.getRange(ligne, COL.STATUT).getValue() || '');
    if (statut !== 'confirmé') {
      feuille.getRange(ligne, COL.STATUT).setValue('confirmé');
      feuille.getRange(ligne, COL.CONFIRME).setValue(new Date());
    }
    return pageHtml(t.pageTitre, t.pageTexte, true);
  } catch (err) {
    return pageHtml('Erreur', String(err), false);
  }
}

/** Une réponse JSON, lisible par le panneau.
 *
 *  ET UNE SECONDE PORTE, DÉLIBÉRÉMENT : le JSONP. Si `jsonp` est fourni, la
 *  réponse devient `nom({…})` au lieu de `{…}` — un panneau qui charge cette
 *  adresse par une BALISE <script> peut alors lire le rapport même si le
 *  navigateur refuse la lecture directe d'une réponse d'un autre domaine.
 *
 *  POURQUOI CETTE PORTE EXISTE. Le panneau lit le rapport par une requête
 *  ordinaire ; le comportement exact de ce service en matière d'autorisation
 *  d'origine croisée ne se vérifie pas depuis le site lui-même, et une
 *  incertitude sur le SEUL chemin de lecture aurait rendu tout le bloc muet.
 *  Les balises <script>, elles, ne sont pas soumises à cette autorisation —
 *  c'est une porte de secours éprouvée, pas une élégance.
 *
 *  Le nom de la fonction est filtré : une chaîne venue d'une adresse ne doit
 *  jamais pouvoir écrire du code. */
function json(objet, nomJsonp) {
  var corps = JSON.stringify(objet);
  if (nomJsonp && /^[A-Za-z_$][A-Za-z0-9_$.]{0,60}$/.test(String(nomJsonp))) {
    return ContentService.createTextOutput(String(nomJsonp) + '(' + corps + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(corps).setMimeType(ContentService.MimeType.JSON);
}

/** La page affichée après le clic. Simple, sobre, et lisible sur téléphone. */
function pageHtml(titre, texte, ok) {
  var h = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + titre + '</title><style>'
    + 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
    + 'font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0d3b5b;color:#fff;padding:24px}'
    + '.b{max-width:420px;text-align:center;background:rgba(255,255,255,.08);padding:32px 24px;border-radius:18px}'
    + 'h1{font-size:22px;margin:0 0 12px}p{margin:0;opacity:.92}'
    + '</style></head><body><div class="b"><h1>' + (ok ? '&#10003; ' : '') + titre + '</h1><p>' + texte + '</p></div></body></html>';
  return HtmlService.createHtmlOutput(h).setTitle(titre);
}

/**
 * VÉRIFIER, ET LIRE LA CLÉ. Dans l'éditeur Apps Script : choisir cette
 * fonction dans la liste, puis « Exécuter ». Elle compte les inscrits, compte
 * les relevés de trafic, et AFFICHE LA CLÉ DU RAPPORT — celle à coller dans le
 * panneau d'administration, onglet Réglages.
 *
 * C'est la seule façon de récupérer la clé : elle n'est écrite nulle part en
 * clair dans le site, et c'est voulu.
 */
function test() {
  var f = feuilleInscriptions();
  var derniere = Math.max(0, f.getLastRow() - 1);
  var confirmes = 0;
  if (derniere > 0) {
    var statuts = f.getRange(2, COL.STATUT, derniere, 1).getValues();
    for (var i = 0; i < statuts.length; i++) if (String(statuts[i][0]) === 'confirmé') confirmes++;
  }
  var nbVisites = 0, nbClics = 0;
  var fv = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_VISITES);
  if (fv) nbVisites = Math.max(0, fv.getLastRow() - 1);
  var fc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_CLICS);
  if (fc) nbClics = Math.max(0, fc.getLastRow() - 1);

  Logger.log('Feuille « ' + f.getName() + ' » : ' + derniere + ' inscrit(s), dont ' + confirmes + ' confirmé(s).');
  Logger.log('Trafic : ' + nbVisites + ' visite(s) et ' + nbClics + ' sortie(s) enregistrée(s).');
  var r = rapportComplet({ force: true });
  Logger.log('Rapport : ' + r.couverture.lignesVisites + ' ligne(s) de visite, '
    + r.affiliation.total.clics + ' clic(s) vers un marchand.');
  Logger.log('Inscriptions dans le rapport : ' + r.inscriptions.total + ' au total, '
    + r.inscriptions.confirmes + ' confirmée(s), ' + r.inscriptions.enAttente + ' en attente.');
  Logger.log('Adresse du service (à coller dans public/relais.js) : ' + ScriptApp.getService().getUrl());
  Logger.log('CLÉ DU RAPPORT (à coller dans le panneau, onglet Réglages) : ' + cleDuRapport());
}
