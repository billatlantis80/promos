/* =============================================================================
   LA DÉCISION DE LA MAIN SUR UNE CARTE EFFACÉE — vérifier, ou remettre en ligne.

   Demande de B, 15/10/2026 :
   « Avant la colonne source, j'ai besoin d'une colonne avec deux boutons. Le
   premier bouton [...] elle disparaît de la liste [...]. Le deuxième bouton me
   permet de réactiver une annonce pour 1, 2, 3, 4 et 5 jours, manuellement et la
   faire réapparaître sur le site. » Puis, le même soir, la précision qui change le
   premier geste : « Si pour la programmation il est plus facile de garder des
   informations sur la carte même si je la supprime de la liste, tu peux le faire.
   Mon objectif de la supprimer de la liste, c'est pour confirmer qu'elle a été
   checker. »

   ⚠ CE N'EST DONC PAS UNE SUPPRESSION, C'EST UNE VÉRIFICATION. Le premier geste
   marque la carte comme VÉRIFIÉE et la retire de la liste — rien n'est effacé :
   la fiche de contrôle (le tour où la source a reparlé sans elle) et le compte de
   ses « retours » survivent dans le registre. Ce n'est pas un compromis de
   programmation : c'est préférable, parce que le compte des retours est le SEUL
   chiffre qui dise si la règle des cinq jours est trop dure, et il se serait vidé
   au fur et à mesure du nettoyage.

   POURQUOI CE FICHIER EXISTE. Le panneau est une page PUBLIÉE : il peut montrer,
   il ne peut rien décider. Un bouton qui n'écrit que dans le navigateur ne décide
   rien — c'est la « promesse fausse » déjà payée une fois sur ce projet. Les deux
   gestes s'écrivent donc dans UN FICHIER PUBLIÉ AVEC LE SITE,
   `public/verdicts-a-la-main.json`, que la collecte relit à chaque passage — sur
   le NAS comme dans le secours GitHub — et qui est donc COMMITÉ : la décision
   survit à un disque neuf et à un dépôt recloné.

   QUI L'ÉCRIT : `server.js`, route `POST /api/verdict-carte`, appelée par le
   panneau. Le fichier n'accepte une écriture que d'une page servie par ce
   serveur-là (en-tête `X-Panneau`) ; ouvert depuis kazendra.com, le panneau ne
   peut pas écrire et le DIT, au lieu de faire semblant.
   QUI LE LIT : `collecteur.mjs` (la marque de vérification et les sursis), et le
   panneau (pour retirer de sa liste ce qui est déjà décidé).

   TROIS GESTES, ET ILS S'EXCLUENT DEUX À DEUX — le dernier gagne :
   • VÉRIFIER   → la ligne quitte la liste ; la fiche reste, marquée `verifieeLe` ;
   • RÉACTIVER  → la carte revient sur le site pour 1 à 5 jours entiers ;
   • RETIRER    → le sursis est ramené à maintenant (la carte ressort, et ne rentre
                  que si une source la ressert — une republication est un fait).

   ⚠ LA MAIN NE TOUCHE PAS À LA RÈGLE. `verdictDeCalendrier` continue de décider
   seule dans son corps (une épreuve le verrouille) ; les décisions de la main sont
   une ÉTAPE À PART, appliquée APRÈS la fusion du passage. Un geste manuel est un
   geste manuel : il n'est pas une seconde règle cachée.
   ============================================================================= */

import fs from 'node:fs';

/** Le fichier publié, relatif à la racine du projet. Un seul nom, écrit une
 *  fois : le serveur, la collecte et le panneau le lisent ici. */
export const VERDICTS_FICHIER = 'public/verdicts-a-la-main.json';

/** Le plus long sursis réactivable à la main. La règle de fond affiche cinq
 *  jours : réactiver au-delà de cinq jours serait enfreindre la règle par la
 *  main, ce qui n'est pas ce qui est demandé — on remet une carte au monde, on
 *  ne refait pas la règle. */
export const JOURS_REACTIVATION_MAX = 5;

export const ACTIONS = ['verifier', 'reactiver', 'annuler'];

export const QUOI = "Les décisions de la main sur les cartes effacées : VÉRIFIER (la carte est vérifiée, la ligne quitte la liste — la fiche et sa preuve sont conservées), RÉACTIVER (la carte revient sur le site pour 1 à 5 jours, puis ressort) et RETIRER (le sursis est ramené à maintenant). Écrit par le serveur du projet (POST /api/verdict-carte, appelé par le panneau), lu par collecteur.mjs à chaque passage, et publié avec le site.";

/** L'ÉTAT NEUF — jamais `null` : une seule forme à gérer partout. */
export function verdictsNeufs() {
  return { version: 1, maj: null, quoi: QUOI, verifiees: {}, reactivees: {} };
}

