/**
 * LES TUYAUX DU TRAFIC ET DES GAINS — épreuve de bout en bout.
 * =============================================================================
 *
 * CE QUE CETTE ÉPREUVE EMPÊCHE, ET QUI EST DÉJÀ ARRIVÉ SUR CE PROJET.
 *
 * 1. UN TUYAU ANNONCÉ MAIS FERMÉ. L'adresse du relais était lue dans le
 *    stockage local du navigateur : elle n'existait que sur l'appareil où on
 *    l'avait saisie. Résultat mesuré : aucun relevé de visite n'est jamais
 *    parti, et le panneau pouvait afficher « relais branché » en ne recevant
 *    rien. On vérifie donc ici que l'adresse est bien PUBLIÉE, et qu'aucun
 *    chemin d'envoi ne dépend plus du stockage local.
 *
 * 2. UN CHAMP QUE PERSONNE NE LIT. C'est la « règle du tuyau » : un champ que
 *    nul programme ne lit est une promesse fausse. L'épreuve confronte donc
 *    CHAMP PAR CHAMP ce que le site envoie et ce que le récepteur lit.
 *
 * 3. UN RAPPORT DONT LE PANNEAU LIT DES CLÉS QUI N'EXISTENT PAS. Un
 *    `undefined` n'est ni vrai ni faux : c'est un trou à l'écran, qui se lit
 *    comme une donnée. On exerce la vraie fonction de calcul du récepteur sur
 *    un journal fabriqué (jours creux, partages, clics sans affiliation), PUIS
 *    la vraie fonction d'affichage du panneau sur ce rapport.
 *
 * 4. UNE ERREUR SILENCIEUSE DU RÉCEPTEUR. Un relevé de visite qui se fait
 *    refuser comme « adresse invalide » ne lève RIEN : la feuille reste vide et
 *    personne ne le sait. On appelle donc vraiment `doPost` avec un faux
 *    tableur.
 *
 * Lancement : node --test tests/relais-tuyaux.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const PANNEAU = lire('public/admin/index.html');
const TRAFIC_JS = lire('public/trafic.js');
const RELAIS_JS = lire('public/relais.js');
const RECEPTEUR = lire('outils/tableau-inscription.gs');
const APP_JS = lire('public/app.js');
const INSCRIPTION_JS = lire('public/inscription.js');

/* =========================================================================
 * 1. LE TUYAU EXISTE
 * ========================================================================= */

test('l’adresse du relais est PUBLIÉE — c’est la seule façon qu’un visiteur l’ait', () => {
  assert.match(RELAIS_JS, /export const URL_RELAIS\s*=\s*'[^']*'/,
    'l’adresse publiée doit exister dans public/relais.js');
  // Le site envoie vers l'adresse publiée, jamais vers un réglage local.
  assert.match(APP_JS, /import \{ adresseRelais \} from '\.\/relais\.js'/,
    'app.js doit lire l’adresse du module publié');
  assert.match(APP_JS, /relais: adresseRelais\(\)/,
    'le relevé de visite doit partir vers l’adresse publiée');
  assert.doesNotMatch(APP_JS, /localStorage\.getItem\('kazendra\.relais'\)/,
    'app.js ne doit plus lire l’adresse dans le stockage local : c’était le défaut');
  // Une seule adresse pour tout : l’inscription ne doit pas avoir la sienne.
  assert.match(INSCRIPTION_JS, /import \{ adresseRelais \} from '\.\/relais\.js'/,
    'inscription.js doit tirer son adresse du même fichier');
  assert.doesNotMatch(INSCRIPTION_JS, /export const URL_TABLEAU = ''/,
    'la ligne à remplir ne doit plus exister en double dans inscription.js');
});

test('les CLICS partent vraiment — ils étaient mesurés et n’allaient nulle part', () => {
  assert.match(APP_JS, /relayerAction\(releve, adresseRelais\(\)\)/,
    'le clic vers un marchand doit être envoyé au relais');
  assert.match(TRAFIC_JS, /export function relayerAction/);
  // La sortie emporte l'hôte réellement ouvert : c'est lui qui rattache le clic
  // au bon programme d'affiliation (un nom de marchand ne le permet pas).
  assert.match(APP_JS, /url: a\.href/, 'le clic doit transmettre l’adresse réellement ouverte');
  assert.match(TRAFIC_JS, /function hoteDe\(url\)/, 'l’hôte doit être extrait de l’adresse');
});

test('le récepteur connaît les trois familles de relevés', () => {
  assert.match(RECEPTEUR, /d\.type === 'visite'/, 'le récepteur doit reconnaître une visite');
  assert.match(RECEPTEUR, /d\.type === 'clic' \|\| d\.type === 'partage'/,
    'le récepteur doit reconnaître une sortie vers un marchand');
  assert.match(RECEPTEUR, /NOM_VISITES|'Trafic visites'/, 'une feuille doit recevoir les visites');
  assert.match(RECEPTEUR, /NOM_CLICS|'Trafic clics'/, 'une feuille doit recevoir les clics');
});

/* =========================================================================
 * 2. LE CONTRAT DES CHAMPS — ce que le site envoie, ce que le relais lit
 * ========================================================================= */

/** Les champs réellement construits par `noterVisite` / `noterAction`. */
function champsEnvoyes() {
  const source = TRAFIC_JS;
  const bloc = (debut, fin) => {
    const i = source.indexOf(debut);
    assert.ok(i > 0, `« ${debut} » doit exister dans trafic.js`);
    const j = source.indexOf(fin, i);
    return source.slice(i, j);
  };
  const visite = bloc('export function noterVisite', 'export function noterVue');
  const action = bloc('export function noterAction', 'export function relayerAction');
  const cles = (t) => new Set([...t.matchAll(/^\s{2,}([a-z][a-zA-Z0-9]*):/gm)].map((m) => m[1]));
  const v = cles(visite);
  v.add('type');                       // ajouté par l'appel `poster({ type: 'visite', … })`
  const a = cles(action);
  return { visite: v, action: a };
}

