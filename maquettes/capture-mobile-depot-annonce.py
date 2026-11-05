import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/depot-annonce-mobile.html"
OUT = "/opt/data/webdev/projects/promos/maquettes/depot-annonce-390.png"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1720, "height": 1000}, device_scale_factor=2,
                              locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(300)
        m = await pg.evaluate("""() => {
          const res = [];
          document.querySelectorAll('.phone').forEach((ph, i) => {
            const sc = ph.querySelector('.scroll');
            res.push({ecran: i + 1,
                      contenu_coupe_px: sc ? Math.max(0, sc.scrollHeight - sc.clientHeight) : null,
                      debordements: [...ph.querySelectorAll('*')]
                        .filter(e => e.scrollWidth > e.clientWidth + 1).length});
          });
          return {ecrans: res, largeur: document.documentElement.scrollWidth,
                  hauteur: document.documentElement.scrollHeight};
        }""")
        print(json.dumps(m, ensure_ascii=False))
        await pg.screenshot(path=OUT, clip={"x": 0, "y": 0, "width": 1720, "height": m["hauteur"]},
                            full_page=True)
        print("erreurs:", errs or "aucune")
        await b.close()

asyncio.run(main())
