/**
 * LE MARCHÉ BELGE — liaison avec les sources, et la RÈGLE DES INFORMATIONS.
 *
 * B (08/10/2026) : « introduire la base de données complète qui est dans le
 * fichier, mais surtout faire une liaison avec les sites qui sont actifs au
 * niveau des promotions dans notre application. Et ceux qui ne sont pas actifs.
 * Cela nous permettra de régulariser chaque site, site par site. »
 *
 * Puis, le même jour : « Les informations sur le siège social m'en sont là qu'à
 * titre informatif. Doivent apparaître dans la base de données mais ne doivent
 * pas être utilisées pour la programmation. »
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI LES DEUX VONT ENSEMBLE.
 *   1. La LIAISON : chaque acteur du marché doit être rangé, sans doublon et
 *      sans perte, dans l'un des trois états — branché, en veille, pas suivi.
 *   2. La SÉPARATION : les informations de siège s'affichent, mais AUCUN
 *      programme ne s'en sert. Une règle écrite seulement dans un commentaire
 *      se perd ; ici, elle est REFUSÉE par un test si on l'enfreint.
 *
 * Ce que le test refuse, il le refuse pour une raison mesurée : une adresse de
 * siège se périme sans prévenir, un CA est « indicatif » d'après la base
 * elle-même. Bâtir une décision dessus produirait une panne silencieuse —
 * le programme continuerait, avec une information fausse.
 *
 * Lancement : node --test tests/acteurs-liaison.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { liaisonActeurs, variantes, memeActeur, formesDe, memeFormes,
  CHAMPS_DE_TRAVAIL, CHAMPS_INFORMATIFS } from '../public/acteurs.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'acteurs.json'), 'utf8'));
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');
const acteursJs = fs.readFileSync(path.join(RACINE, 'public', 'acteurs.js'), 'utf8');

/** Le catalogue : data/ chez nous, docs/ dans la copie du dépôt (data/ n'est pas
 *  versionné — c'est LE piège qui a fait échouer le workflow en silence). */
function lireCatalogue() {
  const c = [path.join(RACINE, 'data', 'offres.json'), path.join(RACINE, 'docs', 'offres.json')]
    .find((p) => fs.existsSync(p));
  assert.ok(c, 'ni data/offres.json ni docs/offres.json');
  return JSON.parse(fs.readFileSync(c, 'utf8'));
}

const catalogue = lireCatalogue();
const r = liaisonActeurs(catalogue, base);
const parNom = new Map(r.acteurs.map((a) => [a.nom, a]));

/* ------------------------------------------------------- la base elle-même */

test('la base est complète : tableur + acteurs lus par l’application', () => {
  // 139 acteurs viennent du tableur de B, 26 ont été AJOUTÉS parce que
  // l'application les lit sans qu'ils y figurent (demande du 08/10/2026).
  assert.equal(base.acteurs.length, 165, '165 acteurs : 139 du fichier + 26 de l’application');
  const duFichier = base.acteurs.filter((a) => a.provenance === 'fichier');
  const ajoutes = base.acteurs.filter((a) => a.provenance === 'application');
  assert.equal(duFichier.length, 139);
  assert.equal(ajoutes.length, 26);
  assert.equal(base.categories.length, 23, '23 catégories : les 22 du fichier + « Communautés de bons plans »');
  for (const a of base.acteurs) {
    assert.ok(a.nom && a.nom.trim(), 'chaque acteur porte un nom');
    assert.ok(a.categorie && a.categorie.trim(), `${a.nom} doit avoir une catégorie`);
    assert.ok(a.pays, `${a.nom} doit porter un pays`);
    assert.ok(Array.isArray(a.domaines) && a.domaines.length,
      `${a.nom} doit porter au moins un domaine — c'est ce qui relie un acteur à sa source`);
  }
  // Un acteur à deux enseignes porte deux domaines (« Social Deal & Outspot »).
  const multi = base.acteurs.filter((a) => a.domaines.length > 1);
  assert.ok(multi.length >= 10, `les acteurs à plusieurs enseignes doivent être détectés (${multi.length} trouvés)`);
});

