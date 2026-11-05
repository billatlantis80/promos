# SPEC — Porte `/immo` (immobilier)

Version du 24/10/2026. Compagnon de `SPEC-ANNONCE.md` et de `PLAN-HUB-SEPT-SERVICES.md`.
Ce document dit **ce que fait `/immo`, ce qu'elle ne fait pas, et ce que la loi belge impose
d'afficher**. Les obligations légales sont sourcées ; les choix commerciaux restent des hypothèses
à trancher.

---

## 1. Ce que fait `/immo`

Une porte d'annonces immobilières : **vente et location**, entre particuliers et avec des
professionnels. Dépôt, photos, recherche par lieu et par critères, page publique par bien, contact
par la messagerie Kazendra.

## 2. Ce que `/immo` ne fait PAS (et ne fera pas)

- **Aucune intermédiation.** Kazendra n'est pas agent immobilier, ne négocie pas, ne visite pas,
  n'encaisse ni loyer ni garantie locative, ne rédige pas de bail, ne fait pas d'état des lieux.
  La transaction se passe **entre les parties**, comme la vente d'un vélo sur `/annonce`.
- **Aucune certification du PEB.** Nous affichons ce que le vendeur déclare. Le certificat est
  délivré par un certificateur agréé par la Région, pas par nous.
- Pas de paiement en ligne entre acheteur et vendeur, pas d'offre d'achat, pas d'enchères.
- Pas de notes ni d'avis en V1 (même choix que `/annonce`).
- Pas de génération de documents (bail, compromis, mandat).

Conséquence à écrire noir sur blanc dans les CGU : **Kazendra ne garantit ni le bien, ni le
vendeur, ni le bailleur, ni la validité du PEB.**

## 3. Types de bien et types d'opération

**Opération** (un seul choix, obligatoire) :
`vente` · `location`

