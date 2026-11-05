# Audit A2 — Répartition par famille et par pays, offres sans preuve

> Session neuve du **7 octobre 2026, ~01:20 UTC**. Unité **A2** du PLAN-NUIT.md :
> « Répartition par famille ET par pays sur les données publiées ; lister les
> offres sans preuve (ni source ni titre). »
> **Aucune correction** : c'est un constat, comme A1. Tous les chiffres sortent
> de `node outils/audit-a2.mjs` (outil neuf de cette unité), lancé dans la
> session — rien n'est recopié à la main.

## Méthode

- Source lue : le **site publié**, `docs/offres.json` — ce que voit le lecteur,
  pas l'intermédiaire de collecte.
- La preuve d'une offre est jugée avec **exactement** les tables et fonctions du
  classement (`classerOffre`, `FAMILLES`+`MARQUES`+`MOTS_FORTS`,
  `categorieDeSource`) et les mêmes exceptions (jeu numérique, soin, plage
  d'âge, repas dehors, voyage géographique, rubrique imposée). Un contrôle plus
  laxiste ou plus strict fabriquerait de faux défauts.
- Lancement : `node outils/audit-a2.mjs` ; liste brute exhaustive :
  `node outils/audit-a2.mjs --detail`.

## En-tête mesuré

```
AUDIT A2 — 9505 offres publiées
  fichier  : docs/offres.json
  genereLe : 2026-10-07T01:15:59.206Z
  cohérence: 0 offre dont la rubrique enregistrée ne correspond plus au calcul
```

## 1. Répartition par famille (ordre des onglets, jamais trié par nombre)

| famille | offres | % |
|---|--:|--:|
| High-tech | 3 216 | 33,8 % |
| Électroménager | 637 | 6,7 % |
| Meubles | 70 | 0,7 % |
| Maison | 659 | 6,9 % |
| Mode | 593 | 6,2 % |
| Auto & moto | 176 | 1,9 % |
| Jeux & jouets | 772 | 8,1 % |
| Sport | 310 | 3,3 % |
| Bricolage | 588 | 6,2 % |
| Beauté | 410 | 4,3 % |
| Nourriture | 411 | 4,3 % |
| Animaux | 12 | 0,1 % |
| Voyages | 107 | 1,1 % |
| Activité | 45 | 0,5 % |
| Autres | 1 499 | 15,8 % |

## 2. Matrice famille × pays (effectifs)

`« . » = famille vide pour ce pays`.

```
pays/tot  High  Élec  Meubl  Maiso  Mode  Auto  Jeux  Sport Brico  Beaut Nourr Anima Voyag Activ Autre
AT   528   207    35     .     43    14    12    27     8    22    19     4     .     3     .    134
BE  1476   234   161    45    172    20    10   258    25   108    62     4     4     5    37    331
DE  1376   418    70     6    162    63    53   111    70   139    62    20     .    25     1    176
ES  1259   419    61     5     64   149    16    88    45    57    76   109     2    29     1    138
FR  1144   499   123     4     55    96    26    72    33    72    26    32     2     4     .    100
GB  1338   523    32     4     48    93    19    89    39    82    74   169     .    14     1    151
IE   310   136     8     2     28    10     2    12     9     4     3     2     3     .     .     91
IT   337   178    47     .      2     5     3     5     5    10    10     4     .     1     .     67
NL   467   183    20     1     32    33     4    51     5    24    24    20     .     9     5     56
PL   802   231    31     3     46    76    26    45    55    59    41    44     .    15     .    130
PT   295   125    23     .      .    14     3    10    12     6    11     3     .     2     .     86
SE   173    63    26     .      7    20     2     4     4     5     2     .     1     .     .     39
```

## 3. Offres sans preuve (ni source ni titre)

```
A. rangées dans une VRAIE famille sans aucune preuve : 0
B. en « Autres » PAR ÉCHEC (ni source ni titre)      : 1282
   par pays : BE 331 · AT 121 · ES 119 · DE 112 · GB 101 · IE 91
              · PL 90 · PT 86 · FR 76 · IT 67 · NL 49 · SE 39
TOTAL sans preuve : 1282  (0 mal rangées, 1282 en « Autres » par échec)
```

**Constat A — aucun défaut dans les vraies familles.** Aucune offre rangée dans
une famille autre que « Autres » n'est sans preuve : le contrôle positif (le
titre ou la source justifie) tient pour les 8 006 offres classées. Ce n'est PAS
la même chose que « toutes les rubriques sont justes » : le contrôle des
*contradictions* (un titre qui désigne une autre rubrique avec ≥ 2 mots) reste
la charge du vérificateur, et il est **CONFORME**.

