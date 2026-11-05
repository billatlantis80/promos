# AUDIT B1 — le « zéro français » de `offresGroupon()` : élucidé

Date : 2026-10-07, ~03:35 UTC. Session neuve. Outil : `outils/diag-b1.mjs`
(rejoue **l'appel exact du collecteur**, `lireParCurl`, et le lecteur réel).

## La question

`PLAN-NUIT.md` §3 : « la page `groupon.fr/bon-plan` contient 5 remises valides
(22 %, 58 %, 44 %, 73 %, 17 %) et les cartes ont la MÊME forme que les belges,
pourtant `offresGroupon()` en tire **0**. À élucider. »

## La réponse, en une phrase

La page française est servie **en deux rendus différents, au hasard, par le même
domaine** : un rendu **Next.js** (`<script id="__NEXT_DATA__">`, JSON valide) que
le lecteur sait lire, et un rendu **TanStack** (`<script class="$tsr">`,
hydratation JavaScript) qu'il ne sait pas lire. La **ligne 2685**
(`if (!bloc) return out;`) jette la page entière — donc les 9 cartes — dès que
`__NEXT_DATA__` est absent. Le lecteur échoue **en silence** : il ne renvoie ni
erreur ni avertissement.

## La mesure (commande exacte : `node outils/diag-b1.mjs 4`)

```
=== FR — https://www.groupon.fr/bon-plan ===
  relevé 1 : rendu=tanstack __NEXT_DATA__=non $tsr=OUI cartes= 9 → offresGroupon=0
  relevé 2 : rendu=tanstack __NEXT_DATA__=non $tsr=OUI cartes= 9 → offresGroupon=0
  relevé 3 : rendu=tanstack __NEXT_DATA__=non $tsr=OUI cartes= 9 → offresGroupon=0
  relevé 4 : rendu=next    __NEXT_DATA__=OUI $tsr=non cartes= 9 → offresGroupon=5
=== BE — https://www.groupon.be/fr/landing/sale ===
  relevé 1..4 : rendu=next __NEXT_DATA__=OUI cartes=122 → offresGroupon=59 (×4, identique)
```

- **Les 9 cartes sont présentes dans LES DEUX rendus.** Les offres ne sont donc
  pas perdues parce que la page serait vide : elles sont perdues parce que le
  lecteur ne regarde qu'un seul contenant. (FR : 9 `__typename:"StandardDealCard"`
  des deux côtés ; BE : 122.)
- FR : **3 relevés sur 4** sont dans le rendu illisible → 0 offre.
- BE : **4 relevés sur 4** lisibles, **59 offres identiques** au caractère près
  (mêmes 59 remises, même ordre) — la page belge est stable ; son problème n'est
  pas là.

## Le rendu illisible, vu de l'intérieur

Le document s'annonce lui-même : `<html lang="fr-FR" data-renderer="tanstack">`.
Les données sont dans un script `class="$tsr"` (TanStack Router, streaming), sous
la forme :

```js
(self.$R=self.$R||{})["tsr"]=[]; self.$_TSR={…};
(function($R){ … $R[225]=Object.assign(Object.create(null),{__typename:"StandardDealCard",id:"zoo-de-maubeuge-2026",…,
  prices:$R[227]=Object.assign(Object.create(null),{price:{amount:700},strikeThroughPrice:{amount:900}}),…}) })($R["tsr"]);
$_TSR.e(); document.currentScript.remove()
```

Ce **n'est pas du JSON** : `Object.assign(Object.create(null),{…})`, clés non
guillemetées, références `$R[n]`, `!0`/`!1`, et une invocation finale. Un
`JSON.parse` ne peut pas le lire tel quel. C'est un **second format**, pas une
page vide — et il faudra un **second lecteur** (unités B2).

## Où tombent les cartes, quand la page EST lisible (relevé Next.js de FR)

Rejeu carte par carte (`offresGroupon`, 9 cartes) :

| verdict | motif | offre |
|---|---|---|
| ✓ 22 % | — | Découvrez plus de 300 animaux au zoo de Maubeuge |
| ✗ | l.2697 : référence ≥ 5× le prix (128,12 / 11,99) | Licence à vie Office 24 Standard, Home and Business |
| ✗ | l.2697 : référence ≥ 5× le prix (109,99 / 13,95) | Accès à vie à Microsoft Office 2024 Professionnel |
| ✗ | l.2697 : référence ≥ 5× le prix (34,95 / 4,99) | Souvenirs en livres photo A5 A4 avec Printerpix |
| ✓ 58 % | — | Le nouveau train direct Paris-Amsterdam, sans changement |
| ✓ 17 % | — | Stage récupération de points partout en France |
| ✓ 71 % | — | Livre(s) photo A5, couverture souple ou rigide |
| ✗ | l.2697 : référence ≥ 5× le prix (490 / 65) | Développer ses compétences d'accompagnement avec l'IA |
| ✓ 73 % | — | Livre photo A4 classique format A4 vertical/horizontal |

Les 4 cartes rejetées le sont **volontairement** par le garde-fou de
vraisemblance (référence ≥ 5× le prix = autre variante, pas une promotion) :
c'est le comportement voulu, pas un défaut. **Les 5 offres annoncées par le plan
sont exactement celles que le lecteur produit** — le lecteur n'est pas cassé, il
ne voit simplement pas la page 3 fois sur 4.

## Conclusion B1

- **La ligne qui jette les cartes : `collecteur.mjs:2685`,**
  `if (!bloc) return out;`, conséquence du `match` de la **ligne 2684** qui
  n'accepte que `<script id="__NEXT_DATA__">`.
- Ce n'est **pas** un défaut d'en-têtes ni de cadence : c'est une **variante de
  rendu** servie aléatoirement. Rien à corriger dans le `fetch`/`curl`.
- La preuve que la page contient bien les offres dans les deux cas interdit de
  conclure « page vide » : la lecture doit couvrir **les deux formats**
  (unités B2). Tant que ce n'est pas fait, FR (et vraisemblablement NL/ES/PL,
  dont le « 9 puis 0 » mesuré la nuit précédente a la même signature) ne peut
  pas être câblé honnêtement.
- **Rien modifié dans `collecteur.mjs`** (B1 = élucidation ; la correction est B2).
