#!/usr/bin/env node
/* ------------------------------------------------------------------------- *
 *  VÉRIFICATEUR DE CATÉGORIES
 *
 *  Pourquoi il existe : un défaut de classement ne se voit PAS. La collecte
 *  réussit, les sources répondent 200, les offres s'affichent — elles sont
 *  simplement rangées dans le mauvais rayon, parfois dans « Autres ». Rien ne
 *  casse, rien n'alerte : il faut aller compter. C'est ce que fait ce script.
 *
 *  Ce qu'il vérifie, en trois temps :
 *
 *    1. COHÉRENCE — il rejoue le classement (`famille()`, importée du
 *       collecteur, jamais recopiée) sur chaque offre publiée et signale les
 *       offres dont la catégorie enregistrée ne correspond plus au calcul.
 *       Cela n'a l'air de rien, mais c'est ce qui attrape les offres restées
 *       classées par une version précédente du code : elles survivent dans le
 *       fichier publié pendant des semaines.
 *
 *    2. TAUX DE NON-CLASSEMENT, PAR PAYS — la mesure qui compte. On distingue
 *       deux « Autres » :
 *         • « autre » ASSUMÉ : la source dit « Culture », « Voyage »,
 *           « Alimentation »… Ces rubriques n'ont pas de famille chez nous,
 *           c'est un choix. Ce n'est pas un défaut.
 *         • « autre » PAR ÉCHEC : ni la source ni le titre n'ont rien dit.
 *           C'est celui-là qu'on traque — un pays dont la langue manque dans
 *           les listes de mots tombe à 90 % ici, et ça se voit.
 *       Le contrôle est fait PAR PAYS, pas globalement : une moyenne mondiale
 *       à 30 % peut cacher un pays à 90 %, et c'est exactement le pays où
 *       l'utilisateur vit.
 *
 *    3. COUVERTURE DES LANGUES — il relit le fichier SOURCE des mots-clés et
 *       compte, pour chaque famille et chaque langue, combien de mots sont
 *       présents. Une langue oubliée dans une famille ne se voit pas à l'œil
 *       dans une liste de 400 mots : le test la rend visible avant que les
 *       utilisateurs de ce pays la subissent.
 *
 *  Usage :
 *      node outils/verificateur-categories.mjs [--fichier docs/offres.json]
 *                                              [--seuil 40] [--verbeux]
 *  Sortie : rapport lisible ; code de sortie 1 si un contrôle échoue (utilisé
 *  par bin/tester.sh et par la suite de tests).
 * ------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { famille, FAMILLES, MARQUES, categorieDeSource, sansAccents, classerOffre, compterMots } from '../collecteur.mjs';

/* Tous les mots utilisables pour classer, marques comprises — mêmes listes que
   le collecteur, fusionnées comme lui. Le vérificateur doit juger sur
   EXACTEMENT ce sur quoi le collecteur décide : sinon il inventerait des
   défauts (« cette offre n'a aucune preuve ») là où la marque en était une. */
