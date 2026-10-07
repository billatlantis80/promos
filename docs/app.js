/**
 * Application n°2 — interface.
 * Aucune dépendance : on lit /api/offres et on affiche.
 * Principe : ne JAMAIS maquiller une offre. Une remise calculée est marquée
 * comme telle ; sans remise chiffrée, on affiche l'offre sans étiquette.
 */
import { lienAffilie, MENTION_AFFILIATION, siteAmazon } from './affiliation.js';
import * as C from './compte.js';
import { t, chargerLangue, definirLangue, traduireDOM, languesDisponibles, langue, CLE_LANGUE, locale } from './langues.js';
import { noterVisite } from './trafic.js';

const $ = (id) => document.getElementById(id);

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
const HUB = 'https://billatlantis80.github.io/promos/';
const DANS_APK = location.hostname === 'appassets.androidplatform.net';
const BASE = DANS_APK ? HUB : '';

const NOMS_CATEGORIES = {
  bricolage: 'Bricolage', maison: 'Maison', tech: 'High-tech',
  electromenager: 'Électroménager', mode: 'Mode',
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
const ORDRE_CATEGORIES = ['tech', 'electromenager', 'meubles', 'maison', 'mode', 'auto', 'jouets', 'sport', 'bricolage', 'beaute', 'nourriture', 'animaux', 'voyages', 'activite', 'autre'];

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
const NOMS_PAYS = {
  FR: 'France', BE: 'Belgique', DE: 'Allemagne', NL: 'Pays-Bas', ES: 'Espagne',
  IT: 'Italie', AT: 'Autriche', PT: 'Portugal', PL: 'Pologne', SE: 'Suède',
  IE: 'Irlande', GB: 'Royaume-Uni',
};
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
};

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
  dessinerConnexion();
  dessinerLangue();
  dessinerCompte();
  majThemes();
}

/** Rubrique « Inscription et connexion ».
 *
 *  Google et Facebook demandent un IDENTIFIANT D'APPLICATION (client ID), qui
 *  appartient au propriétaire de l'application — jamais à nous. Tant qu'il n'est
 *  pas renseigné, le bouton ne fait pas semblant : il dit ce qui manque, au lieu
 *  d'ouvrir une fenêtre qui échouerait.
 */
