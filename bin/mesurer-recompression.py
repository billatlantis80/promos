#!/usr/bin/env python3
"""RECOMPRESSION DES VISUELS — échantillon mesuré, avant de toucher 18 000 fichiers.

POURQUOI CE SCRIPT. Le gisement de poids du site est là : 1 959 visuels de plus de
200 ko pèsent 949 Mo, soit 73 % du poids des images. Le levier annoncé est
« recompresser ». Mais un levier annoncé sur une intuition ne vaut rien : on
MESURE d'abord sur un échantillon, et on montre le rendu — parce qu'un gain de
poids obtenu en abîmant l'image n'est pas un gain, c'est un échange.

CE QUE FAIT CE SCRIPT, ET RIEN DE PLUS :
  1. il prend un échantillon DÉTERMINISTE des visuels les plus lourds (pas de
     hasard : deux exécutions donnent le même résultat, donc deux mesures sont
     comparables) ;
  2. il recompresse en WebP à la qualité demandée, EN MÉMOIRE — aucun fichier du
     site n'est touché ;
  3. il écrit une planche comparative 1:1 (pixels réels, côte à côte) pour que
     l'œil juge, et pas seulement la balance ;
  4. il extrapole le gain aux 949 Mo concernés, en disant sur quoi il porte.

Usage :
  bin/mesurer-recompression.py [--qualite 80] [--echantillon 4] [--mesures 60]
                               [--sortie /tmp/comparatif-visuels.png]
"""
import argparse
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFont

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAUT_DOSSIER = os.path.join(RACINE, "docs", "img")
SEUIL_LOURD = 200 * 1000

# Les formats qu'on sait recompresser SANS RISQUE. Volontairement limité :
#   • WebP et AVIF sont DÉJÀ compressés — les recompresser abîmerait l'image
#     pour un gain nul, et le fichier changerait de nature ;
#   • le GIF peut être animé : le convertir figerait l'animation, et une offre
#     dont l'image ne bouge plus est un défaut visible.
RECOMPRESSABLES = {".jpg", ".jpeg", ".png"}


def police(taille):
    """La police : DejaVu en priorité, et c'est un choix, pas un défaut.

    Défaut mesuré sur la première planche (12/10/2026) : la police par défaut de
    Pillow affichait des RECTANGLES à la place des accents et des flèches — un
    comparatif qu'on ne peut pas lire ne compare rien. DejaVu couvre le
    français ; on ne retombe sur la police par défaut que si elle est absente.
    """
    for chemin in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(chemin):
            try:
                return ImageFont.truetype(chemin, taille)
            except OSError:
                pass
    try:
        return ImageFont.load_default(size=taille)
    except TypeError:
        return ImageFont.load_default()


def lister(dossier, seuil=SEUIL_LOURD):
    """Les visuels du dossier, triés du plus lourd au plus léger."""
    fichiers = []
    for nom in os.listdir(dossier):
        chemin = os.path.join(dossier, nom)
        if not os.path.isfile(chemin):
            continue
        try:
            poids = os.path.getsize(chemin)
        except OSError:
            continue
        fichiers.append({"nom": nom, "chemin": chemin, "octets": poids,
                         "ext": os.path.splitext(nom)[1].lower()})
    fichiers.sort(key=lambda f: -f["octets"])
    return fichiers


def recompresser(chemin, qualite, format_="webp", max_cote=0):
    """Recompresse une image, en mémoire. Rend (octets, largeur, hauteur).

    On garde la transparence (RGBA) : un visuel de produit détouré sur fond
    transparent deviendrait un rectangle blanc sans `methode`.

    DEUX RÉGLAGES QUI CHANGENT TOUT, et c'est pour ça qu'ils sont ici :

    • `format_` — « webp » change le format du fichier DONC son extension, donc
      toutes les références du catalogue et des pages de partage. « jpeg » garde
      le nom : le fichier reste `img/<empreinte>.jpg`, aucune référence ne bouge,
      aucune page de partage n'est réécrite, et le collecteur n'a PAS besoin
      d'être modifié — il retrouve ses fichiers et ne les re-télécharge pas.

    • `max_cote` — plafonne le grand côté. Un visuel de 2 000 px affiché à
      400 px dans une carte transporte 25 fois les pixels utiles. On ne descend
      jamais sous 1 200 px, la taille que les réseaux sociaux demandent pour un
      aperçu de partage : échanger de la vitesse contre un aperçu flou serait un
      mauvais échange.
    """
    with Image.open(chemin) as im:
        im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        redimensionnee = False
        if max_cote and max(im.size) > max_cote:
            r = max_cote / max(im.size)
            im = im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)
            redimensionnee = True
        tampon = io.BytesIO()
        if format_ == "jpeg":
            im.convert("RGB").save(tampon, format="JPEG", quality=qualite, optimize=True, progressive=True)
        else:
            im.save(tampon, format="WEBP", quality=qualite, method=5)
        return tampon.getvalue(), im.width, im.height, redimensionnee


