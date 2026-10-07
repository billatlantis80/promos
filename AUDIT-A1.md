# Audit du code — unité A1

> Session neuve du **7 octobre 2026**, vers **01:04 UTC**.
> Objet : lancer les quatre outils d'audit et **consigner chaque avertissement
> SANS RIEN CORRIGER** (règle de l'unité A1). Aucune correction n'a été faite.
> Tous les chiffres ci-dessous sont la sortie brute des commandes, pas une
> recopie.

## 1. `bash bin/tester.sh` — 175/175, 0 échec

```
# tests 175   # pass 175   # fail 0   # cancelled 0
```

## 2. `node outils/verificateur-categories.mjs` — CONFORME, mais 3 avertissements

Le contrôle tripartite passe :

```
1. COHÉRENCE ET PREUVES
   ✓ toutes les offres portent la catégorie que le calcul leur donne
   ✓ chaque offre rangée dans une rubrique est justifiée par sa source, son titre ou sa marque
   ✓ aucune offre dont le titre désigne clairement une autre rubrique
```

**Avertissement A1-a — « autre par échec » = 1 281 offres sur 9 484 (14 %).**
Ce ne sont pas des « Autres » choisis : aucune preuve, ni source ni titre. Répartition
par pays (taux d'échec) :

| pays | offres | autre-choisi | autre-ÉCHEC | taux |
|------|--------|--------------|-------------|------|
| IE | 298 | 0 | 90 | **30 %** |
| PT | 295 | 0 | 86 | **29 %** |
| AT | 528 | 13 | 121 | **23 %** |
| SE | 173 | 0 | 39 | **23 %** |
| BE | 1474 | 0 | 331 | **22 %** |
| IT | 337 | 0 | 67 | **20 %** |
| PL | 801 | 40 | 90 | 11 % |
| NL | 467 | 7 | 49 | 10 % |
| ES | 1257 | 19 | 119 | 9 % |
| DE | 1375 | 64 | 112 | 8 % |
| GB | 1336 | 50 | 101 | 8 % |
| FR | 1143 | 24 | 76 | 7 % |
| **TOUT** | **9484** | **217** | **1281** | **14 %** |

Point notable : **BE, IE, IT, PT, SE ont 0 « Autre » CHOISI** — tout leur « Autres »
est un échec de classement, pas une décision. Le gisement prioritaire A7 est donc
d'abord **BE (331)**, puis **AT (121)**, **ES (119)**, **DE (112)**, **GB (101)**.

**Avertissement A1-b — libellés de source non traduits : 8 sur 92 rencontrés.**
`CATEGORIES_SOURCES : 181 motifs déclarés · libellés bruts rencontrés : 92, non
traduits : 8`. L'outil ne nomme pas les 8 ; à élucider en A5/A7 (constat, pas
correction).

**Avertissement A1-c — couverture des langues : conforme.** Les 13 familles sont
lues dans les 9 langues (minimum observé : 8 mots par famille). Les deux familles
neuves d'E8 sont couvertes : `animaux` 14–26 mots selon la langue, `voyages` 9–15.
Aucune famille à zéro dans une langue.

## 3. `node outils/solidite-rubrique-auto.mjs` — auto = 176 offres

```
justifiées par le TITRE  : 127
justifiées par la SOURCE : 49
```

Les 49 offres rangées en « Auto & moto » **par la seule étiquette de source**
(titre muet) — consignées, non corrigées. Principaux fournisseurs :
`Auto & Motorrad — Amazon` (10), `Auto & Motorrad — mydealz` (5), `Auto-Moto —
Amazon` (4), `Motoryzacja — Amazon.pl` (4), `Motoryzacja — pepper` (3). Le reste
en 1–2 exemplaires (Lidl, ALDI SÜD, Kaufland, Rameder, NAVEE, Vevor, LeasingMarkt,
Null-Leasing.com, TradeInn, ACCIONA Recarga…). **Avertissement A1-d** : 49 offres
(28 % de la rubrique) reposent sur la source seule, sans confirmation par le titre.

## 4. `node outils/verifier-apk.mjs` — 4 contrôles en échec (attendu avant D2)

```
=== APK — promos.apk
   ✗ tous les fichiers identiques au source, octet par octet — DIFFÉRENTS : app.js
   ✗ instantané récent : 300 min d'écart (toléré 15, collecte toutes les 5 min)
   ✓ signature f15debcfe9a43f8b… (attendu f15debc…, clé conservée)
   ✓ 9057 offres embarquées / 9484 publiées (écart 427)

=== AAB — promos.aab
   ✗ tous les fichiers identiques au source, octet par octet — DIFFÉRENTS : app.js
   ✗ instantané récent : 300 min d'écart (toléré 15, collecte toutes les 5 min)
   ✓ AAB signé (vérifié par jarsigner)

✗ 4 contrôle(s) en échec — NE PAS ANNONCER « À JOUR »
```

**Avertissement A1-e** : l'APK et l'AAB ne sont **pas à jour** — `app.js` a changé
(phases E) et l'instantané embarqué a **300 minutes** de retard. C'est **normal à
ce stade** : la reconstruction est l'unité **D2**, toujours en dernier. La
signature `f15debc…` est **conservée**. **Ne pas annoncer « à jour » avant D2.**

## Synthèse A1

Aucune correction (règle de l'unité). 175/175 tests, vérificateur CONFORME.
Cinq avertissements consignés : (a) 1 281 « Autres » par échec (14 %), (b) 8
libellés de source non traduits, (c) couverture des langues OK, (d) 49 offres auto
justifiées par la source seule, (e) APK/AAB en retard → à reconstruire en D2.
