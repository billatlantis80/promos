"""Contre-epreuve : on reintroduit des defauts et on verifie que les tests
les attrapent.

IMPORTANT — le 07/10/2026, cette contre-epreuve a pollue le SITE PUBLIE.
Le cron « Collecte » copie public/ vers docs/ puis commite, toutes les
5 minutes. Une mutation en cours a donc ete photographiee et publiee :
le site a servi `align-items: center` au lieu de `flex-start` pendant
quelques minutes. On travaille desormais sur une COPIE du projet, dans
/tmp : plus aucun cron ne peut voir un fichier mutile.
"""
import glob
import os
import re
import shutil
import subprocess

SOURCE = '/opt/data/webdev/projects/promos'
BANC = '/tmp/kaz2/banc'
PUB = f'{BANC}/public'
# TOUS les fichiers de test, où qu'ils soient et sous n'importe lequel des motifs
# que « node --test » ramasse tout seul. Deux corrections successives ont été
# nécessaires, et les deux pour la même raison : le banc SILENCIEUSEMENT plus
# petit que le projet.
#   1. on ne prenait que tests/*.test.mjs — or outils/test-rattachement-pays.mjs
#      est un fichier de test rangé ailleurs.
#   2. l'ajouter au motif « *.test.mjs » ne suffisait pas : ce nom-là finit par
#      « -pays.mjs », c'est le motif « test-*.mjs » qui le ramasse.
# Un contrôle qui tourne sur un jeu plus petit que le vrai ne dit pas qu'il est
# incomplet : il affiche « 0 défaut raté ». D'où le garde-fou plus bas, qui
# COMPARE le nombre de tests du banc à celui du projet et refuse de se taire.
MOTIFS = ('tests/*.test.mjs', 'tests/test-*.mjs', 'outils/*.test.mjs', 'outils/test-*.mjs')
FICHIERS = [f'{PUB}/app.css', f'{PUB}/app.js', f'{PUB}/langues.js', f'{PUB}/index.html',
            f'{BANC}/outils/tableau-inscription.gs']

if os.path.isdir(BANC):
    shutil.rmtree(BANC)
shutil.copytree(SOURCE, BANC,
                ignore=shutil.ignore_patterns('.git', 'node_modules'))

# LA LISTE DES TESTS SE CALCULE ICI, PAS AVANT LA COPIE. Troisieme defaut du
# meme genre, et le plus vicieux : la liste etait construite avant que la copie
# n'existe, donc sur les fichiers de la copie PRECEDENTE. Le banc tournait sur
# un jeu de tests perime — et quand le projet gagnait des tests, le garde-fou
# ci-dessous refusait de conclure, en accusant le banc d'etre incomplet alors
# que c'etait l'inventaire qui etait vieux. Mesure : 249 tests au banc pour 272
# au projet, sans qu'un seul fichier ne manque.
TESTS = sorted({f for m in MOTIFS for f in glob.glob(f'{BANC}/{m}')})
print(f'banc d essai : {BANC} (copie du projet, les fichiers reels ne sont pas touches)')

SAUV = {f: f + '.sauv' for f in FICHIERS}


def lance():
    r = subprocess.run(['node', '--test'] + TESTS, cwd=BANC,
                       capture_output=True, text=True)
    m = re.search(r'# pass (\d+)\n# fail (\d+)', r.stdout)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


def remplace(avant, apres):
    return lambda t: t.replace(avant, apres, 1)


def inverse_colonnes(t):
    """Echange les deux classes de colonnes : les icones repassent a gauche."""
    return (t.replace('class="col-envoi"', 'class="col-TMP"', 1)
             .replace('class="col-icones"', 'class="col-envoi"', 1)
             .replace('class="col-TMP"', 'class="col-icones"', 1))


def _deplace_section(t, ancre_interne):
    """Sort de `t` la section de rubrique qui contient `ancre_interne`.

    Rend (section, reste). Sert aux contre-epreuves qui doivent DEPLACER une
    rubrique : renommer un titre ne change pas l'ordre, et un controle d'ordre
    ne verrait rien — le defaut passerait pour un succes."""
    i = t.index(ancre_interne)
    debut = t.rindex('<section class="rubrique">', 0, i)
    fin = t.index('</section>', i) + len('</section>')
    return t[debut:fin], t[:debut] + t[fin:]


def themes_avant_pays(t):
    """Remet la rubrique Themes AVANT celle du pays : c'est l'ordre inverse de
    la demande (« les themes en premier […] le pays a la fin »)."""
    bloc, reste = _deplace_section(t, '<div class="themes" id="themes"></div>')
    j = reste.index('<div id="regPays"></div>')
    k = reste.rindex('<section class="rubrique">', 0, j)
    return reste[:k] + bloc + '\n    ' + reste[k:]


