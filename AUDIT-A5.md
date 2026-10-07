# Audit A5 — Vérifier les autres rubriques (tech, maison, mode, beauté, sport, auto)

> Session du **7 octobre 2026, ~01:55 UTC**. Unité **A5** du PLAN-NUIT.md :
> « Vérifier les autres rubriques (tech, maison, mode, beauté, sport, auto) :
> contradictions source/titre ». Même esprit que A3/A4 : **constat, aucune
> correction** (c'est A6). Tous les chiffres sortent de `node outils/audit-a5.mjs`,
> outil neuf de cette unité, lancé dans la session.

## Méthode

- Source lue : le **site publié**, `docs/offres.json` — ce que voit le lecteur.
- Une **contradiction source/titre** est mesurée ainsi : la rubrique de la
  SOURCE (`categorieSource`, un rayon nommé par le marchand) désigne une famille
  A, mais le TITRE désigne une famille B ≠ A. Le **produit nommé** (MOTS_FORTS)
  tranche ; à défaut, le meilleur mot faible (FAMILLES).
- Le contrôle lit EXACTEMENT comme le classement : tables **importées**, pas
  recopiées, frontières de mot respectées.
- Lancement : `node outils/audit-a5.mjs` ; liste brute : `--detail`.

## En-tête mesuré

```
AUDIT A5 — AUTRES RUBRIQUES
  fichier   : docs/offres.json
  genereLe  : 2026-10-07T01:46:03.206Z
  offres    : 9537
  cohérence enregistrée/calculée : 0 écart(s)
```

**0 écart** : la rubrique publiée est exactement ce que `classerOffre()` produit
aujourd'hui. Les défauts sont donc ceux de la **règle**, pas des données périmées.

## Tableau des contradictions mesurées

| rubrique | offres | contradictions source/titre | dont produit nommé | dont mot faible |
|---|--:|--:|--:|--:|
| High-tech | 3 222 | 124 | 25 | 99 |
| Maison | 661 | 74 | 0 | 74 |
| Mode | 596 | 49 | 0 | 49 |
| Beauté | 410 | 42 | 1 | 41 |
| Sport | 313 | 70 | 0 | 70 |
| Auto & moto | 176 | 37 | 9 | 28 |
| **TOTAL** | **5 378** | **396** | **35** | **361** |

⚠ **396 n'est PAS 396 erreurs.** Comme pour A3/A4, une grande part des
« contradictions mot faible » sont du **bruit de sous-chaîne** : le titre ne
contredit pas la source, il contient un mot d'une autre famille **lu dans un
mot ordinaire** (`brico` ⊂ « inalámbricos », `scie` ⊂ « scientifique »,
`pila` ⊂ « empilables », `farg` ⊂ « färgat »). Ne sont détaillés ci-dessous que
les cas **réels**, examinés un par un.

## High-tech (3 222 offres) — 25 produit nommé / 99 mot faible

La rubrique est **saine** : les contradictions « produit nommé » sont des
**jeux vidéo** (`Bundle Symphony of War`, `Hidden Numbers PRO (Android) App`)
ou des **articles smart-home** dont la source porte un rayon générique — tous
correctement en High-tech (le jeu numérique et l'app sont du logiciel : c'est
la règle `estJeuNumerique`). Les « mot faible » sont majoritairement du bruit de
sous-chaîne (`brico` ⊂ inalámbricos : `Barra de Sonido TCL`, `Reolink
Türklingel`, `Meross Thermostat`). **Aucune casse nette côté High-tech.**

## Maison (661 offres) — 0 produit nommé / 74 mot faible → **casse réelle**

La source publie ces offres dans un rayon « Maison/Home » et le titre dit, lui,
**Nourriture** ou **Électroménager** — c'est le **partage E1/E6 qui n'a pas été
appliqué** (mot absent des tables). Cas nets :

- **Alimentation restée en Maison** (devrait être **Nourriture**) :
  `Diplomático Reserva Exclusiva Rum 0,7 l` (DE),
  `Woodford Reserve Bourbon Whiskey 0,7 l` (DE),
  `Lotus Biscoff Kekse 4 x 250g` (DE), `kinder Schokolade 300g` (DE),
  `Segafredo Zanetti Espresso … Kaffeebohnen 1 kg` (DE),
  `[Lidl+] Pommes de Terre Four - 2.5 Kg` (FR),
  `Victorinox Swiss Classic Frühstücksmesser` (DE, couteau de petit-déj).
- **Appareils restés en Maison** (devrait être **Électroménager**) :
  `Hisense WF1G7021BW 7kg Washing Machine` (GB — mot **anglais**
  `washing machine` absent des tables), `Zamrażarka Bomann 143 cm` (PL,
  congélateur), `Samsung Jet 75E Stick Vacuum Cleaner` (GB),
  `20L Einhell Wet and Dry Vacuum Cleaner` (GB),
  `Philips Fusselrasierer GC026/00` (DE, rasoir anti-peluches).

**Cause unique** : les tables E1/E6 sont incomplètes pour l'**anglais**
(`washing machine`) et l'**allemand/le polonais courant** (`Kekse`,
`Kaffeebohnen`, `Zamrażarka`, `Schokolade`, `Rum`, `Whiskey`). C'est le même
défaut de fond que toute la nuit : un mot manquant = une offre mal rangée.

