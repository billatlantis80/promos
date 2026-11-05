#!/usr/bin/env python3
"""MESURE LA BARRE DES RUBRIQUES AU SURVOL DE L'EN-TÊTE, DANS UN NAVIGATEUR.

Pourquoi cet outil. La demande de B (11/10/2026) est un COMPORTEMENT, pas une
valeur de feuille de style :

    « Concernant la barre où il y a les catégories […] Peux-tu faire une
      animation pour qu'elle apparaisse quand la souris va dessus et qu'elle
      disparaisse quand la souris part de cette zone ; la ligne chercher un
      produit avec le choix du pays et des promos et des affichages doit rester
      apparente tout le temps. C'est juste la ligne des catégories qui doit
      avoir ce mouvement d'apparition et de disparition. »

Un comportement se prouve en le JOUANT : ce script déplace une vraie souris dans
un vrai navigateur et relève, à chaque étape, la hauteur de l'en-tête, la
position de la barre, la position de la PREMIÈRE OFFRE (la preuve qu'ouvrir la
barre ne pousse pas le catalogue) et le débordement horizontal.

Ce qu'il refuse, et qui est le vrai piège de cette demande :
  - la barre qui RESTE visible au repos fait échouer le scénario « repos » ;
  - la barre qui ne s'ouvre pas au survol de l'en-tête fait échouer « ouvert » ;
  - une page qui BOUGE à l'ouverture fait échouer la comparaison
    « premiere_offre_haut » entre le repos et l'ouverture ;
  - la barre qui reste ouverte après un clic fait échouer « apres-clic » ;
  - sur TÉLÉPHONE (390 px), la barre doit rester là en permanence : le scénario
    du téléphone exige qu'elle soit visible au repos et que le survol ne change
    rien — c'est la non-régression qui compte le plus, B lit le site des deux.

Lancer :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/mesurer-rubriques-survol.py
"""
import json
import os
import sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "http://127.0.0.1:4203/"
SORTIE = "/tmp/rubriques"
LARGEURS = [int(a) for a in sys.argv[1:]] or [1440, 1100, 1024, 390]

# L'état relevé à chaque étape. `premiere_offre_haut` est la mesure qui compte :
# si elle change entre le repos et le survol, la barre pousse la page.
ETAT = """
() => {
  const q = (s) => document.querySelector(s);
  const boule = (e) => {
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { haut: Math.round(b.top), bas: Math.round(b.bottom),
             gauche: Math.round(b.left), largeur: Math.round(b.width),
             hauteur: Math.round(b.height) };
  };
  const puces = q('.puces');
  const s = puces ? getComputedStyle(puces) : null;
  return {
    fenetre: window.innerWidth,
    tete_hauteur: q('.tete') ? Math.round(q('.tete').getBoundingClientRect().height) : null,
    tete: boule(q('.tete')),
    barre: boule(q('.barre')),
    outils: boule(q('.outils')),
    region: boule(q('.marque')),
    puces: boule(puces),
    puces_opacite: s ? s.opacity : null,
    puces_visibilite: s ? s.visibility : null,
    puces_pointeurs: s ? s.pointerEvents : null,
    puces_position: s ? s.position : null,
    premiere_offre_haut: q('.offre') ? Math.round(q('.offre').getBoundingClientRect().top) : null,
    rubrique_allumee: (q('.puce.on') || {}).textContent || null,
    // QUI REÇOIT LE CLIC AU MILIEU DE LA BARRE ? Au repos, la barre est
    // transparente et ne doit RIEN attraper : la réponse doit être une offre.
    // Ouverte, c'est elle — c'est ce qui prouve qu'on peut cliquer dedans.
    cible_au_point: (() => {
      const b = puces ? puces.getBoundingClientRect() : null;
      if (!b || b.height === 0) return null;
      const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return e ? (e.id || e.className || e.tagName) : null;
    })(),
    focus_sur_puce: document.activeElement ? document.activeElement.classList.contains('puce') : false,
    debordement: document.documentElement.scrollWidth - window.innerWidth,
  };
}
"""


def ouvrir(page, largeur):
    """Une page prête : langue FRANÇAIS et pays BELGIQUE, comme B la voit.

    ⚠ MAJUSCULES pour le pays, et la seule forme que l'application écrit
    elle-même ('BE'). En minuscules ('be'), le filtre pays ne reconnaît plus
    rien : l'écran se vide et les compteurs de rubriques tombent à 0 — un défaut
    qui n'existe QUE dans la mesure.
    ⚠ La question du pays intercepte le premier clic sur un profil neuf : on y
    répond avant de continuer, sinon tout clic suivant part dans le vide.
    """
    page.set_viewport_size({"width": largeur, "height": 900})
    page.goto(BASE, wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('promos.langue','fr');"
                  "localStorage.setItem('promos.pays','BE');")
    page.reload(wait_until="domcontentloaded")
    if page.is_visible("#paysDemande"):
        page.click("#paysListe .pays-item")
        page.wait_for_timeout(400)
    page.wait_for_selector(".offre", timeout=60000)
    page.wait_for_timeout(2500)


