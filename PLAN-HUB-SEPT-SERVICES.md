# Hub Kazendra — huit portes, un seul domaine

Journal de décisions. Rien n'est codé tant qu'une décision n'est pas marquée **TRANCHÉE**.
Mesures datées du 23/10/2026 sur la machine.

## Décisions TRANCHÉES

1. **Un seul domaine, des chemins.** Pas de sous-domaines. `kazendra.com` sert tout.
2. **Huit applications indépendantes**, chacune son processus, son port, son dépôt, son
   fichier de données. L'indépendance est réelle : si une porte tombe, les autres tiennent.
3. **Toutes les données sur la machine de l'utilisateur.** Aucun service tiers, aucune clé API.
4. **« Entraide » (app n°3) devient « Job étudiant »** et reste distincte de l'emploi
   adultes/entreprises : ce sont deux applications séparées.
5. **`/promo` ne change pas de contenu**, seulement d'adresse (il quitte la racine).

6. **`/job-etudiant` = deux volets.** (a) des étudiants qui rendent service à des adultes et
   à des personnes du troisième âge — l'argent circule **de main à main, hors application** ;
   (b) une rubrique d'annonces pour les entreprises qui cherchent des étudiants, et **c'est
   cette rubrique qui est payante**.
7. **Aucune responsabilité de recrutement.** Pour `/job-etudiant` comme pour `/emploi` :
   affichage seulement. Pas d'engagement, pas de suivi, pas de candidature traitée.
8. **Paiement en ligne, prestataire unique : Stripe** (relevé le 23/10/2026 : cartes EEE
   1,50 % + 0,25 € ; Bancontact 0,35 € ; sans abonnement — Mollie : 1,80 % + 0,25 € et
   0,39 €). Publication automatique par webhook signé, clés gardées sur la machine.
9. **Numéro d'entreprise en cours de création.** Rien ne se lance en production payante
   avant qu'il existe. Le paiement se construit donc **débranchable** : une interface de
   paiement, le mode test Stripe pour mettre au point, et une activation manuelle dans le
   panneau comme filet tant que le compte marchand n'existe pas.
10. **Suivi personnel, jamais de candidature traitée.** L'utilisateur coche lui-même
    « postulé le … », le hub lui rappelle de relancer. Aucune donnée ne part vers un
    employeur ou un loueur. La responsabilité d'intermédiaire reste dehors.
11. **Gratuit pour les particuliers, payant pour les entreprises** — dans chaque catégorie
    où c'est faisable. Deux natures de compte : particulier et entreprise.
12. **Vérification d'un numéro d'entreprise sans clé API** : les données ouvertes de la BCE
    (KBO) sont publiées en fichier mensuel téléchargeable. On le garde sur la machine et on
    vérifie le numéro en local. Aucun appel à un service tiers au moment de l'inscription.
13. **Facturation à l'annonce**, pas d'abonnement : une annonce = un prix, une durée de
    30 jours, une facture. Pas de reconduction, pas de carte stockée, pas d'échec de
    paiement récurrent à gérer.
14. **Un prix par catégorie**, jamais un tarif unique : grille adoptée le 23/10/2026
    (`/annonce` 5 € · `/evenement` 12 € · `/job-etudiant` 25 € · `/emploi` 39 € ·
    `/immo` 49 €), montants révisables — ce sont des hypothèses, pas des relevés.
    Le prix vient d'un seul réglage par porte, jamais codé en dur dans une page.
15. **Un seul panneau d'administration pour tout le projet.** Un onglet par application, et
    dans chaque onglet les rubriques propres à cette application. Les applications restent
    gérées indépendamment les unes des autres, mais depuis une seule page admin.
16. **Cible : toute l'Europe.** La V1 démarre en français, mais rien n'est écrit en dur :
    les textes vivent dans des fichiers de langue, et **le pays est une donnée, pas une
    version du site**.
