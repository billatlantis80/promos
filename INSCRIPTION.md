# Votre tableau d'inscription — la marche à suivre

Objectif : quand quelqu'un remplit le formulaire du site, son adresse e-mail
arrive **dans une feuille de calcul Google, sur votre compte**. Personne d'autre
ne la voit : ni nous, ni un prestataire, ni un traqueur. Aucune clé d'API, aucun
abonnement, aucun coût.

Comptez **10 minutes**. Faites-le une seule fois.

> **Ce qui se passera tant que ce n'est pas fait** : le formulaire fonctionne,
> le compte local se crée, mais l'adresse **ne part nulle part**, et le message
> le dit clairement — « Le tableau n'est pas encore branché : ton adresse n'a pas
> été envoyée. » Rien n'est jamais annoncé à tort.

---

## Étape 1 — Créer la feuille

1. Allez sur **sheets.new** (tapez-le dans la barre d'adresse).
2. Google ouvre une feuille de calcul vide. En haut à gauche, cliquez sur
   **« Feuille de calcul sans titre »** et tapez : `Kazendra — inscriptions`.
3. C'est tout. **Ne créez aucune colonne à la main** : le script s'en charge.

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

## Étape 7 — La brancher (une ligne à changer)

1. Ouvrez le fichier **`public/inscription.js`** du projet.
2. Tout en haut, trouvez la ligne :
   ```js
   export const URL_TABLEAU = '';
   ```
3. Collez votre adresse **entre les deux apostrophes**, sans espace :
   ```js
   export const URL_TABLEAU = 'https://script.google.com/macros/s/AKfycb…/exec';
   ```
4. Enregistrez, puis republiez le site.

## Étape 8 — Vérifier (c'est la seule preuve qui compte)

1. Ouvrez le site, puis **Réglages → Compte**.
2. Remplissez le formulaire avec **une adresse à vous** : adresse e-mail,
   prénom, mot de passe, et cochez la case du bas.
3. Cliquez sur **Créer mon compte**.
4. Le message doit dire : *« Ton adresse est envoyée. »*
5. Ouvrez votre feuille `Kazendra — inscriptions` : **une ligne doit y être
   apparue**, avec la date, l'adresse, le prénom, la langue et le pays.

Si la ligne n'y est pas, c'est presque toujours l'une de ces trois choses :
l'adresse `/exec` n'a pas été collée dans `inscription.js`, le site n'a pas été
republié, ou le déploiement n'a pas été mis en « Tout le monde ».

---

## Ce qui est déjà fait pour vous

- **Les doublons sont refusés.** La même adresse deux fois n'écrit qu'une ligne.
  Sans cela, un inscrit qui clique deux fois reçoit deux newsletters.
- **Les adresses mal écrites sont refusées des deux côtés** — dans la page *et*
  dans le tableau. Une faute de frappe silencieuse est un contact perdu pour
  toujours.
- **Les écritures sont verrouillées.** Deux personnes peuvent s'inscrire à la
  même seconde ; sans verrou, une des deux inscriptions serait perdue.
- **Le consentement est obligatoire.** Aucune adresse n'est enregistrée sans la
  case cochée.
- **Le message dit « envoyée », jamais « inscrite ».** Votre page ne peut pas
  lire la réponse du tableau Google (c'est une limite des navigateurs). Annoncer
  « vous êtes inscrit » serait un mensonge ; on annonce ce qu'on sait.

## Ensuite : envoyer la newsletter

La feuille collecte ; elle n'envoie pas. Pour envoyer, il faut un outil d'envoi.
Trois chemins, du plus simple au plus autonome :

- **Depuis Gmail, par lots** — gratuit, mais limité à environ 500 envois par jour,
  et les adresses doivent être copiées-collées. Tenable jusqu'à quelques centaines
  d'inscrits.
- **Un script Google qui envoie** — le même éditeur Apps Script peut envoyer avec
  `MailApp`, dans la limite du quota quotidien du compte. Plus autonome.
- **Un service d'envoi** — le jour où la liste devient grande, ce sera nécessaire
  (les gros volumes depuis une adresse personnelle finissent en spam). C'est un
  tiers, mais seulement à ce moment-là, et seulement pour l'envoi : la liste,
  elle, reste chez vous.

## Vos obligations légales (Belgique / UE) — pour mémoire

- **Consentement** : obtenu par la case à cocher. C'est déjà en place.
- **Désinscription** : chaque envoi doit contenir un moyen simple de se
  désinscrire. À prévoir dans l'outil d'envoi.
- **Droit à l'effacement** : si quelqu'un demande la suppression, il suffit de
  supprimer sa ligne dans la feuille.
- **Durée** : ne gardez pas une adresse sans raison. Une liste non utilisée
  depuis des années se nettoie.
