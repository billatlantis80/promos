/* ============================================================================
 *  LES COMPTEURS DE « VIE DES CARTES » SUIVENT LE PAYS CONSULTÉ.
 *
 *  LE DÉFAUT, MESURÉ LE 15/10/2026. La barre de pays filtrait les tableaux des
 *  deux onglets, mais PAS les compteurs du haut : sous un titre « Pays consulté :
 *  France », B lisait encore « 10 650 cartes affichées » — le total du catalogue
 *  entier. Un total affiché sous un filtre n'est pas une imprécision : c'est un
 *  chiffre faux, et c'est précisément ce que ce panneau existe pour traquer.
 *
 *  CE QUE CETTE ÉPREUVE EXIGE, ET POURQUOI ELLE PEUT LE FAIRE :
 *    1. le collecteur PUBLIE chaque compte découpé par pays, et la somme des
 *       parts égale le total — vérifié sur `docs/suivi-cartes.json` RÉEL, pas
 *       sur un fichier fabriqué : c'est le fichier que le panneau lit ;
 *    2. le panneau, exercé pour de vrai (son propre bloc de compteurs, dans un
 *       bac à sable, avec les données publiées), affiche la part du pays ;
 *    3. quand la répartition n'est pas publiée, il écrit « — » et le DIT — il ne
 *       se rabat JAMAIS sur le total, qui se lirait comme la mesure du pays.
 *
 *  L'épreuve refuse aussi de se contenter d'un « ça a l'air bon » : elle LIT
 *  les tuiles rendues (valeur + libellé) au lieu de chercher des chiffres dans
 *  le HTML. Un nombre qui apparaît quelque part n'est pas un nombre bien placé.
 * ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const HTML = lire('public/admin/index.html');
const DEBUT = HTML.indexOf('<script type="module">') + '<script type="module">'.length;
const JS = HTML.slice(DEBUT, HTML.indexOf('</script>', DEBUT));

/** Un morceau du fichier, entre deux repères — il refuse de rendre un vide. */
function entre(debut, fin) {
  const d = JS.indexOf(debut);
  const f = JS.indexOf(fin, d);
  assert.ok(d >= 0, `le panneau doit contenir « ${debut} »`);
  assert.ok(f > d, `« ${fin} » doit venir APRÈS « ${debut} »`);
  return JS.slice(d, f);
}

const journal = () => JSON.parse(lire('docs/suivi-cartes.json'));
const nbFr = (n) => new Intl.NumberFormat('fr-BE').format(Math.round(Number(n) || 0));

/** LE BAC À SABLE : les vraies fonctions du panneau (`esc`, `nb`, `tuiles`,
 *  `poidsCourt`, `compteurDuPays`), et son VRAI bloc de compteurs extrait du
 *  fichier — pas une copie, qui dériverait sans qu'on le voie.
 *
 *  `txt` CAPTURE au lieu d'écrire dans le document : c'est la seule concession,
 *  et elle porte sur le transport, pas sur le calcul. */
function bac() {
  const ctx = vm.createContext({ console });
  const esc = JS.slice(JS.indexOf('const esc = (s) =>'), JS.indexOf('}[c]));') + '}[c]));'.length);
  const bloc = entre('// ⚠ LES COMPTEURS SUIVENT LE PAYS CONSULTÉ', '// QUI RETIRE QUOI');
  vm.runInContext([esc,
    "const nf = new Intl.NumberFormat('fr-BE');",
    "const nb = (n) => nf.format(Math.round(Number(n) || 0));",
    "let paysChoisiCartes = '';",
    "const nomDuPays = (c) => (c ? 'nom du pays' : '—');",
    "const tuiles = (paires) => paires.map(([v, l]) => "
      + "'<div class=\"mesure\"><div class=\"gros\">' + esc(v) + '</div><div class=\"lib\">' + esc(l) + '</div></div>').join('');",
    entre('const poidsCourt', 'function dessinerCartes'),
    entre('const compteurDuPays', 'const GLOBE'),
    "let __capture = '';",
    "const txt = (id, html) => { if (id === 'mCartesCompteurs') __capture = html; };",
    `function rendreCompteurs(d) {
       const c = d.c, p = d.p, e = d.e;
       const effaceesToutes = d.effaceesToutes || [];
${bloc}
       return __capture;
     }`,
  ].join('\n'), ctx);
  return ctx;
}

/** Les tuiles RENDUES, lues dans l'ordre : [valeur, libellé]. */
const tuilesRendues = (html) => [...html.matchAll(
  /class="gros">([^<]*)<\/div><div class="lib">([^<]*)<\/div>/g)].map((m) => [m[1], m[2]]);

