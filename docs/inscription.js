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
 *   Il suffit de la coller dans `public/relais.js`, à la place du vide.
 *
 *   ⚠ LA LIGNE A DÉMÉNAGÉ LE 12/10/2026 — et c'est une correction, pas un
 *   rangement. Elle vivait ici, et le relevé de trafic avait la sienne, ailleurs
 *   (dans le stockage local du navigateur). Deux adresses pour un seul script,
 *   c'est deux endroits à faire tomber d'accord, et un seul oubli suffit à
 *   rendre muet un tuyau entier. Désormais le fichier `public/relais.js` porte
 *   L'UNIQUE adresse : inscriptions, visites et clics partent au même endroit.
 *
 * TANT QUE C'EST VIDE, LE FORMULAIRE LE DIT.
 *   Il n'envoie rien et l'annonce clairement. Il ne fait pas semblant d'avoir
 *   enregistré une adresse : c'est la règle de la maison — un bouton qui ne
 *   peut pas marcher doit dire ce qui manque, pas échouer en silence.
 */

import { adresseRelais } from './relais.js';

/** L'adresse du tableau Google, fournie par Apps Script. Elle vient DU FICHIER
 *  DU RELAIS : une seule ligne à remplir pour tout le site, jamais deux. */
export const URL_TABLEAU = adresseRelais();

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
export async function envoyerInscription({ email, langue, pays }, adresse = URL_TABLEAU) {
  if (!String(adresse || '').trim()) return { ok: false, code: 'non-configure' };
  // GARDE-FOU SUR LA LANGUE — posé le 13/10/2026 après un vrai dégât.
  //
  // Le formulaire a envoyé `langue` SANS PARENTHÈSES, alors que c'est une
  // FONCTION qui rend le code courant. `String(fn)` rend le TEXTE SOURCE de la
  // fonction : la feuille a reçu « () => », et le message de confirmation est
  // parti dans la langue de repli (l'anglais) sans que rien ne le signale.
  //
  // Un code de langue a DEUX LETTRES. Tout le reste est écarté ICI, à la
  // porte : mieux vaut une case vide et visible qu'une valeur qui a l'air
  // remplie. C'est la doctrine du projet — ce qui est illisible ne se devine
  // pas — et elle vaut pour un champ de formulaire comme pour une date.
  const codeLangue = String(langue || '').trim().toLowerCase();
  const corps = new URLSearchParams({
    email: String(email || '').trim().toLowerCase(),
    langue: /^[a-z]{2}$/.test(codeLangue) ? codeLangue : '',
    pays: String(pays || '').trim().toUpperCase().slice(0, 2),
    source: 'kazendra',
    // L'ADRESSE PUBLIQUE, DONNÉE AU SERVICE POUR SES PROPRES LIENS. Le script ne
    // peut pas la deviner : `ScriptApp.getService().getUrl()` peut rendre
    // l'adresse de « test » (`/dev`), qui n'ouvre que pour le propriétaire — et
    // le lien de confirmation menait alors à une page Google « Impossible
    // d'ouvrir le fichier » (constaté par B le 13/10/2026). Le site, lui, n'en
    // connaît qu'une : celle qui vient de fonctionner.
    relais: String(adresse).trim(),
    envoye: new Date().toISOString(),
  });
  try {
    await fetch(String(adresse).trim(), { method: 'POST', mode: 'no-cors', body: corps });
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'reseau' };
  }
}

/**
 * Demande la DÉSINSCRIPTION au tableau.
 *
 * POURQUOI ELLE PASSE PAR LE MÊME CHEMIN QUE L'INSCRIPTION. Le tableau sait
 * reconnaître une adresse : il retrouve sa ligne et la passe en « désinscrit »
 * (voir doPost dans outils/tableau-inscription.gs). La page, elle, n'a rien de
 * plus à savoir faire que d'envoyer l'adresse — et elle ne peut pas lire la
 * réponse du tableau (même « no-cors » que pour l'inscription).
 *
 * CE QUE ÇA VEUT DIRE POUR L'UTILISATEUR : « la demande est PARTIE », jamais
 * « tu es désinscrit ». Le seul contrôle fiable reste la feuille de calcul, ou
 * le lien de désinscription du message reçu.
 */
export async function envoyerDesinscription({ email }, adresse = URL_TABLEAU) {
  if (!String(adresse || '').trim()) return { ok: false, code: 'non-configure' };
  const corps = new URLSearchParams({
    demande: 'desinscription',
    email: String(email || '').trim().toLowerCase(),
    source: 'kazendra',
    envoye: new Date().toISOString(),
  });
  try {
    await fetch(String(adresse).trim(), { method: 'POST', mode: 'no-cors', body: corps });
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

/** Retient l'inscription sur cet appareil. Rien n'est envoyé ici.
 *
 *  Le STATUT est toujours « en-attente » : c'est la vérité au moment où l'on
 *  écrit cette ligne. La confirmation se passe dans l'e-mail, et la page ne peut
 *  pas savoir si le lien a été cliqué (elle ne peut pas lire la réponse du
 *  tableau Google). La seule source fiable du statut est la feuille de calcul —
 *  on ne prétend donc jamais, ici, qu'un compte est activé. */
export function retenirInscription(email) {
  try {
    localStorage.setItem(CLE_INSCRIPTION, JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      quand: new Date().toISOString(),
      statut: 'en-attente',
    }));
    return true;
  } catch (e) { return false; }
}

/** Oublie l'inscription sur cet appareil. Le tableau, lui, n'est PAS touché :
 *  se désinscrire vraiment demande de retirer la ligne de la feuille, ou de
 *  cliquer le lien de désinscription du message reçu — c'est ce que fait
 *  `envoyerDesinscription` ci-dessus, et c'est ce que le bouton de l'écran
 *  appelle en même temps que cet oubli. */
export function oublierInscription() {
  try { localStorage.removeItem(CLE_INSCRIPTION); return true; } catch (e) { return false; }
}
