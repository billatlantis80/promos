#!/usr/bin/env python3
"""
ÉPREUVE DU PANNEAU, PAYS PAR PAYS — dans un vrai navigateur.
===========================================================

CE QU'ELLE PROUVE, ET POURQUOI UN TEST DE FICHIER NE SUFFIT PAS.
   Les épreuves `tests/*.test.mjs` exécutent les fonctions PURES : elles disent
   que le compte est juste. Elles ne disent pas qu'un écran se DESSINE, ni que
   le pays choisi est celui qu'on croit. Ici on ouvre le panneau, on crée
   l'accès, on clique vraiment l'onglet et vraiment la tuile du pays, puis on
   relit les tableaux cellule par cellule.

CE QU'ELLE VÉRIFIE (la partition, sur les deux onglets) :
   - Marché Euro : somme des acteurs par catégorie = total du pays ;
     branchés + en veille + non suivis = total du pays ;
     somme des acteurs de TOUS les pays = taille de la base (609) ;
   - Affiliation : trouvé + non mesuré + aucun signe = acteurs du pays ;
     les deux onglets annoncent le MÊME nombre de pays ;
   - aucun pays ne s'ouvre sur un écran vide sans l'annoncer.

Lancement :
  PLAYWRIGHT_BROWSERS_PATH=/opt/data/capture/browsers \\
  /opt/data/capture/venv/bin/python outils/epreuve-panneau-pays.py [PAYS]
"""
import json
import os
import re
import subprocess
import sys
import time

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/data/capture/browsers")
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAYS = (sys.argv[1] if len(sys.argv) > 1 else "DE").upper()
PORT = 4289


def nombre(txt):
    return int(re.sub(r"[^0-9]", "", txt) or 0)


