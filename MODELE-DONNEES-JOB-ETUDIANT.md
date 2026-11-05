# Modèle de données — porte `/job-etudiant` (projet n°3 « Entraide »)

**Version 2 — 25/10/2026.** Remplace la version 1 après la **relecture experte** demandée par
l'utilisateur (« revérifie en tant qu'expert toute la partie job étudiant »). Le registre des
constats et de ce qui a changé est dans `AUDIT-EXPERT-JOB-ETUDIANT.md` ; ce fichier est le modèle
tel qu'il doit être codé.

Ce qui change entre la version 1 et la version 2, en une ligne chacun : **26 tables au lieu de 23**
(`messages`, `sollicitations`, `heures_declarees`), une **communauté scolaire** qui existait à
l'écran et pas dans le modèle, un **compteur 650 h qui n'avait aucune source de données**, un
**compteur 8 h qui ne comptait pas les missions acceptées**, une **distance de 300 m impossible**
sans position, et une **rétention de 12 mois qui détruisait le compteur de 12 mois**.

---

## 1. Décision de stockage (25/10/2026)

**Option B retenue par l'utilisateur** : application **locale sur sa machine**, comme les autres portes
du hub, **avec une exportation quotidienne vers un tableur** qu'il consulte. Pas de Google Sheets comme
base vivante, pas d'Apps Script, pas de clé.

- **Service** : `projects/job-etudiant`, `node server.js`, **port 4204**, `reach: path`, déclaré dans
  `registry/services.json` comme `sape` et `promos`. Zéro dépendance npm.
- **Données** : **un fichier JSON par table**, **écriture atomique** (fichier temporaire puis `rename`),
  verrou en mémoire par table.
- **Limite assumée** : JSON convient à un pilote de quartier. **Au-delà de ~50 000 lignes sur une
  table, ou dès plusieurs écritures concurrentes**, on migre vers SQLite — la structure est déjà
  relationnelle, la migration est mécanique.
- **Export tableur** : chaque nuit à 03:00, **un CSV par table** (UTF-8 BOM, `;`), zippé et daté dans
  `exports/`. Bouton « Exporter maintenant ». Historique **30 jours**.
  ⚠️ **`adresses` est exclue de l'export par défaut** et `code_acces` n'y figure jamais : un zip qui
  dort 30 jours avec des digicodes est exactement ce qu'on refuse de créer (§ 8, constat 15).
- **Messages** : la messagerie est un **composant du hub**, pas de cette porte (voir § 9).

## 2. Trois choses que la transcription du projet 3 vers le hub a fait apparaître

1. **L'IBAN de la fiche étudiant disparaît** — la décision 39 dit « aucune donnée bancaire stockée ».
2. **Aucun casier judiciaire n'est stocké** — donnée pénale, art. 10 RGPD. Déclaration sur l'honneur,
   et c'est l'employeur qui demande l'extrait quand son secteur l'exige.
3. **L'attestation d'étude est vérifiée, pas archivée** — on garde la date et l'auteur, pas le fichier.

**Bonus de la même famille** : l'adresse exacte du demandeur vit dans `adresses`, n'est révélée qu'après
acceptation, et est effacée **30 jours après la fin de la dernière mission**.

## 3. Principes qui gouvernent toutes les tables

- Rien de ce qui n'est pas nécessaire n'est collecté ; ce qui est collecté ne se voit qu'au moment où
  il sert.
- **Aucune donnée bancaire**, **aucune pièce d'identité**, **aucun casier**, **aucune position**.
  ⚠️ **Aucune position, du tout** : la version 1 promettait une distance « arrondie à 300 m » alors
  qu'elle refusait de collecter la position. La distance se calcule **entre communes**, depuis le code
  postal (§ 4.2 bis), et l'écran le dit.
- **Un mineur ne laisse rien derrière lui** : âge < 16, accord parental refusé, parcours abandonné →
  fiche **effacée**, pas mise de côté.
