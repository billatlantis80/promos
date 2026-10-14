/* =============================================================================
   LE PLAFOND DE 7 JOURS ET LE BILAN DE DONNÉES — les épreuves.

   Demande de B (12/10/2026) : « après 7 jours affiché sur le site, toutes les
   images et tout ce qui est en rapport avec l'annonce qui dépasse 7 jours doit
   être effacé ». La règle est livrée EN MODE MESURE (elle compte, elle n'efface
   pas) : ces épreuves vérifient donc deux choses différentes, et la seconde
   compte autant que la première —

     1. ce qu'elle COMPTE est juste (le seuil, le signal, les exclusions) ;
     2. ce qu'elle NE FAIT PAS : elle n'écarte aucune offre de la liste qu'on lui
        donne. Une règle de péremption qui se met à retirer des données sans
        qu'on l'ait décidé est exactement le défaut que la fiche de méthode
        raconte (10 000 offres vivantes à treize minutes près).
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { pourcentAffiche } from '../collecteur.mjs';
import http from 'node:http';
import {
  PLAFOND_DONNEES_JOURS, PLAFOND_OFFRES_ACTIF, VEILLE_SEPT_JOURS_ACTIVE,
  OFFRES_SORTENT_SUR_VERDICT_ACTIF, PROMOTION_DECIDE_LA_CARTE_ACTIF, VERDICT_SOURCE_PAR_PASSAGE,
  VERDICT_SOURCE_MAX_AGE_JOURS,
  plafondDeDonnees, joursDeServiceRestants, verdictDans, verdictPerime, candidatsVerdict,
  lireVerdictSource, donneesPerimees, poidsDuVisuel, bilanDonnees, ageJours,
} from '../collecteur.mjs';

const JOUR = 86400000;
const MAINTENANT = Date.parse('2026-10-12T12:00:00Z');
const ilYA = (jours) => new Date(MAINTENANT - jours * JOUR).toISOString();

const offre = (o = {}) => ({
  id: 'x', type: 'offre', pays: 'BE', image: '', vuLe: ilYA(1), ...o,
});

test('le plafond est de sept jours, et c’est la demande de B', () => {
  assert.equal(PLAFOND_DONNEES_JOURS, 7);
});

test('une offre reservie récemment n’est PAS comptée', () => {
  const v = plafondDeDonnees([
    offre({ vuLe: ilYA(0.2) }),
    offre({ vuLe: ilYA(6.9) }),
  ], { maintenant: MAINTENANT });
  assert.equal(v.offres, 0, 'sous le plafond, rien n’est compté');
});

test('une offre à 7 jours pile n’est PAS comptée, à 7,01 jours elle l’est', () => {
  const pile = plafondDeDonnees([offre({ vuLe: ilYA(7) })], { maintenant: MAINTENANT });
  const apres = plafondDeDonnees([offre({ vuLe: ilYA(7.01) })], { maintenant: MAINTENANT });
  assert.equal(pile.offres, 0, 'le bord exact est inclus dans la grâce');
  assert.equal(apres.offres, 1);
});

test('le signal est `vuLe`, jamais `date` — une date fraîche ne sauve pas une offre muette', () => {
  const v = plafondDeDonnees([
    offre({ vuLe: ilYA(9), date: ilYA(0.01) }),     // date réécrite par la source
  ], { maintenant: MAINTENANT });
  assert.equal(v.offres, 1, 'la date réécrite ne doit pas blanchir une offre que personne ne reserve');
});

test('les ARTICLES de veille ne sont pas comptés : ils ont leur règle, 30 jours', () => {
  const v = plafondDeDonnees([
    offre({ type: 'article', vuLe: ilYA(20) }),
    offre({ type: 'offre', vuLe: ilYA(8) }),
  ], { maintenant: MAINTENANT });
  assert.equal(v.offres, 1, 'seule l’offre compte : la veille garde ses 30 jours');
});

test('une offre sans date lisible n’est jamais comptée (on ne juge pas sur rien)', () => {
  const v = plafondDeDonnees([offre({ vuLe: '' }), offre({ vuLe: 'pas une date' })], { maintenant: MAINTENANT });
  assert.equal(v.offres, 0);
});

test('la répartition par pays est tenue', () => {
  const v = plafondDeDonnees([
    offre({ pays: 'BE', vuLe: ilYA(8) }),
    offre({ pays: 'BE', vuLe: ilYA(9) }),
    offre({ pays: 'FR', vuLe: ilYA(10) }),
  ], { maintenant: MAINTENANT });
  assert.deepEqual(v.parPays, { BE: 2, FR: 1 });
});

test('LE POINT QUI COMPTE : la règle ne retire AUCUNE offre de la liste qu’on lui donne', () => {
  const liste = [offre({ vuLe: ilYA(30) }), offre({ vuLe: ilYA(0.1) })];
  const avant = liste.length;
  plafondDeDonnees(liste, { maintenant: MAINTENANT });
  assert.equal(liste.length, avant, 'une mesure ne doit rien écarter');
  assert.ok(liste.every((o) => o.vuLe), 'les offres restent intactes');
});

/* =============================================================================
   LE RETOUR D'UNE OFFRE — règle de B, deuxième tour (12/10/2026)

   « Concernant la règle des 7 jours, si sur le site internet d'origine de
     l'annonce, elle est toujours présente le 8e jour, elle devra réapparaître
     sur notre site, pour 7 nouveaux jours. Exemple pendant les soldes ou c'est
     un mois de promotion sur certains articles. »

   Deux choses à tenir, et la seconde est celle qu'on oublie :
     1. le délai part du dernier SERVICE de la source, pas de la mise en ligne —
        donc une promotion d'un mois n'est jamais emportée ;
     2. rien n'est définitif : le retrait n'écrit aucune liste d'exclusion, donc
        ce qui revient rentre comme une offre neuve, avec un délai plein.
   ============================================================================= */