function dessinerConnexion() {
  const rc = $('regConnexion');
  if (!rc) return;
  const pret = (id) => typeof id === 'string' && id.trim().length > 0;
  const style = 'width:100%;display:flex;align-items:center;justify-content:center;gap:9px;'
    + 'padding:11px 12px;border-radius:11px;font:inherit;font-weight:600;font-size:14px;'
    + 'cursor:pointer;text-decoration:none;border:1px solid var(--bord)';
  rc.innerHTML = `
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
  $('connexionGoogle').addEventListener('click', () => annoncerConnexion('Google'));
  $('connexionFacebook').addEventListener('click', () => annoncerConnexion('Facebook'));
}

/** Sans identifiant d'application, on EXPLIQUE au lieu de faire semblant. */
function annoncerConnexion(reseau) {
  const id = reseau === 'Google' ? window.KAZENDRA_GOOGLE_CLIENT_ID
                                 : window.KAZENDRA_FACEBOOK_APP_ID;
  if (typeof id === 'string' && id.trim()) return;   // renseigné : le branchement s'en occupe
  alert(t("La connexion {r} n'est pas encore ouverte : il manque l'identifiant d'application.",
          { r: reseau }));
}

/** Drapeaux des 9 langues, dessinés en VECTORIEL.
 *
 *  Pourquoi pas les emoji (🇫🇷) : Windows ne les dessine pas — il affiche les
 *  deux lettres « FR » dans un petit carré. Sur une application qui vise toute
 *  l'Europe, un drapeau qui devient du texte selon la machine n'est pas
 *  acceptable. Ces tracés-là s'affichent identiquement partout, à toute taille,
 *  et ne coûtent aucune requête réseau (un fichier image par drapeau = 9
 *  téléchargements de plus sur un forfait mobile — contraire à la règle
 *  d'économie de données).
 *
 *  Chaque drapeau fait 24 × 16, les proportions réelles d'un drapeau. */
const DRAPEAUX = {
  fr: '<rect width="24" height="16" fill="#ffffff"/><rect width="8" height="16" fill="#002395"/>'
    + '<rect x="16" width="8" height="16" fill="#ED2939"/>',
  nl: '<rect width="24" height="16" fill="#ffffff"/><rect width="24" height="5.4" fill="#AE1C28"/>'
    + '<rect y="10.6" width="24" height="5.4" fill="#21468B"/>',
  de: '<rect width="24" height="16" fill="#ffffff"/><rect width="24" height="5.4" fill="#000000"/>'
    + '<rect y="10.6" width="24" height="5.4" fill="#FFCE00"/>',
  en: '<rect width="24" height="16" fill="#012169"/>'
    + '<path d="M0 0 24 16M24 0 0 16" stroke="#ffffff" stroke-width="3.4"/>'
    + '<path d="M0 0 24 16M24 0 0 16" stroke="#C8102E" stroke-width="1.5"/>'
    + '<path d="M12 0V16M0 8H24" stroke="#ffffff" stroke-width="5.4"/>'
    + '<path d="M12 0V16M0 8H24" stroke="#C8102E" stroke-width="3"/>',
  es: '<rect width="24" height="16" fill="#F1BF00"/><rect width="24" height="4" fill="#AA151B"/>'
    + '<rect y="12" width="24" height="4" fill="#AA151B"/>',
  it: '<rect width="24" height="16" fill="#ffffff"/><rect width="8" height="16" fill="#009246"/>'
    + '<rect x="16" width="8" height="16" fill="#CE2B37"/>',
  pt: '<rect width="24" height="16" fill="#FF0000"/><rect width="9.6" height="16" fill="#006600"/>'
    + '<circle cx="9.6" cy="8" r="3.4" fill="#FFD700"/><circle cx="9.6" cy="8" r="1.7" fill="#CE1126"/>',
  pl: '<rect width="24" height="16" fill="#ffffff"/><rect y="8" width="24" height="8" fill="#DC143C"/>',
  sv: '<rect width="24" height="16" fill="#006AA7"/><rect x="7.5" width="3" height="16" fill="#FECC00"/>'
    + '<rect y="7" width="24" height="3" fill="#FECC00"/>',
};

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
      <span class="avatar" id="avatar" title="Aperçu">${esc(initiale())}</span>
      <span>${nom ? t('Bonjour {n}', { n: esc(nom) }) : esc(t('Aucun prénom enregistré'))}<br><span style="font-size:12.5px;color:var(--doux)">${esc(t('Gardé sur cet appareil uniquement. Effacé avec les données du site.'))}</span></span>
    </div>`;
}

/** Bloc « tes droits » : ce qui est gardé, où, et comment tout reprendre ou tout
    effacer. Obligatoire pour la publication, et utile même sans obligation. */
function blocDroits() {
  return `
    <div class="carte-bloc" style="margin-top:12px">
      <h4>${esc(t('Tes données, tes droits'))}</h4>
      <p>Ce qui est conservé sur cet appareil : le nom d'utilisateur, une empreinte
         du mot de passe (jamais le mot de passe), le prénom affiché, tes favoris
         et tes réglages. <b>Rien n'est envoyé</b> : il n'y a ni serveur, ni
         traqueur, ni cookie publicitaire.</p>
      <ul>
        <li><b>Voir et emporter</b> : « Télécharger mes données » produit un fichier
            lisible qui contient tout.</li>
        <li><b>Effacer</b> : « Supprimer mon compte » retire le compte et les
            données de cet appareil, sans délai et sans avoir à demander à personne.</li>
        <li><b>Durée</b> : jusqu'à ce que tu supprimes. Aucune copie n'existe ailleurs.</li>
      </ul>
      <p style="margin-top:8px">Les liens vers les marchands peuvent être affiliés :
         l'application peut alors toucher une commission, <b>sans changer le prix
         que tu paies</b>.</p>
    </div>`;
}

