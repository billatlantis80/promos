/* =============================================================================
   LES RÈGLES D'AFFICHAGE — ce qui décide qu'une offre entre dans la vue par
   défaut, et POURQUOI elle en sort.

   Extrait de app.js le 15/10/2026 pour être lu par TROIS fichiers au lieu d'un :
     — app.js, qui dessine le site ;
     — admin/index.html, qui liste les offres REFUSÉES avec leur motif, pour que
       B puisse vérifier les filtres ;
     — les épreuves, qui les importent au lieu de les découper dans du texte.
   Deux copies de ces règles divergeraient : il n'y en a donc qu'une.

   ⚠ AUCUN ACCÈS AU DOM ICI — c'est ce qui le rend partageable et éprouvable.
   ============================================================================= */
export const REMISE_MIN = 15;

/*  ÉTAGE 2 — l'offre d'ENSEIGNE.
 *
 *  Pourquoi il a fallu un second étage, et pourquoi ce n'est pas un
 *  relâchement de la règle : mesuré sur les données réelles, les 317 promos à
 *  deux prix réels étaient 311 fois chez Amazon. Or les grandes enseignes
 *  européennes NE publient PAS de prix barré lisible — sondé une par une,
 *  MediaMarkt (BE/NL/PL), bol.com, Coolblue, Darty, Fnac, Currys, Argos,
 *  Elgiganten, Worten : 403, 429, ou page vide. Aucune ne livre de donnée
 *  produit. Exiger deux prix barrés partout, c'était donc afficher 98 %
 *  d'Amazon : l'inverse du catalogue demandé.
 *
 *  Ce qu'on peut prouver pour une enseigne : le PRIX RÉEL affiché, le NOM de
 *  la boutique, et un signe de qualité qui ne vient pas de nous — soit une
 *  remise annoncée ≥ 15 %, soit le score que la communauté donne au bon plan
 *  (≥ 100°). Le reste est jeté.
 */
export const CHALEUR_MIN = 100;

/** Un pourcentage ANNONCÉ (et non calculé entre deux prix réels) ne vaut que
 *  s'il est crédible. Au-delà de 90 %, ce n'est plus une remise : « 99 % sRGB »
 *  dans le titre d'un écran d'occasion a déjà produit une fausse remise de
 *  99 %, et l'offre est entrée dans les « bonnes promos » par cette porte. Un
 *  faux pourcentage est pire que pas d'offre. */
export const REMISE_ANNONCEE_MAX = 90;
export const remiseCredible = (o) => o.remise != null && o.remise >= REMISE_MIN && o.remise <= REMISE_ANNONCEE_MAX;

/** La remise qu'on peut MONTRER sur la carte, ou null.
 *
 *  Distinction nécessaire : une offre peut être légitime (score communautaire
 *  478°, prix réel de 63,99 € chez un vrai marchand) et porter malgré tout un
 *  faux pourcentage dans son titre — le Dell P2422H « 99 % sRGB » passait ainsi
 *  avec « -99 % » écrit sur la carte. L'offre reste, le pourcentage faux part.
 */
export function remiseMontrable(o) {
  if (o.remise == null || o.remise < REMISE_MIN) return null;
  return (o.remiseCalculee || o.remise <= REMISE_ANNONCEE_MAX) ? o.remise : null;
}

/** Un journal n'est pas une enseigne : « Le Parisien » vend du papier, pas des
 *  écouteurs. Sans ce crible, les rédactions (Le Parisien, Forbes, Les
 *  Numériques, HDblog, dslweb, Mac4Ever…) remplissaient les 40 % et
 *  l'étiquette « enseigne » devenait un mensonge. */