test('PLUS AUCUN site lu par l’application n’est hors de la base', () => {
  // C'est la demande elle-même : « des acteurs dans l'application qui ne sont
  // pas documentés dans le fichier excel, tu peux les rajouter ». On vérifie
  // donc, sources en main, qu'aucun site réel — hors moteurs de recherche —
  // n'est laissé de côté. Un moteur n'est pas un acteur : il est écarté.
  const reconnu = new Set();
  for (const a of r.acteurs) {
    for (const s of [...a.liaison.flux, ...a.liaison.veille]) reconnu.add(s.nom);
  }
  const REQUETE_GENERIQUE = new Set(['Supermarchés (BE)', 'Supermarkten (BE)', 'Veille presse']);
  const orphelins = [];
  for (const s of catalogue.sources) {
    if (reconnu.has(s.nom)) continue;
    const moteur = /news\.google\.com|bing\.com\/news/.test(s.url);
    const requete = REQUETE_GENERIQUE.has(s.nom) || /^(Presse|Bing)\s[A-Z]{2}\s/.test(s.nom);
    if (!moteur || !requete) orphelins.push(s.nom);
  }
  assert.deepEqual([...new Set(orphelins)], [],
    'tout site réellement lu doit appartenir à un acteur de la base');
});

test('les informations de siège SONT dans la base (elles doivent y être)', () => {
  const avecAdresse = base.acteurs.filter((a) => a.adresse && a.adresse.trim()).length;
  const avecCA = base.acteurs.filter((a) => a.ca && a.ca.trim() && a.ca.toLowerCase() !== 'n/d').length;
  assert.ok(avecAdresse > 100, `les adresses de siège doivent être conservées (${avecAdresse} trouvées)`);
  assert.ok(avecCA > 40, `les CA indicatifs doivent être conservés (${avecCA} trouvés)`);
});

/* ------------------------------------------------------------------ liaison */

test('chaque acteur est rangé dans l’un des trois états, et aucun n’est oublié', () => {
  assert.equal(r.acteurs.length, 165);
  assert.equal(r.compteurs.flux + r.compteurs.veille + r.compteurs.aucun, 165);
  assert.ok(r.compteurs.flux > 0 && r.compteurs.veille > 0 && r.compteurs.aucun > 0);
  for (const a of r.acteurs) {
    assert.ok(['flux', 'veille', 'aucun'].includes(a.etat), `${a.nom} : état inconnu « ${a.etat} »`);
    if (a.etat === 'aucun') {
      assert.equal(a.liaison.flux.length + a.liaison.veille.length, 0,
        `${a.nom} est « pas suivi » et ne doit porter AUCUNE source`);
    }
  }
});

test('un site à PLUSIEURS sources n’est compté qu’une fois (défaut mesuré : ×10)', () => {
  // Coolblue a dix sources ; sans regroupement par nom de site, ses 62 annonces
  // étaient comptées 620 fois à l'échelle du catalogue. Mesuré : 56 262 annonces
  // annoncées pour un catalogue de 13 369.
  const total = r.acteurs.reduce((n, a) => n + a.annonces, 0);
  assert.ok(total <= catalogue.offres.length,
    `${total} articles attribués pour ${catalogue.offres.length} offres : il y a un double comptage`);
  const coolblue = parNom.get('Coolblue');
  const noms = [...coolblue.liaison.flux, ...coolblue.liaison.veille].map((s) => s.nom);
  assert.equal(new Set(noms).size, noms.length, 'aucun site ne doit apparaître deux fois dans une liaison');
});

