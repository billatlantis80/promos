/**
 * L'ESTIMATION DES GAINS, ET LES CONSEILS — APPLICATION N°2 « Kazendra ».
 * =============================================================================
 *
 * POURQUOI CE FICHIER EST SÉPARÉ DU PANNEAU. Ce qui suit est du CALCUL, pas de
 * l'affichage : deux fonctions pures, qui ne touchent ni à la page, ni au
 * réseau, ni à l'horloge (tout leur est donné). Une règle qu'on ne peut essayer
 * que dans un navigateur ne se vérifie pas — celle-ci s'éprouve sur des
 * situations fabriquées : un mois sans visite, un pic isolé, cent clics tous
 * dirigés vers un marchand sans programme d'affiliation.
 *
 * -----------------------------------------------------------------------------
 * LA RÈGLE QUI COMMANDE TOUT CE FICHIER : LE MESURÉ ET L'ESTIMÉ NE SE
 * MÉLANGENT PAS.
 *
 * MESURÉ (c'est le relais qui le publie, et personne ne le recalcule ici) :
 *   - le nombre de visites, jour par jour, par provenance, par appareil ;
 *   - le nombre de REDIRECTIONS vers un marchand, par marchand et par hôte.
 *
 * ESTIMÉ (c'est ce fichier, et chaque chiffre porte son modèle) :
 *   - ce que ces redirections ont pu rapporter, en euros.
 *
 * Un montant en euros qui ne dit pas d'où il vient est un chiffre décoratif —
 * et sur un revenu, c'est exactement celui qu'on croit. Donc : toute estimation
 * sort AVEC le tableau de ses hypothèses, et chaque hypothèse dit sa
 * provenance. Les trois hypothèses de gain (taux de conversion, panier moyen,
 * taux de commission) ne sont PAS mesurables depuis le site : le site ne voit
 * ni la commande, ni le panier, ni le versement. Elles sont donc déclarées,
 * affichées, et modifiables — et le VRAI chiffre, celui du compte partenaire,
 * se lit dans le tableau de bord du marchand. Le panneau dit où.
 *
 * ⚠ AUCUN CHIFFRE DE CE FICHIER N'EST UN VERSEMENT. Un clic n'est pas une
 * vente : entre les deux il y a un panier, une carte bancaire, une fenêtre de
 * suivi qui expire, et un programme qui peut refuser la commission. L'écart
 * entre l'estimation et le versement est normal — c'est même pour le mesurer
 * que le panneau demande le montant réellement versé.
 * -----------------------------------------------------------------------------
 */

/* ---------------------------------------------------------------------------
 * LE MODÈLE DES GAINS — des constantes NOMMÉES, PUBLIÉES et AFFICHÉES.
 *
 * Même discipline que le modèle d'énergie du collecteur : on ne cache pas une
 * hypothèse derrière un résultat. Chacune est ici, avec sa provenance, et le
 * panneau les affiche telles quelles.
 *
 * ⚠ PROVENANCE DES VALEURS PAR DÉFAUT — et elle est modeste, exprès.
 * Le taux de commission d'Amazon Partenaires dépend de la CATÉGORIE du produit
 * (la grille publiée va d'environ 0,5 % à 10 %, la plupart des produits
 * physiques se situant entre 3 % et 5 %) : un taux moyen ne peut donc être
 * qu'un ORDRE DE GRANDEUR, pas une donnée. On retient 4 %, et l'écran le dit.
 * Le jour où B relève le taux réel de son compte — ou le montant réellement
 * versé — les deux se saisissent dans le panneau, et l'estimation se cale.
 *
 * LE TAUX DE CONVERSION ET LE PANIER MOYEN SONT DES HYPOTHÈSES DE SECTEUR, et
 * elles sont annoncées comme telles : le site ne peut pas les mesurer, et
 * l'affirmer serait un mensonge de plus. Elles servent à donner un ORDRE DE
 * GRANDEUR, pas à promettre une somme. La calibration (montant réel déclaré)
 * est ce qui les remplace.
 * --------------------------------------------------------------------------- */
