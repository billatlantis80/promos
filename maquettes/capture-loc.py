import asyncio, sys
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/annonce.html"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2, locale="fr-FR")
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(400)
        # boîte du bloc localisation + la note, avec le bloc "specs" juste au-dessus
        box = await pg.evaluate("""() => {
          const loc = document.querySelector('.loc');
          const note = document.querySelector('.loc-note');
          const specs = document.querySelector('.specs');
          const a = specs.getBoundingClientRect(), l = loc.getBoundingClientRect(),
                n = note.getBoundingClientRect();
          return {x: a.left - 14, y: a.top - 12,
                  width: Math.max(l.right, n.right) - a.left + 28,
                  height: n.bottom - a.top + 24};
        }""")
        print("clip:", box)
        await pg.screenshot(path="/opt/data/webdev/projects/promos/maquettes/loc-detail.png", clip=box, full_page=True)
        # largeur réelle du bouton vs son texte (pas de repli de libellé)
        m = await pg.evaluate("""() => {
          const b = document.querySelector('.loc-btn');
          const s = document.createElement('span');
          s.textContent = b.textContent.trim();
          s.style.cssText = 'position:absolute;white-space:nowrap;visibility:hidden;font:'+getComputedStyle(b).font;
          document.body.appendChild(s);
          const t = s.getBoundingClientRect().width;
          const r = b.getBoundingClientRect();
          const ligne = parseFloat(getComputedStyle(b).fontSize) * 1.9;
          return {bouton_largeur: +r.width.toFixed(1), texte_largeur: +t.toFixed(1),
                  hauteur_bouton: +r.height.toFixed(1), une_ligne: r.height < ligne,
                  href: b.getAttribute('href')};
        }""")
        print(m)
        # le lien répond-il ? (on ne le suit pas ici, vérifié par curl)
        await b.close()

asyncio.run(main())
