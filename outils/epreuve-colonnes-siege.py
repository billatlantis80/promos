#!/usr/bin/env python3
"""
ÉPREUVE DES COLONNES DE SIÈGE — dans un VRAI navigateur, sur le panneau SERVI.
==============================================================================

CE QU'ELLE PROUVE, ET POURQUOI UN TEST DE FICHIER NE SUFFIT PAS.
  Les épreuves `tests/*.test.mjs` lisent le FICHIER. Elles disent qu'un
  retrait de colonne est écrit ; elles ne disent pas que le TABLEAU se dessine
  avec huit colonnes, ni que chaque ligne en écrit huit, ni que le fichier CSV
  téléchargé porte bien ses vingt-trois libellés. Une épreuve de fichier peut
  être verte pendant qu'un gabarit fabrique une colonne de trop.

CE QU'ELLE MESURE (demande de B du 11/10/2026)
  1. L'EN-TÊTE des acteurs par catégorie : EXACTEMENT huit colonnes, dans
     l'ordre — Acteur, État, Type, Articles, Lu par, Site, Adresse des
     promotions, Note. Les neuf colonnes de siège ne doivent plus y être ;
  2. CHAQUE LIGNE : autant de cases que l'en-tête a de colonnes (le défaut de
     tout retrait : la ligne garde une case d'avance, le tableau reste lisible
     et faux) ; aucune cellule de classe `info` ; la note est la dernière ;
  3. LE CRAYON : les neuf champs de siège sont TOUJOURS complétables (le retrait
     porte sur l'affichage, pas sur la base) ;
  4. L'EXPORT CSV TÉLÉCHARGÉ pour de vrai : ses vingt-trois libellés, dont
     « Positionnement » (perdu en silence jusqu'au 11/10/2026), et autant de
     valeurs que de libellés sur chaque ligne.

LANCEMENT
  # sur la copie locale (démarre server.js tout seul)
  PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
  /opt/data/capture/venv/bin/python outils/epreuve-colonnes-siege.py

  # sur l'artefact PUBLIÉ (le seul qui parle au visiteur)
  PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
  /opt/data/capture/venv/bin/python outils/epreuve-colonnes-siege.py https://kazendra.com
"""
import os
import re
import subprocess
import sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAYS = "BE"
PORT = 4291
BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else ""

ATTENDU = ["Acteur", "État", "Articles", "Site",
           "Adresse des promotions", "Note"]

# Les vingt-trois libellés de l'export CSV, recopiés du panneau — c'est cette
# liste ATTENDUE qui attrape un champ perdu, pas un comptage : « Positionnement »
# manquait des deux listes, donc les deux comptaient pareil.
ATTENDU_CSV = ["Acteur", "Categorie", "Type", "Etat", "Sources flux",
               "Sources veille", "Articles en ligne", "Clics", "Partages",
               "Site", "Domaines", "Adresse des promotions", "Note",
               "--- INFORMATIF ---", "Adresse", "Telephone", "Email",
               "CA indicatif", "Actionnariat", "Positionnement", "Segment",
               "Distribution", "Remarques"]

CHAMPS_SIEGE = ["adresse", "telephone", "email", "ca", "actionnariat",
                "positionnement", "segment", "distribution", "remarques"]


