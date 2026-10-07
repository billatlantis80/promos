#!/usr/bin/env python3
"""Ajoute la clé « Créer un compte sur cet appareil » aux 9 langues.

Pourquoi une SEULE clé nouvelle pour six demandes : les autres textes déplacés
(« Aucun compte sur cet appareil », les deux paragraphes du compte, « Tes
données, tes droits » et ses trois puces, la phrase sur les liens affiliés)
EXISTAIENT DÉJÀ dans les dictionnaires — ils étaient rendus par app.js, qui
utilise les mêmes clés. Les déplacer d'un onglet à l'autre ne change donc
AUCUNE clé, donc aucune traduction. Seul le TITRE du formulaire d'inscription
manuelle est nouveau : le paragraphe qui le précédait portait le mot « Aucun
compte », faux dès qu'un compte existe.

Le script écrit dans le bloc EXTRA de langues.js — le bloc prévu pour les ajouts
tardifs (voir l'entête du module). Il est IDEMPOTENT et relit le fichier écrit
pour annoncer ce qui EST, pas ce qu'on croit avoir écrit.

Attention au piège déjà rencontré : les numéros de ligne ne sont PAS réutilisés
après écriture (chaque insertion décale les suivantes). Le contrôle final
reparcourt donc le fichier, il ne refait pas confiance aux positions.
"""
import re
import sys

CHEMIN = "/opt/data/webdev/projects/promos/public/langues.js"
CLE = "Créer un compte sur cet appareil"
TRAD = {
    "fr": "Créer un compte sur cet appareil",
    "nl": "Een account aanmaken op dit toestel",
    "de": "Ein Konto auf diesem Gerät erstellen",
    "en": "Create an account on this device",
    "es": "Crear una cuenta en este dispositivo",
    "it": "Creare un account su questo dispositivo",
    "pt": "Criar uma conta neste dispositivo",
    "pl": "Utwórz konto na tym urządzeniu",
    "sv": "Skapa ett konto på den här enheten",
}
LANGUES = ["fr", "nl", "de", "en", "es", "it", "pt", "pl", "sv"]

with open(CHEMIN, encoding="utf-8") as f:
    source = f.read()

if source.count(f"'{CLE}':") == 9:
    print("Déjà fait : la clé est présente 9 fois. Rien à faire.")
    sys.exit(0)

debut = source.index("const EXTRA = {")
fin = source.index("\n};", debut)
bloc = source[debut:fin]

# On découpe le bloc EXTRA par langue : chaque langue ouvre par «   <code>: { ».
motif = re.compile(r"\n  (fr|nl|de|en|es|it|pt|pl|sv): \{\n")
bornes = [(m.group(1), m.start(), m.end()) for m in motif.finditer(bloc)]
if [c for c, _, _ in bornes] != LANGUES:
    print(f"ERREUR : langues trouvées dans EXTRA = {[c for c, _, _ in bornes]}")
    sys.exit(1)

# Insertion de la FIN vers le DÉBUT : les positions suivantes ne bougent pas.
nouveau = bloc
inseres = 0
for code, _, ouverture in reversed(bornes):
    # La fermeture du bloc de langue est le premier « \n  },\n » après l'ouverture.
    fermeture = nouveau.index("\n  },", ouverture)
    ligne = f"\n    '{CLE}': '{TRAD[code]}',"
    nouveau = nouveau[:fermeture] + ligne + nouveau[fermeture:]
    inseres += 1

with open(CHEMIN, "w", encoding="utf-8") as f:
    f.write(source[:debut] + nouveau + source[fin:])

# Contrôle : on relit le fichier écrit.
with open(CHEMIN, encoding="utf-8") as f:
    apres = f.read()
print(f"Insertions demandées : {inseres}. Présences dans le fichier écrit : "
      f"{apres.count(chr(39) + CLE + chr(39) + ':')}")
for code in LANGUES:
    attendu = f"'{CLE}': '{TRAD[code]}',"
    if attendu in apres:
        print(f"  {code} OK — {TRAD[code]}")
    else:
        print(f"  {code} MANQUANT — attendu {attendu}")
        sys.exit(1)
print("9/9 : la clé est écrite dans les neuf langues.")
