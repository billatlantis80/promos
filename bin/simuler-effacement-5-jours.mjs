#!/usr/bin/env node
/* =============================================================================
   SIMULATION EN SITUATION RÉELLE — « CINQ JOURS AFFICHÉS, PUIS EFFACÉE ».

   DEMANDE DE B, 14/10/2026 : « Faisons la simulation en situation réelle avant de
   prendre la décision. L'idée c'est qu'une carte reste sur le site 5 jours. Après
   5 jours elle est directement effacée, totalement. Après la mise à jour suivante,
   les promotions encore actives réapparaissent comme des nouvelles promotions pour
   5 jours mais avec le jour total depuis la première fois qu'elle est apparue dans
   notre fil de promotions. Est-ce que c'est possible et est-ce que ce serait
   intéressant techniquement ? »

   CE QUE CETTE SIMULATION EST : une SONDE, pas une règle. Elle n'efface RIEN — ni
   carte, ni visuel — et n'écrit RIEN dans le catalogue. Elle observe et elle compte.

   POURQUOI ELLE EST NÉCESSAIRE. La réponse tient à un chiffre qu'on ne peut pas
   deviner : la part des cartes qui, effacées, REVIENNENT au passage suivant parce
   que leur source les sert encore. Mesuré une fois, à un instant donné : 0,7 % des
   cartes qui franchissent les cinq jours aujourd'hui. Ce chiffre-là ne dit pas ce
   qui se passe ENSUITE — combien de cycles, quelle part du fil, quel âge total. Une
   mesure instantanée n'est pas une simulation ; celle-ci suit des passages RÉELS.

   COMMENT ELLE DÉTECTE UN RETOUR, SANS EFFACER. C'est le point délicat, et il faut
   le dire au lieu de le cacher : on ne peut pas observer un retour qu'on n'a pas
   provoqué. Le PROXY est `vuLe` — la dernière fois qu'une source a servi l'offre.
   Une carte virtuellement effacée à T revient si, plus tard, sa source la sert
   encore : alors `vuLe` dépasse T. C'est exactement ce que la fusion ferait dans le
   vrai système : la carte ne serait plus dans `connues`, la source la resservirait,
   elle rentrerait avec `premiereVue` remis à maintenant (collecteur.mjs, l. 7810).
   Le proxy est donc fidèle à la mécanique, et il est nommé comme proxy.

   LES DEUX HORLOGES, ET C'EST TOUT LE SUJET DE B :
     - l'horloge d'AFFICHAGE repart à chaque retour (cinq jours neufs) ;
     - l'horloge TOTALE, elle, ne repart JAMAIS : c'est la première parution chez
       nous, et c'est elle que la carte afficherait. Elle a besoin d'une MÉMOIRE QUI
       SURVIT À L'EFFACEMENT — c'est-à-dire exactement la « liste d'exclusion » que
       le code d'aujourd'hui n'écrit pas. Cette simulation tient ce registre, à part,
       pour dire ce qu'il pèserait : `cleDe` est STABLE (PAYS + URL sans protocole,
       sans paramètres, sans barre finale), donc une clé survit à l'effacement de la
       carte — mesuré, 74 caractères en moyenne.

   CE QU'ELLE PRODUIT, ET OÙ :
     data/simulation-5-jours.json     l'état (registre des premières vues, cycles)
     data/simulation-5-jours.jsonl    un enregistrement par événement (jamais réécrit)
     une LIGNE le soir, à partir de 20 h (heure belge), sur la sortie standard.
   Les deux premiers vivent dans `data/`, que git ignore : la simulation ne pèse
   donc rien dans le dépôt, contrairement à ce qu'elle mesure.

   Usage :
     node bin/simuler-effacement-5-jours.mjs            # un passage (silencieux)
     node bin/simuler-effacement-5-jours.mjs --rapport  # l'état complet, lisible
     node bin/simuler-effacement-5-jours.mjs --json     # l'état calculé
     node bin/simuler-effacement-5-jours.mjs --heure 20 # l'heure de la ligne du soir
   ============================================================================= */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleDe, ageJours } from '../collecteur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const CATALOGUE = path.join(RACINE, 'docs', 'offres.json');
