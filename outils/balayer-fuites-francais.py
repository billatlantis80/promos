#!/usr/bin/env python3
"""Balayage des fuites de français dans l'interface d'une autre langue.

Le dictionnaire peut être complet et l'écran rester partiellement français :
c'est le cas quand un texte est écrit EN CLAIR dans un gabarit au lieu de
passer par t(). Exemple trouvé le 08/10/2026 : « (200000 tours) » dans la carte
du compte, à côté d'une phrase parfaitement allemande.

On affiche donc l'application en allemand, on relève le texte VISIBLE, et on
signale les lignes qui contiennent un mot français. Les cartes d'offres sont
exclues : leur TITRE vient du marchand et reste dans sa langue d'origine
(décision de B — on ne traduit que le vocabulaire courant de l'interface).
"""
import re
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:3212'
LANGUE = sys.argv[1] if len(sys.argv) > 1 else 'de'

# Marqueurs PROPRES au français. Premier essai raté : la liste contenait « du »
# et « des », qui sont aussi des mots allemands très courants (« du » = tu, et
# le génitif « des ») — douze faux positifs pour une seule vraie fuite. On garde
# donc deux familles sûres : les lettres accentuées que l'allemand n'utilise
# pas (é è ê à ç ô î û ï œ), et des mots qui n'existent qu'en français.
MARQUEURS = [
    r'[éèêàçôîûïœ]',
    r'\bles\b', r'\bune\b', r'\bvotre\b', r'\bvos\b', r'\bnos\b', r'\bnotre\b',
    r'\bavec\b', r'\bsans\b', r'\bpour\b', r'\bdans\b', r'\bchez\b',
    r'\bsont\b', r'\bencore\b', r'\bcette\b', r'\bchez\b', r'\brien\b',
    r'\btout\b', r'\btous\b', r'\btrop\b', r'\bbeaucoup\b',
    r'\bprix\b', r'\bjours\b', r'\btours\b', r'\bcompte\b', r'\bdonnées\b',
    r'\brecherche\b', r'\bmot de passe\b', r'\bthème', r'\bpay[es]\b',
    r'\bactivité\b', r'\baccueil\b', r'\bamélioré',
]
MOTIF = re.compile('|'.join(MARQUEURS), re.I)


with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={'width': 1240, 'height': 1000},
                          locale='de-DE')
    ctx.add_init_script("try{localStorage.clear()}catch(e){}")
    page = ctx.new_page()
    page.set_default_timeout(3000)
    page.goto(BASE + '/index.html', wait_until='load')
    page.wait_for_timeout(1600)
    page.evaluate("""() => {
      const b = document.querySelector('.pays-item[data-pays="BE"]') ||
                document.querySelector('#paysDemande .pays-item');
      if (b) b.click();
    }""")
    page.wait_for_timeout(600)

    # Passer dans la langue visée par le bouton réel.
    page.click('#reglages')
    page.wait_for_timeout(250)
    page.click('.onglet[data-onglet="langue"]')
    page.wait_for_timeout(150)
    page.click(f'.langue[data-langue="{LANGUE}"]')
    page.wait_for_timeout(400)
    print(f'langue : {page.evaluate("() => document.documentElement.lang")}')

    # Faire le tour des panneaux, en relevant à chaque fois le texte visible
    # HORS cartes d'offres (titres du marchand, laissés dans leur langue).
    zones = []
    def relever(nom):
        txt = page.evaluate("""() => {
          const copie = document.body.cloneNode(true);
          for (const s of copie.querySelectorAll('#liste, .carte, #bandeau')) s.remove();
          return (copie.innerText || '').split('\\n');
        }""")
        zones.append((nom, txt))

    page.click('.onglet[data-onglet="compte"]')
    page.wait_for_timeout(200)
    relever('Réglages › compte')

    # Créer un compte : la carte « connecté » a ses propres textes.
    page.fill('#cMail', 'sonde@exemple.be')
    page.fill('#cMdp', 'Motdepasse123')
    page.fill('#cMdp2', 'Motdepasse123')
    page.check('#cConsent')
    page.evaluate("() => document.querySelector('#creerCompte').click()")
    page.wait_for_timeout(1800)
    relever('Réglages › compte (connecté)')

    for ong in ['langue', 'affichage', 'infos']:
        page.click(f'.onglet[data-onglet="{ong}"]')
        page.wait_for_timeout(250)
        relever(f'Réglages › {ong}')
        if ong == 'affichage':
            page.evaluate("() => { for (const b of document.querySelectorAll('#themes .theme')) b.click(); }")
            page.wait_for_timeout(300)
            relever('Réglages › affichage (11 thèmes essayés)')

    page.click('#fermer')
    page.wait_for_timeout(200)
    relever('barre du haut et pied de page')

    print(f'\n=== lignes contenant un mot français ===')
    vues = set()
    fuites = 0
    for nom, lignes in zones:
        for l in lignes:
            l = l.strip()
            if not l or l in vues:
                continue
            if MOTIF.search(l):
                vues.add(l)
                fuites += 1
                print(f'  [{nom}] {l[:120]}')
    print(f'\n{fuites} ligne(s) à examiner')
    page.screenshot(path=f'/tmp/kaz2/fuites-{LANGUE}.png')
    print(f'screenshot : /tmp/kaz2/fuites-{LANGUE}.png')
    ctx.close()
    nav.close()
