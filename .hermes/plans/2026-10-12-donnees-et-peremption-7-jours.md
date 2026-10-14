# Données du site + péremption à 7 jours — plan (12/10/2026)

Journal de décisions. La demande de B, mot pour mot, puis les mesures, puis ce
qui est décidé et ce qui reste ouvert. **Ne rien implémenter qui ne soit écrit
ici.**

## 1. La demande (12/10/2026, en deux messages)

> « Toutes ces données sont importantes pour le suivi du site et la
> compréhension, après que tu as fait le nécessaire pour adapter tout cela, afin
> de rendre le site plus performant, il faudra que tu me rajoute un onglet dans
> le panneau admin avec toutes ces informations. Toutes les datas qui rentre et
> qui sort. Vers qui ces informations vont, toute la partie data sur les images. »

> « Il faut rajouter aussi cette programmation : après 7 jours affiché sur le
> site, toutes les images et tout ce qui est en rapport avec l'annonce qui
> dépasse 7 jours doit être effacé, afin de ne rien stocker dans notre database
> inutile et qui pèserait dans l'usage quotidien entre les différents services. »

> « Concernant la règle des 7 jours, si sur le site internet d'origine de
> l'annonce, elle est toujours présente le 8e jour, elle devra réapparaître sur
> notre site, pour 7 nouveaux jours. Exemple pendant les soldes ou c'est un mois
> de promotion sur certains articles. »

