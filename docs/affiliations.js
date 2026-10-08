/**
 * L'AFFILIATION, PAYS PAR PAYS — « une vue claire de quelle affiliation j'ai
 * ou pas ».
 *
 * B (08/10/2026) : « J'ai besoin aussi d'un onglet affiliation, avec tous les
 * pays comme dans ce que tu viens de faire. Pour chaque pays tu dois m'afficher
 * les affiliations qui sont possibles, existantes. […] Tu dois vérifier qui fait
 * des affiliations ou pas, s'il y a des affiliations, ils apparaissent en haut,
 * s'il n'y en a pas ils apparaissent plus bas. Peut-être que nous pourrons
 * négocier par la suite des liens d'affiliation en privé avec le commerçant. »
 *
 * TROIS ÉTATS, PAS DEUX — ET LE TROISIÈME EST LE PLUS IMPORTANT.
 *
 *   1. « programme trouvé »   — on a VU le programme (page dédiée, ou signature
 *                               d'un réseau dans le HTML du site). C'est un fait
 *                               mesuré, avec l'adresse qui le prouve.
 *   2. « non mesuré »         — le site a refusé la mesure (403), ou n'a rendu
 *                               qu'une page vide. On ne sait PAS. Groupon, Bol
 *                               et Amazon sont dans ce cas.
 *   3. « aucun signe trouvé » — le site a répondu, on a regardé, on n'a rien vu.
 *
 * POURQUOI LE TROISIÈME ÉTAT EXISTE, ET POURQUOI IL NE DIT PAS « PAS
 * D'AFFILIATION ». Un marchand peut avoir un programme privé, réservé à ses
 * partenaires, sans aucune trace publique. Ranger ces acteurs avec « pas
 * d'affiliation » ferait écrire B à des enseignes qui en ont déjà une — et il
 * perdrait sa crédibilité au premier contact. La base dit donc ce qu'elle a
 * VU, et se tait sur ce qu'elle n'a pas vu.
 *
 * Module partagé : le panneau l'affiche, les tests l'exécutent tel quel.
 */

/** L'ordre d'affichage demandé : les affiliations en haut, celles qu'on n'a pas
 *  trouvées plus bas. « Non mesuré » est au milieu — ce n'est ni l'un ni
 *  l'autre, et il faut que ça se voie : c'est la liste des vérifications à
 *  faire à la main. */
export const ORDRE_AFFILIATION = ['programme trouvé', 'non mesuré', 'aucun signe trouvé'];

/** Les mesures, indexées par nom d'acteur. Le rapprochement se fait sur le NOM
 *  (comme la liaison acteurs↔sources) : c'est la seule clé que les deux bases
 *  partagent, et elle est stable. */
export function indexAffiliation(mesures) {
  const m = {};
  for (const a of ((mesures && mesures.acteurs) || [])) if (a && a.nom) m[a.nom] = a;
  return m;
}

/** L'état d'affiliation d'un acteur, ramené à trois valeurs. Un acteur absent
 *  des mesures est « non mesuré », jamais « aucun signe » : l'absence de
 *  mesure n'est pas une mesure. */
export function etatAffiliation(mesures, nom) {
  const m = indexAffiliation(mesures)[nom];
  if (!m) return { etat: 'non mesuré', reseaux: [], indices: [], raison: 'acteur absent du balayage' };
  const etat = ORDRE_AFFILIATION.includes(m.etat) ? m.etat : 'non mesuré';
  return {
    etat,
    reseaux: m.reseaux || [],
    indices: m.indices || [],
    raison: m.raison || '',
    domaine: m.domaine || '',
    http: m.http,
  };
}

/**
 * LES PAYS DE L'AFFILIATION — tous les pays où il y a des acteurs recensés, avec
 * ce que chacun porte : combien de programmes trouvés, combien de vérifications
 * à faire, et quels réseaux dominent.
 *
 * Les réseaux par pays sont l'information la plus actionnable : un pays où tout
 * passe par Awin et un pays où tout passe par Adtraction ne se démarchent
 * pas au même guichet. C'est ce qui évite de s'inscrire à cinq réseaux pour rien.
 */
export function paysAffiliation(base, mesures) {
  const parPays = {};
  for (const a of ((base && base.acteurs) || [])) {
    const pays = a.pays || '—';
    const P = parPays[pays] = parPays[pays] || {
      pays, acteurs: 0, programme: 0, aucunSigne: 0, nonMesure: 0, reseaux: {},
    };
    const e = etatAffiliation(mesures, a.nom);
    P.acteurs += 1;
    if (e.etat === 'programme trouvé') {
      P.programme += 1;
      for (const r of e.reseaux) P.reseaux[r] = (P.reseaux[r] || 0) + 1;
    } else if (e.etat === 'non mesuré') P.nonMesure += 1;
    else P.aucunSigne += 1;
  }
  return Object.values(parPays).map((P) => ({
    ...P,
    aVerifier: P.nonMesure,
    reseaux: Object.entries(P.reseaux)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .map(([nom, n]) => ({ nom, n })),
  })).sort((x, y) => y.programme - x.programme || y.acteurs - x.acteurs || x.pays.localeCompare(y.pays));
}

/**
 * LA VUE D'UN PAYS — les acteurs rangés en trois groupes, dans l'ordre demandé.
 *
 * On range DANS les groupes par nombre d'articles décroissant : un marchand qui
 * apporte déjà beaucoup d'articles et qui a un programme est le premier à
 * démarcher ; un marchand qui apporte beaucoup et qui n'a rien de trouvé est le
 * premier à qui demander une négociation privée.
 */
export function affiliationsDuPays(catalogue, base, mesures, pays) {
  const idx = indexAffiliation(mesures);
  const annoncesDe = {};
  for (const o of ((catalogue && catalogue.offres) || [])) {
    const s = o.marchand || o.source || '—';
    annoncesDe[s] = (annoncesDe[s] || 0) + 1;
  }

  const siens = ((base && base.acteurs) || []).filter((a) => (a.pays || '—') === pays);
  const enrichis = siens.map((a) => {
    const e = etatAffiliation(mesures, a.nom);
    return {
      ...a,
      affiliation: e,
      // Les articles qui CITENT ce marchand : la mesure de son poids réel.
      citations: annoncesDe[a.nom] || 0,
    };
  });

  const groupes = ORDRE_AFFILIATION.map((etat) => {
    const liste = enrichis.filter((a) => a.affiliation.etat === etat)
      .sort((x, y) => y.citations - x.citations || x.nom.localeCompare(y.nom));
    return { etat, liste, n: liste.length };
  });

  const compteurs = {
    acteurs: enrichis.length,
    programme: groupes[0].n,
    nonMesure: groupes[1].n,
    aucunSigne: groupes[2].n,
  };

  // Les réseaux du pays, comptés sur les SEULS programmes trouvés.
  const parReseau = {};
  for (const a of enrichis) {
    if (a.affiliation.etat !== 'programme trouvé') continue;
    for (const r of a.affiliation.reseaux) parReseau[r] = (parReseau[r] || 0) + 1;
  }
  const reseaux = Object.entries(parReseau)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([nom, n]) => ({ nom, n }));

  return { pays, compteurs, reseaux, groupes };
}

/** Les adresses de programme VUES, pour un acteur — ce qui se clique. On ne
 *  fabrique rien : on ne rend que des adresses réellement observées. */
export const preuvesAffiliation = (e) => ((e && e.indices) || []).filter((i) => /https?:\/\//.test(i));
