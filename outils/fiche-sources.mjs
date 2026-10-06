/**
 * Génère SOURCES.md — la fiche des sites réellement pris en compte.
 * Tout vient du code (TOUTES_SOURCES) et des données publiées (docs/offres.json).
 *
 *   node outils/fiche-sources.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { TOUTES_SOURCES } from '../collecteur.mjs';

const racine = new URL('../', import.meta.url);
const brut = JSON.parse(fs.readFileSync(new URL('docs/offres.json', racine), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;

const js = fs.readFileSync(new URL('public/app.js', racine), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Combien de bonnes promotions par pays');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estAmazon, estBonnePromo, dedoublonner, melanger })`, ctx);
const mix = R.melanger(R.dedoublonner(offres.filter(R.estBonnePromo)));

const parSource = (l) => { const c = {}; for (const o of l) c[o.source || '?'] = (c[o.source || '?'] || 0) + 1; return c; };
const collectees = parSource(offres);
const affichees = parSource(mix);
const domaine = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u); } };
const parType = {};
for (const s of TOUTES_SOURCES) (parType[s.type] = parType[s.type] || []).push(s);

const lignes = [];
lignes.push('# Sources prises en compte pour afficher les promotions');
lignes.push('');
lignes.push(`Fiche générée depuis le code (\`collecteur.mjs\`) et les données publiées (\`docs/offres.json\`).`);
lignes.push('');
lignes.push(`**${TOUTES_SOURCES.length} flux** répartis sur **${new Set(TOUTES_SOURCES.map((s) => domaine(s.url))).size} domaines** · **${offres.length} offres** collectées · **${mix.length} affichées** (mélange 60 % Amazon / 40 % autres).`);
lignes.push('');
lignes.push('Aucune clé d’API n’est utilisée : tous les flux ci-dessous sont publics et gratuits.');
lignes.push('');

const BLOCS = [
  ['flash', 'Amazon — ventes flash du jour', 'Porte **deux prix réels** (prix flash + prix courant) dans un JSON interne : ce sont les seules remises que nous pouvons **calculer**.'],
  ['amazon', 'Amazon — recherche filtrée « en promotion »', 'Page de recherche rendue côté serveur, filtrée par Amazon lui-même (`p_n_deal_type`). Repli quand la page ventes flash ne répond pas.'],
  ['enseigne', 'Enseignes — page d’offres officielle', 'Articles que l’enseigne présente elle-même comme ses offres du moment, avec leur **prix réel**. Aucun prix barré publié : la remise n’est donc pas chiffrable.'],
  ['dealabs', 'Communautés de bons plans (RSS public, sans clé)', 'Chaque bon plan arrive avec **le nom de la boutique et un prix réel**, plus le **score de la communauté**. C’est ce score qui sert de preuve de qualité pour les 40 %.'],
];
for (const [type, titre, note] of BLOCS) {
  const lot = parType[type] || [];
  lignes.push(`## ${titre}`);
  lignes.push('');
  lignes.push(`_${note}_`);
  lignes.push('');
  const parDom = {};
  for (const s of lot) (parDom[domaine(s.url)] = parDom[domaine(s.url)] || []).push(s);
  for (const [dom, liste] of Object.entries(parDom).sort()) {
    const pays = [...new Set(liste.map((s) => s.pays))].join(' ');
    lignes.push(`- **${dom}** — ${liste.length} flux, pays : ${pays}`);
  }
  lignes.push('');
}

const presse = parType.presse || [];
lignes.push('## Presse, moteurs et veille marchande');
lignes.push('');
lignes.push('_Sert à détecter les bon plans relayés (articles « à X € au lieu de Y € »). La plupart n’ont pas de prix exploitable : très peu atteignent le mélange._');
lignes.push('');
// Les enseignes surveillées nommément interrogent les MOTEURS : leur domaine
// n'apparaît donc pas ci-dessous. Sans cette liste, la fiche laisserait croire
// que seuls les 19 médias sont suivis.
const veille = presse.filter((s) => !/^(Presse|Bing)/.test(s.nom));
lignes.push(`### Enseignes surveillées nommément (${new Set(veille.map((s) => s.nom)).size})`);
lignes.push('');
lignes.push([...new Set(veille.map((s) => s.nom))].sort().join(' · '));
lignes.push('');
const parDom = {};
for (const s of presse) (parDom[domaine(s.url)] = parDom[domaine(s.url)] || []).push(s);
const moteurs = ['news.google.com', 'bing.com'];
for (const [dom, liste] of Object.entries(parDom).sort((a, b) => b[1].length - a[1].length)) {
  const marque = moteurs.includes(dom) ? ' *(moteur : requêtes par pays et par enseigne surveillée)*' : '';
  lignes.push(`- **${dom}** — ${liste.length} flux${marque}`);
}
lignes.push('');

lignes.push('## Ce qui arrive réellement à l’écran');
lignes.push('');
lignes.push('| Source | Affichées | Collectées |');
lignes.push('|---|---|---|');
for (const [k, v] of Object.entries(affichees).sort((a, b) => b[1] - a[1])) {
  lignes.push(`| ${k} | ${v} | ${collectees[k] || 0} |`);
}
lignes.push('');
lignes.push('## Sites écartés, et pourquoi');
lignes.push('');
lignes.push('Sondés un par un : **MediaMarkt** (BE, NL, PL), **bol.com**, **Darty**, **Fnac**, **Currys**, **Argos**, **Elgiganten**, **Worten**, **Gamma** — réponse 403 ou 429, page construite en JavaScript, ou zéro donnée produit. Aucun ne publie de prix barré lisible : c’est la raison pour laquelle l’Irlande, les Pays-Bas, le Portugal, le Royaume-Uni et la Suède n’ont aujourd’hui presque que des offres Amazon.');
lignes.push('');

fs.writeFileSync(new URL('SOURCES.md', racine), lignes.join('\n'));
console.log(`SOURCES.md écrit — ${lignes.length} lignes, ${new Set(TOUTES_SOURCES.map((s) => domaine(s.url))).size} domaines distincts`);
