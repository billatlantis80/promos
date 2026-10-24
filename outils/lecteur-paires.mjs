#!/usr/bin/env node
/* =============================================================================
   LECTEUR DE PAIRES — premières armes sur les 51 pages « niveau 1 »

   Demande de B (11/10/2026) : « régulariser le problème du travail de lecteur ».

   Ce que ce lecteur fait, et ce qu'il ne fait pas :
     IL CHERCHE une paire de prix RÉELS dans le HTML SERVI — le prix de
     référence (barré, ou porteur d'une classe « ancien prix ») et le prix
     actuel — et il rend des CANDIDATS.
     IL NE PUBLIE RIEN. Un candidat n'entre dans le catalogue que si deux
     relevés successifs donnent exactement la même paire ET si l'extrait HTML
     qui la porte est relisible. C'est la règle du projet : un prix se LIT, il
     ne se déduit jamais.

   Il travaille HORS LIGNE sur donnees/niveau1-html/ (les 51 pages dont le HTML
   a été conservé par outils/diagnostic-niveau1.mjs), donc sans requête réseau.

   Lancer :  node outils/lecteur-paires.mjs            (résumé par page)
             node outils/lecteur-paires.mjs --preuves (ajoute 8 extraits HTML)
   ============================================================================= */
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'donnees', 'niveau1-html');
const DIAG = join(RACINE, 'donnees', 'diagnostic-niveau1.json');
const SORTIE = join(RACINE, 'donnees', 'lecteur-paires.json');

const AVEC_PREUVES = process.argv.includes('--preuves');

/* --- Les prix. On accepte les deux écritures : 1.234,56 € et 1,234.56 € ----- */
const PRIX = /(?:\d{1,3}(?:[.\u00a0\u202f ]\d{3})*,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:€|EUR)|(?:€|EUR)\s*(?:\d{1,3}(?:[.\u00a0\u202f ]\d{3})*,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})/g;

/** « 1.234,56 € » → 1234.56 ; « 1,234.56 € » → 1234.56. Aucune invention :
 *  si le nombre est illisible, on rend null et la paire est jetée. */
function valeur(texte) {
  const chiffres = String(texte).replace(/[^\d.,]/g, '');
  if (!chiffres) return null;
  const dernierPoint = chiffres.lastIndexOf('.');
  const derniereVirgule = chiffres.lastIndexOf(',');
  let normalise;
  if (derniereVirgule > dernierPoint) {
    // virgule décimale : 1.234,56
    normalise = chiffres.replace(/[.\u00a0\u202f ]/g, '').replace(',', '.');
  } else if (dernierPoint > derniereVirgule) {
    normalise = chiffres.replace(/,/g, '');
  } else {
    normalise = chiffres.replace(',', '.');
  }
  const v = Number.parseFloat(normalise);
  return Number.isFinite(v) ? v : null;
}

/* --- Ce qui marque un ANCIEN prix dans le HTML servi ----------------------- */
const BALISE_BARREE = /<(?:s|del|strike)\b[^>]*>[\s\S]{0,120}?<\/(?:s|del|strike)>/gi;
const MOTS_ANCIEN = /(?:old|before|strike|strikethrough|barre|barré|previous|original|crossed|line-through|regular-price|prix-avant|was|statt|uvp|list-price|compare-at)/i;
const BALISE_OUVRANTE = /<[a-z][^>]{0,300}?>/gi;

/** Les zones du document qui portent un ancien prix : soit une balise barrée,
 *  soit une balise dont la classe ou le style dit « ancien prix ». */
