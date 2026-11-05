# SPEC — Porte `/emploi`

Ouverte le 25/10/2026. Compagnon de `PLAN-HUB-SEPT-SERVICES.md` (décisions 33 et 34),
`SPEC-JOB-ETUDIANT.md` (porte voisine, et volontairement différente), `SPEC-ANNONCE.md`.

**Demande de l'utilisateur, 25/10/2026 :** « *On peut ouvrir emploi, affichage pur, l'annonce de
l'employeur affiche l'adresse mail à contacter pour postuler. En cliquant sur postuler un mail s'ouvre
directement avec le Gmail de l'utilisateur, pas de lien avec Kazendra.* »

C'est la porte **la plus simple des huit** : pas de mission, pas de code, pas de carnet, pas de
compte candidat, pas de CV. Tout ce qu'elle fait tient en une phrase — **afficher une offre et
l'adresse à laquelle écrire**.

---

## 1. Ce que la porte fait, et ce qu'elle ne fait pas

| | |
|---|---|
| **Publie** | une **entreprise** (ou une ASBL), avec un **numéro BCE vérifié à la main** |
| **Consulte** | tout le monde, **sans compte**, sans inscription, sans cookie de suivi |
| **Postuler** | un bouton qui ouvre **le client mail de l'utilisateur**, pré-adressé à l'employeur |
| **Ne reçoit** | **aucune candidature**, aucun CV, aucun fichier, aucune donnée de candidat |
| **Ne transmet** | rien : Kazendra n'est pas dans le fil, ne voit pas le message, ne le conserve pas |
| **Ne facture** | rien à celui qui cherche ; l'entreprise paie pour publier (réglage, gratuit au lancement) |

**La ligne rouge de cette porte, et c'est la même que celle de `/job-etudiant`, poussée à son terme** :
Kazendra n'est ni employeur, ni placeur, ni intermédiaire de candidature. Ici, il n'est même pas dans la
conversation. C'est le montage le plus sûr des huit portes — et le plus pauvre en données, donc le plus
facile à défendre.

## 2. La mécanique « Postuler » — et ce qu'elle coûte

**Ce qui se passe quand on clique.** Le navigateur ouvre le gestionnaire de courrier par défaut avec un
lien `mailto:` déjà rempli : destinataire = l'adresse de l'annonce, objet = le titre de l'offre suivi de
« — candidature ». **Un brouillon de corps de message est proposé** (décision 35 f, ajout de
l'utilisateur : « *on peut aussi rajouter un corps de message que l'utilisateur peut utiliser, ou pas* »).

**Proposé, jamais imposé — et le choix est visible avant le clic.** Deux gestes distincts, pas un texte
qu'il faut effacer : **« écrire avec ce texte »** ouvre le message pré-rempli, **« écrire sans texte »**
ouvre un message vide. Le brouillon est affiché en clair au-dessus des deux, donc on sait ce qu'on envoie
avant de cliquer. Trois règles, et la deuxième est la plus importante :

1. **court** — 247 caractères pour l'exemple affiché. Un `mailto:` trop long est tronqué par certains
   clients, et un brouillon coupé au milieu d'une phrase est pire que pas de brouillon ;
2. **jamais « je joins mon CV », jamais « ci-joint »** — rien n'est joint, et une phrase qui promet une
   pièce absente fait passer le candidat pour un négligent. C'est le seul piège réel de cette
   fonctionnalité, et l'audit le refuse par expression régulière ;
3. **aucune signature pré-remplie, aucune mention de Kazendra** — le message doit être celui du candidat,
   pas une publicité avec un timbre à son nom.

La formule d'ouverture est neutre (« Madame, Monsieur ») parce qu'aucune annonce ne nomme la personne qui
recevra le courriel.

**Trois choses que cette mécanique impose d'écrire, parce qu'elles ne sont pas des détails :**

