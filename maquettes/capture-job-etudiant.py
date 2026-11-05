import asyncio, json
from playwright.async_api import async_playwright

URL = "file:///opt/data/webdev/projects/promos/maquettes/job-etudiant.html"
OUT = "/opt/data/webdev/projects/promos/maquettes/"
NOMS = ["job-accueil.png", "job-parcours.png", "job-inscription.png",
        "job-agenda.png", "job-demande.png", "job-mission.png", "job-carnet.png",
        "job-offres.png", "job-offre.png", "job-depot-entreprise.png", "job-mes-offres.png"]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2,
                              locale="fr-FR")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(400)
        m = await pg.evaluate("""() => {
          const out = [];
          document.querySelectorAll('h1,h2,h3,h4,p,li,label,.lead,.who,.ct,.cs,.node,.mitem div,.honest,.cw,.sd,.st,.never li,.checklist > div,.ag div,.scard .txt,.hint,.after,.mprice,.mmeta,.mfoot,.foot,.count,.sub,.banner .bt,.banner .sep2,.crow2,.crow2 .bs b,.crow2 .dt,.tli div,.seeslot .h,.slotb .m,.slotb .n,.need .t,.qbig,.mline,.statusbtn,.doorhead .cnt,.codebox .cb,.jcard,.jcard h3,.jent,.jmeta,.jfoot,.jfoot .ech,.entrow,.ment,.alert,.arow,.arow .t b,.arow .t span,.arow .st,.arow .motif,.cat,.counter,.crumb')
            .forEach(el => {
              if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
                out.push((el.className || el.tagName) + ' :: ' + el.textContent.trim().slice(0, 42));
            });
          const hors = [...document.querySelectorAll('body *')].filter(el => {
            const r = el.getBoundingClientRect();
            return r.right > 1440.5 || r.left < -0.5;
          }).map(el => (el.className || el.tagName) + ' l=' + Math.round(el.getBoundingClientRect().left)
                 + ' r=' + Math.round(el.getBoundingClientRect().right));
          const drapeaux = [...document.querySelectorAll('.ctile img,.langopt img')].map(i => {
            const r = i.getBoundingClientRect();
            return {src: i.getAttribute('src').split('/').pop(), w: Math.round(r.width),
                    h: Math.round(r.height), charge: i.naturalWidth > 0};
          });
          return {largeur: document.documentElement.scrollWidth,
                  hauteur: document.documentElement.scrollHeight,
                  coupes: out, hors_cadre: hors.slice(0, 8),
                  drapeaux: drapeaux,
                  boutons_partage: document.querySelectorAll('.part, .wa').length,
                  cases_a_cocher: document.querySelectorAll('input[type=checkbox]').length};
        }""")
        print(json.dumps(m, indent=1, ensure_ascii=False))
        caps = await pg.eval_on_selector_all(
            ".cap", "e => e.map(x => x.getBoundingClientRect().top + scrollY)")
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
