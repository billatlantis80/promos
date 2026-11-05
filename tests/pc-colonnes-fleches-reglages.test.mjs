/**
 * LES TROIS AFFICHAGES, LES DEUX FLÈCHES, ET LES RÉGLAGES SUR PC.
 *
 * Demandes de B (11/10/2026), mot pour mot :
 *   « il y a trois possibilités. Je veux une qui offre les quatre bandes, une qui
 *     offre deux bandes, et une qui offre une seule bande. »
 *   « nous allons mettre une sorte de flèche qui amène à la catégorie suivante ou
 *     recule dans la catégorie précédente, quand c'est possible. L'utilisateur
 *     pourra utiliser avec la souris. »
 *   « Le fond d'écran de la partie réglage est trop agressif tout est en blanc
 *     […] il faut trouver une solution pour que ce soit moins agressif à l'œil et
 *     au visage, et que les informations soient mises en évidence. »
 *   « Sur PC, tu dois redimensionner la partie compte […] à côté tu viendras
 *     mettre le panneau langue. […] Les deux informations sur la même ligne
 *     d'écran, pour la douceur de l'œil et pour ne pas devoir scroller. »
 *
 * Le CSS est lu APRÈS retrait des commentaires : un commentaire qui parle de
 * « quatre colonnes » ne prouve rien, et ces fichiers en sont pleins.
 *
 * Lancement : node --test tests/pc-colonnes-fleches-reglages.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (f) => fs.readFileSync(path.join(ICI, '..', 'public', f), 'utf8');
const CSS_BRUT = lire('app.css');
const CSS = CSS_BRUT.replace(/\/\*[\s\S]*?\*\//g, '');
const JS = lire('app.js');
// La feuille est posée EN LIGNE dans la page : on la retire avant de lire la
// structure (sinon les règles CSS répondent à la place du HTML).
const HTML = lire('index.html').replace(
  /<!-- DEBUT-FEUILLE-EN-LIGNE -->[\s\S]*?<!-- FIN-FEUILLE-EN-LIGNE -->/,
  '<!-- feuille en ligne retirée -->',
);

/** La règle CSS complète qui commence par ce sélecteur, ou null. */
function regle(selecteur) {
  const i = CSS.indexOf(selecteur);
  if (i < 0) return null;
  const fin = CSS.indexOf('}', i);
  return fin < 0 ? null : CSS.slice(i, fin + 1);
}