1. **`mailto:` ouvre le gestionnaire par défaut, pas « Gmail ».** Sur Android, c'est Gmail si c'est
   l'application configurée ; sur un poste sans client mail, **rien ne s'ouvre**. L'écran ne promet donc
   jamais « Gmail » : il dit « **écrire à l'employeur** », et affiche l'adresse **en clair à côté du
   bouton**, pour que celui dont le client ne s'ouvre pas puisse la copier. C'est la différence entre un
   bouton qui marche et un bouton qui a l'air de marcher.
2. **Une adresse e-mail publiée est récoltée par des robots.** C'est la contrepartie réelle du choix, et
   il faut la dire à l'employeur au moment du dépôt, pas la lui cacher : son adresse sera publique et
   récupérable. Deux mesures, aucune parfaite :
   - l'adresse **n'est pas écrite dans le HTML servi** : elle est portée par deux attributs séparés et
     assemblée au clic, ce qui arrête les robots simples (pas les moissonneurs sérieux) ;
   - au dépôt, une phrase explicite : « cette adresse sera publique. Si vous ne voulez pas de publicité
     indésirable, utilisez une adresse dédiée au recrutement. »
3. **Une adresse e-mail est une donnée personnelle.** Si elle appartient à une personne nommée
   (`prenom.nom@…`), la publier suppose l'accord de cette personne. L'entreprise **déclare** au dépôt
   qu'elle est autorisée à publier cette adresse ; la déclaration est horodatée et conservée avec
   l'annonce. Toute personne peut demander le retrait de son adresse : une ligne dans la page de
   contact, et le retrait se fait sans discussion.

**Ce que la porte perd, et il faut l'assumer.** Aucun suivi de candidature, aucune preuve d'envoi, aucune
interception d'arnaque, aucune statistique. La conversation sort de Kazendra le jour du clic. Ce n'est pas
un défaut de conception : c'est le prix de l'affichage pur.

## 3. Ce que l'annonce doit porter — les cinq mentions, et les garde-fous

Une offre d'emploi est encadrée : les mentions obligatoires viennent de la note légale du projet 3
(`app3/note-legale-belgique.md` § 7 quater), pas d'une intuition.

**Les cinq mentions, affichées comme une liste vérifiable :**

1. **employeur identifié** — dénomination + numéro d'entreprise, **jamais une annonce anonyme** ;
2. **lieu** — commune et code postal ;
3. **durée** — CDI, CDD, intérim, saisonnier, stage, avec la durée si elle est déterminée ;
4. **statut** — salarié, indépendant, étudiant ; c'est le statut, jamais un âge ;
5. **rémunération** — salaire ou fourchette, et **la commission paritaire** pour un emploi salarié.

**Les garde-fous hérités du hub, appliqués tels quels :**

