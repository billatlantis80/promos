# Les règles des cartes

**Réécriture entreprise le 14 octobre 2026, à la demande de B** : *« je souhaiterais écrire
à nouveau toutes les règles, une par une »*. L'écrit précédent a été effacé (il reste dans
le commit `c5d7847d`).

---

## LA RÈGLE — version à confirmer, puis à appliquer

**Rédigée le 14/10/2026 au soir pour confirmation par B, puis application.**
**État : à confirmer. RIEN N'EST APPLIQUÉ.** Tout ce qui suit cette section (la « Règle 1 »,
lignes 1.1 à 1.33) est **ABROGÉ** : conservé comme trace des décisions, plus appliqué.

### Ce qui compte, et rien d'autre

**R.1 — Une carte s'affiche cinq jours.** Le compteur est **`premiereVue`** : l'horodatage de sa
**première parution chez nous**. Pour les fiches qui n'en ont pas — **2 544**, des ventes flash
entrées avant que ce repère existe — le compteur est **`vuLe`**. Le seuil se lit à la seconde :
**cinq jours, plus une seconde**, suffisent à franchir.

**R.2 — La seule question posée à chaque passage (toutes les quinze minutes) : la source
sert-elle encore cette offre ?** « Servir » veut dire : **l'offre est présente dans le flux de
sa source à ce passage**. Rien d'autre n'est lu. **Aucune page n'est ouverte, aucune requête
n'est ajoutée à la collecte.** *(C'est le mot qui avait deux sens : « promotion toujours
active » se juge **par le flux**, pas par la page. C'est cette définition que B confirme ou
corrige.)*

### Les deux seules situations

**R.3 — La source sert encore l'offre.**
- âge d'affichage **≤ cinq jours** → la carte continue, exactement comme aujourd'hui ;
- âge d'affichage **> cinq jours** → **son compteur repart** : elle est traitée comme une
  **carte neuve**, cinq jours pleins. Son âge **affiché** reste **celui que la source publie**
  (sa date de naissance) : le lecteur voit la vraie ancienneté de l'annonce ;
- la carte **n'est pas dans le stock** (effacée plus tôt, ou jamais vue) → elle **rentre**,
  comme une carte neuve.

**R.4 — La source ne sert plus l'offre.**
- âge d'affichage **≤ cinq jours** → la carte **reste affichée**. C'est la protection : cinq
  jours de vie garantis à **toute** carte, servie ou non ;
- âge d'affichage **> cinq jours** → la carte est **effacée définitivement**, en une seule
  opération.

### Ce que « effacée » veut dire, exactement

**R.5 — Effacé :** la fiche quitte le **stock** *et* le **catalogue publié** · son **visuel est
supprimé du dépôt** · ses marques tombent (`verdict`, `analyse`, `perimee`, `dateRelevee`,
`serviceAuTour`).

**R.6 — Conservé, et c'est la seule chose : l'historique des prix**
(`data/historique-prix.json`, 3,4 Mo). Décision de B du 14/10/2026 : il ne pèse rien et c'est
lui qui construit l'`analyse` et le badge « bon plan · est plus bas ». Une carte qui revient est
**neuve à l'écran**, pas **amnésique sur le fond**.

**R.7 — Aucune autre trace.** Pas de liste d'exclusion, pas de registre des premières vues, pas
de compteur de retours en production. **Une offre effacée ne laisse rien qui dise qu'elle a
existé.** Si elle revient, on apprend son existence à ce moment-là.

### Ce qui n'est pas touché

**R.8 — La veille de presse.** Les articles se jugent sur leur **date de publication**, pas sur
un service : leur règle fonctionne, elle reste la leur.

**R.9 — La collecte et les sources.** Le rythme de quinze minutes, les délais de repos par
source (`reposMin`), la lecture de `robots.txt` **par chemin**, les requêtes conditionnelles :
**rien ne change**. Cette règle **n'ajoute aucune requête** — c'est sa qualité principale.

### Ce que la règle remplace

**R.10 — Deviennent sans objet, et sont éteints à l'application :**

- **`OFFRES_SORTENT_SUR_VERDICT_ACTIF`** — la page ne décide plus d'une sortie ;
- **`PROMOTION_DECIDE_LA_CARTE_ACTIF`** — « plus de promotion » ne décide plus d'une sortie ;
- **le masquage** (`perimee`) — on ne cache plus par défaut : **soit une carte est affichée,
  soit elle est effacée**, il n'y a plus de troisième état ;
- **`PLAFOND_OFFRES_ACTIF`** (déjà éteint : retrait à sept jours sur `vuLe`) — remplacé :
  l'échéance est à **cinq jours, sur `premiereVue`** ;
- **tout le contrôle de page** : le budget de 2 000 pages/jour, ses conditions de politesse
  (1.27), la table des verdicts, la correction des prix par page (1.10) et la règle de la page
  muette (48 % de faux positifs). **Ils n'ont plus rien à décider, puisque la suppression ne se
  décide plus sur une preuve.**

**R.11 — Ce qu'on ajoute, et c'est tout :** la constante **`VIE_AFFICHEE_JOURS = 5`** · le
**seuil sur `premiereVue`** (avec `vuLe` en repli) · la **remise à zéro du compteur** d'une
carte servie au-delà de cinq jours · l'**effacement** (fiche + visuel + marques).

### Avant d'appliquer — quatre choses, dans cet ordre

**R.12 — Éprouver, jamais supposer.** Une épreuve qui refuse : une carte de cinq jours **servie**
(doit continuer) · une carte de **cinq jours + une seconde, non servie** (doit être effacée) ·
une carte **reservie au-delà de cinq jours** (compteur remis à zéro) · une carte de **quatre
jours non servie** (doit rester affichée) · un **article de veille** (jamais touché, quel que
soit son âge) · l'**historique des prix** (jamais effacé).

**R.13 — Mesurer avant, mesurer après.** Avant (relevé du 14/10/2026) : **13 415 cartes**
sortiraient · **348,8 Mo** de visuels libérés · l'affichage passe de **15 484 à ~10 600 cartes
(−31 %)**. Après : les mêmes chiffres, relevés, écrits.

