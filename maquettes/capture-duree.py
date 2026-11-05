import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1180, "height": 800}, device_scale_factor=2, locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///opt/data/webdev/projects/promos/maquettes/immo-duree.html", wait_until="networkidle")
        await pg.wait_for_timeout(300)
        m = await pg.evaluate("""() => {
          const bad = [];
          document.querySelectorAll('.opt, .ext, .note, .total, .who .nm, .who .ds').forEach(el => {
            if (el.scrollWidth > el.clientWidth + 1) bad.push(el.className + ': ' + el.textContent.trim().slice(0, 40));
          });
          return {coupes: bad, hauteur: document.documentElement.scrollHeight,
                  largeur: document.documentElement.scrollWidth,
                  prix_vus: [...document.querySelectorAll('.opt .p')].map(e => e.textContent.trim())};
        }""")
        print(json.dumps(m, ensure_ascii=False))
        h = m["hauteur"]
        fond = await pg.evaluate("""() => {
          const els = [...document.querySelectorAll('body *')];
          return Math.ceil(Math.max(...els.map(e => e.getBoundingClientRect().bottom))) + 26;
        }""")
        print("hauteur utile:", fond)
        await pg.screenshot(path="/opt/data/webdev/projects/promos/maquettes/immo-duree.png",
                            clip={"x": 0, "y": 0, "width": 1180, "height": fond}, full_page=True)
        print("erreurs:", errs or "aucune")
        await b.close()

asyncio.run(main())
