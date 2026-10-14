/**
 * Contrôles du lecteur SOCIAL DEAL (activités hors Groupon) — unité B5.
 *
 * Le lecteur est exercé sur des fragments de la STRUCTURE RÉELLE mesurée en B3
 * (HTML servi par socialdeal.<tld>), pas sur des exemples inventés : on vérifie
 * ce qui a coûté une erreur la nuit — les CENTIMES dans un `<sub>` (« €19,90 »
 * et non « €19 »), le format français « 136,90€ », et le refus des cartes sans
 * second prix.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { offresSocialDeal } from '../collecteur.mjs';

const carte = ({ titre, lien = 'https://www.socialdeal.be/deals/x/y', ref, prix }) => `
<div class="information-container"><div class="title-container"><h4>${titre}</h4></div></div>
<a href="${lien}"><div class="stats-container"><div class="pricing-abc">
  <div class="original-price"><span class="prepend">Regulier</span><span class="price">${ref}</span></div>
  <span class="current-price">${prix}</span>
</div></div></a>`;

const source = (pays = 'BE') => ({ id: 'socialdeal-be', nom: 'Social Deal', type: 'socialdeal', pays, langue: 'fr', categorieImposee: 'activite' });

test('les centimes dans un <sub> ne sont pas perdus (€19,90 et non €19)', () => {
  const offres = offresSocialDeal(carte({ titre: 'Entree Pakawi Park', ref: '€30', prix: '€19<sub>,90</sub>' }), source());
  assert.equal(offres.length, 1);
  assert.equal(offres[0].prix, 19.9, 'le prix demandé doit être 19,90 €');
  assert.equal(offres[0].prixAvant, 30);
  assert.equal(offres[0].remise, 34);
  assert.equal(offres[0].categorie, 'activite');
});

test('le format français « 136,90€ » / « 99€ » est lu', () => {
  const offres = offresSocialDeal(carte({ titre: 'Spa privatif pour 2', lien: 'https://www.socialdeal.fr/deals/a/b', ref: '136,90€', prix: '99€' }), source('FR'));
  assert.equal(offres.length, 1);
  assert.equal(offres[0].prix, 99);
  assert.equal(offres[0].prixAvant, 136.9);
});

test('une carte sans second prix ne produit AUCUNE promotion', () => {
  const html = `<h4>Bon cadeau</h4><a href="https://www.socialdeal.be/deals/a/b">
    <div class="pricing-abc"><span class="current-price">€25</span></div></a>`;
  assert.equal(offresSocialDeal(html, source()).length, 0);
});

test('un prix « Gratis » n’est pas un prix', () => {
  const offres = offresSocialDeal(carte({ titre: '75 dagen gratis luisterboeken', ref: '€22,47', prix: 'Gratis' }), source());
  assert.equal(offres.length, 0);
});

test('une référence ≥ 5× le prix est écartée (faux rabais)', () => {
  const offres = offresSocialDeal(carte({ titre: 'Licence', ref: '€130', prix: '€10' }), source());
  assert.equal(offres.length, 0);
});

test('la destination à l’étranger envoie en VOYAGES, pas en Activité (point 21)', () => {
  const offres = offresSocialDeal(carte({ titre: 'Eintritt in den Movie Park Germany', lien: 'https://www.socialdeal.at/deals/x/y', ref: '€59,90', prix: '€36,90' }), source('AT'));
  assert.equal(offres.length, 1);
  assert.equal(offres[0].categorie, 'voyages', 'un parc en Allemagne vu d’Autriche est un voyage');
});

test('un soin reste un soin : Beauté, jamais Activité (point 9)', () => {
  const offres = offresSocialDeal(carte({ titre: 'Ganzkörpermassage 50 min', ref: '€60', prix: '€29,90' }), source('DE'));
  assert.equal(offres.length, 1);
  assert.equal(offres[0].categorie, 'beaute');
});
