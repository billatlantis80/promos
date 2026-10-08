/* =============================================================================
   L'IDENTIFIANT D'UNE OFFRE DOIT DISTINGUER LES OFFRES.

   Défaut corrigé le 08/10/2026. L'identifiant était fabriqué ainsi :

       's' + Buffer.from(lien.split('').reverse().join('')).toString('base64url').slice(0, 14)

   Inverser la chaîne met la FIN du lien en tête — or toutes les offres d'un
   même site finissent pareil (« …/amsterdam/ », « …/lessurb-6 »). Les 14
   premiers caractères du base64 ne portaient donc que ce suffixe commun.

   Conséquence VUE EN DIRECT : un favori enregistré sur « Séance de HIFU/MFU…
   à Bruxelles » rouvrait « 2 ou 3 parties de bowling + karting à Beersel ».

   Mesuré sur le catalogue publié (14 004 offres) :
     • ancienne méthode : 339 identifiants partagés par 962 offres DISTINCTES ;
     • nouvelle méthode : 0.
   Allonger la troncature ne suffisait pas (60 caractères : encore des
   centaines de collisions) — c'est l'inversion qui jetait l'information.

   Ces épreuves tiennent en deux temps :
     1. un témoin FIGÉ (des liens réels, écrits ici) — il ne dépend d'aucune
        donnée et ne peut pas pourrir quand le catalogue tourne ;
     2. le contrôle de PROPRIÉTÉ sur tout le catalogue réel.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identifiant, migrerIdentifiants } from '../collecteur.mjs';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** L'ancienne fabrication, conservée ICI pour prouver le défaut qu'on a corrigé. */
const ancienIdentifiant = (prefixe, source) =>
  prefixe + Buffer.from(String(source).split('').reverse().join(''))
    .toString('base64url').slice(0, 14);

/* --------------------------------------------------------------------------
   TÉMOIN FIGÉ — les liens RÉELS qui partageaient l'identifiant « sL21hZHJldHNtYS ».
   Onze offres Social Deal d'Amsterdam, toutes différentes, sous UN SEUL
   identifiant : les quatre ci-dessous suffisent à démontrer le défaut, et le
   fait qu'ils se terminent tous par « amsterdam/ » montre la cause exacte.
   -------------------------------------------------------------------------- */
const TEMOIN = [
  'https://www.socialdeal.nl/deals/amsterdam/braai-westerpark/geniet-van-heerlijke-bbq-gerechten-tijdens-een-shared-lunch-bij-braai-westerpark-in-amsterdam-samenkomen-en-genieten-van-lekker-eten-staat-hier-centraal-okt-2026-amsterdam/',
  'https://www.socialdeal.nl/deals/amsterdam/kuma-129/duik-in-de-wereld-van-sushi-met-een-japans-4-gangen-shared-dining-diner-bij-kuma-129-nabij-het-leidseplein-met-bij-het-hoofdgerecht-1-of-2-verrassende-sushi-rolls-sep-2026-amsterdam/',
  'https://www.socialdeal.nl/deals/amsterdam/restaurant-de-lunch/geniet-van-een-verrukkelijk-4-gangen-keuzediner-bij-restaurant-de-lunch-proef-heerlijke-gerechten-bereid-met-lokale-en-dagverse-producten-okt-2026-amsterdam/',
  'https://www.socialdeal.nl/deals/amsterdam/teds-amsterdam-oost/geniet-van-een-heerlijke-high-tea-naar-keuze-eventueel-inclusief-glas-bubbels-bij-teds-amsterdam-oost-of-kies-voor-de-overheerlijke-shared-brunch-of-een-heerlijk-ontbijt-met-met-koffie-of-thee-en-jus-dorange-sep-2026-amsterdam/',
];

test('le défaut est bien réel : l’ancienne méthode COLLISIONNAIT ces liens', () => {
  const ids = new Set(TEMOIN.map((l) => ancienIdentifiant('s', l)));
  assert.equal(ids.size, 1,
    `l’ancienne méthode doit rendre UN seul identifiant pour ${TEMOIN.length} offres différentes — `
    + 'sinon ce témoin ne démontre plus rien et il faut le vérifier avant de s’y fier');
  assert.ok(ids.has('sL21hZHJldHNtYS'),
    'l’identifiant fautif observé était « sL21hZHJldHNtYS »');
});

