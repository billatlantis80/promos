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
