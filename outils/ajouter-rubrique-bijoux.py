#!/usr/bin/env python3
"""Ajoute la rubrique « Bijoux » aux 9 dictionnaires de public/langues.js.

La clé du dictionnaire est le texte FRANÇAIS (voir l'entête du module), donc la
clé ajoutée est partout 'Bijoux' : c'est la même rubrique. Seule la VALEUR
change selon la langue.

Repérage par NUMÉRO DE LIGNE et non par motif : la ligne « 'Mode': 'Mode', »
est strictement identique dans plusieurs dictionnaires, un remplacement par
motif toucherait la mauvaise langue. Les numéros sont vérifiés avant écriture
(la ligne doit contenir « Mode »), et la valeur attendue de « Mode » est
contrôlée pour chaque langue avant insertion — une dérive du fichier doit
arrêter le script, pas produire une traduction silencieusement fausse.

Idempotent : relancé, il ne fait rien si les 9 insertions sont déjà là.
"""
import sys

CHEMIN = "/opt/data/webdev/projects/promos/public/langues.js"

# (ligne de « Mode » vue à la main, langue, traduction de Bijoux)
CIBLES = [
    (135,  "fr", "Bijoux"),
    (354,  "nl", "Sieraden"),
    (551,  "de", "Schmuck"),
    (748,  "en", "Jewellery"),
    (945,  "es", "Joyería"),
    (1142, "it", "Gioielli"),
    (1339, "pt", "Joias"),
    (1536, "pl", "Biżuteria"),
    (1733, "sv", "Smycken"),
]

# Ce que « Mode » doit valoir dans chaque langue (contrôle de non-dérive).
MODE_ATTENDU = {
    "fr": "Mode", "nl": "Mode", "de": "Mode", "en": "Fashion", "es": "Moda",
    "it": "Moda", "pt": "Moda", "pl": "Moda", "sv": "Mode",
}

with open(CHEMIN, encoding="utf-8") as f:
    lignes = f.read().split("\n")

if "'Bijoux':" in "\n".join(lignes) and sum(
        1 for l in lignes if l.strip().startswith("'Bijoux':")) == 9:
    print("Déjà fait : 9 rubriques « Bijoux » présentes. Rien à faire.")
    sys.exit(0)

for idx, (n, langue, mot) in enumerate(CIBLES):
    ligne = lignes[n - 1]
    if "'Mode':" not in ligne:
        print(f"ERREUR : la ligne {n} ({langue}) ne porte pas 'Mode' — "
              f"le fichier a bougé : {ligne!r}")
        sys.exit(1)
    valeur = ligne.split("'Mode':")[1].split(",")[0].strip().strip("'")
    if valeur != MODE_ATTENDU[langue]:
        print(f"ERREUR : ligne {n}, « Mode » vaut {valeur!r} et non "
              f"{MODE_ATTENDU[langue]!r} pour {langue}.")
        sys.exit(1)

# Insertion de la FIN vers le DÉBUT : les indices suivants ne se décalent pas.
for n, langue, mot in sorted(CIBLES, reverse=True):
    lignes.insert(n, f"  'Bijoux': '{mot}',  // {langue}")

with open(CHEMIN, "w", encoding="utf-8") as f:
    f.write("\n".join(lignes))

# Relecture depuis le disque : on annonce ce qui EST écrit, pas ce qu'on croit.
#
# ATTENTION : les numéros de ligne CIBLES ne sont plus valables après écriture —
# chaque insertion décale toutes les lignes suivantes. Vérifier `apres[n-1]`
# ferait échouer le contrôle sur un fichier pourtant correct (défaut constaté :
# la rubrique néerlandaise était bien écrite, le contrôle la disait manquante).
# On balaie donc le fichier écrit et on contrôle la RÈGLE : chaque
# `'Bijoux': '<mot>',` est précédé de la ligne « 'Mode': » de sa langue.
with open(CHEMIN, encoding="utf-8") as f:
    apres = f.read().split("\n")
print(f"Fichier : {len(lignes)} lignes contre {len(apres)} relues.")

attendues = {f"'Bijoux': '{mot}',": langue for _, langue, mot in CIBLES}
trouvees = {}
for i, ligne in enumerate(apres):
    cle = ligne.strip()
    if cle.startswith("'Bijoux':"):
        cle = cle.split("//")[0].strip()
        langue = attendues.get(cle)
        if langue is None:
            print(f"  ERREUR ligne {i+1} : rubrique Bijoux inattendue {cle!r}")
            sys.exit(1)
        avant = apres[i - 1]
        if "'Mode':" not in avant:
            print(f"  ERREUR ligne {i+1} ({langue}) : la rubrique Bijoux n'est "
                  f"pas après la ligne « Mode » : {avant!r}")
            sys.exit(1)
        trouvees[langue] = cle

for _, langue, mot in CIBLES:
    cle = f"'Bijoux': '{mot}',"
    if trouvees.get(langue) == cle:
        print(f"  {langue:3} OK — {cle} (juste après « Mode »)")
    else:
        print(f"  {langue:3} MANQUANT — attendu {cle}")
        sys.exit(1)
print(f"Contrôle : {len(trouvees)}/9 rubriques « Bijoux », chacune après sa "
      f"ligne « Mode », et aucune en trop.")

