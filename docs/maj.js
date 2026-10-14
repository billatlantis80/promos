/**
 * APPLICATION N°2 — la fraîcheur des données, et quand les recharger.
 *
 * DÉFAUT MESURÉ, 09/10/2026 au soir, signalé par B : « l'application n'a plus
 * fait de mise à jour depuis plus de 3 heures ». Le compteur disait vrai — mais
 * pas pour la raison qu'on croyait, et la vraie raison est pire.
 *
 * L'application charge le catalogue UNE SEULE FOIS, au démarrage, et ne le
 * rafraîchit JAMAIS ensuite : ni par minuterie, ni au retour sur l'onglet. Le
 * compteur « mis à jour il y a X » ne mesure donc pas l'âge de la collecte : il
 * mesure l'âge du CHARGEMENT. Une application restée ouverte — ou un onglet
 * laissé là — annonce « il y a 3 h » alors que le site est à jour à la minute.
 * Ce soir-là, il y avait bien une panne réelle de 44 minutes (le collecteur
 * dépassait le délai du planificateur) ; mais le compteur, lui, en annonçait
 * déjà trois heures. Les deux se confondaient.
 *
 * C'est la pire espèce de défaut : il annonce une panne quand il n'y en a pas,
 * et à force de crier au loup on ne le croit plus — le jour où la panne est
 * réelle, personne ne regarde. C'est exactement la leçon du cron silencieux,
 * corrigé la veille.
 *
 * LE REMÈDE, ET POURQUOI CELUI-LÀ. Deux contraintes opposées :
 *   — il FAUT rafraîchir, sinon le compteur ment ;
 *   — il ne faut PAS télécharger pour rien : le catalogue pèse 13 Mo, et le
 *     projet porte une règle d'économie de données que B a explicitement
 *     demandée, mode dédié compris.
 *
 * On lit donc d'abord un TÉMOIN de quelques centaines d'octets, publié à côté
 * du catalogue (`etat-collecte.json`), qui ne porte que la date de collecte et
 * deux compteurs. Sa date est celle qu'on a déjà ? On ne télécharge RIEN. Elle a
 * changé ? Alors, et alors seulement, le catalogue est rechargé.
 *
 * QUAND ON VÉRIFIE : au RETOUR au premier plan (application reprise, onglet
 * réactivé), pas en boucle. Vérifier pendant que personne ne regarde ne sert à
 * rien et consomme ; vérifier au moment où l'utilisateur revient est exactement
 * le moment où l'information doit être juste.
 *
 * EN MODE ÉCONOMIE DE DONNÉES, ON NE FAIT RIEN. C'est un choix explicite de
 * l'utilisateur ; le contourner en silence, même pour trois cents octets, serait
 * la petite trahison que ce projet s'interdit.
 *
 * TOUT CE QUI DÉCIDE VIT ICI, séparé du réseau et de l'horloge, pour pouvoir
 * être éprouvé sur des cas fabriqués — voir `tests/maj.test.mjs`.
 */

/** Le nom du fichier témoin, publié à côté du catalogue. */
export const FICHIER_TEMOIN = 'etat-collecte.json';

/** Deux contrôles à moins de cinq minutes d'intervalle n'apportent rien : la
 *  collecte elle-même tourne toutes les cinq minutes. Seule exception, gérée
 *  par l'appelant : le tout premier contrôle après un chargement, où l'on veut
 *  pouvoir constater vite que quelque chose a bougé. */
export const DELAI_CONTROLE_MS = 5 * 60 * 1000;

/** La date portée par un témoin, ou '' si le témoin est absent, tronqué ou
 *  illisible. Ne lève JAMAIS : un témoin abîmé ne doit pas casser
 *  l'application. Au pire on ne rafraîchit pas — c'est l'état d'avant, jamais
 *  pire. */
export function dateDuTemoin(texte) {
  try {
    const d = JSON.parse(texte);
    const t = d && typeof d.genereLe === 'string' ? d.genereLe : '';
    return Number.isFinite(new Date(t).getTime()) ? t : '';
  } catch { return ''; }
}

/** Peut-on seulement aller regarder le témoin ? Deux raisons de ne même pas
 *  essayer : l'utilisateur a demandé l'économie de données, ou l'on vient de
 *  regarder il y a moins de `delaiMs`.
 *
 *  `depuisMs` vaut `Infinity` quand aucun contrôle n'a encore eu lieu : la
 *  comparaison laisse alors passer, ce qui est voulu. */
export function peutControler({ eco = false, depuisMs = Infinity, delaiMs = DELAI_CONTROLE_MS } = {}) {
  if (eco) return false;
  return !(Number.isFinite(depuisMs) && depuisMs < delaiMs);
}

/** Le témoin dit-il autre chose que ce qu'on a déjà en mémoire ? C'est LA règle
 *  qui décide du téléchargement de 13 Mo : elle ne l'autorise que sur une date
 *  STRICTEMENT différente, et jamais sur un témoin muet. */
export function doitRafraichir({ dateLocale = '', dateTemoin = '' } = {}) {
  if (!dateTemoin) return false;
  return dateTemoin !== dateLocale;
}
