# Chantier — données structurées schema.org + tableurs marché XLS

**Ouvert le 10/10/2026.** Ce fichier est écrit pour une session NEUVE : tout ce qui
n'est pas ici n'existe pas pour la session suivante.

---

## 1. La demande de B, dans ses mots

> « Tu peux travailler sur les deux points, les données structurées et et le
> tableur marché xls. **Attention que pour le deuxième tu dois être très
> minutieux afin de documenter le mieux possible le document Excel.** »

Deux chantiers donc, et une exigence portée sur le second : la **documentation**
du classeur est le livrable, pas un supplément.

---

## 2. Les interdits (chacun a déjà coûté une erreur mesurée)

1. **On n'écrit pas un chiffre qu'on ne peut pas prouver.** Adresse, téléphone,
   e-mail, CA, actionnariat : ces colonnes ne se déduisent d'aucune source
   lisible mécaniquement. Elles restent **vides**, jamais remplies d'une valeur
   plausible. Un tableur à moitié faux est plus dangereux qu'un tableur
   incomplet, parce qu'il a l'air complet.
2. **Une adresse devinée ne se recopie pas.** Le champ « Adresse des promotions »
   est vide quand on n'a pas la mesure : une fausse adresse se propage de
   tableur en tableur pendant des années sans que personne ne la revérifie.
3. **Chaque affirmation porte sa mesure.** Ce qui n'est pas mesuré est écrit
   **NON VÉRIFIÉ**. Pas de « probablement », pas de « en général ».
4. **Jamais de `<meta name="robots">` déplacé sans preuve.** Les 17 045 pages
   `docs/o/*.html` sont `noindex, follow` — c'est une décision, pas un oubli
   (voir § 5). On ne la change pas par effet de bord.
5. **Le dépôt est PARTAGÉ** : le cron de collecte écrit toutes les 5 minutes.
   Ne jamais laisser un fichier de `public/` ou `docs/` modifié à la main sans
   relancer la suite de tests.
6. **Toute modification est suivie de `node --test`** (60 fichiers de tests). Rouge
   = corriger ou annuler, jamais empiler.

---

## 3. État de départ VÉRIFIÉ (mesuré le 10/10/2026, pas supposé)

### Le site

- `docs/` = site publié (GitHub Pages, `kazendra.com`). **17 045** pages d'offres
  `docs/o/<id>.html`, **toutes** `<meta name="robots" content="noindex, follow">`
  (mesuré : `grep -l noindex docs/o/*.html | wc -l` → 17045).
- `docs/index.html` ne contient **aucun** bloc `application/ld+json`
  (mesuré : `grep -c 'application/ld+json' docs/index.html` → 0).
- `public/sitemap.xml` liste **13** adresses : l'accueil et les 12 pages
  administratives (4 sujets × fr/nl/en). Aucune page d'offre n'y figure.
- `public/robots.txt` : `Allow: /` + `Disallow: /admin/` + déclaration du sitemap.
- Catalogue publié au 10/10 09:26 UTC : **17 066 offres**, 12 pays
  (DE 2923, GB 2519, ES 2270, FR 2217, PL 1700, BE 1530, NL 1140, AT 858,
  IT 535, IE 482, PT 457, SE 414), **0 source vide**.
- 16 rubriques internes (`categorie`) : tech 5669 · autre 1986 · jouets 1257 ·
  electromenager 1200 · maison 1138 · mode 1079 · bricolage 945 · nourriture 903 ·
  beaute 711 · sport 644 · activite 372 · auto 334 · bijoux 296 · voyages 249 ·
  meubles 182 · animaux 101.
- Devise par pays (`public/app.js`, `DEVISE_PAR_PAYS`) : GB→GBP (£, avant),
  SE→SEK (kr), PL→PLN (zł) ; **tout le reste en EUR**. Relevé, pas supposé.
- Le site n'a **pas** de recherche par paramètre d'URL (mesuré : aucun
  `URLSearchParams` ni `location.search` dans `public/app.js`) → pas de
  `SearchAction` déclarable.
- Publication : `node collecteur.mjs --publier` → `publier(sortie)` (ligne 4935)
  copie `public/` vers `docs/`, écrit `offres.json`, `etat-collecte.json`, puis
  les pages de partage via `outils/pages-partage.mjs`.

### La base marché

