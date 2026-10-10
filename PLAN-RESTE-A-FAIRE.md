# Ce qu'il reste à faire — relevé du 8 octobre 2026

Demandes de B, dans l'ordre où il les a énoncées :

1. La même base de données que la Belgique, en fichier XLS, **pour tous les autres pays** de l'application
2. **Protéger le concept et le nom**
3. **Rediriger** les domaines `.be`, `.fr`, `.eu`, `.app`
4. **Créer les affiliations**
5. **Promouvoir le site**
6. **Officialiser le site** — la partie administrative (mentions légales, RGPD, cookies, CGU)

Chaque affirmation ci-dessous porte sa mesure. Ce qui n'est pas mesuré est écrit **NON VÉRIFIÉ** —
règle du projet : on n'annonce pas un chiffre qu'on ne peut pas prouver.

---

## 3. Rediriger `.be` `.fr` `.eu` `.app` — ✅ RIEN À ACHETER, tout est déjà à vous

**Mesuré le 08/10/2026** (WHOIS du registre + résolution DNS + lecture des en-têtes HTTP).

Vous possédez **déjà les cinq domaines**. Les quatre à rediriger sont à vous :

- `kazendra.com` → `185.199.111.153` = **GitHub Pages** — c'est le site, en ligne ✅
- `kazendra.fr` → `213.186.33.5` = **page d'attente OVH** · créé le **07/10/2026** chez OVH, mêmes serveurs de noms que `.com`
- `kazendra.be` → `213.186.33.5` · WHOIS DNS Belgium : « Registered: Wed Oct 7 2026 », bureau OVH
- `kazendra.eu` → `213.186.33.5` · même stationnement
- `kazendra.app` → `213.186.33.5` · même stationnement

Témoin de contrôle : trois domaines inventés au hasard ne résolvent **pas** — il n'y a donc pas de
détournement de NXDOMAIN par le résolveur, et ces adresses sont bien réelles et bien à vous.

**Non possédés, et libres** : `kazendra.nl`, `kazendra.de` (WHOIS « free » des deux côtés, aucune résolution).

### Ce qu'il faut faire — dans votre compte OVH, 4 fois

C'est une **redirection gratuite OVH**, pas un achat. Pour chacun des quatre domaines :

1. OVH → *Web Cloud* → *Noms de domaine* → choisir le domaine
2. Onglet **Redirection** → « Ajouter une redirection »
3. Type : **redirection visible permanente (301)** — pas une redirection invisible (masquage)
4. Destination : `https://kazendra.com`
5. Répéter pour `.be`, `.fr`, `.eu`, `.app`

**Pourquoi 301 et pas un simple parking** : une 301 transmet aux moteurs de recherche qu'il n'y a
qu'un seul site. Le nom de domaine secondaire ne « dilue » donc pas le référencement de kazendra.com.
Une redirection invisible, à l'inverse, laisse croire à deux sites distincts.

**Point d'attention** : `.app` est dans la liste HSTS de Google — ce TLD ne fonctionne **qu'en HTTPS**,
jamais en clair. Une redirection OVH en HTTP simple ne suffira pas ; il faut que la destination soit
bien `https://kazendra.com`.

Ce point était déjà noté dans `DNS-KAZENDRA.md` (« ⏳ à faire : redirection gratuite OVH ») —
il ne restait que l'exécution.

---

## 4. Créer les affiliations — la liste est déjà mesurée, il ne reste à s'inscrire

**DÉCISION DE B, 09/10/2026 : « On passe aux affiliations. »**

⚠️ **MESURE DU 09/10/2026, qui commande tout le reste** (catalogue publié, 16 680 offres, classées par
**destination réelle du lien sortant** — le dossier complet est dans `AFFILIATIONS-PAR-Ou-COMMENCER.md`) :

| Destination du clic | Offres | Part | Commission possible |
|---|---|---|---|
| Un **agrégateur** (MyDealz, HotUKDeals, Chollometro, Dealabs, Pepper…) | 11 385 | **68,3 %** | ❌ **aucune, quel que soit le réseau** |
| **Amazon** (10 marchés) | 4 528 | **27,1 %** | ✅ oui |
| Autres marchands à lien direct | 767 | 4,6 % | ⚠️ partiellement |

**Conséquence : Amazon Partenaires d'abord, et de très loin** — une seule inscription ouvre 27,1 % du
catalogue, six fois tout le reste réuni. Les quinze autres réseaux couvrent aujourd'hui ~80 offres
(0,5 %) : les inscrire d'abord serait du travail pour presque rien.

**Les identifiants se posent à UN SEUL endroit** : la table `AMAZON_TAGS` de `public/affiliation.js`.
Poser un identifiant fait basculer tout seul la mention du pied de page, qui cesse d'annoncer
« liens directs, sans commission ».

**Mise à jour du 09/10/2026, 23:18 UTC — c'est fait pour deux marchés, et mesuré :**

- `kazendra-21` (amazon.fr) et `kazendra06-21` (amazon.com.be) sont **en ligne sur le site** : le pied
  de page de `kazendra.com` affiche désormais la mention d'affiliation, plus la phrase « pas encore
  d'identifiant ».
- L'**application Android n'était PAS à jour** : l'APK/AAB du 09/10 à 15:21 UTC embarquait la table
  vide et affichait donc la vieille phrase. Reconstruit en **code 19** (même nom affiché, « 1.0 »),
  signé avec `kazendra.keystore` — identifiants embarqués, contrôle fait sur l'APK signé.
- **Les huit autres marchés restent vides** (de, it, es, nl, co.uk, ie, se, pl) : leurs liens partent
  en direct, volontairement, tant que le programme national n'est pas ouvert.


**Le vrai sujet, plus gros que les inscriptions** : les 68 % dont le lien part vers un site de bons
plans. Le marchand est **connu** (le champ `marchand` du catalogue porte Lidl, MediaMarkt, Cdiscount,
AliExpress…) mais son **adresse** ne l'est pas. Deux voies : laisser tel quel (honnête, non monétisé),
ou résoudre 11 385 liens marchands un par un — un vrai chantier, à trancher.

**Base mesurée** : `donnees/affiliations.json`, 165 acteurs interrogés un par un le 08/10/2026 à 12:56 UTC.

```
programme trouvé   : 22 acteurs
aucun signe trouvé : 118 acteurs
non mesuré         :  25 acteurs
```

⚠️ **« aucun signe trouvé » ne veut pas dire « pas de programme ».** La méthode est écrite dans le
fichier : un programme privé ne laisse aucune trace publique. Les 118 sont donc « à démarcher », pas
« sans affiliation ».

### Les réseaux à rejoindre — 10, déduits de signatures réelles dans les pages

