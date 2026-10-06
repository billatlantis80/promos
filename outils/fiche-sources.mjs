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
lignes.push('## Pourquoi UNE seule enseigne branchée');
lignes.push('');
lignes.push('La famille « enseignes » compte un marchand, **Coolblue**, et voici l’état exact des autres — mesuré, pas supposé. Chaque enseigne demande un travail sur mesure : il n’existe ni flux commun, ni format partagé.');
lignes.push('');
lignes.push('- **Coolblue BE** — page `/fr/offres` en **JSON-LD schema.org**, 8 pages. ⚠️ C’est un **CATALOGUE à prix nu**, pas une page de promotions. Mesuré : 22 produits par page, 5 seulement portent un prix de référence, **un seul atteint 15 %**. Seules ces vraies remises sont désormais affichées — le prix de référence est lu dans la charge interne de la page, là où il vit réellement.');
lignes.push('- **Colruyt, Delhaize, Lidl, Aldi, Carrefour, Kruidvat, Action** — dépliants en **image** et applications JavaScript : **0 produit, 0 prix** dans le HTML servi. Colruyt expose une passerelle publique, mais elle réclame un `clientCode` introuvable dans ses pages — et une devinette n’est pas une source.');
lignes.push('- **Amazon.com.be** — page 100 % JavaScript (0 ASIN, 0 prix dans le HTML) ; l’API Product Advertising exige une clé. Écartée au titre de la règle « aucune clé ».');
lignes.push('- **Media Markt BE** — annoncé un temps comme lisible en JSON-LD, puis **revérifié : chemins de promotions en 404**, page d’accueil sans `ItemList` (4 prix seulement). Piste périmée, jamais branchée.');
lignes.push('- **MediaMarkt NL/PL, Euronics** — chemins testés en 404 ou redirection : l’URL de promotions n’a pas été trouvée. Ce n’est **pas** un refus du site, c’est une recherche inaboutie.');
lignes.push('- **bol.com, Darty, Fnac, Currys, Argos, Elgiganten** — refus explicite (**403** ou **429**) depuis ce serveur, avec un navigateur standard.');
lignes.push('- **Worten** — répond 200, mais aucune donnée produit dans la page.');
lignes.push('');
lignes.push('Conséquence assumée : les 40 % reposent aujourd’hui sur **Coolblue + les 7 communautés de bons plans**. Étendre la part des enseignes est un travail **marchand par marchand** — un chemin de promotions à trouver, un format à valider, un analyseur à écrire.');
lignes.push('');

fs.writeFileSync(new URL('SOURCES.md', racine), lignes.join('\n'));
console.log(`SOURCES.md écrit — ${lignes.length} lignes, ${new Set(TOUTES_SOURCES.map((s) => domaine(s.url))).size} domaines distincts`);
