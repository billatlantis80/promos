# Audit A6 — Corriger les faux positifs démontrés, puis re-mesurer

> Session du **7 octobre 2026, ~02:15 UTC**. Unité **A6** du PLAN-NUIT.md :
> « Corriger **uniquement** les faux positifs démontrés (mot à frontière, mot
> trompeur, produit nommé) ; re-mesurer. » Les faux positifs à corriger sont
> ceux **nommés** dans `AUDIT-A3.md`, `AUDIT-A4.md` et `AUDIT-A5.md`. Tous les
> chiffres sortent des commandes exécutées dans la session (outil neuf
> `outils/audit-a6.mjs`, deux modes).

## Méthode

- Source lue : le **site publié**, `docs/offres.json` — ce que voit le lecteur.
- **Deux mesures** (outil `node outils/audit-a6.mjs`) :
  1. **cohérence** (défaut) : rejoue `classerOffre()` sur toutes les offres et le
     compare à la rubrique **enregistrée** → doit être **0 écart** ;
  2. **contrfactuel** (`--avant <fichier.mjs>`) : rejoue **deux** versions du
     classement sur le **même** jeu d'offres (l'ancienne, extraite de
     `git show HEAD:collecteur.mjs`, et la nouvelle) → la différence EST l'effet
     mesuré des corrections. Repro exacte :
     `git show HEAD:collecteur.mjs > /tmp/avant.mjs`
     `node outils/audit-a6.mjs --avant /tmp/avant.mjs --detail`
- Principe rappelé par le plan : on ne corrige **que** ce qui a été démontré ; on
  ne vide **jamais** « Autres » de force, et une offre sans preuve n'a rien à
  faire ailleurs — elle y **retourne** si son mot n'était qu'une sous-chaîne.

## Corrections appliquées (les trois mécanismes du plan)

Les tables vivent dans `collecteur.mjs`. Trois leviers, tous mesurés :

1. **MOT À FRONTIÈRE** (`MOTS_A_FRONTIERE`) — des mots faibles courts qui ne
   matchent aujourd'hui qu'en **sous-chaîne** d'un mot ordinaire d'une autre
   langue. Ajoutés : `brico`, `pila`, `scie`, `akku`, `sega`, `ladder`, `tools`,
   `lumea`. Ce qu'ils attrapaient à tort (mesuré) : `brico` ⊂ « inalámbricos »
   (casques Skullcandy, barres de son), `pila` ⊂ « de**pila**ción / em**pila**bles
   / reco**pila**ción », `scie` ⊂ « **ści**ernych / **ści**enny / Pier**ście**ni /
   **Śró**dmieście / li**ście** », `akku` ⊂ « **Akku**laufzeit » (liseuses),
   `sega` ⊂ « **Sega**fredo », `ladder` ⊂ « b**ladder** », `tools` ⊂
   « **ToolS**pace », `lumea` ⊂ « P**lumea**u ». Le mot **entier** continue de
   matcher (`scie circulaire`, `Akku-Staubsauger`, `piła`).
2. **MOT TROMPEUR** (`MOTS_TROMPEURS`) — collisions de marque/produit avec un mot
   d'une autre famille. Ajoutés : `babyliss` (⊂ « baby » → jouets), `configuration`
   / `configuracion` / `configurazione` (⊂ « figur » → jouets, Fire TV Stick),
   `fargat` / `fargad` / `fargnattseende` / `flerfargstryck` / `fargdisplay`
   (suédois, ⊂ « färg » → bricolage), `washing machine cleaner` (produit
   d'entretien, ≠ l'appareil), `k-pop` (⊂ « pop » → jouets, vêtements).
