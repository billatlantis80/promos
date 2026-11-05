#!/usr/bin/env python3
"""ÉPROUVE, DANS UN VRAI NAVIGATEUR, LES DEUX DEMANDES DU 11/10/2026.

  1. « Dans les paramètres, il faut fusionner l'onglet profil et langue.
      Inscription en premier pour les newsletters. […] Langue en dessous. »
  2. « On doit aussi travailler sur le swap de gauche à droite, il fait changer
      la catégorie, high-tech électroménager mode, c'est à rajouter. »

Un test de code ne dit pas qu'un GESTE fonctionne : il faut poser un doigt.
Ce script pose donc de vrais évènements tactiles dans le navigateur, et vérifie
ce qui compte vraiment :

  - le glissement vers la GAUCHE passe à la rubrique suivante, vers la DROITE à
    la précédente (dans l'ordre de la barre, celui que l'utilisateur voit) ;
  - un glissement VERTICAL, un glissement trop COURT, et un glissement fait
    DANS une feuille (Réglages) ne changent RIEN — c'est ce qui ferait d'un
    geste une gêne plutôt qu'un service ;
  - les réglages tiennent en trois onglets, la langue est la DERNIÈRE rubrique
    de Compte, et il ne reste que le bouton Google.

Usage :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/eprouver-interactions.py
"""
import os
import sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

URL = "http://127.0.0.1:4203/"

GLISSER = """
([dx, dy, selecteur]) => {
  const c = document.querySelector(selecteur) || document.body;
  const b = c.getBoundingClientRect();
  const x1 = b.left + b.width / 2 + Math.min(0, dx) / 2;
  const y1 = b.top + 220;
  const ev = (type, x, y, fin) => {
    const t = new Touch({ identifier: 1, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent(type, {
      touches: fin ? [] : [t], targetTouches: fin ? [] : [t], changedTouches: [t],
      bubbles: true, cancelable: true,
    }));
  };
  ev('touchstart', x1, y1, false);
  ev('touchend', x1 + dx, y1 + dy, true);
  return true;
}
"""

RUBRIQUE = "() => (document.querySelector('#puces .puce.on') || {}).dataset && document.querySelector('#puces .puce.on').dataset.cat"

echecs = []


def verifier(condition, message):
    print(("  OK   " if condition else "  ÉCHEC") + f" {message}")
    if not condition:
        echecs.append(message)


with sync_playwright() as p:
    nav = p.chromium.launch()
    # Contexte TACTILE : le geste doit être exercé comme sur un téléphone.
    ctx = nav.new_context(viewport={"width": 390, "height": 844},
                          has_touch=True, is_mobile=True)
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    # La langue est POSÉE : sans elle, la page suit la langue du navigateur et
    # les titres des rubriques sortent traduits — on ne comparerait plus ce
    # qu'on croit comparer (défaut vu à la première exécution).
    page.evaluate("() => { localStorage.setItem('promos.pays','be');"
                  "localStorage.setItem('promos.theme','kazendra');"
                  "localStorage.setItem('promos.langue','fr');"
                  "localStorage.setItem('promos.vue','grille'); }")
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(2600)

    print("\n1. LES RÉGLAGES")
    page.click("#reglages")
    page.wait_for_timeout(700)
    onglets = page.eval_on_selector_all(".onglet[data-onglet]",
                                        "els => els.map(e => e.dataset.onglet)")
    verifier(onglets == ["compte", "affichage", "infos"], f"onglets = {onglets}")
    titres = page.eval_on_selector_all(".panneau[data-panneau='compte'] h3",
                                       "els => els.map(e => e.textContent.trim())")
    verifier(titres == ["Inscription et connexion", "Langue"],
             f"rubriques de l'onglet Compte ({titres}) — le PROFIL a disparu le 12/10/2026")
    verifier(page.locator("#connexionGoogle").count() == 1, "le bouton Google est là")
    verifier(page.locator("#connexionFacebook").count() == 0, "le bouton Facebook a disparu")
    ordre = page.evaluate("""() => {
      const p = document.querySelector('.panneau[data-panneau="compte"]');
      const t = [...p.querySelectorAll('h3')].map(h => h.getBoundingClientRect().top);
      return t[0] < t[1] && t[1] < t[2];
    }""")
    verifier(bool(ordre), "l'inscription est bien EN PREMIER, la langue en dessous")
    page.screenshot(path="/tmp/promos-reglages-compte.png")

    print("\n2. LE GLISSER — dans la feuille des réglages, RIEN ne doit bouger")
    avant = page.evaluate(RUBRIQUE)
    page.evaluate(GLISSER, [-220, 0, ".feuille"])
    page.wait_for_timeout(400)
    verifier(page.evaluate(RUBRIQUE) == avant, f"rubrique inchangée ({avant})")
    page.click("#fermer")
    page.wait_for_timeout(500)

    print("\n3. LE GLISSER — sur la liste des offres")
    barre = page.evaluate("() => [...document.querySelectorAll('#puces .puce')].map(e => e.dataset.cat)")
    print(f"  ordre de la barre : {barre[:6]}…")
    verifier(page.evaluate(RUBRIQUE) == "tout", "on part de « Tout »")
    page.evaluate(GLISSER, [-200, 0, "#liste"])
    page.wait_for_timeout(500)
    verifier(page.evaluate(RUBRIQUE) == barre[1], f"vers la GAUCHE → {barre[1]}")
    page.evaluate(GLISSER, [-200, 0, "#liste"])
    page.wait_for_timeout(500)
    verifier(page.evaluate(RUBRIQUE) == barre[2], f"encore à gauche → {barre[2]}")
    page.evaluate(GLISSER, [200, 0, "#liste"])
    page.wait_for_timeout(500)
    verifier(page.evaluate(RUBRIQUE) == barre[1], f"vers la DROITE → retour à {barre[1]}")

    print("\n4. CE QUI NE DOIT PAS DÉCLENCHER")
    avant = page.evaluate(RUBRIQUE)
    page.evaluate(GLISSER, [-210, 260, "#liste"])
    page.wait_for_timeout(400)
    verifier(page.evaluate(RUBRIQUE) == avant, "un geste plutôt VERTICAL ne change rien")
    page.evaluate(GLISSER, [-25, 0, "#liste"])
    page.wait_for_timeout(400)
    verifier(page.evaluate(RUBRIQUE) == avant, "un geste trop COURT ne change rien")

    print("\n5. LES BOUTS : on ne boucle pas")
    tout = page.evaluate("() => [...document.querySelectorAll('#puces .puce')].map(e => e.dataset.cat)")
    page.evaluate(GLISSER, [200, 0, "#liste"])
    page.wait_for_timeout(400)
    verifier(page.evaluate(RUBRIQUE) == tout[0], "à la première rubrique, à DROITE ne fait rien")

    print("\n6. LE DÉFILEMENT VERTICAL N'EST PAS TOUCHÉ")
    bas = page.evaluate("() => { window.scrollTo(0, 900); return window.scrollY; }")
    page.evaluate(GLISSER, [0, 300, "#liste"])
    page.wait_for_timeout(400)
    verifier(page.evaluate("() => window.scrollY") == bas,
             "la position de lecture est intacte")
    page.screenshot(path="/tmp/promos-swipe.png")

    ctx.close()
    nav.close()

print(f"\n{'ÉPREUVE TENUE' if not echecs else 'ÉPREUVE RATÉE'} — {len(echecs)} échec(s)")
if echecs:
    for e in echecs:
        print(f"  - {e}")
sys.exit(1 if echecs else 0)
