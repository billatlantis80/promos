"""Vectorise le mot KAZENDRA (v2 : separe les lettres collees) et met le
degrade du logo sur la lettre K."""
import numpy as np
from PIL import Image
from skimage import measure, morphology
from scipy import ndimage as ndi

SRC = '/opt/data/image_cache/img_5f6f9b5b939a.jpg'
full = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)

zone = full[360:450, 200:800]
ys, xs = np.where(zone.min(axis=2) < 200)
Y0, Y1 = 360 + ys.min(), 360 + ys.max()
X0, X1 = 200 + xs.min(), 200 + xs.max()
MW = 8
W, H = X1 - X0 + 1, Y1 - Y0 + 1
print(f'mot : {W} x {H}  (coin {X0},{Y0})')

a = full[Y0 - MW:Y1 + MW + 1, X0 - MW:X1 + MW + 1]
nw = a.min(axis=2)
encre = nw < 190

# couleur du mot
coeur = morphology.erosion(encre, morphology.disk(3))
med = np.median(a[coeur], axis=0)
navy = '#%02X%02X%02X' % tuple(int(v) for v in med)
print(f'couleur du mot : {navy}')

# ---- separation : eroder pour casser les ponts, puis rattacher chaque pixel ----
SEP = 2
germe = morphology.erosion(encre, morphology.disk(SEP))
lab, n = ndi.label(germe)
print(f'apres erosion de {SEP} px : {n} germes')
if n != 8:
    for s in (1, 2, 3):
        g = morphology.erosion(encre, morphology.disk(s))
        l, k = ndi.label(g)
        print(f'  erosion {s} : {k} germes')
    SEP = 3
    germe = morphology.erosion(encre, morphology.disk(SEP))
    lab, n = ndi.label(germe)
    print(f'  -> retenu erosion {SEP} : {n} germes')

ind = ndi.distance_transform_edt(lab == 0, return_distances=False, return_indices=True)
lab_full = lab[tuple(ind)]
lab_full[~encre] = 0

lettres = []
for i in range(1, lab_full.max() + 1):
    m = morphology.remove_small_objects(lab_full == i, 50)
    if m.sum() < 50:
        continue
    yy, xx = np.where(m)
    lettres.append((xx.min(), xx.max() - xx.min() + 1, m))
lettres.sort()
print(f'\n{len(lettres)} lettres :')
for j, (xm, larg, m) in enumerate(lettres):
    print(f'  {j+1} : x {xm:3d}..{xm+larg-1:3d}  largeur {larg:3d}  {m.sum():5d} px')

def chemin(masque, tol=0.35):
    f = ndi.gaussian_filter(masque.astype(float), 0.6)
    parts = []
    for c in measure.find_contours(f, 0.5):
        c = measure.approximate_polygon(c, tolerance=tol)
        if len(c) < 4:
            continue
        pts = [(col - MW, row - MW) for row, col in c]
        parts.append('M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) + 'Z')
    return ''.join(parts)

# ---- degrade de la lettre K, repris du K du logo ----
kx0 = lettres[0][0] - MW
kx1 = lettres[0][0] + lettres[0][1] - 1 - MW
p1 = (kx0, H - 1)              # bas-gauche : bleu fonce
p2 = (kx1, 0)                  # haut-droite : vert
STOPS = [(0.00, '#1F4473'), (0.22, '#2A5C81'), (0.44, '#357B93'),
         (0.66, '#459299'), (0.86, '#52A794'), (1.00, '#5FB290')]

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">',
       '  <!-- Le mot KAZENDRA, vectorise depuis le logotype fourni par B.',
       '       Sa lettre K porte le meme degrade que le K du logo',
       '       (bleu fonce en bas a gauche -> vert en haut a droite). -->',
       '  <defs>',
       f'    <linearGradient id="gKmot" gradientUnits="userSpaceOnUse" '
       f'x1="{p1[0]:.1f}" y1="{p1[1]}" x2="{p2[0]:.1f}" y2="{p2[1]}">']
for off, col in STOPS:
    svg.append(f'      <stop offset="{off}" stop-color="{col}"/>')
svg += ['    </linearGradient>', '  </defs>']
for j, (xm, larg, m) in enumerate(lettres):
    svg.append(f'  <path d="{chemin(m)}" fill="{"url(#gKmot)" if j == 0 else navy}"'
               ' fill-rule="evenodd"/>')
svg.append('</svg>')
txt = '\n'.join(svg)
open('/tmp/kaz2/mot.svg', 'w').write(txt)
print(f'\nmot.svg ecrit : {len(txt)} octets, {len(lettres)} lettres')
