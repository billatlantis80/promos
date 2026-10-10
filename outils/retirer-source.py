#!/usr/bin/env python3
"""Retirer TOUTES les offres d'une source du stock ET du fichier publié.

    python3 outils/retirer-source.py <préfixe-sourceId>

Exemple, le seul usage réel à ce jour (10/10/2026) — retirer MediaMarkt Outlet,
décision de B (« ce lien n'est pas affiliable ») :

    flock -w 900 /tmp/promos-collecte.lock python3 outils/retirer-source.py mm-outlet

⚠ À LANCER SOUS LE VERROU DU COLLECTEUR. Le passage qui publie se réamorce sur
`docs/offres.json` : une purge faite pendant qu'un passage tourne est ÉCRASÉE
par ce passage, qui réécrit le fichier depuis l'état qu'il avait chargé AVANT.
C'est arrivé le 10/10/2026 — la purge semblait réussie, et l'offre était de
retour au passage suivant. Le verrou est donc obligatoire, pas prudent.

Ce que le script retire, dans les deux fichiers (stock `data/offres.json` et
publié `docs/offres.json`) :
  - les offres dont le `sourceId` commence par le préfixe ;
  - leurs entrées dans `sourcesVuLe` (sinon elles traînent indéfiniment) ;
  - leurs lignes dans `sources` (elles sont de toute façon reprises du code).
Il ne touche à rien d'autre, et il réécrit les trois compteurs (`total`,
`totalOffres`, `totalVeille`) pour qu'ils restent justes.
"""
import json
import pathlib
import sys

if len(sys.argv) != 2:
    sys.exit(__doc__)
prefixe = sys.argv[1]

base = pathlib.Path('/opt/data/webdev/projects/promos')
for nom in ('data/offres.json', 'docs/offres.json'):
    p = base / nom
    if not p.exists():
        print(nom, 'absent')
        continue
    d = json.loads(p.read_text())
    offres = d.get('offres') or []
    gardees = [o for o in offres if not str(o.get('sourceId', '')).startswith(prefixe)]
    ecartees = [o for o in offres if str(o.get('sourceId', '')).startswith(prefixe)]
    d['offres'] = gardees
    d['total'] = len(gardees)
    d['totalOffres'] = len([o for o in gardees if o.get('type') != 'article'])
    d['totalVeille'] = len([o for o in gardees if o.get('type') == 'article'])
    vu = d.get('sourcesVuLe') or {}
    for k in [k for k in vu if k.startswith(prefixe)]:
        vu.pop(k)
    d['sourcesVuLe'] = vu
    d['sources'] = [s for s in (d.get('sources') or []) if not str(s.get('id', '')).startswith(prefixe)]
    p.write_text(json.dumps(d, ensure_ascii=False))
    print(f'{nom} : {len(ecartees)} offre(s) écartée(s) | '
          f'vuLe nettoyées {len([k for k in (d.get("sourcesVuLe") or {}) if k.startswith(prefixe)])} | '
          f'offres restantes {len(gardees)} | reste « {prefixe} » : '
          f'{len([o for o in gardees if str(o.get("sourceId", "")).startswith(prefixe)])} | '
          f'genereLe {d.get("genereLe")}')
    for o in ecartees:
        print('   écartée :', o.get('titre', '')[:60], '|', o.get('sourceId'))
