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
#   - la publication vers GitHub échoue ;
#   - un passage est resté BLOQUÉ (ajouté le 11/10/2026, voir plus bas).
#
# La collecte tourne ici, sur le NAS, et non dans GitHub Actions : l'expérience
# a montré qu'une planification GitHub sur un dépôt neuf peut ne jamais se
# déclencher, et l'application paraîtrait alors saine tout en servant des données
# figées. Le workflow GitHub reste en secours, une fois par heure.
#
# ------------------------------------------------------------------
# POURQUOI LA LIMITE DU PLANIFICATEUR EST PASSÉE DE 120 s À 300 s
# (défaut mesuré le 11/10/2026, pas une hypothèse)
#
# Le 11/10/2026 à 20:42, le cron a écrit : « Script timed out after 120s ». Ce
# n'était pas un accident isolé : sur les 2 051 passages enregistrés depuis le
# 04/10, ONZE ont été tués de la même façon — dont SEPT d'affilée les 09/10 à
# 21:37, 21:42, 21:47, 21:52, 21:57, 22:02 et 22:07.
#
# La cause est arithmétique, et elle était inscrite dans le code : les délais
# internes du collecteur (sources 45 s + visuels 30 s + téléchargements 25 s =
# 100 s) avaient été réglés pour tenir *juste* sous les 120 s, en ne laissant
# que 20 s à la publication des 19 000 pages et à l'envoi Git. Un passage normal
# prend 10 à 20 s (mesuré) ; il suffit que la machine soit occupée — B travaille
# en même temps, un autre agent écrit dans le même dépôt — pour que le passage
# lent franchisse les 120 s et soit tué EN PLEINE ÉCRITURE : pas de commit, pas
# d'envoi, un passage payé pour rien, et l'alerte ci-dessus envoyée à B.
#
# La limite est donc portée à 300 s (config.yaml → cron.script_timeout_seconds).
# Ce n'est pas une façon de travailler plus longtemps : c'est le droit d'aller au
# bout quand un passage tombe mal. Le travail réel reste borné par BUDGET_CRON.
#
# ET UN PASSAGE BLOQUÉ NE DORT PLUS EN SILENCE.
# Jusqu'ici, un passage tué laissait son verrou fermé ; les passages suivants
# s'effaçaient sans un mot (« la place est prise ») et le site pouvait se figer
# sans que personne ne le sache. Désormais un passage qui dépasse DELAI_MAX est
# déclaré bloqué : on le DIT, on tue l'ouvrier, et on reprend la main.
# ------------------------------------------------------------------
set -u
cd /opt/data/webdev/projects/promos || { echo "⚠ Promos : dossier du projet introuvable"; exit 1; }
export PATH="/opt/data/bin:$PATH"

VERROU=/tmp/promos-collecte.lock        # un seul passage à la fois
DEPART=/tmp/promos-collecte.depart      # « heure pid » du passage en cours
JOURNAL=data/passages.log               # journal local des passages (data/ est hors git)
DELAI_MAX=240                           # au-delà : passage BLOQUÉ (le planificateur coupe à 300 s)

# --- L'alerte qui ne radote pas -------------------------------------------------
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

# --- Le journal des passages ----------------------------------------------------
# Deux questions restaient sans réponse le 11/10/2026 : combien de temps prend un
# passage, et QUELLE phase a mangé le temps quand il dépasse ? On ne pouvait pas
# le savoir : la sortie du collecteur était capturée puis jetée. Chaque passage
# laisse donc maintenant une trace horodatée et bornée dans data/passages.log
# (1 000 lignes gardées), et chaque phase de ce script y écrit sa durée.
journal() { printf '%s %s\n' "$(date -u +'%Y-%m-%d %H:%M:%S')" "$*" >> "$JOURNAL" 2>/dev/null || true; }
horodater() { awk '{ printf "%s %s\n", strftime("%H:%M:%S", systime(), 1), $0; fflush() }'; }
ms() { date +%s%3N; }