def servir():
    """LE SERVEUR DU PROJET — pas un serveur de fichiers quelconque : le panneau
    lit `../offres.json` et `../acteurs.json`, qui ne vivent pas au même endroit
    selon qu'on sert `public/` ou `data/`. `server.js` route les deux."""
    return subprocess.Popen(
        ["node", "server.js"], cwd=RACINE,
        env={**os.environ, "PORT": str(PORT), "HOST": "127.0.0.1"},
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def cases_csv(ligne):
    """Le nombre de CASES d'une ligne de CSV, séparateur « ; », guillemets « " ».
    Le compte naïf des points-virgules se trompe : un libellé ou une adresse peut
    en contenir entre guillemets."""
    n, q = 0, False
    for c in ligne:
        if c == '"':
            q = not q
        elif c == ";" and not q:
            n += 1
    return n + 1


def main():
    erreurs = []
    serveur = servir() if not BASE else None
    url = f"{BASE}/admin/" if BASE else f"http://127.0.0.1:{PORT}/admin/"
    print(f"panneau mesuré : {url}")
    problemes = []
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            nav = p.chromium.launch()
            page = nav.new_page(viewport={"width": 1600, "height": 1000})
            page.on("pageerror", lambda e: erreurs.append("JS: " + str(e)))
            page.goto(url, wait_until="domcontentloaded", timeout=60000)

            # L'écran d'accès : sur un contexte neuf, n'importe quel identifiant
            # (>= 3) et mot de passe (>= 10) CRÉENT l'accès. On le franchit par
            # ses champs — le panneau est un module, ses fonctions ne sont pas
            # joignables de l'extérieur.
            page.fill("#aId", "epreuve-colonnes")
            page.fill("#aMdp", "mot-de-passe-epreuve-2026")
            page.click("#aOk")
            page.wait_for_selector("#panneau:not([hidden])", timeout=30000)
            page.wait_for_function(
                "() => { const e = document.getElementById('mMarcheCompteurs');"
                " return e && e.innerText.trim().length > 0; }", timeout=60000)

            page.click("button[data-vue='marche']")
            page.wait_for_timeout(500)
            page.wait_for_selector(f"#paysMarche button[data-pays='{PAYS}']", timeout=30000)
            page.click(f"#paysMarche button[data-pays='{PAYS}']")
            page.wait_for_timeout(900)

            mesure = page.evaluate(
                """() => {
                const sections = [...document.querySelectorAll('#mMarche details')];
                const table = sections.length ? sections[0].querySelector('table') : null;
                if (!table) return null;
                // LES CATÉGORIES SONT REPLIÉES AU DÉPART : `innerText` rend une
                // chaîne VIDE sur un élément caché (mesuré : huit libellés vides,
                // alors que le tableau était juste). On lit `textContent`, qui ne
                // dépend pas de l'affichage.
                const entete = [...table.querySelectorAll('tr:first-child th')]
                  .map((th) => th.textContent.trim());
                // ET LA LIGNE DE LA FICHE N'EST PAS UNE LIGNE D'ACTEUR : elle
                // s'étale sur toute la largeur en UNE case (mesuré : « cases par
                // ligne = [1, 8] »). On l'exclut — c'est ce qui rend le compte
                // exact, et son `colspan` est mesuré à part.
                const lignes = [...table.querySelectorAll('tr:not(.edition)')].slice(1);
                const cases = lignes.map((tr) => tr.children.length);
                const infos = [...document.querySelectorAll('#mMarche td.info, #mMarche th.info')].length;
                // La dernière colonne de la première ligne de données : elle doit
                // porter l'encadré de note (un <textarea>), et rien d'autre.
                const premiere = lignes[0];
                const derniere = premiere ? premiere.children[premiere.children.length - 1] : null;
                const ligneFiche = table.querySelector('tr.edition');
                return {
                  categories: sections.length,
                  entete,
                  lignes: lignes.length,
                  casesDistinctes: [...new Set(cases)].sort((a, b) => a - b),
                  casesPremiere: cases[0],
                  infos,
                  colspanFiche: ligneFiche ? ligneFiche.firstElementChild.getAttribute('colspan') : '',
                  dernierePorteLaNote: !!derniere && !!derniere.querySelector('textarea[data-note]'),
                  derniereTexte: derniere ? derniere.textContent.trim().slice(0, 40) : '',
                };
            }""")

            # LE CRAYON : les neuf champs de siège restent complétables.
            # Les catégories sont des blocs REPLIÉS au départ : on les ouvre, sinon
            # le bouton existe dans le document mais n'est pas cliquable (mesuré :
            # « element is not visible », 149 boutons trouvés et aucun atteignable).
            page.evaluate("document.querySelectorAll('#mMarche details').forEach((d) => { d.open = true; })")
            page.wait_for_timeout(300)
            page.click("#mMarche button[data-editer]")
            page.wait_for_timeout(500)
            champs = page.evaluate(
                """() => {
                const f = document.querySelector('#mMarche tr.edition:not([hidden])');
                if (!f) return null;
                return [...f.querySelectorAll('[data-champ]')].map((e) => e.dataset.champ);
            }""")
            page.screenshot(path="/tmp/panneau-colonnes-siege.png", full_page=False)

            # L'EXPORT CSV, TÉLÉCHARGÉ POUR DE VRAI.
            with page.expect_download(timeout=60000) as attente:
                page.click("#marcheCsv")
            chemin = attente.value.path()
            brut = open(chemin, encoding="utf-8-sig").read()
            nav.close()
    finally:
        if serveur:
            serveur.terminate()

    lignes_csv = [l for l in brut.replace("\r\n", "\n").split("\n") if l.strip()]
    entete_csv = [c.strip('"') for c in lignes_csv[0].split(";")]
    cases_par_ligne = {cases_csv(l) for l in lignes_csv[1:]}

    print(f"\n=== 1. L'en-tête du tableau ({PAYS}) ===")
    print(f"catégories affichées : {mesure['categories']} · lignes mesurées : {mesure['lignes']}")
    print(f"en-tête : {mesure['entete']}")
    if mesure["entete"] != ATTENDU:
        problemes.append(f"l'en-tête n'est pas celui attendu : {mesure['entete']}")
    if mesure["infos"]:
        problemes.append(f"{mesure['infos']} cellule(s) de classe « info » sont revenues")
    print(f"colspan de la fiche repliée : {mesure['colspanFiche']} (tableau : {len(ATTENDU)} colonnes)")
    if mesure["colspanFiche"] != str(len(ATTENDU)):
        problemes.append(f"la fiche s'étale sur {mesure['colspanFiche']} colonne(s) "
                         f"pour un tableau qui en a {len(ATTENDU)} : elle sortirait du tableau")

    print(f"\n=== 2. Les lignes ===")
    print(f"nombre de cases par ligne (valeurs distinctes) : {mesure['casesDistinctes']}")
    if mesure["casesDistinctes"] != [len(ATTENDU)]:
        problemes.append(f"des lignes n'écrivent pas {len(ATTENDU)} cases : {mesure['casesDistinctes']}")
    print(f"dernière case de la première ligne : « {mesure['derniereTexte']} » "
          f"(textarea de note : {mesure['dernierePorteLaNote']})")
    if not mesure["dernierePorteLaNote"]:
        problemes.append("la dernière colonne ne porte plus l'encadré de note")

    print(f"\n=== 3. Le crayon ===")
    print(f"champs de la fiche : {champs}")
    manquants = [c for c in CHAMPS_SIEGE if c not in (champs or [])]
    if manquants:
        problemes.append(f"des champs de siège ne sont plus complétables : {manquants}")

    print(f"\n=== 4. L'export CSV téléchargé ===")
    print(f"libellés ({len(entete_csv)}) : {entete_csv}")
    print(f"lignes de données : {len(lignes_csv) - 1} · cases par ligne : {sorted(cases_par_ligne)}")
    if entete_csv != ATTENDU_CSV:
        ecart = [c for c in ATTENDU_CSV if c not in entete_csv]
        problemes.append(f"l'export CSV n'a pas ses libellés : manque {ecart}")
    if cases_par_ligne != {len(ATTENDU_CSV)}:
        problemes.append(f"l'export écrit {sorted(cases_par_ligne)} case(s) et non {len(ATTENDU_CSV)}")

    if erreurs:
        problemes.extend(erreurs)
    print("\n" + ("✗ " + "\n✗ ".join(problemes) if problemes
                  else "√ toutes les mesures attendues sont au rendez-vous"))
    raise SystemExit(1 if problemes else 0)


if __name__ == "__main__":
    main()