export const MODELE_GAINS = {
  /** Part des redirections qui aboutissent à une commande, en %. */
  tauxConversionPct: 1.5,
  /** Panier moyen d'une commande, en euros, toutes taxes comprises. */
  panierMoyenEur: 55,
  /** Taux de commission retenu par défaut, en % — remplaçable par programme. */
  tauxCommissionPct: 4,
  /** La fenêtre de suivi : le délai pendant lequel une commande reste
   *  attribuée au clic qui l'a précédée. On retient 24 h, l'ordre de grandeur
   *  annoncé par les programmes généralistes (Amazon) — une fenêtre COURTE,
   *  c'est-à-dire qu'une visite d'aujourd'hui ne se paie presque jamais
   *  demain. C'est une contrainte, pas un détail : elle explique qu'un pic de
   *  trafic mette des semaines à se voir dans un versement. */
  fenetreSuiviHeures: 24,
  provenance: [
    { quoi: 'Taux de conversion', valeur: '1,5 %', source: 'Hypothèse de secteur, NON mesurée ici. À recalibrer avec le montant réellement versé.' },
    { quoi: 'Panier moyen', valeur: '55 €', source: 'Hypothèse, NON mesurée ici. À recalibrer.' },
    { quoi: 'Taux de commission', valeur: '4 %', source: 'Ordre de grandeur (la grille Amazon va d’environ 0,5 % à 10 % selon la catégorie ; 3–5 % pour la plupart des produits physiques). À remplacer par le taux réel de ta grille.' },
    { quoi: 'Fenêtre de suivi', valeur: '24 h', source: 'Ordre de grandeur annoncé par les programmes généralistes. Une fenêtre courte : une commande passée plus tard n’est plus attribuée au clic.' },
  ],
};

/** Le nombre de jours couverts par le rapport, pour ramener un total à un mois. */
const JOURS_MOIS = 30.4;

/** Le taux appliqué à un programme : celui que B a déclaré, sinon le défaut. */
function tauxDeProgramme(programme, tauxDeclares) {
  const d = tauxDeclares && tauxDeclares[programme.marche];
  const n = Number(d);
  if (Number.isFinite(n) && n > 0 && n <= 40) return n;
  return MODELE_GAINS.tauxCommissionPct;
}

/** Un hôte appartient-il à ce marché ? On compare sur l'hôte NORMALISÉ, et on
 *  accepte les sous-domaines (« www.amazon.fr » -> « amazon.fr »). Jamais de
 *  ressemblance de noms : « amazon » ne suffit pas, « amazon.fr » oui. */
export function marcheDeHote(hote, marches) {
  const h = String(hote || '').toLowerCase().replace(/^www\./, '');
  if (!h) return null;
  let trouve = null;
  for (const m of marches || []) {
    const dom = String(m && m.marche || '').toLowerCase();
    if (!dom) continue;
    if ((h === dom || h.endsWith('.' + dom)) && (!trouve || dom.length > trouve.marche.length)) trouve = m;
  }
  return trouve;
}

/**
 * L'ESTIMATION DES GAINS, à partir des seules redirections mesurées.
 *
 * @param {Object} bloc    le bloc `affiliation` du rapport du relais :
 *                         { total: {clics, partages, hotes}, parHote: [{hote, clics, partages}], parJour: [...] }
 * @param {Object} options
 *   - marches      : les affiliations RÉELLEMENT ouvertes, [{marche, identifiant, reseau}]
 *   - tauxDeclares : les taux de commission saisis par B, { 'amazon.fr': 3.5 }
 *   - jours        : le nombre de jours que couvre le rapport (pour ramener au mois)
 * @returns un objet complet : lignes par programme, clics sans affiliation,
 *          totaux, et le rappel du modèle. Aucun champ ne peut manquer : le
 *          panneau lit toutes ces clés, y compris quand il n'y a AUCUNE
 *          redirection (les listes sont alors vides, jamais absentes).
 */
