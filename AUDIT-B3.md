# AUDIT B3 — plateformes d'ACTIVITÉS autres que Groupon

Date : 2026-10-07, ~04:00–04:25 UTC. Session neuve. Suite de `AUDIT-B2.md`.

## Ce que B3 demande

Trouver, **pour chaque pays**, des plateformes d'activités (voyage, concerts,
spectacles, loisirs) **autres que Groupon**, avec leurs **deux prix**. B3 est une
unité de **recherche** : on sonde et on mesure, on ne câble pas (le câblage est B5).

## Méthode (règle de méthode du plan)

1. **Le VRAI lecteur**, pas un comptage de mots : `offresEnseigne()` tourne sur
   chaque page candidate et on ne retient que les offres à **deux prix réels**
   (remise calculée 15–90 %, ratio < 5×).
2. **Contrôle négatif** systématique : une URL inventée **doit** rendre zéro.
3. **Deux relevés** espacés avant toute conclusion de stabilité.
4. Politesse : ≥ 1 s entre deux requêtes.

## Résultat 1 — 24 domaines sondés, ZÉRO offre à deux prix (`outils/probe-b3.mjs`)

Lecteur réel `offresEnseigne`, contrôles négatifs propres (0 et 0), un relevé :

| pays | plateforme | octets | JSON-LD | offres lues | à 2 prix |
|---|---|---|---|---|---|
| – | NEG-domaine inexistant | 0 | 0 | **0** ✔ | 0 |
| BE | NEG-groupon-404 | 25 437 | 0 | **0** ✔ | 0 |
| BE | bongo.be | 590 335 | 3 | 10 | 0 (prix unique) |
| BE | funbooker.be | 0 | 0 | 0 | 0 |
| BE | smartbox.com/be-fr | 0 | 0 | 0 | 0 |
| BE | vente-exclusive.be | 0 | 0 | 0 | 0 |
| FR | wonderbox.fr | 349 948 | 1 | 0 | 0 |
| FR | smartbox.fr | 675 912 | 2 | 12 | 0 (prix unique) |
| FR | billetreduc.com | 2 589 457 | 0 | 0 | 0 |
| FR | francebillet.com | 0 | 0 | 0 | 0 |
| FR | veepee.fr | 597 948 | 0 | 0 | 0 |
| NL | actievandedag.nl | 1 045 403 | 0 | 0 | 0 |
| NL | socialdeal.nl | 558 098 | 2 | 0 | 0 |
| NL | vakantieveilingen.nl | 75 278 | 0 | 0 | 0 |
| DE | dealabs.de | 271 175 | 1 | 0 | 0 |
| DE | smartbox.de | 414 366 | 3 | 10 | 0 (prix unique) |
| ES | atrapalo.com | 455 064 | 2 | 0 | 0 |
| ES | letsbonus.com | 279 932 | 0 | 0 | 0 |
| ES | groupalia.es | 0 | 0 | 0 | 0 |
| IT | groupalia.it | 106 504 | 0 | 0 | 0 |
| IT | smartbox.it | 763 291 | 2 | 11 | 0 (prix unique) |
| GB | wowcher.co.uk | 349 124 | 0 | 0 | 0 |
| GB | travelzoo.com/uk | 182 946 | 0 | 0 | 0 |
| GB | secretescapes.com | 93 716 | 1 | 0 | 0 |
| IE | pigsback.com | 67 051 | 1 | 0 | 0 |
| PL | grupon.pl | 0 | 0 | 0 | 0 |

**Aucun** de ces 24 domaines ne publie deux prix réels lisibles dans le HTML servi.

## Résultat 2 — pourquoi : les prix sont absents ou sans référence (`outils/probe-b3-raw.mjs`)

| plateforme | octets | prix en devise | marqueurs 2ᵉ prix | charge lisible |
|---|---|---|---|---|
| NL actievandedag.nl | 1 045 403 | **0** | 6 | API seulement |
| NL socialdeal.nl | 558 126 | 40 | 94 | API + HTML |
| GB wowcher.co.uk | 349 124 | 6 | 147 | `__NEXT_DATA__` (squelette JS) |
| ES letsbonus.com | 279 932 | **0** | 1 063 | — |
| ES atrapalo.com | 455 064 | **0** | 62 | — |
| FR wonderbox.fr | 349 948 | 26 | 94 | — |
| FR billetreduc.com | 2 588 689 | 686 | 1 095 | API |
| FR veepee.fr | 597 948 | 5 | 184 | `__NEXT_DATA__` |
| BE bongo.be | 590 335 | 12 | 21 | Nuxt, prix **uniques** |

Deux constats **mesurés** :

- **Les grandes plateformes d'activités rendent leur page en JavaScript** : la
  page « chargée » vue par un navigateur n'existe pas dans le HTML servi
  (wowcher : `loading-placeholder` ; veepee : `__NEXT_DATA__` sans cartes
  lisibles). Rien à lire sans exécuter leur JS — écarté, comme en A1/B1.
