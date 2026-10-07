#!/usr/bin/env python3
"""Disponibilité de domaine pour une liste de noms, sur les extensions des 12 pays
visés + .com/.eu/.app, AVEC un contrôle positif ET un contrôle négatif PAR extension.

Pourquoi ce script :
  - Le skill de vérification de nom documente un incident réel : RDAP annonçait
    « promos.de LIBRE » alors que le whois officiel de DENIC disait l'inverse
    (« Status: connect » = pris). Un contrôle NÉGATIF seul ne l'attrape pas : il
    prouve que le service rejette du charabia, pas qu'il connaît les vrais noms.
    D'où DEUX contrôles par extension :
      positif : google.<tld> DOIT être pris  (sinon le service répond 404 à tout)
      négatif : zzqwxvcontrol91347.<tld> DOIT être libre
  - Une extension dont un contrôle échoue est DÉCLARÉE NON FIABLE et rien n'est
    conclu pour elle : on ne rapporte ni LIBRE ni PRIS.
  - Les points d'entrée RDAP ne sont pas devinés : ils viennent du fichier de
    démarrage officiel de l'IANA (data.iana.org/rdap/dns.json).
  - Repli whois port 43 (via l'IANA) pour les extensions sans RDAP, dont .de.

Usage : python3 verifier-domaines.py nom1 nom2 ...
"""
import json
import re
import socket
import sys
import time
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
BOOTSTRAP = "https://data.iana.org/rdap/dns.json"
CONTROLE_PRIS = "google"          # existe dans toutes ces extensions
CONTROLE_LIBRE = "zzqwxvcontrol91347"
TLDS = ["com", "eu", "app", "be", "de", "nl", "fr", "es", "it", "pt", "pl", "se", "at", "ie", "co.uk"]


def bootstrap():
    """table extension -> URL de base RDAP, depuis l'IANA"""
    with urllib.request.urlopen(urllib.request.Request(BOOTSTRAP, headers=UA), timeout=20) as r:
        d = json.load(r)
    table = {}
    for services in d.get("services", []):
        tlds, urls = services[0], services[1]
        for t in tlds:
            if urls:
                table[t.lower()] = urls[0].rstrip("/") + "/"
    return table


def rdap(base, domaine):
    """code HTTP : 404 libre, 200 pris, autre = inutilisable"""
    try:
        req = urllib.request.Request(base + "domain/" + domaine, headers=UA)
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def whois_port43(domaine, tld):
    """repli : serveur whois de l'extension, demandé à l'IANA"""
    try:
        s = socket.create_connection(("whois.iana.org", 43), timeout=12)
        s.sendall((tld + "\r\n").encode())
        brut = b""
        while True:
            morceau = s.recv(4096)
            if not morceau:
                break
            brut += morceau
        s.close()
        m = re.search(r"^whois:\s*(\S+)", brut.decode("utf-8", "ignore"), re.M)
        if not m:
            return None, "serveur whois introuvable"
        serveur = m.group(1)
        s = socket.create_connection((serveur, 43), timeout=12)
        s.sendall((domaine + "\r\n").encode())
        rep = b""
        while True:
            morceau = s.recv(4096)
            if not morceau:
                break
            rep += morceau
        s.close()
        texte = rep.decode("utf-8", "ignore")
        bas = texte.lower()
        if "status: free" in bas or "no match" in bas or "not found" in bas or "no entries found" in bas:
            return False, f"whois {serveur} : libre"
        if "status: connect" in bas or "domain:" in bas or "regsitrar" in bas or "registrar" in bas:
            return True, f"whois {serveur} : pris"
        return None, f"whois {serveur} : réponse non concluante"
    except Exception as e:
        return None, "whois erreur " + type(e).__name__


def main(noms):
    if not noms:
        print(__doc__)
        return 2
    print("Points d'entrée RDAP : fichier de démarrage de l'IANA")
    try:
        boot = bootstrap()
        print(f"  {len(boot)} extensions connues\n")
    except Exception as e:
        print(f"  ÉCHEC du démarrage RDAP ({e}) — on tente le whois seul\n")
        boot = {}

    verdicts = {n: {} for n in noms}
    fiables = []
    for tld in TLDS:
        base = boot.get(tld)
        canal = "RDAP"
        # --- contrôles PAR extension -----------------------------------------
        if base:
            pos, neg = rdap(base, f"{CONTROLE_PRIS}.{tld}"), rdap(base, f"{CONTROLE_LIBRE}.{tld}")
        else:
            pos, neg = None, None
        ok = (pos == 200 and neg == 404)
        if not ok:
            # repli whois
            pos2, _ = whois_port43(f"{CONTROLE_PRIS}.{tld}", tld)
            neg2, _ = whois_port43(f"{CONTROLE_LIBRE}.{tld}", tld)
            if pos2 is True and neg2 is False:
                canal, ok = "whois", True
            else:
                verdicts_txt = f"  {('.' + tld):8s} NON FIABLE (positif={pos} négatif={neg}) — aucune conclusion"
                print(verdicts_txt)
                continue
        fiables.append(tld)
        print(f"  .{tld:7s} contrôles OK via {canal}")
        for n in noms:
            dom = f"{n}.{tld}"
            if canal == "RDAP":
                code = rdap(base, dom)
                v = "LIBRE" if code == 404 else ("PRIS" if code == 200 else f"?({code})")
            else:
                pris, _ = whois_port43(dom, tld)
                v = "LIBRE" if pris is False else ("PRIS" if pris is True else "?")
            verdicts[n][tld] = v
            time.sleep(0.2)

    print("\n" + "=" * 96)
    entete = f"{'nom':13s}" + "".join(f"{('.' + t):>8s}" for t in fiables)
    print(entete)
    print("-" * len(entete))
    for n in noms:
        ligne = f"{n:13s}" + "".join(f"{verdicts[n].get(t, '—'):>8s}" for t in fiables)
        print(ligne)
    print("\nExtensions fiables :", ", ".join("." + t for t in fiables))
    print("Les extensions écartées n'ont PAS été jugées : mieux vaut un trou qu'un chiffre faux.")
    return 0


if __name__ == "__main__":
    sys.exit(main([a.strip().lower() for a in sys.argv[1:]]))
