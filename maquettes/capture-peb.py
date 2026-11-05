import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2, locale="fr-FR")
        await pg.goto("file:///opt/data/webdev/projects/promos/maquettes/immo.html", wait_until="networkidle")
        await pg.wait_for_timeout(300)
        await pg.locator(".pebblk").screenshot(path="/opt/data/webdev/projects/promos/maquettes/immo-peb.png")
        await pg.locator(".side").screenshot(path="/opt/data/webdev/projects/promos/maquettes/immo-colonne.png")
        print("ok")
        await b.close()

asyncio.run(main())
