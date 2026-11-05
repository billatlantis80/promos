/* =============================================================================
   LA VIE D'UNE CARTE — CINQ JOURS, PUIS LA QUESTION DU SERVICE.

   Mise en production le 14/10/2026 sur le mot de B : « Ok, tu peux réécrire et
   mettre en production. » C'est **la règle unique** du catalogue : elle remplace
   l'appareil de jugement entier (le plafond de sept jours, le masquage, la table
   des verdicts, le contrôle de page, le budget de politesse). Voir
   REGLES-DES-CARTES.md, R.1 à R.16.

   CE QUE CETTE ÉPREUVE DOIT REFUSER, ET C'EST SA RAISON D'ÊTRE (R.12). Une règle
   qui EFFACE, sans période d'observation, doit être tenue des deux côtés :

     1. les six cas de l'énoncé — dont quatre qui protègent la carte (cinq jours
        pile, quatre jours, un article de veille, l'historique des prix) et deux
        qui l'emportent ;
     2. les DEUX GARDES, qui sont la différence entre une règle et un massacre :
        on ne juge pas sur une date illisible, et **on ne condamne pas une carte
        sur une source qu'on n'a pas réussi à relire**. La seconde est celle qui
        compte : sans elle, un rendu tronqué par un mur anti-robot, une source au
        repos (`reposMin`), un flux vide un tour sur deux — et la règle efface des
        catalogues vivants, en silence.

   ET LA MESURE AVANT (R.13) : les dernières épreuves comptent, sur le catalogue
   RÉEL, ce que la règle effacerait au prochain passage. Un chiffre annoncé vaut
   mieux qu'un chiffre promis.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  VIE_AFFICHEE_JOURS, verdictDeCalendrier, ageJours,
  CONTROLES_COMMUNAUTE_PAR_PASSAGE, CONTROLES_ENSEIGNE_PAR_PASSAGE,
  OFFRES_SORTENT_SUR_VERDICT_ACTIF, PROMOTION_DECIDE_LA_CARTE_ACTIF,
} from '../collecteur.mjs';

const JOUR = 86400000;
const MAINTENANT = Date.parse('2026-10-14T22:00:00Z');
const ilYA = (jours) => new Date(MAINTENANT - jours * JOUR).toISOString();

const offre = (o = {}) => ({
  id: 'x', type: 'offre', pays: 'BE', sourceId: 'dealabs-tendance',
  // La source a servie cette offre au tour 10, et elle en est au tour 12 : elle a
  // donc REPARLÉ depuis, sans la resservir. C'est le cas « plus servie ».
  serviceAuTour: 10, premiereVue: ilYA(1), vuLe: ilYA(1),
  ...o,
});
/** La source a reparlé depuis le dernier service de l'offre. */
const RELUE = { 'dealabs-tendance': 12 };
/** La source n'a PAS reparlé : son compteur de tour est resté où il était. */
const MUETTE = { 'dealabs-tendance': 10 };
/** La source a reparlé, mais elle est un cran plus haut : elle a resservi l'offre. */
const RESSERVIE = { 'dealabs-tendance': 10 };

test('la règle est de cinq jours, et elle est écrite une seule fois', () => {
  assert.equal(VIE_AFFICHEE_JOURS, 5);
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.equal((src.match(/export const VIE_AFFICHEE_JOURS/g) || []).length, 1,
    'une seule définition : deux constantes finiraient par diverger');
  assert.equal((src.match(/export function verdictDeCalendrier/g) || []).length, 1,
    'une seule règle : le compte et l’effacement doivent passer par elle');
});

/* =============================================================================
   LES SIX CAS DE L'ÉPREUVE (R.12) — au mot près de ce qui a été annoncé à B.
   ============================================================================= */

