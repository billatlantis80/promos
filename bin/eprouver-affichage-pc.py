#!/usr/bin/env python3
"""ÉPROUVE, DANS UN VRAI NAVIGATEUR, LES DEMANDES « AFFICHAGE PC » DU 12/10/2026.

  1. « au niveau du choix du pays, sur la page, il faut diminuer et aligner la
     grandeur de l'écriture car là c'est écrit en gras et surtout il faut rajouter
     une petite flèche de choix comme bonne promotion à droite. »
  2. « il y a 3 onglets qui font affichage par 4, 2 et 1, tu gardes uniquement les
     boutons 4 et 2, le bouton 1 encadrement, tu changes la fonction tu gardes le
     bouton et tu mets les langues à la place. »
  3. « même chose pour le bouton économie, il reste à sa place mais sera adapté par
     le thème du site, changement des couleurs. »
"""
import os
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")
from playwright.sync_api import sync_playwright

echecs = []


def verifier(cond, msg):
    print(("  OK   " if cond else "  ÉCHEC") + f" {msg}")
    if not cond:
        echecs.append(msg)


MESURE = """() => {
  const f = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return { texte: e.textContent.trim().slice(0, 26), display: s.display, color: s.color,
             fond: s.backgroundColor, bord: s.borderColor, taille: s.fontSize,
             graisse: s.fontWeight, x: Math.round(r.left), y: Math.round(r.top),
             w: Math.round(r.width), h: Math.round(r.height),
             milieu: Math.round((r.top + r.bottom) / 2) };
  };
  const jetons = () => {
    const r = getComputedStyle(document.documentElement);
    return ['--accent', '--carte', '--carte-2', '--doux'].map(k => r.getPropertyValue(k).trim());
  };
  return {
    pays: f('#pays'), nom: f('#pays b'), nombre: f('#pays .n'),
    fleche: f('#pays .fleche-choix'), flecheSvg: (() => {
      const e = document.querySelector('#pays .fleche-choix svg');
      if (!e) return null;
      const s = getComputedStyle(e);
      return { largeur: Math.round(e.getBoundingClientRect().width),
               dessin: s.fill === 'none' && s.stroke === s.color ? 'trait' : 'inattendu' };
    })(),
    vue4: f('.vues .vue[data-vue="grille"]'), vue2: f('.vues .vue[data-vue="liste"]'),
    vue1: f('.vues .vue[data-vue="compacte"]'), langue: f('.vues .vue-langue'),
    eco: f('#eco'), fav: f('#fav'),
    jetons: jetons(),
    ecoOn: (() => { const e = document.querySelector('#eco'); e.classList.add('on');
      const s = getComputedStyle(e).backgroundColor; e.classList.remove('on'); return s; })(),
  };
}"""

