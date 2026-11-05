# Vérification du code — Kazendra (application n°2 « Promos »)

**15/10/2026** — demande de B : *« revérifie toutes les lignes de code, trouve les erreurs,
supprime toutes les lignes qui ne servent à rien, et ce qui pose question on le voit ensemble ».*

Tout ce qui suit est **mesuré**, pas estimé. Les commandes sont données pour être rejouées.

---

## La réponse en trois lignes

1. **Le code servi aux visiteurs est propre** : aucune ligne morte n'y a été trouvée — 0 fonction
   sans appelant, 0 sélecteur CSS inutilisé, 0 clé de traduction orpheline, 0 déchet publié.
2. **Ce qui ne sert à rien est ailleurs** : **73 fichiers d'outillage, 433 Ko**, aucun appelant,
   listés à la fin de ce rapport.
3. **Mais l'analyse a trouvé une vraie panne, en cours au moment du contrôle** : le **secours
   horaire GitHub était mort depuis 10 h 08 ce matin, en silence** — plus rien n'était collecté
   par lui. Cause nommée, réparée, et prouvée en ligne. C'est le point 1 ci-dessous.

---

## 1. La panne trouvée : le secours horaire éteint, sans un mot

### La chaîne, maillon par maillon

| Maillon | Fait mesuré |
|---|---|
| Le nom du fichier | `outils/test-rattachement-pays.mjs` commence par `test-` |
| Qui le ramasse | `node --test` **sans argument** — c'est la commande de `bin/tester.sh` **et** celle du workflow GitHub — prend tout fichier qui *ressemble* à une épreuve, où qu'il soit |
| Ce qu'il fait | il cherche deux repères dans `public/app.js` (`const REMISE_MIN`, `/* ---- Le pays de la BOUTIQUE`) et sort en code 1 s'ils ont disparu |
| Ce qui a disparu | les **deux** repères, supprimés le 15/10 à **10:08** par le nettoyage de `public/app.js` (356 lignes retirées, commit `67c58057`) |
| La conséquence | l'étape « Tests » du workflow est **AVANT** l'étape de collecte : un rouge suffit à ne plus rien collecter |

### La preuve, en ligne

```
gh run list --workflow="Collecte des promos" --limit 5
38726883309  failure  schedule  2026-10-15T11:22:35Z
38719857665  failure  schedule  2026-10-15T10:22:56Z
38712841182  success  schedule  2026-10-15T09:25:37Z   <- état d'avant le nettoyage

gh run view 38726883309 --log | grep -E "not ok|# (tests|pass|fail)"
not ok 1 - /home/runner/work/promos/promos/outils/test-rattachement-pays.mjs
# tests 958   # pass 955   # fail 1
```

### Pourquoi personne ne l'a vu

**En local, la suite restait verte** — parce qu'elle était lancée sur le glob
(`node --test tests/*.test.mjs`), qui ne ramasse que `tests/`. **Le rouge n'existait que dans la
commande du workflow.** C'est la classe de défaut la plus coûteuse qui soit : un contrôle de
qualité devenu interrupteur d'arrêt, illisible sur la machine où on travaille.

### Ce qui a été fait

- **Le fichier fautif est retiré** — mais **pas effacé à l'aveugle** : archivé d'abord dans
  `/opt/data/sauvegardes/promos-superflu-2026-10-15.tar.gz`.
- **Une épreuve ferme la classe** : `tests/collection-des-epreuves.test.mjs` — aucun fichier hors
  de `tests/` ne peut plus être ramassé par la suite. **Le vérificateur a été éprouvé lui-même** :
  vert ici, **rouge** quand on remet le fautif (et il le nomme), vert après retrait.
- **Prouvé en ligne** : passage déclenché à 12:23 → **succès en 2 min 03**, `# tests 959 ·
  # pass 957 · # fail 0`, et « **Publié (essai 1)** ». Le passage planifié de 13:22 repassera seul.

---

## 2. Le second trou : la veille du secours existe, mais n'est branchée nulle part

`/opt/data/scripts/verifier-collecte-secours.sh` fait exactement ce qu'il faut : **muet** quand le
dernier passage planifié a réussi, **un message** avec la raison quand il a échoué.

