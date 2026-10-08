/**
 * LE MARCHÉ BELGE — relier les acteurs du marché aux sources de l'application.
 * =============================================================================
 *
 * DEMANDE DE B (08/10/2026) : « introduire la base de données complète qui est
 * dans le fichier, mais surtout faire une liaison avec les sites qui sont actifs
 * au niveau des promotions dans notre application. Et ceux qui ne sont pas
 * actifs. Cela nous permettra de régulariser chaque site, site par site. »
 *
 * CE QUE CE MODULE FAIT, ET RIEN D'AUTRE. Il répond, pour chacun des 139 acteurs
 * du marché belge, à une seule question : est-ce que l'application le LIT ?
 *
 *   1. « flux »    — le site publie ses offres et on les lit chez lui. C'est le
 *                    cas idéal : ses promos sont réelles et chiffrables.
 *   2. « veille »  — aucun flux lisible chez lui (page en JavaScript, refus,
 *                    image seule : mesuré un par un), et on ne le voit qu'à
 *                    travers un moteur qui parle de lui. Ce n'est PAS branché.
 *   3. « aucun »   — on ne le suit pas du tout. C'est la liste de travail.
 *
 * TROIS ÉTATS, PAS DEUX, ET C'EST VOULU. Ranger « veille » avec « actif » ferait
 * croire que Delhaize alimente le catalogue : il apparaît, mais par des articles
 * de presse qui le mentionnent, jamais par ses propres promos. Ranger « veille »
 * avec « aucun » ferait perdre le travail déjà fait. L'écart entre les deux est
 * exactement ce que B veut voir pour régulariser, site par site.
 *
 * LA LIAISON SE FAIT PAR DEUX CHEMINS, ET IL EN FAUT DEUX
 *   - par le DOMAINE : « coolblue.be » dans la base, « coolblue.be » dans la
 *     source. C'est le chemin sûr, il ne se trompe jamais.
 *   - par le NOM : « Delhaize » dans la base, « Delhaize (BE) » dans la source.
 *     INDISPENSABLE, car les sources de veille passent par un moteur : leur
 *     adresse est « bing.com/news?q=Delhaize… », pas « delhaize.be ». Sans le
 *     nom, aucune enseigne belge ne serait jamais reliée.
 *
 * CE QU'ON REFUSE DE FAIRE. Une liaison approximative est pire qu'une absence de
 * liaison : elle ferait croire qu'un acteur est couvert alors qu'il ne l'est
 * pas, et on chercherait la panne ailleurs. On exige donc :
 *   - une correspondance EXACTE dès 3 caractères ;
 *   - une correspondance PARTIELLE seulement à partir de 5 caractères, pour que
 *     « Fun » ne rapproche pas n'importe quoi et que « M3 » ne rejoigne pas
 *     « M3 » d'un autre pays.
 *
 * Module partagé : le panneau l'affiche, et les tests l'exécutent tel quel.
 */