test('la méthode corrigée DISTINGUE ces mêmes liens', () => {
  const ids = new Set(TEMOIN.map((l) => identifiant('s', l)));
  assert.equal(ids.size, TEMOIN.length,
    `${TEMOIN.length} offres différentes doivent porter ${TEMOIN.length} identifiants différents`);
});

test('l’identifiant ne dépend que du lien : stable, déterministe', () => {
  const a = identifiant('d', 'https://exemple.test/produit-42');
  const b = identifiant('d', 'https://exemple.test/produit-42');
  assert.equal(a, b, 'deux appels sur le même lien doivent rendre le même identifiant : sinon un favori ne se retrouve plus');
  assert.notEqual(a, identifiant('d', 'https://exemple.test/produit-43'), 'un autre lien doit donner un autre identifiant');
});

test('le repli sur le titre fonctionne quand le lien manque', () => {
  assert.match(identifiant('p', '', 'Un titre sans lien'), /^p[0-9a-f]{20}$/,
    'sans lien, l’identifiant doit se rabattre sur le titre — jamais sur du vide');
});

test('la forme de l’identifiant est stable : 1 lettre de source + 20 caractères', () => {
  assert.match(identifiant('e', 'https://exemple.test/x'), /^e[0-9a-f]{20}$/);
});

test('AUCUN identifiant du catalogue entier n’est partagé par deux liens différents', () => {
  // Même démarche que les autres épreuves du projet : data/ n'est pas versionné,
  // docs/ l'est — une épreuve qui ne lit que data/ échoue sur GitHub en silence.
  const fichier = [path.join(RACINE, 'data', 'offres.json'), path.join(RACINE, 'docs', 'offres.json')]
    .find((f) => fs.existsSync(f));
  assert.ok(fichier, 'ni data/offres.json (local) ni docs/offres.json (dépôt)');
  const offres = JSON.parse(fs.readFileSync(fichier, 'utf8')).offres;
  assert.ok(Array.isArray(offres) && offres.length > 100,
    `le catalogue doit être lisible (${offres && offres.length} offres lues)`);

  // L'entrée d'origine n'est pas conservée dans le fichier publié : on la
  // reconstruit avec le MÊME repli que le collecteur (lien, sinon titre). On
  // juge donc la propriété qui compte — deux liens DIFFÉRENTS ne partagent
  // jamais un identifiant — sans dépendre d'un champ exact.
  const entree = (o) => o.lienMarchand || o.lienPage || o.titre || '';

  const parId = new Map();
  for (const o of offres) {
    const id = identifiant(String(o.id)[0], entree(o));
    if (!parId.has(id)) parId.set(id, new Set());
    parId.get(id).add(entree(o));
  }
  const partages = [...parId.entries()].filter(([, liens]) => liens.size > 1);

  assert.deepEqual(partages.map(([id, liens]) => `${id} → ${liens.size} liens`), [],
    `${partages.length} identifiant(s) encore partagé(s) par des offres différentes`);

  // Contrôle-témoin : la MÊME mesure avec l'ancien calcul doit, elle, trouver
  // des collisions. Si elle n'en trouve plus, l'épreuve ne prouve rien.
  const parAncien = new Map();
  for (const o of offres) {
    const id = ancienIdentifiant(String(o.id)[0], entree(o));
    if (!parAncien.has(id)) parAncien.set(id, new Set());
    parAncien.get(id).add(entree(o));
  }
  const anciensPartages = [...parAncien.values()].filter((liens) => liens.size > 1);
  assert.ok(anciensPartages.length > 0,
    'contrôle-témoin : l’ancien calcul doit encore collisionner le catalogue, sinon cette épreuve ne mesure rien');
});

