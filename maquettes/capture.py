import asyncio, sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "file:///tmp/ka/accueil.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/ka/accueil-kazendra.png"

async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--force-color-profile=srgb", "--font-render-hinting=none"])
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        pg.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url}"))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(600)
        h = await pg.evaluate("document.documentElement.scrollHeight")
        over = await pg.evaluate("""() => {
            const bad=[]; const vw=document.documentElement.clientWidth;
            document.querySelectorAll('*').forEach(el=>{
                const r=el.getBoundingClientRect();
                if(r.right>vw+1||r.left<-1) bad.push(el.tagName+'.'+el.className+' -> '+Math.round(r.left)+'..'+Math.round(r.right));
            });
            return bad.slice(0,10);
        }""")
        # texte qui déborde de son conteneur
        clip = await pg.evaluate("""() => {
            const bad=[];
            document.querySelectorAll('.ti,.me,h1,.pr,.nm').forEach(el=>{
                if(el.scrollWidth > el.clientWidth+1) bad.push(el.className+': '+el.textContent.slice(0,40));
            });
            return bad.slice(0,10);
        }""")
        await pg.screenshot(path=OUT, full_page=True)
        print(f"hauteur={h} debordements={over} texte_coupe={clip}")
        print("erreurs:", errors if errors else "aucune")
        await b.close()

asyncio.run(main())
