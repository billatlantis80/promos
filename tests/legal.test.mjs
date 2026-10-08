/**
 * LA PARTIE ADMINISTRATIVE — application n°2 « Promos ».
 *
 * Demande de B (08/10/2026) : « Il faut aussi faire toute la partie
 * administrative pour officialiser le site. »
 *
 * Constat qui a lancé ce travail : AUCUNE page légale n'existait. Mesuré sur le
 * site publié — `mentions-legales.html`, `confidentialite.html`, `cookies.html`,
 * `cgu.html`, `robots.txt` et `sitemap.xml` répondaient tous 404.
 *
 * Les quatre pages existent en TROIS langues (français, néerlandais, anglais),
 * à la demande de B : « Tu peux faire la traduction en anglais et en
 * néerlandais. » Les six autres langues de l'interface mènent à l'anglais —
 * c'est la règle de repli déjà appliquée aux liens sortants.
 *
 * Ces épreuves protègent quatre choses, et les deux dernières comptent autant
 * que les premières :
 *   1. les pages existent dans les trois langues, sont atteignables depuis le
 *      pied de page, et restent lisibles même si les feuilles de style
 *      externes sont coupées en chemin ;
 *   2. chaque langue porte les rubriques que la loi belge et le RGPD exigent —
 *      la MÊME structure, section par section ;
 *   3. RIEN N'EST INVENTÉ. L'identité de l'éditeur, son numéro d'entreprise et
 *      son adresse de contact ne sont pas connus : ils sont signalés comme
 *      « à compléter », jamais remplis par une valeur plausible. L'épreuve
 *      refuse l'apparition d'un numéro BCE ou d'une adresse e-mail qui ne
 *      serait pas dans une marque « à compléter ». C'est la règle du projet :
 *      on n'écrit pas un chiffre qu'on ne peut pas prouver.
 *   4. aucune page ne RACONTE UN MENSONGE. Une phrase affirmait que « les
 *      autres versions linguistiques du site n'ont pas encore été publiées » ;
 *      elle était vraie un jour, elle ne l'est plus.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');
const PUBLIC = join(RACINE, 'public');
const lire = (nom) => readFileSync(join(PUBLIC, nom), 'utf8');
const existe = (nom) => existsSync(join(PUBLIC, nom));

/* ---------------------------------------------------------------- l'inventaire */

const BASES = ['mentions-legales', 'confidentialite', 'cookies', 'cgu'];
const LANGUES = ['fr', 'nl', 'en'];
const suffixe = (l) => (l === 'fr' ? '' : `.${l}`);
const fichier = (base, l) => `${base}${suffixe(l)}.html`;
/** Les 12 pages — les quatre sujets, dans les trois langues. */
const PAGES = BASES.flatMap((b) => LANGUES.map((l) => fichier(b, l)));

const INDEX = lire('index.html');
const APP = lire('app.js');

/** Retire les marques « à compléter » : ce qui reste est ce qui est AFFIRMÉ. */
const sansTrous = (html) => html.replace(/<span class="a-completer">[\s\S]*?<\/span>/g, '');

/** Le TEXTE du document, balises retirées. Les phrases légales traversent des
 *  <b> et des <a> ; les chercher dans le balisage brut ferait échouer une phrase
 *  simplement parce qu'un mot est mis en gras au milieu. */
const texteNu = (html) => sansTrous(html)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');

/* ============================================================ 1. existence */

test('les douze pages administratives existent, dans les trois langues', () => {
  assert.equal(PAGES.length, 12);
  for (const p of PAGES) {
    assert.ok(existe(p), `public/${p} doit exister`);
    const html = lire(p);
    assert.match(html, /^<!DOCTYPE html>/i, `${p} : déclaration de document attendue`);
    assert.ok(html.includes('</html>'), `${p} : document tronqué`);
  }
});

