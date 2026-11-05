# Vérification des deux gros chantiers — durée de vie des fiches, poids des images

**Demande de B** (13/10/2026, mot pour mot) : « peux-tu vérifier tout ce qui a été
mis en place depuis le début concernant ces deux points, peux-tu vérifier afin
d'améliorer le codage ligne par ligne, regarder si ça a été poussé dans le
système, et me faire un rapport détaillé des règles qui ont été écrites pour ces
deux catégories. On commence d'abord par la règle de la durée de vie des fiches,
ensuite dans cet ordre on attaque la partie graphique. »

## 0. Les quatre relevés qui font foi (aucun de mémoire)

| relevé | résultat |
|---|---|
| `node --test` | **934 / 934** vertes (929 avant les 5 ajouts du jour) |
| dépôt | tête locale = `origin/main` = `7070150a5`, **0 commit d'avance** |
| en ligne | fiche masquée → **HTTP 404** · fiche affichée → **HTTP 200** · `offres.json` annonce **17 865** affichées |
| journal du passage 16:01 | les lignes des règles, citées au § 2 |

## 1. LA RÈGLE — durée de vie d'une fiche, telle qu'elle tourne

Trois régimes, un par catégorie de source (jamais un délai unique) :

1. **Communautés** (Dealabs, myDealz, hotukdeals, chollometro, pepper,
   preisjäger) — **3 jours** sans service → entrée dans la file de contrôle.
   Lecture de la page : **3 lectures par passage** (2 communautés + 1 enseigne),
   ~100 Ko par page (0,37 Mo au dernier passage).
   - `isExpired: true` → **la fiche sort du stock** (preuve écrite par la page) ;
   - **404 / 410** → morte, la fiche sort ;
   - **403 / 429 / 5xx, captcha, panne** → illisible, **rien ne bouge** ;
   - promotion confirmée → la fiche reste (voir le défaut D5).
2. **Enseignes** (Amazon, bol, Krefel…) — **7 jours** sans service → file. Ces
   pages ne publient aucun verdict : elles restent en **observation**.
3. **Dans tous les cas** — **7 jours sans qu'aucune source ne l'ait resservie →
   la fiche est masquée** (drapeau `perimee`, posé le 13/10 à 15 h 50). Elle
   revient toute seule dès qu'une source la resert. Rien n'est effacé du stock.

Deux règles voisines, qu'on ne rabote pas :

- **articles de veille** : 7 jours sur la **date de publication** (allumé le
  12/10 sur le « vas-y » de B) — ils ne reviennent pas, leur verrou est immuable ;
- **rétentions hors collecteur** : originaux d'entretien des visuels **7 j**,
  historique des prix **60 j**, journal **1 000 lignes**, trafic **24 h**.

État au dernier passage (16:01) : `Plafond 7 jours (VOLET OFFRES : MESURE, rien
effacé) : 4 696 offre(s) sans service depuis plus de 7 jours — 77,1 Mo d'images`
puis `Fiches non confirmées : 4 696 ne sont plus AFFICHÉES`.

## 2. Où les règles sont écrites (cinq endroits)

1. **Le collecteur lui-même** — un bloc de commentaires au-dessus de chaque
   interrupteur. C'est la loi du fichier.
2. **Cinq interrupteurs, un par décision** : `PLAFOND_OFFRES_ACTIF = false` (le
   silence, mesuré à ~48 % de faux positifs) · `VEILLE_SEPT_JOURS_ACTIVE = true`
   (12/10) · `OFFRES_SORTENT_SUR_VERDICT_ACTIF = true` (13/10, 13 h 14) ·
   `PROMOTION_DECIDE_LA_CARTE_ACTIF = true` (les 4 branches de B) ·
   `PRIX_COMMUNAUTE_ACTIF = false` (« attends que la mesure ait vu davantage »).
3. **Les plans du jour** dans le dépôt (`.hermes/plans/`).
4. **L'état publié** lu par le panneau : `docs/etat-collecte.json`, bloc
   `plafond7j`.
5. **Les épreuves** (934) qui tiennent les valeurs ET la forme du code.

## 3. Ce que la vérification ligne par ligne a trouvé

### Corrigé et poussé le jour même (commit `7070150a5`)

- **D1 — trois commentaires disaient le contraire du code.** Lignes 1113, 1345 et
  8126 : « le retrait est éteint », « EN MESURE SEULEMENT », alors que
  `OFFRES_SORTENT_SUR_VERDICT_ACTIF` est allumé depuis 13 h 14. Un commentaire
  qu'on croit est pire qu'une absence de commentaire. Réécrits avec la date et
  le motif.
