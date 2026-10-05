/**
 * Application n°2 — interface.
 * Aucune dépendance : on lit /api/offres et on affiche.
 * Principe : ne JAMAIS maquiller une offre. Une remise calculée est marquée
 * comme telle ; sans remise chiffrée, on affiche l'offre sans étiquette.
 */
import { lienAffilie, MENTION_AFFILIATION } from './affiliation.js';
import * as C from './compte.js';

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
  bricolage: 'Bricolage', maison: 'Maison', tech: 'High-tech', mode: 'Mode',
  sport: 'Sport', jouets: 'Jeux & jouets', auto: 'Auto & moto', beaute: 'Beauté', autre: 'Autres',
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
const ORDRE_CATEGORIES = ['tech', 'maison', 'mode', 'auto', 'jouets', 'sport', 'bricolage', 'beaute', 'autre'];

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
const THEME_DEFAUT = 'nuit';
const THEMES = [
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
function dessinerReglages() {
  $('themes').innerHTML = THEMES.map((t) => `
    <button class="theme" data-theme-id="${t.id}" aria-pressed="false">
      <span class="pastilles" aria-hidden="true"><i style="background:${t.fond}"></i><i style="background:${t.carte}"></i><i style="background:${t.accent}"></i></span>
      <span class="nom">${t.nom}</span><span class="coche"></span>
    </button>`).join('');

  // Miroir des réglages de la barre du haut. Les boutons portent la classe
  // « vue » : appliquerVue() les allume tous, ici comme en haut — une seule
  // source de vérité, donc aucun risque de désaccord entre les deux endroits.
  $('regAffichage').innerHTML = `
    <div class="vues" role="group" aria-label="Mode d'affichage">
      ${VUES.map((v) => `<button class="vue" data-vue="${v}" title="${NOMS_VUES[v].etat}" aria-label="${NOMS_VUES[v].etat}">${NOMS_VUES[v].court}</button>`).join('')}
    </div>
    <p style="margin:12px 0 0">
      <button class="outil" data-eco-miroir aria-pressed="false" title="Économie de données — aucun visuel téléchargé">Éco — aucun visuel téléchargé</button>
    </p>`;

  dessinerProfil();
  dessinerCompte();
  majThemes();
}

function dessinerProfil() {
  const nom = profil.prenom.trim();
  $('regProfil').innerHTML = `
    <div class="champ">
      <label for="prenom">Prénom affiché</label>
      <input id="prenom" type="text" maxlength="24" autocomplete="given-name" placeholder="Ton prénom" value="${esc(nom)}">
    </div>
    <p style="margin:0 0 12px"><button class="enregistrer" id="enregistrerProfil">Enregistrer</button></p>
    <div class="ligne-profil">
      <span class="avatar" id="avatar" title="Aperçu">${esc(initiale())}</span>
      <span>${nom ? `Bonjour ${esc(nom)}` : 'Aucun prénom enregistré'}<br><span style="font-size:12.5px;color:var(--doux)">Gardé sur cet appareil uniquement. Effacé avec les données du site.</span></span>
    </div>`;
}

/** Bloc « tes droits » : ce qui est gardé, où, et comment tout reprendre ou tout
    effacer. Obligatoire pour la publication, et utile même sans obligation. */
function blocDroits() {
  return `
    <div class="carte-bloc" style="margin-top:12px">
      <h4>Tes données, tes droits</h4>
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
        <h4>Aucun compte sur cet appareil</h4>
        <p>Ce compte <b>ne crée rien en ligne</b> : il n'y a pas de serveur. Il
           protège l'accès à l'application (favoris, réglages) sur ce téléphone,
           et donne un nom au porteur des données.</p>
        <p>Ce qu'il ne fera jamais, pour que tu ne l'attendes pas : retrouver tes
           favoris sur un autre appareil, ni te rendre un mot de passe oublié. Le
           mot de passe n'est pas enregistré — seulement une empreinte calculée à
           partir de lui.</p>
        <div class="champ">
          <label for="cNom">Nom d'utilisateur</label>
          <input id="cNom" type="text" maxlength="24" autocomplete="username" placeholder="3 à 24 caractères">
        </div>
        <div class="champ">
          <label for="cMdp">Mot de passe</label>
          <input id="cMdp" type="password" autocomplete="new-password" placeholder="8 caractères minimum">
        </div>
        <div class="champ">
          <label for="cMdp2">Répète le mot de passe</label>
          <input id="cMdp2" type="password" autocomplete="new-password">
        </div>
        <p class="annonce" id="cAnnonce"></p>
        <p style="margin:0"><button class="enregistrer" id="creerCompte">Créer mon compte</button></p>
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
      <p>Ce compte vit sur cet appareil uniquement. Il protège l'accès à
         l'application ; il ne synchronise rien et ne se connecte à rien.</p>
      <div class="champ">
        <label for="cAncien">Mot de passe actuel</label>
        <input id="cAncien" type="password" autocomplete="current-password">
      </div>
      <div class="champ">
        <label for="cNouveau">Nouveau mot de passe</label>
        <input id="cNouveau" type="password" autocomplete="new-password">
      </div>
      <p class="annonce" id="cAnnonce"></p>
      <div class="compte-actions">
        <button class="enregistrer" id="changerMdp">Changer le mot de passe</button>
        <button class="outil" id="verrouiller">Verrouiller maintenant</button>
        <button class="outil" id="exporterDonnees">Télécharger mes données</button>
        <button class="outil danger" id="supprimerCompte">Supprimer mon compte</button>
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
  if (mn < 60) return `il y a ${Math.max(1, mn)} min`;
  if (mn < 1440) return `il y a ${Math.round(mn / 60)} h`;
  return `il y a ${Math.round(mn / 1440)} j`;
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
const estBonnePromo = (o) => o.prix != null && o.prixAvant != null && o.prixAvant > o.prix
  && o.remise != null && o.remise >= REMISE_MIN;

/** Combien de bonnes promotions par pays. C'est ce que l'utilisateur verra à
 *  l'ouverture : annoncer « 544 offres » pour n'en montrer que 41 ferait croire
 *  à un filtre cassé. */
function promosParPays() {
  const compte = {};
  for (const o of etat.offres) {
    if (!estBonnePromo(o)) continue;
    const p = o.pays || 'FR';
    compte[p] = (compte[p] || 0) + 1;
  }
  return compte;
}

/** Une offre passe-t-elle les filtres courants ? */
function retenue(o) {
  // Une offre sans pays date d'avant ce filtre : toutes les sources de l'époque
  // étaient françaises, donc « FR » est la lecture juste — pas « inconnu ».
  if (etat.pays !== 'tout' && (o.pays || 'FR') !== etat.pays) return false;
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

function triees(liste) {
  const l = [...liste];
  if (etat.tri === 'remise') l.sort((a, b) => (b.remise || 0) - (a.remise || 0) || new Date(b.date) - new Date(a.date));
  else if (etat.tri === 'prix') l.sort((a, b) => (a.prix ?? 1e9) - (b.prix ?? 1e9) || (b.remise || 0) - (a.remise || 0));
  else l.sort((a, b) => new Date(b.date) - new Date(a.date));
  return l;
}

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
      : `<div class="visuel">${esc(NOMS_CATEGORIES[o.categorie] || '')}</div>`);
  // L'étoile « garder de côté » vit dans l'encadré de la carte, sur la ligne du
  // prix (voir plus bas) : jamais sur la photo, et sans toucher au bouton.
  const garde = estFavori(o.id);
  const etoile = `<button class="favori${garde ? ' on' : ''}" data-id="${esc(o.id)}" aria-pressed="${garde}"
            title="${garde ? 'Retirer des favoris' : 'Garder de côté'}">&#9733;</button>`;
  const etiquettes = [
    o.marchand ? `<span class="etiquette marchand">${esc(o.marchand)}</span>` : '',
    // Le score communautaire Dealabs : c'est LUI qui a servi à ne garder que
    // les meilleures offres. L'afficher rend la sélection visible et vérifiable.
    o.temperature != null ? `<span class="etiquette chaud" title="Score de la communauté Dealabs">${o.temperature}°</span>` : '',
    `<span class="etiquette">${esc(NOMS_CATEGORIES[o.categorie] || o.categorie)}</span>`,
    o.remise != null
      ? `<span class="etiquette remise${o.remiseCalculee ? ' calculee' : ''}" title="${o.remiseCalculee ? 'Pourcentage calculé entre deux prix réels' : 'Pourcentage annoncé par la source'}">${o.remiseCalculee ? '≈ ' : ''}-${o.remise} %</span>`
      : '',
    // Ce que l'utilisateur gagne, en euros. C'est le chiffre qui décide d'un
    // achat — « économise 60 € » parle plus que « -67 % ».
    (o.prix != null && o.prixAvant != null && o.prixAvant > o.prix)
      ? `<span class="etiquette econ" title="Économie par rapport au prix de référence">économise ${euros(o.prixAvant - o.prix)}</span>`
      : '',
    o.encoreEnListe === false
      ? `<span class="etiquette perime" title="Cette offre n'est plus dans la liste du jour : le prix affiché est celui du moment où tu l'as gardée de côté.">n’est plus dans la liste</span>`
      : '',
  ].filter(Boolean).join('');
  // Le montant est groupé dans un seul élément : sans ce groupe, le prix
  // « avant » serait repoussé à l'autre bout de la ligne.
  const montant = o.prix != null
    ? `${euros(o.prix)}${o.prixAvant ? `<span class="avant">${euros(o.prixAvant)}</span>` : ''}`
    : '';
  const prix = montant ? `<div class="prix"><span class="montant">${montant}</span></div>` : '';
  const lien = lienAffilie(o.lienMarchand || o.lienPage, o.marchand);
  const article = o.type === 'article';
  // Pour une offre sortie de la liste, on date la MISE DE CÔTÉ et non la
  // parution : c'est ce qui dit à l'utilisateur ce qu'il a sous les yeux.
  const quand = o.encoreEnListe === false
    ? `gardée ${esc(ilYA(o.misDeCote))}`
    : esc(ilYA(o.date));
  return `<article class="offre">
    ${visuel}
    <div class="corps">
      <h3>${esc(o.titre)}</h3>
      <div class="ligne">${etiquettes}</div>
      ${prix}
      <div class="espace-fav">${etoile}</div>
      <div class="bas">
        <a class="btn" href="${esc(lien)}" target="_blank" rel="noopener nofollow sponsored">${article ? 'Lire l’article' : (o.marchand === 'Amazon' ? 'Acheter sur Amazon' : 'Voir l’offre')}</a>
        <span class="quand">${quand}</span>
      </div>
    </div>
  </article>`;
}

/** Les offres du pays choisi — la base sur laquelle on annonce des nombres.
 *  Sans risque de double comptage : « tout » rend la liste telle quelle. */
function offresDuPays() {
  const base = etat.pays === 'tout'
    ? etat.offres
    : etat.offres.filter((o) => (o.pays || 'FR') === etat.pays);
  // Les compteurs suivent la PORTÉE : annoncer « Tout 544 » au-dessus d'une
  // liste de 41 promotions ferait croire que l'affichage est cassé.
  return etat.portee === 'promos' ? base.filter(estBonnePromo) : base;
}

function dessinerPuces() {
  // Les nombres disent ce que contient le PAYS choisi, pas le catalogue entier.
  // Ils étaient calculés sur toutes les offres : « Tout » annonçait 590 à un
  // Belge qui n'en voyait que 32, et changer de pays ne faisait bouger aucun
  // compteur — l'écran paraissait figé alors que le filtre, lui, marchait.
  const offres = offresDuPays();
  const parCat = {};
  for (const o of offres) parCat[o.categorie] = (parCat[o.categorie] || 0) + 1;
  // L'ORDRE est celui d'ORDRE_CATEGORIES — jamais le nombre d'offres. Trier par
  // fréquence faisait danser les onglets d'un pays à l'autre : « High-tech » et
  // « Maison » échangeaient leur place selon le pays consulté.
  const cats = Object.keys(parCat).filter((c) => NOMS_CATEGORIES[c])
    .sort((a, b) => rangCategorie(a) - rangCategorie(b));
  // Une catégorie choisie absente du pays retombe sur « Tout » : sinon l'onglet
  // disparaîtrait de la liste en laissant le filtre actif, et l'écran semblerait
  // vide sans qu'aucune commande ne dise pourquoi.
  if (etat.categorie !== 'tout' && !cats.includes(etat.categorie)) etat.categorie = 'tout';
  const puces = [`<button class="puce${etat.categorie === 'tout' ? ' on' : ''}" data-cat="tout">Tout<span class="n">${offres.length}</span></button>`];
  for (const c of cats) {
    puces.push(`<button class="puce${etat.categorie === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(NOMS_CATEGORIES[c])}<span class="n">${parCat[c]}</span></button>`);
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

/** Compte les offres par pays : ce que l'application contient VRAIMENT. */
function compteParPays() {
  const compte = {};
  for (const o of etat.offres) { const p = o.pays || 'FR'; compte[p] = (compte[p] || 0) + 1; }
  return compte;
}

/** Codes des pays présents, du plus fourni au moins fourni. */
function codesPays() {
  // On annonce des PROMOTIONS, pas des offres : c'est ce que l'utilisateur
  // trouvera en entrant. Un « 544 » pour 41 lignes affichées ferait croire à une
  // panne — c'est exactement l'erreur qu'on vient de corriger ailleurs, aux
  // trois endroits où ce compte est affiché.
  const compte = promosParPays();
  return Object.keys(compte).filter((c) => NOMS_PAYS[c]).sort((a, b) => compte[b] - compte[a]);
}

function optionsPays() {
  // On annonce des PROMOTIONS, pas des offres : c'est ce que l'utilisateur
  // trouvera en entrant. Un « 544 » pour 41 lignes affichées ferait croire à une
  // panne — c'est exactement l'erreur qu'on vient de corriger ailleurs, aux
  // trois endroits où ce compte est affiché.
  const compte = promosParPays();
  return [`<option value="tout">Tous les pays (${etat.offres.filter(estBonnePromo).length})</option>`]
    .concat(codesPays().map((c) => `<option value="${esc(c)}">${esc(NOMS_PAYS[c])} (${compte[c]})</option>`))
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
    if (!$('paysReglages')) {
      rp.innerHTML = '<div class="champ"><label for="paysReglages">Pays des offres</label>'
        + '<select id="paysReglages"></select></div>'
        + '<p style="margin:0;font-size:12.5px;color:var(--doux)">Seuls des pays d’Europe sont proposés : les trajets restent courts.</p>';
    }
    $('paysReglages').innerHTML = optionsPays();
    $('paysReglages').value = etat.pays;
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
  // On annonce des PROMOTIONS, pas des offres : c'est ce que l'utilisateur
  // trouvera en entrant. Un « 544 » pour 41 lignes affichées ferait croire à une
  // panne — c'est exactement l'erreur qu'on vient de corriger ailleurs, aux
  // trois endroits où ce compte est affiché.
  const compte = promosParPays();
  const suggere = paysDetecte();
  // « Tous les pays d'Europe » vient EN PREMIER : c'est l'échappatoire, et une
  // échappatoire qu'on doit chercher en bas de liste n'en est plus une. Il est
  // présenté comme les pays : même apparence, même geste, rien à part.
  const items = [`<button class="pays-item" data-pays="tout">
      <b>Tous les pays d’Europe</b><span>${etat.offres.filter(estBonnePromo).length} promos</span>
    </button>`];
  for (const c of codes) {
    items.push(`<button class="pays-item${c === suggere ? ' conseille' : ''}" data-pays="${esc(c)}">
      <b>${esc(NOMS_PAYS[c])}</b><span>${compte[c] || 0} promo${(compte[c] || 0) > 1 ? 's' : ''}</span>
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
    const quand = etat.meta.genereLe ? new Date(etat.meta.genereLe).toLocaleString('fr-FR') : 'date inconnue';
    msgs.push(`<b>Hors ligne</b> : le serveur des promos est injoignable. La liste ci-dessous est l'instantané embarqué du ${esc(quand)} ; les visuels ne sont pas disponibles.`);
  }
  if (!enLigne) msgs.push(`<b>À activer</b> : l'identifiant d'affiliation n'est pas encore renseigné (fichier <code>affiliation.js</code>). Les liens sortent donc en direct, sans commission.`);
  if (msgs.length) { b.className = 'bandeau info on'; b.innerHTML = msgs.join('<br>'); }
  else { b.className = 'bandeau'; b.innerHTML = ''; }
}

function dessiner() {
  // En mode favoris, la source n'est plus le flux du jour mais le carnet.
  const source = etat.favoris ? listeFavoris() : etat.offres;
  const liste = triees(source.filter(retenue));
  // Le surlignage de la catégorie se replace à CHAQUE rendu. Les puces n'étant
  // construites qu'au démarrage, la couleur restait sinon figée sur « Tout » :
  // le filtre marchait, mais rien à l'écran ne disait ce qui était sélectionné.
  marquerPuce();
  $('liste').innerHTML = liste.slice(0, etat.affichees).map(carte).join('');
  $('vide').hidden = liste.length > 0;
  if (!liste.length && etat.portee === 'promos' && !etat.favoris) {
    // Rien à montrer dans ce rayon ou ce pays : on le DIT, et on ouvre une porte
    // plutôt que de laisser un écran vide sans issue.
    $('vide').innerHTML = 'Aucune <b>promotion vérifiée</b> ici pour l’instant : nous n’affichons que les offres à deux prix réels, dont la remise est démontrable.'
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
  $('plus').innerHTML = reste > 0 ? `<button id="btnPlus">Afficher ${Math.min(PAR_PAGE, reste)} offres de plus (${reste} restantes)</button>` : '';
  if (reste > 0) $('btnPlus').addEventListener('click', () => { etat.affichees += PAR_PAGE; dessiner(); });

  const total = etat.meta.total || etat.offres.length;
  // L'en-tête dit ce qui est À L'ÉCRAN, pas la taille du catalogue : annoncer
  // « 2 027 offres » au-dessus de 315 lignes ferait croire à un affichage cassé.
  if (etat.portee === 'promos') {
    const nb = etat.offres.filter(estBonnePromo).length;
    $('comptes').innerHTML = `<b>${nb}</b> promotions vérifiées<br>mis à jour ${esc(ilYA(etat.meta.genereLe || new Date().toISOString()))}`;
  } else {
    $('comptes').innerHTML = `${etat.meta.totalOffres ?? '—'} offres · ${etat.meta.totalVeille ?? '—'} veille<br>mis à jour ${esc(ilYA(etat.meta.genereLe || new Date().toISOString()))}`;
  }
  $('fraicheur').textContent = `Recensé le ${new Date(etat.meta.genereLe || Date.now()).toLocaleString('fr-FR')} — ${total} entrées.`;
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
    b.title = garde ? 'Retirer des favoris' : 'Garder de côté';
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
  // Réglages : le même choix, au même endroit que le reste.
  $('regPays').addEventListener('change', (e) => {
    if (e.target.id === 'paysReglages') choisirPays(e.target.value);
  });
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
  // Étoile : écouteur délégué — les cartes sont recréées à chaque rendu.
  $('liste').addEventListener('click', (e) => {
    const b = e.target.closest('.favori');
    if (b) basculerFavori(b.dataset.id);
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
      if (m1 !== m2) return annonce('Les deux mots de passe ne sont pas identiques.');
      const r = await C.creerCompte(nom, m1);
      dessinerCompte();
      return annonce(r.ok ? `Compte « ${r.nom} » créé sur cet appareil.` : r.message, r.ok);
    }

    if (e.target.closest('#changerMdp')) {
      const r = await C.changerMotDePasse(($('cAncien') || {}).value || '', ($('cNouveau') || {}).value || '');
      dessinerCompte();
      return annonce(r.ok ? 'Mot de passe changé.' : r.message, r.ok);
    }

    if (e.target.closest('#exporterDonnees')) {
      exporterDonnees();
      return annonce('Fichier « promos-mes-donnees.json » généré.', true);
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
          if (document.body.contains(b)) b.textContent = 'Supprimer mon compte';
        }, 8000);
        return annonce('Le compte ET les données de cet appareil seront effacés. Sans serveur, rien ne pourra être restauré.');
      }
      suppressionArmee = false;
      C.supprimerCompte();
      effacerTout();
      dessinerCompte();
      return annonce('Compte et données effacés de cet appareil.', true);
    }
  });
}

/* ---------- Verrou du compte local ---------- */
let suppressionArmee = false;
let dejaLance = false;

function montrerVerrou() {
  if (!C.compteEnregistre()) return;
  $('titreVerrou').textContent = `Bonjour ${C.nomCompte()}`;
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
  dessinerReglages();               // construit le contenu de la feuille Réglages
  appliquerVue(vueEnregistree());   // avant tout rendu : aucun clignotement de mode
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
    etat.meta.amazon = !!aff.AMAZON_TAG;
    etat.meta.reseaux = (aff.RESEAUX || []).length > 0;
  } catch (e) {
    $('comptes').textContent = 'données indisponibles';
    $('vide').hidden = false;
    $('vide').textContent = `Impossible de lire les offres (${e.message}). Lance le collecteur : node collecteur.mjs`;
    return;
  }
  dessinerPuces();
  dessinerPays();
  dessinerBandeau();
  dessiner();
  demanderPays();     // première ouverture : on demande le pays, une fois
}

/**
 * Au démarrage : s'il existe un compte sur cet appareil, le mot de passe est
 * demandé AVANT de charger quoi que ce soit — sinon le verrou ne verrouille
 * rien. Sans compte, l'application s'ouvre normalement.
 */
function demarrer() {
  dessinerCompte();                 // construit la rubrique dès l'ouverture
  if (C.compteEnregistre()) {
    brancherVerrou();
    montrerVerrou();
    return;
  }
  dejaLance = true;
  lancer();
}

demarrer();
