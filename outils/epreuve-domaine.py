#!/usr/bin/env python3
"""Épreuve réelle du domaine : on ouvre https://kazendra.com/ dans un vrai
navigateur et on lit ce qui s'affiche. Un code 200 sur l'index ne prouve pas que
les offres se dessinent — donc on compte les cartes, on lit l'en-tête, on relève
les erreurs JavaScript et les ressources en échec, et on capture l'écran."""
import json
import sys
from playwright.sync_api import sync_playwright

ERREURS = []


def main():
    with sync_playwright() as p:
        nav = p.chromium.launch()
        page = nav.new_page(viewport={"width": 390, "height": 844})
        page.on("pageerror", lambda e: ERREURS.append("JS: " + str(e)))
        page.on(
            "requestfailed",
            lambda r: ERREURS.append("RÉSEAU: " + r.url + " (" + str(r.failure) + ")"),
        )

        page.goto("https://kazendra.com/", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_selector(".offre", timeout=60000)
        page.wait_for_timeout(1500)

        lecture = page.evaluate(
            """() => {
            const txt = s => { const e = document.querySelector(s); return e ? e.textContent.trim().replace(/\\s+/g,' ') : '(absent)'; };
            return {
              titre: document.title,
              adresse: location.href,
              enTete: [...document.querySelectorAll('header p, header div, .en-tete p, .en-tete div')].slice(0,8).map(e=>e.textContent.trim().replace(/\\s+/g,' ')).filter(Boolean),
              cartes: document.querySelectorAll('.offre').length,
              premiere: txt('.offre'),
              langue: localStorage.getItem('promos.langue'),
              imagesKo: [...document.querySelectorAll('img')].filter(i=>i.complete && i.naturalWidth===0).length,
              images: document.querySelectorAll('img').length,
              feuillesCss: document.styleSheets.length,
              polices: document.fonts ? document.fonts.size : 0,
            };
        }"""
        )
        page.screenshot(path="/tmp/kazendra-live-haut.png")
        page.evaluate("window.scrollTo(0, 950)")
        page.wait_for_timeout(900)
        page.screenshot(path="/tmp/kazendra-live-offres.png")

        # La page d'administration, sur le même domaine.
        page.goto("https://kazendra.com/admin/", wait_until="domcontentloaded", timeout=60000)
        admin = {"titre": page.title(), "champs_mot_de_passe": page.locator("input[type=password]").count()}
        page.screenshot(path="/tmp/kazendra-live-admin.png")

        nav.close()

    print(json.dumps({"lecture": lecture, "admin": admin,
                      "erreurs": ERREURS[:10], "nbErreurs": len(ERREURS)},
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
