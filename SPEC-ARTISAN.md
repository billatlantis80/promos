# SPEC — Porte `/artisan`

Ouverte le 25/10/2026. Compagnon de `PLAN-HUB-SEPT-SERVICES.md` (décisions 23, 24, 25, 34, 35),
`SPEC-EMPLOI.md` et `SPEC-ANNONCE.md`.

**Décisions déjà prises, qu'on ne rediscute pas :** huitième porte « Artisans & services » (décision 23) ·
**79 € HTVA pour 365 jours**, une seule facture, aucun abonnement (décision 24) · **pré-modération avant
publication** — un faux plombier entre chez les gens · **aucune certification du savoir-faire** · **ni avis
ni note au départ**.

---

## 1. Ce que la porte fait — trois mécaniques, pas une

| | |
|---|---|
| **Publie** | une **entreprise** (artisan, indépendant, société de services) au **numéro BCE vérifié à la main** |
| **Cherche** | tout le monde, **sans compte** : par métier et par commune |
| **Fiche** | une page qui dure **365 jours** — ce n'est pas une annonce de 30 jours |
| **Devis** | une demande qui **compose un courriel** vers le professionnel, sans rien stocker |
| **Appelle** | un numéro **professionnel** publié, assemblé au clic |
| **Montre** | un **logo**, ou à défaut **une photo de l'entreprise** — jamais rien d'autre à sa place |
| **Ne fait pas** | aucun avis, aucune note, aucune certification, aucun paiement entre particuliers |

**Ce que la porte vend, c'est une durée et une vérification, pas une compétence.** La distinction est le
cœur du cadrage : on vérifie un numéro d'entreprise, on affiche ce que le professionnel déclare, et on
écrit noir sur blanc qu'on ne garantit pas son savoir-faire.

## 2. Le téléphone — une exception assumée à la décision 25

La décision 25 dit : « contact par messagerie uniquement sur `/annonce` : aucun numéro de téléphone n'est
publié, même en option ». Le plan de cette porte, lui, liste **« appeler »** dans ses actions. Les deux ne
peuvent pas coexister sans le dire.

**Tranché : le numéro professionnel est publié.** Trois raisons, et une portée limitée :

1. **C'est le service.** Une fuite d'eau à 22 h ne se règle pas par messagerie. Un annuaire d'artisans
   sans téléphone n'est pas un annuaire, c'est une brochure ;
2. **ce n'est pas un numéro privé** : c'est celui que le professionnel affiche déjà sur sa camionnette, sa
   vitrine et ses cartes. La décision 25 protège les **particuliers** — un senior qui vend un vélo, un
   étudiant qui garde un chat. Elle ne protège pas une entreprise qui vit de son numéro ;
3. **il est déclaré** : le professionnel déclare au dépôt qu'il est autorisé à publier ce numéro, et que
   c'est un numéro professionnel. Déclaration horodatée, conservée avec la fiche.

**Et les mêmes protections que l'adresse d'`/emploi`** : jamais dans le HTML servi (assemblé au clic depuis
deux attributs), affiché lisible pour un humain, effacé avec la fiche, retrait sur simple demande. Le
numéro n'est **jamais** un mobile personnel de salarié : la modération refuse un numéro au nom d'une
personne physique si la fiche est au nom d'une société.

## 3. La demande de devis — un formulaire qui écrit un courriel

Même mécanique que `/emploi` (décision 35), transposée à un besoin plus structuré.

- **Champs** : type de travaux (liste fermée issue des métiers de la fiche), commune, délai souhaité,
  description libre (1 000 caractères), et la mention « vous pouvez joindre des photos dans votre
  courriel » — **jamais** de champ de dépôt de fichier.
