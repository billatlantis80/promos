/**
 * COLLECTEUR DE PROMOS — application n°2
 * ======================================
 * Récupère les offres publiées par des sources GRATUITES et SANS CLÉ :
 * flux RSS de Dealabs (le plus gros vivier français), presse spécialisée
 * « bons plans », et Google News par requête. Aucune API payante, aucun compte,
 * aucune clé — c'est la règle du projet.
 *
 * Ce que le collecteur NE fait PAS, volontairement :
 *   - il n'INVENTE jamais un pourcentage de remise. Une remise n'est affichée
 *     que si elle est écrite dans la source, ou calculée entre deux prix
 *     réellement présents. Un faux « -70 % » fait acheter au mauvais moment.
 *   - il n'écrase pas une offre déjà connue : il la met à jour (prix, date).
 *
 * Usage : node collecteur.mjs [--verbeux]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');
const FICHIER = path.join(DATA, 'offres.json');
const VERBEUX = process.argv.includes('--verbeux');
/** Publication : écrit aussi le site statique (offres + VISUELS locaux) dans
 *  docs/, prêt pour GitHub Pages. Sans ce drapeau, on ne touche qu'aux
 *  données locales (le hub continue de relayer les visuels à la volée). */
const PUBLIER = process.argv.includes('--publier');
const DOSSIER_PUBLIE = path.join(__dirname, 'docs');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/** Seuil de « température » sous lequel une offre Dealabs n'est pas retenue.
 *  Le flux « tendance » ne contient que des offres déjà très appréciées
 *  (108° à 580° observés) : le seuil ne coupe rien aujourd'hui, il est là pour
 *  que « les meilleures » reste une règle du code et non un hasard du flux. */
const TEMPERATURE_MIN = 100;

/** Intervalle minimal entre deux appels au flux Dealabs. Le cron tourne toutes
 *  les 5 minutes ; on n'interroge Dealabs qu'une fois sur trois. Les offres
 *  déjà connues restent (la fusion les conserve) : on perd la nouveauté
 *  immédiate côté Dealabs, pas le contenu — et on arrête de taper à sa porte
 *  toutes les 5 minutes. */
const DEALABS_INTERVALLE_MS = 15 * 60 * 1000;

/* ------------------------------------------------------------------ *
 *  SOURCES — chacune testée à la main AVANT d'être branchée.
 *  « aTrier » : filtre de pertinence pour les flux généralistes (presse).
 * ------------------------------------------------------------------ */
const SOURCES = [
  // UN SEUL flux Dealabs — et c'est celui des MEILLEURES offres. « tendance »
  // (ex-« hot ») classe les bons plans par température communautaire, et chaque
  // titre porte son score (« 580° - … »). Le flux « new » est écarté : du
  // tout-venant sans score, pour deux fois plus de requêtes. Résultat : moitié
  // moins d'appels chez Dealabs, et rien que du bon.
  { id: 'dealabs-tendance', nom: 'Dealabs', type: 'dealabs', url: 'https://www.dealabs.com/rss/tendance', temperatureMin: TEMPERATURE_MIN },
  { id: 'frandroid', nom: 'Frandroid', type: 'presse', url: 'https://www.frandroid.com/feed', aTrier: true },
  { id: 'lesnumeriques', nom: 'Les Numériques', type: 'presse', url: 'https://www.lesnumeriques.com/rss.xml', aTrier: true },
  { id: 'journaldugeek', nom: 'Journal du Geek', type: 'presse', url: 'https://www.journaldugeek.com/feed/', aTrier: true },
  { id: 'clubic', nom: 'Clubic', type: 'presse', url: 'https://www.clubic.com/feed/news.rss', aTrier: true },
  { id: '01net', nom: '01net', type: 'presse', url: 'https://www.01net.com/feed/', aTrier: true },
];

