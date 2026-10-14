/**
 * LE LECTEUR BOL.COM — la page « deals » que B a donnée le 10/10/2026.
 *
 *   « Voilà le lien pour bol.com. C'est de ce lien que tu dois rechercher toutes
 *     les promotions. »
 *
 * Ce qui est protégé ici, et pourquoi. bol.com n'est PAS un flux : c'est une page
 * dont chaque carte porte DEUX prix réels — le prix demandé et un prix de
 * référence. Trois pièges ont été mesurés sur la page réellement servie, et
 * chacun a son cas ci-dessous, pris mot pour mot dans le HTML reçu :
 *
 *   1. le prix demandé est écrit en TROIS fragments (entier, virgule, centimes),
 *      et les centimes peuvent être un TIRET : « 142,- » vaut 142,00 € — un
 *      extracteur qui cherche « NN,NN » rate ces offres ;
 *   2. le prix de référence change de libellé selon le cas : « Prix conseillé »
 *      ou « En général » (« Adviesprijs »/« Meestal » en néerlandais) ;
 *   3. l'adresse porte des paramètres de campagne (`?promo=…`) qui varient d'un
 *      passage à l'autre : l'identifiant d'une offre se calcule donc sur le
 *      NUMÉRO du produit, pour que la même offre reste la même.
 *
 * Les morceaux ci-dessous sont RÉELS ; seule leur mise bout à bout est nôtre.
 *
 * Lancement : node --test tests/bol.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { offresBol, identifiant, doublonsBol } from '../collecteur.mjs';

/** Une carte telle que bol la sert, réduite à ce que le lecteur regarde. */
const CARTE = (fragment) => `<div data-testid="product"><div>${fragment}</div></div>`;

const FRAGMENT_0 = `<p class="m-none line-clamp-2 overflow-hidden wrap-anywhere typography-body-maximal-200" title="Fisher-Price Plaisir d&#x27;Apprentissage 2-en-1 Aspirateur avec Brosseur, Lumières et Musique">Fisher-Price Plaisir d&#x27;Apprentissage 2-en-1 Aspirateur avec Brosseur, Lumières et Musique</p> href="/be/fr/p/fisher-price-plaisir-d-apprentissage-2-en-1-aspirateur-avec-brosseur-lumieres-et-musique/9300000240397635/" <img src="https://media.s-bol.com/gozOqgnjnB7r/zmyL7X7/89x210.jpg" <span class="row-span-2" aria-hidden="true">22</span> <span class="col-start-2 row-span-2 row-start-1 text-16" aria-hidden="true">,</span> <span class="col-start-2 row-start-1 text-16 translate-x-[27%] translate-y-0" aria-hidden="true">99</span> <span aria-hidden="true">Prix conseillé <!-- -->29,99</span>`;
const FRAGMENT_1 = `<p class="m-none line-clamp-2 overflow-hidden wrap-anywhere typography-body-maximal-200" title="JBL Live 780NC - Casque sans fil à réduction de bruit - Bluetooth supra-auriculaire - 80 heures d&#x27;autonomie - Hi-Res Audio - Multipoint - Son JBL Signature - Noir">JBL Live 780NC - Casque sans fil à réduction de bruit - Bluetooth supra-auriculaire - 80 heures d&#x27;autonomie - Hi-Res Audio - Multipoint - Son JBL Signature - Noir</p> href="/be/fr/p/jbl-live-780nc-casque-sans-fil-a-reduction-de-bruit-bluetooth-supra-auriculaire-80-heures-d-autonomie-hi-res-audio-multipoint-son-jbl-signature-noir/9300000252617204/" <img src="https://media.s-bol.com/NvM3GEwO8OPz/l5O0wY1/168x196.jpg" <span class="row-span-2" aria-hidden="true">142</span> <span class="col-start-2 row-span-2 row-start-1 text-16" aria-hidden="true">,</span> <span class="col-start-2 row-start-1 text-16 translate-x-[25%] translate-y-[-5%]" aria-hidden="true">-</span> <span aria-hidden="true">Prix conseillé <!-- -->179,99</span>`;
const FRAGMENT_2 = `<p class="m-none line-clamp-2 overflow-hidden wrap-anywhere typography-body-maximal-200" title="Pokémon Kaarten - Elite Trainer Box - Pitch Black - Booster Bundle - 9 Booster Packs - Mega Evolution - ETB - TCG - Pokemon Box - Pokemon Cards - Pokemon Speelgoed - Pack">Pokémon Kaarten - Elite Trainer Box - Pitch Black - Booster Bundle - 9 Booster Packs - Mega Evolution - ETB - TCG - Pokemon Box - Pokemon Cards - Pokemon Speelgoed - Pack</p> href="/be/fr/p/pokemon-kaarten-elite-trainer-box-pitch-black-booster-bundle-9-booster-packs-mega-evolution-etb-tcg-pokemon-box-pokemon-cards-pokemon-speelgoed-pack/9300000339524131/" <img src="https://media.s-bol.com/E4286lxNm384/xn9YNXl/168x160.jpg" <span class="row-span-2" aria-hidden="true">107</span> <span class="col-start-2 row-span-2 row-start-1 text-16" aria-hidden="true">,</span> <span class="col-start-2 row-start-1 text-16 translate-x-[27%] translate-y-0" aria-hidden="true">99</span> <span aria-hidden="true">En général <!-- -->114,00</span>`;