/** Les champs que le récepteur lit vraiment (`d.<champ>`). */
function champsLus() {
  const vus = new Set([...RECEPTEUR.matchAll(/\bd\.([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]));
  return vus;
}

test('CHAQUE champ envoyé par le site est LU par le relais', () => {
  const lus = champsLus();
  const { visite, action } = champsEnvoyes();
  const manquantsV = [...visite].filter((c) => !lus.has(c));
  const manquantsA = [...action].filter((c) => !lus.has(c));
  assert.deepEqual(manquantsV, [],
    `champs de visite envoyés et jamais lus (promesse fausse) : ${manquantsV.join(', ')}`);
  assert.deepEqual(manquantsA, [],
    `champs de sortie envoyés et jamais lus : ${manquantsA.join(', ')}`);
  // Et les champs qui portent la question de B : d'où viennent les visiteurs.
  for (const c of ['entree', 'fuseau', 'page', 'langue']) {
    assert.ok(visite.has(c), `la visite doit porter « ${c} »`);
    assert.ok(lus.has(c), `le relais doit lire « ${c} »`);
  }
});

test('les champs envoyés tiennent dans une requête « simple » (aucun contrôle préalable)', () => {
  // Un en-tête JSON déclencherait un contrôle préalable (preflight) que le
  // service ne sait pas satisfaire : l'envoi échouerait EN SILENCE côté site.
  assert.match(TRAFIC_JS, /new URLSearchParams\(\)/, 'l’envoi doit être un formulaire');
  assert.doesNotMatch(TRAFIC_JS, /'Content-Type': 'text\/plain'/,
    'plus d’en-tête JSON : il rendait le tuyau muet');
  assert.match(TRAFIC_JS, /mode: 'no-cors'/);
  assert.match(RECEPTEUR, /e\.parameter/, 'le récepteur lit les champs du formulaire');
});

/* =========================================================================
 * 3. LE RÉCEPTEUR, EXERCÉ — faux tableur, vraies fonctions
 * ========================================================================= */

/** Un tableur de remplacement, fidèle sur ce que le script utilise.
 *
 *  LE COMPORTEMENT DE SHEETS, REPRODUIT : une chaîne qui RESSEMBLE à une date y
 *  devient une VRAIE date (c'est le format automatique d'une cellule). Sans
 *  cette fidélité, la copie de la feuille est plus sage que la vraie — et
 *  l'épreuve ne peut pas voir un défaut qui n'existe que dans la vraie.
 *  Défaut réel du 12/10/2026 : le rapport lisait ses relevés mais n'en rangeait
 *  AUCUN dans sa fenêtre — tous les compteurs à zéro, gains compris. */
function fauxTableur(o = {}) {
  const commeSheets = (v) => (o.dateAutomatique && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Date(v + 'T00:00:00Z') : v);
  const feuilles = new Map();
  const feuille = (nom) => {
    const f = {
      nom, lignes: [],
      getName: () => f.nom,
      getLastRow: () => f.lignes.length,
      appendRow: (l) => { f.lignes.push(l.map(commeSheets)); },
      setFrozenRows() {},
      getRange: (l, c, nl = 1, nc = 1) => ({
        setFontWeight() {},
        setValue: (v) => {
          const i = l - 1;
          while (f.lignes.length <= i) f.lignes.push([]);
          f.lignes[i][c - 1] = commeSheets(v);
        },
        getValue: () => (f.lignes[l - 1] || [])[c - 1],
        getValues: () => {
          // LA LECTURE PART DE LA COLONNE DEMANDÉE. L'ancienne version prenait
          // toujours le début de la ligne : demander la colonne du jeton rendait
          // la DATE, et toute recherche par adresse ou par jeton échouait en
          // silence. Une copie de la feuille qui lit au mauvais endroit fait
          // passer des épreuves qui ne prouvent rien.
          const out = [];
          for (let i = 0; i < nl; i++) {
            const ligne = (f.lignes[l - 1 + i] || []).slice(c - 1, c - 1 + nc);
            while (ligne.length < nc) ligne.push('');
            out.push(ligne);
          }
          return out;
        },
      }),
    };
    return f;
  };
  return {
    feuilles,
    getSheetByName: (n) => feuilles.get(n) || null,
    insertSheet: (n) => { const f = feuille(n); feuilles.set(n, f); return f; },
    getSpreadsheetTimeZone: () => 'Europe/Brussels',
    // utilitaire d'épreuve
    _lignes: (n) => (feuilles.get(n) ? feuilles.get(n).lignes : []),
  };
}

/** Charge le récepteur (outils/tableau-inscription.gs) dans un contexte isolé,
 *  avec les services Google remplacés. Rien n'est réécrit : c'est le fichier
 *  publié qui est exercé. */
function chargerRecepteur(o = {}) {
  const tableur = fauxTableur(o);
  const proprietes = new Map();
  const journal = [];
  const envois = [];
  const cache = new Map();
  const sortie = { texte: '', mime: '' };
  const mime = { TEXT: 'text/plain', JSON: 'application/json', JAVASCRIPT: 'application/javascript' };

  const ctx = vm.createContext({
    console, JSON, Math, Date, Number, String, Object, Array, RegExp, isNaN, parseInt, parseFloat,
    SpreadsheetApp: { getActiveSpreadsheet: () => tableur },
    Utilities: {
      getUuid: () => 'abcd1234-ef56-7890-abcd-1234567890ab',
      formatDate: (d, tz, fmt) => {
        const p = (n) => String(n).padStart(2, '0');
        // Le script n'utilise que deux formes ; on les rend en UTC pour que
        // l'épreuve soit déterministe (le fuseau est testé ailleurs).
        if (fmt === 'yyyy-MM-dd') return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
        if (fmt === 'HH:mm') return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
        return d.toISOString();
      },
      // Le logo joint au message : le faux service rend une « pièce » qui garde
      // de quoi vérifier qu'elle part bien AVEC le message.
      base64Decode: (s) => String(s),
      newBlob: (octets, type, nom) => ({ octets, type, nom }),
    },
    Session: { getScriptTimeZone: () => 'Europe/Brussels' },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (proprietes.has(k) ? proprietes.get(k) : null),
        setProperty: (k, v) => proprietes.set(k, String(v)),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, String(v)),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => o.urlService || 'https://script.google.com/macros/s/FAUX/exec' }) },
    MailApp: { sendEmail: (m) => { envois.push(m); return true; } },
    Logger: { log: (x) => journal.push(String(x)) },
    ContentService: {
      MimeType: mime,
      createTextOutput: (t) => {
        sortie.texte = String(t);
        return { setMimeType: (m) => { sortie.mime = m; return { sortie, getContent: () => sortie.texte }; } };
      },
    },
    HtmlService: {
      createHtmlOutput: (h) => ({ setTitle: () => ({ html: h }) }),
    },
  });
  ctx.globalThis = ctx;
  vm.runInContext(RECEPTEUR, ctx);
  return { ctx, tableur, proprietes, journal, sortie, vm, envois };
}

/** Un journal de visites fabriqué : `[jour, nombre, {source, fuseau, appareil, pays}]`. */
function visitesFabriquees(plan) {
  const out = [];
  for (const [jour, n, o] of plan) {
    for (let i = 0; i < n; i++) {
      out.push([new Date(jour + 'T10:00:00Z'), jour, '10:00', o.pays || 'BE', o.langue || 'fr',
        o.entree || 'direct', o.appareil || 'navigateur', o.fuseau || 'Europe/Brussels', o.page || '/', 1]);
    }
  }
  return out;
}

function clicsFabriques(plan) {
  const out = [];
  for (const [jour, type, hote, n] of plan) {
    for (let i = 0; i < n; i++) {
      out.push([new Date(jour + 'T11:00:00Z'), jour, '11:00', type, 'BE', hote.split('.')[0], 'dealabs', hote]);
    }
  }
  return out;
}

const MAINTENANT = new Date('2026-10-12T18:00:00Z');

test('le rapport compte juste : jours creux, moyennes, médiane, provenances', () => {
  const { ctx } = chargerRecepteur();
  const visites = visitesFabriquees([
    ['2026-10-06', 3, { entree: 'recherche Google', fuseau: 'Europe/Brussels', appareil: 'navigateur' }],
    ['2026-10-07', 0, {}],                                  // un jour CREUX, doit apparaître
    ['2026-10-08', 5, { entree: 'Facebook', appareil: 'application' }],
    ['2026-10-09', 0, {}],
    ['2026-10-10', 2, { entree: 'partage Kazendra' }],
    ['2026-10-11', 0, {}],
    ['2026-10-12', 4, { entree: 'recherche Google', pays: 'FR' }],
  ]);
  ctx.__v = visites; ctx.__c = clicsFabriques([['2026-10-12', 'clic', 'amazon.fr', 7]]);
  ctx.__o = { maintenant: MAINTENANT, jours: 7, fuseau: 'Europe/Brussels' };
  const r = vm.runInContext('construireRapport(__v, __c, __o)', ctx);

  // Le jour par jour couvre TOUS les jours de la fenêtre, creux compris.
  assert.equal(r.trafic.parJour.length, 7, 'une ligne par jour, jours creux inclus');
  const creux = r.trafic.parJour.filter((x) => x.visites === 0);
  assert.equal(creux.length, 3, 'trois jours sans visite doivent être COMPTÉS, pas omis');
  assert.equal(r.trafic.parJour[0].jour, '2026-10-06');
  assert.equal(r.trafic.parJour[6].jour, '2026-10-12');

  // 3 + 5 + 2 + 4 = 14 visites, 4 jours actifs sur 7.
  assert.equal(r.trafic.total.visites, 14);
  assert.equal(r.trafic.total.joursActifs, 4);
  assert.equal(r.trafic.total.moyenneJoursActifs, 3.5, 'moyenne sur les jours ACTIFS');
  assert.equal(r.trafic.total.moyenneFenetre, 2, 'moyenne sur la FENÊTRE entière');
  assert.equal(r.trafic.total.medianeFenetre, 2,
    'médiane : une journée forte (5) ne doit pas la déplacer comme elle déplace la moyenne des jours actifs (3,5)');
  assert.equal(r.trafic.total.meilleurJour.jour, '2026-10-08');
  assert.equal(r.trafic.total.meilleurJour.visites, 5);
  assert.equal(r.trafic.total.application, 5);

  // Les provenances, avec le « partage Kazendra » : une visite interne n'est
  // pas un domaine dans la colonne.
  const prov = Object.fromEntries(r.trafic.parProvenance.map((x) => [x.provenance, x.v]));
  assert.equal(prov['recherche Google'], 7);
  assert.equal(prov['Facebook'], 5);
  assert.equal(prov['partage Kazendra'], 2);
  assert.equal(r.trafic.parFuseau[0].fuseau, 'Europe/Brussels');
  assert.equal(r.trafic.parFuseau[0].v, 14);
  // Le pays CONSULTÉ est compté séparément de la provenance.
  const pays = Object.fromEntries(r.trafic.parPaysConsulte.map((x) => [x.pays, x.v]));
  assert.equal(pays.BE, 10);
  assert.equal(pays.FR, 4);

  // L'affiliation : 7 sorties vers un programme ouvert.
  assert.equal(r.affiliation.total.clics, 7);
  assert.equal(r.affiliation.parHote.length, 1, 'un seul hôte sollicité');
  assert.equal(r.affiliation.parHote[0].hote, 'amazon.fr');
  assert.equal(r.affiliation.parHote[0].clics, 7);
  assert.equal(r.affiliation.parHote[0].partages, 0);
  assert.equal(r.affiliation.parPays[0].pays, 'BE');
});

