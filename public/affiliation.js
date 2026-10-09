/**
 * APPLICATION N°2 — couche d'affiliation.
 *
 * RÈGLE (héritée de l'application n°1, décidée par l'utilisateur) :
 * L'IDENTIFIANT D'AFFILIATION EST CELUI DU PROPRIÉTAIRE DE L'APP. Il est
 * intégré au code, JAMAIS demandé à l'utilisateur final : celui-ci voit
 * simplement un bouton « Voir l'offre » qui lui ouvre le marchand.
 *
 * POURQUOI UN IDENTIFIANT PAR MARCHÉ — et pas un seul :
 * Amazon délivre un identifiant de suivi DISTINCT pour chaque programme
 * national (amazon.fr, amazon.de, amazon.com.be…). Un identifiant français
 * posé sur un lien allemand ne rapporte rien — le programme allemand ne le
 * reconnaît pas. Ce fichier ne portait avant qu'UNE constante unique
 * (AMAZON_TAG) : un seul pays était monétisable, tous les autres liens
 * partaient en clair. C'est ce que la table ci-dessous corrige.
 *
 * Règle de sûreté conservée, et même renforcée : tant qu'un marché n'a pas
 * d'identifiant, ses liens partent SANS tag — jamais de lien cassé, jamais de
 * paramètre faux, et JAMAIS l'identifiant d'un autre pays sur son lien.
 */

/* 1. Amazon Partenaires — UN identifiant PAR marché.
      Coller ici l'identifiant de suivi fourni par chaque programme national.
      Laisser vide tant que le programme n'est pas ouvert : les liens de ce
      pays sortiront alors en direct, sans commission. */
export const AMAZON_TAGS = {
  'amazon.fr': 'kazendra-21',  // France — partenariat ouvert le 09/10/2026
  'amazon.de': '',      // Allemagne
  'amazon.it': '',      // Italie
  'amazon.es': '',      // Espagne
  'amazon.nl': '',      // Pays-Bas
  'amazon.com.be': 'kazendra06-21',  // Belgique — partenariat ouvert le 09/10/2026
  'amazon.co.uk': '',   // Royaume-Uni
  'amazon.ie': '',      // Irlande
  'amazon.se': '',      // Suède
  'amazon.pl': '',      // Pologne
};

/* 1 bis. LA LANGUE DE LA BOUTIQUE OUVERTE.

   Demande de B (08/10/2026) : « Quand un utilisateur utilise kazendra en
   Français et qu'il est redirigé vers un autre site. On va prendre par exemple
   Amazon. Amazon doit être consulté en français. Le site doit s'adapter à la
   langue de l'utilisateur de l'appli. Si la langue n'existe pas ça sera
   l'anglais la base. »

   Le mécanisme : Amazon accepte un paramètre `language` dans l'adresse, et il
   répond dans cette langue QUAND la place de marché la propose. Sans ce
   paramètre, c'est le navigateur du visiteur qui décide — un lecteur français
   qui ouvre une offre allemande tombe sur une interface allemande.

   CE TABLEAU N'EST PAS DEVINÉ, IL EST MESURÉ. Chaque entrée a été vérifiée le
   08/10/2026 en interrogeant la place de marché et en lisant le `lang` du
   document renvoyé :

       amazon.com.be + fr_BE -> lang="fr-be"    amazon.com.be + nl_BE -> "nl-be"
       amazon.fr     + fr_FR -> lang="fr-fr"    amazon.de     + de_DE -> "de-de"
       amazon.es     + es_ES -> lang="es-es"    amazon.it     + it_IT -> "it-it"
       amazon.nl     + nl_NL -> lang="nl-nl"    amazon.se     + sv_SE -> "sv-se"
       amazon.pl     + pl_PL -> lang="pl-pl"    amazon.ie     + en_GB -> "en-ie"

   Et les LIMITES, mesurées elles aussi — c'est ce qui justifie le repli :

       amazon.de     + fr_FR -> lang="en-gb"    (le français n'existe pas sur .de)
       amazon.co.uk  + de_DE -> lang="en-gb"    (l'anglais seul sur .co.uk)
       amazon.fr     + de_DE -> lang="fr-fr"    (demandé, non offert : le local)

   C'est exactement la règle demandée : la langue du lecteur quand la boutique
   la propose, l'ANGLAIS sinon. */
