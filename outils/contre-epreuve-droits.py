#!/usr/bin/env python3
"""CONTRE-ÉPREUVE des tests de l'onglet Informations (tests/droits.test.mjs).

Un test qui n'échoue jamais ne prouve rien. On remet donc chaque défaut EN
PLACE, un par un, dans une COPIE du projet (/tmp), et on exige que le test
correspondant ÉCHOUE. Si un défaut repassé ne fait échouer aucun test, c'est le
test qui est faux, pas le code qui est bon.

La copie est faite dans /tmp : le vrai projet n'est jamais touché (règle du
projet — un cron de collecte photographie le dossier pendant les tests).
"""
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path("/opt/data/webdev/projects/promos")
COPIE = Path("/tmp/contre-epreuve-droits")


def preparer():
    if COPIE.exists():
        shutil.rmtree(COPIE)
    (COPIE / "public").mkdir(parents=True)
    (COPIE / "tests").mkdir(parents=True)
    for f in ["app.js", "index.html", "langues.js"]:
        shutil.copy2(RACINE / "public" / f, COPIE / "public" / f)
    shutil.copy2(RACINE / "tests" / "droits.test.mjs", COPIE / "tests" / "droits.test.mjs")


def lancer():
    p = subprocess.run(
        ["node", "--test", "tests/droits.test.mjs"],
        cwd=COPIE, capture_output=True, text=True,
    )
    return p.stdout


def defauts_attrapes(stdout):
    """Numéros des tests en échec, lus dans la sortie TAP."""
    return [
        int(m.group(1))
        for m in __import__("re").finditer(r"^not ok (\d+) -", stdout, __import__("re").M)
    ]


CAS = []


def cas(nom, mutation, tests_attendus):
    CAS.append((nom, mutation, tests_attendus))


def muter(chemin, avant, apres):
    def _f():
        p = COPIE / "public" / chemin
        t = p.read_text(encoding="utf-8")
        if avant not in t:
            raise SystemExit(f"ERREUR : motif introuvable pour la contre-épreuve —\n{avant[:80]}")
        p.write_text(t.replace(avant, apres, 1), encoding="utf-8")
    return _f


# --- Défaut 1 : la bande ROUGE du drapeau allemand disparaît (fond blanc). ----
cas(
    "drapeau allemand : retour au fond BLANC (bande rouge absente)",
    muter(
        "app.js",
        'de: \'<rect width="24" height="16" fill="#DD0000"/><rect width="24" height="5.34" fill="#000000"/>\'',
        'de: \'<rect width="24" height="16" fill="#ffffff"/><rect width="24" height="5.34" fill="#000000"/>\'',
    ),
    [5],
)

# --- Défaut 2 : une phrase du bloc des droits repasse en clair (plus de t()). --
cas(
    "bloc des droits : une phrase n'est plus traduite (écrite en clair)",
    muter(
        "app.js",
        '<li><b>${esc(t(\'Effacer\'))}</b> : ${esc(t(\'« Supprimer mon compte » retire le compte et les données de cet appareil, sans délai et sans avoir à demander à personne.\'))}</li>',
        "<li><b>Effacer</b> : « Supprimer mon compte » retire le compte et les données de cet appareil, sans délai et sans avoir à demander à personne.</li>",
    ),
    [1, 2],
)

# --- Défaut 3 : la phrase affiliée revient EN DOUBLE (dans le bloc des droits).
cas(
    "liens affiliés : la phrase revient dans un deuxième endroit",
    muter(
        "app.js",
        '      </ul>\n    </div>`;',
        '      </ul>\n      <p>Les liens vers les marchands peuvent être affiliés : une commission peut être versée, sans changer le prix que tu paies.</p>\n    </div>`;',
    ),
    [9],
)

