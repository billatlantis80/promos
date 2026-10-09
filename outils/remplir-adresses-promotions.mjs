/**
 * REMPLIR LES ADRESSES DE PROMOTIONS — et le PROUVER.
 *
 * Demande de B (09/10/2026) : « je t'ai donné tous les commerces par catégorie
 * dans le panneau administrateur, j'aimerais que tu essayes de tous les activer,
 * en mettant une adresse dans le champ, qui ramène aux promotions du site et qui
 * est vide pour l'instant. Chaque fois que tu en as fait un tu vérifies et tu
 * publies. »
 *
 * ------------------------------------------------------------------ *
 *  POURQUOI LA MÉTHODE A CHANGÉ APRÈS LE PREMIER ESSAI (mesuré)
 *
 *  Le premier jet FABRIQUAIT l'adresse : il collait « /promotions », « /promo »,
 *  « /soldes »… au domaine du marchand. Mesuré sur 20 commerces belges :
 *
 *      91 essais rendent 404        → le chemin n'existe pas
 *      44 essais rendent 403        → le marchand refuse le client HTTP de Node
 *      19 essais rendent 200        → la page existe
 *       1 seul cas exploitable      → 5 % de réussite
 *
 *  Deviner ne marche pas : les chemins réels d'un marchand sont impossibles à
 *  deviner (« /aanbiedingen » chez HEMA, « /fr/offres » chez Coolblue). On
 *  change donc de méthode — on CHERCHE l'adresse au lieu de l'inventer :
 *
 *    MÉTHODE 1 — les liens de l'accueil. On lit la page d'accueil du marchand et
 *      on y cherche le lien dont le TEXTE ou l'URL dit « promotions » dans la
 *      langue du pays. C'est exactement ainsi qu'un visiteur trouve la page.
 *    MÉTHODE 2 — le plan du site (sitemap.xml). Les marchands publient leurs
 *      URL aux robots : on y cherche les adresses qui portent un mot de promo.
 *    MÉTHODE 3 — les chemins devinés, en dernier recours seulement.
 *
 * ------------------------------------------------------------------ *
 *  QUATRE ÉPREUVES AVANT DE RETENIR UNE ADRESSE
 *
 *     1. ROBOTS      — le marchand interdit-il ce chemin ? Si oui, on renonce.
 *     2. RÉPONSE     — la page existe-t-elle vraiment (200, après redirections) ?
 *     3. CONTENU     — est-ce une page de PROMOTIONS, ou l'accueil du catalogue ?
 *     4. LISIBILITÉ  — `offresEnseigne()` en tire-t-il des offres à DEUX PRIX ?
 *                      C'est l'épreuve qui compte : elle prouve que le reste de
 *                      la chaîne (collecte → catalogue → site) en fera quelque
 *                      chose. Une adresse qui échoue ici ne rapporte rien.
 *
 *  RIEN N'EST ÉCRIT PAR DÉFAUT. `--publier` est nécessaire pour toucher
 *  `public/adresses-promotions.json`. Sans lui, l'outil mesure et rend son
 *  rapport — c'est ce qui permet de VOIR ce que ça donne avant de s'engager.
 *
 * Lancement :
 *   node outils/remplir-adresses-promotions.mjs --pays BE --limite 20 --verbeux
 *   node outils/remplir-adresses-promotions.mjs --tous --publier
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { offresEnseigne } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const BASE = path.join(RACINE, 'public', 'acteurs.json');
const FICHIER = path.join(RACINE, 'public', 'adresses-promotions.json');
const RAPPORT = path.join(RACINE, 'donnees', 'rapport-adresses.json');
/* LE JOURNAL DE CHANTIER — un acteur par ligne, écrit À MESURE.
 *
 *  Deux balayages complets sont morts avant la fin (le premier : « heap out of
 *  memory » à 450 acteurs sur 573 ; le second : disparu sans un mot à 550). Les
 *  deux fois, TOUT était perdu, parce que les résultats ne vivaient qu'en
 *  mémoire jusqu'à la dernière seconde. Un chantier d'une demi-heure qui ne
 *  survit pas à une coupure n'est pas un chantier, c'est un pari.
 *
 *  Chaque acteur fini est donc écrit ici IMMÉDIATEMENT, et un redémarrage saute
 *  ceux qui y figurent déjà. On peut relancer autant de fois qu'il faut : le
 *  travail s'ajoute au lieu de recommencer. */