def servir():
    """LE SERVEUR DU PROJET, PAS UN SERVEUR DE FICHIERS QUELCONQUE.

    Le panneau lit `../offres.json` — 13 Mo qui vivent dans `data/`, PAS dans
    `public/` : `python -m http.server` sur `public/` répondrait 404, le
    catalogue serait nul, et la barre des pays ne se dessinerait pas. On croirait
    alors à une panne du panneau alors que c'est le serveur qui servait le
    mauvais dossier. `server.js` sert `public/` ET route les données du
    collecteur : c'est l'exemplaire que voit le propriétaire.
    """
    return subprocess.Popen(
        ["node", "server.js"],
        cwd=RACINE,
        env={**os.environ, "PORT": str(PORT), "HOST": "127.0.0.1"},
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def main():
    erreurs = []
    serveur = servir()
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            nav = p.chromium.launch()
            page = nav.new_page(viewport={"width": 1440, "height": 1000})
            page.on("pageerror", lambda e: erreurs.append("JS: " + str(e)))
            page.goto(f"http://127.0.0.1:{PORT}/admin/", wait_until="domcontentloaded", timeout=60000)

            # L'écran d'accès : sur un profil neuf, n'importe quel identifiant
            # (>= 3) et mot de passe (>= 10) CRÉENT l'accès. On le franchit par
            # ses champs — le panneau est un module, ses fonctions ne sont pas
            # joignables de l'extérieur.
            page.fill("#aId", "epreuve-pays")
            page.fill("#aMdp", "mot-de-passe-epreuve-2026")
            page.click("#aOk")
            page.wait_for_selector("#panneau:not([hidden])", timeout=30000)
            page.wait_for_function(
                "() => { const e = document.getElementById('mMarcheCompteurs');"
                " return e && e.innerText.trim().length > 0; }", timeout=60000)

            bilan = {}

            # ------------------------------------------------ MARCHÉ EURO
            page.click("button[data-vue='marche']")
            page.wait_for_timeout(600)
            page.wait_for_selector(f"#paysMarche button[data-pays='{PAYS}']", timeout=30000)
            page.click(f"#paysMarche button[data-pays='{PAYS}']")
            page.wait_for_timeout(900)
            bilan["marche"] = page.evaluate(
                """() => {
                const cellules = (sel) => [...document.querySelectorAll(sel + ' tr')]
                  .map((tr) => [...tr.children].map((td) => td.innerText.trim().replace(/\\s+/g, ' ')));
                return {
                  tuiles: [...document.querySelectorAll('#paysMarche button[data-pays]')]
                    .map((b) => b.dataset.pays),
                  resume: (document.getElementById('resumePays') || {}).innerText || '',
                  recap: cellules('#mPaysRecap'),
                  compteurs: (document.getElementById('mMarcheCompteurs') || {}).innerText || '',
                  acteurs: [...document.querySelectorAll('#mMarche details')].length,
                  categories: document.querySelectorAll('#mMarche details').length,
                };
            }""")
            page.screenshot(path=f"/tmp/panneau-marche-{PAYS}.png", full_page=False)
            page.evaluate("document.getElementById('mPaysRecap').scrollIntoView({block:'start'})")
            page.wait_for_timeout(400)
            page.screenshot(path=f"/tmp/panneau-marche-{PAYS}-recap.png")

            # ------------------------------------------------ AFFILIATION
            page.click("button[data-vue='affiliation']")
            page.wait_for_timeout(900)
            page.wait_for_selector(f"#paysAffiliation button[data-pays='{PAYS}']", timeout=30000)
            page.click(f"#paysAffiliation button[data-pays='{PAYS}']")
            page.wait_for_timeout(900)
            bilan["affiliation"] = page.evaluate(
                """() => ({
                  tuiles: [...document.querySelectorAll('#paysAffiliation button[data-pays]')]
                    .map((b) => b.dataset.pays),
                  resume: (document.getElementById('resumeAffiliation') || {}).innerText || '',
                  compteurs: (document.getElementById('mAffCompteurs') || {}).innerText || '',
                  reseaux: (document.getElementById('mAffReseaux') || {}).innerText || '',
                  groupes: [...document.querySelectorAll('#mAffiliation details')]
                    .map((d) => (d.querySelector('summary') || {}).innerText || ''),
                  lignes: [...document.querySelectorAll('#mAffiliation details')]
                    .map((d) => [...d.querySelectorAll('tbody tr')].length),
                  // L'EN-TÊTE ET LES CELLULES DE LA TABLE DES ACTEURS DE CHAQUE
                  // GROUPE, séparément. C'est ici que se voit un retrait de colonne
                  // (« Preuve » partie le 12/10/2026), et c'est ce qui permet de
                  // compter les cases de la ligne contre les titres.
                  //
                  // TABLE PAR TABLE, ET C'EST UN DÉFAUT CORRIGÉ LE MÊME JOUR : une
                  // première version ramassait les quatre en-têtes dans une seule
                  // liste — vingt titres — puis les comparait aux cinq cases d'une
                  // ligne, et annonçait « 5 cases pour 20 colonnes ». Le contrôle
                  // était faux, pas le panneau.
                  tables: [...document.querySelectorAll('#mAffiliation details')].map((d) => ({
                    titres: [...d.querySelectorAll('table tr:first-child th')]
                      .map((th) => th.textContent.trim()),
                    cases: [...d.querySelectorAll('table tr:not(:first-child)')]
                      .map((tr) => tr.children.length),
                  })),
                  // LE BLOC « DÉJÀ FAIT », mesuré lui aussi : c'est le seul endroit
                  // où les deux comptes se rencontrent (celui du pays, celui de tous
                  // les pays), et c'est la question que B a posée le 12/10/2026.
                  faites: (document.getElementById('mAffFaites') || {}).innerText || '',
                })""")
            page.screenshot(path=f"/tmp/panneau-affiliation-{PAYS}.png")

            # ------------------------------------------ LA PARTITION, PAR PAYS
            bilan["pays"] = page.evaluate(
                """async () => {
                const b = await fetch('../acteurs.json', {cache: 'no-store'}).then((r) => r.json());
                const parPays = {};
                for (const a of (b.acteurs || [])) parPays[a.pays || '—'] = (parPays[a.pays || '—'] || 0) + 1;
                return { taille: (b.acteurs || []).length, parPays };
            }""")
            nav.close()
    finally:
        serveur.terminate()

    print(f"\n=== Marché Euro — {PAYS} ===")
    print(bilan["marche"]["resume"].replace("\n", " ")[:200])
    print(f"tuiles de pays : {len(bilan['marche']['tuiles'])} → {', '.join(bilan['marche']['tuiles'])}")
    print(f"catégories affichées : {bilan['marche']['categories']}")
    print(f"compteurs : {bilan['marche']['compteurs'][:220]}")

    print(f"\n=== Affiliation — {PAYS} ===")
    print(bilan["affiliation"]["resume"].replace("\n", " ")[:200])
    print(f"tuiles de pays : {len(bilan['affiliation']['tuiles'])}")
    print(f"compteurs : {bilan['affiliation']['compteurs'][:220]}")
    print(f"réseaux : {bilan['affiliation']['reseaux'][:220]}")
    print(f"groupes : {bilan['affiliation']['groupes']} — lignes : {bilan['affiliation']['lignes']}")
    # LE CONTRÔLE DES COLONNES DE LA TABLE DES ACTEURS (ajouté le 12/10/2026), TABLE
    # PAR TABLE : la colonne « Preuve » ne doit plus y être, et chaque ligne doit
    # écrire autant de cases qu'il y a de titres — le défaut de tout retrait de
    # colonne, celui qui laisse la table lisible ET décalée.
    tables = bilan["affiliation"]["tables"]
    attendu = ["Acteur", "Catégorie", "Articles", "Réseaux", "Note"]
    # ⚠ ON COLLECTE, ON NE POSE PAS `ok = False` ICI. Défaut mesuré le 12/10/2026 en
    # écrivant ce contrôle : `ok = True` est réinitialisé PLUS BAS dans cette
    # fonction, donc un défaut compté avant lui était EFFACÉ — le contrôle
    # paraissait vert alors qu'il venait de tomber. On rassemble donc les défauts
    # et on les intègre après l'initialisation.
    defauts_colonnes = []
    for i, t in enumerate(tables):
        cases = sorted(set(t["cases"]))
        print(f"  groupe {i + 1} — colonnes : {t['titres']} — cases par ligne : {cases}")
        if "Preuve" in t["titres"]:
            defauts_colonnes.append(f"groupe {i + 1} : la colonne « Preuve » est encore là")
        if t["titres"] != attendu:
            defauts_colonnes.append(f"groupe {i + 1} : en-tête {t['titres']} au lieu de {attendu}")
        if cases and cases != [len(t["titres"])]:
            defauts_colonnes.append(f"groupe {i + 1} : lignes à {cases} case(s) pour {len(t['titres'])} colonne(s)")
    # LES DEUX COMPTES DISENT-ILS LEUR PORTÉE ? C'est la question de B du
    # 12/10/2026 (une affiliation « dans ce pays » en haut, deux « déjà fait » plus
    # bas), et elle se vérifie sur le TEXTE RENDU, pas sur le fichier : ce que B
    # lit, c'est le DOM.
    faites = bilan["affiliation"]["faites"].replace("\n", " ")
    print(f"bloc « déjà fait » : {faites[:200]}")
    if "dans ce pays" not in bilan["affiliation"]["compteurs"].lower():
        defauts_colonnes.append("le compteur du pays ne dit pas « dans ce pays »")
    if "en tout" not in faites.lower():
        defauts_colonnes.append("le bloc des affiliations faites ne dit pas « en tout »")
    if "sur" not in faites.lower():
        defauts_colonnes.append("le bloc ne réconcilie pas les deux chiffres (aucun « sur »)")

    base = bilan["pays"]
    total_base = sum(base["parPays"].values())
    print(f"\nbase publiée : {base['taille']} acteurs ; somme des pays : {total_base}")
    print("par pays : " + " · ".join(f"{k} {v}" for k, v in sorted(base["parPays"].items(), key=lambda x: -x[1])))

    ok = True
    # Les défauts des colonnes de l'affiliation, rassemblés plus haut, entrent
    # MAINTENANT — c'est le seul endroit où ils ne peuvent plus être effacés.
    for d in defauts_colonnes:
        print(f"✗ {d}"); ok = False
    # LES DEUX ONGLETS PARLENT DU MÊME AXE : ils doivent annoncer le même
    # ENSEMBLE de pays (l'ORDRE diffère légitimement — le Marché Euro trie par
    # acteurs, l'Affiliation par programmes trouvés).
    if set(bilan["marche"]["tuiles"]) != set(bilan["affiliation"]["tuiles"]):
        manquants = set(bilan["marche"]["tuiles"]) ^ set(bilan["affiliation"]["tuiles"])
        print(f"✗ les deux onglets n'annoncent pas les mêmes pays : {sorted(manquants)}"); ok = False
    if len(bilan["marche"]["tuiles"]) < 12:
        print("✗ des pays ont disparu du choix"); ok = False

    # LE RÉCAPITULATIF : somme des lignes de CATÉGORIE = total du pays. La
    # dernière ligne est le TOTAL lui-même — la compter ferait 2 × le total, et
    # c'est exactement le genre de faux défaut qu'un contrôle mal écrit produit.
    recap = [l for l in bilan["marche"]["recap"][1:]
             if len(l) > 1 and not re.match(r"^\s*total", l[0], re.I)]
    if recap:
        tot = sum(nombre(l[1]) for l in recap)
        attendu = base["parPays"].get(PAYS, 0)
        print(f"récapitulatif : {len(recap)} catégorie(s) · somme {tot} · attendu {attendu}")
        if tot != attendu:
            print(f"✗ les catégories ne totalisent pas les acteurs du pays ({tot} ≠ {attendu})"); ok = False
        # chaque ligne : branchés + en veille + non suivis = acteurs de la ligne
        for l in recap:
            if len(l) >= 5 and nombre(l[2]) + nombre(l[3]) + nombre(l[4]) != nombre(l[1]):
                print(f"✗ {l[0]} : les trois états ne totalisent pas ses acteurs ({l[1:]})"); ok = False
    # L'AFFILIATION : trouvé + non mesuré + aucun signe = acteurs du pays.
    c = bilan["affiliation"]["compteurs"]
    lignes_compteurs = re.findall(r"(\d+)\s*\n?\s*(affiliation\(s\) déjà faite\(s\)|acteurs recensés|programmes trouvés|à vérifier à la main|aucun signe trouvé)", c)
    v = {lib: nombre(n) for n, lib in lignes_compteurs}
    if v:
        # QUATRE ÉTATS DEPUIS LE 12/10/2026, ET C'EST LE CONTRÔLE QUI DOIT SUIVRE.
        # « affiliation faite » est arrivé en tête (demande de B : « combien
        # d'affiliation j'ai déjà fait »), et il ne s'ajoute pas aux trois autres :
        # il en SORT l'acteur. Ce contrôle-ci sommait les trois anciens et
        # annonçait 148 pour 149 acteurs — il accusait le panneau d'un défaut qui
        # était le sien : sa règle de comptage datait de la veille.
        somme = (v.get("affiliation(s) déjà faite(s)", 0) + v.get("programmes trouvés", 0)
                 + v.get("à vérifier à la main", 0) + v.get("aucun signe trouvé", 0))
        print(f"affiliation : {v}")
        if somme != v.get("acteurs recensés", -1):
            print(f"✗ les quatre états ne totalisent pas les acteurs du pays ({somme} ≠ {v.get('acteurs recensés')})")
            ok = False
    if total_base != base["taille"]:
        print("✗ la partition par pays ne retombe pas sur la base"); ok = False
    if base["taille"] != 609:
        print(f"✗ la base n'a pas 609 acteurs ({base['taille']})"); ok = False
    if base["parPays"].get(PAYS, 0) == 0:
        print(f"✗ aucun acteur pour {PAYS}"); ok = False
    if erreurs:
        print(f"✗ erreurs JavaScript : {erreurs[:3]}"); ok = False
    print("\ntout est conforme" if ok else "\nil reste des défauts ci-dessus")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
