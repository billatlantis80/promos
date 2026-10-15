/**
 * Application n°2 — interface.
 * Aucune dépendance : on lit /api/offres et on affiche.
 * Principe : ne JAMAIS maquiller une offre. Une remise calculée est marquée
 * comme telle ; sans remise chiffrée, on affiche l'offre sans étiquette.
 */
import { lienAffilie, affiliationActive, MENTION_AFFILIATION_ACTIVE, MENTION_AFFILIATION_INACTIVE, siteAmazon } from './affiliation.js';
import { t, chargerLangue, definirLangue, traduireDOM, languesDisponibles, langue, CLE_LANGUE, locale } from './langues.js';
import { noterVisite, noterAction, relayerAction } from './trafic.js';
import { adresseRelais } from './relais.js';
import { DRAPEAUX, DRAPEAUX_PAYS, NOMS_PAYS } from './drapeaux.js';
import {
  envoyerInscription, envoyerDesinscription, adresseValide, tableauConfigure,
  inscriptionLocale, retenirInscription, oublierInscription,
} from './inscription.js';
import { FICHIER_TEMOIN, DELAI_CONTROLE_MS, peutControler, doitRafraichir, dateDuTemoin } from './maj.js';

const $ = (id) => document.getElementById(id);

/* TÉMOIN DE DÉMARRAGE — lu par la sentinelle d'index.html.
 *
 * Le site n'a qu'UN script : `<script type="module" src="app.js">`. Un
 * navigateur qui ne connaît pas les modules ES — Internet Explorer 11, et tout
 * navigateur antérieur à Chrome 61 / Firefox 60 / Safari 10.1 — n'exécute
 * alors STRICTEMENT RIEN : la page reste sur son en-tête et sur
 * « chargement… », sans le moindre message. C'est le cas le plus grave, car
 * rien ne le signale.
 *
 * CORRECTION D'UNE ERREUR COMMISE ICI. Ce commentaire a d'abord affirmé
 * qu'`app.js` employait « `?.` plus de 2 000 fois », ce qui aurait exigé
 * Chrome 80. C'ÉTAIT FAUX : mesuré depuis, `app.js` contient UN seul `?.`
 * — autant que le panneau d'administration, qui s'affiche parfaitement sur un
 * navigateur ancien. Le comptage initial était un artefact de commande, et il
 * avait servi à écarter à tort la vraie cause du défaut signalé par B : les
 * quatre domaines `.be/.fr/.eu/.app`, qui affichaient la page d'attente OVH
 * (« Site en construction ») faute d'être redirigés.
 *
 * La sentinelle reste utile — elle couvre le navigateur qui ne sait pas lire
 * le programme, le fichier bloqué en route et l'erreur au démarrage — mais
 * elle ne doit pas s'appuyer sur une mesure fausse pour se justifier.
 *
 * Cette ligne est posée EN PREMIER, avant toute lecture de données : la
 * sentinelle doit pouvoir distinguer « le programme tourne mais les offres
 * arrivent lentement » (ici : le témoin est posé → elle se tait) de « le
 * programme n'a jamais démarré » (le témoin est absent → elle parle).
 */
window.KAZENDRA_PRET = true;

/**
 * Où vivent les ressources (données + visuels) ?
 *
 *  - Servie par le hub  → même origine : chemins relatifs, tout marche.
 *  - Embarquée dans l'APK → la page vient de appassets.androidplatform.net,
 *    un hôte virtuel : `data/offres.json` n'y existe pas et le relais d'images
 *    non plus. On pointe donc explicitement vers le hub, en ABSOLU.
 *
 * Dans les deux cas la page reste utilisable : si le hub ne répond pas (hors
 * du réseau de la maison), on retombe sur l'instantané embarqué dans l'APK
 * (window.DONNEES) — les visuels, eux, manquent alors, et les cartes gardent
 * leur fond neutre. Mieux vaut une liste figée qu'un écran vide.
 */
const HUB = 'https://kazendra.com/';
/* LA MARQUE DU SUPPORT (11/10/2026). Elle est posée en tête de page, avant la
   feuille de style (voir index.html) : app.js la RELIT au lieu de refaire sa
   propre détection. Deux détections qui divergeraient donneraient une page
   « site » dans l'application — un défaut visible seulement sur l'appareil. */
const DANS_APK = document.documentElement.dataset.support === 'app';
const BASE = DANS_APK ? HUB : '';

/** L'adresse PUBLIQUE du site, telle qu'elle part dans un partage. Elle ne doit
 *  pas suivre l'hébergement courant : un lien partagé s'ouvre chez quelqu'un
 *  d'autre, donc il pointe toujours sur le domaine public — jamais sur l'adresse
 *  locale du hub, qui ne répondrait pas chez l'ami qui reçoit le lien. */
const SITE_PARTAGE = 'https://kazendra.com';

const NOMS_CATEGORIES = {
  bricolage: 'Bricolage', maison: 'Maison', tech: 'High-tech',
  electromenager: 'Électroménager', mode: 'Mode', bijoux: 'Montres & bijoux',
  meubles: 'Meubles', sport: 'Sport', jouets: 'Jeux & jouets', auto: 'Auto & moto',
  beaute: 'Beauté', nourriture: 'Nourriture', animaux: 'Animaux',
  voyages: 'Voyages', activite: 'Activité', autre: 'Autres',
};

/* L'ORDRE des onglets, identique dans TOUS les pays.
 *
 * Il était calculé par nombre d'offres décroissant : « High-tech » passait donc
 * devant ou derrière « Maison » selon le pays consulté, et l'utilisateur ne
 * retrouvait plus ses onglets au même endroit d'un pays à l'autre. Un ordre qui
 * bouge quand on change de pays oblige à relire toute la barre à chaque fois.
 *
 * Cet ordre est celui que la France affichait — pris comme référence. Il est
 * ÉCRIT ici, pas déduit des données : c'est la seule façon qu'il ne change plus
 * jamais, ni en changeant de pays, ni à mesure que les offres arrivent.
 * « Autres » reste en dernier : c'est le reste, pas une catégorie comme les
 * autres (décision déjà prise, conservée).
 *
 * Une catégorie inconnue (ajoutée par le collecteur sans passer par ici) se
 * range juste avant « Autres » — jamais au milieu et jamais en tête.
 */
const ORDRE_CATEGORIES = ['tech', 'electromenager', 'meubles', 'maison', 'mode', 'bijoux', 'auto', 'jouets', 'sport', 'bricolage', 'beaute', 'nourriture', 'animaux', 'voyages', 'activite', 'autre'];

/** Rang d'affichage d'une catégorie : un entier, ou « juste avant Autres ». */
function rangCategorie(c) {
  const i = ORDRE_CATEGORIES.indexOf(c);
  if (i >= 0) return i;
  // Inconnue : on la range juste AVANT « Autres » — jamais après (sinon
  // « Autres » ne serait plus le dernier, décision déjà prise), jamais en tête,
  // et jamais au milieu des catégories connues.
  const rangAutre = ORDRE_CATEGORIES.indexOf('autre');
  return (rangAutre >= 0 ? rangAutre : ORDRE_CATEGORIES.length) - 0.5;
}

/* Pays desservis — les mêmes codes que le collecteur. Chaque pays proposé a de
   vraies sources derrière lui : le filtre ne peut donc pas afficher une liste
   identique sous une autre étiquette. Le sélecteur n'annonce que les pays
   réellement présents dans les données du jour. */
/* NOMS_PAYS vient de `drapeaux.js` : une seule table de noms de pays et de
   drapeaux pour toute l'application (voir l'en-tête du module). */
const CLE_PAYS = 'promos.pays';

/** Pays de l'appareil — LE PAYS D'ORIGINE DU VISITEUR.
 *
 *  Demande de B (11/10/2026) : « Quand un utilisateur arrive sur le site
 *  internet via chrome ou edge, il doit arriver sur le pays de son origine.
 *  Pas dans tous les pays. »
 *
 *  DEUX SIGNAUX, tous deux déjà dans le navigateur : aucune requête, aucun
 *  service tiers, aucune clé — la règle du projet.
 *
 *   1. LE FUSEAU HORAIRE (`Intl…timeZone`, ex. « Europe/Brussels ») : il dit
 *      OÙ EST l'appareil. C'est le signal qui RESTE RENSEIGNÉ quand la langue
 *      n'a pas de région — exactement le cas de Chrome et Edge, où
 *      `navigator.language` vaut « fr » ou « en », SANS pays. Un site qui
 *      n'écoutait que la langue ouvrait alors sur « Tous les pays » :
 *      c'est ce que B a vu dans ces deux navigateurs.
 *   2. LA LANGUE (`navigator.languages`, puis `navigator.language`) : elle dit
 *      ce que l'appareil DÉCLARE (« fr-BE » → BE, « nl-BE » → BE). Elle sert de
 *      repli quand le fuseau est inconnu (hors d'Europe, par exemple).
 *
 *  LE FUSEAU PASSE EN PREMIER : pour un site de promotions, c'est le pays où
 *  l'on SE TROUVE qui décide quelles boutiques sont à portée. Les deux signaux
 *  disent la même chose dans l'immense majorité des cas ; quand ils diffèrent,
 *  c'est un voyageur ou un expatrié, et c'est le lieu qui tranche.
 *
 *  Aucun des deux ne parle ? On ne devine pas : la fonction rend null, et la
 *  question est posée (voir demanderPays) — jamais d'écran vide sans un mot. */

/** Pays déduits du fuseau horaire. UNIQUEMENT des fuseaux sans ambiguïté, et
 *  uniquement vers des pays que le catalogue dessert. Les territoires rattachés
 *  à un pays desservi (Canaries, Açores, Ceuta, Madère) portent le pays de leur
 *  catalogue : c'est bien un marchand espagnol, portugais, qui y livre.
 *  Un fuseau partagé par plusieurs pays (Europe/Zurich) est ABSENT : mieux vaut
 *  ne rien dire que de se tromper de pays. */
const PAYS_PAR_FUSEAU = {
  'Europe/Brussels': 'BE',
  'Europe/Amsterdam': 'NL',
  'Europe/Paris': 'FR', 'Europe/Monaco': 'FR',
  'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE',
  'Europe/Vienna': 'AT',
  'Europe/Madrid': 'ES', 'Africa/Ceuta': 'ES', 'Atlantic/Canary': 'ES',
  'Europe/Rome': 'IT', 'Europe/San_Marino': 'IT', 'Europe/Vatican': 'IT',
  'Europe/Lisbon': 'PT', 'Atlantic/Azores': 'PT', 'Atlantic/Madeira': 'PT',
  'Europe/Warsaw': 'PL',
  'Europe/Stockholm': 'SE',
  'Europe/Dublin': 'IE',
  'Europe/London': 'GB', 'Europe/Jersey': 'GB', 'Europe/Guernsey': 'GB',
  'Europe/Isle_of_Man': 'GB',
};

/** Le fuseau de l'appareil (« Europe/Brussels »), ou '' si le navigateur le
 *  tait (mode privé, moteur ancien). */