/* LES NOMS DE RÉDACTION — ET CE QU'ON EN A RETIRÉ LE 15/10/2026.
 *
 * Ce filtre sert à DEUX choses opposées : écarter une rédaction de la porte des
 * enseignes (voir estOffreEnseigne), et y faire entrer un article de presse quand
 * il porte un vrai prix (voir estBonPlanPresse).
 *
 * Il se terminait par des SUFFIXES DE DOMAINE NUS — \.fr \.com \.it \.net \.be
 * \.de \.es \.pt \.pl \.se \.ie \.uk \.nl — ajoutés pour reconnaître un article
 * cité par son domaine. Mesuré le 15/10/2026 : ils attrapaient aussi TOUTE
 * BOUTIQUE dont le nom porte son extension. Les deux effets ont été constatés à
 * l'écran, sur le site en ligne :
 *   — l'étiquette : « presse » était annoncé sur des boutiques (Parfimo.de,
 *     Lieblingsfoto.de), et le bouton d'une carte bol.com à deux prix réels
 *     disait « Lire le bon plan » au lieu de « Voir chez bol.com » — une
 *     promotion prouvée servie comme un article de journal ;
 *   — des promotions RETENUES hors de la vue par défaut : 63 de plus s'affichent
 *     sans ces 13 motifs (5 997 → 6 060, mesuré sur le catalogue du 14/10 22 h 45).
 * Les vrais noms de presse restent dans la liste, donc la « presse » ne garde que
 * ce qui est de la presse (mesuré : les 4 cartes TuttoAndroid).
 *
 * Ce qui avait été payé, et ne doit pas revenir : un `|\.xx\b` ajouté « pour
 * reconnaître un domaine » attrape aussi les enseignes qui publient leur adresse.
 */
export const REDACTIONS = /(parisien|figaro|[ée]quipe|forbes|independent|mashable|estad|express|ginjfo|phototrend|labomaison|iphoneaddict|mac4ever|watchgeneration|num[ée]rique|phonandroid|dslweb|hdblog|tuttotech|tomshw|tuttoandroid|presse|dealabs|hotukdeals|mydealz|chollometro|preisjaeger|journal|magazine|bloomberg|wired|verge|01net|frandroid|clubic|journaldugeek|numerama|presse-citron|tomshardware)/i;

/** Noms de marchand qui ne désignent AUCUNE boutique : le nom de la source
 *  elle-même quand le flux ne dit rien, ou un domaine brut. */
export const MARCHANDS_NON_BOUTIQUE = /^(dealabs|hotukdeals|mydealz|chollometro|pepper(\s+(nl|pl))?|preisjaeger|presse|nl|pl|fr|de|es|it|pt|se|ie|gb|uk|at|be|marchand|abc|deal|deals)$/i;

export const estAmazon = (o) => /amazon/i.test(String(o.marchand || ''));

/** Étage 1 — deux prix réels affichés, remise ≥ 15 %. C'est la preuve montrable. */
export const estPromoVerifiee = (o) => o.prix != null && o.prixAvant != null && o.prixAvant > o.prix
  && o.remise != null && o.remise >= REMISE_MIN;

/** Étage 2 — une vraie boutique, un prix réel, et un signe de qualité.
 *
 *  Deux signes, et deux seulement :
 *   — une remise annoncée par la source, crédible (≥ 15 % et ≤ 90 %) ;
 *   — ou le score que la communauté donne au bon plan (≥ 100°).
 *
 *  DÉFAUT CORRIGÉ — l'étage acceptait aussi toute offre publiée sur la « page
 *  d'offres » d'une enseigne. L'intention était de sauver la couverture belge :
 *  sans cela, la Belgique ne rendait que 8 lignes. Mesure faite sur cette page :
 *  22 produits, 5 seulement portent un prix de référence, UN SEUL atteint 15 %.
 *  Ce n'est donc pas une page de promotions, c'est un catalogue à prix nu — et
 *  la faire passer remplissait l'application d'annonces sans aucune réduction,
 *  précisément ce qu'un utilisateur venu chercher des bons plans ne veut pas.
 *  Une enseigne n'entre plus ici que si elle apporte une réduction réelle. */
export function estOffreEnseigne(o) {
  if (estAmazon(o)) return false;
  if (o.prix == null || !o.marchand) return false;
  const m = String(o.marchand).trim();
  if (!m || MARCHANDS_NON_BOUTIQUE.test(m) || REDACTIONS.test(m)) return false;
  if (remiseCredible(o)) return true;                             // remise annoncée par la source
  return o.temperature != null && o.temperature >= CHALEUR_MIN;   // score de la communauté
}