- **Aucun âge dans le texte**, aucune fourchette d'âge, aucun « jeune » comme qualité — l'âge est un
  critère protégé (Unia), y compris dans une offre d'emploi. Les catégories interdites aux mineurs
  (nuit, industrie, conduite d'engins, alcool) n'ont pas à être filtrées ici : cette porte est réservée
  aux **adultes**, et l'offre le dit en une ligne.
- **Modération humaine avant publication.** Ce n'est pas une formalité : le contact sortant est le seul
  point de contrôle qui reste. Un faux employeur qui récolte des CV est le risque numéro un de cette
  porte.
- **Contrôle du domaine du courriel.** Une entreprise qui publie avec une adresse `@gmail.com` alors
  qu'elle a un nom de domaine est signalée à la modération. Ce n'est pas un refus automatique — un
  indépendant peut légitimement utiliser Gmail — c'est une question posée avant publication.
- **Aucune donnée bancaire, aucun IBAN** dans une annonce ; un employeur qui en demande avant contrat
  est signalé.
- **Le bouton de partage Kazendra** (rond 34 px, flèche, orange au survol) : oui, sur cette porte. Une
  offre d'emploi est faite pour circuler, et c'est du contenu public.
- **Signalement** sur chaque annonce, visible par l'exploitant seul.

**Un avertissement sur la fiche, parce que le CV sort :** ne jamais envoyer de copie de carte d'identité,
d'IBAN ni de mot de passe ; un employeur sérieux ne demande aucune de ces trois choses avant un contrat
signé. C'est la même phrase que sur la fiche d'une offre de `/job-etudiant`, et elle compte encore plus
ici : personne ne relira le message.

## 4. La différence avec `/job-etudiant` — elle est voulue, et il faut l'écrire

Deux portes voisines, deux règles opposées sur le même geste. C'est le genre de contradiction qu'une
session future « corrigera » si elle n'est pas expliquée.

| | `/job-etudiant` | `/emploi` |
|---|---|---|
| « Postuler » | **aucun** — on écrit par la messagerie Kazendra | **oui** — `mailto:` vers l'employeur |
| « CV à envoyer à… » | **bloqué à la saisie** | **c'est le principe même** |
| Qui lit le message | Kazendra aussi (messagerie interne) | personne chez Kazendra |
| Pourquoi | ce sont des **mineurs** : il faut une trace, une modération, et rien qui sorte sans contrôle | ce sont des **adultes** : ils n'ont pas besoin qu'on lise leur courrier |

**Ce que ça implique pour la spec de `/job-etudiant`** : sa règle « aucun CV ne passe par ici » n'est pas
une règle du hub, c'est une règle de la porte étudiante. Elle reste. La décision 34 (une seule
application) ne veut pas dire une seule politique.

## 5. Écrans à produire

Cinq écrans de bureau, deux vues mobiles. Pas onze comme `/job-etudiant` : la porte n'a ni mission ni
carnet.

1. **Liste des offres** — métier, commune, contrat, temps de travail, date de publication. Filtres :
   métier, commune (code postal), type de contrat, temps plein/partiel. Tri : plus récentes, plus
   proches.
2. **Fiche d'une offre** — les cinq mentions, la description, l'employeur (BCE vérifié et daté), le
   bouton **« Écrire à l'employeur »**, l'adresse en clair à côté, l'avertissement anti-arnaque,
   l'âge minimum de la porte (18 ans), le partage, le signalement.
