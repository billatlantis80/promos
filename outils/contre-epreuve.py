"""Contre-epreuve : on reintroduit des defauts et on verifie que les tests
les attrapent.

IMPORTANT — le 07/10/2026, cette contre-epreuve a pollue le SITE PUBLIE.
Le cron « Collecte » copie public/ vers docs/ puis commite, toutes les
5 minutes. Une mutation en cours a donc ete photographiee et publiee :
le site a servi `align-items: center` au lieu de `flex-start` pendant
quelques minutes. On travaille desormais sur une COPIE du projet, dans
/tmp : plus aucun cron ne peut voir un fichier mutile.
"""
import fcntl
import glob
import os
import re
import shutil
import subprocess
import sys

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
            f'{PUB}/drapeaux.js', f'{BANC}/outils/tableau-inscription.gs',
            # LE PANNEAU D'ADMINISTRATION, ajoute le 11/10/2026 avec les quatre
            # mutations du retrait des colonnes de siege. Sans lui dans cette
            # liste, aucune mutation de ce fichier ne serait sauvegardee AVANT
            # d'etre ecrite — donc jamais restauree, et le banc resterait mutile
            # pour toutes les mutations suivantes.
            f'{PUB}/admin/index.html',
            # LE MODULE DE VUE DES AFFILIATIONS, ajoute le 12/10/2026 avec la
            # mutation « un acteur fait reste compte dans son groupe de mesure ».
            # Sans lui dans cette liste, cette mutation ne serait jamais
            # restauree et le banc resterait mutile pour toutes les suivantes.
            f'{PUB}/affiliations.js']

