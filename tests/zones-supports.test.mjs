/* =============================================================================
   L'INFRASTRUCTURE DES CINQ SUPPORTS — adapter un support sans bouger un autre.

   Demande de B, 11/10/2026 : « j'aimerais pouvoir les adapter un par un. Sans
   toucher à l'infrastructure de l'autre. » Le site et l'application lisent la
   MÊME page et n'ont qu'UNE feuille : sans garde, une retouche destinée à la
   tablette peut se retrouver sur le téléphone, ou une retouche du site dans
   l'application — et cela ne se verrait que sur l'appareil de B.

   Ce test vérifie que la mécanique tient, sur le PAPIER, avant toute mesure :

     1. la marque du support est posée en tête de page (app ou site), et app.js
        la RELIT au lieu de refaire sa propre détection — deux détections qui
        divergeraient donneraient une page « site » dans l'application ;
     2. les cinq zones existent, nommées comme prévu, en fin de feuille (elles
        doivent gagner à spécificité égale, donc passer après tout le reste) ;
     3. chaque règle d'une zone commence par LE préfixe de sa zone : une règle
        de la zone « tablette » ne peut donc pas atteindre l'application ;
     4. chaque palier d'une zone tient DANS la largeur de sa zone. C'est le
        point qui compte le plus : un palier ouvert (`min-width: 620px` sans
        borne haute) dans la zone « site-tablette » s'appliquerait aussi à
        1440 px, c'est-à-dire au support « site-ordinateur » ;
     5. aucun `!important` dans une zone : une zone qui gagne par la force
        empêche la retouche suivante de passer.

   Ce qui n'est PAS vérifiable ici — et qui est mesuré ailleurs : qu'une zone
   agit vraiment. C'est l'affaire de `bin/mesurer-supports.py --eprouver`, qui
   pose une sonde de la portée de chaque zone et vérifie qu'elle ne déplace
   qu'un seul des cinq supports.
   ============================================================================= */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (nom) => readFileSync(new URL('../public/' + nom, import.meta.url), 'utf8');

/* LA TABLE DE RÉFÉRENCE DES CINQ SUPPORTS. Elle est écrite ici, et non déduite
   de la feuille : c'est le contrat. Si quelqu'un élargit une zone dans app.css
   sans toucher à cette table, le test échoue — et l'on saura laquelle des deux
   versions est la bonne en relisant la demande de B. */
const SUPPORTS = [
  { id: 'app-telephone',   support: 'app',  largeur: '0-619',    prefixe: 'html[data-support="app"]',  min: 0,    max: 619 },
  { id: 'app-tablette',    support: 'app',  largeur: '620-',     prefixe: 'html[data-support="app"]',  min: 620,  max: Infinity },
  { id: 'site-telephone',  support: 'site', largeur: '0-619',    prefixe: 'html[data-support="site"]', min: 0,    max: 619 },
  { id: 'site-tablette',   support: 'site', largeur: '620-1023', prefixe: 'html[data-support="site"]', min: 620,  max: 1023 },
  { id: 'site-ordinateur', support: 'site', largeur: '1024-',    prefixe: 'html[data-support="site"]', min: 1024, max: Infinity },
];

const ENTETE = /\/\* DEBUT-ZONE (\S+) \| support=(\S+) \| largeur=(\S+) \| prefixe=(.+?) \*\//g;

/** Retire les commentaires : un commentaire n'est pas une règle. */
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Les blocs de PREMIER niveau d'un morceau de CSS, avec leur tête.
 *  Les niveaux plus profonds sont rendus tels quels dans `corps`. */
function blocs(css) {
  const trouves = [];
  let niveau = 0;
  let debutTete = 0;
  let debutCorps = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === ';' && niveau === 0) debutTete = i + 1;
    else if (c === '{') {
      if (niveau === 0) { debutCorps = i + 1; trouves.push({ tete: css.slice(debutTete, i).trim(), corps: '' }); }
      niveau++;
      debutTete = i + 1;
    } else if (c === '}') {
      niveau--;
      if (niveau === 0) trouves[trouves.length - 1].corps = css.slice(debutCorps, i);
      debutTete = i + 1;
    }
  }
  return trouves;
}

/** Le texte compris entre DEBUT-ZONE <id> et FIN-ZONE <id>. */
function zone(feuille, id) {
  const debut = feuille.texte.indexOf(`DEBUT-ZONE ${id} |`);
  assert.ok(debut > 0, `la zone « ${id} » n'a pas de DEBUT-ZONE dans ${feuille.nom}`);
  const apres = feuille.texte.indexOf('*/', debut) + 2;
  const fin = feuille.texte.indexOf(`/* FIN-ZONE ${id} */`, apres);
  assert.ok(fin > apres, `la zone « ${id} » n'a pas de FIN-ZONE dans ${feuille.nom}`);
  return sansCommentaires(feuille.texte.slice(apres, fin)).trim();
}

