#!/usr/bin/env python3
"""Le mot « promo » est-il VRAIMENT le mot des marchés visés ?

On ne se fie pas à l'intuition : on compte, dans les offres réellement collectées,
l'emploi du mot « promo » face au mot LOCAL équivalent (angebot, aanbieding,
oferta, offerta, promocja, erbjudande…). C'est ce que les marchands de chaque pays
écrivent dans leurs propres titres — donc la langue commerciale du marché.

Second point mesuré : « all » est-il un mot dans la langue du pays ? On regarde
s'il apparaît seul dans les titres, et dans quelles langues."""
import json
import re
from collections import defaultdict

d = json.load(open("/opt/data/webdev/projects/promos/data/offres.json", encoding="utf-8"))
o = d.get("offres", d)

# mot local couramment employé pour « promotion / bonne affaire »
LOCAL = {
    "FR": ("offre|bon plan|réduction|reduction|solde", "promo"),
    "BE": ("offre|bon plan|korting|reductie|promotie", "promo"),
    "DE": ("angebot|schnäppchen|schnappchen|rabatt|aktion", "promo"),
    "AT": ("angebot|schnäppchen|rabatt|aktion", "promo"),
    "NL": ("aanbieding|korting|actie|deal", "promo"),
    "ES": ("oferta|descuento|rebaja|chollo", "promo"),
    "IT": ("offerta|sconto|occasione", "promo"),
    "PT": ("oferta|desconto|promoção|promocao", "promo"),
    "PL": ("oferta|promocja|rabat|przecena", "promo"),
    "SE": ("erbjudande|rabatt|rea|kampanj", "promo"),
    "IE": ("offer|deal|discount|sale", "promo"),
    "GB": ("offer|deal|discount|sale", "promo"),
}
# « all » comme mot autonome, par langue présente dans les données
ALL_MOT = {
    "en": r"\ball\b", "de": r"\ball(e|es|en)?\b", "nl": r"\bal(le)?\b",
    "sv": r"\ball(a|t)?\b", "fr": r"\ball\b", "es": r"\bal\b",
    "it": r"\bal\b", "pt": r"\bal\b", "pl": r"\ball\b",
}

par_pays = defaultdict(list)
for x in o:
    par_pays[x.get("pays") or "?"].append(x.get("titre") or "")

print(f"{'pays':6s}{'offres':>8s}{'« promo »':>12s}{'mot local':>12s}   exemple de mot local dominant")
print("-" * 92)
for pays, (local, _) in LOCAL.items():
    titres = par_pays.get(pays, [])
    if not titres:
        print(f"{pays:6s}{0:>8d}{'—':>12s}{'—':>12s}   (aucune offre collectée pour ce pays)")
        continue
    n = len(titres)
    npromo = sum(1 for t in titres if re.search(r"\bpromo", t, re.I))
    nlocal = sum(1 for t in titres if re.search(local, t, re.I))
    # mot local le plus fréquent, pour le citer
    freq = defaultdict(int)
    for t in titres:
        for m in re.finditer("(" + local + ")", t, re.I):
            freq[m.group(1).lower()] += 1
    dominant = ", ".join(f"{m} ({c})" for m, c in sorted(freq.items(), key=lambda x: -x[1])[:3])
    print(f"{pays:6s}{n:>8d}{100*npromo//n:>11d}%{100*nlocal//n:>11d}%   {dominant}")

print("\n« all » comme mot autonome dans les titres :")
for lang, rex in ALL_MOT.items():
    n = sum(1 for t in o if re.search(rex, t.get("titre") or "", re.I))
    print(f"  {lang} : {n:>5d} titre(s)")

print("\nLangues des sources (champ langue des offres) :")
langs = defaultdict(int)
for x in o:
    langs[x.get("langue") or "?"] += 1
print("  " + ", ".join(f"{k} ({v})" for k, v in sorted(langs.items(), key=lambda y: -y[1])[:12]))
