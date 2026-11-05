# AUDIT B6 — Recollecte, publication, répartition par pays et par rubrique

**Unité B6** (phase B, après B5). Objectif : mesurer, sur le **site publié**, la
répartition **par pays** et **par rubrique** — en particulier l'effet des sources
câblées en B5 — et **nommer les pays vides** au lieu de les taire.

Règle du projet : aucun chiffre ici sans une commande exécutée dans cette session.

## 1. Recollecte et publication

La collecte et la publication sont assurées **en continu** par `bin/collecter.sh`
(cadence automatique de 5 min, publication vers `origin/main`) : ce n'est donc pas
un geste manuel qu'il faudrait refaire — il est **vérifié**.

- `docs/offres.json` (ce que voit le lecteur) — `genereLe` **2026-10-07T05:15:25.117Z**,
  **9 869 offres**, **0 sans rubrique**.
- `git rev-parse HEAD` = `git rev-parse origin/main` =
  **`7079402fda2f028ce8c724f31361f49437a1edc6`** → site **publié et synchronisé**.
- Journal du dernier passage : **61 sources exécutées, 0 en échec** (les autres sont en
  « repos » — délai non écoulé, `collecteur.mjs:4016`).

## 2. Répartition GLOBALE (ordre des onglets — jamais trié par nombre)

| rubrique | offres | % |
|---|---:|---:|
| High-tech | 3 307 | 33,5 % |
| Électroménager | 780 | 7,9 % |
| Meubles | 75 | 0,8 % |
| Maison | 660 | 6,7 % |
| Mode | 606 | 6,1 % |
| Auto & moto | 176 | 1,8 % |
| Jeux & jouets | 780 | 7,9 % |
| Sport | 314 | 3,2 % |
| Bricolage | 587 | 5,9 % |
| Beauté | 425 | 4,3 % |
| Nourriture | 426 | 4,3 % |
| Animaux | 98 | 1,0 % |
| Voyages | 112 | 1,1 % |
| Activité | 62 | 0,6 % |
| **Autres** | **1 461** | **14,8 %** |

Total = **9 869** (aucune rubrique à zéro au global). « Autres » reste sous les 15 %.

## 3. Répartition PAR PAYS et pays vides (nommés)

| pays | offres | rubriques à ZÉRO |
|---|---:|---|
| AT | 547 | Meubles, Animaux |
| BE | 1 517 | — (aucune) |
| DE | 1 474 | — |
| ES | 1 281 | — |
| FR | 1 170 | — |
| GB | 1 364 | Animaux |
| IE | 310 | Voyages, Activité |
| IT | 364 | Meubles, Activité |
| NL | 498 | Animaux |
| PL | 833 | Animaux, Activité |
| PT | 303 | Meubles, Maison, Animaux, Activité |
| SE | 208 | Meubles, Nourriture, Voyages, Activité |

Détail (extraits mesurés) : BE High-tech 243 · Électroménager 180 · Jeux & jouets 260 ·
Bricolage 103 · Maison 195 · **Activité 40** ; DE **Animaux 38** ; SE **Animaux 35** ;
IT **Animaux 14** ; ES **Nourriture 113** ; GB **Nourriture 170**.
**Sept pays sur douze** ont encore au moins une rubrique vide — c'est un fait dit, pas un détail.

## 4. Effet des sources câblées en B5 (preuves nommées)

Compté sur `docs/offres.json` par `marchand` (source) et par rubrique :

| source (B5) | offres publiées | pays |
|---|---:|---|
| Zooplus | 86 | DE 38 · SE 34 · IT 14 |
| Social Deal | 28 | BE 6 · NL 6 · FR 6 · AT 6 · DE 4 |
| Coolblue | 245 | BE 199 (déjà avant B5) · **NL 24** · **DE 22** |

- **Animaux : 12 → 98** (contre E9, 9 484 → 9 869 offres) — Zooplus 86 + Amazon 12.
  Cinq exemples : *Cat's Best Original Katzenstreu* (DE), *4 + 2 på köpet! 6 x 70 g
  Applaws* (SE), *Josera Kitten 12 x 85 g* (SE), *Globlazer Arbre à Chat XL 167 cm*
  (BE), *FELIX Wet Cat Food* (IE).