- Tableurs présents : `donnees/marche-be-2026-10-08.xlsx` (139 acteurs),
  `marche-de-2026-10-08.xlsx` (182), `marche-fr-2026-10-08.xlsx` (263).
- Structure : feuille `Lisez-moi` (18-27 lignes, **1 seule colonne**) ·
  `Vue densemble` · 22 feuilles numérotées par catégorie.
- 13 colonnes : Enseigne / entreprise · Catégorie · Positionnement / objectif ·
  Segment · Type d'acteur · Adresse du siège · Téléphone · Email · Site web ·
  CA indicatif · Actionnariat / groupe · Mode de distribution ·
  Informations clés & remarques.
- Conversion : `outils/acteurs-depuis-xlsx.py` (`SOURCES` = liste pays→fichier,
  sortie `public/acteurs.json`). Documente aussi les adresses de promotion via
  `outils/documenter-adresses-xlsx.py` (**3 colonnes ajoutées à la fin** de
  chaque feuille de données : Adresse des promotions · Résultat de la
  vérification · Relevée le).
- **9 pays sans tableur** : GB · ES · IT · NL · AT · PL · IE · PT · SE.
  Leurs adresses n'existent, pour l'heure, que dans
  `public/adresses-promotions.json` (réglage de site, **pas** une base).

---

## 4. Ce qu'il faut produire — la définition de « fini »

### Chantier A — données structurées schema.org

- **A1.** Bloc JSON-LD `Organization` + `WebSite` dans `public/index.html`
  (page indexable, donc utile).
- **A2.** Générateur `outils/donnees-structurees.mjs` : `Product` + `Offer`
  (+ `BreadcrumbList`) pour une offre. **Prouvé par test** sur des offres réelles.
- **A3.** Pages éditoriales **indexables** par rubrique (`docs/rubriques/<rub>`),
  en fr/nl/en : contenu propre tiré des données réelles, JSON-LD `ItemList` +
  `Product`/`Offer`, inscrites au sitemap publié. **C'est le vrai levier** : les
  17 045 pages d'offres restent hors index (décision motivée ci-dessous).
- **A4.** La décision « indexer ou non les 17 045 pages d'offres » reste **ouverte**
  et documentée avec ses chiffres ; le balisage de ces pages existe derrière un
  drapeau explicite, éteint par défaut.

### Chantier B — les 9 tableurs manquants, très documentés

- **B1.** 9 classeurs `donnees/marche-<pays>-2026-10-10.xlsx`, structure
  **identique** au belge (mêmes 13 colonnes, mêmes 22 catégories, `Lisez-moi` +
  `Vue densemble` + 22 onglets).
- **B2.** Une feuille `Lisez-moi` **beaucoup plus complète** que les existantes :
  provenance, date, méthode de mesure, ce qui est mesuré / ce qui ne l'est pas,
  la liste des colonnes et leur statut, la source de chaque fait de marché, et la
  procédure d'enrichissement **pays par pays** (registre national, comptes).
- **B3.** Les 3 colonnes de suivi d'adresses, remplies depuis les mesures réelles.
- **B4.** `acteurs-depuis-xlsx.py` étendu aux 9 pays, **et** la base produite
  vérifiée identique pour les 3 pays déjà couverts (aucune régression).
- **B5.** Un fichier de documentation autonome : `TABLEURS-MARCHE.md`.

---

## 5. Pourquoi les pages d'offres restent `noindex` (et ce que ça implique)

Mesuré et argumenté le 09/10/2026 : les 17 045 pages `o/<id>.html` republient
les titres, photos et prix **des marchands**. Les indexer en masse, c'est
publier 17 000 pages de contenu recopié, dont le contenu principal (le prix)
change et dont beaucoup meurent à l'expiration de l'offre.

- Google n'accepte les résultats enrichis produit que sur une page consacrée à
  **un seul produit** → la page d'accueil n'est pas éligible, les pages
  `o/<id>.html` le seraient.
- Google précise que ce **n'est pas un facteur de classement** et ne garantit
  pas l'affichage du résultat enrichi.
- Le levier réel est donc du **contenu propre indexable** : c'est A3.

**Décision ouverte (à B) :** indexer ou non les 17 045 pages d'offres. Si oui,
le balisage est déjà écrit (A2) et le drapeau `INDEXER_PAGES_OFFRES` passe à
`true` — une ligne, plus la levée du `noindex` dans `outils/pages-partage.mjs`.

