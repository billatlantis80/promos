/**
 * LE RELAIS — l'adresse unique, et LA SEULE LIGNE À REMPLIR.
 * =============================================================================
 *
 * POURQUOI CE FICHIER EXISTE (défaut corrigé le 12/10/2026, demande de B :
 * « connecte les tuyaux afin que je puisse voir d'où viennent les utilisateurs »).
 *
 * L'adresse du relais était lue dans le stockage LOCAL du navigateur
 * (`localStorage['kazendra.relais']`). Conséquence mesurée : elle n'existe que
 * sur l'appareil où on l'a saisie. Les VISITEURS du site, eux, n'ont jamais eu
 * cette valeur — donc leur relevé de visite n'est JAMAIS parti, et le panneau
 * pouvait annoncer « Relais branché » tout en ne recevant rien. C'est
 * exactement la « promesse fausse » de la règle du tuyau : un champ que seul
 * son auteur remplit n'est pas un tuyau.
 *
 * LA CORRECTION. L'adresse est PUBLIÉE AVEC LE SITE, ici, lisible par chaque
 * visiteur comme par le panneau. Une seule ligne, un seul endroit. Le jour où
 * elle est remplie, tous les relevés partent — les visites comme les clics vers
 * les marchands.
 *
 * CE QUE CE FICHIER NE CONTIENT PAS, ET NE CONTIENDRA JAMAIS : la clé du
 * rapport. L'adresse est publique (n'importe qui peut y DÉPOSER un relevé —
 * c'est le principe d'un formulaire public) ; la LECTURE du rapport, elle, est
 * fermée par une clé que seul le propriétaire possède (voir INSCRIPTION.md).
 * Publier la clé ici reviendrait à publier ses chiffres de trafic.
 */

/** ⬇ LA LIGNE À REMPLIR. Laisser vide tant que le relais n'est pas déployé.
 *
 *  C'est exactement la même adresse que `URL_TABLEAU` (inscription.js) : un
 *  seul script Apps Script reçoit tout — inscriptions, visites, clics — et
 *  c'est ce même fichier-ci qui la porte désormais. Forme attendue :
 *
 *      https://script.google.com/macros/s/AKfycb..../exec
 */
export const URL_RELAIS = 'https://script.google.com/macros/s/AKfycbw_8HLvk0hX9G2ssh5WfoZRFalZ6L6clNEvls2BCiNFQ-fiohdyTIA1hH0TCz8uFnv_/exec';

/** L'adresse publiée, nettoyée. '' si elle n'est pas encore renseignée. */
export function adressePubliee() {
  return String(URL_RELAIS || '').trim();
}

/** Une adresse de diagnostic, posée sur CET appareil seulement (onglet
 *  Réglages). Elle ne sert qu'à essayer avant de publier : en ligne, c'est
 *  l'adresse publiée qui compte, parce que c'est la seule que les visiteurs
 *  reçoivent. Elle est donc utilisée UNIQUEMENT quand rien n'est publié. */
export function adresseDiagnostic() {
  try { return String(localStorage.getItem('kazendra.relais') || '').trim(); } catch { return ''; }
}

/** L'adresse réellement utilisée pour envoyer et pour lire. */
export function adresseRelais() {
  return adressePubliee() || adresseDiagnostic();
}

/** Vrai dès qu'un relais est joignable. */
export function relaisConfigure() {
  return adresseRelais().length > 0;
}

/** Une adresse qui a la FORME d'une adresse de relais. Sert à refuser une
 *  saisie manifestement fausse au lieu d'envoyer dans le vide : une adresse
 *  mal recopiée ne produit aucune erreur visible — juste un relais muet, et
 *  un panneau vide qu'on prendrait pour une absence de visiteurs. */
export function adressePlausible(a) {
  const t = String(a || '').trim();
  return /^https?:\/\/[^\s]+\.[^\s]+$/.test(t);
}

/** LE JETON DE LECTURE — la clé du rapport, gardée sur cet appareil.
 *
 *  ⚠ ELLE NE DOIT JAMAIS ÊTRE PUBLIÉE. Le service Web Apps Script est ouvert
 *  « à tout le monde » (il le faut : un visiteur doit pouvoir DÉPOSER son
 *  relevé). Sans clé, n'importe qui connaissant l'adresse — et elle est dans
 *  le code du site — lirait le trafic. Le rapport est donc refusé sans la clé,
 *  et la clé ne vit que dans le stockage local du propriétaire.
 *
 *  On la trouve en exécutant la fonction `test()` dans l'éditeur Apps Script
 *  (voir INSCRIPTION.md, étape 6). */
export function cleRapport() {
  try { return String(localStorage.getItem('kazendra.relaisCle') || '').trim(); } catch { return ''; }
}

export function poserCleRapport(v) {
  try { localStorage.setItem('kazendra.relaisCle', String(v || '').trim()); } catch { /* privé */ }
}

/** L'adresse d'ENVOI (visites, clics). Un POST sans clé : c'est un dépôt. */
export function urlEnvoi() {
  return adresseRelais();
}

/** L'adresse du RAPPORT — lecture, avec la clé. '' s'il n'y a pas de relais. */
export function urlRapport() {
  const a = adresseRelais();
  if (!a) return '';
  const cle = cleRapport();
  const sep = /[?&]/.test(a) ? '&' : '?';
  return `${a}${sep}rapport=panneau${cle ? `&cle=${encodeURIComponent(cle)}` : ''}`;
}