function fuseau() {
  try { return String(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch { return ''; }
}

/** La région portée par une étiquette de langue : « fr-BE » → « BE ».
 *  La région est cherchée APRÈS la langue, et c'est le DERNIER morceau de deux
 *  lettres : « zh-Hans-CN » → CN (le script « Hans » fait quatre lettres),
 *  « fr-BE » → BE, « fr » → rien (il n'y a pas de région), « es-419 » → rien —
 *  une région NUMÉRIQUE n'est pas un pays, et prendre le premier morceau
 *  donnerait « ES » : le code de la LANGUE, pas celui du pays. */
function regionDe(etiquette) {
  const apresLangue = String(etiquette || '').split('-').slice(1);
  const dernier = apresLangue.filter((m) => /^[A-Za-z]{2}$/.test(m)).pop();
  return dernier ? dernier.toUpperCase() : '';
}

/** Le pays d'origine de l'appareil, ou null quand aucun signal ne parle. */
function paysDOrigine() {
  const connus = codesPays();
  const duFuseau = PAYS_PAR_FUSEAU[fuseau()];
  if (duFuseau && connus.includes(duFuseau)) return duFuseau;
  let etiquettes = [];
  try { etiquettes = [].concat(navigator.languages || [], navigator.language || ''); } catch { /* rien */ }
  for (const e of etiquettes) {
    const r = regionDe(e);
    if (r && connus.includes(r)) return r;
  }
  return null;
}

/** LE PAYS OÙ EST L'APPAREIL — pour documenter une inscription, et seulement là.
 *
 *  POURQUOI ELLE EXISTE À CÔTÉ DE `paysDOrigine`. Les deux répondent à la même
 *  question (« où est cet appareil ? ») mais ne servent pas la même chose :
 *
 *    - `paysDOrigine` sert à OUVRIR LE CATALOGUE : elle ne rend donc que des
 *      pays que le catalogue dessert, et `null` sinon — un visiteur hors zone
 *      n'a rien à voir dans la liste des marchés.
 *    - `paysGeo` sert à DOCUMENTER une provenance dans un tableur. Là, tous les
 *      pays comptent, y compris ceux hors catalogue : savoir qu'on est visité
 *      depuis les États-Unis est une information, pas une erreur. Elle rend ''
 *      quand rien n'est lisible, jamais une supposition.
 *
 *  MÊME SOURCE QUE LE RELEVÉ DE VISITE : le fuseau horaire d'abord, la région
 *  déclarée par la langue ensuite. Jamais l'IP, jamais un tiers, jamais de
 *  devinette — c'est la règle du projet, et elle vaut ici comme ailleurs.
 *
 *  ⚠ CE QU'ON N'ENVOIE JAMAIS : `etat.pays`. C'est le pays choisi POUR FAIRE
 *  SES ACHATS (un filtre d'écran, « tout » par défaut) — B l'a constaté le
 *  13/10/2026 : une inscription depuis la Belgique y avait laissé « FR », le
 *  marché qu'il consultait. Un réglage d'affichage n'est pas une provenance. */
function paysGeo() {
  const duFuseau = PAYS_PAR_FUSEAU[fuseau()];
  if (duFuseau) return duFuseau;
  let etiquettes = [];
  try { etiquettes = [].concat(navigator.languages || [], navigator.language || ''); } catch { /* rien */ }
  for (const e of etiquettes) {
    const r = regionDe(e);
    if (r) return r;
  }
  return '';
}

/** Pose le pays de l'appareil quand RIEN n'a été choisi. Rend true s'il vient
 *  d'être posé.
 *
 *  Le pays détecté reste une PROPOSITION : il n'est PAS écrit dans la mémoire du
 *  navigateur — même doctrine que la langue (voir `chargerLangue` dans
 *  langues.js). La mémoire ne garde qu'une DÉCISION, celle de l'utilisateur.
 *  Sans cela, un « Tous les pays » choisi exprès ne tiendrait pas un
 *  chargement de plus que la détection : elle serait écrite à sa place et le
 *  choix serait perdu à la première réouverture. */
function appliquerPaysDOrigine() {
  let enregistre = null;
  try { enregistre = localStorage.getItem(CLE_PAYS); } catch { /* mode privé */ }
  if (enregistre) return false;               // une décision existe : on n'y touche pas
  const detecte = paysDOrigine();
  if (!detecte) return false;                 // rien de lisible : la question suivra
  etat.pays = detecte;
  return true;
}
const PAR_PAGE = 24;

let etat = {
  offres: [], categorie: 'tout', marchand: 'tout', tri: 'remise', recherche: '',
  affichees: PAR_PAGE, vue: 'grille', eco: false, favoris: false, meta: {}, pays: 'tout',
  // PORTÉE de la liste. « promos » est le DÉFAUT : l'application s'ouvre sur les
  // bonnes promotions, pas sur un catalogue. C'est la raison d'être du produit —
  // on ne montre que ce qui vaut le déplacement, et l'utilisateur qui veut tout
  // voir le demande (dernier choix du sélecteur de tri).
  portee: 'promos',
  // Index ASIN → offres, construit une seule fois au chargement.
  indexProduits: null,
  // Le taux de la BCE du jour, publié par le collecteur (devises.json).
  taux: null,
};

/* QUAND ON A REGARDÉ LE TÉMOIN POUR LA DERNIÈRE FOIS (voir rafraichirSiBesoin).
   Volontairement à zéro : le tout premier retour au premier plan déclenche donc
   un contrôle. C'est voulu — si l'application était ouverte AVANT que le témoin
   n'existe, ou pendant une panne, ce premier retour est précisément le moment où
   l'on veut qu'elle rattrape son retard. Le coût est d'environ trois cents
   octets, une fois. */
let dernierControle = 0;

/* ---------- Mode d'affichage ----------
   Trois façons de parcourir les MÊMES offres. Le mode vit sur <body data-vue="…"> :
   c'est le CSS qui fait le travail, donc l'affichage reste juste même si ce script
   échoue (le défaut, « grille », est posé en dur dans la feuille de style).
   Le choix est mémorisé : on ne redemande pas à l'utilisateur, à chaque
   ouverture, ce qu'il a déjà tranché. */
const VUES = ['grille', 'liste', 'compacte'];
const CLE_VUE = 'promos.vue';

function vueEnregistree() {
  try {
    const v = localStorage.getItem(CLE_VUE);
    // LE MODE « UNE COLONNE » N'EXISTE PLUS SUR PC (B, 12/10/2026 : « tu gardes
    // uniquement les boutons 4 et 2 »). Quelqu'un qui l'a choisi sur son téléphone
    // et rouvre le site sur un ordinateur tomberait sur une bande unique qu'aucun
    // bouton ne permet plus de quitter : on le ramène à « deux colonnes ».
    // La condition est celle du CSS : un PC à souris. Une tablette tactile garde
    // ses trois affichages, dont la bande unique.
    if (v === 'compacte'
        && window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches) {
      return 'liste';
    }
    return v;
  } catch { return null; }   // navigation privée
}

function appliquerVue(v) {
  const retenue = VUES.includes(v) ? v : 'grille';
  etat.vue = retenue;
  document.body.dataset.vue = retenue;
  document.querySelectorAll('.vue').forEach((b) => {
    const actif = b.dataset.vue === retenue;
    b.classList.toggle('on', actif);
    b.setAttribute('aria-pressed', actif ? 'true' : 'false');
  });
  try { localStorage.setItem(CLE_VUE, retenue); } catch { /* privé : on s'en passe */ }
}

/* ---------- Thèmes ----------
   Dix palettes, définies en CSS (html[data-theme="…"]) : le script ne pose qu'un
   attribut. Chaque vignette des réglages montre les trois couleurs qui comptent
   (fond, carte, accent) — un aperçu, pas une devinette. */
const CLE_THEME = 'promos.theme';
/* Le thème de MARQUE est le défaut : c'est l'identité de la planche.
   Sa palette a été RELEVÉE par mesure sur les pastilles (les codes imprimés
   étaient illisibles — artefacts JPEG) : bleu clair #2692C1, orange #E99535,
   bleu moyen #2A689A, bleu nuit #0E3A59, terre cuite #B66C2D. */
const THEME_DEFAUT = 'kazendra';
const THEMES = [
  { id: 'kazendra', nom: 'Kazendra', fond: '#f4f7fa', carte: '#ffffff', accent: '#2a689a' },
  { id: 'nuit', nom: 'Nuit', fond: '#0c0d10', carte: '#14161b', accent: '#ff8a3d' },
  { id: 'ardoise', nom: 'Ardoise', fond: '#0e1418', carte: '#131c21', accent: '#35c6e0' },
  { id: 'foret', nom: 'Forêt', fond: '#0d130f', carte: '#121b14', accent: '#7ed957' },
  { id: 'bordeaux', nom: 'Bordeaux', fond: '#140d10', carte: '#1d1317', accent: '#e0567a' },
  { id: 'violette', nom: 'Violette', fond: '#100d18', carte: '#181326', accent: '#b06bff' },
  { id: 'ocean', nom: 'Océan', fond: '#08111d', carte: '#0e1a2b', accent: '#38bdf8' },
  { id: 'clair', nom: 'Clair', fond: '#f5f6f8', carte: '#ffffff', accent: '#c04d0a' },
  { id: 'sable', nom: 'Sable', fond: '#faf6ef', carte: '#ffffff', accent: '#a3671a' },
  { id: 'aube', nom: 'Aube', fond: '#fdf3f7', carte: '#ffffff', accent: '#c72c72' },
  { id: 'contraste', nom: 'Contraste', fond: '#000000', carte: '#0a0a0a', accent: '#ffd700' },
];
let theme = THEME_DEFAUT;

function themeEnregistre() {
  try { return localStorage.getItem(CLE_THEME); } catch { return null; }
}

function appliquerTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  theme = t.id;
  document.documentElement.dataset.theme = t.id;
  // La barre d'état du téléphone suit le fond du thème : sans ça, une bande de
  // l'ancienne couleur reste collée en haut de l'écran.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.fond);
  try { localStorage.setItem(CLE_THEME, t.id); } catch { /* navigation privée */ }
  majThemes();
}

/** Marque la vignette du thème courant (les vignettes ne sont jamais reconstruites). */
function majThemes() {
  document.querySelectorAll('#themes .theme').forEach((b) => {
    const actif = b.dataset.themeId === theme;
    b.classList.toggle('on', actif);
    b.setAttribute('aria-pressed', actif ? 'true' : 'false');
    const c = b.querySelector('.coche');
    if (c) c.textContent = actif ? '✓' : '';
  });
}

/* IL N'Y A PLUS DE PROFIL (décision de B, 12/10/2026) : « tu peux supprimer
   l'encadrement profil, il n'y a aucune plus-value à mettre son nom. L'idée est
   juste d'avoir des inscrits à la newsletter. Aucune autre inscription et aucune
   autre information n'est nécessaire. »

   Ce qui a disparu avec la rubrique : la clé « promos.profil », l'objet `profil`,
   sa lecture et son écriture, la pastille d'initiale et la fonction `initiale()`.
   Ce qui RESTE : l'adresse de l'inscription, qui EST le compte local (voir
   compte.js) — le nom du compte a toujours été l'adresse, jamais le prénom.
   La règle vaut pour tout le projet, sur tous les écrans. */

/* PAS DE TABLE DE LIBELLÉS POUR LES TROIS VUES. Elle servait au sélecteur
   d'affichage des Réglages, qui recopiait les boutons de la barre du haut :
   B l'a fait disparaître le 12/10/2026 (« ça n'a pas d'utilité »). Les trois
   modes n'ont donc plus qu'UN seul endroit : la barre du haut, dont les libellés
   sont écrits dans index.html et traduits comme le reste. */

/* ---------- Réglages ---------- */
/** ONGLETS DES RÉGLAGES. Un seul compartiment visible à la fois.
 *  Le choix n'est PAS mémorisé : on rouvre toujours sur « Compte », qui est ce
 *  qu'on vient chercher quand on ne sait pas où c'est. */
function afficherOnglet(nom) {
  const onglets = [...document.querySelectorAll('.onglet[data-onglet]')];
  const panneaux = [...document.querySelectorAll('.panneau[data-panneau]')];
  const connu = onglets.some((o) => o.dataset.onglet === nom);
  if (!connu) nom = onglets.length ? onglets[0].dataset.onglet : '';
  for (const o of onglets) {
    const actif = o.dataset.onglet === nom;
    o.setAttribute('aria-selected', actif ? 'true' : 'false');
    o.classList.toggle('on', actif);
  }
  for (const p of panneaux) p.hidden = p.dataset.panneau !== nom;
}

function dessinerReglages() {
  // Le paramètre est renommé « th » : « t » est désormais la fonction de
  // traduction importée — le masquer ici serait un piège silencieux.
  $('themes').innerHTML = THEMES.map((th) => `
    <button class="theme" data-theme-id="${th.id}" aria-pressed="false">
      <span class="pastilles" aria-hidden="true"><i style="background:${th.fond}"></i><i style="background:${th.carte}"></i><i style="background:${th.accent}"></i></span>
      <span class="nom">${esc(t(th.nom))}</span><span class="coche"></span>
    </button>`).join('');

  // Miroir des réglages de la barre du haut. Les boutons portent la classe
  // « vue » : appliquerVue() les allume tous, ici comme en haut — une seule
  // source de vérité, donc aucun risque de désaccord entre les deux endroits.
  dessinerLangue();
  dessinerCompte();
  dessinerDroits();
  majThemes();
}

/** LE BOUTON GOOGLE, rendu DANS l'encadré de l'inscription.
 *
 *  Demande de B (08/10/2026) : « L'inscription avec Google et Facebook doivent
 *  être dans l'encadrement de inscription car si il sélectionne ces deux moyens
 *  d'inscription ils doivent aussi choisir si ils s'inscrivent à la newsletter ».
 *
 *  PUIS, LE 11/10/2026 : « Enlever le login par Facebook garder celui de Google
 *  et l'activer. » Le bouton Facebook, son icône et son message sont donc
 *  RETIRÉS — il ne reste que Google.
 *
 *  Ce qui ne change pas, et c'est le point qui compte : LE BOUTON RESTE DANS LE
 *  CADRE DE L'INSCRIPTION, parce que LA CASE DES BONS PLANS EST DANS CE CADRE et
 *  vaut donc aussi pour ce chemin. Hors du cadre, elle n'aurait concerné que
 *  l'inscription manuelle, et quelqu'un qui passe par Google n'aurait jamais vu
 *  qu'il pouvait — ou ne pouvait pas — recevoir la newsletter.
 */
function blocConnexion() {
  const style = 'width:100%;display:flex;align-items:center;justify-content:center;gap:9px;'
    + 'padding:11px 12px;border-radius:11px;font:inherit;font-weight:600;font-size:14px;'
    + 'cursor:pointer;text-decoration:none;border:1px solid var(--bord)';
  return `
    <div class="ou-sep">
      <i></i><span>${esc(t('ou'))}</span><i></i>
    </div>
    <p>
      <button class="connexion" id="connexionGoogle" style="${style};background:#fff;color:#1f1f1f">
        <svg viewBox="0 0 48 48" aria-hidden="true" style="width:18px;height:18px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        ${esc(t("S'inscrire avec Google"))}
      </button>
    </p>
    <p class="note" style="font-size:12.5px;color:var(--doux)">
      ${esc(t("Cette inscription demande un identifiant d'application. Tant qu'il n'est pas renseigné, elle reste fermée."))}
    </p>`;
}

/** Ce qu'il faut dire à qui clique « S'inscrire avec Google » — ou null si
 *  l'inscription est réellement branchée (identifiant d'application renseigné).
 *  Depuis le 11/10/2026 il n'y a plus qu'un réseau : le texte est traduit avec
 *  le nom du réseau en paramètre, donc les versions déjà enregistrées dans les
 *  neuf langues continuent de servir.
 *
 *  LA PHRASE DIT « L'INSCRIPTION », PLUS « LA CONNEXION » : il n'y a rien à
 *  quoi se connecter. La phrase paramétrée est conservée (un seul réseau au
 *  lieu de deux) — retirer un appelant ne tue aucune clé, c'est la CHAÎNE
 *  écrite qui les tue.
 *
 *  LE CHOIX DES BONS PLANS FAIT PARTIE DE LA RÉPONSE. La case est dans le même
 *  encadré que le bouton, donc elle s'applique aussi à ce chemin. Le silence
 *  serait pire que l'absence : quelqu'un qui coche et clique Google croirait
 *  s'être inscrit aux bons plans. On le lui dit.
 */
function messageConnexion(reseau, veuxLettres) {
  const id = window.KAZENDRA_GOOGLE_CLIENT_ID;
  if (typeof id === 'string' && id.trim()) return null;   // renseigné : le branchement s'en occupe
  const base = t("L'inscription {r} n'est pas encore ouverte : il manque l'identifiant d'application.", { r: reseau });
  return veuxLettres
    ? `${base} ${t("Ton accord pour les bons plans est noté : il s'appliquera à l'adresse de ton compte {r}.", { r: reseau })}`
    : base;
}

/* Les drapeaux (langues ET pays) sont dessinés dans `drapeaux.js`, partagé avec
   le panneau d'administration : B a demandé le même tableau à drapeaux des
   deux côtés, et deux tables recopiées finiraient par diverger. */
/** Rubrique « Langue » : les 9 langues en LISTE, drapeau + nom natif.
 *
 *  Demande de B : « Pour la partie des langues tu peux utiliser plus de place
 *  dans l'onglet en mettant les drapeaux des pays avec la langue à côté. » Plus
 *  de menu déroulant, donc : « Pas besoin de menu déroulant. Il y a suffisamment
 *  de place. » Un menu déroulant cachait huit langues sur neuf derrière un clic ;
 *  ici les neuf sont visibles d'un coup, et on voit laquelle est active.
 *
 *  Le changement s'applique tout de suite (voir changerLangue) et ne touche
 *  JAMAIS au pays — deux clés distinctes. */
/** LA LISTE DES NEUF LANGUES — un seul dessin, deux endroits.
 *  Elle servait les Réglages ; depuis le 12/10/2026 elle sert aussi au bouton de
 *  la barre du haut, qui a pris la place du mode « une colonne » sur PC. Deux
 *  listes écrites séparément finissent toujours par diverger (leçon des pays). */
function htmlListeLangues({ actif = null } = {}) {
  const choix = langue();
  const retenu = actif || choix;
  return '<div class="langues" role="radiogroup" aria-label="' + esc(t('Langue')) + '">'
    + languesDisponibles().map((l) => `
      <button class="langue${l.code === retenu ? ' on' : ''}" data-langue="${esc(l.code)}"
              role="radio" aria-checked="${l.code === retenu}" type="button">
        <span class="drap" aria-hidden="true"><svg viewBox="0 0 24 16">${DRAPEAUX[l.code] || ''}</svg></span>
        <span class="nom-langue">${esc(l.nom)}</span>
        <span class="coche" aria-hidden="true">${l.code === retenu ? '✓' : ''}</span>
      </button>`).join('')
    + '</div>';
}

function dessinerLangue() {
  const rl = $('regLangue');
  if (rl) {
    rl.innerHTML = `<p class="aide-reglages">${esc(t('Choisis la langue de l’interface'))}</p>`
      + htmlListeLangues();
    rl.querySelectorAll('.langue').forEach((b) => {
      b.addEventListener('click', () => changerLangue(b.dataset.langue));
    });
  }
  dessinerBoutonLangue();
}

/** LE BOUTON DE LANGUE (barre du haut et Réglages, sur PC) : drapeau de la langue
 *  en cours, son code, et la flèche de choix. Il MONTRE l'état et ouvre la liste —
 *  même geste que le bouton de pays. Aucun attribut `data-i18n` sur ce bouton :
 *  c'est ici qu'on pose son libellé, sinon traduireDOM écraserait le drapeau. */
function dessinerBoutonLangue() {
  const code = langue();
  const l = languesDisponibles().find((x) => x.code === code);
  const dit = t('Langue') + ' : ' + (l ? l.nom : String(code).toUpperCase());
  document.querySelectorAll('[data-langue-bouton]').forEach((b) => {
    b.innerHTML = '<span class="drap" aria-hidden="true"><svg viewBox="0 0 24 16">'
      + (DRAPEAUX[code] || '') + '</svg></span>'
      + '<span class="code" aria-hidden="true">' + esc(String(code).toUpperCase()) + '</span>'
      + FLECHE_CHOIX;
    b.title = dit;
    b.setAttribute('aria-label', dit);
  });
}

/** Ouvre le choix de la langue (barre du haut). La liste est REDESSINÉE à chaque
 *  ouverture : elle doit montrer la langue en cours, pas celle d'hier. */
function ouvrirChoixLangue() {
  const modale = $('langueChoix');
  const liste = $('langueChoixListe');
  if (!modale || !liste) return;
  liste.innerHTML = htmlListeLangues();
  liste.querySelectorAll('.langue').forEach((b) => {
    b.addEventListener('click', () => { changerLangue(b.dataset.langue); fermerChoixLangue(); });
  });
  modale.hidden = false;
  const actif = liste.querySelector('.langue.on');
  if (actif) actif.focus();
}

function fermerChoixLangue() {
  const modale = $('langueChoix');
  if (modale) modale.hidden = true;
}

/** La mention d'affiliation du pied de page, dans la langue courante.
 *  Elle n'était posée qu'UNE fois, au démarrage : après une bascule de langue,
 *  le pied de page restait dans la langue précédente. Elle est désormais
 *  redessinée comme le reste de l'interface. */
function dessinerMention() {
  const p = $('mention');
  if (!p) return;
  // Les deux phrases viennent d'affiliation.js, en français (ce sont les clés du
  // dictionnaire) ; c'est ICI qu'elles passent à t(), avec le reste du rendu.
  p.textContent = t(affiliationActive()
    ? MENTION_AFFILIATION_ACTIVE
    : MENTION_AFFILIATION_INACTIVE);
}

/* LES PAGES ADMINISTRATIVES, DANS LA LANGUE DE L'INTERFACE.
 *
 * Les quatre pages légales existent en TROIS langues : français, néerlandais et
 * anglais. Le pied de page doit suivre la langue choisie — sinon un lecteur
 * néerlandais tomberait sur une page française, ou sur un intitulé français
 * au-dessus d'une page anglaise.
 *
 * Les six AUTRES langues de l'interface (de, es, it, pt, pl, sv) mènent à
 * l'ANGLAIS. C'est la règle de repli déjà appliquée aux liens sortants : une
 * page légale en anglais vaut mieux qu'une page légale dans une langue qu'on n'a
 * pas — et surtout bien mieux qu'un intitulé traduit vers une page inexistante.
 *
 * Sans JavaScript, le pied de page garde ce qu'écrit index.html : le français.
 * C'est la langue par défaut du site, et une page légale atteignable reste une
 * page légale.
 */
const PAGES_LEGALES = ['mentions-legales', 'confidentialite', 'cookies', 'cgu'];
const INTITULES_LEGAUX = {
  fr: ['Mentions légales', 'Confidentialité', 'Cookies', 'Conditions d’utilisation'],
  nl: ['Wettelijke vermeldingen', 'Privacy', 'Cookies', 'Gebruiksvoorwaarden'],
  en: ['Legal notice', 'Privacy', 'Cookies', 'Terms of use'],
};
const ARIA_LEGAUX = {
  fr: 'Informations légales', nl: 'Juridische informatie', en: 'Legal information',
};

function dessinerLiensLegaux() {
  const nav = $('liensLegaux');
  if (!nav) return;
  const code = INTITULES_LEGAUX[langue()] ? langue() : 'en';   // repli : anglais
  const noms = INTITULES_LEGAUX[code];
  const suffixe = code === 'fr' ? '' : '.' + code;
  nav.setAttribute('aria-label', ARIA_LEGAUX[code]);
  nav.querySelectorAll('a').forEach((a, i) => {
    a.setAttribute('href', PAGES_LEGALES[i] + suffixe + '.html');
    a.setAttribute('hreflang', code);
    a.setAttribute('lang', code);
    a.textContent = noms[i];
  });
}

/** Applique un changement de langue choisi par l'utilisateur.
 *
 *  Ordre : le moteur d'abord (mémoire + `document.lang`), puis le DOM statique,
 *  puis tout ce que le JavaScript construit — onglets, bandeau, réglages, cartes.
 *
 *  ⚠ CE QU'ELLE NE FAIT PAS, et c'est la règle d'architecture : elle ne touche
 *  NI le pays, NI les offres. Changer de langue ne change jamais le pays, et
 *  changer de pays ne change jamais la langue — deux clés distinctes, deux choix
 *  indépendants (testé par tests/i18n.test.mjs). */
function changerLangue(code) {
  if (!definirLangue(code)) return;   // code inconnu : on ne casse rien
  traduireDOM();
  dessinerLangue();
  // Les noms de pays et le nombre d'offres par pays sont des LIBELLÉS : sans ce
  // redessin, le sélecteur gardait « Tous les pays (10070) / Allemagne (1539) »
  // en français au milieu d'une interface allemande — mesuré dans le navigateur.
  dessinerPays();
  dessinerPuces();
  dessinerBandeau();
  dessinerReglages();
  dessinerMention(); // la mention d'affiliation est une phrase traduite
  dessinerLiensLegaux(); // les pages légales existent en trois langues
  majOutils();
  dessiner();
}


/** Blocs de l'onglet INFORMATIONS : le compte expliqué, puis les droits.
 *
 *  Ces textes vivaient dans l'onglet COMPTE, AU-DESSUS du formulaire
 *  d'inscription. B les a fait descendre ici (08/10/2026) :
 *   « Ce texte si : Aucun compte sur cet appareil / Ce compte ne crée rien en
 *     ligne […] Ce qu'il ne fera jamais […] Dois aller dans informations »
 *   « ce texte aussi : Tes données, tes droits […] Dois aller dans
 *     informations également »
 *  Ils EXPLIQUENT le modèle ; leur place n'est pas au-dessus d'un formulaire
 *  qu'ils n'aident pas à remplir.
 *
 *  La phrase sur les liens affiliés N'EST PLUS ICI : elle est déjà dans
 *  « Sources et données », juste sous la phrase qui décrit les sources qu'elle
 *  commente. Elle existait en DOUBLE (une version ici, une autre là) — une
 *  phrase recopiée à deux endroits finit toujours par diverger. Une seule
 *  mention, à l'endroit qui parle des liens : c'est ça, l'intégration.
 */
function blocDroits() {
  // PLUS DE COMPTE LOCAL — donc plus de « compte » à décrire (décision de B,
  // 11/10/2026 : « le mot de passe peut disparaître car il n'y a pas de
  // connexion. il y a juste une adresse mail qui est donné pour recevoir la
  // newsletter. »).
  //
  // CES PHRASES ONT ÉTÉ RÉÉCRITES, PAS RETIRÉES, et c'est le point important :
  // elles décrivaient un compte local, une empreinte de mot de passe et un
  // prénom affiché qui n'existent plus. Les laisser telles quelles aurait laissé
  // à l'écran, dans neuf langues, une description fausse de ce que le site
  // garde. Un texte qui décrit encore ce qui n'existe plus n'est pas un texte
  // mort : c'est un mensonge.
  //
  // L'ancien titre « Aucun compte sur cet appareil » est parti avec le reste :
  // il ne servait qu'à distinguer deux états (compte / pas de compte) dont un
  // seul subsiste.
  return `
    <div class="carte-bloc">
      <p>${esc(t("Il n'y a aucun compte à créer ici, et rien à retenir : ni nom, ni mot de passe. La seule chose que tu peux donner, si tu le veux, est ton adresse e-mail — pour recevoir les bons plans."))}</p>
      <p>${esc(t('Ce qui est conservé sur cet appareil : tes favoris et tes réglages. Rien n’en sort, jamais.'))} <b>${esc(t("Rien n'est envoyé, sauf l'adresse de ton inscription"))}</b>${esc(t(' : ni traqueur, ni cookie publicitaire.'))}</p>
    </div>
    <div class="carte-bloc" style="margin-top:12px">
      <ul>
        <li><b>${esc(t('Voir et emporter'))}</b> : ${esc(t('« Télécharger mes données » produit un fichier lisible qui contient tout.'))}</li>
        <li><b>${esc(t('Effacer'))}</b> : ${esc(t("« Effacer les données de cet appareil » retire tes favoris et tes réglages, sans délai et sans avoir à demander à personne. L'adresse de ton inscription se retire d'un clic, ici même, ou depuis le lien de l'e-mail reçu."))}</li>
        <li><b>${esc(t('Durée'))}</b> : ${esc(t("jusqu'à ce que tu supprimes. Tes favoris et tes réglages n'existent nulle part ailleurs ; l'adresse de ton inscription reste chez le responsable du site jusqu'à ta désinscription."))}</li>
      </ul>
    </div>`;
}

/** Ligne d'inscription dans la fiche du compte : où en est l'adresse, et de quoi
 *  la relancer.
 *
 *  LE STATUT AFFICHÉ EST TOUJOURS « en attente de confirmation », et c'est
 *  volontaire : la page ne peut pas savoir si le lien de l'e-mail a été cliqué
 *  (voir inscription.js). Seule la feuille de calcul porte le statut réel. On
 *  préfère afficher « en attente » à quelqu'un qui a déjà confirmé — il peut
 *  vérifier dans sa feuille — plutôt que d'annoncer une activation qu'on n'a pas
 *  constatée.
 *
 *  LE BOUTON DE RENVOI N'EST PAS UN CONFORT. Un e-mail de confirmation se perd :
 *  filtre anti-spam, adresse mal recopiée, changement de téléphone. Sans ce
 *  bouton, l'inscrit serait bloqué définitivement, et il n'aurait aucun moyen de
 *  le signaler. Le renvoi est fait par le tableau (voir doPost). */
/** L'encadré de l'inscription QUAND UNE ADRESSE EST DÉJÀ RETENUE : la ligne de
 *  l'inscription, le renvoi, et la désinscription.
 *
 *  Demande de B, 11/10/2026 : « Si une adresse mail est documentée alors le
 *  bouton se transforme en désinscription. pour supprimer la newsletter. » Le
 *  bouton « S'inscrire » devient donc « Se désinscrire » — le formulaire cède la
 *  place, dans le même cadre, à l'état réel de l'inscription.
 *
 *  CE QUI EST RETENU ICI EST « retenu sur cet appareil », et l'écran le dit :
 *  la page ne peut pas lire le tableau Google (voir inscription.js), elle ne
 *  peut donc pas afficher autre chose que ce qu'ELLE a enregistré. */
function carteAbonne(ins) {
  return `
    <div class="carte-bloc">
      <p style="margin:0 0 10px">${esc(t('Inscription : {n} — en attente de confirmation', { n: ins.email }))}</p>
      <p class="annonce" id="cAnnonce"></p>
      <p style="margin:0"><button class="outil" id="renvoyerConfirmation">${esc(t("Renvoyer l'e-mail de confirmation"))}</button></p>
      <p style="margin:8px 0 0"><button class="outil danger" id="seDesinscrire">${esc(t('Se désinscrire'))}</button></p>
    </div>`;
}

/** L'ENCADRÉ D'INSCRIPTION — une adresse, un accord, un bouton.
 *
 *  Demande de B, 11/10/2026 : « la partie mot de passe et mot de passe a répété,
 *  le mot de passe peut disparaître car il n'y a pas de connexion. il y a juste
 *  une adresse mail qui est donné pour recevoir la newsletter. Le bouton créer
 *  mon compte doit s'adapter en disant s'inscrire. »
 *
 *  LES DEUX CHAMPS DE MOT DE PASSE SONT PARTIS, et avec eux tout le compte
 *  local : il n'y avait ni serveur, ni connexion, ni synchronisation — un mot de
 *  passe qui ne servait qu'à créer un « compte » sans compte. Il ne reste que ce
 *  qui sert au but : une adresse e-mail, l'accord pour la recevoir, et un bouton.
 *
 *  LA CASE DES BONS PLANS EST TOUJOURS DANS CE CADRE : le bouton Google est
 *  dessiné dans le même encadré (voir blocConnexion), donc l'accord vaut aussi
 *  pour ce chemin. C'était la demande de B du 08/10/2026, et elle tient toujours. */
function carteInscription() {
  return `
    <div class="carte-bloc">
      <div class="champ">
        <label for="cMail">${esc(t('Adresse e-mail'))}</label>
        <input id="cMail" type="email" maxlength="120" autocomplete="email" inputmode="email" placeholder="nom@exemple.be">
      </div>
      <label class="consentement" style="display:flex;gap:9px;align-items:flex-start;margin:12px 0 4px;font-size:13.5px;line-height:1.45;cursor:pointer">
        <input id="cConsent" type="checkbox" style="margin-top:2px;flex:0 0 auto;width:16px;height:16px;accent-color:var(--accent)">
        <span>${esc(t('Je veux recevoir les bons plans par e-mail. Désinscription en un clic.'))}</span>
      </label>
      <p class="annonce" id="cAnnonce"></p>
      <p style="margin:0"><button class="enregistrer" id="sInscrire">${esc(t("S'inscrire"))}</button></p>
      ${blocConnexion()}
    </div>`;
}

/** Verse les blocs ci-dessus dans l'onglet Informations. */
function dessinerDroits() {
  const rd = $('regDroits');
  if (rd) rd.innerHTML = blocDroits();
}

/** LE PANNEAU « COMPTE » : l'inscription, puis les deux droits sur les données.
 *
 *  DEUX ÉTATS, AUCUN DES DEUX NE PARLE DE COMPTE. Soit aucune adresse n'est
 *  retenue sur cet appareil, et l'on dessine le formulaire d'inscription ; soit
 *  une adresse est retenue, et le bouton devient une désinscription — demande de
 *  B, 11/10/2026 : « Si une adresse mail est documentée alors le bouton se
 *  transforme en désinscription. pour supprimer la newsletter. »
 *
 *  CE QUI A DISPARU DE CETTE FONCTION, ET POURQUOI. Elle dessinait aussi une
 *  fiche de compte (pastille d'initiale, date de création, algorithme, nombre de
 *  tours), un changement de mot de passe, un verrouillage et une suppression de
 *  compte. Tout cela tenait au compte local — et le compte local n'est plus créé
 *  nulle part : ces boutons n'auraient plus eu aucune porte d'entrée, tout en
 *  restant écrits, prêts à être rebranchés par erreur.
 *
 *  LE PETIT ŒIL EST PARTI AVEC EUX. Il servait à relire un mot de passe que l'on
 *  venait de taper — il n'y a plus un seul champ de mot de passe dans
 *  l'application. Le garder aurait été du code mort avec ses neuf traductions.
 *
 *  LES DEUX DROITS QUI RESTENT — emporter et effacer — NE DÉPENDENT PAS DU
 *  COMPTE : ils portent sur les favoris, les réglages et l'adresse d'inscription.
 *  Ils sont donc dessinés pour tout le monde, juste sous le formulaire, et non
 *  plus dans une fiche de compte que personne ne peut plus ouvrir.
 */
function dessinerCompte() {
  const ins = inscriptionLocale();
  const formulaire = ins && ins.email ? carteAbonne(ins) : carteInscription();
  $('regCompte').innerHTML = formulaire + carteAppareil();
}

/** « Emporter » et « effacer » — les deux droits qui ne dépendent d'aucun compte.
 *
 *  « Télécharger mes données » produit un fichier lisible ; « Effacer les données
 *  de cet appareil » retire tout ce qui est gardé ici. L'un et l'autre étaient
 *  dans la fiche du compte, donc derrière un compte qui n'existe plus : les
 *  laisser là aurait supprimé des droits par accident.
 */
function carteAppareil() {
  return `
    <div class="carte-bloc" style="margin-top:12px">
      <p class="annonce" id="dAnnonce"></p>
      <p style="margin:0"><button class="outil" id="exporterDonnees">${esc(t('Télécharger mes données'))}</button></p>
      <p style="margin:8px 0 0"><button class="outil danger" id="effacerDonnees">${esc(t('Effacer les données de cet appareil'))}</button></p>
    </div>`;
}

/** Export RGPD : tout ce que l'application garde, dans un seul fichier lisible.
 *
 *  LE COMPTE N'EST PLUS EXPORTÉ, parce qu'il n'existe plus : le fichier listait
 *  `compte: { nom, cree, tours, algorithme }` — un export qui garde le champ
 *  d'une chose disparue est une collecte qui survit à l'écran. Ce qui reste est
 *  ce qui existe : l'inscription, les favoris, les réglages. */
function exporterDonnees() {
  const paquet = {
    application: 'Kazendra',
    exporteLe: new Date().toISOString(),
    avertissement: "Tout ce que l'application conserve sur cet appareil. La seule chose qui ait pu en "
                 + "sortir est l'adresse de ton inscription, et seulement si tu l'as demandée.",
    inscription: inscriptionLocale(),
    favoris,
    reglages: {
      theme: themeEnregistre(),
      affichage: vueEnregistree(),
      economieDeDonnees: lireBool(CLE_ECO),
    },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(paquet, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kazendra-mes-donnees.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function ouvrirReglages() {
  majThemes();
  // Brancher les onglets. On utilise « onclick » et non addEventListener :
  // ouvrir les réglages deux fois poserait sinon deux écouteurs sur le même
  // bouton, et le second clic basculerait deux fois.
  for (const o of document.querySelectorAll('.onglet[data-onglet]')) {
    o.onclick = () => afficherOnglet(o.dataset.onglet);
  }
  afficherOnglet('compte');
  $('feuille').hidden = false;
  $('reglages').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';   // pas de défilement derrière la feuille
}

function fermerReglages() {
  $('feuille').hidden = true;
  $('reglages').setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

/** Efface tout ce qui vit sur l'appareil, puis remet l'application à son défaut. */
function effacerTout() {
  try { localStorage.clear(); } catch { /* privé */ }
  favoris = [];
  appliquerTheme(THEME_DEFAUT);
  appliquerVue('grille');
  etat.eco = false;
  etat.favoris = false;
  // Le pays repart à « tous » : les données effacées emportent le choix, et la
  // question sera reposée à la prochaine ouverture.
  etat.pays = 'tout';
  majOutils();
  dessinerPuces();
  dessiner();
}

/* ---------- Économie de données ----------
   Une image masquée en CSS est quand même TÉLÉCHARGÉE : ce serait une fausse
   économie. Ici on n'émet simplement aucune adresse de visuel (voir carte()).
   Le réglage est mémorisé, comme celui de l'affichage. */
const CLE_ECO = 'promos.eco';
const CLE_FAV_ACTIF = 'promos.favorisActif';

function lireBool(cle) {
  try { return localStorage.getItem(cle) === '1'; } catch { return false; }
}
function ecrireBool(cle, v) {
  try { localStorage.setItem(cle, v ? '1' : '0'); } catch { /* privé */ }
}

/* ---------- Favoris ----------
   On garde une COPIE de l'offre, pas seulement son identifiant : une offre
   quitte la liste au bout de 30 jours, et « retrouver plus tard » n'aurait
   alors plus aucun sens. La copie porte la date de mise de côté. À l'affichage,
   si l'offre est encore dans la liste du jour on montre la version FRAÎCHE ;
   sinon la copie est signalée comme telle, avec le prix de l'époque — on ne
   fait jamais passer un ancien prix pour le prix courant. */
const CLE_FAV = 'promos.favoris';
let favoris = [];

function chargerFavoris() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_FAV) || '[]');
    favoris = Array.isArray(brut) ? brut.filter((f) => f && f.offre && f.offre.id && f.misDeCote) : [];
  } catch { favoris = []; }
}
function enregistrerFavoris() {
  try { localStorage.setItem(CLE_FAV, JSON.stringify(favoris)); } catch { /* privé */ }
}
const estFavori = (id) => favoris.some((f) => f.offre.id === id);

/** Liste à afficher en mode favoris : version fraîche si l'offre existe encore. */
function listeFavoris() {
  const parId = new Map(etat.offres.map((o) => [o.id, o]));
  return favoris.map((f) => {
    const fraiche = parId.get(f.offre.id);
    return fraiche
      ? { ...fraiche, encoreEnListe: true, misDeCote: f.misDeCote }
      : { ...f.offre, encoreEnListe: false, misDeCote: f.misDeCote };
  });
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* =============================================================================
   LA DEVISE — un prix s'affiche dans SA monnaie, jamais dans la nôtre.

   DÉFAUT MESURÉ, rapporté par B le 08/10/2026 : « il faut que l'annonce affiche
   le prix original dans l'annonce et l'adapter si ce n'est pas de l'euro ».
   Avant ce correctif, tout se terminait par « € » : un seul formateur pour
   toutes les places de marché.

   Or le collecteur lit chaque place de marché DANS SA MONNAIE. Relevé
   directement dans la charge des pages Amazon (goldbox), le 08/10/2026 :

       amazon.co.uk →  "currencyCode":"GBP"
       amazon.pl    →  "currencyCode":"PLN"
       amazon.se    →  "currencyIsoCode":"SEK"
       amazon.de    →  "currencyCode":"EUR"

   Conséquence visible sur le site en ligne : un home trainer Wahoo qui vaut
   environ 600 € s'affichait « 6 089 € » avec le badge « économise 24 163 € ».
   Le pourcentage, lui, restait juste — un rapport ne dépend pas de la monnaie —
   et c'est précisément ce qui rendait le montant crédible.

   POURQUOI ON NE CONVERTIT PAS. Convertir exigerait un cours de change : soit
   un service tiers (le projet refuse tout tiers et toute clé), soit un taux
   recopié à la main, qui se périme en silence. On affiche donc le prix
   D'ORIGINE, avec sa monnaie — c'est aussi la seule valeur que le visiteur
   pourra vérifier lui-même sur la boutique qu'il ouvre.

   ATTENTION : ce tableau est une DÉCLARATION, pas une déduction. Il a été
   établi en lisant la devise que chaque place de marché annonce elle-même.
   La correction de fond — faire lire cette devise par le collecteur au lieu de
   la déclarer ici — est décrite dans PLAN-RESTE-A-FAIRE.md.
   ============================================================================= */
const DEVISE_PAR_PAYS = {
  // `avant` : la monnaie se place AVANT le nombre (usage britannique : £153,39).
  GB: { code: 'GBP', symbole: '£', avant: true },
  SE: { code: 'SEK', symbole: 'kr', avant: false },
  PL: { code: 'PLN', symbole: 'zł', avant: false },
};
const DEVISE_EURO = { code: 'EUR', symbole: '€', avant: false };

/** La monnaie d'une offre, d'après son pays. Défaut : l'euro. */
const deviseDe = (o) => (o && DEVISE_PAR_PAYS[o.pays]) || DEVISE_EURO;

/** Un montant dans SA monnaie : « £153,39 » · « 6 089 kr » · « 830 zł » · « 1 234,56 € ». */
const montant = (v, devise) => {
  if (v == null) return '';
  const d = devise || DEVISE_EURO;
  const n = (Math.round(v * 100) / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2,
  });
  return d.avant ? d.symbole + n : n + ' ' + d.symbole;
};


/* =============================================================================
   LE MÊME PRODUIT, SUR UNE AUTRE PLACE DE MARCHÉ

   Demande de B, 08/10/2026 : « Tu dois garder les mêmes produits qui viennent
   d'Amazon, mais tu peux préciser qu'il y a moins cher dans un autre Amazon. »

   Les places de marché Amazon vendent le MÊME produit, chacune à son prix :
   mesuré sur le catalogue publié le 08/10/2026, 279 produits sont vendus sur au
   moins deux places (837 offres). Exemple réel : le même home trainer Wahoo à
   6 089 kr sur amazon.se et à 429,99 € sur amazon.de.

   La clé qui dit « c'est le même produit » est l'ASIN, présent dans l'adresse
   (« /dp/B0FLQDCR7X »). Le PAYS ne suffit pas : les offres autrichiennes
   pointent vers amazon.de, comme les allemandes — deux pays, une seule boutique.
   On regroupe donc par PLACE DE MARCHÉ, pas par pays.

   CE QU'ON AFFIRME, ET CE QU'ON TAIT :
     • « moins cher » n'est dit QUE si les deux prix sont dans LA MÊME monnaie :
       là, la comparaison ne dépend d'aucun cours de change.
     • entre deux monnaies, on nomme l'autre place et son prix DANS SA MONNAIE,
       sans jamais convertir ni classer. Convertir exigerait un cours de change,
       refusé par le projet (voir la note de la DEVISE ci-dessus).
   ============================================================================= */

/** L'adresse d'une offre, quelle que soit celle qui est renseignée. */
const lienDe = (o) => String((o && (o.lienMarchand || o.lienPage)) || '');

/** Une offre vendue par une place de marché Amazon. Lue sur le LIEN, pour que
 *  cette tranche de code se suffise à elle-même (aucune voisine à appeler). */
const estPlaceAmazon = (o) => /^(?:https?:\/\/)?(?:www\.)?amazon\.[a-z.]{2,7}\//i.test(lienDe(o));

/** La place de marché d'une adresse : « amazon.de », « amazon.se »… */
function placeAmazon(o) {
  const m = lienDe(o).replace(/^https?:\/\/(?:www\.)?/i, '').match(/^(amazon\.[a-z.]{2,7})/i);
  return m ? m[1].toLowerCase().replace(/\.$/, '') : '';
}

/** L'ASIN : la seule clé qui dise « c'est le même produit ». */
function asinDe(o) {
  const m = lienDe(o).match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?#]|$)/);
  return m ? m[1] : '';
}

/** « amazon.de » → « Amazon.de » : une place se nomme comme elle s'écrit. */
const nomPlace = (place) => place ? place.charAt(0).toUpperCase() + place.slice(1) : '';

/** Index ASIN → offres, construit UNE SEULE FOIS au chargement. Le reconstruire
 *  à chaque carte ferait parcourir 14 000 offres vingt-quatre fois par rendu. */
function indexerProduits(offres) {
  const index = new Map();
  for (const o of offres || []) {
    if (!o || !estPlaceAmazon(o)) continue;
    const a = asinDe(o);
    if (!a) continue;
    if (!index.has(a)) index.set(a, []);
    index.get(a).push(o);
  }
  return index;
}

/** Les autres places qui vendent CE produit, et si l'une est moins chère.
 *
 *  Renvoie { moinsCher, autres } :
 *    moinsCher : la place MOINS CHÈRE DANS LA MÊME monnaie (null s'il n'y en a
 *                pas — et null aussi quand le frère est en monnaie étrangère :
 *                on ne classe pas ce qu'on ne peut pas comparer) ;
 *    autres    : les autres places, une par place, chacune avec SON prix.
 *
 *  Ne convertit jamais rien et ne modifie jamais une offre : les prix rendus
 *  sont exactement ceux du catalogue. */
function autresPlaces(o, index, taux) {
  const vide = { moinsCher: null, autres: [] };
  if (!o || !index || typeof index.get !== 'function' || !estPlaceAmazon(o)) return vide;
  const asin = asinDe(o);
  const maPlace = placeAmazon(o);
  if (!asin || !maPlace) return vide;
  const maDevise = deviseDe(o).code;
  const table = (taux && taux.taux) || null;

  const vues = new Set([maPlace]);
  const autres = [];
  let moinsCher = null;
  for (const x of index.get(asin) || []) {
    if (x === o || x.id === o.id) continue;
    const place = placeAmazon(x);
    if (!place || vues.has(place)) continue;   // une seule ligne par place
    if (x.prix == null) continue;
    vues.add(place);
    const devise = deviseDe(x);
    // Un frère dans MA monnaie se compare directement. Un frère dans une AUTRE
    // monnaie se convertit au taux du jour — et s'il n'y a pas de taux, il n'est
    // pas classé du tout : on se tait plutôt que d'inventer un ordre.
    const equivalentDansLaMienne = devise.code === maDevise ? null : equivalent(x.prix, devise.code, maDevise, table);
    const comparable = devise.code === maDevise ? x.prix : equivalentDansLaMienne;
    // MÊME MONNAIE : la comparaison est exacte, on prend le moindre centime.
    // MONNAIES DIFFÉRENTES : le taux est une approximation, et les frais de
    // change existent. En dessous de 2 %, l'écart ne prouve rien — on se tait.
    const moinsCherQueMoi = o.prix != null && comparable != null
      && (devise.code === maDevise
        ? comparable < o.prix
        : comparable < o.prix * (1 - ECART_MIN_CHANGE / 100));
    if (moinsCherQueMoi) {
      if (!moinsCher || comparable < moinsCher.comparable) {
        moinsCher = { place, prix: x.prix, devise, id: x.id, equivalent: equivalentDansLaMienne, comparable };
      }
    } else {
      autres.push({ place, prix: x.prix, devise, id: x.id, equivalent: equivalentDansLaMienne });
    }
  }
  // Même monnaie d'abord (comparable), puis du moins cher au plus cher.
  autres.sort((x, y) => ((x.devise.code === maDevise ? 0 : 1) - (y.devise.code === maDevise ? 0 : 1))
    || (x.prix - y.prix));
  return { moinsCher, autres: autres.slice(0, 2) };
}

/* ---- LE TAUX DE CHANGE, POUR COMPARER CE QUI N'EST PAS DANS LA MÊME MONNAIE --
 *
 * Décision de B, 08/10/2026 : « Moins cher avec le taux de la BCE du jour
 * affiché à côté ». La règle « on ne convertit jamais » protégeait le PRIX
 * affiché — celui qu'on retrouve sur la boutique, et qu'on peut vérifier. Elle
 * n'interdisait pas de COMPARER deux prix, à condition de le faire au grand jour.
 *
 * On compare donc, et on montre les trois choses : le prix d'origine, son
 * équivalent, et le taux qui l'a produit avec sa date. La BCE publie une fois
 * par jour ouvré : un taux « du jour » peut dater d'hier ou de vendredi, et le
 * visiteur a le droit de le savoir.
 *
 * D'où vient le taux : du fichier `devises.json`, écrit par le COLLECTEUR.
 * Jamais d'appel à la BCE depuis le navigateur — elle n'envoie pas d'en-tête
 * CORS, la requête serait refusée, et le projet n'appelle aucun tiers depuis
 * chez le visiteur.
 *
 * SANS TAUX, AUCUNE COMPARAISON : si le fichier manque, on retombe exactement
 * sur le comportement d'avant — nommer l'autre place, sans classer.
 * --------------------------------------------------------------------------- */

/** Le seuil qui vaut entre deux MONNAIES : en dessous de 2 %, l'écart se noie
 *  dans l'arrondi du taux et dans les frais de change — l'annoncer serait une
 *  affirmation que le chiffre ne porte pas.
 *  Il ne s'applique JAMAIS dans la même monnaie : là, 6 € d'écart sont 6 €, et
 *  la comparaison est exacte. */
const ECART_MIN_CHANGE = 2;

/** Un prix converti d'une monnaie à l'autre, via l'euro (la BCE cote en euros). */
function equivalent(prix, de, vers, taux) {
  if (prix == null || !taux) return null;
  const enEuro = de === 'EUR' ? prix : (taux[de] ? prix / taux[de] : null);
  if (enEuro == null) return null;
  const sorti = vers === 'EUR' ? enEuro : (taux[vers] ? enEuro * taux[vers] : null);
  return sorti == null ? null : Math.round(sorti * 100) / 100;
}

/** « 2026-10-08 » → « 08/10 ». Le taux se cite avec SA date, jamais tout seul. */
function dateCourte(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}` : String(iso || '');
}

/** La mention affichée sur la carte — vide quand il n'y a rien à dire. */
function mentionAilleurs(o) {
  const taux = etat.taux;
  const { moinsCher, autres } = autresPlaces(o, etat.indexProduits, taux);
  if (!moinsCher && !autres.length) return '';
  // Un prix se cite dans SA monnaie ; quand elle n'est pas la nôtre, on ajoute
  // l'équivalent AU TAUX AFFICHÉ AVEC SA DATE. Jamais l'un sans l'autre.
  const prixDe = (a) => {
    const base = montant(a.prix, a.devise);
    if (a.equivalent == null) return base;
    return base + ' ' + t('(≈ {prix}, taux BCE du {date})', {
      prix: montant(a.equivalent, deviseDe(o)), date: dateCourte(taux && taux.date),
    });
  };
  const morceaux = [];
  if (moinsCher) {
    morceaux.push('<b>' + esc(t('Moins cher sur {place} : {prix}', {
      place: nomPlace(moinsCher.place), prix: prixDe(moinsCher),
    })) + '</b>');
  }
  for (const a of autres) {
    morceaux.push(esc(t('Aussi sur {place} : {prix}', {
      place: nomPlace(a.place), prix: prixDe(a),
    })));
  }
  return '<p class="ailleurs" title="' + esc(t("Le même produit, sur une autre place de marché. Les prix ne sont pas convertis : chacun s'affiche dans sa monnaie.")) + '">'
    + morceaux.join(' · ') + '</p>';
}

function ilYA(iso) {
  const mn = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mn)) return '';
  // Les trois âges relatifs passent par le dictionnaire : sans cela l'en-tête
  // allemand affichait « aktualisiert il y a 7 min » — mesuré dans le navigateur
  // le 7/10, la seule ligne restée française d'un bandeau par ailleurs traduit.
  if (mn < 60) return t('il y a {n} min', { n: Math.max(1, mn) });
  if (mn < 1440) return t('il y a {n} h', { n: Math.round(mn / 60) });
  return t('il y a {n} j', { n: Math.round(mn / 1440) });
}

/* ---- Ce qu'est une BONNE promotion, et pourquoi ce n'est pas un avis ----
 *
 *  DEUX PRIX RÉELS affichés : le prix demandé ET son prix de référence. C'est la
 *  seule preuve qu'on puisse montrer sur la carte — « 29,99 € au lieu de
 *  89,99 € ». Un pourcentage écrit sans prix ne prouve rien : mesuré sur les
 *  données réelles, le tri par pourcentage faisait remonter des « -99 % » qui
 *  étaient « 99 % sRGB » dans le titre d'un écran d'occasion, et des « -70 % »
 *  sans aucun prix.
 *
 *  ET au moins 15 % de remise. En dessous, ce n'est pas un bon plan, c'est un
 *  prix : 61 offres du catalogue étaient entre 10 et 14 %, elles n'aident
 *  personne à décider.
 *
 *  Ce que cette règle donne sur le catalogue réel : 315 offres, dont 98 % chez
 *  Amazon, remise moyenne 35 %, économie moyenne 119 €. Peu de lignes, mais
 *  toutes défendables — et c'est ce qui fait revenir l'utilisateur.
 */
const REMISE_MIN = 15;

/*  ÉTAGE 2 — l'offre d'ENSEIGNE.
 *
 *  Pourquoi il a fallu un second étage, et pourquoi ce n'est pas un
 *  relâchement de la règle : mesuré sur les données réelles, les 317 promos à
 *  deux prix réels étaient 311 fois chez Amazon. Or les grandes enseignes
 *  européennes NE publient PAS de prix barré lisible — sondé une par une,
 *  MediaMarkt (BE/NL/PL), bol.com, Coolblue, Darty, Fnac, Currys, Argos,
 *  Elgiganten, Worten : 403, 429, ou page vide. Aucune ne livre de donnée
 *  produit. Exiger deux prix barrés partout, c'était donc afficher 98 %
 *  d'Amazon : l'inverse du catalogue demandé.
 *
 *  Ce qu'on peut prouver pour une enseigne : le PRIX RÉEL affiché, le NOM de
 *  la boutique, et un signe de qualité qui ne vient pas de nous — soit une
 *  remise annoncée ≥ 15 %, soit le score que la communauté donne au bon plan
 *  (≥ 100°). Le reste est jeté.
 */
const CHALEUR_MIN = 100;

/** Un pourcentage ANNONCÉ (et non calculé entre deux prix réels) ne vaut que
 *  s'il est crédible. Au-delà de 90 %, ce n'est plus une remise : « 99 % sRGB »
 *  dans le titre d'un écran d'occasion a déjà produit une fausse remise de
 *  99 %, et l'offre est entrée dans les « bonnes promos » par cette porte. Un
 *  faux pourcentage est pire que pas d'offre. */
const REMISE_ANNONCEE_MAX = 90;
const remiseCredible = (o) => o.remise != null && o.remise >= REMISE_MIN && o.remise <= REMISE_ANNONCEE_MAX;

/** La remise qu'on peut MONTRER sur la carte, ou null.
 *
 *  Distinction nécessaire : une offre peut être légitime (score communautaire
 *  478°, prix réel de 63,99 € chez un vrai marchand) et porter malgré tout un
 *  faux pourcentage dans son titre — le Dell P2422H « 99 % sRGB » passait ainsi
 *  avec « -99 % » écrit sur la carte. L'offre reste, le pourcentage faux part.
 */
function remiseMontrable(o) {
  if (o.remise == null || o.remise < REMISE_MIN) return null;
  return (o.remiseCalculee || o.remise <= REMISE_ANNONCEE_MAX) ? o.remise : null;
}

/** Un journal n'est pas une enseigne : « Le Parisien » vend du papier, pas des
 *  écouteurs. Sans ce crible, les rédactions (Le Parisien, Forbes, Les
 *  Numériques, HDblog, dslweb, Mac4Ever…) remplissaient les 40 % et
 *  l'étiquette « enseigne » devenait un mensonge. */
/* LES NOMS DE RÉDACTION — ET CE QU'ON EN A RETIRÉ LE 15/10/2026.
 *
 * Ce filtre sert à DEUX choses opposées : écarter une rédaction de la porte des
 * enseignes (voir estOffreEnseigne), et y faire entrer un article de presse quand
 * il porte un vrai prix (voir estBonPlanPresse).
 *
 * Il se terminait par des SUFFIXES DE DOMAINE NUS — \.fr \.com \.it \.net \.be
 * \.de \.es \.pt \.pl \.se \.ie \.uk \.nl — ajoutés pour reconnaître un article
 * cité par son domaine. Mesuré le 15/10/2026 : ils attrapaient aussi TOUTE
 * BOUTIQUE dont le nom porte son extension. Les deux effets ont été constatés à
 * l'écran, sur le site en ligne :
 *   — l'étiquette : « presse » était annoncé sur des boutiques (Parfimo.de,
 *     Lieblingsfoto.de), et le bouton d'une carte bol.com à deux prix réels
 *     disait « Lire le bon plan » au lieu de « Voir chez bol.com » — une
 *     promotion prouvée servie comme un article de journal ;
 *   — des promotions RETENUES hors de la vue par défaut : 63 de plus s'affichent
 *     sans ces 13 motifs (5 997 → 6 060, mesuré sur le catalogue du 14/10 22 h 45).
 * Les vrais noms de presse restent dans la liste, donc la « presse » ne garde que
 * ce qui est de la presse (mesuré : les 4 cartes TuttoAndroid).
 *
 * Ce qui avait été payé, et ne doit pas revenir : un `|\.xx\b` ajouté « pour
 * reconnaître un domaine » attrape aussi les enseignes qui publient leur adresse.
 */
const REDACTIONS = /(parisien|figaro|[ée]quipe|forbes|independent|mashable|estad|express|ginjfo|phototrend|labomaison|iphoneaddict|mac4ever|watchgeneration|num[ée]rique|phonandroid|dslweb|hdblog|tuttotech|tomshw|tuttoandroid|presse|dealabs|hotukdeals|mydealz|chollometro|preisjaeger|journal|magazine|bloomberg|wired|verge|01net|frandroid|clubic|journaldugeek|numerama|presse-citron|tomshardware)/i;

/** Noms de marchand qui ne désignent AUCUNE boutique : le nom de la source
 *  elle-même quand le flux ne dit rien, ou un domaine brut. */
const MARCHANDS_NON_BOUTIQUE = /^(dealabs|hotukdeals|mydealz|chollometro|pepper(\s+(nl|pl))?|preisjaeger|presse|nl|pl|fr|de|es|it|pt|se|ie|gb|uk|at|be|marchand|abc|deal|deals)$/i;

const estAmazon = (o) => /amazon/i.test(String(o.marchand || ''));

/** Étage 1 — deux prix réels affichés, remise ≥ 15 %. C'est la preuve montrable. */
const estPromoVerifiee = (o) => o.prix != null && o.prixAvant != null && o.prixAvant > o.prix
  && o.remise != null && o.remise >= REMISE_MIN;

/** Étage 2 — une vraie boutique, un prix réel, et un signe de qualité.
 *
 *  Deux signes, et deux seulement :
 *   — une remise annoncée par la source, crédible (≥ 15 % et ≤ 90 %) ;
 *   — ou le score que la communauté donne au bon plan (≥ 100°).
 *
 *  DÉFAUT CORRIGÉ — l'étage acceptait aussi toute offre publiée sur la « page
 *  d'offres » d'une enseigne. L'intention était de sauver la couverture belge :
 *  sans cela, la Belgique ne rendait que 8 lignes. Mesure faite sur cette page :
 *  22 produits, 5 seulement portent un prix de référence, UN SEUL atteint 15 %.
 *  Ce n'est donc pas une page de promotions, c'est un catalogue à prix nu — et
 *  la faire passer remplissait l'application d'annonces sans aucune réduction,
 *  précisément ce qu'un utilisateur venu chercher des bons plans ne veut pas.
 *  Une enseigne n'entre plus ici que si elle apporte une réduction réelle. */
function estOffreEnseigne(o) {
  if (estAmazon(o)) return false;
  if (o.prix == null || !o.marchand) return false;
  const m = String(o.marchand).trim();
  if (!m || MARCHANDS_NON_BOUTIQUE.test(m) || REDACTIONS.test(m)) return false;
  if (remiseCredible(o)) return true;                             // remise annoncée par la source
  return o.temperature != null && o.temperature >= CHALEUR_MIN;   // score de la communauté
}

/** Étage 3 — la PRESSE, à la demande de l'utilisateur.
 *
 *  Un article de presse n'est PAS une enseigne : on ne l'étiquette jamais
 *  comme telle, sinon l'étiquette ment. Mais quand il porte un prix réel ET une
 *  remise annoncée ≥ 15 %, c'est un vrai bon plan — « les écouteurs Nothing Ear
 *  (3) chutent à 96 € au lieu de 179 € ». Ces articles sont donc admis, marqués
 *  « presse », et comptés dans les 40 % aux côtés des enseignes.
 */
function estBonPlanPresse(o) {
  if (o.prix == null || !remiseCredible(o)) return false;
  const m = String(o.marchand || '').trim();
  // Le nom de la source (dealabs, pepper, presse…) n'est pas une signature :
  // il ne dit pas qui a relevé l'offre, donc il n'entre pas ici.
  if (!m || MARCHANDS_NON_BOUTIQUE.test(m)) return false;
  return REDACTIONS.test(m);
}

/** Étage 4 — la BONNE AFFAIRE : ni prix, ni remise chiffrable.
 *
 *  Nécessaire parce que les grandes enseignes refusent qu'on lise leurs prix
 *  (Media Markt, Bol, Argos, Tesco, Costco, Media Expert, Allegro, Biedronka…).
 *  Leurs promotions n'existent chez nous que RELAYÉES par les communautés : nom
 *  de la boutique, photo, lien, score d'intérêt — mais aucun prix. Les jeter,
 *  c'était perdre l'enseigne entière.
 *
 *  On les montre donc pour ce qu'elles sont : une photo, un titre, une
 *  boutique, un lien — et AUCUN prix, puisque nous n'en avons pas. Le badge
 *  « bonne affaire » le dit à l'écran : jamais de pourcentage inventé, jamais de
 *  prix déduit du titre.
 *
 *  Deux garde-fous : la source doit être une COMMUNAUTÉ (c'est elle qui nomme
 *  la boutique — un journal n'est pas un marchand), et le bon plan doit être
 *  réellement populaire (≥ 100°). Amazon est exclu : ses offres se prouvent par
 *  leurs deux prix, ailleurs dans l'application.
 */
const CHALEUR_AFFAIRE = 100;

function estBonneAffaire(o) {
  if (o.prix != null) return false;                       // un prix ⇒ étage 1 ou 2
  if (estAmazon(o)) return false;                         // Amazon se prouve par ses prix
  if (!o.titre || !(o.lienMarchand || o.lienPage)) return false;
  if (!SOURCE_COMMUNAUTE.test(String(o.sourceId || ''))) return false;
  const m = String(o.marchand || '').trim();
  if (!m || MARCHANDS_NON_BOUTIQUE.test(m) || REDACTIONS.test(m)) return false;
  return o.temperature != null && o.temperature >= CHALEUR_AFFAIRE;
}

const estBonnePromo = (o) => estPromoVerifiee(o) || estOffreEnseigne(o) || estBonPlanPresse(o) || estBonneAffaire(o);

/** Clé de dédoublonnage : le même produit au même prix chez la même boutique
 *  n'a pas à figurer deux fois. Cas réel : l'Allemagne et l'Autriche partagent
 *  amazon.de — le même Fire TV Stick apparaissait deux fois de suite. */
const cleProduit = (o) => `${String(o.titre || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90)}|${o.prix}`;

function dedoublonner(liste) {
  const vus = new Set();
  const sortie = [];
  for (const o of liste) {
    const k = cleProduit(o);
    if (vus.has(k)) continue;
    vus.add(k);
    sortie.push(o);
  }
  return sortie;
}

/*  MÉLANGE 60 % / 40 % — EN PAUSE.
 *
 *  Ce que la règle faisait : la majorité des résultats devait pointer chez
 *  Amazon (lien direct, commissions), et 40 % vers les autres enseignes du pays.
 *  C'était un plafond des DEUX côtés — donc une vraie proportion, et pas une
 *  simple préférence de tri. Sans plafond sur les enseignes, la Belgique
 *  (44 promos Amazon pour 157 offres d'enseignes) affichait 22 % d'Amazon ;
 *  sans plafond sur Amazon, les pays riches en ventes flash repartaient à 98 %.
 *
 *  POURQUOI ELLE EST EN PAUSE (B, 08/10/2026) : « mettre en pause le 60/40 en
 *  faveur d'Amazon, tous les acteurs affichent en fonction de ce qu'il publie,
 *  sans préférence. » Autrement dit : l'ordre ne doit plus être arbitré entre
 *  deux camps, il doit suivre ce que chaque acteur apporte réellement.
 *
 *  MISE EN PAUSE, PAS SUPPRESSION. La règle reste écrite, complète, et elle
 *  reste ÉPROUVÉE (voir tests/melange.test.mjs, qui la rejoue avec l'interrupteur
 *  sur « actif »). Le jour où on la rallume, elle sera exactement celle qu'on
 *  connaissait — on ne réécrira pas une règle de mémoire.
 *
 *  CE QUI CHANGE À L'ÉCRAN. Plus de plafond, plus de quotas de camps, plus
 *  d'alternance : la liste est simplement classée par ce que les offres valent
 *  (remise, prix, intérêt), tous acteurs mêlés. Aucune offre n'est écartée au
 *  nom d'une proportion — c'était le vrai enjeu, puisqu'un plafond SACRIFIE des
 *  offres réelles pour tenir un pourcentage.
 */
const MELANGE_ACTIF = false;

const PART_AMAZON = 0.6;

/** Sous ce nombre de lignes, une liste ne se juge plus : plutôt que de
 *  sacrifier des offres réelles à une proportion, on montre tout. Plancher
 *  mesuré sur le cas polonais (16 Amazon pour 1 enseigne → 2 lignes). */
const MELANGE_MIN = 24;

/** Part des 40 % réservée à la presse quand des articles existent. Sans ce
 *  quota, le plafond coupait toujours la queue du camp — donc tous les articles
 *  de presse, puisqu'ils sont classés après les boutiques : les « quelque
 *  annonce presse » demandées disparaissaient en totalité. Dix pour cent, c'est
 *  « quelques-unes » : présent, jamais envahissant. */
const QUOTA_PRESSE = 0.1;

/** Part des 40 % réservée aux BONNES AFFAIRES sans prix (voir estBonneAffaire).
 *  Sans quota, elles étaient classées après les offres à prix et le plafond les
 *  évincait toutes : les enseignes qu'on ne peut pas chiffrer (Bol, Media
 *  Expert, Tesco, Argos…) n'auraient jamais été visibles — exactement ce qu'on
 *  cherche à corriger. */
const QUOTA_AFFAIRE = 0.25;

/** Les sources qui RELAIENT un bon plan — les communautés. Elles nomment la
 *  boutique et donnent le score d'intérêt : c'est ce qui autorise une « bonne
 *  affaire » sans prix. Les sources de presse, elles, signent l'article du nom
 *  du journal, qui n'est pas une boutique. */
const SOURCE_COMMUNAUTE = /^(dealabs|mydealz|chollometro|pepper|hotukdeals|preisjaeger)/i;

/** Entrelace deux listes selon la part cible de la première.
 *  Sert à RÉPARTIR les bonnes affaires dans tout le camp des 40 % au lieu de
 *  les entasser à la fin : groupées, il fallait dérouler plus de 1 600 cartes
 *  pour en croiser une — autant dire jamais. */
function entrelacer(a, b, partA) {
  const total = a.length + b.length;
  const sortie = [];
  let i = 0;
  let j = 0;
  for (let k = 0; k < total; k += 1) {
    const veutA = Math.round((k + 1) * partA) > i;
    if (i < a.length && (veutA || j >= b.length)) sortie.push(a[i++]);
    else sortie.push(b[j++]);
  }
  return sortie;
}

function melanger(liste, cmp) {
  // Chaque camp est trié AVANT d'alterner. Sans ça, un tri appliqué après coup
  // (par remise décroissante) remettait tous les Amazon en tête : le mélange
  // existait dans les données et disparaissait à l'écran. Mesuré sur le site
  // publié : vingt cartes Amazon d'affilée sous un en-tête annonçant 60/40.
  const tri = cmp || (() => 0);
  // EN PAUSE : la liste est rendue classée telle quelle — pas d'arbitrage entre
  // deux camps, pas de plafond, pas de quota, pas d'alternance. Conséquence
  // voulue : AUCUNE offre n'est sacrifiée pour tenir un pourcentage, et l'ordre
  // suit ce que chaque acteur publie.
  if (!MELANGE_ACTIF) return [...liste].sort(tri);
  const amazon = liste.filter(estAmazon).sort(tri);
  // Dans le camp des 40 %, les BOUTIQUES passent avant la presse. Les articles
  // ont souvent deux prix réels, donc un meilleur rang au tri : sans ce
  // départage, la première page d'un Belge était faite de « lire le bon plan »
  // alors que l'objectif est de renvoyer vers les enseignes.
  // Trois qualités dans le camp des 40 %, et dans cet ordre d'affichage : les
  // offres à prix prouvé d'abord, puis les bonnes affaires sans prix (les
  // enseignes qu'on ne peut pas chiffrer), puis la presse.
  const reste = liste.filter((o) => !estAmazon(o));
  const presse = reste.filter(estBonPlanPresse).sort(tri);
  const affaires = reste.filter((o) => !estBonPlanPresse(o) && estBonneAffaire(o)).sort(tri);
  const boutiques = reste.filter((o) => !estBonPlanPresse(o) && !estBonneAffaire(o)).sort(tri);
  const autres = [...boutiques, ...affaires, ...presse];
  if (!amazon.length || !autres.length) return [...liste].sort(tri);
  const nAmazon = Math.min(amazon.length, Math.floor((autres.length * PART_AMAZON) / (1 - PART_AMAZON)));
  const nAutres = Math.min(autres.length, Math.round((nAmazon * (1 - PART_AMAZON)) / PART_AMAZON));
  // Un pays qui manque d'un côté ne doit pas être puni deux fois. Mesuré sur
  // les données réelles : la Pologne a 16 promos Amazon vérifiées pour 1 offre
  // d'enseigne — tenir la proportion n'y laissait que 2 lignes à l'écran. Sous
  // MELANGE_MIN, la liste ne se juge plus : on montre TOUT ce qu'on a, et
  // l'en-tête annonce la proportion réellement atteinte, sans la maquiller.
  if (nAmazon + nAutres < MELANGE_MIN) return [...liste].sort(tri);
  // Alternance par arithmétique de rang. La version précédente était une
  // boucle gloutonne qui pouvait s'arrêter avant la fin : la queue du camp des
  // 40 % — souvent les articles de presse, désormais classés après les
  // boutiques — disparaissait alors SANS erreur ni trace. Ici le nombre de
  // lignes est exact par construction.
  // Quotas : presse et bonnes affaires sont minoritaires, mais jamais évincées
  // en totalité — sans eux, le plafond coupait la queue du camp et les
  // enseignes invisibles le restaient. Le reste va aux offres à prix prouvé.
  const nPresse = presse.length ? Math.max(1, Math.min(presse.length, Math.round(nAutres * QUOTA_PRESSE))) : 0;
  const nAffaire = affaires.length ? Math.max(1, Math.min(affaires.length, Math.round(nAutres * QUOTA_AFFAIRE))) : 0;
  const nBoutiques = Math.min(boutiques.length, Math.max(0, nAutres - nPresse - nAffaire));
  const bSel = boutiques.slice(0, nBoutiques);
  const aSel = affaires.slice(0, nAffaire);
  const partBoutique = (bSel.length + aSel.length) ? bSel.length / (bSel.length + aSel.length) : 1;
  const autRetenues = [...entrelacer(bSel, aSel, partBoutique), ...presse.slice(0, nPresse)];
  const total = nAmazon + autRetenues.length;
  const sortie = [];
  let i = 0;
  let j = 0;
  for (let k = 0; k < total; k += 1) {
    const veutAmazon = Math.round((k + 1) * PART_AMAZON) > i;
    if (i < nAmazon && (veutAmazon || j >= autRetenues.length)) sortie.push(amazon[i++]);
    else sortie.push(autRetenues[j++]);
  }
  return sortie;
}

/* Le compte par pays du SÉLECTEUR (voir `compteParPays`) porte sur TOUTES les
 * offres, pas sur les seules « bonnes promos ». Décision du propriétaire du
 * produit : un pays doit annoncer son contenu RÉEL. Un chiffre qui ne comptait
 * que les promotions faisait paraître la Belgique presque vide alors qu'elle
 * contient des milliers d'offres — l'utilisateur n'avait aucun moyen de savoir
 * où chercher. L'en-tête, lui, reste lié à la PORTÉE (« N bonnes promos » ou
 * « N offres ») : il décrit la liste affichée, ce qui est son rôle. */

/* ---- Le pays de la BOUTIQUE, quand il ne fait aucun doute ----
 *
 *  Une offre porte le pays de sa SOURCE. C'est juste pour un flux national
 *  (Dealabs est français), mais faux dès qu'une source étrangère relaie une
 *  boutique d'un autre pays : un bon plan Bol relayé par une communauté
 *  néerlandaise s'affichait sous « Pays-Bas ».
 *
 *  DÉCISION DU PROPRIÉTAIRE DU PRODUIT : rattacher le bon plan au pays de la
 *  BOUTIQUE. Mesuré AVANT d'écrire une ligne : sur 8 173 offres, cette table ne
 *  change aujourd'hui AUCUNE attribution — chaque boutique mono-pays est déjà
 *  relayée par son propre pays. Elle porte donc sur l'avenir : le jour où une
 *  source étrangère relaiera une boutique belge, l'offre ira sous la Belgique
 *  au lieu de disparaître du filtre de l'utilisateur belge.
 *
 *  Seules les boutiques SANS ambiguïté sont listées. Les enseignes présentes
 *  dans plusieurs pays — Amazon, Media Markt, Coolblue, Lidl, Carrefour, Fnac,
 *  Decathlon, Zalando, Ikea, Action, Hema, Kaufland, eBay, Steam — restent sur
 *  le pays de leur source : leur en attribuer un serait une devinette.
 */
const PAYS_BOUTIQUE = new Map([
  // Belgique
  ['colruyt', 'BE'], ['delhaize', 'BE'], ['vanden borre', 'BE'], ['krëfel', 'BE'],
  ['krefel', 'BE'], ['brico', 'BE'], ['hubo', 'BE'], ['gamma', 'BE'],
  ['dreamland', 'BE'], ['fun', 'BE'], ['maxi toys', 'BE'], ['torfs', 'BE'],
  ['jbc', 'BE'], ['okay', 'BE'], ['bio-planet', 'BE'], ['toolstation', 'BE'],
  ['vandenborre', 'BE'], ['corail', 'BE'], ['pointcarré', 'BE'],
  // Royaume-Uni
  ['tesco', 'GB'], ['argos', 'GB'], ['currys', 'GB'], ['costco', 'GB'],
  ['asda', 'GB'], ['george at asda', 'GB'], ['boots', 'GB'], ['next', 'GB'],
  ['secret sales', 'GB'], ['loaded', 'GB'], ['shopto', 'GB'], ['screwfix', 'GB'],
  ['marks electrical', 'GB'], ['the beauty store', 'GB'], ['farmfoods', 'GB'],
  // Pologne
  ['allegro', 'PL'], ['biedronka', 'PL'], ['media expert', 'PL'], ['rtv euro agd', 'PL'],
  ['empik', 'PL'], ['inpost', 'PL'],
  // Espagne, Portugal, Italie, Pays-Bas, Allemagne
  ['pccomponentes', 'ES'], ['alcampo', 'ES'], ['traventia', 'ES'],
  ['el corte inglés', 'ES'], ['miravia', 'ES'], ['fc moto', 'ES'], ['buscounchollo', 'ES'],
  ['worten', 'PT'], ['continente', 'PT'],
  ['jumbo', 'NL'], ['nederlandse spoorwegen', 'NL'],
  ['expert', 'DE'], ['urlaubspiraten', 'DE'], ['imusic', 'DE'],
]);

/** Le pays à retenir pour une offre : celui de la BOUTIQUE s'il est certain,
 *  sinon celui de la source. Un seul point de décision, donc aucun risque
 *  qu'un filtre et un compteur ne soient plus d'accord. */
function paysDe(o) {
  const m = String(o.marchand || '').trim().toLowerCase();
  return PAYS_BOUTIQUE.get(m) || o.pays || 'FR';
}

/** Une offre passe-t-elle les filtres courants ? */
function retenue(o) {
  // Une offre sans pays date d'avant ce filtre : toutes les sources de l'époque
  // étaient françaises, donc « FR » est la lecture juste — pas « inconnu ».
  if (etat.pays !== 'tout' && paysDe(o) !== etat.pays) return false;
  if (etat.categorie !== 'tout' && o.categorie !== etat.categorie) return false;
  if (etat.marchand !== 'tout' && o.marchand !== etat.marchand) return false;
  // Portée : par défaut, SEULES les bonnes promotions passent (voir
  // estBonnePromo). « Toutes les promos » reste accessible dans le sélecteur.
  if (etat.portee === 'promos' && !estBonnePromo(o)) return false;
  if (etat.recherche) {
    const q = etat.recherche.toLowerCase();
    if (!(`${o.titre} ${o.marchand} ${o.categorie}`.toLowerCase().includes(q))) return false;
  }
  return true;
}

/** Chronologique : la plus récente en tête. Écrit UNE seule fois, pour que
 *  « Bonnes promos » et « Plus récentes » ne puissent pas diverger un jour. */
const parRecence = (a, b) => new Date(b.date) - new Date(a.date);

/** Le comparateur du tri courant. Extrait de « triees » parce que le MÉLANGE en
 *  a besoin : il trie chaque camp séparément avant d'alterner. */
function comparateur() {
  // « % DÉCROISSANT » (B, 13/10/2026) : « Peux-tu adapter la catégorie prix
  // croissant par pourcentage décroissant avec écrit % décroissant. »
  //
  // Ce choix s'appelait « Prix croissant » et classait par MONTANT croissant. Il
  // classe désormais par REMISE décroissante : c'est la grandeur que le produit
  // met en avant, et la seule qu'une carte écrit noir sur blanc. Le pourcentage
  // retenu est celui que la carte peut MONTRER (`remiseMontrable`) — une remise
  // ni calculée entre deux prix réels ni crédible n'est écrite nulle part, elle
  // ne doit donc pas non plus décider du rang : sinon le haut de liste
  // annoncerait des pourcentages invisibles. Les offres sans remise montrable
  // ferment la marche (0), départagées par le prix croissant puis par la
  // fraîcheur — chacun de ces critères est visible sur la carte, donc l'ordre
  // reste explicable, et il est stable (aucun rang laissé au hasard).
  if (etat.tri === 'pourcent') return (a, b) =>
    (remiseMontrable(b) || 0) - (remiseMontrable(a) || 0)
    || (a.prix ?? 1e9) - (b.prix ?? 1e9)
    || new Date(b.date) - new Date(a.date);
  if (etat.tri === 'recent') return parRecence;
  // PORTÉE « Bonnes promos » — le défaut de l'application (demande de B,
  // 08/10/2026) : les annonces s'affichent dans l'ordre CHRONOLOGIQUE, la plus
  // récente tout en haut. Avant, cette portée classait par remise : l'ordre
  // sautait d'une date à l'autre et la dernière offre trouvée n'était jamais en
  // vue. RIEN ne change à l'affichage (design intact) — seul l'ORDRE change, et
  // seulement pour cette portée : « Toutes les promos » et « Plus récentes »
  // gardent exactement le tri qu'elles avaient, et « Prix croissant » — devenu
  // « % décroissant » le 13/10/2026, voir plus haut — garde le sien, remise
  // décroissante.
  if (etat.portee === 'promos') return parRecence;
  // Tri par remise : les promos à DEUX PRIX RÉELS passent devant les offres
  // d'enseigne — leur pourcentage est démontrable, il n'est pas seulement
  // annoncé. À qualité égale, la remise décide, puis le score de la
  // communauté, puis la fraîcheur. Sans ce premier critère, une remise
  // annoncée de 75 % passait devant une remise réelle de 67 %.
  return (a, b) => (estPromoVerifiee(b) ? 1 : 0) - (estPromoVerifiee(a) ? 1 : 0)
    || (remiseMontrable(b) || 0) - (remiseMontrable(a) || 0)
    || (b.temperature || 0) - (a.temperature || 0)
    || new Date(b.date) - new Date(a.date);
}

function triees(liste) { return [...liste].sort(comparateur()); }

function carte(o) {
  // Les visuels passent par NOTRE serveur (même origine) : servis directement
  // depuis les sources, le navigateur les refuse et les cartes restent grises.
  // Deux façons de servir un visuel, selon d'où l'on regarde :
  //   - URL absolue (source distante) → on passe par NOTRE relais, sinon le
  //     navigateur refuse l'image (politique d'origine croisée) ;
  //   - chemin relatif (« img/xxx.jpg ») → il vient de notre propre site
  //     publié ; on le préfixe par BASE (vide sur place, adresse du site dans
  //     l'APK) et il s'affiche partout, sans aucun serveur à nous.
  // Économie de données : on n'émet AUCUNE adresse de visuel. Masquer une image
  // en CSS ne l'empêche pas d'être téléchargée — ce serait une fausse économie.
  const source = (!etat.eco && o.image)
    ? (/^https?:/i.test(o.image) ? `${BASE}img?u=${encodeURIComponent(o.image)}` : `${BASE}${o.image}`)
    : '';
  const visuel = etat.eco
    ? ''
    : (source
      ? `<div class="visuel" style="background-image:url('${source}')" role="img" aria-label=""></div>`
      : `<div class="visuel">${esc(NOMS_CATEGORIES[o.categorie] ? t(NOMS_CATEGORIES[o.categorie]) : '')}</div>`);
  // L'étoile « garder de côté » vit dans l'encadré de la carte, sur la ligne du
  // prix (voir plus bas) : jamais sur la photo, et sans toucher au bouton.
  const garde = estFavori(o.id);
  const etoile = `<button class="favori${garde ? ' on' : ''}" data-id="${esc(o.id)}" aria-pressed="${garde}"
            title="${esc(garde ? t('Retirer des favoris') : t('Garder de côté'))}">${garde ? ICONE_ETOILE_PLEINE : ICONE_ETOILE_VIDE}</button>`;
  const etiquettes = [
    o.marchand ? `<span class="etiquette marchand">${esc(o.marchand)}</span>` : '',
    // Le score communautaire Dealabs : c'est LUI qui a servi à ne garder que
    // les meilleures offres. L'afficher rend la sélection visible et vérifiable.
    o.temperature != null ? `<span class="etiquette chaud" title="${esc(t('Score de la communauté Dealabs'))}">${o.temperature}°</span>` : '',
    `<span class="etiquette">${esc(t(NOMS_CATEGORIES[o.categorie] || o.categorie))}</span>`,
    remiseMontrable(o) != null
      ? `<span class="etiquette remise${o.remiseCalculee ? ' calculee' : ''}" title="${esc(o.remiseCalculee ? t('Pourcentage calculé entre deux prix réels') : t('Pourcentage annoncé par la source'))}">${o.remiseCalculee ? '≈ ' : ''}-${remiseMontrable(o)} %</span>`
      : '',
    // Une offre d'enseigne SANS remise chiffrée : on le DIT. Laisser croire à
    // un pourcentage qu'on n'a pas pu vérifier serait exactement le défaut
    // qu'on a passé la journée à corriger.
    (estOffreEnseigne(o) && !estPromoVerifiee(o))
      ? `<span class="etiquette" title="${esc(t("Prix réel et marchand affichés ; cette enseigne ne publie pas de prix barré, donc aucune remise n'est chiffrée."))}">${esc(t('prix réel'))}</span>`
      : '',
    // Un article de PRESSE est nommé comme tel. Le compter comme une enseigne
    // ferait croire que « Le Parisien » vend des écouteurs ; le taire priverait
    // l'utilisateur d'un vrai bon plan (« 96 € au lieu de 179 € »).
    (estBonPlanPresse(o) && !estPromoVerifiee(o))
      ? `<span class="etiquette" title="${esc(t("Bon plan relevé par la presse : prix réel affiché et remise annoncée par l'article."))}">${esc(t('presse'))}</span>`
      : '',
    // Une BONNE AFFAIRE : l'enseigne ne publie pas ses prix, donc nous n'en
    // affichons aucun — ni prix, ni pourcentage. Le badge le dit franchement
    // plutôt que de laisser croire à une carte cassée.
    estBonneAffaire(o)
      ? `<span class="etiquette affaire" title="${esc(t("Bon plan relayé par la communauté : cette enseigne ne publie pas ses prix, donc aucun prix — ni remise — n'est affiché."))}">${esc(t('bonne affaire'))}</span>`
      : '',
    // Ce que l'utilisateur gagne, en euros. C'est le chiffre qui décide d'un
    // achat — « économise 60 € » parle plus que « -67 % ».
    (o.prix != null && o.prixAvant != null && o.prixAvant > o.prix)
      ? `<span class="etiquette econ" title="${esc(t('Économie par rapport au prix de référence'))}">${esc(t('économise {n}', { n: montant(o.prixAvant - o.prix, deviseDe(o)) }))}</span>`
      : '',
    o.encoreEnListe === false
      ? `<span class="etiquette perime" title="${esc(t("Cette offre n'est plus dans la liste du jour : le prix affiché est celui du moment où tu l'as gardée de côté."))}">${esc(t("n'est plus dans la liste"))}</span>`
      : '',
  ].filter(Boolean).join('');
  // Le montant est groupé dans un seul élément : sans ce groupe, le prix
  // « avant » serait repoussé à l'autre bout de la ligne.
  const montantHtml = o.prix != null
    ? `${montant(o.prix, deviseDe(o))}${o.prixAvant ? `<span class="avant">${montant(o.prixAvant, deviseDe(o))}</span>` : ''}`
    : '';
  const prix = montantHtml ? `<div class="prix"><span class="montant">${montantHtml}</span></div>` : '';
  // Le même produit ailleurs, et s'il y est moins cher : voir autresPlaces().
  const ailleurs = mentionAilleurs(o);
  // Le VERDICT de la promo — ce que l'HISTORIQUE DES PRIX permet d'affirmer.
  // Il reste vide quand on n'a pas assez de recul : un badge inventé serait
  // pire que pas de badge du tout.
  const verdict = texteVerdict(o);
  const lien = lienAffilie(o.lienMarchand || o.lienPage, o.marchand, langue());
  const article = o.type === 'article';
  // Le bouton dit OÙ il emmène. « Voir l'offre » pour tout le monde obligeait
  // l'utilisateur à deviner s'il allait chez Amazon, chez Coolblue ou sur un
  // article de presse. Pour Amazon, on nomme en plus LE SITE de destination
  // (« Amazon.fr », « Amazon.com.be », « Amazon.de »…) : la même phrase envoyait
  // vers dix marchés différents sans que rien ne dise lequel. Le site vient du
  // lien réel ; s'il est illisible, on garde l'ancien libellé générique.
  const site = siteAmazon(o.lienMarchand || o.lienPage);
  const libelle = article ? t("Lire l'article")
    : (estAmazon(o) ? (site ? t('Acheter sur {site}', { site }) : t('Acheter sur Amazon'))
      : (estOffreEnseigne(o) ? t('Voir chez {n}', { n: esc(o.marchand) })
        : (estBonPlanPresse(o) ? t('Lire le bon plan')
          : (estBonneAffaire(o) ? t('Voir la bonne affaire') : t("Voir l'offre")))));
  // Pour une offre sortie de la liste, on date la MISE DE CÔTÉ et non la
  // parution : c'est ce qui dit à l'utilisateur ce qu'il a sous les yeux.
  const quand = o.encoreEnListe === false
    ? t('gardée {n}', { n: esc(ilYA(o.misDeCote)) })
    : esc(ilYA(o.date));
  return `<article class="offre">
    ${visuel}
    <div class="corps">
      <h3>${esc(o.titre)}</h3>
      <div class="ligne">${etiquettes}</div>
      ${verdict ? `<p class="verdict v-${esc(o.verdict.code)}">${verdict}</p>` : ''}
      ${prix}
      ${ailleurs}
      <div class="bas">
        <!-- Le bouton de redirection, et SOUS lui la mise à jour de l'offre. -->
        <div class="col-envoi">
          <a class="btn" href="${esc(lien)}" target="_blank" rel="noopener nofollow sponsored"
             data-marchand="${esc(o.marchand || '')}" data-source="${esc(o.source || '')}">${libelle}</a>
          <span class="quand">${quand}</span>
        </div>
        <!-- Les DEUX ICÔNES, empilées À DROITE — demande de B : « l'icône
             partage et favoris doit être à droite ». L'étoile puis le partage,
             dans une colonne de largeur fixe : donc l'une exactement au-dessus
             de l'autre, et son haut tombe à la même hauteur que le bouton de
             redirection qui la jouxte (voir .col-icones / .col-envoi). -->
        <div class="col-icones">
          ${etoile}
          <div class="ligne-partage">
            <button class="partager" data-id="${esc(o.id)}" title="${esc(t('Partager cette offre'))}"
                    aria-label="${esc(t('Partager cette offre'))}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

/* ============================================================
   PARTAGE D'UNE OFFRE
   Trois voies, dans cet ordre — aucune ne marche partout :
     1. le PONT ANDROID : dans l'application, c'est la SEULE qui ouvre la vraie
        feuille de partage du téléphone (WhatsApp, Messenger, Gmail…). Un WebView
        n'implémente PAS navigator.share : sans ce pont, le bouton ne ferait
        strictement rien, sans la moindre erreur.
     2. navigator.share : la feuille du navigateur, là où elle existe.
     3. les LIENS DIRECTS : WhatsApp, e-mail, et copier le lien — de vrais liens
        qui fonctionnent partout, même sans aucune API de partage.
   ============================================================ */

/* Les icônes de l'interface sont celles d'ANDROID (Material Design), pas des
   glyphes de police : le ⚙ et le ★ du clavier changent d'un appareil à l'autre.
   L'étoile a DEUX états — pleine si l'offre est gardée, vide sinon — comme dans
   la barre d'état d'Android. */
export const ICONE_ETOILE_PLEINE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
export const ICONE_ETOILE_VIDE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>';

/** L'ADRESSE PARTAGÉE — la nôtre, pas celle du marchand.
 *
 *  Demande de B (09/10/2026) : « Quand on fait un partage, actuellement ça
 *  affiche directement le lien Amazon par exemple, mais il n'y a pas de trace de
 *  Kazendra. Donc pas de publicité pour nous gratuite. »
 *
 *  On envoie donc https://kazendra.com/o/<id>.html. Cette page porte les balises
 *  Open Graph (titre de l'offre, prix, marchand, visuel), donc la conversation
 *  affiche une carte KAZENDRA là où elle affichait une carte Amazon — et son
 *  bouton mène au MÊME lien affilié qu'avant. La commission est inchangée ; la
 *  marque, elle, s'affiche à chaque partage, gratuitement.
 *
 *  Les pages sont écrites par outils/pages-partage.mjs à chaque publication.
 *  Le lien du partage NE porte PAS l'identifiant d'affiliation en clair : c'est
 *  la page qui l'applique, à l'arrivée.
 */
function lienPartage(o) {
  return `${SITE_PARTAGE}/o/${encodeURIComponent(o.id)}.html`;
}

/** Ce qu'on écrit à l'ami : le titre, le prix s'il est connu, et le lien.
 *
 *  ⚠ LE LIEN NE DOIT FIGURER QU'UNE FOIS — défaut corrigé le 09/10/2026, signalé
 *  par B : « le lien de partage, quand je le colle, présente deux fois l'adresse
 *  kazendra ». Mesuré : ce texte finit DÉJÀ par le lien, et l'adresse était en
 *  PLUS transmise à part — `url` pour `navigator.share`, et `texte + "\n" + url`
 *  côté pont Android. Les applications qui assemblent les deux (WhatsApp, Gmail,
 *  Messenger, Telegram) affichaient donc l'adresse deux fois. Le lien n'est plus
 *  donné qu'ICI ; la feuille du navigateur reçoit le texte seul, et le pont
 *  Android n'ajoute l'adresse que si elle manque. */
function textePartage(o, lien) {
  const prix = o.prix != null ? '\n' + montant(o.prix, deviseDe(o)) : '';
  return o.titre + prix + '\n' + lien;
}

/** LE CLIC VERS LE MARCHAND — compté une fois, au bon endroit.
 *
 *  Demande de B (08/10/2026) : « d'autres statistiques qui permettent de
 *  surveiller le trafic en temps réel ». Le nombre d'articles d'un acteur dit
 *  ce qu'il APPORTE ; le nombre de clics dit ce qu'il INTÉRESSE. Les deux
 *  ensemble, et seulement ensemble, disent où mettre le travail.
 *
 *  On écoute sur le document plutôt que de poser un gestionnaire par carte :
 *  les cartes sont redessinées à chaque filtre, et un gestionnaire attaché à
 *  chacune disparaîtrait avec elle. Ici, un seul écouteur, posé une fois,
 *  qui survit à tous les redessins.
 *
 *  Le relevé ne retarde RIEN : la navigation part d'abord, la note s'écrit
 *  ensuite. L'utilisateur ne doit jamais attendre une statistique. */
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('article.offre a.btn') : null;
  if (!a) return;
  try {
    // `url` EST LE LIEN RÉELLEMENT OUVERT — c'est de lui que le relevé tire
    // l'hôte de destination (amazon.fr ou amazon.com.be), seule clé qui
    // rattache le clic au bon programme d'affiliation. Voir trafic.js.
    const releve = noterAction({
      type: 'clic',
      marchand: a.dataset.marchand,
      source: a.dataset.source,
      pays: etat.pays,
      url: a.href,
    });
    // ET LE RELEVÉ PART AU RELAIS. Sans cet envoi, les clics ne quittaient
    // jamais l'appareil : le panneau ne pouvait donc rien dire des gains.
    relayerAction(releve, adresseRelais());
  } catch { /* une mesure ne doit jamais casser une visite */ }
}, true);

function partagerOffre(id, bouton) {
  const o = etat.offres.find((x) => String(x.id) === String(id));
  if (!o) return;
  // Le partage se note AVANT tout le reste : que l'utilisateur passe par le pont
  // Android, par l'API du navigateur ou par le menu de repli, c'est un partage.
  try {
    const releve = noterAction({ type: 'partage', marchand: o.marchand, source: o.source, pays: etat.pays, url: o.lienMarchand || o.lienPage });
    relayerAction(releve, adresseRelais());
  } catch { /* une mesure ne doit jamais empêcher un partage */ }
  const lien = lienPartage(o);
  const texte = textePartage(o, lien);
  if (window.AndroidPartage && typeof window.AndroidPartage.partager === 'function') {
    try { window.AndroidPartage.partager(o.titre, texte, lien); return; } catch (e) { /* on essaie la suite */ }
  }
  if (navigator.share) {
    // PAS de `url` ici : elle est DÉJÀ à la fin du texte. La donner aussi à part
    // faisait écrire l'adresse deux fois par les applications qui assemblent les
    // deux champs (défaut signalé par B le 09/10/2026).
    navigator.share({ title: o.titre, text: texte }).catch(() => { /* l'utilisateur a refusé */ });
    return;
  }
  ouvrirMenuPartage(o.titre, texte, lien, bouton);
}

function fermerMenuPartage() {
  const m = document.getElementById('menuPartage');
  if (m) m.remove();
}

/** Le repli : de vrais liens, qui marchent sans la moindre API de partage. */
function ouvrirMenuPartage(titre, texte, lien, bouton) {
  fermerMenuPartage();
  const menu = document.createElement('div');
  menu.className = 'menu-partage';
  menu.id = 'menuPartage';
  const corps = encodeURIComponent(texte);
  menu.innerHTML = `
    <a href="https://wa.me/?text=${corps}" target="_blank" rel="noopener">WhatsApp</a>
    <a href="mailto:?subject=${encodeURIComponent(titre)}&body=${corps}">E-mail</a>
    <button type="button" class="copier" data-lien="${esc(lien)}">${esc(t('Copier le lien'))}</button>`;
  const ligne = bouton && bouton.closest('.ligne-partage');
  (ligne || document.body).appendChild(menu);
  menu.addEventListener('click', async (e) => {
    const c = e.target.closest('.copier');
    if (!c) return;
    try {
      await navigator.clipboard.writeText(c.dataset.lien);
      c.textContent = t('Lien copié');
      c.disabled = true;
    } catch (err) {
      // Pas de presse-papiers : on laisse le libellé, l'utilisateur verra.
    }
  });
}

/** Les offres du pays choisi — la base sur laquelle on annonce des nombres.
 *  Sans risque de double comptage : « tout » rend la liste telle quelle. */
function offresDuPays() {
  const base = etat.pays === 'tout'
    ? etat.offres
    : etat.offres.filter((o) => paysDe(o) === etat.pays);
  // Les compteurs suivent la PORTÉE : annoncer « Tout 544 » au-dessus d'une
  // liste de 41 promotions ferait croire que l'affichage est cassé.
  // Le mélange 60/40 s'applique ICI, au seul endroit qui décide de ce qui
  // s'affiche : les puces, les sélecteurs, l'en-tête ET la liste en dérivent
  // tous. On dédoublonne AVANT de mélanger, sinon un même produit partagé par
  // deux pays (Allemagne et Autriche sur amazon.de) comptait double.
  return etat.portee === 'promos'
    ? melanger(dedoublonner(base.filter(estBonnePromo)), comparateur())
    : base;
}

function dessinerPuces() {
  // Les nombres disent ce que contient le PAYS choisi, pas le catalogue entier.
  // Ils étaient calculés sur toutes les offres : « Tout » annonçait 590 à un
  // Belge qui n'en voyait que 32, et changer de pays ne faisait bouger aucun
  // compteur — l'écran paraissait figé alors que le filtre, lui, marchait.
  const offres = offresDuPays();
  const parCat = {};
  for (const o of offres) parCat[o.categorie] = (parCat[o.categorie] || 0) + 1;
  // TOUTES les rubriques sont désormais affichées, TOUJOURS, dans l'ordre fixe
  // d'ORDRE_CATEGORIES — même celles qui n'ont aucune offre dans le pays.
  //
  // Elles étaient filtrées sur le contenu du pays : « Alimentation » existait en
  // « Tous les pays » (69 offres) mais DISPARAISSAIT en Belgique, où aucune offre
  // alimentaire ne passe le seuil de « bonne promo ». Résultat : B a cherché
  // l'onglet à côté de « Mode » et « Maison » et ne l'a pas trouvé — sans aucun
  // message, puisque l'onglet n'était simplement pas dessiné.
  //
  // Une barre dont le contenu change selon le pays oblige à relire et à chercher.
  // Une rubrique vide s'affiche à 0 : l'écran dit la vérité, et l'utilisateur qui
  // clique dessus reçoit le message « aucune offre » au lieu d'un onglet absent.
  const cats = Object.keys(NOMS_CATEGORIES).filter((c) => ORDRE_CATEGORIES.includes(c))
    .sort((a, b) => rangCategorie(a) - rangCategorie(b));
  // Garde-fou conservé : une catégorie INCONNUE de NOMS_CATEGORIES (ajoutée par le
  // collecteur sans passer par ici) n'a pas de puce. Si elle était sélectionnée,
  // l'écran resterait filtré sur un onglet invisible — donc vide, sans raison
  // affichée. On retombe sur « Tout ».
  if (etat.categorie !== 'tout' && !cats.includes(etat.categorie)) etat.categorie = 'tout';
  const puces = [`<button class="puce${etat.categorie === 'tout' ? ' on' : ''}" data-cat="tout">${esc(t('Tout'))}<span class="n">${offres.length}</span></button>`];
  for (const c of cats) {
    // `|| 0` est INDISPENSABLE : sans lui, une rubrique vide afficherait
    // « undefined » à la place du compte — le compteur est lu comme un nombre.
    puces.push(`<button class="puce${etat.categorie === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(t(NOMS_CATEGORIES[c]))}<span class="n">${parCat[c] || 0}</span></button>`);
  }
  $('puces').innerHTML = puces.join('');
  $('puces').querySelectorAll('.puce').forEach((el) => el.addEventListener('click', (ev) => {
    etat.categorie = el.dataset.cat; etat.affichees = PAR_PAGE; dessiner();
    apresClicPuce(ev);
  }));
  marquerPuce();
}

