#!/usr/bin/env python3
"""Classe chaque citation d'une clé : dans un appel t(), dans un attribut
data-i18n, ou NU (chaîne écrite en clair, donc jamais traduite).

Trois issues, trois décisions différentes :
  * appelée par t() ou data-i18n  → VIVANTE
  * écrite nue, jamais appelée    → DÉFAUT : le texte s'affichera en français
                                    dans toutes les langues ; on ajoute le t()
  * absente partout               → MORTE : on supprime la clé
"""
import json
import os
import re

RACINE = '/opt/data/webdev/projects/promos'
fichiers = []
for dossier, _, noms in os.walk(os.path.join(RACINE, 'public')):
    if any(x in dossier for x in ('node_modules', 'fonts', '/.git')):
        continue
    for n in noms:
        if n.endswith(('.js', '.mjs', '.html', '.css')) and n != 'langues.js':
            fichiers.append(os.path.join(dossier, n))
fichiers.append(os.path.join(RACINE, 'server.js'))

sources = {os.path.relpath(f, RACINE): open(f, encoding='utf-8').read()
           for f in fichiers}

inv = json.load(open('/tmp/inventaire-t9n.json'))
toutes = sorted({v['cle'] for v in inv['vivantes']} | set(inv['mortes'])
                | {d['cle'] for d in inv['douteuses']})


def variantes(s):
    return {s, s.replace("'", '\u2019'), s.replace('\u2019', "'")}


APPEL = re.compile(r't\(\s*$')
ATTR = re.compile(r'data-i18n[a-z-]*\s*=\s*$')


def classer(cle):
    """Renvoie la liste des citations : (fichier, ligne, nature)."""
    out = []
    for v in variantes(cle):
        for g in ("'", '"', '`'):
            motif = g + v + g
            for f, texte in sources.items():
                debut = 0
                while True:
                    i = texte.find(motif, debut)
                    if i < 0:
                        break
                    debut = i + 1
                    avant = texte[max(0, i - 40):i]
                    ligne = texte[:i].count('\n') + 1
                    if APPEL.search(avant.split('\n')[-1]):
                        nature = 't()'
                    elif ATTR.search(avant.split('\n')[-1]):
                        nature = 'data-i18n'
                    else:
                        nature = 'NU'
                    out.append((f, ligne, nature))
    return out


vues = json.load(open('/tmp/t9n-vues.json'))
atteintes = set()
for cles in vues.values():
    atteintes |= set(cles)

mortes, nues, vivantes = [], [], []
for cle in toutes:
    cites = classer(cle)
    natures = {c[2] for c in cites}
    if not cites and cle not in atteintes:
        mortes.append(cle)
    elif natures == {'NU'}:
        nues.append((cle, cites))
    else:
        vivantes.append((cle, cites))

print(f'clés au dictionnaire : {len(toutes)}')
print(f'  VIVANTES (t() ou data-i18n) : {len(vivantes)}')
print(f'  ÉCRITES NUES (défaut)       : {len(nues)}')
print(f'  MORTES (absentes partout)   : {len(mortes)}')

print('\n--- ÉCRITES NUES : le texte s’affichera en français quelle que soit la langue ---')
for cle, cites in nues:
    for f, l, _ in cites:
        print(f'  {f}:{l}  « {cle} »')

print('\n--- MORTES ---')
for cle in mortes:
    print(f'  « {cle} »')

json.dump({'mortes': mortes, 'nues': [c for c, _ in nues]},
          open('/tmp/t9n-decision.json', 'w'), ensure_ascii=False, indent=1)
