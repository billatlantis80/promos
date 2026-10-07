/**
 * TABLEAU D'INSCRIPTION — le récepteur, à coller dans Google Apps Script.
 * =============================================================================
 *
 * Ce code vit dans VOTRE compte Google. Il reçoit une adresse envoyée par le
 * site et l'écrit dans une feuille de calcul. Aucun tiers, aucune clé d'API,
 * aucun coût. La marche à suivre est dans INSCRIPTION.md.
 *
 * CE QU'IL FAIT, DANS L'ORDRE
 *   1. Il crée la feuille « Inscriptions » si elle n'existe pas, avec ses titres
 *      de colonnes.
 *   2. Il REFUSE une adresse qui n'a pas la forme d'une adresse (une faute de
 *      frappe silencieuse est un contact perdu pour toujours).
 *   3. Il REFUSE un doublon : si l'adresse est déjà dans la feuille, il ne
 *      l'écrit pas une seconde fois. Sans cela, le même inscrit qui clique deux
 *      fois reçoit deux newsletters, et la liste devient fausse.
 *   4. Il écrit la ligne : date, adresse, prénom, langue, pays.
 *
 * LE VERROU (LockService) N'EST PAS DÉCORATIF. Deux navigateurs peuvent envoyer
 * au même instant ; sans verrou, les deux lisent « dernière ligne = 5 » et
 * écrivent tous les deux en ligne 6 — une inscription est perdue. Le verrou
 * sérialise les écritures.
 */

var NOM_FEUILLE = 'Inscriptions';
var TITRES = ['Date', 'E-mail', 'Prénom', 'Langue', 'Pays', 'Source'];

function feuilleInscriptions() {
  var classeur = SpreadsheetApp.getActiveSpreadsheet();
  var feuille = classeur.getSheetByName(NOM_FEUILLE);
  if (!feuille) feuille = classeur.insertSheet(NOM_FEUILLE);
  // getLastRow() vaut 0 sur une feuille vierge : c'est le seul cas où l'on pose
  // les titres. On ne les réécrit jamais, sinon la première inscription à venir
  // les remplacerait.
  if (feuille.getLastRow() === 0) {
    feuille.appendRow(TITRES);
    feuille.getRange(1, 1, 1, TITRES.length).setFontWeight('bold');
    feuille.setFrozenRows(1);
  }
  return feuille;
}

/** Vrai si l'adresse est déjà présente dans la feuille (colonne B). */
function dejaInscrit(feuille, adresse) {
  var derniere = feuille.getLastRow();
  if (derniere < 2) return false;
  var colonne = feuille.getRange(2, 2, derniere - 1, 1).getValues();
  for (var i = 0; i < colonne.length; i++) {
    if (String(colonne[i][0]).trim().toLowerCase() === adresse) return true;
  }
  return false;
}

function repondre(texte) {
  return ContentService.createTextOutput(texte).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var verrou = LockService.getScriptLock();
  try {
    // 20 s d'attente : au-delà, on préfère échouer que bloquer une inscription.
    verrou.waitLock(20000);
  } catch (err) {
    return repondre('occupe');
  }
  try {
    var d = (e && e.parameter) || {};
    var adresse = String(d.email || '').trim().toLowerCase();
    // Le contrôle est refait ICI, et pas seulement dans la page : la page peut
    // être contournée, le tableau ne doit jamais contenir une ligne inutilisable.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) return repondre('adresse invalide');

    var feuille = feuilleInscriptions();
    if (dejaInscrit(feuille, adresse)) return repondre('deja inscrit');

    feuille.appendRow([
      new Date(),
      adresse,
      String(d.prenom || '').slice(0, 60),
      String(d.langue || '').slice(0, 5),
      String(d.pays || '').slice(0, 5),
      String(d.source || '')->slice(0, 40),
    ]);
    return repondre('ok');
  } catch (err) {
    return repondre('erreur: ' + err);
  } finally {
    verrou.releaseLock();
  }
}

/**
 * Ouvre la feuille depuis le navigateur : sert à vérifier que le script répond.
 * Dans l'éditeur Apps Script, choisir cette fonction puis « Exécuter ».
 */
function test() {
  var f = feuilleInscriptions();
  Logger.log('Feuille prête : ' + f.getName() + ' — ' + Math.max(0, f.getLastRow() - 1) + ' inscrit(s).');
}
