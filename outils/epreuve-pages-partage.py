#!/usr/bin/env python3
"""
ÉPREUVE DES PAGES DE PARTAGE — ce que voit un robot, et ce que voit un visiteur.
=================================================================================

DEUX LECTURES, ET LES DEUX COMPTENT :

  1. LE HTML BRUT, tel que le télécharge le robot de WhatsApp / Messenger /
     Signal / Telegram. Ces robots n'exécutent PAS de JavaScript : c'est donc
     cette lecture-là qui décide de la carte affichée. On lit les balises sans
     navigateur, avec la même requête qu'eux.

  2. LA PAGE OUVRERTE DANS UN NAVIGATEUR, pour vérifier que le visiteur voit
     bien l'offre, son prix, son image et le bouton qui mène au marchand.

Et le cas du REPLI : une offre sans visuel doit recevoir la carte générique —
une carte vide s'afficherait comme un lien nu, c'est-à-dire sans marque.

Lancement :
  PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
  /opt/data/capture/venv/bin/python outils/epreuve-pages-partage.py
"""
import http.server
import json
import os
import pathlib
import re
import socketserver
import subprocess
import sys
import threading

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")
RACINE = pathlib.Path("/opt/data/webdev/projects/promos")
DOCS = RACINE / "docs"
PORT = 4287


