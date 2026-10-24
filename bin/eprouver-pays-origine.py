#!/usr/bin/env python3
"""ÉPROUVE, DANS DE VRAIS NAVIGATEURS, QUE LE VISITEUR ARRIVE SUR SON PAYS.

Règles de B (11/10/2026), mot pour mot :

  1. « Quand un utilisateur arrive sur le site internet via chrome ou edge, il
     doit arriver sur le pays de son origine. Pas dans tous les pays. »
  2. « La règle pour Chrome et edge doit être valable pour tous les navigateurs
     Internet. »
  3. « On ne touche pas à l'application, qui demande au lancement, le choix du
     pays. » — la question reste donc posée, mais elle s'ouvre SUR le pays
     d'origine, allumé.
  4. « Dans le panneau déroulant où l'utilisateur a le choix du pays, avec le
     nombre d'offres, il faut introduire les drapeaux des pays » — le menu
     déroulant est devenu un bouton qui ouvre le panneau partagé.
  5. « Le chiffre annoncé à droite doit annoncer le nombre d'annonces qu'il y a
     dans tous les pays. Uniquement. […] La distinction doit rester. » — le
     bandeau garde le chiffre de TOUTE l'Europe, le pays garde le sien.

Un test de code dit ce qu'une fonction REND ; il ne dit pas ce qu'un VISITEUR
VOIT. Ce script ouvre donc de vrais navigateurs, chacun réglé comme l'appareil
d'un visiteur différent (langue + fuseau horaire + marque), et vérifie l'écran.

Le pays appliqué est lu sur `#pays[data-pays]`, jamais sur le nom affiché : les
noms de pays sont TRADUITS, et une épreuve qui lit « Deutschland » échouerait à
tort dans un navigateur en français.

CE QUI N'A PAS PU ÊTRE VÉRIFIÉ ICI, ET QUI EST DIT : Firefox et Safari ne se
lancent pas sur cette machine — Playwright réclame des bibliothèques système
(libgtk-3) que cet environnement n'a pas, et les installer demande les droits
d'administrateur. Le script essaie quand même, et le DIT quand il n'a pas pu. La
détection, elle, n'emploie que des API standard (`Intl…timeZone`,
`navigator.languages`) : `tests/pays-origine.test.mjs` vérifie qu'aucun code ne
dépend d'un navigateur en particulier.

Usage :
    PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
      /opt/data/capture/venv/bin/python bin/eprouver-pays-origine.py
"""
import os

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

from playwright.sync_api import sync_playwright  # noqa: E402

URL = "http://127.0.0.1:4203/"

# Les deux navigateurs que B a nommés partagent le même moteur (Blink) : on les
# distingue par leur marque, pour que « chrome ou edge » soit vraiment exercé.
MARQUES = {
    "Google Chrome": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"),
    "Microsoft Edge": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0"),
}

echecs = []


def verifier(condition, message):
    print(("  OK   " if condition else "  ÉCHEC") + f" {message}")
    if not condition:
        echecs.append(message)


def nombre(page):
    """Le nombre de bonnes promos du bandeau (`<b>` de #comptes)."""
    brut = page.evaluate("() => (document.querySelector('#comptes b') || {}).textContent || ''")
    chiffres = "".join(c for c in brut if c.isdigit())
    return int(chiffres) if chiffres else None


def etat(page):
    return page.evaluate("""() => {
      const bouton = document.querySelector('#pays');
      const actif = document.querySelector('#paysDemande .pays-item.on');
      return {
        langue: navigator.language,
        fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone,
        bouton: bouton ? bouton.dataset.pays : null,
        boutonTexte: bouton ? bouton.textContent.trim() : null,
        drapeauBouton: !!(bouton && bouton.querySelector('svg')),
        question: !document.querySelector('#paysDemande').hidden,
        actifQuestion: actif ? actif.dataset.pays : null,
        memoire: localStorage.getItem('promos.pays'),
        bandeau: document.querySelector('#comptes').textContent.replace(/\\s+/g, ' ').trim(),
      };
    }""")


