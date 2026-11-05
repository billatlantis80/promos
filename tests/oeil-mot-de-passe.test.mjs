/**
 * LE PETIT ŒIL A DISPARU AVEC LES CHAMPS DE MOT DE PASSE (11/10/2026).
 * =============================================================================
 *
 * B avait demandé l'œil le 11/10/2026 : « il faut mettre la petite oeil a droite
 * pour cacher ou pour faire apparaître le mot de passe. Car une fois tapé on ne
 * voit que des étoiles ». Il avait raison — et le même jour, il a retiré ce qui
 * le rendait nécessaire : « la partie mot de passe et mot de passe a répété, le
 * mot de passe peut disparaître car il n'y a pas de connexion. il y a juste une
 * adresse mail qui est donné pour recevoir la newsletter. »
 *
 * Un œil sans champ à relire est un ornement. Ce fichier exigeait sa présence aux
 * quatre endroits (les six champs, l'écran de verrouillage, le branchement, les
 * deux phrases) ; il exige maintenant leur ABSENCE — c'est ce qui empêche le
 * retour d'un champ de mot de passe par une greffe partielle.
 *
 * Lancement : node --test tests/oeil-mot-de-passe.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const APP = lire('public/app.js');
const HTML = lire('public/index.html');
const CSS = lire('public/app.css');
const LANGUES = lire('public/langues.js');

test('aucun champ de mot de passe dans la page', () => {
  assert.equal((HTML.match(/type="password"/g) || []).length, 0,
    'la page ne doit plus contenir un seul champ de mot de passe');
  assert.doesNotMatch(HTML, /data-oeil/, 'aucune cible d’œil ne doit subsister');
});

test('le programme ne dessine plus ni œil ni champ de mot de passe', () => {
  assert.doesNotMatch(APP, /champMotDePasse|OEIL_OUVERT|OEIL_BARRE/,
    'le gabarit du champ de mot de passe doit avoir disparu');
  assert.doesNotMatch(APP, /basculerOeil|appliquerOeil|preparerOeils/,
    'le basculement et le libellé de l’œil doivent avoir disparu');
  assert.doesNotMatch(APP, /closest\('\.oeil'\)/,
    'l’écouteur délégué de l’œil doit avoir disparu : un écouteur qui ne trouve jamais sa cible laisse croire que la fonction existe');
});

test('la feuille ne style plus l’œil ni les deux champs côte à côte', () => {
  assert.doesNotMatch(CSS, /\.oeil|avec-oeil|aide-champ|champs-mdp/,
    'les règles de l’œil et des deux mots de passe doivent avoir disparu');
});

test('les deux phrases de l’œil ont quitté les neuf dictionnaires', () => {
  for (const cle of ['Montrer le mot de passe', 'Cacher le mot de passe']) {
    const motif = new RegExp(`^\\s*(['"])${cle}\\1:`, 'gm');
    assert.equal((LANGUES.match(motif) || []).length, 0,
      `« ${cle} » est encore traduit alors que l’écran ne l’affiche plus`);
  }
});
