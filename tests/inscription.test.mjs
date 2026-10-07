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
  assert.ok(APP.includes('id="cPrenom"'), 'le champ prénom a disparu');
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

test('l’annonce dit « envoyée » et jamais « inscrite »', () => {
  // Le tableau Google ne laisse pas la page lire sa réponse : annoncer
  // « inscrit » serait un mensonge. On annonce ce qu'on sait : c'est parti.
  assert.ok(/Ton adresse est envoyée/.test(APP),
    'l’annonce de succès doit dire « envoyée », pas « inscrite »');
  assert.ok(!/t\('Tu es inscrit/.test(APP) && !/t\("Tu es inscrit/.test(APP),
    'une annonce prétend à tort que l’inscription est confirmée');
});

test('les 6 nouvelles phrases existent dans les 9 langues', () => {
  const SRC = LANGUES_SRC.replace(/\\"/g, '"');
  const phrases = [
    'Prénom (facultatif)',
    "Cette adresse e-mail n'est pas valide.",
    "Coche la case pour recevoir les bons plans : sans ton accord, on ne t'inscrit pas.",
    "Ton compte est créé sur cet appareil. Le tableau n'est pas encore branché : ton adresse n'a pas été envoyée.",
    "Ton adresse est envoyée. Elle apparaîtra dans ta feuille : c'est elle qui fait foi.",
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

test('le récepteur Google refuse les doublons et vérifie l’adresse', () => {
  const gs = lire('outils/tableau-inscription.gs');
  assert.ok(/dejaInscrit/.test(gs), 'le récepteur doit refuser un doublon');
  assert.ok(/LockService/.test(gs),
    'le récepteur doit verrouiller l’écriture : sans cela, deux envois simultanés en perdent un');
  assert.ok(/\^\[\^\\s@\]\+@/.test(gs), 'le récepteur doit vérifier la forme de l’adresse');
  assert.ok(/d\.email/.test(gs), 'le récepteur doit lire le champ « email »');
});

test('le site charge le module d’inscription', () => {
  assert.ok(/from '\.\/inscription\.js'/.test(APP),
    'app.js doit importer inscription.js');
  const html = HTML;
  assert.ok(!/KAZENDRA_TABLEAU_URL\s*=/.test(html),
    'l’adresse du tableau se règle dans inscription.js, pas dans index.html');
});