test('une promotion d’un mois, reservie à chaque passage, n’est JAMAIS écartée', () => {
  const v = plafondDeDonnees([
    // En ligne depuis trente jours, mais sa source vient de la reservir.
    offre({ premiereVue: ilYA(30), vuLe: ilYA(0.01) }),
  ], { maintenant: MAINTENANT });
  assert.equal(v.offres, 0, 'le délai court depuis le dernier service, pas depuis la première mise en ligne');
});

test('le délai repart à SEPT JOURS PLEINS à chaque service de la source', () => {
  const reste = joursDeServiceRestants(offre({ vuLe: ilYA(0) }), { maintenant: MAINTENANT });
  assert.equal(reste, PLAFOND_DONNEES_JOURS, 'une offre servie aujourd’hui dispose de sept jours entiers');
  assert.ok(joursDeServiceRestants(offre({ vuLe: ilYA(8) }), { maintenant: MAINTENANT }) < 0, 'à huit jours, le délai est dépassé');
  assert.equal(joursDeServiceRestants(offre({ vuLe: '' }), { maintenant: MAINTENANT }), null, 'une date illisible n’autorise aucun verdict');
});

test('une offre écartée le 8e jour REVIENT pour sept nouveaux jours dès qu’une source la resert', () => {
  // 8e jour : plus personne ne la sert → le plafond la compterait.
  assert.equal(plafondDeDonnees([offre({ vuLe: ilYA(8) })], { maintenant: MAINTENANT }).offres, 1);
  // 9e jour : la source la resert. Elle rentre comme une offre NEUVE (le
  // passage écrit `vuLe` à maintenant sur toute offre servie) : sept jours
  // pleins, sans qu’aucune « dé-condamnation » soit nécessaire.
  const revenue = offre({ vuLe: ilYA(0) });
  assert.equal(plafondDeDonnees([revenue], { maintenant: MAINTENANT }).offres, 0, 'reservie = vivante, quel que soit son passé');
  assert.equal(joursDeServiceRestants(revenue, { maintenant: MAINTENANT }), PLAFOND_DONNEES_JOURS);
});

test('le plafond ne se souvient de RIEN : deux appels identiques rendent le même verdict', () => {
  // C’est la garantie du retour, et elle tient à la forme du code : une règle
  // qui garderait une trace des offres écartées pourrait condamner pour
  // toujours ; celle-ci est pure, donc elle ne le peut pas.
  const liste = [offre({ id: 'a', vuLe: ilYA(30) }), offre({ id: 'b', vuLe: ilYA(1) })];
  const un = plafondDeDonnees(liste, { maintenant: MAINTENANT });
  const deux = plafondDeDonnees(liste, { maintenant: MAINTENANT });
  assert.deepEqual(un, deux, 'aucun état caché entre deux appels');
  assert.equal(liste.length, 2, 'la liste n’est jamais modifiée');
});

test('le bilan publie les RETOURS : ce que le plafond aurait emporté et qu’une source a reservi', () => {
  const b = bilanDonnees({
    connues: new Map(),
    offres: [],
    journal: [{
      source: 'plafond-donnees', ok: true, effacees: 0, avaitEffacees: 3,
      octets: 1000, parPays: { BE: 3 }, revenus: 41,
    }],
    maintenant: MAINTENANT,
  });
  assert.equal(b.plafond7j.revenus, 41, 'l’onglet doit dire COMBIEN d’annonces sont revenues');
});

test('le passage COMPTE les retours (le chiffre des soldes est mesuré, pas promis)', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /ageJours\(avant\.vuLe\) > PLAFOND_DONNEES_JOURS\) retours\+\+/, 'le retour doit être compté au moment de la fusion');
  assert.match(src, /revenus: retours/, 'et publié dans le journal du passage');
  assert.match(src, /aucune liste d'exclusion/, 'la raison écrite doit dire que le retour est possible');
});

test('le poids d’un visuel est lu sur le fichier, et 0 quand il n’y en a pas', () => {
  assert.equal(poidsDuVisuel(''), 0);
  assert.equal(poidsDuVisuel('img/inexistant-xyz.jpg'), 0);
  const dossier = new URL('../docs/img/', import.meta.url);
  const un = readdirSync(dossier).find((f) => /\.(jpe?g|png|webp)$/i.test(f));
  assert.ok(un, 'une image publiée doit exister pour que la mesure ait un sens');
  const poids = poidsDuVisuel('img/' + un);
  assert.ok(poids > 1000, `un visuel publié doit peser plus d’un kilo-octet : ${poids}`);
});

