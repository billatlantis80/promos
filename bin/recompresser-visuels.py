#!/usr/bin/env python3
"""LA PASSE SUR PLACE — recompresser les visuels sans changer un seul nom de fichier.

DÉCISION DE B (12/10/2026) : « Oui tu peux lancer. »

CE QUE CETTE PASSE FAIT, ET POURQUOI AINSI.

Le poids du site vient des PIXELS, pas du format — mesuré : grand côté médian
1 780 px, maximum 11 209 px, alors qu'une carte s'affiche à ~400 px. Trois pistes
ont été mesurées (rapport du 12/10/2026) :

  · WebP q85, sans redimensionner ......... −653 Mo  mais extension changée :
      donc références à réécrire, collecteur à modifier, 20 806 pages de partage
      à regénérer, et un re-téléchargement complet au passage suivant ;
  · JPEG q85 sur place .................... −615 Mo  aucun changement de code ;
  · JPEG q85 plafonné à 1 200 px .......... −743 Mo  aucun changement de code.

La troisième gagne sur les deux tableaux, et c'est elle qu'on applique. On ne
touche NI aux noms, NI au catalogue, NI aux pages de partage, NI au collecteur.

TROIS RÈGLES DE SÛRETÉ, chacune pour une façon précise de tout casser :

  1. LES ORIGINAUX SONT COPIÉS AVANT D'ÊTRE REMPLACÉS, hors du site publié. Un
     retour en arrière est alors une copie, pas un re-téléchargement de 1,3 Go
     chez les partenaires.
  2. LE PLUS PETIT DES DEUX GAGNE. Mesuré : 33 fichiers sur 60 GROSSISSENT
     quand on recompresse sans redimensionner. Écrire le plus gros serait une
     perte sèche, invisible dans un total.
  3. LA TRANSPARENCE EST RESPECTÉE. Un détourage de produit converti en JPEG
     devient un rectangle noir ; les images à couche alpha gardent leur format
     et leur nom. Quelques mégaoctets ne valent pas ce risque.

Par défaut, la passe NE TOUCHE À RIEN : elle imprime ce qu'elle ferait. Il faut
`--appliquer` pour écrire — la même discipline que pour la règle des sept jours.

Usage :
  bin/recompresser-visuels.py                          # à blanc
  bin/recompresser-visuels.py --appliquer              # écrit

  # L'ENTRETIEN (appelé par le passage du collecteur, avant son git add) :
  bin/recompresser-visuels.py --appliquer --seuil 100000 \
      --depuis 3 --max 600 --resume /tmp/visuels.json --archive <archive du jour>

`--depuis <heures>` n'existe PAS pour faire joli : sans lui, chaque entretien
décode les 19 300 fichiers du site pour ne réécrire que les quelques-uns qui
viennent d'arriver (~8 minutes). Avec lui, un passage d'entretien dure quelques
secondes — et c'est ce qui permet de le mettre DANS la collecte, à l'endroit où
le visuel de taille marchand n'est pas encore entré dans le dépôt.
"""
import argparse
import io
import json
import os
import shutil
import sys
import time
from datetime import datetime

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAUT_DOSSIER = os.path.join(RACINE, "docs", "img")
DEFAUT_ARCHIVE = "/opt/data/sauvegardes/kazendra-images-origine"
SEUIL = 200 * 1000
MAX_COTE = 1200          # ≈ un écran de téléphone en 3×, et la taille demandée
                         # pour un aperçu de partage. En dessous, on échange de
                         # la vitesse contre un aperçu flou.


def a_transparence(im):
    """L'image porte-t-elle une couche alpha, ou une transparence déclarée ?"""
    return im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info


