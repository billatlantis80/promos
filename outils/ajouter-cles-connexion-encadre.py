#!/usr/bin/env python3
"""Ajoute 'ou' et la phrase d'accord pour les bons plans aux 9 langues.

Contexte : B veut les boutons Google et Facebook DANS l'encadré de l'inscription,
pour que la case des bons plans vaille aussi pour ces deux chemins.
"""
import re
import sys
from pathlib import Path

CHEMIN = Path("/opt/data/webdev/projects/promos/public/langues.js")
LANGUES = ["fr", "nl", "de", "en", "es", "it", "pt", "pl", "sv"]

PHRASES = {
    "ou": {"fr": "ou", "nl": "of", "de": "oder", "en": "or", "es": "o",
           "it": "o", "pt": "ou", "pl": "lub", "sv": "eller"},
    "Ton accord pour les bons plans est noté : il s'appliquera à l'adresse de ton compte {r}.": {
        "fr": "Ton accord pour les bons plans est noté : il s'appliquera à l'adresse de ton compte {r}.",
        "nl": "Je akkoord voor de koopjes is genoteerd: het geldt voor het adres van je {r}-account.",
        "de": "Deine Zustimmung zu den Angeboten ist vermerkt: Sie gilt für die Adresse deines {r}-Kontos.",
        "en": "Your consent for the deals is noted: it will apply to your {r} account address.",
        "es": "Tu consentimiento para las ofertas queda anotado: se aplicará a la dirección de tu cuenta de {r}.",
        "it": "Il tuo consenso per le offerte è annotato: si applicherà all'indirizzo del tuo account {r}.",
        "pt": "O teu consentimento para as promoções está anotado: vai aplicar-se ao endereço da tua conta {r}.",
        "pl": "Twoja zgoda na okazje została odnotowana: będzie dotyczyć adresu twojego konta {r}.",
        "sv": "Ditt samtycke till erbjudandena är noterat: det gäller adressen till ditt {r}-konto.",
    },
}


def littéral(s: str) -> str:
    if "'" in s and '"' not in s:
        return '"' + s + '"'
    if '"' in s and "'" not in s:
        return "'" + s + "'"
    if "'" in s and '"' in s:
        return '"' + s.replace('"', '\\"') + '"'
    return "'" + s + "'"


source = CHEMIN.read_text(encoding="utf-8")
if all(source.count(littéral(p) + ":") >= 9 for p in PHRASES):
    print("Déjà fait.")
    sys.exit(0)

debut = source.index("const EXTRA = {")
fin = source.index("\n};", debut)
bloc = source[debut:fin]
motif = re.compile(r"\n  (fr|nl|de|en|es|it|pt|pl|sv): \{\n")
bornes = [(m.group(1), m.end()) for m in motif.finditer(bloc)]
if [c for c, _ in bornes] != LANGUES:
    print(f"ERREUR : langues trouvées = {[c for c, _ in bornes]}")
    sys.exit(1)

nouveau = bloc
for code, ouverture in reversed(bornes):
    fermeture = nouveau.index("\n  },", ouverture)
    lignes = "".join(f"\n    {littéral(c)}: {littéral(v[code])}," for c, v in PHRASES.items())
    nouveau = nouveau[:fermeture] + lignes + nouveau[fermeture:]

CHEMIN.write_text(source[:debut] + nouveau + source[fin:], encoding="utf-8")

relu = CHEMIN.read_text(encoding="utf-8")
for cle in PHRASES:
    n = relu.count(littéral(cle) + ":")
    print(f"  {'OK' if n >= 9 else 'MANQUANT'} ({n}/9) {cle[:58]}")
    if n < 9:
        sys.exit(1)
print("2/2 phrases présentes dans les 9 langues.")
