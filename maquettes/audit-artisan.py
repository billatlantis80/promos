#!/usr/bin/env python3
"""Audit de la porte /artisan — rejouable.

Ce qui est vérifié : ce qui est RENDU et MESURÉ, plus une lecture du fichier pour ce qui ne doit pas
y être (un lien tel: tout fait, un champ de fichier). Les textes sont aplatis avant comparaison.
"""
import asyncio, json, pathlib, re, sys
from playwright.async_api import async_playwright

BASE = pathlib.Path(__file__).parent
FICHIER = BASE / "artisan.html"
LARGEUR = 1440

reussis, echoues = [], []


def check(ok, libelle, detail=""):
    (reussis if ok else echoues).append(libelle)
    print(("  ✓ " if ok else "  ✗ ") + libelle + (f"  [{detail}]" if detail and not ok else ""))


def plat(s):
    return re.sub(r"\s+", " ", s or "").strip()


def lum(hexc):
    hexc = hexc.lstrip("#")
    r, g, b = [int(hexc[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return round((max(la, lb) + 0.05) / (min(la, lb) + 0.05), 2)


async def main():
    source = FICHIER.read_text(encoding="utf-8")

    async with async_playwright() as p:
        nav = await p.chromium.launch()
        pg = await nav.new_page(viewport={"width": LARGEUR, "height": 1200}, device_scale_factor=2)
        erreurs = []
        pg.on("pageerror", lambda e: erreurs.append(str(e)))
        pg.on("console", lambda m: erreurs.append(m.text) if m.type == "error" else None)
        await pg.goto(f"file://{FICHIER}")
        await pg.wait_for_timeout(900)

        corps = plat(await pg.evaluate("() => document.body.innerText"))

        print("\n── 1. Les cinq écrans et le rendu")
        caps = await pg.evaluate("() => document.querySelectorAll('.cap').length")
        check(caps == 5, f"cinq écrans présents ({caps})")
        check(not erreurs, "aucune erreur JavaScript", "; ".join(erreurs[:2]))
        debord = await pg.evaluate("""() => ({
            doc: document.documentElement.scrollWidth,
            larges: [...document.querySelectorAll('body *')]
                .filter(e => e.getBoundingClientRect().right > 1441)
                .map(e => e.className || e.tagName).slice(0, 5)})""")
        check(debord["doc"] <= LARGEUR + 1, f"aucun débordement horizontal ({debord['doc']} px)")
        check(not debord["larges"], "aucun élément ne dépasse 1440 px", str(debord["larges"]))
        # Une classe écrite dans le HTML mais SANS règle CSS s'affiche à la taille du texte courant.
        # C'est ainsi qu'une phrase d'aide est devenue deux fois plus grosse que ses voisines : elle
        # était dans le DOM, elle avait la bonne classe, et elle n'avait pas de style. On mesure donc
        # la taille rendue, pas la présence de la classe.
        gros = await pg.evaluate("""() => [...document.querySelectorAll('.hint2, .swnote, .cp')]
            .map(e => ({t: (e.innerText || '').slice(0, 26),
                        s: parseFloat(getComputedStyle(e).fontSize)}))
            .filter(x => x.s > 11.5)""")
        check(not gros, f"aucun texte d'aide ne dépasse 11,5 px ({len(gros)} en défaut)", str(gros[:2]))

        print("── 2. Un annuaire, pas une place de marché")
        check("aucun avis, aucune note" in corps.lower(), "la page dit qu'il n'y a ni avis ni note")
        etoiles = await pg.evaluate("() => (document.body.innerText.match(/[★☆⭐]/g) || []).length")
        check(etoiles == 0, f"aucune étoile dans le rendu ({etoiles})")
        REFUS = ("pas de", "aucun", "jamais", "ni ", "sans ", "ne peut")
        for interdit in ["laisser un avis", "note moyenne", "avis vérifiés", "meilleur artisan", "top 10"]:
            check(interdit not in corps.lower(), f"pas de « {interdit} »")
        # « classement » n'est pas interdit comme MOT : la page l'emploie pour dire qu'il n'y en a pas
        # (« Pas de classement payant déguisé »). Il est interdit comme promesse — même tolérance que
        # partout ailleurs : une phrase qui cite la règle pour la refuser n'est pas une infraction.
        fautifs_cl = []
        for m in re.finditer(r"classement", corps.lower()):
            fenetre = corps.lower()[max(0, m.start() - 70):m.start() + 60]
            if not any(r in fenetre for r in REFUS):
                fautifs_cl.append(fenetre.strip())
        check(not fautifs_cl, "« classement » n'apparaît jamais comme argument de vente", str(fautifs_cl[:1]))
        check("ni la compétence, ni la qualité, ni le prix" in corps.lower(),
              "la limite de garantie est écrite en clair")
        check("vérifié à la main" in corps, "la vérification est dite « à la main », datée")

        print("── 3. Ce qui ne doit pas exister")
        # Ce contrôle était « aucun champ de fichier dans la PAGE », ce qui était vrai tant que la
        # maquette n'avait rien à téléverser. Depuis l'image de marque, le dépôt en a un — et une
        # vérification globale serait devenue fausse, puis contournée. Elle est donc portée là où
        # elle a un sens : la demande de devis, qui ne doit RIEN pouvoir recevoir.
        fichiers = await pg.evaluate(
            "() => document.querySelectorAll('.devisbox input, .devisbox textarea,"
            " .devisbox [type=file], .devisbox [accept]').length")
        check(fichiers == 0, "la demande de devis ne peut recevoir aucun fichier",
              f"{fichiers} trouvé(s)")
        check("href=\"tel:" not in source, "aucun lien tel: écrit dans la page")
        check("href=\"mailto:" not in source, "aucun lien mailto: écrit dans la page")

        print("── 4. Le numéro assemblé au clic")
        tel = await pg.evaluate("""() => {
            const b = document.querySelector('.big.appel');
            if (!b) return null;
            b.click();
            return document.documentElement.dataset.dernierAppel || null;
        }""")
        check(bool(tel) and str(tel).startswith("tel:"), f"le clic produit un appel ({tel})")
        check(tel == "tel:026481234", f"le numéro est bien formé, sans espaces ({tel})")
        affiche = await pg.evaluate("""() => {
            const e = document.querySelector('.addrbox .ad');
            return e ? e.innerText.trim() : null;
        }""")
        check(affiche == "02 648 12 34", f"le numéro reste lisible pour un humain ({affiche})")
        check("un mobile personnel de salarié" in corps.lower(),
              "la page dit qu'un mobile personnel de salarié est refusé")

        print("── 5. La demande de devis")
        devis = await pg.evaluate("""() => {
            const b = document.querySelector('.big.devis[data-a][data-b]');
            if (!b) return null;
            b.click();
            return document.documentElement.dataset.dernierCourriel || null;
        }""")
        check(bool(devis) and str(devis).startswith("mailto:"), f"la demande produit un courriel ({str(devis)[:46]}…)")
        check("&body=" in str(devis), "le courriel porte un corps proposé")
        check("kazendra" not in str(devis).lower(), "aucune trace de Kazendra dans le courriel")
        corps_mail = await pg.evaluate("""() => {
            const b = document.querySelector('.big.devis[data-a][data-b]');
            return b ? (b.dataset.corps || '') : '';
        }""")
        check(len(corps_mail) < 700, f"le corps reste court ({len(corps_mail)} caractères)")
        mensonge = re.findall(r"ci-joint|pi[eè]ce jointe|je joins", corps_mail.lower())
        check(not mensonge, "le corps ne promet aucune pièce jointe", str(mensonge))
        check("photos sur demande" in corps_mail.lower(),
              "le corps propose d'envoyer des photos, sans promettre de pièce jointe")
        apercu = await pg.evaluate("""() => {
            const d = document.querySelector('.dpreview');
            return d ? d.innerText : null;
        }""")
        check(bool(apercu) and "devis" in (apercu or "").lower(),
              "le message est montré AVANT le clic, pas caché dans le lien")
        check("aucun fichier ne se dépose ici" in corps.lower(),
              "le dépôt de fichier est explicitement refusé")

        print("── 5 bis. L'image de marque — un logo, ou une photo d'entreprise à défaut")
        marques = await pg.evaluate("""() => [...document.querySelectorAll('.arow .mk')].map(e => {
            e.scrollIntoView({block: 'center'});
            const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
            return {c: e.className, w: Math.round(r.width), h: Math.round(r.height),
                    img: !!e.querySelector('svg,img'),
                    bord: parseFloat(cs.borderTopWidth),
                    fond: cs.backgroundColor};})""")
        check(len(marques) == 4, f"chaque ligne d'annuaire réserve la place de l'image ({len(marques)})")
        check(all(m["w"] == m["h"] == 36 for m in marques),
              "l'image de marque est carrée, 36 px", str(marques))
        avec = [m for m in marques if m["img"]]
        sans = [m for m in marques if not m["img"]]
        check(len(avec) >= 2, f"des fiches portent une image ({len(avec)})")
        # Une fiche sans image ne doit montrer NI cadre, NI fond, NI texte : le blanc de la colonne
        # réservée, et rien d'autre. Un cadre dirait « il manque quelque chose ».
        check(bool(sans) and all(m["bord"] == 0 and m["fond"] in ("rgba(0, 0, 0, 0)", "transparent")
                                 for m in sans),
              "une fiche sans image ne montre ni cadre ni fond", str(sans))
        noms = await pg.evaluate(
            "() => [...document.querySelectorAll('.arow .t > b')]"
            ".map(e => Math.round(e.getBoundingClientRect().left))")
        check(len(set(noms)) == 1,
              f"les noms commencent à la même abscisse, avec ou sans image ({sorted(set(noms))})")

        grande = await pg.evaluate("""() => {
            const e = document.querySelector('.fiche .fmark');
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return {w: Math.round(r.width), h: Math.round(r.height),
                    img: !!e.querySelector('svg,img')};}""")
        check(bool(grande) and grande["w"] == grande["h"] == 72 and grande["img"],
              f"la fiche affiche l'image de marque à 72 px, carrée ({grande})")
        nom = await pg.evaluate("() => (document.querySelector('.fiche h1') || {}).innerText || ''")
        check("Bruyère" in nom and "0748.512.396" in corps,
              "l'image ne remplace jamais le nom ni le numéro d'entreprise")

        check("votre logo, ou à défaut une photo de votre entreprise" in corps.lower(),
              "le dépôt propose la photo d'entreprise à défaut de logo")
        check("façade, atelier, camionnette, vitrine" in corps.lower(),
              "les trois cas sont nommés, pas suggérés")
        check("jamais de svg" in corps.lower() and "script" in corps.lower(),
              "le SVG est refusé, avec sa raison")
        check("métadonnées sont effacées" in corps.lower(),
              "l'effacement des métadonnées est écrit")
        check("coordonnées gps" in corps.lower(),
              "la raison est écrite : une photo de téléphone porte l'adresse exacte")
        check("cette image est celle de mon entreprise" in corps.lower(),
              "la déclaration de droits est présente")
        check("aucun numéro de rue" in corps.lower(),
              "le numéro de rue d'un logement privé est refusé")
        check("l'image de marque reste au compte" in corps.lower(),
              "la durée est dite : l'image suit le compte, pas la fiche")

        # Sixième occurrence de la même famille de faux positif sur ce projet : la page écrit
        # « pas de mention « sans photo » », et un contrôle qui cherche le MOT refuserait la phrase
        # qui interdit la chose. La tolérance à la négation s'applique ici aussi.
        fautifs_sp = []
        for m in re.finditer(r"sans photo", corps.lower()):
            fenetre = corps.lower()[max(0, m.start() - 60):m.start() + 40]
            if not any(r in fenetre for r in REFUS):
                fautifs_sp.append(fenetre.strip())
        check(not fautifs_sp,
              "« sans photo » n'est jamais écrit comme une étiquette", str(fautifs_sp[:1]))

        print("── 6. Ce que la fiche déclare")
        for quoi in ["assurance", "déclarée", "non vérifiée", "attestation", "zone"]:
            check(quoi in corps.lower(), f"la fiche nomme « {quoi} »")

        # Les légendes des photos étaient dans le DOM, lisibles par un lecteur d'écran, et INVISIBLES :
        # le hachurage est positionné en absolu, donc peint au-dessus du contenu statique. Le contrôle
        # ne demande pas « l'élément existe », il demande « c'est bien lui qui est au-dessus ».
        legendes = await pg.evaluate("""() => {
            const out = [];
            for (const el of document.querySelectorAll('.shot .lb2')) {
                el.scrollIntoView({block: 'center'});
                const r = el.getBoundingClientRect();
                const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                out.push({txt: (el.innerText || '').slice(0, 22),
                          visible: !!dessus && (dessus === el || el.contains(dessus)),
                          w: Math.round(r.width)});
            }
            return out;
        }""")
        invisibles = [l["txt"] for l in legendes if not l["visible"] or l["w"] < 20]
        check(legendes and not invisibles,
              f"les {len(legendes)} légendes de photos sont réellement visibles", str(invisibles))

        # Deux colonnes qui finissent à 650 px d'écart, c'est un demi-écran vide. Le contrôle
        # d'origine prenait `document.querySelectorAll('.fiche')[1]` — c'est-à-dire l'écran du
        # DÉPÔT, pas la fiche, et il annonçait pourtant « les deux colonnes de la fiche ». Il ne
        # mesurait donc pas ce que la correction d'alors avait corrigé, et il est passé tant que le
        # dépôt restait sous le seuil. Il mesure maintenant CHAQUE écran à deux colonnes, et dit lequel.
        NOMS = ["la fiche", "le dépôt", "mes fiches"]
        colonnes = await pg.evaluate("""() => [...document.querySelectorAll('.fiche')]
            .filter(c => c.children.length === 2)
            .map(c => {const g = c.children[0].getBoundingClientRect();
                       const d = c.children[1].getBoundingClientRect();
                       return {g: Math.round(g.height), d: Math.round(d.height)};})""")
        ecarts = [abs(c["g"] - c["d"]) for c in colonnes]
        detail = ", ".join(f"{NOMS[i] if i < len(NOMS) else i} {c['g']}/{c['d']}"
                           for i, c in enumerate(colonnes))
        check(bool(colonnes) and all(e < 400 for e in ecarts),
              f"les colonnes de chaque écran sont équilibrées (écart max {max(ecarts) if ecarts else '?'} px)",
              detail)

        check("déclarée le 12/10/2026" in corps, "l'assurance porte sa date de déclaration")
        check("avoir donné leur accord" in corps.lower() or "ont donné leur accord" in corps.lower(),
              "le droit à l'image est déclaré au dépôt")
        check("0 à 12" in corps and "jamais obligatoires" in corps.lower(),
              "les photos sont facultatives et bornées")

        # Un total affiché doit se recalculer depuis ses lignes. La relecture annonce un nombre de
        # points et les énumère : le jour où la liste gagne un point sans que le chiffre suive (ou
        # l'inverse), le contrôle tombe. C'est la règle du projet appliquée au texte lui-même.
        MOTS = {"six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10}
        m = re.search(r"vérifie (\w+) points\s*:\s*([^.]+)\.", corps)
        if m:
            annonce = MOTS.get(m.group(1).lower())
            items = [x.strip() for x in m.group(2).split(",") if x.strip()]
            check(annonce == len(items),
                  f"la relecture annonce {m.group(1)} points et en énumère {len(items)}", str(items))
        else:
            check(False, "la relecture annonce et énumère ses points", "phrase absente")

        print("── 7. Le prix et l'échéance")
        check("79 € HTVA" in corps, "le prix est écrit HTVA")
        check("365 jours" in corps, "la durée est écrite")
        check("aucun abonnement" in corps.lower(), "l'absence d'abonnement est écrite")
        check("j−15" in corps.lower(), "le rappel est nommé (J−15)")
        check("renouvellement est un geste" in corps.lower(),
              "le renouvellement n'est pas automatique")
        check("fiche sponsorisée" in corps.lower(), "la mention « fiche sponsorisée » est prévue")

        print("── 8. Diversité et âge")
        ages = re.findall(r"\b\d{2} ?[-–] ?\d{2} ans\b", corps)
        check(not ages, "aucune fourchette d'âge", str(ages))
        refus = ("ne peut pas", "ne pouvez pas", "pas écrire", "interdit", "jamais", "aucun")
        fautifs = [c for c in re.findall(r"[^.]*\bcertifié[^.]*\.", corps, re.I)
                   if not any(r in c.lower() for r in refus)]
        check(not fautifs, "« certifié » n'apparaît jamais comme promesse", str(fautifs[:1]))

        print("── 9. Mobile — cibles et planche")
        mmob = await pg.evaluate("""() => [...document.querySelectorAll('.phone .mk')].map(e => {
            const r = e.getBoundingClientRect();
            return {w: Math.round(r.width), h: Math.round(r.height),
                    img: !!e.querySelector('svg,img')};})""")
        check(len(mmob) >= 4 and all(x["w"] == x["h"] for x in mmob) and any(x["img"] for x in mmob),
              f"l'image de marque tient à 390 px, carrée ({len(mmob)} mesurées)", str(mmob))
        cibles = await pg.evaluate("""() => [...document.querySelectorAll('.pgo, .sticky .go, .sticky .gh')]
            .map(e => ({c: e.className, h: Math.round(e.getBoundingClientRect().height)}))""")
        trop = [c for c in cibles if c["h"] < 44]
        check(not trop, f"toutes les cibles ≥ 44 px ({len(cibles)} mesurées)", str(trop))
        partage = await pg.evaluate("""() => {
            const s = document.querySelector('.share');
            if (!s) return null;
            const r = s.getBoundingClientRect();
            return {l: Math.round(r.width), h: Math.round(r.height)};
        }""")
        check(partage and partage["l"] == 34 and partage["h"] == 34,
              f"le bouton de partage fait 34 × 34 ({partage})")

        print("── 10. Contrastes AA")
        for nom, fg, bg, seuil in [("texte courant", "#4A5C6B", "#FFFFFF", 4.5),
                                   ("discret", "#5E7180", "#FFFFFF", 4.5),
                                   ("discret sur gris", "#5E7180", "#F5F7F9", 4.5),
                                   ("vert vérifié", "#25634A", "#FFFFFF", 4.5),
                                   ("ambre non déclarée", "#7A5217", "#F4F1EC", 4.5),
                                   ("orange sur navy", "#FFFFFF", "#0D3B5B", 4.5)]:
            r = ratio(fg, bg)
            check(r >= seuil, f"contraste {nom} : {r}:1")

        print("── 11. Les textes figés sont ceux des écrans")
        textes = json.loads((BASE.parent / "textes" / "artisan-fr.json")
                            .read_text(encoding="utf-8"))["textes"]

        def norme(s):
            s = s.replace("\u2019", "'").replace("\u00a0", " ")
            s = re.sub(r"\s+", " ", s)
            s = re.sub(r"\s+([,;:.!?»])", r"\1", s)   # une balise laisse un espace avant la ponctuation
            return s.strip().lower()

        page = norme(corps)
        absents = [k for k, v in textes.items() if norme(v) not in page]
        check(not absents, f"les {len(textes)} textes figés se retrouvent à l'écran", str(absents))

        print("── 12. Captures")
        positions = await pg.evaluate("""() => [...document.querySelectorAll('.cap')]
            .map(e => e.getBoundingClientRect().top + window.scrollY)""")
        hauteur = await pg.evaluate("() => document.documentElement.scrollHeight")
        noms = ["artisan-annuaire", "artisan-fiche", "artisan-depot", "artisan-mes-fiches",
                "artisan-mobile-390"]
        for i, top in enumerate(positions):
            bas = positions[i + 1] if i + 1 < len(positions) else hauteur
            await pg.screenshot(path=str(BASE / f"{noms[i]}.png"), full_page=True,
                                clip={"x": 0, "y": top, "width": LARGEUR, "height": bas - top})
            print(f"  · {noms[i]}.png  ({int(bas - top)} px de haut)")

        await nav.close()

    print("\n" + "═" * 78)
    print(f"CONTRÔLES RÉUSSIS : {len(reussis)}")
    print(f"CONTRÔLES ÉCHOUÉS : {len(echoues)}")
    for e in echoues:
        print("   ✗", e)
    print("═" * 78)
    return 1 if echoues else 0


sys.exit(asyncio.run(main()))