export function estimerGains(bloc, options) {
  const o = options || {};
  const marches = Array.isArray(o.marches) ? o.marches : [];
  const parHote = Array.isArray(bloc && bloc.parHote) ? bloc.parHote : [];
  const total = (bloc && bloc.total) || { clics: 0, partages: 0, hotes: 0 };
  const jours = Math.max(1, Number(o.jours) || 30);

  const lignes = marches.map((m) => {
    let clics = 0, partages = 0, hotes = [];
    for (const h of parHote) {
      if (marcheDeHote(h.hote, [m])) {
        clics += Number(h.clics) || 0;
        partages += Number(h.partages) || 0;
        hotes.push(h.hote);
      }
    }
    const taux = tauxDeProgramme(m, o.tauxDeclares);
    const commission = commissionDe(clics, taux);
    return {
      marche: m.marche, identifiant: m.identifiant, reseau: m.reseau,
      clics, partages, hotes,
      tauxPct: taux,
      commissionEur: commission,
      commissionParMoisEur: clics ? arrondi(commission * (JOURS_MOIS / jours)) : 0,
      ouverte: true,
    };
  }).sort((a, b) => b.clics - a.clics || String(a.marche).localeCompare(String(b.marche)));

  // LES CLICS QUI NE RAPPORTENT RIEN. C'est la mesure la plus directement
  // utile de ce bloc : un clic vers un marchand sans programme ouvert est un
  // clic perdu, définitivement. Le compter séparément le rend visible ; le
  // fondre dans un total le cacherait.
  const sansAffiliation = [];
  let clicsSansAffiliation = 0;
  for (const h of parHote) {
    if (marcheDeHote(h.hote, marches)) continue;
    const clics = Number(h.clics) || 0;
    const partages = Number(h.partages) || 0;
    clicsSansAffiliation += clics;
    sansAffiliation.push({ hote: h.hote || '(hôte inconnu)', clics, partages });
  }
  sansAffiliation.sort((a, b) => b.clics - a.clics || String(a.hote).localeCompare(String(b.hote)));

  let clicsAffilies = 0, commissionTotale = 0;
  for (const l of lignes) { clicsAffilies += l.clics; commissionTotale += l.commissionEur; }

  return {
    jours,
    lignes,
    sansAffiliation,
    clicsSansAffiliation,
    total: {
      clics: Number(total.clics) || 0,
      partages: Number(total.partages) || 0,
      clicsAffilies,
      clicsPerdus: clicsSansAffiliation,
      partAffilieePct: (Number(total.clics) || 0) ? arrondi(100 * clicsAffilies / total.clics) : 0,
      commissionEur: arrondi(commissionTotale),
      commissionParMoisEur: arrondi(commissionTotale * (JOURS_MOIS / jours)),
      // Un ordre de grandeur utile pour juger : combien de clics pour 10 €.
      clicsParDixEuros: commissionTotale > 0 ? Math.round(10 / (commissionTotale / clicsAffilies)) : null,
    },
    modele: MODELE_GAINS.provenance,
  };
}

/** La commission estimée pour `clics` redirections, au taux et au modèle
 *  publiés. Une seule formule, appelée une seule fois : deux calculs qui
 *  prétendent dire la même chose finissent toujours par diverger. */
export function commissionDe(clics, tauxPct) {
  const c = Number(clics) || 0;
  if (!c) return 0;
  return c
    * (MODELE_GAINS.tauxConversionPct / 100)
    * MODELE_GAINS.panierMoyenEur
    * ((Number(tauxPct) || 0) / 100);
}

/** La CALIBRATION : ce que le même nombre de clics a réellement rapporté.
 *  Elle ne sert pas à corriger l'estimation d'hier — elle dit à quel point le
 *  modèle se trompe, et c'est ainsi qu'on le règle. */
export function calibrer(commissionEstimee, montantReel) {
  const estime = Number(commissionEstimee) || 0;
  // UN CHAMP VIDE N'EST PAS UN ZÉRO. `Number('')` vaut 0 : sans ce contrôle, un
  // montant non saisi se lirait « 0 € versé », donc un écart de −100 % — un
  // chiffre faux qui aurait l'air d'une mesure, et qui ferait douter du modèle
  // pour une case laissée vide.
  const brut = String(montantReel === undefined || montantReel === null ? '' : montantReel).trim();
  const reel = brut === '' ? NaN : Number(brut);
  if (!Number.isFinite(reel) || reel < 0 || estime <= 0) {
    return { possible: false, facteur: null, ecartPct: null };
  }
  return {
    possible: true,
    facteur: arrondi(reel / estime),
    ecartPct: arrondi(100 * (reel - estime) / estime),
    reel,
  };
}

