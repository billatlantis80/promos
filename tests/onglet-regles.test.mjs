/**
 * L'ONGLET DES RÈGLES — épreuve de l'ÉCRAN, sans navigateur.
 *
 * Trois choses sont prouvées ici, et chacune attrape un défaut qui ne lève
 * aucune erreur :
 *
 *   1. LE CATALOGUE PUBLIÉ EST À JOUR DU CODE. `public/regles.json` porte
 *      l'empreinte des fichiers dont il a lu les valeurs. Si quelqu'un change
 *      `VIE_AFFICHEE_JOURS` sans republier, l'onglet afficherait « 5 jours » sur
 *      un code qui dit 4 — et rien à l'écran ne le dirait. Cette épreuve le dit.
 *   2. L'ONGLET REMPLIT TOUT. La fonction de dessin est extraite du fichier
 *      PUBLIÉ (pas réécrite pour l'essai), exécutée sur le catalogue réel, avec
 *      un DOM qui retient ce qu'on lui écrit. On refuse les trous d'affichage :
 *      « undefined », « NaN », « [object Object] », « null ».
 *   3. LE CAS « RIEN À LIRE » S'EXPLIQUE. Catalogue absent : l'onglet écrit
 *      POURQUOI, et n'affiche pas des zéros — un zéro a l'air d'une mesure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');
const PANNEAU = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');
const FICHIER = path.join(RACINE, 'public', 'regles.json');
const CATALOGUE = path.join(RACINE, 'donnees', 'regles-du-site.json');

function fauxDocument() {
  const ecrits = new Map();
  const element = (id) => {
    const e = {
      id, innerHTML: '', textContent: '', value: '', className: '', hidden: false,
      dataset: {}, style: {},
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      addEventListener() {}, removeEventListener() {}, closest: () => null,
    };
    Object.defineProperty(e, 'innerHTML', {
      get: () => ecrits.get(id) || '',
      set: (v) => ecrits.set(id, String(v)),
    });
    // `textContent` EST RETENU AUSSI. L'onglet écrit le chapeau par `textContent`
    // (du texte brut, jamais du HTML) : un stub qui l'ignorerait ferait passer
    // l'épreuve « aucun bloc vide » pour un bloc qui n'est jamais écrit.
    Object.defineProperty(e, 'textContent', {
      get: () => ecrits.get(`${id}.texte`) || '',
      set: (v) => ecrits.set(`${id}.texte`, String(v)),
    });
    return e;
  };
  return { ecrits, getElementById: (id) => element(id), querySelectorAll: () => [], createElement: () => element('?') };
}

/** Ce qu'un bloc porte à l'écran : son HTML et son texte. */
const lu = (document, id) => `${document.ecrits.get(id) || ''}${document.ecrits.get(`${id}.texte`) || ''}`;

function chargerPanneau() {
  const coupe = (debut, fin) => {
    const i = PANNEAU.indexOf(debut);
    assert.ok(i > 0, `le panneau doit contenir « ${debut} »`);
    const j = PANNEAU.indexOf(fin, i);
    assert.ok(j > i, `« ${fin} » doit suivre « ${debut} »`);
    return PANNEAU.slice(i, j);
  };
  const codeNombres = PANNEAU.match(/const nf = new Intl\.NumberFormat\([^)]*\);/);
  assert.ok(codeNombres, 'le formateur de nombres doit être extractible');
  const source = [
    'let regles = null; let erreurRegles = ""; let filtreRegles = ""; let etatRegles = "tous"; let catRegles = "";',
    codeNombres[0],
    coupe('const esc = (s) =>', '\nconst ilYA'),
    coupe('/* ---------- LES RÈGLES DU SITE ----------', '/* ---------- Branchements ----------'),
  ].join('\n');

  const document = fauxDocument();
  const ctx = vm.createContext({
    document, console,
    Intl, Date, JSON, Math, Number, String, Object, Array, Set, Map, RegExp, isNaN, parseFloat,
    setTimeout, clearTimeout,
  });
  ctx.window = ctx;
  vm.runInContext(source, ctx);
  assert.equal(vm.runInContext('typeof dessinerRegles', ctx), 'function',
    'la fonction d’affichage des règles doit être chargeable');
  return { ctx, document };
}

