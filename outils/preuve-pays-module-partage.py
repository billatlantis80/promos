#!/usr/bin/env python3
"""Preuve : la question d'ouverture et les Réglages affichent LE MÊME module de pays.

Demande de B (08/10/2026) : « lors de l'introduction de l'application tu demandes
le pays […] il faut proposer le même module qui est dans les paramètres
d'utilisateur avec les drapeaux, sur deux colonnes. »

Cette sonde ne vérifie pas « la modale a des drapeaux » (ce serait compatible avec
deux dessins qui divergent demain) : elle compare les DEUX LISTES RENDUES, balise
pour balise, en neutralisant les seules différences voulues — « on » pour le pays
retenu dans les Réglages, « conseille » pour le pays deviné à l'ouverture.
"""
import re
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:3212'
echecs = []


def dire(*a):
    print(*a, flush=True)


def neutraliser(html):
    """Efface ce qui DOIT différer entre les deux écrans."""
    html = re.sub(r'\s(?:on|conseille)(?=[ "\'])', '', html)
    html = re.sub(r'aria-pressed="(?:true|false)"', 'aria-pressed=""', html)
    return re.sub(r'\s+', ' ', html).strip()


with sync_playwright() as p:
    nav = p.chromium.launch()

    # --- 1. Premier lancement : la question d'ouverture -----------------------
    ctx = nav.new_context(viewport={'width': 393, 'height': 830}, locale='fr-BE',
                          is_mobile=True, has_touch=True)
    ctx.add_init_script("try{localStorage.clear()}catch(e){}")
    page = ctx.new_page()
    page.set_default_timeout(5000)
    page.goto(BASE + '/index.html', wait_until='load')
    page.wait_for_selector('#paysDemande:not([hidden]) .pays-liste', timeout=30000)
    page.wait_for_timeout(400)

    modale = page.evaluate("""() => {
      const liste = document.querySelector('#paysListe .pays-liste');
      const items = [...liste.querySelectorAll('.pays-item')];
      const cols = getComputedStyle(liste).gridTemplateColumns.split(' ').length;
      return {
        html: liste.outerHTML,
        classes: liste.className,
        colonnes: cols,
        nb: items.length,
        // Un drapeau VRAIMENT dessiné : le SVG doit contenir de la géométrie.
        avecDrapeau: items.filter((b) => {
          const svg = b.querySelector('svg');
          return svg && svg.innerHTML.trim().length > 20;
        }).length,
        sansDrapeau: items.filter((b) => {
          const svg = b.querySelector('svg');
          return !svg || svg.innerHTML.trim().length <= 20;
        }).map((b) => (b.dataset.pays || '?')),
        exemple: (items[3] || {}).textContent,
      };
    }""")
    dire(f'--- question d’ouverture ---')
    dire(f'  classes      : {modale["classes"]}')
    dire(f'  pays listés  : {modale["nb"]}')
    dire(f'  colonnes     : {modale["colonnes"]}')
    dire(f'  avec drapeau : {modale["avecDrapeau"]}/{modale["nb"]}')
    dire(f'  exemple      : {modale["exemple"]!r}')
    if modale['colonnes'] != 2:
        echecs.append(f'la question d’ouverture n’est pas sur deux colonnes ({modale["colonnes"]})')
    if modale['avecDrapeau'] != modale['nb']:
        echecs.append(f'pays sans drapeau à l’ouverture : {modale["sansDrapeau"]}')
    page.screenshot(path='/tmp/kaz2/pays-ouverture.png')

    # --- 2. Réglages : la même liste -----------------------------------------
    page.evaluate("""() => {
      const b = document.querySelector('.pays-item[data-pays="BE"]')
             || document.querySelector('#paysListe .pays-item');
      if (b) b.click();
    }""")
    page.wait_for_timeout(700)
    page.click('#reglages')
    page.wait_for_timeout(300)
    page.click('.onglet[data-onglet="affichage"]')
    page.wait_for_timeout(400)
    reglages = page.evaluate("""() => {
      const liste = document.querySelector('#regPays .pays-liste');
      const items = [...liste.querySelectorAll('.pays-item')];
      return {
        html: liste.outerHTML,
        classes: liste.className,
        colonnes: getComputedStyle(liste).gridTemplateColumns.split(' ').length,
        nb: items.length,
        avecDrapeau: items.filter((b) => {
          const svg = b.querySelector('svg');
          return svg && svg.innerHTML.trim().length > 20;
        }).length,
        actif: (liste.querySelector('.pays-item.on') || {}).dataset?.pays || null,
      };
    }""")
    dire(f'\n--- onglet Réglages › Pays ---')
    dire(f'  classes      : {reglages["classes"]}')
    dire(f'  pays listés  : {reglages["nb"]}')
    dire(f'  colonnes     : {reglages["colonnes"]}')
    dire(f'  avec drapeau : {reglages["avecDrapeau"]}/{reglages["nb"]}')
    dire(f'  pays actif   : {reglages["actif"]}')
    if reglages['colonnes'] != 2:
        echecs.append(f'les Réglages ne sont pas sur deux colonnes ({reglages["colonnes"]})')
    if reglages['actif'] != 'BE':
        echecs.append(f'le pays choisi (BE) n’est pas marqué actif dans les Réglages : {reglages["actif"]}')
    page.screenshot(path='/tmp/kaz2/pays-reglages.png')

    # --- 3. Les deux listes sont-elles le MÊME dessin ? ----------------------
    a, b = neutraliser(modale['html']), neutraliser(reglages['html'])
    dire(f'\n--- comparaison des deux rendus (classes neutres) ---')
    dire(f'  longueurs : ouverture {len(a)} / réglages {len(b)}')
    if a != b:
        echecs.append('les deux listes de pays ne sont PAS identiques')
        # Montrer le premier endroit qui diffère.
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                dire(f'  première différence au caractère {i} :')
                dire(f'    ouverture : …{a[max(0, i - 60):i + 60]}…')
                dire(f'    réglages  : …{b[max(0, i - 60):i + 60]}…')
                break
    else:
        dire('  ✓ identiques, balise pour balise')

    ctx.close()
    nav.close()

dire('')
if echecs:
    dire(f'ÉCHECS ({len(echecs)}) :')
    for e in echecs:
        dire(f'  - {e}')
    sys.exit(1)
dire('LES DEUX ÉCRANS AFFICHENT LE MÊME MODULE DE PAYS')
