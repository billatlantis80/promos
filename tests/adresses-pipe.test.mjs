/**
 * LE TUYAU DES ADRESSES DE PROMOTIONS.
 *
 * Demande de B (09/10/2026) : « j'aimerais que tu essayes de tous les activer,
 * en mettant une adresse dans le champ, qui ramène aux promotions du site et
 * qui est vide pour l'instant. Chaque fois que tu en as fait un tu vérifies et
 * tu publies. »
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI IL EST NÉCESSAIRE.
 *   La colonne « Adresse des promotions » existait depuis le 08/10 dans le
 *   panneau, avec une aide qui promettait « il sera utilisé par la collecte ».
 *   C'ÉTAIT FAUX : l'adresse n'était conservée que dans le navigateur, et aucun
 *   programme ne la lisait. Remplir 600 champs n'aurait rien changé.
 *
 *   Ce que ces épreuves empêchent de reproduire :
 *     1. LE TUYAU SE DÉBRANCHE EN SILENCE. `SOURCES_ADRESSES` doit rester dans
 *        `TOUTES_SOURCES` — le jour où quelqu'un retire un terme de ce tableau,
 *        les adresses cessent d'être lues sans qu'aucun écran ne le dise.
 *     2. UNE ADRESSE FAUSSE PASSE POUR BONNE. Le fichier publié ne doit porter
 *        QUE des adresses http(s) réelles : une chaîne vide ou un domaine nu
 *        fabriquerait une URL invalide, et la source échouerait à chaque
 *        passage au lieu de disparaître proprement.
 *     3. ON LIT DEUX FOIS LA MÊME PAGE. Une adresse déjà câblée dans
 *        SOURCES_ENSEIGNES doit être ignorée — sinon elle compte deux fois les
 *        mêmes articles.
 *     4. LE PAYS SE PERD. Une source sans pays range ses offres dans le mauvais
 *        marché ; c'est la base d'acteurs qui le donne, pas le hasard.
 *     5. LE PANNEAU NE MONTRE PAS CE QUI EST PUBLIÉ. Les trois origines d'une
 *        adresse (saisie / publiée / relevée) doivent rester DISTINCTES, et
 *        l'ordre doit tenir : ce que B tape sur son appareil gagne.
 *
 * Lancement : node --test tests/adresses-pipe.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourcesAdressesDepuis, TOUTES_SOURCES } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');

/* ------------------------------------------------------------------ *
 *  1. LA RÈGLE, EXERCÉE POUR DE VRAI.
 * ------------------------------------------------------------------ */
test('une adresse valide devient une source d’enseigne, complète', () => {
  const r = sourcesAdressesDepuis(
    { Zalando: 'https://www.zalando.be/promotions' },
    [{ nom: 'Zalando', pays: 'BE' }],
    [],
  );
  assert.equal(r.length, 1, 'l’adresse publiée doit produire une source');
  assert.equal(r[0].type, 'enseigne', 'la collecte ne lit une page marchande que par ce type');
  assert.equal(r[0].url, 'https://www.zalando.be/promotions');
  assert.equal(r[0].pays, 'BE');
  assert.equal(r[0].langue, 'fr', 'la langue doit suivre le pays de l’acteur');
  assert.ok(r[0].id && r[0].id.startsWith('adr-'), 'chaque source a besoin d’un identifiant propre');
  assert.ok(r[0].reposMin >= 60, 'ces pages n’ont pas été mesurées une à une : on les visite prudemment');
});

test('une adresse vide, un domaine nu ou une chaîne farfelue sont ÉCARTÉS', () => {
  const r = sourcesAdressesDepuis(
    { Vide: '', Espaces: '   ', DomaineNu: 'coolblue.be', Rien: null, Bonne: 'https://ok.example/promo' },
    [{ nom: 'Vide', pays: 'BE' }, { nom: 'Espaces', pays: 'BE' }, { nom: 'DomaineNu', pays: 'BE' },
      { nom: 'Rien', pays: 'BE' }, { nom: 'Bonne', pays: 'FR' }],
    [],
  );
  assert.equal(r.length, 1, 'seule l’adresse http(s) réelle doit survivre');
  assert.equal(r[0].nom, 'Bonne');
});

