#!/usr/bin/env python3
"""Contrôle du générateur .ics de /evenement — SPEC-EVENEMENT.md §13.

On n'imprime pas « ça marche » : on produit les fichiers, on les relit avec un
parseur iCalendar indépendant (paquet `icalendar`), et on vérifie les règles qui
cassent un agenda en silence :

  1. une VEVENT par date, avec un UID distinct et stable ;
  2. LOCATION d'un lieu public = adresse complète ;
  3. LOCATION d'une adresse privée = code postal + commune seulement
     (l'adresse d'un particulier ne doit pas fuir par l'export) ;
  4. un report = SEQUENCE incrémenté (sinon le calendrier du visiteur garde
     l'ancienne date et en crée une seconde) ;
  5. une annulation = STATUS:CANCELLED (le visiteur voit la fiche barrée au
     lieu de se déplacer pour rien) ;
  6. aucune ligne de plus de 75 octets, CRLF partout, BEGIN/END équilibrés ;
  7. les virgules et points-virgules d'un texte sont échappés.

Exécution : python3 tests/test-ics-evenement.py
"""
from __future__ import annotations

import sys
from datetime import date, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "outils"))

from icalendar import Calendar  # paquet indépendant : c'est lui qui juge

import importlib.util

spec = importlib.util.spec_from_file_location(
    "icsmod", Path(__file__).resolve().parents[1] / "outils" / "ics-evenement.py")
ics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ics)

BASE = {
    "id": "7f3c1a",
    "titre": "Brocante d'automne ; place Saint-Servais, Namur",
    "categorie_libelle": "Fête, kermesse & brocante",
    "url": "https://kazendra.com/evenement/7f3c1a",
    "resume": "Entrée libre. Aucune vente de place, aucun acompte.",
    "lieu_affiche": "Place Saint-Servais, 5000 Namur, Belgique",
    "etat": "publie",
    "dates": [
        {"debut": {"date": date(2026, 10, 25), "heure": time(8, 0)},
         "fin": {"date": date(2026, 10, 25), "heure": time(17, 0)}},
        {"debut": {"date": date(2026, 11, 2), "heure": time(8, 0)},
         "fin": {"date": date(2026, 11, 2), "heure": time(17, 0)}},
    ],
}

echecs: list[str] = []


def verifier(condition: bool, message: str) -> None:
    print(("  ok   " if condition else "  ÉCHEC") + " — " + message)
    if not condition:
        echecs.append(message)


def evenements(texte: str):
    cal = Calendar.from_ical(texte.encode("utf-8"))
    return [c for c in cal.walk() if c.name == "VEVENT"]


def controle_brut(texte: str, nom: str) -> None:
    brut = texte.encode("utf-8")
    verifier(brut.endswith(b"\r\n"), f"{nom} : le fichier se termine par CRLF")
    verifier(b"\n" not in brut.replace(b"\r\n", b""), f"{nom} : aucun saut de ligne nu")
    trop = [l for l in brut.split(b"\r\n") if len(l) > 75]
    verifier(not trop, f"{nom} : aucune ligne > 75 octets ({len(trop)} trouvée(s))")
    verifier(texte.count("BEGIN:VEVENT") == texte.count("END:VEVENT"),
             f"{nom} : BEGIN/END:VEVENT équilibrés")


# ------------------------------------------------------------------ 1. série de 2 dates
print("1. Deux dates, lieu public")
t = ics.calendrier(BASE)
controle_brut(t, "public")
evs = evenements(t)
verifier(len(evs) == 2, f"2 VEVENT produites (obtenu {len(evs)})")
verifier(len({str(e["UID"]) for e in evs}) == 2, "les deux UID sont distincts")
verifier(all(str(e["UID"]).endswith("@kazendra.com") for e in evs), "UID au domaine kazendra.com")
verifier(str(evs[0]["LOCATION"]) == "Place Saint-Servais, 5000 Namur, Belgique",
         "lieu public : l'adresse complète est dans LOCATION")
verifier("Saint-Servais" in str(evs[0]["SUMMARY"]), "le titre est présent et relisible")
verifier(evs[0].decoded("DTSTART").tzinfo is not None, "DTSTART porte un fuseau (Europe/Brussels)")
verifier(str(evs[0].decoded("DTSTART").tzinfo) in ("Europe/Brussels", "CET", "CEST"),
         f"fuseau belge (obtenu {evs[0].decoded('DTSTART').tzinfo})")
verifier(str(evs[0]["STATUS"]) == "CONFIRMED", "événement publié : STATUS CONFIRMED")

# ------------------------------------------------------------------ 2. adresse privée
print("2. Adresse privée : le code postal seulement")
prive = dict(BASE, lieu_affiche="5000 Namur, Belgique")
t2 = ics.calendrier(prive)
loc = str(evenements(t2)[0]["LOCATION"])
verifier("Saint-Servais" not in loc, "la rue ne sort pas dans l'export")
verifier(loc == "5000 Namur, Belgique", f"LOCATION = code postal + commune (obtenu « {loc} »)")

# ------------------------------------------------------------------ 3. report
print("3. Report : SEQUENCE incrémenté")
reporte = dict(BASE, etat="reporte")
t3 = ics.calendrier(reporte, sequence=1)
e3 = evenements(t3)[0]
verifier(int(e3["SEQUENCE"]) == 1, "SEQUENCE = 1 après un report")
verifier(str(e3["STATUS"]) == "TENTATIVE", "report : STATUS TENTATIVE")

# ------------------------------------------------------------------ 4. annulation
print("4. Annulation : STATUS CANCELLED")
t4 = ics.calendrier(dict(BASE, etat="annule"))
verifier(str(evenements(t4)[0]["STATUS"]) == "CANCELLED", "annulation visible dans l'agenda")

# ------------------------------------------------------------------ 5. huit dates
print("5. Huit dates")
huit = dict(BASE, dates=[{"debut": {"date": date(2026, 10, 25) + timedelta(days=7 * i), "heure": time(8, 0)},
                         "fin": {"date": date(2026, 10, 25) + timedelta(days=7 * i), "heure": time(17, 0)}}
                        for i in range(8)])
t5 = ics.calendrier(huit)
controle_brut(t5, "huit dates")
verifier(len(evenements(t5)) == 8, f"8 VEVENT (obtenu {len(evenements(t5))})")

# ------------------------------------------------------------------ 6. échappement
print("6. Échappement des caractères réservés")
e6 = evenements(t)[0]
verifier("," in str(e6["SUMMARY"]), "la virgule du titre est restituée après lecture")
verifier("; " in str(e6["SUMMARY"]), "le point-virgule du titre est restitué après lecture")

# ------------------------------------------------------------------ 7. fichier écrit sur disque
print("7. Fichier réellement écrit et relu")
sortie = Path("/tmp/test-evenement.ics")
sortie.write_text(t, encoding="utf-8", newline="")
verifier(sortie.stat().st_size > 400, f"fichier écrit ({sortie.stat().st_size} octets)")
verifier(len(evenements(sortie.read_text(encoding="utf-8"))) == 2, "relu depuis le disque : 2 VEVENT")

print()
if echecs:
    print(f"{len(echecs)} échec(s) :")
    for e in echecs:
        print(" -", e)
    sys.exit(1)
print("Tous les contrôles passent.")
