import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/rencontre-mobile.html"
OUT = "/opt/data/webdev/projects/promos/maquettes/rencontre-mobile-390.png"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1720, "height": 1000}, device_scale_factor=2,
                              locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(350)
        m = await pg.evaluate("""() => {
          const res = [];
          document.querySelectorAll('.phone').forEach((ph, i) => {
            const sc = ph.querySelector('.scroll');
            const coupe = sc ? Math.max(0, sc.scrollHeight - sc.clientHeight) : 0;
            const horiz = [...ph.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1)
                            .map(e => (e.className || e.tagName) + ':' + e.textContent.trim().slice(0, 22));
            res.push({ecran: i + 1, contenu_coupe_px: coupe, debordements: horiz.slice(0, 4),
                      barre_collante: !!ph.querySelector('.sticky')});
          });
          return {ecrans: res, largeur: document.documentElement.scrollWidth,
                  hauteur: document.documentElement.scrollHeight,
                  bouton_partage: document.querySelectorAll('.part, .wa').length};
        }""")
        print(json.dumps(m, indent=1, ensure_ascii=False))
        await pg.screenshot(path=OUT, clip={"x": 0, "y": 0, "width": 1720, "height": m["hauteur"]},
                            full_page=True)
        print("erreurs JS:", errs or "aucune")
        await b.close()

asyncio.run(main())