function arrondi(n, decimales) {
  const f = Math.pow(10, decimales === undefined ? 2 : decimales);
  return Math.round((Number(n) || 0) * f) / f;
}

/* =============================================================================
 * LES CONSEILS
 *
 * Chaque conseil se DÉCLENCHE sur un chiffre mesuré, et PORTE ce qu'il
 * rapporterait. C'est la même règle que les leviers du bilan d'exploitation :
 * sans chiffre, ce n'est pas un conseil, c'est un avis — et un avis en tête de
 * liste fait perdre du temps. Quand le gain n'est pas connaissable, il est
 * écrit « à mesurer » : on n'invente pas un chiffre pour remplir une colonne.
 *
 * TOUTES LES RÈGLES SONT ICI, AUCUNE DANS LE PANNEAU. Le panneau affiche ce que
 * cette fonction rend ; il n'en ajoute pas. Sinon, la moitié des conseils
 * échapperait aux épreuves, et c'est celle-là qui dériverait sans qu'on le voie.
 * ============================================================================= */

/** Le taux de clic sortant : combien de visites finissent par une sortie vers
 *  un marchand. C'est la mesure de l'intérêt réel — un visiteur qui ne sort pas
 *  n'a rien trouvé. */
export function tauxDeClic(visites, clics) {
  const v = Number(visites) || 0;
  if (v <= 0) return 0;
  return 100 * (Number(clics) || 0) / v;
}

/** Le seuil en dessous duquel un site de bons plans n'intéresse pas : 3 % de
 *  sorties. Ce n'est pas un idéal, c'est un plancher d'observation — en dessous,
 *  la page ne convainc pas. */
const PLANCHER_CLIC_PCT = 3;
/** L'objectif raisonnable quand on améliore la présentation. */
const CIBLE_CLIC_PCT = 6;

/**
 * Les conseils, calculés sur le rapport du relais.
 *
 * ⚠ LA COUVERTURE EST UN ARGUMENT À PART, ET CE N'EST PAS UN DÉTAIL DE STYLE.
 * Le rapport la porte À LA RACINE (`rapport.couverture`), à côté de `trafic` —
 * c'est ainsi que le panneau la lit, et c'est ainsi qu'un relais muet se voit.
 * La chercher dans `trafic` rendait `undefined` : le conseil de priorité 0, le
 * seul qui prévient que plus rien n'arrive, ne se déclenchait donc JAMAIS —
 * sans erreur, sans trou à l'écran. Une épreuve construite sur une forme
 * INVENTÉE (couverture rangée dans `trafic`) passait, elle, très bien.
 * Le 12/10/2026, la forme réelle produite par le script a été donnée à cette
 * fonction : c'est ce qui a révélé le défaut. La couverture est désormais
 * exigée ici, pour qu'on ne puisse plus l'oublier en silence.
 *
 * @param {Object} trafic      le bloc `trafic` du rapport
 * @param {Object} affiliation le bloc `affiliation` du rapport
 * @param {Object} gains       la sortie d'`estimerGains` (pour les clics perdus)
 * @param {Object} couverture  le bloc `couverture` du RAPPORT (à la racine)
 * @returns {Array} [{titre, constat, action, gain, effort, risque, priorite}]
 *          trié par priorité — la plus urgente d'abord.
 */