test('chaque page déclare SA langue, dans <html lang> et dans les liens', () => {
  for (const base of BASES) {
    for (const l of LANGUES) {
      const p = fichier(base, l);
      const html = lire(p);
      assert.match(html, new RegExp(`<html lang="${l}">`), `${p} : <html lang="${l}"> attendu`);
      assert.match(html, /<title>[^<]+ — Kazendra<\/title>/, `${p} : titre attendu`);
    }
  }
});

test('le pied de page du site mène aux quatre pages', () => {
  const debut = INDEX.indexOf('<footer');
  const pied = INDEX.slice(debut, INDEX.indexOf('</footer>', debut));
  assert.ok(debut > 0 && pied.length > 0, 'un pied de page doit exister');
  const nav = (pied.match(/<nav class="liens-legaux"[\s\S]*?<\/nav>/) || [''])[0];
  assert.ok(nav, 'les liens doivent vivre DANS le pied de page');
  for (const b of BASES) {
    assert.ok(nav.includes(`href="${fichier(b, 'fr')}"`),
      `le pied de page doit pointer vers ${fichier(b, 'fr')} (le défaut, sans JavaScript)`);
  }
});

test('le pied de page SUIT la langue choisie (sinon il mentirait)', () => {
  // Les pages existent en trois langues : un lecteur néerlandais doit arriver
  // sur la page néerlandaise, pas sur la française.
  assert.match(APP, /const INTITULES_LEGAUX = \{[\s\S]*?fr:[\s\S]*?nl:[\s\S]*?en:/,
    'les trois langues doivent avoir leurs intitulés');
  assert.match(APP, /INTITULES_LEGAUX\[langue\(\)\] \? langue\(\) : 'en'/,
    'les six autres langues doivent mener à l’anglais — la règle de repli du site');
  assert.match(APP, /function dessinerLiensLegaux\(\)/, 'la fonction de dessin doit exister');
  const appels = (APP.match(/dessinerLiensLegaux\(\)/g) || []).length;
  assert.ok(appels >= 3,
    `elle doit être définie ET appelée au démarrage ET au changement de langue — ${appels} occurrence(s)`);
  assert.match(INDEX, /<nav class="liens-legaux" id="liensLegaux"/,
    'le pied de page doit être repérable par le programme');
});

test('le sélecteur de langue existe et marque la page courante', () => {
  for (const base of BASES) {
    for (const l of LANGUES) {
      const p = fichier(base, l);
      const html = lire(p);
      const nav = (html.match(/<nav class="langues-doc"[\s\S]*?<\/nav>/) || [''])[0];
      assert.ok(nav, `${p} : le sélecteur de langue doit exister`);
      for (const autre of LANGUES) {
        assert.ok(nav.includes(`href="${fichier(base, autre)}"`),
          `${p} : le sélecteur doit mener à la version « ${autre} »`);
      }
      // UNE seule page courante marquée — et c'est la bonne.
      const courantes = [...nav.matchAll(/<a href="([^"]+)"[^>]*aria-current="page"/g)].map((m) => m[1]);
      assert.deepEqual(courantes, [fichier(base, l)],
        `${p} : la seule page marquée « courante » doit être elle-même`);
    }
  }
});

test('les trois langues ont EXACTEMENT la même structure', () => {
  // Une section perdue dans une traduction est un manque invisible : la page a
  // toujours l'air complète. On compte les titres de niveau 2 — ils portent la
  // structure légale.
  for (const base of BASES) {
    const comptes = LANGUES.map((l) => (lire(fichier(base, l)).match(/<h2>/g) || []).length);
    assert.ok(comptes[0] > 0, `${base} : des titres <h2> sont attendus`);
    assert.deepEqual(comptes, [comptes[0], comptes[0], comptes[0]],
      `${base} : le nombre de sections doit être identique en fr/nl/en — trouvé ${comptes.join(' / ')}`);
  }
});

test('AUCUNE page administrative n’est oubliée', () => {
  const surDisque = readdirSync(PUBLIC)
    .filter((f) => /^(mentions-legales|confidentialite|cookies|cgu)(\.(nl|en))?\.html$/.test(f));
  assert.deepEqual(surDisque.sort(), [...PAGES].sort(),
    'une page administrative présente dans public/ doit être tenue par ces épreuves');
});

/* ============================================ 2. lisibles sans .css externe */

test('aucune page administrative n’appelle de feuille de style externe', () => {
  for (const p of PAGES) {
    const liens = lire(p).match(/<link[^>]+stylesheet/gi) || [];
    assert.deepEqual(liens, [],
      `${p} : aucun <link rel="stylesheet"> ne doit subsister — c’est ce que le filtre du PC de B coupait`);
  }
});

test('le contenu de legal.css est repris dans chaque page AU CARACTÈRE PRÈS', () => {
  const css = lire('legal.css').trimEnd();
  assert.ok(css.length > 3000, 'garde-fou : legal.css doit être lu en entier');
  for (const p of PAGES) {
    assert.ok(lire(p).includes(css),
      `${p} : legal.css a changé sans que l’outil soit relancé — écrire « node bin/inliner-legal.mjs »`);
  }
});

test('chaque page désigne les autres langues aux moteurs (hreflang)', () => {
  // Sans cela, les trois versions seraient traitées comme trois pages
  // concurrentes qui se diluent l'une l'autre dans les résultats de recherche.
  for (const base of BASES) {
    for (const l of LANGUES) {
      const html = lire(fichier(base, l));
      for (const autre of LANGUES) {
        assert.ok(html.includes(`hreflang="${autre}"`),
          `${fichier(base, l)} : hreflang="${autre}" attendu`);
      }
      assert.ok(html.includes('hreflang="x-default"'), `${fichier(base, l)} : x-default attendu`);
    }
  }
});

/* ==================================== 3. les rubriques exigées, par langue */

/** Ce que chaque page doit DIRE, dans chaque langue. Les motifs sont ceux du
 *  texte réellement écrit : une épreuve qui chercherait une traduction
 *  littérale imaginaire échouerait sur du texte juste. */
const ATTENDUS = {
  'mentions-legales': {
    fr: [/Éditeur du site/i, /Numéro d.entreprise \(BCE\)/i, /Hébergement/i, /GitHub, Inc\./i,
      /personne physique/i, /non assujetti/i, /franchise de la petite entreprise/i, /droit belge/i],
    nl: [/Uitgever van de site/i, /ondernemingsnummer/i, /Hosting/i, /GitHub, Inc\./i,
      /natuurlijke persoon/i, /btw/i, /kleine ondernemingen/i, /Belgische recht/i],
    en: [/Publisher of the site/i, /company number/i, /Hosting/i, /GitHub, Inc\./i,
      /natural person/i, /VAT/i, /small business/i, /Belgian law/i],
  },
  confidentialite: {
    fr: [/Responsable du traitement/i, /Base légale/i, /Autorité\s+de protection des données/i,
      /aucun cookie/i, /hors de l.Union/i],
    nl: [/verwerkingsverantwoordelijke/i, /Rechtsgrond/i, /Gegevensbeschermingsautoriteit/i,
      /geen enkele cookie/i, /buiten de Europese Unie/i],
    en: [/data controller/i, /Legal basis/i, /Belgian Data Protection/i,
      /no cookies?/i, /outside the European Union/i],
  },
  cookies: {
    fr: [/ne pose aucun cookie/i, /stockage local/i, /bannière/i],
    nl: [/geen enkele cookie/i, /lokale opslag/i, /geen banner/i],
    en: [/no cookies?/i, /local storage/i, /no banner/i],
  },
  cgu: {
    fr: [/n.est pas un vendeur/i, /fait foi/i, /droit belge/i],
    nl: [/verkoper/i, /geldt/i, /Belgische recht/i],
    en: [/seller/i, /prevail/i, /Belgian law/i],
  },
};

test('chaque page porte les rubriques exigées, dans SA langue', () => {
  for (const [base, parLangue] of Object.entries(ATTENDUS)) {
    for (const l of LANGUES) {
      const p = fichier(base, l);
      const texte = texteNu(lire(p));
      for (const motif of parLangue[l]) {
        assert.match(texte, motif,
          `${p} : la rubrique « ${motif.source} » doit être présente (même structure dans les trois langues)`);
      }
    }
  }
});

test('la forme juridique TRANCHÉE est écrite dans les trois langues', () => {
  // Décision de B, 08/10/2026 : « régime fiscal de petite entreprise en personne
  // physique ». Elle doit être DANS la page, pas seulement dans la fiche : c'est
  // la page que lisent le public et l'administration.
  const parLangue = {
    fr: [/personne physique/i, /non assujetti/i, /franchise de la petite entreprise/i],
    nl: [/natuurlijke persoon/i, /btw/i, /kleine ondernemingen/i],
    en: [/natural person/i, /VAT/i, /small business/i],
  };
  for (const l of LANGUES) {
    const texte = texteNu(lire(fichier('mentions-legales', l)));
    for (const motif of parLangue[l]) {
      assert.match(texte, motif, `mentions-legales${suffixe(l)}.html : « ${motif.source} » attendu`);
    }
    // L'ancienne formulation, qui proposait encore plusieurs formes, a disparu.
    assert.doesNotMatch(texte, /raison sociale|rechtsvorm: \(personne|legal form: \(/i,
      `mentions-legales${suffixe(l)}.html : la forme n’est plus à choisir, elle est tranchée`);
  }
});

test('le numéro BCE reste EXIGÉ dans les trois langues, malgré la franchise de TVA', () => {
  // Piège réel, et c'est le genre qu'on ne voit pas : la franchise de la petite
  // entreprise dispense de la TVA, PAS de l'immatriculation. Une page qui ne
  // demanderait plus le numéro d'entreprise laisserait croire l'inverse.
  const parLangue = {
    fr: /Numéro d.entreprise \(BCE\)/i,
    nl: /ondernemingsnummer/i,
    en: /company number/i,
  };
  for (const l of LANGUES) {
    assert.match(texteNu(lire(fichier('mentions-legales', l))), parLangue[l],
      `mentions-legales${suffixe(l)}.html : le numéro d’entreprise reste exigé`);
  }
  const fiche = readFileSync(join(RACINE, 'FICHE-ADMINISTRATIVE.md'), 'utf8');
  assert.match(fiche, /BCE[\s\S]{0,500}(obligatoire|pas de l.immatriculation)/i,
    'la fiche doit dire que la franchise ne dispense PAS de l’immatriculation');
});

/* ================================ 4. RIEN N'EST INVENTÉ (la règle du projet) */

test('les champs qui manquent sont SIGNALÉS comme tels, dans chaque langue', () => {
  for (const l of LANGUES) {
    for (const base of ['mentions-legales', 'confidentialite']) {
      const p = fichier(base, l);
      const trous = (lire(p).match(/class="a-completer"/g) || []).length;
      assert.ok(trous >= 3,
        `${p} : l’identité de l’éditeur n’est pas connue — ${trous} marque(s) « à compléter », trop peu pour être honnête`);
    }
  }
  // Et chaque page doit DIRE qu'elle n'est pas définitive.
  assert.match(lire('mentions-legales.html'), /n.est pas encore définitive/i,
    'la page française doit prévenir qu’elle ne l’est pas');
});

test('aucune identité inventée : pas de numéro BCE ni d’adresse e-mail hors des trous', () => {
  for (const p of PAGES) {
    const texte = sansTrous(lire(p));
    assert.doesNotMatch(texte, /\b\d{4}\.\d{3}\.\d{3}\b/,
      `${p} : un numéro BCE ne doit pas être INVENTÉ — il doit rester un champ à compléter`);
    const courriels = texte.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi) || [];
    assert.deepEqual(courriels, [],
      `${p} : aucune adresse e-mail ne doit être inventée, trouvée : ${courriels.join(', ')}`);
  }
});

test('les seuls domaines cités sont ceux qui existent réellement', () => {
  // On ne cite pas un tiers qu'on n'a pas vérifié. La liste est courte et
  // volontairement limitée à ce qui a été lu : hébergeur, registraire, autorité.
  // Chacun a été appelé et a répondu 200 le 08/10/2026.
  const autorises = new Set([
    'github.com', 'www.ovhcloud.com', 'www.mediationconsommateur.be',
    'www.autoriteprotectiondonnees.be', 'kazendra.com',
  ]);
  for (const p of PAGES) {
    const texte = sansTrous(lire(p));
    for (const m of texte.matchAll(/https?:\/\/([^/"'\s]+)/g)) {
      const hote = m[1].replace(/\/$/, '');
      assert.ok(autorises.has(hote), `${p} : domaine non vérifié cité → ${hote}`);
    }
  }
});

test('aucune page ne prétend que les autres langues n’existent pas', () => {
  // Une phrase affirmait : « les autres versions linguistiques du site n'ont pas
  // encore été publiées. » Elle était vraie le 08/10/2026 au matin ; depuis la
  // traduction, elle serait un mensonge — et les mensonges se recopient d'une
  // version à l'autre.
  for (const p of PAGES) {
    assert.doesNotMatch(texteNu(lire(p)),
      /(n.ont pas encore été publiées|nog niet zijn gepubliceerd|have not yet been published)/i,
      `${p} : les versions française, néerlandaise et anglaise existent désormais`);
  }
});

test('les conditions d’utilisation disent que le site n’est PAS le vendeur', () => {
  for (const l of LANGUES) {
    const texte = texteNu(lire(fichier('cgu', l)));
    assert.match(texte, /vendeur|verkoper|seller/i,
      `cgu${suffixe(l)}.html : le site ne vend pas — cela doit être écrit`);
  }
});

/* ================================================ 5. plan de site et robots */

test('robots.txt existe, interdit /admin/ et cite le plan du site', () => {
  assert.ok(existe('robots.txt'), 'robots.txt doit exister (il répondait 404)');
  const txt = lire('robots.txt');
  assert.match(txt, /^User-agent: \*/m, 'la règle générale doit exister');
  assert.match(txt, /^Disallow: \/admin\/$/m, 'le panneau d’administration doit rester hors des moteurs');
  assert.match(txt, /^Sitemap: https:\/\/kazendra\.com\/sitemap\.xml$/m,
    'le plan du site doit être déclaré à son adresse exacte');
});

test('sitemap.xml existe, est bien formé, et ne liste que des pages réelles', () => {
  assert.ok(existe('sitemap.xml'), 'sitemap.xml doit exister (il répondait 404)');
  const xml = lire('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/, 'déclaration XML attendue');
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/, 'espace de noms attendu');
  assert.equal((xml.match(/<url>/g) || []).length, (xml.match(/<\/url>/g) || []).length, 'balises <url> équilibrées');

  const adresses = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(adresses.length >= 13, `le plan doit lister les pages des trois langues, trouvé ${adresses.length}`);

  for (const url of adresses) {
    assert.ok(url.startsWith('https://kazendra.com/'),
      `le plan ne doit lister que le site : ${url}`);
    const chemin = url.replace('https://kazendra.com/', '') || 'index.html';
    const f = chemin.endsWith('/') ? chemin + 'index.html' : chemin;
    assert.ok(existe(f),
      `le plan annonce ${url}, mais public/${f} n’existe pas — un plan qui ment fait perdre du temps aux moteurs`);
  }
  // Les douze pages administratives doivent TOUTES y figurer.
  for (const p of PAGES) {
    assert.ok(adresses.includes(`https://kazendra.com/${p}`),
      `le plan doit lister public/${p}`);
  }
});