test('le bilan de données compte les images servies et les orphelines', () => {
  // On référence une image QUI EXISTE (mes défauts de test viennent toujours du
  // même endroit : un nom fabriqué qui ne correspond à rien, donc un compte qui
  // tombe juste par accident ou faux sans qu'on sache pourquoi).
  const un = readdirSync(new URL('../docs/img/', import.meta.url)).find((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const b = bilanDonnees({
    connues: new Map(),
    offres: [{ type: 'offre', pays: 'BE', image: 'img/' + un, vuLe: ilYA(1) }],
    journal: [],
    maintenant: MAINTENANT,
  });
  assert.ok(b.images.fichiers > 1000, `images publiées attendues : ${b.images.fichiers}`);
  assert.equal(b.images.servies + b.images.orphelines, b.images.fichiers);
  assert.equal(b.images.servies, 1, 'une seule image est référencée ici');
  assert.equal(b.images.orphelines, b.images.fichiers - 1);
  assert.ok(b.images.mo > 100, `poids attendu en centaines de Mo : ${b.images.mo}`);
  assert.equal(b.images.moyenneKo > 0, true);
});

test('le bilan de données porte le verdict du plafond, en mode MESURE', () => {
  const b = bilanDonnees({
    connues: new Map(),
    offres: [],
    journal: [{ source: 'plafond-donnees', ok: true, effacees: 0, avaitEffacees: 12, octets: 900000, parPays: { BE: 12 } }],
    maintenant: MAINTENANT,
  });
  assert.equal(b.plafond7j.mode, 'mesure', 'la règle est en observation, et le panneau doit le dire');
  assert.equal(b.plafond7j.effacerait, 12);
  assert.equal(b.plafond7j.octets, 900000);
  assert.deepEqual(b.plafond7j.parPays, { BE: 12 });
});

test('le bilan de données dit où va chaque donnée, et n’oublie pas ce qui ne sort jamais', () => {
  const b = bilanDonnees({ connues: new Map(), offres: [], journal: [], maintenant: MAINTENANT });
  assert.ok(Array.isArray(b.destinations) && b.destinations.length >= 4);
  const texte = JSON.stringify(b.destinations);
  assert.match(texte, /GitHub Pages/, 'la publication doit y figurer');
  assert.match(texte, /nulle part ailleurs/i, 'les adresses restent chez B : ça doit être écrit');
  assert.match(texte, /jamais/i, 'ce qui ne sort jamais doit être écrit noir sur blanc');
});

test('le bilan de données voyage avec l’état publié (le panneau le lit d’un seul appel)', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /donnees: sortie\.donnees/, 'l’état publié doit porter le bilan');
  assert.match(src, /donnees: bilanDonnees\(/, 'le catalogue doit le calculer');
});

test('ageJours rend null sur une date illisible, et un âge sinon', () => {
  assert.equal(ageJours('', MAINTENANT), null);
  assert.equal(ageJours('n’importe quoi', MAINTENANT), null);
  assert.equal(Math.round(ageJours(ilYA(3), MAINTENANT)), 3);
});

/* =============================================================================
   L'INTERRUPTEUR DE LA RÈGLE DE B (12/10/2026)

   B a choisi « B » : le délai court depuis la DERNIÈRE CONFIRMATION de la source
   (`vuLe`), jamais depuis la vie de la fiche sur le site. Le calcul existait ;
   ce qui suit verrouille la manière dont la règle s'ALLUME.
   ============================================================================= */

test('la règle des sept jours n’est pas allumée, et ne peut pas s’allumer en silence', () => {
  // Cette épreuve ÉCHOUE si quelqu’un lève l’interrupteur sans y penser : elle
  // force l’allumage à être un acte visible dans le diff, accompagné de la mise
  // à jour de ce test. C’est exactement ce qu’on veut d’une règle qui efface.
  assert.equal(PLAFOND_OFFRES_ACTIF, false, 'la règle de B n’est pas encore activée : l’allumer est une décision, pas un effet de bord');
});

test('le volet de la veille est allumé, PAR UN ACTE EXPLICITE (12/10/2026)', () => {
  // ⚠ CETTE ÉPREUVE A CHANGÉ DE SENS LE 12/10/2026, ET SON HISTOIRE EST SON
  // INTÉRÊT : elle exigeait `false` — la veille devait rester à trente jours
  // tant que B n'avait pas décidé. B a dit « vas-y ». L'allumage est donc un
  // acte VISIBLE dans le diff (une ligne + cette épreuve), jamais un effet de
  // bord : c'est exactement ce qu'on attendait d'elle.
  assert.equal(VEILLE_SEPT_JOURS_ACTIVE, true, 'allumée sur le mot de B : la veille passe de 30 à 7 jours');
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /PLAFOND_ACTIF/, 'l’interrupteur unique qui commandait les deux moitiés ne doit pas revenir');
  // L'autre moitié, elle, reste fermée — et c'est la mesure qui la garde fermée.
  assert.equal(PLAFOND_OFFRES_ACTIF, false, 'le retrait sur le SILENCE n’est pas allumé : il est mesuré à ~48 % de faux positifs');
  // ⚠ CES DEUX LIGNES ONT CHANGÉ DE SENS LE 13/10/2026, ET LEUR HISTOIRE EST LEUR
  //  INTÉRÊT : elles exigeaient `false` — le retrait par verdict devait attendre
  //  que ses chiffres soient lus, et B devait décider dessus. B a décidé, et sa
  //  décision porte plus large que le verdict seul : « plus de promotion sur la
  //  page la carte sort, promotion toujours là prix changé on corrige, promotion
  //  toujours là même prix on garde, page morte la carte sort ». L'allumage est
  //  donc un acte VISIBLE dans le diff (deux constantes + ces deux épreuves) —
  //  jamais un effet de bord, ce qui était exactement le but de cette garde.
  assert.equal(OFFRES_SORTENT_SUR_VERDICT_ACTIF, true, 'allumé sur le mot de B (13/10/2026) : la page décide de la carte');
  assert.equal(PROMOTION_DECIDE_LA_CARTE_ACTIF, true, 'la règle des quatre branches est active sur le même mot');
});

