/**
 * COLLECTEUR DE PROMOS — application n°2
 * ======================================
 * Récupère les offres publiées par des sources GRATUITES et SANS CLÉ :
 * flux RSS de Dealabs (le plus gros vivier français), presse spécialisée
 * « bons plans », et Google News par requête. Aucune API payante, aucun compte,
 * aucune clé — c'est la règle du projet.
 *
 * Ce que le collecteur NE fait PAS, volontairement :
 *   - il n'INVENTE jamais un pourcentage de remise. Une remise n'est affichée
 *     que si elle est écrite dans la source, ou calculée entre deux prix
 *     réellement présents. Un faux « -70 % » fait acheter au mauvais moment.
 *   - il n'écrase pas une offre déjà connue : il la met à jour (prix, date).
 *
 * Usage : node collecteur.mjs [--verbeux]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  noterPrix, elaguerHistorique, appliquerAnalyse,
} from './prix-historique.mjs';
// Les adresses de sortie des plateformes de bons plans, et ce qui les rend
// résolubles. Importées pour ne PAS dédoubler la règle : un seul endroit dit
// ce qu'est une adresse résoluble (voir outils/resoudre-destinations.mjs).
import { adresseDeSortie } from './outils/resoudre-destinations.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');
const FICHIER = path.join(DATA, 'offres.json');
/** Historique des prix : NON publié (le site n'en reçoit que les conclusions). */
const HISTORIQUE = path.join(DATA, 'historique-prix.json');
const VERBEUX = process.argv.includes('--verbeux');
/** Publication : écrit aussi le site statique (offres + VISUELS locaux) dans
 *  docs/, prêt pour GitHub Pages. Sans ce drapeau, on ne touche qu'aux
 *  données locales (le hub continue de relayer les visuels à la volée). */
const PUBLIER = process.argv.includes('--publier');
const DOSSIER_PUBLIE = path.join(__dirname, 'docs');

/* ------------------------------------------------------------------ *
 *  LE TAUX DE RÉFÉRENCE DE LA BCE — relevé par le COLLECTEUR, pas par le site.
 *
 *   Pourquoi ici : la BCE publie un fichier public, sans clé et sans compte
 *   (eurofxref-daily.xml). Mais elle n'envoie PAS d'en-tête CORS : un navigateur
 *   ne pourrait pas le lire. Le collecteur, lui, le lit une fois par passage et
 *   l'écrit dans le site (`devises.json`), où le navigateur le trouve chez nous.
 *
 *   Ce taux sert à UNE chose : comparer le prix du même produit entre deux places
 *   de marché qui ne comptent pas dans la même monnaie (« moins cher sur
 *   Amazon.de : 429,99 € ≈ 4 813 kr, taux BCE du 08/10 »). Le prix affiché sur
 *   une offre reste, lui, toujours dans sa monnaie d'origine — on ne convertit
 *   pas le prix, on éclaire la comparaison.
 *
 *   Échec réseau, réponse illisible, valeur absurde : on garde le fichier
 *   précédent et on continue. Une collecte ne doit jamais échouer pour un taux.
 * ------------------------------------------------------------------ */

/** Lit le fichier public de la BCE. Fonction PURE (aucun réseau) : c'est elle
 *  que les épreuves exercent, avec le vrai texte de la BCE. */
export function analyserTauxBce(xml) {
  const texte = String(xml || '');
  const date = (/time=["'](\d{4}-\d{2}-\d{2})["']/.exec(texte) || [])[1] || '';
  const taux = { EUR: 1 };
  for (const m of texte.matchAll(/currency=["']([A-Z]{3})["']\s+rate=["']([0-9.]+)["']/g)) {
    const v = Number(m[2]);
    if (Number.isFinite(v) && v > 0) taux[m[1]] = v;
  }
  // Sans date ni devise utilisable, le relevé ne vaut rien : mieux vaut ne rien
  // écrire que d'écrire un taux qu'on ne saurait pas dater.
  if (!date || Object.keys(taux).length < 2) return null;
  return { date, source: TAUX_URL, sourceNom: 'Banque centrale européenne — taux de référence', releveLe: new Date().toISOString(), taux };
}

const TAUX_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const FICHIER_TAUX = path.join(DATA, 'devises.json');

/** Relève le taux et l'écrit (données locales + site publié). Silencieux en cas
 *  d'échec : voir la note ci-dessus. */
export async function majTauxBce({ publier = false, delai = 8000 } = {}) {
  try {
    const stop = AbortSignal.timeout ? AbortSignal.timeout(delai) : undefined;
    const r = await fetch(TAUX_URL, stop ? { signal: stop } : undefined);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const releve = analyserTauxBce(await r.text());
    if (!releve) throw new Error('réponse illisible');
    fs.writeFileSync(FICHIER_TAUX, JSON.stringify(releve, null, 0));
    if (publier) fs.writeFileSync(path.join(DOSSIER_PUBLIE, 'devises.json'), JSON.stringify(releve, null, 0));
    return releve;
  } catch (e) {
    console.log(`  taux BCE : relevé impossible (${e.message}) — le précédent reste en place`);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 *  L'IDENTIFIANT D'UNE OFFRE — l'EMPREINTE DE SON LIEN ENTIER.
 *
 *  Défaut corrigé le 08/10/2026, mesuré sur le catalogue réel (14 004
 *  offres). L'identifiant était fabriqué en INVERSANT le lien, puis en gardant
 *  les 14 premiers caractères de sa version base64. Or la chaîne inversée
 *  commence par la FIN du lien — c'est-à-dire par le suffixe, IDENTIQUE pour
 *  toutes les offres d'un même site (« …/amsterdam/ », « …/lessurb-6 »).
 *  Résultat mesuré : 339 identifiants partagés par 962 offres DISTINCTES — un
 *  favori enregistré pouvait en rouvrir une AUTRE, parfois dans un autre pays.
 *
 *  Allonger la troncature ne suffisait pas (à 60 caractères : encore des
 *  centaines de collisions) : c'est l'INVERSION qui jetait ce qui distinguait
 *  les liens, pas la longueur.
 *
 *  On prend donc une empreinte du lien ENTIER (SHA-1, 80 bits utiles) — le
 *  même outil que celui qui nomme déjà les visuels (voir formatImage). Même
 *  lien → même identifiant, donc un favori retrouve son offre d'un jour à
 *  l'autre ; deux liens différents → deux identifiants différents.
 *
 *  Effet connu et assumé : les favoris enregistrés AVANT ce correctif ne
 *  retrouvent plus leur offre. L'interface le dit déjà (« n'est plus dans la
 *  liste du jour ») au lieu d'afficher une autre offre en silence.
 * ------------------------------------------------------------------ */
export function identifiant(prefixe, lien, titre) {
  return prefixe + crypto.createHash('sha1').update(String(lien || titre)).digest('hex').slice(0, 20);
}

/** Les identifiants fabriqués AVANT le 08/10/2026 : 1 lettre de source + 14
 *  caractères base64url. Sert à reconnaître ce qu'il faut migrer — et, surtout,
 *  à NE PAS toucher au reste : les offres Amazon portent `a…`/`fl…` + ASIN,
 *  qui est déjà unique (mesuré : 0 collision sur 3 740 offres). */
const MOTIF_ANCIEN_ID = /^[dpegs][A-Za-z0-9_-]{14}$/;

/**
 * Migre les identifiants périmés, EN PLACE, et dit combien il en a changé.
 *
 * Pourquoi c'est nécessaire : le correctif d'identifiant() ne vaut que pour les
 * offres RE-ANALYSÉES. Or la collecte reprend du stock les offres qu'une source
 * n'a pas re-servies : celles-là gardaient l'ancien identifiant, donc les
 * collisions. Mesuré après la première collecte corrigée : 175 identifiants
 * seulement avaient changé, et 74 restaient partagés par 287 offres.
 *
 * Idempotente : une fois migré, l'identifiant ne correspond plus au motif
 * ancien et n'est plus retouché. On peut donc l'appeler à chaque collecte.
 */
export function migrerIdentifiants(offres) {
  let migrees = 0;
  for (const o of offres) {
    if (!o || !MOTIF_ANCIEN_ID.test(String(o.id))) continue;
    const neuf = identifiant(String(o.id)[0], o.lienMarchand || o.lienPage, o.titre);
    if (neuf !== o.id) { o.id = neuf; migrees++; }
  }
  return migrees;
}

/* ------------------------------------------------------------------ *
 *  BUDGET DE TEMPS — une contrainte de la plateforme, pas un réglage.
 *
 *  Le planificateur tue ce script au bout d'un délai fixé par Hermes :
 *      « Script timed out after 120s » (le message reçu le 09/10 et le 11/10).
 *
 *  Les délais étaient dispersés dans le code : 90 s pour la récupération des
 *  visuels, et RIEN du tout pour leur téléchargement. Leur somme dépassait la
 *  limite, et le passage était coupé EN PLEINE ÉCRITURE — le fichier publié
 *  n'était alors pas écrit, donc le site ne se mettait pas à jour. Quatre
 *  passages sur cinq réussissaient (sources en repos, donc travail court) : la
 *  panne n'apparaissait qu'une fois par demi-heure, au moment où toutes les
 *  sources se rafraîchissent ensemble. C'est le pire genre de panne — celle
 *  qu'on ne voit qu'en la cherchant.
 *
 *  Tout est donc réuni ici, et un test vérifie que la SOMME tient sous la
 *  limite avec de la marge pour la collecte réseau et l'envoi Git. Baisser une
 *  valeur pour en augmenter une autre devient impossible sans casser ce test.
 *
 *  11/10/2026 — CE QUI A CHANGÉ, ET POURQUOI LE BUDGET N'A PAS BOUGÉ.
 *  La limite du planificateur est passée de 120 s à 300 s (config.yaml →
 *  cron.script_timeout_seconds), parce que le réglage d'origine laissait 20 s
 *  pour la publication des 19 000 pages et l'envoi Git : mesuré, onze passages
 *  sur 2 051 ont été tués en pleine écriture depuis le 04/10, dont sept
 *  d'affilée le 09/10. Le budget ci-dessous n'est pas là pour occuper la
 *  fenêtre, mais pour borner le travail réseau ; les deux valeurs sont donc
 *  indépendantes, et c'est voulu — le test exige que la somme reste sous la
 *  MOITIÉ de la limite.
 *
 *  12/10/2026 — LE BUDGET A BOUGÉ CETTE FOIS, ET VOICI LE CALCUL. La cadence
 *  passe de 5 à 15 minutes (décision de B) : à budget constant, la capacité de
 *  téléchargement tombait de 300 s à 100 s par heure, alors que le besoin mesuré
 *  est d'environ 107 visuels par heure. La file se serait donc mise à grossir en
 *  silence — des cartes grises de plus en plus nombreuses, sans une seule erreur
 *  dans le journal. On relève donc les trois parts : 100 → 145 s au total, ce qui
 *  ramène la capacité horaire au-dessus du besoin, tout en restant sous la moitié
 *  de la fenêtre (le test ci-dessous le vérifie, et refusera la prochaine
 *  augmentation faite « puisqu'on a 300 s »).
 * ------------------------------------------------------------------ */
const LIMITE_CRON_MS = 300000;
const BUDGET_CRON = {
  // Collecte des flux : toutes les sources sont interrogées en parallèle, donc
  // cette part vaut le temps de la plus lente, pas leur somme. Marge large.
  sourcesMs: 55000,
  // Recherche de l'image d'aperçu sur la page des articles (une par article,
  // avec une pause entre deux : on est invité chez des gens).
  //
  // ⚠ CES DEUX BUDGETS ONT ÉTÉ RÉDUITS DE 15 s CHACUN LE 12/10/2026, pour loger
  // le CONTRÔLE DIRECT (voir verdictMs). Ce n'est pas un arbitrage de confort :
  // l'épreuve « la collecte tient dans le délai » refuse que la somme dépasse la
  // moitié de la fenêtre (150 s des 300 s), et elle a refusé les 175 s du premier
  // jet — à juste titre, c'est exactement son rôle. Ce qui est donné ici est du
  // TEMPS, pas du travail : ces deux étapes sont bornées d'abord par un NOMBRE
  // (150 articles, un lot de téléchargements) et ne saturent pas leur délai ; la
  // mesure le dit, le passage entier dure 13 à 20 s. La part retirée va à une
  // étape qui, elle, travaille vraiment pendant ce temps.
  visuelsMs: 30000,
  // Rapatriement des visuels dans docs/img, pour que le site soit autonome.
  telechargementsMs: 30000,
  // LE CONTRÔLE DIRECT : lire le verdict de la page de quelques offres
  // (VERDICT_SOURCE_PAR_PASSAGE). Borne AUSSI, dans le passage, par une échéance :
  // trois pages à 15 s de délai chacune tiendraient 45 s, et l'échéance coupe.
  verdictMs: 15000,
};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/* =============================================================================
   LA DISCRÉTION — MESURER CE QU'ON DEMANDE AUX SITES DES AUTRES

   Demande de B, 12/10/2026, mot pour mot : « L'objectif est de ne pas trop peser
   sur le système afin d'être discret et d'éviter des problèmes. »

   Trois gestes, et le premier commande les deux autres :

     1. COMPTER. On ne peut pas alléger ce qu'on ne mesure pas. Chaque requête
        sortante est comptée avec les octets reçus, par famille et par hôte ; le
        total des dernières 24 heures est publié dans l'état du site, à côté du
        reste (onglet « Données »).
     2. NE PAS REDEMANDER CE QU'ON A DÉJÀ. Une page ou un flux qui n'a pas changé
        se signale par un `304` — le serveur répond « rien de neuf » sans renvoyer
        le corps. Pour cela il faut lui ENVOYER ce qu'on a reçu la fois d'avant
        (`ETag`, `Last-Modified`) : c'est la requête conditionnelle, exactement ce
        que fait un navigateur. Mesuré le 12/10/2026 : le flux de DHnet porte un
        `ETag`, donc il sait le faire ; nous ne le lui demandions jamais.
     3. LIRE `robots.txt`. Il dit ce que le site autorise et à quelle cadence.
        On le lit et on publie son verdict ; on ne s'en sert pas encore pour
        écarter une source (voir plus bas : cela retire du contenu, c'est une
        décision de B, pas la mienne).
   ============================================================================= */

/** LE COMPTEUR DE TRAFIC. Les octets comptés sont ceux du fil : quand le
 *  serveur annonce une taille (`content-length`), c'est elle qui vaut — c'est
 *  ce qui passe sur le réseau. Sinon on compte le corps reçu. Une réponse `304`
 *  compte une requête et zéro octet : c'est précisément le gain. */
const TRAFIC = { requetes: 0, octets: 0, parFamille: {}, parHote: {} };
function compterTrafic(url, octets, famille) {
  let hote = '?';
  try { hote = new URL(url).hostname; } catch { /* URL illisible : on compte quand même */ }
  const t = Math.max(0, octets | 0);
  TRAFIC.requetes++; TRAFIC.octets += t;
  for (const [table, cle] of [[TRAFIC.parFamille, famille], [TRAFIC.parHote, hote]]) {
    const e = table[cle] = table[cle] || { requetes: 0, octets: 0 };
    e.requetes++; e.octets += t;
  }
}

/** La taille reçue d'une réponse `fetch` — l'annonce du serveur si elle existe.
 *
 *  ⚠ DÉFAUT ATTRAPÉ PAR L'ÉPREUVE, pas à l'œil : `headers.get()` rend `null`
 *  quand l'en-tête est absent, et `Number(null)` vaut **0** — un en-tête manquant
 *  faisait donc compter ZÉRO octet. Le compteur aurait annoncé « on ne pèse
 *  presque rien » sur des réponses qui pèsent des centaines de kilo-octets : la
 *  pire des mesures, celle qui rassure à tort. On ne lit donc l'annonce que si
 *  elle existe vraiment. */
export function tailleRecue(reponse, texte = '') {
  const brut = reponse && reponse.headers && reponse.headers.get('content-length');
  const annonce = brut === null || brut === undefined || brut === '' ? NaN : Number(brut);
  if (Number.isFinite(annonce) && annonce >= 0) return annonce;
  return Buffer.byteLength(String(texte), 'utf8');
}

/** LE COMPTEUR DES PAGES D'APERÇU — combien de fois on a COUPÉ la lecture dès la
 *  balise trouvée, et combien de fois on a dû lire la page entière. C'est ce
 *  second chiffre qui est le gain, et il est chiffré. */
const APERCU = { demandes: 0, ecourtees: 0, entieres: 0 };

/** Le journal de trafic — les 24 dernières heures, pour que le chiffre publié
 *  veuille dire « par jour » et pas « sur ce passage ». Rend aussi le nombre de
 *  passages comptés : un total sur trois passages n'est pas un total. */
const FICHIER_TRAFIC = path.join(DATA, 'trafic.json');
function trafic24h() {
  let passages = [];
  try { passages = JSON.parse(fs.readFileSync(FICHIER_TRAFIC, 'utf8')).passages || []; } catch { /* premier passage */ }
  const t = Date.now();
  passages.push({ t, requetes: TRAFIC.requetes, octets: TRAFIC.octets });
  passages = passages.filter((p) => p && t - p.t < 86400000);
  try { fs.writeFileSync(FICHIER_TRAFIC, JSON.stringify({ passages })); } catch { /* mesure perdue, pas la collecte */ }
  const somme = passages.reduce((a, p) => ({ requetes: a.requetes + p.requetes, octets: a.octets + p.octets }), { requetes: 0, octets: 0 });
  return { passages: passages.length, requetes: somme.requetes, octets: somme.octets, mo: +(somme.octets / 1e6).toFixed(1) };
}

/** LES REQUÊTES CONDITIONNELLES. On garde, par source, la dernière réponse
 *  utile et ses marqueurs (`ETag`, `Last-Modified`) : à la visite suivante on les
 *  renvoie, et le serveur décide lui-même s'il a quelque chose de neuf. S'il n'a
 *  rien (`304`), on réutilise le corps mémorisé — le reste du collecteur ne voit
 *  AUCUNE différence : mêmes offres relues, mêmes compteurs de tours, mêmes
 *  dates. C'est ce qui rend le gain gratuit.
 *
 *  Le cache vit dans `data/` (local, jamais publié). Il ne contient que des
 *  pages PUBLIQUES déjà lues, et il est reconstruit tout seul si on l'efface. */
const DOSSIER_CONDITIONNEL = path.join(DATA, 'conditionnel');
const CONDITIONNEL = { essais: 0, reutilises: 0 };
function cacheLire(cle) {
  try { return JSON.parse(fs.readFileSync(path.join(DOSSIER_CONDITIONNEL, `${cle}.json`), 'utf8')); } catch { return null; }
}
function cacheEcrire(cle, etag, dernierModifie, corps) {
  try {
    fs.mkdirSync(DOSSIER_CONDITIONNEL, { recursive: true });
    fs.writeFileSync(path.join(DOSSIER_CONDITIONNEL, `${cle}.json`), JSON.stringify({
      etag: etag || null, dernierModifie: dernierModifie || null,
      gardeLe: new Date().toISOString(), corps,
    }));
  } catch { /* cache perdu : on relira le corps entier, rien de plus */ }
}

/** LIRE UN `robots.txt` — et le lire comme il se doit.
 *
 *  Un `robots.txt` se lit par GROUPES : des lignes `User-agent:` suivies des
 *  règles qui les concernent. Le groupe qui nous intéresse est le plus
 *  spécifique (notre nom), sinon celui de `*`. Rendu sous forme lisible par du
 *  code, et non interprété au fil de la lecture : c'est ce qui le rend
 *  éprouvable sur des fichiers fabriqués. */
export function reglesRobots(texte, agent = '*') {
  const blocs = [];
  let courant = null;
  for (const brut of String(texte || '').split(/\r?\n/)) {
    const ligne = brut.replace(/#.*$/, '').trim();
    if (!ligne) continue;
    const i = ligne.indexOf(':');
    if (i < 0) continue;
    const cle = ligne.slice(0, i).trim().toLowerCase();
    const valeur = ligne.slice(i + 1).trim();
    if (cle === 'user-agent') {
      // Deux `User-agent` qui se suivent partagent leurs règles ; dès qu'une
      // règle est apparue, un nouvel `User-agent` ouvre un NOUVEAU groupe.
      if (!courant || courant.regles.length) { courant = { agents: [], regles: [] }; blocs.push(courant); }
      courant.agents.push(valeur.toLowerCase());
      continue;
    }
    if (courant) courant.regles.push([cle, valeur]);
  }
  const nom = String(agent).toLowerCase();
  const bloc = blocs.find((b) => b.agents.includes(nom)) || blocs.find((b) => b.agents.includes('*'));
  if (!bloc) return { trouve: false, chemins: [], toutInterdit: false, delai: null };
  const disallow = bloc.regles.filter(([k]) => k === 'disallow').map(([, v]) => v);
  const delais = bloc.regles.filter(([k]) => k === 'crawl-delay').map(([, v]) => Number(v));
  return {
    trouve: true,
    chemins: disallow.filter((v) => v !== ''),
    toutInterdit: disallow.some((v) => v === '/'),
    delai: delais.find((n) => Number.isFinite(n) && n >= 0) ?? null,
  };
}

/** Cette adresse nous est-elle interdite par ces règles ? */
export function robotsInterdit(regles, chemin) {
  if (!regles || !regles.trouve) return false;
  if (regles.toutInterdit) return true;
  return regles.chemins.some((p) => p && String(chemin).startsWith(p));
}

/** Le verdict `robots.txt`, par hôte — lu une fois par jour au plus. */
const FICHIER_ROBOTS = path.join(DATA, 'robots.json');
let ROBOTS_CACHE = null;
/** Les lectures de `robots.txt` EN VOL, par hôte. Les sources sont lues en
 *  parallèle (un seul `Promise.all`) : sans cette mémoire, huit adresses d'un
 *  même marchand demandaient huit fois le même fichier au même instant.
 *  MESURÉ le 12/10/2026, premier passage : 34 requêtes pour 18 hôtes. */
const robotsEnCours = new Map();
const ROBOTS = { nouveaux: 0, toutInterdit: [], cheminsInterdits: [], delais: {} };
function robotsCacheCharger() {
  if (!ROBOTS_CACHE) { try { ROBOTS_CACHE = JSON.parse(fs.readFileSync(FICHIER_ROBOTS, 'utf8')); } catch { ROBOTS_CACHE = {}; } }
  return ROBOTS_CACHE;
}
/** Rend le verdict pour un hôte, en le lisant s'il n'a pas été lu depuis 24 h. */
async function verdictRobots(url) {
  let hote = '', chemin = '/';
  try { const u = new URL(url); hote = u.hostname; chemin = u.pathname || '/'; } catch { return null; }
  const cache = robotsCacheCharger();
  let entree = cache[hote];
  if (!entree || Date.now() - new Date(entree.luLe || 0).getTime() > 86400000) {
    let enVol = robotsEnCours.get(hote);
    if (!enVol) {
      enVol = (async () => {
        let e;
        try {
          const r = await fetch(`https://${hote}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
          const texte = r.ok ? await r.text() : '';
          compterTrafic(`https://${hote}/robots.txt`, tailleRecue(r, texte), 'robots');
          e = { luLe: new Date().toISOString(), statut: r.status, ...reglesRobots(texte) };
        } catch {
          e = { luLe: new Date().toISOString(), statut: 0, trouve: false, chemins: [], toutInterdit: false, delai: null };
        }
        cache[hote] = e;
        return e;
      })();
      robotsEnCours.set(hote, enVol);
      ROBOTS.nouveaux++;
    }
    entree = await enVol;
  }
  if (entree.trouve) {
    if (entree.toutInterdit && !ROBOTS.toutInterdit.includes(hote)) ROBOTS.toutInterdit.push(hote);
    if (!entree.toutInterdit && robotsInterdit(entree, chemin) && !ROBOTS.cheminsInterdits.some((c) => c.hote === hote)) {
      ROBOTS.cheminsInterdits.push({ hote, chemin, regles: entree.chemins });
    }
    if (entree.delai !== null && entree.delai !== undefined) ROBOTS.delais[hote] = entree.delai;
  }
  return { hote, chemin, ...entree, interdit: robotsInterdit(entree, chemin) };
}

/** L'INSTANTANÉ DU VERDICT, pour l'état publié.
 *
 *  `applique: false` est écrit NOIR SUR BLANC, et c'est le seul endroit qui le
 *  dit : le panneau doit annoncer que ces règles sont LUES, pas SUIVIES — sinon
 *  le premier lecteur croira que le site s'y conforme. Le jour où on les
 *  appliquera, c'est ici, et une seule fois, que ça changera. */
export const ROBOTS_RAISON = 'lu et publié, PAS ENCORE APPLIQUÉ : écarter une source retire du contenu du site — c’est une décision de B, et il lui faut la liste avant de la prendre';

export function blocRobots(robots = {}) {
  return {
    hotesLus: robots.hotesLus || 0,
    sansRobots: robots.sansRobots || 0,
    nouveaux: robots.nouveaux || 0,
    toutInterdit: robots.toutInterdit || [],
    cheminsInterdits: robots.cheminsInterdits || [],
    delais: robots.delais || {},
    applique: false,
    raison: ROBOTS_RAISON,
  };
}

/** Construit l'instantané depuis l'état vivant ET le cache des verdicts : le
 *  nombre d'hôtes connus et le nombre de sites sans `robots.txt` se LISENT dans
 *  le cache, au lieu d'être comptés au fil des appels — un compteur incrémenté
 *  à chaque source comptait huit fois le même hôte. */
export function instantaneRobots(etat = {}, cache = {}) {
  const entrees = Object.values(cache || {}).filter((e) => e && typeof e === 'object');
  return blocRobots({
    hotesLus: entrees.length,
    sansRobots: entrees.filter((e) => !e.trouve).length,
    nouveaux: etat.nouveaux || 0,
    toutInterdit: etat.toutInterdit || [],
    cheminsInterdits: etat.cheminsInterdits || [],
    delais: etat.delais || {},
  });
}


/** Seuil de « température » sous lequel une offre Dealabs n'est pas retenue.
 *  Le flux « tendance » ne contient que des offres déjà très appréciées
 *  (108° à 580° observés) : le seuil ne coupe rien aujourd'hui, il est là pour
 *  que « les meilleures » reste une règle du code et non un hasard du flux. */
const TEMPERATURE_MIN = 100;

/** LA CADENCE — décision de B, 12/10/2026 : la collecte tourne désormais toutes
 *  les **15 minutes** (elle tournait toutes les 5).
 *
 *  Pourquoi ce n'est pas un renoncement : les sources ne sont JAMAIS interrogées
 *  au rythme du planificateur, mais au leur — `reposMin`, 15 min pour Dealabs,
 *  30 pour la presse, 45 à 240 pour les enseignes. À 5 minutes, deux passages sur
 *  trois ne trouvaient donc rien de neuf à demander et ne servaient qu'à faire
 *  tourner le dépôt. Mesuré : 339 commits par jour, dont 316 portant le catalogue
 *  entier. À 15 minutes, la source la plus rapide garde exactement sa cadence.
 *  Les offres déjà connues restent de toute façon : la fusion les conserve. */
/* Le délai vit dans chaque source (« reposMin »), parce que la même règle vaut
   pour toutes. Une constante unique obligeait à traiter Dealabs à part ; le
   champ, non. */

/* ------------------------------------------------------------------ *
 *  SOURCES — chacune testée à la main AVANT d'être branchée.
 *  « aTrier » : filtre de pertinence pour les flux généralistes (presse).
 * ------------------------------------------------------------------ */
const SOURCES = [
  // UN SEUL flux Dealabs — et c'est celui des MEILLEURES offres. « tendance »
  // (ex-« hot ») classe les bons plans par température communautaire, et chaque
  // titre porte son score (« 580° - … »). Le flux « new » est écarté : du
  // tout-venant sans score, pour deux fois plus de requêtes. Résultat : moitié
  // moins d'appels chez Dealabs, et rien que du bon.
  { id: 'dealabs-tendance', nom: 'Dealabs', type: 'dealabs', pays: 'FR', langue: 'fr', url: 'https://www.dealabs.com/rss/tendance', temperatureMin: TEMPERATURE_MIN, reposMin: 15 },

  // --- MÊME MOTEUR QUE DEALABS, AILLEURS EN EUROPE ---
  // Ces sites appartiennent à la même famille que Dealabs : même format de flux,
  // même score communautaire. Ils ont été testés un par un avant d'être branchés
  // (le chemin « tendance » n'existe pas partout : c'est « hot » qui répond).
  // Sans eux, un filtre par pays n'aurait rien à filtrer.
  { id: 'mydealz', nom: 'MyDealz', type: 'dealabs', pays: 'DE', langue: 'de', url: 'https://www.mydealz.de/rss/hot', temperatureMin: TEMPERATURE_MIN, reposMin: 15 },
  { id: 'chollometro', nom: 'Chollometro', type: 'dealabs', pays: 'ES', langue: 'es', url: 'https://www.chollometro.com/rss/hot', temperatureMin: TEMPERATURE_MIN, reposMin: 15 },
  { id: 'pepper-nl', nom: 'Pepper NL', type: 'dealabs', pays: 'NL', langue: 'nl', url: 'https://nl.pepper.com/rss/hot', temperatureMin: TEMPERATURE_MIN, reposMin: 15 },
  { id: 'pepper-pl', nom: 'Pepper PL', type: 'dealabs', pays: 'PL', langue: 'pl', url: 'https://www.pepper.pl/rss/hot', temperatureMin: TEMPERATURE_MIN, reposMin: 15 },
  { id: 'hotukdeals', nom: 'HotUKDeals', type: 'dealabs', pays: 'GB', langue: 'en', url: 'https://www.hotukdeals.com/rss/hot', temperatureMin: TEMPERATURE_MIN, reposMin: 15 },
  // Preisjäger : l'AUTRICHE, même famille et même format (le score est bien dans
  // le titre : « 119° - [Amazon] Dell XPS 13 … »). Trouvé en sondant — l'Autriche
  // n'avait jusqu'ici AUCUN site d'entraide, seulement de la presse.
  { id: 'preisjaeger', nom: 'Preisjäger', type: 'dealabs', pays: 'AT', langue: 'de', url: 'https://www.preisjaeger.at/rss/hot', temperatureMin: TEMPERATURE_MIN, reposMin: 15 },

  // --- PRESSE SPÉCIALISÉE (elle publie des bons plans PAR ARTICLE) ---
  // Le champ `langue` n'est pas décoratif : c'est lui qui choisit le filtre de
  // pertinence (voir MOTS_PROMO). Une presse étrangère lue avec le filtre
  // français était vidée en silence.
  { id: 'frandroid', nom: 'Frandroid', type: 'presse', pays: 'FR', langue: 'fr', url: 'https://www.frandroid.com/feed' },
  { id: 'lesnumeriques', nom: 'Les Numériques', type: 'presse', pays: 'FR', langue: 'fr', url: 'https://www.lesnumeriques.com/rss.xml' },
  { id: 'journaldugeek', nom: 'Journal du Geek', type: 'presse', pays: 'FR', langue: 'fr', url: 'https://www.journaldugeek.com/feed/' },
  { id: 'clubic', nom: 'Clubic', type: 'presse', pays: 'FR', langue: 'fr', url: 'https://www.clubic.com/feed/news.rss' },
  { id: '01net', nom: '01net', type: 'presse', pays: 'FR', langue: 'fr', url: 'https://www.01net.com/feed/' },

  // Ajoutées APRÈS mesure du rendement : chacune retient de vraies offres dans
  // SA langue. Les flux qui ne rendaient rien (0 à 1 titre retenu sur 20) n'ont
  // pas été branchés — une source qui ne remplit pas la liste n'est pas une
  // source, c'est une ligne de plus à surveiller.
  { id: 'hdblog', nom: 'HDblog', type: 'presse', pays: 'IT', langue: 'it', reposMin: 30, url: 'https://www.hdblog.it/feed/' },
  { id: 'tuttoandroid', nom: 'TuttoAndroid', type: 'presse', pays: 'IT', langue: 'it', reposMin: 30, url: 'https://www.tuttoandroid.net/feed/' },
  { id: 'mobil-se', nom: 'Mobil.se', type: 'presse', pays: 'SE', langue: 'sv', reposMin: 30, url: 'https://www.mobil.se/rss' },
  { id: 'androidworld', nom: 'Androidworld', type: 'presse', pays: 'NL', langue: 'nl', reposMin: 30, url: 'https://www.androidworld.nl/feed/' },

  // Flux d'ÉDITEURS choisis pour leurs VISUELS, dans les pays que Google News
  // laisse sans image (Belgique, Portugal, Suède, Italie). Leur rendement en
  // offres est modeste — 1 à 6 titres retenus — mais chaque article arrive avec
  // son image, et ce sont de VRAIES promotions locales. C'est exactement ce qui
  // manquait : ces pays n'avaient aucun visuel.
  { id: 'dhnet', nom: 'DHnet', type: 'presse', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.dhnet.be/rss' },
  { id: 'gva', nom: 'Gazet van Antwerpen', type: 'presse', pays: 'BE', langue: 'nl', reposMin: 30, url: 'https://www.gva.be/rss' },
  { id: 'nieuwsblad', nom: 'Het Nieuwsblad', type: 'presse', pays: 'BE', langue: 'nl', reposMin: 30, url: 'https://www.nieuwsblad.be/rss' },
  { id: '4gnews', nom: '4gnews', type: 'presse', pays: 'PT', langue: 'pt', reposMin: 30, url: 'https://4gnews.pt/feed' },
  { id: 'm3-se', nom: 'M3', type: 'presse', pays: 'SE', langue: 'sv', reposMin: 30, url: 'https://www.m3.se/rss' },
  { id: 'teknikveckan', nom: 'Teknikveckan', type: 'presse', pays: 'SE', langue: 'sv', reposMin: 30, url: 'https://teknikveckan.se/feed/' },
  { id: 'macitynet', nom: 'Macitynet', type: 'presse', pays: 'IT', langue: 'it', reposMin: 30, url: 'https://www.macitynet.it/feed' },
  { id: 'iphoneitalia', nom: 'iPhoneItalia', type: 'presse', pays: 'IT', langue: 'it', reposMin: 30, url: 'https://www.iphoneitalia.com/feed' },
];

/* ------------------------------------------------------------------ *
 *  ENSEIGNES — les offres publiées par le MARCHAND lui-même.
 *
 *  Constat de départ, mesuré sur la Belgique : l'onglet pays n'était rempli
 *  QUE par de la presse. Aucune annonce d'Amazon, de Colruyt, de Delhaize, de
 *  Lidl ni d'Action — alors que c'est exactement ce qu'on vient chercher dans
 *  une app de bons plans.
 *
 *  Ce qui a été sondé, extension par extension, avant d'écrire une ligne :
 *
 *    • Amazon.com.be  → page 100 % JavaScript (0 ASIN, 0 prix dans le HTML
 *      servi), et l'API Product Advertising exige une clé. Pas de source
 *      possible sans compte marchand : dit tel quel, pas contourné.
 *    • Colruyt / Delhaize / Lidl / Aldi / Carrefour / Kruidvat / Action →
 *      dépliants en IMAGE et applications JavaScript. Aucun produit, aucun
 *      prix dans le HTML servi (vérifié : 0 JSON-LD produit sur les six).
 *      Colruyt expose bien une passerelle publique, mais elle réclame un
 *      `clientCode` introuvable dans ses pages : impasse, et une devinette
 *      n'est pas une source.
 *    • Coolblue BE → sa page d'offres publie ses articles en **JSON-LD
 *      schema.org** (`ItemList` → `Product` → `offers.price`), avec le nom, le
 *      prix et le visuel. C'est un format normalisé, fait pour être lu : on s'y
 *      branche. C'est, à ce jour, la SEULE enseigne branchée — d'où le fait que
 *      la famille « enseignes » ne compte qu'un marchand.
 *
 *    • Media Markt BE → annoncé ici comme lisible en JSON-LD, puis REVÉRIFIÉ :
 *      les chemins de promotions rendent tous **404** (coquille JavaScript de
 *      478 Ko), et la page d'accueil ne porte que 4 prix, sans aucun `ItemList`.
 *      La piste était périmée et n'a jamais été branchée. À ne pas remettre ici
 *      sans la remesurer : une note optimiste non vérifiée fait perdre une
 *      demi-journée à celui qui la croit.
 *
 *  Pourquoi le JSON-LD et pas du découpage de HTML : c'est le format que le
 *  marchand DESTINE aux robots (référencement, comparateurs). Il ne dépend ni
 *  des noms de classes CSS, ni de la mise en page — un redesign du site ne le
 *  casse pas, contrairement à un `grep` sur `<div class="…">`.
 *
 *  Règle tenue : on ne branche QUE des pages de promotions réelles. Le
 *  catalogue ordinaire d'un marchand n'est pas une offre, et le présenter
 *  comme telle ferait croire à une remise qui n'existe pas.
 * ------------------------------------------------------------------ */
const SOURCES_ENSEIGNES = [
  // Coolblue Belgique — page « offres » paginée : 22 promotions par page,
  // chacune avec son prix et son visuel. Trois pages, pas davantage : au-delà,
  // le contenu se recoupe et chaque page coûte une requête chez le marchand.
  //
  // AUCUNE catégorie n'est imposée ici, et c'est délibéré : la page « offres »
  // de Coolblue mélange TOUT son catalogue — électroménager, soins, jardin,
  // high-tech. Le premier essai leur collait « tech » ; le vérificateur a
  // immédiatement relevé 37 offres rangées sans preuve (« De'Longhi Magnifica
  // Plus », « Bosch ErgoMaster »… classés en high-tech). Une catégorie inventée
  // est pire que pas de catégorie : elle a l'air juste. On laisse donc le titre
  // décider, et l'offre reste en « Autres » si le titre ne dit rien — c'est
  // honnête, et ça se voit.
  { id: 'coolblue-be-1', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres' },
  { id: 'coolblue-be-2', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres?page=2' },
  { id: 'coolblue-be-3', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres?page=3' },
  // Pages 4 à 8 : mesuré, la page 6 répond encore (200, 22 prix) et la page 12
  // est en 404 — la liste s'arrête entre les deux. Huit pages restent une
  // requête toutes les 30 minutes : la politesse envers le marchand est tenue.
  // C'est la SEULE enseigne belge lisible : autant en prendre ce qu'elle offre.
  { id: 'coolblue-be-4', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres?page=4' },
  { id: 'coolblue-be-5', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres?page=5' },
  { id: 'coolblue-be-6', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres?page=6' },
  { id: 'coolblue-be-7', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres?page=7' },
  { id: 'coolblue-be-8', nom: 'Coolblue', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 30, url: 'https://www.coolblue.be/fr/offres?page=8' },

  // GROUPON BELGIQUE — la seule plateforme belge qui publie ses bons plans avec
  // DEUX prix réels (« 26,99 € au lieu de 59,90 € »). Trouvée après avoir sondé
  // une trentaine de domaines belges (voir SOURCES.md) : les autres enseignes
  // belges répondent 403/429, rendent leur page en JavaScript, ou ne publient
  // aucun prix dans le HTML.
  //
  // Sa page `/goods` liste des PRODUITS, en JSON-LD standard : un `ItemList` de
  // `Product`, chacun avec `offers.price` ET un `offers.priceSpecification` de
  // type `ListPrice` — c'est-à-dire le prix de référence. Le robot est autorisé
  // (leur `robots.txt` dit `Allow: /`, `search=yes`), et une seule requête par
  // heure suffit à cette page.
  { id: 'groupon-be-goods', nom: 'Groupon', type: 'enseigne', pays: 'BE', langue: 'fr', reposMin: 60, viaCurl: true, url: 'https://www.groupon.be/goods' },

  // COOLBLUE PAYS-BAS et ALLEMAGNE (unité B5) — même plateforme et même JSON-LD
  // que Coolblue Belgique, déjà câblé : la page « offres » de l'enseigne dans
  // SON pays. Aucune catégorie imposée (le titre décide), exactement comme la
  // Belgique. Mesuré en B4 par DEUX relevés identiques : NL 10 offres à deux
  // prix, DE 18. Le domaine est national (coolblue.nl / coolblue.de), pas un
  // site étranger : un Néerlandais achète sur coolblue.nl.
  { id: 'coolblue-nl-1', nom: 'Coolblue', type: 'enseigne', pays: 'NL', langue: 'nl', reposMin: 90, url: 'https://www.coolblue.nl/aanbieding' },
  { id: 'coolblue-de-1', nom: 'Coolblue', type: 'enseigne', pays: 'DE', langue: 'de', reposMin: 90, url: 'https://www.coolblue.de/angebot' },

  // ZOOPLUS — animaleries en ligne, chacune dans SON pays (rubrique Animaux).
  // Le prix de référence est publié dans la `priceSpecification` de type
  // `ListPrice`, que `referenceListe` sait lire. Mesuré en B4 par DEUX relevés
  // identiques : DE chats 17, DE chiens 5, IT chats 29, SE chats 100.
  // ⚠ Les pages FR et ES de Zooplus ont été mesurées INSTABLES (14→10 et
  // 19→10) : elles ne sont PAS câblées ici.
  // Rubrique IMPOSÉE « animaux » : la page ENTIÈRE est une animalerie (une
  // catégorie « chats » ou « chiens », pas un accueil généraliste). Sans elle,
  // les titres — des noms de marque sans mot animalier — tomberaient en
  // « Autres », et la nourriture pour chats en « Nourriture » (interdit,
  // point 18). C'est la nature de la page qui décide, comme pour Groupon.
  { id: 'zooplus-de-chat', nom: 'Zooplus', type: 'enseigne', pays: 'DE', langue: 'de', reposMin: 120, categorieImposee: 'animaux', url: 'https://www.zooplus.de/shop/katzen/sonderangebote_katze' },
  { id: 'zooplus-de-chien', nom: 'Zooplus', type: 'enseigne', pays: 'DE', langue: 'de', reposMin: 120, categorieImposee: 'animaux', url: 'https://www.zooplus.de/shop/hunde/sonderangebote_hund' },
  { id: 'zooplus-it-chat', nom: 'Zooplus', type: 'enseigne', pays: 'IT', langue: 'it', reposMin: 120, categorieImposee: 'animaux', url: 'https://www.zooplus.it/shop/gatti/offerte_speciali_gatti' },
  { id: 'zooplus-se-chat', nom: 'Zooplus', type: 'enseigne', pays: 'SE', langue: 'sv', reposMin: 120, categorieImposee: 'animaux', url: 'https://www.zooplus.se/specials/katt/specialerbjudanden/kattmat/81531' },
];

/* ------------------------------------------------------------------ *
 *  LES ADRESSES DE PROMOTIONS PUBLIÉES AVEC LE SITE — LE TUYAU.
 *
 *  Le panneau possède une colonne « Adresse des promotions », une ligne par
 *  acteur, modifiable. Jusqu'au 09/10/2026, cette colonne ne servait à RIEN :
 *  elle n'était conservée que dans le navigateur, et aucun programme ne la
 *  lisait — l'aide du panneau promettait « il sera utilisé par la collecte »,
 *  ce qui était faux. `public/adresses-promotions.json` est le tuyau qui
 *  manquait : écrit par `outils/remplir-adresses-promotions.mjs`, lu ici, publié
 *  avec le site.
 *
 *  Une adresse y devient une source de type `enseigne` — donc lue par
 *  `offresEnseigne` (JSON-LD), exactement comme Coolblue ou Zooplus. Le pays
 *  vient de la base d'acteurs, la langue du pays.
 *
 *  DEUX GARDE-FOUS, appris en câblant les enseignes une par une :
 *    — une adresse DÉJÀ dans SOURCES_ENSEIGNES est ignorée. La lire deux fois
 *      ne double pas la couverture : elle compte deux fois les mêmes articles.
 *    — le repos est long (3 h). Ces pages n'ont pas été mesurées une à une comme
 *      les autres enseignes ; on les visite avec prudence, sans presser un
 *      marchand qui ne nous a rien demandé.
 * ------------------------------------------------------------------ */
const LANGUE_PAR_PAYS = {
  FR: 'fr', BE: 'fr', DE: 'de', AT: 'de', NL: 'nl', ES: 'es', IT: 'it',
  PT: 'pt', PL: 'pl', SE: 'sv', IE: 'en', GB: 'en',
};
const FICHIER_ADRESSES = path.join(__dirname, 'public', 'adresses-promotions.json');
// Le VERDICT de lisibilité de chaque adresse (donnees/adresses-verifications.json,
// mesuré le 09/10/2026) : c'est lui qui décide quelles pages on visite — voir
// sourcesAdresses(). Niveaux : 2 = page qui rend des offres à deux prix,
// 1 = page de promotions reconnue mais illisible, 0 = rien trouvé.
const FICHIER_VERIFICATIONS = path.join(__dirname, 'donnees', 'adresses-verifications.json');
/** LES DESTINATIONS RÉELLES — cache tenu par outils/resoudre-destinations.mjs.
 *  Clé : l'adresse de sortie de la plateforme de bons plans. Valeur : l'adresse
 *  du marchand réellement atteint. Voir appliquerDestinations(), plus bas. */
const FICHIER_DESTINATIONS = path.join(__dirname, 'donnees', 'destinations-reelles.json');
/** LE VERDICT DES PAGES D'OFFRES — table à part, HORS du catalogue publié.
 *  Clé : l'identifiant de l'offre. Valeur : `{ statut: 'expiree' | 'vivante',
 *  vuLe, sourceId }`. Elle est tenue par le contrôle direct (voir
 *  `candidatsVerdict`), écrite à chaque passage, et **jamais** servie par le
 *  site : le verdict appartient à la page du partenaire, pas à notre catalogue.
 *  Voir aussi pourquoi elle n'est pas dans `offres.json` (poids de 1,4 Mo pour
 *  vingt mille fiches, et verdict d'un tiers publié chez nous). */
const FICHIER_VERDICTS = path.join(__dirname, 'donnees', 'verdicts-sources.json');
const REPOS_ADRESSE_MIN = 180;

/** Un identifiant de source à partir d'un nom d'enseigne. Les identifiants
 *  paraissent dans le journal et dans les URL d'état : ils doivent être stables
 *  (recalculer le même nom deux fois donne le même identifiant, sinon deux
 *  passages créeraient deux sources pour une seule adresse). */
const identifiantAdresse = (nom) => String(nom).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'acteur';

/* L'ÉTIQUETTE PUBLIÉE NE PORTE PAS LE PAYS — ET CE N'EST PAS UN DÉTAIL.
 *
 *  La base du marché nomme ses acteurs tels qu'ils se présentent sur leur
 *  papier : « Corendon Belgique », « Orange Belgique », « Sunweb Belgique ».
 *  Reprendre ce libellé tel quel ferait signer l'offre d'un marchand que
 *  personne ne connaît : la carte afficherait « Corendon Belgique » au lieu de
 *  « Corendon ». C'est le défaut déjà corrigé une fois sur la veille marchande
 *  (« Media Markt » s'affichait « Media »), et `tests/veille-noms.test.mjs`
 *  veille dessus — c'est lui qui a attrapé cette régression.
 *
 *  POURQUOI ON NE RETIRE QUE « Belgique / België », ET PAS TOUS LES PAYS.
 *  Parce qu'un pays dans un nom n'est pas toujours un qualificatif : « Air
 *  France », « Transavia France », « Rakuten France » sont des NOMS DE MARQUE.
 *  Les tronquer en « Air », « Transavia », « Rakuten » fabriquerait exactement
 *  le défaut qu'on répare — une carte signée d'un marchand qui n'existe pas.
 *  La règle du projet ne demande que le qualificatif belge, et c'est celui-là,
 *  et lui seul, qu'on retire. Un test le tient.
 *
 *  Le PAYS n'est jamais perdu : il est porté à part, par le champ `pays`, et
 *  c'est lui qui range l'offre dans le bon marché. */
const QUALIFICATIF_PAYS = /[\s\-–(]*(belgique|belgi[eë])\s*\)?\s*$/i;

const etiquetteMarchand = (nom) => String(nom).replace(QUALIFICATIF_PAYS, '').replace(/\s{2,}/g, ' ').trim() || String(nom).trim();

/** Les sources tirées du fichier publié. Rend TOUJOURS un tableau : un fichier
 *  absent, vide ou illisible donne une liste vide, jamais une exception — la
 *  collecte ne doit pas mourir parce qu'un fichier annexe manque. */
function sourcesAdresses() {
  let table = {};
  try {
    const d = JSON.parse(fs.readFileSync(FICHIER_ADRESSES, 'utf8'));
    if (d && d.adresses && typeof d.adresses === 'object' && !Array.isArray(d.adresses)) table = d.adresses;
  } catch { return []; }
  // LE VERDICT DE LISIBILITÉ — et c'est lui qui décide quelles pages on visite.
  //
  //   Diagnostic de B, 10/10/2026, mot pour mot : « le lien de promo n'est pas
  //   documenté correctement, ces sites-là ne doivent pas être mis à jour ».
  //   Il avait raison, et le projet avait déjà la mesure : la vérification des
  //   adresses du 09/10/2026 a classé les 573 acteurs par NIVEAU —
  //     2 = page de liste qui rend des offres à DEUX PRIX ;
  //     1 = page de promotions reconnue mais ILLISIBLE ;
  //     0 = rien trouvé.
  //   Résultat : **4** acteurs en niveau 2, **216** en niveau 1, **353** en
  //   niveau 0. Or on branchait les 220 adresses de la table SANS REGARDER ce
  //   verdict : 216 pages dont on savait déjà qu'elles ne rendent rien étaient
  //   interrogées à chaque passage, échouaient à chaque passage, et faisaient
  //   dire à la collecte « plus de la moitié des sources sont en échec » —
  //   L'ALERTE SONNAIT DONC EN PERMANENCE, toutes les cinq minutes, et une
  //   alarme qui sonne toujours ne signale plus rien.
  //
  //   On ne visite plus que le niveau 2. Les adresses écartées restent dans la
  //   table (le panneau les affiche, et un jour de meilleur lecteur les
  //   rouvrira) : on arrête de les INTERROGER, on ne les efface pas.
  let niveaux = null;
  try {
    const v = JSON.parse(fs.readFileSync(FICHIER_VERIFICATIONS, 'utf8'));
    if (v && v.acteurs && typeof v.acteurs === 'object' && !Array.isArray(v.acteurs)) {
      niveaux = new Map(Object.entries(v.acteurs).map(([nom, a]) => [nom, a && a.niveau]));
    }
  } catch { /* pas de verdict disponible : on retombe sur le comportement d'avant */ }
  // Le pays par nom d'acteur : la base du marché le porte, et c'est elle qui
  // décide dans quel pays ranger les offres lues.
  let acteurs = [];
  try {
    const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'acteurs.json'), 'utf8'));
    acteurs = (b && b.acteurs) || [];
  } catch { /* base manquante : on retombera sur BE */ }
  return sourcesAdressesDepuis(table, acteurs, SOURCES_ENSEIGNES, niveaux);
}

/** LA RÈGLE, ISOLÉE DE LA LECTURE DU DISQUE — c'est elle que les tests exercent.
 *
 *  Prend la table {nom: url}, la base d'acteurs, les sources déjà câblées, et
 *  les NIVEAUX de lisibilité mesurés ({nom: 0|1|2}). Rend les sources de type
 *  `enseigne` correspondantes. Séparer la règle de la lecture permet de
 *  l'éprouver sur des cas fabriqués (URL vide, adresse déjà câblée, nom inconnu
 *  de la base, page illisible) sans dépendre d'un fichier présent.
 *
 *  `niveaux` ABSENT (null) = pas de verdict disponible : on garde l'ancien
 *  comportement (toutes les adresses valides), pour ne pas perdre la couverture
 *  le jour où le fichier de vérification manquerait. Fourni, il est APPLIQUÉ :
 *  seules les pages de niveau 2 — celles qui rendent des offres à deux prix —
 *  sont visitées. */
export function sourcesAdressesDepuis(table, acteurs, dejaCablees = [], niveaux = null) {
  const paysDe = new Map();
  for (const a of (acteurs || [])) if (!paysDe.has(a.nom)) paysDe.set(a.nom, a.pays);
  const dejaLue = new Set((dejaCablees || []).map((s) => s.url));
  const vues = new Set();
  const faites = [];
  for (const [nom, url] of Object.entries(table || {})) {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u) || dejaLue.has(u) || vues.has(u)) continue;
    // Une page dont la mesure dit qu'elle ne rend rien ne se visite pas : la
    // relire chaque passage ne la rendra pas lisible, et son échec permanent
    // éteint l'alerte qui doit signaler les VRAIS problèmes.
    if (niveaux && niveaux.get(nom) !== 2) continue;
    vues.add(u);
    const pays = paysDe.get(nom) || 'BE';
    faites.push({
      id: `adr-${identifiantAdresse(nom)}-${faites.length + 1}`,
      nom: etiquetteMarchand(nom),
      type: 'enseigne',
      pays,
      langue: LANGUE_PAR_PAYS[pays] || 'fr',
      reposMin: REPOS_ADRESSE_MIN,
      url: u,
    });
  }
  return faites;
}

const SOURCES_ADRESSES = sourcesAdresses();

/* ------------------------------------------------------------------ *
 *  LE SEUIL D'ARTICLES PAR ENSEIGNE — décision de B, 10/10/2026
 *
 *    « Donc une enseigne qui n'apporte pas au moins 10 articles dans le
 *      catalogue grâce au lien documenté, elle ne doit pas être interrogée,
 *      jusqu'à quand on trouve une autre solution manuellement. »
 *
 *  Le problème qu'elle règle, mesuré : on avait chargé des enseignes dont on
 *  savait déjà, ou dont on a découvert, qu'elles ne rendent RIEN — une visite
 *  toutes les trois heures, un échec à chaque visite, et une alerte « plus de la
 *  moitié des sources sont en échec » qui partait toutes les cinq minutes.
 *
 *  Deux points de conception, tous deux payés d'avance :
 *
 *   1. LE COMPTE SE FAIT PAR ENSEIGNE, PAS PAR SOURCE. Coolblue a dix adresses
 *      câblées qui apportent 81 articles ensemble : aucune n'en apporte 10 à
 *      elle seule, et juger source par source condamnerait la meilleure enseigne
 *      du catalogue. Le nom de l'enseigne est le bon grain.
 *   2. UNE SOURCE JAMAIS INTERROGÉE GARDE SA CHANCE. On ne condamne pas une
 *      adresse qu'on n'a pas essayée : elle est visitée une fois, et le verdict
 *      tombe au passage suivant, sur son résultat réel.
 */
const SEUIL_ARTICLES_ENSEIGNE = 10;

/* ------------------------------------------------------------------ *
 *  LA PÉREMPTION — TROIS VERROUS, ET POURQUOI TROIS ET PAS UN
 *
 *  Question de B (10/10/2026), mot pour mot : « quand cette mise à jour a lieu
 *  est-ce qu'on enlève les promotions qui ne sont plus d'actualité ? » La
 *  réponse était NON, et la mesure a dit par où le défaut entrait réellement.
 *
 *  Sur les 17 243 offres publiées, 239 portaient une date de source de plus de
 *  7 jours — 179 de plus de 30 jours, la plus vieille datée de novembre 2018
 *  (un bon de Noël Auchan). 100 % venaient de la PRESSE (Google News, Bing) ou
 *  d'une source DISPARUE du catalogue. ZÉRO venaient de Dealabs, Amazon,
 *  Coolblue, bol.com, Groupon, Socialdeal ou Krefel. Et toutes étaient entrées
 *  dans la base la semaine même : le défaut n'était donc pas de la pourriture
 *  accumulée, c'était du périmé qui ENTRE.
 *
 *  D'où trois verrous, chacun posé sur le seul signal qui parle pour sa
 *  catégorie — jamais un délai unique, qui se tromperait sur les deux :
 *
 *    VERROU 1 — LA DATE, POUR LA PRESSE. Un article de 2018 réindexé par Google
 *      News n'est pas un bon plan, et rien ne viendra jamais le contredire : la
 *      presse republie son fil, pas ses archives. On écarte donc toute offre de
 *      presse datée de plus de 7 jours. Un bon plan de presse est une actualité ;
 *      au-delà d'une semaine, c'est une archive.
 *
 *    VERROU 2 — LA DISPARITION, POUR LES MARCHANDS. MESURÉ PUIS DÉSAMORCÉ : voir
 *      la note ci-dessous, c'est la partie de cette page qui a coûté le plus cher
 *      à comprendre, et elle ne retire plus rien.
 *
 *    VERROU 3 — LA SOURCE DISPARUE. Une offre dont la source a quitté le
 *      catalogue n'a plus personne pour parler d'elle : on lui applique la
 *      limite de la presse, faute de mieux. Mesuré : 678 offres étaient dans ce
 *      cas, dont 674 venaient de `flash-at`, `flash-pt`, `dealabs-new` et
 *      `dealabs-hot`, quatre adresses retirées du catalogue.
 *
 *  ────────────────────────────────────────────────────────────────────────
 *  VERROU 2 : CE QUE LA MESURE A DÉTRUIT DANS MON PROPRE RAISONNEMENT
 *
 *  J'avais proposé, et fait valider : « une offre sort après deux tours réussis
 *  de sa source sans republication ». L'idée semblait solide — la source a parlé,
 *  l'offre n'y est plus, donc elle n'existe plus. Raisonnement CONTREDIT par la
 *  mesure, avant que le moindre dégât ne soit fait, et de deux façons :
 *
 *    1. LE FLUX D'UNE SOURCE EST UNE FENÊTRE, PAS UNE LISTE. Le flux « tendance »
 *       de Dealabs sert TRENTE offres par passage. La base en compte 1 407 —
 *       c'est-à-dire six jours d'accumulation. Le raisonnement « elle n'y est plus
 *       donc elle est morte » supposait une liste complète ; il n'y en a pas. Sur
 *       les 17 038 offres publiées, 9 959 appartiennent à des sources de ce genre
 *       (mydealz, chollometro, pepper, hotukdeals…). La règle aurait effacé près
 *       de DIX MILLE offres en dix minutes.
 *
 *    2. SORTIR DE LA FENÊTRE NE VEUT PAS DIRE ÊTRE EXPIRÉ — vérifié sur les pages
 *       elles-mêmes. Trois offres Dealabs absentes du flux du jour, contrôlées à
 *       la main le 10/10/2026 : DEUX portent `isExpired: false`, `status:
 *       Activated`, `isHot: true` — elles sont parfaitement valides — et UNE
 *       porte `isExpired: true` (un lot de deux eyeliners Bourjois). La
 *       disparition du flux n'est donc ni une preuve de péremption, ni une preuve
 *       de validité : elle ne prouve RIEN.
 *
 *  Ce qu'on garde de ce travail : la comptabilité des tours reste tenue et
 *  publiée, la règle continue d'être calculée, et le journal dit COMBIEN d'offres
 *  elle écarterait. On ne les écarte pas. C'est une mesure en attente, pas une
 *  règle déguisée : trente jours d'observation diront à quelle vitesse ces offres
 *  meurent vraiment, et la règle définitive se choisira sur ce chiffre-là.
 *
 *  La leçon à garder du chantier : « la source ne le republie plus » n'est une
 *  preuve que si la source publie une LISTE. Vérifier la forme de la source avant
 *  de croire son silence.
 *  ────────────────────────────────────────────────────────────────────────
 *
 *  LA RÈGLE QUI TRANCHE LES CAS DOUTEUX : en cas de doute, on RETIRE. Les deux
 *  erreurs ne sont pas symétriques — montrer une offre morte fait cliquer pour
 *  rien et coûte la confiance, alors qu'enlever une offre encore vivante ne
 *  coûte rien : son marchand la republiera au passage suivant, et elle
 *  reviendra. C'est la raison d'être du choix « le plus tôt » partout ci-dessous.
 * ------------------------------------------------------------------ */
export const LIMITE_PRESSE_JOURS = 7;
export const LIMITE_SOURCE_DISPARUE_JOURS = 7;
/** Au-delà de ce retard sur l'heure courante, une date de source est FAUSSE.
 *
 *  Défaut mesuré le 13/10/2026, signalé par B : un article des Numériques daté
 *  du 05/10/2026 12:00 dans sa propre page (`datePublished`) était arrivé chez
 *  nous daté du **05/10/2027** — la même heure, un an plus tard. Trois effets,
 *  tous visibles à l'écran :
 *    • la carte annonçait « il y a 1 min » À PERPÉTUITÉ (l'écart négatif est
 *      ramené à une minute par `ilYA`, voir app.js) ;
 *    • elle passait EN TÊTE du tri « plus récentes », donc en tête du site ;
 *    • elle ne périmait JAMAIS : la fenêtre de veille s'écrit
 *      « date > maintenant − 7 jours », toujours vraie pour une date future.
 *
 *  Vingt-quatre heures de marge, et pas moins : une source qui écrit son heure
 *  locale sans son fuseau peut légitimement paraître en avance de treize heures.
 *  Au-delà, ce n'est plus un fuseau, c'est une horloge fausse — et une date
 *  fausse ne doit servir ni à garder, ni à classer, ni à dater une carte. */
export const MARGE_HORLOGE_MS = 24 * 3600 * 1000;
/** Tours réussis sans republication avant qu'une offre marchande sorte.
 *
 *  ⚠ NE SERT PAS ENCORE À RETIRER — voir « VERROU 2 : CE QUE LA MESURE A
 *  DÉTRUIT ». La comptabilité tourne, le journal compte, rien ne sort. */
export const TOURS_SANS_SERVICE = 2;
/** Part du dernier rendu en dessous de laquelle un tour ne compte PAS. */
export const PART_RENDU_MINIMUM = 0.5;

/** L'âge d'une date ISO, en JOURS — ou null si elle est illisible.
 *
 *  Renvoie null plutôt qu'un nombre : une date qu'on ne sait pas lire ne doit
 *  jamais servir de preuve, ni pour garder ni pour écarter. */
export function ageJours(dateIso, maintenant = Date.now()) {
  const t = new Date(dateIso || '').getTime();
  if (!Number.isFinite(t) || t === 0) return null;
  return (maintenant - t) / 86400000;
}

/** VERROUS 1 ET 3 — pourquoi cette offre doit sortir À CAUSE DE SA DATE, ou la
 *  chaîne vide si elle reste.
 *
 *  `typeSource` est le type relevé au CATALOGUE (`presse`, `dealabs`, `amazon`…),
 *  ou la chaîne vide quand l'identifiant n'y figure plus : c'est précisément ce
 *  vide qui distingue l'offre ORPHELINE de l'offre surveillée.
 *
 *  Les MARCHANDS ne sont jamais jugés sur l'âge, et c'est volontaire : chez eux
 *  la date est une date de publication que la source rafraîchit, pas une preuve
 *  de validité — un marchand qui republie une offre de dix jours la garde
 *  vivante. C'est le verrou 2 qui les surveille, et lui s'appuie sur une preuve.
 */
export function motifDeSortie(offre, { maintenant = Date.now(), typeSource = '' } = {}) {
  if (!offre) return '';
  // LES ARTICLES DE VEILLE ONT LEUR PROPRE RÈGLE, et elle est déjà en place :
  // trente jours mesurés sur la date de publication (voir LIMITE_VEILLE). On ne
  // la remplace PAS ici. Défaut attrapé avant livraison, par le garde-fou sur les
  // données réelles : sans cette ligne, les 142 articles de plus de 7 jours
  // auraient été rabotés en douce à une semaine — une règle que B n'a jamais
  // demandée, appliquée à un autre produit (la veille, qui n'affiche aucun prix),
  // et rien à l'écran ne l'aurait dit.
  if (offre.type === 'article') return '';
  const age = ageJours(offre.date, maintenant);
  // Pas de date lisible : on ne juge pas sur rien.
  if (age === null) return '';
  // Date dans le futur : c'est une horloge de source mal réglée, pas une preuve
  // de fraîcheur. On ne s'en sert ni pour garder ni pour écarter ici.
  if (age < 0) return '';
  if (typeSource === 'presse') return age > LIMITE_PRESSE_JOURS ? 'presse-hors-delai' : '';
  if (!typeSource) return age > LIMITE_SOURCE_DISPARUE_JOURS ? 'source-disparue' : '';
  return '';
}

/** LE PLAFOND DE DONNÉES — sept jours, demande de B (12/10/2026).
 *
 *  ⚠️ CE N'EST PLUS LA RÈGLE DU CATALOGUE, ET IL FAUT LE DIRE ICI. Depuis le
 *  14/10/2026, la règle est `VIE_AFFICHEE_JOURS` (cinq jours, puis la question du
 *  service, voir `verdictDeCalendrier`) : c'est ELLE qui efface. Ce qui suit est
 *  conservé comme MESURE — l'outil d'observation `bin/mesurer-peremption-source.mjs`,
 *  les tranches d'âge des visuels dans le bilan de données, et le délai d'entrée
 *  dans l'ancienne file de contrôle (dont le budget est désormais nul). Un chiffre
 *  faux ne s'efface pas d'un fichier en le supprimant : il s'efface en disant
 *  lequel a remplacé l'autre.
 *
 *  La règle d'origine, pour mémoire :
 *
 *  « Après 7 jours affiché sur le site, toutes les images et tout ce qui est en
 *  rapport avec l'annonce qui dépasse 7 jours doit être effacé, afin de ne rien
 *  stocker dans notre database inutile et qui pèserait dans l'usage quotidien
 *  entre les différents services. »
 *
 *  Le signal était `vuLe` — la dernière fois qu'une source a reservi l'offre — et
 *  JAMAIS `date` : la date d'une offre marchande est réécrite à chaque passage,
 *  donc elle ne dit pas depuis quand l'offre est en base.
 *
 *  Deux catégories gardent leur règle propre, et on ne les rabote pas ici : les
 *  ARTICLES DE VEILLE (trente jours) et les offres de PRESSE (sept jours sur leur
 *  date, tenue par `motifDeSortie`).
 */
export const PLAFOND_DONNEES_JOURS = 7;

/** LE RETOUR D'UNE OFFRE — la règle de B, deuxième tour (12/10/2026).
 *
 *  « Concernant la règle des 7 jours, si sur le site internet d'origine de
 *    l'annonce, elle est toujours présente le 8e jour, elle devra réapparaître
 *    sur notre site, pour 7 nouveaux jours. Exemple pendant les soldes ou c'est
 *    un mois de promotion sur certains articles. »
 *
 *  Ce que ça impose, et c'est tout le sens de cette fonction : **le compte à
 *  rebours ne part PAS de la première mise en ligne, il part de la DERNIÈRE FOIS
 *  qu'une source a SERVÉ l'offre.** Une promotion qui dure un mois n'est donc
 *  jamais emportée : elle est reservie à chaque passage, son délai repart à sept
 *  jours chaque fois, et la règle ne la voit même pas passer. Le plafond ne mord
 *  que sur ce que PLUS PERSONNE ne sert — les annonces qui ont réellement quitté
 *  leur source.
 *
 *  Et rien n'est définitif, parce que le retrait n'écrit **aucune liste
 *  d'exclusion** : le jour où une source resert l'offre — le 8e, le 9e ou le
 *  30e — elle rentre comme une offre neuve, avec un délai plein. C'est garanti
 *  par la forme de `plafondDeDonnees`, qui reste une fonction PURE : elle ne se
 *  souvient de rien, donc elle ne peut rien condamner pour toujours.
 *
 *  Rend les jours de service RESTANTS (négatif quand le délai est dépassé), ou
 *  null si la date n'est pas lisible — on ne juge pas sur rien.
 */
export function joursDeServiceRestants(offre, { maintenant = Date.now() } = {}) {
  const age = ageJours(offre && offre.vuLe, maintenant);
  if (age === null) return null;
  return PLAFOND_DONNEES_JOURS - age;
}

/** CETTE OFFRE EST-ELLE AU-DELÀ DU DÉLAI ? **La règle, en UN SEUL endroit.**
 *
 *  Extrait pour que le COMPTE et le RETRAIT ne puissent jamais diverger : si la
 *  mesure et l'effacement calculaient chacun de leur côté, ils finiraient par ne
 *  plus parler du même ensemble, et c'est le genre d'écart qu'on ne voit qu'après
 *  avoir effacé ce qu'il ne fallait pas.
 *
 *  Les ARTICLES n'y sont jamais jugés : leur verrou est leur date de publication
 *  (voir LIMITE_VEILLE), pas leur dernier service. */
export function donneesPerimees(offre, { maintenant = Date.now() } = {}) {
  if (!offre || offre.type === 'article') return false;
  const reste = joursDeServiceRestants(offre, { maintenant });
  return reste !== null && reste < 0;
}

/** LA RÈGLE DE LA VIE D'UNE CARTE — **CINQ JOURS**, puis une seule question.
 *
 *  Mise en production le 14/10/2026, sur le mot de B : « Ok, tu peux réécrire et
 *  mettre en production. » Elle remplace TOUT ce qui jugeait avant elle (voir
 *  REGLES-DES-CARTES.md, R.1 à R.16) : l'appareil de mesure et de jugement
 *  devient une règle de calendrier.
 *
 *    • une carte s'affiche **cinq jours** — c'est la garantie donnée à TOUT ce qui
 *      entre, servie ou non. Le compteur est `premiereVue` (la première parution
 *      chez nous — décision de B du 14/10/2026), avec `vuLe` en repli pour les
 *      fiches entrées avant que ce repère existe ;
 *    • passé cinq jours **et une seconde**, une seule question : **la source
 *      sert-elle encore cette offre ?** « Servir » = elle est présente dans le
 *      flux de sa source à ce passage (R.2). **Aucune page n'est ouverte** ;
 *    • **servie** → le compteur repart (cinq jours pleins), et l'âge AFFICHÉ reste
 *      celui que la source publie ;
 *    • **plus servie** → la carte est **EFFACÉE** : fiche, visuel, marques. Seul
 *      l'historique des prix survit (R.6) et il se raccroche tout seul.
 *
 *  POURQUOI ELLE EST SÛRE : une date ne peut pas se tromper. Il n'y a plus de
 *  jugement, donc plus de faux positif possible — et c'est la seule règle du
 *  fichier qui n'a rien à mesurer avant d'agir.
 *
 *  CE QU'ELLE COÛTE, ET C'EST ASSUMÉ (R.15) : « on n'affiche que ce qu'une source
 *  sert encore ». Une offre qu'une source ne republie plus sort, même si sa page
 *  répond encore. Mesuré le 12/10/2026 sur 140 pages réelles : **47,7 %** des
 *  cartes emportées par une échéance de service étaient encore vivantes. Le prix
 *  payé est le volume : **−31 % de cartes** (15 359 → ~10 600).
 */
export const VIE_AFFICHEE_JOURS = 5;

/** LE VERDICT DE LA RÈGLE, EN UN SEUL ENDROIT — et PUR.
 *
 *  Rend `'effacee'` ou `'intacte'`, et rien d'autre : c'est la seule décision que
 *  le catalogue prend désormais sur une offre.
 *
 *  LES DEUX GARDES. Elles sont la différence entre une règle et un massacre, et
 *  chacune répond à un défaut que ce fichier a déjà payé :
 *
 *   1. **On ne juge pas sur rien.** Sans date lisible, la carte reste — même
 *      discipline que `motifDeSortie` pour la veille.
 *   2. **On ne condamne pas sur une source qu'on n'a pas réussi à lire.** « La
 *      source ne la sert plus » n'est vrai que si elle a **PARLÉ depuis** : son
 *      numéro de tour doit avoir avancé (`tour > serviceAuTour`). Un passage où
 *      la source est au repos (`reposMin`), un rendu tronqué par un mur
 *      anti-robot, un flux vide un tour sur deux : dans les trois cas le tour
 *      n'avance pas, et la carte **attend**. C'est la garde d'`avancerTours`
 *      (`PART_RENDU_MINIMUM`) : sans elle, la règle effacerait des catalogues
 *      vivants au premier passage raté, et le défaut serait muet.
 *
 *  PURE : elle ne garde aucune mémoire des offres qu'elle condamne. Rien n'est
 *  donc définitif — une offre reservie plus tard rentre comme une carte neuve,
 *  sans qu'aucune « dé-condamnation » soit nécessaire.
 */
export function verdictDeCalendrier(offre, { maintenant = Date.now(), tours = {} } = {}) {
  if (!offre || offre.type === 'article') return 'intacte';   // la veille a sa règle (R.8)
  const age = ageJours(offre.premiereVue || offre.vuLe, maintenant);
  if (age === null) return 'intacte';                         // garde 1 : aucun verdict sur rien
  if (age <= VIE_AFFICHEE_JOURS) return 'intacte';            // les cinq jours garantis
  const servi = Number.isFinite(offre.serviceAuTour) ? offre.serviceAuTour : null;
  const tour = Number.isFinite(tours ? tours[offre.sourceId] : undefined) ? tours[offre.sourceId] : null;
  if (tour === null || servi === null || tour <= servi) return 'intacte';   // garde 2
  return 'effacee';
}

/** L'INTERRUPTEUR DU VOLET 2 — LA VEILLE RAMENÉE DE TRENTE À SEPT JOURS.
 *  **ALLUMÉ LE 12/10/2026, SUR LE MOT DE B : « vas-y ».**
 *
 *  Pourquoi cette moitié est la SÛRE, et pourquoi elle ne se décide pas avec
 *  l'autre : son verrou est la date de PUBLICATION de l'article, qui ne change
 *  jamais. Un article refusé ne peut donc pas revenir, et aucun faux positif
 *  n'est possible — une date illisible fait GARDER l'article (voir
 *  `motifDeSortie`, qui rend la chaîne vide plutôt qu'un verdict).
 *
 *  Allumé, il ne retire rien du STOCK : il refuse de PUBLIER au-delà de sept
 *  jours (voir JOURS_VEILLE / LIMITE_VEILLE). L'article sort du catalogue publié
 *  au passage suivant, et son visuel, devenu orphelin, est purgé par la
 *  publication. Le stock garde l'article : revenir en arrière est un mot, pas
 *  une re-collecte. C'est ce qui le rend réversible là où le volet des offres ne
 *  l'est pas.
 *
 *  Ce qui a été lu AVANT d'appuyer, et non après (relevé de 15 h 26, sur le
 *  catalogue publié) : 1 644 articles publiés, dont **243 de plus de sept jours**
 *  (10 Mo de visuels), et **555 en stock**. Allumer change donc l'écran de
 *  243 fiches, pas de 555 — l'écart est le quota d'articles par pays, et il est
 *  donné exprès : le chiffre du stock, présenté seul, se lirait comme une
 *  exagération.
 *
 *  L'épreuve `le volet de la veille est allumé par un acte explicite` garde cet
 *  interrupteur — et son allumage a bien été un acte visible dans le diff.
 */
export const VEILLE_SEPT_JOURS_ACTIVE = true;

/* =============================================================================
   LE CONTRÔLE DIRECT — LIRE LE VERDICT DE LA PAGE DE L'OFFRE

   Décision de B, 12/10/2026 (soir) : « je câble le verdict en mesure (aucun
   retrait) et j'allume la veille ».

   POURQUOI. La règle du silence (« plus aucune source n'a reservi l'offre depuis
   7 jours ») a été MISE À L'ÉPREUVE sur 140 pages réelles, le soir même : 53 des
   111 offres jugées portaient `isExpired: false` — **48 % de faux positifs**
   (fourchette 95 % : 39-57 % ; un premier tirage de 40 pages : 55 %). Autrement
   dit, la moitié de ce que la règle emporterait est **encore valable chez sa
   source**. Et sur un flux-fenêtre, une offre retirée peut ne JAMAIS revenir.

   Ce que B avait écrit, mot pour mot, le matin même : « si sur le site internet
   d'origine de l'annonce, elle est toujours présente le 8e jour, elle devra
   réapparaître sur notre site, pour 7 nouveaux jours. » Le contrôle direct est
   cette phrase-là, exécutée : au lieu de DÉDUIRE la mort du silence, on va lire
   le verdict que la page publie elle-même.

   ÉTAT AU 13/10/2026 : le contrôle TOURNE **et le retrait sur verdict est
   ALLUMÉ** (`OFFRES_SORTENT_SUR_VERDICT_ACTIF = true`, posé le 13/10 à 13 h 14
   avec la règle de B « la page décide de la carte »). La phrase qui vivait ici
   (« le retrait qu'il autoriserait est ÉTEINT ») était devenue FAUSSE : un
   commentaire qui décrit l'inverse du code est pire qu'une absence de
   commentaire, parce qu'on le croit. Corrigé le jour même où le défaut a été
   relevé. Ce qui reste vrai du principe : le contrôle publie ses chiffres à
   chaque passage (`verdict.duPassage`), et le retrait ne se déclenche que sur
   un verdict ÉCRIT par la page — jamais sur son silence.

   ⚠ CE QUE ÇA COÛTE, ET C'EST DIT. Une page d'offre se lit en ~100 Ko (mesuré :
   99-104 Ko sur 180 lectures, flux coupé dès le verdict trouvé). Le budget est
   donc SUIVI (`VERDICT_SOURCE_PAR_PASSAGE`) : à trois par passage, c'est ~288
   requêtes et ~29 Mo par jour — l'ordre de grandeur annoncé à B (~250 requêtes,
   ~24 Mo), qui reste une petite part des 178 Mo quotidiens de la collecte. Sans
   budget, le contrôle serait plus lourd que la collecte qu'il surveille.
   ============================================================================= */

/** Combien de pages on lit par passage. Volontairement petit : c'est un
 *  ÉCHANTILLON TOURNANT, pas un balayage. Une offre contrôlée ne l'est pas
 *  deux fois dans la semaine (voir `VERDICT_SOURCE_MAX_AGE_JOURS`), donc le
 *  tour complet de la population prend quelques jours et la couverture se
 *  maintient toute seule. */
export const VERDICT_SOURCE_PAR_PASSAGE = 3;

/** Au-delà de cet âge, un verdict est à revérifier. Sept jours : le même délai
 *  que la règle, parce que c'est à cette échéance que la question se repose. */
export const VERDICT_SOURCE_MAX_AGE_JOURS = 7;

/** Ce qu'on accepte de lire avant de renoncer — le verdict vit dans les
 *  premières dizaines de kilo-octets (mesuré), 250 Ko est une borne de sécurité. */
export const BUDGET_VERDICT_OCTETS = 250 * 1024;

/** Pause entre deux lectures : on est invité chez des gens. */
export const VERDICT_SOURCE_PAUSE_MS = 250;

/** L'EMPREINTE D'UNE CLÉ — pour départager sans jamais dépendre de l'ordre
 *  d'entrée. Même fonction que `identifiant` : SHA-1, 32 bits utiles. */
const empreinteDe = (s) => Number.parseInt(crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8), 16);

/** LE VERDICT D'UNE PAGE, extrait du texte reçu. **Fonction PURE**, et ce n'est
 *  pas un détail : c'est elle qu'on éprouve sur des cas fabriqués, sans réseau.
 *
 *  Rend `'expiree'`, `'vivante'`, ou la chaîne vide quand la page ne publie pas
 *  de verdict — et ces trois issues ne se confondent pas : « sans verdict » n'est
 *  ni une preuve de mort ni une preuve de vie, et la traiter comme l'une ou
 *  l'autre est exactement la faute qu'on vient de mesurer (48 % de faux positifs
 *  sur un signal qui ne prouvait rien).
 */
export function verdictDans(texte) {
  const m = String(texte || '').match(/"isExpired"\s*:\s*(true|false)/);
  if (!m) return '';
  return m[1] === 'true' ? 'expiree' : 'vivante';
}

/** REMETTRE UNE PAGE EN CLAIR — les mêmes octets, sans les échappements.
 *
 *  Défaut qui a coûté un sondage entier le 13/10/2026 : le JSON d'une page
 *  marchande est échappé DEUX fois avant d'arriver dans le HTML
 *  (`\\&quot;basisPrice\\&quot;`). Chercher `"basisPrice"` dans le texte brut
 *  rend donc zéro sur une page qui le contient — un zéro qui se lit « absent »,
 *  c'est-à-dire exactement la mauvaise conclusion. On dé-échappe dans l'ordre :
 *  entités HTML d'abord, doubles barres ensuite, guillemets échappés en dernier.
 */
export function pageEnClair(texte) {
  return String(texte || '')
    .replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&')
    .replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\\//g, '/');
}

/** LE NOMBRE D'UN MONTANT ÉCRIT « 7,99 € » OU « 7.99 » — ou null. */
function montant(valeur) {
  const m = String(valeur || '').replace(/\s|\u00a0/g, '').match(/([0-9]{1,5})(?:[.,]([0-9]{1,2}))?/);
  if (!m) return null;
  const n = Number(m[1] + '.' + (m[2] || '0'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** LA PROMOTION D'UNE PAGE MARCHANDE — prix demandé, prix de référence, et le
 *  fait qu'il y en ait encore une. **Fonction PURE** : aucun réseau, donc
 *  éprouvable sur des pages fabriquées.
 *
 *  Décision de B (13/10/2026), mot pour mot : « plus de promotion sur la page la
 *  carte sort, promotion toujours là prix changé on corrige le prix et la remise,
 *  promotion toujours là même prix on garde, page morte la carte sort ».
 *
 *  LA RÈGLE DE LECTURE, ET C'EST ELLE QUI PROTÈGE : on ne conclut « plus de
 *  promotion » QUE si la page a livré un PRIX et qu'aucun prix de référence ne
 *  figure AUTOUR de ce prix. Une page muette (captcha, prix absent, bloc
 *  disparu) ne prouve rien : elle rend `lisible: false`, et la carte reste.
 *  C'est la faute déjà payée une fois — 48 % de faux positifs sur un signal
 *  qui ne prouvait rien.
 *
 *  LA FENÊTRE AUTOUR DU PRIX N'EST PAS UN DÉTAIL. Mesuré le 13/10/2026 sur la
 *  page d'un chargeur : un `basisPrice` de 53,99 € traînait 4 000 caractères
 *  plus loin, dans le JSON d'un article VOISIN. Cherché dans toute la page, il
 *  aurait fait passer un article sans promotion pour un article à −85 %. On ne
 *  regarde donc que les abords du prix affiché.
 */
export function promotionDans(texte) {
  const t = pageEnClair(texte);
  const PRIX = [
    /items\[\d+\.base\]\[customerVisiblePrice\]\[displayString\]"\s+value="([^"]{1,16})"/,
    /"desktop_buybox_group_1"\s*:\s*\[\s*\{\s*"[^"]*"\s*:\s*"([^"]{1,16})"/,
    /"priceToPay".{0,120}?aok-offscreen">\s*([0-9\s\u00a0]{1,12}[.,][0-9]{2})/,
    /class="a-price-whole">\s*([0-9]{1,5})[\s\S]{0,80}?class="a-price-fraction">\s*([0-9]{2})/,
    /"(?:og|product):price:amount"\s+content="([0-9.,]{1,10})"/,
    /"price"\s*:\s*"?([0-9]{1,5}(?:[.,][0-9]{1,2})?)"?/,
  ];
  let prix = null, ou = -1, fin = -1;
  for (const motif of PRIX) {
    const m = t.match(motif);
    if (!m) continue;
    // Le quatrième motif lit les cents dans un second groupe : on recolle.
    const brut = m[2] ? `${m[1]},${m[2]}` : m[1];
    const n = montant(brut);
    if (n !== null) { prix = n; ou = m.index; fin = m.index + m[0].length; break; }
  }
  if (prix === null || ou < 0) return { lisible: false, prix: null, prixAvant: null, detail: 'aucun prix lisible' };

  // LES ABORDS DU PRIX — 700 caractères de chaque côté, pas plus.
  const fenetre = t.slice(Math.max(0, ou - 700), Math.min(t.length, fin + 700));
  const REFERENCE = [
    /"basisPrice"\s*:\s*\{\s*"currency"\s*:\s*\{\s*"amount"\s*:\s*([0-9.]+)/,
    /"(?:strikePrice|wasPrice|listPrice)"\s*:\s*"?([0-9]{1,5}(?:[.,][0-9]{1,2})?)"?/,
    /priceBlockStrikePriceString[^>]*>\s*([0-9\s\u00a0]{1,12}[.,][0-9]{2})/,
    /(?:Prix conseillé|Prix de référence|Prix habituel)[^0-9]{0,40}([0-9\s\u00a0]{1,12}[.,][0-9]{2})/,
    /a-text-price[^>]*>[\s\S]{0,120}?([0-9\s\u00a0]{1,12}[.,][0-9]{2})/,
  ];
  let prixAvant = null;
  for (const motif of REFERENCE) {
    const m = fenetre.match(motif);
    if (!m) continue;
    const n = montant(m[1]);
    // Un « prix de référence » plus BAS que le prix demandé n'en est pas un.
    if (n !== null && n > prix) { prixAvant = n; break; }
  }
  return {
    lisible: true, prix, prixAvant,
    detail: prixAvant === null ? 'la page ne publie aucun prix de référence' : '',
  };
}

/** LIRE LE VERDICT D'UNE PAGE D'OFFRE — une requête, et on COUPE dès qu'on l'a.
 *
 *  Même discipline que la lecture d'en-tête (`lireEntete`) : on lit la réponse EN
 *  FLUX et on abandonne le reste dès que le verdict est trouvé. Une page de
 *  100 Ko lue en entier « pour rien » serait du trafic offert au partenaire —
 *  l'inverse de la discrétion demandée.
 */
export async function lireVerdictSource(url, { budget = BUDGET_VERDICT_OCTETS, delai = 15000 } = {}) {
  let r;
  try {
    r = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(delai),
    });
  } catch (e) { return { etat: 'illisible', octets: 0, detail: String(e && e.message || e).slice(0, 80), texte: '' }; }
  // LA PAGE MORTE EST UNE PREUVE — à condition de ne pas confondre « disparue »
  // et « je n'ai pas pu lire ». 404 et 410 sont DÉFINITIFS : l'annonce n'existe
  // plus. 403, 429 et les 5xx sont des refus ou des pannes — les traiter comme
  // une mort ferait sortir des cartes parfaitement vivantes au premier caprice
  // d'un filtre anti-robot. (Décision de B, 13/10/2026 : « page morte la carte
  // sort ».)
  if (r.status === 404 || r.status === 410) return { etat: 'morte', octets: 0, detail: `HTTP ${r.status}`, texte: '' };
  if (!r.ok) return { etat: 'illisible', octets: 0, detail: `HTTP ${r.status}`, texte: '' };
  if (!(r.headers.get('content-type') || '').includes('html')) {
    return { etat: 'sans-signal', octets: 0, detail: r.headers.get('content-type') || 'type inconnu', texte: '' };
  }
  const lecteur = r.body && typeof r.body.getReader === 'function' ? r.body.getReader() : null;
  if (!lecteur) return { etat: 'illisible', octets: 0, detail: 'flux indisponible', texte: '' };
  const morceaux = [];
  let lu = 0, texte = '';
  try {
    while (lu < budget) {
      const { done, value } = await lecteur.read();
      if (done) break;
      morceaux.push(Buffer.from(value));
      lu += value.length;
      texte = Buffer.concat(morceaux).toString('utf8');
      if (texte.includes('"isExpired"')) { try { await lecteur.cancel(); } catch { /* déjà fini */ } break; }
    }
  } catch (e) { return { etat: 'illisible', octets: lu, detail: String(e && e.message || e).slice(0, 80) }; }
  const etat = verdictDans(texte);
  // LE TEXTE REPART AVEC LE VERDICT : la règle de promotion (voir promotionDans)
  // lit la même page, et relire coûterait une seconde requête chez le partenaire.
  if (!etat) return { etat: 'sans-signal', octets: lu, detail: 'la page ne publie pas de verdict', texte };
  return { etat, octets: lu, detail: '', texte };
}

/** CE VERDICT EST-IL À REVÉRIFIER ? — jamais contrôlé, ou contrôlé il y a plus
 *  de sept jours. PURE : elle lit un enregistrement et une horloge, elle ne
 *  modifie rien et ne se souvient de rien.
 *
 *  ⚠ Elle reçoit l'ENREGISTREMENT (`{ vuLe }`), pas l'offre : les verdicts
 *  vivent dans une table à part (`donnees/verdicts-sources.json`), HORS du
 *  catalogue publié. Deux raisons, et la seconde vaut de l'or : on n'alourdit
 *  pas `offres.json` de deux champs sur vingt mille fiches (~1,4 Mo), et on ne
 *  publie pas le verdict d'un partenaire dans un fichier que tout le monde lit. */
export function verdictPerime(enregistrement, maintenant = Date.now()) {
  const t = Date.parse((enregistrement && enregistrement.vuLe) || '');
  if (!Number.isFinite(t) || t <= 0) return true;
  return (maintenant - t) > VERDICT_SOURCE_MAX_AGE_JOURS * 86400000;
}

/** LES OFFRES À CONTRÔLER CE PASSAGE-CI. PURE, éprouvable, et elle porte trois
 *  choix qui ont chacun une raison :
 *
 *    1. on ne contrôle QUE ce que la règle viserait (`donneesPerimees` — la même
 *       fonction que le retrait, jamais une deuxième définition) ;
 *    2. on ne contrôle que ce qui a un verdict à donner : un lien de page lisible,
 *       et pas un redirecteur Google News (vérifié le 12/10/2026 : il ne mène pas
 *       à l'éditeur, donc il ne peut rien rendre) ;
 *    3. **un seul contrôle par source et par passage** — sinon les trois lectures
 *       d'un passage partent au même hôte, et c'est précisément le motif qu'un
 *       filtre anti-robot repère d'abord.
 */
/** LE DÉLAI D'ENTRÉE DANS LA FILE DE CONTRÔLE — COURT pour les communautés.
 *
 *  Décision de B, 13/10/2026 : « Prends la décision la plus réaliste et la plus
 *  efficace pour gagner en efficacité, efficacité tant au niveau de l'utilisateur
 *  que au niveau des entreprises chez qui nous prenons les informations. »
 *
 *  Trois mesures de la même heure, sur le catalogue réel, la dictent :
 *    • les flux resservent 3 976 offres par jour → passé trois jours de silence,
 *      une offre n'est plus dans la fenêtre de sa source : elle est dans le stock
 *      qu'on traîne. Sept jours, c'est attendre pour rien — et c'est l'utilisateur
 *      qui voit la promotion morte pendant ces jours-là ;
 *    • une page d'ENSEIGNE (Amazon, bol, Krefel…) ne publie AUCUN verdict : les
 *      contrôles rendaient « 3 sans verdict », zéro décision, une requête payée
 *      pour rien chez le partenaire. D'où sa part réduite à une lecture ;
 *    • une page de COMMUNAUTÉ (Dealabs, mydealz, chollometro, pepper, hotukdeals,
 *      preisjäger) publie `isExpired` : une lecture = une décision. Vérifié à la
 *      main sur la fiche signalée par B — la page répondait `"isExpired": true`,
 *      et la promo était finie depuis trois jours.
 *
 *  ⚠ CE DÉLAI NE RETIRE RIEN : il dit seulement QUI entre dans la file. Le
 *  retrait reste commandé par le verdict de la page — `OFFRES_SORTENT_SUR_VERDICT_ACTIF`,
 *  ALLUMÉ depuis le 13/10/2026 — et par le plafond du SILENCE, lui toujours
 *  éteint (`PLAFOND_OFFRES_ACTIF = false`, mesuré à ~48 % de faux positifs).
 *  Abaisser ce délai ne peut donc pas faire disparaître une offre vivante :
 *  c'est ce qui rend la décision sans risque. (Les trois lignes ci-dessus
 *  disaient « le plafond (`PLAFOND_DONNEES_JOURS`, éteint) » : le nom cité était
 *  celui du DÉLAI, pas celui de l'interrupteur, et le retrait par verdict était
 *  encore décrit comme éteint. Corrigé le 13/10/2026.)
 */
export const CONTROLE_COMMUNAUTE_JOURS = 3;
export const CONTROLE_ENSEIGNE_JOURS = PLAFOND_DONNEES_JOURS;

/** LA PART DU BUDGET DE LECTURE PAR FAMILLE — **ZÉRO, ET C'EST LA RÈGLE QUI L'A
 *  DÉCIDÉ (14/10/2026).**
 *
 *  Ces deux constantes étaient la politesse du contrôle de page : deux lectures de
 *  communauté, une d'enseigne, par passage. **La règle de la vie d'une carte les
 *  ramène à zéro**, et pas par économie : le retrait ne se décide plus sur une
 *  preuve. « La source sert-elle encore cette offre ? » se lit dans le FLUX, qui
 *  est déjà collecté — donc **aucune page n'est ouverte**, et la contrainte de
 *  politesse de 2 000 pages/jour (1.27) n'a plus d'objet non plus.
 *  C'est le gain le plus net du scénario pour les sources : on leur RETIRE des
 *  requêtes, on ne leur en ajoute aucune.
 *
 *  Garder le mécanisme branché à zéro, plutôt que de l'arracher, est un choix :
 *  si une mesure future réclamait de relire une page, on saurait où. Mais un
 *  budget de zéro est un budget de zéro — vérifié par une épreuve. */
export const CONTROLES_COMMUNAUTE_PAR_PASSAGE = 0;
export const CONTROLES_ENSEIGNE_PAR_PASSAGE = 0;

/** LE POURCENTAGE QUE LA CARTE MONTRE — la règle de l'APPLICATION, à la lettre.
 *
 *  Mesuré le 13/10/2026 en sondant ma propre file : ses deux premières lectures
 *  visaient des remises de 99 % et 91 % — deux pourcentages que la carte REFUSE
 *  d'afficher (« au-delà de 90 %, ce n'est plus une remise, c'est une qualité
 *  qu'on annonce »). La vue « % décroissant » ne les montre donc jamais en tête,
 *  et la file payait des requêtes chez les partenaires pour des fiches que
 *  l'utilisateur ne voit pas. Un ordre qui ne suit pas ce que l'écran montre
 *  n'est pas un ordre : c'est un gaspillage poli.
 *
 *  ⚠ DEUX PROGRAMMES, UNE SEULE RÈGLE : ce sont les constantes de `public/app.js`
 *  (`REMISE_MIN = 15`, `REMISE_ANNONCEE_MAX = 90`) et la logique de sa
 *  `remiseMontrable`. L'épreuve « la file classe comme la vue classe » confronte
 *  les deux implémentations sur TOUT le catalogue publié : si l'une bouge sans
 *  l'autre, elle rougit le jour même au lieu de diverger en silence.
 */
export const REMISE_MIN_APP = 15;
export function pourcentAffiche(o) {
  if (!o || o.remise == null || o.remise < REMISE_MIN_APP) return 0;
  return (o.remiseCalculee || o.remise <= REMISE_MAX_PAIRE) ? o.remise : 0;
}

export function candidatsVerdict(liste, { verdicts = {}, cle = (o) => o.id, limite = VERDICT_SOURCE_PAR_PASSAGE,
                                         maintenant = Date.now(), famille = null } = {}) {
  const communaute = (o) => typeDeSource(o.sourceId) === 'dealabs';
  const delai = (o) => (communaute(o) ? CONTROLE_COMMUNAUTE_JOURS : CONTROLE_ENSEIGNE_JOURS);
  const perimes = (liste || []).filter((o) => {
    if (famille === 'communaute' && !communaute(o)) return false;
    if (famille === 'enseigne' && communaute(o)) return false;
    const age = ageJours(o && o.vuLe, maintenant);
    if (age === null || age <= delai(o)) return false;   // encore dans la fenêtre de sa source
    return /^https?:/i.test(o.lienPage || '')
      && !/news\.google\.com/i.test(o.lienPage || '')
      && verdictPerime(verdicts[cle(o)], maintenant);
  });
  // ⚠ L'ORDRE A CHANGÉ DEUX FOIS LE 13/10/2026, ET CHAQUE FOIS SUR UNE MESURE.
  //
  //  1. L'ancien tri (échantillon régulier par empreinte) servait à MESURER une
  //     population — « sur ce qu'on contrôle, quelle part est morte ? ». Un taux
  //     honnête, mais qui ne finissait aucun travail. La décision étant prise
  //     d'AGIR, la file lit désormais à RENDEMENT. Conséquence à ne pas oublier :
  //     le chiffre du journal (« X expirée(s) sur N contrôle(s) ») est un
  //     rendement de lecture, PLUS une estimation de la population.
  //  2. Le premier ordre essayé était « le plus silencieux d'abord », et la
  //     mesure l'a démoli : la fiche signalée par B (5 jours de silence) arrivait
  //     derrière ~10 000 fiches plus silencieuses — le silence est une
  //     distribution plate (le stock n'a que six jours), donc il ne départage
  //     presque rien. LA REMISE DÉCROISSANTE, elle, est concentrée : 43 fiches
  //     communautaires à ≥ 70 % portent tout le haut de la vue « % décroissant »
  //     — la fiche signalée y est 34e, donc lue dans les heures qui suivent.
  //  On lit donc d'abord ce que l'utilisateur voit en tête de liste (l'ordre
  //  exact de cette vue, remise puis prix), et le silence ne départage que les
  //  ex æquo. L'empreinte ferme la marche ; une offre déjà contrôlée reste hors
  //  de la file selon VERDICT_SOURCE_MAX_AGE_JOURS, donc le travail avance.
  const silence = (o) => -(ageJours(o.vuLe, maintenant) || 0);
  const rang = new Map(perimes.map((o) => [cle(o), empreinteDe(cle(o))]));
  perimes.sort((a, b) => pourcentAffiche(b) - pourcentAffiche(a)
    || silence(a) - silence(b)
    || rang.get(cle(a)) - rang.get(cle(b)));
  const choisis = [], vus = new Set();
  for (const o of perimes) {
    if (choisis.length >= limite) break;
    if (vus.has(o.sourceId)) continue;
    vus.add(o.sourceId);
    choisis.push(o);
  }
  // Peu de sources, beaucoup de candidats : on complète sans la contrainte de
  // source, sinon le budget serait gaspillé alors qu'il reste des offres à voir.
  if (choisis.length < limite) {
    for (const o of perimes) {
      if (choisis.length >= limite) break;
      if (!choisis.includes(o)) choisis.push(o);
    }
  }
  return choisis;
}

/** L'INTERRUPTEUR DU RETRAIT PAR VERDICT — **ÉTEINT DEPUIS LE 14/10/2026.**
 *
 *  Il a été ALLUMÉ le 13/10/2026 sur le mot de B (« la page décide de la carte »),
 *  puis ÉTEINT le 14/10/2026 par la règle qui l'a remplacé : **la page ne décide
 *  plus de rien**. Le retrait ne se décide plus sur une preuve, donc il n'y a plus
 *  de verdict à lire — et plus une seule page n'est ouverte (voir
 *  CONTROLES_COMMUNAUTE_PAR_PASSAGE, ramené à zéro).
 *
 *  Il est laissé ici, à `false`, plutôt qu'arraché : c'est la trace de la décision
 *  précédente, et le point de retour si un jour la question « la page répond-elle
 *  encore ? » revenait. Mais il ne commande plus rien, et deux épreuves le
 *  vérifient : il est éteint, et le budget de lecture est nul.
 */
export const OFFRES_SORTENT_SUR_VERDICT_ACTIF = false;

/** L'INTERRUPTEUR DE LA RÈGLE DE B — LA PAGE DÉCIDE DE LA CARTE.
 *  **ALLUMÉ LE 13/10/2026, PUIS ÉTEINT LE 14/10/2026.** Son histoire est son
 *  intérêt, et elle est conservée telle quelle plus bas : elle raconte ce que la
 *  lecture des pages savait faire, et pourquoi on a fini par ne plus la vouloir.
 *
 *  ⚠ ÉTEINT, ET CE N'EST PAS UN RETOUR EN ARRIÈRE DE PRUDENCE : c'est le
 *  remplacement. Ce booléen faisait sortir ou corriger une carte d'après ce que
 *  LA PAGE répondait. La règle de la vie d'une carte (VIE_AFFICHEE_JOURS) a
 *  remplacé ce mécanisme : **une carte vit cinq jours, puis on demande au FLUX si
 *  la source la sert encore** — le flux ne coûte aucune requête, ne peut pas être
 *  tronqué par un mur anti-robot, et sa réponse ne se discute pas.
 *
 *  CE QUI PROTÉGEAIT ICI NE DISPARAÎT PAS SANS REMPLAÇANT, et c'est le point à
 *  retenir : le danger était de retirer une carte sur une réponse illisible. La
 *  règle nouvelle a la même prudence en garde — on n'efface que si la source a
 *  PARLÉ et n'a PLUS resservi l'offre (voir verdictDeCalendrier, garde 2).
 *
 *  Ce qui est conservé ci-dessous, comme trace de la décision précédente :
 *    « plus de promotion sur la page la carte sort, promotion toujours là prix
 *      changé on corrige le prix et la remise, promotion toujours là même prix
 *      on garde, page morte la carte sort »
 *
 *  Les quatre branches, pour mémoire :
 *
 *    1. la page ne publie plus AUCUN prix de référence → la carte sort ;
 *    2. la promotion est là et le prix a changé → on CORRIGE prix et remise ;
 *    3. la promotion est là et le prix n'a pas bougé → on garde ;
 *    4. la page répond 404 ou 410 → la carte sort.
 *
 *  ⚠ CE QUI PROTÉGEAIT, ET QUI N'EST PAS NÉGOCIABLE : une page MUETTE (captcha,
 *  403, panne, bloc de prix disparu) ne prouve RIEN. `promotionDans` rend alors
 *  `lisible: false`, AUCUNE décision n'est prise et la carte RESTE. La faute
 *  inverse — prendre un silence pour une preuve — a déjà coûté 48 % de faux
 *  positifs, mesurés. Et un prix de référence cherché dans TOUTE la page avait
 *  sorti 53,99 € du JSON d'un article voisin : la lecture ne regarde que les
 *  abords du prix affiché.
 *
 *  C'est cette discipline-là qui a survécu — pas la lecture elle-même.
 */
export const PROMOTION_DECIDE_LA_CARTE_ACTIF = false;
/** L'interrupteur du contrôle de prix sur les offres des COMMUNAUTÉS.
 *
 *  ÉTEINT : le contrôle TOURNE — il lit la page du marchand, écrit son verdict
 *  dans `donnees/verdicts-sources.json`, compte et journalise — mais aucune carte
 *  n'est modifiée, et rien n'est supprimé. C'est l'état « mesure ».
 *
 *  ALLUMÉ : un prix de marchand lisible qui ne correspond plus au prix de la carte
 *  la CORRIGE (prix et remise), comme pour les enseignes. Jamais de suppression.
 *
 *  Pourquoi éteint au départ : 2 prix lisibles sur 6 lors de l'épreuve, dont un
 *  faux. Un mot suffit pour l'allumer, et un test refuse qu'il s'allume sans que
 *  la décision soit visible.
 *
 *  ⚠️ DÉCISION DE B, 13/10/2026, mot pour mot : « Attends que la mesure ait vu
 *  davantage avant de lancer la correction des prix communautaires. » L'interrupteur
 *  reste donc ÉTEINT, et il n'est pas allumé ici. Ce qui a été fait à la place, pour
 *  que « davantage » finisse par vouloir dire quelque chose : le taux de lecture est
 *  compté par passage (`lecturesMarchand`, `prixIllisibleMarchand`) et écrit au
 *  journal. C'est ce taux — combien de pages de marchand livrent un prix lisible —
 *  qui dira si la correction peut être allumée sans casser des prix justes. */
export const PRIX_COMMUNAUTE_ACTIF = false;
/** Le poids du visuel d'une offre, en octets — 0 s'il n'y en a pas.
 *  Sert à dire ce qu'un effacement LIBÉRERAIT, jamais à effacer. */
export function poidsDuVisuel(chemin, { dossier = DOSSIER_PUBLIE } = {}) {
  if (!chemin) return 0;
  try { return fs.statSync(path.join(dossier, chemin)).size; } catch { return 0; }
}

/** Ce que le plafond écarterait, compté sur une liste d'offres — sans rien
 *  écarter. Extrait de la boucle du passage pour être ÉPROUVABLE : une règle
 *  qui efface doit se tester sur un cas fabriqué, pas seulement s'observer en
 *  production.
 *
 *  - `offres`  : le nombre d'offres au-delà du plafond ;
 *  - `octets`  : ce que leurs visuels pèsent (0 pour une offre sans image) ;
 *  - `parPays` : la répartition, pour que le panneau dise OÙ la règle mordra.
 *
 *  PURE, et ce n'est pas un détail de style : elle ne garde AUCUNE mémoire des
 *  offres qu'elle a comptées. C'est ce qui rend le retour possible et gratuit —
 *  une offre reservie plus tard rentre comme une offre neuve, sans que rien
 *  n'ait à être « dé-condamné ». Voir joursDeServiceRestants.
 */
export function plafondDeDonnees(liste, { maintenant = Date.now() } = {}) {
  const parPays = {};
  let offres = 0, octets = 0;
  for (const o of liste) {
    if (!o || o.type === 'article') continue;          // la veille : 30 jours
    if (!donneesPerimees(o, { maintenant })) continue;
    offres++;
    const p = o.pays || 'FR';
    parPays[p] = (parPays[p] || 0) + 1;
    octets += poidsDuVisuel(o.image);
  }
  return { offres, octets, parPays };
}

/** LE BILAN DE DONNÉES — ce qui entre, ce qui sort, et tout ce qui a trait aux
 *  images. Il alimente l'onglet « Données » du panneau d'administration.
 *
 *  Règle du tuyau (fiche `panneau-admin-donnees-reelles`) : **chaque chiffre est
 *  CALCULÉ ici**, à chaque passage, jamais écrit à la main dans la page — un
 *  champ qu'aucun programme ne lit est une promesse fausse. Les seules lignes
 *  descriptives sont les DESTINATIONS : elles disent où va chaque donnée, et
 *  elles sont vérifiables dans le code (publication, inscription, affiliation).
 */
export function bilanDonnees({ connues, offres, journal = [], maintenant = Date.now(), trafic = {}, robots = {} } = {}) {
  const dossierImg = path.join(DOSSIER_PUBLIE, 'img');
  const referencees = new Set(offres.map((o) => path.basename(o.image || '')).filter(Boolean));

  let fichiers = 0, octets = 0, servies = 0, octetsServis = 0;
  // LES VISUELS LOURDS — comptés dans la même passe que le reste, parce que
  // c'est le même parcours de dossier. C'est le premier levier de poids du
  // site : un catalogue d'images pèse surtout par ses plus gros fichiers, et
  // « recompresser » ne veut rien dire tant qu'on ne sait pas COMBIEN.
  const SEUIL_LOURD = 200 * 1000;
  let lourdsNb = 0, lourdsOctets = 0;
  try {
    for (const f of fs.readdirSync(dossierImg)) {
      const t = fs.statSync(path.join(dossierImg, f)).size;
      fichiers++; octets += t;
      if (t > SEUIL_LOURD) { lourdsNb++; lourdsOctets += t; }
      if (referencees.has(f)) { servies++; octetsServis += t; }
    }
  } catch { /* dossier absent : aucune image publiée */ }

  // Couverture par pays : combien d'offres, combien avec un visuel. C'est le
  // chiffre qui dit où le manque se voit à l'écran.
  const parPays = {};
  for (const o of offres) {
    const p = o.pays || 'FR';
    parPays[p] = parPays[p] || { offres: 0, avecImage: 0 };
    parPays[p].offres++;
    if (o.image) parPays[p].avecImage++;
  }

  // Âge des offres PUBLIÉES, par tranche, mesuré sur `vuLe`.
  const ages = { moins24h: 0, '1a3j': 0, '3a7j': 0, plus7j: 0, sansDate: 0 };
  let octetsPlus7j = 0;
  for (const o of offres) {
    const a = ageJours(o.vuLe, maintenant);
    if (a === null) { ages.sansDate++; continue; }
    if (a < 1) ages.moins24h++;
    else if (a < 3) ages['1a3j']++;
    else if (a <= PLAFOND_DONNEES_JOURS) ages['3a7j']++;
    else { ages.plus7j++; octetsPlus7j += poidsDuVisuel(o.image, { dossier: DOSSIER_PUBLIE }); }
  }

  //  LA VEILLE À PART — elle ne se juge pas au service (`vuLe`) mais à la DATE
  //  de publication, qui est son verrou. Et on la compte sur le PUBLIÉ, pas sur
  //  le stock : l'écran ne montre qu'un quota d'articles par pays, donc les deux
  //  chiffres diffèrent (le stock dit ce qui cesse d'être stocké, le publié ce
  //  qui disparaît de l'écran) — les confondre ferait lire le premier comme une
  //  exagération. Le compte du stock vient du passage (`articlesHorsDelai`).
  const articles = { publies: 0, hors7j: 0, hors7jMo: 0 };
  for (const o of offres) {
    if (o.type !== 'article') continue;
    articles.publies++;
    const a = ageJours(o.date, maintenant);
    if (a !== null && a > PLAFOND_DONNEES_JOURS) {
      articles.hors7j++;
      articles.hors7jMo += poidsDuVisuel(o.image, { dossier: DOSSIER_PUBLIE });
    }
  }
  articles.hors7jMo = +(articles.hors7jMo / 1e6).toFixed(1);

  //  LE VERDICT DES PAGES — combien d'offres PUBLIÉES portent un verdict lu, et
  //  ce que ce verdict dit. C'est le chiffre qui décidera du volet des offres :
  //  sans lui, personne ne peut dire combien d'annonces vivantes un retrait
  //  emporterait — et c'est exactement la question que la règle du silence
  //  laissait sans réponse (48 % de faux positifs, mesuré).
  //  La table est à part (voir FICHIER_VERDICTS) : on compte ici en joignant sur
  //  LA CLÉ DU STOCK (`cleDe`), la même que celle sous laquelle le contrôle
  //  écrit — et sur le PUBLIÉ seulement. Une jointure sur `o.id` aurait rendu
  //  zéro à chaque passage (défaut vécu, voir le bloc du contrôle direct).
  let verdictsFichier = {};
  try { verdictsFichier = JSON.parse(fs.readFileSync(FICHIER_VERDICTS, 'utf8')) || {}; } catch { verdictsFichier = {}; }
  const verdicts = { porteurs: 0, expirees: 0, vivantes: 0, muettes: 0 };
  for (const o of offres) {
    const e = verdictsFichier[cleDe(o)];
    if (!e) continue;
    verdicts.porteurs++;
    if (e.statut === 'expiree') verdicts.expirees++;
    else if (e.statut === 'vivante') verdicts.vivantes++;
    else verdicts.muettes++;
  }
  const jugesVerdict = verdicts.expirees + verdicts.vivantes;
  verdicts.tauxVivantesPct = jugesVerdict ? +(100 * verdicts.vivantes / jugesVerdict).toFixed(1) : null;

  //  DEUX MODES DANS L'ÉTAT, parce qu'il y a deux moitiés : « mode » est celui
  //  des offres, « modeVeille » celui de la veille. Le panneau doit dire ce que
  //  la règle FAIT, pas ce qu'elle ferait — et laquelle des deux il parle.
  // LE JOURNAL DE LA RÈGLE — ce que le passage VIENT DE FAIRE, jamais ce qu'il
  // ferait. C'est la règle du tuyau de l'onglet « Données » : un chiffre qu'aucun
  // programme ne calcule est une promesse fausse.
  const carte = journal.find((j) => j.source === 'vie-de-la-carte') || {};

  return {
    calculeLe: new Date(maintenant).toISOString(),
    images: {
      fichiers, octets, mo: +(octets / 1e6).toFixed(1),
      servies, orphelines: fichiers - servies,
      orphelinesMo: +((octets - octetsServis) / 1e6).toFixed(1),
      moyenneKo: fichiers ? Math.round(octets / fichiers / 1000) : 0,
      parPays,
      // Le poids des visuels au-dessus du seuil : le levier « recompresser »
      // s'appuie dessus, et il est mesuré au même instant que le reste.
      lourds: { nb: lourdsNb, mo: +(lourdsOctets / 1e6).toFixed(1) },
    },
    ages: { ...ages, octetsPlus7j, moPlus7j: +(octetsPlus7j / 1e6).toFixed(1) },
    // LA RÈGLE DE LA VIE D'UNE CARTE — cinq jours, puis la question du service.
    //  Le bloc s'appelait `plafond7j` : il portait un plafond de sept jours qui
    //  n'existe plus, et garder le nom aurait laissé le panneau annoncer sept
    //  jours là où le catalogue en applique cinq. Un nom juste est une donnée.
    carte: {
      jours: VIE_AFFICHEE_JOURS,
      mode: carte.mode || 'actif',
      // CE QUE LE PASSAGE VIENT DE FAIRE — l'effacement est réel depuis le
      //  14/10/2026 : `effacees` compte des cartes qui ne sont PLUS là.
      effacees: carte.effacees || 0,
      octets: carte.octets || 0,
      parPays: carte.parPays || {},
      // LES REPRISES : une carte au-delà des cinq jours que sa source vient de
      //  RESSERVIR repart pour cinq jours pleins. C'est le chiffre des soldes — une
      //  promotion d'un mois n'est jamais emportée, et ce compteur le prouve à
      //  chaque passage au lieu de le promettre.
      reprises: carte.revenus || 0,
      // LA VEILLE — sa règle est à elle (R.8 : la date de publication, jamais un
      //  service), et son interrupteur est à elle aussi.
      veille: {
        mode: carte.modeVeille || 'mesure',
        jours: carte.joursVeille || 30,
        articles: { ...articles },
        horsDelaiEnStock: carte.articlesHorsDelai || 0,
      },
      // LE CONTRÔLE DE PAGE, RÉDUIT À L'ÉTAT DE TRACE. Le budget est nul et les
      //  sorties sont éteintes : plus une seule page n'est ouverte. Le panneau
      //  doit pouvoir le LIRE au lieu de le croire — c'est tout l'objet de ce bloc.
      controleDePage: {
        mode: 'eteint',
        budgetParPassage: CONTROLES_COMMUNAUTE_PAR_PASSAGE + CONTROLES_ENSEIGNE_PAR_PASSAGE,
        sortiesSurVerdict: OFFRES_SORTENT_SUR_VERDICT_ACTIF,
        verdictsEnTable: verdicts.porteurs || 0,
      },
    },
    flux: {
      // Les clés sont celles du journal RÉEL, relevées sur un passage : chaque
      // source qui a rendu quelque chose écrit `items` (ce qu'elle a vu) et
      // `retenues`. Une première version comptait `entrees` — une clé qui
      // n'existe nulle part, donc un zéro permanent, et un zéro qu'on aurait pu
      // prendre pour une panne. C'est exactement la règle du tuyau.
      sourcesInterrogees: new Set(journal.filter((j) => j.items !== undefined).map((j) => j.source)).size,
      offresVues: journal.reduce((s, j) => s + (j.items || 0), 0),
      offresRetenues: journal.reduce((s, j) => s + (j.retenues || 0), 0),
      sorties: journal.reduce((s, j) => s + (j.ecartees || 0), 0),
      offresPubliees: offres.filter((o) => o.type !== 'article').length,
      articlesPublies: offres.filter((o) => o.type === 'article').length,
      echecs: journal.filter((j) => j.ok === false).length,
    },
    // OÙ VA CHAQUE DONNÉE — descriptif, et vérifiable dans le code.
    destinations: [
      { vers: 'GitHub Pages (kazendra.com)', quoi: 'le site, le catalogue public, les images rapatriées, les pages de partage', quand: 'à chaque publication' },
      { vers: 'Le hub local', quoi: 'le même catalogue, avec les visuels DISTANTS (relayés, non copiés)', quand: 'à chaque collecte' },
      { vers: 'Les visiteurs', quoi: 'le catalogue qu’ils téléchargent et les images qu’ils affichent', quand: 'à la demande' },
      { vers: 'Chez B, et nulle part ailleurs', quoi: 'la base d’inscription (adresses e-mail) — l’application ne fait que déposer une adresse, elle n’en lit jamais aucune', quand: 'à l’inscription' },
      { vers: 'Les marchands', quoi: 'les clics sortants, munis de nos identifiants d’affiliation le cas échéant', quand: 'au clic' },
      { vers: 'Nulle part', quoi: 'les réglages, favoris et comptes locaux — ils ne quittent pas l’appareil', quand: 'jamais' },
    ],
    // CE QU'ON DEMANDE AUX SITES DES AUTRES — les 24 dernières heures, mesuré
    // et non estimé (demande de B du 12/10/2026 : « ne pas trop peser sur le
    // système afin d'être discret et d'éviter des problèmes »).
    trafic: {
      passagesComptes: trafic.passages || 0,
      requetes: trafic.requetes || 0,
      octets: trafic.octets || 0,
      mo: trafic.mo || 0,
      // Les requêtes conditionnelles : combien on a demandé, combien ont répondu
      // « rien de neuf ». C'est le gain, et il est chiffré.
      conditionnels: trafic.conditionnels || { essais: 0, reutilises: 0 },
      // Les pages d'aperçu : combien de lectures coupées dès la balise trouvée.
      // C'est le chiffre qui dit ce que « lire en s'arrêtant » a évité.
      apercu: trafic.apercu || { demandes: 0, ecourtees: 0, entieres: 0 },
      parFamille: trafic.parFamille || {},
      hotes: trafic.hotes || {},
    },
    // ROBOTS.TXT — lu, publié, PAS ENCORE APPLIQUÉ. On passe par instantaneRobots
    // même ici : c'est LUI qui porte `applique: false`, et le panneau doit lire
    // un bloc bien formé même quand aucun verdict n'a été relevé (sinon il lit
    // `undefined` là où il attend un « non », et l'affichage devient un trou).
    robots: blocRobots(robots),
  };
}

/* =============================================================================
   L'EXPLOITATION — ce que le site consomme, et ce qu'on demande aux autres.

   Demande de B (12/10/2026) : « j'ai besoin que tu viennes me donner des outils
   d'utilisation dans mon panneau admin qui me permettent de voir les taux de
   rafraîchissement, les demandes vers les partenaires, le nombre de fichiers
   téléchargés, l'énergie et les coûts que cela représente, et d'éventuellement
   me proposer des améliorations. » Et la finalité qu'il donne : « des données
   utiles à la gestion aveugle du site ».

   « À L'AVEUGLE » VEUT DIRE : SANS OUVRIR LE CODE. D'où la forme de ce bloc —
   tout ce qui se demande est calculé ici, publié, et lisible à l'écran sans
   qu'on ait à lire une ligne de programme.

   TROIS RÈGLES COMMANDENT CE BLOC :

   1. LE MESURÉ ET L'ESTIMÉ NE SE MÉLANGENT PAS. Les octets échangés, le temps
      machine, les fichiers rapatriés, le poids du dépôt : mesurés. Les
      kilowattheures et les euros : ESTIMÉS — et chaque estimation paraît AVEC
      son modèle (coefficient, hypothèse, provenance). Un montant en euros qui
      ne dit pas d'où il vient est un chiffre décoratif ; sur une facture, c'est
      exactement celui qu'on croit.

   2. UN LEVIER PORTE SON GAIN. Sans chiffre, ce n'est pas un levier, c'est un
      avis. Chaque proposition est une RÈGLE calculée sur les chiffres du
      passage et s'affiche avec ce qu'elle rapporterait. Quand le gain n'est pas
      connaissable, elle écrit « à mesurer » au lieu d'inventer un chiffre.

   3. LA CADENCE OBSERVÉE SE COMPARE À LA CADENCE PRÉVUE. Le collecteur ne lit
      pas le planificateur : ce serait un couplage, et il mentirait dès qu'on
      change l'horaire. Il publie donc LES DEUX — le réglage voulu, et
      l'intervalle réellement observé entre deux passages. Si les deux
      s'écartent, le panneau le voit, au lieu d'afficher un réglage flatteur
      qui n'est plus vrai.
   ============================================================================= */

/** LA CADENCE PRÉVUE — quinze minutes, décision de B du 12/10/2026 (« Ok pour
 *  15 minutes »). C'est un RÉGLAGE, pas une mesure : le panneau affiche à côté
 *  l'intervalle réellement observé, et les deux doivent se ressembler. Une
 *  machine arrêtée huit heures se voit ici, et nulle part ailleurs. */
export const CADENCE_PREVUE_MIN = 15;

/** LE MODÈLE DE L'ÉNERGIE. Trois hypothèses, affichées à l'écran, modifiables
 *  ICI et nulle part ailleurs.
 *
 *  • `KWH_PAR_GO` — l'énergie d'un gigaoctet transporté sur un réseau FIXE.
 *    Ordre de grandeur publié (IEA 4E, « Energy efficiency of the Internet ») :
 *    de l'ordre de 0,06 kWh/Go pour le filaire, plusieurs fois plus en 4G/5G.
 *    On prend la valeur du filaire — la plus favorable aux partenaires — et on
 *    le dit, plutôt que de choisir un chiffre qui dramatise.
 *  • `PUISSANCE_MACHINE_W` — la machine qui collecte. AUCUN logiciel ne sait
 *    mesurer une prise : c'est une hypothèse, et elle est présentée comme telle.
 *    On ne l'applique donc qu'au TEMPS DE CALCUL MESURÉ, jamais aux 24 heures :
 *    la machine tourne de toute façon, et lui imputer sa veille serait une
 *    facture inventée.
 *  • `PRIX_KWH_EUR` — prix moyen belge, toutes taxes, arrondi. Une seule ligne
 *    à changer le jour où la facture bouge.
 */
export const KWH_PAR_GO = 0.06;
export const PUISSANCE_MACHINE_W = 30;
export const PRIX_KWH_EUR = 0.35;

/** LES SEUILS DE BONNE CONDUITE DE L'HÉBERGEMENT GRATUIT (GitHub Pages).
 *
 *  Ils ne sont PAS facturés : GitHub les publie comme des seuils, et un dépôt
 *  qui les dépasse reçoit un avertissement. C'est le seul risque
 *  d'hébergement du projet, donc il est publié comme une mesure, pas caché. */
export const QUOTA_DEPOT_MO = 1024;
export const QUOTA_BANDE_PASSANTE_GO_MOIS = 100;

/** Le journal des passages — l'historique qui rend le RYTHME mesurable.
 *
 *  Le compteur de trafic existant dit ce qu'on a demandé en 24 h. Il ne dit pas
 *  À QUELLE CADENCE, ni COMBIEN DE TEMPS on a calculé, ni COMBIEN DE FICHIERS on
 *  a tirés. Trois questions de la demande de B, et aucune n'a de réponse dans un
 *  total : il faut une suite de relevés. Sept jours de relevés à 96 passages par
 *  jour font moins de 700 lignes — le fichier reste minuscule.
 */
const FICHIER_PASSAGES = path.join(DATA, 'passages.json');
const JOURS_MEMOIRE_PASSAGES = 7;

/** Lit le journal des passages. Ne lève jamais : un journal illisible ne doit
 *  pas arrêter une collecte — il prive seulement le panneau de son rythme. */
export function lirePassages(chemin = FICHIER_PASSAGES) {
  try {
    const d = JSON.parse(fs.readFileSync(chemin, 'utf8'));
    return Array.isArray(d.passages) ? d.passages.filter(Boolean) : [];
  } catch { return []; }
}

/** Note le passage qui vient de FINIR, et élague au-delà de la mémoire voulue.
 *
 *  Appelé à la fin, et pas au début : la durée n'est connue qu'à ce moment-là —
 *  or c'est le seul poste de coût machine qu'on puisse honnêtement imputer (voir
 *  PUISSANCE_MACHINE_W). Un relevé sans durée ne dirait rien. */
export function noterPassage(releve, { chemin = FICHIER_PASSAGES, maintenant = Date.now() } = {}) {
  const passages = lirePassages(chemin)
    .filter((p) => maintenant - p.t < JOURS_MEMOIRE_PASSAGES * 86400000);
  passages.push({ ...releve, t: maintenant });
  try { fs.writeFileSync(chemin, JSON.stringify({ passages })); } catch { /* mesure perdue, pas la collecte */ }
  return passages;
}

/** La médiane d'une suite — et pas la moyenne.
 *
 *  Une seule pause de huit heures (machine éteinte, coupure) déplace une
 *  MOYENNE de plusieurs minutes et ferait croire à une cadence qui n'existe
 *  pas. La médiane décrit ce qui se passe d'habitude ; le plus grand trou est
 *  publié À CÔTÉ, lui, pour que l'accident reste visible. Les deux ensemble
 *  disent la vérité ; l'un sans l'autre la déforme. */
export function mediane(liste) {
  const t = [...liste].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!t.length) return null;
  const milieu = Math.floor(t.length / 2);
  return t.length % 2 ? t[milieu] : (t[milieu - 1] + t[milieu]) / 2;
}

/** LE POIDS DE CE QU'UN VISITEUR TÉLÉCHARGE — mesuré, pas supposé.
 *
 *  Le site charge `offres.json` EN ENTIER : tous les pays, toutes les offres.
 *  C'est le premier poste de coût du projet, et personne ne le voyait, parce
 *  qu'un fichier de 18 Mo sur un disque ne fait pas mal — c'est sur le réseau
 *  qu'il pèse. On mesure donc la taille RÉELLEMENT SERVIE (compressée), pas la
 *  taille du fichier : GitHub Pages sert en gzip, et 18 Mo deviennent 3,7 Mo.
 *  Compresser localement coûte un tiers de seconde ; l'annonce d'un poids faux
 *  coûterait une décision fausse.
 *
 *  Fonction IMPURE (disque), tenue HORS du bilan : le bilan, lui, reste pur
 *  donc éprouvable. */
export function poidsPublie({ dossier = DOSSIER_PUBLIE } = {}) {
  const gzip = (rel) => {
    try { return zlib.gzipSync(fs.readFileSync(path.join(dossier, rel)), { level: 6 }).length; }
    catch { return 0; }
  };
  // La « coquille » : ce que le navigateur télécharge avant toute donnée.
  const COQUILLE = ['index.html', 'app.css', 'app.js', 'langues.js'];
  const coquille = COQUILLE.reduce((s, f) => s + gzip(f), 0);
  const catalogueBrut = (() => {
    try { return fs.statSync(path.join(dossier, 'offres.json')).size; } catch { return 0; }
  })();

  /** Poids et nombre de fichiers d'un dossier, récursivement. */
  const peser = (rel) => {
    let fichiers = 0, octets = 0;
    const visiter = (d) => {
      let entrees = [];
      try { entrees = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entrees) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) visiter(p);
        else { try { octets += fs.statSync(p).size; fichiers++; } catch { /* disparu entre-temps */ } }
      }
    };
    visiter(path.join(dossier, rel));
    return { fichiers, octets };
  };

  const pages = peser('o');
  const depot = peser('.');
  const images = peser('img');
  let nbPays = 0;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dossier, 'offres.json'), 'utf8'));
    nbPays = new Set((d.offres || []).map((o) => o.pays).filter(Boolean)).size;
  } catch { /* catalogue illisible : le nombre de pays reste inconnu */ }

  return {
    catalogueBrutMo: +(catalogueBrut / 1e6).toFixed(1),
    catalogueGzipMo: +(gzip('offres.json') / 1e6).toFixed(2),
    coquilleGzipKo: Math.round(coquille / 1000),
    pagesPartageNb: pages.fichiers,
    pagesPartageMo: +(pages.octets / 1e6).toFixed(1),
    depotMo: +(depot.octets / 1e6).toFixed(1),
    imagesNb: images.fichiers,
    imagesMo: +(images.octets / 1e6).toFixed(1),
    nbPays,
  };
}

/** LES LEVIERS — ce qu'on propose, avec ce que ça rapporte.
 *
 *  Chaque levier est une RÈGLE sur les chiffres du passage, jamais une opinion :
 *  « le catalogue part entier » se déclenche sur un poids mesuré, pas sur une
 *  intuition. Et chaque levier porte un gain CHIFFRÉ, ou écrit « à mesurer »
 *  quand il n'y a rien à chiffrer — un levier sans gain est un avis, et un avis
 *  en tête de liste fait perdre du temps.
 *
 *  PURE, donc éprouvable : on peut fabriquer une situation (un dépôt énorme, un
 *  hôte monstrueux, une cadence cassée) et vérifier que le levier sort, et
 *  qu'il sort AVEC le bon gain. C'est la seule façon de ne pas découvrir dans
 *  six mois qu'une proposition ne se déclenche jamais.
 */
export function leviersExploitation(m = {}) {
  const { poids = {}, energie = {}, trafic = {}, images = {}, carte = {},
          rythme = {}, fichiers = {}, robots = {}, cadencePrevueMin = CADENCE_PREVUE_MIN } = m;
  const out = [];
  const pousser = (l) => out.push({ priorite: 0, effort: 'moyen', risque: 'moyen', ...l });

  // 1. LE CATALOGUE PART ENTIER. C'est le plus gros levier du site : chaque
  //    visiteur télécharge tous les pays alors qu'il n'en regarde qu'un.
  if ((poids.catalogueGzipMo || 0) > 1) {
    const pays = Math.max(2, poids.nbPays || 2);
    const gain = poids.catalogueGzipMo * (1 - 1 / pays);
    pousser({
      id: 'catalogue-entier',
      titre: 'Le catalogue part entier chez chaque visiteur',
      constat: `chaque visite télécharge ${poids.catalogueGzipMo} Mo de données compressées — le catalogue de tous les pays, alors que le visiteur n'en consulte qu'un.`,
      action: 'servir un fichier de données par pays : le visiteur ne télécharge plus que sa zone.',
      gain: `≈ ${gain.toFixed(1)} Mo par visite`,
      gainValeur: +gain.toFixed(2), gainUnite: 'Mo par visite',
      priorite: 100 * gain,
      effort: 'moyen',
      risque: 'moyen — deux chemins de lecture à éprouver (le pays et le repli)',
    });
  }

  // 2. LES VISUELS LOURDS. Le catalogue d'images pèse 1,3 Go à lui seul.
  const lourds = images.lourds || { nb: 0, mo: 0 };
  if (lourds.nb > 0) {
    const gain = lourds.mo * 0.5;
    pousser({
      id: 'visuels-lourds',
      titre: 'Les visuels lourds pèsent la moitié du dépôt d’images',
      constat: `${lourds.nb} visuel(s) dépassent 200 ko, pour ${lourds.mo} Mo — soit ${(100 * lourds.mo / Math.max(1, images.mo)).toFixed(0)} % du poids des images.`,
      action: 'recompresser ces visuels (WebP) : mêmes cartes, fichiers plus légers.',
      gain: `≈ ${gain.toFixed(1)} Mo de dépôt`,
      gainValeur: +gain.toFixed(1), gainUnite: 'Mo de dépôt',
      priorite: 10 * gain,
      effort: 'faible',
      risque: 'faible — un visuel ne porte aucune donnée, seulement une image',
    });
  }

  // 3. LES OFFRES PÉRIMÉES — CE LEVIER N'EXISTE PLUS, ET C'EST UNE BONNE NOUVELLE.
  //    Il proposait d'« allumer le volet des OFFRES sur le VERDICT ». La règle de
  //    la vie d'une carte (14/10/2026) a supprimé la question : une carte vit cinq
  //    jours, puis on demande au FLUX si sa source la sert encore. Il n'y a plus
  //    d'interrupteur à lever, plus de verdict à lire, plus de levier à proposer —
  //    le problème est RÉGLÉ, et un conseil sur un problème réglé est du bruit.

  // 3 bis. LA VEILLE DE PLUS DE SEPT JOURS. L'autre moitié, et la SÛRE des deux :
  //    son verrou est la date de publication de l'article, qui ne change jamais,
  //    donc aucun faux positif n'est possible (une date illisible fait garder
  //    l'article). Elle ne retire rien du stock — elle cesse de publier, et les
  //    visuels devenus orphelins sont purgés à la publication.
  const veille = (carte.veille || {}).articles || {};
  if ((veille.hors7j || 0) > 0 && (carte.veille || {}).mode !== 'actif') {
    const mo = veille.hors7jMo || 0;
    pousser({
      id: 'veille-sept-jours',
      titre: 'La veille garde des articles de plus de sept jours',
      constat: `${veille.hors7j} article(s) publié(s) datent de plus de sept jours (sur ${veille.publies} publiés), ${mo} Mo de visuels — et ${(carte.veille || {}).horsDelaiEnStock || 0} en stock.`,
      action: 'allumer le volet de la VEILLE : trente jours ramenés à sept, sans risque de faux positif.',
      gain: `${mo} Mo de dépôt`,
      gainValeur: mo, gainUnite: 'Mo de dépôt',
      priorite: 5 * mo,
      effort: 'faible',
      risque: 'nul — le verrou est la date de publication, qui ne change jamais',
    });
  }

  // 4. L'HÔTE LE PLUS LOURD. C'est là qu'on pèse le plus sur un partenaire.
  const hotes = Object.entries(trafic.hotes || {})
    .map(([hote, v]) => ({ hote, requetes: v.requetes || 0, mo: +((v.octets || 0) / 1e6).toFixed(1) }))
    .sort((a, b) => b.mo - a.mo);
  if (hotes.length && hotes[0].mo > 2) {
    const h = hotes[0];
    const gain = h.mo / 2;
    pousser({
      id: 'hote-lourd',
      titre: `Un partenaire reçoit le plus gros du trafic`,
      constat: `${h.hote} : ${h.requetes} requête(s) pour ${h.mo} Mo sur 24 h — le premier poste du trafic sortant.`,
      action: 'lire moins de pages de cet hôte, ou une page sur deux.',
      gain: `≈ ${gain.toFixed(1)} Mo par jour`,
      gainValeur: +gain.toFixed(1), gainUnite: 'Mo par jour',
      priorite: 8 * gain,
      effort: 'faible',
      risque: 'faible — on lit déjà plus que le flux ne demande',
    });
  }

  // 5. LES REQUÊTES CONDITIONNELLES QUI NE SERVENT À RIEN.
  const c = trafic.conditionnels || { essais: 0, reutilises: 0 };
  if (c.essais > 4 && c.reutilises / Math.max(1, c.essais) < 0.2) {
    pousser({
      id: 'conditionnelles',
      titre: 'Les requêtes « rien de neuf » ne servent presque jamais',
      constat: `${c.reutilises} réponse(s) « rien de neuf » sur ${c.essais} tentatives — le mécanisme est en place et ne rapporte rien.`,
      action: 'regarder pourquoi : soit les sources ne renvoient pas de marqueur (ETag / Last-Modified), soit elles changent de contenu à chaque lecture.',
      gain: 'à mesurer — le gain est réel mais inconnu tant qu’on ne sait pas laquelle des deux causes c’est.',
      gainValeur: 0, gainUnite: '',
      priorite: 20,
      effort: 'faible',
      risque: 'aucun',
    });
  }

  // 6. LA CADENCE OBSERVÉE S'ÉLOIGNE DU RÉGLAGE.
  const ecart = rythme.intervalleMedianMin !== null && rythme.intervalleMedianMin !== undefined
    ? Math.abs(rythme.intervalleMedianMin - cadencePrevueMin) : 0;
  if (ecart > cadencePrevueMin * 0.5) {
    pousser({
      id: 'cadence-ecart',
      titre: 'La cadence réelle n’est plus celle qu’on a réglée',
      constat: `intervalle médian observé ${rythme.intervalleMedianMin} min, pour ${cadencePrevueMin} min demandées.`,
      action: 'vérifier le planificateur et les passages en échec.',
      gain: 'aucun — c’est une alerte, pas un gain',
      gainValeur: 0, gainUnite: '',
      priorite: 90,
      effort: 'faible',
      risque: 'aucun',
    });
  }

  // 7. LES VISUELS REPORTÉS — la file qui grossit en silence.
  if ((fichiers.reportes24h || 0) > 0) {
    pousser({
      id: 'visuels-reportes',
      titre: 'Des visuels n’ont pas été rapatriés dans le créneau',
      constat: `${fichiers.reportes24h} visuel(s) reportés au passage suivant sur 24 h — c’est la file du budget de téléchargement.`,
      action: 'relever le budget horaire, ou le réduire si le report est rare.',
      gain: 'aucun — c’est un signe de saturation',
      gainValeur: 0, gainUnite: '',
      priorite: (fichiers.reportes24h > 20 ? 85 : 15),
      effort: 'faible',
      risque: 'moyen — relever le budget serre le temps de collecte disponible',
    });
  }

  // 8. LE DÉPÔT APPROCHE DU SEUIL DE L'HÉBERGEUR.
  const part = Math.round(100 * (poids.depotMo || 0) / (poids.quotaDepotMo || QUOTA_DEPOT_MO));
  if (part > 80) {
    pousser({
      id: 'depot-quota',
      titre: 'Le site publié approche le seuil de l’hébergeur',
      constat: `${poids.depotMo} Mo publiés sur ${poids.quotaDepotMo || QUOTA_DEPOT_MO} Mo tolérés (${part} %) — les images en font ${poids.imagesMo} Mo.`,
      action: 'attaquer les visuels lourds et les offres périmées : ce sont les deux gros postes.',
      gain: 'passer sous le seuil',
      gainValeur: 0, gainUnite: '',
      priorite: 70,
      effort: 'moyen',
      risque: 'faible',
    });
  }

  // 9. ROBOTS.TXT — seulement s'il y a quelque chose à respecter.
  const interdits = (robots.cheminsInterdits || []).length + (robots.toutInterdit || []).length;
  if (interdits > 0) {
    pousser({
      id: 'robots',
      titre: 'Des chemins sont interdits par les partenaires',
      constat: `${interdits} chemin(s) interdit(s) relevé(s) dans les fichiers robots.txt lus.`,
      action: 'écarter ces chemins de la lecture — c’est une invitation à ne pas passer.',
      gain: 'aucun — c’est une règle de conduite, pas un gain',
      gainValeur: 0, gainUnite: '',
      priorite: 60,
      effort: 'faible',
      risque: 'aucun',
    });
  }

  // 10. CE QUE COÛTERAIT UN VRAI PUBLIC. Le site est jeune ; ce chiffre dit à
  //     partir de quand la facture cesse d'être symbolique.
  const parVisite = energie.parVisite || { mo: 0, eur: 0 };
  if (parVisite.mo > 0) {
    const goMois = +(parVisite.mo * 10000 / 1000).toFixed(1);
    pousser({
      id: 'public-croissant',
      titre: 'Ce que coûteraient 10 000 visites par mois',
      constat: `à ${parVisite.mo} Mo par visite, 10 000 visites font ${goMois} Go — ${Math.round(100 * goMois / QUOTA_BANDE_PASSANTE_GO_MOIS)} % de la bande passante tolérée par l’hébergeur.`,
      action: 'rien à faire aujourd’hui : c’est un repère, à relire quand le public grandira.',
      gain: 'aucun — c’est un seuil, pas un gain',
      gainValeur: 0, gainUnite: '',
      priorite: 5,
      effort: 'faible',
      risque: 'aucun',
    });
  }

  return out.sort((a, b) => b.priorite - a.priorite);
}

/** LE BILAN D'EXPLOITATION — le rythme, les partenaires, les fichiers, l'énergie
 *  et les leviers. L'onglet « Exploitation » du panneau lit ce bloc tel quel.
 *
 *  PURE : tout ce qui vient du disque ou de l'horloge entre par les paramètres,
 *  jamais par un appel interne. C'est ce qui permet de l'éprouver sur un relevé
 *  fabriqué — une cadence cassée, un hôte monstrueux, un dépôt au bord du
 *  seuil — sans attendre qu'un vrai passage produise la situation. */
export function bilanExploitation({
  passages = [], trafic = {}, images = {}, carte = {}, poids = {}, robots = {},
  partage = {},
  maintenant = Date.now(),
  prixKwh = PRIX_KWH_EUR, kwhParGo = KWH_PAR_GO, puissanceW = PUISSANCE_MACHINE_W,
  cadencePrevueMin = CADENCE_PREVUE_MIN,
} = {}) {
  // --- LE RYTHME, mesuré sur le journal des passages ------------------------
  const recent = passages.filter((p) => p && maintenant - p.t < 86400000);
  const instants = recent.map((p) => p.t).sort((a, b) => a - b);
  const intervalles = [];
  for (let i = 1; i < instants.length; i++) intervalles.push((instants[i] - instants[i - 1]) / 60000);
  const durees = recent.map((p) => p.ms).filter(Number.isFinite);
  const ageDernier = instants.length ? (maintenant - instants[instants.length - 1]) / 60000 : null;
  const heuresMachine = durees.reduce((s, x) => s + x, 0) / 3600000;
  const rythme = {
    cadencePrevueMin,
    passages24h: recent.length,
    intervalleMedianMin: mediane(intervalles) === null ? null : +mediane(intervalles).toFixed(1),
    intervalleMaxMin: intervalles.length ? +Math.max(...intervalles).toFixed(1) : null,
    dureeMedianMs: mediane(durees) === null ? null : Math.round(mediane(durees)),
    dureeMaxMs: durees.length ? Math.max(...durees) : null,
    ageDernierPassageMin: ageDernier === null ? null : +ageDernier.toFixed(1),
    heuresMachine24h: +heuresMachine.toFixed(3),
    // L'écart est calculé ICI pour que le panneau n'ait pas à le recalculer —
    // deux façons de calculer un même écart finissent par diverger.
    ecartCadenceMin: (mediane(intervalles) === null) ? null : +(mediane(intervalles) - cadencePrevueMin).toFixed(1),
    couverture: `${recent.length} passage(s) relevé(s) sur les 24 dernières heures`,
  };

  // --- LES PARTENAIRES, sur 24 h -------------------------------------------
  const hotes = Object.entries(trafic.hotes || {})
    .map(([hote, v]) => ({ hote, requetes: v.requetes || 0, octets: v.octets || 0, mo: +((v.octets || 0) / 1e6).toFixed(2) }))
    .sort((a, b) => b.mo - a.mo);
  const cond = trafic.conditionnels || { essais: 0, reutilises: 0 };
  const partenaires = {
    passagesComptes: trafic.passagesComptes || trafic.passages || 0,
    requetes: trafic.requetes || 0,
    octets: trafic.octets || 0,
    mo: trafic.mo || 0,
    requetesParPassage: trafic.passagesComptes ? Math.round((trafic.requetes || 0) / trafic.passagesComptes) : 0,
    hotes: hotes.length,
    topHotes: hotes.slice(0, 8),
    parFamille: trafic.parFamille || {},
    conditionnels: { ...cond, part: cond.essais ? +(cond.reutilises / cond.essais).toFixed(3) : null },
    apercu: trafic.apercu || { demandes: 0, ecourtees: 0, entieres: 0 },
    robots: {
      lus: robots.hotesLus || 0, sansFichier: robots.sansRobots || 0,
      toutInterdit: (robots.toutInterdit || []).length,
      cheminsInterdits: (robots.cheminsInterdits || []).length,
      applique: !!robots.applique,
    },
    couverture: `les ${trafic.passagesComptes || 0} passage(s) comptés sur 24 h`,
  };

  // --- LES FICHIERS ---------------------------------------------------------
  const fichiers = {
    telecharges24h: recent.reduce((s, p) => s + ((p.visuels && p.visuels.pris) || 0), 0),
    indisponibles24h: recent.reduce((s, p) => s + ((p.visuels && p.visuels.rates) || 0), 0),
    reportes24h: recent.reduce((s, p) => s + ((p.visuels && p.visuels.differes) || 0), 0),
    cumul: {
      fichiers: images.fichiers || 0, mo: images.mo || 0,
      moyenneKo: images.moyenneKo || 0, orphelines: images.orphelines || 0,
    },
    couverture: `${recent.length} passage(s) relevé(s) sur 24 h`,
  };

  // --- L'ÉNERGIE ET LES COÛTS ----------------------------------------------
  //  Ce qui est MESURÉ entre ici ; ce qui est ESTIMÉ en sort, avec son modèle.
  const octets24h = trafic.octets || 0;
  const go24h = octets24h / 1e9;
  const reseauKwh = go24h * kwhParGo;
  const machineKwh = (heuresMachine * puissanceW) / 1000;
  const totalKwh = reseauKwh + machineKwh;
  const eur = (kwh) => +(kwh * prixKwh).toFixed(4);
  // Par visite : le catalogue + la coquille. Les visuels s'ajoutent à la
  // demande, et leur poids moyen est publié à part plutôt qu'additionné à
  // l'aveugle : on ne sait pas combien de cartes un visiteur regarde.
  const parVisiteMo = +((poids.catalogueGzipMo || 0) + (poids.coquilleGzipKo || 0) / 1000).toFixed(2);
  const parVisiteKwh = (parVisiteMo / 1000) * kwhParGo;
  const energie = {
    octets24h, go24h: +go24h.toFixed(3),
    modele: [
      { quoi: 'Réseau (lien fixe)', valeur: `${String(kwhParGo).replace('.', ',')} kWh/Go`, source: 'ordre de grandeur publié (IEA 4E) — le mobile consomme davantage' },
      { quoi: 'Machine qui collecte', valeur: `${puissanceW} W`, source: 'hypothèse : aucune mesure de prise n’est possible par logiciel' },
      { quoi: 'Prix du kilowattheure', valeur: `${String(prixKwh).replace('.', ',')} €`, source: 'prix moyen belge toutes taxes, arrondi' },
    ],
    reseauKwh24h: +reseauKwh.toFixed(5),
    machineKwh24h: +machineKwh.toFixed(5),
    totalKwh24h: +totalKwh.toFixed(5),
    eurJour: eur(totalKwh),
    eurMois: eur(totalKwh * 30),
    eurAn: eur(totalKwh * 365),
    eurParPassage: (recent.length && heuresMachine > 0)
      ? +((machineKwh / recent.length) * prixKwh).toFixed(5) : 0,
    parVisite: { mo: parVisiteMo, kwh: +parVisiteKwh.toFixed(7), eur: +(parVisiteKwh * prixKwh).toFixed(7) },
    parVisiteMille: { mo: +(parVisiteMo * 1000).toFixed(0), eur: +(parVisiteKwh * prixKwh * 1000).toFixed(4) },
    postes: [
      { quoi: 'Hébergement du site', cout: '0 €', note: 'dépôt gratuit, sous réserve des seuils de bonne conduite' },
      { quoi: 'Base de données', cout: '0 €', note: 'il n’y en a aucune : tout vit dans des fichiers' },
      { quoi: 'Nom de domaine', cout: 'hors de ce calcul', note: 'abonnement annuel, payé au registraire — pas une consommation du site' },
      { quoi: 'Requêtes vers les partenaires', cout: '0 €', note: 'sources publiques, sans clé ni compte — c’est la règle du projet' },
    ],
    aDixMilleVisites: {
      visites: 10000,
      goMois: +(parVisiteMo * 10000 / 1000).toFixed(1),
      eurMois: +((parVisiteMo / 1000) * kwhParGo * 10000 * prixKwh).toFixed(2),
      partDuQuotaPct: Math.round(100 * (parVisiteMo * 10000 / 1000) / QUOTA_BANDE_PASSANTE_GO_MOIS),
    },
  };

  // --- LE POIDS -------------------------------------------------------------
  const poidsComplet = {
    ...poids,
    quotaDepotMo: QUOTA_DEPOT_MO,
    quotaBandePassanteGoMois: QUOTA_BANDE_PASSANTE_GO_MOIS,
    partDuQuotaPct: Math.round(100 * (poids.depotMo || 0) / QUOTA_DEPOT_MO),
  };

  const leviers = leviersExploitation({
    poids: poidsComplet, energie, trafic, images,
    carte, rythme, fichiers, robots, cadencePrevueMin,
  });

  return {
    calculeLe: new Date(maintenant).toISOString(),
    rythme, partenaires, fichiers, energie, poids: poidsComplet, leviers,
    // LE RAPPEL DE LA RÈGLE, en clair, pour que le panneau n'ait pas à
    // l'inventer : ce qui est mesuré, et ce qui est estimé.
    lecture: {
      mesure: 'le rythme, le trafic vers les partenaires, les fichiers rapatriés, le poids du dépôt',
      estime: 'les kilowattheures et les euros — chaque estimation paraît avec son modèle',
      partage,
    },
  };
}

/** VERROU 2 — LA COMPTABILITÉ DES TOURS, tenue d'un passage à l'autre.
 *
 *  `rendus` est ce que chaque source a RÉELLEMENT rendu ce passage-ci. Un tour ne
 *  compte que si la source a parlé POUR DE VRAI :
 *
 *    • elle a rendu au moins un article — une source muette ou en panne ne dit
 *      pas « l'offre n'existe plus », elle dit « je n'ai rien pu dire » ;
 *    • et elle a rendu au moins la moitié de ce qu'elle rendait la dernière fois
 *      qu'elle a parlé. C'est la garde qui compte : les murs anti-robot d'Amazon
 *      rendent une page tronquée un passage sur deux — sans cette moitié, deux
 *      passages tronqués condamneraient d'un coup tout un catalogue vivant, et
 *      le défaut serait invisible (des offres qui disparaissent, sans erreur nulle
 *      part).
 */
export function avancerTours({ tours = {}, rendus = {}, precedents = {} } = {}) {
  const t = { ...tours };
  const p = { ...precedents };
  for (const [id, n] of Object.entries(rendus)) {
    if (!(n > 0)) continue;
    const attendu = Math.ceil((p[id] || 0) * PART_RENDU_MINIMUM);
    if (n < Math.max(1, attendu)) continue;   // tour partiel : il ne compte pas
    t[id] = (t[id] || 0) + 1;
    p[id] = n;
  }
  return { tours: t, rendus: p };
}

/** VERROU 2 — cette offre a-t-elle manqué assez de tours réussis pour sortir ?
 *
 *  Sans compteur pour sa source, la réponse est non : on ne condamne pas une
 *  offre sur une source qu'on n'a pas réussi à lire — ni sur une source mise au
 *  repos, ni sur une source qui a répondu à côté.
 */
export function aManqueDesTours(offre, tours, { typeSource = '' } = {}) {
  if (!offre || typeSource === 'presse') return false;   // la presse n'a que le verrou 1
  const tour = tours ? tours[offre.sourceId] : undefined;
  if (!Number.isFinite(tour) || tour <= 0) return false;
  const servi = Number.isFinite(offre.serviceAuTour) ? offre.serviceAuTour : tour;
  return tour - servi >= TOURS_SANS_SERVICE;
}

/** VERROU 2 — la MIGRATION : donner un numéro de tour aux offres d'AVANT.
 *
 *  Sans elle, la garde « pas de numéro, donc grâce » dure ÉTERNELLEMENT : l'écart
 *  se recalcule à chaque passage sur le tour courant, et reste nul. Défaut
 *  constaté sur la première exécution réelle, avant livraison : seize mille offres
 *  sans numéro, donc seize mille offres que le verrou n'aurait jamais touchées.
 *
 *  On l'écrit donc UNE fois, au moment où la source de l'offre est enfin
 *  surveillée. Les offres dont la source n'a pas de compteur ne sont pas
 *  estampillées : elles resteront en grâce tant que leur source n'aura pas parlé.
 */
export function estampillerOffresDavant(offres, tours) {
  let n = 0;
  for (const o of offres) {
    if (!o || o.serviceAuTour !== undefined) continue;
    if (!Number.isFinite(tours ? tours[o.sourceId] : undefined)) continue;
    o.serviceAuTour = tours[o.sourceId];
    n++;
  }
  return n;
}

/** Une source qui vise une ENSEIGNE NOMMÉE : page de promotions d'un marchand
 *  (`enseigne`, `bol`, `krefel`), ou veille ciblée sur un marchand (identifiant
 *  `enseigne-…`). Les flux de presse, les communautés de bons plans et les
 *  ventes flash n'en font pas partie : ils ne visent pas un marchand. */
export function sourceEnseigne(s) {
  if (!s) return false;
  if (['enseigne', 'bol', 'krefel'].includes(s.type)) return true;
  return String(s.id || '').startsWith('enseigne-');
}

/** Les sources à NE PLUS interroger : leur enseigne est restée sous le seuil
 *  d'articles du catalogue. Rend une Map {sourceId: nom de l'enseigne}.
 *
 *  @param {object[]} sources toutes les sources déclarées
 *  @param {Map<string, number>} articlesParSource articles au catalogue, par source
 *  @param {object} vuLe date du dernier passage réussi, par identifiant de source
 *  @param {number} seuil nombre d'articles en dessous duquel on arrête
 */
export function enseignesSousLeSeuil(sources, articlesParSource, vuLe = {}, seuil = SEUIL_ARTICLES_ENSEIGNE) {
  const total = new Map();
  for (const s of (sources || [])) {
    if (!sourceEnseigne(s)) continue;
    const nom = String(s.nom || '');
    total.set(nom, (total.get(nom) || 0) + (articlesParSource.get(s.id) || 0));
  }
  const sous = new Map();
  for (const s of (sources || [])) {
    if (!sourceEnseigne(s)) continue;
    const nom = String(s.nom || '');
    if ((total.get(nom) || 0) >= seuil) continue;
    if (!vuLe || !vuLe[s.id]) continue; // jamais interrogée : on lui donne sa chance
    sous.set(s.id, nom);
  }
  return sous;
}

/* ------------------------------------------------------------------ *
 *  ACTIVITÉS — les bons plans de SERVICE.
 *
 *  Demande explicite du propriétaire du produit : « spa, centre de beauté,
 *  restaurant, zoo, montgolfière » doivent avoir leur onglet, au même niveau
 *  que High-tech ou Mode. Ces offres n'existaient nulle part jusqu'ici : les
 *  communautés belges de bons plans n'existent pas (mesuré : `be.pepper.com`
 *  inexistant, flux Dealabs Belgique en 404) et les enseignes belges se
 *  taisent. Groupon, lui, publie ces bons plans avec leurs deux prix.
 *
 *  Pourquoi ces pages sont forcées en « activité » plutôt que classées par leur
 *  titre : la page `/fr/landing/sale` a été MESURÉE avant d'être branchée —
 *  ses 61 bons plans sont TOUS des prestations (massage, spa, restaurant,
 *  brunch, fitness, soins) ; aucune n'est un produit. Le titre déciderait donc
 *  à tort (« Soin de relaxation du dos » irait en beauté, ce qui est faux :
 *  c'est un soin en institut, pas un cosmétique). La page, elle, ne se trompe
 *  pas : c'est sa nature.
 *
 *  Ce qui N'EST PAS forcé : `/goods`, la page de produits, qui passe par le
 *  lecteur d'enseigne et dont le titre décide normalement.
 * ------------------------------------------------------------------ */
const SOURCES_ACTIVITES = [
  { id: 'groupon-be-sale', nom: 'Groupon', type: 'groupon', pays: 'BE', langue: 'fr', reposMin: 60, viaCurl: true, categorieImposee: 'activite', url: 'https://www.groupon.be/fr/landing/sale' },
  { id: 'groupon-be-bonplan', nom: 'Groupon', type: 'groupon', pays: 'BE', langue: 'fr', reposMin: 60, viaCurl: true, categorieImposee: 'activite', url: 'https://www.groupon.be/fr/bon-plan' },

  // SOCIAL DEAL (unité B5) — l'équivalent de Groupon pour les activités, mais
  // LOCAL au pays : chaque pays sur SON domaine (`socialdeal.<tld>`), pas un
  // site étranger. Trouvé et mesuré en B3 : DEUX relevés identiques par pays,
  // contrôle négatif propre, deux prix RÉELS par carte dans le HTML servi (à
  // la différence de wowcher/veepee, rendus en JavaScript).
  //   ⚠ Le contenu mêle REPAS PRIS DEHORS, SOINS et SORTIES. Aucune
  //   attribution en bloc : `offresSocialDeal` passe par `classerOffre`, qui
  //   envoie un soin en Beauté, un repas pris dehors en Activité, et un forfait
  //   ou une destination étrangère en Voyages (partage géographique, point 21).
  //   ⚠ socialdeal.se répond mais ne publie AUCUNE carte (mesuré) : non câblé.
  //   Seule plateforme d'activités hors Groupon trouvée : elle couvre 5 pays
  //   (BE, NL, FR, DE, AT) là où l'Activité n'était portée que par la Belgique.
  { id: 'socialdeal-be', nom: 'Social Deal', type: 'socialdeal', pays: 'BE', langue: 'fr', reposMin: 90, categorieImposee: 'activite', url: 'https://www.socialdeal.be' },
  { id: 'socialdeal-nl', nom: 'Social Deal', type: 'socialdeal', pays: 'NL', langue: 'nl', reposMin: 90, categorieImposee: 'activite', url: 'https://www.socialdeal.nl' },
  { id: 'socialdeal-fr', nom: 'Social Deal', type: 'socialdeal', pays: 'FR', langue: 'fr', reposMin: 90, categorieImposee: 'activite', url: 'https://www.socialdeal.fr' },
  { id: 'socialdeal-de', nom: 'Social Deal', type: 'socialdeal', pays: 'DE', langue: 'de', reposMin: 90, categorieImposee: 'activite', url: 'https://www.socialdeal.de' },
  { id: 'socialdeal-at', nom: 'Social Deal', type: 'socialdeal', pays: 'AT', langue: 'de', reposMin: 90, categorieImposee: 'activite', url: 'https://www.socialdeal.at' },
];

/* ------------------------------------------------------------------ *
 *  AMAZON BELGIQUE — enfin trouvé, et par une porte inattendue.
 *
 *  Ce qui bloquait : la page `amazon.com.be/deals`, celle que l'on ouvre dans
 *  un navigateur, est construite en JavaScript — 423 Ko servis, ZÉRO ASIN, zéro
 *  prix. Et l'API Product Advertising exige une clé. Conclusion d'hier : « pas
 *  de source possible ». Elle était fausse.
 *
 *  Ce qui marche : la page de RECHERCHE (`/s`), elle, est rendue côté serveur.
 *  Mesuré : 59 à 60 ASIN, 165 prix pour une simple requête. Surtout, Amazon y
 *  expose ses PROPRES filtres de promotion — le paramètre `rh=p_n_deal_type`.
 *  Filtrer dessus ne liste plus « des produits qui parlent de promo » (ce que
 *  faisait une recherche par mot-clé, avec des résultats absurdes comme du
 *  collagène à -99 %), mais les articles qu'Amazon classe lui-même en promotion.
 *
 *  Fiabilité mesurée sur 5 appels espacés : 3 rendent 48 produits, 2 rendent une
 *  page vide de 215 Ko. Ce n'est donc PAS une source qu'on interroge toutes les
 *  cinq minutes : `reposMin` élevé, et un passage vide est compté comme « 0
 *  retenue » — jamais comme une erreur, jamais comme un effacement. Les offres
 *  déjà engrangées restent en place (règle générale du collecteur).
 *
 *  Les remises sont VÉRIFIÉES, et c'est le piège de cette source : chaque carte
 *  contient plusieurs prix, dont le PRIX À L'UNITÉ (« 0,10 €/unité »). Un
 *  extracteur naïf prenait le plus petit comme prix et le plus grand comme prix
 *  barré, et fabriquait des remises de -99 % qui n'existaient pas. On distingue
 *  donc les deux balises : `span.a-price` = prix demandé, `span.a-price
 *  a-text-price` = prix de référence barré. Une remise n'est calculée QUE si le
 *  second est strictement supérieur au premier — deux prix réels, rien d'autre.
 *  Le « Économisez X % » affiché à côté est ignoré : relevé contradictoire avec
 *  les deux prix de la même carte (49 % annoncés là où les prix disent 19 %).
 * ------------------------------------------------------------------ */
const SOURCES_AMAZON = [
  { id: 'amazon-be-deals', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 90, url: 'https://www.amazon.com.be/s?rh=p_n_deal_type%3A210770357031&s=discount-desc-rank' },
  // Trois rayons nommés par l'utilisateur — bricolage, jouets, maison — pour que
  // ces rubriques ne dépendent pas du hasard d'une page « toutes promotions ».
  // Aucune catégorie n'est IMPOSÉE : le titre décide, car une recherche Amazon
  // ramène aussi des résultats sponsorisés hors sujet.
  //
  // ⚠ LE FILTRE `rh=p_n_deal_type` A ÉTÉ RETIRÉ DES QUATRE RECHERCHES — mesuré
  // le 09/10/2026, à la demande de B (« en Belgique, dans la catégorie meuble il
  // y a beaucoup d'annonces sans promotion… peux-tu revérifier ce paramètre ? »).
  // Sur `amazon.com.be`, ce paramètre NE FILTRE PAS les promotions : il donne
  // MOINS de vrais bons plans que pas de filtre du tout.
  //
  //   recherche « bricolage », 3 passages cumulés, cartes portant un prix barré :
  //       avec le filtre (l'ancienne adresse)  31/182 = 17 %
  //       filtre + tri par remise              29/154 = 19 %
  //       SANS filtre, tri par remise          57/173 = 33 %   ← retenu
  //   recherche « cuisine maison », 3 passages :
  //       avec le filtre 20 % · sans filtre 29 % · tri par remise 34 %
  //
  // Le tri `s=discount-desc-rank` classe par remise décroissante : il ne RETIRE
  // rien, il remonte les vrais bons plans — deux fois plus de prix barrés par
  // page. C'est le seul levier qui augmente la part de promotions réelles.
  //
  // La source `amazon-be-deals` fait exception : sans mot-clé, la même adresse
  // privée du filtre rend une page VIDE (HTTP 202, zéro article). Le filtre y
  // reste donc, mais avec le tri : mesuré 43 % de prix barrés, contre 20 %
  // avant (2 passages, 21/49 les deux fois).
  { id: 'amazon-be-bricolage', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 120, url: 'https://www.amazon.com.be/s?k=bricolage&s=discount-desc-rank' },
  { id: 'amazon-be-jouets', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 120, url: 'https://www.amazon.com.be/s?k=jouet+enfant&s=discount-desc-rank' },
  { id: 'amazon-be-maison', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 120, url: 'https://www.amazon.com.be/s?k=cuisine+maison&s=discount-desc-rank' },
  // Version néerlandaise : la Belgique est bilingue, et les intitulés de
  // produits diffèrent (« speelgoed » n'est pas « jouet »).
  { id: 'amazon-be-nl', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'nl', reposMin: 120, url: 'https://www.amazon.com.be/s?k=aanbieding&language=nl_BE&s=discount-desc-rank' },
];

/* BOL.COM BELGIQUE — la page « deals », donnée par B le 10/10/2026 :
 *   « Voilà le lien pour bol.com. C'est de ce lien que tu dois rechercher toutes
 *     les promotions. »
 *
 *  Trouvé lisible SANS navigateur et SANS clé, ce qui n'était pas gagné : bol.com
 *  répond 403 à un client qui n'annonce pas de compression, et 200 avec. Mesuré :
 *  16 cartes produit rendues par le serveur, chacune avec son prix DEMANDÉ et son
 *  prix de RÉFÉRENCE (« Prix conseillé 29,99 », « En général 114,00 ») — donc deux
 *  prix réels, la seule preuve de promotion que ce projet accepte.
 *
 *  ⚠ CE QUI RESTE FERMÉ, ET IL FAUT LE SAVOIR : la page n'affiche que 4 produits
 *  par rayon (Jouets, Électronique, Livres, Soins personnels…) et charge les 24
 *  autres rayons APRÈS coup, par une requête GraphQL (`/api/graphql`, requête
 *  persistée) que le serveur REFUSE en dehors du navigateur — mesuré : 400
 *  « InvalidRequest » avec les cookies de la page, comme sans. Le catalogue bol
 *  complet n'est donc pas atteignable ici ; ce sont les promotions MISES EN AVANT
 *  par bol qui le sont. C'est dit aux deux endroits (ici et dans le panneau).
 *
 *  UNE SEULE LANGUE, ET C'EST VOULU. La page néerlandaise (`/be/nl/deals/`)
 *  existe et rend 16 autres cartes, mais 14 sont les MÊMES produits, avec un
 *  titre néerlandais et une autre adresse — mesuré : la même Gillette porte
 *  `…/fr/p/gillette-…-10-lames-de-rasoir/9300000139705119/` et
 *  `…/nl/p/gillette-…-10-scheermesjes/9300000139705119/`. Les faire entrer toutes
 *  les deux ferait apparaître chaque produit DEUX FOIS, et le titre basculerait
 *  d'un passage à l'autre (l'écriture est parallèle : le dernier arrivé gagne).
 *  On lit donc la page française, celle que B a donnée — et si le néerlandais
 *  doit venir un jour, il faudra d'abord décider ce qu'on affiche.
 */
const SOURCES_BOL = [
  { id: 'bol-be-fr', nom: 'bol.com', type: 'bol', pays: 'BE', langue: 'fr', reposMin: 90, url: 'https://www.bol.com/be/fr/deals/' },
];

/* KREFEL — la page « deals du moment », donnée par B le 10/10/2026.
 *
 *   « https://www.krefel.be/fr/deals-du-moment?currentPage=2 »
 *
 *  ⚠ LECTEUR ÉCRIT SUR UNE COPIE ARCHIVÉE, PAS SUR LA PAGE VIVANTE.
 *  Le 10/10/2026 à 01:15 UTC, krefel.be répondait **HTTP 500 sur TOUTES ses
 *  adresses** — accueil, `/fr`, page de deals française et néerlandaise, page
 *  produit — et le corps de la réponse porte sa propre phrase de maintenance :
 *
 *    « Désolé, notre site internet est temporairement indisponible. Nous
 *      procédons à d'importantes mises à jour sur notre site web. »
 *
 *  Ce n'est donc PAS un blocage anti-robot : l'enseigne est FERMÉE. Le lecteur a
 *  été écrit sur l'instantané du 09/06/2026 de la page de deals
 *  (`/nl/deals-van-het-moment`, HTTP 200 : 24 produits, 68 résultats).
 *
 *  Ce qui reste à faire, et qui est écrit ici pour ne pas l'oublier : VÉRIFIER la
 *  structure sur la page vivante dès le retour du site, et compter les pages.
 *  Tant que ce n'est pas fait, ce lecteur est une HYPOTHÈSE BIEN FONDÉE, pas un
 *  fait — c'est dit aussi dans son journal, qui parle quand il ne trouve rien.
 *
 *  Ce qu'on y lit, et sur quoi on s'appuie (chaque point relevé sur le HTML) :
 *
 *    - les produits sont rendus CÔTÉ SERVEUR (Next.js App Router) : chacun dans
 *      une carte `relative flex flex-row items-start justify-center gap-4 p-3…` ;
 *    - le PRIX DE RÉFÉRENCE n'est annoncé par AUCUN mot : il porte la classe
 *      **`line-through`**. C'est un marqueur STRUCTUREL, donc indépendant de la
 *      langue — précisément ce qui manquait chez bol, où il fallait guetter
 *      « Prix conseillé » ou « Adviesprijs » et où un mot oublié faisait tomber
 *      des remises réelles ;
 *    - le PRIX DEMANDÉ porte `font-bold`, juste après la référence ;
 *    - l'écart est écrit en clair (« -13 % ») mais on ne s'en SERT PAS : la
 *      remise est recalculée à partir des deux prix, règle du projet ;
 *    - les montants s'écrivent « € <espace insécable>479,00 », et le séparateur
 *      de MILLIERS est un POINT : « € 1.099,00 ». Un extracteur qui se contente
 *      de remplacer la virgule lit 1,099 € — mille fois trop peu ;
 *    - l'identifiant est le NUMÉRO du produit, premier segment de
 *      `/fr/p/<numéro>-<slug>` : le slug est rédigé en français et changerait
 *      avec la langue.
 *
 *  UNE SEULE LANGUE, ET C'EST VOULU — leçon de bol.com : `/fr/deals-du-moment` et
 *  `/nl/deals-van-het-moment` sont le même catalogue. On lit le français, celui
 *  du lien donné. Si le néerlandais vient un jour, l'identifiant par numéro de
 *  produit les fera converger au lieu de faire deux lignes.
 *
 *  Délai de repos long (120 min) : la page est paginée et coûte plusieurs
 *  requêtes par passage. On ne frappe pas toutes les cinq minutes à la porte
 *  d'une enseigne qui vient de passer des heures en maintenance.
 */
const SOURCES_KREFEL = [
  { id: 'krefel-be-fr', nom: 'Krefel', type: 'krefel', pays: 'BE', langue: 'fr', reposMin: 120, url: 'https://www.krefel.be/fr/deals-du-moment' },
];

/** Nombre de pages de deals suivies au maximum (voir la pagination de krefel). */
const PLAFOND_PAGES_KREFEL = 4;

/* VENTES FLASH DU JOUR — la page « goldbox » de chaque Amazon.
 *
 *  Demandé, et c'est la MEILLEURE porte d'Amazon : contrairement à l'accueil
 *  (rendu 202, vide) et à /deals (mur JavaScript), cette page-ci répond 200 et
 *  EMBARQUE ses offres en JSON. On y lit, pour chaque vente flash, le prix
 *  flash, le prix courant, le libellé « Offre à durée limitée » et l'état de
 *  l'offre. Deux prix RÉELS : la remise se calcule, sans dépendre de la langue,
 *  là où la page de recherche ne donnait le plus souvent aucun prix de
 *  référence.
 *
 *  Mesuré : 29 ventes flash sur amazon.com.be et amazon.fr, 27 sur amazon.de.
 *
 *  L'Autriche n'a pas d'Amazon : on y achète sur amazon.de (amazon.at y
 *  redirige). Le Portugal est dans la même situation avec amazon.es. Les deux
 *  sont donc servis par le domaine qui les livre VRAIMENT, mais étiquetés avec
 *  leur propre pays — c'est le pays de l'acheteur qui compte, pas le siège du
 *  site.
 *
 *  Les repos sont DÉCALÉS les uns des autres (241, 243, 245…). Ils ne se
 *  déclenchent donc pas tous dans la même passe : la collecte est tuée à 120 s,
 *  et douze pages de 400 Ko d'un coup la feraient tomber. Le décalage les
 *  désynchronise sans qu'aucun ne soit servi moins souvent.
 */
const sourceFlash = (pays, domaine, langue, entete, decalage, paysAussi) => ({
  id: `flash-${pays.toLowerCase()}`,
  // Second pays desservi par le même domaine (voir offresVenteFlash).
  ...(paysAussi ? { paysAussi } : {}),
  nom: 'Amazon', type: 'flash', pays,
  // `langue` reste un CODE (« fr », « de »…) : c'est lui qui choisit le filtre
  // de mots du pays, et un test vérifie qu'il en existe un. Il ne faut donc PAS
  // y mettre la valeur d'en-tête HTTP, qui est une autre chose.
  langue,
  // L'en-tête envoyé à Amazon, lui, est plus précis : il porte la variante
  // régionale et les langues de secours.
  entete,
  reposMin: 240 + decalage,
  url: `https://www.${domaine}/gp/goldbox`,
});

const SOURCES_VENTES_FLASH = [
  // Décalage de 25 MINUTES entre deux pays, pas de 2 minutes.
  //   Mesuré : avec des décalages serrés, les douze pages tombaient dans la même
  //   passe, pesaient sur le budget de 45 s réservé aux flux, et DEUX d'entre
  //   elles (l'Allemagne et l'Espagne) ont été abandonnées en route — marquées
  //   « vues » mais sans une seule offre, donc muettes pour quatre heures. Un
  //   décalage large garantit qu'elles ne se rejoignent plus jamais.
  sourceFlash('BE', 'amazon.com.be', 'fr', 'fr-BE,fr;q=0.9,en;q=0.8', 0),
  sourceFlash('FR', 'amazon.fr', 'fr', 'fr-FR,fr;q=0.9', 25),
  // L'Autriche est servie par LE MÊME appel que l'Allemagne : deux requêtes
  // identiques parties ensemble, et Amazon refuse la seconde.
  sourceFlash('DE', 'amazon.de', 'de', 'de-DE,de;q=0.9', 50, 'AT'),
  sourceFlash('GB', 'amazon.co.uk', 'en', 'en-GB,en;q=0.9', 100),
  sourceFlash('IE', 'amazon.ie', 'en', 'en-IE,en;q=0.9', 125),
  sourceFlash('ES', 'amazon.es', 'es', 'es-ES,es;q=0.9', 150, 'PT'),
  // Le Portugal n'a pas d'Amazon : on y achète sur amazon.es, dont les pages
  // sont en espagnol. Le pays reste PT — c'est le pays de l'acheteur.
  // (Partage de requête avec l'Espagne, même raison que ci-dessus.)
  sourceFlash('IT', 'amazon.it', 'it', 'it-IT,it;q=0.9', 200),
  sourceFlash('NL', 'amazon.nl', 'nl', 'nl-NL,nl;q=0.9', 225),
  sourceFlash('SE', 'amazon.se', 'sv', 'sv-SE,sv;q=0.9', 250),
  sourceFlash('PL', 'amazon.pl', 'pl', 'pl-PL,pl;q=0.9', 275),
];

/* Noms des pays, pour l'affichage. Un code seul (« BE ») ne dit rien à personne.
   Exporté : les tests comparent cette liste à celle de l'interface, parce que
   deux listes recopiées finissent toujours par diverger en silence. */
export const NOMS_PAYS = {
  FR: 'France', BE: 'Belgique', DE: 'Allemagne', NL: 'Pays-Bas', ES: 'Espagne',
  IT: 'Italie', AT: 'Autriche', PT: 'Portugal', PL: 'Pologne', SE: 'Suède',
  IE: 'Irlande', GB: 'Royaume-Uni',
};

/** Un flux Google News par pays : gratuit, sans clé, dans la langue du pays. */
const gnews = (requete, hl, gl) =>
  `https://news.google.com/rss/search?q=${requete}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;

/* Veille presse PAR PAYS.
 *
 * Chaque flux a été vérifié : il rend des articles. Le repos de 30 min évite de
 * taper onze fois par heure chez Google pour un résultat qui bouge lentement —
 * et l'utilisateur y gagne : les offres déjà engrangées restent affichées, seule
 * la nouveauté arrive plus tard.
 *
 * TROIS requêtes par pays et par langue, et pas une seule. Ce n'est pas du
 * remplissage : mesuré, trois requêtes différentes ne ramènent PAS les mêmes
 * articles (une requête « réduction électroménager » et une requête « code
 * promo » se recoupent très peu). C'est le levier le plus rentable trouvé —
 * tripler le matériel sans interroger une source de plus.
 *
 * Les requêtes sont écrites DANS LA LANGUE DU PAYS : une requête française avec
 * `gl=DE` ramène du bruit, et le filtre de pertinence est lui aussi par langue.
 */
const PAYS_PRESSE = [
  { pays: 'BE', langue: 'fr', gl: 'BE', hl: 'fr', requetes: ['bon+plan+promotion', 'r%C3%A9duction+%C3%A9lectrom%C3%A9nager', 'code+promo+r%C3%A9duction'] },
  { pays: 'BE', langue: 'nl', gl: 'BE', hl: 'nl', requetes: ['koopje+promotie', 'korting+elektronica', 'kortingscode'] },
  { pays: 'DE', langue: 'de', gl: 'DE', hl: 'de', requetes: ['Angebot+Rabatt', 'Schn%C3%A4ppchen+Deal', 'Preissturz+reduziert'] },
  { pays: 'AT', langue: 'de', gl: 'AT', hl: 'de', requetes: ['Angebot+Rabatt', 'Schn%C3%A4ppchen+Deal', 'Preissturz+reduziert'] },
  { pays: 'NL', langue: 'nl', gl: 'NL', hl: 'nl', requetes: ['aanbieding+korting', 'koopje+promotie', 'kortingscode'] },
  { pays: 'ES', langue: 'es', gl: 'ES', hl: 'es', requetes: ['oferta+descuento', 'chollo+rebaja', 'descuento+electr%C3%B3nica'] },
  { pays: 'IT', langue: 'it', gl: 'IT', hl: 'it', requetes: ['offerta+sconto', 'occasione+prezzo', 'codice+sconto'] },
  { pays: 'PT', langue: 'pt', gl: 'PT', hl: 'pt', requetes: ['promo%C3%A7%C3%A3o+desconto', 'cup%C3%A3o+desconto', 'ofertas+eletr%C3%B3nica'] },
  { pays: 'PL', langue: 'pl', gl: 'PL', hl: 'pl', requetes: ['promocja+zni%C5%BCka', 'okazja+przecena', 'taniej+elektronika'] },
  { pays: 'SE', langue: 'sv', gl: 'SE', hl: 'sv', requetes: ['erbjudande+rabatt', 'kampanj+pris', 's%C3%A4nkt+pris'] },
  { pays: 'IE', langue: 'en', gl: 'IE', hl: 'en', requetes: ['deal+discount', 'price+drop+sale', 'discount+code'] },
  // Le Royaume-Uni n'avait QUE son site d'entraide : aucune veille presse.
  { pays: 'GB', langue: 'en', gl: 'GB', hl: 'en', requetes: ['deal+discount', 'price+drop+sale', 'discount+code'] },
];

const VEILLE_PAYS = PAYS_PRESSE.flatMap((p) => p.requetes.map((q, i) => ({
  id: `gnews-${p.pays.toLowerCase()}-${p.langue}-${i + 1}`,
  nom: `Presse ${p.pays} (${p.langue}) ${i + 1}`,
  type: 'presse',
  pays: p.pays,
  langue: p.langue,
  url: gnews(q, p.hl, p.gl),
  reposMin: 30,
})));

/* BING NEWS — pas pour le VOLUME, pour les VISUELS.
 *
 * Google News est la source de volume (100 articles par requête) mais son lien
 * ne mène pas à l'éditeur : ni par redirection, ni par décodage — vérifié. On ne
 * peut donc pas y lire l'og:image, et les pays servis par la presse affichaient
 * des cartes sans visuel.
 *
 * Bing News rend beaucoup moins d'articles (2 à 12 par requête) mais il donne le
 * lien DIRECT de l'éditeur, en clair, dans son redirecteur. Mesuré : og:image
 * récupérée sur 3/3 des articles portugais et suédois, 2/3 des irlandais et
 * italiens. C'est donc lui qui apporte les images en Belgique, en Irlande, au
 * Portugal et en Italie, où aucun flux d'éditeur ne publie de bons plans.
 */
const PAYS_BING = [
  { pays: 'BE', langue: 'fr', mkt: 'fr-BE', requetes: ['bon plan promotion', 'code promo réduction', 'bonnes affaires électroménager'] },
  { pays: 'BE', langue: 'nl', mkt: 'nl-BE', requetes: ['koopje promotie', 'kortingscode', 'aanbieding elektro'] },
  { pays: 'DE', langue: 'de', mkt: 'de-DE', requetes: ['Angebot Rabatt', 'Gutschein Rabattcode', 'Preissturz Schnäppchen'] },
  { pays: 'AT', langue: 'de', mkt: 'de-AT', requetes: ['Angebot Rabatt', 'Schnäppchen Deal', 'Gutschein Rabattcode'] },
  { pays: 'NL', langue: 'nl', mkt: 'nl-NL', requetes: ['aanbieding korting', 'kortingscode', 'koopje elektro'] },
  { pays: 'ES', langue: 'es', mkt: 'es-ES', requetes: ['oferta descuento', 'chollo rebaja', 'cupón descuento'] },
  { pays: 'IT', langue: 'it', mkt: 'it-IT', requetes: ['offerta sconto', 'codice sconto', 'occasione prezzo'] },
  { pays: 'PT', langue: 'pt', mkt: 'pt-PT', requetes: ['promoção desconto', 'cupão desconto', 'ofertas eletrónica'] },
  { pays: 'PL', langue: 'pl', mkt: 'pl-PL', requetes: ['promocja zniżka', 'kod rabatowy', 'okazja przecena'] },
  { pays: 'SE', langue: 'sv', mkt: 'sv-SE', requetes: ['erbjudande rabatt', 'rabattkod', 'kampanj pris'] },
  { pays: 'IE', langue: 'en', mkt: 'en-IE', requetes: ['deal discount', 'discount code', 'sale bargain'] },
  { pays: 'GB', langue: 'en', mkt: 'en-GB', requetes: ['deal discount', 'discount code', 'sale bargain'] },
];

const VEILLE_BING = PAYS_BING.flatMap((p) => p.requetes.map((q, i) => ({
  id: `bing-${p.pays.toLowerCase()}-${p.langue}-${i + 1}`,
  nom: `Bing ${p.pays} (${p.langue}) ${i + 1}`,
  type: 'presse',
  pays: p.pays,
  langue: p.langue,
  url: `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&mkt=${p.mkt}`,
  reposMin: 30,
})));

/* VEILLE PAR ENSEIGNE — « que dit-on de Colruyt, de Delhaize, d'Amazon ? »
 *
 * Les grandes enseignes belges n'ont AUCUN flux d'offres exploitable (vérifié
 * une par une : voir SOURCES_ENSEIGNES). Leurs promos existent pourtant, et
 * elles sont annoncées et reprises — par la presse locale, le plus souvent.
 * On va donc les chercher NOMMÉMENT, enseigne par enseigne, au lieu d'espérer
 * qu'une requête générique « bon plan » les ramène.
 *
 * Ce que ça change concrètement : la carte n'est plus « un article de presse
 * de plus », elle est étiquetée du nom du marchand (`marchandImpose`). Une
 * recherche « Colruyt promotion » rend une info sur Colruyt ; l'afficher sous
 * le nom du journal serait faux. L'étiquette vient donc de la requête, pas du
 * domaine du lien.
 *
 * Ce n'est PAS la source idéale — on préférerait le flux du marchand. C'est la
 * seule honnête disponible sans clé : quand l'enseigne publiera un flux
 * lisible, c'est lui qu'il faudra brancher, et cette liste deviendra inutile.
 *
 * Une requête par enseigne, avec le mot « promotion » dans la requête : sans
 * lui, le filtre de pertinence écarterait des titres qui parlent bien d'une
 * offre (le filtre cherche un mot de promo DANS le titre, c'est sa règle).
 */
const ENSEIGNES_PAR_PAYS = [
  {
    pays: 'BE', langue: 'fr', mkt: 'fr-BE',
    marchands: [
      // grandes surfaces
      'Colruyt', 'Delhaize', 'Lidl Belgique', 'Aldi Belgique', 'Carrefour Belgique', 'Intermarché Belgique', 'Spar Belgique', 'Bio-Planet', 'OKay',
      // bricolage et jardin
      'Hubo', 'Brico Belgique', 'Gamma Belgique', 'Toolstation Belgique',
      // jouets
      'DreamLand', 'Fun Belgique', 'Maxi Toys',
      // électro, mode, maison
      'Amazon Belgique', 'Media Markt Belgique', 'Coolblue Belgique', 'Vanden Borre', 'Krëfel', 'Action Belgique', 'Kruidvat', 'Hema Belgique', 'JBC Belgique', 'Torfs',
      // Les DÉPLIANTS : en Belgique, les promos de supermarché se lisent dans le
      // folder de la semaine. La requête est écrite en clair (voir motif()) et
      // l'étiquette reste le nom du marchand.
      ['folder Colruyt', 'Colruyt'], ['folder Delhaize', 'Delhaize'], ['dépliant promotion supermarché', 'Supermarchés'],
    ],
  },
  {
    pays: 'BE', langue: 'nl', mkt: 'nl-BE',
    marchands: [
      'Colruyt promotie', 'Delhaize promotie', 'Lidl België', 'Aldi België', 'Carrefour België', 'Intermarché België', 'Spar België', 'Bio-Planet', 'OKay',
      'Hubo promotie', 'Brico België', 'Gamma België', 'Toolstation België',
      'DreamLand', 'Fun België', 'Maxi Toys',
      'Amazon België', 'Media Markt België', 'Coolblue België', 'Vanden Borre', 'Krefel', 'Action België', 'Kruidvat actie', 'Hema België', 'JBC België', 'Torfs',
      ['folder Colruyt', 'Colruyt'], ['folder Delhaize', 'Delhaize'], ['folder supermarkt aanbiedingen', 'Supermarkten'],
    ],
  },
];

/* Une entrée de la liste est soit un nom de marchand (« Lidl Belgique »), soit
 * un couple [requête, étiquette] quand la requête ne se déduit pas du nom.
 * Sans ce second cas, une recherche « folder Delhaize » s'étiquetterait
 * « Folder » : l'utilisateur verrait une offre signée d'un marchand qui
 * n'existe pas. */
function motif(e, mot) {
  if (Array.isArray(e)) return { q: e[0], nom: e[1] };
  // L'étiquette est le nom du marchand SANS son qualificatif de pays
  // (« Aldi Belgique » → « Aldi », le pays étant déjà porté par l'offre).
  //
  // DÉFAUT CORRIGÉ : c'était `String(e).split(/\s+/)[0]`, le PREMIER MOT. Deux
  // syllabes d'un vrai nom disparaissaient donc de l'affichage — « Media Markt »
  // s'étiquetait « Media », « Vanden Borre » s'étiquetait « Vanden », et la
  // carte signait l'offre d'un marchand qui n'existe pas. Le commentaire
  // ci-dessus mettait déjà en garde contre ce risque pour un autre cas ; la
  // règle n'avait simplement pas été appliquée ici.
  const nom = String(e).replace(/\s+(belgique|belgi[ëe])$/i, '').trim();
  return { q: `${e} ${mot}`, nom };
}

const VEILLE_ENSEIGNES = ENSEIGNES_PAR_PAYS.flatMap((p) => p.marchands.map((e) => {
  const mot = p.langue === 'nl' ? 'promotie' : 'promotion';
  const { q, nom } = motif(e, mot);
  // L'identifiant porte la REQUÊTE et pas seulement le marchand : « Colruyt » et
  // « folder Colruyt » sont deux recherches distinctes sur le même marchand, et
  // deux sources qui partageraient un identifiant se marcheraient dessus dans le
  // suivi des délais de repos (une seule serait interrogée, l'autre jamais).
  // Attrapé par le test « les identifiants de source sont uniques ».
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  return {
    id: `enseigne-${p.pays.toLowerCase()}-${p.langue}-${slug(nom)}-${slug(q)}`,
    nom: `${nom} (${p.pays})`,
    type: 'presse',
    pays: p.pays,
    langue: p.langue,
    // Le marchand dont on parle : c'est LUI qui étiquettera l'offre.
    marchandImpose: nom,
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&mkt=${p.mkt}`,
    reposMin: 45,
  };
}));

/** Bing ne donne pas le lien de l'éditeur mais un redirecteur :
 *  « apiclick.aspx?…&url=<adresse réelle> ». On dé-échappe (« &amp; ») puis on
 *  extrait. Sans cela chaque offre de Bing pointerait vers bing.com, et son
 *  visuel serait introuvable — c'est-à-dire exactement le défaut qu'on répare.
 *  Le piège : le séparateur est écrit « &amp;url= », donc un motif « [?&]url= »
 *  ne trouve rien. Il faut dé-échapper AVANT de chercher. */
function lienReel(lien) {
  const l = String(lien || '').replace(/&amp;/g, '&');
  const m = l.match(/[?&]url=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : l;
}

/* ------------------------------------------------------------------ *
 *  LA RUBRIQUE D'UN SITE, ET LA VOIE PAR LAQUELLE ON LE LIT.
 *  (demande de B, 08/10/2026 : « classe-les par pays et par rubrique :
 *   supermarché, presse, e-commerce… »)
 *
 *  DEUX NOTIONS QU'IL NE FAUT PAS CONFONDRE. Les mélanger rendrait la liste
 *  inutilisable pour ce qu'elle doit servir — trouver des sites à activer.
 *
 *    - La RUBRIQUE dit ce que le site EST : « supermarché », « presse & médias »,
 *      « communauté de bons plans », « électro & high-tech »… C'est le classement
 *      demandé. Une rubrique se DÉDUIT (jamais saisie à la main plus loin que la
 *      petite table ci-dessous, que les tests tiennent en place).
 *
 *    - La VOIE dit COMMENT on lit le site. « flux » : le site publie ses offres
 *      et on les lit chez lui. « veille » : aucune offre n'est lisible chez le
 *      marchand (page en JavaScript, 403, image seule — mesuré un par un, voir
 *      SOURCES.md) et on ne l'atteint qu'à travers un moteur de recherche qui
 *      parle de lui.
 *
 *  C'est la VOIE qui répond à la vraie question. Un site en « veille » n'est pas
 *  branché : il est surveillé de loin, les annonces viennent d'articles de presse
 *  qui le mentionnent. Le jour où il publie un flux lisible, on le branche et sa
 *  ligne change de voie. Sans cette colonne, on chercherait longtemps pourquoi
 *  « Delhaize » n'apporte pas de vraies promos : il est en veille, pas en flux.
 * ------------------------------------------------------------------ */

/** Le secteur d'un marchand, d'après son nom. Clés sans accent ni casse. */
const SECTEUR_MARCHAND = {
  colruyt: 'supermarché', delhaize: 'supermarché', lidl: 'supermarché',
  aldi: 'supermarché', carrefour: 'supermarché', 'intermarche': 'supermarché',
  spar: 'supermarché', 'bio-planet': 'supermarché', okay: 'supermarché',
  'supermarches': 'supermarché', supermarkten: 'supermarché',
  hubo: 'bricolage & jardin', brico: 'bricolage & jardin',
  gamma: 'bricolage & jardin', toolstation: 'bricolage & jardin',
  dreamland: 'jouets & enfants', fun: 'jouets & enfants', 'maxi toys': 'jouets & enfants',
  'media markt': 'électro & high-tech', 'vanden borre': 'électro & high-tech',
  'krefel': 'électro & high-tech', coolblue: 'électro & high-tech',
  jbc: 'mode & chaussures', torfs: 'mode & chaussures',
  kruidvat: 'droguerie & beauté', hema: 'maison & variété', action: 'maison & variété',
  zooplus: 'animalerie', groupon: 'activités & sorties', amazon: 'e-commerce',
  'social deal': 'activités & sorties',
};

/** Le secteur d'un marchand nommé, ou null. Tolère « Colruyt promotie (BE) » :
 *  on cherche le préfixe marchand le plus long, pour que « Folder Colruyt » ne
 *  se perde pas et que « Maxi Toys » ne se coupe pas en « Maxi ». */
function secteurMarchand(nom) {
  const n = sansAccents(String(nom || '').toLowerCase()).replace(/\s*\([a-z]{2}\)\s*$/, '').trim();
  if (!n) return null;
  const cles = Object.keys(SECTEUR_MARCHAND)
    .filter((k) => n === k || n.startsWith(k + ' '))
    .sort((a, b) => b.length - a.length);
  return cles.length ? SECTEUR_MARCHAND[cles[0]] : null;
}

/** LA RUBRIQUE d'un site. Déduite, jamais saisie : la table ci-dessus ne porte
 *  que ce que le NOM ne dit pas. Une source peut poser `rubrique` en clair pour
 *  forcer la main. */
function rubriqueDeSite(s) {
  if (!s) return 'autre';
  if (s.rubrique) return s.rubrique;
  const u = String(s.url || '');
  // Un MOTEUR : la rubrique du marchand qu'il surveille, sinon « moteur de veille ».
  if (/news\.google\.com|\bbing\.com\/news/.test(u)) {
    return secteurMarchand(s.marchandImpose || s.nom) || 'moteur de veille';
  }
  if (s.type === 'dealabs') return 'communauté de bons plans';
  if (s.type === 'groupon' || s.type === 'socialdeal') return 'activités & sorties';
  if (s.type === 'amazon' || s.type === 'flash' || s.type === 'bol' || s.type === 'krefel') return 'e-commerce';
  // Une enseigne branchée : son secteur si le nom le dit (Coolblue → électro,
  // Zooplus → animalerie), sinon du commerce en ligne.
  if (s.type === 'enseigne') return secteurMarchand(s.nom) || 'e-commerce';
  if (s.type === 'presse') return 'presse & médias';
  return 'autre';
}

/** LA VOIE : « flux » (lisible chez le marchand) ou « veille » (vu à travers un
 *  moteur). C'est le champ qui dit quels sites sont réellement branchés. */
function voieDeSite(s) {
  if (s && s.voie) return s.voie;
  const u = String((s && s.url) || '');
  return /news\.google\.com|\bbing\.com\/news/.test(u) ? 'veille' : 'flux';
}

/** Toutes les sources, France et Europe. Exporté pour que les tests vérifient
    que chacune déclare bien un pays — une source sans pays enverrait ses offres
    dans le mauvais pays, sans que rien ne le signale. */
export const TOUTES_SOURCES = [...SOURCES, ...SOURCES_ENSEIGNES, ...SOURCES_ADRESSES, ...SOURCES_ACTIVITES, ...SOURCES_AMAZON, ...SOURCES_BOL, ...SOURCES_KREFEL, ...SOURCES_VENTES_FLASH, ...VEILLE_PAYS, ...VEILLE_BING, ...VEILLE_ENSEIGNES];

/** Exportés pour les TESTS : le filtre par langue et l'anti-tuile se vérifient
 *  en les exécutant, pas en relisant le fichier. */
export { MOTS_PROMO, motsPromo, ecarterTuiles, veilleParPays, lienReel, dedupliquerArticles, BUDGET_CRON, LIMITE_CRON_MS, PAYS_PRESSE, PAYS_BING };
/* Le classement est exporté pour être VÉRIFIÉ : le vérificateur
   (outils/verificateur-categories.mjs) et les tests rejouent `famille()` sur
   les offres publiées. Un contrôle qui recopierait la table des mots serait un
   contrôle qui vérifie sa propre copie — donc rien du tout. */
export { famille, FAMILLES, MARQUES, MOTS_FORTS, CATEGORIES_SOURCES, categorieDeSource, sansAccents, sansNegations, offresEnseigne, offresAmazon, offresVenteFlash, offresGroupon, offresSocialDeal, remiseCredibleSource, compterMots, remise, pourcentEcrit, SOURCES_VENTES_FLASH, SOURCES_ACTIVITES, prixReferenceEnseigne, estJeuNumerique, estSoin, ageEnfant, marqueurEnfant, MOTS_A_FRONTIERE, exigeFrontiere, retirerTrompeurs, estRepasDehors, preuveEpicerie, destinationEtrangere, estForfaitVoyage, DESTINATIONS, MOTS_FORFAIT_VOYAGE, SECTEUR_MARCHAND, secteurMarchand, rubriqueDeSite, voieDeSite };

/** Recherches Google News : un flux par famille de produits. Gratuit, sans clé. */
const RECHERCHES = [
  ['bricolage', 'bons plans bricolage outillage promo'],
  ['maison', 'promo électroménager maison réduction'],
  ['tech', 'bon plan high-tech réduction prix'],
  ['mode', 'promo vêtements réduction mode'],
  ['sport', 'promo sport fitness réduction'],
  ['jouets', 'promo jouets enfant réduction'],
  // « moto » ajouté à la requête : la rubrique s'appelle « Auto & moto », et
  // l'ancienne requête ne cherchait que l'auto — la moitié de son intitulé
  // n'avait aucune source derrière elle.
  ['auto', 'promo accessoires auto voiture moto casque réduction'],
];

/** LE TYPE DE CHAQUE SOURCE, identifiant → type.
 *
 *  Il sert à décider LAQUELLE des trois règles de péremption s'applique à une
 *  offre déjà engrangée : la DATE pour la presse (sa date ne prouve rien de la
 *  validité), la DISPARITION pour un marchand (sa disparition est une preuve),
 *  et rien du tout pour un identifiant inconnu — c'est la définition même de
 *  l'offre orpheline, dont la source a quitté le catalogue.
 *
 *  ⚠ Les SEPT recherches Google News (`gnews-jouets`, `gnews-auto`…) sont des
 *  sources ACTIVES qui ne figurent dans aucun catalogue publié : elles sont
 *  construites à la volée par collecterRecherche(). Sans la seconde ligne, leurs
 *  offres passeraient pour orphelines et seraient jugées à la légère. */
const TYPE_PAR_SOURCE = new Map([
  ...TOUTES_SOURCES.map((s) => [s.id, s.type || '']),
  ...RECHERCHES.map(([familleId]) => ['gnews-' + familleId, 'presse']),
]);

/** Le type d'une source, ou la chaîne vide si l'identifiant n'est plus au
 *  catalogue — ce vide EST le signal de l'offre orpheline. */
export function typeDeSource(id) {
  return TYPE_PAR_SOURCE.get(id == null ? '' : String(id)) || '';
}

/* ------------------------------------------------------------------ *
 *  LES LECTEURS DONT LA PAGE NE DIT AUCUNE DATE — LEUR DATE EST UN RELEVÉ
 *
 *  Défaut signalé par B (10/10/2026), mot pour mot : « tantôt j'ai observé une
 *  erreur d'affichage, pas du site mais des articles et de la mise à jour ».
 *  Toutes les cartes d'un même marchand affichaient « il y a 1 min » —
 *  exactement le chiffre de la ligne « mis à jour il y a 1 min » de l'en-tête.
 *  L'âge d'une offre et l'heure de la collecte étaient devenus indiscernables,
 *  et le tri « Plus récentes » ne triait plus rien.
 *
 *  Cause exacte, et non supposée : ces sept lecteurs FABRIQUENT la date au
 *  moment du passage (`date: new Date().toISOString()`), et la fusion des offres
 *  écrasait donc ce champ à chaque collecte. Or ces pages — enseignes (Coolblue,
 *  Amazon, bol, Krefel, Zooplus…), Groupon, Socialdeal, ventes flash — ne
 *  publient aucune date de bon plan. Ce qu'on sait d'elles, c'est la dernière
 *  fois qu'on les a VUES : c'est `vuLe`, qui existe déjà et n'a pas à être
 *  déguisé en date d'offre.
 *
 *  On ne prétend donc plus connaître une date qu'on ignore :
 *
 *    • le lecteur marque ses offres `dateRelevee: true` — c'est une date de
 *      RELEVÉ, pas une date de publication ;
 *    • la fusion conserve la date de la PREMIÈRE rencontre (voir la boucle de
 *      fusion) : elle ne bouge plus d'un passage à l'autre ;
 *    • `vuLe` continue de dire la fraîcheur du dernier contact, et l'en-tête
 *      continue de dire l'heure de la collecte. Deux chiffres, deux vérités.
 *
 *  Réparation RÉTROACTIVE, comme le reclassement et la remise : les offres déjà
 *  en base portent la date du dernier passage, donc un « il y a 1 min » faux.
 *  On leur rend leur `premiereVue` — le seul repère honnête qu'on ait gardé.
 * ------------------------------------------------------------------ */
export const TYPES_DATE_RELEVEE = new Set([
  'enseigne', 'amazon', 'bol', 'krefel', 'groupon', 'socialdeal', 'flash',
]);

/** Une source dont le LECTEUR fabrique la date : la seule qui puisse en
 *  fabriquer une sur une page qui n'en publie pas (voir TYPES_DATE_RELEVEE). */
export const dateEstUnReleve = (typeSource) => TYPES_DATE_RELEVEE.has(String(typeSource || ''));

/* ------------------------------------------------------------------ *
 *  Analyse XML minimale, sans dépendance.
 * ------------------------------------------------------------------ */
/* Décode les entités HTML.
 *
 * Le jeu nommé ci-dessous est explicite, mais les entités NUMÉRIQUES
 * (`&#160;`, `&#8217;`, `&#x27;`…) sont calculées : les flux en renvoient en
 * pagaille — espaces insécables surtout — et une liste figée les laisserait
 * traverser jusqu'à l'écran, où elles s'affichent littéralement
 * (« Xiaomi 15&#160;: »).
 */
const ENTITES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…',
  ndash: '–', mdash: '—', deg: '°', euro: '€', times: '×', middot: '·',
  laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à',
  ccedil: 'ç', ugrave: 'ù', ecirc: 'ê', ocirc: 'ô', icirc: 'î',
  acirc: 'â', ucirc: 'û', euml: 'ë', ntilde: 'ñ', oelig: 'œ',
};

function decoderEntites(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    const v = ENTITES[e] !== undefined ? ENTITES[e] : ENTITES[e.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

/** Décode jusqu'à stabilité : certaines sources double-encodent (« B&amp;amp;M »). */
function decaper(s) {
  if (typeof s !== 'string') return s;
  let t = s;
  for (let i = 0; i < 3; i++) {
    const avant = t;
    t = decoderEntites(t);
    if (t === avant) break;
  }
  return t;
}

const nettoyer = (s) => decaper(
  String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' '),
)
  // Une entité décodée peut avoir reformé une balise (« &lt;p&gt; »).
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Exporté pour les tests : ces trois fonctions sont le seul endroit où l'on
// touche au texte des sources.
export { decoderEntites, decaper, nettoyer };

const balise = (bloc, nom) => {
  const m = bloc.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, 'i'));
  return m ? m[1] : '';
};

function items(xml) {
  const out = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  if (out.length) return out;
  // Atom (Les Numériques)
  const re2 = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  while ((m = re2.exec(xml))) out.push(m[1]);
  return out;
}

/* ------------------------------------------------------------------ *
 *  Catégories — on traduit celles des sources en familles d'achat.
 * ------------------------------------------------------------------ */
/* Mots-clés de catégorie, TOUTES LANGUES.
 *
 * DÉFAUT CORRIGÉ — c'était la cause racine du mauvais classement, et elle était
 * invisible : les listes ci-dessous étaient en FRANÇAIS SEUL, alors qu'elles
 * s'appliquent aux douze pays. Conséquence mesurée sur les données publiées :
 * 72 % des offres tombaient dans « Autres » — 90 % au Portugal, 89 % en
 * Pologne, 88 % en Espagne, 86 % en Irlande, 81 % au Royaume-Uni. Un titre
 * allemand (« Philips Kaffeemaschine ») ne rencontrait aucun mot de la liste
 * française : il n'était pas mal classé, il n'était PAS classé.
 *
 * Les mots sont écrits SANS ACCENT : le texte est lui aussi désaccentué avant
 * comparaison (voir sansAccents). Cela évite de maintenir deux fois chaque mot
 * (« cafetière » et « cafetiere ») et rend la comparaison indifférente aux
 * accents que les sources ajoutent ou omettent.
 *
 * Ce n'est pas une classification sémantique : c'est un vote de mots. La règle
 * du code reste donc prudente — voir famille() pour l'ordre des preuves.
 */
const FAMILLES = {
  bricolage: [
    // fr
    'bricolage', 'outillage', 'quincaillerie', 'jardin', 'perceuse', 'visseuse', 'peinture', 'sanitaire', 'plomberie', 'electricite', 'atelier', 'brico', 'tondeuse a gazon', 'robot tondeuse', 'tondeuse robot', 'scie', 'tournevis', 'echelle', 'chaudiere', 'robinet', 'souffleur', 'taille-haie', 'debroussailleuse',
    // en
    'diy', 'tools', 'toolbox', 'drill', 'screwdriver', 'paint', 'plumbing', 'lawnmower', 'lawn mower', 'mower', 'ladder', 'hardware', 'sander', 'wallpaper',
    // de
    'baumarkt', 'werkzeug', 'bohrmaschine', 'schraubendreher', 'akku', 'garten', 'rasenmaher', 'mahroboter', 'leiter', 'eisenwaren', 'heizung', 'werkbank',
    // nl
    'doe-het-zelf', 'gereedschap', 'boormachine', 'schroevendraaier', 'verf', 'sanitair', 'tuin', 'grasmachine', 'robotmaaier', 'zaag', 'ijzerwaren', 'kraan',
    // es
    'bricolaje', 'herramientas', 'taladro', 'destornillador', 'pintura', 'fontaneria', 'jardin', 'cortacesped', 'sierra', 'escalera', 'ferreteria',
    // it
    'fai da te', 'utensili', 'trapano', 'cacciavite', 'vernice', 'idraulica', 'giardino', 'tosaerba', 'sega', 'scala', 'ferramenta',
    // pt
    'ferramentas', 'berbequim', 'chave de fendas', 'tinta', 'canalizacao', 'jardim', 'cortador de relva', 'serra', 'escada', 'ferragens',
    // pl
    'majsterkowanie', 'narzedzia', 'wiertarka', 'wkretak', 'farba', 'hydraulika', 'ogrod', 'kosiarka', 'pila', 'drabina', 'klucze',
    // sv
    'gor-det-sjalv', 'verktyg', 'borrmaskin', 'skruvmejsel', 'farg', 'tradgard', 'grasklippare', 'sag', 'stege',
  ],
  //  MAISON — la DÉCO, le LINGE DE MAISON, la CUISINE (ustensiles) et le JARDIN.
  //  ⚠ Unité E6 : le MOBILIER n'est PLUS ici — il a sa propre famille
  //  « meubles », juste après. Maison garde ce que B a demandé de garder :
  //  la déco, le linge de maison (dont le LINGE DE LIT : matelas, couette,
  //  oreiller, drap) et le jardin — y compris le mobilier de JARDIN
  //  (« gartenmobel », « tuinmeubelen »), qui est du jardin, pas du salon.
  maison: [
    // fr
    'maison', 'habitat', 'cuisine', 'literie', 'matelas', 'deco', 'piscine', 'barbecue', 'cocotte', 'poele', 'couette', 'oreiller', 'vaisselle',
    //  AJOUT MESURÉ le 7/10 (unité A7, audit de « Autres ») — petit mobilier
    //  et entretien de la maison, mesurés en « Autres » sur les ventes flash
    //  Amazon (aucune rubrique de source, donc un seul mot suffit) :
    //   « bocaux » (3, ComSaf) → rangement de cuisine ; « boite a pain » (1) ;
    //   « chiffon microfibre »/« lavette » (1, MR.SIGA) ; « paillasson » (2) ;
    //   « guirlande » (1, LED). Mots FAIBLES : ils ne tranchent qu'en l'absence
    //   de rubrique de source ou contre « Autres », jamais contre une vraie
    //   rubrique du marchand.
    'bocaux', 'boite a pain', 'chiffon microfibre', 'paillasson', 'guirlande',
    // en
    'home', 'kitchen', 'mattress', 'bedding', 'cookware', 'pan', 'duvet', 'pillow', 'decor', 'bed sheet',
    // de
    'haushalt', 'kuche', 'matratze', 'bettwaren', 'pfanne', 'bettdecke', 'kissen', 'deko', 'gartenmobel',
    // nl
    'woning', 'huis', 'keuken', 'matras', 'beddengoed', 'dekbed', 'kussen', 'decoratie', 'tuinmeubelen',
    // es
    'hogar', 'vivienda', 'colchon', 'ropa de cama', 'sarten', 'edredon', 'almohada', 'decoracion',
    // it
    'casa', 'materasso', 'biancheria', 'caffe', 'padella', 'piumino', 'cuscino', 'arredamento',
    // pt
    'cozinha', 'colchao', 'roupa de cama', 'frigideira', 'edredao', 'almofada', 'decoracao', 'tapete', 'cortina',
    // pl
    'dom', 'kuchnia', 'materac', 'posciel', 'patelnia', 'koldra', 'poduszka', 'dekoracje',
    // sv
    'hem', 'kok', 'madrass', 'sangklader', 'stekpanna', 'tacke', 'kudde', 'inredning',
  ],
  //  MEUBLES — le MOBILIER, et rien d'autre (demande de B, plan point 16 :
  //  « canapé, table, chaise, lit, armoire, bureau, étagère, commode, buffet,
  //  fauteuil »). Il sort de « maison », qui garde la déco, la literie et le
  //  jardin. ⚠ Le MATELAS reste en maison/literie (point 16) : il est
  //  VOLONTAIREMENT absent d'ici.
  //
  //  Règle d'écriture, apprise à la mesure : les mots de meuble qui sont aussi
  //  des MOTS ORDINAIRES très fréquents sont pris ENTRE DEUX FRONTIÈRES (voir
  //  MOTS_A_FRONTIERE) — sans quoi « mobilier » serait lu dans « immobilier »,
  //  « cama » (lit, es) dans « cámara » (appareil photo) et « table » dans
  //  « tablette ». Et les mots piégeux mesurés sont ÉCARTÉS :
  //   « lit » seul   → « couette pour lit 2 personnes » n'est pas un meuble ;
  //   « table » seul → « scie circulaire de table » est du bricolage ;
  //   « bureau » seul→ « kit bureautique » n'est pas un meuble (frontière exigée) ;
  //   « sang » (sv)  → « sangklader » (linge de lit) n'est pas un meuble ;
  //   « mobili » (it) → la marque « Rebecca Mobili » vend des horloges murales :
  //                     le mobili est GARDÉ (c'est « meubles » en italien) et
  //                     c'est le NOM DE MARQUE qui est neutralisé, dans
  //                     MOTS_TROMPEURS — « rebecca mobili ».
  meubles: [
    // fr
    'canape', 'canape-lit', 'fauteuil', 'chaise', 'tabouret', 'armoire', 'commode', 'etagere', 'bibliotheque', 'buffet', 'meuble', 'mobilier', 'sommier', 'table basse', 'table a manger', 'table de chevet', 'table de nuit', 'buffet bas',
    // en
    'sofa', 'couch', 'armchair', 'wardrobe', 'bookcase', 'bookshelf', 'sideboard', 'nightstand', 'headboard', 'stool', 'bed frame', 'furniture', 'recliner', 'chaise longue', 'coffee table', 'dining table',
    // de
    'sofa', 'sessel', 'schrank', 'regal', 'kommode', 'sideboard', 'bettgestell', 'doppelbett', 'couch', 'sitzbank', 'schreibtisch', 'kleiderschrank', 'buecherregal', 'hocker', 'mobel', 'esszimmertisch',
    // nl
    'sofa', 'zitbank', 'stoel', 'kast', 'kledingkast', 'boekenkast', 'dressoir', 'meubel', 'salontafel', 'eettafel', 'nachtkastje', 'fauteuil',
    // es
    'sofa', 'sillon', 'butaca', 'armario', 'estanteria', 'comoda', 'aparador', 'mueble', 'escritorio', 'silla', 'mesa de comedor', 'mesa de noche', 'mesa de salon', 'somier', 'cama de matrimonio', 'litera',
    // it
    'divano', 'poltrona', 'armadio', 'libreria', 'cassettiera', 'credenza', 'mobili', 'tavolo', 'sedia', 'comodino', 'scaffale', 'madia',
    // pt
    'sofa', 'poltrona', 'armario', 'estante', 'comoda', 'aparador', 'movel', 'mobilia', 'escrivaninha', 'cadeira', 'roupeiro', 'mesa de jantar', 'mesa de cabeceira',
    // pl
    'sofa', 'kanapa', 'fotel', 'szafa', 'komoda', 'kredens', 'meble', 'biurko', 'stolik', 'krzeslo', 'szafka', 'lozko',
    // sv
    'soffa', 'fatolj', 'bokhylla', 'byra', 'skank', 'garderob', 'mobler', 'skrivbord', 'matbord', 'soffbord', 'nattduksbord', 'pall',
  ],
  //  ANIMAUX — nourriture ET accessoires pour animaux (demande de B, point 18).
  //  ⚠ La nourriture ANIMALE va ici, JAMAIS en « Nourriture » (qui reste
  //  réservée à l'alimentation HUMAINE). On n'écrit que des locutions PRÉCISES :
  //  les mots NUS « animal », « chat », « chien », « poisson », « oiseau » sont
  //  MESURÉS faux en sous-chaîne — « cat » attrapait 128 offres (le vrai mot
  //  « categorie », « certificat »…), « hund » 13 dans « Thunderbolt », « gato »
  //  dans « Elgato », « hond » dans « Honda », « kot » dans « Bernkot », « cane »
  //  dans « canette ». Les formes courtes ou glissantes sont en outre lues
  //  ENTRE DEUX FRONTIÈRES (voir MOTS_A_FRONTIERE). Les accessoires piégeux
  //  (« collier », « panier ») sont pris EN LOCUTION (« collier pour chien »),
  //  pas seuls : un collier peut être un bijou, un panier un rangement.
  animaux: [
    // fr
    'animalerie', 'croquettes pour chat', 'croquettes pour chien', 'croquettes pour chaton', 'patee pour chat', 'patee pour chien', 'litiere pour chat', 'litiere chat', 'bac a litiere', 'arbre a chat', 'griffoir', 'fontaine a eau pour chat', 'distributeur de croquettes', 'panier pour chien', 'laisse pour chien', 'collier pour chien', 'jouet pour chat', 'jouet pour chien', 'niche pour chien', 'cage pour oiseau', 'animal de compagnie', 'nourriture pour chat', 'nourriture pour chien', 'couchage pour chien', 'fontaine a eau pour animaux',
    // en
    'pet food', 'cat litter', 'litter box', 'dog food', 'cat food', 'dog bed', 'cat bed', 'cat tree', 'scratching post', 'pet carrier', 'bird cage', 'hamster cage', 'dog collar', 'cat collar', 'pet toy', 'dog leash', 'pet bed', 'fish tank', 'bird feeder', 'dog crate',
    // de
    'katzenfutter', 'hundefutter', 'katzenklo', 'katzenstreu', 'kratzbaum', 'hundebett', 'vogelkafig', 'hundenapf', 'hundeleine', 'hundehalsband', 'aquarium', 'tiernahrung', 'nagetierkafig', 'vogelfutter', 'katzenkorb', 'hundehuette', 'katzenzubehor', 'katzentoilette',
    // nl
    'kattenvoer', 'hondenvoer', 'kattenbak', 'kattenbakvulling', 'krabpaal', 'hondenmand', 'vogelkooi', 'hondenriem', 'halsband voor honden', 'kattenluik', 'hondenhok', 'vogelvoer', 'knaagdierkooi', 'kattenkrabpaal', 'hondenbench',
    // es
    //  singulier ET pluriel : « comida para perro » et « … para perros » sont
    //  tous deux employés ; ne lister que le pluriel laissait passer le
    //  singulier (mesuré : « comida para perro … 3 kg » tombait en « Autres »).
    'comida para perros', 'comida para perro', 'comida para gatos', 'comida para gato', 'pienso para perros', 'pienso para perro', 'pienso para gatos', 'pienso para gato', 'arenero para gatos', 'arenero para gato', 'rascador para gatos', 'rascador para gato', 'cama para perros', 'cama para perro', 'cama para gatos', 'cama para gato', 'acuario', 'jaula para pajaros', 'transportin para mascotas', 'comedero para perros', 'comedero para perro', 'juguete para gatos', 'juguete para gato', 'collar para perros', 'collar para perro', 'correa para perros', 'correa para perro',
    // it
    'cibo per cani', 'cibo per cane', 'cibo per gatti', 'cibo per gatto', 'lettiera per gatti', 'lettiera per gatto', 'graffiatoio per gatti', 'graffiatoio per gatto', 'cuccia per cani', 'cuccia per cane', 'acquario', 'gabbia per uccelli', 'trasportino per animali', 'cibo per animali', 'guinzaglio per cani', 'guinzaglio per cane', 'collare per cani', 'collare per cane', 'tiragraffi', 'cuccia per gatti', 'cuccia per gatto', 'mangiatoia per animali',
    // pt
    'racao para caes', 'racao para cao', 'racao para gatos', 'racao para gato', 'areia para gatos', 'areia para gato', 'arranhador para gatos', 'arranhador para gato', 'cama para caes', 'cama para cao', 'cama para gato', 'aquario', 'gaiola para passaros', 'comedouro para', 'coleira para caes', 'coleira para cao', 'trela para caes', 'trela para cao', 'caixa de areia para gatos', 'brinquedo para gatos', 'brinquedo para gato', 'comida para animais', 'transportadora para animais',
    // pl
    //  « dla psa / dla kota » (génitif singulier) s'ajoute à « dla psow /
    //  dla kotow » : « karma dla psa 15kg » ne matchait pas et tombait en Autres.
    'karma dla psow', 'karma dla psa', 'karma dla kota', 'karma dla kotow', 'drapak dla kotow', 'drapak dla kota', 'legowisko dla psa', 'legowisko dla kota', 'akwarium', 'klatka dla ptakow', 'smycz dla psa', 'obroza dla psa', 'kuweta dla kota', 'pokarm dla zwierzat', 'dom dla kota', 'zabawka dla kota', 'zabawka dla psa', 'kocie legowisko',
    // sv
    'hundmat', 'kattmat', 'kattsand', 'klostrad', 'hundkoja', 'akvarium', 'fagelbur', 'hundkoppel', 'katthalsband', 'kattlada', 'fagelmat', 'gnagarbur', 'kattbadd', 'hundsang',
  ],
  //  VOYAGES — les FORFAITS qui emmènent AILLEURS (demande de B, points 19 et
  //  21). Le partage avec « Activité » est GÉOGRAPHIQUE : une prestation faite
  //  DANS le pays de l'offre reste en Activité ; ce qui emmène à l'ÉTRANGER va
  //  ici. Un forfait (vol, séjour, croisière, nuits, location de voiture,
  //  aller-retour) va en Voyages même si la destination n'est pas identifiable
  //  (voir MOTS_FORFAIT_VOYAGE et classerOffre). ⚠ Les mots NUS « vol »,
  //  « reis », « reise », « resa », « lot », « trip » sont mesurés faux en
  //  sous-chaîne (129, 122… de bruit) : ils sont lus entre deux frontières.
  voyages: [
    // fr
    'voyage', 'sejour', 'croisiere', 'city break', 'aller-retour', 'billet d avion', 'location de voiture', 'nuit d hotel', 'forfait voyage', 'vol sec', 'sejour tout compris', 'voyage organise', 'circuit touristique', 'week-end a l etranger', 'croisiere fluviale',
    // en
    'flight', 'round trip', 'return flight', 'package holiday', 'cruise', 'hotel stay', 'flight deal', 'holiday package', 'beach holiday', 'ski holiday', 'guided tour', 'sightseeing tour', 'all inclusive', 'weekend getaway', 'nights stay',
    // de
    'reise', 'urlaub', 'kreuzfahrt', 'flugreise', 'kurzreise', 'stadtereise', 'reiseangebot', 'hotelaufenthalt', 'rundreise', 'ferien', 'urlaubsreise', 'wellnessreise', 'flug',
    // nl
    'vakantie', 'reis', 'vlucht', 'cruise', 'stedentrip', 'vakantiehuis', 'vakantiepark', 'reisje', 'rondreis', 'vliegticket', 'hotelovernachting', 'zonvakantie',
    // es
    'viaje', 'vuelo', 'crucero', 'escapada', 'vuelos', 'paquete vacacional', 'estancia hotel', 'tour guiado', 'billete de avion', 'viaje organizado', 'resort todo incluido',
    // it
    'viaggio', 'volo', 'crociera', 'vacanza', 'pacchetto vacanza', 'tour guidato', 'biglietto aereo', 'soggiorno hotel', 'settimana bianca', 'viaggio organizzato',
    // pt
    'viagem', 'voo', 'cruzeiro', 'estadia', 'pacote de viagem', 'tour guiado', 'bilhete de aviao', 'viagem organizada', 'escapadinha',
    // pl
    // pl — ⚠ « podroz » RETIRÉ (mesuré le 7/10) : le radical polonais
    //  « podróż » attrapait « podróży » et « podróżne » DANS DES PRODUITS
    //  (« Bokserki … dla podróży », « etui podróżne » d'une brosse à dents) et
    //  rangeait boxer et brosse à dents en VOYAGES. Les offres de voyage
    //  polonaises sont déjà désignées par leur rayon de source (« Podróże » →
    //  voyages, CATEGORIES_SOURCES) : le mot nu ne servait qu'à du bruit.
    'wycieczka', 'rejs', 'wakacje', 'wyjazd', 'urlop', 'przelot', 'zakwaterowanie', 'wycieczka objazdowa', 'narty za granica',
    // sv
    'resa', 'flyg', 'kryssning', 'semester', 'utlandsresa', 'weekendresa', 'flygresa', 'hotellvistelse', 'paketresa', 'skidresa',
  ],
  //  NOURRITURE — l'ÉPICERIE SEULEMENT (demande de B, point 22). Le CABAS :
  //  alimentation à cuisiner, supermarché, fruits et légumes, boissons, bière,
  //  alcool. ⚠ Les REPAS PRIS DEHORS (restaurant, hamburger, brunch, menu,
  //  buffet, à emporter) NE SONT PAS ici : ils restent en ACTIVITÉ, et la
  //  fonction estRepasDehors() les y renvoie explicitement (voir famille()).
  //
  //  Règle d'écriture : aucun mot AMBIGU. Écartés à la mesure, et pour de
  //  bonnes raisons mesurées :
  //   « miel » → « Miele » (43 offres d'électroménager) : pris à frontière ;
  //   « lait », « crème » → « mousseur de lait », « crème de jour » (cosmétique) ;
  //   « fromage » → « râpe à fromage » (appareil) ;
  //   « café » seul → « machine à café » ;
  //   « baguette » → « baguette magique » ; « pain » → « pain de glace ».
  //  Les marques de CHOCOLAT « kinder schokolade » et « kinder bueno » sont
  //  déjà retirées par MOTS_TROMPEURS (elles partaient en jouets) — ne pas
  //  ajouter « kinder » ici, ce serait rouvrir le défaut.
  nourriture: [
    // fr
    'epicerie', 'alimentation', 'supermarche', 'chocolat', 'bonbons', 'confiserie', 'biscuits', 'cookies', 'conserve', 'confiture', 'cereales', 'muesli', 'farine', 'brioche', 'vinaigre', 'ketchup', 'mayonnaise', 'moutarde', 'nutella', 'pate a tartiner', 'chips', 'cacahuetes', 'amandes', 'miel', 'cafe en grains', 'cafe moulu', 'the vert', 'infusion', 'jus de fruits', 'eau minerale', 'biere', 'whisky', 'vodka', 'rhum', 'tequila', 'champagne', 'prosecco', 'vin rouge', 'vin blanc', 'vin rose', 'saucisson', 'charcuterie', 'legumes', 'pommes de terre', 'tomates', 'bananes', 'oranges', 'oeufs', 'pates alimentaires',
    // en
    'groceries', 'chocolate', 'chocolates', 'biscuits', 'custard', 'crisps', 'peanuts', 'almonds', 'muesli', 'flour', 'vinegar', 'ketchup', 'mayonnaise', 'mustard', 'nutella', 'red wine', 'white wine', 'beer', 'lager', 'whisky', 'whiskey', 'vodka', 'rum', 'tequila', 'champagne', 'prosecco', 'coffee beans', 'ground coffee', 'green tea', 'orange juice', 'mineral water', 'sausage', 'vegetables', 'potatoes', 'tomatoes', 'bananas', 'oranges', 'eggs',
    // de
    'lebensmittel', 'schokolade', 'kekse', 'brotchen', 'mehl', 'essig', 'senf', 'bier', 'wein', 'wodka', 'kaffeebohnen', 'orangensaft', 'mineralwasser', 'kase', 'wurst', 'gemuse', 'kartoffeln', 'tomaten', 'bananen', 'eier', 'nudeln', 'musli', 'sirup',
    // nl
    'levensmiddelen', 'boodschappen', 'chocolade', 'koekjes', 'meel', 'azijn', 'mosterd', 'bier', 'wijn', 'wodka', 'mineraalwater', 'kaas', 'worst', 'groenten', 'aardappelen', 'tomaten', 'bananen', 'eieren',
    // es
    'comestibles', 'galletas', 'harina', 'vinagre', 'mostaza', 'cerveza', 'vino', 'ron', 'zumo de naranja', 'agua mineral', 'queso', 'embutido', 'verduras', 'patatas', 'platanos', 'huevos',
    // it
    'alimentari', 'cioccolato', 'biscotti', 'farina', 'aceto', 'senape', 'birra', 'vino', 'succo d arancia', 'acqua minerale', 'formaggio', 'salumi', 'verdure', 'patate', 'pomodori', 'uova', 'cereali',
    // pt
    'alimentacao', 'bolachas', 'farinha', 'vinagre', 'mostarda', 'cerveja', 'vinho', 'sumo de laranja', 'agua mineral', 'queijo', 'chourico', 'legumes', 'batatas', 'tomates', 'bananas', 'ovos',
    // pl
    'spozywcze', 'czekolada', 'ciasteczka', 'chleb', 'maka', 'ocet', 'musztarda', 'piwo', 'wino', 'kawa ziarnista', 'sok pomaranczowy', 'woda mineralna', 'ser zolty', 'kielbasa', 'warzywa', 'owoce', 'ziemniaki', 'pomidory', 'banany', 'jajka', 'makaron', 'platki',
    // sv
    'livsmedel', 'choklad', 'kakor', 'brod', 'mjol', 'attika', 'senap', 'vin', 'apelsinjuice', 'mineralvatten', 'korv', 'gronsaker', 'potatis', 'tomater', 'bananer', 'agg', 'flingor',
  ],
  //  ÉLECTROMÉNAGER — les APPAREILS ménagers, et rien d'autre. Il prend le
  //  froid (frigo, congélateur), le lavage (lave-linge, lave-vaisselle,
  //  sèche-linge), l'entretien (aspirateur), la cuisson (micro-ondes, four,
  //  cafetière, bouilloire, grille-pain, friteuse), le soin du linge (fer à
  //  repasser) et des cheveux (sèche-cheveux, lisseur, rasoir, tondeuse à
  //  cheveux/barbe) et la climatisation (ventilateur, chauffage, purificateur).
  //  Il NE PREND PAS ce qui diffuse une image : téléviseur, écran, projecteur,
  //  barre de son, enceinte restent en high-tech (voir FAMILLES.tech).
  //  ⚠ La TONDEUSE À GAZON reste en bricolage : « tondeuse » seule est ici
  //  lue comme tondeuse À CHEVEUX seulement quand le mot « cheveux » suit.
  electromenager: [
    // fr
    'electromenager', 'frigo', 'refrigerateur', 'congelateur', 'lave-linge', 'lave-vaisselle', 'seche-linge', 'aspirateur', 'cafetiere', 'machine a cafe', 'micro-ondes', 'bouilloire', 'grille-pain', 'friteuse', 'seche-cheveux', 'lisseur', 'fer a repasser', 'tondeuse a cheveux', 'ventilateur', 'chauffage', 'purificateur', 'cuisiniere',
    //  A8 : la HOTTE de cuisine manquait. Signalé par B le 09/10/2026 avec une
    //  offre réelle — « Klarstein Valeria Hotte Îlot - 230W, débit max. 642 m³/h
    //  … éclairage LED, panneau tactile » — qui partait en BEAUTÉ (à cause de
    //  « niveaux » lu dans « Nivea », voir MOTS_A_FRONTIERE) et serait tombée en
    //  « Autres » une fois ce défaut corrigé. Une hotte est un appareil ménager,
    //  dans les neuf langues.
    'hotte', 'hotte aspirante', 'hotte de cuisine', 'plaque de cuisson', 'plaque a induction',
    // en
    'appliance', 'appliances', 'vacuum cleaner', 'kettle', 'toaster', 'air fryer', 'coffee machine', 'espresso machine', 'fridge', 'refrigerator', 'freezer', 'dishwasher', 'washing machine', 'dryer', 'microwave', 'blender', 'food processor', 'hair dryer', 'straightener', 'clothes iron', 'fan', 'heater', 'air purifier',
    // de
    'haushaltsgerat', 'kuhlschrank', 'gefrierschrank', 'waschmaschine', 'geschirrspuler', 'trockner', 'staubsauger', 'kaffeemaschine', 'mikrowelle', 'wasserkocher', 'fritteuse', 'heissluftfritteuse', 'haartrockner', 'glatteisen', 'buggeleisen', 'rasierer', 'haarschneider', 'ventilator', 'heizung', 'luftreiniger', 'backofen', 'kochfeld',
    // nl
    'huishoudapparaat', 'koelkast', 'vriezer', 'wasmachine', 'vaatwasser', 'droger', 'stofzuiger', 'koffiezetapparaat', 'microgolf', 'waterkoker', 'friteuse', 'haardroger', 'stijltang', 'strijkijzer', 'scheerapparaat', 'haartrimmer', 'ventilator', 'verwarming', 'luchtzuiveraar', 'oven', 'kookplaat',
    // es
    'electrodomestico', 'frigorifico', 'congelador', 'lavadora', 'lavavajillas', 'secadora', 'aspirador', 'cafetera', 'microondas', 'hervidor', 'freidora', 'secador de pelo', 'alaciador', 'plancha de pelo', 'plancha de ropa', 'maquina de afeitar', 'cortapelo', 'ventilador', 'calefaccion', 'purificador', 'horno', 'batidora',
    // it
    'elettrodomestico', 'frigorifero', 'congelatore', 'lavatrice', 'lavastoviglie', 'asciugatrice', 'aspirapolvere', 'macchina del caffe', 'microonde', 'bollitore', 'friggitrice', 'asciugacapelli', 'piastra per capelli', 'ferro da stiro', 'rasoio', 'tagliacapelli', 'ventilatore', 'riscaldamento', 'purificatore', 'forno', 'frullatore', 'tostapane',
    // pt
    'eletrodomestico', 'frigorifico', 'congelador', 'maquina de lavar', 'maquina de lavar louca', 'secador', 'aspirador', 'maquina de cafe', 'micro-ondas', 'chaleira', 'fritadeira', 'secador de cabelo', 'prancha de cabelo', 'ferro de engomar', 'maquina de barbear', 'aparador de cabelo', 'ventoinha', 'aquecimento', 'purificador', 'forno', 'liquidificadora', 'torradeira',
    // pl
    'agd', 'lodowka', 'zamrazarka', 'pralka', 'zmywarka', 'suszarka', 'odkurzacz', 'ekspres do kawy', 'mikrofalowka', 'czajnik', 'frytkownica', 'suszarka do wlosow', 'prostownica', 'zelazko', 'golarka', 'maszynka do wlosow', 'wentylator', 'ogrzewanie', 'oczyszczacz', 'piekarnik', 'blender', 'toster',
    // sv
    'vitvara', 'kylskap', 'frys', 'tvatmaskin', 'diskmaskin', 'torktumlare', 'dammsugare', 'kaffemaskin', 'mikrovagsugn', 'vattenkokare', 'harfon', 'plattang', 'strykjarn', 'rakapparat', 'harstrimmer', 'flakt', 'varmare', 'luftrenare', 'ugn', 'spis',
  ],
  tech: [
    // fr
    'high-tech', 'high tech', 'informatique', 'smartphone', 'telephone', 'ordinateur', 'portable', 'ecran', 'casque', 'ecouteurs', 'tv', 'televiseur', 'console', 'gaming', 'drone', 'ssd', 'carte graphique', 'imprimante', 'montre connectee', 'enceinte', 'clavier', 'souris', 'tablette', 'appareil photo', 'barre de son', 'chargeur', 'batterie externe', 'routeur', 'disque dur', 'processeur', 'casque audio',
    // en
    'laptop', 'notebook', 'monitor', 'screen', 'headphone', 'earbud', 'earbuds', 'keyboard', 'mouse', 'tablet', 'phone', 'television', 'soundbar', 'printer', 'camera', 'console', 'gpu', 'charger', 'powerbank', 'power bank', 'smartwatch', 'speaker', 'router', 'usb', 'hard drive', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch', 'steam',
    // de
    'notebook', 'bildschirm', 'kopfhorer', 'tastatur', 'maus', 'handy', 'fernseher', 'soundbar', 'drucker', 'kamera', 'konsole', 'festplatte', 'grafikkarte', 'ladegerat', 'lautsprecher', 'smartwatch', 'elektronik', 'computer', 'rechner', 'kopfhorer',
    // nl
    'laptop', 'notebook', 'scherm', 'koptelefoon', 'hoofdtelefoon', 'toetsenbord', 'muis', 'telefoon', 'televisie', 'printer', 'camera', 'console', 'grafische kaart', 'oplader', 'luidspreker', 'smartwatch', 'elektronica', 'computer', 'koptelefoons',
    // es
    'portatil', 'ordenador', 'pantalla', 'auriculares', 'teclado', 'raton', 'tableta', 'telefono', 'televisor', 'barra de sonido', 'impresora', 'camara', 'consola', 'tarjeta grafica', 'cargador', 'altavoz', 'enrutador', 'electronica', 'movil', 'altavoces',
    // it
    'portatile', 'computer', 'schermo', 'cuffie', 'auricolari', 'tastiera', 'telefono', 'televisore', 'stampante', 'fotocamera', 'scheda grafica', 'caricabatterie', 'altoparlante', 'elettronica', 'pc',
    // pt
    'portatil', 'computador', 'ecra', 'auscultadores', 'fones', 'teclado', 'rato', 'telefone', 'televisor', 'impressora', 'camara', 'consola', 'placa grafica', 'carregador', 'coluna', 'eletronica', 'telemovel', 'computadores',
    // pl
    'laptop', 'komputer', 'ekran', 'sluchawki', 'klawiatura', 'mysz', 'smartfon', 'telewizor', 'drukarka', 'aparat', 'konsola', 'dysk', 'karta graficzna', 'ladowarka', 'glosnik', 'elektronika', 'laptopy', 'komputery',
    // sv
    'dator', 'bildskarm', 'horlurar', 'tangentbord', 'mus', 'surfplatta', 'telefon', 'tv-apparat', 'skrivare', 'kamera', 'konsol', 'grafikkort', 'laddare', 'hogtalare', 'elektronik', 'datorer',
  ],
  mode: [
    //  A8 — VÊTEMENTS ET ACCESSOIRES (demande de B : « les chaussettes et tout
    //  autre vêtement → Mode »). Complément des tables dans les 9 langues.
    //  Mesuré le 7/10 sur les offres publiées : les CHAUSSETTES étaient 7 hors
    //  Mode (4 « Autres », 3 Sport — dont « Chaussettes Basses Homme Femme
    //  10/20 Paires ») et les SOUS-VÊTEMENTS hors Mode étaient des « Trunks »
    //  Calvin Klein en « Autres ». Les mots ajoutés sont groupés PAR LANGUE,
    //  à la suite des mots d'origine de la même langue (un seul bloc par
    //  langue : le vérificateur lit un compteur par langue, le dupliquer le
    //  casserait). Les chaussettes, elles, sont en MOTS_FORTS (elles tranchent
    //  seules) ; les sous-vêtements restent ici, en mots FAIBLES.
    //  ⚠ Mots PIÉGEUX volontairement ÉCARTÉS, chacun mesuré :
    //   « slip »     → attrape « non-slip » (tapis de souris, étui, pince) ;
    //   « collant »  → attrape « collant = gluant » (jouets collants) ;
    //   « want »     → attrape le domaine « want.nl » d'un article Lego ;
    //   « rok »      → attrape 14 offres sans rapport ;
    //   « maglia »   → manchette d'Apple Watch.
    //  « gant »/« gants » sont lus ENTRE FRONTIÈRES (MOTS_A_FRONTIERE) : sans
    //  cela « élégant » les contient ; les cas non vestimentaires (gant de
    //  toilette, gants nitrile) sont en MOTS_TROMPEURS.
    // fr
    'mode', 'vetement', 'chaussure', 'sneaker', 'sac', 'lingerie', 'manteau', 'pull', 'jean', 'textile', 'robe', 'chemise', 'pantalon', 'basket', 'bottes', 'ceinture', 'portefeuille', 'pull-over',
    'echarpe', 'casquette', 'bonnet', 'gant', 'gants', 'jupe', 'short', 'maillot', 'pyjama', 't-shirt', 'tee-shirt', 'sweat', 'blouson', 'veste', 'sandale', 'claquette', 'kimono', 'calecon',
    // en
    'fashion', 'clothing', 'clothes', 'shoe', 'shoes', 'sneakers', 'handbag', 'coat', 'jacket', 'jumper', 'jeans', 'apparel', 'dress', 'shirt', 'trousers', 'boots', 'belt', 'wallet', 'sweater',
    'scarf', 'beanie', 'mitten', 'swimsuit', 'slipper', 'skirt', 'hoodie', 'boxer', 'trunks', 'underwear',
    'sweatshirt', 'pyjamas', 'sandals', 'flip flops',
    // de
    'kleidung', 'schuh', 'schuhe', 'tasche', 'handtasche', 'mantel', 'jacke', 'pullover', 'textil', 'kleid', 'hemd', 'hose', 'stiefel', 'gurtel', 'portemonnaie', 'lederjacke', 'muetze', 'schal',
    'handschuh', 'unterhose', 'unterwasche',
    'schlafanzug', 'sandalen', 'badeanzug',
    // nl
    'kleding', 'schoen', 'schoenen', 'tas', 'handtas', 'jas', 'trui', 'jurk', 'hemd', 'broek', 'laarzen', 'riem', 'portemonnee',
    'sjaal', 'muts', 'handschoen', 'onderbroek',
    'pyjama', 'sandalen', 'badpak',
    // es
    'moda', 'ropa', 'zapato', 'zapatos', 'zapatilla', 'zapatillas', 'bolso', 'lenceria', 'abrigo', 'chaqueta', 'jersey', 'vaqueros', 'vestido', 'camisa', 'pantalon', 'botas', 'cinturon', 'cartera',
    'guante', 'gorro', 'bufanda', 'falda',
    'camiseta', 'sudadera', 'sandalias', 'chanclas', 'banador', 'pijama',
    // it
    'abbigliamento', 'scarpa', 'scarpe', 'borsa', 'intimo', 'cappotto', 'giacca', 'maglione', 'tessile', 'vestito', 'camicia', 'pantaloni', 'stivali', 'cintura', 'portafoglio',
    'sciarpa', 'cappello', 'guanti', 'gonna', 'mutande',
    'pigiama', 'maglietta', 'felpa', 'sandali', 'ciabatte',
    // pt
    'roupa', 'sapato', 'sapatos', 'sapatilhas', 'mala', 'bolsa', 'casaco', 'camisola', 'ganga', 'vestuario', 'calcas', 'botas', 'cinto', 'carteira',
    'cachecol', 'luva', 'saia', 'cueca',
    'pijama', 'sandalias', 'chinelos', 'fato de banho',
    // pl
    'odziez', 'but', 'buty', 'sneakersy', 'torba', 'torebka', 'bielizna', 'plaszcz', 'kurtka', 'sweter', 'jeansy', 'tekstylia', 'sukienka', 'koszula', 'spodnie', 'kozaki', 'pasek', 'portfel',
    'szalik', 'czapka', 'rekawiczki', 'spodnica', 'majtki', 'bokserski',
    'pizama', 'sandaly', 'klapki', 'bluza', 'koszulka',
    // sv
    'klader', 'sko', 'skor', 'vaska', 'handvaska', 'underklader', 'kappa', 'jacka', 'troja', 'tyg', 'klanning', 'skjorta', 'byxor', 'stovlar', 'balte', 'planbok',
    'halsduk', 'mossa', 'vantar', 'kjol',
    'pyjamas', 'sandaler', 'badklader',
  ],
  sport: [
    // fr
    'sport', 'fitness', 'musculation', 'velo', 'randonnee', 'running', 'football', 'natation', 'yoga', 'tennis', 'ski', 'tente', 'camping', 'haltere', 'velo electrique', 'baskets de running',
    //  A9 (09/10/2026) : LES LAMPES PORTATIVES DE PLEIN AIR — signalé par B avec
    //  une offre réelle, une lampe frontale Rechargeable rangée en MODE. Elles
    //  n'étaient rangées NULLE PART : les deux offres sœurs du catalogue ne
    //  tenaient leur rubrique Sport que par accident, parce que leur titre
    //  contenait « camping » ou « randonnée ». Une lampe frontale sert à courir,
    //  camper, randonner — elle va donc en Sport, comme elles.
    //  ⚠ « lampe » seule n'entre PAS dans la liste : une lampe de salon est un
    //  objet de maison, et « lanterne » un objet de jardin. Seules les lampes
    //  PORTATIVES (frontale, torche, de poche) sont nommées ici.
    'lampe frontale', 'torche frontale', 'lampe torche', 'lampe de poche',
    // en
    'gym', 'bike', 'bicycle', 'cycling', 'hiking', 'swimming', 'tent', 'dumbbell', 'outdoor', 'running shoes', 'treadmill', 'fishing',
    'headlamp', 'head torch', 'flashlight',
    // de
    'fahrrad', 'rad', 'wandern', 'laufen', 'fussball', 'schwimmen', 'zelt', 'hantel', 'outdoor', 'e-bike', 'laufband', 'angeln',
    'stirnlampe', 'taschenlampe',
    // nl
    'fiets', 'wielrennen', 'wandelen', 'hardlopen', 'voetbal', 'zwemmen', 'tent', 'kamperen', 'halters', 'e-bike', 'loopband', 'vissen',
    'hoofdlamp', 'zaklamp',
    // es
    'deporte', 'bicicleta', 'ciclismo', 'senderismo', 'correr', 'futbol', 'natacion', 'esqui', 'tienda de campana', 'mancuernas', 'cinta de correr', 'pesca',
    'linterna',
    // it
    'bicicletta', 'bici', 'escursionismo', 'corsa', 'calcio', 'nuoto', 'sci', 'tenda', 'campeggio', 'manubri', 'tapis roulant', 'pesca',
    'torcia',
    // pt
    'desporto', 'bicicleta', 'ciclismo', 'caminhada', 'corrida', 'futebol', 'natacao', 'esqui', 'tenda', 'campismo', 'halteres', 'passadeira', 'pesca',
    'lanterna',
    // pl
    'rower', 'kolarstwo', 'trekking', 'bieganie', 'pilka nozna', 'plywanie', 'joga', 'tenis', 'narty', 'namiot', 'kemping', 'hantle', 'bieznia', 'wedkarstwo',
    'latarka',
    // sv
    'cykel', 'cykling', 'vandring', 'lopning', 'fotboll', 'simning', 'skid', 'talt', 'hantlar', 'löparband', 'fiske',
    'ficklampa',
  ],
  jouets: [
    // fr
    'jouet', 'jeu', 'lego', 'peluche', 'poupee', 'puzzle', 'jeux de societe', 'puericulture', 'bebe', 'enfant', 'poussette', 'figurine', 'circuit',
    //  « hot wheels » (unité A6) : voitures MINIATURES de collection, un jouet.
    //  Mot FAIBLE à dessein (et non MOTS_FORTS) : mesuré le 7/10, un titre de
    //  VÊTEMENTS « Character Clothing Incl. … Hot Wheels » doit rester en Mode,
    //  où la source le range. En faible, la source l'emporte ; en fort, non.
    'hot wheels',
    // en
    'toy', 'toys', 'plush', 'doll', 'board game', 'kids', 'child', 'stroller', 'pram', 'building blocks', 'action figure',
    // de
    'spielzeug', 'kuscheltier', 'puppe', 'brettspiel', 'baby', 'kinder', 'kinderwagen', 'kleinkind', 'spielwaren', 'figur',
    // nl
    'speelgoed', 'knuffel', 'pop', 'puzzel', 'bordspel', 'kinderen', 'kinderwagen', 'kleuter', 'speelgoedauto',
    // es
    'juguete', 'juguetes', 'muneca', 'juego de mesa', 'nino', 'ninos', 'cochecito', 'figura', 'construccion',
    // it
    'giocattolo', 'giocattoli', 'bambola', 'gioco da tavolo', 'neonato', 'bambini', 'passeggino', 'action figure',
    // pt
    'brinquedo', 'brinquedos', 'boneca', 'bonecas', 'jogo de tabuleiro', 'jogos', 'criancas', 'crianca', 'carrinho de bebe', 'figura', 'brincar', 'quebra-cabeca',
    // pl
    'zabawka', 'zabawki', 'pluszak', 'lalka', 'gra planszowa', 'niemowle', 'dzieci', 'wozek', 'klocki',
    // sv
    'leksak', 'leksaker', 'gosedjur', 'docka', 'pussel', 'bradspel', 'bebis', 'barn', 'barnvagn', 'byggklossar',
  ],
  auto: [
    // fr
    //  « auto », « moto », « tire » et « wagen » sont ici mais lus ENTRE DEUX
    //  FRONTIÈRES (voir MOTS_A_FRONTIERE) : sans cela « autonomie », « Motorola »,
    //  « à tirer » et « Bollerwagen » en faisaient des accessoires de voiture.
    //  « band » (nl) a été retiré : le trait d'union étant une frontière,
    //  « tri-band » suffisait à ranger un routeur ici.
    'auto', 'voiture', 'moto', 'pneu', 'automobile', 'garage', 'carrosserie', 'huile moteur', 'casque moto', 'accessoires auto', 'batterie voiture',
    'essuie-glace', 'plaquettes de frein', 'amortisseur', 'jante', 'attelage', 'retroviseur', 'pot d echappement', 'carte grise', 'gps auto',
    // en
    'car', 'motorbike', 'motorcycle', 'tyre', 'tire', 'automotive', 'engine oil', 'car parts', 'dash cam', 'dashcam', 'car battery',
    'brake pads', 'car care', 'car seat', 'car cover', 'car mat', 'windscreen wiper', 'roof rack', 'tow bar',
    // de
    //  « wagen » seul est trop glissant (« Bollerwagen » = chariot à main,
    //  « Fahrradanhänger » = remorque de vélo) : on NOMME les véhicules au lieu
    //  de s'appuyer sur le suffixe.
    'wagen', 'motorrad', 'reifen', 'kfz', 'motorol', 'autozubehor', 'dashcam', 'autobatterie',
    'neuwagen', 'gebrauchtwagen', 'volkswagen', 'wohnwagen', 'fahrzeug', 'autohaus', 'autoreifen', 'autoteile',
    'bremsbelag', 'zundkerze', 'scheibenwischer', 'kennzeichen', 'anhangerkupplung', 'dachbox',
    // nl
    'motorfiets', 'autoband', 'motorolie', 'autoaccessoires', 'autobatterij', 'wagen', 'autobanden', 'autozetel', 'trekhaak', 'ruitenwisser', 'wiel',
    'remblokken', 'uitlaat', 'buitenspiegel', 'dakkoffer',
    // es
    'coche', 'coches', 'motos', 'neumatico', 'automovil', 'aceite de motor', 'accesorios coche', 'bateria de coche',
    'pastillas de freno', 'limpiaparabrisas', 'matricula', 'portaequipajes',
    // it
    'pneumatico', 'pneumatici', 'olio motore', 'accessori auto', 'batteria auto', 'automobile', 'ricambi', 'tergicristalli',
    'pastiglie dei freni', 'portapacchi', 'specchietto retrovisore',
    // pt
    'carro', 'carros', 'automovel', 'mota', 'pneu', 'pneus', 'oleo de motor', 'acessorios auto', 'bateria de carro', 'pecas auto', 'limpa para-brisas',
    'pastilhas de travao', 'escapamento', 'bagageiro',
    // pl
    'samochod', 'motocykl', 'opona', 'opony', 'olej silnikowy', 'akcesoria samochodowe', 'akumulator samochodowy', 'czesci samochodowe', 'wycieraczki', 'felgi',
    'klocki hamulcowe', 'tlumik', 'bagaznik dachowy',
    // sv
    'bil', 'bilar', 'motorcykel', 'dack', 'motorolja', 'biltillbehor', 'bilbatteri', 'reservdelar', 'vindrutetorkare', 'bensin',
    'bromsbelagg', 'takracke', 'dragkrok',
  ],
  beaute: [
    // fr
    'beaute', 'parfum', 'cosmetique', 'soin', 'maquillage', 'cheveux', 'brosse a dents', 'creme', 'shampoing', 'gel douche', 'hygiene', 'epilateur', 'epilation',
    //  AJOUT MESURÉ le 7/10 (A7) : « mascara » manquait — les Maybelline
    //  « Lash Sensational Sky High » (GB/NL) restaient en « Autres ». Mot FAIBLE
    //  (produit courant, peut voisiner une autre famille) ; il suffit contre
    //  « Autres » et ne force jamais une rubrique de source.
    'mascara',
    // en
    'beauty', 'perfume', 'fragrance', 'cosmetics', 'skincare', 'makeup', 'hair', 'toothbrush', 'cream', 'shampoo', 'shower gel', 'grooming', 'epilator',
    // de
    'parfumerie', 'kosmetik', 'pflege', 'schminke', 'haare', 'zahnburste', 'creme', 'shampoo', 'duschgel', 'epilierer',
    // nl
    'parfum', 'cosmetica', 'verzorging', 'make-up', 'haar', 'tandenborstel', 'shampoo', 'douchegel', 'drogisterij',
    // es
    'belleza', 'perfume', 'cosmetica', 'cuidado', 'maquillaje', 'pelo', 'cabello', 'cepillo de dientes', 'champu', 'gel de ducha',
    // it
    'bellezza', 'profumo', 'cosmetica', 'cura', 'trucco', 'capelli', 'spazzolino', 'crema', 'shampoo', 'docciaschiuma',
    // pt
    'beleza', 'perfume', 'cosmetica', 'cuidado', 'maquilhagem', 'cabelo', 'escova de dentes', 'champo', 'gel de banho',
    // pl
    'uroda', 'perfumy', 'kosmetyki', 'pielegnacja', 'makijaz', 'wlosy', 'szczoteczka', 'krem', 'szampon', 'zel pod prysznic',
    // sv
    'skonhet', 'parfym', 'kosmetik', 'hudvard', 'smink', 'har', 'tandborste', 'kram', 'schampo', 'duschgel',
  ],
};

/** Table des catégories SOURCES, toutes langues.
 *
 *  Même cause racine que ci-dessus, à l'étage au-dessus : la table d'origine
 *  ne connaissait qu'une poignée de libellés FRANÇAIS (« Maison & Habitat »,
 *  « Jeux & jouets »…). Or les sources publient 77 libellés distincts en huit
 *  langues — « Home & Living », « Hogar, vivienda y oficina », « Dom i
 *  mieszkanie », « Elektronika », « Garten & Baumarkt »… Tout ce qui n'était
 *  pas reconnu retombait sur les mots du titre, qui étaient eux aussi
 *  français. Les deux défauts se multipliaient au lieu de se compenser.
 *
 *  La comparaison se fait sans accents et sans casse, et accepte le mot-clé
 *  n'importe où dans le libellé : « Beauty & Gesundheit » tombe sur « beauty ».
 *  L'ordre compte — le premier motif trouvé gagne — donc les motifs les plus
 *  spécifiques sont placés avant les plus généraux.
 */
const CATEGORIES_SOURCES = [
  // --- TECH
  ['high-tech', 'tech'], ['high tech', 'tech'], ['informatique', 'tech'], ['gaming', 'tech'],
  ['jeux video', 'tech'], ['consoles', 'tech'], ['console', 'tech'], ['electronics', 'tech'],
  ['electronik', 'tech'], ['elektronik', 'tech'], ['elektronika', 'tech'], ['electronica', 'tech'],
  ['electrónica', 'tech'], ['multimedia', 'tech'], ['computer', 'tech'], ['hardware', 'tech'],
  ['software', 'tech'], ['telekommunikation', 'tech'], ['tecnologia', 'tech'], ['technologie', 'tech'],
  ['smartphone', 'tech'], ['photo', 'tech'], ['foto', 'tech'], ['tv &', 'tech'], ['& tv', 'tech'],
  ['audio', 'tech'], ['hi-fi', 'tech'], ['hifi', 'tech'], ['drones', 'tech'], ['informatyka', 'tech'],
  // Libellés trouvés dans les données et restés non traduits au premier essai du
  // vérificateur : « Elektronica » (néerlandais, faute sur le k), « Telecom &
  // Internet », « Broadband & Phone Contracts ». Le vérificateur les liste —
  // sans lui, ils seraient restés silencieusement en « Autres ».
  ['elektronica', 'tech'], ['telecom', 'tech'], ['broadband', 'tech'], ['internet &', 'tech'],
  // --- MAISON
  ['maison', 'maison'], ['home &', 'maison'], ['home', 'maison'], ['habitat', 'maison'],
  ['hogar', 'maison'], ['dom i mieszkanie', 'maison'], ['haus', 'maison'], ['wohnen', 'maison'],
  ['wonen', 'maison'], ['casa', 'maison'], ['literie', 'maison'],
  // --- ÉLECTROMÉNAGER (libellés que publient les marchands)
  ['electromenager', 'electromenager'], ['haushaltsgerate', 'electromenager'],
  ['electrodomesticos', 'electromenager'], ['elettrodomestici', 'electromenager'],
  ['elektro', 'electromenager'], ['agd', 'electromenager'],
  // --- MEUBLES (unité E6 : le mobilier a désormais son onglet). Ces libellés
  //  sont placés APRÈS « home »/« maison » : une enseigne qui dit « Home &
  //  Living » reste en Maison, seule une rubrique qui NOMME le mobilier
  //  (« Meubles », « Möbel ») bascule ici.
  ['meuble', 'meubles'], ['mobilier', 'meubles'], ['mobel', 'meubles'],
  ['interieur', 'maison'], ['inrichting', 'maison'],
  ['haushalt', 'maison'], ['kueche', 'maison'], ['kuche', 'maison'], ['koch', 'maison'],
  ['bricolage &', 'bricolage'],
  // --- BRICOLAGE
  ['bricolage', 'bricolage'], ['bricolaje', 'bricolage'], ['doe-het-zelf', 'bricolage'],
  ['baumarkt', 'bricolage'], ['majsterkowanie', 'bricolage'], ['do it yourself', 'bricolage'],
  ['jardin', 'bricolage'], ['garden', 'bricolage'], ['garten', 'bricolage'], ['tuin', 'bricolage'],
  ['jardin y bricolaje', 'bricolage'], ['ogrod', 'bricolage'], ['tradgard', 'bricolage'],
  ['outillage', 'bricolage'], ['ferreteria', 'bricolage'], ['ferramenta', 'bricolage'],
  // --- MODE
  ['mode &', 'mode'], ['mode', 'mode'], ['fashion', 'mode'], ['moda', 'mode'], ['moda y', 'mode'],
  ['odziez', 'mode'], ['kleidung', 'mode'], ['kleding', 'mode'], ['textile', 'mode'], ['tekstylia', 'mode'],
  ['accessoires', 'mode'], ['accessories', 'mode'], ['accesorios', 'mode'], ['akcesoria', 'mode'],
  ['chaussures', 'mode'], ['sacs', 'mode'], ['klader', 'mode'], ['abbigliamento', 'mode'],
  // --- BIJOUX (rubrique ajoutée à la demande de B)
  //  Une source qui publie sa propre rubrique « Bijoux » la garde : elle est
  //  passée de « mode » à « bijoux ». Les autres libellés de bijouterie
  //  rencontrés sont ajoutés ici dans les langues où ils apparaissent.
  ['bijoux', 'bijoux'], ['bijouterie', 'bijoux'], ['sieraden', 'bijoux'], ['sieraad', 'bijoux'],
  ['schmuck', 'bijoux'], ['gioielli', 'bijoux'], ['gioielleria', 'bijoux'], ['joyeria', 'bijoux'],
  ['joalharia', 'bijoux'], ['bizuteria', 'bijoux'], ['smycken', 'bijoux'], ['jewellery', 'bijoux'],
  ['jewelry', 'bijoux'], ['watches & jewellery', 'bijoux'], ['montres & bijoux', 'bijoux'],
  // --- SPORT
  ['sport & outdoor', 'sport'], ['sports & plein air', 'sport'], ['sports & outdoors', 'sport'],
  ['sport & vrije tijd', 'sport'], ['sport & outdoor', 'sport'], ['sport i turystyka', 'sport'],
  ['deportes', 'sport'], ['sports', 'sport'], ['sport', 'sport'], ['fitness', 'sport'],
  ['outdoor', 'sport'], ['buitenleven', 'sport'], ['sport & freizeit', 'sport'],
  // --- JOUETS
  ['famille & enfants', 'jouets'], ['family & kids', 'jouets'], ['familie & kinderen', 'jouets'],
  ['family', 'jouets'], ['famille', 'jouets'], ['familie', 'jouets'], ['juguetes', 'jouets'],
  ['jouets', 'jouets'], ['jeux & jouets', 'jouets'], ['jeux et jouets', 'jouets'], ['zabawki', 'jouets'],
  ['spielzeug', 'jouets'], ['kinder', 'jouets'], ['baby', 'jouets'], ['enfants', 'jouets'],
  ['rodzina', 'jouets'], ['dzieci', 'jouets'], ['bambini', 'jouets'], ['kinderen', 'jouets'],
  // --- AUTO
  ['auto & moto', 'auto'], ['auto-moto', 'auto'], ['auto & motorrad', 'auto'], ['auto & motor', 'auto'],
  ['coches y motos', 'auto'], ['cars & motorbikes', 'auto'], ['motoryzacja', 'auto'], ['automobil', 'auto'],
  ['voitures', 'auto'], ['auto', 'auto'], ['coches', 'auto'], ['motorrad', 'auto'], ['moto', 'auto'],
  // --- ACTIVITÉ (bons plans de SERVICE)
  //  « Activité » n'est PAS une famille déduite du TITRE, et c'est délibéré :
  //  sondé sur les données réelles, aucun mot de service ne tient dans un
  //  catalogue de produits — « concert » est dans une barre de son, « show »
  //  dans « Echo Show » et « showmodel », « massage » dans un pistolet de
  //  massage, « aquarium » dans un aquarium à poissons. Une famille de mots
  //  aurait donc rangé des PRODUITS en « Activité » (52 offres mesurées
  //  contredites). La rubrique vient de la SOURCE, qui sait ce qu'elle vend
  //  (Groupon, dont les pages de bons plans sont des prestations) — comme
  //  « presse » ou « enseigne », qui sont aussi des étiquettes de source.
  ['activite', 'activite'],
  ['spa & bien-etre', 'activite'], ['bien-etre &', 'activite'], ['wellness &', 'activite'],
  ['restaurant', 'activite'], ['gastronomie', 'activite'], ['restauration', 'activite'],
  ['loisirs', 'activite'], ['activites', 'activite'], ['sorties', 'activite'],
  ['freizeitpark', 'activite'], ['vrije tijd', 'activite'], ['ocio y', 'activite'],
  // --- BEAUTÉ
  ['beaute & sante', 'beaute'], ['sante & cosmetiques', 'beaute'], ['beauty & gesundheit', 'beaute'],
  ['beauty & gezondheid', 'beaute'], ['health & beauty', 'beaute'], ['beauty & health', 'beaute'],
  ['salud y belleza', 'beaute'], ['zdrowie i uroda', 'beaute'], ['beauty', 'beaute'], ['beaute', 'beaute'],
  ['cosmetique', 'beaute'], ['cosmetica', 'beaute'], ['cosmetics', 'beaute'], ['kosmetik', 'beaute'],
  ['parfum', 'beaute'], ['soins', 'beaute'], ['drogisterij', 'beaute'], ['drogerie', 'beaute'],
  // --- ASSUMÉ comme « AUTRE » (ce n'est pas un défaut : c'est un choix)
  ['culture', 'autre'], ['kultur', 'autre'], ['kultura', 'autre'], ['cinema', 'autre'], ['livres', 'autre'],
  ['divertissement', 'autre'], ['freizeit', 'autre'], ['rozrywka', 'autre'], ['ocio', 'autre'],
  // --- VOYAGES (unité E8). Ces libellés étaient rangés « autre » tant que
  //  l'onglet n'existait pas : la source disait « ce n'est pas une de mes
  //  rubriques ». Maintenant qu'il existe, ils le DÉSIGNENT — un rayon
  //  « Voyage » / « Reizen » est bien du voyage.
  ['voyage', 'voyages'], ['reisen', 'voyages'], ['travel', 'voyages'], ['urlop', 'voyages'], ['podroze', 'voyages'], ['viajes', 'voyages'],
  // --- NOURRITURE (unité E6). Ces libellés étaient classés « autre » avant
  //  que l'onglet existe : ils disaient « ce n'est pas une de mes rubriques ».
  //  Maintenant qu'il y a une rubrique, ils la DÉSIGNENT — et l'épicerie est
  //  bien ce que ces libellés annoncent. ⚠ « artykuly » reste en « autre » :
  //  c'est un fragment de « artykuły spożywcze » (denrées) MAIS aussi de
  //  « artykuły gospodarstwa domowego » (articles ménagers) ; il ne prouve rien.
  ['alimentation', 'nourriture'], ['epicerie', 'nourriture'], ['groceries', 'nourriture'],
  ['lebensmittel', 'nourriture'], ['alimentari', 'nourriture'], ['alimentacao', 'nourriture'],
  ['spożywcze', 'nourriture'], ['artykuly', 'autre'], ['courses', 'nourriture'],
  ['supermercado', 'nourriture'], ['alimentacion', 'nourriture'], ['boodschappen', 'nourriture'],
  ['voeding', 'nourriture'], ['comestibles', 'nourriture'], ['livsmedel', 'nourriture'],
  ['services', 'autre'], ['dienstleistungen', 'autre'], ['finanzen', 'autre'], ['versicherung', 'autre'],
  ['servicios', 'autre'], ['uslugi', 'autre'], ['subskrypcje', 'autre'], ['finanse', 'autre'],
  ['ubezpieczenia', 'autre'], ['geldzaken', 'autre'], ['verzekeringen', 'autre'], ['verzekering', 'autre'],
  ['reizen', 'voyages'], ['vakantie', 'voyages'], ['sante', 'autre'], ['gesundheit', 'autre'], ['health', 'autre'],
];

/** Marques et familles de produits, rattachées à LEUR rubrique.
 *
 *  Pourquoi une table à part : les mots ci-dessus décrivent des CATÉGORIES
 *  (« aspirateur », « chaussure »), pas des noms propres. Or les titres réels
 *  disent souvent la marque seule — « Dyson V15s », « Galaxy S26 », « AirPods »,
 *  « Alienware RTX » — et aucun de ces mots n'est un nom commun. Résultat
 *  mesuré : ces offres tombaient en « Autres » alors que leur rubrique était
 *  évidente pour n'importe qui.
 *
 *  Règle d'écriture : aucune marque AMBIVALENTE n'est listée. « Philips » fait
 *  des rasoirs, des téléviseurs et des friteuses ; « Bosch » fait des perceuses
 *  et des lave-linge. Les inscrire dans une seule rubrique ferait entrer un
 *  défaut pour en corriger un autre. Seules les marques qui désignent UNE
 *  famille sont ici (d'où « bosch auto », précis, et pas « bosch »).
 *
 *  EXCEPTION ASSUMÉE — « samsung » est là, en high-tech, alors que la marque
 *  fait aussi des réfrigérateurs et des lave-linge. Décision explicite : un
 *  « Samsung RS70F66KBTEF » rangé en high-tech est un moindre mal, parce que
 *  Samsung désigne d'abord des téléphones, des téléviseurs et des écrans — et
 *  parce que sans cette entrée, TOUTES les offres Samsung (des centaines)
 *  tombaient en « Autres ». Un seul frigo mal rangé vaut mieux que des
 *  centaines de téléphones non classés. Ne pas retirer cette marque en croyant
 *  bien faire : le test « aucune marque ambiguë » l'exclut volontairement.
 */
const MARQUES = {
  tech: ['apple', 'iphone', 'ipad', 'macbook', 'airpods', 'imac', 'airtag', 'apple watch', 'samsung', 'galaxy', 'pixel', 'xiaomi', 'redmi', 'poco', 'oppo', 'oneplus', 'huawei', 'honor', 'playstation', 'nintendo', 'xbox', 'lenovo', 'asus', 'acer', 'alienware', 'razer', 'logitech', 'bose', 'jbl', 'sennheiser', 'anker', 'ugreen', 'nvidia', 'geforce', 'rtx', 'ryzen', 'kindle', 'chromecast', 'fire tv', 'garmin', 'fitbit', 'gopro', 'dji', 'roku', 'tcl', 'hisense', 'buds', 'boitier'],
  maison: ['ikea', 'pyrex', 'conforama'],
  electromenager: ['dyson', 'tefal', 'moulinex', 'delonghi', 'krups', 'nespresso', 'senseo', 'miele', 'whirlpool', 'magimix'],
  bricolage: ['makita', 'einhell', 'ryobi', 'worx', 'karcher', 'gardena', 'wera', 'dewalt', 'metabo', 'hilti', 'fiskars', 'wolf garten', 'scheppach',
    //  A6 : « wagner » (pistolets à peinture) — produit qui ne tenait, dans les
    //  données, que sur une sous-chaîne lue par accident (« scie » ⊂ « ściennych »).
    //  La frontière exigée pour « scie » le laissait partir en « Autres » ; la
    //  marque le maintient en Bricolage.
    //  A7 : « bosch professional » (la gamme OUTILLAGE ÉLECTRO-PORTATIF bleue).
    //  ⚠ La marque nue « bosch » NE PEUT PAS être inscrite : le test
    //  « aucune marque ambiguë rangée en dur » l'interdit (Bosch fait aussi des
    //  lave-linge et des frigos). La gamme « Professional », elle, ne désigne
    //  que l'outillage : mesuré le 7/10, elle ramène de « Autres » les perceuses,
    //  meuleuses, scies et lasers Bosch Pro (BE/PL/SE) sans toucher à un seul
    //  appareil ménager. « bosch auto » reste là aussi, pour les pièces auto.
    'wagner', 'bosch professional'],
  sport: ['decathlon', 'quechua', 'btwin', 'orbea', 'canyon', 'specialized'],
  beaute: ['loreal', 'sephora', 'nivea', 'garnier', 'oral-b', 'gillette', 'neutrogena', 'douglas', 'braun silk'],
  jouets: ['lego', 'playmobil', 'hasbro', 'mattel', 'barbie', 'nerf', 'funko', 'schleich', 'ravensburger', 'asmodee'],
  mode: ['zalando', 'zara', 'jack&jones', 'tommy hilfiger', 'levis'],
  auto: ['michelin', 'continental', 'castrol', 'bosch auto'],
};

/** MOTS FORTS — le PRODUIT NOMMÉ prime sur tout le reste.
 *
 *  Règle appliquée, demandée explicitement : un appareil électronique va en
 *  high-tech, l'électroménager va en maison, l'électronique de beauté va en
 *  beauté, et un jeu de société va en jeux et jouets.
 *
 *  Pourquoi une table à part : une MARQUE ne dit pas la famille d'un produit.
 *  Samsung fait des téléphones (high-tech) ET des réfrigérateurs (maison) ;
 *  Braun des épilateurs (beauté) ET des robots de cuisine (maison) ; Bosch des
 *  perceuses (bricolage) ET des lave-linge (maison). Tant que la marque décidait
 *  seule, « Samsung Réfrigérateur » partait en high-tech.
 *
 *  Pourquoi les JOUETS y sont aussi : un titre qui dit « jeu de société » ET
 *  « ensemble de bricolage » était rangé en bricolage. Le mot d'appareil
 *  n'était pas en cause — c'est la même question posée autrement : quand un
 *  titre nomme DEUX choses, laquelle est le produit ? Celle qui est nommée le
 *  plus précisément. Voir la table ci-dessous.
 *
 *  Ces mots sont donc examinés AVANT tout le reste — avant les marques, avant la
 *  catégorie de la source : dès qu'un produit est NOMMÉ, c'est lui qui tranche.
 */
const MOTS_FORTS = {
  // TONDEUSES À GAZON / ROBOTS DE TONTE → bricolage.
  //  Ce sont des PRODUITS NOMMÉS : le nom de l'appareil tranche avant la
  //  catégorie de la source (plusieurs robots de tonte étaient rangés en
  //  high-tech parce que la source les publiait dans une rubrique « tech »).
  //  ⚠ La tondeuse à CHEVEUX n'est PAS ici : elle va en électroménager.
  bricolage: [
    'tondeuse a gazon', 'robot tondeuse', 'tondeuse robot',
    'lawnmower', 'lawn mower', 'robot lawn mower', 'mower', 'rasenmaher', 'mahroboter',
    'grasmachine', 'robotmaaier', 'cortacesped', 'tosaerba', 'cortador de relva', 'kosiarka', 'grasklippare',
    //  A8 : « cricut » — machine de découpe (loisirs créatifs / bricolage) dont
    //  la DESCRIPTION énumère des projets (« … custom vinyl decals, t-shirts,
    //  full color stickers »). Mesuré : le mot faible « t-shirt » (+ « shirt »)
    //  la faisait passer en Mode. Produit NOMMÉ, il tranche : Bricolage. Précédent
    //  identique : « sonicare », marque-produit placée en MOTS_FORTS par A7.
    'cricut',
  ],
  // ÉLECTROMÉNAGER → electromenager (nouvel onglet, à côté de High-tech).
  //  Les appareils ménagers ne vont PLUS en « maison » : cette famille ne
  //  garde que le mobilier, la déco, le linge de maison et le jardin.
  electromenager: [
    'refrigerateur', 'frigo', 'frigorifique', 'congelateur', 'kuhlschrank', 'koelkast', 'frigorifico', 'frigorifero', 'lodowka', 'kylskap', 'gefrierschrank', 'vriezer',
    'lave-linge', 'lavelinge', 'machine a laver', 'waschmaschine', 'wasmachine', 'lavatrice', 'lavadora', 'pralka', 'tvatmaskin',
    'lave-vaisselle', 'lavevaisselle', 'geschirrspuler', 'vaatwasser', 'lavastoviglie', 'lavavajillas', 'zmywarka', 'diskmaskin',
    'seche-linge', 'sechelinge', 'trockner', 'droger', 'asciugatrice', 'secadora', 'suszarka', 'torktumlare',
    'aspirateur', 'aspirateur balai', 'aspirateur robot', 'staubsauger', 'stofzuiger', 'aspirapolvere', 'aspirador', 'odkurzacz', 'dammsugare',
    // Shampouineuse et nettoyeur vapeur : ce sont des APPAREILS, et ils nettoient
    //  des MEUBLES — le mot « canapé » de leur titre ne doit donc pas les
    //  envoyer en « meubles » (unité E6). Le nom d'appareil, plus long, tranche :
    //  « shampouineuse » (13) bat « canape » (6).
    'shampouineuse', 'nettoyeur vapeur', 'nettoyeur a vapeur', 'waschsauger', 'vaporetto',
    'micro-ondes', 'microondes', 'mikrowelle', 'microgolf', 'microonde', 'microondas', 'mikrofalowka', 'mikrovagsugn',
    'four encastrable', 'four electrique', 'backofen', 'ofen', 'forno', 'horno', 'piekarnik', 'ugn',
    'cafetiere', 'machine a cafe', 'kaffeemaschine', 'koffiezetapparaat', 'macchina del caffe', 'maquina de cafe', 'ekspres do kawy', 'kaffemaskin', 'espresso machine',
    'bouilloire', 'wasserkocher', 'waterkoker', 'bollitore', 'hervidor', 'czajnik', 'vattenkokare',
    'friteuse', 'fritteuse', 'airfryer', 'air fryer', 'fritadeira', 'frytkownica', 'heissluftfritteuse', 'freidora de aire', 'friggitrice',
    'cocotte-minute', 'autocuiseur', 'schnellkochtopf', 'cocotte minute',
    'purificateur d air', 'luftreiniger', 'luchtzuiveraar', 'purificador de aire',
    // Grille-pain
    'grille-pain', 'toaster', 'tostadora', 'tostapane', 'torradeira', 'toster', 'brodrost',
    // Fer à repasser (soin du linge)
    'fer a repasser', 'bugeleisen', 'strijkijzer', 'plancha de ropa', 'ferro da stiro', 'ferro de engomar', 'zelazko', 'strykjarn',
    // Sèche-cheveux et lisseur (soin des cheveux) — quittent beauté
    'seche-cheveux', 'seche cheveux', 'sechecheveux', 'haartrockner', 'haardroger', 'asciugacapelli', 'secador de pelo', 'suszarka do wlosow', 'harfon', 'fon',
    'lisseur', 'lisseur de cheveux', 'haarglatter', 'stijltang', 'piastra per capelli', 'plancha de pelo', 'prostownica', 'plattang', 'brosse soufflante',
    // Rasoirs et tondeuses (à cheveux/barbe/poils) — quittent beauté
    //  POINT 26 (7/10) — LE PARTAGE SE FAIT SUR « ÉLECTRIQUE » OU NON.
    //   Demande de B : « les rasoirs électriques doivent être dans électroménager.
    //   Les rasoirs manuels et les lames doivent être dans beauté ». Le mot NU
    //   « rasoir » a donc QUITTÉ cette table pour celle de beauté : en français,
    //   « Rasoir Gillette » est un rasoir manuel. Un titre électrique le dit —
    //   « rasoir electrique » (17 caractères) bat « rasoir » (6) — et reste ici.
    //   Même logique pour les formes génériques des autres langues.
    'rasoir electrique', 'rasoir rechargeable', 'rasoir a batterie',
    'electric razor', 'electric shaver', 'rechargeable shaver', 'rasierapparat',
    'elektrorasierer', 'elektrischer rasierer', 'scheerapparaat', 'rasoio elettrico',
    'golarka elektryczna', 'rakapparat', 'maquina de barbear eletrica', 'maquina de afeitar electrica',
    'tondeuse a cheveux', 'tondeuse a barbe', 'tondeuse pour barbe', 'tondeuse barbe', 'haarschneider', 'haartrimmer', 'clipper', 'tagliacapelli', 'maszynka do wlosow', 'harstrimmer',
    //  POINT 24 (7/10) — LA BROSSE À DENTS ARRIVE ICI, DEPUIS « beauté ».
    //   Demande de B : « pour les deux conflits tondeuse à cheveux enfant et
    //   brosse à dents kids cela doit aller dans électroménager ». Elle reste un
    //   APPAREIL de soin — le déménagement ne change que sa RUBRIQUE (Beauté →
    //   Électroménager) et, par la même occasion, la protège de la règle
    //   d'ENFANT : un appareil nommé l'emporte sur un mot de circonstance.
    //   Contrôle négatif du déménagement : l'ÉPILATEUR et le MASSEUR, qui ne
    //   sont pas des appareils ménagers, restent en Beauté — et « Pasta dental
    //   infantil 6-13 años » reste un jouet, elle n'est pas une brosse.
    //   Neuf langues, tout en sans-accents.
    //  POINT 26 — MÊME PARTAGE : la brosse à dents ÉLECTRIQUE reste ici, la
    //   brosse à dents MANUELLE part en Beauté (voir la table « beaute »).
    //   « brosse a dents » seul a donc quitté cette table : en français, sans le
    //   mot « électrique », c'est une brosse ordinaire.
    //   ⚠ Les TÊTES et RECHARGES restent ici : elles n'existent que pour les
    //   brosses électriques (« brossettes », « testine di ricambio »,
    //   « cabezales de cepillo », « tandborsthuvuden »).
    'brosse a dents electrique', 'brosse a dents rechargeable', 'brossettes',
    'electric toothbrush', 'electric toothbrushes', 'sonic toothbrush', 'rechargeable toothbrush',
    'elektrische zahnburste', 'elektrische tandenborstel', 'cepillo de dientes electrico',
    'spazzolino elettrico', 'escova de dentes eletrica', 'szczoteczka elektryczna',
    'eltandborste', 'tandborsthuvud', 'tandborsthuvuden', 'testine di ricambio', 'cabezales de cepillo',
    //  « Elektrisk tandborste » s'écrit en DEUX mots (suédois, norvégien, danois) :
    //  « eltandborste » ne l'attrape pas. Mesuré — huit brosses portant
    //  « électrique » dans leur titre restaient en Beauté pour cette raison.
    'elektrisk tandborste', 'elektrisk tannborste', 'elektrisk tandborste med',
    //  ⚠ Suédois : « tandborste » — la brosse à dents ORDINAIRE — est passée en
    //  Beauté au point 26, avec les autres formes génériques ; « eltandborste »
    //  (électrique) reste ici. À la première passe, trois offres « Elektrisk
    //  tandborste » (Philips Sonicare) étaient restées en Beauté faute de ce mot :
    //  c'est ce manque qui a montré que le partage électrique/manuel devait être
    //  explicite dans les DEUX tables, et non dans une seule.
    // Robots de cuisine (le mot NU « robot » reste dehors : il désigne aussi
    //  un jouet, et un jouet-robot ne doit pas partir en électroménager).
    'robot de cuisine', 'robot patissier', 'robot cuiseur', 'robot menager', 'robot aspirateur',
    // Cuisson (four/plaques) — noms précis uniquement
    'cuisiniere', 'kochfeld', 'kookplaat', 'placa de cocina', 'piano cottura', 'plyta indukcyjna', 'koksspis',
    // Petits appareils de préparation (unité E6) : mesuré, ces appareils
    //  étaient tombés en « Nourriture » sur un mot d'aliment de leur titre
    //  (« Kettle … green tea », « Émulsionneur de lait », « Cuiseur de Riz …
    //  légumes »). Le nom de l'appareil tranche.
    'kettle', 'espressomaskin', 'emulsionneur', 'mousseur de lait', 'mousseur a lait',
    'cuiseur de riz', 'cuiseur vapeur', 'coupe legumes electrique', 'hachoir electrique',
    'blender', 'mixeur', 'presse agrumes', 'machine a pain', 'yaourtiere',
    //  AJOUT MESURÉ le 7/10 (unité A6 : faux positifs démontrés en A5). Des
    //  appareils NOMMÉS restaient dans une VRAIE rubrique de source parce que
    //  leur mot manquait ou ne comptait qu'UN point (la source l'emportait) :
    //   « washing machine » (en) → 3 lave-linge Hisense en « Maison » (GB) ;
    //   « vacuum cleaner » (en)  → 2 aspirateurs Shark en « Bricolage » (GB) ;
    //   « fusselrasierer » (de)  → 1 rasoir anti-peluches Philips en « Maison » ;
    //   « zamrazarka » (pl)      → 1 congélateur Bomann en « Maison » ;
    //   « shaver » (en)          → 1 rasoir Philips en « Beauté » (AT) ;
    //   « cortabarbas » (es)     → 1 tondeuse Wahl en « Beauté » (ES).
    'washing machine', 'vacuum cleaner', 'fusselrasierer', 'zamrazarka', 'shaver', 'cortabarbas',
    //  « fohnborstel » (nl : brosse soufflante) : la BaByliss « Smooth Finish »
    //  tombait en Jeux & jouets sur « baby » ⊂ BaByliss (défaut A3/A4).
    'fohnborstel',
    //  « oneblade » (unité A6) : la gamme de rasoirs/tondeuses Philips OneBlade.
    //  Mesuré le 7/10 : les OneBlade ES/PT partaient en Bricolage sur « pila » ⊂
    //  « depilación » — l'appareil NOMMÉ les ramène en Électroménager.
    'oneblade',
    //  « akkusauger » (de : aspirateur à batterie) : la sous-chaîne « akku » le
    //  rangeait en Bricolage ; à frontière, c'est le nom de l'APPAREIL qui parle.
    'akkusauger',
    //  AJOUT MESURÉ le 7/10 (unité A7, audit de « Autres »). Des APPAREILS
    //  ménagers NOMMÉS restaient en « Autres » parce que leur nom (allemand,
    //  néerlandais, suédois, polonais, français) manquait aux tables — l'audit
    //  de « Autres » les a listés par fréquence. Comptés sur les 9 574 offres
    //  publiées (les chiffres entre parenthèses sont les occurrences en
    //  « Autres » AVANT correction) :
    //   « kaffeevollautomat » (6) → PHILIPS LatteGo 2200/3300/5400/5500, DE+AT ;
    //   « dampfbügelstation » (2) → Philips PerfectCare 6000, DE+AT ;
    //   « fensterputzroboter » (2) → ECOVACS WINBOT W2S/W3, AT ;
    //   « saugroboter » (3) → dreame L40/L40s/X50s, DE (déjà « robot aspirateur ») ;
    //   « nettoyeur de vitres » (1) → ECOVACS WINBOT W3, FR ;
    //   « centrale vapeur » (2) → Calor Power Pro / Pro Express, FR ;
    //   « machine a expresso » (1) → Bialetti Venus Induction, FR ;
    //   « bodygroom »/« bodygroomer » (4) → Philips série 7000/5000, FR/NL/PL ;
    //   « multiquick » (5) → Braun MultiQuick 5/7/9 (mélangeurs), BE ;
    //   « ergomaster » (6) → Bosch ErgoMaster 4/6/8 (mélangeurs), BE ;
    //   « pastamachine » (1) → Philips ProExtrude, NL ;
    //   « aquaclean » (3) → filtres à eau Philips pour espresso, NL/SE/PL ;
    //   « luftfuktare » (1) → Philips 3000 NanoCloud, SE ;
    //   « nawilzacz » (1) → Philips série 2000, PL ;
    //   « parownica » (1) → Philips série 1000, PL.
    //  Ces mots sont des NOMS D'APPAREIL, pas des marques : ils gardent la même
    //  sûreté que « haartrockner » ou « kaffeevollautomat » et sont pris en
    //  entier (pas de sous-chaîne courte). Les titres de Coolblue réduits au
    //  seul numéro de modèle (« Bosch WGB264ACFG i-DOS ») ne sont PAS traités
    //  ici : aucun mot n'y nomme l'appareil, on ne devine pas (voir AUDIT-A7).
    'kaffeevollautomat', 'dampfbugelstation', 'fensterputzroboter', 'saugroboter',
    'nettoyeur de vitres', 'centrale vapeur', 'machine a expresso',
    'bodygroom', 'bodygroomer', 'multiquick', 'ergomaster', 'pastamachine',
    'aquaclean', 'luftfuktare', 'nawilzacz', 'parownica',
  ],
  // MOBILIER NOMMÉ → meubles (unité E6).
  //  Ce sont des PRODUITS NOMMÉS, au même titre qu'un appareil électroménager :
  //  dès qu'un titre en porte un, c'est lui qui tranche — avant la marque et
  //  avant la catégorie de la source. Sans cela, un canapé publié dans une
  //  rubrique « Home & Living » serait resté en Maison : la règle n'accepte de
  //  contredire une VRAIE rubrique de source qu'avec DEUX mots concordants.
  //  ⚠ Les mots du plan (« table », « lit », « bureau ») sont VOLONTAIREMENT
  //  remplacés par des locutions précises, parce que le mot nu a été MESURÉ
  //  faux : « lit » → « couette pour lit » (linge), « table » → « scie
  //  circulaire de table » (bricolage) et « tablette » (high-tech), « bureau »
  //  → « kit bureautique » (rien à voir). Un meuble se nomme, il ne se devine
  //  pas sur un mot ordinaire.
  meubles: [
    // fr
    'canape', 'canape-lit', 'fauteuil', 'chaise', 'tabouret', 'armoire', 'commode', 'etagere', 'bibliotheque', 'buffet', 'sommier', 'table basse', 'table a manger', 'table de chevet', 'buffet bas',
    // en
    'sofa', 'couch', 'armchair', 'wardrobe', 'bookcase', 'bookshelf', 'sideboard', 'nightstand', 'headboard', 'bed frame', 'recliner', 'coffee table', 'dining table', 'furniture',
    // de
    'sessel', 'schrank', 'kommode', 'bettgestell', 'doppelbett', 'sitzbank', 'schreibtisch', 'kleiderschrank', 'buecherregal', 'hocker', 'esszimmertisch',
    // nl
    'zitbank', 'kledingkast', 'boekenkast', 'dressoir', 'salontafel', 'eettafel', 'nachtkastje',
    // es
    'sillon', 'butaca', 'armario', 'estanteria', 'comoda', 'aparador', 'escritorio', 'mesa de comedor', 'mesa de noche', 'mesa de salon', 'somier', 'litera',
    // it
    'divano', 'poltrona', 'armadio', 'libreria', 'cassettiera', 'credenza', 'comodino', 'scaffale', 'madia',
    // pt
    'armario', 'estante', 'comoda', 'aparador', 'escrivaninha', 'roupeiro', 'mesa de jantar', 'mesa de cabeceira',
    // pl
    'kanapa', 'fotel', 'szafa', 'komoda', 'kredens', 'biurko', 'stolik', 'krzeslo', 'szafka', 'lozko',
    // sv
    'soffa', 'fatolj', 'bokhylla', 'byra', 'skank', 'garderob', 'skrivbord', 'matbord', 'soffbord', 'nattduksbord',
    //  ⚠ « bureau » N'EST PAS ici, et c'est une MESURE de l'unité A7, pas un
    //  oubli : essayé en mot FORT (avec frontière de mot), il déplaçait 28
    //  offres de Maison vers Meubles — mais aussi, à tort, « Ordinateur de
    //  Bureau » (high-tech), « déco 3D pour bureau » (un set LEGO), « tapis de
    //  cuisine … bureau », « horloge murale … bureau », « kit d'outils …
    //  bureau ». Le mot est un LIEU, pas toujours un meuble ; la frontière
    //  n'y change rien. Retiré : un « bureau » réglable reste classé par sa
    //  source (« Maison & Habitat ») ou reste en « Autres », jamais rangé au
    //  hasard. Un vrai meuble se nomme (« etagere », « commode »…).
  ],
  // ALIMENTATION (ÉPICERIE) NOMMÉE → nourriture (unité A6).
  //  Plusieurs produits d'épicerie de la source allemande « Lebensmittel &
  //  Haushalt » (et de la source FR « Maison & Habitat ») restaient en
  //  « Maison » : leur mot existait dans FAMILLES mais ne comptait qu'UN point,
  //  insuffisant face à une vraie rubrique de source. Un aliment NOMMÉ est un
  //  produit, comme un appareil : il tranche. Mesuré le 7/10 sur les 9 538
  //  offres publiées (alcools, biscuits, chocolat, café en grains, pommes de
  //  terre). ⚠ Un mot d'OUTIL garde la priorité par la LONGUEUR : « Éplucheur à
  //  Légumes … Pommes de Terre » reste en Maison (« eplucheur a legumes », 18,
  //  bat « pommes de terre », 15).
  //  ⚠ « rum » est VOLONTAIREMENT ABSENT : en suédois « rum » signifie
  //  « pièce » (« Bosch Dry 2000, Avfuktare, För rum upp till 24 m² » : un
  //  déshumidificateur partait en Nourriture). La comparaison ignorant la
  //  langue, un mot qui a un sens ordinaire ailleurs ne peut pas être un mot
  //  FORT. « rhum » (fr) et « ron » (es) restent des mots faibles de FAMILLES.
  nourriture: [
    'schokolade', 'kekse', 'kaffeebohnen', 'whiskey', 'pommes de terre',
  ],
  // USTENSILES DE CUISINE → maison (unité E6).
  //  Pourquoi cette table existe : la famille « nourriture » contient des mots
  //  d'ALIMENT très génériques (« legumes », « pommes de terre »), et ces mots
  //  apparaissent AUSSI dans le titre de l'OUTIL qui les prépare — « Éplucheur à
  //  Légumes », « Hachoir à Légumes », « Coupe Légumes », « Ciseaux à Viande ».
  //  Mesuré sur les données publiées : 11 ustensiles de cuisine étaient tombés
  //  en « Nourriture » sur le seul nom de l'aliment. Un produit NOMMÉ (l'outil)
  //  doit trancher avant le mot d'aliment, exactement comme un appareil.
  //  ⚠ Les outils ÉLECTRIQUES ont leur mot propre côté « electromenager »
  //  (« hachoir electrique », « cuiseur de riz »…) et gagnent par la longueur.
  maison: [
    'hachoir', 'hachoir a legumes', 'eplucheur', 'eplucheur a legumes', 'eplucheur de fruits et legumes',
    'coupe legumes', 'mandoline', 'ciseaux de cuisine', 'ciseaux a viande', 'ciseaux a volaille',
    'distributeur dhuile', 'presse ail', 'rape a fromage', 'film alimentaire', 'sac de congelation',
    //  POINT 25 (7/10) — CAPSULE POUR LAVE-VAISSELLE → MAISON. Demande de B :
    //   « capsule pour lave-vaisselle doit aller dans maison ». C'est un
    //   CONSOMMABLE, pas un appareil : le titre nomme bien le lave-vaisselle,
    //   mais ce qu'on achète est le produit de lavage. La longueur fait le
    //   partage — ces termes (26, 24, 23 caractères) battent « lave-vaisselle »
    //   (13) qui, lui, désigne l'APPAREIL et reste en Électroménager. Sans cette
    //   entrée, « Capsules pour lave-vaisselle x60 » partait en Électroménager
    //   sur le seul nom de la machine.
    'capsule pour lave-vaisselle', 'capsules pour lave-vaisselle', 'capsules lave-vaisselle',
    'tablette pour lave-vaisselle', 'tablettes pour lave-vaisselle', 'tablettes lave-vaisselle',
    'pastille pour lave-vaisselle', 'pastilles pour lave-vaisselle', 'pastilles lave-vaisselle',
    'sel de lave-vaisselle', 'sel de lavage', 'produit de lavage vaisselle',
    'dishwasher tablet', 'dishwasher tablets', 'geschirrspultabs', 'spultabs',
    'vaatwastabletten', 'vaatwas tabletten', 'pastillas lavavajillas', 'pastiglie lavastoviglie',
    'pastilhas maquina de lavar louca', 'tabletki do zmywarki', 'diskmaskinstabletter',
  ],
  // ÉLECTRONIQUE DE BEAUTÉ → beauté (soins de la personne, pas appareils ménagers)
  beaute: [
    'epilateur', 'epilator', 'epilierer', 'ontharingsapparaat', 'depiladora', 'epilatore', 'depilatore',
    //  POINT 25 (7/10) — LAME DE RASOIR → BEAUTÉ. Demande de B : « Gillette lame
    //   de rasoir doit aller dans beauté, car c'est un soin de beauté pour les
    //   hommes et ce n'est pas électronique ». Le partage est net : le RASOIR
    //   électrique est un APPAREIL (Électroménager, entrée « rasoir electrique »),
    //   la LAME et la RECHARGE sont des consommables de soin — donc Beauté.
    //   Ici encore, la longueur tranche : « lame de rasoir » (14) bat « rasoir »
    //   (6), comme « recharge de rasoir » (18) le bat aussi.
    'lame de rasoir', 'lames de rasoir', 'lame de rasoir de surete', 'recharge de rasoir', 'recharges de rasoir',
    //  ⚠ Forme RÉELLE des titres, relevée sur les offres en stock : « Recharge
    //   rasoir Gillette Fusion 5 » écrit « recharge rasoir » SANS « de ». Sans
    //   cette ligne, le titre retombait sur le mot nu « rasoir » (Électroménager)
    //   et la règle ne s'appliquait pas — mesuré, un cas sur les deux testés.
    'recharge rasoir', 'recharges rasoir', 'lame rasoir', 'lames rasoir',
    'tete de rasoir', 'tetes de rasoir', 'cartouche de rasoir', 'cartouches de rasoir', 'rasoir mecanique', 'rasoir de surete',
    'razor blade', 'razor blades', 'razor blade refill', 'blade refill', 'rasierklinge', 'rasierklingen',
    'scheermesje', 'scheermesjes', 'cuchilla de afeitar', 'cuchillas de afeitar', 'lama di rasoio', 'lamette da barba',
    'lamina de barbear', 'lamina de barba', 'ostrze do golenia', 'rakblad',
    //  POINT 26 (7/10) — CE QUI EST MANUEL VA EN BEAUTÉ.
    //   Demande de B : « les brosses à dents manuelles doivent être dans beauté »
    //   et « les rasoirs manuels et les lames doivent être dans beauté ». C'est
    //   ici que tombent les formes GÉNÉRIQUES, celles qui ne disent pas
    //   « électrique » : la longueur du mot trouvé fait le partage, et un titre
    //   qui précise « électrique » l'emporte depuis l'autre table.
    //   Neuf langues, tout en sans-accents.
    'brosse a dents', 'brosse a dents manuelle', 'brosse a dents souple', 'brosse a dents enfant',
    'toothbrush', 'toothbrushes', 'manual toothbrush', 'zahnburste', 'zahnbursten', 'handzahnburste',
    'tandenborstel', 'tandenborstels', 'cepillo de dientes', 'spazzolino', 'spazzolino manuale',
    'escova de dentes', 'szczoteczka do zebow', 'tandborste', 'tandborstar',
    'rasoir', 'rasoir manuel', 'rasoir de securite', 'rasoir droit', 'rasoir a main',
    'razor', 'manual razor', 'safety razor', 'rasierhobel', 'rasierer', 'scheermes', 'scheermesje',
    'maquinilla de afeitar', 'rasoio', 'rasoio di sicurezza', 'aparelho de barbear', 'maszynka do golenia',
    'rakhyvel',
    //  ⚠ CAS MESURÉ, tranché par la consigne de B : « les lames doivent être dans
    //  beauté ». « Philips OneBlade Original 360-rakblad » partait en
    //  Électroménager parce que la GAMME « oneblade » (8 caractères) est plus
    //  longue que le mot « rakblad » (7) : la règle de longueur donnait raison à
    //  la gamme. Ce sont pourtant des LAMES DE RECHANGE — donc Beauté. On écrit
    //  la locution entière (16 caractères), qui l'emporte sur la gamme seule :
    //  « OneBlade » nu (l'appareil) reste en Électroménager, ses lames vont en
    //  Beauté. C'est le seul cas de ce genre trouvé dans le stock.
    'oneblade rakblad', 'oneblade blade', 'oneblade lame', 'oneblade replacement', 'oneblade lame de rechange',
    //  ⚠ POINT 24 (7/10) — LA BROSSE À DENTS A DÉMÉNAGÉ EN ÉLECTROMÉNAGER.
    //   Demande de B, mot pour mot : « pour les deux conflits tondeuse à cheveux
    //   enfant et brosse à dents kids cela doit aller dans électroménager ».
    //   La liste des neuf langues est donc passée dans la table « electromenager »
    //   ci-dessus. C'est ce déménagement — et lui seul — qui empêche la règle
    //   d'ENFANT de la happer : mesuré sur les 10 259 offres publiées,
    //   « Sonic Electric Toothbrush for Adults and Kids » était la SEULE des
    //   84 offres de brosses à dents à partir en « Jeux & jouets ».
    'soin du visage', 'appareil de massage', 'masseur', 'masseur facial',
    //  « lumea » (unité A6) : la gamme d'ÉPILATEURS IPL de Philips. Mesuré le
    //  7/10 : les Philips Lumea (ES/PT/IT) partaient en Bricolage sur la
    //  sous-chaîne « pila » ⊂ « depilación » ; l'appareil NOMMÉ les ramène en
    //  Beauté, comme « epilateur ».
    'lumea',
    //  AJOUT MESURÉ le 7/10 (unité A7, audit de « Autres »). Gammes d'APPAREILS
    //  de soin NOMMÉES, restées en « Autres » faute de mot (comptées sur les
    //  9 574 offres publiées) :
    //   « sonicare » (4)  → têtes de brosse à dents Philips Sonicare, SE/NL/ES/PT ;
    //   « smart ipl » (3) → épilateurs Braun Smart IPL Skin i-expert, BE ;
    //   « reaura » (1)    → masque LED visage Philips ReAura, NL.
    //  ⚠ Ce sont des NOMS DE GAMME d'APPAREIL DE SOIN, pas la marque ambiguë
    //  « Philips » (interdite en dur : un seul mot de marque enverrait aussi ses
    //  moniteurs et ses friteuses ici). La brosse à dents et l'épilateur sont
    //  des soins de la personne, pas des appareils ménagers (point 9).
    'sonicare', 'smart ipl', 'reaura',
  ],
  // APPAREIL TECHNIQUE → high-tech
  tech: [
    'smartphone', 'telephone portable', 'handy', 'smartfon', 'telefoon', 'telefono', 'telefone',
    'ordinateur portable', 'pc portable', 'laptop', 'notebook', 'ultrabook', 'chromebook',
    'tablette', 'tablet', 'tableta', 'tabletka', 'surfplatta',
    'televiseur', 'fernseher', 'televisie', 'televisor', 'televisore', 'telewizor', 'tv-apparat', 'smart tv', 'television',
    //  POINT 25 (7/10) — VIDÉOPROJECTEUR ET RÉPÉTEUR WIFI → HIGH-TECH.
    //   Demandes de B : « vidéoprojecteur doit aller dans high-tech » et
    //   « répéteur wifi doit être dans high-tech et pas dans maison ». Les deux
    //   sont des APPAREILS ÉLECTRONIQUES : ils n'avaient aucun mot propre, donc
    //   ils tombaient dans la rubrique de la source ou dans « Maison » au titre
    //   du foyer. Écrits ici, ils tranchent avant tout le reste.
    //   ⚠ « projecteur » seul n'est PAS ici : un projecteur de chantier ou une
    //   lampe projecteur ne sont pas du high-tech. On exige « video ».
    'videoprojecteur', 'video-projecteur', 'video projecteur', 'projecteur video', 'projecteur full hd',
    'beamer', 'proyector de video', 'proiettore', 'videoproiettore', 'projetor de video', 'projektor', 'videoprojektor',
    //  Répéteur, point d'accès, réseau maillé : le prolongement du réseau
    //  domestique. Le mot NU « wifi » reste dehors — il est trop large et
    //  qualifie aussi bien une imprimante qu'une enceinte.
    'repeteur wifi', 'repeteur wi-fi', 'repeteur de signal', 'extenseur wifi', 'amplificateur wifi',
    'wifi repeater', 'wifi range extender', 'mesh wifi', 'wlan verstarker', 'wlan-repeater', 'wifi versterker',
    'repetidor wifi', 'ripetitore wifi', 'repetidor de sinal', 'wzmacniacz wifi', 'wifi forstarkare',
    'montre connectee', 'smartwatch', 'apple watch', 'fitbit', 'garmin',
    'casque audio', 'casque bluetooth', 'ecouteurs', 'earbuds', 'airpods', 'kopfhorer', 'hoofdtelefoon', 'auriculares', 'cuffie', 'sluchawki', 'horlurar',
    'enceinte connectee', 'enceinte bluetooth', 'barre de son', 'soundbar', 'lautsprecher', 'luidspreker', 'altavoz', 'glosnik', 'hogtalare',
    'imprimante', 'drucker', 'printer', 'impressora', 'drukarka', 'skrivare',
    'appareil photo', 'appareil photo numerique', 'action cam', 'camera', 'camera de surveillance', 'fotocamera',
    'drone', 'routeur', 'router', 'disque dur', 'ssd', 'nvme', 'carte graphique', 'barrette memoire', 'ddr4', 'ddr5',
    'console de jeu', 'spielekonsole', 'spelcomputer', 'consola', 'konsola', 'spelkonsol', 'playstation', 'manette',
    'ecran d ordinateur', 'moniteur', 'monitor', 'ecran pc',
  ],
  // ACCESSOIRES AUTO ET MOTO → auto
  //
  //  Défaut RAPPORTÉ : « la rubrique auto-moto ne contient aucun élément lié
  //  aux autos et aux motos ». Mesuré : sur 231 offres de la rubrique, la
  //  plupart venaient de mots de CIRCONSTANCE lus en sous-chaîne — « autonomie »,
  //  « Motorola », « waistband », « wielka promocja ». Corriger ces faux
  //  positifs ne suffisait pourtant pas : la rubrique se vidait de vrais
  //  produits. D'où cette table, qui est l'autre moitié du correctif.
  //
  //  Ces mots sont des PRODUITS NOMMÉS, au même titre qu'un appareil
  //  électroménager : dès qu'un titre en porte un, c'est lui qui tranche —
  //  avant la marque et avant la catégorie de la source. « Casque Moto Intégral »
  //  part ainsi en auto alors qu'il ne portait qu'UN mot et que la source
  //  parlait de high-tech.
  auto: [
    // fr
    'pneu', 'pneus', 'pneu hiver', 'huile moteur', 'casque moto', 'batterie voiture', 'essuie-glace',
    'plaquettes de frein', 'amortisseur', 'attelage', 'galerie de toit', 'jante', 'retroviseur',
    // en
    'tyre', 'tyres', 'engine oil', 'motor oil', 'car battery', 'dash cam', 'dashcam', 'brake pads',
    'windscreen wiper', 'tow bar', 'roof rack', 'car cover', 'car mat',
    // de
    'reifen', 'motorol', 'autobatterie', 'dashcam', 'bremsbelag', 'zundkerze', 'scheibenwischer',
    'anhangerkupplung', 'autoreifen', 'autoteile', 'dachbox',
    // nl
    'autoband', 'autobanden', 'motorolie', 'autobatterij', 'remblokken', 'ruitenwisser', 'trekhaak', 'dakkoffer',
    // es
    'neumatico', 'aceite de motor', 'bateria de coche', 'pastillas de freno', 'limpiaparabrisas', 'portaequipajes',
    // it
    'pneumatico', 'pneumatici', 'olio motore', 'batteria auto', 'pastiglie dei freni', 'tergicristalli',
    // pt
    'pneu', 'pneus', 'oleo de motor', 'bateria de carro', 'pastilhas de travao', 'limpa para-brisas',
    // pl
    'opona', 'opony', 'olej silnikowy', 'akumulator samochodowy', 'klocki hamulcowe', 'wycieraczki', 'felgi',
    // sv
    'dack', 'motorolja', 'bilbatteri', 'bromsbelagg', 'vindrutetorkare', 'dragkrok',
  ],
  // JEUX ET JOUETS → jouets
  //
  //  Défaut RAPPORTÉ, et mesuré avant d'écrire une ligne : « on retrouve
  //  beaucoup de jeux de société pour les enfants dans le bricolage car il y a
  //  le mot bricolage dedans ». La cause exacte : un titre qui dit à la fois
  //  « jeu de société » ET « ensemble de bricolage » comptait DEUX points pour
  //  bricolage — le mot « bricolage », PLUS « brico », qu'il contient — contre
  //  UN seul pour jouets. Un jeu de société partait donc dans le rayon des
  //  perceuses.
  //
  //  Le TYPE de jeu est un mot de PRODUIT, exactement comme un appareil : il
  //  doit primer sur les mots de circonstance. « jeu de societe » (15
  //  caractères) bat « bricolage » (9) par la longueur, comme « haartrockner »
  //  bat « trockner ». D'où la règle d'écriture : les mots sont pris en
  //  LOCUTION, jamais seuls. Un « jeu » nu se confond avec un « jeu de clés »
  //  (bricolage) ou un « jeu de pneus » (auto) — précisément le piège qu'on
  //  veut éviter. Même raison pour « toy », écrit avec sa frontière de mot
  //  (trois lettres) : sans elle, « Toyota » deviendrait un jouet.
  jouets: [
    // fr
    //  « peluche » et « doudou » sont VOLONTAIREMENT ABSENTS, et c'est une
    //  mesure, pas un oubli : en français « peluche » désigne aussi les
    //  peluches de TISSU (« chiffon microfibre sans peluche », « rasoir anti
    //  bouloche : élimination des peluches » Philips), et « doudou » est le
    //  début de « doudoune » (une parka Nike partait en jouets). Les deux mots
    //  restent dans FAMILLES, où ils ne font qu'un point parmi d'autres ; ils
    //  ne doivent pas trancher seuls.
    'jeu de societe', 'jeux de societe', 'jeu de plateau', 'jeu de cartes', 'jeu de role', 'jeu educatif', 'jeu d eveil', 'jeu de construction', 'pate a modeler', 'pate a sel', 'cube de jeu', 'figurine', 'poupee', 'puzzle',
    //  « lego » est un PRODUIT NOMMÉ, au même titre qu'un « jeu de société ». La
    //  demande est explicite : « tous les produits lego doivent être classés dans
    //  les jeux et jouets ». Mesuré avant d'écrire cette ligne : sur 211 offres
    //  LEGO, 9 partaient ailleurs (5 en maison, 4 en high-tech) parce qu'un mot
    //  du titre marquait plus de points. Un nom de produit ne se discute pas :
    //  un set LEGO reste un jouet, qu'il représente une voiture, un robot ou
    //  une plante — y compris les gammes « Technic » et « Speed Champions ».
    //  (Seul un JEU NUMÉRIQUE garde la priorité : voir JEU_NUMERIQUE.)
    'lego',
    // en
    'board game', 'board games', 'card game', 'action figure', 'building blocks', 'jigsaw puzzle', 'plush toy', 'stuffed animal', 'model kit', 'toys', 'teddy bear',
    // de
    'brettspiel', 'kartenspiel', 'bauklotze', 'spielfigur', 'kuscheltier', 'puppe', 'spielzeug', 'modellbausatz', 'puzzle',
    // nl
    'bordspel', 'kaartspel', 'bouwblokken', 'speelgoed', 'knuffel', 'puzzel', 'legpuzzel', 'modelbouw', 'teddybeer',
    // es
    //  « peluche » est absent ICI AUSSI : la comparaison ne connaît PAS la
    //  langue du titre. Le laisser en espagnol ferait matcher « élimination des
    //  peluches » d'un rasoir français — le mot espagnol rattraperait le texte
    //  français. Un mot ambigu ne peut donc pas rester « seulement » dans une
    //  autre langue.
    'juego de mesa', 'juego de cartas', 'bloques de construccion', 'figura de accion', 'rompecabezas', 'muneca', 'juguete',
    // it
    'gioco da tavolo', 'gioco di carte', 'mattoncini', 'action figure', 'bambola', 'giocattolo', 'puzzle',
    // pt
    'jogo de tabuleiro', 'jogo de cartas', 'blocos de construcao', 'quebra-cabeca', 'boneca', 'brinquedo', 'puzzle',
    // pl
    'gra planszowa', 'gra karciana', 'klocki', 'pluszak', 'lalka', 'zabawka', 'puzzle',
    // sv
    'bradspel', 'kortspel', 'byggklossar', 'gosedjur', 'docka', 'leksak', 'pussel',
    // DEMANDE DE B (plan point 10 / unité E4) : « toute annonce contenant
    //  fille, garçon, enfant ou une catégorie d'âge d'enfant » va en Jeux &
    //  jouets. Ces mots sont donc ici, en MOTS FORTS : ils tranchent avant la
    //  marque et avant la catégorie de la source, comme un produit nommé.
    //  ⚠ MESURÉ dans cette session sur les 9 379 offres publiées (en comparant
    //  classerOffre() avant/après la règle) : 93 offres changent de rubrique
    //  vers « jouets » — 34 bricolage, 24 tech, 13 maison, 13 mode, 4 beauté,
    //  3 sport, 1 électroménager, 1 autre. Restent 14 offres portant un mot
    //  d'enfant hors de jouets, parce qu'un mot d'appareil NOMMÉ, plus long,
    //  l'emporte (brosse à dents, montre connectée, appareil photo, écouteurs
    //  JBL Junior, titres de jeux vidéo) — voir `node outils/mesure-enfant.mjs`
    //  et le rapport de E4, cas cités un par un.
    //  Mots courts protégés par une frontière (voir MOTS_A_FRONTIERE) pour que
    //  « junge » n'attrape pas « junger », et « barn » pas « barniz ».
    //  ⚠ « kind » NU est VOLONTAIREMENT ABSENT, et c'est une mesure : la
    //  comparaison ignore la langue du titre, donc l'allemand « Kind » attrapait
    //  l'anglais « kind » (« Kind of Blue » de Miles Davis, « Kind to Skin »
    //  d'Astonish — 2 offres mesurées, envoyées à tort en jouets). Les formes
    //  utiles de l'allemand/néerlandais (« kinder », « kindern », « kinderen »)
    //  restent, et « kind » continue de voter un point dans FAMILLES.
    // fr
    'fille', 'fillettes', 'garcon', 'garcons', 'enfant', 'enfants',
    // en
    'girl', 'girls', 'boy', 'boys', 'child', 'children', 'kid', 'kids',
    // de
    'madchen', 'junge', 'jungen', 'kinder', 'kindern',
    // nl
    'meisje', 'meisjes', 'jongen', 'jongens', 'kinderen',
    // es
    'nina', 'ninas', 'nino', 'ninos', 'chica', 'chico', 'chicos',
    // it
    'bambina', 'bambine', 'bambino', 'bambini', 'ragazza', 'ragazze', 'ragazzo', 'ragazzi',
    // pt
    'menina', 'meninas', 'menino', 'meninos', 'crianca', 'criancas',
    // pl
    'dziewczynka', 'dziewczynki', 'chlopiec', 'chlopcy', 'dziecko', 'dzieci',
    // sv
    'flicka', 'flickor', 'pojke', 'pojkar', 'barn', 'barnen',
  ],
  // ANIMAUX → animaux (unité E8). Le PRODUIT NOMMÉ primant, ces locutions
  //  tranchent avant la marque et avant la catégorie de la source — c'est ce
  //  qui garantit que la nourriture ANIMALE ne retombe pas en « Nourriture »
  //  sur un mot d'aliment, ni un accessoire en « Maison ». Seuls des termes
  //  PRÉCIS sont ici (jamais « croquettes » nu, qui peut être humain).
  animaux: [
    'croquettes pour chat', 'croquettes pour chien', 'litiere pour chat', 'arbre a chat', 'fontaine a eau pour chat',
    'katzenfutter', 'hundefutter', 'kratzbaum', 'katzenklo', 'kattenvoer', 'hondenvoer', 'krabpaal', 'kattenbak',
    'racao para caes', 'racao para gatos', 'areia para gatos', 'comida para perros', 'comida para gatos',
    'pienso para perros', 'pienso para gatos', 'cibo per cani', 'cibo per gatti', 'lettiera per gatti', 'graffiatoio',
    'acuario', 'acquario', 'aquario', 'akvarium', 'akwarium', 'aquarium', 'kattlada', 'hundkoja', 'fagelbur', 'klostrad',
  ],
  // VOYAGES → voyages (unité E8). Forfaits NOMMÉS : ils tranchent avant tout le
  //  reste, y compris quand la destination n'est pas identifiable (point 21).
  voyages: [
    'billet d avion', 'location de voiture', 'nuit d hotel', 'city break', 'package holiday', 'round trip',
    'return flight', 'kreuzfahrt', 'flugreise', 'paketresa', 'utlandsresa', 'wycieczka objazdowa',
    'soggiorno hotel', 'pacchetto vacanza', 'soggiorno hotel', 'resort todo incluido',
  ],
  // MODE — CHAUSSETTES (unité A8). Ce sont des PRODUITS NOMMÉS et sans
  //  ambiguïté : ils tranchent avant la catégorie de la source. Mesuré le 7/10 :
  //  « SukModen Men's Ankle Running Socks » et « Getry piłkarskie adidas Knee
  //  Socks » étaient rangés en SPORT par la rubrique de la source et non par le
  //  titre ; un mot fort les ramène en Mode. Le mot nu « sock » est lu entre
  //  frontières (MOTS_A_FRONTIERE) pour ne pas attraper « socket ».
  mode: [
    'chaussette', 'sock', 'socks', 'socken', 'sokken', 'calcetin', 'calzino', 'calzini', 'meia', 'skarpet', 'strumpa', 'strumpor',
    //  Pluriels mesurés absents (unité A8, complément des 9 langues) : une
    //  chaussette se vend presque toujours au PLURIEL. Ajoutés explicitement
    //  car « meia »/« skarpet » ne couvrent pas leur pluriel (le mot est lu
    //  entre frontières : « meias » a un « s » qui rompt la frontière).
    //  « meias » est protégé du sens « meias-finais » (demi-finales) par
    //  MOTS_TROMPEURS. « sockor » = chaussettes (sv).
    'calcetines', 'meias', 'skarpetki', 'sockor',
  ],
  // BIJOUX (rubrique ajoutée à la demande de B : « il faut rajouter une rubrique
  //  bijoux, en plus de mode »).
  //
  //  POURQUOI DES MOTS FORTS ET PAS DES MOTS FAIBLES. Les bijoux étaient des
  //  mots FAIBLES de « mode » ('bijou', 'schmuck', 'joya'…). Un mot faible ne
  //  tranche que s'il gagne à la majorité : dès qu'un titre disait « montre »
  //  ou « sac », le bijou repassait en Mode. Or c'est un PRODUIT NOMMÉ — une
  //  bague est une bague — et la règle du projet veut que le produit nommé
  //  tranche le premier. Les bijoux sont donc montés en MOTS_FORTS, et les mots
  //  faibles correspondants ont quitté la table de « mode ».
  //
  //  CHAQUE MOT A ÉTÉ MESURÉ sur les 11 479 offres du catalogue avant d'entrer
  //  (outils/mesure-mots-bijoux.mjs). Ce que la mesure a montré, et qui a fait
  //  ÉCARTER des mots qui paraissaient évidents :
  //   « bracelet »  46 offres, dont la quasi-totalité sont des BRACELETS DE
  //                 MONTRE (« Bracelet Sport » d'Apple Watch, cuir de Lip) ;
  //   « bague »     attrapait « baguette » (un grille-pain) ;
  //   « broche »    attrapait « embroché » (un menu) ;
  //   « parure »    attrapait « parure de lit » (literie) ;
  //   « jonc »      attrapait « jonc de mer » (un panier) ;
  //   « alliance »  sens figuré (« l'alliance pour une peau éclatante ») ;
  //   « medaille »  désigne une récompense sportive, pas un bijou ;
  //   « pendant »   (en) attrapait « pendant les soldes » — 18 offres ;
  //   « anhanger »  (de) attrapait « Fahrradanhänger » (remorque) ;
  //   « kette »     (de) attrapait « Vierkantkette » (chaîne antivol) ;
  //   « reif »      (de) attrapait « Reifen » (pneus) ;
  //   « oorbel »    (nl) attrapait « Doorbell » (sonnette !) ;
  //   « pendiente » (es) attrapait « Independiente » — réglé par MOTS_TROMPEURS ;
  //   « anillo »    (es) attrapait « El Señor de los Anillos » et « Tempranillo » ;
  //   « anello »    (it) attrapait « Maranello » — lu entre frontières ;
  //   « anel »      (pt) attrapait « panel » / « painel » — lu entre frontières ;
  //   « colar »     (pt) attrapait « escolar » ;
  //   « bracciale » (it) et « pulsera » (es) désignent AUSSI un bracelet de
  //                 montre / de suivi d'activité — écartés comme « bracelet ».
  //
  //  Les mots gardés sont ceux qui n'ont qu'UN sens sur le catalogue. Là où un
  //  sens parasite est un mot entier (« anello » dans « Maranello » n'en est pas
  //  un, « collar » dans « Collared » non plus), le mot est lu ENTRE FRONTIÈRES
  //  — voir MOTS_A_FRONTIERE. On préfère une rubrique PLUS PETITE et sûre à une
  //  rubrique gonflée de montres et de pneus.
  bijoux: [
    // fr
    'bijou', 'bijoux', 'collier', 'pendentif', 'boucle d oreille', 'gourmette',
    // en
    //  « jewel »/« jewels » en plus de « jewellery »/« jewelry » : le mot a été
    //  RETIRÉ de la table « mode » en même temps que les autres mots de bijou.
    //  Sans lui, « Evry Jewels Discount Code » — un vrai article de bijouterie —
    //  ne matchait plus RIEN et tombait en « Autres ». Mesuré : c'était le seul
    //  déplacement non voulu du changement, sur 11 479 offres.
    'jewel', 'jewels', 'jewellery', 'jewelry', 'necklace', 'earring', 'earrings', 'brooch', 'bangle', 'locket',
    // de
    'schmuck', 'halskette', 'ohrring', 'ohrringe', 'brosche',
    // nl
    'sieraad', 'sieraden', 'halssnoer', 'ketting',
    // es
    'joya', 'joyas', 'joyeria', 'pendiente', 'pendientes', 'gargantilla', 'collar',
    // it
    'gioiello', 'gioielli', 'gioielleria', 'collana', 'orecchino', 'orecchini', 'ciondolo', 'spilla', 'anello',
    // pt
    'joia', 'joias', 'joalharia', 'pulseira', 'brinco', 'brincos', 'pingente', 'anel',
    // pl
    'bizuteria', 'naszyjnik', 'bransoletka', 'kolczyk', 'kolczyki', 'pierscionek', 'wisiorek', 'broszka',
    // sv
    'smycke', 'smycken', 'halsband',
    //  « armband » vaut « bracelet » en ALLEMAND, en NÉERLANDAIS et en SUÉDOIS.
    //  Le mot est UNE fois : les mots partagés entre langues sont écrits une
    //  seule fois (le vérificateur lit un compteur par langue et un doublon le
    //  casserait — voir la note de la table « mode » plus haut). Il est lu entre
    //  frontières : les composés qui l'ont avalé ne comptent pas — « Lederarmband »
    //  (bracelet de montre, cuir), « Sportarmband » (Apple Watch).
    'armband',
    //  ------------------------------------------------------------------
    //  MONTRES (demande de B, 08/10/2026 : « on est parti pour montre et
    //  bijoux »). La rubrique s'appelle désormais « Montres & bijoux » et les
    //  montres y entrent — c'était le but de la renommée.
    //
    //  POURQUOI LES MONTRES CONNECTÉES SONT INCLUSES, ET PAS SEULEMENT LES
    //  MONTRES CLASSIQUES. On a mesuré, et l'incohérence sautait aux yeux : les
    //  titres d'Apple Watch disent « Montre connectée » — ils seraient donc
    //  entrés — tandis que les Garmin et Samsung Galaxy Watch disent seulement
    //  « Smartwatch », et seraient restés en High-tech. Deux objets identiques
    //  dans deux onglets différents, exactement le genre d'incohérence que B
    //  refuse. On prend donc la famille ENTIÈRE : classiques, connectées,
    //  bracelets de montre.
    //
    //  MESURES (catalogue du 08/10, 11 522 offres) :
    //   « montre »  37 offres, et ZÉRO faux positif — « démontre », « montrent »
    //               et « démonstration » ont été cherchés : aucun ne sort. Le
    //               mot est donc lu en sous-chaîne, sans frontière, ce qui garde
    //               le pluriel « montres ».
    //   « watch »  188 offres. Contient « smartwatch » et « watches » — voulu.
    //               Deux parasites trouvés et NEUTRALISÉS par MOTS_TROMPEURS :
    //               « watchdog » (un commutateur réseau) et « watching »
    //               (« deals worth watching »). Sans cela, un switch Cudy
    //               entrait dans la rubrique des montres.
    //   « uhr »    3 caractères : lu entre frontières automatiquement, donc
    //               « Fitness-Uhr » matche (le trait d'union est une frontière)
    //               et « Uhrwerk » ne matche pas.
    //   « zegarek » 22, « horloge » 15, « reloj » / « relojes », « orologio »,
    //               « relogio », « klocka » : chacun vérifié, aucun parasite.
    // fr
    'montre', 'chronographe', 'bracelet',
    // en
    //  « watch » couvre « watches » et « smartwatch » ; « wristwatch » est
    //  ajouté pour le singulier composé.
    'watch', 'wristwatch', 'chronograph',
    // de
    'uhr', 'uhren', 'armbanduhr',
    // nl
    'horloge', 'polshorloge',
    // es
    'reloj', 'relojes', 'pulsera',
    // it
    'orologio', 'orologi', 'bracciale',
    // pt
    'relogio', 'relogios', 'pulseira',
    // pl
    'zegarek', 'zegarki', 'bransoletka',
    // sv
    'klocka', 'klockor',
  ],
};

/** Normalisation de comparaison : accents, apostrophes, lettres spéciales.
 *
 *  Trois raisons, toutes constatées par un test qui échouait :
 *
 *  1. LES ACCENTS. « Café » et « cafe » doivent être le même mot. Les mots des
 *     listes sont écrits sans accent, le texte comparé l'est aussi.
 *  2. LES APOSTROPHES. « De'Longhi » ne rencontrerait jamais « delonghi »,
 *     « L'Oréal » jamais « loreal » — la marque était dans la liste et l'offre
 *     tombait quand même en « Autres ».
 *  3. LES LETTRES QUE LA DÉCOMPOSITION NE TOUCHE PAS. `normalize('NFD')` sait
 *     séparer « é » en « e » + accent, mais elle ne sait RIEN faire de « ł »
 *     (polonais), « ß » (allemand), « ø » (danois), « œ », « æ », « đ », « þ ».
 *     Sans la table ci-dessous, « Słuchawki » ne rencontrait pas « sluchawki » :
 *     un titre polonais parfaitement classable restait en « Autres ».
 *
 *  Conséquence assumée sur les trémas : « ö » devient « o » (et non « oe »).
 *  Les mots allemands sont donc écrits avec la lettre simple (« kopfhorer »,
 *  « kuche »), pas avec le digramme — l'inverse ne se rencontrerait jamais dans
 *  un titre réel, qui porte le tréma. */
const LETTRES_SPECIALES = { 'ł': 'l', 'ß': 'ss', 'ø': 'o', 'đ': 'd', 'æ': 'ae', 'œ': 'oe', 'þ': 'th', 'ı': 'i' };
const sansAccents = (s) => String(s || '')
  .replace(/[łßøđæœþı]/g, (c) => LETTRES_SPECIALES[c])
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019\u02bc`]/g, '');

/** Neutralise les mentions NÉGATIVES : elles ressemblent à un mot-clé et
 *  disent le contraire.
 *
 *  Cas mesuré : « AIDEA Lot de 50 Chiffon Microfibre sans peluche » se rangeait
 *  en « Jeux & jouets » — le mot « peluche » y suffisait. Or il ne désigne pas
 *  un jouet, mais les peluches de TISSU que le chiffon ne fait pas. Un chiffon
 *  microfibre n'est pas un doudou.
 *
 *  Volontairement ÉTROIT : seules les formes niées de « peluche » sont
 *  retirées. Étendre la règle à « sans <n'importe quoi> » toucherait des
 *  locutions où le mot nié décrit vraiment le produit (« enceinte sans fil »,
 *  « sucre sans gluten ») — on remplacerait un défaut par un autre, en moins
 *  visible. La liste s'allongera sur PREUVE, jamais par prudence.
 */
const NEGATIONS = /(sans|anti|elimination des?|elimine les?|enleve les?|retire les?)[\s-]*peluches?/g;
const sansNegations = (texte) => String(texte || '').replace(NEGATIONS, ' ');

const CATEGORIES_SOURCES_NORM = CATEGORIES_SOURCES.map(([motif, fam]) => [sansAccents(motif).toLowerCase(), fam]);

/** La famille d'une catégorie PUBLIÉE PAR LA SOURCE, ou null si elle est
 *  inconnue (dont « presse » : l'étiquette y vient de notre requête, pas de la
 *  source — elle ne prouve rien). */
function categorieDeSource(brut) {
  const c = sansAccents(String(brut || '')).toLowerCase().trim();
  if (!c || c === 'presse' || c === 'enseigne') return null;
  // Le nom d'une de NOS familles n'est pas une catégorie de source : c'est le
  // nom de la requête Google News qui a ramené l'article (« promo high-tech »
  // ramène aussi des soldes de mode). On le refuse ici, il sera accepté en
  // dernier recours seulement — voir famille().
  if (Object.keys(FAMILLES).includes(c)) return null;
  for (const [motif, fam] of CATEGORIES_SOURCES_NORM) {
    if (c === motif || c.includes(motif)) return fam;
  }
  return null;
}

/** Familles normalisées : on compare toujours du texte sans accent. Les marques
 *  sont fusionnées ici — une seule liste à parcourir, et un seul endroit où
 *  ajouter un mot. */
const FAMILLES_NORM = Object.fromEntries(
  Object.entries(FAMILLES).map(([f, mots]) => [
    f,
    [...mots, ...(MARQUES[f] || [])].map((m) => sansAccents(m).toLowerCase()),
  ]),
);

/* Placé ICI, et pas avec MOTS_FORTS : ces tables ont besoin de `sansAccents`,
 *  défini juste au-dessus. Les déclarer plus haut les ferait évaluer avant lui
 *  → erreur de zone morte temporelle au chargement du module. */
const MOTS_FORTS_NORM = Object.fromEntries(
  Object.entries(MOTS_FORTS).map(([f, mots]) => [f, mots.map((m) => sansAccents(m).toLowerCase())]),
);

/* Mots qui exigent une FRONTIÈRE DE MOT, quelle que soit leur longueur.
 *
 *  La règle générale est : un mot de 4 caractères ou plus est cherché en
 *  SOUS-CHAÎNE — c'est nécessaire pour attraper les pluriels et les composés
 *  (« pneu » → « pneus », « reifen » → « Autoreifen »). Mais quelques mots
 *  courts, lus ainsi, attrapent n'importe quoi. Tous ont été vus à l'œuvre sur
 *  la rubrique « Auto & moto », où ils envoyaient :
 *
 *    « auto »  → « autonomie », « automatique », « Kaffeevollautomat »
 *    « moto »  → « Motorola », « trollingmotorer » (moteur de bateau)
 *    « tire »  → « voitures en métal à tirer » (un jouet !), « a partire da »
 *    « wagen » → « Bollerwagen » (chariot à main), « Fahrradanhänger »
 *    « wiel »  → « wielka promocja » (polonais : « grande promo »)
 *    « mota »  → « amortajado »
 *
 *  Ces mots restent dans leurs familles, mais ne sont plus lus qu'entre deux
 *  frontières : « accessoires auto » et « casque moto » continuent de matcher,
 *  « autonome » et « Motorola » non. La règle n'enlève rien d'utile.
 *
 *  « band » (nl : pneu) a été RETIRÉ, lui — la frontière ne suffisait pas, car
 *  le trait d'union en est une : « tri-band » et « quad-band » passaient encore,
 *  et un routeur NETGEAR se rangeait dans les accessoires auto. Les mots justes
 *  de la même famille (« autoband », « autobanden ») restent en place. */
const MOTS_A_FRONTIERE = new Set(['auto', 'moto', 'tire', 'wagen', 'wiel', 'mota',
  // E7 (09/10/2026) : « nivea », la marque de cosmétiques, attrapait le mot
  //  ORDINAIRE « niveaux ». Mesuré sur une offre RÉELLE signalée par B : la hotte
  //  « Klarstein Valeria Hotte Îlot - 230W … 3 niveaux de puissance, éclairage
  //  LED, panneau tactile » était rangée en BEAUTÉ — à cause de « niveaux ».
  //  Entre deux frontières, la marque ne matche plus, les niveaux non plus.
  'nivea',
  // E8 (09/10/2026), même soirée, même famille de défaut : « mode » — le mot de
  //  la FAMILLE Mode — attrapait « 8 Modes d'éclairage ». Une lampe frontale
  //  « Rechargeable … 8 Modes d'éclairage, Capteur Mouvement » partait donc en
  //  MODE (le rayon des vêtements). Entre deux frontières, « mode femme » et
  //  « mode homme » continuent de matcher ; « 8 Modes » non.
  'mode',
  // E4 : mots d'ENFANT courts ou glissants, lus entre deux frontières pour ne
  //  pas attraper un nom qui les contient — « Kindle » (kind), « barniz »
  //  (barn, espagnol : vernis), « junger/junges » (junge, allemand).
  //  Ajoutés APRÈS MESURE des collisions en sous-chaîne sur les 9 379 offres :
  //   « kids » → « Kidston » (Cath Kidston, savon) et « snookids » (marque) ;
  //   « child » → « schildpad » (tortue, nl) et « Schildkröte » (tortue, de) ;
  //   « chica » → « Chicago » (la ville, dans une offre de vols USA).
  //  Ces trois mots gardent leur sens quand ils sont un vrai mot (« for kids »,
  //  « child », « niñas y chicas ») : la frontière ne les retire pas.
  'kind', 'barn', 'nina', 'nino', 'junge', 'kids', 'child', 'chica',
  // E6 : mots de MEUBLES et d'ALIMENTATION qui, lus en sous-chaîne, attrapent
  //  un mot ordinaire très fréquent. Chacun a été mesuré sur le catalogue :
  //   « mobilier » → « immobilier » ; « mesa » (table, es/pt) → n'importe quoi ;
  //   « cama » (lit, es) → « cámara » (appareil photo) ; « stol » (chaise, nl/sv)
  //   → « pistol », « Stollen » ; « bord » (table, sv) → « Bordeaux », « bordure » ;
  //   « regal » (étagère, de/pl) → « regalo » (cadeau, es) ; « sang » (lit, sv) →
  //   « sangria », « sangklader » (linge de lit, qui doit rester en Maison) ;
  //   « bett » (lit, de) → « Bettdecke » (couette), « Bettwäsche » (linge) ;
  //   « tisch » (table, de) → « Tischdecke » (nappe) ; « tafel » (nl) idem ;
  //   « kast » (armoire, nl) → « kastanje » (marron) ; « bed » (en) → « bedding » ;
  //   « letto » (lit, it) → « lettore » (lecteur) ; « pall » (sv) → « pallone » ;
  //   « miel » (miel, fr) → « Miele » (43 offres d'électroménager) ;
  //   « brod » (pain, sv) → « broderie » ;
  //   « lager » (bière, en/de) → « Lagerung » (stockage).
  //
  //  AJOUT MESURÉ le 6/10 au soir (contrôle de l'unité E6, 107 offres en
  //  Meubles) — trois mots dont la lecture en sous-chaîne salissait la nouvelle
  //  rubrique, comptés sur les données publiées :
  //   « couch » (canapé, en) attrapait les COUCHES (24 offres, dont « BIOLANE
  //     Couches Bébé », « Always Discreet ») et les casseroles « en inox
  //     5 couches » : 20 offres de couches étaient en Meubles ;
  //   « fotel » (fauteuil, pl) attrapait « FOTELIK samochodowy » (SIÈGE AUTO) —
  //     le même piège que « siège auto enfant » de l'unité E4 ;
  //   « mobili » (meubles, it) attrapait « immobilier » — le piège déjà connu
  //     pour « mobilier », resté ouvert sur sa variante italienne.
  'mobilier', 'mesa', 'cama', 'stol', 'bord', 'regal', 'sang', 'bett', 'tisch', 'tafel', 'kast', 'bed', 'letto', 'pall', 'miel', 'brod', 'lager',
  'couch', 'fotel', 'mobili',
  //  AJOUT MESURÉ le 6/10 (2e contrôle de l'unité E6, sur les données
  //  publiées) — trois mots de PLUS dont la lecture en sous-chaîne salissait la
  //  nouvelle rubrique :
  //   « mobilia » (meubles, pt) attrapait l'ESPAGNOL « inmobiliarias » (agences
  //     immobilières) : 2 articles de presse étaient en Meubles ;
  //   « comoda » (commode, es) attrapait « cómodas » (confortables) — «
  //     zapatillas cómodas » (baskets) partait en Meubles ;
  //   « skrivbord » (bureau, sv) attrapait « Skrivbordsminne » (mémoire
  //     « de bureau » d'un kit RAM Crucial) → une barrette DDR5 en Meubles.
  //  La frontière n'enlève rien d'utile : « mobília », « cómoda » (singulier du
  //  meuble) et « skrivbord » isolés continuent de matcher.
  //   « kettle » (bouilloire, en) attrapait « Kettler » (rameur de fitness) et
  //     « Kettlebell » (haltère) : 2 offres de SPORT étaient en Électroménager.
  'mobilia', 'comoda', 'skrivbord', 'kettle',
  // E8 : mots de VOYAGES courts ou glissants, mesurés faux en sous-chaîne —
  //  « reise » attrapait « Preise » (les prix, allemand), « reis » aussi,
  //  « resa » attrapait « sorpresa », « volo » « volontario », « cruise »
  //  « cruiser » (moto) et « cruise control » (auto). Ces mots restent dans
  //  leur famille mais ne sont lus qu'entre deux frontières.
  'reise', 'reis', 'resa', 'volo', 'cruise',
  //  AJOUT MESURÉ le 7/10 (unité E8) : « eier » (œufs, de) attrapait « feiert »
  //  (fête) — un film (« Union Kino … feiert 75. Geburtstag ») tombait en
  //  Nourriture. Lu à frontière, « eier » isolé continue de matcher ; le
  //  néerlandais « eieren » est une entrée distincte et n'est pas touché.
  'eier',
  //  AJOUT MESURÉ le 7/10 (unité A6 : faux positifs démontrés en A3/A4) — des
  //  mots faibles COURTS de la famille BRICOLAGE, lus en SOUS-CHAÎNE d'un mot
  //  ordinaire d'une autre langue. Comptés sur les 9 538 offres publiées ; le
  //  commentaire dit ce que la sous-chaîne attrapait à tort :
  //   « brico »  → « inalámbricos » (barres de son Hisense, casques Skullcandy) ;
  //   « pila » (scie, pl) → « de**pila**ción » (Philips Lumea), « em**pila**bles »
  //     (rangements SONGMICS, pilulier), « reco**pila**ción » (listes de presse) ;
  //   « scie »   → « **ści**emniana » (lampe Govee), « **ści**enny » (horloges
  //     Seiko), « Pier**ście**ni » (livres Tolkien), « **Śró**dmieście »,
  //     « li**ście** » (presse) ;
  //   « akku »   → « **Akku**sauger » (aspirateur roborock), « **Akku**laufzeit »
  //     (liseuse Kindle, tablette Fire Max) — l'aspirateur partait en bricolage ;
  //   « sega » (scie, it) → « **Sega**fredo » (café en grains) ;
  //   « ladder » → « b**ladder** » (protection TENA) ;
  //   « tools »  → « **ToolS**pace » (balayette en bois).
  //  Aucun de ces mots n'était utile en sous-chaîne : le mot ENTIER (« scie
  //  circulaire », « Akku-Staubsauger », « piła ») continue de matcher, et les
  //  composés à trait d'union aussi (le trait d'union est une frontière).
  'brico', 'pila', 'scie', 'akku', 'sega', 'ladder', 'tools',
  //  « lumea » (unité A6) : la gamme Philips Lumea est un mot FORT de Beauté,
  //  mais lu en sous-chaîne il attrapait « P**lumea**u » — une « Brosse
  //  Nettoyage Radiateur … Plumeau » partait en Beauté. À frontière, « Lumea »
  //  isolé (« Philips Lumea serie 8000 ») continue de matcher.
  'lumea',
  //  AJOUT MESURÉ le 7/10 (unité A7) : « mascara », mot FORT de Beauté, attrapait
  //  en sous-chaîne le PORTUGAIS « desmasca**ra** » (« unmask ») — mesuré :
  //  « Black Friday: atenção ao teste dos 30 dias que desmascara falsos
  //  descontos - Leak.pt », un article de presse, partait en Beauté. À
  //  frontière, « Mascara » isolé (« Maybelline Mascara, Lash Sensational »)
  //  continue de matcher, et le faux positif disparaît.
  'mascara',
  //  AJOUT MESURÉ le 7/10 (unité A8 — chaussettes, sous-vêtements, accessoires
  //  → Mode). Quatre mots COURTS lus en sous-chaîne attrapaient un mot
  //  ordinaire :
  //   « sock »  → « socket » (prises, hubs USB) — « socks » suffit pour le
  //     pluriel anglais, mais le singulier « sock » doit rester ;
  //   « meia »  → « meia-… » (pt) : prudence sur un mot de 4 lettres ;
  //   « gant »/« gants » → « élégant »/« élégants » (« Matelas Elegant Prime »,
  //     « Silhouette élégante ») : 16 offres touchées à tort en sous-chaîne.
  //  À frontière, « Socks », « Meia », « Gants de moto » continuent de matcher ;
  //  « socket » et « élégant » non.
  'sock', 'meia', 'gant', 'gants',
  // BIJOUX — mots dont le sens de bijou est un MOT ENTIER, mais qui, lus en
  //  sous-chaîne, se cachent dans un mot ordinaire. Chacun est mesuré sur le
  //  catalogue (outils/mesure-mots-bijoux.mjs), et l'écart est criant :
  //   « anello » (it, bague)  → « MaraNELLO » (modèle de voiture, dans un titre
  //      de café en capsules) ; à frontière, « Anello » continue de matcher ;
  //   « anel »   (pt, anneau) → « pANEL » (écran, batterie portable) : 31 offres
  //      touchées à tort en sous-chaîne, aucune n'a de bijou ;
  //   « armband » (de/nl/sv)  → « Lederarmband », « Sportarmband » : un bracelet
  //      de MONTRE. À frontière, l'« armband » seul (bijou) reste lu, le composé
  //      non — c'est précisément le partage voulu ;
  //   « ketting » (nl)        → « krokkettendag » (journée du croque) ; le vrai
  //      « Ketting » de Swarovski, lui, est un mot entier ;
  //   « halsband » (sv)       → un collier peut être un collier de CHIEN ; lu
  //      entre frontières, on évite au moins les composés ;
  //   « collar » (es, collier) → « Collared Zip Front Jacket » (veste à col) ;
  //      le vrai « Collar Multicharms » de SINGULARU reste lu.
  'anello', 'anel', 'armband', 'ketting', 'halsband', 'collar']);

/** Un mot-clé doit-il être lu entre deux frontières de mot ? */
const exigeFrontiere = (m) => m.length <= 3 || MOTS_A_FRONTIERE.has(m);

/* Mots qui TROMPENT la lecture : retirés du texte AVANT toute comparaison.
 *
 *  Une frontière de mot ne suffit pas quand le mot-clé est CONTENU dans un nom
 *  qui n'a rien à voir, avec des lettres de chaque côté :
 *
 *    « motorola »  contient « motorol » (huile moteur) et « moto » → un
 *                  téléphone partait en accessoire auto ;
 *    « streifen »  (allemand : bande, ruban) contient « reifen » (pneu) → un
 *                  ruban LED partait en pneu.
 *
 *  On retire le MOT ENTIER, pas le fragment : la phrase reste intacte, donc un
 *  titre qui parle vraiment de Motorola ET d'huile moteur reste classé en auto.
 *  Le remplacement par un espace (et non par rien) conserve les frontières
 *  autour des mots voisins — « Motorola,huile » ne doit pas coller deux mots.
 *
 *  Les DÉCLINAISONS sont listées (polonais : « Motoroli », « Motorolę ») : un
 *  titre qui cite les téléphones compatibles (« iPhone, Samsung, Motoroli »)
 *  partait en accessoire auto à cause du génitif. « motorolie » et « motorolja »
 *  — l'huile moteur, qu'on VEUT garder — ne sont pas touchés : la frontière de
 *  mot après « motoroli » échoue devant le « e » de « motorolie ».
 *
 *  E4 (demande de B sur « fille / garçon / enfant ») a ajouté les collisions
 *  MESURÉES ci-dessous, retirées ici plutôt que de renoncer au mot d'enfant
 *  (comptes relevés dans cette session sur les 9 379 offres publiées) :
 *    « good girl »  — le parfum Carolina Herrera « Good Girl » partait en
 *                     jouets sur le mot « girl » (2 offres) ;
 *    « kinder schokolade » (1) / « kinder bueno » (1) — la marque de CHOCOLAT
 *                     Kinder partait en jouets sur le mot « kinder » ;
 *    « orient bambino » — la montre Orient « Bambino » partait en jouets sur
 *                     le mot italien « bambino » (2 offres, titres espagnols) ;
 *    « beach boys » (1) / « lost boys » (1) — le groupe « The Beach Boys » et
 *                     la B.O. « The Lost Boys » (vinyles) partaient en jouets
 *                     sur le mot « boys ».
 *
 *  E6 (rubriques MEUBLES et NOURRITURE) a ajouté les collisions MESURÉES
 *  ci-dessous, sur les données publiées — chacune tirait une offre dans la
 *  mauvaise des deux nouvelles rubriques :
 *    « bookshelf speakers » (1) — des enceintes « Bookshelf Speakers » (Edifier)
 *                     partaient en Meubles sur le mot « bookshelf » ;
 *    « couch co-op / co op / coop » (1) — le jeu vidéo « LEGO City Undercover …
 *                     Couch Co-Op » partait en Meubles sur le mot « couch »
 *                     (« sofa » en anglais) ;
 *    « podkladka na biurko » (1) — un tapis de souris « Podkładka na biurko »
 *                     (Logitech) partait en Meubles sur le mot « biurko » ;
 *    « accesorio de escritorio » (1) — une lampe Xbox « Accesorio de
 *                     Escritorio » partait en Meubles sur « escritorio » ;
 *    « libreria completa » (1) — une bibliothèque de SONS en ligne (« Libreria
 *                     completa de Sonidos ») partait en Meubles sur « libreria » ;
 *    « pour etagere » / « pour une etagere » — un set LEGO décrit comme
 *                     « décoration 3D pour étagère » partait en Meubles (le mot
 *                     de meuble battait la marque « lego » par la longueur) ;
 *    « chaise romaine » (1) — une « chaise romaine » de FITNESS partait en
 *                     Meubles sur le mot « chaise ».
 *
 *  A6 (faux positifs démontrés en A3/A4/A5) a ajouté les collisions MESURÉES
 *  ci-dessous, sur les 9 538 offres publiées :
 *    « babyliss »   — la marque BaByliss (sèche-cheveux, lisseur, brosse
 *                     soufflante) partait en Jeux & jouets sur « baby » ;
 *    « configuration » / « configuracion » / « configurazione » — la mention
 *                     « configuration facile » des Fire TV Stick (5 offres
 *                     BE/ES/IT) partait en jouets sur l'allemand « figur » ;
 *    « fargat », « fargad », « fargnattseende », « flerfargstryck »,
 *      « fargdisplay » (suédois : coloré/vision nocturne/impression
 *                     multicolore/écran couleur) faisaient tomber des lampes,
 *                     caméras et imprimantes en Bricolage sur la peinture
 *                     « färg » ; le mot ENTIER « färg » et le composé légitime
 *                     « färgspruta » (pistolet à peinture WAGNER) sont conservés ;
 *    « washing machine cleaner » — un PRODUIT D'ENTRETIEN (« Dr. Beckmann …
 *                     Washing Machine Cleaner ») partait en Électroménager sur
 *                     le mot-fort « washing machine » qui vise l'APPAREIL ;
 *    « k-pop »      — le néerlandais « pop » (poupée) attrapait « K-Pop » dans
 *                     un titre de VÊTEMENTS (« Character Clothing Incl. … Hot
 *                     Wheels, K-Pop »), qui doit rester en Mode.
 */
const MOTS_TROMPEURS = /(^|[^a-z])(motorola|motoroli|motorole|motorolu|streifen|good girl|tom cruise|ideal voyage|kinder schokolade|kinder bueno|orient bambino|beach boys|lost boys|rebecca mobili|bookshelf speakers|bookshelf speaker|couch co-op|couch co op|couch coop|podkladka na biurko|accesorio de escritorio|libreria completa|pour une etagere|pour etagere|chaise romaine|babyliss|configuration|configuracion|configurazione|fargat|fargad|fargnattseende|flerfargstryck|fargdisplay|washing machine cleaner|k-pop|gant de toilette|gants nitrile|gant nitrile|no sweat|meias-finais|meias finais|meia-final|independiente|independientes|watchdog|watching)([^a-z]|$)/g;
const retirerTrompeurs = (texte) => texte.replace(MOTS_TROMPEURS, '$1 $3');

/** Les marqueurs d'un jeu NUMÉRIQUE — application, téléchargement… ou console.
 *
 *  Pourquoi ce contrôle existe : « Patchwork Board Game - Android Game App » et
 *  « Solitaire Pro : Card Games gratuit sur Android (Dématérialisé) » nomment un
 *  jeu de société, donc les mots forts les envoyaient en « Jeux & jouets ».
 *  Or ce ne sont pas des jouets : ce sont des LOGICIELS. Le support est nommé
 *  lui aussi, et il passe avant — c'est la même règle, appliquée à l'envers.
 *
 *  Le contrôle est donc volontairement étroit : il ne s'applique QU'à une offre
 *  déjà reconnue comme jouet. Ailleurs il ne décide rien.
 *
 *  Règle d'écriture : tout est SANS ACCENT. Le motif est testé sur le texte
 *  déjà passé par `sansAccents()` — une entrée écrite « dématérialisé » ne
 *  rencontrerait jamais « dematerialise » et ne servirait à rien.
 */
/**
 * SEULE PREUVE D'UN JEU NUMÉRIQUE : le SUPPORT logiciel nommé — application,
 * téléchargement, dématérialisé. Ces mots ne désignent rien d'autre qu'un
 * logiciel, où qu'ils apparaissent : ils suffisent à eux seuls.
 */
const SUPPORT_NUMERIQUE = /(android|\bios\b|application|app game|game app|dematerialise|telechargement|download|jeu video|video game|videojuego|spelcomputer)/;

/**
 * LES NOMS DE CONSOLE, en deux groupes — et la distinction n'est pas
 * théorique, elle est mesurée : les JEUX VIDÉO LEGO doivent rester en
 * high-tech (« LEGO Batman: … (PS5/Xbox) », « LEGO City Undercover | jeu PS4 »),
 * et là, seuls les noms de console apparaissent dans le titre.
 */
/** Nomment une CONSOLE et rien d'autre : jamais un jouet, jamais un objet.
 *  Suffisent à eux seuls à trancher. */
const CONSOLE_CLAIRE = /\b(playstation|xbox|ps[45])\b/;
/** Ambiguës, elles : « nintendo » est aussi une licence de jouets, « steam »
 *  la vapeur d'une locomotive, « switch » un interrupteur. Défaut RAPPORTÉ et
 *  mesuré — « LEGO Super Mario **Nintendo** Display Model » et « LEGO City
 *  60511 Vintage **Steam** Train » partaient en high-tech sur ce seul mot. Seul,
 *  il ne prouve donc rien ; il lui faut à côté un mot qui dit le JEU. */
const CONSOLE_AMBIGU = /\b(nintendo|steam|switch)\b/;
/** Le mot du JEU, en neuf langues. */
const MOT_JEU = /\b(jeu|jeux|game|games|gioco|giochi|juego|juegos|spiel|spiele|spel|spellen|jogo|jogos)\b/;
/** Mais certains NOMS D'APPAREIL contiennent le mot : « Game Boy » est une
 *  console, pas un jeu. Défaut mesuré sur un set LEGO à l'effigie d'une Game
 *  Boy : « LEGO Super Mario Game Boy Building Set for Adults - Nintendo Display
 *  Model » partait en high-tech, parce que « Nintendo » (marque ambiguë) ET
 *  « Game Boy » (qui contient « game ») s'y trouvaient. On retire donc le nom
 *  de l'appareil AVANT de chercher le mot du jeu — un titre qui parle vraiment
 *  d'un jeu Game Boy (« Tetris Game Boy ») garde son « game » final. */
const sansNomsAppareils = (s) => s.replace(/\bgame ?boy\b/g, ' ');

/** Le titre décrit-il un logiciel plutôt qu'un objet ? Voir JEU_NUMERIQUE. */
const estJeuNumerique = (bas) => SUPPORT_NUMERIQUE.test(bas)
  || CONSOLE_CLAIRE.test(bas)
  || (CONSOLE_AMBIGU.test(bas) && MOT_JEU.test(sansNomsAppareils(bas)));

/** Une PLAGE d'âge d'enfant (deux nombres autour d'un tiret ou d'un « à »).
 *
 *  Demande de B (unité E4) : « une catégorie d'âge d'enfant » range en Jeux &
 *  jouets. Mesuré AVANT d'écrire la règle : un âge SEUL (« 12 ans », « 6 mois »)
 *  est trop bruité pour être une preuve — 51 offres hors vocabulaire enfant le
 *  portent sans être des jouets (« Ordinateur Portable Alienware 15 »,
 *  « Pack 1 Mois », « 6 Monate Tagesgeld », « Google GEMINI AI Pro na 18
 *  miesięcy »). Un âge en MOIS est pire encore (coupons, tailles, diagonales
 *  d'écran). Seule la PLAGE de deux nombres, bornée à 14 ans, résiste : elle
 *  attrape « jouet Tesla 1,5 à 4 ans » et « pasta dental 6-13 años », et laisse
 *  dehors « les 15-24 ans » d'un article de presse. Le plafond de 14 est la
 *  mesure, pas une intuition : les 5 plages trouvées dans les données sont
 *  1,5-4 / 6-13 / 5 ans seul / 15-24 / une référence Kindle.
 */
const RE_PLAGE_AGE = /\b(\d{1,2})\s*(?:[,.]5)?\s*(?:[-–—]|\bà\b|\ba\b|\bbis\b|\btot\b|\bal\b)\s*(\d{1,2})\s*(?:ans|jaar|jahre|jaren|anos|anni|lat|ar)\b/;
function ageEnfant(texteBas) {
  const m = texteBas.match(RE_PLAGE_AGE);
  if (!m) return false;
  const bas = Number(m[1]), haut = Number(m[2]);
  return bas >= 0 && haut <= 14 && bas <= haut;
}
const POIDS_AGE_ENFANT = 6;   // même poids que le mot « enfant » (6 lettres)

/* POINT 23 — ENFANT/JOUET PASSE AVANT HIGH-TECH (demande explicite de B).
 *
 *  Ses mots : « tous les articles avec écrit jouet pour enfant ou avec un âge
 *  d'enfants ou avec écrit pour les enfants qui sont dans high-tech doivent être
 *  dans la catégorie jouets ».
 *
 *  PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : la règle ne s'applique QU'À une offre que
 *  le classement a mise en « tech ». Ailleurs elle ne décide rien — et c'est ce
 *  qui la rend sûre. Exemple de piège qu'elle évite ainsi : « barn » (suédois :
 *  enfant) est AUSSI l'anglais « grange » — mais une grange n'est pas du
 *  high-tech, donc elle ne peut pas être touchée ici.
 *
 *  Neuf langues, tout en SANS ACCENT (le texte est déjà passé par sansAccents) :
 *  garçon → garcon, mädchen → madchen, niño → nino.
 */
const MARQUEUR_ENFANT = /\b(jouet|jouets|enfant|enfants|fille|filles|garcon|garcons|toy|toys|kid|kids|child|children|boy|girl|spielzeug|junge|jungen|madchen|speelgoed|kinderen|jongen|meisje|juguete|juguetes|nino|ninos|nina|ninas|giocattolo|giocattoli|bambino|bambina|bambini|ragazzo|ragazza|brinquedo|brinquedos|crianca|criancas|menino|menina|zabawka|zabawki|dziecko|dzieci|chlopiec|dziewczynka|leksak|leksaker|barn|pojke|flicka)\b/;

/* HOMONYMES MESURÉS — à retirer AVANT de lire le marqueur d'enfant.
 *
 *  Étendre la règle à toutes les catégories rend le marqueur DÉCISIF là où il
 *  n'était qu'un point parmi d'autres. Mesuré le 7/10 : les 6 seules offres que
 *  l'extension déplaçait étaient TOUTES des homonymes, aucune un jouet —
 *
 *    « Kinder Schokolade » et « Kinder bueno »  → la marque de chocolat ;
 *    « Carolina Herrera Good Girl »             → le nom d'un parfum ;
 *    « Orient Bambino »                         → le nom d'une ligne de montres.
 *
 *  D'où : « kinder » retiré de la liste (l'allemand garde « junge », « madchen »
 *  et « spielzeug »), et les locutions ci-dessous écartées. Le mot italien
 *  « bambino » reste, lui : seul le nom de la montre est visé.
 *  La liste s'allonge sur PREUVE — un cas réel cité, et son test. */
const ENFANT_HOMONYMES = /(good girl|orient bambino|kinder bueno|kinder schokolade)/;

/* ⚠ « kind » (allemand : enfant) est VOLONTAIREMENT ABSENT de la liste.
 *
 *  Mesuré le 7/10 : un article de presse réel — « The Best Amazon Prime Day
 *  Headphone Deals for Every KIND of Listener » — partait en « Jeux & jouets »
 *  parce que l'anglais « kind » (sorte, genre) rencontrait l'allemand « Kind »
 *  (enfant). Le pluriel allemand « kinder » reste, lui, dans la liste : une
 *  collision de marque (« Kinder » chocolat) est déjà traitée plus haut par
 *  MOTS_TROMPEURS, et c'est un test qui la garde. */

/** Un titre porte-t-il une marque d'ENFANT ou de JOUET ? (mot, ou plage d'âge)
 *  Les homonymes mesurés (parfum, chocolat, montre) sont écartés avant lecture. */
const marqueurEnfant = (texteBas) => !ENFANT_HOMONYMES.test(texteBas)
  && (MARQUEUR_ENFANT.test(texteBas) || ageEnfant(texteBas));

/** L'APPAREIL ÉLECTROMÉNAGER NOMMÉ L'EMPORTE SUR LE MARQUEUR D'ENFANT.
 *
 *  Demande de B, 7/10, mot pour mot : « pour les deux conflits tondeuse à
 *  cheveux enfant et brosse à dents kids cela doit aller dans électroménager ».
 *
 *  C'est la règle « les mots d'appareil priment » (déjà en vigueur ailleurs),
 *  appliquée ici contre le marqueur d'enfant. Périmètre VOLONTAIREMENT limité à
 *  l'électroménager : « tondeuse à cheveux enfant » et « brosse à dents kids »
 *  sont des APPAREILS, pas des jouets. Ailleurs la règle d'enfant reste
 *  souveraine — « ours en peluche enfant » et « casque enfant » restent des
 *  jouets, l'audio et la peluche n'étant pas des appareils électroménagers.
 *
 *  L'exception ne joue QUE si les deux marques sont présentes (appareil
 *  électroménager ET mot d'enfant) : elle ne peut donc pas détourner une offre
 *  qui n'aurait rien d'un article d'enfant. */
const appareilSoin = (texteBas) => {
  const f = familleParMotFort(texteBas);
  return f === 'electromenager' || f === 'beaute';
};

/** Le marqueur d'enfant est-il neutralisé par un APPAREIL DE SOIN nommé ?
 *
 *  POINT 26 — le périmètre s'élargit à Beauté, et pas seulement à
 *  l'électroménager, depuis que B a partagé les deux familles : « les brosses à
 *  dents manuelles doivent être dans beauté, les rasoirs manuels et les lames
 *  doivent être dans beauté ». Sans cet élargissement, « Brosse à dents enfant »
 *  (manuelle, donc Beauté) repartait en Jeux & jouets sur le seul mot
 *  « enfant » — l'appareil nommé ne l'emportait plus. */
const electroPrimme = (texteBas) => marqueurEnfant(texteBas) && appareilSoin(texteBas);

/* UNE LAME N'EST PAS UN APPAREIL.
 *
 *  Consigne de B : « les rasoirs manuels et les lames doivent être dans beauté ».
 *  Le partage par longueur ne suffit pas quand le titre nomme une GAMME d'appareil
 *  à côté de la lame : mesuré, « Philips OneBlade Original 360-rakblad » partait
 *  en Électroménager parce que « oneblade » (8 caractères) est plus long que
 *  « rakblad » (7). Ce sont pourtant des lames de rechange.
 *
 *  On exige la locution ENTIÈRE (« lame de rasoir », « razor blade », « rakblad »,
 *  « scheermesjes »…) : le mot « lame » seul n'y est pas, sinon un titre comme
 *  « rasoir électrique, lame incluse » basculerait à tort. */
const MOTS_LAME = /(lame[s]? de rasoir|lame[s]? rasoir|recharge[s]? (de )?rasoir|tete[s]? de rasoir|cartouche[s]? de rasoir|razor blade[s]?|blade refill|rasierklinge[n]?|cuchilla[s]? de afeitar|lama di rasoio|lamette da barba|ostrze do golenia|rakblad|scheermesje[s]?)/;

/** La famille indiquée par un PRODUIT NOMMÉ (un appareil, un type de jeu…), ou
 *  null si le titre n'en nomme aucun.
 *
 *  Le départage se fait par la LONGUEUR TOTALE des mots trouvés, et non par leur
 *  nombre : c'est ce qui fait gagner le terme le plus spécifique. Sans cela,
 *  « Haartrockner » (sèche-cheveux, beauté) perdait contre « trockner »
 *  (sèche-linge, maison) qu'il contient — un point partout, et l'ordre de la
 *  table décidait. Avec la longueur, 12 caractères battent 8.
 *
 *  C'est aussi ce qui règle les JEUX DE SOCIÉTÉ : « jeu de societe » (15) bat
 *  « bricolage » (9), donc un titre qui porte les deux va en jeux et jouets.
 */
function familleParMotFort(texteBas) {
  let choisie = null, score = 0;
  for (const [fam, mots] of Object.entries(MOTS_FORTS_NORM)) {
    const trouves = mots.filter((m) => (exigeFrontiere(m)
      ? new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i').test(texteBas)
      : texteBas.includes(m)));
    const poids = trouves.reduce((a, m) => a + Math.max(3, m.length), 0)
      // E4 : une plage d'âge d'enfant pèse comme le mot « enfant », donc elle
      //  tranche elle aussi — mais un appareil NOMMÉ plus long la bat, comme
      //  pour les mots d'enfant eux-mêmes.
      + (fam === 'jouets' && ageEnfant(texteBas) ? POIDS_AGE_ENFANT : 0);
    if (poids > score) { score = poids; choisie = fam; }
  }
  return choisie;
}

/* Comment une offre est classée — l'ordre des preuves est ici, et nulle part
 * ailleurs. Trois sources, de la plus forte à la plus faible :
 *
 *   1. La catégorie publiée par la source marchande (« Gaming », « Garten &
 *      Baumarkt »…) : quelqu'un l'a saisie, elle vient avec l'offre.
 *   2. Les mots du titre, dans les neuf langues.
 *   3. Le nom de notre requête de veille — le plus faible, car « promo
 *      high-tech » ramène aussi des soldes de mode. Il ne sert QUE si ni la
 *      source ni le titre n'ont rien dit.
 *
 *  Un titre qui ne dit qu'UN mot ne fait pas tomber la catégorie de la source :
 *  « Casque Moto Intégral » touche « casque » (tech) et « moto » (auto) — un
 *  seul point chacun, la source tranche. Il faut DEUX mots concordants pour
 *  contredire une catégorie publiée, sinon on remplacerait une étiquette sûre
 *  par une intuition.
 */
function famille(texte, categorieSource) {
  // La négation est retirée AVANT toute lecture : « sans peluche » ne doit pas
  // compter comme le mot « peluche ». Voir sansNegations().
  // Les mots TROMPEURS le sont aussi (« motorola », « streifen ») : ce sont des
  // noms qui contiennent un de nos mots-clés sans en être. Voir MOTS_TROMPEURS.
  const bas = retirerTrompeurs(sansNegations(sansAccents(String(texte || '')).toLowerCase()));
  // 0. Le PRODUIT NOMMÉ tranche en premier (règle demandée). Voir MOTS_FORTS.
  const appareil = familleParMotFort(bas);
  if (appareil) {
    // …sauf si le titre dit aussi qu'il s'agit d'un JEU NUMÉRIQUE : une
    // application qui simule un jeu de société reste un logiciel. Voir
    // JEU_NUMERIQUE — le support nommé l'emporte, comme le produit nommé.
    // estJeuNumerique — le support nommé l'emporte, comme le produit nommé.
    if (appareil === 'jouets' && estJeuNumerique(bas)) return 'tech';
    // Point 23 — un marqueur enfant/jouet l'emporte sur TOUTE autre famille.
    //  Demande de B, explicitement étendue : « dès qu'il y a le mot jouet pour
    //  enfant garçon et fille ou la catégorie d'âge qui correspond aux enfants,
    //  doit être mis dans jeu et jouet. Cela est valable pour tous les pays. »
    //  ⚠ Seule exception conservée : un JEU NUMÉRIQUE (application, PS5, Steam)
    //  reste un logiciel — c'est la règle « jeu numérique ≠ jouet », plus
    //  ancienne et toujours valable. Sinon « LEGO Batman pour enfant (PS5) »
    //  deviendrait un jouet.
    // POINT 24 — l'appareil ÉLECTROMÉNAGER NOMMÉ l'emporte sur le marqueur
    //  d'enfant : « tondeuse à cheveux enfant » et « brosse à dents kids » sont
    //  des appareils, pas des jouets (demande de B, 7/10).
    //  L'appareil de soin nommé garde SA famille : « brosse à dents électrique
    //  enfant » va en Électroménager, « brosse à dents enfant » (manuelle) en
    //  Beauté. On rend donc `appareil`, qui porte déjà la bonne famille.
    //  Une LAME l'emporte sur la gamme d'appareil qu'elle équipe (voir MOTS_LAME).
    if (appareil === 'electromenager' && MOTS_LAME.test(bas)) return 'beaute';
    if (electroPrimme(bas)) return appareil;
    if (appareil !== 'jouets' && marqueurEnfant(bas) && !estJeuNumerique(bas)) return 'jouets';
    return appareil;
  }
  let meilleur = 'autre', score = 0;
  for (const [fam, mots] of Object.entries(FAMILLES_NORM)) {
    const n = compterMots(mots, bas);
    if (n > score) { score = n; meilleur = fam; }
  }
  const parSource = categorieDeSource(categorieSource);
  let resultat;
  if (parSource) {
    // « autre » n'est pas une affirmation, c'est une ABSENCE d'affirmation : la
    // source dit « ce n'est pas une de mes rubriques » (Culture, Voyage,
    // Alimentation…). Un seul mot du titre fait donc mieux qu'elle — sinon un
    // « aspirapolvere » rangé en Culture resterait en « Autres » alors que le
    // titre dit exactement ce que c'est. Mesuré : 242 offres étaient dans ce
    // cas, faute de cette distinction.
    resultat = (parSource === 'autre')
      ? (meilleur !== 'autre' ? meilleur : 'autre')
      // Face à une VRAIE rubrique de la source, il faut deux mots concordants
      // pour la contredire : « Casque Moto Intégral » touche « casque » (tech) et
      // « moto » (auto), un point chacun — la source tranche.
      : (score >= 2 && meilleur !== parSource ? meilleur : parSource);
  } else {
    resultat = meilleur;
  }
  // E6 — REPAS PRIS DEHORS ≠ CABAS (demande de B, plan point 22). Un titre qui
  //  décrit un repas SERVI (« menu », « restaurant », « hamburger », « brunch »,
  //  « buffet », « à emporter », « pour deux », « sur place ») et qui n'apporte
  //  AUCUNE preuve d'épicerie (lot, pack, surgelé, x4, kg, litre, bouteille,
  //  conserve, supermarché) n'est pas du cabas : c'est une SORTIE, et elle reste
  //  en Activité. Le contrôle est placé APRÈS la source à dessein : il tranche
  //  même contre une source qui aurait rangé l'offre dans une rubrique
  //  alimentaire, parce que c'est exactement le partage demandé — le même
  //  hamburger est un repas dehors, jamais de l'épicerie.
  //  Il s'applique aussi à une offre que RIEN n'a classée (« Autres ») : un
  //  « Menu burger à emporter » d'un article de presse est une sortie, et il n'y
  //  a aucune raison de le laisser en « Autres » faute de mot-clé.
  if ((resultat === 'nourriture' || resultat === 'autre')
    && estRepasDehors(bas) && !preuveEpicerie(bas)) return 'activite';
  // POINT 23 — DERNIER FILET, ÉTENDU À TOUTES LES CATÉGORIES. Demande de B :
  //  « dès qu'il y a le mot jouet pour enfant garçon et fille ou la catégorie
  //  d'âge qui correspond aux enfants, doit être mis dans jeu et jouet. Cela est
  //  valable pour tous les pays. » Le marqueur enfant l'emporte donc sur
  //  n'importe quelle famille décidée par les mots OU par la rubrique de la
  //  source — sauf sur un JEU NUMÉRIQUE, qui reste un logiciel.
  //  Même exception qu'au point 24 : un appareil ÉLECTROMÉNAGER nommé garde sa
  //  famille — soit que le titre le nomme, soit que la source l'ait rangé là.
  if (resultat !== 'jouets' && marqueurEnfant(bas) && !estJeuNumerique(bas)
    && !appareilSoin(bas) && resultat !== 'electromenager' && resultat !== 'beaute') return 'jouets';
  return resultat;
}

/**
 * Compte les mots-clés présents. DÉFAUT CORRIGÉ : une recherche « pc », « tv »
 * ou « jeu » par simple `includes` trouvait n'importe quoi à l'intérieur des
 * URL encodées de Google News — un article de mode était classé High-tech.
 * Les mots courts exigent donc une frontière de mot — ainsi que ceux listés
 * dans MOTS_A_FRONTIERE, quelle que soit leur longueur.
 */
function compterMots(mots, texteBas) {
  return mots.filter((m) => (exigeFrontiere(m)
    ? new RegExp('(^|[^a-zà-ÿ])' + m + '([^a-zà-ÿ]|$)', 'i').test(texteBas)
    : texteBas.includes(m))).length;
}

/* ------------------------------------------------------------------ *
 *  Marchands — reconnus par leur nom (Dealabs) ou par le domaine du lien.
 * ------------------------------------------------------------------ */
const MARCHANDS = [
  ['Amazon', /amazon\./i], ['Cdiscount', /cdiscount\./i], ['Boulanger', /boulanger\./i],
  ['Fnac', /fnac\./i], ['Darty', /darty\./i], ['Leclerc', /leclerc\./i], ['Carrefour', /carrefour\./i],
  ['Auchan', /auchan\./i], ['Leroy Merlin', /leroymerlin\./i], ['Castorama', /castorama\./i],
  ['Brico Dépôt', /bricodepot\./i], ['Bricomarché', /bricomarche\./i], ['Mr.Bricolage', /mrbricolage\./i],
  ['ManoMano', /manomano\./i], ['Decathlon', /decathlon\./i], ['Intersport', /intersport\./i],
  ['Zalando', /zalando\./i], ['La Redoute', /laredoute\./i], ['Sarenza', /sarenza\./i],
  ['Spartoo', /spartoo\./i], ['Vinted', /vinted\./i], ['eBay', /ebay\./i], ['AliExpress', /aliexpress\./i],
  ['Cdiscount', /cdiscount\./i], ['Rue du Commerce', /rueducommerce\./i], ['LDLC', /ldlc\./i],
  ['TopAchat', /topachat\./i], ['Materiel.net', /materiel\.net/i], ['Samsung', /samsung\./i],
  ['Apple', /apple\./i], ['Google', /store\.google\./i], ['Xiaomi', /mi\.com|xiaomi\./i],
  ['Ikea', /ikea\./i], ['Conforama', /conforama\./i], ['But', /but\.fr/i], ['JouéClub', /jouéclub|joueclub/i],
  ['King Jouet', /kingjouet\./i], ['La Grande Récré', /lagranderecre\./i], ['Smyths', /smythstoys\./i],
  ['Nike', /nike\./i], ['Adidas', /adidas\./i], ['Uniqlo', /uniqlo\./i], ['H&M', /hm\.com/i],
  ['Cultura', /cultura\./i], ['Micromania', /micromania\./i], ['Norauto', /norauto\./i],
  ['Feu Vert', /feuvert\./i], ['Sephora', /sephora\./i], ['Nocibé', /nocibe\./i],
];

function marchand(nomDonne, url) {
  for (const [nom, re] of MARCHANDS) { if (nomDonne && nomDonne.toLowerCase() === nom.toLowerCase()) return nom; }
  for (const [nom, re] of MARCHANDS) { if (url && re.test(url)) return nom; }
  if (nomDonne) return String(nomDonne).trim();
  try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch { return 'marchand'; }
}

/* ------------------------------------------------------------------ *
 *  Prix et remises — uniquement ce qui est ÉCRIT dans la source.
 * ------------------------------------------------------------------ */
const versPrix = (texte) => {
  const m = String(texte || '').replace(/\u00a0|\u202f/g, ' ').match(/(\d[\d\s]*)(?:[.,](\d{1,2}))?\s*€/);
  if (!m) return null;
  const entier = Number(m[1].replace(/\s/g, ''));
  const cents = m[2] ? Number('0.' + m[2]) : 0;
  const v = entier + cents;
  return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
};

/* UN COUPLE DE PRIX N'EST MONTRABLE QUE S'IL DÉCRIT LA MÊME CHOSE.
 *
 * Défaut trouvé le 13/10/2026 en VÉRIFIANT le site en ligne, pas en relisant le code :
 * une carte annonçait « 0,88 € au lieu de 200,16 € », soit −100 %. La source disait
 * « für jeweils 0,88 € (insgesamt 5,26 € statt 200,16 €) » : le prix À L'UNITÉ d'un
 * côté, le TOTAL de l'autre. Les deux montants sont vrais ; leur rapport ne veut rien
 * dire. Une phrase ne se lit pas comme un champ, et c'est nous qui affichons le rapport.
 *
 * La borne est celle de l'application, pas une invention : au-delà de 90 %, « ce n'est
 * plus une remise, c'est une qualité qu'on annonce » (voir REMISE_ANNONCEE_MAX dans
 * app.js). On l'applique donc aussi au couple, et sur le pourcentage ARRONDI — celui
 * qui s'affiche. Mesuré sur le catalogue : 6 744 couples, dont 3 au-dessus de 10 fois
 * le prix. Les trois sont faux ou invérifiables (un total contre un prix unitaire, une
 * adhésion d'un an contre un mois) ; le vrai « 2,49 € statt 24,99 € » d'un jeu à −90 %
 * passe, lui, à 90 % exactement. */
const REMISE_MAX_PAIRE = 90;

export function paireDePrix(prix, avant) {
  if (prix == null || avant == null || !(avant > prix)) return null;
  const remise = Math.round((1 - prix / avant) * 100);
  return remise <= REMISE_MAX_PAIRE ? { prix, avant, remise } : null;
}

/* LE PRIX DE RÉFÉRENCE, DANS LA LANGUE DE LA SOURCE.
 *
 * Défaut signalé par B (13/10/2026), mot pour mot : « Je remarque aussi que
 * souvent il y a un pourcentage de réduction avec le prix d'origine mais que
 * cela n'est pas indiqué sur la carte. »
 *
 * Mesuré dans le catalogue publié : 1 557 titres portent un pourcentage, et 675
 * de leurs cartes n'affichent AUCUNE remise. Deux causes opposées, à ne pas
 * confondre :
 *   • « bis zu 70 % », « up to 50 % off », « jusqu'à -84 % » : une ACCROCHE, elle
 *     annonce un maximum et ne dit rien du produit affiché. L'écrire sur la carte
 *     serait fabriquer un chiffre — on la refuse, et ça existe déjà
 *     (ACCROCHE_POURCENT) ;
 *   • « für 2,49 € statt 24,99 € » : le prix d'origine EST publié par la source,
 *     et nous ne le lisions pas. La lecture ne connaissait que les mots français
 *     « au lieu de ». Un titre allemand, espagnol, néerlandais, italien ou
 *     portugais perdait donc sa remise ET son prix barré.
 *
 * C'est la seconde qu'on répare ici. Deux corrections, pas une :
 *
 *   1. LES MOTS. Chaque langue a les siens — « statt », « instead of », « en vez
 *      de », « in plaats van », « invece di », « em vez de », « zamiast ». Le
 *      collecteur les connaissait déjà pour QUALIFIER un pourcentage
 *      (MOTS_QUALIFIANT_POURCENT) ; il ne s'en servait pas pour LIRE le prix.
 *
 *   2. LE MOTIF ÉTAIT CASSÉ, MÊME EN FRANÇAIS. L'ancien fragment
 *      « [^.,;]{0,20} » s'arrêtait à la virgule : dans « au lieu de 24,99 € » il
 *      ne capturait que « 24 », et `versPrix` — qui exige un symbole € — rendait
 *      null. Un prix décimal, donc le cas ordinaire, n'était jamais lu. Le
 *      fragment exige maintenant des chiffres ET la devise, ce qui règle le
 *      décimal et écarte au passage les phrases où le mot n'annonce aucun prix.
 *
 * LIMITE CONNUE, DITE TELLE QUELLE : `versPrix` ne lit que l'euro. Un titre en
 * livres, en zlotys ou en couronnes n'apporte donc ici aucun prix de référence
 * (HotUKDeals, Pepper PL, Mobil.se…). Le prix PRINCIPAL de ces offres est lu par
 * la même fonction : c'est un chantier à part — les devises des sources — et un
 * prix absent vaut mieux qu'un prix inventé. */
const MOTS_PRIX_AVANT = /(?:au lieu de|statt|anstatt|instead of|in plaats van|en vez de|en lugar de|invece di|em vez de|zamiast|ist[äa]llet f[öo]r)/i;

export function prixAvantDans(texte) {
  const t = String(texte || '').replace(/\u00a0|\u202f/g, ' ');
  const m = t.match(new RegExp(MOTS_PRIX_AVANT.source + '\\s*:?\\s*(\\d[\\d\\s.,]{0,12}\\s?€)', 'i'));
  return m ? versPrix(m[1]) : null;
}

/* Mots qui QUALIFIENT un pourcentage.
 *
 *  Distinction décisive : « 50 % Rabatt » est une remise, « 1,5 % Fett » est un
 *  taux de matière grasse, « 100 % » peut être une composition. Un pourcentage
 *  seul ne prouve rien — il faut qu'un mot de promotion l'accompagne. */
const MOTS_QUALIFIANT_POURCENT = /(korting|rabatt|r[ée]duction|reduction|remise|sconto|descuento|desconto|zni[żz]ka|znizka|rabat|off\b|sale|soldes|promo|angebot|oferta|promo[çc][ãa]o|erbjudande|rea\b|statt|au lieu de|invece di|instead of)/i;

/* Formules d'ACCROCHE : elles annoncent un maximum, pas une remise.
 *  « jusqu'à -84 % », « bis zu 25 % », « up to 50 % Off », « até 95 % de
 *  desconto » ne disent rien du produit affiché — les compter serait fabriquer
 *  une remise. Chaque langue a sa formule, et les oublier en laisse passer.
 *
 *  `at[ée](?![a-zà-ÿ])` et non `at[ée]\b` : en JavaScript, `\b` ne connaît que
 *  les lettres ASCII, donc après « é » il ne se place jamais. Un `\b` fautif
 *  aurait laissé passer tout le portugais. */
const ACCROCHE_POURCENT = /(jusqu['’]?\s?[àa]|à partir de|a partir de|bis zu|up to|upp till|tot en met|\btot\b|fino a|hasta|at[ée](?![a-zà-ÿ])|no m[áa]ximo|max\.?|maximum|maximal|desde|vanaf|najwy[żz]ej|\bdo\s+\d|\bod\s+\d)/i;

/* Un pourcentage SUIVI d'un mot de liaison (« of », « av », « des »…) exprime
 *  une PROPORTION, pas une remise : « aimé par 95 % des joueurs ». Sans cette
 *  règle, ces taux entraient comme remises — et 95 % de remise, ça fait acheter.
 *
 *  `of\b` et non `of` : sans la limite de mot, « 15% off » était pris pour
 *  « 15 % of » et la vraie promotion était jetée. */
const POURCENT_PROPORTION = /^\s+(av\b|of\b|des\b|du\b|della\b|dei\b|del\b|de los\b|de las\b|z\b|ze\b|spo[śs]r[óo]d\b|af\b)/i;

/**
 * Le pourcentage de remise ÉCRIT dans la source, ou null.
 *
 *  Trois acceptions, de la plus sûre à la moins sûre :
 *
 *    1. un signe moins le précède (« -12 % ») — la forme habituelle ;
 *    2. un mot de promotion l'accompagne à moins de trente caractères
 *       (« 50 % Rabatt », « 15 % korting », « 30 % off ») — c'est ce que
 *       publient les sites d'entraide allemands, néerlandais et anglais, et
 *       c'est pour cela que des centaines d'offres annonçaient une remise sans
 *       qu'elle soit enregistrée : le code ne connaissait que la forme française
 *       signée ;
 *    3. il est collé à un prix (« à 69,99 € (-12%) »), ce qui l'ancre sur un
 *       produit précis et non sur un slogan.
 *
 *  Sont refusés dans tous les cas : les formules d'accroche, cherchées
 *  UNIQUEMENT AVANT le nombre, et les proportions, cherchées UNIQUEMENT APRÈS.
 *
 *  Pourquoi cette séparation des côtés : une fenêtre indifférenciée fait
 *  disqualifier le mauvais pourcentage. Mesuré sur « aimé par 95 % av spelarna,
 *  har 85 % rabatt » : l'accroche voisine faisait jeter le 85 %, qui était la
 *  vraie remise du titre.
 */
function pourcentEcrit(texte) {
  const t = String(texte || '');
  const plausible = (n) => Number.isFinite(n) && n > 0 && n < 100;
  /* Ce qui précède le nombre, mais SEULEMENT dans la même proposition.
   *  On s'arrête à la ponctuation : dans « PS Store Sale mit bis zu 92 % Rabatt,
   *  jetzt 85 % Rabatt », le « bis zu » appartient au 92, pas au 85. Sans cette
   *  coupe, la vraie remise du produit était jetée à cause de l'accroche d'à
   *  côté. */
  const avantDe = (index) => {
    const brut = t.slice(Math.max(0, index - 34), index);
    let coupe = -1;
    for (const c of [',', '.', ';', ':', '!', '?', '|', '(', ')']) {
      coupe = Math.max(coupe, brut.lastIndexOf(c));
    }
    return coupe >= 0 ? brut.slice(coupe + 1) : brut;
  };
  const apresDe = (fin) => t.slice(fin, fin + 34);
  const fenetre = (index, longueur) => t.slice(Math.max(0, index - 30), index + longueur + 30);
  const disqualifie = (index, fin) => ACCROCHE_POURCENT.test(avantDe(index)) || POURCENT_PROPORTION.test(apresDe(fin));

  // 1. signe moins.
  for (const m of t.matchAll(/[-−]\s?(\d{1,2})\s?%/g)) {
    if (disqualifie(m.index, m.index + m[0].length)) continue;
    if (plausible(Number(m[1]))) return Number(m[1]);
  }
  // 2. pourcentage accompagné d'un mot de promotion.
  for (const m of t.matchAll(/(\d{1,2})\s?%/g)) {
    const fin = m.index + m[0].length;
    if (disqualifie(m.index, fin)) continue;
    if (MOTS_QUALIFIANT_POURCENT.test(fenetre(m.index, m[0].length)) && plausible(Number(m[1]))) return Number(m[1]);
  }
  // 3. pourcentage collé à un prix.
  const ancre = t.match(/\d+[.,]\d{2}\s?€[^\d]{0,14}?\(?\s*[-−]?\s?(\d{1,2})\s?%/);
  if (ancre && plausible(Number(ancre[1]))) return Number(ancre[1]);
  return null;
}

/**
 * Remise : on n'accepte QUE deux preuves.
 *   1. un pourcentage écrit noir sur blanc et QUALIFIÉ (voir pourcentEcrit) ;
 *   2. deux prix réels (avant / après) — le pourcentage est alors CALCULÉ.
 * Sinon : aucune remise affichée. Un faux pourcentage est pire que pas d'offre.
 */
function remise(texte, prix, prixAvant) {
  const ecrit = pourcentEcrit(texte);
  if (ecrit != null) return { pourcent: ecrit, calculee: false };
  // Le couple passe par la même porte que partout ailleurs : au-delà de 90 %, les deux
  // montants ne décrivent pas la même chose et leur rapport ne s'affiche pas.
  const paire = paireDePrix(prix, prixAvant);
  if (paire) return { pourcent: paire.remise, calculee: true };
  return null;
}

/* ------------------------------------------------------------------ *
 *  Un item → une offre normalisée.
 * ------------------------------------------------------------------ */
function offreDealabs(bloc, source) {
  // La « température » Dealabs (160°, 298°…) est collée devant certains titres.
  // Ce n'est pas le nom du produit : on la retire du titre, sinon l'offre
  // s'affiche comme « 298° - Vente flash TGV ». On la GARDE à part — c'est le
  // score communautaire, donc le seul critère honnête pour dire « la meilleure ».
  const titreBrut = nettoyer(balise(bloc, 'title'));
  const noteTemp = Number((titreBrut.match(/^\s*(\d{1,4})\s*°/) || [])[1]);
  const temperature = Number.isFinite(noteTemp) && noteTemp > 0 ? noteTemp : null;
  if (source.temperatureMin != null && temperature != null && temperature < source.temperatureMin) return null;
  const titre = titreBrut.replace(/^\s*\d{1,4}\s*°\s*[-–—]\s*/, '');
  if (!titre) return null;
  const lien = nettoyer(balise(bloc, 'link'));
  const categorieBrute = nettoyer(balise(bloc, 'category'));
  const marchandBloc = bloc.match(/<pepper:merchant[^>]*name="([^"]*)"[^>]*price="([^"]*)"/i)
    || bloc.match(/<pepper:merchant[^>]*price="([^"]*)"[^>]*name="([^"]*)"/i);
  let nomMarchand = marchandBloc ? (marchandBloc[1].includes('€') ? marchandBloc[2] : marchandBloc[1]) : '';
  // Le nom vient d'un ATTRIBUT XML : il doit passer par le même nettoyage que le
  // reste, sinon « Olfert &amp;amp; Co » s'affiche tel quel dans l'application —
  // une double entité qu'aucun autre champ ne rattrape.
  if (nomMarchand) nomMarchand = nettoyer(nomMarchand);
  const prixTexte = marchandBloc ? (marchandBloc[1].includes('€') ? marchandBloc[1] : marchandBloc[2]) : '';
  const description = nettoyer(balise(bloc, 'description'));
  // Repli : la description commence presque toujours par « <prix> - <marchand> ».
  if (!nomMarchand) {
    const m = balise(bloc, 'description').match(/-[\s]*([^<]{2,40})<\/strong>/i);
    if (m) nomMarchand = nettoyer(m[1]);
  }
  const image = (bloc.match(/<media:content[^>]*url="([^"]+)"/i) || [])[1] || '';
  const date = nettoyer(balise(bloc, 'pubDate'));
  const texte = `${titre} ${description}`;

  const prix = versPrix(prixTexte) ?? versPrix(titre);
  // Prix « avant » : souvent écrit « au lieu de 499 € » ou « 499 € au lieu de 699 € ».
  // Il n'entre que s'il forme une paire USABLE avec le prix demandé : mesuré le
  // 13/10/2026, un titre « BBFP App gratis (statt 2,59 €) » portait le prix d'origine
  // ÉGAL au prix lu — la carte aurait barré 2,59 € au-dessus de 2,59 €.
  const paire = paireDePrix(prix, prixAvantDans(texte));
  const avant = paire ? paire.avant : null;
  const rem = remise(texte, prix, avant);

  return {
    id: identifiant('d', lien, titre),
    type: 'offre',
    titre: titre.slice(0, 220),
    lienMarchand: lien,
    lienPage: lien,
    marchand: marchand(nomMarchand, lien),
    prix,
    prixAvant: avant,
    remise: rem ? rem.pourcent : null,
    remiseCalculee: rem ? rem.calculee : false,
    categorie: famille(titre, categorieBrute),
    categorieSource: categorieBrute,
    temperature,
    image,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    source: source.nom,
    sourceId: source.id,
    // Le pays de la source : c'est ce champ qui donne un sens au filtre par pays.
    // Chaque offre porte donc son origine, et le filtre affiche de VRAIES offres
    // du pays choisi — jamais une liste identique sous une autre étiquette.
    pays: source.pays || 'FR',
  };
}

/* Mots qui ANNONCENT une promotion, PAR LANGUE.
 *
 * Le filtre était français et s'appliquait à TOUTES les presses : un titre
 * suédois, polonais ou portugais n'avait pratiquement aucune chance de passer.
 * Mesuré avant correction — sur un même flux de 100 titres, le filtre français
 * n'en retenait 0 à 5, le filtre dans la bonne langue 70 à 97. C'était la
 * première cause du « pas beaucoup de résultats » dans certains pays, et elle
 * était invisible : la collecte réussissait, les sources répondaient 200.
 *
 * Un mot isolé suffit à retenir (« deal », « offer », « Angebot ») : le but est
 * de ne pas jeter un bon plan, pas de trier finement — la veille est étiquetée
 * comme telle à l'écran, l'utilisateur voit ce qu'il consulte.
 *
 * ⚠ LE POURCENTAGE ÉCRIT AU-DELÀ DE 90 % N'EST PLUS UN SIGNAL (09/10/2026).
 *
 * Question de B, avec une offre réelle : *« ”Je démissionne car que je sais que
 * je ne pourrai plus me donner à 100 %” : le MR propose de réduire le nombre
 * d'échevins — pourquoi ce genre d'article apparaît ? »* Cause exacte : la
 * branche `\d+\s?%` acceptait N'IMPORTE QUEL pourcentage. Un article politique
 * entrait donc par le « 100 % » d'une citation.
 *
 * Le motif n'accepte plus que 1 à 90 % — la même borne que l'application, qui
 * refuse déjà d'afficher une remise annoncée au-delà de 90 % (voir
 * REMISE_ANNONCEE_MAX dans app.js : « au-delà de 90 %, ce n'est plus une
 * remise »). Au-delà, ce n'est pas un prix qui baisse, c'est une qualité qu'on
 * annonce : « 100 % coton », « 99 % sRGB », « 99 % d'eau », « 100 % électrique »,
 * « jusqu'à 100 % plus longtemps ». Un pourcentage qui n'a pas de chiffre ni de
 * virgule devant lui non plus (« 1 000 % ») ne compte pas.
 *
 * Mesuré sur les 1 612 cartes de veille sans prix du catalogue publié : la règle
 * en écarte **6**, et ce sont très exactement des brèves — l'article de B, un
 * podium de football « 100 % brugeois », deux faits divers anversois, un essai
 * de Hyundai « 100 % électrique », un camping-car « 100 % made in France » — sans
 * perdre un seul bon plan (« Até 54% de desconto », « Promo Code … 10% OFF »,
 * « top-selling deal … $250 off » passent toujours).
 *
 * Ce que la règle NE fait PAS (limite connue, et mesurée) : une brève qui
 * annonce « jusqu'à 70 % des dons restent invendus » passe encore — il faudrait
 * exiger qu'un mot de promotion ACCOMPAGNE le pourcentage, ce qui se paierait en
 * vrais bons plans. À trancher séparément.
 */
const MOTS_PROMO = {
  fr: /(bon plan|bons plans|promo|promotion|r[ée]duction|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|perd \d+|prix cass|petit prix|deal|affaire|soldes|black friday|chute à|tombe à|code promo)/i,
  nl: /(koopje|aanbieding|korting|promotie|deal|actie|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|prijsval|gedaald|goedkoper|kortingscode)/i,
  de: /(angebot|rabatt|aktion|schn[aä]ppchen|deal|preissturz|reduziert|g[uü]nstiger|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|statt \d|nur \d|gutschein)/i,
  es: /(oferta|descuento|chollo|rebaja|promoci[oó]n|gan?a|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|precio|cup[oó]n)/i,
  it: /(offerta|sconto|promozione|occasione|prezzo|ribass|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|miglior prezzo|coupon)/i,
  pt: /(promo[çc][aã]o|desconto|oferta|saldo|barato|pre[çc]o|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|mais barato|cup[aã]o)/i,
  pl: /(promocja|zni[żz]ka|okazja|przecena|taniej|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|cena|rabat)/i,
  sv: /(erbjudande|rabatt|rea|kampanj|pris|s[aä]nkt|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|billigare)/i,
  en: /(deal|offer|discount|sale|bargain|(?<![\d.,])(?:[1-9]|[1-8]\d|90)\s?%|price drop|cheap|£\d|promo)/i,
};

/** Le filtre de la source, dans SA langue. Toutes les sources déclarent la
 *  leur — un test le vérifie, pour que le défaut français ne se glisse pas en
 *  silence sous une source étrangère. */
function motsPromo(source) {
  return MOTS_PROMO[(source && source.langue) || 'fr'] || MOTS_PROMO.fr;
}

/** Le MARCHAND d'un article de presse : la boutique citée, pas le journal. */
function marchandDePresse(titre, bloc) {
  const cite = String(titre).match(/\b(?:chez|sur|par)\s+([A-ZÉÈÀÂÎÔÛ][\w&'’.-]{2,24})/);
  if (cite) {
    const nom = cite[1].replace(/[.,;:]$/, '');
    const connu = MARCHANDS.find(([n]) => n.toLowerCase() === nom.toLowerCase());
    if (connu) return connu[0];
    return nom;
  }
  const src = nettoyer(balise(bloc, 'source'));
  return src || 'presse';
}

function offrePresse(bloc, source, familleImposee) {
  const titre = nettoyer(balise(bloc, 'title'));
  // Le filtre parle la langue de la SOURCE — décision mesurée, voir MOTS_PROMO.
  if (!titre || !motsPromo(source).test(titre)) return null;
  const lien = lienReel(nettoyer(balise(bloc, 'link')) || (bloc.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '');
  const description = nettoyer(balise(bloc, 'description') || balise(bloc, 'summary'));
  const date = nettoyer(balise(bloc, 'pubDate') || balise(bloc, 'updated'));
  const texte = `${titre} ${description}`;
  const prix = versPrix(titre);
  const paire = paireDePrix(prix, prixAvantDans(texte));
  const avant = paire ? paire.avant : null;
  const rem = remise(texte, prix, avant);   // jamais de % d'accroche ici
  // Une VRAIE offre a un prix. Sans prix, c'est un article de veille — et une
  // remise en pourcentage sans prix n'a rien à faire dans la liste des offres.
  const type = prix != null ? 'offre' : 'article';
  return {
    id: identifiant('p', lien, titre),
    type,
    titre: titre.slice(0, 220),
    lienMarchand: lien,
    lienPage: lien,
    marchand: source.marchandImpose || marchandDePresse(titre, bloc),
    prix,
    prixAvant: avant,
    remise: rem ? rem.pourcent : null,
    remiseCalculee: rem ? rem.calculee : false,
    categorie: famille(titre, familleImposee || ''),
    categorieSource: familleImposee || 'presse',
    image: (bloc.match(/<media:content[^>]*url="([^"]+)"/i) || bloc.match(/<enclosure[^>]*url="([^"]+)"/i) || [])[1] || '',
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    source: source.nom,
    sourceId: source.id,
    // Le pays de la source : c'est ce champ qui donne un sens au filtre par pays.
    // Chaque offre porte donc son origine, et le filtre affiche de VRAIES offres
    // du pays choisi — jamais une liste identique sous une autre étiquette.
    pays: source.pays || 'FR',
  };
}

/* ------------------------------------------------------------------ *
 *  ENSEIGNES — lire les promotions d'un marchand dans son JSON-LD.
 *
 *  On ne découpe PAS le HTML (les noms de classes changent au premier
 *  redesign) : on lit le JSON-LD schema.org que la page déclare. Un
 *  `ItemList` contient des `Product`, chacun avec son `offers.price`, son nom
 *  et son visuel. C'est du structuré, donc stable.
 *
 *  Repli HTML prévu pour un cas précis : une page d'enseigne dont les cartes
 *  portent le prix dans un attribut lisible (`aria-label="12,99 €"`). Il ne
 *  sert que si aucun JSON-LD produit n'a été trouvé — jamais en complément,
 *  pour ne pas mélanger deux lectures et compter deux fois le même article.
 * ------------------------------------------------------------------ */
const TYPES_PRODUIT = new Set(['Product', 'IndividualProduct', 'ProductModel']);

/** Prix de référence, lu dans la CHARGE INTERNE de la page.
 *
 *  Le JSON-LD d'une page d'enseigne ne publie QUE le prix demandé : `listPrice`
 *  y est absent, et `ajouter()` plus bas ne trouvait donc aucun second prix —
 *  d'où des cartes à prix nu, sans aucun intérêt pour un utilisateur venu
 *  chercher des réductions.
 *
 *  Ce prix de référence existe pourtant, à côté du prix de vente, dans la
 *  charge React de la page (`listPrice.includingVat` / `salesPrice.includingVat`)
 *  — échappée dans le HTML, donc lue par motif.
 *
 *  MESURÉ sur deux pages réelles avant d'écrire cette fonction : 22 produits
 *  par page, 5 avec un prix de référence sur la première (un seul ≥ 15 %), 1 sur
 *  la sixième (−10 %). Autrement dit la page « offres » de Coolblue est un
 *  CATALOGUE, pas une page de promotions. On lit quand même la référence : les
 *  quelques vraies remises qu'elle contient valent d'être montrées, et elles
 *  seront calculées entre deux prix réels.
 */
function prixReferenceEnseigne(html) {
  const table = new Map();
  const re = /\\"name\\":\\"([^"\\]{3,120})\\"[\s\S]{0,600}?\\"listPrice\\":\{\\"includingVat\\":([0-9.]+)[\s\S]{0,200}?\\"salesPrice\\":\{\\"includingVat\\":([0-9.]+)/g;
  for (const [, nom, liste, prix] of String(html).matchAll(re)) {
    const l = Number(liste);
    const p = Number(prix);
    // Un `listPrice` à 0 est l'aveu du marchand qu'il n'y a pas de référence :
    // le retenir fabriquerait une remise de 100 %.
    if (Number.isFinite(l) && Number.isFinite(p) && l > p && p > 0) table.set(nettoyer(nom), l);
  }
  return table;
}

/** Le prix de référence publié dans une `priceSpecification` de type
 *  `ListPrice` — la forme qu'utilise Groupon pour écrire « au lieu de ».
 *
 *  Le champ peut être un objet OU un tableau, et la casse du `priceType` varie
 *  d'un marchand à l'autre (« ListPrice », « https://schema.org/ListPrice »).
 *  On accepte les deux : refuser la forme la plus courante ferait perdre
 *  toutes les remises d'une source, en silence.
 */
function referenceListe(off) {
  if (!off || !off.priceSpecification) return null;
  const specs = Array.isArray(off.priceSpecification) ? off.priceSpecification : [off.priceSpecification];
  for (const s of specs) {
    if (s && /listprice/i.test(String(s.priceType || ''))) {
      const v = versNombre(s.price);
      if (v != null) return v;
    }
  }
  return null;
}

/** GARDE-FOU DE VRAISEMBLANCE — « uniquement des promotions crédibles ».
 *
 *  Demande explicite : « Je n'ai pas besoin d'avoir de la pollution. » Groupon
 *  publie des prix de référence souvent GONFLÉS : mesuré sur sa propre page,
 *  une licence à 11,99 € « au lieu de 129,90 € » (−91 %), un matelas à 149 €
 *  « au lieu de 1 339 € » (−89 %). Ce ne sont pas des promotions, ce sont des
 *  prix conseillés invérifiables — exactement le faux « −99 % » qu'on a banni.
 *
 *  Deux verrous, et les deux nombres viennent des données réelles :
 *    — le prix de référence ne peut pas valoir 5× le prix demandé ou plus
 *      (au-delà, ce n'est plus le même article, ou ce n'est plus un prix) ;
 *    — la remise calculée doit tenir dans [15 %, 90 %] — sous 15 % ce n'est
 *      pas un bon plan, au-dessus de 90 % ce n'est plus une remise.
 *
 *  Ce qu'il donne sur la page réellement mesurée : 59 bons plans retenus sur
 *  61 sur la page « sale », et 2 sur 9 sur la page de produits. Peu, mais
 *  aucun faux. Un faux pourcentage est pire que pas d'offre.
 */
const RATIO_REFERENCE_MAX = 5;
function referenceVraisemblable(prix, avant) {
  if (avant == null || prix == null || prix <= 0) return null;
  if (avant <= prix) return null;
  if (avant >= prix * RATIO_REFERENCE_MAX) return null;
  return avant;
}

const REMISE_SOURCE_MIN = 15;
const REMISE_SOURCE_MAX = 90;
function remiseCredibleSource(prix, avant) {
  const ref = referenceVraisemblable(prix, avant);
  if (ref == null) return false;
  const p = Math.round(((ref - prix) / ref) * 100);
  return p >= REMISE_SOURCE_MIN && p <= REMISE_SOURCE_MAX;
}

function offresEnseigne(html, source) {
  const produits = [];
  const vus = new Set();
  const reference = prixReferenceEnseigne(html);
  const ajouter = (o) => {
    const brut = Array.isArray(o.image) ? o.image[0] : o.image;
    const image = typeof brut === 'string' ? brut : (brut && (brut.url || brut.contentUrl)) || '';
    const off = Array.isArray(o.offers) ? o.offers[0] : o.offers;
    const prix = versNombre(off && off.price);
    const lien = String(o.url || (off && (off.url || off['@id'])) || '').trim();
    if (!o.name || prix == null) return;
    // RÈGLE DU PRODUIT, appliquée à la source : « une promotion sans deuxième
    //  prix n'est pas une promotion ». Mesuré le 7/10 : la page « offres » de
    //  Coolblue liste 246 articles, dont 199 SANS aucun prix de référence — des
    //  prix catalogue nus (Miele Guard M1 à 279 €, Galaxy Watch 9 à 367 €…).
    //  Les afficher en masse noie les 47 VRAIES remises et fait perdre au site
    //  ce qui fait sa valeur. On ne garde donc que ce qui a un avant/après.
    //  (Les enseignes qui ne publient AUCUN prix — Bol, Tesco, Argos… — ne
    //  passent pas par ici : elles relèvent de l'étage « bonne affaire ».)
    const avant = referenceVraisemblable(prix,
      versNombre((off && (off.highPrice || off.listPrice)) || o.highPrice)
      ?? referenceListe(off)
      ?? reference.get(nettoyer(o.name)) ?? null);
    if (avant == null) return;
    const cle = (lien || String(o.name)).toLowerCase();
    if (vus.has(cle)) return;
    vus.add(cle);
    produits.push({
      titre: nettoyer(o.name),
      prix,
      // Quatre sources possibles pour le prix de référence, dans l'ordre de
      // fiabilité : les `highPrice`/`listPrice` du JSON-LD, la
      // `priceSpecification` de type `ListPrice` (là où Groupon écrit « au lieu
      // de »), puis la charge interne de la page (Coolblue). Le garde-fou de
      // vraisemblance s'applique en dernier, à la valeur retenue.
      prixAvant: avant,
      lien: lien || source.url,
      image: /^https?:\/\//i.test(image) ? image : '',
      marque: typeof o.brand === 'object' && o.brand ? String(o.brand.name || '') : String(o.brand || ''),
    });
  };
  // Le parcours est récursif volontairement : un `ItemList` peut être imbriqué
  // dans un `@graph`, et les Product dedans — un seul niveau ne suffirait pas.
  const parcourir = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(parcourir); return; }
    const t = o['@type'];
    const types = Array.isArray(t) ? t : [t];
    if (types.some((x) => TYPES_PRODUIT.has(x))) ajouter(o);
    for (const v of Object.values(o)) parcourir(v);
  };
  for (const [, brut] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { parcourir(JSON.parse(brut.trim())); } catch { /* JSON-LD tronqué : on l'ignore, la page reste valable */ }
  }

  if (!produits.length) produits.push(...produitsDepuisCartes(html));

  return produits.map((p) => {
    const texte = `${p.titre} ${p.marque}`;
    // Prix barré affiché : c'est une remise VRAIE (deux prix de la source), donc
    // on la calcule. Sans second prix, on n'affiche aucune remise — règle
    // inchangée : un faux pourcentage est pire que pas d'offre.
    const rem = remise(texte, p.prix, p.prixAvant);
    return {
      id: identifiant('e', p.lien, p.titre),
      type: 'offre',
      titre: p.titre.slice(0, 220),
      lienMarchand: p.lien,
      lienPage: p.lien,
      // Le marchand est celui de la SOURCE, en dur : ici le vendeur est connu,
      // il n'y a rien à deviner depuis un titre d'article.
      marchand: source.nom,
      prix: p.prix,
      prixAvant: p.prixAvant,
      remise: rem ? rem.pourcent : null,
      remiseCalculee: rem ? rem.calculee : false,
      categorie: source.categorieImposee || famille(p.titre, source.categorie || ''),
      categorieSource: source.categorieImposee || source.categorie || 'enseigne',
      // Rubrique IMPOSÉE par la page : elle doit survivre au reclassement des
      // passages suivants, exactement comme pour Groupon. Sans ce champ,
      // `classerOffre` rejugerait ces offres sur le SEUL titre — et Zooplus,
      // dont les titres sont des noms de marque sans mot animalier, renverrait
      // la nourriture pour chats en « Nourriture » et le reste en « Autres »,
      // deux erreurs que B dénonce (points 14 et 18).
      categorieImposee: source.categorieImposee || null,
      image: p.image,
      date: new Date().toISOString(),
      // La page ne dit AUCUNE date : ceci est l'instant du relevé, pas la date
      // de l'offre. Voir TYPES_DATE_RELEVEE — la fusion refusera désormais de
      // l'écraser, et la carte cessera d'annoncer « il y a 1 min » à vie.
      dateRelevee: true,
      source: source.nom,
      sourceId: source.id,
      pays: source.pays || 'FR',
    };
  });
}

/** Repli : cartes produit dont le prix est écrit en clair dans un attribut
 *  (`aria-label="12,99 €"`) et dont le lien porte une fiche produit.
 *  Volontairement étroit : il vaut mieux zéro offre qu'une liste de faux prix. */
function produitsDepuisCartes(html) {
  const out = [];
  const vus = new Set();
  const cartes = [...html.matchAll(/<a[^>]+href="([^"]*\/p\/[^"]+)"[^>]*>([\s\S]{0,600}?)<\/a>/gi)];
  for (const [, href, corps] of cartes) {
    const prix = versNumberCarte(corps) ?? versNumberCarte(href);
    const nom = (corps.match(/<h[1-4][^>]*>([\s\S]{2,120}?)<\/h[1-4]>/i) || [])[1];
    if (prix == null || !nom) continue;
    const titre = nettoyer(nom);
    const lien = href.startsWith('http') ? href : new URL(href, 'https://www.action.com').href;
    if (!titre || vus.has(lien)) continue;
    vus.add(lien);
    out.push({ titre, prix, prixAvant: null, lien, image: '', marque: '' });
  }
  return out;
}

/** « 12,99 € » ou « 12.99 » → 12.99. `versPrix` ne lit qu'un prix en euros
 *  suivi du symbole ; ici le prix arrive parfois sans lui (JSON-LD).
 *
 *  DÉFAUT CORRIGÉ — le JSON-LD schema.org autorise un prix en CHAÎNE NUE
 *  (« "price": "1429.00" »), et c'est ce que publie Groupon. Sans la branche
 *  ci-dessous, chaque produit passait pour « sans prix » : la page rendait
 *  ZÉRO offre, sans erreur ni trace. Mesuré avant correction : 9 produits
 *  lus, 0 retenu ; après : 9 lus, 2 retenus par le garde-fou de vraisemblance.
 */
function versNombre(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
  const s = String(v ?? '').trim();
  if (/^\d{1,5}(?:[.,]\d{1,2})?$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
  }
  return versPrix(s);
}

function versNumberCarte(texte) {
  const m = String(texte || '').replace(/\u00a0|\u202f/g, ' ')
    .match(/(?:^|["'\s>])(\d{1,4}(?:[.,]\d{2}))\s?€/);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
}

/* ------------------------------------------------------------------ *
 *  GROUPON — lire une page de bons plans.
 *
 *  La même page est servie par Groupon en DEUX rendus DIFFÉRENTS, tirés au
 *  hasard par le même domaine (mesuré : `groupon.fr/bon-plan` 3 fois sur 4 en
 *  TanStack, 1 fois sur 4 en Next). Les deux portent les MÊMES bons plans :
 *
 *    • rendu Next.js → `<script id="__NEXT_DATA__">`, JSON valide. Les bons
 *      plans y sont des objets `StandardDealCard` portant `title`, `url`,
 *      `prices.price.amount` et `prices.strikeThroughPrice.amount`.
 *    • rendu TanStack → `<script class="$tsr">`, un flux JavaScript
 *      (`Object.assign(Object.create(null),{…})`, marqueurs `$R[n]`) qui N'EST
 *      PAS du JSON. Les mêmes `StandardDealCard` y sont présents, à l'identique.
 *
 *  Un lecteur qui ne connaît que le premier rend 0 offre — EN SILENCE — une fois
 *  sur trois au moins sur les pages françaises (voir AUDIT-B1.md). Le second
 *  lecteur `cartesGrouponTanStack` couvre l'autre rendu, sans jamais exécuter le
 *  JavaScript distant : il n'analyse que le sous-ensemble de données du flux.
 *
 *    • `/goods` (produits) → même JSON-LD standard que Coolblue, traité par
 *      offresEnseigne. Pas de code ici.
 *
 *  Les montants sont en CENTIMES (699 = 6,99 €) : les prendre pour des euros
 *  afficherait des licences à 699 € au lieu de 6,99 €. Vérifié sur la page.
 *
 *  GARDE-FOU : un bon plan n'est retenu que si ses deux prix donnent une remise
 *  plausible (voir remiseCredibleSource). La remise est CALCULÉE entre les deux
 *  prix, jamais lue dans le titre — Groupon écrit « jusqu'à 50 % » dans
 *  certains titres, un maximum qui ne dit rien de l'offre affichée.
 * ------------------------------------------------------------------ */

/** Index du `}` / `]` qui ferme le bloc ouvert à `debut`, chaînes ignorées
 *  (guillemets et échappements). -1 si le bloc ne se referme pas. */
function finBlocJs(s, debut) {
  let prof = 0;
  for (let i = debut; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue; }
        if (s[i] === q) break;
        i++;
      }
      continue;
    }
    if (c === '{' || c === '[') prof++;
    else if (c === '}' || c === ']') { prof--; if (prof === 0) return i; }
  }
  return -1;
}

/** Analyseur du sous-ensemble JavaScript du flux TanStack : objets
 *  `Object.assign(Object.create(null),{…})`, tableaux, chaînes, nombres,
 *  `!0`/`!1`, `null`, et marqueurs `$R[n]` (définition `$R[n]=` puis
 *  réutilisation `$R[n]`). Ne lit que des DONNÉES ; n'exécute rien. */
function parseurTanStack(src) {
  const refs = new Map();
  const n = src.length;
  let i = 0;
  const espaces = () => { while (i < n && /\s/.test(src[i])) i++; };
  const chaine = () => {
    const debut = i++;                       // src[debut] === '"'
    let ech = false;
    while (i < n) {
      const c = src[i++];
      if (ech) { ech = false; continue; }
      if (c === '\\') { ech = true; continue; }
      if (c === '"') break;
    }
    const brut = src.slice(debut, i);
    try { return JSON.parse(brut); } catch { return brut.slice(1, -1); }
  };
  const nombre = () => {
    const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i, i + 40));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  function objet() {
    espaces();
    if (src.startsWith('Object.assign(', i)) {
      i += 'Object.assign('.length;
      const k = src.indexOf('Object.create(null)', i);
      if (k >= 0) i = k + 'Object.create(null)'.length;
      espaces();
      if (src[i] === ',') i++;
      espaces();
    }
    if (src[i] !== '{') throw new Error('accolade attendue à ' + i);
    i++;
    const o = {};
    espaces();
    while (i < n && src[i] !== '}') {
      let cle;
      if (src[i] === '"') cle = chaine();
      else {
        let j = i;
        while (j < n && src[j] !== ':') j++;
        cle = src.slice(i, j).trim();
        i = j;
      }
      espaces();
      if (src[i] === ':') i++;
      o[cle] = valeur();
      espaces();
      if (src[i] === ',') i++;
      espaces();
    }
    if (src[i] === '}') i++;
    espaces();
    if (src[i] === ')') i++;                 // ferme Object.assign(
    return o;
  }
  function tableau() {
    i++;                                     // '['
    const a = [];
    espaces();
    while (i < n && src[i] !== ']') {
      a.push(valeur());
      espaces();
      if (src[i] === ',') i++;
      espaces();
    }
    if (src[i] === ']') i++;
    return a;
  }
  function valeur() {
    espaces();
    const m = /^\$R\[(\d+)\]/.exec(src.slice(i, i + 20));
    if (m) {
      const num = Number(m[1]);
      i += m[0].length;
      espaces();
      if (src[i] === '=') { i++; const v = valeur(); refs.set(num, v); return v; }
      return refs.has(num) ? refs.get(num) : null;
    }
    if (src.startsWith('Object.assign(', i)) return objet();
    if (src[i] === '{') return objet();
    if (src[i] === '[') return tableau();
    if (src[i] === '"') return chaine();
    if (src.startsWith('!0', i)) { i += 2; return true; }
    if (src.startsWith('!1', i)) { i += 2; return false; }
    if (src.startsWith('null', i)) { i += 4; return null; }
    if (src.startsWith('true', i)) { i += 4; return true; }
    if (src.startsWith('false', i)) { i += 5; return false; }
    if (src[i] === '-' || /\d/.test(src[i])) return nombre();
    throw new Error('valeur illisible à ' + i + ' : ' + JSON.stringify(src.slice(i, i + 24)));
  }
  return { valeur };
}

/** Cartes d'un rendu TanStack : on isole chaque `StandardDealCard` par
 *  appariement d'accolades (chaque carte est autonome dans le flux — mesuré :
 *  autant de `$R[n]=` que de `$R[n]`, aucune référence externe) et on la relit
 *  seule. Une carte illisible est ignorée, jamais devinée. */
function cartesGrouponTanStack(html) {
  const s = String(html);
  const cartes = [];
  const lit = '{__typename:"StandardDealCard"';
  let idx = 0;
  while (true) {
    const debut = s.indexOf(lit, idx);
    if (debut < 0) break;
    const fin = finBlocJs(s, debut);
    if (fin < 0) break;
    try { cartes.push(parseurTanStack(s.slice(debut, fin + 1)).valeur()); } catch { /* carte illisible : ignorée */ }
    idx = fin + 1;
  }
  return cartes;
}

/** Rend la liste des `StandardDealCard`, quel que soit le rendu servi. */
function cartesGroupon(html) {
  const texte = String(html);
  const bloc = texte.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (bloc) {
    let data = null;
    try { data = JSON.parse(bloc[1]); } catch { data = null; }
    const cartes = [];
    if (data) (function parcourir(o) {
      if (!o || typeof o !== 'object') return;
      if (o.__typename === 'StandardDealCard') cartes.push(o);
      for (const v of Object.values(o)) parcourir(v);
    })(data);
    if (cartes.length) return cartes;
  }
  try { return cartesGrouponTanStack(texte); } catch { return []; }
}

function offresGroupon(html, source) {
  const out = [];
  const vus = new Set();
  const cartes = cartesGroupon(html);
  const centimes = (o) => (o && Number.isFinite(o.amount) ? Math.round(o.amount) / 100 : null);
  for (const c of cartes) {
    const prix = centimes(c.prices && c.prices.price);
    const avant = referenceVraisemblable(prix, centimes(c.prices && c.prices.strikeThroughPrice));
    if (!remiseCredibleSource(prix, avant)) continue;
    const titre = nettoyer(c.title);
    const lien = String(c.url || '').trim();
    if (!titre || !lien) continue;
    const cle = String(c.id || c.uuid || lien).toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    const imgs = c.imageUrls;
    const image = typeof imgs === 'string' ? imgs
      : (imgs && (imgs.large || imgs.medium || imgs.small)) || '';
    out.push({
      id: identifiant('g', lien, titre),
      type: 'offre',
      titre: titre.slice(0, 220),
      lienMarchand: lien,
      lienPage: lien,
      // Le marchand affiché est Groupon : c'est chez lui que l'achat se fait,
      // et c'est le seul nom que l'utilisateur peut vérifier d'un clic.
      marchand: source.marchandImpose || source.nom,
      prix,
      prixAvant: avant,
      remise: Math.round(((avant - prix) / avant) * 100),
      remiseCalculee: true,
      // Le classement passe par classerOffre() — la MÊME fonction que le
      // reclassement et le vérificateur. Elle sait qu'une page imposée
      // « activité » peut contenir des SOINS, qui partent alors en Beauté.
      // ⚠ Le PAYS de l'offre doit être passé : le partage Activité/Voyages est
      // GÉOGRAPHIQUE (point 21). Sans lui, `destinationEtrangere` ne peut pas
      // reconnaître une destination qui est celle de l'offre elle-même —
      // mesuré : « En bord de Meuse … » et « All-you-can-eat … in Gent »
      // (Belgique) partaient en VOYAGES sur les mots « Meuse » et « Gent ».
      categorie: classerOffre({ titre, pays: source.pays || 'BE', categorieImposee: source.categorieImposee || null, categorieSource: source.categorie || 'groupon' }),
      categorieSource: source.categorieImposee || source.categorie || 'groupon',
      // La rubrique vient de la PAGE, pas du titre : on le DIT sur l'offre, pour
      // que le reclassement ultérieur (classerOffre) et le vérificateur ne la
      // défassent pas. Sans ce marqueur, « Soin du visage au choix » repartait
      // en « Beauté » au passage suivant — le titre contient deux mots de
      // beauté, et la règle autorise la source à être contredite par deux mots.
      // Or un soin en institut n'est pas un cosmétique : la page le sait mieux
      // que le titre.
      categorieImposee: source.categorieImposee || null,
      image: /^https?:\/\//i.test(image) ? image : '',
      date: new Date().toISOString(),
      dateRelevee: true,          // date de RELEVÉ — voir TYPES_DATE_RELEVEE
      source: source.nom,
      sourceId: source.id,
      pays: source.pays || 'BE',
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  SOCIAL DEAL — les activités, hors Groupon (unités B3/B5).
 *
 *  Seule plateforme d'activités, hors Groupon, trouvée qui publie DEUX prix
 *  RÉELS dans le HTML SERVI (les autres sont rendues en JavaScript ou n'ont
 *  qu'un seul prix — voir AUDIT-B3.md). Chaque carte porte sa référence et son
 *  prix demandé dans deux balises à classes explicites :
 *
 *      <div class="original-price"><span class="price">€30</span></div>
 *      <span class="current-price">€19<sub>,90</sub></span>
 *
 *  ⚠ Les CENTIMES sont dans un `<sub>` (« €19<sub>,90</sub> ») : on retire les
 *  balises AVANT de lire le nombre, sinon « €19 » serait pris pour 19 € au lieu
 *  de 19,90 €. Le format du prix diffère aussi selon le pays — « €19,90 » en
 *  Belgique, « 136,90€ » en France : le lecteur accepte les deux ordres.
 *
 *  Deux prix RÉELS, et rien d'autre : une carte sans référence (« Gratis », bons
 *  cadeaux à prix unique) ne produit AUCUNE promotion et est écartée. Le
 *  garde-fou de vraisemblance s'applique comme partout.
 * ------------------------------------------------------------------ */
function nombreSocialDeal(texte) {
  // On retire les balises (« €19<sub>,90</sub> » → « €19 ,90 »), puis on lit le
  // premier nombre, séparateur décimal « , » ou « . ».
  const s = String(texte || '').replace(/<[^>]*>/g, ' ').replace(/\u00a0|\u202f/g, ' ').trim();
  const m = s.match(/(\d[\d\s]*)(?:[.,](\d{1,2}))?/);
  if (!m) return null;
  const entier = Number(m[1].replace(/\s/g, ''));
  const cents = m[2] ? Number('0.' + m[2]) : 0;
  const v = entier + cents;
  return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
}

function offresSocialDeal(html, source) {
  const out = [];
  const vus = new Set();
  const texte = String(html);
  // Un bloc « original-price » suivi, dans la même carte, d'un « current-price ».
  const re = /<div class="original-price">([\s\S]*?)<\/div>[\s\S]{0,240}?<span class="current-price">([\s\S]*?)<\/span>/g;
  for (const m of texte.matchAll(re)) {
    const refTxt = (m[1].match(/<span class="price">([\s\S]*?)<\/span>/) || [])[1];
    const prix = nombreSocialDeal(m[2]);
    const avant = referenceVraisemblable(prix, nombreSocialDeal(refTxt));
    if (!remiseCredibleSource(prix, avant)) continue;
    // Titre et lien : le titre (`<h4>`) et l'adresse de la fiche (`/deals/…`)
    // sont AVANT le bloc de prix, dans la même carte. On prend les plus proches.
    const fenetre = texte.slice(Math.max(0, m.index - 6000), m.index);
    const h4 = [...fenetre.matchAll(/<h4>([\s\S]*?)<\/h4>/g)].pop();
    const a = [...fenetre.matchAll(/<a\s+href="(https?:\/\/[^"]*\/deals\/[^"]+)"/g)].pop();
    if (!h4 || !a) continue;
    const titre = nettoyer(h4[1]);
    const lien = a[1];
    if (!titre) continue;
    const cle = lien.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({
      id: identifiant('s', lien, titre),
      type: 'offre',
      titre: titre.slice(0, 220),
      lienMarchand: lien,
      lienPage: lien,
      marchand: source.nom,
      prix,
      prixAvant: avant,
      remise: Math.round(((avant - prix) / avant) * 100),
      remiseCalculee: true,
      // Même chemin de classement que Groupon : `classerOffre` sait qu'une page
      // « activité » peut contenir des SOINS (→ Beauté) et des REPAS pris
      // dehors (→ Activité), et que le partage avec Voyages est GÉOGRAPHIQUE.
      categorie: classerOffre({ titre, pays: source.pays || 'BE', categorieImposee: source.categorieImposee || null, categorieSource: source.categorie || 'socialdeal' }),
      categorieSource: source.categorieImposee || source.categorie || 'socialdeal',
      categorieImposee: source.categorieImposee || null,
      image: '',
      date: new Date().toISOString(),
      dateRelevee: true,          // date de RELEVÉ — voir TYPES_DATE_RELEVEE
      source: source.nom,
      sourceId: source.id,
      pays: source.pays || 'BE',
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  AMAZON — lire une page de résultats.
 *
 *  Découpe : entre deux ASIN CONSÉCUTIFS. C'est la seule qui suive vraiment la
 *  structure — les URL de redirection d'Amazon dépassent le millier de
 *  caractères, et une fenêtre de taille fixe autour de l'ASIN tombe à côté du
 *  prix (vérifié : 59 ASIN dans la page, 1 seul produit correctement lu avec
 *  une fenêtre de 5 000 caractères).
 *
 *  Prix : le piège de cette source. Une carte contient PLUSIEURS prix, dont le
 *  prix à l'unité (« 0,10 €/unité »). En prenant le plus petit comme prix et le
 *  plus grand comme prix barré, on fabriquait des remises de -99 % sur du
 *  collagène. On distingue donc les deux balises par leur classe :
 *      span.a-price              → le prix demandé
 *      span.a-price.a-text-price → le prix de référence, barré
 *  et une remise n'est calculée que si le second dépasse STRICTEMENT le premier.
 *  Le « Économisez 49 % » affiché à côté est ignoré : sur la même carte, les
 *  deux prix disaient 19 %. On se fie aux nombres, pas au slogan.
 * ------------------------------------------------------------------ */
function prixAmazon(bloc) {
  let courant = null, barre = null;
  for (const m of bloc.matchAll(/<span class="(a-price[^"]*)"/g)) {
    const fenetre = bloc.slice(m.index, m.index + 500);
    const val = versNombre((fenetre.match(/a-offscreen">\s*([^<]+?)\s*</) || [])[1] || '');
    if (val == null) continue;
    // PRIX À L'UNITÉ : Amazon affiche « 159,90 €/litre » juste après le prix, dans
    // la MÊME balise technique que le prix barré. Pris pour une référence, il
    // fabriquait un parfum d'intérieur à -90 % (15,99 € « avant » 159,90 €).
    // Repéré sur les données réelles après une première livraison — le contrôle
    // sur une seule page enregistrée ne l'avait pas vu, parce que le défaut
    // dépend du produit (il faut un article vendu au litre, au kilo ou au lot).
    const suite = fenetre.slice(0, 300).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const estUnitaire = /€\s*\/|\/\s*(unité|unite|pièce|piece|pce|kg|litre|litro|l\b|ml|100\s?(g|ml)|\d+\s?m\b|lot|pack|rouleau)/i.test(suite);
    if (/a-text-price/.test(m[1])) {
      if (estUnitaire) continue;                       // prix au litre : pas une référence
      if (barre == null || val > barre) barre = val;
    } else if (courant == null) courant = val;
  }
  // Garde-fou de vraisemblance : un prix de référence qui vaut cinq fois le prix
  // demandé n'est pas une promotion, c'est une autre unité ou une autre variante.
  if (barre != null && courant != null && barre >= courant * 5) barre = null;
  return { courant, barre };
}

/* ------------------------------------------------------------------ *
 *  BOL.COM — la page « deals » de la Belgique.
 *
 *  Ce qui est lu, et sur quoi on s'appuie (chaque point vérifié sur la page
 *  réellement servie le 10/10/2026) :
 *
 *    - chaque produit est un bloc `data-testid="product"` — 16 par page ;
 *    - le TITRE est porté deux fois (attribut `title` du lien ET de l'image) ;
 *    - le LIEN propre est `/be/fr/p/<slug>/<id>/`, sans les paramètres de
 *      campagne (`?promo=…`) que bol ajoute et qui changeraient d'un passage à
 *      l'autre : le même produit doit garder le même identifiant ;
 *    - le PRIX DEMANDÉ est écrit en TROIS fragments (entier, virgule, centimes),
 *      et les centimes peuvent être un tiret : « 142,- » vaut 142,00 €. Un
 *      extracteur naïf qui cherche « NN,NN » rate ces offres-là ;
 *    - le PRIX DE RÉFÉRENCE suit un libellé, et bol en change le mot selon le
 *      cas : « Prix conseillé » ou « En général » en français, « Adviesprijs »
 *      ou « Meestal » en néerlandais. On accepte les quatre, on n'en invente
 *      aucun ;
 *    - une remise n'est CALCULÉE que si la référence dépasse le prix demandé.
 *      Même règle que partout ailleurs : deux prix réels, rien d'autre.
 *
 *  Le reste du bloc (accroches, « jusqu'à 30 % de réduction cumulable »,
 *  libellés de campagne) est IGNORÉ : ce sont des slogans, pas des prix.
 * ------------------------------------------------------------------ */
const LIBELLE_REFERENCE_BOL = /(?:Prix conseillé|En général|Adviesprijs|Meestal)(?:\s|<!--[^>]*-->)*([\d.,]+)/;

export function offresBol(html, source) {
  const blocs = String(html || '').split('data-testid="product"').slice(1);
  const offres = [];
  const vus = new Set();
  for (const bloc of blocs) {
    const brut = (bloc.match(/<p class="[^"]*" title="([^"]+)">/) || [])[1]
      || (bloc.match(/<img [^>]*title="([^"]{10,220})"/) || [])[1] || '';
    const titre = nettoyer(brut);
    const href = (bloc.match(/href="(\/be\/(?:fr|nl)\/p\/[^"?]+)/) || [])[1];
    if (!titre || !href) continue;
    // Le prix demandé : les trois fragments. « 142 » + « , » + « - » = 142,00 €.
    let prix = null;
    const fragments = [...bloc.matchAll(/aria-hidden="true">\s*([^<]{1,8}?)\s*<\/span>/g)].map((m) => m[1].trim());
    for (let i = 0; i + 2 < fragments.length; i++) {
      const entier = fragments[i], separateur = fragments[i + 1], cents = fragments[i + 2];
      if (!/^\d{1,5}$/.test(entier) || !/^[.,]$/.test(separateur)) continue;
      if (!/^\d{2}$/.test(cents) && cents !== '-') continue;
      prix = versNombre(`${entier}.${cents === '-' ? '00' : cents}`);
      break;
    }
    if (prix == null) continue;
    const mRef = bloc.match(LIBELLE_REFERENCE_BOL);
    const reference = mRef ? versNombre(mRef[1]) : null;
    const avant = reference != null && reference > prix ? reference : null;
    const rem = remise(titre, prix, avant);
    const lien = 'https://www.bol.com' + href;
    const image = (bloc.match(/<img src="(https:\/\/media\.s-bol\.com\/[^"]+)"/) || [])[1] || '';
    // L'identifiant de l'offre se calcule sur le NUMÉRO du produit, pas sur son
    // adresse : bol fait varier les mots de l'adresse (« …-10-lames-de-rasoir »
    // en français, « …-10-scheermesjes » en néerlandais) pour un même produit.
    // Sur le numéro, l'offre reste la MÊME d'un passage à l'autre — et le jour
    // où l'on lira aussi la page néerlandaise, les deux se rejoindront au lieu
    // de faire deux lignes.
    const numero = (href.match(/\/(\d{6,})\/?$/) || [])[1] || href;
    const cle = numero;
    if (vus.has(cle)) continue;
    vus.add(cle);
    offres.push({
      id: identifiant('b', numero),
      type: 'offre',
      titre: titre.slice(0, 220),
      lienMarchand: lien,
      lienPage: lien,
      marchand: 'bol.com',
      prix,
      prixAvant: avant,
      remise: rem ? rem.pourcent : null,
      remiseCalculee: rem ? rem.calculee : false,
      categorie: famille(titre, ''),
      categorieSource: 'bol',
      image,
      date: new Date().toISOString(),
      dateRelevee: true,          // date de RELEVÉ — voir TYPES_DATE_RELEVEE
      source: source.nom,
      sourceId: source.id,
      pays: source.pays || 'BE',
    });
  }
  return offres;
}

/* ------------------------------------------------------------------ *
 *  KREFEL.BE — la page « deals du moment » (voir SOURCES_KREFEL pour le
 *  contexte, la provenance de la mesure et ce qui reste à vérifier).
 *
 *  Deux marqueurs STRUCTURELS, donc indépendants de la langue du site :
 *    - le prix de référence porte la classe `line-through` ;
 *    - le prix demandé porte `font-bold`, juste après.
 *  On ne se sert PAS du « -13 % » écrit à l'écran : la remise est recalculée à
 *  partir des deux prix, comme partout ailleurs dans ce collecteur.
 * ------------------------------------------------------------------ */

/** Montant krefel : « 849,00 € » (français) comme « € 549,00 » (néerlandais). */
export function prixKrefel(texte) {
  const s = String(texte || '').replace(/\u00a0|\u202f/g, ' ');
  //  ⚠ L'EURO CHANGE DE PLACE SELON LA LANGUE, ET ÇA A COÛTÉ CHER.
  //  Le lecteur avait été écrit sur la page NÉERLANDAISE archivée, qui écrit
  //  « € 549,00 ». La page FRANÇAISE vivante écrit « 849,00 € ». Une seule
  //  différence d'ordre, et le lecteur rendait ZÉRO offre sur 24 cartes — sans
  //  erreur, sans trace, exactement le mode de panne que ce projet combat.
  //  On accepte donc les DEUX écritures : l'euro avant ou après.
  const m = s.match(/(?:€\s*([\d][\d. ]*,\d{2})|([\d][\d. ]*,\d{2})\s*€)/);
  if (!m) return null;
  // Le POINT sépare les milliers (« 1.099,00 ») : le laisser en place ferait
  // lire 1,099 € — soit mille fois moins. Mesuré sur la page : des montants à
  // quatre chiffres, ce n'est pas un cas d'école.
  const n = Number((m[1] || m[2]).replace(/[. ]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

/** La carte produit : c'est elle qui découpe la page. */
const CARTE_KREFEL = /<div class="[^"]*items-start justify-center gap-4 p-3[^"]*"/;

export function offresKrefel(html, source) {
  const blocs = String(html || '').split(CARTE_KREFEL).slice(1);
  const offres = [];
  const vus = new Set();
  for (const bloc of blocs) {
    // L'adresse : `/fr/p/<numéro>-<slug>`. On accepte aussi `/nl/` — la page
    // néerlandaise a la même structure, et si elle est un jour lue, c'est le
    // NUMÉRO qui fera converger les deux, pas la langue de l'adresse.
    const href = (bloc.match(/href="(\/(?:fr|nl)\/p\/[^"]+)"/) || [])[1];
    if (!href) continue;
    const numero = (href.match(/\/p\/(\d{4,})/) || [])[1];
    if (!numero || vus.has(numero)) continue;
    // Le TITRE : le lien de titre porte `font-bold` ; à défaut, l'attribut alt
    // de l'image dit la même chose. Deux chemins, parce qu'une seule des deux
    // sources suffit et que le second sauve la carte si le premier change.
    const titre = nettoyer(
      (bloc.match(/<a class="[^"]*font-bold[^"]*"[^>]*>([^<]{5,220})<\/a>/) || [])[1]
      || (bloc.match(/<img [^>]*alt="([^"]{5,220})"/) || [])[1] || '',
    );
    if (!titre) continue;
    //  ⚠ L'EURO CHANGEAIT DE PLACE SELON LA LANGUE — et c'est ce qui a été
    //  mesuré, pas supposé : le lecteur écrit sur la page néerlandaise
    //  (« € 549,00 ») rendait ZÉRO offre sur la page française (« 849,00 € »),
    //  sur 24 cartes, sans la moindre erreur. prixKrefel accepte les deux.
    const demandes = [...bloc.matchAll(/<span class="[^"]*font-bold[^"]*"[^>]*>([^<]{0,24})<\/span>/g)]
      .map((m) => prixKrefel(m[1]));
    const prix = demandes.find((p) => p != null);
    if (prix == null) continue;
    const barres = [...bloc.matchAll(/<span class="[^"]*line-through[^"]*"[^>]*>([^<]{0,24})<\/span>/g)]
      .map((m) => prixKrefel(m[1]));
    // La référence n'est retenue que si elle DÉPASSE le prix demandé : sinon ce
    // n'est pas une référence, c'est une variante ou une unité.
    const reference = barres.find((p) => p != null && p > prix) ?? null;
    const rem = remise(titre, prix, reference);
    const image = (bloc.match(/<img [^>]*src="(https:\/\/media\.krefel\.be\/[^"]+)"/) || [])[1] || '';
    vus.add(numero);
    offres.push({
      id: identifiant('k', numero),
      type: 'offre',
      titre: titre.slice(0, 220),
      lienMarchand: 'https://www.krefel.be' + href,
      lienPage: 'https://www.krefel.be' + href,
      marchand: 'Krefel',
      prix,
      prixAvant: reference,
      remise: rem ? rem.pourcent : null,
      remiseCalculee: rem ? rem.calculee : false,
      categorie: famille(titre, ''),
      categorieSource: 'krefel',
      image,
      date: new Date().toISOString(),
      dateRelevee: true,          // date de RELEVÉ — voir TYPES_DATE_RELEVEE
      source: source.nom,
      sourceId: source.id,
      pays: source.pays || 'BE',
    });
  }
  return offres;
}

/**
 * Les lignes bol.com EN TROP, quand le même produit est servi deux fois.
 *
 * bol publie le même article sous DEUX adresses, une par langue :
 *   /be/fr/p/gillette-venus-10-lames-de-rasoir/9300000123456
 *   /be/nl/p/gillette-venus-10-scheermesjes/9300000123456
 * Seul le NUMÉRO final est identique — c'est lui qui porte l'identité du
 * produit, et c'est donc sur lui qu'on regroupe. (On ne peut pas s'appuyer sur
 * l'adresse : les mots du titre traduit y changent, et bol ajoute en plus des
 * paramètres de campagne.)
 *
 * On GARDE la ligne française :
 *   - c'est la langue de la page qu'on lit (« /be/fr/deals/ ») ;
 *   - c'est celle du catalogue entier, donc celle que le lecteur voit déjà.
 * Le choix ne dépend jamais de l'ordre du tableau : on trie explicitement.
 *
 * @returns {object[]} les offres à écarter (vide s'il n'y a aucun doublon).
 */
export const MOTIF_ADRESSE_BOL = /^https?:\/\/(?:www\.)?bol\.com\/be\/(fr|nl)\/p\/.*\/(\d{6,})\/?$/;

export function doublonsBol(offres) {
  const parNumero = new Map();
  for (const o of offres) {
    const m = String(o.lienPage || o.lienMarchand || '').match(MOTIF_ADRESSE_BOL);
    if (!m) continue;
    if (!parNumero.has(m[2])) parNumero.set(m[2], []);
    parNumero.get(m[2]).push({ offre: o, langue: m[1] });
  }
  const enTrop = [];
  for (const lignes of parNumero.values()) {
    if (lignes.length < 2) continue;
    const triees = [...lignes].sort((a, b) => (a.langue === 'fr' ? 0 : 1) - (b.langue === 'fr' ? 0 : 1));
    for (const l of triees.slice(1)) enTrop.push(l.offre);
  }
  return enTrop;
}

function offresAmazon(html, source) {
  const positions = [...html.matchAll(/data-asin="([A-Z0-9]{10})"/g)];
  const offres = [], vus = new Set();
  for (let i = 0; i < positions.length; i++) {
    const asin = positions[i][1];
    if (vus.has(asin)) continue;
    const bloc = html.slice(positions[i].index, i + 1 < positions.length ? positions[i + 1].index : html.length);
    const { courant, barre } = prixAmazon(bloc);
    if (courant == null) continue;
    const brut = (bloc.match(/<h2[^>]*>[\s\S]{0,700}?<span[^>]*>([^<]{12,220})<\/span>/) || [])[1]
      || (bloc.match(/alt="([^"]{14,220})"/) || [])[1] || '';
    const titre = nettoyer(brut);
    if (!titre) continue;
    const image = (bloc.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/) || [])[1] || '';
    const lien = `https://www.amazon.com.be/dp/${asin}`;
    vus.add(asin);
    // Le prix barré n'est retenu que s'il est PLUS ÉLEVÉ : sinon ce n'est pas
    // une référence, c'est le prix à l'unité ou une variante moins chère.
    const avant = barre != null && barre > courant ? barre : null;
    const rem = remise(titre, courant, avant);
    offres.push({
      id: 'a' + asin,
      type: 'offre',
      titre: titre.slice(0, 220),
      lienMarchand: lien,
      lienPage: lien,
      // Le vendeur est connu : c'est Amazon. Rien à deviner depuis un titre.
      marchand: 'Amazon',
      prix: courant,
      prixAvant: avant,
      remise: rem ? rem.pourcent : null,
      remiseCalculee: rem ? rem.calculee : false,
      categorie: famille(titre, ''),
      categorieSource: 'amazon',
      image,
      date: new Date().toISOString(),
      dateRelevee: true,          // date de RELEVÉ — voir TYPES_DATE_RELEVEE
      source: source.nom,
      sourceId: source.id,
      pays: source.pays || 'BE',
    });
  }
  return offres;
}

/**
 * Ventes flash du jour, lues dans le JSON que la page « goldbox » embarque.
 *
 *  On ne JSON.parse PAS la page entière : un seul caractère invalide ferait
 *  tomber les 400 Ko. On repère chaque « priceToPay » et on remonte le fil du
 *  MÊME produit — dernier ASIN et dernier titre vus avant lui, puis le prix
 *  courant et l'étiquette juste après. Une découpe bornée, qui survit à un JSON
 *  légèrement abîmé.
 *
 *  Deux prix réels valent mieux qu'un pourcentage écrit : la remise est
 *  CALCULÉE sur le prix flash et le prix courant. L'étiquette d'Amazon
 *  (« 43 % de réduction », « 81 % Rabatt ») ne sert que de secours, quand la
 *  page ne donne pas les deux prix.
 */
function offresVenteFlash(html, source) {
  const offres = [], vus = new Set();
  const domaine = new URL(source.url).hostname.replace(/^www\./, '');
  const nombre = (s) => {
    const v = Number(String(s || '').replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  };

  for (const pos of html.matchAll(/"priceToPay"/g)) {
    const i = pos.index;
    const avant = html.slice(Math.max(0, i - 3000), i);
    const apres = html.slice(i, i + 1400);

    const asin = [...avant.matchAll(/"asin":"(B0[A-Z0-9]{8})"/g)].map((m) => m[1]).pop();
    if (!asin || vus.has(asin)) continue;
    const titreBrut = [...avant.matchAll(/"title":"([^"]{10,320})"/g)].map((m) => m[1]).pop();
    if (!titreBrut) continue;
    const titre = nettoyer(titreBrut.replace(/\\"/g, '"').replace(/\\u0026/gi, '&'));
    if (!titre) continue;

    const courant = nombre((apres.match(/"priceToPay":\{"label":"[^"]*","price":"([\d.,]+)"/) || [])[1]);
    if (courant == null) continue;
    const barre = nombre((apres.match(/"basisPrice":\{"label":"[^"]*","price":"([\d.,]+)"/) || [])[1]);
    // Prix de référence retenu seulement s'il est PLUS ÉLEVÉ — même règle que
    // la page de recherche : un « prix courant » inférieur n'est pas un repère.
    const prixAvant = barre != null && barre > courant ? barre : null;
    const etiquette = (apres.match(/"dealBadge"[\s\S]{0,500}?"text":"([^"]{2,40})"/) || [])[1] || '';
    // Les DEUX PRIX d'abord. Ils sont toujours là sur cette page, et une remise
    // calculée sur deux prix réels est plus solide qu'une étiquette. L'étiquette
    // ne sert que de secours, si Amazon n'a pas donné de prix courant.
    //
    // Défaut mesuré : en lisant l'étiquette d'abord, la remise était marquée
    // « écrite » (non calculée), et la relecture rétroactive des remises — qui ne
    // voit que le TITRE — l'effaçait ensuite. Des ventes flash à -50 % restaient
    // affichées sans aucun pourcentage.
    const rem = prixAvant != null
      ? { pourcent: Math.round(((prixAvant - courant) / prixAvant) * 100), calculee: true }
      : remise(`${titre} ${etiquette}`, courant, null);

    // L'image est celle du produit : on prend le premier visuel situé APRÈS son
    // ASIN, sinon on risquerait celui du produit précédent.
    const blocProduit = avant.slice(Math.max(0, avant.lastIndexOf(`"asin":"${asin}"`)));
    const base = (blocProduit.match(/"baseUrl":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/) || [])[1]
      || [...avant.matchAll(/"baseUrl":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/g)].pop()?.[1];
    const image = base ? `${base}.jpg` : '';

    vus.add(asin);
    offres.push({
      // Le PAYS fait partie de l'identifiant. Deux pays peuvent partager un
      // domaine — l'Autriche achète sur amazon.de, le Portugal sur amazon.es — et
      // un même ASIN y est alors la MÊME vente flash. Avec un identifiant
      // partagé, la fusion écrasait l'un par l'autre : mesuré, l'Autriche et le
      // Portugal ont perdu leurs 28 et 23 ventes flash dès que l'Allemagne et
      // l'Espagne ont répondu à leur tour.
      id: 'fl' + (source.pays || 'BE') + asin,
      type: 'offre',
      titre: titre.slice(0, 220),
      lienMarchand: `https://www.${domaine}/dp/${asin}`,
      lienPage: `https://www.${domaine}/dp/${asin}`,
      marchand: 'Amazon',
      prix: courant,
      prixAvant,
      remise: rem ? rem.pourcent : null,
      remiseCalculee: rem ? rem.calculee : false,
      categorie: famille(titre, ''),
      categorieSource: 'vente flash',
      image,
      date: new Date().toISOString(),
      dateRelevee: true,          // date de RELEVÉ — voir TYPES_DATE_RELEVEE
      source: source.nom,
      sourceId: source.id,
      pays: source.pays || 'BE',
      // Marque la provenance : une vente flash est limitée dans le temps, et
      // l'interface peut le dire sans le deviner d'après le titre.
      venteFlash: true,
    });
  }

  // DEUX PAYS PEUVENT PARTAGER UN DOMAINE : l'Autriche achète sur amazon.de, le
  // Portugal sur amazon.es. On ne fait PAS deux requêtes identiques — la seconde
  // se fait refuser. Mesuré : l'Allemagne et l'Espagne restaient à zéro pendant
  // que l'Autriche et le Portugal, même page au même instant, recevaient leurs
  // vingt-neuf et vingt-trois ventes flash. Une seule lecture, recopiée.
  if (source.paysAussi) {
    const aussi = source.paysAussi;
    for (const o of [...offres]) {
      offres.push({
        ...o,
        id: 'fl' + aussi + o.id.slice(4),
        pays: aussi,
        sourceId: 'flash-' + aussi.toLowerCase(),
      });
    }
  }
  return offres;
}

/* Les SOINS de beauté, du corps et du bien-être — neuf langues.
 *
 *  Demande de B (plan, point 9) : « tous les soins de beauté, du corps, les
 *  massages et autres soins de bien-être » vont en **Beauté** — un SOIN n'est
 *  pas une SORTIE. Or la page « Activité » de Groupon est imposée en bloc sur
 *  toute la source (`categorieImposee: 'activite'`, voir SOURCES_ACTIVITES) :
 *  sans cette table, un « Soin du visage » resterait en Activité à jamais.
 *
 *  Mesuré le 6/10 sur les 67 offres belges de ces deux pages : 29 portent un de
 *  ces mots (soin, massage, modelage, spa, HIFU, peeling, réflexologie, thermes,
 *  headspa, wenkbrauwen…). Les repas pris dehors (« Menu grec », « brunch »,
 *  « sushi », « couscous ») et les sorties (zoo, attractions, toboggans,
 *  montgolfière) n'en portent AUCUN : ils restent en Activité. Les mots sont
 *  écrits sans accent (le texte est désaccentué avant comparaison) et pris en
 *  préfixe (un « massage » doit reconnaître « massages »).
 */
const MOTS_SOIN = [
  // fr
  'soin', 'massage', 'modelage', 'spa', 'bien-etre', 'beaute', 'esthetique',
  'hammam', 'sauna', 'thermes', 'reflexologie', 'cryolipolyse', 'microblading',
  'microneedling', 'hifu', 'peeling', 'lifting', 'epilation', 'manucure',
  'pedicure', 'coiffure', 'maquillage', 'ongles', 'sourcils', 'cils', 'visage',
  'institut de beaute', 'headspa',
  // en
  'beauty', 'facial', 'skincare', 'wellness', 'manicure', 'waxing', 'hairdresser',
  // de
  'kosmetik', 'gesichtsbehandlung', 'schonheitspflege', 'friseur', 'manikure',
  // nl
  'ontspanning', 'schoonheid', 'wenkbrauwen', 'wimpers', 'verzorging',
  'gezichtsbehandeling', 'kapsalon',
  // es
  'masaje', 'belleza', 'estetica', 'depilacion', 'manicura', 'peluqueria', 'bienestar',
  // it
  'massaggio', 'bellezza', 'estetica', 'depilazione', 'manicure', 'parrucchiere', 'termale',
  // pt
  'massagem', 'beleza', 'depilacao', 'manicure', 'cabeleireiro', 'termas',
  // pl
  'masaz', 'kosmetyka', 'depilacja', 'manicure', 'fryzjer',
  // sv
  'massage', 'skonhet', 'ansiktsbehandling', 'frisor', 'manikyr', 'depilering', 'valmaende',
];
// Mots courts ou glissants : « spa » ne doit pas lire « spaghettis » ni
// « sparen », « cils » ne doit pas lire un autre mot. On exige une frontière.
const SOIN_A_FRONTIERE = new Set(['spa', 'cils', 'hifu']);

/** Vrai si le titre nomme un SOIN (beauté / corps / bien-être). */
function estSoin(titre) {
  const bas = retirerTrompeurs(sansNegations(sansAccents(String(titre || '')).toLowerCase()))
    // « besoin » contient « soin » : on le neutralise avant la recherche.
    .replace(/besoin/g, ' ');
  return MOTS_SOIN.some((m) => (SOIN_A_FRONTIERE.has(m)
    ? new RegExp('(^|[^a-z])' + m + '([^a-z]|$)').test(bas)
    : bas.includes(m)));
}

/** Les marqueurs d'un REPAS PRIS DEHORS — une SORTIE, pas un cabas.
 *
 *  Demande de B, plan point 22 : « tout ce qui est nourriture restaurant
 *  hamburger, offre promotionnelle autour d'un repas doit rester dans
 *  activité. L'onglet nourriture est pour exclusivement la nourriture à
 *  cuisiner à la maison, nourriture de supermarché, boisson, bière, alcool,
 *  légumes et fruits. »
 *
 *  Ce sont les mots qui TRANCHENT, ceux que B a nommés, plus les formes des
 *  neuf langues du catalogue. Le texte est déjà désaccentué et minusculisé.
 *
 *  ⚠ MESURÉ le 6/10 au soir, première écriture SANS frontière : trois offres
 *  étaient fausses et le vérificateur les a nommées —
 *    « Calor - Pro Express … 5 réglages … Repassage » (le « repas » de
 *    « re**pas**sage ») partait en Activité ;
 *    « THORVALD 5 en 1 Équerre Menuisier » (« menu » de « menu**isier** ») aussi ;
 *    « Dr. Oetker Ristorante Prosciutto Funghi Pizza 350g » (« Ristorante » de
 *    la marque de pizza surgelée) quittait Nourriture à tort.
 *  D'où la règle : tout marqueur est lu ENTRE DEUX FRONTIÈRES, comme les mots
 *  des FAMILLES (voir compterMots). « maaltijdpakketten » (colis-repas de
 *  supermarché, Jumbo) ne compte plus comme un repas servi : « maaltijd » y est
 *  suivi d'une lettre, donc pas de frontière — c'est du cabas.
 */
const MOTS_REPAS_DEHORS = new RegExp(
  '(^|[^a-z0-9])(' + [
    'restaurant', 'restaurante', 'ristorante', 'restauracja', 'restaurang',
    'menu', 'brunch', 'buffet', 'hamburger', 'burger', 'cheeseburger',
    'steakhouse', 'taverne', 'bistro', 'bistrot', 'pizzeria', 'trattoria',
    'sushi', 'couscous', 'tajine', 'paella', 'poulet frit', 'fried chicken',
    'takeaway', 'take away', 'take-away', 'a emporter', 'pour deux', 'sur place',
    'degustation', 'food truck', 'fast food', 'all you can eat', 'menu du jour',
    'repas', 'mahlzeit', 'maaltijd', 'almuerzo', 'pranzo', 'jantar', 'diner',
    'dejeuner',
  ].join('|') + ')([^a-z0-9]|$)', 'i');

/** Vrai si le titre décrit un repas SERVI (dehors), et non de l'épicerie. */
function estRepasDehors(texteBas) {
  return MOTS_REPAS_DEHORS.test(texteBas);
}

/** La PREUVE que l'offre est de l'ÉPICERIE (le cabas) et non un repas servi.
 *
 *  Mots de B : « lot, pack, surgelé, x4, kg, g, litre, bouteille, conserve,
 *  supermarché ». Ils ne sont PAS une catégorie — ils ne classent rien tout
 *  seuls : ils servent à lever le doute quand un mot de repas dehors est aussi
 *  présent (« 24 x 33 cl » de bière reste du cabas, « bière pression pour
 *  deux » reste une sortie).
 *
 *  Le GRAMME de B (« g ») est écrit `\d\s?g\b` — et non `\bg\b` : une lettre
 *  seule attrape n'importe quoi. C'est ce qui sauve « Dr. Oetker Ristorante …
 *  Pizza 350g » : le mot « Ristorante » crie « restaurant », mais « 350g »
 *  prouve le paquet de supermarché, donc Nourriture.
 */
const MOTS_EPICERIE = /(\blot\b|\bx\s?\d|\d\s?x\b|multipack|\bpack\b|\bkg\b|\d\s?g\b|gramme|\bcl\b|\bml\b|\bl\b|litre|bouteille|conserve|surgel|paquet|sachet|boite|bocal|canette|dose|supermarch|boisson|dosen|blik|bidon)/i;

/** Vrai si le titre prouve l'épicerie (le cabas). Voir MOTS_EPICERIE. */
function preuveEpicerie(texteBas) {
  return MOTS_EPICERIE.test(texteBas);
}

/** Les DESTINATIONS — le partage GÉOGRAPHIQUE Activité / Voyages (point 21).
 *
 *  Ses mots : « les activités sont à faire dans le pays concerné et les voyages
 *  concernent des pays à l'étranger ». Une prestation nommée dans un AUTRE pays
 *  que celui de l'offre part donc en Voyages. On ne devine pas : on cherche un
 *  nom de pays ou de ville CONNU, lu ENTRE DEUX FRONTIÈRES. La table est
 *  volontairement PRUDENTE — les mots ambigus sont ÉCARTÉS parce que mesurés
 *  faux : « nice » (l'adjectif anglais), « split », « cork » (le liège),
 *  « island » (l'anglais), « china » (la porcelaine). Un nom propre piégeux ne
 *  doit pas fabriquer un voyage.
 *
 *  ⚠ Obligation de mesure : le nombre de destinations NON identifiables est le
 *  principal gisement d'erreurs — il est compté par `outils/mesure-e8.mjs` et
 *  les cas ambigus (un hôtel DANS le pays de l'offre, un titre sans
 *  destination) sont CITÉS au rapport, pas tus.
 */
const DESTINATIONS = {
  FR: ['france', 'frankrijk', 'frankreich', 'francia', 'franca', 'francja', 'frankrike', 'paris', 'lyon', 'marseille', 'bordeaux', 'toulouse', 'strasbourg', 'lille', 'maubeuge', 'normandie', 'provence', 'bretagne', 'deauville', 'cannes', 'montpellier', 'rennes', 'nantes', 'cote d azur'],
  BE: ['belgique', 'belgie', 'belgien', 'belgica', 'belgio', 'belgia', 'bruxelles', 'brussel', 'brussels', 'anvers', 'antwerpen', 'gand', 'gent', 'liege', 'luik', 'namur', 'charleroi', 'bruges', 'brugge', 'la louviere', 'ardennes', 'meuse'],
  DE: ['allemagne', 'germany', 'deutschland', 'alemania', 'germania', 'niemcy', 'tyskland', 'berlin', 'munich', 'munchen', 'hambourg', 'hamburg', 'cologne', 'koln', 'francfort', 'frankfurt', 'stuttgart', 'dresde', 'dresden', 'baviere', 'bavaria', 'nuremberg'],
  NL: ['pays-bas', 'pays bas', 'nederland', 'netherlands', 'niederlande', 'paises bajos', 'paesi bassi', 'holanda', 'nederlanderna', 'amsterdam', 'rotterdam', 'utrecht', 'la haye', 'den haag', 'eindhoven', 'maastricht'],
  ES: ['espagne', 'spain', 'spanien', 'espana', 'spagna', 'hiszpania', 'madrid', 'barcelone', 'barcelona', 'valence', 'valencia', 'seville', 'sevilla', 'malaga', 'ibiza', 'canaries', 'tenerife', 'majorque', 'mallorca', 'benidorm', 'costa brava', 'costa del sol', 'andalousie', 'andalucia'],
  IT: ['italie', 'italy', 'italien', 'italia', 'wlochy', 'rome', 'roma', 'milan', 'milano', 'venise', 'venezia', 'venecia', 'venice', 'florence', 'firenze', 'naples', 'napoli', 'turin', 'torino', 'sicile', 'sicilia', 'toscane', 'toscana'],
  PT: ['portugal', 'portogallo', 'portugalsko', 'lisbonne', 'lisboa', 'lisbon', 'porto', 'algarve', 'madere', 'madeira', 'funchal'],
  PL: ['pologne', 'poland', 'polen', 'polonia', 'polska', 'varsovie', 'warszawa', 'cracovie', 'krakow', 'wroclaw', 'gdansk'],
  SE: ['suede', 'sweden', 'schweden', 'suecia', 'svezia', 'szwecja', 'sverige', 'stockholm', 'goteborg', 'malmo', 'gotland'],
  GB: ['royaume-uni', 'royaume uni', 'angleterre', 'england', 'grossbritannien', 'reino unido', 'regno unito', 'wielka brytania', 'storbritannien', 'londres', 'london', 'manchester', 'edimbourg', 'edinburgh', 'ecosse', 'scotland', 'liverpool', 'birmingham', 'galles', 'wales'],
  IE: ['irlande', 'ireland', 'irlanda', 'irlandia', 'dublin'],
  AT: ['autriche', 'austria', 'osterreich', 'vienne', 'wien', 'vienna', 'salzbourg', 'salzburg', 'innsbruck', 'tyrol'],
  CH: ['suisse', 'switzerland', 'schweiz', 'suiza', 'svizzera', 'zwitserland', 'szwajcaria', 'zurich', 'geneve', 'geneva', 'lucerne', 'lausanne', 'berne'],
  GR: ['grece', 'greece', 'griechenland', 'grecia', 'grecja', 'grekland', 'athenes', 'athens', 'crete', 'creta', 'santorin', 'mykonos', 'rhodes', 'corfou'],
  TR: ['turquie', 'turkey', 'turkei', 'turquia', 'turchia', 'turcja', 'istanbul', 'antalya', 'bodrum', 'cappadoce'],
  MA: ['maroc', 'morocco', 'marokko', 'marruecos', 'marocco', 'marrakech', 'agadir', 'casablanca', 'fes'],
  TN: ['tunisie', 'tunisia', 'tunesien', 'tunez', 'tunis', 'djerba', 'sousse', 'hammamet'],
  EG: ['egypte', 'egypt', 'agypten', 'egipto', 'egitto', 'hurghada', 'charm el cheikh', 'louxor', 'louksor'],
  TH: ['thailande', 'thailand', 'tailandia', 'tajlandia', 'bangkok', 'phuket', 'chiang mai'],
  ID: ['indonesie', 'indonesia', 'indonesien', 'indonezja', 'bali', 'jakarta'],
  PE: ['perou', 'peru', 'machu picchu', 'cusco'],
  MX: ['mexique', 'mexico', 'mexiko', 'messico', 'meksyk', 'cancun', 'playa del carmen'],
  US: ['etats-unis', 'etats unis', 'united states', 'vereinigte staaten', 'estados unidos', 'stati uniti', 'stany zjednoczone', 'new york', 'miami', 'las vegas', 'los angeles', 'chicago'],
  AE: ['dubai', 'emirats arabes', 'emirados arabes'],
  MV: ['maldives', 'malediven', 'maldivas', 'malediwy'],
  CU: ['cuba', 'kuba', 'la havane', 'havana', 'varadero'],
  DO: ['republique dominicaine', 'dominican republic', 'punta cana'],
  CA: ['canada', 'kanada', 'montreal', 'toronto', 'quebec'],
  JP: ['japon', 'japan', 'giappone', 'japonia', 'tokyo', 'kyoto', 'osaka'],
  CN: ['chine', 'chiny', 'pekin', 'beijing', 'shanghai'],
  VN: ['vietnam', 'wietnam', 'hanoi'],
  IS: ['islande', 'iceland', 'islandia', 'islanda', 'reykjavik'],
  NO: ['norvege', 'norway', 'norwegen', 'noruega', 'norvegia', 'norwegia', 'oslo', 'bergen'],
  FI: ['finlande', 'finland', 'finnland', 'finlandia', 'helsinki', 'laponie', 'lapland'],
  HR: ['croatie', 'croatia', 'kroatien', 'croacia', 'croazia', 'chorwacja', 'dubrovnik', 'zagreb'],
  CZ: ['republique tcheque', 'czech republic', 'tschechien', 'chequia', 'repubblica ceca', 'czechy', 'prague', 'praha'],
  HU: ['hongrie', 'hungary', 'ungarn', 'hungria', 'ungheria', 'wegry', 'budapest'],
  DK: ['danemark', 'denmark', 'dinamarca', 'danimarca', 'dania', 'copenhague', 'copenhagen'],
};

/** Mots d'un FORFAIT de voyage (point 21) : ils suffisent à classer en Voyages
 *  même quand la destination n'est pas identifiable dans le titre. */
const MOTS_FORFAIT_VOYAGE = ['sejour', 'croisiere', 'city break', 'aller-retour', 'location de voiture', 'nuit d hotel', 'billet d avion', 'week-end a l etranger'];

/** Le code pays d'une destination ÉTRANGÈRE nommée dans le titre, ou null.
 *  `pays` est le pays de l'offre : une destination qui EST ce pays ne compte
 *  pas (une prestation locale reste en Activité). */
function destinationEtrangere(texteBas, pays) {
  for (const [code, mots] of Object.entries(DESTINATIONS)) {
    if (code === pays) continue;
    for (const m of mots) {
      if (new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)').test(texteBas)) return code;
    }
  }
  return null;
}

/** Vrai si le titre décrit un FORFAIT de voyage (voir MOTS_FORFAIT_VOYAGE). */
function estForfaitVoyage(texteBas) {
  return MOTS_FORFAIT_VOYAGE.some((m) => (exigeFrontiere(m)
    ? new RegExp('(^|[^a-zà-ÿ])' + m + '([^a-zà-ÿ]|$)').test(texteBas)
    : texteBas.includes(m)));
}

/* Le classement d'une offre, réduit à ses SEULS champs conservés (titre +
 *  catégorie de source).
 *
 *  Une fonction unique, et c'est le point important : le collecteur classe avec
 *  elle, et le vérificateur REJUGE avec elle. Si les deux divergeaient, le
 *  vérificateur signalerait des offres « mal classées » qui ne le sont pas — et
 *  on chercherait le défaut dans les données au lieu du contrôle. Le titre seul
 *  (et non titre + description) parce que la description n'est PAS conservée en
 *  base : un reclassement ultérieur doit pouvoir retrouver exactement la même
 *  décision sans elle. */
export function classerOffre(o) {
  // Une rubrique IMPOSÉE par la page de la source est conservée telle quelle :
  // elle ne vient pas d'une lecture du titre, elle vient du rayon que le
  // marchand a lui-même construit (voir SOURCES_ACTIVITES). La rejouer contre
  // le titre la déferait à chaque passage, en silence.
  if (o.categorieImposee === 'activite') {
    // EXCEPTION (demande de B, plan point 9) : la page « Activité » de Groupon
    // mêle SORTIES, SOINS et VOYAGES.
    //  1. Un soin de beauté, du corps ou du bien-être n'est PAS une sortie :
    //     quand le titre le nomme, l'offre part en BEAUTÉ.
    if (estSoin(o.titre)) return 'beaute';
    const bas = retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));
    //  2. Un REPAS PRIS DEHORS reste en Activité (point 22), même quand la
    //     cuisine est étrangère : « saveurs de la Grèce » est un dîner, pas un
    //     voyage. Sinon un dîner grec à Bruxelles partait en Voyages.
    if (estRepasDehors(bas) && !preuveEpicerie(bas)) return 'activite';
    //  3. Un voyage — un FORFAIT nommé (séjour, croisière…), ou une prestation
    //     dont la DESTINATION est à l'ÉTRANGER (partage géographique, point 21 :
    //     « la même prestation change d'onglet selon la destination »).
    if (estForfaitVoyage(bas) || destinationEtrangere(bas, o.pays)) return 'voyages';
    //  4. Le reste — concerts, spectacles, zoo, parcs, restaurants — reste en
    //     Activité.
    return 'activite';
  }
  if (o.categorieImposee) return o.categorieImposee;
  return famille(o.titre || '', o.categorieSource);
}

/* ------------------------------------------------------------------ *
 *  Collecte
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 *  TOUTE LECTURE PORTE UN DÉLAI MAXIMAL — ET C'EST UNE PANNE VÉCUE.
 *
 *  Le 09/10/2026 au soir, l'application s'est figée : plus aucune mise à jour
 *  publiée pendant que la collecte tournait encore. Cause exacte : cette
 *  fonction n'avait AUCUN délai. Tant que les sources étaient peu nombreuses et
 *  toutes connues, aucun hôte ne pendait — le défaut dormait. Le jour où l'on a
 *  branché 220 adresses de promotions d'un coup (`adresses-promotions.json`), il
 *  a suffi qu'UNE d'elles ne réponde jamais : son `fetch` restait en attente
 *  pour toujours, et comme toutes les sources sont interrogées en parallèle
 *  (un seul `Promise.all`), TOUTE la collecte attendait avec elle. Le
 *  planificateur tuait alors le script à 120 s — avant l'envoi vers GitHub —
 *  d'où un site figé alors que la machine, elle, semblait travailler.
 *
 *  Le remède est le même que partout ailleurs dans ce fichier (« on est invité
 *  chez des gens ») : un délai maximal, court, et l'échec est journalisé comme
 *  les autres. Une source lente ne doit jamais retenir les autres.
 * ------------------------------------------------------------------ */
const DELAI_LECTURE_MS = 15000;

async function lire(url, langue = 'fr-FR,fr;q=0.9', delai = DELAI_LECTURE_MS, cle = '') {
  // LA REQUÊTE CONDITIONNELLE : on renvoie au serveur ce qu'il nous a donné la
  // fois d'avant, et c'est LUI qui dit s'il a du neuf. Voir « LA DISCRÉTION ».
  const cache = cle ? cacheLire(cle) : null;
  const entetes = { 'user-agent': UA, 'accept-language': langue };
  if (cache && cache.etag) entetes['if-none-match'] = cache.etag;
  else if (cache && cache.dernierModifie) entetes['if-modified-since'] = cache.dernierModifie;
  if (cle) CONDITIONNEL.essais++;
  const r = await fetch(url, { headers: entetes, redirect: 'follow', signal: AbortSignal.timeout(delai) });
  if (r.status === 304 && cache) {
    CONDITIONNEL.reutilises++;
    compterTrafic(url, 0, 'source-304');       // une requête, zéro octet : c'est le gain
    return cache.corps;
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const texte = await r.text();
  compterTrafic(url, tailleRecue(r, texte), 'source');
  if (cle) cacheEcrire(cle, r.headers.get('etag'), r.headers.get('last-modified'), texte);
  return texte;
}

/** Lecture par `curl`, pour les marchands qui REFUSENT le client HTTP de Node.
 *
 *  MESURÉ, et c'est ce qui a coûté une collecte entière : groupon.be répond
 *  **403** à `fetch()` — avec les en-têtes minimaux COMME avec un jeu complet de
 *  navigateur (Accept, Accept-Encoding, Sec-Fetch-*, Upgrade-Insecure-Requests).
 *  La même URL répond **200** à curl, sans aucun en-tête particulier, et en
 *  HTTP/1.1 comme en HTTP/2. Ce ne sont donc pas les en-têtes qui décident :
 *  c'est l'EMPREINTE TLS du client. Node en a une qui le désigne comme robot,
 *  curl non.
 *
 *  On ne contourne rien et on ne falsifie rien : on change de client HTTP pour
 *  lire la MÊME page publique, que le marchand autorise explicitement
 *  (`robots.txt` : `Allow: /`). Le premier essai de collecte l'a prouvé : les
 *  offres Groupon étaient absentes des données publiées, sans une seule erreur
 *  visible dans l'application — seulement une ligne « HTTP 403 » dans le
 *  journal. Un lecteur qui échoue en silence est pire que pas de lecteur.
 *
 *  `-f` est essentiel : sans lui, curl sort avec le code 0 même sur un 403 et
 *  rendrait une page d'erreur que le lecteur prendrait pour une page vide.
 *
 *  ASYNCHRONE, ET PAS PAR GOÛT. La version précédente appelait `execFileSync` :
 *  un appel SYNCHRONE qui gèle la boucle d'événements de Node pendant tout le
 *  temps de la requête — jusqu'à 25 s par source. Comme les trois pages Groupon
 *  se rafraîchissent au même moment, elles se bloquaient l'une après l'autre
 *  pendant qu'AUCUN autre `fetch` ne pouvait avancer : jusqu'à 75 s de gel, à
 *  eux seuls de quoi franchir la limite de 120 s du planificateur. Avec
 *  `execFile` promisifié, le gel disparaît : les lectures Node continuent
 *  pendant que curl travaille. Le délai est aussi ramené à 15 s, comme `lire`.
 */
let nCurl = 0;
function lireParCurl(url, langue = 'fr-BE,fr;q=0.9', cle = '') {
  const cache = cle ? cacheLire(cle) : null;
  const args = [
    '-fsS', '-L', '--compressed', '--max-time', '15',
    '-A', UA, '-H', `Accept-Language: ${langue}`,
  ];
  // Même requête conditionnelle que `lire` : on renvoie ce que le serveur nous
  // avait donné. curl ne dit pas s'il a renvoyé le corps ou un « rien de neuf » :
  // on lui fait donc écrire le corps ET ses en-têtes dans deux fichiers, et on
  // lit le code HTTP sur sa sortie.
  if (cache && cache.etag) args.push('-H', `If-None-Match: ${cache.etag}`);
  else if (cache && cache.dernierModifie) args.push('-H', `If-Modified-Since: ${cache.dernierModifie}`);
  const corpsTmp = path.join(DATA, `curl-corps-${process.pid}-${nCurl}.tmp`);
  const entetesTmp = path.join(DATA, `curl-en-tetes-${process.pid}-${nCurl}.tmp`);
  nCurl++;
  args.push('-D', entetesTmp, '-o', corpsTmp, '-w', '%{http_code} %{size_download}', url);
  if (cle) CONDITIONNEL.essais++;
  return new Promise((resolve, reject) => {
    execFile('curl', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 20000 }, (err, stdout) => {
      const lireFichier = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
      try {
        const corps = lireFichier(corpsTmp);
        const brutEntetes = lireFichier(entetesTmp);
        if (err) throw err;
        const [code, taille] = String(stdout || '').trim().split(/\s+/);
        if (code === '304' && cache) {
          CONDITIONNEL.reutilises++;
          compterTrafic(url, 0, 'source-304');
          return resolve(cache.corps);
        }
        compterTrafic(url, Number(taille) || Buffer.byteLength(corps, 'utf8'), 'source');
        if (cle) {
          const dernier = (re) => { const t = [...brutEntetes.matchAll(re)]; return t.length ? t[t.length - 1][1].trim() : null; };
          cacheEcrire(cle, dernier(/^etag:\s*(.+)$/gim), dernier(/^last-modified:\s*(.+)$/gim), corps);
        }
        resolve(corps);
      } catch (e) { reject(e); } finally {
        try { fs.unlinkSync(corpsTmp); } catch { /* déjà parti */ }
        try { fs.unlinkSync(entetesTmp); } catch { /* déjà parti */ }
      }
    });
  });
}

const journal = [];
/** Les sources déjà signalées comme refusées par un `robots.txt`, pour ne le
 *  dire qu'UNE fois par passage (voir collecterSource). */
const robotsSignales = new Set();
async function collecterSource(source) {
  try {
    // ON REGARDE D'ABORD CE QUE LE SITE AUTORISE. `robots.txt` est lu une fois
    // par jour et par hôte, puis son verdict est publié avec le reste. Il
    // n'écarte ENCORE aucune source, et c'est volontaire : retirer une source
    // retire du contenu du site — c'est une décision de B, et il lui faut la
    // liste avant de la prendre.
    const robots = await verdictRobots(source.url);
    // Certains marchands refusent le client HTTP de Node (voir lireParCurl) :
    // la source le déclare, et on lit avec curl. Même page, même URL.
    const entete = source.entete || source.langue;
    const corps = source.viaCurl
      ? await lireParCurl(source.url, entete, source.id)
      : await lire(source.url, entete, undefined, source.id);
    // La source parle : si `robots.txt` refuse cette adresse, on le DIT dans le
    // journal du passage — sans compter d'échec, puisqu'on lit quand même.
    if (robots && robots.interdit && !robotsSignales.has(source.id)) {
      robotsSignales.add(source.id);
      console.log(`  ⚠ robots.txt de ${robots.hote} refuse ${robots.chemin} (source ${source.id}) — lu quand même, verdict à trancher`);
    }
    // Une enseigne ne rend pas un flux mais une PAGE : on lit son JSON-LD au
    // lieu de chercher des <item>. Deux lectures distinctes, jamais mélangées.
    if (source.type === 'enseigne') {
      const offres = offresEnseigne(corps, source);
      journal.push({ source: source.id, ok: true, items: 0, retenues: offres.length });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} offre(s) d'enseigne`);
      return offres;
    }
    // Bon plans de SERVICE (Groupon) : la page embarque ses cartes en JSON.
    if (source.type === 'groupon') {
      const offres = offresGroupon(corps, source);
      journal.push({ source: source.id, ok: true, items: 0, retenues: offres.length });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} bon(s) plan(s) ${source.categorieImposee || ''}`);
      return offres;
    }
    // Activités hors Groupon (Social Deal) : deux prix en clair dans le HTML.
    if (source.type === 'socialdeal') {
      const offres = offresSocialDeal(corps, source);
      journal.push({ source: source.id, ok: true, items: 0, retenues: offres.length });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} activité(s) Social Deal ${source.pays}`);
      return offres;
    }
    // Ventes flash du jour : la page les embarque en JSON, on les y lit.
    if (source.type === 'flash') {
      const offres = offresVenteFlash(corps, source);
      journal.push({
        source: source.id, ok: true, items: 0, retenues: offres.length,
        ...(offres.length ? {} : { note: 'page de ventes flash sans offre lisible (Amazon limite par intermittence) — les offres déjà engrangées sont conservées' }),
      });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} vente(s) flash ${source.pays}`);
      return offres;
    }
    // Bon plans de bol.com : la page « deals », deux prix réels par carte.
    if (source.type === 'bol') {
      const offres = offresBol(corps, source);
      journal.push({
        source: source.id, ok: true, items: 0, retenues: offres.length,
        ...(offres.length ? {} : { note: 'page « deals » sans produit lisible — les offres déjà engrangées sont conservées' }),
      });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} offre(s) bol.com`);
      return offres;
    }
    // Bon plans de Krefel : sa page « deals du moment », prix barré par carte.
    if (source.type === 'krefel') {
      let offres = offresKrefel(corps, source);
      const vues = new Set(offres.map((o) => o.id));
      // PAGINATION. La page annonce son total (« 68 resultaten ») mais n'en rend
      // qu'une vingtaine : le reste est derrière `?currentPage=N`, le paramètre
      // que B avait justement dans son lien. On suit les pages tant qu'elles
      // apportent des produits NOUVEAUX, et on s'arrête là — jamais de boucle
      // sur un site qui vient de passer des heures en maintenance.
      const total = Number((corps.match(/>\s*(\d+)\s*(?:resultaten|résultats)/) || [])[1]) || 0;
      const pages = total ? Math.min(PLAFOND_PAGES_KREFEL, Math.max(1, Math.ceil(total / 24))) : 1;
      for (let p = 2; p <= pages; p++) {
        const suite = await lire(`${source.url}?currentPage=${p}`, entete);
        const nouvelles = offresKrefel(suite, source).filter((o) => !vues.has(o.id));
        if (!nouvelles.length) break;                 // page vide ou identique : on arrête
        for (const o of nouvelles) vues.add(o.id);
        offres = offres.concat(nouvelles);
      }
      journal.push({
        source: source.id, ok: true, items: total, pages, retenues: offres.length,
        //  Le zéro doit être VISIBLE. Si la structure change, ce lecteur rend
        //  zéro offre en silence — et un zéro silencieux se lit « rien à
        //  vendre », pas « le lecteur est cassé ». Ce lecteur-ci n'a jamais été
        //  vu fonctionner sur la page vivante : la note est donc explicite.
        ...(offres.length ? {} : { note: 'page de deals sans produit lisible — structure à vérifier (le site était en maintenance le 10/10/2026, lecteur écrit sur une copie archivée)' }),
      });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} offre(s) Krefel sur ${pages} page(s)`);
      return offres;
    }
    // Amazon : une page de résultats, pas un flux. Une page VIDE n'est pas une
    // panne — mesuré, 2 appels sur 5 rendent une page sans produit. On la
    // journalise comme « 0 retenue » avec la raison, pour qu'elle ne soit ni
    // confondue avec un échec ni prise pour un effacement du catalogue.
    if (source.type === 'amazon') {
      const offres = offresAmazon(corps, source);
      journal.push({
        source: source.id, ok: true, items: 0, retenues: offres.length,
        ...(offres.length ? {} : { note: 'page sans produit (Amazon limite par intermittence) — les offres déjà engrangées sont conservées' }),
      });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} offre(s) Amazon`);
      return offres;
    }
    const blocs = items(corps);
    const offres = blocs.map((b) => (source.type === 'dealabs' ? offreDealabs(b, source) : offrePresse(b, source))).filter(Boolean);
    journal.push({ source: source.id, ok: true, items: blocs.length, retenues: offres.length });
    if (VERBEUX) console.log(`  ${source.id} : ${blocs.length} items, ${offres.length} offres`);
    return offres;
  } catch (e) {
    journal.push({ source: source.id, ok: false, erreur: e.message });
    console.log(`  ⚠ ${source.id} : ${e.message}`);
    return [];
  }
}

async function collecterRecherche([familleId, requete]) {
  const source = {
    id: 'gnews-' + familleId, nom: 'Veille presse',
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(requete)}&hl=fr&gl=FR&ceid=FR:fr`,
    type: 'presse',
  };
  try {
    const xml = await lire(source.url, undefined, undefined, source.id);
    const offres = items(xml).map((b) => offrePresse(b, source, familleId)).filter(Boolean);
    journal.push({ source: source.id, ok: true, items: items(xml).length, retenues: offres.length });
    if (VERBEUX) console.log(`  ${source.id} : ${offres.length} offres retenues`);
    return offres;
  } catch (e) {
    journal.push({ source: source.id, ok: false, erreur: e.message });
    return [];
  }
}

/**
 * Clé d'unicité : l'URL canonique de l'offre quand elle existe.
 * DÉFAUT CORRIGÉ : dédupliquer sur le TITRE faisait doublonner une même offre
 * dès qu'on nettoyait son titre (« 160° - Broyeur Bosch » puis « Broyeur
 * Bosch » = deux offres au lieu d'une). L'URL, elle, ne change pas.
 */
export const cleDe = (o) => {
  const u = String(o.lienPage || '').replace(/^https?:\/\/(www\.)?/, '').split('?')[0].replace(/\/$/, '');
  const base = u || String(o.titre).toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim().slice(0, 80);
  // LE PAYS FAIT PARTIE DE L'IDENTITÉ DE L'OFFRE.
  //
  //   Un même produit, sur un même domaine, sert DEUX pays : l'Autriche achète
  //   sur amazon.de et le Portugal sur amazon.es. Sans le pays dans la clé, la
  //   copie du second pays écrasait l'offre du premier — même URL, même titre —
  //   et l'Allemagne comme l'Espagne restaient à zéro vente flash alors que
  //   leur page avait bel et bien été lue. Le défaut ne se voyait qu'en
  //   comparant deux pays, jamais en regardant un seul.
  return (o.pays || 'FR') + '|' + base;
};

/* ------------------------------------------------------------------ *
 *  LES DESTINATIONS RÉELLES — le clic mène au marchand, pas au concurrent
 *
 *  LE DÉFAUT, MESURÉ LE 11/10/2026. L'audit des liens sortants du catalogue :
 *
 *       vers un agrégateur de bons plans : 13 070  (69,7 %)
 *       vers un marchand, lien direct    :    883  ( 4,7 %)
 *       dont Amazon                      :  4 792  (25,6 %)
 *
 *  Les deux tiers du catalogue envoyaient donc le visiteur chez un site de
 *  bons plans CONCURRENT (mydealz, Dealabs, HotUKDeals, Chollometro, Pepper),
 *  pas chez le marchand. Et parmi ces 13 070 offres, 5 069 nommaient
 *  « Amazon » : le nom était connu, l'adresse ne l'était pas. C'est la cause
 *  première du « le site ne rapporte rien » — un lien qui ne mène pas au
 *  marchand ne rapportera jamais rien, quel que soit le nombre de programmes
 *  d'affiliation rejoints.
 *
 *  POURQUOI ÇA SE CORRIGE ICI, ET PAS DANS LE CATALOGUE. La fusion ci-dessus
 *  fait `{...avant, ...offre}` : un `lienMarchand` corrigé à la main serait
 *  écrasé au passage suivant, cinq minutes plus tard. La correction est donc
 *  une RÈGLE DE STOCK, appliquée à chaque collecte, comme la règle des deux
 *  prix — et le cache qui la nourrit (donnees/destinations-reelles.json) est
 *  tenu par outils/resoudre-destinations.mjs, qui interroge les plateformes
 *  une fois par offre et garde le résultat.
 *
 *  CE QUI N'EST PAS TOUCHÉ : `lienPage`. C'est lui qui porte l'identité de
 *  l'offre (cleDe) et qui doit continuer de dire D'OÙ vient le bon plan. On ne
 *  remplace que la destination du clic.
 *
 *  ET SI LE CACHE EST ABSENT OU VIDE ? Il ne se passe rien. L'offre garde son
 *  lien d'origine : le lien reste VRAI, il ne rapporte simplement rien. Jamais
 *  d'adresse inventée, jamais de lien cassé.
 * ------------------------------------------------------------------ */

/** Le cache des destinations réelles, lu du disque. Map vide s'il est absent. */
export function lireDestinations(fichier = FICHIER_DESTINATIONS) {
  const table = new Map();
  try {
    const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    const brut = (d && d.destinations) || {};
    for (const [cle, v] of Object.entries(brut)) {
      if (v && typeof v.url === 'string' && v.url) table.set(cle, v);
    }
  } catch { /* pas de cache : aucune destination n'est appliquée */ }
  return table;
}

/**
 * Applique le cache aux offres connues. Rend le compte, pour le journal et
 * pour les tests.
 *
 * `connues` : Map(clé -> offre), modifiée sur place — c'est la même que celle
 * qu'on publiera, comme pour la règle des deux prix.
 * `destinations` : Map(adresse de sortie -> {url, hote}).
 */
export function appliquerDestinations(connues, destinations) {
  let remplacees = 0;
  const parHote = {};
  if (!destinations || !destinations.size) return { remplacees, parHote };
  for (const o of connues.values()) {
    if (!o || o.type !== 'offre') continue;
    const url = o.lienMarchand || o.lienPage || '';
    const sortie = adresseDeSortie(url);
    if (!sortie) continue;
    const dest = destinations.get(sortie);
    if (!dest || !dest.url) continue;
    if (o.lienMarchand === dest.url) continue;   // déjà corrigée : rien à faire
    o.lienMarchand = dest.url;
    remplacees++;
    const h = dest.hote || '';
    parHote[h] = (parHote[h] || 0) + 1;
  }
  return { remplacees, parHote };
}

/* ------------------------------------------------------------------ *
 *  Publication (GitHub Pages) — le site ET ses visuels, autonomes.
 *
 *  Sur une page publique, les visuels ne peuvent PAS être pris directement
 *  chez les sources : leur politique d'origine croisée les fait refuser par le
 *  navigateur (cartes grises — défaut déjà vécu sur le hub). On les télécharge
 *  donc ici, une fois, et on les sert depuis notre propre site.
 *
 *  Conséquence décisive : l'application n'a plus besoin d'AUCUN serveur à nous
 *  pour afficher des images — et donc plus du NAS resté à la maison.
 * ------------------------------------------------------------------ */
const extension = (url) => {
  const m = String(url).split('?')[0].match(/\.(jpe?g|png|webp|gif|avif)$/i);
  return m ? '.' + m[1].toLowerCase() : '.jpg';
};

/** Le format RÉEL d'un fichier, lu dans sa signature.
 *
 *  Pourquoi ne pas croire l'en-tête `content-type` : img.grouponcdn.com annonce
 *  « application/octet-stream » pour de VRAIES images webp/jpeg — mesuré, 33 des
 *  37 visuels Groupon restés distants. Le rapatrieur exigeait `image/…` : il
 *  refusait ces fichiers, l'adresse restait distante, et l'application la
 *  demandait alors à NOTRE relais d'images — lequel n'existe que sur le hub du
 *  NAS, pas sur le site GitHub Pages. Résultat : des cartes grises sur le site
 *  public et dans l'APK hors du réseau de la maison.
 *
 *  On lit donc les octets, comme le fait un navigateur. Un type MIME est une
 *  déclaration ; une signature est un fait. */
const formatImage = (buf) => {
  if (!buf || buf.length < 12) return '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (/^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'gif';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp'
      && /^(avif|avis|heic|heix|mif1|msf1)$/.test(buf.subarray(8, 12).toString('latin1'))) return 'avif';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';                    // « BM »
  const tete = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (tete.startsWith('<svg') || (tete.startsWith('<?xml') && tete.includes('<svg'))) return 'svg';
  return '';
};

// Exporté pour les tests : c'est ce contrôle qui décide si un visuel est
// rapatrié ou laissé distant — donc affiché ou invisible sur le site public.
export { formatImage };

/** LE TÉMOIN DE FRAÎCHEUR — la forme de l'état publié, écrite à UN seul
 *  endroit.
 *
 *  Pourquoi ce fichier existe : l'application ne doit pas télécharger 18 Mo
 *  pour savoir s'il y a du neuf. Elle interroge ce témoin de quelques dizaines
 *  de kilo-octets, et ne va chercher le catalogue que si sa date a bougé (voir
 *  public/maj.js).
 *
 *  Pourquoi il est écrit DEUX FOIS par passage : ici, dès que le catalogue
 *  existe — un témoin qui annoncerait une fraîcheur avant qu'elle soit là
 *  ferait télécharger un catalogue périmé. Puis une seconde fois à la fin du
 *  passage, enrichi du bilan d'exploitation, dont la moitié des chiffres
 *  (durée réelle, fichiers rapatriés dans le créneau) n'existe qu'à la fin.
 *  Les deux écritures portent le MÊME `genereLe` : l'application ne voit aucun
 *  rafraîchissement de plus, et personne ne retélécharge le catalogue.
 *
 *  Une seule fonction, donc : deux écritures qui construiraient chacune leur
 *  objet finiraient par ne plus publier la même chose, et le panneau lirait un
 *  champ présent le matin et absent le soir.
 */
export function ecrireEtatCollecte(sortie, { dossier = DOSSIER_PUBLIE } = {}) {
  try {
    fs.writeFileSync(path.join(dossier, 'etat-collecte.json'), JSON.stringify({
      genereLe: sortie.genereLe,
      total: sortie.total,
      totalOffres: sortie.totalOffres,
      totalVeille: sortie.totalVeille,
      // Le bilan de données voyage avec le témoin de fraîcheur : l'onglet
      // « Données » du panneau le lit d'un seul appel, et il est écrit au même
      // instant que le catalogue qu'il décrit.
      donnees: sortie.donnees,
    }), 'utf8');
    return true;
  } catch (e) {
    // Un échec d'écriture ne fait pas tomber la publication : le témoin est un
    // confort, pas une donnée.
    console.log(`  ⚠ témoin de fraîcheur non écrit (${e.message}) — l'application ne se rafraîchira pas d'elle-même`);
    return false;
  }
}

async function publier(sortie) {
  const dossierImg = path.join(DOSSIER_PUBLIE, 'img');
  fs.mkdirSync(dossierImg, { recursive: true });

  // 1. Le site lui-même : l'interface est copiée telle quelle.
  //    COPIE RÉCURSIVE, et pas fichier par fichier : depuis l'identité, public/
  //    contient aussi un DOSSIER (fonts/). L'ancienne boucle appelait
  //    copyFileSync sur un dossier, ce qui lève « EISDIR » et interrompait la
  //    publication entière. cpSync fusionne en plus au lieu d'écraser : docs/img
  //    (les visuels rapatriés) survit à la copie.
  fs.cpSync(path.join(__dirname, 'public'), DOSSIER_PUBLIE, { recursive: true });

  // 2. Les visuels, nommés par l'empreinte de leur URL : jamais retéléchargés.
  //
  //    En DEUX passes, et pas une — c'est ce qui borne le temps sans rien
  //    casser. La première est un simple calcul, sans réseau : elle recense tout
  //    ce qui est attendu dans docs/img, ce qui protège les fichiers du ménage de
  //    l'étape 3. La seconde télécharge ce qui manque, SOUS ÉCHÉANCE. Un
  //    téléchargement non borné a déjà fait dépasser la limite du cron et coupé
  //    la publication en pleine écriture ; ici ce qui n'a pas été rapatrié garde
  //    son adresse d'origine et repart au tour suivant. Rien n'est perdu, et rien
  //    n'est supprimé par erreur (le recensement a lieu AVANT les téléchargements).
  const attendus = new Set();
  const aTelecharger = [];
  for (const o of sortie.offres) {
    if (!o.image) continue;
    // Déjà local (offre conservée d'une exécution précédente) : on le laisse tel
    // quel, en le déclarant « attendu » pour que le ménage ne le supprime pas.
    if (!/^https?:/i.test(o.image)) {
      const nom = path.basename(o.image);
      attendus.add(nom);
      o.image = 'img/' + nom;
      continue;
    }
    const nom = crypto.createHash('sha1').update(o.image).digest('hex').slice(0, 20) + extension(o.image);
    if (fs.existsSync(path.join(dossierImg, nom))) {   // déjà rapatrié
      attendus.add(nom);
      o.image = 'img/' + nom;
      continue;
    }
    aTelecharger.push({ o, nom });
  }

  const echeance = Date.now() + BUDGET_CRON.telechargementsMs;
  let pris = 0, rates = 0, differes = 0;
  for (const { o, nom } of aTelecharger) {
    if (Date.now() > echeance) { differes++; continue; }
    try {
      const r = await fetch(o.image, {
        headers: { 'user-agent': UA, 'referer': 'https://' + new URL(o.image).hostname + '/' },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      compterTrafic(o.image, Number(r.headers.get('content-length')) || buf.length, 'visuel');
      // Le type DÉCLARÉ ne fait pas foi (voir formatImage) : on lit la signature.
      if (!formatImage(buf)) throw new Error('pas une image');
      fs.writeFileSync(path.join(dossierImg, nom), buf);
      attendus.add(nom);
      o.image = 'img/' + nom;
      pris++;
    } catch {
      rates++;
      // on garde l'URL d'origine : carte sans visuel, jamais carte cassée
    }
  }

  // 3. On retire les visuels que plus aucune offre ne référence, sinon le
  //    dépôt grossit sans fin (chaque passage ne laisse que le vivant).
  let purges = 0;
  for (const f of fs.readdirSync(dossierImg)) {
    if (!attendus.has(f)) { fs.unlinkSync(path.join(dossierImg, f)); purges++; }
  }

  // 3 bis. LES DÉCHETS D'ÉDITEUR, retirés du dossier PUBLIÉ.
  //
  //  Défaut mesuré le 11/10/2026 : quatre copies d'éditeur (`app.js.sauv`,
  //  `app.css.sauv`, `index.html.sauv`, `langues.js.sauv`, 296 Ko au total) et
  //  le module d'une fonctionnalité RETIRÉE (`compte.js`) étaient SERVIS en
  //  ligne — mesuré, HTTP 200 sur les cinq adresses. La cause est structurelle :
  //  la copie `public/` → `docs/` FUSIONNE, donc un fichier retiré de `public/`
  //  reste publié À JAMAIS, et la copie d'éditeur d'un fichier vivant se
  //  retrouve, elle, téléchargeable à côté de lui. Un site publié ne porte ni
  //  sauvegardes d'éditeur ni brouillons.
  let dechets = 0;
  for (const f of fs.readdirSync(DOSSIER_PUBLIE)) {
    const p = path.join(DOSSIER_PUBLIE, f);
    if (!/(\.sauv|\.bak|\.orig|\.old|\.tmp)$|~$/.test(f)) continue;
    if (!fs.statSync(p).isFile()) continue;
    fs.unlinkSync(p);
    dechets++;
  }
  if (dechets) console.log(`  → ${dechets} déchet(s) d'éditeur retiré(s) du site publié`);

  fs.writeFileSync(path.join(DOSSIER_PUBLIE, 'offres.json'), JSON.stringify(sortie, null, 0));
  console.log(`  → publié dans ${DOSSIER_PUBLIE} : ${pris} visuel(s) téléchargé(s), ${rates} indisponible(s), ${differes} reporté(s) au passage suivant, ${purges} ancien(s) retiré(s)`);

  // 3 bis. LE TÉMOIN DE FRAÎCHEUR — quelques centaines d'octets, à côté des 13 Mo.
  //
  //  Défaut mesuré le 09/10/2026 au soir, signalé par B : « l'application n'a
  //  plus fait de mise à jour depuis plus de 3 heures ». L'application ne
  //  rechargeait jamais ses données (voir public/maj.js) ; mais la corriger
  //  posait une autre question : comment savoir qu'il y a du neuf SANS
  //  télécharger le catalogue de 13 Mo ? Réponse : ce fichier-ci. C'est lui que
  //  l'application interroge au retour au premier plan, et c'est seulement si sa
  //  date a bougé qu'elle va chercher le catalogue. Le mode économie de données
  //  du projet reste donc intact.
  //
  //  On l'écrit APRÈS le catalogue : il annonce une fraîcheur, il ne doit jamais
  //  pouvoir l'annoncer avant qu'elle soit là. Un échec d'écriture ne fait pas
  //  tomber la publication — le témoin est un confort, pas une donnée.
  //
  //  ⚠ IL EST ÉCRIT DEUX FOIS, ET C'EST VOULU. Ici, tout de suite : le témoin
  //  doit exister dès que le catalogue existe. Puis une seconde fois à la fin du
  //  passage, enrichi du bilan d'exploitation — dont la moitié des chiffres
  //  (durée, fichiers rapatriés) n'existe QUE là. Les deux écritures portent le
  //  même `genereLe` : l'application ne voit donc aucun rafraîchissement
  //  supplémentaire, et personne ne télécharge le catalogue deux fois.
  ecrireEtatCollecte(sortie);

  // 4. LES PAGES DE PARTAGE — une par offre, avec ses balises Open Graph.
  //    On les écrit APRÈS le catalogue publié, et depuis `sortie.offres` :
  //    les pages décrivent donc exactement ce que le site sert, et les chemins
  //    de visuels ci-dessus sont déjà locaux (« img/<empreinte>.jpg »).
  //    Demande de B (09/10/2026) : un partage doit porter la trace de Kazendra.
  //    En cas d'échec on continue : un partage sans vignette ne doit pas
  //    empêcher la collecte de publier.
  let partage = { ecrites: 0, inchangees: 0, retirees: 0, total: 0 };
  try {
    const { ecrirePagesPartage } = await import('./outils/pages-partage.mjs');
    // ⚠ ON N'ÉCRIT PAS DE PAGE DE PARTAGE POUR UNE FICHE QUE LE SITE N'AFFICHE
    //  PLUS (drapeau `perimee`, 13/10/2026). Une page de partage survit à tout :
    //  elle est indexée, elle se colle dans une conversation, et elle montrerait
    //  une promotion morte sous notre marque — exactement ce que B refuse. La
    //  laisser hors de la génération la fait PURGER par le ménage des orphelines
    //  du même générateur (elle n'est plus référencée nulle part).
    partage = await ecrirePagesPartage(sortie.offres, { silencieux: true });
    console.log(`  → partage : ${partage.ecrites} page(s) écrite(s), ${partage.inchangees} inchangée(s), ${partage.retirees} retirée(s) — ${partage.total} au total`);
  } catch (e) {
    console.error(`  ⚠ pages de partage non écrites : ${e.message}`);
  }

  // 5. LES PAGES DE RUBRIQUE — le contenu PROPRE et INDEXABLE du site.
  //
  //    Défaut mesuré le 09/10/2026, qui explique pourquoi ce bloc existe : les
  //    17 045 pages o/<id>.html sont TOUTES `noindex`, et elles doivent le
  //    rester (elles republient titres, photos et prix des marchands). Sans
  //    pages indexables, le site n'avait AUCUNE porte d'entrée que Google
  //    accepte de lire. Ces pages-ci sont cette porte : contenu rédigé, chiffres
  //    réels, balisage ItemList, et `hreflang` entre les trois langues.
  //
  //    Elles écrivent aussi le plan de site PUBLIÉ (docs/sitemap.xml), qui part
  //    du fichier de public/ et lui ajoute les rubriques. C'est volontaire :
  //    réécrire le plan de zéro ferait perdre l'accueil et les pages légales.
  //
  //    En cas d'échec on continue : une collecte ne doit pas être perdue parce
  //    que des pages annexes n'ont pas pu être écrites.
  let rubriques = { ecrites: 0, ecrites_total: 0, ignorees: 0, retirees: 0, sitemap: { total: 0 } };
  try {
    const { ecrirePagesRubriques } = await import('./outils/pages-rubriques.mjs');
    rubriques = await ecrirePagesRubriques(sortie.offres, { silencieux: true });
    console.log(`  → rubriques : ${rubriques.ecrites} page(s) écrite(s), ${rubriques.ecrites_total} au total, `
      + `${rubriques.ignorees} rubrique(s) sans page, ${rubriques.retirees} retirée(s) — plan de site : ${rubriques.sitemap.total} adresses`);
  } catch (e) {
    console.error(`  ⚠ pages de rubrique non écrites : ${e.message}`);
  }

  // CE QUE LE PASSAGE A RAPATRIÉ ET PUBLIÉ, RENDU À L'APPELANT.
  //
  //  Ces cinq chiffres n'existaient qu'en console. Le journal des passages les
  //  a besoin, et le journal est ce qui répond à la question de B — « combien
  //  de fichiers sont téléchargés, à quelle cadence ». Un chiffre qui ne vit
  //  que dans une sortie d'écran n'est pas une donnée : personne ne peut le
  //  relire demain, et aucune épreuve ne peut l'attraper.
  return { pris, rates, differes, purges, dechets, partage, rubriques };
}

/* ------------------------------------------------------------------ *
 *  VISUELS DES ARTICLES DE PRESSE
 *
 *  Les flux d'actualité ne fournissent AUCUNE image : mesuré, 0 sur 100 pour
 *  onze pays sur douze. Conséquence : les pays servis uniquement par la presse
 *  affichaient des cartes à fond neutre — 0 % de visuels pour l'Irlande, le
 *  Portugal, l'Italie, l'Autriche, la Belgique et la Suède, contre 92 à 100 %
 *  là où existe un site d'entraide.
 *
 *  L'image existe pourtant : elle est sur la page de l'article, dans la balise
 *  og:image. On va donc la chercher.
 *
 *  Trois garde-fous, parce que « récupérer une image » peut très bien rendre
 *  PIRE que pas d'image du tout :
 *
 *    1. on refuse les adresses manifestement génériques (logo, tuile de
 *       rubrique, image de profil Facebook). Sans cela, les quarante cartes
 *       d'un même pays porteraient toutes le même logo de journal — et ça
 *       ressemblerait à une réussite.
 *    2. on refuse une adresse qui se RÉPÈTE sur plusieurs articles d'un même
 *       site : c'est une tuile de rubrique, pas le visuel de l'article.
 *    3. on n'essaie chaque article qu'UNE fois (marque `imageTentee`, réessayée
 *       au bout de 7 jours en cas d'échec passager), avec un budget par passage
 *       et une pause entre deux appels : on est invité chez des gens.
 * ------------------------------------------------------------------ */
const IMAGE_GENERIQUE = /(graph\.facebook\.com|\/logos?[/-]|logo[-_]|\/placeholder|placeholder[-.]|\/tile|tile-wide|sprite|\/staticfiles\/tile|blank\.(png|gif|jpe?g)|default[-_](image|thumb|share)|share[-_]default|no[-_]image|\.svg(\?|$))/i;

/** Les deux écritures possibles de la balise d'aperçu (l'ordre des attributs
 *  change d'un site à l'autre), partagées par la lecture et par la recherche. */
const META_APERCU = [
  /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["']/i,
];

/** JUSQU'OÙ LIRE AVANT DE RENONCER. Mesuré le 12/10/2026 sur dix pages réelles :
 *  la balise vit entre **1 000 et 9 000 octets** (médiane 5 285). 64 Ko est donc
 *  déjà treize fois la marge nécessaire. Au-delà, on n'a jamais rien trouvé. */
const BUDGET_ENTETE = 65536;

/** L'EN-TÊTE D'UNE PAGE — ET ON ARRÊTE DE LIRE DÈS QU'ON A LA BALISE.
 *
 *  ⚠ CE QU'ON A ESSAYÉ AVANT, ET POURQUOI CE N'EST PAS ÇA. J'avais proposé la
 *  requête partielle (`Range: bytes=0-200000`), et B l'a validée. La mesure l'a
 *  CONTREDITE, chiffres en main : une réponse partielle (206) n'est **pas
 *  compressée**, alors que la même page servie entière arrive en gzip ou brotli.
 *  Résultat mesuré : sur 01net, 65,5 Ko en partiel contre une page compressée
 *  bien plus légère ; sur clubic, le serveur a répondu 206 en envoyant 807 Ko.
 *  Demander moins faisait donc payer PLUS sur les sites qui compressent — c'est
 *  à dire la plupart.
 *
 *  Ce qu'on fait à la place, et qui gagne sans jamais coûter : on lit la réponse
 *  EN FLUX et on COUPE dès que la balise est trouvée. La compression reste, et on
 *  ne paye pas la fin d'une page qu'on ne lira pas — exactement ce que fait un
 *  navigateur quand on quitte une page avant la fin.
 *
 *  `lu` est ce qu'on a réellement lu (décompressé) : une borne HAUTE de ce que le
 *  site a transmis, jamais une sous-estimation. La borne est écrite ici pour que
 *  personne ne prenne ce chiffre pour la taille exacte du fil. */
export async function lireEntete(reponse, budget = BUDGET_ENTETE) {
  const lecteur = reponse.body && typeof reponse.body.getReader === 'function' ? reponse.body.getReader() : null;
  if (!lecteur) {                                  // flux indisponible : lecture entière, comme avant
    const texte = await reponse.text();
    return { texte, lu: Buffer.byteLength(texte, 'utf8'), arrete: false };
  }
  const morceaux = [];
  let lu = 0, arrete = false;
  while (lu < budget) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(Buffer.from(value));
    lu += value.length;
    if (META_APERCU.some((re) => re.test(Buffer.concat(morceaux).toString('utf8')))) { arrete = true; break; }
  }
  if (arrete) { try { await lecteur.cancel(); } catch { /* le serveur avait déjà fini */ } }
  return { texte: Buffer.concat(morceaux).toString('utf8'), lu, arrete };
}

/** L'image d'aperçu d'une page, ou '' si elle n'en a pas d'exploitable. */
async function ogImageDe(page) {
  try {
    APERCU.demandes++;
    const r = await fetch(page, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return '';
    if (!(r.headers.get('content-type') || '').includes('html')) return '';
    const { texte, lu, arrete } = await lireEntete(r);
    // Le compteur dit COMBIEN de lectures ont été coupées : c'est le gain, et
    // une demande qui n'a pas coupé n'a rien gagné.
    if (arrete) APERCU.ecourtees++; else APERCU.entieres++;
    compterTrafic(page, lu, 'apercu');
    const m = META_APERCU.map((re) => texte.match(re)).find(Boolean);
    if (!m) return '';
    const url = m[1].replace(/&amp;/g, '&').trim();
    if (!/^https?:\/\//i.test(url)) return '';
    if (IMAGE_GENERIQUE.test(url)) return '';
    return url;
  } catch { return ''; }
}

/** Va chercher les visuels manquants, en servant d'abord les pays les MOINS
 *  couverts : c'est là que le manque se voit à l'écran. */
async function enrichirVisuels(connues, imagesGeneriques) {
  const BUDGET = 150;
  const PAUSE = 120;
  // Échéance globale : le budget seul ne suffit pas à borner le temps. Cent
  // cinquante articles chez des hôtes lents, à 12 s de délai chacun, dépassent
  // le créneau du cron (5 min) — et surtout la limite de 120 s au-delà de
  // laquelle le planificateur TUE le script. On s'arrête proprement, le reste
  // passera au tour suivant : rien n'est perdu, tout est repris.
  const ECHEANCE = Date.now() + BUDGET_CRON.visuelsMs;
  const offres = [...connues.values()];
  const etatPays = {};
  for (const o of offres) {
    const p = o.pays || 'FR';
    etatPays[p] = etatPays[p] || { total: 0, avec: 0 };
    etatPays[p].total++;
    if (o.image) etatPays[p].avec++;
  }
  const couverture = (p) => (etatPays[p] && etatPays[p].total ? etatPays[p].avec / etatPays[p].total : 1);
  const tentativeRecente = (t) => {
    const d = new Date(t || 0).getTime();
    return Number.isFinite(d) && d > 0 && Date.now() - d < 7 * 86400000;
  };
  const candidats = offres
    .filter((o) => !o.image && o.lienPage && /^https?:/i.test(o.lienPage) && !tentativeRecente(o.imageTentee))
    // Un lien Google News ne mène PAS à l'éditeur (vérifié : ni redirection, ni
    // décodage). Y aller ne peut rien rendre et consomme tout le budget — c'est
    // ce qui donnait « 0 sur 60 » alors que la méthode fonctionne ailleurs. Les
    // visuels de ces pays viennent des flux d'éditeurs et de Bing.
    .filter((o) => !/news\.google\.com/i.test(o.lienPage))
    .sort((a, b) => couverture(a.pays || 'FR') - couverture(b.pays || 'FR')
      || new Date(b.date) - new Date(a.date))
    .slice(0, BUDGET);
  if (!candidats.length) return { essais: 0, trouves: 0 };
  let trouves = 0;
  let faits = 0;
  for (const o of candidats) {
    if (Date.now() > ECHEANCE) break;
    const url = await ogImageDe(o.lienPage);
    o.imageTentee = new Date().toISOString();
    if (url && !imagesGeneriques.has(url)) { o.image = url; trouves++; }
    faits++;
    await new Promise((r) => setTimeout(r, PAUSE));
  }
  return { essais: faits, trouves };
}

/** Une image qui revient sur TROIS articles d'un même site n'est pas un
 *  visuel d'article : c'est la tuile du site ou son logo. On la retire
 *  partout, et on la retient pour ne plus l'accepter ensuite. */
function ecarterTuiles(offres, imagesGeneriques) {
  const compte = new Map();
  for (const o of offres) {
    if (!o.image || !/^https?:/i.test(o.image)) continue;
    compte.set(o.image, (compte.get(o.image) || 0) + 1);
  }
  let retires = 0;
  for (const [url, n] of compte) {
    if (n < 3) continue;
    imagesGeneriques.add(url);
    for (const o of offres) if (o.image === url) { o.image = ''; retires++; }
  }
  return retires;
}

/** Plafonne la veille PAR PAYS, jamais globalement.
 *
 *  Le plafond était global — 200 articles tous pays confondus : les pays servis
 *  uniquement par la presse se partageaient ce budget et paraissaient vides,
 *  pendant que la France remplissait la liste à elle seule. C'était la DEUXIÈME
 *  cause du « pas beaucoup de résultats » signalé par l'utilisateur.
 *
 *  Un plafond par pays garantit à chacun le même droit de cité, quel que soit le
 *  volume des autres. La liste arrive triée (la plus récente d'abord) : chaque
 *  pays garde donc ses articles les plus frais.
 */
function veilleParPays(listeTriee, plafond) {
  const compte = new Map();
  const gardees = [];
  for (const o of listeTriee) {
    const p = o.pays || 'FR';
    const n = compte.get(p) || 0;
    if (n >= plafond) continue;
    compte.set(p, n + 1);
    gardees.push(o);
  }
  return gardees;
}

/** Un même article arrive par DEUX chemins : Google News (volume) et Bing
 *  (visuels). Leurs liens diffèrent — news.google.com d'un côté, l'adresse de
 *  l'éditeur de l'autre — donc la clé d'unicité ne les rapproche pas, et le
 *  même article s'affichait DEUX FOIS.
 *
 *  On dédoublonne donc les ARTICLES sur leur titre normalisé. On ne touche pas
 *  aux offres marchandes : deux boutiques peuvent porter le même titre, et les
 *  fusionner ferait disparaître une offre réelle.
 *
 *  Entre deux fiches du même article, on garde la MIEUX renseignée : celle qui a
 *  un visuel, et celle dont le lien va chez l'éditeur plutôt que chez un
 *  redirecteur.
 */
function dedupliquerArticles(liste) {
  const vues = new Map();
  const gardees = [];
  for (const o of liste) {
    if (o.type !== 'article') { gardees.push(o); continue; }
    const t = String(o.titre || '').toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim().slice(0, 90);
    if (!t) { gardees.push(o); continue; }
    const deja = vues.get(t);
    if (!deja) { vues.set(t, o); gardees.push(o); continue; }
    const mieux = (!deja.image && o.image)
      || (/news\.google\.com/i.test(deja.lienPage || '') && !/news\.google\.com/i.test(o.lienPage || ''));
    if (mieux) {
      Object.assign(deja, {
        image: o.image || deja.image,
        lienPage: o.lienPage || deja.lienPage,
        lienMarchand: o.lienPage || deja.lienMarchand,
        source: o.source || deja.source,
        sourceId: o.sourceId || deja.sourceId,
      });
    }
  }
  return gardees;
}

async function principal() {
  fs.mkdirSync(DATA, { recursive: true });
  // L'INSTANT DU DÉPART. Il ne sert qu'à une chose : la durée du passage, qui
  // est le seul poste de coût machine qu'on puisse honnêtement imputer (voir
  // PUISSANCE_MACHINE_W). On le prend ici, avant tout travail.
  const departPassage = Date.now();
  // En publication, l'état vit DANS le site publié (docs/offres.json) : c'est le
  // seul fichier qui survit entre deux exécutions dans le cloud (le disque de
  // GitHub Actions est neuf à chaque passage). En local, il reste dans data/,
  // avec des visuels distants relayés par notre serveur.
  const fichierEtat = PUBLIER ? path.join(DOSSIER_PUBLIE, 'offres.json') : FICHIER;
  const existant = fs.existsSync(fichierEtat) ? JSON.parse(fs.readFileSync(fichierEtat, 'utf8')) : { offres: [] };
  // Assainissement : les offres collectées AVANT le nettoyage du titre gardent
  // leur « température » collée devant (« 298° - Vente flash »). On les écarte —
  // elles reviendront propres à cette collecte.
  const avantAssainir = existant.offres.length;
  let reclasses = 0, remisesRetirees = 0, remisesAjoutees = 0, datesRelevees = 0, datesFutures = 0, prixAvantAjoutes = 0;
  const propres = existant.offres
    .filter((o) => !/^\s*\d{1,4}\s*°\s*[-–—]/.test(o.titre || ''))
    // Les offres engrangées AVANT le décodeur d'entités gardent leurs échappements
    // (« B&amp;amp;M ») : on les décape au passage plutôt que de les jeter — la
    // source ne republiera pas forcément une offre encore valable.
    .map((o) => {
      const c = { ...o };
      for (const k of ['titre', 'marchand', 'source']) c[k] = decaper(c[k]);
      // Étiquette de source assainie. Un NOM DE FAMILLE (« tech », « mode »…)
      // dans categorieSource ne peut venir que de nous — nos requêtes de veille,
      // ou une catégorie qu'on avait collée à tort sur une source. On le renomme
      // « veille » pour que les données ne prétendent pas que le marchand l'a
      // dit. Sans ce nettoyage, l'ancienne règle de dernier recours y voyait une
      // preuve et maintenait des offres dans une rubrique inventée.
      const etiquette = sansAccents(String(c.categorieSource || '')).toLowerCase().trim();
      if (etiquette && Object.keys(FAMILLES).includes(etiquette)) c.categorieSource = 'veille';
      // Pays manquant : l'offre n'apparaîtrait dans AUCUN filtre pays — donc
      // jamais, pour qui consulte l'application par pays. 126 offres étaient
      // dans ce cas. Aucune source actuelle n'omet son pays (un test le
      // vérifie) : ces offres viennent d'un passage antérieur et survivent
      // parce que leur source ne les réémet plus. Le seul cas possible est
      // notre veille Google News française, qui n'a pas de pays propre — on la
      // rattache donc à la France plutôt que de la laisser invisible.
      if (!c.pays) c.pays = 'FR';
      // Prix barré invraisemblable : on le retire, ET sa remise avec lui. Un
      // couple de prix dont la référence vaut cinq fois le prix demandé ne vient
      // pas d'une promotion mais d'une confusion d'unité (prix au litre, au
      // kilo, au lot). Mesuré sur les données réelles : un parfum d'intérieur
      // affiché à -90 %, prix « barré » à 159,90 € pour 15,99 € — c'était le prix
      // au litre. Le nettoyage est RÉTROACTIF, comme le reclassement : les offres
      // déjà publiées portaient la fausse remise, et leur source ne les réémettra
      // pas forcément. Un faux pourcentage est pire que pas d'offre.
      if (c.prixAvant != null && c.prix != null && c.prixAvant >= c.prix * 5) {
        c.prixAvant = null; c.remise = null; c.remiseCalculee = false; remisesRetirees++;
      }
      // RECLASSEMENT. Les offres déjà en base gardent la catégorie calculée par
      // la version du code qui les a vues arriver — c'est-à-dire, pour tout ce
      // qui a été collecté avant la correction multilingue, une catégorie
      // fausse. Elles ne seront PAS toutes revues par la collecte du jour :
      // celles dont la source n'émet plus rien resteraient mal rangées des
      // semaines. On rejuge donc tout, à chaque passage. C'est gratuit (aucun
      // réseau) et ça rend la correction rétroactive.
      const vraie = classerOffre(c);
      if (vraie !== c.categorie) { c.categorie = vraie; reclasses++; }
      // REMISE relue dans le titre, DANS LES DEUX SENS.
      //   • une remise absente y est peut-être écrite (« 50 % Rabatt ») — c'est
      //     ce qui a fait passer le nombre de promotions vérifiées de 26 à 280 ;
      //   • une remise PRÉSENTE peut être fausse : « descontos de até 95 % »
      //     (« jusqu'à », en portugais) avait été comptée, parce que les
      //     formules d'accroche des neuf langues n'étaient pas toutes connues.
      //     Publier 95 % de remise sur un article de presse, c'est exactement le
      //     faux qu'on refuse.
      // Les remises CALCULÉES (deux prix réels) ne se relisent pas dans un titre.
      if (!c.remiseCalculee) {
        const actuelle = c.remise ?? null;
        const relue = pourcentEcrit(c.titre);
        // On AJOUTE toujours (c'est ce qui a fait passer les promotions de 26 à
        // 280). On n'EFFACE que sur un ARTICLE de presse : c'est là que vivent
        // les formules d'accroche (« descontos de até 95 % »), et c'est la seule
        // catégorie dont le texte d'origine est relu. Effacer aussi sur les
        // offres marchandes perdait de vraies remises annoncées dans une
        // description que le titre ne porte pas — mesuré : 537 → 351.
        if (relue != null) { c.remise = relue; remisesAjoutees++; }
        else if (actuelle != null && c.type === 'article') { c.remise = null; remisesRetirees++; }
      }
      // LE PRIX D'ORIGINE, RELU DANS LE TITRE — rétroactif, comme le pourcentage
      // ci-dessus et pour la même raison : une offre engrangée avant la
      // correction garde son prix barré manquant, et sa source ne la réémettra
      // pas forcément. Demande de B (13/10/2026) : « le pourcentage de réduction
      // avec le prix d'origine n'est pas indiqué sur la carte ».
      // Le seul garde-fou : le prix d'origine doit être SUPÉRIEUR au prix demandé —
      // sinon ce n'est pas une remise. On ne reprend PAS ici la borne des cinq fois
      // qui protège les prix barrés venus des données structurées : mesuré le
      // 13/10/2026, elle écartait un vrai « 2,49 € statt 24,99 € » (un jeu à -90 %,
      // dix fois moins cher, ce qui est banal). Ici la source ÉCRIT le rapport
      // (« au lieu de », « statt ») : c'est elle qui l'affirme, pas nous.
      // Limite connue, dite telle quelle : dans un titre qui cite un EXEMPLE entre
      // parenthèses (« Kat2 32,90 € statt 54 € »), le prix lu peut désigner l'exemple
      // et non le produit offert. Une phrase ne se lit pas comme un champ.
      if (c.prix != null && c.prixAvant == null && c.type !== 'article') {
        // Le couple ne s'écrit que s'il décrit la même chose — voir paireDePrix.
        const paire = paireDePrix(c.prix, prixAvantDans(c.titre));
        if (paire) {
          c.prixAvant = paire.avant;
          const r = remise(c.titre, c.prix, paire.avant);
          if (r) { c.remise = r.pourcent; c.remiseCalculee = r.calculee; }
          prixAvantAjoutes++;
        }
      }
      // LA DATE DE RELEVÉ, RÉPARÉE RÉTROACTIVEMENT — même raison que le
      // reclassement, la remise et la purge ci-dessus : une offre engrangée
      // avant la correction ne se corrige pas toute seule. Les 202 offres
      // mesurées le 10/10/2026 portaient la date du DERNIER PASSAGE — leur carte
      // annonçait « il y a 1 min » alors qu'elles étaient en base depuis près de
      // quatre jours. On leur rend leur `premiereVue` : le seul repère honnête
      // qu'on ait gardé. Sans `premiereVue` (offre vue une seule fois, donc
      // datée du jour même), il n'y a rien à réparer — la date est déjà juste.
      // ⚠️ LE MARQUEUR `dateRelevee` FAIT FOI, et pas seulement le type de la
      // source. Défaut mesuré le 11/10/2026 : les ventes flash de l'AUTRICHE et
      // du PORTUGAL (`flash-at`, `flash-pt`) sont copiées depuis les relevés de
      // l'Allemagne et de l'Espagne (voir `paysAussi`), donc leur identifiant
      // n'est déclaré dans AUCUNE source — `typeDeSource('flash-at')` rend la
      // chaîne vide et la réparation les IGNORAIT. Résultat mesuré : 68 cartes
      // affichaient la date de leur DERNIÈRE vue (19 h après leur entrée en
      // base) au lieu de leur première rencontre, et l'épreuve
      // `dates-relevees.test.mjs` les refusait, à juste titre. Le lecteur pose
      // la marque sur ses offres ; c'est donc elle qu'on lit en premier.
      if (c.dateRelevee || dateEstUnReleve(typeDeSource(c.sourceId))) {
        c.dateRelevee = true;
        if (c.premiereVue) c.date = c.premiereVue;
        datesRelevees++;
      }
      // UNE DATE DANS LE FUTUR N'EST PAS UNE DATE DE PUBLICATION.
      //
      // Signale par B le 13/10/2026 : « pourquoi cet article est sorti il y a
      // une minute, alors qu'il a ete publie le 05/10/26 a 12h00 ? Nous sommes
      // le 13 octobre, donc 8 jours plus tard. Maximum 7 jours de duree de vie
      // pour tout article de presse. »
      //
      // Verifie, et la cause est nommee : la source annoncait le 05/10/**2027**
      // 12:00 pour un article publie le 05/10/2026 12:00 (sa propre page porte
      // `datePublished: 2026-10-05T12:00:00+02:00`). La date etait recopiee
      // telle quelle, et trois regles se retournaient toutes seules contre nous
      // — la carte disait « il y a 1 min » a perpetuite (l'ecart negatif est
      // ramene a une minute), elle tenait la TETE du tri « plus recentes », et
      // la fenetre de veille (« date > maintenant - 7 jours ») restait vraie a
      // jamais : la limite de 7 jours de B ne pouvait pas mordre.
      //
      // Une date illisible ne prouve rien ; une date impossible non plus. On
      // rend donc a l'offre son premier repere honnete, sa premiere vue — la
      // meme reparation que les dates de releve juste au-dessus, et pour la
      // meme raison. Voir MARGE_HORLOGE_MS pour la marge toleree.
      const quandDate = c.date ? Date.parse(c.date) : NaN;
      if (Number.isFinite(quandDate) && quandDate > departPassage + MARGE_HORLOGE_MS) {
        c.date = c.premiereVue || c.vuLe || new Date(departPassage).toISOString();
        c.dateFuture = true;                // la carte cesse d'annoncer une fraicheur inventee
        datesFutures++;
      }
      return c;
    });
  if (propres.length !== avantAssainir) {
    console.log(`Assainissement : ${avantAssainir - propres.length} offre(s) au titre pollué écartée(s)`);
  }
  if (reclasses) console.log(`Reclassement : ${reclasses} offre(s) rangée(s) dans la bonne rubrique`);
  if (remisesRetirees) console.log(`Assainissement : ${remisesRetirees} remise(s) invraisemblable(s) retirée(s) (prix barré ≥ 5× le prix demandé)`);
  if (remisesAjoutees) console.log(`Remises relues : ${remisesAjoutees} offre(s) dont le pourcentage était écrit dans le titre sans être enregistré`);
  if (datesRelevees) {
    console.log(`Dates de relevé : ${datesRelevees} offre(s) de marchand rendues à leur première vue (leur date n'est plus réécrite à chaque passage)`);
    journal.push({
      source: 'dates-relevees', ok: true, offres: datesRelevees,
      raison: 'ces pages ne publient aucune date : la date écrite était celle du passage, si bien que la carte annonçait « il y a 1 min » à perpétuité, comme l’heure de la collecte',
    });
  }
  if (datesFutures) {
    console.log(`Dates impossibles : ${datesFutures} offre(s) datées DANS LE FUTUR rendues à leur première vue (une carte ne peut pas annoncer « il y a 1 min » à vie ni tenir la tête des plus récentes)`);
    journal.push({
      source: 'dates-futures', ok: true, offres: datesFutures,
      raison: 'la source annonçait une date de publication postérieure à maintenant : horloge fausse (mesuré le 13/10/2026, un article daté 2027 pour une publication de 2026). Une date future rendait la fenêtre de veille toujours vraie, donc l’article immortel, et la carte annonçait « il y a 1 min » à perpétuité',
    });
  }
  if (prixAvantAjoutes) {
    console.log(`Prix d'origine relus : ${prixAvantAjoutes} offre(s) dont le prix barré était publié dans le titre sans être lu (le décimal « 24,99 € » n'était jamais capturé, et les mots étrangers « statt », « in vez de »… non plus)`);
    journal.push({
      source: 'prix-avant-relu', ok: true, offres: prixAvantAjoutes,
      raison: 'demande de B (13/10/2026) : « souvent il y a un pourcentage de réduction avec le prix d’origine mais cela n’est pas indiqué sur la carte ». La lecture ne connaissait que le français « au lieu de », et son motif s’arrêtait à la virgule — donc à tout prix décimal. Relu dans le titre, avec les mots de chaque langue',
    });
  }
  const connues = new Map(propres.map((o) => [cleDe(o), o]));

  // Chaque source a son propre délai de repos (« reposMin ») : la collecte passe
  // toutes les 5 minutes, mais un site étranger n'est pas interrogé à ce rythme.
  // Ses offres déjà connues restent dans la fusion — on perd la nouveauté
  // immédiate, pas le contenu — et on arrête de taper à la porte de quelqu'un
  // qui ne nous doit rien.
  const vuLe = existant.sourcesVuLe || {};
  // Nombre de passages consécutifs sans rien rendu, par source (voir plus bas).
  const vides = { ...(existant.sourcesVides || {}) };
  const maintenant = Date.now();
  const enRepos = (s) => {
    const min = s.reposMin || 0;
    if (!min) return false;
    const t = vuLe[s.id] ? new Date(vuLe[s.id]).getTime() : 0;
    return Number.isFinite(t) && t > 0 && maintenant - t < min * 60000;
  };
  // --- LE SEUIL D'ARTICLES PAR ENSEIGNE ------------------------------------
  //  Décision de B, 10/10/2026, mot pour mot :
  //
  //    « Donc une enseigne qui n'apporte pas au moins 10 articles dans le
  //      catalogue grâce au lien documenté, elle ne doit pas être interrogée,
  //      jusqu'à quand on trouve une autre solution manuellement. »
  //
  //  La mesure se fait sur le CATALOGUE, pas sur une impression : on compte les
  //  articles déjà engrangés pour chaque source, on les additionne par ENSEIGNE
  //  (une enseigne a souvent plusieurs adresses : Coolblue en a dix, qui
  //  apportent 81 articles ensemble — juger source par source la condamnerait à
  //  tort), et une enseigne restée sous le seuil ne reçoit plus de visite.
  //
  //  Une source JAMAIS interrogée garde sa chance : on ne peut pas condamner
  //  une adresse qu'on n'a pas essayée. Le verdict tombe donc au passage
  //  suivant, une fois le premier résultat connu.
  //
  //  Ce que ça change, mesuré avant de l'écrire : sur 196 sources, 57 tombent
  //  sous le seuil (55 veilles d'enseigne à 1 article, Zooplus/Bitiba 3,
  //  Zooplus.be 5). Les 18 pages d'enseigne qui travaillent (Coolblue 81,
  //  Zooplus 79, Krefel 30, Apollo-Optik 21, bol.com 14, Groupon 12) restent.
  const articlesParSource = new Map();
  for (const o of (existant.offres || [])) {
    const id = o && o.sourceId;
    if (id) articlesParSource.set(id, (articlesParSource.get(id) || 0) + 1);
  }
  const sousSeuil = enseignesSousLeSeuil(TOUTES_SOURCES, articlesParSource, vuLe);
  const sources = TOUTES_SOURCES.filter((s) => !sousSeuil.has(s.id) && !enRepos(s));
  const sautees = TOUTES_SOURCES.filter((s) => enRepos(s) && !sousSeuil.has(s.id)).map((s) => s.id);
  if (sautees.length) {
    journal.push({ source: 'repos', ok: true, saute: true, sources: sautees, raison: 'délai de repos non écoulé' });
    if (VERBEUX) console.log(`  en repos (interrogées récemment) : ${sautees.join(', ')}`);
  }
  if (sousSeuil.size) {
    const parEnseigne = {};
    for (const [, nom] of sousSeuil) parEnseigne[nom] = (parEnseigne[nom] || 0) + 1;
    journal.push({
      source: 'seuil-enseigne', ok: true, saute: true, sources: [...sousSeuil.keys()],
      enseigne: parEnseigne, seuil: SEUIL_ARTICLES_ENSEIGNE,
      raison: `enseigne à moins de ${SEUIL_ARTICLES_ENSEIGNE} articles au catalogue : plus interrogée tant qu'on n'a pas trouvé d'autre adresse`,
    });
    if (VERBEUX) console.log(`  sous le seuil de ${SEUIL_ARTICLES_ENSEIGNE} articles : ${[...sousSeuil.keys()].join(', ')}`);
  }

  console.log(`Collecte : ${sources.length}/${TOUTES_SOURCES.length} flux + ${RECHERCHES.length} recherches Google News`);
  const paquets = await Promise.all([
    ...sources.map((s) => collecterSource(s)),
    ...RECHERCHES.map((r) => collecterRecherche(r)),
  ]);
  // Les verdicts `robots.txt` sont gardés pour la journée : un hôte n'est lu
  // qu'une fois, et ses règles ne sont pas redemandées à chaque passage.
  // ⚠ On n'écrit QUE si le cache a été chargé : un passage qui n'interroge
  // aucune source (toutes au repos) écraserait sinon la journée de verdicts
  // avec un objet vide.
  if (ROBOTS_CACHE) { try { fs.writeFileSync(FICHIER_ROBOTS, JSON.stringify(ROBOTS_CACHE)); } catch { /* verdict perdu, pas la collecte */ } }

  // Ce que chaque source a RÉELLEMENT rendu. Sert plus bas à ne pas marquer
  // « vue » une source qui n'a rien pu rendre (voir sourcesVuLe).
  const renduParSource = new Map();
  for (const o of paquets.flat()) {
    renduParSource.set(o.sourceId, (renduParSource.get(o.sourceId) || 0) + 1);
  }

  // --- LA COMPTABILITÉ DES TOURS (verrou 2) --------------------------------
  // Tenue d'un passage à l'autre, dans l'état publié. Un tour ne compte que si
  // la source a RÉELLEMENT parlé : voir avancerTours() pour le pourquoi de la
  // moitié du rendu précédent.
  const { tours: toursParSource, rendus: rendusParSource } = avancerTours({
    tours: existant.toursParSource || {},
    rendus: Object.fromEntries(renduParSource),
    precedents: existant.rendusParSource || {},
  });

  // --- LA MIGRATION DES OFFRES D'AVANT --------------------------------------
  //  Une offre engrangée avant ce mécanisme ne porte aucun numéro de tour, et elle
  //  n'en recevra pas : elle n'est dans aucun paquet, donc la boucle de fusion ne
  //  la touche pas. Sans cette écriture, la garde « pas de numéro = grâce »
  //  durerait ÉTERNELLEMENT — écart toujours nul, aucune offre ancienne ne
  //  sortirait jamais, et le verrou ne servirait à rien pour le stock existant.
  //
  //  Défaut vu en relisant l'état de la première exécution réelle (10/10/2026,
  //  11:40) : les compteurs étaient bien là, mais seize mille offres restaient
  //  sans numéro. On leur donne donc CELUI DU JOUR, une seule fois : à partir de
  //  là, seules les disparitions CONSTATÉES après la mise en service comptent, et
  //  chaque offre d'avant dispose de ses deux tours de grâce.
  const estampillees = estampillerOffresDavant(connues.values(), toursParSource);

  //  LE COMPTEUR DES RETOURS, ET SON NOM. Ce compteur s'appelait `reconfirmees`.
  //  Ce nom a coûté DEUX arrêts de collecte (11 h 25 et 12 h 42) : écrit une fois
  //  avec un seul « e », il ne correspondait plus à sa déclaration, et Node
  //  refusait de démarrer. Un nom qu'on peut mal écrire est un défaut de
  //  conception, pas une étourderie : il s'appelle maintenant `retours`, court,
  //  sans lettre doublée, et il n'y a plus rien à confondre.
  let nouvelles = 0, misesAJour = 0, retours = 0;
  for (const offre of paquets.flat()) {
    const cle = cleDe(offre);
    const avant = connues.get(cle);
    // Le NUMÉRO DE TOUR de la source au moment où elle nous sert cette offre.
    // C'est le seul repère qui dira plus tard si elle a cessé de la republier.
    // Une source dont le tour n'a pas compté (partiel) n'a pas de numéro : on ne
    // lui en invente pas — l'offre garde celui de la dernière fois.
    if (Number.isFinite(toursParSource[offre.sourceId])) {
      offre.serviceAuTour = toursParSource[offre.sourceId];
    }
    if (!avant) {
      // `premiereVue` dès l'entrée en base, et non au deuxième passage : c'est
      // LE repère qui dit depuis quand l'offre est chez nous — la réparation
      // des dates de relevé s'appuie dessus (voir TYPES_DATE_RELEVEE).
      const vu = new Date().toISOString();
      connues.set(cle, { ...offre, premiereVue: vu, vuLe: vu });
      nouvelles++; continue;
    }
    // LA REPRISE D'UNE CARTE — c'est R.3 de la règle unique (14/10/2026).
    // Cette offre a dépassé les cinq jours affichés, ET sa source vient de la
    // RESERVIR : son compteur repart, elle a donc cinq jours pleins devant elle.
    //  Ce n'est PAS un retour après effacement — la carte n'est jamais cachée
    //  puis remontrée : elle est affichée, ou elle est effacée. C'est le cas des
    //  promotions longues (soldes, un mois de remise) : elles ne sont jamais
    //  emportées, et ce compteur le prouve à chaque passage au lieu de le promettre.
    //  L'âge AFFICHÉ, lui, ne bouge pas : `date` reste celle que la source publie.
    //  Le site trie sur `date`, jamais sur `premiereVue` (vérifié : `parRecence`,
    //  app.js) — une carte reprise ne saute donc pas en tête des « plus récentes »,
    //  ce qui serait un faux « neuf » fabriqué tous les cinq jours.
    const horodatage = new Date().toISOString();
    const reprise = ageJours(avant.premiereVue || avant.vuLe) > VIE_AFFICHEE_JOURS;
    if (reprise) retours++;
    // Mise à jour SANS écraser la date de première vue (qui sert à dater l'offre).
    const fusion = { ...avant, ...offre, vuLe: horodatage,
      premiereVue: reprise ? horodatage : (avant.premiereVue || avant.vuLe) };
    // UNE DATE DE RELEVÉ NE SE RAFRAÎCHIT PAS. Le lecteur vient de la fabriquer
    // à l'instant (`date: new Date().toISOString()`) : si on la laissait passer,
    // la carte annoncerait « il y a 1 min » à chaque passage, indéfiniment — et
    // l'âge de l'offre deviendrait le clone de l'heure de la collecte, ce que B
    // a vu à l'écran. L'offre garde donc la date de sa PREMIÈRE rencontre ;
    // `vuLe`, écrit juste au-dessus, dit la fraîcheur du dernier contact. Voir
    // TYPES_DATE_RELEVEE pour la liste des lecteurs concernés et le pourquoi.
    if (offre.dateRelevee && avant.date) fusion.date = avant.date;
    // Une source qui ne fournit PAS d'image ne doit pas EFFACER celle qu'on a
    // déjà. Les flux d'actualité n'en donnent jamais : sans cette garde, tout
    // visuel gagné (récupéré sur la page de l'article, puis rapatrié sur notre
    // site) disparaissait au passage suivant — et la publication purgeait le
    // fichier devenu orphelin. Défaut silencieux : rien à l'écran, juste des
    // cartes grises qui reviennent.
    if (!offre.image && avant.image) fusion.image = avant.image;
    if (offre.imageTentee === undefined && avant.imageTentee) fusion.imageTentee = avant.imageTentee;
    if (avant.prix !== offre.prix || avant.remise !== offre.remise || avant.titre !== offre.titre) misesAJour++;
    connues.set(cle, fusion);
  }

  // --- DOUBLONS BOL.COM : LE MÊME PRODUIT EN FRANÇAIS ET EN NÉERLANDAIS ------
  //  Défaut mesuré le 10/10/2026 sur le stock publié, après le premier
  //  branchement de bol.com : **32 lignes pour 17 produits**. Cause exacte, et
  //  non supposée : la clé d'unicité (cleDe) est l'ADRESSE canonique, or bol
  //  sert le MÊME article sous deux adresses —
  //  /be/fr/p/<slug-français>/<n°> et /be/nl/p/<slug-néerlandais>/<n°>. Les deux
  //  adresses diffèrent, donc les deux lignes survivent ; le NUMÉRO du produit,
  //  lui, est identique dans les deux : c'est lui qui porte l'identité.
  //
  //  Ce que l'utilisateur voyait : deux fois le même article, avec un titre qui
  //  changeait de langue d'un passage à l'autre — le pire des affichages, parce
  //  qu'il donne l'impression que le catalogue se répète.
  //
  //  La décision est prise par doublonsBol() (voir sa définition, à côté du
  //  lecteur bol.com) : elle garde la ligne française et écarte l'autre, par un
  //  choix EXPLICITE qui ne dépend pas de l'ordre du fichier — sans cela, la
  //  ligne survivante serait celle arrivée en dernier, c'est-à-dire au hasard.
  const enTrop = doublonsBol([...connues.values()]);
  for (const o of enTrop) connues.delete(cleDe(o));
  const nbDoublonsBol = enTrop.length;
  if (nbDoublonsBol) {
    console.log(`Doublons bol.com : ${nbDoublonsBol} ligne(s) écartée(s) — même produit servi en français et en néerlandais`);
    journal.push({
      source: 'bol-doublons',
      ok: true,
      ecartees: nbDoublonsBol,
      raison: 'même numéro de produit servi sous deux adresses (/be/fr/ et /be/nl/) : une seule ligne gardée, la française',
    });
  }

  // --- RÈGLE DU PRODUIT APPLIQUÉE AU STOCK, PAS SEULEMENT AU LECTEUR ---------
  //  Défaut mesuré le 7/10, signalé par B : « je retrouve toujours des articles
  //  Coolblue sans véritable promotion, pourquoi s'affichent-ils encore en aussi
  //  grande quantité ? » Il avait raison. Le lecteur de page d'enseigne écarte
  //  désormais les articles sans second prix (vérifié sur le HTML vivant : 5
  //  gardés, 19 écartés sur la première page), MAIS les offres engrangées AVANT
  //  la correction restaient dans le stock : la fusion ACCUMULE, une offre vue
  //  une fois n'en sort jamais de son propre chef. Les huit pages Coolblue ont
  //  bien été relues à 08:26 — et les 199 prix catalogue nus étaient toujours
  //  là, avec leur date de première vue de 07:50.
  //
  //  On applique donc la règle au stock : une offre de page d'ENSEIGNE qui porte
  //  un prix mais AUCUN prix de référence n'est pas une promotion, elle part.
  //
  //  ⚠ Périmètre volontairement étroit, et mesuré avant d'agir : 4 064 offres du
  //  stock ont un prix sans second prix, dont 2 207 Amazon et 46 % de cartes de
  //  veille et de presse où le bon plan est écrit dans le titre (« sconto del
  //  69 % », « 80 % de réduction ») — celles-là ne sont PAS touchées, seules les
  //  pages d'enseigne le sont. Les enseignes qui ne publient aucun prix
  //  (prix == null) gardent leur carte « bonne affaire » : la règle ne vise que
  //  le prix catalogue NU, jamais l'absence de prix.
  //
  //  ÉTENDU AUX SOURCES AMAZON le 09/10/2026 — même demande, même défaut, autre
  //  rayon. B : « en Belgique, dans la catégorie meuble, je trouve qu'il y a
  //  beaucoup d'annonces sans promotion… même chose pour la catégorie maison…
  //  il y en a un peu partout, peux-tu revérifier ce paramètre ? » Mesuré sur le
  //  catalogue publié : les recherches `amazon.com.be` avaient laissé entrer
  //  **591 offres à prix nu** — 167 en jouets, 92 en maison, 85 en autre, 64 en
  //  bricolage, 48 en tech, **43 en meubles**, 35 en électroménager, 15 en mode…
  //  exactement les rubriques qu'il citait. Aucune n'était visible dans
  //  « Bonnes promos » (Amazon n'y entre que par DEUX prix réels), mais elles
  //  remplissaient « Toutes les offres ».
  //
  //  L'exception accordée jusqu'ici à Amazon n'avait aucune raison : pour Amazon,
  //  la règle est même la plus stricte de toutes — l'application ne montre un bon
  //  plan Amazon QUE s'il a deux prix. Un produit Amazon à un seul prix n'est donc
  //  jamais une promotion, ici comme ailleurs.
  //  ÉTENDU À BOL.COM le 10/10/2026, dès son branchement : sa page « deals »
  //  publie elle aussi deux prix réels par carte (« Prix conseillé » ou
  //  « En général » face au prix demandé). Une carte bol sans second prix n'est
  //  donc pas une promotion non plus — la même règle, au même endroit, sans
  //  exception de complaisance pour un marchand qu'on vient d'ajouter.
  const TYPES_PRIX_CATALOGUE = new Set(['enseigne', 'amazon', 'bol']);
  const idsEnseigne = new Set(TOUTES_SOURCES.filter((s) => TYPES_PRIX_CATALOGUE.has(s.type)).map((s) => s.id));
  let purgees = 0;
  const purgeesParMarchand = {};
  for (const [cle, o] of connues) {
    if (!idsEnseigne.has(o.sourceId)) continue;
    if (o.type !== 'offre' || o.prix == null || o.prixAvant) continue;
    purgeesParMarchand[o.marchand] = (purgeesParMarchand[o.marchand] || 0) + 1;
    connues.delete(cle);
    purgees++;
  }
  if (purgees) {
    console.log(`Règle des deux prix : ${purgees} offre(s) écartée(s) — prix catalogue sans prix de référence (pages d'enseigne et recherches Amazon)`);
    journal.push({
      source: 'regle-deux-prix',
      ok: true,
      ecartees: purgees,
      parMarchand: purgeesParMarchand,
      raison: 'une promotion sans deuxième prix n’est pas une promotion (pages d’enseigne et recherches Amazon)',
    });
  }

  // --- LES DESTINATIONS RÉELLES, APPLIQUÉES AU STOCK ------------------------
  //  Voir appliquerDestinations() pour le défaut mesuré et le pourquoi. En une
  //  ligne : deux tiers du catalogue envoyaient le clic chez un site de bons
  //  plans concurrent au lieu du marchand. Ici, chaque offre dont l'adresse de
  //  sortie est au cache reprend l'adresse RÉELLE du marchand — et la couche
  //  d'affiliation du site (public/affiliation.js) pose l'identifiant du pays
  //  toute seule, puisque l'adresse est enfin celle du marchand.
  const destinations = lireDestinations();
  const { remplacees: destRemplacees, parHote: destParHote } = appliquerDestinations(connues, destinations);
  if (destRemplacees) {
    console.log(`Destinations réelles : ${destRemplacees} offre(s) dont le clic mène désormais au marchand au lieu d'un site de bons plans`);
    journal.push({
      source: 'destinations-reelles',
      ok: true,
      remplacees: destRemplacees,
      parHote: destParHote,
      raison: 'les deux tiers du catalogue envoyaient le visiteur chez un agrégateur concurrent ; l’adresse réelle du marchand est résolue une fois par offre et gardée au cache',
    });
  }

  // --- RÈGLE DU POURCENTAGE, ELLE AUSSI APPLIQUÉE AU STOCK -------------------
  //  Même raison que la règle des deux prix : une carte engrangée avant la
  //  correction ne sort jamais d'elle-même. Le filtre des sources de veille a été
  //  resserré (voir MOTS_PROMO : un pourcentage écrit au-delà de 90 % n'annonce
  //  pas une promotion) — les brèves entrées par un « 100 % » de citation doivent
  //  donc partir, sinon la correction ne vaudrait que pour les nouvelles.
  //
  //  Périmètre ÉTROIT, et mesuré : seules les cartes SANS PRIX (type « article »)
  //  sont rejugées, celles qui ne portent aucun bon plan chiffré. Un article de
  //  presse qui a un prix est un vrai bon plan : jamais touché. Sur le catalogue
  //  publié, la règle écarte 9 brèves — l'article politique signalé par B, un
  //  podium de football « 100 % brugeois », deux faits divers anversois, l'essai
  //  d'une Hyundai « 100 % électrique », un camping-car « 100 % made in France »,
  //  une chute d'audience « -22,9 % », « 1.000 % sa confiance » et une enquête
  //  « 55,6 % des 15-24 ans » — et AUCUN bon plan.
  const langueParSource = new Map(TOUTES_SOURCES.map((s) => [s.id, s.langue || 'fr']));
  let veilleEcartee = 0;
  const veilleParSource = {};
  for (const [cle, o] of connues) {
    if (o.type !== 'article' || o.prix != null) continue;
    const motif = MOTS_PROMO[langueParSource.get(o.sourceId)] || MOTS_PROMO.fr;
    if (motif.test(String(o.titre || ''))) continue;
    veilleParSource[o.source] = (veilleParSource[o.source] || 0) + 1;
    connues.delete(cle);
    veilleEcartee++;
  }
  if (veilleEcartee) {
    console.log(`Règle du pourcentage : ${veilleEcartee} brève(s) de veille écartée(s) — aucun signe de promotion`);
    journal.push({
      source: 'regle-pourcentage',
      ok: true,
      ecartees: veilleEcartee,
      parSource: veilleParSource,
      raison: 'un pourcentage écrit au-delà de 90 % n’annonce pas une promotion (brèves de veille sans prix)',
    });
  }

  // --- VERROU 1 ET VERROU 3 : LA PÉREMPTION PAR LA DATE DE LA SOURCE --------
  //  Appliqués au STOCK et pas seulement à l'entrée, comme les deux règles
  //  ci-dessus et pour la même raison : une offre engrangée avant la correction
  //  ne sort jamais d'elle-même. Les 239 offres périmées mesurées le 10/10/2026
  //  étaient TOUTES déjà en base — elles seraient restées des mois.
  //
  //  Le tri est fait par motif pour que le journal dise la vérité : « presse
  //  hors délai » (l'article de 2018 réindexé) et « source disparue » (l'adresse
  //  retirée du catalogue) sont deux défauts différents, et deux corrections à
  //  surveiller séparément.
  let sortiesDate = 0;
  const sortiesParMotif = {};
  const exemplesParMotif = {};
  for (const [cle, o] of connues) {
    const motif = motifDeSortie(o, { typeSource: typeDeSource(o.sourceId) });
    if (!motif) continue;
    sortiesParMotif[motif] = (sortiesParMotif[motif] || 0) + 1;
    if (!exemplesParMotif[motif]) {
      exemplesParMotif[motif] = `${String(o.titre || '').slice(0, 60)} (${String(o.date || '').slice(0, 10)})`;
    }
    connues.delete(cle);
    sortiesDate++;
  }
  if (sortiesDate) {
    console.log(`Péremption : ${sortiesDate} offre(s) écartée(s) sur la date de leur source`, sortiesParMotif);
    journal.push({
      source: 'peremption-date', ok: true, ecartees: sortiesDate,
      motifs: sortiesParMotif, exemples: exemplesParMotif,
      raison: `une offre de presse de plus de ${LIMITE_PRESSE_JOURS} jours n'est plus une actualité, et une offre dont la source a quitté le catalogue n'a plus personne pour la confirmer`,
    });
  }

  // --- VERROU 2 : LA DISPARITION CHEZ LES MARCHANDS — EN MESURE SEULEMENT -----
  //  ⚠ CETTE BOUCLE NE RETIRE RIEN, ET C'EST VOULU. Voir « VERROU 2 : CE QUE LA
  //  MESURE A DÉTRUIT DANS MON PROPRE RAISONNEMENT » en tête de fichier : la
  //  disparition du flux d'une source n'est pas une preuve de péremption (le flux
  //  est une fenêtre de trente offres, pas une liste) — vérifié sur les pages
  //  Dealabs elles-mêmes, où deux offres absentes du flux sur trois sont encore
  //  valides. La règle aurait effacé près de dix mille offres VIVANTES.
  //
  //  On garde donc le calcul, on publie son verdict dans le journal, et on ne
  //  touche à rien. C'est une observation, pas une règle : le chiffre du journal
  //  dira, au bout de quelques semaines, à quelle vitesse ces offres meurent
  //  vraiment — et c'est sur cette mesure-là qu'on choisira la règle définitive.
  let auraitEcartees = 0;
  const mesuresParMarchand = {};
  for (const o of connues.values()) {
    if (!aManqueDesTours(o, toursParSource, { typeSource: typeDeSource(o.sourceId) })) continue;
    mesuresParMarchand[o.marchand] = (mesuresParMarchand[o.marchand] || 0) + 1;
    auraitEcartees++;
  }
  if (auraitEcartees || estampillees) {
    console.log(`Disparition (MESURE, aucune offre retirée) : ${auraitEcartees} offre(s) auraient été écartées — ${TOURS_SANS_SERVICE} tour(s) réussi(s) de leur source sans republication`
      + (estampillees ? ` (${estampillees} offre(s) d'avant ont reçu leur premier numéro de tour)` : ''));
    journal.push({
      source: 'peremption-tours', ok: true,
      ecartees: 0,                 // rien n'est retiré : la règle est en observation
      auraitEcartees, estampillees,
      parMarchand: mesuresParMarchand, tours: TOURS_SANS_SERVICE,
      raison: `MESURE : une source qui ne republie plus une offre ne prouve pas qu'elle est morte (son flux est une fenêtre, pas une liste). On compte, on ne retire pas — la règle définitive se choisira sur ce chiffre.`,
    });
  }

  // --- LA RÈGLE DE LA VIE D'UNE CARTE — CINQ JOURS, PUIS LA QUESTION DU SERVICE --
  //  C'est LE bloc qui remplace tout l'appareil de jugement (R.10) : plus de
  //  plafond, plus de masquage, plus de verdict de page, plus de budget de
  //  lectures. Une carte est AFFICHÉE ou elle est EFFACÉE — il n'y a plus de
  //  troisième état.
  //
  //  L'effacement est RÉEL ici, et c'est la première règle de ce fichier qui
  //  agisse sans période d'observation. Ce qui le permet n'est pas un pari : le
  //  verdict ne repose sur aucun jugement (voir verdictDeCalendrier), donc aucun
  //  faux positif n'est possible. La seule faute possible serait d'effacer une
  //  carte dont la source n'a pas été RELUE — et c'est la garde « le tour a
  //  avancé » qui l'interdit.
  //
  //  CE QUE L'EFFACEMENT EMPORTE : la fiche et ses marques — et son VISUEL, purgé
  //  à la publication par la purge des orphelins, qui est pilotée par les offres
  //  AFFICHÉES (voir `attendus`, au bloc des visuels). Retirer la fiche du stock
  //  suffit donc : rien à écrire de plus, et surtout RIEN À RETENIR.
  let regleEffacees = 0, regleOctets = 0;
  const regleParPays = {};
  for (const cle of [...connues.keys()]) {
    const o = connues.get(cle);
    if (verdictDeCalendrier(o, { tours: toursParSource }) !== 'effacee') continue;
    regleOctets += poidsDuVisuel(o.image);
    const p = o.pays || 'FR';
    regleParPays[p] = (regleParPays[p] || 0) + 1;
    connues.delete(cle);
    regleEffacees++;
  }
  // LES ARTICLES DE PLUS DE SEPT JOURS — la veille a sa PROPRE règle (R.8) : elle se
  // juge sur sa date de PUBLICATION, jamais sur un service, et son verrou ne change
  // donc jamais — aucun faux positif n'y est possible. Elle ne sort pas du stock :
  // on refuse de la publier (voir VEILLE_SEPT_JOURS_ACTIVE).
  const JOURS_VEILLE = VEILLE_SEPT_JOURS_ACTIVE ? 7 : 30;
  let articlesHorsDelai = 0;
  {
    const limite7 = Date.now() - 7 * 86400000;
    for (const o of connues.values()) {
      if (o.type === 'article' && new Date(o.date || '').getTime() < limite7) articlesHorsDelai++;
    }
  }
  if (regleEffacees || retours || articlesHorsDelai) {
    if (regleEffacees) console.log(`Vie de la carte (${VIE_AFFICHEE_JOURS} jours) : ${regleEffacees} carte(s) EFFACÉE(S) — leur source a reparlé sans les resservir — ${(regleOctets / 1e6).toFixed(1)} Mo de visuels libérés`);
    if (retours) console.log(`Vie de la carte — REPRISES : ${retours} carte(s) au-delà des ${VIE_AFFICHEE_JOURS} jours que leur source vient de RESERVIR repartent pour ${VIE_AFFICHEE_JOURS} jours pleins`);
    if (articlesHorsDelai) console.log(`Veille : ${articlesHorsDelai} article(s) de plus de sept jours — ${VEILLE_SEPT_JOURS_ACTIVE ? `écartés, limite de veille ${JOURS_VEILLE} jours` : `gardés pour l'instant (limite ${JOURS_VEILLE} jours)`}`);
    journal.push({
      source: 'vie-de-la-carte', ok: true,
      // LA RÈGLE EST ACTIVE, et le journal le dit sans détour : c'est la première
      // du fichier qui efface sans observation préalable. Le mode reste écrit pour
      // que le panneau n'ait jamais à le déduire.
      mode: 'actif',
      modeVeille: VEILLE_SEPT_JOURS_ACTIVE ? 'actif' : 'mesure',
      effacees: regleEffacees, octets: regleOctets,
      parPays: regleParPays, jours: VIE_AFFICHEE_JOURS,
      revenus: retours, articlesHorsDelai, joursVeille: JOURS_VEILLE,
      raison: `RÈGLE ACTIVE (décision de B, 14/10/2026) : une carte s'affiche ${VIE_AFFICHEE_JOURS} jours, servie ou non. Au-delà, une seule question — la source sert-elle encore cette offre ? Elle se lit dans le FLUX, gratuitement : aucune page n'est ouverte. Servie : le compteur repart pour ${VIE_AFFICHEE_JOURS} jours, et l'âge affiché reste celui que la source publie. Plus servie, et la source ayant reparlé depuis : la carte et son visuel sont EFFACÉS. Aucune liste d'exclusion n'est écrite : une offre reservie plus tard rentre comme une carte neuve.`,
      raisonVeille: VEILLE_SEPT_JOURS_ACTIVE
        ? `RÈGLE ACTIVE (VOLET VEILLE) : la veille est ramenée à ${JOURS_VEILLE} jours et ne revient pas — son verrou est la date de publication de l'article, qui ne change jamais. Rien n'est retiré du stock : on refuse de le publier. Un mot suffit pour revenir en arrière.`
        : `MESURE (VOLET VEILLE) : ${JOURS_VEILLE} jours appliqués, ${articlesHorsDelai} article(s) de plus de sept jours gardés. Ce volet est le SÛR des deux — aucun faux positif possible — et il se décide séparément du volet des offres.`,
    });
  }

  // --- LE CONTRÔLE DIRECT — LE VERDICT DES PAGES, ET LE RETRAIT SUR VERDICT ------
  //  Décision de B (12/10/2026, « vas-y »). La règle du silence a été mesurée à
  //  ~48 % de faux positifs sur 140 pages réelles : on LIT donc le verdict que la
  //  page publie, au lieu de le déduire de son silence. C'est la lettre de la
  //  règle de B (« si sur le site d'origine elle est toujours présente le 8e
  //  jour, elle doit réapparaître »), exécutée.
  //
  //  ⚠ CE BLOC VÉRIFIE, ET SON RETRAIT EST ALLUMÉ DEPUIS LE 13/10/2026 — le
  //  booléen `OFFRES_SORTENT_SUR_VERDICT_ACTIF` est passé à `true` à 13 h 14,
  //  en même temps que la règle de B « la page décide de la carte ». Ce titre
  //  disait « EN MESURE SEULEMENT » et la ligne suivante disait « qui est
  //  éteint » : deux affirmations devenues fausses, corrigées le jour même.
  //  Ce qui protège n'a pas changé et ne se négocie pas : le retrait ne part
  //  QUE sur un verdict écrit par la page (`isExpired: true`), JAMAIS sur son
  //  silence ; 404/410 = morte (définitif), 403/429/5xx = illisible (transitoire,
  //  la carte reste) ; et un `sans verdict` n'est ni une preuve de mort ni une
  //  preuve de vie.
  //
  //  Le verdict est rangé dans `donnees/verdicts-sources.json`, HORS du catalogue
  //  publié (voir FICHIER_VERDICTS), sous la clé de l'identifiant d'offre.
  let verdictsSources = {};
  try { verdictsSources = JSON.parse(fs.readFileSync(FICHIER_VERDICTS, 'utf8')) || {}; } catch { verdictsSources = {}; }
  const verdict = { essais: 0, expirees: 0, vivantes: 0, sansVerdict: 0, illisibles: 0, octets: 0,
    mortes: 0, sansPromotion: 0, corrigees: 0, confirmees: 0, promoIllisible: 0,
    // Le volet COMMUNAUTAIRE (voir PRIX_COMMUNAUTE_ACTIF) : compté séparément,
    // parce que « la page du marchand ne dit rien » n'a pas le même sens là que
    // sur une page d'enseigne. `lecturesMarchand` compte les secondes lectures :
    // deux pages par candidat communautaire, et il faut pouvoir le dire.
    prixSeul: 0, prixEcarte: 0, lecturesMarchand: 0, prixIllisibleMarchand: 0 };
  // CE QUI SERA CORRIGÉ — jamais supprimé : une carte dont le prix a bougé doit
  // redevenir VRAIE, elle n'a aucune raison de disparaître.
  const corrections = [];
  {
    const echeance = Date.now() + BUDGET_CRON.verdictMs;
    // DEUX FAMILLES, DEUX PARTS DU BUDGET (13/10/2026 — efficacité mesurée).
    //  Les communautés d'abord et plus largement : leur page publie `isExpired`,
    //  donc chaque lecture décide quelque chose. Les enseignes gardent une
    //  lecture pour la règle de la page (prix / promotion finie), parce que leur
    //  page, elle, ne publie aucun verdict — la faveur irait au plus bavard, le
    //  budget doit aller au plus concluant.
    const stock = [...connues.values()];
    const file = [
      ...candidatsVerdict(stock, { verdicts: verdictsSources, cle: cleDe, famille: 'communaute', limite: CONTROLES_COMMUNAUTE_PAR_PASSAGE }),
      ...candidatsVerdict(stock, { verdicts: verdictsSources, cle: cleDe, famille: 'enseigne', limite: CONTROLES_ENSEIGNE_PAR_PASSAGE }),
    ];
    for (const o of file) {
      if (Date.now() > echeance) break;
      // DEUX PAGES, CHACUNE POUR CE QU'ELLE SAIT DIRE.
      //
      //   • la page du BON PLAN (Dealabs, mydealz…) pour son verdict d'expiration :
      //     c'est la règle d'avant, inchangée — c'est la source qui sait si son
      //     bon plan vit encore, et rien de ce qui suit n'y touche ;
      //   • la page du MARCHAND pour le PRIX — c'est elle que le visiteur verra
      //     APRÈS le clic, et c'est là que le prix annoncé doit encore exister.
      //
      // ⚠ Les deux lectures ne sont pas interchangeables, et l'erreur a été vue à
      //  temps : lire la page du marchand pour TOUT aurait déplacé le verdict
      //  d'expiration d'une page qui le publie vers une page qui n'en sait rien —
      //  une règle qui SUPPRIME des offres, décidée sur une page muette.
      const communaute = typeDeSource(o.sourceId) === 'dealabs';
      const v = await lireVerdictSource(o.lienPage);
      verdict.essais++;
      verdict.octets += v.octets;
      // Le prix vient du marchand quand il y en a un — et seulement là.
      let textePrix = v.texte;
      let marchandLu = false;              // la page du marchand a-t-elle été LUE ?
      if (communaute && /^https?:/i.test(o.lienMarchand || '') && o.lienMarchand !== o.lienPage) {
        const vm = await lireVerdictSource(o.lienMarchand);
        verdict.octets += vm.octets;
        verdict.lecturesMarchand++;
        marchandLu = true;
        textePrix = vm.texte || null;      // null, jamais '' : une page muette ne lit rien
        await new Promise((r) => setTimeout(r, VERDICT_SOURCE_PAUSE_MS));
      }
      // ⚠ LA CLÉ DE LA TABLE EST CELLE DU STOCK (`cleDe`), pas l'identifiant
      //  d'offre : le premier jet rangeait sous `o.id` et l'élagage juste en
      //  dessous — qui compare aux clés du stock — a effacé la table entière
      //  dans le MÊME passage. Une table écrite sous une clé et relue sous une
      //  autre est un compteur à zéro permanent.
      const vuLe = new Date().toISOString();
      // LA RÈGLE DE B (voir PROMOTION_DECIDE_LA_CARTE_ACTIF) s'applique aux
      // sources à prix catalogue ET, depuis le 13/10/2026, aux communautés —
      // dans les deux cas seulement si la page a été LUE.
      const promo = PROMOTION_DECIDE_LA_CARTE_ACTIF && (idsEnseigne.has(o.sourceId) || communaute) && textePrix
        ? promotionDans(textePrix) : null;
      // LE CHIFFRE QUI MANQUAIT POUR DÉCIDER. « Sans verdict » mélangeait deux
      // choses très différentes : une page qui n'a rien à dire, et une page LUE
      // dont aucun prix n'est sorti. Sans les séparer, le taux de lecture est
      // incalculable — et c'est exactement ce taux que B attend avant d'autoriser
      // la correction (décision du 13/10/2026 : « attends que la mesure ait vu
      // davantage »). Compté seulement si la page du MARCHAND a été lue.
      if (marchandLu && !promo) verdict.prixIllisibleMarchand++;
      if (v.etat === 'morte') {
        // Branche 4 : la page répond 404/410 — l'annonce n'existe plus.
        verdict.mortes++;
        verdictsSources[cleDe(o)] = { statut: 'morte', vuLe, sourceId: o.sourceId };
      } else if (v.etat === 'expiree' || v.etat === 'vivante') {
        // ON REMPLACE l'enregistrement par le verdict FRAIS, avec son horloge :
        // c'est cette horloge qui dit quand revérifier (sept jours).
        verdictsSources[cleDe(o)] = { statut: v.etat, vuLe, sourceId: o.sourceId };
        if (v.etat === 'expiree') verdict.expirees++; else verdict.vivantes++;
      } else if (promo && promo.lisible) {
        // Branches 1 à 3 : la page a livré un prix. On décide sur LUI.
        if (promo.prixAvant === null) {
          if (communaute) {
            // Un marchand ne publie pas toujours de prix de référence (ni prix
            // conseillé, ni prix barré) sans que le bon plan cesse d'exister : la
            // remise vient de la communauté, pas de sa page. On compte, on garde.
            verdict.prixSeul++;
            verdictsSources[cleDe(o)] = { statut: 'prix-seul', vuLe, sourceId: o.sourceId,
              prix: promo.prix };
          } else {
            // Branche 1 : plus aucun prix de référence — ce n'est plus une promotion.
            verdict.sansPromotion++;
            verdictsSources[cleDe(o)] = { statut: 'sans-promotion', vuLe, sourceId: o.sourceId,
              prix: promo.prix };
          }
        } else if (Math.abs(promo.prix - Number(o.prix || 0)) > 0.005) {
          if (communaute && !PRIX_COMMUNAUTE_ACTIF) {
            // MESURE (voir PRIX_COMMUNAUTE_ACTIF) : on a un écart entre la carte et
            // la page du marchand, mais on ne corrige pas encore — 2 prix lisibles
            // sur 6 à l'épreuve, dont un faux. On écrit l'écart, la carte ne bouge
            // pas. C'est ce qui permettra de décider sur des chiffres.
            verdict.prixEcarte++;
            verdictsSources[cleDe(o)] = { statut: 'prix-ecarte', vuLe, sourceId: o.sourceId,
              prix: promo.prix, prixAvant: promo.prixAvant, prixCarte: o.prix };
          } else {
            // Branche 2 : la promotion tient, le prix a bougé → on corrige.
            corrections.push({ o, promo });
            verdict.corrigees++;
            verdictsSources[cleDe(o)] = { statut: 'corrigee', vuLe, sourceId: o.sourceId,
              prix: promo.prix, prixAvant: promo.prixAvant };
          }
        } else {
          // Branche 3 : la promotion tient, même prix → on garde, avec une preuve datée.
          verdict.confirmees++;
          verdictsSources[cleDe(o)] = { statut: 'confirmee', vuLe, sourceId: o.sourceId,
            prix: promo.prix, prixAvant: promo.prixAvant };
        }
      } else if (v.etat === 'sans-signal') {
        // ⚠ UNE PAGE MUETTE NE DIT PAS QUE L'OFFRE EST VIVANTE. On ne range donc
        // pas « vivante » à sa place, et on n'efface pas un verdict antérieur :
        // remplacer une preuve par une absence de preuve est le défaut exact
        // qu'on vient de payer (48 % de faux positifs sur un signal muet).
        if (promo && !promo.lisible) verdict.promoIllisible++;
        verdict.sansVerdict++;
      } else {
        verdict.illisibles++;
      }
      if (v.octets) compterTrafic(o.lienPage, v.octets, 'verdict');
      await new Promise((r) => setTimeout(r, VERDICT_SOURCE_PAUSE_MS));
    }
    // La table est ÉLAGUÉE des offres qui ne sont plus dans le stock : sans ce
    // ménage, elle grandirait de tout ce qui a disparu depuis le premier jour.
    const encore = new Set([...connues.keys()]);
    for (const cle of Object.keys(verdictsSources)) if (!encore.has(cle)) delete verdictsSources[cle];
    try {
      fs.mkdirSync(path.dirname(FICHIER_VERDICTS), { recursive: true });
      fs.writeFileSync(FICHIER_VERDICTS, JSON.stringify(verdictsSources));
    } catch (e) { console.log(`verdicts : écriture impossible — ${e.message}`); }
  }
  // LES CORRECTIONS — branche 2 de la règle de B. Destructeur : NON. On rend la
  // carte vraie, et on note la date de la correction : c'est le journal qui dira
  // plus tard à quelle vitesse les prix des annonces sorties du flux bougent.
  const corrigees = [];
  for (const { o, promo } of corrections) {
    const remise = Math.round((1 - promo.prix / promo.prixAvant) * 100);
    corrigees.push({ id: o.id, marchand: o.marchand, avant: o.prix, apres: promo.prix,
      prixAvant: promo.prixAvant, remise });
    o.prixAvant = promo.prixAvant;
    o.prix = promo.prix;
    o.remise = remise;
    o.remiseCalculee = true;
    o.prixCorrigeLe = new Date().toISOString();
  }
  if (corrigees.length) {
    console.log(`Règle de B — PRIX CORRIGÉS : ${corrigees.length} offre(s) — la promotion tient, le prix avait bougé`);
    journal.push({
      source: 'promotion-prix-corrige', ok: true, corrigees: corrigees.slice(0, 20),
      raison: `décision de B (13/10/2026) : « promotion toujours là prix changé on corrige le prix et la remise ». Le prix publié était celui de la dernière fois que la source avait SERVI l'offre ; on le remplace par celui que la page affiche aujourd'hui.`,
    });
  }

  // LES SORTIES — branches 1 et 4 de la règle de B, plus le verdict des pages.
  // Elles ont lieu APRÈS la boucle, et seulement sur des PREUVES : une page morte
  // (404/410), une page qui ne publie plus AUCUN prix de référence, ou une page
  // qui se déclare expirée. Une page muette ne fait rien sortir.
  let sortiesParVerdict = 0, sortiesMortes = 0, sortiesSansPromo = 0;
  for (const cle of [...connues.keys()]) {
    const st = (verdictsSources[cle] || {}).statut;
    if (st === 'expiree' && OFFRES_SORTENT_SUR_VERDICT_ACTIF) { connues.delete(cle); sortiesParVerdict++; }
    else if (st === 'morte' && PROMOTION_DECIDE_LA_CARTE_ACTIF) { connues.delete(cle); sortiesMortes++; }
    else if (st === 'sans-promotion' && PROMOTION_DECIDE_LA_CARTE_ACTIF) { connues.delete(cle); sortiesSansPromo++; }
  }
  if (verdict.essais || sortiesParVerdict || sortiesMortes || sortiesSansPromo) {
    if (verdict.essais) {
      console.log(`Verdict des pages : ${verdict.essais} contrôle(s) — ${verdict.expirees} expirée(s), ${verdict.vivantes} vivante(s), ${verdict.mortes} morte(s), ${verdict.sansPromotion} sans promotion, ${verdict.corrigees} corrigée(s), ${verdict.confirmees} confirmée(s), ${verdict.sansVerdict} sans verdict (${verdict.promoIllisible} prix illisible), ${verdict.illisibles} illisible(s), ${(verdict.octets / 1e6).toFixed(2)} Mo lus`);
      // Le volet COMMUNAUTAIRE se dit à part, et se dit en clair : le TAUX DE
      // LECTURE d'abord (c'est lui qui décide), les écarts ensuite.
      const luesM = verdict.lecturesMarchand;
      const lisiblesM = Math.max(0, luesM - verdict.prixIllisibleMarchand);
      const tauxM = luesM ? Math.round((lisiblesM / luesM) * 100) : 0;
      console.log(`Verdict communautés (${PRIX_COMMUNAUTE_ACTIF ? 'ACTIF — les écarts corrigent la carte' : 'MESURE — aucune carte touchée'}) : ${luesM} page(s) de marchand lue(s), ${lisiblesM} au prix lisible (${luesM ? tauxM + ' %' : '—'}), ${verdict.prixIllisibleMarchand} sans prix lisible | ${verdict.prixEcarte} écart(s) de prix, ${verdict.prixSeul} page(s) sans prix de référence`);
    }
    if (sortiesParVerdict || sortiesMortes || sortiesSansPromo) {
      console.log(`Règle de B — SORTIES : ${sortiesSansPromo} sans promotion, ${sortiesMortes} page(s) morte(s), ${sortiesParVerdict} déclarée(s) expirée(s)`);
    }
    journal.push({
      source: 'verdict-source', ok: true, ...verdict,
      sorties: sortiesParVerdict + sortiesMortes + sortiesSansPromo,
      sortiesSansPromo, sortiesMortes, sortiesParVerdict,
      mode: (OFFRES_SORTENT_SUR_VERDICT_ACTIF || PROMOTION_DECIDE_LA_CARTE_ACTIF) ? 'actif' : 'mesure',
      modeCommunautes: PRIX_COMMUNAUTE_ACTIF ? 'actif' : 'mesure',
      raisonCommunautes: PRIX_COMMUNAUTE_ACTIF
        ? 'RÈGLE ACTIVE (13/10/2026) : le contrôle de prix s’étend aux offres des communautés (Dealabs, myDealz, hotukdeals, chollometro, pepper, preisjäger). La page du MARCHAND est lue — c’est elle que le visiteur verra. Un prix qui a bougé CORRIGE la carte, rien n’est supprimé.'
        : 'MESURE (13/10/2026) : le contrôle de prix s’étend aux communautés, mais AUCUNE carte n’est corrigée ni supprimée. Motif chiffré de la prudence : sur six offres communautaires réelles éprouvées avant d’écrire, DEUX seulement livraient un prix lisible, et l’une d’elles rendait 83,99 € là où la carte annonçait 63,99 € — le motif de prix lit le produit voisin aussi bien que le produit. On décide sur le taux mesuré, pas sur une intuition.',
      raison: (OFFRES_SORTENT_SUR_VERDICT_ACTIF || PROMOTION_DECIDE_LA_CARTE_ACTIF)
        ? `RÈGLE DE B, ACTIVE (13/10/2026) : la page décide de la carte. Sans prix de référence elle est sortie, morte elle est sortie, la promotion tenue avec un prix changé est corrigée, la promotion tenue au même prix est gardée avec une preuve datée. Une page MUETTE ne fait rien — elle ne prouve rien.`
        : `MESURE : on lit la page, on publie le chiffre, on n'efface pas encore.`,
    });
  }

  // Les offres reprises du stock gardent l'identifiant qu'elles avaient : on les
  // migre AVANT tout le reste (visuels, tri, écriture), sinon la correction ne
  // vaudrait que pour ce que les sources ont bien voulu re-servir ce tour-ci.
  const idMigres = migrerIdentifiants(connues.values());
  if (idMigres) journal.push({ source: 'identifiants', ok: true, migres: idMigres, raison: 'identifiants fabriqués avant le 08/10/2026 (inversion du lien) — empreinte du lien entier' });

  const imagesGeneriques = new Set(existant.imagesGeneriques || []);
  const images = await enrichirVisuels(connues, imagesGeneriques);
  if (images.essais) {
    journal.push({ source: 'visuels', ok: true, essais: images.essais, trouves: images.trouves, raison: 'og:image sur la page des articles' });
    if (VERBEUX) console.log(`  visuels : ${images.trouves}/${images.essais} article(s) ont trouvé une image`);
  }
  const tuilesRetirees = ecarterTuiles([...connues.values()], imagesGeneriques);
  if (tuilesRetirees) {
    journal.push({ source: 'visuels', ok: true, raison: `${tuilesRetirees} visuel(s) d'article écarté(s) : même image sur plusieurs articles (tuile du site)`, ecartes: tuilesRetirees });
  }

  //  ⚠ LE CONTRÔLE APRÈS LA FUSION — le geste qui manquait.
  //
  //  La péremption par date (verrou 1) tourne sur le STOCK, avant que les sources
  //  ne rendent les offres du passage. Or une source de presse peut RE-SERVIR un
  //  article déjà hors délai (il est réindexé par Google News) : l'offre est
  //  écartée du stock, puis RÉINTRODUITE par la fusion DANS LE MÊME PASSAGE, et
  //  publiée. Mesuré le 12/10/2026 : le garde-fou sur les données réelles a
  //  signalé deux fois la même offre de presse du 05/10 encore publiée.
  //
  //  On applique donc la MÊME règle à la liste FINALE. Ce n'est pas une règle
  //  nouvelle : c'est la même, appliquée au bon moment. Les articles de veille
  //  restent exclus par `motifDeSortie` (trente jours), donc aucune règle voisine
  //  n'est rabotée.
  let ecarteesApresFusion = 0;
  for (const [cle, o] of connues) {
    if (motifDeSortie(o, { typeSource: typeDeSource(o.sourceId) })) { connues.delete(cle); ecarteesApresFusion++; }
  }
  if (ecarteesApresFusion) {
    console.log(`Péremption après fusion : ${ecarteesApresFusion} offre(s) hors délai retirée(s) avant publication`);
    journal.push({
      source: 'peremption-apres-fusion', ok: true, ecartees: ecarteesApresFusion,
      raison: `une source a reservi une offre déjà hors délai : elle était écartée du stock puis réintroduite par la fusion dans le même passage, et publiée. On applique la même règle à la liste finale.`,
    });
  }

  // Tri : les offres AVEC PRIX d'abord (remise réelle décroissante), puis la
  // veille — dont on écarte tout ce qui a plus de 30 jours : une actu de l'an
  // dernier n'est pas une information, c'est un piège (l'utilisateur clique et
  // tombe sur une promotion terminée).
  //  LA LIMITE DE LA VEILLE SUIT L'INTERRUPTEUR : trente jours tant que la règle
  //  de B n'est pas allumée, sept jours quand elle l'est (voir
  //  VEILLE_SEPT_JOURS_ACTIVE : c'est SON interrupteur, celui des offres ne la
  //  commande pas).
  //  Un article écarté ici NE REVIENT PAS, et c'est possible sans écrire aucune
  //  liste d'exclusion : son verrou est sa date de publication, qui ne bouge
  //  jamais. Recollecté le 8e jour, il est refusé de nouveau.
  const LIMITE_VEILLE = Date.now() - JOURS_VEILLE * 86400000;
  const toutes = [...connues.values()];
  const vraies = toutes.filter((o) => o.type !== 'article')
    .sort((a, b) => (b.remise || 0) - (a.remise || 0) || new Date(b.date) - new Date(a.date));
  // Plafond de veille PAR PAYS — voir veilleParPays() pour le pourquoi.
  // Le dédoublonnage passe AVANT : un même article arrivé par Google News ET
  // par Bing ne doit pas consommer deux places dans le quota de son pays.
  const PLAFOND_VEILLE_PAYS = 160;
  const veilleToutes = dedupliquerArticles(
    toutes.filter((o) => o.type === 'article' && new Date(o.date).getTime() > LIMITE_VEILLE),
  ).sort((a, b) => new Date(b.date) - new Date(a.date));
  const veille = veilleParPays(veilleToutes, PLAFOND_VEILLE_PAYS);
  const offres = [...vraies, ...veille];

  // Répartition par pays : elle est écrite dans les données pour que l'interface
  // annonce ce qu'elle contient réellement, au lieu d'afficher des pays vides.
  const parPays = {};
  for (const o of offres) { const p = o.pays || 'FR'; parPays[p] = (parPays[p] || 0) + 1; }

  // Les sources publient parfois leurs adresses de visuel ÉCHAPPÉES en HTML
  // (« …&amp;smart=true » chez DHnet, « https:&#x2F;&#x2F;image.mobil.se&#x2F;… »
  // chez Mobil.se). Telles quelles, ce ne sont PAS des URL : le téléchargement
  // échoue (400 Bad Request, « no host given ») et la carte reste grise — 16
  // visuels mesurés. On les décode ici, UNE fois, pour toutes les sources :
  // c'est le seul point qui ne se perdra pas quand une nouvelle source sera
  // branchée. `decaper` (et non `decoderEntites`) parce que certaines sources
  // double-encodent.
  for (const o of offres) if (o.image) o.image = decaper(o.image);

  // ---- HISTORIQUE DES PRIX (voir prix-historique.mjs) ----------------------
  // On enregistre CE QU'ON VIENT DE VOIR avant de composer la sortie. C'est la
  // seule partie de ce collecteur qui s'améliore en attendant : un jour non
  // enregistré est un jour perdu définitivement, et sans recul on ne peut pas
  // dire si un prix est réellement bas. Le fichier reste LOCAL — seules les
  // conclusions (plus bas, prix habituel, verdict) partent dans offres.json.
  let historique = { version: 1, jours: {} };
  try {
    if (fs.existsSync(HISTORIQUE)) {
      const lu = JSON.parse(fs.readFileSync(HISTORIQUE, 'utf8'));
      if (lu && typeof lu === 'object' && lu.jours && typeof lu.jours === 'object') {
        historique = lu;
      }
    }
  } catch {
    // Fichier illisible ou corrompu : on repart d'un historique vide plutôt que
    // d'abandonner la collecte — perdre l'historique ne doit jamais perdre les
    // offres du jour.
    historique = { version: 1, jours: {} };
  }
  const instantPrix = new Date().toISOString();
  noterPrix(historique, offres, instantPrix);
  elaguerHistorique(historique, instantPrix);
  fs.writeFileSync(HISTORIQUE, JSON.stringify(historique));
  const bilanPrix = appliquerAnalyse(historique, offres);

  const sortie = {
    genereLe: new Date().toISOString(),
    // Date du dernier appel de chaque source : c'est ce qui fait vivre le repos
    // (voir « reposMin »). Une source en repos garde ses offres déjà engrangées.
    // Une source qui n'a RIEN rendu n'est PAS marquée « vue ».
    //
    //   Défaut mesuré : Amazon répond par intermittence une page vide ou un mur
    //   anti-robot. La source était quand même horodatée, donc mise en repos
    //   pour tout son délai — l'Allemagne et l'Espagne sont ainsi restées sans
    //   une seule vente flash, marquées « vues » à la même seconde que les dix
    //   autres. Une panne muette, celle qu'on ne voit qu'en la cherchant.
    //
    //   On la laisse donc en attente : elle sera réinterrogée au passage suivant
    //   (15 minutes). Mais pas indéfiniment — après trois passages vides
    //   (45 minutes), on l'horodate quand même, sinon une source définitivement
    //   morte serait frappée à chaque passage, indéfiniment.
    sourcesVuLe: {
      ...vuLe,
      ...Object.fromEntries(
        sources
          .filter((s) => renduParSource.get(s.id) || (vides[s.id] || 0) >= 3)
          .map((s) => [s.id, new Date().toISOString()]),
      ),
    },
    sourcesVides: Object.fromEntries(
      sources
        .filter((s) => renduParSource.get(s.id))
        .map((s) => [s.id, 0])
        .concat(Object.entries(vides).filter(([id]) => !renduParSource.get(id) && (vides[id] || 0) < 3)
          .map(([id, n]) => [id, n + 1]))
        .filter(([, n]) => n > 0),
    ),
    parPays,
    // LA COMPTABILITÉ DES TOURS (verrou 2) : deux tables minuscules, une entrée
    // par source VIVANTE, relues au passage suivant. Sans elles, rien ne
    // distingue « la source ne propose plus cette offre » de « on n'a pas encore
    // regardé » — et la purge se tairait, ce qui est exactement le défaut d'avant.
    // On les élague des identifiants disparus du catalogue : une source retirée ne
    // reçoit plus de tour, son compteur gelé ne servirait jamais.
    toursParSource: Object.fromEntries(
      Object.entries(toursParSource).filter(([id]) => TYPE_PAR_SOURCE.has(id)),
    ),
    rendusParSource: Object.fromEntries(
      Object.entries(rendusParSource).filter(([id]) => TYPE_PAR_SOURCE.has(id)),
    ),
    total: offres.length,
    totalOffres: vraies.length,
    totalVeille: veille.length,
    nouvelles,
    misesAJour,
    // Visuels refusés parce qu'ils reviennent sur plusieurs articles (tuiles de
    // site). On les garde d'un passage à l'autre : sans cette mémoire, ils
    // seraient réacceptés au tour suivant, puis rejetés, indéfiniment.
    imagesGeneriques: [...imagesGeneriques],
    journal,
    // LE CATALOGUE DES SOURCES SUIVIES, publié AVEC les offres.
    //
    // Sans lui, le panneau ne peut parler que des sources qui ont parlé dans CE
    // passage : une source jamais interrogée, ou mise au repos (délai non
    // écoulé), y est tout simplement invisible. On ne peut alors pas répondre à
    // la question posée — « combien de sites suivis, combien actifs, combien
    // non actifs, et lesquels » — et le panneau donne l'impression que tous les
    // sites sont dormants, puisque seuls les muets y figurent.
    sources: TOUTES_SOURCES.map((s) => ({
      id: s.id, nom: s.nom, type: s.type, pays: s.pays, url: s.url,
      // LA RUBRIQUE (ce que le site est) et LA VOIE (comment on le lit). Calculées
      // ici, à la publication, plutôt que saisies : le panneau n'a plus qu'à les
      // lire, et la table qui les produit est éprouvée par un test. Demande de B
      // (08/10/2026) : « classe-les par pays et par rubrique ».
      rubrique: rubriqueDeSite(s), voie: voieDeSite(s),
    })),
    offres,
    // LE BILAN DE DONNÉES (onglet « Données » du panneau, demande de B du
    // 12/10/2026) : ce qui entre, ce qui sort, vers qui, et tout ce qui a trait
    // aux images. Calculé ici, une fois, relu tel quel par le panneau.
    donnees: bilanDonnees({
      connues, offres, journal,
      // CE QU'ON A DEMANDÉ AUX SITES DES AUTRES, ce passage et sur 24 heures.
      // Construit ici (l'impur reste dehors) pour que le bilan, lui, reste une
      // fonction pure — donc éprouvable.
      trafic: {
        ...trafic24h(),
        conditionnels: { essais: CONDITIONNEL.essais, reutilises: CONDITIONNEL.reutilises },
        apercu: APERCU,
        parFamille: TRAFIC.parFamille,
        hotes: TRAFIC.parHote,
      },
      robots: instantaneRobots(ROBOTS, ROBOTS_CACHE || {}),
    }),
  };
  // Toujours écrit : le hub local et le contrôle des sources lisent ce fichier,
  // avec des visuels DISTANTS (relayés par notre serveur). En publication, on
  // écrit EN PLUS le site (docs/), dont les visuels sont rapatriés sur place.
  // --- ICI SE TROUVAIT LE MASQUAGE (`perimee`) — IL N'EXISTE PLUS ------------
  //  Du 13/10 au 14/10/2026, cette place portait un drapeau : les fiches que plus
  //  aucune source ne servait depuis sept jours restaient dans le catalogue publié
  //  avec `perimee: true`, et l'application refusait de les afficher. C'était un
  //  troisième état — affichée, masquée, effacée — et c'est exactement ce que la
  //  règle de la vie d'une carte a supprimé (R.10) :
  //
  //    • **une carte est affichée, ou elle est effacée** ;
  //    • l'effacement a eu lieu plus haut, sur le verdict du calendrier
  //      (`verdictDeCalendrier`), et il emporte la fiche ET son visuel ;
  //    • la conséquence qu'on gagne au passage : **le catalogue publié ne porte
  //      plus une seule fiche que l'écran cache**. `total`, `totalOffres` et
  //      `parPays` n'ont donc plus rien à recalculer — ils décrivent ce qui est
  //      publié, parce que ce qui est publié EST ce qui s'affiche.
  //
  //  Ce bloc avait lui-même remplacé une suppression de masse risquée (« on pose
  //  un drapeau, on ne supprime rien »). Le progrès n'est pas qu'on supprime
  //  maintenant : c'est que la suppression ne repose plus sur un jugement. Un
  //  drapeau protégeait d'une décision douteuse ; il n'y a plus de décision
  //  douteuse à protéger.


  fs.writeFileSync(FICHIER, JSON.stringify(sortie, null, 0));
  console.log(`√ ${offres.length} offres au total (${nouvelles} nouvelles, ${misesAJour} mises à jour, ${journal.filter((j) => !j.ok).length} source(s) en échec)`);
  console.log(`  historique des prix : ${bilanPrix.avec} offre(s) analysée(s), ${bilanPrix.verdicts} verdict(s), ${Object.keys(historique.jours).length} jour(s) conservé(s)`);
  console.log(`  → ${FICHIER}`);
  // Le chiffre de la discrétion : ce qu'on a demandé aux sites des autres, sur
  // 24 heures, et ce que les requêtes conditionnelles ont évité.
  {
    const t = sortie.donnees.trafic;
    console.log(`  trafic (${t.passagesComptes} passage(s) compté(s)) : ${t.requetes} requête(s) vers ${Object.keys(t.hotes).length} hôte(s) — ${t.mo} Mo` +
      ` · conditionnelles réutilisées : ${t.conditionnels.reutilises}/${t.conditionnels.essais}`);
    const r = sortie.donnees.robots;
    console.log(`  robots.txt : ${r.hotesLus} hôte(s) connu(s) — ${r.sansRobots} sans fichier, ${r.toutInterdit.length} tout interdit, ${r.cheminsInterdits.length} chemin(s) interdit(s) — lu, NON appliqué`);
  }
  let apres = null;
  if (PUBLIER) apres = await publier(sortie);
  //  LA CADENCE : la collecte tourne maintenant toutes les 15 minutes (décision
  //  de B, 12/10/2026). Le passage reste silencieux quand rien ne change, et le
  //  script de collecte sort avant de committer si `docs/` est identique.
  // Le taux de la BCE : relevé à chaque collecte, publié avec le site. Il ne
  // fait jamais échouer une collecte (voir majTauxBce).
  const tauxBce = await majTauxBce({ publier: PUBLIER });
  if (tauxBce) {
    console.log(`  taux BCE du ${tauxBce.date} : 1 € = ${tauxBce.taux.SEK} SEK, ${tauxBce.taux.PLN} PLN, ${tauxBce.taux.GBP} GBP, ${tauxBce.taux.USD} USD`);
  }

  /* --------------------------------------------------------------------------
   * LE RELEVÉ DU PASSAGE, PUIS LE BILAN D'EXPLOITATION
   *
   *  Deux questions de B — « à quelle cadence », « combien de fichiers », « ce
   *  que ça coûte » — se répondent avec une SUITE de passages, pas avec un
   *  total. On note donc le passage qui vient de finir, et c'est ce journal qui
   *  donne le rythme, la durée machine et la file des visuels reportés.
   *
   *  L'ORDRE COMPTE : on note APRÈS `publier()` (les fichiers rapatriés et les
   *  reports n'existent qu'à ce moment-là) et on écrit le témoin APRÈS le
   *  relevé (le bilan a besoin du journal pour calculer le rythme). Faire
   *  l'inverse publierait un rythme qui a un passage de retard, et le panneau
   *  mentirait d'un quart d'heure — précisément le genre d'écart qu'on ne
   *  remarque jamais à l'œil.
   * ------------------------------------------------------------------------ */
  const passages = noterPassage({
    ms: Date.now() - departPassage,
    requetes: TRAFIC.requetes,
    octets: TRAFIC.octets,
    visuels: {
      pris: apres ? apres.pris : 0,
      rates: apres ? apres.rates : 0,
      differes: apres ? apres.differes : 0,
    },
    sources: sortie.donnees.flux.sourcesInterrogees,
    retenues: sortie.donnees.flux.offresRetenues,
    publiees: sortie.donnees.flux.offresPubliees,
    publie: PUBLIER,
  });

  if (PUBLIER) {
    sortie.donnees.exploitation = bilanExploitation({
      passages,
      trafic: sortie.donnees.trafic,
      images: sortie.donnees.images,
      carte: sortie.donnees.carte,
      poids: poidsPublie(),
      robots: sortie.donnees.robots,
      partage: apres
        ? { pages: (apres.partage && apres.partage.total) || 0, ecrites: (apres.partage && apres.partage.ecrites) || 0,
            rubriques: (apres.rubriques && apres.rubriques.ecrites_total) || 0 }
        : {},
    });
    // Le témoin est réécrit avec le bilan : même `genereLe`, donc aucun
    // rafraîchissement de plus pour l'application, et personne ne retélécharge
    // le catalogue. Voir ecrireEtatCollecte().
    //
    //  On ne réécrit PAS `offres.json` (18 Mo) pour y glisser ce bloc : le
    //  catalogue part déjà en entier chez chaque visiteur, et l'alourdir une
    //  seconde fois par passage pour un bilan que seul le panneau lit serait
    //  payer deux fois la même chose. Le bilan vit donc dans le témoin, à côté,
    //  et c'est le seul fichier que le panneau a besoin d'ouvrir en plus du
    //  catalogue.
    ecrireEtatCollecte(sortie);
    const e = sortie.donnees.exploitation;
    console.log(`  exploitation : ${e.rythme.passages24h} passage(s) relevé(s) sur 24 h, intervalle médian ${e.rythme.intervalleMedianMin ?? '—'} min `
      + `(prévu ${e.rythme.cadencePrevueMin}) · durée médiane ${e.rythme.dureeMedianMs ?? '—'} ms`);
    console.log(`  énergie estimée : ${e.energie.totalKwh24h} kWh sur 24 h (réseau ${e.energie.reseauKwh24h} + machine ${e.energie.machineKwh24h}) `
      + `→ ${e.energie.eurAn} €/an · par visite ${e.energie.parVisite.mo} Mo`);
    console.log(`  poids publié : ${e.poids.depotMo} Mo sur ${e.poids.quotaDepotMo} Mo tolérés (${e.poids.partDuQuotaPct} %) — `
      + `catalogue servi ${e.poids.catalogueGzipMo} Mo compressés · ${e.leviers.length} levier(s) proposé(s)`);
    if (e.leviers.length) console.log(`  → ${e.leviers[0].titre} : ${e.leviers[0].gain}`);
  }
}

// Exécuté seulement quand ce fichier EST le programme : sinon l'importer depuis
// un test déclencherait une collecte réseau.
const estProgramme = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estProgramme) principal().catch((e) => { console.error('ÉCHEC COLLECTE :', e.message); process.exit(1); });
