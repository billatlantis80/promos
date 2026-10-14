#!/usr/bin/env python3
"""Planche « 1 050 € — qu'est-ce que ça rapporte ? ».

Mêmes règles : colonnes mesurées (textlength), enrouleur unique, hauteur calculée
depuis le y final, offsets propres pour les grands chiffres, contrôle visuel.
"""
from PIL import Image, ImageDraw, ImageFont

BLEU = (13, 59, 91)
ORANGE = (235, 145, 45)
FOND = (255, 255, 255)
TEXTE = (26, 32, 44)
GRIS = (110, 120, 135)
VERT = (32, 130, 84)
ROUGE = (178, 58, 46)
LIGNE = (223, 228, 234)
BANDE = (244, 247, 250)

W = 1180
M = 46
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f_titre = ImageFont.truetype(FB, 34)
f_sous = ImageFont.truetype(F, 17)
f_h2 = ImageFont.truetype(FB, 22)
f_corps = ImageFont.truetype(F, 17)
f_petit = ImageFont.truetype(F, 15)
f_gras = ImageFont.truetype(FB, 17)
f_grand = ImageFont.truetype(FB, 40)

img = Image.new("RGB", (W, 4000), FOND)
d = ImageDraw.Draw(img)


def larg(txt, font):
    return d.textlength(txt, font=font)


def enroule(txt, font, largeur_max):
    lignes, courant = [], ""
    for mot in txt.split():
        essai = (courant + " " + mot).strip()
        if larg(essai, font) <= largeur_max:
            courant = essai
        else:
            if courant:
                lignes.append(courant)
            courant = mot
    if courant:
        lignes.append(courant)
    return lignes


def bloc(y, h, fond=BANDE, bord=LIGNE):
    d.rectangle([M, y, W - M, y + h], fill=fond, outline=bord)


def titre_section(y, txt):
    d.text((M + 22, y), txt, font=f_h2, fill=BLEU)
    return y + 42


# ---------- en-tête ----------
d.rectangle([0, 0, W, 118], fill=BLEU)
d.text((M, 26), "1 050 € pour la marque — qu'est-ce que ça rapporte ?", font=ImageFont.truetype(FB, 30), fill=(255, 255, 255))
d.text((M, 74), "Réponse franche : la marque ne rapporte rien. C'est une assurance, pas un placement.",
       font=f_sous, fill=(196, 214, 228))

y = 150

# ---------- 1. ce que ça ne rapporte pas ----------
non = [
    "Aucun revenu, aucun client, aucun visiteur de plus.",
    "Aucune place gagnée sur Google ou sur le Play Store.",
    "Aucun droit sur l'idée : le service peut être copié demain.",
]
h1 = 20 + 42 + len(non) * 30 + 14
bloc(y, h1, fond=(252, 244, 243), bord=(238, 214, 210))
yy = titre_section(y + 18, "Ce que ça NE rapporte PAS")
for t in non:
    d.text((M + 22, yy), "×", font=f_gras, fill=ROUGE)
    d.text((M + 48, yy), t, font=f_corps, fill=TEXTE)
    yy += 30
y += h1 + 34

# ---------- 2. ce que ça fait ----------
oui = [
    ("Le droit d'utiliser le nom", "aujourd'hui vous l'utilisez sans droit : le nom est libre de tout dépôt."),
    ("Le pouvoir d'agir", "contre une application homonyme sur les stores, ou un site qui reprend le nom."),
    ("Un actif", "une marque enregistrée se cède et se valorise — et crédibilise les affiliations."),
]
# x_txt : UNE seule colonne, dimensionnée sur le titre le PLUS LONG (mesuré).
x_txt = M + 48 + max(larg(t, f_gras) for t, _ in oui) + 18
h2 = 20 + 42 + len(oui) * 32 + 10
bloc(y, h2)
yy = titre_section(y + 18, "Ce que ça FAIT — et qui n'a pas de prix tant qu'on ne s'est pas fait attaquer")
for t, s in oui:
    d.text((M + 22, yy), "✓", font=f_gras, fill=VERT)
    d.text((M + 48, yy), t, font=f_gras, fill=TEXTE)
    d.text((x_txt, yy), s, font=f_corps, fill=GRIS)
    yy += 32
y += h2 + 34

# ---------- 3. le chiffre qui compte ----------
h3 = 20 + 42 + 116
bloc(y, h3, fond=(240, 247, 244), bord=(206, 226, 214))
yy = titre_section(y + 18, "Le chiffre qui compte")
d.text((M + 22, yy), "105 €", font=f_grand, fill=VERT)
d.text((M + 22 + larg("105 €", f_grand) + 22, yy + 12), "par an (1 050 € pour dix ans)", font=f_gras, fill=TEXTE)
yy += 58
d.text((M + 22, yy),
       "Ce qu'il faut comparer : le prix d'un RENOMMAGE forcé. Le paquet Android s'appelle", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "com.kazendra.app : le changer, c'est publier une NOUVELLE application Play Store — installations", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 48),
       "et avis perdus. Plus 5 domaines, 15 912 pages, les pages légales en 3 langues, le logo.", font=f_corps, fill=TEXTE)
y += h3 + 34

# ---------- 4. l'aide existe, mais épuisée ----------
h4 = 20 + 42 + 78
bloc(y, h4, fond=(252, 248, 238), bord=(238, 224, 196))
yy = titre_section(y + 18, "L'aide de l'UE existe — jusqu'à 75 % remboursés — mais elle est ÉPUISÉE")
d.text((M + 22, yy),
       "SME Fund (EUIPO) : « Voucher 2 (marques et modèles) indisponible pour de nouvelles demandes,", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "fonds épuisés. » Relevé sur euipo.europa.eu le 09/10/2026. À surveiller : si ça rouvre, le coût net", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 48),
       "peut tomber à environ 260 €. Ne pas compter dessus aujourd'hui.", font=f_corps, fill=TEXTE)
y += h4 + 34

# ---------- 5. la seule question qui tranche ----------
h5 = 20 + 42 + 100
bloc(y, h5)
yy = titre_section(y + 18, "La seule chose qui tranche vraiment : veux-tu promouvoir ce site ?")
d.text((M + 22, yy),
       "PAS de promotion prévue → tu peux attendre : un site que personne ne connaît n'attire personne.", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 26),
       "Promotion prévue → dépose AVANT. 1 050 € dépensés une fois contre un renommage complet à tes frais.", font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 54),
       "Et rappel honnête : aujourd'hui le site rapporte 0 € — le formulaire d'affiliation n'est pas encore branché.", font=f_petit, fill=ROUGE)
y += h5 + 40

# ---------- pied ----------
pied = ("Ordre de grandeur du renommage : des dizaines d'heures de travail — c'est une estimation, pas une "
        "mesure. Sources relevées le 09/10/2026 : euipo.europa.eu (frais de dépôt et SME Fund — Voucher 2 "
        "épuisé), wipo.int (système de Madrid), boip.int. Ceci n'est pas un conseil juridique ou financier.")
lignes_pied = enroule(pied, f_petit, W - 2 * M - 36)
h6 = 20 + len(lignes_pied) * 22
d.rectangle([M, y, W - M, y + h6], fill=(238, 243, 248), outline=LIGNE)
yy = y + 12
for l in lignes_pied:
    d.text((M + 18, yy), l, font=f_petit, fill=GRIS)
    yy += 22

H = yy + 30
img = img.crop((0, 0, W, H))
img.save("/opt/data/webdev/projects/promos/identite/vaut-il-le-coup.png")
print("OK", img.size, "->", "/opt/data/webdev/projects/promos/identite/vaut-il-le-coup.png")