const dateLisible = (iso) => {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return 'date inconnue'; }
};

function dessinerCompte() {
  const f = C.ficheCompte();
  if (!f) {
    $('regCompte').innerHTML = `
      <div class="carte-bloc">
        <h4>${esc(t('Aucun compte sur cet appareil'))}</h4>
        <p>Ce compte <b>ne crée rien en ligne</b> : il n'y a pas de serveur. Il
           protège l'accès à l'application (favoris, réglages) sur ce téléphone,
           et donne un nom au porteur des données.</p>
        <p>${t("Ce qu'il ne fera jamais, pour que tu ne l'attendes pas : retrouver tes favoris sur un autre appareil, ni te rendre un mot de passe oublié. Le mot de passe n'est pas enregistré — seulement une empreinte calculée à partir de lui.")}</p>
        <div class="champ">
          <label for="cNom">${esc(t("Nom d'utilisateur"))}</label>
          <input id="cNom" type="text" maxlength="24" autocomplete="username" placeholder="${esc(t('3 à 24 caractères'))}">
        </div>
        <div class="champ">
          <label for="cMdp">${esc(t('Mot de passe'))}</label>
          <input id="cMdp" type="password" autocomplete="new-password" placeholder="${esc(t('8 caractères minimum'))}">
        </div>
        <div class="champ">
          <label for="cMdp2">${esc(t('Répète le mot de passe'))}</label>
          <input id="cMdp2" type="password" autocomplete="new-password">
        </div>
        <p class="annonce" id="cAnnonce"></p>
        <p style="margin:0"><button class="enregistrer" id="creerCompte">${esc(t('Créer mon compte'))}</button></p>
      </div>
      ${blocDroits()}`;
    return;
  }
  $('regCompte').innerHTML = `
    <div class="carte-bloc">
      <div class="fiche-compte">
        <span class="avatar">${esc(f.nom.slice(0, 1).toUpperCase())}</span>
        <span>
          <span class="qui">${esc(f.nom)}</span><br>
          <span class="quand">compte local créé le ${dateLisible(f.cree)} · ${esc(f.algorithme || 'PBKDF2-SHA256')} ${f.tours ? `(${f.tours} tours)` : ''}</span>
        </span>
      </div>
      <p>${t("Ce compte vit sur cet appareil uniquement. Il protège l'accès à l'application ; il ne synchronise rien et ne se connecte à rien.")}</p>
      <div class="champ">
        <label for="cAncien">${esc(t('Mot de passe actuel'))}</label>
        <input id="cAncien" type="password" autocomplete="current-password">
      </div>
      <div class="champ">
        <label for="cNouveau">${esc(t('Nouveau mot de passe'))}</label>
        <input id="cNouveau" type="password" autocomplete="new-password">
      </div>
      <p class="annonce" id="cAnnonce"></p>
      <div class="compte-actions">
        <button class="enregistrer" id="changerMdp">Changer le mot de passe</button>
        <button class="outil" id="verrouiller">Verrouiller maintenant</button>
        <button class="outil" id="exporterDonnees">Télécharger mes données</button>
        <button class="outil danger" id="supprimerCompte">${esc(t('Supprimer mon compte'))}</button>
      </div>
    </div>
    ${blocDroits()}`;
}

