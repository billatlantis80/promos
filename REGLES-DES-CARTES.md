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

**1.13** Le signal de l'ancienneté est **`vuLe`** — la dernière fois qu'une source a
**servi** l'offre — et **jamais `date`**. La date d'une offre marchande est réécrite à
chaque passage : elle ne dit pas depuis quand l'offre est en base.

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

---

## Les règles suivantes, à écrire

Neuf sujets recensés dans le code le 14/10/2026. La règle 1 les recoupe ; ceux-ci restent à
écrire une par une, quand B le décidera.

**Ce qui fait sortir une carte** — 2. la page décide de la carte · 3. le retrait sur verdict

**Les délais** — 4. le retour d'une offre · 5. la veille · 6. la presse · 7. la source
disparue · 8. le verdict revérifié

**Les cas douteux** — 9. en cas de doute, on retire
