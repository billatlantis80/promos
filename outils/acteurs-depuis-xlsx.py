#!/usr/bin/env python3
"""
LES BASES DE MARCHÉ — du (des) tableur(s) à un fichier que le PROJET peut lire.
=============================================================================

CE QUE CE SCRIPT FAIT, ET POURQUOI IL EXISTE
   B a fourni des tableurs : 139 entreprises et organisations du marché belge,
   puis 182 du marché allemand, réparties en 22 catégories chacune, avec 13
   colonnes (positionnement, segment, siège, site web, CA indicatif,
   actionnariat, distribution, remarques).

   Un tableur ne se lit pas depuis un site : le panneau d'administration doit
   pouvoir charger la base en une requête, et la version publiée ne doit jamais
   dépendre de la présence d'Excel. On convertit donc UNE FOIS en JSON, et le
   JSON est versionné avec le projet.

   Les tableurs source restent versionnés eux aussi (donnees/) : c'est la
   provenance. Sans eux, personne ne pourrait plus vérifier d'où viennent les
   chiffres.

POURQUOI UN SCRIPT ET PAS UNE COPIE À LA MAIN
   Une conversion faite à la main se périme au premier ajout d'acteur, et
   personne ne s'en aperçoit. Là, on relance la commande et la base est refaite
   à l'identique — la seule chose qui compte sont les fichiers source.

POURQUOI UNE LISTE DE SOURCES, ET PAS UN FICHIER (ajout du 09/10/2026)
   B : « Peux-tu rajouter cette base de données, AU PAYS CONCERNÉ dans le
   tableau admin ». Un pays = un tableur = une liste de pays. Ajouter un pays
   se fait donc en ajoutant une ligne dans SOURCES, et rien d'autre : chaque
   acteur porte son `pays`, ce que lisent déjà le Marché Euro et l'Affiliation.

   ATTENTION, ET C'EST LE PIÈGE DE CETTE EXTENSION : deux tableurs peuvent
   nommer le MÊME acteur (Lidl est en Belgique et en Allemagne, avec deux sites
   différents — lidl.be et lidl.de). On ne les fusionne donc PAS : ils
   appartiennent à deux marchés et se mesurent séparément. Le dédoublonnage ne
   porte que sur les acteurs AJOUTÉS par l'application, qui, eux, n'ont pas de
   pays de rattachement dans un tableur.

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

# UN PAYS, UN TABLEUR. Ajouter un marché = ajouter une ligne ici.
SOURCES = [
    {"pays": "BE", "fichier": "marche-be-2026-10-08.xlsx"},
    {"pays": "DE", "fichier": "marche-de-2026-10-08.xlsx"},
    {"pays": "FR", "fichier": "marche-fr-2026-10-08.xlsx"},
]
SOURCE_APPLICATION = os.path.join(RACINE, "donnees", "acteurs-application.json")
SORTIE = os.path.join(RACINE, "public", "acteurs.json")

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


def lire_lignes(chemin, pays):
    """Les acteurs d'un tableur de marché, marqués de LEUR pays."""
    wb = load_workbook(chemin, read_only=True, data_only=True)
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
                    sys.exit(f"colonne introuvable dans {os.path.basename(chemin)} : « {titre} »")
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
        # D'OÙ VIENT CET ACTEUR. Le panneau doit pouvoir dire ce qui vient des
        # tableurs de B et ce qui a été ajouté parce que l'application le lit.
        acteur["provenance"] = "fichier"
        # LE PAYS EST CELUI DU TABLEUR, jamais celui deviné sur l'adresse : un
        # acteur du marché allemand reste allemand même si son siège est à
        # Dublin (Temu) ou à Singapour (Shein). C'est le marché qu'on décrit.
        acteur["pays"] = pays
        lignes.append(acteur)
    return lignes


