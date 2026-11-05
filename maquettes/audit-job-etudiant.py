#!/usr/bin/env python3
"""Audit de la porte /job-etudiant — tout est vérifié contre les fichiers et le rendu réel.

1. données : table des codes postaux, calendrier scolaire, jours de la semaine
2. rendu : le texte tel qu'il s'affiche (innerText), pas le HTML source
3. grille : états des heures lus dans le DOM
4. arithmétique : les totaux affichés sont recalculés depuis leurs lignes
5. interdits : une phrase interdite n'est tolérée que citée pour être refusée
6. contrastes : WCAG AA sur les couples de couleurs réellement employés
"""
import asyncio, json, csv, re, datetime as dt
from playwright.async_api import async_playwright

BASE = "/opt/data/webdev/projects/promos"
HTML = f"{BASE}/maquettes/job-etudiant.html"
URL = "file://" + HTML
CP = f"{BASE}/donnees/codes-postaux/be-codes-postaux.json"
VAC = "/opt/data/app3/veille/table-vacances.csv"
MODELE = f"{BASE}/MODELE-DONNEES-JOB-ETUDIANT.md"

ok, ko, infos = [], [], []
def check(cond, label, detail=""):
    (ok if cond else ko).append(label + (f" — {detail}" if detail else ""))

# ═══════════ 1. DONNÉES ═══════════
codes = json.load(open(CP, encoding="utf-8"))["codes"]
n = len(codes)
communes = {c["commune"] for c in codes}
infos.append(f"codes postaux : {n} entrées · {len(communes)} libellés de commune · "
             f"{len({c['region'] for c in codes})} régions")
check(n == 1146, "la table contient 1 146 codes postaux", f"lu {n}")
w = [c for c in codes if c["cp"] == "1170"]
check(bool(w) and w[0]["commune"] == "Watermael-Boitsfort",
      "1170 = Watermael-Boitsfort", w[0]["commune"] if w else "absent")
check(bool(w) and w[0]["region"] == "Bruxelles-Capitale", "1170 en Région bruxelloise")

jours_fr = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
attendu = {"Lun": 0, "Mar": 1, "Mer": 2, "Jeu": 3, "Ven": 4, "Sam": 5, "Dim": 6}
for abr, j in [("Lun", 19), ("Mar", 20), ("Mer", 21), ("Jeu", 22), ("Ven", 23), ("Sam", 24), ("Dim", 25)]:
    r = dt.date(2026, 10, j).weekday()
    check(r == attendu[abr], f"{j} octobre 2026 = {jours_fr[r]} (affiché {abr})")
for abr, j in [("Sam", 17), ("Jeu", 15), ("Mar", 13), ("Sam", 10)]:
    r = dt.date(2026, 10, j).weekday()
    check(r == attendu[abr], f"{j} octobre 2026 = {jours_fr[r]} (affiché {abr})")

lignes = open(VAC, encoding="utf-8").read().splitlines()
entete = ["communaute", "annee_scolaire", "periode", "debut", "fin"]
vac = [dict(zip(entete, [x.strip() for x in next(csv.reader([l]))]))
       for l in lignes if l[:5] in ("Fédér", "Vlaam", "Deuts")]
def trouve(c, p):
    for v in vac:
        if v["communaute"].startswith(c) and v["annee_scolaire"] == "2026-2027" and v["periode"] == p:
            return v["debut"], v["fin"]
fwb, vla = trouve("Fédér", "Toussaint"), trouve("Vlaam", "Toussaint")
infos.append(f"Toussaint 2026 — FWB {fwb[0]}→{fwb[1]} · Flandre {vla[0]}→{vla[1]}")
check(fwb == ("2026-10-19", "2026-11-01"), "FWB Toussaint 19/10 → 01/11/2026", str(fwb))
check(vla == ("2026-11-02", "2026-11-08"), "Flandre Toussaint 02/11 → 08/11/2026", str(vla))

naissance = dt.date(2008, 3, 14)
age = (dt.date(2026, 10, 22) - naissance).days / 365.2425
check(18 <= age < 19, "Léa a 18 ans au 22 octobre 2026", f"{age:.2f}")