/** Sans accent, sans casse — la même normalisation que le collecteur. */
export const sansAccents = (s) => String(s || '')
  .replace(/[łßøđæœþı]/g, (c) => ({ ł: 'l', ß: 'ss', ø: 'o', đ: 'd', æ: 'ae', œ: 'oe', þ: 'th', ı: 'i' }[c]))
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019\u02bc`]/g, '');

/** Mots qui ne distinguent pas deux enseignes. « Colruyt Group » et « Colruyt »
 *  sont le même acteur ; sans cette liste, la correspondance exacte échouerait
 *  et on se rabattrait sur une correspondance partielle, plus fragile. */
const MOTS_VIDES = new Set([
  'group', 'groupe', 'belgique', 'belgium', 'belgie', 'international',
  'sa', 'nv', 'srl', 'bvba', 'sprl',
]);

/** Les noms sous lesquels un acteur ou une source peut se présenter.
 *  « Social Deal & Outspot » donne « socialdeal » ET « outspot » : les deux
 *  enseignes du même acteur, et chacune peut être reliée séparément. */
export function variantes(nom) {
  const base = sansAccents(String(nom || '').toLowerCase()).replace(/\s+/g, ' ').trim();
  const sortie = new Set();
  for (const part of base.split(/\s*[&/]\s*|\s+et\s+/)) {
    const mots = part.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!mots.length) continue;
    const entier = mots.join('');
    if (entier) sortie.add(entier);
    const coupe = [...mots];
    while (coupe.length > 1 && MOTS_VIDES.has(coupe[coupe.length - 1])) coupe.pop();
    while (coupe.length > 1 && MOTS_VIDES.has(coupe[0])) coupe.shift();
    const net = coupe.join('');
    if (net) sortie.add(net);
  }
  return [...sortie];
}

/** Le domaine d'une adresse, sans « www. ». Chaîne vide si ce n'en est pas une. */
export function domaineDe(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return ''; }
}

/** Un moteur de recherche n'est pas un site marchand : c'est un moyen de VOIR un
 *  marchand. Ses « domaines » ne doivent donc jamais servir de liaison. */
export const estMoteur = (url) => /news\.google\.com|bing\.com\/news/.test(String(url || ''));

/** Deux noms désignent-ils le même acteur ? */
export function memeActeur(a, b) {
  for (const x of variantes(a)) {
    for (const y of variantes(b)) {
      if (x === y && x.length >= 3) return true;
      const court = x.length <= y.length ? x : y;
      const long = x.length <= y.length ? y : x;
      if (court.length >= 5 && long.includes(court)) return true;
    }
  }
  return false;
}

/**
 * LA LIAISON COMPLÈTE.
 *
 * @param catalogue  le catalogue publié : { sources: [...], offres: [...] }
 * @param base       la base du marché : { acteurs: [...] }
 * @returns { acteurs, categories, compteurs }
 */
export function liaisonActeurs(catalogue, base) {
  const sources = (catalogue && catalogue.sources) || [];
  const offres = (catalogue && catalogue.offres) || [];
  const acteurs = (base && base.acteurs) || [];

  // 1. Les annonces de chaque source, comptées UNE fois.
  const annoncesDe = {};
  for (const o of offres) {
    const s = o.source || '—';
    annoncesDe[s] = (annoncesDe[s] || 0) + 1;
  }

  // 2. Indexer les sources : par domaine (quand ce n'en est pas un moteur) et
  //    par nom. On indexe les deux, on interroge les deux.
  const parDomaine = {};
  for (const s of sources) {
    if (estMoteur(s.url)) continue;
    const d = domaineDe(s.url);
    if (!d) continue;
    (parDomaine[d] = parDomaine[d] || []).push(s);
  }

  // 3. Pour chaque acteur, chercher ses sources.
  const resultat = acteurs.map((a) => {
    const trouvees = new Map();               // id de source → source

    // 3a. Par domaine. On accepte aussi les sous-domaines (« nl.pepper.com »
    //     pour « pepper.com ») et l'inverse — un acteur peut déclarer
    //     « amazon.fr » là où la source est « amazon.com.be ».
    for (const d of (a.domaines || (a.domaine ? [a.domaine] : []))) {
      for (const [sd, liste] of Object.entries(parDomaine)) {
        if (sd === d || sd.endsWith('.' + d) || d.endsWith('.' + sd)) {
          for (const s of liste) trouvees.set(s.id, s);
        }
      }
    }

    // 3b. Par nom — le seul chemin possible pour les sources de veille.
    for (const s of sources) {
      if (trouvees.has(s.id)) continue;
      if (memeActeur(a.nom, s.nom)) trouvees.set(s.id, s);
    }

    const liste = [...trouvees.values()];
    const flux = liste.filter((s) => s.voie === 'flux');
    const veille = liste.filter((s) => s.voie !== 'flux');
    // Un acteur relié par les DEUX voies est « flux » : dès qu'une source le lit
    // directement, il est branché. On garde les deux listes pour l'affichage.
    const etat = flux.length ? 'flux' : (veille.length ? 'veille' : 'aucun');
    const annonces = liste.reduce((n, s) => n + (annoncesDe[s.nom] || 0), 0);

    return {
      ...a,
      etat,
      liaison: {
        flux: flux.map((s) => ({ nom: s.nom, rubrique: s.rubrique || '—', pays: s.pays || '' })),
        veille: veille.map((s) => ({ nom: s.nom, rubrique: s.rubrique || '—', pays: s.pays || '' })),
      },
      annonces,
    };
  });

  // 4. Le même bilan, par catégorie — c'est la vue qui dit où travailler.
  const parCategorie = {};
  for (const a of resultat) {
    const c = parCategorie[a.categorie] = parCategorie[a.categorie]
      || { categorie: a.categorie, acteurs: 0, flux: 0, veille: 0, aucun: 0, annonces: 0 };
    c.acteurs += 1;
    c[a.etat] += 1;
    c.annonces += a.annonces;
  }

  const compteurs = resultat.reduce((t, a) => {
    t.acteurs += 1; t[a.etat] += 1; t.annonces += a.annonces;
    return t;
  }, { acteurs: 0, flux: 0, veille: 0, aucun: 0, annonces: 0 });

  return {
    acteurs: resultat,
    categories: Object.values(parCategorie)
      .sort((x, y) => y.acteurs - x.acteurs || x.categorie.localeCompare(y.categorie)),
    compteurs,
  };
}
