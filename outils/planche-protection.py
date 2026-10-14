#!/usr/bin/env python3
"""Planche « Protéger Kazendra » — rendu Pillow, sans navigateur.

Règles appliquées (apprises sur les planches précédentes) :
  - toute colonne est dimensionnée d'après le libellé le PLUS LONG, mesuré
    avec draw.textlength — jamais d'après une valeur estimée ;
  - tout texte long passe par le même enrouleur, pied de page compris ;
  - la hauteur du canevas est calculée depuis le y FINAL, pas estimée ;
  - les blocs de totaux ont leurs propres décalages, pas ceux du tableau.
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
f_prix = ImageFont.truetype(FB, 30)

img = Image.new("RGB", (W, 4000), FOND)
d = ImageDraw.Draw(img)


def larg(txt, font):
    return d.textlength(txt, font=font)


def enroule(txt, font, largeur_max):
    """Découpe txt en lignes qui tiennent dans largeur_max (mesuré, pas estimé)."""
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
    return y + 40


# ---------- en-tête ----------
d.rectangle([0, 0, W, 118], fill=BLEU)
d.text((M, 26), "Protéger Kazendra", font=f_titre, fill=(255, 255, 255))
d.text((M, 74), "Dossier de dépôt de marque — relevés officiels du 09/10/2026",
       font=f_sous, fill=(196, 214, 228))

y = 150

# ---------- 1. ce qui est protégeable ----------
h1 = 0
lignes_prot = [
    ("L'idée, le concept", "NON — une idée ne se protège pas", ROUGE),
    ("Le nom « Kazendra »", "OUI — marque déposée (à faire)", VERT),
    ("Le logo", "OUI — droit d'auteur + marque figurative", VERT),
    ("Le code", "OUI — droit d'auteur automatique, déjà acquis", VERT),
    ("La base de données", "OUI — droit sui generis (UE)", VERT),
    ("Les noms de domaine", "OUI — .com .fr .be .eu .app, déjà à vous", VERT),
]
# colonne « élément » : dimensionnée sur le plus long
lab_col = max(["L'idée, le concept", "Le nom « Kazendra »", "Le logo", "Le code",
               "La base de données", "Les noms de domaine"], key=lambda s: larg(s, f_gras))
x2 = M + 22 + larg(lab_col, f_gras) + 34
titre_section_h = 40
hauteur_lignes = 30
h1 = 20 + titre_section_h + len(lignes_prot) * hauteur_lignes + 14
bloc(y, h1)
yy = titre_section(y + 18, "1 · Ce qui est protégeable — et ce qui ne l'est pas")
for lab, val, coul in lignes_prot:
    d.text((M + 22, yy), lab, font=f_gras, fill=TEXTE)
    d.text((x2, yy), val, font=f_corps, fill=coul)
    yy += hauteur_lignes
y += h1 + 34

# ---------- 2. antériorité ----------
mesures = [
    ("zalando", "210 résultats", "témoin — la requête fonctionne", GRIS),
    ("veepee", "52 résultats", "témoin", GRIS),
    ("zzqxwnonsense", "0 résultat", "témoin négatif — le zéro veut dire zéro", GRIS),
    ("kazendra", "0 résultat", "aucun dépôt, où que ce soit", VERT),
]
lab2 = max([m[0] for m in mesures], key=lambda s: larg(s, f_gras))
x2b = M + 22 + larg(lab2, f_gras) + 30
h2 = 20 + titre_section_h + 26 + len(mesures) * 30 + 40
bloc(y, h2)
yy = titre_section(y + 18, "2 · Antériorité — re-mesurée le 09/10/2026 (TMview)")
d.text((M + 22, yy), "« Kazendra » est vierge de tout dépôt. Les témoins rendent ce zéro exploitable.",
       font=f_petit, fill=GRIS)
yy += 26
for nom, res, expl, coul in mesures:
    d.text((M + 22, yy), nom, font=f_gras, fill=TEXTE if coul is GRIS else VERT)
    d.text((x2b, yy), res, font=f_gras, fill=coul)
    d.text((x2b + 150, yy), expl, font=f_petit, fill=GRIS)
    yy += 30
d.text((M + 22, yy + 6),
       "Trou annoncé : le registre du commerce belge (BCE) a refusé la mesure — à vérifier à la main.",
       font=f_petit, fill=ROUGE)
y += h2 + 34

# ---------- 3. BOIP vs EUIPO ----------
x_boip = M + 22
x_euipo = M + 470
h3 = 20 + titre_section_h + 285
bloc(y, h3)
yy = titre_section(y + 18, "3 · Où déposer — deux options, un seul choix à faire maintenant")

d.text((x_boip, yy), "BOIP — Benelux", font=f_h2, fill=BLEU)
d.text((x_euipo, yy), "EUIPO — Union européenne", font=f_h2, fill=BLEU)
yy += 38
colonne_bleu = [
    "Couvre : Belgique, Pays-Bas, Luxembourg",
    "Durée : 10 ans, renouvelable",
    "Base 1 classe : 244 €",
    "2ᵉ classe : + 27 €",
    "3ᵉ classe et + : + 81 €",
    "Renouvellement : àpd 263 €",
]
colonne_eu = [
    "Couvre : les 27 pays de l'UE",
    "Durée : 10 ans, renouvelable",
    "Base 1 classe : 850 €",
    "2ᵉ classe : + 50 €",
    "3ᵉ classe et + : + 150 €",
    "Renouvellement : 850 €",
]
yb = yy
for ligne in colonne_bleu:
    d.text((x_boip, yb), ligne, font=f_corps, fill=TEXTE)
    yb += 27
yb = yy
for ligne in colonne_eu:
    d.text((x_euipo, yb), ligne, font=f_corps, fill=TEXTE)
    yb += 27

# totaux — offsets PROPRES, pas ceux du tableau
yt = yy + 6 * 27 + 16
d.text((x_boip, yt), "3 classes (9 + 35 + 42) :", font=f_gras, fill=TEXTE)
d.text((x_boip + larg("3 classes (9 + 35 + 42) :", f_gras) + 14, yt - 6),
       "352 €", font=f_prix, fill=VERT)
d.text((x_euipo, yt), "3 classes (9 + 35 + 42) :", font=f_gras, fill=TEXTE)
d.text((x_euipo + larg("3 classes (9 + 35 + 42) :", f_gras) + 14, yt - 6),
       "1 050 €", font=f_prix, fill=GRIS)
d.text((x_boip, yt + 40), "pour dix ans · TVA non applicable", font=f_petit, fill=BLEU)
d.text((x_boip, yt + 62), "recommandé pour commencer", font=f_petit, fill=BLEU)
d.text((x_euipo, yt + 40), "pour dix ans", font=f_petit, fill=GRIS)
d.text((x_euipo, yt + 62), "à envisager quand le site s'ouvre aux 27", font=f_petit, fill=GRIS)
y += h3 + 34

# ---------- 4. les classes de Nice ----------
classes = [
    ("Classe 9", "logiciels et applications téléchargeables (l'APK)"),
    ("Classe 35", "publicité, promotion, comparaison de prix, information du consommateur — le cœur du service"),
    ("Classe 42", "services technologiques, plateforme en ligne, SaaS / PaaS"),
]
textes_cl = []
largeur_txt = W - M * 2 - 22 - 130
for nom, txt in classes:
    textes_cl.append((nom, enroule(txt, f_corps, largeur_txt)))
h4 = 20 + titre_section_h + sum(len(l) * 26 + 10 for _, l in textes_cl) + 16
bloc(y, h4)
yy = titre_section(y + 18, "4 · Les trois classes de Nice à viser")
for nom, l in textes_cl:
    d.text((M + 22, yy), nom, font=f_gras, fill=ORANGE)
    d.multiline_text((M + 152, yy), "\n".join(l), font=f_corps, fill=TEXTE, spacing=8)
    yy += len(l) * 26 + 10
y += h4 + 34

# ---------- 5. pied ----------
pied = ("La marche à suivre (compte EUIPO, formulaire, libellés à recopier en FR/EN, paiement de 1 050 €) "
        "est dans PROTECTION-KAZENDRA.md. Le logo est une SECONDE marque : à déposer plus tard, pas le "
        "même jour. Il faut de vous : votre identité exacte, un e-mail valide, et le paiement — le dépôt au "
        "mauvais nom serait pire que pas de dépôt. Sources : euipo.europa.eu et boip.int (onglet "
        "Enregistrer), consultées le 09/10/2026 ; TMview le 09/10/2026. Ceci n'est pas un avis juridique.")
lignes_pied = enroule(pied, f_petit, W - 2 * M)
h5 = 20 + len(lignes_pied) * 22
d.rectangle([M, y, W - M, y + h5], fill=(238, 243, 248), outline=LIGNE)
yy = y + 12
for l in lignes_pied:
    d.text((M + 18, yy), l, font=f_petit, fill=GRIS)
    yy += 22

# hauteur finale calculée depuis le y réel
H = yy + 30
img = img.crop((0, 0, W, H))
img.save("/opt/data/webdev/projects/promos/identite/proteger-kazendra.png")
print("OK", img.size, "->", "/opt/data/webdev/projects/promos/identite/proteger-kazendra.png")