test('CAS 1 — une carte de cinq jours PILE reste affichée', () => {
  // Cinq jours, plus une seconde, suffisent à franchir (R.1) : le bord exact est
  // donc encore DANS la garantie. C'est le test qui empêche un décalage d'une
  // seconde de retirer une carte un jour trop tôt.
  const pile = offre({ premiereVue: ilYA(5), vuLe: ilYA(5) });
  assert.equal(verdictDeCalendrier(pile, { maintenant: MAINTENANT, tours: RELUE }), 'intacte');
  assert.equal(verdictDeCalendrier(pile, { maintenant: MAINTENANT, tours: MUETTE }), 'intacte',
    'le bord exact reste affiché même si la source est muette');
});

test('CAS 2 — cinq jours et une seconde, plus servie, est EFFACÉE', () => {
  const depassee = offre({ premiereVue: ilYA(5 + 1e-5), vuLe: ilYA(5 + 1e-5) });
  assert.equal(verdictDeCalendrier(depassee, { maintenant: MAINTENANT, tours: RELUE }), 'effacee');
});

test('CAS 3 — reservie au-delà des cinq jours : elle CONTINUE, et le compteur repart', () => {
  // Le verdict : une carte servie à ce passage n'est jamais emportée, quel que
  // soit son âge. C'est la promotion d'un mois (les soldes) qui ne doit jamais
  // disparaître tant que sa source la publie.
  const longue = offre({ premiereVue: ilYA(30), vuLe: ilYA(0), serviceAuTour: 12 });
  assert.equal(verdictDeCalendrier(longue, { maintenant: MAINTENANT, tours: RELUE }), 'intacte',
    'une promotion servie depuis trente jours reste en ligne');
  // Le compteur : la remise à zéro vit dans la fusion du passage, là où l'on SAIT
  // que l'offre vient du flux. On l'exige sur le code, parce qu'un verdict pur ne
  // peut pas écrire — et une règle qui ne remet pas le compteur effacerait la
  // carte au passage suivant, ce qui serait le défaut le plus coûteux.
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /const reprise = ageJours\(avant\.premiereVue \|\| avant\.vuLe\) > VIE_AFFICHEE_JOURS/,
    'la reprise se décide sur le compteur d’affichage, jamais sur `date`');
  assert.match(src, /premiereVue: reprise \? horodatage : \(avant\.premiereVue \|\| avant\.vuLe\)/,
    'la reprise remet `premiereVue` à maintenant : cinq jours pleins devant elle');
});

test('CAS 4 — quatre jours, plus servie : elle RESTE (c’est la garantie)', () => {
  // Le cœur du scénario : cinq jours de vie garantis à TOUTE carte, servie ou
  // non. Sans ce cas, la règle redeviendrait « on n'affiche que ce qu'une source
  // sert à l'instant », et une offre publiée il y a deux heures sortirait.
  const jeune = offre({ premiereVue: ilYA(4), vuLe: ilYA(4) });
  assert.equal(verdictDeCalendrier(jeune, { maintenant: MAINTENANT, tours: RELUE }), 'intacte');
  assert.equal(verdictDeCalendrier(offre({ premiereVue: ilYA(0.1), vuLe: ilYA(0.1) }),
    { maintenant: MAINTENANT, tours: RELUE }), 'intacte');
});

test('CAS 5 — un article de veille n’est JAMAIS visé, quel que soit son âge', () => {
  // La veille a sa règle à elle (R.8) : sa date de PUBLICATION. Elle ne se juge
  // pas sur un service, donc elle ne peut pas être emportée par celle-ci.
  for (const age of [1, 5, 6, 30, 365]) {
    const article = offre({ type: 'article', premiereVue: ilYA(age), vuLe: ilYA(age) });
    assert.equal(verdictDeCalendrier(article, { maintenant: MAINTENANT, tours: RELUE }), 'intacte',
      `un article de ${age} jour(s) ne doit pas être visé`);
  }
});

