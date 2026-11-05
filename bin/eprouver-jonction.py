#!/usr/bin/env python3
"""ÉPROUVE, DANS UN VRAI NAVIGATEUR, QUE L'ENCADREMENT DES ONGLETS NE DÉBORDE
PAS SUR LE BANDEAU BLEU DU PANNEAU RÉGLAGES.

B, 11/10/2026 : « c'est l'encadrement total qui dépasse de un demi mm sur
l'encadrement bleu. Ce bug d'affichage n'est que dans les paramètres. L'encadrement
compte, thème et pays, et informations, doit descendre de un demi mm pour être
aligné correctement. » (confirmé : « Oui, c'est celle-là »)

Ce que la mesure a établi, et que cette épreuve verrouille :

  • le trait de 1 px qui ferme la barre des onglets (`#ongletsReglages`) occupait la
    DERNIÈRE ligne du bandeau bleu — il était peint PAR-DESSUS le bleu ;
  • relever la dernière ligne du bleu suffit donc à le voir : avant le correctif,
    elle était bleue (13,59,91) sur les bords et claire (220,228,236) au milieu,
    soit 207 niveaux d'écart ; après, elle est bleue partout (écart ≤ 8) ;
  • la cause du correctif invisible : la marge basse négative de la barre
    s'effondrait avec celle du bandeau — hauteur mesurée 110,56 px avant comme
    après, jusqu'à l'ajout de `display: flow-root`. La hauteur doit donc être
    vérifiée AUSSI, sinon on croit avoir corrigé sans rien changer.

Aucune de ces deux choses ne se lit dans la feuille de style : elles se mesurent à
l'écran, dans le navigateur, sur la page servie. C'est le seul contrôle qui vaille.

Usage :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/eprouver-jonction.py

Sortie : 0 si tout est aligné, 1 sinon (avec le relevé ligne à ligne fautif).
"""
import io
import os
import sys

os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/data/capture/browsers')

from PIL import Image                                            # noqa: E402
from playwright.sync_api import sync_playwright                   # noqa: E402

BASE = os.environ.get('KAZENDRA_LOCAL', 'http://127.0.0.1:4203/')
NAV = ('/opt/hermes/.playwright/chromium_headless_shell-1223/'
       'chrome-headless-shell-linux64/chrome-headless-shell')
TOLERANCE = 8      # bruit de dégradé toléré ; le défaut mesurait 207 niveaux

GEO = """() => {
  const h = document.querySelector('.feuille-haut');
  const o = document.querySelector('#ongletsReglages');
  const rh = h.getBoundingClientRect(), ro = o.getBoundingClientRect();
  return {bandeau_haut: rh.top, bandeau_bas: rh.bottom, bandeau_gauche: rh.left,
          bandeau_droite: rh.right, onglets_bas: ro.bottom, onglets_gauche: ro.left,
          onglets_droite: ro.right,
          trait_onglets: getComputedStyle(o).borderBottomWidth,
          trait_bandeau: getComputedStyle(h).borderBottomWidth};
}"""


def capturer(nav, largeur, dpr, defiler=0):
    """Ouvre les Réglages et rend (image, géométrie, erreurs JS)."""
    ctx = nav.new_context(viewport={'width': largeur, 'height': 832},
                          device_scale_factor=dpr)
    page = ctx.new_page()
    erreurs = []
    page.on('pageerror', lambda e: erreurs.append(str(e)))
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1100)
    if page.is_visible('#paysDemande'):        # premier lancement d'un profil neuf
        page.click('#paysListe .pays-item')
        page.wait_for_timeout(400)
    page.click('#reglages')
    page.wait_for_timeout(800)
    if defiler:
        page.eval_on_selector('.feuille', f'e => e.scrollTop = {defiler}')
        page.wait_for_timeout(400)
    image = Image.open(io.BytesIO(page.screenshot())).convert('RGB')
    geo = page.evaluate(GEO)
    ctx.close()
    return image, geo, erreurs


