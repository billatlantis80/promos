# Affiliations — par où commencer, et ce que ça peut rapporter

**Décision de B, 09/10/2026 : « On passe aux affiliations. »**

Tout ce qui suit est **mesuré sur le catalogue publié** (`data/offres.json`, 16 680 offres)
et sur les relevés d'affiliation du 09/10/2026 (`donnees/affiliations.json`, 607 acteurs).
Aucun chiffre n'est estimé.

---

## 1. Le constat qui change tout : 68 % du catalogue ne peut rien rapporter

Le catalogue a été trié par **destination réelle du lien sortant** — pas par le nom du marchand
affiché sur la carte, mais par l'endroit où le visiteur atterrit quand il clique.

| Destination du lien sortant | Offres | Part | Commission possible ? |
|---|---|---|---|
| Un **agrégateur** (MyDealz, HotUKDeals, Chollometro, Dealabs, Pepper…) | 11 385 | **68,3 %** | ❌ **Aucune** |
| **Amazon** (10 marchés) | 4 528 | **27,1 %** | ✅ Oui |
| Autres marchands à lien direct (Coolblue, Zooplus…) et sites de presse | 767 | 4,6 % | ⚠️ Partiellement |

**Preuve, sur des cas réels du catalogue** :

- une offre **Lidl** → `lienMarchand` = `dealabs.com/bons-plans/mules-de-bain…`
- une offre **MediaMarkt** → `lienMarchand` = `chollometro.com/ofertas/…`
- une offre **Cdiscount** → `lienMarchand` = `nl.pepper.com/aanbiedingen/…`
- une offre **AliExpress** → `lienMarchand` = `mydealz.de/deals/…`
- une offre **Coolblue** → `lienMarchand` = `coolblue.nl/product/…` ✅ **lien marchand direct**
- une offre **Amazon** → `lienMarchand` = `amazon.com.be/…` ✅ **lien marchand direct**

**Conséquence, dite franchement** : pour les 68 %, **le visiteur quitte Kazendra pour un site de bons
plans, et Kazendra ne touche rien** — quel que soit le nombre de réseaux auxquels on s'inscrit.
S'inscrire à quinze réseaux ne monétisera pas un lien qui ne mène pas au marchand.

---

## 2. Donc : Amazon Partenaires d'abord, et de très loin

**Un seul programme, Amazon, ouvre 27,1 % du catalogue** (4 528 offres) — soit **6 fois** tout le
reste réuni. Les autres réseaux couvrent aujourd'hui **~80 offres (0,5 %)**.

Relevé du 09/10/2026 sur `partenaires.amazon.fr` :

- Rémunération annoncée : **jusqu'à 12 %** du prix de vente sur les achats éligibles.
- Inscription ouverte aux « blogueurs, éditeurs et créateurs de contenus possédant un site Web » —
  **la Belgique est bien dans la liste des pays** du portail européen.
- Inscription : **`https://partenaires.amazon.fr/signup`** (il faut un compte Amazon, puis le dossier
  Partenaires).

**Ce que l'inscription va demander** — et que je ne peux pas remplir à votre place : votre **identité**,
un **compte Amazon**, des **informations fiscales**, et un **IBAN** pour les paiements. Le montant du
seuil de versement et la liste exacte des champs se lisent **pendant** l'inscription : je vous les
dicterai à ce moment-là plutôt que de les annoncer de mémoire.

### Amazon délivre UN identifiant par pays — il en faut dix

`amazon.fr` · `amazon.de` · `amazon.it` · `amazon.es` · `amazon.nl` · **`amazon.com.be`** ·
`amazon.co.uk` · `amazon.ie` · `amazon.se` · `amazon.pl`

Un identifiant français posé sur un lien allemand **ne rapporte rien** : le programme allemand ne le
reconnaît pas. C'est déjà écrit dans le code (`public/affiliation.js`), qui refuse de poser le tag
d'un pays sur le lien d'un autre — et refuse tout simplement de taguer un marché non ouvert.

---

## 3. Où les identifiants se posent — deux endroits, rien d'autre

Mesuré dans `public/affiliation.js` :

1. **`AMAZON_TAGS`** — un identifiant par marché Amazon. Les dix lignes existent déjà, **toutes
   vides** aujourd'hui. C'est ce vide qui fait que les liens sortent « en direct, sans commission ».
2. **`RESEAUX`** — un tableau, **vide aujourd'hui**, avec un modèle de lien par réseau. Exemple déjà
   écrit en commentaire dans le fichier :
   `{ nom: 'Awin', modele: 'https://www.awin1.com/cread.php?awinmid=XXXX&awinaffid=YYYY&ued={url}' }`

**Ce qui bascule automatiquement** : le pied de page affiche aujourd'hui
*« Cette version ne contient pas encore d'identifiant d'affiliation : les liens sortants sont directs,
sans commission. »* — cette phrase **disparaît d'elle-même** dès qu'un identifiant est posé, et est
remplacée par la mention de transparence. Aucune autre modification à faire.

---

## 4. Les autres réseaux — ce qu'ils valent vraiment aujourd'hui

Programmes **détectés** dans les pages des acteurs (95 sur 607 interrogés) :

| Réseau | Programmes détectés | Offres réellement concernées aujourd'hui |
|---|---|---|
| Awin | 19 | ~81 (0,5 %) |
| Amazon Partenaires | 13 | **4 528 (27,1 %)** |
| Tradedoubler | 10 | marginal |
| Impact | 6 | marginal |
| Webgains | 4 | marginal |
| Smartclip / Sovendus | 4 | marginal |
| TradeTracker | 3 | marginal |
| Affilae · Adcell · Kwanko · belboon | 2 à 3 chacun | marginal |
| Partnerize · Admitad · Rakuten · Adtraction | 1 chacun | marginal |

