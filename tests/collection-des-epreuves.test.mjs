/**
 * CE QUE LA SUITE RAMASSE — application n°2 « Promos ».
 *
 * Défaut mesuré le 15/10/2026, et il a rendu le SECOURS MUET :
 *
 *   `outils/test-rattachement-pays.mjs` — un outil de mesure d'un soir, gardé
 *   là après la question qu'il servait à trancher — portait un nom commençant
 *   par « test- ». Or `node --test`, lancé sans argument (c'est ce que font
 *   bin/tester.sh **et** le workflow GitHub), ramasse TOUT fichier qui
 *   ressemble à une épreuve, où qu'il soit dans le dépôt.
 *
 *   Ses deux repères dans `public/app.js` avaient disparu le 15/10 à 10:08
 *   (nettoyage de 356 lignes) : l'outil sortait donc en code 1. Résultat
 *   mesuré : le workflow horaire « Collecte des promos » a échoué aux
 *   passages de 10:22 et 11:22 — et comme l'étape Tests est AVANT l'étape de
 *   collecte, **le secours ne collectait plus rien du tout**, en silence.
 *
 *   En local, la suite restait VERTE dès qu'on la lançait sur le glob
 *   (`node --test tests/*.test.mjs`) : le rouge n'existait que dans la
 *   commande du workflow. C'est la classe de défaut la plus coûteuse qui
 *   soit — un contrôle de qualité devenu interrupteur d'arrêt, que personne
 *   ne lit.
 *
 * Cette épreuve ferme la classe : la suite ne contient QUE les épreuves
 * voulues, et un outil de diagnostic ne peut plus l'éteindre par son nom.
 *
 * Lancement : node --test tests/collection-des-epreuves.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

/** Les dossiers qu'on ne visite pas : ni la copie publiée, ni les dépôts. */
const IGNORES = new Set(['.git', 'node_modules', 'docs', 'donnees', 'data', '__pycache__', '.hermes']);

/**
 * Les motifs que `node --test` retient quand on l'appelle sans argument.
 * Recopiés de sa règle de sélection : c'est elle qu'on surveille, donc c'est
 * elle qu'on écrit ici en clair.
 */
const RAMASSABLE = /(?:^test-.*|^test|.*\.test|.*[-_]test)\.(?:c|m)?js$/;

function fichiersRamassables(dossier) {
  const trouves = [];
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (IGNORES.has(entree.name)) continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      trouves.push(...fichiersRamassables(complet));
    } else if (RAMASSABLE.test(entree.name)) {
      trouves.push(path.relative(RACINE, complet));
    }
  }
  return trouves;
}

test('la suite ne ramasse QUE les épreuves de tests/ — un outil ne peut pas l’éteindre par son nom', () => {
  const ramasses = fichiersRamassables(RACINE);
  const intrus = ramasses.filter((f) => !f.startsWith('tests' + path.sep));

  assert.deepEqual(
    intrus, [],
    'fichier(s) ramassé(s) par `node --test` hors de tests/ — le workflow lance les épreuves AVANT '
    + 'de collecter : un échec ici éteint le secours horaire, en silence. '
    + `Nom à changer (ou fichier à retirer) : ${intrus.join(', ')}`,
  );
});

test('les épreuves de tests/ sont bien celles attendues, et il y en a', () => {
  const epreuves = fs.readdirSync(ICI).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(epreuves.length > 50, `trop peu d’épreuves trouvées dans tests/ : ${epreuves.length}`);
  assert.ok(
    epreuves.every((f) => f.endsWith('.test.mjs')),
    'les épreuves de tests/ portent toutes le suffixe .test.mjs',
  );
});