function cataloguePublie() {
  assert.ok(fs.existsSync(FICHIER),
    'public/regles.json doit exister — il s’écrit avec `node bin/regles-du-site.mjs`');
  return JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
}

test('le catalogue des règles est à JOUR du code qu’il cite', () => {
  const d = cataloguePublie();
  assert.ok(d.empreintes && Object.keys(d.empreintes).length >= 3,
    'le catalogue doit porter l’empreinte des fichiers lus');
  for (const [f, empreinte] of Object.entries(d.empreintes)) {
    const p = path.join(RACINE, f);
    assert.ok(fs.existsSync(p), `fichier lu introuvable : ${f}`);
    const actuelle = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12);
    assert.equal(actuelle, empreinte,
      `${f} a changé depuis la publication des règles : les valeurs affichées par `
      + `l’onglet ne sont plus celles du code. Republier avec « node bin/regles-du-site.mjs ».`);
  }
});

test('chaque règle porte un numéro, un état, un énoncé et une source', () => {
  const d = cataloguePublie();
  const vus = new Set();
  let n = 0;
  for (const cat of d.categories) {
    for (const th of cat.themes) {
      assert.ok(th.regles.length, `le thème ${th.code} ne porte aucune règle`);
      for (const r of th.regles) {
        n += 1;
        for (const champ of ['num', 'titre', 'enonce', 'etat', 'source']) {
          assert.ok(r[champ] && String(r[champ]).trim(), `${r.num || '?'} : champ vide « ${champ} »`);
        }
        assert.ok(/^[A-G]\d+\.\d+$/.test(r.num), `numéro inattendu : ${r.num}`);
        assert.ok(r.num.startsWith(th.code + '.'), `${r.num} n’appartient pas au thème ${th.code}`);
        assert.ok(!vus.has(r.num), `numéro en double : ${r.num}`);
        vus.add(r.num);
        assert.ok(['active', 'en-pause', 'en-mesure', 'eteinte'].includes(r.etat),
          `${r.num} : état inconnu « ${r.etat} »`);
        // Une valeur annoncée doit avoir été LUE : le script refuse de publier
        // autrement, et l'épreuve le revérifie ici pour que le fichier ne puisse
        // pas être écrit à la main.
        for (const v of (r.valeurs || [])) {
          assert.ok(v.texte !== null && v.texte !== undefined && String(v.texte).trim(),
            `${r.num} : la valeur de ${v.nom} n’a pas été lue`);
          assert.ok(v.luDe === 'import' || v.luDe === 'source', `${r.num} : provenance inconnue pour ${v.nom}`);
        }
      }
    }
  }
  assert.equal(n, d.total, 'le total publié doit être le nombre réel de règles');
  assert.ok(n >= 60, `le catalogue paraît trop maigre : ${n} règle(s)`);
});

test('l’onglet dessine TOUTES les règles du catalogue publié, sans trou', () => {
  const d = cataloguePublie();
  const { ctx, document } = chargerPanneau();
  ctx.__regles = d;
  vm.runInContext('regles = __regles; filtreRegles = ""; etatRegles = "tous"; catRegles = ""; dessinerRegles();', ctx);

  for (const id of ['reglesChapeau', 'reglesComptes', 'reglesFiltres', 'reglesListe']) {
    assert.ok(lu(document, id).trim(), `bloc resté VIDE : ${id}`);
  }
  const tout = ['reglesChapeau', 'reglesComptes', 'reglesFiltres', 'reglesListe']
    .map((id) => lu(document, id)).join('\n');
  for (const trou of ['undefined', 'NaN', '[object Object]', '>null<']) {
    assert.ok(!tout.includes(trou), `« ${trou} » apparaît dans l’onglet — un champ manque`);
  }

  const liste = lu(document, 'reglesListe');
  for (const cat of d.categories) {
    assert.ok(liste.includes(`${cat.code} — `), `la catégorie ${cat.code} n’est pas dessinée`);
    for (const th of cat.themes) {
      assert.ok(liste.includes(th.code), `le thème ${th.code} n’est pas dessiné`);
      for (const r of th.regles) {
        assert.ok(liste.includes(`>${r.num}<`), `la règle ${r.num} n’est pas dessinée`);
        // On compare avec le MÊME échappement que l'écran : `esc` transforme
        // l'apostrophe en `&#39;`, et comparer au texte brut ferait échouer
        // l'épreuve sur un titre parfaitement bien affiché.
        ctx.__t = r.titre.slice(0, 24);
        assert.ok(liste.includes(vm.runInContext('esc(__t)', ctx)),
          `le titre de ${r.num} n’est pas dessiné`);
        for (const v of (r.valeurs || [])) {
          ctx.__v = v.texte;
          assert.ok(liste.includes(vm.runInContext('esc(__v)', ctx)),
            `${r.num} : la valeur « ${v.texte} » (${v.nom}) manque à l’écran`);
        }
      }
    }
  }
  // Les compteurs, eux aussi, viennent du fichier.
  const comptes = lu(document, 'reglesComptes');
  assert.ok(comptes.includes(new Intl.NumberFormat('fr-BE').format(d.total)),
    'le nombre total de règles n’est pas affiché dans les compteurs');
});