/** Étage 3 — la PRESSE, à la demande de l'utilisateur.
 *
 *  Un article de presse n'est PAS une enseigne : on ne l'étiquette jamais
 *  comme telle, sinon l'étiquette ment. Mais quand il porte un prix réel ET une
 *  remise annoncée ≥ 15 %, c'est un vrai bon plan — « les écouteurs Nothing Ear
 *  (3) chutent à 96 € au lieu de 179 € ». Ces articles sont donc admis, marqués
 *  « presse », et comptés dans les 40 % aux côtés des enseignes.
 */
export function estBonPlanPresse(o) {
  if (o.prix == null || !remiseCredible(o)) return false;
  const m = String(o.marchand || '').trim();
  // Le nom de la source (dealabs, pepper, presse…) n'est pas une signature :
  // il ne dit pas qui a relevé l'offre, donc il n'entre pas ici.
  if (!m || MARCHANDS_NON_BOUTIQUE.test(m)) return false;
  return REDACTIONS.test(m);
}

/** Étage 4 — la BONNE AFFAIRE : ni prix, ni remise chiffrable.
 *
 *  Nécessaire parce que les grandes enseignes refusent qu'on lise leurs prix
 *  (Media Markt, Bol, Argos, Tesco, Costco, Media Expert, Allegro, Biedronka…).
 *  Leurs promotions n'existent chez nous que RELAYÉES par les communautés : nom
 *  de la boutique, photo, lien, score d'intérêt — mais aucun prix. Les jeter,
 *  c'était perdre l'enseigne entière.
 *
 *  On les montre donc pour ce qu'elles sont : une photo, un titre, une
 *  boutique, un lien — et AUCUN prix, puisque nous n'en avons pas. Le badge
 *  « bonne affaire » le dit à l'écran : jamais de pourcentage inventé, jamais de
 *  prix déduit du titre.
 *
 *  Deux garde-fous : la source doit être une COMMUNAUTÉ (c'est elle qui nomme
 *  la boutique — un journal n'est pas un marchand), et le bon plan doit être
 *  réellement populaire (≥ 100°). Amazon est exclu : ses offres se prouvent par
 *  leurs deux prix, ailleurs dans l'application.
 */
export const CHALEUR_AFFAIRE = 100;

export function estBonneAffaire(o) {
  if (o.prix != null) return false;                       // un prix ⇒ étage 1 ou 2
  if (estAmazon(o)) return false;                         // Amazon se prouve par ses prix
  if (!o.titre || !(o.lienMarchand || o.lienPage)) return false;
  if (!SOURCE_COMMUNAUTE.test(String(o.sourceId || ''))) return false;
  const m = String(o.marchand || '').trim();
  if (!m || MARCHANDS_NON_BOUTIQUE.test(m) || REDACTIONS.test(m)) return false;
  return o.temperature != null && o.temperature >= CHALEUR_AFFAIRE;
}

export const estBonnePromo = (o) => estPromoVerifiee(o) || estOffreEnseigne(o) || estBonPlanPresse(o) || estBonneAffaire(o);

/** Clé de dédoublonnage : le même produit au même prix chez la même boutique
 *  n'a pas à figurer deux fois. Cas réel : l'Allemagne et l'Autriche partagent
 *  amazon.de — le même Fire TV Stick apparaissait deux fois de suite. */
export const cleProduit = (o) => `${String(o.titre || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90)}|${o.prix}`;

export function dedoublonner(liste) {
  const vus = new Set();
  const sortie = [];
  for (const o of liste) {
    const k = cleProduit(o);
    if (vus.has(k)) continue;
    vus.add(k);
    sortie.push(o);
  }
  return sortie;
}

