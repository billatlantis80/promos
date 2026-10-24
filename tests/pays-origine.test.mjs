/**
 * LE VISITEUR ARRIVE SUR LE PAYS DE SON ORIGINE — application n°2 « Promos ».
 *
 * Demande de B (11/10/2026) : « Quand un utilisateur arrive sur le site internet
 * via chrome ou edge, il doit arriver sur le pays de son origine. Pas dans tous
 * les pays. »
 *
 * Défaut mesuré AVANT correction, dans un vrai navigateur neuf : la page
 * s'ouvrait sur la question « Où fais-tu tes achats ? » avec « Tous les pays
 * d'Europe » présélectionné. La détection ne lisait QUE `navigator.language` et
 * sa région — or Chrome et Edge, sur un PC dont la langue n'est pas régionalisée,
 * annoncent « fr » ou « en », SANS pays. Il ne restait donc aucun signal.
 *
 * Ces contrôles EXÉCUTENT la vraie fonction de détection (bac à sable `vm`) avec
 * un fuseau horaire et une langue imposés : ils disent ce qui se passerait sur
 * l'appareil du visiteur, ils ne relisent pas la source.
 *
 * Lancement : node --test tests/pays-origine.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { NOMS_PAYS as PAYS_COLLECTEUR } from '../collecteur.mjs';
import { NOMS_PAYS } from '../public/drapeaux.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', f), 'utf8');
const app = lire('public/app.js');

/** Les pays que le catalogue dessert AUJOURD'HUI (les douze d'Europe). */
const DESSERVIS = Object.keys(NOMS_PAYS);

/** Extrait `const NOM = …;` du script, accolades équilibrées. */
function blocConstant(nom) {
  const debut = app.indexOf(`const ${nom} = `);
  assert.ok(debut >= 0, `${nom} doit être déclaré dans app.js`);
  const debutObjet = app.indexOf('{', debut);
  let profondeur = 0;
  for (let i = debutObjet; i < app.length; i++) {
    if (app[i] === '{') profondeur++;
    else if (app[i] === '}' && --profondeur === 0) return app.slice(debut, app.indexOf(';', i) + 1);
  }
  throw new Error(`fin de ${nom} introuvable`);
}

/** Extrait `function nom(…) { … }` du script. */
function extraire(nom) {
  const debut = app.indexOf(`function ${nom}(`);
  assert.ok(debut >= 0, `la fonction ${nom}() doit exister dans app.js`);
  let profondeur = 0;
  for (let i = app.indexOf('{', debut); i < app.length; i++) {
    if (app[i] === '{') profondeur++;
    else if (app[i] === '}' && --profondeur === 0) return app.slice(debut, i + 1);
  }
  throw new Error(`accolades non équilibrées dans ${nom}()`);
}

/**
 * Le module de détection, exécuté tel quel avec un appareil simulé.
 * @param {{fuseau?: string, langues?: string[], langue?: string|null,
 *          pays?: string[], memoire?: string|null}} appareil
 */
function paysSelon(appareil) {
  const ecrits = [];
  // La mémoire du navigateur, telle que l'application la lit AU DÉMARRAGE
  // (voir lancer() : `etat.pays = localStorage.getItem(CLE_PAYS) || 'tout'`).
  const memoire = appareil.memoire ?? null;
  const ctx = vm.createContext({
    // Le catalogue du jour, réduit à ce que le test veut : c'est ainsi qu'on
    // vérifie qu'un pays sans offre aujourd'hui n'est pas choisi.
    codesPays: () => appareil.pays || [...DESSERVIS],
    etat: { pays: memoire || 'tout' },
    CLE_PAYS: 'promos.pays',
    localStorage: {
      getItem: () => memoire,
      setItem: (k, v) => ecrits.push([k, v]),
    },
    navigator: {
      language: appareil.langue === undefined ? 'fr-BE' : appareil.langue,
      languages: appareil.langues || [],
    },
    // Le fuseau est LU par `fuseau()` via Intl : on impose celui de l'appareil.
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: appareil.fuseau }) }) },
  });
  vm.runInContext([
    blocConstant('PAYS_PAR_FUSEAU'),
    extraire('fuseau'),
    extraire('regionDe'),
    extraire('paysDOrigine'),
    extraire('paysGeo'),
    extraire('appliquerPaysDOrigine'),
    // Une déclaration `const` de haut niveau ne devient PAS une propriété du
    // contexte (contrairement aux fonctions) : on publie donc la table à la main,
    // sinon le contrôle de cohérence lirait « undefined ».
    'globalThis.TABLE_FUSEAUX = PAYS_PAR_FUSEAU;',
  ].join('\n'), ctx);
  return {
    pays: ctx.paysDOrigine(),
    geo: () => ctx.paysGeo(),
    region: ctx.regionDe,
    pose: () => ctx.appliquerPaysDOrigine(),
    paysPose: () => ctx.etat.pays,
    ecrits,
    table: ctx.TABLE_FUSEAUX,
  };
}

