# Audit A3 — Vérifier « Jeux & jouets »

> Session du **7 octobre 2026, ~01:40 UTC**. Unité **A3** du PLAN-NUIT.md :
> « Vérifier **jouets** : toutes les offres de la rubrique, citer celles qui n'y
> ont pas leur place et l'inverse. »
> **Aucune correction** : c'est un constat, comme A1 et A2 (la correction des
> faux positifs démontrés est l'unité **A6**, pas celle-ci). Tous les chiffres
> sortent de `node outils/audit-a3.mjs`, outil neuf de cette unité, lancé dans la
> session — rien n'est recopié à la main.

## Méthode

- Source lue : le **site publié**, `docs/offres.json` — ce que voit le lecteur.
- Les mots de jouet et les frontières de mot sont **importés du collecteur**
  (`MOTS_FORTS`, `FAMILLES`, `MARQUES`, `MOTS_A_FRONTIERE`, `exigeFrontiere`) :
  le contrôle lit EXACTEMENT comme le classement, il ne fabrique pas de faux
  défauts. Seuls les titres sont recopiés pour l'affichage.
- Trois questions :
  1. **De quoi la rubrique est faite** — le motif d'appartenance de chacune ;
  2. **Faux positifs** — des offres de jouets qui n'y ont pas leur place ;
  3. **Faux négatifs** — des offres qui devraient être en jouets et n'y sont pas.
- Lancement : `node outils/audit-a3.mjs` ; liste brute : `--detail`.

## En-tête mesuré

```
AUDIT A3 — JEUX & JOUETS
  fichier   : docs/offres.json
  genereLe  : 2026-10-07T01:31:00.272Z
  offres    : 9510
  jouets    : 772   (cohérence enregistrée/calculée : 0 écart(s))
```

**0 écart** entre la rubrique enregistrée et `classerOffre()` : la rubrique
publiée est exactement ce que le classement produit aujourd'hui. Les défauts
ci-dessous sont donc des défauts **de la règle**, pas des données périmées.

## 1. De quoi la rubrique est faite (772 offres)

| motif d'appartenance | offres |
|---|--:|
| nom de jouet (lego, jeu de société, figurine, puzzle, dominos…) | 363 |
| mot d'enfant / plage d'âge (fille, garçon, enfant, kid, niño…) | 220 |
| rubrique de la source (rayon « Jouets » du marchand) | 99 |
| mot faible (« jouet », « bébé », « baby », « figur », « jeu »…) | 63 |
| marque de jouet (Lego, Playmobil, Hasbro, Mattel…) | 27 |

La rubrique **n'est pas portée par un seul mot** : un nom de jouet explicite la
justifie dans près de la moitié des cas, et l'autre moitié se répartit entre la
règle « enfant/fille/garçon » (E4), la source et les marques. C'est sain dans le
principe. Les deux dernières lignes sont le gisement des erreurs.

## 2. FAUX POSITIFS — offres de jouets qui n'y ont pas leur place

### 2.a Un PRODUIT d'une autre famille est nommé, plus long que le mot de jouet (11 cas)

Ces offres sont en jouets alors que leur titre nomme un produit précis d'une
autre famille. Cas cités :

| pays | titre (extrait) | concurrent nommé |
|---|---|---|
| IE | `imoo Z3 Kids Smart Watch with GPS Tracker…` | High-tech (montre connectée) |
| BE | `Tablette Dessin Enfant 2 Pièces 8.5 Pouces…` | High-tech (tablette) |
| BE | `Appareil Photo Instantané Enfant - Cadeau pour Filles Garçons 3 à 12 Ans` (×3) | High-tech (appareil photo) |
| BE | `Tableau à dessin LED TOHETO pour enfants…` | High-tech |
| BE | `Jouets de cuisine en bois pour enfants… machine à café en bois` | Électroménager (« machine à café ») |
| BE | `ROBOTIME Book Nook Kit… Puzzle 3D…` | Meubles |
| BE | `SONGMICS Étagère à Jouets pour Enfants, 9 Paniers, 1 Bac` | Meubles (étagère) |
| BE | `Ainiv 20PCS Mains Collantes…` | Électroménager (« lisseur » dans *remplisseurs*, « fan » dans *fantaisie* — bruit de sous-chaîne) |

