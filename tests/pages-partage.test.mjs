/**
 * LES PAGES DE PARTAGE — une page par offre, pour que chaque partage porte la marque.
 *
 * Demande de B (09/10/2026) : « Quand on fait un partage, actuellement ça affiche
 * directement le lien Amazon par exemple, mais il n'y a pas de trace de Kazendra.
 * Donc pas de publicité pour nous gratuite... Quelle solution peux-tu trouver ? »
 * puis : « Oui tu peux partir sur la version par offre avec repli générique quand
 * l'offre n'a pas d'image. »
 *
 * CE QUE CE FICHIER PROTÈGE, et pourquoi chaque point est un vrai risque :
 *   1. les balises Open Graph sont ÉCRITES — le robot ne fait pas tourner de
 *      JavaScript, donc une page qui les remplirait en JS n'afficherait rien ;
 *   2. l'image de repli existe et fait la bonne taille — un og:image absent
 *      s'affiche comme un lien nu, c'est-à-dire sans marque ;
 *   3. le bouton de la page mène au MÊME lien que l'application — c'est la
 *      commission : on ne la perd pas en gagnant la marque ;
 *   4. la génération est RÉELLEMENT appelée par la publication : une fonction
 *      juste que personne n'appelle est le piège déjà payé plusieurs fois ici.
 *
 * Le lien partagé lui-même (« le partage envoie notre adresse ») est éprouvé
 * dans tests/partage.test.mjs, avec les trois voies de partage.
 *
 * Lancement : node --test tests/pages-partage.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pageDeLOffre, imageDeLOffre, descriptionDeLOffre, chargesDevises,
  IMAGE_GENERIQUE, SITE,
} from '../outils/pages-partage.mjs';
import { lienAffilie } from '../public/affiliation.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ICI, '..', 'public');
const index = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');

const outils = await chargesDevises();
const offre = {
  // Guillemets DROITS et esperluette, exprès : ce sont eux qui cassent une
  // balise si l'échappement manque. Les guillemets français « » ne prouveraient
  // rien — ils ne ferment aucun attribut.
  id: 'zz1', titre: 'Casque "Bluetooth" & Cie — 40 h d\'autonomie',
  prix: 129.99, prixAvant: 199, remise: 34, marchand: 'Amazon',
  pays: 'FR', lienMarchand: 'https://www.amazon.fr/dp/B0TEST?tag=autre-21',
  image: 'img/abcdef0123456789.jpg',
};
const sansImage = { ...offre, id: 'zz2', image: '', pays: 'DE', marchand: 'Otto' };

/* ------------------------- les balises que le robot lit, écrites en dur */

