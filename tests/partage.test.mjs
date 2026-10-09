/**
 * LE PARTAGE D'UNE OFFRE.
 *
 * Ce qui est protégé ici, et pourquoi :
 *
 *   L'application est une WebView Android. Or une WebView N'IMPLÉMENTE PAS
 *   `navigator.share` : un bouton de partage qui ne compterait que sur cette API
 *   serait un bouton MORT dans l'application — sans erreur, sans message, rien.
 *   Il faut donc trois voies, et un pont natif côté Android.
 *
 * Lancement : node --test tests/partage.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', 'public', f), 'utf8');
const js = lire('app.js');
const css = lire('app.css');

// L'arborescence Android n'existe QUE sur la machine du propriétaire : ce fichier
// de test lit son `MainActivity.java`. Quand elle est absente — c'est le cas dans
// GitHub Actions, où la collecte de secours tourne toutes les heures — on ne fait
// PAS échouer la suite : on saute la vérification en disant pourquoi.
//
// Défaut mesuré le 08/10/2026 : la lecture inconditionnelle faisait échouer le
// workflow horaire À TOUS LES COUPS (ENOENT sur /opt/data/…), et le propriétaire
// recevait un courriel « All jobs have failed » par heure. Une alerte qui sonne
// toujours ne signale plus rien — le vrai incident serait passé au milieu.
// Le contrôle, lui, n'est pas perdu : il tourne sur le NAS, où le projet Android
// vit réellement. Sur la voie de secours, il est marqué « sauté » et non « vert ».
const CHEMIN_JAVA = process.env.PROMOS_MAINACTIVITY
  || '/opt/data/android-build/app-promos/app/src/main/java/com/kazendra/app/MainActivity.java';
const java = fs.existsSync(CHEMIN_JAVA) ? fs.readFileSync(CHEMIN_JAVA, 'utf8') : null;
const sansJava = java
  ? false
  : `arborescence Android absente ici (${CHEMIN_JAVA}) — ce contrôle tourne sur le NAS`;
if (!java) console.log('# MainActivity.java introuvable : vérification du pont Android SAUTÉE (pas en échec).');

test('chaque carte porte un bouton de partage, sous l’heure de parution', () => {
  assert.match(js, /class="ligne-partage"/, 'la ligne de partage doit exister dans la carte');
  assert.match(js, /class="partager" data-id=/, 'le bouton doit porter l’identifiant de l’offre');
  assert.match(js, /<svg viewBox="0 0 24 24"/, 'l’icône de partage doit être un SVG');
  // La ligne de partage vient APRÈS le bloc « bas » (bouton + heure).
  const iBas = js.indexOf('class="bas"');
  const iPartage = js.indexOf('class="ligne-partage"');
  assert.ok(iBas > 0 && iPartage > iBas, 'le partage doit suivre l’heure de parution');
});

test('les trois voies de partage existent, dans le bon ordre', () => {
  // Ancre sur le CODE, pas sur les mots : « navigator.share » apparaît aussi
  // dans le commentaire qui explique justement pourquoi on ne peut pas s'y fier.
  const pont = js.indexOf('window.AndroidPartage && typeof window.AndroidPartage.partager');
  const natif = js.indexOf('if (navigator.share) {');
  const repli = js.indexOf('ouvrirMenuPartage(o.titre, texte, lien, bouton)');
  assert.ok(pont > 0, 'le pont Android doit être appelé en premier');
  assert.ok(natif > pont, 'navigator.share vient après le pont');
  assert.ok(repli > natif, 'le repli par liens directs vient en dernier');
});

test('le repli propose de VRAIS liens, qui marchent sans aucune API', () => {
  assert.match(js, /https:\/\/wa\.me\/\?text=/, 'un lien WhatsApp direct');
  assert.match(js, /mailto:\?subject=/, 'un lien e-mail direct');
  assert.match(js, /navigator\.clipboard\.writeText/, 'la copie du lien');
});

test('le lien partagé est celui de KAZENDRA, pas celui du marchand', () => {
  // CHANGÉ le 09/10/2026, sur demande de B : « Quand on fait un partage,
  // actuellement ça affiche directement le lien Amazon, mais il n'y a pas de
  // trace de Kazendra. Donc pas de publicité pour nous gratuite. »
  //
  // On envoie désormais notre page d'offre (kazendra.com/o/<id>.html) : elle
  // porte les balises Open Graph, donc la conversation affiche une carte
  // KAZENDRA, et son bouton mène au même lien affilié qu'avant. La commission
  // est inchangée ; la marque, elle, s'affiche à chaque partage.
  const m = js.match(/function lienPartage\([^)]*\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'lienPartage() doit exister');
  assert.match(m[0], /SITE_PARTAGE/, 'le partage doit envoyer une adresse de Kazendra');
  assert.match(m[0], /encodeURIComponent\(o\.id\)/, 'l’adresse doit porter l’identifiant de l’offre');
  assert.doesNotMatch(m[0], /lienAffilie/,
    'le partage ne doit plus envoyer le lien du marchand : c’est l’objet de la demande');
  // L'adresse publique ne doit PAS suivre l'hébergement courant : le hub local
  // ne répond pas chez la personne qui reçoit le lien.
  assert.match(js, /const SITE_PARTAGE = 'https:\/\/kazendra\.com';/,
    'l’adresse partagée doit être le domaine public');
  assert.match(m[0], /\.html`/, 'l’adresse doit désigner la page écrite par la publication');
});

test('le pont Android ouvre une vraie feuille de partage', { skip: sansJava }, () => {
  assert.match(java, /addJavascriptInterface\(new Partage\(\), "AndroidPartage"\)/,
    'l’interface doit être exposée au WebView sous le nom AndroidPartage');
  assert.match(java, /Intent\.ACTION_SEND/, 'il faut une intention de partage');
  assert.match(java, /Intent\.createChooser/, 'et le sélecteur d’applications');
  assert.match(java, /@JavascriptInterface/, 'sans cette annotation, l’appel JS est ignoré en silence');
  // Le lien doit voyager DANS le texte : certains clients ignorent EXTRA_TEXT vide.
  assert.match(java, /EXTRA_TEXT, texte \+ "\\n" \+ url/,
    'le texte partagé doit contenir l’adresse');
});

test('le bouton de partage est une icône seule, discrète mais lisible', () => {
  assert.match(css, /\.partager \{/, 'le style du bouton doit exister');
  assert.match(css, /\.menu-partage \{/, 'le style du menu de repli doit exister');
  // L'icône porte le sens à elle seule : elle doit rester petite, mais assez
  // grande pour être visée au pouce — un carré de 34 px, glyphe de 19 px.
  assert.match(css, /\.partager svg \{ width: 19px; height: 19px;/,
    'l’icône doit rester petite');
  assert.match(css, /\.partager \{[^}]*width: 34px; height: 34px;/s,
    'le bouton doit être un carré d’icône, pas une pastille à texte');
});

test('le bouton de partage ne porte QUE la flèche, pas le mot « Partager »', () => {
  // Demande de B : les utilisateurs connaissent cette flèche, le mot est du
  // bruit. La flèche est celle que Facebook et WhatsApp emploient — un trait
  // qui revient sur la gauche et se termine par une pointe à DROITE.
  const bloc = js.match(/<button class="partager"[\s\S]*?<\/button>/);
  assert.ok(bloc, 'le bouton de partage doit exister');
  assert.ok(!/<span>/.test(bloc[0]),
    'le bouton ne doit afficher aucun mot : seulement la flèche');
  // Sans nom accessible, un lecteur d'écran annoncerait un bouton muet.
  assert.match(bloc[0], /aria-label="/, 'il doit garder un nom pour les lecteurs d’écran');
  assert.match(bloc[0], /title="/, 'et une infobulle au survol');
  // La pointe est à droite (x=21) : c'est la flèche de partage, pas la flèche
  // « téléverser vers le haut » qui était là avant.
  assert.match(bloc[0], /M14 9V5l7 7-7 7/, 'la flèche de partage doit pointer à droite');
  assert.ok(!/M12 2\.6/.test(bloc[0]), 'l’ancienne flèche montante doit avoir disparu');
});