/* CE QU'UN CLIC SUR UNE PUCE FAIT À LA BARRE — RIEN, ET C'EST VOULU.

   B, 11/10/2026 : « Après un clic sur une catégorie elle se referme, je ne
   souhaite pas ça, je souhaite qu'elle disparaisse uniquement quand on quitte la
   zone. Car un utilisateur peut cliquer dans plusieurs catégories, lors de la
   même manipulation. » La barre ne se referme donc JAMAIS sur un clic : elle
   disparaît quand la souris quitte la zone, et seulement alors (app.css).

   IL RESTE UNE CHOSE À FAIRE, ET C'EST LE FOCUS. Une puce cliquée garde le
   focus ; or `:focus-within` rallume la barre — une règle qui existe pour le
   CLAVIER (on avance à la tabulation, la barre doit rester ouverte). Sans rien
   faire, la barre resterait donc affichée APRÈS que la souris est partie :
   l'inverse exact de ce qui est demandé, et un défaut qui ne se voit qu'en
   jouant le geste en entier, souris comprise. On retire donc le focus après un
   clic de SOURIS, et plus rien ne tient la barre que le survol.
   ⚠ UNIQUEMENT À LA SOURIS : `ev.detail` vaut 0 pour Entrée et Espace, et au
   clavier c'est justement le focus qui tient la barre ouverte. Le retirer
   éteindrait la barre sous les doigts de qui navigue à la tabulation.
   ⚠ La condition est écrite DEUX FOIS, ici et dans la feuille : les deux
   doivent parler du même appareil (voir tests/rubriques-au-survol.test.mjs). */