test('`donneesPerimees` dit exactement où passe la limite — et jamais pour un article', () => {
  assert.equal(donneesPerimees(offre({ vuLe: ilYA(6.99) }), { maintenant: MAINTENANT }), false);
  assert.equal(donneesPerimees(offre({ vuLe: ilYA(7) }), { maintenant: MAINTENANT }), false, 'sept jours pile : encore dans la grâce');
  assert.equal(donneesPerimees(offre({ vuLe: ilYA(7.01) }), { maintenant: MAINTENANT }), true);
  assert.equal(donneesPerimees(offre({ type: 'article', vuLe: ilYA(90) }), { maintenant: MAINTENANT }), false, 'un article ne se juge pas au service : son verrou est sa date de publication');
  assert.equal(donneesPerimees(offre({ vuLe: '' }), { maintenant: MAINTENANT }), false, 'sans date lisible, aucun verdict');
  assert.equal(donneesPerimees(null, { maintenant: MAINTENANT }), false);
});

test('le COMPTE et le RETRAIT désignent le MÊME ensemble, sur le catalogue réel', () => {
  const d = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
  const compte = plafondDeDonnees(d.offres, { maintenant: MAINTENANT });
  const retirées = d.offres.filter((o) => donneesPerimees(o, { maintenant: MAINTENANT }));
  assert.equal(compte.offres, retirées.length, 'le chiffre publié et ce qui partirait doivent être le même ensemble — sinon on effacerait autre chose que ce qu’on a annoncé');
  assert.equal(retirées.filter((o) => o.type === 'article').length, 0, 'aucun article ne part par cette règle');
  assert.ok(compte.offres > 0, `des offres au-delà du délai sont attendues dans le catalogue : ${compte.offres}`);
});

test('le passage ne retire RIEN tant que l’interrupteur est éteint', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(PLAFOND_OFFRES_ACTIF && plafondOffres\)/, 'le retrait est commandé par l’interrupteur des OFFRES, et par rien d’autre');
  assert.match(src, /const JOURS_VEILLE = VEILLE_SEPT_JOURS_ACTIVE \? 7 : 30/, 'la veille suit SON interrupteur : 30 jours tant qu’il est éteint');
  // La règle s'écrit UNE fois : le compte et le retrait passent par elle.
  assert.equal((src.match(/function donneesPerimees/g) || []).length, 1, 'une seule définition de la règle');
  // ET LES DEUX MOITIÉS NE PARTAGENT AUCUN BOOLÉEN. On l'exige sur les deux
  // lignes elles-mêmes : chacune ne doit citer QUE son interrupteur. C'est le
  // couplage qui rendait la décision binaire ; c'est lui qu'on interdit de
  // réintroduire. (Un simple compte d'occurrences serait faux : la constante est
  // NOMMÉE dans les commentaires, et c'est très bien ainsi.)
  const ligneRetrait = src.split('\n').find((l) => l.includes('plafondOffres) {')) || '';
  const ligneVeille = src.split('\n').find((l) => l.includes('JOURS_VEILLE =')) || '';
  assert.match(ligneRetrait, /PLAFOND_OFFRES_ACTIF/, 'le retrait est commandé par l’interrupteur des offres');
  assert.doesNotMatch(ligneRetrait, /VEILLE/, 'le retrait des offres ne doit RIEN devoir à la veille');
  assert.match(ligneVeille, /VEILLE_SEPT_JOURS_ACTIVE/, 'la veille est commandée par son interrupteur');
  assert.doesNotMatch(ligneVeille, /OFFRES/, 'la veille ne doit RIEN devoir aux offres');
});

test('le bilan publie le MODE de chaque moitié, et le volet des articles', () => {
  const allume = bilanDonnees({
    connues: new Map(), offres: [],
    journal: [{ source: 'plafond-donnees', ok: true, mode: 'actif', modeVeille: 'mesure', effacees: 1215, avaitEffacees: 1215, octets: 36e6, parPays: {}, articlesHorsDelai: 230, joursVeille: 30 }],
    maintenant: MAINTENANT,
  });
  assert.equal(allume.plafond7j.mode, 'actif');
  assert.equal(allume.plafond7j.modeVeille, 'mesure', 'l’état doit dire QUELLE moitié est allumée : les deux se décident séparément');
  assert.equal(allume.plafond7j.effacees, 1215);
  assert.equal(allume.plafond7j.articlesHorsDelai, 230);
  assert.equal(allume.plafond7j.joursVeille, 30);
  const eteint = bilanDonnees({ connues: new Map(), offres: [], journal: [], maintenant: MAINTENANT });
  assert.equal(eteint.plafond7j.mode, 'mesure', 'sans verdict écrit par le passage, le panneau annonce une MESURE, jamais une activation');
  assert.equal(eteint.plafond7j.modeVeille, 'mesure');
  assert.equal(eteint.plafond7j.joursVeille, 30);
});

