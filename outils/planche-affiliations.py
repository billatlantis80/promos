#!/usr/bin/env python3
"""Planche « Affiliations — par où commencer »."""
from PIL import Image, ImageDraw, ImageFont

BLEU = (13, 59, 91)
ORANGE = (235, 145, 45)
FOND = (255, 255, 255)
TEXTE = (26, 32, 44)
GRIS = (110, 120, 135)
GRISF = (176, 184, 194)
VERT = (32, 130, 84)
ROUGE = (178, 58, 46)
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
f_grand = ImageFont.truetype(FB, 36)

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
d.text((M, 26), "Affiliations — par où commencer", font=f_titre, fill=(255, 255, 255))
d.text((M, 74), "Tout est mesuré sur le catalogue publié : 16 680 offres, triées par destination réelle du clic",
       font=f_sous, fill=(196, 214, 228))

y = 150

# ---------- 1. la répartition ----------
h1 = 20 + 42 + 40 + 78
bloc(y, h1, fond=(252, 244, 243), bord=(238, 214, 210))
yy = sect(y + 18, "1 · Où mène vraiment le clic — et donc où une commission est possible")
bx, bw, by, bh = M + 22, W - 2 * M - 44, yy + 6, 34
p_amz, p_aut, p_agg = 0.271, 0.046, 0.683
w1, w2 = int(bw * p_amz), int(bw * p_aut)
w3 = bw - w1 - w2
d.rectangle([bx, by, bx + w1, by + bh], fill=VERT)
d.rectangle([bx + w1, by, bx + w1 + w2, by + bh], fill=ORANGE)
d.rectangle([bx + w1 + w2, by, bx + bw, by + bh], fill=GRISF, outline=GRIS)
ly = by + bh + 12
for i, (coul, txt) in enumerate([
        (VERT, "27,1 % — Amazon : commission possible (4 528 offres)"),
        (ORANGE, "4,6 % — autres marchands à lien direct"),
        (GRISF, "68,3 % — le clic part vers un site de bons plans : AUCUNE commission possible")]):
    d.rectangle([bx, ly + i * 22 + 4, bx + 14, ly + i * 22 + 14], fill=coul, outline=GRIS)
    d.text((bx + 22, ly + i * 22), txt, font=f_petit,
           fill=ROUGE if i == 2 else TEXTE)
y += h1 + 34

# ---------- 2. donc Amazon ----------
h2 = 20 + 42 + 116
bloc(y, h2)
yy = sect(y + 18, "2 · Donc : Amazon Partenaires d'abord — et de très loin")
d.text((M + 22, yy), "4 528", font=f_grand, fill=VERT)
d.text((M + 22 + larg("4 528", f_grand) + 20, yy + 8), "offres, soit 27 % du catalogue —", font=f_gras, fill=TEXTE)
d.text((M + 22 + larg("4 528", f_grand) + 20 + larg("offres, soit 27 % du catalogue —", f_gras) + 10, yy + 8),
       "6 fois tout le reste réuni.", font=f_gras, fill=ROUGE)
yy += 52
d.text((M + 22, yy),
       "Une seule inscription ouvre ces 4 528 offres. Rémunération annoncée par Amazon : jusqu'à 12 % du",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "prix. Les quinze autres réseaux réunis couvrent aujourd'hui ~80 offres (0,5 %). Inutile de courir.",
       font=f_corps, fill=TEXTE)
y += h2 + 34

# ---------- 3. les dix identifiants ----------
marches = ["amazon.fr", "amazon.de", "amazon.it", "amazon.es", "amazon.nl",
           "amazon.com.be", "amazon.co.uk", "amazon.ie", "amazon.se", "amazon.pl"]
h3 = 20 + 42 + 48 + 60 + 34 + 34
bloc(y, h3)
yy = sect(y + 18, "3 · Ce qu'il faut rapporter : DIX identifiants, un par marché Amazon")
d.text((M + 22, yy),
       "Un identifiant français posé sur un lien allemand ne rapporte rien : chaque programme",
       font=f_petit, fill=GRIS)
d.text((M + 22, yy + 20),
       "national ne reconnaît que son propre identifiant.",
       font=f_petit, fill=GRIS)
yy += 48
colw = (W - 2 * M - 44) // 5
for i, m in enumerate(marches):
    col, row = i % 5, i // 5
    d.text((M + 22 + col * colw, yy + row * 30), m, font=f_gras,
           fill=VERT if m == "amazon.com.be" else TEXTE)
yy += 60
d.text((M + 22, yy), "En vert : amazon.com.be — le marché belge, celui du site.", font=f_petit, fill=VERT)
d.text((M + 22, yy + 22),
       "L'inscription demande : ton identité, un compte Amazon, des informations fiscales et un IBAN.",
       font=f_petit, fill=ROUGE)
y += h3 + 34

# ---------- 4. où ça se pose ----------
h4 = 20 + 42 + 78
bloc(y, h4)
yy = sect(y + 18, "4 · Où ça se pose — deux endroits, et rien d'autre")
d.text((M + 22, yy),
       "AMAZON_TAGS dans public/affiliation.js : les dix lignes existent déjà, toutes vides aujourd'hui.", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "Poser un identifiant suffit : le pied de page bascule tout seul de « liens directs, sans commission »", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 48),
       "vers la mention de transparence. Aucune autre modification n'est nécessaire.", font=f_corps, fill=TEXTE)
y += h4 + 34

# ---------- 5. le vrai sujet ----------
h5 = 20 + 42 + 96
bloc(y, h5, fond=(252, 248, 238), bord=(238, 224, 196))
yy = sect(y + 18, "5 · Le vrai sujet, plus gros que toutes les inscriptions : les 68 %")
d.text((M + 22, yy),
       "Le marchand est CONNU (Lidl, MediaMarkt, Cdiscount, AliExpress — le champ le porte) mais son adresse", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "ne l'est pas : le lien part vers Dealabs, MyDealz ou Pepper. Aucun réseau ne monétisera jamais ça.", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 48),
       "Deux voies : laisser tel quel (honnête, non monétisé), ou résoudre 11 385 liens marchands un par un.", font=f_corps, fill=TEXTE)
y += h5 + 40

pied = ("Sources relevées le 09/10/2026 : data/offres.json (16 680 offres, destination réelle du lien sortant) ; "
        "donnees/affiliations.json (607 acteurs, 95 programmes) ; partenaires.amazon.fr (rémunération, pays) ; "
        "public/affiliation.js (les deux points d'insertion). L'inscription engage votre identité, vos "
        "informations fiscales et votre IBAN : je ne peux pas la faire à votre place.")
lp = enroule(pied, f_petit, W - 2 * M - 36)
h6 = 20 + len(lp) * 22
d.rectangle([M, y, W - M, y + h6], fill=(238, 243, 248), outline=LIGNE)
yy = y + 12
for l in lp:
    d.text((M + 18, yy), l, font=f_petit, fill=GRIS)
    yy += 22

H = yy + 30
img = img.crop((0, 0, W, H))
img.save("/opt/data/webdev/projects/promos/identite/affiliations-par-ou-commencer.png")
print("OK", img.size, "->", "/opt/data/webdev/projects/promos/identite/affiliations-par-ou-commencer.png")