/*  MÉLANGE 60 % / 40 % — EN PAUSE.
 *
 *  Ce que la règle faisait : la majorité des résultats devait pointer chez
 *  Amazon (lien direct, commissions), et 40 % vers les autres enseignes du pays.
 *  C'était un plafond des DEUX côtés — donc une vraie proportion, et pas une
 *  simple préférence de tri. Sans plafond sur les enseignes, la Belgique
 *  (44 promos Amazon pour 157 offres d'enseignes) affichait 22 % d'Amazon ;
 *  sans plafond sur Amazon, les pays riches en ventes flash repartaient à 98 %.
 *
 *  POURQUOI ELLE EST EN PAUSE (B, 08/10/2026) : « mettre en pause le 60/40 en
 *  faveur d'Amazon, tous les acteurs affichent en fonction de ce qu'il publie,
 *  sans préférence. » Autrement dit : l'ordre ne doit plus être arbitré entre
 *  deux camps, il doit suivre ce que chaque acteur apporte réellement.
 *
 *  MISE EN PAUSE, PAS SUPPRESSION. La règle reste écrite, complète, et elle
 *  reste ÉPROUVÉE (voir tests/melange.test.mjs, qui la rejoue avec l'interrupteur
 *  sur « actif »). Le jour où on la rallume, elle sera exactement celle qu'on
 *  connaissait — on ne réécrira pas une règle de mémoire.
 *
 *  CE QUI CHANGE À L'ÉCRAN. Plus de plafond, plus de quotas de camps, plus
 *  d'alternance : la liste est simplement classée par ce que les offres valent
 *  (remise, prix, intérêt), tous acteurs mêlés. Aucune offre n'est écartée au
 *  nom d'une proportion — c'était le vrai enjeu, puisqu'un plafond SACRIFIE des
 *  offres réelles pour tenir un pourcentage.
 */
export const MELANGE_ACTIF = false;

export const PART_AMAZON = 0.6;

/** Sous ce nombre de lignes, une liste ne se juge plus : plutôt que de
 *  sacrifier des offres réelles à une proportion, on montre tout. Plancher
 *  mesuré sur le cas polonais (16 Amazon pour 1 enseigne → 2 lignes). */
export const MELANGE_MIN = 24;

/** Part des 40 % réservée à la presse quand des articles existent. Sans ce
 *  quota, le plafond coupait toujours la queue du camp — donc tous les articles
 *  de presse, puisqu'ils sont classés après les boutiques : les « quelque
 *  annonce presse » demandées disparaissaient en totalité. Dix pour cent, c'est
 *  « quelques-unes » : présent, jamais envahissant. */
export const QUOTA_PRESSE = 0.1;

/** Part des 40 % réservée aux BONNES AFFAIRES sans prix (voir estBonneAffaire).
 *  Sans quota, elles étaient classées après les offres à prix et le plafond les
 *  évincait toutes : les enseignes qu'on ne peut pas chiffrer (Bol, Media
 *  Expert, Tesco, Argos…) n'auraient jamais été visibles — exactement ce qu'on
 *  cherche à corriger. */
export const QUOTA_AFFAIRE = 0.25;

/** Les sources qui RELAIENT un bon plan — les communautés. Elles nomment la
 *  boutique et donnent le score d'intérêt : c'est ce qui autorise une « bonne
 *  affaire » sans prix. Les sources de presse, elles, signent l'article du nom
 *  du journal, qui n'est pas une boutique. */
export const SOURCE_COMMUNAUTE = /^(dealabs|mydealz|chollometro|pepper|hotukdeals|preisjaeger)/i;

/** Entrelace deux listes selon la part cible de la première.
 *  Sert à RÉPARTIR les bonnes affaires dans tout le camp des 40 % au lieu de
 *  les entasser à la fin : groupées, il fallait dérouler plus de 1 600 cartes
 *  pour en croiser une — autant dire jamais. */
export function entrelacer(a, b, partA) {
  const total = a.length + b.length;
  const sortie = [];
  let i = 0;
  let j = 0;
  for (let k = 0; k < total; k += 1) {
    const veutA = Math.round((k + 1) * partA) > i;
    if (i < a.length && (veutA || j >= b.length)) sortie.push(a[i++]);
    else sortie.push(b[j++]);
  }
  return sortie;
}

