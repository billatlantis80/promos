# CGU — clause de la porte `/emploi`

**25 octobre 2026.** Texte prêt à insérer dans `public/cgu.html`, écrit dans le registre des onze
articles existants (phrases courtes, présent, « le site »/« Kazendra » à la troisième personne).

## Où l'insérer, et pourquoi là

**En article « 2 bis », juste après l'article 2 (« Ce que le site est, et ce qu'il n'est pas »)** — et non
à la fin. Trois raisons :

1. l'article 2 dit ce que le site n'est pas ; la porte `/emploi` en est une **spécification** (ni
   employeur, ni placeur, ni intermédiaire de candidature), donc elle se lit juste après ;
2. les sept autres portes viendront s'ajouter en **2 ter, 2 quater…** sans renuméroter les onze articles
   existants — une CGU dont les numéros bougent à chaque porte est une CGU que personne ne cite
   correctement ;
3. la clause est **opposable** : c'est elle qui répond au premier courriel d'un candidat qui dira « mais
   j'ai postulé chez vous ».

## Le texte à insérer

> **2 bis. Les offres d'emploi**
>
> La porte « emploi » affiche des offres publiées par des entreprises et des ASBL. Kazendra n'est pas
> l'employeur, n'est pas un bureau de placement et n'est pas partie au contrat de travail. Il ne reçoit
> aucune candidature, n'en transmet aucune et ne conserve aucun curriculum vitæ.
>
> Le contact se fait par courriel, directement entre le candidat et l'employeur. Le message est rédigé et
> envoyé depuis la messagerie du candidat : il ne passe pas par Kazendra, qui ne le lit pas, ne le
> conserve pas et ne peut pas en confirmer la réception. Un texte de message est proposé ; le candidat
> peut le modifier, l'effacer ou n'en pas vouloir.
>
> En publiant une offre, l'employeur déclare être autorisé à publier l'adresse électronique de contact et
> assumer la responsabilité de son exactitude. Cette adresse est publique pendant la durée de l'annonce
> et supprimée avec elle. Toute personne peut en demander le retrait ; il est effectué sans condition et
> sans justification à fournir.
>
> Les mentions de l'offre — employeur, lieu, durée, statut, rémunération et commission paritaire — sont
> déclarées par l'employeur. Kazendra vérifie le numéro d'entreprise à la main et affiche la date de cette
> vérification. Il ne vérifie ni la véracité de l'offre, ni les montants annoncés, ni la situation de
> l'entreprise. Chaque offre est relue par une personne avant publication, et peut être retirée à tout
> moment.
>
> La porte est réservée aux personnes majeures. Les emplois étudiants relèvent d'une autre porte, soumise
> à d'autres règles.
>
> Aucun numéro de compte, aucune copie de pièce d'identité et aucun mot de passe ne doivent être envoyés
> en réponse à une offre. Aucun employeur sérieux ne les demande avant un contrat signé.
>
> La publication est gratuite au lancement. Si elle devient payante, l'annonce portera la mention
> « annonce sponsorisée ». Aucun montant n'est jamais demandé à la personne qui cherche un emploi.

## Ce que chaque paragraphe protège — à relire avant toute reformulation

| Paragraphe | Ce qu'il ferme |
|---|---|
| 1 | la qualification d'employeur et de **placeur** (travail intérimaire : agrément régional exigé) |
| 2 | la promesse d'un « suivi de candidature » et la croyance qu'un message envoyé de bonne foi serait arrivé chez nous |
| 3 | la responsabilité de l'éditeur sur une **adresse personnelle publiée sans accord** (RGPD, art. 6 et 17) |
| 4 | la garantie sur le salaire et sur la commission paritaire — « un chiffre inventé serait pire qu'aucun » |
| 5 | la confusion avec `/job-etudiant`, qui a ses propres règles et ses propres protections |
| 6 | l'arnaque au faux recruteur, qui est le risque numéro un d'une porte où le CV sort |
| 7 | la promesse de gratuité perpétuelle et l'oubli de la mention légale le jour de la facturation |

## Trois choses à faire au moment de l'insertion, pas avant

1. **Les versions NL et EN** (`cgu.nl.html`, `cgu.en.html`) doivent recevoir la même clause, avec le
   français comme référence. Je ne les écris pas ici : une clause juridique traduite sans relecture serait
   pire que pas de clause, et la règle du hub est que le fichier français est la référence.
   ⚠️ **Et c'est mesuré** : `tests/legal.test.mjs` vérifie déjà que les trois versions existent et
   qu'elles portent la même structure. Une insertion en français seul passe aujourd'hui entre les
   mailles (aucun test ne compte les articles), donc elle **créerait une asymétrie silencieuse** —
   exactement ce que la suite est là pour empêcher. Les trois fichiers dans la même passe, puis
   `node --test tests/legal.test.mjs`.
2. **La page de confidentialité** (`confidentialite.html`) doit dire, dans la même passe, ce que cette
   porte **ne collecte pas** : aucune candidature, aucun CV, aucun compte de candidat, et les favoris
   rangés dans le navigateur du visiteur, jamais sur le serveur.
3. **Vérifier le numéro d'article** au moment de l'insertion : il est « 2 bis » aujourd'hui, et le deviendra
   peut-être « 2 bis — emploi » le jour où les autres portes auront la leur. Un renvoi interne qui pointe
   vers « l'article 2 bis » doit rester juste.

## Ce que cette clause n'est pas

Ce n'est pas une clause de non-responsabilité générale. Elle ne dit pas « Kazendra décline toute
responsabilité » — elle dit **ce que Kazendra ne fait pas**, ce qui est très différent : une plateforme
qui affirme ne pas recevoir de candidature doit pouvoir le prouver, et ici la preuve est structurelle
(il n'existe aucun champ pour en recevoir une).