test('LE DÉFAUT DE CHROME ET EDGE : langue sans pays, fuseau renseigné', () => {
  // « en-US » ou « fr » tout court : aucun pays dans la langue. Avant, la page
  // ouvrait sur « Tous les pays d'Europe ». Le fuseau, lui, dit où l'on est.
  const belge = paysSelon({ fuseau: 'Europe/Brussels', langue: 'fr', langues: ['fr'] });
  assert.equal(belge.pays, 'BE', 'la Belgique doit être reconnue par le fuseau seul');
  const anglais = paysSelon({ fuseau: 'Europe/Brussels', langue: 'en-US', langues: ['en-US'] });
  assert.equal(anglais.pays, 'BE', 'un PC en anglais installé en Belgique reste en Belgique');
  const allemand = paysSelon({ fuseau: 'Europe/Berlin', langue: 'de', langues: ['de'] });
  assert.equal(allemand.pays, 'DE', 'l’Allemagne doit être reconnue par le fuseau seul');
});

test('LE FUSEAU PASSE AVANT LA LANGUE quand les deux disent autre chose', () => {
  // Belgique, PC déclaré « français de France » : on est en Belgique, et c'est
  // là qu'on fait ses courses. Le lieu tranche.
  const cas = paysSelon({ fuseau: 'Europe/Brussels', langue: 'fr-FR', langues: ['fr-FR'] });
  assert.equal(cas.pays, 'BE', 'le fuseau doit primer sur la langue');
});

test('la langue sert de repli quand le fuseau est inconnu', () => {
  const cas = paysSelon({ fuseau: 'UTC', langue: 'fr-BE', langues: ['fr-BE', 'fr', 'en'] });
  assert.equal(cas.pays, 'BE', 'sans fuseau d’Europe, la région de la langue doit servir');
  const ordre = paysSelon({ fuseau: '', langue: 'en', langues: ['en', 'nl-NL'] });
  assert.equal(ordre.pays, 'NL', 'on parcourt les langues DANS L’ORDRE annoncé');
});

test('les douze pays du catalogue sont reconnus par leur fuseau', () => {
  // La table EST la règle : chaque pays desservi doit avoir son fuseau, sans quoi
  // ce pays ne serait jamais reconnu par le premier signal.
  const attendus = {
    BE: 'Europe/Brussels', NL: 'Europe/Amsterdam', FR: 'Europe/Paris',
    DE: 'Europe/Berlin', AT: 'Europe/Vienna', ES: 'Europe/Madrid',
    IT: 'Europe/Rome', PT: 'Europe/Lisbon', PL: 'Europe/Warsaw',
    SE: 'Europe/Stockholm', IE: 'Europe/Dublin', GB: 'Europe/London',
  };
  for (const [pays, fuseau] of Object.entries(attendus)) {
    const cas = paysSelon({ fuseau, langue: 'en-US', langues: ['en-US'] });
    assert.equal(cas.pays, pays, `${fuseau} doit mener à ${pays}`);
  }
  // Et chaque pays du catalogue est couvert : aucun n'est oublié.
  const couverts = new Set(Object.values(paysSelon({ fuseau: 'UTC' }).table));
  assert.deepEqual([...DESSERVIS].filter((c) => !couverts.has(c)), [],
    'tout pays du catalogue doit être atteignable par un fuseau');
});
test('on ne devine JAMAIS un pays hors catalogue', () => {
  // Zurich (Suisse) : pays voisin, non desservi. « de-CH » non plus. Mieux vaut
  // poser la question que d'afficher des offres du mauvais pays.
  assert.equal(paysSelon({ fuseau: 'Europe/Zurich', langue: 'de-CH' }).pays, null,
    'un pays non desservi ne doit pas être deviné');
  assert.equal(paysSelon({ fuseau: 'America/New_York', langue: 'en-US' }).pays, null,
    'hors d’Europe, aucun signal ne parle : on demandera');
  // Un pays desservi mais SANS offre aujourd'hui (le sélecteur ne l'annonce pas)
  // n'est pas choisi non plus : l'écran serait vide.
  assert.equal(paysSelon({ fuseau: 'Europe/Brussels', langue: 'fr-BE', pays: ['FR', 'DE'] }).pays, null,
    'un pays sans offre du jour ne doit pas être posé');
});

