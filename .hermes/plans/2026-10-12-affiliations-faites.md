# Affiliations — « combien j'en ai déjà fait » (12/10/2026)

Journal de décisions. Écrit parce qu'une session suivante doit retrouver **la règle
de comptage** sans la redemander, et savoir pourquoi le panneau change d'aspect le
12/10/2026.

## Ce qui est demandé, en clair

B :

> « Toujours dans le panneau admin au niveau des affiliations, je ne vois pas une
> catégorie qui indique combien d'affiliation j'ai déjà fait. **Actuellement j'en ai
> fait deux.** »

**Il avait raison, et le trou était plus profond qu'un affichage manquant.** Le
panneau montrait ce qu'on avait **MESURÉ** sur les sites (programme trouvé / non
mesuré / aucun signe) et jamais ce qu'on avait **OBTENU**. Les deux partenariats
réellement ouverts sont pourtant écrits depuis le 09/10/2026 dans
`public/affiliation.js` — l'identifiant d'affiliation y est la preuve de l'ouverture
— et le panneau **n'importait même pas ce fichier**.

Les deux, retrouvés dans le code avant d'écrire quoi que ce soit :

| marché | identifiant | acteur dans la base | pays |
|---|---|---|---|
| `amazon.fr` | `kazendra-21` | Amazon France | FR |
| `amazon.com.be` | `kazendra06-21` | Amazon Belgique (.com.be) | BE |

Deux. C'est le chiffre qu'il annonce, et il vient d'une donnée qui existait déjà.

## La règle, et pourquoi elle est là où elle est

**Une affiliation est FAITE quand un identifiant est renseigné.** Pas de seconde
liste tenue à la main : ce serait un deuxième endroit à faire tomber d'accord avec
le premier, et c'est exactement l'écart qui se creuse en silence. Coller un
identifiant fait monter le compte, sans autre geste.

- Le rapprochement acteur ↔ identifiant se fait sur le **DOMAINE** (`amazon.fr`),
  jamais sur le nom : c'est la seule clé que les deux tables partagent, et elle ne
  se devine pas. Une chaîne n'est pas une liste (`Array.isArray`), et une adresse
  collée avec `https://www.` mène au même identifiant que le domaine nu.
- **Bol** compte avec la même règle : le jour où son `Site_ID` est renseigné
  (`bolActif()`), il monte — pas avant. Un **gabarit** de réseau (les `XXXX`/`YYYY`
  de `RESEAUX`) ne compte pas : annoncer une affiliation qui n'existe pas serait
  pire que de ne rien annoncer.

## Ce qui a été ajouté

1. `public/affiliation.js` : `affiliationsFaites()` (marché, identifiant, réseau,
   triés) et `affiliationFaite(domaines)` — deux fonctions **pures**, donc
   exécutables par les tests.
2. `public/affiliations.js` : `ORDRE_VUE` avec un **quatrième groupe en tête**,
   « affiliation faite ». `ORDRE_AFFILIATION` n'est **pas** touché : il dit ce qu'un
   *balayage* peut rendre et il valide une mesure — « faite » n'est pas une mesure,
   c'est une décision.
3. Le panneau : une **tuile de compte** en tête des compteurs, un bloc
   **« Déjà fait — 2 affiliation(s) »** qui nomme les marchés, les identifiants, le
   réseau et l'acteur de la base, une **étiquette verte** sur les acteurs concernés
   dans la liste, et le compte dans le résumé du pays.

## Les deux pièges, et comment ils sont tenus

- **LE DOUBLE COMPTAGE.** Un acteur dont l'affiliation est faite **sort** de son
  groupe de mesure. Les quatre groupes restent donc une **partition**
  (faites + trouvé + non mesuré + aucun signe = acteurs du pays) et le total annoncé
  se vérifie en comptant les lignes. Vérifié : BE 149 = 1+18+32+98, FR 264 = 1+30+62+171,
  DE 182 = 0+43+33+106.
- **LES COMPTEURS PAR RANG.** Ils étaient écrits `groupes[0]`, `groupes[1]`,
  `groupes[2]`. Ajouter un groupe **en tête** les décale tous d'un cran : le panneau
  aurait annoncé des « programmes trouvés » à la place des « non mesurés », et rien
  ne l'aurait dit — tous les nombres restent plausibles. Ils se lisent maintenant
  **par nom**, avec le commentaire qui explique pourquoi.

## Conséquences vérifiées

- **Une phrase devenue fausse a été corrigée** : le texte de « non mesuré » citait
  « Groupon, Bol **et Amazon** ». Amazon n'est plus un exemple de « non mesuré »
  maintenant que ses deux identifiants sont ouverts — il est passé dans « affiliation
  faite ». Il ne reste que « Groupon et Bol », et une épreuve interdit le retour.
- **Une épreuve retournée** : celle qui exigeait **trois** groupes. Renommée et
  datée, elle exige maintenant les quatre, dans l'ordre de la vue, plus l'égalité
  entre le résumé du pays et la vue sur le nombre de faites.