# --- UN SEUL PASSAGE À LA FOIS, ET QUI NE RESTE PAS BLOQUÉ ----------------------
# Défaut mesuré le 09/10/2026 au soir : la collecte a dépassé le délai de 120 s
# du planificateur, qui tuait le script… mais PAS le collecteur Node qu'il avait
# lancé. Le Node orphelin continuait donc son travail pendant qu'un nouveau
# passage démarrait cinq minutes plus tard : deux collecteurs à la fois sur le
# même dépôt et les mêmes sites, chacun relisant tout ce que l'autre n'avait pas
# fini d'écrire. C'est ce qui rendait la panne si tenace — chaque passage trouvait
# l'état non écrit par le précédent, et relisait les 220 adresses de zéro.
#
# Le verrou rend l'empilement impossible : si un passage tourne encore, le
# suivant s'efface sans bruit (exit 0 : ce n'est pas une erreur, juste « la
# place est prise »). Il se libère tout seul à la mort du processus.
exec 9>"$VERROU"
if ! flock -n 9; then
  quand=$(cut -d' ' -f1 "$DEPART" 2>/dev/null || echo 0)
  pid=$(cut -d' ' -f2 "$DEPART" 2>/dev/null || echo 0)
  age=$(( $(date +%s) - ${quand:-0} ))
  if [ "${quand:-0}" -gt 0 ] && [ "$age" -gt "$DELAI_MAX" ]; then
    # BLOQUÉ. On le dit AVANT de le tuer — sinon personne ne saurait jamais
    # pourquoi le site s'est figé. Puis on tue l'ouvrier Node (c'est lui qui
    # tient le verrou), et le script qui l'attend, s'il est encore vivant.
    alerte "⚠ Promos : la collecte était bloquée depuis $((age / 60)) min — relancée"
    if [ "${pid:-0}" -gt 0 ] && grep -aq "collecte-promos" "/proc/$pid/cmdline" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    pkill -9 -f 'node .*collecteur\.mjs' 2>/dev/null || true
    rm -f "$DEPART"
    sleep 2
    if ! flock -n 9; then
      exit 0                    # quelqu'un a déjà repris la main : on le laisse faire
    fi
  else
    exit 0                      # un passage normal tourne : rien à signaler
  fi
fi
printf '%s %s\n' "$(date +%s)" "$$" > "$DEPART"
trap 'rm -f "$DEPART"' EXIT

# --- Se débloquer soi-même, AVANT toute autre chose ---------------------------
# Défaut mesuré : quand « git pull --rebase » tombait sur un conflit, le script
# s'arrêtait LÀ, sans nettoyer. Le dépôt restait au milieu d'un rebasage ; le
# passage suivant échouait de la même façon ; et la publication vers GitHub
# restait bloquée pour toujours. Un dépôt bloqué doit se débloquer tout seul.
GIT="git -c core.editor=true"
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  $GIT rebase --abort >/dev/null 2>&1 || true
fi