const APP = { nom: 'app.css', texte: lire('app.css') };

test('la marque du support est posée en tête de page, avant la feuille de style', () => {
  const html = lire('index.html');
  const marque = html.indexOf('dataset.support');
  assert.ok(marque > 0, 'index.html doit poser document.documentElement.dataset.support');
  assert.ok(marque < html.indexOf('DEBUT-FEUILLE-EN-LIGNE'),
    'la marque doit être posée AVANT la feuille de style, sinon la page se redessine');
  assert.match(html.slice(marque - 400, marque + 200), /appassets\.androidplatform\.net/,
    'la marque doit venir de l’hôte du WebView : c’est l’application qui se déclare');
  assert.match(html.slice(marque - 400, marque + 200), /<script>[\s\S]*dataset\.support/,
    'la marque doit être posée par un script EN CLAIR, exécuté pendant la lecture');
});

test('app.js relit la marque au lieu de refaire sa propre détection', () => {
  const js = lire('app.js');
  assert.match(js, /const DANS_APK = document\.documentElement\.dataset\.support === 'app'/,
    'app.js doit lire la marque de la page');
  assert.ok(!/DANS_APK = location\.hostname/.test(js),
    'deux détections séparées finiraient par diverger : la page se croirait « site » dans l’app');
});

test('les cinq zones existent, avec l’identité et la largeur de la table de référence', () => {
  const trouves = [...APP.texte.matchAll(ENTETE)].map((m) => ({
    id: m[1], support: m[2], largeur: m[3], prefixe: m[4].trim(),
  }));
  assert.equal(trouves.length, 5, `cinq zones attendues dans app.css, ${trouves.length} trouvée(s)`);
  for (const attendu of SUPPORTS) {
    const vu = trouves.find((t) => t.id === attendu.id);
    assert.ok(vu, `zone « ${attendu.id} » absente de app.css`);
    assert.equal(vu.support, attendu.support, `zone « ${attendu.id} » : famille`);
    assert.equal(vu.largeur, attendu.largeur, `zone « ${attendu.id} » : largeur`);
    assert.equal(vu.prefixe, attendu.prefixe, `zone « ${attendu.id} » : préfixe`);
    // et la borne de la zone ne peut pas être un simple préfixe de chaîne :
    assert.ok(vu.largeur === attendu.largeur);
  }
});

test('les zones viennent APRÈS tout le reste de la feuille', () => {
  const premier = APP.texte.indexOf('DEBUT-ZONE');
  assert.ok(premier > APP.texte.length / 2,
    'les zones doivent être en fin de feuille : à spécificité égale, c’est l’ordre qui tranche');
  const dernier = APP.texte.lastIndexOf('FIN-ZONE');
  const finCommentaire = APP.texte.indexOf('*/', dernier) + 2;
  const reste = sansCommentaires(APP.texte.slice(finCommentaire)).trim();
  assert.equal(reste, '', 'rien ne doit être écrit après la dernière zone (règles ou paliers)');
});

test('chaque règle d’une zone commence par le préfixe de sa zone', () => {
  for (const s of SUPPORTS) {
    const texte = zone(APP, s.id);
    if (!texte) continue;
    for (const palier of blocs(texte)) {
      assert.match(palier.tete, /^@media\b/,
        `zone « ${s.id} » : « ${palier.tete.slice(0, 50)} » n’est pas dans un palier @media`);
      for (const regle of blocs(palier.corps)) {
        for (const sel of regle.tete.split(',')) {
          assert.ok(sel.trim().startsWith(s.prefixe),
            `zone « ${s.id} » : le sélecteur « ${sel.trim().slice(0, 60)} » sort de sa zone — `
            + `il doit commencer par ${s.prefixe}`);
        }
      }
    }
  }
});

test('chaque palier d’une zone tient DANS la largeur de sa zone', () => {
  for (const s of SUPPORTS) {
    const texte = zone(APP, s.id);
    if (!texte) continue;
    for (const palier of blocs(texte)) {
      const mini = /min-width:\s*(\d+)px/.exec(palier.tete);
      const maxi = /max-width:\s*([\d.]+)px/.exec(palier.tete);
      const bas = mini ? Number(mini[1]) : 0;
      const haut = maxi ? Number(maxi[1]) : Infinity;
      assert.ok(bas >= s.min && haut <= s.max,
        `zone « ${s.id} » (${s.largeur}) : le palier « ${palier.tete} » déborde — `
        + 'il atteindrait un autre support');
    }
  }
});

test('aucune zone n’emploie !important', () => {
  for (const s of SUPPORTS) {
    assert.ok(!/!important/.test(zone(APP, s.id)),
      `zone « ${s.id} » : un !important empêcherait la retouche suivante de passer`);
  }
});
