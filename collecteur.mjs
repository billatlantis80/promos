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
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');
const FICHIER = path.join(DATA, 'offres.json');
const VERBEUX = process.argv.includes('--verbeux');
/** Publication : écrit aussi le site statique (offres + VISUELS locaux) dans
 *  docs/, prêt pour GitHub Pages. Sans ce drapeau, on ne touche qu'aux
 *  données locales (le hub continue de relayer les visuels à la volée). */
const PUBLIER = process.argv.includes('--publier');
const DOSSIER_PUBLIE = path.join(__dirname, 'docs');

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
  { id: 'amazon-be-deals', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 90, url: 'https://www.amazon.com.be/s?rh=p_n_deal_type%3A210770357031' },
  // Trois rayons nommés par l'utilisateur — bricolage, jouets, maison — pour que
  // ces rubriques ne dépendent pas du hasard d'une page « toutes promotions ».
  // Aucune catégorie n'est IMPOSÉE : le titre décide, car une recherche Amazon
  // ramène aussi des résultats sponsorisés hors sujet.
  { id: 'amazon-be-bricolage', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 120, url: 'https://www.amazon.com.be/s?k=bricolage&rh=p_n_deal_type%3A210770357031' },
  { id: 'amazon-be-jouets', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 120, url: 'https://www.amazon.com.be/s?k=jouet+enfant&rh=p_n_deal_type%3A210770357031' },
  { id: 'amazon-be-maison', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'fr', reposMin: 120, url: 'https://www.amazon.com.be/s?k=cuisine+maison&rh=p_n_deal_type%3A210770357031' },
  // Version néerlandaise : la Belgique est bilingue, et les intitulés de
  // produits diffèrent (« speelgoed » n'est pas « jouet »).
  { id: 'amazon-be-nl', nom: 'Amazon', type: 'amazon', pays: 'BE', langue: 'nl', reposMin: 120, url: 'https://www.amazon.com.be/s?k=aanbieding&language=nl_BE&rh=p_n_deal_type%3A210770357031' },
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

/** Toutes les sources, France et Europe. Exporté pour que les tests vérifient
    que chacune déclare bien un pays — une source sans pays enverrait ses offres
    dans le mauvais pays, sans que rien ne le signale. */
export const TOUTES_SOURCES = [...SOURCES, ...SOURCES_ENSEIGNES, ...SOURCES_AMAZON, ...SOURCES_VENTES_FLASH, ...VEILLE_PAYS, ...VEILLE_BING, ...VEILLE_ENSEIGNES];

/** Exportés pour les TESTS : le filtre par langue et l'anti-tuile se vérifient
 *  en les exécutant, pas en relisant le fichier. */
export { MOTS_PROMO, motsPromo, ecarterTuiles, veilleParPays, lienReel, dedupliquerArticles, BUDGET_CRON, LIMITE_CRON_MS, PAYS_PRESSE, PAYS_BING };
/* Le classement est exporté pour être VÉRIFIÉ : le vérificateur
   (outils/verificateur-categories.mjs) et les tests rejouent `famille()` sur
   les offres publiées. Un contrôle qui recopierait la table des mots serait un
   contrôle qui vérifie sa propre copie — donc rien du tout. */
export { famille, FAMILLES, MARQUES, MOTS_FORTS, CATEGORIES_SOURCES, categorieDeSource, sansAccents, offresEnseigne, offresAmazon, offresVenteFlash, compterMots, remise, pourcentEcrit, SOURCES_VENTES_FLASH };

