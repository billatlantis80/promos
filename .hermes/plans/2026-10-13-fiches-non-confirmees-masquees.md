# Les fiches non confirmées ne sont plus affichées — 13/10/2026

**Demande de B**, mot pour mot : « Moi je veux que tu règles les problèmes des
fiches qui sont encore affichées sur le site et qui ne sont plus valables. »

## Le défaut, mesuré avant d'écrire une ligne

- deux fiches signalées par B à la main, leurs pages lues : la première
  (`ddf9d7a41e0badbac7cd8`, « Via App » Carrefour) portait **`"isExpired": true`**
  chez sa source, et la promotion courait **9-10 octobre** ;
- **4 661 fiches publiées** (20 % du catalogue) n'avaient plus été servies par
  aucune source depuis plus de sept jours ;
- le contrôle qui lit les pages rendait « **3 sans verdict** » par passage : il
  dépensait trois requêtes chez les partenaires pour **zéro décision**.

## Ce qui a été fait

**1. Un drapeau, pas une suppression.** Le collecteur pose `perimee: true` sur
toute fiche que plus aucune source ne confirme depuis 7 jours (la fonction de
délai du fichier, `donneesPerimees` — celle qui compte déjà le plafond, donc les
deux ne peuvent pas désigner deux ensembles différents). La fiche **reste entière
dans le catalogue** : prix, visuel, historique.

- l'application ne l'affiche plus (`appliquerDonnees`, un seul point d'entrée :
  puces, bandeau, pays et recherches suivent le même ensemble) ;
- **aucune page de partage n'est écrite** pour elle → le générateur a **purgé
  4 659 pages** (22 521 → 17 862) ;
- les pages de rubrique (statiques, indexées) et le plan du site l'ignorent ;
- **les compteurs ont été recalés** : total annoncé = 17 865 = affichées. Un
  compteur qui compte des fiches cachées est le pire des mensonges — il ne se
  voit qu'en comparant deux écrans (c'est celui que B avait signalé le 08/10).

**2. Pourquoi un drapeau et pas un effacement** — trois raisons, chacune vérifiée :

- **la règle du retour de B est respectée** : dès qu'une source reservit la fiche,
  sa fraîcheur est réécrite et le drapeau disparaît tout seul — elle repart
  affichée pour sept jours pleins ;
- **le visuel n'est pas purgé** (la fiche est toujours dans le catalogue) : le
  retour ne coûte **aucun téléchargement**. C'est le piège que la fiche de méthode
  signale pour toute suppression de masse ;
- **réversible sans collecte** : effacer le champ suffit.

**3. Le contrôle de page lit désormais là où ça décide** (voir le plan du même
jour) : le budget reste 3 lectures/passage, mais 2 vont aux communautés et 1 aux
enseignes, et l'ordre suit le pourcentage montrable — ce que la vue
« % décroissant » montre en tête. Résultat au premier passage : `1 expirée,
1 sans promotion` puis `2 expirées`, là où les passages précédents rendaient
« 3 sans verdict ».

## Vérifié

- `node --test` : **929 / 929**.
- Passage exécuté à la main : code 0, publié, poussé. **Sur GitHub** :
  `collecteur.mjs` = 524 342 octets, commit `3131c0f88`.
- **En ligne** (relevé, pas supposé) :
  - `https://kazendra.com/o/ddf9d7a41e0badbac7cd8.html` → **HTTP 404** ;
  - `offres.json` servi : 22 528 fiches, **4 661 masquées**, total annoncé
    **17 867** = affichées ;
  - pages de partage du dépôt : 17 862 (4 659 retirées).

## Ce qui reste, dit franchement

- La fiche « b : » (`d45574d695cea0e50c967`) est encore affichée : elle n'est
  silencieuse que depuis **5,02 jours** (la règle de B est à 7). Le contrôle la
  lit dans les heures qui viennent (elle est au **rang 32** de la file) et, sa
  page répondant `isExpired`, elle sortira **sur preuve** — sinon la règle des
  7 jours la masquera d'elle-même le 15/10 à 15 h 25.
- Un quart environ des 4 661 fiches masquées peuvent encore être valides chez leur
  source (mesure antérieure : ~48 % de faux positifs sur le signal du silence).
  Elles ne sont pas perdues : elles reviennent d'elles-mêmes au premier service
  de leur source, ou quand le contrôle lira leur page.
- Le champ `marchand` « b : » de la fiche signalée reste un cas à traiter à part.