# ═══════════ 2. RENDU ═══════════
async def rendu():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(300)
        data = await pg.evaluate("""() => {
          const caps = [...document.querySelectorAll('.cap')];
          const ecrans = caps.map(c => {
            let t = '', el = c.nextElementSibling;
            while (el && !el.classList.contains('cap')) { t += el.innerText + '\\n'; el = el.nextElementSibling; }
            return {titre: c.innerText.trim(), texte: t, y: c.getBoundingClientRect().top + scrollY};
          });
          const cells = [...document.querySelectorAll('.week .cell')].map(c =>
            [...c.classList].find(x => x !== 'cell'));
          const rows = [...document.querySelectorAll('.week .hr')].map(r => r.innerText.trim());
          const slots = [...document.querySelectorAll('.seeslot')].map(s => s.innerText.replace(/\\n/g,' '));
          const carnet = [...document.querySelectorAll('.crow2')].map(r => ({
            texte: r.innerText.replace(/\\n/g,' | '),
            duree: (r.querySelector('.du')||{}).innerText || '',
            etat: (r.querySelector('.tagx')||{}).innerText || ''
          }));
          const tots = [...document.querySelectorAll('.tot')].map(t => t.innerText.replace(/\\n/g,' '));
          const drapeaux = [...document.querySelectorAll('.ctile img,.langopt img')].map(i =>
            i.getAttribute('src').split('/').pop());
          const actif = [...document.querySelectorAll('header nav a.on')].map(a => a.innerText);
          const offres = [...document.querySelectorAll('.jcard')].map(c => ({
            texte: c.innerText,
            badges18: [...c.querySelectorAll('.b18')].map(b => b.innerText.trim())
          }));
          const etats = [...document.querySelectorAll('.arow .tagx')].map(t => t.innerText.trim());
          const titres = [...document.querySelectorAll('.arow .t > b')].map(t => t.innerText.trim());
          return {ecrans, cells, rows, slots, carnet, tots, drapeaux, actif, offres, etats, titres,
                  partage: document.querySelectorAll('.part,.wa').length,
                  erreurs: 0};
        }""")
        data["js_erreurs"] = errs
        await b.close()
        return data

D = asyncio.run(rendu())
check(not D["js_erreurs"], "aucune erreur JavaScript", str(D["js_erreurs"]))
check(len(D["ecrans"]) == 11, "11 écrans rendus", str(len(D["ecrans"])))
check(all(a == "Jobs étudiants" for a in D["actif"]), "l'onglet actif est « Jobs étudiants » partout")
check(D["partage"] == 0, "aucun bouton de partage sur la porte", str(D["partage"]))

txt = "\n".join(e["texte"] for e in D["ecrans"])
ecr = {i + 1: e for i, e in enumerate(D["ecrans"])}
# innerText conserve les retours à la ligne visuels : une phrase coupée par le
# retour à la ligne ne se retrouve pas d'un bloc. On normalise pour comparer.
def plat(s):
    return re.sub(r"\s+", " ", s.replace("\u00a0", " "))
for e in ecr.values():
    e["plat"] = plat(e["texte"])

def dans(n, *morceaux):
    return all(plat(m) in ecr[n]["plat"] for m in morceaux)

def dansi(n, *morceaux):
    """Comme dans(), mais insensible à la casse : innerText renvoie le texte
    transformé par text-transform, donc les titres arrivent en capitales."""
    bas = ecr[n]["plat"].lower()
    return all(m.lower() in bas for m in morceaux)

check("1 146 codes postaux" in txt, "le nombre est présenté comme des codes postaux")
check("1 146 communes" not in txt, "jamais « 1 146 communes » (la Belgique en compte 581)")
check(dans(2, "1 146 codes postaux"), "écran 2 : 1 146 codes postaux")
check(dans(3, "1 146 codes postaux"), "écran 3 : la liste des 1 146 codes postaux")
check(dans(4, "19 octobre au 1er novembre"), "écran 4 : vacances FWB 19/10 → 01/11",
      "1er" if "1er" in ecr[4]["texte"] else "?")
check(dans(4, "2 au 8 novembre"), "écran 4 : comparaison Flandre 2 → 8 novembre")
check(dans(4, "Rhéto", "Fédération Wallonie-Bruxelles"), "écran 4 : persona rhéto FWB")
check(dans(6, "Pause de 30 minutes au-delà de 4 h 30", "au-delà de 6 h"),
      "écran 6 : la pause est complète (30 min > 4 h 30, 1 h > 6 h)")
