/**
 * QUI FAIT DE L'AFFILIATION ? — mesure sur les sites réels.
 *
 * B (08/10/2026) : « Pour chaque pays tu dois m'afficher les affiliations qui
 * sont possibles, existantes. Ça me permettra d'avoir une vue claire de quelle
 * affiliation j'ai ou pas. Tu dois vérifier qui fait des affiliations ou pas. »
 *
 * CE QU'ON MESURE, ET POURQUOI C'EST MESURABLE.
 * Un marchand qui pratique l'affiliation laisse des TRACES vérifiables :
 *   - des liens sortants qui passent par un réseau (awin1.com, digidip.net,
 *     tradedoubler.com…) — c'est la trace la plus fiable, parce qu'un réseau
 *     n'apparaît dans le HTML que si quelqu'un l'utilise ;
 *   - une page « affiliation / affichez / partenaires » sur son propre site.
 *
 * CE QU'ON NE FAIT PAS, ET C'EST DÉLIBÉRÉ. On n'affirme pas « ce marchand ne
 * fait pas d'affiliation » : on dit « aucun signe trouvé » et « non mesurable »
 * quand le site a refusé. Un marchand peut très bien avoir un programme réservé
 * à ses partenaires, sans aucune trace publique. Confondre les deux ferait
 * écrire à B à des enseignes qui ont déjà un programme.
 *
 * Lancement : node outils/mesure-affiliations.mjs [--echantillon 8] [--tout]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

/* ---------------------------------------------------------------- signatures
 * Les hôtes de RÉSEAUX d'affiliation. Tous ne servent pas dans tous les pays :
 * c'est justement l'information qu'on veut — un marchand belge qui passe par
 * Awin et un marchand suédois qui passe par Adtraction ne s'adressent pas au
 * même guichet.
 *
 * Un hôte n'est utile que s'il n'apparaît QUE dans un contexte d'affiliation.
 * « awin1.com », « digidip.net », « sjv.io » : oui. 「 google-analytics.com » :
 * non — mesurer ça remplirait la base de faux programmes. */
export const RESEAUX_SIGNATURES = [
  { nom: 'Awin', hotes: ['awin1.com', 'zenaps.com', 'awin.com'] },
  { nom: 'Tradedoubler', hotes: ['tradedoubler.com', 'clk.tradedoubler.com'] },
  { nom: 'CJ Affiliate', hotes: ['anrdoezrs.net', 'dpbolvw.net', 'jdoqocy.com', 'kqzyfj.com', 'tkqlhce.com'] },
  { nom: 'Digidip', hotes: ['digidip.net'] },
  { nom: 'Effiliation', hotes: ['effiliation.com'] },
  { nom: 'Webgains', hotes: ['webgains.com', 'wg-aff.com'] },
  { nom: 'Daisycon', hotes: ['daisycon.com', 'daisycon.io'] },
  { nom: 'Adcell', hotes: ['adcell.de'] },
  { nom: 'Kwanko', hotes: ['kwanko.com', 'kwanko.net'] },
  { nom: 'belboon', hotes: ['belboon.de', 'belboon.com'] },
  { nom: 'partner-ads', hotes: ['partner-ads.com'] },
  { nom: 'Public-Idées', hotes: ['public-id.net', 'publicidees.com'] },
  { nom: 'NetAffiliation', hotes: ['netaffiliation.com'] },
  { nom: 'Affilae', hotes: ['affilae.com'] },
  { nom: 'Adtraction', hotes: ['adtraction.com'] },
  { nom: 'FinanceAds', hotes: ['financeads.net'] },
  { nom: 'Impact', hotes: ['sjv.io', 'ojrq.net', 'prf.hn', 'impact.com'] },
  { nom: 'Partnerize', hotes: ['partnerize.com', 'phgsyh.net'] },
  { nom: 'Rakuten Advertising', hotes: ['linksynergy.com', 'rls.rakutenadvertising.com'] },
  { nom: 'TradeTracker', hotes: ['tradetracker.net', 'tradetracker.com'] },
  { nom: 'Admitad', hotes: ['admitad.com', 'admitad.net'] },
  { nom: 'ShareASale', hotes: ['shareasale.com', 'shareasale-analytics.com'] },
  { nom: 'YieldKit', hotes: ['yieldkit.com'] },
  { nom: 'Smartclip / Sovendus', hotes: ['sovendus.com'] },
  { nom: 'Amazon Partenaires', hotes: ['amazon-adsystem.com'] },
  { nom: 'Bol.com Partenaire', hotes: ['partner.bol.com', 'bol.com/partner'] },
  { nom: 'Galaxus / Digitec', hotes: ['galaxus.ch/partner'] },
];

