/**
 * LES LIBELLÉS DE CARTE PASSENT-ILS TOUS PAR LE MOTEUR MULTILINGUE ?
 *
 * Défaut mesuré : les traductions des badges de carte (« prix réel », « presse »,
 * « bonne affaire », « économise {n} », « n'est plus dans la liste », « gardée
 * {n} ») et de leurs INFOBULLES existaient bel et bien dans les neuf
 * dictionnaires — mais app.js écrivait le texte français EN DUR. Résultat : tout
 * restait en français dans les neuf langues. Dans l'interface allemande, on
 * lisait « Bei Amazon.nl kaufen » (juste) à côté de « économise 39,41 € »
 * (français).
 *
 * Rien ne pouvait le voir : les dictionnaires étaient complets, les clés
 * présentes partout, aucune valeur vide. Ce qui manquait n'était pas la
 * traduction, c'était L'APPEL. C'est donc l'appel qu'on vérifie ici.
 *
 * Lancement : node --test tests/multilingue-cartes.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, definirLangue } from '../public/langues.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.join(ICI, '..', 'public', 'app.js'), 'utf8');

/* Les formes figées, nommées telles qu'elles ÉTAIENT dans le code. */
const INTERDITS = [
  ['>prix réel</span>', 'le badge « prix réel »'],
  ['>presse</span>', 'le badge « presse »'],
  ['>bonne affaire</span>', 'le badge « bonne affaire »'],
  ['>économise ${', 'le badge « économise … »'],
  ['n’est plus dans la liste</span>', 'le badge « n’est plus dans la liste »'],
  ['`gardée ${', 'le libellé « gardée … »'],
  ['title="Score de la communauté Dealabs"', "l'infobulle du score Dealabs"],
  ["? 'Retirer des favoris' : 'Garder de côté'", "l'infobulle du bouton favori"],
  ['title="Prix réel et marchand affichés', "l'infobulle du badge « prix réel »"],
  ['title="Bon plan relevé par la presse', "l'infobulle du badge « presse »"],
  ['title="Bon plan relayé par la communauté', "l'infobulle du badge « bonne affaire »"],
  ['title="Économie par rapport au prix de référence"', "l'infobulle du badge « économise »"],
  ["title=\"Cette offre n'est plus dans la liste du jour", "l'infobulle du badge « périmé »"],
];

test('aucun libellé de carte n’est figé en français dans le code', () => {
  const restes = INTERDITS.filter(([motif]) => js.includes(motif))
    .map(([motif, quoi]) => `${quoi} → ${motif}`);
  assert.deepEqual(restes, [],
    `libellés écrits en dur (donc intraduisibles) :\n  ${restes.join('\n  ')}`);
});

test('chaque libellé de carte est réellement demandé au moteur', () => {
  const attendus = [
    "t('prix réel')", "t('presse')", "t('bonne affaire')",
    "t('économise {n}'", "t(\"n'est plus dans la liste\")", "t('gardée {n}'",
    "t('Score de la communauté Dealabs')", "t('Économie par rapport au prix de référence')",
    "t('Retirer des favoris')", "t('Garder de côté')",
    "t('Pourcentage calculé entre deux prix réels')",
    "t('Pourcentage annoncé par la source')",
  ];
  const manquants = attendus.filter((a) => !js.includes(a));
  assert.deepEqual(manquants, [], `appels t() absents : ${manquants.join(', ')}`);
});

test('chacune de ces clés rend bien sa traduction (pas le français)', () => {
  // Le contrôle décisif : on interroge le VRAI moteur, langue par langue, et on
  // exige que le texte rendu ait changé. Une clé absente serait rendue TELLE
  // QUELLE par t() — donc en français, sans erreur. C'est exactement ainsi que
  // le défaut est passé inaperçu.
  const cles = [
    ['prix réel', {}], ['presse', {}], ['bonne affaire', {}],
    ['économise {n}', { n: '39,41 €' }], ["n'est plus dans la liste", {}],
    ['gardée {n}', { n: '2 h' }], ['Score de la communauté Dealabs', {}],
    ['Économie par rapport au prix de référence', {}],
    ['Retirer des favoris', {}], ['Garder de côté', {}],
    ['Pourcentage calculé entre deux prix réels', {}],
    ['Pourcentage annoncé par la source', {}],
  ];
  const figes = [];
  for (const code of ['nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']) {
    definirLangue(code);
    for (const [cle, vars] of cles) {
      const rendu = t(cle, vars);
      if (rendu === cle) figes.push(`${code} « ${cle} »`);
    }
  }
  definirLangue('fr');
  assert.deepEqual(figes, [],
    `libellés restés en français (clé introuvable ou non traduite) :\n  ${figes.join('\n  ')}`);
});
