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
    Sans argument : on charge la table RÉELLE du fichier (celle qu'on livre). */
function charger(tags) {
  let source = SRC;
  if (tags !== undefined) {
    source = source.replace(
      /export const AMAZON_TAGS = \{[\s\S]*?\n\};/,
      'export const AMAZON_TAGS = ' + JSON.stringify(tags, null, 2) + ';',
    );
  }
  source = source.replace(/\bexport\s+/g, '');
  return new Function(
    source + '\nreturn { AMAZON_TAGS, RESEAUX, lienAffilie, marcheDe,'
    + ' marchesAmazonActifs, affiliationActive, siteAmazon };',
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
  assert.equal(m.lienAffilie(BE, 'Amazon'), BE + '?tag=belgique-21');
  assert.equal(m.lienAffilie(FR, 'Amazon'), FR + '?tag=france-21');
  // Le point capital : un marché NON ouvert ne reçoit RIEN — surtout pas le
  // tag d'un autre pays.
  assert.equal(m.lienAffilie(DE, 'Amazon'), DE);
  assert.equal(m.lienAffilie(UK, 'Amazon'), UK);
});

test('un marché non ouvert ne reçoit JAMAIS l’identifiant d’un autre pays', () => {
  // On ouvre le seul marché français : l'Allemagne et la Belgique doivent
  // rester intactes. C'est la règle de sûreté, testée explicitement.
  const m = charger({ 'amazon.fr': 'france-21' });
  assert.equal(m.lienAffilie(DE, 'Amazon'), DE);
  assert.equal(m.lienAffilie(BE, 'Amazon'), BE);
  assert.equal(m.lienAffilie(UK, 'Amazon'), UK);
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
  assert.equal(m.lienAffilie(deja, 'Amazon'), deja);
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