17. **Adresse unique, sélecteur de pays** (choix de l'utilisateur le 23/10/2026) : le pays
    n'apparaît **jamais** dans l'URL. Conséquence assumée : on ne référence pas une page
    « annonces en Espagne » à part. Les pages d'annonces restent indexables une par une ;
    des pages d'entrée par pays pourront s'ajouter plus tard sans changer l'expérience.
18. **Double vérification avant la première publication** : e-mail **et** téléphone (SMS).
    La consultation reste libre et sans compte. Conséquence assumée : un prestataire SMS,
    payant au message, donc **un tiers dans la chaîne** — c'est la seule exception à la règle
    « aucun tiers », et elle vaut pour la sécurité des échanges entre particuliers.
19. **Prestataire SMS : OVH SMS.** Déjà fournisseur du domaine et de la boîte mail : un seul
    prestataire pour le domaine, le courrier et les SMS, donc un seul compte et une seule
    facture à suivre.
    **Révisé le 25/10/2026 — la passerelle maison passe devant.** L'utilisateur a demandé s'il
    existait une solution gratuite ; le relevé de prix OVH (0,06 € HT par SMS, et **uniquement
    vers la France métropolitaine**) laissait la dépense par inscription inconnue. Décision :
    un téléphone Android sur le réseau local envoie les SMS par sa propre carte SIM
    (`SMS Gateway for Android`, Apache-2.0, `capcom6/android-sms-gateway`, mode « Local Server »,
    pas de compte à créer). Variables : `KAZENDRA_SMS_PASSERELLE_URL`, `_USER`, `_MDP`.
    OVH SMS **reste dans le code** comme second tuyau, jamais supprimé : si la passerelle tombe,
    la bascule est un changement de variables, pas un chantier. L'écran annonce par quel tuyau le
    SMS part (`moyenSms`) — deux tuyaux, deux promesses, il ne doit pas y avoir de flou.
    Ce qui change dans les limites : la disponibilité de l'inscription dépend désormais d'un
    téléphone allumé, et le débit tombe à quelques SMS par minute. Acceptable pour un pilote ;
    à revoir si le volume rend la file d'attente visible.
20. **La modération est continue** : il y aura toujours quelqu'un pour faire les vérifications
    sous 24 h (choix de l'utilisateur le 23/10/2026). Pas de pause de publication, donc
    **plusieurs comptes d'administration** avec des rôles distincts — et un journal par
    personne, sinon on ne sait pas qui a retiré quoi.
21. **Un modérateur peut être limité à certaines portes** en plus de son degré (choix du
    23/10/2026) : un réglage, pas un rôle de plus. Utile quand quelqu'un ne surveille qu'une
    seule porte.
22. **Remboursement aux trois quarts** en cas de retrait pour non-respect des règles, un quart
    retenu pour frais administratifs (choix du 23/10/2026). Le taux est écrit dans les
    conditions avant paiement, et chaque remboursement partiel produit une note de crédit.
23. **Huitième porte ouverte : « Artisans & services »** (choix du 23/10/2026). Plombier,
    électricien, jardinier, peintre, coiffeur à domicile, déménageur. Mécanique nouvelle :
    une fiche professionnelle qui dure + une demande de devis. Payant pour le professionnel,
    gratuit pour le particulier.
24. **Fiche artisan : 79 € HTVA pour 365 jours** (choix du 23/10/2026) — environ 6,60 € par
    mois, une seule facture, aucun abonnement. Une fiche ne se renouvelle pas tous les mois,
    donc elle ne suit pas la règle des 30 jours des annonces.
25. **Contact par messagerie uniquement, sur `/annonce`** (choix du 23/10/2026) : aucun numéro
    de téléphone n'est publié, même en option. Le numéro collecté sert à vérifier le compte.
    Conséquence : pas de scraping des numéros, et une trace écrite de chaque échange.
26. **Catégories de `/annonce` validées le 23/10/2026** : onze rayons, quatre types d'offre
    (vente, don, location, échange), cinq sous-catégories ajoutées, liste des objets interdits,
    animaux en adoption seulement, et **création d'une catégorie par la mesure** — si plus
    d'une annonce sur cinq tombe dans « Divers », la catégorie manquante se crée avec les mots
    des utilisateurs.
27. **Localisation : un lien vers la carte, pas une carte embarquée** (choix du 23/10/2026).
    Les liens profonds vers Google Maps sont gratuits, sans clé et sans compte — c'est la carte
    du client qui s'ouvre. Vérifié le 23/10/2026 : réponse 200 sans clé. Le lien ne porte que
    le code postal, jamais une adresse exacte.
28. **Un bouton de partage sur CHAQUE fiche, ressemblant au logo WhatsApp** (choix du
    25/10/2026, remarque de l'utilisateur : « *il faut rajouter la possibilité aux utilisateurs de
    partager, le logo doit ressembler au logo WhatsApp* »). Portée : les huit portes, pas seulement
    `/evenement` — annonce, immo, emploi, job étudiant, artisan, promo. Ce qui est écrit :
    (a) **le bouton est celui de `/promo`, pas un bouton WhatsApp** — correction de l'utilisateur le
    25/10/2026 : « *Je souhaite garder le thème kazendra et utiliser le même bouton que nous avons mis
    dans promo, utiliser le logo de la flèche WhatsApp et pas du thème complet de WhatsApp.* »
    Concrètement : **rond de 34 px**, fond transparent, bordure fine, **la flèche de partage** en
    `currentColor` (le glyphe qu'emploient WhatsApp et Facebook), encre foncée, orange au survol.
    **Aucun vert, aucun bloc de marque, aucune image externe, aucun SDK** — un lien `wa.me/?text=…`
    suffit et il est gratuit. Raison de fond : le site a **un seul accent, l'orange** ; un bouton vert
    en introduisait un deuxième et suggérait un partenariat qui n'existe pas ;
    (b) **au clic** : `navigator.share` si le téléphone sait partager, sinon le **menu de repli** déjà
    utilisé par `/promo` (WhatsApp · E-mail · Copier le lien), sur ordinateur comme sur mobile ;
    (c) **le partage marche sans compte** : un visiteur qui reçoit un lien doit pouvoir le repasser ;
    (d) **ce que le message contient** : titre, date (ou prix pour une annonce), commune, lien —
    jamais une adresse privée, un téléphone, un e-mail, un nom de famille, un prix barré ou un
    nombre de places ;
    (e) **aucun compteur de partages** : on ne saurait pas le mesurer sans traqueur, et on n'en veut
    pas ;
    (f) **Signaler reste discret et séparé** du bouton principal ; le libellé « Partager » reste
    visible dans la colonne d'actions d'une fiche, l'icône seule suffit sur une carte de promo.
    **Exception explicite : aucun bouton de partage sur un profil `/rencontre`.** Partager un profil
    publie la vie privée de quelqu'un sans son accord ; la règle s'arrête à cette porte
    (`SPEC-RENCONTRE.md` § 12).
    Conséquence à tenir : **Open Graph obligatoire** sur chaque fiche (titre, date, image 1200×630),
    sinon le lien partagé s'affiche nu et n'inspire pas confiance. Maquette du composant :
    `maquettes/partage.html` + `partage-1440.png`, appliqué dans `annonce.html`, `immo.html`,
    `evenement.html` et `evenement-mobile.html`.

29. **AUCUNE PHOTO N'EST JAMAIS OBLIGATOIRE — dans aucune des huit portes** (décision du
    25/10/2026, verbatim de l'utilisateur : « *Une photo ne doit pas être obligatoire, utilisateur
    peut mettre une annonce sans photo* »). Portée et conséquences, identiques partout :

    a) une annonce, un bien, un événement, une offre d'emploi, une fiche d'artisan ou un profil de
    rencontre se publie avec **zéro image** : le bouton « Continuer » / « Publier » est actif
    immédiatement, il n'existe aucun message du type « ajoutez au moins une photo » ;
    b) l'affichage sans image est **complet et digne** : titre (ou pseudo) en grand, prix, date,
    lieu — sur fond bleu nuit. **Jamais de vignette grise, jamais de silhouette barrée, jamais la
    mention « sans photo »** : l'absence n'est pas un défaut à signaler ;
    c) le filtre « avec photo uniquement » peut exister **côté recherche**, comme préférence de
    celui qui cherche. Il n'est jamais une exigence imposée à celui qui publie ;
    d) l'Open Graph d'une fiche sans image utilise le logotype Kazendra (1 200 × 630) : le lien
    partagé n'est jamais nu ;
    e) conséquence assumée sur l'anti-abus : on ne peut plus écarter une fiche parce qu'elle est
    vide d'images, donc le tri repose sur la pré-modération des comptes récents, le blocage des
    motifs frauduleux à l'envoi, l'intérêt mutuel et le signalement — jamais sur le visage ;
    f) **ne pas reposer la question** : le premier réflexe (« visage facultatif mais photo
    obligatoire ») a déjà été proposé puis abandonné le 25/10/2026.

    Appliqué dans `SPEC-ANNONCE.md` §3, `SPEC-IMMO.md` §4, `SPEC-EVENEMENT.md` §5 et
    `SPEC-RENCONTRE.md` §3, §5 et §6.

30. **Sorties à plusieurs : greffe sur `/evenement`, jamais un tableau d'intentions** (décision du
    25/10/2026, réponse de l'utilisateur : « *Ok on part sur l'idée A uniquement* »). Demande
    d'origine : « *un système de rencontre le jour même en fonction des activités et de l'envie du jour
    par exemple cinéma restaurant et que les gens se trouvent grâce à un événement qu'ils ont envie de
    faire en commun* ».

    a) La sortie **s'accroche à une fiche d'événement existante** — lieu public, date saisie, fiche
       déjà modérée. **Aucun écran ne liste « qui veut sortir ce soir »** ; la porte séparée est
       abandonnée.
    b) Le bloc n'est **rendu qu'à une personne connectée**, intéressée par l'événement et de la même
       zone : rien dans le HTML pour un visiteur anonyme, donc rien d'indexable ni de partageable.
    c) **Aucune sortie sur un événement à adresse privée** — le point de rendez-vous serait l'adresse
       de quelqu'un.
    d) **Seuils** : proposer = compte ≥ 30 jours, téléphone vérifié, une seule sortie active ;
       rejoindre = compte ≥ 7 jours, téléphone vérifié, événement marqué « intéressé ». Raison :
       une sortie se prépare en quelques heures, la modération humaine ne peut pas être le filtre.
    e) **Champs fermés** : rendez-vous (15 min avant · à l'ouverture · à l'heure de début — jamais une
       heure libre, jamais après le début), durée prévue (1 h · 2 h · la journée), places (2, 4 ou 6),
       mot de 140 caractères filtré. Le point de rendez-vous **n'est pas saisi** : c'est le lieu public
       de l'événement.
    f) **Groupe, jamais duo improvisé** : « 2 » est libellé « en duo », et le duo reste dans
       `/rencontre` après intérêt mutuel.
    g) **Fil de groupe** dans la messagerie commune : aucune image, aucun fichier, aucun lien, aucun
       message privé entre participants, effacement 30 jours après l'événement.
    h) **Aucun argent, aucune réservation, aucun compteur, aucune note** ; la présence n'est pas
       mesurée, parce qu'elle n'est pas vérifiable honnêtement.
    i) **Modération assumée** : filtre automatique + publication immédiate + contrôle humain sous 24 h
       (la pré-modération rendrait la fonction inutile).
    j) **Catégorie `cinema` ajoutée** à `/evenement` (12 catégories) : sans fiche de séance, l'exemple
       « cinéma » n'était pas couvert.
    k) **Ce que la forme A ne couvre pas** : « resto pour deux ce soir » sans événement. Le dire, ne
       pas le découvrir plus tard.

    Spécification : `SPEC-EVENEMENT.md` § 23 et § 24 ; renvoi et décision dans `SPEC-RENCONTRE.md`
    § 20.6. Maquette : `maquettes/evenement.html` écran 3, capture `evenement-sortie.png`.