with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": 1440, "height": 900}, locale="fr-FR",
                          timezone_id="Europe/Brussels")
    page = ctx.new_page()
    page.goto("http://127.0.0.1:4203/", wait_until="domcontentloaded")
    page.wait_for_selector(".offre", timeout=40000)
    page.wait_for_timeout(700)
    m = page.evaluate(MESURE)
    jet = m.pop("jetons")
    print("jetons du thème :", jet)

    print("\n1. LE BOUTON DE PAYS : écriture diminuée, alignée, non grasse, + flèche")
    print(f"  nom={m['nom']['taille']}/{m['nom']['graisse']} nombre={m['nombre']['taille']} "
          f"couleur nombre={m['nombre']['color']} · flèche={m['fleche']['w']}px "
          f"({m['flecheSvg']}) à x={m['fleche']['x']} (bouton {m['pays']['x']}→{m['pays']['x']+m['pays']['w']})")
    verifier(m["nom"]["graisse"] == "400", f"le nom n'est PLUS en gras ({m['nom']['graisse']})")
    verifier(m["nom"]["taille"] == m["nombre"]["taille"],
             f"le nom et le nombre ont la MÊME taille ({m['nom']['taille']} / {m['nombre']['taille']})")
    verifier(m["fleche"] is not None, "la flèche de choix est présente dans le bouton de pays")
    if m["fleche"]:
        verifier(m["fleche"]["x"] > m["nombre"]["x"], "elle est À DROITE du nom et du nombre")
        verifier(m["pays"]["x"] + m["pays"]["w"] - (m["fleche"]["x"] + m["fleche"]["w"]) <= 14,
                 "elle est au BORD DROIT du bouton")
        verifier(m["flecheSvg"] and m["flecheSvg"]["dessin"] == "trait",
                 "elle est dessinée en trait (elle prend la couleur du thème)")
        verifier(m["fleche"]["milieu"] - m["nombre"]["milieu"] <= 2, "elle est alignée sur le texte")

    print("\n2. LES BOUTONS D'AFFICHAGE : 4 et 2 seulement, la LANGUE à la place du 3ᵉ")
    print(f"  4={m['vue4']['display']} · 2={m['vue2']['display']} · "
          f"1 bande={m['vue1']['display']} · langue={m['langue']['display']} "
          f"({m['langue']['texte']!r} w={m['langue']['w']})")
    verifier(m["vue4"]["display"] != "none", "le bouton QUATRE colonnes est là")
    verifier(m["vue2"]["display"] != "none", "le bouton DEUX colonnes est là")
    verifier(m["vue1"] is None or m["vue1"]["display"] == "none",
             "le bouton « une colonne » est RETIRÉ sur PC")
    verifier(m["langue"] is not None and m["langue"]["display"] != "none",
             "le bouton de LANGUE est à sa place")
    verifier(m["langue"] is not None and m["langue"]["x"] > m["vue2"]["x"],
             "il occupe la position du troisième bouton (à droite du 2)")
    verifier(m["langue"] is not None and "FR" in m["langue"]["texte"].upper(),
             f"il montre la langue en cours ({m['langue']['texte']!r})")
    # Il ouvre la liste des neuf langues.
    page.click(".vues .vue-langue")
    page.wait_for_timeout(500)
    ouvert = page.evaluate("() => !document.querySelector('#langueChoix').hidden")
    n = page.evaluate("() => document.querySelectorAll('#langueChoix .langue').length")
    actif = page.evaluate("""() => { const l = document.querySelector('#langueChoix .langue.on');
        return l ? l.dataset.langue : null; }""")
    print(f"  panneau ouvert={ouvert} · {n} langues · langue active={actif!r}")
    verifier(ouvert, "un clic OUVRE la liste des langues")
    verifier(n == 9, f"les neuf langues sont proposées ({n})")
    verifier(actif == "fr", f"la langue en cours est marquée ({actif!r})")
    page.screenshot(path="/tmp/pc-langue-panneau.png")
    page.click("#langueChoixFermer")
    page.wait_for_timeout(300)
    verifier(page.evaluate("() => document.querySelector('#langueChoix').hidden"),
             "« Fermer » referme le panneau")

    print("\n3. LE BOUTON « ÉCO » : ses couleurs viennent du thème")
    print(f"  éco fond={m['eco']['fond']} couleur={m['eco']['color']} (boutons d'affichage={m['vue2']['fond']})"
          f" · éco ACTIF={m['ecoOn']} (accent={jet[0]})")
    verifier(m["eco"]["fond"] == m["vue2"]["fond"],
             "sa couleur de fond est celle de la famille des boutons d'affichage")
    verifier("rgb(255, 255, 255)" not in m["eco"]["fond"], "il n'est plus sur un blanc à part")
    verifier("235, 145, 45" in m["ecoOn"], f"allumé, il prend l'accent du thème ({m['ecoOn']})")

    print("\n4. LE MODE « UNE COLONNE » N'EST PLUS ACCESSIBLE SUR PC")
    page.evaluate("() => document.body.dataset.vue")
    v = page.evaluate("""() => { localStorage.setItem('promos.vue', 'compacte');
        return true; }""")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".offre", timeout=40000)
    page.wait_for_timeout(500)
    vue = page.evaluate("() => document.body.dataset.vue")
    print(f"  préférence enregistrée « compacte » → mode appliqué : {vue!r}")
    verifier(vue != "compacte", "un appareil qui avait « une colonne » revient à deux colonnes")

    print("\n5. SUR UN TÉLÉPHONE, LES TROIS AFFICHAGES SONT INTACTS")
    ctx_t = nav.new_context(viewport={"width": 390, "height": 844}, has_touch=True,
                            is_mobile=True, locale="fr-FR", timezone_id="Europe/Brussels")
    pt = ctx_t.new_page()
    pt.goto("http://127.0.0.1:4203/", wait_until="domcontentloaded")
    pt.wait_for_selector(".offre", timeout=40000)
    pt.wait_for_timeout(500)
    t = pt.evaluate("""() => ({
      un: getComputedStyle(document.querySelector('.vues .vue[data-vue="compacte"]')).display,
      langue: getComputedStyle(document.querySelector('.vues .vue-langue')).display })""")
    print(f"  téléphone : bouton « une colonne »={t['un']} · bouton de langue={t['langue']}")
    verifier(t["un"] != "none", "sur téléphone, le bouton « une colonne » est TOUJOURS là")
    verifier(t["langue"] == "none", "et le bouton de langue n'y est pas (il ne sert qu'au PC)")
    ctx_t.close()

    ctx.close()
    nav.close()

print()
if echecs:
    print(f"{len(echecs)} échec(s) :")
    for e in echecs:
        print(f"  - {e}")
    raise SystemExit(1)
print("Tout est vérifié : pays aligné et fléché, 4 + 2 + langue sur PC, éco au thème, trois vues sur téléphone.")
