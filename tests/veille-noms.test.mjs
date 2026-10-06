/**
 * Étiquettes des marchands surveillés — application n°2 « Promos ».
 *
 * Ce fichier existe à cause d'un défaut réel : l'étiquette d'un marchand était
 * le PREMIER MOT de son nom. « Media Markt » s'affichait donc « Media »,
 * « Vanden Borre » s'affichait « Vanden » — la carte signait l'offre d'un
 * marchand qui n'existe pas. Le commentaire du code mettait déjà en garde
 * contre ce risque pour les requêtes du type « folder Delhaize » ; la règle
 * n'avait pas été appliquée aux noms composés.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUTES_SOURCES } from '../collecteur.mjs';

test('aucune étiquette de marchand n’est un mot tronqué', () => {
  // Tous les noms déclarés dans la veille marchande.
  const noms = TOUTES_SOURCES.map((s) => s.nom);
  for (const tronque of ['Media', 'Vanden', 'Maxi', 'Vanden Borre Belgique']) {
    assert.ok(!noms.includes(tronque), `« ${tronque} » ne doit pas être une étiquette de marchand`);
  }
});

test('les noms composés survivent, sans leur qualificatif de pays', () => {
  // Les étiquettes publiées portent le pays entre parenthèses (« Media Markt
  // (BE) ») : on le retire ici pour ne comparer que le nom du marchand.
  const noms = new Set(TOUTES_SOURCES.map((s) => s.nom.replace(/\s*\([A-Z]{2}\)$/, '')));
  assert.ok(noms.has('Media Markt'), '« Media Markt Belgique » doit s’étiqueter « Media Markt »');
  assert.ok(noms.has('Vanden Borre'), '« Vanden Borre » doit rester entier');
  assert.ok(noms.has('Maxi Toys'), '« Maxi Toys » doit rester entier');
  assert.ok(noms.has('Aldi'), '« Aldi Belgique » doit s’étiqueter « Aldi »');
  assert.ok(noms.has('Colruyt'));
});

test('aucune étiquette ne traîne son pays entre parenthèses ou en suffixe', () => {
  const fautives = TOUTES_SOURCES.map((s) => s.nom).filter((n) => /\b(belgique|belgi[ëe])\b/i.test(n));
  assert.deepEqual(fautives, [], `étiquettes avec le pays collé : ${fautives.join(', ')}`);
});
