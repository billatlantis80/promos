#!/usr/bin/env python3
"""Collisions de boutiques pour les noms candidats.

Deux mesures, deux sources RÉELLES et sans clé :
  1. App Store / iOS  -> API publique de recherche iTunes (renvoie les vrais
     identifiants : bundleId, trackId, nom, éditeur) ;
  2. Google Play      -> page de recherche, où l'on relève les IDENTIFIANTS
     d'application (id=com.xxx.nom). C'est la preuve qui ne se discute pas : un
     identifiant qui contient le nom est une collision démontrée ; un simple air
     de ressemblance n'en est pas une.

Usage : python3 collisions-boutiques.py nom1 nom2 ...
"""
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"}
NS = ["promo4all", "promoall", "promoisland", "promoland"]


def itunes(nom):
    """App Store : API de recherche publique, sans clé, réponses réelles."""
    url = "https://itunes.apple.com/search?" + urllib.parse.urlencode({
        "term": nom, "entity": "software", "limit": "50", "country": "FR"})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        d = json.load(r)
    apps = d.get("results", [])
    # collision DÉMONTRÉE = le nom apparaît dans le bundleId ou le trackName
    proches = [a for a in apps
               if nom.lower() in (a.get("bundleId", "") + a.get("trackName", "")).lower().replace(" ", "")]
    return d.get("resultCount", 0), proches, [f'{a.get("trackName")} — {a.get("bundleId")}' for a in apps[:3]]


def play(nom):
    """Google Play : recherche publique, on relève les identifiants d'application."""
    url = "https://play.google.com/store/search?" + urllib.parse.urlencode(
        {"q": nom, "c": "apps", "hl": "fr", "gl": "BE"})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
            html = r.read().decode("utf-8", "ignore")
    except Exception as e:
        return None, [], [], type(e).__name__
    ids = list(dict.fromkeys(re.findall(r"/store/apps/details\?id=([a-zA-Z0-9_.]+)", html)))
    titres = re.findall(r'\["([A-Za-zÀ-ÿ0-9][^"]{2,45})",null,', html)
    collision = [i for i in ids if nom.lower() in i.lower()]
    titres_col = [t for t in titres if nom.lower() in t.lower().replace(" ", "")]
    return len(ids), collision, titres_col[:3], None


def main(noms):
    for nom in noms:
        print(f"\n===== {nom} =====")
        try:
            n, proches, ex = itunes(nom)
            print(f"App Store (FR) : {n} résultat(s) — collisions démontrées : {len(proches)}")
            if proches:
                for a in proches[:5]:
                    print(f"    ⚠ {a.get('trackName')} — {a.get('bundleId')}")
            print(f"    premiers résultats : {' | '.join(ex)}")
        except Exception as e:
            print(f"App Store : ÉCHEC ({type(e).__name__}) — aucune conclusion")
        n, collision, titres, err = play(nom)
        if n is None:
            print(f"Google Play : ÉCHEC ({err}) — aucune conclusion")
        else:
            print(f"Google Play (BE/FR) : {n} identifiant(s) sur la page — collisions par identifiant : {len(collision)}")
            for c in collision[:5]:
                print(f"    ⚠ {c}")
            if titres:
                print(f"    titres contenant le nom : {' | '.join(titres)}")
    print("\nLecture : un identifiant ou un titre qui CONTIENT le nom = collision démontrée.")
    print("Zéro collision = aucune application dédiée sous ce nom dans la boutique interrogée.")
    print("Limite : la recherche Play couvre la locale demandée (fr/BE), pas les douze pays.")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or NS))
