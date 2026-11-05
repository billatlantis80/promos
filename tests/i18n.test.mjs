/**
 * MULTILINGUE — la langue est une préférence d'UTILISATEUR, jamais du pays.
 *
 * Demande de B : « je ne vois pas la partie traductions apparaître dans
 * l'application au niveau des paramètres du profil, est-ce que ça a été
 * finalisé ? » Non — et c'était mesurable : le moteur existait, aucun sélecteur
 * n'était branché. Ces tests tiennent les trois choses qui peuvent se casser en
 * silence : une clé qui manque dans une langue, une traduction qui reste en
 * français par accident, et un choix de langue qui se met à toucher au pays.
 *
 * Lancement : node --test tests/i18n.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUES, t, definirLangue, chargerLangue, interpole, traduireDOM,
  languesDisponibles, LANGUE_DEFAUT, CLE_LANGUE, normaliseCle,
} from '../public/langues.js';

const CODES = ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv'];
const cles = (c) => Object.keys(LANGUES[c].textes).sort();

test('les neuf langues existent et ont EXACTEMENT le même jeu de clés', () => {
  assert.deepEqual(Object.keys(LANGUES).sort(), [...CODES].sort());
  const ref = cles('fr');
  assert.ok(ref.length > 150, `jeu de clés trop maigre : ${ref.length}`);
  const ecarts = [];
  for (const c of CODES) {
    const k = cles(c);
    const manquantes = ref.filter((x) => !k.includes(x));
    const enTrop = k.filter((x) => !ref.includes(x));
    if (manquantes.length || enTrop.length) {
      ecarts.push(`${c} : ${manquantes.length} manquante(s) [${manquantes.slice(0, 3).join(' | ')}], ${enTrop.length} en trop`);
    }
  }
  assert.deepEqual(ecarts, [], `dictionnaires désaccordés :\n  ${ecarts.join('\n  ')}`);
  console.log(`  ${ref.length} clés × ${CODES.length} langues — jeux identiques`);
});

test('aucune valeur vide ni remplacée par un tiret', () => {
  const vides = [];
  for (const c of CODES) {
    for (const [k, v] of Object.entries(LANGUES[c].textes)) {
      if (typeof v !== 'string' || !v.trim() || v.trim() === '—') vides.push(`${c} « ${k} »`);
    }
  }
  assert.deepEqual(vides, [], `valeurs vides : ${vides.join(', ')}`);
});

test('chaque langue TRADUIT vraiment — mesure des restes en français', () => {
  // Un dictionnaire où les valeurs restent françaises passe tous les autres
  // tests. On mesure donc le taux d'identité au français, et on NOMME les clés
  // concernées : les noms de pays et les mots identiques dans deux langues
  // (Sport, Portugal, Hamburg…) sont des faux positifs légitimes.
  const fr = LANGUES.fr.textes;
  const rapport = [];
  for (const c of CODES.filter((x) => x !== 'fr')) {
    const d = LANGUES[c].textes;
    const identiques = Object.keys(fr).filter((k) => d[k] === fr[k]);
    const taux = Math.round((identiques.length / Object.keys(fr).length) * 100);
    rapport.push({ langue: c, taux, identiques });
  }
  for (const r of rapport) {
    console.log(`  ${r.langue} : ${r.taux} % de libellés identiques au français (${r.identiques.length})`);
    if (r.taux > 5) console.log(`     ex. ${r.identiques.slice(0, 6).join(' | ')}`);
  }
  const trop = rapport.filter((r) => r.taux > 25);
  assert.deepEqual(trop.map((r) => `${r.langue} ${r.taux} %`), [],
    `langues trop proches du français (dictionnaire non traduit ?) : ${trop.map((r) => r.langue).join(', ')}`);
});

test('les mots-clés de l’interface sont traduits dans chaque langue', () => {
  const attendus = {
    nl: { 'Tout': 'Alles' },
    de: { 'Tout': 'Alle', 'Électroménager': 'Haushaltsgeräte', 'Acheter sur Amazon': 'Bei Amazon kaufen' },
    en: { 'Électroménager': 'Home appliances' },
    es: { 'Électroménager': 'Electrodomésticos' },
  };
  for (const [code, paires] of Object.entries(attendus)) {
    definirLangue(code);
    for (const [fr, attendu] of Object.entries(paires)) {
      assert.equal(t(fr), attendu, `[${code}] « ${fr} » → attendu « ${attendu} », obtenu « ${t(fr)} »`);
    }
  }
  definirLangue('fr');
});

test('l’apostrophe courbe et l’apostrophe droite mènent à la même clé', () => {
  // Défaut mesuré : le code écrit « Lire l’article » (courbe), le dictionnaire
  // garde la droite — la clé n'était pas trouvée et le bouton restait français,
  // sans aucune erreur. Les deux écritures doivent donner la traduction.
  assert.equal(normaliseCle('Lire l\u2019article'), "Lire l'article");
  definirLangue('de');
  const courbe = t('Lire l\u2019article');
  const droite = t("Lire l'article");
  assert.equal(courbe, droite, 'les deux apostrophes doivent donner la même traduction');
  assert.notEqual(courbe, 'Lire l\u2019article', 'le libellé doit être traduit, pas rendu tel quel');
  definirLangue('fr');
});

test('t() interpole {n} et rend la clé telle quelle si elle n’existe pas', () => {
  definirLangue('nl');
  assert.match(t('Voir chez {n}', { n: 'Coolblue' }), /Coolblue/);
  assert.equal(interpole('a {x} b', { x: 7 }), 'a 7 b');
  assert.equal(t('clé qui n’existe pas'), 'clé qui n’existe pas');
  definirLangue('fr');
});

test('le libellé « Acheter sur {site} » est TRADUIT, site compris', () => {
  // Défaut mesuré : la clé avait été écrite « Acheter sur {{site}} » (double
  // accolade). La recherche ne trouvait rien, et t() rend la clé TELLE QUELLE —
  // c'est-à-dire du français. Le bouton paraissait donc JUSTE en français tout
  // en restant français dans les neuf langues, sans la moindre erreur.
  // Aucun autre test ne pouvait le voir : les neuf dictionnaires portaient la
  // MÊME clé (parité respectée) et aucune valeur n'était vide. C'est donc la
  // valeur RENDUE qu'il faut comparer, langue par langue.
  const attendu = {
    fr: 'Acheter sur Amazon.fr',
    nl: 'Kopen bij Amazon.fr',
    de: 'Bei Amazon.fr kaufen',
    en: 'Buy on Amazon.fr',
    es: 'Comprar en Amazon.fr',
    it: 'Acquista su Amazon.fr',
    pt: 'Comprar na Amazon.fr',
    pl: 'Kup w Amazon.fr',
    sv: 'Köp hos Amazon.fr',
  };
  for (const [code, texte] of Object.entries(attendu)) {
    definirLangue(code);
    const rendu = t('Acheter sur {site}', { site: 'Amazon.fr' });
    assert.equal(rendu, texte, `[${code}] obtenu « ${rendu} »`);
  }
  definirLangue('fr');
});

test('le choix de langue NE TOUCHE PAS au pays — deux clés distinctes', () => {
  // Indépendance imposée par B : « changer de pays ne change jamais la langue ;
  // changer de langue ne change jamais le pays ». On le vérifie sur le stockage :
  // definirLangue n'écrit QUE la clé de langue.
  const memo = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memo.has(k) ? memo.get(k) : null),
    setItem: (k, v) => memo.set(k, String(v)),
    removeItem: (k) => memo.delete(k),
    get length() { return memo.size; },
  };
  memo.set('promos.pays', 'BE');
  definirLangue('de');
  assert.equal(memo.get('promos.langue'), 'de', 'la langue doit être mémorisée');
  assert.equal(memo.get('promos.pays'), 'BE', 'le pays ne doit pas avoir bougé');
  assert.equal(memo.size, 2, `aucune autre clé ne doit être écrite : ${[...memo.keys()].join(', ')}`);
  assert.equal(chargerLangue(), 'de', 'la langue mémorisée doit être relue au démarrage');
  delete globalThis.localStorage;
});

test('le module expose de quoi peupler le sélecteur et traduire la page', () => {
  const dispo = languesDisponibles();
  assert.equal(dispo.length, 9);
  for (const l of dispo) {
    assert.ok(l.code && l.nom, `langue incomplète : ${JSON.stringify(l)}`);
    assert.ok(CODES.includes(l.code));
  }
  assert.equal(LANGUE_DEFAUT, 'fr');
  assert.equal(CLE_LANGUE, 'promos.langue');
  assert.equal(typeof traduireDOM, 'function');
  assert.equal(traduireDOM(null), 0, 'sans document, traduireDOM ne casse rien');
});