3. **Dépôt** — les champs des cinq mentions, l'adresse de contact (pré-remplie avec celle du compte,
   modifiable), l'avertissement « cette adresse sera publique », la déclaration d'autorisation, la
   ligne verrouillée « offre réservée aux 18 ans et plus » (ce n'est pas un interrupteur).
4. **Mes offres** — les cinq états de `/job-etudiant` (brouillon, en attente, publiée, refusée, expirée),
   une action par ligne, le motif quand c'est refusé, et **le plafond d'annonces actives**.
5. **Mobile** — la liste et la fiche à 390 px, avec une barre d'action collante portant le seul geste de
   la porte : **écrire à l'employeur**.

**Ce qui n'existe pas sur ces écrans, et c'est vérifiable par programme** : aucun champ de CV, aucun
bouton « déposer ma candidature », aucune zone de dépôt de fichier, aucun compteur de candidats,
aucun « suivi de candidature ». Si l'un apparaît, la porte a changé de nature sans décision.

## 6. Données — le minimum de toutes les portes

**`offres_emploi`** — `id` · `entreprise` · `titre` · `metier` (liste fermée) · `description` ·
`commune_cp` · `type_contrat` · `temps` (plein · partiel + heures) · `salaire` (+ mention « encadré par
la commission paritaire ») · **`email_contact`** · **`email_declare_le`** · `etat` · `publiee_le` ·
`echeance` · `payant` · `sponsorise` · `modere_par` · `modere_le` · `motif`.

**`favoris`** — **stockés dans le navigateur de l'utilisateur** (`localStorage`), jamais sur le serveur :
la porte ne demande aucun compte à celui qui cherche, donc elle n'a aucun endroit où ranger ses favoris.
Conséquence assumée : un favori ne suit pas d'un appareil à l'autre.

**Ce qui n'est jamais stocké** : aucun nom, aucun e-mail, aucun CV, aucune lettre de motivation, aucune
adresse IP de candidat, aucune donnée de candidature. **La seule adresse e-mail de la table est celle de
l'employeur, et elle est effacée avec l'annonce** — au plus tard 30 jours après son expiration.

## 7. Politique de prix — cohérente avec la décision 33

Le plan prévoyait **39 €** pour publier. La décision 33 a tranché que **la publication est gratuite au
lancement** pour `/job-etudiant` ; la même politique s'applique ici, sinon deux portes voisines
factureraient différemment le même service le même mois.

- **gratuit au lancement**, pour l'entreprise comme pour le visiteur ;
- `payant` et `echeance` **codés dès maintenant**, et `sponsorise` en copie calculée de `payant` (la
  mention « annonce sponsorisée » est obligatoire le jour où l'on facture) ;
- le prix de 39 € est un **réglage**, pas une constante : il se change dans le panneau, sans toucher au
  code, et **jamais facturé à celui qui cherche un emploi**.

## 8. Ce que la porte n'a pas, et où ça va

- **Aucun compte candidat.** Un compte n'apporte rien ici : il n'y a rien à conserver côté chercheur.
- **Aucune messagerie.** Le canal, c'est le courriel de l'employeur, et il sort de Kazendra.
- **Aucune candidature.** Par conséquent aucun suivi, aucune relance, aucun « vu par l'employeur ».
- **La modération** est la file unique du hub : la vue sur `offres_emploi.etat = 'en_attente'` plus
  `signalements.etat = 'ouvert'`.

## 9. Questions ouvertes

1. **Le maillage avec les autres portes.** Une offre peut-elle renvoyer vers un logement `/immo` ou un
   artisan `/artisan` (« logement fourni ») ? Proposition : non en V1 — un lien dans une offre d'emploi
   est un vecteur d'arnaque, et le hub n'a pas besoin de ça pour être cohérent.
2. **La durée de publication.** 30 jours comme `/annonce`, ou 60 comme `/immo` ? Proposition : **30
   jours**, avec prolongation gratuite au lancement — une offre d'emploi qui a un mois est périmée.
3. **Les offres des ASBL et du secteur public** (communes, CPAS, écoles) : même régime que l'entreprise ?
   Proposition : oui, avec le même numéro d'entreprise vérifié.
4. **Le nom des métiers** : liste fermée de combien de catégories ? Proposition : la nomenclature la plus
   courte qui reste utile — 12 à 15 familles, jamais une liste de 200 métiers qu'on ne maintient pas.

## 10. Ce qui reste à produire pour clore cette porte

- [x] **Modèle de données écrit** — table `offres_emploi` au § 6, volontairement courte : c'est la
      porte la plus pauvre en données du hub, et c'est un argument, pas un défaut
- [x] **Les cinq écrans de bureau + les deux vues mobiles** — `maquettes/emploi.html`, captures
      `emploi-liste.png`, `emploi-fiche.png`, `emploi-depot.png`, `emploi-mes-offres.png`,
      `emploi-mobile-390.png`
- [x] **Audit automatique de la porte** — `maquettes/audit-emploi.py`, rejouable : **46 contrôles,
      0 échec**
- [x] **Textes figés de la porte** — `textes/emploi-fr.json`, **16 phrases**, chacune avec son
      emplacement ; contrôle `node tests/verifie-textes.mjs` → **0 faute** sur 27 motifs
- [x] **CGU** — `CGU-EMPLOI.md` : clause « 2 bis » prête à insérer, avec ce que chaque paragraphe ferme
- [ ] Les versions NL et EN de la clause CGU (le français est la référence)
- [ ] `confidentialite.html` : dire ce que cette porte ne collecte pas (aucune candidature, aucun CV,
      favoris dans le navigateur)
- [ ] Vérifier à la source les obligations propres aux offres d'emploi (durée de conservation d'une
      annonce, mentions légales de la publication)

## 11. Ce que les écrans ont tranché, et les défauts trouvés en les regardant

56. **L'adresse n'est jamais sur un écran public.** L'audit le vérifie écran par écran : absente de la
    liste, de la fiche et du mobile, présente **uniquement** dans le dépôt — c'est l'employeur qui
    saisit la sienne. Sur la fiche, elle s'affiche « recrutement [arobase] boulangerie-du-parc.be » :
    lisible et copiable par un humain, jamais présente comme une chaîne `mailto:` prête à moissonner.
57. **Le clic est prouvé, pas supposé.** `window.location` n'est pas observable depuis Playwright : la
    maquette pose donc un témoin (`data-dernier-courriel`) juste avant de naviguer, et l'audit lit ce
    témoin. Le contrôle vérifie trois choses : que le lien est bien un `mailto:`, qu'il porte l'adresse
    assemblée, et qu'il **ne contient aucune trace de Kazendra**.
58. **Le bouton de partage du hub est présent** (rond, 34 × 34, une flèche) et **mesuré** par l'audit.
    Premier jet : j'avais écrit une carte « Partager » **sans bouton** — du texte qui annonce une
    action inexistante.
59. **Le badge d'âge et l'étiquette de contrat ne sont plus étirés** — cinquième et sixième occurrence
    du même défaut de sélecteur après `.ul li b`, `.checklist div`, `.entrow b` et `.mentm div`. Et
    une leçon de plus : mon premier correctif (`:not(.b18)`) a réparé le badge **et cassé l'étiquette
    « CDI · 38 h »**, qui est aussi un `<span>` enfant direct. Une exclusion doit être tenue à jour à
    chaque nouvel élément ; un override explicite, lui, se lit à côté de la règle qu'il corrige.
60. **Les deux défauts de mon propre audit, corrigés** : il exigeait que l'adresse soit absente du
    fichier source — faux, le formulaire de dépôt doit la montrer à celui qui la tape ; et il refusait
    le mot « Gmail » partout, alors que la règle de modération le cite légitimement comme exemple de
    domaine surveillé. Il ne refuse plus que **la promesse** (« ouvre ton Gmail »).
61. **La vue mobile de la fiche était vide** sous l'avertissement anti-arnaque : une seconde carte
    porte désormais les cinq mentions. Un demi-écran vide n'est pas de l'air, c'est un manque.
62. **Le brouillon de message, et les deux gestes qui vont avec.** Vérifié par l'audit : le geste
    principal porte bien un `&body=`, le geste « sans texte » n'en porte **aucun**, le brouillon est
    visible **avant** le clic, il ne mentionne pas Kazendra, il ne promet aucune pièce jointe, et il
    fait 247 caractères — donc sous la limite de troncature. La vue mobile de la liste, qui était
    tombée à moitié vide en hauteur égale, porte maintenant cinq offres : deux téléphones équilibrés.
    Et une correction d'honnêteté dans la planche elle-même : elle affirmait « rien d'autre n'est
    pré-rempli », ce qui était vrai avant le brouillon et faux depuis. L'audit refuse désormais cette
    phrase — un commentaire de planche qui ment est un défaut comme un autre.

## 11 bis. L'image de marque de l'employeur (décision 37, 25/10/2026)

- L'employeur qui publie peut afficher **son logo, ou à défaut une photo de son entreprise** — un seul
  emplacement, deux provenances. L'image appartient au **compte**, pas à l'offre : déposée une fois,
  elle sert ici et sur les quatre autres portes.
- **Jamais obligatoire** : une offre sans image s'affiche entière, dans le bloc « employeur identifié »,
  sans cadre vide ni mention « sans photo ». Le blanc tient l'alignement, rien d'autre.
- **SVG refusé**, métadonnées effacées à l'envoi (une photo de façade prise au téléphone porte les
  coordonnées GPS), remplacement soumis à relecture — l'ancienne image reste affichée jusque-là.