const SOURIS_PC = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

/** Rend la puce cliquée à la souris : la barre ne tient plus que par le survol.
 *  Renvoie vrai si le focus a été rendu — c'est ce que l'épreuve exécute. */
function apresClicPuce(ev) {
  if (!ev || !ev.detail) return false;              // clavier : on ne touche à rien
  const tete = document.querySelector('.tete');
  if (!tete || !window.matchMedia(SOURIS_PC).matches) return false;
  if (!tete.contains(document.activeElement)) return false;
  document.activeElement.blur();
  return true;
}

/** Replace la couleur sur la puce réellement sélectionnée.
    Les puces ne sont construites qu'au démarrage : sans ce replacement, changer
    de catégorie filtrait bien la liste mais laissait « Tout » allumé. */
function marquerPuce() {
  $('puces').querySelectorAll('.puce').forEach((el) => {
    const choisi = el.dataset.cat === etat.categorie;
    el.classList.toggle('on', choisi);
    el.setAttribute('aria-pressed', choisi ? 'true' : 'false');
  });
  // LES FLÈCHES SUIVENT LA RUBRIQUE COURANTE. `marquerPuce` est appelée à CHAQUE
  // rendu (voir dessiner) : c'est donc le seul endroit où l'état des flèches ne
  // peut pas se désynchroniser de ce qui est affiché.
  majFleches();
}

