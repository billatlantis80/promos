#!/usr/bin/env python3
"""LE SUIVI DU TRANSFERT ET DU POIDS DES VISUELS — une ligne par passage.

POURQUOI IL EXISTE (B, 13/10/2026 : « continue à analyser en arrière-plan le
transfert d'image et son poids, à chaque mise à jour ou intervention du
système »).

Le site sait ce qu'il fait, mais il l'OUBLIE vite — deux bornes, mesurées :
  - `data/passages.json` ne garde que les ~97 derniers passages, soit 24 h ;
  - `data/passages.log` est borné à 1 000 lignes, et un passage en écrit 25 à
    30 : le journal couvre moins de 10 h.
Conséquence : on ne peut comparer ni semaine contre semaine, ni « avant/après »
une modification du code. La question de B — « reste-t-il une amélioration à
apporter à la programmation ? » — ne se répond pas sur 10 h de traces.

D'où ce fichier : il relit les deux sources, écrit UN ENREGISTREMENT PAR PASSAGE
dans `data/suivi-images.jsonl` (jamais réécrit, jamais purgé), et tient un
rapport relisible dans `data/rapport-images.md`.

ET UN AUDIT PAR INTERVENTION : chaque fois que la tête du dépôt change (donc à
chaque modification du code), l'audit complet est refait — poids par tranche,
cotes réelles relevées à l'en-tête des fichiers, ce qui reste au-dessus du
plafond, transparences, orphelines, taille de `.git`. C'est le « à chaque
intervention du système » de la demande.

SILENCIEUX QUAND TOUT VA BIEN : la sortie standard ne porte que des ANOMALIES,
et un résumé d'une ligne le lundi. Un rendez-vous qui parle pour ne rien dire
cesse d'être lu.

Usage :
    bin/suivi-images.py            # relève + rapport ; ne parle que s'il y a une anomalie
    bin/suivi-images.py --audit    # force l'audit complet
    bin/suivi-images.py --rapport  # affiche le rapport
    bin/suivi-images.py --json     # l'état calculé, pour un autre outil
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RACINE, "data")
JOURNAL = os.path.join(DATA, "passages.log")
PASSAGES = os.path.join(DATA, "passages.json")
PUBLIE = os.path.join(RACINE, "docs", "etat-collecte.json")
DOSSIER_VISUELS = os.path.join(RACINE, "docs", "img")
SUIVI = os.path.join(DATA, "suivi-images.jsonl")
MEMOIRE = os.path.join(DATA, "suivi-images-memoire.json")
RAPPORT = os.path.join(DATA, "rapport-images.md")

# --- Ce qui est un plafond, et pourquoi -------------------------------------
# PLAFOND_PX : la décision de B du 13/10/2026, celle de bin/entretenir-visuels.sh
#   (vues liste ×2 = 1 260 px, toutes les vues téléphone couvertes).
# SEUIL_ENTRETIEN_OCTETS : le seuil de la passe (60 Ko) — en dessous, réécrire ne
#   gagne rien.
# Pour les cotes, un fichier est « au-dessus » si SON PLUS GRAND CÔTÉ dépasse :
# c'est la règle de l'outil, pas une convention d'affichage.
PLAFOND_PX = 1000
SEUIL_ENTRETIEN_OCTETS = 60000
QUOTA_MO = 1024                     # le seuil d'hébergement GitHub Pages
SEUIL_ALERTE_QUOTA = 80             # % — au-delà, la marge se réduit
SEUIL_GIT_MO_24H = 300              # Mo de croissance de .git en 24 h
JOUR_DU_DIGEST = 0                  # le résumé d'une ligne, LE LUNDI (Python : lundi = 0)
                                    # — réglé d'abord sur 1, ce qui le faisait parler le
                                    # mardi : une date se lit dans la table, pas de mémoire.

RE_COLLECTE = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) collecte : (\d+) ms \(code (\d+)\)\s*$")
RE_JOURNAL = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (.*)$")
RE_HORLOGE = re.compile(r"^\d{2}:\d{2}:\d{2} (.*)$")

RE_POIDS = re.compile(r"poids publié : ([\d.]+) Mo sur ([\d.]+) Mo tolérés \(([\d.]+) %\)")
RE_ENTRETIEN = re.compile(
    r"visuels : (\d+) fichier\(s\) allégé\(s\), ([\d.]+) -> ([\d.]+) Mo "
    r"\(sur (\d+) arrivé\(s\) récent\(s\), plafond (\d+) px, "
    r"(\d+) redimensionné\(s\), (\d+) à transparence laissé\(s\)\)")
RE_ENTRETIEN_NOTE = re.compile(r"^entretien visuels : (.+)$")
RE_PUBLIES = re.compile(
    r"publié dans .* : (\d+) visuel\(s\) téléchargé\(s\), (\d+) indisponible\(s\), "
    r"(\d+) reporté\(s\) au passage suivant, (\d+) ancien")
RE_PUSH = re.compile(r"git push : (\d+) ms \(essai (\d+)\) — passage terminé en (\d+) s")
RE_RIEN = re.compile(r"git : rien de neuf — passage terminé en (\d+) s")
RE_TRAFIC = re.compile(
    r"trafic \((\d+) passage\(s\) compté\(s\)\) : (\d+) requête\(s\) vers (\d+) hôte\(s\) — ([\d.]+) Mo")
RE_PLAFOND7 = re.compile(
    r"Plafond 7 jours .* : (\d+) offre\(s\) sans service depuis plus de 7 jours — ([\d.]+) Mo d'images")


# ---------------------------------------------------------------------------
# Lecture des deux sources
# ---------------------------------------------------------------------------

def _neuf(cle_log: str | None, t_ms: int | None) -> dict:
    return {"cle_log": cle_log, "t": t_ms}


def lire_journal() -> dict[str, dict]:
    """Les passages tels que le JOURNAL les raconte, clef = horodatage UTC.

    Le journal entrelace deux écritures, et c'est ce qui rend la lecture
    délicate — donc la voici, écrite une fois pour toutes :

      - les lignes du COLLECTEUR et de l'ENTRETIEN ne portent qu'une heure
        (`11:16:02 ...`) : elles passent par `awk`, donc sans date ;
      - les lignes du SCRIPT portent une date complète
        (`2026-10-13 11:16:02 git add …`), y compris la ligne « collecte : … »
        qui CLÔT la sortie du collecteur.

    D'où la règle exacte, et elle a coûté une correction (13/10/2026, premier
    relevé : chaque passage portait l'entretien du PRÉCÉDENT) :

      - les lignes à heure seule qui précèdent une ligne « collecte » sont la
        sortie du collecteur DE CE passage → au nouveau passage ;
      - celles qui précèdent toute AUTRE ligne datée (git add, git push)
        suivent la « collecte » du passage en cours → à `courant`.

    Un reste en fin de fichier est un passage EN COURS (sa ligne « collecte »
    n'est pas encore écrite) : on le laisse, le prochain relevé le reprendra
    puisque le fichier est relu entier.
    """
    passages: dict[str, dict] = {}
    attente: list[str] = []
    courant: str | None = None
    try:
        with open(JOURNAL, encoding="utf-8", errors="replace") as f:
            lignes = f.read().splitlines()
    except OSError:
        return passages

    for ligne in lignes:
        m = RE_COLLECTE.match(ligne)
        if m:
            cle, duree, code = m.group(1), int(m.group(2)), int(m.group(3))
            p = passages.setdefault(cle, _neuf(cle, None))
            p["dureeMs"], p["code"] = duree, code
            for l in attente:                     # la sortie du collecteur DE CE passage
                _analyser_collecteur(p, l)
            attente.clear()
            courant = cle
            continue
        mj = RE_JOURNAL.match(ligne)
        if mj:
            if courant is not None:               # fin du passage précédent
                for l in attente:                 # entretien de CE passage-là
                    _analyser_sortie(passages[courant], l)
                _analyser_script(passages[courant], mj.group(2))
            attente.clear()
            continue
        if RE_HORLOGE.match(ligne):
            attente.append(ligne)
    return passages


def _analyser_collecteur(p: dict, ligne: str) -> None:
    m = RE_HORLOGE.match(ligne)
    if not m:
        return
    t = m.group(1)
    if m2 := RE_POIDS.search(t):
        p["poidsPublieMo"] = float(m2.group(1))
        p["quotaMo"] = float(m2.group(2))
        p["partPct"] = float(m2.group(3))
    elif m2 := RE_PUBLIES.search(t):
        p["publies"] = {"pris": int(m2.group(1)), "indisponibles": int(m2.group(2)),
                        "reportes": int(m2.group(3)), "retires": int(m2.group(4))}
    elif m2 := RE_TRAFIC.search(t):
        p["trafic24h"] = {"passages": int(m2.group(1)), "requetes": int(m2.group(2)),
                          "hotes": int(m2.group(3)), "mo": float(m2.group(4))}
    elif m2 := RE_PLAFOND7.search(t):
        p["plafond7j"] = {"offres": int(m2.group(1)), "moImages": float(m2.group(2))}
    elif m2 := RE_ENTRETIEN.search(t):
        avant, apres = float(m2.group(2)), float(m2.group(3))
        p["entretien"] = {"fichiers": int(m2.group(1)), "avantMo": avant, "apresMo": apres,
                          "arrives": int(m2.group(4)), "plafondPx": int(m2.group(5)),
                          "redimensionnes": int(m2.group(6)), "transparence": int(m2.group(7)),
                          "gainPct": round(100 * (avant - apres) / avant, 1) if avant else None}


def _analyser_sortie(p: dict, ligne: str) -> None:
    """Une ligne de l'ENTRETIEN, à heure seule (elle passe par `awk`) : elle
    suit la ligne « collecte » du passage qu'elle vient de servir."""
    m = RE_HORLOGE.match(ligne)
    if not m:
        return
    t = m.group(1)
    if m2 := RE_ENTRETIEN.search(t):
        avant, apres = float(m2.group(2)), float(m2.group(3))
        p["entretien"] = {"fichiers": int(m2.group(1)), "avantMo": avant, "apresMo": apres,
                          "arrives": int(m2.group(4)), "plafondPx": int(m2.group(5)),
                          "redimensionnes": int(m2.group(6)), "transparence": int(m2.group(7)),
                          "gainPct": round(100 * (avant - apres) / avant, 1) if avant else None}
    elif m2 := RE_ENTRETIEN_NOTE.match(t):
        p["entretienNote"] = m2.group(1).strip()


def _analyser_script(p: dict, ligne: str) -> None:
    """Une ligne DATÉE du script de collecte : la synchronisation git."""
    corps = ligne.strip()
    if m := RE_PUSH.match(corps):
        p["git"] = {"ms": int(m.group(1)), "essai": int(m.group(2)), "termineEnS": int(m.group(3))}
    elif m := RE_RIEN.match(corps):
        p["git"] = {"rienDeNeuf": True, "termineEnS": int(m.group(1))}


def lire_passages_json() -> list[dict]:
    try:
        with open(PASSAGES, encoding="utf-8") as f:
            return json.load(f).get("passages", [])
    except (OSError, ValueError):
        return []


def mesurer_tailles() -> dict:
    """Les trois poids du dépôt, mesurés (jamais estimés).

    TROIS appels à `du`, et pas un seul avec trois chemins : `du docs docs/img`
    n'affiche PAS `docs/img` — il est déjà compté dans `docs`. Vérifié le
    13/10/2026 : la mesure du dossier des visuels revenait vide, et un zéro
    silencieux dans un suivi de poids est la pire des valeurs.
    """
    out: dict = {}
    for chemin in ("docs", "docs/img", ".git"):
        try:
            r = subprocess.run(["du", "-sm", chemin], cwd=RACINE,
                               capture_output=True, text=True, timeout=180)
            morceaux = r.stdout.strip().split("\t", 1)
            if len(morceaux) == 2:
                out[morceaux[1].strip()] = int(morceaux[0])
        except (OSError, subprocess.SubprocessError, ValueError):
            continue
    try:
        out["imgNb"] = len([n for n in os.listdir(DOSSIER_VISUELS)
                            if os.path.isfile(os.path.join(DOSSIER_VISUELS, n))])
    except OSError:
        pass
    return out


def tete_depot() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=RACINE,
                              capture_output=True, text=True, timeout=60).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def empreinte_code() -> str:
    """L'empreinte du CODE — son CONTENU, pas la tête du dépôt.

    Deux raisons, toutes deux mesurées le 13/10/2026 :

      - le collecteur commite toutes les 15 minutes, donc `HEAD` change sans
        arrêt : un audit branché sur `HEAD` rescanne 20 000 fichiers pour rien ;
      - et une empreinte lue DANS le dépôt (`git rev-parse HEAD:bin`) ne voit
        pas une modification **non commitée**. Vérifié : deux corrections
        successives de ce fichier ont laissé la même empreinte, donc l'audit ne
        se refaisait pas après une intervention — précisément le moment pour
        lequel il existe.

    On hache donc les OCTETS des fichiers qui portent la programmation. Cent
    fichiers, deux mégaoctets, quelques millisecondes.
    """
    h = hashlib.sha1()
    for racine in ("bin", "outils", "tests"):
        dossier = os.path.join(RACINE, racine)
        if not os.path.isdir(dossier):
            continue
        for nom in sorted(os.listdir(dossier)):
            chemin = os.path.join(dossier, nom)
            if not os.path.isfile(chemin):
                continue
            h.update(nom.encode())
            try:
                with open(chemin, "rb") as f:
                    h.update(f.read())
            except OSError:
                continue
    for nom in ("collecteur.mjs", "package.json"):
        try:
            with open(os.path.join(RACINE, nom), "rb") as f:
                h.update(nom.encode())
                h.update(f.read())
        except OSError:
            continue
    return h.hexdigest()[:12]


