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
// LA CLÉ EST LE COUPLE (PAYS, NOM), PAS LE NOM SEUL. Depuis que la base couvre
// deux marchés, douze enseignes portent le même nom dans deux pays (Lidl,
// Zalando, MediaMarkt…). Une carte indexée par le nom seul ne gardait que la
// dernière rencontrée — et un test pouvait alors éprouver l'acteur allemand en
// croyant tenir le belge.
const parNom = new Map(r.acteurs.map((a) => [`${a.pays}|${a.nom}`, a]));
const acteurDe = (nom, pays = 'BE') => parNom.get(`${pays}|${nom}`);

/* ------------------------------------------------------- la base elle-même */

test('la base est complète : les tableurs, pays par pays, plus ce que l’application lit', () => {
  // 584 acteurs viennent des tableurs de B — 139 du marché belge, 182 du
  // marché allemand (ajout du 09/10/2026) et 263 du marché français (ajout du
  // même jour) — et 25 ont été AJOUTÉS parce que l'application les lit sans
  // qu'ils y figurent.
  assert.equal(base.acteurs.length, 609, '609 acteurs : 139 (BE) + 182 (DE) + 263 (FR) + 25 de l’application');
  assert.deepEqual(base.sources,
    ['marche-be-2026-10-08.xlsx', 'marche-de-2026-10-08.xlsx', 'marche-fr-2026-10-08.xlsx'],
    'les trois tableurs fournis doivent rester la provenance de la base');
  const duFichier = base.acteurs.filter((a) => a.provenance === 'fichier');
  const ajoutes = base.acteurs.filter((a) => a.provenance === 'application');
  assert.equal(duFichier.length, 584);
  assert.equal(ajoutes.length, 25);
  // UN PAYS, UN TABLEUR : chaque acteur lu dans un tableur porte le pays de son
  // marché — c'est ce que lit le choix du pays, dans le Marché Euro comme dans
  // l'Affiliation.
  const parPays = {};
  for (const a of duFichier) parPays[a.pays] = (parPays[a.pays] || 0) + 1;
  assert.equal(parPays.BE, 139, 'le tableur belge apporte 139 acteurs');
  assert.equal(parPays.DE, 182, 'le tableur allemand apporte 182 acteurs');
  assert.equal(parPays.FR, 263, 'le tableur français apporte 263 acteurs');
  assert.deepEqual(base.paysCouverts, [...new Set(base.acteurs.map((a) => a.pays))].sort(),
    'paysCouverts doit refléter exactement les pays présents dans la base');
  assert.equal(base.categories.length, 36,
    '36 libellés de catégorie : chaque marché nomme les siennes à sa façon (le tableur français écrit « Bricolage, Jardin & Extérieur » là où le belge écrit « … Aménagement Extérieur »), plus « Communautés de bons plans » et les activités touristiques par pays');
  for (const a of base.acteurs) {
    assert.ok(a.nom && a.nom.trim(), 'chaque acteur porte un nom');
    assert.ok(a.categorie && a.categorie.trim(), `${a.nom} doit avoir une catégorie`);
    assert.ok(a.pays, `${a.nom} doit porter un pays`);
  }
  // LE DOMAINE RELIE UN ACTEUR À SA SOURCE — mais tout acteur n'en a pas, et
  // c'est B qui l'a écrit ainsi : « GameStop Allemagne » (fermé), « FTI Group »
  // (insolvable), « Erlebnisparks régionaux », « weiter Reisen », « Space
  // Games ». Leur case « Site web » porte « fermé », « à vérifier » ou « — ».
  // Les écarter de la base perdrait de l'information ; les déclarer avec un
  // domaine inventé serait pire. On les garde donc SANS domaine, et on compte
  // l'écart de couverture pour qu'il ne passe pas pour un oubli.
  const sansDomaine = base.acteurs.filter((a) => !(a.domaines || []).length);
  assert.ok(sansDomaine.length <= 10,
    `${sansDomaine.length} acteurs sans domaine : au-delà, c'est un défaut d'extraction, pas des cas isolés`);
  for (const a of sansDomaine) {
    assert.match(String(a.site || ''), /vérifier|fermé|divers|^—$|^-$/,
      `« ${a.nom} » n'a pas de domaine et sa case « Site web » ne l'annonce pas : « ${a.site} »`);
  }
  const avecDomaine = base.acteurs.filter((a) => (a.domaines || []).length);
  assert.equal(avecDomaine.length, base.acteurs.length - sansDomaine.length);
  // Un acteur à deux enseignes porte deux domaines (« Social Deal & Outspot »).
  const multi = base.acteurs.filter((a) => a.domaines.length > 1);
  assert.ok(multi.length >= 10, `les acteurs à plusieurs enseignes doivent être détectés (${multi.length} trouvés)`);
});

test('DEUX TABLEURS PEUVENT NOMMER LE MÊME ACTEUR — et on ne les fond pas', () => {
  // Lidl, Zalando, MediaMarkt, C&A, Ryanair… figurent dans les DEUX marchés,
  // avec deux sites différents (lidl.be et lidl.de). Les fusionner ferait
  // disparaître un marché de la liste ; les confondre ferait afficher la mesure
  // d'un site pour l'autre.
  const lidl = base.acteurs.filter((a) => a.nom === 'Lidl');
  assert.equal(lidl.length, 2, 'Lidl doit exister une fois par marché');
  assert.deepEqual(lidl.map((a) => a.pays).sort(), ['BE', 'DE']);
  const domaines = new Set(lidl.flatMap((a) => a.domaines));
  assert.ok(domaines.has('lidl.be') && domaines.has('lidl.de'),
    `les deux sites doivent être distincts — trouvés : ${[...domaines].join(', ')}`);
  const alias = lintEntrePays();
  assert.ok(alias.length >= 10, `les acteurs présents dans les deux marchés sont nombreux (${alias.length} trouvés)`);
});

