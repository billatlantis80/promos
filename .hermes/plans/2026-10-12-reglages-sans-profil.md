# Réglages — retrait de la rubrique « Profil » (12/10/2026)

**Décision de B, verbatim** : « Au niveau réglage, dans la partie compte tu peux
supprimer l'encadrement profil, il n'y a aucune plus-value à mettre son nom.
L'idée est juste d'avoir des inscrits à la newsletter. Aucune autre inscription
et aucune autre information n'est nécessaire. »

**Portée** : « Cette information est valable pour tout le projet, pas uniquement
sur PC bien sûr. » → la règle vaut sur **tous les écrans** (téléphone, tablette,
PC) et pour tout le site kazendra, pas seulement la mise en page PC.

## Ce qui est demandé, en clair

1. Le site ne collecte **que l'adresse e-mail** de l'inscription aux bons plans.
2. Aucun autre champ, aucun autre renseignement demandé à personne :
   pas de prénom, pas de nom, pas de profil.
3. Le but de l'inscription est et reste : **avoir des inscrits à la newsletter**.

## Ce qui a été retiré

| Élément | Où | État |
|---|---|---|
| Rubrique « Profil » (titre + phrase + carte) | `public/index.html` | retirée |
| Champ « Prénom affiché » et bouton « Enregistrer » | `public/app.js` (`dessinerProfil`) | retiré |
| Pastille d'initiale (« Aperçu ») | `public/app.js` (`initiale`) | retirée |
| Clé mémorisée `promos.profil` | `public/app.js` | retirée (plus rien n'est écrit) |
| Entrée `profil` de l'export RGPD | `public/app.js` (`exporterDonnees`) | retirée |
| Mise en page `.ligne-profil` | `public/app.css` | retirée |
| 8 clés devenues mortes, × 9 langues (72 lignes) | `public/langues.js` | retirées |
| Mention « profil » dans l'infobulle des Réglages | `index.html` + 9 dictionnaires | retirée |

## Ce qui reste, et pourquoi

- **L'adresse e-mail** : c'est la seule information nécessaire, et c'est déjà le
  nom du compte local (`compte.js`) — le compte n'a **jamais** utilisé le prénom.
- **La langue** : elle reste la dernière rubrique de l'onglet Compte.
- **« Télécharger mes données »** garde le compte et les réglages ; il n'exporte
  plus de profil, puisqu'il n'y en a plus.

## Conséquences vérifiées

- Onglet Compte : **2 rubriques** (Inscription et connexion, Langue), sur PC
  comme sur téléphone. Mesuré : inscription 440 × 507 px, langue 580 × 409 px,
  **zéro espace vide** dans les deux.
- Sur PC, deux colonnes : l'inscription à gauche (440 px), la langue à droite.
- Suite de tests : **753/755** (2 échecs = données de collecte, antérieurs :
  une date de relevé et une adresse déclarée).
- Épreuves navigateur : `bin/eprouver-pc.py` et `bin/eprouver-affichage-pc.py`
  passent entièrement ; `bin/eprouver-interactions.py` mis à jour.
- **Aucune trace du profil** ne subsiste : un test refuse désormais les noms
  `regProfil`, `dessinerProfil`, `chargerProfil`, `CLE_PROFIL` et la règle
  `ligne-profil`. Un encadré retiré dont le code survit revient toujours.
