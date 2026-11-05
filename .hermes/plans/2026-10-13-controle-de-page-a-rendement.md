# Le contrôle de page lit à rendement — décision d'efficacité (13/10/2026)

**Question de B** : « Prends la décision la plus réaliste et la plus efficace pour
gagner en efficacité, efficacité tant au niveau de l'utilisateur que au niveau des
entreprises chez qui nous prenons les informations. »

**Réponse tenue : ne pas lire plus — lire mieux.** Le budget de lecture reste
**3 pages par passage (288/jour)**, donc **zéro requête supplémentaire** chez les
partenaires. Ce qui change est *où* ces lectures tombent, et *quand* une fiche
entre dans la file.

## Les mesures qui ont tranché (13/10/2026, catalogue réel)

| mesure | chiffre |
|---|---|
| offres resservies par les flux en 24 h | **3 976** |
| offres stockées | 22 498 |
| file du contrôle avant la décision (> 7 j de silence) | 4 574, **toutes jamais contrôlées** |
| nouvelles entrées par jour dans cette file | ~2 820 |
| lectures par jour (3 × 96 passages) | 288 → le tour durait **15,9 jours** |
| requêtes utiles avant la décision | **3 lectures → 0 décision** (« 3 sans verdict ») |
| requêtes utiles après la décision | **3 lectures → 2 à 4 décisions** |

## La décision, en trois pièces

1. **Un délai d'entrée court pour les communautés (3 jours), long pour les
   enseignes (7).** Motif : les flux resservent ~4 000 offres par jour — passé
   trois jours de silence, une offre n'est plus dans la fenêtre de sa source.
   Et la page d'une **communauté** (Dealabs, mydealz, chollometro, pepper,
   hotukdeals, preisjäger) publie son verdict (`"isExpired"` — vérifié à la main
   sur la fiche signalée), tandis qu'une page d'**enseigne** n'en publie aucun.
   ⚠ Ce délai **ne retire rien** : il ne dit que *qui entre dans la file*. Le
   retrait reste commandé par le verdict de la page. C'est ce qui rend la
   décision sans risque.
2. **Le budget se partage par famille : 2 lectures communautaires + 1 enseigne.**
   Sans cette règle, « les communautés d'abord » affamerait la règle de la page
   pour les enseignes (demande de B le même jour).
3. **L'ordre suit ce que l'utilisateur voit : le pourcentage montrable
   décroissant** (l'ordre exact de la vue « % décroissant »), puis le silence,
   puis l'empreinte. Deux enseignements payés en la construisant :
   - « le plus silencieux d'abord » **ne marche pas** : la fiche signalée par B
     (5 j de silence) arrivait derrière ~10 000 fiches plus silencieuses — le
     silence est une distribution plate (le stock n'a que six jours) ;
   - trier sur `remise` **brut** ne marche pas non plus : les deux premières
     lectures visaient 99 % et 91 %, deux pourcentages que la carte refuse
     d'afficher. L'ordre se lit donc sur `pourcentAffiche`, copie fidèle de
     `remiseMontrable` d'`app.js`, et une épreuve compare les deux
     implémentations sur **tout le catalogue publié**.

## Ce qui a été vérifié

- `node --test` : **929 épreuves, 929 passent** (dont 3 nouvelles : entrée à
  3 jours / 7 jours, l'ordre de la vue, et l'égalité des deux implémentations).
- Passage exécuté à la main (`bin/collecter.sh`) : **code 0**, publié et poussé.
- **Sur GitHub** : `collecteur.mjs` = 520 621 octets (le code neuf y est), commit
  `6ca5f3a02`.
- **Au premier passage** : « Verdict des pages : 3 contrôle(s) — **1 expirée(s)**,
  1 vivante(s), 1 sans promotion, **0 sans verdict** », puis « **2 expirée(s)** »
  au passage suivant du planificateur. Avant : « 3 sans verdict », zéro décision.
- La fiche signalée par B : **rang 32** dans la file → lue dans les ~4 heures
  (elle était derrière ~10 000 fiches avec l'ordre « silence »).

## Ce qui reste ouvert, dit franchement

- La file communautaire (≈ 9 900 fiches à plus de 3 jours de silence) reste
  **plus grande que ce que 288 lectures/jour balaient** : le fond de la file se
  compte en semaines. Ce qui est protégé, c'est **le haut de ce que l'utilisateur
  voit** — les 43 fiches à ≥ 70 % sont lues en quelques heures, la bande suivante
  en quelques jours.
- Si B veut un balayage complet, le seul levier est le **trafic** (7 ou 28
  lectures par passage = +95 à +700 Mo/jour) — contre sa propre règle de
  discrétion. Il a choisi l'efficacité des deux côtés : ce document garde ce
  chiffre pour le jour où il voudra rouvrir la question.
- Le champ `marchand` de la fiche signalée vaut « b : » (cas isolé) : la carte,
  le bouton « Voir chez b : » et l'aperçu du lien l'affichent tel quel. Non
  traité ici, à part.
