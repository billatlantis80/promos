#!/usr/bin/env python3
"""Épreuve visuelle du domaine : on ouvre https://kazendra.com/ dans un vrai
navigateur, on choisit la Belgique et la langue FR (comme un visiteur belge),
on ferme la fenêtre de bienvenue, puis on capture ce que voit l'utilisateur.
Le piège connu : la fenêtre « Where do you shop? » recouvre la page au premier
chargement — une capture prise sans la fermer ne montre PAS les offres."""
import re
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
            bandeauClasse: (document.querySelector('#bandeau') || {}).className || '(absent)',
            bandeauTexte: ((document.querySelector('#bandeau') || {}).innerText || '').replace(/\\s+/g,' ').trim(),
            langue: localStorage.getItem('promos.langue'),
            pays: localStorage.getItem('promos.pays'),
        })"""
        )
        page.screenshot(path="/tmp/kz-fr-haut.png")
        page.evaluate("window.scrollTo(0, 780)")
        page.wait_for_timeout(1200)
        page.screenshot(path="/tmp/kz-fr-offres.png")

        # Contre-épreuve : le bandeau doit TOUJOURS savoir prévenir d'un vrai
        # incident. Attention à la subtilité : le bandeau « Hors ligne » ne peut
        # apparaître QUE dans l'application Android, où un instantané figé est
        # embarqué (window.DONNEES). Sur le site web, il n'existe aucun
        # instantané de repli : si les offres sont injoignables, l'application
        # affiche « Impossible de lire les offres (…) » à la place de la liste.
        # On exerce donc LES DEUX chemins, en coupant la source de données :
        route_offres = re.compile(r"offres\.json|api/offres")

        # (a) comme dans l'APK : instantané embarqué + serveur injoignable
        page2 = nav.new_page(viewport={"width": 390, "height": 844})
        page2.add_init_script(
            "window.DONNEES = { offres: [], genereLe: '2026-10-07T20:00:00Z' };"
        )
        page2.route(route_offres, lambda route: route.abort())
        page2.goto("https://kazendra.com/", wait_until="domcontentloaded", timeout=60000)
        page2.evaluate("localStorage.setItem('promos.langue','fr'); localStorage.setItem('promos.pays','BE')")
        page2.reload(wait_until="domcontentloaded")
        page2.wait_for_timeout(6000)
        hors_ligne = page2.evaluate(
            """() => ({
            classe: (document.querySelector('#bandeau') || {}).className || '(absent)',
            texte: ((document.querySelector('#bandeau') || {}).innerText || '').replace(/\\s+/g,' ').trim(),
            vide: ((document.querySelector('#vide') || {}).innerText || '').replace(/\\s+/g,' ').trim().slice(0, 80),
        })"""
        )
        page2.screenshot(path="/tmp/kz-fr-hors-ligne.png")

        # (b) comme sur le web : aucune source, aucun instantané de repli
        page3 = nav.new_page(viewport={"width": 390, "height": 844})
        page3.route(route_offres, lambda route: route.abort())
        page3.goto("https://kazendra.com/", wait_until="domcontentloaded", timeout=60000)
        page3.evaluate("localStorage.setItem('promos.langue','fr')")
        page3.reload(wait_until="domcontentloaded")
        page3.wait_for_timeout(20000)
        sans_source = page3.evaluate(
            """() => ({
            bandeau: ((document.querySelector('#bandeau') || {}).innerText || '').replace(/\\s+/g,' ').trim(),
            vide: ((document.querySelector('#vide') || {}).innerText || '').replace(/\\s+/g,' ').trim().slice(0, 90),
        })"""
        )

        nav.close()

    print("titre    :", etat["titre"])
    print("adresse  :", etat["adresse"])
    print("langue   :", etat["langue"], "| pays :", etat["pays"])
    print("en-tête  :", etat["entete"])
    print("rubriques:", " · ".join(etat["rubriques"]))
    print("cartes   :", etat["cartes"])
    print("fenêtre pays encore ouverte :", etat["fenetrePaysOuverte"])
    print("bandeau  :", etat["bandeauClasse"], "|", repr(etat["bandeauTexte"]))
    print("bandeau hors ligne (comme dans l'APK, offres coupées) :", hors_ligne["classe"], "|", repr(hors_ligne["texte"]))
    print("   écran vide de l'APK :", repr(hors_ligne["vide"]))
    print("sans aucune source (comme sur le web) : bandeau", repr(sans_source["bandeau"]), "| écran :", repr(sans_source["vide"]))
    print("erreurs  :", len(ERREURS), ERREURS[:5])
    return 0


if __name__ == "__main__":
    sys.exit(main())
