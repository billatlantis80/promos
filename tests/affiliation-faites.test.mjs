/**
 * CE QUI EST DÉJÀ FAIT — « combien d'affiliation j'ai déjà fait ».
 *
 * B (12/10/2026) : « Toujours dans le panneau admin au niveau des affiliations,
 * je ne vois pas une catégorie qui indique combien d'affiliation j'ai déjà fait.
 * Actuellement j'en ai fait deux. »
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI IL EXISTE.
 *   Le trou n'était pas un défaut d'affichage : le panneau montrait ce qu'on avait
 *   MESURÉ sur les sites (programme trouvé / non mesuré / aucun signe) et jamais ce
 *   qu'on avait OBTENU. Les deux partenariats réellement ouverts sont pourtant
 *   écrits depuis le 09/10/2026 — dans `public/affiliation.js`, où l'identifiant
 *   EST la preuve de l'ouverture — mais le panneau n'importait même pas ce fichier.
 *
 *   Une seule règle, donc un seul endroit : une affiliation est FAITE quand un
 *   identifiant est renseigné. Pas de seconde liste à tenir d'accord avec la
 *   première — c'est exactement l'écart qui se creuse en silence.
 *
 *   Et le point le plus fragile, celui qui casserait au premier ajout : les
 *   groupes doivent rester une PARTITION. Un acteur dont l'affiliation est faite
 *   sort de son groupe de mesure ; sinon le même acteur est compté deux fois et le
 *   total annoncé devient invérifiable.
 *
 * Lancement : node --test tests/affiliation-faites.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { affiliationsFaites, affiliationFaite, AMAZON_TAGS, bolActif }
  from '../public/affiliation.js';
import { affiliationsDuPays, paysAffiliation, ORDRE_AFFILIATION, ORDRE_VUE }
  from '../public/affiliations.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'acteurs.json'), 'utf8'));
const mesures = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'affiliations.json'), 'utf8'));
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');

// UN CATALOGUE VIDE SUFFIT ICI, et c'est délibéré : ces épreuves portent sur le
// RANGEMENT et le COMPTE, pas sur le poids des marchands (`citations`). Charger
// les dix-sept mégaoctets d'`offres.json` pour obtenir des zéros serait vingt
// secondes perdues à chaque exécution.
const catalogue = { offres: [] };

/* --------------------------------------- 1. Ce que la table des identifiants dit */

test('les affiliations FAITES sont celles qui portent un identifiant', () => {
  const faites = affiliationsFaites();
  assert.equal(faites.length, 2,
    `B en a fait deux le 12/10/2026 : le compte doit être 2 (trouvé ${faites.length}) — ${JSON.stringify(faites)}`);
  assert.deepEqual(faites.map((f) => f.marche), ['amazon.com.be', 'amazon.fr'],
    'les marchés doivent être TRIÉS : deux exécutions donnent le même ordre, donc le même affichage');
  assert.equal(faites.find((f) => f.marche === 'amazon.fr').identifiant, 'kazendra-21');
  assert.equal(faites.find((f) => f.marche === 'amazon.com.be').identifiant, 'kazendra06-21');
  for (const f of faites) assert.match(f.reseau, /Amazon/, 'le réseau doit être nommé');
});

test('un marché SANS identifiant n’est pas « fait » — et bol non plus tant qu’il est vide', () => {
  // La règle de sûreté du projet : jamais d'identifiant inventé. Ici elle sert au
  // COMPTE : les huit marchés amazon sans identifiant ne doivent pas gonfler le
  // nombre d'affiliations faites, sinon le chiffre annoncé à B devient faux.
  const vides = Object.entries(AMAZON_TAGS).filter(([, v]) => !String(v).trim()).map(([k]) => k);
  assert.equal(vides.length, 8, `huit marchés amazon doivent rester vides (trouvé ${vides.length})`);
  for (const marche of vides) {
    assert.ok(!affiliationsFaites().some((f) => f.marche === marche),
      `« ${marche} » n'a pas d'identifiant : il ne doit pas compter comme fait`);
  }
  assert.equal(bolActif(), false);
  assert.ok(!affiliationsFaites().some((f) => f.marche === 'bol.com'),
    'bol ne compte que le jour où son Site_ID est renseigné');
});