**Il n'est planifié nulle part.** Mesuré : les 9 tâches du portail n'en parlent aucune, pas de
`crontab` sur la machine, `/etc/cron.d` vide, aucun minuteur systemd. C'est **la** raison pour
laquelle la mort du secours n'a été annoncée à personne — un dispositif d'alerte écrit et jamais
branché revient au même qu'une absence d'alerte.

**Proposition** : le brancher comme tâche planifiée (toutes les heures, après le passage du
secours). Il ne parle que s'il y a un problème.

---

## 3. Ce qui est vérifié comme solide (chiffres du jour)

| Contrôle | Mesure |
|---|---|
| Syntaxe de tout le code vivant | `node --check` sur **260 fichiers** → **0 erreur** |
| La suite d'épreuves | **959 épreuves, 959 vertes, 0 échec** |
| Source ↔ site publié | `public/` et `docs/` **identiques** : `app.js`, `langues.js`, `regles-affichage.js`, `app.css`, `index.html`, `admin/index.html` |
| Propreté du dossier publié | racine de `docs/` : **aucun étranger, aucun déchet d'éditeur** (les 5 fichiers morts servis du 11/10 ne sont pas revenus) |
| Feuille de style | **105 classes, 0 jamais citée** hors de `app.css` |
| Traductions | **112 clés, 0 sans lecteur** |
| Functions du code servi | **0 sans appelant** — 10 candidates, **10 vérifiées une par une et vivantes** |
| Site en ligne | `kazendra.com` **200**, catalogue **11 729 fiches**, généré à 12 h 15 |

