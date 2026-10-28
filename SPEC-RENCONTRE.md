# SPEC — Porte `/rencontre` (rencontres)

Version du 25/10/2026. Compagnon de `SPEC-ANNONCE.md`, `SPEC-IMMO.md`, `SPEC-EVENEMENT.md` et de
`PLAN-HUB-SEPT-SERVICES.md`.

✅ **État : porte CLOSE le 25/10/2026 — zéro question ouverte.** Voir le § 19 pour l'inventaire de ce
qui a été produit et vérifié. Ne pas la rouvrir sans une décision explicite de l'utilisateur.

⚠️ **Le speed dating vidéo est hors périmètre de cette version.** Décision de l'utilisateur du
25/10/2026 : « *tu peux commencer à cadrer rencontre sans le speed dating, on reviendra sur ce point
plus tard* ». Les trois conditions techniques déjà mesurées sont consignées au § 15 pour ne pas les
redécouvrir.

Ce document est le plus sensible des huit : il touche à des données que la loi protège davantage que
les autres (§ 4), et il expose des personnes à un chantage possible (§ 8). La règle de lecture est
simple : **tout ce qui n'est pas nécessaire n'est pas collecté, tout ce qui est collecté n'est pas
public.**

---

## 1. Ce que fait `/rencontre`

Une porte de rencontres entre **adultes consentants** : un profil (photos, quelques mots, une commune),
une découverte par affinités et par distance, et une conversation qui ne s'ouvre **que** si les deux
personnes se sont marquées d'un intérêt mutuel.

Trois différences avec les autres portes, et elles commandent tout le reste :

1. **Rien n'est public.** Aucun profil n'est indexé, aucun n'est partageable. Une annonce vend un
   objet ; un profil expose une personne.
2. **Rien ne se paie.** Pas d'abonnement, pas de « voir qui m'a liké », pas de mise en avant. Une
   porte qui gagne de l'argent sur la solitude pousse à la faire durer.
3. **Le silence est la valeur par défaut.** Pas de notification « 12 personnes ont vu votre profil »,
   pas de compteur de visites. Ce qui n'est pas dit ne blesse personne.

## 2. Ce que `/rencontre` ne fait PAS (et ne fera pas)

- **Pas de mineurs.** 18 ans révolus, sans exception, sans émancipation, sans « bientôt 18 ».
- **Pas de rencontres sexuelles tarifées**, pas d'annonces de prostitution, pas de « massage » codé.
- **Pas de vidéo en V1** (le speed dating reviendra comme objet séparé, § 15).
- **Pas d'envoi de photos dans la messagerie** — c'est la mesure anti-chantage la plus efficace (§ 8).
- **Pas de note, pas de score de beauté, pas de classement.** Un classement transforme des personnes
  en produits et pousse à la course aux photos retouchées.
- **Pas de géolocalisation exacte** : la commune, jamais la position. Même règle que `/annonce`.
- **Pas de vérification d'identité par pièce d'identité.** Nous ne voulons pas détenir un fichier de
  cartes d'identité : trop lourd, trop dangereux en cas de fuite. Conséquence assumée et écrite dans
  les CGU : **nous ne prouvons pas l'âge de quelqu'un, nous le lui demandons et nous retirons sur
  signalement** (§ 9).
- Pas de traduction automatique des profils, pas de suggestion par « type physique ».
- Pas d'accès aux profils par recherche libre sur le web, ni par moteur de recherche : `noindex`.

## 3. Qui peut avoir un profil

- **18 ans révolus**, déclaré à l'inscription par une date de naissance (servant uniquement à
  calculer l'âge, jamais affichée en entier : seul « 34 ans » apparaît).
- **E-mail et téléphone vérifiés** (règle du hub, décision du 23/10/2026). Un numéro = un compte.
- **Une personne = un profil.** Pas de second profil sur le même numéro, même après suppression :
  la suppression libère le compte, elle ne rend pas le numéro vierge avant 30 jours (§ 10).
- **Aucune photo n'est exigée** (décision du 25/10/2026 : « *une photo ne doit pas être obligatoire,
  utilisateur peut mettre une annonce sans photo* »). Un profil se publie et apparaît dans la
  découverte **sans aucune photo**. Conséquence assumée : on ne peut plus écarter un profil parce
  qu'il est vide de visage, et l'anti-faux-profil repose donc sur la **pré-modération du texte des
  comptes récents**, l'**intérêt mutuel obligatoire** avant tout message et le **signalement** (§ 8).
  ⚠️ La phrase « un profil sans visage est un faux profil dans 90 % des cas » a été **retirée** de
  cette spec le 25/10/2026 : c'était un chiffre non sourcé. On ne l'écrit pas, on ne le cite pas.
- **Consentement explicite** au traitement des données décrit au § 4, recueilli séparément de
  l'acceptation des CGU, avec une case propre et une explication en clair.

## 4. L'orientation sexuelle est une donnée sensible — et ça change la conception

> **Source** : Autorité de protection des données (Belgique), page « Données sensibles »,
> `https://www.autoriteprotectiondonnees.be/citoyen/themes/donnees-sensibles` — consultée le
> **25/10/2026** (HTTP 200).
> **Citation littérale** : « les données relatives à la vie sexuelle ou à l'orientation sexuelle »
> figurent parmi les catégories particulières visées à l'article 9.1 du RGPD, et « le traitement des
> catégories particulières de données à caractère personnel visées à l'article 9.1 du RGPD est en
> principe interdit ». L'article 9.2 l'autorise notamment lorsque « la personne concernée y a consenti
> expressément ».

Conséquence directe, et elle n'est pas négociable : **le critère de recherche n'est jamais affiché.**

- Afficher « homme, 34 ans, cherche un homme » révèle l'orientation sexuelle à quiconque voit le
  profil, y compris à l'employeur qui passe par là. La loi protège cette donnée ; on ne la publie pas.
- Le champ **« je cherche »** existe donc, mais il est **privé** : il sert au calcul des suggestions,
  il n'apparaît ni sur le profil, ni dans une notification, ni dans un partage.
- Ce qui s'affiche : « Homme · 34 ans · 5000 Namur » — l'identité déclarée et l'âge, rien de plus.
  Le genre lui-même reste **facultatif** (une case « je préfère ne pas le dire »).