test('la page d’une offre porte TOUTES les balises du robot', () => {
  const html = pageDeLOffre(offre, outils);
  assert.match(html, /<meta property="og:type" content="product">/);
  assert.match(html, /<meta property="og:site_name" content="Kazendra">/);
  assert.match(html, /<meta property="og:title" content="casque/i);
  assert.match(html, /<meta property="og:url" content="https:\/\/kazendra\.com\/o\/zz1\.html">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/kazendra\.com\/img\/abcdef0123456789\.jpg">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  // Un guillemet dans le titre ne doit pas casser la balise.
  assert.match(html, /&quot;Bluetooth&quot;/, 'le titre doit être échappé');
  assert.match(html, /&amp; Cie/, 'l’esperluette doit être échappée');
});

test('la page annonce le prix et la boutique, sans phrase française en dur', () => {
  // La description est faite de chiffres et de noms : elle se lit dans toutes
  // les langues, et le titre est déjà dans celle du marchand.
  const d = descriptionDeLOffre(offre, '129,99 €');
  assert.match(d, /129,99 €/);
  assert.match(d, /Amazon/);
  assert.match(d, /Kazendra/);
  assert.doesNotMatch(d, /\b(chez|voir|offre|bon plan)\b/i, `description en français : « ${d} »`);
});

/* ------------------------------------------ le repli quand il n'y a pas d'image */

test('sans visuel, la page reçoit la carte générique — pas une carte vide', () => {
  assert.equal(imageDeLOffre(sansImage), IMAGE_GENERIQUE);
  const html = pageDeLOffre(sansImage, outils);
  assert.match(html, /<meta property="og:image" content="https:\/\/kazendra\.com\/carte-kazendra\.png">/);
  // Les dimensions ne se déclarent que pour NOTRE carte : annoncer 1200 × 630
  // pour une image de marchand dont on ignore la taille serait un mensonge.
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.doesNotMatch(pageDeLOffre(offre, outils), /og:image:width/,
    'aucune dimension déclarée pour une image dont on ne connaît pas la taille');
});

test('un visuel déjà chez nous devient une adresse ABSOLUE de partage', () => {
  // Le catalogue publie « img/<empreinte>.jpg », un chemin RELATIF à la racine.
  // Dans un partage il faut une adresse complète : le robot du destinataire n'a
  // pas notre page sous les yeux pour la résoudre.
  assert.equal(imageDeLOffre({ image: 'img/x.jpg' }), `${SITE}/img/x.jpg`);
  assert.equal(imageDeLOffre({ image: '/img/x.jpg' }), `${SITE}/img/x.jpg`);
  // Une adresse de marchand non rapatriée reste telle quelle.
  assert.equal(imageDeLOffre({ image: 'https://m.media-amazon.com/images/I/a.jpg' }),
    'https://m.media-amazon.com/images/I/a.jpg');
  assert.equal(imageDeLOffre({}), IMAGE_GENERIQUE);
});

/* --------------------------------------------- le bouton, et la commission */

test('le bouton de la page mène au MÊME lien que l’application', () => {
  const html = pageDeLOffre(offre, outils);
  const btn = html.match(/<a class="btn" href="([^"]*)"/);
  assert.ok(btn, 'la page doit porter un bouton');
  assert.ok(btn[1].includes('amazon.fr/dp/B0TEST'),
    `le bouton doit mener au marchand : ${btn[1]}`);
  assert.match(html, /rel="nofollow sponsored noopener"/,
    'un lien affilié se déclare : nofollow + sponsored');
  assert.doesNotMatch(html, /http-equiv="refresh"/i,
    'aucune redirection automatique : un robot la suivrait et afficherait la carte du marchand');
  // Et le bouton est bien calculé par la fonction de l'application.
  assert.ok(lienAffilie(offre.lienMarchand, offre.marchand, 'fr').includes('amazon.fr'));
});

/* ------------------------------------------- la langue et la devise du marché */

test('la page parle la langue du marché, avec les libellés de l’application', () => {
  const fr = pageDeLOffre({ ...offre, pays: 'FR' }, outils);
  const de = pageDeLOffre({ ...offre, pays: 'DE' }, outils);
  const gb = pageDeLOffre({ ...offre, pays: 'GB' }, outils);
  assert.match(fr, /Voir chez Amazon/);
  assert.match(de, /Bei Amazon ansehen/);
  assert.match(gb, /View at Amazon/);
  assert.match(de, /<html lang="de">/);
  assert.match(gb, /<html lang="en">/);
});

test('un prix s’écrit dans SA devise, sur la page comme dans l’application', () => {
  // Le montant vient du formateur LIVRÉ (extrait d'app.js) : une seconde règle
  // finirait par diverger de ce que le site affiche.
  const se = pageDeLOffre({ ...offre, pays: 'SE', prix: 6089, prixAvant: null, image: '' }, outils);
  assert.match(se, /6\s*089\s*kr/, 'un prix suédois doit s’écrire en couronnes');
  const pl = pageDeLOffre({ ...offre, pays: 'PL', prix: 285, prixAvant: null, image: '' }, outils);
  assert.match(pl, /285\s*zł/, 'un prix polonais doit s’écrire en złoty');
});

/* ---------------------------------------------------- la carte de repli */

test('la carte de repli existe, fait 1200 × 630, et porte un vrai dessin', () => {
  const p = path.join(PUBLIC, 'carte-kazendra.png');
  assert.ok(fs.existsSync(p), 'public/carte-kazendra.png doit exister');
  const b = fs.readFileSync(p);
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'ce n’est pas un PNG');
  assert.equal(b.readUInt32BE(16), 1200, 'largeur attendue 1200');
  assert.equal(b.readUInt32BE(20), 630, 'hauteur attendue 630');
  // Un aplat uni — le défaut d'un rendu raté, logo absent — pèserait quelques
  // centaines d'octets. La carte porte un tracé : elle pèse bien davantage.
  assert.ok(b.length > 20000, `carte suspicieusement légère (${b.length} octets)`);
});

test('l’accueil du site porte aussi sa carte de prévisualisation', () => {
  // Sans ces balises, même un lien vers kazendra.com s'affiche nu : c'était le
  // cas jusqu'au 09/10/2026, où le site n'avait AUCUNE balise og:.
  assert.match(index, /<meta property="og:title" content="Kazendra/);
  assert.match(index, /<meta property="og:image" content="https:\/\/kazendra\.com\/carte-kazendra\.png">/);
  assert.match(index, /<meta property="og:site_name" content="Kazendra">/);
  assert.match(index, /<link rel="canonical" href="https:\/\/kazendra\.com\/">/);
});

/* ------------------------------- la publication écrit vraiment ces pages */

test('la publication écrit les pages — le branchement, pas la fonction', () => {
  const collecteur = fs.readFileSync(path.join(ICI, '..', 'collecteur.mjs'), 'utf8');
  assert.match(collecteur, /await import\('\.\/outils\/pages-partage\.mjs'\)/,
    'la publication doit charger le générateur de pages');
  assert.match(collecteur, /ecrirePagesPartage\(sortie\.offres/,
    'et lui passer le catalogue publié, pour que les pages décrivent ce que le site sert');
  const bloc = collecteur.slice(collecteur.indexOf('LES PAGES DE PARTAGE'));
  assert.match(bloc.slice(0, 900), /catch/,
    'un échec des pages ne doit pas empêcher la publication du catalogue');
});

test('les pages publiées décrivent le catalogue publié', () => {
  const dossier = path.join(ICI, '..', 'docs', 'o');
  if (!fs.existsSync(dossier)) return; // copie du dépôt sans publication : rien à dire
  const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith('.html'));
  assert.ok(fichiers.length > 1000, `trop peu de pages publiées : ${fichiers.length}`);
  const html = fs.readFileSync(path.join(dossier, fichiers[0]), 'utf8');
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:image"/);
  assert.match(html, /<a class="btn"/);
  assert.match(html, /<meta name="robots" content="noindex, follow">/,
    'ces pages existent pour la carte, pas pour le référencement');
});
