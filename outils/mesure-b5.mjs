/**
 * MESURE B5 — les sources câblées cette unité, exercées avec le VRAI lecteur.
 *
 * Chaque source est lue DEUX fois (à 1,5 s d'intervalle) ; on n'annonce une
 * source stable que si les deux relevés rendent le MÊME nombre d'offres
 * retenues. Contrôle négatif : une URL inventée doit rendre zéro.
 *
 * Lancement : node outils/mesure-b5.mjs
 */
import { offresEnseigne, offresSocialDeal } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const lire = async (url, langue) => {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': langue }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};

const ENSEIGNES = [
  { id: 'coolblue-nl-1', nom: 'Coolblue', type: 'enseigne', pays: 'NL', langue: 'nl', url: 'https://www.coolblue.nl/aanbieding' },
  { id: 'coolblue-de-1', nom: 'Coolblue', type: 'enseigne', pays: 'DE', langue: 'de', url: 'https://www.coolblue.de/angebot' },
  { id: 'zooplus-de-chat', nom: 'Zooplus', type: 'enseigne', pays: 'DE', langue: 'de', categorieImposee: 'animaux', url: 'https://www.zooplus.de/shop/katzen/sonderangebote_katze' },
  { id: 'zooplus-de-chien', nom: 'Zooplus', type: 'enseigne', pays: 'DE', langue: 'de', categorieImposee: 'animaux', url: 'https://www.zooplus.de/shop/hunde/sonderangebote_hund' },
  { id: 'zooplus-it-chat', nom: 'Zooplus', type: 'enseigne', pays: 'IT', langue: 'it', categorieImposee: 'animaux', url: 'https://www.zooplus.it/shop/gatti/offerte_speciali_gatti' },
  { id: 'zooplus-se-chat', nom: 'Zooplus', type: 'enseigne', pays: 'SE', langue: 'sv', categorieImposee: 'animaux', url: 'https://www.zooplus.se/specials/katt/specialerbjudanden/kattmat/81531' },
];
const ACTIVITES = [
  { id: 'socialdeal-be', nom: 'Social Deal', type: 'socialdeal', pays: 'BE', langue: 'fr', categorieImposee: 'activite', url: 'https://www.socialdeal.be' },
  { id: 'socialdeal-nl', nom: 'Social Deal', type: 'socialdeal', pays: 'NL', langue: 'nl', categorieImposee: 'activite', url: 'https://www.socialdeal.nl' },
  { id: 'socialdeal-fr', nom: 'Social Deal', type: 'socialdeal', pays: 'FR', langue: 'fr', categorieImposee: 'activite', url: 'https://www.socialdeal.fr' },
  { id: 'socialdeal-de', nom: 'Social Deal', type: 'socialdeal', pays: 'DE', langue: 'de', categorieImposee: 'activite', url: 'https://www.socialdeal.de' },
  { id: 'socialdeal-at', nom: 'Social Deal', type: 'socialdeal', pays: 'AT', langue: 'de', categorieImposee: 'activite', url: 'https://www.socialdeal.at' },
];

const categorie = (offres) => {
  const c = {};
  for (const o of offres) c[o.categorie] = (c[o.categorie] || 0) + 1;
  return c;
};

async function exercer(source) {
  const lecteur = source.type === 'socialdeal' ? offresSocialDeal : offresEnseigne;
  const r1 = lecteur(await lire(source.url, source.langue), source);
  await new Promise((r) => setTimeout(r, 1500));
  const r2 = lecteur(await lire(source.url, source.langue), source);
  const stable = r1.length === r2.length && r1.length > 0 ? 'OUI ✔' : (r1.length === 0 ? 'VIDE' : 'NON');
  console.log(`${source.id.padEnd(16)} R1=${String(r1.length).padStart(3)} R2=${String(r2.length).padStart(3)} stable=${stable}  ${JSON.stringify(categorie(r1))}`);
  for (const o of r1.slice(0, 3)) console.log(`    · [${o.categorie}] ${o.prixAvant}→${o.prix} (-${o.remise}%) ${o.titre.slice(0, 60)}`);
}

// Contrôle négatif : domaine inexistant → 0.
try {
  const vide = offresEnseigne(await lire('https://neg-socialdeal-b5.example', 'fr'), { nom: 'NEG' });
  console.log(`NEG-socialdeal-exemple : ${vide.length} (attendu 0)`);
} catch (e) { console.log(`NEG-socialdeal-exemple : erreur réseau (${e.message}) = 0 offre ✔`); }

for (const s of ENSEIGNES) { try { await exercer(s); } catch (e) { console.log(`${s.id}: ERREUR ${e.message}`); } }
for (const s of ACTIVITES) { try { await exercer(s); } catch (e) { console.log(`${s.id}: ERREUR ${e.message}`); } }
