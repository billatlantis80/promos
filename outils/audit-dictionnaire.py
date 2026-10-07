#!/usr/bin/env python3
"""Audit complet du dictionnaire : pour CHAQUE clé, trois faits mesurés.

  atteinte  : l'interface l'a réellement demandée (sonde d'exécution)
  littérale : elle existe comme littéral à part entière dans le code
  ligne     : la ligne exacte qui la cite (preuve, pas déduction)

Une clé morte est une clé que l'interface n'atteint JAMAIS et qui n'existe nulle
part comme littéral. C'est la seule combinaison qui autorise la suppression :
les 28 clés déjà atteintes mais non littérales (appelées par variable) et les
clés littérales non atteintes (états non déclenchés) sont VIVANTES.
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

sources = {}
for f in fichiers:
    try:
        sources[os.path.relpath(f, RACINE)] = open(f, encoding='utf-8').read()
    except Exception:
        pass


def variantes(s):
    return {s, s.replace("'", '\u2019'), s.replace('\u2019', "'"),
            s.replace('\\u2019', "'"), s.replace('"', '\\"')}


def trouver(cle):
    """Renvoie (fichier, n° de ligne, ligne) du premier littéral encadré."""
    for v in variantes(cle):
        for g in ("'", '"', '`'):
            motif = g + v + g
            for f, texte in sources.items():
                if motif in texte:
                    for i, ligne in enumerate(texte.split('\n'), 1):
                        if motif in ligne:
                            return f, i, ligne.strip()
    for v in variantes(cle):
        motif = re.compile(r'data-i18n[a-z-]*\s*=\s*[\'"]' + re.escape(v) + r'[\'"]')
        for f, texte in sources.items():
            for i, ligne in enumerate(texte.split('\n'), 1):
                if motif.search(ligne):
                    return f, i, ligne.strip()
    return None


vues = json.load(open('/tmp/t9n-vues.json'))
atteintes = set()
for cles in vues.values():
    atteintes |= set(cles)

import importlib.util  # noqa: E402

# Les clés du dictionnaire, lues depuis le JSON produit par l'inventaire.
inv = json.load(open('/tmp/inventaire-t9n.json'))
toutes = sorted({v['cle'] for v in inv['vivantes']} | set(inv['mortes'])
                | {d['cle'] for d in inv['douteuses']})

lignes_mortes, res = [], []
for cle in toutes:
    a = cle in atteintes
    t = trouver(cle)
    res.append((cle, a, t))
    if not a and not t:
        lignes_mortes.append(cle)

print(f'clés au dictionnaire : {len(toutes)}')
print(f'  atteintes par l’interface          : {sum(1 for _, a, _ in res if a)}')
print(f'  présentes comme littéral           : {sum(1 for _, _, t in res if t)}')
print(f'  atteintes ET non littérales        : '
      f'{sum(1 for _, a, t in res if a and not t)}  (appelées par variable)')
print(f'  littérales mais NON atteintes      : '
      f'{sum(1 for _, a, t in res if t and not a)}  (états non déclenchés)')
print(f'  NI atteintes NI littérales = MORTES: {len(lignes_mortes)}')

print('\n--- Preuve : la ligne qui cite chaque clé littérale non atteinte ---')
for cle, a, t in res:
    if t and not a:
        print(f'  {t[0]}:{t[1]}  « {cle} »')
        print(f'      {t[2][:120]}')

json.dump({'mortes': lignes_mortes}, open('/tmp/t9n-mortes.json', 'w'),
          ensure_ascii=False, indent=1)
print('\n--- MORTES ---')
for cle in lignes_mortes:
    print(f'  « {cle} »')
