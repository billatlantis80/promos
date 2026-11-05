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
  ['enseigne', 'Enseignes — page d’offres officielle', 'Articles que l’enseigne présente elle-même comme ses offres du moment, avec leur **prix réel**. Sans prix barré publié, la remise n’est pas chiffrable — seules les vraies réductions sont gardées.'],
  ['groupon', 'Activités — bons plans de service (spa, restaurant, sorties)', 'Chaque bon plan porte **deux prix réels** ; la remise est **calculée** entre les deux, jamais lue dans le titre. Un **garde-fou de vraisemblance** rejette les prix de référence gonflés : au-delà de 5× le prix demandé, ou d’une remise de 90 %, ce n’est plus une promotion.'],
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
lignes.push('## Les marchands branchés, et ce qui reste hors de portée');
lignes.push('');
lignes.push('Deux marchands sont branchés, et chacun a demandé un travail **sur mesure** — leurs formats n’ont rien en commun :');
lignes.push('');
lignes.push('- **Coolblue BE** — page `/fr/offres` en **JSON-LD schema.org**, 8 pages. ⚠️ C’est un **CATALOGUE à prix nu**, pas une page de promotions. Mesuré : 22 produits par page, 5 seulement portent un prix de référence, **un seul atteint 15 %**. Seules ces vraies remises sont affichées — le prix de référence est lu dans la charge interne de la page, là où il vit réellement.');
lignes.push('- **Groupon BE** — `/fr/landing/sale`, `/fr/bon-plan` (prestations) et `/goods` (produits). Les bons plans sont dans le **JSON de la page** (`__NEXT_DATA__`), les montants **en centimes**, avec les **deux prix**. C’est la seule source belge qui publie des remises chiffrables. Son `robots.txt` dit `Allow: /`. ⚠️ Il **refuse le client HTTP de Node** (403 sur toute combinaison d’en-têtes) : la lecture passe par `curl` — même URL, page publique.');
lignes.push('');
lignes.push('Le reste a été **sondé, pas supposé** — une trentaine de domaines belges, avec contrôle positif et négatif à chaque vague :');
lignes.push('');
lignes.push('- **Colruyt, Delhaize, Lidl, Aldi, Carrefour, Kruidvat, Action** — dépliants en **image** et applications JavaScript : **0 produit, 0 prix** dans le HTML servi. Colruyt expose une passerelle publique, mais elle réclame un `clientCode` introuvable dans ses pages — et une devinette n’est pas une source.');
lignes.push('- **Amazon.com.be, 2ememain, DreamLand, Fnac.be, Decathlon.be, Makro** — page rendue en JavaScript, ou **403** : rien de lisible dans le HTML servi. L’API Product Advertising d’Amazon exige une clé — écartée au titre de la règle « aucune clé ».');
lignes.push('- **Media Markt BE** — annoncé un temps comme lisible en JSON-LD, puis **revérifié : chemins de promotions en 404**, page d’accueil sans `ItemList`. Piste périmée, jamais branchée. **MediaMarkt NL/PL, Euronics** : chemins en 404 ou redirection.');
lignes.push('- **Vanden Borre** — publie bien des prix (`"price": 599`), mais **`discount` vaut 0 partout** et ses pages Black Friday sont rendues en JavaScript : un catalogue à prix nu, sans aucune remise lisible.');
lignes.push('- **Kieskeurig.be** — 481 blocs de données, mais `lowPrice`/`highPrice` y sont l’**écart entre boutiques**, pas une remise : c’est un comparateur, pas une page de promotions.');
lignes.push('- **bol.com, Darty, Currys, Argos, Elgiganten, iBOOD, Kelkoo** — refus explicite (**403** ou **429**) depuis ce serveur, avec un navigateur standard. **Worten** répond 200 sans aucune donnée produit.');
lignes.push('- **Veepee.be, Groupon (états Apollo non-Next)** — les prix n’existent **pas dans le HTML** : ils arrivent après coup par une API interne. Sans clé, il n’y a rien à lire.');
lignes.push('- **Reddit (`r/belgiumdeals`), HLN, Het Nieuwsblad, Sudinfo** — mur de connexion, mur de consentement, ou **403**.');
lignes.push('');
lignes.push('Il n’existe **aucune communauté belge de bons plans** : `be.pepper.com` n’existe pas, le flux Dealabs Belgique rend **404**, et folders.be / dealfinder.be / promofolder.be sont injoignables. C’est la raison de fond pour laquelle la Belgique n’avait que des offres Amazon.');
lignes.push('');

fs.writeFileSync(new URL('SOURCES.md', racine), lignes.join('\n'));
console.log(`SOURCES.md écrit — ${lignes.length} lignes, ${new Set(TOUTES_SOURCES.map((s) => domaine(s.url))).size} domaines distincts`);
