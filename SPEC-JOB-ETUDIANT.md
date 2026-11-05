# SPEC — Porte `/job-etudiant`

Ouverte le 25/10/2026. Compagnon de `SPEC-ANNONCE.md`, `SPEC-IMMO.md`, `SPEC-EVENEMENT.md`,
`SPEC-RENCONTRE.md` et de `PLAN-HUB-SEPT-SERVICES.md`.

**Cette porte n'est pas une page blanche.** Elle reprend le **projet n°3 « Entraide »**, cadré du
10 au 11 octobre 2026 (53 décisions, puis mises en pause), dont la source de vérité est :

- `/opt/data/.hermes/plans/2026-10-10_234500-app3-concept-revu-v2.md` — **plan vivant, 53 décisions**
- `/opt/data/app3/note-legale-belgique.md` — note légale sourcée (39 Ko, citations et URL datées)
- `/opt/data/app3/textes/*.json` — 56 textes figés par acteur, contrôlés par
  `node app3/tests/verifie-textes.mjs` (57 motifs interdits, doit sortir **0 faute**)
- `/opt/data/app3/veille/` — relevé automatique des calendriers scolaires (3 communautés)
- `/opt/data/app3/documents/` — ⚠️ **GELÉS** par la décision 50 : on ne les repropose pas

Demande de l'utilisateur, 25/10/2026 : « *La porte job étudiant doit être construite sur notre
discussion du projet numéro 3, entraide.* »

---

## 1. Ce que la porte est — deux univers, une seule porte

> **Et une seule application pour tout le hub** (décision 34 du plan, 25/10/2026) : cette porte n'a
> **pas** d'application individuelle, pas de marque propre, pas de fiche de boutique. Elle vit dans
> l'application **Kazendra**, avec les sept autres portes. « Entraide » **n'est pas une marque** : c'est
> le nom commun de l'univers (celui qui aide ↔ celui qui est aidé), et la provenance historique du
> dossier. Aucun logo, aucune fiche de boutique, aucune « application Entraide ».

| | Univers **ENTRAIDE** | Univers **JOBS** |
|---|---|---|
| Demandeur | particulier (senior, famille, voisin) | entreprise ou ASBL, **numéro d'entreprise vérifié** |
| Tuiles | courses · pharmacie · compagnie · autre (voir § 15, constat 53 : « promener le chien » retiré tant que sa qualification n'est pas tranchée) | annonces et emplois étudiants |
| Rémunération | **l'étudiant fixe son prix** | commission paritaire de l'employeur (salaire convenu) |
| Plafond | **8 h par semaine** | **650 h par an** |
| Contrat | aucun | contrat d'occupation d'étudiant, 2 exemplaires |
| Déclarations | aucune | DIMONA, DmfA, assurance — **par l'employeur** |
| Vocabulaire | « un coup de main » | « une mission », « un job » |

**Le garde-fou qui rend l'architecture sûre** : la bascule ne suit pas un choix libre, elle suit le
**statut vérifié**. Une entreprise fournit son numéro BCE ; un particulier ne peut pas publier une offre
d'emploi (cela ferait de lui un employeur) ; une entreprise qui se déclarerait « particulier » commettrait
du travail dissimulé. Côté étudiant : **deux interrupteurs** (profil entraide / profil jobs), **un seul
compte, un seul parcours d'inscription**.

## 2. Les trois lignes rouges (juridiques, non négociables)

1. **Jamais employeur, jamais placeur.** Le contrat est entre l'étudiant et l'entreprise. L'application
   n'encadre pas le travail, ne facture jamais d'heures, ne place personne. Le travail intérimaire exige
   un agrément régional : on ne s'en occupe pas.
2. **L'argent ne passe jamais par l'application** (décision 39) : paiement direct entre les parties,
   aucun encaissement, aucun séquestre, aucune donnée bancaire, aucune commission, aucune partie au
   contrat. Corollaire (décision 42) : on n'écrit **jamais** « paiement sécurisé » ni « nous garantissons
   le paiement ».
3. **Jamais de suivi de trajet, et jamais de position du tout.** La version 1 promettait une distance
   « arrondie à 300 m » alors que la liste ferme du § 10 refuse de demander la position : une précision
   GPS sans GPS. La seule donnée géographique est le **code postal**, et la distance se calcule **entre
   communes** depuis le centroïde de la table `donnees/codes-postaux/`. **Jamais « 0 km »** : la même
   commune s'écrit « même commune ». L'écran ne dit plus 300 m (relecture du 25/10/2026, constat 6).

## 3. Les six contraintes légales belges déjà vérifiées (10/10/2026)

1. **8 h par semaine** (exemption ONSS des activités occasionnelles non manuelles) — l'écran affiche
   « 4 h sur 8 h cette semaine » et refuse au-delà. Une mission de 8 h consomme la semaine.
2. **Pause obligatoire** : 30 min au-delà de 4 h 30, 1 h au-delà de 6 h.
3. **Liste noire** : ménage, repassage, vitres, jardinage lourd — le travail manuel fait sortir de
   l'exemption et transforme le particulier en employeur.
4. **Aucune clause anti-contournement** : interdire de continuer hors application activerait un critère
   de présomption de salariat. On l'écrit dans les CGU, on ne l'impose pas.
5. **Âge des prestataires — TRANCHÉ le 25/10/2026 : 16 ans.** L'utilisateur a répondu :
   « *Pour le point 3, les job étudiants doivent être ouvert à partir de 16 ans.* » La contrainte
   « 18 ans et plus en V1 » de la note légale est **abrogée**. Les conséquences sont détaillées au
   § 3 bis — elles sont nombreuses et elles ne sont pas facultatives.
6. **Deux compteurs pour l'univers jobs** : **650 h/an** tous employeurs confondus (l'application compte
   ce qu'elle voit, la référence officielle reste Student@work) et **12 mois** ininterrompus chez le même
   employeur.

## 3 bis. Ce que « 16 ans » déclenche dans le code — et ce n'est pas une case à cocher

La décision est prise : **16 ans révolus, sans exception, sans émancipation** (la décision 17 du projet 3,
qui fermait déjà le parcours 15 ans, est confirmée). Mais un mineur de 16–17 ans n'est pas un majeur avec
un an de moins : sept règles deviennent obligatoires, toutes dans le code et pas dans un avertissement.

1. **Pas de nuit** : aucune mission entre **22:00 et 06:00** pour un compte de 16–17 ans.
2. **Pas le dimanche ni les jours fériés** : la journée est bloquée par défaut ces jours-là ; les jours
   fériés belges sont une table, pas une saisie libre.
3. **Pas pendant les heures de cours** : elles sont bloquées par défaut. L'ouverture de journée est une
   **autorisation horodatée valable 6 mois** (décision 22), révoquée automatiquement à l'expiration, avec
   rappel 15 jours avant. Pendant les vacances scolaires **de sa communauté**, la journée s'ouvre seule
   (décisions 24–25) : c'est la table `vacances` qui commande, pas une case.
4. **Accord d'un parent ou tuteur obligatoire**, recueilli à l'inscription, avec son identité et son
   contact, et tracé (qui, quand). Sans cet accord le compte reste **en attente**, il ne publie rien et
   ne reçoit aucune mission. Le lien de confirmation va au tuteur, pas au mineur.
5. **La liste noire du travail manuel reste entière** (ménage, repassage, vitres, jardinage lourd) : elle
   protège encore plus un mineur, puisqu'elle fait sortir de l'exemption et rend le particulier
   employeur.
6. **Les compteurs s'appliquent quand même** : 8 h par semaine pour l'entraide, 650 h par an et 12 mois
   chez le même employeur pour les jobs. Un mineur ne les contourne pas parce qu'il est mineur.
7. **Aucune donnée de mineur conservée après un refus** : si le parcours s'arrête (âge < 16, accord
   parental refusé), la fiche est effacée, pas « mise de côté ». Même règle que la décision 17.