/** ACCEPTER CE QU'ON LIT, SANS JAMAIS LEVER. Un fichier de décisions abîmé ne
 *  doit pas arrêter une collecte : on garde ce qui est lisible, on jette le
 *  reste. `verifiees` et `reactivees` sont TOUJOURS des objets. */
export function normaliserVerdicts(brut) {
  const neuf = verdictsNeufs();
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return neuf;
  const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return {
    ...neuf,
    version: Number.isFinite(brut.version) ? brut.version : neuf.version,
    maj: typeof brut.maj === 'string' ? brut.maj : null,
    verifiees: objet(brut.verifiees),
    reactivees: objet(brut.reactivees),
  };
}

/** LIRE LE FICHIER PUBLIÉ — absent = état NORMAL, pas une panne (le premier
 *  jour, aucune décision n'existe). */
export function lireVerdicts(fichier) {
  try { return normaliserVerdicts(JSON.parse(fs.readFileSync(fichier, 'utf8'))); }
  catch { return verdictsNeufs(); }
}

export function ecrireVerdicts(fichier, verdicts) {
  // Ordre alphabétique des clés : l'écriture est DÉTERMINISTE, sinon chaque
  // passage produirait un diff illisible et un commit fantôme sur un fichier
  // dont personne n'a rien changé.
  const trie = (o) => Object.fromEntries(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
  const corps = {
    ...normaliserVerdicts(verdicts),
    verifiees: trie(verdicts.verifiees),
    reactivees: trie(verdicts.reactivees),
  };
  fs.writeFileSync(fichier, JSON.stringify(corps, null, 1) + '\n', 'utf8');
  return corps;
}

/** LE VERDICT DE LA MAIN POUR UNE CARTE — ce que la main a décidé, ou rien.
 *
 *  Rend `'verifiee'`, `'reactivee'` (le sursis court encore), `'sursis-fini'`
 *  (une réactivation arrivée à son terme : la carte doit ressortir) ou `null`
 *  (aucun geste : la règle des cinq jours décide seule).
 */
export function verdictDeLaMain(cle, verdicts, maintenant = Date.now()) {
  const v = normaliserVerdicts(verdicts);
  if (v.verifiees[cle]) return 'verifiee';
  const r = v.reactivees[cle];
  if (!r) return null;
  const fin = Date.parse(r.jusquau || '');
  if (!Number.isFinite(fin)) return null;            // décision illisible : on n'agit pas
  return fin > maintenant ? 'reactivee' : 'sursis-fini';
}

/** ENREGISTRER UNE DÉCISION — la même fonction pour les trois gestes, pour que
 *  le fichier ne puisse pas prendre deux formes selon qui l'a écrit.
 *
 *  `fiche` est celle que le panneau affiche (titre, lien, image, prix, source,
 *  pays) : elle voyage AVEC la décision, parce qu'une réactivation doit pouvoir
 *  reconstruire la carte même si le registre des effacements a été élagué depuis
 *  (il ne garde que trente jours). Un sursis de cinq jours qui ne saurait pas
 *  remettre sa carte en ligne serait un bouton qui ment.
 */
export function enregistrerDecision(actuel, { action, cle, jours, fiche }, maintenant = Date.now()) {
  if (!ACTIONS.includes(action)) throw new Error(`action inconnue : ${action}`);
  if (!cle || typeof cle !== 'string') throw new Error('clé de carte manquante');
  const v = normaliserVerdicts(actuel);
  const quand = new Date(maintenant).toISOString();
  if (action === 'verifier') {
    // VÉRIFIER — la ligne quitte la liste, RIEN n'est perdu : la marque porte la
    // date et la fiche, et le registre garde la sienne (voir `marquerVerifiees`).
    const reactivees = { ...v.reactivees };
    delete reactivees[cle];                            // les deux gestes s'excluent : le dernier gagne
    return {
      ...v, maj: quand,
      verifiees: { ...v.verifiees, [cle]: { ...(fiche || {}), cle, verifieeLe: quand } },
      reactivees,
    };
  }
  if (action === 'annuler') return annulerReactivation(v, { cle }, maintenant);
  const n = Number(jours);
  // ⚠ DES JOURS ENTIERS, trouvé par l'épreuve (2,5 jours passait) : les cinq
  //  entrées du menu proposent 1 à 5, et une durée fractionnaire n'existe que par
  //  une requête fabriquée à la main. On refuse au lieu d'arrondir en silence.
  if (!Number.isInteger(n) || n < 1 || n > JOURS_REACTIVATION_MAX) {
    throw new Error(`durée hors bornes (1 à ${JOURS_REACTIVATION_MAX} jours entiers) : ${jours}`);
  }
  const verifiees = { ...v.verifiees };
  delete verifiees[cle];
  return {
    ...v, maj: quand,
    verifiees,
    reactivees: {
      ...v.reactivees,
      [cle]: {
        cle, jours: n, debut: quand,
        jusquau: new Date(maintenant + n * 86400000).toISOString(),
        fiche: { ...(fiche || {}), cle },
      },
    },
  };
}

/** RETIRER UN SURSIS — le geste qui répare une réactivation tapée par erreur.
 *
 *  Une carte remise en ligne ne doit pas y rester cinq jours par accident : on
 *  ramène son terme à maintenant. La fiche reste dans le fichier (avec `annulee`)
 *  parce qu'il faut bien que la collecte SACHE, au passage suivant, que cette
 *  carte doit ressortir — un enregistrement effacé ne dirait plus rien, et la
 *  carte resterait en ligne comme une carte neuve. */
export function annulerReactivation(actuel, { cle }, maintenant = Date.now()) {
  const v = normaliserVerdicts(actuel);
  const r = v.reactivees[cle];
  if (!r) throw new Error('aucune réactivation à retirer pour cette carte');
  const quand = new Date(maintenant).toISOString();
  return { ...v, maj: quand, reactivees: { ...v.reactivees, [cle]: { ...r, jusquau: quand, annulee: true } } };
}

/** LA CARTE RECONSTRUITE DEPUIS SA FICHE — pour la faire réapparaître.
 *
 *  On ne redemande rien au réseau : tout ce qu'il faut est dans la fiche, et la
 *  carte reprend la place d'une carte neuve (`premiereVue` = maintenant), parce
 *  que c'est exactement ce qu'elle est devenue : une carte que quelqu'un remet
 *  en ligne aujourd'hui.
 */
export function carteDepuisFiche(fiche, { maintenant = Date.now() } = {}) {
  const vu = new Date(maintenant).toISOString();
  const f = fiche || {};
  const carte = {
    titre: f.titre || '',
    lienPage: f.lien || '',
    image: f.image || '',
    marchand: f.marchand || f.source || f.sourceId || '',
    source: f.source || '',
    sourceId: f.sourceId || '',
    pays: f.pays || '',
    premiereVue: vu,
    vuLe: vu,
    reactiveeALaMain: true,
  };
  // Le prix et la remise seulement s'ils existent : `null` n'est pas un prix, et
  // un zéro qui n'en est pas un est le défaut déjà payé (« 0 € » affiché pour une
  // offre sans prix).
  if (Number.isFinite(f.prix)) carte.prix = f.prix;
  if (Number.isFinite(f.remise)) carte.remise = f.remise;
  if (f.date) carte.date = f.date;
  return carte;
}

/** LES CLÉS DONT LA FICHE DOIT QUITTER LE REGISTRE — les cartes REMISES EN LIGNE,
 *  et elles seules. Une carte réactivée est affichée : elle n'a plus rien à faire
 *  dans « ce que la règle a emporté ».
 *
 *  ⚠ UNE CARTE VÉRIFIÉE N'EST PAS DANS CETTE LISTE, et c'est tout l'objet de la
 *  décision de B : sa fiche reste, marquée, parce qu'elle porte la preuve de
 *  l'effacement et le compte des retours. */
export function clesRetireesDuRegistre(verdicts) {
  return new Set(Object.keys(normaliserVerdicts(verdicts).reactivees));
}

/** MARQUER LES FICHES VÉRIFIÉES DANS LE REGISTRE — pure, et sans rien retirer.
 *  La marque porte la date de la vérification ; une fiche déjà marquée garde sa
 *  PREMIÈRE date (c'est celle de la vérification, pas celle du passage qui la
 *  relit). */
export function marquerVerifiees(effacees, verdicts) {
  const v = normaliserVerdicts(verdicts);
  const cles = Object.keys(v.verifiees).filter((cle) => effacees[cle] && !effacees[cle].verifieeLe);
  if (!cles.length) return { effacees, marquees: 0, cles: [] };
  const marquees = { ...effacees };
  for (const cle of cles) {
    marquees[cle] = { ...marquees[cle], verifieeLe: v.verifiees[cle].verifieeLe || new Date().toISOString() };
  }
  return { effacees: marquees, marquees: cles.length, cles };
}

/** PURGER LE REGISTRE — pour les cartes retirées par la main (voir
 *  `clesRetireesDuRegistre`). Le compte est rendu pour que la collecte puisse le
 *  consigner. */
export function purgerRegistre(effacees, cles) {
  const aRetirer = cles instanceof Set ? cles : new Set(cles || []);
  if (!aRetirer.size) return { effacees, retires: 0, cles: [] };
  const gardees = { ...effacees };
  const parties = [];
  for (const cle of aRetirer) {
    if (gardees[cle]) { delete gardees[cle]; parties.push(cle); }
  }
  return { effacees: gardees, retires: parties.length, cles: parties };
}
