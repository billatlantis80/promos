/**
 * AUCUN TEXTE VISIBLE NE DOIT RESTER EN FRANÇAIS DANS LES NEUF LANGUES.
 * =============================================================================
 *
 * CE QUE CE FICHIER EMPÊCHE
 *
 * Sept phrases visibles de l'application étaient écrites EN CLAIR dans les
 * gabarits, hors de tout appel à t() : les boutons de la fiche de compte, une
 * infobulle, la phrase sur les pays d'Europe, le message d'écran vide. Leur
 * traduction existait pourtant dans les neuf dictionnaires — préparée, puis
 * jamais branchée. Avec l'interface en anglais, ces phrases restaient
 * françaises, et RIEN ne le signalait : ni à l'écran, ni dans les tests.
 *
 * C'est le même défaut que celui déjà corrigé sur le bloc des droits, et il
 * mérite le même garde-fou. Le contrôle du bloc des droits ne couvrait que son
 * propre bloc ; celui-ci couvre le reste.
 *
 * POURQUOI UNE LISTE NOMMÉE, ET PAS UN BALAYAGE AUTOMATIQUE. Un balayage qui
 * cherche « du français » se trompe dans les deux sens : il accuse des phrases
 * anglaises, et il laisse passer « Changer le mot de passe », qui ne contient
 * aucun mot français reconnaissable. La liste nommée dit exactement ce qu'elle
 * protège — et quand une phrase s'ajoute, il faut l'ajouter ici, sinon on l'a
 * oubliée deux fois.
 *
 * Lancement : node --test tests/textes-branches.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APP = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const LANGUES = readFileSync(new URL('../public/langues.js', import.meta.url), 'utf8');
const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

/* Les phrases que B lit à l'écran, et qui étaient en clair. Elles doivent être
   DANS un appel à t(...) : c'est le seul moyen d'être traduites.

   DEUXIÈME PASSE, le même jour : un premier balayage ne regardait que les textes
   entre balises (<p>…</p>). Il avait laissé passer tout ce qui s'écrit par
   `.textContent`, c'est-à-dire l'écran de verrouillage, les messages d'écran
   vide et le bouton de suppression armée. C'est la deuxième fois dans ce projet
   qu'un inventaire trop étroit annonce « rien trouvé » — après le vérificateur
   de catégories qui ne parcourait qu'une partie des familles. */
const PHRASES = [
  'Aperçu',                              // infobulle de la pastille du profil
  'Changer le mot de passe',
  'Verrouiller maintenant',
  'Télécharger mes données',
  "Seuls des pays d'Europe sont proposés : les trajets restent courts.",
  "Aucune bonne promo ici pour l'instant : nous n'affichons que des offres à prix réel "
  + '— deux prix affichés quand la remise peut être démontrée, et pour les autres enseignes '
  + 'un prix réel avec le nom de la boutique.',
  'Voir toutes les offres',
  // Les textes écrits par .textContent, oubliés par le premier balayage.
  "Aucun favori pour l'instant. Touche l'étoile d'une offre pour la garder de côté.",
  'Aucune offre ne correspond à ce filtre.',
  'Appuie encore pour confirmer',
  "J'ai oublié mon mot de passe",
  'Effacer le compte et les données (appuie encore)',
];

const dansT = (src, phrase) => src.includes(`t('${phrase}')`) || src.includes(`t("${phrase}")`);

test('chaque phrase visible passe par le moteur de traduction', () => {
  const oubliees = PHRASES.filter((p) => !dansT(APP, p));
  assert.deepEqual(oubliees, [],
    'Phrase(s) affichée(s) en français quelle que soit la langue :\n  - '
    + oubliees.map((p) => p.slice(0, 60)).join('\n  - '));
});

