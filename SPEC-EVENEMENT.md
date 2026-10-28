# SPEC — Porte `/evenement` (agenda local)

Version du 24/10/2026, complétée le 25/10/2026. Compagnon de `SPEC-ANNONCE.md`, `SPEC-IMMO.md`,
`SPEC-RENCONTRE.md` et de `PLAN-HUB-SEPT-SERVICES.md`.

✅ **État : porte CLOSE le 25/10/2026 — aucune question de conception ouverte.** Voir le § 25. Trois
tâches d'exécution restent listées (tarif SMS, mention CGU des sorties, référence Justel), aucune ne
bloque la construction.

Ce document dit **ce que fait `/evenement`, ce qu'elle ne fait pas, ce que la loi belge interdit
d'y laisser passer, et ce qui change par rapport aux deux portes précédentes**.

---

## 1. Ce que fait `/evenement`

Un **agenda local** : des événements ouverts au public, publiés par un particulier, une ASBL, une
commune, une école ou un organisateur commercial. Dépôt, photos (l'affiche), recherche par date et
par lieu, page publique par événement, export au format agenda, marquage « intéressé », signalement.

Trois différences avec `/annonce` et `/immo`, et elles commandent tout le reste :

1. **Un événement a une date.** Une annonce périmée est gênante ; un événement périmé est un
   mensonge. La date n'est pas un champ parmi d'autres, c'est la mécanique de la porte.
2. **Le lieu peut être public.** Pour `/annonce`, publier l'adresse exacte d'un particulier était
   exclu. Une salle, un chapiteau, une place communale sont des lieux publics : leur adresse doit
   être affichée, sinon l'agenda ne sert à rien.
3. **L'argent circule encore moins ici qu'ailleurs.** On n'encaisse rien, on ne vend pas de place,
   on ne rembourse rien — et on ne laisse pas la porte devenir un comptoir de revente de billets,
   ce qui est **interdit en Belgique au-delà du prix de l'organisateur** (§3).

## 2. Ce que `/evenement` ne fait PAS (et ne fera pas)

- **Aucune billetterie.** Pas de vente de place, pas de prévente, pas de liste d'invités payante,
  pas de remboursement, pas de QR code d'entrée.
- **Aucune revente de billets.** Ni entre particuliers, ni par un revendeur non officiel (§3).
- **Aucune vérification de l'événement lui-même** : Kazendra ne vérifie ni l'autorisation communale,
  ni l'assurance de l'organisateur, ni la conformité du lieu (sécurité incendie, capacité), ni la
  réalité de la programmation annoncée.
- **Aucune garantie de tenue.** Un événement peut être annulé, déplacé, complet : la page le dit,
  et l'organisateur doit pouvoir le signaler en un clic (§10).
- **Pas d'événements privés.** La porte n'accueille que des événements **ouverts au public** —
  anniversaire, garden-party, mariage sont refusés à la publication. Sans cette règle, la porte
  devient un annuaire d'adresses privées.
- Pas de covoiturage, pas de vente de nourriture à distance, pas de réservation de table.
- Pas de notes ni d'avis en V1 (même choix que `/annonce` et `/immo`).
- Pas de commentaires publics : « intéressé » est un compteur privé, pas un mur de messages.

Conséquence à écrire dans les CGU : **Kazendra affiche une annonce d'événement ; l'organisateur
seul répond de son contenu, de son autorisation et de son déroulement.**

## 3. Revente de billets — la règle légale, vérifiée

> **Source** : SPF Économie, page « Revente de tickets de concert »,
> `https://economie.fgov.be/fr/themes/protection-des-consommateurs/stop-arnaques/les-principales-arnaques-en/ventes-douteuses-ou-agressives/revente-de-tickets-de-concert`
> — consultée le **24/10/2026** (HTTP 200).
> **Citation littérale** : « En Belgique, la revente de billets de spectacle à un prix supérieur à
> celui fixé par l'organisateur est interdite. »
> La même page ajoute : « Achetez vos billets uniquement auprès du revendeur officiel. »

Ce que ça impose à la porte, concrètement :

1. **Aucun champ « billet à vendre »**, aucune rubrique « places disponibles ». La porte ne connaît
   que des **événements**, jamais des billets.
2. **Détection automatique à la publication** : les formules « billet(s) à vendre », « place(s) à
   vendre », « revente », « prix libre pour une place » déclenchent le **blocage** et un renvoi vers
   la page du SPF. L'annonce peut être corrigée puis republiée.
3. **Le champ « billetterie » est une liste fermée** (§8) : sur place · chez l'organisateur ·
   lien officiel déclaré. Aucun champ libre où coller une annonce de revente.
4. **Bandeau permanent sur la page** : « Kazendra n'encaisse rien. Achetez vos billets uniquement
   auprès de l'organisateur ou sur place. »
5. **Un signalement « billet / revente »** existe dans la liste des motifs, et passe en priorité
   haute dans la file de modération.

> ⚠️ **Ce qui reste à confirmer** : la page du SPF énonce la règle sans citer son article. La base
> légale est très probablement la loi du 30 juillet 2013 relative à la revente de billets d'entrée
> pour des événements, **mais je ne l'ai pas lue sur Justel** — donc je ne la cite pas dans les CGU
> tant qu'elle n'est pas vérifiée à la source. La règle de droit, elle, est sourcée ci-dessus.

## 4. Catégories (liste fermée — 12)

Même principe que `/annonce` : identifiant stable, libellé traduit, une catégorie vide ne s'affiche
pas, aucun mot affiché n'est stocké.

- `musique` — Musique & concert
- `scene` — Spectacle, théâtre & humour
- **`cinema` — Cinéma & projection** *(ajoutée le 25/10/2026, décision 30)*
- `culture` — Exposition & culture
- `fete` — Fête, kermesse & brocante
- `marche` — Marché & terroir
- `sport` — Sport & mouvement
- `famille` — Enfants & famille
- `atelier` — Atelier & formation
- `nature` — Nature & balade
- `local` — Vie locale & citoyen (réunion de quartier, don du sang, nettoyage)
- `gout` — Gastronomie & dégustation

> **Pourquoi `cinema` alors que la règle dit « pas de catégorie sans trois propositions réelles » ?**
> Parce que cette règle vise les catégories fourre-tout créées à l'avance. Ici, une fonctionnalité
> décidée (les sorties à plusieurs, § 23) repose sur l'existence d'une fiche : une séance de cinéma
> n'entre ni dans `scene` (spectacle vivant) ni dans `culture` (exposition). Sans cette catégorie, la
> demande de l'utilisateur — « cinéma » — n'est pas couverte. La règle des trois propositions reste
> valable pour tout le reste.

« Divers » n'existe pas ici : une catégorie fourre-tout sur un agenda noie les dates. Si une
proposition ne rentre dans aucune case, elle est refusée à la publication avec la liste sous les
yeux — et on crée la catégorie quand **trois** propositions réelles la réclament, pas avant.

## 5. Champs d'un événement

| Champ | Règle |
|---|---|
| Titre | 60 caractères, obligatoire, pas de majuscules hurlées, pas d'emoji en tête |
| Catégorie | une seule, dans la liste fermée du §4 |
| Date de début | obligatoire, date + heure |
| Date de fin | optionnelle ; si absente, l'événement est ponctuel |
| Plusieurs dates | jusqu'à **8 dates** (une ligne par date) — voir §6 |
| Fuseau | déduit du pays, jamais saisi (`Europe/Brussels` en Belgique) |
| Lieu — régime | `lieu public` ou `adresse privée` (§7) |
| Nom du lieu | obligatoire en régime public (« Salle communale », « Place du Marché ») |
| Adresse | rue + numéro + code postal + commune en régime public ; **code postal + commune seuls** en régime privé |
| Itinéraire | lien Google Maps généré, jamais saisi (§7) |
| Entrée | `gratuit` · `payant` · `participation libre` (§8) |
| Prix | obligatoire si payant : **prix total, TVA comprise**, devise du pays ; jamais « à partir de » |
| Détail du prix | facultatif, 80 caractères (« 12 € prévente · 15 € sur place ») |
| Billetterie | liste fermée : `sur place` · `chez l'organisateur` · `lien officiel déclaré` (§8) |
| Accessibilité PMR | `oui` · `partiel` · `non` · `non communiqué` |
| Âge minimum | `tout public` · `12+` · `16+` · `18+` |
| En plein air | oui / non |
| Langue de l'événement | pré-remplie avec la langue de l'interface, modifiable |
| Description | 200 à 2 000 caractères, texte libre sans HTML, titre « À propos de cet événement » |
| Affiche | **0 à 3 images, jamais obligatoire** (règle du hub, décision 29 du plan, 25/10/2026) ; redimensionnées par nous, **jamais de SVG téléversé**. Sans affiche, la fiche affiche la date en grand sur fond bleu nuit — pas de cadre vide, pas de mention « sans affiche » |
| Organisateur | nom affiché (pseudo ou dénomination), type, badge si numéro vérifié |
| Contact | **messagerie Kazendra uniquement**, aucun téléphone publié |

Champs refusés volontairement : « nombre de places », « nombre d'inscrits », « liste des
participants », « programme heure par heure » (un programme change, une page ne se met pas à jour
toute seule — il va dans la description, avec l'avertissement que l'organisateur peut le modifier).

**Ne figurent jamais dans une fiche publique** (liste de non-régression, à relire avant chaque mise
en ligne) : l'adresse exacte en régime privé (§7), le nom de famille d'un organisateur particulier,
l'e-mail, le téléphone, l'IBAN, le nombre de places, la liste des inscrits, un lien de paiement,
un prix barré.

## 6. Dates, récurrence et durée de publication — la règle propre de la porte

C'est ici que `/evenement` se sépare franchement de `/annonce` (30 jours) et de `/immo` (durée
choisie, 6 mois maximum).

