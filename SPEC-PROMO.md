# SPEC — La porte `/promo`

Ouverte le 28/10/2026, à la demande de l'utilisateur : « *Tu peux continuer avec la porte promo* »,
puis « *J'ai donné les accords tu peux continuer* ».

Ce n'est pas la porte la plus grosse : c'est la **seule** dont le contenu existe déjà et tourne en
production. Son travail n'est donc pas d'écrire un catalogue, c'est de **le servir à une autre
adresse sans en perdre un octet** — et de le prouver.

Le code vit dans `projects/kazendra/socle/promo.mjs`, les épreuves dans
`projects/kazendra/tests/promo.test.mjs` (unitaires) et `tests/epreuve-promo.sh` (HTTP), l'audit
d'écran dans `projects/kazendra/outils/audit-promo.py`.

---

## 1. Ce que la porte est, exactement

Le site des promos (`projects/promos`, port 4203) est publié par le collecteur dans `docs/`. La porte
sert **ce dossier-là**, à l'adresse `/promo` du hub. Le contenu n'est pas recopié, pas régénéré,
pas traduit : il est lu sur place.

| | |
|---|---|
| Dossier servi | `projects/promos/docs` (réglable par `KAZENDRA_PROMO_DOCS`) |
| Poids | **533 Mo** — dont `img/` 452 Mo et `o/` 63 Mo (**15 822 pages** d'offres) |
| Catalogue | `offres.json` — **14 013 668 octets** |
| Entrées à la racine | 48 fichiers |
| Code de la porte | `socle/promo.mjs`, ~400 lignes, **zéro dépendance** |
| Base de données | **aucune** — la porte ne crée pas une seule table |

Le registre (`socle/portes.mjs`) décrivait déjà `/promo` depuis le premier jour : `qui` =
particulier ou professionnel, `telRequis: false` (la porte ne met personne en contact avec
personne), `bceRequis: false`, `table: null`, aucun champ complémentaire. **Rien de tout cela n'a
changé** : c'est la seule porte qui n'ajoute rien au compte, et l'épreuve le vérifie.

---

## 2. Le relevé fait avant d'écrire une ligne

Ce qui suit a été mesuré sur le dossier publié, pas supposé :

- **`docs/index.html` ne porte aucune adresse absolue interne.** Ses liens sont relatifs
  (`href="cgu.html"`, `src="app.js"`), sauf le lien vers le hub, qui est absolu avec son schéma
  (`https://kazendra.com/`) et n'est donc pas une adresse interne.
- **Les 15 822 pages `o/<id>.html`, elles, en portent deux** : `href="/"` (retour au catalogue) et
  `url(/fonts/…)` dans une feuille de style **en ligne**.
- **Les scripts publiés n'en portent aucune.** `app.js` appelle `BASE + 'offres.json'` avec
  `BASE = ''` : tout est relatif. C'est ce qui permet de ne pas les réécrire.
- **Les vignettes sont des `background-image` relatives** posées par le script
  (`img/<id>.jpg`) — pas des balises `<img>`. Compter les `<img>` donnerait « 0 vignette » sur une
  page qui en affiche vingt-quatre. L'audit d'écran en tient compte.
- **La feuille de style est en ligne dans la page**, donc `document.styleSheets` ne porte aucune
  adresse : c'est la police calculée (Montserrat) et la grille calculée qui disent que le style
  s'applique.
- **L'application sonde `api/offres` avant `offres.json`** : un 404 est donc normal à chaque visite,
  et une épreuve qui compterait « zéro requête en échec » mentirait.

---

## 3. Les décisions

### 205. On sert `docs/`, pas `public/` — et on ne recopie rien

`public/` est la source (2,4 Mo) ; `docs/` est la copie publiée (533 Mo), la seule qui contienne
`o/`, `img/` et `offres.json`. Recopier `docs/` dans `public/promo/` aurait créé deux vérités qui
divergent à la première collecte : la copie ne se met pas à jour toute seule, et personne ne s'en
aperçoit avant qu'une carte morte traîne une semaine à l'écran.

### 206. On ne proxifie pas vers le port 4203

Deux processus à tenir, un port de plus à surveiller — et surtout un second serveur à qui il
faudrait apprendre le préfixe, c'est-à-dire exactement le défaut mesuré le 27/10 (site nu, bloqué sur
« Chargement… »). Un seul serveur, un seul jeu de règles.