test('le bilan compte la veille sur le PUBLIÉ, séparément du stock', () => {
  // Le passage compte le STOCK (`articlesHorsDelai`) ; l’écran n’en montre qu’un
  // sous-ensemble, écrêté par un quota par pays. Les deux chiffres diffèrent, et
  // les confondre ferait lire le premier comme une exagération : on donne les deux.
  const b = bilanDonnees({
    connues: new Map(),
    offres: [
      { type: 'article', pays: 'BE', date: ilYA(20), image: '' },   // publié, hors délai
      { type: 'article', pays: 'BE', date: ilYA(1), image: '' },    // publié, dans le délai
      { type: 'offre', pays: 'BE', vuLe: ilYA(20), date: ilYA(20), image: '' },
    ],
    journal: [{ source: 'plafond-donnees', ok: true, articlesHorsDelai: 548, joursVeille: 30 }],
    maintenant: MAINTENANT,
  });
  assert.equal(b.plafond7j.articles.publies, 2, 'la veille publiée est comptée à part des offres');
  assert.equal(b.plafond7j.articles.hors7j, 1, 'un seul article publié dépasse sept jours');
  assert.equal(b.plafond7j.articlesHorsDelai, 548, 'le stock garde son chiffre, et il n’est pas présenté comme le publié');
});

/* =============================================================================
   LE CONTRÔLE DIRECT — LIRE LE VERDICT DE LA PAGE (12/10/2026, « vas-y »)

   La règle du silence a été MISE À L'ÉPREUVE sur 140 pages réelles : 53 des 111
   offres jugées portaient `isExpired: false` — 48 % de faux positifs. On va donc
   désormais LIRE le verdict que la page publie, au lieu de le déduire de son
   silence. Ces épreuves tiennent les deux moitiés de la promesse : le chiffre
   qu'on annonce est juste, ET rien n'est retiré tant que B n'a pas décidé.
   ============================================================================= */

test('verdictDans lit le verdict de la page, et ne confond rien', () => {
  assert.equal(verdictDans('{"isExpired":true,"status":"Activated"}'), 'expiree');
  assert.equal(verdictDans('{"isExpired": false }'), 'vivante', 'les espaces ne doivent pas changer le verdict');
  assert.equal(verdictDans('<html>rien de tel</html>'), '', 'une page muette ne rend AUCUN verdict');
  assert.equal(verdictDans(''), '');
  assert.equal(verdictDans(null), '');
});

test('un verdict se revérifie après sept jours, pas avant', () => {
  assert.equal(verdictPerime(undefined, MAINTENANT), true, 'jamais contrôlé : à contrôler');
  assert.equal(verdictPerime({ vuLe: ilYA(1) }, MAINTENANT), false);
  assert.equal(verdictPerime({ vuLe: ilYA(VERDICT_SOURCE_MAX_AGE_JOURS) }, MAINTENANT), false, 'sept jours pile : encore frais');
  assert.equal(verdictPerime({ vuLe: ilYA(VERDICT_SOURCE_MAX_AGE_JOURS + 0.1) }, MAINTENANT), true);
  assert.equal(verdictPerime({ vuLe: 'pas une date' }, MAINTENANT), true, 'une date illisible = à revérifier, jamais un verdict');
});

test('les candidats au contrôle : au-delà du délai, joignables, un seul par source', () => {
  const liste = [
    offre({ id: 'a', sourceId: 's1', vuLe: ilYA(8), lienPage: 'https://exemple.be/a' }),
    offre({ id: 'b', sourceId: 's1', vuLe: ilYA(9), lienPage: 'https://exemple.be/b' }),
    offre({ id: 'c', sourceId: 's2', vuLe: ilYA(8), lienPage: 'https://exemple.be/c' }),
    offre({ id: 'd', sourceId: 's3', vuLe: ilYA(1), lienPage: 'https://exemple.be/d' }),
    offre({ id: 'e', sourceId: 's4', vuLe: ilYA(8), lienPage: '' }),
    offre({ id: 'f', type: 'article', sourceId: 's5', date: ilYA(30), lienPage: 'https://journal.be/f' }),
    offre({ id: 'g', sourceId: 's6', vuLe: ilYA(8), lienPage: 'https://news.google.com/rss/articles/xyz' }),
  ];
  const choisis = candidatsVerdict(liste, { limite: 3, maintenant: MAINTENANT });
  assert.deepEqual(choisis.map((o) => o.id).sort(), ['a', 'b', 'c'],
    'la limite est respectée, et le budget n’est pas gaspillé tant qu’il reste des offres à voir');
  assert.equal(new Set(choisis.slice(0, 2).map((o) => o.sourceId)).size, 2,
    'les deux premiers viennent de sources DIFFÉRENTES : c’est la politesse (pas trois lectures au même hôte)');
  const deux = candidatsVerdict(liste, { limite: 2, maintenant: MAINTENANT });
  assert.equal(new Set(deux.map((o) => o.sourceId)).size, 2);
  assert.ok(!choisis.some((o) => ['d', 'e', 'f', 'g'].includes(o.id)),
    'ni dans le délai, ni sans page, ni un article de veille, ni un redirecteur Google News');
});

test('un verdict frais n’est pas redemandé : on ne repaie pas une page déjà lue', () => {
  const verdicts = { a: { statut: 'vivante', vuLe: ilYA(0.5) } };
  const liste = [
    offre({ id: 'a', sourceId: 's1', vuLe: ilYA(9), lienPage: 'https://exemple.be/a' }),
    offre({ id: 'b', sourceId: 's2', vuLe: ilYA(9), lienPage: 'https://exemple.be/b' }),
  ];
  assert.deepEqual(candidatsVerdict(liste, { verdicts, limite: 5, maintenant: MAINTENANT }).map((o) => o.id), ['b']);
});

