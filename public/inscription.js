/**
 * TABLEAU D'INSCRIPTION — le fichier à remplir, une seule ligne.
 * =============================================================================
 *
 * RÈGLE DU PROJET : aucune dépendance à un tiers, aucune clé d'API. Les adresses
 * collectées vont dans VOTRE tableau Google, sur VOTRE compte. Personne d'autre
 * ne les voit — ni nous, ni un prestataire, ni un traqueur.
 *
 * CE QU'IL FAUT FAIRE, UNE SEULE FOIS
 *   La marche à suivre complète est dans INSCRIPTION.md, à la racine du projet.
 *   Elle est écrite clic par clic, sans jargon. À la fin, Google vous donne une
 *   adresse qui ressemble à :
 *       https://script.google.com/macros/s/AKfycb..../exec
 *   Il suffit de la coller entre les guillemets ci-dessous, à la place du vide.
 *
 * TANT QUE C'EST VIDE, LE FORMULAIRE LE DIT.
 *   Il n'envoie rien et l'annonce clairement. Il ne fait pas semblant d'avoir
 *   enregistré une adresse : c'est la règle de la maison — un bouton qui ne
 *   peut pas marcher doit dire ce qui manque, pas échouer en silence.
 */

/** L'adresse du tableau Google, fournie par Apps Script. Laisser vide avant. */
export const URL_TABLEAU = '';

/** Clé de stockage : ce que l'appareil garde pour se souvenir de l'inscription. */
export const CLE_INSCRIPTION = 'promos.inscription';

/** L'adresse du tableau est-elle renseignée ? */
export function tableauConfigure() {
  return typeof URL_TABLEAU === 'string' && URL_TABLEAU.trim().length > 0;
}

/** Vrai si la chaîne ressemble à une adresse e-mail. Volontairement STRICT :
 *  une faute de frappe ici, et le contact est perdu sans que personne ne le
 *  sache. On préfère refuser une adresse douteuse que l'accepter à tort. */
export function adresseValide(texte) {
  const s = String(texte || '').trim();
  // Un seul @, quelque chose avant, un point après le @, pas d'espace.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

/**
 * Envoie une inscription au tableau.
 *
 * RETOUR — et ce qu'il veut dire exactement, sans embellissement :
 *   { ok: true }                  la demande EST PARTIE. On ne peut pas savoir
 *                                 si le tableau l'a reçue : voir ci-dessous.
 *   { ok: false, code: 'non-configure' }  l'adresse du tableau est vide.
 *   { ok: false, code: 'reseau' } l'envoi n'a pas pu partir.
 *
 * POURQUOI ON NE PEUT PAS CONFIRMER LA RÉCEPTION. Le tableau Google répond sans
 * autoriser la page à lire sa réponse (c'est le « no-cors » du navigateur). Le
 * navigateur sait donc seulement que la requête est partie sans erreur. Dire
 * « inscrit » serait un mensonge : on dit « envoyée ». Le seul contrôle fiable
 * est le vôtre — ouvrir la feuille et voir la ligne apparaître.
 */
export async function envoyerInscription({ email, prenom, langue, pays }) {
  if (!tableauConfigure()) return { ok: false, code: 'non-configure' };
  const corps = new URLSearchParams({
    email: String(email || '').trim().toLowerCase(),
    prenom: String(prenom || '').trim(),
    langue: String(langue || ''),
    pays: String(pays || ''),
    source: 'kazendra',
    envoye: new Date().toISOString(),
  });
  try {
    await fetch(URL_TABLEAU.trim(), { method: 'POST', mode: 'no-cors', body: corps });
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'reseau' };
  }
}

/** L'inscription retenue SUR CET APPAREIL (ou null). Sert à ne pas redemander. */
export function inscriptionLocale() {
  try {
    const brut = localStorage.getItem(CLE_INSCRIPTION);
    return brut ? JSON.parse(brut) : null;
  } catch (e) { return null; }
}

/** Retient l'inscription sur cet appareil. Rien n'est envoyé ici. */
export function retenirInscription(email, prenom) {
  try {
    localStorage.setItem(CLE_INSCRIPTION, JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      prenom: String(prenom || '').trim(),
      quand: new Date().toISOString(),
    }));
    return true;
  } catch (e) { return false; }
}

/** Oublie l'inscription sur cet appareil. Le tableau, lui, n'est PAS touché :
 *  se désinscrire vraiment demande de retirer la ligne de la feuille, ou de
 *  cliquer le lien de désinscription du message reçu. */
export function oublierInscription() {
  try { localStorage.removeItem(CLE_INSCRIPTION); return true; } catch (e) { return false; }
}
