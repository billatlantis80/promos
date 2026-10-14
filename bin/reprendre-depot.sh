#!/bin/bash
# =============================================================================
# LA REPRISE DU DÉPÔT — hebdomadaire, conditionnelle, sous verrou.
#
# DÉCISION DE B, 14/10/2026 : « Ok » à la proposition
#   « seuil 1,5 Go, verrou partagé, rotation des bundles, vérification du contenu ».
#
# POURQUOI ELLE EXISTE. Un passage de collecte ajoute une version neuve du
# catalogue (~10 Mo) et des visuels, et git **ne rend jamais un blob** : chaque
# version reste dans l'histoire pour toujours. Mesuré le 14/10/2026 après la règle
# des cinq jours : **14,7 Mo non compressés par passage, 308 fichiers** — soit
# ~0,5 Go par jour et **~3,5 Go par semaine**. Sans reprise, le dépôt atteint 4 Go
# en un mois, et chaque clone et chaque envoi ralentissent avec lui.
#
# LA MÉTHODE N'EST PAS INVENTÉE ICI : c'est celle qui a été faite à la main le
# 14/10/2026 (voir REECRITURE-HISTORIQUE-2026-10-14.md), et qui a ramené le dépôt
# de 3 200 Mo à 617 Mo. Un commit racine unique portant l'état exact, un
# force-push, un ramasse-miettes local. 100 secondes, mesuré.
#
# CE QU'ELLE COÛTE, ET IL FAUT LE SAVOIR : **la traçabilité par passage**. Après
# une reprise, `git log` ne raconte plus la semaine écoulée. B a accepté ce prix le
# 14/10 en choisissant l'option C. Deux choses le compensent, et les deux sont
# automatiques ici :
#   • le BUNDLE de retour (avant chaque reprise) : l'histoire complète, restaurable ;
#   • le REGISTRE (`REGISTRE-DES-COMMITS.md`, ajouté au dépôt) : la liste des commits
#     repliés, écrite DANS l'arbre — donc elle survit à ce que `git log` perd.
#
# LES QUATRE GARDE-FOUS, ET CHACUN RÉPOND À UN DÉFAUT NOMMÉ :
#
#  1. LE SEUIL DÉCIDE, PAS LE JOUR. Le script passe **chaque jour** ; il n'agit que
#     si `.git` dépasse SEUIL_MO, et **ne dit rien** sinon. « Un rendez-vous qui
#     parle pour rien dire cesse d'être lu » — la règle du suivi des visuels,
#     appliquée ici.
#
#     ⚠ POURQUOI CHAQUE JOUR, ALORS QUE LA PROPOSITION ÉTAIT HEBDOMADAIRE. Ma
#     proposition était « chaque semaine » ; la mesure l'a démentie le 14/10/2026,
#     et c'est elle qui a raison : ~0,5 Go par jour, donc un contrôle hebdomadaire
#     laisserait le dépôt atteindre ~4 Go avant d'agir — exactement ce qu'on veut
#     empêcher. Avec un contrôle QUOTIDIEN et le même seuil, le dépôt oscille entre
#     1,5 et 2 Go. Le seuil reste la décision ; la fréquence n'est que la fréquence
#     à laquelle on regarde. Et comme il est muet quand il n'a rien à faire, la
#     regarder tous les jours ne coûte rien.
#  2. LE VERROU DE LA COLLECTE EST ATTENDU, PAS FORCÉ. La reprise réécrit l'histoire
#     et force-push ; la collecte fait `fetch / reset --soft / commit / push` toutes
#     les quinze minutes. Les deux ensemble, c'est une passe perdue ou un envoi qui
#     annule la reprise. On prend donc le MÊME verrou que `bin/collecter.sh`, en
#     ATTENDANT (`flock -w`), pas en échouant. Pendant la reprise, les passages de
#     collecte s'effacent en silence — c'est leur comportement normal quand la place
#     est prise, et ça ne se voit pas.
#  3. LA PORTE DE RETOUR, ET SA ROTATION. Un bundle **vérifié** avant chaque reprise
#     (`git bundle verify` doit dire « complete history »). On garde les GARDE
#     derniers et on efface les plus vieux : sans rotation, les sauvegardes pèsent
#     plus lourd que ce qu'elles sauvent. Le bundle du 14/10 (2,97 Go, l'avant-
#     réécriture d'origine) est HORS de cette rotation — il est nommé autrement,
#     exprès, et reste.
#  4. ELLE PROUVE, ELLE NE RAPPORTE PAS. Le contenu publié est empreint AVANT et
#     APRÈS (empreinte du catalogue + nombre de visuels + octets publiés) : la
#     réécriture doit toucher l'HISTOIRE, jamais ce que le site sert. Puis on
#     vérifie `.git` plus petit, `origin/main` à la nouvelle pointe, et le site en
#     ligne. Si une seule de ces preuves manque, on le DIT.
#
# Usage :
#   bin/reprendre-depot.sh           # la reprise réelle (silencieuse si sous le seuil)
#   bin/reprendre-depot.sh --essai   # répétition générale dans /tmp : ne touche à RIEN
# =============================================================================
set -u
cd "$(dirname "$0")/.." || { echo "⚠ Promos : dossier du projet introuvable"; exit 1; }
export PATH="/opt/data/bin:$PATH"