- **Ce que l'image ne fait pas** : elle ne remplace ni la dénomination, ni le numéro d'entreprise, et
  elle ne rend pas l'employeur « vérifié par Kazendra ». Un logo n'est pas une certification, et la
  porte écrit déjà qu'elle ne vérifie que ce qu'elle peut vérifier.

## 12. Les textes figés, et le harnais porté dans le hub

63. **Le harnais du projet n°3 est devenu celui du hub** — `tests/verifie-textes.mjs`, avec les motifs
    du hub (`textes/interdits.json`, **27 motifs**) et non les 57 du projet n°3. Quatre règles : parité
    des langues (le `-fr` est la référence), **un texte sans emplacement n'existe pas**, motifs interdits
    (exact, contexte, expression régulière, et `deni_ok` pour les phrases qui nient le mot), et longueur
    maximale de 600 caractères — au-delà, ce n'est plus un texte d'écran, c'est un paragraphe.
    Assumé : la copie diverge du fichier d'origine, et c'est voulu — les deux projets n'ont ni les mêmes
    motifs ni les mêmes portes.
64. **Le contrôle a été éprouvé, pas seulement lancé.** Un contrôle qui passe du premier coup ne prouve
    rien : un fichier piégé a été passé au harnais, et il a mordu **9 motifs** (candidature déposée,
    transmission, paiement sécurisé, certifié, emploi garanti, salaire garanti, jeune dynamique,
    fourchette d'âge, « ouvre Gmail »), puis **2 fautes de structure** (texte de 729 caractères, texte
    sans emplacement), avec un code de sortie à **1** — de quoi faire échouer une chaîne d'intégration.
    Les deux phrases de négation (« nous ne délivrons aucune attestation », « vérifié à la main, jamais
    certifié ») ont été correctement épargnées.
