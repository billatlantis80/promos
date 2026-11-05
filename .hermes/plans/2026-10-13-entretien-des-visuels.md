# Entretien des visuels — mesuré le 13/10/2026, en attente du feu vert de B

Demande de B (13/10) : « Oui on peut attaquer le poids des images, les visuels
lourds. Peux-tu me dire en détail quelle solution utiliser avant de l'appliquer ? »

## 1. Ce qui a été mesuré ce matin (rien d'estimé)

| mesure | valeur |
|---|---|
| site publié | **853,3 Mo** sur 1 024 tolérés (**83 %**) |
| `docs/` | 866 Mo — dont `docs/img` **756 Mo** (19 493 fichiers, moyenne 38 Ko) et `docs/o` 87 Mo |
| `docs/img` ≥ 200 Ko | **843 fichiers = 276 Mo** (36,6 % du poids des images) |
| ≥ 500 Ko | 96 fichiers, 86 Mo |
| ≥ 1 Mo | 28 fichiers, 36 Mo |
| `.git` | **2 582 Mo** (GitHub recommande 1 Go) |

**À blanc, sur la totalité (19 301 fichiers), réglages de B (JPEG q85, ≤ 1 200 px,
noms conservés)** : 1 530 fichiers réécrits, **288 → 251 Mo = −37 Mo (−13 %)**,
240 redimensionnés, 58 écartés (transparence), 17 713 déjà plus légers (donc rien à
gagner). Plus gros gain unitaire : 1 411 → 290 Ko.
**Dont la part des gros** (≥ 200 Ko, à blanc séparé) : 562 fichiers, 166 → 133 Mo
= **−33 Mo**.

⚠️ Le panneau annonce « visuels lourds ≈ 135 Mo de dépôt » : **ce chiffre est faux**.
Il suppose que « lourd » veut dire « pas encore optimisé ». Or 633 des 843 gros
fichiers sont **déjà passés au plafond de 1 200 px** le 12/10 et restent lourds
(174,6 Mo) : un JPEG 1 200 px de photo dense pèse 250-400 Ko, c'est normal.

## 2. Le fait qui commande tout : le site regrossit de ~130 Mo par jour

Série du collecteur lui-même (`data/passages.log`, champ « poids publié ») :
**789,9 Mo le 12/10 à 20:16 → 853,3 Mo le 13/10 à 08:15 = +63,4 Mo en 12 h**,
soit **+127 à +132 Mo/jour**. Corroboré au niveau des fichiers : **1 021 fichiers
arrivés en 13 h (85,7 Mo)**, dont 132 lourds (61 Mo).

Conséquence : **à ce rythme, le seuil de 1 024 Mo est atteint demain** (170 Mo de
marge ÷ 130 Mo/jour ≈ 1,3 jour).

## 3. Ce qu'une journée d'arrivées contient de récupérable (mesuré)

Copie des 1 018 arrivées de la journée dans `/tmp/essai-visuels/images`, même à-blanc :
**254 fichiers réécrits, 76 → 39 Mo = −37 Mo (−49 %)**, 241 redimensionnés.

→ La passe récupère **≈ 70 Mo/jour**, quand le site en gagne **≈ 130 Mo/jour**.
**La compression couvre donc environ la moitié de la croissance.** Elle est
nécessaire, elle n'est pas suffisante. À dire à B avant qu'il tranche.

## 4. La solution proposée (trois pièces)

### 4.1 La passe, avec les réglages déjà tranchés le 12/10
JPEG q85, grand côté ≤ 1 200 px (justifié par la boîte réelle : 630 px à 2× = 1 260),
**noms et formats conservés** → aucune référence à réécrire, aucune page de partage,
aucune modification du collecteur. Règles de sûreté du script, déjà en place :
originaux copiés avant remplacement, **le plus petit des deux gagne**, transparence
respectée, correction du « nom qui ment » (PNG nommé `.jpg` réécrit en vrai JPEG).

Ordre d'exécution :
1. `cronjob action=pause` sur la collecte Kazendra (elle tourne toutes les 15 min ;
   une passe de plusieurs minutes tomberait dans son envoi borné à 300 s) ;
2. `bin/recompresser-visuels.py --appliquer --seuil 0 --archive /opt/data/sauvegardes/kazendra-images-avant-passe3`
   (**archive NEUVE** : réutiliser celle du 12/10 écraserait les vrais originaux) ;
3. preuves : 0 référence cassée, `node --test` vert, poids publié relu ;
4. **push** (accord de B, geste de mon côté) ;
5. `cronjob action=resume`, puis exercer un passage de collecte et lire la durée de
   son envoi ;
6. contrôle en ligne : images jamais demandées auparavant, comparées aux octets
   locaux — après `gh api …/pages/builds/latest` = `built` (le déploiement est
   asynchrone, ne pas conclure au cache).

### 4.2 L'entretien récurrent — la pièce qui compte
Une passe **horaire**, séparée, qui ne traite que les fichiers **neufs** :
- nouvel argument `--depuis <heures>` (et un `--max` de sûreté) dans
  `bin/recompresser-visuels.py` : sans lui, chaque passage décode aussi les 19 301
  fichiers existants pour rien (~7 min) ;
