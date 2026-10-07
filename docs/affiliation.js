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

import { t } from './langues.js';

/* 1. Amazon Partenaires — UN identifiant PAR marché.
      Coller ici l'identifiant de suivi fourni par chaque programme national.
      Laisser vide tant que le programme n'est pas ouvert : les liens de ce
      pays sortiront alors en direct, sans commission. */
export const AMAZON_TAGS = {
  'amazon.fr': '',      // France
  'amazon.de': '',      // Allemagne
  'amazon.it': '',      // Italie
  'amazon.es': '',      // Espagne
  'amazon.nl': '',      // Pays-Bas
  'amazon.com.be': '',  // Belgique — notre marché
  'amazon.co.uk': '',   // Royaume-Uni
  'amazon.ie': '',      // Irlande
  'amazon.se': '',      // Suède
  'amazon.pl': '',      // Pologne
};

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
export function lienAffilie(url, marchand = '') {
  if (!url) return url;
  if (EST_AMAZON.test(marchand) || EST_AMAZON.test(url)) return habillerAmazon(url);
  const parReseau = habillerReseau(url);
  return parReseau || url;
}

/** Vrai dès qu'au moins une source de rémunération est configurée. */
export const affiliationActive = () =>
  marchesAmazonActifs().length > 0
  || RESEAUX.some((r) => r && r.modele && r.modele.includes('{url}'));

/** Mention légale : obligatoire (DGCCRF + stores), et non négociable.
 *
 *  C'est une FONCTION, pas une constante. Défaut corrigé le 08/10/2026 : elle
 *  était figée au chargement du module, en français, et ce fichier n'importait
 *  même pas le moteur de traduction — la mention s'affichait donc telle quelle
 *  dans les 9 langues, en bas de page, sans que rien ne le signale. Une
 *  fonction relue à chaque rendu suit le changement de langue.
 */
export const mentionAffiliation = () => (affiliationActive() ? t(MENTION_ACTIVE) : t(MENTION_DESACTIVEE));

const MENTION_ACTIVE = "Certains liens de cette page sont des liens affiliés : si tu achètes, une commission nous est versée par le marchand. Le prix que tu paies ne change pas.";
const MENTION_DESACTIVEE = "Cette version ne contient pas encore d'identifiant d'affiliation : les liens sortants sont directs, sans commission.";
