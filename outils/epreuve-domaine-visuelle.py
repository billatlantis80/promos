#!/usr/bin/env python3
"""Épreuve visuelle du domaine : on ouvre https://kazendra.com/ dans un vrai
navigateur, on choisit la Belgique et la langue FR (comme un visiteur belge),
on ferme la fenêtre de bienvenue, puis on capture ce que voit l'utilisateur.
Le piège connu : la fenêtre « Where do you shop? » recouvre la page au premier
chargement — une capture prise sans la fermer ne montre PAS les offres."""
import sys
from playwright.sync_api import sync_playwright

ERREURS = []


def main():
    with sync_playwright() as p:
        nav = p.chromium.launch()
        page = nav.new_page(viewport={"width": 390, "height": 844})
        page.on("pageerror", lambda e: ERREURS.append("JS: " + str(e)))
        page.on("requestfailed", lambda r: ERREURS.append("RÉSEAU: " + r.url))

        page.goto("https://kazendra.com/", wait_until="domcontentloaded", timeout=60000)

        # Un visiteur belge francophone : langue FR + pays BE AVANT tout dessin.
        # C'est le seul moyen fiable de ne pas se faire recouvrir par la fenêtre
        # « Where do you shop? » — cliquer une tuile marchait mal (le sélecteur de
        # la barre d'outils contient les mêmes libellés, dans des <option> invisibles).
        page.evaluate("localStorage.setItem('promos.langue','fr'); localStorage.setItem('promos.pays','BE')")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        etat = page.evaluate(
            """() => ({
            titre: document.title,
            adresse: location.href,
            entete: (document.querySelector('header') || {}).innerText
                    ? document.querySelector('header').innerText.replace(/\\s+/g,' ').trim() : '(absent)',
            cartes: document.querySelectorAll('.offre').length,
            rubriques: [...document.querySelectorAll('nav button, .rubriques button')]
                        .map(b=>b.textContent.trim().replace(/\\s+/g,' ')).filter(Boolean).slice(0,12),
            fenetrePaysOuverte: !!document.querySelector('#paysDemande:not([hidden])')
                                && getComputedStyle(document.querySelector('#paysDemande')).display !== 'none',
            langue: localStorage.getItem('promos.langue'),
            pays: localStorage.getItem('promos.pays'),
        })"""
        )
        page.screenshot(path="/tmp/kz-fr-haut.png")
        page.evaluate("window.scrollTo(0, 780)")
        page.wait_for_timeout(1200)
        page.screenshot(path="/tmp/kz-fr-offres.png")

        nav.close()

    print("titre    :", etat["titre"])
    print("adresse  :", etat["adresse"])
    print("langue   :", etat["langue"], "| pays :", etat["pays"])
    print("en-tête  :", etat["entete"])
    print("rubriques:", " · ".join(etat["rubriques"]))
    print("cartes   :", etat["cartes"])
    print("fenêtre pays encore ouverte :", etat["fenetrePaysOuverte"])
    print("erreurs  :", len(ERREURS), ERREURS[:5])
    return 0


if __name__ == "__main__":
    sys.exit(main())