SEUIL_MO=1500                                  # le seuil qui décide, pas le jour
BUNDLES=/opt/data/sauvegardes                  # où vivent les portes de retour
GARDE=2                                        # nombre de bundles de reprise gardés
VERROU=/tmp/promos-collecte.lock               # LE MÊME QUE bin/collecter.sh
REGISTRE=REGISTRE-DES-COMMITS.md               # le récit que `git log` perd
ESSAI=0
[ "${1:-}" = "--essai" ] && ESSAI=1

mesure_mo() { du -sm "${1:-.git}" | cut -f1; }

# --- LE CONTENU PUBLIÉ, EMPREINT POUR POUVOIR ÊTRE COMPARÉ ---------------------
#  Trois mesures, et pas une seule : l'empreinte du catalogue attrape un contenu
#  différent, le nombre de visuels attrape un fichier disparu, et le total d'octets
#  attrape un fichier tronqué. Une seule des trois laisserait passer les deux autres.
empreinte() {
  {
    sha256sum docs/offres.json | cut -d' ' -f1
    find docs/img -type f | wc -l
    find docs -type f -printf '%s\n' | awk '{s+=$1} END {printf "%.0f\n", s}'
  } | tr '\n' ' '
}

# --- LA REPLIQUE DE L'HISTOIRE (la méthode du 14/10, dans un répertoire donné) --
#  « Orphan » = une branche sans parent. On commite l'arbre EXACT qu'on a sous la
#  main, et ce commit devient la nouvelle racine : plus aucun blob d'avant n'est
#  atteignable, donc le ramasse-miettes peut tout rendre.
replier_histoire() {
  local r="$1"
  ( cd "$r" || exit 1
    git add -A >/dev/null 2>&1
    git checkout -q --orphan reprise-tmp 2>/dev/null || return 1
    git add -A >/dev/null 2>&1
    git commit -q -m "État publié au $(date -u +'%Y-%m-%d %H:%M') UTC — reprise du dépôt ($(git rev-list --count HEAD 2>/dev/null || echo '?') commits repliés avant réécriture)" || return 1
    git branch -M main || return 1
  )
}

# --- LE RAMASSE-MIETTES, ET SON ORDRE — QUI EST TOUT LE SUJET -------------------
#  Défaut trouvé par la répétition générale, PAS dans un raisonnement : lancé avant
#  l'envoi, ce ramasse-miettes ne rend RIEN (615 Mo → 615 Mo). La raison est exacte
#  et il faut la garder en tête : tant que `origin/main` pointe sur l'ancienne
#  histoire, **tous les anciens blobs restent joignables**, et git ne supprime
#  jamais ce qui est joignable. Il a raison de ne pas le faire.
#
#  L'ordre est donc : replier → **pousser** (ce qui fait avancer `origin/main` sur
#  la nouvelle racine) → **puis** ramasser. « Une reprise qui n'enlève rien est une
#  reprise qui n'a pas eu lieu », et elle se serait signalée par un silence fier.
ramasser() {
  local r="$1"
  ( cd "$r" || exit 1
    git reflog expire --expire=now --all 2>/dev/null || true
    git gc --prune=now --quiet 2>/dev/null || true
  )
}