| Réseau | Acteurs concernés |
|---|---|
| **Amazon Partenaires** | Amazon.com.be, Uber Eats, JBC, RTL info & Sudinfo, TuttoAndroid, 4gnews |
| **Awin** | AutoDoc, Coolblue, Electro Dépôt, 4gnews |
| **TradeTracker** | TUI fly Belgium, Corendon Belgique |
| **Tradedoubler** | AutoDoc, 4gnews |
| **Impact** | Albert Heijn, 4gnews |
| **Partnerize** | Albert Heijn |
| **Webgains** | AutoDoc |
| **Adcell** | 4gnews |
| **belboon** | 4gnews |
| **Smartclip / Sovendus** | Maxi Zoo |

### Programmes trouvés sans réseau identifiable — à démarcher en direct

Bongo & Wonderbox · Veepee / Zalando Lounge · Deliveroo · HelloFresh · Marley Spoon ·
Le Roi du Matelas · Pearle Opticiens · Farmaline

### Ce qu'il faut faire

1. **Amazon Partenaires d'abord** — c'est le plus gros volume du catalogue (Amazon représente une
   part dominante des offres) et l'inscription est immédiate.
2. Puis **Awin** et **TradeTracker** : à eux deux, ils couvrent 6 des 22 programmes détectés.
3. Renseigner les identifiants dans `public/affiliations.js`.
4. **Le site reste honnête en attendant** : son pied de page dit aujourd'hui « Cette version ne
   contient pas encore d'identifiant d'affiliation : les liens sortants sont directs, sans commission. »
   Cette phrase doit disparaître **au moment** où les identifiants sont posés — pas avant.

Ce qui est attendu de vous : les inscriptions demandent **votre identité et un IBAN**. Je ne peux pas
les faire à votre place. Je peux préparer chaque dossier et vous dire, réseau par réseau, ce qu'il
demande.

---

## 1. La base de données marché en XLS, pour les 11 autres pays

### Ce qu'est la base belge, exactement

`donnees/marche-be-2026-10-08.xlsx` — **votre propre recherche marché**, pas une donnée collectée :

- feuille **« Vue densemble »**, **13 colonnes** : Enseigne / entreprise · Catégorie · Positionnement /
  objectif · Segment · Type d'acteur · Adresse du siège · Téléphone · Email · Site web · CA indicatif ·
  Actionnariat / groupe · Mode de distribution · Informations clés & remarques
- 139 entreprises à l'origine, 22 catégories
- convertie en `public/acteurs.json` par `outils/acteurs-depuis-xlsx.py` (165 acteurs, 26 catégories
  après ajout des 26 acteurs que l'application lit sans qu'ils figurent au tableur)
- le JSON est ce que lisent le site **et** le panneau d'administration

Le script est réécrit pour **un seul pays à la fois** : `PAYS = "BE"` et `SOURCE = "marche-be-....xlsx"`
sont écrits en dur. Pour les autres pays il faut donc : un tableur par pays, et un script par pays
(ou un script paramétré, ce qui est préférable).

### Les 11 pays restants

`FR · DE · GB · ES · IT · NL · AT · PL · IE · PT · SE`

### RÈGLE (09/10/2026) — toute adresse trouvée se documente AUSSI dans le tableur du pays

**B : « En même temps tu dois les documenter dans le fichier xls concerné par pays, pour pouvoir
garder la base de donnée. »**

Le fichier `public/adresses-promotions.json` est un réglage de SITE : il est lu par le panneau et par
la collecte. Ce n'est pas une base de données. Le tableur, lui, est la **provenance** — c'est de lui
que `acteurs-depuis-xlsx.py` tire `public/acteurs.json`. Une adresse qui ne vit que dans le fichier de
publication ne vit nulle part.

Trois colonnes sont donc ajoutées à la fin de **chaque feuille de données** (les 23 feuilles de
catégories + « Vue densemble » — jamais « Lisez-moi », qui n'en est pas une) :

- **Adresse des promotions** — l'adresse retenue, ou **vide**. Vide veut dire vide : on n'écrit jamais
  une adresse devinée dans la base, parce qu'une adresse fausse recopiée de tableur en tableur se
  transmet pendant des années sans que personne ne la revérifie.
- **Résultat de la vérification** — ce que la page a réellement donné : « liste — 22 offre(s) à deux
  prix », « page de promotions reconnue, 0 offre lisible », « rien trouvé ». C'est ce qui distingue
  une adresse qui **rapporte** d'une adresse qui existe.
- **Relevée le** — la date.

Outil : `outils/documenter-adresses-xlsx.py` (à lancer avec `uv run --with openpyxl`). Il **relit**
chaque tableur après écriture, restaure l'original en cas d'échec, et vérifie à la fin que la base
produite est identique — c'est cette dernière épreuve qui prouve que la documentation n'a rien cassé.

État au 09/10/2026 : BE 78 · DE 188 · FR 168 adresses écrites. Les 9 autres pays de la collecte n'ont
**pas encore de tableur** (voir ci-dessus) : leurs adresses n'existent donc, pour l'heure, que dans le
JSON. C'est un trou à combler en même temps que les 11 tableurs manquants.

### La difficulté, dite franchement

Les colonnes **Adresse du siège · Téléphone · Email · CA indicatif · Actionnariat · Mode de
distribution** ne se déduisent d'aucune source publique que je puisse lire mécaniquement : ce sont
des informations d'entreprise. Sur 11 pays × ~140 acteurs, cela représente de l'ordre de
**1 500 sociétés**.

Ce que je peux produire, moi, sans rien inventer :

- la liste des **acteurs réellement présents** dans chaque pays, mesurée depuis le collecteur (191 flux,
  les domaines qui reviennent vraiment) — même méthode que `outils/mesure-acteurs-manquants.mjs` ;
- **Catégorie · Type d'acteur · Segment · Site web · Domaine · Pays · Remarques** renseignés ;
- le **positionnement** quand il est lisible sur le site de l'acteur.

Ce que je ne peux **pas** produire honnêtement : adresse, téléphone, email, CA, actionnariat. Je ne
les inventerai pas — un tableur à moitié faux est plus dangereux qu'un tableur incomplet, parce qu'il
a l'air complet.

**Deux voies, à trancher :**

- **A. Tableur complet, colonnes commerciales vides**, à compléter par vous (ou par recherche pays par
  pays, un pays à la fois, sur plusieurs jours). Livrable rapide, honnête, vérifiable.
- **B. Recherche assistée** : je remplis aussi les colonnes commerciales, mais par recherche web
  acteur par acteur, avec la source citée pour chacune. C'est long — de l'ordre de plusieurs heures par
  pays — et le résultat reste à vérifier par vous.

Dans les deux cas, le format du fichier belge est reproduit **à l'identique** (mêmes 13 colonnes, même
nom de feuille) pour que `acteurs-depuis-xlsx.py` les lise sans modification.

---

