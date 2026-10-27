# PLAN — univers ENTRAIDE de la porte /job-etudiant

Ouvert le 28/10/2026. Décision de B : « avant de commencer immo il faut faire la suite logique,
continuer entraide de job étudiant ». La porte se ferme donc par son second univers, pas par une
cinquième porte entamée.

## Ce que l'entraide est, en une phrase

Un particulier demande un coup de main, un étudiant le donne, l'étudiant fixe son prix, l'argent ne
passe jamais par la plateforme, et la plateforme ne compte aucune heure qu'elle n'a pas vue.

## La décision qui commande tout le reste : 18 ANS

L'entraide s'ouvre aux **18 ans et plus**, pas aux 16–17, et ce n'est pas un refus de la décision de B
(« les jobs étudiants dès 16 ans ») : c'est la même décision, appliquée là où le droit est certain.

- **jobs** dès 16 ans → l'employeur porte la déclaration (DIMONA, DmfA, assurance) ; la plateforme ne
  fait que publier une annonce.
- **entraide** 18 ans et plus → l'exemption ONSS des activités occasionnelles non manuelles porte une
  condition d'âge qui **n'a pas été lue à la source**. Tant qu'elle ne l'est pas, ouvrir les missions
  à un mineur reviendrait à parier sur une dispense qu'on n'a pas vérifiée.

Conséquence sur le code : la fonction de majorité est écrite, éprouvée, **et c'est elle qui ferme la
porte**, pas une case cochée. Le jour où la source est lue, on change une constante — et la
vérification des sept règles des mineurs (nuit, dimanche, heures de cours, accord parental) devient
bloquante. Ces règles sont écrites ici comme **dormantes et déclarées**, jamais supposées faites.

## Ce qui est construit dans ce lot

| Table | Rôle | Ce qu'elle empêche |
|---|---|---|
| `profils_etudiant` | prix fixé par l'étudiant, savoir-faire (5 valeurs fermées), présentation, état de vérification | un profil sans prix, donc un prix décidé par le demandeur |
| `statuts` | disponible / occupé / ne pas déranger / hors ligne | les sollicitations de dernière minute hors disponibilité |
| `creneaux` | agenda heure par heure, 3 états **écrits** | deux missions sur la même heure |
| `sollicitations` | qui a demandé, quand, pour quel besoin | un compteur entier qui ne dit ni qui ni quand |
| `missions` | début/fin, pause calculée, durée de travail, prix **copié** | une mission de 90 min dans une grille horaire |
| `mission_etapes` | journal append-only de la machine à 9 états | une transition qu'on ne peut pas expliquer |
| `confirmations` | oui / non / pas de réponse, par l'aidé **ou** sa personne de confiance | deux confirmations contradictoires |
| `carnet` | 3 natures assumées : confirmé, déclaré, annulée | un carnet qui maquille une annulation |
| `personnes_de_confiance` | deux comptes distincts, un lien | un identifiant partagé |
| `adresses` | rue, digicode, effacement 30 jours | un digicode qui survit à la prestation |
| `jours_feries` | table, pas une saisie libre | un férié « oublié » selon qui remplit |

## Les garde-fous non négociables, et où ils tiennent

1. **8 h par semaine** (entraide) — somme `max(durée prévue, durée déclarée)` des missions acceptées,
   en cours et terminées de la **semaine ISO**. Refus à l'acceptation, pas un avertissement.
2. **Pause** 30 min au-delà de 4 h 30, **1 h au-delà de 6 h** — calculée, jamais saisie.
3. **Liste noire du travail manuel** (ménage, repassage, vitres, jardinage lourd) : elle transforme le
   particulier en employeur et fait sortir de l'exemption. Refus à la saisie, avec la raison.
4. **Aucun argent** : aucun champ de paiement, aucune commission, aucun encaissement. Le prix est une
   phrase convenue, copiée au moment de la réservation.
5. **Aucune position** : code postal seul, distance entre communes, « même commune » au lieu de 0 km.
6. **Code de fin** 4 chiffres, haché, **3 essais**, valable le jour du créneau seulement.
7. **Libération du créneau** sur refus, annulation et expiration, dans la même transaction — sans
   elle, trois refus vident la semaine d'un étudiant.
8. **Le mot « validé » ne s'applique jamais aux heures.** Le carnet dit « confirmé » (mission +
   confirmation) ou « déclaré par toi ». Aucune attestation d'heures n'est émise.

## Les écrans

- `/job-etudiant/entraide` — côté personne aidée : les tuiles de besoin, les créneaux **libres**
  seulement, jamais l'agenda occupé.
- `/job-etudiant/agenda` — côté étudiant : profil, prix, créneaux heure par heure, statut.
- `/job-etudiant/mission/<id>` — la mission, ses états traduits en trois mots pour l'aidé, le code de
  fin côté étudiant, la confirmation.
- `/job-etudiant/carnet` — le carnet, en trois natures, avec la phrase qui dit qui l'a rempli.

## Ce que ce lot ne fait PAS, et qu'on annoncera

- **rien pour les 16–17 ans** : ni accord parental (`tuteurs`), ni autorisation de journée de 6 mois,
  ni calendriers scolaires par communauté. Les règles sont écrites et dormantes ; les tables
  n'existent pas tant que la porte ne s'ouvre pas à eux.
- **`heures_declarees`** (les 650 h déclaratives de l'univers jobs) : appartient aux jobs, pas ici.
- **évaluation par faits** (`avis_faits`) : trois valeurs, jamais une moyenne — non codée dans ce lot.
- **relevé annuel des calendriers** (`releve-calendriers.py`) : les jours fériés sont posés en table
  par la graine et par le code, pas relevés automatiquement.