/** Recherches Google News : un flux par famille de produits. Gratuit, sans clé. */
const RECHERCHES = [
  ['bricolage', 'bons plans bricolage outillage promo'],
  ['maison', 'promo électroménager maison réduction'],
  ['tech', 'bon plan high-tech réduction prix'],
  ['mode', 'promo vêtements réduction mode'],
  ['sport', 'promo sport fitness réduction'],
  ['jouets', 'promo jouets enfant réduction'],
  ['auto', 'promo accessoires auto réduction'],
];

/* ------------------------------------------------------------------ *
 *  Analyse XML minimale, sans dépendance.
 * ------------------------------------------------------------------ */
/* Décode les entités HTML.
 *
 * Le jeu nommé ci-dessous est explicite, mais les entités NUMÉRIQUES
 * (`&#160;`, `&#8217;`, `&#x27;`…) sont calculées : les flux en renvoient en
 * pagaille — espaces insécables surtout — et une liste figée les laisserait
 * traverser jusqu'à l'écran, où elles s'affichent littéralement
 * (« Xiaomi 15&#160;: »).
 */
const ENTITES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…',
  ndash: '–', mdash: '—', deg: '°', euro: '€', times: '×', middot: '·',
  laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à',
  ccedil: 'ç', ugrave: 'ù', ecirc: 'ê', ocirc: 'ô', icirc: 'î',
  acirc: 'â', ucirc: 'û', euml: 'ë', ntilde: 'ñ', oelig: 'œ',
};

function decoderEntites(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    const v = ENTITES[e] !== undefined ? ENTITES[e] : ENTITES[e.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

/** Décode jusqu'à stabilité : certaines sources double-encodent (« B&amp;amp;M »). */
function decaper(s) {
  if (typeof s !== 'string') return s;
  let t = s;
  for (let i = 0; i < 3; i++) {
    const avant = t;
    t = decoderEntites(t);
    if (t === avant) break;
  }
  return t;
}

const nettoyer = (s) => decaper(
  String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' '),
)
  // Une entité décodée peut avoir reformé une balise (« &lt;p&gt; »).
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Exporté pour les tests : ces trois fonctions sont le seul endroit où l'on
// touche au texte des sources.
export { decoderEntites, decaper, nettoyer };

const balise = (bloc, nom) => {
  const m = bloc.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, 'i'));
  return m ? m[1] : '';
};

function items(xml) {
  const out = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  if (out.length) return out;
  // Atom (Les Numériques)
  const re2 = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  while ((m = re2.exec(xml))) out.push(m[1]);
  return out;
}

/* ------------------------------------------------------------------ *
 *  Catégories — on traduit celles des sources en familles d'achat.
 * ------------------------------------------------------------------ */
const FAMILLES = {
  bricolage: ['bricolage', 'outillage', 'quincaillerie', 'jardin', 'perceuse', 'visseuse', 'peinture', 'sanitaire', 'plomberie', 'électricité', 'electricite', 'atelier', 'brico', 'leroy', 'castorama', 'bricomarché', 'bricodepot'],
  maison: ['maison', 'habitat', 'électroménager', 'electromenager', 'cuisine', 'literie', 'matelas', 'aspirateur', 'cafetière', 'robot', 'frigo', 'lave-linge', 'meuble', 'déco', 'deco', 'jardin', 'piscine', 'barbecue'],
  tech: ['high-tech', 'high tech', 'informatique', 'smartphone', 'téléphone', 'ordinateur', 'pc', 'portable', 'écran', 'ecran', 'casque', 'écouteurs', 'tv', 'téléviseur', 'console', 'gaming', 'photo', 'drone', 'ssd', 'carte graphique', 'imprimante', 'montre connectée', 'enceinte', 'clavier', 'souris', 'tablette'],
  mode: ['mode', 'vêtement', 'vetement', 'chaussure', 'sneaker', 'sac', 'bijou', 'montre', 'lingerie', 'manteau', 'pull', 'jean', 'textile'],
  sport: ['sport', 'fitness', 'musculation', 'vélo', 'velo', 'randonnée', 'running', 'football', 'natation', 'yoga', 'tennis', 'ski'],
  jouets: ['jouet', 'jeu', 'lego', 'peluche', 'poupée', 'puzzle', 'jeux de société', 'puériculture', 'bébé', 'bebe', 'enfant'],
  auto: ['auto', 'voiture', 'moto', 'pneu', 'automobile', 'garage', 'carrosserie', 'huile moteur'],
  beaute: ['beauté', 'beaute', 'parfum', 'cosmétique', 'cosmetique', 'soin', 'maquillage', 'cheveux'],
};

