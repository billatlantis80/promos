/**
 * Propreté du dossier PUBLIÉ — application n°2 « Promos ».
 *
 * Défaut mesuré le 11/10/2026 : cinq fichiers morts étaient SERVI en ligne
 * (vérifié, HTTP 200 sur kazendra.com) — quatre copies d'éditeur
 * (`app.js.sauv`, `app.css.sauv`, `index.html.sauv`, `langues.js.sauv`,
 * 296 Ko) et `compte.js`, le module d'une fonctionnalité RETIRÉE.
 *
 * La cause n'est pas un oubli ponctuel, elle est STRUCTURELLE : la copie
 * `public/` → `docs/` fusionne (`cpSync` récursif). Un fichier retiré de
 * `public/` n'est donc jamais retiré du site, et une sauvegarde d'éditeur
 * posée dans `docs/` y reste pour toujours. C'est précisément la classe de
 * défaut qu'aucune relecture ne voit : personne ne pense à vérifier ce qui
 * n'a plus de raison d'être là.
 *
 * Ces deux épreuves ferment la classe. La première est un FAIT (ce qui est
 * publié est ce qui est voulu) ; la seconde est le filet qui parle, parce
 * qu'un fichier mort servi en 200 ne se plaint jamais tout seul.
 *
 * Lancement : node --test tests/proprete-publication.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const PUBLIE = path.join(RACINE, 'docs');
const SOURCE = path.join(RACINE, 'public');

/** Les fichiers que le COLLECTEUR écrit lui-même à la racine du site publié,
 *  et qui n'ont donc pas de jumeau dans `public/`. */
const PRODUITS = new Set(['offres.json', 'etat-collecte.json', 'devises.json', '.nojekyll']);

/** Un motif de sauvegarde d'éditeur : jamais publiable, où qu'il soit. */
const DECHET = /(\.sauv|\.bak|\.orig|\.old|\.tmp)$|~$/;

/* ------------------------------------------------------------------ *
 *  1. La racine du site publié ne porte QUE ce qu'on veut y voir.
 *     C'est l'épreuve qui aurait attrapé `compte.js` : il n'est plus dans
 *     `public/`, donc plus dans aucune intention, et pourtant il était servi.
 * ------------------------------------------------------------------ */
test('la racine de docs/ ne porte que des fichiers de public/ ou produits par le collecteur', () => {
  if (!fs.existsSync(PUBLIE)) return;
  const source = new Set(fs.readdirSync(SOURCE));
  const etrangers = fs.readdirSync(PUBLIE)
    .filter((f) => fs.statSync(path.join(PUBLIE, f)).isFile())
    .filter((f) => !source.has(f) && !PRODUITS.has(f));
  assert.deepEqual(
    etrangers, [],
    `fichier(s) publié(s) sans source ni producteur — ils resteraient servis à jamais : ${etrangers.join(', ')}`,
  );
});

/* ------------------------------------------------------------------ *
 *  2. Aucune sauvegarde d'éditeur n'est publiée, où que ce soit.
 *     Le collecteur les retire désormais (étape « 3 bis ») ; cette
 *     épreuve le tient, et le contrôle s'exerce aussi sur le niveau des
 *     sous-dossiers de `public/` (admin, fonts) — l'endroit exact où une
 *     copie d'éditeur avait déjà atterri une fois.
 * ------------------------------------------------------------------ */
test('aucun déchet d’éditeur n’est publié, ni à la racine ni dans les sous-dossiers', () => {
  if (!fs.existsSync(PUBLIE)) return;
  const trouves = [];
  const aVoir = [PUBLIE, ...fs.readdirSync(PUBLIE)
    .filter((f) => fs.statSync(path.join(PUBLIE, f)).isDirectory())
    .filter((d) => fs.existsSync(path.join(SOURCE, d)))   // on ne descend que là où une source existe
    .map((d) => path.join(PUBLIE, d))];
  for (const dossier of aVoir) {
    for (const f of fs.readdirSync(dossier)) {
      if (DECHET.test(f) && fs.statSync(path.join(dossier, f)).isFile()) {
        trouves.push(path.relative(RACINE, path.join(dossier, f)));
      }
    }
  }
  assert.deepEqual(trouves, [], `déchet(s) d'éditeur servi(s) en ligne : ${trouves.join(', ')}`);
});

/* ------------------------------------------------------------------ *
 *  3. Le nettoyage du collecteur est bien BRANCHÉ — un correctif qu'on
 *     ne retrouve pas dans la publication ne corrige rien.
 * ------------------------------------------------------------------ */
test('le collecteur retire les déchets d’éditeur du dossier publié', () => {
  const source = fs.readFileSync(path.join(RACINE, 'collecteur.mjs'), 'utf8');
  assert.match(source, /DÉCHETS D'ÉDITEUR, retirés du dossier PUBLIÉ/,
    'l’étape de ménage doit rester identifiable dans le collecteur');
  assert.match(source, /unlinkSync\(p\)/, 'le ménage doit SUPPRIMER, pas seulement signaler');
});
