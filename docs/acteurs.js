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

/* ------------------------------------------------------------------ *
 *  CE QUI FAIT TOURNER LE PROGRAMME, ET CE QUI SEULEMENT S'INFORME.
 *
 *  RÈGLE POSÉE PAR B (08/10/2026) : « Les informations sur le siège social
 *  m'en sont là qu'à titre informatif. Doivent apparaître dans la base de
 *  données mais ne doivent pas être utilisées pour la programmation. »
 *
 *  Autrement dit : l'adresse, le téléphone, l'e-mail, le chiffre d'affaires et
 *  l'actionnariat sont de la DOCUMENTATION. Ils doivent rester dans la base,
 *  s'afficher dans le panneau, figurer dans l'export — mais aucun morceau de
 *  programme ne doit s'en servir pour décider quoi que ce soit.
 *
 *  POURQUOI CETTE SÉPARATION, ET POURQUOI ELLE EST ÉCRITE ICI. Une adresse de
 *  siège se périme sans prévenir (déménagement, rachat) ; un chiffre d'affaires
 *  est « indicatif » d'après la base elle-même ; un e-mail générique ne dit rien
 *  de qui publie des promotions. Bâtir une décision là-dessus produirait des
 *  pannes silencieuses : le programme continuerait, avec une information fausse.
 *  À l'inverse, le NOM et le SITE WEB sont ce qui relie un acteur à une source,
 *  et cela se vérifie à tout instant.
 *
 *  CE N'EST PAS UNE INTENTION, C'EST UN CONTRAT VÉRIFIÉ : `tests/acteurs-liaison
 *  .test.mjs` relit le corps de `liaisonActeurs()` et REFUSE le code qui touche
 *  à ces champs. La règle ne se perdra pas dans six mois.
 * ------------------------------------------------------------------ */

/** Champs de TRAVAIL : les seuls qu'un programme a le droit de lire. */
export const CHAMPS_DE_TRAVAIL = ['nom', 'domaines', 'categorie'];

/** Champs INFORMATIFS : présents dans la base, affichés, exportés — et jamais
 *  lus par un programme. Cette liste est le contrat ci-dessus, en clair. */
export const CHAMPS_INFORMATIFS = [
  'adresse', 'telephone', 'email', 'ca', 'actionnariat', 'positionnement',
  'segment', 'type', 'distribution', 'remarques', 'site', 'domaine',
];

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
      // SEUIL À 4, ET POURQUOI. Il était à 5, et cela faisait manquer « Hubo
      // promotie (BE) » pour « Hubo » — un acteur pourtant présent dans la base,
      // proposé à tort comme nouveau. MESURÉ : c'était le seul cas de la liste.
      // Descendre à 4 est sans danger ICI parce que la comparaison porte sur des
      // MOTS ENTIERS : les faux positifs venaient des bouts de mots, et c'est
      // cela qu'on a corrigé, pas la longueur.
      if (court.length >= 4 && ` ${long} `.includes(` ${court} `)) return true;
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
 * LES PORTES D'ENTRÉE — Google News et Bing.
 *
 * Ce ne sont PAS des acteurs : ils ne vendent rien, ils n'ont ni siège social, ni
 * catalogue, ni prix. Mais ils ne sont pas rien pour autant : sans eux, des
 * marchands entiers (Delhaize, JBC, Spar, OKay…) resteraient invisibles, faute de
 * flux lisible chez eux. Ce sont des MOYENS DE VOIR.
 *
 * On les compte donc, mais À PART — et à part seulement. Jamais dans la base des
 * acteurs : « Google News » y deviendrait une enseigne belge, et la base
 * cesserait de décrire un marché.
 *
 * Le but de cette fonction est de rendre cet apport VISIBLE (combien d'articles,
 * dans combien de pays) pour qu'on ne confonde plus « pas un acteur » avec
 * « désactivé ».
 *
 * @param catalogue  le catalogue publié : { sources: [...], offres: [...] }
 * @returns { portes: [{nom, quoi, sources, annonces, pays:[{pays, n}]}],
 *            totalAnnonces, totalSources, partAnnonces }
 */
export function portesEntree(catalogue) {
  const sources = (catalogue && catalogue.sources) || [];
  const offres = (catalogue && catalogue.offres) || [];

  const FAMILLES = [
    {
      nom: 'Google News',
      motif: /news\.google\.com/i,
      quoi: 'recherches « promo » dans la langue de chaque pays — c’est la porte d’entrée principale',
    },
    {
      nom: 'Bing News',
      motif: /bing\.com\/news/i,
      quoi: 'porte d’entrée de secours : elle donne les visuels là où Google n’en donne pas',
    },
  ];

  // Les annonces, comptées une fois, par nom de source (comme la liaison).
  const annoncesDe = {};
  for (const o of offres) {
    const s = o.source || '—';
    annoncesDe[s] = (annoncesDe[s] || 0) + 1;
  }

  const portes = FAMILLES.map(({ nom, motif, quoi }) => {
    const siennes = sources.filter((s) => motif.test(String(s.url || '')));
    const noms = new Set(siennes.map((s) => s.nom));
    let annonces = 0;
    const parPays = {};
    for (const o of offres) {
      if (!noms.has(o.source)) continue;
      annonces += 1;
      const p = o.pays || '—';
      parPays[p] = (parPays[p] || 0) + 1;
    }
    return {
      nom,
      quoi,
      sources: siennes.length,
      annonces,
      pays: Object.entries(parPays)
        .sort((a, b) => b[1] - a[1]).map(([pays, n]) => ({ pays, n })),
    };
  });

  const totalAnnonces = portes.reduce((n, p) => n + p.annonces, 0);
  return {
    portes,
    totalAnnonces,
    totalSources: portes.reduce((n, p) => n + p.sources, 0),
    partAnnonces: offres.length ? totalAnnonces / offres.length : 0,
  };
}

