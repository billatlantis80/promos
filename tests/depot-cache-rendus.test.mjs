/**
 * LE CACHE DE MESURE N'ENTRE PAS DANS LE DÉPÔT — LE RÉSULTAT, SI.
 *
 * Les 165 pages lues au navigateur pour mesurer les affiliations pèsent 99 Mo
 * (309 fichiers). Elles s'entassaient dans `donnees/rendus/` sans être écartées
 * par git : le premier `git add -A` les aurait poussées sur GitHub, à côté des
 * 45 ko de résultat qui, eux, comptent.
 *
 * L'épreuve ne vérifie pas « .gitignore contient une ligne » — une ligne peut
 * être retirée par mégarde plus tard. Elle vérifie les deux moitiés de la règle :
 * le cache est écarté, le résultat est versionné. Écarter le résultat serait
 * aussi grave que pousser le cache : l'onglet Affiliation afficherait des
 * chiffres que plus personne ne saurait reproduire.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

test('le cache de rendus (~100 Mo) est écarté du dépôt', () => {
  const ignore = fs.readFileSync(path.join(RACINE, '.gitignore'), 'utf8');
  const lignes = ignore.split('\n').map((l) => l.trim());
  assert.ok(
    lignes.includes('donnees/rendus/') || lignes.includes('donnees/rendus'),
    'donnees/rendus/ n’est plus ignoré : un « git add -A » pousserait ~99 Mo '
    + 'de HTML brut sur GitHub. Le cache se régénère avec '
    + 'outils/rendus-navigateur.py --tous.'
  );
});

test('le résultat de la mesure, lui, est bien versionné', () => {
  const ignore = fs.readFileSync(path.join(RACINE, '.gitignore'), 'utf8');
  for (const l of ignore.split('\n').map((x) => x.trim())) {
    assert.ok(
      !/^donnees\/?$/.test(l) && !/^donnees\/affiliations\.json$/.test(l),
      `« ${l} » écarterait donnees/affiliations.json du dépôt : l’onglet `
      + 'Affiliation perdrait la trace de ses 22 programmes trouvés.'
    );
  }
  assert.ok(
    fs.existsSync(path.join(RACINE, 'donnees', 'affiliations.json')),
    'donnees/affiliations.json est absent : la mesure d’affiliation n’est plus là.'
  );
});

test('la copie publiée porte exactement la même mesure que la source', () => {
  const src = path.join(RACINE, 'donnees', 'affiliations.json');
  const pub = path.join(RACINE, 'docs', 'affiliations.json');
  if (!fs.existsSync(pub)) return; // copie docs/ non générée : rien à comparer
  const a = JSON.parse(fs.readFileSync(src, 'utf8'));
  const b = JSON.parse(fs.readFileSync(pub, 'utf8'));
  assert.equal(
    b.nombreActeurs, a.nombreActeurs,
    `la copie publiée annonce ${b.nombreActeurs} acteurs contre ${a.nombreActeurs} `
    + 'en source : l’onglet Affiliation en ligne afficherait une mesure périmée.'
  );
  assert.equal(b.avecProgramme, a.avecProgramme);
  assert.equal(b.sansSigne, a.sansSigne);
  assert.equal(b.nonMesures, a.nonMesures);
});
