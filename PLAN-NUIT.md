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

Chaque passage : faire l'unité → lancer `bash bin/tester.sh` → commiter → cocher ici.

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
| E1 | Créer la rubrique **Électroménager** pour TOUS les pays : sortir de « Maison » les APPAREILS (frigo, congélateur, lave-linge, lave-vaisselle, sèche-linge, aspirateur, cafetière, machine à café, micro-ondes, bouilloire, grille-pain, friteuse sans huile, sèche-cheveux, lisseur, fer à repasser, rasoir électrique, tondeuse à cheveux / à barbe / à poils (⚠ **PAS** la tondeuse à gazon, qui est du jardin), ventilateur, chauffage, purificateur…) en **9 langues** ; déclarer la rubrique dans l'interface **et** dans l'ordre des onglets. ⚠ **NE PAS DÉPLACER** : téléviseur, écran, projecteur, barre de son, enceinte, casque, ordinateur, téléphone, console — ils **restent en High-tech** (demande explicite de B : « Les télévisions doivent être dans high-tech, pas dans électro »). Un **test dédié** doit vérifier qu'une télé reste en High-tech et qu'un frigo va en Électroménager. ⚠ **Défauts MESURÉS dans le code, à corriger dans cette unité** : (a) `bricolage` contient le mot **nu** `'tondeuse'` (l. 681) → le remplacer par `'tondeuse a gazon'`, sinon une tondeuse à cheveux part au jardin ; (b) `beaute` contient `'rasoir'` et `'tondeuse barbe'` (l. 839) → à déplacer vers Électroménager ; (c) `maison` contient `'electromenager'`, `'aspirateur'`, `'cafetiere'`, `'frigo'`, `'lave-linge'`, `'lave-vaisselle'`, `'seche-linge'`, `'refrigerateur'`, `'micro-ondes'`, `'bouilloire'`, `'purificateur'`, `'ventilateur'`, `'chauffage'`, `'robot'` (l. 701) → à déplacer vers la nouvelle rubrique, **en conservant `maison` pour le mobilier, la literie, la déco et le jardin**. Contrôles obligatoires : télé → High-tech ; frigo → Électroménager ; **tondeuse à gazon → bricolage** ; **tondeuse à cheveux → Électroménager** | à faire |
| E2 | Ordre des onglets à mettre à jour partout : `Tout > High-tech > Électroménager > Maison > Mode > Auto & moto > Jeux & jouets > Sport > Bricolage > Beauté > Activité > Autres` | à faire |
| E3 | **Soins → Beauté** : les soins de beauté, du corps, les massages et soins de bien-être vont en **Beauté**, plus en Activité. Défaire le `categorieImposee: 'activite'` là où la page est un SOIN ; **garder Activité pour les SORTIES** (voyage, concerts, spectacles, loisirs, restaurants, zoo, montgolfière). Mesurer l'effet avant/après et citer les cas limites | à faire |
| E4 | **fille / garçon / enfant / catégories d'âge → Jeux & jouets** (9 langues). Implémenter, PUIS **mesurer la casse** : compter les offres déplacées et **citer nommément** celles où c'est discutable (ex. « siège auto enfant », « vélo enfant », « montre enfant »). Si une famille d'appareil nommé est plus précise, le DIRE dans le rapport — B tranchera | à faire |
| E5 | Recollecter, publier, vérifier la répartition par rubrique (chaque nouveau compteur doit être justifié par une preuve) | à faire |

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
