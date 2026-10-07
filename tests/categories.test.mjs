/**
 * Contrôles du CLASSEMENT PAR CATÉGORIE — application n°2 « Promos ».
 *
 * Pourquoi ces tests existent, et pourquoi ils sont écrits comme ça.
 *
 * Le défaut d'origine était invisible : les listes de mots-clés qui rangent les
 * offres étaient en FRANÇAIS SEUL, alors qu'elles s'appliquent aux douze pays.
 * Résultat mesuré sur les données publiées : 72 % des offres tombaient dans
 * « Autres », et certaines dans une rubrique sans rapport.
 *
 * Un test qui se contenterait de rejouer deux ou trois titres français
 * n'attraperait rien : le défaut n'était pas français. Chaque table ci-dessous
 * contient donc UNE LIGNE PAR LANGUE. Si une langue reperd son vocabulaire —
 * un mot effacé par mégarde en ajoutant une famille —, la ligne correspondante
 * échoue, et l'échec nomme le pays.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { famille, categorieDeSource, FAMILLES, MARQUES } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const LANGUES = ['fr', 'en', 'de', 'nl', 'es', 'it', 'pt', 'pl', 'sv'];

/* Un titre par langue, sans aucune marque : c'est le VOCABULAIRE de la langue
   qu'on éprouve, pas une liste de marques célèbres. */
const TITRES_PAR_LANGUE = [
  ['fr', 'Perceuse visseuse sans fil 18V', 'bricolage'],
  ['en', 'Cordless drill with screwdriver bits', 'bricolage'],
  ['de', 'Akku-Bohrmaschine mit Werkzeug', 'bricolage'],
  ['nl', 'Accuboormachine met gereedschap', 'bricolage'],
  ['es', 'Taladro inalámbrico con destornillador', 'bricolage'],
  ['it', 'Trapano avvitatore con utensili', 'bricolage'],
  ['pt', 'Berbequim sem fio com ferramentas', 'bricolage'],
  ['pl', 'Wiertarka akumulatorowa z narzędziami', 'bricolage'],
  ['sv', 'Borrmaskin med verktyg', 'bricolage'],

  ['de', 'Kopfhörer Bluetooth mit Ladegerät', 'tech'],
  ['pl', 'Słuchawki bezprzewodowe z etui', 'tech'],
  ['sv', 'Hörlurar trådlösa med laddare', 'tech'],
  ['pt', 'Aspirador vertical sem fio', 'electromenager'],
  ['es', 'Freidora de aire sin aceite', 'electromenager'],
  ['nl', 'Stofzuiger zonder zak', 'electromenager'],
  ['it', 'Profumo e crema idratante', 'beaute'],
  ['pl', 'Perfumy i krem nawilżający', 'beaute'],
  ['sv', 'Leksaker för barn', 'jouets'],
  ['es', 'Juguete de construcción', 'jouets'],
  ['pt', 'Pneus para carro', 'auto'],
  ['it', 'Bicicletta da corsa', 'sport'],
  ['nl', 'Sneakers voor dames', 'mode'],
];

test('chaque langue classe un titre écrit dans SA langue', () => {
  const rates = [];
  for (const [langue, titre, attendu] of TITRES_PAR_LANGUE) {
    const obtenu = famille(titre, '');
    if (obtenu !== attendu) rates.push(`[${langue}] « ${titre} » → ${obtenu} (attendu ${attendu})`);
  }
  assert.deepEqual(rates, [], `titres mal classés :\n  ${rates.join('\n  ')}`);
});

test('les 9 langues sont représentées dans chaque famille', () => {
  const creux = [];
  for (const [fam, mots] of Object.entries(FAMILLES)) {
    const total = mots.length;
    if (total < 40) creux.push(`${fam} : ${total} mots`);
  }
  assert.deepEqual(creux, [], `familles trop pauvres pour couvrir 9 langues : ${creux.join(', ')}`);
});

test('chaque famille porte des mots dans les 9 langues', () => {
  // On lit le FICHIER (et non la valeur importée) : les commentaires de langue
  // sont la seule trace de quel mot sert quelle langue, et l'import ne les
  // conserve pas. Sans cette lecture, une langue oubliée dans une famille
  // resterait invisible — c'est exactement l'histoire de ce défaut.
  const source = fs.readFileSync(path.join(RACINE, 'collecteur.mjs'), 'utf8');
  const debut = source.indexOf('const FAMILLES = {');
  const bloc = source.slice(debut, source.indexOf('\n};', debut));
  const familles = [...bloc.matchAll(/\n  ([a-z]+): \[([\s\S]*?)\n  \],/g)];
  assert.ok(familles.length >= 8, `familles lues dans le fichier : ${familles.length}`);
  const trous = [];
  for (const [, nom, corps] of familles) {
    const parts = corps.split(/\n\s*\/\/ ([a-z]{2})\n/);
    const vues = new Set();
    for (let i = 1; i < parts.length; i += 2) vues.add(parts[i]);
    for (const l of LANGUES) if (!vues.has(l)) trous.push(`${nom}/${l}`);
  }
  assert.deepEqual(trous, [], `familles sans bloc de mots pour une langue : ${trous.join(', ')}`);
});