31. **Job étudiant : ouvert dès 16 ans** (décision du 25/10/2026, réponse de l'utilisateur : « *Pour le
    point 3, les job étudiants doivent être ouvert à partir de 16 ans* »). La porte `/job-etudiant`
    reprend le **projet n°3 « Entraide »** (`SPEC-JOB-ETUDIANT.md`), et cette décision **abroge** la
    contrainte « 18 ans et plus en V1 » de sa note légale.

    a) **16 ans révolus, sans exception**, comme le prévoyait déjà la décision 17 du projet 3 ;
    b) un compte de 16–17 ans déclenche **sept règles dans le code**, pas un avertissement : pas de nuit
       (22:00–06:00), pas de dimanche ni de jour férié, pas pendant les heures de cours (ouverture
       horodatée de 6 mois, rouverte seule pendant les vacances de sa communauté), **accord d'un parent
       ou tuteur tracé** avant toute activité, liste noire du travail manuel inchangée, compteurs
       inchangés (8 h/semaine, 650 h/an, 12 mois), **aucune donnée de mineur conservée après un refus** ;
    c) **l'univers jobs ouvre à 16 ans immédiatement** (contrat d'occupation d'étudiant, conclu par
       l'employeur, qui porte DIMONA et DmfA) ; **l'univers entraide reste à 18 ans** tant que la
       condition d'âge de l'exemption ONSS des activités occasionnelles non manuelles n'a pas été lue sur
       la source officielle — ce n'est pas un refus, c'est la même décision appliquée là où le droit est
       certain ;
    d) deux vérifications à faire avant la première mission d'un mineur : **couverture d'assurance et
       responsabilité civile** (courtier), et **condition d'âge de l'exemption ONSS** (source officielle).

    Spécification : `SPEC-JOB-ETUDIANT.md` § 3 bis et § 5.

32. **Job étudiant : application locale, pas de Google Sheets comme base vivante** (décision du
    25/10/2026, réponse de l'utilisateur : « *On prend la seconde solution* »). Ce que ça change :

    a) la porte devient un **service du hub** : `projects/job-etudiant`, port **4204**, `node server.js`,
       zéro dépendance, `reach: path`, déclarée dans `registry/services.json` comme `sape` et `promos` ;
    b) **un fichier JSON par table**, écriture atomique (tmp + rename) et verrou en mémoire — le modèle
       déjà employé par les autres portes. Migration vers SQLite écrite comme condition : au-delà de
       ~50 000 lignes sur une table, ou dès qu'il y a des écritures concurrentes ;
    c) **export tableur quotidien** : un CSV par table (UTF-8 BOM, séparateur `;` pour Excel belge),
       compressé en `.zip` daté, conservé **30 jours**, plus un bouton « Exporter maintenant ». Aucun
       envoi vers un tiers, aucune clé, aucun Apps Script ;
    d) le compte reste **unique** (cookie partagé, index de recherche commun) — c'est ce que l'option
       Sheets ne permettait pas ;
    e) trois corrections que la transcription a fait apparaître, et qui contredisaient des décisions
       déjà prises : **l'IBAN disparaît** (décision 39 : aucune donnée bancaire), **aucun extrait de
       casier judiciaire n'est stocké** (art. 10 RGPD — c'est l'employeur qui le demande), et
       **l'attestation d'étude est vérifiée mais pas archivée** (on garde la date et l'auteur).

    Modèle complet : `MODELE-DONNEES-JOB-ETUDIANT.md`. Spécification : `SPEC-JOB-ETUDIANT.md` § 5.

33. **Job étudiant : le projet n° 3 « Entraide » l'emporte sur le cadrage du hub, sur deux points**
    (décision du 25/10/2026, réponse de l'utilisateur : « *Oui tu peux les clôturer comme ça* »). Le hub
    avait cadré cette porte avant qu'on rouvre le dossier ; deux de ses règles ne tenaient plus :

    a) **« affichage pur » est abandonné.** `/job-etudiant` fait de **vraies missions** : code de fin à
       quatre chiffres, confirmation par la personne aidée, évaluation **par des faits** (jamais une
       moyenne d'étoiles), carnet d'heures déclaratif. La responsabilité reste bornée par les trois
       lignes rouges (jamais employeur, jamais placeur, l'argent ne passe jamais par la plateforme).
       En contrepartie, **`/emploi` (adultes) reste en affichage pur** : les deux portes ne se
       ressemblent pas, et c'est voulu ;
    b) **la publication est gratuite au lancement**, et **jamais facturée à l'étudiant**. Le hub prévoyait
       25 € HTVA par annonce d'entreprise : c'est reporté, pas supprimé — les champs **`payant`** et
       **`échéance`** sont codés dès maintenant dans la table `annonces`, pour que le passage à la
       facturation soit une case à cocher et non une reconstruction.

    Ce que ça ne change pas : la bascule entre les deux univers suit toujours le **statut vérifié** du
    compte (particulier → entraide, entreprise au BCE vérifié → jobs), et les quatre lignes du cadrage
    du hub qui survivent (compte unique, proxy et HTTPS, file de modération unique, panneau
    d'administration à trois degrés) restent la propriété du hub.

    Spécification : `SPEC-JOB-ETUDIANT.md` § 5 (frictions 1 et 2, closes) · journal du projet 3,
    décision 57.

34. **Une seule application, un seul nom : Kazendra. Aucune porte n'a d'application individuelle.**
    (décision du 25/10/2026, réponse de l'utilisateur : « *Il me reste dans la cohérence du hub, job
    étudiant doit être uniquement lié à kazendra. Pas d'application individuelle. Toutes les portes
    devront être dans une seule application. Kazendra* »)

    a) **Le nom est tranché : Kazendra**, et rien d'autre. « Entraide », le nom de travail du projet 3,
       **n'est jamais une marque** : il reste ce qu'il est en français — le **nom commun de l'univers**
       (celui qui aide ↔ celui qui est aidé), et il cesse d'être un nom de produit. Donc : aucun logo,
       aucune fiche de boutique, aucune mention « application Entraide ». Le titre de la porte est
       **descriptif** (« Coups de main & jobs étudiants »), pas un nom de marque — et un titre descriptif
       se traduit, ce qu'une marque ne fait pas ;
    b) **les trois finalistes sont archivés, non achetés.** Ondavie, Elvardo et Manvido ne servent plus :
       **aucun dépôt de marque, aucun domaine acheté**, y compris les cinq domaines d'Ondavie qui sont
       libres. Le travail de mesure garde sa valeur — il a servi à trancher — mais la dépense n'a pas
       lieu. Si la marque propre revenait un jour, les trois dossiers sont dans
       `/opt/data/app3/app3-marque.html` ;
    c) **aucune application individuelle par porte** : une seule application contient les huit portes.
       Une fiche de boutique, un identifiant, un compte, un logo. C'est ce qui rend le compte unique
       cohérent jusqu'au bout : entrer par l'application ou par le navigateur mène au même endroit ;
    d) **conséquence technique, à trancher le jour de la publication et pas avant** : l'application
       existante (`com.kazendra.app`, label « Kazendra ») **embarque aujourd'hui ses pages en local**
       (`appassets.androidplatform.net`) et interroge le hub pour les données. Avec huit portes
       dynamiques, deux voies : **ouvrir `kazendra.com`** (une porte ajoutée apparaît sans mise à jour
       de boutique) ou **embarquer les pages** (lancement instantané, mais une mise à jour de boutique à
       chaque porte, et une copie figée du produit). Je recommande la première : les portes vivent de
       comptes, de modération et de données, donc une copie embarquée serait une seconde vérité à
       garder synchronisée — exactement ce qu'on refuse ailleurs.

    Ce que ça ferme : la question « le nom de l'application » (§ 8.3 de `SPEC-JOB-ETUDIANT.md`, § 10.1
    du modèle de données). Ce que ça ne change pas : le compte unique, le proxy et le HTTPS restent le
    socle — la décision les renforce.