- **Qui reçoit** : **l'adresse que le compte a déclarée**, personnelle ou professionnelle — c'est son
  choix, pas le nôtre (décidé par l'utilisateur le 26/10/2026). Kazendra ne demande pas une seconde
  adresse « professionnelle » : un indépendant qui travaille depuis chez lui reçoit ses chantiers sur sa
  boîte personnelle, et c'est très bien ainsi. L'adresse **n'est jamais dans la page servie** : elle sort
  au clic par `GET /api/artisan/fiches/:id/courriel`, sous la même condition que le numéro (fiche
  publiée, non expirée, non retirée).
- **Ce que ça produit** : un courriel pré-rempli (objet = « Demande de devis — <métier> — <commune> »),
  corps structuré et modifiable, envoyé depuis la boîte du visiteur.
- **Ce que ça ne produit pas** : aucune demande enregistrée, aucun fichier, aucune donnée de visiteur, et
  **aucun compteur de demandes** — on ne peut pas compter ce qu'on ne reçoit pas.
- **Pourquoi pas de stockage** : une demande de devis contient une adresse, une description de logement et
  parfois des photos d'intérieur. C'est exactement ce qu'une porte ne doit pas garder si elle n'en a pas
  besoin. Le professionnel reçoit, il répond ; la plateforme n'est pas dans le fil.

**Conséquence écrite** : les deux boutons « Demander un devis » et « Appeler » sont les seules actions de
la fiche, et **aucune des deux ne passe par Kazendra**.

## 4. Photos de réalisations — 0 à 12, jamais obligatoires

- **Aucune photo obligatoire** (décision 29) : une fiche sans photo s'affiche entière et digne, jamais de
  cadre vide ni de mention « sans photo ».
- **0 à 12 photos**, parce que c'est le seul argument de vente d'un artisan — mais douze, c'est déjà un
  portfolio, et au-delà la fiche devient une galerie qu'on ne charge pas.
- **Droit à l'image d'autrui** : une photo de réalisation montre souvent l'intérieur de quelqu'un. Le
  professionnel **déclare** qu'il dispose de l'accord des personnes dont le logement est photographié.
  La déclaration est horodatée. Ce n'est pas une formalité : publier l'intérieur d'un client sans son
  accord est une atteinte à sa vie privée, et il n'y a personne chez Kazendra pour le vérifier.
- **Aucune photo de personne identifiable** (client, salarié, enfant) : refus en modération, motif écrit.
- Les photos sont **servies depuis la machine** (aucun hébergement tiers), et supprimées avec la fiche.

## 4 bis. L'image de marque — un logo, ou une photo d'entreprise à défaut

Règle de l'utilisateur : « *Les entreprises doivent pouvoir rajouter un logo ou une photo d'entreprise
si ils n'ont pas de logo.* » Elle complète la décision du 24/10 sur le logo d'agence d'`/immo` (§ 6) et
la généralise : **une image de marque par compte professionnel, valable sur toutes les portes.**

- **Un seul emplacement, deux provenances** : le **logo** s'il existe, sinon **une photo de
  l'entreprise** — façade, atelier, camionnette, vitrine. Jamais les deux, jamais un troisième choix :
  le visiteur doit reconnaître l'entreprise, pas décoder un dossier d'images.
- **C'est le compte qui porte l'image, pas la fiche.** Elle est déposée une fois, et sert sur la fiche
  `/artisan`, dans le bloc vendeur d'`/immo`, sur l'offre d'`/emploi`, l'événement d'`/evenement` et
  l'annonce d'`/job-etudiant`. C'est la conséquence directe du compte unique, et c'est ce qui évite au
  professionnel de redéposer son logo cinq fois.
- **Facultative, jamais un cadre vide** (décision 29) : une fiche sans image **réserve la place** dans
  la colonne et la laisse **blanche**. Pas de cadre, pas de fond, pas de « sans photo » — un cadre
  dirait « il manque quelque chose » à quelqu'un qui n'a rien à y mettre. Le blanc est ce qui tient les
  noms alignés, et l'alignement est vérifié par programme.
- **Pas de monogramme inventé.** Kazendra ne fabrique pas une initiale dans un carré coloré pour
  combler le vide : ce serait une marque imaginaire affichée comme si elle appartenait à l'entreprise.
  Le nom porte la ligne, un point.
- **Formats** : carré, 200 px minimum, 5 Mo au plus, JPEG, PNG ou WebP. **SVG refusé** — un SVG peut
  porter du script. Recadrage centré **avec aperçu avant validation** (une façade recadrée au hasard
  coupe l'enseigne, et l'artisan ne le découvre qu'après publication).
- **Métadonnées effacées à l'envoi** — et ce n'est pas de l'hygiène, c'est la règle de la porte :
  une photo prise au téléphone porte les **coordonnées GPS**, donc l'adresse exacte. Le jour où l'on
  garde le fichier tel quel, la promesse « une zone est une liste de communes, jamais une adresse » est
  fausse **sans que rien ne le montre à l'écran**. Le fichier est ré-encodé, son nom d'origine remplacé
  par un identifiant (un nom de fichier peut contenir « facture-domicile-2026.jpg »).
- **Déclaré, et contrôlé en relecture** : le professionnel déclare que l'image est celle de son
  entreprise et qu'il en a les droits. Sont **refusés** une photo de banque d'images, le chantier d'un
  confrère, une personne identifiable sans son accord, et **un numéro de rue d'un logement privé** —
  un indépendant qui travaille chez lui publierait son adresse sans le vouloir, et c'est le seul
  endroit où elle entrerait dans la base.
- **Remplacement** : l'image en ligne **reste affichée jusqu'à ce que la nouvelle soit acceptée**. Sans
  ça, la pré-modération se contourne en une seconde : on publie un logo propre, puis on le remplace.
- **L'image ne remplace jamais les mentions légales** : elle s'ajoute au nom, au numéro d'entreprise et
  à la zone, elle ne les résume pas. Un logo seul ne dit pas qui est vérifié.
- **Durée** : elle suit le **compte**, pas la fiche. À l'échéance d'une fiche, elle reste ; elle part
  avec le compte, ou si le compte est suspendu.

## 5. Assurance et accès à la profession — déclarés, jamais vérifiés

- **`assurance_declaree`** : numéro de police + assureur + date de déclaration. Affiché « déclaré le …,
  **non vérifié** ». Nous n'avons aucun moyen d'interroger un assureur, et « certifié » est un mot banni.
- **Obligatoire pour les métiers où la loi l'exige** (construction : responsabilité décennale et RC
  professionnelle) : la fiche ne peut pas être publiée sans cette déclaration. Pour les autres métiers,
  elle est facultative — mais si elle est remplie, elle est affichée.
- **`acces_profession`** : l'attestation de compétence exigée pour certains métiers (Wallonie, Flandre,
  Bruxelles) est **déclarée**, jamais vérifiée. On affiche « attestation déclarée » sans numéro, parce
  qu'un numéro d'attestation non vérifiable donnerait une fausse impression de contrôle.