test('les VRAIES liaisons tiennent, y compris avec le nom du pays entre parenthèses', () => {
  const cas = [
    ['ALDI', 'Aldi (BE)'], ['Lidl', 'Lidl (BE)'], ['HEMA', 'Hema (BE)'],
    ['Carrefour Belgique', 'Carrefour (BE)'], ['Delhaize', 'Delhaize (BE)'],
    ['Colruyt Group', 'Colruyt (BE)'], ['MediaMarkt', 'Media Markt (BE)'],
    ['King Jouet (ex-Maxi Toys)', 'Maxi Toys (BE)'], ['Schoenen Torfs', 'Torfs (BE)'],
    ['Kruidvat', 'Kruidvat (BE)'],
  ];
  for (const [acteur, source] of cas) {
    assert.ok(parNom.has(acteur), `« ${acteur} » doit exister dans la base`);
    const a = parNom.get(acteur);
    const noms = [...a.liaison.flux, ...a.liaison.veille].map((s) => s.nom);
    assert.ok(noms.includes(source),
      `« ${acteur} » doit être relié à « ${source} » — relié à : ${noms.join(', ') || 'rien'}`);
  }
});

test('la liaison ne se trompe plus de voisin (deux faux positifs MESURÉS)', () => {
  // La version qui collait les mots rapprochait « Mobil.se » de « Mobile
  // Vikings » et « Brico » de « Mr.Bricolage ». Deux liaisons fausses, du genre
  // qui fait croire qu'un acteur est couvert quand il ne l'est pas.
  assert.equal(memeActeur('Mobile Vikings', 'Mobil.se'), false);
  assert.equal(memeActeur('Mr.Bricolage', 'Brico (BE)'), false);
  assert.equal(memeActeur('BricoPlanit', 'Brico (BE)'), false);
  assert.equal(memeActeur('Club', 'Clubic'), false);
  // Et les vraies tiennent toujours.
  assert.equal(memeActeur('Schoenen Torfs', 'Torfs (BE)'), true);
  assert.equal(memeActeur('HEMA', 'Hema (BE)'), true);
});

test('un acteur relié DEUX fois (flux et veille) est compté BRANCHÉ', () => {
  // Coolblue est lu directement ET vu par la veille : dès qu'une source le lit,
  // il est branché. Ranger les deux ensemble ferait croire qu'il ne l'est pas.
  const cb = parNom.get('Coolblue');
  assert.equal(cb.etat, 'flux');
  assert.ok(cb.liaison.flux.length > 0 && cb.liaison.veille.length > 0,
    'Coolblue doit porter les DEUX voies, et rester « branché »');
});

test('le bilan par catégorie couvre exactement les acteurs de la base', () => {
  const total = r.categories.reduce((n, c) => n + c.acteurs, 0);
  assert.equal(total, 165);
  for (const c of r.categories) {
    assert.equal(c.flux + c.veille + c.aucun, c.acteurs, `${c.categorie} : les états ne totalisent pas les acteurs`);
  }
});

/* ------------------------------------- LA RÈGLE DES INFORMATIONS (le contrat) */

test('RÈGLE : le programme ne lit JAMAIS les informations de siège', () => {
  // On relit le CORPS RÉEL de liaisonActeurs(), commentaires retirés : le
  // commentaire a le droit de nommer ces champs, le code n'a pas le droit de
  // les toucher.
  const m = acteursJs.match(/export function liaisonActeurs\([\s\S]*?\n\}/);
  assert.ok(m, 'liaisonActeurs doit exister dans public/acteurs.js');
  const corps = m[0]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const interdits = ['adresse', 'telephone', 'email', 'actionnariat', 'remarques',
    'positionnement', 'segment', 'distribution'];
  for (const champ of interdits) {
    assert.ok(!new RegExp(`\\b${champ}\\b`).test(corps),
      `« ${champ} » est une information de siège : le programme ne doit pas la lire`);
  }
  // Le CA aussi — attention, « ca » est un mot court, on exige les frontières.
  assert.ok(!/\bca\b/.test(corps), 'le CA indicatif ne doit pas servir au programme');
});

