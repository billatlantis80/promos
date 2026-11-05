# Votre relais — la marche à suivre

Objectif : quand quelqu'un s'inscrit sur le site, son adresse e-mail arrive
**dans une feuille de calcul Google, sur votre compte**. Et quand quelqu'un
visite le site ou sort vers un marchand, le relevé arrive **dans la même
feuille** — c'est lui qui alimente les onglets **Trafic** et **Affiliation** du
panneau d'administration. Personne d'autre ne les voit : ni nous, ni un
prestataire, ni un traqueur. Aucune clé d'API, aucun abonnement, aucun coût.

Comptez **10 minutes**. Faites-le une seule fois.

> **Ce qui se passera tant que ce n'est pas fait** : le formulaire est là, mais
> l'adresse **ne part nulle part** — et le message le dit clairement : « Le
> tableau n'est pas encore branché : ton adresse n'a pas été envoyée. » Rien
> n'est jamais annoncé à tort. Et le panneau d'administration dira, dans
> l'onglet Trafic : **« Relais non branché »** — il n'affichera pas des zéros à
> la place des chiffres, parce qu'un zéro a l'air d'une mesure.
>
> Depuis le 11/10/2026, **aucun compte n'est créé** : ni sur l'appareil, ni en
> ligne. L'inscription EST l'abonnement à la newsletter, et rien d'autre — c'est
> la décision de B : « il n'y a pas de connexion. il y a juste une adresse mail
> qui est donné pour recevoir la newsletter. »

---

## Ce que le relais reçoit, exactement

| ce qui arrive | quand | ce que ça permet |
|---|---|---|
| **une inscription** | quand quelqu'un remplit le formulaire | la feuille `Inscriptions` : l'adresse, la langue, le pays, le consentement |
| **une visite** | à chaque ouverture du site, **une fois par session** | les onglets Trafic : combien de visiteurs, quel jour, par où ils sont arrivés |
| **une sortie** | à chaque clic vers un marchand, et à chaque partage | le bloc des gains : combien de redirections, vers quel marchand |