**Deux points à vérifier à la source avant d'ouvrir aux mineurs** — je ne les invente pas, je les liste :

- **L'assurance et la responsabilité civile.** Le projet 3 prévoyait « assurance RC par mission »
  (0,30–0,80 €/mission). Pour un mineur, la responsabilité des parents entre en jeu : la couverture
  exacte doit être confirmée par un courtier **avant** la première mission d'un 16–17 ans.
- **L'exemption ONSS des activités occasionnelles non manuelles** (les 8 h/semaine) : sa condition d'âge
  doit être lue sur la source officielle, pas déduite. Tant que ce n'est pas fait, l'univers **entraide**
  reste ouvert aux 18 ans et plus ; l'univers **jobs** (contrat d'occupation d'étudiant, conclu par
  l'employeur) est ouvert dès 16 ans, parce que c'est l'employeur qui porte la déclaration.

> C'est la seule zone où je prends une précaution que l'utilisateur n'a pas demandée : ouvrir les
> **jobs** à 16 ans tout de suite, et garder les **missions d'entraide** à 18 ans jusqu'à ce que la
> question ONSS soit tranchée à la source. Ce n'est pas un refus de sa décision — c'est la même décision,
> appliquée là où le droit est certain.


## 4. Ce que le projet 3 a déjà tranché et qu'on ne rediscute pas

Planning géré par l'étudiant · bouton de statut type Teams (disponible / occupé / ne pas déranger) ·
disponibilités **heure par heure** · le senior ne voit **que les créneaux libres**, jamais l'agenda
occupé · mission **8 h maximum** avec pause · **deux fiches d'inscription** (étudiant 14 champs,
demandeur 10 champs) et une liste ferme de ce qui n'est **jamais** demandé · évaluation **par des faits,
jamais une moyenne d'étoiles** · signalement **visible par B seul** · le statut « disponible » ouvre les
**missions de dernière minute** (3 sollicitations par jour maximum) · annonces : **aucun âge** dans le
texte, catégories interdites bloquées · **calendriers scolaires par communauté** (FWB, Flandre,
germanophone), relevés automatiquement une fois par an avec une garde hebdomadaire · ouverture des heures
de journée **valable 6 mois**, puis re-vérification · langues **FR · NL · DE** par **tuiles à drapeau**
(la langue est un confort, **la communauté scolaire ne change jamais avec la langue**) · **textes figés**
par acteur et contrôlés par un test qui refuse 57 motifs · **carnet d'heures déclaratif** (« confirmé »
= mission + confirmation ; « déclaré par toi » = la durée) et le mot **« validé » ne s'applique jamais aux
heures** · **aucune attestation d'heures** émise par la plateforme, avec un lien vers Student@work ·
**confirmation par la personne aidée** (décision 52), et une **personne de confiance** qui peut confirmer
à sa place — **deux identifiants, deux comptes, un lien**, jamais un identifiant partagé, parce que la
valeur est la trace de **qui** a confirmé.

## 5. Les quatre points de friction avec le cadrage du hub — et ce que je propose

Le hub a été cadré avant qu'on rouvre ce dossier. Quatre décisions du plan maître ne tiennent plus
telles quelles. Je les écris au lieu de les contourner en silence.

**Friction 1 — « affichage pur » (décisions 5 et 6 du plan).** Le hub disait : `/job-etudiant` affiche,
  aucun CV, aucune candidature, aucune responsabilité. Or le projet 3 décrit une **vraie mise en relation**
  avec missions, code de fin, évaluation par faits et carnet. → ✅ **TRANCHÉE le 25/10/2026 — le projet 3
  gagne** (« *Oui tu peux les clôturer comme ça* ») : vraies missions, et `/emploi` (adultes) reste en
  affichage pur. La responsabilité reste bornée par les trois lignes rouges du § 2. Décision 33 du plan
  du hub, décision 57 du journal du projet 3.

**Friction 2 — le prix.** Le hub prévoyait **25 € HTVA** par annonce d'entreprise. Le projet 3 dit :
**gratuit au lancement**, payant plus tard, facturé **localement**, et **jamais l'étudiant**.
→ ✅ **TRANCHÉE le 25/10/2026 — le projet 3 gagne.** Les champs `payant` et `échéance` sont codés dès
maintenant, pour que le passage à la facturation soit une case à cocher et non une reconstruction.

