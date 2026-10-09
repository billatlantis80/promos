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
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  noterPrix, elaguerHistorique, appliquerAnalyse,
} from './prix-historique.mjs';

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
 *  Le planificateur tue ce script au bout de 120 s :
 *      « Script timed out after 120s ».
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
 * ------------------------------------------------------------------ */
const LIMITE_CRON_MS = 120000;
const BUDGET_CRON = {
  // Collecte des flux : toutes les sources sont interrogées en parallèle, donc
  // cette part vaut le temps de la plus lente, pas leur somme. Marge large.
  sourcesMs: 45000,
  // Recherche de l'image d'aperçu sur la page des articles (une par article,
  // avec une pause entre deux : on est invité chez des gens).
  visuelsMs: 30000,
  // Rapatriement des visuels dans docs/img, pour que le site soit autonome.
  telechargementsMs: 25000,
};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/** Seuil de « température » sous lequel une offre Dealabs n'est pas retenue.
 *  Le flux « tendance » ne contient que des offres déjà très appréciées
 *  (108° à 580° observés) : le seuil ne coupe rien aujourd'hui, il est là pour
 *  que « les meilleures » reste une règle du code et non un hasard du flux. */
const TEMPERATURE_MIN = 100;

/** Intervalle minimal entre deux appels au flux Dealabs. Le cron tourne toutes
 *  les 5 minutes ; on n'interroge Dealabs qu'une fois sur trois. Les offres
 *  déjà connues restent (la fusion les conserve) : on perd la nouveauté
 *  immédiate côté Dealabs, pas le contenu — et on arrête de taper à sa porte
 *  toutes les 5 minutes. */
/* Le délai vit maintenant DANS chaque source (« reposMin »), parce que la même
   règle vaut pour toutes : Dealabs 15 min, les sites étrangers 15 à 30 min. Une
   constante unique obligeait à traiter Dealabs à part ; le champ, non. */

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
  // Le pays par nom d'acteur : la base du marché le porte, et c'est elle qui
  // décide dans quel pays ranger les offres lues.
  let acteurs = [];
  try {
    const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'acteurs.json'), 'utf8'));
    acteurs = (b && b.acteurs) || [];
  } catch { /* base manquante : on retombera sur BE */ }
  return sourcesAdressesDepuis(table, acteurs, SOURCES_ENSEIGNES);
}

/** LA RÈGLE, ISOLÉE DE LA LECTURE DU DISQUE — c'est elle que les tests exercent.
 *
 *  Prend la table {nom: url}, la base d'acteurs, et les sources déjà câblées.
 *  Rend les sources de type `enseigne` correspondantes. Séparer la règle de la
 *  lecture permet de l'éprouver sur des cas fabriqués (URL vide, adresse déjà
 *  câblée, nom inconnu de la base) sans dépendre d'un fichier présent. */
export function sourcesAdressesDepuis(table, acteurs, dejaCablees = []) {
  const paysDe = new Map();
  for (const a of (acteurs || [])) if (!paysDe.has(a.nom)) paysDe.set(a.nom, a.pays);
  const dejaLue = new Set((dejaCablees || []).map((s) => s.url));
  const vues = new Set();
  const faites = [];
  for (const [nom, url] of Object.entries(table || {})) {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u) || dejaLue.has(u) || vues.has(u)) continue;
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
  if (s.type === 'amazon' || s.type === 'flash') return 'e-commerce';
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
export const TOUTES_SOURCES = [...SOURCES, ...SOURCES_ENSEIGNES, ...SOURCES_ADRESSES, ...SOURCES_ACTIVITES, ...SOURCES_AMAZON, ...SOURCES_VENTES_FLASH, ...VEILLE_PAYS, ...VEILLE_BING, ...VEILLE_ENSEIGNES];

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
    // en
    'gym', 'bike', 'bicycle', 'cycling', 'hiking', 'swimming', 'tent', 'dumbbell', 'outdoor', 'running shoes', 'treadmill', 'fishing',
    // de
    'fahrrad', 'rad', 'wandern', 'laufen', 'fussball', 'schwimmen', 'zelt', 'hantel', 'outdoor', 'e-bike', 'laufband', 'angeln',
    // nl
    'fiets', 'wielrennen', 'wandelen', 'hardlopen', 'voetbal', 'zwemmen', 'tent', 'kamperen', 'halters', 'e-bike', 'loopband', 'vissen',
    // es
    'deporte', 'bicicleta', 'ciclismo', 'senderismo', 'correr', 'futbol', 'natacion', 'esqui', 'tienda de campana', 'mancuernas', 'cinta de correr', 'pesca',
    // it
    'bicicletta', 'bici', 'escursionismo', 'corsa', 'calcio', 'nuoto', 'sci', 'tenda', 'campeggio', 'manubri', 'tapis roulant', 'pesca',
    // pt
    'desporto', 'bicicleta', 'ciclismo', 'caminhada', 'corrida', 'futebol', 'natacao', 'esqui', 'tenda', 'campismo', 'halteres', 'passadeira', 'pesca',
    // pl
    'rower', 'kolarstwo', 'trekking', 'bieganie', 'pilka nozna', 'plywanie', 'joga', 'tenis', 'narty', 'namiot', 'kemping', 'hantle', 'bieznia', 'wedkarstwo',
    // sv
    'cykel', 'cykling', 'vandring', 'lopning', 'fotboll', 'simning', 'skid', 'talt', 'hantlar', 'löparband', 'fiske',
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
  if (prix != null && prixAvant != null && prixAvant > prix) {
    return { pourcent: Math.round(((prixAvant - prix) / prixAvant) * 100), calculee: true };
  }
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
  const avant = versPrix((texte.match(/au lieu de\s*([^.,;]{0,20})/i) || [])[1] || '');
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
 */
