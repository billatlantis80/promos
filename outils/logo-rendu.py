"""Rend le logotype vectoriel, le compare a la source et exporte des PNG."""
import subprocess
import sys

SVG = '/tmp/kaz2/logo-kazendra.svg'
SRC = '/opt/data/image_cache/img_5f6f9b5b939a.jpg'
VB = (264, 113, 488, 367)

# --- rendu + export, tous deux via Chromium ---
code = f'''
from playwright.sync_api import sync_playwright
svg = open("{SVG}").read()
tailles = [(488, 367, "/tmp/kaz2/rendu-lockup.png", False),
           (512, 384, "/tmp/kaz2/logo-kazendra-512.png", True),
           (1024, 768, "/tmp/kaz2/logo-kazendra-1024.png", True),
           (2048, 1536, "/tmp/kaz2/logo-kazendra-2048.png", True)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h, chemin, transparent in tailles:
        pg = b.new_page(viewport={{"width": w, "height": h}}, device_scale_factor=1)
        fond = "transparent" if transparent else "#fff"
        pg.set_content('<!doctype html><meta charset="utf-8"><style>'
                       'html,body{{margin:0;background:' + fond + '}}'
                       'svg{{display:block;width:' + str(w) + 'px;height:' + str(h) + 'px}}</style>'
                       + svg)
        pg.wait_for_timeout(400)
        pg.screenshot(path=chemin, omit_background=transparent,
                      clip={{"x": 0, "y": 0, "width": w, "height": h}})
        pg.close()
    b.close()
print("rendus ecrits")
'''
subprocess.run(['/opt/data/capture/venv/bin/python', '-c', code], check=True,
               env={'PLAYWRIGHT_BROWSERS_PATH': '/opt/data/capture/browsers',
                    'PATH': '/usr/bin:/bin'})

# --- comparaison avec la source ---
import numpy as np
from PIL import Image
ref = Image.open(SRC).convert('RGB').crop((VB[0], VB[1], VB[0] + VB[2], VB[1] + VB[3]))
ren = Image.open('/tmp/kaz2/rendu-lockup.png').convert('RGB')
A = np.asarray(ref).astype(float)
B = np.asarray(ren).astype(float)
encre = np.asarray(ref).min(axis=2) < 245
e = np.abs(A - B).mean(axis=2)
print(f'rendu {ren.size} contre source {ref.size}')
print(f'  ecart moyen, tout           : {e.mean():5.2f}')
print(f'  ecart moyen, sur l encre    : {e[encre].mean():5.2f}')
print(f'  pixels a plus de 60 d ecart : {100 * (e > 60).mean():5.2f} %')

cote = Image.new('RGB', (VB[2] * 2 + 16, VB[3]), 'white')
cote.paste(ref, (0, 0))
cote.paste(ren, (VB[2] + 16, 0))
cote.save('/tmp/kaz2/lockup-compare.png')
print('lockup-compare.png : source | mon SVG')