test('CAS 6 — l’historique des prix survit : sa preuve de FORME, valable partout', () => {
  // R.6 : une carte effacée ne laisse AUCUNE trace — sauf l'historique des prix,
  // qui est la seule chose conservée. La preuve n'est pas une intention, c'est la
  // forme de la clé (l'identifiant de l'offre, dérivé de son ADRESSE — voir
  // `identifiant` — donc il survit à l'effacement de la fiche), et le fait que la
  // règle ne TOUCHE jamais à l'historique.
  //
  // ⚠ POURQUOI CETTE PARTIE EST SÉPARÉE DE LA SUIVANTE. Elle ne lit que des
  // fichiers VERSIONNÉS (le collecteur), donc elle vaut aussi dans le clone de
  // GitHub. La preuve sur les DONNÉES réelles, elle, a besoin de
  // `data/historique-prix.json` — un fichier que `.gitignore` exclut, et qui
  // n'existe donc que là où la collecte tourne (voir CAS 6-bis).
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  const bloc = src.slice(src.indexOf('LA RÈGLE DE LA VIE D\'UNE CARTE — CINQ JOURS, PUIS LA QUESTION DU SERVICE'),
    src.indexOf('LES ARTICLES DE PLUS DE SEPT JOURS'));
  assert.ok(bloc.length > 0, 'le bloc de la règle doit rester extractible');
  assert.doesNotMatch(bloc, /historique/i,
    'la règle n’a rien à faire dans l’historique des prix : elle efface la fiche, elle ne touche pas au souvenir');
});

test('CAS 6-bis — l’historique RÉEL retrouve une offre par son identifiant (relevé local)', (t) => {
  // ⚠ CE QUI A ÉTÉ PAYÉ ICI, ET QU'IL NE FAUT PAS REFAIRE. Cette vérification
  // lisait `data/historique-prix.json` EN DUR. Ce fichier n'est pas versionné
  // (`.gitignore`), donc absent de tout clone : dans le workflow horaire, le test
  // levait `ENOENT`, l'étape « Tests » passait au ROUGE **avant** la collecte, et
  // le secours GitHub n'a plus rien collecté ni publié pendant 38 heures — 38
  // passages perdus, sans un mot (constaté le 15/10/2026, dernier succès le
  // 13/10 à 17 h 10 UTC). Le cron du NAS tournait heureusement encore.
  //
  // Le fichier est le SEUL endroit qui porte cette preuve : le catalogue publié
  // ne conserve pas l'historique (aucun champ d'historique sur ses offres, et
  // aucun jumeau dans `docs/`). On ne peut donc pas la remplacer en ligne :
  // on la DÉCLARE absente, bruyamment, au lieu d'échouer — et la preuve de forme
  // du CAS 6, elle, continue de tourner partout.
  const chemin = new URL('../data/historique-prix.json', import.meta.url);
  if (!existsSync(chemin)) {
    t.skip('historique local absent (data/ n’est pas versionné) : rien à vérifier sur les données ici');
    return;
  }
  const hist = JSON.parse(readFileSync(chemin, 'utf8'));
  const catalogue = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
  const jours = Object.keys(hist.jours || {});
  assert.ok(jours.length > 0, 'l’historique doit porter au moins un jour');
  const dernier = hist.jours[jours.sort().pop()];
  // On cherche une offre du catalogue qui a un prix : c'est elle qui doit se
  // retrouver dans l'historique sous SON identifiant, pas sous un numéro d'ordre.
  const avecPrix = (catalogue.offres || []).filter((o) => o.id && Number.isFinite(Number(o.prix)) && Number(o.prix) > 0);
  assert.ok(avecPrix.length > 0, 'des offres avec prix sont attendues dans le catalogue');
  const trouvees = avecPrix.filter((o) => Array.isArray(dernier[o.id]));
  assert.ok(trouvees.length > 0,
    `l’historique doit retrouver une offre par son identifiant stable (clés essayées : ${Object.keys(dernier).length})`);
});

/* =============================================================================
   LES DEUX GARDES — sans elles, la règle efface ce qu'elle ne comprend pas.
   ============================================================================= */

test('GARDE 1 — une date illisible n’autorise AUCUN verdict', () => {
  assert.equal(verdictDeCalendrier(offre({ premiereVue: '', vuLe: '' }), { maintenant: MAINTENANT, tours: RELUE }), 'intacte');
  assert.equal(verdictDeCalendrier(offre({ premiereVue: 'pas une date', vuLe: 'pas une date' }), { maintenant: MAINTENANT, tours: RELUE }), 'intacte');
  assert.equal(verdictDeCalendrier(null, { maintenant: MAINTENANT, tours: RELUE }), 'intacte');
});

