# Marché Euro — retrait des colonnes du tableau « Les acteurs, par catégorie » (11–12/10/2026)

Journal de décisions. Il existe pour qu'une session suivante ne relise pas ces
retraits comme des oublis, et pour que les phrases de B soient citées, pas
paraphrasées.

## Ce qui est demandé, en clair

B, 11/10/2026 :

> « Au niveau du tableau de bord, kazendra.com/admin — onglet marché euro, les
> acteurs par catégorie. Cette base de données est liée à des fichiers Excel où on
> écrit les informations. Dans l'application, tu peux **définitivement** enlever les
> colonnes suivantes car elles ne servent à rien **à cet endroit-là** : Adresse,
> téléphone, email, CA indicatif, actionnariat, positionnement, segment,
> distribution, remarques. Tu peux laisser les notes. »

B, 12/10/2026 :

> « Tu peux aussi enlever les deux colonnes suivantes, toujours dans la même
> catégorie. **Type et Lu par**. »

**LA PORTÉE, ET RIEN DE PLUS :** le tableau « Les acteurs, par catégorie » de
l'onglet Marché Euro. « À cet endroit-là » veut dire *à l'écran* — pas dans la
base, pas dans l'export, pas dans le crayon.

| | avant | après |
|---|---|---|
| colonnes | 17 | **6** |

Acteur · État · Articles · Site · Adresse des promotions · **Note** (la note reste,
et reste la dernière).

## Ce qui a été retiré

1. **11/10/2026** — les neuf colonnes d'informations de siège : l'en-tête, les
   cellules de chaque ligne, la table d'ordre des colonnes, la fabrique des
   cellules et les paires (libellé, valeur) qu'elle lisait, le bloc d'aide qui les
   DÉCRIVAIT à l'écran (une phrase qui décrit des colonnes retirées n'est pas
   morte, elle est fausse), et les règles CSS devenues sans sélecteur — dont un
   bloc `.fiche-info` déjà mort avant ce retrait.
2. **12/10/2026** — « Type » et « Lu par » : les deux `<th>`, les deux `<td>`, la
   variable qui rassemblait les sources (elle n'existait que pour cette cellule),
   et les deux sélecteurs CSS devenus orphelins.

Deux scripts font le travail et **refusent d'écrire** si un marqueur manque ou
s'il reste une trace :
`outils/retirer-colonnes-siege.py`, `outils/retirer-colonnes-type-et-lu-par.py`
(essai à blanc par défaut, `--appliquer` pour écrire, copie d'avant dans /tmp —
jamais dans `public/`, qui est publié toutes les 5 minutes).

> **Note du 12/10/2026** : ces deux scripts ont été **archivés puis retirés** (leur effet
> est mesuré, tenu par les épreuves — 785/0 — et le tableau à 6 colonnes est vérifié en
> ligne par `outils/epreuve-colonnes-siege.py`, qui reste). Archive :
> `/opt/data/sauvegardes/promos-migrations-2026-10-12.tar.gz`. Voir
> `../CHECK-UP-KAZENDRA-2026-10-11.md` § 10.

## Ce qui reste, et pourquoi

- **Les informations restent dans la base** (`public/acteurs.json`) ;
- **et dans l'export CSV pour Excel** — c'est le lien avec les fichiers Excel dont
  B parle lui-même : on n'y touche pas. Le TYPE y est aussi (champ de travail) ;
- **la fiche du crayon** garde les onze champs : elle sert à COMPLÉTER la base, et
  ses champs partent à l'export des fiches. Retirer la saisie avec l'affichage
  aurait été la confusion à éviter — une épreuve la protège désormais ;
- **le plan de régularisation**, sous la liste, garde ses colonnes : « Vu par »
  (bloc 1, ceux qu'on voit sans les lire) et « Type » + « Distribution » (bloc 2,
  ceux qu'on ne suit pas). C'est là qu'on AGIT sur les sources ; ce sont des
  tableaux de travail, pas la liste des acteurs.

## Conséquences vérifiées

- **Un défaut réparé au passage** : « Positionnement » était ABSENT de l'export
  CSV — en-tête *et* valeur — alors que le tableau l'affichait. Comme il manquait
  des deux listes, les deux comptaient pareil et aucun contrôle de comptage ne
  pouvait le voir. Réparé, avec une épreuve qui nomme les 23 libellés attendus.
- **Tests** : 771 tests, 769 réussis, 2 échecs — les MÊMES deux échecs connus
  qu'avant ce chantier (une date de relevé, une adresse déclarée qui répond 404).
  Les épreuves qui **exigeaient l'inverse** (les colonnes, leur ordre, la largeur
  de la fiche) ont été **retournées et datées**, jamais supprimées.
- **Le défaut de tout retrait de colonne** — la ligne garde une case d'avance et
  le tableau reste lisible et faux — est désormais surveillé : une épreuve compte
  les cases de la ligne et les compare à l'en-tête, et la largeur de la fiche
  (`colspan`) est comparée au même nombre.
- **Mesuré dans un vrai navigateur, sur le site PUBLIÉ** (`kazendra.com/admin`) :
  l'en-tête fait exactement six colonnes dans l'ordre, chaque ligne d'acteur écrit
  six cases, la fiche s'étale sur six colonnes, la note est la dernière case, les
  onze champs du crayon sont là, et le CSV **téléchargé pour de vrai** porte ses
  23 libellés (Positionnement compris) et 23 cases sur chacune de ses 149 lignes.
  Script : `outils/epreuve-colonnes-siege.py` (accepte une URL).
- **Une demande de B, une mesure** : le retrait fait passer le tableau de 17 à 6
  colonnes, et il ne coûte aucune donnée — seulement de l'affichage.

## Défauts de mes propres outils, trouvés au passage

- L'épreuve navigateur lisait l'en-tête avec `innerText` : les catégories sont
  REPLIÉES au départ, donc elle rendait huit libellés VIDES alors que le tableau
  était juste. Corrigé en `textContent`.
- Elle comptait aussi la **ligne de la fiche** (une seule case, qui s'étale sur
  toute la largeur) comme une ligne d'acteur : « cases par ligne = [1, 8] ». La
  fiche est maintenant exclue du compte, et son `colspan` est mesuré à part.
- La copie d'avant le premier retrait avait atterri dans `public/admin/` — donc
  PUBLIABLE par le collecteur, qui recopie `public/` vers `docs/` et pousse sur
  GitHub toutes les cinq minutes. Déplacée dans /tmp, et le script corrigé.