function zonesAncienPrix(html) {
  const zones = [];
  let m;
  const reB = new RegExp(BALISE_BARREE.source, 'gi');
  while ((m = reB.exec(html)) !== null) {
    if (PRIX.test(m[0])) { PRIX.lastIndex = 0; zones.push({ debut: m.index, fin: m.index + m[0].length, source: 'balise-barrée' }); }
    PRIX.lastIndex = 0;
  }
  const reO = new RegExp(BALISE_OUVRANTE.source, 'gi');
  while ((m = reO.exec(html)) !== null) {
    const balise = m[0];
    if (!MOTS_ANCIEN.test(balise)) continue;
    const apres = html.slice(m.index + balise.length, m.index + balise.length + 160);
    if (PRIX.test(apres)) { PRIX.lastIndex = 0; zones.push({ debut: m.index, fin: m.index + balise.length + 160, source: 'classe-ancien-prix' }); }
    PRIX.lastIndex = 0;
  }
  // On fusionne les zones qui se chevauchent, sinon une même carte compte deux fois.
  zones.sort((a, b) => a.debut - b.debut);
  const fusion = [];
  for (const z of zones) {
    const derniere = fusion[fusion.length - 1];
    if (derniere && z.debut <= derniere.fin) derniere.fin = Math.max(derniere.fin, z.fin);
    else fusion.push({ ...z });
  }
  return fusion;
}