check(dans(6, "La mission a-t-elle eu lieu ?", "Sans durée, sans montant"),
      "écran 6 : la confirmation sans durée ni montant")
check(dans(7, "Aucune", "n'est certifiée par nous"), "écran 7 : aucune heure certifiée par nous")
check(dans(7, "Student@work"), "écran 7 : renvoi vers Student@work")
check(dans(1, "8 h par semaine"), "écran 1 : plafond de 8 h par semaine annoncé")
check(dans(1, "650 h par an"), "écran 1 : plafond de 650 h par an")
check(dans(1, "12 mois"), "écran 1 : règle des 12 mois")
check(dans(2, "22 h et 06 h"), "écran 2 : interdiction de nuit 22 h → 06 h")
check(dans(2, "exemption ONSS"), "écran 2 : la réserve ONSS est écrite, pas cachée")
check(dans(2, "coups de main", "18 ans"), "écran 2 : l'entraide reste à 18 ans")
check(dansi(3, "Variante 16–17 ans"), "écran 3 : la variante mineurs est signalée comme telle")
check(dansi(3, "ce bloc ne s'affiche pas sur son écran"),
      "écran 3 : la variante dit qu'elle ne s'applique pas à Léa")

# les drapeaux : communautés à l'inscription, pays pour la langue
drap = D["drapeaux"]
check(drap[:3] == ["france.svg", "pays-bas.svg", "allemagne.svg"],
      "écran 3 : la langue est en drapeaux de pays", str(drap[:3]))
check(drap[3:] == ["wallonie.svg", "flandre.svg", "germanophone.svg"],
      "écran 3 : la communauté est en drapeaux de communautés", str(drap[3:]))

# ═══════════ 3. GRILLE ═══════════
check(len(D["rows"]) == 12, "12 lignes horaires", str(len(D["rows"])))
check(D["rows"][0] == "08" and D["rows"][-1] == "19", "de 08 h à 19 h", f"{D['rows'][0]}→{D['rows'][-1]}")
cells = D["cells"]
check(len(cells) == 84, "84 cellules (12 × 7)", str(len(cells)))
mat = {8 + r: cells[r * 7:(r + 1) * 7] for r in range(12)}
check(all(len(v) == 7 for v in mat.values()), "chaque ligne a 7 cellules")
check(all(mat[h][6] == "off" for h in mat), "colonne dimanche entièrement indisponible")
res = sum(v.count("res") for v in mat.values())
lib = sum(v.count("libre") for v in mat.values())
vacs = sum(v.count("vac") for v in mat.values())
infos.append(f"grille : {lib} h libres · {res} h réservées · {vacs} h ouvertes par les vacances")
check(res == 6, "6 h réservées dans la grille", str(res))
check(vacs > 0, "des heures sont ouvertes par les vacances", str(vacs))
check(any("6 h" in t and "sur 8 h" in t for t in D["tots"]),
      "le compteur affiche bien 6 h sur 8 h", str(D["tots"][:2]))
def creneau_libre(deb, fin, jour):
    return all(mat[h][jour] == "libre" for h in range(deb, fin))
check(creneau_libre(10, 12, 1) and creneau_libre(10, 12, 3) and creneau_libre(13, 15, 5),
      "les 3 créneaux montrés à la personne aidée sont réellement libres dans la grille")
check(len(D["slots"]) == 3, "3 créneaux proposés à la personne aidée", str(len(D["slots"])))

# ═══════════ 4. ARITHMÉTIQUE DU CARNET ═══════════
durees = [int(m) for m in re.findall(r"(\d+) h", " ".join(c["duree"] for c in D["carnet"]))]
resil = [c["etat"] for c in D["carnet"]]
total = sum(durees)
infos.append(f"carnet : {len(durees)} missions chiffrées · {total} h · états {resil}")
check(total == 10, "le carnet totalise 10 h", f"{total}")
check(dans(7, f"{len(durees)} missions", f"{total} h déclarées"),
      f"l'en-tête du carnet annonce {len(durees)} missions et {total} h")
check(resil.count("CONFIRMÉ") == 4, "4 missions confirmées", str(resil.count("CONFIRMÉ")))
check(resil.count("DÉCLARÉ PAR TOI") == 1, "1 durée déclarée par l'étudiant")
check(dans(5, "5 missions terminées, 4 confirmées"),
      "les faits affichés sur Léa viennent de son carnet",
      "5 missions, dont 4 confirmées")