export const AMAZON_LANGUES = {
  'amazon.com.be': { fr: 'fr_BE', nl: 'nl_BE', en: 'en_GB' },
  'amazon.fr':     { fr: 'fr_FR', en: 'en_GB' },
  'amazon.de':     { de: 'de_DE', en: 'en_GB' },
  'amazon.co.uk':  { en: 'en_GB' },
  'amazon.ie':     { en: 'en_GB' },
  'amazon.es':     { es: 'es_ES', en: 'en_GB' },
  'amazon.it':     { it: 'it_IT', en: 'en_GB' },
  'amazon.nl':     { nl: 'nl_NL', en: 'en_GB' },
  'amazon.se':     { sv: 'sv_SE', en: 'en_GB' },
  'amazon.pl':     { pl: 'pl_PL', en: 'en_GB' },
};

/** La langue de repli quand la place de marché n'offre pas celle du lecteur. */
export const LANGUE_REPLI_AMAZON = 'en_GB';

/* 2. Réseaux d'affiliation (Awin, Effiliation, Kwanko…) : un modèle de lien
      contenant {url} = l'adresse du marchand. Couvre les enseignes qui n'ont
      pas de programme Amazon, y compris la plupart des chaînes de bricolage. */
export const RESEAUX = [
  // { nom: 'Awin', modele: 'https://www.awin1.com/cread.php?awinmid=XXXX&awinaffid=YYYY&ued={url}' },
];

/* Marchands dont le lien peut porter un tag Amazon. */
const EST_AMAZON = /(^|\.)amazon\./i;

