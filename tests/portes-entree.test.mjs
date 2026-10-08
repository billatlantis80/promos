/**
 * LES PORTES D'ENTRÉE — Google News et Bing.
 *
 * B (08/10/2026) : « Pourquoi avoir désactivé les moteurs Google News et Bing ? »
 *
 * Ils n'étaient PAS désactivés — ils tournaient et rapportaient 11,7 % du
 * catalogue. Ce qui les avait fait disparaître, c'est une décision juste mais
 * MUETTE : un moteur n'est pas un acteur, il n'a donc pas de ligne dans la base
 * du marché — et rien ne disait où il était passé. « Pas un acteur » s'est lu
 * « désactivé ». C'est exactement le défaut que ce fichier interdit désormais.
 *
 * CE QUE CE FICHIER PROTÈGE.
 *   1. Les moteurs COLLECTENT. Si un jour ils ne rapportaient plus rien, ce
 *      n'est pas « normal, ils sont exclus » : c'est une panne, et elle doit
 *      faire rougir l'épreuve — pas passer inaperçue.
 *   2. Ils ne sont PAS des acteurs, et ils ne le deviendront jamais : une porte
 *      d'entrée n'est pas une enseigne.
 *   3. Ils sont COMPTÉS, une fois, sans double compte : si les deux règles
 *      (exclure, compter) se contredisaient en silence, le panneau afficherait
 *      un chiffre faux — le pire des cas pour B.
 *   4. Le bloc « Portes d'entrée » du panneau est réellement BRANCHÉ : un bloc
 *      écrit mais jamais appelé ne s'affiche pas, et personne ne le remarque.
 *
 * Lancement : node --test tests/portes-entree.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { portesEntree, estMoteur } from '../public/acteurs.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

/** Le catalogue : data/ chez nous, docs/ dans la copie du dépôt (data/ n'est pas
 *  versionné — c'est LE piège qui a déjà fait échouer le workflow en silence). */
function lireCatalogue() {
  const c = [path.join(RACINE, 'data', 'offres.json'), path.join(RACINE, 'docs', 'offres.json')]
    .find((p) => fs.existsSync(p));
  assert.ok(c, 'ni data/offres.json ni docs/offres.json');
  return JSON.parse(fs.readFileSync(c, 'utf8'));
}

const catalogue = lireCatalogue();
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'acteurs.json'), 'utf8'));
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');
const r = portesEntree(catalogue);

/* ------------------------------------------------------------------ 1. Elles servent */

test('les deux portes d’entrée rapportent réellement des articles', () => {
  // Le point de départ : « désactivé » se réfute par une mesure, pas par un avis.
  assert.ok(r.totalSources > 0, 'aucune source moteur : Google News et Bing sont bien éteints');
  assert.ok(r.totalAnnonces > 0, 'les moteurs tournent mais ne rapportent plus rien');
  assert.equal(r.portes.length, 2);
  for (const p of r.portes) {
    assert.ok(p.sources > 0, `${p.nom} : aucune source`);
    assert.ok(p.annonces > 0, `${p.nom} : source présente mais zéro article rapporté`);
    assert.ok(p.pays.length > 0, `${p.nom} : aucun pays servi`);
  }
});

test('leur apport est une part réelle du catalogue, pas un résidu', () => {
  assert.ok(r.partAnnonces > 0.05,
    `les moteurs ne rapportent que ${(100 * r.partAnnonces).toFixed(1)} % : la collecte est cassée, pas « normale »`);
  assert.ok(r.totalAnnonces <= (catalogue.offres || []).length,
    'plus d’articles attribués aux moteurs que le catalogue n’en contient');
});

test('la somme des portes égale exactement les sources moteur du catalogue', () => {
  // Comptées une fois, et une seule : un article vu par Google News ET par Bing
  // ne doit pas gonfler deux lignes.
  const moteurs = (catalogue.sources || []).filter((s) => estMoteur(s.url));
  assert.equal(r.totalSources, moteurs.length,
    'le total des portes ne retombe pas sur le nombre de sources moteur');
});

test('chaque porte est reconnue par son ADRESSE, jamais par son nom', () => {
  // Les sources Google News s'appellent « Presse BE (fr) 1 » : leur nom ne dit
  // pas « Google ». Une reconnaissance par nom les raterait toutes.
  const gnews = (catalogue.sources || []).filter((s) => /news\.google\.com/i.test(s.url));
  assert.ok(gnews.length > 0);
  assert.ok(gnews.every((s) => !/google/i.test(s.nom)),
    'une source Google News porte « google » dans son nom : le test ne prouve plus rien');
  const porte = r.portes.find((p) => p.nom === 'Google News');
  assert.ok(porte.sources > 0, 'les sources Google News n’ont pas été reconnues par leur adresse');
});

/* ------------------------------------------------------- 2. Elles ne sont pas des acteurs */

test('aucun moteur n’est devenu un acteur de la base', () => {
  const noms = base.acteurs.map((a) => a.nom);
  for (const n of noms) {
    assert.ok(!/^(Google News|Bing|Bing News)$/i.test(n), `« ${n} » est un moteur, pas un acteur`);
  }
  const domaines = base.acteurs.flatMap((a) => a.domaines || []);
  assert.ok(!domaines.some((d) => estMoteur(`https://${d}`)),
    'un domaine de moteur sert de liaison : une porte d’entrée deviendrait une enseigne');
});

test('les moteurs sont comptés À PART, pas fondus dans les acteurs', () => {
  assert.ok(r.portes.every((p) => p.nom !== 'Google News' || p.sources > 0));
  assert.ok(!base.acteurs.some((a) => /moteur/i.test(a.categorie || '')),
    'aucun acteur ne doit être rangé dans une catégorie « moteur »');
});

/* ------------------------------------------------------------------ 3. Robustesse */

test('un catalogue vide ne fait pas tomber le panneau', () => {
  for (const entree of [null, {}, { sources: [], offres: [] }]) {
    const v = portesEntree(entree);
    assert.equal(v.totalAnnonces, 0);
    assert.equal(v.totalSources, 0);
    assert.equal(v.partAnnonces, 0, 'division par zéro sur un catalogue vide');
    assert.equal(v.portes.length, 2, 'les deux portes doivent rester listées, même vides');
  }
});

/* ------------------------------------------------- 4. Le bloc est-il réellement branché ? */

test('le bloc « Portes d’entrée » existe dans le panneau', () => {
  assert.match(admin, /id="mPortes"/, 'la zone d’affichage du bloc a disparu');
  assert.match(admin, /portesEntree/, 'la fonction n’est pas importée dans le panneau');
  assert.match(admin, /function dessinerPortes\s*\(/, 'la fonction d’affichage n’existe plus');
});

test('le bloc est dessiné au chargement — un bloc jamais appelé ne s’affiche pas', () => {
  // Le piège attrapé cinq fois déjà dans ce projet : la fonction existe, elle
  // est correcte, et personne ne l'appelle. On lit donc la ligne qui branche.
  const ligne = admin.split('\n').find((l) => /toutDessiner|dessinerBord\(\);/.test(l) && /dessinerPortes\(\)/.test(l));
  assert.ok(ligne, 'dessinerPortes() n’est appelée nulle part : le bloc resterait vide');
});

test('le panneau nomme la distinction au lieu de la laisser deviner', () => {
  assert.match(admin, /pas des acteurs/i);
  assert.match(admin, /porte[s]? d[’']entrée/i);
});
