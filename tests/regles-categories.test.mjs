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

test('un JEU DE SOCIÉTÉ ne part pas en bricolage sous prétexte qu’on y parle de bricolage', () => {
  // Défaut rapporté : « on retrouve beaucoup de jeux de société pour les enfants
  // dans le bricolage car il y a le mot bricolage dedans. Mais il y a aussi le
  // mot jeu de société. Il faut corriger et les renvoyer vers jeux et jouet. »
  //
  //  Cause mesurée : un titre qui dit les deux comptait DEUX points pour
  //  bricolage (le mot « bricolage », plus « brico » qu'il contient) contre UN
  //  pour jouets. Le type de jeu est maintenant un mot fort : « jeu de societe »
  //  (15 caractères) bat « bricolage » (9) par la longueur.
  const cas = [
    ['Junior Créez Votre Propre Kit De Jeu De Société, Ensemble De Bricolage', 'jouets'],
    ['Créez Votre Propre Kit De Jeu De Société, Ensemble De Bricolage', 'jouets'],
    ['22mm Cube de jeu pour enfants vierges à 6 côtés - Pour jeu de société', 'jouets'],
    ['[Prime] Jeu de société Zombicide - Seconde Edition', 'jouets'],
    ['Monopoly Deal kaartspel (Nederlandse versie)', 'jouets'],
    ['ROKR Puzzle 3D en bois pour adulte - Kit de bricolage - Modèle globe', 'jouets'],
    ['Play-Doh, coffret Tourbillon de smoothies, jouet avec pâte à modeler', 'jouets'],
    ['ATM Gaming MOUTON MOUTON - Jeu de Société Famille et Amis', 'jouets'],
    ['Korting op Beyblade speelgoed', 'jouets'],
  ];
  const rates = cas.filter(([t, f]) => famille(t, '') !== f).map(([t, f]) => `${t} → ${famille(t, '')} (attendu ${f})`);
  assert.deepEqual(rates, [], `jeux de société mal rangés :\n  ${rates.join('\n  ')}`);
});

test('les FAUX AMIS ne font pas basculer un produit en jouets', () => {
  // « peluche » désigne aussi les peluches de TISSU, et « doudou » est le début
  // de « doudoune ». Mesuré sur les données réelles AVANT de les retirer des
  // mots forts : un rasoir anti-bouloche Philips, des chiffons microfibre et une
  // parka Nike partaient tous en « Jeux & jouets ». La comparaison ignorant la
  // langue du titre, « peluche » devait être retiré de TOUTES les langues, pas
  // seulement du français.
  for (const [titre, piege] of [
    ['Rasoir anti bouloche Philips GC026/80 - élimination des Peluches', 'peluche = peluches de tissu'],
    ['Doudoune longue Nike Liverpool FC 24/25 Strike Windrunner', 'doudou = début de doudoune'],
    ['AIDEA Lot de 50 Chiffon Microfibre sans peluche', 'peluche = peluches de tissu'],
  ]) {
    assert.notEqual(famille(titre, ''), 'jouets', `${piege} : « ${titre} » ne doit pas aller en jouets`);
  }
});

test('un jeu NUMÉRIQUE n’est pas un jouet', () => {
  // Le support est nommé, lui aussi : une application qui simule un jeu de
  // société reste un logiciel. C'est la règle du produit nommé, appliquée à
  // l'envers — et c'est ce qui empêche « Board Game App » de finir dans le
  // rayon des jouets.
  assert.equal(famille('Patchwork Board Game - Android Game App', ''), 'tech');
  assert.equal(famille('Solitaire Pro : Card Games [Android]', ''), 'tech');
  // Mais un jeu de société EN CARTON reste un jouet, même vendu sur un site
  // high-tech : le mot fort doit continuer de gagner quand rien ne dit
  // « numérique ».
  assert.equal(famille('Casino Jeu de société familial', 'Gaming'), 'jouets');
});