- **Consentement explicite** = une case distincte à l'inscription, jamais pré-cochée, avec la phrase :
  « Vous indiquez ci-dessous ce que vous recherchez. Cette information est **privée** : elle sert à
  vous proposer des profils, elle n'est jamais affichée. » Le consentement est révocable, et sa
  révocation efface le champ.
- Aucune décision automatisée produisant un effet juridique : les suggestions ne décident de rien,
  c'est la personne qui écrit à qui elle veut parmi les profils qui lui sont montrés.

## 5. Le profil : champs, et ce qui n'y figure jamais

| Champ | Règle |
|---|---|
| Pseudo | 3 à 20 caractères, unique, obligatoire, sans nom de famille, sans chiffres d'année de naissance |
| Date de naissance | obligatoire, privée, sert seulement à vérifier 18+ et à afficher « 34 ans » |
| Genre | `femme` · `homme` · `non-binaire` · `je préfère ne pas le dire` |
| Ce que je cherche | **privé** (§ 4) : `femme` · `homme` · `non-binaire` · `tout le monde` |
| Commune | code postal + commune, **jamais l'adresse**, jamais la position GPS |
| Photos | **0 à 5** (facultatives, décision du 25/10/2026), **pré-modérées avant publication** ; le visage n'est jamais exigé |
| Présentation | 300 à 1 500 caractères, texte libre sans HTML, « Décrit par vous » |
| Ce que je ne veux pas | 3 cases fermées : tabac · animaux · sorties bruyantes (servent au filtrage, affichées seulement si remplies) |
| Langues | sélection dans une liste fermée |
| Centres d'intérêt | 3 à 10 étiquettes dans une liste fermée (lecture, sport, cuisine, musique, voyage, jeux, nature, culture, bénévolat, animaux…) |
| Situation | `célibataire` · `séparé·e` · `c'est compliqué` — jamais de mention de l'ex-conjoint |
| Enfants | `pas d'enfant` · `enfant(s)` — sans âge ni prénom |
| Profession | `secteur d'activité` seulement, liste fermée — **jamais le nom de l'employeur** |

**Ne figurent jamais dans un profil** (liste de non-régression) : nom de famille, adresse, téléphone,
e-mail, lien vers un réseau social, nom de l'employeur, nom de l'école des enfants, plaque
d'immatriculation, photo d'une autre personne (ex, ami, enfant), photo d'écran, coordonnées écrites
dans une image, « je cherche » (§ 4).

## 6. Découverte

- **Ce qui est montré** : une pile de profils suggérés, un par un, avec photo, pseudo, âge, commune,
  distance arrondie et trois étiquettes d'intérêt. Rien d'autre.
- **Un profil sans photo s'affiche quand même** (décision du 25/10/2026) : la carte montre le pseudo
  en grand sur un fond bleu nuit, l'âge, la commune et les étiquettes. **Jamais une silhouette barrée,
  jamais la mention « pas de photo »** : l'absence de photo n'est pas une faute à signaler.
- **Filtre « avec photo uniquement »** : c'est une **préférence de lecture** de la personne qui
  cherche, jamais une obligation d'écriture pour celle qui publie. La nuance est écrite dans l'écran.
- **Ce que la suggestion utilise** : ce que je cherche (privé), l'âge, la distance (curseur 0–50 km,
  même composant que `/immo` ; sa position la plus basse s'appelle **« Ma commune (0–2 km) »**), les
  intérêts communs. **Aucun critère d'origine, de religion, de handicap ou de santé** — ni dans les
  filtres, ni dans l'algorithme : ces critères sont protégés, et un filtre qui les propose est une
  discrimination outillée. **Aucune tranche d'âge** du type « 18–25 » / « 25+ » : une seule plage
  continue, bornée à 18 ans en bas (§ 16.2).
- **Actions** : *intéressé* · *passer* · *bloquer* (silencieux : la personne bloquée ne le sait pas).
  Trois refus consécutifs d'un même profil le font disparaître des suggestions.
- **Intérêt mutuel = conversation.** Aucun message ne peut être envoyé sans intérêt des deux côtés.
  C'est ce qui supprime 95 % du harcèlement et du spam.
- **Pas de compteur de visites**, pas de « qui m'a vu », pas de « profil mis en avant ».
- **Quota** : 30 profils par jour et par compte — au-delà, la pile se ferme jusqu'au lendemain. Un
  parcours illimité encourage le balayage et le comportement grossier.

## 7. Messages

- **Une conversation par paire**, ouverte par l'intérêt mutuel, fermable à tout moment.
- **Aucune pièce jointe, aucune image, aucun lien cliquable** en V1. Un lien dans un premier message
  est le vecteur n°1 de l'arnaque romantique ; une image est le vecteur n°1 du chantage.
- **Conservation 12 mois** après le dernier échange, puis effacement (durée du hub). Une conversation
  supprimée par les deux personnes disparaît immédiatement.
- **Signalement en un geste** depuis la conversation ; le blocage coupe l'envoi et masque le profil.
- **Pas de messagerie temps réel** en V1 (pas de « en train d'écrire », pas d'accusé de lecture) :
  ces signaux créent de l'attente et de la pression.
- Phrase affichée en haut de chaque nouvelle conversation : « Ne donnez jamais votre adresse, votre
  numéro ni de l'argent. Personne de sérieux ne vous le demandera. »

## 8. Anti-abus — le vrai danger de cette porte

Le risque n'est pas le profil grossier, c'est **le chantage et l'arnaque**, qui détruisent des gens.

1. **Aucune image dans la messagerie** (§ 7). On ne peut donc pas envoyer une photo intime, et on ne
   peut pas en réclamer une dans l'application. C'est la mesure la plus efficace, et elle est
   structurelle, pas un réglage.
2. **Bandeau permanent** : « Aucun versement, jamais. Un profil qui demande de l'argent, une carte
   cadeau, des cryptomonnaies ou un “investissement” est une arnaque — signalez-le. »
3. **Détection de motifs à l'envoi** : IBAN, numéro de compte, lien externe, « investis », « carte
   PCS », « bitcoin », « mon oncle notaire », « je suis bloqué à l'étranger » → le message n'est pas
   envoyé, la conversation affiche un avertissement, et le compte passe en contrôle humain.
