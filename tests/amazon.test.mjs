/**
 * Contrôles de la source AMAZON — application n°2 « Promos ».
 *
 * Amazon est la source la plus fragile du projet, et sur trois plans :
 *
 *   1. sa page « offres » officielle est en JavaScript (423 Ko servis, zéro
 *      produit) — on lit donc la page de RECHERCHE filtrée, et ce choix doit
 *      rester explicite ;
 *   2. elle rend une page VIDE environ deux fois sur cinq (mesuré sur cinq
 *      appels) : ce n'est pas une panne, et confondre les deux ferait croire à
 *      un effacement du catalogue ;
 *   3. ses cartes contiennent PLUSIEURS prix — prix demandé, prix barré, prix à
 *      l'unité, prix au litre. Un extracteur naïf fabrique des remises de -90 %.
 *
 * Le troisième point est celui qui a réellement trompé : il a fallu regarder les
 * données publiées pour le voir. Les cas ci-dessous le reproduisent donc, au lieu
 * de se contenter de vérifier que « ça marche » sur un titre d'exemple.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { offresAmazon } from '../collecteur.mjs';

const source = { id: 'amazon-be-deals', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr' };

/* Fabrique une carte Amazon minimale, avec la structure RÉELLE des balises :
   le prix demandé et le prix barré se ressemblent techniquement, et le prix à
   l'unité vit dans une balise de la même famille. */
const carte = (asin, titre, { prix, barre, apres = '', img = true }) => `
<div data-asin="${asin}">
  <h2><a><span>${titre}</span></a></h2>
  ${img ? `<img src="https://m.media-amazon.com/images/I/${asin}xxx.jpg">` : ''}
  <span class="a-price" data-a-size="xl"><span class="a-offscreen">${prix}</span><span aria-hidden="true">${prix}</span></span>
  ${barre ? `<span class="a-price a-text-price" data-a-size="b"><span class="a-offscreen">${barre}</span></span>` : ''}
  ${apres}
</div>`;

const page = (...cartes) => `<html><body><div data-component-type="s-search-result">${cartes.join('\n')}</div></body></html>`;

test('Amazon : deux prix réels donnent une remise, calculée', () => {
  const o = offresAmazon(page(carte('B000000001', 'Casque audio sans fil', { prix: '5,40 €', barre: '6,64 €' })), source);
  assert.equal(o.length, 1);
  assert.equal(o[0].prix, 5.4);
  assert.equal(o[0].prixAvant, 6.64);
  assert.equal(o[0].remise, 19);
  assert.equal(o[0].remiseCalculee, true);
  assert.equal(o[0].marchand, 'Amazon');
  assert.equal(o[0].pays, 'BE');
  assert.equal(o[0].lienPage, 'https://www.amazon.com.be/dp/B000000001');
});

test('Amazon : le prix À L’UNITÉ n’est jamais pris pour un prix barré', () => {
  // Cas réel : « 15,99 € » puis, dans la même famille de balise, « 159,90 €/litre ».
  // Sans garde, cela produisait un parfum d'intérieur à -90 %.
  const html = page(carte('B000000002', "Parfum d'intérieur Reed Diffuser", {
    prix: '15,99 €',
    barre: '159,90 €',
    apres: '<span class="a-size-base">(<span class="a-price a-text-price"><span class="a-offscreen">159,90 €</span></span>/litre)</span>',
  }));
  const o = offresAmazon(html, source);
  assert.equal(o.length, 1);
  assert.equal(o[0].prix, 15.99);
  assert.equal(o[0].prixAvant, null, 'un prix au litre ne doit pas devenir un prix barré');
  assert.equal(o[0].remise, null);
});

test('Amazon : une référence cinq fois supérieure est écartée', () => {
  // Deuxième filet, indépendant du premier : même sans mention d'unité, un
  // rapport de 1 à 10 n'est pas une promotion, c'est une autre variante.
  const o = offresAmazon(page(carte('B000000003', 'Tapis de souris grand format', { prix: '10,00 €', barre: '200,00 €' })), source);
  assert.equal(o[0].prixAvant, null);
  assert.equal(o[0].remise, null);
});

test('Amazon : sans prix barré, aucune remise n’est inventée', () => {
  const o = offresAmazon(page(carte('B000000004', 'Chargeur USB C 25W', { prix: '15,99 €' })), source);
  assert.equal(o[0].prix, 15.99);
  assert.equal(o[0].remise, null);
  assert.equal(o[0].prixAvant, null);
});

test('Amazon : le titre est décodé, l’image et le pays suivent', () => {
  const o = offresAmazon(page(carte('B000000005', 'Set de 6 verres &amp; carafe &#x27;été&#x27;', { prix: '19,99 €' })), source);
  assert.ok(!/&[a-z#]/i.test(o[0].titre), `entité HTML non décodée : ${o[0].titre}`);
  assert.match(o[0].titre, /&/, 'le « &amp; » doit devenir un vrai « & »');
  assert.match(o[0].image, /^https:\/\/m\.media-amazon\.com\/images\//);
  assert.equal(o[0].sourceId, 'amazon-be-deals');
  assert.equal(o[0].type, 'offre');
});

test('Amazon : une page vide ne produit rien, et ne lève pas d’erreur', () => {
  // Deux appels sur cinq rendent une page sans produit. Le collecteur doit la
  // traiter comme « 0 retenue » — surtout pas comme un échec, qui ferait croire
  // à une panne, ni comme un effacement du catalogue.
  assert.deepEqual(offresAmazon('<html><body>page sans résultat</body></html>', source), []);
  assert.deepEqual(offresAmazon('', source), []);
});

test('Amazon : un même ASIN répété ne compte qu’une fois', () => {
  const o = offresAmazon(page(
    carte('B000000006', 'Aspirateur balai', { prix: '99,99 €' }),
    carte('B000000006', 'Aspirateur balai', { prix: '99,99 €' }),
  ), source);
  assert.equal(o.length, 1);
});

test('Amazon : la source est déclarée en Belgique, avec un repos long', async () => {
  const { TOUTES_SOURCES } = await import('../collecteur.mjs');
  const amz = TOUTES_SOURCES.filter((s) => s.type === 'amazon');
  assert.ok(amz.length >= 1, 'aucune source Amazon déclarée');
  for (const s of amz) {
    assert.equal(s.pays, 'BE', `${s.id} : Amazon Belgique doit porter le pays BE`);
    assert.ok(s.reposMin >= 60, `${s.id} : repos trop court (${s.reposMin}) — Amazon limite les appels rapprochés`);
    assert.equal(s.nom, 'Amazon');
    assert.match(s.url, /amazon\.com\.be/, `${s.id} : adresse hors Amazon Belgique`);
  }
});
