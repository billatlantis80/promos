/**
 * Lecture des bons plans Groupon — application n°2 « Promos ».
 *
 * Ce fichier existe pour deux raisons, et la seconde compte autant que la
 * première :
 *
 *   1. LIRE — Groupon Belgique est la seule source belge qui publie ses bons
 *      plans avec DEUX prix réels. Encore faut-il lire le bon endroit : le JSON
 *      de sa page, où les montants sont en CENTIMES (699 = 6,99 €). Les prendre
 *      pour des euros afficherait des licences à 699 €.
 *
 *   2. NE PAS SE LAISSER POLLUER — demande explicite : « Je n'ai pas besoin
 *      d'avoir de la pollution. » Groupon gonfle ses prix de référence : mesuré
 *      sur sa page réelle, une licence à 11,99 € « au lieu de 129,90 € »
 *      (−91 %). Un faux pourcentage fait acheter ; il est donc REJETÉ, pas
 *      affiché. Les tests fixent les deux bords : ce qui passe, ce qui ne passe
 *      pas.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { offresGroupon, remiseCredibleSource, classerOffre, categorieDeSource } from '../collecteur.mjs';

/** Une carte telle que Groupon la publie, montants en CENTIMES. */
const carte = (id, titre, prixC, avantC) => ({
  __typename: 'StandardDealCard',
  id,
  title: titre,
  url: `https://www.groupon.be/deals/${id}`,
  categoryGuid: 'acdda4d9-237b-4136-9d9e-39eab292b7d1',
  prices: {
    __typename: 'StandardDealCardPrices',
    price: { __typename: 'StandardPrice', amount: prixC, currencyCode: 'EUR' },
    strikeThroughPrice: avantC == null
      ? null
      : { __typename: 'StandardPrice', amount: avantC, currencyCode: 'EUR' },
  },
  imageUrls: { __typename: 'StandardDealCardImageUrls', small: 'https://img.grouponcdn.com/deal/a.jpg' },
  merchant: { __typename: 'StandardDealCardMerchant', name: 'Une boutique' },
});

const page = (cartes) => '<html><head>'
  + `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { __APOLLO_STATE__: { 'DealList:1': { __typename: 'HomepageDealList', deals: cartes } } } },
  })}</script></head></html>`;

const SOURCE = {
  id: 'groupon-be-sale', nom: 'Groupon', type: 'groupon', pays: 'BE',
  categorieImposee: 'activite', url: 'https://www.groupon.be/fr/landing/sale',
};