**R.14 — Le taux de retour de la simulation** (job `d000ebf69467`, une ligne le soir,
`data/simulation-5-jours.jsonl`). B a dit qu'on ne décidait pas sans lui. Premier relevé à
trente minutes : **13 415 effacements, 1 retour**, et le retour est le bon — `coolblue.be`,
8,15 jours, revenue six minutes plus tard.

**R.15 — Dire ce qu'on perd, une fois pour toutes.** Mesuré le 12/10/2026 sur 140 pages :
**47,7 %** des cartes qu'une échéance de service emporte étaient **encore vivantes** à leur
source. La règle assume ce prix : **« on n'affiche que ce qu'une source sert encore »** — la
fraîcheur contre le volume, et le volume contre l'erreur.

### Le retour en arrière

**R.16 — Réversible, et identifiable.** Le bundle
`promos-historique-avant-C-2026-10-14.bundle` (2,97 Go, 2 701 commits) porte l'état d'avant.
L'application de cette règle fera **un commit seul**, pour pouvoir être défaite seule.

---

### Points à lever avant confirmation — analyse du 14/10/2026 au soir

B a reformulé sa commande et demande **ce qu'il n'a pas pris en compte**. Trois choses, dont
une qui contredit une autre de ses consignes. Tout est mesuré.

**1. ⚠ « Ne plus rien garder » et « garder la date d'édition » ne peuvent pas être vrais
ensemble.** B, mot pour mot : *« elle doit être supprimée définitivement et ne plus rien garder
dans notre stockage »* **et** *« le seul élément visuel qui doit rester, c'est la date d'édition
de la carte, qui correspond à la première fois où elle est apparue sur kazendra »*.

Si la carte est effacée **sans aucune trace**, **rien ne peut dire** quand elle est apparue la
première fois : l'information n'existe plus nulle part. Pour que la date d'édition survive, il
faut donc **un registre minimal — `clé → date d'édition`** — et il faut l'assumer :

- **ce qu'il pèse** : environ **40 octets par offre** (clé hachée en 12 caractères + date), soit
  **~1 Mo aujourd'hui** pour 23 500 offres, contre 2,1 Mo si l'on garde la clé entière ;
- **mais il croît sans fin** : **1 726 offres nouvelles par jour**, que rien ne vient effacer —
  c'est le principe même du registre. Sans borne : **+25 Mo par an** ;
- **donc il lui faut un horizon.** Passé **90 jours** sans revoir une offre, on oublie sa date ;
  une offre qui reviendrait après 90 jours serait traitée comme neuve. À 90 jours :
  **~155 000 lignes, ~6 Mo**. C'est le prix exact de la date d'édition.

**À trancher :** garde-t-on la date d'édition (registre minimal, ~1 Mo aujourd'hui, ~6 Mo avec
un horizon de 90 jours) — ou accepte-t-on que l'âge d'une carte repartie de zéro, sans aucun
registre ?

**2. « Vérifiée à la prochaine mise à jour » n'est vrai que pour une partie des sources.**
B écrit : *« à 5 jours et une seconde, la carte est mise en pause et elle est vérifiée à la
prochaine mise à jour »*. Mesuré au dernier passage : **108 sources sur 229 étaient au repos**
(`reposMin`, délai de politesse non écoulé) et **96 n'avaient pas été lues depuis plus de 24 h**.
Pour une carte dont la source dort, « la prochaine mise à jour » **n'existe pas** : la carte
resterait **en pause** — invisible **et** non effacée — des heures, voire indéfiniment.

**Donc la règle doit dire :** la carte reste en pause **jusqu'à ce que SA source soit relue**,
et si cette source n'a pas été relue depuis N jours (les 7 jours de `LIMITE_SOURCE_DISPARUE_JOURS`
existent déjà), la carte est effacée **faute de réponse**. Sans cette borne, les cartes en pause
s'accumulent en silence — invisibles et impérissables.

**3. « Mise en pause » et « reste affichée » ne sont pas la même chose.** La ligne 1.4 (abrogée)
disait : la carte attend son tour **en restant affichée**. La formulation de B dit : **mise en
pause**. Si la pause cache la carte, alors chaque carte perd un peu de vie visible à partir du
5e jour — y compris celles qui seront confirmées. À trancher aussi.

**4. ✓ Et une bonne nouvelle, vérifiée : l'historique des prix SE RACCROCHE.** L'identifiant
d'une offre est `préfixe + sha1(lien)` (collecteur.mjs, l. 122) — **dérivé de l'URL, donc
stable** : il survit à l'effacement, et une carte republiée retrouve **exactement** ses prix
passés. La décision de B (1.32) est donc réalisable telle quelle, sans rien ajouter.

**5. Et le premier passage sera spectaculaire** : **13 415 cartes** basculent d'un coup, dont
~**10 600** aujourd'hui affichées. C'est un changement visible du jour au lendemain, pas une
pente.

---

### MA RECOMMANDATION — la meilleure solution pour ton scénario, point par point

Demandée par B : *« Quelle est la meilleure solution d'après toi en fonction du scénario que je
souhaite ? »* Elle tient le scénario de B **entier**, et elle supprime la contradiction **sans
ajouter de mémoire**. Tout est mesuré.

**1. La vie d'une carte : cinq jours garantis.** Bloquée à cinq jours et une seconde. C'est la
seule décision qui ne puisse pas se tromper : une date ne juge pas.

**2. Le compteur : `premiereVue`**, avec `vuLe` en repli pour les 2 544 ventes flash entrées
avant que ce repère existe.

