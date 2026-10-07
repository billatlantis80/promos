/**
 * TABLEAU D'INSCRIPTION — le récepteur, à coller dans Google Apps Script.
 * =============================================================================
 *
 * Ce code vit dans VOTRE compte Google. Il reçoit une adresse envoyée par le
 * site, l'écrit dans une feuille de calcul, et ENVOIE UN E-MAIL DE CONFIRMATION
 * pour activer le compte. Aucun tiers, aucune clé d'API, aucun coût.
 *
 * La marche à suivre est dans INSCRIPTION.md.
 *
 * ---------------------------------------------------------------------------
 * L'ACTIVATION EN DEUX TEMPS (demande de B : « il faudra envoyer un mail de
 * confirmation pour activer le compte »)
 *
 *   1. Quelqu'un remplit le formulaire  ->  la ligne est écrite avec le statut
 *      « en attente », et un e-mail part vers l'adresse indiquée.
 *   2. Il clique le lien de l'e-mail  ->  la ligne passe en « confirmé ».
 *
 * POURQUOI CE N'EST PAS UNE COMPLICATION INUTILE : une adresse non confirmée
 * n'a jamais été vérifiée. Elle peut être mal orthographiée, ou appartenir à
 * quelqu'un qui n'a rien demandé. Envoyer une newsletter à ces adresses-là, c'est
 * du courrier non sollicité — mauvais pour les inscrits, et contraire à la règle
 * européenne du consentement. La confirmation est à la fois la preuve du
 * consentement et le filtre contre les fautes de frappe.
 *
 * ---------------------------------------------------------------------------
 * CE QU'IL FAIT, DANS L'ORDRE
 *   1. Crée la feuille si elle n'existe pas, avec ses titres de colonnes.
 *   2. REFUSE une adresse qui n'a pas la forme d'une adresse.
 *   3. Adresse nouvelle  -> écrit la ligne + envoie l'e-mail de confirmation.
 *      Adresse « en attente » -> RENVOIE l'e-mail (un message se perd souvent ;
 *      sans ce renvoi, l'inscrit serait bloqué pour toujours).
 *      Adresse « confirmée » -> ne fait rien, et le dit.
 *   4. Sur clic du lien -> passe la ligne en « confirmé » et affiche une page.
 *
 * LE VERROU (LockService) N'EST PAS DÉCORATIF. Deux navigateurs peuvent envoyer
 * au même instant ; sans verrou, les deux lisent « dernière ligne = 5 » et
 * écrivent tous les deux en ligne 6 — une inscription est perdue.
 */

var NOM_FEUILLE = 'Inscriptions';
var TITRES = ['Date', 'E-mail', 'Prénom', 'Langue', 'Pays', 'Source', 'Jeton', 'Statut', 'Confirmé le'];

var COL = { DATE: 1, MAIL: 2, PRENOM: 3, LANGUE: 4, PAYS: 5, SOURCE: 6, JETON: 7, STATUT: 8, CONFIRME: 9 };

/* Les messages envoyés et affichés, dans les neuf langues du site. Le vocabulaire
   est celui du quotidien, pas celui d'un service informatique. */
