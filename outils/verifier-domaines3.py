#!/usr/bin/env python3
"""Disponibilité sur les extensions que le RDAP n'a pas su juger (.eu .be .nl .es
.it .at .co.uk), pour une liste de NOMS passée en argument.

Usage : python3 verifier-domaines3.py "Lucrio,Agorea,Kadimo,Vindio,Zelvio" [extensions...]

Mêmes règles que les deux autres vérificateurs : contrôle positif (google doit
être PRIS) et négatif (charabia doit être LIBRE) PAR extension ; une extension
dont un contrôle échoue est déclarée NON FIABLE et rien n'est conclu pour elle.
Le DNS (serveurs de noms) sert de voie indépendante, et n'est qu'un INDICE.
"""
import json
import re
import socket
import sys
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
CONTROLE_PRIS, CONTROLE_LIBRE = "google", "zzqwxvcontrol91347"
PRIS = ["not available", "status: connect", "registrar:", "registrant:", "created:", "paid", "allocated"]
LIBRE = ["status: free", "no match", "not found", "no entries found", "is free", "available", "no object found"]


def whois(domaine, tld):
    try:
        s = socket.create_connection(("whois.iana.org", 43), timeout=12)
        s.sendall((tld + "\r\n").encode())
        brut = b""
        while True:
            c = s.recv(4096)
            if not c:
                break
            brut += c
        s.close()
        m = re.search(r"^whois:\s*(\S+)", brut.decode("utf-8", "ignore"), re.M)
        if not m:
            return None
        s = socket.create_connection((m.group(1), 43), timeout=12)
        s.sendall((domaine + "\r\n").encode())
        rep = b""
        while True:
            c = s.recv(4096)
            if not c:
                break
            rep += c
        s.close()
        bas = rep.decode("utf-8", "ignore").lower()
        if any(p in bas for p in PRIS):
            return True
        if any(l in bas for l in LIBRE):
            return False
        return None
    except Exception:
        return None


def ns(domaine):
    try:
        url = f"https://dns.google/resolve?name={domaine}&type=NS"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=12) as r:
            d = json.load(r)
        if d.get("Status") == 3:
            return False
        return bool(d.get("Answer"))
    except Exception:
        return None


def main(noms, tlds):
    verdicts = {}
    fiables = []
    for tld in tlds:
        cp, cl = whois(f"{CONTROLE_PRIS}.{tld}", tld), whois(f"{CONTROLE_LIBRE}.{tld}", tld)
        if not (cp is True and cl is False):
            print(f"  .{tld:6s} NON FIABLE (positif={cp} négatif={cl}) — aucune conclusion")
            continue
        fiables.append(tld)
        print(f"  .{tld:6s} contrôles OK")
        for n in noms:
            verdicts[(n, tld)] = whois(f"{n}.{tld}", tld)

    print("\n" + "=" * 90)
    entete = f"{'nom':10s}" + "".join(f"{('.' + t):>9s}" for t in fiables) + "   (whois · DNS)"
    print(entete)
    print("-" * len(entete))
    for n in noms:
        ligne = f"{n:10s}"
        notes = []
        for t in fiables:
            v = verdicts.get((n, t))
            txt = "PRIS" if v is True else ("LIBRE" if v is False else "?")
            ligne += f"{txt:>9s}"
            if v is not True:
                nsv = ns(f"{n}.{t}")
                if nsv is True:
                    notes.append(f".{t} a des serveurs de noms → PRIS (indice DNS)")
                elif v is False and nsv is False:
                    notes.append(f".{t} concordant LIBRE")
        print(ligne + "   " + (" ; ".join(notes[:4]) if notes else ""))
    print("\nExtensions fiables :", ", ".join("." + t for t in fiables))
    print("DNS = voie indépendante ; « aucun serveur de noms » n'est qu'un indice.")


if __name__ == "__main__":
    noms = [x.strip() for x in sys.argv[1].split(",") if x.strip()]
    tlds = sys.argv[2:] or ["eu", "be", "nl", "es", "it", "at", "co.uk"]
    sys.exit(main(noms, tlds))