/** Export RGPD : tout ce que l'application garde, dans un seul fichier lisible. */
function exporterDonnees() {
  const paquet = {
    application: 'Promos',
    exporteLe: new Date().toISOString(),
    avertissement: "Tout ce que l'application conserve sur cet appareil. Rien n'a été envoyé nulle part — il n'y a pas de serveur.",
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
  a.download = 'promos-mes-donnees.json';
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

const euros = (v) => (v == null ? '' : (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €');

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

/*  MÉLANGE 60 % / 40 % — décision du propriétaire du produit : la majorité des
 *  résultats doit pointer chez Amazon (lien direct, commissions), et 40 % vers
 *  les autres grandes enseignes du pays.
 *
 *  C'est un PLAFOND des deux côtés, donc une vraie proportion, et pas une
 *  simple préférence de tri : sans plafond sur les enseignes, la Belgique
 *  (44 promos Amazon pour 157 offres d'enseignes) afficherait 22 % d'Amazon —
 *  l'inverse de la cible. Sans plafond sur Amazon, les pays riches en ventes
 *  flash repartiraient à 98 % d'Amazon.
 *
 *  L'alternance est VOULUE : le mélange doit se voir dès la première page,
 *  sinon l'utilisateur croit que les enseignes ont disparu.
 */
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

/** Le comparateur du tri courant. Extrait de « triees » parce que le MÉLANGE en
 *  a besoin : il trie chaque camp séparément avant d'alterner. */
function comparateur() {
  if (etat.tri === 'prix') return (a, b) => (a.prix ?? 1e9) - (b.prix ?? 1e9) || (b.remise || 0) - (a.remise || 0);
  if (etat.tri === 'recent') return (a, b) => new Date(b.date) - new Date(a.date);
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
      ? `<span class="etiquette econ" title="${esc(t('Économie par rapport au prix de référence'))}">${esc(t('économise {n}', { n: euros(o.prixAvant - o.prix) }))}</span>`
      : '',
    o.encoreEnListe === false
      ? `<span class="etiquette perime" title="${esc(t("Cette offre n'est plus dans la liste du jour : le prix affiché est celui du moment où tu l'as gardée de côté."))}">${esc(t("n'est plus dans la liste"))}</span>`
      : '',
  ].filter(Boolean).join('');
  // Le montant est groupé dans un seul élément : sans ce groupe, le prix
  // « avant » serait repoussé à l'autre bout de la ligne.
  const montant = o.prix != null
    ? `${euros(o.prix)}${o.prixAvant ? `<span class="avant">${euros(o.prixAvant)}</span>` : ''}`
    : '';
  const prix = montant ? `<div class="prix"><span class="montant">${montant}</span></div>` : '';
  // Le VERDICT de la promo — ce que l'HISTORIQUE DES PRIX permet d'affirmer.
  // Il reste vide quand on n'a pas assez de recul : un badge inventé serait
  // pire que pas de badge du tout.
  const verdict = texteVerdict(o);
  const lien = lienAffilie(o.lienMarchand || o.lienPage, o.marchand);
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
      <div class="bas">
        <!-- Le bouton de redirection, et SOUS lui la mise à jour de l'offre. -->
        <div class="col-envoi">
          <a class="btn" href="${esc(lien)}" target="_blank" rel="noopener nofollow sponsored">${libelle}</a>
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

/** Le lien partagé porte l'identifiant du marché visé, comme le bouton. */
function lienPartage(o) {
  return lienAffilie(o.lienMarchand || o.lienPage, o.marchand);
}

/** Ce qu'on écrit à l'ami : le titre, le prix s'il est connu, et le lien. */
function textePartage(o, lien) {
  const prix = o.prix != null ? '\n' + euros(o.prix) : '';
  return o.titre + prix + '\n' + lien;
}

function partagerOffre(id, bouton) {
  const o = etat.offres.find((x) => String(x.id) === String(id));
  if (!o) return;
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
    const compteP = compteParPays();
    const item = (code, libelle, n) => `
      <button class="pays-item${etat.pays === code ? ' on' : ''}" data-pays="${esc(code)}" type="button"
              aria-pressed="${etat.pays === code}">
        <b>${esc(libelle)}</b><span>${esc(t('{n} offres', { n }))}</span>
      </button>`;
    rp.innerHTML = '<div class="pays-liste">'
      + item('tout', t("Tous les pays d'Europe"), etat.offres.length)
      + codes.map((c) => item(c, t(NOMS_PAYS[c]), compteP[c])).join('')
      + '</div>'
      + '<p style="margin:10px 0 0;font-size:12.5px;color:var(--doux)">Seuls des pays d’Europe sont proposés : les trajets restent courts.</p>';
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
  const codes = codesPays();
  if (!codes.length) return;                 // pas de données : rien à demander
  // Même chiffre que le sélecteur de la barre du haut : TOUTES les offres du
  // pays (voir optionsPays), et non le seul nombre de « bonnes affaires ». Deux
  // listes du même choix ne peuvent pas annoncer deux nombres différents.
  const compte = compteParPays();
  const suggere = paysDetecte();
  // « Tous les pays d'Europe » vient EN PREMIER : c'est l'échappatoire, et une
  // échappatoire qu'on doit chercher en bas de liste n'en est plus une. Il est
  // présenté comme les pays : même apparence, même geste, rien à part.
  //  ⚠ Libellés TRADUITS. Défaut vu sur la capture d'écran du 7/10 : la fenêtre
  //  « Wo kaufst du ein? » était bien en allemand, mais sa liste de pays restait
  //  « Allemagne / Royaume-Uni / Belgique ». C'est pourtant la PREMIÈRE fenêtre
  //  que voit un nouvel utilisateur : elle ne doit pas être à moitié traduite.
  const items = [`<button class="pays-item" data-pays="tout">
      <b>${esc(t("Tous les pays d'Europe"))}</b><span>${esc(t('{n} offres', { n: etat.offres.length }))}</span>
    </button>`];
  for (const c of codes) {
    const n = compte[c] || 0;
    items.push(`<button class="pays-item${c === suggere ? ' conseille' : ''}" data-pays="${esc(c)}">
      <b>${esc(t(NOMS_PAYS[c]))}</b><span>${esc(t(n > 1 ? '{n} offres' : '{n} offre', { n }))}</span>
    </button>`);
  }
  $('paysListe').innerHTML = items.join('');
  $('paysDemande').hidden = false;
}

function enregistrerPays() {
  try { localStorage.setItem(CLE_PAYS, etat.pays); } catch { /* mode privé */ }
}

function dessinerBandeau() {
  const b = $('bandeau');
  const enLigne = !!(etat.meta && (etat.meta.amazon || etat.meta.reseaux));
  const msgs = [];
  if (etat.meta && etat.meta.horsLigne) {
    // Libellés TRADUITS : c'étaient les deux dernières phrases françaises d'une
    // interface par ailleurs traduite (relevé sur la capture du 7/10).
    const quand = etat.meta.genereLe
      ? new Date(etat.meta.genereLe).toLocaleString(locale())
      : String(etat.meta.genereLe || '—');
    msgs.push(t("<b>Hors ligne</b> : le serveur des promos est injoignable. La liste ci-dessous est l'instantané embarqué du {n} ; les visuels ne sont pas disponibles.", { n: esc(quand) }));
  }
  if (!enLigne) msgs.push(t("<b>À activer</b> : l'identifiant d'affiliation n'est pas encore renseigné (fichier <code>affiliation.js</code>). Les liens sortent donc en direct, sans commission."));
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
    $('vide').innerHTML = 'Aucune <b>bonne promo</b> ici pour l’instant : nous n’affichons que des offres à prix réel — deux prix affichés quand la remise peut être démontrée, et pour les autres enseignes un prix réel avec le nom de la boutique.'
      + '<br><button id="voirTout">Voir toutes les offres</button>';
    $('voirTout').addEventListener('click', () => {
      etat.portee = 'tout'; etat.tri = 'remise';
      $('tri').value = 'tout';
      etat.affichees = PAR_PAGE;
      dessinerPuces();
      dessiner();
    });
  } else {
    $('vide').textContent = etat.favoris
      ? 'Aucun favori pour l’instant. Touche l’étoile d’une offre pour la garder de côté.'
      : 'Aucune offre ne correspond à ce filtre.';
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

function brancher() {
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

    if (e.target.closest('#creerCompte')) {
      const nom = ($('cNom') || {}).value || '';
      const m1 = ($('cMdp') || {}).value || '';
      const m2 = ($('cMdp2') || {}).value || '';
      if (m1 !== m2) return annonce(t('Les deux mots de passe ne sont pas identiques.'));
      const r = await C.creerCompte(nom, m1);
      dessinerCompte();
      return annonce(r.ok ? t('Compte « {n} » créé sur cet appareil.', { n: r.nom }) : r.message, r.ok);
    }

    if (e.target.closest('#changerMdp')) {
      const r = await C.changerMotDePasse(($('cAncien') || {}).value || '', ($('cNouveau') || {}).value || '');
      dessinerCompte();
      return annonce(r.ok ? t('Mot de passe changé.') : r.message, r.ok);
    }

    if (e.target.closest('#exporterDonnees')) {
      exporterDonnees();
      return annonce(t('Fichier « promos-mes-donnees.json » généré.'), true);
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
        b.textContent = 'Appuie encore pour confirmer';
        setTimeout(() => {
          suppressionArmee = false;
          if (document.body.contains(b)) b.textContent = t('Supprimer mon compte');
        }, 8000);
        return annonce(t('Le compte ET les données de cet appareil seront effacés. Sans serveur, rien ne pourra être restauré.'));
      }
      suppressionArmee = false;
      C.supprimerCompte();
      effacerTout();
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
  $('titreVerrou').textContent = t('Bonjour {n}', { n: C.nomCompte() });
  $('verrouIntro').textContent = "Entre ton mot de passe pour ouvrir l'application. Il n'est enregistré nulle part : si tu l'as oublié, personne ne pourra le retrouver, et la seule issue sera d'effacer le compte et les données de cet appareil.";
  $('verrouOublie').textContent = 'J’ai oublié mon mot de passe';
  oublisArmes = false;
  $('verrouErreur').hidden = true;
  $('verrou').hidden = false;
  $('verrouMdp').value = '';
  $('verrouMdp').focus();
}

let oublisArmes = false;

function brancherVerrou() {
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
      $('verrouIntro').textContent = "Sans serveur, aucun mot de passe ne peut être retrouvé : personne ne le connaît, il n'est pas enregistré. Deux issues seulement — tu te souviens, ou on efface. Effacer supprime le compte ET les données (favoris, réglages) de cet appareil, définitivement.";
      $('verrouOublie').textContent = 'Effacer le compte et les données (appuie encore)';
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

async function lancer() {
  $('mention').textContent = MENTION_AFFILIATION;
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
    etat.offres = (d.offres || []).filter((o) => o.lienPage || o.lienMarchand);
    etat.meta = { ...d, amazon: false, reseaux: false };
    const aff = await import('./affiliation.js');
    etat.meta.amazon = aff.marchesAmazonActifs().length > 0;
    etat.meta.marches = aff.marchesAmazonActifs();
    etat.meta.reseaux = (aff.RESEAUX || []).length > 0;
  } catch (e) {
    $('comptes').textContent = 'données indisponibles';
    $('vide').hidden = false;
    $('vide').textContent = `Impossible de lire les offres (${e.message}). Lance le collecteur : node collecteur.mjs`;
    return;
  }
  // La langue est lue AVANT tout dessin : chaque libellé construit par le
  // JavaScript doit naître dans la bonne langue. Sinon la page s'affiche en
  // français une fraction de seconde, puis se corrige sous les yeux de
  // l'utilisateur — et l'en-tête, lui, resterait en français jusqu'au premier
  // redessin complet.
  chargerLangue();
  traduireDOM();
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
