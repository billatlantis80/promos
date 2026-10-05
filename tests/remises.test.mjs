/**
 * Lecture des REMISES ÉCRITES — application n°2 « Promos ».
 *
 * C'est le cœur de la demande « se concentrer sur de vraies promotions » : une
 * remise n'est affichée que si la source l'écrit. Ce fichier fixe donc les deux
 * bords, et le second compte autant que le premier :
 *
 *   • ce qui DOIT être lu — « 50 % Rabatt », « 15 % korting », « 30 % off »,
 *     « à 69,99 € (-12%) ». Le code ne connaissait que la forme française signée
 *     (« -12 % ») : mesuré sur les données publiées, 416 offres annonçaient un
 *     pourcentage sans qu'il soit enregistré, dont 294 accompagnées d'un mot de
 *     promotion. C'étaient de vraies promotions, perdues.
 *
 *   • ce qui NE DOIT PAS l'être — « jusqu'à -84 % », « bis zu 25 % », « up to
 *     50 % Off » (des maximums, pas une remise sur le produit affiché) et
 *     « 1,5 % Fett », « 3,5 % » (des taux, pas des remises). Un faux pourcentage
 *     est pire que pas d'offre : il fait acheter.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pourcentEcrit } from '../collecteur.mjs';

test('le signe moins est lu, dans toutes ses écritures', () => {
  assert.equal(pourcentEcrit('Casque Bose à 189,99 € (-12%)'), 12);
  assert.equal(pourcentEcrit('Bon plan : -30 % sur le robot'), 30);
  assert.equal(pourcentEcrit('Steam - 70% korting op Cyberpunk'), 70);
});

test('un pourcentage accompagné d’un mot de promotion est lu', () => {
  // C'est ce que publient les sites d'entraide allemands, néerlandais, anglais :
  // le pourcentage n'est pas signé, mais le mot dit ce qu'il est.
  assert.equal(pourcentEcrit('[Netto] 50% Rabatt auf alle Fahrten'), 50);
  assert.equal(pourcentEcrit('[hema] 15% korting krijg je altijd'), 15);
  assert.equal(pourcentEcrit('15% off everything with code'), 15);
  assert.equal(pourcentEcrit('Puma Sneaker im Angebot 30 %'), 30);
  assert.equal(pourcentEcrit('Sconto del 20% su tutta la collezione'), 20);
  assert.equal(pourcentEcrit('Descuento del 25% en electrónica'), 25);
  assert.equal(pourcentEcrit('Promocja 40% na wszystko'), 40);
});

test('les formules d’ACCROCHE sont refusées, dans TOUTES les langues', () => {
  // « jusqu'à », « bis zu », « up to » annoncent un maximum : la remise du
  // produit affiché est inconnue. L'afficher serait fabriquer une remise.
  assert.equal(pourcentEcrit('Jusqu’à -84 % sur une sélection'), null);
  assert.equal(pourcentEcrit('bis zu 25 % Rabatt auf das Sortiment'), null);
  assert.equal(pourcentEcrit('Up to 50% off Character Clothing'), null);
  assert.equal(pourcentEcrit('tot 50% korting bij Hubo'), null);
  assert.equal(pourcentEcrit('fino a 30% di sconto'), null);
  assert.equal(pourcentEcrit('hasta 60% de descuento'), null);
  // Ces deux-là sont passés au premier essai : le portugais et le suédois
  // n'étaient pas dans la liste. Vérifiés sur les données réellement publiées.
  assert.equal(pourcentEcrit('descontos de até 95% em juros e multas'), null);
  assert.equal(pourcentEcrit('Jogos de PC em oferta com até 95% de desconto'), null);
  assert.equal(pourcentEcrit('PS Store Sale mit bis zu 92% Rabatt, neue Angebote'), null);
});

test('un pourcentage qui exprime une PROPORTION est refusé', () => {
  // « 95 % des joueurs » n'est pas une remise de 95 %. Ces taux entraient comme
  // remises tant que « % de/of/av » n'était pas reconnu — et une remise à 95 %
  // fait acheter.
  assert.equal(pourcentEcrit('Ce jeu, aimé par 95 % des joueurs, est en solde'), null);
  assert.equal(pourcentEcrit('95% of players agree'), null);
  // …mais la vraie remise de la même phrase est bien lue.
  assert.equal(pourcentEcrit('Ce jeu, aimé par 95 % av spelarna, har 85 % rabatt'), 85);
  assert.equal(pourcentEcrit('PS Store Sale mit bis zu 92% Rabatt, jetzt 85% Rabatt'), 85);
});

test('un pourcentage qui n’est PAS une remise est refusé', () => {
  assert.equal(pourcentEcrit('Milsani Joghurt 1,5% Fett 500g (0,98€/kg)'), null);
  assert.equal(pourcentEcrit('Nintendo Switch 2 — 100% gratuit pendant 3 jours'), null);
  assert.equal(pourcentEcrit('Écran 27 pouces 165 Hz 1 ms'), null);
  assert.equal(pourcentEcrit('Lot de 2 mini microphones Lavalier sans fil'), null);
});

test('un pourcentage collé à un prix est lu même sans mot de promotion', () => {
  // L'ancrage sur un prix précis vaut preuve : « à 69,99 € (-12%) ».
  assert.equal(pourcentEcrit('Clavier Logitech MX Keys à 69,99 € (-12%) - Les Numériques'), 12);
  assert.equal(pourcentEcrit('Smartphone Samsung S25+ à 823,20 € (-28%)'), 28);
});

test('un pourcentage absurde n’est jamais retenu', () => {
  assert.equal(pourcentEcrit('Remise de -0 %'), null);
  assert.equal(pourcentEcrit('Gratuit à 100 %'), null);
  assert.equal(pourcentEcrit(''), null);
  assert.equal(pourcentEcrit(null), null);
});
