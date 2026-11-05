/**
 * HISTORIQUE DES PRIX — application n°2 « Kazendra / Promos ».
 * =============================================================================
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le collecteur relève les offres toutes les 5 minutes… et jetait l'ancien
 * prix : chaque passage réécrivait le fichier. On ne pouvait donc jamais
 * répondre à la seule question qui compte devant une promo — « ce prix est-il
 * vraiment bas ? ». Un prix barré affiché par un marchand ne prouve rien ; seul
 * un historique CONSTATE le prouve.
 *
 * Ce module conserve donc ce que NOUS avons vu, jour après jour, et en tire une
 * analyse que personne d'autre ne peut produire : le plus bas relevé, le prix
 * habituel, et la réponse à « ce prix barré a-t-il déjà existé ? ».
 *
 * DEUX RÈGLES DE SÛRETÉ (non négociables)
 *
 *   1. On ne parle QUE si l'on a assez de recul. Sous MIN_JOURS_POUR_PARLER
 *      jours de relevés pour un article, on ne dit RIEN : un « plus bas depuis
 *      30 jours » calculé sur deux jours serait un mensonge, et c'est
 *      exactement le genre de chiffre qui détruit la confiance.
 *   2. On n'invente aucun prix. Tout ce qui sort d'ici est un extremum ou une
 *      médiane de valeurs RÉELLEMENT relevées, jamais une estimation.
 *
 * FORMAT DU FICHIER (data/historique-prix.json, non publié)
 *
 *   { "version": 1, "jours": { "2026-10-07": { "<idOffre>": [min, max] } } }
 *
 * La clé est le jour UTC. La valeur est la fourchette RÉELLEMENT vue ce
 * jour-là : le minimum (le mieux qu'on pouvait obtenir) et le maximum (utile
 * pour juger un prix barré). On ne garde qu'un couple par article et par jour —
 * sans quoi 288 passages quotidiens feraient exploser le fichier.
 */

/** Profondeur conservée. Au-delà, les jours sont élagués. */
export const FENETRE_JOURS = 60;

/** En dessous de ce nombre de jours relevés, l'analyse se TAIT. */
export const MIN_JOURS_POUR_PARLER = 5;

/** Écart minimum (en %) sous le prix habituel pour le signaler. */
export const SEUIL_SOUS_PRIX = 10;

/** Au-delà de ce rapport, un prix barré jamais constaté est signalé. */
export const RATIO_REFERENCE_DOUTEUSE = 1.05;

/** Le jour (UTC) d'un horodatage ISO. */
export function jourDe(dateISO) {
  return String(dateISO).slice(0, 10);
}

function joursTries(hist) {
  return Object.keys(hist.jours || {}).sort();
}

/**
 * Enregistre ce qu'on vient de voir. On garde la fourchette du jour :
 * le minimum s'il baisse, le maximum s'il monte.
 */
export function noterPrix(hist, offres, dateISO) {
  const j = jourDe(dateISO);
  hist.jours = hist.jours || {};
  hist.jours[j] = hist.jours[j] || {};
  const jour = hist.jours[j];
  for (const o of offres) {
    const p = Number(o && o.prix);
    if (!o || !o.id || !Number.isFinite(p) || p <= 0) continue;
    const vu = jour[o.id];
    if (!vu) jour[o.id] = [p, p];
    else {
      if (p < vu[0]) vu[0] = p;
      if (p > vu[1]) vu[1] = p;
    }
  }
  return hist;
}

/** Ne garde que les FENETRE_JOURS derniers jours. */
export function elaguerHistorique(hist, dateISO) {
  const limite = new Date(`${jourDe(dateISO)}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - FENETRE_JOURS);
  const seuil = jourDe(limite.toISOString());
  for (const j of joursTries(hist)) {
    if (j < seuil) delete hist.jours[j];
  }
  return hist;
}

function mediane(valeurs) {
  if (!valeurs.length) return null;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/**
 * Analyse un article : ce que l'historique permet d'affirmer sur son prix.
 * Renvoie null quand il n'y a rien à dire — jamais un objet à moitié rempli.
 */
export function analyseArticle(hist, id, prix) {
  if (!id || !hist || !hist.jours) return null;
  const mins = [];
  const maxs = [];
  for (const j of joursTries(hist)) {
    const vu = hist.jours[j][id];
    if (!vu) continue;
    if (Number.isFinite(vu[0])) mins.push(vu[0]);
    if (Number.isFinite(vu[1])) maxs.push(vu[1]);
  }
  if (!mins.length) return null;

  const prixBas = Math.min(...mins);
  const prixHaut = maxs.length ? Math.max(...maxs) : prixBas;
  const prixHabituel = mediane(mins);
  const p = Number(prix);
  const sousPrixHabituel = prixHabituel > 0 && Number.isFinite(p)
    ? Math.round(((prixHabituel - p) / prixHabituel) * 100)
    : 0;

  return {
    jours: mins.length,
    prixBas: arrondi(prixBas),
    prixHabituel: arrondi(prixHabituel),
    prixHaut: arrondi(prixHaut),
    sousPrixHabituel,
    estPlusBas: Number.isFinite(p) ? p <= prixBas + 0.005 : false,
  };
}

function arrondi(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * Le verdict d'une offre, EXPLIQUÉ — pas un simple pourcentage.
 * Priorité du plus fort au plus faible : une seule raison est annoncée.
 */
export function verdictPour(o, a) {
  const prix = Number(o && o.prix);
  const avant = Number(o && o.prixAvant);
  const assez = !!(a && a.jours >= MIN_JOURS_POUR_PARLER);

  // 0. Incohérence franche : le prix demandé dépasse le prix « barré ».
  if (Number.isFinite(prix) && Number.isFinite(avant) && avant > 0 && prix > avant) {
    return { code: 'incoherent' };
  }

  // 1. Prix de référence JAMAIS constaté chez nous, et nettement supérieur.
  if (assez && Number.isFinite(avant) && avant > 0 && Number.isFinite(prix)
      && prix > 0 && avant > a.prixHaut * RATIO_REFERENCE_DOUTEUSE) {
    return { code: 'referenceDouteuse', pct: Math.round((avant / prix - 1) * 100) };
  }

  // 2. Au plus bas relevé, avec une remise réelle.
  if (assez && a.estPlusBas && Number.isFinite(o.remise) && o.remise >= 15) {
    return { code: 'bonPlanRare', jours: a.jours };
  }

  // 3. Nettement sous son prix habituel.
  if (assez && a.sousPrixHabituel >= SEUIL_SOUS_PRIX) {
    return { code: 'sousPrixHabituel', pct: a.sousPrixHabituel };
  }

  // 4. Remise vérifiée, mais rien de remarquable à signaler.
  if (o.remiseCalculee && Number.isFinite(Number(o.remise))) {
    return { code: 'remiseVerifiee', pct: Number(o.remise) };
  }

  return { code: 'inconnu' };
}

/**
 * Applique l'analyse à une liste d'offres. On n'ajoute des champs QUE lorsqu'il
 * y a un historique : une offre vue pour la première fois ne porte rien, et le
 * fichier publié ne gonfle pas inutilement.
 */
export function appliquerAnalyse(hist, offres) {
  let avec = 0;
  let verdicts = 0;
  for (const o of offres) {
    const a = analyseArticle(hist, o && o.id, o && o.prix);
    if (!a) continue;
    avec++;
    o.analyse = a;
    const v = verdictPour(o, a);
    o.verdict = v;
    if (v.code !== 'inconnu') verdicts++;
  }
  return { avec, verdicts };
}