/** Les noms portés par les DEUX pays : c'est là qu'une confusion de mesure
 *  coûterait une liaison fausse. */
function lintEntrePays() {
  const parPays = new Map();
  for (const a of base.acteurs) {
    if (!parPays.has(a.nom)) parPays.set(a.nom, new Set());
    parPays.get(a.nom).add(a.pays);
  }
  return [...parPays.entries()].filter(([, p]) => p.size > 1).map(([nom]) => nom);
}

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
  assert.equal(r.acteurs.length, 609);
  assert.equal(r.compteurs.flux + r.compteurs.veille + r.compteurs.aucun, 609);
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
  const coolblue = acteurDe('Coolblue');
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
    assert.ok(parNom.has(`BE|${acteur}`), `« ${acteur} » doit exister dans la base`);
    const a = acteurDe(acteur);
    const noms = [...a.liaison.flux, ...a.liaison.veille].map((s) => s.nom);
    assert.ok(noms.includes(source),
      `« ${acteur} » doit être relié à « ${source} » — relié à : ${noms.join(', ') || 'rien'}`);
  }
});

test('UNE SOURCE APPARTIENT AU MARCHÉ QU’ELLE LIT — pas de liaison entre pays', () => {
  // Ajout du 09/10/2026, conséquence directe de la base allemande. Deux marchés
  // partagent des noms (MediaMarkt, Lidl, Zalando…). Relier l'acteur allemand à
  // une source belge du même nom lui aurait attribué les articles belges — et
  // aurait compté deux fois la même source. Le chemin par NOM est donc filtré
  // par le pays ; le chemin par DOMAINE, lui, reste le juge : c'est lui qui
  // distingue lidl.de de lidl.be.
  const mediamarktDe = acteurDe('MediaMarkt', 'DE');
  const nomsDe = [...mediamarktDe.liaison.flux, ...mediamarktDe.liaison.veille].map((s) => s.nom);
  assert.ok(!nomsDe.includes('Media Markt (BE)'),
    `l'acteur allemand ne doit pas être relié à une source belge — relié à : ${nomsDe.join(', ') || 'rien'}`);
  for (const s of [...mediamarktDe.liaison.flux, ...mediamarktDe.liaison.veille]) {
    assert.notEqual(s.pays, 'BE', `« ${s.nom} » est une source belge, pas celle du marché allemand`);
  }
  // Et l'inverse tient : le belge garde bien sa source belge.
  const be = acteurDe('MediaMarkt');
  assert.ok([...be.liaison.flux, ...be.liaison.veille].some((s) => s.nom === 'Media Markt (BE)'));
  // Le total attribué ne peut pas dépasser ce que le catalogue contient : c'est
  // la garde qui a attrapé le défaut (23 754 articles pour 15 322 offres).
  const total = r.acteurs.reduce((n, a) => n + a.annonces, 0);
  assert.ok(total <= catalogue.offres.length,
    `${total} articles attribués pour ${catalogue.offres.length} offres : il y a un double comptage entre marchés`);
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
  const cb = acteurDe('Coolblue');
  assert.equal(cb.etat, 'flux');
  assert.ok(cb.liaison.flux.length > 0 && cb.liaison.veille.length > 0,
    'Coolblue doit porter les DEUX voies, et rester « branché »');
});

test('le bilan par catégorie couvre exactement les acteurs de la base', () => {
  const total = r.categories.reduce((n, c) => n + c.acteurs, 0);
  assert.equal(total, 609);
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
  for (const nom of ['Groupon', 'HotUKDeals', 'Chollometro', 'Spar', 'JBC', 'Toolstation',
    'Bio-Planet', 'OKay', 'Fun', 'DHnet', 'Het Nieuwsblad', 'Gazet van Antwerpen']) {
    assert.ok(ajoutes.has(nom), `« ${nom} » devait être ajouté — c'est un site que l'application lit`);
  }
  // MyDealz a QUITTÉ cette liste le 09/10/2026 : le tableur allemand de B le
  // documente désormais. Une entité qui entre dans la base par un tableur n'est
  // plus un « ajout de l'application » — c'est sa provenance qui a changé, et
  // l'écran doit le dire. Il reste un acteur branché, comme avant.
  assert.equal(base.acteurs.find((a) => a.nom.toLowerCase() === 'mydealz').provenance, 'fichier',
    'MyDealz vient maintenant du tableur allemand');
  assert.ok(!ajoutes.has('MyDealz'), 'et il ne doit plus être compté comme un ajout');
  // Groupon était LE cas signalé : ses clics existaient, sans ligne où les
  // rattacher. Il est désormais dans la base, donc rattachable.
  assert.ok(parNom.has('BE|Groupon'), 'Groupon doit désormais être dans la base');
  assert.equal(acteurDe('Groupon').etat, 'flux', 'et il est lu directement : c’est un acteur branché');
  // Les moteurs, eux, ne doivent JAMAIS devenir des acteurs : ce ne sont pas des
  // acteurs du marché, seulement des moyens de les voir.
  for (const nom of base.acteurs.map((a) => a.nom)) {
    assert.ok(!/^(Presse|Bing)\s[A-Z]{2}\s/.test(nom), `« ${nom} » est un moteur, pas un acteur`);
    assert.ok(!['Veille presse', 'Supermarchés (BE)', 'Supermarkten (BE)'].includes(nom));
  }
});
