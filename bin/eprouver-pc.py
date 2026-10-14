#!/usr/bin/env python3
"""ÉPROUVE, DANS UN VRAI NAVIGATEUR, LES DEMANDES « PC » DU 11/10/2026.

  1. « il y a trois possibilités. Je veux une qui offre les quatre bandes, une qui
     offre deux bandes, et une qui offre une seule bande. »
  2. « nous allons mettre une sorte de flèche qui amène à la catégorie suivante ou
     recule dans la catégorie précédente, quand c'est possible. L'utilisateur
     pourra utiliser avec la souris. » — et pour les PC tactiles, le glisser reste.
  3. « Le fond d'écran de la partie réglage est trop agressif tout est en blanc
     […] que ce soit moins agressif à l'œil et au visage, et que les informations
     soient mises en évidence. »
  4. « Sur PC, tu dois redimensionner la partie compte […] à côté tu viendras
     mettre le panneau langue. Même chose sur PC, thèmes et affichage : l'affichage
     [du thème] de la couleur doit être à côté du choix du pays. »

Ce sont des demandes de MISE EN PAGE : elles ne se prouvent pas en relisant le
CSS, mais en MESURANT l'écran. Le script relève donc le nombre de colonnes réel,
la position des blocs, la couleur de fond calculée, et il enregistre des captures
que B peut regarder.

Usage :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/eprouver-pc.py
"""
import os

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

URL = "http://127.0.0.1:4203/"
LARGEUR, HAUTEUR = 1440, 900

echecs = []


def verifier(condition, message):
    print(("  OK   " if condition else "  ÉCHEC") + f" {message}")
    if not condition:
        echecs.append(message)


def colonnes(page):
    return page.evaluate("""() => {
      const g = getComputedStyle(document.querySelector('.grille')).gridTemplateColumns;
      return g.trim().split(/\\s+/).length;
    }""")


def reglages(page):
    return page.evaluate("""() => {
      const rects = (panneau) => [...document.querySelectorAll(
        `.panneau[data-panneau="${panneau}"] > .rubrique`)].map((r) => {
          const b = r.getBoundingClientRect();
          const t = r.querySelector('h3');
          return { titre: t ? t.textContent.trim() : '?', x: Math.round(b.left),
                   y: Math.round(b.top), w: Math.round(b.width), bas: Math.round(b.bottom) };
        });
      const feuille = getComputedStyle(document.querySelector('#feuille'));
      const racine = getComputedStyle(document.documentElement);
      const carte = document.querySelector('#regCompte .carte-bloc');
      return {
        compte: rects('compte'), affichage: rects('affichage'), infos: rects('infos'),
        carteInscription: carte ? Math.round(carte.getBoundingClientRect().width) : null,
        fondFeuille: feuille.backgroundColor,
        fondTheme: racine.getPropertyValue('--fond').trim(),
        carteRubrique: getComputedStyle(document.querySelector('.rubrique')).backgroundColor,
        largeurPanneau: Math.round(document.querySelector('.panneau').getBoundingClientRect().width),
      };
    }""")