## 2. Protéger le concept et le nom

### Ce qui est protégeable — et ce qui ne l'est pas

Il faut le dire clairement, parce que c'est une confusion fréquente et coûteuse :

- ❌ **Une idée, un concept, une méthode ne se protègent pas.** « Un site qui rassemble les promos de
  plusieurs pays sans clé d'API » n'est pas protégeable en tant que tel. C'est le droit d'auteur qui
  couvre l'**expression**, pas l'idée.
- ✅ **Le nom** — par une **marque déposée**. C'est le point le plus important et le plus urgent.
- ✅ **Le logo** — le dessin est protégé par le droit d'auteur dès sa création, et peut être déposé
  comme marque figurative.
- ✅ **Le code** — protégé par le droit d'auteur automatiquement, sans démarche. C'est déjà le cas.
- ✅ **La base de données** — l'Union européenne reconnaît un droit *sui generis* sur une base dont la
  constitution a demandé un investissement substantiel. Vous en avez une (191 sources, 13 800 offres).
- ✅ **Les noms de domaine** — déjà à vous (voir § 3).

### L'urgence, et pourquoi

**Le nom n'est protégé aujourd'hui par rien.** Le site est public. Quelqu'un qui dépose « Kazendra »
avant vous peut ensuite vous interdire de l'utiliser. C'est le risque principal, et il augmente avec
la promotion (§ 5) : promouvoir le site, c'est faire connaître le nom à des gens qui peuvent le déposer.

### Étapes

1. **Vérifier que « Kazendra » est libre** — ✅ **FAIT le 08/10/2026.** Recherche sur **TMview**
   (base publique gratuite du réseau TMDN, qui agrège les offices de marques — EUIPO, BOIP, WIPO,
   offices nationaux) :

   ```
   zalando    210 résultats   ← témoin : la requête ramène bien des marques
   dealabs     20 résultats   ← témoin
   veepee      52 résultats   ← témoin
   kazendra     0 résultat    ← en minuscules
   Kazendra     0 résultat
   KAZENDRA     0 résultat    ← et en capitales
   ```

   **Aucune marque « Kazendra » n'est enregistrée** dans les bases interrogées. Les trois témoins
   prouvent que la requête fonctionne : un « 0 » sans témoin ne prouverait rien.

   *Ce que ce résultat ne dit pas* : TMview ne couvre pas les dépôts des tout derniers jours (il
   faut un délai de propagation), ni les noms de société déposés aux registres du commerce, ni un
   usage non enregistré. Il reste donc une **bonne présomption**, pas une certitude juridique.

