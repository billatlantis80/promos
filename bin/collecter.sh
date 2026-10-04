#!/bin/bash
# Collecte des promos — enveloppe pour le cron.
#
# Règle : SILENCIEUX quand tout va bien (un cron qui parle toutes les 30 min
# devient du bruit, et l'utilisateur coupe la sonnerie — donc la surveillance
# aussi). On ne parle QUE quand quelque chose ne va pas :
#   - le collecteur rend un code de sortie non nul ;
#   - ou plus de la moitié des sources sont en échec (le fichier existe
#     toujours mais il ne se renouvelle plus : c'est la panne silencieuse,
#     celle qui laisse une app en apparence saine mais figée).
cd /opt/data/webdev/projects/promos || { echo "⚠ Promos : dossier du projet introuvable"; exit 1; }

SORTIE=$(node collecteur.mjs 2>&1)
CODE=$?

if [ "$CODE" -ne 0 ]; then
  echo "⚠ Collecte Promos en ÉCHEC (code $CODE)"
  echo "$SORTIE" | tail -5
  exit 1
fi

# Combien de sources en échec dans le journal de la dernière collecte ?
INFO=$(node -e '
try {
  const d = JSON.parse(require("fs").readFileSync("data/offres.json", "utf8"));
  const j = d.journal || [];
  const ko = j.filter(x => !x.ok);
  const age = (Date.now() - new Date(d.genereLe).getTime()) / 3600000;
  if (ko.length > Math.floor(j.length / 2)) {
    console.log("SOURCES:" + ko.map(x => x.source + " (" + (x.erreur || "?") + ")").join(", "));
  }
} catch (e) { console.log("ILLISIBLE:" + e.message); }
' 2>/dev/null)

case "$INFO" in
  SOURCES:*) echo "⚠ Promos : plus de la moitié des sources sont en échec — $INFO" ;;
  ILLISIBLE:*) echo "⚠ Promos : data/offres.json illisible (${INFO#ILLISIBLE:})" ;;
  *) : ;;   # rien : silence total
esac