def ecart_sur_ligne(image, y):
    """Écart maximal entre les bords et le milieu, sur une ligne de l'image."""
    W = image.width
    points = [image.getpixel((3, y)), image.getpixel((W // 2, y)),
              image.getpixel((W - 4, y))]
    gauche, milieu, droite = points
    ecart = max(abs(gauche[c] - milieu[c]) for c in range(3))
    ecart = max(ecart, max(abs(droite[c] - milieu[c]) for c in range(3)))
    return ecart, points


def juger(nom, image, geo, dpr, erreurs, pixels=True):
    """Rend la liste des défauts trouvés (vide = tout est aligné).

    `pixels=False` quand la feuille est DÉFILÉE : la ligne de jonction se mélange
    alors au contenu qui passe sous le bandeau collant (une carte blanche au milieu,
    le fond gris sur les bords) et le relevé ne dit plus rien du trait. Le contrôle
    de géométrie, lui, reste valable.
    """
    defauts = []
    bas_image = round(geo['bandeau_bas'] * dpr)

    # 1. le trait des onglets ne doit pas être au-dessus du bas du bandeau
    if geo['onglets_bas'] < geo['bandeau_bas'] - 0.01:
        defauts.append(
            f"le trait des onglets (bas {geo['onglets_bas']:.2f}) remonte DANS le "
            f"bandeau bleu (bas {geo['bandeau_bas']:.2f}) : "
            f"{geo['bandeau_bas'] - geo['onglets_bas']:.2f} px de recouvrement")
    if float(geo['trait_onglets'].rstrip('px') or 0) <= 0:
        defauts.append('le trait de séparation des onglets a disparu')

    # 2. LA LIGNE DE JONCTION ne doit pas être plus claire au milieu que sur les bords.
    #    Seules les lignes qui portent le BAS du bandeau sont jugées : plus haut, les
    #    pastilles d'onglets (blanches) sont légitimement au milieu du bleu, et un
    #    contrôle sur toute la hauteur signalerait 57 lignes innocentes.
    pires = []
    if pixels:
        for y in range(bas_image, bas_image + 2):
            ecart, points = ecart_sur_ligne(image, y)
            if ecart > TOLERANCE:
                pires.append((y, ecart, points))
    if pires:
        y, ecart, points = max(pires, key=lambda t: t[1])
        defauts.append(
            f'la ligne de jonction du bandeau (ligne {y}) n\'est pas de la même '
            f'couleur sur toute la largeur : {ecart} niveaux '
            f'(bord {points[0]} / milieu {points[1]} / bord {points[2]}) — '
            f"le trait des onglets est peint sur le bleu")

    if erreurs:
        defauts.append('erreurs JavaScript : ' + ' | '.join(erreurs))

    etat = 'ALIGNÉ' if not defauts else 'DÉCALAGE'
    print(f'  {nom:34s} bandeau {geo["bandeau_haut"]:.2f} → {geo["bandeau_bas"]:.2f} '
          f'| trait onglets bas {geo["onglets_bas"]:.2f} '
          f'| largeur bandeau {geo["bandeau_gauche"]:.0f}→{geo["bandeau_droite"]:.0f} '
          f'| trait onglets {geo["onglets_gauche"]:.0f}→{geo["onglets_droite"]:.0f} '
          f'| {etat}')
    for d in defauts:
        print('      ✗', d)
    return defauts


def main():
    if not os.path.exists(NAV):
        print(f'navigateur introuvable : {NAV} — relire le numéro de build '
              f'(ls /opt/hermes/.playwright/)', file=sys.stderr)
        return 1
    with sync_playwright() as p:
        nav = p.chromium.launch(executable_path=NAV)
        cas = [('téléphone 384 px', 384, 1.5, 0),
               ('téléphone 390 px', 390, 3, 0),
               ('téléphone 384 px, défilé', 384, 1.5, 400),
               ('PC 1440 px', 1440, 1, 0)]
        trouves = []
        for i, (nom, largeur, dpr, defiler) in enumerate(cas):
            image, geo, erreurs = capturer(nav, largeur, dpr, defiler)
            image.save(f'/tmp/eprouve-jonction-{i}.png')
            trouves += [f'{nom} : {d}'
                        for d in juger(nom, image, geo, dpr, erreurs,
                                       pixels=(defiler == 0))]
        nav.close()

    print()
    if trouves:
        print(f'ÉCHEC — {len(trouves)} défaut(s) :')
        for t in trouves:
            print('  •', t)
        return 1
    print("RÉUSSITE — l'encadrement des onglets ne déborde pas sur le bandeau bleu, "
          "sur les quatre supports mesurés (téléphone 384 et 390 px, défilé, PC 1440 px).")
    return 0


if __name__ == '__main__':
    sys.exit(main())