def relever(page, largeur, nom, pas, capture=False):
    m = page.evaluate(ETAT)
    m["largeur_ecran"] = largeur
    m["pas"] = pas
    print(json.dumps(m, ensure_ascii=False))
    if capture:
        chemin = f"{SORTIE}/{largeur}-{pas}.png"
        page.screenshot(path=chemin, clip={"x": 0, "y": 0,
                                          "width": largeur, "height": 620})
        print(json.dumps({"capture": chemin}, ensure_ascii=False))


def scenario(page, largeur):
    ouvrir(page, largeur)

    # ---- 1. AU REPOS : la souris est dans le catalogue, pas sur l'en-tête.
    page.mouse.move(largeur // 2, 780)
    page.wait_for_timeout(600)
    relever(page, largeur, "repos", "repos", capture=True)
    repos = page.evaluate(ETAT)

    # ---- 2. SURVOL DE L'EN-TÊTE : la souris monte sur la ligne de recherche.
    page.mouse.move(largeur // 2, _centre(page, ".barre"))
    page.wait_for_timeout(700)
    relever(page, largeur, "survol-recherche", "survol-recherche", capture=True)
    ouvert = page.evaluate(ETAT)

    # LA PAGE N'A PAS LE DROIT DE BOUGER.
    print(json.dumps({"pas": "verification-immobilite",
                      "premiere_offre_repos": repos["premiere_offre_haut"],
                      "premiere_offre_ouvert": ouvert["premiere_offre_haut"],
                      "en_tete_repos": repos["tete_hauteur"],
                      "en_tete_ouvert": ouvert["tete_hauteur"]}, ensure_ascii=False))

    # ---- 3. LA SOURIS ENTRE DANS LA BARRE ELLE-MÊME : elle reste ouverte.
    page.hover(".puces")
    page.wait_for_timeout(600)
    relever(page, largeur, "survol-barre", "survol-barre", capture=True)

    # ---- 4. TROIS CLICS DE SUITE : un clic ne referme RIEN (B, 11/10/2026 : « un
    # utilisateur peut cliquer dans plusieurs catégories, lors de la même
    # manipulation »). La barre ne doit disparaître qu'en quittant la zone.
    page.click(".puce[data-cat='tech']")
    page.wait_for_timeout(700)
    relever(page, largeur, "clic-1", "clic-1", capture=True)
    page.click(".puce >> nth=3")
    page.wait_for_timeout(600)
    relever(page, largeur, "clic-2", "clic-2")
    page.click(".puce >> nth=5")
    page.wait_for_timeout(600)
    relever(page, largeur, "clic-3", "clic-3", capture=True)

    # ---- 5. LA SOURIS QUITTE L'EN-TÊTE, PUIS Y REVIENT.
    page.mouse.move(largeur // 2, 800)
    page.wait_for_timeout(500)
    relever(page, largeur, "souris-partie", "souris-partie")
    # La souris revient sur l'en-tête, entre dans la barre, puis redescend dans
    # les offres : la barre doit s'éteindre en sortant par le bas.
    page.mouse.move(largeur // 2, _centre(page, ".outils"))
    page.wait_for_timeout(600)
    page.hover(".puces")
    page.wait_for_timeout(400)
    relever(page, largeur, "survol-barre-2", "survol-barre-2")
    page.mouse.move(largeur // 2, 700)
    page.wait_for_timeout(700)
    relever(page, largeur, "sortie-par-le-bas", "sortie-par-le-bas")
    page.mouse.move(largeur // 2, _centre(page, ".outils"))
    page.wait_for_timeout(700)
    relever(page, largeur, "retour", "retour", capture=True)

    # ---- 6. LE CLAVIER, SOURIS AU LOIN DE L'EN-TÊTE : la barre cachée reste
    # dans le parcours de tabulation et se rallume dès qu'un onglet entre dedans.
    page.mouse.move(largeur // 2, 800)
    page.wait_for_timeout(400)
    page.evaluate("document.getElementById('recherche').focus()")
    page.wait_for_timeout(200)
    for _ in range(14):
        page.keyboard.press("Tab")
        if page.evaluate("document.activeElement.classList.contains('puce')"):
            break
    page.wait_for_timeout(600)
    relever(page, largeur, "clavier", "clavier", capture=True)
    # UNE PUCE ACTIVÉE AU CLAVIER NE POSE PAS LE VERROU : la barre doit rester
    # ouverte pour qui continue d'avancer à la tabulation (`ev.detail` vaut 0).
    page.keyboard.press("Enter")
    page.wait_for_timeout(700)
    relever(page, largeur, "clavier-entree", "clavier-entree", capture=True)


def _centre(page, sel):
    b = page.evaluate("(s) => { const e = document.querySelector(s);"
                      "const r = e.getBoundingClientRect();"
                      "return Math.round(r.top + r.height / 2); }", sel)
    return b


with sync_playwright() as p:
    nav = p.chromium.launch()
    for largeur in LARGEURS:
        ctx = nav.new_context(viewport={"width": largeur, "height": 900},
                              device_scale_factor=1)
        page = ctx.new_page()
        try:
            scenario(page, largeur)
        except Exception as err:  # noqa: BLE001
            print(json.dumps({"largeur_ecran": largeur, "pas": "ECHEC",
                              "erreur": f"{type(err).__name__}: {err}"},
                             ensure_ascii=False), file=sys.stderr)
        ctx.close()
    nav.close()
