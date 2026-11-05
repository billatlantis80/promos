# Relecture experte — porte `/job-etudiant`

**25 octobre 2026.** Demande de l'utilisateur : « *revérifie en tant qu'expert toute la partie job
étudiant, ce qui ne correspond pas, ce qui doit être adapté, ce qui n'a pas de logique ou de cohérence,
et adapte si nécessaire.* »

Ce fichier est le **registre des constats**. Il dit, pour chacun : ce qui était écrit, ce que dit la
source, pourquoi c'est incohérent, et ce que j'ai changé. Les corrections sont appliquées dans
`SPEC-JOB-ETUDIANT.md` (§ 15) et `MODELE-DONNEES-JOB-ETUDIANT.md` (version 2).

## Ce qui a été relu, et comment

| Objet | Volume | Ce que j'y ai cherché |
|---|---|---|
| `SPEC-JOB-ETUDIANT.md` | 430 lignes, 14 sections | règles sans source, chiffres qui ne se recoupent pas, contradictions internes |
| `MODELE-DONNEES-JOB-ETUDIANT.md` | 240 lignes, 23 tables | champs affichés à l'écran et absents du modèle, et l'inverse ; états, transitions, rétention |
| `app3/note-legale-belgique.md` | 578 lignes | **chaque règle chiffrée confrontée à sa citation** : 8 h, pause, nuit, 650 h, 12 mois, 19 mentions, 5 mentions, Unia |
| `app3/app3-evaluation.html` | rendu | les trois valeurs de l'évaluation, la symétrie, le signalement privé |
| `maquettes/job-etudiant.html` | 119 Ko, 11 écrans | ce que l'écran affirme, et si la donnée existe derrière |
| `maquettes/job-etudiant-mobile.html` | 20 Ko, 4 vues | les quatre états de la grille, les cibles tactiles, les actions |
| `maquettes/audit-job-etudiant.py` | 119 contrôles | **rejoué** : 119 réussis, 0 échec |
| `app3/tests/verifie-textes.mjs` | 56 textes, 57 motifs | **rejoué** : 0 faute |

**La méthode qui a trouvé les six constats graves** : pour chaque chiffre affiché à l'écran, remonter à
la table qui le produit. Chaque fois qu'un chiffre n'avait pas de table — ou que la table ne pouvait pas
le contenir — c'était un constat.

---

## Le registre — 25 constats, 6 de gravité haute

### Gravité haute — un chiffre ou un champ affiché qui n'a pas de source

**A1 — Le compteur de 650 h n'a aucune source de données.** *(haut)*
*Écrit* : « 128 h sur 650 h » sur trois écrans, et le modèle dit « somme des heures de l'année civile ».
*Réalité* : la somme était prise sur `missions`, qui ne contient **que** des missions d'entraide
(`univers: entraide`). L'univers jobs ne produit **aucune** ligne : pas de candidature, pas de contrat,
pas d'heures. La plateforme ne peut pas compter ce qu'elle ne voit jamais.
*Conséquence* : un chiffre inventé, sur la même porte qui interdit d'inventer un barème de salaire.
*Changé* : table **`heures_declarees`** (étudiant, entreprise, mois, heures), et libellé « déclaré par
toi — la référence officielle reste Student@work ». C'est le même statut que le carnet : déclaratif et
assumé.

**A2 — Le compteur de 8 h ne comptait pas les missions acceptées.** *(haut)*
*Écrit* : « somme des missions **terminées** sur la semaine ISO », et « refuse d'accepter une mission qui
dépasserait 8 h ».
*Réalité* : au moment d'accepter, **aucune** mission de la semaine n'est terminée. Cinq missions de 8 h
acceptées le lundi passaient donc toutes : le contrôle portait sur une somme qui valait zéro.
*Changé* : le compteur porte sur les missions **engagées** (acceptées, en cours, terminées) de la
semaine visée. Et il retient **la plus grande des deux durées** (prévue, déclarée) : sous-déclarer ne
libère plus de quota.

