"""Vérifie le message dans TOUTES les langues — les plus longues d'abord.

Une chaîne allemande ou polonaise est plus longue qu'une française : un bouton
qui déborde, une phrase qui se coupe mal, et le message part abîmé sans que rien
ne le signale. On rend donc les neuf, et l'on mesure.
"""
import subprocess
import os
from playwright.sync_api import sync_playwright

LANGUES = ['fr', 'nl', 'de', 'en', 'es', 'it', 'pt', 'pl', 'sv']
PROJET = '/opt/data/webdev/projects/promos'

with sync_playwright() as p:
    nav = p.chromium.launch()
    for langue in LANGUES:
        html = subprocess.run(
            ['node', os.path.join(PROJET, 'outils', 'apercu-mail.mjs'), langue],
            capture_output=True, text=True, cwd=PROJET, check=True).stdout
        source = f'/tmp/apercu-{langue}.html'
        with open(source, 'w') as f:
            f.write(html)
        page = nav.new_page(viewport={'width': 393, 'height': 900}, device_scale_factor=2)
        page.goto('file://' + source)
        page.wait_for_timeout(200)
        # Ce qui compte : RIEN ne doit dépasser la largeur du cadre.
        debordement = page.evaluate(
            "() => { const b = document.body; return b.scrollWidth - b.clientWidth; }")
        bouton = page.evaluate(
            "() => { const a = [...document.querySelectorAll('a')]"
            ".find((x) => x.style.borderRadius); return a ? Math.round(a.getBoundingClientRect().width) : 0; }")
        page.screenshot(path=f'/tmp/apercu-{langue}.png', full_page=True)
        print(f'{langue} : débordement {debordement} px, bouton {bouton} px de large')
        page.close()
    nav.close()