test('LA PROVENANCE DOCUMENTÉE EST LE LIEU, jamais le marché consulté', () => {
  // Demande de B (13/10/2026) : « Le pays doit être documenté en fonction de la
  // géolocalisation et pas en fonction du pays choisi pour faire ses achats. »
  //
  // Défaut mesuré ce jour-là dans la feuille « Inscriptions » : une inscription
  // depuis la Belgique portait « FR » — le marché que B consultait à l'écran.
  // `paysGeo()` ne regarde donc JAMAIS `etat.pays`.
  const ici = { fuseau: 'Europe/Brussels', langue: 'fr-BE' };

  // 1. Même quand le filtre dit autre chose, c'est le LIEU qui est documenté.
  assert.equal(paysSelon({ ...ici, memoire: 'FR' }).geo(), 'BE',
    'un visiteur en Belgique qui regarde le marché français reste en Belgique');

  // 2. Hors catalogue, la provenance est QUAND MÊME documentée : savoir qu'on est
  //    visité depuis les États-Unis est une information, pas une erreur.
  assert.equal(paysSelon({ fuseau: 'America/New_York', langue: 'en-US', langues: ['en-US'] }).geo(), 'US');

  // 3. Un pays desservi mais absent du catalogue du jour reste une provenance
  //    valable — l'inverse de `paysDOrigine`, qui ne doit pas ouvrir un écran vide.
  const sansOffre = paysSelon({ fuseau: 'Europe/Paris', langue: 'fr-FR', pays: ['BE'] });
  assert.equal(sansOffre.geo(), 'FR', 'la provenance ne dépend pas du catalogue');
  assert.equal(sansOffre.pays, null, 'mais l’ouverture du catalogue, si');

  // 4. Rien de lisible → une case VIDE, jamais une supposition.
  assert.equal(paysSelon({ fuseau: '', langue: null, langues: [] }).geo(), '');
});

test('une région numérique ou trop longue n’est pas un pays', () => {
  const { region } = paysSelon({ fuseau: 'UTC' });
  assert.equal(region('fr-BE'), 'BE');
  assert.equal(region('nl-BE'), 'BE');
  assert.equal(region('zh-Hans-CN'), 'CN', 'la région est le DERNIER morceau de deux lettres');
  assert.equal(region('ES-419'), '', 'une région numérique n’est pas un pays');
  assert.equal(region('fr'), '', 'sans région, il n’y a rien à lire');
  assert.equal(region(''), '');
  assert.equal(region(null), '');
});

test('le pays deviné n’est JAMAIS écrit en mémoire — et jamais par-dessus un choix', () => {
  const vierge = paysSelon({ fuseau: 'Europe/Brussels', langue: 'fr-BE' });
  assert.equal(vierge.pose(), true, 'le pays doit être posé à l’arrivée');
  assert.equal(vierge.paysPose(), 'BE');
  assert.deepEqual(vierge.ecrits, [],
    'une détection reste une PROPOSITION : l’écrire effacerait le choix de l’utilisateur');

  // « Tous les pays d'Europe » choisi exprès est une DÉCISION : la détection ne
  // doit pas la reprendre au chargement suivant.
  const aChoisi = paysSelon({ fuseau: 'Europe/Brussels', langue: 'fr-BE', memoire: 'tout' });
  assert.equal(aChoisi.pose(), false, 'un choix mémorisé coupe court à la détection');
  assert.equal(aChoisi.paysPose(), 'tout', 'le choix de l’utilisateur reste intact');
  const aChoisiFR = paysSelon({ fuseau: 'Europe/Brussels', langue: 'fr-BE', memoire: 'FR' });
  assert.equal(aChoisiFR.pose(), false, 'un pays choisi prime aussi sur le fuseau');
  assert.equal(aChoisiFR.paysPose(), 'FR');
});