**A3 — La communauté scolaire n'existe pas dans le modèle.** *(haut)*
*Écrit* : l'écran demande « dans quelle communauté est ton école ? » et en dépendent les vacances, les
heures de cours bloquées et l'ouverture de la journée.
*Réalité* : `comptes.langue` (`fr`·`nl`·`de`) était le seul champ approchant. **Utiliser la langue comme
communauté est exactement le piège que la décision 24 interdit** : un étudiant néerlandophone scolarisé
en FWB doit avoir `langue = nl` **et** `communaute = fwb`.
*Changé* : `profils_etudiant.communaute`, déclarée et vérifiée sur l'attestation, **jamais déduite du
code postal** (Bruxelles est en FWB, la frontière linguistique ne suit pas les provinces).

**A4 — Le nom de l'établissement est demandé à l'écran et stocké nulle part.** *(haut)*
*Écrit* : « Établissement — sert à vérifier ton attestation à la main. Le nom de l'école n'est jamais
publié. » Le modèle disait l'inverse : `etudes` « facultatif, **jamais le nom de l'école** ».
*Réalité* : un champ collecté et non stocké n'existe pas. **La vérification manuelle annoncée était
impossible.**
*Changé* : `profils_etudiant.etablissement`, privé, **effacé dès l'attestation vérifiée** (on garde la
date et l'auteur). Un nom d'école + une date de naissance + un prénom, c'est un mineur identifié : il ne
reste pas.