/** Chemins essayés en dernier recours, quand la page d'accueil ne porte aucun
 *  lien parlant. Le nombre est volontairement PETIT : chaque essai est une
 *  requête, et un marchand qui ne publie rien sur ces quatre-là ne publiera
 *  rien sur le douzième. */
export const CHEMINS_PROGRAMME = ['/affiliation', '/affiliate', '/partenaires', '/affiliate-program'];

/** Les mots qui trahissent un LIEN vers un programme, dans l'adresse ou dans le
 *  texte du lien. C'est par là qu'on trouve vraiment : presque aucun marchand
 *  n'écrit son programme à la racine, presque tous le mettent en pied de page.
 *  MESURÉ : chercher des chemins devinés a renvoyé « aucun signe » sur Groupon,
 *  Ticketmaster et Coolblue — trois marchands qui ONT un programme. */
const MOTS_LIEN = /(affili|partner|partenaire|programme|reseller|devenir|verdienen|word_?partner)/i;

/** Les adresses de la page d'accueil qui mènent probablement à un programme. */
export function liensProgramme(html, base) {
  const trouves = new Set();
  for (const m of String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    const href = m[1];
    const texte = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!MOTS_LIEN.test(href) && !MOTS_LIEN.test(texte)) continue;
    let abs;
    try { abs = new URL(href, base).toString(); } catch { continue; }
    // On reste sur le site du marchand : un lien vers awin1.com est une
    // SIGNATURE (déjà comptée), pas une page de programme à visiter.
    try { if (new URL(abs).hostname.replace(/^www\./, '') !== new URL(base).hostname.replace(/^www\./, '')) continue; } catch { continue; }
    if (abs.includes('#')) abs = abs.slice(0, abs.indexOf('#'));
    trouves.add(abs);
  }
  return [...trouves].slice(0, 3);
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

async function charger(url, methode = 'GET') {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, {
      method: methode,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'fr,en;q=0.8' },
    });
    const texte = methode === 'HEAD' ? '' : (await r.text()).slice(0, 400000);
    return { ok: r.ok, statut: r.status, url: r.url, texte };
  } catch (e) {
    return { ok: false, statut: 0, url, texte: '', erreur: e.name === 'AbortError' ? 'délai dépassé' : String(e.message || e) };
  } finally {
    clearTimeout(minuteur);
  }
}

/** Les réseaux dont la signature apparaît dans un morceau de HTML. */
export function reseauxDans(html) {
  const bas = String(html || '').toLowerCase();
  const trouves = [];
  for (const r of RESEAUX_SIGNATURES) {
    const h = r.hotes.find((x) => bas.includes(x));
    if (h) trouves.push({ nom: r.nom, indice: h });
  }
  return trouves;
}

/** Le texte d'une page parle-t-il d'un PROGRAMME ? On exige un mot de programme
 *  ET un mot d'action : « affiliation » seul apparaît dans les mentions légales
 *  de presque tous les sites, et ferait croire à un programme inexistant.
 *  MESURÉ : c'est le piège qui rend cette mesure inutile si on la relâche. */
export function parleDUnProgramme(html) {
  const t = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').toLowerCase();
  const programmes = /(programme d'affiliation|programme d’affiliation|affiliate program(me)?|partnerprogramm|programa de afiliaci|programma di affiliazione|affiliate-programma|partnerski program|programa de afiliados)/;
  const action = /(rejoindre|inscri|devenir|gagnez|revenue|commission|verdienen|ganhe|guadagn|tjäna|earn|join|sign ?up|anmelden|zapisz)/;
  return programmes.test(t) || (/\baffiliation?s?\b/.test(t) && action.test(t));
}

/** Publie les mesures là où le panneau les lit.
 *
 *  POURQUOI DEUX FICHIERS, ET PAS UN SEUL. `donnees/` est le registre de travail
 *  (il garde les rendus, les motifs, l'historique des balayages) ; `public/` est
 *  ce que le site SERT. Le panneau ne peut pas lire `donnees/` : cette partie du
 *  dépôt n'est pas publiée. Sans cette copie, l'onglet Affiliation s'ouvrirait
 *  sur « aucun balayage » alors que le balayage aurait tourné. */
function publier(mesures) {
  const dest = path.join(RACINE, 'public', 'affiliations.json');
  fs.writeFileSync(dest, JSON.stringify(mesures, null, 1));
  return dest;
}

const lireJson = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; } };

/* ------------------------------------------------------------------ balayage */

