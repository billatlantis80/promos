#!/usr/bin/env python3
"""Ajoute au dictionnaire les 3 clés mises au jour par le balayage des fuites,
dans les 9 langues.

  * « ({n} tours) » — « tours » était écrit en clair dans la carte du compte :
    l'allemand lisait « (200000 tours) » au milieu d'une phrase allemande.
  * les deux phrases de la MENTION D'AFFILIATION (affiliation.js) : le fichier
    n'importait même pas le moteur de traduction, la mention s'affichait donc en
    français dans les 9 langues, dans le pied de page.

On insère à la fin de chaque sous-objet de langue du bloc EXTRA. La valeur d'un
sous-objet est toujours une chaîne sur une ligne : la première ligne «   }, »
rencontrée après l'ouverture est donc bien sa fermeture.
"""
import re
import shutil
import sys

DICO = '/opt/data/webdev/projects/promos/public/langues.js'
APPLIQUER = '--appliquer' in sys.argv

MENTION_ACTIVE = ("Certains liens de cette page sont des liens affiliés : si tu achètes, "
                  "une commission nous est versée par le marchand. Le prix que tu paies "
                  "ne change pas.")
MENTION_INACTIVE = ("Cette version ne contient pas encore d'identifiant d'affiliation : "
                    "les liens sortants sont directs, sans commission.")

NOUVELLES = {
    'fr': {
        '({n} tours)': '({n} tours)',
        MENTION_ACTIVE: MENTION_ACTIVE,
        MENTION_INACTIVE: MENTION_INACTIVE,
    },
    'nl': {
        '({n} tours)': '({n} rondes)',
        MENTION_ACTIVE: "Sommige links op deze pagina zijn affiliatielinks: als je koopt, "
                        "keert de handelaar ons een commissie uit. De prijs die je betaalt "
                        "verandert niet.",
        MENTION_INACTIVE: "Deze versie bevat nog geen affiliatie-ID: de uitgaande links zijn "
                          "direct, zonder commissie.",
    },
    'de': {
        '({n} tours)': '({n} Runden)',
        MENTION_ACTIVE: "Einige Links auf dieser Seite sind Affiliate-Links: Wenn du kaufst, "
                        "zahlt uns der Händler eine Provision. Der Preis, den du zahlst, "
                        "ändert sich nicht.",
        MENTION_INACTIVE: "Diese Version enthält noch keine Affiliate-ID: Die ausgehenden "
                          "Links führen direkt, ohne Provision.",
    },
    'en': {
        '({n} tours)': '({n} rounds)',
        MENTION_ACTIVE: "Some links on this page are affiliate links: if you buy, the merchant "
                        "pays us a commission. The price you pay does not change.",
        MENTION_INACTIVE: "This version does not yet contain an affiliate ID: outgoing links "
                          "are direct, with no commission.",
    },
    'es': {
        '({n} tours)': '({n} rondas)',
        MENTION_ACTIVE: "Algunos enlaces de esta página son enlaces de afiliación: si compras, "
                        "el comercio nos paga una comisión. El precio que pagas no cambia.",
        MENTION_INACTIVE: "Esta versión aún no contiene un identificador de afiliación: los "
                          "enlaces salientes son directos, sin comisión.",
    },
    'it': {
        '({n} tours)': '({n} round)',
        MENTION_ACTIVE: "Alcuni link di questa pagina sono link di affiliazione: se acquisti, "
                        "il negozio ci versa una commissione. Il prezzo che paghi non cambia.",
        MENTION_INACTIVE: "Questa versione non contiene ancora un identificativo di "
                          "affiliazione: i link in uscita sono diretti, senza commissione.",
    },
    'pt': {
        '({n} tours)': '({n} rondas)',
        MENTION_ACTIVE: "Alguns links desta página são links de afiliação: se comprares, o "
                        "comerciante paga-nos uma comissão. O preço que pagas não muda.",
        MENTION_INACTIVE: "Esta versão ainda não contém um identificador de afiliação: os "
                          "links de saída são diretos, sem comissão.",
    },
    'pl': {
        '({n} tours)': '({n} rund)',
        MENTION_ACTIVE: "Niektóre linki na tej stronie to linki afiliacyjne: jeśli kupisz, "
                        "sprzedawca wypłaca nam prowizję. Cena, którą płacisz, nie zmienia się.",
        MENTION_INACTIVE: "Ta wersja nie zawiera jeszcze identyfikatora afiliacyjnego: linki "
                          "wychodzące są bezpośrednie, bez prowizji.",
    },
    'sv': {
        '({n} tours)': '({n} rundor)',
        MENTION_ACTIVE: "Vissa länkar på den här sidan är affiliatelänkar: om du köper betalar "
                        "handlaren oss en provision. Priset du betalar ändras inte.",
        MENTION_INACTIVE: "Den här versionen innehåller ännu inget affiliate-ID: de utgående "
                          "länkarna är direkta, utan provision.",
    },
}

# Valeurs simples : on échappe l'apostrophe et le guillemet pour un littéral JS
# entre apostrophes. Les clés des mentions contiennent une apostrophe : on les
# écrit entre guillemets doubles, comme le fait déjà le fichier pour ces cas.
def lit(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def cle_lit(s):
    if "'" in s and '"' not in s:
        return '"' + s + '"'
    return lit(s)


texte = open(DICO, encoding='utf-8').read()
lignes = texte.split('\n')

# Repérer l'ouverture du bloc EXTRA.
i_extra = next(i for i, l in enumerate(lignes) if l.startswith('const EXTRA = {'))
print(f'bloc EXTRA à la ligne {i_extra + 1}')

ajouts = 0
for lang, entrees in NOUVELLES.items():
    ouverture = None
    for i in range(i_extra, len(lignes)):
        if lignes[i] == f'  {lang}: {{':
            ouverture = i
            break
    assert ouverture is not None, f'sous-objet EXTRA.{lang} introuvable'
    fermeture = None
    for j in range(ouverture + 1, len(lignes)):
        if lignes[j] == '  },' or lignes[j] == '  }':
            fermeture = j
            break
    assert fermeture is not None, f'fermeture de EXTRA.{lang} introuvable'
    # Refus si les clés existent déjà à cet endroit.
    bloc = '\n'.join(lignes[ouverture:fermeture])
    for k in entrees:
        assert f'{cle_lit(k)}:' not in bloc, f'{lang} porte déjà « {k} »'
    nouvelles = [f'    {cle_lit(k)}: {lit(v)},' for k, v in entrees.items()]
    lignes[fermeture:fermeture] = nouvelles
    ajouts += len(nouvelles)
    print(f'  {lang} : {len(nouvelles)} clés ajoutées')

print(f'\ntotal : {ajouts} lignes à ajouter ({len(NOUVELLES)} langues × 3 clés)')
assert ajouts == 27, f'attendu 27, calculé {ajouts}'

if APPLIQUER:
    shutil.copy(DICO, '/tmp/langues.js.avant-fuites')
    open(DICO, 'w', encoding='utf-8').write('\n'.join(lignes))
    print('écrit. Sauvegarde : /tmp/langues.js.avant-fuites')
else:
    print('(essai à blanc — relancer avec --appliquer)')