- **Activité : 45 → 62**, dont **Groupon 37 · Social Deal 17** — l'Activité n'est plus
  purement belge (Social Deal : BE/NL/FR/AT/DE).
- **Voyages : 107 → 112**, alimenté par de multiples sources (Skyscanner 12, BuscoUnChollo 7,
  Ryanair 7, Urlaubspiraten 6, eSky.pl 5, TUI 3, Voyage Privé 2…).

## 5. Cinq exemples par nouvelles rubriques (preuve des compteurs)

- **Meubles (75)** : *COSTWAY Krzesło biurowe* (PL), *Sommier à lattes 28 lattes* (BE),
  *AKIZA Chariot roulant 4 étagères* (BE), *SONGMICS Étagère à Épices Lot de 4* (BE),
  *SONGMICS Étagère Rotative 20 pots* (BE).
- **Nourriture (426)** : *Cadbury Heroes Chocolate Bulk 2 kg* (IE), *Alle ongekoelde
  maaltijdpakketten 50 % @ Jumbo* (NL), *Comprando 2 ahorra 50 %* (ES), *NESCAFÉ Dolce
  Gusto 180 cápsulas* (ES), *The Glendronach 12 Jahre 0,7 l Whisky* (DE).
- **Animaux (98)** : cf. §4.
- **Voyages (112)** : *Movie Park Germany — Eintritt* (AT, **correct** : parc en
  Allemagne vu d'Autriche → point 21), *zoo de Maubeuge 300 animaux* (BE, **correct** :
  Maubeuge est en France), *NS Herfstvakantie −60 % train* (NL), *Green SM taxi-app
  Nederland* (NL, **faux positif, cité ci-dessous**), *3-gangen keuzediner bij Ibiza
  Tilburg* (NL, **faux positif, cité ci-dessous**).

## 6. Cas gênants CITÉS (pas cachés) — rien corrigé (B6 = mesure)

1. **Faux positif VOYAGES** : « Green SM Nieuwe taxi-app in Nederland: Eerste 10 ritten
   met 50% korting » (**NL**) — une **application de taxi locale**, pas un voyage : sa
   place est en **Activité** (ou nulle part). Même famille de défaut qu'en E9
   (*Reisvacuümtassen*, *caricatore da viaggio*).
2. **Faux positif VOYAGES (même cause, plus net)** : « 3-gangen keuzediner bij **Ibiza**
   Tilburg » (**NL**) — un **repas pris dehors à Tilburg**, aux Pays-Bas : il devrait être
   en **Activité** (point 22). Le détecteur de destination (point 21) a lu *Ibiza* dans le
   **nom du restaurant** et a conclu « destination étrangère ». C'est le **gisement
   d'erreurs** annoncé : un mot de destination géographique pris comme nom propre.
3. **Jeux & jouets** : « [Amazon Prime Deal] **Pampers** Sensitive billendoekjes 1200 st. »
   (**NL**) rangé en **Jouets**, tandis que « Pampers Sensitive Billendoekjes, 1200 »
   (NL) est en **Beauté** : des **lingettes bébé**, ni jouet ni beauté (hygiène).
4. **Bricolage** : « **Beler Kit de broderie** 3 pièces pour débutants » (BE, Amazon) —
   un kit de **broderie** (loisir créatif), pas de l'outillage.
5. **Auto & moto** : « 75% DESCUENTO EN **ACCIONA IKEA JEREZ** » (ES) — promotion de
   **recharge de véhicule électrique** : rubrique défendable, mais citée (déjà vue en E5).
6. **Mode manquée (lacune A8 non refermée)** : 3 offres « DANISH ENDURANCE
   **Bambukalsonger** » (**SE**) restent en **Autres** — le mot **suédois `kalsonger`**
   (caleçon/boxer) est absent des tables (A8 a complété les chaussettes, pas les
   sous-vêtements sv). Et « DANISH ENDURANCE **Bokserki** » (PL) est en **Sport** alors
   que « Bokserki Bambusowe » (PL) est en **Mode** : **incohérence mesurée**.

## 7. Tests

`bash bin/tester.sh` : **185 / 185**, 0 échec. Vérificateur de catégories : inchangé
(seule une mesure a été produite ici ; aucune table touchée).