test('l’affiliation d’un acteur se lit sur SES DOMAINES, jamais sur son nom', () => {
  assert.equal(affiliationFaite(['amazon.fr']).identifiant, 'kazendra-21');
  assert.equal(affiliationFaite(['www.amazon.com.be']).marche, 'amazon.com.be',
    'la casse et le préfixe www ne doivent pas faire rater le rapprochement');
  assert.equal(affiliationFaite(['lidl.be', 'delhaize.be']), null,
    'aucun domaine de la table : on rend null, jamais une supposition');
  assert.equal(affiliationFaite([]), null);
  assert.equal(affiliationFaite(undefined), null, 'un acteur sans domaine ne doit pas lever');
  assert.equal(affiliationFaite('amazon.fr'), null,
    'une CHAÎNE en guise de liste ne doit pas être parcourue caractère par caractère');
});

/* ------------------------------------------- 2. Les groupes restent une PARTITION */

test('le groupe « affiliation faite » est EN TÊTE, et les acteurs concernés y sont sortis de leur mesure', () => {
  assert.deepEqual(ORDRE_VUE, ['affiliation faite', ...ORDRE_AFFILIATION],
    'l’ordre de la vue ajoute « affiliation faite » en tête et ne touche pas l’ordre de MESURE');
  assert.equal(ORDRE_AFFILIATION.length, 3,
    'l’ordre de mesure n’a que trois états : « faite » n’est pas une mesure, c’est une décision');

  const v = affiliationsDuPays(catalogue, base, mesures, 'BE');
  assert.equal(v.groupes[0].etat, 'affiliation faite', 'le groupe des faites doit venir en premier');
  assert.equal(v.groupes[0].n, 1, 'la Belgique porte une affiliation faite (Amazon .com.be)');
  const a = v.groupes[0].liste[0];
  assert.equal(a.nom, 'Amazon Belgique (.com.be)');
  assert.equal(a.faite.identifiant, 'kazendra06-21');
  // LA MESURE N'EST PAS EFFACÉE : elle reste lisible, à côté de l'état montré.
  assert.ok(['programme trouvé', 'non mesuré', 'aucun signe trouvé'].includes(a.affiliation.etat),
    'l’état MESURÉ doit rester disponible sur l’acteur');
  assert.equal(a.etatVue, 'affiliation faite');
});

test('aucun acteur n’est compté deux fois : les quatre groupes font le total du pays', () => {
  // C'EST L'ÉPREUVE QUI COMPTE. Un acteur « rangé dans les faites ET resté dans sa
  // mesure » doublerait le total, et le chiffre annoncé deviendrait invérifiable.
  for (const pays of ['BE', 'FR', 'DE']) {
    const v = affiliationsDuPays(catalogue, base, mesures, pays);
    const somme = v.groupes.reduce((n, g) => n + g.n, 0);
    assert.equal(somme, v.compteurs.acteurs,
      `${pays} : ${somme} rangé(s) pour ${v.compteurs.acteurs} acteur(s) — un acteur est compté deux fois`);
    assert.equal(v.groupes.length, 4, `${pays} : quatre groupes attendus`);
    // Et les compteurs NOMMÉS tombent juste, quel que soit le rang du groupe.
    const par = Object.fromEntries(v.groupes.map((g) => [g.etat, g.n]));
    assert.equal(v.compteurs.faites, par['affiliation faite']);
    assert.equal(v.compteurs.programme, par['programme trouvé']);
    assert.equal(v.compteurs.nonMesure, par['non mesuré']);
    assert.equal(v.compteurs.aucunSigne, par['aucun signe trouvé']);
  }
});

test('le compte par pays tombe sur les deux affiliations de B', () => {
  const pays = paysAffiliation(base, mesures, catalogue);
  const de = (p) => pays.find((x) => x.pays === p);
  assert.equal(de('BE').faites, 1, 'Belgique : amazon.com.be');
  assert.equal(de('FR').faites, 1, 'France : amazon.fr');
  assert.equal(de('DE').faites, 0,
    'allemagne : amazon.de n’a PAS d’identifiant — « pas fait » ne doit pas devenir « fait »');
  // Le résumé du pays n'est pas amputé par l'ajout : les trois comptes d'origine
  // sont toujours là, à côté du nouveau.
  for (const x of ['programme', 'nonMesure', 'aucunSigne', 'acteurs']) {
    assert.equal(typeof de('BE')[x], 'number', `le résumé du pays doit toujours porter « ${x} »`);
  }
});

