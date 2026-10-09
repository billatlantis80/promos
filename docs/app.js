/**
 * Application n°2 — interface.
 * Aucune dépendance : on lit /api/offres et on affiche.
 * Principe : ne JAMAIS maquiller une offre. Une remise calculée est marquée
 * comme telle ; sans remise chiffrée, on affiche l'offre sans étiquette.
 */
import { lienAffilie, affiliationActive, MENTION_AFFILIATION_ACTIVE, MENTION_AFFILIATION_INACTIVE, siteAmazon } from './affiliation.js';
import * as C from './compte.js';
import { t, chargerLangue, definirLangue, traduireDOM, languesDisponibles, langue, CLE_LANGUE, locale } from './langues.js';
import { noterVisite, noterAction } from './trafic.js';
import { DRAPEAUX, DRAPEAUX_PAYS, NOMS_PAYS } from './drapeaux.js';
import {
  envoyerInscription, adresseValide, tableauConfigure,
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
const DANS_APK = location.hostname === 'appassets.androidplatform.net';
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

/** Pays de l'appareil, déduit de la langue (« fr-BE » → BE). Sans région
 *  reconnue, on n'enferme personne : on ouvre sur tous les pays. */
function paysDetecte() {
  const region = (navigator.language || '').split('-')[1];
  return region && NOMS_PAYS[region.toUpperCase()] ? region.toUpperCase() : 'tout';
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
  try { return localStorage.getItem(CLE_VUE); } catch { return null; }   // navigation privée
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

/* ---------- Profil ----------
   Profil LOCAL : prénom + initiale. Rien ne part sur un serveur — il n'y en a
   pas — donc rien à protéger ailleurs que sur l'appareil. */
const CLE_PROFIL = 'promos.profil';
let profil = { prenom: '' };

function chargerProfil() {
  try {
    const b = JSON.parse(localStorage.getItem(CLE_PROFIL) || '{}');
    profil = { prenom: typeof b.prenom === 'string' ? b.prenom.slice(0, 24) : '' };
  } catch { profil = { prenom: '' }; }
}

function enregistrerProfil() {
  try { localStorage.setItem(CLE_PROFIL, JSON.stringify(profil)); } catch { /* privé */ }
}

const initiale = () => (profil.prenom.trim() ? profil.prenom.trim()[0].toUpperCase() : '?');

/* Libellés du sélecteur d'affichage, repris dans les réglages (mêmes glyphes
   que la barre du haut : c'est le MÊME réglage, pas un doublon). */
const NOMS_VUES = {
  grille: { court: '▦', etat: 'Tableau — deux offres côte à côte' },
  liste: { court: '▤', etat: 'Liste — une offre par ligne, grand visuel' },
  compacte: { court: '☰', etat: 'Compacte — beaucoup d’offres à l’écran' },
};

/* ---------- Réglages ---------- */
/** ONGLETS DES RÉGLAGES. Un seul compartiment visible à la fois.
 *  Le choix n'est PAS mémorisé : on rouvre toujours sur « Compte », qui est ce
 *  qu'on vient chercher quand on ne sait pas où c'est. */
const CLE_ONGLET = 'promos.ongletReglages';

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
  $('regAffichage').innerHTML = `
    <div class="vues" role="group" aria-label="${esc(t("Mode d'affichage"))}">
      ${VUES.map((v) => `<button class="vue" data-vue="${v}" title="${esc(t(NOMS_VUES[v].etat))}" aria-label="${esc(t(NOMS_VUES[v].etat))}">${NOMS_VUES[v].court}</button>`).join('')}
    </div>
    <p style="margin:12px 0 0">
      <button class="outil" data-eco-miroir aria-pressed="false" title="${esc(t('Économie de données — aucun visuel téléchargé'))}">${esc(t('Éco — aucun visuel téléchargé'))}</button>
    </p>`;

  dessinerProfil();
  dessinerLangue();
  dessinerCompte();
  dessinerDroits();
  majThemes();
}

/** Les boutons Google et Facebook, rendus DANS l'encadré de l'inscription.
 *
 *  Demande de B (08/10/2026) : « L'inscription avec Google et Facebook doivent
 *  être dans l'encadrement de inscription car si il sélectionne ces deux moyens
 *  d'inscription ils doivent aussi choisir si ils s'inscrivent à la newsletter ».
 *
 *  Deux raisons, et la seconde est la vraie :
 *   1. Trois façons de créer un compte dans un seul cadre, séparées par un
 *      « ou » : on voit d'un coup d'œil que c'est la même chose.
 *   2. LA CASE DES BONS PLANS EST DANS CE CADRE, DONC ELLE VAUT POUR LES TROIS
 *      CHEMINS. Hors du cadre, elle n'aurait concerné que l'inscription
 *      manuelle, et quelqu'un qui passe par Google n'aurait jamais vu qu'il
 *      pouvait — ou ne pouvait pas — recevoir la newsletter.
 */
function blocConnexion() {
  const style = 'width:100%;display:flex;align-items:center;justify-content:center;gap:9px;'
    + 'padding:11px 12px;border-radius:11px;font:inherit;font-weight:600;font-size:14px;'
    + 'cursor:pointer;text-decoration:none;border:1px solid var(--bord)';
  return `
    <div style="display:flex;align-items:center;gap:10px;margin:16px 0 12px;color:var(--doux);font-size:12.5px">
      <span style="flex:1;height:1px;background:var(--bord)"></span>
      <span>${esc(t('ou'))}</span>
      <span style="flex:1;height:1px;background:var(--bord)"></span>
    </div>
    <p>
      <button class="connexion" id="connexionGoogle" style="${style};background:#fff;color:#1f1f1f">
        <svg viewBox="0 0 48 48" aria-hidden="true" style="width:18px;height:18px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        ${esc(t('Se connecter avec Google'))}
      </button>
    </p>
    <p>
      <button class="connexion" id="connexionFacebook" style="${style};background:#1877F2;color:#fff;border-color:#1877F2">
        <svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;fill:#fff"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22C18.34 21.24 22 17.08 22 12.06z"/></svg>
        ${esc(t('Se connecter avec Facebook'))}
      </button>
    </p>
    <p class="note" style="font-size:12.5px;color:var(--doux)">
      ${esc(t("Ces connexions demandent un identifiant d'application. Tant qu'il n'est pas renseigné, elles restent fermées."))}
    </p>`;
}

/** Ce qu'il faut dire à qui clique Google ou Facebook — ou null si la connexion
 *  est réellement branchée (identifiant d'application renseigné).
 *
 *  LE CHOIX DES BONS PLANS FAIT PARTIE DE LA RÉPONSE. La case est dans le même
 *  encadré que les boutons, donc elle s'applique aussi à ces deux chemins. Le
 *  silence serait pire que l'absence : quelqu'un qui coche et clique Google
 *  croirait s'être inscrit aux bons plans. On le lui dit.
 */
function messageConnexion(reseau, veuxLettres) {
  const id = reseau === 'Google' ? window.KAZENDRA_GOOGLE_CLIENT_ID
                                 : window.KAZENDRA_FACEBOOK_APP_ID;
  if (typeof id === 'string' && id.trim()) return null;   // renseigné : le branchement s'en occupe
  const base = t("La connexion {r} n'est pas encore ouverte : il manque l'identifiant d'application.", { r: reseau });
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
function dessinerLangue() {
  const rl = $('regLangue');
  if (!rl) return;
  const choix = langue();
  rl.innerHTML = `<p class="aide-reglages">${esc(t('Choisis la langue de l’interface'))}</p>`
    + '<div class="langues" role="radiogroup" aria-label="' + esc(t('Langue')) + '">'
    + languesDisponibles().map((l) => `
      <button class="langue${l.code === choix ? ' on' : ''}" data-langue="${esc(l.code)}"
              role="radio" aria-checked="${l.code === choix}" type="button">
        <span class="drap" aria-hidden="true"><svg viewBox="0 0 24 16">${DRAPEAUX[l.code] || ''}</svg></span>
        <span class="nom-langue">${esc(l.nom)}</span>
        <span class="coche" aria-hidden="true">${l.code === choix ? '✓' : ''}</span>
      </button>`).join('')
    + '</div>';
  rl.querySelectorAll('.langue').forEach((b) => {
    b.addEventListener('click', () => changerLangue(b.dataset.langue));
  });
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
  preparerOeils();   // le libellé de l'œil est une phrase traduite
  dessinerMention(); // la mention d'affiliation est une phrase traduite
  dessinerLiensLegaux(); // les pages légales existent en trois langues
  majOutils();
  dessiner();
}

function dessinerProfil() {
  const nom = profil.prenom.trim();
  $('regProfil').innerHTML = `
    <div class="champ">
      <label for="prenom">${esc(t('Prénom affiché'))}</label>
      <input id="prenom" type="text" maxlength="24" autocomplete="given-name" placeholder="${esc(t('Ton prénom'))}" value="${esc(nom)}">
    </div>
    <p style="margin:0 0 12px"><button class="enregistrer" id="enregistrerProfil">${esc(t('Enregistrer'))}</button></p>
    <div class="ligne-profil">
      <span class="avatar" id="avatar" title="${esc(t('Aperçu'))}">${esc(initiale())}</span>
      <span>${nom ? t('Bonjour {n}', { n: esc(nom) }) : esc(t('Aucun prénom enregistré'))}<br><span style="font-size:12.5px;color:var(--doux)">${esc(t('Gardé sur cet appareil uniquement. Effacé avec les données du site.'))}</span></span>
    </div>`;
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
  const f = C.ficheCompte();
  // Le titre « Aucun compte sur cet appareil » n'est posé QUE s'il n'y a pas de
  // compte : sous un compte existant, il serait faux. Les deux paragraphes,
  // eux, restent vrais dans les deux cas — ils décrivent le modèle, pas l'état.
  const titre = f ? '' : `<h4>${esc(t('Aucun compte sur cet appareil'))}</h4>`;
  // ⚠ DÉFAUT CORRIGÉ — CES TEXTES N'ÉTAIENT PAS TRADUITS.
  //  Constaté à l'écran, pas dans le code : avec l'interface en anglais, ce bloc
  //  restait EN FRANÇAIS au milieu des autres phrases. Cause : il est construit
  //  ici, en JavaScript, et ses phrases étaient écrites en clair dans le gabarit
  //  — jamais passées à t(). Les traductions existaient pourtant dans les neuf
  //  dictionnaires : elles avaient été préparées puis jamais BRANCHÉES.
  //  Un texte en clair dans un gabarit est invisible au moteur : il ne se
  //  plaint pas, il s'affiche dans la mauvaise langue. Chaque phrase passe
  //  maintenant par t(). Voir tests/droits.test.mjs, qui refuse toute phrase de
  //  ce bloc qui ne serait pas branchée.
  return `
    <div class="carte-bloc">
      ${titre}
      <p>${esc(t("Ce compte vit sur cet appareil et nulle part ailleurs : il protège l'accès à l'application (favoris, réglages) sur ce téléphone. Une seule chose peut sortir de l'appareil, et seulement si tu la demandes : l'adresse de ton inscription."))}</p>
      <p>${esc(t("Ce qu'il ne fera jamais, pour que tu ne l'attendes pas : retrouver tes favoris sur un autre appareil, ni te rendre un mot de passe oublié. Le mot de passe n'est pas enregistré — seulement une empreinte calculée à partir de lui."))}</p>
    </div>
    <div class="carte-bloc" style="margin-top:12px">
      <p>${esc(t("Ce qui est conservé sur cet appareil : le nom d'utilisateur, une empreinte du mot de passe (jamais le mot de passe), le prénom affiché, tes favoris et tes réglages."))} <b>${esc(t("Rien n'est envoyé, sauf l'adresse de ton inscription"))}</b>${esc(t(" : ni traqueur, ni cookie publicitaire. Ton compte, lui, ne quitte pas cet appareil."))}</p>
      <ul>
        <li><b>${esc(t('Voir et emporter'))}</b> : ${esc(t('« Télécharger mes données » produit un fichier lisible qui contient tout.'))}</li>
        <li><b>${esc(t('Effacer'))}</b> : ${esc(t("« Supprimer mon compte » retire le compte et les données de cet appareil, sans délai et sans avoir à demander à personne. L'adresse de ton inscription, elle, se retire depuis l'e-mail reçu."))}</li>
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
function blocInscription() {
  const ins = inscriptionLocale();
  if (!ins || !ins.email) return '';
  return `
    <div class="carte-bloc" style="margin-top:12px">
      <p style="margin:0 0 10px">${esc(t('Inscription : {n} — en attente de confirmation', { n: ins.email }))}</p>
      <p style="margin:0"><button class="outil" id="renvoyerConfirmation">${esc(t("Renvoyer l'e-mail de confirmation"))}</button></p>
    </div>`;
}

/** Verse les blocs ci-dessus dans l'onglet Informations. */
function dessinerDroits() {
  const rd = $('regDroits');
  if (rd) rd.innerHTML = blocDroits();
}

const dateLisible = (iso) => {
  // La date suit la LANGUE de l'utilisateur, pas un format figé : « 8 oktober
  // 2026 » pour un lecteur néerlandais, « 8 octobre 2026 » pour un francophone.
  // Le repli était écrit en clair (« date inconnue ») : la phrase existait dans
  // les 9 dictionnaires sans que personne ne l'appelle, donc elle s'affichait en
  // français dans toutes les langues. Corrigé le 08/10/2026 en même temps que le
  // ménage des clés mortes — c'est la sonde qui l'a mis au jour.
  try { return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return t('date inconnue'); }
};

/** Les deux dessins de l'œil (Material). ŒIL OUVERT = le mot de passe est
 *  CACHÉ (l'œil propose de le voir) ; ŒIL BARRÉ = il est VISIBLE (l'œil propose
 *  de le cacher). Le dessin dit donc l'état, pas l'action — c'est la convention
 *  des navigateurs et des gestionnaires de mots de passe. */
const OEIL_OUVERT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5'
  + 'c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5'
  + '-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
const OEIL_BARRE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26'
  + ' 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16'
  + 'C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12'
  + 'c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73'
  + ' 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3'
  + ' .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5'
  + ' 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';

/** Un champ de mot de passe AVEC l'œil. Un seul gabarit pour les quatre champs :
 *  recopier la même structure quatre fois, c'est quatre occasions de la casser. */
function champMotDePasse(id, libelle, options = {}) {
  const auto = options.autocomplete ? ` autocomplete="${options.autocomplete}"` : '';
  const place = options.placeholder ? ` placeholder="${esc(t(options.placeholder))}"` : '';
  const dit = esc(t('Montrer le mot de passe'));
  return `
        <div class="champ">
          <label for="${id}">${esc(t(libelle))}</label>
          <div class="avec-oeil">
            <input id="${id}" type="password"${auto}${place}>
            <button type="button" class="oeil" data-oeil="${id}" aria-pressed="false" aria-label="${dit}" title="${dit}">${OEIL_OUVERT}</button>
          </div>
        </div>`;
}

/** Montre ou cache le texte d'un champ de mot de passe.
 *
 *  On REPLACE le curseur à la fin après la bascule : changer le type d'un champ
 *  fait perdre la position de saisie dans plusieurs navigateurs, et le curseur
 *  repart à zéro au milieu d'un mot de passe déjà tapé. */
function basculerOeil(bouton) {
  const champ = document.getElementById(bouton.dataset.oeil);
  if (!champ) return;
  const caché = champ.type === 'password';
  champ.type = caché ? 'text' : 'password';
  appliquerOeil(bouton);
  const fin = champ.value.length;
  champ.focus();
  try { champ.setSelectionRange(fin, fin); } catch { /* champs sans sélection */ }
}

/** Met le dessin et le libellé de l'œil en accord avec l'état RÉEL du champ. */
function appliquerOeil(bouton) {
  const champ = document.getElementById(bouton.dataset.oeil);
  const visible = !!champ && champ.type === 'text';
  const dit = t(visible ? 'Cacher le mot de passe' : 'Montrer le mot de passe');
  bouton.innerHTML = visible ? OEIL_BARRE : OEIL_OUVERT;
  bouton.setAttribute('aria-pressed', visible ? 'true' : 'false');
  bouton.setAttribute('aria-label', dit);
  bouton.setAttribute('title', dit);
}

/** Rattrape tous les yeux de la page — y compris celui écrit dans index.html.
 *  Appelé au démarrage et à chaque changement de langue : le libellé est une
 *  phrase traduite, il doit suivre la langue comme les autres. */
function preparerOeils() {
  for (const b of document.querySelectorAll('.oeil')) {
    if (!b.querySelector('svg')) b.innerHTML = OEIL_OUVERT;
    appliquerOeil(b);
  }
}

function dessinerCompte() {
  const f = C.ficheCompte();
  if (!f) {
    // PLUS DE TITRE « Créer un compte sur cet appareil » (retiré le 08/10/2026,
    // demande de B : « ne doit plus être d'actualité car je récupère l'adresse
    // mail »). La phrase était devenue fausse — l'adresse ne reste pas sur
    // l'appareil, elle part vers le tableau — et elle n'avait plus de métier :
    // la rubrique au-dessus s'appelle déjà « Inscription et connexion », et le
    // bouton en dessous dit déjà « Créer mon compte ». Un titre qui répète le
    // bouton ET se trompe sur la portée ne rend service à personne.
    //
    // Le formulaire d'INSCRIPTION MANUELLE passe en premier — c'est la demande
    // de B : « il faut commencer par l'inscription manuelle ». Les paragraphes
    // d'explication qui le précédaient sont partis dans l'onglet Informations
    // (voir blocDroits) : ici, on ne garde que ce qui sert à remplir.
    $('regCompte').innerHTML = `
      <div class="carte-bloc">
        <div class="champ">
          <label for="cMail">${esc(t('Adresse e-mail'))}</label>
          <input id="cMail" type="email" maxlength="120" autocomplete="email" inputmode="email" placeholder="nom@exemple.be">
        </div>
${champMotDePasse('cMdp', 'Mot de passe', { autocomplete: 'new-password', placeholder: '8 caractères minimum' })}
${champMotDePasse('cMdp2', 'Répète le mot de passe', { autocomplete: 'new-password' })}
        <label class="consentement" style="display:flex;gap:9px;align-items:flex-start;margin:12px 0 4px;font-size:13.5px;line-height:1.45;cursor:pointer">
          <input id="cConsent" type="checkbox" style="margin-top:2px;flex:0 0 auto;width:16px;height:16px;accent-color:var(--accent)">
          <span>${esc(t('Je veux recevoir les bons plans par e-mail. Désinscription en un clic.'))}</span>
        </label>
        <p class="annonce" id="cAnnonce"></p>
        <p style="margin:0"><button class="enregistrer" id="creerCompte">${esc(t('Créer mon compte'))}</button></p>
        ${blocConnexion()}
      </div>`;
    return;
  }
  $('regCompte').innerHTML = `
    <div class="carte-bloc">
      <div class="fiche-compte">
        <span class="avatar">${esc(f.nom.slice(0, 1).toUpperCase())}</span>
        <span>
          <span class="qui">${esc(f.nom)}</span><br>
          <span class="quand">${esc(t('compte local créé le {n}', { n: dateLisible(f.cree) }))} · ${esc(f.algorithme || 'PBKDF2-SHA256')} ${f.tours ? esc(t('({n} tours)', { n: f.tours })) : ''}</span>
        </span>
      </div>
      <p>${t("Ce compte vit sur cet appareil uniquement. Il protège l'accès à l'application et ne synchronise rien. Seule l'adresse de ton inscription est envoyée, pour recevoir les bons plans.")}</p>
${champMotDePasse('cAncien', 'Mot de passe actuel', { autocomplete: 'current-password' })}
${champMotDePasse('cNouveau', 'Nouveau mot de passe', { autocomplete: 'new-password' })}
      <p class="annonce" id="cAnnonce"></p>
      <div class="compte-actions">
        <button class="enregistrer" id="changerMdp">${esc(t('Changer le mot de passe'))}</button>
        <button class="outil" id="verrouiller">${esc(t('Verrouiller maintenant'))}</button>
        <button class="outil" id="exporterDonnees">${esc(t('Télécharger mes données'))}</button>
        <button class="outil danger" id="supprimerCompte">${esc(t('Supprimer mon compte'))}</button>
      </div>
      ${blocInscription()}
    </div>`;
}

/** Export RGPD : tout ce que l'application garde, dans un seul fichier lisible. */
function exporterDonnees() {
  const paquet = {
    application: 'Kazendra',
    exporteLe: new Date().toISOString(),
    avertissement: "Tout ce que l'application conserve sur cet appareil. La seule chose qui ait pu en "
                 + "sortir est l'adresse de ton inscription, et seulement si tu l'as demandée.",
    compte: C.ficheCompte(),
    profil: { ...profil },
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
  profil = { prenom: '' };
  appliquerTheme(THEME_DEFAUT);
  appliquerVue('grille');
  etat.eco = false;
  etat.favoris = false;
  // Le pays repart à « tous » : les données effacées emportent le choix, et la
  // question sera reposée à la prochaine ouverture.
  etat.pays = 'tout';
  majOutils();
  dessinerProfil();
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
const REDACTIONS = /(parisien|figaro|[ée]quipe|forbes|independent|mashable|estad|express|ginjfo|phototrend|labomaison|iphoneaddict|mac4ever|watchgeneration|num[ée]rique|phonandroid|dslweb|hdblog|tuttotech|tomshw|tuttoandroid|presse|dealabs|hotukdeals|mydealz|chollometro|preisjaeger|journal|magazine|bloomberg|wired|verge|01net|frandroid|clubic|journaldugeek|numerama|presse-citron|tomshardware|\.fr\b|\.com\b|\.it\b|\.net\b|\.be\b|\.de\b|\.es\b|\.pt\b|\.pl\b|\.se\b|\.ie\b|\.uk\b|\.nl\b)/i;

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
  // estBonnePromo). « Toutes les offres » reste accessible dans le sélecteur.
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
  if (etat.tri === 'prix') return (a, b) => (a.prix ?? 1e9) - (b.prix ?? 1e9) || (b.remise || 0) - (a.remise || 0);
  if (etat.tri === 'recent') return parRecence;
  // PORTÉE « Bonnes promos » — le défaut de l'application (demande de B,
  // 08/10/2026) : les annonces s'affichent dans l'ordre CHRONOLOGIQUE, la plus
  // récente tout en haut. Avant, cette portée classait par remise : l'ordre
  // sautait d'une date à l'autre et la dernière offre trouvée n'était jamais en
  // vue. RIEN ne change à l'affichage (design intact) — seul l'ORDRE change, et
  // seulement pour cette portée : « Toutes les offres », « Plus récentes » et
  // « Prix croissant » gardent exactement le tri qu'elles avaient.
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
export const ICONE_ENGRENAGE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';

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

/** Ce qu'on écrit à l'ami : le titre, le prix s'il est connu, et le lien. */
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
    noterAction({
      type: 'clic',
      marchand: a.dataset.marchand,
      source: a.dataset.source,
      pays: etat.pays,
    });
  } catch { /* une mesure ne doit jamais casser une visite */ }
}, true);

function partagerOffre(id, bouton) {
  const o = etat.offres.find((x) => String(x.id) === String(id));
  if (!o) return;
  // Le partage se note AVANT tout le reste : que l'utilisateur passe par le pont
  // Android, par l'API du navigateur ou par le menu de repli, c'est un partage.
  try {
    noterAction({ type: 'partage', marchand: o.marchand, source: o.source, pays: etat.pays });
  } catch { /* une mesure ne doit jamais empêcher un partage */ }
  const lien = lienPartage(o);
  const texte = textePartage(o, lien);
  if (window.AndroidPartage && typeof window.AndroidPartage.partager === 'function') {
    try { window.AndroidPartage.partager(o.titre, texte, lien); return; } catch (e) { /* on essaie la suite */ }
  }
  if (navigator.share) {
    navigator.share({ title: o.titre, text: texte, url: lien }).catch(() => { /* l'utilisateur a refusé */ });
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
  $('puces').querySelectorAll('.puce').forEach((el) => el.addEventListener('click', () => {
    etat.categorie = el.dataset.cat; etat.affichees = PAR_PAGE; dessiner();
  }));
  marquerPuce();
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

function optionsPays() {
  // Le sélecteur annonce TOUTES les offres de chaque pays, pas seulement les
  // bonnes promotions : c'est le contenu réel du pays, et le seul chiffre qui ne
  // bouge pas sous les pieds de l'utilisateur quand il change de portée de tri.
  // Il portait auparavant le nombre de « bonnes affaires » (mesuré : 203 pour la
  // Belgique) — il annonce désormais le pays entier.
  const compte = compteParPays();
  return [`<option value="tout">${esc(t('Tous les pays ({n})', { n: etat.offres.length }))}</option>`]
    .concat(codesPays().map((c) => `<option value="${esc(c)}">${esc(t(NOMS_PAYS[c]))} (${compte[c]})</option>`))
    .join('');
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
  // « Tous les pays d'Europe » vient EN PREMIER : c'est l'échappatoire, et une
  // échappatoire qu'on doit chercher en bas de liste n'en est plus une. Il est
  // présenté comme les pays : même dessin, même geste, rien à part.
  return '<div class="pays-liste pays-2col">'
    + item('tout', t("Tous les pays d'Europe"), etat.offres.length)
    + codesPays().map((c) => item(c, t(NOMS_PAYS[c]), compte[c] || 0)).join('')
    + '</div>';
}

function dessinerPays() {
  const codes = codesPays();
  $('pays').innerHTML = optionsPays();
  // Un pays mémorisé qui n'a plus d'offre retombe sur « tous » : mieux vaut un
  // écran rempli qu'un filtre respecté à la lettre et vide.
  if (etat.pays !== 'tout' && !codes.includes(etat.pays)) etat.pays = 'tout';
  $('pays').value = etat.pays;

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
  dessinerPays();
  dessinerPuces();   // les compteurs par catégorie suivent le pays choisi
  dessiner();
}

/** Question posée UNE FOIS, à la première ouverture de l'application.
    On ne décide pas à la place de l'utilisateur : on propose, en signalant le
    pays probable (d'après la langue de l'appareil), et on laisse « tous les pays
    d'Europe » à un appui. Le choix reste modifiable dans les réglages. */
function demanderPays() {
  let enregistre = null;
  try { enregistre = localStorage.getItem(CLE_PAYS); } catch { /* mode privé */ }
  if (enregistre) return;
  if (!codesPays().length) return;           // pas de données : rien à demander
  const suggere = paysDetecte();
  // LE MÊME MODULE QUE LES RÉGLAGES (htmlListePays) : drapeaux dessinés et deux
  // colonnes. Demande de B (08/10/2026) : « il faut proposer le même module qui
  // est dans les paramètres d'utilisateur avec les drapeaux, sur deux colonnes ».
  // Seule différence : ici le pays DEVINÉ d'après la langue de l'appareil est
  // marqué « conseille » — on propose, on ne décide pas à la place de personne.
  //
  //  ⚠ Libellés TRADUITS, et c'est la PREMIÈRE fenêtre que voit un nouvel
  //  utilisateur. Défaut vu sur la capture du 7/10 : la fenêtre « Wo kaufst du
  //  ein? » était en allemand, mais sa liste restait « Allemagne / Royaume-Uni /
  //  Belgique ». Comme le dessin est partagé, la traduction l'est aussi : les
  //  noms passent par t(NOMS_PAYS[c]) dans le module commun.
  $('paysListe').innerHTML = htmlListePays({ conseille: suggere });
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
      + '<br><button id="voirTout">' + esc(t('Voir toutes les offres')) + '</button>';
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
  // L'en-tête dit ce qui est À L'ÉCRAN, pas la taille du catalogue : annoncer
  // « 2 027 offres » au-dessus de 315 lignes ferait croire à un affichage cassé.
  if (etat.portee === 'promos') {
    // Ce que l'en-tête annonce = ce que la liste contient. Dédoublonné, comme la
    // liste : le nombre annoncé doit être atteignable en faisant défiler l'écran.
    const melange = melanger(dedoublonner(etat.offres.filter(estBonnePromo)));
    const nb = melange.length;
    // La répartition Amazon / autres enseignes est un RÉGLAGE DE PROGRAMMATION
    // (le mélange se décide dans melanger(), et il est testé là-bas). L'afficher
    // obligeait l'utilisateur à lire un paramètre interne qui ne le concerne pas.
    // L'en-tête dit donc TROIS choses, dans cet ordre : le nombre de bonnes
    // promos (ce qui est à l'écran), le total des promotions du catalogue
    // (demande de B : « entre les deux, sur la deuxième ligne »), puis la date
    // de mise à jour. Sans le total, « 2 415 » ne veut rien dire.
    // Le total de la DEUXIÈME ligne est celui de « Tous les pays (N) », tel
    // qu'affiché dans le sélecteur de pays — demande de B : « Ce chiffre doit
    // tout simplement correspondre au total qui est indiqué dans tous les
    // pays. » On lit donc EXACTEMENT la même source que le sélecteur
    // (etat.offres.length), et non meta.totalOffres : ce dernier ne compte que
    // les promotions vraies et laissait deux nombres différents à l'écran pour
    // la même grandeur (9782 dans l'en-tête contre 11325 dans le sélecteur).
    const totalPromos = etat.offres.length;
    $('comptes').innerHTML = `<b>${nb}</b> ${esc(t('bonnes promos'))}`
      + `<br>${esc(t('{n} promotions', { n: totalPromos }))}`
      + `<br>${esc(t('mis à jour {n}', { n: ilYA(etat.meta.genereLe || new Date().toISOString()) }))}`;
  } else {
    $('comptes').innerHTML = `${etat.meta.totalOffres ?? '—'} ${esc(t('offres'))} · ${etat.meta.totalVeille ?? '—'} ${esc(t('veille'))}<br>${esc(t('mis à jour {n}', { n: ilYA(etat.meta.genereLe || new Date().toISOString()) }))}`;
  }
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
  document.querySelectorAll('[data-eco-miroir]').forEach((m) => {
    m.classList.toggle('on', etat.eco);
    m.setAttribute('aria-pressed', etat.eco ? 'true' : 'false');
  });
  document.body.dataset.eco = etat.eco ? '1' : '0';
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

/** LE RETOUR À L'ACCUEIL — clic sur la marque, en haut à gauche.
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
  etat.portee = 'promos';
  etat.tri = 'remise';
  etat.recherche = '';
  etat.affichees = PAR_PAGE;
  const r = $('recherche');
  if (r) r.value = '';
  const s = $('tri');
  if (s) s.value = 'promos';
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
  $('marque').addEventListener('click', retourAccueil);
  $('marque').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); retourAccueil(); }
  });
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
  $('pays').addEventListener('change', (e) => {
    etat.pays = e.target.value; etat.affichees = PAR_PAGE;
    enregistrerPays();
    dessinerPuces();   // même règle que dans choisirPays() : les nombres suivent
    dessiner();
  });
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
  // LE PETIT ŒIL : un seul écouteur pour toute la page. Il couvre le formulaire
  // d'inscription, le changement de mot de passe ET l'écran de verrouillage.
  // Un écouteur par bouton aurait été à refaire à chaque redessin du panneau —
  // et le jour où on l'oublie, le bouton reste là, inerte.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.oeil');
    if (!b) return;
    e.preventDefault();       // un bouton dans un gabarit ne doit rien valider
    basculerOeil(b);
  });
  // Thèmes : écouteur délégué sur la grille (dix vignettes, un seul écouteur).
  $('themes').addEventListener('click', (e) => {
    const b = e.target.closest('.theme');
    if (b) appliquerTheme(b.dataset.themeId);
  });
  $('regAffichage').addEventListener('click', (e) => {
    const v = e.target.closest('.vue');
    if (v) { appliquerVue(v.dataset.vue); return; }
    if (e.target.closest('[data-eco-miroir]')) basculerEco();
  });
  $('regProfil').addEventListener('click', (e) => {
    if (!e.target.closest('#enregistrerProfil')) return;
    profil.prenom = ($('prenom').value || '').trim().slice(0, 24);
    enregistrerProfil();
    dessinerProfil();
  });
  $('regCompte').addEventListener('click', async (e) => {
    // Le message vit dans la rubrique ; après un nouveau rendu il faut le
    // reposer, sinon il disparaît avec l'ancien contenu.
    const annonce = (msg, ok = false) => {
      const a = $('cAnnonce');
      if (!a) return;
      a.textContent = msg;
      a.style.color = ok ? 'var(--vert)' : 'var(--accent-2)';
    };

    // GOOGLE ET FACEBOOK SONT DANS LE MÊME ENCADRÉ QUE LE FORMULAIRE, donc la
    // case des bons plans les concerne aussi. On annonce donc, pour eux comme
    // pour l'inscription manuelle, ce que devient le choix des bons plans :
    // quelqu'un qui coche puis clique Google doit savoir que son accord a été
    // lu, et quelqu'un qui n'a pas coché doit savoir qu'il ne recevra rien.
    if (e.target.closest('#connexionGoogle') || e.target.closest('#connexionFacebook')) {
      const reseau = e.target.closest('#connexionGoogle') ? 'Google' : 'Facebook';
      const msg = messageConnexion(reseau, !!($('cConsent') || {}).checked);
      if (msg) return annonce(msg);
      return;
    }

    if (e.target.closest('#creerCompte')) {
      // L'INSCRIPTION N'EST PAS UNE FICHE DE CLIENT : on demande l'adresse, et
      // rien d'autre. Le prénom (facultatif) a été retiré le 08/10/2026 : un
      // champ que l'inscrit peut laisser vide ne sert ni à l'inscrire, ni à lui
      // écrire. L'e-mail se suffit à lui-même, et une case de moins est une
      // hésitation de moins devant le formulaire.
      //
      // Trois contrôles AVANT d'envoyer, parce qu'un envoi qui part avec une
      // adresse fautive est un contact perdu que personne ne remarquera jamais :
      //   1. l'adresse a la forme d'une adresse ;
      //   2. le consentement est coché — on n'inscrit personne d'office, c'est
      //      la moindre des choses, et c'est aussi ce que la loi demande ;
      //   3. le tableau est branché. S'il ne l'est pas, on le DIT au lieu de
      //      laisser croire à une inscription (règle de la maison).
      const mail = (($('cMail') || {}).value || '').trim();
      const m1 = ($('cMdp') || {}).value || '';
      const m2 = ($('cMdp2') || {}).value || '';
      const consentement = !!($('cConsent') || {}).checked;
      if (!adresseValide(mail)) return annonce(t("Cette adresse e-mail n'est pas valide."));
      if (!consentement) return annonce(t("Coche la case pour recevoir les bons plans : sans ton accord, on ne t'inscrit pas."));
      if (m1 !== m2) return annonce(t('Les deux mots de passe ne sont pas identiques.'));
      const r = await C.creerCompte(mail, m1);
      if (!r.ok) return annonce(r.message);
      if (!tableauConfigure()) {
        // Compte local créé, mais rien n'est parti : on le dit, on ne le cache pas.
        dessinerCompte();
        return annonce(t("Ton compte est créé sur cet appareil. Le tableau n'est pas encore branché : ton adresse n'a pas été envoyée."), false);
      }
      const envoi = await envoyerInscription({ email: mail, langue, pays: etat.pays });
      if (envoi.ok) retenirInscription(mail);
      dessinerCompte();
      // « ENVOYÉE », PAS « INSCRITE » : le tableau Google ne laisse pas la page
      // lire sa réponse (voir inscription.js). On annonce ce qu'on sait.
      return annonce(envoi.ok
        ? t('Un e-mail de confirmation part vers {n}. Ouvre-le et clique le lien pour activer ton compte.', { n: mail })
        : t("L'envoi n'a pas pu partir. Vérifie ta connexion, puis réessaie."), envoi.ok);
    }

    // RENVOI DE L'E-MAIL DE CONFIRMATION. C'est le même envoi que l'inscription :
    // le tableau reconnaît l'adresse, voit qu'elle est « en attente », et
    // renvoie le message. La page n'a donc rien de spécial à savoir faire.
    if (e.target.closest('#renvoyerConfirmation')) {
      const ins = inscriptionLocale();
      if (!ins || !ins.email) return;
      const r = await envoyerInscription({ email: ins.email, langue, pays: etat.pays });
      return annonce(r.ok
        ? t('Un e-mail de confirmation part vers {n}. Ouvre-le et clique le lien pour activer ton compte.', { n: ins.email })
        : t("L'envoi n'a pas pu partir. Vérifie ta connexion, puis réessaie."), r.ok);
    }

    if (e.target.closest('#changerMdp')) {
      const r = await C.changerMotDePasse(($('cAncien') || {}).value || '', ($('cNouveau') || {}).value || '');
      dessinerCompte();
      return annonce(r.ok ? t('Mot de passe changé.') : r.message, r.ok);
    }

    if (e.target.closest('#exporterDonnees')) {
      exporterDonnees();
      return annonce(t('Fichier « kazendra-mes-donnees.json » généré.'), true);
    }

    if (e.target.closest('#verrouiller')) {
      fermerReglages();
      montrerVerrou();
      return;
    }

    if (e.target.closest('#supprimerCompte')) {
      // Deux appuis : un effacement définitif ne doit pas tenir à un doigt qui
      // glisse. Et pas de fenêtre « confirm » : dans l'APK, le WebView peut la
      // refuser en silence — la suppression ne marcherait alors jamais, sans
      // que rien ne le signale.
      const b = e.target.closest('#supprimerCompte');
      if (!suppressionArmee) {
        suppressionArmee = true;
        b.textContent = t('Appuie encore pour confirmer');
        setTimeout(() => {
          suppressionArmee = false;
          if (document.body.contains(b)) b.textContent = t('Supprimer mon compte');
        }, 8000);
        return annonce(t('Le compte ET les données de cet appareil seront effacés. Sans serveur, rien ne pourra être restauré.'));
      }
      suppressionArmee = false;
      C.supprimerCompte();
      effacerTout();
      // L'inscription locale part avec le reste : sinon la fiche continuerait
      // d'afficher une adresse « en attente » pour un compte qu'on vient
      // d'effacer. Le tableau, lui, n'est PAS touché — une inscription confirmée
      // reste chez son propriétaire, et seule la feuille peut la retirer.
      oublierInscription();
      dessinerCompte();
      return annonce(t('Compte et données effacés de cet appareil.'), true);
    }
  });
}

/* ---------- Verrou du compte local ---------- */
let suppressionArmee = false;
let dejaLance = false;

function montrerVerrou() {
  if (!C.compteEnregistre()) return;
  // ON BRANCHE ICI, PAS SEULEMENT AU DÉMARRAGE.
  // Défaut trouvé le 08/10/2026 en exerçant l'écran (et pas en le relisant) :
  // brancherVerrou() n'était appelé que dans la branche de démarrage « un
  // compte existe déjà ». Quelqu'un qui créait son compte PENDANT la session
  // puis appuyait sur « Verrouiller maintenant » voyait donc l'écran de
  // verrouillage s'afficher SANS AUCUN bouton branché : ni « Déverrouiller », ni
  // « J'ai oublié mon mot de passe » ne répondaient. L'application était fermée
  // jusqu'au prochain rechargement — et dans l'APK, jusqu'au prochain
  // lancement. Le branchement est idempotent : l'appeler deux fois ne pose pas
  // deux écouteurs.
  brancherVerrou();
  $('titreVerrou').textContent = t('Bonjour {n}', { n: C.nomCompte() });
  $('verrouIntro').textContent = t("Entre ton mot de passe pour ouvrir l'application. Il n'est enregistré nulle part : si tu l'as oublié, personne ne pourra le retrouver, et la seule issue sera d'effacer le compte et les données de cet appareil.");
  $('verrouOublie').textContent = t("J'ai oublié mon mot de passe");
  oublisArmes = false;
  $('verrouErreur').hidden = true;
  $('verrou').hidden = false;
  $('verrouMdp').value = '';
  $('verrouMdp').focus();
}

let oublisArmes = false;
/** Les écouteurs du verrou ne se posent qu'une fois. Sans ce drapeau,
 *  montrerVerrou() — qui peut être appelé plusieurs fois — empilerait les
 *  écouteurs, et « Déverrouiller » validerait deux fois le même mot de passe. */
let verrouBranche = false;

function brancherVerrou() {
  if (verrouBranche) return;
  verrouBranche = true;
  const valider = async () => {
    const r = await C.verifierMotDePasseCompte($('verrouMdp').value);
    if (!r.ok) {
      $('verrouErreur').textContent = r.message;
      $('verrouErreur').hidden = false;
      $('verrouMdp').select();
      return;
    }
    $('verrouErreur').hidden = true;
    $('verrou').hidden = true;
    $('verrouMdp').value = '';
    if (!dejaLance) { dejaLance = true; lancer(); }
  };
  $('verrouOk').addEventListener('click', valider);
  $('verrouMdp').addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
  $('verrouOublie').addEventListener('click', () => {
    if (!oublisArmes) {
      oublisArmes = true;
      $('verrouIntro').textContent = t("Sans serveur, aucun mot de passe ne peut être retrouvé : personne ne le connaît, il n'est pas enregistré. Deux issues seulement — tu te souviens, ou on efface. Effacer supprime le compte ET les données (favoris, réglages) de cet appareil, définitivement.");
      $('verrouOublie').textContent = t("Effacer le compte et les données (appuie encore)");
      return;
    }
    C.supprimerCompte();
    effacerTout();
    $('verrou').hidden = true;
    if (!dejaLance) { dejaLance = true; lancer(); }
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
        const r = await fetch(BASE + route, { cache: 'no-store', signal: stop.signal });
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
  etat.offres = (d.offres || []).filter((o) => o.lienPage || o.lienMarchand);
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
  // Le verrou d'écran est ouvert ? Alors l'application est derrière : ne rien
  // faire, et surtout ne pas charger des données que personne ne regarde.
  const verrou = $('verrou');
  if (verrou && !verrou.hidden) return;
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
  // Thème et profil AVANT le premier rendu : sinon l'écran s'affiche aux
  // couleurs par défaut puis bascule sous les yeux de l'utilisateur.
  appliquerTheme(themeEnregistre() || THEME_DEFAUT);
  chargerProfil();
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
  // Le dessin et le libellé des yeux : posés une fois la langue lue, et avant
  // tout affichage — celui de l'écran de verrouillage est écrit dans
  // index.html, il attend d'être complété.
  preparerOeils();
  try { document.documentElement.lang = langue(); } catch { /* rien */ }
  // Feuille Réglages et rubrique COMPTE : toutes deux construites par le
  // JavaScript, donc traduireDOM() ne les rattrape pas. Dessinées trop tôt —
  // c'était le cas, la feuille était bâtie avant la lecture de la langue — elles
  // restaient en FRANÇAIS dans les neuf langues, sans la moindre erreur. Le
  // commentaire ci-dessus disait déjà la règle ; l'ordre des appels la violait.
  dessinerReglages();
  dessinerCompte();
  dessinerPuces();
  dessinerPays();
  dessinerBandeau();
  dessiner();
  demanderPays();     // première ouverture : on demande le pays, une fois
  // Relevé de trafic, en DERNIER : à ce point la langue et le pays sont
  // connus, donc le relevé dit quelque chose de vrai. Le noter plus tôt
  // inscrirait « pays inconnu » pour tout le monde. Un seul relevé par
  // session, et l'envoi au relais ne bloque jamais l'affichage (voir trafic.js).
  noterVisite({
    pays: etat.pays,
    langue: langue(),
    relais: (() => { try { return localStorage.getItem('kazendra.relais') || ''; } catch { return ''; } })(),
  });
}

/**
 * Au démarrage : s'il existe un compte sur cet appareil, le mot de passe est
 * demandé AVANT de charger quoi que ce soit — sinon le verrou ne verrouille
 * rien. Sans compte, l'application s'ouvre normalement.
 */
function demarrer() {
  // La rubrique compte est dessinée dans lancer(), après la lecture de la
  // langue : le texte est construit en JavaScript, donc il doit naître dans la
  // bonne langue (traduireDOM ne rattrape que le HTML statique).
  if (C.compteEnregistre()) {
    brancherVerrou();
    montrerVerrou();
    return;
  }
  dejaLance = true;
  lancer();
}

demarrer();
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