4. **Faux profils** : photos déjà vues sur un autre profil (empreinte perceptuelle, comparaison
   interne, **aucune API externe**) → pré-modération. Comme **aucune photo n'est exigée** (§ 3),
   l'anti-faux-profil ne peut pas reposer sur le visage : un **compte de moins de 7 jours** passe en
   **pré-modération du texte**, et son profil porte la mention « compte récent ». On informe, on ne
   cache pas.
   > ⚠️ **Ce qui a été construit le 28/10/2026** : l'empreinte est **exacte** (SHA-256 des octets), pas
   > perceptuelle — sans décodeur d'image, un recadrage ou une recompression échappe à la comparaison.
   > Le même fichier déposé deux fois est signalé au modérateur ; le reste repose sur la relecture
   > humaine de **toutes** les photos. Écart assumé, détaillé au § 21.
5. **Mineurs** : âge déclaré < 18 = refus à l'inscription. Un profil signalé comme mineur est
   **masqué immédiatement**, avant toute vérification, puis retiré.
6. **Chantage à l'image** : le message d'avertissement (§ 7) et l'absence d'envoi d'images couvrent
   l'application. Ce qui se passe ensuite (WhatsApp, Snapchat) n'est plus de notre ressort — et on le
   dit dans la page « Sécurité » plutôt que de laisser croire à une protection totale.
7. **Un signalement de chantage coupe la conversation immédiatement**, des deux côtés, et gèle le
   compte signalé jusqu'à décision humaine.

## 9. Modération

- **Photos : pré-modération obligatoire** avant publication (24 h maximum, décision humaine).
  Refus : nudité, personne mineure, photo d'une autre personne, coordonnées dans l'image, capture
  d'écran, visage d'un tiers non consenti.
- **Texte du profil : publication immédiate** puis contrôle sous 24 h — sauf compte de moins de
  7 jours, pré-modéré (même règle que les trois premières annonces de `/immo`).
- **File unique** du hub, priorité haute pour les motifs *mineur*, *chantage*, *argent*.
- **Décisions** : garder · masquer · retirer · **bannir le compte** (propriétaire seulement).
  Journal : qui, quand, quel profil, quel motif, quelle pièce — 24 mois.
- **Promesse écrite à l'écran** : « signalement traité sous 24 h ». On ne promet pas l'instantané.
- **Pas de modération automatique du contenu intime** (aucun outil de reconnaissance d'images
  installé, aucune API) : c'est humain, et c'est assumé.

## 10. États et durées

```
brouillon (contrôle en cours — seulement s'il y a au moins une photo à pré-modérer)
  → publié (visible dans la découverte)
  → en pause (choisi par la personne, profil invisible, conversations conservées)
  → masqué (modération, motif affiché à la personne)
  → supprimé (par la personne, ou par la modération)
```

**Sans photo, il n'y a rien à pré-modérer** : un profil complet dont le texte est propre passe
directement à *publié* s'il provient d'un compte de plus de 7 jours. Aucune attente ne doit
apparaître comme le prix de l'absence d'image.

- **Suppression par la personne** : profil effacé immédiatement, conversations effacées, photos
  effacées. Le numéro de téléphone reste « consommé » **30 jours** pour empêcher la recréation
  immédiate d'un profil après un bannissement.
- **Inactivité** : 12 mois sans connexion → e-mail d'avertissement, puis suppression à 13 mois.
  Plus court que les 24 mois du hub, parce qu'un profil de rencontre oublié est une donnée sensible
  qui dort.
