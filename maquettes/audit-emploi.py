#!/usr/bin/env python3
"""Audit de la porte /emploi — rejouable.

Ce qui est vérifié n'est pas le HTML source mais ce qui est RENDU et MESURÉ, plus une lecture du
fichier pour les choses qui ne doivent pas y être (l'adresse en clair, un champ de CV).
Chaque contrôle refuse une phrase ou une absence, pas une tournure : les textes sont aplatis.
"""
import asyncio, json, pathlib, re, sys
from playwright.async_api import async_playwright

BASE = pathlib.Path(__file__).parent
FICHIER = BASE / "emploi.html"
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
        caps = await pg.evaluate("() => [...document.querySelectorAll('.cap')].map(e => e.innerText)")
        check(len(caps) == 5, f"cinq écrans présents ({len(caps)})")
        check(not erreurs, "aucune erreur JavaScript", "; ".join(erreurs[:2]))

        debord = await pg.evaluate("""() => {
            const d = document.documentElement;
            return { doc: d.scrollWidth, fen: d.clientWidth,
                     larges: [...document.querySelectorAll('body *')]
                        .filter(e => e.getBoundingClientRect().right > 1441)
                        .map(e => e.className || e.tagName).slice(0, 5) };
        }""")
        check(debord["doc"] <= LARGEUR + 1, f"aucun débordement horizontal ({debord['doc']} px)")
        check(not debord["larges"], "aucun élément ne dépasse 1440 px", str(debord["larges"]))

        # ── 2. affichage pur : rien qui ressemble à une candidature
        print("── 2. Affichage pur — ce qui ne doit pas exister")
        fichiers = await pg.evaluate("() => document.querySelectorAll('input[type=file], input[accept], textarea').length")
        check(fichiers == 0, "aucun champ de fichier, aucune zone de dépôt, aucun CV", f"{fichiers} trouvé(s)")
        interdits = ["déposer ma candidature", "envoyer mon cv", "joindre mon cv", "lettre de motivation",
                     "suivi de candidature", "candidatures reçues", "profil candidat"]
        trouves = [m for m in interdits if m in corps.lower()]
        check(not trouves, "aucune promesse de candidature à la Kazendra", str(trouves))
        check("aucune candidature" in corps.lower(), "la page dit qu'aucune candidature n'est reçue")
        check("affichage pur" in corps.lower(), "la page nomme le régime : affichage pur")

        # ── 3. la mécanique du courriel
        print("── 3. Le geste « écrire à l'employeur »")
        boutons = await pg.evaluate("""() => [...document.querySelectorAll('[data-a][data-b]')]
            .map(b => ({a: b.dataset.a, b: b.dataset.b, s: b.dataset.sujet || '',
                        txt: b.innerText.trim(), h: b.getBoundingClientRect().height}))""")
        check(len(boutons) >= 2, f"le geste existe sur le bureau et sur le mobile ({len(boutons)})")
        adresse = (boutons[0]["a"] + "@" + boutons[0]["b"]) if boutons else ""
        check(adresse.count("@") == 1 and "." in adresse, f"l'adresse s'assemble : {adresse}")
        # L'adresse est légitimement visible dans le dépôt (l'employeur saisit la sienne) ; ce qui
        # compte, c'est qu'elle n'apparaisse sur aucun écran PUBLIC — c'est là qu'un robot la récolte.
        # (Premier jet de ce contrôle : « adresse absente du fichier source » — faux positif, le
        # formulaire de dépôt doit bien montrer l'adresse à celui qui la tape.)
        blocs = await pg.evaluate("""() => {
            const parts = []; let cur = '';
            for (const el of document.body.children) {
                if (el.classList && el.classList.contains('cap')) { if (cur) parts.push(cur); cur = ''; }
                cur += ' ' + (el.innerText || '');
            }
            if (cur) parts.push(cur);
            return parts;
        }""")
        check(len(blocs) == 5, f"cinq blocs de texte, un par écran ({len(blocs)})")
        fuites = [i + 1 for i in (0, 1, 4) if adresse in plat(blocs[i])]
        check(not fuites, "l'adresse n'apparaît sur aucun écran public (liste, fiche, mobile)", str(fuites))
        check(adresse in plat(blocs[2]), "l'adresse est visible dans le dépôt, à sa place")
        check(all("kazendra" not in (b["s"] or "").lower() for b in boutons),
              "l'objet du courriel ne mentionne jamais Kazendra")
        # « Gmail » a le droit d'exister comme exemple de domaine surveillé par la modération.
        # Il est interdit comme PROMESSE : le gestionnaire par défaut peut être autre chose, ou absent.
        promesses = re.findall(r"(ouvre(?:ra)? (?:ton|votre) gmail|gmail s'ouvre|s'ouvre dans gmail"
                               r"|avec (?:ton|votre) gmail|dans gmail)", corps.lower())
        check(not promesses, "la page ne promet jamais que le clic ouvre Gmail", str(promesses))
        check(all("gmail" not in (b["txt"] or "").lower() for b in boutons),
              "le bouton ne nomme pas Gmail")

        # window.location n'est pas reconfigurable dans Chromium : on lit le témoin que la maquette
        # pose elle-même avant de naviguer (data-dernier-courriel sur <html>).
        mailto = await pg.evaluate("""() => {
            document.querySelector('[data-a][data-b]').click();
            return document.documentElement.dataset.dernierCourriel || null;
        }""")
        check(bool(mailto) and str(mailto).startswith("mailto:"), f"le clic produit un mailto ({mailto})")
        check("kazendra" not in str(mailto or "").lower(),
              "le lien mailto ne contient aucune trace de Kazendra")

        # ── 3 bis. le message proposé : utile, court, honnête, et facultatif
        print("── 3 bis. Le message proposé, jamais imposé")
        # Attention au nom : `corps` porte déjà le TEXTE DE LA PAGE (défini plus haut). Réutiliser ce
        # nom ici écrasait le texte de la page, et les contrôles suivants testaient le corps du
        # message au lieu de l'écran — quatorze échecs d'un coup. D'où `texte_propose`.
        texte_propose = await pg.evaluate("""() => {
            const b = document.querySelector('.postuler[data-corps]');
            return b ? b.dataset.corps : null;
        }""")
        check(texte_propose is not None, "le message proposé existe sur le geste principal")
        if texte_propose:
            check(len(texte_propose) < 700,
                  f"le message reste court — un mailto trop long est tronqué par certains clients "
                  f"({len(texte_propose)} caractères)")
            check("kazendra" not in texte_propose.lower(), "le message ne mentionne jamais Kazendra")
            # Le piège : un modèle qui écrit « je joins mon CV » alors que rien n'est joint.
            # Une phrase qui promet une pièce absente est pire qu'un corps vide.
            mensonge = re.findall(r"ci-joint|pi[eè]ce jointe|je joins|mon cv", texte_propose.lower())
            check(not mensonge, "le message ne promet AUCUNE pièce jointe (rien n'est joint)",
                  str(mensonge))
            check("madame, monsieur" in texte_propose.lower(),
                  "le message ouvre par une formule neutre")

        brouillon = await pg.evaluate(
            "() => { const d = document.querySelector('.draft'); return d ? d.innerText : null; }")
        check(bool(brouillon) and "Vendeur·se en boulangerie" in (brouillon or ""),
              "le brouillon est montré AVANT le clic, pas caché dans le lien")

        # Les deux gestes, et la différence entre eux doit être réelle.
        avec = await pg.evaluate("""() => {
            document.querySelector('.postuler[data-corps]').click();
            return document.documentElement.dataset.dernierCourriel || null;
        }""")
        check("&body=" in str(avec), "le geste principal ouvre le message pré-rempli")

        vide = await pg.evaluate("""() => {
            const b = document.querySelector('a[data-a][data-b]:not([data-corps])');
            if (!b) return null;
            b.click();
            return document.documentElement.dataset.dernierCourriel || null;
        }""")
        check(bool(vide) and str(vide).startswith("mailto:") and "&body=" not in str(vide),
              f"le geste « sans texte » ouvre un message VIDE ({str(vide)[:52]}…)")

        # La maquette se décrivait elle-même : « rien d'autre n'est pré-rempli ». C'était vrai avant
        # le brouillon, et c'est faux depuis. Un commentaire de planche qui ment est un défaut.
        check("rien d'autre n'est pré-rempli" not in corps.lower(),
              "la planche ne dit plus « rien d'autre n'est pré-rempli » — c'était faux depuis le brouillon")

        # ── 4. les cinq mentions
        print("── 4. Les cinq mentions obligatoires")
        for m in ["Employeur identifié", "Lieu", "Durée", "Statut", "Rémunération"]:
            check(m in corps, f"mention « {m} » présente")
        check("commission paritaire" in corps.lower(), "la commission paritaire est nommée")
        check("vérifié à la main" in corps, "le BCE est dit vérifié à la main, daté")

        # ── 5. aucun âge dans une offre
        print("── 5. Aucun âge comme critère")
        # Même tolérance que l'audit de /job-etudiant : une phrase interdite CITÉE pour être refusée
        # n'est pas une infraction. On ne signale « jeune » que s'il n'y a aucun mot de refus autour.
        # « ne pouvez pas » manquait : le bloc de l'écran 3 s'appelle « Ce que vous ne pouvez pas
        # écrire », donc la citation correcte de la règle était comptée comme une infraction.
        refus = ("ne peut pas", "ne peuvent pas", "ne pouvez pas", "pas écrire", "pas demander",
                 "interdit", "jamais", "aucun", "bloqué", "déconseillé")
        fautifs = []
        for m in re.finditer(r"\bjeunes?\b", corps, re.I):
            fenetre = corps[max(0, m.start() - 70):m.end() + 70].lower()
            if not any(r in fenetre for r in refus):
                fautifs.append(fenetre)
        ages = re.findall(r"\b\d{2} ?[-–] ?\d{2} ans\b", corps)
        check(not ages and not fautifs,
              "aucune fourchette d'âge, aucun « jeune » employé comme qualité", str(ages + fautifs))
        badges = await pg.evaluate("() => [...document.querySelectorAll('.b18')].map(e => e.innerText)")
        check(all(b.strip() == "18 ans et plus" for b in badges),
              "le seul âge affiché est le badge « 18 ans et plus »", str(badges))
        # Le badge ne doit pas être étiré : c'est le défaut qui a échappé à l'œil puis au script sur
        # /job-etudiant (.arow .t span passait le badge en display:block). Ici on le MESURE, on ne le
        # suppose pas — un badge de 18 px de haut sur 500 px de large n'est plus un badge.
        largeurs = await pg.evaluate("""() => [...document.querySelectorAll('.b18')]
            .map(e => Math.round(e.getBoundingClientRect().width))""")
        check(all(w < 200 for w in largeurs), f"le badge n'est pas étiré ({largeurs} px de large)",
              str(largeurs))
        # Et l'étiquette de contrat, même piège, même mesure : la corriger sans la contrôler, c'est
        # garantir qu'elle se réétirera au prochain écran. C'est exactement ce qui s'est passé — le
        # premier correctif (:not(.b18)) a réparé le badge et cassé l'étiquette « CDI · 38 h ».
        etiquettes = await pg.evaluate("""() => [...document.querySelectorAll('.orow .t > span.mt')]
            .map(e => Math.round(e.getBoundingClientRect().width))""")
        check(bool(etiquettes) and all(w < 400 for w in etiquettes),
              f"les étiquettes de contrat ne sont pas étirées ({etiquettes} px)",
              str(etiquettes))

        # ── 5 bis. le bouton de partage du hub : rond, 34 px, une flèche
        partage = await pg.evaluate("""() => {
            const s = document.querySelector('.share');
            if (!s) return null;
            const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
            return {l: Math.round(r.width), h: Math.round(r.height),
                    rayon: cs.borderRadius, fleches: s.querySelectorAll('path').length};
        }""")
        check(partage is not None, "le bouton de partage existe sur la fiche")
        if partage:
            check(partage["l"] == 34 and partage["h"] == 34,
                  f"le bouton de partage fait 34 × 34 ({partage['l']} × {partage['h']})")
            check(partage["rayon"].startswith("50%") or "17px" in partage["rayon"],
                  f"il est rond ({partage['rayon']})")
            check(partage["fleches"] >= 1, f"il porte une flèche ({partage['fleches']} tracés)")

        # ── 6. cibles tactiles du mobile
        print("── 6. Mobile — ce qu'on peut taper du pouce")
        cibles = await pg.evaluate("""() => [...document.querySelectorAll(
            '.pgo, .sticky .go, .sticky .gh, .sans, .msans')]
            .map(e => ({c: e.className, h: Math.round(e.getBoundingClientRect().height)}))""")
        trop = [c for c in cibles if c["h"] < 44]
        check(not trop, f"toutes les cibles ≥ 44 px ({len(cibles)} mesurées)", str(trop))

        # ── 7. contrastes
        print("── 7. Contrastes AA")
        for nom, fg, bg, seuil in [("texte courant", "#4A5C6B", "#FFFFFF", 4.5),
                                   ("discret", "#5E7180", "#FFFFFF", 4.5),
                                   ("discret sur gris", "#5E7180", "#F5F7F9", 4.5),
                                   ("vert vérifié", "#25634A", "#FFFFFF", 4.5),
                                   ("navy sur blanc", "#0D3B5B", "#FFFFFF", 4.5)]:
            r = ratio(fg, bg)
            check(r >= seuil, f"contraste {nom} : {r}:1")

        # ── 8. le plafond et les états
        print("── 8. Plafond et états")
        check("trois annonces actives" in corps.lower(), "le plafond de trois annonces actives est écrit")
        check("ne comptent pas" in corps.lower() or "ne compte" in corps.lower(),
              "le plafond dit ce qu'il ne compte pas (brouillons, refusées, expirées)")
        for e in ["publiée", "en relecture", "refusée", "expirée", "brouillon"]:
            check(e in corps.lower(), f"état « {e} » présent")

        # ── 9. les textes figés sont-ils ceux des écrans ?
        # Ce contrôle aurait attrapé la dérive de la version 1.0 des textes : écrits APRÈS la maquette,
        # dans un registre différent (tu/vous mélangés), 0 phrase sur 19 se retrouvait à l'écran.
        # Un fichier de textes qui ne correspond à aucun écran est une deuxième vérité.
        print("── 9. Les textes figés sont ceux des écrans")
        textes = json.loads((BASE.parent / "textes" / "emploi-fr.json")
                            .read_text(encoding="utf-8"))["textes"]

        def norme(s):
            s = s.replace("\u2019", "'").replace("\u00a0", " ")
            s = re.sub(r"\s+", " ", s)
            # Une balise en ligne laisse un espace avant la ponctuation quand on retire les tags :
            # « <b>écrire</b>. » devient « écrire . ». Sans cette ligne, trois phrases correctes
            # étaient déclarées absentes.
            s = re.sub(r"\s+([,;:.!?»])", r"\1", s)
            return s.strip().lower()

        page = norme(corps)
        absents = [k for k, v in textes.items() if norme(v) not in page]
        check(not absents, f"les {len(textes)} textes figés se retrouvent à l'écran", str(absents))

        # ── 10. captures
        print("── 10. Captures")
        positions = await pg.evaluate("""() => [...document.querySelectorAll('.cap')]
            .map(e => e.getBoundingClientRect().top + window.scrollY)""")
        hauteur = await pg.evaluate("() => document.documentElement.scrollHeight")
        noms = ["emploi-liste", "emploi-fiche", "emploi-depot", "emploi-mes-offres", "emploi-mobile-390"]
        for i, top in enumerate(positions):
            bas = positions[i + 1] if i + 1 < len(positions) else hauteur
            # full_page=True est obligatoire : sans lui, un clip au-delà de la fenêtre lève
            # « Clipped area is either empty or outside the resulting image ».
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
