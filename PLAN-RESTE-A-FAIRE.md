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

## 4. Créer les affiliations — la liste est déjà mesurée, il reste à s'inscrire

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

2. **Déposer une marque.** Deux voies :
   - **BOIP (Benelux)** — couvre BE, NL, LU. Le moins cher, le plus rapide, et suffisant pour
     commencer (c'est votre marché).
   - **EUIPO (UE)** — couvre les 27. Plus cher, à envisager quand le site s'ouvre vraiment aux
     11 pays.
3. **Choisir les classes de Nice.** Pour ce projet, les plus pertinentes sont :
   - **classe 35** — publicité, gestion d'affaires commerciales, services de promotion (le cœur)
   - **classe 42** — services technologiques, logiciels, plateformes en ligne
   - **classe 9** — logiciels, applications téléchargeables (l'APK)
4. **Déposer le logo** comme marque figurative, en plus du mot.

**Prix : NON VÉRIFIÉ.** Je n'écris pas de montant que je n'ai pas lu sur le site officiel — les tarifs
BOIP et EUIPO ont plusieurs grilles (dépôt électronique ou papier, nombre de classes, enregistrement
en plusieurs fois). Je les relèverai au moment de préparer le dossier, avec la date de consultation.

**Ce qu'il faut de vous** : le dépôt engage votre identité (personne physique ou société) et un
paiement. Je prépare tout — recherche d'antériorité, libellés de produits et services par classe,
formulaires remplis — vous signez et payez.

**Note honnête :** l'agent que je suis ne peut pas déposer à votre place, et ne doit pas essayer. Un
dépôt fait au mauvais nom serait pire que pas de dépôt du tout.

---

## 5. Promouvoir le site

**Le préalable, non négociable** : ne pas promouvoir avant d'avoir déposé la marque (§ 2). Promouvoir
un nom non protégé, c'est inviter le dépôt par un tiers.

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