async function mesurerActeur(a) {
  const domaine = (a.domaines || [])[0] || (a.site || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domaine) return { nom: a.nom, pays: a.pays, etat: 'non mesuré', raison: 'aucun domaine', reseaux: [], indices: [] };
  const base = `https://${domaine}`;

  const page = await charger(base);
  // UN SITE QUI REFUSE N'EST PAS UN SITE SANS PROGRAMME. Groupon, Bol et Amazon
  // répondent 403 ou 202 à un visiteur automatique : les compter « sans
  // affiliation » ferait écrire B à des enseignes qui en ont une. C'est la
  // distinction la plus importante de tout ce fichier.
  if (page.statut === 403 || page.statut === 429 || !page.texte || page.texte.length < 500) {
    // Deux raisons différentes, et il ne faut pas les confondre : un refus
    // explicite (403/429) et une réponse vide ou quasi vide (page montée en
    // JavaScript, redirection sans contenu). Dire « a refusé » sur un HTTP 200
    // serait un motif FAUX inscrit dans la base — et B bâtirait une décision
    // dessus.
    const raison = (page.statut === 403 || page.statut === 429)
      ? `le site a refusé la mesure (HTTP ${page.statut})`
      : `réponse vide ou trop courte (HTTP ${page.statut || '—'}, ${(page.texte || '').length} octets)`;
    return { nom: a.nom, pays: a.pays, domaine, etat: 'non mesuré', raison, reseaux: [], indices: [] };
  }
  if (!page.ok && page.statut === 0) {
    return { nom: a.nom, pays: a.pays, domaine, etat: 'non mesuré', raison: page.erreur || 'injoignable', reseaux: [], indices: [] };
  }

  const reseaux = new Map();
  const indices = [];
  const ajouterReseaux = (liste, ou) => {
    for (const r of liste) {
      if (!reseaux.has(r.nom)) { reseaux.set(r.nom, r.indice); indices.push(`signature « ${r.indice} » sur ${ou}`); }
    }
  };
  ajouterReseaux(reseauxDans(page.texte), base);

  // Le programme est-il ANNONCÉ sur la page d'accueil elle-même ?
  let pageProgramme = parleDUnProgramme(page.texte) ? base : null;
  if (pageProgramme) indices.push(`programme annoncé sur la page d'accueil (${base})`);

  // Sinon, on suit les liens de la page qui parlent de programme.
  if (!pageProgramme) {
    for (const lien of liensProgramme(page.texte, base)) {
      const essai = await charger(lien);
      if (!essai.ok || !essai.texte) continue;
      ajouterReseaux(reseauxDans(essai.texte), lien);
      if (parleDUnProgramme(essai.texte)) { pageProgramme = essai.url; indices.push(`page programme : ${essai.url}`); break; }
    }
  }

  // Et en dernier recours seulement, quelques chemins devinés.
  if (!pageProgramme && reseaux.size === 0) {
    for (const c of CHEMINS_PROGRAMME) {
      const essai = await charger(base + c);
      if (essai.ok && essai.texte && parleDUnProgramme(essai.texte)) {
        pageProgramme = essai.url; indices.push(`page programme : ${essai.url}`);
        ajouterReseaux(reseauxDans(essai.texte), essai.url);
        break;
      }
      if (essai.statut === 403 || essai.statut === 429) break;
    }
  }

  return {
    nom: a.nom, pays: a.pays, domaine,
    etat: (reseaux.size || pageProgramme) ? 'programme trouvé' : 'aucun signe trouvé',
    reseaux: [...reseaux.keys()],
    indices,
    http: page.statut,
  };
}

/**
 * DEUXIÈME PASSE : reprendre la détection sur les pages LUES AU NAVIGATEUR.
 *
 * `outils/rendus-navigateur.py` a enregistré le HTML rendu et les liens de
 * chaque site qui avait refusé la mesure automatique. Ici on applique EXACTEMENT
 * les mêmes règles qu'au premier passage — c'est le point : le navigateur a
 * seulement mieux lu, la règle n'a pas bougé.
 */