**À retenir : le nombre de programmes trouvés n'est pas le nombre d'offres concernées.** Awin détecte
19 programmes, mais leurs marchands ne représentent que 0,5 % du catalogue.

Inscriptions, si on veut les faire plus tard :

- **Awin** (éditeur) : `https://ui.awin.com/publisher-signup/fr/awin/step1`
- **TradeTracker** (éditeur) : `https://affiliate.tradetracker.com/signup/step1?loc=fr_FR`
  — attention, TradeTracker a une page « **Qualification des Éditeurs** » : l'acceptation n'est pas
  automatique.
- **Tradedoubler** : `https://www.tradedoubler.com/fr/for-publishers`

---

## 5. Ce qui reste à trancher, et qui vaut plus que toutes les inscriptions

**Les 68 % dont le lien sortant va vers un site de bons plans.** Deux voies :

- **A. Ne rien changer.** Kazendra reste un comparateur honnête qui cite ses sources ; ces 68 %
  restent non monétisés. C'est un choix défendable, et c'est l'état actuel.
- **B. Aller chercher le lien du marchand.** Le vendeur réel est **connu** (le champ `marchand` du
  catalogue le porte : Lidl, MediaMarkt, Cdiscount, AliExpress…) mais son adresse ne l'est pas : il
  faudrait la résoudre en ouvrant la page source, offre par offre — 11 385 offres, et un lien mort à
  chaque offre retirée. C'est un vrai chantier, à décider en connaissance de cause.

---

## Ce qu'il faut de vous, maintenant

1. **Créer un compte Partenaires Amazon** : `https://partenaires.amazon.fr/signup`
2. Récupérer **les dix identifiants de suivi** (un par marché, dont impérativement
   **`amazon.com.be`** — c'est le marché du site).
3. Me les transmettre : je les pose dans `AMAZON_TAGS`, je vérifie que les liens sortent bien taggés
   sur les bons marchés, et je m'assure que la mention du pied de page a basculé.

**Je ne peux pas le faire à votre place** : l'inscription engage votre identité, vos informations
fiscales et votre IBAN.

---

## LE POINT QUI DÉCIDE TOUT : UN PROGRAMME AMAZON PAR PAYS

Relevé le 09/10/2026, après avoir résolu un lien court `amzn.to` fourni par B :

`https://amzn.to/4ergld1` → `https://www.amazon.fr/…/dp/250506332X?tag=kazendra-21&linkCode=as4&ref_=onb_gen_lnk`

Trois choses en découlent, mesurées et non supposées :

1. **L'identifiant `kazendra-21` est bien celui du programme FRANÇAIS.** Il est posé dans
   `public/affiliation.js` sur `amazon.fr`, et sur lui seul.
2. **La Belgique a son PROPRE programme.** `partenaires.amazon.com.be` n'existe pas (HTTP 000),
   mais `affiliate-program.amazon.com.be` répond — « Amazon.com.be Associates Central ». Un
   identifiant français ne couvre donc **pas** `amazon.com.be`.
3. **Le mur est arithmétique.** Mesure du catalogue publié (`docs/offres.json`, 16 889 offres) :
   **4 578 offres sortent vers Amazon**, réparties sur **10 marchés**.

   - **amazon.com.be — 1 577 offres** — *non couvert* (programme séparé) ← le plus gros
   - amazon.de — 550 — non couvert
   - amazon.es — 494 — non couvert
   - amazon.nl — 318 — non couvert
   - amazon.se — 309 — non couvert
   - **amazon.fr — 303 — OUI ✅**
   - amazon.ie — 298 — non couvert
   - amazon.pl — 280 — non couvert
   - amazon.it — 242 — non couvert
   - amazon.co.uk — 207 — non couvert

   Autrement dit : avec un seul identifiant, **6,6 % (`303 / 4 578`) des clics Amazon rapportent.**
   Le premier marché à ouvrir est **`amazon.com.be`** — c'est à la fois le plus gros (34 %) et
   celui du pays de B.

**Ce que le code fait correctement, et qu'il ne faut pas « réparer » :** `habillerAmazon` ne pose un
identifiant que si le marché en a un. Un marché sans identifiant sort en **lien direct**, jamais
affublé d'un faux tag — un tag étranger ne rapporte rien et fait croire que le travail est fait.
Un lien déjà tagué n'est jamais écrasé. Éprouvé : un lien réel du catalogue vers `amazon.fr` devient
`…?language=fr_FR&tag=kazendra-21` et répond **HTTP 200**.

**Ce qu'il reste à faire, et qui dépend de B :** dans son espace Associates Central, ajouter les
autres pays (le sélecteur les liste : Belgique, Allemagne, Espagne, Pays-Bas, Suède, Irlande,
Pologne, Italie, Royaume-Uni) et me transmettre les identifiants. Les dix lignes existent déjà dans
`AMAZON_TAGS` — il n'y a rien à écrire d'autre que ces chaînes.

---

*Sources : `data/offres.json` (16 680 offres, relevé du 09/10/2026) ; `donnees/affiliations.json`
(607 acteurs, 95 programmes, relevé du 09/10/2026) ; `partenaires.amazon.fr` (rémunération et pays,
09/10/2026) ; `public/affiliation.js` (les deux points d'insertion).*