# ---------------------------------------------------------------------------
# L'audit : ce qui est EN STOCK, mesuré fichier par fichier
# ---------------------------------------------------------------------------

def auditer() -> dict:
    """L'état du stock publié. Deux mesures, deux coûts :

      - le POIDS se lit sur `stat()` : instantané, sur les 20 000 fichiers ;
      - la COTE (pixels) exige d'ouvrir l'en-tête de chaque fichier. `Image.open`
        ne décode pas, il lit les dimensions : quelques secondes, pas minutes.
        Sans Pillow, on le DIT et on ne rend que le poids — jamais une cote
        devinée.

    Le gain potentiel n'est JAMAIS annoncé : une estimation fondée sur un
    échantillon du haut du classement a déjà menti de 200 Mo le 12/10/2026.
    On donne le poids MESURÉ des groupes, rien de plus.
    """
    a: dict = {"le": maintenant_iso()}
    try:
        noms = os.listdir(DOSSIER_VISUELS)
    except OSError:
        a["erreur"] = "dossier des visuels illisible"
        return a

    tranches = {"moins60ko": [0, 0.0], "de60a200ko": [0, 0.0], "de200a500ko": [0, 0.0],
                "de500koa1mo": [0, 0.0], "plus1mo": [0, 0.0]}
    total_nb, total_octets = 0, 0
    for nom in noms:
        chemin = os.path.join(DOSSIER_VISUELS, nom)
        try:
            if not os.path.isfile(chemin):
                continue
            o = os.stat(chemin).st_size
        except OSError:
            continue
        total_nb += 1
        total_octets += o
        if o < SEUIL_ENTRETIEN_OCTETS:
            cle = "moins60ko"
        elif o < 200000:
            cle = "de60a200ko"
        elif o < 500000:
            cle = "de200a500ko"
        elif o < 1000000:
            cle = "de500koa1mo"
        else:
            cle = "plus1mo"
        tranches[cle][0] += 1
        tranches[cle][1] += o

    a["poids"] = {"fichiers": total_nb, "mo": round(total_octets / 1e6, 1),
                  "tranches": {k: {"nb": v[0], "mo": round(v[1] / 1e6, 1)} for k, v in tranches.items()},
                  "moyenneKo": round(total_octets / max(total_nb, 1) / 1000, 1)}

    try:
        from PIL import Image                                    # noqa: PLC0415
    except ImportError:
        a["cotes"] = None
        a["cotesNote"] = "Pillow absent de cet interpréteur — cotes NON mesurées"
        return a

    import warnings
    warnings.simplefilter("ignore")
    cotes = {"jusqua1000": [0, 0.0], "de1001a1200": [0, 0.0], "de1201a1600": [0, 0.0],
             "plus1600": [0, 0.0]}
    au_dessus = {"nb": 0, "mo": 0.0, "lourdsNb": 0, "lourdsMo": 0.0, "legersNb": 0, "legersMo": 0.0}
    transparentes = {"nb": 0, "mo": 0.0}
    illisibles = 0
    faux = {"nb": 0, "mo": 0.0, "exemples": []}      # ce qui n'est PAS une image
    # TOUS les fichiers sont ouverts, y compris les légers : le gisement de la
    # passe 2 est justement fait de fichiers LÉGERS mais GRANDS en pixels
    # (2 292 fichiers, 301,8 Mo mesurés le 12/10/2026) — un audit qui ne
    # regarderait que les lourds déclarerait ce gisement inexistant. Coût
    # mesuré : 0,27 ms par fichier, soit 5,4 s pour les 19 761.
    for nom in noms:
        chemin = os.path.join(DOSSIER_VISUELS, nom)
        try:
            o = os.path.getsize(chemin)
        except OSError:
            continue
        try:
            with Image.open(chemin) as im:
                cote = max(im.size)
                mode = im.mode
                transparent = mode in ("RGBA", "LA") or (
                    mode == "P" and "transparency" in im.info)
        except Exception:
            # UNE IMAGE QUI N'EN EST PAS UNE. Trouvé le 13/10/2026 : neuf
            # fichiers `.jpg` de 500 à 780 octets sont en réalité des SVG de
            # remplacement (le marchand répond « pas de visuel » avec une
            # vignette générique en SVG). Le catalogue publié les référence :
            # ces fiches montrent donc une vignette grise, pas un produit.
            # On les compte SOUS LEUR VRAI NOM, et on ne les range PAS dans
            # « illisibles » — un mot qui ne dit pas quoi faire.
            try:
                entete = open(chemin, "rb").read(160).lstrip()
            except OSError:
                illisibles += 1
                continue
            if entete[:4] == b"<svg" or entete[:5] == b"<?xml" or entete[:5] == b"<!DOC":
                faux["nb"] += 1
                faux["mo"] += o
                if len(faux["exemples"]) < 5:
                    faux["exemples"].append({"nom": nom, "octets": o,
                                             "tete": entete[:20].decode("utf-8", "replace")})
            else:
                illisibles += 1
            continue
        if cote <= 1000:
            cle = "jusqua1000"
        elif cote <= 1200:
            cle = "de1001a1200"
        elif cote <= 1600:
            cle = "de1201a1600"
        else:
            cle = "plus1600"
        cotes[cle][0] += 1
        cotes[cle][1] += o
        if cote > PLAFOND_PX:
            au_dessus["nb"] += 1
            au_dessus["mo"] += o
            if o >= SEUIL_ENTRETIEN_OCTETS:
                au_dessus["lourdsNb"] += 1
                au_dessus["lourdsMo"] += o
            else:
                au_dessus["legersNb"] += 1
                au_dessus["legersMo"] += o
            if transparent:
                transparentes["nb"] += 1
                transparentes["mo"] += o

    a["cotes"] = {k: {"nb": v[0], "mo": round(v[1] / 1e6, 1)} for k, v in cotes.items()}
    a["auDessusDuPlafond"] = {
        "nb": au_dessus["nb"], "mo": round(au_dessus["mo"] / 1e6, 1),
        "lourdsNb": au_dessus["lourdsNb"], "lourdsMo": round(au_dessus["lourdsMo"] / 1e6, 1),
        "legersNb": au_dessus["legersNb"], "legersMo": round(au_dessus["legersMo"] / 1e6, 1),
        "transparentesNb": transparentes["nb"], "transparentesMo": round(transparentes["mo"] / 1e6, 1),
    }
    a["illisibles"] = illisibles
    a["nonImages"] = {"nb": faux["nb"], "mo": round(faux["mo"] / 1e6, 3),
                      "exemples": faux["exemples"]}
    a["plafondPx"] = PLAFOND_PX
    return a


