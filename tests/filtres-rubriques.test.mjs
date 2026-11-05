/**
 * Filtres des rubriques « Auto & moto » et « Jeux & jouets ».
 *
 * DEUX DEMANDES, et les deux défauts qu'elles ont mis au jour :
 *
 *   1. « La rubrique auto-moto ne contient aucun élément lié aux autos et aux
 *      motos. » Mesuré : sur 231 offres, la rubrique était surtout remplie par
 *      des mots de CIRCONSTANCE lus en sous-chaîne —
 *        « auto »  → « autonomie », « automatique », « Kaffeevollautomat »
 *        « moto »  → « Motorola »
 *        « band »  → « waistband », « armband », « tri-band »
 *        « wiel »  → « wielka promocja » (polonais : « grande promo »)
 *      La correction a DEUX moitiés, et aucune ne suffit seule : lire ces mots
 *      entre deux frontières (MOTS_A_FRONTIERE), ET nommer les vrais produits
 *      auto comme des mots forts (MOTS_FORTS.auto) — sans quoi la rubrique,
 *      nettoyée, restait vide.
 *
 *   2. « Tous les produits lego doivent être classés dans les jeux et jouets. »
 *      Mesuré : 9 offres LEGO sur 211 étaient ailleurs. « lego » est un PRODUIT
 *      NOMMÉ, donc un mot fort. Exception assumée et testée : un JEU VIDÉO LEGO
 *      (PS5, Xbox) reste en high-tech — voir JEU_NUMERIQUE.
 *
 * Chaque cas ci-dessous est un titre RÉEL de la collecte, ou sa forme épurée.
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { famille, classerOffre } from '../collecteur.mjs';

const F = (titre) => famille(titre, '');
const C = (titre) => classerOffre({ titre, categorieSource: '' });

test('« auto » et « moto » ne comptent plus comme sous-chaînes', () => {
  // Les trois titres qui polluaient la rubrique, mot pour mot.
  assert.notEqual(F('Autonomie 6 mois, sonnette sans fil'), 'auto', '« autonomie » n’est pas une auto');
  assert.notEqual(F('Philips Kaffeevollautomat LatteGo 3300'), 'auto', '« vollautomat » n’est pas une auto');
  assert.notEqual(F('Motorola Edge 70 5G'), 'auto', '« Motorola » n’est pas une moto');
  assert.notEqual(F('Anker kabel USB-C, iPhone, Samsung, Motoroli'), 'auto', 'le génitif « Motoroli » non plus');
});

test('mais « auto » et « moto » en tant que MOTS continuent de compter', () => {
  assert.equal(F('Casque moto intégral'), 'auto');
  assert.equal(F('Huile moteur 5W-30 4L'), 'auto');
  assert.equal(F('Plainte de pneus hiver Michelin'), 'auto', '« pneus » est un produit nommé');
  assert.equal(F('Akumulator samochodowy 12V 74Ah'), 'auto', '« akumulator » SEUL vise aussi une perceuse : ici c’est bien la batterie de voiture');
});

test('les mots glissants mesurés ne ramènent plus d’étrangers', () => {
  assert.notEqual(F('Calvin Klein 3 Pack Trunks Logo Waistband'), 'auto', '« waistband » (sous-vêtement)');
  assert.notEqual(F('Swarovski Symbolica Collectie armband'), 'auto', '« armband » (bijou)');
  assert.notEqual(F('wielka promocja w Biedronce'), 'auto', '« wielka » (polonais : « grande »)');
  assert.notEqual(F('Philips Hue LED Streifen, 75 Zoll'), 'auto', '« Streifen » (ruban) contient « reifen » (pneu)');
});

test('un composé allemand légitime traverse toujours la frontière', () => {
  // La frontière de mot ne doit pas casser les composés : « Winterreifen »,
  // « Autoreifen » et « Scheibenwischer » sont de vrais produits auto, et
  // « wagen » seul a été remplacé par les noms de véhicules.
  assert.equal(F('Winterreifen 205/55 R16'), 'auto');
  assert.equal(F('Autoreifen Sommerreifen 4er Set'), 'auto');
  assert.equal(F('Scheibenwischer Set für VW Golf'), 'auto');
  assert.equal(F('Volkswagen Passat Variant 2.0 TDI'), 'auto');
  // …et « wagen » ne fait plus tomber un chariot à main dans la rubrique auto.
  assert.notEqual(F('Fuxtec Bollerwagen & Fahrradanhänger'), 'auto', '« Bollerwagen » = chariot à main');
});

test('le filtre distinguE la perceuse sans fil de la batterie de voiture', () => {
  // « akumulator » (polonais) désigne AUSSI les batteries rechargeables.
  assert.equal(F('Bosch Professional Wiertarka Akumulatorowa GSR 12 V-15'), 'bricolage');
  assert.equal(F('Akumulator samochodowy 12V 74Ah'), 'auto');
});

test('tous les produits LEGO vont en Jeux & jouets', () => {
  const cas = [
    'LEGO Ideas E.T. the Extra-Terrestrial 21370',
    'LEGO City Le bulldozer jaune 60466',
    'LEGO Speed Champions 77238 Lamborghini Revuelto',
    'LEGO Icons Jaguar E-Type 11381 | Auto bouwpakket',
    'LEGO Botanicals Les cosmos 11514',
    'Jeu de construction Lego Creator 31376',
    'LEGO DUPLO Dinosaures sur roues 3-en-1 10451',
  ];
  for (const t of cas) assert.equal(F(t), 'jouets', `« ${t} » doit être en jeux et jouets`);
});

test('un JEU VIDÉO LEGO reste en high-tech — la seule exception', () => {
  // Un jeu de console n'est pas un jouet. Cette règle préexistait (JEU_NUMERIQUE)
  // et vaut aussi pour LEGO : sinon « LEGO Batman (PS5) » irait en jouets.
  assert.equal(F('LEGO Batman: Das Vermächtnis des dunklen Ritters (PS5/Xbox)'), 'tech');
  assert.equal(F('LEGO City Undercover 4,79€ | jeu PS4'), 'tech');
});

test('mais une MARQUE DE CONSOLE seule ne fait pas un jeu vidéo', () => {
  // Les deux offres qui ont révélé le défaut : « nintendo » y est la licence du
  // set, « steam » la locomotive du train. Ce sont des jouets, pas des logiciels.
  assert.equal(F('LEGO Super Mario Nintendo Display Model'), 'jouets', 'la licence n’est pas un logiciel');
  assert.equal(F('LEGO City 60511 Vintage Steam Train'), 'jouets', '« Steam » = locomotive à vapeur');
  assert.equal(F('LEGO Icons Nintendo Entertainment System 71374'), 'jouets');
  // « Game Boy » est un nom d'APPAREIL : il contient « game » sans être un jeu.
  assert.equal(F('LEGO Super Mario Game Boy Building Set for Adults - Nintendo Display Model'), 'jouets');
  // …et une vraie application / un vrai jeu console gardent la priorité.
  assert.equal(F('Patchwork Board Game - Android Game App'), 'tech');
  assert.equal(F('LEGO Harry Potter Collection jeu Nintendo Switch'), 'tech', 'un « jeu » est nommé : logiciel');
});

test('les rubriques restent cohérentes avec classerOffre', () => {
  // Le vérificateur de catégories rejoue `classerOffre` sur les données
  // publiées : si un titre change de rubrique, le fichier doit être recollecté.
  // On fixe ici deux cas qui doivent rester stables dans les deux chemins.
  assert.equal(C('Casque moto intégral'), 'auto');
  assert.equal(C('LEGO Ideas La fusée de Tintin 21367'), 'jouets');
});
