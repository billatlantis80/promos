/**
 * L'ONGLET AFFILIATION, ET LES NOTES.
 *
 * B (08/10/2026) : « Pour chaque pays tu dois m'afficher les affiliations qui
 * sont possibles, existantes. Ça me permettra d'avoir une vue claire de quelle
 * affiliation j'ai ou pas. Tu dois vérifier qui fait des affiliations ou pas,
 * s'il y a des affiliations, ils apparaissent en haut, s'il n'y en a pas ils
 * apparaissent plus bas. […] Mettre à côté une case note dans lequel je peux
 * écrire quelque chose ou toi. La même chose dans la partie marché euro, pour
 * chaque entreprise il me faut à la fin de la ligne un encadrement note manuel. »
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI.
 *   1. LA SOMME. Chaque acteur doit tomber dans un pays et un groupe, et un
 *      seul. Un acteur oublié ou compté deux fois produirait un chiffre faux —
 *      et un chiffre faux ne fait aucun bruit, il a l'air d'une information.
 *   2. L'HONNÊTETÉ DE LA MESURE. « Non mesuré » n'est ni « avec » ni « sans ».
 *      Un site qui refuse d'être lu (403) n'est PAS un site sans programme, et
 *      l'écrire serait le plus coûteux des mensonges : B écrirait à des
 *      enseignes qui ont déjà un programme d'affiliation.
 *   3. LA NOTE PARTAGÉE. Une note parle d'un acteur, pas d'un onglet. Écrite
 *      dans l'un, elle doit se retrouver dans l'autre — sinon il faudrait
 *      l'écrire deux fois, et les deux copies finiraient par diverger.
 *   4. LE REDESSIN. Les listes sont dessinées une fois. Sans redessin au
 *      changement d'onglet, une note apparaissait VIDE dans l'autre onglet —
 *      défaut silencieux, mesuré, et corrigé.
 *
 * Lancement : node --test tests/affiliation-pays.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { paysAffiliation, affiliationsDuPays, etatAffiliation, indexAffiliation,
  ORDRE_AFFILIATION, preuvesAffiliation } from '../public/affiliations.js';
import { reseauxDans, parleDUnProgramme, liensProgramme }
  from '../outils/mesure-affiliations.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'acteurs.json'), 'utf8'));
const admin = fs.readFileSync(path.join(RACINE, 'public', 'admin', 'index.html'), 'utf8');

/** Les mesures : celle du dépôt si elle existe, sinon un jeu fabriqué. Le test
 *  ne doit pas dépendre d'un balayage réseau — il dépend d'une RÈGLE. */
