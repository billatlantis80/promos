#!/usr/bin/env python3
"""Épreuve du panneau d'administration : les sites ACTIFS et NON ACTIFS.

On ouvre le panneau dans un vrai navigateur (servi par le hub local), on ferme
l'écran de connexion, on va sur l'onglet « Origines » et on lit ce qui s'affiche.
Un test de fichier ne prouve pas qu'un écran se dessine : c'est la même leçon que
pour le bandeau du site.

Ce qui est contrôlé :
  * les deux listes existent et ne se chevauchent pas ;
  * les annonces comptées dans « Sites actifs » correspondent au catalogue ;
  * chaque site non actif porte une raison lisible ;
  * AUCUN site n'est oublié : actifs + non actifs doivent couvrir les sites suivis.

Usage :
  PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \
  /opt/data/capture/venv/bin/python outils/epreuve-panneau-sites.py [adresse]
"""
import json
import re
import sys
from playwright.sync_api import sync_playwright

ADRESSE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4203/admin/'


def nombre(txt):
    """« 1 234 » → 1234."""
    return int(re.sub(r'[^0-9]', '', txt) or 0)


def main():
    erreurs = []
    with sync_playwright() as p:
        nav = p.chromium.launch()
        page = nav.new_page(viewport={"width": 1180, "height": 1000})
        page.on("pageerror", lambda e: erreurs.append("JS: " + str(e)))

        page.goto(ADRESSE, wait_until="domcontentloaded", timeout=60000)
        # Le panneau est un module : on ne peut pas l'appeler de l'extérieur.
        # On passe donc par SON écran, comme un vrai utilisateur — et c'est mieux :
        # cela exerce aussi la création d'accès, qui est le premier écran.
        page.fill("#aId", "epreuve-automatique")
        page.fill("#aMdp", "mot-de-passe-depreuve-2026")
        page.click("#aOk")
        page.wait_for_selector("#panneau:not([hidden])", timeout=30000)
        # Les blocs se remplissent après lecture de offres.json.
        page.wait_for_function(
            "() => { const e = document.getElementById('mActifs'); return e && e.innerText.trim().length > 0; }",
            timeout=60000,
        )

        page.click("button[data-vue='origines']")
        page.wait_for_timeout(1000)

        lecture = page.evaluate(
            """async () => {
            const t = (id) => { const e = document.getElementById(id); return e ? e.innerText.trim() : '(absent)'; };
            // Les lignes sont lues CELLULE PAR CELLULE : découper le texte à
            // l'espace se trompe dès qu'un nom en contient (« Presse ES (es) »,
            // « Social Deal ») — l'épreuve doit être aussi soignée que le code.
            const lignes = (id) => [...document.querySelectorAll('#' + id + ' tr')].slice(1)
              .map((tr) => [...tr.children].map((td) => td.innerText.trim().replace(/\\s+/g, ' ')));
            const o = await fetch('../offres.json', { cache: 'no-store' }).then((r) => r.json());
            const suivis = new Set((o.sources || []).map((s) => s.nom || s.id));
            return {
              syntheseActifs: t('mActifs'),
              syntheseNonActifs: t('mNonActifs'),
              suivis: [...suivis],
              offres: (o.offres || []).length,
              lignesActifs: lignes('mActifs'),
              lignesNonActifs: lignes('mNonActifs'),
            };
        }"""
        )
        page.screenshot(path="/tmp/panneau-sites.png", full_page=False)
        page.evaluate("document.getElementById('mNonActifs').scrollIntoView({block: 'start'})")
        page.wait_for_timeout(500)
        page.screenshot(path="/tmp/panneau-sites-non-actifs.png")
        nav.close()

    actifs, non_actifs = lecture["lignesActifs"], lecture["lignesNonActifs"]
    noms_actifs = [l[0] for l in actifs]
    noms_non_actifs = [l[0] for l in non_actifs]
    suivis = lecture["suivis"]
    total_actifs = sum(nombre(l[1]) for l in actifs if len(l) > 1)

    print(f"adresse      : {ADRESSE}")
    print(f"suivis       : {len(suivis)} sites   ·   offres au catalogue : {lecture['offres']}")
    print(f"lignes       : {len(actifs)} actifs, {len(non_actifs)} non actifs")
    print(f"somme des annonces des sites actifs : {total_actifs}")
    print()
    print("— Sites actifs (début) —")
    for l in actifs[:12]:
        print("   " + l[0] + "  →  " + " | ".join(l[1:])[:110])
    print(f"   … {max(0, len(actifs) - 12)} autre(s)")
    print()
    print("— Sites non actifs (début) —")
    for l in non_actifs[:14]:
        print("   " + l[0] + "  →  " + " | ".join(l[1:])[:110])
    print(f"   … {max(0, len(non_actifs) - 14)} autre(s)")
    print()
    print("— Synthèses affichées —")
    print("   " + (lecture["syntheseActifs"].splitlines() or [''])[-1])
    print("   " + (lecture["syntheseNonActifs"].splitlines() or [''])[-1])
    print()

    ok = True
    if not actifs:
        print("✗ aucun site actif affiché"); ok = False
    if not non_actifs:
        print("✗ aucun site non actif affiché"); ok = False
    if total_actifs != lecture["offres"]:
        print(f"✗ le total des sites actifs ({total_actifs}) ne correspond pas au catalogue ({lecture['offres']})")
        ok = False
    doubles = set(noms_actifs) & set(noms_non_actifs)
    if doubles:
        print(f"✗ présents dans les deux listes : {sorted(doubles)[:5]}"); ok = False
    oublies = [s for s in suivis if s not in noms_actifs and s not in noms_non_actifs]
    if oublies:
        print(f"✗ sites suivis absents des deux listes : {oublies[:5]}"); ok = False
    sans_raison = [l for l in non_actifs if len(l) < 3 or not l[2]]
    if sans_raison:
        print(f"✗ sites non actifs sans raison : {[l[0] for l in sans_raison][:5]}"); ok = False
    if erreurs:
        print(f"✗ erreurs JavaScript : {erreurs[:3]}"); ok = False
    print("tout est conforme" if ok else "il reste des défauts ci-dessus")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
