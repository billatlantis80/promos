#!/usr/bin/env python3
"""Renomme la rubrique « Bijoux » en « Montres & bijoux », dans les 9 langues.

La clé d'un dictionnaire est LE TEXTE FRANÇAIS lui-même (règle du module). On ne
peut donc pas « garder la clé et changer la valeur » : renommer la rubrique veut
dire renommer la CLÉ dans les neuf dictionnaires.

Chaque remplacement est repéré par l'ANCIENNE VALEUR, qui identifie la langue de
façon sûre ('Sieraden' = néerlandais, 'Schmuck' = allemand…). Repérer par numéro
de ligne casserait au premier décalage.

Idempotent, et relit le fichier écrit avant d'annoncer quoi que ce soit.
"""
import sys
from pathlib import Path

CHEMIN = Path("/opt/data/webdev/projects/promos/public/langues.js")

# ancienne valeur -> (langue, nouvelle traduction)
RENOMMAGE = {
    "Bijoux":   ("fr", "Montres & bijoux"),
    "Sieraden": ("nl", "Horloges & sieraden"),
    "Schmuck":  ("de", "Uhren & Schmuck"),
    "Jewellery": ("en", "Watches & jewellery"),
    "Joyería":  ("es", "Relojes y joyas"),
    "Gioielli": ("it", "Orologi e gioielli"),
    "Joias":    ("pt", "Relógios e joias"),
    "Biżuteria": ("pl", "Zegarki i biżuteria"),
    "Smycken":  ("sv", "Klockor & smycken"),
}

source = CHEMIN.read_text(encoding="utf-8")

if source.count("'Montres & bijoux':") == 9:
    print("Déjà fait : la clé « Montres & bijoux » est présente 9 fois. Rien à faire.")
    sys.exit(0)

# Contrôle préalable : les neuf anciennes clés doivent être là, une fois chacune.
for ancienne in RENOMMAGE:
    n = source.count(f"'Bijoux': '{ancienne}',")
    if n != 1:
        print(f"ERREUR : « 'Bijoux': '{ancienne}', » trouvé {n} fois, attendu 1.")
        print("        Le fichier a bougé : arrêt plutôt qu'un renommage partiel.")
        sys.exit(1)

nouveau = source
for ancienne, (langue, traduction) in RENOMMAGE.items():
    avant = f"'Bijoux': '{ancienne}',"
    apres = f"'Montres & bijoux': '{traduction}',"
    nouveau = nouveau.replace(avant, apres, 1)

CHEMIN.write_text(nouveau, encoding="utf-8")

# Contrôle : on relit ce qui EST écrit.
relu = CHEMIN.read_text(encoding="utf-8")
print(f"Occurrences de l'ancienne clé « 'Bijoux': » : {relu.count(chr(39) + 'Bijoux' + chr(39) + ':')}")
for ancienne, (langue, traduction) in RENOMMAGE.items():
    attendu = f"'Montres & bijoux': '{traduction}',"
    if attendu in relu:
        print(f"  {langue:3} OK — {traduction}")
    else:
        print(f"  {langue:3} MANQUANT — attendu {attendu}")
        sys.exit(1)
print("9/9 : la rubrique s'appelle « Montres & bijoux » dans les neuf langues.")
