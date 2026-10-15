# Onglet « Règles » du panneau — toutes les règles du site, classées et numérotées

Demande de B, 15/10/2026 : « peux-tu rajouter un onglet "règle" [...] toutes les règles qui
gèrent le site, tous les paramètres qui définissent les filtres, toutes les règles qui font
qu'une carte apparaissent et disparaissent [...] classées par catégorie, par thème et
numérotées. »

## Ce qui existe déjà, et pourquoi ça ne suffisait pas

| Fichier | Ce qu'il porte | Pourquoi il ne répond pas seul |
|---|---|---|
| `REGLES-DES-CARTES.md` (89 Ko) | l'histoire des décisions, R.1→R.16, 1.1→1.33 | chronologique, non classé, mêle l'actif et l'abrogé |
| `collecteur.mjs` | les règles et leurs constantes, en commentaire au-dessus de chacune | 9 458 lignes, illisible pour un humain pressé |
| `public/regles-affichage.js` | les quatre étages d'entrée d'une carte | ne dit rien de la disparition |
| `docs/` | les textes légaux | pas des règles de produit |

## La décision de conception

**Les valeurs affichées ne sont pas recopiées : elles sont LUES dans le code.**
`bin/regles-du-site.mjs` importe `collecteur.mjs` et `regles-affichage.js`, relit chaque
constante citée, et refuse de publier si une seule est introuvable ou si sa valeur a changé
sans que le catalogue le dise. Un onglet qui recopierait « 5 jours » mentirait le jour où le
code passerait à 4.

Deux fichiers, un seul auteur par information :

- `donnees/regles-du-site.json` — l'énoncé, le classement, l'état, la source, la preuve ;
- `collecteur.mjs` / `regles-affichage.js` / `app.js` — les valeurs.

## Forme du catalogue

Catégorie (A→G) → thème (A1, A2…) → règle numérotée (A1.1, A1.2…). Chaque règle porte :
énoncé, état (`active` · `en-pause` · `éteinte` · `en-mesure` · `à confirmer`), date d'entrée,
les constantes qu'elle cite, son fichier source et son épreuve.

## Les sept catégories

- **A — La collecte** : ce qui entre dans le catalogue (sources, rythme, prix, refus)
- **B — Les quatre étages** : ce qui fait qu'une carte s'affiche
- **C — La vie d'une carte** : ce qui la fait disparaître, et ce qui ne décide plus
- **D — L'ordre et l'écran** : classement, pays, devise, pagination
- **E — La veille** : les articles, qui ne sont pas des offres
- **F — La discrétion, la sécurité, les droits**
- **G — La méthode du chantier** : les règles de travail tenues depuis le 04/10

## Étapes

1. écrire `donnees/regles-du-site.json` ;
2. écrire `bin/regles-du-site.mjs` (génère `public/regles.json` + vérifie) ;
3. ajouter l'onglet `data-vue="regles"` au panneau ;
4. épreuve `tests/onglet-regles.test.mjs` (sans navigateur) ;
5. câbler le générateur dans `bin/collecter.sh` ;
6. exercer : tests verts + aperçu HTML.

## Vérification

- aucune valeur en dur : le générateur échoue si une constante citée manque ;
- aucune règle sans source ;
- l'onglet écrit « valeur absente » plutôt qu'un zéro quand une constante manque ;
- l'épreuve refait le rendu sur le catalogue publié et refuse un trou d'affichage
  (`undefined`, `NaN`, `[object Object]`).

## L'ENTRETIEN — demandé par B le 15/10/2026

« Cet onglet règle doit être mis à jour à chaque fois que nous établissons une nouvelle
règle pour le site. »

Ce n'est donc pas un état des lieux figé au 15/10/2026, mais un **document vivant**. La
règle est écrite **dans le catalogue lui-même** — thème **G4 « Tenir le catalogue des
règles »**, règles **G4.1** (toute règle nouvelle entre au catalogue le jour même) et
**G4.2** (un catalogue publié ne peut pas se périmer en silence) — donc elle est lisible
dans l'onglet, par celui qui s'y intéresse.

**Ce qui est appliqué sans le redemander, à chaque règle nouvelle :**

1. elle reçoit un **numéro** dans la catégorie et le thème qui la portent (A→G) ;
2. elle est écrite dans `donnees/regles-du-site.json` : énoncé, état, date, source, et
   l'épreuve quand il en existe une ;
3. si la règle est un **paramètre du code**, elle cite le **NOM de la constante** — le
   générateur relit sa valeur, jamais une valeur recopiée à la main ;
4. `node bin/regles-du-site.mjs` réécrit `public/regles.json`, que la publication copie
   dans `docs/` (le passage de collecte le fait de toute façon) ;
5. `bash bin/tester.sh` — dont l'épreuve qui compare l'empreinte des fichiers lus.

**Délai maximum à l'écran : quinze minutes**, le temps du passage suivant.

**Une règle éteinte ne s'efface pas** : elle passe en état `eteinte` et reste — c'est la
trace de la décision, pas un oubli à nettoyer.

**Un piège, rencontré en écrivant G4** : une valeur citée doit être un **littéral**.
`const BUDGET_VERDICT_OCTETS = 250 * 1024;` se lit `null`, et l'épreuve « chaque règle porte
un numéro, un état, un énoncé et une source » tombe alors avec « la valeur n'a pas été
lue » — le générateur n'évalue ni les expressions ni les objets. `= 65536`, `= 10200`,
`= 1024` passent ; `250 * 1024` ne passe pas.

## Ce qui reste ouvert, relevé le 15/10/2026

Le catalogue ne peut pas deviner qu'une règle vient d'être décidée : ce déclencheur est
humain. Mesuré ce soir-là — **onze constantes « qui décident » ne sont citées par aucune
règle** (famille `VIE_`/`SEUIL_`/`PLAFOND_`/`BUDGET_`/`DELAI_`/`QUOTA_`/`LIMITE_`/
`MAX_`/`MIN_`) :

`BUDGET_VERDICT_OCTETS` · `SEUIL_LOURD` · `QUOTA_DEPOT_MO` · `QUOTA_BANDE_PASSANTE_GO_MOIS` ·
`PLAFOND_PAGES_KREFEL` · `DELAI_LECTURE_MS` · `BUDGET_ENTETE` · `BUDGET` · `ECHEANCE` ·
`LIMITE_VEILLE` · `PLAFOND_VEILLE_PAYS`

Trois d'entre elles ne sont pas des règles (`BUDGET` et `ECHEANCE` sont des valeurs
dérivées, `LIMITE_VEILLE` se calcule) ; les autres ressemblent à des règles de politesse et
de volume qui **manquent au catalogue**. À trancher avec B.

Un verrou est possible, et il est étroit : refuser toute constante dont le NOM appartient
à cette famille et qu'aucune règle ne cite — avec, pour les vraies exceptions, une raison
écrite à côté. Chiffre : sur 181 constantes en majuscules, **94 ne sont citées par aucune
règle**, mais **onze seulement** portent un nom « qui décide ». C'est cet écart-là qui rend
le verrou utile (11 à traiter) plutôt qu'insupportable (94).