- **Un outil corrigé, et il s'accusait lui-même** : l'épreuve navigateur sommait
  les **trois** anciens états et annonçait « 148 ≠ 149 acteurs » — elle accusait le
  panneau d'un défaut qui était le sien, sa règle de comptage datant de la veille.
- **Tests** : 779 (contre 771 avant), **777 réussis**, 2 échecs — les MÊMES deux
  échecs connus qu'avant ce chantier (une date de relevé, une adresse déclarée qui
  répond 404). 8 épreuves ajoutées.
- **Mesuré dans un vrai navigateur sur le panneau servi** :
  `groupes : ['affiliation faite 1 acteur(s)', 'programme trouvé 18', 'non mesuré 32',
  'aucun signe trouvé 98'] — lignes : [2, 19, 33, 99]`, et le compteur affiche
  `affiliation(s) déjà faite(s) : 1` pour la Belgique. **L'artefact publié
  (kazendra.com/admin) est octet pour octet identique au fichier mesuré** — vérifié
  par empreinte SHA-256 contre le fichier servi, pas seulement contre le dépôt.
- **Banc de contre-épreuve** : 3 mutations ajoutées (la tuile du compte disparaît,
  le titre ne dit plus combien, un acteur fait reste compté dans sa mesure) ; le
  fichier `public/affiliations.js` a été **ajouté à la liste des fichiers
  sauvegardés/restaurés** du banc, sinon une mutation de ce fichier ne serait jamais
  restaurée et le banc resterait mutilé pour toutes les suivantes.

## Suite du même jour : la colonne « Preuve » retirée (12/10/2026)

B : « Toujours dans le panneau admin, au niveau affiliation, les acteurs et leur
affiliation, tu peux enlever la colonne preuve. »

La table des acteurs de l'affiliation passe de **six à cinq colonnes** : Acteur ·
Catégorie · Articles · Réseaux · **Note**. Sont partis : l'en-tête, la cellule de
chaque ligne (avec son infobulle qui portait les adresses), la variable qui les
rassemblait — elle n'existait que pour cette cellule — et la règle CSS devenue sans
sélecteur.

**Ce qui n'est PAS perdu, et c'est vérifié par une épreuve** : l'adresse qui prouve
la mesure sort toujours par l'**export CSV de l'affiliation** (colonnes `Preuve` et
`Raison`), et `preuvesAffiliation()` reste dans le module — c'est elle que l'export
appelle. « Retiré de l'écran » n'est pas « retiré de partout ».

Deux phrases de l'écran ont été corrigées au même moment, parce que ce retrait ou
celui de la veille les rendait fausses ou ambiguës :

- « Trois états » → « Trois états de **MESURE** », avec la précision que le groupe
  « affiliation faite » n'en est pas un (un lecteur voyait quatre groupes) ;
- « mesuré, **avec l'adresse qui le prouve** » → l'adresse n'est plus à l'écran ;
  la phrase dit maintenant où elle est (l'export CSV).

**Trois défauts de MES OUTILS trouvés en écrivant ce retrait**, tous les trois du
même genre — un contrôle qui passe pour la mauvaise raison :

1. le script de retrait mesurait **la mauvaise table** : ancré sur
   `<tr><th>Acteur</th><th>Catégorie</th>`, il tombait sur le tableau du **plan de
   régularisation**, qui commence pareil et vient avant — et qui a cinq colonnes
   lui aussi, donc le contrôle annonçait « 5 colonnes » **par coïncidence**. Ancre
   corrigée sur `<th>Réseaux</th>`, qui n'existe que dans la table visée ;
2. l'épreuve navigateur a d'abord **concaténé les en-têtes des quatre groupes**
   (vingt titres) et les a comparés aux cinq cases d'une ligne : « 5 cases pour
   20 colonnes ». Elle mesure maintenant **table par table** ;
3. et le plus vicieux : le défaut était compté **avant** la ligne `ok = True` de la
   fonction, donc il était **effacé** — le contrôle affichait « tout est conforme »
   juste après avoir imprimé ses ✗. Les défauts sont maintenant rassemblés et
   intégrés APRÈS l'initialisation.

**Le contrôle a été PROVOQUÉ** pour prouver qu'il mord : la colonne remise dans le
fichier servi, l'épreuve a annoncé ses douze défauts et « il reste des défauts
ci-dessus » — puis le fichier a été restauré, et `public/` == `docs/` vérifié, donc
rien de faux n'a été publié.

**Mesuré dans un vrai navigateur, sur le panneau servi** : les quatre groupes
portent `['Acteur', 'Catégorie', 'Articles', 'Réseaux', 'Note']`, et **chaque ligne
écrit cinq cases** — `tout est conforme`.

**Tests** : 781 (contre 779), **779 réussis**, 2 échecs — les deux mêmes échecs
connus qu'avant ce chantier. 2 épreuves ajoutées (l'absence de la colonne et de sa
variable, la donnée toujours dans l'export, la parité cases/colonnes).