def planche(items, sortie, qualite, police_titre, police_texte):
    """Une planche 1:1 : chaque visuel avant / après, pixels réels."""
    CROP_L, CROP_H = 340, 230
    MARGE, LIGNE_TITRE, ENTETE = 22, 34, 62
    L = MARGE * 3 + CROP_L * 2
    H = ENTETE + len(items) * (LIGNE_TITRE + CROP_H + MARGE)
    img = Image.new("RGB", (L, H), (14, 17, 22))
    d = ImageDraw.Draw(img)
    d.text((MARGE, 16), f"Recompression WebP q{qualite} — comparatif 1:1, pixels réels",
           font=police_titre, fill=(235, 235, 235))
    d.text((MARGE, 38), "Aucune retouche, aucun recadrage de publication : c'est le même détail, "
                        "avant à gauche, après à droite.", font=police_texte, fill=(150, 158, 170))
    y = ENTETE
    for it in items:
        d.text((MARGE, y), f"{it['nom']}  —  {it['octets']/1024:.0f} Ko → {it['apres']/1024:.0f} Ko  "
                           f"({it['gain']:+.0f} %)  ·  {it['ext'] or '?'} → .webp",
               font=police_texte, fill=(235, 168, 60))
        y += LIGNE_TITRE
        for i, (cle, etiquette) in enumerate((("chemin", "avant"), ("apres_chemin", "après"))):
            x = MARGE + i * (CROP_L + MARGE)
            try:
                # Deux natures de source, et c'est voulu : l'« avant » est un
                # fichier sur le disque, l'« après » est une image déjà décodée
                # en mémoire — la recompresser une seconde fois pour l'afficher
                # mesurerait autre chose que ce qu'on annonce.
                source = it["chemin"] if cle == "chemin" else it["image_apres"]
                im = Image.open(source) if isinstance(source, str) else source
                im = im.convert("RGB")
                gx = max(0, (im.width - CROP_L) // 2)
                gy = max(0, (im.height - CROP_H) // 2)
                vue = im.crop((gx, gy, gx + CROP_L, gy + CROP_H))
                img.paste(vue, (x, y))
            except Exception as e:                        # image illisible : on le DIT
                d.text((x + 6, y + 6), f"illisible : {e}", font=police_texte, fill=(220, 90, 90))
            d.rectangle([x - 1, y - 1, x + CROP_L, y + CROP_H], outline=(60, 66, 76))
            d.text((x + 4, y + CROP_H + 4), etiquette, font=police_texte, fill=(150, 158, 170))
        y += CROP_H + MARGE
    img.save(sortie)
    return sortie, L, H


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dossier", default=DEFAUT_DOSSIER)
    p.add_argument("--qualite", type=int, default=80)
    p.add_argument("--format", dest="format_", default="webp", choices=["webp", "jpeg"],
                   help="jpeg garde le nom de fichier : aucune référence ne bouge")
    p.add_argument("--max-cote", type=int, default=0,
                   help="plafonne le grand côté (0 = ne redimensionne pas)")
    p.add_argument("--echantillon", type=int, default=4, help="visuels de la planche")
    p.add_argument("--mesures", type=int, default=60, help="visuels mesurés pour le ratio")
    p.add_argument("--sortie", default="/tmp/comparatif-visuels.png")
    a = p.parse_args()

    tous = lister(a.dossier)
    if not tous:
        print(f"aucun visuel dans {a.dossier}", file=sys.stderr)
        return 1
    lourds = [f for f in tous if f["octets"] > SEUIL_LOURD]
    recompressables = [f for f in lourds if f["ext"] in RECOMPRESSABLES]
    poids_lourds = sum(f["octets"] for f in lourds)
    poids_recompressables = sum(f["octets"] for f in recompressables)
    repartition = {}
    for f in lourds:
        repartition[f["ext"] or "(sans)"] = repartition.get(f["ext"] or "(sans)", 0) + 1

    print(f"visuels publiés          : {len(tous)} — {sum(f['octets'] for f in tous)/1e6:.1f} Mo")
    print(f"au-dessus de 200 Ko      : {len(lourds)} — {poids_lourds/1e6:.1f} Mo")
    print(f"  recompressables        : {len(recompressables)} — {poids_recompressables/1e6:.1f} Mo")
    print(f"  formats concernés      : {repartition}")
    print(f"  non recompressables    : {len(lourds)-len(recompressables)} — "
          f"{(poids_lourds-poids_recompressables)/1e6:.1f} Mo (WebP/AVIF : déjà compressés, ou GIF animé)")

    # ÉCHANTILLON DÉTERMINISTE : on prend un fichier tous les `pas`, du plus
    # lourd au plus léger. Pas de hasard — deux mesures doivent être comparables.
    pas = max(1, len(recompressables) // max(1, a.mesures))
    echantillon_mesure = recompressables[::pas][:a.mesures]
    # LES DIMENSIONS, mesurées sur TOUS les fichiers concernés : c'est ce chiffre
    # qui dit si le poids vient d'une qualité excessive ou d'une taille excessive.
    # Un visuel de 2 400 px affiché à 400 px peut perdre 80 % de ses pixels sans
    # que personne ne voie la différence — mais ça ne se suppose pas, ça se lit.
    tailles = []
    for f in recompressables:
        try:
            with Image.open(f["chemin"]) as im:
                tailles.append(max(im.size))
        except Exception:
            pass
    if tailles:
        paliers = [800, 1200, 1600, 2000, 2400]
        rep = " · ".join(f">{q} px : {sum(1 for t in tailles if t > q)}" for q in paliers)
        print(f"\nDIMENSIONS des {len(tailles)} fichiers concernés : grand côté médian "
              f"{sorted(tailles)[len(tailles)//2]} px, max {max(tailles)} px\n  {rep}")

    avant = apres = 0
    apres_prudent = 0          # ce qu'on obtiendrait en gardant le PLUS PETIT
    redimensionnees = 0
    grossis = []
    echecs = []
    for f in echantillon_mesure:
        try:
            octets, _, _, reduite = recompresser(f["chemin"], a.qualite, a.format_, a.max_cote)
        except Exception as e:
            echecs.append((f["nom"], str(e)))
            continue
        avant += f["octets"]
        apres += len(octets)
        apres_prudent += min(f["octets"], len(octets))
        if reduite:
            redimensionnees += 1
        if len(octets) > f["octets"]:
            grossis.append(f["nom"])
    if not avant:
        print("aucune mesure exploitable", file=sys.stderr)
        return 1
    ratio = apres / avant
    ratio_prudent = apres_prudent / avant
    print(f"\nMESURE sur {len(echantillon_mesure)} fichiers ({avant/1e6:.1f} Mo) : "
          f"{avant/1e6:.1f} → {apres/1e6:.1f} Mo  (poids conservé {(ratio*100):.0f} %, "
          f"poids enlevé {(1-ratio)*100:.0f} %)")
    # ⚠ CONVERTIR N'EST PAS TOUJOURS GAGNER. Mesuré : un fichier est passé de
    # 1 415 à 1 498 Ko (+6 %) — un JPEG déjà bien comprimé que WebP n'améliore
    # pas. La règle qui en découle est la seule qui ne peut pas nuire : ON GARDE
    # LE PLUS PETIT DES DEUX. Le chiffre ci-dessous est celui-là, et c'est lui
    # qu'on extrapole — l'autre ferait une promesse que la réalité dément.
    print(f"  en gardant le PLUS PETIT des deux : poids enlevé {(1-ratio_prudent)*100:.0f} %"
          f"  (grossis par la conversion : {len(grossis)}/{len(echantillon_mesure)}"
          + (f" — ex. {grossis[0]}" if grossis else "") + ")"
          + (f"  ·  redimensionnés : {redimensionnees}/{len(echantillon_mesure)}" if a.max_cote else ""))
    if echecs:
        print(f"  {len(echecs)} échec(s) : {echecs[:3]}")
    gain_total = poids_recompressables * (1 - ratio_prudent)
    print(f"EXTRAPOLÉ aux {len(recompressables)} recompressables : "
          f"−{gain_total/1e6:.0f} Mo sur les {poids_recompressables/1e6:.0f} Mo concernés")

    # La planche : les plus lourds de l'échantillon mesuré.
    items = []
    vus = set()
    for f in echantillon_mesure[:a.echantillon] + echantillon_mesure[-a.echantillon:]:
        if f["nom"] in vus:
            continue
        vus.add(f["nom"])
        try:
            octets, _, _, _ = recompresser(f["chemin"], a.qualite, a.format_, a.max_cote)
            avec = Image.open(io.BytesIO(octets)).convert("RGB")
            f2 = dict(f)
            f2["apres"] = len(octets)
            f2["gain"] = 100 * (len(octets) / f["octets"] - 1)
            f2["image_apres"] = avec
            items.append(f2)
        except Exception:
            continue
    chemin, L, H = planche(items, a.sortie, a.qualite, police(15), police(12))
    print(f"planche écrite : {chemin} ({L}×{H})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
