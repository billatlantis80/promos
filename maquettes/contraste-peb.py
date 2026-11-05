import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.goto("file:///opt/data/webdev/projects/promos/maquettes/immo.html", wait_until="networkidle")
        r = await pg.evaluate("""() => {
          const parse = (s) => s.match(/\\d+/g).slice(0,3).map(Number);
          const lum = (c) => { const f = c.map(v => { v/=255;
            return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
            return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2]; };
          return [...document.querySelectorAll('.pfl')].map(el => {
            const cs = getComputedStyle(el);
            const fg = lum(parse(cs.color)), bg = lum(parse(cs.backgroundColor));
            const ratio = (Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);
            return {lettre: el.textContent, allumee: el.classList.contains('on'),
                    contraste: +ratio.toFixed(2)};
          });
        }""")
        for x in r:
            etat = "on " if x["allumee"] else "off"
            print(f"{x['lettre']:>4} {etat} contraste {x['contraste']:5.2f}")
        await b.close()

asyncio.run(main())