65. **La dérive que personne n'aurait vue : 0 phrase sur 19.** La version 1.0 des textes avait été
    écrite **après** la maquette, dans un registre différent — « tu » et « vous » mélangés — et **aucune
    des 19 phrases ne se retrouvait à l'écran**. Un fichier de textes qui ne correspond à aucun écran est
    une deuxième vérité, exactement ce que ce harnais existe pour empêcher. Corrigé en **extrayant** les
    phrases des écrans au lieu de les réécrire à côté (16 phrases), et **l'audit de la porte vérifie
    désormais cette correspondance** : c'est le contrôle qui aurait attrapé la dérive le jour même.
66. **Deux faux positifs de plus, de la même famille que les précédents** : le motif « certifié »
    refusait la phrase « vérifié à la main, jamais **certifié** » — le garde-fou empêchait d'écrire la
    vérité, d'où `deni_ok` ; et trois phrases correctes étaient déclarées absentes parce qu'une balise en
    ligne laisse un espace avant la ponctuation une fois les tags retirés (« `<b>écrire</b>.` » →
    « écrire . »). La normalisation de la ponctuation est maintenant dans le contrôle, pas dans la tête
    de celui qui le lit.

---

## 13. Branchée sur le socle — 27/10/2026

Ce qui était une maquette est devenu une porte. Le récit complet est dans
`/opt/data/webdev/projects/kazendra/SPEC-SOCLE.md` § 11 (décisions 148 à 155) ; ici, ce qui concerne
**cette** porte.

**Ce qui tourne** : `GET /emploi` (liste filtrée, favoris dans le navigateur), `GET /emploi/<id>`
(fiche), `/emploi/nouvelle` (dépôt), `/emploi/mes-offres` (gestion), et les routes API correspondantes
(`/api/emploi`, `/api/emploi/meta`, `/api/emploi/<id>`, `POST /api/emploi`,
`/api/emploi/<id>/{retirer,renouveler}`, `/api/moi/emploi`) plus la section « offres » de
`/api/moderation/file` et `POST /api/moderation/emplois/<id>`.

**Trois écarts avec la maquette, assumés :**

1. **Pré-modération réelle**, contre le plan qui disait « continue ». Le seul contrôle qui reste est le
   contact sortant : rien ne se publie avant qu'un humain ait lu l'adresse et les mentions.