- **Chaque écriture est attribuée** : qui, quand, quoi (`journaux`, append-only).
- **Le mot « validé » n'est jamais associé à des heures** : « confirmé » (la personne aidée a dit que
  la mission a eu lieu) et « déclaré par toi » (la durée).
- **Un état dérivé ne se stocke pas.** `bloque_cours` et « ouvert par les vacances » se calculent depuis
  les référentiels scolaires ; seuls `libre`, `reserve` et `indisponible` sont écrits.

## 4. Les tables — 26

### 4.1 Identité et profils

**`comptes`** — socle partagé avec les autres portes du hub.
`id` · `hub_id` · `email` + `email_verifie_le` · `tel` (unique, **facultatif pour un mineur** — voir
§ 4.1 bis) + `tel_verifie_le` · `mot_de_passe` (haché) · `naissance` (privée, sert à calculer l'âge) ·
`type` (`particulier` · `entreprise` · `asbl`) · `langue` (`fr` · `nl` · `de`) · `commune_cp` ·
`cree_le` · `dernier_acces` · `etat` (`actif` · `en_attente` · `suspendu` · `supprime`).

**`profils_etudiant`** — `compte_id` · `univers` (`entraide` · `jobs` · `les_deux`) ·
**`communaute`** (`fwb` · `flandre` · `ostbelgien`) · **`etablissement`** (privé, voir § 4.1 bis) ·
**`annee_etudes`** (« 6ᵉ secondaire » — seule l'année est publique) · `photo` (0 ou 1, facultative) ·
`langues[]` · `sait_faire[]` (**liste fermée, cinq valeurs** : courses · pharmacie · compagnie ·
accompagnement · autre — décision du 25/10/2026) · `prix_heure` (entier en euros, **fixé par l'étudiant**,
modifiable) · `presentation` (300–1 200 car.) · `attestation_verifiee_le` · `verifie_par` ·
`etat` (`en_attente` · `verifie` · `refuse`) · `motif_refus` · `declaration_honneur_le`.

> **`communaute` est ajoutée le 25/10/2026 et c'était une erreur de ne pas l'avoir.** C'est elle qui
> choisit le calendrier scolaire, donc les vacances et les heures de cours bloquées. Sans elle, le
> modèle n'a que `langue` — et **utiliser la langue comme communauté est précisément le piège que la
> décision 24 interdit** (« la langue est un confort, la communauté scolaire ne change jamais avec la
> langue »). Un étudiant néerlandophone scolarisé en FWB doit avoir `langue = nl` et
> `communaute = fwb`.

### 4.1 bis Deux champs privés, et pourquoi ils ne se conservent pas

**`communaute` n'est pas déduite du code postal.** Bruxelles est dans la FWB, la frontière linguistique
ne suit pas les provinces, et les communes à facilités existent. C'est une **déclaration de l'étudiant,
vérifiée sur l'attestation**, pas un calcul.

**`etablissement`** (le nom de l'école) : l'écran d'inscription le demande — « sert à vérifier ton
attestation à la main, le nom de l'école n'est jamais publié ». La version 1 du modèle ne le stockait
pas (`etudes` disait même « jamais le nom de l'école ») : **un champ collecté à l'écran et absent du
modèle n'existe pas, et la vérification manuelle devient impossible**. Il est donc stocké, avec
`efface_le` : **effacé dès que l'attestation est vérifiée**, on ne garde que `attestation_verifiee_le`.
Raison : un nom d'école + une date de naissance + un prénom, c'est un mineur identifié. À la
re-vérification de l'année suivante, l'étudiant le ressaisit — c'est deux secondes contre un fichier
qui n'existe pas.

**`tuteurs`** — obligatoire pour 16–17 ans : `compte_mineur` · `nom` · `email` + `tel` (vérifiés) ·
`lien_parente` · `consentement_le` · `revocation_le`. Sans ligne active : compte **en attente**, rien
publié, rien reçu. **Le téléphone vérifié d'un mineur est celui du tuteur** : `comptes.tel` reste
facultatif pour un 16–17 ans, sinon un adolescent qui n'a pas de ligne à son nom ne peut pas s'inscrire
— et l'unicité du numéro empêcherait le parent d'avoir un compte.

**`profils_demandeur`** — `compte_id` · `type` (`senior` · `famille` · `voisin`) · `besoin_habituel` ·
`cree_le`. Pas d'adresse ici. `entreprise` et `asbl` ne sont pas des profils demandeur : ils vivent
dans `entreprises` quand le compte est de ce type.

**`adresses`** — `demandeur_id` · `rue` · `cp` · `commune` · `etage` · **`code_acces`** · `revelee_le` ·
`efface_le`. Effacement automatique **30 jours après la fin de la dernière mission** — sauf
`code_acces`, **effacé à la clôture de la mission** : un digicode n'a aucune raison de survivre à la
prestation qu'il servait.

**`entreprises`** — `compte_id` · `denomination` · `bce` · `verifie_bce_le` · `verifie_par` ·
`commission_paritaire` · `service_prevention` · `controle_lois_sociales` · `assurance` ·
`secretariat_social` · `etat` (`en_attente` · `verifie` · `refuse`) · `motif_refus`.

> Les six mentions stockées ici sont **les mentions employeur** du contrat d'occupation d'étudiant —
> celles qui se réutilisent d'une annonce à l'autre (décision 40). Les autres des 19 mentions légales
> (dates, fonction, horaire, rémunération) sont **propres à chaque contrat** : elles appartiennent à
> l'annonce, pas à la fiche entreprise. Confondre les deux ferait publier une annonce avec l'horaire
> de la précédente.

**`personnes_de_confiance`** — `compte_aide` · `compte_confiance` (**deux identifiants distincts**) ·
`lien` · `invite_le` · `accepte_le` · `actif`. Deux comptes, un lien : la valeur de la confirmation est
la **trace de qui a confirmé**.

### 4.2 Disponibilité

**`creneaux`** — `etudiant` · `date` · `heure` (0–23) · `etat` (`libre` · `reserve` · `indisponible`) ·
`mission_id`. **Trois états écrits, deux états calculés** : `bloque_cours` (emploi du temps + jours
fériés + dimanche pour un mineur) et `ouvert_par_vacances` (table `vacances`) sont **dérivés à la
lecture**. La version 1 les stockait — un état stocké qui dépend d'un référentiel annuel se périme
tout seul, et le 2 novembre l'agenda d'un étudiant resterait faux.

Les quatre états affichés à l'écran restent exactement ceux de la maquette : **libre** (posé par
l'étudiant) · **ouverte par les vacances** (dérivé) · **réservée** (écrit) · **indisponible**
(écrit). `bloque_cours` n'est pas une quatrième couleur : c'est l'absence de créneau, affichée en
hachures.

**`autorisations_journee`** — `etudiant` · `motif` (`trou_horaire` · `alternance`) · `preuve_type` ·
`debut` · `fin` (**6 mois**) · `rappel_envoye_le` · `revoquee_le`.

**`statuts`** — `etudiant` · `etat` (`disponible` · `occupe` · `ne_pas_deranger` · `hors_ligne`) ·
`depuis` · `jusqu_a`. **Le compteur de sollicitations sort d'ici** : il se calcule depuis
`sollicitations`, pas depuis un entier qu'on incrémente (voir § 4.2 bis).

**`sollicitations`** *(nouvelle)* — `etudiant` · `demandeur` · `besoin` · `proposee_le` ·
`etat` (`proposee` · `acceptee` · `ignoree` · `expiree`). **Trois par jour** pour un étudiant
`disponible` (décision 9). La version 1 rangeait ce compteur dans un champ `sollicitations_du_jour` :
un entier ne dit ni qui a sollicité, ni quand, ni pourquoi la quatrième est refusée — et il ne permet
pas de répondre à « qui m'a contacté hier ? ».

### 4.2 bis La distance, sans position

Ni l'étudiant ni le demandeur ne donnent de position. La seul donnée géographique est le **code
postal** (`comptes.commune_cp`, `adresses.cp`), et `donnees/codes-postaux/` porte le centroïde de
chaque commune.

- La distance est donc **entre deux communes**, calculée depuis les centroïdes, **arrondie au km**.
- **Jamais « 0 km »** : quand c'est la même commune, l'écran écrit « **même commune** ».
- Le rayon de recherche s'exprime en **« rayon estimé depuis le centre de ta commune »**, pas « depuis
  chez toi ».
- L'écran ne dit plus « arrondie à 300 m » : 300 m, c'est de la précision GPS, et on ne collecte pas
  de GPS. Une précision qu'on n'a pas est une promesse qu'on ne tiendra pas (constat 6).

### 4.3 Missions (univers entraide)

**`missions`** — `id` · `univers` (`entraide`) · `demandeur` · `etudiant` · `besoin` (tuile fermée) ·
**`debut`** · **`fin`** (horodatages, pas un numéro de créneau) · **`pause_min`** (calculée : 0, 30 ou
60) · **`duree_travail_min`** (**`fin` − `debut` − `pause`**) · `prix_fixe` (**copie** du prix du
profil au moment de la réservation) · `etat` · `code_pin` (haché) · `code_essais` · `cree_le`.

> **`debut`/`fin` remplacent `creneau_id`.** Une mission de 90 minutes n'existe pas dans une grille
> horaire : avec un seul identifiant de créneau, on ne savait ni la représenter ni empêcher le
> chevauchement de deux missions. La grille réserve **chaque heure touchée** et `pause_min` est
> calculée : 30 min au-delà de 4 h 30, **1 h au-delà de 6 h** (les deux, pas l'une ou l'autre).
>
> **Conséquence affichée, et elle est réelle** : une mission de 8 h de travail avec sa pause d'une
> heure occupe **9 h de la journée** de l'étudiant. Les compteurs comptent `duree_travail_min` ; la
> présence, elle, est plus longue.

**`mission_etapes`** — `mission` · `de` · `vers` · `acteur` · `horodatage` · `motif`. Journal de la
machine à états, jamais modifiable.

**Machine à états** :

```
demandee ──acceptee──> acceptee ──depart──> en_route ──arrivee──> en_cours
                                   └─(refus)─> refusee            └─code──> code_saisi
code_saisi ──cloture──> terminee                     └─(abandon)─> annulee
demandee|acceptee|en_route|en_cours ──(l'un des deux)──> annulee
demandee ──(sans réponse 2 h avant le créneau)──> expiree
```

**Transitions interdites, à refuser explicitement** (et à tester) : terminer une mission jamais
acceptée · saisir un code sans être `en_cours` · accepter un créneau déjà réservé · réserver un
créneau en dehors des heures autorisées · accepter une mission qui dépasse le compteur de 8 h ·
annuler une mission `terminee` · **revenir** depuis `terminee`, `annulee`, `refusee` ou `expiree`.

**Règle de libération, absente de la version 1** : `annulee`, `refusee` et `expiree` **remettent le
créneau à `libre`** dans la même transaction. Sans elle, un refus rendait une heure définitivement
invisible — un étudiant qui refuse trois demandes voyait sa semaine se vider.

**Le code PIN** : 4 chiffres, valable **le jour du créneau seulement**, **3 essais** puis verrouillage
et régénération par la personne aidée. Un code à 4 chiffres haché sans limite d'essais, c'est 10 000
possibilités et un hachage décoratif.

**Réconciliation avec le projet 3.** Le projet 3 compte **trois états** (demandée, acceptée, terminée) ;
le modèle en compte **neuf**. Ce n'est pas une contradiction, c'est un point de vue :

| Ce que voit la personne aidée (3) | États techniques, côté étudiant (3) | États terminaux (3) |
|---|---|---|
| `demandee` | `en_route` | `refusee` |
| `acceptee` | `en_cours` | `annulee` |
| `terminee` | `code_saisi` | `expiree` |

On n'affiche pas sept états à une personne de 80 ans ; on ne réduit pas la machine à trois sous
prétexte qu'elle est simple.

### 4.4 Jobs et annonces (univers jobs)

**`annonces`** — `id` · `entreprise` · `titre` · `categorie` (liste fermée) · `description` ·
`commune_cp` · `duree` · **`statut`** (`contrat_etudiant` · `benevolat`) · `salaire_convenu` ·
**`nuit`** · **`activite_interdite_mineurs`** · **`reserve_18`** (calculé : `nuit` OU
`activite_interdite_mineurs`) · `payant` (faux au lancement) · **`sponsorise`** (= `payant`) ·
`etat` (`brouillon` · `en_attente` · `publiee` · `refusee` · `expiree`) · `publiee_le` · `echeance` ·
`modere_par` · `modere_le` · `motif`.

> **`statut` manquait, et c'est une des cinq mentions obligatoires** (note légale § 7 quater). Sans
> lui, l'écran affichait une liste de mentions dont l'une n'existait nulle part dans les données.
>
> **`benevolat` n'est proposé qu'à une ASBL.** Le bénévolat est défini pour le secteur non marchand
> (loi du 3 juillet 2005) : une société commerciale qui « emploie » un bénévole fait du travail
> dissimulé. Les options du champ dépendent donc du type de compte — `contrat_etudiant` pour une
> entreprise et une ASBL, `benevolat` pour une ASBL seulement.
>
> **`nuit` et `activite_interdite_mineurs` sont les deux interrupteurs derrière le badge « 18 ans et
> plus ».** La version 1 affichait le badge à l'écran sans stocker ce qui le déclenche : le badge
> n'avait aucune donnée derrière lui. `reserve_18` est calculé, jamais saisi.
>
> **`sponsorise` porte la mention « annonce sponsorisée »**, obligatoire le jour où la publication est
> payante (note légale § 7 quinquies). C'est le même booléen que `payant` : deux champs pour une
> décision, c'est une occasion de les faire diverger — d'où la règle « `sponsorise` est une copie
> calculée ».

**Plafond : trois annonces actives par entreprise.** Ne comptent pas : brouillons, refusées, expirées.

**Aucune candidature n'est reçue par la plateforme** : l'étudiant contacte l'entreprise par la
messagerie, qui l'engage. C'est ce qui nous garde hors du rôle de placeur.

**`heures_declarees`** *(nouvelle)* — `etudiant` · `entreprise` · `annee` · `mois` · `heures` ·
`declare_le`. **C'est la seule source possible des compteurs de l'univers jobs** : la plateforme ne
voit ni la candidature, ni le contrat, ni les heures. Elle ne peut donc pas *compter* les 650 h — elle
peut seulement **enregistrer ce que l'étudiant déclare**, mois par mois, et lui montrer.

> **C'était le trou le plus grave de la version 1** : une jauge « 128 h sur 650 h » affichée sur trois
> écrans, alimentée par une table `missions` qui ne contient **que des missions d'entraide**. Le
> chiffre n'avait aucune source. Deux issues : le supprimer, ou le rendre déclaratif. Il est rendu
> déclaratif, avec son libellé : « **déclaré par toi — la référence officielle reste Student@work** ».
> Conservation **24 mois** (il faut la année précédente pour la règle des 12 mois).

**Compteur « 12 mois chez le même employeur » et rétention.** La version 1 gardait `missions`
**12 mois** et calculait l'ancienneté chez l'employeur depuis `missions` : au 13ᵉ mois, la première
mission disparaissait et le compteur **repartait de zéro** — la règle de protection s'auto-annulait.
Il se calcule désormais depuis `heures_declarees` (24 mois), et `liens_employeur` n'est pas nécessaire :
le premier et le dernier mois déclarés suffisent.

### 4.5 Confiance et traces

**`avis_faits`** — `mission` · `auteur` · `sujet` · `valeur` (**`tres_bien` · `correct` · `probleme`**) ·
`cree_le`. **Symétrique** : la personne aidée évalue l'étudiant, l'étudiant évalue la personne aidée,
avec les trois mêmes valeurs (projet 3, `app3-evaluation.html`). Jamais une moyenne d'étoiles.

**Le profil affiche des faits, pas une note** : « 12 missions, 12 fois bien passées ». Moins de trois
missions : « **Nouveau — vérifié** », pas un chiffre fragile. Un `probleme` **n'est pas une mauvaise
note** : il ouvre un `signalements` privé, et c'est l'exploitant qui tranche.

**`signalements`** — `cible_type` (`profil` · `mission` · `annonce` · `message`) · `cible_id` ·
`auteur` · `motif` (cinq motifs fermés) · `texte` (300 car.) · `etat` · `decision` · `decide_par` ·
`decide_le`. **Visibles par l'exploitant seul** — jamais par la personne signalée, jamais en public.
Trois signalements distincts sur une même cible : masquage provisoire, puis décision humaine sous 24 h.

**`confirmations`** — `mission` · `confirme_par` (compte aidé **ou** personne de confiance) ·
`reponse` (`oui` · `non` · `pas_de_reponse`) · `horodatage`. Une seule question, sans durée ni montant ;
un « non » n'entraîne **aucune sanction automatique**.

> **Préséance, absente de la version 1** : deux personnes peuvent confirmer la même mission. **La
> réponse de la personne aidée prime** ; celle de la personne de confiance n'est retenue que si la
> personne aidée n'a pas répondu sous **7 jours**. Sans cette règle, une confirmation et son contraire
> coexistent dans la même mission, et le carnet affiche les deux.

**`carnet`** — `etudiant` · `mission` · `nature` (`confirme` · `declare` · `annulee`) · `heures` ·
`cree_le`. C'est son carnet, il le remplit ; la plateforme ne certifie aucune heure.

> **Les trois natures sont assumées** : la version 1 de la spec disait « deux étiquettes seulement »
> alors que la maquette en affiche trois (une mission annulée apparaît « annulée »). Ce n'est pas une
> validation de plus, c'est l'honnêteté de dire qu'une mission annulée n'a pas eu lieu.
>
> **Règle anti-contournement du compteur** : les compteurs retiennent **la plus grande des deux durées**
> — prévue (`duree_travail_min`) et déclarée (`carnet.heures`). Sous-déclarer ne libère donc aucun
> quota. Ce n'est pas une sanction : c'est ce qui empêche la jauge de 8 h d'être un chiffre qu'on peut
> faire baisser en mentant.

**`journaux`** — append-only : `horodatage` · `action` · `acteur` · `cible` · `detail`. Aucune donnée
sensible dans le détail.

### 4.6 Messages *(nouvelle — composant du hub)*

**`messages`** — `id` · `fil` (`mission:12`, `annonce:7`) · `de` · `vers` · `corps` (2 000 car.) ·
`cree_le` · `lu_le`. **Aucun champ pour une pièce jointe**, et c'est structurel : « un message, pas un
dossier » (note légale) ne se tient pas par un règlement, il se tient par un schéma. Conservation :
**12 mois après le dernier échange**, règle du hub.

> La version 1 n'avait **aucune** table de messages alors que le hub impose la messagerie Kazendra
> comme seul canal, que `signalements.cible_type` prévoit `message`, et qu'un écran dit « vous recevez
> des messages, pas des dossiers ». Une porte qui promet la messagerie et ne la modélise pas.
> Elle est ici comme **composant partagé** : une seule table, une seule spécification, utilisée par les
> huit portes (voir § 9).

### 4.7 Référentiels

**`calendriers_scolaires`** · **`vacances`** · **`jours_feries`** — importés depuis `/opt/data/app3/veille/`
(3 communautés × 3 années, relevés le 11/10/2026), relus **une fois par an en août** par
`releve-calendriers.py`, garde hebdomadaire `garde-calendriers.py`. Ce sont eux — jamais une case
cochée — qui ouvrent ou ferment une journée.

**`textes`** — `cle` · `acteur` · `phrase` · `ecran`. Les 56 phrases figées, contrôlées par
`node app3/tests/verifie-textes.mjs` (57 motifs interdits). Aucun texte en dur dans un écran.

**`exports`** — `horodatage` · `fichier` · `tables[]` · `taille` · `conserve_jusqu_a`.

## 5. Ce que les compteurs font, et où ils bloquent

| Compteur | Source | Calcul | Ce qu'il bloque |
|---|---|---|---|
| **8 h par semaine** (entraide) | `missions` | somme de `max(duree_travail_min, carnet.heures)` des missions **acceptées, en cours et terminées** de la semaine ISO visée | accepter une mission qui dépasserait 8 h |
| **650 h par an** (jobs) | `heures_declarees` | somme des mois de l'année civile | rien : avertissement, et renvoi à Student@work |
| **12 mois chez le même employeur** | `heures_declarees` | écart entre le premier et le dernier mois déclarés | alerte à 10 mois, alerte forte à 12 |
| **3 sollicitations par jour** | `sollicitations` | nombre de lignes du jour | aucune de plus avant le lendemain |
| **3 annonces actives** | `annonces` | état `publiee` ou `en_attente` | dépôt d'une quatrième |
| **3 signalements distincts** | `signalements` | lignes sur la même cible | masquage provisoire, puis décision humaine |

**Deux corrections de fond dans ce tableau.** Le compteur de 8 h sommait les missions **terminées** :
on pouvait donc accepter cinq missions de 8 h dans la même semaine, aucune n'étant encore terminée au
moment de l'acceptation. Il compte désormais les missions **engagées** (acceptées et non annulées) de
la semaine visée. Et le compteur de 650 h n'avait **aucune source** : il en a une, déclarative.

**Le compteur de 8 h ne voit que ce qui passe ici.** Un étudiant qui fait 6 h sur une autre plateforme
peut dépasser le plafond légal sans que la jauge bouge. L'écran le dit et propose un champ « heures
faites ailleurs cette semaine » : une jauge qui prétend protéger sans le dire est pire que pas de jauge.

**Blocages liés à l'âge (16–17), dans le code et pas dans un texte** : aucune mission entre **22:00 et
06:00** (source : note légale, nuit décalée à 22 h pour les plus de 16 ans) · aucun dimanche ni jour
férié · aucun créneau pendant les heures de cours · aucune activité sans consentement parental actif ·
liste noire du travail manuel appliquée à la tuile « Autre ».

**Et un blocage qui manquait** : ces règles s'appliquent à **l'intervalle entier** `debut`→`fin`, pas à
l'heure de début. Une mission de 4 h commencée à 20:00 finit à minuit : elle traversait la nuit d'un
mineur sans qu'aucun contrôle ne s'en aperçoive. Le contrôle porte sur toutes les heures touchées.

## 6. Durées de conservation

| Donnée | Durée | Pourquoi |
|---|---|---|
| `adresses` | **30 jours après la dernière mission** | plus utile après ; la fuite la plus grave possible |
| `adresses.code_acces` | **à la clôture de la mission** | un digicode ne survit pas à la prestation |
| `missions` | **12 mois** | litiges et compteur hebdomadaire |
| `heures_declarees` | **24 mois** | la règle des 12 mois a besoin de l'année précédente |
| `avis_faits`, `confirmations` | **24 mois** | preuve qu'on a agi |
| `signalements` | **24 mois** | même règle que les autres portes |
| `messages` | **12 mois après le dernier échange** | règle du hub |
| `journaux` | **12 mois** | sécurité |
| `exports` | **30 jours** | un export oublié est une fuite qui dort |
| `carnet` | tant que le compte vit | c'est le carnet de l'étudiant |
| `etablissement` | **effacé à la vérification de l'attestation** | identifie un mineur, ne sert qu'une fois |
| Données d'un mineur refusé | **effacées immédiatement** | décision 17 |
| Compte inactif | avertissement à **11 mois**, suppression à **12 mois** | plus court que le hub |

## 7. Ce qui n'est JAMAIS stocké (liste ferme, à relire avant chaque mise en ligne)

IBAN, numéro de compte, toute donnée bancaire · pièce d'identité, carte, passeport · **extrait de casier
judiciaire** · fichier d'attestation d'étude · **position GPS, coordonnées, itinéraire** · adresse d'un
particulier hors de la table `adresses` · nom de famille d'un senior dans une fiche publique · numéro de
téléphone publié · données de santé · origine, religion, opinions politiques · photo d'un mineur sans
consentement parental · **pièce jointe en messagerie**.

## 8. Les quinze constats de la relecture, et ce qu'ils ont changé

Le détail et la gravité sont dans `AUDIT-EXPERT-JOB-ETUDIANT.md`. Résumé :

1. **650 h sans source** → `heures_declarees`, libellé déclaratif.
2. **8 h qui ne comptait pas les missions acceptées** → missions engagées.
3. **`communaute` absente** → ajoutée ; la langue ne la remplace pas.
4. **`etablissement` collecté mais non stocké** → ajouté, effacé après vérification.
5. **Distance de 300 m sans position** → distance entre communes, jamais « 0 km ».
6. **Rétention 12 mois vs compteur 12 mois** → 24 mois sur `heures_declarees`.
7. **`messages` absente** → ajoutée, composant du hub, aucun champ pièce jointe.
8. **`sollicitations` absente** → ajoutée, compteur calculé.
9. **Créneau jamais libéré** → règle de libération sur refus, annulation, expiration.
10. **États dérivés stockés** → `bloque_cours` et vacances calculés, `indisponible` écrit.
11. **Mission traversant minuit** → contrôle sur l'intervalle entier.
12. **`creneau_id` unique** → `debut`/`fin` + `pause_min` + `duree_travail_min`.
13. **Code PIN sans limite d'essais** → 3 essais, valable le jour même.
14. **`statut`, `nuit`, `activite_interdite_mineurs`, `sponsorise` absents** → ajoutés.
15. **Export avec adresses et digicodes** → `adresses` exclue de l'export.

## 9. Ce qui n'est pas dans cette porte, et où c'est

- **Messagerie** : composant du hub, une seule fois pour les huit portes. La table est décrite ici
  parce que cette porte en dépend, mais l'écran ne se maquette pas huit fois.
- **Compte unique, vérification e-mail/SMS, rôles d'administration, facturation** : plan du hub.
- **Modération** : il n'y a pas de table `moderation`. La file est une **vue** sur
  `annonces.etat = en_attente` et `signalements.etat = ouvert`. Une table de file pour deux sources,
  c'est deux vérités à garder synchronisées.
- **La demande d'entraide n'est pas pré-modérée.** La spec § 6 le laissait croire. Une demande privée
  adressée à un seul étudiant, qui expire 2 heures avant le créneau, ne peut pas attendre une
  modération humaine : ce sont les **profils** qui sont vérifiés à la main et les **signalements** qui
  traitent l'abus.

## 10. Ce qu'il reste à trancher

1. ~~Le nom de l'application~~ — ✅ **TRANCHÉ le 25/10/2026 (décision 34 du plan)** : **Kazendra**, unique,
   pour les huit portes. Aucune marque propre, aucune application individuelle, aucun dépôt, aucun
   domaine à acheter. La porte reste une section de l'application Kazendra, avec un titre descriptif.
2. **La vérification du numéro BCE** reste manuelle : combien de temps par dossier, et qui la fait ?
3. **La condition d'âge de l'exemption ONSS** (8 h/semaine) pour l'entraide : à lire à la source avant
   d'ouvrir l'entraide aux 16–17 ans. L'univers jobs est déjà ouvert à 16 ans.
4. **L'assurance RC du mineur** : à confirmer par un courtier avant sa première mission.
5. ~~Les services de la liste fermée~~ — ✅ **TRANCHÉ le 25/10/2026.** L'utilisateur : « *On garde cette
   liste.* » La liste fermée est donc **courses · pharmacie · compagnie · accompagnement · autre**, et
   rien d'autre : « promener le chien » (qualification non tranchée par la note légale), « soutien
   scolaire » et « informatique » (cités par aucun texte) en sont sortis ; « accompagnement » y est
   entré parce que l'exemption ONSS le cite mot pour mot. `sait_faire[]` ne peut contenir **que** ces
   cinq valeurs — un besoin hors liste passe par « Autre » et un contrôle à la main.
