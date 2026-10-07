#!/usr/bin/env python3
"""Retire du dictionnaire les clés MORTES — mesurées, jamais atteintes.

Une clé n'est retirée que si les DEUX conditions sont réunies :
  * l'interface ne l'a jamais demandée (sonde d'exécution) ;
  * elle n'existe nulle part comme littéral à part entière dans le code.

Chaque clé doit être portée par les 9 dictionnaires : on refuse de retirer
autre chose que 9 lignes, et on refuse de retirer une ligne qui ne se termine
pas par une virgule (ce serait une valeur sur plusieurs lignes, et la suite
serait emportée avec la clé).

Usage : outils/retirer-cles-mortes.py [--appliquer]
"""
import re
import shutil
import sys

DICO = '/opt/data/webdev/projects/promos/public/langues.js'
APPLIQUER = '--appliquer' in sys.argv

MORTES = [
    '3 à 24 caractères',
    'À activer',
    'Ce lien a déjà été utilisé : ton inscription est confirmée.',
    'Compte « {n} » créé sur cet appareil.',
    'Créer un compte',
    'Déjà inscrit ? Connecte-toi',
    'Hors ligne',
    "L'identifiant d'affiliation n'est pas encore renseigné (fichier affiliation.js). "
    "Les liens sortent donc en direct, sans commission.",
    'Le serveur des promos est injoignable. La liste ci-dessous est l’instantané '
    'embarqué du {n} ; les visuels ne sont pas disponibles.',
    'Les liens vers les marchands peuvent être affiliés : l’application peut alors '
    'toucher une commission, sans changer le prix que tu paies.',
    "Nom d'utilisateur",
    'Nouveau ici ? Inscris-toi',
    'Partager',
    'Se connecter',
    'Thèmes',
    'Ton adresse e-mail',
    'Ton adresse est envoyée. Elle apparaîtra dans ta feuille : c’est elle qui fait foi.',
    'Ton inscription est confirmée. Tu recevras les bons plans.',
    '{n} offres · {m} veille',
    '≈ {a} % Amazon · {e} % enseignes & presse',
    'enseignes & presse',
]

# Les clés contiennent des apostrophes, parfois courbes dans un fichier et
# droites dans l'autre : on compare sous forme normalisée.
def norm(s):
    return (s.replace('\u2019', "'").replace('\u2018', "'")
             .replace('\\"', '"').replace("\\'", "'")
             .replace('’', "'").strip())


ATTENDUES = {norm(c) for c in MORTES}
print(f'clés à retirer : {len(MORTES)}')
assert len(ATTENDUES) == len(MORTES), 'deux clés se confondent après normalisation'

lignes = open(DICO, encoding='utf-8').read().split('\n')
compte = {c: 0 for c in MORTES}
par_cle = {norm(c): c for c in MORTES}
gardees, anomalies = [], []

for i, ligne in enumerate(lignes, 1):
    m = re.match(r"""^\s*(?:'([^']*(?:\\'[^']*)*)'|"([^"]*(?:\\"[^"]*)*)")\s*:\s*""", ligne)
    if m:
        brut = m.group(1) if m.group(1) is not None else m.group(2)
        cle = norm(brut)
        if cle in ATTENDUES:
            if not ligne.rstrip().endswith(','):
                anomalies.append(f'ligne {i} : ne finit pas par une virgule — {ligne[:80]}')
            else:
                compte[par_cle[cle]] += 1
            if not ligne.rstrip().endswith(','):
                gardees.append(ligne)          # on NE retire pas
            continue
    gardees.append(ligne)

manquantes = [c for c, n in compte.items() if n != 9]
if anomalies:
    print('\nANOMALIES — rien n’est écrit :')
    for a in anomalies:
        print(' ', a)
    sys.exit(1)
if manquantes:
    print('\nCLÉS PORTÉES PAR UN NOMBRE DE LANGUE INCORRECT — rien n’est écrit :')
    for c in manquantes:
        print(f'  {compte[c]} × « {c} »')
    sys.exit(1)

print('\nchaque clé est portée par 9 dictionnaires :')
for c in MORTES:
    print(f'  9 × « {c} »')
print(f'\nlignes avant : {len(lignes)}  →  après : {len(gardees)}  '
      f'(retirées : {len(lignes) - len(gardees)})')

if APPLIQUER:
    shutil.copy(DICO, '/tmp/langues.js.avant-menage')
    open(DICO, 'w', encoding='utf-8').write('\n'.join(gardees))
    print('écrit. Sauvegarde : /tmp/langues.js.avant-menage')
else:
    print('(essai à blanc — relancer avec --appliquer)')
