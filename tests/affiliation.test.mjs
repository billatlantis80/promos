/**
 * Contrôles de la COUCHE D'AFFILIATION — application n°2 « Promos ».
 *
 * Ce que ces tests protègent, et pourquoi ça compte :
 *
 *   Amazon délivre un identifiant de suivi DISTINCT par programme national.
 *   Le risque réel n'est pas « le lien ne rapporte rien » (bénin) mais
 *   « l'identifiant d'un pays est posé sur le lien d'un autre » — un lien
 *   faussement tagué, qui ne rapporte rien ET expose à une anomalie.
 *
 *   La règle posée est donc : chaque lien reçoit l'identifiant de SON marché,
 *   et rien du tout si ce marché n'est pas encore ouvert.
 *
 * Le fichier testé est un module ES de navigateur (public/affiliation.js) ;
 * le projet n'a pas de package.json, donc on l'évalue ici plutôt que de
 * parier sur la détection de syntaxe de Node.
 *
 * Lancement : node --test tests/affiliation.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../public/affiliation.js', import.meta.url), 'utf8');

/** Évalue le module avec une table d'identifiants donnée.
    Sans argument : on charge la table RÉELLE du fichier (celle qu'on livre).
    `siteIdBol` : même principe pour le Site_ID de bol.com. Omis, la valeur
    RÉELLE du fichier est utilisée — elle est VIDE aujourd'hui, puisque bol
    n'attribue le Site_ID qu'après avoir accepté la candidature. */
function charger(tags, siteIdBol) {
  let source = SRC;
  if (tags !== undefined) {
    source = source.replace(
      /export const AMAZON_TAGS = \{[\s\S]*?\n\};/,
      'export const AMAZON_TAGS = ' + JSON.stringify(tags, null, 2) + ';',
    );
  }
  if (siteIdBol !== undefined) {
    source = source.replace(
      /export const BOL_SITE_ID = '[^']*';/,
      "export const BOL_SITE_ID = '" + String(siteIdBol).replace(/'/g, "\\'") + "';",
    );
  }
  source = source.replace(/\bexport\s+/g, '');
  return new Function(
    source + '\nreturn { AMAZON_TAGS, BOL_SITE_ID, RESEAUX, lienAffilie, marcheDe,'
    + ' marchesAmazonActifs, bolActif, affiliationActive, siteAmazon };',
  )();
}

const BE = 'https://www.amazon.com.be/dp/B000000001';
const FR = 'https://www.amazon.fr/dp/B000000002';
const DE = 'https://www.amazon.de/dp/B000000003';
const UK = 'https://www.amazon.co.uk/dp/B000000004';

test('aucun identifiant : le lien part INCHANGÉ (jamais de tag inventé)', () => {
  const m = charger({});
  assert.equal(m.lienAffilie(BE, 'Amazon'), BE);
  assert.equal(m.affiliationActive(), false);
  assert.deepEqual(m.marchesAmazonActifs(), []);
});

test('le tag va sur SON marché, et sur aucun autre', () => {
  const m = charger({ 'amazon.com.be': 'belgique-21', 'amazon.fr': 'france-21' });
  // Depuis le 08/10/2026 le lien sortant porte AUSSI la langue du lecteur
  // (`?language=…`) : comparer l'adresse entière ne dit plus rien du tag. On
  // interroge donc le paramètre qui NOUS intéresse ici — et seulement lui.
  const tag = (u) => new URL(u).searchParams.get('tag');
  assert.equal(tag(m.lienAffilie(BE, 'Amazon')), 'belgique-21');
  assert.equal(tag(m.lienAffilie(FR, 'Amazon')), 'france-21');
  // Le point capital : un marché NON ouvert ne reçoit RIEN — surtout pas le
  // tag d'un autre pays.
  assert.equal(tag(m.lienAffilie(DE, 'Amazon')), null);
  assert.equal(tag(m.lienAffilie(UK, 'Amazon')), null);
});

test('un marché non ouvert ne reçoit JAMAIS l’identifiant d’un autre pays', () => {
  // On ouvre le seul marché français : l'Allemagne et la Belgique doivent
  // rester intactes. C'est la règle de sûreté, testée explicitement.
  const m = charger({ 'amazon.fr': 'france-21' });
  // On ne compare plus l'adresse entière (la langue du lecteur s'y ajoute) :
  // on vérifie ce qui compte — AUCUN tag, et surtout pas celui du voisin.
  for (const u of [DE, BE, UK]) {
    assert.equal(new URL(m.lienAffilie(u, 'Amazon')).searchParams.get('tag'), null,
      `${u} ne doit porter aucun tag`);
  }
  assert.ok(!m.lienAffilie(DE, 'Amazon').includes('france-21'));
});