const MOTS_PROMO = {
  fr: /(bon plan|bons plans|promo|promotion|r[ée]duction|\d+\s?%|perd \d+|prix cass|petit prix|deal|affaire|soldes|black friday|chute à|tombe à|code promo)/i,
  nl: /(koopje|aanbieding|korting|promotie|deal|actie|\d+\s?%|prijsval|gedaald|goedkoper|kortingscode)/i,
  de: /(angebot|rabatt|aktion|schn[aä]ppchen|deal|preissturz|reduziert|g[uü]nstiger|\d+\s?%|statt \d|nur \d|gutschein)/i,
  es: /(oferta|descuento|chollo|rebaja|promoci[oó]n|gan?a|\d+\s?%|precio|cup[oó]n)/i,
  it: /(offerta|sconto|promozione|occasione|prezzo|ribass|\d+\s?%|miglior prezzo|coupon)/i,
  pt: /(promo[çc][aã]o|desconto|oferta|saldo|barato|pre[çc]o|\d+\s?%|mais barato|cup[aã]o)/i,
  pl: /(promocja|zni[żz]ka|okazja|przecena|taniej|\d+\s?%|cena|rabat)/i,
  sv: /(erbjudande|rabatt|rea|kampanj|pris|s[aä]nkt|\d+\s?%|billigare)/i,
  en: /(deal|offer|discount|sale|bargain|\d+\s?%|price drop|cheap|£\d|promo)/i,
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
  const avant = versPrix((texte.match(/au lieu de\s*([^.,;]{0,20})/i) || [])[1] || '');
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

async function lire(url, langue = 'fr-FR,fr;q=0.9', delai = DELAI_LECTURE_MS) {
  const r = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': langue },
    redirect: 'follow',
    signal: AbortSignal.timeout(delai),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
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
function lireParCurl(url, langue = 'fr-BE,fr;q=0.9') {
  return new Promise((resolve, reject) => {
    execFile('curl', [
      '-fsS', '-L', '--compressed', '--max-time', '15',
      '-A', UA, '-H', `Accept-Language: ${langue}`,
      url,
    ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 20000 }, (err, stdout) => {
      if (err) reject(err); else resolve(stdout);
    });
  });
}

const journal = [];
async function collecterSource(source) {
  try {
    // Certains marchands refusent le client HTTP de Node (voir lireParCurl) :
    // la source le déclare, et on lit avec curl. Même page, même URL.
    const entete = source.entete || source.langue;
    const corps = source.viaCurl ? await lireParCurl(source.url, entete) : await lire(source.url, entete);
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
    const xml = await lire(source.url);
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
const cleDe = (o) => {
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
  try {
    fs.writeFileSync(path.join(DOSSIER_PUBLIE, 'etat-collecte.json'), JSON.stringify({
      genereLe: sortie.genereLe,
      total: sortie.total,
      totalOffres: sortie.totalOffres,
      totalVeille: sortie.totalVeille,
    }), 'utf8');
  } catch (e) {
    console.log(`  ⚠ témoin de fraîcheur non écrit (${e.message}) — l'application ne se rafraîchira pas d'elle-même`);
  }

  // 4. LES PAGES DE PARTAGE — une par offre, avec ses balises Open Graph.
  //    On les écrit APRÈS le catalogue publié, et depuis `sortie.offres` :
  //    les pages décrivent donc exactement ce que le site sert, et les chemins
  //    de visuels ci-dessus sont déjà locaux (« img/<empreinte>.jpg »).
  //    Demande de B (09/10/2026) : un partage doit porter la trace de Kazendra.
  //    En cas d'échec on continue : un partage sans vignette ne doit pas
  //    empêcher la collecte de publier.
  try {
    const { ecrirePagesPartage } = await import('./outils/pages-partage.mjs');
    const compte = await ecrirePagesPartage(sortie.offres, { silencieux: true });
    console.log(`  → partage : ${compte.ecrites} page(s) écrite(s), ${compte.inchangees} inchangée(s), ${compte.retirees} retirée(s) — ${compte.total} au total`);
  } catch (e) {
    console.error(`  ⚠ pages de partage non écrites : ${e.message}`);
  }
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

/** L'image d'aperçu d'une page, ou '' si elle n'en a pas d'exploitable. */
async function ogImageDe(page) {
  try {
    const r = await fetch(page, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return '';
    if (!(r.headers.get('content-type') || '').includes('html')) return '';
    // L'en-tête suffit : les balises méta vivent dans les premiers kilo-octets.
    // On ne lit pas 2 Mo chez l'hôte pour rien.
    const h = (await r.text()).slice(0, 200000);
    const m = h.match(/<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
      || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["']/i);
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
  let reclasses = 0, remisesRetirees = 0, remisesAjoutees = 0;
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
      return c;
    });
  if (propres.length !== avantAssainir) {
    console.log(`Assainissement : ${avantAssainir - propres.length} offre(s) au titre pollué écartée(s)`);
  }
  if (reclasses) console.log(`Reclassement : ${reclasses} offre(s) rangée(s) dans la bonne rubrique`);
  if (remisesRetirees) console.log(`Assainissement : ${remisesRetirees} remise(s) invraisemblable(s) retirée(s) (prix barré ≥ 5× le prix demandé)`);
  if (remisesAjoutees) console.log(`Remises relues : ${remisesAjoutees} offre(s) dont le pourcentage était écrit dans le titre sans être enregistré`);
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
  const sources = TOUTES_SOURCES.filter((s) => !enRepos(s));
  const sautees = TOUTES_SOURCES.filter(enRepos).map((s) => s.id);
  if (sautees.length) {
    journal.push({ source: 'repos', ok: true, saute: true, sources: sautees, raison: 'délai de repos non écoulé' });
    if (VERBEUX) console.log(`  en repos (interrogées récemment) : ${sautees.join(', ')}`);
  }

  console.log(`Collecte : ${sources.length}/${TOUTES_SOURCES.length} flux + ${RECHERCHES.length} recherches Google News`);
  const paquets = await Promise.all([
    ...sources.map((s) => collecterSource(s)),
    ...RECHERCHES.map((r) => collecterRecherche(r)),
  ]);

  // Ce que chaque source a RÉELLEMENT rendu. Sert plus bas à ne pas marquer
  // « vue » une source qui n'a rien pu rendre (voir sourcesVuLe).
  const renduParSource = new Map();
  for (const o of paquets.flat()) {
    renduParSource.set(o.sourceId, (renduParSource.get(o.sourceId) || 0) + 1);
  }

  let nouvelles = 0, misesAJour = 0;
  for (const offre of paquets.flat()) {
    const cle = cleDe(offre);
    const avant = connues.get(cle);
    if (!avant) { connues.set(cle, { ...offre, vuLe: new Date().toISOString() }); nouvelles++; continue; }
    // Mise à jour SANS écraser la date de première vue (qui sert à dater l'offre).
    const fusion = { ...avant, ...offre, vuLe: new Date().toISOString(), premiereVue: avant.premiereVue || avant.vuLe };
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
  const TYPES_PRIX_CATALOGUE = new Set(['enseigne', 'amazon']);
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

  // Tri : les offres AVEC PRIX d'abord (remise réelle décroissante), puis la
  // veille — dont on écarte tout ce qui a plus de 30 jours : une actu de l'an
  // dernier n'est pas une information, c'est un piège (l'utilisateur clique et
  // tombe sur une promotion terminée).
  const LIMITE_VEILLE = Date.now() - 30 * 86400000;
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
    //   (5 minutes). Mais pas indéfiniment — après trois passages vides, on
    //   l'horodate quand même, sinon une source définitivement morte serait
    //   frappée toutes les 5 minutes.
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
  };
  // Toujours écrit : le hub local et le contrôle des sources lisent ce fichier,
  // avec des visuels DISTANTS (relayés par notre serveur). En publication, on
  // écrit EN PLUS le site (docs/), dont les visuels sont rapatriés sur place.
  fs.writeFileSync(FICHIER, JSON.stringify(sortie, null, 0));
  console.log(`√ ${offres.length} offres au total (${nouvelles} nouvelles, ${misesAJour} mises à jour, ${journal.filter((j) => !j.ok).length} source(s) en échec)`);
  console.log(`  historique des prix : ${bilanPrix.avec} offre(s) analysée(s), ${bilanPrix.verdicts} verdict(s), ${Object.keys(historique.jours).length} jour(s) conservé(s)`);
  console.log(`  → ${FICHIER}`);
  if (PUBLIER) await publier(sortie);
  // Le taux de la BCE : relevé à chaque collecte, publié avec le site. Il ne
  // fait jamais échouer une collecte (voir majTauxBce).
  const tauxBce = await majTauxBce({ publier: PUBLIER });
  if (tauxBce) {
    console.log(`  taux BCE du ${tauxBce.date} : 1 € = ${tauxBce.taux.SEK} SEK, ${tauxBce.taux.PLN} PLN, ${tauxBce.taux.GBP} GBP, ${tauxBce.taux.USD} USD`);
  }
}

// Exécuté seulement quand ce fichier EST le programme : sinon l'importer depuis
// un test déclencherait une collecte réseau.
const estProgramme = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estProgramme) principal().catch((e) => { console.error('ÉCHEC COLLECTE :', e.message); process.exit(1); });