test('les catégories publiées par les marchands sont traduites, en toutes langues', () => {
  const attendus = {
    // Étiquettes réellement rencontrées dans les données publiées.
    Gaming: 'tech',
    'High-Tech': 'tech',
    Elektronika: 'tech',
    Elektronica: 'tech',
    Electrónica: 'tech',
    Electronics: 'tech',
    'Broadband & Phone Contracts': 'tech',
    'Telecom & Internet': 'tech',
    'Home & Living': 'maison',
    'Hogar, vivienda y oficina': 'maison',
    'Dom i mieszkanie': 'maison',
    'Haus & Garten': 'maison',
    'Maison & Habitat': 'maison',
    'Garten & Baumarkt': 'bricolage',
    'Jardin & Bricolage': 'bricolage',
    'Jardín y bricolaje': 'bricolage',
    'Ogród i majsterkowanie': 'bricolage',
    'Tuin & Doe-het-zelf': 'bricolage',
    'Mode & Accessoires': 'mode',
    'Moda y accesorios': 'mode',
    Fashion: 'mode',
    'Sport & Outdoor': 'sport',
    'Sport i turystyka': 'sport',
    'Family & Kids': 'jouets',
    'Rodzina i dzieci': 'jouets',
    'Familie & Kinderen': 'jouets',
    'Auto & Motorrad': 'auto',
    'Coches y motos': 'auto',
    'Auto & Moto': 'auto',
    'Beauty & Gesundheit': 'beaute',
    'Salud y belleza': 'beaute',
    'Zdrowie i uroda': 'beaute',
    'Health & Beauty': 'beaute',
    // ÉPICERIE (unité E6) : ces libellés désignaient « ce n'est pas une de mes
    // rubriques » tant que l'onglet Nourriture n'existait pas. Dès lors qu'il
    // existe, ils le DÉSIGNENT — c'est bien du cabas de supermarché (demande de
    // B, point 22). Avant E6 ils étaient testés « autre » ; c'est le seul
    // attendu qui change.
    'Supermercado y alimentación': 'nourriture',
    Boodschappen: 'nourriture',
    Groceries: 'nourriture',
    // Assumé « autre » : ces rubriques n'ont pas de famille chez nous, c'est un
    // choix — l'important est qu'elles soient RECONNUES comme telles, sinon
    // leurs offres partent en « Autres » par échec au lieu de par décision.
    Reizen: 'autre',
    'Finanse i ubezpieczenia': 'autre',
    'Kultura i rozrywka': 'autre',
  };
  const rates = [];
  for (const [brut, attendu] of Object.entries(attendus)) {
    const obtenu = categorieDeSource(brut);
    if (obtenu !== attendu) rates.push(`« ${brut} » → ${obtenu} (attendu ${attendu})`);
  }
  assert.deepEqual(rates, [], `catégories de source mal traduites :\n  ${rates.join('\n  ')}`);
});

test('le nom d’une de nos familles ne sert JAMAIS de preuve de catégorie', () => {
  // Une étiquette « tech » ne vient pas d'un marchand : elle vient de NOS
  // requêtes, ou d'une catégorie collée à tort sur une source. La version
  // d'avant lui faisait confiance et rangeait 37 offres Coolblue en high-tech —
  // des robots de cuisine De'Longhi, des épilateurs Braun. Sans mot du titre ni
  // rubrique de source, la seule réponse honnête est « Autres ».
  assert.equal(categorieDeSource('tech'), null);
  assert.equal(categorieDeSource('mode'), null);
  assert.equal(categorieDeSource('presse'), null);
  assert.equal(famille('Bosch MSM4B610', 'tech'), 'autre');
  assert.equal(famille('Braun Smart IPL Skin i-expert Pro 7 PL7431', 'tech'), 'autre');
});

test('les marques rangent dans leur famille, apostrophes comprises', () => {
  // « De'Longhi » avec une apostrophe typographique n'était pas reconnu comme
  // « delonghi » : la marque était bien dans la liste, et l'offre tombait
  // quand même en « Autres ».
  //  Depuis l'onglet Électroménager, les marques d'APPAREILS ménagers
  //  (De'Longhi, Dyson, Miele…) rangent dans « electromenager », pas « maison ».
  assert.equal(famille('De’Longhi Magnifica Plus ECAM320.61.G', ''), 'electromenager');
  assert.equal(famille("De'Longhi Magnifica Plus", ''), 'electromenager');
  assert.equal(famille('Apple AirPods Pro 3', ''), 'tech');
  assert.equal(famille('Samsung Galaxy S26 Ultra', ''), 'tech');
  assert.equal(famille('LEGO Editions McLaren F1', ''), 'jouets');
  assert.equal(famille('Dyson V15s Detect Submarine', ''), 'electromenager');
  assert.ok(MARQUES.tech.length > 20, 'la table des marques tech est suspicieusement courte');
});