- **D2 — la règle la plus visible de B n'avait aucune épreuve.** Le drapeau
  `perimee` masque 4 696 fiches et n'était tenu par rien (seule l'absence des
  pages de partage l'était, ailleurs). **5 épreuves ajoutées** : posé par la
  seule fonction de délai · levé tout seul au retour · compteurs recalent
  (`total`, `totalOffres`, `parPays`) · filtre unique dans `appliquerDonnees` ·
  invariant vérifié sur le catalogue publié (chaque fiche masquée est au-delà du
  délai, aucun article n'est visé).
- **D3 — trois plans du 13/10 ne vivaient que sur le disque**, dont celui du
  masquage. Cause structurelle : le robot ne pousse que `docs` et `public` ; le
  code et les plans ne partent que sur un commit explicite. Versionnés.

Vérifié sur GitHub : `collecteur.mjs` = **525 522 octets**, fichier d'épreuves =
**39 094 octets**, plan du masquage présent.

### Non corrigé — demande un mot de B

- **D4 — le panneau contredit l'écran.** `plafond7j` porte toujours
  `mode: "mesure"` et `effacees: 0`, et **nulle part le nombre de fiches
  masquées**. Le panneau lit ce bloc : il annonce donc une règle qui mesure
  pendant que 4 696 fiches ont quitté l'écran. C'est le grief du 08/10 (« deux
  chiffres pour la même grandeur »). Le nom du champ à publier dépend du choix
  ci-dessous.
- **D5 — le défaut de fond, et il est de mon fait.** B, le 12/10 : « si sur le
  site internet d'origine de l'annonce, elle est toujours présente le 8e jour,
  elle devra réapparaître sur notre site, pour 7 nouveaux jours ». Depuis le
  drapeau, une fiche dont la page vient d'être lue et confirmée **encore en
  promotion** est masquée au 7e jour de silence : la preuve datée est bien
  enregistrée (`donnees/verdicts-sources.json`), mais **elle ne remet pas le
  compteur à zéro**. Avant le drapeau, « non supprimée » voulait dire
  « affichée » : c'est le masquage qui a introduit la régression. Correctif prévu
  (c'est la lettre de la règle de B) : une page qui **prouve** la promotion
  remet sept jours pleins, horodatés. Statuts qui prouvent : `vivante`,
  `confirmee`, `corrigee`, `prix-ecarte`. Statuts qui ne prouvent rien et
  n'étendent pas : `sans-signal` (page muette).
- **D6 — le lien avec les images.** La demande écrite du 12/10 était « toutes les
  images et tout ce qui est en rapport avec l'annonce qui dépasse 7 jours doit
  être effacé ». La décision du 13/10 a fait l'inverse (drapeau, rien d'effacé)
  pour que le retour ne coûte aucun téléchargement. Conséquence mesurée :
  - **4 660 visuels (77,1 Mo) restent publiés** et restent dans l'historique git ;
  - **4 661 fiches restent dans `offres.json`** : ~20 % du fichier que **chaque
    visiteur** télécharge est invisible à l'écran (≈ 0,8 Mo compressés par
    visite, ≈ 8 Go/mois à 10 000 visites, pour 100 Go tolérés) ;
  - le nombre de fiches masquées **croît à chaque passage** (4 661 → 4 696 en
    11 minutes) : le catalogue publié continue de grossir pendant que l'écran
    rétrécit.

## 4. La question posée à B (une seule)

Que fait-on des fiches masquées et de leurs 77,1 Mo de visuels ?

- **A.** rien (retour gratuit, le visiteur paie ~0,8 Mo par visite) ;
- **B.** retirer les fiches masquées du **catalogue publié** en **gardant** les
  visuels sur le site : le visiteur ne les télécharge plus, le retour reste
  gratuit (il faut une exception explicite au ménage des orphelins) ;
- **C.** effacer aussi les visuels, comme la demande du 12/10 : 77 Mo rendus,
  mais un retour coûte un re-téléchargement. `revenus` = 0 (aucun retour
  enregistré) — mesure encore trop jeune pour trancher.

Recommandation tenue : **B**, plus **C pour les fiches dont la page s'est
déclarée expirée** (celles-là ne peuvent pas revenir).

## 5. Partie graphique — vérifiée, rapport détaillé à suivre

Relevé du même jour, pour mémoire : site publié **671,4 Mo** (66 % du seuil de
1 024 Mo) · `docs/img` **20 140 visuels, 587 Mo**, moyenne 29 Ko · **214 fichiers
> 200 Ko** (86,9 Mo) · plafond d'entretien **1 000 px**, seuil **60 Ko**, gain
minimum **15 %**, transparences respectées, archive des originaux 7 j, verrou +
délai 150 s + code de sortie toujours nul · `.git` = **3,1 Go** (le seul poste
qu'aucune passe ne réduit) · cache de Pages limité à **600 s par fichier**.
Le détail des règles, des mesures et des défauts de cette partie est le
livrable suivant, dans l'ordre demandé par B.
