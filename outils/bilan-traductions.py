#!/usr/bin/env python3
"""Croise les deux passes (statique + exécution) et dresse la liste des clés
à retirer, avec, pour chacune, la raison de sa condamnation.

Aucune clé n'est retirée sur une seule passe : une clé atteinte à l'exécution
mais écrite nulle part en clair (t(th.nom)) est VIVANTE ; une clé citée en
commentaire mais jamais appelée est MORTE.
"""
import json

inv = json.load(open('/tmp/inventaire-t9n.json'))
vues = json.load(open('/tmp/t9n-vues.json'))

atteintes = set()
for cles in vues.values():
    atteintes |= set(cles)

vivantes_statique = {v['cle']: v.get('via') for v in inv['vivantes']}
douteuses = {d['cle']: d for d in inv['douteuses']}
mortes_statique = inv['mortes']
toutes = set(vivantes_statique) | set(douteuses) | set(mortes_statique)

print(f'clés au dictionnaire        : {len(toutes)}')
print(f'atteintes à l\'exécution     : {len(atteintes)}')
print(f'citées en littéral exact    : {len(vivantes_statique)}')
print(f'ambiguës au scan statique   : {len(douteuses)}')
print()

jamais = sorted(toutes - atteintes)
print(f'=== JAMAIS atteintes à l\'exécution ({len(jamais)}) ===')
for k in jamais:
    ou = []
    if k in vivantes_statique:
        ou.append(f"cité : {vivantes_statique[k]}")
    if k in douteuses:
        ou.append(f"ambigu ({douteuses[k]['n']} pistes)")
    if not ou:
        ou.append('jamais cité')
    print(f'  [{"; ".join(ou)}]  « {k} »')

print()
indirect = sorted(atteintes - set(vivantes_statique))
print(f'=== atteintes sans littéral exact, donc par variable/gabarit ({len(indirect)}) ===')
for k in indirect:
    print(f'  « {k} »')

json.dump({'jamais': jamais, 'indirect': indirect},
          open('/tmp/t9n-bilan.json', 'w'), ensure_ascii=False, indent=1)