test('RÈGLE : le contrat est écrit noir sur blanc, et les deux listes ne se mélangent pas', () => {
  assert.ok(CHAMPS_DE_TRAVAIL.includes('nom') && CHAMPS_DE_TRAVAIL.includes('domaines'),
    'le travail se fait sur le nom et le site web');
  for (const champ of ['adresse', 'telephone', 'email', 'ca', 'actionnariat']) {
    assert.ok(CHAMPS_INFORMATIFS.includes(champ), `${champ} doit être déclaré informatif`);
    assert.ok(!CHAMPS_DE_TRAVAIL.includes(champ), `${champ} ne doit PAS être un champ de travail`);
  }
  // Et la règle est citée dans le module, à l'endroit où elle s'applique.
  assert.match(acteursJs, /ne doivent pas être utilisées pour la programmation/,
    'la règle de B doit rester écrite dans le module');
});

test('RÈGLE : le panneau AFFICHE les informations, en les annonçant comme telles', () => {
  assert.ok(admin.includes('id="mMarcheCompteurs"') && admin.includes('id="mMarche"'),
    'l’onglet Marché belge doit exister');
  assert.match(admin, /function ficheInfo\(/, 'la fiche de l’acteur doit exister');
  for (const champ of ['a.adresse', 'a.telephone', 'a.email', 'a.ca']) {
    assert.ok(admin.includes(champ), `le panneau doit afficher ${champ}`);
  }
  assert.match(admin, /documentaires/, 'le panneau doit dire que ces informations sont documentaires');
  assert.match(admin, /le programme ne s'en sert jamais/,
    'le panneau doit dire que le programme ne s’en sert jamais');
  // Et le CSV les porte aussi, APRÈS une colonne qui marque la frontière.
  assert.match(admin, /'--- INFORMATIF ---'/,
    'l’export doit séparer visiblement ce qui sert au travail de ce qui informe');
});

test('les acteurs AJOUTÉS portent leur provenance, et sont bien ceux qui manquaient', () => {
  // Chaque acteur doit dire d'où il vient : du tableur de B, ou de l'application.
  // Sans cela, on ne saurait plus distinguer ce qu'il a fourni de ce que nous
  // avons ajouté — et il ne pourrait plus corriger sa base.
  assert.ok(base.acteurs.every((a) => a.provenance === 'fichier' || a.provenance === 'application'));
  const ajoutes = new Set(base.acteurs.filter((a) => a.provenance === 'application').map((a) => a.nom));
  for (const nom of ['Groupon', 'MyDealz', 'HotUKDeals', 'Chollometro', 'Spar', 'JBC', 'Toolstation',
    'Bio-Planet', 'OKay', 'Fun', 'DHnet', 'Het Nieuwsblad', 'Gazet van Antwerpen']) {
    assert.ok(ajoutes.has(nom), `« ${nom} » devait être ajouté — c'est un site que l'application lit`);
  }
  // Groupon était LE cas signalé : ses clics existaient, sans ligne où les
  // rattacher. Il est désormais dans la base, donc rattachable.
  assert.ok(parNom.has('Groupon'), 'Groupon doit désormais être dans la base');
  assert.equal(parNom.get('Groupon').etat, 'flux', 'et il est lu directement : c’est un acteur branché');
  // Les moteurs, eux, ne doivent JAMAIS devenir des acteurs : ce ne sont pas des
  // acteurs du marché, seulement des moyens de les voir.
  for (const nom of base.acteurs.map((a) => a.nom)) {
    assert.ok(!/^(Presse|Bing)\s[A-Z]{2}\s/.test(nom), `« ${nom} » est un moteur, pas un acteur`);
    assert.ok(!['Veille presse', 'Supermarchés (BE)', 'Supermarkten (BE)'].includes(nom));
  }
});
