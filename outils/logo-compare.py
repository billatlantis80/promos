"""Compare le rendu du SVG avec la source, pixel par pixel."""
import numpy as np
from PIL import Image

SRC = '/opt/data/image_cache/img_5f6f9b5b939a.jpg'
CROP = (399, 113, 628, 346)
W, H = CROP[2] - CROP[0], CROP[3] - CROP[1]

ref = Image.open(SRC).convert('RGB').crop(CROP)
ren = Image.open('/tmp/kaz2/rendu.png').convert('RGB')
if ren.size != (W, H):
    print(f'!! rendu {ren.size} au lieu de {(W,H)}')
    ren = ren.crop((0, 0, W, H))

A = np.asarray(ref).astype(float)
B = np.asarray(ren).astype(float)
nw = np.asarray(ref).min(axis=2)
masque = nw < 250

for nom, m in (('toute l image', np.ones_like(masque, bool)),
               ('interieur pastille', masque)):
    e = np.abs(A - B).mean(axis=2)[m]
    print(f'{nom:20s} : ecart moyen {e.mean():5.1f}  p95 {np.percentile(e,95):6.1f}  '
          f'max {e.max():5.1f}  >30 : {100*(e>30).mean():5.2f} %')

diff = np.abs(A - B).mean(axis=2)
print('\n--- ecart moyen par bande de 25 lignes ---')
for i in range(0, H, 25):
    band = diff[i:i + 25][masque[i:i + 25]]
    if band.size:
        print(f'  y {i:3d}-{min(i+24,H-1):3d} : {band.mean():6.1f}')

cote = Image.new('RGB', (W * 3 + 20, H), 'white')
cote.paste(ref, (0, 0))
cote.paste(ren, (W + 10, 0))
cote.paste(Image.fromarray(np.stack([np.clip(diff * 3, 0, 255).astype(np.uint8)] * 3, -1)),
           (W * 2 + 20, 0))
cote.resize((cote.width * 2, cote.height * 2), Image.NEAREST).save('/tmp/kaz2/comparaison.png')
print('\ncomparaison.png : source | rendu SVG | ecart x3')