35. **`/emploi` : la candidature sort par le courriel de l'employeur, pas par Kazendra.**
    (décision du 25/10/2026, réponse de l'utilisateur : « *l'annonce de l'employeur affiche l'adresse
    mail à contacter pour postuler. En cliquant sur postuler un mail s'ouvre directement avec le Gmail de
    l'utilisateur, pas de lien avec Kazendra* »)

    a) **L'annonce porte l'adresse de l'employeur**, et le bouton « Écrire à l'employeur » ouvre le
       gestionnaire de courrier par défaut avec un lien `mailto:` pré-rempli (destinataire + objet
       « titre de l'offre — candidature »). **Rien d'autre n'est pré-rempli**, et le nom de Kazendra
       n'apparaît nulle part dans le message : c'est ce qui sort de la plateforme ;
    b) **l'écran ne dit jamais « Gmail »** (le gestionnaire par défaut peut être autre chose, ou
       absent) : il dit « écrire à l'employeur » et **affiche l'adresse en clair à côté du bouton**,
       pour que celui dont le client ne s'ouvre pas puisse la copier ;
    c) **c'est une exception assumée à la règle « contact uniquement par messagerie Kazendra »** — et
       une exception de plus à ne pas propager : sur `/job-etudiant`, « CV à envoyer à… » reste **bloqué
       à la saisie**, parce que la porte s'adresse à des mineurs. Deux portes voisines, deux politiques,
       et le tableau qui l'explique est au § 4 de `SPEC-EMPLOI.md` ;
    d) **l'adresse n'est pas écrite dans le HTML servi** (assemblée au clic depuis deux attributs) et
       l'employeur est averti au dépôt qu'elle sera publique et récoltée : c'est un ralentisseur, pas une
       protection, et on ne prétend pas le contraire ;
    e) **publication gratuite au lancement**, comme `/job-etudiant` (décision 33 b) : deux portes voisines
       ne facturent pas différemment le même service le même mois. Le prix de 39 € reste un **réglage**,
       et **rien n'est jamais facturé à celui qui cherche**.
    f) **un brouillon de message est proposé, jamais imposé** (ajout de l'utilisateur le 25/10/2026 :
       « *on peut aussi rajouter un corps de message que l'utilisateur peut utiliser, ou pas* »). Le
       texte est **montré avant le clic**, et deux gestes distincts l'accompagnent : « écrire avec ce
       texte » et « écrire sans texte — message vide ». Trois règles, et la deuxième est la plus
       importante : le corps doit rester **court** (un `mailto:` trop long est tronqué par certains
       clients — 247 caractères ici) ; il ne doit **jamais** écrire « je joins mon CV » ni « ci-joint »,
       parce que rien n'est joint et qu'une phrase qui promet une pièce absente est pire qu'un corps
       vide ; et il ne contient **aucune mention de Kazendra** ni signature pré-remplie. L'audit vérifie
       les deux gestes séparément : le premier porte le corps, le second ouvre un message vide.

    Spécification complète : `SPEC-EMPLOI.md`.

36. **`/artisan` : le téléphone professionnel est publié, et une fiche est une durée, pas une annonce.**
    (cadrage du 25/10/2026, sur les décisions 23 et 24, après relecture des règles du hub)

    a) **Le numéro professionnel est publié** — c'est une **exception assumée à la décision 25**, qui
       interdit de publier un numéro sur `/annonce`. Elle ne protège pas la même personne : la décision 25
       protège un **particulier** qui vend un vélo ; ici il s'agit d'une **entreprise** dont le numéro est
       déjà sur sa camionnette. Un annuaire d'artisans sans téléphone n'est pas un annuaire. Le numéro est
       **déclaré professionnel** au dépôt, **assemblé au clic** (jamais écrit comme lien dans la page),
       effacé avec la fiche, retiré sur demande, et un **mobile personnel de salarié** est refusé en
       relecture ;
    b) **la demande de devis suit la mécanique de la décision 35** : quatre champs qui composent un
       courriel pré-rempli dans la boîte du visiteur. **Rien n'est stocké** — ni la demande, ni les photos,
       ni l'adresse — et **aucun champ de fichier n'existe** : les photos se joignent dans le courriel.
       Une demande de devis contient l'adresse et l'intérieur de quelqu'un ; c'est exactement ce qu'une
       porte ne garde pas si elle n'en a pas besoin ;
    c) **photos 0 à 12, jamais obligatoires** (décision 29), **droit à l'image déclaré** — publier
       l'intérieur d'un client sans son accord est une atteinte à sa vie privée, et personne ici ne peut
       le vérifier — et **aucune personne identifiable**, refusée en relecture avec un motif ;
    d) **assurance et accès à la profession : déclarés, jamais vérifiés.** On n'a aucun moyen d'interroger
       un assureur. L'assurance est **obligatoire** pour les métiers de la construction (où la loi
       l'exige) ; ailleurs elle est facultative, et affichée si elle est remplie ;
    e) **79 € HTVA pour 365 jours est un réglage**, et **la publication est offerte tant que
       l'encaissement n'existe pas** — sans numéro d'entreprise ni TVA, on ne peut pas facturer, et
       annoncer un prix qu'on ne peut pas encaisser serait pire que de ne rien annoncer. Le jour où le
       prix s'active, la fiche porte la mention « **fiche sponsorisée** » ;
    f) **aucun avis, aucune note, aucun classement payant déguisé.** L'ordre reste alphabétique ou par
       date de publication. Un avis se modère, s'attaque et se truque : la porte n'en a pas.

    Spécification complète : `SPEC-ARTISAN.md`.