/* ---------- LE GLISSER HORIZONTAL CHANGE DE RUBRIQUE ----------

   Demande de B, 11/10/2026 : « On doit aussi travailler sur le swap de gauche à
   droite, il fait changer la catégorie, high-tech électroménager mode, c'est à
   rajouter. »

   LE GESTE. Un doigt posé, puis déplacé franchement sur le côté. Ce qui décide
   n'est pas la distance seule mais la DIRECTION : un glissement nettement plus
   horizontal que vertical (une fois et demie). Sans ce rapport, un défilement
   vertical un peu de travers ferait changer de rubrique au milieu d'une lecture
   — le défaut le plus agaçant qu'un geste puisse produire.

   À GAUCHE = LA RUBRIQUE SUIVANTE ; à droite = la précédente. C'est le sens des
   carrousels : le doigt pousse le contenu vers la gauche pour avancer.

   L'ORDRE SUIVI EST CELUI DE LA BARRE DES RUBRIQUES, et il ne peut pas en être
   autrement : c'est le seul ordre que l'utilisateur voit. Il parcourt donc
   exactement la suite « Tout, High-tech, Électroménager, Maison, Mode… », aux
   deux bouts sans boucler (arrivé à la dernière rubrique, un glissement vers la
   gauche ne fait plus rien : passer de « Autres » à « Tout » serait un saut que
   rien n'annonce).

   CE QUI N'EST PAS CONCERNÉ : la barre des rubriques (elle défile d'elle-même),
   l'en-tête et la barre d'outils, les feuilles et les fenêtres (Réglages, choix
   du pays, verrou). Sans cette exclusion, un geste pour faire défiler une liste
   DANS une feuille changerait la rubrique derrière elle — un changement
   invisible, donc incompréhensible.

   AUCUN `preventDefault` : le geste est LU, jamais intercepté. Le défilement
   vertical garde exactement sa fluidité, et un geste maladroit ne peut rien
   bloquer. Les écouteurs sont donc `passive`.
*/
const GLISSER_MINI = 60;      // px parcourus pour valoir un changement de rubrique
const GLISSER_RAPPORT = 1.5;  // l'horizontale doit valoir 1,5 fois la verticale
// L'écran de verrouillage n'existe plus (11/10/2026) : il n'y a plus de
// compte local, donc plus de mot de passe à demander — la liste des zones à
// ne pas glisser est celle des zones qui existent.
const GLISSER_HORS = '.puces, .tete, .barre, .outils, .feuille, .modale, .onglets, .themes, .langues';