> **Décision du 24/10/2026 : la location courte durée (type Airbnb) n'ouvre pas en V1.** Elle est
> réglementée différemment par Région (autorisation d'hébergement touristique à Bruxelles), attire
> les arnaques et change la modération. Elle pourra revenir comme porte séparée, pas comme option
> cachée dans `/immo`.

**Type de bien** (liste fermée — on n'ouvre pas de catégorie sans volume, règle de `/annonce`) :
- Maison (2 ou 4 façades, mitoyenne, de maître, fermette, villa)
- Appartement · **Studio** · Duplex · Loft
- **Chambre · kot étudiant** · colocation (une chambre dans un logement partagé)
- Terrain (à bâtir, agricole, de loisir)
- Garage, parking, box
- Immeuble de rapport (immeuble à appartements, mixte commerce + logement)
- Bureau
- Commerce / surface commerciale (y compris horeca)
- **Industriel / entrepôt / atelier** (hall, entrepôt logistique, atelier, terrain industriel)

Deux types ont été ajoutés le 24/10/2026 à la demande de l'utilisateur : **studio** (il existait dans
la spécification mais manquait à la liste de l'écran) et **industriel / entrepôt**. Trois autres
suivent la même logique : **chambre / kot étudiant** (marché réel en Belgique, distinct d'un
appartement), **loft**, et la séparation de **bureau** et **commerce** qui étaient fusionnés à tort —
un commerce et un bureau n'ont ni le même public ni les mêmes photos.

**Neuf ou existant** : `neuf` · `à rénover` · `existant`. Le neuf a des obligations propres
(vente sur plan, délais) : en V1, le neuf est accepté **mais signalé**, jamais garanti.

## 4. Champs d'une annonce

Communs obligatoires : titre (70 caractères), type d'opération, type de bien, **code postal**
(choisi dans la liste, jamais tapé) et commune, prix, surface, nombre de chambres (sauf terrain et
parking), **description**, PEB (§5), contact par messagerie.

**Photos : 0 à 6, jamais obligatoires** (règle du hub, décision 29 du plan, 25/10/2026 — verbatim :
« *Une photo ne doit pas être obligatoire, utilisateur peut mettre une annonce sans photo* »). Un bien
se publie sans aucune photo : la carte de la liste affiche alors le titre en grand, le prix, la
surface et le PEB, **sans cadre vide ni mention « sans photo »**. Le filtre « avec photo uniquement »
reste un choix de celui qui cherche, jamais une condition pour celui qui publie. Comme la photo ne
peut plus servir à écarter une annonce douteuse, l'anti-arnaque de cette porte repose sur les règles
du §10 (blocage des IBAN et liens de paiement, contrôle humain des trois premières annonces d'un
compte récent) et non sur la présence d'images.

**La description est un cadre à part entière** (décidé le 24/10/2026), pas un paragraphe noyé sous
les caractéristiques : c'est là que le vendeur explique son bien — travaux faits, orientation,
voisinage, raison de la vente, ce qui ne se met pas dans une case. Règles :

- **200 caractères minimum, 2 000 maximum** ; en dessous de 200, l'annonce ne part pas (une annonce
  sans description est une annonce qu'on ne peut pas juger, et c'est le terrain des arnaques).
- **Texte libre, jamais de HTML** : on affiche le texte, on n'interprète rien.
- **Aucune donnée bancaire** dans ce cadre, comme partout (§7.1) : le filtre s'applique aussi ici.
- Sur la page du bien, le cadre porte un titre « Description du bien » et la mention « Décrite par le
  vendeur », pour qu'on ne confonde pas le texte du vendeur avec celui de Kazendra.

**Vente** : prix demandé (dans la devise du pays), `frais` (part du notaire non incluse — mention
obligatoire plus bas), état du bien, année de construction, surface du terrain (maison et terrain),
`occupé ou libre` à la vente, `compromis déjà signé` (oui/non — l'annonce peut rester en ligne),
jardin/terrasse/garage (oui/non), `travaux à prévoir` (texte libre, + montant estimé facultatif).

**Location** : loyer mensuel, **charges** (montant et ce qu'elles couvrent), **garantie locative**
(2 ou 3 mois, ou 0), `libre à partir du` (date), meublé (oui/non), nombre de salles de bain, étage,
ascenseur, `chauffage` (collectif/individuel + énergie), frais de dossier (0 attendu), animaux
(acceptés ou non), durée souhaitée.

**Appartement** en plus : étage, ascenseur, **charges de copropriété**, nom du syndic (facultatif,
non publié par défaut).

**Règles de saisie, déjà appliquées à `/annonce`** : prix à 0 interdit pour une vente et une
location (le prix est une donnée, pas un argument) ; un « prix à discuter » n'existe pas, on écrit
un prix ; surface en m² entiers ; devise du pays.

## 5. PEB — obligation légale, différente selon la Région

La Belgique impose d'annoncer la performance énergétique. Les trois Régions n'exigent pas la même
chose, donc **le formulaire change selon la Région**, déduite du code postal (`donnees/codes-postaux/`
porte la Région : 22 codes bruxellois, 605 wallons, 519 flamands).

### Wallonie — source : energie.wallonie.be, page « Achat-vente-location » (consultée le 24/10/2026)
> « Les publicités de vente ou de location doivent mentionner la performance énergétique des
> bâtiments, afin que les candidats acquéreurs ou locataires puissent comparer la performance
> énergétique des biens mis sur le marché. Le numéro de certificat mentionné dans les publicités
> permet aux candidats acquéreurs ou locataires de consulter le contenu du certificat PEB
> (registre des certificats PEB). »

→ Champs exigés : **performance énergétique (label A++ à G et/ou kWh/m²/an)** + **numéro de
certificat PEB**.

### Bruxelles — source : environnement.brussels, « Le certificat PEB d'un logement en Région bruxelloise » (consultée le 24/10/2026)
> « La classe énergétique du bien doit d'ailleurs être mentionnée sur les annonces et les affiches
> en cas de vente ou de location » · « Vous mentionnez la classe énergétique du logement et sa
> performance énergétique exprimée en kWh/m²/an sur l'annonce » · « Les échelles énergétiques sont à
> insérer dans les annonces immobilières ».

→ Champs exigés : **classe énergétique (A à G)**, **kWh/m²/an**, et **l'échelle énergétique
affichée** dans l'annonce. Contrôles réels, verbalisation possible (amende administrative de 50 à
62 500 €).

### Flandre — source : vlaanderen.be, « Verplichte vermelding van EPC-informatie in advertenties » (consultée le 24/10/2026)
> « In elke advertentie of bekendmaking bij overdracht of verhuur van een woning moet minstens de
> energiescore of het energielabel vermeld worden, en bij overdracht van een gebouw met een slechte
> energieprestatie moet ook vermeld staan dat er een renovatieverplichting op het gebouw rust. »
> → champs : **énergiescore ou label**, **code unique du certificat (UC)**, et **mention de
> l'obligation de rénovation** (label E ou pire en résidentiel).

→ Champs exigés : **label ou score**, **code UC**, **obligation de rénovation oui/non**.

### Ce que ça donne dans le formulaire

Un seul bloc « Performance énergétique », dont les champs **s'affichent selon la Région du code
postal** :

| Région | Label | kWh/m²/an | N° de certificat | Code UC | Obligation de rénovation | Échelle affichée |
|---|---|---|---|---|---|---|
| Wallonie | requis | recommandé | **requis** | — | — | recommandée |
| Bruxelles | **requis** | **requis** | facultatif | — | — | **requise** |
| Flandre | requis | requis | — | **requis** | **requise** | requise |

Règles de conception qui en découlent :

- **On ne publie pas sans PEB.** L'annonce reste en brouillon avec un message explicite : « un
  certificat PEB est obligatoire pour publier ; il est délivré par un certificateur agréé ». Aider
  à publier une annonce sans PEB serait aider à commettre l'infraction.
- **Exception à prévoir** : `terrain` et `garage/parking` ne sont pas des unités de bâtiment →
  pas de PEB. Le formulaire le sait et ne le demande pas.
- **Sur la page publique (visuel revu le 24/10/2026 à la demande de l'utilisateur)** : la lettre de
  la classe dans une **grande tuile aux couleurs du PEB**, la consommation en kWh/m²/an, la date du
  certificat et son numéro, puis une **règle graduée** en dégradé (vert foncé → rouge foncé) portant
  les neuf classes, avec un **repère sous la classe du bien**. L'ancienne version — neuf cases
  pleines à plat — cumulait trop de couleurs au même poids visuel : la règle donne la progression,
  la tuile donne la réponse. Une phrase dit que le certificat est disponible sur demande et que
  **Kazendra ne le vérifie pas**.
- **Pas de recopie du certificat lui-même** : numéro et valeurs déclarées, jamais un PDF téléversé
  (un PDF de certificat contient des données personnelles et un tiers pourrait le falsifier).
- **Le portail public de vérification** existe par Région (registre des certificats PEB) : le
  numéro affiché permet au visiteur d'aller vérifier lui-même. Le lien sera ajouté quand l'URL
  exacte du registre sera relevée pour les trois Régions (à faire, non vérifié à ce jour).

## 6. Mentions obligatoires sur la page du bien

- Prix (et pour une location : loyer + charges séparément, jamais un « tout compris » flou).
- Surface, nombre de chambres, code postal et commune.
- PEB selon la Région (§5).
- **« Kazendra affiche, n'intermédie pas »** : ni agence, ni mandat, ni commission.
- Pour un vendeur professionnel : nom commercial et **numéro d'entreprise (BCE)** ; pour une agence
  immobilière, son **numéro IPI** (voir « Vérification d'une agence » ci-dessous).
- Une phrase anti-arnaque, visible, au-dessus du bouton de contact : **aucun versement avant une
  visite et un bail signé**.
- Signalement en un clic (même mécanique que `/annonce` : 3 signalements → masquage provisoire →
  décision humaine sous 24 h).

### Vérification d'une agence immobilière (décidée le 24/10/2026)

En Belgique, exercer comme agent immobilier **à titre onéreux** suppose d'être inscrit à l'**IPI**
(Institut professionnel des agents immobiliers, loi du 11 février 2013). Une annonce publiée par une
agence non agréée est donc un problème juridique, pas seulement un problème de confiance.

Ce qui a été **vérifié à la source le 24/10/2026** :

- l'IPI publie bien une procédure officielle de **« signalement d'un exercice illégal de la
  profession par une personne non agréée IPI »** (ipi.be, rubrique *La profession*). C'est la preuve
  que l'obligation est réelle et sanctionnée ;
- l'IPI **ne met pas à disposition de registre public interrogeable par un tiers** : ses pages
  « mentions obligatoires » et « données à mentionner sur vos documents » sont réservées aux membres
  (renvoi vers `/user/login`). **Aucune API, aucun fichier téléchargeable.** Une vérification
  automatique du numéro IPI est donc impossible aujourd'hui ;
- la **BCE/KBO** dispose d'une recherche publique (`kbopub.economie.fgov.be`, vérifiée : répond en
  200) sans API, et d'un **dump mensuel libre** (BOSA open data) — le fichier exact et son format
  restent à relever (§13).

D'où le système retenu, **manuel au départ** (décision du 24/10/2026) :

1. **À l'inscription du compte entreprise**, l'agence déclare **numéro BCE** et **numéro IPI**, plus
   sa dénomination exacte et, si elle le souhaite, son **logo**.
2. **Contrôle manuel du numéro BCE** par un modérateur, à la main, sur la recherche publique de la
   Banque-Carrefour des Entreprises (`kbopub.economie.fgov.be`) : le numéro existe, la dénomination
   correspond, l'entreprise est active, l'activité est immobilière (NACE 68.xxx). **Ce contrôle
   deviendra automatique le jour où le fichier mensuel officiel sera localisé** — ce n'est pas le cas
   aujourd'hui (§12.6), et il ne faut pas le promettre avant.
3. **Contrôle manuel du numéro IPI** par un modérateur : numéro et dénomination confrontés à la liste
   de l'IPI, puis consignés (qui a vérifié, quand, sur quelle pièce). Le numéro IPI est **annuel** :
   le contrôle est rejoué **tous les douze mois**, et l'annonce est masquée si l'agence ne répond pas.

**Au départ, tout est donc humain** : deux numéros, deux vérifications, une ligne dans le journal de
modération. C'est assumé — on aura peu d'agences au début, et le coût réel est de quelques minutes par
dossier. L'automatisation du BCE est un gain futur, pas un prérequis.

### L'image de marque de l'agence (décidé le 24/10/2026, généralisé le 25/10 — **décision 37**)

- **Un compte professionnel peut téléverser son logo** — **ou, s'il n'en a pas, une photo de
  l'entreprise** (façade, agence, véhicule) : un seul emplacement, deux provenances, jamais les deux.
  C'est la **décision 37 du plan du hub** qui fait foi ; ce paragraphe n'est que le cas immobilier.
- L'image est **portée par le compte, pas par l'annonce** : elle s'affiche dans le bloc vendeur de
  chacune de ses annonces, avec sa dénomination, son numéro BCE et son numéro IPI vérifié, et **la même
  image sert sur `/artisan`, `/emploi`, `/evenement` et `/job-etudiant`** sans être redéposée.
- **Un particulier n'a pas d'image de marque** : son bloc affiche un pseudo et « téléphone vérifié ».
  C'est une différence visible entre les deux types de compte, et elle est volontaire.
- Contraintes : une image **carrée**, 200 px minimum, 5 Mo au plus, JPEG/PNG/WebP, **ré-encodée par
  nous** et **jamais servie telle quelle** (pas de SVG : il peut porter du script), **métadonnées
  effacées à l'envoi** — une photo de façade prise au téléphone contient les coordonnées GPS, donc
  l'adresse du bien ou du domicile de l'agence, ce qui contredirait la règle « commune seulement ».
  Elle passe par la modération avec le compte et **reste affichée jusqu'à ce qu'un remplacement soit
  accepté** ; elle est retirée si le compte est suspendu.
- L'image **ne remplace jamais** les mentions légales : elle s'ajoute au nom, au BCE et à l'IPI, elle ne
  les résume pas.

Ce qui s'affiche sur l'annonce, et ce qui ne s'affiche pas :

- **affiché** : « Agence — n° BCE 0123.456.789 · n° IPI 512.345, vérifié le 24/10/2026 », avec un
  lien vers la procédure de signalement de l'IPI ;
- **jamais** : « agence certifiée par Kazendra », « agence de confiance », ni aucun logo qui
  laisserait croire que nous garantissons l'agence. Nous vérifions **un numéro et une inscription**,
  nous ne certifions **ni la compétence, ni la probité, ni la solvabilité**.
- Une agence qui refuse de fournir son numéro IPI **ne publie pas** (décision du 27/10/2026, elle
  remplace la rédaction du 24/10 qui la laissait « retomber » en particulier). Raison : le compte
  qui se déclare agence et publie sans badge met en face du client exactement ce qu'il croit ne pas
  avoir — une agence non identifiable. Le refus est donc posé à la saisie, il nomme le manque
  (`ipi`) et renvoie à l'écran du compte. Un **professionnel qui ne se déclare pas agence** (marchand
  de biens, notaire, société vendant son propre immeuble) publie normalement : son numéro
  d'entreprise reste affiché, la mention obligatoire est là, et ses trois premières annonces passent
  par un humain comme celles de tout compte récent.

## 7. Anti-arnaque — la vraie difficulté de cette porte

L'arnaque classique en Belgique : un faux bailleur propose un bien **qu'il ne possède pas**, à un
prix attractif, refuse la visite (« je suis à l'étranger »), et réclame la garantie locative par
virement avant tout. Elle est fréquente sur les portes immobilières gratuites et c'est ce qui
détruit la réputation d'une plateforme.

Mesures retenues en V1 :

1. **Aucune donnée bancaire dans l'annonce.** Un IBAN, un numéro de compte, un lien de paiement ou
   un numéro Western Union dans un texte d'annonce → publication bloquée automatiquement, avant
   même la modération.
2. **Bandeau permanent** sur toute annonce de location : « ne versez jamais d'argent avant d'avoir
   visité le bien et signé un bail ».
3. **Vérification du téléphone obligatoire** pour déposer dans `/immo` (déjà prévu pour toutes les
   portes, mais ici c'est un prérequis, pas une option).
4. **Une seule annonce par bien** : le même code postal + la même surface + le même prix déposés
   deux fois en peu de temps → contrôle humain.
5. **Photos réutilisées** : impossible à détecter sans un service tiers d'empreinte d'image (refusé :
   pas de tiers). Parade : signalement + contrôle humain sur les annonces qui cumulent plusieurs
   signaux (prix très en dessous du marché, texte copié, compte récent).
6. **Comptes neufs** : les trois premières annonces d'un compte de moins de 7 jours passent en
   contrôle humain avant publication (pré-modération ciblée, pas générale).

## 8. États d'une annonce

`brouillon` → `attente de paiement` (professionnel seulement) → `publiée` → `réservée` /
`sous compromis` → `louée` ou `vendue` → `expirée` → `archive 30 jours` → `supprimée`.
Chaque transition journalise qui, quand, pourquoi. Une annonce `vendue` reste consultable 30 jours
avec un bandeau, puis disparaît : c'est bon pour le référencement et ça évite les pages mortes.

## 9. Durée, quota, prix (décidé le 24/10/2026)

### Durée : c'est l'annonceur qui choisit

**1 mois minimum, 3 mois maximum** à la publication, puis **une prolongation de 3 mois**, pour un
**maximum absolu de 6 mois**. Conséquences arithmétiques, à tenir dans le code :

- 1 mois → prolongation possible de 3 mois → **4 mois** au total. Une seconde prolongation est
  refusée, mais l'annonceur peut republier une annonce neuve (même bien, nouveau délai).
- 2 mois → prolongation de 3 mois → **5 mois**.
- 3 mois → prolongation de 3 mois → **6 mois**, plafond atteint.
- **La prolongation est un bouton unique, une seule fois par annonce**, jamais un renouvellement
  automatique : aucun prélèvement récurrent, aucun abonnement caché. Le plafond de 6 mois se calcule
  en jours réels (mois = 30 jours), pas en « mois calendaires ».
- À l'échéance : l'annonce passe en `expirée`, reste **archivée 30 jours** avec un bouton
  « republier », puis disparaît. Elle n'est jamais supprimée du jour au lendemain.

### Prix : il dépend de la durée

| Durée choisie | Particulier | Professionnel (HTVA) | Équivalent / mois |
|---|---|---|---|
| 1 mois | **0 €** (au début) | **49 €** | 49 € |
| 2 mois | **0 €** (au début) | **79 €** | 39,50 € |
| 3 mois | **0 €** (au début) | **99 €** | 33 € |
| Prolongation +3 mois | **0 €** (au début) | **79 €** | 26,30 € |

- **Le particulier est gratuit « au début »** — décision explicite de l'utilisateur, avec sa
  condition : **quoi qu'il arrive, cela restera un prix démocratique**. Donc, si la gratuité devait
  un jour s'arrêter, le prix d'un particulier ne pourra jamais dépasser l'ordre de grandeur de
  `/annonce` (5 €), **jamais un pourcentage de la transaction, jamais une commission**. C'est écrit
  ici pour que la décision ne se perde pas : la gratuité est un **réglage** (0 € tant qu'on veut),
  pas une promesse technique.
- **Le professionnel paie, et c'est là que la durée compte** : la grille récompense l'engagement.
  Six mois coûtent au maximum **178 € HTVA** (99 € + 79 €), contre 294 € si l'on payait six fois un
  mois. Le meilleur tarif mensuel est à 3 mois : 33 €.
- **Tout est réglage** : les quatre montants professionnels, les trois durées, le montant de la
  prolongation, le plafond de 6 mois et le prix particulier (0 €) vivent dans le panneau
  d'administration. Rien en dur dans le code, rien dans une page HTML.
- **Quota particulier : 3 annonces actives** (un particulier a rarement plus d'un bien).
  Quota professionnel : à définir avec le premier client réel, pas avant.

## 10. Recherche et filtres

Opération (vente/location) · type de bien · **code postal + rayon réglable par une latte de 0 à
50 km** (l'utilisateur choisit la distance, il ne la choisit pas dans une liste de quatre valeurs) ·
prix min/max · **surface minimale** · **chambres à partir de 1** · salles de bain · extérieur
(jardin, terrasse, balcon) · garage ou parking · ascenseur · état · meublé (location seulement) ·
**PEB : les neuf classes sont sélectionnables, une par une, en multi-choix** · tri : plus récentes,
prix croissant, surface, distance.

Décisions d'écran du 24/10/2026, prises sur retour de l'utilisateur :

- **La distance n'est plus une liste de puces (1/5/10/50 km).** C'est une **latte de 0 à 50 km** dont
  le curseur donne la valeur, doublée d'un **champ où l'on tape le nombre de kilomètres**. Les deux
  sont la même donnée : bouger la latte remplit le champ, taper le champ déplace la latte. Une seule
  valeur, deux façons de la saisir (règle « une grandeur = une source »).
- **« Chambres » commence à 1.** Un studio ou un une-chambre n'avait aucun choix sous 2 : le filtre
  excluait la majorité des locations. Échelle : `1+` `2+` `3+` `4+` `5+`, plus « peu importe ».
- **Le PEB se filtre par classe, toutes les classes.** Neuf cases colorées, chacune bascule
  (A++ A+ A B C D E F G) ; plusieurs cases peuvent être allumées à la fois (« B ou C »). Une case
  éteinte garde la teinte de sa classe, très pâle, pour rester reconnaissable. Raccourci
  « C et mieux » qui allume d'un coup A++ à C.
- **Aucune case allumée = aucun filtre.** C'est la règle explicite, à écrire dans le code et à
  vérifier par un test : le PEB n'est jamais un filtre par défaut. Toutes les annonces remontent,
  **y compris celles qui n'ont pas de PEB** (terrain, parking, garage) — elles portent la mention
  « pas de PEB » sur leur carte. Dès qu'une classe est choisie, seules les annonces de ces classes
  remontent, et les biens sans PEB sortent du résultat.
- **Deux critères de location seulement** (décidés le 24/10/2026) : **disponible à partir du**
  (date, ou « immédiatement ») et **animaux acceptés**. Ils ne s'affichent pas quand on est en vente.
- **Pas de filtre sur les charges**, décision révisée avec l'utilisateur : les charges ne sont pas
  comparables d'un bien à l'autre (tantièmes, chauffage inclus ou non, ascenseur, syndic), donc un
  « maximum de charges » trierait sur un chiffre qui ne veut pas dire la même chose partout. Les
  charges restent **affichées** sur la fiche, séparées du loyer, sans servir de filtre.

Filtre par défaut à l'ouverture de la porte : **vente et location séparées dès le premier écran**
(ce sont deux marchés différents, pas un filtre caché).

## 11. Liens avec les autres portes

- Un même compte publie dans `/annonce` et dans `/immo`.
- Le **déménagement** et le **mobilier** renvoient de `/immo` vers `/annonce` (« meubler ce
  logement »), et `/annonce` renvoie vers `/immo` pour les recherches de logement. C'est le seul
  endroit où les deux portes se citent.
- `/artisan` est le débouché naturel des travaux annoncés dans une annonce `/immo`.

## 12. Questions ouvertes

1. ~~**Location courte durée** (Airbnb-like)~~ **Tranché le 24/10/2026 : non en V1.** Voir §3.
2. ~~**Le particulier peut-il vendre ?**~~ **Tranché le 24/10/2026 : oui**, y compris la vente, et
   **gratuit pour lui au début**, avec la condition que cela reste un prix démocratique (§9).
   La pré-modération des comptes de moins de 7 jours (§7.6) s'applique à la vente comme à la
   location : c'est le garde-fou contre le faux vendeur.
3. ~~**Numéro IPI obligatoire pour les agences**~~ **Tranché le 24/10/2026 : oui, avec vérification.**
   Système en trois contrôles (§6) : BCE automatique, IPI humain, re-contrôle annuel.
4. ~~**Durée et prix côté professionnel**~~ **Tranché le 24/10/2026** : durée choisie par l'annonceur
   (1 à 3 mois, +3 une fois, plafond 6 mois) et grille 49 / 79 / 99 € + prolongation 79 € (§9).
5. **Registres PEB publics — relevé du 24/10/2026.** Deux sur trois sont trouvés et répondent :
   - **Wallonie** : `https://www.registrepeb.be/` (HTTP 200). C'est le registre public des
     certificats PEB wallons, lié depuis la page officielle `energie.wallonie.be`.
   - **Flandre** : `https://www.energiesparen.be/EPC-register` (HTTP 200).
   - **Bruxelles** : **pas encore trouvé.** La page officielle
     « Le registre des certificats PEB des logements bruxellois » décrit le registre et son intérêt
     public, mais **n'expose aucun lien vers l'application** dans son HTML (ni lien direct, ni
     iframe — vérifié). **L'utilisateur fera cette recherche lui-même** (décision du 24/10/2026) et on
     reviendra sur le point plus tard. Tant que l'URL n'est pas connue, la page du bien affiche le
     numéro de certificat **sans lien** pour Bruxelles. **Ne pas inventer d'adresse.**
6. **Dossier BCE open data — non résolu le 24/10/2026.** Vérifié : la recherche publique
   `kbopub.economie.fgov.be` répond en 200 mais **n'offre pas d'API** ; le portail `opendata.bosa.be`
   publie **BeST** (registres d'adresses), **pas la BCE** ; les URL candidates de dump mensuel
   testées répondent 404. Conséquence honnête : **le contrôle automatique du numéro d'entreprise
   n'est pas encore implémentable en l'état**, il faut soit trouver le dump officiel, soit faire ce
   contrôle à la main comme le numéro IPI. Ce point conditionne l'étape 2 du §6 et doit être tranché
   avant de coder la vérification des agences.

## 13. Ce qui reste à produire pour clore cette porte

- [x] Décisions de cadrage : courte durée (non), vente par un particulier (oui, gratuite), durées et
      prix, vérification des agences (manuelle), logo d'agence, description encadrée
- [x] Maquettes : liste et page du bien, avec le bloc PEB
- [x] Maquette du dépôt en 4 étapes, avec le choix de durée et son prix
- [x] Version mobile 390 px de la page du bien (3 écrans : haut de fiche, description + PEB, agence
      et contact)
- [ ] Relevé du registre PEB de Bruxelles — **l'utilisateur s'en charge** (§12.5)
- [ ] Relevé du dump BCE et de son format (§12.6) — bloquant pour l'automatisation, pas pour la V1
- [ ] Maquette de l'écran de vérification d'une agence (badge + état « en contrôle »)

## 14. Partage (règle du hub — 25/10/2026)

Décision de l'utilisateur du 25/10/2026, valable pour les huit portes : un **bouton de partage
ressemblant au logo WhatsApp** sur chaque fiche.

- **Le bouton de `/promo`, pas un bouton WhatsApp** (correction du 25/10/2026) : sous « Demander une
  visite », un rond de 34 px, fond transparent, bordure fine, **flèche de partage** en `currentColor`,
  encre foncée et orange au survol. Aucun vert, aucun bloc de marque. Au clic : `navigator.share`,
  sinon le menu de repli de `/promo` (WhatsApp · E-mail · Copier le lien). Sans SDK, sans clé.
- **Partage sans compte** : le lien reçu doit pouvoir être repassé par n'importe qui.
- **Message** : titre du bien, prix, commune, lien. **Jamais** la rue ni le numéro (la règle du
  §4 tient aussi dans le partage : le code postal suffit), jamais le nom de l'agence transformé en
  coordonnées, jamais un téléphone.
- **Pas de compteur de partages.**
- **Open Graph** (titre, prix, photo 1 200 × 630) obligatoire, sinon l'aperçu est nu dans WhatsApp.
  Fiche retirée ou vendue : page explicative, **jamais 404**.

Maquette : `maquettes/partage.html` + `immo.html` (bouton sous « Demander une visite »).

## 15. Ce qui est construit, et ce qui reste ouvert (28/10/2026)

La porte est branchée : quatre écrans (`/immo`, `/immo/nouvelle`, `/immo/mes-biens`, `/immo/<id>`) et
sept routes d'API (`GET /api/immo`, `/api/immo/meta`, `/api/immo/<id>`, `POST /api/immo`,
`POST /api/immo/<id>/{retirer,prolonger,reserver,compromis,vendre,louer}`, `GET /api/moi/immo`,
`POST /api/moderation/biens/<id>`). Le module est `socle/immo.mjs`, les tables `biens_immo` et
`porte_immo` (dans le schéma commun).

**Trois décisions prises en construisant, qui modifient ce document :**

- **§ 6 — l'agence sans numéro IPI ne publie pas.** Ce document disait « elle peut publier comme
  particulier, sans le badge ». Décision du 27/10/2026 : elle ne publie pas. Raison : un compte qui se
  déclare agence et publie sans badge met en face du client exactement ce qu'il croit ne pas avoir —
  une agence non identifiable. Le refus est posé à la saisie, il nomme le manque (`ipi`) et renvoie à
  l'écran du compte. Un professionnel qui **ne se déclare pas** agence (marchand de biens, notaire,
  société vendant son immeuble) publie normalement, BCE affiché.
- **§ 6 — le numéro IPI est affiché comme DÉCLARÉ, pas comme vérifié.** Le contrôle manuel du § 6.3
  n'est pas encore implémenté : aucun geste de modérateur n'écrit `ipi_verifie_le`. L'écran ne peut
  donc pas dire « vérifié le … » ; il dit « n° IPI … (déclaré) » et précise que nous ne certifions ni
  la compétence, ni la solvabilité.
- **§ 2 — la Région se déduit d'une TABLE explicite** des régions du fichier des codes postaux
  (« Bruxelles-Capitale », « Wallonie », « Vlaanderen »). Une reconnaissance par motif refusait tous
  les biens gantois et brugeois.

**Ce qui est exercé, avec quels chiffres** : `tests/immo.test.mjs` **35 / 0** (PEB par Région, refus
anti-arnaque, durée et prolongation unique, plafond de 180 jours, pré-modération ciblée, migrations
depuis une base d'hier, absence de colonne d'adresse) · **la suite Node entière 415 / 0** ·
`tests/epreuve-http.sh` **393 / 0** dont **41** contrôles pour cette porte (dont l'IPI, les six refus de
saisie, la fiche sans coordonnées, la messagerie, le signalement, la prolongation unique, le retrait,
les deux marchés) · `outils/audit-immo.sh` **423 / 0** à 1440 et 390 px.

**Ce qui reste ouvert, nommé :**

1. **Le geste de vérification du numéro IPI** et son re-contrôle annuel (§ 6.3) — l'écran dit
   « déclaré » en attendant, il ne ment pas.
2. **Aucune pagination par curseur** : la liste s'arrête à 200 et l'écran le dit (« N biens sur M —
   affinez la recherche »).
3. **Pas d'image de bien** dans cette version : la fiche n'affiche pas de cadre vide et ne parle jamais
   de photo absente (règle du hub) ; le dépôt d'image viendra avec le module commun.
4. **Open Graph par bien** (§ 14) : le partage fonctionne, l'aperçu riche n'est pas encore servi par
   une page statique par annonce.
