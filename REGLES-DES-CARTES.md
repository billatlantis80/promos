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

**État : à l'état de projet.** Rien n'est appliqué, ni la durée, ni la file, ni le budget.
Tout ce qui suit est à corriger — **sauf la ligne 1.13, arrêtée par B le 14/10/2026** (elle
n'est pas appliquée pour autant : une ligne arrêtée dans une règle incomplète ne branche rien).

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

**1.10** **La page est vivante, le prix a changé** *et* le nouveau prix est **lu avec
certitude** → le **prix et la remise sont corrigés**.

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

> **⚠ L'ORDRE COMPTE, ET C'EST UNE CONSÉQUENCE DU 14/10.** Démasquer les **7 680** cartes
> d'un seul coup remettrait en vitrine des cartes **non vérifiées**, alors que la file n'en
> contrôle que **2 000 par jour** : on montrerait avant d'avoir vu. Le démasquage doit donc
> **suivre** le contrôle, carte par carte — une carte confirmée vivante se réaffiche, une
> carte morte disparaît. **« On va voir » d'abord, « on montre » ensuite.** Cette ligne
> reste à corriger par B dans ce sens.

**1.18** Ce qui n'est **pas** touché par cette règle : les **articles de veille**, qui
gardent leur propre délai (1 215 articles, tous dans les sept jours aujourd'hui — la règle
tient parfaitement).

### Ce qui existe déjà, et ce qui manque

**1.19** **Déjà branché** : la lecture du verdict de la page · le retrait sur verdict
(allumé le 13/10) · la correction du prix et de la remise par la page (allumée pour les
enseignes) · la priorité par date.

**1.20** **À construire** : le seuil à cinq jours · la file de vérification avec sa
priorité · le budget quotidien · la lecture au rythme quotidien au lieu de trois pages par
passage.

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

- **le rythme** : B a demandé « une fois par jour ». La règle propose **une fois par
  semaine**, parce que le quotidien demande **13 227 pages** — soit **+167 %** du trafic de
  collecte, **1,67 fois la collecte entière** — au lieu de +25 %, et que le blocage par les
  sources (403, 429) est déjà une réalité mesurée ;
- **le prix** : B a demandé d'adapter le prix. La règle ne l'adapte **que si la lecture est
  certaine** — la lecture d'un prix marchand n'est fiable qu'une fois sur trois.

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

**Il ne reste qu'un point ouvert, et un seul** : l'**ordre du démasquage** (1.17) — faire
**suivre** le contrôle carte par carte, ou tout réafficher d'un coup.

---

## Les règles suivantes, à écrire

Neuf sujets recensés dans le code le 14/10/2026. La règle 1 les recoupe ; ceux-ci restent à
écrire une par une, quand B le décidera.

**Ce qui fait sortir une carte** — 2. la page décide de la carte · 3. le retrait sur verdict

**Les délais** — 4. le retour d'une offre · 5. la veille · 6. la presse · 7. la source
disparue · 8. le verdict revérifié

**Les cas douteux** — 9. en cas de doute, on retire