test('GARDE 2 — une source qui n’a PAS reparlé ne condamne rien', () => {
  // C'est LA garde qui protège. Sans elle, la règle lirait « l'offre n'est pas
  // dans le flux » là où il faut lire « la source n'a rien pu dire » — et un mur
  // anti-robot, une source au repos ou un flux tronqué effaceraient des
  // catalogues vivants, sans le moindre message d'erreur.
  const vieille = offre({ premiereVue: ilYA(9), vuLe: ilYA(9), serviceAuTour: 10 });
  assert.equal(verdictDeCalendrier(vieille, { maintenant: MAINTENANT, tours: MUETTE }), 'intacte',
    'tour inchangé (10 = 10) : la source n’a pas reparlé, on ne conclut rien');
  // Et sans numéro de tour : même prudence. Une offre d'avant, jamais estampillée,
  // garde sa grâce tant que sa source n'a pas parlé.
  assert.equal(verdictDeCalendrier(offre({ premiereVue: ilYA(9), vuLe: ilYA(9), serviceAuTour: undefined }),
    { maintenant: MAINTENANT, tours: RELUE }), 'intacte',
    'pas de numéro de service : on ne condamne pas sur une source qu’on n’a pas réussi à lire');
  assert.equal(verdictDeCalendrier(offre({ premiereVue: ilYA(9), vuLe: ilYA(9) }),
    { maintenant: MAINTENANT, tours: {} }), 'intacte',
    'source jamais comptée : aucun verdict');
});

test('LE VERDICT EST PUR — aucun état caché, et deux appels rendent le même', () => {
  // C'est ce qui rend le retour possible et gratuit : une règle qui garderait une
  // trace des cartes condamnées pourrait les condamner pour toujours ; celle-ci
  // ne se souvient de rien, donc une offre reservie plus tard rentre comme une
  // carte neuve, sans « dé-condamnation ».
  const o = offre({ premiereVue: ilYA(9), vuLe: ilYA(9) });
  const un = verdictDeCalendrier(o, { maintenant: MAINTENANT, tours: RELUE });
  const deux = verdictDeCalendrier(o, { maintenant: MAINTENANT, tours: RELUE });
  assert.equal(un, deux);
  assert.deepEqual(o, offre({ premiereVue: ilYA(9), vuLe: ilYA(9) }), 'la règle ne doit RIEN écrire dans l’offre');
});

/* =============================================================================
   LE BRANCHEMENT RÉEL — une règle juste que personne n'appelle ne vaut rien.
   ============================================================================= */

test('l’effacement passe par la règle, et par rien d’autre', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  // ⚠ LE MOTIF EXIGE L'INSTANT DE LA PASSE, et ce n'est pas du zèle : sans lui,
  // l'effacement jugeait à `Date.now()` pendant que le fichier était estampillé
  // plus tard — 20 à 28 cartes par passe étaient publiées DÉJÀ CONDAMNÉES (toutes
  // à 5,00 j). Le motif suit donc le code au plus près, pour qu'un retour en
  // arrière rougisse ici.
  assert.match(src, /if \(verdictDeCalendrier\(o, \{ maintenant: INSTANT_DU_PASSAGE, tours: toursParSource \}\) !== 'effacee'\) continue;/,
    'le retrait doit passer par la règle, avec les tours du passage ET l’instant de la passe');
  assert.match(src, /regleParPays\[p\]/, 'et il doit compter ce qu’il emporte, par pays');
  assert.match(src, /connues\.delete\(cle\)/, 'effacer, c’est retirer du stock');
  // L'ancien interrupteur du plafond ne doit pas revenir : la règle n'a plus
  // d'interrupteur, elle a une échéance. On le vérifie sur les LIGNES DE CODE, et
  // non sur le texte entier : la constante est encore NOMMÉE dans un commentaire
  // d'histoire, et c'est très bien ainsi — un simple compte d'occurrences serait
  // faux, exactement comme le note l'épreuve de la veille.
  const lignesDeCode = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.ok(!lignesDeCode.some((l) => l.includes('PLAFOND_OFFRES_ACTIF')),
    'l’interrupteur du plafond ne doit plus exister dans le code');
});

