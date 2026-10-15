/* =============================================================================
   LES LIENS DES ARTICLES — ET L'ALIGNEMENT DES BLOCS DE L'ONGLET « AJOUTS & REFUS ».

   Demande de B, 15/10/2026 : « peux-tu rajouter les liens internet des articles
   qui n'ont pas été diffusés et ceux qui ont été diffusés. Afin de pouvoir
   analyser en regardant l'article directement. Tu l'as bien fait dans l'onglet
   vie et carte, je veux la même chose au niveau des liens internet. »

   DEUX DÉFAUTS MESURÉS LE 15/10/2026, EN EXERÇANT L'ONGLET DANS UN NAVIGATEUR.
   Cette épreuve existe pour qu'ils ne reviennent pas.

   1. ZÉRO LIEN CLIQUABLE DANS LES TROIS TABLEAUX DE L'ONGLET.
      La cause n'était pas le rendu mais le CHAMP LU : `LIEN_OFFRE` cherchait
      `x.lien`. Or `lien` est le nom que le JOURNAL DES CARTES écrit — « Vie des
      cartes » avait donc ses liens, et c'est pour ça que B y renvoyait — alors
      que le CATALOGUE PUBLIÉ écrit `lienPage` (la page qui raconte la promo) et
      `lienMarchand` (le produit chez le marchand). Dans l'onglet des ajouts et
      des refus, où tout vient du catalogue, la fonction retombait sur du texte
      mort. C'est la « règle du tuyau » dans sa forme la plus cruelle : un lien
      absent s'affiche EXACTEMENT comme une offre qui n'en a pas — rien ne le dit.
      L'épreuve exerce donc la VRAIE fonction sur les VRAIES offres publiées :
      elle ne vérifie pas qu'une chaîne est présente, elle vérifie qu'un `href`
      sort, et que c'est la bonne adresse.

   2. UN TABLEAU ÉCRASÉ DANS UNE COLONNE DE 185 px.
      Les tuiles de compteurs et le tableau des entrées vivaient dans le MÊME
      conteneur, déclaré en grille CSS (`.grille`) : le tableau n'avait donc
      droit qu'à UNE cellule — 185 px mesurés contre 1 110 px pour les blocs
      voisins. Les tuiles, elles, étaient déjà ailleurs en ligne. La règle que
      cette épreuve tient : UN CONTENEUR EN GRILLE NE REÇOIT JAMAIS DE TABLEAU.
      Elle est vérifiée sur TOUS les conteneurs du panneau, pas seulement sur
      celui qu'on vient de réparer — c'est la classe de défaut qu'on ferme, pas
      son exemplaire.

   Lancement : node --test tests/admin-liens-des-articles.test.mjs
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as REGLES from '../public/regles-affichage.js';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const HTML = lire('public/admin/index.html');
/* Le script de l'application du panneau : le PREMIER <script type="module">.
   Le dernier porte le petit pont vers `regles-affichage.js` — il n'est pas
   concerné, et le prendre pour l'application ferait chercher les fonctions
   d'affichage dans trois lignes d'import. */
const DEBUT = HTML.indexOf('<script type="module">') + '<script type="module">'.length;
const JS = HTML.slice(DEBUT, HTML.indexOf('</script>', DEBUT));

/** Un morceau du fichier, entre deux repères. Refuse de rendre un vide : un
 *  repère déplacé doit casser l'épreuve, pas la rendre muette. */
function entre(debut, fin) {
  const d = JS.indexOf(debut);
  const f = JS.indexOf(fin, d);
  assert.ok(d >= 0, `le panneau doit contenir « ${debut} »`);
  assert.ok(f > d, `« ${fin} » doit venir APRÈS « ${debut} »`);
  return JS.slice(d, f);
}

/** Le bac à sable : les VRAIES fonctions du panneau, et les VRAIES règles
 *  d'affichage (le module que le site importe — pas une copie). */
function bac() {
  const ctx = vm.createContext({ console });
  const esc = JS.slice(JS.indexOf('const esc = (s) =>'), JS.indexOf('}[c]));') + '}[c]));'.length);
  vm.runInContext([
    esc,
    // Les deux adresses d'une offre, et le rendu d'une ligne.
    entre('const adresseArticle', 'const PAYS_CARTE'),
    // La décision de refus, avec ses portes et ses motifs.
    entre('const PORTES = {', 'async function dessinerRefusees'),
  ].join('\n'), ctx);
  // Les règles d'affichage ENTRENT par la propriété du bac, jamais par une
  // copie : le panneau les reçoit de `window.REGLES_AFFICHAGE`, l'épreuve les
  // passe en argument — dans les deux cas, c'est le MÊME module.
  ctx.__R = REGLES;
  return ctx;
}