var TEXTES = {
  fr: { sujet: 'Confirme ton inscription — Kazendra', intro: 'Tu as demandé à recevoir les bons plans de Kazendra.',
    bouton: 'Pour activer ton compte, clique simplement sur ce lien :',
    oubli: "Si tu n'es pas à l'origine de cette demande, ignore ce message : sans clic, rien ne sera activé.",
    sign: 'À bientôt, Kazendra', pageTitre: 'Compte activé',
    pageTexte: 'Ton inscription est confirmée. Tu recevras les bons plans.', pageInconnu: "Ce lien n'est pas valable." },
  nl: { sujet: 'Bevestig je inschrijving — Kazendra', intro: 'Je hebt gevraagd om de koopjes van Kazendra te ontvangen.',
    bouton: 'Klik gewoon op deze link om je account te activeren:',
    oubli: 'Als je dit niet hebt aangevraagd, negeer dit bericht: zonder klik wordt er niets geactiveerd.',
    sign: 'Tot binnenkort, Kazendra', pageTitre: 'Account geactiveerd',
    pageTexte: 'Je inschrijving is bevestigd. Je ontvangt de koopjes.', pageInconnu: 'Deze link is niet geldig.' },
  de: { sujet: 'Bestätige deine Anmeldung — Kazendra', intro: 'Du hast darum gebeten, die Angebote von Kazendra zu erhalten.',
    bouton: 'Klicke einfach auf diesen Link, um dein Konto zu aktivieren:',
    oubli: 'Wenn du das nicht angefragt hast, ignoriere diese Nachricht: ohne Klick wird nichts aktiviert.',
    sign: 'Bis bald, Kazendra', pageTitre: 'Konto aktiviert',
    pageTexte: 'Deine Anmeldung ist bestätigt. Du erhältst die Angebote.', pageInconnu: 'Dieser Link ist nicht gültig.' },
  en: { sujet: 'Confirm your sign-up — Kazendra', intro: 'You asked to receive the Kazendra deals.',
    bouton: 'To activate your account, simply click this link:',
    oubli: 'If you did not ask for this, ignore this message: without a click, nothing is activated.',
    sign: 'See you soon, Kazendra', pageTitre: 'Account activated',
    pageTexte: 'Your sign-up is confirmed. You will receive the deals.', pageInconnu: 'This link is not valid.' },
  es: { sujet: 'Confirma tu inscripción — Kazendra', intro: 'Has pedido recibir las ofertas de Kazendra.',
    bouton: 'Para activar tu cuenta, haz clic en este enlace:',
    oubli: 'Si no has solicitado esto, ignora este mensaje: sin clic, no se activa nada.',
    sign: 'Hasta pronto, Kazendra', pageTitre: 'Cuenta activada',
    pageTexte: 'Tu inscripción está confirmada. Recibirás las ofertas.', pageInconnu: 'Este enlace no es válido.' },
  it: { sujet: 'Conferma la tua iscrizione — Kazendra', intro: 'Hai chiesto di ricevere le offerte di Kazendra.',
    bouton: 'Per attivare il tuo account, clicca semplicemente su questo link:',
    oubli: 'Se non hai richiesto tu questo, ignora il messaggio: senza clic non si attiva nulla.',
    sign: 'A presto, Kazendra', pageTitre: 'Account attivato',
    pageTexte: 'La tua iscrizione è confermata. Riceverai le offerte.', pageInconnu: 'Questo link non è valido.' },
  pt: { sujet: 'Confirma a tua inscrição — Kazendra', intro: 'Pediste para receber as promoções da Kazendra.',
    bouton: 'Para ativar a tua conta, clica simplesmente nesta ligação:',
    oubli: 'Se não foste tu a pedir, ignora esta mensagem: sem clique nada é ativado.',
    sign: 'Até breve, Kazendra', pageTitre: 'Conta ativada',
    pageTexte: 'A tua inscrição está confirmada. Vais receber as promoções.', pageInconnu: 'Esta ligação não é válida.' },
  pl: { sujet: 'Potwierdź zapis — Kazendra', intro: 'Poprosiłeś o otrzymywanie okazji Kazendra.',
    bouton: 'Aby aktywować konto, kliknij po prostu ten link:',
    oubli: 'Jeśli to nie ty, zignoruj tę wiadomość: bez kliknięcia nic nie zostanie aktywowane.',
    sign: 'Do zobaczenia, Kazendra', pageTitre: 'Konto aktywowane',
    pageTexte: 'Twój zapis jest potwierdzony. Będziesz otrzymywać okazje.', pageInconnu: 'Ten link jest nieprawidłowy.' },
  sv: { sujet: 'Bekräfta din anmälan — Kazendra', intro: 'Du bad om att få Kazendras erbjudanden.',
    bouton: 'Klicka bara på den här länken för att aktivera ditt konto:',
    oubli: 'Om du inte begärde detta, ignorera meddelandet: utan ett klick aktiveras inget.',
    sign: 'Vi ses snart, Kazendra', pageTitre: 'Konto aktiverat',
    pageTexte: 'Din anmälan är bekräftad. Du kommer att få erbjudandena.', pageInconnu: 'Den här länken är inte giltig.' },
};

function textes(langue) {
  return TEXTES[String(langue || '').toLowerCase()] || TEXTES.en;
}