def servir(rep):
    """Sert `docs/` tel quel : c'est EXACTEMENT ce que GitHub Pages publie."""
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(rep), **k)

        def log_message(self, *a):
            pass

    class Serveur(socketserver.TCPServer):
        # AVANT la construction : `allow_reuse_address` posé APRÈS n'a aucun
        # effet, et le passage suivant tombait sur « Address already in use ».
        allow_reuse_address = True

    srv = Serveur(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def balises(html):
    out = {}
    for m in re.finditer(r'<meta\s+(?:property|name)="((?:og|twitter):[^"]+)"\s+content="([^"]*)"', html):
        out[m.group(1)] = m.group(2)
    return out


def main():
    cat = json.loads((DOCS / "offres.json").read_text(encoding="utf-8"))
    offres = cat["offres"] if isinstance(cat, dict) else cat
    avec_image = next(o for o in offres if o.get("image") and (o.get("lienMarchand") or o.get("lienPage")))
    sans_image = next(o for o in offres if not o.get("image") and (o.get("lienMarchand") or o.get("lienPage")))

    srv = servir(DOCS)
    erreurs, ok = [], True
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            nav = p.chromium.launch()
            page = nav.new_page(viewport={"width": 420, "height": 900})
            page.on("pageerror", lambda e: erreurs.append("JS: " + str(e)))
            api = page.request

            for nom, o in (("AVEC image", avec_image), ("SANS image (repli)", sans_image)):
                url = f"http://127.0.0.1:{PORT}/o/{o['id']}.html"
                print(f"\n===== {nom} — {o['id']} ({o.get('pays')})")
                # 1. LA LECTURE DU ROBOT : pas de navigateur, juste le HTML.
                r = api.get(url)
                if r.status != 200:
                    print(f"  ✗ HTTP {r.status}"); ok = False; continue
                t = balises(r.text())
                for cle in ("og:title", "og:description", "og:image", "og:url", "og:site_name", "og:type"):
                    if not t.get(cle):
                        print(f"  ✗ balise absente : {cle}"); ok = False
                for cle in ("og:title", "og:description", "og:image", "og:url", "og:site_name", "og:type"):
                    if t.get(cle):
                        print(f"  {cle:16} = {t[cle][:88]}")
                if t.get("og:site_name") != "Kazendra":
                    print("  ✗ le nom affiché sur la carte n'est pas Kazendra"); ok = False
                # og:url doit être l'adresse PUBLIQUE, pas celle de l'essai : c'est
                # elle que le robot annonce, et elle doit rester vraie quand la page
                # est servie depuis une autre machine (ici, 127.0.0.1).
                publique = f"https://kazendra.com/o/{o['id']}.html"
                if t.get("og:url") != publique:
                    print(f"  ✗ og:url ({t.get('og:url')}) n'est pas l'adresse publique ({publique})"); ok = False

                attendu = o.get("image")
                if attendu:
                    if not t.get("og:image", "").startswith("https://kazendra.com/"):
                        print(f"  ✗ og:image n'est pas une adresse absolue de Kazendra : {t.get('og:image')}"); ok = False
                    if "carte-kazendra.png" in t.get("og:image", ""):
                        print("  ✗ cette offre A une image mais reçoit la carte générique"); ok = False
                else:
                    if not t.get("og:image", "").endswith("/carte-kazendra.png"):
                        print(f"  ✗ offre sans visuel : la carte générique n'est pas utilisée ({t.get('og:image')})"); ok = False
                    if t.get("og:image:width") != "1200" or t.get("og:image:height") != "630":
                        print("  ✗ la carte générique doit annoncer ses dimensions"); ok = False

                # 2. LA LECTURE DU VISITEUR, dans un vrai navigateur.
                page.goto(url, wait_until="load", timeout=30000)
                vu = page.evaluate("""() => ({
                    titre: (document.querySelector('h1')||{}).innerText || '',
                    image: (document.querySelector('img.v')||{}).getAttribute('src') || '',
                    bouton: (document.querySelector('a.btn')||{}).getAttribute('href') || '',
                    libelle: (document.querySelector('a.btn')||{}).innerText || '',
                    lienSite: (document.querySelector('footer a')||{}).getAttribute('href') || '',
                })""")
                print(f"  navigateur : « {vu['libelle']} » → {vu['bouton'][:78]}")
                print(f"               image vue = {vu['image']}")
                if not vu["titre"].strip():
                    print("  ✗ le titre est vide à l'écran"); ok = False
                if "/o/" in vu["bouton"] or not vu["bouton"].startswith("http"):
                    print("  ✗ le bouton ne mène pas au marchand"); ok = False
                if vu["lienSite"] != "/":
                    print(f"  ✗ le lien du pied de page ne ramène pas au site ({vu['lienSite']})"); ok = False
                # L'image affichée doit être celle de l'offre, ou la carte générique.
                if not attendu and not vu["image"].endswith("carte-kazendra.png"):
                    print("  ✗ le visiteur ne voit pas la carte générique"); ok = False
                if attendu and vu["image"].endswith("carte-kazendra.png"):
                    print("  ✗ le visiteur voit la carte générique au lieu du produit"); ok = False
                page.screenshot(path=f"/tmp/partage-{'avec' if attendu else 'sans'}.png", full_page=True)

            # 3. L'ACCUEIL porte aussi sa carte (sinon un lien vers le site est nu).
            r = api.get(f"http://127.0.0.1:{PORT}/")
            t = balises(r.text())
            print("\n===== ACCUEIL")
            print(f"  og:title = {t.get('og:title')}")
            if t.get("og:site_name") != "Kazendra" or not t.get("og:image", "").endswith("carte-kazendra.png"):
                print("  ✗ l'accueil n'annonce pas sa carte Kazendra"); ok = False

            # 4. LA CARTE ELLE-MÊME se télécharge (un og:image mort = lien nu).
            r = api.get(f"http://127.0.0.1:{PORT}/carte-kazendra.png")
            print(f"  carte-kazendra.png : HTTP {r.status}, {len(r.body())} octets, {r.headers.get('content-type')}")
            if r.status != 200 or not r.headers.get("content-type", "").startswith("image/"):
                print("  ✗ la carte générique ne se télécharge pas comme une image"); ok = False

            nav.close()
    finally:
        srv.shutdown()

    if erreurs:
        print("  ✗ erreurs JavaScript :", erreurs[:3]); ok = False
    print("\ntout est conforme" if ok else "\nil reste des défauts ci-dessus")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