**a. Un événement = une date, ou une série de dates choisies une par une (8 maximum).**
**Décidé le 24/10/2026** — réponse de l'utilisateur à la question ouverte : « *Oui, tu en restes à la
série.* » Donc **pas de récurrence automatique**, jamais : une récurrence « tous les mardis » continue
d'exister le jour où le marché s'arrête, et personne ne vient la couper. Une série de dates se termine
toute seule. Conséquences tenues dans le code et dans les artefacts : le modèle de données porte une
table de dates (et non une règle de répétition), l'export `.ics` produit **une `VEVENT` par date** (aucun
`RRULE`), et l'expiration se calcule sur la **dernière** date de la série.

**b. La durée de publication suit la date, elle ne la précède pas.**
La fiche est en ligne **jusqu'à la fin de l'événement + 7 jours**, puis elle passe en « terminé »
et sort de l'agenda. Aucun renouvellement, aucun prélèvement.

**c. Une date trop lointaine se publie en différé.**
Au-delà de **90 jours** avant l'événement, le dépôt est accepté et payé, mais la fiche s'affiche
**au J−90** (« mise en ligne programmée le … »). Deux raisons : l'agenda reste crédible (on n'y
trouve pas des dates à onze mois), et l'annonceur ne perd pas sa visibilité parce qu'il s'y est
pris tôt. Réglages : `publication_max_jours_avant = 90`, `survie_apres_evenement_jours = 7`.

**d. Aucune prolongation.** Il n'y a rien à prolonger : l'événement a une date. Un report de date
est une **modification** (avec le mot « reporté » affiché et une notification aux intéressés), pas
une nouvelle annonce — sinon le compteur de prix se contourne et les intéressés ne sont jamais
prévenus.

## 7. Lieu : deux régimes, jamais un seul

| | **Lieu public** | **Adresse privée** |
|---|---|---|
| Exemples | salle communale, place, chapiteau, école, magasin | brocante dans une cour, atelier chez soi, fête de rue |
| Ce qui s'affiche | nom + rue + numéro + code postal + commune | **code postal + commune seulement** |
| Adresse exacte | publique, dans la page | donnée **par la messagerie**, par l'organisateur |
| Itinéraire Google Maps | oui, sur l'adresse complète | oui, **sur le code postal** (donc centre de la commune) |
| Qui choisit | l'organisateur, au dépôt | l'organisateur, au dépôt |

Pourquoi ce n'est pas la même règle que `/annonce` : une salle est faite pour qu'on s'y rende,
une maison non. Le régime privé évite qu'une brocante transforme l'adresse d'un particulier en
adresse publique — sans priver l'événement de visiteurs, puisque la messagerie donne l'adresse.

**Itinéraire** : on réutilise la décision de `/annonce` — un **lien** `google.com/maps/dir/?api=1&destination=…`
(gratuit, sans clé, sans compte), jamais une carte intégrée. En régime public, la destination est
l'adresse complète (encodée) + pays ; en régime privé, `code postal, pays`. Une ligne de la
politique de confidentialité explique le transfert vers Google au clic.

## 8. Entrée, prix, billetterie — et la frontière qu'on ne franchit pas

Trois valeurs d'entrée :

- **Gratuit** — rien à payer, rien à annoncer.
- **Participation libre** — « chapeau » à la sortie. Aucun montant affiché : afficher un montant
  suggéré transforme un chapeau en prix, donc en vente.
