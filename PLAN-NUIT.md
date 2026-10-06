# PLAN DE NUIT — Promos (audit, sources, catégories, traductions)

> Écrit pour une session **neuve**, sans mémoire. LIRE EN ENTIER AVANT D'AGIR.
> Puis suivre le tableau de la section 5 : **une unité par passage**, jamais deux.

## 1. Ce qui est demandé par B (ses mots, dans l'ordre)

1. **Vérifier toute la programmation** du site et de l'application.
2. **Pour chaque pays**, chercher s'il est possible d'intégrer **encore des annonces
   de promotions de qualité**.
3. **Chercher de nouveaux sites** qui peuvent apporter du contenu au site.
4. **Vérifier que chaque produit est dans la bonne catégorie** — les jouets dans la
   bonne rubrique, le bricolage et les autres dans les bonnes rubriques.
5. **La rubrique « Activité » ne doit pas être exclusivement liée à Groupon** dans
   chaque pays : « il doit sûrement y avoir un équivalent qui offre des bonnes
   promotions pour des activités, il faut les trouver et les relier à l'activité
   pour le pays en question ». Chercher : **voyage, concerts, spectacles, loisirs**.
6. **Traductions** : garder le titre d'origine quand il est **lié à une marque**.
   Ne traduire que le **vocabulaire courant** — **jamais** les informations
   **techniques et spécifiques du produit**.
7. Délai : **demain matin**. Travail de qualité, preuves à l'appui.
8. **NOUVEL ONGLET « Électroménager »** (ou « Électro ») pour **TOUS les pays**,
   placé **à côté de High-tech**. On y met « tout ce qui est frigo, aspirateur,
   sèche-cheveux, toute la technologie de ce style ».
9. **Tous les soins de beauté, du corps, les massages et autres soins de
   bien-être** vont dans la catégorie **Beauté**. ⟵ **cela CHANGE la décision
   précédente** qui forçait les pages Groupon en « Activité » : un SOIN n'est pas
   une SORTIE.
10. **Toute annonce contenant « fille », « garçon », « enfant » ou une catégorie
    d'âge d'enfant** doit être rangée dans **Jeux & jouets**.
11. **Les TÉLÉVISIONS restent en HIGH-TECH**, pas en Électroménager. Règle de
    partage à appliquer : ce qui **diffuse ou affiche** une image (téléviseur,
    écran, projecteur, barre de son, enceinte) reste **High-tech** ;
    l'**électroménager** ne prend que les appareils **ménagers** (froid,
    cuisson, lavage, entretien, soin du linge et des cheveux, climatisation).
12. **Les RASOIRS et les TONDEUSES À CHEVEUX vont en Électroménager** (ils
    quittent Beauté). ⚠ **Piège à verrouiller** : en français « tondeuse » seule
    désigne aussi la **tondeuse à GAZON**, qui est du jardin/bricolage — n'y
    accepter que « tondeuse à cheveux / à barbe / à poils », **jamais** la
    tondeuse à gazon. ⚠ Second piège : un **rasoir MANUEL** (lame, jetable) n'est
    pas un appareil — s'il est déplacé vers Électroménager, le **citer dans le
    rapport** plutôt que de le cacher.
13. **Les TONDEUSES À GAZON vont dans le BRICOLAGE.** ⚠ **Conflit MESURÉ dans le
    code, à corriger** : la liste `bricolage` (collecteur.mjs, ligne 681) contient
    aujourd'hui le mot **nu `'tondeuse'`**, qui attraperait aussi la tondeuse à
    **cheveux**. Il doit devenir **`'tondeuse a gazon'`**. Les huit autres langues
    ont déjà leur mot propre et n'ont pas ce défaut : `lawnmower` (en),
    `rasenmaher` (de), `grasmachine` (nl), `cortacesped` (es), `tosaerba` (it),
    `cortador de relva` (pt), `kosiarka` (pl), `grasklippare` (sv).
    **Contrôle obligatoire** : après correction, une « tondeuse à gazon » doit
    être en **bricolage**, une « tondeuse à cheveux » en **Électroménager**.
14. **Contrôler la catégorie « AUTRES »** : « il faut bien vérifier les éléments
    qui sont mis dans cette catégorie afin de vérifier s'ils ne peuvent pas être
    classés dans d'autres qui leur correspondent ». C'est la plus grosse
    rubrique (~20 % des offres) : c'est donc là que se cachent les erreurs, et
    chaque offre qui en sort est un vrai gain.