# --- VERROU EXCLUSIF : deux bancs dans le meme dossier se detruisent -----------
# Paye le 11/10/2026. Deux executions se sont chevauchees (une ancienne lancee par
# erreur, une neuve) sur le MEME `/tmp/kaz2/banc`. Chacune fait `rmtree` puis
# recopie le projet : la seconde a donc efface les fichiers `.sauv` de la premiere,
# qui est morte sur `FileNotFoundError: .../public/app.js.sauv` — et, avant de
# mourir, elle a ecrit SES mutations dans la copie de la seconde. Les deux jeux de
# resultats etaient bons a jeter, et rien ne le disait.
#
# Le verrou rend la faute impossible au lieu de la documenter : le second banc
# refuse de demarrer, tout de suite, avec la raison.
VERROU = '/tmp/kaz2/banc.lock'
os.makedirs(os.path.dirname(VERROU), exist_ok=True)
# OUVERTURE EN `a+`, JAMAIS EN `w` : `w` tronque le fichier des l'ouverture, donc
# le second banc effacait le pid du premier AVANT d'echouer a prendre le verrou —
# et le message disait « tenu par le pid ? ». Le diagnostic doit nommer le fautif.
_verrou = open(VERROU, 'a+')
try:
    fcntl.flock(_verrou, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    _verrou.seek(0)
    _teneur = _verrou.read().strip() or 'inconnu'
    print(f'!! UN AUTRE BANC TOURNE DEJA (verrou {VERROU}, tenu par le pid {_teneur}).')
    print('   Deux bancs dans le meme dossier s effacent mutuellement les')
    print('   sauvegardes, et les mutations de l un atterrissent dans la copie')
    print('   de l autre : AUCUN des deux resultats ne vaut. On refuse de')
    print('   demarrer plutot que de rendre un chiffre faux.')
    raise SystemExit(2)
_verrou.seek(0)
_verrou.truncate()
_verrou.write(str(os.getpid()) + '\n')
_verrou.flush()

if os.path.isdir(BANC):
    shutil.rmtree(BANC)
# LA COPIE ETAIT LE PLUS GROS POSTE DU BANC, ET POUR RIEN. `docs/img` pese 1,2 Go
# pour 35 639 fichiers ; le disque est de l'ext4, qui ne sait pas copier par
# reference, donc la copie prenait 4 min 45 a chaque execution — plus que les
# trente passes de tests. Aucun test ne lit ces images (verifie le 11/10/2026 :
# les tests enumerent docs/rubriques, lisent docs/offres.json, docs/o et les
# .html ; jamais docs/img). On l'ecarte de la copie : quelques secondes.
_dedans = shutil.ignore_patterns('.git', 'node_modules')


def _ignorer(dossier, noms):
    hors = list(_dedans(dossier, noms))
    if os.path.relpath(dossier, SOURCE) == 'docs' and 'img' in noms:
        hors.append('img')
    return hors


shutil.copytree(SOURCE, BANC, ignore=_ignorer)

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
    que le banc le dise — sinon le meme menage sera a refaire.

    ANCRE RECALEE le 11/10/2026 : elle visait « <label for="cMdp"> », le champ
    du mot de passe, disparu avec le compte local le meme jour. Le formulaire
    n'a plus qu'un seul point d'entree, le champ e-mail — c'est donc lui
    l'ancre, et le champ prenom doit revenir AU-DESSUS de lui, comme avant."""
    return t.replace(
        "        <label for=\"cMail\">${esc(t('Adresse e-mail'))}</label>",
        "        <label for=\"cPrenom\">${esc(t('Prénom (facultatif)'))}</label>\n"
        "        <input id=\"cPrenom\" type=\"text\" maxlength=\"24\">\n"
        "        <label for=\"cMail\">${esc(t('Adresse e-mail'))}</label>", 1)


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

    L'ANCRE A ETE RECALEE DEUX FOIS. Le 08/10/2026 : elle visait « Créer un
    compte sur cet appareil », une cle que la meme journee a fait disparaitre ;
    le banc a alors annonce « ANCRE INTROUVABLE » au lieu de faire semblant —
    c'est exactement ce qu'on lui demande. Le 11/10/2026 : elle visait
    « Inscris-toi pour recevoir les bons plans, ou connecte-toi si tu as déjà
    un compte. », phrase reecrite lors du retrait du compte local. L'ancre est
    desormais « Inscription aux bons plans », presente une fois dans chacun des
    neuf dictionnaires — et la mutation les touche donc bien tous les neuf,
    comme son nom l'annonce."""
    return re.sub(
        r"(?m)^(\s*)('Inscription aux bons plans':)",
        r"\1'Prénom (facultatif)': 'X',\n\1\2", t)


for f in FICHIERS:
    shutil.copy(f, SAUV[f])

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
     f'{PUB}/drapeaux.js',
     remplace('  pl: \'<rect width="24" height="16" fill="#ffffff"/>'
              '<rect y="8" width="24" height="8" fill="#DC143C"/>\',', '')),
    ('js', 'le pays des reglages redevient un menu deroulant',
     f'{PUB}/app.js',
     remplace("  return '<div class=\"pays-liste pays-2col\">'",
              "  return '<div class=\"champ\"><select id=\"paysReglages\"></select></div>'")),
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
    # ⚠ L'ANCIENNE DERNIERE EPREUVE — « le branchement du verrou arrive trop tard,
    # c'est a dire APRES l'affichage » — mutait `brancherVerrou();` : ce code a
    # disparu le 11/10/2026 avec le compte local, donc l'ancre etait INTROUVABLE
    # et le banc se comptait lui-meme un defaut rate. Elle est remplacee par les
    # huit mutations du retrait, une par endroit nettoye.
    ('js', 'le bouton redevient « Creer mon compte »',
     f'{PUB}/app.js',
     remplace("id=\"sInscrire\">${esc(t(\"S'inscrire\"))}", "id=\"sInscrire\">${esc(t('Créer mon compte'))}")),
    # ⚠ ANCRE CORRIGEE LE 12/10/2026 — elle visait le MAUVAIS endroit, et le banc
    # s'en trouvait aveugle. `remplace()` ne remplace que la PREMIERE occurrence
    # (t.replace(a, b, 1)) ; or « etat.portee = 'tout'; » apparait DEUX fois :
    # dans le bouton « Voir toutes les promos » (legitime) et dans retourAccueil(),
    # la fonction du logo. La mutation tombait donc sur le BOUTON, jamais sur le
    # logo — et l'epreuve, qui n'examine que le corps de retourAccueil(), ne
    # pouvait pas la voir. Mesure : mutation de la 1re occurrence -> epreuve PASSE ;
    # mutation de l'occurrence du logo -> epreuve ECHOUE. L'ancre porte donc
    # maintenant le commentaire qui n'existe qu'a cet endroit.
    ('js', 'le logo rejoue l accueil au lieu d elargir la vue',
     f'{PUB}/app.js',
     remplace("il ne rejoue pas l'accueil.\n  etat.portee = 'tout';",
              "il ne rejoue pas l'accueil.\n  etat.portee = 'promos';")),
    ('js', "l ouverture ne montre plus les bonnes promos",
     f'{PUB}/app.js',
     remplace("portee: 'promos',", "portee: 'tout',")),
    ('js', 'le vestige du compte local n est plus efface au demarrage',
     f'{PUB}/app.js',
     remplace("localStorage.removeItem('promos.compte')",
              "localStorage.removeItem('promos.compte-parti')")),
    ('js', "l export RGPD remet le champ du compte disparu",
     f'{PUB}/app.js',
     remplace("    inscription: inscriptionLocale(),",
              "    compte: null,\n    inscription: inscriptionLocale(),")),
    ('js', 'le petit oeil revient dans le programme',
     f'{PUB}/app.js',
     remplace('function carteAppareil() {', 'function preparerOeils() {}\nfunction carteAppareil() {')),
    ('index', "l ecran de verrouillage revient dans la page",
     f'{PUB}/index.html',
     remplace('<main>', '<section class="verrou" id="verrou" hidden></section>\n<main>')),
    ('css', 'les deux encadres repassent en align-items: start',
     f'{PUB}/app.css',
     remplace('.panneau[data-panneau="compte"] { align-items: stretch; }',
              '.panneau[data-panneau="compte"] { align-items: start; }')),

    # --- LE RETRAIT DES NEUF COLONNES DE SIEGE (11/10/2026) -------------------
    # B : « tu peux defnitivement enlever les colonnes suivantes car elles ne
    # servent a rien a cet endroit-la. Tu peux laisser les notes. » Quatre
    # mutations, une par endroit nettoye, plus le defaut REPARE au passage
    # (Positionnement, absent de l'export CSV). Chacune doit etre attrapee, sinon
    # le retrait revient par la prochaine greffe partielle.
    ('admin', 'les colonnes de siege reviennent dans l en-tete',
     f'{PUB}/admin/index.html',
     remplace('<th>Site</th><th>Adresse des promotions</th><th>Note</th></tr>',
              '<th>Site</th><th>Adresse des promotions</th>'
              '<th class="info sep">CA indicatif</th><th>Note</th></tr>')),
    ('admin', 'une cellule informative revient dans chaque ligne',
     f'{PUB}/admin/index.html',
     remplace('<td>${blocAdresse(a)}</td>\n          <td>${blocNote(a.nom)}</td></tr>',
              '<td>${blocAdresse(a)}</td>\n'
              '          <td class="info sep">Rue X</td>\n'
              '          <td>${blocNote(a.nom)}</td></tr>')),
    ('admin', 'la largeur de la fiche sort du tableau',
     f'{PUB}/admin/index.html',
     # ANCRE RECALEE le 12/10/2026 : elle visait `colspan="8"`, la valeur quand le
     # tableau avait huit colonnes. « Type » et « Lu par » sont partis depuis, donc
     # la valeur attendue est 6 — et la mutation pose un nombre qui n'est NI celui
     # du tableau NI celui d'avant.
     remplace('<td colspan="6">', '<td colspan="11">')),
    ('admin', 'l export CSV reperd la colonne Positionnement',
     f'{PUB}/admin/index.html',
     remplace("'Actionnariat', 'Positionnement', 'Segment'", "'Actionnariat', 'Segment'")),
    ('admin', 'la colonne Type revient dans l en-tete',
     f'{PUB}/admin/index.html',
     remplace('<th>Acteur</th><th>État</th><th class="n">Articles</th>',
              '<th>Acteur</th><th>État</th><th>Type</th><th class="n">Articles</th>')),
    ('admin', 'la colonne Lu par revient dans chaque ligne',
     f'{PUB}/admin/index.html',
     remplace("<td class=\"n\">${a.annonces ? nf.format(a.annonces) : '—'}</td>",
              "<td class=\"n\">${a.annonces ? nf.format(a.annonces) : '—'}</td>\n"
              "          <td class=\"fin lu-par\">${(a.liaison.flux || []).map((s) => s.nom).join(' · ')}</td>")),

    # --- CE QUI EST DÉJÀ FAIT (12/10/2026) -------------------------------------
    # B : « je ne vois pas une catégorie qui indique combien d'affiliation j'ai
    # déjà fait. Actuellement j'en ai fait deux. » Trois mutations : le compte, le
    # titre du bloc, et la règle de rangement (qui est la plus fragile — c'est
    # elle qui garantit qu'aucun acteur n'est compté deux fois).
    ('admin', 'la tuile du compte des affiliations faites disparait',
     f'{PUB}/admin/index.html',
     remplace("    [nf.format(c.faites), 'affiliation(s) déjà faite(s) dans ce pays'],\n", "")),
    ('admin', 'le bloc des affiliations faites ne dit plus COMBIEN',
     f'{PUB}/admin/index.html',
     remplace('Déjà fait — ${nf.format(faites.length)} affiliation(s) en tout',
              'Déjà fait — les affiliations ouvertes')),
    ('admin', 'la tuile du compte ne dit plus DE QUEL PAYS elle parle',
     f'{PUB}/admin/index.html',
     remplace("'affiliation(s) déjà faite(s) dans ce pays'", "'affiliation(s) déjà faite(s)'")),
    ('admin', 'le bloc ne reconcilie plus les deux chiffres',
     f'{PUB}/admin/index.html',
     remplace('ne compte que le pays consulté — ici <b>${nf.format(c.faites)}</b>',
              'compte les affiliations ouvertes')),
    ('js', 'un acteur fait reste compte dans son groupe de MESURE',
     f'{PUB}/affiliations.js',
     remplace('const liste = enrichis.filter((a) => a.etatVue === etat)',
              'const liste = enrichis.filter((a) => a.affiliation.etat === etat)')),

    # --- LA COLONNE PREUVE RETIREE (12/10/2026) --------------------------------
    # B : « au niveau affiliation, les acteurs et leur affiliation, tu peux
    # enlever la colonne preuve. » L'ancre de la seconde mutation porte le `;` de
    # fin : sans lui, elle toucherait la derniere cellule du tableau du MARCHE
    # EURO, dont le texte est identique — et le banc mutilerait la mauvaise table.
    ('admin', 'la colonne Preuve revient dans l en-tete',
     f'{PUB}/admin/index.html',
     remplace('<th>Réseaux</th><th>Note</th></tr>',
              '<th>Réseaux</th><th>Preuve</th><th>Note</th></tr>')),
    ('admin', 'une cellule de preuve revient dans chaque ligne',
     f'{PUB}/admin/index.html',
     remplace('<td>${blocNote(a.nom)}</td></tr>`;',
              '<td class="tres-fin preuve">Rue X</td>\n'
              '          <td>${blocNote(a.nom)}</td></tr>`;')),
]