function lireMesures() {
  const p = [path.join(RACINE, 'public', 'affiliations.json'),
    path.join(RACINE, 'donnees', 'affiliations.json')].find((x) => fs.existsSync(x));
  return p ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
const mesures = lireMesures();

/* ---------------------------------------------------- 1. L'ordre et les pays */

test('les trois états existent, dans l’ordre demandé', () => {
  assert.deepEqual(ORDRE_AFFILIATION,
    ['programme trouvé', 'non mesuré', 'aucun signe trouvé'],
    'les affiliations doivent venir en haut, celles qu’on n’a pas trouvées en bas');
});

test('chaque acteur tombe dans UN pays, et un seul', () => {
  const pays = paysAffiliation(base, mesures);
  const total = pays.reduce((n, x) => n + x.acteurs, 0);
  assert.equal(total, base.acteurs.length, `${total} acteurs comptés pour une base de ${base.acteurs.length}`);
  for (const p of pays) {
    assert.equal(p.programme + p.nonMesure + p.aucunSigne, p.acteurs,
      `${p.pays} : les trois états ne totalisent pas les acteurs`);
  }
});

test('les pays sont classés par ce qui est actionnable', () => {
  const pays = paysAffiliation(base, mesures);
  const suite = pays.every((x, i) => i === 0 || pays[i - 1].programme >= x.programme);
  assert.ok(suite, 'les pays ne sont pas triés par nombre de programmes trouvés');
});

test('la vue d’un pays retombe exactement sur ses trois groupes', () => {
  for (const p of paysAffiliation(base, mesures)) {
    const v = affiliationsDuPays(null, base, mesures, p.pays);
    assert.equal(v.compteurs.acteurs, p.acteurs);
    assert.equal(v.groupes.reduce((n, g) => n + g.liste.length, 0), p.acteurs,
      `${p.pays} : les groupes ne totalisent pas les acteurs`);
    for (const g of v.groupes) assert.equal(g.n, g.liste.length, `${p.pays}/${g.etat} : compte incohérent`);
    assert.deepEqual(v.groupes.map((g) => g.etat), ORDRE_AFFILIATION);
  }
});

/* ------------------------------------------- 2. L'honnêteté de la mesure */

test('un acteur NON MESURÉ n’est jamais rangé « aucun signe »', () => {
  // C'est la règle la plus importante du fichier : confondre les deux ferait
  // écrire B à des enseignes qui ont déjà un programme.
  const e = etatAffiliation(mesures, 'Acteur Qui N’existe Pas Du Tout');
  assert.equal(e.etat, 'non mesuré', 'l’absence de mesure n’est pas une mesure');
  assert.equal(e.raison, 'acteur absent du balayage');
});

test('un site qui REFUSE la mesure est « non mesuré », avec son motif', () => {
  // Le cas réel : Groupon, Bol et Amazon répondent 403 ou une page vide. Les
  // déclarer « sans affiliation » ferait écrire B à des enseignes qui en ont une.
  const faux = { acteurs: [{ nom: 'Groupon', etat: 'non mesuré', raison: 'le site a refusé la mesure (HTTP 403)', reseaux: [] }] };
  const e = etatAffiliation(faux, 'Groupon');
  assert.equal(e.etat, 'non mesuré');
  assert.match(e.raison, /refusé la mesure/);
  assert.match(e.raison, /403/);
});

test('un état inconnu est ramené à « non mesuré », jamais à « sans »', () => {
  const faux = { acteurs: [{ nom: 'X', etat: 'peut-être', reseaux: [] }] };
  assert.equal(etatAffiliation(faux, 'X').etat, 'non mesuré');
});

test('les mesures s’indexent par NOM, la seule clé partagée par les deux bases', () => {
  const idx = indexAffiliation({ acteurs: [{ nom: 'Delhaize', etat: 'aucun signe trouvé' }] });
  assert.ok(idx.Delhaize);
  assert.equal(indexAffiliation(null).constructor, Object);
});

test('UN MÊME NOM DANS DEUX PAYS ne mélange pas les deux mesures', () => {
  // Ajout du 09/10/2026, sur un cas réel : les tableurs belge et allemand
  // nomment tous les deux « Lidl », « MediaMarkt », « Zalando »… mais ce sont
  // deux sites (lidl.be / lidl.de). Sans le pays dans la clé, la mesure
  // allemande s'affichait sur la ligne belge (ou l'inverse, selon l'ordre du
  // fichier) — une liaison fausse, du genre qui fait croire qu'un marché est
  // couvert alors qu'il ne l'est pas.
  const mesures = { acteurs: [
    { nom: 'Lidl', pays: 'BE', domaine: 'lidl.be', etat: 'aucun signe trouvé', reseaux: [] },
    { nom: 'Lidl', pays: 'DE', domaine: 'lidl.de', etat: 'programme trouvé', reseaux: ['Awin'] },
  ] };
  assert.equal(etatAffiliation(mesures, 'Lidl', 'DE').etat, 'programme trouvé');
  assert.equal(etatAffiliation(mesures, 'Lidl', 'DE').domaine, 'lidl.de');
  assert.equal(etatAffiliation(mesures, 'Lidl', 'BE').etat, 'aucun signe trouvé');
  assert.equal(etatAffiliation(mesures, 'Lidl', 'BE').domaine, 'lidl.be');
  // Sans pays, on retombe sur la première mesure du nom — l'ancien contrat,
  // celui des mesures d'avant l'ajout des pays.
  assert.equal(etatAffiliation(mesures, 'Lidl').domaine, 'lidl.be');
  // Et l'index garde les deux clés.
  const idx = indexAffiliation(mesures);
  assert.ok(idx['Lidl|DE'] && idx['Lidl|BE'] && idx.Lidl);
});

test('les deux marchés homonymes restent distincts dans la vue du pays', () => {
  const b = { acteurs: [
    { nom: 'Lidl', pays: 'BE', categorie: 'Grande Distribution Alimentaire', domaines: ['lidl.be'] },
    { nom: 'Lidl', pays: 'DE', categorie: 'Grande Distribution Alimentaire', domaines: ['lidl.de'] },
  ] };
  const m = { acteurs: [
    { nom: 'Lidl', pays: 'BE', domaine: 'lidl.be', etat: 'aucun signe trouvé', reseaux: [] },
    { nom: 'Lidl', pays: 'DE', domaine: 'lidl.de', etat: 'programme trouvé', reseaux: ['Awin'] },
  ] };
  const de = affiliationsDuPays(null, b, m, 'DE');
  assert.equal(de.compteurs.programme, 1, 'le Lidl allemand a un programme');
  assert.equal(de.compteurs.aucunSigne, 0);
  const be = affiliationsDuPays(null, b, m, 'BE');
  assert.equal(be.compteurs.programme, 0, 'le Lidl belge n’a aucun signe : ne pas lui prêter celui du DE');
  assert.equal(be.compteurs.aucunSigne, 1);
});

test('la mesure COUVRE la base : aucun acteur sans mesure, aucun « absent »', () => {
  // Ajout du 09/10/2026. La mesure suit la base : après le balayage allemand,
  // chaque acteur doit trouver SA ligne. Un acteur que la mesure ignore est
  // rangé « non mesuré » — et sur 346 lignes, un oubli se lirait comme un refus
  // du site, pas comme une lacune du balayage. On l'écrit donc en clair.
  if (!mesures) return; // pas de balayage dans cette copie du dépôt
  const absents = base.acteurs.filter(
    (a) => etatAffiliation(mesures, a.nom, a.pays).raison === 'acteur absent du balayage');
  assert.deepEqual(absents.map((a) => `${a.pays}:${a.nom}`), [],
    'tout acteur de la base doit avoir sa ligne de mesure (ou une raison mesurée)');
});

test('deux lignes de la MÊME entreprise partagent une mesure — et c’est voulu', () => {
  // Le tableur allemand range « AIDA Cruises » deux fois : en « Croisières » et
  // en « Voyages ». Ce sont deux lignes, une seule entreprise, un seul site
  // (aida.de) — donc UNE mesure, et elle vaut pour les deux lignes. Le décompte
  // des mesures peut donc être plus petit que celui de la base : c'est une
  // propriété, pas une perte. Ce test l'exige explicitement pour qu'un futur
  // « il manque une mesure » ne soit pas corrigé en inventant une seconde.
  if (!mesures) return;
  const aida = base.acteurs.filter((a) => a.nom === 'AIDA Cruises');
  assert.ok(aida.length >= 2, 'AIDA Cruises est bien deux lignes dans la base allemande');
  assert.equal(new Set(aida.map((a) => `${a.nom}|${a.pays}`)).size, 1,
    'les deux lignes portent la même clé : elles partagent leur mesure');
  const lignes = mesures.acteurs.filter((a) => a.nom === 'AIDA Cruises');
  assert.equal(lignes.length, 1, 'et la mesure ne la duplique pas');
  // Le décompte publié est celui des MESURES, jamais un chiffre inventé.
  assert.equal(mesures.nombreActeurs, mesures.acteurs.length);
});

test('chaque pays de la base a ses mesures du bon pays', () => {
  if (!mesures) return;
  const parPays = {};
  for (const a of mesures.acteurs) parPays[a.pays] = (parPays[a.pays] || 0) + 1;
  const parPaysBase = {};
  for (const a of base.acteurs) parPaysBase[a.pays] = (parPaysBase[a.pays] || 0) + 1;
  for (const [p, n] of Object.entries(parPaysBase)) {
    assert.ok(parPays[p] > 0, `${p} a ${n} acteur(s) dans la base et aucune mesure`);
    // Le nombre de mesures ne peut pas DÉPASSER celui de la base : une mesure
    // sans acteur est orpheline, et elle ferait croire à un acteur de plus.
    assert.ok(parPays[p] <= n, `${p} : ${parPays[p]} mesures pour ${n} acteurs — mesure orpheline`);
  }
});

test('les preuves sont STRUCTURÉES : ce qui se clique, et ce qui s’explique', () => {
  // Défaut corrigé : la première version rendait la phrase entière et le
  // panneau en extrayait l'adresse par une expression qui supposait des
  // parenthèses. Elles n'y étaient pas — le lien affiché aurait été la PHRASE,
  // et cliquer dessus n'aurait rien ouvert.
  const e = { indices: [
    'signature « awin1.com » sur https://x.be',
    'page programme : https://x.be/affiliation',
    'aucune adresse ici',
  ] };
  const p = preuvesAffiliation(e);
  assert.equal(p.length, 2, 'les indices sans adresse ne sont pas des preuves cliquables');
  assert.ok(p.every((x) => /^https?:\/\//.test(x.url)), 'chaque preuve doit porter une adresse CLIQUABLE');
  assert.ok(p.every((x) => typeof x.quoi === 'string' && x.quoi.length), 'et de quoi il s’agit');
  assert.equal(p[1].url, 'https://x.be/affiliation');
  assert.match(p[1].quoi, /page programme/);
});

/* ------------------------------------- 3. L'outil de mesure : ce qu'il sait voir */

test('l’outil reconnaît la signature d’un réseau d’affiliation', () => {
  const html = '<a href="https://www.awin1.com/cread.php?awinmid=1&ued=x">voir</a> et <img src="//digidip.net/pixel">';
  const r = reseauxDans(html).map((x) => x.nom);
  assert.ok(r.includes('Awin'), 'awin1.com est la signature d’Awin');
  assert.ok(r.includes('Digidip'));
});

test('l’outil ne confond PAS un outil de mesure avec un réseau d’affiliation', () => {
  // Sinon la base se remplirait de faux programmes : Google Analytics est sur
  // presque tous les sites, et n'a jamais rien rapporté à personne.
  const r = reseauxDans('<script src="https://www.google-analytics.com/analytics.js"></script>'
    + '<script src="https://static.hotjar.com/x.js"></script>');
  assert.deepEqual(r, []);
});

test('« affiliation » seul ne fait pas un programme', () => {
  // Le mot apparaît dans les mentions légales de presque tous les sites. Sans
  // un mot d'ACTION à côté, on déclarerait un programme partout.
  assert.equal(parleDUnProgramme('<p>Ce site utilise des liens d’affiliation pour financer son hébergement.</p>'), false);
  assert.equal(parleDUnProgramme('<h1>Programme d’affiliation</h1><p>Rejoignez-nous et gagnez des commissions.</p>'), true);
  assert.equal(parleDUnProgramme('<h1>Affiliate programme</h1><p>Join us and earn revenue.</p>'), true);
});

test('l’outil suit les LIENS de programme au lieu de deviner des chemins', () => {
  // MESURÉ : chercher des chemins devinés (/affiliation, /affiliate…) a renvoyé
  // « aucun signe » sur Groupon, Ticketmaster et Coolblue — trois marchands qui
  // ONT un programme. Presque aucun ne le met à la racine ; presque tous le
  // mettent en pied de page.
  const html = '<footer><a href="/nl/affiliate-programma/">Word partner</a>'
    + '<a href="https://awin1.com/x">Awin</a><a href="/contact">Contact</a></footer>';
  const liens = liensProgramme(html, 'https://www.bongo.be');
  assert.equal(liens.length, 1, 'un seul lien interne doit être suivi');
  assert.equal(liens[0], 'https://www.bongo.be/nl/affiliate-programma/');
});

test('l’outil ne suit jamais un lien vers un AUTRE site', () => {
  // Un lien vers awin1.com est une SIGNATURE (déjà comptée), pas une page de
  // programme à visiter : le suivre ferait mesurer le réseau, pas le marchand.
  const liens = liensProgramme('<a href="https://www.awin1.com/cread.php?awinmid=1">notre partenaire</a>', 'https://x.be');
  assert.deepEqual(liens, []);
});

/* --------------------------------------------------- 4. Le panneau */

test('l’onglet Affiliation existe, avec le choix du pays et les trois groupes', () => {
  assert.match(admin, /data-vue="affiliation"/, 'l’onglet a disparu');
  assert.match(admin, /id="paysAffiliation"/, 'le choix du pays a disparu');
  assert.match(admin, /function dessinerBarreAffiliation\s*\(/);
  assert.match(admin, /function dessinerAffiliation\s*\(/);
  const ligne = admin.split('\n').find((l) => /dessinerBord\(\);/.test(l) && /dessinerAffiliation\(\)/.test(l));
  assert.ok(ligne, 'dessinerAffiliation() n’est appelée nulle part : l’onglet resterait vide');
  assert.match(admin, /programme trouvé/);
  assert.match(admin, /aucun signe/);
});

test('le panneau dit que « aucun signe » ne veut pas dire « pas d’affiliation »', () => {
  // Sans cette phrase, la liste se lit comme une liste de refus, et B conclut
  // qu'il n'y a rien à faire là où il y a justement quelque chose à demander.
  assert.match(admin, /ne veut pas dire « pas d’affiliation »/);
  assert.match(admin, /programme privé/);
});

test('le panneau dit d’où vient la mesure, et quand', () => {
  assert.match(admin, /affiliations\.json/, 'la source de la mesure doit être nommée');
  assert.match(admin, /aucun balayage/, 'une mesure absente doit être annoncée, pas masquée');
});

/* --------------------------------------------------- 5. Les notes */

test('l’encadré note est présent dans les DEUX onglets', () => {
  assert.match(admin, /function blocNote\s*\(/, 'l’encadré doit être fabriqué une seule fois');
  assert.match(admin, /<th>Note<\/th>/, 'le Marché Euro doit porter la colonne Note');
  const appels = (admin.match(/\$\{blocNote\(a\.nom\)\}/g) || []).length;
  assert.equal(appels, 2, 'l’encadré doit apparaître dans le Marché Euro ET dans l’Affiliation');
});

test('une seule réserve de notes pour les deux onglets', () => {
  const cles = admin.match(/kazendra\.notes/g) || [];
  assert.equal(new Set(cles).size, 1, 'une note parle d’un acteur, pas d’un onglet');
  assert.match(admin, /const CLE_NOTES = 'kazendra\.notes'/);
});

test('une note vidée est RETIRÉE, pas conservée vide', () => {
  const m = admin.match(/function ecrireNote\(nom, texte\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'ecrireNote() doit exister');
  assert.match(m[0], /delete n\[nom\]/, 'une note vidée doit être supprimée de la réserve');
});

test('la saisie d’une note survit au redessin de la liste', () => {
  // Même piège que pour les adresses : la liste est redessinée à chaque lettre
  // tapée dans la recherche. L'écouteur est donc posé sur le PANNEAU, pas sur
  // les champs — un écouteur par champ disparaîtrait avec lui.
  const m = admin.match(/panneau\.addEventListener\('change'[\s\S]*?\n    \}\);/);
  assert.ok(m, 'aucun écouteur délégué sur les notes');
  assert.match(m[0], /TEXTAREA/);
  assert.match(m[0], /dataset\.note/);
  assert.match(m[0], /ecrireNote\(nom/);
});

test('ouvrir un onglet le REDESSINE — sinon une note s’affiche vide ailleurs', () => {
  // Défaut mesuré : une note écrite dans l'Affiliation apparaissait VIDE dans le
  // Marché Euro, parce que les listes ne sont dessinées qu'au chargement. Il
  // fallait taper dans la recherche pour que le vide disparaisse — un défaut
  // qu'on ne voit qu'en changeant d'onglet.
  const m = admin.match(/const rafraichir = \{[\s\S]*?\n    \};/);
  assert.ok(m, 'le redessin au changement d’onglet a disparu');
  assert.match(m[0], /marche:/);
  assert.match(m[0], /affiliation:/);
  assert.match(admin, /if \(f\) f\(\)/, 'le redessin doit être réellement appelé');
});

/* --------------------------------------------------- 6. Les exports */

test('l’export de l’affiliation porte la note, et l’état mesuré', () => {
  assert.match(admin, /function csvAffiliation\s*\(/);
  assert.match(admin, /affCsv/);
  const m = admin.match(/function csvAffiliation\(\) \{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /a\.affiliation\.etat/, 'l’état mesuré doit figurer dans l’export');
  assert.match(m[0], /notes\[a\.nom\]/, 'la note doit figurer dans l’export');
});

test('l’export du Marché Euro porte la note AVANT la frontière informative', () => {
  const iNote = admin.indexOf("'Adresse des promotions', 'Note'");
  const iInf = admin.indexOf("'--- INFORMATIF ---'");
  assert.ok(iNote > -1, 'la colonne Note a disparu de l’export');
  assert.ok(iNote < iInf, 'la note sert au TRAVAIL : elle doit précéder les informations');
});
