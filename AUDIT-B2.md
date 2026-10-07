# AUDIT B2 — la lecture Groupon est stabilisée (second lecteur TanStack)

Date : 2026-10-07, ~03:50–04:05 UTC. Session neuve. Suite de `AUDIT-B1.md`.

## Ce que B1 avait laissé ouvert

`groupon.fr/bon-plan` est servie **en deux rendus, au hasard, par le même
domaine** : « Next » (`<script id="__NEXT_DATA__">`, JSON) et « TanStack »
(`<script class="$tsr">`, flux JavaScript). Le lecteur ne connaissait que le
premier et jetait la page **en silence** quand c'était le second
(`collecteur.mjs:2685`, `if (!bloc) return out;`).

## Ce qui a été fait (B2)

Un **second lecteur** couvre le rendu TanStack, sans jamais exécuter le
JavaScript distant — il n'analyse que le sous-ensemble de **données** du flux :

- `finBlocJs()` — isole un bloc `{…}` d'un flux JS en ignorant les chaînes ;
- `parseurTanStack()` — relit un sous-ensemble JavaScript
  (`Object.assign(Object.create(null),{…})`, tableaux, chaînes, nombres,
  `!0`/`!1`, `null`, marqueurs `$R[n]` = définition/référence) ;
- `cartesGrouponTanStack()` — découpe chaque `StandardDealCard` (chaque carte est
  **autonome** : mesuré sur `fr-1.html`, les 9 cartes portent **autant de `$R[n]=`
  que de `$R[n]`, aucune référence externe** — donc une carte se relit seule) ;
- `cartesGroupon()` — rend les cartes du rendu servi, Next **ou** TanStack ;
  `offresGroupon()` boucle ensuite sur ces cartes avec **le même** garde-fou
  (`remiseCredibleSource`) : le second lecteur n'est pas une porte dérobée.

## PREUVE 1 — les deux lecteurs rendent la MÊME chose sur la MÊME page

Page FR relevée 5 fois (`/tmp/b2/fr-*.html`, curl identique à `lireParCurl`) :

| relevé | rendu | `offresGroupon` **après B2** |
|---|---|---|
| 1 | tanstack | 6 |
| 2 | tanstack | 6 |
| 3 | **next** | 5 |
| 4 | tanstack | 5 |
| 5 | tanstack | 5 |

Les relevés **4 et 5 (TanStack) rendent exactement les 5 mêmes offres que le
relevé 3 (Next)** — mêmes titres, mêmes prix, mêmes remises. Avant B2, les
relevés 1, 2, 4, 5 auraient rendu **0**. La rotation observée entre relevé 2 et 3
vient du **flux lui-même** (Groupon change son menu de tête), pas du lecteur.

## PREUVE 2 — stabilité par pays, deux relevés espacés (`node outils/mesure-b2.mjs 2`)

Même `curl` que la production. 3 s entre deux requêtes d'un même domaine.

| pays | relevé 1 | relevé 2 | offres | verdict |
|---|---|---|---|---|
| BE | next | next | 59 / 59 | identiques ✔ |
| **FR** | **tanstack** | **next** | 6 / 6 | **identiques ✔ (rendus différents !)** |
| DE | next | next | 7 / 7 | identiques ✔ |
| **NL** | **next** | **tanstack** | 7 / 7 | **identiques ✔ (rendus différents !)** |
| IT | tanstack | tanstack | 4 / 4 | identiques ✔ |
| **ES** | **tanstack** | **next** | 8 / 8 | **identiques ✔ (rendus différents !)** |
| PL | tanstack | tanstack | 5 / 5 | **DIFFÉRENTES (5ᵉ slot qui tourne)** |
| GB | tanstack | tanstack | 6 / 6 | identiques ✔ |
| IE | next | next | 9 / 9 | identiques ✔ |

**BILAN : 8/9 pays à deux relevés identiques ; 0 pays muet.** Les trois pays dont
le rendu a **changé entre les deux relevés** (FR, NL, ES) rendent malgré tout des
offres **identiques** : c'est exactement ce que B2 devait obtenir.

## Le seul cas non identique, dit sans le cacher : la POLOGNE

`groupon.pl/oferta` sur 3 relevés (`27 %, 61 %, 43 %, 71 %` identiques à chaque
fois ; le **5ᵉ slot tourne**) :

- 4 offres sur 5 **stables 3/3** ;
- le 5ᵉ emplacement alterne entre « **Wybrany masaż ciała** … » (1/3) et
  « **Orientalne masaże dla 1 lub 2 osób** … » (2/3).

Le relevé 3 de PL est en rendu **next** et rend **les mêmes 5 offres que le
relevé 2 en tanstack** : là encore, la variation vient du **flux**, pas du rendu
ni du lecteur. C'est un emplacement « à la une » que Groupon fait tourner — il
n'y a rien à corriger côté code.

## Tests

`tests/groupon.test.mjs` — **3 tests ajoutés** (second lecteur) :
une carte sérialisée au format TanStack rend **la même offre** que le format
Next ; le TanStack fait respecter **les mêmes garde-fous** (promotion gonflée
rejetée, absence de second prix rejetée) ; un flux **illisible/tronqué** est
**ignoré, pas deviné**.

`bash bin/tester.sh` : **178/178**, 0 échec (175 avant B2).

## Conclusion B2

Le lecteur Groupon ne dépend plus du rendu servi : Next et TanStack rendent les
mêmes cartes, et la même page rend les mêmes offres deux fois de suite dans
**8 pays sur 9**. La rotation résiduelle de la Pologne est une propriété du flux
(emplacement à la une), mesurée et citée. La cause du « 9 puis 0 » est traitée.