- **Bannissement** : profil et photos effacés, empreinte du numéro conservée 12 mois, journal 24 mois.
- **Signalement** : conservé 24 mois (preuve qu'on a agi), sans le contenu de la conversation
  supprimée.

## 11. Écrans

**Écran 1 — Découverte.** Une carte à la fois : photo, pseudo, âge, commune, distance, trois
étiquettes, deux boutons (*intéressé* / *passer*) et un menu discret (bloquer, signaler). Barre de
filtres : **plage d'âge continue 18–99** (aucune tranche), **distance** (curseur 0–50 km dont la
position basse s'appelle « Ma commune (0–2 km) »), intérêts, et « avec photo uniquement ». Aucun
compteur, aucune pression.

**Écran 2 — Un profil.** Photos en haut (défilement), pseudo, âge, commune, présentation, intérêts,
ce que la personne ne veut pas, bouton *intéressé*. Bloc sécurité permanent. **Aucun bouton de
partage** — exception explicite à la décision 28 du plan (§ 12).

**Écran 3 — Messages.** Deux colonnes : à gauche la **liste des conversations** (pseudo, début du
dernier message, heure, point orange pour un message non lu, badge « compte récent » quand c'est le
cas, ligne grisée « conversation fermée — vous avez bloqué ce profil ») ; à droite **le fil ouvert**
(bandeau d'avertissement anti-arnaque en tête, messages, entrée de texte sans trombone, mention « ni
pièce jointe, ni image, ni lien, ni accusé de lecture »). Trois boutons seulement : *Signaler*,
*Bloquer*, *Envoyer*. Aucun indicateur de lecture, aucun « en train d'écrire » (§ 7).

**Écran 4 — Mon profil.** Aperçu tel qu'il apparaît, modification, pause, suppression. Le champ
« je cherche » y porte la mention « privé ».

**Écran 5 — Sécurité.** Page d'aide : ce que Kazendra fait, **ce qu'elle ne peut pas faire**, les
quatre gestes avant un premier rendez-vous, la liste « Kazendra ne vous demandera jamais », et deux
encadrés (chantage, signalement). Texte de référence au § 18.

**Mobile (390 px).** Planche de quatre vues : découverte avec photo, découverte **sans aucune photo**
(la carte reste complète), profil (barre d'action collante, aucun partage), messages (fil ouvert avec
le bandeau). Le titre de la porte n'apparaît qu'une fois : la barre du haut porte la marque, l'en-tête
porte « Rencontres ».

## 12. Référencement et confidentialité

- **`noindex, nofollow`** sur tout `/rencontre` : aucun profil dans un moteur de recherche, aucun
  profil dans le plan de site. Un profil de rencontre qui remonte sur son nom est une catastrophe
  personnelle : c'est la première chose à tester.
- **Aucune page publique par profil** : tout est derrière la session. Pas d'URL partageable.
- **Exception assumée à la décision 28 du plan** (« un bouton de partage sur chaque fiche ») :
  **pas de bouton de partage sur un profil de rencontre.** Partager un profil, c'est publier la vie
  privée de quelqu'un sans son accord. La règle du hub s'arrête à la porte de `/rencontre`.
- **Tableau de bord** : la ligne « Rencontres » est **masquée par défaut** (déjà décidé le
  23/10/2026) — un compteur visible révèle la vie privée sur un écran familial.
- **Aucun traqueur**, aucune régie, aucun pixel de mesure : ici plus qu'ailleurs.

## 13. Prix

**Gratuit, pour tout le monde, sans exception.** `/rencontre` coûte cher en modération et ne rapporte
rien : elle se finance par les autres portes, et c'est un choix assumé depuis le 23/10/2026. Toute
tentative de monétisation (voir qui m'a liké, boost, abonnement) est refusée : elle créerait une
incitation à la frustration.

## 14. Cas limites

- **Deux profils avec la même photo** : le second passe en pré-modération, jamais de retrait
  automatique du premier.
- **Personne qui se présente comme quelqu'un d'autre** (photo d'une célébrité) : retrait sur
  signalement ; pas de reconnaissance faciale.
- **Personne qui demande à changer de pseudo** : possible une fois tous les 30 jours (empêche le
  contournement d'un blocage).
- **Blocage puis nouvelle inscription** : le numéro consommé 30 jours rend le contournement lent, pas
  impossible. On ne prétend pas l'empêcher.
- **Conversation ouverte puis profil supprimé** : la conversation disparaît des deux côtés.
- **Profil en pause** : invisible dans la découverte, conversations conservées, aucune notification
  envoyée aux correspondants.
- **Photo refusée** : la photo est retirée avec son motif, **le profil reste publié** — on ne bloque
  pas un profil à cause d'une image, puisque aucune image n'est exigée (§ 3).
- **Personne qui écrit « j'ai 17 ans » dans sa présentation** : masquage immédiat + contrôle.
- **Pays hors zone euro** : aucun prix, donc aucun problème de devise — un des rares avantages de la
  gratuité.

## 15. Speed dating vidéo — hors V1, mais déjà mesuré

Décision du 25/10/2026 : on le traite **plus tard**, comme un objet séparé (des créneaux, pas une
fonction du profil). Trois choses ont déjà été vérifiées, pour ne pas les redécouvrir :

1. **Faisable sans tiers ni clé** : la caméra s'ouvre dans le navigateur et la vidéo passe en direct
   d'un téléphone à l'autre (WebRTC). Deux conditions techniques sourcées/ mesurées : `getUserMedia`
   exige un contexte sécurisé HTTPS (MDN, consulté le 25/10/2026), et la box a une **adresse publique
   réelle** (relevé du 25/10/2026 : `178.51.228.221`, hors plage CGNAT), ce qui permet d'héberger le
   relais chez l'utilisateur.
2. **Un relais (TURN) sera nécessaire** pour la minorité de connexions qui échouent en direct (deux
   réseaux mobiles fermés). Sans lui, ces rendez-vous ne se connectent jamais et c'est vécu comme un
   bug.
3. **Aucun enregistrement, jamais** : stocker ces images serait indéfendable. Flux éphémère, et
   l'écran doit dire que l'autre peut filmer avec un second appareil — on ne peut pas l'empêcher.

## 16. Questions ouvertes — **toutes tranchées le 25/10/2026**

Les quatre questions de cadrage sont fermées. Elles sont écrites ici avec leur raison, pour qu'on ne
les rouvre pas dans trois semaines sans se souvenir pourquoi elles l'ont été.

1. ✅ **Photos — entièrement facultatives.** Verbatim de l'utilisateur : « *Une photo ne doit pas être
   obligatoire, utilisateur peut mettre une annonce sans photo.* » Un profil se publie avec **zéro
   photo** et apparaît quand même dans la découverte (§ 6) : la carte affiche le pseudo en grand,
   jamais une silhouette barrée. Le premier réflexe (« visage facultatif mais photo obligatoire »)
   était une demi-mesure ; elle est abandonnée. **Ne pas reposer la question.**
   Ce qui protège, à la place : pré-modération du texte des comptes récents, intérêt mutuel
   obligatoire avant tout message, signalement sous 24 h, et le filtre « avec photo uniquement »
   laissé au choix de celui qui cherche.

2. ✅ **Âge — 18 ans fermes, et un seul réglage : la plage continue.** Pas de tranches « 18–25 » /
   « 25+ », ni en filtre, ni en affichage. Raisons : une tranche est une coupure arbitraire qui ne
   sert qu'à exclure (elle parquerait les étudiants d'un côté et « les autres » de l'autre) ; et elle
   **protège moins qu'elle n'en a l'air**, puisque l'âge exact est déjà affiché (« 34 ans »). L'écran
   ne propose donc que la **plage 18–99**, bornée à 18 en bas, jamais en dessous. Un profil déclaré
   mineur est refusé à l'inscription, et un profil signalé comme mineur est masqué immédiatement
   (§ 8.5). **Ne pas reposer la question.**

3. ✅ **Distance — pas de mode « ma commune seulement ».** Le curseur existant (0–50 km) le fait déjà,
   et mieux : sa position la plus basse est étiquetée **« Ma commune (0–2 km) »** et donne exactement
   le résultat demandé. Un interrupteur séparé ajouterait un ciblage hyperlocal (commune + distance +
   centres d'intérêt = un quartier, puis une rue), alors que le hub s'interdit la position exacte
   (§ 2). Une seule commande, une seule valeur, aucune ambiguïté. **Ne pas reposer la question.**

4. ✅ **Vérification du visage — refusée, en V1 et au-delà.** Un contrôle de vivacité (« bougez la
   tête devant la caméra ») est un **traitement biométrique** : il compare un gabarit de visage à une
   photo, ce qui en fait une donnée à part (art. 9 RGPD), avec consentement explicite et analyse
   d'impact à la clé. Nous refusons de détenir cela, comme nous refusons les cartes d'identité (§ 2) :
   aucun outil installé, aucune API tierce, et le badge affiché promettrait une garantie qu'on ne
   pourrait pas tenir (une photo volée passe le contrôle si la personne filmée est la bonne… ou si le
   gabarit est celui d'un autre). **Ne pas reposer la question**, y compris « juste pour les profils
   sans photo » : ce serait la même donnée, sur les personnes les plus exposées.
   Ce qui protège à la place : badge **« compte récent »** pendant 7 jours + pré-modération du texte,
   détection interne des photos déjà vues (empreinte perceptuelle, aucun tiers), intérêt mutuel, et
   signalement sous 24 h.

## 17. Ce qui reste à produire pour clore cette porte

- [x] Spécification complète, avec la donnée sensible sourcée et datée (§ 4)
- [x] Maquettes : découverte + profil (deux écrans, 1440 px) — `maquettes/rencontre.html`,
      captures `rencontre-decouverte.png` et `rencontre-profil.png`
- [x] Maquette de la messagerie : liste des conversations + fil ouvert — capture
      `rencontre-messages.png` (contrôle par programme : 0 texte coupé, 0 débordement horizontal,
      **0 bouton de partage** sur les quatre écrans, 0 erreur JS)
- [x] Planche mobile 390 px — `maquettes/rencontre-mobile.html`, capture
      `rencontre-mobile-390.png` : découverte avec photo, découverte **sans photo**, profil, messages
      (4 vues ; 0 contenu coupé, 0 débordement, barre collante sur le profil)
- [x] Page « Sécurité » rédigée et maquettée — § 18, capture `rencontre-securite.png`
- [x] **Les quatre questions du § 16 sont tranchées** (photos facultatives · plage d'âge continue,
      pas de tranches · pas de mode « ma commune », le curseur le porte · pas de vérification
      biométrique du visage). Le modèle de données peut être écrit sans arbitrage restant.
- [ ] Speed dating vidéo : **hors périmètre de cette version** (§ 15), à rouvrir comme objet séparé
      quand les profils et la modération tournent — ce n'est pas un manque de cette porte.

## 18. Page « Sécurité » — texte de référence

Cette page est **publique** (elle ne demande pas de compte) et se trouve dans `/rencontre/aide/securite`.
Elle est le contrepoids de ce que la porte ne peut pas faire : une plateforme qui laisse croire qu'elle
protège totalement rend service à l'agresseur. Trois règles d'écriture, non négociables :

1. **Aucune promesse absolue** : jamais « 100 % sûr », jamais « vérifié », jamais « protégé ». On écrit
   ce qui est fait, et à côté ce qui ne l'est pas.
2. **Ce que nous ne pouvons pas faire est écrit noir sur blanc**, au même niveau de police que le
   reste — pas en bas de page, pas en petits caractères.
3. **Aucun chiffre inventé.** Pas de « 9 arnaques sur 10 », pas de « 90 % des faux profils » : ces
   chiffres n'ont pas de source et nous n'en fabriquons pas (§ 3, note sur le chiffre retiré).

### 18.1 Ce que Kazendra fait

- **Aucune image ne peut être envoyée** dans la messagerie — ni par vous, ni par l'autre. On ne peut
  donc pas vous en réclamer une, et une photo intime ne peut pas sortir d'ici.
- **Aucun message sans intérêt mutuel** : personne ne peut vous écrire sans que vous ayez dit oui.
- **Les demandes d'argent sont bloquées à l'envoi** : IBAN, lien de paiement, carte cadeau,
  cryptomonnaie, récit d'urgence. La conversation passe en contrôle humain.
- **Un signalement est traité sous 24 h.** Un signalement de chantage coupe la conversation des deux
  côtés immédiatement.
- **Bloquer est silencieux** : la personne n'est pas prévenue et ne peut plus écrire.
- **Votre profil n'est jamais public** : ni indexé, ni partageable ; le champ « je cherche » reste
  privé.
- **Supprimer votre profil** efface immédiatement vos photos et vos conversations.

### 18.2 Ce que Kazendra ne fait pas — et ne peut pas faire

- **Nous ne vérifions pas l'identité.** « Identité déclarée, non vérifiée » est écrit sur chaque
  profil : une photo peut être celle de quelqu'un d'autre.
- **Nous ne prouvons pas l'âge.** Nous demandons une date de naissance et nous retirons sur
  signalement. Nous ne détenons pas de cartes d'identité — choix assumé (§ 2).
- **Nous ne lisons pas vos conversations.** La modération ne voit que ce que vous signalez.
- **Nous ne voyons rien de ce qui se passe ailleurs.** Dès que la conversation continue sur WhatsApp,
  Snapchat ou par SMS, Kazendra n'a plus aucune prise et ne peut plus rien bloquer.
- **Nous ne pouvons pas effacer ce que l'autre a déjà copié ou photographié.** Une image envoyée est
  dehors pour toujours.
- **Nous n'enregistrons aucun appel vidéo** (il n'y en a pas en V1). Mais l'autre peut filmer avec un
  second appareil : nous ne pouvons pas l'empêcher, et nous le disons.
- **Nous ne sommes pas la police.** Nous pouvons retirer un profil ; nous ne poursuivons personne.

### 18.3 Avant un premier rendez-vous — quatre gestes

1. **En journée, dans un lieu public** : un café, une place, un marché. Ni chez l'un, ni chez l'autre.
2. **Prévenez quelqu'un** : donnez le lieu et l'heure à une personne de confiance, avant d'y aller.
3. **Vos propres moyens** : vous arrivez et vous repartez par vous-même, téléphone chargé.
4. **Aucun argent, jamais** : ni pour un billet, ni pour un train, ni « parce que l'essence ». Un
   premier rendez-vous ne coûte rien à personne.

### 18.4 « Kazendra ne vous demandera jamais… »

votre mot de passe, ni le code SMS reçu · une photo de votre carte d'identité · de l'argent, une carte
cadeau ou des cryptomonnaies · d'installer un logiciel ou d'ouvrir un lien de connexion · de déplacer la
conversation vers une autre application · de garder la conversation secrète, même « pour vous protéger ».

### 18.5 Les deux encadrés de bas de page

- **Si vous êtes victime de chantage** : « Ne payez pas. Payer ne fait jamais cesser un chantage :
  cela prouve seulement que vous payez. Gardez les preuves — captures, messages, profil — signalez le
  profil, puis portez plainte auprès de la police locale : c'est la seule voie qui puisse mener à une
  identification. Enfin, parlez-en à quelqu'un. La honte est l'arme de l'agresseur, pas la vôtre. »
- **Signaler, concrètement** : le bouton se trouve sur chaque profil et en haut de chaque
  conversation ; motifs fermés (argent · personne mineure · photo qui n'est pas la sienne · insultes et
  harcèlement · autre) + une phrase libre ; **la personne signalée ne sait jamais qui a signalé** ;
  traitement sous 24 h ; en cas de danger immédiat, les secours (112 en Belgique) — « Kazendra n'est
  pas un service d'urgence ».

### 18.6 Mention de bas de page

« Cette page ne remplace ni la loi ni un conseil juridique. Kazendra affiche des profils et permet une
conversation : elle n'organise pas les rencontres et ne garantit pas les intentions de qui que ce soit.
Dernière mise à jour : … »

> ⚠️ Le renvoi au 112 est un fait vérifiable et stable (numéro d'urgence européen). En revanche,
> **aucune adresse de service de signalement n'est citée** dans cette page : une URL d'autorité
> inventée serait pire que pas d'URL du tout. Si une adresse officielle doit être ajoutée (police,
> point de contact pour la sécurité en ligne), elle est relevée à la source et datée avant publication.

---

## 19. État de la porte — **CLOSE le 25/10/2026**

`/rencontre` est cadrée : 18 sections de spécification, quatre écrans en 1440 px (découverte, profil,
messages, sécurité — plus les variantes sans photo), une planche mobile 390 px de quatre vues, le texte
intégral de la page « Sécurité », et **zéro question ouverte**.

Ce qui a été vérifié par programme et non à l'œil, sur les deux maquettes :

| Contrôle | Résultat |
|---|---|
| Texte coupé / débordement horizontal | 0 sur les écrans ordinateur, 0 sur les 4 vues mobiles |
| Bouton de partage présent | **0** — l'exception de la décision 28 tient |
| Erreurs JavaScript | 0 |
| Contenu coupé sur mobile | 0 px |
| Barre d'action collante sur le profil mobile | présente |

Ce qui n'est **pas** fait, et qu'il ne faut pas confondre avec un oubli : le speed dating vidéo (§ 15,
décision explicite : plus tard), et la construction du code — aucune base, aucun serveur, aucune
authentification n'existe encore pour cette porte.

**On ne passe pas à `/job-etudiant` avant que celle-ci soit close.** Elle l'est.

> **Réouverture ponctuelle du 25/10/2026** : l'utilisateur a demandé un système de rencontre le jour
> même (cinéma, restaurant). Traité en **forme A uniquement** — la sortie se greffe sur un événement
> et le mécanisme complet vit dans `SPEC-EVENEMENT.md` § 23 (§ 20.6 ci-dessous). La porte `/rencontre`
> reste close pour son propre périmètre : aucun de ses écrans ne change, aucun de ses arbitrages ne
> bouge.

---

## 20. Sortie le jour même — demande du 25/10/2026 (**TRANCHÉE : forme A**) 

Demande de l'utilisateur : « *un système de rencontre le jour même en fonction des activités et de
l'envie du jour par exemple cinéma restaurant et que les gens se trouvent grâce à un événement qu'ils
ont envie de faire en commun* ».

**Réponse courte : oui, c'est possible — et c'est la fonction la plus dangereuse du hub.** Ce n'est pas
un réglage à ajouter : c'est un changement de nature de la porte. Le parcours actuel est *profil →
intérêt mutuel → conversation*. Ici il devient *intention → rencontre dans quelques heures*. Trois
règles déjà écrites s'y opposent frontalement : pas de position exacte (§ 2), pré-modération à 24 h
pour les comptes récents (§ 9) — incompatible avec « ce soir » —, et « aucun message sans intérêt
mutuel » (§ 7), alors qu'une proposition de sortie est une diffusion.

### 20.1 Deux formes possibles

**A. Greffe sur `/evenement` (recommandée).** Sur chaque fiche d'événement, un bouton « y aller à
plusieurs » ouvre une proposition de groupe (2 à 6) pour **cet** événement, parmi les personnes
intéressées de la même commune. Ce qui est réutilisé : un objet **déjà modéré**, un lieu **déjà
public**, une date **déjà saisie**. Ce qu'il reste à modérer : un texte court de proposition.
Bonus décisif : la greffe n'a pas besoin de masse critique — la fiche d'événement existe déjà.

**B. Porte séparée « Sorties du jour ».** Proposition libre (cinéma, restaurant, balade, expo) avec
une fenêtre de 24 h. Plus souple, mais c'est **un tableau public d'intentions du soir** : diffusion en
temps réel de qui veut sortir, où et quand — exactement ce que la porte s'interdit. Et sans masse
critique, le tableau est vide : à 148 profils sur 20 km, deux propositions par jour au mieux, donc
l'écran donne l'impression que la porte est morte.

### 20.2 Contraintes non négociables — **version retenue (forme A)**

Ces règles sont celles qui s'appliquent au bloc greffé ; elles sont détaillées dans
`SPEC-EVENEMENT.md` § 23.

1. **Lieu public uniquement, aucune adresse ajoutée.** Le point de rendez-vous est celui de
   l'événement, déjà public (« devant l'entrée »). Corollaire : **une sortie est impossible sur un
   événement à adresse privée**, sinon le rendez-vous serait l'adresse de quelqu'un.
2. **Groupe de 2 à 6**, jamais un tête-à-tête improvisé ; « 2 » est libellé « en duo ». Le duo
   ordinaire reste dans `/rencontre`, après intérêt mutuel.
3. **Aucune somme d'argent** : pas de « tu paies ma place », pas d'acompte. IBAN, lien de paiement,
   carte cadeau et cryptomonnaie bloqués à l'envoi, comme partout (§ 8.3 de cette spec).
4. **Une seule sortie active par compte**, expiration automatique à la fin de l'événement.
5. **Âge de compte** : proposer ≥ 30 jours, rejoindre ≥ 7 jours, téléphone vérifié. Sans cela, la
   fonction est une porte ouverte aux comptes créés dans l'après-midi.
6. **Annulation en un geste**, notifiée à tout le groupe, sans justification à donner.
7. **Jamais de « je suis sur place »**, jamais de position, même entre deux personnes du groupe.
8. **Aucun rendez-vous après le début de l'événement** : les trois choix d'heure sont tous avant ou à
   l'ouverture, donc la sortie ne devient jamais « on repart ensemble à 2 h du matin ».

### 20.3 La dépendance technique : la notification — **tranchée**

Une fonction « ce soir » sans alerte immédiate ne sert à rien — personne ne rafraîchit un écran toutes
les dix minutes. Or la notification web sur Chrome/Android passe par le service de poussée de Google
(FCM) : **c'est un tiers, même gratuit**, ce qui contredit la règle « aucune API tierce ».

Décision appliquée (`SPEC-EVENEMENT.md` § 23.7) : **e-mail immédiat + badge dans l'application** comme
canal par défaut ; **SMS via OVH uniquement en option** (sortie confirmée commençant dans moins de
6 h), avec un **plafond mensuel en réglage**. Reste à faire avant d'ouvrir l'option : relever le tarif
SMS dans la grille OVH. Aucun budget n'est promis avant ce relevé.

### 20.4 Ce que ça ne résout pas

Aucun logiciel n'empêche une agression. Ce qui protège réellement, c'est le **groupe**, le **lieu
public**, **aucun argent**, la **possibilité d'annuler** et les quatre gestes de la page Sécurité
(§ 18.3). Le reste — vérification d'identité, badge, réputation — n'a jamais empêché un passage à
l'acte.

### 20.5 Recommandation

**Forme A d'abord** (greffe sur `/evenement`), qui coûte peu, réutilise du contenu modéré et ne
fabrique pas un nouveau tableau d'intentions. La forme B seulement après que la modération ait tourné
sur des données réelles — pas avant.

### 20.6 ✅ TRANCHÉE le 25/10/2026 — **forme A uniquement**

Décision de l'utilisateur : « *Ok on part sur l'idée A uniquement* ».

- **La sortie se greffe sur une fiche d'événement** ; elle n'existe nulle part ailleurs.
- **La forme B est abandonnée** : aucun écran ne liste « qui veut sortir ce soir », ni demain.
- La spécification complète du mécanisme (seuils de compte, champs fermés, fil de groupe,
  modération de compromis, notifications, états, cas limites, ce que ça ne couvre pas) vit dans
  **`SPEC-EVENEMENT.md` § 23** — c'est cette porte qui héberge le bloc, pas `/rencontre`.
- La catégorie **`cinema`** a été ajoutée à `/evenement` (§ 4 de la spec) pour que l'exemple
  « cinéma » de la demande soit réellement couvert.
- Maquette : `maquettes/evenement.html`, écran 3 — capture `evenement-sortie.png`.

**Conséquence à assumer, écrite pour ne pas la découvrir plus tard** : avec la forme A seule,
« resto pour deux ce soir » n'est **pas** couvert. Il faut qu'un événement existe (catégorie `gout` :
table d'hôte, dégustation, repas de quartier) pour qu'une sortie s'y accroche. Si l'utilisateur veut
un jour le « resto sans événement », ce sera la forme B — donc une décision nouvelle, pas une
simplification de A.

Cette porte reste close par ailleurs : les quatre arbitrages du § 16 tiennent, et le speed dating
reste hors périmètre (§ 15).

---

## 21. Application construite — 28/10/2026

La porte n'est plus seulement cadrée : elle est **écrite, branchée et exercée**. Ce qui suit est l'état
réel, avec ses écarts. Le détail des décisions de socle est au § 13 de `kazendra/SPEC-SOCLE.md`.

**Où vit le code** : `projects/kazendra` (une base, un compte, huit portes).
`socle/rencontre.mjs` (règles), `public/rencontre.html` (découverte), `rencontre-fiche.html` (un
profil), `mon-profil-rencontre.html`, `messages-rencontre.html`, `rencontre-securite.html`.

**Ce qui est tenu, et vérifié par une épreuve** :

- **« Je cherche » ne sort d'aucun profil public** — l'épreuve lit les **clés** de l'objet servi, pas
  le texte ; ni `cherche`, ni `naissance`, ni `nom_affiche`, ni `email`, ni `tel`.
- **Consentement daté** (`porte_rencontre.consentement_le`) : sans la case, « je cherche » n'est pas
  enregistré ; la révocation efface la valeur **et** la date.
- **18 ans fermes**, pseudo qui n'est pas un nom, présentation sans coordonnées, ni lien, ni HTML.
- **Publication immédiate** sans photo pour un compte ancien ; `en_attente` **avec sa raison** sinon.
- **Photo jamais servie avant décision** (404 pour tous, sauf propriétaire et modérateur) ; un refus
  laisse le profil publié.
- **Quota 30/jour** consommé à la carte **servie**, jamais deux fois le même profil le même jour.
- **Conversation = intérêt mutuel** ; **aucun lien**, aucun IBAN, carte cadeau, crypto, récit
  d'urgence dans un message → 422 + contrôle humain ; la route générique de la messagerie **refuse**
  un fil de rencontre.
- **Boîte et fil affichent le pseudo**, jamais le nom du compte.
- **« mineur » masque immédiatement**, **« chantage » coupe des deux côtés**.
- **Suppression** : profil, photos, conversations effacés ; numéro **consommé 30 jours** (409).
- **`noindex` sur les cinq pages** — dont la fiche d'un profil, `/rencontre/profil/<id>` — et sur les
  photos ; aucun bouton de partage ; aucun profil indexable ni partageable.
- **Trois guichets de modération** comptés dans la file : profils, photos, contrôles anti-arnaque.

**Chiffres mesurés** : `tests/rencontre.test.mjs` **32/0** · `tests/epreuve-rencontre.mjs` **46/0**
(serveur réel) · `tests/moderation.test.mjs` **15/0** · `outils/audit-rencontre.sh` **78 verdicts,
0 défaut**, **12 captures** à 1440 et 390 px · suite Node entière **495/0** · `epreuve-http.sh`
**485/0** · `epreuve-promo.sh` **55/0** · `epreuve-tls.sh` **25/0**.

**La barre d'action du profil est réellement collante** sur téléphone : l'audit **défile d'abord**,
puis mesure (`position: sticky`, `bas=456 px` sur 844). Mesurée en haut de page, elle serait visible
de toute façon et l'épreuve ne prouverait rien. La promesse du § 19 est tenue par le code, pas
seulement par la maquette.

**Écarts assumés, écrits pour ne pas les redécouvrir** :

1. **Empreinte de photo exacte, pas perceptuelle** (§ 8.4). Sans décodeur d'image ni dépendance, on
   compare les octets. Ce qui protège à la place : relecture humaine de toutes les photos, badge
   « compte récent », intérêt mutuel, signalement.
2. **L'avertissement d'inactivité n'est pas envoyé** : le canal courriel n'est pas branché sur cette
   installation. La règle des 12/13 mois est appliquée (journalisée), le message ne part pas.
3. **Le speed dating vidéo reste hors périmètre** (§ 15) — décision du 25/10, inchangée.
4. **Aucune notification de nouveau message** : la boîte s'interroge toutes les 20 s.
5. **« Couper la conversation » se fait par deux blocages silencieux** : personne ne peut plus écrire,
   la trace reste lisible pour le signalement. Supprimer les messages aurait effacé la preuve.

**Ce qui reste à faire, et qui n'est pas un oubli** : brancher le canal courriel (l'avertissement
d'inactivité et les notifications), et — si l'utilisateur le demande — l'empreinte perceptuelle avec
un décodeur embarqué.

---

## 22. Revue de code indépendante — 28/10/2026

La porte a été relue par trois regards neufs (module métier, routes HTTP et schéma, écrans), sans
contexte de sa construction et avec exécution de preuves sur base SQLite. Les épreuves étaient vertes :
ce que cette revue a trouvé ne pouvait pas l'être par elles, parce que **les épreuves décrivaient le
comportement attendu, et le comportement était faux**.

### Corrigé le jour même

1. **`reprendre` republiait sans revérifier (bloquant).** `reprendreProfil` écrivait `etat='publie'`
   sans repasser par les règles. « pause » puis « reprendre » publiait donc un profil de 16 ans, ou un
   profil dont le consentement venait d'être retiré — **la pré-modération de la porte était
   contournable en deux requêtes**, par n'importe quel compte. `reprendre` ne fait plus que lever la
   pause : il appelle `publierProfil`, qui revérifie l'âge, le consentement, les photos et le compte
   récent, et remet en relecture si nécessaire.
2. **`deciderProfil` publiait n'importe quel profil (sérieux).** La décision de publication ne
   vérifiait pas que le profil était `en_attente` : un `brouillon` jamais soumis sortait publié, en
   sautant âge, consentement et commune. La décision exige désormais l'attente et les invariants ;
   seul le caractère « compte récent » est levé par l'humain qui a lu le texte.
3. **Un `motif` envoyé en tableau contournait le masquage « mineur » (sérieux).** La validation
   normalisait (`net`), les comparaisons testaient la valeur brute : `motif: ["mineur"]` passait la
   liste sans masquer le profil. Le motif est normalisé une fois, en entrée.
4. **« Ma commune » ne filtrait rien (sérieux).** `Number(distance) || DISTANCE_MAX` faisait de `0`
   — la valeur du curseur pour « ma commune (0–2 km) » — la distance maximale : **50 km**. Le filtre
   le plus utilisé de la porte affichait toute la Belgique. Zéro vaut maintenant 2 km, nommément.
5. **Le consentement survivait à la suppression.** `supprimerProfil` mettait `cherche` à NULL en
   laissant la DATE : une recréation sans case cochée était acceptée, et l'écran réaffichait
   l'ancienne date comme preuve. La date part avec la donnée.
6. **L'expiration pour inactivité bannissait le numéro.** Supprimer un profil après treize mois
   consommait l'empreinte du téléphone 30 jours : revenir affichait « ce numéro a servi à un profil
   supprimé récemment ». L'expiration n'est pas une sanction, elle ne consomme plus rien.
7. **Trois valeurs insérées sans échappement** dans des `innerHTML` (compteur de quota, non-lus d'une
   conversation, valeur d'une pastille d'intérêt) — numériques, mais rien ne le garantissait côté
   client. Échappées.
8. **Quatre `.catch(() => {})`** dans la découverte : un 429 (quota) ou un 500 laissait la carte
   précédente à l'écran, sans un mot. L'écran dit désormais l'échec.
9. **Les écrans étaient indexables par leur nom de fichier.** Servis par leur route, ils portent
   `X-Robots-Tag` ; servis par le statique (`/rencontre.html`), ils n'en avaient aucun.
10. **La page Sécurité se contredisait sur les conversations** : « La modération ne voit que ce que
    vous signalez », alors qu'un message bloqué par le filtre part en contrôle avec son extrait.
    La phrase dit maintenant les deux cas — c'est la page dont l'argument est de ne pas mentir.

Six épreuves ont été ajoutées sur ces points (`tests/rencontre.test.mjs`), parce qu'un défaut trouvé
sans contrôle revient : reprise qui ne lève pas une relecture, reprise refusée après retrait du
consentement, décision sur un brouillon refusée, motif en tableau, distance zéro à 2 km, date de
consentement effacée.

### Reste ouvert, nommé, non corrigé — décisions à prendre

- **Le quota ne coûte rien hors de la pile.** `profilPublicParId` et `marquerInteret` ne comptent
  aucune vue : ouvrir des fiches par leur identifiant ou marquer des intérêts en série n'est pas
  limité par les 30/jour, qui ne bornent que la découverte. À trancher : compter une vue à l'ouverture
  d'une fiche, ou assumer que le quota ne porte que la pile.
- **« Je cherche » est déductible en deux requêtes** en changeant son propre genre : la suggestion
  croise réciproquement les orientations, et le genre est librement modifiable. C'est le prix du
  matching réciproque ; le réduire demande du bruit volontaire, donc une décision de produit.
- **`reste_autres` est un oracle de dénombrement** : il rend le nombre exact de profils correspondant
  à des filtres arbitraires, ce qui permet de compter une population et, par bissection sur la
  distance, de situer quelqu'un. Un booléen « d'autres existent » suffirait à l'écran.
- **Un compte sans profil peut masquer n'importe quel profil** d'un signalement « mineur », sans
  preuve ni limitation de débit sur les signalements.
- **Défauts mineurs connus** : index manquant sur `messages(auteur_id, cree_le)` (envoi de message),
  corps JSON `null` → 500 au lieu de 400, `enregistrerProfil` écrit avant de valider (pas de
  transaction), `rencontre_vues`/`rencontre_passages` jamais purgés, un seul « passer » écarte un
  profil 30 jours alors que la règle annonce trois passages consécutifs, date de naissance complète
  dans la file de modération (l'âge suffirait), et plusieurs routes d'écriture sans limitation de
  débit.
