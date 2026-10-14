# Trafic et gains dans le panneau — plan (12/10/2026)

> Journal de décisions. Les règles de B y sont consignées **telles qu'il les a
> énoncées**, puis traduites en gestes vérifiables. Ce fichier est la source de
> vérité de ce chantier : il dit aussi ce qui n'est **pas** fait.

## La demande, mot pour mot

> « Dans le panneau admin de l'application kazendra, au niveau des utilisateur,
> peux-tu connecter les tuyaux afin que je puisse voir d'où viennent les
> utilisateurs. **Important** il faut garder un historique jour par jour de
> combien d'utilisateurs sont venu sur le site et **une moyenne avec des conseils
> sur comment améliorer**. même chose toujours au niveau du panneau
> administrateur au niveau des affiliations, il faut que je voye combien j'ai pu
> gagner grâce au redirection, **une estimation ou quelque chose du genre en
> fonction de ce qui est possible** »

Puis : « Tu peux continuer les branchements et les preuves d'écran maintenant. »

Trois exigences se lisent dans ces phrases, et chacune commande un bloc :

1. **« connecter les tuyaux »** — pas un nouvel écran : un tuyau qui ne
   fonctionnait pas.
2. **« historique jour par jour » + « une moyenne »** — le rythme, pas un total.
3. **« une estimation ou quelque chose du genre **en fonction de ce qui est
   possible** »** — B accepte l'estimation, mais demande d'abord ce qui est
   MESURABLE. C'est la clé de tout le bloc des gains.

## L'état des tuyaux AVANT — trois annonces, zéro branchement

| tuyau annoncé | état réel mesuré le 12/10/2026 |
|---|---|
| le site envoie les visites au relais | **jamais parti** : l'adresse était lue dans `localStorage['kazendra.relais']`, or un visiteur ne l'a jamais — il ne l'a pas saisie. Le panneau pouvait afficher « relais branché » en ne recevant rien |
| les clics vers les marchands sont comptés | **jamais envoyés** : `noterAction()` écrivait sur l'appareil, `relayerAction()` existait sans être appelée nulle part |
| le relais rassemble les données | le script Google ne connaissait **que les inscriptions** ; son `doGet` rendait une page HTML, jamais de JSON — donc même `d.inscrits` (attendu par le panneau) n'a jamais existé |

C'est la « promesse fausse » de la règle du tuyau : un champ que seul son auteur
remplit n'est pas un tuyau. **Rien n'était cassé à l'écran** — c'est ce qui rend
ce défaut-là si long à voir.

## Ce qui a été construit

**Une seule adresse, publiée** (`public/relais.js`) : `URL_RELAIS`, vide tant que
B n'a pas déployé son script. Utilisée par `app.js` (visites **et** clics),
`inscription.js` (le formulaire) et le panneau. L'ancienne adresse en stockage
local survit **uniquement** comme adresse de diagnostic du panneau — pour
essayer avant de publier.

**Le récepteur** (`outils/tableau-inscription.gs`) reçoit maintenant trois
familles, triées par leur premier champ (`type`), et écrit deux journaux :
`Trafic visites` et `Trafic clics`. Il publie un **rapport** agrégé, protégé par
une **clé** :

- **jour par jour**, jours creux **compris** (un creux est une information) ;
- **deux moyennes** — sur les jours actifs *et* sur la fenêtre entière — plus la
  **médiane** : une seule journée forte déplace une moyenne et laisserait croire
  à une fréquentation continue ;
- la **tendance** 7 jours / 7 jours, publiée seulement à partir de 14 jours
  d'historique (une « tendance » sur trois jours est une fluctuation) ;
- les **provenances** (référent), les **fuseaux**, les **langues**, les **portes
  d'entrée**, les **appareils**, les **pays consultés** ;
- les **redirections** par hôte, par marchand et par pays.

**Le panneau** : onglet Trafic réorganisé (combien → quand → d'où → avec quoi →
quoi faire), et un bloc « Ce que les redirections ont rapporté » dans l'onglet
Affiliation.

## Les cinq règles tenues, et pourquoi

1. **LE MESURÉ ET L'ESTIMÉ NE SE MÉLANGENT PAS.** Mesuré : les visites et le
   nombre de redirections. Estimé : les euros. Le bloc des gains affiche les
   deux **séparément**, avec le tableau du modèle sous les chiffres — et
   `public/estimation.js` dit pour chaque hypothèse d'où elle vient.