const MOTS_TOUS = Object.fromEntries(
  Object.entries(FAMILLES).map(([f, mots]) => [
    f,
    [...mots, ...(MARQUES[f] || [])].map((m) => sansAccents(m).toLowerCase()),
  ]),
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(__dirname, '..');

const arg = (nom, defaut) => {
  const i = process.argv.indexOf('--' + nom);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const VERBEUX = process.argv.includes('--verbeux');
const SEUIL = Number(arg('seuil', 55));            // % d'« autre » PAR ÉCHEC toléré
const SEUIL_MOTS = Number(arg('mots', 8));         // mots minimum par famille et par langue

let fichier = arg('fichier', '');
if (!fichier) {
  const publie = path.join(RACINE, 'docs', 'offres.json');
  const local = path.join(RACINE, 'data', 'offres.json');
  fichier = fs.existsSync(publie) ? publie : local;
}
if (!fs.existsSync(fichier)) {
  console.error(`✗ Aucun fichier d'offres : ${fichier}`);
  process.exit(1);
}

const donnees = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const offres = Array.isArray(donnees) ? donnees : (donnees.offres || []);
const problemes = [];

console.log(`Vérification des catégories — ${offres.length} offres`);
console.log(`  fichier : ${path.relative(RACINE, fichier)}`);
console.log(`  seuil   : ${SEUIL} % d'offres non classées par pays, ${SEUIL_MOTS} mots minimum par langue et par famille\n`);

/* ------------------------------------------------------------------ *
 *  1. COHÉRENCE : le classement enregistré correspond-il au calcul ?
 * ------------------------------------------------------------------ */
let incoherentes = 0, sansPreuve = 0, contredites = 0;
const exemplesIncoherence = [], exemplesSansPreuve = [];
for (const o of offres) {
  const cat = o.categorie || 'autre';
  // On rejuge avec EXACTEMENT la fonction du collecteur : recopier la règle
  // ici reviendrait à vérifier une copie, c'est-à-dire rien.
  const attendu = classerOffre(o);
  if (attendu !== cat) {
    incoherentes++;
    if (exemplesIncoherence.length < 6) {
      exemplesIncoherence.push({ pays: o.pays, avant: cat, apres: attendu, titre: String(o.titre || '').slice(0, 58) });
    }
  }

  // Deux contrôles INDÉPENDANTS du premier, et c'est le cœur du vérificateur :
  // ils ne comparent pas à un recalcul, ils posent la seule question qui compte
  // pour l'utilisateur — « qu'est-ce qui justifie cette rubrique ? ».
  //   • sans preuve : rien, ni la source ni le titre. L'offre est dans une
  //     rubrique qu'aucun élément ne soutient : c'est exactement le défaut
  //     signalé (« des produits dans la mauvaise catégorie »).
  //   • contredite : le titre désigne une autre rubrique avec au moins deux
  //     mots — une preuve plus forte que celle qui a servi à classer.
  if (cat !== 'autre') {
    const t = sansAccents(String(o.titre || '')).toLowerCase();
    const scores = Object.entries(MOTS_TOUS).map(([f, mots]) => [f, compterMots(mots, t)]);
    const touche = scores.some(([f, n]) => f === cat && n > 0);
    const sourceOk = categorieDeSource(o.categorieSource) === cat;
    if (!touche && !sourceOk) {
      sansPreuve++;
      if (exemplesSansPreuve.length < 8) {
        exemplesSansPreuve.push({ pays: o.pays, cat, titre: String(o.titre || '').slice(0, 58), src: o.categorieSource });
      }
    }
    const meilleur = scores.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0];
    if (meilleur && meilleur[0] !== cat && meilleur[1] >= 2) contredites++;
  }
}
console.log(`1. COHÉRENCE ET PREUVES`);
if (incoherentes) {
  console.log(`   ⚠ ${incoherentes} offre(s) mal rangée(s) dans le fichier (classement périmé, d'avant la correction)`);
  exemplesIncoherence.forEach((e) => console.log(`      [${e.pays}] ${e.avant} → ${e.apres} : ${e.titre}`));
  console.log(`   → ces offres seront reclassées au prochain passage du collecteur.`);
} else {
  console.log(`   ✓ toutes les offres portent la catégorie que le calcul leur donne`);
}
if (sansPreuve) {
  console.log(`   ✗ ${sansPreuve} offre(s) dans une rubrique SANS AUCUNE PREUVE (ni source, ni titre, ni marque)`);
  exemplesSansPreuve.forEach((e) => console.log(`      [${e.pays}] ${e.cat.padEnd(9)} : ${e.titre}   (source : ${e.src})`));
} else {
  console.log(`   ✓ chaque offre rangée dans une rubrique est justifiée par sa source, son titre ou sa marque`);
}
if (contredites) console.log(`   ✗ ${contredites} offre(s) contredites par deux mots ou plus du titre`);
else console.log(`   ✓ aucune offre dont le titre désigne clairement une autre rubrique`);

/* Ces deux-là sont les contrôles BLOQUANTS : ce sont eux qui traduisent le
 * défaut signalé (« des produits dans la mauvaise catégorie »). Le taux
 * d'offres non classées, lui, n'est qu'un indicateur à surveiller — une partie
 * du contenu (abonnements, billets d'avion, paris) n'a réellement pas de
 * rubrique chez nous, et la forcer serait une faute, pas une correction. */
if (sansPreuve) problemes.push(`${sansPreuve} offre(s) rangée(s) sans aucune preuve`);
if (contredites) problemes.push(`${contredites} offre(s) contredites par leur titre`);

/* ------------------------------------------------------------------ *
 *  2. NON-CLASSEMENT PAR PAYS
 * ------------------------------------------------------------------ */
const parPays = {};
for (const o of offres) {
  const p = o.pays || '?';
  const s = (parPays[p] = parPays[p] || { total: 0, autreChoisi: 0, autreEchec: 0, parFamille: {} });
  s.total++;
  const cat = o.categorie || 'autre';
  s.parFamille[cat] = (s.parFamille[cat] || 0) + 1;
  if (cat === 'autre') {
    // La différence tient à UNE question : la source a-t-elle tranché ?
    if (categorieDeSource(o.categorieSource)) s.autreChoisi++;
    else {
      const texte = sansAccents(String(o.titre || '')).toLowerCase();
      // MÊME règle de correspondance que le classement (compterMots), et non
      // un `includes` : sans frontière de mot, « car » (auto) se retrouve dans
      // « carte », « sac » (mode) dans « sachet », « dom » (maison) dans
      // « domino ». Un contrôle plus grossier que la règle qu'il contrôle
      // fabrique de faux défauts — et on cherche ensuite le bug au mauvais
      // endroit.
      let touche = false;
      for (const mots of Object.values(MOTS_TOUS)) {
        if (compterMots(mots, texte)) { touche = true; break; }
      }
      if (touche) s.parFamille.__neDevraitPasEtreAutre = (s.parFamille.__neDevraitPasEtreAutre || 0) + 1;
      else s.autreEchec++;
    }
  }
}

console.log(`\n2. NON-CLASSEMENT PAR PAYS  (« autre » par échec = aucune preuve, ni source ni titre)`);
const lignes = Object.entries(parPays).sort((a, b) => b[1].total - a[1].total);
console.log('   pays   offres   autre-choisi   autre-ÉCHEC   taux d\'échec');
let pires = 0;
for (const [p, s] of lignes) {
  const taux = Math.round((s.autreEchec / s.total) * 100);
  const drapeau = taux > SEUIL ? '  ← AU-DESSUS DU SEUIL' : '';
  if (taux > SEUIL) pires++;
  console.log(`   ${p.padEnd(6)} ${String(s.total).padStart(6)}   ${String(s.autreChoisi).padStart(12)}   ${String(s.autreEchec).padStart(11)}   ${String(taux).padStart(9)} %${drapeau}`);
}
const totalAutreEchec = lignes.reduce((a, [, s]) => a + s.autreEchec, 0);
const totalAutreChoisi = lignes.reduce((a, [, s]) => a + s.autreChoisi, 0);
console.log(`   ${'TOUT'.padEnd(6)} ${String(offres.length).padStart(6)}   ${String(totalAutreChoisi).padStart(12)}   ${String(totalAutreEchec).padStart(11)}   ${String(Math.round((totalAutreEchec / offres.length) * 100)).padStart(9)} %`);
if (pires) problemes.push(`${pires} pays au-dessus de ${SEUIL} % d'offres non classées`);

const restesAutre = lignes.reduce((a, [, s]) => a + (s.parFamille.__neDevraitPasEtreAutre || 0), 0);
if (restesAutre) {
  problemes.push(`${restesAutre} offre(s) en « Autres » alors qu'un mot-clé de famille est présent dans le titre`);
  console.log(`   ⚠ ${restesAutre} offre(s) en « Autres » contiennent pourtant un mot-clé de famille`);
}

/* ------------------------------------------------------------------ *
 *  3. COUVERTURE DES LANGUES
 *
 *  On relit le FICHIER source (et non la valeur importée) pour compter les
 *  mots par langue : c'est le seul moyen de voir une langue oubliée dans une
 *  famille, l'import ne portant plus la trace des commentaires de langue.
 * ------------------------------------------------------------------ */
const LANGUES = ['fr', 'en', 'de', 'nl', 'es', 'it', 'pt', 'pl', 'sv'];
const source = fs.readFileSync(path.join(RACINE, 'collecteur.mjs'), 'utf8');
const debut = source.indexOf('const FAMILLES = {');
const bloc = debut > -1 ? source.slice(debut, source.indexOf('\n};', debut)) : '';
const famillesTexte = [...bloc.matchAll(/\n  ([a-z]+): \[([\s\S]*?)\n  \],/g)];

console.log(`\n3. COUVERTURE DES LANGUES  (FAMILLES : ${famillesTexte.length} familles lues dans le fichier)`);
const manques = [];
const grandTotal = {};
for (const [, nom, corps] of famillesTexte) {
  const parts = corps.split(/\n\s*\/\/ ([a-z]{2})\n/);
  const compte = {};
  for (let i = 1; i < parts.length; i += 2) {
    const langue = parts[i];
    const mots = parts[i + 1].split(',').map((m) => m.trim()).filter((m) => m && !m.startsWith('//'));
    compte[langue] = mots.length;
  }
  const trous = LANGUES.filter((l) => (compte[l] || 0) < SEUIL_MOTS);
  const resume = LANGUES.map((l) => `${l}:${compte[l] || 0}`).join(' ');
  console.log(`   ${nom.padEnd(10)} ${resume}${trous.length ? '   ← manque : ' + trous.join(', ') : ''}`);
  if (trous.length) manques.push(`${nom} (${trous.join(', ')})`);
  for (const l of LANGUES) grandTotal[l] = (grandTotal[l] || 0) + (compte[l] || 0);
}
console.log(`   ${'total'.padEnd(10)} ${LANGUES.map((l) => `${l}:${grandTotal[l]}`).join(' ')}`);
if (manques.length) problemes.push(`familles incomplètes : ${manques.join(' | ')}`);

/* Catégories de sources : combien de libellés étrangers sont reconnus ? */
console.log(`\n   CATEGORIES_SOURCES : ${(source.match(/\['[^']+',\s*'(autre|tech|maison|bricolage|mode|sport|jouets|auto|beaute)'\]/g) || []).length} motifs déclarés`);
const brut = new Set(offres.map((o) => o.categorieSource).filter(Boolean));
// « presse » et les noms de NOS familles ne sont pas des libellés à traduire :
// ce sont des valeurs que le collecteur écrit lui-même, et categorieDeSource()
// les refuse VOLONTAIREMENT (une rubrique interne n'est pas une rubrique de
// source). Les compter comme « non traduits » fabriquerait un faux défaut.
const DELIBERES = new Set(['presse', 'enseigne', ...Object.keys(FAMILLES)]);
const nonReconnues = [...brut].filter((c) => !categorieDeSource(c) && !DELIBERES.has(sansAccents(c).toLowerCase()));
console.log(`   libellés bruts rencontrés dans les données : ${brut.size}, non traduits : ${nonReconnues.length}`);
if (nonReconnues.length && VERBEUX) nonReconnues.slice(0, 20).forEach((c) => console.log(`      "${c}"`));
if (nonReconnues.length > 10) problemes.push(`${nonReconnues.length} libellés de catégorie non traduits`);

/* ------------------------------------------------------------------ */
console.log(`\n${problemes.length ? '✗ ÉCHEC' : '✓ CONFORME'}${problemes.length ? ' :\n  - ' + problemes.join('\n  - ') : ' — aucun contrôle en défaut.'}`);
process.exit(problemes.length ? 1 : 0);