**Ce qui n'y arrive JAMAIS** : aucune adresse IP, aucun identifiant d'appareil,
aucun témoin publicitaire, aucune donnée personnelle. Une visite, c'est : un
pays consulté, une langue, une porte d'entrée, un appareil, un **fuseau
horaire** (une région, jamais quelqu'un) et une heure. Une sortie, c'est : le
marchand visé et l'heure.

---

## Étape 1 — Créer la feuille

1. Allez sur **sheets.new** (tapez-le dans la barre d'adresse).
2. Google ouvre une feuille de calcul vide. En haut à gauche, cliquez sur
   **« Feuille de calcul sans titre »** et tapez : `Kazendra — inscriptions`.
3. C'est tout. **Ne créez aucune colonne à la main** : le script s'en charge —
   et il créera lui-même les deux feuilles de trafic au premier relevé.

## Étape 2 — Ouvrir l'éditeur de script

1. Dans le menu du haut, cliquez sur **Extensions**.
2. Cliquez sur **Apps Script**.
3. Un nouvel onglet s'ouvre sur un éditeur de code, avec une fonction vide
   nommée `myFunction`.

## Étape 3 — Coller le code

1. Dans l'éditeur, **sélectionnez tout** le texte affiché (Ctrl+A, ou ⌘+A sur
   Mac) et **supprimez-le**.
2. Ouvrez le fichier `outils/tableau-inscription.gs` de votre projet, copiez
   **tout** son contenu, et collez-le dans l'éditeur.
3. En haut, cliquez sur l'icône **disquette** (« Enregistrer le projet »).
4. À gauche, cliquez sur **« Projet sans titre »** et renommez-le :
   `Tableau inscriptions Kazendra`. Puis enregistrez encore une fois.

## Étape 4 — Mettre le script en ligne

1. En haut à droite, cliquez sur le bouton bleu **Déployer**, puis
   **Nouveau déploiement**.
2. À gauche de la fenêtre qui s'ouvre, cliquez sur la **roue dentée** et
   choisissez **Application web**.
3. Remplissez les deux listes :
   - **Description** : `Tableau Kazendra`
   - **Exécuter en tant que** : **Moi** ← important
   - **Qui a accès** : **Tout le monde** ← important
4. Cliquez sur **Déployer**.

> **Pourquoi « Tout le monde » ?** Ce n'est pas une ouverture de vos données :
> personne ne peut lire la feuille. C'est seulement l'autorisation, pour un
> visiteur du site, de **déposer** une adresse. Sans cela, Google refuse l'envoi.

## Étape 5 — Autoriser (l'écran qui fait peur, à tort)

Google va afficher un avertissement. C'est normal : le script est le vôtre, il
n'est simplement pas « vérifié » par Google comme le serait une application
commerciale.

1. Cliquez sur **Autoriser l'accès**.
2. Choisissez votre compte Google.
3. Un écran dit **« Google n'a pas validé cette application »**. Cliquez sur
   **Paramètres avancés** (en bas à gauche), puis sur
   **« Accéder à Tableau inscriptions Kazendra »**.
4. Cliquez sur **Autoriser**.

## Étape 6 — Récupérer l'adresse

1. Après le déploiement, une fenêtre affiche une **adresse web** qui se termine
   par `/exec`. Cliquez sur **Copier**.
   - Si vous l'avez fermée : **Déployer** → **Gérer les déploiements** → l'adresse
     est sous le nom du déploiement.
2. Elle ressemble à :
   `https://script.google.com/macros/s/AKfycb…/exec`

## Étape 7 — La brancher (une seule ligne à changer)

1. Ouvrez le fichier **`public/relais.js`** du projet.
2. Tout en haut, trouvez la ligne :
   ```js
   export const URL_RELAIS = '';
   ```
3. Collez votre adresse **entre les deux apostrophes**, sans espace :
   ```js
   export const URL_RELAIS = 'https://script.google.com/macros/s/AKfycb…/exec';
   ```
4. Enregistrez, puis republiez le site.

> **Une seule ligne, un seul endroit — et c'est une correction.** Avant le
> 12/10/2026, l'adresse de l'inscription vivait dans `inscription.js` et celle du
> trafic dans le **stockage local du navigateur**. Conséquence mesurée : un
> visiteur n'a jamais la valeur du stockage local, donc **aucun relevé de visite
> ne partait**, et le panneau pouvait afficher « relais branché » en ne
> recevant rien. Il n'y a plus qu'une adresse, elle est **publiée avec le site**,
> et tous les relevés — inscriptions, visites, clics — passent par elle.

## Étape 8 — Récupérer la clé de lecture (le seul secret)

Le service est ouvert « à tout le monde » : il le faut, un visiteur doit pouvoir
**déposer** son relevé. Mais **lire** le rapport, c'est voir votre trafic. Sans
clé, le relais refuse — et cette clé n'est écrite nulle part dans le site.

1. Dans l'éditeur Apps Script, en haut, la liste des fonctions : choisissez
   **`test`**, puis cliquez sur **Exécuter**.
2. En bas s'ouvre le **journal d'exécution**. Il affiche notamment :
   ```
   Adresse du service (à coller dans public/relais.js) : https://script.google.com/…
   CLÉ DU RAPPORT (à coller dans le panneau, onglet Réglages) : 3f8a…
   ```
3. **Copiez la clé.** Elle est créée une seule fois et conservée dans votre
   compte ; `test` la réaffichera chaque fois que vous en aurez besoin.
4. Ouvrez le panneau d'administration → onglet **Réglages** → collez-la dans
   **« Clé de lecture du rapport »** → **Enregistrer la clé**.

   Le panneau enchaîne tout seul : il enregistre, il **lit le rapport**, et il
   dit si la clé a été acceptée. Trois boutons, trois choses différentes :
   **Tester le relais** envoie un vrai relevé (vérifiez la ligne `TEST` dans la
   feuille), **Lire le rapport maintenant** relit les chiffres sans attendre, et
   **Enregistrer la clé** fait les deux.

## Étape 9 — Vérifier (c'est la seule preuve qui compte)

1. Ouvrez le site, puis **Réglages → Compte**.
2. Remplissez le formulaire avec **une adresse à vous** : l'adresse e-mail, et
   cochez la case des bons plans. **C'est tout** — il n'y a ni prénom, ni mot de
   passe, ni compte à créer.
3. Cliquez sur **S'inscrire**.
4. Le message doit dire : *« Un e-mail de confirmation part vers
   votre.adresse@… »*
5. **Ouvrez votre boîte mail.** Un message signé Kazendra doit être arrivé
   (regardez aussi dans les indésirables la première fois).
6. **Cliquez le lien qu'il contient.** Une page sobre doit s'ouvrir :
   **« Compte activé »**.
7. Ouvrez votre feuille : la ligne doit exister, avec la colonne **Statut**
   passée de `en attente` à `confirmé`.
8. **Et le trafic** : revenez sur le site avec un navigateur où vous n'êtes pas
   allé récemment, ouvrez-le, puis rouvrez le panneau → onglet **Trafic**. Deux
   choses doivent y être : une **ligne dans la feuille `Trafic visites`**, et un
   onglet Trafic qui affiche enfin des chiffres — avec la date du jour dans le
   tableau **jour par jour**.

Si la ligne n'y est pas, c'est presque toujours l'une de ces trois choses :
l'adresse `/exec` n'a pas été collée dans `relais.js`, le site n'a pas été
republié, ou le déploiement n'a pas été mis en « Tout le monde ».

Si la ligne existe mais que l'e-mail n'arrive pas : le statut indique
`en attente, e-mail NON envoye`. Dans ce cas, retournez sur le site et cliquez
**« Renvoyer l'e-mail de confirmation »** (visible sous votre compte) — le
tableau renverra le message.

> **⚠ Si vous aviez déjà installé une version ANTÉRIEURE du script** (avant le
> 12/10/2026), elle ne connaît que les inscriptions : recopiez **tout** le
> contenu de `outils/tableau-inscription.gs` dans l'éditeur, enregistrez, puis
> **Déployer → Gérer les déploiements → ✏️ → Version : Nouvelle version**. Sans
> cette dernière étape, le déploiement continue de servir l'ancien code, et les
> relevés de visite se perdraient **en silence** — la page, elle, ne peut pas
> lire la réponse d'un dépôt.

## Si le panneau ne peut pas lire le rapport

Trois explications possibles, et le panneau les distingue (il ne dit pas la même
chose pour « pas d'adresse », « pas de clé » et « le relais ne répond pas ») :

- **« Relais non branché »** — l'adresse n'est pas dans `relais.js`, ou le site
  n'a pas été republié.
- **« La clé de lecture manque / est refusée »** — recopiez celle qu'affiche
  `test()` dans l'onglet **Réglages**, champ **« Clé de lecture du rapport »**.
  Elle se perd facilement (majuscules et chiffres mélangés), et elle ne vit que
  dans le stockage du navigateur : vider les données du site, ouvrir une fenêtre
  privée ou changer d'appareil la fait disparaître **sans toucher au relais**.
- **« Le relais n'a pas répondu »** — l'adresse est fausse, ou le réseau a
  coupé. Le panneau essaie **deux chemins** avant de le dire : la requête
  ordinaire, puis une balise de script (les balises ne sont pas soumises à
  l'autorisation d'origine croisée du navigateur). Si les deux échouent, c'est
  bien le relais qui est injoignable.

**En attendant, la feuille elle-même contient tout** : la liste des visiteurs
jour par jour est dans `Trafic visites`, les sorties sont dans `Trafic clics`.
Le panneau est un confort ; la feuille est la source.

---

## Se désinscrire, depuis le site

Quand une adresse est **déjà retenue par l'appareil**, le bouton « S'inscrire »
devient **« Se désinscrire »** (demande de B : « Si une adresse mail est
documentée alors le bouton se transforme en désinscription. pour supprimer la
newsletter. »). Le clic fait **deux choses** :

1. il envoie une **demande de retrait** au tableau (`demande=desinscription`) :
   la ligne passe en `désinscrit` et le jeton de l'e-mail est effacé ;
2. il **oublie l'adresse sur l'appareil**, tout de suite.

La page ne peut pas lire la réponse du tableau : elle annonce donc que **la
demande est partie** — jamais qu'elle a été traitée. Si l'envoi échoue, elle le
dit et renvoie au lien de désinscription de l'e-mail reçu. **La ligne n'est
jamais supprimée** : elle reste comme trace de l'accord et de son retrait — sans
elle, un envoi ultérieur recréerait la ligne.

## Comment une inscription s'active, en deux temps

1. Quelqu'un remplit le formulaire → sa ligne est écrite avec le statut
   **`en attente`**, et un e-mail part vers l'adresse indiquée. Rien n'est
   conservé sur son appareil avant que l'envoi ait réussi : hors ligne, on ne
   retient rien et on le dit.
2. Il clique le lien de l'e-mail → la ligne passe en **`confirmé`** et une page
   « Compte activé » s'affiche.

**Pourquoi cette étape n'est pas une complication inutile.** Une adresse non
confirmée n'a jamais été vérifiée : elle peut être mal orthographiée, ou
appartenir à quelqu'un qui n'a rien demandé. Envoyer une newsletter à ces
adresses-là, c'est du courrier non sollicité — mauvais pour les gens, et
contraire à la règle européenne du consentement. **La confirmation est à la fois
la preuve du consentement et le filtre contre les fautes de frappe.**

**Ne diffusez que la colonne `confirmé`.** Les lignes `en attente` ne doivent
jamais recevoir de newsletter : ce sont précisément celles dont on ne sait rien.

## Envoyer la newsletter — la limite à connaître

Le même compte Google peut envoyer, mais **pas en volume**. Sur un compte Gmail
personnel, la limite est de **100 destinataires par jour** (1 500 sur un compte
Google professionnel). C'est très suffisant pour les e-mails de confirmation —
il y en a un par inscription. **C'est insuffisant pour une newsletter envoyée à
toute la liste** dès qu'elle dépasse la centaine.

Trois chemins, du plus simple au plus autonome :

- **Depuis Gmail, par lots** — gratuit, mais limité à environ 100 par jour avec
  Apps Script, et les adresses doivent être copiées-collées. Tenable au début.
- **Un script Google qui envoie** — le même éditeur Apps Script peut envoyer avec
  `MailApp`, dans la même limite quotidienne. Plus autonome, même plafond.
- **Un service d'envoi** — le jour où la liste devient grande, ce sera
  nécessaire : au-delà, les envois depuis une adresse personnelle finissent en
  spam, et les inscrits ne reçoivent plus rien. C'est un tiers, mais seulement à
  ce moment-là, et seulement pour l'envoi : **la liste, elle, reste chez vous.**

## Vos obligations légales (Belgique / UE) — pour mémoire

- **Consentement** : obtenu par la case à cocher, et **prouvé** par la
  confirmation par e-mail. C'est déjà en place.
- **Désinscription** : chaque envoi doit contenir un moyen simple de se
  désinscrire. À prévoir dans l'outil d'envoi.
- **Droit à l'effacement** : si quelqu'un demande la suppression, il suffit de
  supprimer sa ligne dans la feuille.
- **Durée** : ne gardez pas une adresse sans raison. Une liste non utilisée
  depuis des années se nettoie.
- **Les adresses `en attente`** : ce sont des demandes sans suite. Vous pouvez
  les supprimer au bout de quelques semaines sans rien perdre.