# ---------------------------------------------------------------------------
# Relevé : un enregistrement par passage, jamais deux fois
# ---------------------------------------------------------------------------

def maintenant_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_de_ms(t_ms: int | None) -> str | None:
    if not t_ms:
        return None
    return datetime.datetime.fromtimestamp(t_ms / 1000, datetime.timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ")


def deja_vus() -> set[str]:
    cles: set[str] = set()
    try:
        with open(SUIVI, encoding="utf-8") as f:
            for ligne in f:
                try:
                    cles.add(json.loads(ligne)["cle"])
                except (ValueError, KeyError):
                    continue
    except OSError:
        pass
    return cles


def relever() -> tuple[int, list[str]]:
    """Écrit les passages neufs. Rend (nombre écrit, anomalies).

    Aucun passage n'est jamais réécrit : la clef est l'horodatage du passage, et
    il est déjà dans le fichier ou il ne l'est pas. Un doublon fausserait tous
    les totaux — c'est la seule faute que ce fichier ne peut pas se permettre.
    """
    journal = lire_journal()
    passages_json = lire_passages_json()
    tailles = mesurer_tailles()
    tete = tete_depot()
    vus = deja_vus()

    # Indexation du journal par instant, pour joindre les deux sources. La
    # tolérance est de 120 s : les passages sont espacés de 15 min, il n'y a
    # donc aucune ambiguïté possible.
    index_journal: list[tuple[float, str]] = []
    for cle in journal:
        try:
            dt = datetime.datetime.strptime(cle, "%Y-%m-%d %H:%M:%S").replace(
                tzinfo=datetime.timezone.utc)
            index_journal.append((dt.timestamp(), cle))
        except ValueError:
            continue

    def journal_pour(t_ms: float) -> dict | None:
        meilleur, ecart = None, 121.0
        for ts, cle in index_journal:
            d = abs(ts - t_ms)
            if d < ecart:
                meilleur, ecart = journal[cle], d
        return meilleur

    neufs: list[dict] = []
    for pj in passages_json:
        t = pj.get("t")
        if not t:
            continue
        iso = iso_de_ms(int(t))
        cle_iso = "pj:" + str(iso)
        jl = journal_pour(t / 1000)
        cle = "j:" + jl["cle_log"] if jl and jl.get("cle_log") else cle_iso
        if cle in vus:
            continue
        enr = {
            "type": "passage",
            "cle": cle,
            "iso": iso,
            "t": int(t),
            "dureeMs": pj.get("ms"),
            "requetes": pj.get("requetes"),
            "octets": pj.get("octets"),
            "visuels": pj.get("visuels"),
            "sources": pj.get("sources"),
            "retenues": pj.get("retenues"),
            "publiees": pj.get("publiees"),
            "publiee": pj.get("publie"),
            "mesure": {"le": maintenant_iso(), "docsMo": tailles.get("docs"),
                       "imgMo": tailles.get("docs/img"), "imgNb": tailles.get("imgNb"),
                       "gitMo": tailles.get(".git"), "tete": tete},
        }
        if jl:
            for champ in ("code", "poidsPublieMo", "quotaMo", "partPct", "publies",
                          "trafic24h", "plafond7j"):
                if jl.get(champ) is not None:
                    enr[champ] = jl[champ]
            enr["entretien"] = jl.get("entretien")
            enr["entretienNote"] = jl.get("entretienNote")
            enr["git"] = jl.get("git")
            if jl.get("dureeMs") and not enr.get("dureeMs"):
                enr["dureeMs"] = jl["dureeMs"]
        enr["anomalies"] = anomalies_du_passage(enr)
        neufs.append(enr)

    if neufs:
        neufs.sort(key=lambda e: e["t"])
        with open(SUIVI, "a", encoding="utf-8") as f:
            for enr in neufs:
                f.write(json.dumps(enr, ensure_ascii=False) + "\n")

    # LES ALERTES NE PARLENT QUE DU PRÉSENT. Le premier relevé reprend jusqu'à
    # 24 h d'historique : sans ce filtre, soixante passages DÉJÀ passés auraient
    # déclenché « poids à 81 % » et noyé la seule information qui compte. Le
    # constat reste écrit DANS l'enregistrement (le rapport le montre) ; il ne
    # remonte à l'écran que si le passage a moins d'une heure ET qu'il vient du
    # journal (donc qu'il est bien terminé, entretien compris).
    recent_ms = (datetime.datetime.now(datetime.timezone.utc).timestamp() - 3600) * 1000
    anomalies = [a for enr in neufs
                 if str(enr.get("cle", "")).startswith("j:") and (enr.get("t") or 0) >= recent_ms
                 for a in enr["anomalies"]]
    return len(neufs), anomalies


def anomalies_du_passage(enr: dict) -> list[str]:
    """Les défauts visibles SUR CE PASSAGE — courts, mesurés, sans jugement."""
    out: list[str] = []
    if enr.get("code") not in (None, 0):
        out.append("collecte en échec (code %s)" % enr["code"])
    note = enr.get("entretienNote") or ""
    if note:
        out.append("entretien : %s" % note)
    if (enr.get("partPct") or 0) >= SEUIL_ALERTE_QUOTA:
        out.append("poids publié à %.1f %% du seuil d'hébergement (%.1f Mo sur %s Mo)"
                   % (enr["partPct"], enr.get("poidsPublieMo") or 0, enr.get("quotaMo") or QUOTA_MO))
    return out


def relever_audit(forcer: bool) -> tuple[dict | None, list[str]]:
    """L'audit complet — à chaque changement de CODE, ou sur demande.

    La décision se prend sur l'EMPREINTE DU CODE, jamais sur `HEAD` : le
    collecteur commite toutes les 15 minutes, donc `HEAD` bouge sans arrêt et
    l'audit rescannerait 20 000 fichiers pour rien. Et il tourne aussi au moins
    une fois par 24 h, même sans changement de code : c'est ce qui donne la
    « dérive » (le stock qui grossit tout seul).
    """
    memoire = lire_memoire()
    empreinte = empreinte_code()
    tete = tete_depot()
    dernier = memoire.get("audit", {})
    if not forcer and empreinte and dernier.get("empreinteCode") == empreinte:
        age = age_heures(dernier.get("le"))
        if age is not None and age < 24:
            return None, []
    a = auditer()
    a["type"] = "audit"
    a["cle"] = "audit:" + a["le"]
    a["tete"] = tete
    a["empreinteCode"] = empreinte
    a["tailles"] = mesurer_tailles()
    with open(SUIVI, "a", encoding="utf-8") as f:
        f.write(json.dumps(a, ensure_ascii=False) + "\n")

    anomalies: list[str] = []
    if a.get("cotes") is None:
        # Le même piège que dans l'entretien : une mesure qui disparaît en
        # silence. Sans Pillow, l'audit ne connaît plus les cotes et ne peut
        # plus dire si le plafond tient — il faut le DIRE.
        anomalies.append("cotes NON mesurées : %s" % a.get("cotesNote"))
    ni = a.get("nonImages") or {}
    if ni.get("nb"):
        modeles = ", ".join(e["nom"] for e in (ni.get("exemples") or [])[:3])
        anomalies.append(
            "%d visuel(s) publié(s) ne sont PAS des images (SVG de remplacement sous une "
            "extension .jpg — vignette grise sur la fiche ; ex. %s)" % (ni["nb"], modeles))
    precedent = dernier
    # ⚠ PAS DE TAUX SUR UNE FENÊTRE COURTE. Vécu le 13/10/2026 : deux audits à
    # trente minutes d'intervalle, 13 Mo gagnés → « 632 Mo/jour ». Le chiffre
    # n'était pas faux, mais une extrapolation sur 30 minutes transforme un
    # commit un peu gros en catastrophe. Sous trois heures, on donne le FAIT
    # (les Mo gagnés), jamais un rythme.
    heures = age_heures(precedent.get("le")) or 0
    if heures >= 3:
        if precedent.get("poids") and a.get("poids"):
            jour = (a["poids"]["mo"] - precedent["poids"]["mo"]) * 24 / heures
            if jour > 50:
                anomalies.append(
                    "le stock d'images grossit de %.0f Mo/jour (%.1f → %.1f Mo, audit précédent il y a %.1f h)"
                    % (jour, precedent["poids"]["mo"], a["poids"]["mo"], heures))
        if precedent.get("tailles") and a.get("tailles") and precedent["tailles"].get(".git"):
            croissance = (a["tailles"][".git"] - precedent["tailles"][".git"]) * 24 / heures
            if croissance > SEUIL_GIT_MO_24H:
                # PAS D'ATTRIBUTION GRATUITE : on ne dit pas POURQUOI il grossit,
                # on dit qu'il grossit — le dépôt garde tout, y compris le
                # catalogue réécrit à chaque passage.
                anomalies.append(
                    "`.git` grossit de %.0f Mo/jour (%d → %d Mo) — l'historique du dépôt, "
                    "le seul poste qu'aucune passe ne réduit"
                    % (croissance, precedent["tailles"][".git"], a["tailles"][".git"]))
    elif precedent.get("tailles") and a.get("tailles") and precedent["tailles"].get(".git"):
        gain = a["tailles"][".git"] - precedent["tailles"][".git"]
        if gain >= 20:
            anomalies.append(
                "`.git` a grossi de %d Mo en %.1f h (%d → %d Mo) — l'historique du dépôt, "
                "le seul poste qu'aucune passe ne réduit"
                % (gain, heures, precedent["tailles"][".git"], a["tailles"][".git"]))
    memoire["audit"] = {k: v for k, v in a.items() if k != "type"}
    sauver_memoire(memoire)
    return a, anomalies


# ---------------------------------------------------------------------------
# Mémoire (pour ne pas radoter) et lecture du suivi
# ---------------------------------------------------------------------------

def lire_memoire() -> dict:
    try:
        with open(MEMOIRE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def sauver_memoire(m: dict) -> None:
    try:
        with open(MEMOIRE, "w", encoding="utf-8") as f:
            json.dump(m, f, ensure_ascii=False, indent=1)
    except OSError:
        pass


def age_heures(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        dt = datetime.datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=datetime.timezone.utc)
    except ValueError:
        return None
    return (datetime.datetime.now(datetime.timezone.utc) - dt).total_seconds() / 3600


def pas_trop_recent(iso: str | None, maintenant: datetime.datetime, secondes: float) -> bool:
    """Vrai si l'horodatage est ABSENT ou plus vieux que `secondes`.

    Un horodatage illisible compte pour « rien de récent » : mieux vaut un
    message de trop qu'un vrai défaut tu par une mémoire abîmée."""
    if not iso:
        return True
    try:
        dt = datetime.datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=datetime.timezone.utc)
    except ValueError:
        return True
    return (maintenant - dt).total_seconds() >= secondes


def lire_suivi() -> list[dict]:
    out = []
    try:
        with open(SUIVI, encoding="utf-8") as f:
            for ligne in f:
                try:
                    out.append(json.loads(ligne))
                except ValueError:
                    continue
    except OSError:
        pass
    return out


def jour_belge(iso: str | None) -> str:
    """La journée SE LIT en heure belge : c'est là que B regarde son site."""
    if not iso:
        return "?"
    try:
        dt = datetime.datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=datetime.timezone.utc)
    except ValueError:
        return "?"
    try:
        from zoneinfo import ZoneInfo                          # noqa: PLC0415
        return dt.astimezone(ZoneInfo("Europe/Brussels")).strftime("%Y-%m-%d")
    except Exception:
        return (dt + datetime.timedelta(hours=2)).strftime("%Y-%m-%d")