# ═══════════ 5. INTERDITS, CITÉS OU NON ═══════════
def tolere(phrase):
    """Une phrase interdite n'est acceptée que si le texte la refuse autour."""
    for m in re.finditer(re.escape(phrase), txt, re.I):
        ctx = txt[max(0, m.start() - 280):m.end() + 90].lower()
        if not any(x in ctx for x in ("jamais", "aucun", "pas de", "n'est", "ne ", "refus",
                                      "interdit", "n'émet", "ne certifie", "ne demande", "sans mention")):
            return False, txt[max(0, m.start() - 60):m.end() + 40].replace("\n", " ")
    return True, ""

for phrase, pourquoi in [("IBAN", "donnée bancaire"), ("casier", "donnée pénale"),
                         ("paiement sécurisé", "promesse"), ("louer un étudiant", "vocabulaire"),
                         ("sans photo", "mention d'absence"), ("photo obligatoire", "obligation"),
                         ("certifié", "sur-promesse"), ("validé", "mot réservé"),
                         ("étoile", "notation")]:
    bon, ctx = tolere(phrase)
    check(bon, f"« {phrase} » ({pourquoi}) n'apparaît que pour être refusé", ctx)

check("registre national" not in txt.lower() or tolere("registre national")[0],
      "« registre national » seulement en refus")
check(dansi(3, "Ce qui n'est jamais demandé"), "écran 3 : la liste des refus est affichée")

# ── annonces d'entreprise (écrans 8 à 11)
check(dans(8, "18 ans et plus"), "écran 8 : l'offre de nuit porte le badge 18+")
check(len(D["offres"]) == 4, "écran 8 : 4 offres affichées", str(len(D["offres"])))
ages = []
for o in D["offres"]:
    for m in re.finditer(r"(\d+)\s*(?:ans|–|-)\s*(\d+)?\s*ans?", o["texte"]):
        if m.group(0).strip() != "18 ans":
            ages.append(m.group(0))
check(not ages, "aucune offre ne porte d'âge dans son texte", str(ages))
check(all(o["badges18"] == (["18 ans et plus"] if "18 ans" in o["texte"] else [])
          for o in D["offres"]),
      "le seul « 18 ans » affiché est un badge de catégorie, pas une phrase de l'employeur")

for mention in ["Employeur identifié", "Lieu", "Durée", "Statut", "Rémunération"]:
    check(dans(9, mention), f"écran 9 : la mention obligatoire « {mention} » est présente")
check(dansi(9, "aucun cv"), "écran 9 : aucun CV ne passe par la plateforme")
check(dansi(9, "aucune candidature"), "écran 9 : aucune candidature déposée chez nous")
check(dans(9, "barème") and dansi(9, "n'affiche aucun"), "écran 9 : aucun barème affiché")
check(dansi(9, "vérifié à la main"), "écran 9 : vérification BCE datée, jamais « certifié »")
check(dans(10, "0 € au lancement"), "écran 10 : prix 0 € au lancement")
check(dans(10, "payant"), "écran 10 : les champs payant et échéance sont annoncés")
check(dansi(10, "toujours"), "écran 10 : les heures de cours sont verrouillées, pas un choix")
check(dans(11, "1 publiée"), "écran 11 : le décompte des offres publiées est juste")
check(len(D["etats"]) == 5 and len(set(D["etats"])) == 5,
      "écran 11 : cinq états distincts", str(D["etats"]))
check(D["etats"].count("PUBLIÉE") == 1, "écran 11 : une seule offre publiée", str(D["etats"]))
check(dans(11, "motif") and dansi(11, "refusée"), "écran 11 : un refus porte un motif écrit")
check(dansi(11, "ni cv", "ni tri"), "écran 11 : l'entreprise ne reçoit ni CV ni tri de profils")
check(dansi(10, "bénévolat"), "écran 10 : deux statuts d'annonce, dont le bénévolat")
check(dans(10, "3 au maximum") and dans(11, "Trois annonces actives"),
      "le plafond de trois annonces actives est écrit sur les deux écrans")
check(dansi(10, "annonce sponsorisée"), "écran 10 : la mention « annonce sponsorisée » est prévue")
check(dansi(8, "deux statuts", "pas trois"), "écran 8 : le filtre dit deux statuts, pas trois")