# --- Défaut 4 : la connexion sociale repasse AVANT l'inscription manuelle. ----
#  On inverse les deux points d'entrée dans la rubrique unique.
cas(
    "onglet Compte : la connexion sociale repasse AVANT l'inscription manuelle",
    muter(
        "index.html",
        '''      <div id="regCompte"></div>
      <div id="regConnexion"></div>''',
        '''      <div id="regConnexion"></div>
      <div id="regCompte"></div>''',
    ),
    [6],
)

# --- Défaut 4 bis : un deuxième bloc de compte réapparaît. --------------------
cas(
    "onglet Compte : un deuxième bloc de compte réapparaît (« Compte local »)",
    muter(
        "index.html",
        '''    <section class="rubrique">
      <h3 data-i18n="Inscription et connexion">Inscription et connexion</h3>''',
        '''    <section class="rubrique">
      <h3 data-i18n="Compte local">Compte local</h3>
      <div id="regCompteBis"></div>
    </section>
    <section class="rubrique">
      <h3 data-i18n="Inscription et connexion">Inscription et connexion</h3>''',
    ),
    [6],
)

# --- Défaut 5 : le point de contact redescend après les sources. --------------
#  La mutation RETIRE la section de tête (elle ne la duplique pas : une copie
#  laisserait « Point de contact » en première position, et la contre-épreuve ne
#  prouverait rien — c'est l'erreur qu'on a faite au premier essai).
cas(
    "onglet Informations : le point de contact n'est plus le premier paragraphe",
    muter(
        "index.html",
        '''    <section class="rubrique">
      <h3 data-i18n="Point de contact">Point de contact</h3>
      <p data-i18n="Pour toute question sur les données, les sources ou une offre :">Pour toute question sur les données, les sources ou une offre :</p>
      <p style="font-size:15px"><a href="mailto:info@kazendra.com">info@kazendra.com</a></p>
    </section>
    <section class="rubrique">
      <h3 data-i18n="Tes données, tes droits">Tes données, tes droits</h3>''',
        '''    <section class="rubrique">
      <h3 data-i18n="Tes données, tes droits">Tes données, tes droits</h3>''',
    ),
    [7],
)

# --- Défaut 6 : les textes du compte reviennent dans l'onglet Compte. ---------
cas(
    "onglet Compte : les textes déplacés reviennent (blocDroits rappelé)",
    muter(
        "app.js",
        '        <p style="margin:0"><button class="enregistrer" id="creerCompte">${esc(t(\'Créer mon compte\'))}</button></p>\n      </div>`;',
        '        <p style="margin:0"><button class="enregistrer" id="creerCompte">${esc(t(\'Créer mon compte\'))}</button></p>\n      </div>\n      ${blocDroits()}`;',
    ),
    [8],
)

print(f"Contre-épreuve des tests « onglet Informations » — {len(CAS)} défauts à remettre.\n")
echecs = 0
for nom, mutation, attendus in CAS:
    preparer()
    mutation()
    stdout = lancer()
    attrapes = defauts_attrapes(stdout)
    manquants = [t for t in attendus if t not in attrapes]
    if manquants:
        echecs += 1
        print(f"  RATÉ  {nom}")
        print(f"        tests attendus en échec : {attendus} ; réellement échoués : {attrapes}")
        for ligne in stdout.splitlines():
            if ligne.startswith("not ok"):
                print(f"          {ligne}")
    else:
        print(f"  OK    {nom}  (tests {attrapes} en échec)")

# Contrôle final : le vrai projet n'a pas été touché.
preparer()
stdout = lancer()
attrapes = defauts_attrapes(stdout)
if attrapes:
    print(f"\n  PROBLÈME : sur le projet INTACT, ces tests échouent déjà : {attrapes}")
    echecs += 1
else:
    print("\n  Projet intact : les 9 tests passent (aucun échec attendu).")

shutil.rmtree(COPIE, ignore_errors=True)
print(f"\nRésultat : {len(CAS) - echecs}/{len(CAS)} défauts attrapés, {echecs} raté(s).")
sys.exit(1 if echecs else 0)