const HTML = CARTE(FRAGMENT_0) + CARTE(FRAGMENT_1) + CARTE(FRAGMENT_2);
const SOURCE = { id: 'bol-be-fr', nom: 'bol.com', pays: 'BE', langue: 'fr' };
const offres = offresBol(HTML, SOURCE);

test('les trois cartes réelles sont lues, avec leurs deux prix', () => {
  assert.equal(offres.length, 3, 'trois cartes doivent sortir');
  const fp = offres.find((o) => o.titre.includes('Fisher-Price'));
  assert.ok(fp, 'la carte Fisher-Price doit être lue');
  assert.equal(fp.prix, 22.99, 'prix demandé en trois fragments : 22 + , + 99');
  assert.equal(fp.prixAvant, 29.99, 'prix de référence « Prix conseillé »');
  assert.equal(fp.remiseCalculee, true, 'la remise est CALCULÉE entre deux prix réels');
  assert.equal(fp.remise, 23, '23 % entre 29,99 et 22,99');
  assert.equal(fp.marchand, 'bol.com');
  assert.equal(fp.pays, 'BE');
  assert.match(fp.titre, /d'Apprentissage/, 'les entités HTML sont décodées');
});

test('les centimes en tiret (« 142,- ») sont compris', () => {
  const jbl = offres.find((o) => o.titre.includes('JBL'));
  assert.ok(jbl, 'la carte JBL doit être lue');
  assert.equal(jbl.prix, 142, '« 142 » + « , » + « - » vaut 142,00 €');
  assert.equal(jbl.prixAvant, 179.99);
  assert.equal(jbl.remise, 21);
});

test('« En général » est un prix de référence comme un autre', () => {
  const pkm = offres.find((o) => o.titre.includes('Elite Trainer'));
  assert.ok(pkm, 'la carte Pokémon doit être lue');
  assert.equal(pkm.prix, 107.99);
  assert.equal(pkm.prixAvant, 114, 'libellé « En général » : 114,00 €');
  assert.equal(pkm.remise, 5);
});

test('l’adresse est propre, et l’identifiant suit le NUMÉRO du produit', () => {
  for (const o of offres) {
    assert.ok(!o.lienMarchand.includes('?promo='), 'pas de paramètre de campagne dans l’adresse');
    assert.match(o.lienMarchand, /^https:\/\/www\.bol\.com\/be\/fr\/p\//, 'adresse absolue du produit');
  }
  const numero = (offres[0].lienMarchand.match(/\/(\d{6,})\/$/) || [])[1];
  assert.ok(numero, 'le numéro de produit doit être lisible');
  assert.equal(offres[0].id, identifiant('b', numero),
    'l’identifiant vient du numéro : la même offre reste la même si bol change les mots de l’adresse');
});

test('une carte sans prix demandé ne produit rien', () => {
  assert.equal(offresBol(CARTE('<p class="m-none" title="Produit sans prix">Produit sans prix</p>'), SOURCE).length, 0);
  assert.equal(offresBol('', SOURCE).length, 0);
});

/* ------------------------------------------------------------------------ *
 *  LE MÊME PRODUIT SERVI DEUX FOIS.
 *
 *  Défaut mesuré sur le stock publié le 10/10/2026 : 32 lignes pour 17
 *  produits. bol publie chaque article sous DEUX adresses — une par langue — et
 *  seule la fin de l'adresse (le numéro du produit) est identique :
 *
 *    /be/fr/p/gillette-venus-10-lames-de-rasoir/9300000123456
 *    /be/nl/p/gillette-venus-10-scheermesjes/9300000123456
 *
 *  Ce que ça donnait à l'écran : le même article deux fois, avec un titre qui
 *  changeait de langue d'un passage à l'autre.
 * ------------------------------------------------------------------------ */
const PRODUIT_FR = { lienPage: 'https://www.bol.com/be/fr/p/gillette-venus-10-lames-de-rasoir/9300000123456/', titre: 'Gillette Venus - 10 Lames de rasoir' };
const PRODUIT_NL = { lienPage: 'https://www.bol.com/be/nl/p/gillette-venus-10-scheermesjes/9300000123456/', titre: 'Gillette Venus - 10 Scheermesjes' };

test('le même produit en français et en néerlandais ne fait qu’UNE ligne', () => {
  const enTrop = doublonsBol([PRODUIT_FR, PRODUIT_NL]);
  assert.equal(enTrop.length, 1, 'une seule ligne doit être écartée');
  assert.equal(enTrop[0].titre, PRODUIT_NL.titre, 'c’est la ligne NÉERLANDAISE qui part');
});

test('le choix ne dépend PAS de l’ordre du fichier', () => {
  // Le point capital : le stock est relu dans l'ordre où il a été écrit, et cet
  // ordre n'a aucune raison d'être stable. Si la décision en dépendait, la ligne
  // qui survit changerait d'un passage à l'autre — l'utilisateur verrait le
  // titre basculer du français au néerlandais sans rien faire.
  const a = doublonsBol([PRODUIT_FR, PRODUIT_NL]).map((o) => o.titre);
  const b = doublonsBol([PRODUIT_NL, PRODUIT_FR]).map((o) => o.titre);
  assert.deepEqual(a, b, 'même verdict dans les deux ordres');
  assert.deepEqual(a, [PRODUIT_NL.titre]);
});

test('deux produits différents ne sont jamais confondus', () => {
  const autre = { lienPage: 'https://www.bol.com/be/fr/p/oral-b-brossettes-lot-de-10/9300000999999/', titre: 'Oral-B - Lot de 10' };
  assert.deepEqual(doublonsBol([PRODUIT_FR, autre]), [], 'des numéros différents = deux produits');
  // Deux fois le MÊME numéro dans la MÊME langue reste un doublon : on n'en
  // garde qu'un.
  assert.equal(doublonsBol([PRODUIT_FR, { ...PRODUIT_FR }]).length, 1);
  assert.deepEqual(doublonsBol([]), [], 'aucune offre : rien à écarter');
});

test('une adresse bol sans numéro de produit n’est pas traitée comme un doublon', () => {
  // Un lien de campagne ou une page de rayon n'a pas de numéro : on ne peut rien
  // regrouper dessus, et surtout pas inventer une identité.
  const rayon = { lienPage: 'https://www.bol.com/be/fr/l/deals/', titre: 'Toutes les promos' };
  assert.deepEqual(doublonsBol([rayon, PRODUIT_FR]), []);
});