# =============================================================================
# LA RÉPÉTITION GÉNÉRALE — tout est exercé, rien n'est touché.
# C'est la seule façon de savoir si la reprise fonctionne sans risquer le dépôt
# de production : on clone dans /tmp, on replie là-bas, et on compare.
# =============================================================================
if [ "$ESSAI" -eq 1 ]; then
  TMP=$(mktemp -d /tmp/reprise-essai-XXXXXX) || exit 1
  echo "ESSAI — clone jetable dans $TMP"
  AVANT_CLONE=$(mesure_mo .git)
  git clone -q --no-local . "$TMP/depot" 2>/dev/null || { echo "⚠ clone impossible"; rm -rf "$TMP"; exit 1; }
  # L'IDENTITÉ D'AUTEUR NE SUIT PAS UN CLONE — et c'est le premier défaut qu'a
  # trouvé la répétition générale du 14/10/2026 : le commit échouait avec « Author
  # identity unknown ». On la reprend donc de CE dépôt, pour que la répétition
  # utilise exactement l'auteur de la production, et pas un auteur inventé.
  git -C "$TMP/depot" config user.name "$(git config user.name)"
  git -C "$TMP/depot" config user.email "$(git config user.email)"
  E_AVANT=$(empreinte)
  T_AVANT=$(mesure_mo "$TMP/depot/.git")
  AVANT_COMMITS=$(git rev-list --count HEAD)
  replier_histoire "$TMP/depot" || { echo "⚠ la réplique a échoué"; rm -rf "$TMP"; exit 1; }
  #  ON SIMULE L'ENVOI, SINON LA RÉPÉTITION MENTIRAIT. En production, le
  #  force-push fait avancer `origin/main` sur la nouvelle racine AVANT le
  #  ramasse-miettes. Ici il n'y a pas d'envoi : les références de suivi
  #  `refs/remotes/origin/*` garderaient toute l'ancienne histoire joignable, et le
  #  clone ne maigrirait pas d'un octet. On les retire donc — c'est exactement ce
  #  que le push aura fait — pour que la mesure veuille dire quelque chose.
  git -C "$TMP/depot" remote remove origin >/dev/null 2>&1 || true
  ramasser "$TMP/depot"
  T_APRES=$(mesure_mo "$TMP/depot/.git")
  APRES_COMMITS=$(git -C "$TMP/depot" rev-list --count HEAD)
  E_APRES=$(
    {
      sha256sum "$TMP/depot/docs/offres.json" | cut -d' ' -f1
      find "$TMP/depot/docs/img" -type f | wc -l
      find "$TMP/depot/docs" -type f -printf '%s\n' | awk '{s+=$1} END {printf "%.0f\n", s}'
    } | tr '\n' ' '
  )
  echo "  commits      : $AVANT_COMMITS → $APRES_COMMITS"
  echo "  .git du clone: ${T_AVANT} Mo → ${T_APRES} Mo"
  echo "  contenu      : $([ "$E_AVANT" = "$E_APRES" ] && echo 'IDENTIQUE (empreinte, visuels, octets)' || echo "DIFFÉRENT —\n    avant : $E_AVANT\n    après : $E_APRES")"
  echo "  dépôt de production : intact (jamais ouvert en écriture)"
  rm -rf "$TMP"
  [ "$E_AVANT" = "$E_APRES" ] || exit 1
  exit 0
fi

# =============================================================================
# LA REPRISE RÉELLE
# =============================================================================

# --- 1. LE VERROU, ATTENDU -----------------------------------------------------
#  `flock -w 600` : on patiente jusqu'à dix minutes. Échouer au bout de dix minutes
#  n'est pas un caprice — c'est le signe qu'un passage est BLOQUÉ, et ça se dit.
exec 9>"$VERROU"
if ! flock -w 600 9; then
  echo "⚠ Promos : reprise impossible — la collecte tient le verrou depuis plus de 10 minutes"
  exit 1
fi

# --- 2. LE SEUIL DÉCIDE --------------------------------------------------------
AVANT_MO=$(mesure_mo .git)
if [ "$AVANT_MO" -lt "$SEUIL_MO" ]; then
  exit 0                                        # sous le seuil : silence total
fi

# --- 3. L'EMPREINTE DU CONTENU, AVANT TOUCHER À QUOI QUE CE SOIT ---------------
CONTENU_AVANT=$(empreinte)

