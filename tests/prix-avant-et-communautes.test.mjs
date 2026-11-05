/**
 * LE PRIX D'ORIGINE SUR LA CARTE, ET LE CONTRÔLE DE PRIX DES COMMUNAUTÉS.
 *
 * Deux demandes de B, le 13/10/2026, dans la même phrase :
 *   « Oui tu peux étendre le contrôle du prix aux offres venues de dealabs et des
 *     autres communautés. Je remarque aussi que souvent il y a un pourcentage de
 *     réduction avec le prix d'origine mais que cela n'est pas indiqué sur la
 *     carte. »
 *
 * ── 1. LE PRIX D'ORIGINE ────────────────────────────────────────────────────────
 * Mesuré dans le catalogue publié : 1 557 titres portent un pourcentage, 675 de
 * leurs cartes n'affichent aucune remise. Deux causes opposées :
 *   • « bis zu 70 % », « up to 50 % off » : une ACCROCHE — elle annonce un maximum
 *     et ne dit rien du produit. L'écrire serait fabriquer un chiffre : refusé.
 *   • « für 2,49 € statt 24,99 € » : le prix d'origine EST publié, et nous ne le
 *     lisions pas. La lecture ne connaissait que le français « au lieu de », et son
 *     motif `[^.,;]{0,20}` s'arrêtait à la virgule — donc à TOUT prix décimal. Même
 *     en français, « au lieu de 24,99 € » ne rendait rien.
 *
 * ── 2. LE CONTRÔLE DES COMMUNAUTÉS ──────────────────────────────────────────────
 * Il tourne, mais en MESURE : l'épreuve faite avant d'écrire le code (six offres
 * communautaires réelles, page du marchand lue) n'a rendu que DEUX prix lisibles,
 * dont un faux — 83,99 € là où la carte annonçait 63,99 €. Corriger sur cette base
 * remplacerait des prix justes par des prix faux. Un interrupteur, et un test qui
 * refuse qu'il s'allume discrètement.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prixAvantDans, paireDePrix, PRIX_COMMUNAUTE_ACTIF } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const COLLECTEUR = fs.readFileSync(path.join(ICI, '..', 'collecteur.mjs'), 'utf8');

/* ------------------------------------------------------------------ *
 *  1. Le prix d'origine est lu dans la langue de la source — cas réels
 *     tirés du catalogue, pas inventés.
 * ------------------------------------------------------------------ */
test('le prix d’origine est lu dans les langues des sources', () => {
  const cas = [
    ['fr', 'Casque Bluetooth à 79,99 € au lieu de 129,99 € (-38%)', 129.99],
    ['fr entier', 'Aspirateur 49 € au lieu de 99 €', 99],
    ['de', '[eShop / Switch] Breathedge für 2,49 € statt 24,99 € (-90%)', 24.99],
    ['de long', 'Yamaha R-N600A Receiver für 481,61 € statt 599,00 €', 599],
    ['es', 'Auriculares Bluetooth 29,99 € en vez de 59,99 €', 59.99],
    ['nl', 'Koptelefoon 39,95 € in plaats van 79,95 €', 79.95],
    ['it', 'Cuffie 19,90 € invece di 49,90 €', 49.9],
    ['pt', 'Auscultadores 24,99 € em vez de 49,99 €', 49.99],
  ];
  for (const [langue, titre, attendu] of cas) {
    assert.equal(prixAvantDans(titre), attendu, `« ${langue} » : le prix d’origine de « ${titre} » doit être lu`);
  }
});

/* ------------------------------------------------------------------ *
 *  2. Ce qui n'est PAS un prix d'origine ne devient pas un prix.
 * ------------------------------------------------------------------ */
