#!/usr/bin/env python3
"""Seconde voie pour les extensions où le RDAP n'a pas donné de contrôle valide :
whois port 43 (marqueurs corrigés) PUIS résolution DNS over HTTPS des serveurs de
noms, qui est une voie INDÉPENDANTE des deux premières.

Ce que chaque voie prouve :
  - RDAP 200/404 avec les DEUX contrôles valides  -> preuve ;
  - whois avec les deux contrôles valides          -> preuve ;
  - DNS : des serveurs de noms (NS) existent      -> le domaine est DÉLÉGUÉ, donc
    enregistré ; pas de NS / NXDOMAIN               -> INDICE seulement (un domaine
    réservé sans zone ne se voit pas). On le dit, on ne le maquille pas.

Usage : python3 verifier-domaines2.py [extensions...]
"""
import json
import re
import socket
import sys
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
NOMS = ["promo4all", "promoall", "promoisland", "promoland"]
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
        # « not available » AVANT « available », sinon on lit l'inverse.
        if any(p in bas for p in PRIS):
            return True
        if any(l in bas for l in LIBRE):
            return False
        return None
    except Exception:
        return None


def ns(donnees):
    try:
        url = f"https://dns.google/resolve?name={donnees}&type=NS"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=12) as r:
            d = json.load(r)
        if d.get("Status") == 3:            # NXDOMAIN
            return False
        return bool(d.get("Answer"))
    except Exception:
        return None


def main(tlds):
    print(f"{'nom':13s}{'ext':7s}{'whois':>10s}{'DNS (NS)':>12s}   conclusion")
    print("-" * 78)
    for tld in tlds:
        # contrôles whois par extension
        cp, cl = whois(f"{CONTROLE_PRIS}.{tld}", tld), whois(f"{CONTROLE_LIBRE}.{tld}", tld)
        whois_valide = (cp is True and cl is False)
        if not whois_valide:
            print(f"{'(contrôles)':13s}{'.' + tld:7s}{'NON FIABLE':>10s}  (positif={cp} négatif={cl}) — whois écarté")
        for n in NOMS:
            dom = f"{n}.{tld}"
            v = whois(dom, tld) if whois_valide else None
            txt = "PRIS" if v is True else ("LIBRE" if v is False else "?")
            nsv = ns(dom)
            dns = "délégué" if nsv is True else ("aucun" if nsv is False else "?")
            if v is True:
                concl = "PRIS (whois)"
            elif nsv is True:
                concl = "PRIS (serveurs de noms présents)"
            elif v is False and nsv is False:
                concl = "LIBRE (whois + DNS concordent)"
            elif v is False:
                concl = "probablement LIBRE (whois seul)"
            else:
                concl = "indéterminé — à vérifier chez le registre"
            print(f"{n:13s}{'.' + tld:7s}{txt:>10s}{dns:>12s}   {concl}")
    print("\nDNS : voie indépendante du whois. « aucun » n'est qu'un INDICE — un domaine")
    print("réservé sans zone ne se voit pas au DNS.")


if __name__ == "__main__":
    ext = sys.argv[1:] or ["eu", "be", "nl", "es", "it", "at", "co.uk", "com"]
    sys.exit(main(ext))
