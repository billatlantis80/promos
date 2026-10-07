/**
 * Inventaire des traductions : quelles clés du dictionnaire sont RÉELLEMENT
 * appelées par le code, et lesquelles ne le sont jamais.
 *
 * La clé du dictionnaire EST le texte français. On ne se contente donc pas de
 * chercher `t('texte')` : les clés circulent aussi par des variables
 * (`t(th.nom)`, `t(libelle)`, `t(options.placeholder)`) et par les attributs
 * `data-i18n*` de index.html. On collecte :
 *   1. tout littéral de chaîne présent dans les fichiers source (hors dictionnaire) ;
 *   2. la valeur de tout attribut data-i18n* ;
 *   3. les littéraux qui CONTIENNENT la clé (gabarit reconstruit) et ceux qui
 *      SONT contenus dedans (clé recomposée par morceaux).
 * Une clé sans aucune correspondance est candidate à la suppression.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = '/opt/data/webdev/projects/promos';
const DICO = join(RACINE, 'public/langues.js');

const { LANGUES } = await import(DICO);
const CLES = Object.keys(LANGUES.fr.textes);

/* --- 1. Ramasser tout le texte des sources ------------------------------- */
const fichiers = [];
(function parcourir(rep) {
  for (const e of readdirSync(rep)) {
    const p = join(rep, e);
    if (statSync(p).isDirectory()) {
      if (e === 'fonts' || e === 'node_modules') continue;
      parcourir(p);
    } else if (/\.(js|mjs|html|css|json)$/.test(e) && p !== DICO) {
      fichiers.push(p);
    }
  }
})(join(RACINE, 'public'));
for (const extra of ['server.js', 'index.html']) {
  try { fichiers.push(join(RACINE, extra)); } catch { /* absent */ }
}

// Tous les littéraux : '…' "…" `…` (on garde le contenu brut, échappements inclus).
const litteraux = [];
const attributs = [];
for (const f of fichiers) {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { continue; }
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const v = m[1] ?? m[2] ?? m[3];
    if (v) litteraux.push({ f: relative(RACINE, f), v });
  }
  for (const m of src.matchAll(/data-i18n[a-z-]*\s*=\s*"([^"]*)"/g)) {
    attributs.push({ f: relative(RACINE, f), v: m[1] });
  }
}

/* --- 2. Décider, pour chaque clé, si elle est atteignable ----------------- */
const normalise = (s) => s.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
const norme = new Map(litteraux.map((l) => [normalise(l.v), l]));
const normAttr = new Map(attributs.map((a) => [normalise(a.v), a]));

const vivantes = [];
const mortes = [];
const douteuses = [];

for (const cle of CLES) {
  const n = normalise(cle);
  const exactElt = norme.get(n) || normAttr.get(n);
  if (exactElt) { vivantes.push({ cle, via: exactElt.f }); continue; }

  // Correspondance partielle : la clé est un gabarit (« Voir {n} offres ») ou
  // du texte recomposé. On cherche la version sans les {…} comme sous-chaîne.
  const nu = n.replace(/\s*\{[a-z]+\}\s*/gi, ' ').replace(/\s+/g, ' ').trim();
  const partiels = [];
  if (nu.length >= 6) {
    for (const [k, l] of norme) if (k.includes(nu)) partiels.push(l);
    for (const [k, a] of normAttr) if (k.includes(nu)) partiels.push(a);
  }
  if (partiels.length === 1) { vivantes.push({ cle, via: `${partiels[0].f} (partiel)` }); continue; }
  if (partiels.length > 1) { douteuses.push({ cle, n: partiels.length, ex: partiels.slice(0, 3).map((x) => x.f) }); continue; }
  mortes.push(cle);
}

/* --- 3. Rapport ---------------------------------------------------------- */
console.log(`fichiers balayés : ${fichiers.length}  |  littéraux : ${litteraux.length}  |  attributs data-i18n : ${attributs.length}`);
console.log(`clés au dictionnaire : ${CLES.length}`);
console.log(`  vivantes (littéral exact) : ${vivantes.length}`);
console.log(`  retenues (correspondance partielle) : ${douteuses.length}`);
console.log(`  SANS AUCUNE RÉFÉRENCE : ${mortes.length}\n`);

if (douteuses.length) {
  console.log('--- à relire à la main (correspondance ambiguë) ---');
  for (const d of douteuses) console.log(`  « ${d.cle} »  (${d.n} pistes : ${d.ex.join(', ')})`);
  console.log('');
}
console.log('--- JAMAIS CITÉES ---');
for (const m of mortes) console.log(`  « ${m} »`);

// Sortie machine pour la suite du travail.
const { writeFileSync } = await import('node:fs');
writeFileSync('/tmp/inventaire-t9n.json', JSON.stringify({ mortes, douteuses, vivantes }, null, 2));
console.log(`\n(/tmp/inventaire-t9n.json écrit)`);