def themes_apres_pays(t):
    """Pousse la rubrique Themes APRES celle du pays : la demande etait
    Themes -> Affichage -> Pays, celle-ci la casse par le bas."""
    bloc, reste = _deplace_section(t, '<div class="themes" id="themes"></div>')
    j = reste.index('<div id="regPays"></div>')
    fin = reste.index('</section>', j) + len('</section>')
    return reste[:fin] + '\n    ' + bloc + reste[fin:]


def champ_prenom_revient(t):
    """Remet le champ « Prenom (facultatif) » dans le formulaire d'inscription.

    Retire le 08/10/2026 sur demande de B : un champ qui peut rester vide ne
    sert ni a inscrire, ni a ecrire. Si quelqu'un le rebranche un jour, il faut
    que le banc le dise — sinon le meme menage sera a refaire."""
    return t.replace(
        "          <label for=\"cMdp\">",
        "          <label for=\"cPrenom\">${esc(t('Prénom (facultatif)'))}</label>\n"
        "          <input id=\"cPrenom\" type=\"text\" maxlength=\"24\">\n"
        "        </div>\n        <div class=\"champ\">\n"
        "          <label for=\"cMdp\">", 1)


def colonne_prenom_revient(t):
    """Remet la colonne « Prenom » dans les titres du tableau.

    L'effet est mesurable : la ligne ecrite garde 8 cases pour 9 colonnes, et
    tout ce qui suit le prenom (langue, pays, jeton, statut) est decale d'un
    rang. Le tableau reste lisible — et faux."""
    return t.replace("var TITRES = ['Date', 'E-mail', 'Langue'",
                     "var TITRES = ['Date', 'E-mail', 'Prénom', 'Langue']", 1)


def cle_prenom_partout(t):
    """Remet la cle « Prenom (facultatif) » dans les NEUF dictionnaires.

    Mutation volontairement invisible : les neuf langues restent alignees, donc
    les controles de coherence ne voient rien. Seule la traduction est morte —
    plus aucun code ne l'appelle. C'est exactement ce qu'on veut attraper :
    une cle que quelqu'un finira par « corriger » sans comprendre pourquoi
    elle est la.

    L'ANCRE A ETE RECALEE le 08/10/2026 : elle visait « Créer un compte sur cet
    appareil », une cle que la même journée a fait disparaitre. Le banc a alors
    annonce « ANCRE INTROUVABLE » au lieu de faire semblant — c'est exactement
    ce qu'on lui demande, et c'est pour ca qu'il faut le relancer apres chaque
    menage : une contre-epreuve qui ne trouve plus son ancre ne prouve plus
    rien."""
    return t.replace("'Inscris-toi pour recevoir les bons plans, ou connecte-toi si tu as déjà un compte.':",
                     "'Prénom (facultatif)': 'X',\n    "
                     "'Inscris-toi pour recevoir les bons plans, ou connecte-toi si tu as déjà un compte.':")


for f in FICHIERS:
    shutil.copy(f, SAUV[f])

base = lance()
print(f'etat initial : {base[0]} reussis, {base[1]} echoues')

# --- Garde-fou : le banc doit lancer AUTANT de tests que le projet ------------
# Sans cette comparaison, une liste de fichiers incomplete se contente de faire
# tourner moins de tests, et affiche « defauts rates : 0 ». C'est exactement le
# mensonge qu'on veut rendre impossible.
vrai = subprocess.run(['node', '--test'], cwd=SOURCE, capture_output=True, text=True)
m = re.search(r'# tests (\d+)', vrai.stdout)
if not m:
    print('!! impossible de compter les tests du projet : garde-fou inoperant')
elif int(m.group(1)) != base[0]:
    print(f'!! BANC INCOMPLET : {base[0]} tests au banc contre {m.group(1)} au projet.')
    print('   Les defauts rates annonces plus bas ne veulent rien dire. On arrete la.')
    raise SystemExit(2)
else:
    print(f'garde-fou : le banc lance bien les {base[0]} tests du projet')
print()

