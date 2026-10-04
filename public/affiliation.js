/**
 * APPLICATION N°2 — couche d'affiliation.
 *
 * RÈGLE (héritée de l'application n°1, décidée par l'utilisateur) :
 * L'IDENTIFIANT D'AFFILIATION EST CELUI DU PROPRIÉTAIRE DE L'APP. Il est
 * intégré au code, JAMAIS demandé à l'utilisateur final : celui-ci voit
 * simplement un bouton « Voir l'offre » qui lui ouvre le marchand.
 *
 * Tant qu'un identifiant est vide, le lien part SANS identifiant — jamais de
 * lien cassé, jamais de faux paramètre. Remplir les deux constantes ci-dessous
 * suffit à activer la rémunération, sans toucher au reste du code.
 */

/* 1. Amazon Partenaires — coller TON identifiant de suivi, ex. « monid-21 ». */
export const AMAZON_TAG = '';

/* 2. Réseaux d'affiliation (Awin, Effiliation, Kwanko…) : un modèle de lien
      contenant {url} = l'adresse du marchand. Couvre les enseignes qui n'ont
      pas de programme Amazon, y compris la plupart des chaînes de bricolage. */
export const RESEAUX = [
  // { nom: 'Awin', modele: 'https://www.awin1.com/cread.php?awinmid=XXXX&awinaffid=YYYY&ued={url}' },
];

/* Marchands dont le lien peut porter le tag Amazon. */
const EST_AMAZON = /(^|\.)amazon\./i;

/** Ajoute l'identifiant Amazon sans jamais écraser un paramétrage existant. */
function habillerAmazon(url) {
  if (!AMAZON_TAG) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has('tag')) return url;          // déjà tagué : on n'y touche pas
    u.searchParams.set('tag', AMAZON_TAG);
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
export const affiliationActive = () => !!AMAZON_TAG || RESEAUX.some((r) => r && r.modele && r.modele.includes('{url}'));

/** Mention légale : obligatoire (DGCCRF + stores), et non négociable. */
export const MENTION_AFFILIATION = affiliationActive()
  ? "Certains liens de cette page sont des liens affiliés : si tu achètes, une commission nous est versée par le marchand. Le prix que tu paies ne change pas."
  : "Cette version ne contient pas encore d'identifiant d'affiliation : les liens sortants sont directs, sans commission.";
