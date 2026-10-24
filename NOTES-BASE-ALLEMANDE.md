# La base allemande, et ce qu'elle a révélé

09/10/2026. Demande de B, mot pour mot : « **Peux-tu rajouter cette base de
données, au pays concerné dans le tableau admin, tu devras aussi chercher toutes
les affiliations possibles et les introduire dans l'onglet affiliation.** »

Le tableur fourni : 182 entreprises du commerce et de la consommation en
Allemagne, 22 catégories, 13 colonnes — même structure que le tableur belge.

---

## 1. Ce qui est dans le panneau

| | avant | après |
|---|---|---|
| acteurs de la base | 165 | **346** |
| dont tableur belge | 139 | 139 |
| dont tableur allemand | — | **182** |
| dont ajoutés par l'application | 26 | 25 |
| catégories | 23 | **24** |
| pays au choix | 12 | 12 (l'Allemagne passe de 1 à **182** acteurs) |

- Le tableur est versionné tel quel : `donnees/marche-de-2026-10-08.xlsx`.
  On ne réécrit jamais la pièce fournie par B.
- `outils/acteurs-depuis-xlsx.py` est devenu **multi-pays** : une ligne dans
  `SOURCES` = un marché. Rien d'autre à toucher pour ajouter un pays.
- `public/acteurs.json` publie `sources`, `paysCouverts`, et le `pays` de chaque
  acteur. Les onglets **Marché Euro** et **Affiliation** n'ont eu besoin
  d'aucune modification : ils lisent déjà le pays de chaque acteur.
- MyDealz a changé de provenance : il vient maintenant du tableur allemand, donc
  il n'est plus compté comme « ajouté par l'application ».

### Les 5 acteurs allemands sans site

GameStop Allemagne (fermé), FTI Group (insolvable), Erlebnisparks régionaux,
weiter Reisen, Space Games. Leur case « Site web » porte « fermé », « à
vérifier », « divers » ou « — ». Ils restent dans la base **sans domaine** :
les écarter perdrait de l'information, leur inventer une adresse serait pire.
Ils ressortiront « non mesuré — aucun domaine » dans l'Affiliation, et c'est la
vérité.

---

## 2. Le défaut que l'ajout a révélé — et qui est de nous

**Deux tableurs nomment les mêmes enseignes.** Lidl, Zalando, MediaMarkt, C&A,
Ryanair, Lufthansa, Primark, HelloFresh, Action, Eurowings, Marley Spoon,
Wizz Air existent en **BE et en DE**, avec **deux sites différents**
(`lidl.be` / `lidl.de`). Douze noms, deux marchés.

En croisant la base allemande avec les sources, le panneau a relié les acteurs
allemands aux sources **belges** du même nom. Mesuré :

```
23 754 articles attribués  pour  15 322 offres
```

Même faute que le ×10 de Coolblue, un an plus tard et par une autre porte.

**Ce qui a été corrigé, dans `public/acteurs.js` :**

1. **Une source appartient au marché qu'elle lit.** Le chemin par **nom** (le
   seul possible pour les sources de veille, qui passent par un moteur) est
   désormais filtré par le pays. Le chemin par **domaine** reste le juge : c'est
   lui qui distingue `lidl.de` de `lidl.be`.
2. **Les articles se comptent par (site, marché)**, jamais par nom seul. Quinze
   entrées différentes s'appellent « Amazon » — une par marché. Compter par nom
   attribuait à `Amazon.de` les articles d'Amazon Belgique, de France, d'Italie.

**Effet mesuré sur les lignes belges** (6 lignes sur 164) :

| acteur | avant | après | pourquoi |
|---|---|---|---|
| Amazon Belgique (.com.be) | 4 208 | **1 484** | ne comptait que les articles d'Amazon.com.be |
| Pepper NL | 1 563 | 454 | les articles des Pays-Bas, pas ceux de Pologne |
| Pepper PL | 1 563 | 1 109 | idem |
| Social Deal & Outspot | 239 | 60 | les articles belges |
| Coolblue | 66 | 17 | les 8 pages belges, pas les néerlandaises et l'allemande |
| Zooplus.be | 76 | **0 → non suivi** | le catalogue ne lit **pas** zooplus.be : la liaison se faisait sur le nom, avec les sources Zooplus **allemandes**, italiennes et suédoises |

C'est le seul cas qui **retire** une ligne de la colonne « branchés » : Zooplus
belge n'est en réalité pas lu. C'est une information de travail, pas une panne.

**Trois épreuves neufves** verrouillent la règle : le total attribué ne peut pas
dépasser ce que le catalogue contient ; un acteur allemand ne doit jamais être
relié à une source belge ; l'index des mesures est indexé par (nom, pays) et non
par nom.

---

## 3. Ce qui reste vrai et qu'il faut savoir

- **Amazon.de et « Amazon (livres) »** sont deux lignes du tableur allemand pour
  le même site (`amazon.de`). Elles partagent donc la même source, et chacune
  affiche le volume d'Amazon Allemagne. C'est la granulation de B, pas un
  doublon de notre fait.
- **AIDA Cruises** est aussi deux lignes (Croisières et Voyages), une seule
  entreprise : **une seule mesure** pour les deux lignes. Le fichier de mesure
  peut donc compter moins d'entrées que la base — c'est une propriété, et un
  test l'exige pour qu'on n'invente pas une seconde mesure.
- **L'Allemagne est surveillée, pas branchée** : 4 acteurs branchés sur 182
  (mydealz, Amazon.de, Amazon livres, Zooplus), 0 en veille. Le catalogue
  allemand vit de ses propres sources (MyDealz, Amazon DE, Zooplus DE, Social
  Deal DE) et de trois requêtes Google News et Bing génériques — aucune
  enseigne allemande n'est surveillée nommément. C'est la liste de travail.

## 4. Le piège de la fusion, payé une fois

La mesure d'affiliation fusionne avec les mesures existantes. La clé était
écrite **deux fois à la main** : `nom|pays` d'un côté, `pays|nom` de l'autre.
Aucune ne correspondait — les 165 mesures belges ont été déclarées orphelines et
effacées par le balayage, sans un seul message d'erreur.

Deux corrections, posées dans `outils/mesure-affiliations.mjs` :

1. **une seule fonction de clé** (`cleMesure`), utilisée partout ;
2. **un garde-fou** : au-delà de 5 mesures perdues (et de 5 % du fichier), la
   commande **échoue** au lieu d'écrire. Un chantier de deux passes ne se perd
   pas à cause d'une clé.

Et une troisième, dans `outils/rendus-navigateur.py` : un **échantillon**
n'écrase plus la mesure publiée (`--pays DE --echantillon 10` avait remplacé
les 347 lignes en ligne par dix).
