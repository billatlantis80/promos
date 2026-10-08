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
 * Ces épreuves protègent trois choses, et la troisième compte autant que les
 * deux autres :
 *   1. les pages existent, sont atteignables depuis le pied de page, et restent
 *      lisibles même si les feuilles de style externes sont coupées en chemin ;
 *   2. elles portent les rubriques que la loi belge et le RGPD exigent ;
 *   3. RIEN N'EST INVENTÉ. L'identité de l'éditeur, son numéro d'entreprise et
 *      son adresse de contact ne sont pas connus : ils sont signalés comme
 *      « à compléter », jamais remplis par une valeur plausible. Le test refuse
 *      l'apparition d'un numéro BCE ou d'une adresse e-mail qui ne serait pas
 *      dans une marque « à compléter ». C'est la règle du projet : on n'écrit
 *      pas un chiffre qu'on ne peut pas prouver.
 *
 * Lancement : node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ICI, '..', 'public');
const lire = (nom) => readFileSync(join(PUBLIC, nom), 'utf8');
const existe = (nom) => existsSync(join(PUBLIC, nom));

const PAGES = ['mentions-legales.html', 'confidentialite.html', 'cookies.html', 'cgu.html'];

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

test('les quatre pages administratives existent et sont des documents HTML', () => {
  for (const p of PAGES) {
    assert.ok(existe(p), `${p} doit exister`);
    const html = lire(p);
    assert.match(html, /^<!DOCTYPE html>/i, `${p} doit être un document HTML complet`);
    assert.match(html, /<html lang="fr">/, `${p} doit déclarer la langue (le texte est en français)`);
    assert.match(html, /<meta name="viewport"/, `${p} doit être lisible sur téléphone`);
    assert.match(html, /<title>[^<]{5,}<\/title>/, `${p} doit porter un titre`);
    assert.match(html, /<a class="retour" href="index\.html">/, `${p} doit offrir le retour au site`);
  }
});

test('le pied de page du site mène aux quatre pages', () => {
  const html = lire('index.html');
  const nav = (html.match(/<nav class="liens-legaux"[\s\S]*?<\/nav>/) || [''])[0];
  assert.ok(nav, 'un bloc de liens légaux doit exister dans le pied de page');
  for (const p of PAGES) {
    assert.ok(nav.includes(`href="${p}"`), `le pied de page doit pointer vers ${p}`);
  }
  // Une mention qu'on ne trouve pas ne remplit pas son office : le pied de page
  // est l'endroit attendu, pas une page orpheline. On cherche le BALISAGE, pas
  // le mot : « liens-legaux » apparaît aussi dans la feuille de style en ligne,
  // tout en haut du document.
  assert.ok(html.indexOf('<nav class="liens-legaux"') > html.indexOf('<footer'),
    'les liens doivent vivre DANS le pied de page');
});

/* ============================================ 2. lisibles sans .css externe */

