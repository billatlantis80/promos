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

SORTIE=$(node collecteur.mjs --publier 2>&1)
CODE=$?

if [ "$CODE" -ne 0 ]; then
  echo "⚠ Collecte Promos en ÉCHEC (code $CODE)"
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
  SOURCES:*)   echo "⚠ Promos : plus de la moitié des sources sont en échec — $INFO" ;;
  ILLISIBLE:*) echo "⚠ Promos : data/offres.json illisible (${INFO#ILLISIBLE:})" ;;
esac

# Publication : on n'envoie que si le site publié a réellement changé.
git add -A docs
if git diff --cached --quiet; then
  exit 0                      # rien de neuf : silence total
fi

git commit -q -m "Collecte $(date -u +'%Y-%m-%d %H:%M UTC')" || true

# Le workflow GitHub pousse ici aussi : on se replace sur ses épaules d'abord.
if ! git pull -q --rebase --autostash origin main >/dev/null 2>&1; then
  echo "⚠ Promos : synchronisation GitHub impossible (conflit de rebasage) — site local à jour, envoi en attente"
  exit 0
fi

if ! git push -q origin main >/dev/null 2>&1; then
  echo "⚠ Promos : envoi vers GitHub impossible — site local à jour, envoi en attente"
  exit 0
fi

exit 0