2. **L'adresse n'est jamais servie entière.** Elle est stockée en une colonne (effacée avec l'offre),
   mais l'API la rend en deux morceaux assemblés par l'écran au clic. La maquette posait deux attributs
   `data-` dans le HTML ; en production, aucun HTML servi ne contient l'adresse.
3. **Deux refus de contenu qui n'étaient pas dans la maquette** : une fourchette d'âge ou un IBAN sont
   refusés **à la saisie**, avec la phrase qui explique. L'audit des maquettes les cherchait ; le
   serveur les refuse maintenant.

**Ce qui reste à faire, et qui n'est pas du code** : les versions NL/EN de la clause CGU ;
`confidentialite.html` ; la vérification à la source des obligations propres aux offres d'emploi
(durée de conservation, mentions) ; et la grille de prix — la publication est **gratuite au lancement**,
le réglage à 39 € existe mais n'est encaissé par personne.

**Épreuves** : `kazendra/tests/emploi.test.mjs` (25), section ㉑ de `kazendra/tests/epreuve-http.sh`,
`kazendra/outils/audit-emploi.py` sur graine (`outils/graine-emploi.mjs`).

## 14. La revue de la porte, et les quatre points qu'elle a laissés ouverts — 28/10/2026

Une revue à **contexte neuf** (un agent qui ne savait rien de ce travail) a relu les douze fichiers de
`/emploi` et rendu cinq constats bloquants, neuf de logique, quatorze de qualité. Chaque constat majeur
a été **reproduit par exécution** avant d'être corrigé : un rapport de revue n'est pas une preuve.

### 14.1 Les défauts corrigés (rappel)

- `\b` est une frontière **ASCII** en JavaScript : « âgé de 25 ans » passait la règle d'âge, et « plus
  de 3 ans d'expérience » était refusé à tort. Frontière Unicode désormais.
- L'adresse d'une offre **refusée** n'était jamais effacée (`ifnull(expire_le, retiree_le)` vaut NULL
  pour un refus, donc la condition était fausse) : c'est le cas où elle a le moins de raison de rester.
- Une offre prolongée après effacement de son adresse repartait **sans contact**.
- Le **rayon** était filtré en JavaScript après `LIMIT 200`.
- Une **adresse dans le texte** de l'offre était servie entière dans la liste.
- Le **quota** se contournait par un renouvellement, et rien ne limitait les dépôts par jour.
- Une offre **expirée** ne pouvait plus être retirée.
- L'**expiration** ne tournait qu'à la lecture publique : la minimisation dépendait du trafic.

### 14.2 Quatre points ont été tranchés, et voici les décisions

**① Le total annoncé.** Il valait `lignes.length` : au-delà de 200 offres correspondantes, l'écran
annonçait « 200 offres » alors qu'il y en avait davantage. Décision : le total est **compté en base**
(`COUNT(*)` sur le même `WHERE`), l'API ajoute `affichees`, `limite` et `tronquee`, et l'écran écrit
« 200 offres sur 340 — affinez la recherche pour voir les autres ». Une liste qui s'arrête sans le dire
laisse croire qu'il n'y a rien de plus.

**② Les compteurs de métier.** Ils étaient calculés sur **toute** la base publiée, sans la recherche ni
les autres filtres : une case annonçait « 3 offres », on cliquait, il en restait une. Décision : chaque
condition porte sa **dimension**, et les compteurs comptent **tout sauf le métier**. Ils suivent donc la
recherche, le contrat et le rayon, et perdent la seule dimension qu'ils mesurent — c'est la définition
d'une facette. Les autres cases ne disparaissent pas, et le compteur d'un métier choisi ne se réduit pas
à lui-même.

