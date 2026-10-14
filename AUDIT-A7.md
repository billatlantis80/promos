# Audit A7 — Audit de la catégorie « AUTRES »

> Session du **7 octobre 2026, ~02:45 UTC**. Unité **A7** du PLAN-NUIT.md :
> « AUDIT DE “ AUTRES ” — lister les mots fréquents absents de toutes nos
> tables, traiter par lots, corriger la table, re-mesurer le taux de “ autres ” ;
> ne jamais vider “ Autres ” de force — une offre sans preuve n'a rien à faire
> ailleurs ».
>
> Demande de B : « il faut bien vérifier les éléments qui sont mis dans cette
> catégorie afin de vérifier s'ils ne peuvent pas être classés dans d'autres qui
> leur correspondent ». C'est la plus grosse rubrique : chaque offre qui en sort
> est un gain réel.
>
> **Tous les chiffres ci-dessous viennent de commandes exécutées dans la
> session**, sur le fichier de données réellement collecté
> `data/offres.json` (genereLe **2026-10-07T02:49–02:50Z**, 9 587 offres).

## Méthode (deux classifieurs, un seul jeu d'offres)

- Outil neuf : `node outils/mesure-a7.mjs [--cas]`.
  - **« avant »** = le collecteur de l'unité A6, **extrait du dépôt par l'outil
    lui-même** (`git show HEAD:collecteur.mjs` → fichier temporaire, importé) ;
  - **« après »** = le collecteur de travail (A7).
  - Les deux lisent le **MÊME** `data/offres.json` : l'écart est donc exactement
    l'apport de A7, offre par offre.
- Contrôle de base : la rubrique **stockée** doit coïncider avec le rejeu
  « après » → **0 divergence** (la publication courante vient bien du code
  mesuré). ✔
- Liste des mots restants : `node outils/audit-autres.mjs`.
- Cohérence/preuves : `node outils/verificateur-categories.mjs --fichier data/offres.json`.

## Corrections appliquées (mots ajoutés aux tables de `collecteur.mjs`)

Aucune n'est inventée : chacune vient d'un mot **fréquent** relevé par
`audit-autres.mjs` sur les offres réellement en « Autres ».

1. **Électroménager — noms d'APPAREIL manquants** (`MOTS_FORTS.electromenager`) :
   `kaffeevollautomat` (PHILIPS LatteGo, DE/AT), `dampfbugelstation`
   (Philips PerfectCare, DE/AT), `fensterputzroboter` (ECOVACS WINBOT, AT/DE),
   `saugroboter` (dreame L40/X50, DE/AT), `nettoyeur de vitres` (ECOVACS,
   FR), `centrale vapeur` (Calor, FR/BE), `machine a expresso` (Bialetti, FR),
   `bodygroom` / `bodygroomer` (Philips, FR/NL/PL), `multiquick` (Braun, BE),
   `ergomaster` (Bosch, BE), `pastamachine` (Philips, NL), `aquaclean` (filtres
   Philips, NL/SE/PL), `luftfuktare` (Philips, SE), `nawilzacz` (Philips, PL),
   `parownica` (Philips, PL). Ce sont des **noms d'appareil** (même sûreté que
   `haartrockner`), jamais des marques ambiguës.
2. **Beauté — appareils de soin nommés** (`MOTS_FORTS.beaute`) : `sonicare`
   (brosses à dents Philips Sonicare, SE/NL/ES/PT), `smart ipl` (épilateurs
   Braun Smart IPL, BE), `reaura` (masque LED Philips, NL).
3. **Maison — petit mobilier et entretien** (`FAMILLES.maison`) : `bocaux`,
   `boite a pain`, `chiffon microfibre`, `paillasson`, `guirlande`
   (ventes flash Amazon, sans rubrique de source : BE).
4. **Beauté — cosmétique courant** (`FAMILLES.beaute`) : `mascara` (Maybelline,
   GB/NL).
5. **Bricolage — marque de gamme** (`MARQUES.bricolage`) : `bosch professional`
   (la gamme **outillage électro-portatif bleue**). ⚠ La marque **nue `bosch`
   reste interdite** (un test l'exige : Bosch fait aussi des lave-linge et des
   frigos) ; c'est la gamme « Professional » qui ne désigne que l'outillage.

## Faux positif trouvé ET corrigé dans cette unité

`mascara` (mot fort de Beauté) se lisait en **sous-chaîne** et attrapait le
**portugais « desmasca**ra** »** : mesuré, l'article de presse
« Black Friday: atenção ao teste dos 30 dias que **desmascara** falsos descontos
- Leak.pt » était rangé en **Beauté**. Ajout du mot à `MOTS_A_FRONTIERE`
(lecture entre deux frontières) : « Mascara » isolé continue de matcher
(vérifié : « Maybelline Mascara… » → beaute), le faux positif disparaît
(vérifié : « …desmascara falsos descontos » → autre).

## Mesure — « Autres » avant / après

```
ANCIEN (A6) : 1520  (15.9 %)
NOUVEAU(A7) : 1441  (15.0 %)     écart : -79
ENTRÉES dans « Autres » : 0      (aucune régression)
```

**79 offres sont sorties d'« Autres »**, sans qu'aucune n'y retombe :

