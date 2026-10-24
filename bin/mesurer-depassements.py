#!/usr/bin/env python3
"""CHERCHE CE QUI DÉPASSE DANS LES RÉGLAGES.

Demande de B, 12/10/2026 : « on voit clairement que la partie du choix des langues
dépasse par rapport à l'encadré bleu du haut, peux-tu redimensionner correctement ».

Plutôt que de deviner, on parcourt TOUS les éléments visibles des trois onglets et
on relève ceux dont le bord DÉPASSE le bord intérieur de leur parent : c'est la
définition mesurable d'un dépassement. On relève aussi la géométrie du bandeau
bleu, de la barre d'onglets et des cartes, pour comparer les bords.
"""
import os
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")
from playwright.sync_api import sync_playwright

GEOMETRIE = """() => {
  const boite = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { gauche: Math.round(r.left), droite: Math.round(r.right),
             haut: Math.round(r.top), bas: Math.round(r.bottom),
             largeur: Math.round(r.width), hauteur: Math.round(r.height) };
  };
  return {
    feuille: boite('#feuille'),
    entete: boite('#feuille .feuille-haut'),
    onglets: boite('#ongletsReglages'),
    premiereCarte: boite('.panneau:not([hidden]) > .rubrique'),
    cartes: [...document.querySelectorAll('.panneau:not([hidden]) > .rubrique')].map((c) => {
      const r = c.getBoundingClientRect();
      const h = c.querySelector('h3');
      return { titre: h ? h.textContent.trim() : '?', gauche: Math.round(r.left),
               droite: Math.round(r.right), bas: Math.round(r.bottom),
               largeur: Math.round(r.width) };
    }),
  };
}"""

DEPASSEMENTS = """() => {
  const trouves = [];
  const scrut = (el, profondeur) => {
    if (profondeur > 12) return;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') return;
    const pere = el.parentElement;
    if (!pere) return;
    const ps = getComputedStyle(pere);
    const p = pere.getBoundingClientRect();
    const attenduGauche = p.left + parseFloat(ps.paddingLeft) + parseFloat(ps.borderLeftWidth);
    const attenduDroite = p.right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth);
    const r = el.getBoundingClientRect();
    // On tolère 1 px (arrondis d'affichage) et on ignore ce qui est hors flux
    // (position absolute : il est fait pour sortir du flux, comme l'œil des mots
    // de passe ou les flèches).
    if (s.position !== 'absolute' && (r.right > attenduDroite + 1 || r.left < attenduGauche - 1)) {
      trouves.push({
        chemin: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
              + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''),
        parent: pere.tagName.toLowerCase() + (pere.id ? '#' + pere.id : '')
              + (pere.className && typeof pere.className === 'string' ? '.' + pere.className.split(' ')[0] : ''),
        gauche: Math.round(r.left), droite: Math.round(r.right),
        parentGauche: Math.round(attenduGauche), parentDroite: Math.round(attenduDroite),
        depassementDroite: Math.round(r.right - attenduDroite),
        depassementGauche: Math.round(attenduGauche - r.left),
        texte: (el.textContent || '').trim().slice(0, 40),
      });
    }
    for (const e of el.children) scrut(e, profondeur + 1);
  };
  scrut(document.querySelector('#feuille'), 0);
  return trouves;
}"""

with sync_playwright() as p:
    nav = p.chromium.launch()
    for largeur in (1440, 1024, 1100):
        ctx = nav.new_context(viewport={"width": largeur, "height": 900}, locale="fr-FR",
                              timezone_id="Europe/Brussels")
        page = ctx.new_page()
        page.goto("http://127.0.0.1:4203/", wait_until="domcontentloaded")
        page.wait_for_selector(".offre", timeout=40000)
        page.click("#reglages")
        page.wait_for_timeout(700)
        print(f"\n================= ÉCRAN {largeur} px =================")
        for i in range(3):
            page.click(f".onglet:nth-of-type({i + 1})")
            page.wait_for_timeout(500)
            g = page.evaluate(GEOMETRIE)
            print(f"\n-- onglet {i + 1} --")
            for cle in ("entete", "onglets", "feuille"):
                b = g[cle]
                if b:
                    print(f"   {cle:8s} x {b['gauche']} → {b['droite']}  (largeur {b['largeur']})")
            for c in g["cartes"]:
                print(f"   carte {c['titre'][:26]:28s} x {c['gauche']} → {c['droite']}  "
                      f"(largeur {c['largeur']})")
            d = page.evaluate(DEPASSEMENTS)
            if not d:
                print("   dépassement : AUCUN")
            for x in d:
                print(f"   DÉPASSE {x['chemin']} dans {x['parent']} : "
                      f"{x['droite']} > {x['parentDroite']} (+{x['depassementDroite']} px) "
                      f"[{x['texte']!r}]")
        ctx.close()
    nav.close()
