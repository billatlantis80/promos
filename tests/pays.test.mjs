/**
 * Contrôles du filtre par pays — application n°2 « Promos ».
 *
 * Ce qui compte ici : le filtre doit s'appuyer sur de VRAIES sources par pays.
 * Un sélecteur qui proposerait « Allemagne » sans source allemande afficherait
 * la même liste sous une autre étiquette — c'est-à-dire un mensonge à l'écran.
 * Ces tests vérifient donc la chaîne complète : sources → champ « pays » →
 * filtre dans l'interface.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOUTES_SOURCES, NOMS_PAYS as PAYS_COLLECTEUR } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', f), 'utf8');

const app = lire('public/app.js');
const html = lire('public/index.html');
const collecteur = lire('collecteur.mjs');

test('chaque source déclare son pays, et ce pays porte un nom', () => {
  const sansPays = TOUTES_SOURCES.filter((s) => !s.pays).map((s) => s.id);
  assert.deepEqual(sansPays, [], `sources sans pays (leurs offres atterriraient en France) : ${sansPays.join(', ')}`);
  const sansNom = TOUTES_SOURCES.filter((s) => !PAYS_COLLECTEUR[s.pays]).map((s) => s.id);
  assert.deepEqual(sansNom, [], `pays inconnu de la table des noms : ${sansNom.join(', ')}`);
});

test('chaque pays proposé a au moins une source derrière lui', () => {
  const paysSources = new Set(TOUTES_SOURCES.map((s) => s.pays));
  const orphelins = Object.keys(PAYS_COLLECTEUR).filter((c) => !paysSources.has(c));
  assert.deepEqual(orphelins, [], `pays annoncés sans aucune source : ${orphelins.join(', ')}`);
});

test('chaque source a une adresse et un type connus', () => {
  for (const s of TOUTES_SOURCES) {
    assert.match(s.url || '', /^https:\/\/[^ ]+$/, `${s.id} : adresse manquante ou non sécurisée`);
    // Les lectures possibles, énumérées ici pour qu'on ne puisse pas en ajouter
    // une en silence : un flux (« dealabs », « presse » — des <item> à
    // découper), une PAGE d'enseigne (« enseigne » — un JSON-LD à lire), une
    // page de bons plans embarqués en JSON (« groupon »), une page d'activités
    // à deux prix en HTML (« socialdeal »), une page Amazon (« amazon »,
    // « flash »), ou la page « deals » de bol.com (« bol » — des cartes à prix
    // en trois fragments, ajoutée le 10/10/2026). Chacune a son lecteur, et un
    // type non listé enverrait la page au mauvais lecteur — donc zéro offre,
    // sans erreur.
    assert.ok(['dealabs', 'presse', 'enseigne', 'groupon', 'socialdeal', 'amazon', 'flash', 'bol', 'krefel'].includes(s.type), `${s.id} : type inconnu (${s.type})`);
    assert.ok(s.id && s.nom, `${s.id} : identifiant ou nom manquant`);
  }
});

test('les sources étrangères prennent du repos', () => {
  // La collecte passe toutes les 5 minutes : interroger onze sources étrangères
  // à ce rythme les ferait couper, et l'application se figerait sans rien dire.
  const sansRepos = TOUTES_SOURCES
    .filter((s) => s.pays !== 'FR' && !s.reposMin)
    .map((s) => s.id);
  assert.deepEqual(sansRepos, [], `sources étrangères sans délai de repos : ${sansRepos.join(', ')}`);
});

test('l’interface connaît exactement les mêmes pays que le collecteur', () => {
  // Deux listes recopiées finissent toujours par diverger : on les compare.
  // NOMS_PAYS vit dans `drapeaux.js`, partagé avec le panneau : c'est donc LÀ
  // qu'il faut comparer, sinon on comparerait le collecteur à un fichier qui
  // ne contient plus la table.
  const drapeaux = lire('public/drapeaux.js');
  const bloc = (drapeaux.match(/export const NOMS_PAYS = \{([\s\S]*?)\};/) || [])[1];
  assert.ok(bloc, 'la table des noms de pays doit exister dans l’interface');
  const codesApp = [...bloc.matchAll(/([A-Z]{2}):/g)].map((m) => m[1]).sort();
  assert.deepEqual(codesApp, Object.keys(PAYS_COLLECTEUR).sort(), 'les deux tables de pays doivent être identiques');
});

test('le pays est un vrai filtre, pas un décor', () => {
  assert.match(html, /id="pays"/, 'le sélecteur de pays doit être dans la page');
  assert.match(
    app, /if \(etat\.pays !== 'tout' && paysDe\(o\) !== etat\.pays\) return false;/,
    'une offre d’un autre pays doit être écartée — via paysDe, donc selon le pays de la BOUTIQUE quand il est certain',
  );
  assert.match(app, /dessinerPays\(\)/, 'le sélecteur doit être rempli depuis les données');
  assert.match(app, /navigator\.language/, 'le pays de l’appareil doit servir de choix par défaut');
  // Le sélecteur ne doit annoncer que les pays réellement présents : proposer un
  // pays vide ferait croire à une panne.
  assert.match(app, /codes\.includes\(etat\.pays\)/, 'un pays devenu vide doit retomber sur « tous »');
});

test('chaque offre collectée porte son pays', () => {
  // Sans ce champ sur l'offre, le filtre n'aurait rien à lire.
  const occurrences = (collecteur.match(/pays: source\.pays \|\| 'FR'/g) || []).length;
  assert.ok(occurrences >= 2, `le pays doit être posé sur les offres de flux ET de presse (trouvé ${occurrences})`);
});