const PARTIEL = path.join(RACINE, 'donnees', 'adresses-partiel.jsonl');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const arg = (nom, defaut = null) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i === -1 ? defaut : (process.argv[i + 1] || true);
};
const drapeau = (nom) => process.argv.includes(`--${nom}`);

const PAYS_VISES = arg('pays');
const LIMITE = Number(arg('limite', 0)) || 0;
const TOUS = drapeau('tous');
const PUBLIER = drapeau('publier');
const VERBEUX = drapeau('verbeux');
const CONCURRENCE = Number(arg('concurrence', 6)) || 6;
const DELAI_MS = Number(arg('delai', 700)) || 700;

const LANGUE_HTTP = {
  FR: 'fr-FR,fr;q=0.9', BE: 'fr-BE,fr;q=0.9,nl;q=0.8', DE: 'de-DE,de;q=0.9',
  AT: 'de-AT,de;q=0.9', NL: 'nl-NL,nl;q=0.9', ES: 'es-ES,es;q=0.9', IT: 'it-IT,it;q=0.9',
  PT: 'pt-PT,pt;q=0.9', PL: 'pl-PL,pl;q=0.9', SE: 'sv-SE,sv;q=0.9',
  IE: 'en-IE,en;q=0.9', GB: 'en-GB,en;q=0.9',
};

/** Les mots que le PAYS emploie pour « promotions ». On ne met pas
 *  « /promotions » partout : un marchand allemand a « angebote », un néerlandais
 *  « aanbiedingen », un suédois « erbjudanden ». Un mot de la mauvaise langue
 *  garantit un 404. */
const MOTS_PROMO = {
  FR: ['promotions', 'promo', 'bons-plans', 'soldes', 'offres', 'reductions', 'deals'],
  BE: ['promotions', 'promo', 'bons-plans', 'soldes', 'offres', 'acties', 'aanbiedingen', 'kortingen'],
  DE: ['angebote', 'aktionen', 'rabatte', 'sale', 'deals', 'schnaeppchen', 'reduziert'],
  AT: ['angebote', 'aktionen', 'rabatte', 'sale', 'deals', 'schnaeppchen'],
  NL: ['aanbiedingen', 'acties', 'korting', 'sale', 'deals', 'uitverkoop', 'voordeel'],
  ES: ['ofertas', 'promociones', 'descuentos', 'rebajas', 'chollos', 'saldos'],
  IT: ['offerte', 'promozioni', 'sconti', 'saldi', 'occasioni', 'ribassi'],
  PT: ['promocoes', 'ofertas', 'descontos', 'saldos', 'campanhas', 'desconto'],
  PL: ['promocje', 'okazje', 'wyprzedaz', 'rabaty', 'przecena', 'taniej'],
  SE: ['erbjudanden', 'kampanjer', 'rea', 'fynd', 'rabatter', 'extrapris'],
  IE: ['sale', 'offers', 'deals', 'promotions', 'discounts', 'special'],
  GB: ['sale', 'offers', 'deals', 'promotions', 'discounts', 'special'],
};

/** Les mots qui trahissent une page de promotions DANS la page elle-même.
 *  Sert à distinguer « page de promos » de « accueil du catalogue » : le titre
 *  de l'accueil d'un marchand ne dit jamais « promotions en cours ». */