test('chaque phrase traduite existe vraiment dans les neuf dictionnaires', () => {
  // Brancher une phrase sans sa traduction ne la traduit pas : t() rend alors la
  // clé telle quelle — le français, en silence. Le câblage aurait l'air fait.
  //
  // DEUX PIÈGES DE RECHERCHE, tous deux rencontrés en écrivant ce test : la clé
  // peut être entre guillemets simples OU doubles selon qu'elle contient une
  // apostrophe, et l'apostrophe y est alors ÉCHAPPÉE (« d\'Europe »). Chercher
  // la phrase telle quelle annonçait « 0 langue » sur deux clés parfaitement
  // présentes.
  const SRC = LANGUES.replace(/\\'/g, "'");
  const manquantes = [];
  for (const p of PHRASES) {
    const motif = `(['"])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`;
    const n = (SRC.match(new RegExp(motif, 'g')) || []).length;
    if (n !== 9) manquantes.push(`${p.slice(0, 45)}… : ${n} langue(s), 9 attendues`);
  }
  assert.deepEqual(manquantes, [], manquantes.join('\n'));
});

test('les boutons de la fiche de compte sont tous câblés, pas seulement traduits', () => {
  // Le contrôle précis qui manquait : les trois boutons portaient leur texte en
  // clair, entre les balises, alors que la traduction dormait à côté.
  for (const [id, phrase] of [
    ['changerMdp', 'Changer le mot de passe'],
    ['verrouiller', 'Verrouiller maintenant'],
    ['exporterDonnees', 'Télécharger mes données'],
  ]) {
    const m = APP.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`));
    assert.ok(m, `le bouton #${id} est introuvable`);
    assert.ok(m[1].includes('t('),
      `le texte du bouton #${id} est écrit en clair : il restera en français `
      + `dans les neuf langues (« ${phrase} »)`);
  }
});

test('aucun texte passé à t() ne contient de balise HTML', () => {
  // Une balise ENTRE dans une phrase traduite oblige à la replacer correctement
  // dans les neuf langues — et le mot mis en avant n'est pas le même partout.
  // Le projet garde la balise HORS de la phrase traduite. C'est aussi ce qui a
  // fait perdre le gras de « bonne promo » au message d'écran vide : on le dit
  // ici pour que la raison reste écrite quelque part.
  for (const p of PHRASES) {
    assert.ok(!/<\/?[a-z]/.test(p), `« ${p.slice(0, 40)}… » contient une balise HTML`);
  }
});

test('les deux phrases de l’écran de verrouillage passent aussi par t()', () => {
  // Elles changent selon que l'on a déjà demandé « mot de passe oublié » ou non,
  // et elles s'écrivent par .textContent — invisible pour un balayage qui ne
  // regarde que les textes entre balises. On vérifie les DEUX, et la clé.
  const m = APP.match(/verrouIntro'\)\.textContent = t\("([^"]+)"\)/g) || [];
  assert.equal(m.length, 2,
    `les deux textes de l’écran de verrouillage doivent passer par t(), or ${m.length} le font`);
  for (const ligne of m) {
    const cle = ligne.match(/t\("([^"]+)"\)/)[1];
    assert.ok(cle.length > 40, `clé de verrouillage suspecte : « ${cle} »`);
  }
});

test('les textes de l’interface venus de index.html sont déclarés traduisibles', () => {
  // Un texte en clair dans le HTML ne passe pas par t() : il passe par
  // l'attribut data-i18n, que traduireDOM() relit. Sans l'attribut, il resterait
  // français.
  //
  // traduireDOM() VIT DANS langues.js, PAS DANS app.js — c'est app.js qui
  // l'importe. La première version de ce test la cherchait dans app.js et
  // échouait en accusant le mauvais fichier.
  const LANGUES_SRC = readFileSync(new URL('../public/langues.js', import.meta.url), 'utf8');
  assert.match(HTML, /data-i18n="[^"]+"/, 'aucun texte de index.html n’est déclaré traduisible');
  assert.match(LANGUES_SRC, /data-i18n/, 'traduireDOM() doit relire les attributs data-i18n');
});
