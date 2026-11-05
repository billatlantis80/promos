#!/usr/bin/env python3
"""MESURE LES CINQ SUPPORTS, ET PROUVE QU'ON PEUT LES ADAPTER UN PAR UN.

POURQUOI CET OUTIL

    Demande de B, 11/10/2026 : « je ne suis pas totalement satisfait de
    l'affichage sur certains supports. Et j'aimerais pouvoir les adapter un par
    un. Sans toucher à l'infrastructure de l'autre. »

    Le site n'a qu'UNE feuille de style, et l'application Android n'a pas de
    mise en page à elle : c'est une coque WebView qui charge la page embarquée.
    Les cinq supports se ressemblaient donc par construction, et corriger l'un
    pouvait déplacer l'autre sans qu'on s'en aperçoive.

    Ce script rend chaque support MESURABLE séparément. Il relève les mêmes
    grandeurs sur les cinq, et sait rejouer un relevé pour exiger l'égalité :
    c'est la preuve qu'un travail sur un support n'a pas bougé les autres.

LES CINQ SUPPORTS

    La FAMILLE vient de la marque posée sur <html> (app ou site, voir le
    script en tête de public/index.html) ; la TAILLE vient de la largeur.

        app-telephone     app,   largeur < 620 px
        app-tablette      app,   largeur >= 620 px   (y compris en paysage)
        site-telephone    site,  largeur < 620 px
        site-tablette     site,  620 px <= largeur < 1024 px
        site-ordinateur   site,  largeur >= 1024 px

    L'application est interrogée dans ses conditions réelles : la page est
    chargée sur l'hôte virtuel du WebView (appassets.androidplatform.net) et
    ses fichiers sont servis depuis public/, exactement comme l'APK le fait.
    Les données viennent du hub — ici redirigé vers le serveur local, pour que
    le relevé compare la même chose avant et après.

USAGE

    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/mesurer-supports.py [options]

    (aucune option)          relève les cinq supports et écrit les captures
    --temoins FICHIER.json   enregistre le relevé comme référence
    --comparer FICHIER.json  rejoue et échoue si une mesure a changé
    --eprouver               ÉPREUVE D'INDÉPENDANCE : pose une sonde dans
                             chaque zone (voir app.css) et vérifie qu'elle ne
                             déplace QUE son support — 5 sondes, 5 supports
    --support app-telephone  ne relève qu'un support (répétable)
    --mode grille            ne relève qu'un mode (répétable)
    --sans-captures          n'écrit aucune image
"""
import json
import os
import sys
import urllib.request
from urllib.parse import urlsplit

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(RACINE, "public")
LOCAL = "http://127.0.0.1:4203/"
SORTIE = "/tmp/supports"

# L'hôte virtuel du WebView, et le hub vers lequel l'app interroge les données.
HOTE_APP = "appassets.androidplatform.net"
HUB = "kazendra.com"

# (identifiant, famille, [(largeur, hauteur, étiquette), …])
SUPPORTS = [
    ("app-telephone", "app", [(390, 844, "téléphone")]),
    ("app-tablette", "app", [(834, 1194, "tablette portrait"),
                             (1194, 834, "tablette paysage")]),
    ("site-telephone", "site", [(390, 844, "téléphone")]),
    ("site-tablette", "site", [(834, 1194, "tablette portrait"),
                               (900, 1200, "tablette portrait large")]),
    ("site-ordinateur", "site", [(1440, 900, "PC")]),
]

TYPES = {".html": "text/html", ".css": "text/css", ".js": "text/javascript",
         ".json": "application/json", ".svg": "image/svg+xml",
         ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain",
         ".xml": "application/xml", ".webmanifest": "application/manifest+json"}