function feuilleInscriptions() {
  var classeur = SpreadsheetApp.getActiveSpreadsheet();
  var feuille = classeur.getSheetByName(NOM_FEUILLE);
  if (!feuille) feuille = classeur.insertSheet(NOM_FEUILLE);
  // getLastRow() vaut 0 sur une feuille vierge : c'est le seul cas où l'on pose
  // les titres. On ne les réécrit jamais, sinon la première inscription les
  // remplacerait.
  if (feuille.getLastRow() === 0) {
    feuille.appendRow(TITRES);
    feuille.getRange(1, 1, 1, TITRES.length).setFontWeight('bold');
    feuille.setFrozenRows(1);
  }
  return feuille;
}

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

/** Envoie l'e-mail de confirmation. Renvoie true si l'envoi a été accepté. */
function envoyerConfirmation(adresse, prenom, langue, jeton) {
  var t = textes(langue);
  var lien = ScriptApp.getService().getUrl() + '?jeton=' + encodeURIComponent(jeton);
  var corps = [
    (prenom ? 'Bonjour ' + prenom + ',' : 'Bonjour,'),
    '',
    t.intro,
    '',
    t.bouton,
    lien,
    '',
    t.oubli,
    '',
    t.sign,
  ].join('\n');
  try {
    MailApp.sendEmail({ to: adresse, subject: t.sujet, body: corps, name: 'Kazendra' });
    return true;
  } catch (err) {
    // On ne perd JAMAIS l'adresse parce que l'envoi a échoué : la ligne est
    // écrite, le jeton existe, et le prochain clic sur « Créer mon compte »
    // renverra l'e-mail. On le signale dans le statut.
    console.error('Envoi impossible vers ' + adresse + ' : ' + err);
    return false;
  }
}

function doPost(e) {
  var verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000);
  } catch (err) {
    return repondre('occupe');
  }
  try {
    var d = (e && e.parameter) || {};
    var adresse = String(d.email || '').trim().toLowerCase();
    var langue = String(d.langue || '').toLowerCase().slice(0, 5);
    // Le contrôle est refait ICI, pas seulement dans la page : la page peut être
    // contournée, le tableau ne doit jamais contenir une ligne inutilisable.
    if (!adresseValide(adresse)) return repondre('adresse invalide');

    var feuille = feuilleInscriptions();
    var ligne = ligneDe(feuille, adresse);

    if (ligne === 0) {
      var jeton = nouveauJeton();
      feuille.appendRow([
        new Date(), adresse, String(d.prenom || '').slice(0, 60), langue,
        String(d.pays || '').slice(0, 5), String(d.source || '').slice(0, 40),
        jeton, 'en attente', '',
      ]);
      var parti = envoyerConfirmation(adresse, String(d.prenom || ''), langue, jeton);
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
    var reparti = envoyerConfirmation(adresse, String(feuille.getRange(ligne, COL.PRENOM).getValue() || ''), langue, jeton2);
    return repondre(reparti ? 'renvoye' : 'renvoi NON envoye');
  } catch (err) {
    return repondre('erreur: ' + err);
  } finally {
    verrou.releaseLock();
  }
}

/** Clic sur le lien de l'e-mail : active la ligne et affiche une page lisible. */
function doGet(e) {
  var jeton = ((e && e.parameter) || {}).jeton || '';
  var texte, titre;
  try {
    var feuille = feuilleInscriptions();
    var ligne = ligneDuJeton(feuille, jeton);
    if (ligne === 0) {
      titre = textes('fr').pageTitre;
      texte = "Ce lien n'est pas valable.";
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
 * Ouvre la feuille et compte les inscrits. Dans l'éditeur Apps Script, choisir
 * cette fonction puis « Exécuter » — c'est le moyen le plus simple de vérifier
 * que le script a bien accès au tableau avant de le déployer.
 */
function test() {
  var f = feuilleInscriptions();
  var derniere = Math.max(0, f.getLastRow() - 1);
  var confirmes = 0;
  if (derniere > 0) {
    var statuts = f.getRange(2, COL.STATUT, derniere, 1).getValues();
    for (var i = 0; i < statuts.length; i++) if (String(statuts[i][0]) === 'confirmé') confirmes++;
  }
  Logger.log('Feuille « ' + f.getName() + ' » : ' + derniere + ' inscrit(s), dont ' + confirmes + ' confirmé(s).');
  Logger.log('Adresse du service (celle à coller dans inscription.js) : ' + ScriptApp.getService().getUrl());
}