test('les filtres de l’onglet cherchent dans TOUT le texte, pas seulement le titre', () => {
  const d = cataloguePublie();
  const { ctx, document } = chargerPanneau();
  ctx.__regles = d;
  vm.runInContext('regles = __regles; dessinerRegles();', ctx);

  // Une constante citée doit se trouver : c'est le cas d'usage réel — « où est
  // donc réglée la durée de vie d'une carte ? ».
  vm.runInContext('filtreRegles = "VIE_AFFICHEE_JOURS"; dessinerRegles();', ctx);
  const trouve = lu(document, 'reglesListe');
  assert.ok(trouve.includes('>C1.1<'), 'la recherche par nom de constante doit trouver C1.1');
  assert.ok(!trouve.includes('>D3.1<'), 'la recherche a laissé passer une règle sans rapport');

  // Le filtre d'état : les règles éteintes doivent rester consultables.
  vm.runInContext('filtreRegles = ""; etatRegles = "eteinte"; dessinerRegles();', ctx);
  const eteintes = lu(document, 'reglesListe');
  const nb = (d.parEtat || {}).eteinte || 0;
  assert.ok(nb > 0, 'le catalogue doit porter au moins une règle éteinte');
  assert.equal((eteintes.match(/class="regle eteinte"/g) || []).length, nb,
    `le filtre « éteintes » doit montrer les ${nb} règles éteintes, ni plus ni moins`);
  assert.ok(!eteintes.includes('class="regle"'), 'une règle en vigueur s’est glissée dans les éteintes');

  // Une recherche sans réponse se DIT — elle n'affiche pas une page vide.
  vm.runInContext('etatRegles = "tous"; filtreRegles = "zzzz-introuvable"; dessinerRegles();', ctx);
  assert.ok(lu(document, 'reglesListe').includes('Aucune règle ne correspond'),
    'une recherche sans résultat doit s’écrire, pas laisser un blanc');
});

test('sans catalogue publié, l’onglet EXPLIQUE au lieu d’afficher des zéros', () => {
  const { ctx, document } = chargerPanneau();
  vm.runInContext('regles = null; erreurRegles = "HTTP 404"; dessinerRegles();', ctx);
  const liste = lu(document, 'reglesListe');
  assert.ok(liste.includes('regles.json'), 'le cas « rien à lire » doit nommer le fichier attendu');
  assert.ok(liste.includes('HTTP 404'), 'le cas « rien à lire » doit dire l’erreur réelle');
  assert.ok(!/\b0\b/.test(lu(document, 'reglesComptes')),
    'aucun compteur ne doit s’afficher quand rien n’a été lu');
});

test('le catalogue des règles cite des fichiers qui existent', () => {
  const src = fs.readFileSync(CATALOGUE, 'utf8');
  const d = JSON.parse(src);
  for (const cat of d.categories) {
    for (const th of cat.themes) {
      for (const r of th.regles) {
        for (const f of [r.source, r.preuve].filter(Boolean)) {
          assert.ok(fs.existsSync(path.join(RACINE, f)), `${r.num} : fichier cité introuvable — ${f}`);
        }
      }
    }
  }
});
