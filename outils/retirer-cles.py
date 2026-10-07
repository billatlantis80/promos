#!/usr/bin/env python3
"""Retire du dictionnaire des clés devenues mortes — liste fournie en argument.

Même discipline que `retirer-cles-mortes.py`, mais la liste vient de l'extérieur,
parce que le ménage des traductions n'est pas un événement unique : dès qu'un
écran cesse d'afficher une phrase, sa clé devient morte ET le test
`tests/traductions-vivantes.test.mjs` le dira. Ce script rend le nettoyage
mécanique au lieu d'improviser un script à chaque fois.

Usage :
    python3 outils/retirer-cles.py /tmp/cles.txt            # essai à blanc
    python3 outils/retirer-cles.py /tmp/cles.txt --appliquer

Le fichier porte une clé par ligne (le texte français exact).
Sûreté : chaque clé doit être portée par les 9 langues ; une ligne qui ne finit
pas par une virgule (valeur sur plusieurs lignes) fait tout refuser plutôt que
d'emporter la suite avec elle.
"""
import re
import shutil
import sys

DICO = '/opt/data/webdev/projects/promos/public/langues.js'
LANGUES = 9

if len(sys.argv) < 2:
    sys.exit(__doc__)
FICHIER = sys.argv[1]
APPLIQUER = '--appliquer' in sys.argv

CLES = [l.rstrip('\n') for l in open(FICHIER, encoding='utf-8')
        if l.strip() and not l.startswith('#')]
if not CLES:
    sys.exit('aucune clé à retirer')


def norm(s):
    return (s.replace('\u2019', "'").replace('\u2018', "'")
             .replace('\\"', '"').replace("\\'", "'").strip())


ATTENDUES = {norm(c): c for c in CLES}
if len(ATTENDUES) != len(CLES):
    sys.exit('deux clés se confondent après normalisation')

lignes = open(DICO, encoding='utf-8').read().split('\n')
compte = {c: 0 for c in CLES}
gardees, anomalies = [], []

for i, ligne in enumerate(lignes, 1):
    m = re.match(r"""^\s*(?:'([^']*(?:\\'[^']*)*)'|"([^"]*(?:\\"[^"]*)*)")\s*:\s*""", ligne)
    if m:
        brut = m.group(1) if m.group(1) is not None else m.group(2)
        cle = norm(brut)
        if cle in ATTENDUES:
            if not ligne.rstrip().endswith(','):
                anomalies.append(f'ligne {i} : ne finit pas par une virgule — {ligne[:80]}')
                gardees.append(ligne)
            else:
                compte[ATTENDUES[cle]] += 1
            continue
    gardees.append(ligne)

if anomalies:
    print('ANOMALIES — rien n’est écrit :')
    for a in anomalies:
        print(' ', a)
    sys.exit(1)

manquantes = [c for c, n in compte.items() if n != LANGUES]
if manquantes:
    print(f'CLÉS PORTÉES PAR UN NOMBRE DE LANGUE INCORRECT (attendu {LANGUES}) :')
    for c in manquantes:
        print(f'  {compte[c]} × « {c} »')
    sys.exit(1)

print(f'clés à retirer : {len(CLES)}')
for c in CLES:
    print(f'  {LANGUES} × « {c} »')
print(f'\nlignes avant : {len(lignes)}  →  après : {len(gardees)}  '
      f'(retirées : {len(lignes) - len(gardees)})')

if APPLIQUER:
    shutil.copy(DICO, '/tmp/langues.js.avant-retrait')
    open(DICO, 'w', encoding='utf-8').write('\n'.join(gardees))
    print('écrit. Sauvegarde : /tmp/langues.js.avant-retrait')
else:
    print('(essai à blanc — relancer avec --appliquer)')
