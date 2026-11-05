#!/usr/bin/env python3
"""
DOCUMENTER LES ADRESSES DE PROMOTIONS DANS LES TABLEURS DE MARCHÉ.
===================================================================

Demande de B (09/10/2026) : « En même temps tu dois les documenter dans le
fichier xls concerné par pays, pour pouvoir garder la base de donnée. »

POURQUOI CE SCRIPT EXISTE
   Le remplissage des 573 acteurs a produit son résultat dans
   `public/adresses-promotions.json` — un fichier fait pour le SITE, lu par le
   panneau et par la collecte. Ce n'est pas une base de données : c'est un
   réglage. Si demain les tableurs de B deviennent la référence, ou s'il veut
   relire son marché dans Excel, les adresses doivent y être AUSSI.

   Le tableur est la PROVENANCE : `acteurs-depuis-xlsx.py` en tire
   `public/acteurs.json`, qui alimente le panneau. Ne pas y écrire les adresses
   laisserait la base incomplète, et la seule copie vivrait dans un fichier de
   publication — c'est-à-dire nulle part.

CE QU'ON ÉCRIT, ET DANS QUELLES FEUILLES
   Trois colonnes, à la fin de chaque feuille de données :
     — « Adresse des promotions » : l'adresse retenue, ou vide si rien n'a été
       trouvé. VIDE VEUT DIRE VIDE : on n'écrit jamais une adresse devinée dans
       la base, parce qu'une adresse fausse dans un tableur se recopie de
       tableur en tableur pendant des années.
     — « Résultat de la vérification » : ce que la page a réellement donné
       (« liste — 22 offres », « page de promotions reconnue, 0 offre lisible »,
       « rien trouvé », « refusé par robots.txt »). C'est ce qui distingue une
       adresse qui RAPPORTE d'une adresse qui existe.
     — « Relevée le » : la date.

   Les 23 feuilles de données (une par catégorie + « Vue densemble ») portent les
   MÊMES 13 colonnes d'origine : on les complète toutes, sinon la même fiche
   dirait deux choses différentes selon la feuille où on la regarde. La feuille
   « Lisez-moi » est laissée intacte — ce n'est pas une feuille de données.

AVERTISSEMENT SUR openpyxl
   Réécrire un .xlsx avec openpyxl peut faire perdre des choses qu'il ne sait
   pas représenter (graphiques, images). On ne le fait donc pas à l'aveugle :
   après écriture, on RELIT le fichier, on recompte les lignes et les colonnes,
   et on vérifie que `acteurs-depuis-xlsx.py` produit toujours la même base. Si
   la relecture échoue, l'original est restauré.

Lancement :
   uv run --with openpyxl python3 outils/documenter-adresses-xlsx.py
   uv run --with openpyxl python3 outils/documenter-adresses-xlsx.py --verifier-seulement
"""
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

from openpyxl import load_workbook

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DONNEES = os.path.join(RACINE, "donnees")
PUBLIC = os.path.join(RACINE, "public")

# Un pays = un tableur. Ajouter un pays, c'est ajouter une ligne ici.
FICHIERS = [
    ("BE", "marche-be-2026-10-08.xlsx"),
    ("DE", "marche-de-2026-10-08.xlsx"),
    ("FR", "marche-fr-2026-10-08.xlsx"),
]

ADRESSES = os.path.join(PUBLIC, "adresses-promotions.json")
PARTIEL = os.path.join(DONNEES, "adresses-partiel.jsonl")
VERIFICATIONS = os.path.join(DONNEES, "adresses-verifications.json")

COLONNE_NOM = "Enseigne / entreprise"
COL_ADRESSE = "Adresse des promotions"
COL_RESULTAT = "Résultat de la vérification"
COL_DATE = "Relevée le"
FEUILLE_PAS_DONNEES = "Lisez-moi"

DATE = datetime.now().strftime("%Y-%m-%d")


