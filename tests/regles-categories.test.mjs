/**
 * RÈGLES DE CATÉGORIE demandées — application n°2 « Promos ».
 *
 * Trois règles, énoncées explicitement, et qui doivent tenir DANS LES NEUF
 * LANGUES du catalogue :
 *
 *   1. tout appareil électronique ou technologique → high-tech ;
 *   2. l'électroménager → maison ;
 *   3. l'électronique de beauté → beauté.
 *
 * Ce qui rend ces règles non triviales : une MARQUE ne dit pas la famille d'un
 * produit. Samsung fait des téléphones (high-tech) ET des réfrigérateurs
 * (maison) ; Bosch des perceuses (bricolage) ET des lave-linge (maison) ; Dyson
 * des aspirateurs (maison) ET des sèche-cheveux (beauté). Tant que la marque
 * décidait, « Samsung Réfrigérateur » partait en high-tech.
 *
 * D'où la règle appliquée : dès qu'un APPAREIL EST NOMMÉ, c'est lui qui tranche,
 * avant la marque et avant la catégorie de la source. Les cas ci-dessous
 * contiennent donc, pour chaque règle, des titres où la marque dit le CONTRAIRE
 * de l'appareil — c'est là que le défaut se produisait.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { famille } from '../collecteur.mjs';

test('règle 1 — tout appareil électronique ou technologique va en high-tech', () => {
  const cas = [
    ['Samsung Galaxy S26 Ultra 256 Go', 'smartphone'],
    ['Apple iPhone 17 Pro', 'smartphone'],
    ['TV Samsung QE55Q60 55 pouces', 'téléviseur'],
    ['Téléviseur LG OLED 55"', 'téléviseur'],
    ['Fernseher LG 55 Zoll', 'téléviseur (de)'],
    ['Ordinateur portable Asus Zenbook 14', 'ordinateur'],
    ['Casque audio Sony WH-1000XM6', 'casque'],
    ['Écouteurs AirPods Pro 3', 'écouteurs'],
    ['Montre connectée Garmin Forerunner', 'montre connectée'],
    ['Imprimante HP Envy 6000', 'imprimante'],
    ['Auriculares Sony WH-CH520', 'casque (es)'],
    ['Consola PlayStation 5 Slim', 'console (es)'],
    ['Drukarka HP DeskJet', 'imprimante (pl)'],
    ['Słuchawki bezprzewodowe z etui', 'écouteurs (pl)'],
    ['Smartphone Xiaomi Redmi Note 17', 'smartphone'],
  ];
  const rates = cas.filter(([t]) => famille(t, '') !== 'tech').map(([t]) => t);
  assert.deepEqual(rates, [], `titres technologiques mal rangés : ${rates.join(' | ')}`);
});

test('règle 2 — l’électroménager va en maison, MÊME sous une marque de high-tech', () => {
  const cas = [
    ['Samsung Réfrigérateur combiné RS70F66KBTEF', 'marque high-tech + appareil'],
    ['Réfrigérateur Samsung 400 L', ''],
    ['Bosch Lave-linge série 6', 'marque bricolage + appareil'],
    ['Micro-ondes Samsung 23 L', 'marque high-tech + appareil'],
    ['Cafetière à grains Philips EP2231', 'marque ambiguë + appareil'],
    ['Aspirateur balai Dyson V15', ''],
    ['Philips Airfryer 5000 Series', ''],
    ['Kühlschrank Siemens iQ300', 'allemand'],
    ['Wasmachine Bosch Serie 4', 'néerlandais'],
    ['Lavavajillas Bosch SMS4H', 'espagnol'],
    ['Lavatrice Samsung EcoBubble', 'italien'],
    ['Odkurzacz pionowy Electrolux', 'polonais'],
    ['Dammsugare Electrolux', 'suédois'],
  ];
  const rates = cas.filter(([t]) => famille(t, '') !== 'maison').map(([t]) => t);
  assert.deepEqual(rates, [], `électroménager mal rangé : ${rates.join(' | ')}`);
});

test('règle 3 — l’électronique de beauté va en beauté, MÊME sous une marque de maison', () => {
  const cas = [
    ['Épilateur Braun Silk-épil 9', ''],
    ['Braun Series 9 rasoir électrique', ''],
    ['Sèche-cheveux Dyson Supersonic', 'marque maison + appareil beauté'],
    ['Lisseur de cheveux Philips', ''],
    ['Brosse à dents électrique Oral-B iO', ''],
    ['Haartrockner Philips BHD300', 'allemand — contient « trockner » (sèche-linge)'],
    ['Tondeuse barbe Philips Series 5000', ''],
    ['Scheerapparaat Philips 7000', 'néerlandais'],
    ['Depiladora Philips BRL130', 'espagnol'],
    ['Asciugacapelli Philips', 'italien'],
  ];
  const rates = cas.filter(([t]) => famille(t, '') !== 'beaute').map(([t]) => t);
  assert.deepEqual(rates, [], `électronique de beauté mal rangée : ${rates.join(' | ')}`);
});

test('les règles d’appareil ne cassent pas les autres rayons', () => {
  const cas = [
    ['Perceuse visseuse Makita 18V', 'bricolage'],
    ['Tondeuse à gazon thermique', 'bricolage'],
    ['Sneakers Nike Air Max', 'mode'],
    ['LEGO Editions McLaren F1', 'jouets'],
    ['Pneus Michelin 205/55 R16', 'auto'],
    ['Bicicletta da corsa', 'sport'],
    ['Juguete de construcción', 'jouets'],
    ['Profumo e crema idratante', 'beaute'],
  ];
  const rates = cas.filter(([t, f]) => famille(t, '') !== f).map(([t, f]) => `${t} → ${famille(t, '')} (attendu ${f})`);
  assert.deepEqual(rates, [], `régressions hors règles d'appareil :\n  ${rates.join('\n  ')}`);
});

test('un appareil nommé l’emporte sur la catégorie de la source', () => {
  // Une source peut se tromper : un lave-linge rangé par erreur en high-tech
  // reste un lave-linge. C'est ce que veut dire « le mot d'appareil d'abord ».
  assert.equal(famille('Samsung Réfrigérateur combiné', 'High-Tech'), 'maison');
  assert.equal(famille('Épilateur Braun Silk-épil 9', 'High-Tech'), 'beaute');
  assert.equal(famille('Téléviseur LG OLED 55', 'Gaming'), 'tech');
});

test('un titre réduit à une référence constructeur reste en « Autres »', () => {
  // On ne devine pas : sans mot d'appareil, il n'y a rien à décider. Ranger
  // d'après la seule marque (« Samsung ») enverrait des réfrigérateurs en
  // high-tech — c'est exactement le défaut qu'on vient de corriger.
  assert.equal(famille('Bosch MSM4B610', ''), 'autre');
  assert.equal(famille('Miele G 5664 SC Vi', 'maison'), 'maison', 'la marque reste un indice acceptable quand elle est sans ambiguïté');
});