MESURES = """
() => {
  const el = (s) => document.querySelector(s);
  const w = (s) => { const e = el(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
  const h = (s) => { const e = el(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
  const haut = (s) => { const e = el(s); return e ? Math.round(e.getBoundingClientRect().top) : null; };
  const cs = (s, p) => { const e = el(s); return e ? getComputedStyle(e)[p] : null; };
  const varRacine = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const offres = [...document.querySelectorAll('.offre')].slice(0, 12);
  const grille = el('.grille');
  return {
    fenetre: window.innerWidth,
    debordement_largeur: document.documentElement.scrollWidth - window.innerWidth,
    mode_pose: document.body.dataset.vue || null,
    tete: w('.tete'), tete_hauteur: h('.tete'), tete_top: haut('.tete'),
    barre: w('.barre'), puces: [w('.puces'), h('.puces')],
    main: w('main'), main_top: haut('main'), main_padding: cs('main', 'paddingTop'),
    grille: w('.grille'), grille_ecart: cs('.grille', 'gap'),
    colonnes: grille ? getComputedStyle(grille).gridTemplateColumns.split(' ').length : 0,
    offres_affichees: document.querySelectorAll('.offre').length,
    largeurs_offres: offres.map((o) => Math.round(o.getBoundingClientRect().width)),
    hauteurs_offres: offres.map((o) => Math.round(o.getBoundingClientRect().height)),
    visuel: h('.offre .visuel'), titre: h('.offre h3'),
    bouton: [w('.offre .btn'), h('.offre .btn')],
    bandeau: w('.bandeau'), pied: w('.pied'), pied_top: haut('.pied'),
    feuille: w('.feuille'),
    marque: cs('.marque', 'fontSize'), logo: w('.logo'), accroche: cs('.accroche', 'fontSize'),
    cadre: varRacine('--large'), gout: varRacine('--gout'),
    fond_carte: (() => { const o = el('.offre'); return o ? getComputedStyle(o).backgroundColor : null; })(),
  };
}
"""


def type_de(chemin):
    return TYPES.get(os.path.splitext(chemin)[1].lower(), "application/octet-stream")


def installer_relais(ctx):
    """Sert appassets… depuis public/ et le hub depuis le serveur local.

    C'est ce que fait le WebView : la page vient de l'hôte virtuel, les données
    du hub. Tout le reste (les visuels des marchands) part sur le réseau réel.
    """

    def traiter(route):
        url = route.request.url
        hote = urlsplit(url).hostname or ""
        if hote == HOTE_APP:
            chemin = urlsplit(url).path
            if chemin.startswith("/assets/"):
                chemin = chemin[len("/assets/"):]
            fichier = os.path.join(PUBLIC, chemin)
            if not os.path.isfile(fichier):
                route.fulfill(status=404, body="")
                return
            with open(fichier, "rb") as f:
                route.fulfill(status=200, body=f.read(), content_type=type_de(chemin))
            return
        if hote.endswith(HUB):
            chemin = urlsplit(url).path or "/"
            try:
                with urllib.request.urlopen(LOCAL.rstrip("/") + chemin, timeout=20) as r:
                    route.fulfill(status=r.status, body=r.read(),
                                  content_type=r.headers.get("Content-Type", "application/octet-stream"))
            except Exception:
                route.fulfill(status=404, body="")
            return
        route.continue_()

    ctx.route("**/*", traiter)


def adresse(famille):
    return f"https://{HOTE_APP}/assets/index.html" if famille == "app" else LOCAL


def ouvrir(ctx, famille, mode):
    """Charge la page du support demandé et la laisse se peindre.

    Deux navigations : la première laisse poser les réglages (pays, thème,
    mode d'affichage), que la seconde relit au démarrage. Sans le pays, la
    question du pays recouvre la page et l'on mesurerait une modale.
    """
    page = ctx.new_page()
    page.goto(adresse(famille), wait_until="domcontentloaded")
    page.evaluate("(m) => { localStorage.setItem('promos.pays', 'be');"
                  "localStorage.setItem('promos.theme', 'kazendra');"
                  "localStorage.setItem('promos.vue', m); }", mode)
    page.goto(adresse(famille), wait_until="domcontentloaded")
    page.wait_for_timeout(2400)
    return page


