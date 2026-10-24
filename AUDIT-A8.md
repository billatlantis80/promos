# AUDIT A8 — VÊTEMENTS → MODE (chaussettes, sous-vêtements, accessoires)

> Demande de B : « **les chaussettes et tout autre vêtement → Mode** ».
> Unités E terminées, A1–A7 faites ; A8 est la **dernière unité de la phase A**.
> Session neuve du **7/10 (nuit)**. Rien n'a été inventé : chaque chiffre vient
> d'une commande de cette session.

## 1. Méthode (deux classifieurs, un seul jeu d'offres)

- Données : `data/offres.json`, **genereLe `2026-10-07T03:19:29Z`, 9 618 offres**
  (régénéré localement par `node collecteur.mjs`, **sans `--publier`** : aucune
  publication, aucun envoi).
- Outils : `outils/audit-vetements.mjs` (mesure avant), `outils/mesure-a8.mjs`
  (deux classifieurs — « avant » = `git show HEAD:collecteur.mjs`, soit A7 ;
  « après » = arbre de travail, soit A8).
- Réglage obligatoire du plan : les colonnes « ailleurs qu'en Mode » des
  **chaussettes** et des **sous-vêtements** doivent tomber à ~0.

## 2. CONTRÔLE OBLIGATOIRE — « ailleurs » (hors Mode)

```
  chaussette    touchées   18   ailleurs AVANT   7 → APRÈS   0     ✔
  sousvetement  touchées   33   ailleurs AVANT  13 → APRÈS   7
  accessoire    touchées   30   ailleurs AVANT  15 → APRÈS  15
  vetement      touchées   55   ailleurs AVANT  11 → APRÈS   7
```

