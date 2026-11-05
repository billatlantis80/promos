# Discrétion et trafic — plan (12/10/2026)

Journal de décisions. La demande de B, mot pour mot, puis les mesures, puis ce
qui est fait et ce qui reste. **Ne rien implémenter qui ne soit écrit ici.**

## 1. La demande (12/10/2026)

> « D'après toi quelle serait la meilleure solution ? Le plus efficace et
> optimal ? Mon objectif est d'éviter trop de trafic inutile, éviter les
> problèmes avec les sites avec qui on travaille et qui font tourner kazendra. »

> « L'objectif est de ne pas trop peser sur le système afin d'être discret et
> d'éviter des problèmes. »

Puis, sur mon analyse en quatre points : **« Ton analyse est correcte, tu peux
commencer. »**

## 2. Ce que la mesure a corrigé tout de suite

**Mon estimation était fausse, et je la retire.** J'avais annoncé « de l'ordre de
1 Go par jour » vers les partenaires, à partir de la fréquence mesurée et de
tailles échantillonnées. Le compteur, une fois branché, a donné **18,4 Mo sur un
seul passage** — dont 9,1 Mo pour les seules pages d'aperçu. Le chiffre publié
est désormais mesuré, pas estimé ; le total « par jour » se lira au bout de
24 heures (le compteur dit combien de passages il a additionnés, et ne fait pas
passer 3 passages pour une journée).

## 3. Ce qui est fait, et vérifié en production

### 3.1 Le compteur de trafic

Chaque requête sortante est comptée avec les octets reçus, par **famille**
(`source`, `source-304`, `apercu`, `visuel`, `robots`) et par **hôte**. Publié
dans `docs/etat-collecte.json` → `donnees.trafic`, donc lisible par l'onglet
« Données ». La taille comptée est celle du **fil** (`content-length` quand le
serveur l'annonce).

### 3.2 Les requêtes conditionnelles

`ETag` / `Last-Modified` mémorisés par source ; renvoyés à la visite suivante ;
un `304` réutilise le corps mémorisé. **Le reste du collecteur ne voit aucune
différence** : mêmes offres relues, mêmes compteurs de tours, mêmes dates — c'est
ce qui rend le gain gratuit. Le cache vit dans `data/conditionnel/` (local,
jamais publié). Pour les sources lues par `curl`, le corps et les en-têtes sont
écrits dans des fichiers temporaires, puis lus.

**Mesuré, 2ᵉ passage : 3 réutilisations sur 25 essais**, zéro octet.

### 3.3 `robots.txt` — lu, publié, PAS ENCORE APPLIQUÉ

Lu une fois par jour et par hôte, verdict publié dans `donnees.robots` avec
`applique: false` écrit noir sur blanc. **Rien n'est écarté** : retirer une source
retire du contenu du site, et c'est une décision de B — il lui faut la liste
avant de la prendre.

**Verdict du 12/10 : 18 hôtes connus, 0 sans fichier, 0 tout interdit, 0 chemin
interdit** → **aucune source ne nous refuse aujourd'hui**.

## 4. Trois défauts trouvés pendant ce travail

1. **Deux par les épreuves, pas à l'œil.**
   - `headers.get()` rend `null` quand l'en-tête manque, et `Number(null)` vaut
     **0** : un `content-length` absent faisait compter ZÉRO octet. Le compteur
     aurait annoncé « on ne pèse presque rien » sur des pages de 200 Ko — la pire
     des mesures, celle qui rassure à tort.
   - Le bloc `robots` publié n'était pas normalisé : le panneau lisait
     `undefined` là où il attend un « non ».
2. **Un par la mesure.** Les sources sont lues en parallèle : huit adresses d'un
   même marchand demandaient huit fois le même `robots.txt` au même instant.
   **34 requêtes pour 18 hôtes** au premier passage. Corrigé par une mémoire des
   appels en vol ; 0 au passage suivant.

## 5. Ce qui a été essayé, puis RETIRÉ — la requête partielle `Range`

B a validé la requête `Range: bytes=0-200000` sur les pages d'aperçu. **La mesure
l'a contredite, et je l'ai retirée.** Chiffres :

Une réponse partielle (`206`) **n'est pas compressée**, alors que la même page
servie entière arrive en gzip ou brotli. Mesuré sur des pages réelles, mêmes
adresses, même agent :

| Site | Page entière | `Range: 64 Ko` |
|---|---|---|
| 01net | 172 Ko (brotli) | **65,5 Ko non compressé** |
| tuttoandroid | 195 Ko (brotli) | 65,5 Ko non compressé |
| 4gnews | 322 Ko (gzip) | 65,5 Ko non compressé |
| clubic | 1 301 Ko (brotli) | **807 Ko** — le serveur a répondu `206` en envoyant bien plus que demandé |
| lesnumeriques, gsmarena | — | `Range` **ignoré** (200, page entière) |

Demander moins faisait donc payer **plus** sur la plupart des sites. Le vrai
levier n'était pas la demande, c'était la **lecture**.

### Ce qui est en place à la place

**On lit la réponse en flux et on COUPE dès que la balise est trouvée.** La
compression reste, et on ne paye pas la fin d'une page qu'on ne lira pas — ce que
fait un navigateur quand on quitte une page avant la fin.

Justification mesurée : sur dix pages réelles, la balise `og:image` vit entre
**1 000 et 9 000 octets** (médiane **5 285**). Le plafond de lecture est donc fixé
à **64 Ko** — treize fois la marge. Au-delà, on n'a jamais rien trouvé.

L'épreuve le prouve : sur un flux fabriqué de 500 Ko après la balise, le second
morceau **n'est jamais tiré du serveur**.

## 6. Ce qui reste, et c'est là qu'est le poids (mesuré)

| Poste | Mesure d'un passage | Ce qu'on peut faire |
|---|---|---|
| `apercu` | 37 requêtes, 9,1 Mo annoncés au 1ᵉʳ passage (chiffre HAUT : voir §7) | lecture coupée dès la balise — **fait** |
| `source` | 41 requêtes, 9,2 Mo → 225 Ko de moyenne | conditionnelles déjà en place ; les pages d'enseigne (Coolblue 810 Ko par page) restent |
| `visuel` | 27 requêtes, 7,6 Mo | certains visuels pèsent **plusieurs Mo** (mesuré : 2 fichiers = 7,5 Mo). Un plafond, ou un ré-encodage — décision de B, ça touche ce que voient les visiteurs |

## 7. Ce que le compteur ne sait pas encore mesurer exactement

Quand un serveur **compresse** sa réponse, le plus souvent il n'annonce aucune
taille (`content-length` absent, transfert par morceaux). Le compteur retombe
alors sur les octets du corps **décompressé** — c'est-à-dire une **borne haute**
de ce qui a passé sur le fil. Les chiffres publiés ne sous-estiment donc jamais :
ils peuvent surestimer. C'est écrit dans le code, et ça reste à améliorer.

## 8. Décisions de B à venir

- **Plafond de taille des visuels rapatriés** (et/ou ré-encodage) : touche ce que
  voient les visiteurs.
- **Application de `robots.txt`** : rien à appliquer aujourd'hui (0 refus sur
  18 hôtes connus).
