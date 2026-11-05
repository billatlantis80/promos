# Audit A4 — Vérifier « Bricolage »

> Session du **7 octobre 2026, ~01:50 UTC**. Unité **A4** du PLAN-NUIT.md :
> « Vérifier **bricolage** : idem [que A3 : toutes les offres de la rubrique,
> citer celles qui n'y ont pas leur place et l'inverse]. »
> **Aucune correction** : c'est un constat, comme A1/A2/A3 (la correction des
> faux positifs démontrés est l'unité **A6**, pas celle-ci). Tous les chiffres
> sortent de `node outils/audit-a4.mjs`, outil neuf de cette unité, lancé dans la
> session — rien n'est recopié à la main.

## Méthode

- Source lue : le **site publié**, `docs/offres.json` — ce que voit le lecteur.
- Les mots de bricolage et les frontières de mot sont **importés du collecteur**
  (`MOTS_FORTS`, `FAMILLES`, `MARQUES`, `MOTS_A_FRONTIERE`, `exigeFrontiere`) :
  le contrôle lit EXACTEMENT comme le classement, il ne fabrique pas de faux
  défauts. Seuls les titres sont recopiés pour l'affichage.
- Trois questions, comme A3 :
  1. **De quoi la rubrique est faite** — le motif d'appartenance de chacune ;
  2. **Faux positifs** — des offres de bricolage qui n'y ont pas leur place ;
  3. **Faux négatifs** — des offres qui devraient être en bricolage et n'y sont pas.
- Contrôle neuf : pour chaque mot faible trouvé, on teste s'il est un **mot
  entier** ou une **sous-chaîne** d'un autre mot (`motEntier`/`motPorteur`).
- Lancement : `node outils/audit-a4.mjs` ; liste brute : `--detail`.

## En-tête mesuré

```
AUDIT A4 — BRICOLAGE
  fichier   : docs/offres.json
  genereLe  : 2026-10-07T01:46:03.206Z
  offres    : 9537
  bricolage : 591   (cohérence enregistrée/calculée : 0 écart(s))
```

**0 écart** entre la rubrique enregistrée et `classerOffre()` : la rubrique
publiée est exactement ce que le classement produit aujourd'hui. Les défauts
ci-dessous sont donc des défauts **de la règle**, pas des données périmées.

## 1. De quoi la rubrique est faite (591 offres)

| motif d'appartenance | offres |
|---|--:|
| rubrique de la source (rayon « Garten & Baumarkt », « Ferramentas »…) | 301 |
| mot faible (jardin, outillage, perceuse, scie, akku…) | 176 |
| marque de bricolage (Makita, Einhell, Bosch, Worx, Gardena…) | 89 |
| produit de bricolage nommé (tondeuse à gazon, robot tondeuse, mower…) | 25 |

La rubrique **est portée majoritairement par un rayon de source** (301/591), ce
qui est le signal le plus sûr. Le gisement d'erreurs est la **deuxième ligne** —
176 offres qui ne tiennent que sur un **mot faible**, dont plusieurs sont lus en
sous-chaîne (section 2.b).

## 2. FAUX POSITIFS — offres de bricolage qui n'y ont pas leur place

### 2.a Un PRODUIT d'une autre famille est nommé (3 cas — tous légitimes)

| pays | titre (extrait) | concurrent |
|---|---|---|
| BE | `MAMMOTION YUKA Mini 2 500 Robot Tondeuse…` | High-tech poids 6 |
| BE | `MAMMOTION YUKA Mini 2 800 LiDAR Robot Tondeuse…` | High-tech poids 6 |
| BE | `MAMMOTION YUKA Mini 2 800 LiDAR Robot Tondeuse avec Mini Garage…` | High-tech poids 6 |

Les trois sont de **vrais robots de tonte** : c'est bien du bricolage. Le mot
concurrent (« connectée ») est écrasé par « robot tondeuse ». **Aucun défaut**
dans cette famille.

### 2.b Aucun produit fort, aucune marque, aucun rayon de source (176 cas)

C'est le vrai gisement. Ventilation par ce qui les porte :