test('la lecture s’arrête dès qu’elle a le verdict — et elle le lit vraiment', async () => {
  // Un serveur local publie le verdict, puis DÉVERSE 400 Ko de remplissage : si
  // la lecture ne coupait pas, on paierait tout. C'est la promesse de discrétion,
  // et elle se mesure au lieu de se promettre.
  const serveur = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.write('<html><script>window.__DATA__ = {"isExpired":true,"status":"Activated"};</script>');
    res.end('x'.repeat(400 * 1024));
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  try {
    const v = await lireVerdictSource(`http://127.0.0.1:${serveur.address().port}/offre`);
    assert.equal(v.etat, 'expiree');
    assert.ok(v.octets < 200 * 1024, `la lecture doit s’arrêter tôt : ${v.octets} octets lus`);
  } finally { serveur.close(); }
});

test('une page muette n’est PAS un verdict — jamais « vivante » par défaut', async () => {
  const serveur = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body>page sans verdict</body></html>');
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  try {
    const v = await lireVerdictSource(`http://127.0.0.1:${serveur.address().port}/offre`);
    assert.equal(v.etat, 'sans-signal', 'ni morte ni vivante : « je ne sais pas » est une réponse à part entière');
  } finally { serveur.close(); }
});

test('les sorties sont commandées par leurs interrupteurs, et rien d’autre', () => {
  // ⚠ CETTE ÉPREUVE A CHANGÉ LE 13/10/2026, et son histoire est son intérêt :
  //  elle exigeait `if (OFFRES_SORTENT_SUR_VERDICT_ACTIF) {` et un titre qui
  //  disait « éteint ». B a décidé (« plus de promotion sur la page la carte
  //  sort »), les deux interrupteurs sont allumés, et la garde porte donc
  //  désormais sur ce qui empêche les dégâts : CHAQUE sortie est commandée par
  //  son interrupteur, et une page muette ne fait jamais sortir une carte.
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /st === 'expiree' && OFFRES_SORTENT_SUR_VERDICT_ACTIF/,
    'le retrait par verdict est commandé par son interrupteur, et rien d’autre');
  assert.match(src, /st === 'morte' && PROMOTION_DECIDE_LA_CARTE_ACTIF/,
    'la sortie d’une page morte (404/410) suit la règle de B');
  assert.match(src, /st === 'sans-promotion' && PROMOTION_DECIDE_LA_CARTE_ACTIF/,
    'la sortie « plus de prix de référence » suit la règle de B');
  assert.match(src, /\(verdictsSources\[cle\] \|\| \{\}\)\.statut/,
    'les sorties ne lisent QUE la table des verdicts, jamais une déduction');
  assert.ok(VERDICT_SOURCE_PAR_PASSAGE <= 6, `le budget doit rester un échantillon : ${VERDICT_SOURCE_PAR_PASSAGE}`);
});

test('la clé du verdict est celle de l’appelant — le défaut qui a vidé la table', () => {
  // DÉFAUT VÉCU, ET C'EST POUR ÇA QUE CETTE ÉPREUVE EXISTE : le premier jet
  // rangeait le verdict sous `o.id` et l'élagage, juste en dessous, comparait aux
  // clés du STOCK (`cleDe`). Résultat mesuré au premier passage réel : trois
  // pages lues, et une table repartie VIDE — un compteur à zéro permanent, la
  // faute que la fiche de méthode appelle « un chiffre publié qui vaut toujours 0
  // est le même défaut qu'une clé qui n'existe pas ».
  // Elle est donc tenue des deux côtés : le comportement (la clé vient de
  // l'appelant) et le texte (le passage écrit et relit avec la même).
  const verdicts = { 'ma-cle': { statut: 'vivante', vuLe: ilYA(0.5) } };
  const liste = [offre({ id: 'zzz', sourceId: 's1', vuLe: ilYA(9), lienPage: 'https://exemple.be/a' })];
  assert.deepEqual(
    candidatsVerdict(liste, { verdicts, cle: () => 'ma-cle', limite: 5, maintenant: MAINTENANT }), [],
    'un verdict frais rangé sous la clé de l’appelant doit être VU (sinon on repaie sa page)');
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /verdictsSources\[cleDe\(o\)\] = \{ statut/, 'écrit sous la clé du stock');
  assert.match(src, /verdictsFichier\[cleDe\(o\)\]/, 'relu sous la clé du stock');
  // ⚠ CETTE ATTENTE A CHANGÉ LE 13/10/2026 (décision d'efficacité de B) : le
  //  contrôle ne fait plus UN appel mais DEUX — une part du budget par famille
  //  (communautés 2, enseignes 1), parce que la page d'une communauté publie son
  //  verdict et que celle d'une enseigne n'en publie aucun. L'INTENTION de
  //  l'épreuve ne bouge pas : la table doit être interrogée avec la clé du STOCK.
  //  On l'exige donc pour CHAQUE appel, et on compte les appels — un troisième
  //  ajouté sans clé fera rougir.
  const appels = [...src.matchAll(/candidatsVerdict\(stock, \{[^}]*\}/g)].map((m) => m[0]);
  assert.equal(appels.length, 2, 'deux appels : une part du budget par famille');
  for (const a of appels) assert.match(a, /cle: cleDe/, `chaque appel porte la clé du stock : ${a}`);
  assert.match(src, /famille: 'communaute', limite: CONTROLES_COMMUNAUTE_PAR_PASSAGE/,
    'les communautés ont leur part du budget');
  assert.match(src, /famille: 'enseigne', limite: CONTROLES_ENSEIGNE_PAR_PASSAGE/,
    'les enseignes gardent la leur (règle de la page)');
});