def arriver(nav, langue, fuseau, choix=None, marque=None):
    """Ouvre la page comme le ferait l'appareil décrit. Rend (contexte, page)."""
    reglages = {"locale": langue, "timezone_id": fuseau,
                "viewport": {"width": 1280, "height": 900}}
    if marque:
        reglages["user_agent"] = MARQUES[marque]
    ctx = nav.new_context(**reglages)
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    if choix is not None:
        # Un choix DÉJÀ fait par l'utilisateur. Écrit APRÈS la première visite,
        # puis la page est rouverte : c'est la seule façon d'être sûr que la
        # mémoire est bien dans le navigateur — un script d'initialisation
        # s'exécute avant que l'origine ne soit posée et n'écrit rien.
        page.evaluate("(v) => localStorage.setItem('promos.pays', v)", choix)
        page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".offre", timeout=40000)
    page.wait_for_timeout(300)
    return ctx, page


def choisir(page, code):
    """Choisit un pays COMME LE FERAIT L'UTILISATEUR : bouton, puis tuile."""
    page.click("#pays")
    page.wait_for_timeout(300)
    page.click(f'#paysChoixListe .pays-item[data-pays="{code}"]')
    page.wait_for_timeout(500)


def eprouver(nav, marque):
    print(f"\n=== {marque} ===")

    print("\n1. UN BELGE — navigateur qui n'annonce AUCUN pays (le cas de Chrome et Edge)")
    ctx, page = arriver(nav, "fr", "Europe/Brussels", marque=marque)
    e = etat(page)
    print(f"  appareil : langue={e['langue']!r} fuseau={e['fuseau']} → bouton={e['boutonTexte']!r}")
    verifier(e["bouton"] == "BE", "l'écran est sur la BELGIQUE, pas sur « tous les pays »")
    verifier(e["drapeauBouton"], "et le bouton porte le drapeau du pays (dessin, pas emoji)")
    # DÉCISION DE B (11/10/2026) : « L'utilisateur n'a pas besoin d'avoir le panneau
    # qui lui demande dans quel pays il veut faire ses achats à chaque fois qu'il
    # rentre dans le site. » Il est déjà sur son pays : on ne lui demande rien.
    verifier(not e["question"], "AUCUNE question posée : il est arrivé sur son pays")
    verifier(e["memoire"] is None, "rien n'est écrit en mémoire : c'est une proposition")
    belgique = nombre(page)
    verifier((belgique or 0) > 0, f"l'écran derrière n'est pas vide ({belgique} bonnes promos)")

    print("\n2. IL CHANGE DE PAYS DANS LA SESSION — par le panneau, pas par un menu déroulant")
    # « Sur la même session il peut continuer à consulter les offres de la Belgique
    # et de la France de la Hollande et de l'Allemagne juste en cliquant et en
    # ayant le choix, avec l'interface qu'il y a dans paramètres. »
    choisir(page, "FR")
    fr = etat(page)
    verifier(fr["bouton"] == "FR", "un appui le fait passer à la FRANCE")
    verifier(fr["memoire"] == "FR", "et ce choix est bien mémorisé (c'est une décision)")
    verifier(not fr["question"], "sans qu'on lui repose jamais la question")
    choisir(page, "NL")
    verifier(etat(page)["bouton"] == "NL", "puis aux PAYS-BAS")
    choisir(page, "BE")
    verifier(etat(page)["bouton"] == "BE", "et il revient à la BELGIQUE, dans la même session")

    print("\n3. LE PANNEAU DE LA BARRE — drapeaux et nombres par pays")
    page.click("#pays")
    page.wait_for_timeout(400)
    panneau = page.evaluate("""() => ({
      ouvert: !document.querySelector('#paysChoix').hidden,
      tuiles: document.querySelectorAll('#paysChoixListe .pays-item').length,
      drapeaux: document.querySelectorAll('#paysChoixListe .pays-item .drap svg').length,
      avecNombre: [...document.querySelectorAll('#paysChoixListe .pays-item .n')]
                  .filter(n => /\\d/.test(n.textContent)).length,
      actif: (document.querySelector('#paysChoixListe .pays-item.on') || {}).dataset?.pays,
    })""")
    print(f"  panneau : {panneau['tuiles']} pays, {panneau['drapeaux']} drapeaux, {panneau['avecNombre']} nombres")
    verifier(panneau["ouvert"], "le bouton ouvre le panneau de choix")
    verifier(panneau["tuiles"] >= 13, "les pays d'Europe ET « Tous les pays » sont proposés")
    verifier(panneau["drapeaux"] == panneau["tuiles"], "CHAQUE pays porte son drapeau")
    verifier(panneau["avecNombre"] == panneau["tuiles"], "et chacun annonce son nombre d'offres")
    verifier(panneau["actif"] == "BE", "le pays appliqué est allumé dans le panneau")
    page.screenshot(path="/tmp/promos-pays-panneau-" + marque.split()[-1].lower() + ".png")
    page.click("#paysChoixFermer")
    page.wait_for_timeout(300)
    verifier(page.evaluate("() => document.querySelector('#paysChoix').hidden"),
             "le panneau se referme (bouton Fermer)")

    print("\n4. LE BANDEAU GARDE LE CHIFFRE DE TOUTE L'EUROPE (distinction demandée)")
    ctx2, page2 = arriver(nav, "fr", "Europe/Brussels", choix="tout", marque=marque)
    bandeauTout = etat(page2)["bandeau"]
    ctx2.close()
    verifier(bandeauTout == e["bandeau"],
             "le bandeau est IDENTIQUE en Belgique et sur toute l'Europe — la distinction tient")
    print(f"  bandeau : {bandeauTout}")
    ctx.close()

    print("\n5. UN BELGE au navigateur « français de France » — le LIEU décide")
    ctx, page = arriver(nav, "fr-FR", "Europe/Brussels", marque=marque)
    e = etat(page)
    verifier(e["bouton"] == "BE", "il arrive sur la BELGIQUE, et non sur la France")
    verifier(not e["question"], "et aucune question ne lui est posée")
    ctx.close()

    print("\n6. UN ALLEMAND")
    ctx, page = arriver(nav, "de", "Europe/Berlin", marque=marque)
    e = etat(page)
    print(f"  appareil : langue={e['langue']!r} fuseau={e['fuseau']} → bouton={e['boutonTexte']!r}")
    verifier(e["bouton"] == "DE", "il arrive sur l'ALLEMAGNE")
    verifier(not e["question"], "et aucune question ne lui est posée")
    ctx.close()

    print("\n7. UN APPAREIL QUI NE DIT RIEN — on ne devine pas")
    ctx, page = arriver(nav, "en-US", "UTC", marque=marque)
    e = etat(page)
    verifier(e["bouton"] == "tout", "l'écran reste sur « tous les pays »")
    verifier(e["actifQuestion"] == "tout", "et c'est « tous les pays » qui est allumé")
    verifier(e["question"], "la question est posée : aucun écran vide sans un mot")
    ctx.close()

    print("\n8. UN CHOIX EXPLICITE SURVIT À LA DÉTECTION")
    ctx, page = arriver(nav, "fr", "Europe/Brussels", choix="DE", marque=marque)
    e = etat(page)
    verifier(e["bouton"] == "DE", "le choix de l'utilisateur prime sur le fuseau")
    verifier(not e["question"], "on ne redemande pas un pays déjà choisi")
    verifier(e["memoire"] == "DE", "la mémoire garde sa décision")
    # Et l'on peut revenir à toute l'Europe PAR LE PANNEAU, sans menu déroulant.
    choisir(page, "tout")
    e2 = etat(page)
    verifier(e2["bouton"] == "tout", "le panneau permet de revenir à toute l'Europe")
    verifier(e2["memoire"] == "tout", "et ce choix-là est mémorisé")
    ctx.close()


with sync_playwright() as p:
    print("Navigateurs disponibles sur cette machine :")
    for nom, type_nav in (("chromium", p.chromium), ("firefox", p.firefox), ("webkit", p.webkit)):
        try:
            nav = type_nav.launch()
            print(f"  {nom} {nav.version} — lançable")
            nav.close()
        except Exception as e:                                    # noqa: BLE001
            print(f"  {nom} — NON LANÇABLE ici ({str(e).splitlines()[0][:70]}) : non vérifié")

    print("\nChromium : deux marques exercées (celles que B a nommées).")
    nav = p.chromium.launch()
    for marque in MARQUES:
        eprouver(nav, marque)
    nav.close()

print()
if echecs:
    print(f"{len(echecs)} échec(s) :")
    for m in echecs:
        print(f"  - {m}")
    raise SystemExit(1)
print("Tout est vérifié : le visiteur arrive sur le pays de son origine.")