export function conseilsTrafic(trafic, affiliation, gains, couverture) {
  const t = trafic || {};
  const cov = couverture || {};
  const tot = t.total || {};
  const visites = Number(tot.visites) || 0;
  const clics = Number((affiliation && affiliation.total && affiliation.total.clics) || 0);
  const fenetre = Number(tot.joursFenetre) || 0;
  const parProvenance = Array.isArray(t.parProvenance) ? t.parProvenance : [];
  const parti = (m) => (s) => String((s && s.provenance) || '').toLowerCase().includes(m);
  const somme = (f) => parProvenance.filter(f).reduce((n, x) => n + (Number(x.v) || 0), 0);
  const c = [];
  const ajoute = (priorite, titre, constat, action, gain, effort, risque) =>
    c.push({ priorite, titre, constat, action, gain, effort, risque });

  const parMois = (parSemaine) => Math.round((Number(parSemaine) || 0) * (JOURS_MOIS / 7));

  /* --- 1. Le relais est muet : rien ne peut être conseillé ----------------- */
  // CE CONSEIL PASSE EN PREMIER, ET IL EST DIFFÉRENT DES AUTRES : sans relevé,
  // tout le reste est faux, pas seulement incomplet.
  const dernier = cov.dernierDansFenetre || null;
  const joursDepuis = dernier ? Math.round((Date.now() - new Date(dernier + 'T12:00:00Z').getTime()) / 86400000) : null;
  if (Number(cov.lignesVisites) > 0 && joursDepuis !== null && joursDepuis >= 3) {
    ajoute(0, 'Le relais ne reçoit plus rien',
      `Aucun relevé depuis ${joursDepuis} jours (le dernier : ${dernier}).`,
      'Ouvrir l’onglet Réglages, vérifier l’adresse du relais et appuyer sur « Tester ». Si le relais répond mais que rien n’arrive, la feuille de calcul le dira : elle est la source.',
      'Sans relevé, aucun conseil ne peut être calculé — et un chiffre figé se lit comme un chiffre stable.',
      'faible', 'élevé');
  }

  /* --- 2. La tendance ------------------------------------------------------ */
  if (t.tendance && t.tendance.ecartPct !== null) {
    const d = t.tendance;
    if (d.ecartPct <= -20 && d.septPrecedents >= 10) {
      const manque = parMois(d.septPrecedents - d.septDerniers);
      ajoute(1, 'La fréquentation baisse',
        `${d.septPrecedents} visites les sept jours précédents, ${d.septDerniers} les sept derniers : ${d.ecartPct} %.`,
        'Retrouver ce qui a porté la semaine d’avant (une publication, un partage, une remontée dans un moteur) et refaire ce geste-là. Le journal jour par jour et les provenances disent lequel.',
        `Revenir au rythme précédent = +${manque} visites par mois.`,
        'moyen', 'faible');
    } else if (d.ecartPct >= 20) {
      const plus = parMois(d.septDerniers - d.septPrecedents);
      ajoute(3, 'Un pic de fréquentation',
        `${d.septDerniers} visites les sept derniers jours contre ${d.septPrecedents} les sept précédents : +${d.ecartPct} %.`,
        'Identifier ce qui a causé le pic (provenance, porte d’entrée, jour) et le refaire à volonté. Un pic non expliqué ne se reproduit pas.',
        `Tenir ce rythme = +${plus} visites par mois.`,
        'faible', 'faible');
    }
  }

  /* --- 3. Les moteurs de recherche ---------------------------------------- */
  if (visites >= 20) {
    const moteurs = somme(parti('recherche'));
    if (moteurs === 0) {
      ajoute(2, 'Aucune visite venue d’un moteur de recherche',
        `${visites} visites enregistrées, dont aucune venue d’un moteur de recherche.`,
        'Vérifier que le site est bien proposé aux robots (sitemap.xml, robots.txt), puis inscrire le site dans les outils gratuits des moteurs pour demander l’exploration. C’est le seul tuyau qui amène du monde sans qu’on s’en occupe.',
        'à mesurer — le gain dépend du référencement, qui prend des semaines.',
        'moyen', 'faible');
    } else if (moteurs / visites >= 0.6) {
      ajoute(4, 'La recherche porte le site',
        `${Math.round(100 * moteurs / visites)} % des visites viennent d’un moteur de recherche.`,
        'C’est la meilleure source : elle travaille seule. La renforcer (pages de rubrique, titres clairs, offres qui se renouvellent) rapporte plus que n’importe quelle campagne.',
        'à mesurer — un référencement ne se chiffre pas d’avance.',
        'moyen', 'faible');
    }
  }

  /* --- 4. Le direct : le site n'est connu que par ceux à qui on en a parlé -- */
  const direct = somme(parti('direct'));
  if (visites >= 20 && direct / visites >= 0.6) {
    ajoute(5, 'Le site vit du bouche-à-oreille',
      `${direct} visites sur ${visites} sont « directes » : ni moteur, ni réseau social, ni partage.`,
      'Ces visites sont celles de gens à qui tu as donné l’adresse. Pour en avoir d’autres, il faut être TROUVÉ : liens sortants depuis des pages où l’offre est discutée, et offres partagées régulièrement.',
      'à mesurer.',
      'moyen', 'faible');
  }

  /* --- 5. Les sorties vers les marchands --------------------------------- */
  if (visites >= 30) {
    const taux = tauxDeClic(visites, clics);
    if (taux < PLANCHER_CLIC_PCT) {
      const cible = Math.round(visites * CIBLE_CLIC_PCT / 100);
      ajoute(2, 'Peu de visiteurs ouvrent une offre',
        `${visites} visites pour ${clics} sortie(s) vers un marchand : ${arrondi(taux, 1)} %.`,
        `Sous ${PLANCHER_CLIC_PCT} %, la page ne convainc pas encore : revoir l’ordre des offres (les plus fortes en haut), les visuels manquants, et les titres.`,
        `Porter le taux à ${CIBLE_CLIC_PCT} % = +${Math.max(0, cible - clics)} clics sur la période — et autant de chances de commission.`,
        'moyen', 'faible');
    } else if (taux >= 15) {
      ajoute(6, 'Les visiteurs sortent beaucoup',
        `${taux.toFixed(1)} % des visites finissent chez un marchand (${clics} sur ${visites}).`,
        'La page convainc. Le frein est désormais en amont : il faut plus de visiteurs, pas une meilleure page. Le travail utile est donc la visibilité, pas la présentation.',
        'à mesurer — c’est la fréquentation qu’il faut faire monter, pas le taux.',
        'moyen', 'faible');
    }
  }

  /* --- 6. Les clics qui ne rapportent rien -------------------------------- */
  if (gains && gains.clicsSansAffiliation >= 10) {
    const perdus = gains.clicsSansAffiliation;
    const potentiel = arrondi(commissionDe(perdus, MODELE_GAINS.tauxCommissionPct));
    const premier = (gains.sansAffiliation[0] || {}).hote || 'un marchand';
    ajoute(1, 'Des clics perdus, définitivement',
      `${perdus} sortie(s) vers un marchand sans programme d’affiliation — le premier étant ${premier}.`,
      'Soit ouvrir le programme de ces marchands, soit les passer en dernier : chaque clic vers un marchand non affilié ne rapportera jamais rien, quelle que soit sa qualité.',
      `Au modèle affiché, ces ${perdus} clics valaient ≈ ${nfEur(potentiel)} — mais un clic non affilié en vaut zéro, c’est bien le problème.`,
      'moyen', 'faible');
  }

  /* --- 7. Les jours creux ------------------------------------------------- */
  if (fenetre >= 14) {
    const actifs = Number(tot.joursActifs) || 0;
    const moyenne = Number(tot.moyenneJoursActifs) || 0;
    if (actifs / fenetre < 0.6 && moyenne > 0) {
      ajoute(3, 'Le trafic est en pointillé',
        `${actifs} jour(s) avec visites sur ${fenetre} jours de fenêtre : le site vit par à-coups.`,
        'Ce n’est pas la fréquentation qui manque, c’est la RÉGULARITÉ. Publier ou partager à jours fixes — un pic isolé retombe toujours, un rendez-vous hebdomadaire s’installe.',
        `Un jour actif de plus par semaine = ≈ +${Math.round(moyenne * 4.3)} visites par mois.`,
        'faible', 'faible');
    }
    if (tot.meilleurJour && moyenne > 0 && tot.meilleurJour.visites >= 3 * Math.max(1, Number(tot.medianeFenetre) || 0)) {
      ajoute(2, 'Un jour porte tout le trafic',
        `Le ${tot.meilleurJour.jour} a reçu ${tot.meilleurJour.visites} visites, alors que la médiane est de ${Math.round(Number(tot.medianeFenetre) || 0)} par jour.`,
        'Ce jour-là, quelque chose a marché : retrouve-le dans les provenances et les portes d’entrée du jour, puis refais-le — c’est le seul levier dont on connaisse déjà le résultat.',
        `Amener la médiane à la hauteur du pic = ≈ +${Math.round((tot.meilleurJour.visites - (Number(tot.medianeFenetre) || 0)) * 4.3)} visites par mois.`,
        'faible', 'faible');
    }
  }

  /* --- 8. Le fuseau : d'où viennent réellement les visiteurs --------------- */
  const fuseaux = Array.isArray(t.parFuseau) ? t.parFuseau : [];
  if (visites >= 20 && fuseaux.length) {
    const premier = fuseaux[0];
    const part = Math.round(100 * (Number(premier.v) || 0) / visites);
    if (part >= 80 && String(premier.fuseau) !== '?') {
      ajoute(7, 'Le public est très concentré',
        `${part} % des visites viennent d’un même fuseau horaire : ${premier.fuseau}.`,
        'Ce n’est pas un défaut, c’est une information à exploiter : publier aux heures de ce fuseau, et proposer les marchands de cette zone en premier. Un catalogue belge lu depuis un autre continent déçoit (prix, délais, langue).',
        'à mesurer.',
        'faible', 'faible');
    } else if (fuseaux.length >= 4) {
      ajoute(7, 'Un public dispersé',
        `${fuseaux.length} fuseaux horaires différents parmi ${visites} visites.`,
        'Plusieurs zones veulent dire plusieurs langues et plusieurs marchés : vérifier que les offres présentées et la langue de la boutique correspondent au pays consulté (c’est déjà le rôle de la mention « Acheter sur Amazon.fr / .com.be »).',
        'à mesurer.',
        'faible', 'faible');
    }
  }

  /* --- 9. L'application Android ------------------------------------------- */
  if (visites >= 30) {
    const app = Number(tot.application) || 0;
    if (app === 0) {
      ajoute(6, 'L’application Android n’amène personne',
        `Aucune des ${visites} visites ne vient de l’application : tout le monde passe par le navigateur.`,
        'Soit l’application n’est pas encore distribuée, soit son lien n’est proposé nulle part de visible. Sans installation, elle ne peut pas revenir toute seule — c’est justement ce qu’un site ne sait pas faire.',
        'à mesurer — une part d’application se fixe comme objectif, elle ne se calcule pas.',
        'moyen', 'faible');
    } else if (app / visites >= 0.5) {
      ajoute(8, 'L’application prend le relais',
        `${Math.round(100 * app / visites)} % des visites viennent de l’application Android.`,
        'Ces visiteurs-là reviennent : c’est ce que l’application apporte. Le travail utile est de proposer l’installation aux visiteurs du navigateur, sans les en empêcher.',
        'à mesurer.',
        'faible', 'faible');
    }
  }

  /* --- 10. Le repère : ce qu'il faut de trafic pour un euro ---------------- */
  if (gains && gains.total && gains.total.commissionEur > 0) {
    ajoute(9, 'Ce qu’il faut de trafic pour gagner 10 €',
      `Au modèle affiché, ${gains.total.clicsAffilies} sortie(s) affiliée(s) valent ≈ ${nfEur(gains.total.commissionEur)}.`,
      'C’est le repère à garder en tête : l’objectif n’est pas de faire joli, c’est de multiplier les sorties vers les programmes ouverts. Chaque point de taux de clic en plus vaut des euros.',
      `≈ ${gains.total.clicsParDixEuros || '—'} sorties pour 10 €.`,
      'faible', 'faible');
  }

  // LE TRI : la priorité d'abord, puis le titre. Deux exécutions sur le même
  // rapport rendent donc le même ordre — un conseil qui change de place tout
  // seul ferait douter de la liste entière.
  return c.sort((a, b) => a.priorite - b.priorite || String(a.titre).localeCompare(String(b.titre)));
}

/** Un montant en euros, écrit à la française. Volontairement local à ce
 *  fichier : il sert DANS les phrases des conseils, pas dans les tableaux du
 *  panneau (qui ont leur propre formateur). */
function nfEur(n) {
  const v = Number(n) || 0;
  return `${v.toFixed(v < 10 ? 2 : 0).replace('.', ',')} €`;
}
