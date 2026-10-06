# Sources prises en compte pour afficher les promotions

Fiche générée depuis le code (`collecteur.mjs`) et les données publiées (`docs/offres.json`).

**172 flux** répartis sur **37 domaines** · **8138 offres** collectées · **1825 affichées** (mélange 60 % Amazon / 40 % autres).

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
| Amazon | 1094 | 2142 |
| MyDealz | 221 | 856 |
| Chollometro | 169 | 770 |
| Dealabs | 161 | 623 |
| Coolblue | 108 | 108 |
| Preisjäger | 45 | 202 |
| Presse IT (it) 1 | 7 | 114 |
| Presse BE (fr) 1 | 5 | 53 |
| Pepper PL | 4 | 508 |
| Veille presse | 3 | 62 |
| Presse DE (de) 1 | 2 | 72 |
| Presse BE (fr) 3 | 2 | 55 |
| Presse IT (it) 3 | 2 | 28 |
| Clubic | 1 | 19 |
| Pepper NL | 1 | 212 |

## Pourquoi UNE seule enseigne branchée

La famille « enseignes » compte un marchand, **Coolblue**, et voici l’état exact des autres — mesuré, pas supposé. Chaque enseigne demande un travail sur mesure : il n’existe ni flux commun, ni format partagé.

- **Coolblue BE** — page `/fr/offres` en **JSON-LD schema.org** (`ItemList` → `Product` → `offers.price`) : nom, prix et visuel dans un format normalisé. **Branchée**, 3 pages.
- **Colruyt, Delhaize, Lidl, Aldi, Carrefour, Kruidvat, Action** — dépliants en **image** et applications JavaScript : **0 produit, 0 prix** dans le HTML servi. Colruyt expose une passerelle publique, mais elle réclame un `clientCode` introuvable dans ses pages — et une devinette n’est pas une source.
- **Amazon.com.be** — page 100 % JavaScript (0 ASIN, 0 prix dans le HTML) ; l’API Product Advertising exige une clé. Écartée au titre de la règle « aucune clé ».
- **Media Markt BE** — annoncé un temps comme lisible en JSON-LD, puis **revérifié : chemins de promotions en 404**, page d’accueil sans `ItemList` (4 prix seulement). Piste périmée, jamais branchée.
- **MediaMarkt NL/PL, Euronics** — chemins testés en 404 ou redirection : l’URL de promotions n’a pas été trouvée. Ce n’est **pas** un refus du site, c’est une recherche inaboutie.
- **bol.com, Darty, Fnac, Currys, Argos, Elgiganten** — refus explicite (**403** ou **429**) depuis ce serveur, avec un navigateur standard.
- **Worten** — répond 200, mais aucune donnée produit dans la page.

Conséquence assumée : les 40 % reposent aujourd’hui sur **Coolblue + les 7 communautés de bons plans**. Étendre la part des enseignes est un travail **marchand par marchand** — un chemin de promotions à trouver, un format à valider, un analyseur à écrire.
