/**
 * Lecture du prix de référence d'une page d'enseigne — application n°2.
 *
 * Ce fichier existe à cause d'un manque mesuré : le JSON-LD d'une page
 * d'enseigne ne publie QUE le prix demandé. Le prix de référence vit ailleurs,
 * dans la charge interne de la page, échappé dans le HTML. Sans le lire, aucune
 * remise n'était calculable et l'application affichait des catalogues à prix nu.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { prixReferenceEnseigne } from '../collecteur.mjs';

/** Reproduit la charge interne d'une page : guillemets échappés inclus. */
const charge = (nom, liste, prix) => `{\\"product\\":{\\"name\\":\\"${nom}\\",`
  + `\\"listPrice\\":{\\"includingVat\\":${liste},\\"excludingVat\\":0},`
  + `\\"salesPrice\\":{\\"includingVat\\":${prix},\\"excludingVat\\":0}}}`;

test('le prix de référence est lu dans la charge interne de la page', () => {
  const t = prixReferenceEnseigne(charge('Braun Silk-épil 9 9-030 Argent', 81, 69));
  assert.equal(t.get('Braun Silk-épil 9 9-030 Argent'), 81, 'la référence doit être retenue');
});

test('un listPrice à 0 n’est PAS une référence', () => {
  // C'est l'aveu du marchand qu'il n'y a pas de prix de référence — le retenir
  // fabriquerait une remise de 100 %. Mesuré : c'est le cas de 17 produits sur
  // 22 sur la page examinée.
  const t = prixReferenceEnseigne(charge('Bosch HLN39A050U', 0, 816));
  assert.equal(t.size, 0, 'aucune référence ne doit sortir d’un listPrice à 0');
});

test('une référence inférieure au prix de vente est ignorée', () => {
  // Sinon on afficherait une remise négative.
  const t = prixReferenceEnseigne(charge('Produit', 50, 80));
  assert.equal(t.size, 0);
});

test('chaque produit garde SA référence', () => {
  const html = charge('Produit A', 100, 80) + charge('Produit B', 0, 50) + charge('Produit C', 200, 150);
  const t = prixReferenceEnseigne(html);
  assert.equal(t.get('Produit A'), 100);
  assert.equal(t.get('Produit B'), undefined);
  assert.equal(t.get('Produit C'), 200);
  assert.equal(t.size, 2, 'deux produits ont une vraie référence, le troisième non');
});

test('une page sans prix de référence ne rend rien — et ne casse rien', () => {
  assert.equal(prixReferenceEnseigne('<html><body>rien</body></html>').size, 0);
  assert.equal(prixReferenceEnseigne('').size, 0);
});
