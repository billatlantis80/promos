/**
 * RÈGLE E4 — « fille / garçon / enfant / catégorie d'âge » → Jeux & jouets.
 *
 * Demande de B (plan, point 10), à tenir DANS LES NEUF LANGUES : toute annonce
 * qui nomme un enfant (fille, garçon, enfant, ou l'équivalent local) doit être
 * rangée dans « Jeux & jouets », pas dans le rayon du mot de circonstance qui
 * l'accompagne.
 *
 * Défaut MESURÉ avant la correction, sur les 9 379 offres publiées : 93 offres
 * changent de rubrique vers « jouets » — surtout 34 kits créatifs retenus en
 * bricolage (« Kit de bricolage pour enfants »), 24 appareils d'enfant en
 * high-tech (appareils photo, microscopes), 13 vêtements d'enfant en mode,
 * 13 objets de maison, 4 produits de beauté, 3 de sport, 1 d'électroménager.
 * Restent 14 offres portant un mot d'enfant hors de jouets : un appareil nommé
 * plus long l'emporte (brosse à dents, montre connectée, appareil photo…).
 *
 * Ces tests couvrent trois choses distinctes, et c'est voulu :
 *   1. la règle marche dans chaque langue (une ligne PAR langue) ;
 *   2. un APPAREIL NOMMÉ, plus long, garde la priorité — c'est la consigne du
 *      plan (« si une famille d'appareil nommé est plus précise, le dire ») :
 *      une brosse à dents KIDS reste en Beauté, une tondeuse à cheveux d'enfant
 *      reste en Électroménager ;
 *   3. les FAUX POSITIFS mesurés restent dehors (l'anglais « kind » attrapé par
 *      l'allemand, le parfum « Good Girl », le chocolat Kinder, la montre
 *      « Orient Bambino »), et la borne d'âge écarte les « 15-24 ans » d'un
 *      article de presse.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { famille } from '../collecteur.mjs';

test('E4 — chaque langue range le vocabulaire d’enfant en Jeux & jouets', () => {
  const cas = [
    ['fr', 'Kit créatif pour fille de 6 ans - Licorne'],
    ['fr', 'Cadeau pour garçon 8 ans, coffret de magie'],
    ['en', 'Building blocks set for kids'],
    ['en', 'Doll house for girls age 4+'],
    ['de', 'Kinderfahrrad 16 Zoll mit Stützrädern'],
    ['de', 'Puppe für Mädchen ab 3 Jahren'],
    ['nl', 'Speelgoed voor meisjes en jongens'],
    ['nl', 'Knutselpakket voor kinderen'],
    ['es', 'Juguete para niñas de 5 años'],
    ['es', 'Muñeca para niños pequeños'],
    ['it', 'Giocattolo per bambine e bambini'],
    ['it', 'Set creativo per ragazze'],
    ['pt', 'Brinquedo para meninas de 6 anos'],
    ['pt', 'Jogo para crianças pequenas'],
    ['pl', 'Zabawka dla dziewczynek i chłopców'],
    ['pl', 'Klocki dla dzieci 3+'],
    ['sv', 'Leksak för flickor och pojkar'],
    ['sv', 'Pysselpaket för barn'],
  ];
  const rates = cas.filter(([, t]) => famille(t, '') !== 'jouets').map(([l, t]) => `[${l}] « ${t} » → ${famille(t, '')}`);
  assert.deepEqual(rates, [], `vocabulaire d'enfant non rangé en jouets :\n  ${rates.join('\n  ')}`);
});

test('E4 — une plage d’âge d’enfant suffit, une plage d’adultes non', () => {
  // Mesuré : les 5 plages d'âge des données sont 1,5-4, 6-13, 5 seul, 15-24 et
  // une référence « Kindle ». La borne de 14 ans garde les enfants et écarte
  // l'article de presse sur « les 15-24 ans ».
  assert.equal(famille('Jouet mini voiture Tesla Model Y - Rouge, de 1,5 à 4 ans', ''), 'jouets');
  assert.equal(famille('Signal Junior Super Mario 6-13 años 75 ml Pasta dental infantil', ''), 'jouets');
  assert.equal(famille('Vélo 3 à 6 ans pour enfant', ''), 'jouets');
  assert.notEqual(famille('55,6 % des 15-24 ans touchés par la solitude : une campagne', ''), 'jouets');
  // Un âge SEUL ne prouve rien : trop bruité (ordinateurs, abonnements).
  assert.notEqual(famille('Ordinateur Portable Alienware 15 - Pack 1 Mois', ''), 'jouets');
  assert.notEqual(famille('Google GEMINI AI Pro na 18 miesięcy', ''), 'jouets');
});

test('E4 — un appareil NOMMÉ, plus précis, garde la priorité', () => {
  // C'est la consigne du plan : si une famille d'appareil nommé est plus
  // précise, on le dit plutôt que de la laisser écraser. Le mot d'appareil est
  // plus long que le mot d'enfant, donc il l'emporte dans la table des MOTS
  // FORTS.
  assert.equal(famille('Brosse à dents électrique Oral-B Kids', ''), 'beaute', 'brosse à dents : Beauté');
  assert.equal(famille('Casque audio enfant Bluetooth', ''), 'tech', 'casque : High-tech');
  assert.equal(famille('Téléviseur enfant LG 32 pouces', ''), 'tech', 'une télé d’enfant reste High-tech');
  assert.equal(famille('Tondeuse à cheveux enfant Wahl', ''), 'electromenager', 'tondeuse à cheveux : Électroménager');
});

test('E4 — les faux positifs mesurés ne basculent pas en jouets', () => {
  // L'allemand « Kind » nu attrapait l'anglais « kind » : retiré des mots forts.
  assert.notEqual(famille('Winyl Miles Davis- Kind of Blue LP', ''), 'jouets');
  assert.notEqual(famille('Astonish Kind to Skin Hand Wash 500ml', ''), 'jouets');
  // Collisions de MARQUE retirées avant comparaison (voir MOTS_TROMPEURS).
  assert.notEqual(famille('Carolina Herrera Good Girl Blush Eau de Parfum 80ml', ''), 'jouets');
  assert.notEqual(famille('kinder Schokolade 300g Schokoriegel', ''), 'jouets');
  assert.notEqual(famille('Orient Bambino automático 42 mm con esfera azul', ''), 'jouets');
  // Collisions en SOUS-CHAÎNE mesurées dans cette session (frontière de mot) :
  // « kids » dans « Kidston », « child » dans « schildpad » / « Schildkröte »,
  // « chica » dans « Chicago », « boys » dans les noms de groupes/disques.
  assert.notEqual(famille('Cath Kidston Hand Wash 500ml Red Berry & Cedar', ''), 'jouets');
  assert.notEqual(famille('Schiet op, schildpadjes', ''), 'jouets');
  assert.notEqual(famille('Flüge USA (New York, San Francisco, Chicago, Washington)', ''), 'jouets');
  assert.notEqual(famille('Vinyle LP The Beach Boys - Pet Sound', ''), 'jouets');
  assert.notEqual(famille('The Lost Boys - Original Soundtrack - Limited Red Vinyl', ''), 'jouets');
  // …et une vraie collision « child » reste bien lue comme un mot.
  assert.equal(famille('Building blocks set for children', ''), 'jouets');
});
