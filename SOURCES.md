# Sources prises en compte pour afficher les promotions

Fiche générée depuis le code (`collecteur.mjs`) et les données publiées (`docs/offres.json`).

**180 flux** répartis sur **38 domaines** · **8790 offres** collectées · **1908 affichées** (mélange 60 % Amazon / 40 % autres).

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

_Articles que l’enseigne présente elle-même comme ses offres du moment, avec leur **prix réel**. Sans prix barré publié, la remise n’est pas chiffrable — seules les vraies réductions sont gardées._

- **coolblue.be** — 8 flux, pays : BE
- **groupon.be** — 1 flux, pays : BE

## Activités — bons plans de service (spa, restaurant, sorties)

_Chaque bon plan porte **deux prix réels** ; la remise est **calculée** entre les deux, jamais lue dans le titre. Un **garde-fou de vraisemblance** rejette les prix de référence gonflés : au-delà de 5× le prix demandé, ou d’une remise de 90 %, ce n’est plus une promotion._

- **groupon.be** — 2 flux, pays : BE

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
| Amazon | 1144 | 2217 |
| MyDealz | 172 | 971 |
| Chollometro | 144 | 843 |
| Dealabs | 130 | 664 |
| HotUKDeals | 109 | 922 |
| Groupon | 68 | 75 |
| Pepper PL | 54 | 543 |
| Preisjäger | 36 | 223 |
| Pepper NL | 25 | 235 |
| Presse IT (it) 1 | 7 | 119 |
| Presse BE (fr) 1 | 5 | 54 |
| Coolblue | 4 | 198 |
| Veille presse | 3 | 62 |
| Presse DE (de) 1 | 2 | 73 |
| Presse IT (it) 3 | 2 | 24 |
| Presse BE (fr) 3 | 2 | 55 |
| Clubic | 1 | 19 |

## Les marchands branchés, et ce qui reste hors de portée

Deux marchands sont branchés, et chacun a demandé un travail **sur mesure** — leurs formats n’ont rien en commun :

- **Coolblue BE** — page `/fr/offres` en **JSON-LD schema.org**, 8 pages. ⚠️ C’est un **CATALOGUE à prix nu**, pas une page de promotions. Mesuré : 22 produits par page, 5 seulement portent un prix de référence, **un seul atteint 15 %**. Seules ces vraies remises sont affichées — le prix de référence est lu dans la charge interne de la page, là où il vit réellement.
- **Groupon BE** — `/fr/landing/sale`, `/fr/bon-plan` (prestations) et `/goods` (produits). Les bons plans sont dans le **JSON de la page** (`__NEXT_DATA__`), les montants **en centimes**, avec les **deux prix**. C’est la seule source belge qui publie des remises chiffrables. Son `robots.txt` dit `Allow: /`. ⚠️ Il **refuse le client HTTP de Node** (403 sur toute combinaison d’en-têtes) : la lecture passe par `curl` — même URL, page publique.

Le reste a été **sondé, pas supposé** — une trentaine de domaines belges, avec contrôle positif et négatif à chaque vague :

- **Colruyt, Delhaize, Lidl, Aldi, Carrefour, Kruidvat, Action** — dépliants en **image** et applications JavaScript : **0 produit, 0 prix** dans le HTML servi. Colruyt expose une passerelle publique, mais elle réclame un `clientCode` introuvable dans ses pages — et une devinette n’est pas une source.
- **Amazon.com.be, 2ememain, DreamLand, Fnac.be, Decathlon.be, Makro** — page rendue en JavaScript, ou **403** : rien de lisible dans le HTML servi. L’API Product Advertising d’Amazon exige une clé — écartée au titre de la règle « aucune clé ».
- **Media Markt BE** — annoncé un temps comme lisible en JSON-LD, puis **revérifié : chemins de promotions en 404**, page d’accueil sans `ItemList`. Piste périmée, jamais branchée. **MediaMarkt NL/PL, Euronics** : chemins en 404 ou redirection.
- **Vanden Borre** — publie bien des prix (`"price": 599`), mais **`discount` vaut 0 partout** et ses pages Black Friday sont rendues en JavaScript : un catalogue à prix nu, sans aucune remise lisible.
- **Kieskeurig.be** — 481 blocs de données, mais `lowPrice`/`highPrice` y sont l’**écart entre boutiques**, pas une remise : c’est un comparateur, pas une page de promotions.
- **bol.com, Darty, Currys, Argos, Elgiganten, iBOOD, Kelkoo** — refus explicite (**403** ou **429**) depuis ce serveur, avec un navigateur standard. **Worten** répond 200 sans aucune donnée produit.
- **Veepee.be, Groupon (états Apollo non-Next)** — les prix n’existent **pas dans le HTML** : ils arrivent après coup par une API interne. Sans clé, il n’y a rien à lire.
- **Reddit (`r/belgiumdeals`), HLN, Het Nieuwsblad, Sudinfo** — mur de connexion, mur de consentement, ou **403**.

Il n’existe **aucune communauté belge de bons plans** : `be.pepper.com` n’existe pas, le flux Dealabs Belgique rend **404**, et folders.be / dealfinder.be / promofolder.be sont injoignables. C’est la raison de fond pour laquelle la Belgique n’avait que des offres Amazon.
