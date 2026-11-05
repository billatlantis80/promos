#!/usr/bin/env python3
"""Planche « schema.org — ce que ça change »."""
from PIL import Image, ImageDraw, ImageFont

BLEU = (13, 59, 91)
ORANGE = (235, 145, 45)
FOND = (255, 255, 255)
TEXTE = (26, 32, 44)
GRIS = (110, 120, 135)
VERT = (32, 130, 84)
ROUGE = (178, 58, 46)
LIEN = (26, 90, 175)
LIGNE = (223, 228, 234)
BANDE = (244, 247, 250)

W = 1180
M = 46
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f_titre = ImageFont.truetype(FB, 30)
f_sous = ImageFont.truetype(F, 17)
f_h2 = ImageFont.truetype(FB, 22)
f_corps = ImageFont.truetype(F, 17)
f_petit = ImageFont.truetype(F, 15)
f_gras = ImageFont.truetype(FB, 17)
f_lien = ImageFont.truetype(F, 19)
f_lienb = ImageFont.truetype(FB, 21)

img = Image.new("RGB", (W, 4000), FOND)
d = ImageDraw.Draw(img)


def larg(t, fo):
    return d.textlength(t, font=fo)


def enroule(txt, fo, lmax):
    lignes, cur = [], ""
    for mot in txt.split():
        e = (cur + " " + mot).strip()
        if larg(e, fo) <= lmax:
            cur = e
        else:
            if cur:
                lignes.append(cur)
            cur = mot
    if cur:
        lignes.append(cur)
    return lignes


def bloc(y, h, fond=BANDE, bord=LIGNE):
    d.rectangle([M, y, W - M, y + h], fill=fond, outline=bord)


def sect(y, t):
    d.text((M + 22, y), t, font=f_h2, fill=BLEU)
    return y + 42


d.rectangle([0, 0, W, 118], fill=BLEU)
d.text((M, 26), "schema.org — ce que ça change, et ce que ça ne change pas", font=f_titre, fill=(255, 255, 255))
d.text((M, 74), "Réponses courtes : ça ne fait pas monter dans Google. Ça rend le résultat plus riche, donc plus cliqué.",
       font=f_sous, fill=(196, 214, 228))

y = 150

# 1. ce que ça ne fait pas
pts = [
    "Ça n'améliore PAS le classement : les données structurées ne sont pas un facteur de position.",
    "Google ne garantit rien : « Google doesn't guarantee rich results, even with proper markup. »",
    "Ça ne marche PAS sur la page d'accueil : Google n'accepte que les pages d'UN SEUL produit.",
]
h1 = 20 + 42 + len(pts) * 30 + 14
bloc(y, h1, fond=(252, 244, 243), bord=(238, 214, 210))
yy = sect(y + 18, "Ce que ça NE fait PAS")
for t in pts:
    d.text((M + 22, yy), "×", font=f_gras, fill=ROUGE)
    d.text((M + 48, yy), t, font=f_corps, fill=TEXTE)
    yy += 30
y += h1 + 34

# 2. avant / après
h2 = 20 + 42 + 190
bloc(y, h2)
yy = sect(y + 18, "Ce que ça FAIT : le même résultat, mais enrichi")
# gauche : lien nu
gx, gw = M + 22, 500
d.text((gx, yy), "AUJOURD'HUI — un lien nu", font=f_gras, fill=GRIS)
d.text((gx, yy + 32), "kazendra.com › o › 8f3a2c…", font=f_petit, fill=VERT)
d.text((gx, yy + 54), "Casque Bluetooth — 219,99 €", font=f_lienb, fill=LIEN)
for i, l in enumerate(enroule("Retrouvez cette offre chez le marchand, avec le prix, la remise et la disponibilité.",
                              f_petit, gw)):
    d.text((gx, yy + 84 + i * 20), l, font=f_petit, fill=GRIS)
# droite : enrichi
dx = M + 22 + 540
d.text((dx, yy), "AVEC LES DONNÉES STRUCTURÉES", font=f_gras, fill=VERT)
d.text((dx, yy + 32), "kazendra.com › o › 8f3a2c…", font=f_petit, fill=VERT)
d.text((dx, yy + 54), "Casque Bluetooth — 219,99 €", font=f_lienb, fill=LIEN)
for i, l in enumerate(enroule("Retrouvez cette offre chez le marchand, avec le prix, la remise et la disponibilité.",
                              f_petit, 500)):
    d.text((dx, yy + 84 + i * 20), l, font=f_petit, fill=GRIS)
d.text((dx, yy + 118), "★★★★☆ 219,99 € · En stock · Marchand", font=f_gras, fill=(190, 130, 20))
d.text((dx, yy + 142), "− 38 % — vu sur Kazendra", font=f_petit, fill=VERT)
d.text((gx, yy + 158), "(schéma — ce n'est pas une capture d'écran de Google)", font=f_petit, fill=GRIS)
y += h2 + 34

# 3. la règle, mot pour mot
h3 = 20 + 42 + 96
bloc(y, h3, fond=(252, 248, 238), bord=(238, 224, 196))
yy = sect(y + 18, "La règle de Google, mot pour mot (doc officielle)")
for i, l in enumerate(enroule("« Les résultats enrichis produit ne prennent en charge que les pages consacrées à "
                              "UN SEUL produit… Nous recommandons de baliser les pages produit plutôt que les "
                              "pages qui listent des produits ou une catégorie. »", f_corps, W - 2 * M - 44)):
    d.text((M + 22, yy + i * 24), l, font=f_corps, fill=TEXTE)
y += h3 + 34

# 4. portée chez nous
h4 = 20 + 42 + 100
bloc(y, h4)
yy = sect(y + 18, "Chez nous, ça tombe pile : nos pages d'offres SONT des pages d'un seul produit")
d.text((M + 22, yy),
       "15 912 pages o/<id>.html — une offre par page, un produit par page. C'est exactement le cas que Google",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "dit éligible. La page d'accueil, elle, liste des offres : exclue, et c'est normal.", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 54),
       "Coût : nul. Un bloc ajouté une fois au script qui génère les pages. Mesure de terrain : Dealabs, le leader",
       font=f_petit, fill=GRIS)
d.text((M + 22, yy + 74),
       "francophone des bons plans, ne balise sur son accueil que l'organisation — ni Product, ni Offer.", font=f_petit, fill=GRIS)
y += h4 + 40

pied = ("Sources relevées le 09/10/2026 : developers.google.com/search (doc « Product snippet » et « Structured data "
        "policies ») ; accueil dealabs.com (un bloc ld+json : Organization, WebSite, Person, PostalAddress — aucun "
        "Product ni Offer). Le gain est réel mais modeste, et gratuit : ce n'est pas un levier magique.")
lp = enroule(pied, f_petit, W - 2 * M - 36)
h5 = 20 + len(lp) * 22
d.rectangle([M, y, W - M, y + h5], fill=(238, 243, 248), outline=LIGNE)
yy = y + 12
for l in lp:
    d.text((M + 18, yy), l, font=f_petit, fill=GRIS)
    yy += 22

H = yy + 30
img = img.crop((0, 0, W, H))
img.save("/opt/data/webdev/projects/promos/identite/schema-org.png")
print("OK", img.size, "->", "/opt/data/webdev/projects/promos/identite/schema-org.png")
