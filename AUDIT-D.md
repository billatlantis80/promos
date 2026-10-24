# AUDIT-D — LIVRAISON (D1 publication, D2 APK/AAB)

> Session neuve, **2026-10-07 05:02 UTC**. Règle de sauvetage appliquée : à
> 05:00 UTC il ne restait que **2 passages avant 05:45** (05:15, 05:30) → saut
> direct à la phase **D**. Tout chiffre ci-dessous vient d'une commande de
> **cette** session.

## D1 — Publier et vérifier la synchronisation

`bash bin/collecter.sh` (exécuté le 07/10 ~05:02 UTC) : **exit 0**, sortie
**silencieuse** (= succès, le script ne parle qu'en cas de panne).

- Dernière collecte publiée : `docs/offres.json` `genereLe` =
  **2026-10-07T05:02:04.188Z**, **9 869 offres**.
- Journal des sources : **56/56 OK, 0 en échec**.
- `git fetch origin main` puis `git rev-parse HEAD origin/main` → les deux
  valent **`36eac4bb668c1b37a4b228ddb86abc6e455791d2`** → **site publié, HEAD
  == origin/main**.

## D2 — Reconstruire et vérifier l'APK/AAB

Défaut constaté à l'ouverture de la session (`node outils/verifier-apk.mjs`) :
**6 contrôles en échec** —

- `app.js` **différent** du source dans l'APK **et** dans l'AAB (2) ;
- instantané vieux de **540 min** (toléré 15) dans l'APK **et** l'AAB (2) ;
- **9 057** offres embarquées contre **9 867** publiées (écart 810) (2).

Chaîne rejouée, dans l'ordre :

1. `bash /opt/data/android-build/preparer-promos.sh` →
   `INSTANTANE_OK 9869 offres, 7362 Ko`. Assets embarqués : `index.html`,
   `app.js`, `compte.js`, `affiliation.js`, `app.css`, plus l'instantané
   `donnees.js`.
2. `bash /opt/data/android-build/compiler-promos.sh` →
   `BUILD SUCCESSFUL in 12s` (`assembleRelease` + `bundleRelease`).
3. `bash /opt/data/android-build/signer-promos.sh` → `SIGN_OK`, signature
   **`f15debcfe9a43f8b2680ffe38bb4d07f7f65cc8ee6e789414b0fb57d001f6dc0`**
   (**clé conservée**, installation par-dessus possible).

Artefacts produits (`/opt/data/android-build/sortie/`) :

| Fichier | Octets | SHA-256 |
|---|---|---|
| `promos.apk` | 1 742 377 | `a95cc6e4e2c7389c808b927fdab53f9d3ce10750e327d486a76054139c5a08d6` |
| `promos.aab` | 1 737 968 | `68cac8195b8804ec7a85dbc2e6e7d8d666c29529bede9f14747334c9615bea47` |

**Vérification finale** `node outils/verifier-apk.mjs` : **20/20 contrôles
verts** (10 par archive), dont les trois qui échouaient :

- `tous les fichiers identiques au source, octet par octet` ✓ (APK et AAB) ;
- `instantané récent : 0 min d'écart` ✓ ;
- `9869 offres embarquées / 9869 publiées (écart 0)` ✓.

Conclusion : `✓ APK et AAB conformes au source web, instantané frais,
signature conservée`.

## Tests du dépôt

`bash bin/tester.sh` → **185/185**, 0 échec. `outils/verificateur-categories.mjs`
→ **CONFORME** (8 libellés de source non traduits, déjà connus de A1, non
bloquants). `outils/solidite-rubrique-auto.mjs` → auto = 176.

## Reste à faire (dit, pas tu)

Les phases **B6–B12** (sources Meubles/Nourriture/Animaux/Voyages par pays,
couverture) et **C1–C12** (traductions des 9 langues) restent **non faites** —
la règle de sauvetage a sacrifié ces unités pour livrer un site publié **et** un
APK **vérifié**. Le rapport du matin le dira.

## Passage de sauvetage du 2026-10-07 ~05:31 UTC (session neuve)

À **05:30 UTC**, il restait **moins de 3 passages** avant 05:45 → **règle de
sauvetage** appliquée derechef : saut direct à la phase **D**. La publication
est continue (cron toutes les 5 min) et était déjà synchronisée ; mais l'APK/AAB
embarquaient encore l'instantané de **9 869** offres du passage de 05:02, tandis
que le site publié en comptait **9 919** (dérive mesurée). Chaîne rejouée :

1. `preparer-promos.sh` → `INSTANTANE_OK 9919 offres, 7402 Ko`.
2. `compiler-promos.sh` → `BUILD SUCCESSFUL in 14s`.
3. `signer-promos.sh` → `SIGN_OK`, signature **`f15debcfe9a43f8b…`** conservée.
4. `node outils/verifier-apk.mjs` → **20/20 contrôles verts** (10 APK + 10 AAB),
   dont *octet par octet* ✓, *instantané 0 min* ✓, **9 919 / 9 919 (écart 0)** ✓.

Artefacts (`/opt/data/android-build/sortie/`) :

| Fichier | Octets | SHA-256 |
|---|---|---|
| `promos.apk` | 1 750 569 | `fbb23b21883d29cf3142cdf2adf9e5f2b9a97377a31aac35b75f5a31f025996d` |
| `promos.aab` | 1 747 701 | `e447ba7b055de9608cdee06a4c9499236caeacda9f6f61c133444073a88d9059` |

`git rev-parse HEAD` = `git rev-parse origin/main` = **`bec46b0d…`** → publié et
synchronisé. `bash bin/tester.sh` → **185/185**, 0 échec.

## Passage de sauvetage FINAL du 2026-10-07 ~05:46 UTC (session neuve, dernier passage de la nuit)

À **05:45 UTC**, il restait **0 passage** avant 05:45 (c'est le **32ᵉ et dernier**
passage du cron de nuit, `next_run_at` = 2026-10-07T22:00) → **règle de
sauvetage** appliquée : saut direct à la phase **D**. La publication est déjà
synchronisée (`docs/offres.json` `genereLe` **2026-10-07T05:45:18.975Z**,
**9 949 offres** ; `git rev-parse HEAD` = `git rev-parse origin/main` =
**`cee0a9c3…`**, 0 devant/0 derrière). À l'ouverture, `verifier-apk.mjs` était
**conforme 20/20** mais l'instantané embarqué accusait **14 min** de retard
(9 919 / 9 949, écart **30**). Chaîne rejouée pour livrer l'instantané frais :

1. `preparer-promos.sh` → `donnees.js` **7 617 216 o** (instantané 9 949).
2. `compiler-promos.sh` → `BUILD SUCCESSFUL in 15s`.
3. `signer-promos.sh` → `SIGN_OK`, signature **`f15debcfe9a43f8b…`** conservée.
4. `node outils/verifier-apk.mjs` → **20/20 contrôles verts** (10 APK + 10 AAB),
   dont *octet par octet* ✓, *instantané 0 min* ✓, **9 949 / 9 949 (écart 0)** ✓,
   *signature `f15debc…`* ✓.

Artefacts (`/opt/data/android-build/sortie/`) :

| Fichier | Octets | SHA-256 |
|---|---|---|
| `promos.apk` | 1 758 761 | `029e30ecd2267b316258288780c1532bd09b35db20e2d39f4c7fdc2a73bde1e9` |
| `promos.aab` | 1 753 234 | `eb532854261455db1ced42f3720e37c73db227d50740a9b6f4f285e964659541` |

`bash bin/tester.sh` → **185/185**, 0 échec. **Rien à corriger** : D1/D2 étaient
déjà faits ; ce passage a rafraîchi l'artefact livré au plus proche du site.
Unités restantes (dites, pas tues) : **B7–B12** (sources Meubles/Nourriture/
Animaux/Voyages par pays, couverture) et **C1–C12** (traductions 9 langues) —
sacrifiées pour livrer un site publié **et** un APK vérifié avant le rapport de
06:00.
