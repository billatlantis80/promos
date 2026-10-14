# Les règles des sept jours — inventaire

Relevé du 14 octobre 2026, sur le code et les plans du dépôt. Toutes ces règles vivent
dans `collecteur.mjs` ; les décisions qui les ont posées sont dans
`.hermes/plans/2026-10-12-donnees-et-peremption-7-jours.md`.

## 1. Ce qui fait réellement SORTIR une carte aujourd'hui

**Ce n'est pas la règle des sept jours** — elle est éteinte (voir §4). Ce qui sort une
carte, c'est **la page elle-même**, sur deux règles allumées le 13/10/2026 :

### 1.1 LA PAGE DÉCIDE DE LA CARTE — `PROMOTION_DECIDE_LA_CARTE_ACTIF = true`

Demande de B, mot pour mot (13/10/2026) :

> « plus de promotion sur la page la carte sort, promotion toujours là prix changé on
> corrige le prix et la remise, promotion toujours là même prix on garde, page morte la
> carte sort »

Quatre branches, et rien d'autre :

| ce que dit la page | ce que fait le site |
|---|---|
| plus de promotion | **la carte sort** |
| promotion, prix changé | on corrige le prix **et** la remise |
| promotion, même prix | on garde |
| page morte (404 / 410) | **la carte sort** |

### 1.2 LE RETRAIT SUR VERDICT — `OFFRES_SORTENT_SUR_VERDICT_ACTIF = true`

Allumé le 13/10/2026 à 13 h 14. La page publie son propre verdict (`isExpired: true/false`) :
si elle se déclare expirée, la carte sort. Si elle se déclare vivante, la carte reste.

**Le silence d'une page n'est jamais une preuve** : « sans verdict » n'est ni une preuve de
mort ni une preuve de vie. C'est la faute que la règle du silence avait commise (§4).

## 2. Les six délais de sept jours

| # | règle | constante | état |
|---|---|---|---|
| 1 | **Plafond de données** — une offre sans service depuis 7 jours | `PLAFOND_DONNEES_JOURS = 7` | mesure sur les offres, **actif** sur la veille |
| 2 | **Le retour** — une offre reservie repart pour 7 jours pleins | calculé | **actif** |
| 3 | **La veille** — un article de plus de 7 jours n'est plus publié | `VEILLE_SEPT_JOURS_ACTIVE = true` | **allumé** le 12/10 |
| 4 | **La presse** — une offre de presse de plus de 7 jours est écartée | `LIMITE_PRESSE_JOURS = 7` | **actif** |
| 5 | **La source disparue** — la même limite, faute de mieux | `LIMITE_SOURCE_DISPARUE_JOURS = 7` | **actif** |
| 6 | **Le verdict revérifié** — au-delà de 7 jours, on relit la page | `VERDICT_SOURCE_MAX_AGE_JOURS = 7` | **actif** |

Deux règles voisines, pour mémoire : le contrôle de prix lit les pages des **enseignes** à
sept jours (`CONTROLE_ENSEIGNE_JOURS`) et celles des **communautés** à trois
(`CONTROLE_COMMUNAUTE_JOURS = 3`).

### 1 — Le plafond de données

Demande de B (12/10/2026), mot pour mot :

> « Après 7 jours affiché sur le site, toutes les images et tout ce qui est en rapport avec
> l'annonce qui dépasse 7 jours doit être effacé, afin de ne rien stocker dans notre
> database inutile et qui pèserait dans l'usage quotidien entre les différents services. »

**Le signal est `vuLe`** — la dernière fois qu'une source a reservi l'offre — et **jamais
`date`** : la date d'une offre marchande est réécrite à chaque passage, donc elle ne dit
pas depuis quand l'offre est en base.

Deux catégories gardent leur règle propre et ne sont **pas** rabotées par celle-ci : les
articles de veille (leur propre délai) et les offres de presse (leur date, tenue par la
règle 4).

### 2 — La règle du retour

Demande de B (12/10/2026), mot pour mot :

> « Concernant la règle des 7 jours, si sur le site internet d'origine de l'annonce, elle
> est toujours présente le 8e jour, elle devra réapparaître sur notre site, pour 7 nouveaux
> jours. Exemple pendant les soldes ou c'est un mois de promotion sur certains articles. »

