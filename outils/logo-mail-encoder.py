"""Met le logo du message de confirmation DANS le script Apps Script.

POURQUOI UN OUTIL, ET PAS UN COLLAGE À LA MAIN. La valeur écrite dans le `.gs`
est un bloc de plusieurs milliers de caractères, sans aucun sens à l'œil : la
recopier à la main, c'est se tromper un jour. Ici, elle est FABRIQUÉE depuis le
fichier image — vos pixels, redimensionnés, jamais retracés.

CE QU'IL FAIT
  1. lit `identite/mail-logo.png` (fabriqué par ce même dossier : 176 px,
     192 couleurs, ~4,8 Ko — voir le rapport du choix dans l'historique) ;
  2. l'encode en base64 ;
  3. remplace la valeur de `LOGO_MAIL_B64` dans `outils/tableau-inscription.gs`.

Il est IDEMPOTENT : le relancer donne exactement le même fichier.

    python3 outils/logo-mail-encoder.py            # encode
    python3 outils/logo-mail-encoder.py --verifier # vérifie sans écrire
"""
import base64
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
PROJET = os.path.dirname(ICI)
IMAGE = os.path.join(PROJET, 'identite', 'mail-logo.png')
SCRIPT = os.path.join(PROJET, 'outils', 'tableau-inscription.gs')
MOTIF = re.compile(r"^var LOGO_MAIL_B64 = '[^']*';$", re.MULTILINE)

def main():
    if not os.path.exists(IMAGE):
        print('IMAGE MANQUANTE : ' + IMAGE)
        return 1
    with open(IMAGE, 'rb') as f:
        octets = f.read()
    b64 = base64.b64encode(octets).decode('ascii')
    with open(SCRIPT, 'r', encoding='utf-8') as f:
        source = f.read()
    if not MOTIF.search(source):
        print('MARQUEUR INTROUVABLE dans ' + SCRIPT + " (attendu : var LOGO_MAIL_B64 = '…';)")
        return 1
    neuve = MOTIF.sub("var LOGO_MAIL_B64 = '" + b64 + "';", source, count=1)
    deja = source == neuve
    if '--verifier' in sys.argv:
        print(f'VERIFIE : image {len(octets)} octets -> base64 {len(b64)} caracteres'
              f' ; script {"a jour" if deja else "PAS a jour"}')
        return 0
    with open(SCRIPT, 'w', encoding='utf-8') as f:
        f.write(neuve)
    print(f'ECRIT : logo {len(octets)} octets -> {len(b64)} caracteres de base64')
    print(f'        script {len(source)} -> {len(neuve)} octets'
          f'{" (inchange : deja a jour)" if deja else ""}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
