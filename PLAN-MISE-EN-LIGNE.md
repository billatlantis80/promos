# Mise en ligne officielle — Europe

Plan d'exécution. Chaque chiffre porte sa source, ou est marqué **NON VÉRIFIÉ**.
Règle du projet : on n'annonce pas un chiffre qu'on ne peut pas prouver.

## Ce qui existe déjà

- Application Android signée (AAB), chaîne de compilation `/opt/data/android-build`
- Site publié : `https://billatlantis80.github.io/promos/`
- 9 langues, pays et langue indépendants
- Collecteur d'offres sans clé API

## Les trois verrous qui décident du calendrier

1. **`applicationId`** — se fige définitivement au premier dépôt sur le Play Store. Nom à arrêter AVANT.
2. **Test fermé 12 testeurs / 14 jours** — compte personnel créé après le 13/11/2023 : obligation avant l'accès production. Décale le lancement de ~3 semaines.
3. **Politique de confidentialité en ligne** — sans URL publique, le Play Store refuse la publication.

---

## ÉTAPE 1 — Nom, domaine, identifiant d'application  🔒 irréversible

- Arrêter le nom définitif.
- Réserver : **`.app`** (le domaine de l'application), **`.be`** (le pays), **`.eu`** (l'Europe).
  Coût : ordre de 10–15 €/an par extension — **NON VÉRIFIÉ**, à confirmer chez le registraire.
- Brancher le domaine sur GitHub Pages (fichier `CNAME` + DNS) : gratuit.
- Fixer l'`applicationId` **avant** tout dépôt.

## ÉTAPE 2 — La marque  (protéger AVANT de publier)

- Un dépôt **UE (EUTM)** couvre les **27 pays de l'Union**, Belgique comprise : un dossier, une langue, un paiement.
- ⚠️ « toute l'Europe » ≠ Union européenne. **Royaume-Uni, Suisse, Norvège, Serbie…** sont hors UE : dossiers séparés. À trancher.
- Classes à viser : **9** (logiciel), **35** (regroupement d'offres, publicité), **42** (services en ligne).
- En Europe, c'est la **date de dépôt** qui donne la priorité — pas la date d'usage. Déposer tôt.
- Taxes EUIPO et BOIP : **NON VÉRIFIÉ**. Pages officielles inaccessibles (403 CloudFront, application JS). À relever sur le barème officiel au moment du dépôt, ou par un conseil en marques.

## ÉTAPE 3 — Le statut et les papiers belges

- Numéro d'entreprise **BCE** + **TVA** (ou régime de franchise — seuil **NON VÉRIFIÉ**).
- Statut : indépendant complémentaire (si tu as un emploi) ou principal — **INASTI**.
- Compte bancaire professionnel.
- Pourquoi c'est un prérequis et pas une formalité : la commission d'affiliation est un revenu d'activité, et le compte **organisation** du Play Store (qui évite le verrou n°2) demande une entité.

## ÉTAPE 4 — Site officiel et pages légales  (obligatoire pour publier)

À rédiger, **dans les 9 langues** :

- Mentions légales
- Politique de confidentialité (RGPD)
- Conditions générales d'utilisation
- Politique de cookies

RGPD : registre des traitements, base légale, durée de conservation, droits d'accès et d'effacement, identification de l'hébergeur.
Bandeau cookies : obligatoire dès qu'un traceur existe (statistiques **ou** liens affiliés).

## ÉTAPE 5 — Compte Google Play

- Inscription : **25 USD, une seule fois** ✅ *(support.google.com/googleplay/android-developer/answer/6112435)*
- Vérification d'identité (pièce d'identité + justificatif d'adresse) — plusieurs jours.
- 🔒 **Test fermé : au moins 12 testeurs inscrits pendant au moins 14 jours sans interruption** pour tout compte **personnel** créé après le 13 novembre 2023 ✅ *(support.google.com/googleplay/android-developer/answer/14151465)*
- Échappatoire : compte **organisation** — exempté, mais exige l'entité de l'étape 3.

## ÉTAPE 6 — Statut de professionnel (règlement DSA)

- Les boutiques d'applications doivent vérifier que l'éditeur est un **professionnel** et **afficher publiquement** son nom, son adresse, son téléphone et son adresse électronique.
- Conséquence concrète : une adresse personnelle peut devenir publique → intérêt d'une adresse d'entreprise.
- Statut faux ou non déclaré = retrait de la fiche.
- Page officielle Google : **NON VÉRIFIÉE** (non chargeable). À confirmer avant de remplir le dossier.

## ÉTAPE 7 — La fiche Play Store, en 9 langues

- Titre 30 caractères · description courte 80 · description longue 4000 — × 9 langues
- Icône 512×512 · bannière 1024×500 · au moins 2 captures d'écran téléphone
- Classement de contenu (questionnaire IARC) + public cible et tranche d'âge
- Formulaire **Sécurité des données** (déclaratif, obligatoire)
- Déclaration de publicité et de liens affiliés
- Coordonnées du professionnel (étape 6)

## ÉTAPE 8 — Affiliation et obligations d'information

- Programme d'affiliation à ouvrir (Amazon Partenaires et autres) — identification des liens.
- **Directive Omnibus** : tout prix barré exige l'affichage du **prix antérieur le plus bas des 30 derniers jours**, sinon pratique commerciale trompeuse.
  → C'est le cœur de l'application : deux prix réels, remise vérifiable, garde-fou ≤ 90 %. La conformité et la qualité ne font qu'un.
- Information du consommateur avant l'achat, signalement visible des liens affiliés.

## ÉTAPE 9 — iOS (plus tard, si utile)

- Apple Developer Program : **99 USD par année d'adhésion** ✅ *(developer.apple.com/programs/enroll/)*
- Mêmes obligations DSA.

## ÉTAPE 10 — Vérifications finales

- Contrôler le **site réellement publié**, pas la copie locale
- Test sur un vrai téléphone
- Les 88 identifiants d'offres en doublon
- La rubrique Nourriture (cartes à un seul prix, alcool, animaux)

---

## Sources vérifiées dans cette session

| Fait | Source |
|---|---|
| Play : 25 USD une fois | support.google.com/…/6112435 |
| Play : 12 testeurs / 14 jours (compte personnel > 13/11/2023) | support.google.com/…/14151465 |
| Apple : 99 USD par an | developer.apple.com/programs/enroll/ |

## Non vérifié — ne pas annoncer tel quel

- Taxes de marque EUIPO et BOIP
- Seuil belge de franchise de TVA
- Prix des domaines
- Page officielle du statut de professionnel (DSA)
