# Sources prises en compte pour afficher les promotions

Fiche générée depuis le code (`collecteur.mjs`) et les données publiées (`docs/offres.json`).

**172 flux** répartis sur **37 domaines** · **6644 offres** collectées · **1577 affichées** (mélange 60 % Amazon / 40 % autres).

Aucune clé d’API n’est utilisée : tous les flux ci-dessous sont publics et gratuits.

## Amazon — ventes flash du jour

_Porte **deux prix réels** (prix flash + prix courant) dans un JSON interne : ce sont les seules remises que nous pouvons **calculer**._

- **amazon.co.uk** — 1 flux, pays : GB
- **amazon.com.be** — 1 flux, pays : BE
- **amazon.de** — 1 flux, pays : DE
- **amazon.es** — 1 flux, pays : ES
- **amazon.fr** — 1 flux, pays : FR
- **amazon.ie** — 1 flux, pays : IE
- **amazon.it** — 1 flux, pays : IT
- **amazon.nl** — 1 flux, pays : NL
- **amazon.pl** — 1 flux, pays : PL
- **amazon.se** — 1 flux, pays : SE

## Amazon — recherche filtrée « en promotion »

_Page de recherche rendue côté serveur, filtrée par Amazon lui-même (`p_n_deal_type`). Repli quand la page ventes flash ne répond pas._

- **amazon.com.be** — 5 flux, pays : BE

## Enseignes — page d’offres officielle

_Articles que l’enseigne présente elle-même comme ses offres du moment, avec leur **prix réel**. Aucun prix barré publié : la remise n’est donc pas chiffrable._

- **coolblue.be** — 3 flux, pays : BE

## Communautés de bons plans (RSS public, sans clé)

_Chaque bon plan arrive avec **le nom de la boutique et un prix réel**, plus le **score de la communauté**. C’est ce score qui sert de preuve de qualité pour les 40 %._

- **chollometro.com** — 1 flux, pays : ES
- **dealabs.com** — 1 flux, pays : FR
- **hotukdeals.com** — 1 flux, pays : GB
- **mydealz.de** — 1 flux, pays : DE
- **nl.pepper.com** — 1 flux, pays : NL
- **pepper.pl** — 1 flux, pays : PL
- **preisjaeger.at** — 1 flux, pays : AT

## Presse, moteurs et veille marchande

_Sert à détecter les bon plans relayés (articles « à X € au lieu de Y € »). La plupart n’ont pas de prix exploitable : très peu atteignent le mélange._

### Enseignes surveillées nommément (50)

01net · 4gnews · Action (BE) · Aldi (BE) · Amazon (BE) · Androidworld · Bio-Planet (BE) · Brico (BE) · Carrefour (BE) · Clubic · Colruyt (BE) · Colruyt promotie (BE) · Coolblue (BE) · DHnet · Delhaize (BE) · Delhaize promotie (BE) · DreamLand (BE) · Frandroid · Fun (BE) · Gamma (BE) · Gazet van Antwerpen · HDblog · Hema (BE) · Het Nieuwsblad · Hubo (BE) · Hubo promotie (BE) · Intermarché (BE) · JBC (BE) · Journal du Geek · Krefel (BE) · Kruidvat (BE) · Kruidvat actie (BE) · Krëfel (BE) · Les Numériques · Lidl (BE) · M3 · Macitynet · Maxi Toys (BE) · Media Markt (BE) · Mobil.se · OKay (BE) · Spar (BE) · Supermarchés (BE) · Supermarkten (BE) · Teknikveckan · Toolstation (BE) · Torfs (BE) · TuttoAndroid · Vanden Borre (BE) · iPhoneItalia

- **bing.com** — 94 flux *(moteur : requêtes par pays et par enseigne surveillée)*
- **news.google.com** — 36 flux *(moteur : requêtes par pays et par enseigne surveillée)*
- **frandroid.com** — 1 flux
- **lesnumeriques.com** — 1 flux
- **journaldugeek.com** — 1 flux
- **clubic.com** — 1 flux
- **01net.com** — 1 flux
- **hdblog.it** — 1 flux
- **tuttoandroid.net** — 1 flux
- **mobil.se** — 1 flux
- **androidworld.nl** — 1 flux
- **dhnet.be** — 1 flux
- **gva.be** — 1 flux
- **nieuwsblad.be** — 1 flux
- **4gnews.pt** — 1 flux
- **m3.se** — 1 flux
- **teknikveckan.se** — 1 flux
- **macitynet.it** — 1 flux
- **iphoneitalia.com** — 1 flux

## Ce qui arrive réellement à l’écran

| Source | Affichées | Collectées |
|---|---|---|
| Amazon | 946 | 1876 |
| MyDealz | 199 | 627 |
| Chollometro | 137 | 609 |
| Dealabs | 130 | 505 |
| Coolblue | 102 | 102 |
| Preisjäger | 39 | 141 |
| Presse IT (it) 1 | 6 | 116 |
| Presse BE (fr) 1 | 5 | 50 |
| Pepper PL | 3 | 385 |
| Veille presse | 3 | 61 |
| Presse DE (de) 1 | 2 | 30 |
| Presse BE (fr) 3 | 2 | 53 |
| Presse IT (it) 3 | 2 | 24 |
| Clubic | 1 | 13 |

## Sites écartés, et pourquoi

Sondés un par un : **MediaMarkt** (BE, NL, PL), **bol.com**, **Darty**, **Fnac**, **Currys**, **Argos**, **Elgiganten**, **Worten**, **Gamma** — réponse 403 ou 429, page construite en JavaScript, ou zéro donnée produit. Aucun ne publie de prix barré lisible : c’est la raison pour laquelle l’Irlande, les Pays-Bas, le Portugal, le Royaume-Uni et la Suède n’ont aujourd’hui presque que des offres Amazon.
