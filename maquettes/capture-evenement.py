import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/evenement.html"
OUT = "/opt/data/webdev/projects/promos/maquettes/"

MESURE = """() => {
  const out = [];
  const sels = ['.evt','.evmeta','.tag','.evorg','.specs div','.side','.poster',
                '.switch div','.cat','.chip','.loc-txt','.cancelled','.main','.orgname',
                '.yyentry','.yypp','.yycard','.yyhead','.yyform .fld','.yyform .ychk',
                '.ymb','.yymeta div','.yyrules','.yyband',
                '.sgmodal','.sgopt','.sgtxt','.sgfoot',
                '.mevrow','.mevtit','.mevsub','.mevcnt','.mevact','.mevtab','.sortrow','.badge'];
  document.querySelectorAll(sels.join(',')).forEach(el => {
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
      out.push({sel: el.className || el.tagName, txt: el.textContent.trim().slice(0,34),
                sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight});
    }
  });
  const debordHors = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > 1440.5 || r.left < -0.5;
  }).map(el => (el.className || el.tagName) + ' r=' + Math.round(el.getBoundingClientRect().right));
  return {
    largeur_doc: document.documentElement.scrollWidth,
    hauteur_doc: document.documentElement.scrollHeight,
    coupes: out,
    hors_cadre: debordHors.slice(0, 8),
    evenements_liste: document.querySelectorAll('.ev').length,
    jours: [...document.querySelectorAll('.day .d')].map(e => e.textContent.trim()),
    prix_affiches: [...document.querySelectorAll('.tag.paid,.tag.free')].map(e => e.textContent.trim()),
    // cohérence : la pastille SAM 25 doit être à la même hauteur que la 1re carte du jour
    decalage_jour1: (() => {
      const d = document.querySelector('.day').getBoundingClientRect();
      const e = document.querySelector('.ev').getBoundingClientRect();
      return +(e.top - d.top).toFixed(1);
    })(),
    bouton_partage_dans_sortie: document.querySelectorAll('.yywrap .part, .yywrap .wa').length
  };
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2,
                              locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("requestfailed", lambda r: errs.append("requestfailed " + r.url))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(300)
        m = await pg.evaluate(MESURE)
        print(json.dumps(m, indent=1, ensure_ascii=False))

        h = m["hauteur_doc"]
        caps = await pg.eval_on_selector_all(".cap", "e => e.map(x => x.getBoundingClientRect().top + scrollY)")
        noms = ["evenement-liste.png", "evenement-fiche.png", "evenement-sortie.png",
                "evenement-signaler.png", "evenement-mes-evenements.png"]
        bornes = caps + [h]
        for i, nom in enumerate(noms):
            if i >= len(caps):
                break
            await pg.screenshot(path=OUT + nom,
                                clip={"x": 0, "y": bornes[i], "width": 1440,
                                      "height": bornes[i + 1] - bornes[i]}, full_page=True)
            print("capture", nom, round(bornes[i + 1] - bornes[i]))
        await pg.locator(".day").first.screenshot(path=OUT + "evenement-jour.png")
        await pg.locator(".cancelled").screenshot(path=OUT + "evenement-annule.png")
        print("captures:", caps, "hauteur", h)
        print("erreurs:", errs or "aucune")
        await b.close()

asyncio.run(main())