test('les compteurs du passage ne sont plus recalculés : le publié EST ce qui s’affiche', () => {
  // Le masquage obligeait à recaler `total`, `totalOffres` et `parPays` sur ce que
  // l'écran montrait — sinon deux chiffres pour la même grandeur, le défaut que B
  // avait signalé le 08/10/2026. Ces recalculs n'ont plus d'objet : une carte
  // effacée est sortie du stock AVANT que les compteurs ne soient calculés.
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /nonConfirmees/, 'le compteur des fiches masquées ne doit plus exister');
  assert.doesNotMatch(src, /o\.perimee = true/, 'et le drapeau ne doit plus être posé nulle part');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /!o\.perimee/, 'l’application n’a plus de fiche masquée à écarter');
  assert.doesNotMatch(app, /cache: 'no-store', signal/, 'et le catalogue se garde chez le visiteur (ETag)');
});

test('la lecture de page est ÉTEINTE : budget nul, aucune sortie, aucune correction', () => {
  // R.10 : le budget de pages, ses conditions de politesse, la table des verdicts
  // et la correction des prix par page n'ont plus d'objet — le retrait ne se
  // décide plus sur une preuve. Réduire le budget à zéro est ce qui rend la règle
  // PLUS polie que celle d'avant : on retire des requêtes aux sources.
  assert.equal(CONTROLES_COMMUNAUTE_PAR_PASSAGE, 0);
  assert.equal(CONTROLES_ENSEIGNE_PAR_PASSAGE, 0);
  assert.equal(OFFRES_SORTENT_SUR_VERDICT_ACTIF, false, 'une page ne décide plus d’une sortie');
  assert.equal(PROMOTION_DECIDE_LA_CARTE_ACTIF, false, 'ni d’une correction de prix');
});

/* =============================================================================
   LA MESURE AVANT (R.13) — sur le catalogue RÉEL, pas sur des cas fabriqués.
   ============================================================================= */