test('amazon.com.be n’est pas confondu avec un autre marché', () => {
  const m = charger({ 'amazon.com.be': 'be-21', 'amazon.fr': 'fr-21', 'amazon.co.uk': 'uk-21' });
  assert.equal(m.marcheDe(BE), 'amazon.com.be');
  assert.equal(m.marcheDe(UK), 'amazon.co.uk');
  assert.equal(m.marcheDe('https://www.amazon.fr/dp/X'), 'amazon.fr');
  // l'identifiant belge doit être le bon, malgré « .com » dans le domaine
  assert.ok(m.lienAffilie(BE, 'Amazon').endsWith('tag=be-21'));
  assert.ok(m.lienAffilie(UK, 'Amazon').endsWith('tag=uk-21'));
});

test('un tag déjà présent n’est jamais écrasé', () => {
  const m = charger({ 'amazon.fr': 'france-21' });
  const deja = 'https://www.amazon.fr/dp/B0?tag=quelquun-21';
  assert.equal(new URL(m.lienAffilie(deja, 'Amazon')).searchParams.get('tag'), 'quelquun-21',
    'un tag déjà posé par quelqu’un d’autre ne doit jamais être remplacé');
});

test('les dix marchés européens sont déclarés dans la table', () => {
  const m = charger();   // la table RÉELLE du fichier livré
  const attendus = ['amazon.fr', 'amazon.de', 'amazon.it', 'amazon.es', 'amazon.nl',
    'amazon.com.be', 'amazon.co.uk', 'amazon.ie', 'amazon.se', 'amazon.pl'];
  for (const d of attendus) {
    assert.ok(Object.hasOwn(m.AMAZON_TAGS, d), `marché manquant : ${d}`);
  }
  assert.equal(Object.keys(m.AMAZON_TAGS).length, 10);
});

test('les marchés ouverts sont comptés, et activent la mention légale', () => {
  const m = charger({ 'amazon.com.be': 'be-21', 'amazon.de': '' });
  assert.deepEqual(m.marchesAmazonActifs(), ['amazon.com.be']);
  assert.equal(m.affiliationActive(), true);
});

test('un lien non Amazon reste intact tant qu’aucun réseau n’est configuré', () => {
  const m = charger({ 'amazon.fr': 'fr-21' });
  const autre = 'https://www.coolblue.be/fr/produit/123';
  assert.equal(m.lienAffilie(autre, 'Coolblue'), autre);
});

test('une adresse illisible ne fait pas planter la couche', () => {
  const m = charger({ 'amazon.fr': 'fr-21' });
  assert.equal(m.lienAffilie('pas une url', 'Amazon'), 'pas une url');
  assert.equal(m.marcheDe('pas une url'), '');
});

/*
 * LE SITE DE DESTINATION — demande de B : « quand on veut acheter sur Amazon,
 * il faut rajouter l'extension .be .fr .de .it du site Amazon concerné ».
 * Le bouton disait « Acheter sur Amazon » sans dire OÙ, alors qu'il envoie vers
 * dix marchés différents.
 */
test('le bouton NOMME le site Amazon de destination, pour les dix marchés', () => {
  const m = charger({});
  const attendu = {
    'https://www.amazon.com.be/dp/B1': 'Amazon.com.be',
    'https://www.amazon.fr/dp/B1': 'Amazon.fr',
    'https://www.amazon.de/dp/B1': 'Amazon.de',
    'https://www.amazon.it/dp/B1': 'Amazon.it',
    'https://www.amazon.es/dp/B1': 'Amazon.es',
    'https://www.amazon.nl/dp/B1': 'Amazon.nl',
    'https://www.amazon.co.uk/dp/B1': 'Amazon.co.uk',
    'https://www.amazon.ie/dp/B1': 'Amazon.ie',
    'https://www.amazon.se/dp/B1': 'Amazon.se',
    'https://www.amazon.pl/dp/B1': 'Amazon.pl',
  };
  for (const [url, nom] of Object.entries(attendu)) {
    assert.equal(m.siteAmazon(url), nom, `mauvais site pour ${url}`);
  }
});

test('le site affiché est celui du LIEN, jamais celui du nom du marchand', () => {
  // Un marchand nommé « Amazon » mais dont le lien est illisible ou étranger ne
  // doit PAS se voir attribuer un site : mieux vaut le libellé générique qu'un
  // site inventé.
  const m = charger({});
  assert.equal(m.siteAmazon('pas une url'), '');
  assert.equal(m.siteAmazon(''), '');
  assert.equal(m.siteAmazon('https://www.coolblue.be/fr/produit/123'), '');
  // Piège : « notamazon.com » n'est pas Amazon (frontière de mot obligatoire).
  assert.equal(m.siteAmazon('https://www.notamazon.com/dp/B1'), '');
  // « amazon. » doit être le début du domaine, pas un morceau au milieu.
  assert.equal(m.siteAmazon('https://www.pasamazon.fr/dp/B1'), '');
});

