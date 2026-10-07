# Brancher kazendra.com sur le site — marche à suivre et état

État mesuré le **07/10/2026, de 22:33 à 23:2x UTC** (lectures DNS à la source et
navigateur réel).

## ✅ C'est branché

| Vérification | Résultat |
|---|---|
| `https://kazendra.com/` | **200** — le vrai site (titre « Kazendra — The best deals ») |
| Cartes d'offres dessinées à l'écran | **24** cartes, la première avec son prix et sa remise vérifiée |
| En-tête | « 2602 good deals · 12143 deals · updated 1 min ago » |
| `https://kazendra.com/admin/` | **200** — écran de connexion admin |
| `https://kazendra.com/offres.json` | **200** (10,4 Mo, les offres) |
| `https://kazendra.com/img/…jpg` | **200** — les visuels suivent |
| Erreurs JavaScript / ressources manquantes | **0** |
| `http://kazendra.com/` | **301** → HTTPS |
| `https://www.kazendra.com/` | **301** → `https://kazendra.com/` |
| Ancienne adresse `billatlantis80.github.io/promos/` | **301** → `https://kazendra.com/` |
| Certificat HTTPS | **approuvé**, couvre `kazendra.com` **et** `www.kazendra.com` (jusqu'au 05/01/2027) |
| « Forcer HTTPS » | **activé** |

## Où on en était (pour mémoire)

Les 5 domaines étaient chez **OVH** (`ns111.ovh.net` / `dns111.ovh.net`) et pointaient sur la
page d'attente d'OVH (`kazendra.com` répondait 404 « Site not installed »).

| Domaine | Avant | Maintenant |
|---|---|---|
| kazendra.com | A `51.91.236.255` + AAAA `2001:41d0:301::29` | 4 × A `185.199.108-111.153` |
| www.kazendra.com | mêmes adresses | CNAME → `billatlantis80.github.io` |
| kazendra.be/.eu/.app/.fr | A `213.186.33.5` | ⏳ à faire : redirection gratuite OVH vers `kazendra.com` |

## Ce qui a été fait, et par qui

**À la main (l'utilisateur), dans la zone DNS OVH :**
1. Suppression de l'`A 51.91.236.255` et de l'`AAAA 2001:41d0:301::29` sur `@`.
2. Ajout des **4 lignes A** → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`
   (l'assistant OVH n'en accepte qu'une à la fois → quatre passages).
3. Suppression de l'`A` de `www` et du `TXT "3|welcome"`, puis ajout du
   **CNAME** `www → billatlantis80.github.io`.

**Par l'agent :**
- Fichier `CNAME` (mot `kazendra.com`) dans `public/` **et** `docs/` — le collecteur
  recopie `public/` vers `docs/` en fusion (`cpSync`, pas de suppression) : le fichier survit
  à chaque passage du cron de collecte.
- Domaine personnalisé posé sur le dépôt (API GitHub) + « Forcer HTTPS ».
- Adresse de partage du code : `const HUB` passe de
  `https://billatlantis80.github.io/promos/` à `https://kazendra.com/`.
- Épreuve réelle dans un navigateur (`outils/epreuve-domaine.py`).

## Deux pièges rencontrés, à retenir

- **Un dépôt *projet* avec son propre domaine est servi À LA RACINE** du domaine, pas sous
  `/nom-du-dépôt/`. Preuve : `electron/electronjs.org-old` (CNAME `electron.atom.io`) a pour
  `html_url` `https://electron.atom.io/`. Donc le site vit sur `https://kazendra.com/`, et sa
  racine change — d'où la vérification que `img/…` se charge bien en `/img/…`.
- **L'espace OVH garde une photo périmée de la zone.** Après suppression du `TXT "3|welcome"`,
  l'ajout du CNAME a été refusé par « un CNAME ne peut pas cohabiter… » alors que la zone
  était déjà propre : il fallait **fermer et rouvrir** la page pour qu'OVH relise la zone.
  Contrôle indépendant possible à tout moment : `outils/dnsq.py` interroge le serveur faisant
  autorité (`python3 outils/dnsq.py ns111.ovh.net www.kazendra.com CNAME`), donc sans le TTL
  de cache d'un résolveur.
- **`www` par CNAME, et pas par A** : un `CNAME` ne cohabite avec aucun autre enregistrement au
  même nom — il faut retirer l'ancien `TXT` avant.
- **MX et SPF intouchés** : c'est le courrier de `info@kazendra.com`
  (`mx1/mx2/mx3.mail.ovh.net` + `v=spf1 include:mx.ovh.com -all`).

## Reste à faire

1. **`kazendra.be` / `.eu` / `.app` / `.fr`** → dans l'espace OVH, onglet **Redirection** du
   domaine (gratuit), vers `https://kazendra.com`. Ces TLD ne peuvent pas être servis par
   GitHub Pages : seul un domaine personnalisé est accepté par dépôt, les autres doivent
   rediriger.
2. **APK n°2** : le site embarqué porte encore l'ancienne adresse (`const HUB`), donc les
   visuels sont demandés à l'ancienne URL — qui redirige, donc rien ne casse, mais une
   reconstruction le ferait pointer directement sur `kazendra.com`.
3. **`info@kazendra.com`** : à créer/vérifier chez OVH, la page Informations du site l'affiche.
