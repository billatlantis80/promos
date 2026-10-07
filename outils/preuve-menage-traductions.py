#!/usr/bin/env python3
"""Preuve à l'écran des corrections de câblage (ménage du 08/10/2026).

Trois textes existaient dans les 9 dictionnaires sans que personne ne les
appelle : le code les écrivait en clair. On vérifie ici, en allemand, qu'ils
sont désormais traduits — et que la date du compte suit la langue (elle était
figée sur le format français).
"""
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:3212'
echecs = []


def dire(*a):
    print(*a, flush=True)


def verifier(nom, obtenu, attendu):
    ok = (attendu in obtenu) if isinstance(obtenu, str) else (obtenu == attendu)
    dire(f'  {"OK  " if ok else "RATÉ"} {nom}')
    dire(f'       obtenu : {obtenu!r}')
    if not ok:
        echecs.append(f'{nom} — attendu « {attendu} », obtenu « {obtenu} »')


with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={'width': 1180, 'height': 950}, locale='de-DE')
    ctx.add_init_script("try{localStorage.clear()}catch(e){}")
    page = ctx.new_page()
    page.set_default_timeout(3000)
    page.goto(BASE + '/index.html', wait_until='load')
    page.wait_for_timeout(1500)

    # Écarter la modale du premier lancement, comme un utilisateur.
    page.evaluate("""() => {
      const b = document.querySelector('.pays-item[data-pays="BE"]') ||
                document.querySelector('#paysDemande .pays-item');
      if (b) b.click();
    }""")
    page.wait_for_timeout(500)

    # Passer en allemand par le bouton réel.
    page.click('#reglages')
    page.wait_for_timeout(250)
    page.click('.onglet[data-onglet="langue"]')
    page.wait_for_timeout(150)
    page.click('.langue[data-langue="de"]')
    page.wait_for_timeout(350)
    dire(f'langue posée : {page.evaluate("() => document.documentElement.lang")}')

    # Créer un compte sur l'appareil.
    page.click('.onglet[data-onglet="compte"]')
    page.wait_for_timeout(250)
    page.fill('#cMail', 'sonde@exemple.be')
    page.fill('#cMdp', 'Motdepasse123')
    page.fill('#cMdp2', 'Motdepasse123')
    page.check('#cConsent')
    page.evaluate("() => document.querySelector('#creerCompte').click()")
    page.wait_for_timeout(2000)

    quand = page.evaluate("() => (document.querySelector('#regCompte .quand') || {}).textContent || ''")
    annonce = page.evaluate("() => (document.querySelector('#cAnnonce') || {}).textContent || ''")

    dire('\n--- la date du compte suit la LANGUE ---')
    verifier('ligne du compte en allemand', quand, 'lokales Konto erstellt am')
    verifier('date au format allemand, non français',
             quand, 'Oktober')          # « 8. Oktober 2026 » (de-DE)
    verifier('pas de mot français resté', 'créé le' not in quand, True)

    dire('\n--- le message d’inscription est traduit ---')
    verifier('annonce allemande', annonce, 'Tabelle')   # « Das Tabellenblatt… »

    # L'œil fonctionne toujours (non-régression).
    page.evaluate("() => { const b=document.querySelector('.oeil[data-oeil=\"cMdp\"]'); if(b) b.click(); }")
    type_champ = page.evaluate("() => (document.getElementById('cMdp') || {}).type || ''")
    verifier('l’œil montre le mot de passe', type_champ, 'text')

    page.screenshot(path='/tmp/kaz2/menage-de-compte.png', full_page=False)
    dire('\nscreenshot : /tmp/kaz2/menage-de-compte.png')
    ctx.close()
    nav.close()

dire('')
if echecs:
    dire(f'ÉCHECS ({len(echecs)}) :')
    for e in echecs:
        dire(f'  - {e}')
    sys.exit(1)
dire('TOUT VÉRIFIÉ')