- **BilletRéduc affiche son propre pourcentage sans prix de référence** :
  `<p class="megamenu-event-discount">-50%</p>` posé à côté de
  `<p class="megamenu-event-price">dès 12,50€</p>`. C'est exactement le
  **faux rabais interdit** (point 20 du plan) : un « -50 % » sur un prix
  « à partir de » sans second prix. **Non câblable** en l'état.
- **Smartbox / Wonderbox / Bongo** publient des produits (bons cadeaux) avec
  **un seul prix** — donc aucune promotion calculable (point 5 : « sans
  deuxième prix, ce n'est pas une promotion »).

## Résultat 3 — TROUVÉ : Social Deal (activités, HTML serveur, deux prix réels)

`outils/probe-socialdeal.mjs` — lecteur **dédié** sur le HTML brut.

Signal d'abord repéré au scan brut : socialdeal.nl portait 40 prix et 94
marqueurs de second prix dans le HTML **servi**. Vérification de la structure
d'une carte (ligne 2427 de la page) :

```html
<h4>2-gangen schnitzeldiner …</h4>
<div class="original-price"><span class="price">€26<sub>,90</sub></span></div>
<span class="current-price">€16<sub>,90</sub></span>
```

Deux prix **réels**, séparés par des classes explicites `original-price` /
`current-price`. **Mesure (deux relevés à 3 s, contrôle négatif, mêmes règles
que le collecteur)** :

| pays | URL | relevé 1 | relevé 2 | identiques | contrôle négatif | exemples retenus |
|---|---|---|---|---|---|---|
| **BE** | socialdeal.be | 6 cartes, **6 retenues** | 6 / **6** | **oui ✔** | 0 ✔ | 23,90€ au lieu de 38,35€ (menu Bruxelles) ; 55€ au lieu de 165€ (ticket RSC Anderlecht) ; 38,90€ au lieu de 64,50€ (manucure) |
| **NL** | socialdeal.nl | 6 / **6** | 6 / **6** | **oui ✔** | 0 ✔ | 21,95€ au lieu de 25,95€ (diner 3 services) ; 16,90€ au lieu de 26,90€ ; 18,50€ au lieu de 35,60€ (wellness 2 pers.) |
| **FR** | socialdeal.fr | 6 / **6** | 6 / **6** | **oui ✔** | 0 ✔ | 22,90€ au lieu de 33,10€ (menu Reims) ; 9,90€ au lieu de 16€ (laser game) ; 15,90€ au lieu de 22,20€ |

**Pays couverts par Social Deal** (`www.socialdeal.<tld>`, sondés un par un) :

| domaine | HTTP | `original-price` |
|---|---|---|
| socialdeal.be | 200 | **6 ✔** |
| socialdeal.nl | 200 | **6 ✔** |
| socialdeal.fr | 200 | **6 ✔** |
| socialdeal.de | 200 | **6 ✔** |
| socialdeal.at | 200 | **6 ✔** |
| socialdeal.se | 200 | **0** (page servie, **aucune carte** — dit, pas compté) |
| socialdeal.es / .it / .pl / .co.uk | DNS 000 | n'existe pas |

**Bilan B3** : Social Deal est la **seule** plateforme d'activités hors Groupon
trouvée qui publie deux prix réels lisibles, et elle est **locale au pays**
dans **5 pays** (BE, NL, FR, DE, AT). Elle est **stable** (deux relevés
identiques) et son contrôle négatif est **propre**.

## Réserves à porter à B (dites, pas tues)

1. **6 cartes seulement par page d'accueil.** C'est mince ; l'essentiel du
   catalogue est derrière les pages « ville ». La montée en volume (pages
   ville) reste à sonder — **B5**, pas B3.
2. Le contenu mêle **repas pris dehors** (menus restaurant → **Activité**),
   **soins** (manucure, wellness → **Beauté**) et **loisirs** (laser game,
   match). Au câblage, il faudra passer par `classerOffre` **titre par titre**,
   **jamais** `categorieImposee: 'activite'` en bloc.
3. Aucune offre **Voyages** (destination étrangère) n'a été trouvée ici : ce
   point reste entier (B11).

## Tests

`bash bin/tester.sh` : **178/178**, 0 échec (aucune modification du code de
collecte dans cette unité — B3 = recherche).

## Conclusion B3

Sur 24 domaines sondés, **un seul** — Social Deal — rend des activités à deux
prix réels, et il le fait pour **5 pays locaux**. Les autres sont soit rendus
en JavaScript (wowcher, veepee), soit sans aucun prix dans le HTML
(actievandedag, letsbonus, atrapalo), soit n'affichent qu'un seul prix
(Smartbox, Wonderbox, Bongo), soit fabriquent un pourcentage sur un prix
« à partir de » (BilletRéduc → refusé). Source **trouvée et mesurée**, **non
câblée** (c'est B5).