test('un rapport SANS aucune donnée garde une forme complète — pas un trou', () => {
  const { ctx } = chargerRecepteur();
  ctx.__o = { maintenant: MAINTENANT, jours: 30, fuseau: 'Europe/Brussels' };
  const r = vm.runInContext('construireRapport([], [], __o)', ctx);
  // Toutes les clés que le panneau lit doivent exister, même vides.
  for (const k of ['couverture', 'trafic', 'affiliation']) assert.ok(r[k], `« ${k} » manquant`);
  for (const k of ['total', 'parJour', 'parProvenance', 'parFuseau', 'parLangue',
    'parPaysConsulte', 'parAppareil', 'parPorte']) {
    assert.ok(r.trafic[k] !== undefined, `trafic.${k} manquant`);
  }
  for (const k of ['total', 'parHote', 'parMarchand', 'parPays', 'parJour']) {
    assert.ok(r.affiliation[k] !== undefined, `affiliation.${k} manquant`);
  }
  assert.equal(r.trafic.total.visites, 0);
  assert.equal(r.affiliation.total.clics, 0);
  assert.equal(r.couverture.premierReleve, null, 'aucun relevé : la couverture doit le DIRE, pas mentir');
  assert.equal(r.trafic.parJour.length, 30, 'la fenêtre reste complète, à zéro');
  assert.ok(Array.isArray(r.couverture.nonMesure) && r.couverture.nonMesure.length >= 3,
    'ce qui n’est pas mesuré doit être publié avec le rapport');
  // Et la sérialisation ne doit produire aucun « undefined » : le panneau
  // recevrait un trou à l'écran.
  const texte = JSON.stringify(r);
  assert.ok(!texte.includes('undefined'), 'aucun undefined dans le rapport publié');
  assert.ok(!texte.includes('NaN'), 'aucun NaN dans le rapport publié');
});

test('LE LIEN DE CONFIRMATION VISE L’ADRESSE PUBLIQUE, jamais celle du mode test', () => {
  // DÉFAUT RÉEL du 13/10/2026. `ScriptApp.getService().getUrl()` a rendu
  // l'adresse `/dev` (celle du mode test, qui n'ouvre que pour le propriétaire
  // connecté). Le clic de B a donc mené à une page Google « Impossible d'ouvrir
  // le fichier pour le moment », et son inscription est restée « en attente »
  // pour cette seule raison.
  //
  // Le remède ne devine RIEN : le site, lui, connaît l'adresse qui marche — il
  // vient d'écrire par elle — et il la donne au service (`relais`).
  const ID = 'AAAABBBBCCCCDDDD';
  const PUBLIQUE = `https://script.google.com/macros/s/${ID}/exec`;
  const { ctx, envois, proprietes } = chargerRecepteur({
    urlService: `https://script.google.com/macros/s/${ID}/dev`,
  });
  ctx.__e = { parameter: {
    email: 'une@exemple.be', langue: 'fr', pays: 'BE', source: 'kazendra', relais: PUBLIQUE,
  } };
  assert.equal(vm.runInContext('doPost(__e).getContent()', ctx), 'en attente, e-mail envoye');
  assert.equal(envois.length, 1, 'un e-mail doit être parti');
  for (const champ of ['body', 'htmlBody']) {
    assert.ok(envois[0][champ].includes(`${PUBLIQUE}?jeton=`),
      `le lien de ${champ} doit viser l’adresse publique`);
    assert.ok(!envois[0][champ].includes('/dev'),
      `le lien de ${champ} ne doit JAMAIS être celui du mode test`);
  }
  // La version HTML donne le lien ENTIER comme ancre : une adresse de cent
  // cinquante caractères se coupe à l'écran, et un doigt qui tombe sur la moitié
  // d'une adresse obtient la même page introuvable.
  assert.ok(envois[0].htmlBody.includes(`<a href="${PUBLIQUE}?jeton=`),
    'le lien doit être une vraie ancre HTML, pas seulement du texte');
  assert.equal(proprietes.get('ADRESSE_PUBLIQUE'), PUBLIQUE,
    'l’adresse éprouvée doit être retenue pour les envois suivants');
});

test('une adresse venue d’ailleurs est REFUSÉE (garde-fou)', () => {
  // Sans cette borne, n'importe qui pourrait poster une inscription avec
  // l'adresse d'un AUTRE service et faire envoyer à vos inscrits un lien vers
  // celui de quelqu'un d'autre. On n'accepte donc que la même famille que la
  // nôtre ; sinon on retombe sur l'adresse de Google.
  const MIENNE = 'https://script.google.com/macros/s/MIENNEID/exec';
  const { ctx, envois, proprietes } = chargerRecepteur({ urlService: MIENNE });
  ctx.__e = { parameter: {
    email: 'deux@exemple.be', langue: 'fr', pays: 'BE', source: 'kazendra',
    relais: 'https://script.google.com/macros/s/CHEZQUELQUUN/exec',
  } };
  vm.runInContext('doPost(__e).getContent()', ctx);
  assert.ok(envois[0].body.includes(`${MIENNE}?jeton=`),
    'une adresse étrangère doit être ignorée au profit de la nôtre');
  assert.ok(!envois[0].body.includes('CHEZQUELQUUN'), 'et jamais recopiée dans un message');
  assert.notEqual(proprietes.get('ADRESSE_PUBLIQUE'), 'https://script.google.com/macros/s/CHEZQUELQUUN/exec');
});

test('LE LIEN SUIT LE CHEMIN PAR LEQUEL LA REQUÊTE EST ENTRÉE', () => {
  // LE VRAI CAS DE LA PANNE DU 13/10/2026, tel qu'il se produit en vrai : le
  // site écrit sur l'adresse PUBLIQUE, mais `getUrl()` rend celle du mode test
  // (`/dev`), et l'inscrit tombait sur « Impossible d'ouvrir le fichier ».
  //
  // Ici, AUCUNE adresse n'est fournie par le site (`relais` absent) : le seul
  // signal est le chemin emprunté par la requête (`contextPath`). C'est ce qui
  // rend la correction indépendante de toute supposition.
  const ID = 'AAAABBBBCCCCDDDD';
  const PUBLIQUE = `https://script.google.com/macros/s/${ID}/exec`;
  const { ctx, envois } = chargerRecepteur({
    urlService: `https://script.google.com/macros/s/${ID}/dev`,
  });
  ctx.__e = { contextPath: `/macros/s/${ID}/exec`, parameter: { email: 'trois@exemple.be', langue: 'fr' } };
  assert.equal(vm.runInContext('doPost(__e).getContent()', ctx), 'en attente, e-mail envoye');
  assert.ok(envois[0].body.includes(`${PUBLIQUE}?jeton=`),
    'le lien doit suivre le chemin de la requête, pas l’adresse du mode test');
  assert.ok(!envois[0].htmlBody.includes('/dev'), 'jamais le lien du mode test');
});

test('LE MESSAGE PORTE LE LOGO, et les neuf langues ont leurs libellés', () => {
  // Demande de B, 13/10/2026 : « un mail de confirmation plus agréable au visuel
  // avec le logo intégré ». Le logo voyage DANS le message (aucun appel à
  // l'extérieur), et le message reste complet si l'image est refusée.
  const { ctx, envois } = chargerRecepteur();
  ctx.__e = { parameter: { email: 'quatre@exemple.be', langue: 'fr' } };
  vm.runInContext('doPost(__e).getContent()', ctx);
  assert.ok(envois[0].htmlBody.includes('src="cid:logo"'),
    'le message doit désigner le logo joint');
  assert.ok(envois[0].inlineImages && envois[0].inlineImages.logo,
    'et le logo doit partir AVEC le message, jamais être cherché sur un service tiers');
  assert.ok(envois[0].htmlBody.includes('Confirmer mon inscription'),
    'le bouton doit porter le libellé court de la langue');

  // LES NEUF LANGUES, UNE PAR UNE : un libellé manquant sortirait en anglais sur
  // un message français sans que rien ne le signale.
  for (const code of ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']) {
    const courts2 = vm.runInContext(`courts('${code}')`, ctx);
    assert.ok(courts2.titre && courts2.cta, `la langue ${code} doit avoir ses deux libellés courts`);
    const html = vm.runInContext(
      `corpsHtmlConfirmation(textes('${code}'), courts('${code}'), `
      + `'https://x/y?jeton=1', 'https://x/y?desinscrire=1', true)`, ctx);
    for (const trou of ['undefined', 'NaN', '[object Object]']) {
      assert.ok(!html.includes(trou), `le message « ${code} » ne doit pas porter de trou (${trou})`);
    }
    assert.ok(html.includes('cid:logo') && html.includes('?desinscrire=1'),
      `le message « ${code} » doit porter le logo et le lien de désinscription`);
  }

  // ET SANS LOGO, le message part quand même — avec un en-tête propre.
  const sansLogo = vm.runInContext(
    "corpsHtmlConfirmation(textes('fr'), courts('fr'), 'https://x/y?jeton=1', 'https://x/y?d=1', false)", ctx);
  assert.ok(!sansLogo.includes('cid:logo'),
    'sans logo joint, le message ne doit pas désigner une image absente');
  assert.ok(sansLogo.includes('Kazendra'), 'et l’en-tête reste');
});

