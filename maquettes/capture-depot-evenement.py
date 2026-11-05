import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/evenement-depot.html"
OUT = "/opt/data/webdev/projects/promos/maquettes/"

MESURE = """() => {
  const out = [];
  document.querySelectorAll('.field,.chip,.dl,.itin,.pl,.note,.warn,.check,.seg div,.dates').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      out.push({c: el.className || el.tagName, t: el.textContent.trim().slice(0,30),
                sw: el.scrollWidth, cw: el.clientWidth});
  });
  const hors = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > 1440.5 || r.left < -0.5;
  }).map(el => (el.className||el.tagName) + ' r=' + Math.round(el.getBoundingClientRect().right));
  return {largeur: document.documentElement.scrollWidth, hauteur: document.documentElement.scrollHeight,
          coupes: out, hors_cadre: hors.slice(0,8),
          etapes: [...document.querySelectorAll('.st .tt')].map(e => e.textContent.trim()),
          totaux: [...document.querySelectorAll('.pl')].map(e => e.textContent.replace(/\\s+/g,' ').trim())};
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=2, locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("requestfailed", lambda r: errs.append("requestfailed " + r.url))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(250)
        m = await pg.evaluate(MESURE)
        print(json.dumps(m, indent=1, ensure_ascii=False))
        await pg.screenshot(path=OUT + "evenement-depot.png", full_page=True)
        print("erreurs:", errs or "aucune")
        await b.close()

asyncio.run(main())