- **La règle des 7 jours** : voir le plan `2026-10-12-donnees-et-peremption-7-jours.md`.
  Deux choses attendues de B : le **choix du compteur** (vie sur le site / dernière
  confirmation de la source) et le **mot d'activation** (la règle efface).

## 9. La cadence : de 5 à 15 minutes (décision de B, 12/10/2026)

Réponse de B, mot pour mot : **« Ok pour 15 minutes »**. Le planificateur passe de
`*/5` à `*/15` (tâche renommée « Collecte Kazendra (15 min) »).

### Pourquoi c'est un gain, et pas un renoncement

Les sources ne sont **jamais** interrogées au rythme du planificateur : elles le
sont au leur (`reposMin` — 15 min pour les agrégateurs, 30 pour la presse, 45 à
240 pour les enseignes). À 5 minutes, **deux passages sur trois** ne trouvaient
donc rien de neuf à demander et ne servaient qu'à faire tourner le dépôt.

Mesures qui ont décidé :

| | À 5 min | À 15 min |
|---|---|---|
| Commits par jour | **339** (316 portant le catalogue entier) | ≈113 |
| Recherches Google News | 2 016 req/jour | **672** |
| Fraîcheur maximale du site | 5 min | 15 min |

Le catalogue gagne **57 à 207 nouvelles offres par heure** (mesuré) : à 15 minutes,
ce sont donc 15 à 50 offres qui attendent le passage, au lieu de 5 à 17.

### Ce qui est surveillé après le changement

- **Les visuels reportés** au passage suivant : la capacité par passage triple d'un
  coup (le travail d'images qui tenait en 5 minutes doit maintenant tenir en 15).
  Mesuré à **0 report** avant le changement. S'ils apparaissent, il faudra relever
  le budget d'images par passage.
- **La durée des passages** : le détecteur de blocage coupe à 240 s, le
  planificateur à 300 s.
- **LES BUDGETS ONT ÉTÉ RELEVÉS, et voici le calcul** (il a fallu le faire avant
  de voir le premier passage, parce que le défaut aurait été silencieux) : à
  budget constant (25 s de téléchargements par passage), la capacité horaire
  tombait de **300 s à 100 s**, alors que le besoin mesuré est d'environ
  **107 visuels par heure**. La file se serait mise à grossir sans une seule
  erreur au journal — juste des cartes grises de plus en plus nombreuses. Les
  trois parts passent donc de 100 s à **145 s** au total (45+30+25 → 55+45+45),
  ce qui remet la capacité horaire au-dessus du besoin tout en restant sous la
  moitié de la fenêtre — l'épreuve `tests/sources.test.mjs` le vérifie et
  refusera la prochaine augmentation faite « puisqu'on a 300 s ».
- **Le compteur de trafic** : le chiffre « par jour » montrera l'avant/après.

### Ce que la cadence change, calculé sur les 196 sources réelles

| Cadence | Interrogations de source par jour |
|---|---|
| 5 min (avant) | **8 772** |
| 15 min (maintenant) | **7 812** (−11 %) |
| 30 min | 6 771 (−23 %) |

Le gain sur les partenaires est donc **modeste, et c'est la preuve que 5 minutes
ne les maltraitait pas** : c'est leur `reposMin` qui les protégeait (92 sources à
30 min, 58 à 45 min, 5 sans délai). Le vrai gain est ailleurs — **Google News
2 016 → 672 requêtes/jour** (−67 %) et **339 → ~113 commits/jour** (−67 %).

### Une correction faite au passage

Le `README` annonçait que le workflow GitHub relançait la collecte « toutes les
5 minutes ». C'est faux, et ça l'était depuis toujours : il tourne **toutes les
heures**, en secours. Corrigé — une note fausse dans un dépôt finit par être lue
comme une preuve.