/** Les rubriques dans l'ordre où elles sont AFFICHÉES, « Tout » compris. */
function rubriquesAffichees() {
  return [...document.querySelectorAll('#puces .puce')].map((el) => el.dataset.cat);
}

/** Attribue la rubrique et REDESSINE — exactement ce que fait un clic sur une
 *  puce, pour qu'un geste et un clic ne puissent pas diverger. */
function changerRubrique(cat) {
  if (!cat || cat === etat.categorie) return;
  etat.categorie = cat; etat.affichees = PAR_PAGE; dessiner();
  const barre = $('puces');
  const puce = barre && barre.querySelector('.puce.on');
  // On fait défiler LA BARRE, jamais la page : `scrollIntoView` remonterait
  // aussi la fenêtre, et l'on perdrait la position de lecture. Sans ce
  // défilement, la puce allumée resterait hors de vue après quelques gestes et
  // l'utilisateur ne saurait plus où il est.
  if (puce) barre.scrollLeft = puce.offsetLeft - (barre.clientWidth - puce.offsetWidth) / 2;
}

/* ---------- LES DEUX FLÈCHES DE RUBRIQUE (souris) ----------

   Demande de B, 11/10/2026 : « Toujours sur PC, on ne sait pas swaper de gauche à
   droite avec le doigt, normal 😁 alors nous allons mettre une sorte de flèche
   qui amène à la catégorie suivante ou recule dans la catégorie précédente,
   quand c'est possible. L'utilisateur pourra utiliser avec la souris. » — puis,
   s'étant ravisé : « je me suis rappelé qu'il y avait des PC digitaux [tactiles].
   Mais tu rajoutes quand même la possibilité pour les PC classiques. »

   Le GLISSER reste donc en place pour les écrans tactiles ; les flèches sont pour
   la souris, et ne s'affichent que là où il y a un pointeur précis (voir `.fleche`
   dans la feuille de style — un appareil tactile seul n'en voit pas).
   L'ordre suivi est celui de la BARRE des rubriques, le seul que l'utilisateur
   voie : le même que celui du glisser, donc un geste et un clic ne divergent pas.
   Aux deux bouts, on ne boucle pas : la flèche qui n'a nulle part où aller est
   ÉTEINTE — jamais un bouton qui ne fait rien. */

/** Les rubriques de la barre, dans l'ordre affiché. */
function rubriquesBarre() {
  const barre = $('puces');
  return barre ? [...barre.querySelectorAll('.puce')].map((b) => b.dataset.cat) : [];
}

/** Allume ou éteint les deux flèches selon la rubrique courante. */
function majFleches() {
  const prec = $('rubriquePrec');
  const suiv = $('rubriqueSuiv');
  if (!prec || !suiv) return;
  const rubriques = rubriquesBarre();
  const i = rubriques.indexOf(etat.categorie);
  prec.disabled = i <= 0;                                 // à la première : rien avant
  suiv.disabled = i < 0 || i >= rubriques.length - 1;      // à la dernière : rien après
}

/** Va à la rubrique voisine (±1) dans l'ordre de la barre. */
function rubriqueVoisine(pas) {
  const rubriques = rubriquesBarre();
  const i = rubriques.indexOf(etat.categorie);
  if (i < 0) return;
  const j = i + pas;
  if (j < 0 || j >= rubriques.length) return;             // jamais de bouclage
  changerRubrique(rubriques[j]);
}

function brancherGlisser() {
  let depart = null;

  window.addEventListener('touchstart', (e) => {
    depart = null;
    if (e.touches.length !== 1) return;            // deux doigts : c'est un zoom
    if (e.target.closest && e.target.closest(GLISSER_HORS)) return;
    depart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    const d = depart;
    depart = null;
    const t = e.changedTouches && e.changedTouches[0];
    if (!d || !t) return;
    const dx = t.clientX - d.x, dy = t.clientY - d.y;
    if (Math.abs(dx) < GLISSER_MINI) return;                       // trop court
    if (Math.abs(dx) < Math.abs(dy) * GLISSER_RAPPORT) return;     // plutôt vertical
    const cats = rubriquesAffichees();
    const i = cats.indexOf(etat.categorie);
    if (i < 0) return;
    // dx < 0 : le doigt est allé vers la gauche → la rubrique SUIVANTE.
    const j = dx < 0 ? i + 1 : i - 1;
    if (j < 0 || j >= cats.length) return;                         // un bout : on ne boucle pas
    changerRubrique(cats[j]);
  }, { passive: true });
}

/** Compte les offres par pays : ce que l'application contient VRAIMENT.
 *  C'est CE chiffre que portent le sélecteur de la barre du haut, celui des
 *  réglages et la question d'ouverture — et non le seul nombre de « bonnes
 *  affaires », qui faisait paraître un pays presque vide. */
function compteParPays() {
  const compte = {};
  for (const o of etat.offres) { const p = paysDe(o); compte[p] = (compte[p] || 0) + 1; }
  return compte;
}

/** Codes des pays présents, du plus fourni au moins fourni. */
function codesPays() {
  // Trié sur TOUTES les offres du pays — le MÊME chiffre que celui affiché en
  // face de chaque pays dans le sélecteur. Trier sur un autre nombre que celui
  // qu'on montre ferait paraître l'ordre arbitraire.
  const compte = compteParPays();
  return Object.keys(compte).filter((c) => NOMS_PAYS[c]).sort((a, b) => compte[b] - compte[a]);
}

/** LE LIBELLÉ DU BOUTON DE PAYS (barre du haut) : drapeau dessiné, nom, et le
 *  nombre d'offres du pays.
 *
 *  Demande de B (11/10/2026) : « Dans le panneau déroulant où l'utilisateur a le
 *  choix du pays, avec le nombre d'offres, il faut introduire les drapeaux des
 *  pays, on peut éventuellement utiliser le même panneau qui a été mis dans
 *  langue dans le panneau de configuration. » Un `<select>` ne peut pas dessiner
 *  un drapeau (et les emoji sont écartés : Windows affiche deux lettres dans un
 *  carré — c'est écrit en tête de drapeaux.js). Le menu déroulant laisse donc la
 *  place à un bouton : il MONTRE le pays appliqué, et ouvre au clic le panneau
 *  partagé des pays (voir ouvrirChoixPays), le même que les réglages.
 *
 *  Le nombre est celui de `compteParPays()` — TOUTES les offres du pays, pas
 *  seulement les bonnes promotions : c'est le contenu réel du pays, et le même
 *  chiffre que celui affiché en face de chaque pays dans la liste. Deux
 *  comptages différents pour la même grandeur donneraient deux nombres à l'écran
 *  pour la même chose. */
/** LA FLÈCHE DE CHOIX, dessinée une fois pour tous les boutons qui ouvrent une
 *  liste de choix (pays, langue). Voir .fleche-choix dans la feuille de style. */
const FLECHE_CHOIX = '<span class="fleche-choix" aria-hidden="true"><svg viewBox="0 0 24 24">'
  + '<path d="M6 9.5l6 6 6-6"/></svg></span>';

function libellePays(code) {
  const compte = compteParPays();
  const tout = code === 'tout' || !NOMS_PAYS[code];
  const n = tout ? etat.offres.length : (compte[code] || 0);
  const dessin = DRAPEAUX_PAYS[tout ? 'tout' : String(code).toLowerCase()] || '';
  return '<span class="drap" aria-hidden="true"><svg viewBox="0 0 24 16">' + dessin + '</svg></span>'
    + '<b>' + esc(tout ? t("Tous les pays") : t(NOMS_PAYS[code])) + '</b>'
    + '<span class="n">' + esc(n.toLocaleString(locale())) + '</span>'
    + FLECHE_CHOIX;
}

/** Remplit le sélecteur de pays (barre du haut) ET celui des réglages.
    On n'annonce QUE ce qui existe : un pays sans offre n'apparaît pas — sinon on
    proposerait un filtre qui vide l'écran, et l'utilisateur croirait l'app en
    panne. Les offres antérieures au filtre n'ont pas de pays : elles viennent de
    sources françaises, donc elles comptent pour la France. */
/** LE MODULE DE CHOIX DU PAYS — un seul dessin, servi aux DEUX endroits.
 *
 *  Demande de B (08/10/2026) : « lors de l'introduction de l'application tu
 *  demandes le pays où l'utilisateur cherche ses promotions, il faut proposer le
 *  même module qui est dans les paramètres d'utilisateur avec les drapeaux, sur
 *  deux colonnes. »
 *
 *  Les deux listes étaient écrites SÉPARÉMENT. Celle d'ouverture n'avait pas de
 *  drapeau, tenait sur une colonne, et écrivait « 1 664 offres » là où les
 *  Réglages affichaient « 1 664 ». Deux dessins du même choix finissent toujours
 *  par diverger — c'est pourquoi il n'y en a plus qu'un, appelé deux fois.
 *
 *  @param {object} options
 *    `actif`     : le pays retenu      → marqué « on »      (Réglages)
 *    `conseille` : le pays deviné      → marqué « conseille » (question d'ouverture)
 */
function htmlListePays({ actif = null, conseille = null } = {}) {
  const compte = compteParPays();
  const item = (code, libelle, n) => {
    const classes = ['pays-item'];
    if (actif === code) classes.push('on');
    if (conseille === code) classes.push('conseille');
    return `
      <button class="${classes.join(' ')}" data-pays="${esc(code)}" type="button"
              aria-pressed="${actif === code}">
        <span class="drap" aria-hidden="true"><svg viewBox="0 0 24 16">${DRAPEAUX_PAYS[String(code).toLowerCase()] || ''}</svg></span>
        <b>${esc(libelle)}</b><span class="n">${esc(n.toLocaleString(locale()))}</span>
      </button>`;
  };
  // Le NOMBRE SEUL, sans le mot « offres » : sur deux colonnes, « Royaume-Uni
  // 1 664 offres » ne tient pas et le nom se fait couper (« Royaume-… »). Ce que
  // le nombre compte est dit juste en dessous, en toutes lettres — les deux
  // écrans portent cette phrase d'aide.
  // « Tous les pays » vient EN PREMIER : c'est l'échappatoire, et une échappatoire
  // qu'on doit chercher en bas de liste n'en est plus une. Il est présenté comme
  // les pays : même dessin, même geste, rien à part.
  // ⚠ LIBELLÉ RACCOURCI LE 11/10/2026 (B) : « au lieu de tous les pays d'Europe,
  // dans le choix des pays, tu mets tout simplement tous les pays ça permettra de
  // redimensionner correctement. » « Tous les pays d'Europe » était le plus long
  // libellé des deux panneaux, et c'est lui qui débordait le premier ; la règle
  // « seuls des pays d'Europe sont proposés » reste dite en toutes lettres sous
  // la liste, elle n'avait pas besoin d'être répétée dans le nom du choix.
  return '<div class="pays-liste pays-2col">'
    + item('tout', t("Tous les pays"), etat.offres.length)
    + codesPays().map((c) => item(c, t(NOMS_PAYS[c]), compte[c] || 0)).join('')
    + '</div>';
}

function dessinerPays() {
  const codes = codesPays();
  // Un pays mémorisé qui n'a plus d'offre retombe sur « tous » : mieux vaut un
  // écran rempli qu'un filtre respecté à la lettre et vide.
  //
  // ⚠ LE CHOIX RÉPARÉ DOIT ÊTRE ÉCRIT, SINON LE TRAITEMENT SE RÉPÈTE À CHAQUE
  // OUVERTURE — et le défaut est celui-ci, mesuré le 10/10/2026 : un code
  // mémorisé que le catalogue ne connaît pas (un ancien code, une valeur écrite
  // à la main, un pays retiré du catalogue) laissait `etat.pays` sur une valeur
  // inconnue. Le sélecteur, lui, retombait sur « Tous les pays » — donc l'écran
  // affichait « Tous les pays » ET des compteurs de rubriques à ZÉRO, sans un
  // mot d'explication, à chaque chargement, indéfiniment : rien ne réécrivait
  // jamais la valeur fautive. Voir aussi l'ordre des dessins dans lancer() :
  // les puces sont comptées APRÈS ce contrôle, pas avant.
  if (etat.pays !== 'tout' && !codes.includes(etat.pays)) {
    etat.pays = 'tout';
    enregistrerPays();
  }
  // Le bouton de pays montre le choix RÉELLEMENT appliqué — après la réparation
  // ci-dessus, jamais avant (même raison que pour les compteurs des rubriques).
  $('pays').innerHTML = libellePays(etat.pays);
  // Le pays appliqué est aussi lisible par le CODE (`data-pays`), pour que
  // l'état de l'écran ne dépende pas du NOM traduit du pays : les épreuves en
  // vrai navigateur peuvent affirmer « l'écran est sur BE » quelle que soit la
  // langue de l'interface.
  $('pays').dataset.pays = etat.pays;

  const rp = $('regPays');
  if (rp) {
    // En LISTE, plus en menu déroulant (demande de B : « Pas besoin de menu
    // déroulant. Il y a suffisamment de place »). Chaque pays montre le nombre
    // d'offres qu'il apporte : un pays vide n'est pas proposé, sinon on
    // offrirait un filtre qui vide l'écran — l'utilisateur croirait à une panne.
    // Le module est PARTAGÉ avec la question d'ouverture (htmlListePays) : une
    // seule fabrique de bouton, donc deux écrans qui ne peuvent pas diverger.
    rp.innerHTML = htmlListePays({ actif: etat.pays })
      + '<p style="margin:10px 0 0;font-size:12.5px;color:var(--doux)">'
      + esc(t("Seuls des pays d'Europe sont proposés : les trajets restent courts."))
      + '</p>';
    rp.querySelectorAll('.pays-item').forEach((b) => {
      b.addEventListener('click', () => choisirPays(b.dataset.pays));
    });
  }
}

/** Applique un choix de pays, d'où qu'il vienne (question d'ouverture ou
    réglages) : un seul chemin, donc aucune divergence possible entre les deux. */
function choisirPays(code) {
  etat.pays = code || 'tout';
  etat.affichees = PAR_PAGE;
  enregistrerPays();
  $('paysDemande').hidden = true;
  $('paysChoix').hidden = true;
  dessinerPays();
  dessinerPuces();   // les compteurs par catégorie suivent le pays choisi
  dessiner();
}

/** LE PANNEAU DE CHOIX DU PAYS, ouvert depuis la barre du haut.
 *
 *  Le MÊME module que les réglages et que la question d'ouverture
 *  (htmlListePays) : drapeaux dessinés, deux colonnes, et le nombre d'offres en
 *  face de chaque pays. Un seul dessin, donc trois écrans qui ne peuvent pas
 *  diverger — c'est la demande de B (11/10/2026), et la raison d'être de ce
 *  module partagé depuis le 08/10/2026. */
function dessinerChoixPays() {
  const r = $('paysChoixListe');
  if (!r) return;
  r.innerHTML = htmlListePays({ actif: etat.pays });
  r.querySelectorAll('.pays-item').forEach((b) => {
    b.addEventListener('click', () => choisirPays(b.dataset.pays));
  });
}

function ouvrirChoixPays() {
  dessinerChoixPays();
  $('paysChoix').hidden = false;
  // On ouvre SUR le pays appliqué : le doigt et le clavier tombent dessus, et
  // l'œil voit tout de suite où l'on en est.
  const actif = $('paysChoixListe').querySelector('.pays-item.on');
  if (actif) actif.focus();
}

/** LA QUESTION DU PAYS — pour le SEUL appareil qui ne dit RIEN.
 *
 *  DÉCISION DE B (11/10/2026), définitivement tranchée : « J'aimerais que tu
 *  reviennes à l'ancienne situation au niveau programme, mais juste que tu
 *  rajoutes le drapeau avec le menu quand il décide de changer de pays. […]
 *  L'utilisateur n'a pas besoin d'avoir le panneau qui lui demande dans quel pays
 *  il veut faire ses achats à chaque fois qu'il rentre dans le site. »
 *
 *  Le visiteur ARRIVE donc sur son pays (voir paysDOrigine) : on ne lui demande
 *  rien. La question ne subsiste que pour un appareil muet — ni fuseau, ni région
 *  connue : là seulement, on ne peut pas décider à sa place.
 *  Pour changer de pays — dans la même session, autant de fois qu'il veut — il y a
 *  le bouton de la barre du haut et sa liste à drapeaux, et celui des Réglages :
 *  « Je voulais juste à la place du panneau déroulant un panneau avec les
 *  drapeaux. »
 *
 *  Rien n'est écrit tant que l'utilisateur n'a pas touché un pays : une détection
 *  est une proposition, la mémoire ne garde qu'une décision (voir
 *  appliquerPaysDOrigine). */