test('aucune page administrative n’appelle de feuille de style externe', () => {
  for (const p of [...PAGES, 'index.html']) {
    const html = lire(p);
    const liens = html.match(/<link[^>]+rel="stylesheet"/gi) || [];
    assert.deepEqual(liens, [],
      `${p} : la feuille doit être EN LIGNE — sur le PC de B, les .css externes étaient coupés en chemin`);
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

/* ================================================= 3. ce que la loi exige */

test('les mentions légales portent les rubriques exigées', () => {
  const html = lire('mentions-legales.html');
  const texte = texteNu(html);
  for (const [motif, quoi] of [
    [/Éditeur du site/i, 'identification de l’éditeur'],
    [/Numéro d.entreprise \(BCE\)/i, 'numéro d’entreprise (obligatoire en Belgique)'],
    [/Responsable de la publication/i, 'responsable de la publication'],
    [/Hébergement/i, 'identification de l’hébergeur'],
    [/GitHub, Inc\./i, 'hébergeur nommé (GitHub Pages)'],
    [/OVH SAS/i, 'bureau d’enregistrement des noms de domaine'],
    [/Propriété intellectuelle/i, 'propriété intellectuelle'],
    [/Liens vers les marchands et transparence sur l’affiliation/i, 'transparence sur l’affiliation'],
    [/droit belge/i, 'droit applicable'],
    [/Service de médiation pour le consommateur/i, 'voie de règlement des litiges'],
  ]) {
    assert.match(texte, motif, `les mentions légales doivent traiter : ${quoi}`);
  }
});

test('la politique de confidentialité porte les rubriques du RGPD', () => {
  const html = lire('confidentialite.html');
  const texte = texteNu(html);
  for (const [motif, quoi] of [
    [/Responsable du traitement/i, 'responsable du traitement'],
    [/Base légale/i, 'base légale des traitements'],
    [/Vos droits/i, 'droits des personnes'],
    [/portabilité/i, 'droit à la portabilité'],
    [/Autorité\s+de protection des données/i, 'autorité de contrôle (APD)'],
    [/hors de l.Union/i, 'transfert hors Union européenne (hébergement américain)'],
    [/aucun cookie/i, 'affirmation vérifiable sur les cookies'],
  ]) {
    assert.match(texte, motif, `la politique de confidentialité doit traiter : ${quoi}`);
  }
});

test('la page cookies explique la mémoire locale sans cookie', () => {
  const texte = texteNu(lire('cookies.html'));
  assert.match(texte, /ne pose aucun cookie/i, 'l’absence de cookie doit être dite');
  assert.match(texte, /stockage local/i, 'le stockage local doit être expliqué');
  assert.match(texte, /bannière/i, 'la raison de l’absence de bannière doit être donnée');
});

test('les conditions d’utilisation disent que le site n’est PAS le vendeur', () => {
  const texte = texteNu(lire('cgu.html'));
  assert.match(texte, /n.est pas un vendeur/i, 'le site ne vend pas : cela doit être écrit');
  assert.match(texte, /fait foi/i, 'la primauté du prix affiché chez le marchand doit être écrite');
  assert.match(texte, /droit belge/i, 'droit applicable');
});

/* ------------------------------- la forme juridique, une fois tranchée (08/10) */

test('la forme juridique TRANCHÉE est écrite : personne physique, non assujetti à la TVA', () => {
  // Décision de B, 08/10/2026 : « régime fiscal de petite entreprise en personne
  // physique ». Elle doit être DANS la page, pas seulement dans la fiche : c'est
  // la page que lisent le public et l'administration.
  const texte = texteNu(lire('mentions-legales.html'));
  assert.match(texte, /personne physique/i,
    'la forme « personne physique » doit être écrite, pas laissée en champ à compléter');
  assert.match(texte, /non assujetti/i, 'le régime « non assujetti » doit être écrit');
  assert.match(texte, /franchise de la petite entreprise/i,
    'le régime de franchise doit être nommé, pas supposé connu du lecteur');
  // L'ancienne formulation, qui proposait encore plusieurs formes, a disparu.
  assert.doesNotMatch(texte, /raison sociale/i,
    'les mentions ne doivent plus parler de « raison sociale » : c’est une personne physique');
});

test('le numéro BCE reste EXIGÉ, malgré la franchise de TVA', () => {
  // Piège réel, et c'est le genre qu'on ne voit pas : la franchise de la petite
  // entreprise dispense de la TVA, PAS de l'immatriculation. Une page qui ne
  // demanderait plus le numéro d'entreprise laisserait croire l'inverse.
  const texte = texteNu(lire('mentions-legales.html'));
  assert.match(texte, /Numéro d.entreprise \(BCE\)/i, 'le numéro d’entreprise reste exigé');
  const fiche = readFileSync(join(ICI, '..', 'FICHE-ADMINISTRATIVE.md'), 'utf8');
  assert.match(fiche, /BCE[\s\S]{0,500}(obligatoire|pas de l.immatriculation)/i,
    'la fiche doit dire que la franchise ne dispense PAS de l’immatriculation');
});

/* ================================ 4. RIEN N'EST INVENTÉ (la règle du projet) */

test('les champs qui manquent sont SIGNALÉS comme tels', () => {
  for (const p of ['mentions-legales.html', 'confidentialite.html']) {
    const trous = (lire(p).match(/class="a-completer"/g) || []).length;
    assert.ok(trous >= 3,
      `${p} : l’identité de l’éditeur n’est pas connue — ${trous} marque(s) « à compléter » trouvée(s), trop peu pour être honnête`);
  }
  // Et la page doit DIRE qu'elle n'est pas définitive, pas seulement le laisser
  // deviner par un surlignage.
  assert.match(lire('mentions-legales.html'), /n.est pas encore définitive/i,
    'la page doit prévenir qu’elle ne l’est pas');
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
  assert.ok(adresses.length >= 5, `le plan doit lister les pages, trouvé ${adresses.length}`);

  for (const url of adresses) {
    assert.ok(url.startsWith('https://kazendra.com/'),
      `le plan ne doit lister que le site : ${url}`);
    const chemin = url.replace('https://kazendra.com/', '') || 'index.html';
    const fichier = chemin.endsWith('/') ? chemin + 'index.html' : chemin;
    assert.ok(existe(fichier),
      `le plan annonce ${url}, mais public/${fichier} n’existe pas — un plan qui ment fait perdre du temps aux moteurs`);
  }
  // Les quatre pages administratives doivent y figurer : sinon elles restent
  // invisibles pour un moteur, ce qui revient à ne pas les avoir publiées.
  for (const p of PAGES) {
    assert.ok(adresses.includes(`https://kazendra.com/${p}`), `${p} doit figurer au plan du site`);
  }
});