## Mode (596 offres) — 0 / 49 → ambiguïtés, pas de casse nette

Le gros des contradictions est **Sport ↔ Mode** : chaussures de running et
textiles de sport (`adidas Terrex Anylander`, `Merrell Moab 3 GTX`,
`Zapatillas Puma Deviate Nitro`, `Falke RU4 Running Socken`). Une basket est
légitimement de l'un **ou** de l'autre selon B — **signalé, pas tranché**.
Autres : montres (`Timex x Pan Am`) et casquettes (Mode) dont un mot faible tech
satisfait à tort. Pas de produit d'une autre famille **nommé** dans la rubrique.

## Beauté (410 offres) — 1 produit nommé / 41 mot faible → **casse réelle**

Deux gisements :

1. **Rasoirs et tondeuses ÉLECTRIQUES restés en Beauté** alors que **E1 veut
   qu'ils partent en Électroménager** (la source publie en rayon « Beauté » et
   le mot fort allemand/polonais n'est pas dans la table) :
   `Braun Rasierer Herren Elektrisch Series 9 9100si` (DE),
   `Philips Series 700 Rasierer (S792/06)` (DE),
   `Philips OneBlade Intimate QP1930/34` (AT/DE), `Philips Shaver 5000` (AT),
   `Trymer Philips Multigroom 12w1` (PL), `Tondeuse Philips Multigroom 7000` (FR),
   `Wahl 5606-508 Cortabarbas` (ES), `Lot de 5 lames Philips OneBlade` (FR).
   **~10 offres** — `rasierer`/`shaver`/`trimmer` manquent côté Électroménager.
2. **Soins (BE)** : source « Activité », titre = soin → **correctement Beauté**
   (E3 fait son travail : `Soin de relaxation du dos`, `HIFU visage`, `modelage`,
   `peeling, hydratation, anti-âge`…). Ce n'est **pas** une casse.

## Sport (313 offres) — 0 / 70 → contradictions dominées par le bruit

Beaucoup de « src=Bricolage → Sport » sont des articles de **jardin/outillage**
(`Keter Store It Out Pro 1200L Garden Storage Shed`, `BG Electrical Outdoor
Wall Plug Socket`, `Spear & Jackson Sprayer Wand`, `Brennenstuhl Kabeltrommel`)
que la source publie en rayon « Sport/Outdoor » — **à confirmer en A6** (le
titre ne nomme aucun produit de sport). Le reste est du bruit de sous-chaîne.

## Auto & moto (176 offres) — 9 produit nommé / 28 mot faible

Contradictions réelles citées :

- **Jouet rangé en Auto & moto** : `Pack de 5 coches Hot Wheels - Mattel` (ES)
  → devrait être **Jeux & jouets**. **Casse nette, citée.**
- **Casques de moto SHOEI/HJC** (ES) : source Auto, titre Mode (mot faible) —
  l'offre reste en Auto, **correct** (le casque moto est nommé en `MOTS_FORTS.auto`).
- **Tables de bord High-tech** (`NOCO Genius5` chargeur batterie, `EV Charging
  Cable`, `mobile Wallbox`) : reste en Auto, **correct**.
- `Audi Q3/A3 … neues Modell 2027` (DE) : annonces de voiture en Auto — **correct**
  malgré un mot faible « Mode » parasite.

## Conclusion (à l'attention de A6)

- **Cohérence 0 écart** sur les 6 rubriques : les données sont à jour.
- **396 contradictions source/titre** mesurées (35 par **produit nommé**, 361 par
  mot faible), **mais la majorité des 361 est du bruit de sous-chaîne** — le
  même défaut qu'en A4.
- **Casses réelles nettes, citées** :
  1. **Maison → Nourriture/Électroménager** : ~13 offres (alcools, biscuits,
     café, pommes de terre ; lave-linge, congélateur, aspirateurs) laissées en
     Maison par des **mots manquants** (`washing machine`, `Kekse`,
     `Kaffeebohnen`, `Zamrażarka`, `Schokolade`, `Rum`, `Whiskey`).
  2. **Beauté → Électroménager** : ~10 rasoirs/tondeuses électriques restés en
     Beauté (`Rasierer`, `Shaver`, `Trimmer` manquants).
  3. **Auto → Jeux & jouets** : `Pack de 5 coches Hot Wheels` (ES).
- **Ambiguïtés à trancher par B**, pas à décider en silence : **Sport ↔ Mode**
  (baskets, textiles) et **jardin/outillage ⊕ Sport**.
- Rien corrigé : l'unité A5 est un constat ; les tables seront complétées en **A6/A8**.