function demanderPays() {
  let enregistre = null;
  try { enregistre = localStorage.getItem(CLE_PAYS); } catch { /* mode privé */ }
  if (enregistre) return;
  if (!codesPays().length) return;           // pas de données : rien à demander
  // L'APPAREIL DIT D'OÙ IL VIENT : il n'y a rien à demander — le visiteur est
  // DÉJÀ sur son pays.
  if (paysDOrigine()) return;
  // LE MÊME MODULE QUE LES RÉGLAGES (htmlListePays) : drapeaux dessinés et deux
  // colonnes. Demande de B (08/10/2026) : « il faut proposer le même module qui
  // est dans les paramètres d'utilisateur avec les drapeaux, sur deux colonnes ».
  //
  //  ⚠ Libellés TRADUITS, et c'est la PREMIÈRE fenêtre que voit un nouvel
  //  utilisateur. Défaut vu sur la capture du 7/10 : la fenêtre « Wo kaufst du
  //  ein? » était en allemand, mais sa liste restait « Allemagne / Royaume-Uni /
  //  Belgique ». Comme le dessin est partagé, la traduction l'est aussi : les
  //  noms passent par t(NOMS_PAYS[c]) dans le module commun.
  // LE PAYS D'ORIGINE EST ALLUMÉ : c'est ce qui fait qu'on « arrive sur son
  // pays » tout en gardant la question.
  $('paysListe').innerHTML = htmlListePays({ actif: etat.pays });
  $('paysDemande').hidden = false;
}

function enregistrerPays() {
  try { localStorage.setItem(CLE_PAYS, etat.pays); } catch { /* mode privé */ }
}

function dessinerBandeau() {
  const b = $('bandeau');
  // Le bandeau ne sert plus QU'À prévenir d'un vrai incident (liste hors ligne).
  // Il portait aussi une note de travail — « À activer : l'identifiant
  // d'affiliation n'est pas encore renseigné… » — qui s'affichait au VISITEUR :
  // constaté à l'écran sur kazendra.com le 07/10/2026, retirée le jour même
  // (demande de B : « il faut enlever ce message »). Un état interne du projet
  // n'a rien à faire devant le public. L'information reste lisible dans le code
  // et dans `affiliation.js` (`affiliationActive()`), pas à l'écran.
  const msgs = [];
  if (etat.meta && etat.meta.horsLigne) {
    // Libellés TRADUITS : c'étaient les deux dernières phrases françaises d'une
    // interface par ailleurs traduite (relevé sur la capture du 7/10).
    const quand = etat.meta.genereLe
      ? new Date(etat.meta.genereLe).toLocaleString(locale())
      : String(etat.meta.genereLe || '—');
    msgs.push(t("<b>Hors ligne</b> : le serveur des promos est injoignable. La liste ci-dessous est l'instantané embarqué du {n} ; les visuels ne sont pas disponibles.", { n: esc(quand) }));
  }
  if (msgs.length) { b.className = 'bandeau info on'; b.innerHTML = msgs.join('<br>'); }
  else { b.className = 'bandeau'; b.innerHTML = ''; }
}

function dessiner() {
  // En mode favoris, la source n'est plus le flux du jour mais le carnet.
  // La source est la liste DÉJÀ MÉLANGÉE du pays choisi (voir offresDuPays).
  // Avant, la liste partait de `etat.offres` : le mélange n'alimentait que les
  // compteurs, et l'écran montrait vingt Amazon d'affilée sous un en-tête qui
  // annonçait 60/40. C'était le mensonge le plus visible de l'application.
  const source = etat.favoris ? listeFavoris() : offresDuPays();
  // En portée « promos », l'ordre est DÉJÀ établi par le mélange (chaque camp
  // trié, puis alterné). Le retrier ici regrouperait les Amazon en tête et
  // détruirait l'alternance — exactement ce qui produisait le mur.
  const liste = etat.favoris || etat.portee !== 'promos'
    ? triees(source.filter(retenue))
    : source.filter(retenue);
  // Le surlignage de la catégorie se replace à CHAQUE rendu. Les puces n'étant
  // construites qu'au démarrage, la couleur restait sinon figée sur « Tout » :
  // le filtre marchait, mais rien à l'écran ne disait ce qui était sélectionné.
  marquerPuce();
  $('liste').innerHTML = liste.slice(0, etat.affichees).map(carte).join('');
  $('vide').hidden = liste.length > 0;
  if (!liste.length && etat.portee === 'promos' && !etat.favoris) {
    // Rien à montrer dans ce rayon ou ce pays : on le DIT, et on ouvre une porte
    // plutôt que de laisser un écran vide sans issue.
    $('vide').innerHTML = esc(t("Aucune bonne promo ici pour l'instant : nous n'affichons que des offres à prix réel — deux prix affichés quand la remise peut être démontrée, et pour les autres enseignes un prix réel avec le nom de la boutique."))
      + '<br><button id="voirTout">' + esc(t('Voir toutes les promos')) + '</button>';
    $('voirTout').addEventListener('click', () => {
      etat.portee = 'tout'; etat.tri = 'remise';
      $('tri').value = 'tout';
      etat.affichees = PAR_PAGE;
      dessinerPuces();
      dessiner();
    });
  } else {
    $('vide').textContent = etat.favoris
      ? t("Aucun favori pour l'instant. Touche l'étoile d'une offre pour la garder de côté.")
      : t('Aucune offre ne correspond à ce filtre.');
  }
  const reste = liste.length - etat.affichees;
  $('plus').hidden = reste <= 0;
  $('plus').innerHTML = reste > 0 ? `<button id="btnPlus">${esc(t('Afficher {n} offres de plus ({r} restantes)', { n: Math.min(PAR_PAGE, reste), r: reste }))}</button>` : '';
  if (reste > 0) $('btnPlus').addEventListener('click', () => { etat.affichees += PAR_PAGE; dessiner(); });

  const total = etat.meta.total || etat.offres.length;
  // LE BANDEAU DE DROITE DIT LA MÊME CHOSE DANS TOUTES LES PORTÉES (B, 11/10/2026).
  //
  // Défaut signalé, mot pour mot : « Regarde le message au niveau en haut à
  // droite, il n'affiche pas le nombre de bonne promo... Il y a un bug au niveau
  // de l'affichage. » Mesuré : hors de la portée « Bonnes promos » — donc dès
  // qu'on choisit « Toutes les promos », « Plus récentes » ou « Prix croissant »
  // — devenu « % décroissant » le 13/10/2026, la branche et son défaut n'ont pas
  // changé —,
  // le bandeau sortait par une SECONDE branche qui annonçait « 17 437 offres ·
  // 1 627 veille » : ni le nombre de bonnes promos, ni le total de tous les pays
  // (meta.totalOffres ne compte que les promotions vraies, là où le bouton de
  // pays annonce 19 064 — deux chiffres pour la même grandeur, exactement
  // l'écart que B avait signalé le 08/10).
  //
  // Il n'y a donc plus qu'UN SEUL dessin, et il dit TROIS choses, dans cet
  // ordre : le nombre de bonnes promos (ce que le produit promet), le total des
  // annonces de TOUS les pays — la MÊME source que « Tous les pays » du
  // bouton de pays, donc les deux chiffres ne peuvent plus diverger —, puis la
  // date de mise à jour. C'est la règle de B du 11/10/2026 : « Le chiffre annoncé
  // à droite doit annoncer le nombre d'annonces qu'il y a dans tous les pays.
  // Uniquement. Tu dois laisser cette ligne et tu dois laisser la ligne de la
  // mise à jour. »
  //
  // Ce qui a QUITTÉ l'écran : « {n} offres · {m} veille ». « veille » est un état
  // de COLLECTE (des annonces suivies qui ne sont pas des promotions) : c'est un
  // paramètre de programmation, pas une information pour l'utilisateur — même
  // raisonnement que la répartition 60/40 Amazon, retirée le 07/10. Et le nombre
  // d'annonces par pays est déjà annoncé par le bouton de pays.
  //
  // Le nombre annoncé est DÉDOUBLONNÉ comme la liste : le chiffre doit être
  // atteignable en faisant défiler l'écran.
  const melange = melanger(dedoublonner(etat.offres.filter(estBonnePromo)));
  const nb = melange.length;
  const totalPromos = etat.offres.length;
  $('comptes').innerHTML = `<b>${nb}</b> ${esc(t('bonnes promos'))}`
    + `<br>${esc(t('{n} promotions', { n: totalPromos }))}`
    + `<br>${esc(t('mis à jour {n}', { n: ilYA(etat.meta.genereLe || new Date().toISOString()) }))}`;
  $('fraicheur').textContent = t('Recensé le {n} — {m} entrées.', {
    n: new Date(etat.meta.genereLe || Date.now()).toLocaleString(locale()),
    m: total,
  });
  // HORODATAGE EXIGÉ par les conditions Partenaires : la date du relevé doit
  // accompagner l'affichage des prix. On affiche celle des DONNÉES, jamais
  // l'heure de la visite — c'est la seule qui soit honnête.
  $('prixReleves').textContent = t('Prix relevés le {d}.', {
    d: new Date(etat.meta.genereLe || Date.now()).toLocaleString(locale()),
  });
  // Les outils sont rafraîchis ICI, en fin de rendu, et pas seulement au
  // démarrage : le compteur de favoris et l'état du mode économie dépendent de
  // ce qui vient d'être dessiné.
  majOutils();
}

/** Reflet des réglages dans la barre (orange = actif) + compteur de favoris.
    L'économie de données existe à deux endroits (barre du haut et réglages) :
    on les allume ENSEMBLE, sinon l'un des deux mentirait sur l'état réel. */
function majOutils() {
  const e = $('eco'), f = $('fav');
  e.classList.toggle('on', etat.eco);
  e.setAttribute('aria-pressed', etat.eco ? 'true' : 'false');
  f.classList.toggle('on', etat.favoris);
  f.setAttribute('aria-pressed', etat.favoris ? 'true' : 'false');
  $('nFav').textContent = favoris.length ? String(favoris.length) : '';
  document.body.dataset.eco = etat.eco ? '1' : '0';
  dessinerBoutonLangue();   // le drapeau du bouton suit la langue en cours
}

/** Bascule l'économie de données — un seul chemin, deux boutons. */
function basculerEco() {
  etat.eco = !etat.eco;
  ecrireBool(CLE_ECO, etat.eco);
  majOutils();
  dessiner();
}

/** Garde de côté, ou retire. Hors mode favoris, on ne redessine QUE la carte
 *  concernée : refaire tout le rendu relancerait les visuels pour rien. */
function basculerFavori(id) {
  const i = favoris.findIndex((f) => f.offre.id === id);
  if (i >= 0) favoris.splice(i, 1);
  else {
    const o = etat.offres.find((x) => x.id === id);
    if (!o) return;                       // offre inconnue : rien à garder
    favoris.push({ offre: o, misDeCote: new Date().toISOString() });
  }
  enregistrerFavoris();
  majOutils();
  if (etat.favoris) { dessiner(); return; }
  const b = [...document.querySelectorAll('.favori')].find((x) => x.dataset.id === id);
  if (b) {
    const garde = estFavori(id);
    b.classList.toggle('on', garde);
    b.setAttribute('aria-pressed', garde ? 'true' : 'false');
    b.title = garde ? t('Retirer des favoris') : t('Garder de côté');
  }
}

/* LE LOGO NE SE COPIE PAS D'UN GESTE — B, 11/10/2026 : « L'image ne peut pas
   être récupérée par un utilisateur du site. Actuellement si je la déplace, elle
   se copie sur mon PC. »
   Le glisser est déjà coupé par `draggable="false"` (la balise) et par
   `-webkit-user-drag` (la feuille de style). Il reste le CLIC DROIT, dont le
   menu porte « Enregistrer l'image sous… » et « Copier l'image » : on le coupe
   ici. Le glisser est refusé aussi, par l'événement : un navigateur qui
   ignorerait l'attribut rencontrerait le même refus.
   ⚠ HONNÊTETÉ : le fichier reste PUBLIC, et il doit le rester — c'est l'onglet
   du navigateur et le logo des pages de partage. Ce qu'on retire, c'est la
   copie INVOLONTAIRE, pas l'accès : un visiteur déterminé peut toujours
   télécharger favicon.svg. */
function protegerLogo(img) {
  img.addEventListener('contextmenu', (ev) => ev.preventDefault());
  img.addEventListener('dragstart', (ev) => ev.preventDefault());
}

/** LE LOGO RAMÈNE TOUTES LES OFFRES — et l'ouverture, elle, montre les bonnes
 *  promos. Demande de B, 11/10/2026 : « Quand on clique sur l'icône du logo,
 *  Kazendra, ça doit faire un rafraîchissement ramener à toutes les offres, et
 *  quand on démarre le site par contre on doit arriver sur bonne promo.
 *  Actuellement c'est bonne promo dans les deux situations. »
 *
 *  DEUX GESTES, DEUX RÉSULTATS — c'est tout l'objet de la demande. L'application
 *  s'OUVRE sur les bonnes promos (c'est la raison d'être du produit : `portee:
 *  'promos'` dans l'état de départ). Le logo, lui, est un ÉLARGISSEMENT : il
 *  rend le catalogue entier et remet les filtres du moment à leur état de
 *  départ. Quelqu'un qui clique sur le logo veut tout revoir, pas retrouver ce
 *  qu'il avait déjà sous les yeux.
 *
 *  L'ANCIENNE VERSION faisait exactement ce que B a signalé : `retourAccueil()`
 *  remettait `portee` à 'promos', donc rejouait l'accueil à l'identique.
 *
 *  Demande de B (09/10/2026) : « quand on clique sur l'icône en haut à gauche,
 *  il faudrait que ça refasse un refresh sur la page d'accueil ».
 *
 *  Ce qui repart à neuf : la recherche, la catégorie, le marchand, le tri et la
 *  portée reviennent au réglage d'accueil, la liste repart à sa PREMIÈRE page,
 *  et l'écran remonte en haut. Un accueil frais, tout de suite.
 *
 *  Ce qu'on NE TOUCHE PAS, et la raison : le pays, la langue, le thème, le mode
 *  économie de données et les favoris sont des PRÉFÉRENCES de l'utilisateur,
 *  pas des filtres du moment. Les remettre à zéro au passage éteindrait en
 *  silence l'économie de données, ou ferait changer de pays sans qu'on l'ait
 *  demandé — et ça ne se verrait qu'à l'ouverture suivante.
 *
 *  AUCUN TÉLÉCHARGEMENT : le catalogue pèse 13 Mo. Le retélécharger à chaque
 *  clic sur le logo irait exactement contre la règle d'économie de données du
 *  projet. La vue se reconstruit en mémoire : instantané, zéro octet.
 */
function retourAccueil() {
  etat.categorie = 'tout';
  etat.marchand = 'tout';
  // 'tout', et non 'promos' : le logo ÉLARGIT la vue, il ne rejoue pas l'accueil.
  etat.portee = 'tout';
  etat.tri = 'remise';
  etat.recherche = '';
  etat.affichees = PAR_PAGE;
  const r = $('recherche');
  if (r) r.value = '';
  const s = $('tri');
  if (s) s.value = 'tout';
  dessinerPuces();
  dessinerBandeau();
  dessiner();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch { window.scrollTo(0, 0); }
}

function brancher() {
  // LE RETOUR AU PREMIER PLAN — le seul moment où l'on vérifie si du neuf est
  // arrivé (voir rafraichirSiBesoin). `visibilitychange` couvre les deux cas :
  // l'onglet qu'on réactive sur un ordinateur, et l'application qu'on ramène au
  // premier plan sur un téléphone.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') rafraichirSiBesoin();
  });
  // La marque (icône + mot) ramène à l'accueil. Au clavier, Entrée et Espace
  // font la même chose : l'élément porte role="button" et tabindex="0" dans
  // index.html, donc il doit se comporter comme un vrai bouton.
  // Le glisser horizontal sur la liste change de rubrique (voir brancherGlisser).
  brancherGlisser();
  // LE BOUTON « THÈME ET COULEURS » — présent seulement sur un PC à souris (le
  // CSS l'affiche là, et masque le bouton Éco au même endroit). Il ouvre les
  // réglages SUR la rubrique des thèmes : c'est le seul endroit où ils se
  // choisissent, et un bouton qui ouvre une feuille sans dire quoi y faire est
  // un bouton de plus.
  if ($('themesBouton')) {
    $('themesBouton').addEventListener('click', () => {
      ouvrirReglages();
      afficherOnglet('affichage');
    });
  }

  $('marque').addEventListener('click', retourAccueil);
  $('marque').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); retourAccueil(); }
  });
  // LE LOGO DE L'EN-TÊTE : ni glissé, ni enregistré par le menu du clic droit
  // (voir protegerLogo). C'est la réponse au geste que B a constaté : « si je la
  // déplace, elle se copie sur mon PC ».
  document.querySelectorAll('img.logo').forEach(protegerLogo);
  $('recherche').addEventListener('input', (e) => { etat.recherche = e.target.value.trim(); etat.affichees = PAR_PAGE; dessiner(); });
  $('tri').addEventListener('change', (e) => {
    // Le premier choix est une PORTÉE, pas un tri : il décide de ce qu'on
    // montre. Les autres trient le catalogue entier.
    const v = e.target.value;
    etat.portee = v === 'promos' ? 'promos' : 'tout';
    etat.tri = (v === 'promos' || v === 'tout') ? 'remise' : v;
    etat.affichees = PAR_PAGE;
    dessinerPuces();   // les compteurs d'onglets suivent la portée
    dessiner();
  });
  // Le bouton de pays OUVRE le panneau partagé. Il n'y a plus de `<select>` : le
  // choix d'un pays passe par le même chemin que partout ailleurs (choisirPays),
  // donc aucun risque qu'un écran écrive autre chose que les autres.
  $('pays').addEventListener('click', ouvrirChoixPays);
  // Le bouton de langue de la barre du haut (PC) et son fermoir.
  document.querySelectorAll('[data-langue-bouton]').forEach((b) => {
    b.addEventListener('click', ouvrirChoixLangue);
  });
  if ($('langueChoixFermer')) $('langueChoixFermer').addEventListener('click', fermerChoixLangue);
  $('paysChoixFermer').addEventListener('click', () => { $('paysChoix').hidden = true; });
  // La fenêtre se ferme au clic sur le fond, comme les autres.
  $('paysChoix').addEventListener('click', (e) => {
    if (e.target === $('paysChoix')) $('paysChoix').hidden = true;
  });
  // Les deux flèches de rubrique — souris. Elles passent par le MÊME chemin que
  // le clic sur une puce et que le glisser (changerRubrique).
  $('rubriquePrec').addEventListener('click', () => rubriqueVoisine(-1));
  $('rubriqueSuiv').addEventListener('click', () => rubriqueVoisine(1));
  // Question d'ouverture : on touche un pays, c'est choisi (et mémorisé).
  $('paysListe').addEventListener('click', (e) => {
    const b = e.target.closest('.pays-item');
    if (b) choisirPays(b.dataset.pays);
  });
  // Réglages : les listes sont dessinées par dessinerPays() / dessinerLangue(),
  // qui posent elles-mêmes l'écouteur sur chaque bouton. Les deux `change` qui
  // s'en occupaient auparavant sont partis avec les menus déroulants qu'ils
  // servaient : ils guettaient des identifiants qui n'existent plus. Du code
  // mort qui surveille un élément absent ne casse rien — il ment sur ce qui est
  // réellement branché, et fait croire que le réglage passe encore par là.
  document.querySelectorAll('.vue').forEach((b) => {
    b.addEventListener('click', () => appliquerVue(b.dataset.vue));
  });
  $('eco').addEventListener('click', basculerEco);
  $('fav').addEventListener('click', () => {
    etat.favoris = !etat.favoris;
    ecrireBool(CLE_FAV_ACTIF, etat.favoris);
    etat.affichees = PAR_PAGE;
    majOutils();
    dessiner();
  });
  // Étoile et partage : écouteurs délégués — les cartes sont recréées à chaque rendu.
  $('liste').addEventListener('click', (e) => {
    const b = e.target.closest('.favori');
    if (b) { basculerFavori(b.dataset.id); return; }
    const p = e.target.closest('.partager');
    if (p) { partagerOffre(p.dataset.id, p); return; }
    if (!e.target.closest('#menuPartage')) fermerMenuPartage();
  });

  // --- Réglages ---
  $('reglages').addEventListener('click', ouvrirReglages);
  $('fermer').addEventListener('click', fermerReglages);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('feuille').hidden) fermerReglages();
  });
  // LE PETIT ŒIL A DISPARU AVEC LE MOT DE PASSE (11/10/2026). Un écouteur unique
  // basculait le type des champs de mot de passe pour les relire — le formulaire
  // d'inscription, le changement de mot de passe, l'écran de verrouillage. Il n'y
  // a plus UN SEUL champ de mot de passe dans l'application : garder l'écouteur
  // aurait laissé croire que la fonction existe encore.
  // Thèmes : écouteur délégué sur la grille (dix vignettes, un seul écouteur).
  $('themes').addEventListener('click', (e) => {
    const b = e.target.closest('.theme');
    if (b) appliquerTheme(b.dataset.themeId);
  });

  // Deux appuis pour effacer : un effacement définitif ne doit pas tenir à un
  // doigt qui glisse. La variable vivait dans la section du verrou, qui est
  // partie — elle est déclarée ici, auprès de son seul usage.
  let suppressionArmee = false;

  $('regCompte').addEventListener('click', async (e) => {
    // Le message vit dans la rubrique ; après un nouveau rendu il faut le
    // reposer, sinon il disparaît avec l'ancien contenu.
    //
    // DEUX ZONES DE MESSAGE, ET C'EST NÉCESSAIRE : #cAnnonce appartient à
    // l'inscription (elle est redessinée avec le formulaire), #dAnnonce aux deux
    // droits sur les données (elle, reste en place). Un seul message pour les
    // deux ferait disparaître la phrase au moment même du redessin.
    const annonce = (msg, ok = false, zone = 'cAnnonce') => {
      const a = $(zone);
      if (!a) return;
      a.textContent = msg;
      a.style.color = ok ? 'var(--vert)' : 'var(--accent-2)';
    };

    // LE BOUTON GOOGLE EST DANS LE MÊME ENCADRÉ QUE LE FORMULAIRE, donc la case
    // des bons plans le concerne aussi. On annonce donc, pour lui comme pour
    // l'inscription par e-mail, ce que devient le choix des bons plans :
    // quelqu'un qui coche puis clique Google doit savoir que son accord a été
    // lu, et quelqu'un qui n'a pas coché doit savoir qu'il ne recevra rien.
    if (e.target.closest('#connexionGoogle')) {
      const msg = messageConnexion('Google', !!($('cConsent') || {}).checked);
      if (msg) return annonce(msg);
      return;
    }

    // S'INSCRIRE — une adresse, un accord, rien d'autre.
    //
    // L'INSCRIPTION N'EST PAS UNE FICHE DE CLIENT. Le prénom (facultatif) a été
    // retiré le 08/10/2026, le mot de passe le 11/10/2026 : deux champs qui ne
    // servaient pas au but, et chaque champ de moins est une hésitation de moins
    // devant le formulaire. Le but est d'avoir des inscrits à la newsletter.
    //
    // Deux contrôles AVANT d'envoyer, parce qu'un envoi qui part avec une
    // adresse fautive est un contact perdu que personne ne remarquera jamais :
    //   1. l'adresse a la forme d'une adresse ;
    //   2. le consentement est coché — on n'inscrit personne d'office, c'est la
    //      moindre des choses, et c'est aussi ce que la loi demande.
    if (e.target.closest('#sInscrire')) {
      const mail = (($('cMail') || {}).value || '').trim();
      const consentement = !!($('cConsent') || {}).checked;
      if (!adresseValide(mail)) return annonce(t("Cette adresse e-mail n'est pas valide."));
      if (!consentement) return annonce(t("Coche la case pour recevoir les bons plans : sans ton accord, on ne t'inscrit pas."));
      // LE TABLEAU N'EST PAS BRANCHÉ : RIEN N'EST RETENU SUR L'APPAREIL.
      // L'ancienne version créait un compte local et l'annonçait (« Ton compte
      // est créé sur cet appareil ») ; sans tableau, l'adresse n'a nulle part où
      // aller, et la retenir ferait croire à une inscription qui n'existe pas.
      if (!tableauConfigure()) {
        return annonce(t("Le tableau n'est pas encore branché : ton adresse n'a pas été envoyée."));
      }
      const envoi = await envoyerInscription({ email: mail, langue: langue(), pays: paysGeo() });
      if (envoi.ok) retenirInscription(mail);
      dessinerCompte();
      // « ENVOYÉE », PAS « INSCRITE » : le tableau Google ne laisse pas la page
      // lire sa réponse (voir inscription.js). On annonce ce qu'on sait.
      return annonce(envoi.ok
        ? t('Un e-mail de confirmation part vers {n}. Ouvre-le et clique le lien pour confirmer ton inscription.', { n: mail })
        : t("L'envoi n'a pas pu partir. Vérifie ta connexion, puis réessaie."), envoi.ok);
    }

    // RENVOI DE L'E-MAIL DE CONFIRMATION. C'est le même envoi que l'inscription :
    // le tableau reconnaît l'adresse, voit qu'elle est « en attente », et
    // renvoie le message. La page n'a donc rien de spécial à savoir faire.
    if (e.target.closest('#renvoyerConfirmation')) {
      const ins = inscriptionLocale();
      if (!ins || !ins.email) return;
      const r = await envoyerInscription({ email: ins.email, langue: langue(), pays: paysGeo() });
      return annonce(r.ok
        ? t('Un e-mail de confirmation part vers {n}. Ouvre-le et clique le lien pour confirmer ton inscription.', { n: ins.email })
        : t("L'envoi n'a pas pu partir. Vérifie ta connexion, puis réessaie."), r.ok);
    }

    // SE DÉSINSCRIRE — le bouton qui remplace « S'inscrire » quand une adresse
    // est déjà retenue. Demande de B, 11/10/2026 : « Si une adresse mail est
    // documentée alors le bouton se transforme en désinscription. pour supprimer
    // la newsletter. »
    //
    // DEUX CHOSES SE PASSENT, ET IL FAUT LES DEUX : la demande part vers le
    // tableau (qui passe la ligne en « désinscrit »), et l'appareil OUBLIE
    // l'adresse — sans quoi le bouton resterait « Se désinscrire » pour une
    // inscription que l'appareil ne connaît plus.
    //
    // CE QU'ON PEUT DIRE, ET CE QU'ON NE PEUT PAS. La page ne lit pas la réponse
    // du tableau (voir inscription.js) : elle annonce donc que la demande est
    // PARTIE, jamais qu'elle a été traitée. Si l'envoi échoue, elle le dit, et
    // elle indique l'autre chemin — le lien de l'e-mail. Un bouton qui ne peut
    // pas marcher doit dire ce qui manque, pas échouer en silence.
    if (e.target.closest('#seDesinscrire')) {
      const ins = inscriptionLocale();
      if (!ins || !ins.email) return;
      if (!tableauConfigure()) {
        oublierInscription();
        dessinerCompte();
        return annonce(t('Ton adresse est oubliée sur cet appareil : tu ne recevras plus les bons plans.'), true, 'dAnnonce');
      }
      const r = await envoyerDesinscription({ email: ins.email });
      oublierInscription();
      dessinerCompte();
      return annonce(r.ok
        ? t('Désinscription envoyée : tu ne recevras plus les bons plans.')
        : t("Désinscription non envoyée : l'adresse est oubliée ici, mais la liste n'a pas été prévenue. Utilise le lien de désinscription de l'e-mail reçu."), r.ok, 'dAnnonce');
    }

    if (e.target.closest('#exporterDonnees')) {
      exporterDonnees();
      return annonce(t('Fichier « kazendra-mes-donnees.json » généré.'), true, 'dAnnonce');
    }

    // EFFACER LES DONNÉES DE CET APPAREIL — c'était « Supprimer mon compte ».
    // Le geste est le même (deux appuis, pas de fenêtre de confirmation, qui
    // peut être refusée en silence dans le WebView de l'APK), mais il ne promet
    // plus de supprimer un compte : il n'y en a plus. Le TABLEAU n'est pas
    // touché : une inscription confirmée reste chez son propriétaire, et seule
    // la feuille — ou le bouton « Se désinscrire » — peut la retirer.
    if (e.target.closest('#effacerDonnees')) {
      const b = e.target.closest('#effacerDonnees');
      if (!suppressionArmee) {
        suppressionArmee = true;
        b.textContent = t('Appuie encore pour confirmer');
        setTimeout(() => {
          suppressionArmee = false;
          if (document.body.contains(b)) b.textContent = t('Effacer les données de cet appareil');
        }, 8000);
        return annonce(t("Les favoris, les réglages et l'adresse retenue sur cet appareil seront effacés. Sans serveur, rien ne pourra être restauré."), false, 'dAnnonce');
      }
      suppressionArmee = false;
      // effacerTout() vide tout le stockage local — l'inscription retenue part
      // donc avec le reste, et la rubrique redessine le formulaire.
      effacerTout();
      dessinerCompte();
      return annonce(t('Données effacées de cet appareil.'), true, 'dAnnonce');
    }
  });
}

