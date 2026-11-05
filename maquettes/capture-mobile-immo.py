import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # largeur du plateau : 3 x 390 + 2 gouttières de 26 + marges
        pg = await b.new_page(viewport={"width": 1290, "height": 980}, device_scale_factor=2, locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///opt/data/webdev/projects/promos/maquettes/immo-mobile.html", wait_until="networkidle")
        await pg.wait_for_timeout(400)
        m = await pg.evaluate("""() => {
          // débordement VERTICAL dans chaque téléphone (contenu coupé) et horizontal
          const res = [];
          document.querySelectorAll('.phone').forEach((ph, i) => {
            const body = ph.querySelector('.body');
            const coupé = body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0;
            const horiz = [...ph.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1)
                             .map(e => (e.className || e.tagName) + ':' + e.textContent.trim().slice(0, 24));
            res.push({ecran: i + 1, contenu_coupe_px: coupé, debordements_horizontaux: horiz.slice(0, 4)});
          });
          return {ecrans: res, largeur: document.documentElement.scrollWidth,
                  hauteur: document.documentElement.scrollHeight};
        }""")
        print(json.dumps(m, indent=1, ensure_ascii=False))
        await pg.screenshot(path="/opt/data/webdev/projects/promos/maquettes/immo-mobile-390.png",
                            clip={"x": 0, "y": 0, "width": 1290, "height": m["hauteur"]}, full_page=True)
        print("erreurs JS:", errs or "aucune")
        await b.close()

asyncio.run(main())