- **Chaussettes : 7 → 0.** Le contrôle est **rempli**. Les 5 offres réellement
  déplacées sont citées en §3 (« Chaussettes Basses Homme Femme 10/20 Paires »,
  « Chaussettes Basses Bambou… », « Chaussettes Hommes 6 Paires… », « Lot de 6
  paires de chaussettes de sport », « DANISH ENDURANCE Merino Wandersocken »,
  « Getry piłkarskie adidas Knee Socks », « SukModen Men's Ankle Running Socks »).
- **Sous-vêtements : 13 → 7.** Les 7 « restants » sont **des faux positifs de la
  liste de contrôle elle-même**, pas des vêtements mal rangés — je les nomme :
  - `Non-slip` (mot contient « slip ») : chaussures de rando (sport), coque
    iPhone (tech), tapis de souris (tech), pince coupe-boulon (bricolage) ;
  - `Collants` = **gluants** (jouets) : « Ainiv 20PCS Mains Collantes… » ;
  - page de **codes promo** (pas un produit) : « SKIMS Coupon Codes… Panty Deals ».
  - ⚠ **un seul vrai manque** : « **Gi&Gi Collants pour femme 20 deniers** »
    (véritable collant) reste en **Sport**. Le mot `collant` a été **écarté
    volontairement** (il attraperait « collant = gluant ») ; le cas est signalé
    à B plutôt que masqué.
- **Accessoires : 15 → 15.** Aucune bascule : ce sont tous les **mots piégeux
  du plan, écartés à dessein** — `gant de toilette`, `gants nitrile`, `gants de
  four`, `gants/guantes de moto` (auto), `ceinture de grossesse`, `ceinture à
  outils enfant`, `eerst… want.nl`. Je les cite un par un plutôt que de les
  cacher : les forcer en Mode serait une erreur.
- **Vêtements : 11 → 7.** Restent hors Mode (cas **légitimes**, point 10 de B) :
  « Boy's Short Sleeve **Cotton T-shirts** … 1 to 3 Yrs » et « 7 Pack **Kid's
  Pyjama** sets » (vêtement **d'enfant** → Jeux & jouets, demande de B), un
  « T-Shirt **sport** » (source Sport), un gilet lesté d'entraînement (sport),
  deux « Philips Lumea » (beauté) et « **No Sweat** Tokens » (code promo, faux
  positif de « sweat »).

## 3. Ce qui BOUGE (A7 → A8)

**23 offres entrent en Mode, 0 en sortent** (aucune régression) :

```
     15  autre → mode
      8  sport → mode
      1  sport → bricolage   (effet de bord, voir plus bas)
      1  tech  → bricolage   (effet de bord, voir plus bas)
```

Entrées en Mode (échantillon représentatif) :
- Chaussettes/boxers (le cœur de la demande) :
  - `[BE/amazon]` « Chaussettes Basses Homme Femme 10/20 Paires – Coton » (×2),
    « Chaussettes Basses Bambou… », « Chaussettes Hommes 6 Paires… »
  - `[GB/Sports & Outdoors]` « SukModen Men's Ankle Running Socks »
  - `[DE/Sport & Outdoor]` « DANISH ENDURANCE Merino Wandersocken »
  - `[PL/Sport i turystyka]` « Getry piłkarskie adidas Knee Socks »
  - `[GB/IE/DE/AT]` « Calvin Klein … Trunks / Boxershorts »
  - `[PL]` « DANISH ENDURANCE Koszulka Polo / z Wełny Merino » (3)
  - `[DE/AT]` « RevolutionRace Sherpa Hoodie » (4, sortis de Sport)
  - `[BE/presse]` « Code promo : 11%… sur les maillots de l'OM et du PSG » (2)

**Effets de bord CITÉS (pas cachés)** — 2 offres hors Mode, dues au mot fort
`cricut` (machine de découpe, unité A8) :
- `[GB] sport → bricolage` « **Cricut Explore® 5** Deluxe Bundle… »
- `[DE] tech → bricolage` « **Cricut Explore 5** Deluxe Bundle… »
Ce sont des **machines de loisirs créatifs**, pas des vêtements ; le mot fort les
sort de Sport/High-tech parce que la description énumère des projets (« vinyl
decals, **t-shirts** »). Placement en **Bricolage** assumé et expliqué.

## 4. Mots ajoutés (9 langues)

- **PRODUITS NOMMÉS** (`MOTS_FORTS.mode`, ils tranchent avant la source) :
  `chaussette, sock(s), socken, sokken, calcetin(es), calzino/calzini, meia(s),
  skarpet(ki), strumpa, strumpor, sockor`.
- **Mots faibles** (`FAMILLES.mode`), **par langue** :
  - fr `echarpe casquette bonnet gant(s) jupe short maillot pyjama t-shirt
    tee-shirt sweat blouson veste sandale claquette kimono calecon`
  - en `scarf beanie mitten swimsuit slipper skirt hoodie boxer trunks underwear
    sweatshirt pyjamas sandals flip flops`
  - de `handschuh unterhose unterwasche schlafanzug sandalen badeanzug`
  - nl `sjaal muts handschoen onderbroek pyjama sandalen badpak`
  - es `guante gorro bufanda falda camiseta sudadera sandalias chanclas banador pijama`
  - it `sciarpa cappello guanti gonna mutande pigiama maglietta felpa sandali ciabatte`
  - pt `cachecol luva saia cueca pijama sandalias chinelos fato de banho`
  - pl `szalik czapka rekawiczki spodnica majtki bokserski pizama sandaly klapki bluza koszulka`
  - sv `halsduk mossa vantar kjol pyjamas sandaler badklader`
- **Frontières / trompeurs** (déjà posés, complétés) : `sock, meia, gant(s)`
  lus **entre frontières** (sinon « socket », « élégant ») ; `gant de toilette`,
  `gants nitrile`, `no sweat`, `meias-finais` (demi-finales → protege le mot
  « meias » = chaussettes) en `MOTS_TROMPEURS`.
- **Mots piégeux écartés**, chacun mesuré : `slip` (non-slip), `collant`
  (gluant), `want` (domaine want.nl), `rok` (14 offres sans rapport), `maglia`
  (manchette Apple Watch).

## 5. L'APPAREIL EST EXERCÉ (règle de méthode)

- `bash bin/tester.sh` → **175/175, 0 échec**.
- `node outils/verificateur-categories.mjs` → **✓ CONFORME** (mode enrichi :
  fr:38 en:36 de:26 nl:23 es:30 it:27 pt:24 pl:31 sv:25 ; aucune famille sous
  le seuil).
- Le classement stocké est rejoué à l'identique (`rubrique stockée != rejeu
  « après » : 0`) : les données et le code sont d'accord.

## 6. Ce que je n'ai PAS fait

- Aucune publication, aucun APK (phase D, en dernier).
- Aucune offre forcée en Mode sans preuve : les cas gênants restent cités
  (§2 : « Gi&Gi Collants 20 deniers », gants de moto, gants de four), B tranchera.