- **La phrase de la fiche** : « Kazendra vérifie le numéro d'entreprise à la main et affiche ce que le
  professionnel déclare. Il ne garantit ni la compétence, ni la qualité, ni le prix. »

## 6. Pré-modération, et ce qu'elle regarde

Chaque fiche passe par une personne **avant** publication — c'est une publication publique, et le
règlement européen sur les services numériques impose un mécanisme de signalement et de modération.

La modération vérifie **huit choses**, dans cet ordre :

1. le **numéro BCE** correspond à la dénomination, à la main ;
2. le **numéro de téléphone** est professionnel (pas un mobile personnel de salarié) ;
3. l'**assurance est déclarée** pour les métiers qui l'exigent ;
4. l'**image de marque** est celle de l'entreprise (ni banque d'images, ni chantier d'un confrère),
   sans personne identifiable, sans numéro de rue d'un logement privé — et les droits sont déclarés ;
5. les **photos** de réalisations ne montrent aucune personne identifiable, et la déclaration de droit à
   l'image est cochée ;
6. la **description** ne promet rien d'interdit (« meilleur », « garanti », « certifié », « pas cher ») ;
7. les **métiers** sont dans la liste fermée ;
8. la **zone** est une liste de communes, jamais une adresse ni un rayon en km.

> Le compte de ces huit points est **vérifié par programme** : la phrase qui les annonce est lue, et le
> nombre annoncé est comparé au nombre énuméré. Un total affiché doit se recalculer depuis ses lignes,
> y compris dans une phrase.

Un refus porte un **motif écrit** et une seule action : corriger.

## 7. Ce que la fiche ne fait pas — et pourquoi

- **Aucun avis, aucune note** (décision 23). Un avis se modère, s'attaque et se truque. Le jour où la
  question reviendra, elle reviendra avec un budget de modération, pas avant.
- **Aucune certification** : le mot est dans la liste des motifs interdits (`textes/interdits.json`).
- **Aucun paiement** : le particulier ne paie rien à Kazendra, ni pour chercher, ni pour demander un devis,
  ni pour appeler. L'argent du chantier circule entre les deux parties.
