"""Contre-epreuve : on reintroduit des defauts et on verifie que les tests
les attrapent.

IMPORTANT — le 07/10/2026, cette contre-epreuve a pollue le SITE PUBLIE.
Le cron « Collecte » copie public/ vers docs/ puis commite, toutes les
5 minutes. Une mutation en cours a donc ete photographiee et publiee :
le site a servi `align-items: center` au lieu de `flex-start` pendant
quelques minutes. On travaille desormais sur une COPIE du projet, dans
/tmp : plus aucun cron ne peut voir un fichier mutile.
"""
import glob
import os
import re
import shutil
import subprocess

SOURCE = '/opt/data/webdev/projects/promos'
BANC = '/tmp/kaz2/banc'
PUB = f'{BANC}/public'
TESTS = sorted(glob.glob(f'{BANC}/tests/*.test.mjs'))
FICHIERS = [f'{PUB}/app.css', f'{PUB}/app.js', f'{PUB}/langues.js', f'{PUB}/index.html']

if os.path.isdir(BANC):
    shutil.rmtree(BANC)
shutil.copytree(SOURCE, BANC,
                ignore=shutil.ignore_patterns('.git', 'node_modules'))
print(f'banc d essai : {BANC} (copie du projet, les fichiers reels ne sont pas touches)')

SAUV = {f: f + '.sauv' for f in FICHIERS}


def lance():
    r = subprocess.run(['node', '--test'] + TESTS, cwd=BANC,
                       capture_output=True, text=True)
    m = re.search(r'# pass (\d+)\n# fail (\d+)', r.stdout)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


def remplace(avant, apres):
    return lambda t: t.replace(avant, apres, 1)


def inverse_colonnes(t):
    """Echange les deux classes de colonnes : les icones repassent a gauche."""
    return (t.replace('class="col-envoi"', 'class="col-TMP"', 1)
             .replace('class="col-icones"', 'class="col-envoi"', 1)
             .replace('class="col-TMP"', 'class="col-icones"', 1))


for f in FICHIERS:
    shutil.copy(f, SAUV[f])

base = lance()
print(f'etat initial : {base[0]} reussis, {base[1]} echoues\n')

essais = [
    ('css', 'icones desalignees (flex-start -> center)',
     f'{PUB}/app.css',
     remplace('align-items: flex-start; gap: 8px; }',
              'align-items: center; gap: 8px; }')),
    ('js', 'les icones repassent a GAUCHE du bouton',
     f'{PUB}/app.js', inverse_colonnes),
    ('js', 'la mise a jour remonte HORS du bloc de redirection',
     f'{PUB}/app.js',
     remplace('''          <span class="quand">${quand}</span>
        </div>''',
              '''        </div>
        <span class="quand">${quand}</span>''')),
    ('css', 'le menu de partage s ancre du mauvais cote',
     f'{PUB}/app.css',
     remplace('position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 6;',
              'position: absolute; left: 0; bottom: calc(100% + 6px); z-index: 6;')),
    ('langues', 'une traduction de l accroche disparait',
     f'{PUB}/langues.js',
     remplace("  'Les meilleures promotions': 'De bästa erbjudandena',\n", '')),
    ('index', 'le mot entier ne porte plus le degrade',
     f'{PUB}/index.html',
     remplace('<b class="marque-nom">KAZENDRA</b>',
              '<b class="marque-nom"><span class="k-mot">K</span>AZENDRA</b>')),
    ('css', 'le degrade du mot repasse en diagonale',
     f'{PUB}/app.css',
     remplace('linear-gradient(90deg, var(--mot-deg-1)',
              'linear-gradient(135deg, var(--mot-deg-1)')),
]

rates = 0
for quoi, desc, fichier, transforme in essais:
    t = open(fichier).read()
    neuf = transforme(t)
    if neuf == t:
        print(f'{quoi:8s} {desc:46s} -> !! ANCRE INTROUVABLE')
        rates += 1
        continue
    open(fichier, 'w').write(neuf)
    p, f_ = lance()
    attrape = bool(f_ and f_ > 0)
    rates += 0 if attrape else 1
    print(f'{quoi:8s} {desc:46s} -> {"ATTRAPE" if attrape else "*** RATE ***"} ({f_} en echec)')
    shutil.copy(SAUV[fichier], fichier)

fin = lance()
print(f'\napres restauration du banc : {fin[0]} reussis, {fin[1]} echoues')
print(f'defauts rates : {rates}')

# controle : le projet reel n'a pas bouge d'un octet
import hashlib
identiques = all(
    hashlib.sha256(open(f, 'rb').read()).digest()
    == hashlib.sha256(open(f.replace(BANC, SOURCE), 'rb').read()).digest()
    for f in FICHIERS)
print(f'projet reel intact : {identiques}')
