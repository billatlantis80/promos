/**
 * L'ÉCRAN DE SECOURS — le site ne doit JAMAIS rester vide et muet.
 *
 * DÉFAUT RÉEL, rapporté par B le 08/10/2026 : « quand j'ai pris mon PC, le
 * site ne s'affiche pas correctement ». Vérifié en servant le site sans
 * `app.js` : kazendra.com n'affichait QUE l'en-tête et « chargement… »,
 * définitivement, sans un mot d'explication.
 *
 * La cause n'était pas un accident : le site charge UN SEUL script,
 * `<script type="module">`. Internet Explorer 11 — et tout navigateur
 * antérieur à Chrome 61 — ignore les modules ES : il n'exécutait rien. Et
 * `app.js` emploie `?.` plus de 2 000 fois, ce qui exige Chrome 80
 * (février 2020) : un navigateur intermédiaire lit le fichier, ÉCHOUE À
 * L'ANALYSER, et meurt avant la première ligne. Dans les deux cas : aucune
 * erreur visible, page vide. Le pire des deux mondes.
 *
 * CE QUE CE FICHIER PROTÈGE — quatre choses, et chacune a déjà été cassée :
 *
 *   1. L'ABSENCE DE REPLI. `<noscript>` (JavaScript coupé) et
 *      `<script nomodule>` (navigateurs sans modules ES) doivent exister.
 *      `nomodule` est le seul mécanisme qui parle à IE11 : il faut qu'il soit
 *      là, et en ES5 — sinon il ne serait pas LU par le navigateur auquel il
 *      s'adresse.
 *
 *   2. LE TÉMOIN DE DÉMARRAGE. La sentinelle ne peut distinguer « le programme
 *      n'a pas tourné » de « la connexion est lente » que si `app.js` pose un
 *      témoin. Il doit être posé AVANT toute lecture de données : posé après,
 *      une connexion lente ferait afficher à tort « le site n'a pas pu
 *      démarrer ».
 *
 *   3. LE DÉLAI. Il doit DÉPASSER les 15 s que s'accorde `app.js` pour
 *      télécharger les offres. Plus court, la sentinelle parlerait pendant que
 *      l'application est encore en train de réussir.
 *
 *   4. LA PAGE DE DIAGNOSTIC EN ES5. Elle doit s'ouvrir et répondre LÀ OÙ
 *      l'application ne s'ouvre pas — donc dans IE11. Une seule flèche `=>`,
 *      un seul gabarit de chaîne, et le diagnostic meurt exactement du mal
 *      qu'il est censé diagnostiquer. C'est le piège central de ce fichier.
 *
 * TROIS FOIS CE TEST S'EST TROMPÉ EN S'ÉCRIVANT, et c'est instructif :
 *   - il cherchait `<script nomodule>` et tombait sur le COMMENTAIRE qui
 *     l'explique ;
 *   - il repérait la sentinelle par le texte « FILET N°3 » — un commentaire ;
 *   - il retirait les chaînes avant les commentaires, et les apostrophes
 *     françaises des commentaires (« l'en-tête ») ouvraient de fausses
 *     chaînes qui mettaient le fichier en lambeaux.
 * On repère donc les scripts PAR LEUR CONTENU, jamais par un commentaire.
 *
 * Lancement : node --test tests/ecran-de-secours.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');

/* Le balisage RÉEL : les commentaires parlent des balises, on les écarte. */
const html = lire('index.html').replace(/<!--[\s\S]*?-->/g, '');
const app = lire('app.js');
const diag = lire('diagnostic.html').replace(/<!--[\s\S]*?-->/g, '');

/** Tous les scripts EN LIGNE de la page, avec leurs attributs. */
const scriptsEnLigne = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .map((m) => ({ attributs: m[1], corps: m[2] }));
const nomodule = scriptsEnLigne.find((s) => /\bnomodule\b/.test(s.attributs));
const sentinelle = scriptsEnLigne.find((s) => /KAZENDRA_PRET/.test(s.corps) && /setTimeout/.test(s.corps));