def lire_acteurs_application():
    """Les acteurs LUS par l'application mais absents des tableurs.
    Liste tenue dans `donnees/acteurs-application.json` et ÉTABLIE PAR MESURE
    (outils/mesure-acteurs-manquants.mjs) : ce sont les sites que le collecteur
    interroge vraiment et qu'aucun acteur des tableurs ne revendique. Pourquoi un
    second fichier, et pas une retouche des tableurs : les tableurs sont la pièce
    fournie par B — on ne les modifie pas. Chaque acteur garde donc son origine.
    """
    if not os.path.exists(SOURCE_APPLICATION):
        return []
    with open(SOURCE_APPLICATION, encoding="utf-8") as f:
        base = json.load(f)
    return base.get("acteurs", [])


def main():
    par_fichier = []
    for s in SOURCES:
        chemin = os.path.join(RACINE, "donnees", s["fichier"])
        if not os.path.exists(chemin):
            sys.exit(f"tableur introuvable : {chemin}")
        lignes = lire_lignes(chemin, s["pays"])
        print(f"  {len(lignes):>3} acteurs lus dans {s['fichier']} (pays {s['pays']})")
        par_fichier.append((s, lignes))

    du_fichier = [a for _, lignes in par_fichier for a in lignes]
    de_l_application = lire_acteurs_application()

    # DEUX ORIGINES, UNE SEULE BASE. Les tableurs de B, et les acteurs que
    # l'application lit sans qu'ils y figurent. On refuse les doublons UNIQUEMENT
    # pour les acteurs ajoutés par l'application : deux tableurs peuvent
    # légitimement nommer le même acteur dans deux pays (Lidl en BE et en DE),
    # et les fondre ferait disparaître un marché de la liste.
    noms = {a["nom"].strip().lower() for a in du_fichier}
    ajoutes = []
    for a in de_l_application:
        a = dict(a)
        a.setdefault("provenance", "application")
        a.setdefault("pays", "")
        if a["nom"].strip().lower() in noms:
            print(f"⚠ « {a['nom']} » est déjà dans un tableur : non ajouté", file=sys.stderr)
            continue
        ajoutes.append(a)

    acteurs = du_fichier + ajoutes

    # Contrôles de forme : une base amputée doit se signaler ICI, pas trois
    # écrans plus loin quand le panneau ne trouvera plus rien.
    if not acteurs:
        sys.exit("aucun acteur lu — le tableur est-il le bon ?")
    sans_nom = [a for a in acteurs if not a["nom"]]
    if sans_nom:
        sys.exit(f"{len(sans_nom)} ligne(s) sans nom d'enseigne")
    sans_domaine = [a["nom"] for a in acteurs if not a.get("domaines")]
    if sans_domaine:
        print(f"⚠ {len(sans_domaine)} acteur(s) sans domaine exploitable : "
              + ", ".join(sans_domaine[:6]), file=sys.stderr)

    # Ordre STABLE : par pays, puis par catégorie, puis par nom. Un JSON dont
    # l'ordre change à chaque génération rendrait tout diff illisible.
    acteurs.sort(key=lambda a: (a.get("pays") or "", a["categorie"], a["nom"]))

    fichiers = [s["fichier"] for s, _ in par_fichier]
    base = {
        "version": 1,
        # Le marché d'ORIGINE (le premier tableur), et la liste des pays servis.
        "pays": par_fichier[0][0]["pays"] if par_fichier else "",
        "paysCouverts": sorted({a.get("pays") for a in acteurs if a.get("pays")}),
        "source": " + ".join(fichiers),
        "sources": fichiers,
        "sourceApplication": os.path.basename(SOURCE_APPLICATION) if ajoutes else "",
        "genereLe": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "categories": sorted({a["categorie"] for a in acteurs}),
        "acteurs": acteurs,
    }
    with open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(base, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"√ {len(acteurs)} acteurs · {len(base['categories'])} catégories → {SORTIE}")
    par_pays = {}
    for a in acteurs:
        p = a.get("pays") or "?"
        par_pays[p] = par_pays.get(p, 0) + 1
    print("    dont " + " · ".join(f"{len(lignes)} de {s['fichier']}" for s, lignes in par_fichier)
          + f" · {len(ajoutes)} ajoutés par l'application")
    print("    par pays : " + " · ".join(f"{p} {n}" for p, n in sorted(par_pays.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