**A5 — La distance « arrondie à 300 m » est une précision inventée.** *(haut)*
*Écrit* : « la position sert à calculer une distance, **arrondie à 300 m** », et trois écrans répètent
l'arrondi. Le modèle stockait `lat_300m` / `lon_300m`.
*Réalité* : la même porte **refuse de demander la position** (liste ferme du § 10 : « position »). Sans
position, on ne mesure pas 300 m : on calcule entre deux **centroïdes de commune**. Les « 1 km / 2 km /
3 km » affichés sont de même nature — présentés comme mesurés.
*Changé* : distance **estimée entre communes**, dite comme telle ; `lat_300m`/`lon_300m` supprimés ; règle
posée pour le cas qui n'existait pas encore : la même commune s'écrit « **même commune** », jamais
« 0 km ». *(À noter : aucune maquette n'affichait réellement « 0 km » — mon premier jet de ce constat le
disait, c'était faux, corrigé.)*

**A6 — La rétention de 12 mois détruisait le compteur de 12 mois.** *(haut)*
*Écrit* : `missions` conservées **12 mois** ; « 12 mois chez le même employeur = écart entre la première
et la dernière mission ».
*Réalité* : au 13ᵉ mois, la première mission est effacée, l'écart retombe à un mois, **et le compteur
repart de zéro**. La règle de protection s'auto-annule exactement quand elle devient utile.
*Changé* : `heures_declarees` conservées **24 mois** (il faut l'année précédente), et l'ancienneté se
calcule dessus.

### Gravité moyenne — une promesse sans mécanique

**A7 — Aucune table de messages.** *(moyen)* Le hub impose la messagerie Kazendra comme **seul** canal ;
un écran dit « vous recevez des messages, pas des dossiers » ; `signalements.cible_type` prévoit
`message`. Et le modèle n'avait rien. *Changé* : table `messages`, **sans champ pièce jointe** — « un
message, pas un dossier » se tient par un schéma, pas par un règlement. Composant du hub, spécifié une
fois pour les huit portes.

**A8 — Le signalement n'existait que sur la mission.** *(moyen)* « Signaler un problème » est sur
l'écran mission (bureau et mobile) — mon premier jet disait « aucun écran », c'était faux. Mais **une
annonce et un profil** ne pouvaient pas être signalés, alors que `cible_type` les prévoit et que le DSA
impose un signalement sur un contenu **public**. *Changé* : « Signaler » ajouté sur la fiche d'une offre.

**A9 — Un créneau n'était jamais libéré.** *(moyen)* Refus, annulation, expiration : l'heure restait
`reserve` et disparaissait de la semaine. Un étudiant qui refuse trois demandes voyait son agenda se
vider. *Changé* : trois transitions de libération, dans la même transaction.

**A10 — Une mission pouvait traverser minuit.** *(moyen)* Les règles de nuit (22:00–06:00) et de dimanche
portaient sur l'heure de **début**. Une mission de 4 h commencée à 20:00 finissait à minuit : un mineur
travaillait la nuit sans qu'aucun contrôle ne s'en aperçoive. *Changé* : le contrôle porte sur
**l'intervalle entier**.

**A11 — Le « statut » d'une annonce n'existait pas dans les données.** *(moyen)* Une des cinq mentions
obligatoires (note légale § 7 quater) était affichée à l'écran sans colonne derrière. *Changé* :
`annonces.statut`, avec une règle que la note impose : **« bénévolat » n'est proposé qu'à une ASBL** —
le bénévolat est défini pour le secteur non marchand (loi du 3 juillet 2005), et une société commerciale
qui « emploie » un bénévole fait du travail dissimulé.

**A12 — Le badge « 18 ans et plus » n'avait aucune donnée derrière lui.** *(moyen)* L'écran affiche le
badge et explique pourquoi ; le modèle ne stockait ni `nuit`, ni `activite_interdite_mineurs`. *Changé* :
les deux interrupteurs, et `reserve_18` **calculé**, jamais saisi. `sponsorise` ajouté aussi — c'est la
mention légale obligatoire le jour où l'annonce est payante.

**A13 — La pré-modération de l'entraide contredisait l'expiration à 2 h.** *(moyen)* La spec § 6
annonçait « pré-modération de l'univers entraide ». Une demande privée adressée à **un seul** étudiant,
qui expire **deux heures avant le créneau**, ne peut pas attendre une modération humaine sous 24 h.
*Changé* : la spec dit le contraire, et dit pourquoi — ce qui protège ici, c'est la vérification manuelle
des **profils** et le signalement. Les annonces restent modérées avant publication : c'est public.

**A14 — Trois listes de tables, aucune identique.** *(moyen)* La spec § 7 nommait 16 tables, la spec § 9
en annonçait 23, le modèle en avait 23 mais pas les mêmes (`planning` et `disponibilites` fondues en
`creneaux`, `moderation` absente). *Changé* : une seule liste, **26 tables**, dans les deux documents.

**A15 — « Deux étiquettes seulement » alors que le carnet en affiche trois.** *(moyen)* La spec disait
deux (« confirmé », « déclaré par toi ») ; l'écran en a trois, la troisième étant « **annulée** ».
C'était la spec qui était fausse : une mission annulée n'a pas eu lieu, le dire est une honnêteté, pas une
validation de plus. *Changé* : la spec.

**A16 — La spec disait « 5ᵉ secondaire », le persona est en rhéto et l'écran affiche « 6ᵉ ».** *(bas)*
Trois sources, deux valeurs. *Changé* : la spec s'aligne sur le persona et la maquette.

**A17 — La liste des services n'était pas celle de la source, dans les deux sens.** *(moyen)*
« Promener le chien » était proposé alors que la note légale dit que sa qualification **n'est pas
tranchée** ; « soutien scolaire » et « informatique » aussi, sans qu'aucun texte ne les cite. Et
« **accompagnement** » — *accompagner une personne moins mobile*, cité mot pour mot par l'exemption
ONSS — **manquait**. *Changé* : la liste devient **courses · pharmacie · compagnie · accompagnement ·
autre**, cinq tuiles, aucune composition ne bouge.

**A18 — La jauge de 8 h protège sans le dire.** *(moyen)* Elle ne voit que les missions de Kazendra. Un
étudiant qui fait 6 h ailleurs dépasse le plafond légal sans que la jauge bouge. *Changé* : champ « heures
faites ailleurs cette semaine » prévu au modèle, et l'écran dit ce que la jauge voit.

### Gravité basse — la mécanique qui manque un cas

**A19 — `creneau_id` unique ne représente pas une mission de 90 minutes.** *(bas)* Une grille horaire ne
contient pas 90 minutes, et deux missions pouvaient se chevaucher. *Changé* : `debut` / `fin` /
`pause_min` / `duree_travail_min`. **Conséquence écrite** : une mission de 8 h de travail avec sa pause
d'une heure **occupe 9 h de la journée** — les compteurs comptent le travail, l'agenda la présence.

**A20 — Le code à 4 chiffres est haché sans limite d'essais.** *(bas)* 10 000 possibilités, un hachage
décoratif. *Changé* : 3 essais, valable le jour du créneau, régénération par la personne aidée.

**A21 — Deux personnes peuvent confirmer la même mission, sans préséance.** *(bas)* `confirmations`
accepte la personne aidée **ou** la personne de confiance, sans règle. Une confirmation et son contraire
pouvaient coexister. *Changé* : la réponse de la personne aidée prime ; la personne de confiance est
retenue seulement si la personne aidée n'a pas répondu sous **7 jours**.

**A22 — Les trois valeurs de l'évaluation n'étaient pas nommées.** *(bas)* Le modèle disait « trois
valeurs fermées » sans les écrire. *Changé* : `tres_bien` · `correct` · `probleme`, symétriques (la
personne aidée évalue l'étudiant, l'étudiant évalue la personne aidée), et `probleme` **n'est pas une
mauvaise note** : il ouvre un signalement privé.

**A23 — Le téléphone unique bloquait les mineurs.** *(bas)* `comptes.tel` est unique ; un adolescent sans
ligne à son nom ne peut pas s'inscrire, et son parent ne peut pas avoir de compte avec le même numéro.
*Changé* : `tel` facultatif pour un 16–17 ans, le téléphone vérifié étant celui du tuteur.

**A24 — Le digicode était gardé 30 jours et exporté.** *(bas)* `adresses.code_acces` vivait 30 jours
après la mission, dans un zip qui dort 30 jours. *Changé* : effacé **à la clôture de la mission**, et
`adresses` **exclue de l'export**.

**A25 — Le compteur de sollicitations était un entier.** *(bas)* `statuts.sollicitations_du_jour` ne dit
ni qui, ni quand, ni pourquoi la quatrième est refusée. *Changé* : table `sollicitations`, compteur
calculé.

---

## Ce que la relecture a trouvé juste — et il faut le dire aussi

Une relecture qui ne trouve que des fautes n'est pas une relecture, c'est une humeur.

- **Les six contraintes belges sont conformes à leur citation** : 8 h/semaine chez un ou plusieurs
  employeurs, pause 30 min au-delà de 4 h 30 **et** 1 h au-delà de 6 h, liste noire du travail manuel,
  nuit **22:00–06:00** pour les plus de 16 ans (20:00 en dessous — la note le dit), dimanche et jours
  fériés, 650 h/an, 12 mois chez le même employeur.
- **Les cinq mentions obligatoires d'une annonce** sont exactement celles de la note légale
  (§ 7 quater) : employeur identifié, lieu, durée, statut, rémunération + commission paritaire.
- **Aucune interdiction d'âge dans le texte d'une offre**, et le badge 18+ dit *pourquoi*, pas *qui* —
  conforme à Unia.
- **Aucune donnée interdite n'est stockée** : les 12 entrées de la liste ferme sont vérifiées table par
  table. Pas d'IBAN, pas de casier, pas de pièce d'identité, pas de position, pas de nom de famille d'un
  senior.
- **Les 119 contrôles automatiques passent toujours** après mes modifications, et les 56 textes figés
  sortent à **0 faute**.
- **Les trois lignes rouges tiennent** : ni employeur, ni placeur, ni suivi de trajet. Le montage
  « le contrat est entre l'étudiant et l'entreprise » reste le bon.

## Ce qui reste ouvert, et qui n'est pas de mon ressort

1. **Le nom de l'application** — marque renvoyée avant construction.
2. **La vérification BCE** : combien de temps par dossier, et qui la fait ?
3. **La condition d'âge de l'exemption ONSS** (8 h/semaine) : à lire à la source avant d'ouvrir
   l'entraide aux 16–17 ans. L'univers jobs est déjà ouvert à 16 ans.
4. **L'assurance RC du mineur** : à confirmer par un courtier avant sa première mission.
5. **« Accompagnement »** : c'est le service le plus évidemment couvert, mais la qualification exacte de
   chaque tuile (manuelle ou non) reste à faire confirmer — la note légale ne tranche que celles qu'elle
   cite. C'est une question à poser **une fois**, à un juriste, pour les cinq tuiles ensemble.

## Ce que j'ai changé, en trois lignes

- `MODELE-DONNEES-JOB-ETUDIANT.md` → **version 2** : 26 tables, 15 constats corrigés dedans.
- `SPEC-JOB-ETUDIANT.md` → **§ 15** ajouté (20 constats numérotés 41–54), § 2, § 6, § 7, § 9, § 10.8,
  § 11.23 et § 13.27 corrigés.
- `maquettes/job-etudiant.html` → distance, liste des services (3 retirés, 1 ajouté), « Signaler » sur
  une offre. Captures à régénérer, audit à rejouer.