export function melanger(liste, cmp) {
  // Chaque camp est trié AVANT d'alterner. Sans ça, un tri appliqué après coup
  // (par remise décroissante) remettait tous les Amazon en tête : le mélange
  // existait dans les données et disparaissait à l'écran. Mesuré sur le site
  // publié : vingt cartes Amazon d'affilée sous un en-tête annonçant 60/40.
  const tri = cmp || (() => 0);
  // EN PAUSE : la liste est rendue classée telle quelle — pas d'arbitrage entre
  // deux camps, pas de plafond, pas de quota, pas d'alternance. Conséquence
  // voulue : AUCUNE offre n'est sacrifiée pour tenir un pourcentage, et l'ordre
  // suit ce que chaque acteur publie.
  if (!MELANGE_ACTIF) return [...liste].sort(tri);
  const amazon = liste.filter(estAmazon).sort(tri);
  // Dans le camp des 40 %, les BOUTIQUES passent avant la presse. Les articles
  // ont souvent deux prix réels, donc un meilleur rang au tri : sans ce
  // départage, la première page d'un Belge était faite de « lire le bon plan »
  // alors que l'objectif est de renvoyer vers les enseignes.
  // Trois qualités dans le camp des 40 %, et dans cet ordre d'affichage : les
  // offres à prix prouvé d'abord, puis les bonnes affaires sans prix (les
  // enseignes qu'on ne peut pas chiffrer), puis la presse.
  const reste = liste.filter((o) => !estAmazon(o));
  const presse = reste.filter(estBonPlanPresse).sort(tri);
  const affaires = reste.filter((o) => !estBonPlanPresse(o) && estBonneAffaire(o)).sort(tri);
  const boutiques = reste.filter((o) => !estBonPlanPresse(o) && !estBonneAffaire(o)).sort(tri);
  const autres = [...boutiques, ...affaires, ...presse];
  if (!amazon.length || !autres.length) return [...liste].sort(tri);
  const nAmazon = Math.min(amazon.length, Math.floor((autres.length * PART_AMAZON) / (1 - PART_AMAZON)));
  const nAutres = Math.min(autres.length, Math.round((nAmazon * (1 - PART_AMAZON)) / PART_AMAZON));
  // Un pays qui manque d'un côté ne doit pas être puni deux fois. Mesuré sur
  // les données réelles : la Pologne a 16 promos Amazon vérifiées pour 1 offre
  // d'enseigne — tenir la proportion n'y laissait que 2 lignes à l'écran. Sous
  // MELANGE_MIN, la liste ne se juge plus : on montre TOUT ce qu'on a, et
  // l'en-tête annonce la proportion réellement atteinte, sans la maquiller.
  if (nAmazon + nAutres < MELANGE_MIN) return [...liste].sort(tri);
  // Alternance par arithmétique de rang. La version précédente était une
  // boucle gloutonne qui pouvait s'arrêter avant la fin : la queue du camp des
  // 40 % — souvent les articles de presse, désormais classés après les
  // boutiques — disparaissait alors SANS erreur ni trace. Ici le nombre de
  // lignes est exact par construction.
  // Quotas : presse et bonnes affaires sont minoritaires, mais jamais évincées
  // en totalité — sans eux, le plafond coupait la queue du camp et les
  // enseignes invisibles le restaient. Le reste va aux offres à prix prouvé.
  const nPresse = presse.length ? Math.max(1, Math.min(presse.length, Math.round(nAutres * QUOTA_PRESSE))) : 0;
  const nAffaire = affaires.length ? Math.max(1, Math.min(affaires.length, Math.round(nAutres * QUOTA_AFFAIRE))) : 0;
  const nBoutiques = Math.min(boutiques.length, Math.max(0, nAutres - nPresse - nAffaire));
  const bSel = boutiques.slice(0, nBoutiques);
  const aSel = affaires.slice(0, nAffaire);
  const partBoutique = (bSel.length + aSel.length) ? bSel.length / (bSel.length + aSel.length) : 1;
  const autRetenues = [...entrelacer(bSel, aSel, partBoutique), ...presse.slice(0, nPresse)];
  const total = nAmazon + autRetenues.length;
  const sortie = [];
  let i = 0;
  let j = 0;
  for (let k = 0; k < total; k += 1) {
    const veutAmazon = Math.round((k + 1) * PART_AMAZON) > i;
    if (i < nAmazon && (veutAmazon || j >= autRetenues.length)) sortie.push(amazon[i++]);
    else sortie.push(autRetenues[j++]);
  }
  return sortie;
}