async function reprendreDepuisRendus() {
  const dossier = path.join(RACINE, 'donnees', 'rendus');
  const cible = path.join(RACINE, 'donnees', 'affiliations.json');
  const mesures = JSON.parse(fs.readFileSync(cible, 'utf8'));
  const parNom = new Map(mesures.acteurs.map((a) => [a.nom, a]));

  let relus = 0, gagnes = 0, encore = 0;
  for (const f of fs.readdirSync(dossier)) {
    if (!f.endsWith('.json')) continue;
    const rendu = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8'));
    const pageHtml = path.join(dossier, f.replace(/\.json$/, '.html'));
    if (!fs.existsSync(pageHtml)) continue;
    const html = fs.readFileSync(pageHtml, 'utf8');
    const a = parNom.get(rendu.nom);
    if (!a) continue;
    relus += 1;
    if ((rendu.octets || 0) < 2000) { encore += 1; continue; }

    const base = rendu.base || `https://${rendu.domaine}`;
    const reseaux = new Map();
    const indices = [`page lue au navigateur : ${rendu.url_finale || base} (HTTP ${rendu.statut}, ${rendu.octets} octets)`];
    for (const r of reseauxDans(html)) if (!reseaux.has(r.nom)) { reseaux.set(r.nom, r.indice); indices.push(`signature « ${r.indice} » sur ${base}`); }

    let pageProgramme = parleDUnProgramme(html) ? (rendu.url_finale || base) : null;
    if (pageProgramme) indices.push(`programme annoncé sur la page (lue au navigateur)`);

    // Les liens rendus : ceux que le JavaScript a réellement posés dans la page,
    // et que le premier passage ne pouvait pas voir.
    if (!pageProgramme) {
      for (const l of liensProgramme(html, base).slice(0, 2)) {
        const essai = await charger(l);
        if (!essai.ok || !essai.texte) continue;
        for (const r of reseauxDans(essai.texte)) if (!reseaux.has(r.nom)) { reseaux.set(r.nom, r.indice); indices.push(`signature « ${r.indice} » sur ${l}`); }
        if (parleDUnProgramme(essai.texte)) { pageProgramme = essai.url; indices.push(`page programme : ${essai.url}`); break; }
      }
    }

    a.methode = 'navigateur';
    a.reseaux = [...reseaux.keys()];
    a.indices = indices;
    if (reseaux.size || pageProgramme) {
      a.etat = 'programme trouvé';
      delete a.raison;
      gagnes += 1;
    } else {
      a.etat = 'aucun signe trouvé';
      delete a.raison;
    }
    encore += 0;
  }

  mesures.relusAuNavigateur = relus;
  mesures.genereLe = new Date().toISOString();
  mesures.avecProgramme = mesures.acteurs.filter((x) => x.etat === 'programme trouvé').length;
  mesures.sansSigne = mesures.acteurs.filter((x) => x.etat === 'aucun signe trouvé').length;
  mesures.nonMesures = mesures.acteurs.filter((x) => x.etat === 'non mesuré').length;
  fs.writeFileSync(cible, JSON.stringify(mesures, null, 1));
  publier(mesures);
  console.log(`Reprise depuis les rendus : ${relus} page(s) relue(s), ${gagnes} programme(s) trouvé(s) de plus.`);
  console.log(`Bilan : ${mesures.avecProgramme} avec programme · ${mesures.sansSigne} sans signe · ${mesures.nonMesures} non mesuré(s)`);
  console.log(`→ ${cible}`);
}

async function main() {
  const args = process.argv.slice(2);
  const iEch = args.indexOf('--echantillon');
  const echantillon = iEch > -1 ? parseInt(args[iEch + 1], 10) : 0;
  const tout = args.includes('--tout');
  if (args.includes('--depuis-rendus')) return await reprendreDepuisRendus();

  const base = lireJson(path.join(RACINE, 'public', 'acteurs.json'), { acteurs: [] });
  let acteurs = base.acteurs || [];
  if (echantillon && !tout) acteurs = acteurs.slice(0, echantillon);

  console.log(`Mesure d'affiliation : ${acteurs.length} acteur(s)…`);
  const resultats = [];
  for (const [i, a] of acteurs.entries()) {
    const r = await mesurerActeur(a);
    resultats.push(r);
    const marque = r.etat === 'programme trouvé' ? '✓' : (r.etat === 'non mesuré' ? '·' : ' ');
    console.log(`${marque} [${String(i + 1).padStart(3)}/${acteurs.length}] ${a.nom} — ${r.etat}${r.reseaux.length ? ' (' + r.reseaux.join(', ') + ')' : ''}`);
    await new Promise((r2) => setTimeout(r2, 350));   // on ne martèle pas les sites
  }

  const sortie = {
    genereLe: new Date().toISOString(),
    methode: 'Signatures de réseaux d’affiliation dans le HTML du site, et page « programme d’affiliation ». '
      + '« aucun signe trouvé » ne veut PAS dire « pas d’affiliation » : un programme privé ne laisse aucune trace publique.',
    nombreActeurs: acteurs.length,
    avecProgramme: resultats.filter((r) => r.etat === 'programme trouvé').length,
    sansSigne: resultats.filter((r) => r.etat === 'aucun signe trouvé').length,
    nonMesures: resultats.filter((r) => r.etat === 'non mesuré').length,
    acteurs: resultats,
  };
  const dest = path.join(RACINE, echantillon && !tout ? 'donnees/affiliations-echantillon.json' : 'donnees/affiliations.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(sortie, null, 1));
  publier(sortie);
  console.log(`\n${sortie.avecProgramme} avec programme · ${sortie.sansSigne} sans signe · ${sortie.nonMesures} non mesuré(s)`);
  console.log(`→ ${dest}`);
}

if (process.argv[1] && process.argv[1].endsWith('mesure-affiliations.mjs')) main();