### 207. La réécriture est celle des décisions 144 à 147, pas une seconde règle

`socle/prefixe.mjs` existe depuis le 27/10 : trois familles d'adresses, préfixe normalisé, longueur
recalculée. La porte s'en sert telle quelle. **Aucun fichier du catalogue n'est modifié sur disque** —
la réécriture a lieu au moment de servir, et seulement pour les pages (`.html`) et les feuilles
(`.css`).

### 208. `/promo` sans barre → **301** vers `/promo/`

Sous `/promo/`, les adresses relatives (`app.css`, `offres.json`, `o/<id>.html`) se résolvent dans la
porte. Sous `/promo`, elles se résolvent **à la racine du hub** : la page arriverait sans style et le
catalogue en 404. Une seule barre sépare une porte qui s'ouvre d'une page nue. 301 et non 302, pour
la même raison que partout ailleurs : un 302 se réessaie à chaque visite.

### 209. Les scripts ne sont pas réécrits — et une garde le dit

Réécrire un script dont on n'a pas besoin, c'est risquer de changer une chaîne qui n'était pas une
adresse. Puisque le corpus publié n'en porte aucune (relevé § 2), les scripts sortent **identiques à
l'octet** (vérifié par `cmp` dans l'épreuve HTTP). Une épreuve unitaire refuse qu'un script publié
gagne un jour une adresse absolue : ce jour-là, il faudra les réécrire, et c'est elle qui le dira.

### 210. La feuille de style **en ligne** est réécrite aussi

**Défaut trouvé par l'épreuve, pas à l'œil.** Réécrire les attributs ne suffisait pas : les
15 822 pages d'offres posent leur police dans un `<style>` (`url(/fonts/…)`). Les pages s'affichaient,
donc rien ne semblait cassé — avec la police de secours. Les pages passent donc par **deux** règles :
attributs (144) puis `url(/…)` (146).

### 211. Traversée refusée, dossiers non listés, fichiers cachés jamais servis

`..`, `.`, l'antislash, l'octet nul, un pour-cent mal encodé → **400**, pas 500 : c'est la demande qui
est mauvaise. Un dossier n'est jamais listé (`/promo/img/` → 404). Tout segment commençant par un
point est refusé (`.env`, `.git`, `.nojekyll`) : un fichier caché servi par accident est une fuite
qu'on ne remarque jamais. Un lien symbolique est résolu et refusé s'il sort du dossier publié.

### 212. Une offre morte répond une page honnête

Les adresses sont partagées (WhatsApp, e-mail) et une promotion ne vit que **cinq jours** : la page
`o/<id>.html` d'une offre expirée disparaît du dossier. C'est le cas **normal**, pas une panne. Elle
répond donc un 404 avec une page qui dit la règle, renvoie au catalogue du jour, et se déclare
`noindex`.

### 213. Cache et ETag : le catalogue ne se retélécharge pas

- `img/` et `fonts/` : `public, max-age=604800` (une semaine). Ces fichiers ne changent pas d'une
  collecte à l'autre.
- Tout le reste : `no-cache` — gardé, mais redemandé — parce qu'une collecte doit se voir dans la
  minute. C'est l'**ETag** qui évite le téléchargement : rien n'a bougé → 304, zéro octet.
- **L'ETag porte le préfixe.** Deux préfixes donnent deux textes différents ; un ETag commun ferait
  servir un 304 sur une page en cache dont les liens pointent vers l'autre préfixe — des liens morts,
  et un cache impossible à expliquer.

### 214. Compression : une fois par version, pas une fois par visiteur

14 Mo en clair, **2,83 Mo** compressés. Compresser à chaque visite coûterait ~200 ms de processeur par
visiteur ; ne pas compresser coûte 12 Mo de réseau par visiteur. Le résultat est donc gardé en
mémoire (24 entrées, 48 Mo au plus), avec une clé qui porte la taille et la date du fichier : une
collecte qui réécrit le catalogue invalide l'entrée sans qu'on ait à y penser. Mesuré dans le
navigateur : **2 752 Ko transférés** pour le catalogue complet.

### 215. Les anciennes adresses demandées à la racine sont redirigées en 301

