#!/usr/bin/env node
/* =============================================================================
   MESURER CE QUE LE VOLET DES OFFRES EMPORTERAIT VRAIMENT.

   POURQUOI CE SCRIPT, ET POURQUOI MAINTENANT. La règle des sept jours repose sur
   un signal INDIRECT : « plus aucune source n'a reservi cette offre depuis sept
   jours » (`vuLe`). Ce signal a déjà été pris en défaut une fois, mesuré à la
   main : sur TROIS offres disparues des flux, DEUX étaient encore valides
   (`isExpired: false`, `status: Activated`, `isHot: true`). Deux sur trois, ça
   ne se décide pas : c'est une intuition déguisée en chiffre.

   Le signal DIRECT existe et il ne coûte qu'une requête par offre : la page de
   l'offre publie son propre verdict, dans le JSON qu'elle embarque. Ce script
   l'interroge sur un ÉCHANTILLON DÉTERMINISTE de ce que la règle emporterait, et
   rend le seul chiffre qui tranche : quelle part de ces offres est vraiment morte.

   CE QU'IL FAIT, ET RIEN DE PLUS :
     1. il prend la population réelle — les offres du catalogue publié que
        `donneesPerimees` désigne (LA MÊME fonction que le retrait : une seule
        règle, un seul verdict) ;
     2. il en tire un échantillon réparti sur les sources (pas les 40 premières
        d'un seul marchand : ce serait mesurer ce marchand, pas la règle) ;
     3. il lit la page de chaque offre et y cherche le verdict de la source ;
     4. il rend le taux de faux positifs, la répartition, et le trafic que cette
        vérification coûte.

   Il n'écrit RIEN dans le catalogue, ne retire rien, ne publie rien. Sonde, pas
   règle.

   Usage :
     node bin/mesurer-peremption-source.mjs [--echantillon 40] [--pause 400]
                                            [--sortie donnees/peremption-source.json]
   ============================================================================= */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { donneesPerimees, poidsDuVisuel, lireVerdictSource } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));

/** Empreinte stable d'un identifiant : elle sert à MÉLANGER l'ordre des requêtes
 *  de façon déterministe (même échantillon à chaque exécution), et c'est aussi
 *  de la POLITESSE : trié par source, l'échantillon enverrait huit requêtes de
 *  suite au même hôte ; mélangé, il alterne les hôtes. */
const empreinte = (s) => parseInt(crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8), 16);

const args = process.argv.slice(2);
const lire = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : defaut;
};
const ECHANTILLON = lire('--echantillon', 40);
const PAUSE = lire('--pause', 400);
const SORTIE = path.join(ICI, '..', lire('--sortie', 'donnees/peremption-source.json'));

/** ⚠ LA LECTURE DU VERDICT EST CELLE DU COLLECTEUR, PAS UNE COPIE.
 *
 *  La première version de cette sonde avait sa propre lecture — deux
 *  implémentations de la même question finissent toujours par ne plus répondre la
 *  même chose, et on ne s'en aperçoit qu'après avoir mesuré avec l'une et agi sur
 *  l'autre. Ici la sonde et le contrôle permanent appellent la MÊME fonction
 *  (`lireVerdictSource`), donc le taux annoncé et le taux subi ne peuvent pas
 *  diverger.
 *
 *  « illisible » et « sans verdict » ne sont PAS des verdicts : ils ne comptent ni
 *  comme mortes ni comme vivantes. Les confondre avec l'un des deux ferait dire au
 *  taux de faux positifs une chose qu'il n'a pas mesurée. */