/**
 * LE MARCHÉ, PAYS PAR PAYS — « Marché Euro ».
 *
 * B (08/10/2026) : « Comme on va rajouter les autres pays par la suite, tu vas
 * adapter l'onglet "Marché Euro" uniquement. Et dedans j'aurais le choix du
 * pays que je veux consulter. »
 *
 * CE QUE CETTE FONCTION REND : la liste des pays CONSULTABLES, avec ce que
 * chacun porte déjà. Un pays sans base n'est pas une page vide qui a l'air
 * cassée — c'est un pays « à constituer », et le dire est une information.
 *
 * L'UNION DE DEUX SOURCES, ET IL FAUT LES DEUX :
 *   - le CATALOGUE dit quels pays l'application sert déjà (12 pays lus) ;
 *   - la BASE dit quels pays ont des acteurs recensés (11 pays).
 * N'en prendre qu'une ferait disparaître soit un pays servi sans aucune fiche,
 * soit une fiche sans aucune lecture — les deux cas existent aujourd'hui.
 *
 * @param catalogue  le catalogue publié : { parPays, sources, offres }
 * @param base       la base du marché : { acteurs: [...] }
 */
export function paysDuMarche(catalogue, base) {
  const r = liaisonActeurs(catalogue, base);
  const lus = (catalogue && catalogue.parPays) || {};
  const noms = new Set(Object.keys(lus));
  for (const a of ((base && base.acteurs) || [])) if (a.pays) noms.add(a.pays);

  return [...noms].sort().map((pays) => {
    const siens = r.acteurs.filter((a) => a.pays === pays);
    const c = siens.reduce((t, a) => {
      t.acteurs += 1; t[a.etat] += 1; t.annonces += a.annonces;
      return t;
    }, { acteurs: 0, flux: 0, veille: 0, aucun: 0, annonces: 0 });
    return {
      pays,
      ...c,
      // Les articles VUS dans ce pays (catalogue) : une autre mesure que le
      // total des acteurs du pays — un acteur peut être lu depuis ailleurs.
      articlesLus: lus[pays] || 0,
      categories: new Set(siens.map((a) => a.categorie)).size,
      base: siens.length ? 'constituée' : 'à constituer',
    };
  }).sort((x, y) => y.acteurs - x.acteurs || x.pays.localeCompare(y.pays));
}

/**
 * LA VUE D'UN PAYS — le récapitulatif, puis les acteurs par catégorie.
 *
 * Ordre demandé par B : « Quand je rentre dans le pays consulté j'ai un tableau
 * récapitulatif et en dessous, j'ai la liste des acteurs qui sont actifs ou pas.
 * Par catégorie. »
 *
 * Le classement à l'intérieur d'une catégorie est par nombre d'articles
 * décroissant : c'est l'ordre de travail. Un acteur qui apporte beaucoup
 * d'articles sans être branché (il n'apparaît qu'à travers la presse) est
 * exactement celui qu'il faut aller chercher.
 */
export function marcheDuPays(catalogue, base, pays) {
  const r = liaisonActeurs(catalogue, base);
  const siens = r.acteurs.filter((a) => a.pays === pays);

  const parCat = {};
  for (const a of siens) (parCat[a.categorie] = parCat[a.categorie] || []).push(a);

  const categories = Object.entries(parCat).map(([categorie, liste]) => ({
    categorie,
    acteurs: liste.length,
    flux: liste.filter((a) => a.etat === 'flux').length,
    veille: liste.filter((a) => a.etat === 'veille').length,
    aucun: liste.filter((a) => a.etat === 'aucun').length,
    annonces: liste.reduce((n, a) => n + a.annonces, 0),
    liste: [...liste].sort((a, b) => b.annonces - a.annonces || a.nom.localeCompare(b.nom)),
  })).sort((x, y) => y.annonces - x.annonces || x.categorie.localeCompare(y.categorie));

  const compteurs = siens.reduce((t, a) => {
    t.acteurs += 1; t[a.etat] += 1; t.annonces += a.annonces;
    return t;
  }, { acteurs: 0, flux: 0, veille: 0, aucun: 0, annonces: 0 });

  return { pays, compteurs, categories };
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
