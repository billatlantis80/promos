# Les règles des cartes

**Réécriture entreprise le 14 octobre 2026, à la demande de B** : *« je souhaiterais écrire
à nouveau toutes les règles, une par une »*. L'écrit précédent a été effacé (il reste dans
le commit `c5d7847d`).

## Comment ce fichier se lit

- Les règles s'écrivent **une par une**. Aujourd'hui, la première.
- Chaque ligne porte un **numéro** (1.1, 1.2…) : pour corriger, il suffit de dire « le 1.4,
  non ».
- Chaque règle porte son **état** : *à l'état de projet* (rien n'est appliqué) ou *appliquée*.
- Rien n'est appliqué tant que B n'a pas dit que la règle est juste.

---

## Règle 1 — La vie d'une carte

**État : arrêtée dans toutes ses lignes, et PAS ENCORE APPLIQUÉE.** Six lignes ont été
arrêtées par B le 14/10/2026 — **1.3** (la priorité : `temperature`), **1.10** (le prix
corrigé seulement si la lecture est certaine), **1.13** (le compteur : `premiereVue`),
**1.17** (le démasquage : carte par carte), **1.21** (l'affichage n'est pas borné, le point
est surveillé), **1.27** (le rythme : une fois par semaine, au nom de la politesse).

**Aucun interrupteur n'est touché** : ni la durée, ni la file, ni le budget, ni le rythme.
Ce qui reste à faire n'est plus d'**écrire** la règle, c'est de la **construire** (voir 1.20).

### L'énoncé

**1.1** Une offre **s'affiche pendant cinq jours** sans contrôle. Sa source vient de la
servir : c'est la période de confiance.

**1.2** **Au-delà de cinq jours**, la carte entre dans une **file de vérification**. Elle
**reste affichée** pendant qu'elle attend son tour.

**1.3** La file est traitée **par ordre de priorité**, jamais par ordre d'arrivée :
1. les cartes sur lesquelles on a **cliqué** — dès que la lecture de ta feuille sera branchée ;
2. puis la **`temperature`** la plus haute — la chaleur que la source publie sur sa propre offre ;
3. puis, à défaut de chaleur, les plus **anciennes**.

> **ARRÊTÉE PAR B, 14/10/2026** : « Oui prends la température. »
>
> **Ce qui a été écarté, et pourquoi.** La priorité « cliquée » seule n'était pas
> constructible : les clics partent bien du site vers ta feuille (`public/relais.js`), mais
> **rien dans la collecte ne peut les relire** — le relais reçoit, il ne rend pas, et la
> lecture du rapport est fermée par une clé. Elle reste au rang 1, pour le jour où cette
> lecture sera branchée.
>
> **Ce qui a été mesuré avant de s'engager.** Dans la file des **13 243** cartes, **9 069
> (68,5 %)** portent une `temperature` — de **100** à **7 374**, médiane **179** — et
> **4 174 (31,5 %)** n'en portent aucune : les ventes flash Amazon (9 pays),
> Amazon Deals/Maison, et quelques autres. Le signal vient de MyDealz, HotUKDeals,
> Chollometro, Pepper PL/NL, Dealabs et Preisjäger.
>
> **La conséquence, écrite pour ne pas affamer une famille.** Les deux familles avancent au
> même rythme : le budget de 2 000 pages par jour est réparti **à proportion** — environ
> **1 370** pages pour les cartes à `temperature`, **630** pour les autres. Sans ce partage,
> les 4 174 cartes sans chaleur attendraient indéfiniment derrière 9 069 plus chaudes, alors
> que ce sont justement des **ventes flash** — les offres qui bougent le plus vite.

**1.4** Le **budget de vérification est fixe** : **2 000 pages par jour**, soit environ
**120 Mo**, c'est-à-dire **+25 %** du nombre de requêtes de la collecte et **+8 %** de son
volume — mesuré sur les dernières 24 h : **7 928 requêtes** et **1,46 Go**
(`data/trafic.json`, 94 passages, relevé du 14/10/2026 à 17:46). Le budget ne dépend pas de
la taille du stock — sinon la dette grossit sans fin.

