#!/usr/bin/env python3
"""MESURE L'AFFICHAGE DU SITE DANS UN NAVIGATEUR, À UNE TAILLE DONNÉE.

Pourquoi cet outil. « Le design est mal proportionné sur PC » est un jugement
visuel : il faut pouvoir le CHIFFRER pour le corriger sans tâtonner, et le
revérifier après. Ce script rend une capture d'écran ET les mesures réelles
(largeurs des cadres, hauteur des cartes, colonnes de la grille, débordement
horizontal) — dans les trois modes d'affichage.

Usage :
    bin/mesurer-pc.py               # 1440 px, site local, trois modes
    bin/mesurer-pc.py 1920 liste    # une seule taille, un seul mode
    bin/mesurer-pc.py 390           # contrôle de non-régression téléphone

Le module playwright n'est PAS dans le python du système : il vit dans le venv
de capture. Lancer :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/mesurer-pc.py
"""
import json
import os
import sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

LARGEUR = int(sys.argv[1]) if len(sys.argv) > 1 else 1440
MODES = [sys.argv[2]] if len(sys.argv) > 2 else ["grille", "liste", "compacte"]
SORTIE = "/tmp/pc"

MESURES = """
() => {
  const w = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
  const h = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
  const offres = [...document.querySelectorAll('.offre')].slice(0, 12);
  const grille = document.querySelector('.grille');
  const fonds = [...document.querySelectorAll('.offre')].slice(0, 3)
      .map((o) => getComputedStyle(o).backgroundColor);
  return {
    fenetre: window.innerWidth,
    debordement_largeur: document.documentElement.scrollWidth - window.innerWidth,
    tete: w('.tete'), tete_hauteur: h('.tete'), barre: w('.barre'), puces: w('.puces'),
    main: w('main'), grille: w('.grille'), pied: w('.pied'),
    offres_affichees: document.querySelectorAll('.offre').length,
    colonnes: grille ? getComputedStyle(grille).gridTemplateColumns.split(' ').length : 0,
    largeurs_offres: offres.map((o) => Math.round(o.getBoundingClientRect().width)),
    hauteurs_offres: offres.map((o) => Math.round(o.getBoundingClientRect().height)),
    visuel: h('.offre .visuel'), bouton: [w('.offre .btn'), h('.offre .btn')],
    titre: h('.offre h3'), bandeau: w('.bandeau'),
    feuille: w('.feuille'),
    fond_carte: fonds[0] || null,
  };
}
"""

with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": LARGEUR, "height": 900},
                          device_scale_factor=1)
    page = ctx.new_page()
    # On écarte la question du pays : sinon elle recouvre la page.
    page.goto("http://127.0.0.1:4203/", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('promos.pays','be')")
    page.evaluate("localStorage.setItem('promos.theme','kazendra')")
    for mode in MODES:
        page.evaluate("(m) => localStorage.setItem('promos.vue', m)", mode)
        page.goto("http://127.0.0.1:4203/", wait_until="networkidle")
        page.wait_for_timeout(2200)
        chemin = f"{SORTIE}/{LARGEUR}-{mode}.png"
        page.screenshot(path=chemin)
        page.screenshot(path=f"{SORTIE}/{LARGEUR}-{mode}-entier.png", full_page=True)
        m = page.evaluate(MESURES)
        m["mode"] = mode
        m["capture"] = chemin
        print(json.dumps(m, ensure_ascii=False))

    # Les deux panneaux qui couvrent l'écran : les Réglages et la question du
    # pays. Ils ont leurs propres largeurs — les mesurer évite de croire qu'ils
    # se rangent tout seuls.
    page.goto("http://127.0.0.1:4203/", wait_until="networkidle")
    page.wait_for_timeout(1800)
    page.click("#reglages")
    page.wait_for_timeout(600)
    # Onglet « Thème et affichage » : c'est là que vivent les grilles de vignettes.
    page.click(".onglet >> nth=2")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{SORTIE}/{LARGEUR}-reglages.png")
    print(json.dumps(page.evaluate("""() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null;
        const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.width)]; };
      const grille = (s) => { const e = document.querySelector(s);
        return e ? getComputedStyle(e).gridTemplateColumns.split(' ').length : null; };
      return { panneau: 'reglages',
        titre: r('.feuille-tete h2'), barre_haut: r('.feuille-haut'),
        themes_colonnes: grille('.themes'), theme: r('.theme'),
        langues_colonnes: grille('.langues'), langue: r('.langue'),
        debordement_largeur: document.documentElement.scrollWidth - window.innerWidth };
    }"""), ensure_ascii=False))

    page.evaluate("localStorage.clear()")
    page.goto("http://127.0.0.1:4203/", wait_until="networkidle")
    page.wait_for_timeout(1800)
    page.screenshot(path=f"{SORTIE}/{LARGEUR}-question-pays.png")
    boite = page.evaluate("""() => {
      const b = [...document.querySelectorAll('.modale-boite, .verrou-boite')]
        .find((e) => e.offsetParent !== null || e.getBoundingClientRect().width > 0);
      if (!b) return { visible: false };
      const liste = b.querySelector('.pays-liste');
      const item = b.querySelector('.pays-item');
      return { visible: true, largeur: Math.round(b.getBoundingClientRect().width),
               colonnes: liste ? getComputedStyle(liste).gridTemplateColumns.split(' ').length : 0,
               pays_largeur: item ? Math.round(item.getBoundingClientRect().width) : 0 };
    }""")
    print(json.dumps({"panneau": "question-pays", **boite}, ensure_ascii=False))
    nav.close()