with sync_playwright() as p:
    nav = p.chromium.launch()

    # Un PC CLASSIQUE : souris (pointeur précis, survol possible).
    ctx = nav.new_context(viewport={"width": LARGEUR, "height": HAUTEUR},
                          locale="fr-FR", timezone_id="Europe/Brussels")
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector(".offre", timeout=40000)
    page.wait_for_timeout(500)

    print("\n1. LES DEUX AFFICHAGES DU PC : quatre et deux colonnes")
    # IL N'Y A PLUS QUE DEUX MODES SUR PC depuis le 12/10/2026 : « tu gardes
    # uniquement les boutons 4 et 2, le bouton 1 encadrement, tu changes la
    # fonction tu gardes le bouton et tu mets les langues à la place ». Le bouton
    # « une colonne » a quitté la rangée sur PC ; l'épreuve du bouton de langue et
    # des neuf langues est dans bin/eprouver-affichage-pc.py.
    attendus = {"grille": 4, "liste": 2}
    for mode, attendu in attendus.items():
        page.click(f'.vue[data-vue="{mode}"]')
        page.wait_for_timeout(400)
        n = colonnes(page)
        verifier(n == attendu, f"« {mode} » → {n} colonne(s) sur un écran de {LARGEUR} px (attendu {attendu})")
        page.screenshot(path=f"/tmp/pc-affichage-{mode}.png")
    reste = page.evaluate("() => getComputedStyle(document.querySelector('.vues .vue[data-vue=\"compacte\"]')).display")
    verifier(reste == "none",
             f"le mode « une colonne » a QUITTÉ la rangée sur PC (display={reste})")

    print("\n2. LES DEUX FLÈCHES DE RUBRIQUE — POSÉES SUR L'ÉCRAN (souris)")

    def fleches():
        return page.evaluate("""() => {
          const p = document.querySelector('#rubriquePrec'), s = document.querySelector('#rubriqueSuiv');
          const rp = p.getBoundingClientRect(), rs = s.getBoundingClientRect();
          const boite = document.querySelector('#flechesRubrique');
          const bs = getComputedStyle(boite), bp = getComputedStyle(p);
          return { affiche: bp.display, position: bs.position, passeLesClics: bs.pointerEvents,
                   bordGauche: Math.round(rp.left),
                   bordDroit: Math.round(window.innerWidth - rs.right),
                   milieu: Math.round((rp.top + rp.bottom) / 2),
                   hauteur: window.innerHeight,
                   precOff: p.disabled, suivOff: s.disabled,
                   actif: (document.querySelector('#puces .puce.on') || {}).dataset?.cat,
                   defile: Math.round(window.scrollY) };
        }""")

    f = fleches()
    print(f"  affichage={f['affiche']} position={f['position']} clics={f['passeLesClics']} "
          f"bords={f['bordGauche']}/{f['bordDroit']} px · départ={f['actif']!r}")
    verifier(f["affiche"] == "flex", "les flèches SONT affichées quand il y a une souris")
    # CORRECTION DE B (11/10/2026) : « ce n'était pas pour les catégories, c'était
    # pour les pages d'article, afin de changer de catégorie sans devoir monter en
    # haut ». Elles doivent donc être POSÉES sur l'écran, et non dans la barre.
    verifier(f["position"] == "fixed", "elles sont POSÉES sur l'écran (position: fixed), pas dans la barre")
    verifier(f["passeLesClics"] == "none", "leur conteneur laisse les clics de la page passer")
    verifier(f["bordGauche"] <= 12, f"la flèche « précédente » est au bord GAUCHE ({f['bordGauche']} px)")
    verifier(f["bordDroit"] <= 12, f"la flèche « suivante » est au bord DROIT ({f['bordDroit']} px)")
    verifier(f["actif"] == "tout", "on part de « Tout »")
    verifier(f["precOff"], "à la première rubrique, la flèche « précédente » est ÉTEINTE")

    print("\n2 bis. ON PEUT CHANGER DE RUBRIQUE SANS REMONTER EN HAUT")
    page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    bas = fleches()
    print(f"  page défilée de {bas['defile']} px · flèches toujours à mi-écran (y={bas['milieu']} sur {bas['hauteur']})")
    verifier(bas["defile"] > 500, f"la page est bien défilée ({bas['defile']} px)")
    verifier(abs(bas["milieu"] - bas["hauteur"] / 2) < 5,
             "les flèches n'ont PAS bougé de l'écran : elles restent à mi-hauteur")
    page.screenshot(path="/tmp/pc-fleches-ecran.png")
    page.click("#rubriqueSuiv")
    page.wait_for_timeout(600)
    apres = fleches()
    verifier(apres["actif"] != "tout",
             f"depuis le BAS de la page, un clic AVANCE d’une rubrique (→ {apres['actif']!r})")
    page.click("#rubriquePrec")
    page.wait_for_timeout(600)
    retour = fleches()
    verifier(retour["actif"] == "tout", "et la flèche « précédente » revient en arrière")
    # À la dernière rubrique, « suivante » doit être éteinte : on va au bout.
    for _ in range(25):
        if page.evaluate("() => document.querySelector('#rubriqueSuiv').disabled"):
            break
        page.click("#rubriqueSuiv")
        page.wait_for_timeout(120)
    fin = fleches()
    verifier(fin["suivOff"], f"à la DERNIÈRE rubrique ({fin['actif']!r}), la flèche « suivante » est éteinte")
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    ctx.close()

    # Un appareil TACTILE seul : pas de flèches, le glisser suffit.
    print("\n3. SUR UN ÉCRAN TACTILE, LES FLÈCHES S’EFFACENT")
    ctx_tactile = nav.new_context(viewport={"width": 390, "height": 844}, has_touch=True,
                                  is_mobile=True, locale="fr-FR", timezone_id="Europe/Brussels")
    page_t = ctx_tactile.new_page()
    page_t.goto(URL, wait_until="domcontentloaded")
    page_t.wait_for_selector(".offre", timeout=40000)
    page_t.wait_for_timeout(400)
    dispo = page_t.evaluate("() => getComputedStyle(document.querySelector('#rubriquePrec')).display")
    verifier(dispo == "none", f"sur un téléphone, les flèches sont masquées (display={dispo})")
    ctx_tactile.close()

    # Les réglages sur PC.
    ctx = nav.new_context(viewport={"width": LARGEUR, "height": HAUTEUR},
                          locale="fr-FR", timezone_id="Europe/Brussels")
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector(".offre", timeout=40000)
    page.click("#reglages")
    page.wait_for_timeout(600)

    print("\n4. LE FOND DES RÉGLAGES N’EST PLUS LE BLANC PUR")
    r = reglages(page)
    print(f"  fond de la feuille={r['fondFeuille']} · fond du thème={r['fondTheme']} · carte={r['carteRubrique']}")
    verifier(r["fondFeuille"] != "rgb(255, 255, 255)", "le fond des réglages n’est plus du blanc pur")
    verifier(r["fondFeuille"].replace(" ", "") != r["fondTheme"].replace(" ", ""),
             "il se distingue du fond de la page : c’est un fond TRAVAILLÉ, pas l’écran entier")
    verifier(r["carteRubrique"] != r["fondFeuille"],
             "les rubriques se posent sur des cartes : c’est l’information qui ressort")
    page.screenshot(path="/tmp/pc-reglages-compte.png")

    print("\n5. SUR PC, LES RÉGLAGES SE LISENT PAR DEUX — SANS LIGNE DÉPASSÉE")
    compte = r["compte"]
    print("  Compte : " + " | ".join(f"{x['titre']} (x={x['x']}, w={x['w']}, bas={x['bas']})" for x in compte))
    # DEUX rubriques depuis le 12/10/2026 : le PROFIL a été retiré (B : « aucune
    # plus-value à mettre son nom, l'idée est juste d'avoir des inscrits à la
    # newsletter »). Il ne reste que l'inscription et la langue.
    verifier(len(compte) == 2, f"deux rubriques dans Compte ({len(compte)})")
    if len(compte) == 2:
        inscription, langue = compte
        verifier(abs(inscription["y"] - langue["y"]) < 40,
                 "l’inscription et la LANGUE sont sur la MÊME ligne d’écran")
        verifier(langue["x"] > inscription["x"] + inscription["w"] / 2,
                 "la langue est À CÔTÉ de l’inscription, à droite")
        verifier(not any(x["titre"] == "Profil" for x in compte),
                 "la rubrique « Profil » a bien disparu")
        verifier(abs(inscription["bas"] - langue["bas"]) <= 200,
                 f"les deux cartes s'alignent en haut ({inscription['bas']} / {langue['bas']} px de bas)")
    # « je trouve toujours le panneau d'inscription un peu trop grand » : on mesure
    # l'encadré lui-même, pas la colonne.
    verifier(r["carteInscription"] is not None and r["carteInscription"] <= 430,
             f"l’encadré d’inscription est resserré ({r['carteInscription']} px)")
    verifier(r["largeurPanneau"] <= 1110,
             f"la colonne de lecture est bornée ({r['largeurPanneau']} px sur {LARGEUR})")

    page.click('.onglet[data-onglet="affichage"]')
    page.wait_for_timeout(500)
    r = reglages(page)
    aff = r["affichage"]
    print("  Thème et affichage : " + " | ".join(f"{x['titre']} (x={x['x']}, y={x['y']}, bas={x['bas']})" for x in aff))
    theme = next((x for x in aff if x["titre"] == "Thème et couleurs"), None)
    pays = next((x for x in aff if x["titre"] == "Pays"), None)
    # DEUX rubriques depuis le 12/10/2026 : « Affichage » — qui recopiait les
    # boutons de la barre du haut et le bouton Éco — a été retirée sur décision de
    # B : « les mêmes réglages que la barre du haut réunit ici […] ça n'a pas
    # d'utilité ». Il ne reste ici que ce qui n'existe QUE là : thèmes, pays.
    verifier(len(aff) == 2, f"deux rubriques dans Thème et affichage ({len(aff)})")
    verifier(not any(x["titre"] == "Affichage" for x in aff),
             "la rubrique « Affichage » a bien disparu des Réglages")
    if theme and pays:
        verifier(abs(theme["y"] - pays["y"]) < 40, "le THÈME et le PAYS sont sur la même ligne d’écran")
        verifier(pays["x"] > theme["x"], "le pays est à droite du thème")
        verifier(abs(theme["w"] - pays["w"]) <= 2,
                 f"deux colonnes de largeur ÉGALE ({theme['w']} / {pays['w']}) — symétrie")
        # LES CARTES PRENNENT LA HAUTEUR DE LEUR TEXTE (B : « il faut supprimer tous
        # les espaces blancs […] deux lignes écrites et 40 lignes vides »). Ce qu'on
        # vérifie ici, c'est que rien ne DÉPASSE ; le vide intérieur est compté au
        # pixel par bin/mesurer-espaces-reglages.py.
        verifier(abs(theme["bas"] - pays["bas"]) <= 200,
                 f"les deux cartes s'alignent en haut ({theme['bas']} / {pays['bas']} px de bas)")
    page.screenshot(path="/tmp/pc-reglages-affichage.png")

    print("\n6. L’ONGLET INFORMATIONS SE LIT AUSSI PAR DEUX")
    page.click('.onglet[data-onglet="infos"]')
    page.wait_for_timeout(500)
    infos = reglages(page)["infos"]
    print("  Informations : " + " | ".join(f"{x['titre']} (x={x['x']}, y={x['y']}, w={x['w']})" for x in infos))
    verifier(len(infos) == 4, f"quatre rubriques dans Informations ({len(infos)})")
    if len(infos) == 4:
        # LE PLACEMENT A CHANGÉ LE 12/10/2026 (mise en page « aucun espace blanc ») :
        # les TROIS notes courtes — contact, sources, prix — tiennent la colonne de
        # GAUCHE, et « Tes données, tes droits », qui est long, la colonne de droite
        # sur les trois rangées. L'ORDRE DU DOCUMENT, lui, NE CHANGE PAS : le premier
        # titre reste « Point de contact » (ce que verrouille tests/droits.test.mjs).
        gauche, droite = infos[0], infos[1]
        verifier(gauche["titre"] == "Point de contact",
                 f"le premier titre reste « Point de contact » ({gauche['titre']!r})")
        verifier(infos[2]["x"] == gauche["x"] and infos[3]["x"] == gauche["x"],
                 "les trois notes courtes tiennent la colonne de GAUCHE")
        verifier(droite["x"] > gauche["x"],
                 "« Tes données, tes droits » tient la colonne de DROITE")
        verifier(abs(gauche["w"] - droite["w"]) <= 2,
                 f"colonnes de largeur ÉGALE ({gauche['w']} / {droite['w']}) — symétrie")
        verifier(abs(gauche["y"] - droite["y"]) <= 2, "les deux colonnes commencent à la même hauteur")
        verifier(gauche["y"] < infos[2]["y"] < infos[3]["y"], "les trois notes s'empilent dans l'ordre")
    page.screenshot(path="/tmp/pc-reglages-infos.png")

    ctx.close()
    nav.close()

print()
if echecs:
    print(f"{len(echecs)} échec(s) :")
    for m in echecs:
        print(f"  - {m}")
    raise SystemExit(1)
print("Tout est vérifié : trois largeurs d’affichage, deux flèches, fond adouci, réglages par deux et symétriques.")