/** Hôte d'une adresse : minuscules, sans « www. ». '' si l'adresse est illisible. */
function hote(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

/**
 * Le marché Amazon auquel appartient une adresse, ou '' si aucun ne correspond.
 * On retient la clé LA PLUS LONGUE qui corresponde : si « amazon.com » devenait
 * un jour une clé, « amazon.com.be » doit continuer de l'emporter — sinon la
 * Belgique serait servie par l'identifiant du mauvais programme.
 */
export function marcheDe(url) {
  const h = hote(url);
  if (!h) return '';
  let trouve = '';
  for (const dom of Object.keys(AMAZON_TAGS)) {
    if ((h === dom || h.endsWith('.' + dom)) && dom.length > trouve.length) trouve = dom;
  }
  return trouve;
}

/**
 * Le NOM DU SITE Amazon visé par une adresse — « Amazon.com.be », « Amazon.fr »,
 * « Amazon.de »… ou '' si l'adresse ne mène pas à Amazon.
 *
 * Le bouton disait « Acheter sur Amazon » sans dire OÙ. Or la même phrase
 * envoyait vers dix marchés différents (Belgique, France, Allemagne, Italie…) :
 * un utilisateur belge ne pouvait pas savoir s'il allait commander chez
 * Amazon.com.be ou sur un site étranger, ni dans quelle langue il serait reçu.
 *
 * Le site est prélevé sur le LIEN RÉEL, jamais déduit du nom du marchand : c'est
 * la destination qui compte, et elle seule est vérifiable.
 */
export function siteAmazon(url) {
  const h = hote(url);
  if (!h || !EST_AMAZON.test(h)) return '';
  // « amazon.com.be » -> « Amazon.com.be », « amazon.co.uk » -> « Amazon.co.uk »
  return 'Amazon' + h.slice('amazon'.length);
}

/** Les marchés réellement ouverts (identifiant renseigné). */
export function marchesAmazonActifs() {
  return Object.keys(AMAZON_TAGS).filter((d) => String(AMAZON_TAGS[d] || '').trim());
}

/** Ajoute l'identifiant DU BON marché, sans jamais écraser un tag existant. */
function habillerAmazon(url) {
  const dom = marcheDe(url);
  if (!dom) return url;                                   // Amazon sans marché connu : on ne touche pas
  const tag = String(AMAZON_TAGS[dom] || '').trim();
  if (!tag) return url;                                   // marché non ouvert : lien direct, jamais de faux tag
  try {
    const u = new URL(url);
    if (u.searchParams.has('tag')) return url;            // déjà tagué : on n'y touche pas
    u.searchParams.set('tag', tag);
    return u.toString();
  } catch { return url; }
}

/** Enveloppe l'URL dans le premier réseau dont le domaine correspond. */
function habillerReseau(url) {
  for (const r of RESEAUX) {
    if (!r || !r.modele || !r.modele.includes('{url}')) continue;
    if (r.domaines && r.domaines.length && !r.domaines.some((d) => url.includes(d))) continue;
    return r.modele.replace('{url}', encodeURIComponent(url));
  }
  return null;
}

/**
 * Transforme l'adresse d'une offre en lien monétisé.
 * @param {string} url      adresse du marchand
 * @param {string} marchand nom du marchand (pour choisir la bonne règle)
 */
/** L'adresse d'une boutique Amazon, ouverte dans la langue du lecteur.
 *
 *  On ne touche PAS aux autres marchands : le paramètre `language` est propre à
 *  Amazon. Une enseigne ayant son propre mécanisme devra être traitée
 *  nommément — l'inventer pour tout le monde serait une devinette. */
export function langueAmazon(url, langueApp = '') {
  const dom = marcheDe(url);
  if (!dom) return url;
  const offre = AMAZON_LANGUES[dom];
  if (!offre) return url;
  const code = offre[langueApp] || LANGUE_REPLI_AMAZON;
  try {
    const u = new URL(url);
    u.searchParams.set('language', code);
    return u.toString();
  } catch { return url; }
}

export function lienAffilie(url, marchand = '', langueApp = '') {
  if (!url) return url;
  if (EST_AMAZON.test(marchand) || EST_AMAZON.test(url)) {
    // La LANGUE d'abord : `habillerAmazon` rend l'adresse inchangée tant
    // qu'aucun identifiant d'affiliation n'est posé — or le paramètre de
    // langue, lui, doit être ajouté dans TOUS les cas.
    return habillerAmazon(langueAmazon(url, langueApp));
  }
  const parReseau = habillerReseau(url);
  return parReseau || url;
}

/** Vrai dès qu'au moins une source de rémunération est configurée. */
export const affiliationActive = () =>
  marchesAmazonActifs().length > 0
  || RESEAUX.some((r) => r && r.modele && r.modele.includes('{url}'));

/** Mention légale : obligatoire (DGCCRF + stores), et non négociable.
 *
 *  Deux phrases selon que l'affiliation est ouverte ou non. Elles sont livrées
 *  NUES, en français (la clé du dictionnaire EST le texte français) : c'est
 *  app.js qui les passe à t() pour l'affichage, parce que ce fichier-ci reste
 *  SANS DÉPENDANCE — son test l'évalue tel quel, et un `import` y casserait le
 *  chargeur. Défaut corrigé le 08/10/2026 : la mention était une constante
 *  figée au chargement, en français, affichée telle quelle dans les 9 langues.
 */
export const MENTION_AFFILIATION_ACTIVE = "Certains liens de cette page sont des liens affiliés : si tu achètes, une commission nous est versée par le marchand. Le prix que tu paies ne change pas.";
export const MENTION_AFFILIATION_INACTIVE = "Cette version ne contient pas encore d'identifiant d'affiliation : les liens sortants sont directs, sans commission.";