/** Retire commentaires PUIS chaînes — dans cet ordre, et pas l'inverse. */
function sansCommentairesNiChaines(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/* ------------------------------------------------------------- 1. les replis -- */

test('l’index prévient quand JavaScript est coupé', () => {
  const bloc = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(bloc, 'aucun <noscript> : JavaScript coupé = page vide et muette');
  assert.match(bloc[1], /JavaScript/i, 'le message doit nommer la cause');
});

test('l’index porte un script « nomodule » pour les navigateurs sans modules ES', () => {
  assert.ok(nomodule, 'aucun <script nomodule> : Internet Explorer 11 n’aurait aucun message');
  assert.match(nomodule.corps, /secours/, 'le script doit révéler le panneau de secours');
  assert.match(nomodule.corps, /trop ancien|2020/i, 'il doit dire que le navigateur est trop ancien');
  assert.match(html, /id="secours"[\s\S]*?diagnostic\.html/, 'le panneau doit offrir le test de diagnostic');
});

test('le script « nomodule » est en ES5 — sinon IE11 ne peut pas le lire', () => {
  assert.ok(nomodule, 'pas de script nomodule');
  const nu = sansCommentairesNiChaines(nomodule.corps);
  assert.ok(!/=>/.test(nu), 'une fonction fléchée empêcherait IE11 de lire ce script');
  assert.ok(!/`/.test(nu), 'un gabarit de chaîne empêcherait IE11 de lire ce script');
  assert.ok(!/\b(const|let)\s+[A-Za-z_$]/.test(nu), 'const/let ne sont pas sûrs dans IE11 : var');
  assert.match(nu, /\bvar\s/, 'le script doit déclarer avec var');
});

test('aucun script en ligne de l’index n’utilise de syntaxe post-ES5', () => {
  for (const s of scriptsEnLigne) {
    const nu = sansCommentairesNiChaines(s.corps);
    assert.ok(!/=>/.test(nu), `flèche hors chaîne dans un script en ligne : ${s.corps.slice(0, 60)}`);
    assert.ok(!/`/.test(nu), 'gabarit de chaîne hors chaîne dans un script en ligne');
  }
});

/* ------------------------------------------------------- 2. le témoin au bon moment -- */

test('app.js pose son témoin de démarrage', () => {
  assert.match(app, /window\.KAZENDRA_PRET\s*=\s*true/, 'app.js doit signaler son démarrage');
});

test('le témoin est posé AVANT toute lecture de données', () => {
  const iTemoin = app.indexOf('window.KAZENDRA_PRET = true');
  const iDonnees = app.indexOf('async function chargerDonnees');
  const iAppel = app.indexOf('await chargerDonnees()');
  assert.ok(iTemoin > 0 && iDonnees > 0 && iAppel > 0, 'repères introuvables — le fichier a changé de forme');
  assert.ok(iTemoin < iDonnees && iTemoin < iAppel,
    'le témoin doit être posé avant le chargement : sinon une connexion lente fait accuser à tort le navigateur');
});

/* --------------------------------------------------------------- 3. la sentinelle -- */

test('la sentinelle ne parle que si le témoin est absent', () => {
  assert.ok(sentinelle, 'aucune sentinelle dans index.html');
  assert.match(sentinelle.corps, /window\.KAZENDRA_PRET/, 'elle doit consulter le témoin');
  assert.match(sentinelle.corps, /if\s*\(window\.KAZENDRA_PRET\)\s*\{\s*return/,
    'elle doit se taire si l’application a démarré');
});

test('le délai de la sentinelle dépasse celui de l’application', () => {
  assert.ok(sentinelle, 'aucune sentinelle');
  const m = sentinelle.corps.match(/\}\s*,\s*(\d+)\s*\)/);
  assert.ok(m, 'délai introuvable dans la sentinelle');
  const delai = Number(m[1]);
  const attente = Number(app.match(/const delai = DANS_APK \? (\d+) : (\d+);/)[2]);
  assert.ok(delai > attente,
    `sentinelle à ${delai} ms pour une application qui s’accorde ${attente} ms : elle parlerait pendant que l’application réussit`);
});

test('la sentinelle décrit les deux causes possibles', () => {
  assert.ok(sentinelle, 'aucune sentinelle');
  assert.match(sentinelle.corps, /trop ancien/i, 'elle doit nommer l’âge du navigateur');
  assert.match(sentinelle.corps, /antivirus|pare-feu|bloqueur/i, 'elle doit nommer le blocage réseau');
});

/* ------------------------------------------------- 4. le diagnostic doit survivre à IE11 -- */

test('la page de diagnostic existe et est liée', () => {
  assert.match(html, /href="diagnostic\.html"/, 'le panneau de secours doit pointer vers le diagnostic');
  assert.ok(lire('diagnostic.html').length > 2000, 'la page de diagnostic est vide');
});

test('la page de diagnostic est en ES5 — c’est tout son intérêt', () => {
  const scripts = [...diag.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1, 'aucun script dans le diagnostic');
  const nu = sansCommentairesNiChaines(scripts.join('\n'));

  assert.ok(!/=>/.test(nu), 'une fonction fléchée rendrait le diagnostic illisible dans IE11');
  assert.ok(!/`/.test(nu), 'un gabarit de chaîne rendrait le diagnostic illisible dans IE11');
  assert.ok(!/\b(const|let)\s+[A-Za-z_$]/.test(nu), 'const/let ne sont pas sûrs dans IE11');
  assert.ok(!/\?\./.test(nu), 'le chaînage optionnel est justement ce qu’on diagnostique');
  assert.match(nu, /\bvar\s/, 'le diagnostic doit déclarer avec var');
  assert.match(scripts.join('\n'), /new Function/, 'le diagnostic doit ÉPROUVER la syntaxe, pas la supposer');
});

test('la page de diagnostic n’est liée à aucun tiers et n’envoie rien', () => {
  const externes = [...diag.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(externes, [], `ressource externe interdite (règle du projet) : ${externes}`);
  assert.ok(!/google-analytics|hotjar|facebook|sentry/i.test(diag), 'aucun traqueur dans le diagnostic');
});
