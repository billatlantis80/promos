#!/usr/bin/env python3
"""MESURE, DANS UN VRAI NAVIGATEUR, LES ESPACES VIDES DES RÉGLAGES.

Demande de B, 11/10/2026 : « il faut supprimer tous les espaces blancs, par
exemple point de contact c'est flagrant, il y a deux lignes écrites et 40 lignes
vides, il faut redimensionner les encadrements en fonction du texte et essayer
de aligner le mieux possible. »

Pour chaque carte (.rubrique) des trois onglets on relève :
  • la hauteur totale de la carte ;
  • le bas du dernier enfant VISIBLE (donc le vrai bas du texte) ;
  • l'espace vide sous le texte, en pixels et en « lignes » (une ligne ≈ 19 px).

Usage :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \
      /opt/data/capture/venv/bin/python bin/mesurer-espaces-reglages.py
"""
import os

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

URL = "http://127.0.0.1:4203/"
LARGEUR, HAUTEUR = 1440, 900

MESURE = """() => {
  const lignes = [];
  for (const panneau of ['compte', 'affichage', 'infos']) {
    const bloc = document.querySelector(`.panneau[data-panneau="${panneau}"]`);
    if (!bloc || bloc.hidden) continue;
    for (const carte of bloc.querySelectorAll(':scope > .rubrique')) {
      const b = carte.getBoundingClientRect();
      const h3 = carte.querySelector('h3');
      const style = getComputedStyle(carte);
      const padBas = parseFloat(style.paddingBottom) || 0;
      // Le bas réel du contenu : dernier bord bas parmi tous les descendants
      // qui occupent de la place (et qui sont visibles).
      let basContenu = b.top;
      for (const el of carte.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0 && r.width === 0) continue;
        if (r.bottom > basContenu) basContenu = r.bottom;
      }
      lignes.push({
        onglet: panneau,
        titre: h3 ? h3.textContent.trim() : '?',
        gauche: Math.round(b.left),
        haut: Math.round(b.top),
        largeur: Math.round(b.width),
        hauteur: Math.round(b.height),
        vide: Math.round(b.bottom - basContenu - padBas + (0)),
        lignesVides: Math.round((b.bottom - basContenu - padBas) / 19),
        explication: carte.querySelector('p') ? carte.querySelector('p').textContent.trim().slice(0, 60) : '',
      });
    }
  }
  return lignes;
}"""

with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": LARGEUR, "height": HAUTEUR},
                          locale="fr-FR", timezone_id="Europe/Brussels")
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector(".offre", timeout=40000)
    page.click("#reglages")
    page.wait_for_timeout(700)

    onglets = page.evaluate("() => [...document.querySelectorAll('.onglet')].map(b => b.textContent.trim())")
    print(f"onglets : {onglets}")

    total_vide = 0
    for i, nom in enumerate(onglets):
        page.click(f".onglet:nth-of-type({i + 1})")
        page.wait_for_timeout(600)
        mesures = page.evaluate(MESURE)
        print(f"\n=== ONGLET {nom!r} — {len(mesures)} cartes ===")
        for m in mesures:
            print(f"  {m['titre'][:32]:34s} x={m['gauche']:5d} y={m['haut']:5d} "
                  f"l={m['largeur']:4d} h={m['hauteur']:4d} "
                  f"vide={m['vide']:4d}px ({m['lignesVides']:3d} lignes)")
            total_vide += max(0, m["vide"])
        page.screenshot(path=f"/tmp/reglages-{nom.lower().replace(' ', '-')}-avant.png", full_page=True)
    print(f"\nESPACE VIDE TOTAL DANS LES CARTES : {total_vide} px "
          f"({round(total_vide / 19)} lignes)")
    print("captures : /tmp/reglages-*-avant.png")
    ctx.close()
    nav.close()