2. **CE QUI N'EST PAS MESURABLE EST DIT.** Le site ne voit ni la commande, ni le
   panier, ni le versement : entre le clic et l'euro il y a le marchand, sa
   caisse, sa fenêtre de suivi et son programme. Les trois facteurs autres que
   le clic sont donc **déclarés comme hypothèses**, modifiables (le taux se
   saisit par programme), et le montant **réellement versé** se saisit à côté :
   c'est la **calibration**, la seule chose qui dise de combien le modèle se
   trompe. Une estimation qu'on ne confronte jamais au réel reste une estimation
   pour toujours.
3. **CE QUI MANQUE SE DIT, ET POURQUOI.** Quatre états distincts — pas
   d'adresse, pas de clé, clé refusée, relais muet — quatre phrases. Aucun zéro
   n'est affiché à la place d'une mesure.
4. **UN TOTAL PORTE SA COUVERTURE.** « 88 visites » s'affiche avec « 15 derniers
   jours », « 13 jours actifs sur 15 » et le fuseau qui décide des journées.
5. **LA LECTURE EST FERMÉE.** Le service est public (un visiteur doit déposer
   son relevé) ; le rapport exige une clé **absente du site**. L'avis de
   l'onglet Inscrits a été corrigé dans le même mouvement : il promettait de
   rapatrier les inscriptions des autres appareils, ce que le relais n'a jamais
   rendu. Les adresses restent dans la feuille — les faire voyager à travers le
   site, dont l'adresse est publique, n'apporterait rien.

## La leçon du jour — et elle vient de l'épreuve d'écran

`urlRapport is not defined` : l'import manquait dans le panneau. Aucune épreuve
hors navigateur ne pouvait le voir — leur harnais remplaçait justement les
fonctions du relais. Conséquence réelle **en ligne** : le panneau n'aurait pas
pu lire le rapport, l'onglet Trafic serait resté vide, et « relais muet » se
serait affiché sur un relais en parfait état.

**Règle qui en sort** : *un onglet se vérifie en l'ouvrant, pas en relisant le
code*. Les épreuves hors navigateur prouvent les chiffres ; celle du navigateur
prouve l'écran. Les deux sont nécessaires, et elles ne se remplacent pas.

Autres défauts attrapés à l'écran le même jour, et corrigés :

- **des `undefined` dans les tableaux de provenance** — `tableauComptes` lisait
  `x.cle` alors que le rapport nomme ses listes (`provenance`, `fuseau`…) :
  le nom du champ est maintenant **donné à chaque appel** ;
- **un pourcentage au mauvais endroit** — « 8 sorties sur 32 (75 %) » collait la
  part des affiliées sur la phrase des clics perdus. Un chiffre juste au mauvais
  endroit est un chiffre faux ;
- **une ligne de serveur local** — `etat-collecte.json` n'était pas servi en
  local (il vit dans `docs/`) : l'onglet Exploitation annonçait « aucun bilan
  publié » ici alors qu'il est rempli en ligne.

## Ce qui reste à B — dix minutes, une fois

Voir `INSCRIPTION.md`, étapes 1 à 9. En résumé : coller le script dans Apps
Script, déployer, coller l'adresse dans `public/relais.js` (une ligne), lancer
la fonction `test` et coller la **clé** dans Réglages. Le panneau enchaîne
ensuite tout seul.

Puis, quand le premier versement tombera : saisir le montant réellement versé et
régler le **taux de commission** de chaque programme. C'est ce qui fait passer
l'estimation d'ordre de grandeur à mesure.

## Ce qui n'est PAS fait, et pourquoi

- **les inscriptions des autres appareils ne remontent pas dans le panneau** :
  décision de discrétion (voir règle 5). La feuille les réunit déjà toutes.
- **l'origine géographique du visiteur n'est pas enregistrée** : ce serait une
  adresse IP. Le fuseau horaire dit la région sans désigner personne — et
  l'onglet le dit à l'endroit où on se poserait la question.
- **les pages vues ne sont pas relayées** (seulement comptées par appareil) :
  un seul passage par session, pour ne pas gonfler le total de tous les
  appareils. Le journal local les garde, étiquetées comme telles.
- **le référent d'une visite arrivant d'une page de partage est déclaré
  « partage Kazendra », pas mesuré page par page** : les pages de partage
  (`docs/o/*.html`) ne portent aucun script, et en ajouter un à 19 000 pages
  est un chantier à part. À faire si B veut savoir QUELLE offre est partagée et
  vue — question qui n'a pas encore été posée.