**Friction 3 — l'âge — ✅ TRANCHÉE le 25/10/2026.** L'utilisateur : « *Pour le point 3, les job étudiants
doivent être ouvert à partir de 16 ans.* » La décision 17 du projet 3 est donc confirmée et la contrainte
« 18 ans » de la note légale est **abrogée**. Les sept règles que cela déclenche dans le code, et les deux
vérifications qui restent à faire à la source, sont au **§ 3 bis**. Ce qui reste : l'univers *jobs* est
ouvert dès 16 ans (l'employeur porte la déclaration) ; l'univers *entraide* attend la lecture de la
condition d'âge de l'exemption ONSS sur la source officielle.

**Friction 4 — où vivent les données — ✅ TRANCHÉE le 25/10/2026.** L'utilisateur : « *On prend la seconde
solution.* » **Application locale sur sa machine** (`projects/job-etudiant`, port 4204, `node server.js`,
zéro dépendance, comme `sape` et `promos`), **un fichier JSON par table** en écriture atomique, et
**exportation quotidienne d'un CSV par table** (UTF-8 BOM, `;`) qu'il ouvre dans son tableur — aucun envoi
vers un tiers, aucune clé. Le détail, les tables et les durées sont dans
**`MODELE-DONNEES-JOB-ETUDIANT.md`**. La limite est écrite : au-delà de ~50 000 lignes sur une table ou
d'écritures concurrentes, on migre vers SQLite.

## 6. Ce que le hub apporte à cette porte

Compte unique (particulier / entreprise, numéro BCE vérifié à la main) · le proxy et le HTTPS · la file de
modération unique (**contrôle des annonces seulement** — voir la correction ci-dessous) · le panneau
d'administration global avec ses trois degrés · les réglages de prix et de quotas · le partage social
(fiches d'annonces seulement — **jamais** une mission ni le nom d'un étudiant) · la règle « **aucune photo
obligatoire** » (décision 29) qui s'applique aussi à la fiche étudiant · le fichier de langue unique.

**Deux corrections du 25/10/2026, après relecture experte :**

- **La demande d'entraide n'est pas pré-modérée.** Coté ici, ce n'était pas tenable : une demande privée
  adressée à **un seul** étudiant, qui **expire deux heures avant le créneau**, ne peut pas attendre une
  modération humaine sous 24 h. Ce qui protège ici, c'est la **vérification manuelle des profils** et le
  **signalement** (trois signalements = masquage, puis décision). Les annonces d'entreprise, elles,
  restent modérées avant publication — c'est une publication publique, et le texte légal l'exige.
- **La messagerie est un composant du hub, pas de cette porte.** Le hub impose la messagerie Kazendra
  comme seul canal ; la table `messages` est décrite au § 4.6 du modèle de données, mais **l'écran se
  spécifie et se maquette une seule fois pour les huit portes**. La version 1 promettait « vous recevez
  des messages » sans modéliser un seul message.

## 7. Par quoi on reprend

Le plan du 11/10/2026 le dit : **par le modèle de données**, parce que tout le reste en découle. Les six
feuilles d'origine (`etudiants`, `demandeurs`, `disponibilites`, `missions`, `avis`, `journal`) deviennent
des tables, plus celles qu'imposent les décisions ultérieures. La liste ci-dessous est celle de la
**version 2, 26 tables** — la version 1 en annonçait 23 et cette liste-ci en nommait 16 : trois listes
pour un même objet, dont aucune ne correspondait aux deux autres.

`comptes` · `profils_etudiant` · `tuteurs` · `profils_demandeur` · `adresses` · `entreprises` ·
`personnes_de_confiance` · `creneaux` · `autorisations_journee` · `statuts` · `sollicitations` ·
`missions` · `mission_etapes` · `annonces` · `heures_declarees` · `messages` · `avis_faits` ·
`confirmations` · `carnet` · `signalements` · `journaux` · `calendriers_scolaires` · `vacances` ·
`jours_feries` · `textes` · `exports`.

**Trois tables ajoutées** (`messages`, `sollicitations`, `heures_declarees`) et **aucune table
`moderation`** : la file de modération est une **vue** sur `annonces.etat = en_attente` et
`signalements.etat = ouvert`, pas une table — une table de file pour deux sources, c'est deux vérités à
garder synchronisées.

## 8. Questions ouvertes, dans l'ordre où elles se posent

1. ~~Où vivent les données~~ — ✅ **tranché le 25/10/2026 : application locale + export quotidien**
   (`MODELE-DONNEES-JOB-ETUDIANT.md` § 1).
2. ~~L'âge~~ — ✅ **tranché le 25/10/2026 : 16 ans** (§ 3 bis). Ne pas reposer la question.
3. ~~Le nom de la porte et de l'application~~ — ✅ **TRANCHÉ le 25/10/2026, décision 34 du plan.**
   L'utilisateur : « *Il me reste dans la cohérence du hub, job étudiant doit être uniquement lié à
   kazendra. Pas d'application individuelle. Toutes les portes devront être dans une seule application.
   Kazendra.* » Le nom est **Kazendra**, unique, pour les huit portes. « Entraide » sort de la surface du
   produit (provenance historique seulement) ; le titre de la porte reste descriptif (« Coups de main &
   jobs étudiants ») ; **Ondavie, Elvardo et Manvido sont archivés, non achetés** — aucun dépôt, aucun
   domaine. Le titre de la section 1 est corrigé en conséquence : « deux univers, une seule porte ».
4. **La vérification du numéro BCE** reste **manuelle** (aucune API) — combien de temps par dossier, et
   qui la fait ?

## 9. Ce qui reste à produire pour clore cette porte

- [x] **Modèle de données complet** — `MODELE-DONNEES-JOB-ETUDIANT.md` **version 2** : 26 tables, machine à états,
      compteurs, durées de conservation, liste ferme de ce qui n'est jamais stocké, export tableur
- [x] **Relecture experte de toute la porte** (25/10/2026, à la demande de l'utilisateur) —
      `AUDIT-EXPERT-JOB-ETUDIANT.md` : **21 constats**, dont **6 de gravité haute** (compteur de 650 h
      sans source, compteur de 8 h qui ne comptait pas les missions acceptées, communauté scolaire
      absente du modèle, établissement collecté mais non stocké, distance de 300 m sans position,
      rétention de 12 mois détruisant le compteur de 12 mois). Corrigés dans le modèle v2 et ci-dessous.
- [x] **Machine à états réconciliée** — le chiffre « 15 états » de cette checklist était **faux** : le
      projet 3 en compte **3** (demandée, acceptée, terminée) et le modèle **9** (3 visibles par la
      personne aidée, 3 techniques côté étudiant, 3 terminaux). Réconciliation écrite dans
      `MODELE-DONNEES-JOB-ETUDIANT.md` § 4.3, avec les transitions interdites.
- [x] **Les 56 textes figés sont alignés** — un seul contredisait le hub : `entreprise.trois.types`
      annonçait « emploi étudiant, mission ponctuelle, appel de quartier ». Réécrit en **deux statuts**
      (contrat d'occupation d'étudiant, bénévolat), parce qu'une entreprise ne publie jamais une
      « mission chez un particulier ». Fichier `app3/textes/entreprise-fr.json` version **1.1**, et
      deux règles du texte qui manquaient aux maquettes y ont été ajoutées : le **plafond de trois
      annonces actives** et la mention **« annonce sponsorisée »** le jour où la publication devient
      payante.
- [x] **Maquettes, premier lot** : accueil deux univers, parcours d'une mission, inscription à un seul
      écran — `maquettes/job-etudiant.html` + `job-accueil.png`, `job-parcours.png`, `job-inscription.png`
- [x] **Maquettes, second lot** : agenda / statut, demande, mission, carnet — `job-agenda.png`,
      `job-demande.png`, `job-mission.png`, `job-carnet.png`
- [x] **Maquettes, troisième lot** : annonces d'entreprise — liste, fiche, dépôt, mes offres
      (`job-offres.png`, `job-offre.png`, `job-depot-entreprise.png`, `job-mes-offres.png`) — 11 écrans
- [x] **Planche mobile 390 px** — `job-etudiant-mobile.html` + `job-etudiant-mobile-390.png` (4 vues)
- [x] **Décision sur les quatre frictions du § 5** — les quatre closes le 25/10/2026 (âge 16, base locale,
      projet 3 gagne sur « vraies missions » et sur « gratuit au lancement ») : plan du hub décision 33,
      journal du projet 3 décision 57
- [x] **Contrôle des textes après modification** : `node app3/tests/verifie-textes.mjs` →
      « 4 fichiers, 56 textes, 57 motifs — aucun texte interdit », **0 faute**

## 10. Ce que le premier lot de maquettes a tranché (25/10/2026)

Écrit ici pour qu'une session future ne rouvre pas ces points : ce ne sont pas des esquisses, ce sont des
décisions d'écran, et elles découlent des § 1 à 5.

1. **L'accueil montre les deux univers à poids égal**, en deux colonnes de même largeur, chacune avec sa
   couleur (entraide = bleu, jobs = orange) — et pas une porte d'entrée « emploi » avec l'entraide en
   sous-catégorie. Le vocabulaire est rappelé dans chaque colonne (« un coup de main » / « une mission »).
2. **La frontière est expliquée par un schéma à deux lignes** (compte particulier → entraide, compte
   entreprise vérifié BCE → jobs), jamais par une case à cocher. La phrase de raison est écrite en clair :
   travail dissimulé d'un côté, employeur involontaire de l'autre.
3. **L'état réel est affiché, pas caché** : « les jobs sont ouverts dès 16 ans ; les coups de main restent
   à 18 ans tant que la condition d'âge de l'exemption ONSS n'a pas été lue à la source ». C'est dans le
   bloc « 16 et 17 ans », en encadré, pas en note de bas de page. **On ne promet pas une date.**
4. **Les sept règles des mineurs sont numérotées de 1 à 8 dans l'ordre de lecture** (elles incluent les
   compteurs, d'où huit). Elles sont dans le corps de la page, pas dans une page « conditions ».
5. **Les cinq compteurs sont des jauges avec le refus écrit** (« la mission suivante est refusée »,
   « jusqu'au lendemain »). Un compteur qui n'explique pas ce qu'il bloque est décoratif.
6. **L'inscription tient sur un seul écran et cinq blocs numérotés** : toi · ton école · ce que tu cherches
   · ta fiche · tes accords. Il n'y a **aucune étape** et **aucune barre de progression**.
7. **La communauté scolaire est le seul bloc surligné de l'écran**, en tuiles à drapeaux (Wallonie-
   Bruxelles, Flandre, Ostbelgien), avec la phrase qui dit ce qu'elle décide et qu'elle ne change que sur
   preuve. Le sélecteur de langue est **au-dessus du titre**, en commande, avec la mention « la langue
   change la lecture de la page — jamais le calendrier ».
8. **L'établissement est demandé mais jamais publié** : le champ existe pour la vérification manuelle,
   l'affichage ne garde que l'année (« 6ᵉ secondaire », rhéto — le persona du § 11 est en rhéto, la
   version 1 de cette ligne disait « 5ᵉ » et contredisait à la fois le persona et la maquette). Le nom de
   famille n'est **pas demandé du tout**, et le prénom est la seule identité publique.
   ⚠️ Ce champ **n'existait pas dans le modèle de données** de la version 1 : on demandait à l'écran un
   nom d'école qu'aucune table ne recevait, ce qui rendait la vérification manuelle impossible. Il est
   ajouté (`profils_etudiant.etablissement`), privé, et **effacé dès l'attestation vérifiée**.
9. **La photo est présentée comme un choix (0 ou 1)**, jamais comme un cadre vide à remplir : la tuile dit
   qu'une fiche sans photo s'affiche entière, sans mention « sans photo ». C'est la décision 29 du hub
   appliquée à l'inscription, pas seulement à l'affichage.
10. **L'accord parental est un bloc de la colonne de droite, pas une case à cocher** : quatre champs
    (parent, e-mail, téléphone, lien), la phrase « le lien part chez ton parent, pas chez toi », et la
    rèvocation possible à tout moment. Sans lui : compte en attente, rien publié, rien reçu.
11. **La colonne de droite porte les refus**: liste ferme de ce qui n'est jamais demandé (IBAN, pièce
    d'identité, casier, adresse exacte, registre national, santé, position), ce qui est vérifié à la main,
    ce qui arrive juste après, et ce que ça coûte (0 €). **Le prix n'est pas un champ du formulaire
    d'entreprise : c'est un champ du profil étudiant, côté entraide.**
12. **Aucun bouton de partage sur ces trois écrans** (vérifié par programme : 0). Une fiche d'annonce
    d'entreprise pourra en avoir un ; une mission, un profil ou un nom d'étudiant, jamais.
13. **Contrôle d'affichage exécuté, pas supposé** : `capture-job-etudiant.py` mesure 0 texte coupé,
    0 débordement hors cadre 1440 px, 0 erreur JS, 6 drapeaux chargés. Trois défauts trouvés et corrigés
    au passage — deux sélecteurs CSS trop larges (`.ul li b`, `.checklist div`) qui mettaient des
    descriptions en capitales et espagnolaient un paragraphe, et deux boutons de carte non alignés.

## 11. Ce que le second lot a tranché (25/10/2026) — sept écrans au total

**Persona figée pour tous les écrans : Léa, 18 ans, rhéto, Fédération Wallonie-Bruxelles.** Ce n'est pas
un détail : à 17 ans l'entraide serait fermée (voir § 3 bis) et le calendrier ne serait pas le même. La
variante 16–17 ans reste montrée **en pointillés** dans l'inscription, avec la phrase qui dit qu'elle ne
s'affiche pas sur l'écran de Léa.

14. **L'agenda est une grille de 12 lignes horaires × 7 jours, avec quatre états seulement** : libre
    (posée par l'étudiant, bleu plein), **ouverte par les vacances** (bleu pâle), réservée (orange),
    indisponible (hachures). Une heure n'a pas d'autre sens que ces quatre-là.
15. **Les vacances affichées sont les vraies** : Toussaint FWB **du 19 octobre au 1ᵉʳ novembre 2026**,
    relevées dans `app3/veille/table-vacances.csv`. La bannière dit que les heures de cours s'ouvrent
    seules et se referment le 2 novembre.
16. **La comparaison Flandre est affichée à côté** — « un étudiant de Flandre est encore en cours cette
    semaine (Toussaint du 2 au 8 novembre) ». C'est la démonstration la plus courte de la règle : **c'est la
    communauté qui décide, pas la langue.**
17. **Le dimanche est une case hachurée, et la note dit pourquoi** : impossibilité légale pour un compte de
    16–17 ans, choix respecté à 18 ans. On ne fait pas semblant que la règle n'existe pas sous prétexte que
    le persona est majeur.
18. **La personne aidée ne voit pas l'agenda : elle voit trois créneaux.** Carte séparée, trois lignes
    (jour, heure, prix) et la phrase « elle ne voit ni tes cours, ni tes heures occupées, ni le reste de ta
    semaine ». L'asymétrie est la fonctionnalité.
19. **La demande ne laisse pas fixer le prix** : cinq tuiles fermées, puis trois créneaux avec le prix de
    l'étudiant et la mention « prix fixé par Léa ». La phrase du haut le dit avant le formulaire, pas après.
20. **L'expiration est celle de la machine à états** : « la demande expire **deux heures avant le créneau**
    si personne n'a répondu » — pas « deux heures pour répondre ». Erreur corrigée en relecture.
21. **L'adresse exacte n'apparaît nulle part avant l'acceptation** : le champ « Où ? » ne contient que la
    commune, et la note dit qu'elle est révélée après acceptation puis effacée 30 jours après.
22. **La mission tient sur deux écrans côte à côte** : côté étudiant (en route → arrivée → saisir le code →
    durée → pause de 30 min au-delà de 4 h 30 → terminer) et côté personne aidée (le code à donner, puis
    **une seule question** « la mission a-t-elle eu lieu ? » avec Oui / Non). Aucune position pendant la
    mission ; le code prouve la présence, pas le trajet.
23. **Le carnet ne dit jamais « validé »** : trois étiquettes, et la troisième est une honnêteté, pas une
    validation de plus — « confirmé » (la personne aidée a dit que la mission a eu lieu), « déclaré par
    toi » (la durée, que personne ne certifie) et « annulée » (la mission n'a pas eu lieu : elle compte
    pour zéro heure). La version 1 de cette ligne disait « deux étiquettes seulement » alors que la
    maquette en affiche trois — c'est la spec qui était fausse, pas l'écran. Le carnet est supprimable et
    **personne d'autre ne le lit** — ni la personne aidée, ni un employeur.
24. **Aucune attestation n'est émise** : l'écran renvoie vers **Student@work** pour toute preuve
    officielle, et le dit dans un encadré, pas en petits caractères.
25. **Deux erreurs de fond trouvées par la relecture du rendu** (elles ne venaient pas du CSS) : le carnet
    annonçait « 6 missions · 11 h déclarées » pour 5 missions et 10 h, et la demande promettait un délai de
    réponse au lieu de l'expiration réelle. Un chiffre faux dans un carnet d'heures est exactement le genre
    d'erreur qui détruit la confiance : il est corrigé, et la règle « un total affiché se recalcule depuis
    les lignes » est retenue pour le code.

## 12. Audit du 25/10/2026 — 90 contrôles, 6 défauts réels corrigés

Outil : `maquettes/audit-job-etudiant.py`, exécutable, rejouable. Il vérifie **le texte rendu**
(`innerText`), pas le HTML source — c'est ce qui a permis de voir une erreur qu'un `grep` laissait passer.

**Ce qui est contrôlé** : la table des codes postaux (1 146 entrées, 1 125 libellés, 3 régions), le
calendrier scolaire contre `app3/veille/table-vacances.csv`, les dix dates affichées contre le calendrier
réel, la grille de la semaine lue dans le DOM (84 cellules, 7 par ligne, dimanche entièrement bloqué,
15 h libres, 6 h réservées, 19 h ouvertes par les vacances), les trois créneaux montrés à la personne
aidée (réellement `libre` dans la grille), le recalcul du carnet depuis ses lignes, la tolérance des
phrases interdites (une phrase n'est acceptée que si le texte la **refuse** autour), l'équilibre des
balises HTML, et les contrastes WCAG AA sur les jetons de couleur réellement déclarés.

**Les six défauts réels trouvés et corrigés :**

1. **« 1 146 communes »** sur l'écran du parcours : faux deux fois. La Belgique compte **581 communes**, et
   la table GeoNames contient 1 146 **codes postaux** dont les libellés (1 125) ne sont pas des communes
   légales — « 1020 Laeken » est un district de Bruxelles, pas une commune. Corrigé en « 1 146 codes
   postaux ».
2. **La règle de pause était incomplète** : l'écran mission ne citait que « 30 minutes au-delà de 4 h 30 ».
   La contrainte belge vérifiée en contient deux : **30 min au-delà de 4 h 30, 1 h au-delà de 6 h**.
3. **Les faits affichés sur Léa contredisaient son carnet** : « 6 missions terminées, 5 confirmées » alors
   que le carnet en montre 5 et 4 confirmées. Corrigé à la source du carnet, pas à l'œil.
4. **Le modèle de données ne portait pas deux champs montrés à l'écran** : `prix_heure` et `sait_faire[]`
   manquaient dans `profils_etudiant`. Ajoutés, avec la règle qui va avec : `missions.prix_fixe` est une
   **copie** du prix du profil au moment de la réservation, sinon changer son prix réécrirait le passé.
5. **Contraste des textes discrets : 3,06:1**, sous le seuil AA de 4,5:1, sur des textes de 10 px qui
   portent des informations réelles (« jamais affichée », « sert à calculer ton âge »). Jeton `--muted`
   passé de `#8496A3` à **`#5E7180`** → **5,06:1** sur blanc, 4,71:1 sur fond gris. La hiérarchie tient :
   `#13222E` (14,6:1) › `#4A5C6B` (6,9:1) › `#5E7180` (5,1:1).
6. **Six faux positifs de mon propre script**, corrigés aussi : il lisait le HTML source (les titres en
   `text-transform:uppercase` n'étaient pas reconnus), il testait « 4 h par semaine » au lieu de 8, il
   cherchait les faits de Léa sur le mauvais écran, et il traitait une phrase interdite **citée pour être
   refusée** comme une infraction. Un audit qui crie au loup use la confiance autant qu'un audit muet.

**Résultat après corrections : 90 contrôles réussis, 0 échec.** Balises HTML équilibrées, aucune erreur
JavaScript, aucun débordement, aucun texte coupé.

**Point laissé ouvert, et il dépasse cette porte** : le jeton `--muted: #8496A3` était encore présent dans
**15 autres fichiers de maquettes** (accueil, annonce, immo, événement, rencontre, mobile, partage,
tableau de bord). Le défaut de contraste y était identique. ✅ **Tranché le 25/10/2026 : « On aligne. »**
Les quinze fichiers sont passés à `#5E7180` (23 remplacements, le jeton et sept usages littéraux dans
`evenement.html`, deux dans `rencontre-mobile.html`), et **toutes les captures ont été régénérées** :
13 scripts de capture existants + `recapture-pleines-pages.py` pour les six vues pleine page qui n'en
avaient pas (accueil, tableau de bord, mobile, annonce, immo, partage). Contrôle des seize fichiers
après coup : **0 erreur JavaScript, 0 débordement, un seul gris**. Les tailles des captures inchangées là
où le HTML n'a pas bougé — preuve que la chaîne de capture reproduit à l'identique.

**Deux observations relevées pendant cette passe, non corrigées parce qu'elles sortent de la porte** :
`immo-agence.png` et `immo-colonne.png` sont désormais **identiques** — `capture-agence.py` photographie
le dernier bloc `.side`, exactement comme `capture-peb.py` ; le doublon existait déjà, il était masqué par
deux versions successives de `immo.html`. Et `partage-1440.png` mesurait 1 240 px pour un document de
1 119 px : l'ancienne capture avait une centaine de pixels de blanc en bas. Les deux captures sont
maintenant justes, mais le nom `immo-agence` ne désigne pas ce qu'il prétend.

## 13. Troisième lot — les annonces d'entreprise (11 écrans au total)

Cadre : `app3/note-legale-belgique.md` **§ 7 quater** (Unia sur l'âge, modération humaine, activités
interdites aux mineurs) et `MODELE-DONNEES-JOB-ETUDIANT.md` § 4.4. Quatre écrans : la liste, la fiche,
le dépôt, « mes offres ».

26. **Aucun âge dans le texte d'une offre, et la protection passe par ailleurs.** L'âge est un critère
    protégé, y compris dans une offre d'emploi (Unia, cité dans la note légale). Donc l'offre ne dit
    jamais « 16–25 ans » ni « jeune » : **une tuile ou un interrupteur** décide, et l'écran affiche un
    badge **« 18 ans et plus »** pour les activités que la loi interdit aux mineurs — nuit, débit de
    boissons, industrie, conduite d'engins. Le badge explique **pourquoi** : « le travail de nuit est
    interdit aux mineurs, pas déconseillé ».
27. **Les cinq mentions obligatoires sont affichées comme une liste vérifiable**, pas noyées dans le
    texte : employeur identifié, lieu, durée, statut, rémunération + commission paritaire. Elles
    viennent de la note légale (§ 7 quater), pas d'une intuition.
    ⚠️ **Le « statut » était affiché sans exister dans les données** : aucune colonne ne le portait
    (relecture du 25/10/2026). Il est ajouté (`annonces.statut`), et avec une règle que la note légale
    impose : **« bénévolat » n'est proposé qu'à une ASBL**. Le bénévolat est défini pour le secteur non
    marchand (loi du 3 juillet 2005) ; une société commerciale qui « emploie » un bénévole fait du
    travail dissimulé. Une entreprise ne voit donc que « contrat d'occupation d'étudiant ». Le texte
    figé `entreprise.trois.types` (v1.1) annonçait deux statuts sans cette distinction — il est corrigé.
28. **Aucun barème n'est affiché, et on le dit.** La commission paritaire est « déclarée par
    l'employeur » ; Kazendra ne la vérifie pas et n'affiche aucun montant minimal — « un chiffre inventé
    serait pire qu'aucun ». La vérification du numéro BCE est datée (« vérifié à la main le 12/10/2026 »),
    jamais « certifié ».
29. **Le refus d'être placeur est écrit jusque dans l'écran de l'entreprise** : ni liste de candidats, ni
    CV, ni tri des profils. « Vous recevez des messages, pas des dossiers. »
30. **Le dépôt ne redemande pas les mentions du contrat d'occupation d'étudiant** (décision 40) : elles
    sont affichées comme déjà enregistrées, avec leur date de vérification. Deux interrupteurs de
    protection (nuit / activité interdite) décident de la visibilité aux 16–17 ans ; **les heures de
    cours ne sont pas un interrupteur** mais une ligne verrouillée « toujours », parce qu'un employeur ne
    peut pas choisir de faire travailler un mineur pendant ses cours.
31. **Un refus porte un motif écrit et une seule action** : corriger. Les refus automatiques forment une
    liste fermée (âge, sexe, origine, religion) ; tout le reste est humain, sous 24 h.
32. **Cinq états, une action par ligne** : publiée, en attente, refusée, expirée, brouillon. L'expiration
    se voit venir (date limite affichée), la republication est un geste, et le motif de refus est
    conservé — c'est ce qui permet de contester, et de voir qu'on n'a pas été refusé deux fois pour la
    même raison.
33. **Typographie française : 165 espaces insécables** posées devant `: ; ! ?` et autour des guillemets,
    dans le texte seulement (jamais dans les balises). Motif : une ligne commençait par « : nous ne
    demandons jamais… », ce qui est une faute de composition, pas un détail de goût.
34. **Audit étendu : 115 contrôles, 0 échec.** Trois défauts trouvés et corrigés pendant la passe :
    le décompte annonçait « 2 publiées » pour **une** seule offre publiée ; `.entrow b` (sélecteur trop
    large) remettait « vérifié à la main le 12/10/2026 » en petites capitales ; et `.arow .t span`
    étirait le badge « 18 ans et plus » sur toute la largeur de la ligne. Un quatrième défaut venait de
    l'audit lui-même : `innerText` conserve les retours à la ligne, donc une phrase coupée par un retour
    ne se retrouvait pas d'un bloc — les comparaisons sont désormais faites sur un texte aplati.

**Point ouvert, à traiter avant facturation** : les numéros de commission paritaire affichés (118, 302,
329, 336) sont ceux déclarés par l'employeur et **n'ont pas été revérifiés à la source**. Tant que la
publication est gratuite, c'est un affichage ; le jour où une offre est facturée, la CP doit être
contrôlée, sinon on vend une mention fausse.

## 14. Planche mobile 390 px (25/10/2026)

Quatre vues : l'entrée, l'agenda, la mission, une offre. `job-etudiant-mobile.html`, capture
`job-etudiant-mobile-390.png` (1720 × 1000, densité 2), script `capture-mobile-job-etudiant.py`.

35. **La grille de la semaine ne survit pas à 390 px — et on ne la comprime pas.** Douze lignes × sept
    colonnes à 390 px donnent des cellules de 44 px de large : illisibles et intapables. Le mobile passe
    donc à une **vue journée** : une bande de sept jours en haut (le jour choisi en plein), puis une ligne
    par heure avec **les mêmes quatre états** que le bureau. C'est le seul écran où l'information change de
    forme au lieu de se replier — et c'est volontaire.
36. **Cibles tactiles mesurées, pas supposées** : minimum **45 px** sur l'entrée, **44 px** sur les trois
    autres vues. Deux corrections ont été nécessaires après mesure : les boutons de carte étaient à 41 px
    et les trois boutons de statut à 32 px. Un état qu'on ne peut pas taper du pouce n'existe pas.
37. **Barre d'action collante sur les trois écrans qui ont une action** (poser une heure, valider le code,
    écrire à l'entreprise) — et aucune sur l'entrée, où les deux boutons sont déjà dans les cartes. Une
    barre collante qui double un bouton visible est un piège à double appui.
38. **La vue mission dit ce qui se passe après**, dans une seconde carte : la confirmation sans durée par
    la personne aidée, le carnet (« confirmé » / « déclaré par toi », jamais « validé »), et l'absence
    d'attestation. Sans elle, l'écran laissait un demi-écran vide sous le code.
39. **Un défaut de sélecteur, encore** : `.mentm div` s'appliquait aussi aux divs imbriquées et poussait la
    fin de la phrase « Aucun barème affiché » à droite de la ligne. Corrigé en `.mentm > div` + une règle
    explicite pour l'enfant. C'est la quatrième fois sur cette porte qu'un sélecteur trop large casse une
    composition (`.ul li b`, `.checklist div`, `.entrow b`, `.mentm div`) : la règle « enfant direct »
    devient la règle par défaut de ces maquettes.
40. **Contrôle final** : 0 contenu coupé sur les quatre vues (`scrollHeight` = `clientHeight`), 0
    débordement horizontal, 0 erreur JavaScript, aucun bouton de partage.

## 14 bis. L'image de marque de l'entreprise (décision 37, 25/10/2026)

- Une entreprise qui publie une annonce peut afficher **son logo, ou à défaut une photo de son
  entreprise** — un seul emplacement, deux provenances. L'image suit le **compte**, pas l'annonce : elle
  sert aussi sur `/artisan`, `/immo`, `/emploi` et `/evenement`.
- **Jamais obligatoire**, comme les photos de mission : une annonce sans image s'affiche entière, sans
  cadre vide, sans mention « sans photo », et **sans monogramme inventé**.
- **Le particulier n'a pas d'image de marque** : son bloc affiche un pseudo et « téléphone vérifié ».
  C'est ce qui distingue visiblement une entreprise d'un particulier — distinction sur laquelle repose
  toute la porte, puisqu'une entreprise qui se déclarerait « particulier » commettrait un emploi déguisé.
- **SVG refusé**, métadonnées effacées, remplacement soumis à relecture. Une image n'est pas une preuve
  d'existence de l'entreprise : le numéro BCE reste le seul contrôle, et il est fait à la main.

## 15. Relecture experte du 25/10/2026 — 21 constats, 6 de gravité haute

Demande de l'utilisateur : « *revérifie en tant qu'expert toute la partie job étudiant, ce qui ne
correspond pas, ce qui n'a pas de logique ou de cohérence, et adapte si nécessaire.* » Le registre
complet, avec la gravité et la preuve de chaque constat, est dans **`AUDIT-EXPERT-JOB-ETUDIANT.md`**.
Ce paragraphe retient ce qui change la lecture de la porte.

**Les six constats de gravité haute.** Ils avaient tous la même forme : **un chiffre ou un champ
affiché à l'écran qui n'avait aucune source dans les données**.

41. **Le compteur de 650 h n'avait aucune source.** La jauge « 128 h sur 650 h » s'affichait sur trois
    écrans, alimentée par la table `missions` — qui ne contient **que des missions d'entraide**. La porte
    ne reçoit aucune candidature, aucun contrat, aucune heure d'emploi : elle ne peut donc pas compter
    les 650 h. Le compteur devient **déclaratif** (`heures_declarees`, un mois à la fois) et son libellé
    le dit : « déclaré par toi — la référence officielle reste Student@work ». C'est la même honnêteté
    que le carnet, appliquée à la même personne.
42. **Le compteur de 8 h ne comptait pas les missions acceptées.** Il sommait les missions **terminées** :
    cinq missions de 8 h acceptées dans la même semaine passaient toutes, aucune n'étant encore terminée
    au moment de l'acceptation. Il compte désormais les missions **engagées** de la semaine visée, et
    **la plus grande des deux durées** (prévue, déclarée) — sous-déclarer ne libère plus de quota.
43. **La communauté scolaire n'existait pas dans le modèle.** Le calendrier, les vacances et les heures
    de cours bloquées en dépendent entièrement ; le modèle n'avait que `langue`. Or **utiliser la langue
    comme communauté est exactement le piège que la décision 24 interdit** : un étudiant néerlandophone
    scolarisé en FWB doit avoir `langue = nl` et `communaute = fwb`. Champ ajouté, et il n'est pas déduit
    du code postal (Bruxelles est en FWB, la frontière linguistique ne suit pas les provinces).
44. **L'établissement était demandé à l'écran et stocké nulle part.** Le modèle disait même « jamais le
    nom de l'école » : la vérification manuelle de l'attestation était donc impossible. Champ ajouté,
    privé, **effacé dès l'attestation vérifiée** — un nom d'école plus une date de naissance plus un
    prénom, c'est un mineur identifié.
45. **La distance « arrondie à 300 m » était une précision inventée.** La porte refuse de collecter la
    position (liste ferme du § 10) ; elle ne peut donc pas mesurer 300 m — et **trois endroits
    l'écrivaient noir sur blanc** (« la position sert à calculer une distance arrondie à 300 m »,
    « la distance se calcule depuis la commune, arrondie à 300 m », « distance calculée depuis ton code
    postal, arrondie à 300 m »). Les chiffres affichés (« 1 km », « 2 km », « 3 km ») étaient de même
    nature : présentés comme mesurés, calculés entre deux centroïdes de commune. La distance est
    désormais dite **estimée entre communes**, et une règle est posée pour le cas qui n'existait pas
    encore dans les maquettes : la même commune s'écrit « **même commune** », jamais « 0 km ».
46. **La rétention de 12 mois détruisait le compteur de 12 mois.** Les missions étaient effacées au bout
    de 12 mois et l'ancienneté chez l'employeur se calculait depuis les missions : au 13ᵉ mois, la
    première mission disparaissait et **le compteur repartait de zéro**. La protection s'auto-annulait.
    Les heures déclarées sont gardées **24 mois**.

**Quatre constats de gravité moyenne, corrigés aussi :**

47. **Aucune table de messages** alors que le hub impose la messagerie comme seul canal, qu'un écran dit
    « vous recevez des messages, pas des dossiers » et que `signalements` prévoit une cible `message`.
    Ajoutée — et **sans champ pièce jointe**, parce qu'« un message, pas un dossier » se tient par un
    schéma, pas par un règlement.
48. **Le signalement n'existait que sur l'écran de la mission** — « Signaler un problème », bureau et
    mobile. Ni une **annonce**, ni un **profil** ne pouvaient être signalés, alors que
    `signalements.cible_type` prévoit `annonce` et `profil`, et que le règlement européen sur les
    services numériques impose un mécanisme de signalement sur un contenu **public**. Ajouté sur la
    fiche d'une offre : « Quelque chose ne va pas dans cette offre ? Signaler — c'est l'exploitant qui
    lit, jamais l'employeur. » *(Premier jet de ce constat : j'avais écrit « aucun écran de
    signalement » — faux, la mission en avait un. Corrigé après vérification, pas après relecture.)*
49. **Un créneau n'était jamais libéré.** Refus, annulation, expiration : l'heure restait réservée et
    disparaissait de la semaine pour toujours. Trois transitions ajoutées, dans la même transaction.
50. **Une mission pouvait traverser minuit.** Les règles de nuit (22:00–06:00) et de dimanche portaient sur
    l'heure de **début** : une mission de 4 h commencée à 20:00 finissait à minuit sans qu'aucun contrôle
    ne s'en aperçoive. Le contrôle porte désormais sur **l'intervalle entier**.

**Deux constats de gravité basse, et une décision de produit :**

51. **`creneau_id` unique ne représentait pas une mission de 90 minutes** → `debut` / `fin` /
    `pause_min` / `duree_travail_min`. Conséquence écrite : une mission de 8 h de travail avec sa pause
    d'une heure **occupe 9 h de la journée** — les compteurs comptent le travail, l'agenda compte la
    présence.
52. **Le code à 4 chiffres était haché sans limite d'essais** (10 000 possibilités) → 3 essais, valable
    le jour du créneau seulement.
53. **La liste des services n'était pas celle de la source — dans les deux sens.** Deux services
    **sortent** : « promener le chien », dont la note légale dit noir sur blanc que la qualification
    (manuelle ou non) **n'est pas tranchée par un texte lu**, et — même défaut — « soutien scolaire » et
    « informatique », qui figuraient dans les tuiles de compétences sans qu'aucun texte ne les cite.
    Proposer un service dont le régime n'est pas tranché, c'est vendre une case grise. Un service
    **entre** : « **accompagnement** » (accompagner une personne moins mobile), qui est cité mot pour mot
    par l'exemption ONSS et qui **manquait** — c'est le service le plus évidemment couvert, et il n'était
    pas proposé. La liste fermée devient : **courses · pharmacie · compagnie · accompagnement · autre**.
    Elle tient en cinq tuiles, donc aucune composition ne bouge. La remettre dans l'état d'avant est une
    ligne par service.
    ✅ **TRANCHÉ le 25/10/2026 — l'utilisateur : « *On garde cette liste.* »** La liste fermée est
    **courses · pharmacie · compagnie · accompagnement · autre**, et rien d'autre. `sait_faire[]` ne
    peut contenir que ces cinq valeurs ; un besoin hors liste passe par « Autre » et un contrôle à la
    main. Maquette, captures et audit alignés sur cette liste.

54. **Une jauge qui protège sans le dire ne protège pas.** Le compteur de 8 h ne voit que les missions de
    Kazendra : un étudiant qui fait 6 h ailleurs peut dépasser le plafond légal sans que la jauge bouge.
    Un champ « heures faites ailleurs cette semaine » est prévu dans le modèle, et l'écran dit ce que la
    jauge voit — exactement comme le 650 h est déclaratif.

**Ce que cette relecture n'a pas trouvé**, et il faut le dire aussi : les six contraintes légales belges
sont conformes à la source (8 h/semaine, pause 30 min puis 1 h, liste noire, 22:00–06:00 pour les plus de
16 ans, 650 h, 12 mois), les cinq mentions obligatoires d'une annonce sont exactement celles de la note
légale, aucune interdiction d'âge n'apparaît dans le texte d'une offre, et **aucune donnée interdite n'est
stockée** — la liste ferme du § 7 est vérifiée table par table. Les 119 contrôles automatiques passent
toujours, et les 56 textes figés sortent à **0 faute**.

## 16. Ce qui est CODÉ, et ce qui ne l'est pas (27/10/2026)

Cette section existe pour qu'aucune session future ne confonde les deux. **L'univers JOBS est branché et
exercé ; l'univers ENTRAIDE ne l'est pas, et l'écran d'entrée le dit.**

### 16.1 L'univers jobs — branché sur le socle, exercé aux trois étages

| Ce qui tourne | Où |
|---|---|
| la table `annonces_etudiant` (aucune colonne pour un nom, un CV, une candidature, un IBAN, un âge, une position) | `socle/schema.sql` |
| les règles : frontière, cinq mentions, badge 18+, bénévolat ASBL, quota 3, pré-modération, masquage à 3 signalements | `socle/job-etudiant.mjs` |
| l'extension de compte : `forme`, 4 mentions du contrat, `commission` paritaire | `socle/portes.mjs`, `socle/profils.mjs` |
| 5 écrans : entrée deux univers, liste, fiche, dépôt, mes annonces | `public/job-etudiant.html`, `job-offres.html`, `job-offre.html`, `depot-job-etudiant.html`, `job-mes-offres.html` |
| la file de relecture, comptée dans les totaux **et** dans l'attente la plus longue | `socle/moderation.mjs`, `public/moderation.html` |
| 3 migrations idempotentes, exercées sur une base d'hier | `socle/db.mjs`, `tests/job-etudiant.test.mjs` |

**Une correction d'écran, et un héritage qui a payé** : le filtre d'âge s'écrivait « Ouverts aux 16-17
ans » — une fourchette d'âge dans une page qui explique justement qu'on n'en écrit pas ; il dit
maintenant « Ouverts dès 16 ans ». Et les chips de filtre n'ont **pas** eu à être corrigées ici : la
règle `.chips-filtre .chip{margin:0}` posée pour `/emploi` vit dans la feuille partagée, et cette porte
en a bénéficié sans rien faire. C'est le seul avantage d'un composant commun, et il vaut d'être noté.

### 16.2 Trois déviations assumées, écrites ici plutôt que découvertes plus tard

1. **Pas d'état `brouillon`**, alors que le § 13.32 en liste cinq. Un brouillon est un enregistrement
   incomplet ; sans route pour le reprendre et le corriger, il serait un **bouton mort** — exactement ce
   que la porte interdit. Les cinq états sont donc `en_attente`, `publiee`, `refusee`, `expiree`,
   `retiree`, plus `masquee` (trois signalements), ce qui fait six. Le jour où un écran de reprise
   existera, `brouillon` reviendra.
2. **Trente jours de visibilité**, comme `/emploi`, et non une durée propre : une annonce de job étudiant
   est saisonnière, et le renouvellement est libre et gratuit. Écrit ici pour être changé d'un réglage
   (`DUREE_JOURS`) le jour où une durée différente est décidée.
3. **Le contact est la messagerie du hub**, alors que la version 1 de la porte promettait des messages
   sans modéliser un seul message. La table `fils` accepte désormais la cible `annonce_etudiant`, et la
   migration de cette table est la plus délicate du projet : `messages` la référence, donc un `RENAME`
   moderne réécrirait la clé étrangère vers la table de sauvegarde. `legacy_alter_table = ON`, et
   l'épreuve fabrique une base d'hier avec un fil et un message pour vérifier qu'on les retrouve.

### 16.3 L'univers entraide — CODÉ le 28/10/2026, ouvert aux 18 ans et plus

Le second univers est branché : `profils_etudiant`, `statuts`, `creneaux`, `sollicitations`, `missions`
(machine à 9 états, code PIN haché, pause calculée, libération du créneau), `mission_etapes` (journal
append-only), `confirmations` (avec préséance), `carnet` (trois natures), `personnes_de_confiance`,
`adresses` (digicode effacé à la clôture) et le référentiel `jours_feries` — **onze tables**. Quatre
écrans : `/job-etudiant/entraide`, `/job-etudiant/agenda`, `/job-etudiant/mission/<id>`,
`/job-etudiant/carnet`.

**La décision qui gouverne ce lot : l'entraide s'ouvre à 18 ANS, pas à 16.** Ce n'est pas un recul sur
la décision « les jobs étudiants dès 16 ans » : c'est la même décision, appliquée là où le droit est
certain. Côté jobs, l'employeur porte la déclaration (DIMONA, DmfA, assurance). Côté entraide, personne
ne la porte, et la condition d'âge de l'exemption ONSS des activités occasionnelles non manuelles **n'a
pas été lue à la source**. `AGE_ENTRAIDE = 18` ferme donc la porte, et la raison affichée renvoie
explicitement aux jobs ouverts dès 16 ans. Les sept règles des mineurs (nuit, dimanche, jours fériés,
heures de cours, accord parental, liste noire, compteurs) sont **écrites et éprouvées mais dormantes** :
elles se réveilleront en changeant une constante, pas en réinventant un module.

**Ce que l'entraide ne fait PAS encore, nommément** : les 16–17 ans (`tuteurs`, `autorisations_journee`
de six mois, `calendriers_scolaires` et `vacances` par communauté, à relever depuis `app3/veille/`),
l'évaluation par faits (`avis_faits`), les 650 h déclaratives (`heures_declarees`, qui appartiennent à
l'univers jobs), et **le bouton de la file pour vérifier un profil** : la décision existe en API
(`POST /api/moderation/profils-entraide/<id>`), pas encore à l'écran `/moderation`.

**Éprouvé, avec les chiffres** : `tests/entraide.test.mjs` 53 / 0 · section ㉓ de
`tests/epreuve-http.sh`, 35 contrôles, dont « une demande de ménage est refusée » et « aucune arobase ni
téléphone dans la liste publique » · `outils/audit-entraide.py` 97 contrôles / 0 échec à 1440 et 390 px
sur `outils/graine-entraide.mjs`. Détail des décisions : `SPEC-SOCLE.md` § 11 ter (164 à 172).



