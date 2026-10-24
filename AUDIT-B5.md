# AUDIT B5 — Sources prouvées stables, câblées (activités hors Groupon + enseignes)

**Unité B5** — suite de B3 (Social Deal) et B4 (Coolblue NL/DE, Zooplus DE/IT/SE).
Objectif de B : « l'Activité ne doit pas être exclusivement liée à Groupon dans chaque
pays », et « les sources doivent être LOCALES au pays ».

## 1. Ce qui a été câblé

Sources ajoutées dans `collecteur.mjs` (aucune catégorie inventée : le titre décide,
sauf pour une page **entièrement** animalière, où la nature de la page impose
`animaux`) :

| id | enseigne | pays | langue | lecteur |
|----|----------|------|--------|---------|
| `coolblue-nl-1` | Coolblue | NL | nl | `offresEnseigne` |
| `coolblue-de-1` | Coolblue | DE | de | `offresEnseigne` |
| `zooplus-de-chat` | Zooplus | DE | de | `offresEnseigne` (imposé `animaux`) |
| `zooplus-de-chien` | Zooplus | DE | de | `offresEnseigne` (imposé `animaux`) |
| `zooplus-it-chat` | Zooplus | IT | it | `offresEnseigne` (imposé `animaux`) |
| `zooplus-se-chat` | Zooplus | SE | sv | `offresEnseigne` (imposé `animaux`) |
| `socialdeal-be` | Social Deal | BE | fr | `offresSocialDeal` |
| `socialdeal-nl` | Social Deal | NL | nl | `offresSocialDeal` |
| `socialdeal-fr` | Social Deal | FR | fr | `offresSocialDeal` |
| `socialdeal-de` | Social Deal | DE | de | `offresSocialDeal` |
| `socialdeal-at` | Social Deal | AT | de | `offresSocialDeal` |

Chaque domaine est **du pays** (`coolblue.nl`, `zooplus.it`, `socialdeal.at`…), jamais
un site étranger : un Allemand achète sur `coolblue.de`.

## 2. Mesure RÉELLE de cette session — `node outils/mesure-b5.mjs`

Deux relevés par source (1,5 s d'écart), vrai lecteur, contrôle négatif : URL inventée
= **erreur réseau = 0 offre ✔**.

| source | R1 | R2 | stable |
|--------|----|----|--------|
| coolblue-nl-1 | 22 | 22 | OUI ✔ |
| coolblue-de-1 | 22 | 22 | OUI ✔ |
| zooplus-de-chat | 48 | 48 | OUI ✔ |
| zooplus-de-chien | 48 | 48 | OUI ✔ |
| zooplus-it-chat | 48 | 48 | OUI ✔ |
| zooplus-se-chat | 174 | 174 | OUI ✔ |
| socialdeal-be | 6 | 6 | OUI ✔ |
| socialdeal-nl | 6 | 6 | OUI ✔ |
| socialdeal-fr | 6 | 6 | OUI ✔ |
| socialdeal-de | 4 | 4 | OUI ✔ |
| socialdeal-at | 6 | 6 | OUI ✔ |

Exemples à **deux prix réels** : « Menu en 2 ou 3 services à Bruxelles » 38,35 € → 23,90 €
(-38 %) ; « Ticket VIP … RSC Anderlecht » 165 € → 55 € (-67 %) ; « Spa privatif pour 2 …
Lille » 136,90 € → 99 € ; « Privé-wellnessarrangement … » 159 € → 119 €.

## 3. Effet sur l'onglet ACTIVITÉ (le but de B)

Avant B5, l'Activité était **portée par la Belgique seule** (Groupon). Après câblage,
Social Deal la fournit dans **5 pays** : BE, NL, FR, DE, AT. Classement par
`classerOffre` (jamais en bloc) : un **repas pris dehors** reste en Activité, un **soin**
part en Beauté, une **destination étrangère** part en Voyages. Vérifié sur les données :
`socialdeal-at` sort « Eintritt in den Movie Park Germany » (parc en **Allemagne** vu
d'**Autriche**) → **Voyages** (-38 %), pas Activité — point 21 respecté.

## 4. Contrôle des catégories — DÉFAUT TROUVÉ ET CORRIGÉ

Le lecteur `offresEnseigne` porte désormais un champ `categorieImposee` (nécessaire pour
Zooplus : ses titres sont des **marques** — « Applaws », « Gourmet Gold », « IAMS » —
sans mot animalier ; sans lui la nourriture pour chats tomberait en « Nourriture »,
interdit point 18).

Or le vérificateur de catégories **oubliait** ce cas dans son contrôle « sans preuve » :
il le connaissait pour le contrôle « contredite » (ligne 182) mais pas pour « sans
preuve » (ligne 166). Résultat mesuré : **84 offres Zooplus accusées à tort** « sans
aucune preuve » → `verificateur-categories.mjs` **ÉCHEC**, et le test correspondant
**ROUGE**.

**Correction** (`outils/verificateur-categories.mjs`, une condition) : une rubrique
**imposée** est une preuve à part entière — c'est la nature de la page qui la décide,
comme le soin, le repas pris dehors et le voyage. La condition devient
`!touche && !sourceOk && !imposee && …`.

**Mesure** : le vérificateur repasse **✓ CONFORME** ; **84 → 0** offre sans preuve. Le
garde-fou reste utile — seules **182 / 9 846** offres (1,8 %) portent une rubrique
imposée (Groupon 68, Social Deal 28, Zooplus 86), toutes issues d'une page dont la
nature est explicite.

## 5. Réserves dites (pas cachées)

- **Coolblue publie beaucoup d'offres SANS prix de référence** : mesuré sur les données
  publiées, **196 / 243** (dont **BE 199 déjà câblé avant B5**). Ce n'est **pas** un
  défaut introduit par B5 — c'est le comportement du lecteur Coolblue, partagé avec la
  Belgique ; ces offres s'affichent sans pourcentage plutôt qu'avec un faux rabais.
- **Zooplus : 18 / 86** offres sans prix de référence ; **Social Deal : 0 / 28** — toutes
  à deux prix réels.
- Les pages Zooplus **FR et ES** (mesurées instables en B4, 14→10 et 19→10) restent
  **non câblées** ; `socialdeal.se` (servi, **0 carte**) reste non câblé.
- 5 tests dédiés au lecteur Social Deal (`tests/socialdeal.test.mjs`) : centimes dans un
  `<sub>` (€19,90 et non €19), format français « 136,90 € », refus d'une carte sans
  second prix, refus d'une référence ≥ 5× le prix, passage géographique en Voyages.

## 6. Tests

`bash bin/tester.sh` : **185 / 185**, 0 échec. Vérificateur : **✓ CONFORME**.