def relever(page):
    return page.evaluate(MESURES)


def main():
    args = sys.argv[1:]
    supports_demandes = [args[i + 1] for i, a in enumerate(args) if a == "--support"]
    modes = [args[i + 1] for i, a in enumerate(args) if a == "--mode"] or ["grille", "liste", "compacte"]
    temoins = next((args[i + 1] for i, a in enumerate(args) if a == "--temoins"), None)
    comparer = next((args[i + 1] for i, a in enumerate(args) if a == "--comparer"), None)
    eprouver = "--eprouver" in args
    captures = "--sans-captures" not in args

    os.makedirs(SORTIE, exist_ok=True)

    with sync_playwright() as p:
        nav = p.chromium.launch()

        if eprouver:
            sys.exit(eprouver_zones(nav, supports_demandes))

        releve = []
        for nom, famille, tailles in SUPPORTS:
            if supports_demandes and nom not in supports_demandes:
                continue
            for larg, haut_, etiquette in tailles:
                ctx = nav.new_context(viewport={"width": larg, "height": haut_},
                                      device_scale_factor=1)
                if famille == "app":
                    installer_relais(ctx)
                for mode in modes:
                    page = ouvrir(ctx, famille, mode)
                    m = relever(page)
                    m["marque"] = page.evaluate("document.documentElement.dataset.support ?? null")
                    if captures:
                        chemin = f"{SORTIE}/{nom}-{larg}x{haut_}-{mode}.png"
                        page.screenshot(path=chemin)
                        m["capture"] = chemin
                    page.close()
                    releve.append({"support": nom, "famille": famille, "etiquette": etiquette,
                                   "largeur_fenetre": larg, "mode": mode, "mesures": m})
                ctx.close()
        nav.close()

    if comparer:
        with open(comparer, encoding="utf-8") as f:
            reference = json.load(f)
        ecarts = []
        index = {(e["support"], e["largeur_fenetre"], e["mode"]): e for e in reference}
        for e in releve:
            cle = (e["support"], e["largeur_fenetre"], e["mode"])
            temoin = index.get(cle)
            if temoin is None:
                continue
            a, b = temoin["mesures"], e["mesures"]
            for champ in sorted(set(a) | set(b)):
                # « marque » est hors comparaison : c'est précisément ce qu'on
                # installe ici (elle vaut null avant, « site » ou « app »
                # après). Tout le reste doit être identique.
                if champ in ("capture", "marque"):
                    continue
                if a.get(champ) != b.get(champ):
                    ecarts.append(f"  {cle[0]} {cle[1]}px {cle[2]} — {champ} : "
                                  f"{a.get(champ)} → {b.get(champ)}")
        if ecarts:
            print("MESURES DÉPLACÉES — un support a bougé :")
            print("\n".join(ecarts))
            sys.exit(1)
        marques = sorted({e["mesures"]["marque"] for e in releve})
        print(f"AUCUN DÉPLACEMENT : {len(releve)} relevés identiques à {comparer}")
        print(f"(marque du support, non comparée : {marques})")
        return

    for e in releve:
        print(json.dumps(e, ensure_ascii=False))

    if temoins:
        with open(temoins, "w", encoding="utf-8") as f:
            json.dump(releve, f, ensure_ascii=False, indent=1)
        print(f"TÉMOINS ÉCRITS : {temoins} ({len(releve)} relevés)")