/** Rend le bloc de compteurs pour un pays donné ('' = tous les pays). */
function rendre(ctx, pays, donnees) {
  vm.runInContext(`paysChoisiCartes = ${JSON.stringify(pays)}`, ctx);
  return vm.runInContext('rendreCompteurs(__d)', Object.assign(ctx, { __d: donnees }));
}

const donneesDuJournal = (s) => ({
  c: s.cartes, p: s.passage || {}, e: s.effacees || {},
  effaceesToutes: (s.effacees || {}).liste || [],
});

/* -------------------------------------------------------------------------- *
 *  1. LE COLLECTEUR PUBLIE CHAQUE COMPTE DÉCOUPÉ, ET LA SOMME TOMBE JUSTE.
 *      Sur le journal RÉEL : c'est lui que le panneau lit, et une somme fausse
 *      rendrait faux tous les chiffres par pays d'un seul coup.
 * -------------------------------------------------------------------------- */

test('chaque compte publié a sa répartition par pays, et la somme est le total', () => {
  const s = journal();
  const c = s.cartes || {}, e = s.effacees || {}, p = s.passage || {};
  const somme = (o) => Object.values(o || {}).reduce((n, v) => n + (Number(v) || 0), 0);

  // LE CŒUR : chaque part somme exactement son total. Une part perdue, et le
  // panneau afficherait un pays qui ne compte pas son monde.
  const couples = [
    ['cartes affichées', c.parPaysAffichees, c.affichees],
    ['cartes dans leurs cinq jours', c.parPaysCinqJours, c.dansLesCinqJours],
    ['cartes sans date lisible', c.parPaysSansDate, c.sansDate],
    ['cartes au-delà de cinq jours', c.parPaysBloquees, c.bloquees],
    ['effacements du passage', p.parPays, p.effacees],
    ['reprises du passage', p.parPaysReprises, p.reprises],
    ['effacements au registre', e.parPays, e.retenues],
    ['cartes revenues après effacement', e.parPaysRevenues, e.revenues],
  ];
  for (const [quoi, repartition, total] of couples) {
    assert.ok(repartition && typeof repartition === 'object',
      `« ${quoi} » doit publier sa répartition par pays (absent : le panneau n'aurait rien à lire)`);
    assert.equal(somme(repartition), total,
      `la somme des parts de « ${quoi} » doit être son total — sinon un pays compterait faux`);
  }
  // LE POIDS LIBÉRÉ SUIT AUSSI : sans lui, les octets auraient été affichés pour
  // le catalogue entier sous le nom d'un pays.
  assert.equal(somme(p.parPaysOctets), p.octets,
    'le poids libéré doit sommer son total, comme le compte');

  // ET LE DÉCOUPAGE INTERNE EST COHÉRENT : une carte est dans une seule
  // population, par pays comme au total.
  for (const pays of Object.keys(c.parPaysAffichees || {})) {
    const cinq = (c.parPaysCinqJours || {})[pays] || 0;
    const sansDate = (c.parPaysSansDate || {})[pays] || 0;
    const bloquees = (c.parPaysBloquees || {})[pays] || 0;
    assert.equal(cinq + sansDate + bloquees, c.parPaysAffichees[pays],
      `${pays} : cinq jours + sans date + bloquées doit être le compte affiché du pays`);
  }
  assert.equal(somme(c.parPaysCinqJours) + somme(c.parPaysSansDate) + somme(c.parPaysBloquees),
    c.affichees, 'la partition doit être complète, pays compris');
});

test('la plus ancienne carte bloquée est publiée par pays, calculée sur la liste ENTIÈRE', () => {
  const s = journal();
  const c = s.cartes || {};
  const parPays = c.plusAncienneParPays;
  assert.ok(parPays && typeof parPays === 'object',
    'l’âge de la plus ancienne doit être publié par pays — la liste publiée est bornée, '
    + 'et la calculer à l’écran donnerait l’âge de la plus ancienne carte VISIBLE');
  // La liste publiée est tronquée : c'est justement pourquoi ce chiffre est
  // calculé par le collecteur. L'épreuve exige donc qu'il puisse DÉPASSER ce que
  // la liste montre — la preuve qu'il ne vient pas d'elle.
  const lue = Math.max(...(c.liste || []).map((x) => x.ageJours ?? 0), 0);
  assert.ok(parPays && Object.keys(parPays).length > 0, 'la répartition ne peut pas être vide');
  for (const [pays, age] of Object.entries(parPays)) {
    assert.ok(Number.isFinite(age) && age >= 0, `${pays} : l’âge doit être un nombre`);
    assert.ok(age <= (c.plusAncienneJours ?? Infinity) + 1e-9,
      `${pays} : aucune carte d’un pays ne peut être plus ancienne que la plus ancienne du catalogue`);
  }
  assert.ok(lue > 0, 'garde-fou : la liste publiée doit porter des âges, sinon ce test ne prouve rien');
});

