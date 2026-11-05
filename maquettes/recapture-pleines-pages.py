"""Recapture les vues pleine page des maquettes du hub (1440 px, densité 2).
Utilisé après un changement de jeton de couleur, pour que les captures restent
la vérité de ce que le fichier affiche.
"""
import asyncio
from playwright.async_api import async_playwright

BASE = "/opt/data/webdev/projects/promos/maquettes/"
PAGES = [
    ("accueil.html", "accueil-1440.png"),
    ("tableau-de-bord.html", "tableau-de-bord-1440.png"),
    ("mobile.html", "mobile-390.png"),
    ("annonce.html", "annonce-1440.png"),
    ("immo.html", "immo-1440.png"),
    ("partage.html", "partage-1440.png"),
]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for fichier, sortie in PAGES:
            pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2,
                                  locale="fr-FR")
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("requestfailed", lambda r: errs.append("requestfailed " + r.url))
            await pg.goto("file://" + BASE + fichier, wait_until="networkidle")
            await pg.wait_for_timeout(350)
            m = await pg.evaluate("""() => {
              const coupes = [...document.querySelectorAll('body *')].filter(el =>
                el.children.length === 0 && el.scrollWidth > el.clientWidth + 1)
                .map(el => (el.className || el.tagName) + ' :: ' + el.textContent.trim().slice(0, 36));
              const hors = [...document.querySelectorAll('body *')].filter(el => {
                const r = el.getBoundingClientRect(); return r.right > 1440.5 || r.left < -0.5;
              }).map(el => (el.className || el.tagName));
              return {largeur: document.documentElement.scrollWidth,
                      hauteur: document.documentElement.scrollHeight,
                      coupes: coupes.slice(0, 6), hors_cadre: hors.slice(0, 4)};
            }""")
            await pg.screenshot(path=BASE + sortie, full_page=True)
            print(f"{sortie:28} {m['largeur']}x{m['hauteur']}  coupes={len(m['coupes'])} "
                  f"hors={len(m['hors_cadre'])} erreurs={errs or 'aucune'}")
            await pg.close()
        await b.close()


asyncio.run(main())