- **Aucune géolocalisation** : la zone est une liste de communes, la distance est estimée entre communes.
- **Aucun classement payant déguisé** : quand les fiches seront payantes, l'ordre restera alphabétique ou
  par date de publication. Une fiche « sponsorisée » portera la mention, comme une annonce.

## 8. Prix — 79 € HTVA pour 365 jours, et ce que ça impose

- **79 € HTVA / 365 jours** (décision 24), une seule facture, aucun abonnement, aucun renouvellement
  automatique. Le renouvellement est un geste, avec un rappel à J−15.
- **Une fiche ne suit pas la règle des 30 jours** : elle dure un an, donc elle ne se republie pas chaque
  mois.
- ⚠️ **Constat, à ne pas contourner** : tant qu'il n'y a **pas de numéro d'entreprise ni de TVA**, aucun
  paiement réel n'est possible (Stripe reste en mode test, et on ne vend pas sans immatriculation). Donc
  **la publication est gratuite jusqu'à ce que l'encaissement existe** — le prix de 79 € est un **réglage**
  déjà en place, et le jour où il s'active, la fiche porte la mention « **fiche sponsorisée** ». Écrire
  « 79 € » aujourd'hui sans pouvoir encaisser serait annoncer un prix qu'on ne peut pas facturer.
- **Jamais facturé au particulier**, ni pour chercher, ni pour demander un devis.

## 9. Écrans à produire

Quatre écrans de bureau, deux vues mobiles. C'est la porte la plus légère en nombre d'écrans et la plus
lourde en modération.

1. **Annuaire** — recherche par métier (liste fermée) et par commune, résultat en lignes : nom, métier,
   commune, « vérifié le », assurance déclarée ou non, et les deux gestes.
2. **Fiche professionnelle** — l'**image de marque en 72 px** à gauche du nom, les métiers, la zone, les
   photos (0–12), l'assurance déclarée, les horaires, le numéro assemblé au clic, la demande de devis, le
   partage, le signalement, et l'encadré « ce que nous ne garantissons pas ».
3. **Dépôt / ma fiche** — les métiers, la zone, l'**image de marque** (logo, ou photo d'entreprise à
   défaut) et sa déclaration de droits, les photos et la déclaration de droit à l'image, l'assurance, les
   horaires, le numéro et sa déclaration, puis « relue sous 24 h ».
4. **Mes fiches** — l'état de la fiche, l'échéance à 365 jours, le rappel J−15, le motif de refus, et le
   prix en réglage.
5. **Mobile** — l'annuaire et la fiche à 390 px, barre collante portant **les deux seuls gestes** :
   appeler et demander un devis.

**Vérifiable par programme** : **aucun champ de fichier dans la demande de devis** (et non plus « dans la
page », puisque le dépôt en a un désormais — un contrôle trop large serait devenu faux, puis contourné),
aucun avis, aucune note, aucun « certifié », aucun âge, le numéro absent du HTML servi, les photos sans
personne identifiable (contrôle de présence de la déclaration), l'**image de marque carrée** (36 px dans
l'annuaire, 72 px sur la fiche) avec **le même point de départ pour tous les noms, avec ou sans image**,
**aucun cadre ni fond** sur une fiche sans image, les textes d'aide à la bonne taille, les colonnes de
chaque écran équilibrées, et les huit points de relecture recomptés.

## 10. Données et conservation

**`comptes_entreprise.image_marque`** — `id` · `type` (`logo` · `photo_entreprise`) · `fichier` (ré-encodé,
métadonnées effacées) · trois tailles (36, 72, 512 px, toujours carrées) · `droits_declares_le` ·
`etat` (`en_attente` · `acceptee` · `refusee`) · `modere_par` · `modere_le` · `motif` · `remplacee_le`.
**Elle appartient au compte, pas à la fiche** : c'est la seule donnée de cette porte qui survit à
l'échéance. Un remplacement laisse l'ancienne image affichée jusqu'à la décision de modération.

**`fiches_artisan`** — `id` · `entreprise` · `metiers[]` · `communes[]` · `description` · `photos[]` (0–12) ·
`droit_image_declare_le` · `assurance` (numéro, assureur, déclaré le) · `acces_profession_declare` ·
`horaires` · **`tel_contact`** · `tel_declare_le` · `etat` (`brouillon` · `en_attente` · `publiee` ·
`refusee` · `expiree`) · `publiee_le` · `echeance` (365 j) · `payant` · `sponsorise` · `modere_par` ·
`modere_le` · `motif`.