const verdictDePage = (url) => lireVerdictSource(url);

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const fichier = JSON.parse(readFileSync(path.join(ICI, '..', 'docs', 'offres.json'), 'utf8'));
  const population = fichier.offres.filter((o) => donneesPerimees(o));
  if (!population.length) { console.log('aucune offre au-delà du délai : rien à mesurer'); return 0; }

  // ÉCHANTILLON RÉPARTI. Trié par source puis par ancienneté de service — donc
  // chaque source y est représentée à hauteur de son poids RÉEL dans la
  // population — puis MÉLANGÉ de façon déterministe, et enfin pris à pas
  // régulier. Deux exécutions rendent le même échantillon : deux mesures sont
  // comparables, et l'ordre des requêtes alterne les hôtes (politesse).
  const tri = [...population].sort((a, b) => String(a.sourceId).localeCompare(String(b.sourceId))
    || String(a.vuLe).localeCompare(String(b.vuLe)));
  const pas = Math.max(1, Math.floor(tri.length / ECHANTILLON));
  const regulier = [];
  for (let i = 0; i < tri.length && regulier.length < ECHANTILLON; i += pas) regulier.push(tri[i]);
  const tirage = regulier.sort((a, b) => empreinte(a.id) - empreinte(b.id));

  const parSourcePopulation = {};
  for (const o of population) parSourcePopulation[o.sourceId] = (parSourcePopulation[o.sourceId] || 0) + 1;

  console.log(`POPULATION : ${population.length} offre(s) du catalogue publié au-delà de sept jours sans service`);
  console.log(`ÉCHANTILLON : ${tirage.length} offre(s), une toutes les ${pas} dans un tri par source (répartition proportionnelle)`);
  console.log(`Sources concernées : ${Object.keys(parSourcePopulation).length}\n`);

  const resultats = [];
  let octets = 0;
  for (const o of tirage) {
    const v = await verdictDePage(o.lienPage);
    octets += v.octets || 0;
    resultats.push({
      id: o.id, sourceId: o.sourceId, pays: o.pays, vuLe: o.vuLe, titre: String(o.titre).slice(0, 70),
      lienPage: o.lienPage, etat: v.etat, detail: v.detail, octets: v.octets,
    });
    process.stdout.write(`  ${v.etat.padEnd(11)} ${String(o.sourceId).padEnd(16)} ${o.vuLe.slice(0, 10)}  ${String(o.titre).slice(0, 52)}\n`);
    await attendre(PAUSE);
  }

  const compte = (e) => resultats.filter((r) => r.etat === e).length;
  const expirees = compte('expiree'), vivantes = compte('vivante'), illisibles = compte('illisible'), sans = compte('sans-signal');
  const juges = expirees + vivantes;

  console.log('\n═══ VERDICT DES PAGES ELLE-MÊMES ═══');
  console.log(`  expirées (la page le dit)      : ${expirees}`);
  console.log(`  VIVANTES (la règle se trompait): ${vivantes}`);
  console.log(`  sans verdict publié            : ${sans}`);
  console.log(`  illisibles                     : ${illisibles}`);
  if (juges) {
    const taux = (100 * vivantes) / juges;
    // L'INTERVALLE, PARCE QU'UN TAUX SUR 31 JUGEMENTS SE LIT AVEC SA MARGE.
    // Wilson, au seuil de 95 % : une fourchette étroite dirait « c'est mesuré »,
    // une fourchette large dit « c'est mesuré sur de petites quantités » — et
    // c'est la seconde information qui manque le plus souvent.
    const z = 1.96, n = juges, p = vivantes / juges;
    const centre = (p + z * z / (2 * n)) / (1 + z * z / n);
    const demi = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n);
    const bas = Math.max(0, 100 * (centre - demi)), haut = Math.min(100, 100 * (centre + demi));
    console.log(`\n  FAUX POSITIFS : ${vivantes}/${juges} = ${taux.toFixed(0)} % des offres jugées (fourchette 95 % : ${bas.toFixed(0)} à ${haut.toFixed(0)} %)`);
    // Ce que ça veut dire en volume : on pèse les visuels RÉELS de la population
    // et on applique le taux mesuré. Le chiffre qui compte n'est pas le
    // pourcentage, c'est le nombre d'annonces vivantes qu'on effacerait pour rien.
    const moPopulation = population.reduce((s, o) => s + poidsDuVisuel(o.image), 0) / 1e6;
    const vivantesExtrapolees = population.length * vivantes / juges;
    console.log(`  → extrapolé à la population : ${Math.round(population.length * bas / 100)} à ${Math.round(population.length * haut / 100)} offre(s) VIVANTE(S) effacée(s) pour rien (estimation ${Math.round(vivantesExtrapolees)})`);
    console.log(`    sur ${moPopulation.toFixed(1)} Mo de visuels au total, ${(moPopulation * bas / 100).toFixed(1)} à ${(moPopulation * haut / 100).toFixed(1)} Mo partiraient à tort`);
    var tauxBas = +bas.toFixed(1), tauxHaut = +haut.toFixed(1);
  }
  const parSource = {};
  for (const r of resultats) { parSource[r.sourceId] = parSource[r.sourceId] || { expiree: 0, vivante: 0, autre: 0 }; if (parSource[r.sourceId][r.etat] !== undefined) parSource[r.sourceId][r.etat]++; else parSource[r.sourceId].autre++; }
  console.log('\n  Par source : ' + Object.entries(parSource).map(([s, v]) => `${s} ${v.expiree}†/${v.vivante}✓${v.autre ? `/${v.autre}?` : ''}`).join('  '));
  console.log(`\n  TRAFIC DE LA VÉRIFICATION : ${tirage.length} requête(s), ${(octets / 1e6).toFixed(2)} Mo lus (${Math.round(octets / Math.max(1, tirage.length) / 1024)} Ko par page)`);

  mkdirSync(path.dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, JSON.stringify({
    genereLe: new Date().toISOString(),
    population: population.length, echantillon: tirage.length, pas,
    expirees, vivantes, sansVerdict: sans, illisibles,
    fauxPositifsPct: juges ? +(100 * vivantes / juges).toFixed(1) : null,
    fauxPositifsPctIntervalle: juges ? [tauxBas, tauxHaut] : null,
    octetsLus: octets, requetes: tirage.length,
    parSource, resultats,
  }, null, 1));
  console.log(`\n  Relevé écrit : ${SORTIE}`);
  return 0;
}

process.exit(await main());
