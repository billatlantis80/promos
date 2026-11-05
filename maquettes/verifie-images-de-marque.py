#!/usr/bin/env python3
"""L'image de marque sur les CINQ portes — décision 37, vérifiée d'un seul endroit.

Ce script ne vérifie pas une porte, il vérifie une RÈGLE qui traverse cinq fichiers : un logo, ou à
défaut une photo de l'entreprise ; un seul emplacement ; carré ; jamais un monogramme fabriqué par
nous ; et la même image là où c'est la même entreprise.

Ce qu'il produit aussi : des gros plans dans `img-marque-*.png`, et une planche `img-marque-planche.png`
qui les rassemble, parce que c'est en les regardant côte à côte qu'on voit une incohérence de taille.
"""
import asyncio, hashlib, pathlib, re, sys
from playwright.async_api import async_playwright

BASE = pathlib.Path(__file__).parent

# porte, fichier, sélecteur, taille attendue
PORTES = [
    ("artisan",      "artisan.html",      ".arow .mk, .fiche .fmark, .phone .mk", None),
    ("immo",         "immo.html",         ".seller .logo",                        None),
    ("emploi",       "emploi.html",       ".empwho .empimg",                      38),
    ("evenement",    "evenement.html",    ".orgtop .orglogo",                     44),
    ("job-etudiant", "job-etudiant.html", ".empwho .empimg",                      38),
]

reussis, echoues = [], []


def check(ok, libelle, detail=""):
    (reussis if ok else echoues).append(libelle)
    print(("  ✓ " if ok else "  ✗ ") + libelle + (f"  [{detail}]" if detail and not ok else ""))


JS_MESURE = """(sel) => [...document.querySelectorAll(sel)].map(e => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const svg = e.querySelector('svg');
    return {w: Math.round(r.width), h: Math.round(r.height),
            img: !!(svg || e.querySelector('img')),
            texte: (e.innerText || '').trim(),
            rayon: parseFloat(cs.borderTopLeftRadius),
            bord: parseFloat(cs.borderTopWidth),
            source: svg ? svg.outerHTML : (e.querySelector('img') ? 'img' : ''),
            page: {x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY),
                   w: Math.round(r.width), h: Math.round(r.height)}};});"""


async def main():
    async with async_playwright() as p:
        nav = await p.chromium.launch()
        trouvees, planche, signatures = {}, [], {}

        for nom, fichier, sel, taille in PORTES:
            print(f"\n── {nom} ({fichier})")
            pg = await nav.new_page(viewport={"width": 1440, "height": 1200}, device_scale_factor=2)
            erreurs = []
            pg.on("pageerror", lambda e: erreurs.append(str(e)))
            pg.on("console", lambda m: erreurs.append(m.text) if m.type == "error" else None)
            await pg.goto(f"file://{BASE / fichier}")
            await pg.wait_for_timeout(500)

            items = await pg.evaluate(JS_MESURE, sel)
            check(bool(items), f"{len(items)} image(s) de marque trouvée(s)")
            check(not erreurs, "aucune erreur JavaScript", "; ".join(erreurs[:2]))

            carres = [i for i in items if i["w"] != i["h"]]
            check(not carres, "chaque image de marque est carrée", str(carres[:1]))

            if taille:
                tailles = sorted({i["w"] for i in items})
                check(tailles == [taille], f"la taille est celle de l'emplacement ({taille} px)", str(tailles))

            # Un monogramme est un élément SANS image dont le texte tient dans le carré : « DI », « CS ».
            # C'est exactement ce que la règle interdit — une initiale fabriquée par nous, affichée comme
            # si elle était la marque de l'entreprise.
            monos = [i["texte"] for i in items if not i["img"] and i["texte"]]
            check(not monos, "aucun monogramme fabriqué par nous", str(monos[:3]))

            avec = [i for i in items if i["img"]]
            check(bool(avec), f"{len(avec)} porte(nt) une vraie image")
            check(all(i["rayon"] > 0 for i in items), "les angles sont arrondis, jamais bruts")

            for i in avec:
                sig = hashlib.sha1(i["source"].encode()).hexdigest()[:12]
                signatures.setdefault(sig, []).append(nom)
            trouvees[nom] = avec

            # gros plan du premier bloc, pour l'œil
            if avec:
                r = avec[0]["page"]
                marge = 26
                clip = {"x": max(0, r["x"] - marge), "y": max(0, r["y"] - marge),
                        "width": r["w"] + marge * 2 + 300, "height": r["h"] + marge * 2}
                chemin = BASE / f"img-marque-{nom}.png"
                # `full_page=True` est indispensable : le clip est exprimé en coordonnées de PAGE,
                # et sans lui le cadrage tombe hors de la vue dès que le bloc est sous la ligne de flottaison.
                await pg.screenshot(path=str(chemin), clip=clip, full_page=True)
                planche.append((nom, chemin.name, r["w"]))
                print(f"  · {chemin.name}  ({r['w']}×{r['h']} px)")
            await pg.close()

        print("\n── La même entreprise, la même image, sur deux portes")
        partagees = {s: n for s, n in signatures.items() if len(n) > 1}
        check(bool(partagees), "au moins une image est identique sur deux portes",
              str({s: n for s, n in signatures.items()}))
        for s, n in partagees.items():
            print(f"  · signature {s} → {', '.join(n)}")

        # La planche : les cinq gros plans côte à côte. C'est là qu'on voit qu'une image est plus
        # grande que les autres, ou que l'une est un logo et l'autre une photo.
        html = ["<!doctype html><meta charset='utf-8'><body style=\"margin:0;padding:16px;"
                "font:12px 'Liberation Sans',Arial;background:#fff\">"]
        for nom, fichier_png, taille in planche:
            html.append(f"<div style='margin-bottom:14px'><div style='font-size:11px;"
                        f"letter-spacing:.6px;text-transform:uppercase;color:#5E7180;margin-bottom:5px'>"
                        f"/{nom} — {taille} px</div>"
                        f"<img src='file://{BASE / fichier_png}' style='max-width:640px;"
                        f"border:1px solid #E3E8ED;border-radius:8px'></div>")
        html.append("</body>")
        p = pathlib.Path("/tmp/_planche-img-marque.html")
        p.write_text("\n".join(html), encoding="utf-8")
        pg = await nav.new_page(viewport={"width": 700, "height": 400}, device_scale_factor=2)
        await pg.goto(f"file://{p}")
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(BASE / "img-marque-planche.png"), full_page=True)
        await pg.close()
        print("\n  · img-marque-planche.png")

        await nav.close()

    print("\n" + "═" * 78)
    print(f"CONTRÔLES RÉUSSIS : {len(reussis)}")
    print(f"CONTRÔLES ÉCHOUÉS : {len(echoues)}")
    for e in echoues:
        print("   ✗", e)
    print("═" * 78)
    return 1 if echoues else 0


sys.exit(asyncio.run(main()))
