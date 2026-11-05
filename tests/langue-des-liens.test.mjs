/**
 * LA LANGUE DE LA BOUTIQUE OUVERTE.
 *
 * Demande de B (08/10/2026) : « Quand un utilisateur utilise kazendra en
 * Français et qu'il est redirigé vers un autre site. On va prendre par exemple
 * Amazon. Amazon doit être consulté en français. Le site doit s'adapter à la
 * langue de l'utilisateur de l'appli. Si la langue n'existe pas ça sera
 * l'anglais la base. »
 *
 * CE QUI EST PROTÉGÉ ICI
 *   1. Chaque lien Amazon sort avec la langue du lecteur quand la place de
 *      marché la propose — vérifié place par place de marché le 08/10/2026 en
 *      lisant le `lang` du document renvoyé par Amazon.
 *   2. Quand elle ne la propose pas, c'est l'ANGLAIS — la règle demandée, et
 *      non un code inventé qu'Amazon ignorerait en silence.
 *   3. Aucun code de langue n'est fabriqué : tout code posé existe dans la
 *      table. Un code inventé ferait retomber Amazon sur sa langue locale sans
 *      que rien ne le dise.
 *   4. Les AUTRES marchands ne sont pas touchés : le paramètre `language` est
 *      propre à Amazon. L'ajouter partout serait une devinette.
 *
 * Lancement : node --test tests/langue-des-liens.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  langueAmazon, lienAffilie, AMAZON_LANGUES, LANGUE_REPLI_AMAZON,
} from '../public/affiliation.js';

const lang = (url, l) => new URL(langueAmazon(url, l)).searchParams.get('language');
const DE = 'https://www.amazon.de/dp/B0GZR5VMMF';
const FR = 'https://www.amazon.fr/dp/B0GZR5VMMF';
const BE = 'https://www.amazon.com.be/dp/B0GZR5VMMF';
const UK = 'https://www.amazon.co.uk/dp/B0GZR5VMMF';
const ES = 'https://www.amazon.es/dp/B0GZR5VMMF';

/* --------------------------------------------------------- la langue demandée -- */

test('un lecteur français ouvre Amazon.fr en français', () => {
  assert.equal(lang(FR, 'fr'), 'fr_FR');
});

test('un lecteur français ouvre Amazon Belgique en français', () => {
  assert.equal(lang(BE, 'fr'), 'fr_BE');
});

test('un lecteur néerlandais ouvre Amazon Belgique en néerlandais', () => {
  assert.equal(lang(BE, 'nl'), 'nl_BE');
});

test('chaque place de marché répond dans sa langue locale', () => {
  assert.equal(lang(DE, 'de'), 'de_DE');
  assert.equal(lang('https://www.amazon.it/dp/X', 'it'), 'it_IT');
  assert.equal(lang(ES, 'es'), 'es_ES');
  assert.equal(lang('https://www.amazon.nl/dp/X', 'nl'), 'nl_NL');
  assert.equal(lang('https://www.amazon.se/dp/X', 'sv'), 'sv_SE');
  assert.equal(lang('https://www.amazon.pl/dp/X', 'pl'), 'pl_PL');
  assert.equal(lang('https://www.amazon.ie/dp/X', 'en'), 'en_GB');
});

/* ------------------------------------------------------------- le repli anglais -- */

test('la langue absente de la boutique retombe sur l’ANGLAIS, jamais sur rien', () => {
  // Mesuré : amazon.de + fr_FR répond en anglais, il n'offre pas le français.
  assert.equal(lang(DE, 'fr'), 'en_GB');
  assert.equal(lang(UK, 'de'), 'en_GB');
  assert.equal(lang(ES, 'pt'), 'en_GB', 'le portugais n’existe sur aucune place de marché Amazon');
  assert.equal(lang(FR, 'sv'), 'en_GB');
});

test('une langue inconnue ne produit jamais de code inventé', () => {
  assert.equal(lang(DE, ''), 'en_GB');
  assert.equal(lang(DE, 'zz'), 'en_GB');
  assert.equal(lang(DE), 'en_GB');
  assert.equal(lang(FR, 'xx-YY'), 'en_GB');
});

/* ------------------------------------------------------------------ l'invariant -- */

test('AUCUN code de langue n’est fabriqué : tout code posé figure dans la table', () => {
  const languesApp = ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv'];
  for (const [dom, offre] of Object.entries(AMAZON_LANGUES)) {
    const autorises = new Set([...Object.values(offre), LANGUE_REPLI_AMAZON]);
    for (const l of [...languesApp, '', 'zz']) {
      const code = new URL(langueAmazon(`https://www.${dom}/dp/X`, l)).searchParams.get('language');
      assert.ok(autorises.has(code),
        `${dom} + « ${l} » a produit « ${code} », qui n'est pas un code déclaré (${[...autorises].join(', ')})`);
    }
  }
});

/* ------------------------------------------------------- les autres marchands -- */

test('un marchand qui n’est pas Amazon n’est pas touché', () => {
  const groupon = 'https://www.groupon.be/deals/xyz';
  assert.equal(langueAmazon(groupon, 'fr'), groupon);
  assert.ok(!langueAmazon(groupon, 'fr').includes('language='), 'aucun paramètre de langue sur un non-Amazon');
  const social = 'https://www.socialdeal.be/deals/brussel/xyz';
  assert.equal(lienAffilie(social, 'Social Deal', 'fr'), social);
});

/* --------------------------------------------------- la langue part avec le lien -- */

test('le lien SORTI porte la langue, même sans identifiant d’affiliation', () => {
  // Le site n'a encore aucun identifiant : `habillerAmazon` rend l'adresse
  // inchangée. Le paramètre de langue, lui, doit être là quand même.
  const sorti = lienAffilie(DE, 'Amazon', 'de');
  assert.match(sorti, /[?&]language=de_DE/, 'la langue doit être posée dans tous les cas');
});

test('la langue et l’identifiant d’affiliation cohabitent quand il y en a un', () => {
  const sorti = lienAffilie(FR, 'Amazon', 'fr');
  const u = new URL(sorti);
  assert.equal(u.searchParams.get('language'), 'fr_FR');
  assert.ok(u.hostname.includes('amazon.fr'), 'le lien reste sur la bonne place de marché');
});
