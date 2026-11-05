#!/usr/bin/env python3
"""Quelles clés de traduction l'application demande-t-elle VRAIMENT ?

Preuve par exécution. On ne cherche pas du texte dans les sources (les
apostrophes des commentaires français désynchronisent les guillemets d'un
scanner naïf) : on instrumente `t()` elle-même, puis on exerce l'application
par son interface.

DÉFAUT CORRIGÉ — première version : on remplaçait chaque dictionnaire par un
Proxy. `indexNormalise()` parcourt le dictionnaire entier avec
`Object.entries(dico)` dès qu'une clé manque : le Proxy comptait donc les 229
clés comme « lues » et la sonde répondait « aucune clé morte », ce qui est
faux. On injecte désormais la mesure DANS le corps de `t()`, seule fonction
appelée par l'interface.

Note de méthode : `t(cle)` ne dépend pas de la langue — le même code lit les
mêmes clés quelle que soit la langue active. Un parcours complet dans une
langue établit l'ensemble des clés atteignables ; on confirme sur d'autres.

Sortie : /tmp/t9n-vues.json
"""
import json
import re
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:3212'
LANGUES = ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']
TOTAL = {}

SONDE = ("export function t(cle, variables) {"
         " try{(globalThis.__vues[langueCourante]=globalThis.__vues[langueCourante]||{})"
         "[String(cle)]=1;}catch(e){}")
SONDE_INIT = "globalThis.__vues = globalThis.__vues || {};"

brut = urllib.request.urlopen(BASE + '/langues.js').read().decode('utf-8')
if 'export function t(cle, variables) {' not in brut:
    sys.exit('sonde impossible : signature de t() introuvable')
SOURCE = SONDE_INIT + brut.replace('export function t(cle, variables) {', SONDE, 1)


def dire(*a):
    print(*a, flush=True)


def brancher_fuite(page):
    page.route('**/langues.js', lambda r: r.fulfill(
        status=200, content_type='text/javascript; charset=utf-8', body=SOURCE))


def clic(page, sel, attente=80):
    try:
        el = page.query_selector(sel)
        if el and el.is_visible():
            el.click(timeout=1200)
            page.wait_for_timeout(attente)
            return True
    except Exception:
        pass
    return False


def ecarter_pays(page):
    """Au premier lancement, la modale « Où fais-tu tes achats ? » recouvre tout
    et intercepte les clics (c'est elle qui faisait expirer la sonde : 30 s par
    clic masqué). On choisit un pays par son bouton, comme un utilisateur."""
    try:
        if page.evaluate("() => { const m=document.querySelector('#paysDemande');"
                         " return !!m && !m.hidden; }"):
            page.evaluate('''() => {
              const b = document.querySelector('.pays-item[data-pays="BE"]')
                     || document.querySelector('#paysDemande .pays-item');
              if (b) b.click();
            }''')
            page.wait_for_timeout(400)
            return True
    except Exception:
        pass
    return False


def feuille_visible(page):
    return page.evaluate(
        "() => { const f = document.querySelector('#feuille');"
        " return !!f && !f.hidden && f.getBoundingClientRect().height > 50; }")


def ouvrir(page, onglet=None):
    """Ouvre la feuille Réglages et attend qu'elle soit réellement visible."""
    for _ in range(3):
        if feuille_visible(page):
            break
        clic(page, '#reglages', 250)
    if onglet:
        clic(page, f'.onglet[data-onglet="{onglet}"]', 150)
    return feuille_visible(page)


def collecter(page):
    try:
        vues = page.evaluate('() => JSON.parse(JSON.stringify(globalThis.__vues || {}))')
    except Exception:
        return
    for lang, cles in vues.items():
        d = TOTAL.setdefault(lang, {})
        for k in cles:
            d[k] = 1


def onglets(page):
    if not ouvrir(page):
        dire('  !! feuille Réglages jamais visible')
        return
    for ong in ['langue', 'affichage', 'infos', 'compte']:
        clic(page, f'.onglet[data-onglet="{ong}"]', 120)
        # Les vignettes de thème et les boutons de pays portent des libellés.
        page.evaluate('''() => {
          for (const b of document.querySelectorAll('#regPays button, #regAffichage button')) b.click();
        }''')
    page.evaluate('''() => {
      for (const b of document.querySelectorAll('#themes .theme')) b.click();
    }''')
    page.wait_for_timeout(150)
    clic(page, '#fermer')