/* ------------------------------------------------- 3. Le panneau dit ce compte */

test('le panneau annonce le compte, la liste, et marque les acteurs concernés', () => {
  assert.match(admin, /import \{ affiliationsFaites \} from '\.\.\/affiliation\.js'/,
    'le panneau doit lire les identifiants : sans cet import, il ne peut compter que ce qu’il a mesuré');
  assert.match(admin, /affiliation\(s\) déjà faite\(s\) dans ce pays/,
    'la tuile de compte a disparu des compteurs — ou elle ne dit plus QUEL pays elle compte');
  assert.match(admin, /id="mAffFaites"/, 'le bloc « Déjà fait » doit exister dans la page');
  assert.match(admin, /Déjà fait — \$\{nf\.format\(faites\.length\)\} affiliation\(s\) en tout/,
    'le titre du bloc doit porter le COMPTE, et dire qu’il compte TOUS les pays');
  assert.match(admin, /'affiliation faite':/, 'le groupe doit avoir son texte d’explication');
  assert.match(admin, /a\.faite \? ` <span class="faite"/,
    'les acteurs concernés doivent porter leur étiquette dans la liste');
  assert.match(admin, /\.faite\{background:var\(--vert\)/, 'l’étiquette doit être écrite dans la feuille');
  assert.match(admin, /c\.faites/, 'le compte du pays doit être lu sur les compteurs');
});

test('LES DEUX COMPTES DISENT LEUR PORTÉE, ET SE RÉCONCILIENT', () => {
  // LA QUESTION DE B, POSÉE TELLE QUELLE (12/10/2026) : « Dans le tableau de ce
  // que ce pays propose, je vois une affiliation déjà faite, et plus bas, je vois
  // déjà fait deux affiliations. Pourquoi le chiffre est différent ? »
  //
  // Les deux chiffres étaient JUSTES — l'un compte le pays consulté, l'autre tous
  // les pays — et aucun ne le disait. Un chiffre qui ne dit pas sa portée se lit
  // comme une erreur : c'est le défaut, et il se répare en écrivant la portée.
  // Cette épreuve tient les trois morceaux : le compte du pays dit « dans ce
  // pays », celui du bloc dit « en tout », et le bloc DONNE LA RÉCONCILIATION
  // (« ici 1 sur 2 ») au lieu de laisser le lecteur faire la soustraction.
  assert.match(admin, /déjà faite\(s\) dans ce pays/,
    'le compte du pays doit dire « dans ce pays »');
  assert.match(admin, /affiliation\(s\) en tout/, 'le compte global doit dire « en tout »');
  assert.match(admin, /ne compte que le pays consulté — ici <b>\$\{nf\.format\(c\.faites\)\}<\/b>\s*\n?\s*sur <b>\$\{nf\.format\(faites\.length\)\}<\/b>/,
    'le bloc doit réconcilier les deux chiffres en clair (celui du pays, sur le total)');
  // Et le résumé du pays, sous les tuiles, porte la même portée : trois endroits,
  // une seule lecture possible.
  assert.match(admin, /cur\.faites\)\} déjà faite\(s\) dans ce pays/,
    'le résumé du pays doit dire la même chose que la tuile');
});

test('les écrans qui nommaient ce qui a changé ne mentent plus', () => {
  // « Groupon, Bol et AMAZON sont dans ce cas » : Amazon n'est plus un exemple de
  // « non mesuré » depuis que ses deux identifiants sont ouverts — il est passé
  // dans le groupe « affiliation faite ». Une phrase qui nomme un acteur déplacé
  // devient fausse sans que rien ne l'ait touchée : on la vérifie explicitement.
  assert.ok(!/non mesuré':.*Amazon/.test(admin),
    'le texte de « non mesuré » ne doit plus citer Amazon : il a changé de groupe');
  assert.match(admin, /Groupon et Bol sont dans ce cas/);
});