# --- DEBUT fonction de reparation du depot (extraite par tests/depot-auto-reparation.test.mjs) ---
# LE DÉPÔT SE RÉPARE TOUT SEUL — et c'est une panne VÉCUE, pas une hypothèse.
#
# Le 08/10/2026, une coupure de courant est tombée pendant que git écrivait un
# commit. Git a été interrompu en pleine écriture et a laissé un objet de
# **0 octet** à la place du commit. Conséquence exacte : « fatal: bad object
# HEAD », TOUTE commande git devient impossible, et plus rien ne peut être publié
# vers GitHub. En silence : la collecte continuait, le site restait en ligne (il
# est servi par GitHub, pas par cette machine), et la sauvegarde était morte sans
# que personne ne le sache. Il a fallu une réparation à la main.
#
# Ça se reproduira à la prochaine coupure. On répare donc AVANT d'essayer de
# publier, et on le DIT :
#
#   1. on regarde si l'état du dépôt est LISIBLE — le commit ET son arborescence
#      (un paquet tronqué casse souvent la seconde sans empêcher le premier de
#      répondre : s'arrêter au commit laisserait passer le cas) ;
#   2. sinon, on efface les objets de 0 octet. Un objet git valide n'en fait
#      JAMAIS 0 : c'est une écriture interrompue, rien d'autre. Il FAUT les
#      effacer AVANT de récupérer — sinon git croit les avoir et ne les
#      retélécharge pas ;
#   3. on récupère depuis GitHub et on se replace sur la pointe de l'origine.
#
# Le CONTENU n'est jamais en danger : data/ et docs/ sont recalculés à chaque
# passage. Ce qu'on sauve, c'est la CAPACITÉ À PUBLIER — et le fait de le savoir.
reparer_depot() {
  [ -d .git ] || return 0                       # pas un dépôt : rien à réparer
  # L'état est-il lisible ? Deux lectures, pas une.
  if $GIT cat-file -e HEAD 2>/dev/null && $GIT cat-file -e 'HEAD^{tree}' 2>/dev/null; then
    return 0
  fi
  # Aucun commit n'a jamais existé : il n'y a rien à sauver, et rien à dire.
  $GIT rev-parse --verify HEAD >/dev/null 2>&1 || return 0

  vides=$(find .git/objects -type f -size 0 2>/dev/null | wc -l | tr -d ' ')
  find .git/objects -type f -size 0 -delete 2>/dev/null
  # Fichiers temporaires d'une écriture interrompue : git les nomme « tmp_obj_* ».
  # Ce ne sont jamais des objets valides.
  find .git/objects -type f -name 'tmp_obj_*' -delete 2>/dev/null

  if ! $GIT fetch -q origin main >/dev/null 2>&1; then
    alerte "⚠ Promos : dépôt abîmé et GitHub injoignable — publication impossible ($vides objet(s) tronqué(s))"
    return 1
  fi
  # Remise à plat de l'index. Si l'index lui-même a souffert de la coupure, on
  # l'efface : git le reconstruit à partir de l'arborescence récupérée.
  $GIT reset --mixed FETCH_HEAD >/dev/null 2>&1 \
    || { rm -f .git/index; $GIT reset --mixed FETCH_HEAD >/dev/null 2>&1; }

  if $GIT cat-file -e HEAD 2>/dev/null && $GIT cat-file -e 'HEAD^{tree}' 2>/dev/null; then
    alerte "⚠ Promos : dépôt abîmé (coupure de courant ?) — réparé tout seul depuis GitHub ($vides objet(s) tronqué(s))"
    return 0
  fi
  alerte "⚠ Promos : dépôt abîmé, réparation insuffisante — intervention nécessaire"
  return 1
}
# --- FIN fonction de reparation du depot ---

# Réparer AVANT tout le reste : sans un dépôt lisible, ni le commit ni l'envoi
# ne peuvent aboutir, et le passage échouerait sans rien dire d'utile.
if ! reparer_depot; then
  exit 1
fi

t_debut=$(date +%s)
t_phase=$(ms)
# La sortie du collecteur part au journal (horodatée, ligne par ligne : c'est ce
# qui permet de dire quelle phase a pris le temps la prochaine fois) et N'EST PAS
# renvoyée sur la sortie standard — sinon le cron enverrait un message à B toutes
# les cinq minutes. Le code de sortie est celui de Node, pas celui de « tee ».
node collecteur.mjs --publier 2>&1 | horodater | tee -a "$JOURNAL" >/dev/null
CODE=${PIPESTATUS[0]}
journal "collecte : $(( $(ms) - t_phase )) ms (code $CODE)"

if [ "$CODE" -ne 0 ]; then
  alerte "⚠ Collecte Promos en ÉCHEC (code $CODE)"
  tail -5 "$JOURNAL" | sed 's/^/   /'
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
#
# L'ENTRETIEN DES VISUELS SE FAIT ICI, JUSTE AVANT LE git add — et surtout pas
# après. Le collecteur vient de rapatrier les visuels en TAILLE MARCHAND (1 200 à
# 2 500 px, 200 Ko à 2,5 Mo) ; commités tels quels, ils restent dans l'historique
# pour toujours (git ne rend jamais un blob : .git pesait 2 582 Mo le 13/10/2026
# pour un site de 853 Mo). Placé ici, le gros fichier n'entre jamais dans le
# dépôt. Il ne traite que les fichiers modifiés depuis 3 h, et se tait quand il
# n'a rien à faire — voir bin/entretenir-visuels.sh.
bin/entretenir-visuels.sh 2>&1 | horodater | tee -a "$JOURNAL" >/dev/null