test('aucune marque ambiguë n’est rangée dans une seule famille', () => {
  // « Philips » fait des rasoirs, des téléviseurs et des friteuses ; « Bosch »
  // des perceuses et des lave-linge. Les inscrire quelque part ferait entrer un
  // défaut pour en corriger un autre.
  //
  // « Samsung » n'est PAS dans cette liste, et c'est un choix : la marque
  // désigne d'abord des téléphones et des écrans, et sans elle des centaines
  // d'offres tombaient en « Autres ». Un réfrigérateur Samsung rangé en
  // high-tech est assumé.
  const toutes = Object.values(MARQUES).flat();
  for (const ambigue of ['philips', 'bosch', 'siemens']) {
    assert.ok(!toutes.includes(ambigue), `marque ambiguë rangée en dur : ${ambigue}`);
  }
  assert.ok(toutes.includes('samsung'), 'la marque « samsung » doit rester (décision assumée)');
});

test('E6 : MEUBLES sort de Maison, NOURRITURE = le cabas, les repas pris dehors restent en Activité', () => {
  // Demande de B — onglets MEUBLES et NOURRITURE (plan, points 16 et 22).
  //  Chaque attendu ci-dessous a été MESURÉ sur le classement réel avant d'être
  //  écrit ici : aucun n'est deviné. Deux pièges du point 22 sont couverts —
  //  un mot de CABAS (« vin rouge ») ne doit PAS voler un repas servi, et une
  //  vraie preuve d'épicerie (« lot », « bouteilles ») garde le cabas en
  //  Nourriture. La literie (couette, matelas, oreiller) RESTE en Maison : le
  //  matelas n'est pas un meuble (point 16).
  const cas = [
    // --- MEUBLES : le mobilier nommé quitte Maison ---
    ['Canapé d angle 3 places en tissu', 'meubles'],
    ['Etagere murale en bois 4 niveaux', 'meubles'],
    ['Sommier à lattes 140x200', 'meubles'],
    ['Fauteuil de bureau ergonomique', 'meubles'],
    ['Commode 6 tiroirs en chêne', 'meubles'],
    ['Table basse en verre trempé', 'meubles'],
    ['Chaise de salle à manger en bois massif', 'meubles'],
    // --- Maison GARDE la literie ---
    ['Couette pour lit 2 personnes', 'maison'],
    ['Matelas à ressorts 160x200', 'maison'],
    ['Oreiller mémoire de forme', 'maison'],
    // --- NOURRITURE : le cabas, et lui seul ---
    ['Chocolat noir 70% 200g', 'nourriture'],
    ['Pack de 24 bières blondes 33cl', 'nourriture'],
    ['Vin rouge Bordeaux 75cl', 'nourriture'],
    ['Lot de 6 bouteilles de vin rouge Bordeaux', 'nourriture'],
    // --- Les REPAS PRIS DEHORS restent en ACTIVITÉ, jamais en Nourriture ---
    ['Menu burger à emporter pour deux', 'activite'],
    ['Restaurant italien - menu 3 services', 'activite'],
    ['Dîner spectacle au restaurant pour deux', 'activite'],
    // Le mot de cabas (« vin rouge ») ne vole pas le repas servi : il n'y a
    // aucune preuve d'épicerie, donc c'est une sortie.
    ['Restaurant Le Gourmet - menu 3 services avec un verre de vin rouge', 'activite'],
  ];
  const rates = [];
  for (const [titre, attendu] of cas) {
    const obtenu = famille(titre, '');
    if (obtenu !== attendu) rates.push(`« ${titre} » → ${obtenu} (attendu ${attendu})`);
  }
  assert.deepEqual(rates, [], `classement E6 :\n  ${rates.join('\n  ')}`);
});

test('le vérificateur de catégories passe sur les données réellement collectées', () => {
  const data = path.join(RACINE, 'data/offres.json');
  if (!fs.existsSync(data)) return;                  // pas encore de collecte
  const offres = JSON.parse(fs.readFileSync(data, 'utf8')).offres || [];
  if (!offres.length) return;
  let sortie = '', code = 0;
  try {
    sortie = execFileSync(process.execPath, [path.join(RACINE, 'outils/verificateur-categories.mjs'), '--fichier', data],
      { encoding: 'utf8', timeout: 60000 });
  } catch (e) {
    code = e.status ?? 1;
    sortie = (e.stdout || '') + (e.stderr || '');
  }
  assert.equal(code, 0, `le vérificateur de catégories refuse les données publiées :\n${sortie}`);
});