---

## 6. Tableau des unités

| # | Unité | État |
|---|---|---|
| A1 | JSON-LD Organization + WebSite sur l'accueil | ✅ fait (10/10/2026) |
| A2 | Générateur de balisage `Product`/`Offer` | ✅ fait — `outils/donnees-structurees.mjs` |
| A3 | Pages éditoriales par rubrique, indexables | ✅ fait — 45 pages, `outils/pages-rubriques.mjs` |
| A4 | Décision « indexer les pages d'offres » documentée | ✅ fait (§ 5 ci-dessus) |
| B1 | 9 classeurs marché (GB ES IT NL AT PL IE PT SE) | ⏸ **EN PAUSE — décision de B, 10/10/2026** |
| B2 | Feuille « Lisez-moi » complète dans les 9 | ⏸ en pause |
| B3 | 3 colonnes de suivi d'adresses remplies | ⏸ en pause |
| B4 | `acteurs-depuis-xlsx.py` étendu, sans régression | ⏸ en pause |
| B5 | `TABLEURS-MARCHE.md` | ⏸ en pause |

> **CE QUI EST EN ATTENTE POUR REPRENDRE LE CHANTIER B.** Décision de B du
> 10/10/2026 : « *On met la création de 9 fichiers en pause pour l'instant.* »
> Rien n'a été commencé : aucun classeur, aucun script. Pour reprendre, il faut
> d'abord son arbitrage entre les deux voies (§ 4) :
> **voie A ≈ 5-8 €** (colonnes commerciales vides et marquées « à compléter »)
> ou **voie B ≈ 30-60 €** (adresse, téléphone, CA, actionnariat remplis par
> recherche web, acteur par acteur, source citée). Solde DeepSeek au 10/10 :
> **12,08 €** — la voie A en prend la moitié, la voie B le dépasse quatre fois.

### Ce que le chantier A a livré, mesuré (10/10/2026)

- `outils/donnees-structurees.mjs` : balisage `Product`, `Offer`, `ItemList`,
  `BreadcrumbList`, fil d'Ariane. **Aucun champ non prouvable** (`availability`,
  `aggregateRating`, `brand`, `sku`, TTC/HT) — la règle du projet, rendue
  exécutable par une épreuve.
- `outils/pages-rubriques.mjs` : **45 pages** écrites dans `docs/rubriques/`
  (15 rubriques × fr/nl/en). La rubrique « Autres » n'a **pas** de page
  (fourre-tout, décision écrite dans le module). Le plan de site publié passe de
  **13 à 58 adresses**.
- `docs/sitemap.xml` est désormais **généré** à la publication, en partant
  toujours de `public/sitemap.xml` (sinon l'accueil et les 12 pages légales
  seraient perdus).
- `collecteur.mjs`, `publier()` étape 5 : appelle `ecrirePagesRubriques()`.
- **677 tests sur 677, 0 échec** (39 neufs).

### Les quatre défauts trouvés par les épreuves (et non par relecture)

1. **`</script>` dans un titre d'offre refermait la balise JSON-LD** → du HTML
   s'exécutait dans la page. `scriptJSONLD` écrit désormais `<`, `>` et `&` en
   séquences d'échappement JSON. Corrigé, et c'est le défaut le plus grave de la
   série : il ne se voyait qu'avec une offre malveillante ou mal formée.
2. **Les pages annonçaient « −99 % »** là où l'application refuse d'afficher le
   pourcentage (règle des 90 %, « 99 % sRGB »). `remiseMontrable()` est repris du
   site, appliqué à l'affichage **et au tri**, et un test relit `app.js` pour
   échouer si les deux règles divergent.
3. **Six fois la même caméra Blink** sur six lignes (même produit, six marchés) :
   tri par remise pure. Corrigé par `MAX_PAR_MARCHAND = 2`, qui réordonne sans
   jamais écarter une offre.
4. **Cartes de hauteurs inégales** quand l'offre n'a pas de photo. Le cadre du
   visuel existe maintenant même sans image — 441 px pour toutes.

## 7. Ordre d'exécution

A1 → A2 → A3 → A4 (**FAITS**) → B1 → B2 → B3 → B4 → B5 → `node --test` final →
rapport.

Le chantier B est en attente de la **décision de B** : voie A (colonnes
commerciales vides, ~6 €) ou voie B (recherche web acteur par acteur, ~30-60 €).