essais = [
    ('css', 'icones desalignees (flex-start -> center)',
     f'{PUB}/app.css',
     remplace('align-items: flex-start; gap: 8px; }',
              'align-items: center; gap: 8px; }')),
    ('js', 'les icones repassent a GAUCHE du bouton',
     f'{PUB}/app.js', inverse_colonnes),
    ('js', 'la mise a jour remonte HORS du bloc de redirection',
     f'{PUB}/app.js',
     remplace('''          <span class="quand">${quand}</span>
        </div>''',
              '''        </div>
        <span class="quand">${quand}</span>''')),
    ('css', 'le menu de partage s ancre du mauvais cote',
     f'{PUB}/app.css',
     remplace('position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 6;',
              'position: absolute; left: 0; bottom: calc(100% + 6px); z-index: 6;')),
    ('langues', 'une traduction de l accroche disparait',
     f'{PUB}/langues.js',
     remplace("  'Les meilleures promotions': 'De bästa erbjudandena',\n", '')),
    ('index', 'le mot entier ne porte plus le degrade',
     f'{PUB}/index.html',
     remplace('<b class="marque-nom">KAZENDRA</b>',
              '<b class="marque-nom"><span class="k-mot">K</span>AZENDRA</b>')),
    ('css', 'le degrade du mot est reintroduit',
     f'{PUB}/app.css',
     remplace('.marque-nom {\n  color: inherit;\n}',
              '.marque-nom {\n  background-image: linear-gradient(90deg, #025479, #e59038);\n'
              '  -webkit-background-clip: text; background-clip: text;\n'
              '  color: transparent;\n}')),
    ('js', 'le total de l en-tete repasse sur meta.totalOffres',
     f'{PUB}/app.js',
     remplace('const totalPromos = etat.offres.length;',
              'const totalPromos = etat.meta.totalOffres;')),
    ('index', 'l onglet Themes redevient separe de l Affichage',
     f'{PUB}/index.html',
     remplace('<button class="onglet" role="tab" data-onglet="affichage"',
              '<button class="onglet" role="tab" data-onglet="themes"')),
    ('index', 'les themes remontent AVANT le pays',
     f'{PUB}/index.html', themes_avant_pays),
    ('js', 'la liste des langues perd sa classe',
     f'{PUB}/app.js',
     remplace('class="langues" role="radiogroup"', 'class="langues2" role="radiogroup"')),
    ('js', 'le drapeau polonais disparait',
     f'{PUB}/app.js',
     remplace('  pl: \'<rect width="24" height="16" fill="#ffffff"/>'
              '<rect y="8" width="24" height="8" fill="#DC143C"/>\',', '')),
    ('js', 'le pays des reglages redevient un menu deroulant',
     f'{PUB}/app.js',
     remplace('rp.innerHTML = \'<div class="pays-liste pays-2col">\'',
              'rp.innerHTML = \'<div class="champ"><select id="paysReglages"></select></div>\'')),
    ('js', 'la recherche de drapeau redevient sensible a la casse',
     f'{PUB}/app.js',
     remplace('DRAPEAUX_PAYS[String(code).toLowerCase()]', 'DRAPEAUX_PAYS[code]')),
    ('index', 'les themes repassent APRES le pays',
     f'{PUB}/index.html', themes_apres_pays),
    ('js', 'le champ prenom facultatif revient dans le formulaire',
     f'{PUB}/app.js', champ_prenom_revient),
    ('gs', 'la colonne Prenom revient et decale tout le tableau',
     f'{BANC}/outils/tableau-inscription.gs', colonne_prenom_revient),
    ('langues', 'la cle du prenom revient, morte, dans les neuf langues',
     f'{PUB}/langues.js', cle_prenom_partout),
    ('css', 'la barre d onglets redevient collante par-dessus le bandeau',
     f'{PUB}/app.css',
     remplace('position: static; background: transparent;',
              'position: sticky; top: 0; background: var(--fond); z-index: 2;')),
    ('index', 'le bloc collant des reglages perd son nom',
     f'{PUB}/index.html',
     remplace('<div class="feuille-haut">', '<div class="entete-reglages">')),
    ('js', 'l ecran de verrouillage n est plus branche quand on l affiche',
     f'{PUB}/app.js',
     remplace("""  brancherVerrou();
  $('titreVerrou')""", "  $('titreVerrou')")),
]

rates = 0
for quoi, desc, fichier, transforme in essais:
    t = open(fichier).read()
    neuf = transforme(t)
    if neuf == t:
        print(f'{quoi:8s} {desc:46s} -> !! ANCRE INTROUVABLE')
        rates += 1
        continue
    open(fichier, 'w').write(neuf)
    p, f_ = lance()
    attrape = bool(f_ and f_ > 0)
    rates += 0 if attrape else 1
    print(f'{quoi:8s} {desc:46s} -> {"ATTRAPE" if attrape else "*** RATE ***"} ({f_} en echec)')
    shutil.copy(SAUV[fichier], fichier)

fin = lance()
print(f'\napres restauration du banc : {fin[0]} reussis, {fin[1]} echoues')
print(f'defauts rates : {rates}')

# controle : le projet reel n'a pas bouge d'un octet
import hashlib
identiques = all(
    hashlib.sha256(open(f, 'rb').read()).digest()
    == hashlib.sha256(open(f.replace(BANC, SOURCE), 'rb').read()).digest()
    for f in FICHIERS)
print(f'projet reel intact : {identiques}')
