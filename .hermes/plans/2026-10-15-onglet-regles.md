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