- **Payant** — un **prix total, TVA comprise**, dans la devise du pays. Le champ « détail » permet
  d'écrire les tarifs réels (prévente / sur place / réduit), mais **l'accroche reste un prix total** :
  « à partir de » est refusé, parce qu'un prix d'appel qui double à l'entrée est exactement ce que
  le droit de la consommation belge encadre.

**Billetterie** (liste fermée, aucun champ libre) :

1. `sur place` — on paie à l'entrée. Rien à faire pour nous.
2. `chez l'organisateur` — la personne écrit par la messagerie, l'organisateur explique comment
   payer **hors de Kazendra**. La page le dit : « le paiement se fait directement avec
   l'organisateur ; Kazendra n'encaisse rien ».
3. `lien officiel déclaré` — **compte professionnel ou ASBL vérifié uniquement**. Le lien est
   affiché avec la mention « lien fourni par l'organisateur, non vérifié par Kazendra » et il ouvre
   un onglet externe. Toute fiche qui choisit cette option passe en **pré-modération** (§14).

Aucune autre option. Pas de QR code, pas de numéro de compte, pas de « payez-moi par lien ».
**Un IBAN ou un lien de paiement dans la description bloque la publication** (même garde-fou que
`/immo`) : le seul endroit où l'argent peut être évoqué, c'est le champ billetterie.

## 9. Anti-abus — ce qui attaque vraiment une porte d'agenda

Le risque n'est pas la mise en page, c'est **le faux événement** : une date qui n'existe pas, un
lieu qui n'existe pas, une « réservation » à payer d'avance, un organisateur qui usurpe une commune
ou un festival connu. Quatre garde-fous, écrits avant les écrans :

1. **Rien à verser à l'avance.** Bandeau sur la page, au-dessus du contact : « Aucun versement
   avant d'être sur place. » Corollaire : une fiche qui réclame un acompte est masquée, pas
   discutée.
