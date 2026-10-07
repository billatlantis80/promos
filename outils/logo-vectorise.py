"""Construit le SVG vectoriel du logo Kazendra (icone) depuis l'image fournie."""
import math
import numpy as np
from PIL import Image
from skimage import measure, morphology
from scipy import ndimage as ndi

SRC = '/opt/data/image_cache/img_5f6f9b5b939a.jpg'
X0, Y0, X1, Y1 = 399, 113, 628, 346
MW = 10
WX0, WY0 = X0 - MW, Y0 - MW

full = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)
a = full[WY0:Y1 + MW, WX0:X1 + MW]
H, W = a.shape[:2]
nw = a.min(axis=2)
ink = nw < 238
blanc = nw > 238

# ---------- masques ----------
pastille = ndi.binary_fill_holes(ink)
k_sil = ndi.binary_fill_holes(blanc & pastille)
k_sil = ndi.binary_fill_holes(morphology.closing(k_sil, morphology.disk(2)))
k_rempl = k_sil & ~blanc

lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
# interieur du K, a distance du liseré blanc
interieur = morphology.erosion(k_sil, morphology.disk(5)) & k_rempl
flou = ndi.gaussian_filter(lum, 3.0)
crete = ((lum - flou) > 4.5) & interieur
crete = morphology.remove_small_objects(crete, 9)
crete = morphology.closing(crete, morphology.disk(1))
print(f'pistes : {crete.sum()} px  ({100*crete.sum()/interieur.sum():.1f} % de l interieur du K)')

# ---------- degrades ----------
def fit(masque):
    ys, xs = np.where(masque)
    A = np.stack([xs.astype(float), ys.astype(float), np.ones(len(xs))], 1)
    co, errs = [], []
    for c in range(3):
        v = a[:, :, c][masque].astype(float)
        k, *_ = np.linalg.lstsq(A, v, rcond=None)
        co.append(k)
        errs.append(np.abs(A @ k - v).mean())
    gx = float(np.mean([c[0] for c in co])); gy = float(np.mean([c[1] for c in co]))
    return gx, gy, errs

def stops(masque, gx, gy, n):
    norme = math.hypot(gx, gy); ux, uy = gx / norme, gy / norme
    ys, xs = np.where(masque)
    t = xs * ux + ys * uy
    bords = np.linspace(t.min(), t.max(), n + 1)
    out = []
    for i in range(n):
        sel = (t >= bords[i]) & ((t < bords[i + 1]) if i < n - 1 else (t <= bords[i + 1]))
        if sel.sum() < 40:
            continue
        px = a[np.where(masque)[0][sel], np.where(masque)[1][sel]]
        med = np.median(px, axis=0)
        out.append(((bords[i] + bords[i + 1]) / 2, med))
    return out, (ux, uy), (float(t.min()), float(t.max()))

fond = morphology.erosion(pastille & ~k_sil, morphology.disk(4))
gxf, gyf, ef = fit(fond)
sf, uf, tf = stops(fond, gxf, gyf, 10)
print(f'fond : {len(sf)} stops, erreur {np.mean(ef):.2f}')

gxk, gyk, ek = fit(interieur & ~crete)
sk, uk, tk = stops(interieur & ~crete, gxk, gyk, 16)
print(f'K    : {len(sk)} stops, erreur {np.mean(ek):.2f}')

# couleur des pistes : rapport median avec le remplissage local
ys, xs = np.where(crete)
fill_est = np.array([
    np.interp(xs[j], [p[0] for p in sk], [p[1][c] for p in sk]) for j in range(0)]) # placeholder
# plus simple : comparer la couleur des pistes a la couleur mediane des stops au meme t
def coul_axe(sts, u, x, y):
    t = x * u[0] + y * u[1]
    ts = np.array([p[0] for p in sts]); cs = np.array([p[1] for p in sts])
    return np.array([np.interp(t, ts, cs[:, c]) for c in range(3)])
tc = np.array([coul_axe(sk, uk, xs[j], ys[j]) for j in range(len(xs))])
pc = a[ys, xs].astype(float)
ratio = np.median(pc / np.maximum(tc, 1), axis=0)
print(f'rapport median piste/remplissage : R {ratio[0]:.2f}  V {ratio[1]:.2f}  B {ratio[2]:.2f}')
alpha = float(np.clip(np.mean(ratio) - 1, 0, 1)) / (2.0 - np.mean(ratio) - 1 + 1e-9)
print(f'  -> facteur de blanchiment estime : {alpha:.2f}')

# ---------- contours -> chemin SVG ----------
def chemin(masque, tol=0.5, dec=(-MW, -MW)):
    """masque binaire -> 'd' SVG, coordonnees ramenees dans le repere de la pastille."""
    f = masque.astype(float)
    f = ndi.gaussian_filter(f, 0.7)
    cs = measure.find_contours(f, 0.5)
    parts = []
    npt = 0
    for c in cs:
        c = measure.approximate_polygon(c, tolerance=tol)
        if len(c) < 4:
            continue
        pts = [(col + dec[0], row + dec[1]) for row, col in c]
        npt += len(pts)
        parts.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z')
    return ''.join(parts), npt

d_sq, n1 = chemin(pastille)
d_k, n2 = chemin(k_sil)
d_r, n3 = chemin(k_rempl)
d_p, n4 = chemin(crete)
print(f'\npoints : pastille {n1}  K blanc {n2}  remplissage {n3}  pistes {n4}')

# ---------- gradient SVG ----------
def gradient(id_, sts, u, tmin, tmax, alpha=0.0):
    p1 = (u[0] * tmin, u[1] * tmin); p2 = (u[0] * tmax, u[1] * tmax)
    s = [f'<linearGradient id="{id_}" gradientUnits="userSpaceOnUse" '
         f'x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}">']
    for t, col in sts:
        off = (t - tmin) / (tmax - tmin)
        c = np.clip(col * (1 - alpha) + 255 * alpha, 0, 255).astype(int)
        s.append(f'<stop offset="{off:.4f}" stop-color="#{c[0]:02X}{c[1]:02X}{c[2]:02X}"/>')
    s.append('</linearGradient>')
    return ''.join(s), p1, p2

g_fond, _, _ = gradient('gFond', sf, uf, tf[0], tf[1])
g_k, _, _ = gradient('gK', sk, uk, tk[0], tk[1])
g_p, _, _ = gradient('gPistes', sk, uk, tk[0], tk[1], alpha=0.40)

vb = (0, 0, 229, 233)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}">
  <!-- Logo Kazendra — vectorise depuis le logotype fourni par B (07/10/2026).
       Le carré arrondi, la lettre K détourée en blanc et son dégradé bleu->vert
       sont mesurés sur la source, pas redessinés à l'œil. -->
  <defs>
    {g_fond}
    {g_k}
    {g_p}
  </defs>
  <path d="{d_sq}" fill="url(#gFond)"/>
  <path d="{d_k}" fill="#FFFFFF" fill-rule="evenodd"/>
  <path d="{d_r}" fill="url(#gK)" fill-rule="evenodd"/>
  <path d="{d_p}" fill="url(#gPistes)" fill-rule="evenodd"/>
</svg>
'''
open('/tmp/kaz2/logo.svg', 'w').write(svg)
print(f'\nlogo.svg ecrit : {len(svg)} octets')

np.savez('/tmp/kaz2/trace.npz', pastille=pastille, k_sil=k_sil,
         k_rempl=k_rempl, crete=crete)