function texteVisible(fragment) {
  return fragment
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Les prix d'un fragment, avec leur valeur et leur position. */
function prixDu(fragment, decalage) {
  const trouves = [];
  const re = new RegExp(PRIX.source, 'g');
  let m;
  while ((m = re.exec(fragment)) !== null) {
    const v = valeur(m[0]);
    if (v !== null && v >= 0.5 && v <= 20000) trouves.push({ valeur: v, brut: m[0].trim(), index: decalage + m.index });
  }
  return trouves;
}

/** Lit une carte autour d'une zone d'ancien prix.
 *  Règle stricte : l'ancien prix doit être SUPÉRIEUR au nouveau. Sinon ce n'est
 *  pas une promotion — c'est une erreur de lecture, et la carte est jetée. */
function lireCarte(html, zone) {
  const debut = Math.max(0, zone.debut - 900);
  const fin = Math.min(html.length, zone.fin + 900);
  const fenetre = html.slice(debut, fin);
  const anciens = prixDu(html.slice(zone.debut, zone.fin), zone.debut);
  if (!anciens.length) return null;

  const tous = prixDu(fenetre, debut);
  const dansZone = (p) => p.index >= zone.debut && p.index <= zone.fin;
  const actuels = tous.filter((p) => !dansZone(p));
  if (!actuels.length) return null;

  // L'ancien prix : le plus élevé de la zone (une carte n'a qu'un prix de référence).
  const ancien = anciens.reduce((a, b) => (b.valeur > a.valeur ? b : a));
  // Le prix actuel : le plus proche APRÈS la zone, sinon le plus proche avant.
  const apres = actuels.filter((p) => p.index > zone.fin).sort((a, b) => a.index - b.index);
  const avant = actuels.filter((p) => p.index < zone.debut).sort((a, b) => b.index - a.index);
  const actuel = apres[0] || avant[0];
  if (!actuel) return null;
  if (!(ancien.valeur > actuel.valeur)) return null;                    // pas une promotion
  if (actuel.valeur <= 0) return null;
  const remise = Math.round((1 - actuel.valeur / ancien.valeur) * 100);
  if (remise < 3 || remise > 95) return null;                            // ni bruit, ni faux rabais
  if (ancien.valeur > actuel.valeur * 20) return null;                   // paire invraisemblable

  // Le titre : le dernier titre ou attribut alt/title porteur de texte, AVANT le prix.
  const avantPrix = fenetre.slice(0, Math.max(0, zone.debut - debut));
  let titre = '';
  const titres = [...avantPrix.matchAll(/<(h[1-4]|a|span|p|div)\b[^>]*?(?:alt|title)="([^"]{6,140})"/gi)].map((x) => x[2]);
  const entetes = [...avantPrix.matchAll(/<h[1-4]\b[^>]*>([\s\S]{2,160}?)<\/h[1-4]>/gi)].map((x) => texteVisible(x[1]));
  const candidats = [...entetes, ...titres].map((s) => texteVisible(s)).filter((s) => s.length >= 6 && /\p{L}/u.test(s));
  if (candidats.length) titre = candidats[candidats.length - 1];
  if (!titre) {
    const brut = texteVisible(avantPrix).slice(-160);
    titre = brut.replace(/^[\s|·—–-]+/, '').slice(0, 120);
  }

  // Le lien : la dernière adresse ouvrable avant le prix.
  const liens = [...avantPrix.matchAll(/<a\b[^>]*?href="([^"#]{4,500})"/gi)].map((x) => x[1]);
  const lien = liens.length ? liens[liens.length - 1] : '';

  const extrait = html.slice(zone.debut, Math.min(html.length, zone.fin + 260)).slice(0, 700);
  return {
    titre: titre.slice(0, 140),
    prix: actuel.valeur.toFixed(2),
    prixAvant: ancien.valeur.toFixed(2),
    remise,
    indexPrix: actuel.index,
    source: zone.source,
    lien,
    extrait,
  };
}

function lirePage(html) {
  const zones = zonesAncienPrix(html);
  const cartes = [];
  const vus = new Set();
  for (const z of zones) {
    const c = lireCarte(html, z);
    if (!c) continue;
    const cle = `${c.lien}|${c.prix}|${c.prixAvant}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    c.zone = z;
    cartes.push(c);
  }
  cartes.sort((a, b) => a.zone.debut - b.zone.debut);
  return { zones: zones.length, cartes };
}

/* ------------------------------------------------------------------- mesure */
let diag = { resultats: [] };
try { diag = JSON.parse(readFileSync(DIAG, 'utf8')); } catch { /* pas de diagnostic : on lit le dossier */ }

const figures = new Map();
for (const r of diag.resultats || []) if (r.html) figures.set(r.html, r);

const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.html')).sort();
const parPage = [];
let totalCartes = 0;
let pagesUtiles = 0;

for (const f of fichiers) {
  const info = figures.get(f) || {};
  const html = readFileSync(join(DOSSIER, f), 'utf8');
  const { zones, cartes } = lirePage(html);
  totalCartes += cartes.length;
  if (cartes.length) pagesUtiles += 1;
  parPage.push({
    fichier: f,
    nom: info.nom || f.replace('.html', ''),
    pays: info.pays || '?',
    verdict: info.verdict || '?',
    octets: statSync(join(DOSSIER, f)).size,
    zones,
    cartes: cartes.length,
    exemples: cartes.slice(0, 3).map((c) => ({ titre: c.titre, prix: c.prix, avant: c.prixAvant, remise: c.remise, lien: c.lien, source: c.source })),
    preuves: cartes.slice(0, 3).map((c) => c.extrait),
  });
}

parPage.sort((a, b) => b.cartes - a.cartes);

const lignes = [];
lignes.push(`LECTEUR DE PAIRES — essai sur les ${fichiers.length} pages conservées — ${new Date().toISOString().slice(0, 10)}`);
lignes.push('');
lignes.push(`Pages qui rendent AU MOINS un candidat : ${pagesUtiles} / ${fichiers.length}`);
lignes.push(`Candidats retenus au total : ${totalCartes}`);
lignes.push('');
lignes.push('PAGE PAR PAGE (candidats décroissants)');
for (const p of parPage) {
  lignes.push(`  ${String(p.cartes).padStart(4)} cand. · ${String(p.zones).padStart(4)} zones · ${p.verdict.padEnd(15)} ${p.nom} (${p.pays})`);
}
lignes.push('');
lignes.push('CE QUE LE LECTEUR A LU — il faut relire ces exemples à la main');
for (const p of parPage.filter((x) => x.cartes)) {
  lignes.push(`\n== ${p.nom} (${p.pays}) — ${p.cartes} candidat(s)`);
  for (const e of p.exemples) {
    lignes.push(`   « ${e.titre} » — ${e.avant} € → ${e.prix} € (-${e.remise} %) [${e.source}] ${e.lien}`);
  }
}
if (AVEC_PREUVES) {
  lignes.push('\n\nEXTRAITS HTML QUI PORTENT LES PRIX');
  for (const p of parPage.filter((x) => x.cartes).slice(0, 8)) {
    lignes.push(`\n===== ${p.nom}`);
    for (const preuve of p.preuves.slice(0, 2)) lignes.push('  ' + preuve.replace(/\s+/g, ' ').slice(0, 600));
  }
}

writeFileSync(SORTIE, JSON.stringify({ genereLe: new Date().toISOString(), pagesUtiles, totalCartes, pages: parPage }, null, 1));
const resume = lignes.join('\n');
writeFileSync(join(RACINE, 'donnees', 'lecteur-paires.txt'), resume);
console.log(resume);
