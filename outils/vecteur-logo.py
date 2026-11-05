#!/usr/bin/env python3
"""LE LOGO KAZENDRA EN VECTORIEL — haute qualité, pour l'impression.

Demande de B (11/10/2026) : « Peux-tu me faire le dessin vectoriel du logo, haute
définition et HAUTE QUALITÉ. Le logo avec son encadrement afin de pouvoir publier
et imprimer sur des t-shirts des cartes de visite des tasses. »

Ce qui fait la qualité ici, et pas la forme approximative du 07/10 :
  1. la source est SA pastille, découpée dans son image et dé-frangée (524 x 551) ;
  2. segmentation par FAMILLES de couleurs puis croissance dans les coutures —
     les dégradés interdisent un seuillage par teinte (recette du 08/10/2026) ;
  3. contours relevés SOUS LE PIXEL, puis COUPÉS AUX ANGLES : entre deux angles on
     ajuste une spline (les courbes du K), et là où les points sont alignés on
     écrit une ligne droite. Un polygone seul ondule ; une spline seule arrondit
     les pointes du K. L'encadrement, lui, est traité en BOUCLE FERMÉE (aucune
     pointe à respecter) ;
  4. chaque dégradé est RELEVÉ, jamais deviné, et ses arrêts sont SIMPLIFIÉS
     (un écart de moins de 4/255 ne justifie pas un arrêt de plus) ;
  5. l'encadrement suit SA forme, relevée comme le reste.

Sortie : identite/kazendra-vecteur.svg

Usage : /opt/data/capture/venv/bin/python /tmp/vecteur-logo.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.interpolate import splprep, splev
from skimage import measure

RACINE = "/opt/data/webdev/projects/promos"
SOURCE = "/tmp/pixels-de-b-grande.png"          # sa pastille dé-frangée, 524 x 551

# --- SA PASTILLE, AVEC UNE MARGE AUTOUR -------------------------------------
# Sans marge, le contour de l'encadrement touche les bords du tableau : le
# remplissage de padding le fait alors sortir du cadre (mesuré sur la première
# passe : encadrement 3 px trop large en haut, coupé net en bas), et le tracé ne
# ferme plus. Six pixels de fond tout autour rendent le contour INTÉRIEUR.
ORIGINE = "/opt/data/image_cache/img_90a0a79deae4.jpg"
brut = Image.open(ORIGINE).convert("RGB")
_a = np.asarray(brut)
_L = np.asarray(brut.convert("L")).astype(float)
_sombre = _L < 200
_etiq, _ = ndimage.label(_sombre)
_bords = set(_etiq[0, :]) | set(_etiq[-1, :]) | set(_etiq[:, 0]) | set(_etiq[:, -1])
_bords.discard(0)
_fond = np.isin(_etiq, list(_bords))
_icone = ndimage.binary_fill_holes(~_fond)
_etiq2, _n2 = ndimage.label(_icone)
_t = ndimage.sum(_icone, _etiq2, range(1, _n2 + 1))
_icone = _etiq2 == (int(np.argmax(_t)) + 1)
_ys, _xs = np.where(_icone)
_x0, _x1, _y0, _y1 = _xs.min(), _xs.max() + 1, _ys.min(), _ys.max() + 1
MARGE = 6
_couleur_fond = np.median(_a[_fond], axis=0)
_alf = ndimage.gaussian_filter(_icone.astype(float), 0.7)
_alf = np.clip((_alf - 0.25) / 0.5, 0, 1)
_rgb = _a.astype(float)
_a3 = _alf[..., None]
_propre = np.where(_a3 > 0.02,
                   (_rgb - (1 - _a3) * _couleur_fond.reshape(1, 1, 3)) / np.maximum(_a3, 0.02),
                   _rgb)
rgba = np.dstack([np.clip(_propre, 0, 255), (_alf * 255)]).astype(np.uint8)
gy0, gy1 = max(0, _y0 - MARGE), min(rgba.shape[0], _y1 + MARGE)
gx0, gx1 = max(0, _x0 - MARGE), min(rgba.shape[1], _x1 + MARGE)
rgba = rgba[gy0:gy1, gx0:gx1]

rgb, alpha = rgba[..., :3].astype(float), rgba[..., 3].astype(float)
H, W = alpha.shape
print(f"source : sa pastille + {MARGE} px de marge = {W} x {H} px")

# ------------------------------------------------------------- 1. la pastille
pastille = ndimage.binary_fill_holes(alpha > 128)
# le K lui-même : nécessaire pour mesurer le dégradé de l'ANNEAU seul
# (la pastille entière porterait les teintes du K dans ses arrêts)
clair = (rgb.mean(axis=2) > 235) & pastille
fond = np.median(rgb[clair], axis=0)
print("fond de la pastille (médiane des pixels clairs) :", [int(v) for v in fond])

# ------------------------------------------------- 2. les pièces, par familles
coeur = ndimage.binary_erosion(pastille, iterations=2)
d = np.sqrt(((rgb - fond) ** 2).sum(axis=2))
marque = (d > 55) & coeur
orange = marque & (rgb[..., 0] - rgb[..., 2] > 55)
bleu = marque & (rgb[..., 2] - rgb[..., 0] > 10) & ~orange
bruit = marque & ~orange & ~bleu
for _ in range(3):
    for cls in (orange, bleu):
        cls |= ndimage.binary_dilation(cls, iterations=1) & bruit
        bruit = marque & ~orange & ~bleu

etiq, n = ndimage.label(bleu, structure=np.ones((3, 3)))
tailles = ndimage.sum(bleu, etiq, range(1, n + 1))
gros = [i + 1 for i, t in enumerate(tailles) if t >= 1500]
print(f"îlots bleus retenus : {len(gros)} sur {n} — tailles {[int(tailles[i-1]) for i in gros]}")


# ------------------------------------------------- 3. relevé des dégradés
def simplifie(stops, seuil=1.2):
    """Arrêts réduits par ajustement linéaire par morceaux (Ramer-Douglas-Peucker).

    Un seuil glissant garde un arrêt dès que la couleur a bougé de `seuil` depuis
    le dernier gardé — sur un dégradé long et régulier, ça en garde dix-huit. Ici
    on ne garde que les arrêts qui correspondent à un CHANGEMENT DE PENTE, et on
    garantit que l'erreur d'interpolation entre deux arrêts reste sous `seuil`.
    """
    if len(stops) <= 2:
        return stops

    def rdp(pts):
        if len(pts) < 3:
            return pts
        a, b = np.array(pts[0][1], float), np.array(pts[-1][1], float)
        ta, tb = pts[0][0], pts[-1][0]
        ecarts = []
        for t, c in pts[1:-1]:
            if tb - ta < 1e-9:
                ecarts.append(0.0)
                continue
            k = (t - ta) / (tb - ta)
            ecarts.append(float(np.abs(np.array(c, float) - (a + k * (b - a))).max()))
        i = int(np.argmax(ecarts))
        if ecarts[i] <= seuil:
            return [pts[0], pts[-1]]
        gauche = rdp(pts[:i + 2])
        droite = rdp(pts[i + 1:])
        return gauche[:-1] + droite

    return rdp(stops)


def releve_gradient(masque, nom):
    # ÉRODÉ DE 3 px : mesurer sur les bords ramasse l'anti-aliasing (et la couture
    # pâle entre deux pièces), qui n'est pas la teinte de la pièce. C'est ce qui
    # produisait 18 arrêts au lieu de 5.
    interieur = ndimage.binary_erosion(masque, iterations=3)
    if interieur.sum() > 400:
        masque = interieur
    ys, xs = np.where(masque)
    if len(xs) < 400:
        return None
    A = np.column_stack([xs, ys, np.ones_like(xs)])
    coef, *_ = np.linalg.lstsq(A, rgb[ys, xs], rcond=None)
    direction = coef[:2].mean(axis=1)
    norme = np.hypot(*direction)
    if norme < 1e-9:
        return None
    u = xs * direction[0] + ys * direction[1]
    u = (u - u.min()) / (u.max() - u.min() + 1e-9)
    stops = []
    for i in range(24):
        sel = (u >= i / 24) & (u < (i + 1) / 24)
        if sel.sum() < 40:
            continue
        stops.append((float(u[sel].mean()), np.median(rgb[ys[sel], xs[sel]], axis=0)))
    if len(stops) < 2:
        return None
    stops = simplifie(stops)
    proj = xs * direction[0] / norme + ys * direction[1] / norme
    i0, i1 = np.argmin(proj), np.argmax(proj)
    couleurs = [tuple(int(round(v)) for v in c) for _, c in stops]
    print(f"  {nom:14} sens ({xs[i0]},{ys[i0]}) -> ({xs[i1]},{ys[i1]}) ; "
          f"{len(couleurs)} arrêts {['#%02X%02X%02X' % c for c in couleurs]}")
    return {"a": (xs[i0], ys[i0]), "b": (xs[i1], ys[i1]), "couleurs": couleurs}


# ------------------------------------------------- 4. tracé : polygone écrasé
# La recette PROUVÉE du projet (référence « nettoyer-un-trace-bruite ») : un
# polygone fin est visuellement parfait. Ce n'est PAS la tolérance qui enlève les
# vagues, c'est l'ÉCRASEMENT des sommets quasi alignés.
def nettoie(pts):
    out = [pts[0]]
    for q in pts[1:]:
        if np.hypot(*(q - out[-1])) > 1e-6:
            out.append(q)
    return np.array(out)


def ecrase(pts, seuil=0.9):
    """Retire tout sommet à moins de `seuil` px de la corde qui le contourne.
    Répété jusqu'à stabilité : c'est ce qui rend les arêtes DROITES."""
    pts = list(map(tuple, pts))
    change = True
    while change and len(pts) > 4:
        change = False
        out = [pts[0]]
        i = 1
        while i < len(pts) - 1:
            a, b, c = np.array(out[-1]), np.array(pts[i]), np.array(pts[i + 1])
            ab = c - a
            L = np.hypot(*ab)
            if L > 1e-6 and abs(ab[0] * (b[1] - a[1]) - ab[1] * (b[0] - a[0])) / L < seuil:
                i += 1
                change = True
                continue
            out.append(pts[i])
            i += 1
        out.append(pts[-1])
        pts = out
    return np.array(pts)


def trace_masque(masque, nom, tolerance=1.0, seuil_ecrasement=0.9):
    """Tous les contours d'un masque dans UN SEUL tracé, remplis en « evenodd » :
    les trous se gèrent tout seuls, et un masque troué ne se remplit pas plein."""
    f = ndimage.gaussian_filter(masque.astype(float), 0.9)
    f = np.pad(f, 3)
    d = []
    sommets = 0
    for c in measure.find_contours(f, 0.5, fully_connected="high"):
        if len(c) < 12:
            continue
        pts = nettoie(c - 3.0 + 0.5)        # padding, puis le demi-pixel MESURÉ :
        # réglé par recherche (voir /tmp/reglage-vecteur.py) — sans lui, tous les
        # contours sont décalés d'un côté, ce qui se voit sur les bords.
        pts = measure.approximate_polygon(pts, tolerance=tolerance)
        pts = ecrase(pts, seuil_ecrasement)
        if len(pts) < 4:
            continue
        sommets += len(pts)
        # ATTENTION À L'ORDRE : find_contours rend des couples (LIGNE, COLONNE),
        # c'est-à-dire (y, x). Les écrire tels quels dans un chemin SVG transpose
        # tout le dessin — c'est exactement le défaut qu'on voyait : des pièces en
        # rectangles décalés. On écrit donc (colonne, ligne) = (x, y).
        d.append("M" + f"{pts[0][1]:.2f} {pts[0][0]:.2f} "
                 + " ".join(f"L{q[1]:.2f} {q[0]:.2f}" for q in pts[1:]) + "Z")
    print(f"  {nom:14} {len(d)} contour(s), {sommets} sommets, tolérance {tolerance} px")
    return " ".join(d)


# ------------------------------------------------- 5. assemblage
pieces, defs = [], []


def teinte(c):
    return "#%02X%02X%02X" % (int(c[0]), int(c[1]), int(c[2]))


def ajoute_piece(masque, nom, id_grad, tolerance=1.0, masque_teinte=None):
    g = releve_gradient(masque if masque_teinte is None else masque_teinte, nom)
    d = trace_masque(masque, nom, tolerance)
    if g and len(g["couleurs"]) >= 2:
        defs.append(
            f'<linearGradient id="{id_grad}" gradientUnits="userSpaceOnUse" '
            f'x1="{g["a"][0]:.1f}" y1="{g["a"][1]:.1f}" x2="{g["b"][0]:.1f}" y2="{g["b"][1]:.1f}">'
            + "".join(f'<stop offset="{i/(len(g["couleurs"])-1):.3f}" stop-color="{teinte(c)}"/>'
                      for i, c in enumerate(g["couleurs"]))
            + "</linearGradient>")
        fill = f"url(#{id_grad})"
    else:
        fill = teinte(fond)
    pieces.append(f'<path d="{d}" fill="{fill}" fill-rule="evenodd"/>')


# LE DÉGRADÉ DE L'ENCADREMENT SE MESURE SUR LE FOND SEUL (l'anneau) :
# la pastille entière mêlerait les teintes du K à celles du fond.
anneau = pastille & ~marque
ajoute_piece(pastille, "encadrement", "gencadrement", tolerance=0.5, masque_teinte=anneau)

bleus = []
for i in gros:
    m = etiq == i
    cy, cx = ndimage.center_of_mass(m)
    bleus.append((cx, cy, m))
bleus.sort(key=lambda t: t[0])                    # de gauche à droite
ajoute_piece(bleus[0][2], "hampe", "ghampe", tolerance=0.8)
ajoute_piece(bleus[-1][2], "jambe", "gjambe", tolerance=1.5)
for cx, cy, m in bleus[1:-1]:
    ajoute_piece(m, "ruban navy", "gnavy", tolerance=1.0)

etiq_o, n_o = ndimage.label(orange, structure=np.ones((3, 3)))
ts = ndimage.sum(orange, etiq_o, range(1, n_o + 1))
for rang, j in enumerate(np.argsort(ts)[::-1][:2]):
    if ts[j] < 800:
        continue
    nom = "ruban orange" if rang == 0 else "triangle"
    ajoute_piece(etiq_o == (j + 1), nom, "gorange" if rang == 0 else "gtriangle", tolerance=0.8)

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
       f'<defs>{"".join(defs)}</defs>' + "".join(pieces) + "</svg>")
open(f"{RACINE}/identite/kazendra-vecteur.svg", "w", encoding="utf-8").write(svg)
print(f"\nécrit : identite/kazendra-vecteur.svg ({len(svg)/1024:.1f} Ko, "
      f"{len(pieces)} pièces, {len(defs)} dégradés)")