test('une adresse DÉJÀ câblée n’est pas lue une deuxième fois', () => {
  const deja = [{ url: 'https://www.coolblue.be/fr/offres' }];
  const r = sourcesAdressesDepuis(
    { Coolblue: 'https://www.coolblue.be/fr/offres', Autre: 'https://autre.example/promo' },
    [{ nom: 'Coolblue', pays: 'BE' }, { nom: 'Autre', pays: 'BE' }],
    deja,
  );
  assert.equal(r.length, 1, 'relire la même page ne double pas la couverture : elle double les articles');
  assert.equal(r[0].nom, 'Autre');
});

test('la même adresse sous deux noms ne passe qu’une fois', () => {
  const r = sourcesAdressesDepuis(
    { Un: 'https://meme.example/promo', Deux: 'https://meme.example/promo' },
    [{ nom: 'Un', pays: 'BE' }, { nom: 'Deux', pays: 'BE' }],
    [],
  );
  assert.equal(r.length, 1, 'une adresse identique ne doit pas être interrogée deux fois par passage');
});

test('la langue suit le pays — un Suédois n’est pas lu en français', () => {
  const r = sourcesAdressesDepuis(
    { Suedois: 'https://www.exemple.se/erbjudanden', Allemand: 'https://www.exemple.de/angebote', Anglais: 'https://www.exemple.co.uk/sale' },
    [{ nom: 'Suedois', pays: 'SE' }, { nom: 'Allemand', pays: 'DE' }, { nom: 'Anglais', pays: 'GB' }],
    [],
  );
  const par = Object.fromEntries(r.map((s) => [s.nom, s.langue]));
  assert.equal(par.Suedois, 'sv');
  assert.equal(par.Allemand, 'de');
  assert.equal(par.Anglais, 'en');
});

test('un nom absent de la base ne fait pas tomber la lecture', () => {
  // Un acteur ajouté à la main dans le fichier, mais pas encore dans la base :
  // il doit ressortir avec un pays de repli, jamais une exception.
  const r = sourcesAdressesDepuis({ Inconnu: 'https://inconnu.example/promo' }, [], []);
  assert.equal(r.length, 1);
  assert.ok(r[0].pays, 'un pays de repli est nécessaire : une source sans pays range ses offres dans le mauvais marché');
});

test('une table vide rend une liste vide — jamais null', () => {
  for (const entree of [null, undefined, {}, []]) {
    assert.deepEqual(sourcesAdressesDepuis(entree, [], []), []);
  }
});

/* ------------------------------------------------------------------ *
 *  2. LE TUYAU EST BRANCHÉ — PAS SEULEMENT ÉCRIT.
 * ------------------------------------------------------------------ */