def jour_belge_ms(t_ms: int | None) -> str:
    return jour_belge(iso_de_ms(t_ms))


# ---------------------------------------------------------------------------
# Le rapport — relisible dans six semaines
# ---------------------------------------------------------------------------

def construire_rapport() -> str:
    enr = lire_suivi()
    passages = [e for e in enr if e.get("type") == "passage"]
    audits = [e for e in enr if e.get("type") == "audit"]
    if not passages and not audits:
        return "# Suivi des visuels\n\n_aucun relevé pour l'instant_\n"

    lignes: list[str] = []
    premier = min((e.get("iso") or "" for e in passages), default="?")
    lignes.append("# Transfert et poids des visuels — suivi continu")
    lignes.append("")
    lignes.append("_Rapport engendré le %s · %d passage(s) enregistré(s) depuis le %s._"
                  % (maintenant_iso(), len(passages), premier))
    lignes.append("")
    lignes.append("**Pourquoi ce fichier existe.** Le site ne garde que 24 h de passages "
                  "(`data/passages.json`) et moins de 10 h de journal (`data/passages.log`). "
                  "Ce suivi écrit une ligne par passage, sans jamais purger : c'est la seule "
                  "trace qui permettra de dire, dans six semaines, si la programmation "
                  "demande encore une amélioration.")
    lignes.append("")

    # --- 1. par jour --------------------------------------------------------
    jours: dict[str, dict] = {}
    for e in sorted(passages, key=lambda x: x.get("t") or 0):
        j = jours.setdefault(jour_belge(e.get("iso")), {
            "passages": 0, "pris": 0, "rates": 0, "differes": 0, "octets": 0,
            "entretienFichiers": 0, "entretienAvant": 0.0, "entretienApres": 0.0,
            "entretienArrives": 0, "entretienTransparence": 0, "entretienAbsent": 0,
            "poidsMo": None, "partPct": None, "gitMo": None, "imgNb": None})
        j["passages"] += 1
        v = e.get("visuels") or {}
        j["pris"] += v.get("pris") or 0
        j["rates"] += v.get("rates") or 0
        j["differes"] += v.get("differes") or 0
        j["octets"] += e.get("octets") or 0
        en = e.get("entretien")
        if en:
            j["entretienFichiers"] += en.get("fichiers") or 0
            j["entretienAvant"] += en.get("avantMo") or 0
            j["entretienApres"] += en.get("apresMo") or 0
            j["entretienArrives"] += en.get("arrives") or 0
            j["entretienTransparence"] += en.get("transparence") or 0
        elif (v.get("pris") or 0) >= 3:
            j["entretienAbsent"] += 1
        if e.get("partPct") is not None:
            j["poidsMo"], j["partPct"] = e.get("poidsPublieMo"), e.get("partPct")
        m = e.get("mesure") or {}
        # LES TAILLES MESURÉES NE VALENT QUE POUR LE VIF. Le premier relevé a
        # repris 24 h d'historique : ces passages-là portent la taille d'AUJOURD'HUI
        # (c'est le seul instant où elle a été mesurée). Les afficher dans la
        # colonne d'un jour passé ferait croire à une taille d'hier — on ne
        # garde donc la mesure que pour les passages vus en direct par ce suivi.
        if m.get("gitMo") and str(e.get("cle", "")).startswith("j:"):
            j["gitMo"] = m["gitMo"]
            j["imgNb"] = m.get("imgNb")

    lignes.append("## 1. Le transfert, jour par jour (heure belge)")
    lignes.append("")
    lignes.append("| jour | passages | visuels rapatriés | dont ratés | Mo entrés (tout) | "
                  "visuels allégés | avant → après | gain | poids publié | part du seuil | `.git` |")
    lignes.append("|---|---|---|---|---|---|---|---|---|---|---|")
    for j in sorted(jours):
        d = jours[j]
        gain = "—"
        if d["entretienAvant"]:
            gain = "%.0f %%" % (100 * (d["entretienAvant"] - d["entretienApres"]) / d["entretienAvant"])
        lignes.append("| %s | %d | %d | %d | %.0f Mo | %d | %.1f → %.1f Mo | %s | %s | %s | %s |"
                      % (j, d["passages"], d["pris"], d["rates"], d["octets"] / 1e6,
                         d["entretienFichiers"], d["entretienAvant"], d["entretienApres"], gain,
                         ("%.1f Mo" % d["poidsMo"]) if d["poidsMo"] else "—",
                         ("%.0f %%" % d["partPct"]) if d["partPct"] else "—",
                         ("%d Mo" % d["gitMo"]) if d["gitMo"] else "—"))
    lignes.append("")

    # --- 2. ce que le taux de transfert vaut, ramené au passage -------------
    total_pris = sum((e.get("visuels") or {}).get("pris") or 0 for e in passages)
    total_octets = sum(e.get("octets") or 0 for e in passages)
    nb_avec_image = sum(1 for e in passages if ((e.get("visuels") or {}).get("pris") or 0) > 0)
    nb_publi = sum(1 for e in passages if e.get("git") and not e.get("git", {}).get("rienDeNeuf"))
    nb_verdict = sum(1 for e in passages if e.get("git"))
    lignes.append("## 2. Ce que « une mise à jour » a réellement transféré")
    lignes.append("")
    lignes.append("- **%d** visuels rapatriés sur **%d** passages enregistrés "
                  "(**%d** passage(s) n'ont rien rapatrié ; sur les **%d** dont le journal "
                  "porte le verdict, **%d** ont abouti à un envoi vers GitHub)."
                  % (total_pris, len(passages), len(passages) - nb_avec_image,
                     nb_verdict, nb_publi))
    if passages:
        lignes.append("- Moyenne : **%.1f visuel(s)** et **%.1f Mo** entrés par passage "
                      "(tout contenu confondu : flux, pages, verdicts, visuels)."
                      % (total_pris / len(passages), total_octets / len(passages) / 1e6))
    if total_pris:
        lignes.append("- Un passage qui rapatrie : **%.1f Mo** en moyenne."
                      % (total_octets / max(nb_avec_image, 1) / 1e6))
    lignes.append("- Le stock, lui, n'est JAMAIS retéléchargé : le nom du fichier est "
                  "l'empreinte de son adresse d'origine, et le collecteur saute ce qui existe. "
                  "C'est ce qui borne le transfert à l'arrivage.")
    lignes.append("")

    # --- 3. l'audit : ce qui est en stock ----------------------------------
    lignes.append("## 3. Ce qui est en stock (audit)")
    lignes.append("")
    if not audits:
        lignes.append("_aucun audit complet pour l'instant._")
    else:
        a = audits[-1]
        p = a.get("poids") or {}
        lignes.append("Audit du **%s** (tête du dépôt `%s`, empreinte du code `%s`) : "
                      "**%d visuels, %.1f Mo**, moyenne %.1f Ko."
                      % (a.get("le"), a.get("tete"), a.get("empreinteCode"),
                         p.get("fichiers", 0), p.get("mo", 0), p.get("moyenneKo", 0)))
        lignes.append("")
        lignes.append("| tranche de poids | fichiers | Mo |")
        lignes.append("|---|---|---|")
        noms = {"moins60ko": "< 60 Ko", "de60a200ko": "60 → 200 Ko", "de200a500ko": "200 → 500 Ko",
                "de500koa1mo": "500 Ko → 1 Mo", "plus1mo": "> 1 Mo"}
        for k, libelle in noms.items():
            t = (p.get("tranches") or {}).get(k)
            if t:
                lignes.append("| %s | %s | %.1f |" % (libelle, t["nb"], t["mo"]))
        lignes.append("")
        if a.get("cotes"):
            lignes.append("| plus grand côté | fichiers | Mo |")
            lignes.append("|---|---|---|")
            noms_c = {"jusqua1000": "≤ 1000 px", "de1001a1200": "1001 → 1200 px",
                      "de1201a1600": "1201 → 1600 px", "plus1600": "> 1600 px"}
            for k, libelle in noms_c.items():
                t = a["cotes"].get(k)
                if t:
                    lignes.append("| %s | %s | %.1f |" % (libelle, t["nb"], t["mo"]))
            lignes.append("")
        else:
            lignes.append("_cotes non mesurées : %s_" % a.get("cotesNote"))
        ni = a.get("nonImages") or {}
        if ni.get("nb"):
            taille = ("%.1f Ko" % (ni.get("mo", 0) * 1000) if (ni.get("mo") or 0) < 0.1
                      else "%.1f Mo" % ni.get("mo", 0))
            lignes.append("**%d fichier(s) ne sont PAS des images** (%s au total) : ce sont des "
                          "SVG de remplacement que le marchand renvoie quand il n'a pas de visuel "
                          "— le collecteur les a enregistrés sous l'extension `.jpg`. Le catalogue "
                          "publié les référence : ces fiches montrent une vignette grise."
                          % (ni["nb"], taille))
            for e in ni.get("exemples") or []:
                lignes.append("  - `%s` — %d o — `%s…`" % (e["nom"], e["octets"], e["tete"]))
        if a.get("illisibles"):
            lignes.append("_%d fichier(s) illisible(s) en plus des précédents : à regarder._"
                          % a["illisibles"])
        lignes.append("")
        t = a.get("tailles") or {}
        if t.get("docs") and a.get("poids"):
            lignes.append("_Deux poids, deux mesures — et il ne faut pas les confondre : le "
                          "« poids publié » du tableau 1 est celui que le collecteur calcule "
                          "(%d Mo au dernier passage), le `du` de ce tableau pèse TOUT le "
                          "dossier publié sur le disque (%d Mo). L'écart, c'est ce que le "
                          "collecteur ne compte pas._"
                          % (passages[-1].get("poidsPublieMo") or 0, t["docs"]))
            lignes.append("")

    # --- 4. ce qui reste ouvert --------------------------------------------
    lignes.append("## 4. Ce qui reste à améliorer — le gisement, mesuré")
    lignes.append("")
    if audits:
        a = audits[-1]
        ad = a.get("auDessusDuPlafond") or {}
        if ad:
            lignes.append("- **Au-dessus du plafond de %d px : %d fichier(s), %.1f Mo** — "
                          "dont %d lourd(s) (%.1f Mo, réécrits par la passe quand ils arrivent) "
                          "et %d léger(s) sous 60 Ko (%.1f Mo, que la passe IGNORE par son seuil)."
                          % (PLAFOND_PX, ad.get("nb", 0), ad.get("mo", 0),
                             ad.get("lourdsNb", 0), ad.get("lourdsMo", 0),
                             ad.get("legersNb", 0), ad.get("legersMo", 0)))
            if ad.get("transparentesNb"):
                lignes.append("- **%d transparent(s) au-dessus du plafond (%.1f Mo)** : la passe les "
                              "laisse exprès (une recompression à plat abîmerait le détourage). "
                              "C'est un gisement à traiter à part, pas un oubli."
                              % (ad["transparentesNb"], ad["transparentesMo"]))
            pd = (a.get("poids") or {}).get("tranches") or {}
            lourds = sum((pd.get(k) or {}).get("nb", 0) for k in ("de200a500ko", "de500koa1mo", "plus1mo"))
            if lourds:
                lignes.append("- **%d visuel(s) au-dessus de 200 Ko** : 200 Ko est le repère qui "
                              "décide d'une réécriture ; ceux-là sont arrivés avant la passe ou "
                              "sont des transparents." % lourds)
        t = a.get("tailles") or {}
        if t.get(".git") and t.get("docs"):
            lignes.append("- **`.git` = %d Mo pour un site de %d Mo** : l'historique pèse plus lourd "
                          "que le site. Les blobs entrés avant le 13/10/2026 y sont pour toujours — "
                          "c'est le seul poste qu'aucune passe ne réduit."
                          % (t[".git"], t["docs"]))
    lignes.append("- **La règle de sept jours** reste en MESURE (interrupteurs éteints) : "
                  "voir l'onglet « Exploitation » du panneau, qui en donne le compte chaque passage.")
    lignes.append("")

    # --- 5. ce qui a été signalé -------------------------------------------
    # GROUPÉ, pas répété : le 13/10/2026, vingt passages d'affilée portaient le
    # même « poids à 81 % » — vingt lignes identiques dans un rapport, c'est un
    # rapport qu'on cesse de lire.
    avec = [e for e in passages if e.get("anomalies")]
    compte: dict[str, dict] = {}
    for e in avec:
        for texte in e["anomalies"]:
            # On regroupe sur le TEXTE SANS LES CHIFFRES : « poids à 83 % (847,5 Mo) »
            # et « poids à 83 % (847,2 Mo) » sont le MÊME signalement, et vingt
            # lignes identiques à un cheveu près, c'est un rapport qu'on ne lit pas.
            cle_norm = re.sub(r"\d+([.,]\d+)?", "#", texte)
            c = compte.setdefault(cle_norm, {"nb": 0, "premier": e.get("iso"),
                                             "dernier": e.get("iso"), "texte": texte})
            c["nb"] += 1
            c["dernier"] = e.get("iso")
            c["texte"] = texte                 # on garde le dernier, chiffres compris
    lignes.append("## 5. Ce qui a été signalé")
    lignes.append("")
    if not compte:
        lignes.append("_Rien : aucun passage enregistré ne portait d'anomalie._")
    else:
        for c in sorted(compte.values(), key=lambda x: (x["nb"], x["dernier"]), reverse=True):
            quand = (c["premier"] if c["premier"] == c["dernier"]
                     else "%s → %s" % (c["premier"], c["dernier"]))
            lignes.append("- **%d×** %s _(%s)_" % (c["nb"], c["texte"], quand))
    lignes.append("")
    lignes.append("---")
    lignes.append("")
    lignes.append("Relevé automatique : `bin/suivi-images.py`, lancé par la tâche planifiée "
                  "`suivi-images.sh` toutes les 15 minutes. Silencieux sauf anomalie ; un résumé "
                  "d'une ligne le lundi matin.")
    return "\n".join(lignes) + "\n"