/* Le compte par pays du SÉLECTEUR (voir `compteParPays`) porte sur TOUTES les
 * offres, pas sur les seules « bonnes promos ». Décision du propriétaire du
 * produit : un pays doit annoncer son contenu RÉEL. Un chiffre qui ne comptait
 * que les promotions faisait paraître la Belgique presque vide alors qu'elle
 * contient des milliers d'offres — l'utilisateur n'avait aucun moyen de savoir
 * où chercher. L'en-tête, lui, reste lié à la PORTÉE (« N bonnes promos » ou
 * « N offres ») : il décrit la liste affichée, ce qui est son rôle. */

/* ---- Le pays de la BOUTIQUE, quand il ne fait aucun doute ----
 *
 *  Une offre porte le pays de sa SOURCE. C'est juste pour un flux national
 *  (Dealabs est français), mais faux dès qu'une source étrangère relaie une
 *  boutique d'un autre pays : un bon plan Bol relayé par une communauté
 *  néerlandaise s'affichait sous « Pays-Bas ».
 *
 *  DÉCISION DU PROPRIÉTAIRE DU PRODUIT : rattacher le bon plan au pays de la
 *  BOUTIQUE. Mesuré AVANT d'écrire une ligne : sur 8 173 offres, cette table ne
 *  change aujourd'hui AUCUNE attribution — chaque boutique mono-pays est déjà
 *  relayée par son propre pays. Elle porte donc sur l'avenir : le jour où une
 *  source étrangère relaiera une boutique belge, l'offre ira sous la Belgique
 *  au lieu de disparaître du filtre de l'utilisateur belge.
 *
 *  Seules les boutiques SANS ambiguïté sont listées. Les enseignes présentes
 *  dans plusieurs pays — Amazon, Media Markt, Coolblue, Lidl, Carrefour, Fnac,
 *  Decathlon, Zalando, Ikea, Action, Hema, Kaufland, eBay, Steam — restent sur
 *  le pays de leur source : leur en attribuer un serait une devinette.
 */
export const PAYS_BOUTIQUE = new Map([
  // Belgique
  ['colruyt', 'BE'], ['delhaize', 'BE'], ['vanden borre', 'BE'], ['krëfel', 'BE'],
  ['krefel', 'BE'], ['brico', 'BE'], ['hubo', 'BE'], ['gamma', 'BE'],
  ['dreamland', 'BE'], ['fun', 'BE'], ['maxi toys', 'BE'], ['torfs', 'BE'],
  ['jbc', 'BE'], ['okay', 'BE'], ['bio-planet', 'BE'], ['toolstation', 'BE'],
  ['vandenborre', 'BE'], ['corail', 'BE'], ['pointcarré', 'BE'],
  // Royaume-Uni
  ['tesco', 'GB'], ['argos', 'GB'], ['currys', 'GB'], ['costco', 'GB'],
  ['asda', 'GB'], ['george at asda', 'GB'], ['boots', 'GB'], ['next', 'GB'],
  ['secret sales', 'GB'], ['loaded', 'GB'], ['shopto', 'GB'], ['screwfix', 'GB'],
  ['marks electrical', 'GB'], ['the beauty store', 'GB'], ['farmfoods', 'GB'],
  // Pologne
  ['allegro', 'PL'], ['biedronka', 'PL'], ['media expert', 'PL'], ['rtv euro agd', 'PL'],
  ['empik', 'PL'], ['inpost', 'PL'],
  // Espagne, Portugal, Italie, Pays-Bas, Allemagne
  ['pccomponentes', 'ES'], ['alcampo', 'ES'], ['traventia', 'ES'],
  ['el corte inglés', 'ES'], ['miravia', 'ES'], ['fc moto', 'ES'], ['buscounchollo', 'ES'],
  ['worten', 'PT'], ['continente', 'PT'],
  ['jumbo', 'NL'], ['nederlandse spoorwegen', 'NL'],
  ['expert', 'DE'], ['urlaubspiraten', 'DE'], ['imusic', 'DE'],
]);

/** Le pays à retenir pour une offre : celui de la BOUTIQUE s'il est certain,
 *  sinon celui de la source. Un seul point de décision, donc aucun risque
 *  qu'un filtre et un compteur ne soient plus d'accord. */
export function paysDe(o) {
  const m = String(o.marchand || '').trim().toLowerCase();
  return PAYS_BOUTIQUE.get(m) || o.pays || 'FR';
}

