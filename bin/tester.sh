#!/bin/bash
# Tests de l'application n°2 « Promos ».
# Le contrôle le plus utile est le dernier : il balaye data/offres.json et
# échoue si une entité HTML (« &#160; ») subsiste — c'est-à-dire si quelque
# chose d'illisible s'afficherait à l'écran.
cd /opt/data/webdev/projects/promos || exit 1
node --test "$@"