const CATEGORIES_DEALABS = {
  'high-tech': 'tech', 'informatique': 'tech', 'jeux vidéo & loisirs numériques': 'tech',
  'mode & accessoires': 'mode', 'maison & habitat': 'maison', 'sport & plein air': 'sport',
  'bricolage & jardin': 'bricolage', 'jeux & jouets': 'jouets', 'auto & moto': 'auto',
  'beauté & santé': 'beaute', 'culture & divertissement': 'autre', 'alimentation': 'autre',
  'voyage': 'autre', 'services': 'autre',
};

function famille(texte, categorieSource) {
  const c = String(categorieSource || '').toLowerCase().trim();
  if (CATEGORIES_DEALABS[c]) return CATEGORIES_DEALABS[c];
  // Les MOTS du titre décident d'abord : une requête Google News « promo
  // high-tech » ramène aussi des articles de mode, et leur coller la famille de
  // la requête donnait « Soldes Galeries Lafayette » classé en High-tech.
  // La famille demandée ne sert donc que de REPLI quand rien n'est reconnu.
  const bas = String(texte || '').toLowerCase();
  let meilleur = 'autre', score = 0;
  for (const [fam, mots] of Object.entries(FAMILLES)) {
    const n = compterMots(mots, bas);
    if (n > score) { score = n; meilleur = fam; }
  }
  if (meilleur !== 'autre') return meilleur;
  if (c && Object.keys(FAMILLES).includes(c)) return c;
  return 'autre';
}

/**
 * Compte les mots-clés présents. DÉFAUT CORRIGÉ : une recherche « pc », « tv »
 * ou « jeu » par simple `includes` trouvait n'importe quoi à l'intérieur des
 * URL encodées de Google News — un article de mode était classé High-tech.
 * Les mots courts exigent donc une frontière de mot.
 */
function compterMots(mots, texteBas) {
  return mots.filter((m) => (m.length <= 3
    ? new RegExp('(^|[^a-zà-ÿ])' + m + '([^a-zà-ÿ]|$)', 'i').test(texteBas)
    : texteBas.includes(m))).length;
}

/* ------------------------------------------------------------------ *
 *  Marchands — reconnus par leur nom (Dealabs) ou par le domaine du lien.
 * ------------------------------------------------------------------ */
const MARCHANDS = [
  ['Amazon', /amazon\./i], ['Cdiscount', /cdiscount\./i], ['Boulanger', /boulanger\./i],
  ['Fnac', /fnac\./i], ['Darty', /darty\./i], ['Leclerc', /leclerc\./i], ['Carrefour', /carrefour\./i],
  ['Auchan', /auchan\./i], ['Leroy Merlin', /leroymerlin\./i], ['Castorama', /castorama\./i],
  ['Brico Dépôt', /bricodepot\./i], ['Bricomarché', /bricomarche\./i], ['Mr.Bricolage', /mrbricolage\./i],
  ['ManoMano', /manomano\./i], ['Decathlon', /decathlon\./i], ['Intersport', /intersport\./i],
  ['Zalando', /zalando\./i], ['La Redoute', /laredoute\./i], ['Sarenza', /sarenza\./i],
  ['Spartoo', /spartoo\./i], ['Vinted', /vinted\./i], ['eBay', /ebay\./i], ['AliExpress', /aliexpress\./i],
  ['Cdiscount', /cdiscount\./i], ['Rue du Commerce', /rueducommerce\./i], ['LDLC', /ldlc\./i],
  ['TopAchat', /topachat\./i], ['Materiel.net', /materiel\.net/i], ['Samsung', /samsung\./i],
  ['Apple', /apple\./i], ['Google', /store\.google\./i], ['Xiaomi', /mi\.com|xiaomi\./i],
  ['Ikea', /ikea\./i], ['Conforama', /conforama\./i], ['But', /but\.fr/i], ['JouéClub', /jouéclub|joueclub/i],
  ['King Jouet', /kingjouet\./i], ['La Grande Récré', /lagranderecre\./i], ['Smyths', /smythstoys\./i],
  ['Nike', /nike\./i], ['Adidas', /adidas\./i], ['Uniqlo', /uniqlo\./i], ['H&M', /hm\.com/i],
  ['Cultura', /cultura\./i], ['Micromania', /micromania\./i], ['Norauto', /norauto\./i],
  ['Feu Vert', /feuvert\./i], ['Sephora', /sephora\./i], ['Nocibé', /nocibe\./i],
];

