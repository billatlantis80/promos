/**
 * QUI MANQUE À LA BASE ? — les sites que l'application lit, et que le tableur
 * ne documente pas (demande de B, 08/10/2026 : « Il y a des acteurs dans
 * l'application qui ne sont pas documentés dans le fichier excel tu peux les
 * rajouter car ils doivent faire partie de la base de données »).
 *
 * Ce qu'on écarte, et pourquoi : un MOTEUR de recherche (news.google.com,
 * bing.com/news) n'est pas un acteur du marché, c'est un moyen de VOIR un
 * acteur. La question « qui manque » ne doit donc porter que sur les vrais
 * sites, jamais sur les moteurs — sinon on remplirait la base de faux acteurs.
 *
 * Lancement : node outils/mesure-acteurs-manquants.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { liaisonActeurs, domaineDe, estMoteur, memeActeur } from '../public/acteurs.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const lire = (p) => JSON.parse(fs.readFileSync(path.join(RACINE, p), 'utf8'));

function lireCatalogue() {
  for (const p of ['data/offres.json', 'docs/offres.json']) {
    if (fs.existsSync(path.join(RACINE, p))) return lire(p);
  }
  throw new Error('ni data/offres.json ni docs/offres.json');
}

const catalogue = lireCatalogue();
const base = lire('public/acteurs.json');
const r = liaisonActeurs(catalogue, base);

// Qui est déjà réclamé par un acteur de la base ?
const reconnu = new Set();
for (const a of r.acteurs) {
  for (const s of [...a.liaison.flux, ...a.liaison.veille]) reconnu.add(s.nom);
}

// Les sites du catalogue, vus UNE fois chacun (nom de site, pas ligne de config).
const sites = new Map();
for (const s of catalogue.sources) {
  if (!sites.has(s.nom)) sites.set(s.nom, { nom: s.nom, url: s.url, types: new Set(), pays: new Set(), voie: s.voie, rubrique: s.rubrique });
  const e = sites.get(s.nom);
  e.types.add(s.type);
  if (s.pays) e.pays.add(s.pays);
}

const annonces = {};
for (const o of catalogue.offres || []) annonces[o.source] = (annonces[o.source] || 0) + 1;

/**
 * EST-CE UNE SIMPLE REQUÊTE, OU UN ACTEUR VU À TRAVERS ELLE ?
 *
 * DÉFAUT CORRIGÉ ICI. La première version écartait tout ce qui vient d'un
 * moteur. C'était trop grossier, et ça faisait disparaître des acteurs réels :
 * « Spar (BE) », « Bio-Planet (BE) », « OKay (BE) », « JBC (BE) », « Fun (BE) »
 * et « Toolstation (BE) » sont des ENSEIGNES, que le collecteur interroge via
 * une recherche Bing. Les écarter, c'est laisser hors de la base six acteurs que
 * l'application lit vraiment — exactement ce que B demande de corriger.
 *
 * La vraie distinction porte donc sur le NOM :
 *   - « Presse BE (fr) 1 », « Bing DE (de) 2 » → une requête générique, rien
 *     d'autre. Ce sont des moteurs, pas des acteurs ;
 *   - « Supermarchés (BE) », « Supermarkten (BE) », « Veille presse » → des
 *     libellés de recherche, pas des enseignes : personne ne s'appelle ainsi ;
 *   - « Spar (BE) », « JBC (BE) » → une ENSEIGNE, vue à travers un moteur.
 */
const REQUETE_GENERIQUE = new Set(['Supermarchés (BE)', 'Supermarkten (BE)', 'Veille presse']);
function estRequeteGenerique(nom) {
  return REQUETE_GENERIQUE.has(nom) || /^(Presse|Bing)\s[A-Z]{2}\s/.test(nom);
}

/** Un site du catalogue est un ACTEUR s'il est lu directement, ou s'il est vu
 *  par un moteur SOUS LE NOM D'UNE ENSEIGNE. */
function estActeur(e) {
  if (!estMoteur(e.url)) return true;
  return !estRequeteGenerique(e.nom);
}

const manquants = [];
const moteurs = [];
for (const e of sites.values()) {
  if (!estActeur(e)) { moteurs.push(e.nom); continue; }
  if (reconnu.has(e.nom)) continue;
  // Sécurité : un site que la base reconnaît par le NOM mais pas par le domaine
  // ne doit pas être proposé deux fois.
  if (base.acteurs.some((a) => memeActeur(a.nom, e.nom))) continue;
  manquants.push({
    nom: e.nom,
    domaines: e.url && !estMoteur(e.url) ? [domaineDe(e.url)].filter(Boolean) : [],
    pays: [...e.pays].sort().join(','),
    types: [...e.types].join('+'),
    voie: e.voie,
    rubrique: e.rubrique,
    annonces: annonces[e.nom] || 0,
  });
}
manquants.sort((a, b) => b.annonces - a.annonces || a.nom.localeCompare(b.nom));

console.log(`Sites du catalogue : ${sites.size} · acteurs de la base : ${base.acteurs.length}`);
console.log(`Déjà reconnus par la base : ${reconnu.size}`);
console.log(`MOTEURS écartés (pas des acteurs) : ${moteurs.length}  — ex. ${moteurs.slice(0, 4).join(', ')}`);
console.log();
console.log(`À RAJOUTER : ${manquants.length} site(s) réellement lus par l'application`);
console.log();
for (const m of manquants) {
  console.log(`  ${String(m.annonces).padStart(5)} ann · ${m.voie.padEnd(6)} · ${m.pays.padEnd(12)} · ${m.rubrique.padEnd(26)} · ${m.nom}  [${m.domaines.join(', ') || '?'}]  (${m.types})`);
}