test('la détection est appliquée AVANT le premier dessin du filtre', () => {
  // L'ordre n'est pas un détail : au début de lancer(), le catalogue n'est pas
  // encore lu, donc `codesPays()` est vide et la détection ne trouve rien —
  // silencieusement. Elle doit être juste avant dessinerPays(), comme la langue.
  // ⚠ BORNE RE-POINTÉE ET PROTÉGÉE LE 11/10/2026 : `demarrer()` n'existe plus
  // (elle s'appelait ainsi quand un écran de verrouillage pouvait retenir
  // l'ouverture ; elle s'appelle `lancerAuDemarrage()` depuis que le compte local
  // est parti). `indexOf` rendait -1, et `slice(debut, -1)` avalait la fin du
  // fichier — la tranche n'était plus « lancer() » mais presque tout app.js, et
  // le contrôle ne voulait plus rien dire sans échouer.
  const lancer = app.slice(app.indexOf('async function lancer()'), app.indexOf('function lancerAuDemarrage()'));
  assert.ok(lancer.length > 100 && lancer.length < 20000,
    `découpage de lancer() invalide (${lancer.length} caractères) — la borne a bougé`);
  const iDetection = lancer.indexOf('appliquerPaysDOrigine();');
  const iPays = lancer.indexOf('dessinerPays();');
  const iLangue = lancer.indexOf('chargerLangue();');
  assert.ok(iDetection > 0, 'lancer() doit poser le pays d’origine');
  assert.ok(iLangue < iDetection, 'la langue est lue avant (les libellés naissent traduits)');
  assert.ok(iDetection < iPays, 'la détection doit précéder le premier dessin du filtre');
});