> **ARRÊTÉ LE 14/10/2026, AU NOM DE LA POLITESSE.** Les deux options étaient 2 000 pages/jour
> ou 13 243 (le contrôle quotidien). 2 000 pages/jour, c'est **une requête toutes les 43
> secondes** en moyenne et **une toutes les 4 min 33** sur l'hôte le plus frappé (mydealz) ;
> 13 243, c'est **une toutes les 7 secondes**, et **une toutes les 40 secondes** sur mydealz
> seul. Le second est une signature de crawler. **2 000 est aussi le plancher** : ~1 726
> cartes franchissent les cinq jours chaque jour, donc en dessous la file grandit sans fin et
> la règle devient décorative. Les conditions qui rendent ces 2 000 acceptables sont écrites
> en **1.27**, et elles sont contraignantes.

**1.5** *(nombre mis à jour le 14/10 — la raison de cette ligne reste à corriger, voir 1.25
et 1.26)* À ce rythme, la file des **13 243 cartes** de plus de cinq jours (relevé de 18:01 ;
le chiffre monte chaque jour) se vide en **sept jours** : chaque carte ancienne est donc
revérifiée environ **une fois par semaine**, et une carte morte disparaît en moins d'une
semaine.

**1.6** Une carte **prioritaire** passe **dans les vingt-quatre heures**. *(Prioritaire au
sens de 1.3 : cliquée dès que la lecture de ta feuille sera branchée ; en attendant, les
cartes les plus **chaudes** — la `temperature` la plus haute.)*

### Le verdict, et il n'y a que cinq issues

**1.7** **La page est morte** (404 ou 410) → la **carte et son image sont supprimées**.

**1.8** **La page se déclare expirée** (`isExpired: true`) → la **carte et son image sont
supprimées**.

**1.9** **La page est vivante, le prix est le même** → la carte **sort du contrôle du
jour**. Elle **reste dans la file** : elle y sera revue au tour suivant.

> **⚠ RÉÉCRITE LE 14/10/2026 — « repart pour cinq jours » est impossible depuis 1.13.** Le
> compteur est `premiereVue`, et il **ne recule jamais** : une carte qui a franchi les cinq
> jours ne peut pas les refranchir. L'ancienne formulation décrivait un compteur remis à
> zéro, c'est-à-dire `vuLe` — exactement celui que 1.13 écarte. Une carte confirmée vivante
> n'est donc pas « repartie » : elle est **confirmée jusqu'à son prochain tour**.

**1.10** **La page est vivante, le prix a changé** *et* la lecture est **certaine** → le
**prix et la remise sont corrigés**, et la correction est **datée**.

**ARRÊTÉE PAR B, 14/10/2026** : « Seulement quand la lecture est certaine. »

**1.10.a — Ce que « certaine » veut dire : cinq conditions, toutes exigées.**

1. **Le bon produit.** La page appelée est celle que la carte désigne (`lienMarchand`), et
   elle **déclare** l'identité du produit (référence, ASIN, EAN) que la carte porte. Sans
   identité déclarée, la lecture est **écartée** : c'est exactement l'erreur mesurée, une
   page annonçant **83,99 €** pour une carte à **63,99 €** — le prix du produit voisin.
2. **Le prix vient du JSON-LD produit de cette page** (`offers.price`) — jamais d'un
   découpage de texte, et **jamais** un `lowPrice`/`highPrice` de fourchette
   (`AggregateOffer`).
3. **Aucune ambiguïté** : un prix unique. Une fourchette, un « à partir de », plusieurs
   variantes → écartée.
4. **Même devise et même pays** que la carte.
5. **La promotion tient toujours** : la page publie encore un prix de référence. Sinon ce
   n'est pas un prix à corriger, c'est une **promotion morte** — et c'est 1.12 qui s'applique.