const offresPubliees = () => {
  const d = JSON.parse(lire('docs/offres.json'));
  assert.ok(Array.isArray(d.offres) && d.offres.length, 'le catalogue publié doit être lisible');
  return d.offres;
};

/** Les adresses soulignées par un rendu, telles que le navigateur les lira. */
const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

/** Le rendu d'une offre par la vraie fonction, lue dans le bac à sable. */
const rendu = (ctx, o, texte = 'Une promo') => vm.runInContext(
  `LIEN_OFFRE(__o, ${JSON.stringify(texte)})`, Object.assign(ctx, { __o: o }));

/* -------------------------------------------------------------------------- *
 *  1. LES DEUX ADRESSES D'UNE OFFRE PUBLIÉE.
 * -------------------------------------------------------------------------- */

test('le titre ouvre l’ARTICLE, et la boutique reste une seconde porte', () => {
  const ctx = bac();
  const offre = offresPubliees().find((o) => o.lienPage && o.lienMarchand && o.lienPage !== o.lienMarchand);
  assert.ok(offre, 'le catalogue publié doit porter au moins une offre à deux adresses distinctes '
    + '(mesuré le 15/10/2026 : 140 offres sur 11 771)');

  const html = rendu(ctx, offre, 'Voir la promo');
  const liens = hrefs(html);
  // ⚠ L'ADRESSE EST ÉCHAPPÉE EN HTML : une adresse qui porte un `&` (les liens
  // de Google Actualités en portent) DOIT ressortir en `&amp;` dans l'attribut,
  // sinon le navigateur reçoit une entité et casse l'adresse. On compare donc à
  // l'adresse échappée par LA fonction du panneau, pas à l'adresse brute.
  // ⚠ ET L'ATTENDU SE CONSTRUIT DANS CE MONDE-CI : un tableau rendu par le bac à
  // sable a le prototype de SON contexte, et `deepStrictEqual` refuse deux
  // tableaux de deux mondes même quand ils affichent la même chose — l'épreuve
  // dirait alors « faux » sur deux listes identiques.
  const echappe = (s) => vm.runInContext(`esc(${JSON.stringify(s)})`, ctx);
  const attendus = [echappe(offre.lienPage), echappe(offre.lienMarchand)];
  assert.deepEqual(liens, attendus,
    'le titre mène à l’article, puis la boutique — dans cet ordre, les deux adresses exactes');
  assert.match(html, /class="lien-boutique"/,
    'la boutique doit se distinguer comme telle, elle ne remplace pas l’article');
  assert.match(html, new RegExp(`title="Ouvrir le produit chez ${offre.marchand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
    'et nommer le marchand où elle mène');
});

test('une seule adresse ⇒ un seul lien ; aucune ⇒ du texte, jamais un lien vide', () => {
  const ctx = bac();
  const publiees = offresPubliees();

  // CAS RÉEL : l'immense majorité du catalogue (11 631 offres mesurées le
  // 15/10/2026) porte la même adresse des deux côtés. Le titre doit alors
  // mener à l'article, et AUCUN second lien ne doit être ajouté : deux liens
  // vers la même page feraient croire à deux destinations.
  const meme = publiees.find((o) => o.lienPage && o.lienMarchand && o.lienPage === o.lienMarchand);
  assert.ok(meme, 'le catalogue publié doit porter une offre à adresse unique');
  assert.equal(hrefs(rendu(ctx, meme)).length, 1,
    'même adresse des deux côtés : un seul lien, pas deux portes vers la même page');

  // CAS FABRIQUÉS — les deux bords que le catalogue ne montre pas aujourd'hui :
  // une offre sans page d'article (la boutique seule), et une offre sans aucune
  // adresse. Le panneau les écarte de ses tableaux (`lienPage || lienMarchand`),
  // mais la fonction d'affichage doit tenir dans les deux cas : un `href` vide
  // ou un « undefined » cliquable serait pire qu'un lien manquant.
  const boutiqueSeule = { id: 'x', titre: 'Boutique seule', marchand: 'Proshop', lienMarchand: 'https://exemple.test/p/1' };
  const htmlBoutique = rendu(ctx, boutiqueSeule);
  assert.deepEqual(hrefs(htmlBoutique), ['https://exemple.test/p/1'],
    'sans page d’article, la boutique est la seule porte — et elle s’ouvre');
  assert.ok(!/lien-boutique/.test(htmlBoutique), 'il n’y a pas deux fois la même porte');

  const sansAdresse = { id: 'y', titre: 'Aucune adresse', marchand: 'Proshop' };
  const htmlNu = rendu(ctx, sansAdresse, 'Aucune adresse');
  assert.equal(hrefs(htmlNu).length, 0, 'aucune adresse connue ⇒ aucun lien');
  assert.match(htmlNu, /Aucune adresse/, 'et le titre reste lisible : on ne cache rien');
  assert.ok(!/undefined|href=""/.test(htmlNu), 'aucun « undefined » cliquable, aucun href vide');
});

/* -------------------------------------------------------------------------- *
 *  2. LES OFFRES REFUSÉES — celles que B ouvre pour juger un filtre.
 *      L'épreuve refait le tri du panneau avec SES fonctions et SES règles, sur
 *      le catalogue réel, et exige que CHAQUE ligne affichée porte son lien.
 * -------------------------------------------------------------------------- */

test('chaque offre refusée par les filtres garde le lien de son article', () => {
  const ctx = bac();
  const publiees = offresPubliees().filter((o) => (o.lienPage || o.lienMarchand));

  const refusees = publiees.filter((o) => {
    const motif = vm.runInContext('motifDeRefus(__o, __R)', Object.assign(ctx, { __o: o }));
    return !vm.runInContext(`PORTES[${JSON.stringify(motif)}]`, ctx);
  });
  assert.ok(refusees.length > 100,
    `le catalogue doit contenir des offres écartées de la vue par défaut (trouvé : ${refusees.length})`);

  // On borne comme le panneau (REFUSEES_MAX) : l'épreuve vérifie ce qui s'AFFICHE.
  const montrees = refusees.slice(0, 300);
  const sansLien = montrees.filter((o) => !hrefs(rendu(ctx, o, String(o.titre || '—').slice(0, 74))).length);
  assert.deepEqual(sansLien.map((o) => o.titre).slice(0, 5), [],
    `${sansLien.length} offre(s) refusée(s) sans lien cliquable : l’article doit pouvoir s’ouvrir depuis le tableau`);

  // ET LE LIEN EST LE BON : celui de l'offre, pas celui d'une voisine. Un lien
  // juste mais faux enverrait B juger une autre annonce que celle du refus.
  const ctx2 = bac();
  const faux = montrees.filter((o) => {
    const l = hrefs(vm.runInContext('LIEN_OFFRE(__o, "x")', Object.assign(ctx2, { __o: o })))[0];
    return l !== vm.runInContext('esc(__o.lienPage || __o.lienMarchand)', Object.assign(ctx2, { __o: o }));
  });
  assert.deepEqual(faux.map((o) => o.titre).slice(0, 5), [],
    `${faux.length} offre(s) refusée(s) dont le lien ne mène pas à leur propre article`);
});

/* -------------------------------------------------------------------------- *
 *  3. « CEUX QUI ONT ÉTÉ DIFFUSÉS » — le tableau des entrées, lui aussi.
 *      On ne dépend pas de l'horloge (la fenêtre est de vingt minutes et le
 *      catalogue peut être plus vieux) : on vérifie la LIGNE écrite, qui est
 *      la même pour toutes les entrées.
 * -------------------------------------------------------------------------- */

test('le tableau des entrées ouvre aussi l’article', () => {
  const entrantes = entre("txt('mAjoutsEntreesListe'", "const p = suivi.passage");
  assert.match(entrantes, /LIEN_OFFRE\(o, /,
    'chaque ligne entrée doit passer par LIEN_OFFRE — c’est ce qui la rend ouvrable');
  const refus = entre("txt('mRefuseesListe'", 'const AJOUTS_MAX');
  assert.match(refus, /LIEN_OFFRE\(o, /,
    'et chaque ligne refusée aussi : les deux moitiés de la demande de B');
});

/* -------------------------------------------------------------------------- *
 *  4. L'ALIGNEMENT — un conteneur en grille ne reçoit JAMAIS de tableau.
 *      Le défaut mesuré : un tableau de 1 110 px réduit à une cellule de 185 px
 *      parce qu'il était écrit dans une grille, à la suite des tuiles.
 * -------------------------------------------------------------------------- */

/** Les charges écrites par `txt('id', …)`, chacune bornée par l'appel suivant.
 *  Cette borne peut RACCOURCIR une charge, jamais l'allonger : un défaut caché
 *  derrière une borne trop courte ne peut donc pas passer pour un succès. */
function charges() {
  const appels = [...JS.matchAll(/txt\('([A-Za-z0-9_]+)'/g)];
  assert.ok(appels.length > 50, `le panneau doit écrire dans ses blocs (trouvé : ${appels.length} appels)`);
  return appels.map((m, i) => ({
    id: m[1],
    charge: JS.slice(m.index, i + 1 < appels.length ? appels[i + 1].index : JS.length),
  }));
}

/** Les conteneurs déclarés en grille dans le HTML, lus et non recopiés. */
const GRILLES = new Set([...HTML.matchAll(/class="([^"]*\bgrille\b[^"]*)"[^>]*?id="([A-Za-z0-9_-]+)"/g)]
  .map((m) => m[2]));

test('aucun conteneur en grille ne reçoit de tableau (le défaut de la colonne de 185 px)', () => {
  assert.ok(GRILLES.size >= 10,
    `les conteneurs en grille doivent être reconnus (trouvé : ${GRILLES.size}) — sans quoi cette épreuve ne vérifie rien`);
  const fautifs = [];
  for (const c of charges()) {
    if (!GRILLES.has(c.id)) continue;
    if (/<table/.test(c.charge) || /class="defile"/.test(c.charge)) fautifs.push(c.id);
  }
  assert.deepEqual(fautifs, [],
    'un tableau écrit dans une grille n’a droit qu’à une cellule : les tuiles vont dans la grille, le tableau dans SON bloc');
});

test('les compteurs des entrées et leur tableau vivent dans deux blocs distincts', () => {
  assert.match(HTML, /class="grille mesures" id="mAjoutsEntrees"/,
    'les tuiles des entrées doivent être dans une grille, comme partout ailleurs dans le panneau');
  assert.match(HTML, /<div id="mAjoutsEntreesListe"><\/div>/,
    'et le tableau des entrées doit avoir son propre bloc, sans classe de grille');
  const tuiles = charges().filter((c) => c.id === 'mAjoutsEntrees');
  assert.ok(tuiles.length, 'le bloc des compteurs doit être rempli');
  assert.ok(tuiles.some((c) => /tuiles\(/.test(c.charge)),
    'et il doit porter les compteurs, pas autre chose');
  assert.ok(!tuiles.some((c) => /defile|<table/.test(c.charge)),
    'sans tableau : c’est le défaut qu’on vient de corriger');
  const liste = charges().filter((c) => c.id === 'mAjoutsEntreesListe');
  assert.ok(liste.some((c) => /class="defile"/.test(c.charge) && /<table/.test(c.charge)),
    'le tableau des entrées doit bien être écrit, dans son bloc');
});

test('les chiffres des tableaux sont alignés à droite, en-têtes compris', () => {
  // Ce qui rend une colonne de nombres lisible : elle est à droite, en chiffres
  // de largeur fixe (`th.n{width:1%}` + `font-variant-numeric:tabular-nums`),
  // et l'en-tête porte la MÊME classe que les cellules — sinon le titre part à
  // gauche et les nombres à droite, ce qui se lit comme deux colonnes.
  for (const [id, colonnes] of [
    ['mAjoutsEntreesListe', ['Prix', 'Remise']],
    ['mRefuseesListe', ['Âge', 'Prix', 'Remise']],
  ]) {
    const bloc = charges().filter((c) => c.id === id).map((c) => c.charge).join('');
    assert.ok(bloc.length > 200, `la charge de ${id} doit être lisible (${bloc.length} octets)`);
    for (const col of colonnes) {
      assert.ok(bloc.includes(`<th class="n">${col}</th>`),
        `« ${col} » doit être un en-tête numérique (class="n") dans ${id}`);
    }
    assert.match(bloc, /<td class="n">\$\{/,
      `les cellules numériques de ${id} doivent porter class="n"`);
  }
  assert.match(HTML, /td\.n,th\.n\{text-align:right/,
    'et la règle doit exister : un en-tête marqué sans règle ne s’aligne pas');
  assert.match(HTML, /th\.n\{width:1%\}/,
    'les nombres ne prennent que leur place ; le texte prend le reste');
});
