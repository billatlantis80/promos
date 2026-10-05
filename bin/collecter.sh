#!/bin/bash
# Collecte + publication + envoi vers GitHub — application n°2 « Promos ».
#
# Règle : SILENCIEUX quand tout va bien. Un cron qui parle toutes les 5 minutes
# devient du bruit, on coupe la sonnerie — et on coupe donc la surveillance avec.
# On ne parle QUE quand quelque chose ne va pas :
#   - le collecteur rend un code de sortie non nul ;
#   - plus de la moitié des sources sont en échec (le fichier existe toujours
#     mais ne se renouvelle plus : c'est la panne silencieuse, celle qui laisse
#     une app en apparence saine mais figée) ;
#   - la publication vers GitHub échoue.
#
# La collecte tourne ici, sur le NAS, et non dans GitHub Actions : l'expérience
# a montré qu'une planification GitHub sur un dépôt neuf peut ne jamais se
# déclencher, et l'application paraîtrait alors saine tout en servant des
# données figées. Le workflow GitHub reste en secours, une fois par heure.
set -u
cd /opt/data/webdev/projects/promos || { echo "⚠ Promos : dossier du projet introuvable"; exit 1; }
export PATH="/opt/data/bin:$PATH"

# --- Alerte qui ne radote pas -------------------------------------------------
# Défaut mesuré : quand la synchronisation GitHub a cassé, le même message est
# parti toutes les 5 minutes pendant quatorze heures — 88 fois. Un message qu'on
# voit 88 fois ne se lit plus ; il finit par masquer le prochain vrai problème.
# On ne répète donc un MÊME message qu'au bout de 30 minutes.
alerte() {
  fichier="/tmp/promos-alerte.txt"
  maintenant=$(date +%s)
  texte="$1"
  if [ -f "$fichier" ]; then
    dernier=$(cut -d' ' -f1 "$fichier" 2>/dev/null)
    ancien=$(cut -d' ' -f2- "$fichier" 2>/dev/null)
    if [ "$ancien" = "$texte" ] && [ "$((maintenant - ${dernier:-0}))" -lt 1800 ]; then
      return 0
    fi
  fi
  echo "$maintenant $texte" > "$fichier" 2>/dev/null || true
  echo "$texte"
}

# --- Se débloquer soi-même, AVANT toute autre chose ---------------------------
# Défaut mesuré : quand « git pull --rebase » tombait sur un conflit, le script
# s'arrêtait LÀ, sans nettoyer. Le dépôt restait au milieu d'un rebasage ; le
# passage suivant échouait de la même façon ; et la publication vers GitHub
# restait bloquée pour toujours. Un dépôt bloqué doit se débloquer tout seul.
GIT="git -c core.editor=true"
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  $GIT rebase --abort >/dev/null 2>&1 || true
fi

SORTIE=$(node collecteur.mjs --publier 2>&1)
CODE=$?

if [ "$CODE" -ne 0 ]; then
  alerte "⚠ Collecte Promos en ÉCHEC (code $CODE)"
  echo "$SORTIE" | tail -5
  exit 1
fi

# Combien de sources en échec dans le journal du dernier passage ?
INFO=$(node -e '
try {
  const d = JSON.parse(require("fs").readFileSync("data/offres.json", "utf8"));
  const j = d.journal || [];
  const ko = j.filter(x => !x.ok);
  if (ko.length > Math.floor(j.length / 2)) {
    console.log("SOURCES:" + ko.map(x => x.source + " (" + (x.erreur || "?") + ")").join(", "));
  }
} catch (e) { console.log("ILLISIBLE:" + e.message); }
' 2>/dev/null)

case "$INFO" in
  SOURCES:*)   alerte "⚠ Promos : plus de la moitié des sources sont en échec — $INFO" ;;
  ILLISIBLE:*) alerte "⚠ Promos : data/offres.json illisible (${INFO#ILLISIBLE:})" ;;
esac

# Publication : on n'envoie que si le site publié a réellement changé.
git add -A docs
if git diff --cached --quiet; then
  exit 0                      # rien de neuf : silence total
fi

git commit -q -m "Collecte $(date -u +'%Y-%m-%d %H:%M UTC')" || true

# Le workflow GitHub pousse ici aussi : on se replace sur ses épaules d'abord.
if ! $GIT pull -q --rebase --autostash origin main >/dev/null 2>&1; then
  # docs/offres.json est un fichier GÉNÉRÉ : la version locale vient d'être
  # recalculée à l'instant, c'est donc la plus fraîche. Un conflit dessus n'a
  # rien à arbitrer — on garde la nôtre et on poursuit la synchronisation.
  # (C'est exactement ce conflit qui a bloqué le dépôt quatorze heures.)
  resolu=0
  if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
    if $GIT diff --name-only --diff-filter=U | grep -qx 'docs/offres.json'; then
      $GIT checkout --ours -- docs/offres.json >/dev/null 2>&1 && $GIT add docs/offres.json >/dev/null 2>&1
    fi
    if [ -z "$($GIT diff --name-only --diff-filter=U)" ]; then
      $GIT rebase --continue >/dev/null 2>&1 && resolu=1
    fi
  fi
  if [ "$resolu" -ne 1 ]; then
    # On ne laisse JAMAIS le dépôt au milieu d'un rebasage : c'est ce qui le
    # condamnait à échouer à chaque passage suivant.
    $GIT rebase --abort >/dev/null 2>&1 || true
    alerte "⚠ Promos : synchronisation GitHub impossible — site local à jour, envoi en attente"
    exit 0
  fi
fi

if ! $GIT push -q origin main >/dev/null 2>&1; then
  alerte "⚠ Promos : envoi vers GitHub impossible — site local à jour, envoi en attente"
  exit 0
fi

# Tout est passé : on efface le souvenir de l'alerte, pour que la prochaine
# panne soit annoncée TOUT DE SUITE au lieu d'attendre 30 minutes.
rm -f /tmp/promos-alerte.txt
exit 0
