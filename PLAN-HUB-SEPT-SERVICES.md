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
- **Coût par inscription** : chaque nouvelle inscription coûte un SMS. À chiffrer au tarif
  réel du prestataire avant l'ouverture — c'est une dépense qui tombe **avant** toute recette.
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
4. **`/evenement`** — publie : particulier, ASBL, organisateur commercial. Écrans : agenda
   par date, détail, carte, « ce week-end ». Actions : marquer intéressé, exporter en
   agenda (.ics), partager, signaler. Règle propre : **aucune billetterie** — on n'encaisse
   jamais l'argent d'un événement. Coût : gratuit / 12 € organisateur commercial.
5. **`/rencontre`** — publie : majeur uniquement. Écrans : profil, découverte, messages,
   confidentialité. Actions : liker, bloquer, signaler, masquer. Règle propre : âge déclaré
   et consentement avant publication, masqué par défaut dans le tableau de bord, modération
   renforcée. Coût : gratuit, financé par les autres portes.
6. **`/job-etudiant`** — publie : étudiant (service), famille (demande), entreprise
   (rubrique payante). Écrans : liste des services, détail, dépôt, rubrique entreprises.
   Actions : proposer, demander, contacter. Règle propre : l'argent circule **hors
   plateforme**, aucune candidature traitée, aucun suivi d'engagement. Coût : gratuit / 25 €.
7. **`/emploi`** — publie : entreprise. Écrans : liste (métier, lieu, contrat, temps),
   détail avec renvoi vers l'employeur. Actions : favori, suivi personnel, partager.
   Règle propre : **aucun CV stocké, aucune candidature transmise**, affichage seul.
   Coût : gratuit à la consultation / 39 € pour publier.
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
