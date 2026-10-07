"""Assemble le logotype Kazendra complet en vectoriel.

Icône + mot + accroche, tous en TRACÉS (aucune police requise).
Les dégradés de l'icône sont repris tels quels du fichier déjà mesuré ;
celui du mot est refait à l'horizontale, de gauche à droite.
"""
import re
import numpy as np
from PIL import Image
from skimage import measure, morphology
from scipy import ndimage as ndi

SRC = '/opt/data/image_cache/img_5f6f9b5b939a.jpg'
full = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)

IC_ORIG = (399, 113)          # origine de l'icône dans la source
MO_ORIG = (267, 377)          # origine du mot
ZONE = (250, 440, 770, 490)   # fenêtre de l'accroche (x0, y0, x1, y1)
VB = (264, 113, 488, 367)     # boîte englobante du logotype complet


def trace(masque, zx, zy, tol=0.35):
    """Contours -> 'd' SVG, en coordonnées ABSOLUES de l'image source."""
    f = ndi.gaussian_filter(masque.astype(float), 0.6)
    parts = []
    for c in measure.find_contours(f, 0.5):
        c = measure.approximate_polygon(c, tolerance=tol)
        if len(c) < 4:
            continue
        pts = [(col + zx, row + zy) for row, col in c]
        parts.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z')
    return ''.join(parts)


# ---------- 1. l'accroche ----------
x0, y0, x1, y1 = ZONE
zone = full[y0:y1, x0:x1]
encre = zone.min(axis=2) < 200
ys, xs = np.where(encre)
print(f'accroche : boite absolue x {x0+xs.min()}..{x0+xs.max()}  y {y0+ys.min()}..{y0+ys.max()}')
coeur = morphology.erosion(encre, morphology.disk(2))
col = np.median(zone[coeur], axis=0)
ACCROCHE_COUL = '#%02X%02X%02X' % tuple(int(v) for v in col)
print(f'accroche : couleur {ACCROCHE_COUL}  ({coeur.sum()} px de coeur)')

lab, n = ndi.label(encre)
tailles = ndi.sum(encre, lab, range(1, n + 1))
gardees = np.isin(lab, [i + 1 for i, t in enumerate(tailles) if t > 25])
print(f'accroche : {len([t for t in tailles if t > 25])} lettres sur {n} composantes')
d_accroche = trace(gardees, x0, y0, tol=0.3)

# ---------- 2. les morceaux déjà tracés ----------
src_icone = open('/tmp/kaz2/logo.svg').read()
src_mot = open('/tmp/kaz2/mot.svg').read()
icone_paths = re.findall(r'<path d="([^"]+)"', src_icone)
mot_paths = re.findall(r'<path d="([^"]+)"', src_mot)
defs_icone = re.search(r'<defs>[\s\S]*?</defs>', src_icone).group(0)
tube = re.search(r'<linearGradient id="gKmot"[\s\S]*?</linearGradient>', src_mot).group(0)
stops = re.findall(r'<stop offset="([\d.]+)" stop-color="(#[0-9A-F]{6})"/>', tube)
print(f'icone : {len(icone_paths)} tracés · mot : {len(mot_paths)} lettres '
      f'· dégradé du mot : {len(stops)} arrêts')

# largeur du mot, dans son repère local — sur TOUTES les lettres, pas la seule
# première : mesurée sur le K seul, elle valait 53 px au lieu de 480, et le
# dégradé se serait écrasé sur la première lettre.
xv = [float(v) for v in re.findall(r'[ML]([\d.]+) [\d.]+', ' '.join(mot_paths))]
larg_mot = max(xv)
print(f'mot : largeur locale {larg_mot:.0f}')

# ---------- 3. le SVG ----------
# Dégradé du mot : NAVY -> VERT, à l'HORIZONTALE, sur toute la largeur.
mot_grad = ('  <linearGradient id="gMot" gradientUnits="userSpaceOnUse" '
            f'x1="0" y1="0" x2="{larg_mot:.0f}" y2="0">\n'
            '    <stop offset="0" stop-color="#223A5F"/>\n'
            '    <stop offset="1" stop-color="#6AAD8F"/>\n'
            '  </linearGradient>')

lignes = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB[0]} {VB[1]} {VB[2]} {VB[3]}">',
          '  <!-- Logotype KAZENDRA — vectorisé depuis le fichier fourni par B le',
          '       07/10/2026. Tout est en TRACÉS : aucun texte, donc aucune police à',
          '       installer pour l\'ouvrir. Les dégradés sont mesurés sur la source',
          '       (moindres carrés pour le carré, médianes par tranche pour le K),',
          '       pas estimés à l\'œil. -->',
          '  <defs>']
# on reprend les dégradés de l'icône, tels que mesurés
for bloc in re.findall(r'<linearGradient[\s\S]*?</linearGradient>', defs_icone):
    lignes.append('  ' + bloc)
lignes += [mot_grad, '  </defs>']

lignes.append(f'  <!-- L\'icône : carré, K détouré en blanc, remplissage, pistes. -->')
lignes.append(f'  <g transform="translate({IC_ORIG[0]},{IC_ORIG[1]})">')
for i, d in enumerate(icone_paths):
    rempl = ['url(#gFond)', '#FFFFFF', 'url(#gK)', 'url(#gPistes)'][i]
    lignes.append(f'    <path d="{d}" fill="{rempl}" fill-rule="evenodd"/>')
lignes.append('  </g>')

lignes.append('  <!-- Le mot : TOUT le mot porte le dégradé, de GAUCHE à DROITE.')
lignes.append('       Les huit lettres le reçoivent — n\'en colorer qu\'une était') 
lignes.append('       l\'erreur de la première version. -->')
lignes.append(f'  <g transform="translate({MO_ORIG[0]},{MO_ORIG[1]})">')
for d in mot_paths:
    lignes.append(f'    <path d="{d}" fill="url(#gMot)" fill-rule="evenodd"/>')
lignes.append('  </g>')

lignes.append('  <!-- La phrase d\'accroche. -->')
lignes.append(f'  <path d="{d_accroche}" fill="{ACCROCHE_COUL}" fill-rule="evenodd"/>')
lignes.append('</svg>')

open('/tmp/kaz2/logo-kazendra.svg', 'w').write('\n'.join(lignes) + '\n')
print(f'\nlogo-kazendra.svg : {len(chr(10).join(lignes))} octets')

# ---------- 4. l'icône seule ----------
ic = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 229 233">',
      '  <!-- Icône Kazendra — vectorisée depuis le fichier fourni par B',
      '       le 07/10/2026. Tout en tracés. -->',
      '  <defs>']
ic.append(defs_icone.replace('<defs>', '').replace('</defs>', '').rstrip())
ic.append('  </defs>')
for i, d in enumerate(icone_paths):
    rempl = ['url(#gFond)', '#FFFFFF', 'url(#gK)', 'url(#gPistes)'][i]
    ic.append(f'  <path d="{d}" fill="{rempl}" fill-rule="evenodd"/>')
ic.append('</svg>')
open('/tmp/kaz2/icone-kazendra.svg', 'w').write('\n'.join(ic) + '\n')
print('icone-kazendra.svg ecrit')