test('sur grand écran, les trois affichages font quatre, deux et une colonne', () => {
  // Quatre colonnes : c'est le dessin « grille », et il existait déjà au-delà de
  // 980 px. On le VERROUILLE ici : c'est l'une des trois bandes demandées.
  // ⚠ On cherche la RÈGLE ENTIÈRE, media query comprise : « body[data-vue=grille]
  // .grille » apparaît trois fois (620, 980), et une recherche de sous-chaîne
  // tombait sur le palier de 620 — elle accusait alors une grille qui allait bien.
  const g4 = CSS.match(
    /@media \(min-width: 980px\) \{\s*body\[data-vue="grille"\] \.grille \{ grid-template-columns: repeat\(4, 1fr\); \}/);
  assert.ok(g4, 'la grille à quatre colonnes doit exister à partir de 980 px');

  // Deux colonnes : la vue « liste ». Elle ne doit PAS rester sur une colonne —
  // c'est exactement ce que B a demandé de changer.
  const l2 = CSS.match(
    /@media \(min-width: 620px\) \{\s*body\[data-vue="liste"\] \.grille \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.ok(l2, 'la vue « deux colonnes » doit exister à partir de 620 px');

  // Une colonne : la vue « compacte ». Elle tient SA largeur de la règle de base
  // de `.grille` (1fr) — on vérifie donc qu'AUCUN palier ne lui ajoute de colonne,
  // sinon la « une bande » n'en serait plus une.
  assert.ok(!/body\[data-vue="compacte"\] \.grille[^}]*grid-template-columns/.test(CSS),
    'la vue « une colonne » ne doit jamais recevoir de deuxième colonne');
  // ⚠ Ancre prudente : « .grille { » apparaît AUSSI dans « body[data-vue="grille"]
  // .grille { » — une recherche de sous-chaîne tombait sur la grille du tableau et
  // accusait une base qui allait très bien (défaut payé à la première exécution).
  const base = CSS.match(/^\.grille \{([^}]*)\}/m);
  assert.ok(base, 'la règle de base .grille doit exister');
  assert.match(base[1], /grid-template-columns: 1fr;/, 'la base est une colonne');
  // Et la bande UNIQUE respire sur grand écran : vignette large, titre lisible.
  assert.match(CSS, /body\[data-vue="compacte"\] \.offre \.visuel \{ flex-basis: 200px;/,
    'la bande unique doit offrir une vraie vignette sur grand écran');
  assert.match(CSS, /body\[data-vue="compacte"\] \.offre h3 \{ font-size: 16.5px;/,
    'et un titre à taille de lecture');
});

test('les trois boutons disent ce qu’on obtient — plus l’ancien dessin', () => {
  const vues = HTML.slice(HTML.indexOf('class="vues"'), HTML.indexOf('</div>', HTML.indexOf('class="vues"')));
  assert.match(vues, /data-vue="grille"[\s\S]*?aria-label="Quatre colonnes"/, 'quatre colonnes annoncées');
  assert.match(vues, /data-vue="liste"[\s\S]*?aria-label="Deux colonnes"/, 'deux colonnes annoncées');
  assert.match(vues, /data-vue="compacte"[\s\S]*?aria-label="Une colonne, toute la largeur"/,
    'une colonne annoncée');
  // Les libellés de l'ancien dessin ne doivent plus exister nulle part : ni dans
  // la page, ni dans les dictionnaires (une clé morte ment sur ce qui est branché).
  const langues = lire('langues.js');
  assert.doesNotMatch(langues, /'Tableau : deux offres côte à côte'/,
    'l’ancien libellé doit avoir quitté les neuf dictionnaires');
  assert.doesNotMatch(langues, /'Compacte : vignette et texte serrés'/,
    'l’ancien libellé doit avoir quitté les neuf dictionnaires');
});

test('les deux flèches existent, POSÉES SUR L’ÉCRAN, et seulement avec une souris', () => {
  assert.match(HTML, /id="rubriquePrec"/, 'la flèche « précédente » doit être dans la page');
  assert.match(HTML, /id="rubriqueSuiv"/, 'la flèche « suivante » doit être dans la page');
  assert.match(HTML, /id="rubriquePrec"[\s\S]{0,400}?data-i18n-aria-label="Rubrique précédente"/,
    'son libellé doit être traduisible');
  // CORRECTION DE B, 11/10/2026 : « La flèche que je t'ai demandé pour swape et
  // pour le PC, ce n'était pas pour les catégories, c'était pour les pages
  // d'article, afin de changer de catégorie sans devoir monter en haut pour
  // changer de catégorie. »
  // Elles ne sont donc PAS dans la barre des rubriques — qui est justement ce
  // qu'on ne veut pas remonter — mais POSÉES sur l'écran, à mi-hauteur.
  assert.match(HTML, /<nav class="puces" id="puces"><\/nav>/,
    'la barre des rubriques ne doit plus porter les flèches : elles ne sont pas pour elle');
  assert.doesNotMatch(CSS, /\.barre-rubriques/, 'l’ancien encadrement des flèches dans la barre doit avoir disparu');
  const blocFleches = regle('.fleches {');
  assert.ok(blocFleches, 'le conteneur des flèches doit exister');
  assert.match(blocFleches, /position: fixed/, 'les flèches doivent ÊTRE POSÉES sur l’écran');
  assert.match(blocFleches, /pointer-events: none/, 'le conteneur ne doit pas intercepter les clics de la page');
  const blocFleche = regle('.fleche {');
  assert.match(blocFleche, /position: absolute; top: 50%/, 'les boutons se placent à mi-hauteur');
  assert.match(blocFleche, /pointer-events: auto/, 'mais les boutons, eux, se cliquent');
  assert.match(CSS, /#rubriquePrec \{ left: 8px; \}/, 'la flèche « précédente » se tient au bord GAUCHE');
  assert.match(CSS, /#rubriqueSuiv \{ right: 8px; \}/, 'la flèche « suivante » se tient au bord DROIT');
  // Affichage : souris seulement. Un téléphone garde le glisser du doigt.
  assert.match(CSS, /@media \(hover: hover\) and \(pointer: fine\) \{ \.fleche \{ display: flex; \} \}/,
    'les flèches ne s’affichent que sur un appareil à pointeur précis');
  assert.match(blocFleche, /display: none;/, 'et sont cachées par défaut');
  // Elles passent SOUS la feuille des réglages : on ne change pas de rubrique en
  // réglant quelque chose.
  assert.match(CSS, /\.fleches \{ position: fixed; inset: 0; z-index: 6;/,
    'elles doivent rester sous la feuille des réglages (z-index 40)');
});

test('les flèches s’éteignent aux deux bouts, et ne bouclent pas', () => {
  // On EXÉCUTE les vraies fonctions avec une barre simulée : c'est le seul moyen
  // de dire ce qui se passe aux extrémités, et pas seulement ce que le code écrit.
  const barre = {
    querySelectorAll: () => ['tout', 'tech', 'mode'].map((c) => ({ dataset: { cat: c } })),
  };
  const fleches = { rubriquePrec: { disabled: null }, rubriqueSuiv: { disabled: null } };
  const appels = [];
  const ctx = vm.createContext({
    $: (id) => (id === 'puces' ? barre : fleches[id]),
    etat: { categorie: 'tout' },
    changerRubrique: (cat) => { appels.push(cat); ctx.etat.categorie = cat; },
  });
  const bloc = (nom) => {
    const debut = JS.indexOf(`function ${nom}(`);
    assert.ok(debut > 0, `${nom}() doit exister`);
    let profondeur = 0;
    for (let i = JS.indexOf('{', debut); i < JS.length; i++) {
      if (JS[i] === '{') profondeur++;
      else if (JS[i] === '}' && --profondeur === 0) return JS.slice(debut, i + 1);
    }
    throw new Error(`accolades non équilibrées dans ${nom}()`);
  };
  vm.runInContext([bloc('rubriquesBarre'), bloc('majFleches'), bloc('rubriqueVoisine')].join('\n'), ctx);

  ctx.majFleches();
  assert.equal(fleches.rubriquePrec.disabled, true, 'à la PREMIÈRE rubrique, « précédente » est éteinte');
  assert.equal(fleches.rubriqueSuiv.disabled, false, 'mais « suivante » reste allumée');

  ctx.rubriqueVoisine(1);
  assert.deepEqual(appels, ['tech'], 'la flèche suivante avance d’une rubrique');
  ctx.majFleches();
  assert.equal(fleches.rubriquePrec.disabled, false, 'au milieu, les deux flèches sont allumées');

  ctx.rubriqueVoisine(1);               // → mode, la dernière
  ctx.majFleches();
  assert.equal(fleches.rubriqueSuiv.disabled, true, 'à la DERNIÈRE rubrique, « suivante » est éteinte');
  ctx.rubriqueVoisine(1);
  assert.deepEqual(appels, ['tech', 'mode'], 'au bout, on ne boucle pas : rien de plus');

  ctx.etat.categorie = 'tout';
  ctx.rubriqueVoisine(-1);
  assert.deepEqual(appels, ['tech', 'mode'], 'à la première, reculer ne fait rien');
});

test('l’état des flèches suit CHAQUE rendu — pas seulement le clic', () => {
  // Un glisser du doigt, un changement de pays, un retour du filtre « tout » :
  // tous passent par `marquerPuce`. Si les flèches n'étaient mises à jour qu'au
  // clic, elles resteraient allumées au mauvais bout après un geste.
  const marquer = JS.slice(JS.indexOf('function marquerPuce('), JS.indexOf('/* ---------- LE GLISSER'));
  assert.match(marquer, /majFleches\(\)/, 'marquerPuce() doit remettre les flèches à jour');
  assert.match(JS, /\$\('rubriquePrec'\)\.addEventListener\('click', \(\) => rubriqueVoisine\(-1\)\)/,
    'la flèche précédente doit reculer d’une rubrique');
  assert.match(JS, /\$\('rubriqueSuiv'\)\.addEventListener\('click', \(\) => rubriqueVoisine\(1\)\)/,
    'la flèche suivante doit avancer d’une rubrique');
});

test('le fond des réglages n’éblouit plus, et l’information ressort', () => {
  // Le fond : une teinte SOURDE, avec la ligne de repli juste avant pour les
  // navigateurs qui ne connaissent pas color-mix (la feuille est servie telle
  // quelle à tout le monde).
  const feuille = regle('.feuille {');
  assert.ok(feuille, 'la feuille des réglages doit exister');
  assert.match(feuille, /background: var\(--fond\);/,
    'le repli doit venir AVANT : un navigateur qui ignore color-mix garde ce fond-là');
  assert.match(feuille, /background: color-mix\(in srgb, var\(--fond\) 86%, var\(--texte\) 14%\)/,
    'et le fond adouci doit mélanger fond et texte — plus clair sur un thème sombre, plus sourd sur un thème clair');
  // L'information se pose sur une carte : c'est le bloc qui ressort.
  const rubrique = regle('.rubrique {');
  assert.match(rubrique, /background: var\(--carte\)/, 'chaque rubrique doit être une carte');
  assert.match(rubrique, /border: 1px solid var\(--bord\)/, 'avec son contour');
  assert.match(rubrique, /border-radius: 14px/, 'et des angles doux');
  assert.match(rubrique, /padding: 14px 16px/, 'et de l’air autour du texte');
});

test('les grilles internes des réglages s’adaptent à la place qu’elles ont', () => {
  // DÉFAUT VU À L'ÉCRAN, 11/10/2026 : dans la colonne de 510 px des réglages sur
  // PC, trois colonnes de vignettes ne tenaient pas — « Forê… » et « Clair »
  // sortaient de la carte, et le nombre des pays s'écrivait PAR-DESSUS le nom
  // (« France 582 »). Les paliers en pixels portaient sur la largeur de la
  // FENÊTRE, qui ne dit rien de la largeur de la COLONNE.
  assert.match(CSS, /\.themes \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(170px, 1fr\)\); gap: 8px; \}/,
    'la grille des thèmes doit compter sur la place RÉELLE dont elle dispose');
  assert.match(CSS, /\.pays-liste\.pays-2col \{ grid-template-columns: repeat\(auto-fill, minmax\(185px, 1fr\)\); \}/,
    'la liste des pays aussi — elle vit dans trois conteneurs de largeurs très différentes');
  assert.doesNotMatch(CSS,
    /@media \(min-width: 620px\) \{ \.pays-liste\.pays-2col \{ grid-template-columns: repeat\(3/,
    'le palier sur la largeur de la fenêtre ne doit pas revenir : il ne sait rien de la colonne');
});

test('sur PC, les réglages se lisent par deux, sans faire défiler', () => {
  const bloc = CSS.slice(CSS.indexOf('@media (min-width: 1024px) {'), CSS.indexOf('/* Grille des dix thèmes'));
  assert.ok(bloc.length > 400, `bloc PC introuvable (${bloc.length} caractères)`);
  // AUCUN ENCADRÉ PLUS GRAND QUE SON TEXTE (B, 12/10/2026 : « il faut supprimer
  // tous les espaces blancs, par exemple point de contact c'est flagrant, il y a
  // deux lignes écrites et 40 lignes vides »). Mesuré : 1 218 px de vide
  // intérieur avant, 10 px après. C'est `align-items: start` qui le garantit —
  // l'étirement par défaut d'une grille faisait remplir toute la rangée à une
  // carte courte. L'ancien `grid-template-rows: auto 1fr` est PARTI avec lui.
  assert.match(bloc,
    /\.panneau\[data-panneau="compte"\],\s*\.panneau\[data-panneau="affichage"\],\s*\.panneau\[data-panneau="infos"\] \{[\s\S]*?align-items: start;/,
    'chaque encadré doit prendre la hauteur de son texte');
  assert.doesNotMatch(bloc, /grid-template-rows: auto 1fr/,
    'plus d’étirement de rangée : c’est lui qui creusait les lignes vides');
  // Informations : les trois notes courtes à gauche, « Tes données, tes droits »
  // à droite sur les trois rangées — les colonnes finissent ensemble.
  assert.match(bloc,
    /\.panneau\[data-panneau="infos"\] > \.rubrique:nth-child\(2\) \{ grid-area: 1 \/ 2 \/ span 3; \}/,
    '« Tes données, tes droits » tient la colonne de droite');
  // Compte : la colonne du formulaire fait EXACTEMENT la largeur du formulaire.
  assert.match(bloc, /\.panneau\[data-panneau="compte"\] \{ grid-template-columns: minmax\(0, 440px\) minmax\(0, 1fr\); \}/,
    'la colonne du formulaire se resserre à 440 px');
  // Thème et affichage / Informations : deux colonnes de largeur égale.
  assert.match(bloc, /\.panneau\[data-panneau="affichage"\],\s*\.panneau\[data-panneau="infos"\] \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/,
    'les deux autres onglets doivent avoir deux colonnes de largeur ÉGALE (symétrie)');
  // Compte : DEUX rubriques, deux colonnes. L'inscription à gauche (elle garde la
  // largeur du formulaire), la langue à droite. La rubrique « Profil » a été
  // retirée le 12/10/2026 (décision de B : « il n'y a aucune plus-value à mettre
  // son nom ») — il n'y a plus rien d'autre à ranger ici.
  assert.match(bloc, /\.panneau\[data-panneau="compte"\] > \.rubrique:nth-child\(1\) \{ grid-area: 1 \/ 1; \}/,
    'l’inscription est en haut à gauche');
  assert.match(bloc, /\.panneau\[data-panneau="compte"\] > \.rubrique:nth-child\(2\) \{ grid-area: 1 \/ 2; \}/,
    'et la langue À CÔTÉ d’elle, à droite');
  // RIEN NE RESTE DU PROFIL, ET C'EST VÉRIFIÉ ICI : ni point de rendu, ni dessin,
  // ni clé mémorisée. Un encadré retiré dont le code survit revient toujours.
  assert.doesNotMatch(CSS, /ligne-profil/,
    'la mise en page de la pastille du profil doit avoir disparu');
  // On cherche les NOMS DU CODE, pas le mot « profil » : le commentaire qui
  // raconte la suppression cite forcément la clé « promos.profil ».
  assert.doesNotMatch(JS, /regProfil|dessinerProfil|chargerProfil|CLE_PROFIL/,
    'plus aucune trace du profil dans le programme (ni point de rendu, ni clé)');
  // LA RUBRIQUE « AFFICHAGE » A DISPARU (B, 12/10/2026 : « la rubrique affichage,
  // les mêmes réglages que la barre du haut réunit ici, peut disparaître
  // définitivement, car ça n'a pas d'utilité »). L'onglet ne garde que DEUX
  // rubriques, côte à côte : les thèmes à gauche, le pays à droite.
  assert.match(bloc, /\.panneau\[data-panneau="affichage"\] > \.rubrique:nth-child\(1\) \{ grid-area: 1 \/ 1; \}/,
    'les thèmes restent en haut à gauche');
  assert.match(bloc, /\.panneau\[data-panneau="affichage"\] > \.rubrique:nth-child\(2\) \{ grid-area: 1 \/ 2; \}/,
    'et le pays passe à droite, sur la même rangée');
  assert.doesNotMatch(bloc, /data-panneau="affichage"\] > \.rubrique:nth-child\(3\)/,
    'il ne doit plus rester de troisième rubrique dans l’onglet Thème et pays');
  // Un réglage, un seul endroit : plus de miroir des boutons de la barre du haut.
  assert.doesNotMatch(JS, /regAffichage|data-eco-miroir|NOMS_VUES/,
    'plus rien ne doit rester du miroir des réglages de la barre du haut');
  // L'encadré d'inscription se resserre ENCORE (« je trouve toujours le panneau
  // d'inscription un peu trop grand »), et les champs suivent.
  assert.match(bloc, /#regCompte \{ max-width: 440px; \}/, 'l’encadré d’inscription doit être resserré à 440 px');
  assert.match(bloc, /\.panneau\[data-panneau="compte"\] \.champ \{ margin: 7px 0; gap: 5px; \}/,
    'les champs doivent se resserrer verticalement eux aussi');
  // ⚠ RETOURNÉ LE 11/10/2026 : ce contrôle exigeait les DEUX MOTS DE PASSE côte à
  // côte sur PC — deux champs qui n'existent plus. Ce que B demande maintenant au
  // même endroit : « redimensionner les deux encadrements inscription et langue
  // pour qu'il soit à la même hauteur ». C'est la grille qui les égalise, et rien
  // d'autre : `stretch` étire les deux colonnes à la hauteur de la plus haute
  // (`start`, appliqué partout ailleurs, laissait la langue plus courte).
  assert.match(bloc, /\.panneau\[data-panneau="compte"\] \{ align-items: stretch; \}/,
    'les deux encadrés de l’onglet Compte doivent avoir la même hauteur');
  // Et la colonne de lecture est bornée : une ligne de 2 000 px se perd.
  assert.match(bloc, /\.panneau \{ max-width: 1100px; margin-left: auto; margin-right: auto; \}/,
    'le contenu doit être borné et centré sur grand écran');
  // MAIS LE BANDEAU BLEU, LUI, VA D'UN BORD À L'AUTRE. Il portait le même plafond
  // que les panneaux : mesuré le 12/10/2026, il s'arrêtait à 1 100 px alors que les
  // cartes vont jusqu'à 1 240 px — « la partie du choix des langues dépasse par
  // rapport à l'encadré bleu du haut », mot de B. Le voici déplafonné.
  assert.doesNotMatch(bloc, /\.feuille-haut, \.panneau \{ max-width/,
    'le bandeau ne doit plus partager le plafond des panneaux');
  assert.match(bloc, /\.feuille-haut \{ max-width: none;/,
    'le bandeau bleu doit prendre toute la largeur de la feuille');
  // LE TROISIÈME BOUTON D'AFFICHAGE DEVIENT LE BOUTON DE LANGUE, SUR PC
  // (B, 12/10/2026 : « il y a 3 onglets qui font affichage par 4, 2 et 1, tu
  // gardes uniquement les boutons 4 et 2, le bouton 1 encadrement, tu changes la
  // fonction tu gardes le bouton et tu mets les langues à la place »). Ces deux
  // règles vivent dans le SECOND palier PC : on interroge donc la feuille entière.
  assert.match(CSS, /\.vues \.vue\[data-vue="compacte"\] \{ display: none; \}/,
    'sur PC, le mode « une colonne » est retiré de la rangée');
  assert.match(CSS, /\.vue-langue \{ display: inline-flex; \}/,
    'et le bouton de langue prend sa place');
  // LE BOUTON ÉCO SUIT LE THÈME (B, 12/10/2026 : « il reste à sa place mais sera
  // adapté par le thème du site, changement des couleurs »). Toutes ses couleurs
  // viennent des jetons : aucun code en dur, les onze thèmes l'habillent.
  assert.match(CSS, /#eco:not\(\.on\) \{ background: var\(--carte-2\); \}/,
    'le bouton Éco prend la famille de couleurs des boutons d’affichage');
  assert.doesNotMatch(CSS, /data-eco-miroir/,
    'plus de bouton Éco en double : la rubrique « Affichage » a disparu (12/10/2026)');
  assert.match(CSS, /\.fleche-choix svg \{[\s\S]*?stroke: currentColor;/,
    'la flèche de choix est dessinée d’un trait qui suit le thème');
  assert.match(CSS, /#pays b \{ font-weight: 400; font-size: 13px; \}/,
    'le nom du pays n’est plus en gras, et il a la taille du nombre');
  assert.match(CSS, /#pays \.n \{ color: var\(--doux\); font-size: 13px; \}/,
    'le nombre a la MÊME taille que le nom : les deux s’alignent');
});
