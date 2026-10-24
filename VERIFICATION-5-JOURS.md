# Vérification de la règle des cinq jours — 14/10/2026, 22 h 20 UTC

**Demande de B :** *« Peux-tu vérifier la règle des 5 jours ? »*
Vérification faite **sur le catalogue publié** (`docs/offres.json`, celui que sert
kazendra.com) et sur le code, **sans rien modifier**. Les épreuves qui portent la règle
sont relancées. Aucun correctif n'est appliqué : ce fichier dit ce qui a été trouvé.

## Ce qui a été vérifié, et comment

1. **Le verdict réappliqué à l'extérieur du collecteur.** Un script d'audit
   (`/tmp/audit-5jours-2.mjs`) relit le fichier publié, recalcule l'âge de chaque carte
   sur `premiereVue` (repli `vuLe`) et rejoue la règle telle qu'elle est écrite :
   au-delà de cinq jours, la carte ne survit que si **le tour de sa source n'a pas
   avancé depuis qu'elle lui a été servie** (`tour <= serviceAuTour`). Toute carte qui
   contredit cette condition est comptée comme **violation**.
2. **Le fichier servi par le site est bien celui qu'on audit** : `genereLe`
   `2026-10-14T22:15:22.079Z`, 11 738 fiches, identique octet pour octet à
   `https://kazendra.com/offres.json` (10 505 531 octets).
3. **Les visuels suivent l'effacement** : 10 136 images référencées, 10 136 fichiers
   dans `docs/img`, **0 manquant, 0 orphelin**.
4. **Les épreuves** : `vie-de-la-carte-cinq-jours` **14/14**,
   `donnees-et-controle-source` **30/30**, `peremption` **25/25**,
   `exploitation` **25/25** — **94 sur 94**, aucun échec.
5. **La règle tourne à chaque passage** depuis sa mise en service : 13 123 cartes
   effacées à 21 h 16 (l'incident), puis **71**, **39**, **15** — régime stable, avec
   74, 13 et 1 reprises.

## Le résultat, en quatre seaux — 10 526 cartes affichées

- **A. âge ≤ cinq jours : 10 227 cartes.** La promesse, tenue pour l'immense majorité.
- **B. au-delà de cinq jours, mais servie au dernier tour de sa source : 79 cartes.**
  Leur source **n'a pas reparlé depuis qu'elle les a servies** (`tour == serviceAuTour`).
- **C. au-delà de cinq jours, source sans compteur de tour : 220 cartes.**
- **D. violations : 0.** Aucune carte affichée n'a été servie puis abandonnée par une
  source qui a reparlé depuis. **La règle, telle qu'elle est écrite, n'est contredite
  nulle part.**

## Les deux trous trouvés, et ce qu'ils coûtent

**Trou 1 — 220 cartes que la règle ne peut pas juger (seau C).**
Ces offres ont une source **sans numéro de tour**, donc la garde « on ne condamne pas
sur une source qu'on n'a pas lue » les protège — à raison, mais pour la **mauvaise
raison** : ce n'est pas que la source se taise, c'est qu'**elle n'existe pas**.
- `flash-pt` **121**, `flash-at` **95** : les ventes flash de l'Autriche et du Portugal
  sont **recopiées** des relevés de l'Allemagne et de l'Espagne (`paysAussi`, ligne
  6431) ; `flash-at` / `flash-pt` ne sont déclarés dans **aucune source**, donc aucun
  tour n'est compté pour elles.
- `adr-zooplus-be-3` **3**, `adr-zooplus-bitiba-2` **1** : sources déclarées, mais
  **sautées au seuil des enseignes**, donc leur tour ne compte jamais.
Ce que ça coûte, mesuré : la plus ancienne de ces cartes a **7,00 jours** — elles
sortent donc à **sept jours** par l'ancienne règle des sources disparues
(`motifDeSortie` → `source-disparue`, 20 effacements à ce titre au dernier passage),
soit **deux jours de plus que la promesse**. Sauf les **quatre cartes Zooplus** : leur
source est de type `enseigne`, donc la limite des sept jours **ne s'applique pas** —
rien ne les emportera. Elles ont 5,03 jours aujourd'hui et vieilliront sans fin.

**Trou 2 — 79 cartes dont la source s'est tue (seau B).**
Le tour n'avance que si la source a été **lue** et a rendu au moins la moitié de son
dernier rendu. Trois causes mesurées, toutes protégées volontairement :
- sources **au repos** (`reposMin` : 114 sources sauté(e)s au dernier passage, dont
  `amazon-be-deals`) ;
- **rendus sous la moitié** du précédent (les murs anti-robot d'Amazon) ;
- **seuil des enseignes** (Groupon, Zooplus).
La plus ancienne de ces cartes est **à 9,66 jours** (`amazon-be-deals`, tour gelé à 63,
deux cartes) ; **8,15 jours** pour `groupon-be-goods`. Les 76 autres sont des ventes
flash (`flash-fr` 14, `flash-it` 18, `flash-be` 13, `flash-gb` 10, `flash-es` 9,
`flash-nl` 8, `flash-ie` 4).
C'est le prix, assumé, de la garde : **on ne condamne pas une carte sur une source qu'on
n'a pas relue.** La contrepartie n'était pas écrite : sur ces sources, la promesse des
cinq jours n'est pas tenue, et rien à l'écran ne dit pourquoi.

## Ce qui n'a pas été vérifié

- **L'affichage réel côté visiteur** (l'âge montré sur la tuile) n'a pas été contrôlé
  dans le navigateur : la vérification porte sur les données servies, pas sur le rendu.
- **La croissance du dépôt** et la reprise hebdomadaire restent hors de ce contrôle
  (elles font l'objet d'un autre chantier).

## Décision — 14/10/2026, après remise du constat

B : *« Encore quelques passages avant qu'on y touche. »* **Les deux trous restent
ouverts, volontairement. Rien n'a été modifié** : ni la règle, ni le collecteur.

**Le repère à comparer.** Pour que « quelques passages » se mesure au lieu de se
raconter, voici l'état des lieux au moment de la décision (passage de **22 h 30 UTC**,
10 510 cartes affichées) :

- seau **A** (≤ 5 j) : **10 211** · seau **B** (source muette) : **79**, la plus
  ancienne à **9,67 j** · seau **C** (source sans compteur) : **220**, la plus ancienne
  à **7,01 j** · seau **D** (violations) : **0**.
- répartition de **C** : `flash-at` 95, `flash-pt` 121, `adr-zooplus-be-3` 3,
  `adr-zooplus-bitiba-2` 1.

**Ce qui dira si les trous s'aggravent, et c'est la seule chose à regarder** : les
quatre cartes Zooplus, qui ne sont retenues par rien, doivent continuer de vieillir
(5,03 j au constat) ; et le seau C ne doit pas **monter** au-delà de ~220, puisque
l'ancienne limite des sept jours l'écrête en régime stable. Une montée du seau C serait
la preuve que l'écrêtage ne suit plus.

**La remesure, en une commande** (lecture seule, ne touche à rien, sort en code 1
seulement s'il y a une violation) :

```
node bin/auditer-vie-carte.mjs            # le catalogue publié : docs/offres.json
```