def eprouver_zones(nav, supports_demandes):
    """POSE UNE SONDE DANS CHAQUE ZONE ET VÉRIFIE QU'ELLE NE DÉPLACE QUE SON SUPPORT.

    C'est l'épreuve qui répond à la demande : « adapter un par un, sans toucher
    à l'infrastructure de l'autre ». Pour chacune des cinq zones déclarées en
    fin de app.css, on pose dans le navigateur une règle de la MÊME portée
    (même préfixe, même palier) qui ajoute 61 px de marge au-dessus du contenu.

    Si l'infrastructure est juste, cette marge n'apparaît que sur le support
    visé : sur les quatre autres, la position du contenu ne bouge pas d'un
    pixel. Une zone mal fermée se trahirait ici.
    """
    import re

    with open(os.path.join(PUBLIC, "app.css"), encoding="utf-8") as f:
        feuille = f.read()
    zones = re.findall(r"/\* DEBUT-ZONE (\S+) \| support=(\S+) \| largeur=(\S+) \| prefixe=(.+?) \*/",
                       feuille)
    if len(zones) != 5:
        print(f"ZONES INTROUVABLES : {len(zones)} au lieu de 5 dans public/app.css")
        return 1

    cibles = [(n, f, t[0][0], t[0][1]) for n, f, t in SUPPORTS
              if not supports_demandes or n in supports_demandes]

    print(f"ZONES DÉCLARÉES : {', '.join(z[0] for z in zones)}")

    pages = {}
    for nom, famille, larg, haut_ in cibles:
        ctx = nav.new_context(viewport={"width": larg, "height": haut_})
        if famille == "app":
            installer_relais(ctx)
        pages[nom] = ouvrir(ctx, famille, "grille")

    def haut_de(page):
        return page.evaluate("""() => {
          const m = document.querySelector('main');
          const carte = document.querySelector('main .offre');
          return [Math.round(carte.getBoundingClientRect().top), getComputedStyle(m).paddingTop];
        }""")

    avant = {nom: haut_de(page) for nom, page in pages.items()}
    ok = True
    for nom_zone, sup_zone, larg_zone, prefixe in zones:
        # La sonde écrit LA MÊME PROPRIÉTÉ que la feuille (le blanc du haut du
        # contenu), avec une autre valeur : elle prouve donc les deux choses à
        # la fois — que la zone ne sort pas de son support, et qu'elle peut
        # corriger une valeur déjà posée sans qu'on réécrive ce qui existe.
        sonde = (f"{palier_de(larg_zone)} {{ {prefixe} main {{ padding-top: 61px; }} }}")
        apres, retombes = {}, {}
        for nom, page in pages.items():
            feuille_sonde = page.add_style_tag(content=sonde)
            page.wait_for_timeout(250)
            apres[nom] = haut_de(page)
            feuille_sonde.evaluate("(e) => e.remove()")
            page.wait_for_timeout(150)
            retombes[nom] = haut_de(page)
        bouges = [n for n in avant if apres[n] != avant[n]]
        revenus = [n for n in avant if retombes[n] == avant[n]]
        juste = (bouges == [nom_zone] if nom_zone in avant else not bouges)
        verdict = "TENUE" if juste else "RATÉE"
        print(f"[{verdict}] zone {nom_zone:16s} → déplacés : "
              f"{', '.join(bouges) if bouges else 'aucun':34s} (attendu : {nom_zone})")
        if nom_zone in apres:
            print(f"         {nom_zone} : blanc du haut du contenu "
                  f"{avant[nom_zone][1]} → {apres[nom_zone][1]}, "
                  f"première carte {avant[nom_zone][0]} px → {apres[nom_zone][0]} px")
        if len(revenus) != len(avant):
            print(f"         ⚠ la sonde retirée laisse un décalage sur {len(avant) - len(revenus)} page(s)")
            juste = ok = False
        if not juste:
            ok = False
    for page in pages.values():
        page.close()
    return 0 if ok else 1


def palier_de(larg_zone):
    """Traduit « 0-619 », « 620-1023 » ou « 1024- » en palier CSS."""
    a, _, b = larg_zone.partition("-")
    if not b:
        return f"@media (min-width: {a}px)"
    if a == "0":
        return f"@media (max-width: {b}px)"
    return f"@media (min-width: {a}px) and (max-width: {b}px)"


if __name__ == "__main__":
    main()