**1.10.b — Quand la lecture n'est pas certaine, il ne se passe rien.** Et « rien » veut dire
rien : l'écart est **enregistré** (statut `prix-ecarte`, les deux prix conservés), la carte
**garde son prix d'origine et sa date**, et personne ne corrige au jugé. Le code le fait déjà
(`PRIX_COMMUNAUTE_ACTIF`, éteint depuis le 13/10) — la règle le **confirme** au lieu de le
contourner.

**1.10.c — La conséquence, mesurée et assumée.** Au relevé du 14/10/2026 : **0 carte** a un
prix corrigé (`prixCorrigeLe` absent partout), et la table des verdicts porte **133
jugements** en tout — **131 vivantes**, **2 expirées**. Cette règle ne promet donc pas des
corrections nombreuses : elle promet qu'une correction publiée est **vraie**. Un prix juste
et daté vaut mieux qu'un prix frais et faux.

**1.11** **La page ne dit rien** (aucun verdict lisible) → **on ne touche à rien**.
**Jamais de retrait sur silence** : le silence d'une page n'est pas une preuve — mesuré à
**48 % de faux positifs**.

**1.12** **Le prix est illisible ou douteux** → le prix d'origine est **conservé tel quel**,
avec sa date. Un prix juste et daté vaut mieux qu'un prix corrigé au hasard. Mais si la page
ne parle plus de promotion, la carte sort.

### Ce que la règle regarde

**1.13** Le compteur des cinq jours se lit sur **`premiereVue`** — la **première fois que la
carte est parue chez nous**. C'est l'âge d'affichage, et rien d'autre.

> **VALIDÉE PAR B, 14/10/2026** : « Le compteur de 5 jours c'est bien la première parution
> chez nous. » C'est la première ligne de la règle 1 qui passe de *projet* à *arrêtée*. Rien
> n'est branché pour autant : la règle n'est pas complète (voir 1.20 et 1.21).

**1.13.a** **Pourquoi pas `vuLe`.** `vuLe` est **remis à zéro chaque fois qu'une source
resert l'offre**. Mesuré le 14/10/2026 : **1 197 offres** (4,9 %) venaient d'être reservies
dans l'heure — `vuLe` = 0 jour — alors que **145** d'entre elles étaient **affichées depuis
plus de cinq jours**, jusqu'à **9 jours**. Sous `vuLe`, ces cartes n'auraient **jamais**
atteint le contrôle des cinq jours. Le compteur aurait décrit la source, pas notre site.

**1.13.b** **Pourquoi pas `date` non plus.** `date` est l'**acte de naissance publié par la
source** : il ne bouge pas. Mesuré : **8 466** offres portent une date de **sept jours ou
plus** alors que la collecte n'a que **dix jours** — une date plus vieille que nous ne peut
venir que de la source ; et **0,2 %** seulement des dates tombent sur une heure de passage.
La phrase précédente de cette règle — « la date est réécrite à chaque passage » — était
**fausse**. Elle l'avait été : avant le 13/10/2026, les pages qui ne publient aucune date
recevaient l'heure du passage. Ces **7 147** pages ont été réparées depuis (`dateRelevee` :
la date est rendue à `premiereVue`).

**1.13.c** **Le repli, et un seul.** **2 544 offres** n'ont pas de `premiereVue` — les
annonces « flash », disparues du flux avant d'être revues. Pour celles-là seulement, et
faute de mieux, on retombe sur `vuLe`, puis sur `date`.