- petite enveloppe `bin/entretenir-visuels.sh` : archive du jour
  (`/opt/data/sauvegardes/kazendra-images-entretien/AAAA-MM-JJ`, gardée 7 jours),
  silence total quand rien ne change ;
- **le push ne lui appartient pas** : la collecte normale (15 min) fait déjà
  `git add -A docs public` — les images réécrites partent donc avec elle, en petits
  lots. Aucune logique git en plus, donc aucun risque de conflit avec le robot.
- jamais dans le collecteur : son budget est de 300 s, un sous-processus par image
  le fait sauter.

Coût machine mesuré : ~5 gros fichiers neufs par heure → quelques secondes par
passage.

### 4.3 Corriger l'instrument
La fiche « visuels lourds » du panneau doit apprendre à distinguer « lourd » de
« pas encore optimisé », et annoncer le gain réel (−37 Mo), pas −135 Mo. Sinon elle
envoie B chercher un gisement qui n'existe plus.

## 5. Ce que la solution coûte, et ce qu'elle ne résout pas

- **Le dépôt grossit** : git garde les anciens blobs, donc +~30 Mo/jour
  *en plus* de ce que les arrivées ajoutent déjà. `.git` est à 2 582 Mo, au-dessus
  du 1 Go recommandé par GitHub. Irréversible sans réécriture d'historique.
- **Le site franchira quand même les 1 024 Mo** (~3 jours au lieu de ~1,3) tant
  qu'on ne décide pas **ce qu'on garde**. Leviers réels, à traiter séparément :
  - la **règle des 7 jours** — en mode « mesure » depuis le 12/10, jamais activée :
    elle sortirait 3 541 articles et 81 Mo aujourd'hui. C'est une règle de
    **pertinence**, pas de poids (taux de faux positifs mesuré : 48 %) ;
  - **plafonner ce qu'on télécharge** (ne pas rapatrier les visuels des articles
    hors délai, ou borner le poids par visuel) ;
  - le **catalogue** : 3,89 Mo téléchargés par visite, dont 3,7 Mo de catalogue
    tous pays — le plus gros levier pour le visiteur (−3,6 Mo/visite en découpant
    par pays), et c'est lui qui protège les 100 Go/mois de bande passante.
- **La clause GitHub Pages** : le service est interdit à un site « principalement
  destiné à faciliter des transactions commerciales » — un site d'affiliation y
  entre littéralement. À relire avant tout déménagement, pas une urgence.

## 6. Options écartées, et pourquoi

- **WebP** : renomme les fichiers (l'empreinte de l'URL est dans le nom) → 1,3 Go
  re-téléchargés chez les partenaires et 20 806 pages de partage à régénérer.
- **Descendre sous 1 200 px** (800 px = −346 Mo) : B a tranché « qualité d'abord »
  le 12/10, la mesure disant que c'est visible au détail 1:1. À ne re-proposer
  qu'avec une **planche avant/après neuve**, et c'est lui qui tranche.
- **Greffer la passe dans le collecteur** : budget de 300 s, la ferait sauter.
- **Changer d'hébergeur** : Cloudflare Pages refuse > 20 000 fichiers, Vercel
  100 Mo d'envoi — les deux refusent ce site. Alléger d'abord.

## 7. Les trois plafonds, MESURÉS (à-blanc sur la totalité, 13/10)

B a remis en cause la qualité (13/10) : « je ne voulais pas des gros pixels ; si on
compresse au minimum nécessaire à l'affichage, est-ce que ça règle aussi un problème ? »
— la question ouvre le plafond, donc elle se traite par la mesure, pas par l'avis.

**Ce que la boîte réclame vraiment** (mesures Playwright du 12/10, × densité) :

- grille : 306 px → 612 px à ×2 · compacte : 220 px → 440 px · **liste : téléphone
  334 px (×3 = 1 002 px), PC 630 px (×2 = 1 260 px)**.
- Donc : 1 260 px = aucun agrandissement nulle part (le 1 200 px retenu) ;
  1 000 px = couvre tous les cas téléphone, agrandi ×1,26 dans la seule vue « liste »
  sur PC dense ; 800 px = agrandi ×1,58 dans cette même vue.
- Réserve à citer : l'aperçu de partage (Facebook, X) demande 1200×630 ; à 800 px,
  il l'agrandit.

| plafond | fichiers réécrits | poids enlevé | site publié | récupération d'une journée d'arrivées |
|---|---|---|---|---|
| 1 200 px | 1 530 | **−37 Mo** (−13 %) | ~816 Mo (80 %) | 254 fichiers, 76 → 39 Mo = **−49 %** |
| 1 000 px | 4 398 | **−185 Mo** (−29 %) | ~668 Mo (65 %) | non mesuré (entre les deux) |
| 800 px | 4 701 | **−324 Mo** (−50 %) | ~529 Mo (52 %) | 294 fichiers, 81 → 23 Mo = **−71 %** |