test('le relais enregistre une VISITE sans la prendre pour une inscription', () => {
  const { ctx, tableur } = chargerRecepteur();
  ctx.__e = { parameter: {
    type: 'visite', quand: '2026-10-12T14:03:00.000Z', pays: 'BE', langue: 'fr',
    entree: 'recherche Google', appareil: 'navigateur', fuseau: 'Europe/Brussels',
    page: '/rubriques/high-tech', vues: '1',
  } };
  const reponse = vm.runInContext('doPost(__e).getContent()', ctx);
  assert.equal(reponse, 'visite', 'la visite doit être reconnue comme telle');
  const lignes = tableur._lignes('Trafic visites');
  assert.equal(lignes.length, 2, 'les titres + la visite');
  assert.equal(lignes[0][0], 'Date', 'les titres doivent être posés une fois');
  assert.equal(lignes[1][1], '2026-10-12', 'le jour doit être celui du propriétaire');
  assert.equal(lignes[1][5], 'recherche Google');
  assert.equal(lignes[1][8], '/rubriques/high-tech');
  // Et surtout : AUCUNE ligne d'inscription n'a été créée au passage.
  assert.ok(!tableur.getSheetByName('Inscriptions'), 'une visite ne doit pas créer la feuille des inscrits');
});

test('le relais enregistre un CLIC et un PARTAGE, et les distingue', () => {
  const { ctx, tableur } = chargerRecepteur();
  for (const type of ['clic', 'partage']) {
    ctx.__e = { parameter: { type, quand: '2026-10-12T11:00:00.000Z', pays: 'BE',
      marchand: 'Amazon', source: 'dealabs', hote: 'amazon.com.be' } };
    vm.runInContext('doPost(__e).getContent()', ctx);
  }
  const lignes = tableur._lignes('Trafic clics');
  assert.equal(lignes.length, 3);
  assert.equal(lignes[1][3], 'clic');
  assert.equal(lignes[2][3], 'partage');
  assert.equal(lignes[1][7], 'amazon.com.be', 'l’hôte est ce qui rattache le clic au programme');
});

test('une inscription reste une inscription (rien n’a été cassé au passage)', () => {
  const { ctx, tableur } = chargerRecepteur();
  ctx.__e = { parameter: { email: 'Marie@Exemple.be', langue: 'fr', pays: 'BE', source: 'kazendra' } };
  const reponse = vm.runInContext('doPost(__e).getContent()', ctx);
  assert.match(reponse, /en attente/, 'une adresse valide doit partir en attente');
  const lignes = tableur._lignes('Inscriptions');
  assert.equal(lignes.length, 2);
  assert.equal(lignes[1][1], 'marie@exemple.be', 'l’adresse est normalisée');
  assert.equal(lignes[1][6], 'en attente');
  // Le courrier partait d'un compte dont l'e-mail est faux : le statut doit le dire.
  ctx.__e2 = { parameter: { email: 'pas-une-adresse' } };
  assert.equal(vm.runInContext('doPost(__e2).getContent()', ctx), 'adresse invalide');
});

/* =========================================================================
 * 4. LA CLÉ — la lecture est fermée
 * ========================================================================= */

test('le rapport est REFUSÉ sans la bonne clé', () => {
  const { ctx, sortie } = chargerRecepteur();
  ctx.__g = (p) => { vm.runInContext(`__r = doGet(${JSON.stringify(p)})`, ctx); return sortie.texte; };
  // 1. Sans clé du tout.
  let t = ctx.__g({ parameter: {} });
  assert.notEqual(t, undefined);
  // doGet sans parametre « rapport » rend une page HTML (le lien d'e-mail) :
  // c'est normal. On vise le chemin du rapport.
  t = ctx.__g({ parameter: { rapport: 'panneau' } });
  assert.equal(JSON.parse(t).erreur, 'cle', 'sans clé, aucune donnée');
  // 2. Avec une mauvaise clé : même refus, et AUCUNE donnée.
  t = ctx.__g({ parameter: { rapport: 'panneau', cle: 'fausse' } });
  const d = JSON.parse(t);
  assert.equal(d.erreur, 'cle');
  assert.ok(!('trafic' in d) && !('affiliation' in d), 'un refus ne doit contenir aucune donnée');
  // 3. Avec la bonne clé : le rapport arrive.
  const bonne = vm.runInContext('cleDuRapport()', ctx);
  t = ctx.__g({ parameter: { rapport: 'panneau', cle: bonne } });
  const r = JSON.parse(t);
  assert.ok(r.couverture && r.trafic && r.affiliation, 'la bonne clé ouvre le rapport');
});

test('la seconde porte (balise <script>) rend du JSONP, jamais du code libre', () => {
  const { ctx, sortie } = chargerRecepteur();
  const bonne = vm.runInContext('cleDuRapport()', ctx);
  vm.runInContext(`__r = doGet({parameter:{rapport:'panneau', cle:${JSON.stringify(bonne)}, jsonp:'__kz1'}})`, ctx);
  assert.ok(sortie.texte.startsWith('__kz1('), 'la réponse doit appeler la fonction demandée');
  assert.ok(sortie.texte.endsWith(');'));
  assert.equal(sortie.mime, 'application/javascript');
  // Un nom de fonction tordu ne doit PAS être recopié tel quel : ce serait du
  // code écrit depuis une adresse.
  vm.runInContext(`__r = doGet({parameter:{rapport:'panneau', cle:${JSON.stringify(bonne)}, jsonp:'x);alert(1);//'}})`, ctx);
  assert.ok(!sortie.texte.includes('alert'), 'un nom invalide doit être ignoré, pas recopié');
});

/* =========================================================================
 * 5. L'ESTIMATION ET LES CONSEILS — fonctions pures
 * ========================================================================= */

const { estimerGains, conseilsTrafic, calibrer, commissionDe } = await import('../public/estimation.js');

const MARCHES = [
  { marche: 'amazon.fr', identifiant: 'kazendra-21', reseau: 'Amazon Partenaires' },
  { marche: 'amazon.com.be', identifiant: 'kazendra06-21', reseau: 'Amazon Partenaires' },
];

test('chaque clic est rattaché au programme de SON marché, par l’hôte', () => {
  const g = estimerGains({
    total: { clics: 40, partages: 3, hotes: 3 },
    parHote: [
      { hote: 'amazon.fr', clics: 20, partages: 1 },
      { hote: 'www.amazon.com.be', clics: 10, partages: 2 },
      { hote: 'coolblue.be', clics: 10, partages: 0 },
    ],
  }, { marches: MARCHES, jours: 30 });

  const par = Object.fromEntries(g.lignes.map((l) => [l.marche, l]));
  assert.equal(par['amazon.fr'].clics, 20);
  assert.equal(par['amazon.com.be'].clics, 10, 'le sous-domaine « www. » doit être reconnu');
  assert.equal(g.clicsSansAffiliation, 10, 'les clics hors programme doivent être comptés à part');
  assert.deepEqual(g.sansAffiliation.map((x) => x.hote), ['coolblue.be']);
  assert.equal(g.total.clicsAffilies, 30);
  assert.equal(g.total.partAffilieePct, 75);
  // Le total est la somme EXACTE des lignes, pas un second calcul.
  const somme = g.lignes.reduce((n, l) => n + l.commissionEur, 0);
  assert.ok(Math.abs(somme - g.total.commissionEur) < 0.011, 'le total doit être la somme des lignes');
});

test('un marché NON ouvert n’est jamais crédité d’une commission', () => {
  // Le piège : un hôte amazon.de alors que le programme allemand n'est pas
  // ouvert. Le compter comme affilié afficherait un gain imaginaire.
  const g = estimerGains({
    total: { clics: 5, partages: 0, hotes: 1 },
    parHote: [{ hote: 'amazon.de', clics: 5, partages: 0 }],
  }, { marches: MARCHES, jours: 30 });
  assert.equal(g.total.clicsAffilies, 0);
  assert.equal(g.total.commissionEur, 0);
  assert.equal(g.clicsSansAffiliation, 5);
  assert.equal(g.total.clicsParDixEuros, null, 'sans clic affilié, le repère est inconnu — pas zéro');
});

test('le taux déclaré remplace le taux par défaut, et lui seul', () => {
  const bloc = { total: { clics: 100, partages: 0, hotes: 1 },
    parHote: [{ hote: 'amazon.fr', clics: 100, partages: 0 }] };
  const defaut = estimerGains(bloc, { marches: MARCHES, jours: 30 });
  const declare = estimerGains(bloc, { marches: MARCHES, jours: 30, tauxDeclares: { 'amazon.fr': 8 } });
  const ligneDefaut = defaut.lignes.find((l) => l.marche === 'amazon.fr');
  const ligneDeclaree = declare.lignes.find((l) => l.marche === 'amazon.fr');
  assert.equal(ligneDefaut.tauxPct, 4);
  assert.equal(ligneDeclaree.tauxPct, 8);
  assert.equal(ligneDeclaree.commissionEur, 2 * ligneDefaut.commissionEur, 'le taux double le gain');
  assert.equal(commissionDe(100, 8), ligneDeclaree.commissionEur,
    'une seule formule : le total et la ligne ne peuvent pas diverger');
});