Trois livrables, dans cet ordre :
1. **alléger** (ce qui pèse dans l'usage quotidien) ;
2. **l'onglet « Données »** du panneau admin : ce qui entre, ce qui sort, vers
   qui, et toute la partie images ;
3. **la règle des 7 jours** : au-delà, l'annonce ET ses images sont effacées.

## 2. Mesures (12/10/2026, 10 h 55 UTC)

| Mesure | Chiffre |
|---|---|
| Images publiées (`docs/img`) | **17 935 fichiers, 1 283 Mo**, 72 ko de moyenne |
| Images orphelines (plus aucune offre ne les référence) | **0 fichier, 0 Mo** |
| Offres au catalogue | 20 525 (dont 18 890 offres, 1 635 veille) |
| Offres non reservies depuis **> 7 jours** (`vuLe`) | **1 177** — soit **35 Mo** d'images |
| Offres de plus de 7 jours à la **première vue** | 1 610 |
| Âge de la plus vieille entrée en base | **7,9 jours** |

### Ce que ces chiffres corrigent

⚠️ **Une affirmation de ma part était fausse et je la retire** : j'avais dit que
« beaucoup d'images servent des offres qui ne sont plus au catalogue ». Mesure :
**zéro orpheline**. Le collecteur nettoie déjà ce qui n'est plus référencé.
Le 1,3 Go n'est donc **pas** du déchet — c'est le catalogue vivant lui-même.

⚠️ **La base a 8 jours.** La règle des 7 jours ne peut donc pas libérer
grand-chose aujourd'hui (35 Mo) : c'est un **plafond pour la suite**, pas un
grand nettoyage. Le dire à B avant qu'il ne s'attende à des gigaoctets.

### Où est le vrai poids

Tout le poids est dans le catalogue **vivant** : 20 525 offres × 72 ko d'image.
Deux leviers seulement, et ils touchent au contenu (donc décision de B) :
1. **des images plus légères** (les 72 ko sont des JPEG d'origine marchande) ;
2. **moins d'offres** (déjà identifié dans le check-up : 20 407 → 5 000
   diviserait le téléchargement par quatre).

## 3. Décisions

### 3.1 La règle des 7 jours — d'abord en MODE MESURE

La fiche `peremption-donnees-collectees` l'impose, et pour une raison dure : **le
cron de collecte tourne toutes les 5 minutes et exécute le code non commité**.
Une règle destructrice ne m'attend pas pour être relue.

Donc, à chaque passage : la règle **calcule** ce qu'elle écarterait, **publie le
chiffre** (`auraitEcartees`, octets d'images), et **n'efface rien**. Le passage
en mode actif se fait après avoir lu ces chiffres — pas sur une intention.

Le signal retenu est **`vuLe`** (la dernière fois que la source a reservi
l'offre), jamais `date` : la date d'une offre marchande est réécrite à chaque
passage, et une date fabriquée ne prouve rien.

### 3.2 Ce que la règle efface, exactement

Pour une offre dont `vuLe` dépasse 7 jours :
- sa **fiche** quitte le catalogue publié ;
- son **image** est supprimée du dossier publié ;
- le passage note `effacees`, `octetsLiberes` dans l'état publié.

**Ce qu'elle n'efface PAS** : les offres de **presse** et les **articles de
veille** gardent leur règle propre (7 jours / 30 jours, déjà en place et tenue
par des épreuves). Ne pas raboter une règle voisine : c'est le défaut que la
fiche de péremption raconte (la purge de date emportait 142 articles de veille).

### 3.3 LA RÈGLE DU RETOUR — le compte à rebours part du dernier SERVICE

Décision de B, 12/10/2026 (troisième message) : « si sur le site internet
d'origine de l'annonce, elle est toujours présente le 8e jour, elle devra
réapparaître sur notre site, pour 7 nouveaux jours. Exemple pendant les soldes
ou c'est un mois de promotion sur certains articles. »

Ce que ça impose, et c'est une contrainte sur le CHOIX DU SIGNAL, pas un détail :

- **le délai part du dernier service de la source (`vuLe`), jamais de la première
  mise en ligne.** Une promotion d'un mois est reservie à chaque passage : son
  délai repart à sept jours chaque fois et le plafond ne la voit pas passer.
  C'est déjà le signal retenu en 3.1 — la demande de B le confirme et le
  verrouille : un signal fondé sur `premiereVue` ou sur `date` aurait emporté les
  promotions longues, et c'est justement ce qu'il refuse ;
- **rien n'est définitif** : ni le retrait, ni la mesure n'écrivent de **liste
  d'exclusion**. Une offre reservie plus tard rentre comme une offre neuve, délai
  plein. Garanti par la forme du code : `plafondDeDonnees` est **pure** (aucune
  mémoire d'un retrait), donc elle ne peut rien condamner pour toujours.

**Le chiffre qui répond à la question des soldes** est désormais MESURÉ à chaque
passage, pas promis : `revenus` = offres au-delà du délai qu'une source vient de
reservir. Elles repartent pour sept jours. Publié dans le journal
(`plafond-donnees`) et dans l'état du site (`plafond7j.revenus`), donc lisible
par l'onglet « Données ».

#### La limite qui reste, et qu'il faut dire

Notre vue d'une source est **une fenêtre, pas une liste** (leçon du verrou 2,
écrite en tête du collecteur). Une offre encore vivante chez son marchand peut
donc ne pas être reservie pendant plus de sept jours si elle sort de la fenêtre
que nous lisons — elle serait alors comptée par le plafond **sans être morte**.
C'est exactement ce que `revenus` permet de mesurer : il dit COMBIEN d'annonces
comptées comme périmées sont en réalité reservies au passage suivant. Tant qu'on
n'a pas ce chiffre sur quelques semaines, le plafond reste en mesure.

### 3.4 L'onglet « Données »

Un neuvième onglet dans le panneau, nourri par un bloc `donnees` de l'état publié
(`docs/etat-collecte.json`, écrit par le collecteur à chaque passage) :
- **ce qui entre** : sources interrogées, offres vues, offres retenues, veille ;
- **ce qui sort** : offres effacées (péremption, doublons, refus), octets libérés ;
- **vers qui** : GitHub Pages, le hub, les visiteurs, la base d'inscription
  (adresses, chez B), les liens affiliés — avec, pour chaque destination, ce qui
  y va et ce qui n'y va jamais ;
- **les images** : nombre, poids, couverture par pays, orphelines, poids moyen,
  ce que la règle des 7 jours retiendrait.

Règle du tuyau (fiche `panneau-admin-donnees-reelles`) : **un champ qu'aucun
programme ne lit est une promesse fausse.** Chaque chiffre affiché doit être
produit par du code qui tourne, jamais écrit à la main dans la page.

## 4. État au 12/10/2026, 11 h 05 — vérifié EN PRODUCTION

Passage de **11:01** lu dans `docs/etat-collecte.json` (et non en intention) :

```
flux   : 29 sources interrogées, 738 offres vues, 477 retenues, 28 sorties, 0 échec
images : 17 935 fichiers, 1 282,5 Mo — orphelines : 94
plafond: mode mesure — effacerait 1 173 offres / 34,3 Mo
         DE 205 · ES 210 · GB 202 · PL 195 · FR 166 · NL 80 · BE 38 · SE 23 · IE 22 · AT 17 · IT 15
épreuves : 799, 0 échec
```

**Deux défauts réels trouvés par la mesure pendant ce travail** (aucun n'était
visible à l'œil) :

1. **La péremption tournait avant la fusion.** Une source de presse qui
   *reservait* un article déjà hors délai le faisait donc republier à chaque
   passage : l'offre était écartée du stock, puis réintroduite par la fusion dans
   le même mouvement. C'est ce que le garde-fou sur les données réelles signalait
   — deux rouges, deux fois, sans cause écrite. La même règle est maintenant
   appliquée à la liste **finale** (garde-fou 25/25, suite entière 799/0).
2. **Le bilan comptait une clé qui n'existe pas** (`entrees`) : un zéro
   permanent, qu'on aurait pu prendre pour une panne. Les clés réelles du journal
   sont désormais lues (`items`, `retenues`, `ecartees`).

## 5. Reste à faire

- **L'onglet « Données »** — le bloc `donnees` est déjà publié à chaque passage :
  l'onglet n'a plus qu'à le lire. C'est le livrable suivant de la demande. Il doit
  afficher, avec le verdict du plafond, les **retours** (`plafond7j.revenus`).
- **Passer le plafond de 7 jours en actif** : sur les chiffres ci-dessus
  (1 173 offres, 34,3 Mo), et après accord de B. La règle du retour (3.3) ne
  change pas le chiffre — elle change ce qu'il faut avoir mesuré avant de
  l'activer : `revenus`, sur plusieurs semaines.
- **Images plus légères** (webp ?) : à mesurer avant de décider — ré-encodage de
  17 935 fichiers.
- **Réduire le catalogue** : décision de produit, pas de code.

## 6. La règle du retour — ce qui a été fait (12/10/2026)

| Élément | État |
|---|---|
| Signal du délai | `vuLe` (dernier service de la source) — jamais `date`, jamais `premiereVue` |
| Retour d'une offre reservie | garanti : `plafondDeDonnees` est pure, aucune liste d'exclusion n'est écrite |
| Délai après retour | **sept jours pleins** (`joursDeServiceRestants` rend 7 sur une offre servie à l'instant) |
| Chiffre des soldes | `revenus` — compté au moment de la fusion, publié dans le journal et dans l'état du site |
| Épreuves | 6 ajoutées : promotion d'un mois non écartée · délai plein au retour · retour après écart · fonction sans mémoire · publication du chiffre · le passage compte bien les retours |

### 6.1 Relevé de 11 h 30, lu sur le site publié (kazendra.com)

```
plafond7j : 1 215 offres au-dessus du délai — 36,4 Mo d'images — revenus : 0
            DE 225 · ES 220 · GB 204 · PL 199 · FR 170 · NL 80 · BE 38 · SE 23 · IE 22 · AT 19 · IT 15
```

`revenus: 0` est un **vrai zéro, vérifié** : recalculé hors du collecteur sur les
fichiers publiés — 1 215 offres au-dessus du délai, 1 208 reservies sur une heure,
**intersection 0**. Ce n'est donc pas une clé morte (le défaut `entrees` corrigé
plus haut). Et c'est logique : une offre ne peut revenir qu'après sept jours de
silence de sa source ; c'est rare, et c'est précisément ce que le compteur doit
surprendre.

**Un défaut de ma part, trouvé par l'exécution et non par la relecture** : le nom
`reconfirmees` était écrit `reconfirmes` à une ligne (deux « e » contre un
ailleurs). Le collecteur s'est donc arrêté aux passages de **11:25 et 11:27**
(`reconfirmes is not defined`). Réparé, repassé à la main à 11:28, puis par le
planificateur à 11:30 et 11:35 : code 0, poussé. Le site n'a rien montré — il est
servi par GitHub Pages ; il a eu dix minutes de retard sur la collecte, rien de
plus.

**Le MÊME défaut est revenu à 12:42**, en réécrivant la ligne du journal : la
même faute, au même endroit, deux arrêts de collecte. Le nom a donc été CHANGÉ
(`retours`) — un nom qu'on peut mal écrire est un défaut de conception, pas une
étourderie.

## 7. B a choisi « B » (12/10/2026) — la règle est prête, pas allumée

Réponse de B, mot pour mot : **« B »**. Le délai court donc depuis la **dernière
confirmation de la source** (`vuLe`), jamais depuis la vie de la fiche sur le
site. Prix évité, mesuré : les ≈20 600 fiches et leurs 1 286 Mo de visuels qui
auraient été supprimés puis re-téléchargés chaque semaine.

### 7.1 Un seul interrupteur, et il est éteint

`PLAFOND_ACTIF` dans le collecteur. **Un seul endroit décide**, et l'épreuve
« la règle des sept jours n'est pas allumée, et ne peut pas s'allumer en
silence » fait échouer la suite si quelqu'un le lève sans y penser : l'allumage
est un acte visible dans le diff, jamais un effet de bord.

La règle elle-même s'écrit **une fois** (`donneesPerimees`) : le chiffre publié et
le retrait passent par la même fonction, donc ils ne peuvent pas désigner deux
ensembles différents — c'est le genre d'écart qu'on ne voit qu'après avoir effacé
ce qu'il ne fallait pas. Une épreuve le vérifie sur le catalogue réel.

### 7.2 Les deux volets de la même règle

1. **Offres** — sortent quand plus aucune source ne les a servies depuis sept
   jours (fiche + visuel). Elles reviennent par la collecte normale si une source
   les sert à nouveau : aucune liste d'exclusion n'est écrite.
2. **Veille (articles de presse)** — la limite passe de 30 à 7 jours, et ils ne
   reviennent pas : leur verrou est leur **date de publication**, qui ne change
   pas. C'est ce qui rend le « ne plus réapparaître » possible SANS mémoire.

### 7.3 Simulation sur le catalogue réel (12/10/2026, 12 h 45)

| Volet | Ce qui part | Visuels | Poids |
|---|---|---|---|
| Offres au-delà du délai | **1 346** | 1 345 | **39,1 Mo** |
| Articles de presse de plus de 7 jours | **548** (dont **232 publiés**) | 76 | **15,9 Mo** |
| **Total** | **1 578 fiches** | — | **55,0 Mo** |

⚠ L'écart entre 548 et 232 n'est pas une erreur : le stock porte plus d'articles
que le site n'en publie (quota de 160 par pays). Le chiffre du stock dit ce qui
cesse d'être stocké ; **232** est ce qui disparaît de l'écran.

### 7.4 Ce qui manque

**Le mot d'activation.** La règle tourne en mesure, elle n'écrit rien, et elle
publie `mode: "mesure"` + `effacees: 0` dans l'état du site. L'allumer est une
décision de B.

## 8. L'interrupteur coupé en deux (12/10/2026, 17 h) — FAIT ET VÉRIFIÉ

Mot de B : *« tu peux couper l'interrupteur en deux et on reprendra le point plus
tard. C'est toi qui devra revenir vers moi une fois que les chiffres sont connus
avec la meilleure solution. »* → le découplage est autorisé, **l'allumage non**,
et la mesure revient à l'agent.

- **Deux constantes, deux décisions** : `PLAFOND_OFFRES_ACTIF` (volet 1, EFFACE,
  risqué) et `VEILLE_SEPT_JOURS_ACTIVE` (volet 2, publie moins, sûr). L'ancien
  booléen unique `PLAFOND_ACTIF` n'existe plus, et une épreuve interdit son retour.
- **L'état publie les deux** : `mode` (offres) et `modeVeille` (veille), plus
  `articles = { publies: 1644, hors7j: 243, hors7jMo: 10 }` — le **publié** — à
  côté de `articlesHorsDelai: 555` qui est le **stock**. Les deux chiffres sont
  donnés ensemble, comme l'exige la fiche de méthode.
- **Un levier par volet** dans l'onglet Exploitation : `offres-perimees`
  (44,7 Mo, risque élevé) et `veille-sept-jours` (10 Mo, risque **nul**).
- **855 épreuves, 0 échec** (852 → 855). Passage à la main `bin/collecter.sh` :
  **code 0**, `git push` OK, état publié relu. Commits `6d0d3be48` puis
  `10ae97faf`, poussés.

### 8.1 Le chiffre qui manquait : le verdict des pages elles-mêmes

Sonde `bin/mesurer-peremption-source.mjs` (hors collecteur, ne modifie rien) sur
la population que la règle du silence viserait : **1 738 offres publiées, 44,7 Mo
de visuels**. Deux tirages, 40 puis 140 pages :

| | 1er tirage | 2e tirage | Ensemble |
|---|---|---|---|
| pages lues | 40 | 140 | 180 |
| jugées (verdict publié sur la page) | 31 | 111 | 142 |
| **encore VIVANTES** (`isExpired: false`) | **17** | **53** | **70** |
| expirées | 14 | 58 | 72 |
| sans verdict publié | 9 | 29 | 38 |
| **taux de faux positifs** | **55 %** | **48 %** (fourchette 95 % : 39-57 %) | ~49 % |

**≈ 660 annonces encore valables** (535 à 780 selon la fourchette) seraient
effacées pour rien par la règle du silence — et sur un flux-fenêtre, une offre
retirée peut **ne jamais revenir**. Le trafic du contrôle : **99-104 Ko par
page**, 1 requête ; la population entière ferait ~250 requêtes et ~24 Mo/jour
(**+13 %** du trafic actuel).

⚠ 21 % de la population (les offres **Amazon** : `flash-be`, `flash-fr`,
`amazon-*`) **ne publient aucun verdict** : elles ne sont pas jugées, et on ne
leur applique pas un taux mesuré sur les autres.

### 8.2 La meilleure solution — proposée, pas allumée

1. **Volet des offres : remplacer le silence par le verdict.** Au 7e jour, lire la
   page ; `isExpired: true` → elle sort **avec preuve** ; encore vivante → sept
   nouveaux jours. C'est la lettre de la règle de B (« si sur le site d'origine
   elle est toujours présente le 8e jour, elle doit réapparaître »), et ça
   supprime les ~660 fausses sorties. Coût : le trafic du contrôle, dit plus haut.
   Les familles sans verdict (Amazon) restent en **observation**.
2. **Volet de la veille : 30 → 7 jours.** La moitié sûre, aucun faux positif
   possible (verrou = date de publication, immuable). 243 articles publiés
   quitteraient l'écran, ~10 Mo ; le stock garde tout, revenir en arrière est un mot.

### 8.3 Ce qui attend B

**Un mot** : « vas-y » = je câble (1) en mesure — aucun retrait — et j'allume (2).
Rien n'efface avant son accord, dans les deux cas.

## 9. « Vas-y » (12/10/2026, 15 h 45) — FAIT ET VÉRIFIÉ

B a dit « vas-y » : les deux volets sont traités. **Un seul des deux efface, et
aucun n'efface du stock.**

### 9.1 La veille est allumée (30 → 7 jours)

- État publié, lu sur le site : `modeVeille: actif`, `joursVeille: 7`.
- **Articles publiés : 1 644 → 1 400** (244 fiches ont quitté l'écran) ; le stock,
  lui, en comptait **2 631** hors délai au premier passage, retombé à **320** une
  fois le ménage fait. Les deux chiffres sont publiés ensemble.
- **Rien n'a été retiré du stock** : revenir en arrière est un mot.
- Le levier `veille-sept-jours` a **disparu de l'onglet** — c'est le comportement
  voulu : une règle allumée ne se propose plus à l'allumage.
- Dépôt publié : **861,7 → 855,3 Mo** (84 % du seuil).

### 9.2 Le contrôle direct tourne, en mesure

- **3 pages par passage**, ~100 Ko chacune, coupure du flux dès le verdict trouvé
  (mesuré : 0,16 Mo pour 3 pages au premier passage, 0,38 Mo au second).
- Le verdict vit dans `donnees/verdicts-sources.json` — **hors du catalogue
  publié** : pas 1,4 Mo de plus dans `offres.json`, et le verdict d'un partenaire
  ne part pas chez le visiteur.
- Publié dans l'état : `verdict.duPassage` (ce que ce passage a lu) et l'état du
  CATALOGUE (`porteurs`, `expirees`, `vivantes`, `tauxVivantesPct`). Relevé du
  15:48 : 3 contrôles → 1 expirée, 1 vivante, 1 sans verdict ; catalogue
  `porteurs: 2, tauxVivantesPct: 50`.
- **La rotation est sans biais** : départage par empreinte, pas par ancienneté de
  service — sinon les premiers passages n'auraient contrôlé que les offres les
  plus vieilles, donc les plus probablement mortes, et le taux publié aurait été
  pessimiste pendant des jours. Tour complet de la population (1 779 offres) en
  5 à 6 jours à 3 par passage.
- **Le retrait reste éteint** (`OFFRES_SORTENT_SUR_VERDICT_ACTIF = false`), gardé
  par une épreuve.

### 9.3 Deux défauts trouvés, et par quoi

1. **La table des verdicts s'est vidée toute seule** (trouvé à l'exécution réelle,
   pas en test) : écrite sous l'identifiant d'offre, élaguée selon les clés du
   stock — deux clés différentes, table vide à chaque passage, `porteurs: 0` alors
   que trois pages venaient d'être lues. Corrigé (clé du stock des deux côtés) et
   tenu par une épreuve qui vérifie **le comportement et le texte**.
2. **Le budget réseau refusait 175 s** : l'épreuve « la collecte tient dans le
   délai » exige que la somme reste sous la moitié de la fenêtre (150 s). Le
   contrôle direct coûte 15 s, prises à parts égales sur les deux étapes de
   visuels (45 → 30 s chacune) — bornées d'abord par un NOMBRE, donc leur délai
   n'est pas ce qui les limite. Mesure : 13 s avant, 65 s au passage de
   réorganisation de la veille, **20 s ensuite**.
3. Un garde-fou rouge sur les données réelles (`dates-relevees`) : une offre
   Amazon du Portugal a reçu son marqueur de date de relevé APRÈS avoir reçu une
   date fabriquée. Explication « ça se répare au passage suivant » **vérifiée** :
   vert au passage suivant, comme annoncé. Aucun code ajouté.

**864 épreuves, 0 échec** (855 → 864). Deux passages à la main : `code 0`,
poussés. État en ligne relu par requête : `modeVeille: actif`, 1 400 articles.

### 9.4 Ce qui reste

Laisser tourner la rotation (5 à 6 jours), puis lire `tauxVivantesPct` sur la
population entière : c'est ce chiffre-là, et pas une intuition, qui dira s'il faut
allumer le retrait sur verdict.