def recompresser(chemin, qualite, max_cote):
    """Rend (octets, redimensionnee) — ou (None, False) si on ne sait pas lire."""
    try:
        with Image.open(chemin) as im:
            if a_transparence(im):
                return None, False
            extension = os.path.splitext(chemin)[1].lower()
            format_ = "PNG" if im.format == "PNG" else "JPEG"
            # LE NOM QUI MENT — défaut trouvé le 12/10/2026 : 29 fichiers sont des
            # PNG portant un nom « .jpg » (21 Mo). L'extension voyage dans le nom,
            # et c'est elle que l'hébergeur annonce dans l'en-tête Content-Type :
            # un PNG annoncé `image/jpeg` peut être refusé par un lecteur d'aperçu
            # de partage. Sans transparence, le contenu devient donc un VRAI JPEG :
            # le nom redevient vrai, et le poids fond (un PNG de photo est
            # plusieurs fois plus lourd qu'un JPEG de même taille).
            if format_ == "PNG" and extension in (".jpg", ".jpeg"):
                format_ = "JPEG"
            im = im.convert("RGB")
            reduite = False
            if max_cote and max(im.size) > max_cote:
                r = max_cote / max(im.size)
                im = im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))),
                               Image.LANCZOS)
                reduite = True
            tampon = io.BytesIO()
            if format_ == "PNG":
                # PNG : on ne change PAS le format (l'extension est dans le nom,
                # et un PNG servi sous un nom .png doit rester un PNG — l'en-tête
                # et l'extension doivent dire la même chose). Le gain vient du
                # redimensionnement et de l'optimiseur.
                im.save(tampon, format="PNG", optimize=True)
            else:
                im.save(tampon, format="JPEG", quality=qualite, optimize=True, progressive=True)
            return tampon.getvalue(), reduite
    except Exception:
        return None, False


def etat_fichier(chemin, max_cote):
    """QUE FAIRE DE CE FICHIER ? « plafond » · « transparente » · « a_traiter ».

    LECTURE D'EN-TÊTE SEULE (quelques dixièmes de milliseconde) : `Image.open` ne
    décode pas les pixels, il lit les dimensions. C'est ce qui permet à l'entretien
    de passer sur 19 000 fichiers sans coûter huit minutes.

    POURQUOI CE CONTRÔLE EXISTE (défaut mesuré le 13/10/2026) : le premier
    entretien a réécrit 427 fichiers déjà au plafond pour gagner 3 % — au prix de
    427 nouveaux blobs dans git (irréversibles) et de 56 secondes de processeur.
    Un JPEG q85 recompressé en q85 ne rapporte presque rien : le gain réel vient
    du REDIMENSIONNEMENT, donc des fichiers encore en taille marchand.

    DEUX CAS LAISSÉS TRANQUILLES, ET COMPTÉS SÉPARÉMENT — un compte juste vaut
    mieux qu'un total qui mélange deux raisons de ne rien faire (défaut attrapé
    par l'épreuve du 13/10 : les transparences étaient annoncées « déjà au
    plafond »). Un détourage converti en JPEG devient un rectangle noir : on n'y
    touche pas. Un fichier déjà dans le plafond ne gagne rien à être recompressé.

    L'EXCEPTION QUI COMPTE : un PNG sans transparence dont le NOM dit « .jpg ».
    Celui-là doit être examiné même s'il est déjà petit — le réécrire en vrai JPEG
    fait tomber le poids de plusieurs fois (mesuré : 2 514 → 124 Ko)."""
    try:
        with Image.open(chemin) as im:
            if a_transparence(im):
                return "transparente"
            l, h = im.size
            ment = (im.format == "PNG"
                    and os.path.splitext(chemin)[1].lower() in (".jpg", ".jpeg"))
            return "a_traiter" if (max(l, h) > max_cote or ment) else "plafond"
    except Exception:
        return "a_traiter"                        # illisible : l'appelant tranchera


