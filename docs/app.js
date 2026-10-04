/**
 * Application n°2 — interface.
 * Aucune dépendance : on lit /api/offres et on affiche.
 * Principe : ne JAMAIS maquiller une offre. Une remise calculée est marquée
 * comme telle ; sans remise chiffrée, on affiche l'offre sans étiquette.
 */
import { lienAffilie, MENTION_AFFILIATION } from './affiliation.js';

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
const PAR_PAGE = 24;

let etat = {
  offres: [], categorie: 'tout', marchand: 'tout', tri: 'remise', recherche: '',
  affichees: PAR_PAGE, vue: 'grille', eco: false, favoris: false, meta: {},
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
  { id: 'clair', nom: 'Clair', fond: '#f5f6f8', carte: '#ffffff', accent: '#e2621b' },
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

function dessinerCompte() {
  $('regCompte').innerHTML = `
    <div class="carte-bloc">
      <h4>Aucun compte pour l'instant</h4>
      <p>L'application fonctionne entièrement sur ton appareil : profil, favoris, thème. Rien n'est envoyé nulle part.</p>
      <p>L'inscription, la connexion, le mot de passe et la déconnexion demandent un <b>serveur</b> — un endroit qui vérifie qui tu es et qui retrouve ta liste depuis un autre téléphone. Tant qu'il n'existe pas, il n'y a pas de formulaire ici : un bouton « Se connecter » qui ne connecte personne serait un mensonge.</p>
      <p>Ce qu'il faut, dans l'ordre :</p>
      <ul>
        <li>un service d'authentification (inscription, mot de passe oublié, déconnexion) ;</li>
        <li>une politique de confidentialité et la suppression de compte — obligatoires pour le Play Store ;</li>
        <li>la synchronisation, pour retrouver ses données ailleurs que sur ce téléphone.</li>
      </ul>
      <p style="margin-top:12px"><button class="outil" id="effacerAppareil" title="Efface profil, favoris, thème et réglages de cet appareil">Effacer mes données de cet appareil</button></p>
    </div>`;
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

/** Une offre passe-t-elle les filtres courants ? */
function retenue(o) {
  if (etat.categorie !== 'tout' && o.categorie !== etat.categorie) return false;
  if (etat.marchand !== 'tout' && o.marchand !== etat.marchand) return false;
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
        <a class="btn" href="${esc(lien)}" target="_blank" rel="noopener nofollow sponsored">${article ? 'Lire l’article' : 'Voir l’offre'}</a>
        <span class="quand">${quand}</span>
      </div>
    </div>
  </article>`;
}

function dessinerPuces() {
  const offres = etat.offres;
  const parCat = {};
  for (const o of offres) parCat[o.categorie] = (parCat[o.categorie] || 0) + 1;
  const cats = Object.keys(parCat).sort((a, b) => parCat[b] - parCat[a]);
  const puces = [`<button class="puce${etat.categorie === 'tout' ? ' on' : ''}" data-cat="tout">Tout<span class="n">${offres.length}</span></button>`];
  for (const c of cats) {
    if (!NOMS_CATEGORIES[c]) continue;
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
  $('vide').textContent = etat.favoris
    ? 'Aucun favori pour l’instant. Touche l’étoile d’une offre pour la garder de côté.'
    : 'Aucune offre ne correspond à ce filtre.';
  $('vide').hidden = liste.length > 0;
  const reste = liste.length - etat.affichees;
  $('plus').hidden = reste <= 0;
  $('plus').innerHTML = reste > 0 ? `<button id="btnPlus">Afficher ${Math.min(PAR_PAGE, reste)} offres de plus (${reste} restantes)</button>` : '';
  if (reste > 0) $('btnPlus').addEventListener('click', () => { etat.affichees += PAR_PAGE; dessiner(); });

  const total = etat.meta.total || etat.offres.length;
  $('comptes').innerHTML = `${etat.meta.totalOffres ?? '—'} offres · ${etat.meta.totalVeille ?? '—'} veille<br>mis à jour ${esc(ilYA(etat.meta.genereLe || new Date().toISOString()))}`;
  $('fraicheur').textContent = `Recensé le ${new Date(etat.meta.genereLe || Date.now()).toLocaleString('fr-FR')} — ${total} entrées.`;
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
  $('tri').addEventListener('change', (e) => { etat.tri = e.target.value; dessiner(); });
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
  $('regCompte').addEventListener('click', (e) => {
    if (e.target.closest('#effacerAppareil')) effacerTout();
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

async function demarrer() {
  $('mention').textContent = MENTION_AFFILIATION;
  // Thème et profil AVANT le premier rendu : sinon l'écran s'affiche aux
  // couleurs par défaut puis bascule sous les yeux de l'utilisateur.
  appliquerTheme(themeEnregistre() || THEME_DEFAUT);
  chargerProfil();
  dessinerReglages();               // construit le contenu de la feuille Réglages
  appliquerVue(vueEnregistree());   // avant tout rendu : aucun clignotement de mode
  chargerFavoris();
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
  dessinerBandeau();
  dessiner();
}

demarrer();
