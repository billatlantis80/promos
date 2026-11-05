import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/rencontre.html"
OUT = "/opt/data/webdev/projects/promos/maquettes/"
NOMS = ["rencontre-decouverte.png", "rencontre-profil.png",
        "rencontre-messages.png", "rencontre-securite.png"]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2,
                              locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(300)
        m = await pg.evaluate("""() => {
          const out = [];
          document.querySelectorAll('.card,.cinfo,.cname,.cmeta,.ctags span,.note,.warn,.sec,.txt,.specs div,.chat,.chband,.msg .body,.compose,.privacy,.panel,.variant,.convbox,.conv,.thread,.bub,.c2,.nofile,.card2,.step,.never li,.helpbox p,.foot,.sechero h1,.sechero p')
            .forEach(el => { if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
              out.push((el.className||el.tagName) + ': ' + el.textContent.trim().slice(0,30)); });
          const hors = [...document.querySelectorAll('body *')].filter(el => {
            const r = el.getBoundingClientRect(); return r.right > 1440.5 || r.left < -0.5;
          }).map(el => (el.className||el.tagName) + ' r=' + Math.round(el.getBoundingClientRect().right));
          return {largeur: document.documentElement.scrollWidth, hauteur: document.documentElement.scrollHeight,
                  coupes: out, hors_cadre: hors.slice(0,6),
                  bouton_partage: document.querySelectorAll('.part, .wa').length};
        }""")
        print(json.dumps(m, indent=1, ensure_ascii=False))
        caps = await pg.eval_on_selector_all(".cap", "e => e.map(x => x.getBoundingClientRect().top + scrollY)")
        h = m["hauteur"]
        bornes = caps + [h]
        for i, nom in enumerate(NOMS):
            if i >= len(caps):
                break
            await pg.screenshot(path=OUT + nom,
                                clip={"x": 0, "y": bornes[i], "width": 1440,
                                      "height": bornes[i + 1] - bornes[i]},
                                full_page=True)
            print("capture", nom, bornes[i], bornes[i + 1] - bornes[i])
        print("erreurs:", errs or "aucune")
        await b.close()

asyncio.run(main())