test('les deux prix sont lus, et les montants sont bien des CENTIMES', () => {
  const o = offresGroupon(page([carte('spa-1', 'Spa privatif pour 2 avec modelage', 11199, 17300)]), SOURCE);
  assert.equal(o.length, 1, 'un bon plan à deux prix doit sortir');
  assert.equal(o[0].prix, 111.99, '11199 centimes = 111,99 € — surtout pas 11199 €');
  assert.equal(o[0].prixAvant, 173, '17300 centimes = 173 €');
  assert.equal(o[0].remise, 35);
  assert.equal(o[0].remiseCalculee, true, 'la remise est CALCULÉE entre deux prix réels');
  assert.equal(o[0].pays, 'BE');
  assert.equal(o[0].marchand, 'Groupon');
  assert.match(o[0].lienMarchand, /^https:\/\/www\.groupon\.be\/deals\//);
  assert.match(o[0].image, /^https:\/\//, 'le visuel doit être une adresse absolue');
});

test('une promotion GONFLÉE est rejetée, pas affichée', () => {
  // Cas réellement mesuré sur la page de Groupon : une licence à 11,99 €
  // « au lieu de 129,90 € ». Ce n'est pas une promotion, c'est un prix
  // conseillé invérifiable — 10,8 fois le prix demandé.
  const o = offresGroupon(page([carte('licence', 'Licence Microsoft Windows 11 à vie', 1199, 12990)]), SOURCE);
  assert.deepEqual(o, [], 'aucune offre ne doit sortir d’un prix de référence à 10× le prix');
});

test('une remise invraisemblable est rejetée à la source', () => {
  assert.equal(remiseCredibleSource(11.99, 129.9), false, '−91 % : rejeté');
  assert.equal(remiseCredibleSource(149, 1339), false, '−89 % sur un matelas : rejeté (prix de référence à 9×)');
  assert.equal(remiseCredibleSource(39.99, 59.95), true, '−33 % : retenu');
  assert.equal(remiseCredibleSource(26.99, 59.9), true, '−55 % : retenu');
});

test('une remise trop faible n’est pas une promotion', () => {
  // Cas réel : l’iPhone 18 Pro à 1 429 € « au lieu de » 1 479 € — −3 %, ce
  // n’est pas un bon plan, c’est un prix.
  const o = offresGroupon(page([carte('iphone', 'Apple iPhone 18 Pro 256 Go', 142900, 147900)]), SOURCE);
  assert.deepEqual(o, []);
  assert.equal(remiseCredibleSource(1429, 1479), false);
});

test('un bon plan sans second prix est écarté', () => {
  const o = offresGroupon(page([carte('simple', 'Massage relaxant 1h', 3999, null)]), SOURCE);
  assert.deepEqual(o, [], 'sans prix de référence, il n’y a aucune remise à montrer');
});

test('la remise est CALCULÉE, jamais lue dans le titre', () => {
  // Groupon écrit « jusqu’à 50 % » dans certains titres : un maximum qui ne dit
  // rien de l’offre affichée. Le pourcentage montré doit venir des deux prix.
  const o = offresGroupon(page([carte('kaizen', "Jusqu'à 50% de remise sur chez kaizen", 2499, 5000)]), SOURCE);
  assert.equal(o.length, 1);
  assert.equal(o[0].remise, 50, 'ici le calcul tombe juste à 50 % — mais il vient des prix');
  assert.equal(o[0].remiseCalculee, true);
});

test('les doublons d’une même page sont écartés', () => {
  const c = carte('dup', 'Réflexologie plantaire 1h', 2999, 6500);
  const o = offresGroupon(page([c, { ...c }]), SOURCE);
  assert.equal(o.length, 1, 'le même bon plan deux fois ne doit remplir la liste qu’une fois');
});

test('E3 — soins, repas et sorties d’une page « activité » sont répartis', () => {
  // Demande de B (point 9) : un SOIN n'est pas une SORTIE. Une page de
  // prestations Groupon mêle les deux : le soin part en Beauté, le repas pris
  // dehors et la sortie restent en Activité (point 22).
  const o = offresGroupon(page([
    carte('a', 'Soin de relaxation du dos et du corps', 1999, 6000),
    carte('b', 'Déjeuner gastronomique au Restaurant Terborght', 5500, 7000),
    carte('c', 'Exceptionnel ! Vol en montgolfière', 2900, 7000),
  ]), SOURCE);
  assert.equal(o.length, 3, `trois offres doivent survivre, obtenu ${o.length}`);
  const parTitre = Object.fromEntries(o.map((x) => [x.titre, x.categorie]));
  assert.equal(parTitre['Soin de relaxation du dos et du corps'], 'beaute', 'un SOIN va en Beauté');
  assert.equal(parTitre['Déjeuner gastronomique au Restaurant Terborght'], 'activite', 'un repas PRIS DEHORS reste en Activité');
  assert.equal(parTitre['Exceptionnel ! Vol en montgolfière'], 'activite', 'une sortie reste en Activité');
  for (const x of o) assert.equal(x.categorieSource, 'activite', 'la rubrique de source reste « activités »');
});

test('une page sans JSON ne rend rien — et ne casse rien', () => {
  assert.deepEqual(offresGroupon('<html><body>rien</body></html>', SOURCE), []);
  assert.deepEqual(offresGroupon('', SOURCE), []);
  assert.deepEqual(offresGroupon('<script id="__NEXT_DATA__">pas du json</script>', SOURCE), []);
});

test('le classement NE DÉFAIT PAS une rubrique imposée par la source', () => {
  // Le collecteur reclasse les offres déjà collectées en rejouant classerOffre
  // sur le titre et la catégorie de source. Si « activité » n'était pas
  // reconnue comme une rubrique de source, chaque passage de la collecte
  // renverrait les bons plans Groupon en « Autres » — une rubrique vidée à
  // chaque cycle, sans une seule erreur dans les journaux.
  assert.equal(categorieDeSource('activite'), 'activite', 'la rubrique doit être reconnue');
  assert.equal(
    classerOffre({ titre: 'Menu grec en 3 services', categorieImposee: 'activite', categorieSource: 'activite' }),
    'activite',
    'un repas pris dehors (aucun mot de soin) reste dans la rubrique imposée',
  );
});

test('E3 — un SOIN d’une page imposée « activité » part en BEAUTÉ', () => {
  // Demande de B (point 9), qui CHANGE la décision précédente : la page de
  // soldes Groupon marquait « Soin du visage au choix ou modelage duo » en
  // Activité. Or un soin n'est pas une sortie — il part désormais en Beauté,
  // tout en gardant le marqueur de page (categorieImposee) pour la traçabilité.
  const o = offresGroupon(page([carte('soin', 'Soin du visage au choix ou modelage duo', 5099, 7900)]), SOURCE);
  assert.equal(o.length, 1, 'l’offre doit passer le garde-fou');
  assert.equal(o[0].categorie, 'beaute', 'un soin va en Beauté, plus en Activité');
  assert.equal(o[0].categorieImposee, 'activite', 'le marqueur de page reste POSÉ sur l’offre');
  assert.equal(classerOffre(o[0]), 'beaute', 'et le reclassement le confirme');
});

test('une offre ordinaire ne porte AUCUN marqueur d’imposition', () => {
  // Le marqueur doit rester l'exception : s'il se posait partout, le titre
  // cesserait d'être une preuve pour toutes les autres sources.
  const sansImposition = { ...SOURCE, categorieImposee: undefined };
  const o = offresGroupon(page([carte('spa2', 'Rituel bien-être complet en spa', 3499, 4500)]), sansImposition);
  assert.equal(o.length, 1);
  assert.equal(o[0].categorieImposee, null);
  assert.equal(classerOffre(o[0]), o[0].categorie, 'sans marqueur, le titre redecide normalement');
});

test('E3 — les pièges de mots ne font pas basculer un repas en Beauté', () => {
  // Un mot de soin est pris en PRÉFIXE (« massage » → « massages »), mais les
  // pièges connus sont neutralisés : « besoin » contient « soin », et « spa »
  // ne doit pas lire « spaghettis ». Sans cela, un menu partirait en Beauté.
  const C = (t) => classerOffre({ titre: t, categorieImposee: 'activite', categorieSource: 'activite' });
  assert.equal(C('Menu avec soupe de spaghetti'), 'activite', '« spaghettis » n’est pas un spa');
  assert.equal(C('Menu grec'), 'activite', 'un repas sans mot de soin reste en Activité');
  assert.equal(C('Sans besoin particulier, menu du jour'), 'activite', '« besoin » n’est pas un soin');
  assert.equal(C('Massage relaxant 1h'), 'beaute', 'un massage va en Beauté');
  assert.equal(C('Soins du visage et du cou'), 'beaute', 'un soin du visage va en Beauté');
});

/* ------------------------------------------------------------------ *
 *  RENDU « TanStack » — la page Groupon servie en JavaScript.
 *
 *  Mesuré (AUDIT-B1.md) : `groupon.fr/bon-plan` est tirée au hasard, par le
 *  même domaine, en rendu Next (`__NEXT_DATA__`, JSON) ou TanStack
 *  (`<script class="$tsr">`, flux JavaScript). 3 fois sur 4 en TanStack. Un
 *  lecteur qui ne connaît que Next rend alors ZÉRO offre, en silence.
 *
 *  Ces tests fixent le second lecteur : la MÊME carte, sérialisée au format
 *  TanStack, doit produire la MÊME offre que le format Next.
 * ------------------------------------------------------------------ */

let _n = 0;
const _ref = () => `$R[${++_n}]`;
/** Sérialise une valeur comme le fait Groupon : objets/tableaux marqués
 *  `$R[n]=`, objets en `Object.assign(Object.create(null),{…})`, booléens `!0`/`!1`. */
function tan(v) {
  if (v === null) return 'null';
  if (v === true) return '!0';
  if (v === false) return '!1';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `${_ref()}=[${v.map(tan).join(',')}]`;
  return `${_ref()}=Object.assign(Object.create(null),{${Object.entries(v).map(([k, x]) => `${k}:${tan(x)}`).join(',')}})`;
}
const pageTanStack = (cartes) => '<html data-renderer="tanstack"><head>'
  + '<script class="$tsr" id="$tsr-stream-barrier">'
  + '(self.$R=self.$R||{})["tsr"]=[];'
  + `$_TSR.router=($R=>${tan({ __typename: 'BrowseDealFeedResult', cards: cartes })})([]);`
  + '$_TSR.e();document.currentScript.remove()</script></head></html>';

test('E1 — une page au rendu TanStack est lue comme la page Next', () => {
  const c = carte('spa-ts', 'Spa privatif pour 2 avec modelage', 11199, 17300);
  const oNext = offresGroupon(page([c]), SOURCE);
  const oTS = offresGroupon(pageTanStack([c]), SOURCE);
  assert.equal(oTS.length, 1, 'la carte du flux TanStack doit être lue (avant B2 : 0, en silence)');
  // On neutralise l'horodatage, qui diffère forcément entre les deux lectures.
  const sans = (o) => ({ ...o, date: null });
  assert.deepEqual(sans(oTS[0]), sans(oNext[0]), 'mêmes offres, quel que soit le rendu servi');
});

test('E1 — le rendu TanStack fait respecter les MÊMES garde-fous', () => {
  // Une promotion gonflée (référence à 10× le prix) est rejetée dans les deux
  // rendus ; sinon le second lecteur deviendrait une porte dérobée.
  const gonflee = carte('licence-ts', 'Licence Microsoft Windows 11 à vie', 1199, 12990);
  assert.deepEqual(offresGroupon(pageTanStack([gonflee]), SOURCE), []);
  // Sans second prix, il n'y a pas de promotion à montrer — même verdict.
  const sansRef = carte('simple-ts', 'Massage relaxant 1h', 3999, null);
  assert.deepEqual(offresGroupon(pageTanStack([sansRef]), SOURCE), []);
});

test('E1 — un flux TanStack illisible est ignoré, jamais deviné', () => {
  // Un `$tsr` qui ne contient aucune carte ne rend rien — et ne lève pas.
  assert.deepEqual(offresGroupon('<html><script class="$tsr">(self.$R={})["tsr"]=[];$_TSR.e()</script></html>', SOURCE), []);
  // Une carte TRONQUÉE (accolade jamais refermée) est ignorée, pas inventée.
  const tronquee = '<script class="$tsr">{__typename:"StandardDealCard",id:"x",title:"Café offert",prices:{';
  assert.deepEqual(offresGroupon(`<html>${tronquee}</html>`, SOURCE), []);
});