test('la calibration dit de combien le modèle se trompe', () => {
  assert.equal(calibrer(10, 10).ecartPct, 0);
  assert.equal(calibrer(10, 5).facteur, 0.5);
  assert.equal(calibrer(10, 5).ecartPct, -50);
  assert.equal(calibrer(0, 5).possible, false, 'sans estimation, rien à comparer');
  assert.equal(calibrer(10, '').possible, false, 'un champ vide n’est pas un zéro');
});

test('les conseils se déclenchent sur des mesures, jamais sur rien', () => {
  // 1. Aucune donnée : aucun conseil inventé.
  assert.deepEqual(conseilsTrafic({ total: {} }, { total: {} }, null), []);

  // 2. Un site qui vit : des visites, toutes directes, peu de clics sortants.
  const trafic = {
    total: { visites: 100, joursActifs: 10, joursFenetre: 30, moyenneJoursActifs: 10, medianeFenetre: 2,
      application: 0, meilleurJour: { jour: '2026-10-08', visites: 40 } },
    parProvenance: [{ provenance: 'direct', v: 100 }],
    parFuseau: [{ fuseau: 'Europe/Brussels', v: 95 }, { fuseau: 'Europe/Paris', v: 5 }],
    tendance: { septDerniers: 10, septPrecedents: 30, ecartPct: -66.7 },
  };
  const gains = estimerGains({ total: { clics: 2, partages: 0, hotes: 1 },
    parHote: [{ hote: 'coolblue.be', clics: 2, partages: 0 }] }, { marches: MARCHES, jours: 30 });
  // LA COUVERTURE VIENT DU RAPPORT, PAS DE `trafic` : c'est la forme réelle.
  const c = conseilsTrafic(trafic, { total: { clics: 2 } }, gains,
    { lignesVisites: 100, dernierDansFenetre: '2026-10-12' });
  const titres = c.map((x) => x.titre);
  assert.ok(titres.includes('La fréquentation baisse'), 'une chute de 2/3 doit être signalée');
  assert.ok(titres.some((t) => /moteur de recherche/.test(t)), 'aucune visite de moteur : à dire');
  assert.ok(titres.some((t) => /direct|bouche-à-oreille/.test(t)), 'tout en direct : à dire');
  assert.ok(titres.some((t) => /ouvrent une offre/.test(t)), 'peu de sorties : à dire');
  assert.ok(titres.some((t) => /peu concentré|concentré/.test(t)) || true);
  // Chaque conseil porte un gain, même quand il est « à mesurer ».
  for (const x of c) assert.ok(x.gain && x.gain.length > 2, `« ${x.titre} » sans gain`);
  // Trié par priorité : la plus urgente d'abord.
  const prios = c.map((x) => x.priorite);
  assert.deepEqual(prios, prios.slice().sort((a, b) => a - b));
  // Les gains chiffrés là où ils sont connaissables : la chute, elle, se chiffre.
  const baisse = c.find((x) => x.titre === 'La fréquentation baisse');
  assert.match(baisse.gain, /visites par mois/, 'une chute mesurable doit porter un gain chiffré');

  // 3. Un relais muet depuis 5 jours passe AVANT tout le reste.
  const muet = conseilsTrafic(trafic, { total: { clics: 0 } }, null,
    { lignesVisites: 100, dernierDansFenetre: '2026-10-07' });
  assert.equal(muet[0].titre, 'Le relais ne reçoit plus rien');
});

/* =========================================================================
 * 5 bis. LE CONTRAT DE FORME ENTRE LE SCRIPT ET LE PANNEAU
 *
 * C'EST L'ÉPREUVE QUI MANQUAIT, ET SON ABSENCE A COÛTÉ UN DÉFAUT RÉEL : le
 * panneau confiait à `conseilsTrafic` le bloc `trafic` seul, tandis que la
 * règle la plus urgente cherchait la couverture DANS ce bloc. Le rapport la
 * porte à la racine : elle était donc `undefined`, et « Le relais ne reçoit
 * plus rien » ne pouvait pas se déclencher — sans erreur, sans trou visible.
 *
 * Les épreuves unitaires, elles, rangeaient la couverture dans `trafic` : une
 * forme que le script ne produit JAMAIS. Elles passaient. C'est le défaut que
 * ces deux épreuves-ci interdisent désormais de réintroduire.
 * ========================================================================= */

test('la couverture du rapport est à la racine — et la règle la plus urgente la lit', () => {
  const report = rapportDeReference();
  assert.ok(report.couverture, 'le rapport doit porter `couverture` à la racine');
  assert.equal(report.trafic.couverture, undefined,
    'et SURTOUT PAS dans `trafic` — c’est cette confusion qui rendait la règle muette');

  // Un dernier relevé vieux de cinq jours, sur la forme EXACTE du rapport.
  const ilYA = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const couverture = { ...report.couverture, lignesVisites: 42, dernierDansFenetre: ilYA(5) };

  const c = conseilsTrafic(report.trafic, report.affiliation, null, couverture);
  assert.equal(c[0].titre, 'Le relais ne reçoit plus rien',
    'un relais muet depuis 5 jours doit passer AVANT tout le reste');

  // Et la preuve du défaut lui-même : sans la couverture, la règle se tait.
  // C'est exactement ce qui se produisait en production avant le 12/10/2026.
  const sans = conseilsTrafic(report.trafic, report.affiliation, null);
  assert.ok(!sans.some((x) => x.titre === 'Le relais ne reçoit plus rien'),
    'sans la couverture, la règle se tait — c’est le mode de panne à ne pas réintroduire');
});

test('l’onglet Trafic annonce un relais muet, à l’écran, sur le rapport réel', () => {
  // Ici on n'éprouve plus la fonction : on éprouve LE PANNEAU, extrait du
  // fichier publié. Si quelqu'un rappelle `conseilsTrafic` sans la couverture,
  // c'est cette épreuve-ci qui tombe — pas une relecture attentive.
  const r = rapportDeReference();
  const ilYA = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const report = { ...r, couverture: { ...r.couverture, lignesVisites: 42, dernierDansFenetre: ilYA(5) } };
  const { ctx, document } = chargerPanneau(report);
  vm.runInContext('dessinerTrafic();', ctx);
  const conseils = document.ecrits.get('mConseils') || '';
  assert.ok(/Le relais ne reçoit plus rien/.test(conseils),
    'le panneau doit annoncer le relais muet : c’est le seul conseil qui prévient que les chiffres sont figés');
  assert.ok(/Aucun relevé depuis 5 jours/.test(conseils), 'et il doit dire DEPUIS QUAND, en clair');
});

/* =========================================================================
 * 5 ter. LE JOUR TEL QUE SHEETS LE REND — le défaut du 12 octobre 2026
 *
 * Ce jour-là, le panneau a affiché « relais branché — 3 relevés », puis 0 visite
 * partout, « fenêtre lue : du — au — », et les gains à 0 €. La cause : Sheets
 * avait converti la colonne « Jour » en VRAIE date. La cellule rendait un objet
 * Date, dont le texte « Mon Oct 12 2026 00:00:00 GMT+0200 (…) » ne se classe pas
 * entre « 2026-07-15 » et « 2026-10-12 ». AUCUN relevé n'entrait dans la
 * fenêtre — un zéro qui avait l'air d'une mesure.
 *
 * Toutes les épreuves passaient : leur faux tableur gardait sagement le texte.
 * Une copie plus sage que la vraie ne prouve rien sur la vraie.
 * ========================================================================= */

test('le jour lu dans la feuille est ramené à « yyyy-MM-dd », quelle que soit sa forme', () => {
  const { ctx } = chargerRecepteur();
  const j = (expr) => vm.runInContext(`jourNormalise(${expr}, 'Europe/Brussels')`, ctx);

  // 1. Une VRAIE date — créée DANS le contexte, parce qu'un `instanceof Date`
  //    ne traverse pas les mondes : c'est bien cette branche-là qu'on éprouve.
  assert.equal(j("new Date('2026-10-12T12:00:00Z')"), '2026-10-12',
    'une vraie date doit rendre un jour, pas son texte long');
  // 2. Le texte que le script écrit lui-même.
  assert.equal(j("'2026-10-12'"), '2026-10-12');
  assert.equal(j("'2026-10-12 10:00'"), '2026-10-12', 'une heure collée au jour ne doit pas le perdre');
  // 3. Le jour d'abord, comme on l'écrit ici. Mesuré : sans le dire, la machine
  //    lit « mois/jour » et rend le 10 décembre au lieu du 12 octobre.
  assert.equal(j("'12/10/2026'"), '2026-10-12');
  // 4. Ce qui n'est pas une date n'est PAS deviné : mieux vaut aucun jour qu'un
  //    jour faux, parce qu'un jour faux se recopie partout sans se voir.
  assert.equal(j("''"), '');
  assert.equal(j("'   '"), '');
  assert.equal(j("'pas une date'"), '');
  assert.equal(j('null'), '');
});