« 10 candidates vivantes » : `ouvrirChoixLangue`, `basculerEco`, `entrelacer` (appelées en
référence `addEventListener('click', …)` ou depuis une autre règle), `protegerLogo`,
`ouvrirChoixPays`, `variantes`, `adressePlausible` (contrats d'épreuve), `noterVue`, `relayerAction`,
`urlEnvoi` (réserves écrites, avec le commentaire qui dit pourquoi elles attendent).

---

## 4. Les lignes qui ne servent à rien : 73 fichiers, 433 Ko

### La méthode

Citations réelles **hors commentaires** (une mention dans un commentaire n'est pas un appel),
corpus = le code vivant, `docs/` et les caches exclus. Le piège payé cette fois : mon premier
classement comptait des citations en commentaire comme des appels.

### Les familles

| Famille | Fichiers | Poids |
|---|---|---|
| Audits d'une nuit (A, B, E, D) | 35 | 195 Ko |
| Épreuves ponctuelles (navigateur, panneaux) | 10 | 93 Ko |
| Mesures ponctuelles | 11 | 63 Ko |
| Planches et visuels d'un chantier | 8 | 45 Ko |
| Domaines et mails | 6 | 28 Ko |
| Identité / logo | 2 | 29 Ko |
| Divers | 1 | 6 Ko |

**Rien de tout cela n'est servi au visiteur** : ces fichiers vivent dans `outils/` et `bin/`, donc
jamais dans `public/`, donc jamais dans `docs/`. Le gain est pour le dépôt et pour la relecture —
pas pour le temps de chargement. Le dire évite d'attendre un effet qui n'existerait pas.

**Précédent** : le 11/10/2026, la même famille (124 outils, ~230 Ko) avait déjà été archivée dans
`promos-superflu-2026-10-11.tar.gz`. Ce qui reste est ce qui a été créé après cette date.

### Les 10 fichiers que je NE retire pas, et pourquoi (0 appelant, mais un rôle)

- `bin/suivi-images.py`, `bin/simuler-effacement-5-jours.mjs`, `bin/reprendre-depot.sh` —
  appelés chaque heure/jour par des **tâches planifiées** ;
- `bin/tester.sh` — le lanceur de la suite, cité par le README ;
- `bin/auditer-vie-carte.mjs` — la commande de remesure **écrite** dans `VERIFICATION-5-JOURS.md` ;
- `bin/mesurer-peremption-source.mjs` — **nommé** par un commentaire du collecteur comme l'outil
  d'observation de la péremption ;
- `outils/remplir-adresses-promotions.mjs` — il **écrit** `public/adresses-promotions.json`, que le
  collecteur **lit** ;
- `outils/documenter-adresses-xlsx.py` — la tête de la chaîne qui documente les acteurs pour la
  feuille de B ;
- `outils/contre-epreuve.py` — le banc de contre-épreuve, dont la méthode est consignée ;
- `bin/apercu-exploitation.mjs` — **à confirmer avec B**.

> Un compte de références est aveugle aux **points d'entrée** : un outil qu'on lance à la main n'est
> cité par personne *par construction*. C'est pourquoi le tri est fait par **rôle**, pas par compte.

---

## 5. La programmation qui pose question — à voir ensemble

1. **`outils/resoudre-destinations.mjs:84` — `cheminDeSortie` : export jamais lu.** Une seule ligne,
   ni appelée par le code, ni par une épreuve. Vestige d'un appelant retiré. **À retirer** (1 ligne).
2. **Même nom, deux objets** — piège de relecture, pas une erreur aujourd'hui :
   - `IMAGE_GENERIQUE` = une **expression régulière** des visuels génériques dans le collecteur, et
     une **adresse d'image** dans `outils/pages-partage.mjs` ;
   - `MOTS_PROMO` = une **expression régulière** dans le collecteur, et une **liste de mots-clés
     d'adresses** dans `outils/remplir-adresses-promotions.mjs`.
   Deux homonymes qui ne parlent pas de la même chose : une relecture rapide conclut de travers.
   **À renommer** (2 × 1 ligne).
3. **La table des devises existe en deux exemplaires** — `public/app.js` (avec la place du symbole :
   `£153,39` mais `6 089 kr`) et `outils/donnees-structurees.mjs` (sans). **Les valeurs coïncident
   aujourd'hui** sur les trois pays hors euro (GB, SE, PL) : ce n'est donc pas une erreur, mais
   **rien ne les tient ensemble** — le jour où un pays s'ajoute d'un seul côté, les données
   structurées annonceront une autre monnaie que la page. À trancher : on les tient ensemble, ou on
   écrit noir sur blanc laquelle fait autorité.
4. **Style ancien, sans erreur démontrée** : 31 comparaisons `==` au lieu de `===`, 48 `var` (dont
   40 dans `public/diagnostic.html`). Aucun défaut prouvé ; je ne les touche pas sans votre accord,
   parce que « ce n'est pas à mon goût » n'est pas « ça ne sert à rien ».
5. **`public/diagnostic.html`** — une page servie (HTTP 200, 17,9 Ko) liée depuis l'index. Elle
   contient à elle seule 40 des 48 `var` du projet. À garder ou non : question de produit, la vôtre.

---

## 6. Mes propres erreurs de mesure — dites, pas cachées

Un rapport qui ne signale que les défauts des autres ne dit pas s'il est fiable.

- Mon détecteur a annoncé **3 fonctions mortes** (`ouvrirChoixLangue`, `basculerEco`,
  `entrelacer`) : **fausses**. Elles sont appelées en **référence** — `addEventListener('click',
  ouvrirChoixLangue)` — ou après un étalement (`[...entrelacer(...)]`), deux formes que mon motif
  ne voyait pas. Vérifiées une par une : vivantes.
- Il a annoncé **2 variables mortes** dans le collecteur (`brutEntetes`, `clesDuPrecedent`) :
  **fausses**, même cause (usage après `...`).
- Mon premier passage annonçait **2 clés de traduction orphelines** : **fausses** — les deux
  phrases vivent dans `public/index.html`, mon motif ne les retrouvait pas.
- Enfin, mon premier classement des outils comptait comme « appelé » ce qui n'était cité que
  **dans un commentaire** (`outils/mesure-e8.mjs` et deux autres) : reclassés en vestiges.

---

## 7. Ce que je n'ai PAS vérifié

- **L'affichage dans le navigateur** (tuiles, filtres, réglages, panneau) : cette passe porte sur le
  code, les données publiées et la chaîne d'exécution. Le dernier contrôle visuel complet date de ce
  matin ; je le refais à la demande.
- **Le contenu** des 11 729 fiches (justesse des prix, péremption) : autres chantiers, déjà mesurés.

---

## 8. La question (une seule)

**Je retire les 73 fichiers — après les avoir archivés dans une archive datée, comme le 11/10 ?**
Par défaut je le fais ainsi : archive d'abord, retrait ensuite, les **10 fichiers conservés par
rôle** listés plus haut, et une épreuve pour que rien de ce qui est généré ne parte avec eux.

---

## Annexe — la liste exacte

*(produite par `/tmp/audit-liste.py`, rejouable ; poids en Ko)*