**③ Les vues.** `vues` était incrémenté à chaque ouverture de fiche : rafraîchir trois fois faisait
trois vues, et le chiffre était montré à l'employeur comme une mesure. Décision : **une visite par
visiteur et par jour**. L'empreinte (IP + signature du navigateur, salées par le secret de la base —
jamais l'IP brute) va dans une table `vues_publication` **partagée avec les annonces de
`/job-etudiant`**, qui avaient le même défaut : une table par porte aurait été deux fois le même code
et deux occasions de n'en corriger qu'un côté. Sans empreinte, **on ne compte pas** : mieux vaut rien
qu'un chiffre faux. Les traces sont effacées après **30 jours** (`JOURS_VUES`), avec la même règle que
l'adresse. Les écrans disent « visiteurs », plus « vues ».

**④ Le débit.** Les routes publiques de `/emploi` n'avaient aucune limite, alors que chaque lecture de
la liste expire les offres et recompte les métiers. Décision : `socle/debit.mjs`, **fenêtre glissante**
(une fenêtre fixe laisse passer 2 × `max` à la charnière), deux seaux — **600 lectures/min** et
**20 dépôts/min**, réglables par `KAZENDRA_DEBIT_LECTURE` et `KAZENDRA_DEBIT_DEPOT`, `Retry-After` sur le
429. Les deux seaux sont séparés : une rafale de lectures ne ferme pas le dépôt. La clé est l'adresse du
client **et** la famille de routes, et `X-Forwarded-For` n'est lu que si
`KAZENDRA_PROXY_DE_CONFIANCE=1` — sinon l'en-tête s'invente en une ligne de `curl`.

**⑤ Et un cinquième, trouvé en chemin** : le plafond de **5 dépôts par 24 h** n'était affiché nulle
part. L'employeur à « 0 / 10 offres actives » remplissait le formulaire et se faisait refuser. Un refus
de modération **consomme** un dépôt (il protège la file de relecture, c'est assumé) mais **libère** la
place dans les offres actives. `etatQuota` porte donc `jour` et les trois écrans l'écrivent : « 3 / 5
dépôts aujourd'hui — un dépôt refusé compte aussi ».

### 14.3 Le défaut que l'audit cachait

En branchant le compteur de vues, l'API d'une offre **publiée** a répondu `prive: true` et
`contact.possible: false` : la fiche annonçait « cette offre n'est plus en ligne » à tout le monde, et la
porte n'avait plus de contact du tout. Cause : `offrePublique` rend `{ offre, vue_comptee }` et la route
lisait `r.etat`, donc `undefined`.

L'audit restait **vert à 109 contrôles**, parce qu'il disait : « cette fiche n'a pas de bouton
d'écriture (offre close) — rien à mesurer », puis sortait. **Un contrôle qui s'excuse n'est pas un
contrôle.** Corrigé des deux côtés : la route lit `r.offre.etat`, et l'audit exige l'état **dans les
deux sens** — une offre en ligne *doit* avoir son bouton, une offre close *ne doit pas* en avoir — et il
ouvre enfin la **fiche expirée** de la graine, qui n'était jamais regardée.

### 14.4 Épreuves de cette passe

- `tests/emploi.test.mjs` : **42** (36 + 6 nouvelles, une par décision).
- `tests/debit.test.mjs` : **6** — horloge injectée, donc aucune attente ; la fenêtre glisse vraiment.
- `tests/epreuve-http.sh` : **352 / 0**, dont le 429 et son `Retry-After` prouvés sur un **serveur
  jetable à seuil bas** (marteler la limite réelle fermerait `127.0.0.1` pour toute la suite).
- `outils/audit-emploi.sh` : **169 / 0** à 1440 et 390 px, fiche en ligne **et** fiche close.

### 14.5 Ce qui reste ouvert sur cette porte, et qui n'est pas corrigé

- Les « vues » comptent une visite par jour : un visiteur qui revient trois fois en une journée compte
  pour un. C'est le prix de la déduplication, et c'est le bon sens — mais ce n'est pas un compteur de
  curiosité.
- Aucune **pagination** : la liste s'arrête à 200 et le dit. Une pagination par curseur est le vrai
  correctif, elle n'est pas faite.
- Quatre copies de `echap`/`message`/`date` subsistent dans les écrans (qualité, pas correction).