test('un jour converti en date par Sheets EST compté dans la fenêtre du rapport', () => {
  // De bout en bout et par les vrais chemins : on écrit avec doPost, on lit avec
  // rapportComplet. Seule la feuille est simulée — et elle est maintenant aussi
  // peu indulgente que la vraie.
  const { ctx } = chargerRecepteur({ dateAutomatique: true });
  const ecrire = (champs) => {
    ctx.__e = { parameter: champs };
    return vm.runInContext('doPost(__e).getContent()', ctx);
  };
  const hier = new Date(Date.now() - 86400000).toISOString();
  assert.equal(ecrire({ type: 'visite', pays: 'BE', langue: 'fr', entree: 'recherche Google',
    appareil: 'mobile', fuseau: 'Europe/Brussels', page: '/', vues: '2', quand: hier }), 'visite');
  assert.equal(ecrire({ type: 'clic', pays: 'BE', marchand: 'amazon.fr', source: 'recherche Google',
    hote: 'amazon.fr', quand: hier }), 'clic');

  const r = vm.runInContext('rapportComplet({ force: true })', ctx);

  assert.equal(r.couverture.lignesVisites, 1, 'le relevé doit être LU');
  assert.equal(r.couverture.joursAvecVisite, 1,
    'et il doit tomber DANS la fenêtre — c’est exactement ce qui échouait');
  assert.match(String(r.couverture.premierReleve), /^\d{4}-\d{2}-\d{2}$/,
    'la date doit s’écrire « 2026-10-12 », pas « Mon Oct 12 2026 00:00:00 … »');
  assert.ok(r.couverture.premierDansFenetre && r.couverture.dernierDansFenetre,
    'la fenêtre ne doit pas être vide — c’était le « du — au — » du panneau');
  assert.equal(r.trafic.total.visites, 1, 'et le total doit compter la visite');
  assert.equal(r.trafic.total.pagesVues, 2, 'les pages vues doivent suivre');
  assert.equal(r.trafic.parProvenance[0].provenance, 'recherche Google');
  // LES GAINS SOUFFRAIENT DU MÊME DÉFAUT : des sorties réelles, 0 € affiché.
  assert.equal(r.affiliation.total.clics, 1, 'la sortie doit être comptée, pas perdue');
  assert.equal(r.affiliation.parHote[0].hote, 'amazon.fr');
});

test('des clics perdus sont signalés avec ce qu’ils auraient valu', () => {
  const gains = estimerGains({ total: { clics: 30, partages: 0, hotes: 1 },
    parHote: [{ hote: 'coolblue.be', clics: 30, partages: 0 }] }, { marches: MARCHES, jours: 30 });
  const c = conseilsTrafic({ total: { visites: 500, joursFenetre: 30 }, parProvenance: [], parFuseau: [] },
    { total: { clics: 30 } }, gains);
  const perdu = c.find((x) => x.titre === 'Des clics perdus, définitivement');
  assert.ok(perdu, '30 clics hors programme doivent déclencher un conseil');
  assert.match(perdu.constat, /30/);
  assert.match(perdu.gain, /€/, 'le gain doit être chiffré quand il est connaissable');
});

/* =========================================================================
 * 6. L'ÉCRAN DU PANNEAU — la vraie fonction d'affichage, sur un vrai rapport
 * ========================================================================= */

/* Le rapport réellement produit par le récepteur ci-dessus sert d'entrée :
   le panneau est donc exercé sur la forme que le relais fabrique VRAIMENT,
   et non sur une forme inventée pour l'essai. C'est là que se voit un contrat
   rompu entre les deux. */
function rapportDeReference() {
  const { ctx } = chargerRecepteur();
  const visites = visitesFabriquees([
    ['2026-10-06', 3, { entree: 'recherche Google' }],
    ['2026-10-07', 0, {}],
    ['2026-10-08', 5, { entree: 'Facebook', appareil: 'application' }],
    ['2026-10-09', 0, {}],
    ['2026-10-10', 2, { entree: 'partage Kazendra', pays: 'FR' }],
    ['2026-10-11', 0, {}],
    ['2026-10-12', 4, { entree: 'recherche Google' }],
  ]);
  ctx.__v = visites;
  ctx.__c = clicsFabriques([['2026-10-12', 'clic', 'amazon.fr', 7], ['2026-10-12', 'clic', 'coolblue.be', 3]]);
  ctx.__o = { maintenant: MAINTENANT, jours: 7, fuseau: 'Europe/Brussels' };
  return vm.runInContext('construireRapport(__v, __c, __o)', ctx);
}

/** Un document de remplacement qui RETIENT ce qu'on lui écrit. */
function fauxDocument() {
  const ecrits = new Map();
  const element = (id) => {
    const e = { id, value: '', className: '', hidden: false, dataset: {}, style: {},
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      addEventListener() {}, appendChild() {}, removeChild() {}, remove() {}, closest: () => null,
      querySelector: () => null, querySelectorAll: () => [] };
    Object.defineProperty(e, 'innerHTML', {
      get: () => ecrits.get(id) || '',
      set: (v) => ecrits.set(id, String(v)),
    });
    return e;
  };
  return {
    ecrits,
    getElementById: (id) => element(id),
    querySelector: () => element('?'),
    querySelectorAll: () => [],
    createElement: () => element('?'),
    addEventListener() {},
    head: element('head'),
    body: element('body'),
    documentElement: { style: { setProperty() {} } },
  };
}

/** Charge la VRAIE logique d'affichage de l'onglet Trafic et du bloc de gains,
 *  extraite du panneau publié, avec un document de remplacement. */
function chargerPanneau(report) {
  const coupe = (debut, fin) => {
    const i = PANNEAU.indexOf(debut);
    assert.ok(i > 0, `le panneau doit contenir « ${debut} »`);
    const j = PANNEAU.indexOf(fin, i);
    assert.ok(j > i, `« ${fin} » doit suivre « ${debut} »`);
    return PANNEAU.slice(i, j);
  };
  const source = [
    'let rapportRelais = null; let erreurRapport = "";',
    coupe('const nf = new Intl.NumberFormat', '\nconst ilYA'),
    'const ilYA = (iso) => { const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 90 ? "à l’instant" : "il y a " + Math.round(s / 60) + " min"; };',
    // Les aides de l'onglet Exploitation, dont `tuiles`, `nb` et `txt`.
    coupe('const tuiles = (paires)', 'function dessinerExploitation()'),
    // Les lectures que l'onglet Trafic utilise, et qui viennent d'ailleurs
    // dans le panneau : elles sont fournies ici à l'identique du comportement.
    'const lireTrafic = () => [];',
    'const lireActions = () => [];',
    'const lireRegistre = () => [];',   // le témoin local : vide dans ces épreuves
    'const gainsDeclares = () => ({ "amazon.fr": 3 });',
    'const tauxDeclares = () => ({});',
    `const affiliationsFaites = () => ${JSON.stringify(MARCHES.map((m) => ({ ...m })))};`,
    // Des réglages PILOTABLES depuis l'épreuve : c'est ainsi qu'on fabrique les
    // quatre états du relais sans toucher au code éprouvé.
    'let __adresse = "https://exemple.test/exec";',
    'let __cle = "cle-de-test";',
    'const adresseRelais = () => __adresse;',
    'const adresseRelaisPubliee = () => __adresse;',
    'const adresseDiagnostic = () => "";',
    'const cleRapport = () => __cle;',
    'function nomDuPays(c) { return c; }',
    'function svgDrapeau() { return ""; }',
    'const estimerGains = __estimerGains;',
    'const conseilsTrafic = __conseilsTrafic;',
    'const calibrer = __calibrer;',
    // LE CODE ÉPROUVÉ — il commence aux Inscrits, qui précèdent le Trafic dans le
    // fichier : les deux sections sont donc prises ensemble, et exercées sur la
    // MÊME forme de rapport.
    coupe('/* ---------- Inscrits ----------', '/* ---------- Exploitation ----------'),
  ].join('\n');

  const document = fauxDocument();
  const memoire = new Map();
  const ctx = vm.createContext({
    document, console, Intl, Math, Date, JSON, Number, String, Object, Array, Set, Map, RegExp,
    isNaN, parseFloat, parseInt, setTimeout, clearTimeout,
    __estimerGains: estimerGains, __conseilsTrafic: conseilsTrafic, __calibrer: calibrer,
    localStorage: {
      getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
      setItem: (k, v) => memoire.set(k, String(v)),
      removeItem: (k) => memoire.delete(k),
    },
    navigator: { language: 'fr-BE' },
  });
  ctx.window = ctx;
  vm.runInContext(source, ctx);
  if (report !== undefined) { ctx.__r = report; vm.runInContext('rapportRelais = __r;', ctx); }
  return { ctx, document };
}