Croissance brute mesurée : **+130 Mo/jour**. À 1 200 px l'entretien n'en couvre que
~2/5 (le seuil reste à quelques jours) ; à 800 px il en couvre ~2/3 (le seuil passe
à plusieurs semaines). Ne pas promettre un chiffre de jours : le flux d'arrivées varie.

Planche envoyée à B le 13/10 (message Telegram, `telegram:6691171420`) :
`/tmp/planche-1200-800.png` — détail 1:1 de la boîte 1 260 × 480, même zone dans les
trois colonnes (marchand / 1 200 px / 800 px), fabriquée par
`/tmp/planche-trois-colonnes.py`. Elle montre le **pire cas** (800 px) : 1 000 px est
entre les deux.

## 8. Le dépôt, angle mort qui ne se règle PAS par la compression

Chaque visuel entre aujourd'hui dans git **en taille marchand** (le collecteur
commite juste après le téléchargement) : ~130 Mo/jour de blobs, `.git` déjà à
2 582 Mo. Une passe après coup ne les enlève jamais. Le remède est de recompresser
**à la source** : un seul appel de sous-processus à la fin du passage du collecteur,
**avant son `git add`** (~2 s ; c'est un appel par passage, pas un par image, donc
le budget de 300 s n'est pas en cause). Restent ensuite, séparés : la règle des
7 jours (81 Mo aujourd'hui, jamais activée) et le découpage du catalogue par pays
(−3,6 Mo par visite).

## 9. DÉCISION PRISE ET APPLIQUÉE (13/10/2026)

B a délégué le choix : « prends la meilleure décision afin de satisfaire les
utilisateurs, garder un côté professionnel et d'alléger le transfert de volume. »
**Retenu : 1 000 px.** Justification, dans l'ordre de ses trois critères : n'agrandit
rien sur téléphone (toutes les vues, jusqu'à ×3 de densité), n'agrandit que de ×1,26
dans UNE vue sur PC dense (la forme de flou la moins perceptible), et récupère cinq
fois plus que 1 200 px. Il reste au-dessus de ce qu'exige un aperçu de partage.

**Résultats mesurés après la passe** (archives :
`/opt/data/sauvegardes/kazendra-images-avant-passe3`) :

| | avant | après |
|---|---|---|
| site publié (chiffre du collecteur) | 868,8 Mo (85 %) | **676,8 Mo (66 %)** |
| `docs/` | 866 Mo | 698 Mo |
| `docs/img` | 756 Mo | 578 Mo |
| fichiers réécrits | — | 4 439, 647 → 455 Mo (**−192 Mo**) |
| levier « visuels lourds » du panneau | ≈ 140,9 Mo | ≈ 43,4 Mo |
| `.git` | 2 582 Mo | 2 827 Mo (+245 Mo, irréversible) |

Preuves : **0 référence cassée** sur 19 646 visuels demandés · **902 épreuves
vertes** · 4 des plus gros fichiers en ligne identiques au local (octet à octet).
Reste compté et NON traité : **59 fichiers > 500 Ko** (transparences respectées, et
PNG sans transparence qui gardent leur format).

### L'entretien, branché dans le passage du collecteur (`bin/collecter.sh`)

`bin/entretenir-visuels.sh` tourne **juste avant le `git add`** — c'est là que le
visuel de taille marchand n'entre pas dans l'historique. Verrou, délai 150 s, code
de sortie toujours nul, silence total quand il n'y a rien à faire.

Trois défauts trouvés par l'exécution, tous corrigés et consignés dans le script :
1. **chemin relatif** → l'outil refuse un dossier à moins de trois barres obliques ;
2. **travail inutile** → 427 fichiers déjà au plafond réécrits pour 3 %, au prix de
   427 blobs définitifs (règle ajoutée : `deja_au_plafond` en lecture d'en-tête,
   plus `--gain-min 15 %`) ;
3. **comptage faux** → les transparences annoncées « déjà au plafond » (corrigé :
   `etat_fichier` rend trois états distincts).

Éprouvé pour de vrai : un arrivage simulé de 1 411 Ko (1 260 × 756 px) est descendu
**à 212 Ko (1 000 × 600), −85 %**, et l'entretien l'a **dit en une ligne**. Deux
passages de suite ne réécrivent rien (idempotent). Piège de l'épreuve, à retenir :
`shutil.copy2` **conserve l'horodatage** — un fichier d'essai daté d'hier sort de la
fenêtre « modifié depuis 3 h » et l'entretien l'ignore à juste titre.

### En attente

- **`bin/recompresser-visuels.py` et `bin/entretenir-visuels.sh` ne sont pas encore
  poussés** : la commande d'envoi a été arrêtée par le garde-fou d'approbation. Le
  travail est actif en local (c'est lui qui sert le site) ; il manque au dépôt et
  donc à la collecte de secours de GitHub.
- Sujets distincts, non traités : la règle des 7 jours (81 Mo), le découpage du
  catalogue par pays (−3,6 Mo par visite), et la croissance continue (~130 Mo/jour
  d'arrivées) que la compression ne fait que freiner.