| Donnée | Durée | Pourquoi |
|---|---|---|
| fiche, photos, numéro, assurance | **365 jours**, puis effacement | c'est la durée vendue |
| image de marque | **tant que le compte vit** | elle sert sur les cinq portes, pas seulement ici |
| fiche refusée | **30 jours** (le temps de corriger), puis effacement | un refus n'est pas une archive |
| motif de refus | tant que la fiche vit | permet de contester, et d'éviter le même refus deux fois |
| demande de devis | **jamais stockée** | elle part en courriel depuis la boîte du visiteur |
| journaux de modération | 24 mois | preuve qu'on a agi |

**Jamais stocké** : aucune adresse de particulier, aucune photo de personne identifiable, aucun avis,
aucune note, aucune demande de devis, aucune position.

## 11. Questions ouvertes

1. **La liste fermée des métiers** : combien ? Proposition : **18 métiers** en quatre familles (maison,
   extérieur, finitions, services à domicile) — assez pour couvrir, assez court pour tenir à jour.
2. **L'accès à la profession** varie par Région (Wallonie, Flandre, Bruxelles). Proposition : afficher
   « déclaré » sans détailler la Région, et poser la question une fois à un juriste, comme pour les
   services d'entraide.
3. **Le renouvellement à 365 jours** : rappel à J−15 par e-mail suffit-il, ou faut-il un rappel à J−30
   aussi ? Proposition : **J−15 seulement** — un artisan lit ses courriels.
4. **Les fiches des ASBL et des services publics** (une maison de quartier qui propose du bricolage) :
   même régime que l'entreprise ? Proposition : oui, avec le même numéro d'entreprise vérifié.

## 12. Ce qui reste à produire pour clore cette porte

- [x] **Les quatre écrans de bureau + les deux vues mobiles** — `maquettes/artisan.html`, captures
      `artisan-annuaire.png`, `artisan-fiche.png`, `artisan-depot.png`, `artisan-mes-fiches.png`,
      `artisan-mobile-390.png`
- [x] **Audit automatique de la porte** — `maquettes/audit-artisan.py` : **75 contrôles, 0 échec**
- [x] **Textes figés** — `textes/artisan-fr.json`, **26 phrases** relevées dans les écrans ;
      `node tests/verifie-textes.mjs` → **0 faute** (42 textes, 2 portes, 27 motifs)
- [x] **Clause CGU « 2 ter — Les artisans et services à domicile »** — `CGU-ARTISAN.md`, avec ce que
      chaque paragraphe ferme
- [ ] `confidentialite.html` : dire qu'aucune demande de devis n'est conservée, que les photos et
      l'**image de marque** sont servies depuis la machine, que les **métadonnées de l'image sont
      effacées** (donc aucune coordonnée de localisation), et que l'image suit le compte — elle n'est
      pas effacée avec la fiche

## 13. Ce que les écrans ont tranché, et les défauts trouvés en les regardant

67. **Le numéro est lisible mais jamais un lien.** L'audit vérifie trois choses ensemble : aucun
    `href="tel:` dans la page, le clic produit bien `tel:026481234` (sans espaces, formé depuis deux
    attributs), et le numéro reste affiché en clair — « 02 648 12 34 » — pour celui qui doit le composer
    à la main. Un numéro assemblé mais invisible serait une protection contre un problème que personne
    n'a.
68. **La demande de devis ne stocke rien, et l'écran le prouve.** Quatre champs composent un courriel
    (`&body=`), le corps fait moins de 700 caractères, il ne contient aucune trace de Kazendra, il
    **propose** d'envoyer des photos sans jamais promettre de pièce jointe, et aucun `input[type=file]`
    n'existe dans la page. Le message est montré **avant** le clic, comme sur `/emploi`.
