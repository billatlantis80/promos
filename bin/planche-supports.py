#!/usr/bin/env python3
"""PLANCHE DES CINQ SUPPORTS — une seule image pour les voir tous.

POURQUOI CETTE PLANCHE

    Les cinq supports ont été mesurés séparément (bin/mesurer-supports.py) pour
    pouvoir être corrigés séparément. Mais une suite de chiffres ne dit pas ce
    que B VOIT. Cette planche rassemble une capture de chaque support, à la
    même hauteur de référence, avec sous chacune les trois nombres qui décident
    de l'impression générale : les colonnes, la hauteur de l'en-tête, et la
    largeur d'une carte.

    Les captures sont prises en mode TUILES (le mode par défaut du site) : les
    trois autres modes se mesurent, mais ne se comparent pas dans une vignette.

USAGE

    /opt/data/capture/venv/bin/python bin/planche-supports.py \
        [releve.json] [dossier-captures] [image-de-sortie]

    Par défaut : /tmp/supports/releve.json, /tmp/supports, /tmp/supports/planche.png
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

RELEVE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/supports/releve.json"
DOSSIER = sys.argv[2] if len(sys.argv) > 2 else "/tmp/supports"
SORTIE = sys.argv[3] if len(sys.argv) > 3 else "/tmp/supports/planche.png"

ORDRE = ["app-telephone", "app-tablette", "site-telephone", "site-tablette", "site-ordinateur"]

# La fenêtre dans laquelle chaque capture tient (elle est réduite, jamais
# rognée) : une seule hauteur pour tous, pour que l'œil compare le même cadre.
BOITE = (452, 812)
FOND = (245, 246, 248)
ENCRE = (24, 38, 51)
GRIS = (110, 122, 135)
TITRES = {
    "app-telephone": "APPLICATION — téléphone",
    "app-tablette": "APPLICATION — tablette",
    "site-telephone": "SITE — téléphone",
    "site-tablette": "SITE — tablette",
    "site-ordinateur": "SITE — ordinateur",
}
COULEUR = {"app": (13, 59, 91), "site": (235, 145, 45)}

police = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
police_gras = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def charger(chemin, taille):
    try:
        return ImageFont.truetype(chemin, taille)
    except Exception:
        return ImageFont.load_default()


def largeur_texte(d, texte, police):
    return d.textbbox((0, 0), texte, font=police)[2]


def main():
    with open(RELEVE, encoding="utf-8") as f:
        releve = json.load(f)

    # Une entrée par support : le mode tuiles, la première taille déclarée.
    par_support = {}
    for e in releve:
        if e["mode"] != "grille":
            continue
        par_support.setdefault(e["support"], e)

    f_titre = charger(police_gras, 26)
    f_support = charger(police_gras, 21)
    f_chiffres = charger(police, 18)

    # `entete` laisse passer le titre général, qui est écrit au-dessus : sans
    # cette hauteur, les titres de support se posaient par-dessus (défaut vu à
    # la première planche).
    marge, ecart, entete, sous_titre = 34, 26, 76, 132
    grand = Image.new("RGB", (10, 10), FOND)
    d0 = ImageDraw.Draw(grand)
    largeur_utile = marge * 2 + BOITE[0] * 5 + ecart * 4
    hauteur = entete + sous_titre + BOITE[1] + marge + 26

    img = Image.new("RGB", (largeur_utile, hauteur), FOND)
    d = ImageDraw.Draw(img)
    d.text((marge, 22), "Les cinq supports de Kazendra, tels qu'ils s'affichent aujourd'hui",
           font=f_titre, fill=ENCRE)

    x = marge
    for nom in ORDRE:
        e = par_support.get(nom)
        if e is None:
            x += BOITE[0] + ecart
            continue
        m = e["mesures"]
        capture = os.path.join(DOSSIER, os.path.basename(m.get("capture", "")))
        if not os.path.exists(capture):
            capture = f"{DOSSIER}/{nom}-{e['largeur_fenetre']}x-{e['mode']}.png"

        famille = e["famille"]
        d.text((x, entete), TITRES[nom], font=f_support, fill=COULEUR[famille])
        d.text((x, entete + 28), f"{e['largeur_fenetre']} px de large",
               font=f_chiffres, fill=GRIS)
        carte = m["largeurs_offres"][0] if m["largeurs_offres"] else 0
        d.text((x, entete + 52), f"{m['colonnes']} colonne(s) · cartes {carte} px",
               font=f_chiffres, fill=GRIS)
        d.text((x, entete + 76), f"en-tête {m['tete_hauteur']} px · logo {m['logo']} px",
               font=f_chiffres, fill=GRIS)
        d.text((x, entete + 100), f"visuel en tuile {m['visuel']} px · bouton {m['bouton'][0]} px",
               font=f_chiffres, fill=GRIS)

        if os.path.exists(capture):
            c = Image.open(capture).convert("RGB")
            c.thumbnail(BOITE, Image.LANCZOS)
            haut = entete + sous_titre
            cadre = Image.new("RGB", BOITE, (255, 255, 255))
            cadre.paste(c, ((BOITE[0] - c.width) // 2, (BOITE[1] - c.height) // 2))
            img.paste(cadre, (x, haut))
            d.rectangle([x, haut, x + BOITE[0] - 1, haut + BOITE[1] - 1], outline=(210, 214, 219))
        x += BOITE[0] + ecart

    d.text((marge, hauteur - 40),
           "Chaque capture est RÉDUITE pour tenir dans son cadre : la tablette est donc montrée plus "
           "petite qu'en réalité, et l'ordinateur paraît court (un écran large est bas).",
           font=charger(police, 16), fill=GRIS)
    d.text((marge, hauteur - 20),
           "Ce sont les colonnes et les chiffres qui se comparent. Toute retouche d'un support passe "
           "par sa zone, en fin de app.css.",
           font=charger(police, 16), fill=GRIS)

    os.makedirs(os.path.dirname(os.path.abspath(SORTIE)), exist_ok=True)
    img.save(SORTIE)
    print(f"PLANCHE ÉCRITE : {SORTIE} ({img.width} × {img.height})")


if __name__ == "__main__":
    main()