def ecrire_rapport() -> None:
    try:
        with open(RAPPORT, "w", encoding="utf-8") as f:
            f.write(construire_rapport())
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Programme
# ---------------------------------------------------------------------------

def digest(force: bool = False) -> str:
    passages = [e for e in lire_suivi() if e.get("type") == "passage"]
    if not passages:
        return ""
    dernier = passages[-1]
    p = dernier.get("visuels") or {}
    m = dernier.get("mesure") or {}
    ligne = ("Suivi des visuels — %d passage(s) enregistré(s) ; dernier : %s visuel(s), "
             "%.1f Mo entrés ; stock publié %.1f Mo (%s %% du seuil), %s visuels / %s Mo ; "
             "`.git` %s Mo."
             % (len(passages), p.get("pris", 0), (dernier.get("octets") or 0) / 1e6,
                dernier.get("poidsPublieMo") or 0, dernier.get("partPct") or 0,
                m.get("imgNb") or 0, m.get("imgMo") or 0, m.get("gitMo") or 0))
    audits = [e for e in lire_suivi() if e.get("type") == "audit"]
    if audits:
        ad = audits[-1].get("auDessusDuPlafond") or {}
        ligne += (" %d fichier(s) encore au-dessus de %d px (%.1f Mo)."
                  % (ad.get("nb", 0), PLAFOND_PX, ad.get("mo", 0)))
    return ligne