test('le libellé du bouton s’écrit dans la langue choisie, site compris', () => {
  const m = charger({});
  const site = m.siteAmazon('https://www.amazon.com.be/dp/B1');
  assert.equal(site, 'Amazon.com.be');
  // L'emplacement {site} est remplacé par interpole() du moteur i18n.
  const rendu = (modele) => modele.replace('{site}', site);
  assert.equal(rendu('Acheter sur {site}'), 'Acheter sur Amazon.com.be');
  assert.equal(rendu('Bei {site} kaufen'), 'Bei Amazon.com.be kaufen');
  assert.equal(rendu('Kopen bij {site}'), 'Kopen bij Amazon.com.be');
});

/* ======================================================================== *
 *  BOL.COM — l'enveloppe du programme bol (décidée le 10/10/2026).
 *
 *  Ce qui est protégé ici n'est pas « le lien rapporte » mais trois façons de
 *  le casser pour de bon, toutes silencieuses à l'œil :
 *
 *   1. une enveloppe posée avec un Site_ID VIDE : le lien part, mais il ne
 *      mène nulle part — pire qu'une absence de commission ;
 *   2. l'enveloppe posée sur un AUTRE marchand : elle ne suivrait rien et
 *      masquerait le vrai lien ;
 *   3. l'enveloppe posée DEUX FOIS : à chaque passage, l'adresse s'allonge
 *      jusqu'à devenir illisible.
 * ======================================================================== */
const BOL = 'https://www.bol.com/be/fr/p/gillette-venus-10-lames-de-rasoir/9300000123456/';

test('sans Site_ID bol, le lien part EN DIRECT — jamais d’enveloppe vide', () => {
  const m = charger({}, '');
  assert.equal(m.bolActif(), false);
  assert.equal(m.lienAffilie(BOL, 'bol.com'), BOL,
    'tant que bol n’a pas attribué de Site_ID, le lien reste celui du produit');
  assert.equal(m.affiliationActive(), false, 'aucun identifiant : l’affiliation est inactive');
});

test('avec un Site_ID, le lien bol passe par l’enveloppe de bol', () => {
  const m = charger({}, '33456');
  const u = new URL(m.lienAffilie(BOL, 'bol.com'));
  assert.equal(u.hostname, 'partner.bol.com');
  assert.equal(u.pathname, '/click/click');
  assert.equal(u.searchParams.get('p'), '1');
  assert.equal(u.searchParams.get('t'), 'url');
  assert.equal(u.searchParams.get('s'), '33456', 'le Site_ID de bol est bien porté par « s »');
  assert.equal(u.searchParams.get('f'), 'TXL');
  assert.equal(u.searchParams.get('url'), BOL, 'l’adresse du produit est transportée intacte');
  assert.equal(u.searchParams.get('name'), 'kazendra');
  assert.equal(m.bolActif(), true);
  assert.equal(m.affiliationActive(), true);
  // Le Site_ID est détecté AUSSI depuis le nom du marchand, pas seulement depuis
  // l'adresse : le site appelle la fonction avec les deux.
  assert.ok(m.lienAffilie(BOL, 'Bol.com').startsWith('https://partner.bol.com/click/click'));
});

test('l’enveloppe bol ne se pose JAMAIS sur un autre marchand', () => {
  const m = charger({ 'amazon.com.be': 'belgique-21' }, '33456');
  const coolblue = 'https://www.coolblue.be/fr/produit/123';
  assert.equal(m.lienAffilie(coolblue, 'Coolblue'), coolblue);
  // Amazon garde SON mécanisme — le paramètre `tag` — et ne passe pas par bol.
  const amz = m.lienAffilie('https://www.amazon.com.be/dp/B1', 'Amazon');
  assert.ok(!amz.includes('partner.bol.com'), 'Amazon ne passe pas par le réseau de bol');
  assert.equal(new URL(amz).searchParams.get('tag'), 'belgique-21');
  // Piège de frontière : « notbol.com » n'est pas bol.com.
  assert.equal(m.lienAffilie('https://www.notbol.com/p/1', 'Notbol'), 'https://www.notbol.com/p/1');
});

test('une adresse bol déjà enveloppée n’est jamais enveloppée deux fois', () => {
  const m = charger({}, '33456');
  const une = m.lienAffilie(BOL, 'bol.com');
  const deux = m.lienAffilie(une, 'bol.com');
  assert.equal(deux, une, 'le lien est STABLE : un second passage ne l’abîme pas');
  assert.equal((deux.match(/partner\.bol\.com/g) || []).length, 1, 'une seule enveloppe');
  assert.equal(new URL(deux).searchParams.get('url'), BOL, 'l’adresse encodée reste celle du produit');
});

test('le Site_ID livré est VIDE tant que bol ne l’a pas attribué', () => {
  // Ce test n'est pas une formalité : il décrit l'état réel du partenariat. Le
  // jour où B collera son Site_ID dans public/affiliation.js, ce test tombera —
  // et il faudra le RÉÉCRIRE (pas le supprimer), en y consignant la date.
  const m = charger();
  assert.equal(m.BOL_SITE_ID, '');
  assert.equal(m.bolActif(), false);
});