test('une accroche et une phrase sans prix ne fabriquent aucun prix d’origine', () => {
  for (const texte of [
    'bis zu 30 % Rabatt auf Acer Notebooks',
    'Up to 70% off Coats Jackets',
    'Promo au lieu de rien du tout',
    'Le casque à 49,99 € est arrivé avant la fin du mois',
  ]) {
    assert.equal(prixAvantDans(texte), null, `« ${texte} » ne publie aucun prix d’origine`);
  }
  // La devise est exigée : un prix en livres n'est pas lu (limite connue, écrite
  // dans le collecteur). Un chiffre nu ne doit jamais passer pour un prix.
  assert.equal(prixAvantDans('Item £30 instead of £80'), null,
    'versPrix ne lit que l’euro — un prix en livres ne doit pas ressortir comme un euro');
});

/* ------------------------------------------------------------------ *
 *  3. Le motif cassé ne revient pas.
 * ------------------------------------------------------------------ */
test('la lecture ne connaît plus le motif qui s’arrêtait à la virgule', () => {
  // On ne regarde QUE le code : le motif est cité dans un commentaire qui raconte
  // le défaut, et c'est très bien ainsi.
  const code = COLLECTEUR.split('\n')
    .filter((l) => { const t = l.trim(); return t && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*'); })
    .join('\n');
  assert.ok(!code.includes('[^.,;]{0,20}'),
    'l’ancien motif « [^.,;]{0,20} » ne capturait que « 24 » dans « 24,99 € » : tout prix décimal était perdu');
  const appels = COLLECTEUR.match(/prixAvantDans\(/g) || [];
  assert.ok(appels.length >= 3,
    `les deux lecteurs (communautés et presse) ET la relecture rétroactive doivent employer la même lecture (${appels.length} appel(s) trouvé(s))`);
});

/* ------------------------------------------------------------------ *
 *  4. La relecture rétroactive existe : une offre engrangée avant la
 *     correction garde sinon son prix barré manquant pour toujours — sa
 *     source ne la réémettra pas forcément.
 * ------------------------------------------------------------------ */
test('le prix d’origine manquant est relu rétroactivement, et garde sa borne', () => {
  const bloc = COLLECTEUR.split("LE PRIX D'ORIGINE, RELU DANS LE TITRE")[1].split("LA DATE DE RELEVÉ")[0];
  assert.ok(bloc.length > 400, `le bloc de relecture doit être identifiable (${bloc.length} caractères)`);
  assert.match(bloc, /prixAvantDans\(c\.titre\)/, 'la relecture doit viser le TITRE — seule source conservée dans l’offre');
  assert.match(bloc, /paireDePrix\(c\.prix, prixAvantDans\(c\.titre\)\)/,
    'le couple relu doit passer par la même porte que les lecteurs : c’est elle qui refuse un prix d’origine inférieur, égal, ou décrivant autre chose');
  // La borne des cinq fois NE DOIT PAS être ici : mesuré le 13/10/2026, elle
  // écartait un vrai « 2,49 € statt 24,99 € » — un jeu à -90 %, dix fois moins cher,
  // ce qui est banal. Elle protège les prix barrés des DONNÉES structurées, pas une
  // phrase où la source écrit elle-même le rapport.
  assert.ok(!/avantLu < c\.prix \* 5/.test(bloc), 'la borne des cinq fois écarte de vraies remises de 90 %');
  const journal = COLLECTEUR.split("source: 'prix-avant-relu'")[1] || '';
  assert.ok(journal.length > 80, 'la relecture doit être annoncée dans le journal du passage');
});

test('un prix d’origine ÉGAL au prix demandé ne barre rien', () => {
  // « BBFP App gratis (statt 2,59 €) » : le prix lu est le prix d'origine. Écrire
  // ce couple barrerait 2,59 € au-dessus de 2,59 € — un prix barré faux à l'écran.
  const lecteurs = COLLECTEUR.match(/paireDePrix\(prix, prixAvantDans\(texte\)\)/g) || [];
  assert.ok(lecteurs.length >= 2, `les DEUX lecteurs (communautés et presse) doivent refuser ce couple (${lecteurs.length} trouvé(s))`);
});

/* ------------------------------------------------------------------ *
 *  5 bis. UN COUPLE QUI DÉCRIT DEUX CHOSES DIFFÉRENTES NE SE MONTRE PAS.
 *  Trouvé en VÉRIFIANT LE SITE EN LIGNE — pas en relisant le code — le
 *  13/10/2026 : une carte annonçait « 0,88 € au lieu de 200,16 € », soit
 *  −100 %. La source disait « für jeweils 0,88 € (insgesamt 5,26 € statt
 *  200,16 €) » : le prix À L'UNITÉ contre le TOTAL. Les deux montants
 *  sont vrais, leur rapport ne veut rien dire.
 * ------------------------------------------------------------------ */
test('un couple de prix qui décrit deux choses différentes ne se montre pas', () => {
  assert.equal(paireDePrix(0.88, 200.16), null,
    'un rapport de 1 à 227 (prix unitaire contre total) ne décrit pas le même produit');
  assert.deepEqual(paireDePrix(2.49, 24.99), { prix: 2.49, avant: 24.99, remise: 90 },
    'un vrai −90 % doit passer : c’est la borne de l’application, et ce jeu est à 90 % exactement');
  assert.equal(paireDePrix(49.99, 49.99), null, 'deux fois le même prix ne barre rien');
  assert.equal(paireDePrix(80, 50), null, 'un prix d’origine plus BAS n’est pas un prix d’origine');
  assert.equal(paireDePrix(null, 50), null, 'sans prix demandé, il n’y a pas de remise à montrer');
});

/* ------------------------------------------------------------------ *
 *  5. LE CONTRÔLE DES COMMUNAUTÉS : présent, et en mesure.
 * ------------------------------------------------------------------ */
test('le contrôle de prix lit la page du MARCHAND pour une offre communautaire', () => {
  assert.match(COLLECTEUR, /const communaute = typeDeSource\(o\.sourceId\) === 'dealabs'/,
    'les sources communautaires se reconnaissent à leur type');
  // Deux pages, chacune pour ce qu'elle sait dire : le verdict d'expiration reste
  // celui de la page du bon plan (règle d'avant), le PRIX vient du marchand.
  assert.match(COLLECTEUR, /const v = await lireVerdictSource\(o\.lienPage\)/,
    'le verdict d’expiration doit continuer de venir de la page du bon plan — c’est la source qui sait si son bon plan vit');
  assert.match(COLLECTEUR, /await lireVerdictSource\(o\.lienMarchand\)/,
    'le PRIX doit venir de la page du MARCHAND : c’est elle que le visiteur verra après le clic');
  assert.match(COLLECTEUR, /idsEnseigne\.has\(o\.sourceId\) \|\| communaute/,
    'la règle du prix doit couvrir les deux périmètres');
  // Et jamais l'inverse : le verdict qui SUPPRIME ne doit pas être décidé sur la
  // page du marchand, qui ne publie aucune expiration de bon plan.
  assert.match(COLLECTEUR, /textePrix = vm\.texte \|\| null/,
    'une page de marchand muette ne doit rien affirmer : null, jamais une chaîne vide');
});

test('aucune offre communautaire n’est SUPPRIMÉE par le contrôle de prix', () => {
  // Un marchand qui ne publie pas de prix de référence ne prouve pas qu'un bon
  // plan communautaire est fini : la remise vient de la communauté. Statut
  // « prix-seul » — il n'est dans aucune branche de sortie.
  assert.match(COLLECTEUR, /statut: 'prix-seul'/, 'la page muette côté marchand doit rester sans conséquence');
  assert.match(COLLECTEUR, /statut: 'prix-ecarte'/, 'l’écart de prix se mesure avant de se corriger');
  const sorties = COLLECTEUR.split('LES SORTIES')[1].split('if (verdict.essais')[0];
  for (const statut of ['prix-seul', 'prix-ecarte']) {
    assert.ok(!sorties.includes(`'${statut}'`), `« ${statut} » ne doit apparaître dans AUCUNE branche de sortie`);
  }
});

test('la correction des prix communautaires est en MESURE, et le dit', () => {
  assert.equal(PRIX_COMMUNAUTE_ACTIF, false,
    'la mesure passe avant la correction : 2 prix lisibles sur 6 à l’épreuve, dont un faux');
  assert.match(COLLECTEUR, /modeCommunautes: PRIX_COMMUNAUTE_ACTIF \? 'actif' : 'mesure'/,
    'le journal doit dire dans quel mode le volet communautaire tourne');
  assert.match(COLLECTEUR, /communaute && !PRIX_COMMUNAUTE_ACTIF/, 'l’écart de prix doit être mesuré, pas appliqué');
});

/* ------------------------------------------------------------------ *
 *  7 bis. LA DÉCISION DE B EST ÉCRITE, ET LE TAUX EST MESURABLE.
 *  B, 13/10/2026 : « Attends que la mesure ait vu davantage avant de
 *  lancer la correction des prix communautaires. » Un interrupteur
 *  éteint sans taux mesuré laisserait « davantage » sans définition.
 * ------------------------------------------------------------------ */
test('la décision d’attendre est écrite, et le taux de lecture est mesuré', () => {
  assert.match(COLLECTEUR, /DÉCISION DE B, 13\/10\/2026/,
    'la décision doit être écrite là où l’interrupteur vit — pas seulement dans un plan');
  assert.match(COLLECTEUR, /Attends[\s\S]{0,40}davantage avant de lancer la correction des prix communautaires/,
    'la décision de B doit être citée mot pour mot, pas résumée');
  // Le compteur sépare « page lue sans prix » de « page muette » : sans lui, le
  // taux de lecture est incalculable, et « davantage » reste une impression.
  assert.match(COLLECTEUR, /if \(marchandLu && !promo\) verdict\.prixIllisibleMarchand\+\+/,
    'une page de marchand lue sans prix lisible doit être comptée à part');
  assert.match(COLLECTEUR, /lecturesMarchand: 0, prixIllisibleMarchand: 0/,
    'les deux compteurs doivent être déclarés');
  const ligne = COLLECTEUR.split('Verdict communautés (')[1] || '';
  assert.match(ligne, /au prix lisible/, 'le journal doit publier le taux de lecture, pas seulement les écarts');
});

/* ------------------------------------------------------------------ *
 *  6. GARDE-FOU SUR LES DONNÉES RÉELLEMENT PUBLIÉES.
 *     C'est celui qui aurait attrapé la remarque de B : partout où le
 *     TITRE publie un prix d'origine lisible, la carte doit le porter.
 * ------------------------------------------------------------------ */
test('sur les données publiées, un prix d’origine lisible dans le titre est sur la carte', () => {
  const fichier = path.join(ICI, '..', 'data', 'offres.json');
  if (!fs.existsSync(fichier)) return;          // pas encore de collecte
  const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const manquants = [];
  let lisibles = 0;
  for (const o of d.offres || []) {
    if (o.type === 'article' || o.prix == null) continue;
    // La même porte que les lecteurs : seul un couple MONTRABLE compte. Un prix
    // d'origine égal, inférieur, ou décrivant autre chose (un total contre un prix
    // unitaire) n'est pas un manque — c'est un refus, et il est voulu.
    const paire = paireDePrix(o.prix, prixAvantDans(o.titre));
    if (!paire) continue;
    lisibles++;
    if (o.prixAvant == null) {
      manquants.push(`${String(o.titre).slice(0, 50)} — ${o.prix} € au lieu de ${paire.avant} € (source ${o.sourceId || '?'})`);
    }
  }
  if (lisibles === 0) return;
  assert.deepEqual(manquants, [],
    `prix d’origine publié par la source mais absent de la carte :\n  ${manquants.slice(0, 8).join('\n  ')}`);
});
