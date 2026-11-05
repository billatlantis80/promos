/**
 * Tests du nettoyage du texte des sources — application n°2 « Promos ».
 *
 * Défaut visé : des entités HTML brutes affichées à l'écran
 * (« Xiaomi 15&#160;: … ») parce que le décodeur ne connaissait que six entités
 * nommées et ne faisait qu'une seule passe (d'où « B&amp;amp;M »).
 *
 * Lancement : node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decoderEntites, decaper, nettoyer } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ *
 *  Entités numériques — le cas qui s'affichait littéralement.
 * ------------------------------------------------------------------ */
test('décode les entités numériques décimales', () => {
  assert.equal(decaper('d&#8217;or'), 'd\u2019or');
  assert.equal(decaper('l&#039;offre'), "l'offre");
  assert.equal(decaper('a&#8230;b'), 'a\u2026b');
  assert.equal(decaper('100&#176;C'), '100\u00b0C');
});

test('décode les entités numériques hexadécimales', () => {
  assert.equal(decaper('&#x27;'), "'");
  assert.equal(decaper('&#x2019;'), '\u2019');
  assert.equal(decaper('&#x20AC;'), '\u20ac');
});

test("l'espace insécable d'un titre devient une espace normale après nettoyage", () => {
  // Le cas exact vu à l'écran : « Xiaomi 15&#160;: ce n'est plus le roi ».
  const t = nettoyer('Xiaomi 15&#160;: ce n\u2019est plus le roi');
  assert.equal(t, 'Xiaomi 15 : ce n\u2019est plus le roi');
  assert.ok(!t.includes('&#'), 'aucune entité ne doit subsister');
  assert.ok(!/[\u00a0]/.test(t), 'aucun espace insécable ne doit subsister');
});

/* ------------------------------------------------------------------ *
 *  Double encodage — « B&amp;amp;M » doit valoir « B&M ».
 * ------------------------------------------------------------------ */
test('décode le double encodage', () => {
  assert.equal(decaper('B&amp;amp;M'), 'B&M');
  assert.equal(nettoyer('B&amp;amp;M'), 'B&M');
  assert.equal(decaper('&amp;lt;b&amp;gt;'), '<b>');
});

test('les entités nommées restent décodées', () => {
  assert.equal(nettoyer('B&amp;M'), 'B&M');
  assert.equal(nettoyer('caf&eacute;'), 'café');
  assert.equal(nettoyer('3&nbsp;m&egrave;tres'), '3 mètres');
});

/* ------------------------------------------------------------------ *
 *  Non-régression : ce qui n'est PAS une entité ne doit pas bouger.
 * ------------------------------------------------------------------ */
test('un « & » isolé n\u2019est pas une entité', () => {
  assert.equal(decaper('Rapport 50% & plus'), 'Rapport 50% & plus');
  assert.equal(decaper('B&M'), 'B&M');
});

test('une entité inconnue est laissée telle quelle', () => {
  assert.equal(decaper('&pasuneentite;'), '&pasuneentite;');
  assert.equal(decaper('&#xZZ;'), '&#xZZ;');
});

test('le nettoyage est idempotent', () => {
  const depart = '<![CDATA[<b>Promo</b> Xiaomi 15&#160;: &amp;amp; plus]]>';
  const une = nettoyer(depart);
  assert.equal(nettoyer(une), une);
});

test('CDATA et balises sont retirés', () => {
  assert.equal(nettoyer('<![CDATA[<b>Promo</b> à 10 €]]>'), 'Promo à 10 €');
});

/* ------------------------------------------------------------------ *
 *  Garde-fou sur les données réelles : aucune entité ne doit atteindre
 *  l'écran. C'est ce contrôle qui aurait attrapé le défaut en production.
 * ------------------------------------------------------------------ */
const MOTIF_ENTITE = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/;

function resumes(offre) {
  return offresTexte(offre).filter(([champ, v]) => MOTIF_ENTITE.test(v));
}
function offresTexte(o) {
  return ['titre', 'marchand', 'source'].map((k) => [k, String(o[k] || '')]);
}

test('les données collectées ne contiennent aucune entité HTML résiduelle', () => {
  const fichier = path.join(ICI, '..', 'data', 'offres.json');
  if (!fs.existsSync(fichier)) return; // pas encore de collecte : rien à vérifier
  const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const fautives = [];
  for (const o of d.offres || []) {
    for (const [champ, v] of offresTexte(o)) {
      if (MOTIF_ENTITE.test(v)) fautives.push(`${champ}: ${v.slice(0, 80)}`);
    }
  }
  assert.equal(
    fautives.length, 0,
    `entités lisibles à l'écran :\n  ${fautives.slice(0, 8).join('\n  ')}`,
  );
});

test('le nettoyage répare une donnée déjà engrangée', () => {
  const legacy = { titre: 'Lot de lampes chez B&amp;amp;M', marchand: 'B&amp;amp;M' };
  // Avant : l'entité est bien là (c'est le cas des offres fusionnées).
  assert.equal(resumes(legacy).length, 2);
  // Après le décapage que fait la fusion : plus aucune entité visible.
  const repare = Object.fromEntries(Object.entries(legacy).map(([k, v]) => [k, decaper(v)]));
  assert.deepEqual(resumes(repare), []);
  assert.equal(repare.marchand, 'B&M');
});
