/**
 * L'ÉCRAN DE VERROUILLAGE DOIT RÉPONDRE, QUEL QUE SOIT LE CHEMIN QUI L'OUVRE.
 * =============================================================================
 *
 * LE DÉFAUT, TROUVÉ EN EXERÇANT L'ÉCRAN — PAS EN LE RELISANT.
 *
 * `brancherVerrou()` n'était appelé que dans la branche de DÉMARRAGE « un compte
 * existe déjà ». Le chemin « je crée mon compte pendant la session, puis
 * j'appuie sur Verrouiller maintenant » affichait donc l'écran de verrouillage
 * SANS AUCUN ÉCOUTEUR : ni « Déverrouiller », ni « J'ai oublié mon mot de
 * passe » ne répondaient. L'application restait fermée jusqu'au rechargement de
 * la page — et dans l'APK, jusqu'au prochain lancement.
 *
 * Aucun test ne pouvait le voir : le HTML était complet, les deux boutons
 * existaient, et le code de branchement était correct. C'est le CHEMIN qui
 * manquait. D'où ce fichier : il vérifie que l'écran se branche lui-même quand
 * on l'affiche, et pas seulement quand l'application démarre déjà verrouillée.
 *
 * Lancement : node --test tests/verrou-branchement.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APP = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

/** Le corps d'une fonction, accolades comptées (comme dans droits.test.mjs). */
function corps(nom) {
  const debut = APP.indexOf(`function ${nom}(`);
  assert.ok(debut > -1, `la fonction ${nom}() est introuvable dans app.js`);
  let i = APP.indexOf('{', debut);
  let profondeur = 0;
  for (let j = i; j < APP.length; j += 1) {
    if (APP[j] === '{') profondeur += 1;
    else if (APP[j] === '}') {
      profondeur -= 1;
      if (profondeur === 0) return APP.slice(i, j + 1);
    }
  }
  throw new Error(`accolade fermante de ${nom}() introuvable`);
}

test('afficher l’écran de verrouillage le branche lui-même', () => {
  // C'est la correction du 08/10/2026 : brancherVerrou() est appelé DEPUIS
  // montrerVerrou(), donc tout chemin qui affiche l'écran le rend utilisable.
  //
  // ON CHERCHE L'APPEL, PAS LE MOT. La première version de ce test cherchait
  // « brancherVerrou() » n'importe où dans le corps — et le commentaire qui
  // explique la correction porte ce nom. La contre-épreuve a donc été RATÉE :
  // on retirait l'appel, et le test passait quand même, bercé par le
  // commentaire. Un test qui cherche un nom se contente d'un nom.
  const m = corps('montrerVerrou');
  assert.match(m, /^\s*brancherVerrou\(\);\s*$/m,
    'montrerVerrou() doit APPELER brancherVerrou() : sinon l’écran s’affiche '
    + 'sans écouteur dès qu’on le montre hors du démarrage');
});

test('le branchement ne s’empile pas', () => {
  // montrerVerrou() peut être appelé plusieurs fois. Sans garde, chaque
  // affichage ajouterait un écouteur de plus, et « Déverrouiller » lancerait
  // plusieurs validations du même mot de passe.
  const b = corps('brancherVerrou');
  assert.match(b, /if\s*\(\s*verrouBranche\s*\)\s*return/,
    'brancherVerrou() doit refuser de se brancher deux fois');
});

test('l’écran de verrouillage ne s’affiche QUE par montrerVerrou()', () => {
  // Le contrôle utile : les affichages directs de #verrou doivent tous se
  // trouver DANS montrerVerrou(). Un affichage écrit ailleurs échapperait au
  // branchement — et c'est exactement ce qui a produit le défaut.
  //
  // Première version de ce test, fausse : elle comparait le nombre
  // d'affichages directs au nombre d'apparitions du mot « montrerVerrou() »,
  // définition comprise. Elle échouait sur un code correct. Un test qui compte
  // des occurrences de texte doit dire exactement ce qu'il compte.
  const total = (APP.match(/\$\('verrou'\)\.hidden\s*=\s*false/g) || []).length;
  const dedans = (corps('montrerVerrou').match(/\$\('verrou'\)\.hidden\s*=\s*false/g) || []).length;
  assert.ok(total >= 1, 'plus aucun affichage de l’écran de verrouillage : il a disparu');
  assert.equal(total, dedans,
    `${total - dedans} affichage(s) de #verrou en dehors de montrerVerrou() : `
    + 'ce chemin-là n’aurait aucun écouteur, et l’application resterait fermée');
});
