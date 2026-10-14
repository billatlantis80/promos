# La base française, et ce qu'elle a changé

09/10/2026. B avait annoncé « un fichier espagnol prêt » : le fichier envoyé était
en réalité **la France** (263 acteurs, 22 catégories, les mêmes 13 colonnes que les
tableurs belge et allemand). Il l'a confirmé : « C'est bien pour la France ».

Le tableur est versionné tel quel : `donnees/marche-fr-2026-10-08.xlsx`.
On ne réécrit jamais la pièce fournie.

---

## 1. Ce qui est dans le panneau

| | avant | après |
|---|---|---|
| acteurs de la base | 346 | **609** |
| dont tableur belge | 139 | 139 |
| dont tableur allemand | 182 | 182 |
| dont tableur français | — | **263** |
| dont ajoutés par l'application | 25 | 25 |
| libellés de catégorie | 24 | **36** |
| pays au choix | 12 | 12 (la France passe de 1 à **264** acteurs) |

Ajouter un pays s'est fait en **une ligne** dans `SOURCES`
(`outils/acteurs-depuis-xlsx.py`) : `{"pays": "FR", "fichier": "marche-fr-2026-10-08.xlsx"}`.
Les onglets **Marché Euro** et **Affiliation** n'ont eu **aucune** modification —
ils lisent déjà `a.pays` sur chaque acteur. C'est la récompense d'avoir posé l'axe
pays dès le premier jour.

---

## 2. La France, chiffres mesurés

| | |
|---|---|
| acteurs recensés | 264 |
| **programmes trouvés** | **31** |
| non mesuré (à vérifier à la main) | 62 |
| aucun signe trouvé | 171 |
| branchés (lus par le catalogue) | 5 |
| non suivis | 259 |

**Réseaux qui comptent en France** (sur les 31 programmes trouvés) :
Tradedoubler 6 · Amazon Partenaires 4 · Affilae 3 · Impact 3 · Awin 3 ·
Kwanko 2 · Adcell 1 · belboon 1 · Rakuten Advertising 1 · Smartclip / Sovendus 1 ·
TradeTracker 1 · Webgains 1.

Quelques programmes trouvés : ManoMano, Veepee, Castorama, Truffaut, Promod,
TUI France, HelloFresh France, Uber Eats France, Eurostar, Foot Locker France,
eDreams ODIGEO, lastminute.com, Maxi Zoo, Ultra Premium Direct, Zooplus / Bitiba.

### Pourquoi 62 « non mesurés » — et pas « aucun signe »

C'est la distinction la plus importante du panneau. **64 sites français refusent la
mesure automatique** (HTTP 403/429 : Fnac, Darty, Kiabi, Maisons du Monde, Oscaro,
Boulanger…) et **23 répondent une page montée en JavaScript**. On ne sait donc rien
d'eux. Les ranger avec les 171 « aucun signe » ferait écrire B à des enseignes qui ont
peut-être un programme — un faux « aucun signe » est le mensonge le plus coûteux.

La seconde passe au navigateur (240 pages rendues, `outils/rendus-navigateur.py`) a
finalement lu 179 d'entre elles et fait remonter **15 programmes de plus** (16 → 31).
Les 61 pages restées inaccessibles sont honnêtement « non mesurées ».

---

## 3. Les collisions de noms — mesurées, et volontairement NON fusionnées

**32 enseignes portent le même nom dans plusieurs pays** avec deux sites différents :
Autodoc, BlaBlaCar, CroisiEurope, Decathlon, Electro Dépôt, Fnac, GrandOptical,
Intermarché, JouéClub, Kiabi, LDLC, Les Numériques, Maisons du Monde, Mr.Bricolage,
Ryanair, Shein, Starlink, Temu, Volotea, Yves Rocher, Zalando, easyJet… (BE↔DE↔FR).

Ce sont **deux marchés** : on ne les fond pas (la clé est `(nom, pays)`), et chaque
ligne garde **sa** mesure. Ajouter la France n'a **rien** changé aux mesures
belges et allemandes — **0 changement d'état** sur les acteurs déjà mesurés
(vérifié en comparant au commit précédent).

**Un seul doublon à l'intérieur de la France** : « Cdiscount » figure deux fois
(grande distribution et e-commerce), même site `cdiscount.com` — donc **une seule
mesure pour les deux lignes**, exactement comme « AIDA Cruises » en Allemagne. Le
fichier de mesure compte donc **607 entrées pour 609 lignes de base** : c'est une
propriété, pas une perte, et une épreuve l'exige.

---

## 4. Un défaut de forme signalé, pas corrigé

Les **libellés de catégorie français sont plus courts** que ceux des deux autres
marchés : « Bricolage, Jardin & Extérieur » (FR) là où le belge écrit
« Bricolage, Jardin & Aménagement Extérieur » ; « Presse, Tests & Comparateurs »
là où BE/DE écrivent « Presse, Tests Produits & Annonces Promo » ; « Tourisme en
France » là où l'Allemagne a « Activités Touristiques & Séjours en Allemagne ».

La base porte donc **36 libellés** pour ce qui est, au fond, une vingtaine de
secteurs. L'écran reste juste — chaque pays montre SES catégories, groupées par
pays — mais deux marchés ne rangent pas les mêmes métiers sous le même mot.
**On n'a pas touché aux libellés** : ils viennent du tableur de B, et les renommer
serait modifier sa pièce. À trancher si un jour on veut une vue transverse
« catégorie commune à tous les pays ».

---

## 5. Épreuves

- `tests/*.test.mjs` : **567 / 567**. Quatre épreuves figeaient une taille
  (346 → 609, 321 → 584) et la liste des tableurs : reprises **dans le même commit**,
  jamais après.
- `outils/epreuve-panneau-pays.py FR` : **tout est conforme**. Partition vérifiée
  dans un vrai navigateur — 23 catégories totalisent 264 acteurs ; 31 + 62 + 171
  retombent sur 264 ; les deux onglets annoncent les mêmes 12 pays ; la somme des
  pays retombe sur 609.