2. **Usurpation d'un organisateur** : un compte de moins de 7 jours qui publie sous le nom d'une
   commune, d'une école ou d'un festival connu passe en **contrôle humain avant publication**
   (comparaison avec le site officiel de l'entité, recherche à la main, journalisée).
3. **Le lieu privé n'est jamais public** (§7). Une adresse de particulier ne peut pas fuir par la
   page, ni par l'itinéraire, ni par l'export agenda — l'export `.ics` ne contient que ce que la
   page affiche.
4. **Signalements** : cinq motifs — *annulé / informations fausses / arnaque ou billet / contenu
   illégal / adresse privée publiée*. Trois signalements distincts masquent provisoirement la
   fiche (règle du hub), puis décision humaine sous 24 h.
5. **Contenus interdits** (refus à la publication) : rassemblements appelant à la violence ou à la
   haine, soirées réservées à un public sur un critère protégé sans justification légale,
   événements dont l'accès est conditionné à un achat sur un site non identifié, revente de billets,
   loteries payantes non autorisées (jeux de hasard : licence de la Commission des jeux de hasard
   — **à vérifier avant d'ouvrir la catégorie « fête foraine »**).

## 10. États d'un événement

```
brouillon
  → en attente de paiement (organisateur commercial)
  → programmé (date > 90 jours : s'affiche au J-90)
  → publié
  → complet (déclaré par l'organisateur, jamais calculé par nous)
  → annulé / reporté (déclaré par l'organisateur)
  → terminé (lendemain de la dernière date)
  → archivé (J+7, page conservée pour les liens, hors agenda)
  → supprimé (J+90 après la dernière date)
```

Règles de transition :

- **Annulé** n'efface rien : la fiche reste visible **7 jours** avec un bandeau rouge plein,
  « Événement annulé par l'organisateur », et **tous les « intéressés » reçoivent une
  notification**. Effacer une annulation, c'est laisser des gens se déplacer pour rien.
- **Reporté** garde la fiche, change la date, affiche « Reporté au … », notifie les intéressés.
- Chaque transition journalise **qui, quand, pourquoi** (journal de modération, 24 mois).
- Un événement **terminé** ne peut plus être « intéressé » ni recevoir de message ; l'organisateur
  peut le republier en un clic pour l'édition suivante (nouvelle date, nouveau paiement).

## 11. Écrans

**Écran 1 — Agenda (liste).** Filtres à gauche (date, catégories, distance, entrée, âge, PMR, plein
air), recherche propre à la porte, bandeau de dates (« Aujourd'hui · Ce week-end · 7 jours ·
Choisir une période »), cartes groupées **par jour** avec la date en gros à gauche, compteur réel.

**Écran 2 — Page d'un événement.** Bandeau date + heure, titre, lieu, prix, affiche, description,
accessibilité, organisateur, **une seule action principale** (« Je suis intéressé »), puis
« Ajouter à mon agenda », « Partager », « Signaler ». Blocs obligatoires : *Kazendra n'encaisse
rien*, *aucun versement à l'avance*, *informations données par l'organisateur*.

**Écran 3 — Dépôt en 4 étapes.** (1) quoi et quand, (2) où, (3) entrée et billetterie, (4) affiche,
description, règles acceptées + prix affiché avant validation.

**Écran 4 — Planche mobile 390 px.** Agenda groupé par jour, page d'un événement, dépôt.

**Écran 5 — Mes événements.** Quatre onglets : *à venir*, *intéressés*, *passés*, *annulés*.
Une ligne = un événement + son état + **une seule action principale** (modifier · republier ·
voir les intéressés). Pour un brouillon ou un paiement en attente, l'action est « terminer la
publication ». C'est le seul écran où l'organisateur voit ses compteurs, jamais la liste des
personnes (§19). Sous les onglets, un bloc **« Vos sorties à plusieurs »** (§ 23) : une ligne par
sortie, avec sa date de rendez-vous, ses places prises et **« Annuler la sortie »** en un geste.
L'annulation doit être atteignable quelque part : c'est ici, et nulle part ailleurs.

**Écran 6 — Signaler.** Modale à cinq motifs fermés (§ 9, garde-fou 4) — *annulé* · *informations
fausses* · *arnaque ou billet* · *contenu illégal* · *adresse privée publiée* —, une phrase facultative
(300 caractères), et deux colonnes qui expliquent **ce que devient le signalement** (anonyme, trois
signalements distincts masquent, décision humaine sous 24 h, l'organisateur n'est pas prévenu) et **ce
qu'il ne fait pas** (il ne retire pas la fiche seul, il n'envoie aucun message, il ne remplace pas une
plainte). Rappel du 112 en cas de danger immédiat.

## 12. Recherche et filtres

- **Date** : aujourd'hui · ce week-end · 7 jours · période libre (deux champs). Le filtre par défaut
  est **aujourd'hui et après** — un agenda qui ouvre sur des dates passées est cassé.
- **Distance** : latte 0–50 km + champ synchronisé (même composant que `/immo`, même table locale
  de codes postaux GeoNames, zéro requête réseau).
- **Catégories** : les 12, multi-choix. Aucune case cochée = tout remonte.
- **Entrée** : gratuit · participation libre · payant (multi-choix).
- **Âge** : tout public · 18+ (masquer les 18+ pour un visiteur qui coche « tout public »).
- **Accessibilité PMR** : oui uniquement.
- **Plein air** : oui / non.
- **Tri** : par date (défaut), puis par distance.

Règle de compteur : le nombre affiché en haut est le nombre de fiches **publiées et à venir**, pas
le nombre de fiches en base. Un compteur qui inclut les événements terminés ment.

## 13. Export agenda et données structurées

**Export `.ics`** — ce qui transforme un agenda en outil utilisé. Un fichier par événement,
`UID` stable (`kazendra-<id>@kazendra.com`), `DTSTART`/`DTEND` avec `TZID=Europe/Brussels`,
`SEQUENCE` incrémenté à chaque modification (sinon un report ne se met pas à jour dans le
calendrier de l'utilisateur), `LOCATION` = ce que la page affiche (jamais plus, §9.3), `URL` = la
page, `DESCRIPTION` courte sans donnée personnelle. **Une série de dates = un fichier `VEVENT` par
date**, pas un `RRULE` (on a décidé de ne pas avoir de récurrence, §6a).

**Données structurées** — `schema.org/Event` en JSON-LD sur la page publique : `name`, `startDate`,
`endDate`, `eventStatus` (`EventScheduled` / `EventCancelled` / `EventPostponed`),
`eventAttendanceMode`, `location` (avec le régime privé respecté), `offers` (`price`, `priceCurrency`,
`availability`) **seulement si l'entrée est payante**, `organizer`. Aucune donnée inventée : une
date annulée ne porte pas `EventScheduled`.

## 14. Modération

- **Publication immédiate + contrôle sous 24 h** (règle du hub), sauf trois cas de **pré-modération** :
  1. compte de moins de 7 jours qui publie sous un nom d'entité connue (§9.2) ;
  2. billetterie `lien officiel déclaré` (§8) ;
  3. fiche signalée pour revente de billets.
- **File unique**, triée par porte et par âge ; les événements à venir passent avant les annonces
  sans date, parce qu'une fiche bloquée 24 h peut faire rater la date.
- Décisions : garder · masquer · retirer · **annuler la date** (réservé au propriétaire).
- Journal inaltérable : qui, quand, quelle fiche, quel motif, quelle pièce.

## 15. Prix, quota, durée

- **Particulier, ASBL, commune, école : gratuit.** Quota : **3 événements à venir** par compte —
  au-delà, on attend qu'une date passe (ou on passe en compte organisation).
- **Organisateur commercial : 12 € HTVA par événement** (hypothèse de marché, à réviser après les
  vingt premières ventes), une facture, **sans reconduction**. Couvre la publication jusqu'à la fin
  de l'événement + 7 jours, plafonnée à 90 jours avant la date (§6c).
- **Report de date : gratuit** (décision du 24/10/2026 — « *Toujours gratuit pour l'instant* »).
  Deux choses se consignent ensemble, sinon la seconde se perd :
  1. c'est un **réglage à 0 €** (`prix_report = 0`), réversible en un clic le jour où le report
     coûterait du travail de modération ;
  2. il a une **borne écrite** : **un report gratuit par publication payée**. Un deuxième report
     exige une nouvelle publication (donc un nouveau paiement pour un compte commercial). Sans
     cette borne, un organisateur garde la même fiche vivante indéfiniment en déplaçant la date,
     et le prix à l'annonce ne veut plus rien dire.
  Le report notifie **tous les intéressés** (c'est le service rendu, pas l'option), et une nouvelle
  date à plus de 90 jours repasse par la règle d'affichage du §6c.
- Aucune « mise en avant » payante en V1.
- Un événement gratuit à l'entrée peut être publié par une entreprise : **c'est le compte qui paie
  (commercial), pas l'entrée**. Sinon une boutique annoncerait toutes ses animations gratuites
  comme un particulier.

## 16. Liens avec les autres portes

- Une annonce `/annonce` et un événement peuvent se répondre (une brocante a des objets à vendre) :
  **aucun lien automatique en V1**, un simple renvoi manuel dans la description.
- Un événement « job dating » est un événement ; les **offres** restent sur `/emploi` et
  `/job-etudiant`. On n'ouvre pas de rubrique d'offres dans `/evenement`.
- `/rencontre` reste séparée : un événement « soirée célibataires » est un événement public, mais il
  ne donne accès à aucun profil et ne peut pas renvoyer vers les rencontres.
- Le tableau de bord agrège les événements (à venir, annulés, intéressés) avec la même règle de
  masquage par défaut que les autres portes.
- La **recherche transversale du hub** remonte les événements **à venir uniquement**, avec la date
  affichée avant le titre : un agenda qui renvoie vers des dates passées ne sert à rien.

## 17. Parcours particulier (et ASBL, commune, école)

- **Compte** : e-mail **et** téléphone vérifiés (règle du hub), aucun document d'identité demandé.
- **Dépôt** : 4 étapes (§11). **Publication immédiate**, puis contrôle humain sous 24 h — sauf les
  trois cas de pré-modération du §14.
- **Quota** : **3 événements à venir** par compte (§15). Un événement terminé ne compte plus, il
  libère donc sa place sans rien faire.
- **Date passée impossible** : la saisie refuse une date antérieure à aujourd'hui (refus au
  formulaire, pas une découverte au contrôle).
- **Rappels — trois messages, jamais plus** : **J−7** (« votre événement est dans une semaine »),
  **J−1** (« c'est demain »), **J+1** (« c'est terminé — republier l'édition suivante ? »). Ils sont
  transactionnels, pas marketing, et se désactivent d'un clic.
- **Modifier** : titre, description, horaire, affiche et lieu se modifient sans limite et sans frais.
  **Déplacer la date, c'est un report** : une fois, gratuit, avec notification des intéressés (§15).
- **Retirer** : l'auteur peut retirer sa fiche à tout moment. Retrait **par lui** = pas de
  remboursement (la visibilité a été consommée) ; retrait **par la modération** pour violation =
  remboursement aux trois quarts (12 € → 9 €), avec note de crédit.
- **ASBL, commune, école** : même parcours, gratuit, badge « numéro vérifié » **contrôlé à la main**
  au départ (BCE / Banque-Carrefour), comme les agences de `/immo` — on vérifie une inscription, pas
  la qualité de l'organisateur.

## 18. Parcours entreprise (organisateur commercial)

- **Compte entreprise** avec numéro BCE, vérification **manuelle** au départ (le dump BCE n'est
  toujours pas localisé, §12.6 de `SPEC-IMMO.md`) : même limite, même honnêteté.
- **Paiement avant publication** : 12 € HTVA par événement, **une facture**, aucune reconduction,
  aucune carte conservée.
- **Mode dégradé tant que Kazendra n'a pas de numéro d'entreprise** : Stripe en **mode test** +
  activation manuelle. **Aucun euro réel encaissé** avant immatriculation — c'est un problème
  fiscal, pas administratif. Le paiement est écrit débranchable (une interface, deux implémentations).
- **Après paiement** : publication immédiate sur webhook signé, puis même contrôle sous 24 h. Un
  paiement encaissé sans publication doit être impossible — si le webhook échoue, la fiche part en
  « payée, à publier » et apparaît dans la file d'administration, jamais dans le vide.
- **Facture** : numéro séquentiel, TVA mentionnée, conservation **durée comptable légale belge — à
  vérifier à la source** avant d'écrire un chiffre dans les CGU (point déjà ouvert au plan maître).
- **Retiré pour violation** : remboursement aux trois quarts (9 €), note de crédit pour la partie
  retenue.
- Une entreprise qui publie un **événement gratuit à l'entrée paie quand même** : c'est le compte
  qui est commercial, pas l'entrée.

## 19. Contact, messages et notifications

- **Messagerie interne uniquement.** Aucun e-mail, aucun téléphone publié — même en option, comme
  `/annonce` (décision du 23/10/2026).
- Une conversation **par événement**. Conservation **12 mois après le dernier échange**, puis
  effacement (durée du hub). Pas de messagerie temps réel, pas de pièce jointe en V1.
- **« Intéressé » n'est pas une inscription.** L'organisateur voit un **nombre**, jamais la liste des
  personnes : il n'a aucune raison de la recevoir, et une liste de noms serait une donnée à protéger
  et un fichier à revendre. Le visiteur, lui, voit le compteur et peut retirer son intérêt.
- **« Intéressé » exige un compte.** C'est la contrepartie de la promesse « vous serez prévenu si la
  date change » : sans compte, on ne peut prévenir personne. Un visiteur non connecté voit le
  compteur, et le bouton l'invite à se connecter — il ne crée pas de doublon silencieux.
- **Notifications envoyées** : nouveau message (organisateur et visiteur), **date changée**,
  **événement annulé**, **J−1** aux personnes intéressées (désactivable), et les trois rappels de
  l'organisateur (§17). Aucune notification publicitaire, aucun e-mail « découvrez aussi ».
- **Signaler** : 5 motifs (§ 9, garde-fou 4), accessibles depuis la page et depuis un message.

## 20. Référencement et poids

- **Adresse stable** : `/evenement/<id>-<slug>`. Le slug change quand le titre change → **301** vers
  la nouvelle adresse, jamais une seconde page pour le même événement.
- **Page publique régénérée en statique** depuis la base (le modèle du collecteur) : c'est ce qui
  donne du SEO et survit à une coupure de la box. `schema.org/Event` en JSON-LD (§13).
- **Plan de site par date** : les événements **à venir** y figurent ; un événement terminé en sort
  le lendemain. Une catégorie vide ne produit aucune page.
- **Images** : trois tailles générées à l'envoi — vignette de liste 96 px, fiche 700 px, partage
  1 200 × 630 px. Original refusé au-delà de 10 Mo, converti en JPEG/WebP, **jamais de SVG
  téléversé** (un SVG porte du script).
- **Poids cible** : fiche < 300 Ko hors images, chargement différé des affiches, aucune police
  externe, aucune bibliothèque de carte (il n'y a pas de carte, §7).
- **Partage (règle du hub, décision du 25/10/2026, corrigée le même jour)** : on reprend **le bouton
  de `/promo`** — un **rond de 34 px**, fond transparent, bordure fine, **la flèche de partage** en
  `currentColor` (le glyphe qu'emploient WhatsApp et Facebook), encre foncée, orange au survol.
  **Aucun vert, aucun bloc de marque WhatsApp** : le site n'a qu'un accent, l'orange. Au clic,
  `navigator.share` si le téléphone sait partager, sinon le menu de repli de `/promo`
  (WhatsApp · E-mail · Copier le lien). Aucun SDK, aucune clé, aucun compte requis ;
  **le partage fonctionne sans compte**, celui qui reçoit un lien doit pouvoir le repasser.
  `Signaler` reste discret et séparé du bouton principal.
- **Ce que le message contient** : le titre, la date et la commune, puis le lien. **Jamais** l'adresse
  exacte d'un lieu privé (§7), jamais le téléphone, l'e-mail ou le nom de famille, jamais un prix
  barré ni un nombre de places. Le partage reprend ce que la page affiche, rien de plus.
- **Aucun compteur de partages.** On ne saurait pas le mesurer sans traqueur, et on n'en veut pas :
  pas de « partagé 12 fois ».
- **Open Graph** sur la page publique (titre daté, image 1 200 × 630) : c'est ce qui fait un aperçu
  crédible dans une conversation. Une fiche retirée mène à la page « terminé / retirée », **jamais à
  une 404** — un lien partagé ne doit pas mourir.

## 21. Cas limites à traiter dès la V1

- **Événement à cheval sur deux jours** (nuit du 31) : date de fin au lendemain ; il apparaît dans
  les deux journées de l'agenda, une seule fois par jour.
- **Changement d'heure** : l'heure est stockée en heure locale **avec** son fuseau, jamais en UTC
  seul. Cas de test imposé, **corrigé le 28/10/2026 après mesure** : le passage à l'heure d'hiver
  2026 a lieu le **25 octobre à 03:00**, donc la nuit de 4 heures réelles est celle du **24 au 25**
  (23:00 → 02:00 = 240 min) ; celle du 25 au 26 dure **3 heures** (180 min). La rédaction d'origine
  (« la nuit du 25 ») désignait la nuit où l'on change d'heure, pas celle qui commence le 25 à
  23:00 — et un test écrit sur cette lecture aurait exigé du code qu'il se trompe. Éprouvé dans
  `tests/evenement.test.mjs` : les deux mesures, et la conversion UTC des deux bornes.
- **Événement commencé, pas fini** : reste affiché avec la mention « en cours » jusqu'à sa fin.
- **Série dont une date est passée** : la ligne passée n'est plus affichée, les autres restent ; aucun
  message d'erreur, aucune date à ressaisir.
- **Fiche expirée consultée depuis un lien partagé** : page « terminé » avec les mêmes informations
  et un renvoi vers les événements à venir — **jamais une 404**.
- **Fiche retirée par la modération** : code 410 et motif public court (« retirée pour non-respect
  des règles »), sans détail qui expose la personne qui a signalé.
- **Auteur qui supprime son compte** : les événements **à venir** sont retirés ; les passés restent
  consultables **anonymisés** (« organisateur supprimé ») — aucun nom conservé.
- **Affiche refusée** (SVG, > 10 Mo, contenu illégal) : message explicite, fiche maintenue en
  brouillon, rien n'est publié à moitié.
- **Gratuit** : le champ prix **n'existe pas** ; on n'affiche jamais « 0 € ».
- **Pays hors zone euro** : prix dans la devise du pays avec son code (« 12 £ », « 12 CHF »), jamais
  un € par défaut. Le prix de publication (12 €) est lui aussi un **réglage par pays**.
- **Événement payant sans billetterie renseignée** : refusé à la publication — sinon les gens se
  déplacent sans savoir comment payer.
- **Lieu public sans nom de lieu** : refusé ; une adresse seule ne dit pas où l'on va.
- **Doublons** : même organisateur, même titre, même date = la deuxième publication est bloquée avec
  un renvoi vers la première (comparaison titre normalisé + date + code postal).
- **Limite de publication** : 5 fiches par jour et par compte, tous états confondus — au-delà, refus
  temporaire. C'est la garde-fou anti-inondation, distincte du quota de 3 événements à venir.
- **Droits sur l'affiche** : l'organisateur déclare détenir les droits sur l'image **et** sur le
  droit à l'image des personnes qui y figurent ; la case est obligatoire, la déclaration est
  journalisée. Une affiche retirée sur réclamation n'entraîne pas le retrait de l'événement.

## 22. Questions ouvertes

1. ✅ **Récurrence — TRANCHÉ le 24/10/2026.** L'utilisateur : « *Oui, tu en restes à la série.* »
   Le modèle de données, l'export `.ics`, l'expiration et l'affichage restent donc sur la série de
   dates (8 maximum, une `VEVENT` par date, expiration sur la dernière date). **Ne pas reposer la
   question.** Ce qui reste ouvert en revanche : le **quota** des événements récurrents d'une commune
   (question 4 ci-dessous).
2. ✅ **Report de date — TRANCHÉ le 24/10/2026 : gratuit**, réglage à 0 €, borné à **un report par
   publication payée** (§15). **Ne pas reposer la question** tant que le coût réel du report n'est
   pas mesuré.
3. **Loteries et jeux de hasard** : autorisation de la Commission des jeux de hasard à vérifier
   avant d'accepter une fête foraine ou une tombola payante. **Non vérifié à ce jour.**
4. **Événements récurrents gratuits d'une commune** (marché hebdomadaire) : entrent-ils dans le
   quota de 3 ? Probablement non, mais à trancher avec la question 1.
5. **Base légale exacte de l'interdiction de revente** (§3) : loi du 30 juillet 2013 à confirmer sur
   Justel avant de la citer dans les CGU.

## 23. Sorties à plusieurs — « On y va ensemble ? » (décision 30 du 25/10/2026)

Demande de l'utilisateur : « *un système de rencontre le jour même en fonction des activités et de
l'envie du jour par exemple cinéma restaurant et que les gens se trouvent grâce à un événement qu'ils
ont envie de faire en commun* ». **Forme retenue : A uniquement** — la sortie se greffe sur un
événement existant. **Aucun écran ne liste « qui veut sortir ce soir ».** Forme B écartée par
l'utilisateur le 25/10/2026.

Ce bloc vit dans `/evenement`, pas dans `/rencontre` : il réutilise un objet **déjà modéré** (la
fiche), un lieu **déjà public** (§ 7, régime public uniquement) et une date **déjà saisie**. C'est ce
qui rend la fonction tenable.

### 23.1 Point d'entrée et visibilité

- Le bloc apparaît **uniquement dans la colonne d'actions d'une fiche d'événement**, sous « Je suis
  intéressé ».
- Il n'est rendu **que pour une personne connectée** qui a marqué l'événement « intéressé » et dont la
  commune est à portée de l'événement (même règle de distance que la recherche, § 12).
- **Rien pour un visiteur anonyme** : le bloc n'est pas dans le HTML. Conséquence directe et voulue :
  il n'est pas indexable, pas partageable, pas capturable par un moteur.
- **Aucune sortie sur un événement en régime d'adresse privée** (§ 7.2) : le point de rendez-vous
  serait l'adresse de quelqu'un. Le bloc est alors absent, avec la mention « les sorties à plusieurs
  ne sont ouvertes que sur les événements dont le lieu est public ».

### 23.2 Qui peut proposer, qui peut rejoindre

| | Condition |
|---|---|
| **Proposer** | compte ≥ **30 jours**, e-mail **et** téléphone vérifiés, **une seule sortie active** à la fois, aucune suspension en cours |
| **Rejoindre** | compte ≥ **7 jours**, e-mail et téléphone vérifiés, **avoir marqué l'événement intéressé**, une place libre |
| **Annuler** | libre et sans justification ; **3 annulations en 30 jours** suspendent le droit de proposer pendant 30 jours |
| **Exclu** | compte masqué, banni, ou sortie déjà complète / passée / annulée |

Raison des seuils, écrite pour ne pas être « simplifiée » plus tard : **une sortie se prépare en
quelques heures, donc la modération humaine ne peut pas être le filtre**. Un compte créé le matin ne
doit pas pouvoir donner rendez-vous le soir. C'est le seul rempart structurel disponible.

### 23.3 Champs d'une sortie

| Champ | Règle |
|---|---|
| Événement | **fixé**, non modifiable — c'est le point d'ancrage |
| Rendez-vous | **trois choix fermés** : « 15 min avant » · « à l'ouverture » · « à l'heure de début ». **Jamais une heure libre** : une heure libre permet de déplacer le rendez-vous ailleurs. Aucun choix **après** le début → la sortie ne devient jamais « on repart ensemble à 2 h du matin » |
| Durée prévue | `1 h` · `2 h` · `la journée` — pour savoir ce qu'on engage, pas pour classer les gens |
| Places | **2, 4 ou 6**, organisateur compris. « 2 » est libellé **« en duo »** : on ne cache pas ce que ça veut dire |
| Mot | **140 caractères**, texte libre sans HTML, **sans lien, sans numéro, sans adresse** (filtre à l'envoi) |
| Point de rendez-vous | **non saisi** : c'est le lieu public de l'événement (« devant l'entrée »). Aucun champ libre, donc aucune dérive possible |
| Expiration | automatique à la **fin de l'événement** ; une sortie ne survit pas à la fiche |

### 23.4 Ce qui s'affiche, ce qui ne s'affiche jamais

**S'affiche** : le mot, le rendez-vous (un des trois), la durée prévue, les places restantes, les
pseudos des participants et « X propose / Y et Z ont rejoint », plus « membre depuis … · téléphone
vérifié ».

**Ne s'affiche jamais** (liste de non-régression) : adresse ou lieu ajouté, téléphone, e-mail, nom de
famille, IBAN, lien, photo, **nombre de sorties déjà faites**, note, appréciation, liste des personnes
qui ont quitté, et **le fait qu'une personne ait été refusée ou retirée**.

**Aucun compteur de sorties, aucune note.** Un compteur pousserait à venir pour le chiffre, et il se
gonfle entre amis. On ne mesure pas la présence : nous n'avons aucun moyen honnête de la vérifier, et
une fausse accusation vaut pire qu'une inconnue.

### 23.5 Le fil de la sortie

- **Un fil par sortie**, dans la **messagerie commune du hub** (pas une messagerie par porte —
  décision déjà prise pour `/annonce` § 2). Type de fil : `sortie`.
- **Tout le groupe lit tout.** Aucun message privé entre participants depuis ce fil : le duo reste
  dans `/rencontre`, après intérêt mutuel.
- **Aucune image, aucun fichier, aucun lien cliquable** — même règle qu'au § 7 de la spec
  `/rencontre`, pour la même raison : le chantage et l'arnaque.
- Motifs frauduleux bloqués à l'envoi (argent, urgence, IBAN, carte cadeau, cryptomonnaie).
- **Quitter la sortie est silencieux** : la personne n'a pas à se justifier, et les autres voient
  seulement le nombre de places remonter.
- **Effacement 30 jours après la date de l'événement**, et immédiatement si la personne supprime son
  compte. Plus court que les 12 mois de `/rencontre` : un fil de groupe sur une brocante passée n'a
  plus d'utilité et reste une donnée qui dort.

### 23.6 Modération — le compromis assumé

**La pré-modération est impossible ici** : une sortie pour samedi 08:00 publiée vendredi soir ne peut
pas attendre 24 h. Le compromis est donc explicite :

1. le mot passe un **filtre automatique** (liens, IBAN, numéros, adresses, insultes, coordonnées
   déguisées) et se **publie immédiatement** ;
2. **contrôle humain sous 24 h**, priorité haute ;
3. refus → sortie **retirée**, participants notifiés avec le motif, organisateur prévenu ;
4. **3 signalements distincts** → masquage provisoire automatique, puis décision humaine (règle 21 du
   plan).

Ce n'est pas un oubli de la règle « pré-modération des rencontres » : c'est la seule façon de tenir la
promesse « ce soir ». Une sortie qui attendrait 24 h serait une sortie annulée.

### 23.7 Notifications

- Aux personnes **intéressées de la même commune** : notification « 2 personnes vont à [événement]
  samedi, il reste des places », **une seule fois par événement et par personne** (sinon un événement
  chargé devient du spam).
- **E-mail immédiat** + badge dans l'application. **SMS** uniquement pour une sortie **confirmée
  commençant dans moins de 6 h**, et seulement si la personne a activé l'option.
- Coût SMS : à relever dans la grille OVH avant d'ouvrir l'option ; **plafond mensuel en réglage**,
  jamais une promesse en l'air. Sans plafond, une fonction gratuite peut coûter cher en une soirée.
- Annulation par l'organisateur, sortie complète, retrait par la modération → **tous les participants
  notifiés**, sans exception.

### 23.8 États et cas limites

```
proposée (1 personne, visible)  → complète (places prises)  → passée (fin de l'événement)
        ↘ annulée par l'organisateur   ↘ retirée par la modération   ↘ expirée (événement annulé/reporté)
```

- **Événement annulé ou reporté** → sortie annulée automatiquement, participants notifiés (on ne
  laisse pas des gens se retrouver devant une salle fermée).
- **Événement passé** → sortie fermée, plus rejoignable, fil encore lisible jusqu'à l'effacement.
- **Organisateur qui supprime son compte** → sortie annulée, participants notifiés.
- **Sortie à une seule personne** : elle reste visible, avec la mention « propose une sortie ». Sans
  cela, personne ne pourrait jamais rejoindre. L'écran de création prévient, avant publication, que
  le pseudo et l'heure de rendez-vous seront vus par les intéressés de la commune.
- **Deux sorties pour le même événement** : autorisées (deux groupes différents, deux horaires), mais
  une seule par compte.
- **Personne qui propose puis ne vient pas** : aucun marquage, aucune sanction automatique. On ne
  juge pas sur une parole non vérifiable.

### 23.9 Ce que cette fonction n'est pas, et qu'il faut dire à l'écran

- Ce n'est **pas un rendez-vous privé** : c'est un groupe, sur un lieu public, avant un événement
  public.
- Ce n'est **pas une réservation** : Kazendra ne réserve ni table, ni place de cinéma, ni entrée.
- Ce n'est **pas un paiement** : aucun argent ne circule, aucun acompte, aucun « tu paies ma place ».
- Ce n'est **pas un service de sécurité** : aucun logiciel n'empêche une agression. Ce qui protège,
  c'est le groupe, le lieu public, l'absence d'argent, la possibilité d'annuler et les quatre gestes
  de la page Sécurité (`SPEC-RENCONTRE.md` § 18.3).
- Ce n'est **pas du speed dating** : pas de rotation, pas de créneaux minutés, pas de vidéo (§ 15 de
  la spec `/rencontre`).

### 23.10 Ce que la forme A ne couvre pas

- **« Resto pour deux ce soir » sans événement** : non couvert. Il faut qu'un événement existe dans la
  catégorie `gout` (table d'hôte, dégustation, repas de quartier) pour qu'une sortie s'y accroche.
- **Cinéma** : couvert **si la séance existe comme fiche** — d'où l'ajout de la catégorie `cinema`
  (§ 4). Un cinéma, une ASBL ou un particulier peut publier « Séance du samedi 20:00 ».
- **Aucune réservation de place** : la séance peut être complète à l'arrivée ; le fil de la sortie
  permet de prévenir le groupe.

### 23.11 Impact technique et maquette

- **Deux tables** : `sortie` (événement, organisateur, rendez-vous, durée, places, mot, état) et
  `sortie_participant` (sortie, personne, état, horodatage). Plus un type de fil `sortie` dans la
  messagerie commune.
- **Aucune nouvelle porte, aucune nouvelle page publique.** Un seul composant `SortieBlock`, affiché
  dans la colonne d'actions de la fiche.
- Maquette : `maquettes/evenement.html`, écran 3 (bloc d'entrée, sortie telle que la voient les
  intéressés, fil de groupe, variante « une seule personne », formulaire de création, ce que la sortie
  ne fait pas, seuils) — capture `evenement-sortie.png`. Contrôles par programme : 0 texte coupé,
  0 débordement, **0 bouton de partage dans le bloc de sortie**, 0 erreur JS.

## 24. Ce qui reste à produire pour clore cette porte

- [x] Spécification complète (ce fichier), avec la règle légale sourcée et datée
- [x] Maquettes : agenda (liste) + page d'un événement, 1440 px —
      `maquettes/evenement.html`, captures `evenement-liste.png` et `evenement-fiche.png`
      (contrôle : 0 texte coupé, 0 débordement, 0 erreur JS)
- [x] Maquette du dépôt en 4 étapes — `maquettes/evenement-depot.html`,
      capture `evenement-depot.png`
- [x] Planche mobile 390 px (agenda, événement, dépôt) — `maquettes/evenement-mobile.html`,
      capture `evenement-mobile-390.png` (3 écrans, contenu non coupé)
- [x] Générateur `.ics` exercé pour de vrai — `outils/ics-evenement.py`, contrôlé par
      `tests/test-ics-evenement.py` : 8 dates = 8 VEVENT, adresse privée sans rue,
      `SEQUENCE` au report, `STATUS:CANCELLED` à l'annulation, pliage ≤ 75 octets, CRLF,
      relecture par un parseur iCalendar indépendant. **Tous les contrôles passent.**
- [x] **Récurrence tranchée le 24/10/2026** : série de dates, pas de récurrence automatique
      (§6a, §22.1) — le modèle de données peut être écrit
- [x] Maquette de l'écran « signaler » (5 motifs) — écran 6 de `maquettes/evenement.html`,
      capture `evenement-signaler.png`
- [x] Maquette de l'écran « Mes événements » (§11, écran 5) — quatre onglets, une action par ligne,
      plus le bloc « Vos sorties à plusieurs » — capture `evenement-mes-evenements.png`
- [ ] Vérification de l'obligation « jeux de hasard » avant d'ouvrir les tombolas (§22.3) —
      **ne bloque pas** : les loteries payantes sont déjà refusées à la publication

**Sorties à plusieurs (décision 30, § 23)** :

- [x] Forme tranchée par l'utilisateur le 25/10/2026 : **A uniquement** (greffe sur l'événement), pas
      de page « sorties du jour »
- [x] Spécification complète du bloc (§ 23.1 à § 23.11) : seuils d'âge de compte, champs fermés,
      fil de groupe, modération de compromis, notifications, états, cas limites
- [x] Catégorie `cinema` ajoutée (§ 4) — sans elle, l'exemple « cinéma » de l'utilisateur n'était pas
      couvert par la forme A
- [x] Maquette de l'écran 3 — `maquettes/evenement.html`, capture `evenement-sortie.png`
      (0 texte coupé, 0 débordement, 0 bouton de partage dans le bloc, 0 erreur JS)
- [ ] **Relever le tarif SMS dans la grille OVH** et fixer le **plafond mensuel** (réglage) avant
      d'activer l'option SMS des sorties — sans plafond, une fonction gratuite peut coûter cher
- [ ] Écrire la mention CGU : Kazendra n'organise pas la sortie, ne réserve rien, n'encaisse rien et
      n'est pas partie au rendez-vous (§ 23.9)

---

## 24 bis. L'image de marque de l'organisateur (décision 37, 25/10/2026)

- Un organisateur **commercial** peut afficher **son logo, ou à défaut une photo de son entreprise** ; il
  suit le compte, pas l'événement, et sert aussi sur `/artisan`, `/immo`, `/emploi` et `/job-etudiant`.
- **Un particulier n'a pas d'image de marque** ; une **ASBL, une école ou une commune en ont une**,
  puisqu'elles publient au nom d'une **personne morale** et disposent presque toujours d'un logo. La
  distinction suit le **type de compte**, pas la forme juridique : c'est le particulier — une personne
  physique qui met en ligne une brocante — qui n'a pas de marque à montrer.
- **Ce n'est pas l'affiche.** L'affiche (0–3) est propre à chaque événement et vit avec lui ; l'image de
  marque identifie l'organisateur et lui survit. Deux images, deux rôles, deux durées — les confondre
  ferait disparaître le logo de l'organisateur à la fin de chaque événement.
- **SVG refusé**, métadonnées effacées (une photo de salle prise au téléphone porte l'adresse exacte —
  or le lieu d'un événement public est publié, celui d'un événement privé ne l'est pas), remplacement
  soumis à relecture.

## 25. État de la porte — **CLOSE le 25/10/2026**

`/evenement` est cadrée : **25 sections**, six écrans en 1440 px (agenda, fiche, sortie à plusieurs,
dépôt en 4 étapes, signaler, mes événements), une planche mobile 390 px de trois vues, un générateur
`.ics` exercé par des tests, et **aucune question de conception ouverte**.

Contrôles exercés par programme sur la maquette (pas à l'œil) :

| Contrôle | Résultat |
|---|---|
| Texte coupé ou débordement horizontal | **0** sur les six écrans |
| Boutons de partage dans le bloc « sortie » | **0** (le partage reste sur la fiche, pas sur la sortie) |
| Erreurs JavaScript | 0 |
| Cohérence des jours affichés | 25 oct. = **dimanche**, 26 oct. = **lundi** — vérifié au calendrier réel, corrigé partout (y compris le changement d'heure du 25/10/2026) |
| Dates des lignes « Mes événements » | dim. 25 · dim. 8 nov. · lun. 16 nov. · dim. 22 nov. · lun. 12 oct. · lun. 2 nov. |

**Trois tâches restent ouvertes, aucune ne bloque la construction** :

1. **Tarif SMS OVH** à relever + plafond mensuel à fixer avant d'activer l'option SMS des sorties.
2. **Mention CGU des sorties** à écrire (§ 23.9) : Kazendra n'organise pas, ne réserve pas, n'encaisse
   pas, n'est pas partie au rendez-vous.
3. **Base légale exacte de la loi du 30 juillet 2013** sur la revente de billets, à confirmer sur
   Justel avant de la citer dans les CGU. La règle de droit elle-même (SPF Économie) est déjà sourcée
   et datée ; c'est la référence légale précise qui manque.

La porte suivante s'ouvre quand l'utilisateur le décide.