**1.13.d** **`vuLe` garde son usage, mais pas celui-ci.** Il dit la **fraîcheur du dernier
contact** avec la source — c'est lui qui fonde ta règle du 12/10 : le compte à sept jours
repart à chaque service, pour qu'une promotion d'un mois ne soit jamais emportée. Ce n'est
**pas** une preuve de vie : sa fenêtre est étroite (Dealabs « Tendance » sert **30** offres
par passage pour **1 407** en base), donc une offre bien vivante peut sortir de la fenêtre et
laisser filer son compteur. C'est sans danger ici — la règle **envoie voir** au lieu de
supprimer. Ça le serait devenu si on l'avait laissée **supprimer** : **47,7 % de faux
positifs** mesurés le 12/10 sur 140 pages.

**1.14** Le signal de la mort est **le verdict écrit de la page**, jamais notre déduction.

**1.15** Le signal du prix est **la page du marchand**, et il ne vaut que s'il désigne
**le produit de la carte** — pas celui du voisin.

### Ce que ça change par rapport à aujourd'hui

**1.16** Aujourd'hui, à sept jours, la carte est **masquée sans être vérifiée** : au relevé
du 14/10/2026 (18:01), **7 680 fiches** sont dans ce cas et leurs visuels pèsent
**136,7 Mo** (19,1 % des visuels marchands). Et le masquage est **inclus dans la file** :
**les 7 680 masquées sont toutes dans les 13 243 cartes à contrôler** — aucune n'y échappe.
À côté, **5 563 cartes affichées depuis plus de cinq jours** n'ont jamais été contrôlées
(208,9 Mo de visuels).

**1.17** Demain, **on ne cache plus : on va voir.** Une carte ne sort que si sa page le dit.
Donc l'affichage augmente — presque tout est montré — et **le tri se fait sur la preuve**,
plus sur une échéance.

> **ARRÊTÉE PAR B, 14/10/2026** : « Carte par carte. »
>
> Le démasquage **suit** le contrôle, carte par carte : une carte **confirmée vivante** se
> réaffiche, une carte **morte** disparaît. **Rien ne remonte avant d'avoir été vu** — c'est
> la seule façon de tenir « on va voir » sans remettre en vitrine des cartes non vérifiées.
> Démasquer les **7 680** d'un coup aurait montré avant d'avoir vu, alors que la file n'en
> contrôle que **2 000 par jour**.
>
> **Le délai, tel que la règle le donne et pas autrement** : chaque carte remonte le jour où
> elle a été vue, donc la remise en ligne complète prend **au plus sept jours** — le temps de
> traiter la file entière (13 243 cartes à 2 000 par jour). Aucune carte ne peut rester
> masquée plus longtemps que son passage dans la file.

**1.18** Ce qui n'est **pas** touché par cette règle : les **articles de veille**, qui
gardent leur propre délai (1 215 articles, tous dans les sept jours aujourd'hui — la règle
tient parfaitement).

### Ce qui existe déjà, et ce qui manque

**1.19** **Déjà branché** : la lecture du verdict de la page · le retrait sur verdict
(allumé le 13/10) · la correction du prix et de la remise par la page (allumée pour les
enseignes) · la priorité par date — *qui deviendra la priorité de 1.3 : `temperature` la plus
haute, puis ancienneté*.

**1.20** **À construire** : le seuil à cinq jours · la file de vérification avec la priorité
de 1.3 (et la répartition proportionnelle entre cartes à `temperature` et cartes sans) · le
budget quotidien de 2 000 pages, réparti sur 24 h (1.27.c) · le démasquage carte par carte
(1.17) · la lecture au rythme du budget, au lieu de trois pages par passage.

**1.21** **TRANCHÉ PAR B, 14/10/2026** : « Pour l'instant on ne borne pas l'affichage, on
surveille le point pour plus tard. »

- **La décision** : l'affichage reste **non borné** — ni par pays, ni par rubrique.
- **La conséquence, assumée** : la file de vérification **grandit avec le stock** (le
  compteur ne recule jamais, voir 1.13), donc le rythme du contrôle **s'espace** : environ
  une fois par semaine aujourd'hui à 2 000 pages/jour, moins demain si le stock monte.
