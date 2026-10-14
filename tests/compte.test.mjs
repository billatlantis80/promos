/**
 * IL N'Y A PLUS DE COMPTE LOCAL — le site ne demande qu'une adresse e-mail.
 * =============================================================================
 *
 * CE QUE CE FICHIER FAISAIT, ET CE QU'IL FAIT MAINTENANT.
 *
 * Il vérifiait le compte local : jamais de mot de passe en clair, l'empreinte
 * PBKDF2, le refus du mauvais mot de passe, la suppression, et l'écran de
 * verrouillage qui couvre l'application. Ce compte a été RETIRÉ le 11/10/2026,
 * décision de B : « le mot de passe peut disparaître car il n'y a pas de
 * connexion. il y a juste une adresse mail qui est donné pour recevoir la
 * newsletter. »
 *
 * Ce fichier ne pouvait pas être supprimé : c'est lui qui empêchait le compte de
 * revenir par un import oublié, une colonne de tableau restée, ou une traduction
 * orpheline. Ses assertions sont donc RETOURNÉES — elles exigent l'absence là où
 * elles exigeaient la présence — et les deux contrôles qui ne parlaient pas du
 * compte (la question du pays, les écrans masquables) sont restés.
 *
 * Lancement : node --test tests/compte.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (p) => fs.readFileSync(path.join(ICI, '..', p), 'utf8');
const APP = lire('public/app.js');
const HTML = lire('public/index.html');
const CSS = lire('public/app.css');
const LANGUES = lire('public/langues.js');

/** Le contrôle d'absence porte sur les IDENTIFIANTS du code, jamais sur le mot
 *  français : le commentaire qui raconte le retrait cite « compte local », et un
 *  doesNotMatch sur le mot nu mordrait dans sa propre explication. */
test('le module du compte local a disparu, et plus personne ne l’importe', () => {
  assert.equal(fs.existsSync(path.join(ICI, '..', 'public', 'compte.js')), false,
    'public/compte.js doit avoir disparu : le compte local n’existe plus');
  assert.doesNotMatch(APP, /from '\.\/compte\.js'/,
    'plus un seul fichier ne doit importer compte.js');
  assert.doesNotMatch(APP, /C\.(creerCompte|verifierMotDePasseCompte|changerMotDePasse|supprimerCompte|ficheCompte|compteEnregistre|nomCompte)/,
    'aucun appel au compte local ne doit subsister dans le programme');
});

test('aucun écran de verrouillage ne subsiste — ni page, ni style, ni code', () => {
  // Le verrou n'avait de sens que parce qu'un compte existait. Il est parti avec
  // lui : une porte sans clé n'est pas une protection, c'est un obstacle.
  assert.doesNotMatch(HTML, /id="verrou"|titreVerrou|verrouMdp|verrouOk|verrouOublie/,
    'la page ne doit plus porter d’écran de verrouillage');
  assert.doesNotMatch(APP, /montrerVerrou|brancherVerrou|verrouBranche|oublisArmes/,
    'le programme ne doit plus brancher ni afficher de verrou');
  assert.doesNotMatch(CSS, /\.verrou(-boite|-intro|-erreur)?[,{ ]/,
    'la feuille ne doit plus styler d’écran de verrouillage');
  // La classe .verrou restait aussi dans la liste des zones NON glissables :
  // c'est le genre de trace qui survit à un retrait et fait chercher un défaut
  // ailleurs.
  assert.doesNotMatch(APP, /GLISSER_HORS[^;]*\.verrou/,
    'la liste des zones à ne pas glisser ne doit plus nommer le verrou');
});

test('aucun champ de mot de passe, et aucun petit œil, ne subsiste', () => {
  // Demande de B : « la partie mot de passe et mot de passe a répété, le mot de
  // passe peut disparaître car il n'y a pas de connexion. »
  assert.doesNotMatch(HTML, /type="password"/, 'la page ne doit plus porter de champ de mot de passe');
  assert.doesNotMatch(APP, /champMotDePasse|basculerOeil|appliquerOeil|preparerOeils/,
    'le programme ne doit plus dessiner ni brancher d’œil');
  assert.doesNotMatch(CSS, /\.oeil|avec-oeil/, 'la feuille ne doit plus styler l’œil');
  for (const cle of ['Montrer le mot de passe', 'Cacher le mot de passe', 'Mot de passe',
                     'Répète le mot de passe', 'Créer mon compte']) {
    const motif = new RegExp(`^\\s*(['"])${cle}\\1:`, 'gm');
    assert.equal((LANGUES.match(motif) || []).length, 0,
      `« ${cle} » ne doit plus être traduit : plus personne ne l'affiche`);
  }
});

test('le vestige « promos.compte » est effacé au démarrage', () => {
  // Ce n'est pas de la cosmétique : une donnée qu'on a cessé de collecter mais
  // qu'on laisse sur les appareils est une donnée qu'on collecte encore. Ceux qui
  // ont utilisé la version précédente — et l'APK installé — gardent cette clé.
  assert.match(APP, /localStorage\.removeItem\('promos\.compte'\)/,
    'le démarrage doit effacer la clé du compte local restée sur les appareils');
  assert.match(APP, /lancerAuDemarrage\(\);/, 'et il doit être appelé au démarrage');
  // L'export RGPD ne doit plus transporter de compte du tout.
  const export_ = APP.slice(APP.indexOf('function exporterDonnees()'), APP.indexOf('function ouvrirReglages()'));
  assert.ok(export_.length > 100, 'découpage de exporterDonnees() invalide');
  assert.doesNotMatch(export_, /compte:/, 'l’export ne doit plus contenir de champ « compte »');
  assert.match(export_, /inscription: inscriptionLocale\(\)/,
    'l’export doit contenir l’inscription : c’est la seule chose qui sort de l’appareil');
});

test('le pays est demandé à la première ouverture, et modifiable ensuite', () => {
  // Ce contrôle ne parlait pas du compte : il reste, à l'identique.
  assert.match(HTML, /id="paysDemande"/, 'la question du pays doit exister dans la page');
  assert.match(HTML, /id="paysChoix"/, 'le même panneau doit servir depuis la barre du haut');
  assert.match(APP, /demanderPays\(\)/, 'la question doit être posée au premier lancement');
});

test('aucun écran masquable ne reste posé sur l’application', () => {
  // Piège payé une fois : `hidden` du navigateur pose « display: none », mais une
  // règle de classe qui fixe « display: flex » est PLUS FORTE que lui. Le panneau
  // restait affiché en permanence et interceptait tous les appuis. Le contrôle
  // portait sur le verrou ; il porte maintenant sur la seule modale qui reste.
  assert.match(CSS, /\.modale\[hidden\] \{ display: none; \}/,
    'la reprise explicite de `hidden` doit rester, sinon la modale du pays reste posée');
});