37. **L'image de marque : un logo, ou une photo de l'entreprise à défaut — et c'est le COMPTE qui la
    porte.** (règle de l'utilisateur, 25/10/2026 : « *Les entreprises doivent pouvoir rajouter un logo
    ou une photo d'entreprise si ils n'ont pas de logo* »)

    a) **Un seul emplacement, deux provenances.** L'entreprise dépose son **logo** ; si elle n'en a pas,
    elle dépose **une photo de son entreprise** — façade, atelier, camionnette, vitrine. **Jamais les
    deux, jamais un troisième choix** : le visiteur doit reconnaître l'entreprise, pas décoder un dossier
    d'images. C'est la généralisation de la décision du 24/10 sur le logo d'agence d'`/immo` (§ 6 de
    `SPEC-IMMO.md`), qui devient un cas particulier de celle-ci ;
    b) **elle appartient au compte, pas à la fiche.** Déposée une fois, elle sert sur **les cinq portes
    où une entreprise publie** — `/artisan`, `/immo`, `/emploi`, `/evenement`, `/job-etudiant` — sans
    être redéposée. Deux conséquences, à ne pas « corriger » plus tard : elle **survit à l'échéance**
    d'une fiche (sinon un artisan redéposerait son logo chaque année), et **il n'y a pas de logo par
    fiche** : une seconde image par porte serait une seconde vérité à synchroniser ;
    c) **facultative, jamais un cadre vide** (décision 29). Une fiche sans image **réserve la place et la
    laisse blanche** : pas de cadre, pas de fond, pas de « sans photo », et **pas de monogramme
    inventé** — une initiale dans un carré coloré fabriquée par nous passerait pour la marque de
    l'entreprise. Le blanc est ce qui tient les noms alignés ;
    d) **technique** : carré, 200 px minimum, 5 Mo au plus, JPEG/PNG/WebP, **SVG refusé** (il peut porter
    du script), recadrage centré **avec aperçu avant validation**, ré-encodage par nous, nom d'origine
    remplacé par un identifiant, et **métadonnées effacées à l'envoi**. Ce dernier point n'est pas de
    l'hygiène : une photo prise au téléphone porte les **coordonnées GPS**, donc l'adresse exacte, et
    les garder rendrait fausse la promesse « une zone est une liste de communes » **sans que rien ne le
    montre à l'écran** ;
    e) **déclarée et relue** : le professionnel déclare que l'image est celle de son entreprise et qu'il
    en a les droits. Sont **refusés** une photo de banque d'images, le chantier d'un confrère, une
    personne identifiable sans son accord, et **un numéro de rue d'un logement privé** — un indépendant
    qui travaille chez lui publierait son adresse sans le vouloir, et c'est le seul endroit où elle
    entrerait en base ;
    f) **un remplacement ne contourne pas la pré-modération** : l'image en ligne **reste affichée jusqu'à
    ce que la nouvelle soit acceptée**. Sans ça, on publie un logo propre, puis on le remplace ;
    g) **portée au 25/10/2026 : les cinq maquettes la portent**, pas seulement la spec — `/artisan`
    (36 px dans l'annuaire, 72 px sur la fiche, 26 px en mobile), `/immo` (46 px, logo de l'agence),
    `/emploi` et `/job-etudiant` (38 px, **la même image** : la boulangerie n'a pas de logo, elle a mis
    une photo de sa façade), `/evenement` (44 px, logo de l'ASBL). Le contrôle est **un seul script pour
    les cinq portes**, `maquettes/verifie-images-de-marque.py` — **34 contrôles, 0 échec** : carré, taille
    de l'emplacement, angles arrondis, et **aucun monogramme fabriqué par nous**. Il vérifie aussi, par
    signature du SVG, que **c'est bien la même image** qui sert sur deux portes.

    Spécifications : `SPEC-ARTISAN.md` § 4 bis (le détail), `SPEC-IMMO.md` § 6 (le cas d'origine).

38. **LE SOCLE EST CONSTRUIT — un compte, une base, huit portes.** (25/10/2026, demande de
    l'utilisateur : « *l'inscription est valable dans toutes les portes* », « *toutes les bases de
    données doivent être partagées et doivent être les mêmes* », « *dans certaines portes il devrait y
    avoir des informations complémentaires à apporter* »)

    Ces trois phrases ne sont pas des fonctionnalités : ce sont trois contraintes qui ferment chacune
    une sortie que le code aurait prise tout seul. Elles sont **tenues par le code et par des
    épreuves**, pas seulement écrites :

    a) **une seule table `comptes`** — une épreuve refuse toute table qui ressemblerait à
    `comptes_<porte>` ; un seul cookie `kazendra_session`, `Path=/`, `Domain=kazendra.com`,
    `HttpOnly`, `SameSite=Lax`, jeton **haché** en base ;
    b) **une seule base**, un fichier SQLite (`donnees/kazendra.db`, fourni par Node 22, zéro
    dépendance). Les portes ne sont pas des applications avec leur base : ce sont des **tables dans la
    même base**. Aucune donnée du socle (nom, e-mail, téléphone vérifié, commune, numéro d'entreprise,
    image de marque) n'est recopiée dans une table de porte — une épreuve compare les colonnes des six
    tables d'extension à cette liste ;
    c) **les informations complémentaires** vivent dans `socle/portes.mjs`, seule source de vérité :
    pour chaque porte, qui peut publier, si le BCE et le téléphone vérifié sont exigés, la table
    d'extension, la pré-modération, et **pour chaque champ la phrase montrée à l'utilisateur et l'écran
    où le régler**. Les exigences conditionnelles y sont aussi (IPI si agence, BCE si organisateur
    autre qu'un particulier, assurance si métier de construction).

    Application : `/opt/data/webdev/projects/kazendra`, port **4204**, proxy `/p/kazendra`.
    Spécification et limites assumées : **`SPEC-SOCLE.md`** (décisions 38 à 44).
    Épreuves : **22** sur la base et les règles (`node --test`), **38** de bout en bout par HTTP
    (`tests/epreuve-http.sh`, sur une base jetable).

    ⚠️ **Aucune porte n'est branchée** : elles répondent **501** avec une phrase vraie. Aucun courriel ni
    SMS n'est envoyé (`KAZENDRA_DEV=1` renvoie le code dans la réponse, et la page le dit en rouge) — le
    jour de la mise en ligne publique, cette variable doit passer à `0`.

## Comptes d'administration : trois degrés (décision du 23/10/2026)

L'utilisateur veut **choisir le degré de chaque modérateur**. Trois niveaux, pas un seul.

**1. Accès complet — le propriétaire**
Tout : modération, argent, factures, réglages des portes et des prix, gestion des comptes
d'administration, export et suppression de données (RGPD). Double authentification obligatoire.

**2. Accès modéré**
Toute la modération : file d'attente, garder / masquer / retirer, demande de correction au
déposant, **suspension d'un compte**, et accès aux coordonnées d'un déposant **uniquement dans
un dossier ouvert** (l'accès est journalisé). Pas d'argent, pas de réglages, pas de gestion des
admins, pas d'export RGPD.

**3. Strict nécessaire**
La file d'attente et trois décisions : garder, masquer, retirer. Le contenu suffit à décider.
Aucune coordonnée (ni e-mail, ni téléphone), aucune suspension de compte, aucun historique
au-delà de l'annonce concernée, aucune donnée exportable.

Communs aux trois : **journal inaltérable** (qui, quoi, quand), **sessions séparées** — jamais
un compte partagé, un compte commun rend le journal inutile — et révocation immédiate d'un
accès sans toucher aux autres.

## Modèle européen (cible à tenir dès la première ligne)

- **Pays ≠ langue.** Un Italien consulte l'immobilier en France : interface en italien,
  annonces en français. Un Belge regarde les annonces en Espagne de la même façon.
- **L'adresse ne porte ni le pays ni la langue** : une seule adresse, un sélecteur de pays,
  et la langue en préférence (compte ou cookie). Le pays vit dans les données, pas dans l'URL.
- **Le contenu n'est jamais traduit automatiquement.** Une annonce reste dans la langue de
  son auteur, avec son pays affiché. Une machine qui « traduit » une annonce, c'est une
  promesse qu'on ne peut pas tenir (et un risque de contresens commercial).
- **Chaque pays a ses règles** : prix, TVA (guichet unique OSS dès que les ventes dépassent
  le seuil belge), facturation, obligations de plateforme (DSA), immobilier, emploi.
- **La modération limite l'ouverture** : on n'ouvre un pays que si on peut lire ce qui s'y
  publie. Ouvrir l'Espagne sans lecteur espagnol, c'est modérer à l'aveugle.
- **Devise** : chaque annonce dans la devise de son pays (règle déjà appliquée sur Kazendra).
- **Hébergement** : une box domestique ne sert pas l'Europe entière. À trancher avant
  l'ouverture du deuxième pays, pas après.

## Qui paie quoi (à valider catégorie par catégorie)

- `/promo` — rien à vendre aux entreprises : ce sont les commissions d'affiliation qui
  paient. Une « mise en avant » payante reste possible plus tard.
- `/annonce` — particulier gratuit, avec un **quota d'annonces actives** ; boutique ou
  professionnel = compte entreprise payant.
- `/immo` — bailleur particulier gratuit ; agence immobilière = payant (elle est entreprise).
- `/evenement` — organisateur particulier ou ASBL gratuit ; organisateur commercial payant.
- `/rencontre` — gratuit pour tout le monde. **C'est la porte qui coûte le plus en modération
  et qui rapporte le moins** : elle se finance par les autres, il faut l'assumer.
- `/job-etudiant` — familles et étudiants gratuits ; rubrique entreprises payante.
- `/emploi` — particulier gratuit (consultation) ; entreprise payante pour publier.

## Plan d'adressage

```
kazendra.com  ← un proxy, seul point d'entrée public
├── /            hub : accueil, compte, recherche transversale
├── /promo       affiliation (statique, 2,4 Mo, contenu inchangé)
├── /annonce     petites annonces (particulier → particulier)
├── /immo        immobilier
├── /evenement   événements
├── /rencontre   rencontres
├── /job-etudiant  étudiants ↔ entreprises/ASBL
├── /emploi      adultes et entreprises
└── /artisan     artisans et services à domicile (fiche + demande de devis)
```

## Quatre mécaniques pour huit portes (à valider)

- **A — Annonces** (P→P) : dépôt, photos, recherche par lieu, contact, signalement.
  Sert `/annonce`, `/immo`, `/evenement`, `/rencontre` (+ âge/consentement/messagerie
  pour rencontres).
- **B — Offres** (organisation → candidat) : publication d'offre, recherche, alerte.
  Sert `/emploi` et `/job-etudiant`.
- **C — Affiliation** : le collecteur existant. `/promo` reste tel quel.
- **D — Annuaire professionnel** : fiche qui dure (métier, zone, photos, assurance déclarée),
  recherche par métier et par zone, demande de devis. Sert `/artisan`.
  Deux différences avec les annonces : la fiche ne s'expire pas au bout de 30 jours, et son
  auteur est une entreprise vérifiée, pas un particulier.

Écrire quatre mécaniques au lieu de huit applications complètes, c'est la seule façon de
ne pas coder huit fois la même recherche, la même modération et la même page de contact.

## Coûts mesurés

- `/promo` : 15 pages HTML (dont 9 légales), 607 liens affiliés, 26 acteurs, 45 fichiers,
  aucune base de données, aucun compte utilisateur. Panneau admin = login côté navigateur,
  donc **à refaire** pour un compte unique (vraie authentification serveur).
- Renommage « Entraide » → « Job étudiant » : **38 occurrences** dans 20+ fichiers de
  `/opt/data/app3`, tous des maquettes et documents, rien de publié. Coût faible, mais les
  pages HTML sont **générées** par les scripts `rendu-*.py` : corriger les scripts, pas le HTML.
- Messagerie de vérification de compte : `kazendra.com` a déjà des MX OVH et un SPF
  (`include:mx.ovh.com`) → envoi possible sans tiers ni clé API.

## Le prix à payer (à assumer explicitement)

La racine passe de GitHub Pages (CDN gratuit, quasi increvable) à la box de l'utilisateur.
Une coupure de courant ou de connexion = **tout le domaine tombe**, pas seulement un service.
Parade : copie statique de secours + bascule DNS. Elle ne compte que si elle a été **testée
une fois pour de vrai**. À planifier avant la mise en production.

## Direction visuelle — VALIDÉE par l'utilisateur le 23/10/2026

Maquette de référence : `maquettes/accueil.html` (source) et `maquettes/accueil-1440.png`
(capture 1440 px, `maquettes/capture.py` pour la refaire). Ce qui est figé :

- **Fond** `#0D3B5B` bleu nuit, dégradé de `#0A2F49` à `#13496D` dans l'en-tête/héros.
  Accent unique `#EB912D` (orange), jamais deux accents concurrents.
- **Logo = ses pixels**, jamais redessiné. Affiché 42×44 px, coins arrondis 11 px.
- **Une seule recherche** en haut (quoi / où / rayon) — c'est ce qui fait le hub.
- **Huit portes en cartes égales** ; une seule porte allumée (promos), les autres marquées
  « Bientôt ». On n'affiche jamais une porte vide comme si elle marchait.
- **Ton des textes** : phrases courtes, pas de superlatif, pas de « révolutionnaire ».
  Une promesse = un fait vérifiable (« la remise affichée est réelle »).
- Interdits : tables, plus de 2 niveaux de gris sur les prix barrés, animations au chargement.

## Ordre de construction — VALIDÉ par l'utilisateur le 23/10/2026

Chaque étape se termine par quelque chose qu'on peut **montrer et exercer**, pas par
« c'est codé ».

0. **Socle** — proxy `kazendra.com` → services, HTTPS, sauvegarde quotidienne, et la copie
   statique de secours **testée une fois** (bascule DNS chronométrée). Rien de visible.
1. **`/promo` déménagé** — preuve que le proxy tient, zéro contenu perdu, une redirection
   301 par ancienne URL (`/cgu.html` → `/promo/cgu.html`, etc.).
2. **Compte unique** — inscription, connexion, vérification par e-mail (SMTP OVH), session
   partagée entre les portes. Toujours aucune annonce.
3. **`/annonce`** — le moteur complet : dépôt, photos, recherche par lieu, contact,
   signalement, modération. Base de données pour le dépôt, **pages publiques régénérées en
   statique** (le modèle du collecteur) pour le SEO et la résistance aux coupures.
4. **`/immo`, `/evenement`, `/rencontre`** — trois habillages du même moteur. Rencontres en
   dernier : âge, consentement, 18+, messagerie.
5. **`/job-etudiant`** — services (argent hors application) + rubrique entreprises payante,
   Stripe en mode test puis réel quand le numéro d'entreprise existe.
6. **`/emploi`** — affichage seul, le plus simple.
7. **`/artisan`** — annuaire professionnel + demande de devis, en pré-modération. Payant pour
   le professionnel, donc à ouvrir quand la grille de prix est stabilisée.

## Paramètres à fixer (propositions, non tranchées)

- **Prix par annonce, 30 jours, HTVA — grille par porte** (hypothèses de marché, voir plus
  bas) : `/annonce` 5 € · `/evenement` 12 € · `/job-etudiant` 25 € · `/emploi` 39 € ·
  `/immo` 49 € · `/artisan` 79 € pour 365 jours.
  Le prix suit ce que l'acheteur gagne avec l'annonce, pas ce qu'elle nous coûte : une
  boutique qui vend un canapé ne paie pas comme une agence immobilière qui loue un bien.
- **Ces montants sont des hypothèses, pas des relevés.** Les tarifs des plateformes belges
  comparables (Immoweb, 2ememain/2dehands pro, StepStone) ne sont pas publiés : ils sont
  sur devis ou derrière un compte. Trois appels valent mieux que trois suppositions — à
  faire avant l'ouverture de la première porte payante.
- **Quota particulier : 5 annonces actives** en même temps ; renouvellement libre.
- **Durée de vie : 30 jours**, renouvelable en un clic, deux rappels dans le tableau de bord
  (J−7 et J−2).
- **Modération : publication immédiate, contrôle sous 24 h**, retrait sur signalement.
  Publier d'abord, vérifier ensuite — sinon rien ne se remplit jamais.
  Exception : `/rencontre`, où rien ne se publie sans âge déclaré et consentement.
- **Ouverture d'une porte payante** : seulement quand la porte gratuite correspondante a du
  trafic. Une entreprise ne paie pas pour parler à personne.

## Vue globale — structure du plan maître

Objectif fixé par l'utilisateur le 23/10/2026 : **terminer la vue d'ensemble avant de
descendre dans une application**. Dix blocs, chacun marqué fait / à remplir.

1. **Portes et adressage** — ✅ fait (8 portes, chemins, indépendance, quatre mécaniques).
2. **Le compte unique** — à remplir : inscription, vérification par e-mail, particulier ou
   entreprise (numéro BCE vérifié en local), mot de passe oublié, suppression du compte.
3. **Ce que chaque porte sait faire** — ✅ carte écrite et validée le 23/10/2026
   (voir « Carte des huit portes »).
4. **Mécaniques partagées** — ✅ fait dans les grandes lignes (annonces, offres, affiliation).
5. **L'argent** — ✅ écrit : qui paie, grille par catégorie, à l'annonce, Stripe, remboursement
   aux 3/4, note de crédit. Reste à vérifier à la source : TVA (franchise) et facture
   électronique B2B.
6. **Modération et signalement** — ✅ écrit : file unique, quatre décisions, 3 signalements →
   masquage provisoire, rencontres en pré-modération, journal 24 mois, modération continue
   par plusieurs personnes avec rôles distincts.
7. **Données et RGPD** — ✅ proposition écrite le 23/10/2026 (voir « Données et durées »).
8. **Panneau d'administration** — ✅ décidé : un seul panneau pour tout le projet, un onglet
   par application, des rubriques par application ; trois degrés d'accès et limitation par
   porte.
9. **Résilience** — 🟠 écrit ; reste à **exercer** : restauration réelle chronométrée et
   bascule DNS testée, une fois chacune.
10. **Langues et marque** — ✅ cible Europe, V1 en français avec fichiers de langue ; **une seule
    marque, Kazendra**, et les portes sont des intitulés descriptifs (« Promos », « Annonces »,
    « Immobilier »…), pas des marques séparées.

## Le compte unique (proposition à valider)

- **Un compte pour les huit portes et pour tous les pays.** Le même identifiant sert à
  Bruxelles et à Barcelone.
- **Ce qu'il porte** : e-mail vérifié, mot de passe haché, pseudo, langue préférée, pays de
  résidence, code postal (centre de la recherche par défaut), devise.
- **Deux natures, un seul compte** : particulier, ou entreprise (numéro BCE vérifié en local,
  dénomination, adresse de facturation). Une casquette entreprise peut s'ajouter plus tard au
  même compte — un commerçant vend aussi des affaires personnelles.
- **Ce qu'il ne contient jamais** : pièce d'identité, IBAN du particulier, CV.
- **Consultation libre sans compte** ; le compte n'est exigé que pour publier, contacter,
  suivre un favori ou recevoir une alerte.
- **Publier exige deux preuves** : e-mail vérifié **et** téléphone vérifié par SMS. Le numéro
  sert à vérifier, pas à démarcher : il n'est affiché dans une annonce que si l'auteur le
  décide. Un numéro = un compte (freine la récidive après exclusion).
- **Coût par inscription** : chaque nouvelle inscription coûte un SMS. **Relevé le 25/10/2026**
  sur la page publique `ovhcloud.com/fr/sms/prices` : **aucun abonnement ni frais cachés**, on
  n'achète que des crédits, dégressifs — 100 SMS à **0,06 € HT** pièce (6 € HT / 7,20 € TTC),
  1 000 SMS à **0,058 €** (58 € HT), 10 000 SMS à **0,054 €** (540 € HT), jusqu'à 0,048 € au
  million. **Réserve à lever :** ces prix valent pour un envoi vers la **France métropolitaine**
  (note du tarif : « 1 crédit = 1 SMS envoyé en France métropolitaine »). Un SMS vers **+32** est
  une destination étrangère ; le tarif Belgique n'est lisible ni sur la page publique (sélecteur
  par pays non exploitable sans compte) ni via l'API `/sms/rates`, qui exige une authentification.
  **Le chiffre ci-dessus est donc une borne basse, pas le prix belge.** Trois façons de le lever,
  par ordre de coût : (1) les **20 crédits offerts** annoncés sur la même page — ouvrir le service,
  envoyer un SMS vers un +32, lire la consommation de crédits : le tarif belge est alors mesuré,
  pas supposé ; (2) demander la grille au support OVH avant l'ouverture ; (3) acheter le plus
  petit pack (100 SMS, 6 € HT) comme plafond de dépense du pilote. **Ne pas ouvrir l'inscription
  au public avant (1) ou (2)** : un tarif inconnu sur une dépense par inscription n'est pas un
  budget, c'est une surprise.
- **Suppression** en un clic : annonces retirées, profil effacé ; les factures restent le
  temps légal de conservation comptable (durée à vérifier à la source, pas au doigt mouillé).
- **Sécurité** : mot de passe haché, sessions révocables, limitation des tentatives,
  pas de double authentification au départ — à ajouter pour les comptes entreprise.

## Carte des huit portes (vue globale)

Adresse unique, sélecteur de pays, langue en préférence (décision du 23/10/2026). Pour chaque
porte : qui publie, ce qu'on peut y faire, ce que ça coûte, et la règle qui lui est propre.

**Le hub** (hors portes) : accueil, recherche transversale, tableau de bord, compte, messages,
notifications. C'est le seul endroit qui voit les huit portes à la fois.

1. **`/promo`** — publie : le collecteur, jamais l'utilisateur. Écrans : liste filtrée,
   détail d'une offre, favoris, alertes de prix. Actions : suivre un produit, partager.
   Règle propre : prix dans la devise du pays, taux BCE du jour, remise réellement vérifiée.
   Coût : gratuit (ce sont les commissions qui paient).
2. **`/annonce`** — publie : particulier et boutique. Écrans : liste filtrée, détail, dépôt
   en 4 étapes, mes annonces. Actions : publier, modifier, renouveler, marquer vendu,
   contacter, signaler, mettre en favori. Règle propre : 5 annonces actives par particulier,
   30 jours, publication immédiate puis contrôle sous 24 h. Coût : gratuit / 5 € entreprise.
3. **`/immo`** — publie : bailleur et agence. Écrans : liste (type, budget, chambres,
   surface, distance), détail, carte. Actions : contacter, favori, alerte. Règle propre :
   la performance énergétique (PEB) figure dans le formulaire — obligation d'annonce en
   Belgique, **à vérifier pays par pays**. Coût : gratuit / 49 € agence.
4. **`/evenement`** — ✅ **CLOSE le 25/10/2026** (`SPEC-EVENEMENT.md`, § 25). Publie : particulier,
   ASBL, commune, école, organisateur commercial. Écrans : agenda par date, fiche, **sortie à
   plusieurs**, dépôt en 4 étapes, signaler, mes événements. Actions : marquer intéressé, y aller à
   plusieurs, exporter en agenda (.ics), partager, signaler. Règles propres : **lien d'itinéraire,
   jamais une carte** ; **rien à vendre** — pas de billetterie, pas d'acompte, revente de billets
   interdite ; la **date commande la durée** (en ligne jusqu'à la fin + 7 jours, affichage au plus tôt
   à J−90) ; **série de dates, pas de récurrence automatique** (choix du 24/10/2026) ; **deux régimes
   de lieu** (public = adresse affichée, privé = code postal et commune seuls) ; **sorties à plusieurs**
   greffées sur la fiche (décision 30, § 23) ; **12 catégories**, dont `cinema` ; cinq motifs de
   signalement ; « intéressé » donne un **nombre**, jamais une liste de noms. Coût : gratuit / 12 €
   organisateur commercial.
5. **`/rencontre`** — ✅ **CLOSE le 25/10/2026**, zéro question ouverte (`SPEC-RENCONTRE.md`, § 19).
   Publie : majeur uniquement. Écrans : découverte, profil, messages, mon profil, **page Sécurité**.
   Actions : intéressé, passer, bloquer, signaler, mettre en pause. Règles propres :
   18 ans révolus, e-mail et téléphone vérifiés, **une personne = un profil** ; le champ « je cherche »
   est **privé** parce que l'orientation sexuelle est une donnée sensible (art. 9 RGPD) ; la
   conversation ne s'ouvre **qu'après intérêt mutuel** ; **aucune image dans la messagerie** (mesure
   anti-chantage) ; **aucun profil indexé** et **aucun bouton de partage** ; masqué par défaut dans le
   tableau de bord. **Photos facultatives** (décision 29) : pré-modération quand il y en a, et
   **pré-modération du texte des comptes de moins de 7 jours** — c'est ce qui remplace le tri par le
   visage. Les quatre arbitrages du 25/10/2026 : **18 ans fermes et une seule plage d'âge continue
   (aucune tranche)** · **pas de mode « ma commune »**, le curseur nomme sa position basse
   « Ma commune (0–2 km) » · **pas de vérification biométrique du visage**, refusée en V1 et au-delà ·
   **zéro photo obligatoire**. Coût : **gratuit pour tout le monde**.
   Spec : `SPEC-RENCONTRE.md`. **Speed dating vidéo : hors V1**, à reprendre comme objet séparé
   (trois conditions techniques déjà mesurées, spec § 15).
6. **`/job-etudiant`** — publie : étudiant (service), famille (demande), entreprise
   (rubrique payante). Écrans : liste des services, détail, dépôt, rubrique entreprises.
   Actions : proposer, demander, contacter. Règle propre : l'argent circule **hors
   plateforme**, aucune candidature traitée, aucun suivi d'engagement. Coût : gratuit / 25 €.
7. **`/emploi`** — publie : entreprise (BCE vérifié). Écrans : liste (métier, lieu, contrat,
   temps), détail, dépôt, mes offres. Actions : **écrire à l'employeur** (`mailto:` pré-rempli,
   décision 35), favori **en stockage local** (aucun compte candidat, donc aucun favori côté
   serveur), partager, signaler. Règle propre : **aucun CV stocké, aucune candidature reçue ni
   transmise**, affichage seul ; l'adresse de l'employeur est publique, jamais dans le HTML servi,
   et effacée avec l'annonce. Coût : gratuit à la consultation / **gratuit au lancement** pour
   publier, 39 € en réglage. Spec : `SPEC-EMPLOI.md`.
