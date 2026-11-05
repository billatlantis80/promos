# Inscription = newsletter. Plus de compte, plus de mot de passe (11/10/2026)

**Décision de B, verbatim (11/10/2026)** :

> « Toujours dans les paramètres, inscription et connexion, la partie mot de passe
> et mot de passe a répété, le mot de passe peut disparaître car il n'y a pas de
> connexion. il y a juste une adresse mail qui est donné pour recevoir la
> newsletter. Le bouton créer mon compte doit s'adapter en disant s'inscrire. Si
> une adresse mail est documentée alors le bouton se transforme en désinscription.
> pour supprimer la newsletter. Créer un compte doit disparaître ça doit être lié à
> la création de la newsletter à la place, se connecter avec Google doit devenir
> s'inscrire avec Google, ou un équivalent ? »

**Portée** : les Réglages, onglet « Compte », rubrique « Inscription et
connexion » — et la règle vaut pour **tout le projet** (téléphone, tablette, PC).

## Ce qui est demandé, en clair

1. **Les deux champs de mot de passe disparaissent** de l'inscription : il n'y a
   aucune connexion, l'inscription sert à recevoir la newsletter.
2. **Le bouton dit « S'inscrire »**, plus « Créer mon compte ».
3. **La notion de compte disparaît** : l'inscription, c'est la newsletter.
4. **Quand une adresse est déjà retenue, le bouton devient « Se désinscrire »**
   (retirer la newsletter).
5. **« Se connecter avec Google » devient « S'inscrire avec Google ».**

## Conséquences, et ce qui a été fait

| Conséquence | Pourquoi | État |
|---|---|---|
| Le **compte local** (`compte.js`, PBKDF2, empreinte, sel) disparaît | il n'était créé QUE par ce formulaire ; sans mot de passe, il ne peut plus exister | fichier supprimé, `promos.compte` effacé au démarrage |
| L'**écran de verrouillage** et « Verrouiller maintenant » disparaissent | un verrou sans mot de passe n'a plus de clé | HTML, CSS et code retirés |
| Le **petit œil** (montrer/cacher le mot de passe) disparaît | il n'existe plus aucun champ de mot de passe | code et tests retirés |
| « Changer le mot de passe », « Supprimer mon compte » disparaissent | ils portaient sur le compte | remplacés par « Effacer les données de cet appareil » |
| « **Télécharger mes données** » et l'effacement **restent** | droits RGPD : ils ne dépendent pas du compte | boutons conservés, dans la rubrique d'inscription |
| Les phrases du bloc « Tes données, tes droits » sont **RÉÉCRITES** | « Ce compte vit sur cet appareil », « une empreinte du mot de passe », « le prénom affiché » deviennent faux | 4 phrases réécrites dans les 9 langues |
| La ligne « Nom d'utilisateur et empreinte du mot de passe » du tableau **confidentialite.html** tombe | le site ne collecte plus aucun mot de passe, ni nom | 3 langues (fr, nl, en) |
| Le titre de rubrique « Inscription et connexion » devient « Inscription aux bons plans » | il n'y a plus de connexion : le titre annonçait une chose qui n'existe pas | index.html + 9 langues |

## Ce qui n'est PAS touché

- **La case des bons plans** reste dans l'encadré : le bouton Google est dans le
  même cadre, donc le consentement vaut pour les deux chemins.
- **Le double opt-in** (e-mail de confirmation, lien de désinscription) : c'est
  ce qui rend le consentement prouvable. Il n'a jamais dépendu du compte local.
- **La rubrique Langue**, dernière de l'onglet Compte.

## Mécanique de la désinscription

Le bouton « Se désinscrire » envoie une **demande de retrait au tableau Google**
(`demande=desinscription`, action ajoutée à `outils/tableau-inscription.gs`) et
**oublie l'adresse sur l'appareil** dans le même geste. La page ne peut pas lire
la réponse du tableau (`no-cors`) : elle dit donc « Désinscription envoyée », et
si l'envoi échoue elle le dit aussi, sans prétendre le contraire.

## Règle de fond, à garder

« L'idée est juste d'avoir des inscrits à la newsletter. Aucune autre inscription
et aucune autre information n'est nécessaire. » → **le site ne demande que ce qui
sert au but**. Un champ qui ne sert pas au but tombe, même s'il fonctionne.

---

## Suite du même jour : la promesse publiée qui restait fausse

Le plan annonçait « la ligne *Nom d'utilisateur et empreinte du mot de passe* du
tableau **confidentialite.html** tombe ». Fait le 11/10/2026, **dans les trois
langues** (fr, nl, en), au moment où j'ai vérifié le fichier au lieu de m'en
souvenir. Ce qui est parti :

| Endroit | Ce qui était écrit | Pourquoi c'était faux |
|---|---|---|
| tableau, 2 lignes | « Nom d'utilisateur et **empreinte** du mot de passe », « Prénom affiché » | plus de compte local, plus de mot de passe, plus de profil depuis le 12/10 |
| tableau, durée | « Jusqu'à la suppression du compte par la personne » | la case restante (favoris, réglages) ne dépend d'aucun compte — remplacée par la durée réelle |
| § cookies/HTTPS | « seule une empreinte calculée à partir de lui est stockée » | il n'y a plus rien à calculer : **aucun mot de passe n'est demandé** |
| liste des droits | « Le compte, les favoris et les réglages ne quittent pas l'appareil » | il n'y a plus de compte ; la phrase devenait un mot vide |

Remplacé par : « **Aucun mot de passe n'est demandé ni conservé** : il n'y a ni
compte à créer ni connexion à établir. L'inscription aux bons plans ne demande
qu'une adresse e-mail. »

Vérifié sur l'**artefact publié** : `https://kazendra.com/confidentialite.html` →
17 672 octets, `empreinte</b> du mot de passe` : **0**, `<td>Prénom affiché</td>` :
**0**, phrase neuve : **1**. (Le premier contrôle avait rendu l'ancienne version :
c'est la copie en cache du CDN — remesuré après trois minutes.)

## Deux défauts de mes outils, trouvés au passage

1. **Le nettoyage CSS par lignes** a emporté `.pays-liste` et `.pays-item` (la
   liste des pays est devenue carrée). B l'a vu à l'œil avant les tests. Repris
   depuis la copie d'avant, retiré par blocs équilibrés, et gardé par
   `tests/fond-des-listes.test.mjs` — la leçon est dans la skill
   `retirer-une-fonctionnalite`.
2. **Le garde-fou du banc de contre-épreuve** comparait des tests RÉUSSIS à un
   TOTAL : avec deux échecs connus, il refusait de conclure pour toujours, en
   accusant sa copie (vérifiée complète, 747 tests, listes de fichiers
   identiques). Corrigé : il compare des totaux.

Le banc tient maintenant 749 tests ; son verdict (défauts ratés) est en cours.