# --- Controle PREALABLE DES ANCRES, avant toute passe de tests ----------------
# Cinquieme defaut du meme banc, trouve le 11/10/2026. Chaque mutation est un
# remplacement de texte : si le texte vise a disparu, la mutation ne s'applique
# pas, le fichier reste sain, AUCUN test n'echoue, et le banc compte un
# « defaut rate » — alors que le banc lui-meme est en tort. Le cas se produit a
# chaque menage : la mutation qui visait `brancherVerrou();` a survecu au retrait
# du verrou et accusait le projet.
#
# Or une passe de tests coute ~64 s et il y en a trente : decouvrir une ancre
# morte a la fin, c'est 30 minutes pour un message qui tient en une ligne. Ce
# controle ne lit que des fichiers, ne modifie rien, et ARRETE le banc avant la
# premiere passe. Il faut reancrer la mutation, ou la retirer si le code qu'elle
# visait a ete supprime pour de bon.
morts = []
for _quoi, _desc, _fichier, _transforme in essais:
    _t = open(_fichier).read()
    if _transforme(_t) == _t:
        morts.append((_quoi, _desc))
if morts:
    print(f'!! {len(morts)} MUTATION(S) SANS ANCRE : le texte vise n existe plus.')
    for _quoi, _desc in morts:
        print(f'   {_quoi:8s} {_desc}')
    print('   Une ancre morte ferait compter un « defaut rate » au banc alors que')
    print('   le banc est en tort. On arrete AVANT les trente passes de tests.')
    raise SystemExit(2)
