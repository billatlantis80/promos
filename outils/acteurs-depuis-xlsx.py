#!/usr/bin/env python3
"""
LA BASE DU MARCHÉ BELGE — du tableur à un fichier que le PROJET peut lire.
=============================================================================

CE QUE CE SCRIPT FAIT, ET POURQUOI IL EXISTE
   B a fourni un tableur : 139 entreprises et organisations du marché belge,
   réparties en 22 catégories, avec 13 colonnes (positionnement, segment,
   siège, site web, CA indicatif, actionnariat, distribution, remarques).

   Un tableur ne se lit pas depuis un site : le panneau d'administration doit
   pouvoir charger la base en une requête, et la version publiée ne doit jamais
   dépendre de la présence d'Excel. On convertit donc UNE FOIS en JSON, et le
   JSON est versionné avec le projet.

   Le tableur source reste versionné lui aussi (donnees/) : c'est la provenance.
   Sans lui, personne ne pourrait plus vérifier d'où viennent les chiffres.

POURQUOI UN SCRIPT ET PAS UNE COPIE À LA MAIN
   Une conversion faite à la main se périme au premier ajout d'acteur, et
   personne ne s'en aperçoit. Là, on relance la commande et la base est refaite
   à l'identique — la seule chose qui compte est le fichier source.

CE QU'ON AJOUTE, ET CE QU'ON N'INVENTE PAS
   - on ajoute le DOMAINE extrait du site web (« https://www.delhaize.be » →
     « delhaize.be ») : c'est lui qui permettra de relier un acteur à la source
     qui le lit déjà dans l'application ;
   - le suffixe « (à vérifier) » est retiré du domaine — il fait partie de la
     remarque, pas de l'adresse — mais il est CONSERVÉ dans le champ `site`,
     pour qu'on sache que l'adresse n'est pas certaine ;
   - on n'ajoute aucun chiffre, aucune adresse, aucune déduction. Tout ce qui
     sort d'ici était dans le tableur.

LANCEMENT
   uv run --with openpyxl python3 outils/acteurs-depuis-xlsx.py
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

from openpyxl import load_workbook

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, "donnees", "marche-be-2026-10-08.xlsx")
SORTIE = os.path.join(RACINE, "public", "acteurs.json")
PAYS = "BE"

# Les colonnes du tableur, dans l'ordre, et le nom que porte chaque champ dans
# le JSON. L'ordre compte : c'est lui qui fait le pont entre les deux.
COLONNES = [
    ("nom", "Enseigne / entreprise"),
    ("categorie", "Catégorie"),
    ("positionnement", "Positionnement / objectif"),
    ("segment", "Segment"),
    ("type", "Type d'acteur"),
    ("adresse", "Adresse du siège"),
    ("telephone", "Téléphone"),
    ("email", "Email"),
    ("site", "Site web"),
    ("ca", "CA indicatif"),
    ("actionnariat", "Actionnariat / groupe"),
    ("distribution", "Mode de distribution"),
    ("remarques", "Informations clés & remarques"),
]


def domaines(site):
    """TOUS les domaines d'un site, sans le « (à vérifier) » qui suit parfois.

    Plusieurs acteurs en publient PLUSIEURS : « https://www.bongo.be /
    www.wonderbox.be » ou « https://www.socialdeal.be / www.outspot.be ». N'en
    garder qu'un ferait rater la moitié des liaisons avec les sources.

    Le « www. » est retiré : c'est le même site, et deux écritures du même
    domaine ne doivent pas se compter comme deux acteurs. Sans domaine
    exploitable, on rend une liste vide — jamais une devinette.
    """
    if not site:
        return []
    trouves = []
    # On balaie par JETONS, et non par préfixe « http:// » : une adresse peut
    # s'écrire sans protocole, et plusieurs adresses peuvent se suivre. Le
    # balayage par préfixe ne voyait que la première —
    # « https://www.bongo.be / www.wonderbox.be » perdait wonderbox.be.
    for jeton in re.split(r"[\s,;]+", str(site)):
        j = jeton.strip().strip("()[]<>«»\"'")
        j = re.sub(r"^https?://", "", j, flags=re.I).split("/")[0].strip(".")
        # Un domaine a au moins un point, et rien d'autre que des lettres,
        # des chiffres, des tirets et des points. « à » et « vérifier » sont
        # donc écartés sans qu'on ait à connaître la langue du commentaire.
        if not re.match(r"^[a-z0-9-]+(?:\.[a-z0-9-]+)+$", j, re.I):
            continue
        h = re.sub(r"^www\.", "", j.lower())
        if h not in trouves:
            trouves.append(h)
    return trouves


def texte(valeur):
    if valeur is None:
        return ""
    return " ".join(str(valeur).split())


def lire_lignes():
    wb = load_workbook(SOURCE, read_only=True, data_only=True)
    ws = wb["Vue densemble"]
    entetes = None
    index = {}
    lignes = []
    for ligne in ws.iter_rows(values_only=True):
        valeurs = [texte(c) for c in ligne]
        if entetes is None:
            entetes = valeurs
            for cle, titre in COLONNES:
                if titre not in entetes:
                    sys.exit(f"colonne introuvable dans le tableur : « {titre} »")
                index[cle] = entetes.index(titre)
            continue
        if not any(valeurs):
            continue
        acteur = {cle: (valeurs[i] if i < len(valeurs) else "") for cle, i in index.items()}
        liste = domaines(acteur["site"])
        acteur["domaines"] = liste
        # `domaine` = le premier, pour l'affichage ; `domaines` = tous, pour la
        # liaison. Un acteur à deux enseignes doit pouvoir être relié par l'une
        # ou par l'autre.
        acteur["domaine"] = liste[0] if liste else ""
        lignes.append(acteur)
    return lignes


def main():
    if not os.path.exists(SOURCE):
        sys.exit(f"tableur introuvable : {SOURCE}")
    acteurs = lire_lignes()

    # Contrôles de forme : une base amputée doit se signaler ICI, pas trois
    # écrans plus loin quand le panneau ne trouvera plus rien.
    if not acteurs:
        sys.exit("aucun acteur lu — le tableur est-il le bon ?")
    sans_nom = [a for a in acteurs if not a["nom"]]
    if sans_nom:
        sys.exit(f"{len(sans_nom)} ligne(s) sans nom d'enseigne")
    sans_domaine = [a["nom"] for a in acteurs if not a["domaine"]]
    if sans_domaine:
        print(f"⚠ {len(sans_domaine)} acteur(s) sans domaine exploitable : "
              + ", ".join(sans_domaine[:6]), file=sys.stderr)

    # Ordre STABLE : par catégorie puis par nom. Un JSON dont l'ordre change à
    # chaque génération rendrait tout diff illisible.
    acteurs.sort(key=lambda a: (a["categorie"], a["nom"]))

    base = {
        "version": 1,
        "pays": PAYS,
        "source": os.path.basename(SOURCE),
        "genereLe": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "categories": sorted({a["categorie"] for a in acteurs}),
        "acteurs": acteurs,
    }
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(base, f, ensure_ascii=False, indent=1)
        f.write("\n")

    tailles = sorted(
        ((a["categorie"], sum(1 for x in acteurs if x["categorie"] == a["categorie"]))
         for a in acteurs), key=lambda x: x[0])
    print(f"√ {len(acteurs)} acteurs · {len(base['categories'])} catégories → {SORTIE}")
    for cat, n in dict(tailles).items():
        print(f"    {n:>3}  {cat}")


if __name__ == "__main__":
    main()