Le site vivait **à la racine** de `kazendra.com` avant le hub. Des liens partagés pointent sur
`/o/<id>.html`, `/cgu.html`, `/app.css`. La porte répond donc, **dans la branche « rien n'a
répondu »** : si un fichier du même nom existe dans le dossier publié, 301 vers `/promo/…`. Parce
qu'elle est dans cette branche, une vraie route du hub passe **toujours** avant — le jour où le hub
servira son propre `/o/…`, il gagnera sans qu'on retire la règle. Et `/api/…` est écartée
explicitement : une API inconnue reste un 404 JSON, jamais une redirection vers un fichier.

### 216. Le panneau d'administration ne passe pas par la porte publique

`docs/admin/` existe (316 Ko) et `robots.txt` demande déjà aux moteurs de l'ignorer. Le servir sous
`/promo/admin/` ajouterait une adresse publique et devinable à un outil de gestion, pour aucun contenu
destiné au visiteur. Son authentification est **côté navigateur** (empreinte PBKDF2 dans le
`localStorage` de l'administrateur) : ce n'est pas une authentification serveur, et le plan du hub
dit déjà qu'il doit être refait. La porte répond donc **403** avec une phrase qui explique pourquoi.
C'est la **seule** restriction de contenu de la porte.

### 217. Le registre dit quelles portes sont écrites

`socle/portes.mjs` porte désormais `branchee`. Une épreuve tient la correspondance : une porte
marquée `branchee` ne répond jamais 501, une porte marquée non branchée répond 501. Aujourd'hui,
**seule `/rencontre` n'est pas branchée** (mesuré). La page d'accueil du socle lie les portes
branchées et marque « bientôt » sur les autres — on n'affiche jamais une porte vide comme si elle
marchait.

---

## 4. Ce qui est exercé, et les chiffres

| Épreuve | Résultat |
|---|---|
| `tests/epreuve-promo.sh` — HTTP, trois serveurs jetables (sans préfixe, sous `/p/kazendra`, dossier absent) | **55 / 0** |
| `tests/promo.test.mjs` — unitaires : chemins, préfixe, 301, réécritures, 403, traversée, gzip, ETag, HEAD, gardes | **17 / 0** |
| `outils/audit-promo.py` — écran réel, 1440 px et 390 px | **18 / 0** (9 contrôles par largeur) |
| Catalogue servi par la porte | 24 cartes, **24/24 vignettes** chargées, **0 requête en échec**, 0 exception JavaScript |
| Poids transféré du catalogue | **2 752 Ko** (contre 13 370 Ko en clair) |

L'audit d'écran mesure ce que les épreuves HTTP ne peuvent pas voir : cartes présentes, grille
calculée (`display: grid`), police Montserrat appliquée, chaque carte porte un visuel, vignettes
chargées depuis la porte, aucun débordement horizontal, aucune exception. C'est pour cette
différence-là qu'on regarde l'écran : le 27/10, toutes les épreuves passaient et le site s'affichait
nu.

Captures : `projects/kazendra/captures/promo-1440.png`, `promo-390.png`.

---

## 5. Ce que la porte ne fait pas — à faire avant la bascule du domaine

1. **`robots.txt` et `sitemap.xml` se lisent à la racine d'un hôte**, pas sous un préfixe. Ceux du
   catalogue ne seront donc plus lus le jour où le hub prendra la racine. Le hub devra écrire les
   siens, et y écarter `/promo` de l'indexation : ces 15 822 pages sont les données brutes des
   marchands, republiées en masse (décision du 09/10), et le `noindex` est un choix sain.
2. **Le lien de partage est encore écrit en dur** (`SITE_PARTAGE = 'https://kazendra.com'` dans
   `app.js`, qui produit `https://kazendra.com/o/<id>.html`). Aujourd'hui la redirection de secours
   (§ 215) rend ces liens valables ; le jour de la bascule, il faudra que le partage produise
   directement `/promo/o/<id>.html`.
3. **Le panneau d'administration reste à refaire** avec une authentification serveur (§ 216). C'est
   un chantier du hub, pas de cette porte.
4. **Rien n'est encore en ligne** : `kazendra.com` sert toujours GitHub Pages. La porte est exercée
   en local sur `localhost:4204/promo/`, et le proxy TLS (`proxy.mjs`) est prêt mais pas exposé.
