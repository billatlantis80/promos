#!/usr/bin/env bash
# L'ENTRETIEN DES VISUELS — la passe qui garde le site léger, SANS être une
# corvée : elle tourne dans le passage du collecteur, juste avant son `git add`,
# et ne traite que ce qui vient d'arriver.
#
# POURQUOI ELLE EST ICI ET PAS DANS UNE TÂCHE DE NUIT. Le collecteur télécharge
# les visuels en taille marchand (1 200 à 2 500 px, 200 Ko à 2,5 Mo) puis les
# commite. Une passe faite APRÈS coup ne les sort plus jamais du dépôt : `.git`
# garde les anciens blobs pour toujours (il pesait 2 582 Mo le 13/10/2026, pour
# un site de 853 Mo). En la plaçant AVANT le `git add`, le gros fichier n'entre
# jamais dans l'historique — et c'est la moitié du problème qui disparaît.
#
# POURQUOI CE N'EST PAS UNE PASSE COMPLÈTE. `--depuis 3` ne regarde que les
# fichiers modifiés dans les 3 dernières heures : quelques dizaines de fichiers,
# quelques secondes. La passe complète (19 300 fichiers) prend 8 à 12 minutes et
# ferait sauter le budget de 300 s du passage.
#
# TROIS GARDE-FOUS, chacun contre une façon de casser la collecte :
#   1. un VERROU : deux passages ne se marchent jamais dessus ;
#   2. un DÉLAI (timeout 150 s) : quoi qu'il arrive, la collecte reprend la main ;
#   3. un CODE DE SORTIE TOUJOURS NUL : un entretien raté n'a pas le droit de
#      faire échouer une collecte qui, elle, a réussi. Il le dit, et c'est tout.
#
# SILENCE QUAND RIEN NE CHANGE : le journal du passage ne reçoit une ligne que si
# des fichiers ont réellement été réécrits. Un rendez-vous qui parle pour ne rien
# dire cesse d'être lu.
set -uo pipefail

RACINE="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
cd "$RACINE" || exit 0

PYTHON="${VISUELS_PYTHON:-/opt/data/venvs/kazendra-visuels/bin/python}"
OUTIL=bin/recompresser-visuels.py
# CHEMIN ABSOLU, et pas « docs/img » : l'outil se protège des chemins douteux et
# refuse tout dossier à moins de trois barres obliques (« ce dossier n'a pas l'air
# d'un dossier de visuels »). Vécu le 13/10/2026 : le premier passage d'entretien
# s'est arrêté là — la collecte, elle, a continué, c'est le garde-fou voulu.
DOSSIER="$RACINE/docs/img"
# LE MÊME SCRIPT TOURNE À DEUX ENDROITS : sur le NAS (venv dédié, archive durable)
# et dans le workflow GitHub, qui collecte lui aussi toutes les heures. Le runner
# n'a ni /opt/data ni Pillow : il passe donc VISUELS_PYTHON=python3 et
# VISUELS_ARCHIVES vers un dossier temporaire. Sans ces deux surcharges, le
# secours recopierait des visuels en taille marchand dans le dépôt à chaque heure.
ARCHIVES="${VISUELS_ARCHIVES:-/opt/data/sauvegardes/kazendra-images-entretien}"
RESUME=/tmp/promos-visuels-resume.json

SEUIL=60000        # 60 Ko : en dessous, la recompression ne gagne rien
PLAFOND=1000       # px — la décision de B du 13/10/2026 (vues liste ×2 = 1 260 px,
                   # toutes les vues téléphone couvertes, aucune visible)
DEPUIS=3           # heures
MAXIMUM=600        # garde-fou : jamais plus de 600 fichiers par passage
GAIN_MIN=15        # % — en dessous, on ne réécrit pas : un gain de 2 % ne paie pas
                   # un nouveau blob dans git (défaut mesuré le 13/10/2026 : 427
                   # fichiers réécrits pour 3 %, 427 blobs définitifs)
RETENTION_JOURS=7

[ -x "$PYTHON" ] || { echo "entretien visuels : interpréteur absent ($PYTHON)"; exit 0; }
# LE CONTRÔLE QUI ÉVITE UN PIÈGE SILENCIEUX : un interpréteur sans Pillow ferait
# échouer l'outil (import en tête de fichier) et l'entretien se tairait pendant que
# les visuels s'accumulent. On le dit une fois, et la collecte continue.
"$PYTHON" -c "import PIL" 2>/dev/null || {
  echo "entretien visuels : Pillow absent de $PYTHON — passe ignorée, la collecte continue"
  exit 0
}
[ -d "$DOSSIER" ] || { echo "entretien visuels : dossier absent ($DOSSIER)"; exit 0; }

# 1. LE VERROU — `-n` : si un entretien tourne déjà, on lui laisse la place.
exec 9>/tmp/promos-visuels.lock
flock -n 9 || exit 0

# 2. LA PASSE, bornée dans le temps.
ARCHIVE_DU_JOUR="$ARCHIVES/$(date -u +%F)"
mkdir -p "$ARCHIVE_DU_JOUR"
rm -f "$RESUME"
timeout 150 "$PYTHON" "$OUTIL" --dossier "$DOSSIER" --seuil "$SEUIL" \
    --max-cote "$PLAFOND" --depuis "$DEPUIS" --max "$MAXIMUM" --gain-min "$GAIN_MIN" \
    --appliquer --archive "$ARCHIVE_DU_JOUR" --resume "$RESUME" \
    >/tmp/promos-visuels-sortie.txt 2>&1
CODE=$?
if [ "$CODE" -ne 0 ]; then
  echo "entretien visuels : interrompu (code $CODE) — $(tail -1 /tmp/promos-visuels-sortie.txt 2>/dev/null)"
  exit 0
fi

# 3. CE QU'ON DIT — une seule ligne, et seulement s'il y a eu du travail.
if [ -s "$RESUME" ]; then
  LIGNE=$("$PYTHON" - "$RESUME" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(0)
if not d.get("ecrits"):
    sys.exit(0)                     # rien réécrit : silence
print("visuels : %d fichier(s) allégé(s), %.1f -> %.1f Mo (sur %d arrivé(s) récent(s), "
      "plafond %d px, %d redimensionné(s), %d à transparence laissé(s))"
      % (d["ecrits"], d["moAvant"], d["moApres"], d["candidats"],
         d["plafondPx"], d["redimensionnes"], d["transparence"]))
PY
)
  [ -n "$LIGNE" ] && echo "$LIGNE"
fi

# 4. LA RÉTENTION — les originaux d'entretien ne s'accumulent pas sans fin.
#    Suppression STRICTEMENT bornée : uniquement des dossiers de date, sous
#    NOTRE dossier d'archives, et seulement s'ils sont plus vieux que 7 jours.
if [ -d "$ARCHIVES" ]; then
  find "$ARCHIVES" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' \
       -mtime "+$RETENTION_JOURS" -exec rm -rf -- {} + 2>/dev/null || true
fi

exit 0
