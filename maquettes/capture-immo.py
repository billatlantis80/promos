import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/immo.html"
OUT = "/opt/data/webdev/projects/promos/maquettes/"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2, locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("requestfailed", lambda r: errs.append("requestfailed " + r.url))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(350)
        m = await pg.evaluate("""() => {
          const cx = (el) => { const r = el.getBoundingClientRect(); return +(r.left + r.width / 2).toFixed(2); };
          const cur = document.querySelector('.ruler .cursor');
          const cLab = [...document.querySelectorAll('.rlab > *')].find(e => e.tagName === 'B');
          const cells = [...document.querySelectorAll('.pfl')];
          const track = document.querySelector('.track');
          const knob = document.querySelector('.track .knob');
          const tr = track.getBoundingClientRect();
          const kx = cx(knob) - tr.left;
          const out = [];
          document.querySelectorAll('.pfl, .pbtile, .rlab, .specs > div, .cat').forEach(el => {
            if (el.scrollWidth > el.clientWidth + 1)
              out.push(el.className + ': ' + el.textContent.trim().slice(0, 22));
          });
          return {
            curseur_x: cx(cur), label_C_x: cLab ? cx(cLab) : null,
            ecart_px: cLab ? +(cx(cur) - cx(cLab)).toFixed(2) : null,
            pfl_coupes: cells.filter(c => c.scrollWidth > c.clientWidth + 1).map(c => c.textContent),
            pfl_actives: cells.filter(c => c.classList.contains('on')).map(c => c.textContent),
            knob_sur_latte_pct: +(100 * kx / tr.width).toFixed(1),
            coupes: out, hauteur: document.documentElement.scrollHeight,
            largeur_doc: document.documentElement.scrollWidth
          };
        }""")
        print(json.dumps(m, indent=1, ensure_ascii=False))
        h = m["hauteur"]
        caps = await pg.eval_on_selector_all(".cap", "e => e.map(x => x.getBoundingClientRect().top + scrollY)")
        await pg.screenshot(path=OUT + "immo-liste.png", clip={"x": 0, "y": 0, "width": 1440, "height": caps[1]},
                            full_page=True)
        await pg.screenshot(path=OUT + "immo-bien.png",
                            clip={"x": 0, "y": caps[1], "width": 1440, "height": h - caps[1]}, full_page=True)
        await pg.locator(".pebblk").screenshot(path=OUT + "immo-peb.png")
        await pg.locator("aside").first.screenshot(path=OUT + "immo-filtres.png")
        print("erreurs:", errs or "aucune")
        await b.close()

asyncio.run(main())