const DATA = path.join(RACINE, 'data');
const ETAT = path.join(DATA, 'simulation-5-jours.json');
const JOURNAL = path.join(DATA, 'simulation-5-jours.jsonl');

const JOURS_AFFICHAGE = 5;
const FUSEAU = 'Europe/Brussels';

const args = process.argv.slice(2);
const lireNombre = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : defaut;
};
const HEURE_LIGNE = lireNombre('--heure', 20);

const maintenant = new Date();
const maintenantIso = maintenant.toISOString();

/** L'heure et le jour LOCAUX de B (Bruxelles) : un « soir » se lit chez lui, pas
 *  en UTC. Le décalage d'été rendrait toute heure fixe fausse la moitié de l'année. */
const localB = (d = maintenant) => {
  const f = new Intl.DateTimeFormat('fr-BE', {
    timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: Number(p.hour), minutes: `${p.hour}:${p.minute}` };
};
const AUB = localB();

// ---------------------------------------------------------------------------
// L'état — le registre qui joue le rôle de la mémoire manquante
// ---------------------------------------------------------------------------
const NEUF = () => ({
  debut: maintenantIso,
  maj: maintenantIso,
  passages: 0,
  /** La PREMIÈRE PARUTION CHEZ NOUS, par clé stable. Elle ne se réinitialise
   *  JAMAIS : c'est l'horloge totale demandée par B. */
  premieres: {},
  /** Les cartes que le vrai système aurait effacées, avec l'âge total qu'elles
   *  avaient ce jour-là. Elles restent ici : c'est la « liste d'exclusion » que
   *  le code actuel n'écrit pas, et c'est son POIDS qu'on veut connaître. */
  effacees: {},
  /** Le début de la fenêtre d'affichage en cours, par clé — remis à maintenant à
   *  chaque retour. C'est l'horloge d'affichage, remise à zéro à chaque cycle. */
  fenetre: {},
  compte: { effacees: 0, revenues: 0, cycles: 0, passagesSansRien: 0 },
  lignes: { jour: '', effacees: 0, revenues: 0 },
});

function charger() {
  try {
    const e = JSON.parse(readFileSync(ETAT, 'utf8'));
    const n = NEUF();
    return { ...n, ...e, compte: { ...n.compte, ...(e.compte || {}) },
             lignes: { ...n.lignes, ...(e.lignes || {}) } };
  } catch { return NEUF(); }
}

function sauver(etat) {
  try {
    mkdirSync(DATA, { recursive: true });
    writeFileSync(ETAT, JSON.stringify(etat));
  } catch (e) { console.error(`simulation : état non écrit — ${e.message}`); }
}

function noter(evenement) {
  try {
    mkdirSync(DATA, { recursive: true });
    appendFileSync(JOURNAL, JSON.stringify({ t: maintenantIso, ...evenement }) + '\n');
  } catch { /* un journal qu'on ne peut pas écrire ne doit pas arrêter la mesure */ }
}

// ---------------------------------------------------------------------------
// LE PASSAGE
// ---------------------------------------------------------------------------
function passage() {
  const etat = charger();
  etat.passages += 1;
  etat.maj = maintenantIso;
  if (!etat.debut) etat.debut = maintenantIso;

  let catalogue;
  try {
    catalogue = JSON.parse(readFileSync(CATALOGUE, 'utf8'));
  } catch (e) {
    return { etat, anomalies: [`catalogue illisible : ${e.message}`], rien: true };
  }
  const offres = (catalogue.offres || []).filter((o) => o.type !== 'article');

  const effaceesCePassage = [];
  const revenuesCePassage = [];
  let premieresNouvelles = 0;
  let affichees = 0;
  let fenetreOuverte = 0;

  for (const o of offres) {
    const cle = cleDe(o);

    // 1. LE REGISTRE DES PREMIÈRES VUES. On l'amorce avec ce que le catalogue
    //    porte déjà (`premiereVue`), donc la simulation ne repart pas de zéro :
    //    l'âge total est juste dès le premier passage.
    if (!etat.premieres[cle]) {
      const p = o.premiereVue || o.vuLe;
      if (p) { etat.premieres[cle] = p; premieresNouvelles += 1; }
    }

    const ageAffichage = ageJours(o.premiereVue, maintenant.getTime()) ??
                         ageJours(o.vuLe, maintenant.getTime());
    const ageTotal = ageJours(etat.premieres[cle], maintenant.getTime());

    if (ageAffichage === null) continue;

    // 2. LA CARTE A-T-ELLE UNE FENÊTRE OUVERTE ?
    if (!etat.fenetre[cle]) {
      // Pas encore de fenêtre : c'est une carte jamais passée par la simulation.
      // Sa fenêtre commence à sa première parution chez nous.
      etat.fenetre[cle] = etat.premieres[cle] || maintenantIso;
    }
    const ageFenetre = ageJours(etat.fenetre[cle], maintenant.getTime());
    if (ageFenetre !== null && ageFenetre <= JOURS_AFFICHAGE) affichees += 1;
    else fenetreOuverte += 1;

    // 3. LE RETOUR. La carte a été virtuellement effacée ; sa source la resert-elle ?
    const eff = etat.effacees[cle];
    if (eff) {
      const vuLe = o.vuLe ? new Date(o.vuLe).getTime() : NaN;
      const effLe = new Date(eff.effaceeLe).getTime();
      if (Number.isFinite(vuLe) && vuLe > effLe) {
        // REVENUE : la fenêtre repart à maintenant, l'âge TOTAL ne bouge pas.
        revenuesCePassage.push({
          cle, sourceId: o.sourceId || '', pays: o.pays || '',
          effaceeLe: eff.effaceeLe, revueLe: maintenantIso,
          minutesEffacee: Math.round((maintenantIso ? Date.now() - effLe : 0) / 60000),
          ageTotalJours: ageTotal === null ? null : +ageTotal.toFixed(2),
          cycles: (eff.cycles || 1),
        });
        etat.fenetre[cle] = maintenantIso;
        delete etat.effacees[cle];
        etat.compte.revenues += 1;
        etat.compte.cycles += 1;
        continue;                       // elle n'est PAS effacée à ce passage
      }
    }

    // 4. L'EFFACEMENT VIRTUEL : plus de cinq jours de fenêtre ouverte.
    if (ageFenetre !== null && ageFenetre > JOURS_AFFICHAGE && !etat.effacees[cle]) {
      etat.effacees[cle] = {
        effaceeLe: maintenantIso,
        sourceId: o.sourceId || '',
        pays: o.pays || '',
        ageAffichageJours: +ageFenetre.toFixed(2),
        ageTotalJours: ageTotal === null ? null : +ageTotal.toFixed(2),
        cycles: (eff && eff.cycles ? eff.cycles + 1 : 1),
      };
      etat.compte.effacees += 1;
      effaceesCePassage.push({ cle, sourceId: o.sourceId || '', ageTotalJours: ageTotal });
    }
  }

  // 5. LE MÉNAGE DU REGISTRE. Deux raisons seulement, et jamais parce qu'une carte
  //    a quitté le catalogue — c'est justement la mémoire qu'on veut garder.
  //    Un registre qui ne se élague jamais finirait par peser plus que ce qu'il
  //    mesure : on oublie donc les fenêtres des cartes qui ne sont PLUS dans le
  //    catalogue (leur sort est réglé), et les entrées d'effacement de plus de
  //    trente jours, qui ne reviendront pas.
  const encoreLa = new Set(offres.map((o) => cleDe(o)));
  let oubliees = 0;
  for (const cle of Object.keys(etat.fenetre)) {
    if (!encoreLa.has(cle)) { delete etat.fenetre[cle]; oubliees += 1; }
  }
  const trente = Date.now() - 30 * 86400000;
  for (const [cle, e] of Object.entries(etat.effacees)) {
    if (new Date(e.effaceeLe).getTime() < trente) { delete etat.effacees[cle]; oubliees += 1; }
  }
  if (oubliees) etat.compte.oubliees = (etat.compte.oubliees || 0) + oubliees;

  if (effaceesCePassage.length) noter({ type: 'effacement', n: effaceesCePassage.length,
    exemple: effaceesCePassage[0].cle.slice(0, 60) });
  if (revenuesCePassage.length) noter({ type: 'retour', n: revenuesCePassage.length,
    details: revenuesCePassage.slice(0, 10) });

  etat.lignes.effacees += effaceesCePassage.length;
  etat.lignes.revenues += revenuesCePassage.length;

  sauver(etat);

  return {
    etat,
    passage: {
      offres: offres.length,
      affichees,
      fenetreDepassee: fenetreOuverte,
      effacees: effaceesCePassage.length,
      revenues: revenuesCePassage.length,
      premieresNouvelles,
      exemplesRetour: revenuesCePassage.slice(0, 5),
    },
    anomalies: [],
    rien: !effaceesCePassage.length && !revenuesCePassage.length,
  };
}

// ---------------------------------------------------------------------------
// LA LIGNE DU SOIR — une par jour, à partir de HEURE_LIGNE (heure belge)
// ---------------------------------------------------------------------------
function ligneDuSoir(etat, p) {
  const eff = etat.compte.effacees;
  const rev = etat.compte.revenues;
  const taux = eff ? (100 * rev / eff) : 0;
  const registreMo = (JSON.stringify(etat.premieres).length +
                      JSON.stringify(etat.effacees).length) / 1e6;
  const debutJours = ageJours(etat.debut, Date.now());
  return `Simulation « 5 jours puis effacée » — jour ${debutJours === null ? '?' : Math.floor(debutJours)} · `
    + `${p.offres} offres · ${p.affichees} affichées · ${p.fenetreDepassee} hors fenêtre · `
    + `effacements ${eff} · RETOURS ${rev} (${taux.toFixed(1)} %) · `
    + `registre ${registreMo.toFixed(2)} Mo · ${etat.passages} passages`;
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------
if (args.includes('--rapport')) {
  const etat = charger();
  const eff = etat.compte.effacees, rev = etat.compte.revenues;
  const clePlusLongue = Object.keys(etat.premieres).reduce((m, k) => Math.max(m, k.length), 0);
  console.log(`SIMULATION « CINQ JOURS AFFICHÉS, PUIS EFFACÉE » — état au ${AUB.jour} ${AUB.minutes}`);
  console.log(`  Début           : ${etat.debut}`);
  console.log(`  Passages        : ${etat.passages}`);
  console.log(`  Clés suivies    : ${Object.keys(etat.premieres).length} (clé la plus longue : ${clePlusLongue} car.)`);
  console.log(`  Effacements     : ${eff}   (fenêtres fermées, cumulées)`);
  console.log(`  RETOURS         : ${rev}   soit ${eff ? (100 * rev / eff).toFixed(1) : '—'} % des effacements`);
  console.log(`  Cycles          : ${etat.compte.cycles}   (une carte revenue = un cycle de plus)`);
  console.log(`  En attente      : ${Object.keys(etat.effacees).length} cartes virtuellement effacées`);
  console.log(`  Poids du registre : ${((JSON.stringify(etat.premieres).length + JSON.stringify(etat.effacees).length) / 1e6).toFixed(2)} Mo`);
  console.log(`  Journal         : data/simulation-5-jours.jsonl`);
  process.exit(0);
}

const r = passage();

if (args.includes('--json')) {
  console.log(JSON.stringify({ passage: r.passage, compte: r.etat.compte,
    cles: Object.keys(r.etat.premieres).length,
    enAttente: Object.keys(r.etat.effacees).length }, null, 1));
  process.exit(0);
}

// Silencieux par construction : on ne parle qu'une fois par jour, le soir, et
// jamais deux fois le même jour. « Un rendez-vous qui parle pour rien dire cesse
// d'être lu » — la règle du suivi des visuels, appliquée ici aussi.
if (!r.anomalies.length && AUB.heure >= HEURE_LIGNE && r.etat.lignes.jour !== AUB.jour) {
  r.etat.lignes.jour = AUB.jour;
  r.etat.lignes.effacees = 0;
  r.etat.lignes.revenues = 0;
  sauver(r.etat);
  console.log(ligneDuSoir(r.etat, r.passage));
}
if (r.anomalies.length) {
  console.log('⚠ Simulation 5 jours :');
  for (const a of r.anomalies) console.log('   · ' + a);
}
process.exit(0);