test('la question du pays n’est posée QUE pour un appareil qui ne dit rien', () => {
  // DÉCISION DE B, tranchée le 11/10/2026 : « J'aimerais que tu reviennes à
  // l'ancienne situation au niveau programme, mais juste que tu rajoutes le
  // drapeau avec le menu quand il décide de changer de pays. […] L'utilisateur
  // n'a pas besoin d'avoir le panneau qui lui demande dans quel pays il veut
  // faire ses achats à chaque fois qu'il rentre dans le site. »
  const question = app.slice(app.indexOf('function demanderPays('), app.indexOf('function enregistrerPays('));
  assert.match(question, /if \(paysDOrigine\(\)\) return;/,
    'un appareil qui dit d’où il vient ne doit RIEN se voir demander');
  assert.match(question, /\$\('paysDemande'\)\.hidden = false;/,
    'la question existe encore — pour l’appareil muet, le seul cas où l’on ne peut pas décider');
  assert.match(question, /if \(enregistre\) return;/, 'un pays déjà choisi n’est pas redemandé');
  // Le changement de pays DANS LA SESSION passe par le panneau à drapeaux, que B
  // a demandé « à la place du panneau déroulant ».
  assert.match(app, /htmlListePays\(\{ actif: etat\.pays \}\)/,
    'le panneau de la barre du haut doit montrer les pays, drapeaux compris');
  // L'ancienne détection par la seule langue ne doit pas revenir par la bande.
  assert.doesNotMatch(app, /function paysDetecte\(/, 'l’ancienne détection ne doit plus exister');
  assert.match(app, /navigator\.languages/, 'les langues annoncées doivent être lues, pas seulement la première');
});

test('la table des fuseaux ne renvoie jamais vers un pays non desservi', () => {
  const { table } = paysSelon({ fuseau: 'UTC' });
  const inconnus = Object.entries(table).filter(([, pays]) => !NOMS_PAYS[pays]);
  assert.deepEqual(inconnus, [], 'un fuseau ne doit mener qu’à un pays du catalogue');
  // Et les deux tables de pays — interface et collecteur — doivent rester d'accord
  // sur ce que « desservi » veut dire.
  assert.deepEqual(Object.keys(NOMS_PAYS).sort(), Object.keys(PAYS_COLLECTEUR).sort());
});

test('la détection ne dépend d’AUCUN navigateur en particulier', () => {
  // RÈGLE DE B (11/10/2026) : « La règle pour Chrome et edge doit être valable
  // pour tous les navigateurs Internet. »
  // Le module de détection n'a donc le droit d'employer que des API STANDARD :
  // un fuseau horaire, et les langues que l'appareil annonce. Aucune marque,
  // aucun préfixe constructeur, aucune détection de navigateur — sinon la règle
  // ne vaudrait que là où on l'a essayée.
  const module = app.slice(app.indexOf('function fuseau()'), app.indexOf('const PAR_PAGE'));
  assert.ok(module.length > 400, `découpage du module de détection invalide (${module.length})`);
  for (const interdit of ['userAgent', '\\bchrome\\b', 'webkit', 'msie', 'Edge/', 'opera']) {
    assert.doesNotMatch(module, new RegExp(interdit, 'i'),
      `« ${interdit} » n’a rien à faire dans la détection : la règle vaut pour TOUS les navigateurs`);
  }
  // Et les deux signaux employés sont bien les API standard, présentes partout.
  assert.match(module, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/,
    'le fuseau horaire se lit par l’API standard Intl');
  assert.match(module, /navigator\.languages/,
    'et les langues par la liste que le navigateur annonce');
});

test('le bandeau annonce TOUS les pays — la répartition vit dans le panneau', () => {
  // RÈGLE DE B (11/10/2026), mot pour mot : « Le chiffre annoncé à droite doit
  // annoncer le nombre d'annonces qu'il y a dans tous les pays. Uniquement. Tu
  // dois laisser cette ligne et tu dois laisser la ligne de la mise à jour. Le
  // choix du pays indique déjà le nombre d'annonces qu'il y a par pays. […] La
  // distinction doit rester. »
  //
  // Ce contrôle existe parce que la tentation est réelle : voyant le bandeau
  // annoncer 8 254 alors qu'un pays en affiche 814, on est porté à le « corriger »
  // pour qu'il suive le pays. B a tranché le contraire. Que ce contrôle échoue le
  // jour où quelqu'un le fera, et qu'il rappelle la règle en clair.
  // ⚠ ANCRAGE REVU LE 11/10/2026 : le bandeau n'est plus découpé par portée
  // (« if (etat.portee === 'promos') » a quitté dessiner() — il n'y a plus qu'UN
  // seul dessin, pour toutes les portées, depuis que B a signalé qu'en
  // « Toutes les promos » le message n'annonçait plus le nombre de bonnes
  // promos). On s'ancre sur la ligne qui COMPTE les bonnes promos.
  const iCompte = app.indexOf("melanger(dedoublonner(etat.offres.filter(estBonnePromo)))");
  assert.ok(iCompte > 0, 'la ligne qui compte les bonnes promos doit exister');
  const bandeau = app.slice(iCompte, app.indexOf("$('fraicheur').textContent", iCompte));
  assert.ok(bandeau.length > 300, `découpage du bandeau invalide (${bandeau.length} caractères)`);
  assert.match(bandeau, /etat\.offres\.filter\(estBonnePromo\)/,
    'le nombre de bonnes promos du bandeau doit se compter sur TOUTES les offres, pas sur celles du pays');
  assert.match(bandeau, /const totalPromos = etat\.offres\.length;/,
    'la deuxième ligne doit rester le total de tous les pays (le même chiffre que « Tous les pays (N) » du sélecteur)');
  assert.match(bandeau, /t\('mis à jour \{n\}'/,
    'la ligne de la mise à jour doit rester dans le bandeau');
  assert.doesNotMatch(bandeau, /etat\.pays|offresDuPays/,
    'le bandeau ne compte pas par pays : le chiffre par pays vit dans le panneau de choix du pays');
  // Et le chiffre par pays, lui, doit bien exister là où B le veut : en face de
  // chaque pays, dans le panneau (réglages, barre du haut et question d'ouverture
  // partagent le même dessin — voir pays-module-partage.test.mjs).
  const panneau = app.slice(app.indexOf('function htmlListePays('), app.indexOf('function dessinerPays()'));
  assert.match(panneau, /compte\[c\]/, 'chaque pays du panneau doit annoncer son nombre d’offres');
});
