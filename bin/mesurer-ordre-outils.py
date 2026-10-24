#!/usr/bin/env python3
"""L'ORDRE RÉEL des boutons de la barre d'outils, mesuré au navigateur.

B, 11/10/2026 : « Sur l'affichage PC toujours, il faut inverser le bouton favoris
et thème, le thème doit être juste avant les paramètres. »

L'ordre se lit sur les POSITIONS, pas dans la feuille : on relève la position
horizontale de chaque bouton visible et on les trie. À 1440 px (souris), la
ligne doit se lire portée · affichages · favoris · thème · réglages ; à 390 px
(téléphone), Éco remplace le thème et l'ordre ne doit pas bouger.

Lancer :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/mesurer-ordre-outils.py
"""
import json
import os
import sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://127.0.0.1:4203/"

RELEVE = """
() => {
  const outils = document.querySelector('.outils');
  const nom = (e) => {
    if (e.id) return '#' + e.id;
    if (e.classList.contains('vues')) return 'affichages';
    if (e.tagName === 'SELECT') return 'portee';
    return e.className || e.tagName;
  };
  const visibles = [...outils.children]
    .filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => ({ bouton: nom(e), gauche: Math.round(e.getBoundingClientRect().left) }))
    .sort((a, b) => a.gauche - b.gauche);
  return { ligne: visibles.map((v) => v.bouton), positions: visibles };
}
"""

with sync_playwright() as p:
    nav = p.chromium.launch()
    for largeur in (int(a) for a in sys.argv[1:] or ["1440", "390"]):
        ctx = nav.new_context(viewport={"width": largeur, "height": 900})
        page = ctx.new_page()
        page.goto(BASE, wait_until="domcontentloaded")
        page.evaluate("localStorage.setItem('promos.langue','fr');localStorage.setItem('promos.pays','BE');")
        page.reload(wait_until="domcontentloaded")
        if page.is_visible("#paysDemande"):
            page.click("#paysListe .pays-item")
            page.wait_for_timeout(400)
        page.wait_for_selector(".offre", timeout=60000)
        page.wait_for_timeout(2000)
        m = page.evaluate(RELEVE)
        print(json.dumps({"largeur": largeur, "ligne": m["ligne"]}, ensure_ascii=False))
        if largeur >= 1024:
            page.screenshot(path=f"/tmp/rubriques/ordre-{largeur}.png",
                            clip={"x": 0, "y": 0, "width": largeur, "height": 200})
        ctx.close()
    nav.close()
