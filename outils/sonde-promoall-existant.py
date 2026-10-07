#!/usr/bin/env python3
"""Que trouve-t-on DÉJÀ sous « promoall » ? Un nom ne se juge pas seulement sur sa
disponibilité juridique : s'il existe des entreprises qui le portent, la marque
arrive dans un terrain occupé.

On regarde deux choses :
  1. ce qu'il y a sur promoall.com (pris) : une entreprise réelle, ou une page de
     stationnement « domaine à vendre » (ce qui est très différent) ;
  2. ce que remontent les moteurs de recherche pour « promoall » et ses variantes.
"""
import json
import re
import urllib.error
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"}


def page(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=25) as r:
            html = r.read().decode("utf-8", "ignore")
            return r.status, r.geturl(), html
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:
        return 0, url, "ERREUR " + type(e).__name__


def titre(html):
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip()[:120] if m else "(pas de titre)"


def description(html):
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{5,200})', html, re.I)
    return m.group(1)[:160] if m else "(pas de description)"


SITES = ["https://promoall.com", "https://www.promoall.com", "https://promoall.net",
         "https://promoall.org", "https://promoall.io", "https://promo-4all.com"]
print("=== Ce qu'il y a sur les domaines « promoall » déjà pris ===")
for url in SITES:
    st, fin, html = page(url)
    if not html:
        print(f"  {url:34s} {st}  (rien à lire)")
        continue
    txt = html.lower()
    park = any(m in txt for m in ["domain for sale", "buy this domain", "domaine à vendre",
                                  "this domain is for sale", "parked", "sedo", "afternic",
                                  "godaddy.com/domainsearch", "hugedomains"])
    print(f"  {url:34s} {st}   titre : {titre(html)}")
    print(f"      description : {description(html)}")
    print(f"      stationnement / domaine à vendre : {'OUI' if park else 'non — page réelle'}")


def duck(requete):
    url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": requete, "kl": "fr-fr"})
    st, _, html = page(url)
    if not html:
        return st, []
    res = []
    for m in re.finditer(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        lien = urllib.parse.unquote(m.group(1))
        lien = re.sub(r"^.*?uddg=", "", lien).split("&")[0] if "uddg=" in lien else lien
        t = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        res.append((t[:80], lien[:90]))
    return st, res[:8]


for q in ["promoall", '"promo all" promotion site', "promoall avis"]:
    st, res = duck(q)
    print(f"\n=== Recherche « {q} » (HTTP {st}) ===")
    if not res:
        print("  aucun résultat lisible (moteur qui bloque ou aucune réponse)")
    for t, l in res:
        print(f"  - {t}\n      {l}")