2. **Déposer une marque.** Décision de B (09/10/2026) : **« toute l'Europe »** → c'est l'**EUIPO**,
   pas le BOIP. Le dossier complet, chiffré et prêt à signer, est dans **`PROTECTION-KAZENDRA.md`**
   (§ 3 pour l'Europe, § 3 bis pour le monde) :
   - **EUIPO — les 27 pays : 1 050 €** pour 3 classes, dix ans *(850 + 50 + 150)*. Couvre 11 des
     12 marchés du site. Relevé du 09/10/2026.
   - **BOIP** (BE, NL, LU) : 352 € — n'est plus le bon choix si l'on vise l'Europe.
   - **Le monde entier n'existe pas.** Le système de Madrid (OMPI) couvre **117 membres / 133 pays**
     en une demande, mais chaque office examine et peut refuser. Émolument de base 653 CHF (701 €)
     + une taxe par pays désigné (Royaume-Uni 395 €, États-Unis 1 482 €, Émirats 4 574 €…).
     Désigner l'UE via Madrid coûte 1 755 € — soit 705 € de plus que l'EUIPO direct : **EUIPO
     d'abord, Madrid ensuite pour AJOUTER des pays hors UE.**
3. **Choisir les classes de Nice.** Pour ce projet, les plus pertinentes sont :
   - **classe 35** — publicité, gestion d'affaires commerciales, services de promotion (le cœur)
   - **classe 42** — services technologiques, logiciels, plateformes en ligne
   - **classe 9** — logiciels, applications téléchargeables (l'APK)
4. **Déposer le logo** comme marque figurative, en plus du mot.

**Prix : RELEVÉS le 09/10/2026** aux deux sources officielles (le dossier complet est dans
`PROTECTION-KAZENDRA.md`) :

| | BOIP (Benelux) | EUIPO (UE 27) |
|---|---|---|
| Taxe de base, 1 classe | **244 €** | **850 €** (électronique ; 1 000 € papier) |
| 2ᵉ classe | + **27 €** | + **50 €** |
| 3ᵉ classe et au-delà | + **81 €** | + **150 €** |
| **Total 3 classes (9+35+42)** | **352 €** | **1 050 €** |
| Renouvellement (10 ans) | àpd **263 €** | **850 €** |

Sources : `boip.int/fr/entrepreneurs/marques/tarifs` (onglet « Enregistrer ») et
`euipo.europa.eu` → *Fees payable direct to EUIPO* — consultées le **09/10/2026**. Tarifs BOIP
**exempts de TVA**. ⚠️ **Correction du 09/10/2026** : le logo **ne se dépose pas dans la même demande**
que le mot — une demande ne peut porter que sur **un seul signe**. Le mot `Kazendra` en **marque
verbale** protège le nom dans toutes ses formes : c'est **lui qu'il faut déposer d'abord**. Le logo
est une **seconde marque** (figurative), donc une seconde demande et une seconde taxe.
**Recommandation : BOIP d'abord** (c'est le marché actuel), EUIPO quand le site s'ouvre aux 27.

**Ce qu'il faut de vous** : le dépôt engage votre identité (personne physique ou société) et un
paiement. Je prépare tout — recherche d'antériorité, libellés de produits et services par classe,
formulaires remplis — vous signez et payez.

**Note honnête :** l'agent que je suis ne peut pas déposer à votre place, et ne doit pas essayer. Un
dépôt fait au mauvais nom serait pire que pas de dépôt du tout.

---

## 5. Promouvoir le site

**DÉCISION DE B, 09/10/2026 : « Oui j'aimerais le promouvoir. »**

Conséquence directe, et elle est mécanique : **le dépôt de marque n'est plus une option, c'est le
préalable.** Un site qu'on ne montre à personne n'attire personne ; un site qu'on montre à tout le
monde attire aussi les gens qui déposent des noms. À partir du moment où la promotion est décidée,
l'ordre n'est plus discutable : **EUIPO d'abord (§ 2 et `PROTECTION-KAZENDRA.md`), promotion ensuite.**

**Séquence retenue :**

1. **Déposer la marque verbale `Kazendra` à l'EUIPO** (1 050 €, 3 classes) — l'antériorité court à la
   **date de dépôt**, pas à l'enregistrement : la protection commence le jour du paiement.
2. **Pendant ce temps, ce qui ne se voit pas et ne coûte rien** : les données structurées schema.org
   sur les offres (le seul prérequis technique encore manquant), les balises de partage (déjà faites).
3. **Après le dépôt** : inscription aux annuaires de bons plans (elle publie le nom, donc jamais
   avant), et le reste de la promotion.

**Le préalable, non négociable** : ne pas promouvoir avant d'avoir déposé la marque (§ 2), pour la
raison écrite juste au-dessus.

**Le second préalable** : il reste un défaut grave dans ce que le site AFFICHE (relevés au check-up
du 08/10) :

- ~~les **prix suédois et polonais sont affichés en euros sans conversion**~~ — ✅ **CORRIGÉ le
  08/10/2026.** Demande de B : « il faut que l'annonce affiche le prix original dans l'annonce et
  l'adapter si ce n'est pas de l'euro. l'Angleterre est aussi concerné. »

  La devise de chaque place de marché a été **relevée, pas supposée**, en lisant la charge des pages
  Amazon (goldbox) : `amazon.co.uk` → `"currencyCode":"GBP"` · `amazon.pl` → `"PLN"` ·
  `amazon.se` → `"currencyIsoCode":"SEK"` · `amazon.de` → `"EUR"`.

  **L'Angleterre était bien concernée** — B avait raison. Mon premier test l'avait écartée à tort :
  le rapport de prix du même produit entre Grande-Bretagne et zone euro vaut 0,994, ce qui semblait
  prouver une monnaie commune. C'était une erreur de méthode : beaucoup de marques affichent le
  **même nombre** dans chaque pays (199 € / £199), donc la comparaison de prix ne peut pas distinguer
  « même monnaie » de « parité de prix ».

  Aujourd'hui : `6 089 kr` · `108,82 zł` · `£153,39` · `34,99 €`. Aucun montant hors zone euro ne
  porte plus le symbole €, et le badge « économise » suit la même monnaie. On ne convertit pas —
  convertir exigerait un cours de change, donc un tiers ou un taux à maintenir.

- un **favori peut afficher une autre offre** que celle enregistrée (359 offres sous un identifiant
  partagé) — ✅ **CORRIGÉ le 08/10/2026.** L'identifiant était la fin du lien encodée puis tronquée à
  14 caractères : deux offres distinctes pouvaient tomber sur le même. Il est désormais une empreinte
  **SHA-1 du lien entier**, et les identifiants déjà en stock sont migrés à chaque collecte. Vérifié
  sur le catalogue publié : **14 274 offres, 0 identifiant partagé** (contre 74 pour 287 offres).

Promouvoir un site qui affichait « économise 24 163 € » sur un article à 600 € aurait détruit sa
crédibilité en une journée. **Les deux défauts sont corrigés.**

Ajouté le 08/10/2026, à la demande de B : dans la portée « Bonnes promos » — le défaut de
l'application —, les annonces s'affichent désormais dans l'**ordre chronologique**, la plus récente en
tête. Mesuré sur le catalogue publié : **0 inversion d'ordre** (contre 486 avant). Le design n'a pas
bougé : seul l'ordre change.

**Ce qui est faisable sans budget et sans compte tiers :**

- `robots.txt` et `sitemap.xml` — ✅ **FAITS le 08/10/2026** (ils répondaient 404). Le plan de site ne
  liste que des pages qui existent réellement, et `/admin/` est écarté des moteurs.
- données structurées **schema.org** (`Product` + `Offer`) sur les pages d'offres : c'est ce qui permet
  aux offres d'apparaître enrichies dans les résultats de recherche.
  **Règle mesurée le 09/10/2026** (doc Google « Product snippet ») : les résultats enrichis produit ne
  prennent en charge que les pages consacrées à **un seul produit** — donc les pages `o/<id>.html` sont
  éligibles, la page d'accueil (qui liste des offres) **non**. À noter aussi, pour ne pas survendre :
  Google précise que ce **n'est pas un facteur de classement** et qu'« il ne garantit pas les résultats
  enrichis, même avec un balisage correct » ; le leader francophone Dealabs ne balise sur son accueil
  que l'organisation (aucun `Product`, aucun `Offer`). Gain réel, mais modeste et gratuit.
  ⚠️ **OBSTACLE MESURÉ le 09/10/2026 (en voulant lancer le chantier)** : les **16 614 pages**
  `docs/o/*.html` portent **toutes** `<meta name="robots" content="noindex, follow">`, et elles **ne
  sont pas** dans le sitemap (13 adresses : l'accueil et les pages légales). **Une page `noindex` n'est
  pas indexée : des données structurées dessus ne s'afficheraient jamais.** Le chantier a donc été
  arrêté avant d'écrire 16 614 fichiers pour rien.
  **Décision qui reste à prendre** : indexer ou non les pages d'offres. Avis rendu : **ne pas indexer
  les 16 614** — ce sont les données brutes des marchands (leurs titres, leurs photos, leurs prix),
  republiées en masse, donc du contenu dupliqué sans valeur ajoutée ; le `noindex` est un choix sain.
  Le vrai levier serait du **contenu propre** (pages éditoriales indexables), pas du balisage.
- `og:image` et balises **Open Graph** — pour que le partage sur les réseaux affiche un aperçu correct
  plutôt qu'un lien nu.
- inscription du site dans les annuaires belges et européens de bons plans.
- le **formulaire d'inscription n'envoie rien** aujourd'hui (`URL_TABLEAU = ''` dans
  `public/inscription.js`) : il faudra la feuille Google + Apps Script décrite dans `INSCRIPTION.md`
  avant de pouvoir constituer une liste d'abonnés à prévenir.

**Ce qui demanderait de l'argent** (publicité payante, affiliation d'influenceurs) : hors de portée
tant qu'une décision de budget n'est pas prise, et je ne peux engager aucune dépense.

---

## 6. Officialiser le site — la partie administrative ✅ PAGES ÉCRITES

**Demande de B (08/10/2026)** : « Il faut aussi faire toute la partie administrative pour officialiser le site. »

**Constat mesuré avant travaux** : `mentions-legales.html`, `confidentialite.html`, `cookies.html`,
`cgu.html`, `robots.txt` et `sitemap.xml` répondaient **tous 404** sur le site publié. Rien n'existait.

**Livré le 08/10/2026 :**