function marchand(nomDonne, url) {
  for (const [nom, re] of MARCHANDS) { if (nomDonne && nomDonne.toLowerCase() === nom.toLowerCase()) return nom; }
  for (const [nom, re] of MARCHANDS) { if (url && re.test(url)) return nom; }
  if (nomDonne) return String(nomDonne).trim();
  try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch { return 'marchand'; }
}

/* ------------------------------------------------------------------ *
 *  Prix et remises — uniquement ce qui est ÉCRIT dans la source.
 * ------------------------------------------------------------------ */
const versPrix = (texte) => {
  const m = String(texte || '').replace(/\u00a0|\u202f/g, ' ').match(/(\d[\d\s]*)(?:[.,](\d{1,2}))?\s*€/);
  if (!m) return null;
  const entier = Number(m[1].replace(/\s/g, ''));
  const cents = m[2] ? Number('0.' + m[2]) : 0;
  const v = entier + cents;
  return Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : null;
};

/**
 * Remise : on n'accepte QUE deux preuves.
 *   1. un pourcentage écrit noir sur blanc dans la source (« -32 % ») ;
 *   2. deux prix réels (avant / après) — le pourcentage est alors CALCULÉ.
 * Sinon : aucune remise affichée. Un faux pourcentage est pire que pas d'offre.
 */