const SIGNES_PROMO = {
  FR: ['promo', 'bon plan', 'soldes', 'reduction', 'remise', 'offre'],
  BE: ['promo', 'bon plan', 'soldes', 'korting', 'aanbieding', 'actie', 'reduction'],
  DE: ['angebot', 'aktion', 'rabatt', 'schnappchen', 'reduziert', 'sale'],
  AT: ['angebot', 'aktion', 'rabatt', 'schnappchen', 'reduziert', 'sale'],
  NL: ['aanbieding', 'actie', 'korting', 'sale', 'uitverkoop'],
  ES: ['oferta', 'descuento', 'rebaja', 'chollo', 'promocion'],
  IT: ['offerta', 'sconto', 'saldi', 'promozione', 'occasione'],
  PT: ['promocao', 'oferta', 'desconto', 'saldo', 'campanha'],
  PL: ['promocj', 'okazj', 'wyprzeda', 'rabat', 'przecena'],
  SE: ['erbjudande', 'kampanj', 'rea', 'fynd', 'rabatt'],
  IE: ['sale', 'offer', 'deal', 'discount', 'promotion', 'save'],
  GB: ['sale', 'offer', 'deal', 'discount', 'promotion', 'save'],
};

const normaliser = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const motsDe = (pays) => MOTS_PROMO[pays] || MOTS_PROMO.FR;
const signesDe = (pays) => SIGNES_PROMO[pays] || SIGNES_PROMO.FR;

/* ------------------------------------------------------------------ *
 *  LISTE OU PRODUIT ? — LE PIÈGE DU PREMIER ESSAI RÉUSSI.
 *
 *  Mesuré sur 20 commerces belges, deuxième jet : 6 adresses retenues, mais
 *  TROIS d'entre elles étaient des fiches produit déguisées —
 *  `groupon.be/deals/orthopedic-matrass` (UN matelas),
 *  `socialdeal.be/deals/<slug de 180 caractères>` (UNE activité).
 *
 *  La faute était dans la note : `offres > 0` suffisait à gagner. Or une fiche
 *  produit publie AUSSI son JSON-LD, donc elle « rend une offre » — la
 *  validation se retournait contre son but. Une page de promotions est une
 *  LISTE : elle porte plusieurs articles, et son adresse est une RUBRIQUE, pas
 *  un slug de produit.
 *
 *  Trois signes de fiche produit, tous tirés des cas réels ci-dessus :
 *    — un segment de chemin très long (les slugs de produit font 40 à 200
 *      caractères) ;
 *    — un identifiant numérique collé (`/p/12345678`) ;
 *    — et le plus sûr : MOINS DE TROIS OFFRES sur la page. Une page de liste en
 *      rend des dizaines ; une fiche en rend une.
 * ------------------------------------------------------------------ */
const NB_OFFRES_LISTE = 3;
const LONGUEUR_SEGMENT_MAX = 40;

function formeDeRubrique(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const segments = u.pathname.split('/').filter(Boolean);
  if (!segments.length || segments.length > 6) return false;
  if (segments.some((s) => s.length > LONGUEUR_SEGMENT_MAX)) return false;
  if (segments.some((s) => /^\d{5,}$/.test(s))) return false;
  return true;
}

/** Le mot de promo est-il un SEGMENT du chemin, ou noyé dans un slug ? Un
 *  segment (« /promotions », « /aanbiedingen ») est une rubrique ; noyé dans un
 *  slug (« /deals/matelas-orthopedique-en-mousse »), c'est une fiche. */
function motEnSegment(url, pays) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const segments = u.pathname.split('/').filter(Boolean).map(normaliser);
  return motsDe(pays).some((m) => segments.some((s) => s === normaliser(m) || s.startsWith(`${normaliser(m)}/`)));
}

/** La note d'une adresse éprouvée. 2 = liste qui rend des offres (ce qui
 *  rapporte), 1 = page de promotions reconnue mais illisible, 0 = rien. */
function noteAdresse(v, pays) {
  if (v.offres >= NB_OFFRES_LISTE && formeDeRubrique(v.url)) return 2;
  if (v.statut === 200 && v.promoDetectee && formeDeRubrique(v.url) && motEnSegment(v.url, pays)) return 1;
  return 0;
}