15. **Les CHAUSSETTES et tout autre VÊTEMENT vont en MODE.** ⚠ **Lacune
    MESURÉE le 6/10** : le mot **`chaussette` n'existe dans AUCUNE table** — sur
    17 offres qui le portent, **6 sont hors de Mode**, dont 4 en « Autres »
    (« Chaussettes Basses Homme Femme 10/20 Paires »). Même trou pour les
    **sous-vêtements** (26 offres, 11 hors Mode : caleçon, boxer, *trunks* —
    « Calvin Klein Men's Trunks » est en « Autres ») et les **accessoires**
    (29 offres, 14 hors Mode : écharpe, casquette, bonnet, gants). À compléter
    dans les **9 langues** : chaussettes, sous-vêtements, écharpe, casquette,
    bonnet, gants, jupe, short, maillot, pyjama, t-shirt, sweat, blouson,
    sandales, claquettes.
    ⚠ **Mots PIÉGEUX, à lire entre deux frontières et à ne pas laisser trancher
    seuls** : **`ceinture`** (vêtement OU ceinture de sécurité → auto, 4 offres
    mesurées), **`gant`** (main OU gant de toilette → maison/beauté), **`montre`**
    (bijou OU montre connectée → high-tech), **`short`** (vêtement OU
    « short-court »), **`slip`** (sous-vêtement OU autre sens selon la langue).
16. **DEUX NOUVEAUX ONGLETS : « MEUBLES » et « NOURRITURE ».**
    - **Meubles** : le mobilier sort de « Maison » (canapé, table, chaise, lit,
      armoire, bureau, étagère, commode, buffet, fauteuil…). Maison garde la
      déco, le linge de maison et le jardin.
    - **Nourriture** : rubrique **entièrement neuve** (alimentation, boissons).
      Elle n'existe pas aujourd'hui — l'audit de « Autres » l'a confirmé :
      *chocolate*, *vodka*, *sauvignon*, *lemonade*, *custard* y sont en vrac.
    Dans les **9 langues**, et déclarés dans l'interface **et** l'ordre des onglets.
17. **LES SOURCES DOIVENT ÊTRE LOCALES AU PAYS.** Ses mots : « un allemand ne va
    pas aller acheter des fraises sur un site internet en Espagne ». Donc, pour
    chaque pays, on cherche les sites **DU pays** (supermarchés, enseignes de
    meubles locales) et on n'affiche que ceux-là. **Règle générale et pas
    seulement pour l'alimentation** : une source étrangère ne remplit pas un
    onglet national.
    ⚠ **Blocage déjà mesuré, à ne pas repayer** : les grandes enseignes
    alimentaires (Colruyt, Delhaize, Lidl, Aldi, Carrefour, Kruidvat, Action)
    publient leurs dépliants en **IMAGE** et en JavaScript → **zéro prix dans le
    HTML**. Il faut chercher ailleurs : **drives** de courses en ligne,
    catalogues web, flux publics. Et appliquer la règle des **deux prix réels** :
    sans deuxième prix, ce n'est pas une promotion.
18. **NOUVEL ONGLET « ANIMAUX »** — nourriture **ET** accessoires pour animaux.
    ⚠ **Distinction à ne pas rater** : la nourriture pour **animaux** va en
    **Animaux**, PAS en « Nourriture » (qui est réservée à l'alimentation
    humaine). Accessoires : panier, litière, laisse, collier, jouet, cage,
    aquarium, niche, arbre à chat.
19. **NOUVEL ONGLET « VOYAGES »** — ⚠ **cela coupe « Activité » en deux** :
    - **Voyages** : vols, hôtels, séjours, city-breaks, croisières, locations.
    - **Activité** garde les **sorties** : concerts, spectacles, loisirs,
      restaurants, zoo, parcs.
20. **POUR LES VOYAGES : UNIQUEMENT LES GROSSES PROMOTIONS.** Ses mots :
    « uniquement prendre les grosses promotions car il y a beaucoup de sites ».
    Donc un **seuil plus élevé que les 15 % habituels** — proposé : **≥ 30 %**,
    à ajuster par la mesure (compter combien d'offres restent à 30 %, 40 %, 50 %,
    et choisir un seuil qui laisse un onglet utile ET peu de déchet).
    ⚠ **Et jamais de faux rabais** : un site de voyage qui n'affiche qu'un prix
    « à partir de » **sans prix de référence** ne produit PAS de promotion — on
    n'invente pas de pourcentage. Mieux vaut un onglet Voyages mince et vrai
    qu'un onglet rempli de remises fabriquées.
21. **NUANCE ACTIVITÉ / VOYAGES — ELLE EST GÉOGRAPHIQUE.** Ses mots exacts :
    « les activités sont à faire dans le pays concerné et les voyages concernent
    des pays à l'étranger ».
    - **Activité** = ce qui se fait **DANS le pays de l'offre** : un spa à
      Bruxelles pour un Belge, un zoo en Espagne pour un Espagnol.
    - **Voyages** = ce qui emmène **À L'ÉTRANGER** : un séjour en Espagne vu
      depuis la Belgique.
    ⚠ **Conséquence, et c'est contre-intuitif** : la MÊME prestation (un hôtel,
    un parc) peut aller dans l'un **ou** l'autre onglet selon la **destination**,
    pas selon le type de produit. Il faut donc un **détecteur de destination** :
    si la destination nommée est un **autre pays** que celui de l'offre →
    **Voyages** ; sinon → **Activité**.
    ⚠ Ce qui reste vrai malgré tout : un **forfait de voyage** (vol, croisière,
    séjour, nuits, location de voiture, aller-retour) va en **Voyages**, même
    quand la destination n'est pas identifiable dans le titre.
    ⚠ **Obligation de mesure** : compter les cas où la destination n'est PAS
    identifiable (ils sont la principale source d'erreur) et **citer les cas
    ambigus** — un hôtel dans le pays de l'offre, un titre sans destination —
    plutôt que de trancher en silence.
22. **ALIMENTATION : DEUX MONDES À NE PAS MÉLANGER.** Ses mots : « tout ce qui
    est nourriture restaurant hamburger, offre promotionnelle autour d'un repas
    doit rester dans **activité**. L'onglet **nourriture** est pour exclusivement
    la nourriture à cuisiner à la maison, nourriture de supermarché, boisson,
    bière, alcool, légumes et fruits. Et toutes les autres catégories de
    nourriture. »
    - **Activité** : le repas **PRIS DEHORS** — restaurant, hamburger, brunch,
      menu, buffet, plat, à emporter, bon repas pour deux.
    - **Nourriture** : le **CABAS** — à cuisiner à la maison, supermarché, fruits
      et légumes, boissons, bière, alcool, épicerie, conserves.
    ⚠ **Piège à prévoir, et il est inévitable** : le même aliment peut être les
    deux. Une **pizza** est **surgelée** (→ Nourriture) ou **au restaurant**
    (→ Activité). Idem pour une bière : pack au supermarché (→ Nourriture) ou
    consommation sur place (→ Activité).
    **Mots qui tranchent** — côté Activité : *restaurant, menu, à emporter, pour
    deux, brunch, buffet, sur place, dégustation* ; côté Nourriture : *lot, pack,
    surgelé, x4, kg, g, litre, bouteille, conserve, supermarché*.
    ⚠ **Conséquence** : une offre de repas ne doit JAMAIS tomber en « Nourriture »
    sur le seul nom d'un plat — il faut la preuve qu'il s'agit d'épicerie.

## 2. Règles de méthode — non négociables

- **Jamais un chiffre sans mesure.** Chaque affirmation chiffrée doit venir d'une
  commande exécutée dans la session.
- **Contrôle positif ET négatif** pour toute sonde réseau (une URL inventée doit
  ressortir vide, sinon la sonde mesure du bruit).
- **Une source n'est câblée que si elle rend la même chose DEUX fois de suite.**
  Mesuré la nuit dernière : Groupon donne 9 puis 0 offres sur la même URL, à trois
  secondes d'intervalle (Pays-Bas, Espagne, Pologne). Une source instable ne se
  branche pas.
- **Ne rien annoncer « fini » sans avoir exercé l'artefact.**
- **Un test rouge = on s'arrête.** On corrige ou on annule (`git checkout`), et on
  ne marque PAS l'unité terminée.
- Politesse réseau : au moins 1 s entre deux requêtes vers un même domaine.

## 3. État de départ (vérifié, pas supposé)

- Dépôt : `/opt/data/webdev/projects/promos` — site public
  `https://billatlantis80.github.io/promos/`, ~9 057 offres, 12 pays.
- **167 tests** dans `bin/tester.sh`. Outils : `outils/verificateur-categories.mjs`,
  `outils/verifier-apk.mjs`, `outils/solidite-rubrique-auto.mjs`.
- **Activité = Belgique seulement**, via `groupon.be` (`SOURCES_ACTIVITES` dans
  `collecteur.mjs`).
- **Pays à catalogue Groupon PROPRE** (mesuré) : BE `fr/landing/sale`,
  FR `bon-plan`, DE `gutscheine`, NL `/`, IT `offerte`, ES `ofertas`,
  PL `oferta`, GB `vouchers`, IE `vouchers`.
- **À NE PAS utiliser** : `groupon.at` et `groupon.se` **redirigent vers
  groupon.de**, `groupon.pt` **vers groupon.es** → aucun catalogue propre ; leur
  attribuer des offres serait faux.
- **Défaut ouvert, non résolu** : la page `groupon.fr/bon-plan` contient 5 remises
  valides (22 %, 58 %, 44 %, 73 %, 17 % — lues une par une) et les cartes ont la
  MÊME forme que les belges, pourtant `offresGroupon()` en tire **0**. À élucider.
- Traductions : dossier de travail = `TRADUCTIONS.md` (spec technique i18n).

## 4. Ce qu'il faut produire au bout du compte

- Un **rapport de vérification** du code : ce qui est solide, ce qui est douteux,
  avec les commandes et leurs sorties.
- Une **liste de sources nouvelles par pays**, chacune avec sa mesure (offres
  retenues, deux relevés), et celles qui sont câblées.
- Une **rubrique Activité par pays**, alimentée par autre chose que Groupon
  lorsque c'est possible.
- Un **contrôle de catégories** sur toutes les offres publiées, avec les cas
  litigieux nommés et corrigés.
- Les **traductions** des 9 langues, mesurées.
- **Site publié + APK** reconstruit et vérifié octet par octet.

## 5. Unités de travail (une par passage, dans cet ordre)

Chaque passage : faire **la prochaine unité** → lancer `bash bin/tester.sh` → commiter → cocher ici.
Si l'unité a été **courte** (moins de ~5 minutes) **et** que tous les tests passent,
**enchaîner sur la suivante** — jamais plus de **deux** par passage, et seulement
si la première est terminée et commitée. Le nombre de passages est limité : les
petites unités ne doivent pas coûter une nuit chacune.

**ORDRE D'EXÉCUTION DES PHASES — à respecter, il n'est PAS l'ordre du fichier :**

> **E → A → B → C → D**

Raison : la phase **E** porte les demandes les plus récentes de B (onglet
Électroménager, soins en Beauté, « enfant/fille/garçon » en jouets) — elles
passent d'abord. La phase **D** (publication et APK) est toujours **en dernier**,
parce qu'elle doit embarquer tout le reste. Si le temps manque, on s'arrête au
milieu de la phase C : l'application reste alors cohérente et publiée, jamais
à moitié modifiée.

**RÈGLE DE SAUVETAGE — à appliquer sans hésiter :** s'il reste **moins de 3
passages** avant 05:45 UTC (07:45 heure belge), **sauter directement à la phase
D** (publication + APK) même si C n'est pas finie. Mieux vaut livrer un site
publié et un APK **vérifié**, avec des traductions partielles — le rapport le
dira —, que de n'avoir rien publié du tout. Une unité non finie reste cochée
« à faire » : on ne ment jamais sur l'avancement.

### Phase A — AUDIT ET CATÉGORIES
| # | Unité | État |
|---|-------|------|
| A1 | Audit du code : lancer `bin/tester.sh`, `outils/verificateur-categories.mjs`, `outils/solidite-rubrique-auto.mjs`, `node outils/verifier-apk.mjs` ; consigner chaque avertissement sans rien corriger | à faire |
| A2 | Répartition par famille ET par pays sur les données publiées ; lister les offres **sans preuve** (ni source ni titre) | à faire |
| A3 | Vérifier **jouets** : toutes les offres de la rubrique, citer celles qui n'y ont pas leur place et l'inverse | à faire |
| A4 | Vérifier **bricolage** : idem | à faire |
| A5 | Vérifier les autres rubriques (tech, maison, mode, beauté, sport, auto) : contradictions source/titre | à faire |
| A6 | Corriger **uniquement** les faux positifs démontrés (mot à frontière, mot trompeur, produit nommé) ; re-mesurer | à faire |
| A7 | **AUDIT DE « AUTRES »** — outil prêt : `node outils/audit-autres.mjs` (lister les mots fréquents absents de toutes nos tables). **Constats MESURÉS le 6/10 à 20h50** (1 876 offres en « autres », soit 20,4 % de 9 191) : (a) une **grande part sont des pages de CODES PROMO**, pas des produits — `code`/`codes`/`rabatt`/`gutschein`/`descuento`/`sconto`/`desconto`/`korting`/`promocja`/`voucher` ; il faut décider si elles ont leur place ; (b) des **articles de presse** (« Actualité : Prime Day… », « Die fünf besten Angebote ») ; (c) de **vrais produits dont le mot manque** — « PHILIPS Sonicare … tandborsthuvude » (tête de brosse à dents, **sv**) → Beauté ; « Braun Series 7 72-G7200CC » (**rasoir**) → Électroménager ; « Philips 8000 Series DST8040/30 » (fer à repasser) → Électroménager ; (d) des **domaines sans rubrique du tout** : alimentation (chocolate, vodka, sauvignon, lemonade), musique/vinyle, **voyage (hotel → Activité !)** ; (e) **marque manquante confirmée : `bosch` absent de `MARQUES.bricolage`** — à ajouter et à mesurer. **Méthode** : traiter par lots de 40 offres, corriger la table, re-mesurer le taux de « autres » ; ne jamais vider « Autres » de force — une offre sans preuve n'a rien à faire ailleurs | à faire |
| A8 | **VÊTEMENTS → MODE** (demande explicite de B). Compléter les tables dans les **9 langues** : **`chaussette` (absent, mesuré !)**, `calecon`/`boxer`/`trunks`, `echarpe`, `casquette`, `bonnet`, `gants`, `jupe`, `short`, `maillot`, `pyjama`, `t-shirt`, `sweat`, `blouson`, `sandales`, `claquettes`. Outil de mesure : `node outils/audit-vetements.mjs`. **Contrôle obligatoire** : relancer l'outil et vérifier que la colonne « ailleurs » tombe à ~0 pour les chaussettes et les sous-vêtements. ⚠ **Mots piégeux à ne pas laisser trancher seuls** : `ceinture` (auto : ceinture de sécurité), `gant` (gant de toilette), `montre` (montre connectée → high-tech), `short`, `slip` | à faire |

### Phase B — SOURCES ET ACTIVITÉ
| # | Unité | État |
|---|-------|------|
| B1 | Élucider le **zéro français** de `offresGroupon()` : rejouer le lecteur étape par étape, trouver la ligne qui jette les cartes | à faire |
| B2 | **Stabiliser** la lecture Groupon (en-têtes, cadence) ; viser 2 relevés identiques par pays | à faire |
| B3 | Chercher des **plateformes d'ACTIVITÉS** autres que Groupon, par pays (voyage, concerts, spectacles, loisirs) avec leurs deux prix | à faire |
| B4 | Chercher d'autres **sources d'annonces** par pays (enseignes, comparateurs, flux publics) — au moins 3 nouvelles pistes mesurées | à faire |
| B5 | Câbler les sources **prouvées stables** ; `SOURCES_ACTIVITES` doit couvrir plusieurs pays | à faire |
| B6 | Recollecter, publier, mesurer la répartition par pays et par rubrique | à faire |
| B7 | **Sources MEUBLES, par pays, LOCALES.** Chercher les enseignes d'ameublement **du pays** (pas de source étrangère). Pour chacune : sonde avec contrôle positif ET négatif, puis **deux relevés** qui rendent la même chose avant tout câblage. Objectif : au moins **3 pays** avec des meubles à deux prix réels | à faire |
| B8 | **Sources NOURRITURE, par pays, LOCALES.** Règle de B : « un Allemand ne va pas acheter des fraises sur un site en Espagne ». ⚠ **Blocage déjà payé, à ne pas refaire** : Colruyt, Delhaize, Lidl, Aldi, Carrefour, Kruidvat, Action → dépliants en **image** + JS, **zéro prix dans le HTML**. Chercher du côté des **drives de courses en ligne**, catalogues web et flux publics. Ne câbler que le prouvé (deux prix réels, deux relevés identiques) | à faire |
| B9 | Recollecter et **mesurer la couverture par pays** des nouvelles rubriques : pour chaque pays, combien d'offres Meubles et Nourriture. Nommer les pays **vides** au lieu de les passer sous silence | à faire |
| B10 | **Sources ANIMAUX, par pays, LOCALES** : animaleries en ligne du pays — nourriture ET accessoires (croquettes, litière, laisse, collier, panier, aquarium, niche). Deux prix réels, deux relevés identiques avant câblage | à faire |
| B11 | **Sources VOYAGES — trouver une SOLUTION**, pas juste un site. Contrainte de B : « uniquement prendre les grosses promotions car il y a beaucoup de sites ». Donc : (a) **seuil élevé** (≥ 30 %, à valider par la mesure) ; (b) **ne jamais fabriquer un pourcentage** sur un prix « à partir de » sans prix de référence ; (c) sonder les sites de voyage ET les comparateurs **du pays**. Rapporter ce qui marche **et ce qui ne marche pas**, avec les mesures | à faire |
| B12 | Mesurer la **couverture Animaux + Voyages par pays** et **nommer les pays vides** ; ne pas déguiser un onglet presque vide en succès | à faire |

### Phase C — TRADUCTIONS (détail dans `TRADUCTIONS.md`)
| # | Unité | État |
|---|-------|------|
| C1 | Moteur i18n + `fr` (`public/langues.js`, parcours du DOM, `localStorage`) | à faire |
| C2 | Sélecteur de langue dans Réglages + `document.documentElement.lang` | à faire |
| C3 | Tests d'inventaire (parité des clés entre langues) | à faire |
| C4 | `nl` (Belgique : fr + nl obligatoires) | à faire |
| C5 | `de` | à faire |
| C6 | `en` | à faire |
| C7 | `es` | à faire |
| C8 | `it` | à faire |
| C9 | `pt` | à faire |
| C10 | `pl` | à faire |
| C11 | `sv` | à faire |
| C12 | Mesure honnête du reste en français, par langue, cas cités | à faire |

### Phase E — DEMANDES DU 6 OCTOBRE AU SOIR (priorité haute)
| # | Unité | État |
|---|-------|------|
| E1 | Créer la rubrique **Électroménager** pour TOUS les pays : sortir de « Maison » les APPAREILS (frigo, congélateur, lave-linge, lave-vaisselle, sèche-linge, aspirateur, cafetière, machine à café, micro-ondes, bouilloire, grille-pain, friteuse sans huile, sèche-cheveux, lisseur, fer à repasser, rasoir électrique, tondeuse à cheveux / à barbe / à poils (⚠ **PAS** la tondeuse à gazon, qui est du jardin), ventilateur, chauffage, purificateur…) en **9 langues** ; déclarer la rubrique dans l'interface **et** dans l'ordre des onglets. ⚠ **NE PAS DÉPLACER** : téléviseur, écran, projecteur, barre de son, enceinte, casque, ordinateur, téléphone, console — ils **restent en High-tech** (demande explicite de B : « Les télévisions doivent être dans high-tech, pas dans électro »). Un **test dédié** doit vérifier qu'une télé reste en High-tech et qu'un frigo va en Électroménager. ⚠ **Défauts MESURÉS dans le code, à corriger dans cette unité** : (a) `bricolage` contient le mot **nu** `'tondeuse'` (l. 681) → le remplacer par `'tondeuse a gazon'`, sinon une tondeuse à cheveux part au jardin ; (b) `beaute` contient `'rasoir'` et `'tondeuse barbe'` (l. 839) → à déplacer vers Électroménager ; (c) `maison` contient `'electromenager'`, `'aspirateur'`, `'cafetiere'`, `'frigo'`, `'lave-linge'`, `'lave-vaisselle'`, `'seche-linge'`, `'refrigerateur'`, `'micro-ondes'`, `'bouilloire'`, `'purificateur'`, `'ventilateur'`, `'chauffage'`, `'robot'` (l. 701) → à déplacer vers la nouvelle rubrique, **en conservant `maison` pour le mobilier, la literie, la déco et le jardin**. Contrôles obligatoires : télé → High-tech ; frigo → Électroménager ; **tondeuse à gazon → bricolage** ; **tondeuse à cheveux → Électroménager** | **fait** (610 offres ; 650 reclassées ; contrôles mesurés OK) |
| E2 | Ordre des onglets à mettre à jour partout : `Tout > High-tech > Électroménager > Meubles > Maison > Mode > Auto & moto > Jeux & jouets > Sport > Bricolage > Beauté > Nourriture > Animaux > Voyages > Activité > Autres` | **fait** (public/app.js : `ORDRE_CATEGORIES` réécrit, `NOMS_CATEGORIES` complété avec Meubles/Nourriture/Animaux/Voyages ; ordre rendu mesuré identique à la cible ; 169/169 tests) |
| E3 | **Soins → Beauté** : les soins de beauté, du corps, les massages et soins de bien-être vont en **Beauté**, plus en Activité. Défaire le `categorieImposee: 'activite'` là où la page est un SOIN ; **garder Activité pour les SORTIES** (concerts, spectacles, loisirs, restaurants, zoo, montgolfière) — ⚠ **et les offres de REPAS pris dehors** (restaurant, hamburger, brunch, menu, buffet, à emporter) restent en **Activité**, jamais en « Nourriture » (point 22) — ⚠ **le VOYAGE part désormais dans le nouvel onglet VOYAGES** (unité E8). Mesurer l'effet avant/après et citer les cas limites | **fait** (classerOffre découpe les SOINS d'une page imposée « activité » → Beauté : table `MOTS_SOIN` en 9 langues + `estSoin()`, branchement de la collecte sur `classerOffre` ; 3 tests Groupon mis à jour, 2 ajoutés ; **mesuré** sur les données publiées : Activité 72→43, Beauté 393→422, **29 offres** basculées ; repas pris dehors et sorties conservés en Activité ; cas limites cités au rapport) |
| E4 | **fille / garçon / enfant / catégories d'âge → Jeux & jouets** (9 langues). Implémenter, PUIS **mesurer la casse** : compter les offres déplacées et **citer nommément** celles où c'est discutable (ex. « siège auto enfant », « vélo enfant », « montre enfant »). Si une famille d'appareil nommé est plus précise, le DIRE dans le rapport — B tranchera | **fait** (mots d'enfant des 9 langues en MOTS_FORTS.jouets + `MOTS_A_FRONTIERE` ; plage d'âge bornée à 14 ans via `ageEnfant()` ; `MOTS_TROMPEURS` complété des collisions mesurées. **Mesuré cette session** sur les 9 397 offres publiées : 96 offres changent de rubrique — **93 vers jouets** (34 bricolage, 24 tech, 13 maison, 13 mode, 4 beauté, 3 sport, 1 électroménager, 1 autre) et 3 HORS de jouets (2 faux positifs corrigés `schildpad`/`borstschild`, 1 effet de bord `Traceur GPS Voiture` auto→tech). **14 offres** portant un mot d'enfant restent hors jouets — appareil nommé plus long — citées une par une par `outils/mesure-enfant.mjs`. 5 tests dédiés, 174/174 tests, vérificateur CONFORME) |
| E5 | Recollecter, publier, vérifier la répartition par rubrique (chaque nouveau compteur doit être justifié par une preuve) | **fait** (outil neuf `outils/mesure-repartition.mjs` : compte global, matrice par pays, rubriques à zéro NOMMÉES, 5 exemples de preuve par rubrique. **Mesuré** sur le site publié du **2026-10-06 23:15 UTC**, **9 427 offres**, 0 sans rubrique : High-tech 3 212 · Électroménager **618** (justifié, ex. cités : Lefant M3 Max, Breville Halo Flexi Air Fryer, roborock F25 BX) · Maison 735 · Mode 607 · Auto & moto 177 · Jeux & jouets 770 · Sport 313 · Bricolage 594 · Beauté 424 · Activité 43 · Autres 1 934 (20,5 %). **Meubles / Nourriture / Animaux / Voyages = 0** : les onglets sont déclarés (E2) mais les rubriques sont vides tant que E6/E8 ne sont pas faites — dit, pas tu. Répartition par pays mesurée pour les 12 pays ; **pays vides nommés** (Activité absente dans 10 pays sur 12 : seule la Belgique 38 et les Pays-Bas 5 en ont). Recollecte/publier : assurés en continu par `bin/collecter.sh` (dernier passage 23:15, 57 sources, **0 en échec**, `git rev-parse HEAD = origin/main`). ⚠ **Anomalies vues à la mesure, à traiter en A5/A6** (citées, pas corrigées ici) : « Philips Recortadora de barba series 7000 » en **Sport** ; « 75 % DESCUENTO EN ACCIONA IKEA JEREZ » en **Auto & moto** ; « Beler Kit de broderie 3 pièces » en **Bricolage** ; « Pampers Sensitive billendoekjes » (lingettes bébé) en **Jeux & jouets**. 174/174 tests) |
| E6 | Créer les rubriques **MEUBLES** et **NOURRITURE** dans les **9 langues**. Meubles : canapé, table, chaise, lit, armoire, bureau, étagère, commode, fauteuil, buffet, matelas ? (⚠ le matelas reste en **Maison/Literie** — c'est du linge de lit, pas du mobilier). Nourriture : **ÉPICERIE, CABAS SEULEMENT** (point 22) — alimentation à cuisiner, supermarché, fruits, légumes, boissons, bière, alcool, vin, café, thé, biscuits, céréales, conserves. ⚠ **Jamais les repas pris dehors** : restaurant, hamburger, brunch, menu, buffet, à emporter restent en **Activité**. Une offre de repas ne tombe en Nourriture que si le titre **prouve l'épicerie** (lot, pack, surgelé, x4, kg, litre, bouteille, conserve). Sortir le mobilier de `maison` **sans toucher** à la déco, la literie et le jardin. Déclarer dans l'interface **et** l'ordre des onglets (E2) | à faire |
| E7 | **Contrôle des deux nouvelles rubriques** : compter les offres de chacune et **citer 5 exemples** par rubrique ; vérifier qu'aucun meuble n'est resté en Maison et qu'aucun aliment ne traîne en « Autres », **et qu'aucun REPAS pris dehors** (restaurant, hamburger, brunch, menu, à emporter) n'est tombé en « Nourriture » — il doit être en **Activité**. Mesurer la baisse du taux de « Autres » avec `node outils/audit-autres.mjs` | à faire |
| E8 | Créer les rubriques **ANIMAUX** et **VOYAGES** dans les **9 langues**. Animaux : chien, chat, croquettes, pâtée, litière, laisse, collier, panier, aquarium, niche, arbre à chat, animalerie, rongeur, oiseau, poisson. Voyages : vol, billet d'avion, hôtel, séjour, location, croisière, week-end, city-break, location de voiture. ⚠ **Le partage ACTIVITÉ / VOYAGES est GÉOGRAPHIQUE (point 21)** : prestation **dans le pays de l'offre** → **Activité** ; destination dans un **AUTRE pays** → **Voyages**. Il faut donc un **détecteur de destination** (noms de pays et de villes, 9 langues) comparable au champ `pays` de l'offre — **la même prestation change d'onglet selon la destination**. ⚠ La nourriture **ANIMALE** va en **Animaux**, jamais en « Nourriture » (réservée à l'alimentation humaine). Déclarer dans l'interface **et** l'ordre des onglets (E2) | à faire |
| E9 | **Contrôle Animaux + Voyages** : compte et **5 exemples** par rubrique ; vérifier qu'aucun produit animalier n'est tombé en « Nourriture » et qu'aucune offre de voyage n'est restée en **Activité** ; mesurer la baisse de « Autres ». Pour **Voyages**, **mesurer la distribution des remises** (combien à ≥ 30 %, ≥ 40 %, ≥ 50 %) et **proposer le seuil** qui garde l'onglet utile sans déchet — le rapporter à B. ⚠ **Partage géographique (point 21)** : compter les offres dont la **destination n'est PAS identifiable** (principal gisement d'erreurs) et **citer les cas ambigus** — un hôtel situé dans le pays de l'offre, un titre sans destination. Nommer ces cas au lieu de les taire | à faire |

### Phase D — LIVRAISON
| # | Unité | État |
|---|-------|------|
| D1 | Publier (`bash bin/collecter.sh`), vérifier `git rev-parse HEAD origin/main` | à faire |
| D2 | Reconstruire l'APK (`preparer-promos.sh`, `compiler-promos.sh`, `signer-promos.sh`), vérifier octet par octet, signature `f15debc…` conservée | à faire |
| D3 | Rapport du matin à B (fait par une tâche séparée, 08:00) | à faire |

## 6. Sur les titres d'offres (décision de B, à respecter)

- On **garde le titre d'origine** quand il est lié à une **marque**.
- On ne traduit **que le vocabulaire courant**.
- On ne touche **jamais** aux **informations techniques et spécifiques** du produit
  (références, capacités, unités, modèles).
- Conséquence pratique : la traduction des titres est **prudente et partielle**.
  Un titre est laissé intact dès qu'un doute existe. **L'interface, elle, est
  traduite intégralement** — c'est la partie certaine.