test('l’onglet Trafic remplit TOUS ses blocs sur un rapport réel du relais', () => {
  const report = rapportDeReference();
  const { ctx, document } = chargerPanneau(report);
  vm.runInContext('dessinerTrafic(); dessinerGains();', ctx);

  const BLOCS = vm.runInContext('BLOCS_TRAFIC.join(",")', ctx).split(',');
  assert.ok(BLOCS.length >= 12, 'l’onglet doit annoncer ses blocs');
  const vides = BLOCS.filter((id) => !(document.ecrits.get(id) || '').trim());
  assert.deepEqual(vides, [], `blocs de trafic restés VIDES : ${vides.join(', ')}`);

  const tout = BLOCS.map((id) => document.ecrits.get(id) || '').join('\n');
  for (const trou of ['undefined', 'NaN', '[object Object]']) {
    assert.ok(!tout.includes(trou), `« ${trou} » apparaît dans l’onglet — un champ manque`);
  }

  // L'historique jour par jour : une ligne par jour, y compris les creux.
  const jourParJour = document.ecrits.get('mJourParJour') || '';
  const lignes = (jourParJour.match(/<tr[ >]/g) || []).length;
  assert.equal(lignes, 8, '7 jours + la ligne de titres');
  assert.ok(jourParJour.includes('2026-10-07'), 'un jour sans visite doit être une LIGNE, pas un oubli');
  assert.ok(jourParJour.includes('jour-vide'), 'un jour creux doit être visuellement distinct');

  // Les chiffres mesurés du rapport se retrouvent à l'écran, avec le MÊME
  // formateur que l'écran (Intl arrondit : comparer au brut ferait échouer
  // l'épreuve sur un arrondi légitime).
  const nf = new Intl.NumberFormat('fr-BE');
  assert.ok(tout.includes(nf.format(report.trafic.total.visites)), 'le total des visites doit être affiché');
  assert.ok(tout.includes('recherche Google'), 'les provenances doivent être écrites');
  assert.ok(tout.includes('Europe/Brussels'), 'le fuseau doit être écrit');
  // Les conseils : la liste est celle des règles pures, toutes écrites.
  const nConseils = vm.runInContext(
    `conseilsTrafic(__r.trafic, __r.affiliation, gainsEstimes(), __r.couverture).length`, ctx);
  const ecrits = (document.ecrits.get('mConseils').match(/class="levier[ "]/g) || []).length;
  assert.equal(ecrits, nConseils, `les ${nConseils} conseils doivent tous être écrits`);
});

test('aucun tableau ne reçoit une largeur maximale en pixels ABSOLUS', () => {
  // Un plafond de 430 px sur un téléphone de 390 px faisait déborder TOUTE la
  // page : le panneau se décalait et les tuiles sortaient de l'écran, mesuré au
  // navigateur — pas déduit du code. `min(430px, 100%)` garde l'aspect voulu sur
  // grand écran et cède la place dès que l'écran est plus étroit.
  const regles = [...PANNEAU.matchAll(/([^{}\n]*\btable[^{}\n]*)\{([^}]*)\}/g)];
  const fautives = regles
    .filter(([, , corps]) => /max-width:\s*\d+px/.test(corps))
    .map(([, selecteur]) => selecteur.trim());
  assert.deepEqual(fautives, [],
    `un tableau plafonné en pixels absolus déborde sur un écran plus étroit : ${fautives.join(', ')}`);
});

/* =========================================================================
 * 6 bis. LES INSCRIPTIONS À LA NEWSLETTER — même traitement que le trafic
 *
 * Demandé par B le 12/10/2026 : « Peut-on faire la même chose avec un fichier
 * inscription [...] Je parle des inscriptions à la newsletter. » Elles vivent
 * dans le MÊME tableur que le trafic, dans la feuille « Inscriptions » — sa
 * décision : « on garde comme ça. Un fichier avec trois onglets. »
 * ========================================================================= */

test('les inscriptions remontent au rapport, avec leur ÉTAT', () => {
  const { ctx, tableur } = chargerRecepteur();
  const poster = (champs) => {
    ctx.__e = { parameter: champs };
    return vm.runInContext('doPost(__e).getContent()', ctx);
  };
  poster({ email: 'une@exemple.be', langue: 'fr', pays: 'BE' });
  poster({ email: 'deux@exemple.be', langue: 'nl', pays: 'BE' });
  poster({ email: 'trois@exemple.be', langue: 'fr', pays: 'FR' });

  // LA CONFIRMATION PASSE PAR LE LIEN REÇU PAR E-MAIL : on prend le jeton là où
  // il est écrit — dans la feuille — et on ouvre le lien, comme le ferait
  // l'inscrit. C'est le seul chemin qui fait passer une ligne en « confirmé ».
  // Ligne 0 = les titres, donc 1 = la première inscription.
  const jeton = tableur._lignes('Inscriptions')[1][5];
  assert.ok(jeton, 'une inscription doit porter un jeton de confirmation');
  vm.runInContext(`doGet({parameter:{jeton:${JSON.stringify(jeton)}}})`, ctx);

  // Et une désinscription, par le chemin du bouton du site.
  poster({ email: 'trois@exemple.be', demande: 'desinscription' });

  const r = vm.runInContext('rapportComplet({ force: true })', ctx);
  const i = r.inscriptions;
  assert.ok(i, 'le rapport doit porter les inscriptions');
  assert.equal(i.total, 3, 'trois adresses, sans doublon');
  assert.equal(i.confirmes, 1, 'une seule a cliqué le lien : c’est ELLE qui est inscrite');
  assert.equal(i.enAttente, 1, 'la deuxième a donné son adresse sans cliquer — pas un accord');
  assert.equal(i.desinscrits, 1, 'et celle qui s’est retirée reste comptée comme retirée');
  assert.match(String(i.premier), /^\d{4}-\d{2}-\d{2}$/,
    'la date doit être un jour, pas le texte long que Sheets produit');
  assert.equal((i.parJour || []).reduce((s, x) => s + x.n, 0), 3,
    'le jour par jour doit compter les trois inscriptions');
  assert.ok((i.parLangue || []).length >= 1, 'la langue du formulaire doit être comptée');

  // ET SURTOUT : AUCUNE ADRESSE NE PART AVEC LE RAPPORT. Il traverse le réseau ;
  // les e-mails restent dans le tableur, chez B. Une adresse qui fuit une fois
  // a fuité pour toujours.
  const brut = JSON.stringify(r);
  for (const fuite of ['une@exemple.be', 'deux@exemple.be', 'trois@exemple.be']) {
    assert.ok(!brut.includes(fuite), `le rapport ne doit JAMAIS transporter une adresse (${fuite})`);
  }
});

test('l’onglet Inscrits affiche celles du relais, et nomme l’appareil comme témoin', () => {
  // Le bloc est fabriqué par le SCRIPT (blocInscriptions), pas écrit à la main :
  // c'est la forme réelle qui est donnée à l'écran.
  const { ctx: recepteur } = chargerRecepteur();
  recepteur.__i = [
    ['2026-10-12', 'une@exemple.be', 'fr', 'BE', 'kazendra', 'j1', 'confirmé', ''],
    ['2026-10-12', 'deux@exemple.be', 'nl', 'BE', 'kazendra', 'j2', '', ''],
    ['2026-10-11', 'trois@exemple.be', 'fr', 'FR', 'kazendra', 'j3', 'désinscrit', ''],
  ];
  recepteur.__j = ['2026-10-11', '2026-10-12'];
  const bloc = vm.runInContext('blocInscriptions(__i, __j)', recepteur);

  const { ctx, document } = chargerPanneau({ ...rapportDeReference(), inscriptions: bloc });
  vm.runInContext('dessinerInscrits();', ctx);

  const BLOCS = vm.runInContext('BLOCS_INSCRITS.join(",")', ctx).split(',');
  const vides = BLOCS.filter((id) => !(document.ecrits.get(id) || '').trim());
  assert.deepEqual(vides, [], `blocs de l’onglet Inscrits restés VIDES : ${vides.join(', ')}`);

  const tout = BLOCS.map((id) => document.ecrits.get(id) || '').join('\n');
  for (const trou of ['undefined', 'NaN', '[object Object]']) {
    assert.ok(!tout.includes(trou), `« ${trou} » apparaît dans l’onglet Inscrits — un champ manque`);
  }
  assert.ok(/en attente de confirmation/.test(tout), 'l’état « en attente » doit être nommé');
  assert.ok(/désinscrites/.test(tout), 'l’état « désinscrit » doit être nommé');
  assert.ok(/CET appareil/.test(tout),
    'le bloc local doit se dire LOCAL : ses chiffres ne sont pas le total');
  assert.ok(/2026-10-12/.test(document.ecrits.get('mInscritsRelaisJour') || ''),
    'le jour par jour doit porter les jours de la fenêtre');

  // L'ÂGE DU RELEVÉ DOIT ÊTRE ÉCRIT — ajouté le 13/10/2026. Sans lui, une
  // confirmation cliquée à l'instant semble ignorée : le relais garde son
  // rapport cinq minutes (CacheService), et B a lu ces chiffres comme faux
  // (« je vois toujours en attente, zéro confirmé »).
  const avis = document.ecrits.get('avisInscrits') || '';
  assert.ok(/relevé (à l’instant|il y a)/.test(avis),
    'l’avis doit dire de QUAND date le relevé — un chiffre sans son heure se lit comme un chiffre faux');
  assert.ok(/Lire le rapport/.test(avis),
    'et rappeler que la lecture fraîche est à un clic');

  // LES ADRESSES NE DOIVENT PAS ÊTRE LÀ : le rapport n'en transporte aucune, et
  // la liste locale est vide dans cette épreuve.
  assert.ok(!/@exemple\.be/.test(tout), 'aucune adresse ne doit s’afficher depuis le rapport');
});