test('les adresses publiées entrent bien dans TOUTES_SOURCES', () => {
  // Sans cette épreuve, retirer `...SOURCES_ADRESSES` de TOUTES_SOURCES
  // débrancherait le tuyau entier sans qu'aucun test ne bronche : le fichier
  // serait rempli, le panneau l'afficherait, et la collecte l'ignorerait.
  const fichier = path.join(RACINE, 'public', 'adresses-promotions.json');
  const publie = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const attendues = Object.values(publie.adresses || {})
    .map((u) => String(u || '').trim())
    .filter((u) => /^https?:\/\//i.test(u));
  const dansSources = TOUTES_SOURCES.filter((s) => String(s.id).startsWith('adr-'));
  if (!attendues.length) {
    assert.equal(dansSources.length, 0, 'aucune adresse publiée ne doit produire de source');
    return;
  }
  assert.ok(dansSources.length > 0,
    'le fichier publie des adresses et TOUTES_SOURCES n’en porte AUCUNE : le tuyau est débranché');
  for (const s of dansSources) {
    assert.equal(s.type, 'enseigne', 'une source d’adresse se lit en JSON-LD, comme les enseignes câblées');
    assert.ok(s.pays && s.langue, 'chaque source doit porter son pays et sa langue');
    assert.ok(/^https?:\/\//i.test(s.url));
  }
});

/* ------------------------------------------------------------------ *
 *  3. LE PANNEAU MONTRE CE QUI EST PUBLIÉ.
 * ------------------------------------------------------------------ */
test('le panneau charge le fichier publié AVANT de dessiner', () => {
  assert.match(admin, /async function chargerAdressesPubliees\s*\(/, 'la lecture du fichier publié a disparu');
  assert.match(admin, /adresses-promotions\.json/, 'le panneau doit lire le fichier publié');
  assert.match(admin, /await chargerAdressesPubliees\(\)/,
    'le chargement doit être ATTENDU avant le premier dessin, sinon la colonne s’affiche vide puis se remplit');
  const iCharge = admin.indexOf('await chargerAdressesPubliees()');
  const iDessin = admin.indexOf('toutDessiner()', iCharge);
  assert.ok(iDessin > iCharge, 'le dessin doit venir après le chargement');
});

test('une adresse publiée s’affiche comme telle, et ne se confond pas avec une saisie', () => {
  const corps = admin.match(/function adresseActeur\([\s\S]*?\n\}/);
  assert.ok(corps, 'adresseActeur doit exister');
  const adresseActeur = new Function('adressePubliee',
    `${corps[0]}; return adresseActeur;`)((n) => (n === 'Publie' ? 'https://publi.example/promo' : ''));

  const acteur = (nom) => ({ nom, liaison: { flux: [{ nom: 'Flux' }] } });
  const urls = { Flux: 'https://flux.example/rss' };

  assert.equal(adresseActeur(acteur('Publie'), {}, urls).origine, 'publiee',
    'une adresse publiée doit s’annoncer publiée, pas « relevée de la source »');
  assert.equal(adresseActeur(acteur('Publie'), {}, urls).url, 'https://publi.example/promo');
});

test('l’ordre tient : ta saisie bat le fichier publié, qui bat la source', () => {
  const corps = admin.match(/function adresseActeur\([\s\S]*?\n\}/)[0];
  const adresseActeur = new Function('adressePubliee',
    `${corps}; return adresseActeur;`)((n) => (n === 'Tout' ? 'https://publi.example/promo' : ''));
  const a = { nom: 'Tout', liaison: { flux: [{ nom: 'Flux' }] } };
  const urls = { Flux: 'https://flux.example/rss' };

  assert.equal(adresseActeur(a, { Tout: 'https://ma-saisie.example/x' }, urls).origine, 'saisie',
    'ce que B tape sur son appareil est la donnée la plus récente : elle doit gagner');
  assert.equal(adresseActeur(a, {}, urls).origine, 'publiee',
    'sans saisie, c’est le fichier publié qui parle');
  assert.equal(adresseActeur({ nom: 'Rien', liaison: { flux: [{ nom: 'Flux' }] } }, {}, urls).origine, 'source',
    'sans saisie ni publication, on retombe sur la source lue');
  assert.equal(adresseActeur({ nom: 'Rien', liaison: { flux: [] } }, {}, {}).origine, 'aucune',
    'sans rien, la case doit dire « non renseignée »');
});

test('l’écran distingue les trois origines', () => {
  assert.match(admin, /publiée avec le site/, 'la pastille « publiée » doit exister à l’écran');
  const i = admin.indexOf('const blocAdresse');
  assert.ok(i > -1, 'blocAdresse doit exister (c’est lui qui dessine la cellule)');
  const bloc = admin.slice(i, i + 900);
  assert.match(bloc, /origine === 'publiee'/, 'blocAdresse doit traiter l’origine publiée');
});

test('l’aide du panneau ne promet plus ce qui n’existe pas', () => {
  assert.match(admin, /adresses-promotions\.json/,
    'l’aide doit dire D’OÙ viennent les adresses publiées');
  assert.ok(!/sera utilisé par la collecte\.\s*La <b>note<\/b>/.test(admin),
    'la phrase d’origine ne doit pas avoir été laissée telle quelle');
});
