#!/usr/bin/env python3
"""
DEUXIÈME PASSE — LIRE avec un vrai navigateur les sites qui ont refusé la
mesure automatique.

POURQUOI CETTE PASSE EXISTE. Le premier balayage se fait en HTTP simple : rapide,
et suffisant pour la plupart des sites. Mais il se fait refuser par tous ceux qui
protègent leur accès (HTTP 403) ou qui montent leur page en JavaScript (page
vide). Mesuré sur les 76 premiers acteurs : 34 « non mesuré », près de la moitié.
Une base à moitié vide ne donne pas « une vue claire de quelle affiliation j'ai
ou pas » : elle donne une vue FAUSSE, parce qu'une case vide se lit comme un
« non ».

CE QUE CE SCRIPT FAIT, ET RIEN DE PLUS. Il LIT. Il ne décide pas, il ne conclut
pas : il enregistre le HTML rendu et les liens de la page, puis s'arrête. La
détection reste dans `outils/mesure-affiliations.mjs` — une seule logique, dans
un seul fichier. Dupliquer les règles ici les ferait diverger, et c'est
exactement le genre d'écart qui produit des chiffres faux sans bruit.

CE QU'IL NE FAIT PAS. Il ne contourne aucune protection : pas de résolution de
captcha, pas de rotation d'adresse, pas de faux utilisateur. Si un site refuse
encore, il reste « non mesuré » — on change d'outil, pas de règle.

Lancement :
  PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
  /opt/data/capture/venv/bin/python outils/rendus-navigateur.py [--max N]
"""
import argparse
import json
import os
import re
import sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHIER = os.path.join(RACINE, "donnees", "affiliations.json")
SORTIE = os.path.join(RACINE, "donnees", "rendus")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=0)
    ap.add_argument("--fichier", default=FICHIER)
    ap.add_argument("--tous", action="store_true",
                    help="relire TOUS les acteurs, pas seulement les non mesurés")
    ap.add_argument("--pays", default="",
                    help="ne relire que les acteurs d'UN pays (ex. DE)")
    ap.add_argument("--etats", default="non mesuré",
                    help="les états à relire, séparés par des virgules "
                         "(ex. « non mesuré,aucun signe trouvé »). La passe HTTP "
                         "rate souvent un programme caché derrière du JavaScript "
                         "ou une bannière : ne relire que les refus laisserait "
                         "ces faux « aucun signe » en place.")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    with open(args.fichier, encoding="utf-8") as f:
        mesures = json.load(f)

    etats = {e.strip() for e in args.etats.split(",") if e.strip()}
    pays = args.pays.strip().upper()
    if args.tous:
        cibles = [a for a in mesures["acteurs"] if a.get("domaine")]
    else:
        cibles = [a for a in mesures["acteurs"]
                  if a.get("etat") in etats and a.get("domaine")]
    if pays:
        cibles = [a for a in cibles if (a.get("pays") or "").upper() == pays]
    if args.max:
        cibles = cibles[: args.max]

    # UNE PAGE, UN RENDU — même si DEUX lignes décrivent le même site.
    # Le tableur allemand porte « Zalando » ET « Zalando (mode) », « Otto
    # (otto.de) » ET « Otto Group (mode) » : même domaine. Sans regroupement, la
    # page était rendue deux fois et le second écrasait le premier fichier — si
    # bien qu'une des deux lignes ne recevait jamais sa mesure. On regroupe par
    # domaine et on note TOUS les noms que la page sert.
    par_domaine = {}
    for a in cibles:
        par_domaine.setdefault(a["domaine"], []).append(a["nom"])
    cibles = [{"domaine": d, "nom": noms[-1], "noms": noms}
              for d, noms in par_domaine.items()]

    os.makedirs(SORTIE, exist_ok=True)
    print(f"À relire au navigateur : {len(cibles)} page(s)"
          + (f" — pays {pays}" if pays else "") + f" — états : {', '.join(sorted(etats))}")

    fait, refus = 0, 0
    with sync_playwright() as p:
        nav = p.chromium.launch()
        ctx = nav.new_context(
            viewport={"width": 1440, "height": 950},
            locale="fr-BE",
            user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            extra_http_headers={"accept-language": "fr-BE,fr;q=0.9,en;q=0.8"},
        )
        # Les images et les polices ne servent à rien ici : les charger rendrait
        # la passe trois fois plus longue pour aucune information de plus.
        ctx.route(re.compile(r"\.(png|jpe?g|gif|webp|svg|woff2?|ttf|mp4|css)(\?|$)"),
                  lambda route: route.abort())

        for i, a in enumerate(cibles, 1):
            domaine = a["domaine"]
            base = f"https://{domaine}"
            resultat = {"nom": a["nom"], "noms": a.get("noms") or [a["nom"]],
                        "domaine": domaine, "base": base}
            try:
                page = ctx.new_page()
                rep = page.goto(base, wait_until="domcontentloaded", timeout=20000)
                resultat["statut"] = rep.status if rep else 0
                resultat["url_finale"] = page.url
                try:
                    page.wait_for_load_state("networkidle", timeout=6000)
                except Exception:
                    pass  # un site qui garde une connexion ouverte n'est pas un échec
                html = page.content()
                resultat["octets"] = len(html)
                resultat["liens"] = page.eval_on_selector_all(
                    "a[href]", "els => els.map(e => [e.href, (e.textContent||'').trim().slice(0,120)])")
                with open(os.path.join(SORTIE, f"{domaine}.html"), "w", encoding="utf-8") as f:
                    f.write(html)
                with open(os.path.join(SORTIE, f"{domaine}.json"), "w", encoding="utf-8") as f:
                    json.dump(resultat, f, ensure_ascii=False)
                if resultat["octets"] > 2000:
                    fait += 1
                    marque = "✓"
                else:
                    refus += 1
                    marque = "·"
                print(f"{marque} [{i:3}/{len(cibles)}] {a['nom']} — {resultat['statut']}, {resultat['octets']} o, {len(resultat['liens'])} lien(s)")
                page.close()
            except Exception as e:
                refus += 1
                resultat["erreur"] = str(e)[:200]
                with open(os.path.join(SORTIE, f"{domaine}.json"), "w", encoding="utf-8") as f:
                    json.dump(resultat, f, ensure_ascii=False)
                print(f"· [{i:3}/{len(cibles)}] {a['nom']} — échec : {resultat['erreur'][:80]}")

        nav.close()

    print(f"\n{fait} page(s) lue(s) · {refus} encore refusée(s)")
    print(f"→ rendus dans {SORTIE}")
    print("Étape suivante : node outils/mesure-affiliations.mjs --depuis-rendus")


if __name__ == "__main__":
    sys.exit(main())
