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

/** Codes de pays et suffixes d'adresse. Ils traînent dans les noms
 *  (« Aldi (BE) », « Zooplus.be ») et empêchaient la correspondance EXACTE :
 *  « aldi » contre « aldibe » ne se rejoignaient pas, et Aldi, Lidl et Hema
 *  ressortaient « pas suivis du tout » alors que trois sources les surveillent.
 *  MESURÉ, pas supposé : c'est le défaut qui a fait apparaître ces trois
 *  enseignes en « aucun » au premier essai. */
const MOTS_PAYS = new Set([
  'be', 'fr', 'nl', 'de', 'lu', 'uk', 'gb', 'es', 'it', 'pt', 'pl', 'se',
  'at', 'ie', 'ch', 'eu', 'com', 'net', 'org', 'www', 'ex',
]);

/** Les formes normalisées d'un fragment de nom : une version COLLÉE (pour la
 *  correspondance exacte) et une version ESPACÉE (pour la correspondance par
 *  mots entiers — voir plus bas pourquoi il faut les deux). */
function formesFragment(fragment) {
  const collage = new Set(), espace = new Set();
  const mots = sansAccents(String(fragment || '').toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter((m) => m && !MOTS_PAYS.has(m));
  if (!mots.length) return { collage, espace };
  const ajouter = (liste) => {
    if (!liste.length) return;
    collage.add(liste.join(''));
    espace.add(liste.join(' '));
  };
  ajouter(mots);
  const coupe = [...mots];
  while (coupe.length > 1 && MOTS_VIDES.has(coupe[coupe.length - 1])) coupe.pop();
  while (coupe.length > 1 && MOTS_VIDES.has(coupe[0])) coupe.shift();
  ajouter(coupe);
  return { collage, espace };
}

/** Toutes les formes d'un nom, collage et espacées réunies. */
function formes(nom) {
  const brut = sansAccents(String(nom || '').toLowerCase()).replace(/[’']/g, ' ');
  const collage = new Set(), espace = new Set();
  const ajouter = (fragment) => {
    const f = formesFragment(fragment);
    for (const x of f.collage) collage.add(x);
    for (const x of f.espace) espace.add(x);
  };
  // Ce qui est entre parenthèses : souvent un ancien nom, donc une enseigne que
  // l'application connaît déjà sous ce nom-là.
  for (const m of brut.matchAll(/\(([^)]*)\)/g)) ajouter(m[1]);
  for (const part of brut.replace(/\([^)]*\)/g, ' ').split(/\s*[&/]\s*|\s+et\s+/)) ajouter(part);
  return { collage: [...collage], espace: [...espace] };
}

/** Les formes collées d'un nom — c'est ce que lisent les tests et l'affichage. */
export function variantes(nom) {
  return formes(nom).collage;
}

/** Les formes d'un nom, prêtes à être comparées. Exporté pour que le panneau
 *  puisse précalculer celles de chaque marchand UNE fois, au lieu de les
 *  recalculer à chaque comparaison : sur 139 acteurs et des centaines de
 *  marchands, la différence se voit à l'écran. */
export const formesDe = (nom) => formes(nom);

/** Noms d'enseignes que la base et les sources écrivent différemment.
 *  Chaque ligne a été MESURÉE : sans elle, l'acteur ressort « pas suivi » alors
 *  qu'une source le surveille, et on chercherait une panne inexistante. */
const ALIAS = [
  ['Schoenen Torfs', 'Torfs'],        // la base nomme le chausseur, les sources disent « Torfs »
];

/** Deux noms désignent-ils le même acteur ? */
export function memeActeur(a, b) {
  const fa = formes(a), fb = formes(b);
  for (const [acteur, source] of ALIAS) {
    if (memeSimple(fa, formes(acteur)) && memeSimple(fb, formes(source))) return true;
    if (memeSimple(fb, formes(acteur)) && memeSimple(fa, formes(source))) return true;
  }
  return memeSimple(fa, fb);
}

/**
 * La comparaison, dans cet ordre — et le second point est un DÉFAUT CORRIGÉ.
 *
 *   1. ÉGALITÉ des formes collées, dès 3 caractères : « HEMA » = « hema ».
 *   2. APPARTENANCE par MOTS ENTIERS, dès 5 caractères. On compare des mots, pas
 *      des bouts de mots. MESURÉ : la version qui collait tout rapprochait
 *      « Mobil.se » de « Mobile Vikings » (le mot « mobil » est bien contenu
 *      dans « mobilevikings ») et « Mr.Bricolage » de « Brico ». Deux liaisons
 *      fausses, du genre qui fait croire qu'un acteur est couvert quand il ne
 *      l'est pas — exactement ce qu'il ne faut pas.
 *      Par mots entiers : « mobil » n'est pas un mot de « mobile vikings », et
 *      « brico » n'est pas un mot de « mr bricolage ». Plus de faux positif.
 *      Et la vraie liaison tient : « Torfs » EST un mot de « Schoenen Torfs ».
 */
function memeSimple(fa, fb) {
  for (const x of fa.collage) {
    for (const y of fb.collage) if (x === y && x.length >= 3) return true;
  }
  for (const x of fa.espace) {
    for (const y of fb.espace) {
      const court = x.length <= y.length ? x : y;
      const long = x.length <= y.length ? y : x;
      if (court.length >= 5 && ` ${long} `.includes(` ${court} `)) return true;
    }
  }
  return false;
}

/** La comparaison de deux ensembles de formes DÉJÀ calculées. Exportée pour que
 *  le panneau compare sans recalculer : c'est la même règle, appelée plus vite. */
export const memeFormes = memeSimple;

/** Le domaine d'une adresse, sans « www. ». Chaîne vide si ce n'en est pas une. */
export function domaineDe(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return ''; }
}

/** Un moteur de recherche n'est pas un site marchand : c'est un moyen de VOIR un
 *  marchand. Ses « domaines » ne doivent donc jamais servir de liaison. */
export const estMoteur = (url) => /news\.google\.com|bing\.com\/news/.test(String(url || ''));

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

    // ON REGROUPE PAR NOM DE SITE, et ce n'est pas cosmétique : un même site a
    // souvent PLUSIEURS sources. Coolblue en a dix (huit pages belges, une
    // néerlandaise, une allemande), Delhaize en a quatre (deux en français,
    // deux en néerlandais). Sans ce regroupement :
    //   - les annonces étaient comptées dix fois — MESURÉ : 56 262 annonces
    //     annoncées pour un catalogue de 13 369. Un chiffre faux d'un facteur
    //     quatre, qui aurait fait croire à un marché belge bien couvert ;
    //   - la liste affichait dix fois « Coolblue ».
    // Ce que B veut voir, c'est un SITE, pas une ligne de configuration.
    const parNom = new Map();
    for (const s of liste) if (!parNom.has(s.nom)) parNom.set(s.nom, s);
    const sites = [...parNom.values()];

    const flux = sites.filter((s) => s.voie === 'flux');
    const veille = sites.filter((s) => s.voie !== 'flux');
    // Un acteur relié par les DEUX voies est « flux » : dès qu'une source le lit
    // directement, il est branché. On garde les deux listes pour l'affichage.
    const etat = flux.length ? 'flux' : (veille.length ? 'veille' : 'aucun');
    const annonces = sites.reduce((n, s) => n + (annoncesDe[s.nom] || 0), 0);

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