| Fichier | Ce qu'il contient |
|---|---|
| `public/mentions-legales.html` | Éditeur, responsable de publication, hébergeur (GitHub, Inc. / OVH SAS), objet, propriété intellectuelle, transparence sur l'affiliation, prix, responsabilité, droit applicable et voie de médiation |
| `public/confidentialite.html` | RGPD : ce qui est conservé **et où** (tout est sur l'appareil), bases légales, destinataires, transfert hors UE, droits, APD, sécurité |
| `public/cookies.html` | L'absence de cookie **et sa conséquence** : pas de bannière de consentement, car il n'y a rien à consentir |
| `public/cgu.html` | Le site n'est **pas le vendeur** ; primauté du prix affiché chez le marchand ; devise d'origine sans conversion ; usage loyal |
| `public/robots.txt` | Interdit `/admin/`, déclare le plan du site |
| `public/sitemap.xml` | Ne liste **que** des pages qui existent réellement |
| `FICHE-ADMINISTRATIVE.md` | **Le point de passage unique** : tout ce qui doit venir de B, champ par champ |

Les quatre pages ont leur **propre feuille, posée en ligne** (`public/legal.css` via
`bin/inliner-legal.mjs`), pour la même raison que le site : une page d'information dont le contenu
dépend d'un `.css` coupé en chemin ne remplit pas sa fonction. Les liens vers ces pages sont dans le
**pied de page** du site — une mention introuvable ne remplit pas son office.

**Ce qui n'est PAS fait, et pourquoi :**

- **L'identité de l'éditeur n'est pas renseignée.** Nom, adresse, BCE, TVA, e-mail, téléphone sont des
  champs surlignés « à compléter » dans les pages. **Aucune valeur n'a été inventée** — c'est la règle
  du projet, et une épreuve (`tests/legal.test.mjs`) fait **échouer** la suite si un numéro BCE ou une
  adresse e-mail apparaît hors de ces champs.
- ✅ **Les traductions néerlandaise et anglaise sont FAITES (08/10/2026, demande de B)** : les quatre
  pages existent en **trois langues** — douze documents. Chacune porte un sélecteur de langue et
  déclare ses traductions aux moteurs (`hreflang`). Le **pied de page du site suit la langue
  choisie** : les six autres langues de l'interface (de, es, it, pt, pl, sv) mènent à l'anglais, comme
  les liens sortants. Une phrase affirmait que « les autres versions linguistiques n'ont pas encore été
  publiées » : elle était vraie le matin, elle ne l'est plus — corrigée dans les trois langues, et une
  épreuve refuse désormais qu'elle réapparaisse.
- ✅ **L'activité est tranchée (08/10/2026, B)** : « régime fiscal de petite entreprise en personne
  physique ». Les mentions légales sont donc écrites dans cette forme — nom et prénom, pas de raison
  sociale — et la TVA y est déclarée **non assujettie** (franchise de la petite entreprise).
  **Le numéro d'entreprise (BCE) reste obligatoire** et reste à obtenir : la franchise dispense de la
  TVA, pas de l'immatriculation. C'est le dernier champ bloquant.

⚠️ **Tant que l'identité n'est pas renseignée, ces pages sont des MODÈLES.** Les publier ne satisfait pas
les obligations d'information — et le site le dit lui-même en tête de page, plutôt que de laisser
croire le contraire.

---

## Ordre d'exécution proposé

1. **Redirections OVH** (`/ 3`) — gratuit, 10 minutes de votre part, aucun risque.
2. **S'inscrire à la BCE** → obtenir le **numéro d'entreprise**, puis renseigner l'identité
   (`FICHE-ADMINISTRATIVE.md`, § B et § C). C'est ce qui transforme les quatre pages administratives de
   modèles en pages valables. Le régime est déjà tranché : **personne physique**, franchise de la petite
   entreprise, donc **non assujetti à la TVA**.
3. ✅ **Langues des pages légales** : tranché et fait le 08/10/2026 — français, néerlandais, anglais,
   et repli sur l'anglais pour les six autres langues de l'interface.
4. **Recherche d'antériorité « Kazendra »** puis **dépôt de marque** (`/ 2`) — avant toute promotion.
5. **Corrections d'affichage** (`/ 5`) — ✅ **faites toutes les deux** le 08/10/2026 (devises, favoris,
   et l'ordre chronologique des bonnes promos).
6. **Ce qui reste sans budget sur le référencement** (`/ 5`) — `robots.txt` et `sitemap.xml` ✅ faits ;
   restent les **données structurées schema.org** et les balises **Open Graph**.
7. **Amazon Partenaires**, puis Awin et TradeTracker (`/ 4`) — inscriptions en votre nom.
8. **Les tableurs marché** (`/ 1`) — le plus long ; à lancer quand la voie A ou B est tranchée.
9. Promotion proprement dite.

---

## Ce qui a déjà été fait, à ce jour

**08/10/2026**

- Check-up complet de KAZENDRA : `CHECK-UP-KAZENDRA-2026-10-08.md` (à la racine du hub).
- Écran de secours + page de diagnostic navigateur : voir `tests/ecran-de-secours.test.mjs`.
- **Devises** : chaque prix s'affiche dans sa devise d'origine (`6 089 kr`, `108,82 zł`, `£153,39`),
  sans conversion — corrigé, vérifié en ligne.
- **Favoris** : identifiant = empreinte SHA-1 du lien entier, migration des identifiants en stock —
  corrigé, vérifié sur le catalogue publié (14 274 offres, 0 identifiant partagé).
- **Ordre des « bonnes promos »** : chronologique, la plus récente en tête — 0 inversion d'ordre sur le
  catalogue publié (contre 486 avant). Design inchangé, comme demandé.
- **Partie administrative** : quatre pages légales créées **en trois langues** (français, néerlandais,
  anglais — 12 documents), `robots.txt` et `sitemap.xml` publiés, liens dans le pied de page qui suivent
  la langue choisie. Voir `FICHE-ADMINISTRATIVE.md` pour **ce qui reste à fournir de votre côté**.
- Suite de tests : **534 sur 534**. Elle échoue si un numéro d'entreprise ou une adresse e-mail est
  **inventé** dans une page légale, si une section disparaît d'une seule langue, ou si une page
  recommence à affirmer que les autres langues n'existent pas.

**09/10/2026**

- **La France est le 3ᵉ marché.** Base passée de 346 à **609 acteurs** (139 BE + 182 DE + 263 FR + 25
  ajoutés par l'application). Balayage HTTP des 263 acteurs français, puis **passe navigateur** sur les
  pages refusées en HTTP (240 pages, 179 lues, 61 encore refusées) : programmes trouvés **16 → 31**.
  Détail complet dans `NOTES-BASE-FRANCAISE.md`.
- **Le logo ramène à l'accueil** : clic (ou Entrée/Espace) vide la recherche, remet catégorie, marchand,
  tri et portée à zéro, revient en page 1 et remonte l'écran — **sans retélécharger le catalogue**, et
  sans toucher aux préférences (pays, langue, thème, éco de données, favoris).
- **Le partage porte la marque** : chaque partage social mène à `https://kazendra.com/o/<id>.html`, une
  page statique avec la carte de prévisualisation (logo, nom, titre, prix, boutique, photo) et un **vrai
  bouton** « Voir chez {marchand} » vers le même lien affilié — aucune commission perdue. Pas de
  redirection automatique : le robot de prévisualisation suivrait la redirection et afficherait la carte
  du marchand. 15 912 pages publiées (63 Mo), régénérées à chaque collecte ; carte générique de repli pour
  les 1 422 offres sans visuel.
- **APK : la vidéo d'introduction est REMISE, affichée à 90 %** (décision de B, 09/10/2026 : « tu peux
  laisser la vidéo mais elle doit être affichée à 90 pour cent à la place de 80 »). Historique complet,
  parce qu'il explique le code : la vidéo a été construite, puis corrigée **deux fois** — des moments
  noirs (découpés, dernière image prolongée : 2,000 s pile, 0 image noire), puis un cadrage près de deux
  fois trop grand (le contenu d'une `TextureView` est déjà étiré : le facteur y était compté deux fois).
  B a ensuite demandé l'annulation complète (« on va revenir à l'image initiale »), puis est revenu
  dessus. **La leçon retenue, et elle est écrite dans le code : les deux défauts n'ont été vus QUE sur
  son téléphone — donc on MONTRE un aperçu avant de livrer une animation.**
  Réglage actuel : l'**image de B reste visible au fond** (elle comble les bandes, même bokeh, aucune
  couture) et la vidéo est posée dessus, sans son, centrée, à l'échelle
  `largeurÉcran / (largeurVidéo × PART_VISIBLE)`. `PART_VISIBLE` est une **constante unique** dans
  `MainActivity` : 0,90 = 90 % de la largeur visible (1200 × 2133 sur un écran 1080 × 2400, bandes de
  133 px) ; 0,80 = écran couvert (l'ancien cadrage) ; 1,00 = vidéo entière. Le nom affiché reste **1.0**,
  les fichiers s'appellent `kazendra-1.0.apk` / `.aab`, le code interne monte à **11**. Checkpoint de
  l'état livré : `kazendra-1.0-2026-10-09-video-90`. Les états intermédiaires (`-sans-noir`, `-cadrage`,
  `-image-seule`) restent conservés : rien n'est perdu.
