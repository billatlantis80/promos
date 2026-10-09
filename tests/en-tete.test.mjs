/**
 * L'EN-TÊTE : ce que l'utilisateur voit en haut à droite.
 *
 * Demande de B : la répartition « ≈ 60 % Amazon · 40 % enseignes & presse » ne
 * doit PAS être visible — c'est un réglage de programmation, pas une information
 * pour l'utilisateur. Il doit rester DEUX lignes : le nombre de bonnes promos,
 * et la date de mise à jour.
 *
 * Le mélange 60/40, lui, continue d'exister et reste testé (tests/melange.test.mjs).
 *
 * Lancement : node --test tests/en-tete.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');

test('la répartition Amazon / enseignes n’est JAMAIS affichée', () => {
  const interdits = ['% Amazon', 'enseignes & presse', 'pcAmz', 'nAmz'];
  const restes = interdits.filter((m) => js.includes(m));
  assert.deepEqual(restes, [],
    `la proportion interne est visible à l'écran : ${restes.join(', ')}`);
});

test('l’en-tête garde trois lignes : promos, total, mise à jour', () => {
  // Demande de B (07/10/2026) : « Entre les deux, sur la deuxième ligne, on va
  // écrire le nombre total de promotion, “11494 promotions”. » Le total
  // s'insère DONC entre le nombre de bonnes promos et la date de mise à jour —
  // trois lignes, et dans cet ordre. Sans le total, « 2 415 » ne situe rien.
  const i = js.indexOf("$('comptes').innerHTML");
  assert.ok(i > 0, "l'en-tête doit être alimenté");
  const ligne = js.slice(i, js.indexOf(';', i));
  assert.match(ligne, /t\('bonnes promos'\)/, 'le nombre de bonnes promos doit rester');
  assert.match(ligne, /t\('\{n\} promotions'/, 'le total des promotions doit être affiché');
  assert.match(ligne, /t\('mis à jour \{n\}'/, 'la date de mise à jour doit rester');
  const sauts = (ligne.match(/<br>/g) || []).length;
  assert.equal(sauts, 2, `trois lignes = deux <br>, trouvé ${sauts}`);
  // L'ORDRE est le cœur de la demande : le total est la DEUXIÈME ligne.
  const posTotal = ligne.indexOf("'{n} promotions'");
  const posMaj = ligne.indexOf("'mis à jour {n}'");
  assert.ok(posTotal > 0 && posMaj > posTotal,
    'le total doit venir APRÈS les bonnes promos et AVANT la mise à jour');
});

test('le total de l’en-tête est celui de « Tous les pays »', () => {
  // Demande de B (08/10/2026) : « Ce chiffre doit tout simplement correspondre
  // au total qui est indiqué dans tous les pays. » Le sélecteur de pays annonce
  // « Tous les pays (N) », N valant etat.offres.length. La deuxième ligne de
  // l'en-tête doit lire EXACTEMENT la même source. Jusqu'ici elle lisait
  // meta.totalOffres, qui ne compte que les promotions « vraies » : deux
  // nombres différents s'affichaient donc côte à côte pour la même grandeur
  // (9 782 dans l'en-tête contre 11 325 dans le sélecteur) — l'utilisateur a vu
  // l'écart et l'a signalé.
  // On cherche la branche DANS dessiner() : « if (etat.portee === 'promos') »
  // apparaît aussi dans comparateur() (l'ordre chronologique des bonnes promos).
  // S'ancrer sur la PREMIÈRE occurrence du fichier faisait dépendre cette
  // épreuve de l'ordre des fonctions — un faux échec garanti à la prochaine
  // règle qui écrira la même condition.
  const iDessiner = js.indexOf('function dessiner()');
  assert.ok(iDessiner > 0, 'dessiner() doit exister');
  const i = js.indexOf("if (etat.portee === 'promos')", iDessiner);
  assert.ok(i > 0, 'la branche « bonnes promos » doit exister');
  const bloc = js.slice(i, js.indexOf('} else {', i));
  assert.match(bloc, /const totalPromos = etat\.offres\.length;/,
    'le total doit venir du même compteur que « Tous les pays »');
  // On contrôle le CODE, pas la prose : le commentaire qui explique la
  // correction nomme « meta.totalOffres », et un simple recherche de mot
  // accusait donc le fichier juste. Les commentaires sont retirés d'abord.
  const code = bloc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /totalOffres/,
    'meta.totalOffres ne compte pas tous les pays : plus sur cette ligne');
  // Et le sélecteur doit bien compter cette liste-là, sinon le contrôle
  // ci-dessus se contenterait de comparer l'en-tête à une autre source.
  assert.match(js, /t\('Tous les pays \(\{n\}\)', \{ n: etat\.offres\.length \}\)/,
    'le sélecteur de pays doit compter la même liste');
});

test('le mélange 60/40 n’a pas été supprimé du programme', () => {
  // Ce qui disparaît, c'est l'AFFICHAGE — pas la règle. Le mélange reste.
  assert.match(js, /melanger\(dedoublonner\(etat\.offres\.filter\(estBonnePromo\)\)\)/,
    'le mélange doit continuer de décider ce qui est affiché');
});

test('la marque ramène à l’accueil, et remet la vue d’accueil à neuf', () => {
  // Demande de B (09/10/2026) : « quand on clique sur l'icône en haut à gauche,
  // il faudrait que ça refasse un refresh sur la page d'accueil ». L'icône ne
  // faisait RIEN : aucun écouteur n'y était posé.
  const html = fs.readFileSync(path.join(ICI, '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /class="marque" id="marque"[^>]*role="button"[^>]*tabindex="0"/,
    'la marque doit être joignable (#marque) et se comporter comme un bouton (clavier)');

  const m = js.match(/function retourAccueil\(\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'retourAccueil() doit exister');
  const corps = m[0];
  // Ce qui repart à neuf : les filtres du moment et la pagination.
  for (const champ of ['categorie', 'marchand', 'portee', 'tri', 'recherche', 'affichees']) {
    assert.match(corps, new RegExp(`etat\\.${champ}\\s*=`),
      `retourAccueil() doit remettre ${champ}`);
  }
  // Les champs de saisie doivent suivre, sinon l'écran montre encore l'ancien
  // texte alors que le filtre, lui, est bien vidé — un écart qui ne se voit pas.
  assert.match(corps, /\$\('recherche'\)[\s\S]*?\.value = ''/, 'le champ de recherche doit se vider à l’écran');
  assert.match(corps, /\$\('tri'\)[\s\S]*?\.value = 'promos'/, 'le sélecteur doit revenir sur « Bonnes promos »');
  assert.match(corps, /dessiner\(\)/, 'la liste doit être redessinée');
  assert.match(corps, /scrollTo/, 'l’écran doit remonter en haut');
  // Ce qu'on ne touche PAS : des PRÉFÉRENCES, pas des filtres du moment.
  assert.doesNotMatch(corps, /etat\.(eco|favoris|pays)\s*=/,
    'pays, économie de données et favoris sont des préférences : pas au clic sur le logo');
  // Et pas de retéléchargement : le catalogue pèse 13 Mo.
  assert.doesNotMatch(corps, /chargerDonnees|fetch\s*\(/,
    'on ne retélécharge pas le catalogue à chaque clic sur le logo');
  // LE BRANCHEMENT. Une fonction juste que personne n'appelle est le piège déjà
  // payé plusieurs fois dans ce projet : on lit la ligne d'appel, pas la
  // présence de la fonction.
  assert.match(js, /\$\('marque'\)\.addEventListener\('click', retourAccueil\)/,
    'retourAccueil() doit être branchée sur #marque');
  assert.match(js, /\$\('marque'\)\.addEventListener\('keydown'/,
    'le clavier doit pouvoir activer la marque (role="button" oblige)');
});