**3. La date d'édition : celle que LA SOURCE publie. Donc AUCUN registre.** Mesuré sur les
**15 915** cartes dont la source publie une date : l'écart entre cette date et notre première
vue est de **13 minutes en médiane**, **97,8 % sous l'heure**, **99,9 % sous 24 h**. C'est donc
**le même instant** — et il est **redonné à chaque service**. La carte garde son **vrai âge**
**sans que nous gardions rien**. La contradiction de B (« ne rien garder » *et* « garder la date
d'édition ») **disparaît sans registre**.

**4. Le trou, mesuré et assumé : quatre familles ne publient aucune date** — `flash` (Amazon),
`socialdeal`, `amazon`, `groupon` : **2 101** cartes retirées, dont **304 des 400** qui
reviennent. Pour elles, la date d'édition repart. Coût : **~300 cartes sur 15 000 (2 %)**, et
pour l'essentiel des **ventes flash** — où « neuf » est **factuellement juste** : une vente du
jour qui revient **est** une nouvelle vente. Fermer ce trou coûterait un registre limité à ces
quatre familles : **0,08 Mo aujourd'hui, 1,9 Mo** avec un horizon de 90 jours. **Je ne le
recommande pas** — le gain ne vaut pas la mémoire à tenir.

**5. La vérification : le flux de la source, à SA prochaine lecture.** Pas « dans quinze
minutes » : **108 sources sur 229 dorment** à chaque passage, **96** n'ont pas été lues depuis
24 h. Donc la carte reste en pause **jusqu'à ce que sa source soit relue** — et si sa source n'a
plus parlé depuis **7 jours**, la carte est effacée **faute de réponse**
(`LIMITE_SOURCE_DISPARUE_JOURS` existe déjà). Sans cette borne, des cartes resteraient en pause
**pour toujours**.

**6. La pause : la carte RESTE AFFICHÉE.** Elle vient de vivre cinq jours ; la cacher quelques
minutes pour la remontrer ensuite ne sert personne et fait clignoter le catalogue. Le seul cas
où elle disparaît est celui où elle doit disparaître.

**7. Effacé :** la fiche (stock **et** catalogue publié), le visuel, les marques (`verdict`,
`analyse`, `perimee`, `dateRelevee`, `serviceAuTour`). **Conservé, et c'est tout : l'historique
des prix.**

**8. Et il se raccroche tout seul** — vérifié : l'identifiant est `préfixe + sha1(lien)`,
dérivé de l'URL, donc **stable à travers l'effacement**. Une carte republiée retrouve
**exactement** ses prix passés, et son `analyse` (prix bas, prix habituel, « est plus bas ») se
**recalcule** depuis cet historique. **Le badge « bon plan » se rétablit dès le retour**, sans
que nous gardions la fiche.

**9. Aucune autre trace** : pas de liste d'exclusion, pas de registre, pas de compteur de
retours en production.

**10. Aucun coût de politesse — un gain, même :** la règle **n'ajoute aucune requête**, et elle
**supprime** le besoin du budget de 2 000 pages/jour et de tout le contrôle de page, qui n'ont
plus rien à décider.

**11. Ce qui s'éteint :** `OFFRES_SORTENT_SUR_VERDICT_ACTIF` · `PROMOTION_DECIDE_LA_CARTE_ACTIF`
· le masquage (`perimee`) · `PLAFOND_OFFRES_ACTIF` · tout le contrôle de page.

**12. L'effet du premier jour, à annoncer avant :** **13 415 cartes** basculent d'un coup,
~**10 600** restent affichées (**−31 %**), **348,8 Mo** s'en vont.

**13. Ce qu'on perd, dit une fois pour toutes :** **47,7 %** des cartes qu'une échéance de
service emporte étaient **encore vivantes** à leur source. Le principe assumé : **« on
n'affiche que ce qu'une source sert encore. »**

**14. Avant d'allumer :** l'épreuve (six cas refusés, R.12) · la mesure avant/après (R.13) ·
le taux de retour de la simulation (R.14) · et **un commit seul**, pour pouvoir être défait
seul (R.16).

---

### EFFICACITÉ POUR TOUS LES ACTEURS — mesurée le 14/10/2026

B l'a posée comme condition : *« Elle doit être la plus efficace pour tous les acteurs. »*
Quatre acteurs, et deux endroits où la règle **seule** ne suffit pas.

**ACTEUR 1 — LE VISITEUR. Le plus gros gain n'est pas dans la règle.**

- **Aujourd'hui, le visiteur télécharge tout le catalogue à chaque visite** :
  `offres.json` pèse **21 820 294 octets** servis, et le chargement se fait en
  `cache: 'no-store'` (`public/app.js`, l. 2839) — ce qui **annule** le cache que GitHub Pages
  envoie pourtant déjà : `cache-control: max-age=600` **et** un `ETag`.
  *Mesuré en direct sur `kazendra.com/offres.json`, 14/10/2026.*
- **La règle seule** fait passer ces 21,8 Mo à **~10 Mo** (−54 %) : bien, mais le visiteur
  paie toujours tout, à chaque visite.
- **La règle + le cache** : en laissant le navigateur utiliser son `ETag`, une visite répétée
  coûte **0 octet** dans les 10 minutes, puis une **revalidation 304** (quelques octets) —
  et un re-téléchargement **au plus une fois par passage de collecte**. On passe de
  **21,8 Mo par visite** à **21,8 Mo au pire une fois par quart d'heure, pour tous les
  visiteurs**.
- **Ce qu'il faut vérifier avant de toucher à ce `no-store`** : la raison n'est écrite **nulle
  part**. Elle a peut-être été une décision — je ne change pas un `no-store` sur une intuition.
  À chercher dans l'historique avant.
- Et deux gains que la règle apporte d'elle-même : la carte affiche **le vrai âge de l'annonce**
  (la date de la source), et **plus aucune promo morte n'est proposée au clic**.

**ACTEUR 2 — LA SOURCE (les sites de bons plans). Strictement mieux.**

- La règle **n'ajoute aucune requête** : notre empreinte reste à **7 928 requêtes et 1,46 Go
  par jour**.
- Et elle **supprime** ce qui était prévu : le budget de **2 000 pages/jour** (+25 % de
  requêtes) et toute la lecture de page. Le contrôle de politesse de 1.27 devient sans objet.
- `robots.txt` par chemin, `reposMin`, requêtes conditionnelles : **inchangés**.

**ACTEUR 3 — B, LE DÉPÔT, LE STOCKAGE. Gain réel, mais incomplet sans une reprise.**

- `docs/img` **655 Mo → ~306 Mo** ; `docs/offres.json` **21,8 Mo → ~10 Mo** ; **348,8 Mo**
  libérés. Le site publié passe sous la moitié du seuil de 1 Go de GitHub Pages.
- **⚠ MAIS `.git` NE PERD RIEN** : **720 Mo** (597 Mo de pack + 117 Mo d'objets isolés),
  **38 558 objets dans le pack**, **40 360 objets** dans l'historique. Les visuels des cartes
  effacées **restent dans le pack pour toujours** — git ne rend jamais un blob, et la fiche a
  été committée.
- **Donc la règle a besoin d'une reprise périodique**, sinon l'espace gagné est repris par
  l'historique : c'est exactement l'opération faite le 14/10 à la main (**100 secondes**,
  **2,6 Go** récupérés sur GitHub, 3,2 Go sur le NAS). **Une fois par mois** suffit.
- Gains annexes : collection plus rapide (moins de fiches à écrire), commits plus légers, site
  plus rapide — et une **marque qui ne propose plus de prix périmé**.

**ACTEUR 4 — LE MARCHAND (les programmes d'affiliation). Mieux, sans rien faire.**

- Les clics ne partent que sur des offres **qu'une source sert encore** : moins de clics
  perdus, **meilleur taux de conversion**, donc un meilleur rang dans les programmes. Coût
  pour nous : **zéro**.

**Le seul endroit où « efficace » veut dire « moins »** : le visiteur voit **−31 % de cartes**
(~10 600 contre 15 484). Mais ce sont celles qui n'étaient plus servies par personne depuis
cinq à sept jours — **moins de cartes, aucune impasse**. Le levier, si tu veux un jour
remonter ce chiffre, est la **borne d'affichage** (1.21), que tu as décidé de ne pas prendre
maintenant.

**Conclusion pour B : la règle est la plus efficace pour la source, pour le dépôt et pour le
marchand — du premier coup. Pour le visiteur, elle ne le devient vraiment qu'avec le cache.
Deux ajouts, donc, et aucun ne change la règle : (1) laisser le navigateur se servir de son
`ETag` sur le catalogue, (2) une reprise mensuelle du dépôt.**

---

### VÉRIFICATION GÉNÉRALE — 14/10/2026, 20:37 → 22:50 UTC

B a demandé de **tout revérifier avec les chiffres**. Repris à un seul instant pour que les
mesures soient comparables. **Cinq chiffres ne tenaient pas**, dont deux qui changent le
raisonnement. Tout le reste est confirmé.

**CE QUI EST CONFIRMÉ**

- **Le catalogue** : 24 774 fiches · 23 560 offres marchandes · 1 213 articles · **15 359
  affichées / 8 201 masquées** (somme exacte : 23 560).
- **La file des cinq jours : 13 500 cartes**, dont 8 201 déjà masquées et **5 299 encore
  affichées**.
- **Ce que la règle retirerait en plus : 5 299 cartes.** Leur dernier service : **4 021 (75,9 %)**
  il y a 5 à 7 jours, 721 (13,6 %) il y a 2 à 5 jours, **400 (7,5 %) dans les 24 h** — les seules
  qui reviennent.
- **L'écart entre la date de la source et notre première vue : 12 minutes en médiane, 97,8 %
  sous l'heure, 100 % sous 24 h** (2 992 cartes mesurées). La date d'édition est bien **celle
  de la source**.
- **Les 47,7 % de faux positifs** : fichier du 12/10, échantillon 140, **53 vivantes sur 111
  jugées** = 47,7 % (intervalle 38,7–57).
- **Le visiteur, en direct sur `kazendra.com/offres.json`** : `content-length: 21820294`,
  `cache-control: max-age=600`, **un `ETag`**, et le chargement en `cache: 'no-store'`
  (`public/app.js`, l. 2839) qui l'annule.
- **Le trafic de collecte** : **94 passages / 24 h**, **8 064 requêtes**, **1,45 Go**.
  2 000 pages = **24,8 %** des requêtes ; 13 500 = **167 %**.
- **Les visuels** : 22 480 fichiers, **645,7 Mo d'octets réels**.
- **L'identifiant stable** : `préfixe + sha1(lien).slice(0,20)` (l. 122-124) — le raccrochage de
  l'historique des prix est bien garanti.
- **La simulation** : à 22:50, **11 passages, 13 537 effacements, 80 retours (0,6 %)**.

**LES CINQ CORRECTIONS**

**1. ⚠ Le taux d'entrée n'est pas 1 726 par jour : il est de ~2 500.** Mesuré : **2 091** cartes
ont franchi les cinq jours dans les 24 h, **2 540** entre 24 et 48 h, **2 587** entre 48 et
72 h — la cadence **monte**. Et **2 076 nouvelles cartes arrivent par jour**. Conséquence : la
ligne 1.4 (« 2 000 pages/jour est le plancher, ~1 726 entrées/jour ») est **déjà fausse** — à
2 500 entrées, 2 000 pages ne suffisent plus et la file grandirait de ~500/jour. *(Sans effet
sur la nouvelle règle, qui n'a plus de budget — mais la ligne est à corriger.)*

**2. ⚠ La pause ne dure pas quinze minutes.** La cadence réelle des sources, mesurée sur
10 jours : **presse 47 min** · **communauté (Dealabs, MyDealz…) 54 min** · **gnews/bing 65 min**
· **amazon/enseigne 2 h 52** · **groupon/socialdeal 3 h 13** · **flash 13 h 51** (1,7 tour par
jour). Et **96 sources sur 229 n'ont JAMAIS tourné** — configurées, jamais fonctionnelles (ce
sont les `enseigne-be-*`, dont la dernière trace date du 04/10).

Donc une carte attend sa vérification **de 47 minutes à 14 heures** selon sa famille — et non
quinze minutes. **Cela confirme la recommandation 6 : la carte doit rester affichée pendant la
pause.** Si la pause cachait, une vente flash resterait invisible **près de quatorze heures**
avant d'être confirmée ou effacée.

**3. ⚠⚠ Le dépôt grossit de ~0,6 à 1 Go par jour — et cela domine tout le reste.** Mesuré objet
par objet : **un commit de collecte ajoute 163 objets, 23,4 Mo non compressés**, dont
**21,8 Mo de catalogue** et **50 images** ; soit **~7 MiB sur disque** par commit. À
**94 commits par jour** : **~660 MiB par jour**. Confirmé en direct : **+7,4 MiB en 11 minutes**.

**Conséquence, et elle renverse la conclusion d'efficacité : les 348,8 Mo que la règle libère
valent moins d'une demi-journée de croissance du dépôt.** Le gain durable n'est donc **pas les
images** : c'est **la moitié du catalogue** (21,8 Mo → ~10 Mo), donc **la moitié de la
croissance quotidienne** — plus la reprise périodique. Et le `.git` ne se tasse pas tout seul :
**1 982 objets isolés** en attente, alors que le gc automatique ne se déclenche qu'à
**6 700**.

**4. Les poids exacts** : `docs` **726,8 Mo** · `.git` **749 Mo (714 MiB)** · images **645,7 Mo**
d'octets réels · `docs/offres.json` **21,82 Mo** · `data/historique-prix.json` **3,53 Mo** ·
`data/simulation-5-jours.json` **8,49 Mo** · `data/conditionnel` **62,1 Mo**.
*(Mes annonces antérieures — docs 693 Mo, .git 699 Mo, images 655 Mo — étaient un mélange de
`du` (qui compte les blocs) et de mesures plus anciennes.)*

**5. Le trou des dates est plus large que dit** : parmi les 5 299 cartes retirées,
**2 254 (42,5 %) n'ont aucune date de source** — j'avais annoncé 30 %. Le reste, 3 045 cartes
(57,5 %), porte bien la date de la source. **Cela ne change pas la recommandation** (les
familles concernées sont les mêmes : flash, socialdeal, amazon, groupon), mais le chiffre est
plus honnête.

**CE QUI N'EST TOUJOURS PAS VÉRIFIÉ**

- **La raison du `no-store`** : introuvable dans le code. À chercher dans l'historique avant
  d'y toucher.
- **Les 47,7 %** viennent d'une population désignée par une échéance de **sept** jours, pas de
  cinq : c'est la mesure la plus proche, pas la mesure exacte.
- **Le taux de retour** n'est pas figé : 1 retour à 30 minutes, **80 à 3 h 20**. Il monte à
  mesure que les sources tournent — **et c'est précisément pourquoi la simulation continue.**

---

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

**1.28** **« Effacer à cinq jours quoi qu'il arrive » — question de B du 14/10/2026, mesurée.**
La question posée : *la récolte suivante, quinze minutes plus tard, réintroduirait-elle
l'annonce effacée, pour cinq jours neufs ?*

- **Techniquement, oui — et rien ne l'empêche.** Le retrait est `connues.delete(cle)`, et
  **aucune liste d'exclusion n'est écrite** : la règle du 12/10 le dit elle-même, « une offre
  reservie plus tard rentre comme une fiche neuve ». À la rentrée, `premiereVue` **et** `vuLe`
  sont **remis à maintenant** (collecteur.mjs, l. 7810) — donc cinq jours pleins.
- **Pratiquement, non.** Sur les **135 cartes** qui franchissent les cinq jours aujourd'hui,
  **1 seule (0,7 %)** est **encore** servie par sa source dans les 24 h ; **134 (99,3 %)** ne
  sont plus servies depuis plus de 24 h. Celles qui ont franchi le cap il y a 24 h : **3,1 %**.
  La raison est la **fenêtre** : Dealabs « Tendance » sert **30 offres par passage** pour
  **1 407** en base ; au cinquième jour d'affichage, la source a cessé d'en parler depuis
  trois ou quatre jours.
- **Mais l'exception est exactement le cas que la règle du 12/10 protégeait.** Pour les 1 à
  3 % encore servis, l'effacement est **avalé** : la carte revient **quinze minutes plus tard**,
  avec cinq jours neufs. Rien ne disparaît à l'écran — mais à chaque aller-retour son visuel
  est supprimé comme orphelin (l. 7166) puis **re-téléchargé**. C'est le cas de la
  **promotion d'un mois** (soldes) : effacée et ressuscitée tous les cinq jours, indéfiniment.
- **Donc « quoi qu'il arrive » ne donne pas « cinq jours puis disparu ».** Il donne **disparu**
  pour les 99 % dont la source s'est tue — ce que la règle des sept jours faisait déjà, deux
  jours plus tard — et un **battement de cinq jours** pour le reste. La clause n'ajoute rien
  aux 99 %, et n'ajoute le battement qu'aux autres.
- **Et l'effacement n'est jamais définitif** : une source peut **réchauffer** une offre sortie
  de sa fenêtre et la resservir des jours plus tard. Elle rentre alors **neuve, cinq jours
  pleins** (c'est le sujet « le retour d'une offre », encore à écrire).

Rien n'est perdu du passé, en revanche : `data/historique-prix.json` **survit** à
l'effacement — il est daté par jour, et **208 offres** qu'il suit ne sont déjà plus dans le
catalogue. Une carte qui revient retrouve son historique, et son `analyse` se recalcule.

**1.29** **LA SIMULATION EN SITUATION RÉELLE — construite le 14/10/2026, sur la demande de
B.** *« Faisons la simulation en situation réelle avant de prendre la décision. »*

**Ce qu'elle est** : `bin/simuler-effacement-5-jours.mjs`, relais `~/scripts/simulation-5-jours.sh`,
tâche planifiée **toutes les 15 minutes** (job `d000ebf69467`) — le rythme de la collecte,
puisque la question est : *« la mise à jour suivante, quinze minutes plus tard,
la réintroduit-elle ? »*. **Elle n'efface rien** : ni carte, ni visuel, ni catalogue. Elle
observe et compte.

**Les deux horloges, séparées comme B les a décrites** : l'**affichage** repart à chaque
retour (cinq jours neufs) ; le **total**, jamais — c'est la première parution chez nous, et
c'est ce que la carte afficherait. Le total exige une **mémoire qui survit à l'effacement**,
c'est-à-dire la « liste d'exclusion » que le code n'écrit pas aujourd'hui. La simulation tient
ce registre pour en mesurer le poids : `cleDe` est **stable** (PAYS + URL sans protocole, sans
paramètres, sans barre finale — 74 caractères en moyenne, jusqu'à 400).

**Le proxy de retour, nommé comme tel** : on ne peut pas observer un retour qu'on n'a pas
provoqué. Une carte virtuellement effacée à T revient si sa source la resert — alors `vuLe`
dépasse T. C'est exactement la mécanique de la fusion (collecteur.mjs, l. 7810).

**Les premiers chiffres, réels (14/10/2026, 19:27 → 19:35 UTC)** :

- **23 444 offres** au catalogue, **10 055 affichées** sous la règle, **13 389 effacées**
  d'un coup (tout le stock déjà au-delà de cinq jours) ;
- **1er retour réel attrapé** : `coolblue.be/fr/produit/821010/bosch-hlr390020.html`,
  source `coolblue-be-7` — **effacée à 19:27:54, revenue à 19:34:15, soit six minutes plus
  tard**, et **8,15 jours** d'âge total. C'est le cas de B mot pour mot : une carte affichée
  huit jours, effacée, réintroduite au passage suivant ;
- **registre : 5,71 Mo** pour 23 444 clés + 13 389 effacements en attente (une version de
  production, qui ne garderait que `clé → date`, tiendrait en **~2,2 Mo**) ;
- **effacements quotidiens** : ~18 par passage de 15 minutes, soit les ~1 726 par jour déjà
  mesurés (1.4) ;
- épreuve d'idempotence : un second passage immédiat ne recompte **rien**.

**⚠ ET LA CONSÉQUENCE QUI COMPTE, MESURÉE : cette règle AFFICHE MOINS, pas plus.** Sous elle,
le site montrerait **10 055 cartes** — contre **15 764 aujourd'hui** (23 444 moins les 7 680
masquées), soit **36 % de contenu en moins**. C'est l'inverse de 1.17 (« on ne cache plus, on
va voir »). Le chiffre remonte à mesure que les retours s'accumulent — c'est précisément ce
que la simulation mesure, et sa raison d'être. **La décision ne peut pas être prise avant
d'avoir ce taux.**

**1.30** **LA COMMANDE DE B, 14/10/2026 AU SOIR — « TABLE RASE ».** Mot pour mot :

> « Est-ce que tu peux effacer toutes les règles que nous avons mises en place depuis le
> début, concernant la suppression des cartes. Toutes les règles qui ont été écrites depuis
> que nous travaillons sur ce sujet. Il ne faut plus les prendre en considération et les
> effacer pour que la base de données soit vierge de toutes ces règles ? Ensuite, on bloque
> toutes les fiches de plus de 5 jours, une seconde et à la mise à jour suivante, toutes les
> 15 minutes, si la promotion est toujours active, alors elle est réintroduite avec la durée
> de vie complète depuis la première fois que la carte est apparue. Si la promotion n'est plus
> active la carte est complètement effacée du système. »

**VERDICT : l'intention est claire, la réalisation est possible — mais deux mots de cette
phrase ont chacun deux sens, et c'est eux qu'il faut lever avant de toucher à quoi que ce
soit.** Inventaire mesuré au 14/10/2026 (19:35 UTC).

**A. Ce qui a été ÉCRIT** (les documents — effaçables, l'histoire reste dans git et dans le
bundle de 2,97 Go) : `REGLES-DES-CARTES.md` (**507 lignes**) · `CHANTIERS-EN-ATTENTE.md`
(31) · `REECRITURE-HISTORIQUE-2026-10-14.md` (78) · et **14 plans** dans `.hermes/plans/`,
dont `2026-10-12-donnees-et-peremption-7-jours.md`, `2026-10-13-fiches-non-confirmees-masquees.md`,
`2026-10-13-verification-duree-de-vie-et-poids.md`, `2026-10-13-controle-de-page-a-rendement.md`.

**B. Ce qui AGIT** (les interrupteurs du code, `collecteur.mjs`) :

- `PLAFOND_OFFRES_ACTIF` — **déjà éteint** : le retrait à 7 jours sur `vuLe`.
- `OFFRES_SORTENT_SUR_VERDICT_ACTIF` — **allumé** : la page décide de la sortie.
- `PROMOTION_DECIDE_LA_CARTE_ACTIF` — **allumé** : plus de promotion → la carte sort.
- `PRIX_COMMUNAUTE_ACTIF` — **déjà éteint** : la correction des prix communautaires.
- `VEILLE_SEPT_JOURS_ACTIVE` — **allumé**, et **il ne concerne PAS les cartes** : c'est la
  veille de presse, jugée sur la **date de publication**. L'effacer casserait un fil qui
  fonctionne.
- Les délais : `PLAFOND_DONNEES_JOURS = 7`, `VERDICT_SOURCE_MAX_AGE_JOURS = 7`,
  `LIMITE_PRESSE_JOURS = 7`, `LIMITE_SOURCE_DISPARUE_JOURS = 7`, `VERDICT_SOURCE_PAR_PASSAGE = 3`.

**C. Ce qui est ÉCRIT DANS LA BASE** (les traces que les règles ont laissées) :

- **7 964 fiches** portent `perimee: true` — masquées ;
- **16 242** portent un `verdict` et une `analyse` ; **7 182** une `dateRelevee` ;
- `donnees/verdicts-sources.json` : **133 jugements** ; `donnees/peremption-source.json` :
  la mesure des 48 % de faux positifs ;
- le champ `journal` du catalogue porte **34 entrées**, dont les raisons de règle elles-mêmes
  (« dates relevées », « prix d'origine relu »…).

**D. LES DEUX MOTS À DEUX SENS.**

1. **« base de données vierge de toutes ces règles »** — trois portées possibles, et une
   seule peut être vraie : **(i)** les documents seuls (gratuit, réversible) · **(ii)** les
   interrupteurs aussi (le site cesse alors de retirer les cartes mortes, et plus aucune règle
   de sortie ne subsiste) · **(iii)** les traces dans la base aussi (il faut **démasquer
   7 964 fiches** et décider du sort des colonnes `perimee`, `verdict`, `analyse`).
2. **« si la promotion est toujours active »** — jugée **comment** ? **(i)** par le **flux de
   la source**, gratuit, et c'est ce que dit « à la mise à jour suivante toutes les quinze
   minutes » — **aucune requête supplémentaire** ; **(ii)** par **la page de la source**
   (2 000 pages/jour, donc jusqu'à sept jours d'attente). **C'est la question de fond**, parce
   qu'elle décide si tout l'appareil de 1.10 et 1.27 — la politesse, les cinq conditions de
   lecture, la table des verdicts — reste nécessaire **ou devient du poids mort**.

**E. RÉALISABLE, ET MOINS CHER QUE PRÉVU.** Les trois pièces à construire sont déjà mesurées :
le **registre des premières vues** (5,71 Mo, ~2,2 Mo en production — 1.29), le **blocage à
cinq jours** sur `premiereVue` (le mécanisme du masquage existe, il change de seuil et
d'horloge), la **réintroduction** avec l'âge total (mesurée : Coolblue, 8,15 jours, revenue
six minutes plus tard), et l'**effacement définitif** (`connues.delete` + le visuel, en place).
**Si « toujours active » se juge sur le flux, la règle ne coûte aucune requête** : elle
s'appuie sur une lecture qu'on fait déjà toutes les quinze minutes. Tout le budget de
vérification devient alors inutile **pour la suppression** — ce qui ne dit pas qu'il le
devienne pour la justesse des prix (1.10), qui est une autre question.

**F. ET CE QUE LA TABLE RASE EMPORTERAIT AVEC ELLE, à savoir avant de la faire :** la
protection du 12/10 (le compte à rebours repartait pour qu'une promotion d'un mois ne soit
jamais emportée) — que la réintroduction remplace avantageusement, mais **seulement si le
registre existe** ; et la règle de la page muette (« le silence ne décide rien », 48 % de faux
positifs) — qui devient **sans objet**, puisque l'effacement ne se décide plus sur une preuve
mais sur une **échéance**. C'est le vrai changement : **on passe d'un jugement à une date.**

**1.31** **LA DÉCISION DE B, 14/10/2026 : AUCUNE MÉMOIRE.** Mot pour mot :

> « Il faut effacer toute trace qui pèse lourd sur le système. Quand une promotion a disparu,
> plus besoin de stocker aucune information. Si la promotion réapparaît un autre jour ou pour
> un autre cycle, on récupère tout simplement l'information et on le traite comme si c'était
> la première fois qu'il rentrait dans le fil. »

**MON AVIS, ET IL EST FAVORABLE — mais pas pour la raison qu'on croit.** B a raison, et les
chiffres le disent plus fort que l'intuition : **la trace qui pèse n'est pas la mémoire, c'est
l'image.**

**a. Les poids, mesurés (14/10/2026, 21:45 belge).** `docs/` **693 Mo** · `.git` **699 Mo** ·
`docs/img` **655 Mo** (22 377 fichiers, 28,8 Ko en moyenne) · `docs/offres.json` **21 Mo**,
réécrit et commité 96 fois par jour · `data/conditionnel` **60 Mo** (le cache HTTP poli, qui ne
concerne pas les cartes) · `data/historique-prix.json` **3,4 Mo** · le registre de la
simulation **8,1 Mo**.

**Ce que l'effacement libère : 348,8 Mo de visuels** — les images des cartes de plus de cinq
jours. **Ce qu'un registre des premières vues coûterait : 2,2 Mo**, soit **0,6 %** de ce que
l'effacement libère. Donc « ne rien garder » ne fait pas gagner de poids : cela fait gagner de
la **propreté**. C'est une raison suffisante — mais ce n'est pas celle du poids.

**b. Et l'âge total n'a PAS besoin de notre mémoire : c'est la source qui se souvient.** Sur
les **13 427** cartes qui seraient effacées : **8 806 (65,6 %)** portent une **date publiée par
la source**, et cette date est **redonnée à chaque passage** où la source resert l'offre. Sa
position moyenne : **moins de 24 h de notre première vue** — c'est donc bien la date de
naissance de l'annonce. Une carte qui revient peut alors dire « 12 jours » **sans que nous
gardions quoi que ce soit**. C'est exactement le « on récupère tout simplement l'information »
de B : **l'information, c'est la source qui la redonne, pas nous qui la stockons.**

**c. Le trou, et il est petit, nommé, et fermé par les faits : 4 025 cartes (30,0 %)** sont des
pages qui ne publient aucune date (`dateRelevee`) — les **ventes flash Amazon des 9 pays**.
Pour elles, un retour remettrait l'âge à zéro. Mais ce sont précisément les offres dont **la
fenêtre se renouvelle entièrement** : mesuré plus haut, **1 605 des 2 179** cartes en repli
sont des ventes flash, et elles **ne reviennent pas** — leur fenêtre tourne d'un bloc. **La
perte est donc théorique : ces cartes ne repasseront pas.**

**d. Un effet de bord gratuit.** Le visuel d'une carte effacée est **déjà** purgé comme
orphelin (collecteur.mjs, l. 7166) : effacer la carte suffit à faire disparaître l'image. Rien
de plus à coder pour libérer les 348,8 Mo.

**e. Ce qui reste à trancher, et ce n'est plus le poids mais la qualité : l'historique des
prix** (`data/historique-prix.json`, **3,4 Mo**). Il survit aujourd'hui à un effacement, et
c'est lui qui construit l'`analyse` — prix bas, prix habituel, « est plus bas ». Si « aucune
trace » vaut aussi pour lui, une carte qui revient **repart sans passé** : son badge « bon
plan » serait faible pendant sept jours. C'est cohérent avec « traité comme une première
fois » — mais c'est un **choix**, pas une conséquence.

**f. Et l'instrument de mesure est l'exception, temporairement.** La simulation (1.29) a besoin
d'un registre pour compter les retours — elle en tient un, **8,1 Mo**, dans `data/` que git
ignore. **Il disparaît avec la décision.**

**1.32** **DÉCISION DE B, 14/10/2026 : L'HISTORIQUE DES PRIX EST CONSERVÉ.** Mot pour mot :
*« Ok on peut garder l'historique des prix. »* C'était le dernier point ouvert du dessin.

- **Ce qu'il est** : `data/historique-prix.json`, **3,4 Mo**, daté par jour, **8 jours** de
  profondeur. C'est lui qui construit l'`analyse` d'une carte — `prixBas`, `prixHabituel`,
  `prixHaut`, `estPlusBas` — donc le badge « bon plan ».
- **Pourquoi il échappe à la règle du « rien »** : il ne pèse pas (0,5 % des visuels), et
  l'effacer ferait repartir une carte revenue **sans passé**, avec un badge faible pendant sept
  jours. Le garder coûte 3,4 Mo ; l'effacer coûte la qualité du seul signal qui dit si une
  remise est réelle.
- **Ce qui suit de cette décision** : une carte effacée laisse **une seule** trace possible —
  ses prix passés. Ni fiche, ni visuel, ni verdict, ni analyse, ni marque d'expiration.
- **Et c'est cohérent avec « traitée comme une première fois »** : elle *paraît* neuve (cinq
  jours pleins, âge donné par la source), mais si elle revient, son histoire de prix est là
  pour dire la vérité sur sa remise. **Neuve à l'écran, pas amnésique sur le fond.**

**1.33** **MON AVIS SUR LA SOLUTION — demandé par B le 14/10/2026.** *« Est-ce que d'après toi
cette solution est bonne ? »* Mesuré avant de répondre, parce que mon chiffre précédent
(−33 %) reposait sur une chose que je n'avais pas vérifiée : **quand la source a-t-elle servi
pour la dernière fois** les cartes que la règle retire.

**Ce que la règle retire en plus, mesuré** : **5 428 cartes** affichées aujourd'hui avec plus de
cinq jours d'affichage. Leur dernier service par la source :

- **servies il y a 120 à 168 h (5 à 7 jours) : 4 142 — 76,3 %** ← le gros du lot ;
- servies il y a 48 à 120 h : 735 (13,5 %) ;
- servies dans les 24 h : 402 (7,4 %) — **seules celles-là reviendront vite**, et elles
  reviendront **encore et encore** : leur source les sert tous les jours, donc elles seront
  effacées puis réintroduites **toutes les cinq jours** ;
- aucune depuis plus de sept jours (celles-là sont déjà masquées par la règle actuelle).

**Donc le chiffre tient, et il est structurel : l'affichage passe de 15 484 à environ 10 600
cartes, −31 %, définitivement.** Les retours ne peuvent pas le refermer : 76 % du lot a quitté
la fenêtre de sa source depuis cinq à sept jours et n'y rentrera plus.

**⚠ CORRECTION DU 14/10/2026 (22 h) — CE COÛT N'EXISTE PAS, ET L'ERREUR ÉTAIT DE MOI.** J'avais
écrit ici que les **402** cartes reservies chaque jour seraient « effacées puis réintroduites
tous les cinq jours », avec **11,7 Mo** de visuels re-téléchargés. **C'est faux, avec
l'algorithme précis** : une carte que sa source sert **à ce passage-là** est **confirmée au
moment même** où elle franchit les cinq jours — **elle n'est jamais effacée**, son compteur
repart, et **aucun visuel n'est retéléchargé**. Le seul cas d'effacement est celui où la source
ne sert plus. **Le coût est donc de zéro**, et il n'y a rien à arbitrer.

**⚠ LE VRAI PRIX N'EST PAS LE VOLUME, ET IL FAUT LE DIRE.** La mesure la plus proche dont on
dispose (12/10/2026, 140 pages, population désignée par une échéance de service) : **47,7 % des
cartes qu'une échéance de service emporte étaient ENCORE VIVANTES** à leur source
(`isExpired: false`). Une échéance ne juge pas : elle emporte **des promotions réelles que
plus aucune source ne met en avant**. Autrement dit, la règle troque environ 4 900 cartes
contre la garantie de n'afficher **que ce qu'une source sert encore**.

**MON VERDICT : oui, la solution est bonne — et meilleure que ce qu'on applique aujourd'hui,
pour trois raisons mesurées.**

1. **Aucun faux positif n'est possible.** L'effacement ne repose plus sur un jugement, mais sur
   une **date**. On ne peut pas se tromper sur une date — alors que le jugement actuel se trompe
   de **48 %** quand la page est muette.
2. **Elle supprime la faute qui abîme une marque** : afficher un prix qui n'existe plus. Les
   cartes qu'elle retire ne sont plus servies par personne depuis cinq à sept jours — ce sont
   exactement celles dont le prix a pu bouger sans que personne nous le dise.
3. **Elle est gratuite et simple** : aucune requête, aucun registre, aucun budget de politesse,
   aucune table de verdicts. **348,8 Mo libérés.**

**Et sa philosophie se dit en une phrase, qu'il faut assumer : « on n'affiche que ce qu'une
source sert encore. »** C'est un choix de **fraîcheur contre volume** — et si l'objectif est le
minimum d'erreurs et une marque réputée, c'est le bon côté de la ligne.

**Ce que je changerais, en revanche :** rien dans la règle. **Ce que je garderais absolument :**
les deux exceptions déjà posées — l'**historique des prix** (1.32) et la **veille de presse**
(R.9), dont la règle fonctionne et n'a rien à voir avec un service.

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