69. **Trois défauts réels trouvés en regardant les captures**, et aucun n'était visible dans le code :
    - les **légendes des photos étaient invisibles** — présentes dans le DOM, lisibles par un lecteur
      d'écran, et peintes **sous** le hachurage parce qu'un élément positionné en absolu se peint
      au-dessus du contenu statique. Corrigé par un `z-index`, et **contrôlé par `elementFromPoint`** :
      le test ne demande plus « l'élément existe » mais « c'est bien lui qui est au-dessus » ;
    - les deux colonnes de la fiche finissaient à **650 px d'écart** — le demi-écran vide, troisième
      occurrence sur ce projet. La carte « horaires, zone » et les deux encadrés ont changé de colonne ;
      l'audit mesure désormais l'écart et refuse au-delà de 400 px ;
    - un **bouton sans effet** : « Demander un devis » dans la première carte n'avait pas de
      destinataire, donc ne faisait rien. Il descend maintenant jusqu'au formulaire. Un bouton qui ne
      fait rien est un défaut, même dans une maquette.
70. **Un faux positif de plus, du même type que les précédents** : le contrôle refusait le mot
    « classement » alors que la page écrit « **Pas de** classement payant déguisé ». La tolérance à la
    négation est maintenant appliquée là aussi — c'est la cinquième fois sur ce projet, et c'est
    toujours la même cause : un contrôle qui cherche un mot au lieu de chercher une **promesse**.

71. **L'image de marque est un attribut du COMPTE, pas de la fiche** (règle de l'utilisateur, 25/10 :
    « *Les entreprises doivent pouvoir rajouter un logo ou une photo d'entreprise si ils n'ont pas de
    logo* »). Un seul emplacement, deux provenances — logo, ou photo de l'entreprise à défaut — et une
    seule image pour les cinq portes où une entreprise publie. Corollaire tranché dans la foulée : elle
    **survit à l'échéance** d'une fiche, parce qu'elle n'appartient pas à la fiche. Sans ce corollaire,
    un artisan qui renouvelle sa fiche aurait dû redéposer son logo, et le dépôt d'`/immo` aurait été
    une seconde vérité à synchroniser.

72. **Une fiche sans image réserve la place et la laisse blanche** — ni cadre, ni fond, ni monogramme
    inventé, ni « sans photo ». La colonne réservée tient les noms alignés ; un cadre dirait « il manque
    quelque chose » à quelqu'un qui n'a rien à y mettre, et un monogramme ferait passer une initiale
    fabriquée par nous pour la marque de l'entreprise. **Vérifié par programme** : le blanc n'a ni bordure
    ni fond, et les quatre noms commencent à la même abscisse (`[496]`, une seule valeur).

73. **Une photo de téléphone porte l'adresse, donc les métadonnées sont effacées** — une façade prise au
    smartphone contient les coordonnées GPS. Les garder rendrait fausse la promesse « une zone est une
    liste de communes », **sans que rien ne le montre à l'écran** : c'est le genre de contradiction qui
    ne se voit qu'en regardant le fichier. Même raison pour le nom d'origine du fichier, remplacé par un
    identifiant — un nom peut contenir « facture-domicile-2026.jpg ».

74. **Le contrôle « aucun champ de fichier » a été resserré, pas supprimé** — il disait « dans la page »,
    ce qui était vrai tant que rien ne se téléversait. Le dépôt a désormais une image à déposer : le
    contrôle porte sur **la demande de devis**, qui ne doit rien pouvoir recevoir. Un contrôle trop large
    serait devenu faux, puis contourné — et un contrôle contourné ne protège plus personne.

75. **Le contrôle des colonnes mesurait le mauvais écran depuis sa naissance** — il prenait
    `document.querySelectorAll('.fiche')[1]`, c'est-à-dire le **dépôt**, en annonçant « les deux colonnes
    de la fiche ». Il ne vérifiait donc pas ce que la correction d'alors avait corrigé, et il passait
    tant que le dépôt restait sous le seuil. Il mesure maintenant **chaque** écran à deux colonnes et dit
    lequel déborde. C'est la deuxième fois qu'un contrôle passe pour une mauvaise raison (la première :
    les 19 phrases d'`/emploi` introuvables à l'écran), et les deux fois, c'est la capture qui l'a dit.

76. **Une classe sans règle CSS s'affiche à la taille du texte courant** — `.f .hint2` ne stylait que les
    aides posées **dans** un `.f`. Deux phrases d'aide posées directement dans une section — les formats
    d'image, et la ligne de l'assurance, **déjà fausse avant** et que personne n'avait vue — s'affichaient
    deux fois plus grosses que leurs voisines. La règle ne dépend plus du parent, et l'audit mesure
    désormais la **taille rendue** de tout texte d'aide (≤ 11,5 px), pas la présence de la classe.