# ON ENVOIE « docs » ET « public » — les deux, et pas seulement ce qui est publié.
# Défaut mesuré le 13/10/2026 : `public/relais.js` et `public/estimation.js`,
# écrits la veille, existaient sur le disque et dans `docs/` (copie publiée) mais
# JAMAIS dans le dépôt — parce que cette ligne n'ajoutait que `docs`. Le clone
# neuf de GitHub n'avait donc pas ces deux fichiers, trois épreuves échouaient
# (`inscription`, `relais-tuyaux`, « la racine de docs/ ne porte que des fichiers
# de public/ ») et, l'étape Tests passant AVANT la collecte dans le workflow, la
# collecte de secours ne s'est plus exécutée du tout : **15 exécutions horaires
# perdues, dont huit pendant la nuit**, sans que rien ne le dise.
# `docs/` est une COPIE de `public/` (cpSync dans collecteur.mjs) : les deux
# doivent voyager ensemble, sinon le dépôt redevient incohérent au fichier neuf
# suivant.
t_phase=$(ms)
git add -A docs public
if git diff --cached --quiet; then
  journal "git : rien de neuf — passage terminé en $(( $(date +%s) - t_debut )) s"
  exit 0                      # rien de neuf : silence total
fi
journal "git add -A docs public : $(( $(ms) - t_phase )) ms"

git commit -q -m "Collecte $(date -u +'%Y-%m-%d %H:%M UTC')" || true

# Synchronisation GitHub.
#
# Méthode, et pourquoi celle-là. La version précédente faisait
# « git pull --rebase » puis « git push ». Deux défauts, tous deux mesurés :
#
#   1. UN CONFLIT LAISSAIT LE DÉPÔT COINCÉ. Les commits à rejouer ne portent que
#      des fichiers GÉNÉRÉS (docs/offres.json, docs/img), recalculés à chaque
#      passage — il n'y a donc rien à arbitrer, et pourtant le rebasage
#      s'arrêtait, le passage suivant échouait pareil, et l'alerte repartait
#      toutes les 5 minutes pendant quatorze heures.
#   2. LE WORKFLOW GITHUB POUSSE AUSSI. Entre le moment où l'on lit l'origine et
#      celui où l'on écrit, la référence bouge : « cannot lock ref », envoi
#      refusé.
#
# D'où cette méthode : on se replace sur l'origine, on pose UN SEUL commit
# par-dessus, on pousse. Un commit posé sur la pointe de l'origine part toujours
# en avance rapide — il ne peut pas entrer en conflit. Et si la pointe a encore
# bougé, on recommence : c'est une course, elle se règle en réessayant.
for essai in 1 2 3; do
  $GIT fetch -q origin main >/dev/null 2>&1 || { sleep 3; continue; }
  $GIT reset --soft FETCH_HEAD >/dev/null 2>&1
  $GIT add -A docs public >/dev/null 2>&1
  $GIT commit -q -m "Collecte $(date -u +'%Y-%m-%d %H:%M UTC')" >/dev/null 2>&1 || true
  t_phase=$(ms)
  if $GIT push -q origin main >/dev/null 2>&1; then
    journal "git push : $(( $(ms) - t_phase )) ms (essai $essai) — passage terminé en $(( $(date +%s) - t_debut )) s"
    # Tout est passé : on efface le souvenir de l'alerte, pour que la prochaine
    # panne soit annoncée TOUT DE SUITE au lieu d'attendre 30 minutes.
    rm -f /tmp/promos-alerte.txt
    # Le journal reste borné : 1 000 lignes suffisent largement à couvrir les
    # derniers jours, et un journal qui grossit sans fin finit par coûter cher.
    if [ "$(wc -l < "$JOURNAL" 2>/dev/null || echo 0)" -gt 2000 ]; then
      tail -n 1000 "$JOURNAL" > "$JOURNAL.tmp" 2>/dev/null && mv "$JOURNAL.tmp" "$JOURNAL"
    fi
    exit 0
  fi
  journal "git push : échec (essai $essai)"
  sleep 4
done

alerte "⚠ Promos : envoi vers GitHub impossible — site local à jour, envoi en attente"
exit 0