Ce que ça impose : **le compte à rebours ne part pas de la première mise en ligne, il part
du dernier service de la source.** Une promotion d'un mois est reservie à chaque passage,
son délai repart à sept jours chaque fois, et le plafond ne la voit même pas passer.

Et **rien n'est définitif** : le retrait n'écrit aucune liste d'exclusion. La fonction
`plafondDeDonnees` ne se souvient de rien, donc elle ne peut rien condamner pour toujours.
Une offre reservie le 8e jour rentre comme une offre neuve, délai plein.

Le chiffre qui répond à cette question est mesuré à chaque passage — `revenus`, le nombre
d'offres au-delà du délai qu'une source vient justement de reservir.

## 3. Masquage et effacement — deux choses différentes

C'est le point à ne pas confondre, et les deux niveaux n'ont pas le même état :

| | ce que ça fait | état aujourd'hui |
|---|---|---|
| **Le masquage** (drapeau `perimee`) | la fiche quitte l'**affichage** — elle reste dans le fichier | **ACTIF** — 7 486 fiches masquées, 123 Mo de visuels (relevé du 14/10 à 17 h 01) |
| **L'effacement** (`PLAFOND_OFFRES_ACTIF`) | la fiche **et son visuel** sont supprimés du site publié | **ÉTEINT** — rien n'est effacé |

Le masquage est **réversible à l'usage** : une fiche dont la source resert l'article repart
affichée toute seule, au passage suivant. Le drapeau est posé et levé par la **même
fonction** (`donneesPerimees`) que celle qui compte — pour que le chiffre publié et le
retrait ne puissent jamais désigner deux ensembles différents.

## 4. Ce qui est éteint, et pourquoi

### `PLAFOND_OFFRES_ACTIF = false` — l'effacement des offres

**Éteint parce qu'il a été mis à l'épreuve, et qu'il a échoué.** La règle du silence a été
testée sur 140 pages réelles : sur les 111 offres jugées, **53 portaient
`isExpired: false`** — soit **48 % de faux positifs** (fourchette 95 % : 39-57 %). Autrement
dit, la moitié de ce que la règle aurait emporté était **encore valable chez sa source**.

Raison de fond : **notre vue d'une source est une fenêtre, pas une liste.** Le flux
« tendance » de Dealabs sert trente offres par passage quand la base en compte 1 407. Une
offre peut donc sortir de la fenêtre sans être morte — et sur un flux-fenêtre, elle peut ne
jamais revenir. Une version antérieure de cette règle, qui ne tenait pas compte de ça,
aurait effacé **près de dix mille offres en dix minutes**.

### `PRIX_COMMUNAUTE_ACTIF = false` — la correction des prix communautaires

Décision de B, 13/10/2026, mot pour mot : « Attends que la mesure ait vu davantage avant de
lancer la correction des prix communautaires. »

Le contrôle tourne et publie son **taux de lecture** — combien de pages de marchand livrent
un prix lisible. Sur la première épreuve : **deux prix lisibles sur six, dont un faux**
(83,99 € annoncés là où la carte affiche 63,99 €). Corriger sur cette base remplacerait des
prix justes par des prix faux.

## 5. La règle qui tranche les cas douteux

> **En cas de doute, on RETIRE.**

Les deux erreurs ne sont pas symétriques : montrer une offre morte fait cliquer pour rien
et coûte la confiance, alors qu'enlever une offre encore vivante ne coûte rien — son
marchand la republiera, et elle reviendra. D'où le choix « le plus tôt » partout dans le
code.

## 6. Les garde-fous qui empêchent un allumage silencieux

Ces interrupteurs ne peuvent pas être levés en douce :

- l'épreuve **« la règle des sept jours n'est pas allumée, et ne peut pas s'allumer en
  silence »** — la suite de tests échoue si le booléen est levé sans que ce soit un acte
  visible ;
- l'épreuve **« le volet de la veille est allumé par un acte explicite »** ;
- l'épreuve **« le retrait par verdict n'est pas allumé »**.

Un commentaire qui décrit l'inverse du code est pire qu'une absence de commentaire, parce
qu'on le croit. Trois commentaires de ce genre ont été corrigés le 13/10/2026.