/**
 * Charge les offres. Ordre voulu :
 *   1. le hub (données fraîches, visuels relayés) ;
 *   2. l'instantané embarqué dans l'APK (window.DONNEES) s'il ne répond pas.
 *
 * On interroge `api/offres` et non `data/offres.json` : c'est la seule des deux
 * routes qui porte l'en-tête CORS. Depuis l'APK la page vient de
 * `appassets.androidplatform.net` et l'appel vers le hub est donc
 * inter-origine — sans cet en-tête le navigateur refuse la réponse et l'app
 * resterait bloquée sur l'instantané, sans que rien ne l'explique.
 * Le délai est court dans l'APK : hors du réseau de la maison, on ne laisse pas
 * l'utilisateur devant un écran vide le temps d'un timeout TCP.
 */
async function chargerDonnees() {
  const delai = DANS_APK ? 5000 : 15000;
  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), delai);
  // Deux adresses possibles selon l'hébergement :
  //   - « api/offres » : le serveur du projet/du hub, qui porte l'en-tête CORS ;
  //   - « offres.json » : le fichier écrit par le collecteur — le SEUL présent
  //     sur le site publié (GitHub Pages), où il n'y a aucun serveur à nous.
  // On essaie la première, on retombe sur la seconde : pas d'écran vide parce
  // qu'on a deviné le mauvais hébergement.
  let derniere = 'aucune source de données';
  try {
    for (const route of ['api/offres', 'offres.json']) {
      try {
        //  LE CATALOGUE SE GARDE CHEZ LE VISITEUR — décision de B, 14/10/2026 (« le
        //  plus gros gain pour lui, et il ne coûte rien »).
        //
        //  `no-store` DEMANDAIT au navigateur de ne RIEN garder : chaque visite
        //  retéléchargeait le catalogue entier. Ce n'était pas une erreur — c'était
        //  la prudence d'un catalogue qui changeait toutes les quinze minutes sans
        //  borne de fraîcheur. La règle de la vie d'une carte donne cette borne :
        //  une promotion vit cinq jours, donc dix minutes de cache ne peuvent plus
        //  montrer une carte morte.
        //
        //  `no-cache` N'EST PAS `no-store`, et la différence est tout l'objet :
        //  « garde la copie, mais DEMANDE au serveur si elle a changé ». GitHub Pages
        //  publie un ETag, la réponse est un 304 vide quand rien n'a bougé, et le
        //  fichier n'est retéléchargé que s'il a réellement changé. Le témoin
        //  (`etat-collecte.json`, quelques centaines d'octets) garde son `no-store` :
        //  c'est lui qui décide s'il faut rafraîchir, il doit être autoritaire.
        const r = await fetch(BASE + route, { cache: 'no-cache', signal: stop.signal });
        if (!r.ok) { derniere = route + ' → HTTP ' + r.status; continue; }
        const d = await r.json();
        if (d && Array.isArray(d.offres)) return { ...d, horsLigne: false };
        derniere = route + ' → données illisibles';
      } catch (e) {
        if (stop.signal.aborted) throw e;
        derniere = route + ' → ' + e.message;
      }
    }
    throw new Error(derniere);
  } finally {
    clearTimeout(minuteur);
  }
}

/** Le taux de référence de la BCE, lu dans NOTRE fichier (voir devises.json).
 *  Le navigateur ne va jamais le chercher chez la BCE : elle n'envoie pas
 *  d'en-tête CORS, et le projet n'appelle aucun tiers depuis chez le visiteur.
 *  Fichier absent ou illisible → null, donc aucune comparaison entre monnaies. */
async function chargerTaux() {
  try {
    const r = await fetch(BASE + 'devises.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.date || !d.taux || typeof d.taux !== 'object') return null;
    return d;
  } catch { return null; }
}

/** Installe des données servies dans l'état de l'application.
 *
 *  Extrait de `lancer()` le 09/10/2026, quand il a fallu pouvoir RECHARGER le
 *  catalogue en cours de route (voir `rafraichirSiBesoin`). Recopier ces six
 *  lignes dans la fonction de rafraîchissement aurait créé deux chemins qui
 *  divergent au premier changement — l'index des produits mis à jour d'un côté
 *  et pas de l'autre, par exemple, avec des cartes qui ouvrent la mauvaise
 *  fiche. Une seule fonction, deux appels.
 */
async function appliquerDonnees(d) {
  // ⚠ IL N'Y A PLUS DE FICHES MASQUÉES — le filtre a été retiré le 14/10/2026, et
  //  son absence est le résultat, pas un oubli.
  //
  //  Du 13/10 au 14/10/2026, cette ligne écartait les fiches portant `perimee`,
  //  un drapeau posé par le collecteur (demande de B : « règle les problèmes des
  //  fiches qui sont encore affichées sur le site et qui ne sont plus valables »).
  //  C'était un pansement : la fiche restait dans le catalogue publié, on cessait
  //  seulement de l'afficher — donc le catalogue portait des cartes que personne
  //  ne voyait, et le poids publié ne voulait plus dire grand-chose.
  //
  //  La règle de la vie d'une carte a supprimé l'état intermédiaire : une carte
  //  vit cinq jours, puis sa source la sert encore (elle continue) ou ne la sert
  //  plus (elle est EFFACÉE du catalogue, visuel compris). Le catalogue publié EST
  //  donc ce qui s'affiche, par construction — et un filtre qui écarte des fiches
  //  serait aujourd'hui le signe que le collecteur fait mal son travail.
  //
  //  Ce qui reste ici est la seule condition qui a toujours été vraie : une carte
  //  sans aucun lien à ouvrir n'a rien à faire à l'écran (elle ne mènerait nulle
  //  part, même à sa source).
  etat.offres = (d.offres || []).filter((o) => (o.lienPage || o.lienMarchand));
  // L'index des produits multi-places se construit ICI, une fois : les cartes
  // le consultent ensuite sans jamais reparcourir le catalogue.
  etat.indexProduits = indexerProduits(etat.offres);
  // Le taux de la BCE, écrit par le collecteur : il sert à comparer des prix
  // de monnaies différentes. Absent, il n'y a simplement aucune comparaison.
  etat.taux = await chargerTaux();
  etat.meta = { ...d, amazon: false, reseaux: false };
  const aff = await import('./affiliation.js');
  etat.meta.amazon = aff.marchesAmazonActifs().length > 0;
  etat.meta.marches = aff.marchesAmazonActifs();
  etat.meta.reseaux = (aff.RESEAUX || []).length > 0;
}

/** Le contrôle de fraîcheur, appelé AU RETOUR au premier plan.
 *
 *  POURQUOI ICI, ET PAS DANS UNE MINUTERIE. Une minuterie tourne même quand
 *  personne ne regarde : elle consomme pour rien et, sur un téléphone, réveille
 *  la radio. Le retour au premier plan est exactement le moment où
 *  l'information affichée doit être juste — et il ne coûte rien le reste du
 *  temps.
 *
 *  CE QU'ON TÉLÉCHARGE : d'abord le témoin (`etat-collecte.json`, quelques
 *  centaines d'octets). Le catalogue de 13 Mo n'est repris QUE si la date du
 *  témoin a changé — c'est `doitRafraichir` qui tranche, et cette règle est
 *  éprouvée sans navigateur dans `tests/maj.test.mjs`.
 *
 *  EN MODE ÉCONOMIE DE DONNÉES, on ne fait rien du tout : c'est un choix
 *  explicite de l'utilisateur, et le contourner pour trois cents octets serait
 *  la petite trahison que ce projet s'interdit.
 *
 *  Un échec de réseau ne dit rien à l'écran : l'application garde ce qu'elle a,
 *  on retentera au prochain retour. Crier « hors ligne » pour un contrôle raté
 *  serait un faux incident — exactement ce qu'on veut éviter ici.
 */
async function rafraichirSiBesoin() {
  const depuisMs = Date.now() - dernierControle;
  if (!peutControler({ eco: etat.eco, depuisMs, delaiMs: DELAI_CONTROLE_MS })) return;
  // On note le contrôle AVANT la requête : si elle échoue, on ne la relance pas
  // en boucle à chaque retour d'onglet.
  dernierControle = Date.now();
  let dateTemoin = '';
  try {
    const r = await fetch(BASE + FICHIER_TEMOIN, { cache: 'no-store' });
    if (!r.ok) return;
    dateTemoin = dateDuTemoin(await r.text());
  } catch { return; }
  if (!doitRafraichir({ dateLocale: (etat.meta && etat.meta.genereLe) || '', dateTemoin })) return;
  try {
    const d = await chargerDonnees();
    await appliquerDonnees(d);
    // Les favoris, le pays, la langue, le thème et les filtres du moment ne sont
    // PAS touchés : on remplace le catalogue, pas la session de l'utilisateur.
    // Redessiner suffit — la position de lecture, elle, remonte en haut, ce qui
    // est le comportement attendu quand du contenu neuf arrive.
    dessiner();
    dessinerBandeau();
  } catch { /* le réseau a lâché : on garde ce qu'on a, on retentera */ }
}

async function lancer() {
  dessinerMention();
  // Thème AVANT le premier rendu : sinon l'écran s'affiche aux couleurs par
  // défaut puis bascule sous les yeux de l'utilisateur.
  appliquerTheme(themeEnregistre() || THEME_DEFAUT);
  appliquerVue(vueEnregistree());   // avant tout rendu : aucun clignotement de mode
  // La feuille Réglages est dessinée PLUS BAS, après la lecture de la langue :
  // elle est construite par le JavaScript, donc traduireDOM() ne la rattrape pas.
  chargerFavoris();
  // Pays : AUCUN choix par défaut. À la première ouverture, la question est
  // posée (voir demanderPays) ; ensuite on relit le choix mémorisé. On ne décide
  // pas à la place de l'utilisateur d'après la langue de son téléphone.
  try { etat.pays = localStorage.getItem(CLE_PAYS) || 'tout'; } catch { etat.pays = 'tout'; }
  etat.eco = lireBool(CLE_ECO);
  etat.favoris = lireBool(CLE_FAV_ACTIF);
  majOutils();
  brancher();
  try {
    let d;
    try {
      d = await chargerDonnees();
    } catch (e) {
      // Repli : l'instantané figé dans l'APK, à la date du build.
      if (window.DONNEES && window.DONNEES.offres) d = { ...window.DONNEES, horsLigne: true };
      else throw e;
    }
    await appliquerDonnees(d);
  } catch (e) {
    $('comptes').textContent = t('données indisponibles');
    $('vide').hidden = false;
    $('vide').textContent = t('Impossible de lire les offres ({n}). Lance le collecteur : node collecteur.mjs', { n: e.message });
    return;
  }
  // La langue est lue AVANT tout dessin : chaque libellé construit par le
  // JavaScript doit naître dans la bonne langue. Sinon la page s'affiche en
  // français une fraction de seconde, puis se corrige sous les yeux de
  // l'utilisateur — et l'en-tête, lui, resterait en français jusqu'au premier
  // redessin complet.
  chargerLangue();
  traduireDOM();
  // Les quatre pages légales existent en trois langues : leurs liens suivent la
  // langue lue ci-dessus, dès le premier dessin (voir dessinerLiensLegaux).
  dessinerLiensLegaux();
  try { document.documentElement.lang = langue(); } catch { /* rien */ }
  // Feuille Réglages et rubrique COMPTE : toutes deux construites par le
  // JavaScript, donc traduireDOM() ne les rattrape pas. Dessinées trop tôt —
  // c'était le cas, la feuille était bâtie avant la lecture de la langue — elles
  // restaient en FRANÇAIS dans les neuf langues, sans la moindre erreur. Le
  // commentaire ci-dessus disait déjà la règle ; l'ordre des appels la violait.
  dessinerReglages();
  dessinerCompte();
  // LE PAYS D'ORIGINE, AVANT LE PREMIER DESSIN DU FILTRE — même place que la
  // langue ci-dessus, et pour la même raison : les données sont lues à ce
  // moment-là, donc les pays RÉELLEMENT présents aujourd'hui sont connus. Appelé
  // plus tôt (au début de lancer), le catalogue était encore vide et la
  // détection ne trouvait aucun pays — silencieusement.
  // Il ne fait rien si l'utilisateur a déjà choisi (voir appliquerPaysDOrigine).
  appliquerPaysDOrigine();
  // L'ORDRE COMPTE : le pays AVANT les puces. `dessinerPays` répare au passage un
  // pays mémorisé que le catalogue ne connaît plus ; si les compteurs étaient
  // dessinés d'abord, ils seraient calculés sur la valeur fautive et afficheraient
  // des zéros sur un écran qui prétend montrer « Tous les pays » (défaut mesuré le
  // 10/10/2026, et le temps d'affichage d'un chargement suffisait à le voir).
  dessinerPays();
  dessinerPuces();
  dessinerBandeau();
  dessiner();
  demanderPays();     // l'appareil ne dit rien ? là seulement, on demande le pays
  // Relevé de trafic, en DERNIER : à ce point la langue et le pays sont
  // connus, donc le relevé dit quelque chose de vrai. Le noter plus tôt
  // inscrirait « pays inconnu » pour tout le monde. Un seul relevé par
  // session, et l'envoi au relais ne bloque jamais l'affichage (voir trafic.js).
  noterVisite({
    pays: etat.pays,
    langue: langue(),
    // L'ADRESSE PUBLIÉE, jamais le stockage local : un visiteur ne l'a pas dans
    // son navigateur, et c'était tout le défaut — son relevé ne partait donc
    // jamais nulle part (voir public/relais.js).
    relais: adresseRelais(),
  });
}

/** AU DÉMARRAGE : PLUS RIEN NE BLOQUE L'OUVERTURE.
 *
 *  Il y avait ici un écran de verrouillage : s'il existait un compte sur
 *  l'appareil, le mot de passe était demandé AVANT de charger quoi que ce soit.
 *  Le compte local a disparu le 11/10/2026 avec les champs de mot de passe de
 *  l'inscription — l'application s'ouvre donc directement, et la fonction n'a
 *  plus qu'un appel à faire.
 */
function lancerAuDemarrage() {
  // La rubrique compte est dessinée dans lancer(), après la lecture de la
  // langue : le texte est construit en JavaScript, donc il doit naître dans la
  // bonne langue (traduireDOM ne rattrape que le HTML statique).
  purgerVestigeDeCompte();
  lancer();
}

/** EFFACE LA TRACE DU COMPTE LOCAL SUR LES APPAREILS DÉJÀ INSTALLÉS.
 *
 *  Le compte local a existé : `promos.compte` portait un nom, un sel et une
 *  empreinte de mot de passe. Ceux qui ont utilisé la version précédente — ou
 *  qui ont l'APK installé — gardent cette clé. Elle ne sert plus à rien, et
 *  surtout : elle contient encore une empreinte de mot de passe sur leur
 *  appareil. On l'efface au démarrage, une fois, en silence.
 *
 *  Ce n'est pas de la cosmétique : une donnée qu'on a cessé de collecter mais
 *  qu'on laisse sur les appareils est une donnée qu'on collecte encore.
 */
function purgerVestigeDeCompte() {
  try { localStorage.removeItem('promos.compte'); } catch { /* mode privé */ }
}

lancerAuDemarrage();
/**
 * Le verdict d'une offre, en clair — ou '' quand il n'y a rien à dire.
 * Chaque phrase est traduite ; aucune n'est construite par concaténation.
 */
function texteVerdict(o) {
  const v = o && o.verdict;
  if (!v || !v.code) return '';
  const jours = o.analyse ? o.analyse.jours : '';
  switch (v.code) {
    case 'bonPlanRare':
      return esc(t('Bon plan rare — le plus bas relevé en {n} jours.', { n: v.jours ?? jours }));
    case 'sousPrixHabituel':
      return esc(t('{p} % sous son prix habituel.', { p: v.pct }));
    case 'referenceDouteuse':
      return esc(t('Prix barré jamais constaté en {n} jours de relevés.', { n: jours }));
    case 'incoherent':
      return esc(t('Prix incohérent : le prix demandé dépasse le prix barré.'));
    case 'remiseVerifiee':
      return esc(t('Remise vérifiée sur deux prix réels.'));
    default:
      return '';   // 'inconnu' : on ne dit rien plutôt que de meubler
  }
}
