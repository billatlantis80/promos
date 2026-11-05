import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=2, locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///opt/data/webdev/projects/promos/maquettes/immo-depot.html", wait_until="networkidle")
        await pg.wait_for_timeout(300)
        m = await pg.evaluate("""() => {
          const bad = [];
          document.querySelectorAll('.chip,.opt,.total,.rec div,.pebf .field,.check,.foot,.note').forEach(el => {
            if (el.scrollWidth > el.clientWidth + 1)
              bad.push((el.className || el.tagName) + ' :: ' + el.textContent.trim().slice(0, 45));
          });
          const fond = Math.ceil(Math.max(...[...document.querySelectorAll('body *')]
                        .map(e => e.getBoundingClientRect().bottom))) + 24;
          return {coupes: bad, fond, largeur: document.documentElement.scrollWidth,
                  prix: [...document.querySelectorAll('.opt .p')].map(e => e.textContent.trim())};
        }""")
        print(json.dumps(m, ensure_ascii=False))
        await pg.screenshot(path="/opt/data/webdev/projects/promos/maquettes/immo-depot.png",
                            clip={"x": 0, "y": 0, "width": 1440, "height": m["fond"]}, full_page=True)
        print("erreurs:", errs or "aucune")
        await b.close()

asyncio.run(main())