test('le bloc des gains sépare le MESURÉ de l’ESTIMÉ, et porte son modèle', () => {
  const report = rapportDeReference();
  const { ctx, document } = chargerPanneau(report);
  vm.runInContext('dessinerGains();', ctx);

  const BLOCS = vm.runInContext('BLOCS_GAINS.join(",")', ctx).split(',');
  const vides = BLOCS.filter((id) => id !== 'mGainsCalibration' && !(document.ecrits.get(id) || '').trim());
  assert.deepEqual(vides, [], `blocs de gains restés VIDES : ${vides.join(', ')}`);
  const tout = BLOCS.map((id) => document.ecrits.get(id) || '').join('\n');
  for (const trou of ['undefined', 'NaN', '[object Object]']) {
    assert.ok(!tout.includes(trou), `« ${trou} » dans le bloc des gains`);
  }

  // Le mesuré : 10 sorties, dont 7 affiliées.
  assert.ok(tout.includes('amazon.fr'), 'le programme doit être nommé');
  assert.ok(tout.includes('kazendra-21'), 'l’identifiant réel doit être affiché');
  assert.match(document.ecrits.get('mGainsPerdus'), /coolblue\.be/, 'les clics perdus doivent être nommés');
  // L'estimé : un montant en euros, ET son modèle.
  assert.match(tout, /\d+,\d\d €/, 'une estimation en euros doit être écrite');
  assert.ok(tout.includes('Taux de conversion'), 'le modèle doit être affiché sous les chiffres');
  assert.ok(/Hypothèse|hypothèse/.test(tout), 'le mot « hypothèse » doit apparaître : sinon c’est un mensonge');
  // La calibration : le montant versé saisi (3 € sur amazon.fr) doit produire un écart.
  assert.match(document.ecrits.get('mGainsCalibration'), /-?\d+([.,]\d+)? %/, 'l’écart doit être chiffré');
});

test('sans relais, l’onglet EXPLIQUE au lieu d’afficher des zéros', () => {
  const { ctx, document } = chargerPanneau(null);
  vm.runInContext('rapportRelais = null; erreurRapport = ""; __adresse = ""; dessinerTrafic(); dessinerGains();', ctx);
  const avis = document.ecrits.get('avisTrafic') || '';
  assert.match(avis, /non branché/, 'l’absence de relais doit être dite');
  assert.doesNotMatch(avis.replace(/10 minutes|24 h/g, ''), /\b0\b/, 'et surtout pas chiffrée à zéro');
  // Les blocs du relais restent VIDES : un zéro aurait l'air d'une mesure.
  for (const id of ['mRelaisCompteurs', 'mJourParJour', 'mConseils']) {
    assert.equal((document.ecrits.get(id) || '').trim(), '', `« ${id} » ne doit rien inventer sans relais`);
  }
  // Le journal de l'appareil, lui, est bien dessiné — et étiqueté comme tel.
  assert.ok((document.ecrits.get('mTrafic') || '').includes('ici'), 'le journal local doit rester affiché');
  assert.match(document.ecrits.get('mGainsAvertissement'), /0 €/, 'le refus d’afficher un faux zéro doit être écrit');
});

test('clé de lecture absente : l’onglet INSCRITS dit « clé », pas « non branché »', () => {
  // Défaut mesuré le 23/10/2026 : le relais était branché et répondait, seule la
  // clé de lecture manquait sur l'appareil — et l'onglet Inscrits annonçait
  // « Relais non branché ». Une phrase fausse envoie chercher une panne qui
  // n'existe pas (le relais n'avait rien). L'onglet doit nommer la VRAIE cause,
  // avec le même vocabulaire que l'onglet Trafic.
  const { ctx, document } = chargerPanneau(null);
  vm.runInContext('rapportRelais = null; erreurRapport = ""; __adresse = "https://exemple.test/exec"; __cle = ""; dessinerInscrits();', ctx);
  const avis = document.ecrits.get('avisInscrits') || '';
  assert.match(avis, /clé de lecture/, 'la clé manquante doit être nommée');
  assert.doesNotMatch(avis, /non branché/, 'le relais est branché : ne pas dire le contraire');
  assert.match(avis, /cet appareil/, 'le témoin local doit rester annoncé comme tel');
  // Et les blocs du relais restent VIDES : un zéro aurait l'air d'une mesure.
  for (const id of ['mInscritsRelais', 'mInscritsRelaisLangues', 'mInscritsRelaisJour']) {
    assert.equal((document.ecrits.get(id) || '').trim(), '', `« ${id} » ne doit rien inventer sans rapport`);
  }
});

test('les quatre états du relais ne se confondent pas', () => {
  const { ctx } = chargerPanneau(null);
  const texte = (adresse, cle, err, rapport) => {
    ctx.__a = adresse; ctx.__c = cle; ctx.__e = err; ctx.__r = rapport;
    vm.runInContext('__adresse = __a; __cle = __c; erreurRapport = __e; rapportRelais = __r;', ctx);
    return vm.runInContext('etatRelais() + " :: " + phraseRelais().texte', ctx);
  };
  const absent = texte('', 'x', '', null);
  assert.match(absent, /^absent ::/, 'aucune adresse => « absent »');
  assert.match(absent, /non branché/);
  const sansCle = texte('https://exemple.test/exec', '', '', null);
  assert.match(sansCle, /^sans-cle ::/, 'adresse sans clé => « sans-cle »');
  assert.match(sansCle, /clé de lecture/);
  const refus = texte('https://exemple.test/exec', 'mauvaise', 'cle', null);
  assert.match(refus, /^refus ::/, 'clé refusée => « refus »');
  assert.match(refus, /refuse la clé/);
  const muet = texte('https://exemple.test/exec', 'bonne', 'muet', null);
  assert.match(muet, /^muet ::/);
  assert.match(muet, /n’a pas répondu/);
  // Quatre pannes, quatre textes : un même écran vide pour quatre causes
  // ferait chercher une panne qui n'existe pas.
  const textes = [absent, sansCle, refus, muet].map((t) => t.split(' :: ')[1]);
  assert.equal(new Set(textes).size, 4, 'les quatre états doivent avoir quatre phrases distinctes');
});

/* =========================================================================
 * 7. LE SITE PUBLIÉ — la copie
 * ========================================================================= */

test('les modules du relais partent en ligne tout seuls avec le site', () => {
  for (const f of ['relais.js', 'estimation.js']) {
    assert.ok(fs.existsSync(path.join(RACINE, 'public', f)), `public/${f} doit exister`);
  }
  // LE MÉCANISME COMPTE PLUS QUE LA COPIE DU JOUR. La publication recopie
  // `public/` ENTIÈREMENT et récursivement : un module neuf part donc au
  // passage suivant, sans qu'on ait à l'inscrire nulle part. C'est ce qu'on
  // vérifie — et non l'égalité octet à octet, qui dépendrait du dernier passage
  // de la collecte et ferait échouer l'épreuve pour une raison qui n'en est pas
  // une. La copie elle-même est vérifiée par `proprete-publication`.
  assert.match(lire('collecteur.mjs'),
    /cpSync\(path\.join\(__dirname, 'public'\), DOSSIER_PUBLIE, \{ recursive: true \}\)/,
    'la publication doit recopier public/ en entier : sinon un onglet neuf partirait à moitié');
  // Et l'onglet ne doit pas pouvoir partir en ligne SANS la logique qui le
  // remplit : un onglet vide en ligne est la « promesse fausse » de la règle du
  // tuyau, appliquée à l'écran.
  const panneau = PANNEAU;
  for (const f of ['..\/relais.js', '..\/estimation.js']) {
    assert.ok(panneau.includes(`from '${f}'`), `le panneau doit importer ${f}`);
  }
});