- Suite de tests : **580 sur 580**.

**09/10/2026 — plus tard (état lu dans le code, non re-mesuré sur téléphone)**

- **APK, réglage final : la vidéo d'introduction est SEULE, à `PART_VISIBLE = 1.00`** (vidéo entière,
  plus d'image de fond) — l'image de lancement a été retirée, ce sont les bords de l'écran qui prennent
  la couleur de fond `#062F3B` relevée sur la vidéo. `versionCode = 18`, nom affiché toujours `1.0`.
  Dernier checkpoint : `kazendra-1.0-2026-10-09-noir-retire`. Le paragraphe ci-dessus (90 %, image au
  fond) décrit un état intermédiaire de la journée, conservé pour l'historique.

**09/10/2026 — nuit : le catalogue belge perd ses annonces sans promotion — ET LA RÈGLE S'ARRÊTE LÀ**

Demande de B, mot pour mot : *« En Belgique, dans la catégorie meuble je trouve qu'il y a beaucoup
d'annonces sans promotion… peux-tu revérifier ce paramètre ? »*

- **Le paramètre en cause ne filtrait pas.** Les quatre recherches `amazon.com.be` portaient
  `rh=p_n_deal_type=210770357031`. Mesuré, 3 passages cumulés, cartes portant un prix barré :
  **avec** le filtre 17 % · **sans** filtre 29 % · **avec tri par remise 33 %** (« cuisine maison » :
  20 % / 29 % / 34 %). Le filtre donnait donc MOINS de vrais bons plans que pas de filtre du tout.
  Il a été remplacé par `s=discount-desc-rank` sur les quatre recherches. Seule exception :
  `amazon-be-deals`, qui sans mot-clé rend une page **vide** sans son filtre — il le garde, avec le
  tri (mesuré 43 % contre 20 %).
- **591 annonces belges à prix nu sont sorties du catalogue** (aucun prix de référence) : 167 jouets,
  92 maison, 85 autre, 64 bricolage, 48 tech, **43 meubles**, 35 électroménager, 15 mode… Les
  rubriques citées par B, exactement. La règle des deux prix, qui visait déjà les pages d'enseigne,
  s'applique désormais aussi aux recherches Amazon : pour Amazon, l'application n'accepte de toute
  façon un bon plan QUE s'il a deux prix réels. Ce qui reste : meubles 50 offres, **0 sans remise**.
- **⛔ DÉCISION DE B, 09/10/2026 : « Pour l'instant il n'est pas nécessaire d'appliquer la règle. »**
  La règle des deux prix **reste donc limitée** aux pages d'enseigne et aux recherches Amazon. Elle
  n'est **PAS** étendue aux quatre sources communautaires. Leurs **4 513 annonces Amazon sans second
  prix** restent au catalogue : ES 1 015 (chollometro), GB 1 001 (hotukdeals), DE 973 (mydealz),
  FR 616 (dealabs), PL 530, NL 203, AT 175.
  ⚠️ **Ne pas « finir le travail » de sa propre initiative** : c'est une décision, pas un oubli. Il
  faudra une nouvelle demande explicite de B pour l'appliquer.
- **Classement (deux défauts dans un même titre, signalé par B)** : « nivea », la marque, était lue en
  SOUS-CHAÎNE — « 3 niveaux de puissance » réveillait le cosmétique, et une **hotte de cuisine**
  partait en Beauté ; et « hotte » n'était dans aucune liste. « nivea » exige maintenant une frontière
  de mot ; `hotte`, `hotte aspirante`, `hotte de cuisine`, `plaque de cuisson`, `plaque à induction`
  sont entrés en Électroménager. Reclassement rétroactif (le collecteur rejuge tout le stock à chaque
  passage), vérificateur de catégories **conforme**.
- **Partage** : le lien ne s'écrit plus deux fois. Le texte finissait par le lien ET l'adresse était
  donnée à part (`url:` pour la feuille du navigateur, `+ "\n" + url` pour le pont Android) ; le pont
  n'ajoute plus l'adresse que si elle manque. Exercé sur le site en ligne, les deux chemins : **une
  seule occurrence**. Application **code 20**.
- Suite de tests : **606 sur 606** (dont 2 neufs).

**09/10/2026 — même soirée, troisième signalement : une lampe frontale rangée en MODE**

B a envoyé l'offre seule, sans consigne : *« Blukar Lampe Frontale Rechargeable 2 Pack 2000L… 8 Modes
d'éclairage… 20,57 € »* + son lien de partage.

