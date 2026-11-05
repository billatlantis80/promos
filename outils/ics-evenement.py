#!/usr/bin/env python3
"""Génère le fichier .ics d'un événement Kazendra (une VEVENT par date).

Règles fixées par SPEC-EVENEMENT.md §13 :
  · un UID stable et prévisible : kazendra-<id>-<n>@kazendra.com
  · DTSTART / DTEND en TZID=Europe/Brussels (heure locale, jamais UTC en dur)
  · SEQUENCE incrémenté à chaque modification, pour qu'un report se propage
    dans le calendrier de l'utilisateur au lieu de créer un doublon
  · LOCATION = exactement ce que la page affiche (régime d'adresse respecté)
  · lignes pliées à 75 octets, CRLF, échappement RFC 5545

Usage : python3 outils/ics-evenement.py            (démo, écrit dans /tmp)
"""
from __future__ import annotations

import sys
from datetime import datetime, date, time, timedelta

CRLF = "\r\n"


def plier(ligne: str) -> str:
    """Pliage RFC 5545 : 75 octets max par ligne, continuation par espace."""
    octets = ligne.encode("utf-8")
    if len(octets) <= 75:
        return ligne
    morceaux, courant, taille = [], b"", 0
    for ch in ligne:
        o = ch.encode("utf-8")
        if taille + len(o) > 75:
            morceaux.append(courant)
            courant, taille = b"", 0
        courant += o
        taille += len(o)
    if courant:
        morceaux.append(courant)
    return (CRLF + " ").join(m.decode("utf-8") for m in morceaux)


def echapper(texte: str) -> str:
    """Échappement RFC 5545 : antislash, point-virgule, virgule, saut de ligne."""
    return (texte.replace("\\", "\\\\").replace(";", "\\;")
                 .replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n"))


def _dt(d: date, t: time | None) -> str:
    if t is None:
        return d.strftime("%Y%m%d")
    return f"{d:%Y%m%d}T{t:%H%M%S}"


def vevent(evenement: dict, date_unique: dict, index: int, sequence: int) -> list[str]:
    """Une VEVENT = une date de la série."""
    debut, fin = date_unique["debut"], date_unique.get("fin")
    lieu_adresse = evenement["lieu_affiche"]          # déjà décidé par le régime d'adresse
    statut = {"publie": "CONFIRMED", "annule": "CANCELLED", "reporte": "TENTATIVE"}[evenement["etat"]]
    uid = f"kazendra-{evenement['id']}-{index}@kazendra.com"

    lignes = [
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"SEQUENCE:{sequence}",
        f"DTSTAMP:{datetime.now().astimezone():%Y%m%dT%H%M%SZ}",
        f"SUMMARY:{echapper(evenement['titre'])}",
    ]
    if fin and fin.get("heure"):
        lignes += [f"DTSTART;TZID=Europe/Brussels:{_dt(debut['date'], debut['heure'])}",
                   f"DTEND;TZID=Europe/Brussels:{_dt(fin['date'], fin['heure'])}"]
    else:
        # durée par défaut de 2 h : un DTEND absent est valide, un DTEND faux ne l'est pas
        d = datetime.combine(debut["date"], debut["heure"]) + timedelta(hours=2)
        lignes += [f"DTSTART;TZID=Europe/Brussels:{_dt(debut['date'], debut['heure'])}",
                   f"DTEND;TZID=Europe/Brussels:{d:%Y%m%dT%H%M%S}"]
    lignes += [
        f"LOCATION:{echapper(lieu_adresse)}",
        f"URL:{evenement['url']}",
        f"DESCRIPTION:{echapper(evenement['resume'])}",
        f"STATUS:{statut}",
        f"CATEGORIES:{echapper(evenement['categorie_libelle'])}",
        "TRANSP:OPAQUE",
        "END:VEVENT",
    ]
    return lignes


def calendrier(evenement: dict, sequence: int = 0) -> str:
    lignes = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kazendra//Agenda//FR",
              "CALSCALE:GREGORIAN",
              "BEGIN:VTIMEZONE", "TZID:Europe/Brussels",
              "BEGIN:STANDARD", "DTSTART:19701025T030000",
              "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
              "TZNAME:CET", "END:STANDARD",
              "BEGIN:DAYLIGHT", "DTSTART:19700329T020000",
              "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
              "TZNAME:CEST", "END:DAYLIGHT",
              "END:VTIMEZONE"]
    for i, d in enumerate(evenement["dates"], start=1):
        lignes += vevent(evenement, d, i, sequence)
    lignes.append("END:VCALENDAR")
    return CRLF.join(plier(l) for l in lignes) + CRLF


DEMO = {
    "id": "7f3c1a",
    "titre": "Brocante d'automne du quartier Saint-Servais",
    "categorie_libelle": "Fête, kermesse & brocante",
    "url": "https://kazendra.com/evenement/7f3c1a",
    "resume": "Brocante de quartier, 60 emplacements. Organisation : Comité de quartier "
              "Saint-Servais. Aucune vente de place : entrée libre.",
    # régime « lieu public » : l'adresse complète est publiée
    "lieu_affiche": "Place Saint-Servais, 5000 Namur, Belgique",
    "etat": "publie",
    "dates": [
        {"debut": {"date": date(2026, 10, 25), "heure": time(8, 0)},
         "fin": {"date": date(2026, 10, 25), "heure": time(17, 0)}},
        {"debut": {"date": date(2026, 11, 2), "heure": time(8, 0)},
         "fin": {"date": date(2026, 11, 2), "heure": time(17, 0)}},
    ],
}

if __name__ == "__main__":
    sortie = sys.argv[1] if len(sys.argv) > 1 else "/tmp/evenement-demo.ics"
    with open(sortie, "w", encoding="utf-8", newline="") as f:
        f.write(calendrier(DEMO))
    print(f"écrit : {sortie}")