| Transition | n | Nature (vérifiée une par une) |
|---|---:|---|
| autre → electromenager | 50 | cafetières, fers vapeur, robots aspirateurs, nettoyeurs de vitres, mélangeurs |
| autre → bricolage | 11 | gamme Bosch Professional (perceuses, meuleuses, scies, lasers, batteries) |
| autre → beaute | 10 | brosses à dents Sonicare, épilateurs Smart IPL, masque ReAura, mascara |
| autre → maison | 8 | bocaux, paillassons, chiffons microfibre, guirlande (Amazon BE) |

Les **35 autres changements ne concernent pas « Autres »** mais corrigent des
erreurs d'une rubrique vers une autre — tous justifiés :
`maison → electromenager` 12 (appareils sortis de Maison), `beaute →
electromenager` 6 (rasoirs/bodygroom), `tech → bricolage` 6, `mode → beaute` 3
(Sonicare), `auto/mode → electromenager` 4, `mode → bricolage` 2,
`maison → bricolage` 1, `sport → bricolage` 1 — soit **10 offres Bosch
Professional** ramenées de `tech`/`mode`/`sport`/`maison` vers **Bricolage**.

### Cas cités (extraits de `mesure-a7.mjs --cas`)

- Électroménager : `PHILIPS Kaffeevollautomat LatteGo 5500`, `Calor Pro Express
  Ultimate Centrale Vapeur`, `dreame L40 Ultra A Saugroboter`, `ECOVACS WINBOT
  W3 OMNI`, `Philips Parownica serii 1000`, `philips AquaClean`.
- Bricolage : `Bosch Professional kantfräs GKF 550`, `GW5 12V-76`, `batteriset
  18V`, `Lijnlaser GLL 12V`.
- Beauté : `Philips Sonicare W2 Optimal White`, `Braun Smart IPL Skin i-expert`,
  `Philips ReAura LED-gezichtsmasker`, `Maybelline Mascara Lash Sensational`.
- Maison : `ComSaf Bocaux en Verre`, `AUAUY Paillasson antidérapant`,
  `MR.SIGA Chiffon Microfibre`, `LED Guirlande Guinguette 15M`.

## Ce qui reste en « Autres » — et ce que je N'AI PAS fait (à trancher)

« Autres » = **1 441 (15,0 %)**, en baisse depuis 15,9 %. Aucun de ces restes
ne peut être rangé **honnêtement** par une table de mots :

1. **Pages de CODES PROMO, sans produit** — mots les plus fréquents :
   `code` (70), `ofertas` (61), `rabatt` (53), `angebote` (52), `descuento` (43),
   `codes` (41), `sconto`/`desconto` (35), `discount` (34), `gutschein` (17),
   `promocja` (26). Ex. : « 40% Off Adult Mains Via App Code », « Cupón
   descuento MediaMarkt 20€ ». → **décision produit de B** : les garde-t-on ?
   (ce ne sont pas des promotions-produits).
2. **Articles de PRESSE / éditoriaux** — `days` (99, « Prime Days »), `besten`
   (36), `october` (38), `best` (28), `mega` (26), `actualite` (21). Ex. :
   « Amazon Prime Day 2026: Mit diesen fünf Tipps … ». → même question.
3. **Marques AMBIGUËS volontairement non inscrites** : `philips` (29),
   `braun` (17) — un test interdit de ranger ces marques dans une seule famille
   (Philips fait téléviseurs, rasoirs, friteuses ; Braun rasoirs, mixeurs). Une
   offre dont le titre n'est qu'un **numéro de modèle** (« Philips 8000 Series
   DST8040/30 », « Bosch WGB264ACFG i-DOS ») reste donc en « Autres » : on ne
   **devine pas** l'appareil.
4. **Domaines SANS rubrique** : musique/vinyle (`vinyl` 29, « The Lost Boys …
   Red Vinyl »). Créer un onglet Musique n'est pas dans la demande de B.

## Test ajusté

`tests/categories.test.mjs` (test « le nom d'une de nos familles ne sert JAMAIS
de preuve de catégorie ») prenait pour contre-exemple « Braun Smart IPL Skin
i-expert » : ce titre **nomme désormais un appareil de soin** (« smart ipl »),
il tombe donc en **Beauté**, et c'est correct. Remplacé par un titre du catalogue
réduit au **seul modèle** (« Braun Series 7 72-G7200CC »), qui reste bien en
« Autres » — le test garde exactement son intention.

## Contrôles

- `bash bin/tester.sh` → **175/175**, 0 échec.
- `node outils/verificateur-categories.mjs --fichier data/offres.json` →
  **CONFORME** : 0 écart enregistré/recalculé, 0 offre sans preuve, 0 titre
  désignant une autre rubrique.
- `node outils/mesure-a7.mjs` → divergence stocké/après = **0**.

## Ce qui n'est PAS fait (honnêteté)

- Pas de nouvelle rubrique (musique, hygiène bébé — couches Pampers/BIOLANE
  restent en « Autres », comme signalé en A3) : hors demande de B, à trancher.
- Le tri des pages de codes promo et des articles de presse est une **décision
  éditoriale**, pas un classement : rapportée à B, pas exécutée.
- La publication du site (`docs/`) et l'APK sont l'unité **D**, pas A7.