- **Même famille de défaut que la hotte, un cran plus loin.** Le mot FAIBLE `mode` (le rayon des
  vêtements) était lu en sous-chaîne : « 8 **Modes** d'éclairage » le réveillait, et la lampe partait
  en MODE. `mode` exige désormais une **frontière de mot** (MOTS_A_FRONTIERE) : « mode femme » et
  « mode homme » continuent de matcher, « 8 Modes », « modèle », « Moderne », « Modell », « modelli »
  non.
- **Les lampes portatives n'étaient nommées dans aucune rubrique** : les deux offres sœurs du
  catalogue ne devaient leur Sport qu'à « camping » ou « randonnée ». Entrent en **Sport**, dans les
  9 langues : `lampe frontale`, `torche frontale`, `lampe torche`, `lampe de poche` · `headlamp`,
  `head torch`, `flashlight` · `stirnlampe`, `taschenlampe` · `hoofdlamp`, `zaklamp` · `linterna` ·
  `torcia` · `lanterna` · `latarka` · `ficklampa`. ⚠ `lampe` seule reste dehors, à dessein : une
  lampe de table est un objet de maison (vérifié — « Lampe de table design » et « Lampe de chevet »
  ne partent pas en Sport).
- **Effet de bord mesuré, et assumé** : 36 offres changent de rubrique sur 16 456. Vingt-six
  QUITTENT Mode — elles y étaient par accident (« modèle », « Moderne », « Modell », « modelli »),
  dont des articles de presse (Claude Haiku, Skechers, Roborock, un test Motorola) ; dix rejoignent
  une vraie rubrique (4 Sport, 2 Auto pour des casques moto, 1 High-tech…). ⛔ **« Autres » n'a pas
  été touché** : ce que rien ne nomme y tombe, c'est honnête, et la remplir est une décision à part.
- Vérifié après la collecte de 23:55 UTC : la lampe frontale signalée est en **Sport** (comme sa
  jumelle polonaise, qui était en « Autres »). Suite de tests : **607 sur 607** (3 neufs).

**10/10/2026 — quatrième signalement : un article politique dans le catalogue**

B a envoyé une brève et sa question, mot pour mot : *« ”Je démissionne car que je sais que je ne
pourrai plus me donner à 100 %” : le MR propose de réduire le nombre d’échevins — pourquoi ce genre
d'article apparaît ? »*

- **Cause exacte, mesurée** : le filtre des sources de veille acceptait N'IMPORTE QUEL pourcentage
  écrit (`\d+\s?%`). Cet article entrait donc par le « **100 %** » d'une citation — un pourcentage
  d'énergie, pas un prix.
- **Le motif s'arrête désormais à 90 %** — la même borne que l'application à l'écran
  (`REMISE_ANNONCEE_MAX` dans app.js : « au-delà de 90 %, ce n'est plus une remise, c'est une
  qualité qu'on annonce » : 100 % coton, 99 % sRGB, 100 % électrique). Un pourcentage collé à un
  chiffre ou à une virgule ne compte pas non plus (« 1.000 % » ne donne plus « 000 % »).
- **Règle appliquée au STOCK**, comme les deux prix : les brèves déjà engrangées sortent aussi.
  Résultat de la collecte de 00:11 UTC : **9 brèves écartées** (DHnet 4, Gazet van Antwerpen 2,
  Les Numériques 2, Frandroid 1) — l'article de B, un podium « 100 % brugeois », deux faits divers
  anversois, une Hyundai « 100 % électrique », un camping-car « 100 % made in France », une chute
  d'audience « -22,9 % », « 1.000 % sa confiance », une enquête « 55,6 % des 15-24 ans ».
  **Aucun bon plan perdu** : « Até 54% de desconto », « Promo Code … 10% OFF », « top-selling deal …
  $250 off » passent toujours.
- ⚠️ **Limite connue, mesurée, et NON tranchée** : une brève qui annonce « jusqu'à 70 % des dons
  restent invendus » passe encore. La resserrer demanderait qu'un mot de promotion ACCOMPAGNE le
  pourcentage — ce qui se paie en vrais bons plans. Décision à prendre séparément.
- Piège de rubrique découvert en passant : cet article était classé en **Auto**, parce que la
  conjonction française « **car** » (« je démissionne car que je sais ») est un mot anglais de la
  famille Auto. Mesuré : sur 321 offres en Auto, 9 ne tiennent qu'à ce mot, et 8 parlent vraiment
  d'automobile — seul l'article fautif était à tort. **Non corrigé** : le risque de retirer « car »
  ferait plus de dégâts que le défaut qu'il enlève (les brèves concernées sortent maintenant par la
  règle du pourcentage).
- Suite de tests : **608 sur 608** (1 neuf, 10 titres réels).

---

## 10/10/2026 — BOL.COM branché, publié sans commission (décision de B)

Lien donné par B : `https://www.bol.com/be/fr/deals/?cid=…&promo=main_315_deals_B___`

- **Lisible SANS navigateur** : le même `curl` rend **403 sans `--compressed`** et **200 avec**.
  Le lecteur reste donc côté serveur (`fetch`), pas de navigateur à piloter.
- **32 lignes pour 17 produits** — cause exacte mesurée : la clé d'unicité est l'ADRESSE, et
  bol sert le MÊME article sous `/be/fr/p/<slug-fr>/<n°>` et `/be/nl/p/<slug-nl>/<n°>`. Seul le
  NUMÉRO est identique. Correction : `doublonsBol()` garde la ligne **française**, par un tri
  explicite — jamais l'ordre du fichier, sinon le survivant serait décidé au hasard. **15 lignes
  écartées.** La clé `cleDe` n'a PAS été touchée : la changer aurait écrasé une des deux lignes
  AVANT le contrôle, et remis le hasard dans la décision.
- **Règle des DEUX PRIX étendue à bol** : 2 cartes sans prix de référence écartées. 15 offres.
- **Décision explicite de B, mot pour mot** : *« Tu peux le publier sans commission juste pour
  l'utilisateur, on trouvera une solution plus tard pour augmenter la quantité, et crée le lien
  d'affiliation. »*
- **L'enveloppe d'affiliation bol est écrite ET testée**, avec `BOL_SITE_ID` **VIDE**. Tant qu'il est
  vide, les liens sortent EN DIRECT. Trois garde-fous, un test chacun : jamais d'enveloppe vide,
  jamais sur un autre marchand, jamais deux fois. **Il ne reste qu'une ligne à coller.**
- Faits **vérifiés** sur `affiliate.bol.com` (pas supposés) : programme ouvert ; commission jusqu'à
  **8 %** selon la catégorie, et **sur TOUT le panier** ; inscription
  `partner.bol.com/account/registratie/start` ; forme du lien
  `https://partner.bol.com/click/click?p=1&t=url&s=<Site_ID>&f=TXL&url=<adresse>` ; suivi en
  « **dernier clic** » (Last Cookie Counts) ; commission calculée hors TVA et hors port.
  ⚠ bol **peut refuser sans motif**, et refuse en principe un canal « qui ne montre que des articles
  de bol sans valeur ajoutée » — leur FAQ cite explicitement « *vergelijkingen tussen producten* ».
  **C'est donc la comparaison entre marchands qui rendra la candidature défendable.**