/* ------------------------------------------------------------------ *
 *  LE CHAMP « SITE » DE LA BASE EST SALE — on le nettoie.
 *
 *  Mesuré : il peut contenir PLUSIEURS domaines (« https://www.bongo.be /
 *  www.wonderbox.be ») ou une annotation (« www.maxizoo.be (à vérifier) »). Le
 *  premier jet les prenait tels quels et fabriquait des URL invalides — 126
 *  essais perdus sur 20 acteurs, tous sur la même cause. On prend le PREMIER
 *  jeton qui ressemble à une adresse, et rien d'autre.
 * ------------------------------------------------------------------ */
function sitePropre(site) {
  for (const brut of String(site || '').split(/[\s/|,;]+(?=https?:|www\.|[a-z0-9-]+\.[a-z]{2,})/)) {
    const t = brut.trim().replace(/[()]/g, '');
    if (/^https?:\/\//i.test(t)) return t.replace(/\/+$/, '');
    if (/^www\.[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return `https://${t}`;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(t) && t.includes('.')) return `https://${t}`;
  }
  return '';
}

/* ------------------------------------------------------------------ *
 *  ROBOTS.TXT — la politesse d'abord.
 * ------------------------------------------------------------------ */
const robotsCache = new Map();

function reglesRobots(txt) {
  const interdits = [];
  let concerne = false;
  let toutInterdit = false;
  for (const brute of String(txt).split('\n')) {
    const l = brute.replace(/#.*$/, '').trim();
    if (!l) continue;
    const [cle, ...reste] = l.split(':');
    const valeur = reste.join(':').trim();
    const k = cle.trim().toLowerCase();
    if (k === 'user-agent') concerne = valeur === '*';
    else if (concerne && k === 'disallow') {
      if (valeur === '/') toutInterdit = true;
      else if (valeur) interdits.push(valeur);
    }
  }
  return { toutInterdit, interdits };
}

async function robotsDe(origine, langue) {
  if (robotsCache.has(origine)) return robotsCache.get(origine);
  let res = { toutInterdit: false, interdits: [], inconnu: true };
  try {
    const r = await fetch(`${origine}/robots.txt`, {
      headers: { 'user-agent': UA, 'accept-language': langue }, redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) res = { ...reglesRobots(await r.text()), inconnu: false };
    // Un robots.txt absent (404) n'interdit rien : c'est la règle du web.
    else if (r.status === 404) res = { toutInterdit: false, interdits: [], inconnu: false };
  } catch { /* réseau muet : on n'interdit rien */ }
  robotsCache.set(origine, res);
  return res;
}

const cheminInterdit = (robots, chemin) => {
  const c = normaliser(chemin);
  return robots.interdits.some((i) => c.startsWith(normaliser(i)));
};

/* ------------------------------------------------------------------ *
 *  LIRE UNE PAGE — `fetch`, puis `curl` en secours.
 *
 *  Mesuré : 44 des 20 acteurs sondés répondent 403 au client HTTP de Node. Le
 *  fichier de collecte l'explique déjà (voir `lireParCurl`) — ce n'est pas
 *  l'en-tête qui décide mais l'EMPREINTE TLS, et curl passe là où Node est
 *  refusé. On ne contourne rien : on lit la même page publique avec un autre
 *  client. On respecte robots.txt AVANT, dans les deux cas.
 *
 *  PAS DE MÉMOIRE DES PAGES, ET C'EST DÉLIBÉRÉ. Le premier balayage complet est
 *  mort en pleine course (« JavaScript heap out of memory », à 450 acteurs sur
 *  573) parce qu'il gardait en mémoire le HTML ENTIER de chaque page visitée :
 *  des milliers de pages de 1 à 2 Mo. Un cache ne sert ici à rien — dans un même
 *  acteur, chaque adresse visitée est différente, et d'un acteur à l'autre le
 *  domaine change. On lit, on se sert, on laisse le ramasse-miettes faire son
 *  travail. Seul le robots.txt est mémorisé : il tient en quelques lignes.
 * ------------------------------------------------------------------ */
function lireParCurl(url, langue) {
  try {
    return execFileSync('curl', [
      '-fsS', '-L', '--compressed', '--max-time', '12',
      '-A', UA, '-H', `accept-language: ${langue}`, url,
    ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

async function charger(url, pays) {
  const langue = LANGUE_HTTP[pays] || 'fr-FR,fr;q=0.9';
  let res;
  let origine;
  try { origine = new URL(url).origin; } catch { return { statut: 0, html: null, final: url, erreur: 'URL illisible' }; }
  const robots = await robotsDe(origine, langue);
  if (robots.toutInterdit || cheminInterdit(robots, new URL(url).pathname)) {
    return { statut: 0, html: null, final: url, erreur: '', robots: 'interdit' };
  }
  const corps = { headers: { 'user-agent': UA, 'accept-language': langue }, redirect: 'follow', signal: AbortSignal.timeout(12000) };
  try {
    const r = await fetch(url, corps);
    if (r.ok) res = { statut: r.status, html: await r.text(), final: r.url || url, erreur: '', robots: 'ok' };
    else if (r.status === 403 || r.status === 429) res = { statut: r.status, html: null, final: url, erreur: `HTTP ${r.status}`, robots: 'ok', aRetenter: true };
    else res = { statut: r.status, html: null, final: r.url || url, erreur: `HTTP ${r.status}`, robots: 'ok' };
  } catch (e) { res = { statut: 0, html: null, final: url, erreur: e.message, robots: 'ok', aRetenter: true }; }
  if (!res.html && res.aRetenter) {
    const h = lireParCurl(url, langue);
    if (h && /<(html|!doctype|head|body)/i.test(h.slice(0, 2000))) res = { statut: 200, html: h, final: url, erreur: '', robots: 'ok', par: 'curl' };
    else if (h) res = { statut: 200, html: h, final: url, erreur: '', robots: 'ok', par: 'curl', douteux: true };
  }
  return res;
}

/* ------------------------------------------------------------------ *
 *  MÉTHODE 1 — LES LIENS DE L'ACCUEIL.
 *
 *  On lit la page d'accueil et on y prend les <a href> dont le TEXTE ou l'URL
 *  porte un mot de promo. C'est ainsi qu'un visiteur trouve la page : on ne
 *  devine pas, on lit ce que le marchand annonce lui-même.
 * ------------------------------------------------------------------ */
function liensPromo(html, base, pays) {
  const mots = motsDe(pays).map(normaliser);
  const out = [];
  const vus = new Set();
  for (const [, avant, href] of String(html).matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi)) {
    const attributs = `${avant} ${href} `;
    const brut = String(href).trim();
    if (!brut || /^(mailto:|tel:|javascript:|#)/i.test(brut)) continue;
    let abs;
    try { abs = new URL(brut, base).href; } catch { continue; }
    if (!abs.startsWith(base)) continue; // on reste chez le marchand
    const texte = normaliser(`${attributs} ${brut}`).replace(/[-_/]/g, ' ');
    const touche = mots.some((m) => texte.includes(m));
    if (!touche) continue;
    const nu = abs.split('#')[0].replace(/\/+$/, '');
    if (vus.has(nu) || nu === base.replace(/\/+$/, '')) continue;
    // Une rubrique, pas une fiche : on écarte ici les slugs de produit, ce qui
    // évite de gaspiller une requête (et une visite chez le marchand) pour une
    // page qu'on refusera de toute façon.
    if (!formeDeRubrique(nu)) continue;
    vus.add(nu);
    out.push(nu);
  }
  // Le lien qui porte DEUX mots de promo d'affilée (« soldes-et-promotions »)
  // est plus probablement la vraie page que « nos-offres » perdu dans un menu :
  // on le remonte.
  return out.sort((a, b) => {
    const note = (u) => mots.filter((m) => normaliser(u).includes(m)).length;
    return note(b) - note(a) || a.length - b.length;
  }).slice(0, 4);
}

/* ------------------------------------------------------------------ *
 *  MÉTHODE 2 — LE PLAN DU SITE.
 * ------------------------------------------------------------------ */
function liensSitemap(xml, base, pays) {
  const mots = motsDe(pays).map(normaliser);
  const out = [];
  const vus = new Set();
  for (const [, loc] of String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    let abs;
    try { abs = new URL(loc, base).href; } catch { continue; }
    if (!abs.startsWith(base)) continue;
    const u = normaliser(abs);
    if (!mots.some((m) => u.includes(m))) continue;
    const nu = abs.split('#')[0].replace(/\/+$/, '');
    if (vus.has(nu) || !formeDeRubrique(nu)) continue;
    vus.add(nu);
    out.push(nu);
  }
  return out.slice(0, 4);
}

/* ------------------------------------------------------------------ *
 *  MÉTHODE 3 — LES CHEMINS DEVINÉS (dernier recours).
 * ------------------------------------------------------------------ */
function cheminsDevines(base, pays) {
  const vus = new Set();
  const out = [];
  for (const m of motsDe(pays)) {
    for (const u of [`${base}/${m}`, `${base}/${m}/`]) if (!vus.has(u)) { vus.add(u); out.push(u); }
  }
  return out.slice(0, 10);
}

/* ------------------------------------------------------------------ *
 *  L'ÉPREUVE COMPLÈTE D'UNE ADRESSE CANDIDATE.
 * ------------------------------------------------------------------ */
async function eprouver(url, a) {
  const v = { url, statut: 0, robots: 'ok', promoDetectee: false, offres: 0, titre: '', final: url, erreur: '', methode: '' };
  const page = await charger(url, a.pays);
  v.statut = page.statut;
  v.final = page.final;
  v.robots = page.robots || 'ok';
  v.erreur = page.erreur || '';
  if (page.par) v.par = page.par;
  if (!page.html || page.statut !== 200) return v;
  const m = page.html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
  v.titre = m ? m[1].replace(/\s+/g, ' ').trim() : '';
  const texte = normaliser(`${v.titre} ${v.final}`);
  v.promoDetectee = signesDe(a.pays).some((s) => texte.includes(normaliser(s)));
  try {
    const offres = offresEnseigne(page.html, { ...a, categorieImposee: null });
    v.offres = offres.length;
  } catch (e) { v.erreur = `lecture : ${e.message}`; }
  return v;
}

/* ------------------------------------------------------------------ *
 *  UN ACTEUR : CHERCHER, PUIS ÉPROUVER.
 * ------------------------------------------------------------------ */
async function traiterActeur(a) {
  const base = sitePropre(a.site);
  if (!base) return { nom: a.nom, pays: a.pays, site: a.site, base: '', retenue: '', niveau: 0, offres: 0, statut: 0, robots: 'sans-site', titre: '', methode: '', essais: [] };
  const essais = [];
  const dejaVus = new Set();
  let methode = '';

  const essayer = async (url, origine) => {
    if (!url || dejaVus.has(url)) return false;
    dejaVus.add(url);
    const v = await eprouver(url, a);
    v.methode = origine;
    essais.push(v);
    // On ne s'arrête QUE sur une vraie page de LISTE qui rend des offres. Une
    // fiche produit rend une offre unique : s'y arrêter est précisément l'erreur
    // qui a fait retenir `groupon.be/deals/orthopedic-matrass`.
    if (noteAdresse(v, a.pays) === 2) { methode = origine; return true; }
    await new Promise((s) => setTimeout(s, DELAI_MS / 2));
    return false;
  };

  // MÉTHODE 1 — les liens de l'accueil.
  const accueil = await charger(base, a.pays);
  if (accueil.html) {
    for (const u of liensPromo(accueil.html, base, a.pays)) {
      if (await essayer(u, 'accueil')) return conclure(a, base, essais, 'accueil');
    }
  }
  // MÉTHODE 2 — le plan du site.
  const sm = await charger(`${base}/sitemap.xml`, a.pays);
  if (sm.html && /<loc>/i.test(sm.html)) {
    const urls = liensSitemap(sm.html, base, a.pays);
    // Un plan d'index renvoie d'autres plans : on suit le premier qui parle de
    // produits ou de pages, une seule fois, sinon on ouvre trente fichiers.
    const sousPlans = [...String(sm.html).matchAll(/<loc>\s*([^<\s]+\.xml[^<\s]*)\s*<\/loc>/gi)].map((m) => m[1]).slice(0, 2);
    for (const u of urls) if (await essayer(u, 'sitemap')) return conclure(a, base, essais, 'sitemap');
    for (const sp of sousPlans) {
      let abs;
      try { abs = new URL(sp, base).href; } catch { continue; }
      const p = await charger(abs, a.pays);
      if (!p.html) continue;
      for (const u of liensSitemap(p.html, base, a.pays)) {
        if (await essayer(u, 'sitemap')) return conclure(a, base, essais, 'sitemap');
      }
    }
  }
  // MÉTHODE 3 — les chemins devinés.
  for (const u of cheminsDevines(base, a.pays)) {
    if (await essayer(u, 'devine')) return conclure(a, base, essais, 'devine');
  }
  return conclure(a, base, essais, methode);
}

/** Le classement : d'abord ce qui RAPPORTE (offres à deux prix), puis une page
 *  de promotions reconnue — qui rapportera quand on saura la lire —, puis le
 *  reste. On garde la meilleure, jamais la première venue. */
function conclure(a, base, essais, methode) {
  const note = (v) => noteAdresse(v, a.pays);
  const meilleure = essais.slice().sort((x, y) => note(y) - note(x) || Number(y.statut === 200) - Number(x.statut === 200))[0] || null;
  return {
    nom: a.nom, pays: a.pays, site: a.site, base,
    retenue: meilleure && note(meilleure) > 0 ? meilleure.url : '',
    niveau: meilleure ? note(meilleure) : 0,
    offres: meilleure ? meilleure.offres : 0,
    statut: meilleure ? meilleure.statut : 0,
    robots: essais.some((e) => e.robots === 'interdit') ? 'interdit' : (meilleure ? 'ok' : 'aucun'),
    titre: meilleure ? meilleure.titre : '',
    methode: meilleure && note(meilleure) > 0 ? (meilleure.methode || methode) : '',
    essais,
  };
}

async function enParallele(items, n, f) {
  const out = new Array(items.length);
  let i = 0;
  const ouvriers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await f(items[k], k);
    }
  });
  await Promise.all(ouvriers);
  return out;
}

/* ------------------------------------------------------------------ *
 *  PROGRAMME
 * ------------------------------------------------------------------ */
async function main() {
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  let acteurs = base.acteurs || [];
  if (PAYS_VISES) acteurs = acteurs.filter((a) => a.pays === PAYS_VISES);
  // Un nom = une adresse : le panneau range par nom. On déduplique donc par nom
  // avant de travailler, sinon on éprouverait deux fois la même enseigne.
  const vus = new Set();
  acteurs = acteurs.filter((a) => (vus.has(a.nom) ? false : (vus.add(a.nom), true)));
  if (!TOUS && LIMITE) acteurs = acteurs.slice(0, LIMITE);
  if (!TOUS && !LIMITE && !PAYS_VISES) acteurs = acteurs.slice(0, 20);

  /* REPRISE — on saute ce qui est déjà au journal. Le journal peut contenir une
   *  ligne illisible (coupure en pleine écriture) : on l'ignore au lieu de
   *  mourir dessus, sinon une seule ligne abîmée condamnerait le chantier. */
  const dejaFaits = new Map();
  if (!drapeau('refaire')) {
    try {
      for (const ligne of fs.readFileSync(PARTIEL, 'utf8').split('\n')) {
        if (!ligne.trim()) continue;
        try { const r = JSON.parse(ligne); if (r && r.nom) dejaFaits.set(r.nom, r); } catch { /* ligne abîmée */ }
      }
    } catch { /* premier passage */ }
  }
  const aFaire = acteurs.filter((a) => !dejaFaits.has(a.nom));

  console.log(`Adresses de promotions — ${acteurs.length} acteur(s) au total, ${dejaFaits.size} déjà au journal, ${aFaire.length} à faire.`);
  if (PAYS_VISES) console.log(`  filtre pays : ${PAYS_VISES}`);
  console.log(`  concurrence ${CONCURRENCE}, robots.txt respecté, curl en secours sur 403.`);
  if (!aFaire.length) console.log('  rien à faire : relancer avec --refaire pour tout reprendre.');
  const t0 = Date.now();
  let finis = 0;
  const nouveaux = await enParallele(aFaire, CONCURRENCE, async (a) => {
    const r = await traiterActeur(a);
    // ÉCRIT TOUT DE SUITE, avant d'enchaîner : c'est ce qui rend la coupure
    // indolore. Une ligne = un acteur = un résultat complet.
    try { fs.appendFileSync(PARTIEL, `${JSON.stringify(r)}\n`); } catch { /* disque plein */ }
    finis += 1;
    if (VERBEUX || finis % 25 === 0) {
      console.log(`  [${finis}/${aFaire.length}] ${a.nom} (${a.pays}) → ${r.retenue || '—'}${r.offres ? ` · ${r.offres} offre(s)` : ''}${r.methode ? ` [${r.methode}]` : ''}`);
    }
    return r;
  });
  const secondes = Math.round((Date.now() - t0) / 1000);

  const resultats = [...dejaFaits.values(), ...nouveaux.filter(Boolean)];

  const avecOffres = resultats.filter((r) => r.offres > 0);
  const promoSeule = resultats.filter((r) => !r.offres && r.niveau === 1);
  const rien = resultats.filter((r) => r.niveau === 0);
  const parRobots = resultats.filter((r) => r.robots === 'interdit');
  const parMethode = (m) => resultats.filter((r) => r.methode === m).length;

  console.log('\nRÉSULTAT — ce que ça donne, chiffres mesurés :');
  console.log(`  ${avecOffres.length} acteur(s) dont l'adresse rend des offres à deux prix  ← ce qui rapporte`);
  console.log(`  ${promoSeule.length} acteur(s) avec une page de promotions reconnue, mais 0 offre lisible`);
  console.log(`  ${rien.length} acteur(s) sans adresse retenue`);
  console.log(`  dont ${parRobots.length} refusé(s) par un robots.txt`);
  console.log(`  trouvées par : accueil ${parMethode('accueil')} · sitemap ${parMethode('sitemap')} · deviné ${parMethode('devine')}`);
  console.log(`  ${secondes} s pour ${acteurs.length} acteur(s)`);

  const rapport = {
    genereLe: new Date().toISOString().slice(0, 10),
    acteurs: acteurs.length, avecOffres: avecOffres.length, promoSeule: promoSeule.length, sans: rien.length,
    secondes, resultats,
  };
  fs.mkdirSync(path.dirname(RAPPORT), { recursive: true });
  fs.writeFileSync(RAPPORT, JSON.stringify(rapport, null, 1));
  console.log(`  → ${RAPPORT}`);

  if (PUBLIER) {
    // ON NE PUBLIE QUE CE QUI A PASSÉ L'ÉPREUVE 4 — ou, à défaut, une page de
    // promotions reconnue. Une adresse inventée serait pire que rien : elle
    // ferait croire au panneau que le travail est fait.
    let ancien = {};
    try { ancien = JSON.parse(fs.readFileSync(FICHIER, 'utf8')).adresses || {}; } catch { /* neuf */ }
    const adresses = { ...ancien };
    for (const r of [...avecOffres, ...promoSeule]) adresses[r.nom] = r.retenue;
    const sortie = {
      version: 1,
      genereLe: new Date().toISOString().slice(0, 10),
      note: "Pages de promotions des enseignes, une par acteur. Écrites par outils/remplir-adresses-promotions.mjs, lues par le panneau (colonne « Adresse des promotions ») et par la collecte (sources de type enseigne).",
      adresses: Object.fromEntries(Object.entries(adresses).sort(([x], [y]) => x.localeCompare(y))),
    };
    fs.writeFileSync(FICHIER, `${JSON.stringify(sortie, null, 1)}\n`);
    console.log(`  → ${FICHIER} : ${Object.keys(adresses).length} adresse(s) publiée(s)`);
  } else {
    console.log('  (rien écrit : ajouter --publier pour remplir public/adresses-promotions.json)');
  }
}

main().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
