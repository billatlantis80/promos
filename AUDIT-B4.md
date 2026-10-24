# AUDIT B4 — autres sources d'annonces par pays (enseignes, comparateurs, flux publics)

Date : 2026-10-07, ~04:15–05:10 UTC. Session neuve. Suite de `AUDIT-B3.md`.

## Ce que B4 demande

« Chercher d'autres sources d'annonces par pays (enseignes, comparateurs, flux
publics) — **au moins 3 nouvelles pistes mesurées**. » B4 est une unité de
**recherche** : on sonde et on mesure, on ne câble pas (le câblage est B5).

## Méthode

Le VRAI lecteur `offresEnseigne()` tourne sur chaque page candidate ; on ne
retient que les offres à **deux prix réels** (remise calculée 15–90 %).
Contrôles **positif** (Groupon BE `/goods`, Coolblue BE) et **négatif** (URL
inventée → 0) à chaque vague. **Deux relevés** avant toute conclusion de
stabilité. Politesse : ≥ 1 s entre deux requêtes.

## Résultat 1 — 40 domaines sondés par leur racine : ZÉRO hors contrôles

`outils/probe-b4.mjs` (accueils + comparateurs + animaleries, 1 relevé) :

| catégorie | exemples sondés | verdict mesuré |
|---|---|---|
| Contrôles | NEG-inexistant ; groupon.be/goods ; coolblue.be/fr/offres | **0 ✔ / 3 / 1** (la sonde fonctionne) |
| Animaleries | zooplus *(8 pays)*, fressnapf.de, maxizoo.be | **0 JSON-LD produit** sur l'accueil (0 bloc lu) |
| Meubles | jysk *(6 pays)*, leenbakker.nl, kwantum.nl | JSON-LD présent mais **aucun produit** (WebSite/Organization) |
| Électro | alternate *(3 pays)*, ldlc, x-kom, morele, mediaworld, worten, webhallen, ao, harveynorman | **404 / 403** ou **0 produit** |
| Comparateurs | geizhals *(DE/AT)*, skinflint, pricerunner | **0 JSON-LD**, comparateur ≠ page de promotions |
| Voyages | weekendesk | 0 produit |

**Constat** : l'accueil d'un domaine n'est jamais une page de promotions
lisible. Sonde 2 (`probe-b4b.mjs`), sur des URL de promo **devinées** : 40
candidats, quasi tous **404** — deviner une URL ne marche pas : chez Coolblue
NL/DE, `/aanbiedingen` et `/angebot` donnent **404**, alors que les vrais
chemins `/aanbieding` et `/angebot` répondent. Leçon consignée : **découvrir
le lien dans le HTML de l'accueil**, ne jamais le deviner.

## Résultat 2 — TROUVÉ : 3 nouvelles sources, par pays, STABLES

Découverte par liens réels (jamais devinés), lecteur réel, **deux relevés
identiques** (`outils/probe-b4c/d/e.mjs`) :

| # | pays | source | URL réelle | lues | **2 prix** | R1/R2 | exemple mesuré |
|---|---|---|---|---|---|---|---|
| 1 | **NL** | **Coolblue NL** | `coolblue.nl/aanbieding` | 22 | **10** | 10/10 ✔ | −34 % Ecovacs DEEBOT T90 PRO OMNI ; −45 % Mova V50 Ultra |
| 2 | **DE** | **Coolblue DE** | `coolblue.de/angebot` | 22 | **18** | 18/18 ✔ | −23 % Hisense PX3-PRO ; −34 % Philips Lumea IPL 9900 |
| 3 | **DE** | **Zooplus DE** (chats) | `zooplus.de/shop/katzen/sonderangebote_katze` | 48 | **17** | 17/17 ✔ | −18 % MjAMjAM 6×800 g |
| 3b | DE | Zooplus DE (chiens) | `zooplus.de/shop/hunde/sonderangebote_hund` | 48 | **5** | 5/5 ✔ | −17 % Josera Lamm & Reis |
| 4 | **IT** | **Zooplus IT** (chats) | `zooplus.it/shop/gatti/offerte_speciali_gatti` | 48 | **29** | 29/29 ✔ | −25 % (multipack) |
| 5 | **SE** | **Zooplus SE** (chats) | `zooplus.se/specials/katt/specialerbjudanden/kattmat/81531` | 174 | **100** | 100/100 ✔ | −25 % « 3 + 1 på köpet » |

Coolblue NL/DE suivent **exactement** le motif JSON-LD déjà éprouvé et câblé
sur Coolblue BE (même plateforme, même lecture du prix de référence interne).
Zooplus est un **filon neuf**, directement utile à la rubrique **Animaux**
(B10). Pagination Coolblue testée : `?page=2` et `?page=3` rendent **les mêmes
offres** que la page 1 (le paramètre est ignoré) — donc une seule page suffit.

## Résultat 3 — deux pistes INSTABLES, citées (pas tues)

`outils/probe-b4g.mjs`, deux relevés à 3 s :

| pays | page Zooplus | R1 | R2 | identiques | verdict |
|---|---|---|---|---|---|
| **FR** | `zooplus.fr/shop/chiens/offres_promotionnelles_chien` | 14 | **10** | **NON** | **non câblable en l'état** |
| **ES** | `zooplus.es/shop/tienda_gatos/ofertas_especiales_gatos` | 19 | **10** | **NON** | **non câblable en l'état** |

C'est exactement le défaut que la règle de méthode interdit (une source rend
9 puis 0). FR et ES **ne sont pas retenus** ; ils restent des pistes à
re-mesurer (page « ville » ou sous-catégorie plus stable).

## Résultat 4 — pistes non lisibles avec le lecteur actuel (mesurées, non câblées)

- **bitiba.be / .de** : 22 à 23 marqueurs de second prix dans le HTML, mais
  **hors JSON-LD** → 0 offerte lue. Nécessiterait un lecteur dédié (B5+).
- **mediaMarkt.de** (924 Ko, 34 prix, 24 marqueurs de 2ᵉ prix) et
  **mediaMarkt.pl** (84 prix) : **0 offerte lue** — prix hors JSON-LD produit.
- **worten.pt**, **jysk.nl** (25 prix), **leenbakker.nl**, **unieuro.it** :
  prix présents, **aucun** dans un JSON-LD `Product`/`ItemList`.
- **fressnapf.de** (5 marqueurs sur `/aktionen-angebote/`) : 0 lu.
- **403 / 429** : x-kom.pl, mediaworld.it, ao.com, currys.co.uk,
  harveynorman.ie, elgiganten.se, fnac.com, bcc.nl, alza.de.

Aucune n'est une « source » au sens du projet tant qu'un lecteur ne rend pas
deux prix réels **deux fois de suite**.

## Bilan B4

**3 à 5 nouvelles pistes mesurées et stables**, dans **4 pays neufs pour ces
familles** (NL, DE, IT, SE) :
- **Coolblue NL** (−10 offres) et **Coolblue DE** (−18) → Électroménager / High-tech ;
- **Zooplus DE / IT / SE** (17 / 29 / 100 offres chats, + chiens DE) → **Animaux**.

Toutes **non câblées** (c'est B5). Deux pistes **instables citées** (Zooplus
FR, ES). Contrôles positif et négatif **propres** à chaque vague.

## Tests

`bash bin/tester.sh` : voir bilan en fin de session (aucune modification du
code de collecte dans cette unité — B4 = recherche ; seuls des outils de
sonde ont été ajoutés).
