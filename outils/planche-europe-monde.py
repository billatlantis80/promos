#!/usr/bin/env python3
"""Planche « Protéger Kazendra — Europe et monde ».

Mêmes règles que planche-protection.py : colonnes mesurées avec textlength,
enrouleur unique pour tous les textes longs, hauteur calculée depuis le y final,
et les grands chiffres ont leurs PROPRES décalages (jamais ceux du tableau).
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


def bloc(y, h):
    d.rectangle([M, y, W - M, y + h], fill=BANDE, outline=LIGNE)


def titre_section(y, txt):
    d.text((M + 22, y), txt, font=f_h2, fill=BLEU)
    return y + 42


# ---------- en-tête ----------
d.rectangle([0, 0, W, 118], fill=BLEU)
d.text((M, 26), "Protéger Kazendra — Europe et monde", font=f_titre, fill=(255, 255, 255))
d.text((M, 74), "Tarifs officiels relevés le 09/10/2026 — EUIPO, BOIP, OMPI (système de Madrid)",
       font=f_sous, fill=(196, 214, 228))

y = 150

# ---------- 1. Toute l'Europe = EUIPO ----------
h1 = 20 + 42 + 130
bloc(y, h1)
yy = titre_section(y + 18, "1 · Toute l'Europe — un seul dépôt : l'EUIPO")
d.text((M + 22, yy), "1 050 €", font=f_grand, fill=VERT)
d.text((M + 22 + larg("1 050 €", f_grand) + 24, yy + 12),
       "pour les 27 pays de l'UE · 3 classes · dix ans", font=f_gras, fill=TEXTE)
yy += 58
d.text((M + 22, yy),
       "850 € (1ʳᵉ classe) + 50 € (2ᵉ) + 150 € (3ᵉ) — demande électronique. Protège le NOM dans toutes",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "les formes. Couvre 11 des 12 marchés du site — le BOIP, lui, n'en couvre que 3. Le logo serait",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 48),
       "une seconde marque, donc une seconde taxe : à déposer plus tard, si le besoin se confirme.",
       font=f_corps, fill=TEXTE)
y += h1 + 34

# ---------- 2. Le monde entier n'existe pas ----------
h2 = 20 + 42 + 118
bloc(y, h2)
yy = titre_section(y + 18, "2 · Le monde entier — il n'existe pas de marque mondiale")
d.text((M + 22, yy), "Aucun office ne délivre une marque valable partout.", font=f_gras, fill=ROUGE)
yy += 28
d.text((M + 22, yy),
       "Ce qui existe : le système de Madrid (OMPI) — 117 membres couvrant 133 pays, 80 % du commerce",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 24),
       "mondial. Une seule demande, une seule monnaie — mais 133 offices qui examinent chacun selon sa",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 48),
       "loi, avec le droit de refuser. Une procédure unique, pas un droit mondial.",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 78),
       "Prérequis : une marque de base (EUIPO ou BOIP) d'abord. Madrid vient après.",
       font=f_petit, fill=GRIS)
y += h2 + 34

# ---------- 3. Ce que coûte Madrid ----------
h3 = 20 + 42 + 96
bloc(y, h3)
yy = titre_section(y + 18, "3 · Ce que coûte une demande internationale (Madrid, barème OMPI)")
d.text((M + 22, yy), "Émolument de base : 653 CHF = 701 €", font=f_gras, fill=BLEU)
d.text((M + 22, yy + 28),
       "couvre les 3 premières classes, pour dix ans. Puis, par pays désigné : 100 CHF (107 €) là où le",
       font=f_corps, fill=TEXTE)
d.text((M + 22, yy + 52),
       "pays n'a pas de taxe propre, ou sa taxe individuelle. Taux utilisé : 1 CHF = 1,0738 € (BCE, 09/10).",
       font=f_corps, fill=TEXTE)
y += h3 + 34

# ---------- 4. tableau des marchés ----------
marches = [
    ("Chine", "472 €"), ("États-Unis", "1 482 €"),
    ("Inde", "267 €"), ("Israël", "1 266 €"),
    ("Japon", "684 €"), ("Émirats arabes unis", "4 574 €"),
    ("Corée du Sud", "483 €"), ("Royaume-Uni", "395 €"),
    ("Singapour", "854 €"), ("Suisse", "430 €"),
    ("Australie", "699 €"), ("Norvège", "506 €"),
    ("Canada", "487 €"), ("Brésil", "809 €"),
    ("Mexique", "425 €"),
]
# LA RÈGLE : le plus LONG se mesure, il ne se déduit pas d'un max alphabétique.
lab_g = max((m[0] for m in marches), key=lambda s: larg(s, f_corps))
val_g = max((m[1] for m in marches), key=lambda s: larg(s, f_corps))
n_lignes = max(len(marches) - len(marches) // 2, len(marches) // 2)
col_h = 22 + 42 + 30 + n_lignes * 30 + 16
bloc(y, col_h)
yy = titre_section(y + 18, "4 · Le monde, marché par marché (3 classes, dix ans)")
d.text((M + 22, yy), "« Protéger dans le monde entier » veut dire choisir des pays, pas une planète.",
       font=f_petit, fill=GRIS)
yy = y + 18 + 42 + 30
lw = larg(lab_g, f_corps)
vw = larg(val_g, f_gras)
for i, (nom, val) in enumerate(marches):
    demi = n_lignes
    col = i // demi
    row = i % demi
    xa = M + 22 + col * 520
    xb = xa + lw + 34
    yy2 = yy + row * 30
    d.text((xa, yy2), nom, font=f_corps, fill=TEXTE)
    d.text((xb, yy2), val, font=f_gras,
           fill=(VERT if val in ("395 €", "472 €", "267 €") else TEXTE))
y += col_h + 34

# ---------- 5. l'ordre recommandé ----------
etapes = [
    ("1", "EUIPO maintenant", "1 050 € — les 27 pays de l'UE, 3 classes, dix ans.", VERT),
    ("2", "Royaume-Uni — le seul marché du site hors UE", "+395 € via Madrid (ou dépôt direct au Royaume-Uni).", BLEU),
    ("3", "Le reste du monde plus tard, pays par pays", "via Madrid, sur la base de l'enregistrement UE.", GRIS),
]
h5 = 20 + 42 + len(etapes) * 40 + 8
bloc(y, h5)
yy = titre_section(y + 18, "5 · L'ordre que je recommande")
for num, titre, txt, coul in etapes:
    d.text((M + 22, yy), num + ".", font=f_gras, fill=ORANGE)
    d.text((M + 52, yy), titre, font=f_gras, fill=coul)
    d.text((M + 52 + larg(titre, f_gras) + 14, yy), txt, font=f_corps, fill=GRIS)
    yy += 40
d.text((M + 22, yy + 4),
       "Contrôle : EUIPO direct 1 050 € · désigner l'UE via Madrid 1 755 € — Madrid coûte 705 € de plus,",
       font=f_petit, fill=ROUGE)
d.text((M + 22, yy + 24),
       "donc Madrid ne sert qu'à AJOUTER des pays hors UE.", font=f_petit, fill=ROUGE)
y += h5 + 46

# ---------- pied ----------
pied = ("Détail complet, libellés de classes 9/35/42 en FR et EN, et marche à suivre bouton par bouton : "
        "PROTECTION-KAZENDRA.md. Sources consultées le 09/10/2026 : euipo.europa.eu (« Fees payable direct "
        "to EUIPO »), boip.int (onglet Enregistrer), wipo.int (système de Madrid — barème en vigueur au "
        "1er février 2023 et taxes individuelles), taux de référence BCE du 09/10/2026. Non mesuré : "
        "registre du commerce belge (canal refusé). Ceci n'est pas un avis juridique.")
lignes_pied = enroule(pied, f_petit, W - 2 * M - 36)
h6 = 20 + len(lignes_pied) * 22
d.rectangle([M, y, W - M, y + h6], fill=(238, 243, 248), outline=LIGNE)
yy = y + 12
for l in lignes_pied:
    d.text((M + 18, yy), l, font=f_petit, fill=GRIS)
    yy += 22

H = yy + 30
img = img.crop((0, 0, W, H))
img.save("/opt/data/webdev/projects/promos/identite/proteger-europe-monde.png")
print("OK", img.size, "->", "/opt/data/webdev/projects/promos/identite/proteger-europe-monde.png")
