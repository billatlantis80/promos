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
Tout ce qui suit est à corriger.

### L'énoncé

**1.1** Une offre **s'affiche pendant cinq jours** sans contrôle. Sa source vient de la
servir : c'est la période de confiance.

**1.2** **Au-delà de cinq jours**, la carte entre dans une **file de vérification**. Elle
**reste affichée** pendant qu'elle attend son tour.

**1.3** La file est traitée **par ordre de priorité**, jamais par ordre d'arrivée :
d'abord les cartes sur lesquelles on a **cliqué**, puis les plus **en vue**, puis les plus
**anciennes**.

**1.4** Le **budget de vérification est fixe** : **2 000 pages par jour**, soit environ
200 Mo, c'est-à-dire **+12 %** du trafic de la collecte (mesuré à ~10 900 requêtes et
~1,6 Go par jour). Le budget ne dépend pas de la taille du stock — sinon la dette grossit
sans fin.

**1.5** À ce rythme, la file des **11 967 cartes** de plus de cinq jours se vide en
**six jours** : chaque carte ancienne est donc revérifiée environ **une fois par semaine**,
et une carte morte disparaît en moins d'une semaine.

**1.6** Une carte **prioritaire** — cliquée — passe **dans les vingt-quatre heures**.

### Le verdict, et il n'y a que cinq issues

**1.7** **La page est morte** (404 ou 410) → la **carte et son image sont supprimées**.

**1.8** **La page se déclare expirée** (`isExpired: true`) → la **carte et son image sont
supprimées**.

**1.9** **La page est vivante, le prix est le même** → la carte **repart pour cinq jours**.

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

**1.16** Aujourd'hui, à sept jours, la carte est **masquée sans être vérifiée** :
**7 547 fiches** sont dans ce cas, dont les visuels pèsent 132 Mo.

**1.17** Demain, **on ne cache plus : on va voir.** Une carte ne sort que si sa page le dit.
Donc l'affichage augmente — presque tout est montré — et **le tri se fait sur la preuve**,
plus sur une échéance.

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

**1.21** **À trancher avant** : la taille de ce qu'on affiche. Tant que le stock entier
reste affiché, la file ne se videra jamais et il faudra choisir entre discrétion et qualité.
Borner l'affichage par pays et par rubrique — comme les 160 articles que la veille applique
déjà — est ce qui rend la vérification quotidienne possible à coût constant.

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
  semaine**, parce que le quotidien coûte +110 % de trafic au lieu de +12 %, et que le
  blocage par les sources (403, 429) est déjà une réalité mesurée ;
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
    chaque jour — soit **+110 %** du trafic de la collecte, au lieu de +12 %.
  - Budget fixe de 2 000/jour : chaque carte est revue **toutes les ~6,6 jours**. L'ordre de
    grandeur de 1.5 tient, mais **pour une autre raison que celle qui y est écrite**, et il
    **se dégradera** à mesure que le stock grandit.
  - Pour tenir un contrôle **hebdomadaire** à la taille d'aujourd'hui : **1 890 pages/jour**.
    C'est presque exactement le budget de 2 000. **Le budget n'est donc pas trop petit : c'est
    l'affichage qui n'est pas borné.** La ligne 1.21 n'est pas une précaution, c'est la
    condition de la règle.

**1.26** **1.5 reste à corriger par B**, et 1.13 lui donne sa vraie base. Proposition, à
trancher : la file des cinq jours se vide **une fois** (13 227 cartes, ~7 jours à
2 000/jour) ; ensuite, chaque carte affichée est revue **au rythme que le budget permet** —
aujourd'hui ~une fois par semaine — et ce rythme **se dégrade avec le stock** tant que
l'affichage n'est pas borné par pays et par rubrique.

---

## Les règles suivantes, à écrire

Neuf sujets recensés dans le code le 14/10/2026. La règle 1 les recoupe ; ceux-ci restent à
écrire une par une, quand B le décidera.

**Ce qui fait sortir une carte** — 2. la page décide de la carte · 3. le retrait sur verdict

**Les délais** — 4. le retour d'une offre · 5. la veille · 6. la presse · 7. la source
disparue · 8. le verdict revérifié

**Les cas douteux** — 9. en cas de doute, on retire
