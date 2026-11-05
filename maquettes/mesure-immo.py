import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.goto("file:///opt/data/webdev/projects/promos/maquettes/immo.html", wait_until="networkidle")
        r = await pg.evaluate("""() => [...document.querySelectorAll('.card')].map((c, i) => {
            const ph = c.querySelector('.ph').getBoundingClientRect();
            const pr = c.querySelector('.price').getBoundingClientRect();
            const tt = c.querySelector('.tt').getBoundingClientRect();
            return {i, card_top: +c.getBoundingClientRect().top.toFixed(1),
                    ph_h: +ph.height.toFixed(1), price_top: +pr.top.toFixed(1),
                    price_h: +pr.height.toFixed(1), tt_h: +tt.height.toFixed(1),
                    titre: c.querySelector('.tt').textContent.trim().slice(0, 28)};
        })""")
        print(json.dumps(r, indent=1, ensure_ascii=False))
        await b.close()

asyncio.run(main())