Les deux derniers sont des jouets légitimes : l'outil les cite parce qu'un mot
concurrent cohabite, mais le produit est bien un jouet. Les cas réellement
discutables sont la **montre connectée**, la **tablette**, l'**appareil photo**
et le **tableau LED** : ce sont des appareils électroniques d'enfant, que B peut
vouloir en High-tech ou en jouets — **à trancher par B** (le rapport le dit, il
ne cache pas l'ambiguïté).

### 2.b Aucun nom de jouet dans le titre (377 cas)

⚠ **377 n'est PAS le nombre d'erreurs** : c'est l'ensemble des offres de la
rubrique sans nom de jouet explicite. Une bonne part sont de **vrais jouets**
nommés autrement (kits créatifs « à peindre », construction magnétique, karaoké
enfant, faux instruments…) ou portées par un mot d'enfant **légitime**. L'outil
les ventile par ce qui les porte :

| porteur | offres |
|---|--:|
| mot d'enfant / plage d'âge (règle E4) | 215 |
| rubrique de la source « Jouets » | 99 |
| mot faible `bebe` | 13 |
| mot faible `jouet` | 13 |
| mot faible `baby` | 11 |
| `jouet+bebe` | 6 |
| `figur/figura` | 5 + 1 |
| `jeu` | 4 |
| `pram`, `neonato`, `plush`, `jogos`, `construccion`, `pop`… | 1 chacun |

Les cas **manifestement hors sujet**, mesurés et nommés :

- **Hygiène bébé — 30 offres.** Couches, lingettes et wipes portés par
  `bebe`/`baby` (mots isolés) ou par un rayon de source : `BIOLANE - Couches
  Bébé Taille 3/4/5` (FR, 3), `Pampers Baby-Dry Pants` (AT/DE, 5),
  `Pampers Progressi Maxi/Mini` (IT, 2), `Dodot Pañales/Toallitas` (ES/PT, 7),
  `WaterWipes Sensitive+` (GB/IE/SE/PL, 5), `Amazon Sensitive Baby Wipes` (GB),
  `Pampers Sensitive billendoekjes` (NL), `Chusteczki Waterwipes` (PL),
  `2+1 Gratis Windeln Millie Moon` (DE). Ce sont des **consommables**, pas des
  jouets — mais B a demandé « *toute annonce contenant enfant → jouets* », et il
  n'existe aucune rubrique « Bébé ». **Cas ambigu, à trancher par B.**
- **`figur` attrape « configuration » — 5 offres.** `Amazon Fire TV Stick HD`
  (BE/ES/PT/IT/FR) : la sous-chaîne `figur` de « configur**ation** » satisfait le
  mot faible `figur`/`figura` de la table jouets, et la Fire TV — qui est un
  **appareil High-tech** — tombe en jouets. C'est un **défaut net**, mesuré.
- **`baby` attrape « BaByliss » — 1 offre.** `BaByliss Smooth Finish 1200,
  Föhnborstel…` (NL) : « **baby**liss » contient `baby`. Une brosse chauffante
  se retrouve en jouets. **Défaut net**, mesuré.
- **Soins/électronique d'enfant :** `Signal Junior Super Mario 6-13 años`
  (dentifrice, ES), `Sonic Electric Toothbrush for Adults and Kids` (GB),
  `50% Off Kids Coats, Jackets…` (vêtements enfants, GB → devrait être **Mode**),
  `imoo Z1/Z3 Kids Smart Watch` (IE → High-tech ?),
  `SUPER MEAT BOY 3D - Nintendo Switch` (jeu vidéo, ES → High-tech).
- **Voyage :** `ANDORRA, ¡UN PARAÍSO NATURAL! Hotel 3* … -50% en niños` (ES) →
  un **hôtel** rangé en jouets sur le mot `niños` ; devrait être **Voyages**
  (destination étrangère depuis l'ES) ou Activité. **Défaut net**, cité.

### Ce qu'il faut retenir du côté « faux positifs »

Trois défauts sont **certains** et corrigeables en A6 (le rapport les nomme, il
ne les cache pas) : **Fire TV par `figur` (5)**, **BaByliss par `baby` (1)**,
**hôtel d'Andorre par `niños` (1)**. Le reste du gisement est soit légitime, soit
ambigu (hygiène bébé, appareils électroniques d'enfant) et **demande l'arbitrage
de B**, pas une décision silencieuse.

## 3. FAUX NÉGATIFS — devraient être en jouets, n'y sont pas (24 cas)

Répartis par rubrique : **High-tech 18 · Beauté 4 · Meubles 1 · Électroménager 1**.
Après examen, la **quasi-totalité est justifiée** par un produit nommé plus long
ou par la règle du jeu numérique — ce n'est donc pas une casse, et il faut le
dire :

- **Jeux vidéo** (LEGO Batman PS5, LEGO Party! PS5, Solitaire Pro, Patchwork
  Board Game, Castles of Burgundy…) → High-tech : *jeu numérique*, exception
  voulue (`estJeuNumerique`).
- **Brosses à dents enfants** (Oral-B iO Kids, Philips Sonicare for Kids,
  brosse Philips Sonicare) → Beauté : appareil de soin nommé, plus long.
- **Écouteurs** (JBL Junior 320) → High-tech ; **montre Kids** (imoo Z3) → High-tech.
- **Lit d'Enfant Cabane Treviolo** → Meubles : `sommier` (7 car.) bat `enfant` (6).
- **Traceur GPS Voiture** → High-tech (effet de bord déjà consigné en E4).

**Deux cas réellement discutables**, à citer plutôt qu'à taire :
- `Aolso Jouet téléphonique pour bébé - Jouet musical pour téléphone portable`
  → **High-tech**, parce que « téléphone portable » (18 car.) bat « jouet » (6).
  Un jouet d'éveil qui part en High-tech.
- `EPUMP Kit de peinture en bois pour enfants … aimants de réfrigérateur`
  → **Électroménager**, parce que « réfrigérateur » (13 car.) bat « enfants » (6).
  Un kit créatif d'enfant qui part avec les frigos.

## Conclusion (à l'attention de A6)

- La rubrique **Jeux & jouets (772 offres)** est globalement saine : 0 écart de
  cohérence, plus de la moitié justifiée par un nom de jouet ou une marque.
- **3 défauts certains** à corriger en A6 : `figur`/`figura` avale
  « configuration » (5 Fire TV), `baby` avale « BaByliss » (1), `niños` envoie un
  hôtel d'Andorre en jouets (1). Les deux premiers sont des **sous-chaînes sans
  frontière** dans des mots faibles — exactement le piège déjà corrigé ailleurs.
- **2 gisements à arbitrer par B**, pas à trancher en silence : l'**hygiène bébé**
  (30 offres) et les **appareils électroniques d'enfant** (montre, tablette,
  appareil photo, tableau LED).
- **24 faux négatifs**, dont 22 justifiés ; 2 discutables cités (jouet téléphone,
  kit peinture-décor).