| porteur (mot faible) | offres |
|---|--:|
| `bricolage+brico` | 49 |
| `hardware` | 19 |
| `scie` | 14 |
| `pila` | 12 |
| `akku` | 11 |
| `jardin+jardin` | 10 |
| `tools` | 7 |
| `perceuse+visseuse` | 6 |
| `diy` | 5 |
| `brico` seul, `tournevis`, `peinture`, `farg`, `verf`, `ladder`, `serra`… | 43 |

**Mesure neuve** : sur ces 176, **44 sont portées par une sous-chaîne PURE**
(le mot faible n'est PAS un mot entier : il est lu *dans* un autre mot). J'ai
examiné les 44 une par une :

- **28 sont manifestement MAL classées** (citée ci-dessous) ;
- **11 sont correctes malgré la sous-chaîne** (le produit est bien du bricolage) ;
- **5 sont ambiguës** (citées pour arbitrage).

#### 2.b.i Les 28 défauts nets (offre en bricolage sur une sous-chaîne)

| sous-chaîne | offres | titre (extrait) | famille attendue |
|---|--:|---|---|
| `brico` ⊂ inalámbricos | 2 | `Skullcandy Crusher EVO Cascos Inalámbricos Bluetooth` (ES, PT) | **High-tech** (casque audio) |
| `pila` ⊂ depilación/depilazione | 5 | `Philips Lumea serie 8000, dispositivo de depilación IPL` (ES ×2, PT ×2, IT) | **Beauté** (épilateur IPL) |
| `pila` ⊂ depilación | 2 | `Philips OneBlade 360 … Recortadora para Barba y Cuerpo` (ES, PT) | **Électroménager** (tondeuse à barbe) |
| `pila` ⊂ empilables | 1 | `SONGMICS Rangements pour Placards de Cuisine, Lot de 2, Empilables` (BE) | **Maison** |
| `pila` ⊂ empilables | 1 | `Opret Pilulier Semainier Français (Matin, Midi, Soir et Nuit)…` (BE) | **Maison** |
| `pila` ⊂ recopilacion/recopilatorio | 3 | `Recopilación de libros reacondicionados`, `Recopilacion de panderetas musicales`, `Recopilatorio Chollo! 16 Cursos de Udemy` (ES) | **Autres** (listes/presse) |
| `akku` ⊂ akkusauger | 2 | `roborock F25 GT Gen 2 Set Nass-Trockensauger` (DE, AT) | **Électroménager** (aspirateur) |
| `akku` ⊂ akkulaufzeit | 2 | `Amazon Kindle Paperwhite 16 GB (Version 2024)` (AT, DE) | **High-tech** (liseuse) |
| `scie` ⊂ ściemniana | 1 | `Govee Lampa stołowa LED, lampka nocna, dotykowa, ściemniana` (PL) | **High-tech/Maison** (lampe) |
| `scie` ⊂ ścienny | 2 | `Seiko Clocks Zegar ścienny QXA831S / QXA831K` (PL) | **Maison** (horloge murale) |
| `scie` ⊂ piérścieni | 1 | `Władca Pierścieni J.R.R. Tolkien książki - trylogia` (PL) | **Autres** (livres) |
| `scie` ⊂ śródmieście | 1 | `[Warszawa / Śródmieście] Bezpłatne USG piersi i badania genetyczne` (PL) | **Activité** (prestation) |
| `scie` ⊂ liście | 1 | `Liście spadają i ceny również. Hitowa strategia…` (PL) | **Autres** (presse) |
| `ladder` ⊂ bladder | 1 | `TENA Men Absorbent Protector Incontinence Pads` (GB) | **Beauté/hygiène** |
| `farg` ⊂ färgat | 1 | `Philips Hue Essential Smart LED A60 E27, 4-pack` (SE) | **High-tech** |
| `farg` ⊂ färgdisplay | 1 | `ECOWITT Väderstation med utomhussensor HP2564, wifi` (SE) | **High-tech** |
| `tools` ⊂ toolspace | 1 | `ToolSpace Balayette en Bois - Brosse 58 cm` (BE) | **Maison** (balayette) |

**Le défaut de fond est unique et connu** : des mots faibles **courts et sans
frontière** de la famille bricolage — **`brico`, `pila`, `scie`, `akku`,
`farg`, `ladder`, `tools`** — sont lus en **sous-chaîne** d'un mot ordinaire
d'une autre langue. `pila` (pile) est le pire : il attrape « de**pila**ción »,
« em**pila**bles », « reco**pila**ción ». `scie` (scie) attrape « ściemniana »,
« ścienny », « **scie**nnych », « Pier**ście**ni ». C'est **exactement le même
piège** que `figur` ⊂ configuration et `baby` ⊂ BaByliss déjà consignés en A3.

#### 2.b.ii Les 11 correctes malgré la sous-chaîne

`Dremel 4250 Multitool rotatiegereedschapset` (NL), `WAGNER Airless
verfspuitsysteem / Verfspuitsystemen` (NL), `WAGNER natryskowy 250/350 M` (PL),
`WAGNER färgspruta` (SE), `Bosch Professional planslip GSS 18V-13` (SE),
`Bosch Professional Multi-Cutter GOP` (PL), `Offerta UniversalDrill … kit Bosch`
(IT), `Lampa solarna ogrodowa` (PL), `scarificateur de jardiniers` (FR) : dans
les onze cas, le produit est **bien** du bricolage — la sous-chaîne est un
heureux hasard (`gereedschap`⊂rotatiegereedschapset, `verf`⊂verfspuitsysteem,
`verktyg`⊂slipverktyg, `jardin`⊂jardiniers). Il faut le dire, sinon on
sur-compterait les défauts.

#### 2.b.iii Les 5 ambiguës (à citer, pas à trancher en silence)

- `Ainiv 181 Pcs Feuille Plastique Fou… Kit Complet` (BE) — kit créatif :
  **bricolage ou Jeux & jouets** ?
- `Lot de 4 sangles d'arrimage à cliquet` (BE) — arrimage : bricolage ou **Auto** ?
- `SwitchBot scende fino al 40% su serrature` (IT) — serrure **connectée** :
  quincaillerie (bricolage) ou **High-tech** ?
- `Bosch Professional am Prime Day – diese Werkzeuge…` (DE) — **article de
  presse**, pas un produit.
- `Zendure SolarFlow 800 Plus : il récupère le surplus d'électricité` (FR) —
  stockage solaire : bricolage ou **High-tech** ?

## 3. FAUX NÉGATIFS — devraient être en bricolage, n'y sont pas

### 3.a Produit de bricolage NOMMÉ, rangé ailleurs (1 cas)

- `[AT] Électroménager — « Amazon Prime Deal Days: Heißluftfritteusen,
  Rasenmähroboter & Co. zu Bestpreisen »` (mot : `mahroboter`). C'est un
  **article de presse** (comparatif Prime Day) ; son « Rasenmähroboter » est un
  robot de tonte, mais l'offre n'est pas un produit. **Cas de presse**, pas une
  vraie casse.

### 3.b Mot faible de bricolage seul, rangé ailleurs (225 cas)

⚠ **225 n'est PAS le nombre d'erreurs.** C'est l'ensemble des offres **hors**
bricolage qui portent un mot de bricolage. La ventilation par mot le prouve :

| mot | offres | nature |
|---|--:|---|
| `brico` | 72 | **sous-chaîne** (inalámbricos) — l'offre est bien classée ailleurs (High-tech) |
| `akku` | 52 | mot **entier** (« Akku-Staubsauger », « Akku-Außenkamera ») dans des appareils correctement en Électroménager/High-tech |
| `bricolage` | 40 | kits créatifs correctement en Jeux & jouets, ou presse |
| `pila` | 27 | sous-chaîne (recopilación, epilateur) — bruit |
| `diy` | 17 | mot marketing (LEGO « DIY Model Kit », sonnette « DIY Wireless ») — bruit |
| `hardware` | 11 | anglicisme générique — bruit |
| `peinture` | 10 | tableaux/déco correctement en Maison |
| `scie` | 10 | sous-chaîne (scientifique, ście…) — bruit |
| `jardin` | 10 | kits « jardin » d'enfants correctement en Jeux & jouets |
| `werkzeug`, `tools`, `farg`, `souffleur`, `atelier`, `sega`… | 26 | idem, bruit ou mot voisin |

**Le seul cas plausible** à citer : `[BE] Électroménager — « Greenworks Tools
GD24X2BVK4X Aspirateur Souffleur Sans fil de Feuilles »` (mots `souffleur`,
`tools`) — un **souffleur de feuilles** de jardin, que B peut vouloir en
Bricolage (jardin) plutôt qu'en Électroménager. Discutable, mais marginal.

## 4. Contrôles E1 (partage « tondeuse ») — mesurés cette session

```
gazon    « Tondeuse à gazon sans fil 36V »      → Bricolage      ✔
gazon    « Robomow Robot tondeuse »             → Bricolage      ✔
gazon    « Makita Rasenmäher 1500W »            → Bricolage      ✔
gazon    « Bosch Grasmachine 1200W »            → Bricolage      ✔
gazon    « Einhell Cortacésped 1400W »          → Bricolage      ✔
gazon    « Tondeuse thermique tractée »         → Autres         ⚠ (voir 4.a)
cheveux  « Tondeuse à cheveux sans fil »        → Électroménager ✔
cheveux  « Philips Haarschneider Series 5000 »  → Électroménager ✔
cheveux  « Tondeuse à barbe rechargeable »      → Électroménager ✔
cheveux  « Babyliss Tondeuse à poils »          → Jeux & jouets  ✗ (voir 4.b)
cheveux  « Tondeuse cheveux Babyliss 10-en-1 »  → Jeux & jouets  ✗ (voir 4.b)
cheveux  « Rasoir électrique Braun Series 7 »   → Électroménager ✔
cheveux  « Rasoir manuel 5 lames Gillette »     → Électroménager ⚠ (voir 4.c)
cheveux  « Tondeuse » (mot nu)                  → Autres         ✔ (pas de fuite)
```

- **4.a — Effet de bord MESURÉ de la correction E1.** La suppression du mot
  **nu `'tondeuse'`** (remplacé par `'tondeuse a gazon'`) évite bien la fuite
  vers les cheveux, **mais** une tondeuse de jardin qui ne dit pas « à gazon »
  (`Tondeuse thermique tractée`) tombe désormais en **Autres**. Le mot nu
  `'tondeuse'` seul ne matche plus (dernière ligne), c'est voulu — mais il
  faudrait ajouter `'tondeuse thermique'` / `'tondeuse tractee'` à
  `MOTS_FORTS.bricolage` pour rattraper ces deux cas. **Cité, pas corrigé (A6).**
- **4.b — Défaut `baby` ⊂ « BaByliss » (déjà vu en A3).** `Babyliss` contient
  `baby`, mot d'enfant → **Jeux & jouets** au lieu d'Électroménager. Les
  contrôles E1 échouent donc **sur la tondeuse à poils Babyliss** : la rubrique
  Électroménager n'est pas en cause, c'est la table jouets. **Défaut net, cité.**
- **4.c — Rasoir MANUEL → Électroménager.** Le mot `'rasoir'` de
  `MOTS_FORTS.electromenager` attrape un **rasoir à lames manuel** (« 5 lames
  Gillette »), qui n'est pas un appareil. **Point 12 du plan : le citer plutôt
  que le cacher.** Défaut mineur, cité.

## Conclusion (à l'attention de A6)

- La rubrique **Bricolage (591 offres)** est saine dans sa masse : 0 écart de
  cohérence, 301 offres portées par un rayon de source et 89 par une marque.
- **Dommage principal, mesuré et nommé** : **44 offres** reposent sur une
  **sous-chaîne pure** d'un mot faible, dont **28 manifestement mal classées**
  (casques audio, épilateurs, tondeuses à barbe, aspirateurs, liseuses,
  horloges, livres, listes de presse…) chassées par **`brico`, `pila`, `scie`,
  `akku`, `farg`, `ladder`, `tools`**. Correction A6 : exiger la **frontière de
  mot** pour ces mots faibles courts (le même remède que `figur`/`baby` en A3).
- **11 sous-chaînes sont inoffensives** (Dremel, WAGNER, Bosch) — ne pas
  « corriger » en cassant ces cas ; **5 sont ambiguës**, citées pour B.
- **Faux négatifs** : 1 cas de presse (produit bricolage en Électroménager) ;
  les 225 autres sont du **bruit** (mot voisin ou mot entier dans une offre bien
  classée), pas une casse — dit, pas tu.
- **Contrôles E1** : tondeuse à gazon → Bricolage ✔ ; tondeuse à cheveux →
  Électroménager ✔ **sauf si la marque est `BaByliss`** (défaut `baby`) ; deux
  effets de bord mesurés (`tondeuse thermique` en Autres, rasoir manuel en
  Électroménager) — **cités, à trancher en A6**.