test('aucune source ne fabrique plus son identifiant à la main', () => {
  const source = fs.readFileSync(path.join(RACINE, 'collecteur.mjs'), 'utf8');
  // Les commentaires d'abord : ils CITENT « base64url » pour expliquer le défaut
  // corrigé, et une épreuve qui lit le fichier brut les prendrait pour du code —
  // elle échouerait sur la documentation de ce qu'elle vérifie.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  assert.ok(!/base64url/.test(code),
    'la fabrication par base64url doit avoir disparu : elle perdait le début du lien');
  const appels = [...code.matchAll(/id: identifiant\('([dpegs])',\s*([^)]+)\)/g)];
  assert.equal(appels.length, 5,
    `les 5 sources (d, p, e, g, s) doivent passer par identifiant() — ${appels.length} trouvée(s)`);
  assert.deepEqual(appels.map((m) => m[1]).sort(), ['d', 'e', 'g', 'p', 's']);
});

/* --------------------------------------------------------------------------
   LA MIGRATION DES OFFRES DÉJÀ EN STOCK.

   Corriger la fabrication ne suffit pas : la collecte REPREND du stock les
   offres qu'une source n'a pas re-servies, et celles-là gardaient l'ancien
   identifiant. Mesuré après la première collecte corrigée : 175 identifiants
   seulement avaient changé, et 74 restaient partagés par 287 offres.
   -------------------------------------------------------------------------- */

test('la migration corrige les identifiants ANCIENS sans toucher aux autres', () => {
  const neufConnu = identifiant('d', 'https://exemple.test/a');
  const offres = [
    { id: 'sL21hZHJldHNtYS', lienMarchand: TEMOIN[0], titre: 'ancien → à migrer' },
    { id: 'aB0C3528VHM', lienMarchand: 'https://www.amazon.de/dp/B0C3528VHM', titre: 'Amazon (ASIN)' },
    { id: 'flSEB0FLQDCR7X', lienMarchand: 'https://www.amazon.fr/dp/B0FLQDCR7X', titre: 'Amazon (ASIN, fl…)' },
    { id: neufConnu, lienMarchand: 'https://exemple.test/a', titre: 'déjà migré' },
  ];
  const intacts = [offres[1].id, offres[2].id, offres[3].id];

  assert.equal(migrerIdentifiants(offres), 1, 'une seule offre doit être migrée');
  assert.equal(offres[0].id, identifiant('s', TEMOIN[0]),
    'l’ancien identifiant doit devenir l’empreinte de son lien');
  assert.deepEqual([offres[1].id, offres[2].id, offres[3].id], intacts,
    'les identifiants Amazon (ASIN) et les identifiants déjà migrés ne doivent PAS être touchés');
});

test('la migration est idempotente : une seconde passe ne change plus rien', () => {
  const offres = [{ id: 'sL21hZHJldHNtYS', lienMarchand: TEMOIN[0], titre: 'x' }];
  assert.equal(migrerIdentifiants(offres), 1, 'la première passe migre');
  assert.equal(migrerIdentifiants(offres), 0, 'la seconde passe ne doit rien changer : sinon l’identifiant d’un favori bougerait encore');
});

test('APRÈS migration, le catalogue entier n’a plus un seul identifiant partagé', () => {
  const fichier = [path.join(RACINE, 'data', 'offres.json'), path.join(RACINE, 'docs', 'offres.json')]
    .find((f) => fs.existsSync(f));
  assert.ok(fichier, 'ni data/offres.json (local) ni docs/offres.json (dépôt)');
  const catalogue = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  // Copie : l'épreuve ne doit jamais réécrire le catalogue de travail.
  const offres = catalogue.offres.map((o) => ({ ...o }));
  const migrees = migrerIdentifiants(offres);

  const entree = (o) => o.lienMarchand || o.lienPage || o.titre || '';
  const parId = new Map();
  for (const o of offres) {
    if (!parId.has(o.id)) parId.set(o.id, new Set());
    parId.get(o.id).add(entree(o));
  }
  const partages = [...parId.entries()].filter(([, liens]) => liens.size > 1);
  assert.deepEqual(partages.map(([id, liens]) => `${id} → ${liens.size} liens`), [],
    `${partages.length} identifiant(s) encore partagé(s) après migration (${migrees} migrées) : `
    + 'la migration doit suffire à tout corriger, sans attendre que les sources re-servent les offres');
});