- ⛔ **Reste : un Site_ID à coller.** Sans lui : zéro commission, liens directs (état actuel, assumé).
- **Limite annoncée honnêtement** : la page ne rend que **4 produits par rayon** côté serveur ; les 24
  autres rayons passent par `POST /api/graphql`, **refusé de l'extérieur** (400 « InvalidRequest »,
  avec cookies de session comme sans). On tire donc les promotions que bol **met en avant**, pas tout
  son catalogue. C'est écrit dans le commentaire de la source, à l'endroit où on le lira.
- **Résidu mesuré, NON traité** : **une ligne néerlandaise survit seule** (« Garnier … Reinigingswater »,
  source `bol-be-nl` retirée). Son jumeau français n'a jamais été collecté : ce n'est donc **pas** un
  doublon. Effet visible : un titre néerlandais et un lien `/be/nl/` au milieu d'un catalogue français.

## 10/10/2026 — KREFEL branché : site en maintenance, puis vérifié EN DIRECT

Lien donné par B : `https://www.krefel.be/fr/deals-du-moment?currentPage=2`

- ⚠ À 01:15 UTC, krefel.be répondait **HTTP 500 sur TOUTES ses adresses** — accueil, `/fr`, deals FR
  et NL, page produit — avec **sa propre phrase de maintenance** : *« Désolé, notre site internet est
  temporairement indisponible. Nous procédons à d'importantes mises à jour. »* Ce n'était **pas** un
  blocage anti-robot : l'enseigne était fermée. Aucune copie archivée de la page **française**.
- Le lecteur a donc été écrit sur l'**instantané du 09/06/2026** de la page **néerlandaise**
  (24 produits, 68 résultats), et une **sentinelle** posée (`outils/sentinelle-krefel.mjs`, silencieuse
  tant que le site est fermé, parle une seule fois quand il revient).
- **Le site est revenu pendant la séance, et la sentinelle a parlé** : HTTP 200, « 54 résultats », et
  **0 carte reconnue**. Le doute était donc fondé — et la panne aurait été **silencieuse**.
- **Cause exacte, mesurée** : le conteneur des cartes et les marqueurs (`line-through`, `font-bold`)
  n'ont **pas** bougé. Ce qui a changé, c'est **la place de l'euro** : la page NÉERLANDAISE écrit
  `€ 549,00`, la page FRANÇAISE écrit `849,00 €`. Une seule différence d'ordre → **0 offre sur
  24 cartes**, sans erreur ni trace.
- Corrigé : `prixKrefel()` accepte **les deux écritures**. Les épreuves figent désormais des cartes
  réelles **des DEUX pages** (française vivante + néerlandaise archivée).
- Résultat de la collecte de **01:20 UTC** : **27 offres Krefel** (54 résultats annoncés, 3 pages) —
  Whirlpool micro-ondes 94 € au lieu de 189 € (**−50 %**), Tefal bouilloire 34,95 € au lieu de 64,95 €
  (−46 %), LG 65" 699 € au lieu de 1 199 € (−42 %).
- Pagination : `?currentPage=N`, suivie tant qu'elle apporte des produits **nouveaux**, plafonnée à 4
  pages. Repos : 120 min. Le `zéro` est **journalisé avec sa raison** — un zéro silencieux se lirait
  « rien à vendre » au lieu de « lecteur cassé ».
- **Leçon générale, à réutiliser** : ne JAMAIS câbler un lecteur sur un détail de **langue**.
  Chez bol c'était un **libellé** (« Prix conseillé » / « Adviesprijs ») ; chez Krefel c'est la
  **place du symbole monétaire**. Les deux fois, la panne était **silencieuse** : zéro offre, zéro erreur.
- Krefel était déjà connu du collecteur par deux autres entrées (`adr-krefel-120`, page d'adresse sans
  JSON-LD lisible ; `enseigne-be-nl-krefel-krefelpromotie`, flux néerlandais) — **les deux rendent 0**.
- Suite de tests : **630 sur 630** (7 neufs pour Krefel, 5 pour l'enveloppe bol).

---

## 10/10/2026 — TUI (tui.be) : NON BRANCHABLE en l'état, et c'est MESURÉ

Lien donné par B : `https://www.tui.be/fr/tuideals`

Mesures, refaites plusieurs fois plutôt que supposées :

1. `/fr/tuideals` répond **200**, mais c'est une **page-hub** : elle ne contient **aucune offre
   chiffrée**. Texte utile : 5 309 caractères, dont DEUX mentions d'euro — un commentaire HTML
   « *Kolom 2 : Jusqu'à 400 € de réduction* » et une accroche « *400 € par personne* ». Zéro carte
   produit, zéro prix, zéro JSON-LD.
2. **Vérifié AUSSI dans un vrai navigateur** (bannière de cookies acceptée) : le DOM fait 115 Ko,
   contient **0 élément** de type carte/teaser/deal — et surtout **aucune requête vers une API
   d'offres**. Les 138 ressources chargées sont des scripts, des images et du **suivi publicitaire**
   (Adobe/Demdex, Gigya, Google Analytics, Tealium, WAF AWS). **Sans requête d'offres, il n'y a rien
   à rendre** : la page n'est pas « mal lue », elle est vide.
3. Les VRAIES pages d'offres — `/fr/chercher`, `/fr/last-minutes`, `/fr/rss.xml`, `/sitemap.xml` —
   répondent **403 « Access Denied »**, signé **Akamai** (`errors.edgesuite.net`). Refusé à `curl`
   (avec **et** sans compression, la leçon de bol ne s'applique donc pas ici) **et au `fetch` de
   Node**, c'est-à-dire au lecteur du collecteur lui-même. Aucun flux de secours n'existe.

→ **Conclusion : TUI n'est pas branchable avec l'architecture du projet** (lecture côté serveur,
sans clé, sans navigateur). Il faudrait piloter un navigateur en permanence dans le collecteur —
ce n'est pas une correction, c'est un changement d'architecture, et ce n'est pas à cette session
d'en décider.

⚠ **Question éditoriale, à trancher AVANT toute tentative technique** : les prix de TUI sont des
prix « **à partir de** », par personne, **sans prix de référence**. Or la règle des DEUX PRIX du
projet écarte précisément ces cartes (elle a écarté 2 cartes bol et 591 annonces Amazon pour ce
motif). Même si la page devenait lisible, TUI n'apporterait **probablement aucune offre** à
« Bonnes promos » sans changer cette règle-là.

⛔ **Rien n'a été branché. Décision en attente de B.**