# --- 4. LA PORTE DE RETOUR, VÉRIFIÉE, PUIS LA ROTATION -------------------------
BUNDLE="$BUNDLES/promos-avant-reprise-$(date -u +'%Y-%m-%d').bundle"
if ! git bundle create "$BUNDLE" --all >/dev/null 2>&1; then
  echo "⚠ Promos : reprise ANNULÉE — le bundle de retour n'a pas pu être écrit ($BUNDLE)"
  exit 1
fi
if ! git bundle verify "$BUNDLE" 2>&1 | grep -q "complete history"; then
  echo "⚠ Promos : reprise ANNULÉE — le bundle de retour ne porte pas une histoire complète"
  exit 1
fi
# Rotation : on garde les GARDE plus récents, on efface les autres. Le bundle du
# 14/10 s'appelle « promos-historique-avant-C-… » : il ne correspond pas au motif,
# donc il n'est JAMAIS emporté par cette ligne. C'est voulu.
ls -1t "$BUNDLES"/promos-avant-reprise-*.bundle 2>/dev/null | tail -n +"$((GARDE + 1))" | while read -r vieux; do rm -f "$vieux"; done

# --- 5. LE RÉCIT, ÉCRIT AVANT DE REPLIER --------------------------------------
#  Ce que `git log` va perdre, on l'écrit dans l'ARBRE. Le registre survit donc à
#  la réécriture, et c'est la seule trace narrative qui reste du passage du temps.
NB_COMMITS=$(git rev-list --count HEAD)
{
  printf '\n## Reprise du %s — %s commit(s) repliés\n' "$(date -u +'%Y-%m-%d %H:%M')" "$NB_COMMITS"
  printf 'Bundle de retour : `%s`\n\n' "$BUNDLE"
  git log --format='- `%h` %s (%ad)' --date=short -n 400
  if [ "$NB_COMMITS" -gt 400 ]; then printf '\n*(+ %s autres, plus anciens, dans le bundle)*\n' "$((NB_COMMITS - 400))"; fi
} >> "$REGISTRE" 2>/dev/null || true

# --- 6. LA REPLIQUE ------------------------------------------------------------
replier_histoire . || { echo "⚠ Promos : reprise INTERROMPUE — la réplique a échoué, le dépôt est à examiner"; exit 1; }

# --- 7. L'ENVOI ----------------------------------------------------------------
if ! git push --force -q origin main >/dev/null 2>&1; then
  echo "⚠ Promos : réplique faite en local mais ENVOI REFUSÉ — origin/main et la copie locale divergent, intervention nécessaire"
  exit 1
fi

# --- 7 bis. LE RAMASSE-MIETTES — APRÈS l'envoi, jamais avant (voir `ramasser`).
#  C'est le seul endroit où les 500 Mo sont réellement rendus, et il n'était pas
#  à sa place dans le premier jet : mesuré, il ne rendait rien.
ramasser .

# --- 8. LES PREUVES, ET ELLES SONT LA PARTIE QUI COMPTE ------------------------
CONTENU_APRES=$(empreinte)
APRES_MO=$(mesure_mo .git)
POINTE_LOCALE=$(git rev-parse HEAD)
POINTE_ORIGINE=$(git rev-parse origin/main 2>/dev/null || echo '?')
SITE=$(curl -s -o /dev/null -m 20 -w '%{http_code}' https://kazendra.com/ 2>/dev/null || echo '?')

LIGNE="Reprise du dépôt — .git ${AVANT_MO} → ${APRES_MO} Mo · ${NB_COMMITS} commit(s) → 1"
[ "$CONTENU_AVANT" = "$CONTENU_APRES" ] && LIGNE="$LIGNE · contenu publié IDENTIQUE" || LIGNE="$LIGNE · ⚠ CONTENU MODIFIÉ"
[ "$POINTE_LOCALE" = "$POINTE_ORIGINE" ] && LIGNE="$LIGNE · envoyé" || LIGNE="$LIGNE · ⚠ envoi non confirmé"
LIGNE="$LIGNE · kazendra.com $SITE"
echo "$LIGNE"

# Une seule chose peut rendre la sortie bruyante alors que tout a marché : le site
# injoignable. On ne le tait pas — un dépôt repris et un site muet sont deux
# nouvelles différentes.
[ "$CONTENU_AVANT" = "$CONTENU_APRES" ] || exit 1
[ "$POINTE_LOCALE" = "$POINTE_ORIGINE" ] || exit 1
[ "$SITE" = "200" ] || exit 1
exit 0