**Constat B — le « sans preuve » se concentre dans « Autres » (1 282).** C'est
le gisement de l'unité **A7**. La ventilation par **étiquette de source** de ces
1 282 offres est le fait nouveau :

| étiquette portée | offres |
|---|--:|
| `presse` | 823 |
| `vente flash` | 222 |
| `amazon` | 121 |
| `enseigne` | 85 |
| `veille` | 17 |
| autres (télécom, finances, noms de familles) | 14 |

**Interprétation mesurée : l'essentiel du « 14 % » n'est pas un défaut de
classement — c'est du contenu SANS PRODUIT.**
- **823** offres viennent de la **presse** : ce sont des articles (« Actualité :
  Prime Day – … »), pas des promotions classables. L'étiquette `presse` est
  volontairement refusée par `categorieDeSource()` (ce n'est pas une rubrique de
  la source, c'est notre requête) — d'où le classement en « Autres ». À décider
  en A7 : garder ces articles, ou ne pas les publier.
- **222 + 121 = 343** offres **Amazon** (« vente flash »/« amazon ») dont le mot
  produit manque dans nos tables. Cas **nommés** (mesurés) :
  - « **Braun Series 9 PRO+ Electric Shaver** for Men, 9690CCE » (GB) → devrait
    être **Électroménager** (mot `shaver` absent) ;
  - « Maybelline Lash Sensational … **Lengte mascara** » (NL) → **Beauté** (mot
    `mascara` absent) ;
  - « DANISH ENDURANCE **Koszulka Polo Męska** … » (PL) → **Mode**
    (`koszulka` = t-shirt, absent du polonais) ;
  - « **Echo Spot** (2024 release), Smart alarm clock … » (IE/BE) → **High-tech**
    (appareil connecté nommé).
- **85** offres d'**enseigne** et **17** de **veille** : titres muets, à trier en
  A7/A5.

## 4. Taux d'échec par pays (autre-par-échec / total du pays)

| pays | échecs / total | taux |
|---|--:|--:|
| IE | 91 / 310 | **29 %** |
| PT | 86 / 295 | **29 %** |
| AT | 121 / 528 | **23 %** |
| SE | 39 / 173 | **23 %** |
| BE | 331 / 1476 | **22 %** |
| IT | 67 / 337 | **20 %** |
| PL | 90 / 802 | 11 % |
| NL | 49 / 467 | 10 % |
| ES | 119 / 1259 | 9 % |
| DE | 112 / 1376 | 8 % |
| GB | 101 / 1338 | 8 % |
| FR | 76 / 1144 | 7 % |

Cohérent avec A1. Ordre de priorité A7 **inchangé** : BE (331 offres en volume),
puis AT, ES, DE, GB.

## 5. Familles vides, nommées (jamais tues)

```
AT : Meubles, Animaux, Activité
DE : Animaux
FR : Activité
GB : Animaux
IE : Voyages, Activité
IT : Meubles, Animaux, Activité
NL : Animaux
PL : Animaux, Activité
PT : Meubles, Maison, Animaux, Activité
SE : Meubles, Nourriture, Voyages, Activité
```

- **Animaux** est la seule famille **absente partout sauf** BE (4), ES (2), IE (3),
  SE (1) → 12 offres en tout : c'est un onglet quasi vide, à remplir en **B10**.
- **Activité** n'existe qu'en BE (37) et NL (5) — cohérent avec A1 : le reste
  dépend de sources par pays à trouver en **B3/B5**.
- **Meubles** manque dans **AT, IT, PT, SE** ; **Voyages** dans **IE, SE**.
- Fait notable, **PT n'a AUCUNE offre Maison** (295 offres, 0 en Maison) : à
  vérifier en A5.

## Synthèse A2

9505 offres publiées, **cohérence 0**. Répartition par famille et par pays
établie (matrice ci-dessus). **0 offre mal rangée** dans une vraie famille ;
**1 282 offres « sans preuve »**, toutes en « Autres » et majoritairement
**sans produit** (823 articles de presse) ou **produit Amazon non nommé** (343) —
gisement A7, désormais ventilé par étiquette et par pays. 6 familles vides par
pays nommées ; **Animaux (12) et Voyages (107)** sont les plus maigres, à
alimenter en B10/B11. Rien corrigé (règle de l'unité).
