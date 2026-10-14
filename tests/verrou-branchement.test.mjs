/**
 * LE VERROU NE SE BRANCHE PLUS — PARCE QU'IL N'EXISTE PLUS (11/10/2026).
 * =============================================================================
 *
 * Défaut payé le 08/10/2026 : « Verrouiller maintenant » affichait l'écran de
 * verrouillage SANS AUCUN bouton branché — impossible de déverrouiller sans
 * recharger. D'où deux contrôles : le branchement doit avoir lieu à l'affichage
 * (pas seulement au démarrage), et il ne doit pas s'empiler (deux écouteurs
 * valideraient deux fois le même mot de passe).
 *
 * Ces deux contrôles visaient juste — et ils n'ont plus d'objet : B a retiré le
 * mot de passe, donc le compte local, donc le verrou. Le fichier est RETOURNÉ :
 * il exige que l'écran, la fonction d'affichage et le branchement aient disparu,
 * et que le démarrage n'attende plus rien avant de montrer les offres.
 *
 * Lancement : node --test tests/verrou-branchement.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const APP = lire('public/app.js');
const HTML = lire('public/index.html');

test('l’écran de verrouillage a disparu de la page', () => {
  assert.doesNotMatch(HTML, /id="verrou"|class="verrou/,
    'la page ne doit plus porter d’écran de verrouillage');
  for (const id of ['verrouMdp', 'verrouOk', 'verrouOublie', 'verrouErreur', 'verrouIntro', 'titreVerrou']) {
    assert.ok(!HTML.includes(`id="${id}"`), `#${id} doit avoir disparu de la page`);
  }
});

test('plus rien ne s’affiche par montrerVerrou(), et plus rien ne se branche', () => {
  assert.doesNotMatch(APP, /montrerVerrou/, 'l’affichage du verrou doit avoir disparu');
  assert.doesNotMatch(APP, /brancherVerrou/, 'le branchement du verrou doit avoir disparu');
  assert.ok(!APP.includes('verrouBranche'),
    'le drapeau anti-empilement n’a plus de raison d’être : il n’y a plus d’écouteurs à poser');
});

test('le démarrage n’attend plus aucun mot de passe', () => {
  // Le seul état qui pouvait retarder l’affichage était le verrou. Le démarrage
  // appelle maintenant lancer() directement, après avoir purgé le vestige du
  // compte local laissé sur les appareils déjà installés.
  const m = APP.match(/function lancerAuDemarrage\(\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'lancerAuDemarrage() doit exister');
  assert.match(m[0], /purgerVestigeDeCompte\(\)/, 'le vestige doit être purgé au démarrage');
  assert.match(m[0], /lancer\(\)/, 'les offres doivent être chargées sans condition');
  assert.doesNotMatch(m[0], /return/, 'plus aucune condition ne doit retarder l’affichage');
});