8. **`/artisan`** — publie : entreprise vérifiée par son numéro BCE. Écrans : annuaire par
   métier et par zone, fiche professionnelle (métiers, zone d'intervention, photos de
   réalisations, assurance déclarée, horaires, contact), demande de devis. Actions : demander
   un devis, appeler, signaler. Règles propres : **pré-modération** avant publication — un
   faux plombier entre chez les gens ; **aucune certification du savoir-faire** : on affiche
   ce que le professionnel déclare, on ne garantit pas sa compétence, et c'est écrit sur la
   fiche. Ni avis ni note au départ : un avis, ça se modère et ça s'attaque. Coût : fiche
   payante pour le professionnel, gratuit pour le particulier.

## Données et durées (proposition)

Principe : on garde le minimum, chaque durée a une raison, et tout ce qui n'a plus de raison
s'efface tout seul.

- **Annonce active** : 30 jours. Expirée : 30 jours de récupération possible, puis effacement
  complet (photos comprises). Aucune annonce ne dort indéfiniment dans la base.
- **Messages** : 12 mois après le dernier échange, puis effacement.
- **Compte inactif** : 24 mois sans connexion → un e-mail d'avertissement, puis suppression.
- **Téléphone** : gardé tant que le compte existe (il sert à la vérification), effacé 30 jours
  après la suppression du compte.