def lister(dossier, seuil, depuis_heures=0, max_fichiers=0, max_cote=0):
    """Les candidats : au-dessus du seuil, et — si `depuis_heures` est donné —
    seulement ceux modifiés récemment. Triés du PLUS LOURD au plus léger, pour
    que `--max` garde les gains les plus gros si jamais on doit s'arrêter.

    LES FICHIERS DÉJÀ AU PLAFOND SONT ÉCARTÉS ICI, AVANT LE PLAFOND DE NOMBRE — et
    pas après. Défaut évité le 13/10/2026 : après une grande passe, les fichiers
    récents sont massivement des fichiers qu'on vient d'optimiser. Triés par poids,
    ils occupaient TOUTES les places de `--max`, et un nouvel arrivage plus léger
    n'était jamais examiné — affamé par du travail déjà fait. La lecture d'en-tête
    coûte quelques dixièmes de milliseconde : le tri se fait donc sur de vrais
    candidats. Rend `(fichiers, deja_au_plafond)`."""
    limite = time.time() - depuis_heures * 3600 if depuis_heures else 0
    fichiers = []
    au_plafond = 0
    transparentes = 0
    for nom in sorted(os.listdir(dossier)):
        chemin = os.path.join(dossier, nom)
        if not os.path.isfile(chemin):
            continue
        if os.path.splitext(nom)[1].lower() not in (".jpg", ".jpeg", ".png"):
            continue
        try:
            poids = os.path.getsize(chemin)
            modifie = os.path.getmtime(chemin)
        except OSError:
            continue
        if poids <= seuil:
            continue
        if limite and modifie < limite:
            continue
        if max_cote:
            etat = etat_fichier(chemin, max_cote)
            if etat == "plafond":
                au_plafond += 1
                continue
            if etat == "transparente":
                transparentes += 1
                continue
        fichiers.append({"nom": nom, "chemin": chemin, "octets": poids})
    fichiers.sort(key=lambda f: -f["octets"])
    if max_fichiers:
        fichiers = fichiers[:max_fichiers]
    return fichiers, au_plafond, transparentes


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dossier", default=DEFAUT_DOSSIER)
    p.add_argument("--qualite", type=int, default=85)
    p.add_argument("--max-cote", type=int, default=MAX_COTE)
    p.add_argument("--seuil", type=int, default=SEUIL)
    p.add_argument("--archive", default=DEFAUT_ARCHIVE)
    p.add_argument("--depuis", type=float, default=0,
                   help="ne traiter que les fichiers modifiés depuis N heures (0 = tous)")
    p.add_argument("--max", type=int, default=0, dest="maximum",
                   help="arrêter après N fichiers (les plus lourds d'abord)")
    p.add_argument("--resume", default="",
                   help="écrire un résumé JSON lisible par un programme (entretien)")
    p.add_argument("--gain-min", type=float, default=0, dest="gain_min",
                   help="ne réécrire que si le gain atteint ce pourcentage (0 = tout gain)")
    p.add_argument("--appliquer", action="store_true", help="sans ce drapeau : à blanc")
    a = p.parse_args()

    if not os.path.isdir(a.dossier):
        print(f"dossier introuvable : {a.dossier}", file=sys.stderr)
        return 1
    if os.path.abspath(a.dossier) == "/" or a.dossier.count("/") < 3:
        print("refus : ce dossier n’a pas l’air d’un dossier de visuels", file=sys.stderr)
        return 1

    fichiers, ecartes_plafond, ecartes_transparence = lister(
        a.dossier, a.seuil, a.depuis, a.maximum, a.max_cote)
    poids_avant = sum(f["octets"] for f in fichiers)
    print(f"candidats : {len(fichiers)} fichiers de plus de {a.seuil//1024} Ko — "
          f"{poids_avant/1e6:.1f} Mo"
          + (f" · modifiés depuis moins de {a.depuis:g} h" if a.depuis else "")
          + (f" · plafond de {a.maximum} fichiers" if a.maximum else ""))

    print(f"réglage   : qualité {a.qualite}, grand côté ≤ {a.max_cote} px, "
          f"format et noms CONSERVÉS")
    print(f"mode      : {'APPLIQUÉ (écriture)' if a.appliquer else 'À BLANC (rien n’est écrit)'}")
    if a.appliquer:
        os.makedirs(a.archive, exist_ok=True)
        print(f"archive   : {a.archive}")

    gagnes = perdus = ignores = 0
    octets_avant = octets_apres = 0
    transparence = ecartes_transparence   # déjà écartées par `lister`, avant le plafond de nombre
    redimensionnes = 0
    au_plafond = ecartes_plafond
    plus_gros_ecart = None
    for i, f in enumerate(fichiers, 1):
        # DÉJÀ AU PLAFOND ou TRANSPARENCE : on n'y touche pas — `lister` les a
        # normalement déjà écartés ; ce contrôle-ci tient quand on l'appelle sans
        # plafond (max_cote = 0). Recompresser un fichier déjà redimensionné ne
        # rapporte que quelques pour cent, et coûte un blob définitif dans git.
        etat = etat_fichier(f["chemin"], a.max_cote) if a.max_cote else "a_traiter"
        if etat in ("plafond", "transparente"):
            if etat == "plafond":
                au_plafond += 1
            else:
                transparence += 1
            if i % 250 == 0:
                print(f"  … {i}/{len(fichiers)} — {octets_avant/1e6:.0f} Mo traités")
            continue
        octets, reduite = recompresser(f["chemin"], a.qualite, a.max_cote)
        if octets is None:
            transparence += 1
            continue
        # RÈGLE DU PLUS PETIT, ET DU GAIN QUI VAUT LA PEINE : un gain de 2 % ne
        # paie pas un nouveau blob dans l'historique du dépôt.
        gain_pct = 100 * (1 - len(octets) / f["octets"])
        if len(octets) >= f["octets"] or gain_pct < a.gain_min:
            perdus += 1
            continue

        octets_avant += f["octets"]
        octets_apres += len(octets)
        gagnes += 1
        if reduite:
            redimensionnes += 1
        ecart = f["octets"] - len(octets)
        if plus_gros_ecart is None or ecart > plus_gros_ecart[1]:
            plus_gros_ecart = (f["nom"], ecart, f["octets"], len(octets))
        if a.appliquer:
            shutil.copy2(f["chemin"], os.path.join(a.archive, f["nom"]))
            with open(f["chemin"], "wb") as sortie:
                sortie.write(octets)
        if i % 250 == 0:
            print(f"  … {i}/{len(fichiers)} — {octets_avant/1e6:.0f} Mo traités")

    print(f"\n{'ÉCRITS' if a.appliquer else 'ÉCRIRABLES'} : {gagnes} fichiers, "
          f"{octets_avant/1e6:.0f} → {octets_apres/1e6:.0f} Mo "
          f"(poids enlevé {100*(1-octets_apres/max(1,octets_avant)):.0f} %)")
    print(f"  laissés tels quels (déjà plus légers) : {perdus}")
    print(f"  déjà au plafond {a.max_cote} px (intacts) : {au_plafond}")
    print(f"  écartés (transparence respectée)      : {transparence}")
    print(f"  redimensionnés au plafond {a.max_cote} px : {redimensionnes}")
    if plus_gros_ecart:
        n, e, av, ap = plus_gros_ecart
        print(f"  plus gros gain : {n} {av/1024:.0f} → {ap/1024:.0f} Ko (−{e/1e6:.1f} Mo)")
    if not a.appliquer:
        print("\nRien n’a été écrit. Relancer avec --appliquer pour appliquer.")
    else:
        print(f"\nOriginaux conservés dans {a.archive} ({datetime.now():%Y-%m-%d %H:%M})")

    # LE RÉSUMÉ LISIBLE PAR UN PROGRAMME — c'est l'entretien qui le lit, et il
    # n'a pas à deviner le résultat en analysant une phrase française : un texte
    # qu'on gratte au motif casse au premier changement de libellé.
    if a.resume:
        try:
            with open(a.resume, "w", encoding="utf-8") as f:
                json.dump({
                    "genereLe": datetime.now().isoformat(timespec="seconds"),
                    "mode": "applique" if a.appliquer else "a_blanc",
                    "dossier": a.dossier,
                    "archive": a.archive if a.appliquer else "",
                    "plafondPx": a.max_cote,
                    "qualite": a.qualite,
                    "seuilOctets": a.seuil,
                    "depuisHeures": a.depuis,
                    "candidats": len(fichiers),
                    "candidatsMo": round(poids_avant / 1e6, 1),
                    "ecrits": gagnes,
                    "octetsAvant": octets_avant,
                    "octetsApres": octets_apres,
                    "moAvant": round(octets_avant / 1e6, 1),
                    "moApres": round(octets_apres / 1e6, 1),
                    "dejaPlusLegers": perdus,
                    "dejaAuPlafond": au_plafond,
                    "gainMinPct": a.gain_min,
                    "transparence": transparence,
                    "redimensionnes": redimensionnes,
                }, f, ensure_ascii=False)
        except Exception as e:
            print(f"résumé non écrit ({e}) — la passe, elle, est faite", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