def main(argv: list[str]) -> int:
    faire_audit = "--audit" in argv or "--forcer" in argv

    if "--rapport" in argv:
        print(construire_rapport())
        return 0

    ecrire_rapport()                       # le rapport se régénère même sans passage neuf
    n, anomalies = relever()
    audit, anomalies_audit = relever_audit(faire_audit)
    ecrire_rapport()

    anomalies = anomalies + anomalies_audit

    if "--json" in argv:
        print(json.dumps({"passagesEcrits": n, "anomalies": anomalies,
                          "audit": bool(audit)}, ensure_ascii=False, indent=1))
        return 0

    # Le radotage tue la surveillance : un même message n'est pas répété avant 12 h,
    # et PAS DEUX MESSAGES À MOINS DE 30 MINUTES — la même discipline que l'alerte du
    # collecteur (bin/collecter.sh). Vécu le 13/10/2026 : le premier passage de cette
    # tâche a parlé, puis une correction du CODE a changé l'empreinte, le passage
    # suivant a refait l'audit et un second message est parti pour le même fait.
    # Le fait reste écrit dans le rapport ; l'écran, lui, se tait un moment.
    memoire = lire_memoire()
    vues = memoire.get("alertes", {})
    maintenant = datetime.datetime.now(datetime.timezone.utc)
    alerte_courante: list[str] = []
    if pas_trop_recent(memoire.get("alerteLe"), maintenant, 1800):
        for alerte in anomalies:
            # La marque est le texte SANS LES CHIFFRES : « à 83 % (847,5 Mo) » et
            # « à 85 % (868,8 Mo) » sont le MÊME signalement.
            marque = re.sub(r"\d+([.,]\d+)?", "#", alerte).lower()[:60]
            quand = vues.get(marque)
            if quand:
                try:
                    dt = datetime.datetime.strptime(quand, "%Y-%m-%dT%H:%M:%SZ").replace(
                        tzinfo=datetime.timezone.utc)
                    if (maintenant - dt).total_seconds() < 12 * 3600:
                        continue
                except ValueError:
                    pass
            vues[marque] = maintenant.strftime("%Y-%m-%dT%H:%M:%SZ")
            alerte_courante.append(alerte)
    memoire["alertes"] = vues
    if alerte_courante:
        memoire["alerteLe"] = maintenant.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Le résumé du lundi, une seule fois par semaine (et jamais s'il y a une
    # anomalie : elle passe devant).
    if not alerte_courante and maintenant.weekday() == JOUR_DU_DIGEST:
        aujourd_hui = maintenant.strftime("%Y-%m-%d")
        if memoire.get("digestLe") != aujourd_hui and maintenant.hour >= 6:
            d = digest()
            if d:
                memoire["digestLe"] = aujourd_hui
                print(d)
    sauver_memoire(memoire)

    if alerte_courante:
        print("⚠ Suivi des visuels — %d anomalie(s) :" % len(alerte_courante))
        for alerte in alerte_courante:
            print("   · " + alerte)
        print("   Rapport : data/rapport-images.md")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
