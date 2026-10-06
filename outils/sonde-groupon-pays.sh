#!/bin/bash
# Sonde Groupon par pays — quels domaines existent, et lesquels rendent des
# PRIX lisibles (JSON-LD « priceSpecification ») ?
#
# Discipline : contrôle POSITIF (un domaine qu'on SAIT bon : groupon.be doit
# ressortir) et contrôle NÉGATIF (un domaine inventé doit ressortir vide),
# sinon un « 0 partout » se lit comme « Groupon n'existe nulle part ».
#
# Lecture par curl, jamais par Node : le fetch Node est refusé par l'empreinte
# TLS de Groupon (403), curl passe (200). Mesuré, pas supposé.
set -u
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

sonde() { # domaine chemin
  local url="https://$1$2"
  local code taille prix
  corps=$(curl -sL --max-time 25 -A "$UA" -H 'Accept-Language: fr,en;q=0.8' \
            -w '\n@@%{http_code}' "$url" 2>/dev/null)
  code=$(printf '%s' "$corps" | tail -1 | sed 's/@@//')
  html=$(printf '%s' "$corps" | sed '$d')
  taille=${#html}
  prix=$(printf '%s' "$html" | grep -o 'priceSpecification' | wc -l)
  listp=$(printf '%s' "$html" | grep -o '"ListPrice"' | wc -l)
  printf '%-26s %-22s %-6s %9s  priceSpec=%-4s ListPrice=%s\n' \
         "$1" "$2" "${code:-000}" "$taille" "$prix" "$listp"
}

echo "=== DOMAINES ET CHEMINS ==="
for d in groupon.be groupon.fr groupon.de groupon.it groupon.es groupon.pl \
         groupon.nl groupon.at groupon.co.uk groupon.ie groupon.pt groupon.se \
         groupon.com domainequinexistepas.invalid ; do
  for p in / /goods /fr/landing/sale /landing/sale /bon-plan /deals /local; do
    sonde "$d" "$p"
    sleep 1
  done
  echo
done