def barre(page):
    page.evaluate('''() => {
      for (const b of document.querySelectorAll('#puces button')) b.click();
      for (const b of document.querySelectorAll('.vue[data-vue]')) b.click();
      const p = document.querySelector('#plus button'); if (p) p.click();
    }''')
    for val in ['tout', 'recent', 'prix', 'promos']:
        try:
            page.select_option('#tri', val, timeout=1000)
        except Exception:
            pass
    for sel in ['#eco', '#fav', '#eco', '#fav']:
        clic(page, sel)
    try:
        page.fill('#recherche', 'zzzzqqqq')
        page.wait_for_timeout(250)
        page.fill('#recherche', '')
        page.wait_for_timeout(250)
    except Exception:
        pass


def yeux(page):
    page.evaluate("() => { for (const b of document.querySelectorAll('.oeil')) { b.click(); b.click(); } }")


def main():
    with sync_playwright() as p:
        nav = p.chromium.launch()
        ctx = nav.new_context(viewport={'width': 1180, 'height': 900}, locale='fr-FR')
        ctx.add_init_script("try{localStorage.clear()}catch(e){}")
        page = ctx.new_page()
        page.set_default_timeout(2500)
        brancher_fuite(page)
        page.goto(BASE + '/index.html', wait_until='load')
        page.wait_for_timeout(1500)
        dire(f'page chargée — langue d’amorçage : '
             f'{page.evaluate("() => document.documentElement.lang")}')
        collecter(page)                      # la modale du premier lancement
        dire(f'  modale du premier lancement écartée : {ecarter_pays(page)}')
        page.wait_for_timeout(500)

        # --- Phase A : visiteur non inscrit --------------------------------
        barre(page)
        onglets(page)
        yeux(page)
        collecter(page)
        dire(f'  Phase A : {len(TOTAL.get("fr", {}))} clés lues (fr)')

        # Confirmation sur d'autres langues, par les boutons réels.
        for code in ['de', 'nl', 'sv', 'pl']:
            if not ouvrir(page, 'langue'):
                continue
            clic(page, f'.langue[data-langue="{code}"]', 250)
            clic(page, '#fermer')
            barre(page)
            onglets(page)
            yeux(page)
            collecter(page)
            dire(f'  après bascule {code} : {len(TOTAL.get(code, {}))} clés lues ({code})')

        # --- Phase B : compte créé → fiche « connecté » ---------------------
        if ouvrir(page, 'compte'):
            try:
                page.fill('#cMail', 'sonde@exemple.be')
                page.fill('#cMdp', 'Motdepasse123')
                page.fill('#cMdp2', 'Motdepasse123')
                page.check('#cConsent')
                page.evaluate("() => document.querySelector('#creerCompte').click()")
                page.wait_for_timeout(2000)
                dire(f'  création de compte : annonce = '
                     f'{page.evaluate("() => (document.querySelector(\'#cAnnonce\')||{}).textContent")!r}')
            except Exception as e:
                dire(f'  !! création : {type(e).__name__}')
            collecter(page)
            yeux(page)
            page.evaluate('''() => {
              for (const s of ['#changerMdp','#exporterDonnees']) {
                const e = document.querySelector(s); if (e) e.click();
              }
            }''')
            page.wait_for_timeout(500)
            collecter(page)
            clic(page, '#fermer')

        # --- Phase C : écran de verrouillage --------------------------------
        if ouvrir(page, 'compte') and clic(page, '#verrouiller', 500):
            collecter(page)
            yeux(page)
            clic(page, '#verrouOublie', 300)
            collecter(page)
            dire('  écran de verrouillage exercé')
        page.screenshot(path='/tmp/kaz2/verrou-sonde.png')
        ctx.close()

        # --- Phase D : serveur injoignable → instantané embarqué ------------
        ctx2 = nav.new_context(viewport={'width': 1180, 'height': 900}, locale='fr-FR')
        ctx2.add_init_script("try{localStorage.clear()}catch(e){}")
        page2 = ctx2.new_page()
        page2.set_default_timeout(2500)
        brancher_fuite(page2)
        page2.route('**/offres.json', lambda r: r.abort())
        page2.goto(BASE + '/index.html', wait_until='load')
        page2.wait_for_timeout(2000)
        ecarter_pays(page2)
        barre(page2)
        onglets(page2)
        collecter(page2)
        page2.screenshot(path='/tmp/kaz2/hors-ligne-sonde.png')
        dire('  état hors-ligne exercé')
        ctx2.close()
        nav.close()

    with open('/tmp/t9n-vues.json', 'w') as f:
        json.dump(TOTAL, f, ensure_ascii=False, indent=1)
    toutes = set()
    for cles in TOTAL.values():
        toutes |= set(cles)
    dire('')
    for lang in sorted(TOTAL):
        dire(f'  {lang} : {len(TOTAL[lang])} clés lues')
    dire(f'union : {len(toutes)} clés atteintes au moins une fois')


if __name__ == '__main__':
    main()