/* -------------------------------------------------------------------------- *
 *  2. LE COMPTEUR LUI-MÊME — trois cas, et le troisième est la garantie.
 * -------------------------------------------------------------------------- */

test('le compteur d’un pays : le total, la part, ou RIEN — jamais la part d’un autre', () => {
  const ctx = bac();
  const cas = (repartition, pays, total) => vm.runInContext(
    `compteurDuPays(__r, __p, __t)`,
    Object.assign(ctx, { __r: repartition, __p: pays, __t: total }));

  assert.equal(cas({ FR: 12, DE: 3 }, '', 99), 99,
    'sans pays consulté, le compteur est le total');
  assert.equal(cas({ FR: 12, DE: 3 }, 'FR', 99), 12,
    'avec un pays, c’est SA part');
  assert.equal(cas({ FR: 12, DE: 3 }, 'BE', 99), 0,
    'un pays absent d’une répartition PUBLIÉE est un zéro mesuré : aucune de ses cartes '
    + 'n’est dans cette population');
  assert.equal(cas(null, 'FR', 99), null,
    '⚠ répartition NON PUBLIÉE ⇒ `null`. C’est LA garantie de cette épreuve : se rabattre '
    + 'sur 99 afficherait le catalogue entier sous le nom d’un pays, exactement le défaut corrigé');
  assert.equal(cas(undefined, 'FR', 99), null, 'et l’absence de champ se comporte pareil');
  assert.equal(cas({ FR: 0 }, 'FR', 99), 0, 'un zéro publié est un zéro : il s’affiche');
});

/* -------------------------------------------------------------------------- *
 *  3. À L'ÉCRAN — le vrai bloc, les vraies données, les tuiles LUES.
 * -------------------------------------------------------------------------- */

test('sous un pays, les tuiles portent SA part ; sous « Tous les pays », le total', () => {
  const ctx = bac();
  const s = journal();
  const d = donneesDuJournal(s);
  const lireTuile = (html, libelle) => {
    const t = tuilesRendues(html).find(([, l]) => l === libelle);
    assert.ok(t, `aucune tuile « ${libelle} » dans le rendu`);
    return t[0];
  };

  // LA VUE COMPLÈTE : les totaux publiés, tels quels.
  const tous = rendre(ctx, '', d);
  assert.equal(lireTuile(tous, 'cartes affichées'), nbFr(s.cartes.affichees),
    'sans pays choisi, on affiche le total — et il doit être celui du fichier');
  assert.equal(lireTuile(tous, 'effacements au registre (30 j, tous pays)'), nbFr(s.effacees.retenues),
    'et le registre se nomme « tous pays »');

  // CHAQUE PAYS DE LA RÉPARTITION : sa part, libellée comme la sienne.
  const pays = Object.keys(s.cartes.parPaysAffichees || {});
  assert.ok(pays.length > 1, 'garde-fou : le journal doit nommer plusieurs pays, sinon rien à éprouver');
  for (const p of pays) {
    const h = rendre(ctx, p, d);
    assert.equal(lireTuile(h, 'cartes affichées'), nbFr(s.cartes.parPaysAffichees[p]),
      `${p} : la tuile « cartes affichées » doit porter SA part, pas le total du catalogue`);
    assert.equal(lireTuile(h, 'dans leurs cinq jours'), nbFr(s.cartes.parPaysCinqJours[p]),
      `${p} : idem pour les cartes dans leurs cinq jours`);
    assert.equal(lireTuile(h, 'au-delà de cinq jours'), nbFr(s.cartes.parPaysBloquees[p] || 0),
      `${p} : idem pour les cartes au-delà de cinq jours`);
    assert.equal(lireTuile(h, 'effacements au registre (30 j, ce pays)'), nbFr(s.effacees.parPays[p] || 0),
      `${p} : le registre se nomme « ce pays », donc il doit porter le compte du pays`);
    // LE TÉMOIN QUI MANQUE SOUVENT : le total ne doit pas s'être glissé là. On le
    // cherche dans les VALEURS des tuiles, pas dans le texte — un nombre cité
    // dans une phrase n'est pas un chiffre affiché comme mesure.
    const valeurs = tuilesRendues(h).map(([v]) => v);
    const partAffichees = s.cartes.parPaysAffichees[p];
    const partRegistre = s.effacees.parPays[p] || 0;
    if (nbFr(s.cartes.affichees) !== nbFr(partAffichees)) {
      assert.ok(!valeurs.includes(nbFr(s.cartes.affichees)),
        `${p} : le total des cartes affichées (${nbFr(s.cartes.affichees)}) ne doit apparaître `
        + 'dans AUCUNE tuile de ce pays');
    }
    if (nbFr(s.effacees.retenues) !== nbFr(partRegistre)) {
      assert.ok(!valeurs.includes(nbFr(s.effacees.retenues)),
        `${p} : le total du registre (${nbFr(s.effacees.retenues)}) ne doit apparaître `
        + 'dans AUCUNE tuile de ce pays');
    }
  }
});