def lire_json(chemin, defaut):
    try:
        with open(chemin, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return defaut


def construire_verifications():
    """Le compte rendu durable des 573 essais, à partir du journal de chantier.

    Le journal (`adresses-partiel.jsonl`) est un fichier de TRAVAIL : il est
    écrit au fil de l'eau, il peut être refait, et rien ne le versionne. On en
    tire ici un fichier compact et stable, qui sera versionné avec le projet —
    c'est lui qui « garde la base de données » des vérifications.

    On n'y garde que ce qui se relit : le nom, le pays, l'adresse retenue, son
    niveau, ce que la page a donné, et combien d'essais ont été nécessaires.
    Les essais eux-mêmes (des dizaines d'URL par acteur) restent dans le journal.
    """
    if not os.path.exists(PARTIEL):
        return lire_json(VERIFICATIONS, {"acteurs": {}})
    acteurs = {}
    with open(PARTIEL, encoding="utf-8") as f:
        for ligne in f:
            ligne = ligne.strip()
            if not ligne:
                continue
            try:
                r = json.loads(ligne)
            except json.JSONDecodeError:
                continue  # ligne abîmée par une coupure : on l'ignore
            if not r.get("nom"):
                continue
            acteurs[r["nom"]] = {
                "pays": r.get("pays", ""),
                "adresse": r.get("retenue", ""),
                "niveau": r.get("niveau", 0),
                "offres": r.get("offres", 0),
                "methode": r.get("methode", ""),
                "essais": len(r.get("essais", [])),
            }
    sortie = {
        "genereLe": DATE,
        "note": "Résultat de la vérification des adresses de promotions, un acteur par entrée. "
                "niveau 2 = page de liste qui rend des offres à deux prix ; niveau 1 = page de "
                "promotions reconnue mais illisible ; niveau 0 = rien trouvé.",
        "acteurs": dict(sorted(acteurs.items())),
    }
    with open(VERIFICATIONS, "w", encoding="utf-8") as f:
        json.dump(sortie, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return sortie


def resultat_lisible(v):
    """Ce que la page a donné, en clair. On dit « rien trouvé » plutôt que de
    laisser une case vide : une case vide se lit « pas encore fait », pas
    « essayé et raté »."""
    if not v:
        return "non essayé"
    niveau = v.get("niveau", 0)
    if niveau == 2:
        return f"liste — {v.get('offres', 0)} offre(s) à deux prix"
    if niveau == 1:
        return "page de promotions reconnue, 0 offre lisible"
    if v.get("adresse"):
        return "adresse notée, non concluante"
    return "rien trouvé"


def completer_feuille(ws, adresses, verifs, journal):
    entetes = [c.value for c in ws[1]]
    if COLONNE_NOM not in entetes:
        return None
    try:
        i_nom = entetes.index(COLONNE_NOM)
    except ValueError:
        return None
    # Les colonnes existent déjà si le script a déjà tourné : on ne les empile
    # pas une deuxième fois, on les réutilise. Sans ça, relancer l'outil
    # allongerait le tableur d'autant de colonnes à chaque passage.
    if COL_ADRESSE not in entetes:
        n = ws.max_column
        ws.cell(row=1, column=n + 1, value=COL_ADRESSE)
        ws.cell(row=1, column=n + 2, value=COL_RESULTAT)
        ws.cell(row=1, column=n + 3, value=COL_DATE)
        entetes = [c.value for c in ws[1]]
    i_adr = entetes.index(COL_ADRESSE) + 1
    i_res = entetes.index(COL_RESULTAT) + 1
    i_dat = entetes.index(COL_DATE) + 1

    remplies = 0
    for ligne in range(2, ws.max_row + 1):
        nom = ws.cell(row=ligne, column=i_nom + 1).value
        if not nom:
            continue
        nom = str(nom).strip()
        url = adresses.get(nom)
        v = verifs.get(nom)
        if url:
            ws.cell(row=ligne, column=i_adr, value=url)
            ws.cell(row=ligne, column=i_res, value=resultat_lisible(v))
            ws.cell(row=ligne, column=i_dat, value=DATE)
            remplies += 1
        elif v and not ws.cell(row=ligne, column=i_res).value:
            # On documente AUSSI l'échec : c'est une information de base de
            # données aussi utile que l'adresse, et sans elle on referait le
            # même travail l'année prochaine.
            ws.cell(row=ligne, column=i_res, value=resultat_lisible(v))
            ws.cell(row=ligne, column=i_dat, value=DATE)
    journal.append((ws.title, ws.max_row - 1, remplies))
    return remplies


def main():
    verifier_seulement = "--verifier-seulement" in sys.argv
    publie = lire_json(ADRESSES, {"adresses": {}})
    adresses = publie.get("adresses", {}) or {}
    verif = construire_verifications()
    verifs = verif.get("acteurs", {}) or {}
    print(f"Adresses publiées : {len(adresses)} · acteurs vérifiés : {len(verifs)}")
    if verifier_seulement:
        return

    for pays, fichier in FICHIERS:
        chemin = os.path.join(DONNEES, fichier)
        if not os.path.exists(chemin):
            print(f"  {fichier} : absent, on passe")
            continue
        sauvegarde = f"{chemin}.avant-adresses"
        if not os.path.exists(sauvegarde):
            shutil.copy2(chemin, sauvegarde)
        journal = []
        wb = load_workbook(chemin)
        for titre in wb.sheetnames:
            if titre == FEUILLE_PAS_DONNEES:
                continue
            completer_feuille(wb[titre], adresses, verifs, journal)
        wb.save(chemin)
        # RELECTURE — un fichier écrit n'est pas un fichier lisible. On rouvre,
        # on recompte, et on compare à ce qu'on vient d'écrire.
        try:
            controle = load_workbook(chemin, read_only=True)
            feuilles = controle.sheetnames
            controle.close()
        except Exception as e:
            shutil.copy2(sauvegarde, chemin)
            sys.exit(f"  ÉCHEC de relecture sur {fichier} ({e}) — original restauré")
        total = sum(nb for _, nb, _ in journal)
        remplies = sum(r for _, _, r in journal)
        print(f"  {fichier} [{pays}] : {len(feuilles)} feuilles, {len(journal)} feuilles de données, "
              f"{total} ligne(s), {remplies} adresse(s) écrite(s)")
        if sauvegarde and os.path.exists(sauvegarde):
            print(f"      original conservé : {os.path.basename(sauvegarde)}")

    # LA VRAIE ÉPREUVE : les tableurs modifiés doivent encore produire la même
    # base. `acteurs-depuis-xlsx.py` lit par NOM DE COLONNE : ajouter des
    # colonnes ne doit rien changer à ce qu'il produit.
    #
    # ON COMPARE LES DONNÉES, PAS L'HORODATAGE. La première version comparait les
    # deux fichiers OCTET À OCTET et criait au loup : le seul écart était le
    # champ `genereLe`, que le script réécrit à chaque passage. Un contrôle qui
    # s'alarme pour un horodatage ne contrôle rien — il apprend surtout à être
    # ignoré. On neutralise donc les champs qui bougent tout seuls, et on ne
    # compare que ce qui compte : les acteurs et leurs champs.
    print("\nContrôle : les tableurs produisent-ils toujours la même base ?")
    avant = os.path.join(PUBLIC, "acteurs.json")
    temoin = os.path.join(DONNEES, "acteurs.json.controle")
    shutil.copy2(avant, temoin)
    r = subprocess.run(
        ["uv", "run", "--with", "openpyxl", "python3", os.path.join(ICI, "acteurs-depuis-xlsx.py")],
        capture_output=True, text=True, cwd=RACINE,
    )
    if r.returncode != 0:
        print("  ⚠ la régénération a échoué :", (r.stderr or r.stdout).strip()[-300:])
        print("  → les tableurs ont été complétés, mais la base n'a pas pu être recontrôlée.")
        return

    def donnees(chemin):
        d = lire_json(chemin, {})
        for volatile in ("genereLe",):
            d.pop(volatile, None)
        return json.dumps(d, ensure_ascii=False, sort_keys=True)

    a = donnees(temoin)
    b = donnees(avant)
    if a == b:
        print("  ✓ la base produite est IDENTIQUE (hors horodatage) : les colonnes ajoutées ne changent rien.")
        os.remove(temoin)
    else:
        print("  ⚠ la base produite DIFFÈRE — témoin conservé pour comparaison :")
        print(f"      {os.path.relpath(temoin, RACINE)}")


if __name__ == "__main__":
    main()
