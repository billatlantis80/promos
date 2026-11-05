#!/usr/bin/env python3
"""MESURE la fidélité du vectoriel : c'est ce chiffre qui dit s'il est bon.

On compare le rendu Chromium (524 x 551, exactement la taille de sa source) à sa
pastille, SÉPARÉMENT :
  - le CŒUR (masque érodé de 6 px) : c'est là que se voient les vraies erreurs de
    couleur et de forme ;
  - les BORDS : c'est là que vit l'anti-aliasing, ce n'est pas un défaut ;
  - l'écart le long des contours : un halo uniforme = décalage global, pas une
    erreur de dessin.

Usage : /opt/data/capture/venv/bin/python /tmp/mesure-vecteur.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage

RACINE = "/opt/data/webdev/projects/promos"
# La source de comparaison est la MÊME découpe que celle qui a servi à tracer
# (sa pastille + 6 px de marge) : comparer à une découpe différente mesurerait le
# cadrage, pas le tracé.
import re as _re
_svg = open(f"{RACINE}/identite/kazendra-vecteur.svg", encoding="utf-8").read()
_m = _re.search(r'viewBox="0 0 (\d+) (\d+)"', _svg)
LW, LH = int(_m.group(1)), int(_m.group(2))
source = Image.open("/tmp/pixels-de-b-grande.png").convert("RGBA")
# on reforme le cadre avec la même marge de 6 px
_brut = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
_brut.paste(source, (6, 6))
source = _brut
rendu = Image.open("/tmp/vecteur-source.png").convert("RGBA")
assert source.size == rendu.size, (source.size, rendu.size)

alpha = np.asarray(source.split()[-1]).astype(float) / 255.0
masque = alpha > 0.5
coeur = ndimage.binary_erosion(masque, iterations=6)

a = np.asarray(source.convert("RGB")).astype(int)
b = np.asarray(rendu.convert("RGB")).astype(int)
d = np.abs(a - b).max(axis=2)

for nom, m in (("tout le logo", masque), ("le CŒUR (érodé de 6 px)", coeur),
               ("les BORDS", masque & ~coeur)):
    if m.sum() == 0:
        continue
    dd = d[m]
    print(f"{nom:26} : écart moyen {dd.mean():5.2f}/255 | p95 {np.percentile(dd, 95):5.1f} "
          f"| max {dd.max():3d} | {100 * (dd > 20).mean():5.2f} % des pixels > 20")

# Halo de contour : l'écart moyen SUR la bande de contour (2 px), anneau du masque.
anneau = ndimage.binary_dilation(masque, iterations=2) & ~ndimage.binary_erosion(masque, iterations=2)
print(f"{'la bande des contours':26} : écart moyen {d[anneau].mean():5.2f}/255")

# Et l'écart de SILHOUETTE : combien de pixels de désaccord sur la forme du logo.
# SEUIL de « non-fond » : la pastille est claire sur un fond teal sombre.
lum_s = np.asarray(source.convert("L")).astype(float)
sil_s = lum_s > 150
sil_r = np.asarray(rendu.convert("L")).astype(float) > 150
desaccord = int((sil_s != sil_r).sum())
print(f"\nsilhouette : {100 * desaccord / sil_s.sum():.2f} % de pixels en désaccord "
      f"({desaccord} px sur {int(sil_s.sum())})")

# --- LES APLATS, PIÈCE PAR PIÈCE : le chiffre qui compte pour l'impression -----
# On mesure loin des bords (érosion de 4 px) : c'est là que se voient les vraies
# erreurs de couleur. Un écart qui vit sur les bords est de l'anti-aliasing.
from scipy import ndimage as _nd

_lum = np.asarray(source.convert("L")).astype(float)
_past = _nd.binary_fill_holes(alpha > 128) if alpha.max() <= 1 else _nd.binary_fill_holes(alpha > 0.5)
_fond = np.median(s[np.asarray(source.split()[-1])[..., None][..., 0] > 235], axis=0) if False else None
print("\naplats (érodés de 4 px), pièce par pièce :")
_rgb_s = np.asarray(source.convert("RGB")).astype(float)
_d2 = np.sqrt(((_rgb_s - np.median(_rgb_s[_past & (np.asarray(source.convert("L")) > 235)], axis=0)) ** 2).sum(axis=2))
_marque = (_d2 > 55) & _nd.binary_erosion(_past, iterations=2)
_orange = _marque & ((_rgb_s[..., 0] - _rgb_s[..., 2]) > 55)
_bleu = _marque & ((_rgb_s[..., 2] - _rgb_s[..., 0]) > 10) & ~_orange
for _nom, _m in (("encadrement", _past & ~_marque), ("orange", _orange), ("bleu", _bleu)):
    _c = _nd.binary_erosion(_m, iterations=4)
    if _c.sum() < 50:
        continue
    print(f"  {_nom:12} {d[_c].mean():5.2f}/255 sur {int(_c.sum())} px")

# Planche : sa source | le vectoriel | l'écart amplifié 4x | un détail du K en grand
Z = 4
K = (300, 400)                            # un détail : le creux du K
det_s = source.convert("RGB").crop((K[0], K[1], K[0] + 120, K[1] + 120)).resize((480, 480), Image.NEAREST)
det_r = rendu.convert("RGB").crop((K[0], K[1], K[0] + 120, K[1] + 120)).resize((480, 480), Image.NEAREST)
ecart = Image.fromarray(np.dstack([np.clip(d * Z, 0, 255)] * 3).astype(np.uint8)).convert("RGB")
ecart = ecart.resize((480, round(480 * ecart.height / ecart.width)), Image.LANCZOS)

haut = max(source.height, rendu.height)
tuiles = [source.convert("RGB"), rendu.convert("RGB"), ecart]
largeur = sum(t.width for t in tuiles) + 32
planche = Image.new("RGB", (largeur, haut + 500), "#0d3b5b")
x = 0
for t in tuiles:
    planche.paste(t, (x, 0))
    x += t.width + 16
planche.paste(det_s, (0, haut + 16))
planche.paste(det_r, (496, haut + 16))
planche.save("/tmp/planche-vecteur.png")
print("planche : /tmp/planche-vecteur.png (sa source | le vectoriel | l'écart x4, puis le détail du K)")
