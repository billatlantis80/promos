#!/usr/bin/env python3
"""Départage définitif : une clé est-elle citée comme LITTÉRAL À PART ENTIÈRE ?

`grep -F` sur-déclare : « {n} offre » est un fragment de « {n} offres », et
« Créer un compte » un fragment de « Créer mon compte » — deux clés mortes
sauvées à tort. On exige donc que la clé apparaisse ENCADRÉE de guillemets
(droits, simples ou doubles, ou en valeur d'attribut data-i18n), ce qui est la
forme de tout littéral du code. Un fragment de phrase plus longue ne passe plus.

Critère final : MORTE = jamais atteinte à l'exécution ET jamais littérale.
"""
import json
import os
import re

RACINE = '/opt/data/webdev/projects/promos'
DICO = os.path.join(RACINE, 'public/langues.js')

bilan = json.load(open('/tmp/t9n-bilan.json'))
jamais = bilan['jamais']

# Tous les fichiers de code applicatif. On exclut `docs/` (copie générée par le
# collecteur) et TOUTE copie du dictionnaire — sinon `docs/langues.js`, qui est
# le dictionnaire lui-même, « cite » évidemment toutes ses propres clés.
fichiers = []
for base in [os.path.join(RACINE, 'public')]:
    for dossier, _, noms in os.walk(base):
        if any(x in dossier for x in ('node_modules', 'fonts', '/.git')):
            continue
        for n in noms:
            if not n.endswith(('.js', '.mjs', '.html', '.css')):
                continue
            if n == 'langues.js':
                continue
            fichiers.append(os.path.join(dossier, n))
fichiers.append(os.path.join(RACINE, 'server.js'))

sources = {}
for f in fichiers:
    try:
        sources[f] = open(f, encoding='utf-8').read()
    except Exception:
        pass
print(f'fichiers de code balayés : {len(sources)} (dictionnaire et tests exclus)')

# Variantes d'apostrophe : le code peut écrire l'une, le dictionnaire l'autre.
def variantes(s):
    return {s, s.replace("'", '\u2019'), s.replace('\u2019', "'"),
            s.replace('\\u2019', "'")}


def litteral(cle):
    """La clé apparaît-elle encadrée de guillemets (ou en valeur d'attribut) ?"""
    for v in variantes(cle):
        for guillemet in ("'", '"', '`'):
            motif = guillemet + v + guillemet
            for f, texte in sources.items():
                if motif in texte:
                    return os.path.relpath(f, RACINE)
    # attribut HTML : data-i18n='…' ou data-i18n="…"
    for v in variantes(cle):
        for f, texte in sources.items():
            if re.search(r'data-i18n[a-z-]*\s*=\s*[\'"]' + re.escape(v) + r'[\'"]',
                         texte):
                return os.path.relpath(f, RACINE)
    return None


mortes, vivantes = [], []
for cle in jamais:
    ou = litteral(cle)
    (vivantes if ou else mortes).append((cle, ou))

print(f'\n=== CITÉES EN LITTÉRAL (donc VIVANTES, états non déclenchés) : {len(vivantes)} ===')
for cle, ou in sorted(vivantes):
    print(f'  {ou:<24} « {cle} »')

print(f'\n=== MORTES — jamais atteintes ET jamais littérales : {len(mortes)} ===')
for cle, _ in sorted(mortes):
    print(f'  « {cle} »')

json.dump([c for c, _ in mortes], open('/tmp/t9n-mortes.json', 'w'),
          ensure_ascii=False, indent=1)