print(f'ancres : les {len(essais)} mutations trouvent toutes leur ancre')
if '--ancres' in sys.argv:
    print('(controle des ancres seul, aucun test lance)')
    raise SystemExit(0)
print()

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
elif int(m.group(1)) != base[0] + base[1]:
    # QUATRIEME DEFAUT DU MEME GARDE-FOU, trouve le 11/10/2026 — et il rendait le
    # banc MUET depuis l'apparition des deux echecs connus (une date de releve et
    # une adresse declaree qui repond 404). La comparaison portait le nombre de
    # tests REUSSIS du banc (base[0]) au nombre TOTAL de tests du projet : 745
    # contre 747, pour toujours. Le banc refusait donc de conclure — trois
    # executions de suite, en accusant sa copie alors que sa copie etait
    # parfaitement complete (verifie : 747 tests dans la copie, listes de
    # fichiers identiques). On compare des TOTAUX : reussis + echoues.
    print(f'!! BANC INCOMPLET : {base[0] + base[1]} tests au banc '
          f'({base[0]} reussis, {base[1]} echoues) contre {m.group(1)} au projet.')
    print('   Les defauts rates annonces plus bas ne veulent rien dire. On arrete la.')
    raise SystemExit(2)
else:
    print(f'garde-fou : le banc lance bien les {base[0] + base[1]} tests du projet '
          f'({base[0]} reussis, {base[1]} echoues)')
print()


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
    # ⚠ CORRIGE LE 12/10/2026 — le verdict comparait a ZERO, donc le banc etait
    # AVEUGLE des qu'un test rouge preexistait. Mesure : au passage de 23:42, la
    # base portait 2 echecs connus ; la mutation « le logo rejoue l accueil »
    # affichait alors « ATTRAPE (2 en echec) » — or ces 2 echecs etaient CEUX DE
    # LA BASE, pas de la mutation. Un defaut est ATTRAPE s'il AJOUTE un echec a la
    # base ; sinon une base rouge fait passer toutes les mutations pour attrapees,
    # et le banc ment dans le sens rassurant, le pire des deux.
    attrape = bool(f_ is not None and base[1] is not None and f_ > base[1])
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