/* ------------------- LA FILE DE CONTRÔLE : QUI ELLE LIT, ET DANS QUEL ORDRE */

test('trois jours pour une communauté, sept pour une enseigne', () => {
  // DÉCISION DE B, 13/10/2026 : « Prends la décision la plus réaliste et la plus
  // efficace pour gagner en efficacité, efficacité tant au niveau de l'utilisateur
  // que au niveau des entreprises chez qui nous prenons les informations. »
  // Ce qui la fonde, mesuré le même jour : les flux resservent 3 976 offres par
  // jour (le silence au-delà de trois jours n'est donc plus une fenêtre, c'est le
  // stock qu'on traîne), et la page d'une communauté publie `isExpired` quand
  // celle d'une enseigne ne publie aucun verdict.
  const commu = offre({ id: 'c4', sourceId: 'dealabs-tendance', vuLe: ilYA(4), lienPage: 'https://exemple.be/c' });
  const enseigne4 = offre({ id: 'e4', sourceId: 'amazon-fr', vuLe: ilYA(4), lienPage: 'https://exemple.be/e4' });
  const enseigne8 = offre({ id: 'e8', sourceId: 'amazon-fr', vuLe: ilYA(8), lienPage: 'https://exemple.be/e8' });
  const choix = candidatsVerdict([commu, enseigne4, enseigne8], { maintenant: MAINTENANT, limite: 9 });
  assert.deepEqual(choix.map((o) => o.id).sort(), ['c4', 'e8'],
    'la communauté entre à trois jours ; l’enseigne n’entre qu’à sept');
  // ⚠ ET LE DÉLAI NE RETIRE RIEN : c'est ce qui rend la décision sans risque.
  assert.equal(donneesPerimees(commu, { maintenant: MAINTENANT }), false,
    'l’entrée dans la file n’est pas une règle de suppression');
});

test('la file lit d’abord ce que l’utilisateur voit en tête de liste', () => {
  // L'ORDRE A CHANGÉ DEUX FOIS LE 13/10/2026, et la seconde fois CONTRE mon
  // premier choix — c'est la mesure qui a tranché. « Le plus silencieux d'abord »
  // paraissait le plus rentable ; il ne l'est pas : la fiche signalée par B
  // (5 jours de silence) arrivait derrière ~10 000 fiches plus silencieuses, parce
  // que le silence est une distribution PLATE (le stock n'a que six jours). La
  // remise, elle, est CONCENTRÉE : 43 fiches communautaires à ≥ 70 % portent tout
  // le haut de la vue « % décroissant ». Une lecture coûte une requête à un
  // partenaire : elle doit viser une fiche que l'utilisateur voit.
  const grosse = offre({ id: 'remise-90', sourceId: 'dealabs-tendance', vuLe: ilYA(3.2), remise: 90, lienPage: 'https://exemple.be/1' });
  const petite = offre({ id: 'remise-10', sourceId: 'dealabs-tendance', vuLe: ilYA(6), remise: 10, lienPage: 'https://exemple.be/2' });
  const choix = candidatsVerdict([petite, grosse], { maintenant: MAINTENANT, limite: 9 });
  assert.deepEqual(choix.map((o) => o.id), ['remise-90', 'remise-10'],
    'la remise décroissante passe devant, même si l’autre est plus silencieuse');
  // À remise ÉGALE, le silence départage — peu de fiches, mais dans le bon sens.
  const egaleVieille = offre({ id: 'egale-6j', sourceId: 'mydealz', vuLe: ilYA(6), remise: 50, lienPage: 'https://exemple.be/3' });
  const egaleNeuve = offre({ id: 'egale-3j', sourceId: 'mydealz', vuLe: ilYA(3.2), remise: 50, lienPage: 'https://exemple.be/4' });
  const choix2 = candidatsVerdict([egaleNeuve, egaleVieille], { maintenant: MAINTENANT, limite: 9 });
  assert.deepEqual(choix2.map((o) => o.id), ['egale-6j', 'egale-3j']);
});

test('la file classe comme la vue classe — deux programmes, une règle', () => {
  // MESURÉ EN SONDANT MA PROPRE FILE, le 13/10/2026 : ses deux premières lectures
  // visaient des remises de 99 % et 91 %, que la carte REFUSE d'afficher. L'ordre
  // de la file doit donc se lire sur le même pourcentage que la vue — sinon on
  // paie des requêtes chez les partenaires pour des fiches que personne ne voit.
  // La règle appartient à l'APPLICATION : on l'extrait du fichier livré et on
  // évalue ce même bloc, plutôt que d'en écrire une seconde version qui
  // finirait par diverger sans que personne ne compare jamais les deux.
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const bloc = app.slice(app.indexOf('const REMISE_MIN'), app.indexOf('function triees'));
  assert.ok(bloc.length > 0, 'le bloc des règles de remise doit rester extractible de app.js');
  const { remiseMontrable } = vm.runInContext(bloc + '\n;({ remiseMontrable })', vm.createContext({}));
  const of = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8')).offres;
  const ecarts = [];
  for (const o of of) {
    const vue = remiseMontrable(o) || 0;
    const file = pourcentAffiche(o);
    if (vue !== file && ecarts.length < 5) ecarts.push(`${o.id} : vue ${vue} / file ${file}`);
  }
  assert.equal(ecarts.length, 0, `la file doit classer sur ce que la carte montre : ${ecarts.join(' | ')}`);
});