- **Journaux de sécurité** (connexions, IP) : 12 mois.
- **Journaux de modération** (signalements, décisions, retraits) : 24 mois — c'est la preuve
  qu'on a agi, en cas de litige.
- **Factures** : la durée comptable légale belge, à vérifier à la source avant d'écrire un
  chiffre dans les CGU.
- **Localisation** : commune et code postal seulement. **Jamais** la position GPS exacte
  enregistrée avec une annonce (choix confirmé par l'utilisateur le 23/10/2026).
- **Aucun traqueur publicitaire, aucune revente de données.** Déjà vrai sur `/promo`.
- **Droits** : accès et export de ses données en un clic (fichier lisible), suppression en un
  clic, un point de contact « données » joignable — pas besoin d'un délégué à la protection
  des données à cette taille, mais l'adresse doit exister.
- **Sous-traitants à publier** : OVH (courrier, SMS), Stripe (paiement), et l'hébergeur de la
  copie statique de secours. La liste des sous-traitants est une obligation, pas une option.

## Résilience (proposition)

- **Sauvegarde quotidienne** de toutes les bases et des photos : une seule archive, chiffrée,
  écrite **hors du dossier servi au public**.
- **Copie hors du domicile** : ✅ **disque chiffré qui voyage** (choix de l'utilisateur le
  23/10/2026). Aucune société n'intervient, la clé reste chez lui, le disque change de
  bâtiment une fois par semaine. Deux copies dans la même pièce protègent d'une panne, pas
  d'un incendie.
- **Restauration testée une fois pour de vrai**, chronométrée, avec le résultat consigné
  (date, durée, ce qui a été restauré). Une sauvegarde jamais restaurée n'est pas une
  sauvegarde, c'est une croyance.
- **Copie statique de secours** des pages publiques + bascule DNS, elle aussi testée et
  chronométrée — c'est la parade à la box qui tombe.
- **Surveillance** : le hub vérifie chaque porte (réponse applicative, pas seulement le port)
  et alerte par e-mail dès qu'une porte ne répond plus.
- **Journal des incidents** : date, cause, durée. Pour ne pas refaire deux fois la même erreur.

## Modération (procédure proposée)

- **Qui** : l'utilisateur, depuis le panneau unique. Pas de modérateur externe au départ.
- **Une seule file d'attente**, toutes portes confondues, triée par porte et par âge. Chaque
  contenu publié y entre automatiquement : c'est le « contrôle sous 24 h » promis au visiteur.
- **Quatre décisions possibles** : garder, masquer, retirer, suspendre le compte. Plus une
  demande de correction au déposant (message type).
- **Trois signalements distincts** sur un même contenu → masquage automatique provisoire, puis
  décision humaine. Un seul signalement ne masque rien : sinon le premier venu fait ta loi.
- **`/rencontre` en pré-modération** : rien n'est visible avant contrôle. C'est la seule porte
  où l'on paie ce délai, parce que le risque y est plus élevé.
- **Chaque décision est journalisée** (qui, quoi, quand, pourquoi) et conservée 24 mois.
- **Retrait pour contenu illégal** (menace, escroquerie caractérisée, contenu d'atteinte aux
  mineurs) : retrait immédiat, conservation des éléments, et la question du signalement aux
  autorités se traite au cas par cas, avec un écrit.

## Remboursements et cas limites (proposition)

Le paiement arrive **avant** la publication : une annonce payée peut donc être refusée après
coup. Il faut une règle écrite, sinon chaque cas se décide dans l'émotion.

- **Contenu qui viole les règles** (illégal, trompeur, interdit) : **remboursement des trois
  quarts, un quart retenu à titre de frais administratifs** (choix de l'utilisateur le
  23/10/2026). Écrit dans les conditions **avant** le paiement. Chaque remboursement partiel
  donne lieu à une note de crédit — sans elle, la comptabilité ne raconte pas la même histoire
  que le compte en banque.
  *À surveiller :* sur `/immo` à 49 €, le quart retenu fait 12,25 €. Si ça devient
  disproportionné au regard du travail réel, on plafonne le montant retenu.
- **Refus pour un motif non imputable au déposant** (notre erreur, panne, doublon technique) :
  remboursement intégral, sans discussion.
- **Annonce supprimée par le déposant** dans les premières heures : remboursement si rien
  n'a été publié, pas de remboursement si elle a été en ligne.
- **Panne de paiement** (paiement débité, annonce non publiée) : republication immédiate ou
  remboursement, au choix du client.
- **TVA et facture** : régime de franchise à vérifier à la source, et obligation de facture
  électronique B2B (Peppol) à confirmer avant la première facture émise.

## Ce qui n'a pas de porte (et où ça va quand même)

Question posée par l'utilisateur le 23/10/2026 : a-t-on oublié des services ? Revue des
besoins du quotidien, et décision de rangement pour chacun.

**Absorbé par une porte existante, en catégorie** (aucune porte à créer) :
- location de matériel entre particuliers (perceuse, remorque) → `/annonce`, avec une option
  « location » en plus de « vente » et « don »
- dons et gratuité → `/annonce`, filtre « à donner »
- colocation et chambre chez l'habitant → `/immo`, type de bien
- cours particuliers et soutien scolaire → `/job-etudiant`
- animaux (adoption, garde) → `/annonce`
- objets trouvés → `/annonce`, catégorie
- parking, garage, box → `/immo`

**Candidat sérieux à une huitième porte : « Artisans & services »** — ✅ **ouverte le
23/10/2026** (décision 23). Voir la porte n° 8 dans la carte des portes ci-dessus.

**Écarté volontairement** :
- **santé** (médecins, pharmacies de garde) : la publicité pour les professions de santé est
  encadrée en Belgique — à vérifier à la source avant même d'y penser.
- **transport et covoiturage** : réglementation lourde, acteurs déjà installés, aucun revenu
  clair pour un particulier.

**Principe** : chaque porte ouverte, c'est de la modération en plus et de l'attention en moins
pour les autres. Un hub gagne par la profondeur de ses portes, pas par leur nombre.

## Points ouverts

- [x] ~~Ordre de construction~~ → **validé le 23/10/2026**, étapes 0 à 7.
- [ ] Servir les annonces en statique (modèle du collecteur) ou en dynamique.
- [ ] Nom public de l'app job étudiant : « Job étudiant » est **descriptif**, donc ni
      protégeable ni trouvable seul → nom propre + sous-titre, à décider.
- [x] ~~Job étudiant : affichage ou mise en relation ?~~ → **affichage seul**, aucune
      candidature ni suivi. Idem `/emploi`.
- [x] ~~Encaisser la rubrique entreprises~~ → **Stripe**, publication par webhook, mis au
      point en mode test, activation manuelle en attendant le numéro d'entreprise.
      Reste à vérifier à la source le jour venu : seuil du régime de franchise de TVA et
      obligation de facture électronique B2B (Peppol).
- [ ] **Public vulnérable** : des annonces mettant en relation des étudiants et des personnes
      du troisième âge. Une clause « simple panneau d'affichage » dans les CGU limite la
      responsabilité, elle ne l'efface pas. Et personne n'est assuré entre les parties : à
      dire noir sur blanc dans les CGU, pas à découvrir en cas de sinistre.
- [ ] Modération : signalement, délais de retrait, RGPD (registre, durées, effacement).
- [ ] Sauvegarde unique de toutes les données + test de restauration.