test('sur le catalogue réel : ce que la règle emporterait, et ce qu’elle ne touche pas', () => {
  const d = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
  // LA TABLE DES TOURS EST À LA RACINE DE L'ÉTAT PUBLIÉ (`toursParSource`), pas
  // dans `donnees` qui ne porte que le bilan d'exploitation. C'est elle qui dit,
  // source par source, combien de fois elle a PARLÉ — et c'est tout ce dont la
  // règle a besoin pour distinguer « elle ne la sert plus » de « on n'a pas
  // regardé ». Lue ailleurs, elle vaudrait `{}` et la règle ne mordrait sur RIEN,
  // en silence : le genre de défaut qui rend une épreuve verte pour de mauvaises
  // raisons.
  const tours = d.toursParSource || {};
  assert.ok(Object.keys(tours).length > 0,
    'la table des tours doit être dans l’état publié, sinon la règle ne peut rien conclure');
  const offres = (d.offres || []);
  // ⚠ L'HORLOGE EST CELLE DU CATALOGUE, PAS LA NÔTRE — et c'est une leçon, pas un
  // détail. Le premier jet mesurait ce fichier avec `Date.now()`. Or le catalogue a
  // été écrit à 22:00:45 et l'épreuve tournait à 22:10 : dix minutes de dérive
  // suffisent à faire franchir le bord des cinq jours à une poignée de cartes, et
  // l'épreuve annonçait « 6 cartes condamnées encore publiées » — un défaut
  // parfaitement imaginaire, fabriqué par l'instrument. Un fichier daté se mesure
  // à SA date : c'est la seule façon de comparer deux états du même instant.
  const maintenant = new Date(d.genereLe).getTime();
  assert.ok(Number.isFinite(maintenant), `le catalogue doit porter sa date de génération : ${d.genereLe}`);
  const verdicts = offres.map((o) => verdictDeCalendrier(o, { maintenant, tours }));
  const condamnees = offres.filter((_, i) => verdicts[i] === 'effacee');
  const articles = condamnees.filter((o) => o.type === 'article');
  assert.equal(articles.length, 0, 'aucun article de veille ne part par cette règle');
  // LA COHÉRENCE : ce que la règle condamne ne doit PAS être dans le fichier
  // publié. C'est la seule vérification qui relie le catalogue servi à la règle qui
  // l'a produit — si elle casse, c'est que la publication n’est plus celle que la
  // règle a calculée, et personne ne le verrait autrement.
  //
  // ⚠ LE TRANSIT D'UN PASSAGE, ET POURQUOI IL FAUT LE TOLÉRER SANS LE CACHER.
  // Mesuré le 15/10/2026 : l'effacement décide en DÉBUT de passe
  // (`verdictDeCalendrier(o, { tours })`, `maintenant` par défaut = l'instant du
  // verdict) et le fichier est ESTAMPILLÉ EN FIN de passe (`genereLe`). Une carte
  // qui franchit la ligne des cinq jours entre ces deux instants est donc publiée
  // déjà condamnée — 20 à 28 cartes par passage, toutes mesurées à **5,00 j**, le
  // dernier contact à 4,9 j. Le passage suivant les efface (mesuré : 22 puis 28).
  // On ne peut donc pas exiger « zéro » sur un instantané dont la règle juge à un
  // autre instant : cela ferait rouge toutes les heures et arrêterait la
  // sauvegarde (déjà vécu). Ce qu'on exige, c'est qu'aucune carte ne survive
  // AU-DELÀ du transit — là, l'effacement a vraiment échoué.
  // ⚠ LE TRANSIT D'UN PASSAGE N'EXISTE PLUS — supprimé le 15/10/2026 par
  // `INSTANT_DU_PASSAGE` (un seul instant sert au verdict d'effacement, à l'état
  // du panneau ET à l'estampille du fichier). Re-mesuré à `genereLe`, le catalogue
  // publié ne doit donc plus contenir AUCUNE carte condamnée. L'epsilon d'une
  // minute ne couvre qu'un décalage d'horloge : il ne doit jamais servir.
  const TRANSIT_PASSAGE_JOURS = 1 / 1440;
  const age = (o) => ageJours(o.premiereVue || o.vuLe, maintenant);
  const transit = condamnees.filter((o) => { const a = age(o); return a !== null && a <= VIE_AFFICHEE_JOURS + TRANSIT_PASSAGE_JOURS; });
  const dures = condamnees.filter((o) => !transit.includes(o));
  if (transit.length) console.log(`   ${transit.length} carte(s) en TRANSIT de passage (franchies après le verdict, effacées au passage suivant)`);
  assert.equal(dures.length, 0,
    `des cartes condamnées survivent au-delà du transit d’un passage : ${dures.slice(0, 5).map((o) => o.id).join(' | ')}`);
  // LE TAUX, PARCE QUE C'EST LA SEULE MESURE QUI SURVIT À UN CATALOGUE QUI CHANGE
  // DE TAILLE (voir l’épreuve Amazon : 200 produits était un total devenu faux).
  // Relevé le 14/10/2026 : **58,0 %** des offres dépassaient cinq jours AVANT la
  // règle, **3,1 %** après. Un plafond à 10 % crie donc si la règle cesse d'agir,
  // sans jamais devenir faux parce que le catalogue a maigri.
  const offresSeules = offres.filter((o) => o.type !== 'article');
  const veilles = offresSeules.filter((o) => {
    const a = ageJours(o.premiereVue || o.vuLe, maintenant);
    return a !== null && a > VIE_AFFICHEE_JOURS;
  });
  const taux = offresSeules.length ? (100 * veilles.length) / offresSeules.length : 0;
  console.log(`   ${offresSeules.length} offres · ${veilles.length} de plus de cinq jours (${taux.toFixed(1)} % — 58,0 % avant la règle)`);
  assert.ok(taux <= 10,
    `trop de cartes dépassent cinq jours (${taux.toFixed(1)} %) : la règle ne fait plus son travail`);
});