function remise(texte, prix, prixAvant, autoriserPourcent = true) {
  // Un pourcentage TROUVÉ DANS UN TITRE n'est pas une remise produit : « jusqu'à
  // -84 % sur ces offres » est un chiffre d'accroche journalistique. L'afficher
  // comme une remise ferait croire à une bonne affaire qui n'existe pas. On ne
  // l'accepte donc que sur les offres produits (Dealabs), jamais sur la veille.
  if (autoriserPourcent) {
    const pourcent = String(texte || '').match(/[-−]\s?(\d{1,2})\s?%/);
    if (pourcent) {
      const p = Number(pourcent[1]);
      if (p > 0 && p < 100) return { pourcent: p, calculee: false };
    }
  }
  if (prix != null && prixAvant != null && prixAvant > prix) {
    return { pourcent: Math.round(((prixAvant - prix) / prixAvant) * 100), calculee: true };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  Un item → une offre normalisée.
 * ------------------------------------------------------------------ */
function offreDealabs(bloc, source) {
  // La « température » Dealabs (160°, 298°…) est collée devant certains titres.
  // Ce n'est pas le nom du produit : on la retire du titre, sinon l'offre
  // s'affiche comme « 298° - Vente flash TGV ». On la GARDE à part — c'est le
  // score communautaire, donc le seul critère honnête pour dire « la meilleure ».
  const titreBrut = nettoyer(balise(bloc, 'title'));
  const noteTemp = Number((titreBrut.match(/^\s*(\d{1,4})\s*°/) || [])[1]);
  const temperature = Number.isFinite(noteTemp) && noteTemp > 0 ? noteTemp : null;
  if (source.temperatureMin != null && temperature != null && temperature < source.temperatureMin) return null;
  const titre = titreBrut.replace(/^\s*\d{1,4}\s*°\s*[-–—]\s*/, '');
  if (!titre) return null;
  const lien = nettoyer(balise(bloc, 'link'));
  const categorieBrute = nettoyer(balise(bloc, 'category'));
  const marchandBloc = bloc.match(/<pepper:merchant[^>]*name="([^"]*)"[^>]*price="([^"]*)"/i)
    || bloc.match(/<pepper:merchant[^>]*price="([^"]*)"[^>]*name="([^"]*)"/i);
  let nomMarchand = marchandBloc ? (marchandBloc[1].includes('€') ? marchandBloc[2] : marchandBloc[1]) : '';
  const prixTexte = marchandBloc ? (marchandBloc[1].includes('€') ? marchandBloc[1] : marchandBloc[2]) : '';
  const description = nettoyer(balise(bloc, 'description'));
  // Repli : la description commence presque toujours par « <prix> - <marchand> ».
  if (!nomMarchand) {
    const m = balise(bloc, 'description').match(/-[\s]*([^<]{2,40})<\/strong>/i);
    if (m) nomMarchand = nettoyer(m[1]);
  }
  const image = (bloc.match(/<media:content[^>]*url="([^"]+)"/i) || [])[1] || '';
  const date = nettoyer(balise(bloc, 'pubDate'));
  const texte = `${titre} ${description}`;

  const prix = versPrix(prixTexte) ?? versPrix(titre);
  // Prix « avant » : souvent écrit « au lieu de 499 € » ou « 499 € au lieu de 699 € ».
  const avant = versPrix((texte.match(/au lieu de\s*([^.,;]{0,20})/i) || [])[1] || '');
  const rem = remise(texte, prix, avant);

  return {
    id: 'd' + Buffer.from((lien || titre).split('').reverse().join('')).toString('base64url').slice(0, 14),
    type: 'offre',
    titre: titre.slice(0, 220),
    lienMarchand: lien,
    lienPage: lien,
    marchand: marchand(nomMarchand, lien),
    prix,
    prixAvant: avant,
    remise: rem ? rem.pourcent : null,
    remiseCalculee: rem ? rem.calculee : false,
    categorie: famille(texte, categorieBrute),
    categorieSource: categorieBrute,
    temperature,
    image,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    source: source.nom,
    sourceId: source.id,
  };
}

const MOTS_PROMO = /(bon plan|bons plans|promo|promotion|r[ée]duction|\d+\s?%|perd \d+|prix cass|petit prix|deal|affaire|soldes|black friday|à -?\d+\s?€|chute à|tombe à)/i;

/** Le MARCHAND d'un article de presse : la boutique citée, pas le journal. */
function marchandDePresse(titre, bloc) {
  const cite = String(titre).match(/\b(?:chez|sur|par)\s+([A-ZÉÈÀÂÎÔÛ][\w&'’.-]{2,24})/);
  if (cite) {
    const nom = cite[1].replace(/[.,;:]$/, '');
    const connu = MARCHANDS.find(([n]) => n.toLowerCase() === nom.toLowerCase());
    if (connu) return connu[0];
    return nom;
  }
  const src = nettoyer(balise(bloc, 'source'));
  return src || 'presse';
}

function offrePresse(bloc, source, familleImposee) {
  const titre = nettoyer(balise(bloc, 'title'));
  if (!titre || !MOTS_PROMO.test(titre)) return null;
  const lien = nettoyer(balise(bloc, 'link')) || (bloc.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '';
  const description = nettoyer(balise(bloc, 'description') || balise(bloc, 'summary'));
  const date = nettoyer(balise(bloc, 'pubDate') || balise(bloc, 'updated'));
  const texte = `${titre} ${description}`;
  const prix = versPrix(titre);
  const avant = versPrix((texte.match(/au lieu de\s*([^.,;]{0,20})/i) || [])[1] || '');
  const rem = remise(texte, prix, avant, false);   // jamais de % d'accroche ici
  // Une VRAIE offre a un prix. Sans prix, c'est un article de veille — et une
  // remise en pourcentage sans prix n'a rien à faire dans la liste des offres.
  const type = prix != null ? 'offre' : 'article';
  return {
    id: 'p' + Buffer.from((lien || titre).split('').reverse().join('')).toString('base64url').slice(0, 14),
    type,
    titre: titre.slice(0, 220),
    lienMarchand: lien,
    lienPage: lien,
    marchand: marchandDePresse(titre, bloc),
    prix,
    prixAvant: avant,
    remise: rem ? rem.pourcent : null,
    remiseCalculee: rem ? rem.calculee : false,
    categorie: famille(titre, familleImposee || ''),
    categorieSource: familleImposee || 'presse',
    image: (bloc.match(/<media:content[^>]*url="([^"]+)"/i) || bloc.match(/<enclosure[^>]*url="([^"]+)"/i) || [])[1] || '',
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    source: source.nom,
    sourceId: source.id,
  };
}

/* ------------------------------------------------------------------ *
 *  Collecte
 * ------------------------------------------------------------------ */
async function lire(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const journal = [];
async function collecterSource(source) {
  try {
    const xml = await lire(source.url);
    const blocs = items(xml);
    const offres = blocs.map((b) => (source.type === 'dealabs' ? offreDealabs(b, source) : offrePresse(b, source))).filter(Boolean);
    journal.push({ source: source.id, ok: true, items: blocs.length, retenues: offres.length });
    if (VERBEUX) console.log(`  ${source.id} : ${blocs.length} items, ${offres.length} offres`);
    return offres;
  } catch (e) {
    journal.push({ source: source.id, ok: false, erreur: e.message });
    console.log(`  ⚠ ${source.id} : ${e.message}`);
    return [];
  }
}

async function collecterRecherche([familleId, requete]) {
  const source = {
    id: 'gnews-' + familleId, nom: 'Veille presse',
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(requete)}&hl=fr&gl=FR&ceid=FR:fr`,
    type: 'presse',
  };
  try {
    const xml = await lire(source.url);
    const offres = items(xml).map((b) => offrePresse(b, source, familleId)).filter(Boolean);
    journal.push({ source: source.id, ok: true, items: items(xml).length, retenues: offres.length });
    if (VERBEUX) console.log(`  ${source.id} : ${offres.length} offres retenues`);
    return offres;
  } catch (e) {
    journal.push({ source: source.id, ok: false, erreur: e.message });
    return [];
  }
}

/**
 * Clé d'unicité : l'URL canonique de l'offre quand elle existe.
 * DÉFAUT CORRIGÉ : dédupliquer sur le TITRE faisait doublonner une même offre
 * dès qu'on nettoyait son titre (« 160° - Broyeur Bosch » puis « Broyeur
 * Bosch » = deux offres au lieu d'une). L'URL, elle, ne change pas.
 */
const cleDe = (o) => {
  const u = String(o.lienPage || '').replace(/^https?:\/\/(www\.)?/, '').split('?')[0].replace(/\/$/, '');
  return u || String(o.titre).toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim().slice(0, 80);
};

/* ------------------------------------------------------------------ *
 *  Publication (GitHub Pages) — le site ET ses visuels, autonomes.
 *
 *  Sur une page publique, les visuels ne peuvent PAS être pris directement
 *  chez les sources : leur politique d'origine croisée les fait refuser par le
 *  navigateur (cartes grises — défaut déjà vécu sur le hub). On les télécharge
 *  donc ici, une fois, et on les sert depuis notre propre site.
 *
 *  Conséquence décisive : l'application n'a plus besoin d'AUCUN serveur à nous
 *  pour afficher des images — et donc plus du NAS resté à la maison.
 * ------------------------------------------------------------------ */
const extension = (url) => {
  const m = String(url).split('?')[0].match(/\.(jpe?g|png|webp|gif|avif)$/i);
  return m ? '.' + m[1].toLowerCase() : '.jpg';
};

async function publier(sortie) {
  const dossierImg = path.join(DOSSIER_PUBLIE, 'img');
  fs.mkdirSync(dossierImg, { recursive: true });

  // 1. Le site lui-même : l'interface est copiée telle quelle.
  for (const f of fs.readdirSync(path.join(__dirname, 'public'))) {
    fs.copyFileSync(path.join(__dirname, 'public', f), path.join(DOSSIER_PUBLIE, f));
  }

  // 2. Les visuels, nommés par l'empreinte de leur URL : jamais retéléchargés.
  const attendus = new Set();
  let pris = 0, rates = 0;
  for (const o of sortie.offres) {
    if (!o.image) continue;
    // Déjà local (offre conservée d'une exécution précédente) : on le laisse tel
    // quel, en le déclarant « attendu » pour que le ménage ne le supprime pas.
    if (!/^https?:/i.test(o.image)) { attendus.add(path.basename(o.image)); continue; }
    const nom = crypto.createHash('sha1').update(o.image).digest('hex').slice(0, 20) + extension(o.image);
    attendus.add(nom);
    const cible = path.join(dossierImg, nom);
    if (!fs.existsSync(cible)) {
      try {
        const r = await fetch(o.image, {
          headers: { 'user-agent': UA, 'referer': 'https://' + new URL(o.image).hostname + '/' },
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const type = r.headers.get('content-type') || '';
        const buf = Buffer.from(await r.arrayBuffer());
        if (!type.startsWith('image/') || buf.length === 0) throw new Error('pas une image');
        fs.writeFileSync(cible, buf);
        pris++;
      } catch {
        rates++;
        continue;   // on garde l'URL d'origine : carte sans visuel, jamais carte cassée
      }
    }
    o.image = 'img/' + nom;
  }

  // 3. On retire les visuels que plus aucune offre ne référence, sinon le
  //    dépôt grossit sans fin (chaque passage ne laisse que le vivant).
  let purges = 0;
  for (const f of fs.readdirSync(dossierImg)) {
    if (!attendus.has(f)) { fs.unlinkSync(path.join(dossierImg, f)); purges++; }
  }

  fs.writeFileSync(path.join(DOSSIER_PUBLIE, 'offres.json'), JSON.stringify(sortie, null, 0));
  console.log(`  → publié dans ${DOSSIER_PUBLIE} : ${pris} visuel(s) téléchargé(s), ${rates} indisponible(s), ${purges} ancien(s) retiré(s)`);
}

async function principal() {
  fs.mkdirSync(DATA, { recursive: true });
  // En publication, l'état vit DANS le site publié (docs/offres.json) : c'est le
  // seul fichier qui survit entre deux exécutions dans le cloud (le disque de
  // GitHub Actions est neuf à chaque passage). En local, il reste dans data/,
  // avec des visuels distants relayés par notre serveur.
  const fichierEtat = PUBLIER ? path.join(DOSSIER_PUBLIE, 'offres.json') : FICHIER;
  const existant = fs.existsSync(fichierEtat) ? JSON.parse(fs.readFileSync(fichierEtat, 'utf8')) : { offres: [] };
  // Assainissement : les offres collectées AVANT le nettoyage du titre gardent
  // leur « température » collée devant (« 298° - Vente flash »). On les écarte —
  // elles reviendront propres à cette collecte.
  const avantAssainir = existant.offres.length;
  const propres = existant.offres
    .filter((o) => !/^\s*\d{1,4}\s*°\s*[-–—]/.test(o.titre || ''))
    // Les offres engrangées AVANT le décodeur d'entités gardent leurs échappements
    // (« B&amp;amp;M ») : on les décape au passage plutôt que de les jeter — la
    // source ne republiera pas forcément une offre encore valable.
    .map((o) => {
      const c = { ...o };
      for (const k of ['titre', 'marchand', 'source']) c[k] = decaper(c[k]);
      return c;
    });
  if (propres.length !== avantAssainir) {
    console.log(`Assainissement : ${avantAssainir - propres.length} offre(s) au titre pollué écartée(s)`);
  }
  const connues = new Map(propres.map((o) => [cleDe(o), o]));

  // Dealabs n'est interrogé qu'une fois toutes les 15 minutes (voir
  // DEALABS_INTERVALLE_MS) : ses offres déjà connues restent dans la fusion.
  const dernierDealabs = existant.dealabsVuLe ? new Date(existant.dealabsVuLe).getTime() : 0;
  const dealabsRepos = Number.isFinite(dernierDealabs) && Date.now() - dernierDealabs < DEALABS_INTERVALLE_MS;
  const sources = SOURCES.filter((s) => !(s.type === 'dealabs' && dealabsRepos));
  if (sources.length !== SOURCES.length) {
    journal.push({ source: 'dealabs', ok: true, saute: true, raison: 'intervalle de 15 min non écoulé' });
    if (VERBEUX) console.log('  dealabs : sauté (moins de 15 min depuis le dernier appel)');
  }

  console.log(`Collecte : ${sources.length} flux + ${RECHERCHES.length} recherches Google News`);
  const paquets = await Promise.all([
    ...sources.map((s) => collecterSource(s)),
    ...RECHERCHES.map((r) => collecterRecherche(r)),
  ]);

  let nouvelles = 0, misesAJour = 0;
  for (const offre of paquets.flat()) {
    const cle = cleDe(offre);
    const avant = connues.get(cle);
    if (!avant) { connues.set(cle, { ...offre, vuLe: new Date().toISOString() }); nouvelles++; continue; }
    // Mise à jour SANS écraser la date de première vue (qui sert à dater l'offre).
    const fusion = { ...avant, ...offre, vuLe: new Date().toISOString(), premiereVue: avant.premiereVue || avant.vuLe };
    if (avant.prix !== offre.prix || avant.remise !== offre.remise || avant.titre !== offre.titre) misesAJour++;
    connues.set(cle, fusion);
  }

  // Tri : les offres AVEC PRIX d'abord (remise réelle décroissante), puis la
  // veille — dont on écarte tout ce qui a plus de 30 jours : une actu de l'an
  // dernier n'est pas une information, c'est un piège (l'utilisateur clique et
  // tombe sur une promotion terminée).
  const LIMITE_VEILLE = Date.now() - 30 * 86400000;
  const toutes = [...connues.values()];
  const vraies = toutes.filter((o) => o.type !== 'article')
    .sort((a, b) => (b.remise || 0) - (a.remise || 0) || new Date(b.date) - new Date(a.date));
  const veille = toutes.filter((o) => o.type === 'article' && new Date(o.date).getTime() > LIMITE_VEILLE)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 200);
  const offres = [...vraies, ...veille];

  const sortie = {
    genereLe: new Date().toISOString(),
    dealabsVuLe: dealabsRepos ? (existant.dealabsVuLe || null) : new Date().toISOString(),
    total: offres.length,
    totalOffres: vraies.length,
    totalVeille: veille.length,
    nouvelles,
    misesAJour,
    journal,
    offres,
  };
  // Toujours écrit : le hub local et le contrôle des sources lisent ce fichier,
  // avec des visuels DISTANTS (relayés par notre serveur). En publication, on
  // écrit EN PLUS le site (docs/), dont les visuels sont rapatriés sur place.
  fs.writeFileSync(FICHIER, JSON.stringify(sortie, null, 0));
  console.log(`√ ${offres.length} offres au total (${nouvelles} nouvelles, ${misesAJour} mises à jour, ${journal.filter((j) => !j.ok).length} source(s) en échec)`);
  console.log(`  → ${FICHIER}`);
  if (PUBLIER) await publier(sortie);
}

// Exécuté seulement quand ce fichier EST le programme : sinon l'importer depuis
// un test déclencherait une collecte réseau.
const estProgramme = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (estProgramme) principal().catch((e) => { console.error('ÉCHEC COLLECTE :', e.message); process.exit(1); });
