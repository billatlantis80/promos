#!/usr/bin/env python3
"""Parmi les clés déclarées mortes, lesquelles sont en réalité MAL CÂBLÉES ?

Une clé peut être absente de tout littéral parce que le code écrit le même texte
EN CLAIR (littéral de gabarit, affectation directe) au lieu de passer par t().
Dans ce cas, supprimer la clé fait disparaître une traduction qui devrait
servir : c'est le câblage qu'il faut corriger, pas le dictionnaire.

On cherche donc, pour chaque clé morte, un fragment distinctif de son texte
dans le code, en ignorant guillemets et espaces.
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
sources = {os.path.relpath(f, RACINE): open(f, encoding='utf-8').read() for f in fichiers}

mortes = json.load(open('/tmp/t9n-decision.json'))['mortes']


def aplatir(s):
    """Retire tout ce qui n'est ni lettre ni chiffre : insensible aux
    guillemets, aux espaces, aux balises et aux apostrophes."""
    return re.sub(r'[^0-9a-zA-Z\u00c0-\u024f]+', '', s)


plats = {f: aplatir(t) for f, t in sources.items()}

mal_cablees, orphelines = [], []
for cle in mortes:
    # Fragment distinctif : on coupe sur les variables {…} et on prend le plus
    # long morceau, puis ses 34 premiers caractères utiles.
    morceaux = [m for m in re.split(r'\{[a-z]+\}', cle, flags=re.I)]
    morceaux.sort(key=len, reverse=True)
    frag = aplatir(morceaux[0])[:34] if morceaux else ''
    trouve = []
    if len(frag) >= 12:
        for f, plat in plats.items():
            if frag in plat:
                trouve.append(f)
    (mal_cablees if trouve else orphelines).append((cle, frag, trouve))

print(f'=== MAL CÂBLÉES : le texte existe dans le code, hors t() — à corriger ({len(mal_cablees)}) ===')
for cle, frag, ou in mal_cablees:
    print(f'  « {cle} »')
    print(f'      fragment « {frag} » trouvé dans : {", ".join(ou)}')

print(f'\n=== ORPHELINES : le texte n’existe nulle part — à supprimer ({len(orphelines)}) ===')
for cle, frag, _ in orphelines:
    print(f'  « {cle} »')

json.dump({'a_corriger': [c for c, _, _ in mal_cablees],
           'a_supprimer': [c for c, _, _ in orphelines]},
          open('/tmp/t9n-plan.json', 'w'), ensure_ascii=False, indent=1)