- **Ce qui est surveillé, et comment** — **branché le 14/10/2026 dans le suivi qui existait
  déjà**, pas dans une tâche de plus : `bin/suivi-images.py` écrit **un enregistrement par
  jour** dans `data/suivi-file-5-jours.jsonl`, ajoute **une ligne au résumé du lundi**, et ne
  parle **que si la file a grandi de plus de 10 % en sept jours** — et jamais plus d'une fois
  par semaine, pour qu'une croissance durable ne devienne pas un message quotidien.
  Épreuvé sur cinq cas (baisse, +5 %, +25 %, historique trop court, premier passage) et sur
  la répétition : seul le +25 % parle, et il ne se répète pas.
- **Le chiffre de départ** (14/10/2026, 18:01) : **13 243 cartes** à contrôler, **56,9 %** du
  catalogue marchand, dont **2 521** comptées sur le repli `vuLe`.

### D'où elle vient

**1.22** Objectif de B, mot pour mot (14/10/2026) :

> « Je veux que les offres apparaissent pendant 5 jours. Après 5 jours et une seconde, il
> doit y avoir un contrôle qualité de la carte. 1. Est-ce que l'offre est toujours en ligne,
> si non, on supprime la carte et l'image. Si oui, un contrôle de qualité doit être réalisé
> pour voir si les prix et les pourcentages sont toujours d'actualité, si pas, adaptés.
> 2. Pour chaque carte qui a plus de 5 jours et une seconde, une fois par jour la carte doit
> être vérifiée au niveau de la validité (offre encore valable ou pas) et vérifier la
> validité du prix s'il y a une modification, si oui, adaptée. »

**1.23** Deux écarts entre cette demande et la règle ci-dessus, et c'est B qui tranche :

- **le rythme** : **TRANCHÉ LE 14/10/2026 — une fois par semaine.** B avait demandé « une
  fois par jour » ; le quotidien demande **13 243 pages**, soit **une requête toutes les
  7 secondes**, et **une toutes les 40 secondes** sur le seul *mydealz*. La décision est
  prise **au nom de la politesse envers les sources**, et elle est écrite en **1.27** ;
- **le prix** : **TRANCHÉ LE 14/10/2026 — « seulement quand la lecture est certaine ».** Les
  cinq conditions de cette certitude sont écrites en **1.10.a**, et l'écart non certain est
  enregistré sans être appliqué (1.10.b).

**1.24** **Correctif du 14/10/2026 (19 h).** B a désigné la ligne **1.13** ; elle était
fausse **sur ses deux moitiés**, et la seconde l'était gravement. Mesure faite sur le
catalogue publié (24 487 fiches, relevé de 17:46) :

