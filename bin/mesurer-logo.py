#!/usr/bin/env python3
"""LE LOGO, MESURÉ AU NAVIGATEUR : taille, écriture intacte, copie refusée.

B, 11/10/2026, deux demandes :
  « L'image ne peut pas être récupérée par un utilisateur, du site internet...
    Car actuellement si je la déplace elle se copie sur mon pc. »
  « il y a la taille affichée du logo, je trouve qu'il est trop petit, il doit
    être au moins 20 % plus grand, uniquement le logo, pas l'écriture »

On relève donc, à chaque largeur : la taille RENDUE du logo (et le rapport avec
l'ancienne, 32 px sur téléphone / 42 px sur PC), la taille du mot et de
l'accroche (elles ne doivent PAS avoir bougé), la hauteur de l'en-tête, et les
deux verrous de copie — `draggable` et le clic droit, ce dernier essayé pour de
vrai (on envoie l'événement et on regarde s'il est refusé).

Lancer :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/mesurer-logo.py
"""
import json
import os
import sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://127.0.0.1:4203/"
AVANT = {390: 32, 1440: 42}

RELEVE = """
() => {
  const img = document.querySelector('img.logo');
  const mot = document.querySelector('.marque-nom');
  const acc = document.querySelector('.accroche');
  const r = img.getBoundingClientRect();
  // Le clic droit, essayé pour de vrai : l'événement est envoyé et l'on regarde
  // si la page l'a refusé.
  const droit = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  const accepte = img.dispatchEvent(droit);
  const glisser = new Event('dragstart', { bubbles: true, cancelable: true });
  const glisserAccepte = img.dispatchEvent(glisser);
  return {
    logo_rendu: [Math.round(r.width), Math.round(r.height)],
    logo_attribut: [img.getAttribute('width'), img.getAttribute('height')],
    logo_glissable: img.draggable,
    user_drag: getComputedStyle(img).webkitUserDrag || getComputedStyle(img).userDrag || null,
    user_select: getComputedStyle(img).userSelect,
    clic_droit_refuse: !accepte,
    glisser_refuse: !glisserAccepte,
    mot_px: Math.round(parseFloat(getComputedStyle(mot).fontSize)),
    accroche_px: Math.round(parseFloat(getComputedStyle(acc).fontSize)),
    tete_hauteur: Math.round(document.querySelector('.tete').getBoundingClientRect().height),
    premiere_offre: Math.round(document.querySelector('.offre').getBoundingClientRect().top),
    debordement: document.documentElement.scrollWidth - window.innerWidth,
  };
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
        page.wait_for_timeout(2500)
        m = page.evaluate(RELEVE)
        avant = AVANT.get(largeur, 32)
        m["largeur"] = largeur
        m["avant_px"] = avant
        m["gain_pourcent"] = round((m["logo_rendu"][0] / avant - 1) * 100, 1)
        print(json.dumps(m, ensure_ascii=False))
        page.screenshot(path=f"/tmp/logo/logo-{largeur}.png",
                        clip={"x": 0, "y": 0, "width": largeur, "height": 170})
        ctx.close()
    nav.close()