3. **PRODUIT NOMMÉ** (`MOTS_FORTS` / `MARQUES`) — un appareil ou un aliment
   **nommé** tranche sur une rubrique de source générique. Ajoutés :
   - **Électroménager** : `washing machine`, `vacuum cleaner`, `fusselrasierer`,
     `zamrazarka`, `shaver`, `cortabarbas`, `fohnborstel`, `oneblade`,
     `akkusauger` ;
   - **Nourriture** : `schokolade`, `kekse`, `kaffeebohnen`, `whiskey`,
     `pommes de terre` — ⚠ `rum` **volontairement absent** (en suédois « rum » =
     « pièce » : un déshumidificateur « för rum upp till 24 m² » partait en
     Nourriture) ;
   - **Beauté** : `lumea` (gamme d'épilateurs IPL Philips) ;
   - **Jeux & jouets** : `hot wheels` — mot **FAIBLE** à dessein, pour que le
     vêtement « Character Clothing Incl. … Hot Wheels » reste en **Mode** (la
     source l'emporte sur un mot faible, pas sur un mot fort) ;
   - **Bricolage** : marque `wagner` (pistolets à peinture), **récupérée** parce
     que la règle de frontière sur `scie` la faisait sinon tomber en « Autres ».

## Re-mesure 1 — cohérence

```
AUDIT A6 — RE-MESURE APRÈS CORRECTIONS
  fichier : docs/offres.json
  offres  : 9540
  écart enregistré/recalculé : 0
```

**0 écart** : la rubrique publiée est exactement ce que `classerOffre()` produit
après correction. Les données publiées embarquent bien la correction.

## Re-mesure 2 — contre-factuel (effet chiffré des corrections)

```
  EFFET MESURÉ : 102 offre(s) changée(s) par la correction
```

Matrice (rubrique d'**avant** → rubrique **après**) :

| # | avant → après | lecteur |
|--:|---|---|
| 20 | Beauté → Électroménager | rasoirs/tondeuses Philips OneBlade, Braun, Wahl `Cortabarbas` |
| 16 | Bricolage → Autres | sous-chaînes retirées (voir « effets de bord ») |
| 12 | Mode → Électroménager | lames/rasoirs OneBlade, Shaver i9000, Braun NEVO |
| 10 | Bricolage → Maison | rangements SONGMICS, Philips Hue, rubans, caisses bois, LED |
| 8 | Maison → Nourriture | alcools, biscuits, chocolat, café en grains, pommes de terre |
| 8 | Maison → Électroménager | lave-linge Hisense, aspirateurs Shark/Einhell, congélateur, Fusselrasierer |
| 6 | Bricolage → Électroménager | aspirateurs roborock/Shark, OneBlade |
| 5 | Jeux & jouets → High-tech | Amazon Fire TV Stick HD |
| 5 | Bricolage → Beauté | Philips Lumea (épilateurs IPL) |
| 3 | Sport → Électroménager | Philips OneBlade |
| 2 | Autres → Électroménager | Braun Series 9 Shaver, OneBlade |
| 2 | Bricolage → High-tech | Amazon Kindle Paperwhite |
| 1 | Jeux & jouets → Électroménager | BaByliss Föhnborstel |
| 1 | Autres → Beauté | Philips Lumea 9900 Pro |
| 1 | Mode → Beauté | Philips Lumea IPL 8000 (IE) |
| 1 | High-tech → Électroménager | ⚠ « MegaThread Récap des deals » (voir ci-dessous) |
| 1 | Auto & moto → Jeux & jouets | `Pack de 5 coches Hot Wheels` (ES) |
| **102** | **TOTAL** | |

**Gains nets par rubrique** (offres qui arrivent) : Électroménager **53** ·
Nourriture **8** · Maison **10** · High-tech **7** · Beauté **7** · Jeux & jouets
**1** — soit **86 offres** replacées dans une **vraie** rubrique. Et **16**
quittent Bricolage pour « Autres » (offres sans preuve, voir plus bas).

## Faux positifs des audits A3/A4/A5 — résolus

- **Maison → Nourriture** (A5, 8) : `Diplomático Reserva Exclusiva Rum 0,7 l`,
  `Woodford Reserve Bourbon`, `Lotus Biscoff Kekse`, `kinder Schokolade`,
  `Segafredo/Corsini Kaffeebohnen`, `Kaba Choco`, `Pommes de Terre Four`. ✔
- **Maison → Électroménager** (A5, 8) : `Hisense … Washing Machine` (×3),
  `Einhell Wet and Dry Vacuum Cleaner`, `Samsung Jet 75E Vacuum`,
  `Teendow C7 MAX Vacuum`, `Zamrażarka Bomann`, `Philips Fusselrasierer`. ✔
- **Beauté → Électroménager** (A5, 20) : `Braun Rasierer Series 9`,
  `Philips Series 700 Rasierer`, `Philips Shaver 5000`, `OneBlade Intimate`,
  `Multigroom`, `Wahl Cortabarbas`… ✔ (le mot `rasierer`/`shaver`/`trimmer`/
  `oneblade` manquait).
- **Auto → Jeux & jouets** (A5, 1) : `Pack de 5 coches Hot Wheels`. ✔
- **Sous-chaînes pures** (A4) : Skullcandy (⊂ inalámbricos), Philips Lumea
  (⊂ depilación / pila), OneBlade (⊂ pila), SONGMICS/Opret (⊂ empilables/pila),
  roborock (⊂ akku), Kindle (⊂ akkulaufzeit), Govee/Seiko (⊂ ściemniana/ścienny),
  TENA (⊂ bladder), Philips Hue / ECOWITT (⊂ farg), ToolSpace (⊂ tools),
  recopilación×2/Udemy (⊂ pila), Władca Pierścieni / USG / Liście (⊂ scie). ✔
- **`figur` ⊂ configuration, `baby` ⊂ BaByliss** (A3) : les 5 `Fire TV Stick HD`
  repassent en **High-tech** et la `BaByliss Föhnborstel` en **Électroménager**. ✔

## ⚠ Effets de bord et cas gênants — cités, pas cachés

La correction est un **repli** : ce qui n'était plus là par sous-chaîne n'a
souvent plus **aucun** mot pour le réclamer → il retombe en « **Autres** ». C'est
le prix honnête de la correction ; ces cas sont cités nommément :

1. **Nouvelle erreur introduite (1)** — `[MegaThread] Récap des meilleurs deals
   Jours Flash Prime Amazon -Ex: Google Pixel 10 Pro…, 5 Lames OneBlade à 35€…`
   (FR) passe de **High-tech** à **Électroménager** : le mot fort `oneblade` est
   lu **au fond d'un titre d'article récapitulatif**. Une correction de fond
   (ne pas classer un article de presse sur un produit cité en passant) relève de
   **A7**, pas de A6.
2. **Outils Bosch réels → « Autres » (2 et +)** —
   `Bosch Professional: narzędzie wielofunkcyjne Multi-Cutter GOP 40-30` (PL) et
   `Bosch Professional planslip GSS 18V-13` sont de **vrais** outils. Ils étaient
   en Bricolage **par accident** (`scie` ⊂ « **ści**ernych ») ; la frontière
   corrige l'accident… mais `bosch` **est absent de `MARQUES.bricolage`** (constat
   déjà porté en A7) → ils restent en « Autres ». **À traiter en A7.**
3. **Casques Skullcandy → « Autres » (2)** — `Skullcandy Crusher EVO Cascos
   Inalámbricos Bluetooth` (ES/PT) : vrais produits **High-tech** ; le mot
   `casque`/`cascos` n'existe pas côté tech → « Autres ». À compléter.
4. **Divers Bricolage → « Autres »** — `Govee Lampa`/`Seiko Zegar ścienny` (PL,
   lampes/horloges), `Opret Pilulier` (BE), `ECOWITT Väderstation` (SE),
   `ToolSpace Balayette` (BE) : faux positifs retirés ; il manque leur mot propre
   (Maison/High-tech). **À traiter en A7/A8.**
5. **Retraits légitimes de Bricolage** (13) — `Recopilación/Recopilacion/
   Recopilatorio` (ES, listes de presse), `Władca Pierścieni` (livres),
   `[Warszawa / Śródmieście] USG…` (santé), `Liście spadają…` (presse),
   `TENA` (protections) : ils **doivent** sortir de Bricolage ; « Autres » est le
   bon refuge.

**Effet sur « Autres »** : **−3** (3 offres en sortent : 2 → Électroménager,
1 → Beauté) et **+16** (bricolage non prouvé) → **net +13**. Dit tel quel : A6
n'est **pas** l'unité qui vide « Autres » (c'est **A7**), et une correction
honnête peut **augmenter** « Autres ».

## Point 12 — rasoirs MANUELS : rien de neuf côté A6

Le plan demande de citer tout rasoir **manuel** déplacé vers Électroménager. **A6
n'en a déplacé aucun** (les mots ajoutés — `shaver`, `rasierer`, `oneblade`,
`cortabarbas` — visent l'appareil électrique). Les deux cas `Gillette Fusion 5`
(refills manuels) restés en **Électroménager** sont **préexistants** (mesurés :
avant = après, cf. `outils/.diag-a6gil.mjs`) : ils relèvent de **E1**, pas de A6,
et restent signalés.

## Conclusion

- **Effet mesuré : 102 offres** changées, dont **86** replacées dans une vraie
  rubrique (Électroménager 53, Maison 10, Nourriture 8, High-tech 7, Beauté 7,
  Jouets 1) et **16** rendues à « Autres » (sous-chaînes retirées).
- **Cohérence 0 écart** sur les 9 540 offres publiées : la correction est bien
  dans les données.
- **1 erreur neuve citée** (MegaThread) et **4 gisements d'effets de bord cités**
  (Bosch, Skullcandy, lampes/horloges, pilulier) → à reprendre en **A7/A8**.
- **Tests : 175/175** (`bash bin/tester.sh`).