/** Recherches Google News : un flux par famille de produits. Gratuit, sans clé. */
const RECHERCHES = [
  ['bricolage', 'bons plans bricolage outillage promo'],
  ['maison', 'promo électroménager maison réduction'],
  ['tech', 'bon plan high-tech réduction prix'],
  ['mode', 'promo vêtements réduction mode'],
  ['sport', 'promo sport fitness réduction'],
  ['jouets', 'promo jouets enfant réduction'],
  ['auto', 'promo accessoires auto réduction'],
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
    'bricolage', 'outillage', 'quincaillerie', 'jardin', 'perceuse', 'visseuse', 'peinture', 'sanitaire', 'plomberie', 'electricite', 'atelier', 'brico', 'tondeuse', 'scie', 'tournevis', 'echelle', 'chaudiere', 'robinet', 'souffleur', 'taille-haie', 'debroussailleuse',
    // en
    'diy', 'tools', 'toolbox', 'drill', 'screwdriver', 'paint', 'plumbing', 'lawnmower', 'ladder', 'hardware', 'sander', 'wallpaper',
    // de
    'baumarkt', 'werkzeug', 'bohrmaschine', 'schraubendreher', 'akku', 'garten', 'rasenmaher', 'leiter', 'eisenwaren', 'heizung', 'werkbank',
    // nl
    'doe-het-zelf', 'gereedschap', 'boormachine', 'schroevendraaier', 'verf', 'sanitair', 'tuin', 'grasmachine', 'zaag', 'ijzerwaren', 'kraan',
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
  maison: [
    // fr
    'maison', 'habitat', 'electromenager', 'cuisine', 'literie', 'matelas', 'aspirateur', 'cafetiere', 'robot', 'frigo', 'lave-linge', 'meuble', 'deco', 'piscine', 'barbecue', 'bouilloire', 'cocotte', 'poele', 'couette', 'oreiller', 'micro-ondes', 'lave-vaisselle', 'seche-linge', 'refrigerateur', 'purificateur', 'ventilateur', 'chauffage', 'vaisselle',
    // en
    'home', 'kitchen', 'mattress', 'bedding', 'vacuum', 'kettle', 'toaster', 'airfryer', 'air fryer', 'coffee machine', 'fridge', 'dishwasher', 'washing machine', 'dryer', 'microwave', 'blender', 'cookware', 'pan', 'duvet', 'pillow', 'furniture', 'decor', 'air purifier', 'fan', 'heater', 'bed sheet',
    // de
    'haushalt', 'kuche', 'matratze', 'bettwaren', 'staubsauger', 'wasserkocher', 'heissluftfritteuse', 'kaffeemaschine', 'kuhlschrank', 'geschirrspuler', 'waschmaschine', 'trockner', 'mikrowelle', 'pfanne', 'bettdecke', 'kissen', 'mobel', 'deko', 'gartenmobel', 'luftreiniger', 'ventilator', 'backofen', 'herd',
    // nl
    'woning', 'huis', 'keuken', 'matras', 'beddengoed', 'stofzuiger', 'waterkoker', 'koffiezetapparaat', 'koelkast', 'vaatwasser', 'wasmachine', 'droger', 'microgolf', 'dekbed', 'kussen', 'meubels', 'decoratie', 'tuinmeubelen', 'luchtzuiveraar', 'verwarming',
    // es
    'hogar', 'vivienda', 'colchon', 'ropa de cama', 'aspirador', 'hervidor', 'tostadora', 'freidora de aire', 'cafetera', 'frigorifico', 'lavavajillas', 'lavadora', 'secadora', 'microondas', 'batidora', 'sarten', 'edredon', 'almohada', 'muebles', 'decoracion', 'purificador', 'calefaccion',
    // it
    'casa', 'materasso', 'biancheria', 'aspirapolvere', 'bollitore', 'tostapane', 'friggitrice', 'caffe', 'frigorifero', 'lavastoviglie', 'lavatrice', 'asciugatrice', 'microonde', 'frullatore', 'padella', 'piumino', 'cuscino', 'mobili', 'arredamento', 'purificatore', 'riscaldamento',
    // pt
    'cozinha', 'colchao', 'roupa de cama', 'chaleira', 'torradeira', 'fritadeira', 'maquina de cafe', 'frigorifico', 'maquina de lavar', 'secador', 'micro-ondas', 'liquidificadora', 'frigideira', 'edredao', 'almofada', 'moveis', 'decoracao', 'ventoinha', 'aquecimento',
    // pl
    'dom', 'kuchnia', 'materac', 'posciel', 'odkurzacz', 'czajnik', 'toster', 'frytkownica', 'ekspres do kawy', 'lodowka', 'zmywarka', 'pralka', 'suszarka', 'mikrofalowka', 'patelnia', 'koldra', 'poduszka', 'meble', 'dekoracje', 'oczyszczacz', 'wentylator', 'ogrzewanie',
    // sv
    'hem', 'kok', 'madrass', 'sangklader', 'dammsugare', 'vattenkokare', 'brodrost', 'kaffemaskin', 'kylskap', 'diskmaskin', 'tvatmaskin', 'torktumlare', 'mikrovagsugn', 'stekpanna', 'tacke', 'kudde', 'mobler', 'inredning', 'luftrenare', 'flakt', 'varmare',
  ],
  tech: [
    // fr
    'high-tech', 'high tech', 'informatique', 'smartphone', 'telephone', 'ordinateur', 'portable', 'ecran', 'casque', 'ecouteurs', 'tv', 'televiseur', 'console', 'gaming', 'drone', 'ssd', 'carte graphique', 'imprimante', 'montre connectee', 'enceinte', 'clavier', 'souris', 'tablette', 'appareil photo', 'barre de son', 'chargeur', 'batterie externe', 'routeur', 'disque dur', 'processeur', 'casque audio',
    // en
    'laptop', 'notebook', 'monitor', 'screen', 'headphone', 'earbud', 'earbuds', 'keyboard', 'mouse', 'tablet', 'phone', 'television', 'soundbar', 'printer', 'camera', 'console', 'gpu', 'charger', 'powerbank', 'power bank', 'smartwatch', 'speaker', 'router', 'usb', 'hard drive', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch', 'steam',
    // de
    'notebook', 'bildschirm', 'kopfhorer', 'tastatur', 'maus', 'handy', 'fernseher', 'soundbar', 'drucker', 'kamera', 'konsole', 'festplatte', 'grafikkarte', 'ladegerat', 'lautsprecher', 'smartwatch', 'elektronik', 'computer', 'rechner', 'kopfhorer', 'bugeleisen',
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
    // fr
    'mode', 'vetement', 'chaussure', 'sneaker', 'sac', 'bijou', 'montre', 'lingerie', 'manteau', 'pull', 'jean', 'textile', 'robe', 'chemise', 'pantalon', 'basket', 'bottes', 'ceinture', 'portefeuille', 'pull-over',
    // en
    'fashion', 'clothing', 'clothes', 'shoe', 'shoes', 'sneakers', 'handbag', 'jewel', 'jewellery', 'watch', 'coat', 'jacket', 'jumper', 'jeans', 'apparel', 'dress', 'shirt', 'trousers', 'boots', 'belt', 'wallet', 'sweater',
    // de
    'kleidung', 'schuh', 'schuhe', 'tasche', 'handtasche', 'schmuck', 'uhr', 'mantel', 'jacke', 'pullover', 'textil', 'kleid', 'hemd', 'hose', 'stiefel', 'gurtel', 'portemonnaie', 'lederjacke', 'muetze', 'schal',
    // nl
    'kleding', 'schoen', 'schoenen', 'tas', 'handtas', 'sieraad', 'horloge', 'jas', 'trui', 'jurk', 'hemd', 'broek', 'laarzen', 'riem', 'portemonnee', 'sieraden',
    // es
    'moda', 'ropa', 'zapato', 'zapatos', 'zapatilla', 'zapatillas', 'bolso', 'joya', 'reloj', 'lenceria', 'abrigo', 'chaqueta', 'jersey', 'vaqueros', 'vestido', 'camisa', 'pantalon', 'botas', 'cinturon', 'cartera',
    // it
    'abbigliamento', 'scarpa', 'scarpe', 'borsa', 'gioiello', 'orologio', 'intimo', 'cappotto', 'giacca', 'maglione', 'tessile', 'vestito', 'camicia', 'pantaloni', 'stivali', 'cintura', 'portafoglio',
    // pt
    'roupa', 'sapato', 'sapatos', 'sapatilhas', 'mala', 'bolsa', 'joia', 'relogio', 'casaco', 'camisola', 'ganga', 'vestuario', 'calcas', 'botas', 'cinto', 'carteira',
    // pl
    'odziez', 'but', 'buty', 'sneakersy', 'torba', 'torebka', 'bizuteria', 'zegarek', 'bielizna', 'plaszcz', 'kurtka', 'sweter', 'jeansy', 'tekstylia', 'sukienka', 'koszula', 'spodnie', 'kozaki', 'pasek', 'portfel',
    // sv
    'klader', 'sko', 'skor', 'vaska', 'handvaska', 'smycke', 'klocka', 'underklader', 'kappa', 'jacka', 'troja', 'tyg', 'klanning', 'skjorta', 'byxor', 'stovlar', 'balte', 'planbok',
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
    'auto', 'voiture', 'moto', 'pneu', 'automobile', 'garage', 'carrosserie', 'huile moteur', 'casque moto', 'accessoires auto', 'batterie voiture',
    // en
    'car', 'motorbike', 'motorcycle', 'tyre', 'tire', 'automotive', 'engine oil', 'car parts', 'dash cam', 'dashcam', 'car battery',
    // de
    'wagen', 'motorrad', 'reifen', 'kfz', 'motorol', 'autozubehor', 'dashcam', 'autobatterie',
    // nl
    'motorfiets', 'band', 'autoband', 'motorolie', 'autoaccessoires', 'autobatterij', 'wagen', 'autobanden', 'autozetel', 'trekhaak', 'ruitenwisser', 'wiel',
    // es
    'coche', 'coches', 'motos', 'neumatico', 'automovil', 'aceite de motor', 'accesorios coche', 'bateria de coche',
    // it
    'pneumatico', 'pneumatici', 'olio motore', 'accessori auto', 'batteria auto', 'automobile', 'ricambi', 'tergicristalli',
    // pt
    'carro', 'carros', 'automovel', 'mota', 'pneu', 'pneus', 'oleo de motor', 'acessorios auto', 'bateria de carro', 'pecas auto', 'limpa para-brisas',
    // pl
    'samochod', 'motocykl', 'opona', 'opony', 'olej silnikowy', 'akcesoria samochodowe', 'akumulator', 'czesci samochodowe', 'wycieraczki', 'felgi',
    // sv
    'bil', 'bilar', 'motorcykel', 'dack', 'motorolja', 'biltillbehor', 'bilbatteri', 'reservdelar', 'vindrutetorkare', 'bensin',
  ],
  beaute: [
    // fr
    'beaute', 'parfum', 'cosmetique', 'soin', 'maquillage', 'cheveux', 'rasoir', 'brosse a dents', 'creme', 'shampoing', 'gel douche', 'hygiene', 'epilateur', 'epilation', 'tondeuse barbe',
    // en
    'beauty', 'perfume', 'fragrance', 'cosmetics', 'skincare', 'makeup', 'hair', 'razor', 'toothbrush', 'cream', 'shampoo', 'shower gel', 'grooming', 'epilator', 'shaver',
    // de
    'parfumerie', 'kosmetik', 'pflege', 'schminke', 'haare', 'rasierer', 'zahnburste', 'creme', 'shampoo', 'duschgel', 'epilierer',
    // nl
    'parfum', 'cosmetica', 'verzorging', 'make-up', 'haar', 'scheerapparaat', 'tandenborstel', 'shampoo', 'douchegel', 'drogisterij',
    // es
    'belleza', 'perfume', 'cosmetica', 'cuidado', 'maquillaje', 'pelo', 'cabello', 'maquina de afeitar', 'cepillo de dientes', 'champu', 'gel de ducha',
    // it
    'bellezza', 'profumo', 'cosmetica', 'cura', 'trucco', 'capelli', 'rasoio', 'spazzolino', 'crema', 'shampoo', 'docciaschiuma',
    // pt
    'beleza', 'perfume', 'cosmetica', 'cuidado', 'maquilhagem', 'cabelo', 'maquina de barbear', 'escova de dentes', 'champo', 'gel de banho',
    // pl
    'uroda', 'perfumy', 'kosmetyki', 'pielegnacja', 'makijaz', 'wlosy', 'golarka', 'szczoteczka', 'krem', 'szampon', 'zel pod prysznic',
    // sv
    'skonhet', 'parfym', 'kosmetik', 'hudvard', 'smink', 'har', 'rakapparat', 'tandborste', 'kram', 'schampo', 'duschgel',
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
  ['wonen', 'maison'], ['casa', 'maison'], ['electromenager', 'maison'], ['literie', 'maison'],
  ['meuble', 'maison'], ['mobilier', 'maison'], ['interieur', 'maison'], ['inrichting', 'maison'],
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
  ['chaussures', 'mode'], ['sacs', 'mode'], ['bijoux', 'mode'], ['klader', 'mode'], ['abbigliamento', 'mode'],
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
  // --- BEAUTÉ
  ['beaute & sante', 'beaute'], ['sante & cosmetiques', 'beaute'], ['beauty & gesundheit', 'beaute'],
  ['beauty & gezondheid', 'beaute'], ['health & beauty', 'beaute'], ['beauty & health', 'beaute'],
  ['salud y belleza', 'beaute'], ['zdrowie i uroda', 'beaute'], ['beauty', 'beaute'], ['beaute', 'beaute'],
  ['cosmetique', 'beaute'], ['cosmetica', 'beaute'], ['cosmetics', 'beaute'], ['kosmetik', 'beaute'],
  ['parfum', 'beaute'], ['soins', 'beaute'], ['drogisterij', 'beaute'], ['drogerie', 'beaute'],
  // --- ASSUMÉ COMME « AUTRE » (ce n'est pas un défaut : c'est un choix)
  ['culture', 'autre'], ['kultur', 'autre'], ['kultura', 'autre'], ['cinema', 'autre'], ['livres', 'autre'],
  ['divertissement', 'autre'], ['freizeit', 'autre'], ['rozrywka', 'autre'], ['ocio', 'autre'],
  ['voyage', 'autre'], ['reisen', 'autre'], ['travel', 'autre'], ['urlop', 'autre'], ['podroze', 'autre'],
  ['alimentation', 'autre'], ['epicerie', 'autre'], ['groceries', 'autre'], ['lebensmittel', 'autre'],
  ['spożywcze', 'autre'], ['artykuly', 'autre'], ['courses', 'autre'],
  ['supermercado', 'autre'], ['alimentacion', 'autre'], ['boodschappen', 'autre'], ['voeding', 'autre'],
  ['services', 'autre'], ['dienstleistungen', 'autre'], ['finanzen', 'autre'], ['versicherung', 'autre'],
  ['servicios', 'autre'], ['uslugi', 'autre'], ['subskrypcje', 'autre'], ['finanse', 'autre'],
  ['ubezpieczenia', 'autre'], ['geldzaken', 'autre'], ['verzekeringen', 'autre'], ['verzekering', 'autre'],
  ['reizen', 'autre'], ['vakantie', 'autre'], ['sante', 'autre'], ['gesundheit', 'autre'], ['health', 'autre'],
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
  maison: ['dyson', 'tefal', 'moulinex', 'delonghi', 'krups', 'nespresso', 'senseo', 'miele', 'whirlpool', 'magimix', 'pyrex', 'ikea'],
  bricolage: ['makita', 'einhell', 'ryobi', 'worx', 'karcher', 'gardena', 'wera', 'dewalt', 'metabo', 'hilti', 'fiskars', 'wolf garten', 'scheppach'],
  sport: ['decathlon', 'quechua', 'btwin', 'orbea', 'canyon', 'specialized'],
  beaute: ['loreal', 'sephora', 'nivea', 'garnier', 'oral-b', 'gillette', 'neutrogena', 'douglas', 'braun silk'],
  jouets: ['lego', 'playmobil', 'hasbro', 'mattel', 'barbie', 'nerf', 'funko', 'schleich', 'ravensburger', 'asmodee'],
  mode: ['zalando', 'zara', 'jack&jones', 'tommy hilfiger', 'levis'],
  auto: ['michelin', 'continental', 'castrol', 'bosch auto'],
};

/** MOTS FORTS — le mot d'APPAREIL prime sur la marque.
 *
 *  Règle appliquée, demandée explicitement : un appareil électronique va en
 *  high-tech, l'électroménager va en maison, l'électronique de beauté va en béauté.
 *
 *  Pourquoi une table à part : une MARQUE ne dit pas la famille d'un produit.
 *  Samsung fait des téléphones (high-tech) ET des réfrigérateurs (maison) ;
 *  Braun des épilateurs (beauté) ET des robots de cuisine (maison) ; Bosch des
 *  perceuses (bricolage) ET des lave-linge (maison). Tant que la marque décidait
 *  seule, « Samsung Réfrigérateur » partait en high-tech.
 *
 *  Ces mots sont donc examinés AVANT tout le reste — avant les marques, avant la
 *  catégorie de la source : dès qu'un appareil est NOMMÉ, c'est lui qui tranche.
 */
const MOTS_FORTS = {
  // ÉLECTROMÉNAGER → maison
  maison: [
    'refrigerateur', 'frigo', 'frigorifique', 'congelateur', 'kuhlschrank', 'koelkast', 'frigorifico', 'frigorifero', 'lodowka', 'kylskap', 'gefrierschrank', 'vriezer',
    'lave-linge', 'lavelinge', 'machine a laver', 'waschmaschine', 'wasmachine', 'lavatrice', 'lavadora', 'pralka', 'tvatmaskin',
    'lave-vaisselle', 'lavevaisselle', 'geschirrspuler', 'vaatwasser', 'lavastoviglie', 'lavavajillas', 'zmywarka', 'diskmaskin',
    'seche-linge', 'sechelinge', 'trockner', 'droger', 'asciugatrice', 'secadora', 'suszarka', 'torktumlare',
    'aspirateur', 'staubsauger', 'stofzuiger', 'aspirapolvere', 'aspirador', 'odkurzacz', 'dammsugare',
    'micro-ondes', 'microondes', 'mikrowelle', 'microgolf', 'microonde', 'microondas', 'mikrofalowka', 'mikrovagsugn',
    'four encastrable', 'four electrique', 'backofen', 'ofen', 'forno', 'horno', 'piekarnik', 'ugn',
    'cafetiere', 'kaffeemaschine', 'koffiezetapparaat', 'macchina del caffe', 'maquina de cafe', 'ekspres do kawy', 'kaffemaskin',
    'bouilloire', 'wasserkocher', 'waterkoker', 'bollitore', 'hervidor', 'czajnik', 'vattenkokare',
    'friteuse', 'fritteuse', 'airfryer', 'fritadeira', 'frytkownica', 'heissluftfritteuse',
    'cocotte-minute', 'autocuiseur', 'schnellkochtopf', 'cocotte minute',
    'purificateur d air', 'luftreiniger', 'luchtzuiveraar', 'purificador de aire',
  ],
  // ÉLECTRONIQUE DE BEAUTÉ → beauté
  beaute: [
    'epilateur', 'epilator', 'epilierer', 'ontharingsapparaat', 'depiladora', 'epilatore', 'depilatore',
    'rasoir electrique', 'rasoir', 'elektrorasierer', 'scheerapparaat', 'maquina de afeitar', 'rasoio elettrico', 'golarka', 'rakapparat',
    'tondeuse a cheveux', 'tondeuse barbe', 'haarschneider', 'haartrimmer', 'clipper',
    'seche-cheveux', 'seche cheveux', 'sechecheveux', 'haartrockner', 'haardroger', 'asciugacapelli', 'secador de pelo', 'suszarka do wlosow', 'fon',
    'lisseur', 'lisseur de cheveux', 'haarglatter', 'stijltang', 'piastra per capelli', 'plancha de pelo', 'prostownica', 'plattang',
    'brosse a dents electrique', 'brosse a dents', 'elektrische zahnburste', 'zahnburste', 'elektrische tandenborstel', 'cepillo de dientes electrico', 'spazzolino elettrico', 'szczoteczka elektryczna', 'eltandborste',
    'brosse soufflante', 'soin du visage', 'appareil de massage', 'masseur',
  ],
  // APPAREIL TECHNIQUE → high-tech
  tech: [
    'smartphone', 'telephone portable', 'handy', 'smartfon', 'telefoon', 'telefono', 'telefone',
    'ordinateur portable', 'pc portable', 'laptop', 'notebook', 'ultrabook', 'chromebook',
    'tablette', 'tablet', 'tableta', 'tabletka', 'surfplatta',
    'televiseur', 'fernseher', 'televisie', 'televisor', 'televisore', 'telewizor', 'tv-apparat', 'smart tv', 'television',
    'montre connectee', 'smartwatch', 'apple watch', 'fitbit', 'garmin',
    'casque audio', 'casque bluetooth', 'ecouteurs', 'earbuds', 'airpods', 'kopfhorer', 'hoofdtelefoon', 'auriculares', 'cuffie', 'sluchawki', 'horlurar',
    'enceinte connectee', 'enceinte bluetooth', 'barre de son', 'soundbar', 'lautsprecher', 'luidspreker', 'altavoz', 'glosnik', 'hogtalare',
    'imprimante', 'drucker', 'printer', 'impressora', 'drukarka', 'skrivare',
    'appareil photo', 'appareil photo numerique', 'action cam', 'camera', 'camera de surveillance', 'fotocamera',
    'drone', 'routeur', 'router', 'disque dur', 'ssd', 'nvme', 'carte graphique', 'barrette memoire',
    'console de jeu', 'spielekonsole', 'spelcomputer', 'consola', 'konsola', 'spelkonsol', 'playstation', 'manette',
    'ecran d ordinateur', 'moniteur', 'monitor', 'ecran pc',
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

/** La famille indiquée par un mot d'appareil NOMMÉ, ou null si le titre n'en
 *  nomme aucun.
 *
 *  Le départage se fait par la LONGUEUR TOTALE des mots trouvés, et non par leur
 *  nombre : c'est ce qui fait gagner le terme le plus spécifique. Sans cela,
 *  « Haartrockner » (sèche-cheveux, beauté) perdait contre « trockner »
 *  (sèche-linge, maison) qu'il contient — un point partout, et l'ordre de la
 *  table décidait. Avec la longueur, 12 caractères battent 8.
 */
function familleDAppareil(texteBas) {
  let choisie = null, score = 0;
  for (const [fam, mots] of Object.entries(MOTS_FORTS_NORM)) {
    const trouves = mots.filter((m) => (m.length <= 3
      ? new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i').test(texteBas)
      : texteBas.includes(m)));
    const poids = trouves.reduce((a, m) => a + Math.max(3, m.length), 0);
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
  const bas = sansAccents(String(texte || '')).toLowerCase();
  // 0. L'appareil NOMMÉ tranche en premier (règle demandée). Voir MOTS_FORTS.
  const appareil = familleDAppareil(bas);
  if (appareil) return appareil;
  let meilleur = 'autre', score = 0;
  for (const [fam, mots] of Object.entries(FAMILLES_NORM)) {
    const n = compterMots(mots, bas);
    if (n > score) { score = n; meilleur = fam; }
  }
  const parSource = categorieDeSource(categorieSource);
  if (parSource) {
    // « autre » n'est pas une affirmation, c'est une ABSENCE d'affirmation : la
    // source dit « ce n'est pas une de mes rubriques » (Culture, Voyage,
    // Alimentation…). Un seul mot du titre fait donc mieux qu'elle — sinon un
    // « aspirapolvere » rangé en Culture resterait en « Autres » alors que le
    // titre dit exactement ce que c'est. Mesuré : 242 offres étaient dans ce
    // cas, faute de cette distinction.
    if (parSource === 'autre') return meilleur !== 'autre' ? meilleur : 'autre';
    // Face à une VRAIE rubrique de la source, il faut deux mots concordants
    // pour la contredire : « Casque Moto Intégral » touche « casque » (tech) et
    // « moto » (auto), un point chacun — la source tranche.
    return score >= 2 && meilleur !== parSource ? meilleur : parSource;
  }
  if (meilleur !== 'autre') return meilleur;
  // PLUS DE DERNIER RECOURS ICI, et c'est une correction, pas un oubli.
  // La version précédente terminait par « si la categorieSource est le nom
  // d'une de nos familles, on la prend ». Ce n'était pas une preuve : un nom de
  // famille ne vient JAMAIS d'un marchand (ils publient leur propre vocabulaire
  // — « Gaming », « Garten & Baumarkt »). Il vient de NOS requêtes de veille, ou
  // d'une catégorie qu'on avait collée à tort sur une source (37 offres Coolblue
  // rangées en high-tech, dont des robots de cuisine De'Longhi). Cette branche
  // fabriquait donc des catégories que rien ne soutenait. Une offre dont ni la
  // source ni le titre ne disent rien reste en « Autres » : c'est visible, et
  // c'est vrai.
  return 'autre';
}

/**
 * Compte les mots-clés présents. DÉFAUT CORRIGÉ : une recherche « pc », « tv »
 * ou « jeu » par simple `includes` trouvait n'importe quoi à l'intérieur des
 * URL encodées de Google News — un article de mode était classé High-tech.
 * Les mots courts exigent donc une frontière de mot.
 */
function compterMots(mots, texteBas) {
  return mots.filter((m) => (m.length <= 3
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
    id: 'd' + Buffer.from((lien || titre).split('').reverse().join('')).toString('base64url').slice(0, 14),
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
    id: 'p' + Buffer.from((lien || titre).split('').reverse().join('')).toString('base64url').slice(0, 14),
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

function offresEnseigne(html, source) {
  const produits = [];
  const vus = new Set();
  const ajouter = (o) => {
    const brut = Array.isArray(o.image) ? o.image[0] : o.image;
    const image = typeof brut === 'string' ? brut : (brut && (brut.url || brut.contentUrl)) || '';
    const off = Array.isArray(o.offers) ? o.offers[0] : o.offers;
    const prix = versNombre(off && off.price);
    const lien = String(o.url || (off && (off.url || off['@id'])) || '').trim();
    if (!o.name || prix == null) return;
    const cle = (lien || String(o.name)).toLowerCase();
    if (vus.has(cle)) return;
    vus.add(cle);
    produits.push({
      titre: nettoyer(o.name),
      prix,
      prixAvant: versNombre((off && (off.highPrice || off.listPrice)) || o.highPrice),
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
      id: 'e' + Buffer.from((p.lien || p.titre).split('').reverse().join('')).toString('base64url').slice(0, 14),
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
      categorie: famille(p.titre, source.categorie || ''),
      categorieSource: source.categorie || 'enseigne',
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
 *  suivi du symbole ; ici le prix arrive parfois sans lui (JSON-LD). */
function versNombre(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
  return versPrix(String(v ?? ''));
}

function versNumberCarte(texte) {
  const m = String(texte || '').replace(/\u00a0|\u202f/g, ' ')
    .match(/(?:^|["'\s>])(\d{1,4}(?:[.,]\d{2}))\s?€/);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
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
  return famille(o.titre || '', o.categorieSource);
}

/* ------------------------------------------------------------------ *
 *  Collecte
 * ------------------------------------------------------------------ */
async function lire(url, langue = 'fr-FR,fr;q=0.9') {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': langue }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const journal = [];
async function collecterSource(source) {
  try {
    const corps = await lire(source.url, source.entete || source.langue);
    // Une enseigne ne rend pas un flux mais une PAGE : on lit son JSON-LD au
    // lieu de chercher des <item>. Deux lectures distinctes, jamais mélangées.
    if (source.type === 'enseigne') {
      const offres = offresEnseigne(corps, source);
      journal.push({ source: source.id, ok: true, items: 0, retenues: offres.length });
      if (VERBEUX) console.log(`  ${source.id} : ${offres.length} offre(s) d'enseigne`);
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

async function publier(sortie) {
  const dossierImg = path.join(DOSSIER_PUBLIE, 'img');
  fs.mkdirSync(dossierImg, { recursive: true });

  // 1. Le site lui-même : l'interface est copiée telle quelle.
  for (const f of fs.readdirSync(path.join(__dirname, 'public'))) {
    fs.copyFileSync(path.join(__dirname, 'public', f), path.join(DOSSIER_PUBLIE, f));
  }

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
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const type = r.headers.get('content-type') || '';
      const buf = Buffer.from(await r.arrayBuffer());
      if (!type.startsWith('image/') || buf.length === 0) throw new Error('pas une image');
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
    offres,
  };
  // Toujours écrit : le hub local et le contrôle des sources lisent ce fichier,
  // avec des visuels DISTANTS (relayés par notre serveur). En publication, on
  // écrit EN PLUS le site (docs/), dont les visuels sont rapatriés sur place.
  fs.writeFileSync(FICHIER, JSON.stringify(sortie, null, 0));
  console.log(`√ ${offres.length} offres au total (${nouvelles} nouvelles, ${misesAJour} mises à jour, ${journal.filter((j) => !j.ok).length} source(s) en échec)`);
  console.log(`  → ${FICHIER}`);
  if (PUBLIER) await publier(sortie);
}

// Exécuté seulement quand ce fichier EST le programme : sinon l'importer depuis
// un test déclencherait une collecte réseau.
const estProgramme = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estProgramme) principal().catch((e) => { console.error('ÉCHEC COLLECTE :', e.message); process.exit(1); });