test('le bilan publie le verdict : ce que le passage a lu, et l’état du CATALOGUE', () => {
  const b = bilanDonnees({
    connues: new Map(),
    offres: [{ id: 'offre-qui-nexiste-pas-xyz', type: 'offre', pays: 'BE', image: '', vuLe: ilYA(9), lienPage: 'https://exemple-inexistant.test/offre-qui-nexiste-pas', titre: 'offre de test qui ne doit rien joindre' }],
    journal: [{ source: 'verdict-source', ok: true, essais: 3, expirees: 2, vivantes: 1, sansVerdict: 0, illisibles: 0, octets: 300000, sorties: 0, mode: 'actif' }],
    maintenant: MAINTENANT,
  });
  // ⚠ CETTE ATTENTE A CHANGÉ LE 13/10/2026 : elle exigeait 'mesure', parce que
  //  le mode de l'état se lit sur l'INTERRUPTEUR (pas sur le journal) et que
  //  l'interrupteur était éteint. B a décidé — « plus de promotion sur la page
  //  la carte sort » — les interrupteurs sont allumés, et l'état dit maintenant
  //  'actif'. Le panneau annonce donc une règle qui AGIT, comme il se doit.
  assert.equal(b.plafond7j.verdict.mode, 'actif');
  assert.equal(b.plafond7j.verdict.parPassage, VERDICT_SOURCE_PAR_PASSAGE);
  assert.equal(b.plafond7j.verdict.duPassage.verifiees, 3, 'le passage dit ce qu’il a lu');
  assert.equal(b.plafond7j.verdict.duPassage.vivantes, 1);
  assert.equal(b.plafond7j.verdict.porteurs, 0, 'aucune offre publiée ne porte de verdict ici : la table est LUE, pas inventée');
});

/* =============================================================================
   LE DRAPEAU DES FICHES NON CONFIRMÉES — épreuves ajoutées le 13/10/2026.

   POURQUOI ELLES MANQUAIENT, ET POURQUOI C'EST UN DÉFAUT. Le drapeau `perimee`
   a été posé le 13/10/2026 à 15 h 50 : il MASQUE 4 696 fiches à l'écran (20 %
   du catalogue publié). Aucune épreuve ne le tenait — seulement l'absence des
   pages de partage, couverte ailleurs (donnees-structurees). Une règle qui
   change ce que voit l'utilisateur sans épreuve à elle est une règle qu'un
   éditeur distrait peut casser sans que rien ne devienne rouge.
   Trois mécanismes, et les trois comptent : poser, LEVER, RECALER les compteurs.
   ============================================================================= */

test('le drapeau est posé par la SEULE fonction de délai du fichier, et par rien d’autre', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(
    src,
    /if \(donneesPerimees\(o\)\) \{ o\.perimee = true; nonConfirmees\+\+; \}/,
    'le masquage doit passer par donneesPerimees : sinon le chiffre publié et le drapeau désigneraient deux ensembles différents',
  );
});

test('le drapeau se lève tout seul quand une source reservit la fiche — la règle du retour', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(
    src,
    /else if \(o\.perimee\) delete o\.perimee/,
    'aucune liste d’exclusion : une fiche reservie repart affichée pour sept jours pleins',
  );
});

test('les compteurs publiés suivent ce qui est AFFICHÉ, pays compris', () => {
  const src = readFileSync(new URL('../collecteur.mjs', import.meta.url), 'utf8');
  assert.match(src, /sortie\.total = \(sortie\.total \|\| 0\) - nonConfirmees/, 'le total annoncé doit baisser du nombre de fiches masquées');
  assert.match(src, /sortie\.totalOffres = \(sortie\.totalOffres \|\| 0\) - nonConfirmees/);
  assert.match(
    src,
    /if \(sortie\.parPays && sortie\.parPays\[p\] != null\) sortie\.parPays\[p\] -= 1/,
    'un compteur par pays qui compte des fiches cachées est le mensonge que B avait signalé le 08/10/2026',
  );
});

test('l’application a UN seul point d’entrée, et il écarte les fiches marquées', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(
    app,
    /\.filter\(\(o\) => \(o\.lienPage \|\| o\.lienMarchand\) && !o\.perimee\)/,
    'le filtre doit vivre dans appliquerDonnees : puces, bandeau, pays et recherches suivent alors le même ensemble',
  );
});

test('sur le catalogue PUBLIÉ : chaque fiche masquée est au-delà du délai, et aucun article ne l’est', () => {
  const d = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
  const of = d.offres || [];
  const masquees = of.filter((o) => o.perimee);
  assert.ok(masquees.length > 0, 'le drapeau doit mordre : 4 696 fiches masquées relevées le 13/10/2026');
  const injustes = masquees.filter((o) => !donneesPerimees(o)).slice(0, 5).map((o) => o.id);
  assert.equal(injustes.length, 0, `une fiche masquée doit être au-delà du délai : ${injustes.join(' | ')}`);
  assert.equal(
    masquees.filter((o) => o.type === 'article').length,
    0,
    'un article de veille a son propre verrou (sa date de publication) : le drapeau ne le vise jamais',
  );
});