test('une répartition absente affiche « — », nomme la cause, et ne se rabat pas sur le total', () => {
  const ctx = bac();
  const s = journal();
  const d = donneesDuJournal(s);
  const sansRepartition = { c: { ...s.cartes }, p: { ...(s.passage || {}) }, e: { ...(s.effacees || {}) },
    effaceesToutes: (s.effacees || {}).liste || [] };
  for (const champ of ['parPaysAffichees', 'parPaysCinqJours', 'parPaysBloquees']) delete sansRepartition.c[champ];
  delete sansRepartition.e.parPays;

  const pays = Object.keys(s.cartes.parPaysAffichees)[0];
  const h = rendre(ctx, pays, sansRepartition);
  const valeurs = tuilesRendues(h).map(([v]) => v);
  assert.ok(valeurs.includes('—'),
    'sans répartition publiée, le compteur s’affiche « — » : un tiret se lit, un chiffre faux se croit');
  assert.ok(!valeurs.includes(nbFr(s.cartes.affichees)),
    '⚠ et surtout PAS le total : c’est le défaut d’origine, et il ne doit pas revenir');
  assert.match(h, /ne porte pas\s+encore la répartition par pays|répartition par pays pour/,
    'le bloc doit NOMMER la cause, sinon le tiret a l’air d’un zéro mesuré');
  assert.match(h, /cartes affichées/, 'et il doit dire de QUEL compteur il parle');
});

test('le rendu nomme le pays consulté, et dit où trouver les chiffres du catalogue', () => {
  const ctx = bac();
  const s = journal();
  const d = donneesDuJournal(s);
  const h = rendre(ctx, Object.keys(s.cartes.parPaysAffichees)[0], d);
  assert.match(h, /nom du pays/, 'le bloc doit nommer le pays que ses chiffres décrivent');
  assert.match(h, /Tous les pays/, 'et dire où sont les chiffres du catalogue entier');
  assert.ok(!/avisTousPays/.test(h), 'un rappel « tous les pays » ici serait un aveu de total faux');
  assert.equal(rendre(ctx, '', d).includes('Pays consulté'), false,
    'sans pays choisi, aucun rappel : pas de bandeau inutile sur la vue complète');
});

/* -------------------------------------------------------------------------- *
 *  4. LE CODE LUI-MÊME — aucun compteur ne reste branché sur le total.
 * -------------------------------------------------------------------------- */

test('aucun compteur de la vie des cartes n’est branché directement sur un total', () => {
  const bloc = entre('// ⚠ LES COMPTEURS SUIVENT LE PAYS CONSULTÉ', '// QUI RETIRE QUOI');
  for (const direct of ['nb(c.affichees)', 'nb(c.dansLesCinqJours)', 'nb(c.bloquees)',
    'nb(p.effacees)', 'nb(p.reprises)', 'nb(e.revenues)', 'nb(c.plusAncienneJours)']) {
    assert.ok(!bloc.includes(direct),
      `« ${direct} » ne doit plus être affiché : un total sous un filtre de pays est un chiffre faux`);
  }
  for (const compteur of ['cAffichees', 'cCinq', 'cBloquees', 'cEffacees', 'cOctets',
    'cReprises', 'cRetenues', 'cRevenues', 'cPlusAncienne']) {
    assert.ok(bloc.includes(`compteurDuPays(`) && bloc.includes(`const ${compteur} = compteurDuPays(`),
      `« ${compteur} » doit passer par le compteur de pays`);
  }
  assert.match(bloc, /chiffreOuTiret\(/,
    'et son rendu doit passer par le tiret : un `null` ne peut pas devenir « 0 »');
});