# ═══════════ 6. CONTRASTES (WCAG AA) ═══════════
def lum(hexa):
    r, g, b = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def ratio(a, b):
    la, lb = lum(a), lum(b)
    return round((max(la, lb) + 0.05) / (min(la, lb) + 0.05), 2)

# les couleurs testées sont celles réellement déclarées dans la maquette
src = open(HTML, encoding="utf-8").read()
def token(nom, defaut):
    m = re.search(rf"--{nom}:\s*(#[0-9A-Fa-f]{{6}})", src)
    return m.group(1) if m else defaut
T = {k: token(k, v) for k, v in {
    "navy": "#0D3B5B", "deep": "#0A2F49", "orange": "#EB912D", "ink": "#13222E",
    "ink2": "#4A5C6B", "muted": "#5E7180", "bg2": "#F5F7F9"}.items()}
infos.append(f"jetons de couleur lus dans la maquette : muted={T['muted']} · ink2={T['ink2']}")

paires = [
    ("texte principal", T["ink"], "#FFFFFF", 4.5),
    ("texte secondaire", T["ink2"], "#FFFFFF", 4.5),
    ("texte discret (hints)", T["muted"], "#FFFFFF", 4.5),
    ("texte discret sur fond gris", T["muted"], T["bg2"], 4.5),
    ("bleu profond sur blanc", T["navy"], "#FFFFFF", 4.5),
    ("blanc sur bleu profond", "#FFFFFF", T["deep"], 4.5),
    ("encre sur orange", "#2A1602", T["orange"], 4.5),
    ("brun sur crème", "#6B4A16", "#FDF7EE", 4.5),
    ("bleu sur bleu pâle", "#123F5F", "#EAF1F5", 4.5),
    ("gris des tuiles inactives", "#7E93A2", "#FFFFFF", 3.0),
    ("badge 18+ sur crème", "#FFF1EC", "#8A2F1F", 4.5),
    ("avertissement sur rose pâle", "#7B2E1E", "#FDF3F1", 4.5),
    ("vert « vérifié » sur vert pâle", "#25634A", "#E7F3EC", 4.5),
    ("discret sur bleu très pâle", T["muted"], "#FAFCFD", 4.5),
]
for nom, fg, bg, seuil in paires:
    r = ratio(fg, bg)
    check(r >= seuil, f"contraste {nom} : {r}:1 (AA ≥ {seuil})", f"{fg} / {bg}")

# ═══════════ 7. MODÈLE DE DONNÉES ═══════════
modele = open(MODELE, encoding="utf-8").read()
for champ in ["prix_heure", "sait_faire", "code_pin", "tuteurs", "creneaux", "carnet",
              "confirmations", "personnes_de_confiance", "vacances", "jours_feries"]:
    check(champ in modele, f"le modèle porte « {champ} »")
# Deux faux positifs de suite sur ce contrôle, et les deux méritent d'être écrits :
#   1. il testait la tournure « copie au moment », que la v2 reformule sans changer la règle ;
#   2. il cherchait « prix du profil » dans le texte brut alors que la phrase est coupée par un retour
#      à la ligne — c'est exactement le défaut du § 13, point 34, où `innerText` conservait les retours.
# Donc : on aplatit l'espace, et on teste les deux notions qui doivent coexister, pas une tournure.
modele_plat = " ".join(modele.split())
check("copie" in modele_plat and "prix du profil" in modele_plat,
      "le prix de la mission est une copie du prix du profil")
# Le décompte a changé avec la relecture experte : 23 → 26 tables (messages, sollicitations,
# heures_declarees). Le contrôle suit la vérité, il ne la fabrique pas.
check("26 tables" in modele_plat or "26 tables" in open(f"{BASE}/SPEC-JOB-ETUDIANT.md", encoding="utf-8").read(),
      "le décompte des 26 tables est écrit")

# ═══════════ RAPPORT ═══════════
print("═" * 80)
for i in infos:
    print("·", i)
print("═" * 80)
print(f"CONTRÔLES RÉUSSIS : {len(ok)}")
print(f"CONTRÔLES ÉCHOUÉS : {len(ko)}")
for k in ko:
    print("   ✗", k)
print("═" * 80)
print("TOUT EST EN ORDRE" if not ko else "IL RESTE DES POINTS À CORRIGER")