- `vuLe` comme compteur d'ancienneté **annulait la règle des cinq jours** : une carte
  reservie chaque passage restait à zéro jour d'âge. 1 197 offres reservies dans l'heure,
  dont **145 affichées depuis plus de cinq jours** (jusqu'à 9) — celles-là ne seraient
  **jamais** passées au contrôle. Le compteur décrivait la source, pas l'âge de la carte.
- la justification écrite contre `date` (« elle est réécrite à chaque passage ») est
  **fausse depuis le 13/10/2026** : 8 466 dates ont sept jours ou plus quand la collecte en
  a dix, et 0,2 % seulement tombent sur une heure de passage. Les 7 147 pages sans date
  publiée ont été réparées (`dateRelevee` → `premiereVue`).

Le compteur est donc **`premiereVue`**, avec `vuLe` en repli unique pour les 2 544 annonces
« flash » qui n'en ont pas. `vuLe` conserve son vrai rôle — la fraîcheur du dernier contact,
qui fonde la règle du 12/10 — et cesse d'être présenté comme une preuve de vie.

**1.25** **Ce que le choix du compteur change, chiffré** (14/10/2026, 19 h — même relevé).
Le compteur n'est pas un mot : c'est la **taille de la file**, et la **liste des cartes
qu'on contrôle**.

- **Taille de la file des cinq jours** : `premiereVue` **13 227** cartes · `vuLe` **11 967** ·
  `date` **13 198**. L'écart n'est pas un détail : les **1 260** cartes d'écart sont celles
  qui étaient **affichées depuis plus de cinq jours** et que l'ancien compteur **exemptait à
  perpétuité** parce que leur source les reservait. Âge d'affichage : médiane **6,2 jours**,
  maximum **10 jours**. Leurs sources : **Amazon ventes flash** (9 pays) et **Groupon** —
  c'est-à-dire les offres **les plus volatiles**, celles dont le prix et la validité bougent
  le plus vite. L'ancienne règle épargnait exactement celles qu'il fallait surveiller.
- **Le repli n'est pas un détail** : **2 179** cartes (**16,5 %** de la file) sont comptées
  sur `vuLe` faute de `premiereVue`, dont **1 605 ventes flash**. La cause est nommée et
  bénigne : le collecteur écrit `premiereVue` **à l'entrée en base** (collecteur.mjs, l. 7810),
  donc une absence signifie que la fiche est **entrée avant que ce repère n'existe** ; et la
  fenêtre des ventes flash (ventes du jour) **se renouvelle entièrement**, donc ces fiches ne
  sont jamais reservies et ne reçoivent pas le repère après coup. C'est un **trou de
  l'histoire**, pas une faille qui dure : toute nouvelle entrée le reçoit.
- **Le catalogue par âge d'affichage** (23 265 offres marchandes) : 0–1 j **2 151** · 1–2 j
  **2 064** · 2–3 j **2 325** · 3–5 j **3 156** · 5–7 j **3 811** · **7 j et plus 7 237**.
  Autrement dit **57 %** du catalogue a plus de cinq jours et **31 %** plus de sept.
- **Le rythme d'entrée** dans la file : **~1 726 cartes par jour** franchissent les cinq jours
  (mesuré sur les six derniers jours : 1 517 à 2 325).
- **⚠ Ce point corrige la ligne 1.5.** Sous `premiereVue`, le compteur **ne recule jamais** :
  une carte franchit les cinq jours **une seule fois**. La file n'est donc pas un cycle qui se
  vide — c'est un **ensemble de surveillance qui grossit** tant que l'affichage n'est pas
  borné : tant qu'une carte reste affichée, elle reste à contrôler.
  - Demande du 14/10 (« une fois par jour ») : **13 227 pages/jour** aujourd'hui, et cela monte
    chaque jour — soit **+167 %** du trafic de la collecte (**1,67 fois la collecte entière**),
    au lieu de **+25 %** pour 2 000 pages.
  - Budget fixe de 2 000/jour : chaque carte est revue **toutes les ~6,6 jours**. L'ordre de
    grandeur de 1.5 tient, mais **pour une autre raison que celle qui y est écrite**, et il
    **se dégradera** à mesure que le stock grandit.
  - Pour tenir un contrôle **hebdomadaire** à la taille d'aujourd'hui : **1 890 pages/jour**.
    C'est presque exactement le budget de 2 000. **Le budget n'est donc pas trop petit : c'est
    l'affichage qui n'est pas borné.** La ligne 1.21 n'est pas une précaution, c'est la
    condition de la règle.

**1.25.a** **Troisième chiffre faux, corrigé dans la foulée — et il venait de moi.** Les
lignes 1.4 et 1.23 annonçaient **+12 %** de trafic pour 2 000 pages, sur la base d'un trafic
de collecte estimé à « ~10 900 requêtes et ~1,6 Go par jour ». Mesuré dans `data/trafic.json`
(94 passages, 24 h) : **7 928 requêtes et 1,46 Go**. Le budget de 2 000 pages est donc
**+25 %** des requêtes (et +8 % du volume), et le contrôle quotidien **+167 %** — pas +110 %.
L'estimation était fausse d'un facteur 2. Le budget de 2 000 pages reste tenable ; c'est le
quotidien qui ne l'est pas.

**1.26** **1.5 reste à corriger par B**, et 1.13 lui donne sa vraie base. Proposition, à
trancher : la file des cinq jours se vide **une fois** (13 227 cartes, ~7 jours à
2 000/jour) ; ensuite, chaque carte affichée est revue **au rythme que le budget permet** —
aujourd'hui ~une fois par semaine — et ce rythme **se dégrade avec le stock** tant que
l'affichage n'est pas borné par pays et par rubrique.

**1.27** **La politesse envers les sources — ARRÊTÉE LE 14/10/2026.** B a demandé la décision
« la plus correcte au niveau politesse envers les sources ». Elle se mesure, elle ne
s'apprécie pas.

**1.27.a — La décision : le budget fixe de 2 000 pages/jour, pas le contrôle quotidien.**
Le quotidien demanderait **13 243 pages/jour** : **une requête toutes les 7 secondes**, 24 h
sur 24, et **une toutes les 40 secondes** sur le seul *mydealz* (2 093 pages/jour). À
2 000 pages/jour : **une toutes les 43 secondes** en moyenne, et **une toutes les 4 min 33**
sur l'hôte le plus frappé. C'est l'écart entre **un visiteur** et **un crawler** — et ces
mêmes hôtes sont **déjà** interrogés toutes les 15 minutes pour la collecte (`reposMin`).
Ajouter 167 % à cette empreinte, c'est signer nos requêtes.

**1.27.b — 2 000 n'est pas un confort, c'est le plancher.** **~1 726 cartes** franchissent
les cinq jours **chaque jour**. En dessous de ce chiffre, la file ne se vide plus, « une fois
par semaine » devient un vœu, et la règle entière devient décorative. 2 000 par jour tient la
promesse de justesse ; le quotidien la tiendrait six fois, pour rien.

**1.27.c — Les conditions qui rendent ces 2 000 acceptables. Elles sont contraignantes.**

- **réparties sur 24 h**, jamais en rafale : **83 par heure** au plus, et **une seule requête
  en vol par hôte** ;
- **`robots.txt` lu par chemin**, pas par hôte. Un chemin interdit **n'est pas appelé** : la
  carte reste dans la file, sans verdict, et **rien n'est supprimé sur un refus**. Le
  mécanisme existe déjà (`robotsInterdit`, cache d'un jour, `data/robots.json`, 51 hôtes lus) ;
- **requêtes conditionnelles** (`ETag`, `Last-Modified` — déjà en place) : une page vivante
  répond souvent **304 sans corps** et ne coûte presque rien à la source ;
- **403 ou 429 = on s'arrête** pour cet hôte, pour la journée, sans réessai. C'est déjà la
  réponse de bol.com, Darty et Currys. **On n'insiste jamais** ; les cartes concernées
  restent dans la file ;
- **plafond par hôte** : environ **350 pages/jour** — ce que la répartition donne déjà au
  plus frappé.

**1.27.d — Une piste écartée, après vérification.** « La source me sert encore l'offre, donc
je n'ai pas besoin d'appeler sa page » était la piste la plus élégante : zéro requête. Elle
ne vaut que **392 cartes sur 13 276 — 3,0 %**. Le reste a quitté la fenêtre de sa source
depuis plus de cinq jours. Vérifié avant de s'y fier, puis abandonné comme argument.

---

## Reprise de tous les points — 14/10/2026, après l'adaptation

Ce que le nouveau compteur (1.13, arrêté par B) et la surveillance décidée (1.21) changent,
ligne par ligne. **Trois lignes étaient touchées mécaniquement ; les autres tiennent.**

- **1.1 et 1.2 tiennent** — mais la « période de confiance » ne vaut que pour les cartes
  neuves. Au premier jour, **13 243 cartes (56,9 %)** entrent d'un coup dans la file : le
  stock déjà en ligne n'a jamais eu ses cinq jours de confiance, il les a dépassés.
- **1.3 et 1.6 corrigées** — la priorité par clics n'est pas constructible aujourd'hui
  (les clics arrivent dans ta feuille, la collecte ne les relit pas). La `temperature` l'est :
  **15 757 cartes, 67,7 %**.
- **1.4 tient** — 2 000 pages/jour = **+25 %** des requêtes, +8 % du volume.
- **1.5 tient dans son chiffre, corrigée dans sa raison** — 13 243 cartes, et le compteur ne
  recule jamais. Plan réel de la file : 5–6 j **2 172** · 6–7 j **2 560** · 7–8 j **2 712** ·
  8–10 j **5 733** · 10 j et plus **66**. Le plus vieux d'abord : la file se vide en sept
  jours à 2 000 par jour.
- **1.7 à 1.12 tiennent**, sous une réserve déjà écrite : **le verdict de la page décide, le
  silence ne décide rien** (48 % de faux positifs mesurés).
- **1.9 réécrite** — « repart pour cinq jours » est impossible : `premiereVue` ne recule pas.
  Une carte confirmée vivante est confirmée **jusqu'à son prochain tour**.
- **1.13 arrêtée par B.**
- **1.14 et 1.15 tiennent** — le verdict écrit, et le prix seulement s'il désigne le bon
  produit.
- **1.16 et 1.17 à jour** — **7 680 masquées (136,7 Mo), toutes dans la file** ; **5 563
  affichées de plus de cinq jours jamais contrôlées**. Le démasquage doit **suivre** le
  contrôle, jamais le précéder.
- **1.18 tient** — la veille garde sa date de publication, elle ne se juge pas au service.
- **1.19 et 1.20 inchangées** — ce qui est branché, ce qui reste à construire.
- **1.21 tranchée par B** — l'affichage n'est pas borné, le point est surveillé.
- **1.22 et 1.23 inchangées** — ta demande, mot pour mot, et les deux écarts que tu tranches.
- **1.24 à 1.26** — le correctif du compteur et ses chiffres.

**La priorité est tranchée** (1.3 : `temperature`, arrêtée par B le 14/10/2026 — les clics
viendront au rang 1 le jour où la lecture de ta feuille sera branchée).

**Arrêté le 14/10/2026** : 1.3 (`temperature`), 1.13 (`premiereVue`), 1.17 (démasquage carte
par carte), 1.21 (l'affichage n'est pas borné, le point est surveillé).

**Le rythme est tranché (1.27)** : une fois par semaine, au nom de la politesse envers les
sources — 2 000 pages par jour, une requête toutes les 43 secondes en moyenne.

**Le prix est tranché (1.10) : « seulement quand la lecture est certaine »** — cinq
conditions, et l'écart non certain est enregistré sans être appliqué.

**La règle 1 n'a plus aucun point ouvert.** Arrêté par B le 14/10/2026 : 1.3 (`temperature`),
1.10 (prix corrigé seulement si la lecture est certaine), 1.13 (`premiereVue`), 1.17
(démasquage carte par carte), 1.21 (affichage non borné, surveillé), 1.27 (le rythme, au nom
de la politesse). **Elle n'est pas pour autant APPLIQUÉE** : ce qui reste, c'est la
construction — la file, le budget, le rythme quotidien (voir 1.20).

---

## Les règles suivantes, à écrire

Neuf sujets recensés dans le code le 14/10/2026. La règle 1 les recoupe ; ceux-ci restent à
écrire une par une, quand B le décidera.

**Ce qui fait sortir une carte** — 2. la page décide de la carte · 3. le retrait sur verdict

**Les délais** — 4. le retour d'une offre · 5. la veille · 6. la presse · 7. la source
disparue · 8. le verdict revérifié

**Les cas douteux** — 9. en cas de doute, on retire
